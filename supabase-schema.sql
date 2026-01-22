-- Supabase Schema for K-Bid Arbitrage Analyzer
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- SETUP INSTRUCTIONS
-- ============================================
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Enable Email Auth in Authentication > Providers
-- 3. Create your admin account:
--    a. Go to Authentication > Users > Add user
--    b. Create user with your email (e.g., jaredtrentm@gmail.com)
--    c. Set a password
--    d. After creating, run this SQL to make them admin:
--
--       UPDATE public.users
--       SET role = 'admin'
--       WHERE email = 'jaredtrentm@gmail.com';
--
-- 4. Configure Site URL in Authentication > URL Configuration
-- 5. Add Supabase keys to .env.local:
--    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
-- ============================================

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- Stores user profile, role, and territory settings
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Profile
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,

  -- Role
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),

  -- Territory settings
  territory_zip TEXT,  -- Center point zip code
  territory_radius_miles INTEGER DEFAULT 50,  -- Radius in miles
  territory_lat DECIMAL(10,7),  -- Latitude (auto-populated from zip)
  territory_lng DECIMAL(10,7),  -- Longitude (auto-populated from zip)
  territory_name TEXT,  -- Friendly name like "Minneapolis Metro"

  -- License/subscription
  is_active BOOLEAN DEFAULT TRUE,
  license_type TEXT DEFAULT 'basic' CHECK (license_type IN ('basic', 'pro', 'exclusive')),
  license_expires_at TIMESTAMPTZ,

  -- Settings
  categories_allowed JSONB DEFAULT '[]'::JSONB,  -- Empty = all categories
  max_items_per_search INTEGER DEFAULT 100
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (but not role/territory)
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can do everything
CREATE POLICY "Admins have full access" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ZIP CODE COORDINATES (for distance calculations)
-- You can populate this with a zip code database
-- ============================================
CREATE TABLE IF NOT EXISTS zip_coordinates (
  zip TEXT PRIMARY KEY,
  city TEXT,
  state TEXT,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zip_state ON zip_coordinates(state);

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_miles(
  lat1 DECIMAL, lng1 DECIMAL,
  lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  r DECIMAL := 3959; -- Earth radius in miles
  dlat DECIMAL;
  dlng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  a := SIN(dlat/2)^2 + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2)^2;
  c := 2 * ASIN(SQRT(a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- WATCHLIST TABLE
-- ============================================

-- Create the watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Item details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  condition TEXT,
  size_class TEXT,
  auction_url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  auction_end_date TEXT,

  -- Pricing
  saved_bid DECIMAL(10,2) NOT NULL,  -- Bid when item was saved
  current_bid DECIMAL(10,2) NOT NULL, -- Latest bid (updated on refresh)

  -- Analysis results
  max_bid DECIMAL(10,2) NOT NULL,
  estimated_value DECIMAL(10,2) NOT NULL,
  expected_profit DECIMAL(10,2) NOT NULL,
  expected_roi DECIMAL(10,2) NOT NULL,
  break_even_price DECIMAL(10,2) NOT NULL,
  shipping_estimate DECIMAL(10,2) NOT NULL,
  fees DECIMAL(10,2) NOT NULL,

  -- Valuation
  valuation_low DECIMAL(10,2),
  valuation_high DECIMAL(10,2),
  valuation_confidence TEXT,
  valuation_reasoning TEXT,

  -- Resale advice
  recommended_channel TEXT,
  risk_score TEXT,
  risk_reasoning TEXT,
  resale_tips JSONB DEFAULT '[]'::JSONB,

  -- User params at time of save (for recalculation reference)
  profit_min_dollars DECIMAL(10,2),
  profit_min_percent DECIMAL(10,2),
  selling_fee_percent DECIMAL(10,2)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_auction_url ON watchlist(auction_url);
CREATE INDEX IF NOT EXISTS idx_watchlist_created_at ON watchlist(created_at DESC);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_watchlist_updated_at ON watchlist;
CREATE TRIGGER update_watchlist_updated_at
  BEFORE UPDATE ON watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for multi-user setup
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own watchlist items
CREATE POLICY "Users can view own watchlist" ON watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON watchlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can see all watchlist items
CREATE POLICY "Admins can view all watchlist" ON watchlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- ANALYZED AUCTIONS TABLE
-- Logs ALL analyzed auctions (good and bad deals) for market intelligence
-- ============================================
CREATE TABLE IF NOT EXISTS analyzed_auctions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Item details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  condition TEXT,
  size_class TEXT,
  auction_url TEXT NOT NULL,
  image_url TEXT,
  auction_end_date TEXT,

  -- Bid activity
  bid_count INTEGER DEFAULT 0,
  bidder_count INTEGER DEFAULT 0,
  interest_level TEXT, -- 'low', 'medium', 'high'

  -- Pricing at time of analysis
  current_bid DECIMAL(10,2) NOT NULL,
  estimated_value DECIMAL(10,2) NOT NULL,
  max_bid DECIMAL(10,2) NOT NULL,

  -- Profit analysis
  actual_profit DECIMAL(10,2) NOT NULL,
  actual_roi DECIMAL(10,2) NOT NULL,
  expected_profit DECIMAL(10,2) NOT NULL,
  expected_roi DECIMAL(10,2) NOT NULL,
  break_even_price DECIMAL(10,2),
  shipping_estimate DECIMAL(10,2),
  fees DECIMAL(10,2),

  -- Deal classification
  is_overbid BOOLEAN DEFAULT FALSE,  -- current_bid > max_bid
  is_profitable BOOLEAN DEFAULT FALSE,  -- meets criteria
  overpay_amount DECIMAL(10,2),  -- how much over value (if overbid)
  overpay_percent DECIMAL(10,2),  -- percentage over value (if overbid)
  is_closed BOOLEAN DEFAULT FALSE,  -- auction has ended
  auction_status TEXT DEFAULT 'live',  -- 'live', 'closed', 'sold', 'unsold'

  -- User bidding tracking
  user_won BOOLEAN DEFAULT FALSE,  -- user won this auction
  user_bid_amount DECIMAL(10,2),   -- user's winning bid amount
  actual_sale_price DECIMAL(10,2), -- actual resale price (if sold)
  actual_profit_realized DECIMAL(10,2)  -- actual profit after resale

  -- Risk assessment
  risk_score TEXT,
  risk_reasoning TEXT,
  recommended_channel TEXT,

  -- Valuation details
  valuation_confidence TEXT,
  valuation_reasoning TEXT,
  valuation_low DECIMAL(10,2),
  valuation_high DECIMAL(10,2)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analyzed_created_at ON analyzed_auctions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyzed_category ON analyzed_auctions(category);
CREATE INDEX IF NOT EXISTS idx_analyzed_is_overbid ON analyzed_auctions(is_overbid);
CREATE INDEX IF NOT EXISTS idx_analyzed_is_profitable ON analyzed_auctions(is_profitable);
CREATE INDEX IF NOT EXISTS idx_analyzed_auction_url ON analyzed_auctions(auction_url);

-- ============================================
-- MARKET INSIGHTS TABLE
-- Stores AI-generated insights for the dashboard
-- ============================================
CREATE TABLE IF NOT EXISTS market_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Insight details
  insight_type TEXT NOT NULL,  -- 'trend', 'alert', 'recommendation', 'pattern'
  category TEXT,  -- related category (nullable for general insights)
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'info',  -- 'info', 'warning', 'opportunity', 'critical'

  -- Supporting data
  data_points JSONB DEFAULT '{}'::JSONB,  -- raw data supporting the insight
  confidence DECIMAL(3,2),  -- 0.00 to 1.00

  -- Display control
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ  -- optional expiration
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON market_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_active ON market_insights(is_active);
CREATE INDEX IF NOT EXISTS idx_insights_created ON market_insights(created_at DESC);

-- ============================================
-- CATEGORY STATS TABLE
-- Aggregated stats per category for quick dashboard access
-- ============================================
CREATE TABLE IF NOT EXISTS category_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  category TEXT NOT NULL UNIQUE,
  total_analyzed INTEGER DEFAULT 0,
  total_profitable INTEGER DEFAULT 0,
  total_overbid INTEGER DEFAULT 0,

  avg_overpay_percent DECIMAL(10,2) DEFAULT 0,
  avg_profit DECIMAL(10,2) DEFAULT 0,
  avg_roi DECIMAL(10,2) DEFAULT 0,

  -- Trend indicators (compared to previous period)
  overpay_trend DECIMAL(10,2) DEFAULT 0,  -- positive = increasing overpays
  opportunity_score DECIMAL(10,2) DEFAULT 0  -- higher = better for flipping
);

CREATE INDEX IF NOT EXISTS idx_category_stats_category ON category_stats(category);

-- Trigger to update category_stats updated_at
DROP TRIGGER IF EXISTS update_category_stats_updated_at ON category_stats;
CREATE TRIGGER update_category_stats_updated_at
  BEFORE UPDATE ON category_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
