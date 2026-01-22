import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase, WatchlistItem } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DisplayedResult {
  title: string;
  category: string;
  currentBid: number;
  maxBid: number;
  estimatedValue: number;
  expectedProfit: number;
  expectedROI: number;
  riskScore: string;
  channel: string;
  confidence: string;
}

interface ChatRequest {
  message: string;
  includeWatchlist?: boolean;
  displayedResults?: DisplayedResult[];
}

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const { message, includeWatchlist = true, displayedResults = [] }: ChatRequest = await request.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Build displayed results context
    let displayedContext = '';
    if (displayedResults && displayedResults.length > 0) {
      const resultsSummary = displayedResults.map((item, i) => {
        return `${i + 1}. "${item.title}"
   - Category: ${item.category} | Confidence: ${item.confidence}
   - Current Bid: $${item.currentBid} | Max Bid: $${item.maxBid} | Est. Value: $${item.estimatedValue}
   - Expected Profit: $${item.expectedProfit.toFixed(0)} | ROI: ${item.expectedROI.toFixed(0)}%
   - Risk: ${item.riskScore} | Best Channel: ${item.channel}`;
      }).join('\n\n');

      const totalProfit = displayedResults.reduce((sum, i) => sum + i.expectedProfit, 0);
      const avgROI = displayedResults.reduce((sum, i) => sum + i.expectedROI, 0) / displayedResults.length;
      const lowRisk = displayedResults.filter(i => i.riskScore === 'low').length;

      displayedContext = `
## Currently Displayed Results (${displayedResults.length} items, $${totalProfit.toFixed(0)} total potential profit, ${avgROI.toFixed(0)}% avg ROI, ${lowRisk} low-risk)

${resultsSummary}
`;
    }

    // Fetch watchlist data if needed
    let watchlistContext = '';
    if (includeWatchlist) {
      const { data: items } = await supabase
        .from('watchlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (items && items.length > 0) {
        const watchlistSummary = (items as WatchlistItem[]).map((item, i) => {
          const flagged = item.current_bid > item.max_bid;
          return `${i + 1}. "${item.title}"
   - Category: ${item.category}
   - Current Bid: $${item.current_bid} | Max Bid: $${item.max_bid} | Est. Value: $${item.estimated_value}
   - Expected Profit: $${item.expected_profit} | ROI: ${item.expected_roi}%
   - Risk: ${item.risk_score} | Channel: ${item.recommended_channel}
   - Status: ${flagged ? 'FLAGGED (bid exceeded max)' : 'Active'}`;
        }).join('\n\n');

        const totalItems = items.length;
        const flaggedItems = items.filter((i: WatchlistItem) => i.current_bid > i.max_bid).length;
        const totalPotentialProfit = items
          .filter((i: WatchlistItem) => i.current_bid <= i.max_bid)
          .reduce((sum: number, i: WatchlistItem) => sum + i.expected_profit, 0);

        watchlistContext = `
## User's Watchlist (${totalItems} items, ${flaggedItems} flagged, $${totalPotentialProfit.toFixed(0)} potential profit)

${watchlistSummary}
`;
      } else {
        watchlistContext = '\n## User\'s Watchlist\nNo items currently saved.\n';
      }
    }

    // Fetch analyzed auctions data (overbids and profitable items)
    let analyzedContext = '';
    const { data: overbidItems } = await supabase
      .from('analyzed_auctions')
      .select('title, category, current_bid, estimated_value, max_bid, overpay_percent, overpay_amount, auction_url')
      .eq('is_overbid', true)
      .order('overpay_percent', { ascending: false })
      .limit(20);

    const { data: profitableItems } = await supabase
      .from('analyzed_auctions')
      .select('title, category, current_bid, estimated_value, actual_profit, actual_roi, auction_url')
      .eq('is_profitable', true)
      .order('actual_profit', { ascending: false })
      .limit(20);

    if ((overbidItems && overbidItems.length > 0) || (profitableItems && profitableItems.length > 0)) {
      let overbidSummary = '';
      if (overbidItems && overbidItems.length > 0) {
        overbidSummary = `### Overbid Items (${overbidItems.length} items where bidders are overpaying)\n` +
          overbidItems.map((item, i) =>
            `${i + 1}. "${item.title}" (${item.category})
   - Current Bid: $${item.current_bid} | Est. Value: $${item.estimated_value} | Max Bid: $${item.max_bid}
   - Overpaying by: ${item.overpay_percent?.toFixed(0) || 0}% ($${item.overpay_amount?.toFixed(0) || 0})`
          ).join('\n\n');
      }

      let profitableSummary = '';
      if (profitableItems && profitableItems.length > 0) {
        profitableSummary = `### Profitable Opportunities (${profitableItems.length} items with profit potential)\n` +
          profitableItems.map((item, i) =>
            `${i + 1}. "${item.title}" (${item.category})
   - Current Bid: $${item.current_bid} | Est. Value: $${item.estimated_value}
   - Potential Profit: $${item.actual_profit?.toFixed(0) || 0} (${item.actual_roi?.toFixed(0) || 0}% ROI)`
          ).join('\n\n');
      }

      analyzedContext = `
## Analyzed Auctions Database

${overbidSummary}

${profitableSummary}
`;
    }

    const anthropic = new Anthropic();

    const systemPrompt = `You are an expert auction arbitrage advisor for K-Bid auctions. You help users find profitable items to resell.

Your capabilities:
1. Answer questions about currently displayed search results (if provided)
2. Answer questions about items in the user's saved watchlist (if provided)
3. Answer questions about analyzed auctions - including overbid items and profitable opportunities from the database
4. Provide general advice on auction arbitrage, reselling, shipping, pricing, and market trends
5. Help analyze potential deals and identify risks
6. Suggest resale channels (eBay, Amazon, Facebook Marketplace, etc.)
7. Provide tips on shipping costs, packaging, and logistics

Key terms:
- Max Bid: The highest amount the user should bid while maintaining their profit/ROI requirements
- Flagged items: Items where the current bid has exceeded the user's max bid
- ROI: Return on Investment percentage
- Risk Score: Assessment of how easy/risky an item is to resell (low/medium/high)
- Confidence: How confident the AI is in the valuation estimate

Be concise but helpful. Use bullet points for lists. When discussing specific items, reference them by name. If comparing items, create a clear ranking or table.
${displayedContext}${watchlistContext}${analyzedContext}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent ? textContent.text : 'No response generated';

    return NextResponse.json({
      success: true,
      response: responseText
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
