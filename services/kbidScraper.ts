import { RawKBidItem } from '@/lib/types';

export async function scrapeKBid(maxItems: number): Promise<RawKBidItem[]> {
  try {
    // Fetch the K-Bid auctions page
    const response = await fetch('https://www.k-bid.com/auction', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const items: RawKBidItem[] = [];

    // Try to find auction links and extract item data
    // K-Bid typically has auction listings with links to individual auctions
    const auctionLinkRegex = /<a[^>]*href="([^"]*\/auction\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const matches = html.matchAll(auctionLinkRegex);

    for (const match of matches) {
      const url = match[1].startsWith('http') ? match[1] : `https://www.k-bid.com${match[1]}`;
      const innerHtml = match[2];

      // Strip HTML tags to get text
      const text = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      if (text && text.length > 5 && text.length < 500) {
        items.push({ text, url });
      }
    }

    // If no auction links found, try a broader pattern
    if (items.length === 0) {
      // Look for any links containing "bid" or "lot"
      const broadRegex = /<a[^>]*href="([^"]*(?:bid|lot|item)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const broadMatches = html.matchAll(broadRegex);

      for (const match of broadMatches) {
        const url = match[1].startsWith('http') ? match[1] : `https://www.k-bid.com${match[1]}`;
        const text = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        if (text && text.length > 5) {
          items.push({ text, url });
        }
      }
    }

    // If still no items, try to find any content with prices
    if (items.length === 0) {
      // Look for divs/sections with price-like content
      const priceRegex = /<(?:div|section|article)[^>]*class="[^"]*(?:item|card|listing|auction)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/gi;
      const priceMatches = html.matchAll(priceRegex);

      for (const match of priceMatches) {
        const content = match[1];
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        // Look for a link within this content
        const linkMatch = content.match(/<a[^>]*href="([^"]*)"[^>]*>/);
        const url = linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www.k-bid.com${linkMatch[1]}`) : '';

        if (text && text.match(/\$\d+/)) {
          items.push({ text: text.substring(0, 500), url });
        }
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = items.filter(item => {
      const key = item.url || item.text.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueItems.length === 0) {
      // Return debug info if nothing found
      throw new Error('No auction items found. K-Bid may require JavaScript rendering or the page structure has changed.');
    }

    return uniqueItems.slice(0, maxItems);

  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape K-Bid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
