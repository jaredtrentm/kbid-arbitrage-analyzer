-- Supabase Schema for K-Bid Arbitrage Analyzer Watchlist
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Create the watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable Row Level Security (optional - for multi-user setup)
-- ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (single user setup)
-- If you want multi-user, add a user_id column and modify this policy
-- CREATE POLICY "Allow all operations" ON watchlist FOR ALL USING (true);
