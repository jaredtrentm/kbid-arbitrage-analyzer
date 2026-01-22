import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface WatchlistItem {
  id: string;
  created_at: string;
  updated_at: string;
  // Item details
  title: string;
  description: string;
  category: string;
  condition: string;
  size_class: string;
  auction_url: string;
  image_url?: string;
  auction_end_date?: string;
  // Pricing at time of save
  saved_bid: number;
  current_bid: number;
  // Analysis results
  max_bid: number;
  estimated_value: number;
  expected_profit: number;
  expected_roi: number;
  break_even_price: number;
  shipping_estimate: number;
  fees: number;
  // Valuation
  valuation_low: number;
  valuation_high: number;
  valuation_confidence: string;
  valuation_reasoning: string;
  // Resale
  recommended_channel: string;
  risk_score: string;
  risk_reasoning: string;
  resale_tips: string[];
  // User params at time of save
  profit_min_dollars: number;
  profit_min_percent: number;
  selling_fee_percent: number;
}

export interface WatchlistInsert {
  title: string;
  description: string;
  category: string;
  condition: string;
  size_class: string;
  auction_url: string;
  image_url?: string;
  auction_end_date?: string;
  saved_bid: number;
  current_bid: number;
  max_bid: number;
  estimated_value: number;
  expected_profit: number;
  expected_roi: number;
  break_even_price: number;
  shipping_estimate: number;
  fees: number;
  valuation_low: number;
  valuation_high: number;
  valuation_confidence: string;
  valuation_reasoning: string;
  recommended_channel: string;
  risk_score: string;
  risk_reasoning: string;
  resale_tips: string[];
  profit_min_dollars: number;
  profit_min_percent: number;
  selling_fee_percent: number;
}

// Analyzed Auctions - logs all analyzed items for market intelligence
export interface AnalyzedAuction {
  id: string;
  created_at: string;
  title: string;
  description?: string;
  category: string;
  condition?: string;
  size_class?: string;
  auction_url: string;
  image_url?: string;
  auction_end_date?: string;
  bid_count: number;
  bidder_count: number;
  interest_level?: string;
  current_bid: number;
  estimated_value: number;
  max_bid: number;
  actual_profit: number;
  actual_roi: number;
  expected_profit: number;
  expected_roi: number;
  break_even_price?: number;
  shipping_estimate?: number;
  fees?: number;
  is_overbid: boolean;
  is_profitable: boolean;
  overpay_amount?: number;
  overpay_percent?: number;
  is_closed: boolean;
  auction_status: 'live' | 'closed' | 'sold' | 'unsold';
  risk_score?: string;
  risk_reasoning?: string;
  recommended_channel?: string;
  valuation_confidence?: string;
  valuation_reasoning?: string;
  valuation_low?: number;
  valuation_high?: number;
}

export interface AnalyzedAuctionInsert {
  title: string;
  description?: string;
  category: string;
  condition?: string;
  size_class?: string;
  auction_url: string;
  image_url?: string;
  auction_end_date?: string;
  bid_count?: number;
  bidder_count?: number;
  interest_level?: string;
  current_bid: number;
  estimated_value: number;
  max_bid: number;
  actual_profit: number;
  actual_roi: number;
  expected_profit: number;
  expected_roi: number;
  break_even_price?: number;
  shipping_estimate?: number;
  fees?: number;
  is_overbid: boolean;
  is_profitable: boolean;
  overpay_amount?: number;
  overpay_percent?: number;
  is_closed?: boolean;
  auction_status?: 'live' | 'closed' | 'sold' | 'unsold';
  risk_score?: string;
  risk_reasoning?: string;
  recommended_channel?: string;
  valuation_confidence?: string;
  valuation_reasoning?: string;
  valuation_low?: number;
  valuation_high?: number;
}

// Market Insights - AI-generated insights
export interface MarketInsight {
  id: string;
  created_at: string;
  insight_type: 'trend' | 'alert' | 'recommendation' | 'pattern';
  category?: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'opportunity' | 'critical';
  data_points?: Record<string, unknown>;
  confidence?: number;
  is_active: boolean;
  expires_at?: string;
}

// Category Stats - aggregated stats for dashboard
export interface CategoryStats {
  id: string;
  updated_at: string;
  category: string;
  total_analyzed: number;
  total_profitable: number;
  total_overbid: number;
  avg_overpay_percent: number;
  avg_profit: number;
  avg_roi: number;
  overpay_trend: number;
  opportunity_score: number;
}
