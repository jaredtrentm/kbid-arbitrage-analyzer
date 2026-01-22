import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface MarkWonRequest {
  auction_id: string;
  user_won: boolean;
  user_bid_amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { auction_id, user_won, user_bid_amount }: MarkWonRequest = await request.json();

    if (!auction_id) {
      return NextResponse.json({ success: false, error: 'Missing auction_id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      user_won,
    };

    if (user_bid_amount !== undefined) {
      updateData.user_bid_amount = user_bid_amount;
    }

    const { error } = await supabase
      .from('analyzed_auctions')
      .update(updateData)
      .eq('id', auction_id);

    if (error) {
      console.error('Failed to mark auction:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Mark won error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update auction' }, { status: 500 });
  }
}

// Get user's won auctions
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('analyzed_auctions')
      .select('*')
      .eq('user_won', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch won auctions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, items: data || [] });

  } catch (error) {
    console.error('Get won auctions error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch won auctions' }, { status: 500 });
  }
}
