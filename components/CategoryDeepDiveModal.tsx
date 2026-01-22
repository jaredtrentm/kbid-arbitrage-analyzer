'use client';

import { useState, useEffect } from 'react';

interface CategoryDeepDive {
  category: string;
  summary: string;
  whyHotOrCold: string;
  bestItemTypes: string[];
  timingAdvice: string;
  riskFactors: string[];
  recommendation: string;
  stats: {
    totalAnalyzed: number;
    profitableCount: number;
    overbidCount: number;
    avgProfit: number;
    avgOverpay: number;
    opportunityScore: number;
  };
}

interface Props {
  category: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryDeepDiveModal({ category, isOpen, onClose }: Props) {
  const [analysis, setAnalysis] = useState<CategoryDeepDive | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && category) {
      loadAnalysis();
    }
  }, [isOpen, category]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/category-dive?category=${encodeURIComponent(category)}`);
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Failed to load analysis');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isHot = analysis && analysis.stats.opportunityScore > 20;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">AI</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {category}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Category Deep Dive</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full mt-6"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadAnalysis}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-lg p-3 ${isHot ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Opportunity</p>
                    <p className={`text-xl font-bold ${isHot ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isHot ? 'HOT' : 'COLD'}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Profitable</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {analysis.stats.profitableCount}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Overbids</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {analysis.stats.overbidCount}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Summary</h3>
                  <p className="text-gray-600 dark:text-gray-400">{analysis.summary}</p>
                </div>

                {/* Why Hot/Cold */}
                <div className={`p-4 rounded-lg ${isHot ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                  <h3 className={`font-semibold mb-2 ${isHot ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    Why {isHot ? 'Hot' : 'Cold'}?
                  </h3>
                  <p className={`text-sm ${isHot ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {analysis.whyHotOrCold}
                  </p>
                </div>

                {/* Best Item Types */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Best Item Types</h3>
                  <ul className="space-y-1">
                    {analysis.bestItemTypes.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="text-green-500">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Timing Advice */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Timing Advice</h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{analysis.timingAdvice}</p>
                </div>

                {/* Risk Factors */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Risk Factors</h3>
                  <ul className="space-y-1">
                    {analysis.riskFactors.map((risk, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="text-red-500">!</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendation */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Recommendation</h3>
                  <p className="text-sm text-purple-600 dark:text-purple-400">{analysis.recommendation}</p>
                </div>

                {/* Additional Stats */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Analyzed:</span>
                      <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">
                        {analysis.stats.totalAnalyzed}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Avg Profit:</span>
                      <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                        ${analysis.stats.avgProfit.toFixed(0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Avg Overpay:</span>
                      <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                        {analysis.stats.avgOverpay.toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Score:</span>
                      <span className={`ml-2 font-medium ${isHot ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {analysis.stats.opportunityScore.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
