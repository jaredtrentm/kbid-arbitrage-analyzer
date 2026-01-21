import Anthropic from '@anthropic-ai/sdk';
import { RawKBidItem, ParsedItem } from '@/lib/types';

const anthropic = new Anthropic();

// Fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Map content type to supported media types
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
    if (contentType.includes('png')) mediaType = 'image/png';
    else if (contentType.includes('gif')) mediaType = 'image/gif';
    else if (contentType.includes('webp')) mediaType = 'image/webp';

    return { data: base64, mediaType };
  } catch (error) {
    console.error('Failed to fetch image:', url, error);
    return null;
  }
}

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

// Calculate interest level based on bid activity
function calculateInterestLevel(bidCount?: number, bidderCount?: number): 'low' | 'medium' | 'high' {
  const bids = bidCount || 0;
  const bidders = bidderCount || 0;

  // Calculate average bids per bidder (competitive indicator)
  const bidsPerBidder = bidders > 0 ? bids / bidders : 0;

  // High interest: Multiple bidders actively competing (back-and-forth bidding)
  // At least 2 bidders AND averaging 3+ bids each
  if (bidders >= 2 && bidsPerBidder >= 3) return 'high';

  // Medium interest: People are clearly watching/engaged
  // Multiple bidders OR meaningful bid activity
  if (bidders >= 2 || bids >= 4) return 'medium';

  // Low interest: Minimal activity
  return 'low';
}

export async function extractItemDetails(rawItems: RawKBidItem[]): Promise<ParsedItem[]> {
  const results: ParsedItem[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item, index) => {
      try {
        // Build message content - include image if available
        const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

        // Add image if available (fetch and convert to base64)
        let hasImage = false;
        if (item.imageUrl) {
          const imageData = await fetchImageAsBase64(item.imageUrl);
          if (imageData) {
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageData.mediaType,
                data: imageData.data
              }
            });
            hasImage = true;
          }
        }

        // Add text prompt
        const prompt = `Analyze this K-Bid auction item and extract details as JSON.
${hasImage ? '\nIMAGE: An image of the item is provided above. Use it to assess condition, verify the item matches the description, and note any visible details (e.g., if electronics are powered on, signs of wear, missing parts, etc.).' : ''}

RAW TEXT:
${item.text}

URL: ${item.url}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "title": "concise item title",
  "description": "brief description based on text AND image observations",
  "currentBid": 0,
  "category": "category name",
  "condition": "new/like-new/good/fair/poor/unknown",
  "sizeClass": "small/medium/large/oversized",
  "shippingAvailable": true,
  "excluded": false,
  "excludeReason": null
}

Rules:
- condition: Base this on the IMAGE if available. If you can see the item is working (e.g., lights are on, display is active), note that. Look for wear, damage, rust, missing parts, etc.
- currentBid: Extract the dollar amount if visible, otherwise use 0
- sizeClass: small (<5lbs, fits in shoebox), medium (5-30lbs), large (30-70lbs), oversized (>70lbs or furniture)
- shippingAvailable: Set true if text mentions "shipping available", "will ship", "shipping offered", or similar. Set false if "pickup only", "local pickup", "no shipping", or if item is too large to ship reasonably.
- excluded: Set true for:
  * Vehicles, real estate, firearms, ammunition
  * Coins, currency, precious metals (gold, silver, bullion)
  * Commercial & industrial equipment
  * Farm equipment, tractors, agricultural machinery
  * Heavy equipment, construction equipment
  * Items impossible to resell online
- excludeReason: If excluded, explain why

Extract the current bid price from patterns like "$XX", "Current Bid: $XX", etc.`;

        messageContent.push({ type: 'text', text: prompt });

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: messageContent
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

        // Use pre-extracted bid from scraper if AI couldn't parse it
        let currentBid = typeof parsed.currentBid === 'number' ? parsed.currentBid : 0;
        if (currentBid === 0 && item.currentBid && item.currentBid > 0) {
          currentBid = item.currentBid;
        }

        return {
          id: `item-${i + index}-${Date.now()}`,
          title: parsed.title || 'Unknown Item',
          description: parsed.description || '',
          currentBid,
          category: parsed.category || 'Uncategorized',
          condition: parsed.condition || 'unknown',
          sizeClass: parsed.sizeClass || 'medium',
          auctionUrl: item.url,
          imageUrl: item.imageUrl,
          shippingAvailable: parsed.shippingAvailable ?? false,
          excluded: parsed.excluded || false,
          excludeReason: parsed.excludeReason || undefined,
          auctionEndDate: item.auctionEndDate,
          bidCount: item.bidCount,
          bidderCount: item.bidderCount,
          interestLevel: calculateInterestLevel(item.bidCount, item.bidderCount)
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
