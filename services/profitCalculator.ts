import { ParsedItem, ValuationResult, ProfitAnalysis, AnalysisParams } from '@/lib/types';

const SHIPPING_ESTIMATES: Record<string, number> = {
  small: 8,
  medium: 15,
  large: 35,
  oversized: 75
};

export function calculateProfit(
  item: ParsedItem,
  valuation: ValuationResult,
  params: AnalysisParams
): ProfitAnalysis {
  const estimatedValue = valuation.estimatedValue;
  const shippingEstimate = SHIPPING_ESTIMATES[item.sizeClass] || 15;
  const feeRate = params.selling_fee_percent / 100;

  // Calculate fees on the sale price
  const fees = estimatedValue * feeRate;

  // Net proceeds after fees and shipping
  const netProceeds = estimatedValue - fees - shippingEstimate;

  // Calculate max bid to meet profit requirements
  // Profit = NetProceeds - BuyPrice
  // ROI = Profit / BuyPrice * 100

  // For minimum dollar profit: maxBid = netProceeds - profit_min_dollars
  const maxBidForDollarProfit = netProceeds - params.profit_min_dollars;

  // For minimum ROI: ROI = (netProceeds - maxBid) / maxBid * 100
  // Solving for maxBid: maxBid = netProceeds / (1 + ROI/100)
  const maxBidForROI = netProceeds / (1 + params.profit_min_percent / 100);

  // Take the lower of the two to satisfy both requirements
  const maxBid = Math.max(0, Math.min(maxBidForDollarProfit, maxBidForROI));

  // Calculate expected profit and ROI at max bid (target metrics)
  const expectedProfit = netProceeds - maxBid;
  const expectedROI = maxBid > 0 ? (expectedProfit / maxBid) * 100 : 0;

  // Calculate actual profit and ROI at current bid
  const actualProfit = netProceeds - item.currentBid;
  const actualROI = item.currentBid > 0 ? (actualProfit / item.currentBid) * 100 : 0;

  // Break-even price (where profit = 0)
  const breakEvenPrice = netProceeds;

  return {
    maxBid: Math.round(maxBid * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    expectedROI: Math.round(expectedROI * 100) / 100,
    actualProfit: Math.round(actualProfit * 100) / 100,
    actualROI: Math.round(actualROI * 100) / 100,
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    shippingEstimate,
    fees: Math.round(fees * 100) / 100
  };
}
