import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// User profile type (from users table)
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  territory_zip?: string;
  territory_radius_miles: number;
  territory_lat?: number;
  territory_lng?: number;
  territory_name?: string;
  is_active: boolean;
  license_type: 'basic' | 'pro' | 'exclusive';
  license_expires_at?: string;
  categories_allowed: string[];
  max_items_per_search: number;
  created_at: string;
  updated_at: string;
}

// For admin creating/updating users
export interface UserProfileUpdate {
  full_name?: string;
  territory_zip?: string;
  territory_radius_miles?: number;
  territory_lat?: number;
  territory_lng?: number;
  territory_name?: string;
  is_active?: boolean;
  license_type?: 'basic' | 'pro' | 'exclusive';
  license_expires_at?: string;
  categories_allowed?: string[];
  max_items_per_search?: number;
}

// Auth helper functions
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  return data;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

// Admin functions
export async function inviteUser(email: string, profile: UserProfileUpdate) {
  // First, invite via Supabase Auth (sends email with magic link)
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

  if (error) {
    // If admin invite fails, try regular signup with random password
    // User will need to reset password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const signupResult = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: { full_name: profile.full_name }
      }
    });

    if (signupResult.error) {
      throw signupResult.error;
    }

    // Update user profile with territory settings
    if (signupResult.data.user) {
      await updateUserProfile(signupResult.data.user.id, profile);
    }

    return signupResult;
  }

  // Update user profile with territory settings
  if (data.user) {
    await updateUserProfile(data.user.id, profile);
  }

  return { data, error: null };
}

export async function updateUserProfile(userId: string, updates: UserProfileUpdate) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
}

export async function deleteUser(userId: string) {
  // This will cascade delete due to FK constraint
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) throw error;
}

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
