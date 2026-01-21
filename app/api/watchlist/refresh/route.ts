import { NextResponse } from 'next/server';
import { supabase, WatchlistItem } from '@/lib/supabase';
import { SCRAPE_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fetch current bid from a K-Bid item page
async function fetchCurrentBid(auctionUrl: string): Promise<{ currentBid: number | null; isClosed: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPE_CONFIG.fetchTimeout);

    const response = await fetch(auctionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const html = await response.text();

    // Check if auction is closed
    const closedPatterns = [
      /lot\s+is\s+closed/i,
      /auction\s+closed/i,
      /bidding\s+closed/i,
      /this\s+lot\s+has\s+ended/i,
      /bidding\s+has\s+ended/i
    ];
    const isClosed = closedPatterns.some(pattern => pattern.test(html));

    // Extract current bid
    const strongMatch = html.match(/<strong[^>]*>Current Bid:\s*\$?([\d,]+(?:\.\d{2})?)<\/strong>/i);
    if (strongMatch) {
      return { currentBid: parseFloat(strongMatch[1].replace(/,/g, '')), isClosed };
    }

    const bidMatch = html.match(/Current Bid[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
    if (bidMatch) {
      return { currentBid: parseFloat(bidMatch[1].replace(/,/g, '')), isClosed };
    }

    return { currentBid: null, isClosed };
  } catch (error) {
    console.error(`Failed to fetch bid for ${auctionUrl}:`, error);
    return { currentBid: null, isClosed: false };
  }
}

// POST - Refresh current bids for all watchlist items
export async function POST(): Promise<NextResponse> {
  try {
    // Get all watchlist items
    const { data: items, error: fetchError } = await supabase
      .from('watchlist')
      .select('*');

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        items: []
      });
    }

    // Fetch current bids in parallel (limit concurrency)
    const results: { id: string; currentBid: number | null; isClosed: boolean }[] = [];
    const batchSize = 5;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (item: WatchlistItem) => {
          const { currentBid, isClosed } = await fetchCurrentBid(item.auction_url);
          return { id: item.id, currentBid, isClosed };
        })
      );
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < items.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Update items with new bids
    let updatedCount = 0;
    for (const result of results) {
      if (result.currentBid !== null) {
        const { error: updateError } = await supabase
          .from('watchlist')
          .update({ current_bid: result.currentBid })
          .eq('id', result.id);

        if (!updateError) {
          updatedCount++;
        }
      }
    }

    // Fetch updated items
    const { data: updatedItems } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      items: updatedItems as WatchlistItem[],
      closedItems: results.filter(r => r.isClosed).map(r => r.id)
    });
  } catch (error) {
    console.error('Watchlist refresh error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
