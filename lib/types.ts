export interface AnalysisParams {
  profit_min_dollars: number;
  profit_min_percent: number;
  selling_fee_percent: number;
  max_items: number;
  start_date: string; // ISO date string (YYYY-MM-DD)
  end_date: string;   // ISO date string (YYYY-MM-DD)
  single_auction_url?: string; // Optional: scrape a specific auction by URL
  selected_categories?: string[]; // Optional: filter by these categories
}

export interface RawKBidItem {
  text: string;
  url: string;
  imageUrl?: string;
  auctionEndDate?: string;
  currentBid?: number; // Pre-extracted bid price from scraper
  bidCount?: number;   // Number of bids placed
  bidderCount?: number; // Number of unique bidders
}

export interface ParsedItem {
  id: string;
  title: string;
  description: string;
  currentBid: number;
  category: string;
  condition: string;
  sizeClass: 'small' | 'medium' | 'large' | 'oversized';
  auctionUrl: string;
  imageUrl?: string;
  shippingAvailable: boolean;
  excluded: boolean;
  excludeReason?: string;
  auctionEndDate?: string;
  bidCount?: number;
  bidderCount?: number;
  interestLevel?: 'low' | 'medium' | 'high';
}

export interface ValuationResult {
  estimatedValue: number;
  lowEstimate: number;
  highEstimate: number;
  confidence: 'low' | 'medium' | 'high';
  sources: string[];
  reasoning: string;
}

export interface ProfitAnalysis {
  maxBid: number;
  expectedProfit: number;
  expectedROI: number;
  breakEvenPrice: number;
  shippingEstimate: number;
  fees: number;
}

export interface ResaleAdvice {
  recommendedChannel: string;
  riskScore: 'low' | 'medium' | 'high';
  riskReasoning: string;
  tips: string[];
}

export interface AnalyzedItem {
  item: ParsedItem;
  valuation: ValuationResult;
  profit: ProfitAnalysis;
  resale: ResaleAdvice;
  meetsCriteria: boolean;
}

export interface AnalysisResponse {
  success: boolean;
  items: AnalyzedItem[];
  summary: {
    totalScraped: number;
    totalAnalyzed: number;
    totalProfitable: number;
    errors: number;
  };
  error?: string;
}
