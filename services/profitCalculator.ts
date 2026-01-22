import { ParsedItem, ValuationResult, ProfitAnalysis, AnalysisParams } from '@/lib/types';

const SHIPPING_ESTIMATES: Record<string, number> = {
  small: 8,
  medium: 15,
  large: 35,
  oversized: 75
};

// K-Bid buyer's premium (typically 10%, some auctions 13%)
const KBID_BUYER_PREMIUM_RATE = 0.10;

export function calculateProfit(
  item: ParsedItem,
  valuation: ValuationResult,
  params: AnalysisParams
): ProfitAnalysis {
  const estimatedValue = valuation.estimatedValue;
  const shippingEstimate = SHIPPING_ESTIMATES[item.sizeClass] || 15;
  const sellingFeeRate = params.selling_fee_percent / 100;

  // Calculate selling fees on the sale price
  const sellingFees = estimatedValue * sellingFeeRate;

  // Net proceeds after selling fees and shipping
  const netProceeds = estimatedValue - sellingFees - shippingEstimate;

  // Calculate total acquisition cost including K-Bid buyer's premium
  // Total cost = bid + (bid * buyer_premium_rate)
  const buyerPremiumMultiplier = 1 + KBID_BUYER_PREMIUM_RATE;

  // Calculate max bid to meet profit requirements
  // Profit = NetProceeds - TotalCost = NetProceeds - (Bid * buyerPremiumMultiplier)
  // ROI = Profit / TotalCost * 100

  // For minimum dollar profit:
  // profit_min = netProceeds - (maxBid * multiplier)
  // maxBid = (netProceeds - profit_min) / multiplier
  const maxBidForDollarProfit = (netProceeds - params.profit_min_dollars) / buyerPremiumMultiplier;

  // For minimum ROI:
  // ROI = (netProceeds - (maxBid * multiplier)) / (maxBid * multiplier) * 100
  // Solving: maxBid = netProceeds / (multiplier * (1 + ROI/100))
  const maxBidForROI = netProceeds / (buyerPremiumMultiplier * (1 + params.profit_min_percent / 100));

  // Take the lower of the two to satisfy both requirements
  const maxBid = Math.max(0, Math.min(maxBidForDollarProfit, maxBidForROI));

  // Calculate total cost at max bid (including buyer's premium)
  const maxBidTotalCost = maxBid * buyerPremiumMultiplier;

  // Calculate expected profit and ROI at max bid (target metrics)
  const expectedProfit = netProceeds - maxBidTotalCost;
  const expectedROI = maxBidTotalCost > 0 ? (expectedProfit / maxBidTotalCost) * 100 : 0;

  // Calculate actual total cost at current bid (including buyer's premium)
  const actualTotalCost = item.currentBid * buyerPremiumMultiplier;

  // Calculate actual profit and ROI at current bid
  const actualProfit = netProceeds - actualTotalCost;
  const actualROI = actualTotalCost > 0 ? (actualProfit / actualTotalCost) * 100 : 0;

  // Break-even bid (where profit = 0, accounting for buyer's premium)
  const breakEvenPrice = netProceeds / buyerPremiumMultiplier;

  // Total fees for display (selling fees only - buyer's premium shown separately)
  const fees = sellingFees;

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
