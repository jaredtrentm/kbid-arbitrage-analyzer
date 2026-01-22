import Anthropic from '@anthropic-ai/sdk';
import { supabase, MarketInsight } from '@/lib/supabase';

const anthropic = new Anthropic();

interface MarketData {
  totalAnalyzed: number;
  totalProfitable: number;
  totalOverbid: number;
  avgOverpayPercent: number;
  categoryStats: {
    category: string;
    total_analyzed: number;
    total_profitable: number;
    total_overbid: number;
    avg_profit: number;
    opportunity_score: number;
  }[];
  recentTrends: {
    category: string;
    trend: 'up' | 'down' | 'stable';
    change: number;
  }[];
}

interface GeneratedInsight {
  title: string;
  description: string;
  insight_type: 'trend' | 'alert' | 'recommendation' | 'pattern';
  severity: 'info' | 'warning' | 'opportunity' | 'critical';
  category?: string;
  confidence: number;
}

export async function generateMarketInsights(forceRefresh = false): Promise<MarketInsight[]> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedInsights();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // Gather market data
  const marketData = await gatherMarketData();

  if (marketData.totalAnalyzed < 5) {
    return [{
      id: 'placeholder',
      created_at: new Date().toISOString(),
      insight_type: 'recommendation',
      title: 'Building Market Intelligence',
      description: 'Continue analyzing auctions to generate AI-powered insights. We need at least 5 analyzed items.',
      severity: 'info',
      is_active: true,
    }];
  }

  // Generate new insights with AI
  const insights = await callAIForInsights(marketData);

  // Store in database
  await storeInsights(insights);

  return insights;
}

async function getCachedInsights(): Promise<MarketInsight[] | null> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('market_insights')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return null;
  }

  return data;
}

async function gatherMarketData(): Promise<MarketData> {
  // Get aggregate stats
  const { data: auctions } = await supabase
    .from('analyzed_auctions')
    .select('actual_profit, is_overbid, is_profitable, overpay_percent, category, created_at');

  const auctionList = auctions || [];
  const totalAnalyzed = auctionList.length;
  const totalProfitable = auctionList.filter(a => a.is_profitable).length;
  const totalOverbid = auctionList.filter(a => a.is_overbid).length;
  const overbidItems = auctionList.filter(a => a.is_overbid);
  const avgOverpayPercent = overbidItems.length > 0
    ? overbidItems.reduce((sum, a) => sum + (a.overpay_percent || 0), 0) / overbidItems.length
    : 0;

  // Get category stats
  const { data: categoryData } = await supabase
    .from('category_stats')
    .select('category, total_analyzed, total_profitable, total_overbid, avg_profit, opportunity_score')
    .order('opportunity_score', { ascending: false })
    .limit(10);

  const categoryStats = categoryData || [];

  // Calculate recent trends (last 7 days vs previous 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentAuctions = auctionList.filter(a => new Date(a.created_at) >= sevenDaysAgo);
  const previousAuctions = auctionList.filter(a => {
    const date = new Date(a.created_at);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  // Group by category for trend analysis
  const recentByCategory = groupByCategory(recentAuctions);
  const previousByCategory = groupByCategory(previousAuctions);

  const recentTrends: MarketData['recentTrends'] = [];
  for (const category of Object.keys(recentByCategory)) {
    const recentCount = recentByCategory[category]?.length || 0;
    const previousCount = previousByCategory[category]?.length || 0;

    if (previousCount === 0) {
      recentTrends.push({ category, trend: 'up', change: 100 });
    } else {
      const change = ((recentCount - previousCount) / previousCount) * 100;
      recentTrends.push({
        category,
        trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
        change: Math.round(change),
      });
    }
  }

  return {
    totalAnalyzed,
    totalProfitable,
    totalOverbid,
    avgOverpayPercent,
    categoryStats,
    recentTrends,
  };
}

function groupByCategory(items: { category: string }[]): Record<string, typeof items> {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
}

async function callAIForInsights(data: MarketData): Promise<MarketInsight[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze this K-BID auction market data and provide 3-5 actionable insights for a reseller.

MARKET OVERVIEW:
- Total auctions analyzed: ${data.totalAnalyzed}
- Profitable opportunities found: ${data.totalProfitable} (${((data.totalProfitable / data.totalAnalyzed) * 100).toFixed(1)}%)
- Overbid auctions: ${data.totalOverbid} (${((data.totalOverbid / data.totalAnalyzed) * 100).toFixed(1)}%)
- Average overpay when overbidding: ${data.avgOverpayPercent.toFixed(1)}%

TOP CATEGORIES BY OPPORTUNITY:
${data.categoryStats.slice(0, 5).map(c =>
  `- ${c.category}: ${c.total_analyzed} analyzed, ${c.total_profitable} profitable, avg profit $${c.avg_profit.toFixed(0)}, score ${c.opportunity_score.toFixed(0)}`
).join('\n')}

RECENT TRENDS (7-day change):
${data.recentTrends.slice(0, 5).map(t =>
  `- ${t.category}: ${t.trend} (${t.change > 0 ? '+' : ''}${t.change}%)`
).join('\n')}

Return ONLY valid JSON array with 3-5 insights:
[
  {
    "title": "Short insight title",
    "description": "2-3 sentence actionable insight",
    "insight_type": "trend|alert|recommendation|pattern",
    "severity": "info|warning|opportunity|critical",
    "category": "category name or null if general",
    "confidence": 0.0-1.0
  }
]

Focus on:
- Hot categories to target
- Categories to avoid
- Timing/seasonal patterns
- Pricing strategies
- Risk alerts`
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

    const parsed: GeneratedInsight[] = JSON.parse(jsonStr);
    const now = new Date().toISOString();

    return parsed.map((insight, index) => ({
      id: `insight-${Date.now()}-${index}`,
      created_at: now,
      insight_type: insight.insight_type,
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      category: insight.category,
      confidence: insight.confidence,
      is_active: true,
    }));

  } catch (error) {
    console.error('AI insight generation error:', error);
    return [{
      id: 'error-fallback',
      created_at: new Date().toISOString(),
      insight_type: 'alert',
      title: 'Analysis in Progress',
      description: 'Unable to generate insights at this time. Please try again later.',
      severity: 'info',
      is_active: true,
    }];
  }
}

async function storeInsights(insights: MarketInsight[]): Promise<void> {
  // Deactivate old insights
  await supabase
    .from('market_insights')
    .update({ is_active: false })
    .eq('is_active', true);

  // Insert new insights (skip placeholder/error ones)
  const toInsert = insights
    .filter(i => !i.id.startsWith('placeholder') && !i.id.startsWith('error'))
    .map(i => ({
      insight_type: i.insight_type,
      title: i.title,
      description: i.description,
      severity: i.severity,
      category: i.category,
      confidence: i.confidence,
      is_active: true,
    }));

  if (toInsert.length > 0) {
    await supabase.from('market_insights').insert(toInsert);
  }
}
