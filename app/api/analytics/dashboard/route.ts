import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export interface DashboardStats {
  totalAnalyzed: number;
  totalProfitable: number;
  totalOverbid: number;
  avgOverpayPercent: number;
  totalPotentialProfit: number;
  recentActivity: RecentActivityItem[];
  categoryPerformance: CategoryPerformance[];
}

export interface RecentActivityItem {
  id: string;
  title: string;
  category: string;
  current_bid: number;
  estimated_value: number;
  actual_profit: number;
  is_overbid: boolean;
  is_profitable: boolean;
  created_at: string;
  auction_url: string;
}

export interface CategoryPerformance {
  category: string;
  total_analyzed: number;
  total_profitable: number;
  total_overbid: number;
  avg_overpay_percent: number;
  avg_profit: number;
  opportunity_score: number;
}

export async function GET() {
  try {
    // Get aggregate stats
    const { data: allAuctions, error: auctionsError } = await supabase
      .from('analyzed_auctions')
      .select('actual_profit, is_overbid, is_profitable, overpay_percent');

    if (auctionsError) {
      console.error('Error fetching auctions:', auctionsError);
    }

    const auctions = allAuctions || [];
    const totalAnalyzed = auctions.length;
    const profitableItems = auctions.filter(a => a.is_profitable);
    const overbidItems = auctions.filter(a => a.is_overbid);

    const totalProfitable = profitableItems.length;
    const totalOverbid = overbidItems.length;

    const avgOverpayPercent = overbidItems.length > 0
      ? overbidItems.reduce((sum, a) => sum + (a.overpay_percent || 0), 0) / overbidItems.length
      : 0;

    const totalPotentialProfit = profitableItems.reduce((sum, a) => sum + (a.actual_profit || 0), 0);

    // Get recent activity (last 10 items)
    const { data: recentData, error: recentError } = await supabase
      .from('analyzed_auctions')
      .select('id, title, category, current_bid, estimated_value, actual_profit, is_overbid, is_profitable, created_at, auction_url')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error fetching recent activity:', recentError);
    }

    const recentActivity: RecentActivityItem[] = (recentData || []).map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      current_bid: item.current_bid,
      estimated_value: item.estimated_value,
      actual_profit: item.actual_profit,
      is_overbid: item.is_overbid,
      is_profitable: item.is_profitable,
      created_at: item.created_at,
      auction_url: item.auction_url,
    }));

    // Get category performance
    const { data: categoryData, error: categoryError } = await supabase
      .from('category_stats')
      .select('*')
      .order('opportunity_score', { ascending: false });

    if (categoryError) {
      console.error('Error fetching category stats:', categoryError);
    }

    const categoryPerformance: CategoryPerformance[] = (categoryData || []).map(cat => ({
      category: cat.category,
      total_analyzed: cat.total_analyzed,
      total_profitable: cat.total_profitable,
      total_overbid: cat.total_overbid,
      avg_overpay_percent: cat.avg_overpay_percent,
      avg_profit: cat.avg_profit,
      opportunity_score: cat.opportunity_score,
    }));

    const stats: DashboardStats = {
      totalAnalyzed,
      totalProfitable,
      totalOverbid,
      avgOverpayPercent,
      totalPotentialProfit,
      recentActivity,
      categoryPerformance,
    };

    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
