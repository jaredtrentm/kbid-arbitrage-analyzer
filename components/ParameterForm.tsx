'use client';

import { useState } from 'react';
import { AnalysisParams } from '@/lib/types';
import { CATEGORY_OPTIONS, SCRAPE_CONFIG } from '@/lib/config';

interface Props {
  onSubmit: (params: AnalysisParams) => void;
  isLoading: boolean;
  buttonText?: string;
}

// Helper to get date string in YYYY-MM-DD format
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function ParameterForm({ onSubmit, isLoading, buttonText = 'Run Analysis' }: Props) {
  const today = new Date();
  const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [params, setParams] = useState<AnalysisParams>({
    profit_min_dollars: 20,
    profit_min_percent: 30,
    selling_fee_percent: 13,
    max_items: SCRAPE_CONFIG.maxItems, // Hidden - uses config limit
    start_date: getDateString(today),
    end_date: getDateString(threeDaysLater),
    single_auction_url: '',
    selected_categories: [...CATEGORY_OPTIONS]
  });

  const [useSingleAuction, setUseSingleAuction] = useState(false);

  const handleCategoryToggle = (category: string) => {
    setParams(p => {
      const current = p.selected_categories || [];
      if (current.includes(category)) {
        return { ...p, selected_categories: current.filter(c => c !== category) };
      } else {
        return { ...p, selected_categories: [...current, category] };
      }
    });
  };

  const handleSelectAllCategories = () => {
    setParams(p => ({ ...p, selected_categories: [...CATEGORY_OPTIONS] }));
  };

  const handleClearCategories = () => {
    setParams(p => ({ ...p, selected_categories: [] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean up params before submitting
    const submitParams = {
      ...params,
      single_auction_url: useSingleAuction ? params.single_auction_url : undefined
    };
    onSubmit(submitParams);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100">Analysis Parameters</h2>

      {/* Single Auction URL Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useSingleAuction}
            onChange={(e) => setUseSingleAuction(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Scrape specific auction or search URL</span>
        </label>
        {useSingleAuction && (
          <div className="mt-2">
            <input
              type="url"
              placeholder="Auction or search URL..."
              value={params.single_auction_url || ''}
              onChange={(e) => setParams(p => ({ ...p, single_auction_url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Examples: <span className="font-mono">k-bid.com/auction/281702</span> or <span className="font-mono">k-bid.com/auction/list?search_phrase_inline=bicycle</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Profit ($)
          </label>
          <input
            type="number"
            value={params.profit_min_dollars}
            onChange={(e) => setParams(p => ({ ...p, profit_min_dollars: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min ROI (%)
          </label>
          <input
            type="number"
            value={params.profit_min_percent}
            onChange={(e) => setParams(p => ({ ...p, profit_min_percent: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fees (%)
          </label>
          <input
            type="number"
            value={params.selling_fee_percent}
            onChange={(e) => setParams(p => ({ ...p, selling_fee_percent: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
          />
        </div>

        {!useSingleAuction && (
          <>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={params.start_date}
                onChange={(e) => setParams(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={params.end_date}
                onChange={(e) => setParams(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm"
              />
            </div>
          </>
        )}
      </div>

      {/* Category Filter */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
            Categories to Include
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAllCategories}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Select All
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              type="button"
              onClick={handleClearCategories}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORY_OPTIONS.map((category) => (
            <label key={category} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.selected_categories?.includes(category) ?? true}
                onChange={() => handleCategoryToggle(category)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{category}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || (params.selected_categories?.length === 0)}
        className={`mt-3 sm:mt-6 w-full py-2.5 sm:py-3 px-4 rounded-md font-medium text-white text-sm sm:text-base transition-colors
          ${isLoading || (params.selected_categories?.length === 0)
            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
      >
        {isLoading ? 'Loading...' : buttonText}
      </button>
    </form>
  );
}
