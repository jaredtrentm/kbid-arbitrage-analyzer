'use client';

import { useState } from 'react';
import { AnalysisParams } from '@/lib/types';

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
    max_items: 50,
    start_date: getDateString(today),
    end_date: getDateString(threeDaysLater)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-3 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">Analysis Parameters</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Min Profit ($)
          </label>
          <input
            type="number"
            value={params.profit_min_dollars}
            onChange={(e) => setParams(p => ({ ...p, profit_min_dollars: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Min ROI (%)
          </label>
          <input
            type="number"
            value={params.profit_min_percent}
            onChange={(e) => setParams(p => ({ ...p, profit_min_percent: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Fees (%)
          </label>
          <input
            type="number"
            value={params.selling_fee_percent}
            onChange={(e) => setParams(p => ({ ...p, selling_fee_percent: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={params.start_date}
            onChange={(e) => setParams(p => ({ ...p, start_date: e.target.value }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={params.end_date}
            onChange={(e) => setParams(p => ({ ...p, end_date: e.target.value }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Max Items
          </label>
          <input
            type="number"
            value={params.max_items}
            onChange={(e) => setParams(p => ({ ...p, max_items: Number(e.target.value) }))}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`mt-3 sm:mt-6 w-full py-2.5 sm:py-3 px-4 rounded-md font-medium text-white text-sm sm:text-base transition-colors
          ${isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
      >
        {isLoading ? 'Loading...' : buttonText}
      </button>
    </form>
  );
}
