import { RawKBidItem } from '@/lib/types';

interface AuctionInfo {
  url: string;
  title: string;
  endDateTime: Date | null;
  endDateTimeStr: string | null;
}

// Fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Fetch failed');
}

// Parse datetime strings and return Date object + display string
function parseAuctionEndTime(text: string): { date: Date | null; str: string | null } {
  try {
    const now = new Date();

    // Look for full datetime patterns like "Closes Jan 15, 2024 6:00 PM" or "1/15/24 6:00pm"
    // Pattern: date + time with AM/PM
    const fullDateTimeMatch = text.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?\s*,?\s*(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/i
    );

    if (fullDateTimeMatch) {
      const month = parseInt(fullDateTimeMatch[1]) - 1;
      const day = parseInt(fullDateTimeMatch[2]);
      let year = fullDateTimeMatch[3] ? parseInt(fullDateTimeMatch[3]) : now.getFullYear();
      if (year < 100) year += 2000;

      let hours = parseInt(fullDateTimeMatch[4]);
      const minutes = parseInt(fullDateTimeMatch[5]);
      const ampm = fullDateTimeMatch[6].toLowerCase();

      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const endDate = new Date(year, month, day, hours, minutes);
      const str = endDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });

      return { date: endDate, str };
    }

    // Look for month name + day + time: "Jan 15 6:00 PM" or "January 15, 6:00pm"
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthTimeMatch = text.toLowerCase().match(
      new RegExp(`(${monthNames.join('|')})\\w*\\s+(\\d{1,2})\\s*,?\\s*(\\d{1,2}):(\\d{2})\\s*(am|pm)?`, 'i')
    );

    if (monthTimeMatch) {
      const month = monthNames.indexOf(monthTimeMatch[1].substring(0, 3));
      const day = parseInt(monthTimeMatch[2]);
      let hours = parseInt(monthTimeMatch[3]);
      const minutes = parseInt(monthTimeMatch[4]);
      const ampm = monthTimeMatch[5]?.toLowerCase();

      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      let year = now.getFullYear();
      const endDate = new Date(year, month, day, hours, minutes);

      // If date is in the past, assume next year
      if (endDate < now) {
        endDate.setFullYear(year + 1);
      }

      const str = endDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });

      return { date: endDate, str };
    }

    // Look for just date without time (assume end of day)
    const dateOnlyMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/);
    if (dateOnlyMatch) {
      const month = parseInt(dateOnlyMatch[1]) - 1;
      const day = parseInt(dateOnlyMatch[2]);
      let year = dateOnlyMatch[3] ? parseInt(dateOnlyMatch[3]) : now.getFullYear();
      if (year < 100) year += 2000;

      // Assume 11:59 PM if no time specified
      const endDate = new Date(year, month, day, 23, 59);
      const str = endDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });

      return { date: endDate, str };
    }

    // Look for "X days" pattern
    const daysMatch = text.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      endDate.setHours(23, 59, 0, 0);
      const str = endDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      return { date: endDate, str };
    }

    return { date: null, str: null };
  } catch {
    return { date: null, str: null };
  }
}

// Step 1: Get list of auctions from main page
async function getAuctionList(): Promise<AuctionInfo[]> {
  const html = await fetchWithRetry('https://www.k-bid.com/auction');
  const auctions: AuctionInfo[] = [];

  // Look for auction cards/links with their end dates
  const auctionRegex = /<a[^>]*href="([^"]*\/auction\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = html.matchAll(auctionRegex);

  const seen = new Set<string>();

  for (const match of matches) {
    let url = match[1];
    if (!url.startsWith('http')) {
      url = `https://www.k-bid.com${url}`;
    }

    // Extract auction ID to dedupe
    const idMatch = url.match(/\/auction\/(\d+)/);
    const auctionId = idMatch ? idMatch[1] : url;

    if (seen.has(auctionId)) continue;
    seen.add(auctionId);

    const innerHtml = match[2];
    const text = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Try to find end datetime
    const { date, str } = parseAuctionEndTime(text);

    if (text.length > 5) {
      auctions.push({
        url,
        title: text.substring(0, 100),
        endDateTime: date,
        endDateTimeStr: str
      });
    }
  }

  return auctions;
}

