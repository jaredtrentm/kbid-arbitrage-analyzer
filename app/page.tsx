'use client';

import { useState } from 'react';
import ParameterForm from '@/components/ParameterForm';
import ResultsGrid from '@/components/ResultsGrid';
import LoadingState from '@/components/LoadingState';
import ErrorDisplay from '@/components/ErrorDisplay';
import { AnalysisParams, AnalysisResponse } from '@/lib/types';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResponse | null>(null);

  const handleSubmit = async (params: AnalysisParams) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data: AnalysisResponse = await response.json();

      if (!data.success && data.error) {
        setError(data.error);
      } else {
        setResults(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!results?.items.length) return;

    const headers = ['Title', 'Current Bid', 'Max Bid', 'Est Value', 'Profit', 'ROI %', 'Risk', 'Channel', 'URL'];
    const rows = results.items.map(({ item, valuation, profit, resale }) => [
      `"${item.title.replace(/"/g, '""')}"`,
      item.currentBid,
      profit.maxBid,
      valuation.estimatedValue,
      profit.expectedProfit,
      profit.expectedROI,
      resale.riskScore,
      resale.recommendedChannel,
      item.auctionUrl
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kbid-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-8">
        <header className="mb-3 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            K-Bid Arbitrage
          </h1>
          <p className="text-xs sm:text-base text-gray-600 mt-0.5 sm:mt-1">
            Find profitable auctions with AI valuations
          </p>
        </header>

        <div className="mb-3 sm:mb-6">
          <ParameterForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {isLoading && <LoadingState />}

        {error && (
          <ErrorDisplay message={error} onRetry={() => setError(null)} />
        )}

        {results && !isLoading && (
          <div>
            <div className="flex flex-row justify-between items-center gap-2 mb-3 sm:mb-4">
              <div className="text-xs sm:text-sm text-gray-600">
                <strong>{results.summary.totalProfitable}</strong> profitable
                <span className="hidden sm:inline"> of {results.summary.totalAnalyzed} analyzed ({results.summary.totalScraped} scraped)</span>
              </div>
              {results.items.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-xs sm:text-sm transition-colors"
                >
                  Export CSV
                </button>
              )}
            </div>
            <ResultsGrid items={results.items} />
          </div>
        )}
      </div>
    </main>
  );
}
