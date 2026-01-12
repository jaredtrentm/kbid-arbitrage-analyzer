'use client';

import { useState } from 'react';
import ParameterForm from '@/components/ParameterForm';
import ResultsGrid from '@/components/ResultsGrid';
import LoadingState from '@/components/LoadingState';
import ErrorDisplay from '@/components/ErrorDisplay';
import { AnalysisParams, AnalysisResponse, RawKBidItem, AnalyzedItem } from '@/lib/types';

const BATCH_SIZE = 25;

type WorkflowStep = 'idle' | 'scraping' | 'scraped' | 'analyzing';

export default function Home() {
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // Raw scraped items
  const [rawItems, setRawItems] = useState<RawKBidItem[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);

  // Analysis results (accumulated across batches)
  const [analyzedItems, setAnalyzedItems] = useState<AnalyzedItem[]>([]);
  const [summary, setSummary] = useState({ totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 0 });

  // Store params for batch analysis
  const [currentParams, setCurrentParams] = useState<AnalysisParams | null>(null);

  const handleScrape = async (params: AnalysisParams) => {
    setStep('scraping');
    setError(null);
    setRawItems([]);
    setAnalyzedItems([]);
    setBatchIndex(0);
    setSummary({ totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 0 });
    setCurrentParams(params);

    try {
      const response = await fetch('/api/scrape-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_items: params.max_items,
          start_date: params.start_date,
          end_date: params.end_date
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to scrape items');
        setStep('idle');
        return;
      }

      setRawItems(data.items);
      setSummary(prev => ({ ...prev, totalScraped: data.totalCount }));
      setStep('scraped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape items');
      setStep('idle');
    }
  };

  const handleAnalyzeBatch = async () => {
    if (!currentParams || rawItems.length === 0) return;

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, rawItems.length);
    const batchItems = rawItems.slice(startIdx, endIdx);

    if (batchItems.length === 0) return;

    setStep('analyzing');
    setError(null);

    try {
      const response = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profit_min_dollars: currentParams.profit_min_dollars,
          profit_min_percent: currentParams.profit_min_percent,
          selling_fee_percent: currentParams.selling_fee_percent,
          raw_items: batchItems
        })
      });

      const data: AnalysisResponse = await response.json();

      if (!data.success && data.error) {
        setError(data.error);
        setStep('scraped');
        return;
      }

      // Append new results to existing
      setAnalyzedItems(prev => {
        const combined = [...prev, ...data.items];
        // Sort by expected profit descending
        combined.sort((a, b) => b.profit.expectedProfit - a.profit.expectedProfit);
        return combined;
      });

      // Update summary
      setSummary(prev => ({
        totalScraped: prev.totalScraped,
        totalAnalyzed: prev.totalAnalyzed + data.summary.totalAnalyzed,
        totalProfitable: prev.totalProfitable + data.summary.totalProfitable,
        errors: prev.errors + data.summary.errors
      }));

      setBatchIndex(prev => prev + 1);
      setStep('scraped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze batch');
      setStep('scraped');
    }
  };

  const handleExportCSV = () => {
    if (!analyzedItems.length) return;

    const headers = ['Title', 'Current Bid', 'Max Bid', 'Est Value', 'Profit', 'ROI %', 'Risk', 'Channel', 'URL'];
    const rows = analyzedItems.map(({ item, valuation, profit, resale }) => [
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

  const handleReset = () => {
    setStep('idle');
    setRawItems([]);
    setAnalyzedItems([]);
    setBatchIndex(0);
    setSummary({ totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 0 });
    setCurrentParams(null);
    setError(null);
  };

  const isLoading = step === 'scraping' || step === 'analyzing';
  const hasMoreBatches = rawItems.length > 0 && (batchIndex * BATCH_SIZE) < rawItems.length;
  const analyzedCount = batchIndex * BATCH_SIZE;
  const nextBatchEnd = Math.min((batchIndex + 1) * BATCH_SIZE, rawItems.length);

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

        {/* Parameter Form - only show when idle or after reset */}
        {step === 'idle' && (
          <div className="mb-3 sm:mb-6">
            <ParameterForm onSubmit={handleScrape} isLoading={false} buttonText="Scrape Items" />
          </div>
        )}

        {/* Scraping State */}
        {step === 'scraping' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-700">Scraping K-Bid auctions...</span>
            </div>
          </div>
        )}

        {/* Scraped State - Ready to analyze */}
        {(step === 'scraped' || step === 'analyzing') && rawItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm sm:text-base text-gray-700">
                  <strong>{rawItems.length}</strong> items scraped
                  {analyzedCount > 0 && (
                    <span className="text-green-600"> | <strong>{summary.totalAnalyzed}</strong> analyzed</span>
                  )}
                </p>
                {hasMoreBatches && (
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Next batch: items {analyzedCount + 1} - {nextBatchEnd}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasMoreBatches && (
                  <button
                    onClick={handleAnalyzeBatch}
                    disabled={step === 'analyzing'}
                    className={`px-4 py-2 rounded font-medium text-white text-sm transition-colors
                      ${step === 'analyzing'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {step === 'analyzing' ? 'Analyzing...' : (
                      analyzedCount === 0 ? 'Analyze First Batch' : 'Analyze Next Batch'
                    )}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  disabled={step === 'analyzing'}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium text-gray-700 text-sm transition-colors"
                >
                  New Search
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {rawItems.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{Math.min(analyzedCount, rawItems.length)} / {rawItems.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(Math.min(analyzedCount, rawItems.length) / rawItems.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analyzing Loading State */}
        {step === 'analyzing' && <LoadingState />}

        {/* Error Display */}
        {error && (
          <ErrorDisplay message={error} onRetry={() => setError(null)} />
        )}

        {/* Results */}
        {analyzedItems.length > 0 && step !== 'analyzing' && (
          <div>
            <div className="flex flex-row justify-between items-center gap-2 mb-3 sm:mb-4">
              <div className="text-xs sm:text-sm text-gray-600">
                <strong>{summary.totalProfitable}</strong> profitable
                <span className="hidden sm:inline"> of {summary.totalAnalyzed} analyzed ({summary.totalScraped} scraped)</span>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-xs sm:text-sm transition-colors"
              >
                Export CSV
              </button>
            </div>
            <ResultsGrid items={analyzedItems} />
          </div>
        )}

        {/* No results message */}
        {analyzedItems.length === 0 && !hasMoreBatches && step === 'scraped' && rawItems.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-800">
            All items have been analyzed. No profitable items found.
          </div>
        )}
      </div>
    </main>
  );
}
