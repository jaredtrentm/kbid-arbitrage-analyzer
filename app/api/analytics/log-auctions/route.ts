import { NextRequest, NextResponse } from 'next/server';
import { supabase, AnalyzedAuctionInsert } from '@/lib/supabase';
import { AnalyzedItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LogAuctionsRequest {
  items: AnalyzedItem[];
}

export async function POST(request: NextRequest) {
  try {
    const { items }: LogAuctionsRequest = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, logged: 0 });
    }

    // Transform items to database format
    const auctionRecords: AnalyzedAuctionInsert[] = items.map(item => {
      // Overpay = total cost exceeds value after selling fees (excludes shipping)
      // This accounts for: K-Bid 10% buyer premium and selling fees only
      const BUYER_PREMIUM = 1.10;
      const actualTotalCost = item.item.currentBid * BUYER_PREMIUM;
      const netValueAfterFees = item.valuation.estimatedValue - item.profit.fees;
      const isOverbid = actualTotalCost > netValueAfterFees;
      // Overpay amount is how much over the net value they paid
      const overpayAmount = isOverbid ? actualTotalCost - netValueAfterFees : undefined;
      // Overpay percent relative to net value
      const overpayPercent = isOverbid && netValueAfterFees > 0
        ? ((actualTotalCost - netValueAfterFees) / netValueAfterFees) * 100
        : undefined;

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
        risk_score: item.resale.riskScore,
        risk_reasoning: item.resale.riskReasoning,
        recommended_channel: item.resale.recommendedChannel,
        valuation_confidence: item.valuation.confidence,
        valuation_reasoning: item.valuation.reasoning,
        valuation_low: item.valuation.lowEstimate,
        valuation_high: item.valuation.highEstimate,
      };
    });

    // Insert into database (upsert on auction_url to avoid duplicates)
    const { error } = await supabase
      .from('analyzed_auctions')
      .upsert(auctionRecords, {
        onConflict: 'auction_url',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Failed to log auctions:', error);
      // Don't fail the request - logging is secondary
      return NextResponse.json({ success: true, logged: 0, error: error.message });
    }

    // Update category stats
    await updateCategoryStats(auctionRecords);

    return NextResponse.json({ success: true, logged: auctionRecords.length });

  } catch (error) {
    console.error('Error logging auctions:', error);
    return NextResponse.json({ success: false, error: 'Failed to log auctions' }, { status: 500 });
  }
}

async function updateCategoryStats(auctions: AnalyzedAuctionInsert[]) {
  // Group by category
  const categoryGroups = new Map<string, AnalyzedAuctionInsert[]>();
  for (const auction of auctions) {
    const cat = auction.category || 'Uncategorized';
    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, []);
    }
    categoryGroups.get(cat)!.push(auction);
  }

  // Update each category
  for (const [category, items] of categoryGroups) {
    const overbidItems = items.filter(i => i.is_overbid);
    const profitableItems = items.filter(i => i.is_profitable);

    const avgOverpay = overbidItems.length > 0
      ? overbidItems.reduce((sum, i) => sum + (i.overpay_percent || 0), 0) / overbidItems.length
      : 0;

    const avgProfit = profitableItems.length > 0
      ? profitableItems.reduce((sum, i) => sum + i.actual_profit, 0) / profitableItems.length
      : 0;

    const avgRoi = profitableItems.length > 0
      ? profitableItems.reduce((sum, i) => sum + i.actual_roi, 0) / profitableItems.length
      : 0;

    // Calculate opportunity score (higher = better for flipping)
    // Based on ratio of profitable to overbid items
    const opportunityScore = items.length > 0
      ? ((profitableItems.length - overbidItems.length) / items.length) * 100
      : 0;

    // Upsert category stats
    await supabase
      .from('category_stats')
      .upsert({
        category,
        total_analyzed: items.length,
        total_profitable: profitableItems.length,
        total_overbid: overbidItems.length,
        avg_overpay_percent: avgOverpay,
        avg_profit: avgProfit,
        avg_roi: avgRoi,
        opportunity_score: opportunityScore,
      }, {
        onConflict: 'category'
      });
  }
}
