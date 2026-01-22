import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Clear analyzed auctions
    const { error: auctionsError } = await supabase
      .from('analyzed_auctions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (auctionsError) {
      console.error('Error clearing analyzed_auctions:', auctionsError);
    }

    // Clear category stats
    const { error: statsError } = await supabase
      .from('category_stats')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (statsError) {
      console.error('Error clearing category_stats:', statsError);
    }

    // Clear market insights
    const { error: insightsError } = await supabase
      .from('market_insights')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (insightsError) {
      console.error('Error clearing market_insights:', insightsError);
    }

    return NextResponse.json({
      success: true,
      message: 'All analyzed data cleared successfully'
    });

  } catch (error) {
    console.error('Clear data error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear data' },
      { status: 500 }
    );
  }
}
