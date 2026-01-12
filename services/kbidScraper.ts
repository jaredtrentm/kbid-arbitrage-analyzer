import { chromium, Browser } from 'playwright';
import { RawKBidItem } from '@/lib/types';

export async function scrapeKBid(maxItems: number): Promise<RawKBidItem[]> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Navigate to K-Bid auctions page
    await page.goto('https://www.k-bid.com/auction', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for content to load - try multiple possible selectors
    await page.waitForSelector('.auction-item, .item-card, [class*="auction"], [class*="item"], .card, article, a[href*="/auction/"]', {
      timeout: 15000
    }).catch(() => null);

    // Give a bit more time for dynamic content
    await page.waitForTimeout(2000);

    // Extract items - try multiple selectors for resilience
    const items = await page.evaluate(() => {
      const results: Array<{ text: string; url: string; imageUrl?: string }> = [];

      // Try different possible selectors for auction items
      const selectors = [
        '.auction-item',
        '.item-card',
        '[class*="auction-item"]',
        '[class*="lot-item"]',
        '.card',
        'article',
        '.product-card',
        '.listing-item'
      ];

      let elements: Element[] = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          elements = Array.from(found);
          break;
        }
      }

      // If no specific elements found, try to find any clickable items with prices
      if (elements.length === 0) {
        const links = document.querySelectorAll('a[href*="auction"], a[href*="lot"], a[href*="item"]');
        elements = Array.from(links);
      }

      // Also try finding items by looking for price patterns
      if (elements.length === 0) {
        const allElements = document.querySelectorAll('div, article, section');
        elements = Array.from(allElements).filter(el => {
          const text = el.textContent || '';
          return text.match(/\$\d+/) && text.length > 20 && text.length < 1000;
        });
      }

      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        const linkEl = el.querySelector('a') || (el.tagName === 'A' ? el : null);
        const link = (linkEl as HTMLAnchorElement)?.href || '';
        const imgEl = el.querySelector('img');
        const img = imgEl?.src || imgEl?.getAttribute('data-src') || '';

        if (text && text.length > 10 && text.length < 2000) {
          results.push({
            text: text.substring(0, 1000), // Limit text length
            url: link,
            imageUrl: img || undefined
          });
        }
      }

      return results;
    });

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = items.filter(item => {
      if (!item.url || seen.has(item.url)) {
        if (!item.url && !seen.has(item.text.substring(0, 100))) {
          seen.add(item.text.substring(0, 100));
          return true;
        }
        return false;
      }
      seen.add(item.url);
      return true;
    });

    return uniqueItems.slice(0, maxItems);

  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape K-Bid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
