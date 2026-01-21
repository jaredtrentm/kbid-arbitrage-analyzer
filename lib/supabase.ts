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
