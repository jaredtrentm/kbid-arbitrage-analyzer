import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing auction ID' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('analyzed_auctions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting auction:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete auction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete auction' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('analyzed_auctions')
      .select('id, title, category, current_bid, estimated_value, overpay_amount, overpay_percent, bid_count, bidder_count, interest_level, auction_url, image_url, created_at, auction_end_date')
      .eq('is_overbid', true)
      .gt('overpay_amount', 0)
      .gt('overpay_percent', 0)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching overbids:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch overbid items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, items: data || [] });

  } catch (error) {
    console.error('Overbids error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load overbids' },
      { status: 500 }
    );
  }
}
