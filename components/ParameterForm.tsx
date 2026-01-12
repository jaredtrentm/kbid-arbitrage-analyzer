'use client';

import { useState } from 'react';
import { AnalysisParams } from '@/lib/types';

interface Props {
  onSubmit: (params: AnalysisParams) => void;
  isLoading: boolean;
}

export default function ParameterForm({ onSubmit, isLoading }: Props) {
  const [params, setParams] = useState<AnalysisParams>({
    profit_min_dollars: 40,
    profit_min_percent: 40,
    selling_fee_percent: 15,
    max_items: 50
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Analysis Parameters</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Profit ($)
          </label>
          <input
            type="number"
            value={params.profit_min_dollars}
            onChange={(e) => setParams(p => ({ ...p, profit_min_dollars: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            min="0"
            step="5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min ROI (%)
          </label>
          <input
            type="number"
            value={params.profit_min_percent}
            onChange={(e) => setParams(p => ({ ...p, profit_min_percent: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            min="0"
            step="5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Selling Fees (%)
          </label>
          <input
            type="number"
            value={params.selling_fee_percent}
            onChange={(e) => setParams(p => ({ ...p, selling_fee_percent: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            min="0"
            max="50"
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Items
          </label>
          <input
            type="number"
            value={params.max_items}
            onChange={(e) => setParams(p => ({ ...p, max_items: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            min="1"
            max="200"
            step="10"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`mt-6 w-full py-3 px-4 rounded-md font-medium text-white transition-colors
          ${isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
      >
        {isLoading ? 'Analyzing...' : 'Run Analysis'}
      </button>
    </form>
  );
}