// Step 2: Get items from a specific auction page
async function getAuctionItems(auctionUrl: string, auctionEndDateStr: string | null): Promise<RawKBidItem[]> {
  try {
    const html = await fetchWithRetry(auctionUrl);
    const items: RawKBidItem[] = [];

    // Extract image URLs helper
    const extractImage = (content: string): string | undefined => {
      // Look for img tags
      const imgMatch = content.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
      if (imgMatch) {
        let imgUrl = imgMatch[1];
        if (!imgUrl.startsWith('http')) {
          imgUrl = imgUrl.startsWith('/') ? `https://www.k-bid.com${imgUrl}` : `https://www.k-bid.com/${imgUrl}`;
        }
        // Skip placeholder/icon images
        if (!imgUrl.includes('placeholder') && !imgUrl.includes('icon') && !imgUrl.includes('logo')) {
          return imgUrl;
        }
      }
      // Look for data-src (lazy loaded)
      const dataSrcMatch = content.match(/data-src="([^"]+)"/i);
      if (dataSrcMatch) {
        let imgUrl = dataSrcMatch[1];
        if (!imgUrl.startsWith('http')) {
          imgUrl = imgUrl.startsWith('/') ? `https://www.k-bid.com${imgUrl}` : `https://www.k-bid.com/${imgUrl}`;
        }
        return imgUrl;
      }
      return undefined;
    };

    // Pattern 1: Links to individual lots
    const lotRegex = /<a[^>]*href="([^"]*(?:\/lot\/|\/item\/|\?lot=)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let matches = html.matchAll(lotRegex);

    for (const match of matches) {
      let url = match[1];
      if (!url.startsWith('http')) {
        url = url.startsWith('/') ? `https://www.k-bid.com${url}` : `${auctionUrl}/${url}`;
      }

      const content = match[2];
      const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const imageUrl = extractImage(content);

      if (text.length > 3 && text.length < 1000) {
        items.push({ text, url, imageUrl, auctionEndDate: auctionEndDateStr || undefined });
      }
    }

    // Pattern 2: Look for item cards with bid info
    if (items.length === 0) {
      const cardRegex = /<(?:div|article|li)[^>]*class="[^"]*(?:lot|item|product|card)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;
      matches = html.matchAll(cardRegex);

      for (const match of matches) {
        const content = match[1];
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        const linkMatch = content.match(/<a[^>]*href="([^"]*)"[^>]*>/);
        let url = linkMatch ? linkMatch[1] : auctionUrl;
        if (url && !url.startsWith('http')) {
          url = url.startsWith('/') ? `https://www.k-bid.com${url}` : `${auctionUrl}/${url}`;
        }

        const imageUrl = extractImage(content);

        if (text.match(/\$\d+|bid|lot/i) && text.length > 10 && text.length < 1000) {
          items.push({ text, url, imageUrl, auctionEndDate: auctionEndDateStr || undefined });
        }
      }
    }

    // Pattern 3: Look for table rows
    if (items.length === 0) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      matches = html.matchAll(rowRegex);

      for (const match of matches) {
        const content = match[1];
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        const linkMatch = content.match(/<a[^>]*href="([^"]*)"[^>]*>/);
        let url = linkMatch ? linkMatch[1] : auctionUrl;
        if (url && !url.startsWith('http')) {
          url = url.startsWith('/') ? `https://www.k-bid.com${url}` : `${auctionUrl}/${url}`;
        }

        const imageUrl = extractImage(content);

        if (text.match(/\$\d+/) && text.length > 10 && text.length < 500) {
          items.push({ text, url, imageUrl, auctionEndDate: auctionEndDateStr || undefined });
        }
      }
    }

    return items;
  } catch (error) {
    console.error(`Failed to fetch auction ${auctionUrl}:`, error);
    return [];
  }
}

export async function scrapeKBid(maxItems: number, daysUntilClose: number = 7): Promise<RawKBidItem[]> {
  try {
    const now = new Date();
    const maxEndDate = new Date(now.getTime() + daysUntilClose * 24 * 60 * 60 * 1000);

    console.log(`Scraping K-Bid auctions closing within ${daysUntilClose} days (before ${maxEndDate.toLocaleDateString()})...`);

    // Step 1: Get list of auctions
    const auctions = await getAuctionList();
    console.log(`Found ${auctions.length} auctions on main page`);

    if (auctions.length === 0) {
      throw new Error('No auctions found on K-Bid main page');
    }

    // Step 2: Filter auctions by close date - exclude already closed ones
    const filteredAuctions = auctions.filter(a => {
      // If we couldn't parse the date, include it (to be safe)
      if (a.endDateTime === null) return true;
      // Exclude if already closed
      if (a.endDateTime < now) return false;
      // Include if closing within the specified window
      return a.endDateTime <= maxEndDate;
    });

    console.log(`${filteredAuctions.length} auctions closing within ${daysUntilClose} days (excluding already closed)`);

    // If no auctions match date filter, use auctions that haven't closed yet
    const openAuctions = auctions.filter(a => a.endDateTime === null || a.endDateTime > now);
    const auctionsToScrape = filteredAuctions.length > 0 ? filteredAuctions : openAuctions.slice(0, 10);

    // Step 3: Scrape items from each auction (increased limit to 10)
    const allItems: RawKBidItem[] = [];
    const maxAuctions = Math.min(auctionsToScrape.length, 10); // Increased from 5 to 10

    for (let i = 0; i < maxAuctions && allItems.length < maxItems; i++) {
      const auction = auctionsToScrape[i];
      console.log(`Scraping auction ${i + 1}/${maxAuctions}: ${auction.title.substring(0, 40)}... (closes: ${auction.endDateTimeStr || 'unknown'})`);

      const items = await getAuctionItems(auction.url, auction.endDateTimeStr);
      allItems.push(...items);

      // Small delay between auction fetches
      if (i < maxAuctions - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.url || item.text.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Found ${uniqueItems.length} unique items from ${maxAuctions} auctions`);

    if (uniqueItems.length === 0) {
      // If no items found within auctions, fall back to auction links themselves
      console.log('No items found in auctions, using auction links as items');
      return auctionsToScrape.slice(0, maxItems).map(a => ({
        text: a.title,
        url: a.url,
        auctionEndDate: a.endDateTimeStr || undefined
      }));
    }

    return uniqueItems.slice(0, maxItems);

  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape K-Bid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
