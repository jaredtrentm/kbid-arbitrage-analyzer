import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

const anthropic = new Anthropic();

export interface CategoryDeepDive {
  category: string;
  summary: string;
  whyHotOrCold: string;
  bestItemTypes: string[];
  timingAdvice: string;
  riskFactors: string[];
  recommendation: string;
  stats: {
    totalAnalyzed: number;
    profitableCount: number;
    overbidCount: number;
    avgProfit: number;
    avgOverpay: number;
    opportunityScore: number;
  };
}

export async function getCategoryDeepDive(category: string): Promise<CategoryDeepDive> {
  // Gather category-specific data
  const { data: categoryStats } = await supabase
    .from('category_stats')
    .select('*')
    .eq('category', category)
    .single();

  const { data: recentAuctions } = await supabase
    .from('analyzed_auctions')
    .select('title, current_bid, estimated_value, actual_profit, is_profitable, is_overbid, overpay_percent')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(20);

  const stats = {
    totalAnalyzed: categoryStats?.total_analyzed || 0,
    profitableCount: categoryStats?.total_profitable || 0,
    overbidCount: categoryStats?.total_overbid || 0,
    avgProfit: categoryStats?.avg_profit || 0,
    avgOverpay: categoryStats?.avg_overpay_percent || 0,
    opportunityScore: categoryStats?.opportunity_score || 0,
  };

  // If no data, return basic response
  if (stats.totalAnalyzed < 3) {
    return {
      category,
      summary: `Not enough data to analyze ${category}. Continue analyzing auctions in this category.`,
      whyHotOrCold: 'Insufficient data for trend analysis.',
      bestItemTypes: ['Analyze more items to discover patterns'],
      timingAdvice: 'Collect more data to identify optimal timing.',
      riskFactors: ['Limited data - predictions may be inaccurate'],
      recommendation: 'Continue monitoring this category to build insights.',
      stats,
    };
  }

  // Generate AI analysis
  const analysis = await generateCategoryAnalysis(category, stats, recentAuctions || []);

  return {
    ...analysis,
    category,
    stats,
  };
}

async function generateCategoryAnalysis(
  category: string,
  stats: CategoryDeepDive['stats'],
  recentAuctions: Array<{
    title: string;
    current_bid: number;
    estimated_value: number;
    actual_profit: number;
    is_profitable: boolean;
    is_overbid: boolean;
    overpay_percent: number | null;
  }>
): Promise<Omit<CategoryDeepDive, 'category' | 'stats'>> {
  try {
    const profitRate = stats.totalAnalyzed > 0 ? (stats.profitableCount / stats.totalAnalyzed * 100).toFixed(1) : '0';
    const overbidRate = stats.totalAnalyzed > 0 ? (stats.overbidCount / stats.totalAnalyzed * 100).toFixed(1) : '0';
    const isHot = stats.opportunityScore > 20;

    const sampleItems = recentAuctions.slice(0, 10).map(a =>
      `- "${a.title}" - Bid: $${a.current_bid}, Value: $${a.estimated_value}, ${a.is_profitable ? `Profit: $${a.actual_profit}` : a.is_overbid ? `Overpaid ${a.overpay_percent?.toFixed(0)}%` : 'Neutral'}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Provide a deep-dive analysis for the "${category}" category on K-BID auctions.

CATEGORY STATS:
- Total analyzed: ${stats.totalAnalyzed}
- Profitable: ${stats.profitableCount} (${profitRate}%)
- Overbid: ${stats.overbidCount} (${overbidRate}%)
- Avg profit when profitable: $${stats.avgProfit.toFixed(0)}
- Avg overpay when overbid: ${stats.avgOverpay.toFixed(0)}%
- Opportunity score: ${stats.opportunityScore.toFixed(0)} (${isHot ? 'HOT' : 'COLD'})

RECENT ITEMS:
${sampleItems}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview of this category's potential",
  "whyHotOrCold": "Explanation of why this category is currently ${isHot ? 'hot' : 'cold'} for resellers",
  "bestItemTypes": ["specific item type 1", "specific item type 2", "specific item type 3"],
  "timingAdvice": "When to bid and when to avoid",
  "riskFactors": ["risk 1", "risk 2", "risk 3"],
  "recommendation": "Clear actionable advice for a reseller"
}`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonStr = content.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
    }

    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Category analysis error:', error);
    return {
      summary: `${category} shows mixed results. Review individual items carefully.`,
      whyHotOrCold: 'Unable to generate detailed trend analysis at this time.',
      bestItemTypes: ['Research individual items'],
      timingAdvice: 'Monitor the category for patterns.',
      riskFactors: ['Analysis currently unavailable', 'Use manual research'],
      recommendation: 'Proceed with caution and verify valuations independently.',
    };
  }
}
