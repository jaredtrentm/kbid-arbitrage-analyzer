'use client';

import { useState, useEffect } from 'react';

interface OverbidItem {
  id: string;
  title: string;
  category: string;
  current_bid: number;
  estimated_value: number;
  overpay_amount: number;
  overpay_percent: number;
  bid_count: number;
  bidder_count: number;
  interest_level: string;
  auction_url: string;
  image_url?: string;
  created_at: string;
  auction_end_date?: string;
}

type SortField = 'overpay_percent' | 'overpay_amount' | 'created_at' | 'category';
type SortOrder = 'asc' | 'desc';

export default function OverpayObservatory() {
  const [items, setItems] = useState<OverbidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('overpay_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadOverbidItems();
  }, []);

  const loadOverbidItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analytics/overbids');
      const data = await response.json();
      if (data.success) {
        setItems(data.items);
      } else {
        setError(data.error || 'Failed to load overbid items');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Get unique categories
  const categories = ['all', ...new Set(items.map(i => i.category))];

  // Filter and sort items
  const filteredItems = items
    .filter(item => categoryFilter === 'all' || item.category === categoryFilter)
    .sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'category') {
        return multiplier * a.category.localeCompare(b.category);
      }
      if (sortField === 'created_at') {
        return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      return multiplier * ((a[sortField] || 0) - (b[sortField] || 0));
    });

  // Calculate summary stats (handle null values safely)
  const totalOverbid = items.length;
  const avgOverpayPercent = items.length > 0
    ? items.reduce((sum, i) => sum + (i.overpay_percent || 0), 0) / items.length
    : 0;
  const maxOverpay = items.length > 0
    ? Math.max(...items.map(i => i.overpay_percent || 0))
    : 0;
  const totalOverpayAmount = items.reduce((sum, i) => sum + (i.overpay_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
        <h2 className="text-xl font-bold text-red-800 dark:text-red-300 mb-1">
          Overpay Observatory
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400">
          Track when buyers pay above market value - your opportunity to sell high.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Overbids</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{totalOverbid}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Overpay</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{avgOverpayPercent.toFixed(0)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Highest Overpay</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{maxOverpay.toFixed(0)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total $ Above Value</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">${totalOverpayAmount.toFixed(0)}</p>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {[
            { field: 'overpay_percent' as SortField, label: '% Over' },
            { field: 'overpay_amount' as SortField, label: '$ Over' },
            { field: 'created_at' as SortField, label: 'Date' },
          ].map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`px-2 py-1 text-xs rounded ${
                sortField === field
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {label} {sortField === field && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button onClick={loadOverbidItems} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {items.length === 0
              ? 'No overbid items logged yet. Analyze some auctions to start tracking.'
              : 'No items match your filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <OverbidCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function OverbidCard({ item }: { item: OverbidItem }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-red-500 p-3 hover:shadow-md transition-shadow">
      <div className="flex gap-3">
        {/* Image */}
        {item.image_url && (
          <div className="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <a
                href={item.auction_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
              >
                {item.title}
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {item.category || 'Uncategorized'} • {item.bid_count || 0} bids • {item.bidder_count || 0} bidders
              </p>
            </div>

            {/* Overpay Badge */}
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                +{(item.overpay_percent || 0).toFixed(0)}%
              </div>
              <div className="text-xs text-red-500 dark:text-red-400">
                +${(item.overpay_amount || 0).toFixed(0)} over
              </div>
            </div>
          </div>

          {/* Price Info */}
          <div className="flex gap-4 mt-1 text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              Bid: <span className="font-medium text-gray-800 dark:text-gray-200">${item.current_bid}</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Value: <span className="font-medium text-gray-800 dark:text-gray-200">${item.estimated_value}</span>
            </span>
            {item.interest_level && (
              <span className={`px-1.5 py-0.5 rounded ${
                item.interest_level === 'high' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' :
                item.interest_level === 'medium' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {item.interest_level === 'high' ? 'Hot' : item.interest_level === 'medium' ? 'Active' : 'Low'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
