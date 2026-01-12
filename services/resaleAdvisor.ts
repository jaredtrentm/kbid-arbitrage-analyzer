import Anthropic from '@anthropic-ai/sdk';
import { ParsedItem, ValuationResult, ResaleAdvice } from '@/lib/types';

const anthropic = new Anthropic();

export async function getResaleAdvice(
  item: ParsedItem,
  valuation: ValuationResult
): Promise<ResaleAdvice> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Provide resale advice for this item.

ITEM: ${item.title}
CATEGORY: ${item.category}
CONDITION: ${item.condition}
SIZE: ${item.sizeClass}
ESTIMATED VALUE: $${valuation.estimatedValue}
VALUATION CONFIDENCE: ${valuation.confidence}

Return ONLY valid JSON:
{
  "recommendedChannel": "eBay/Amazon/Facebook Marketplace/Craigslist/OfferUp/Specialty Site",
  "riskScore": "low/medium/high",
  "riskReasoning": "brief explanation of risks",
  "tips": ["tip1", "tip2", "tip3"]
}

Consider:
- Item category and typical buyers
- Size/shipping complexity
- Condition and authenticity concerns
- Market demand
- Platform fees vs. audience reach`
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
      recommendedChannel: parsed.recommendedChannel || 'eBay',
      riskScore: parsed.riskScore || 'medium',
      riskReasoning: parsed.riskReasoning || 'Unable to assess risk',
      tips: parsed.tips || []
    };

  } catch (error) {
    console.error('Resale advice error:', error);
    return {
      recommendedChannel: 'eBay',
      riskScore: 'medium',
      riskReasoning: 'Unable to generate advice',
      tips: ['Research the item thoroughly before bidding']
    };
  }
}
