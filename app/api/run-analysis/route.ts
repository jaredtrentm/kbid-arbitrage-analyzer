import { NextRequest, NextResponse } from 'next/server';
import { extractItemDetails } from '@/services/aiExtractor';
import { getValuation } from '@/services/webSearchValuation';
import { calculateProfit } from '@/services/profitCalculator';
import { getResaleAdvice } from '@/services/resaleAdvisor';
import { AnalyzedItem, AnalysisResponse, ParsedItem, RawKBidItem } from '@/lib/types';
import { mapToFilterCategory, CATEGORY_OPTIONS } from '@/lib/config';
import { supabase, AnalyzedAuctionInsert } from '@/lib/supabase';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Determine if auction is closed based on end date
function getAuctionStatus(endDateStr?: string): { isClosed: boolean; status: 'live' | 'closed' | 'sold' | 'unsold' } {
  if (!endDateStr) {
    return { isClosed: false, status: 'live' };
  }

  try {
    // Parse various date formats (e.g., "Jan 21, 2025 7:00 PM", "1/21/2025")
    const endDate = new Date(endDateStr);
    const now = new Date();

    if (isNaN(endDate.getTime())) {
      return { isClosed: false, status: 'live' };
    }

    const isClosed = endDate < now;
    // If closed and has bids, assume sold (we can refine this later with actual sale data)
    return {
      isClosed,
      status: isClosed ? 'closed' : 'live'
    };
  } catch {
    return { isClosed: false, status: 'live' };
  }
}

// Log analyzed items to database for market intelligence
async function logAnalyzedItems(items: AnalyzedItem[]): Promise<void> {
  if (items.length === 0) return;

  const auctionRecords: AnalyzedAuctionInsert[] = items.map(item => {
    const isOverbid = item.item.currentBid > item.profit.maxBid;
    const overpayAmount = isOverbid ? item.item.currentBid - item.valuation.estimatedValue : undefined;
    const overpayPercent = isOverbid && item.valuation.estimatedValue > 0
      ? ((item.item.currentBid - item.valuation.estimatedValue) / item.valuation.estimatedValue) * 100
      : undefined;

    // Determine auction status
    const { isClosed, status } = getAuctionStatus(item.item.auctionEndDate);

    return {
      title: item.item.title,
      description: item.item.description,
      category: item.item.category,
      condition: item.item.condition,
      size_class: item.item.sizeClass,
      auction_url: item.item.auctionUrl,
      image_url: item.item.imageUrl,
      auction_end_date: item.item.auctionEndDate,
      bid_count: item.item.bidCount || 0,
      bidder_count: item.item.bidderCount || 0,
      interest_level: item.item.interestLevel,
      current_bid: item.item.currentBid,
      estimated_value: item.valuation.estimatedValue,
      max_bid: item.profit.maxBid,
      actual_profit: item.profit.actualProfit,
      actual_roi: item.profit.actualROI,
      expected_profit: item.profit.expectedProfit,
      expected_roi: item.profit.expectedROI,
      break_even_price: item.profit.breakEvenPrice,
      shipping_estimate: item.profit.shippingEstimate,
      fees: item.profit.fees,
      is_overbid: isOverbid,
      is_profitable: item.meetsCriteria,
      overpay_amount: overpayAmount,
      overpay_percent: overpayPercent,
      is_closed: isClosed,
      auction_status: status,
      risk_score: item.resale.riskScore,
      risk_reasoning: item.resale.riskReasoning,
      recommended_channel: item.resale.recommendedChannel,
      valuation_confidence: item.valuation.confidence,
      valuation_reasoning: item.valuation.reasoning,
      valuation_low: item.valuation.lowEstimate,
      valuation_high: item.valuation.highEstimate,
    };
  });

  // Insert into database
  const { error } = await supabase
    .from('analyzed_auctions')
    .insert(auctionRecords);

  if (error) {
    console.error('Failed to log auctions to database:', error);
  } else {
    console.log(`Logged ${auctionRecords.length} auctions to database`);
  }
}

interface BatchAnalysisParams {
  profit_min_dollars: number;
  profit_min_percent: number;
  selling_fee_percent: number;
  raw_items: RawKBidItem[]; // Items to analyze (from scrape-items endpoint)
  selected_categories?: string[]; // Optional category filter
}

