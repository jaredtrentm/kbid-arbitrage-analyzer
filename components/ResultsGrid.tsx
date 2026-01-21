import { AnalyzedItem } from '@/lib/types';
import ResultCard from './ResultCard';

interface Props {
  items: AnalyzedItem[];
  onSave?: (data: AnalyzedItem) => Promise<void>;
  savedUrls?: Set<string>;
}

export default function ResultsGrid({ items, onSave, savedUrls }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">
        No items found. Try adjusting your search parameters.
      </div>
    );
  }

  const profitableCount = items.filter(item => item.meetsCriteria).length;

  return (
    <div>
      {profitableCount === 0 && items.length > 0 && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs sm:text-sm text-yellow-800">
          No items meet your profit criteria. Showing all {items.length} analyzed items below (sorted by potential profit).
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item, index) => (
          <ResultCard
            key={item.item.id || index}
            data={item}
            onSave={onSave}
            isSaved={savedUrls?.has(item.item.auctionUrl) ?? false}
          />
        ))}
      </div>
    </div>
  );
}
