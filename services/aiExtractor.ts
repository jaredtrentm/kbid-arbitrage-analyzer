import Anthropic from '@anthropic-ai/sdk';
import { RawKBidItem, ParsedItem } from '@/lib/types';

const anthropic = new Anthropic();

// Categories to exclude from analysis
const EXCLUDED_CATEGORIES = [
  'coins',
  'currency',
  'precious metals',
  'commercial',
  'industrial',
  'farm equipment',
  'heavy equipment',
  'construction'
];

export async function extractItemDetails(rawItems: RawKBidItem[]): Promise<ParsedItem[]> {
  const results: ParsedItem[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item, index) => {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analyze this K-Bid auction item and extract details as JSON.

RAW TEXT:
${item.text}

URL: ${item.url}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "title": "concise item title",
  "description": "brief description",
  "currentBid": 0,
  "category": "category name",
  "condition": "new/like-new/good/fair/poor/unknown",
  "sizeClass": "small/medium/large/oversized",
  "excluded": false,
  "excludeReason": null
}

Rules:
- currentBid: Extract the dollar amount if visible, otherwise use 0
- sizeClass: small (<5lbs, fits in shoebox), medium (5-30lbs), large (30-70lbs), oversized (>70lbs or furniture)
- excluded: Set true for:
  * Vehicles, real estate, firearms, ammunition
  * Coins, currency, precious metals (gold, silver, bullion)
  * Commercial & industrial equipment
  * Farm equipment, tractors, agricultural machinery
  * Heavy equipment, construction equipment
  * Items impossible to resell online
- excludeReason: If excluded, explain why (e.g., "Coins/precious metals category", "Heavy equipment")

Extract the current bid price from patterns like "$XX", "Current Bid: $XX", etc.`
          }]
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type');
        }

        // Clean the response - remove any markdown formatting
        let jsonStr = content.text.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
        }

        const parsed = JSON.parse(jsonStr);

        // Double-check category exclusion
        const category = (parsed.category || '').toLowerCase();
        const title = (parsed.title || '').toLowerCase();
        const isExcludedCategory = EXCLUDED_CATEGORIES.some(exc =>
          category.includes(exc) || title.includes(exc)
        );

        if (isExcludedCategory && !parsed.excluded) {
          parsed.excluded = true;
          parsed.excludeReason = 'Excluded category';
        }

        return {
          id: `item-${i + index}-${Date.now()}`,
          title: parsed.title || 'Unknown Item',
          description: parsed.description || '',
          currentBid: typeof parsed.currentBid === 'number' ? parsed.currentBid : 0,
          category: parsed.category || 'Uncategorized',
          condition: parsed.condition || 'unknown',
          sizeClass: parsed.sizeClass || 'medium',
          auctionUrl: item.url,
          imageUrl: item.imageUrl,
          excluded: parsed.excluded || false,
          excludeReason: parsed.excludeReason || undefined
        } as ParsedItem;

      } catch (error) {
        console.error('Failed to parse item:', error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((item): item is ParsedItem => item !== null));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < rawItems.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
