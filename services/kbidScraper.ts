import { RawKBidItem } from '@/lib/types';
import { SCRAPE_CONFIG } from '@/lib/config';

interface AuctionInfo {
  url: string;
  title: string;
  endDateTime: Date | null;
  endDateTimeStr: string | null;
}

// Extract current bid from HTML (before stripping tags)
function extractCurrentBidFromHtml(html: string): number | null {
  // Pattern: <strong>Current Bid: $XX.XX</strong>
  const strongMatch = html.match(/<strong[^>]*>Current Bid:\s*\$?([\d,]+(?:\.\d{2})?)<\/strong>/i);
  if (strongMatch) {
    return parseFloat(strongMatch[1].replace(/,/g, ''));
  }
  // Pattern: Current Bid: $XX.XX (without tags)
  const bidMatch = html.match(/Current Bid[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (bidMatch) {
    return parseFloat(bidMatch[1].replace(/,/g, ''));
  }
  return null;
}

// Extract current bid from plain text (fallback)
function extractCurrentBid(text: string): number | null {
  const bidMatch = text.match(/current\s*bid[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (bidMatch) {
    return parseFloat(bidMatch[1].replace(/,/g, ''));
  }
  return null;
}

// Extract bid count from HTML/text
function extractBidCount(text: string): number | null {
  // Pattern: "X bids" or "Bids: X" or "X Bid(s)"
  const patterns = [
    /(\d+)\s*bids?\b/i,
    /bids?[:\s]*(\d+)/i,
    /bid\s*count[:\s]*(\d+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

// Extract bidder count from HTML/text
function extractBidderCount(text: string): number | null {
  // Pattern: "X bidders" or "from X bidders" or "Bidders: X"
  const patterns = [
    /(\d+)\s*bidders?\b/i,
    /from\s*(\d+)\s*bidders?/i,
    /bidders?[:\s]*(\d+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

// Check if item/auction is closed
function isClosed(text: string): boolean {
  const closedPatterns = [
    /lot\s+is\s+closed/i,
    /auction\s+closed/i,
    /bidding\s+closed/i,
    /closed\s+auction/i,
    /this\s+lot\s+has\s+ended/i,
    /bidding\s+has\s+ended/i
  ];
  return closedPatterns.some(pattern => pattern.test(text));
}

// Fetch with retry logic and timeout
async function fetchWithRetry(url: string, retries = 1): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCRAPE_CONFIG.fetchTimeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
      }
      return text;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, SCRAPE_CONFIG.retryDelay));
    }
  }
  throw new Error('Fetch failed after retries');
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
      // Look for img tags with src
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

    // K-Bid structure: Find sections containing both item links AND bid info
    // Split HTML into chunks around each item link and look for bid in nearby content

    // First, find all item blocks - look for patterns that contain item URL and bid
    const itemBlockRegex = /<(?:div|article|section|tr)[^>]*>(?:(?!<\/(?:div|article|section|tr)>)[\s\S])*?\/auction\/\d+\/item\/\d+[\s\S]*?Current Bid[\s\S]*?<\/(?:div|article|section|tr)>/gi;
    const blockMatches: string[] = html.match(itemBlockRegex) || [];

    // If no blocks found, try splitting by item URLs and grabbing more context
    if (blockMatches.length === 0) {
      const itemLinkRegex = /href="(\/auction\/\d+\/item\/\d+[^"]*)"/gi;
      const seen = new Set<string>();
      let match;

      while ((match = itemLinkRegex.exec(html)) !== null) {
        const itemPath = match[1].split('?')[0];
        if (seen.has(itemPath)) continue;
        seen.add(itemPath);

        // Grab 3000 chars before and 2000 after to capture the bid
        const start = Math.max(0, match.index - 3000);
        const end = Math.min(html.length, match.index + 2000);
        blockMatches.push(html.substring(start, end));
      }
    }

    for (const block of blockMatches) {
      // Extract item URL
      const urlMatch = block.match(/href="(\/auction\/\d+\/item\/\d+[^"]*)"/i);
      if (!urlMatch) continue;

      const itemPath = urlMatch[1].split('?')[0];
      const fullUrl = `https://www.k-bid.com${itemPath}`;

      // Skip if we already have this item
      if (items.some(i => i.url === fullUrl)) continue;

      const textContent = block.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      // Skip closed items
      if (isClosed(textContent)) continue;

      // Extract title from <h4> or alt text
      let title = '';
      const h4Match = block.match(/<h4[^>]*>(?:<a[^>]*>)?([^<]+)/i);
      if (h4Match) {
        title = h4Match[1].trim();
      }
      if (!title) {
        const altMatch = block.match(/alt="[^"]*image:\s*([^"]+)"/i);
        if (altMatch) title = altMatch[1].trim();
      }

      // Extract current bid from HTML
      let currentBid = extractCurrentBidFromHtml(block);
      if (currentBid === null) {
        currentBid = extractCurrentBid(textContent);
      }

      // Build text with title and bid for AI
      let itemText = title || textContent.substring(0, 200);
      if (currentBid !== null) {
        itemText += ` Current Bid: $${currentBid.toFixed(2)}`;
      }

      // Extract image
      const imageUrl = extractImage(block);

      // Extract bid activity
      const bidCount = extractBidCount(textContent);
      const bidderCount = extractBidderCount(textContent);

      if (itemText.length > 3) {
        items.push({
          text: itemText,
          url: fullUrl,
          imageUrl,
          auctionEndDate: auctionEndDateStr || undefined,
          currentBid: currentBid || undefined,
          bidCount: bidCount || undefined,
          bidderCount: bidderCount || undefined
        });
      }
    }

    // Fallback: Original pattern if no items found
    if (items.length === 0) {
      const lotRegex = /<a[^>]*href="([^"]*(?:\/lot\/|\/item\/|\?lot=)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const matches = html.matchAll(lotRegex);

      for (const match of matches) {
        let url = match[1];
        if (!url.startsWith('http')) {
          url = url.startsWith('/') ? `https://www.k-bid.com${url}` : `${auctionUrl}/${url}`;
        }

        const content = match[2];
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        // Skip closed items
        if (isClosed(text)) {
          continue;
        }

        const imageUrl = extractImage(content);
        const currentBid = extractCurrentBid(text);
        const bidCount = extractBidCount(text);
        const bidderCount = extractBidderCount(text);

        if (text.length > 3 && text.length < 1000) {
          items.push({
            text: currentBid ? `${text} Current Bid: $${currentBid.toFixed(2)}` : text,
            url,
            imageUrl,
            auctionEndDate: auctionEndDateStr || undefined,
            currentBid: currentBid || undefined,
            bidCount: bidCount || undefined,
            bidderCount: bidderCount || undefined
          });
        }
      }
    }

    return items;
  } catch (error) {
    console.error(`Failed to fetch auction ${auctionUrl}:`, error);
    return [];
  }
}

