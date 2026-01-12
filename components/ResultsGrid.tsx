import { AnalyzedItem } from '@/lib/types';
import ResultCard from './ResultCard';

interface Props {
  items: AnalyzedItem[];
}

export default function ResultsGrid({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No profitable items found matching your criteria.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <ResultCard key={item.item.id || index} data={item} />
      ))}
    </div>
  );
}
