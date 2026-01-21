// Centralized configuration for scraping and analysis
// Adjust these values based on your Vercel plan and API rate limits

export const SCRAPE_CONFIG = {
  maxItems: 500,           // Maximum items to scrape (increased for Pro)
  batchSize: 50,           // Items per analysis batch
  parallelAuctions: 5,     // Concurrent auction scraping
  fetchTimeout: 10000,     // Fetch timeout in ms (10 seconds)
  retryDelay: 1000,        // Delay between retries in ms
  concurrentWorkers: 3,    // Parallel workers for item processing
};

// Category options for filtering
export const CATEGORY_OPTIONS = [
  'Electronics',
  'Tools & Equipment',
  'Furniture',
  'Appliances',
  'Sporting Goods',
  'Collectibles',
  'Vehicles/Heavy Equipment',
  'Other',
] as const;

export type CategoryOption = typeof CATEGORY_OPTIONS[number];

// Map AI-extracted categories to filter categories
export function mapToFilterCategory(aiCategory: string): CategoryOption {
  const lower = aiCategory.toLowerCase();

  if (lower.includes('electronic') || lower.includes('computer') || lower.includes('phone') || lower.includes('tv') || lower.includes('audio')) {
    return 'Electronics';
  }
  if (lower.includes('tool') || lower.includes('equipment') || lower.includes('power') || lower.includes('drill') || lower.includes('saw')) {
    return 'Tools & Equipment';
  }
  if (lower.includes('furniture') || lower.includes('chair') || lower.includes('table') || lower.includes('desk') || lower.includes('sofa') || lower.includes('bed')) {
    return 'Furniture';
  }
  if (lower.includes('appliance') || lower.includes('washer') || lower.includes('dryer') || lower.includes('refrigerator') || lower.includes('microwave') || lower.includes('oven')) {
    return 'Appliances';
  }
  if (lower.includes('sport') || lower.includes('golf') || lower.includes('fishing') || lower.includes('bike') || lower.includes('exercise') || lower.includes('outdoor')) {
    return 'Sporting Goods';
  }
  if (lower.includes('collectible') || lower.includes('antique') || lower.includes('vintage') || lower.includes('art') || lower.includes('memorabilia')) {
    return 'Collectibles';
  }
  if (lower.includes('vehicle') || lower.includes('car') || lower.includes('truck') || lower.includes('trailer') || lower.includes('heavy') || lower.includes('tractor') || lower.includes('machinery')) {
    return 'Vehicles/Heavy Equipment';
  }

  return 'Other';
}
