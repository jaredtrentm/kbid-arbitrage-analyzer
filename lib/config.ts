// Centralized configuration for scraping and analysis
// Adjust these values based on your Vercel plan and API rate limits

export const SCRAPE_CONFIG = {
  // Hard limit on items to scrape (cost control)
  // Each item requires ~1 AI call for analysis + web searches
  // At ~$0.01-0.03 per item, 200 items = ~$2-6 per full analysis
  // Remove or increase this limit once app is monetized
  maxItems: 200,
  batchSize: 50,           // Items per analysis batch
  parallelAuctions: 5,     // Concurrent auction scraping
  fetchTimeout: 10000,     // Fetch timeout in ms (10 seconds)
  retryDelay: 1000,        // Delay between retries in ms
  concurrentWorkers: 3,    // Parallel workers for item processing
};

// Category options matching K-Bid's actual categories
export const CATEGORY_OPTIONS = [
  'Coins, Currency & Precious Metals',
  'Commercial & Industrial',
  'Farm Equipment',
  'Heavy Equipment & Construction',
  'Household & Estate',
  'Real Estate',
  'Sporting Goods & Hobbies',
  'Technology',
  'Vehicles & Marine',
] as const;

export type CategoryOption = typeof CATEGORY_OPTIONS[number];

// Map AI-extracted categories to K-Bid filter categories
export function mapToFilterCategory(aiCategory: string): CategoryOption {
  const lower = aiCategory.toLowerCase();

  // Coins, Currency & Precious Metals
  if (lower.includes('coin') || lower.includes('currency') || lower.includes('gold') || lower.includes('silver') || lower.includes('precious') || lower.includes('bullion') || lower.includes('numismatic')) {
    return 'Coins, Currency & Precious Metals';
  }

  // Technology (electronics, computers, phones, etc.)
  if (lower.includes('electronic') || lower.includes('computer') || lower.includes('phone') || lower.includes('tv') || lower.includes('audio') || lower.includes('tech') || lower.includes('laptop') || lower.includes('tablet') || lower.includes('gaming')) {
    return 'Technology';
  }

  // Commercial & Industrial
  if (lower.includes('commercial') || lower.includes('industrial') || lower.includes('office') || lower.includes('restaurant') || lower.includes('retail') || lower.includes('business')) {
    return 'Commercial & Industrial';
  }

  // Farm Equipment
  if (lower.includes('farm') || lower.includes('tractor') || lower.includes('agricultural') || lower.includes('livestock') || lower.includes('irrigation')) {
    return 'Farm Equipment';
  }

  // Heavy Equipment & Construction
  if (lower.includes('heavy equipment') || lower.includes('construction') || lower.includes('excavator') || lower.includes('bulldozer') || lower.includes('loader') || lower.includes('crane') || lower.includes('forklift')) {
    return 'Heavy Equipment & Construction';
  }

  // Vehicles & Marine
  if (lower.includes('vehicle') || lower.includes('car') || lower.includes('truck') || lower.includes('trailer') || lower.includes('motorcycle') || lower.includes('boat') || lower.includes('marine') || lower.includes('atv') || lower.includes('rv') || lower.includes('camper')) {
    return 'Vehicles & Marine';
  }

  // Real Estate
  if (lower.includes('real estate') || lower.includes('property') || lower.includes('land') || lower.includes('building') || lower.includes('house') || lower.includes('lot')) {
    return 'Real Estate';
  }

  // Sporting Goods & Hobbies
  if (lower.includes('sport') || lower.includes('golf') || lower.includes('fishing') || lower.includes('bike') || lower.includes('exercise') || lower.includes('outdoor') || lower.includes('hobby') || lower.includes('craft') || lower.includes('collectible') || lower.includes('antique') || lower.includes('art') || lower.includes('memorabilia') || lower.includes('toy') || lower.includes('game')) {
    return 'Sporting Goods & Hobbies';
  }

  // Household & Estate (default for furniture, appliances, general items)
  return 'Household & Estate';
}
