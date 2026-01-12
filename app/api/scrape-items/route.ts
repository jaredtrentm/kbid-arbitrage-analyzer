import { NextRequest, NextResponse } from 'next/server';
import { scrapeKBid } from '@/services/kbidScraper';
import { RawKBidItem } from '@/lib/types';

export const maxDuration = 60; // Scraping is fast, 60s is plenty
export const dynamic = 'force-dynamic';

interface ScrapeRequest {
  max_items: number;
  days_until_close: number;
}

interface ScrapeResponse {
  success: boolean;
  items: RawKBidItem[];
  totalCount: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ScrapeResponse>> {
  try {
    const params: ScrapeRequest = await request.json();

    const maxItems = params.max_items || 100;
    const daysUntilClose = params.days_until_close || 7;

    console.log(`Scraping up to ${maxItems} items from auctions closing within ${daysUntilClose} days...`);

    const rawItems = await scrapeKBid(maxItems, daysUntilClose);

    console.log(`Scraped ${rawItems.length} items`);

    return NextResponse.json({
      success: true,
      items: rawItems,
      totalCount: rawItems.length
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({
      success: false,
      items: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
