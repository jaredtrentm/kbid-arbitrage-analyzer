import { NextRequest, NextResponse } from 'next/server';
import { scrapeKBid } from '@/services/kbidScraper';
import { extractItemDetails } from '@/services/aiExtractor';
import { getValuation } from '@/services/webSearchValuation';
import { calculateProfit } from '@/services/profitCalculator';
import { getResaleAdvice } from '@/services/resaleAdvisor';
import { AnalysisParams, AnalyzedItem, AnalysisResponse, ParsedItem } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function processItem(
  item: ParsedItem,
  params: AnalysisParams
): Promise<AnalyzedItem | null> {
  try {
    const valuation = await getValuation(item);

    // Skip items with no valuation
    if (valuation.estimatedValue === 0) {
      return null;
    }

    const profit = calculateProfit(item, valuation, params);

    // Skip items that don't meet profit criteria
    if (profit.expectedProfit < params.profit_min_dollars ||
        profit.expectedROI < params.profit_min_percent) {
      return null;
    }

    const resale = await getResaleAdvice(item, valuation);

    return { item, valuation, profit, resale };
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
    const params: AnalysisParams = await request.json();

    // Validate params
    if (!params.profit_min_dollars || !params.profit_min_percent || !params.max_items) {
      return NextResponse.json({
        success: false,
        items: [],
        summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 1 },
        error: 'Missing required parameters'
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

    // Step 1: Scrape K-Bid
    console.log('Scraping K-Bid...');
    const rawItems = await scrapeKBid(params.max_items);
    console.log(`Scraped ${rawItems.length} items`);

    if (rawItems.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        summary: { totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 0 },
        error: 'No items found on K-Bid. The website structure may have changed.'
      });
    }

    // Step 2: Extract item details with AI
    console.log('Extracting item details...');
    const parsedItems = await extractItemDetails(rawItems);
    console.log(`Parsed ${parsedItems.length} items`);

    // Filter out excluded items
    const eligibleItems = parsedItems.filter(item => !item.excluded);
    console.log(`${eligibleItems.length} eligible items after filtering`);

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
        error: 'No eligible items found after filtering exclusions'
      });
    }

    // Step 3: Process items (valuation + profit + advice)
    console.log('Processing items...');
    const analyzedItems = await processWithConcurrency(
      eligibleItems,
      (item) => processItem(item, params),
      3
    );

    // Sort by expected profit descending
    analyzedItems.sort((a, b) => b.profit.expectedProfit - a.profit.expectedProfit);

    return NextResponse.json({
      success: true,
      items: analyzedItems,
      summary: {
        totalScraped: rawItems.length,
        totalAnalyzed: eligibleItems.length,
        totalProfitable: analyzedItems.length,
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
