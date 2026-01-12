export interface AnalysisParams {
  profit_min_dollars: number;
  profit_min_percent: number;
  selling_fee_percent: number;
  max_items: number;
}

export interface RawKBidItem {
  text: string;
  url: string;
  imageUrl?: string;
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
  excluded: boolean;
  excludeReason?: string;
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