// Scrape a single auction by URL - returns all items without limit
export async function scrapeSingleAuction(auctionUrl: string): Promise<RawKBidItem[]> {
  try {
    console.log(`Scraping single auction: ${auctionUrl}`);

    // Validate URL format
    if (!auctionUrl.includes('k-bid.com/auction/')) {
      throw new Error('Invalid K-Bid auction URL. Expected format: https://www.k-bid.com/auction/12345');
    }

    // Normalize URL
    let normalizedUrl = auctionUrl;
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://www.k-bid.com${normalizedUrl.startsWith('/') ? '' : '/'}${normalizedUrl}`;
    }

    // Remove any existing query params and try with showAll parameter
    const baseUrl = normalizedUrl.split('?')[0];

    // Try multiple URL variants to get all items
    const urlsToTry = [
      `${baseUrl}?showAll=true`,
      `${baseUrl}?view=all`,
      `${baseUrl}?perPage=500`,
      baseUrl
    ];

    let allItems: RawKBidItem[] = [];

    for (const url of urlsToTry) {
      console.log(`Trying URL: ${url}`);
      const items = await getAuctionItems(url, null);
      console.log(`Found ${items.length} items from ${url}`);

      if (items.length > allItems.length) {
        allItems = items;
      }

      // If we found a good number of items, stop trying
      if (items.length >= 50) break;
    }

    // Also check for pagination - look for page links and fetch additional pages
    const html = await fetchWithRetry(baseUrl);
    const pageMatches = html.match(/[?&]page=(\d+)/gi) || [];
    const pageNumbers = pageMatches.map(m => parseInt(m.replace(/[?&]page=/i, ''))).filter(n => n > 1);
    const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;

    if (maxPage > 1) {
      console.log(`Found ${maxPage} pages, fetching additional pages...`);
      for (let page = 2; page <= Math.min(maxPage, 10); page++) {
        const pageUrl = `${baseUrl}?page=${page}`;
        console.log(`Fetching page ${page}...`);
        const pageItems = await getAuctionItems(pageUrl, null);
        console.log(`Found ${pageItems.length} items on page ${page}`);
        allItems = [...allItems, ...pageItems];
      }
    }

    console.log(`Total found: ${allItems.length} items in auction`);

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.url || item.text.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`After deduplication: ${uniqueItems.length} unique items`);

    return uniqueItems;
  } catch (error) {
    console.error('Single auction scraping error:', error);
    throw new Error(`Failed to scrape auction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function scrapeKBid(
  maxItems: number,
  startDate: string,
  endDate: string,
  singleAuctionUrl?: string
): Promise<RawKBidItem[]> {
  // If single auction URL provided, use that instead of date range search
  if (singleAuctionUrl) {
    const items = await scrapeSingleAuction(singleAuctionUrl);
    return maxItems > 0 ? items.slice(0, maxItems) : items;
  }

  try {
    const now = new Date();
    const minEndDate = new Date(startDate + 'T00:00:00');
    const maxEndDate = new Date(endDate + 'T23:59:59');

    console.log(`Scraping K-Bid auctions closing between ${minEndDate.toLocaleDateString()} and ${maxEndDate.toLocaleDateString()}...`);

    // Step 1: Get list of auctions
    const auctions = await getAuctionList();
    console.log(`Found ${auctions.length} auctions on main page`);

    if (auctions.length === 0) {
      throw new Error('No auctions found on K-Bid main page');
    }

    // Step 2: Filter auctions by close date - within the specified date range
    const filteredAuctions = auctions.filter(a => {
      // If we couldn't parse the date, include it (to be safe)
      if (a.endDateTime === null) return true;
      // Exclude if already closed
      if (a.endDateTime < now) return false;
      // Include if closing within the specified date range
      return a.endDateTime >= minEndDate && a.endDateTime <= maxEndDate;
    });

    console.log(`${filteredAuctions.length} auctions closing between ${minEndDate.toLocaleDateString()} and ${maxEndDate.toLocaleDateString()} (excluding already closed)`);

    // If no auctions match date filter, use auctions that haven't closed yet
    const openAuctions = auctions.filter(a => a.endDateTime === null || a.endDateTime > now);
    const auctionsToScrape = filteredAuctions.length > 0 ? filteredAuctions : openAuctions.slice(0, 10);

    // Step 3: Scrape items from auctions in parallel
    const maxAuctions = Math.min(auctionsToScrape.length, SCRAPE_CONFIG.parallelAuctions);
    const auctionBatch = auctionsToScrape.slice(0, maxAuctions);

    console.log(`Scraping ${maxAuctions} auctions in parallel...`);

    const auctionPromises = auctionBatch.map(auction => {
      console.log(`Queuing: ${auction.title.substring(0, 40)}... (closes: ${auction.endDateTimeStr || 'unknown'})`);
      return getAuctionItems(auction.url, auction.endDateTimeStr);
    });

    const results = await Promise.all(auctionPromises);
    const allItems: RawKBidItem[] = results.flat();

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
