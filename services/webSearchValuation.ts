import Anthropic from '@anthropic-ai/sdk';
import { ParsedItem, ValuationResult } from '@/lib/types';

const anthropic = new Anthropic();

interface SerperResult {
  organic?: Array<{
    title: string;
    snippet: string;
    link: string;
  }>;
}

async function searchSerper(query: string): Promise<SerperResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not configured');
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: query,
      num: 10
    })
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  return response.json();
}

export async function getValuation(item: ParsedItem): Promise<ValuationResult> {
  try {
    // Search for sold prices and current listings
    const searchQueries = [
      `${item.title} sold price`,
      `${item.title} for sale`,
      `${item.title} worth value`
    ];

    const searchResults: string[] = [];

    for (const query of searchQueries) {
      try {
        const result = await searchSerper(query);
        if (result.organic) {
          for (const r of result.organic.slice(0, 5)) {
            searchResults.push(`Source: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}`);
          }
        }
      } catch (e) {
        console.error(`Search failed for query: ${query}`, e);
      }
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (searchResults.length === 0) {
      return {
        estimatedValue: 0,
        lowEstimate: 0,
        highEstimate: 0,
        confidence: 'low',
        sources: [],
        reasoning: 'No search results found for this item'
      };
    }

    // Send to Claude for analysis
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze these search results to estimate the resale value of this item.

ITEM: ${item.title}
CATEGORY: ${item.category}
CONDITION: ${item.condition}

SEARCH RESULTS:
${searchResults.join('\n\n---\n\n')}

Based on the search results, estimate the resale value. Return ONLY valid JSON:
{
  "estimatedValue": 0,
  "lowEstimate": 0,
  "highEstimate": 0,
  "confidence": "low/medium/high",
  "sources": ["source1", "source2"],
  "reasoning": "brief explanation of how you determined the value"
}

Rules:
- Use USD values
- estimatedValue should be the most likely selling price
- lowEstimate and highEstimate define a realistic range
- confidence: high if multiple consistent prices found, medium if some data, low if uncertain
- List the most relevant sources used
- If no clear pricing data, set estimatedValue to 0 and confidence to "low"`
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

    const parsed = JSON.parse(jsonStr);

    return {
      estimatedValue: parsed.estimatedValue || 0,
      lowEstimate: parsed.lowEstimate || 0,
      highEstimate: parsed.highEstimate || 0,
      confidence: parsed.confidence || 'low',
      sources: parsed.sources || [],
      reasoning: parsed.reasoning || 'Unable to determine value'
    };

  } catch (error) {
    console.error('Valuation error:', error);
    return {
      estimatedValue: 0,
      lowEstimate: 0,
      highEstimate: 0,
      confidence: 'low',
      sources: [],
      reasoning: `Valuation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
