import { NextRequest, NextResponse } from 'next/server';
import { supabase, WatchlistItem, WatchlistInsert } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Fetch all watchlist items
export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      items: data as WatchlistItem[]
    });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Add item to watchlist
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const item: WatchlistInsert = await request.json();

    // Check if item already exists (by auction URL)
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('auction_url', item.auction_url)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Item already in watchlist' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('watchlist')
      .insert([item])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data as WatchlistItem
    });
  } catch (error) {
    console.error('Watchlist add error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