async function processItem(
  item: ParsedItem,
  params: BatchAnalysisParams
): Promise<AnalyzedItem | null> {
  try {
    const valuation = await getValuation(item);

    // If no valuation, create a placeholder
    if (valuation.estimatedValue === 0) {
      return {
        item,
        valuation,
        profit: {
          maxBid: 0,
          expectedProfit: 0,
          expectedROI: 0,
          actualProfit: 0,
          actualROI: 0,
          breakEvenPrice: 0,
          shippingEstimate: 0,
          fees: 0
        },
        resale: {
          recommendedChannel: 'Unknown',
          riskScore: 'high',
          riskReasoning: 'Could not determine market value',
          tips: []
        },
        meetsCriteria: false
      };
    }

    const profit = calculateProfit(item, valuation, {
      profit_min_dollars: params.profit_min_dollars,
      profit_min_percent: params.profit_min_percent,
      selling_fee_percent: params.selling_fee_percent,
      max_items: 0,
      start_date: '',
      end_date: ''
    });

    // Check if meets profit criteria
    // Item must be profitable AND current bid must be at or below max bid
    const meetsCriteria = profit.expectedProfit >= params.profit_min_dollars &&
                          profit.expectedROI >= params.profit_min_percent &&
                          item.currentBid <= profit.maxBid;

    const resale = await getResaleAdvice(item, valuation);

    return { item, valuation, profit, resale, meetsCriteria };
  } catch (error) {
    console.error('Error processing item:', item.title, error);
    return null;
  }
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R | null>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const result = await processor(items[currentIndex]);
      if (result !== null) {
        results.push(result);
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
    const params: BatchAnalysisParams = await request.json();

    // Validate params
    if (params.profit_min_dollars === undefined ||
        params.profit_min_percent === undefined ||
        !params.raw_items || params.raw_items.length === 0) {
      return NextResponse.json({
        success: false,
        items: [],
        summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 1 },
        error: 'Missing required parameters or no items to analyze'
      }, { status: 400 });
    }

    // Validate env vars
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        items: [],
        summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 1 },
        error: 'ANTHROPIC_API_KEY is not configured'
      }, { status: 500 });
    }

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({
        success: false,
        items: [],
        summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 1 },
        error: 'SERPER_API_KEY is not configured'
      }, { status: 500 });
    }

    const rawItems = params.raw_items;
    console.log(`Analyzing batch of ${rawItems.length} items...`);

    // Step 1: Extract item details with AI
    console.log('Extracting item details...');
    const parsedItems = await extractItemDetails(rawItems);
    console.log(`Parsed ${parsedItems.length} items`);

    // Filter out excluded items
    let eligibleItems = parsedItems.filter(item => !item.excluded);
    console.log(`${eligibleItems.length} eligible items after filtering exclusions`);

    // Filter by selected categories if provided
    const selectedCategories = params.selected_categories;
    if (selectedCategories && selectedCategories.length > 0 && selectedCategories.length < CATEGORY_OPTIONS.length) {
      eligibleItems = eligibleItems.filter(item => {
        const mappedCategory = mapToFilterCategory(item.category);
        return selectedCategories.includes(mappedCategory);
      });
      console.log(`${eligibleItems.length} items after category filtering (selected: ${selectedCategories.join(', ')})`);
    }

    if (eligibleItems.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        summary: {
          totalScraped: rawItems.length,
          totalAnalyzed: 0,
          totalProfitable: 0,
          errors: 0
        },
        error: 'No eligible items found after filtering'
      });
    }

    // Step 2: Process items (valuation + profit + advice)
    console.log('Processing items...');
    const analyzedItems = await processWithConcurrency(
      eligibleItems,
      (item) => processItem(item, params),
      3
    );

    // Sort by expected profit descending (profitable items first)
    analyzedItems.sort((a, b) => b.profit.expectedProfit - a.profit.expectedProfit);

    // Count profitable items
    const profitableCount = analyzedItems.filter(item => item.meetsCriteria).length;

    // Log all analyzed items to database for market intelligence (fire and forget)
    logAnalyzedItems(analyzedItems).catch(err => {
      console.error('Failed to log analyzed items:', err);
    });

    return NextResponse.json({
      success: true,
      items: analyzedItems,
      summary: {
        totalScraped: rawItems.length,
        totalAnalyzed: eligibleItems.length,
        totalProfitable: profitableCount,
        errors: eligibleItems.length - analyzedItems.length
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({
      success: false,
      items: [],
      summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 1 },
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
