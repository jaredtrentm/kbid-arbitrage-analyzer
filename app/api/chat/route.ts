import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase, WatchlistItem } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  includeWatchlist?: boolean;
}

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const { message, includeWatchlist = true }: ChatRequest = await request.json();

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

    const anthropic = new Anthropic();

    const systemPrompt = `You are an expert auction arbitrage advisor for K-Bid auctions. You help users find profitable items to resell.

Your capabilities:
1. Answer questions about items in the user's watchlist (if provided)
2. Provide general advice on auction arbitrage, reselling, shipping, pricing, and market trends
3. Help analyze potential deals and identify risks
4. Suggest resale channels (eBay, Amazon, Facebook Marketplace, etc.)
5. Provide tips on shipping costs, packaging, and logistics

Key terms:
- Max Bid: The highest amount the user should bid while maintaining their profit/ROI requirements
- Flagged items: Items where the current bid has exceeded the user's max bid
- ROI: Return on Investment percentage
- Risk Score: Assessment of how easy/risky an item is to resell

Be concise but helpful. Use bullet points for lists. If discussing specific items, reference them by name.
${watchlistContext}`;

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
