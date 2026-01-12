import { NextRequest, NextResponse } from 'next/server';
import { scrapeKBid } from '@/services/kbidScraper';
import { RawKBidItem } from '@/lib/types';

export const maxDuration = 60; // Scraping is fast, 60s is plenty
export const dynamic = 'force-dynamic';

interface ScrapeRequest {
  max_items: number;
  start_date: string;
  end_date: string;
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
    // Default to today through 7 days from now
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = params.start_date || defaultStart;
    const endDate = params.end_date || defaultEnd;

    console.log(`Scraping up to ${maxItems} items from auctions closing between ${startDate} and ${endDate}...`);

    const rawItems = await scrapeKBid(maxItems, startDate, endDate);

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
