'use client';

import { useState, useEffect } from 'react';
import { WatchlistItem } from '@/lib/supabase';

interface Props {
  onClose: () => void;
}

export default function Watchlist({ onClose }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedItems, setClosedItems] = useState<string[]>([]);

  // Fetch watchlist items on mount (auto-refresh)
  useEffect(() => {
    refreshWatchlist();
  }, []);

  const refreshWatchlist = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/watchlist/refresh', { method: 'POST' });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to refresh watchlist');
      }

      setItems(data.items || []);
      setClosedItems(data.closedItems || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      // Fallback to just fetching without refresh
      try {
        const response = await fetch('/api/watchlist');
        const data = await response.json();
        if (data.success) {
          setItems(data.items || []);
        }
      } catch {
        // Ignore fallback errors
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item from your watchlist?')) return;

    try {
      const response = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete item');
      }

      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  // Check if item is flagged (current bid exceeds max bid)
  const isFlagged = (item: WatchlistItem) => item.current_bid > item.max_bid;
  const isClosed = (item: WatchlistItem) => closedItems.includes(item.id);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">Loading watchlist...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Watchlist</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} saved items</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshWatchlist}
              disabled={refreshing}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
                ${refreshing
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-wait'
                  : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900'
                }`}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Prices'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">No items in watchlist</p>
              <p className="text-sm">Save items from your analysis results to track them here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const flagged = isFlagged(item);
                const closed = isClosed(item);

                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 sm:p-4 transition-colors
                      ${flagged ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}
                      ${closed ? 'opacity-60' : ''}
                    `}
                  >
                    <div className="flex gap-3">
                      {/* Image */}
                      {item.image_url && (
                        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-800 dark:text-gray-100 text-sm sm:text-base truncate">
                                {item.title}
                              </h3>
                              {flagged && (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                                  BID EXCEEDED
                                </span>
                              )}
                              {closed && (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-gray-500 text-white text-xs font-bold rounded">
                                  CLOSED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {item.category} | {item.recommended_channel}
                              {item.auction_end_date && ` | Ends: ${item.auction_end_date}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                            title="Remove from watchlist"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Price info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Current Bid:</span>
                            <span className={`ml-1 font-medium ${flagged ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                              ${item.current_bid.toFixed(0)}
                            </span>
                            {item.current_bid !== item.saved_bid && (
                              <span className={`text-xs ml-1 ${item.current_bid > item.saved_bid ? 'text-red-500' : 'text-green-500'}`}>
                                ({item.current_bid > item.saved_bid ? '+' : ''}{(item.current_bid - item.saved_bid).toFixed(0)})
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Max Bid:</span>
                            <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">${item.max_bid.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Value:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">${item.estimated_value.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Profit:</span>
                            <span className={`ml-1 font-bold ${flagged ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              ${flagged
                                ? (item.estimated_value - item.current_bid - item.fees - item.shipping_estimate).toFixed(0)
                                : item.expected_profit.toFixed(0)
                              }
                            </span>
                          </div>
                        </div>

                        {/* Warning message for flagged items */}
                        {flagged && (
                          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/50 rounded text-xs text-red-700 dark:text-red-300">
                            Current bid (${item.current_bid.toFixed(0)}) exceeds your max bid (${item.max_bid.toFixed(0)}) by ${(item.current_bid - item.max_bid).toFixed(0)}.
                            This item no longer meets your ROI/profit requirements.
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-2">
                          <a
                            href={item.auction_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            View Auction
                          </a>
                          <span className={`px-2 py-1 rounded text-xs font-medium
                            ${item.risk_score === 'low' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                              item.risk_score === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                              'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {item.risk_score} risk
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Total Items:</span>
                <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{items.length}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Flagged:</span>
                <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                  {items.filter(isFlagged).length}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Potential Profit:</span>
                <span className="ml-1 font-medium text-green-600 dark:text-green-400">
                  ${items.filter(i => !isFlagged(i)).reduce((sum, i) => sum + i.expected_profit, 0).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
