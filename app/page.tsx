'use client';

import { useState, useEffect } from 'react';
import ParameterForm from '@/components/ParameterForm';
import ResultsGrid from '@/components/ResultsGrid';
import LoadingState from '@/components/LoadingState';
import ErrorDisplay from '@/components/ErrorDisplay';
import Watchlist from '@/components/Watchlist';
import AIChat from '@/components/AIChat';
import { AnalysisParams, AnalysisResponse, RawKBidItem, AnalyzedItem } from '@/lib/types';
import { SCRAPE_CONFIG } from '@/lib/config';
import { WatchlistInsert } from '@/lib/supabase';

const BATCH_SIZE = SCRAPE_CONFIG.batchSize;

type WorkflowStep = 'idle' | 'scraping' | 'scraped' | 'analyzing';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

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

  // Risk filter
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  // Modal states
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Track saved items
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

  // Load saved URLs on mount
  useEffect(() => {
    const loadSavedUrls = async () => {
      try {
        const response = await fetch('/api/watchlist');
        const data = await response.json();
        if (data.success && data.items) {
          setSavedUrls(new Set(data.items.map((item: { auction_url: string }) => item.auction_url)));
        }
      } catch {
        // Ignore errors - just means we can't show which items are already saved
      }
    };
    loadSavedUrls();
  }, []);

  // Save item to watchlist
  const handleSaveItem = async (data: AnalyzedItem) => {
    if (!currentParams) return;

    const watchlistItem: WatchlistInsert = {
      title: data.item.title,
      description: data.item.description,
      category: data.item.category,
      condition: data.item.condition,
      size_class: data.item.sizeClass,
      auction_url: data.item.auctionUrl,
      image_url: data.item.imageUrl,
      auction_end_date: data.item.auctionEndDate,
      saved_bid: data.item.currentBid,
      current_bid: data.item.currentBid,
      max_bid: data.profit.maxBid,
      estimated_value: data.valuation.estimatedValue,
      expected_profit: data.profit.expectedProfit,
      expected_roi: data.profit.expectedROI,
      break_even_price: data.profit.breakEvenPrice,
      shipping_estimate: data.profit.shippingEstimate,
      fees: data.profit.fees,
      valuation_low: data.valuation.lowEstimate,
      valuation_high: data.valuation.highEstimate,
      valuation_confidence: data.valuation.confidence,
      valuation_reasoning: data.valuation.reasoning,
      recommended_channel: data.resale.recommendedChannel,
      risk_score: data.resale.riskScore,
      risk_reasoning: data.resale.riskReasoning,
      resale_tips: data.resale.tips,
      profit_min_dollars: currentParams.profit_min_dollars,
      profit_min_percent: currentParams.profit_min_percent,
      selling_fee_percent: currentParams.selling_fee_percent,
    };

    const response = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchlistItem)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to save item');
    }

    setSavedUrls(prev => new Set([...prev, data.item.auctionUrl]));
  };

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
          end_date: params.end_date,
          single_auction_url: params.single_auction_url
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Server error: ${text.substring(0, 200)}`);
        setStep('idle');
        return;
      }

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
          raw_items: batchItems,
          selected_categories: currentParams.selected_categories
        })
      });

      const text = await response.text();
      let data: AnalysisResponse;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Server error: ${text.substring(0, 200)}`);
        setStep('scraped');
        return;
      }

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
    setRiskFilter('all');
  };

  const isLoading = step === 'scraping' || step === 'analyzing';
  const hasMoreBatches = rawItems.length > 0 && (batchIndex * BATCH_SIZE) < rawItems.length;
  const analyzedCount = batchIndex * BATCH_SIZE;
  const nextBatchEnd = Math.min((batchIndex + 1) * BATCH_SIZE, rawItems.length);

  // Filter items by risk level
  const filteredItems = riskFilter === 'all'
    ? analyzedItems
    : analyzedItems.filter(item => item.resale.riskScore === riskFilter);

  // Count items by risk level
  const riskCounts = {
    all: analyzedItems.length,
    low: analyzedItems.filter(i => i.resale.riskScore === 'low').length,
    medium: analyzedItems.filter(i => i.resale.riskScore === 'medium').length,
    high: analyzedItems.filter(i => i.resale.riskScore === 'high').length,
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-8">
        <header className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              K-Bid Arbitrage
            </h1>
            <p className="text-xs sm:text-base text-gray-600 mt-0.5 sm:mt-1">
              Find profitable auctions with AI valuations
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWatchlist(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="hidden sm:inline">Watchlist</span>
            </button>
            <button
              onClick={() => setShowChat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="hidden sm:inline">AI Chat</span>
            </button>
          </div>
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
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-700 font-medium">Scraping K-Bid auction...</span>
              </div>
              <div className="w-full max-w-md">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Fetching items, extracting bids and images...
                </p>
              </div>
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
        {step === 'analyzing' && (
          <LoadingState
            batchSize={BATCH_SIZE}
            currentBatch={batchIndex + 1}
            totalItems={rawItems.length - (batchIndex * BATCH_SIZE)}
          />
        )}

        {/* Error Display */}
        {error && (
          <ErrorDisplay message={error} onRetry={() => setError(null)} />
        )}

        {/* Results */}
        {analyzedItems.length > 0 && step !== 'analyzing' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
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

            {/* Risk Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs sm:text-sm text-gray-500 self-center mr-1">Risk:</span>
              {(['all', 'low', 'medium', 'high'] as RiskFilter[]).map((level) => {
                const isActive = riskFilter === level;
                const colorClasses = {
                  all: isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  low: isActive ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200',
                  medium: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
                  high: isActive ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200',
                };
                return (
                  <button
                    key={level}
                    onClick={() => setRiskFilter(level)}
                    className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${colorClasses[level]}`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)} ({riskCounts[level]})
                  </button>
                );
              })}
            </div>

            {filteredItems.length > 0 ? (
              <ResultsGrid items={filteredItems} onSave={handleSaveItem} savedUrls={savedUrls} />
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
                No {riskFilter} risk items found.
              </div>
            )}
          </div>
        )}

        {/* No results message */}
        {analyzedItems.length === 0 && !hasMoreBatches && step === 'scraped' && rawItems.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-800">
            All items have been analyzed. No profitable items found.
          </div>
        )}
      </div>

      {/* Modals */}
      {showWatchlist && <Watchlist onClose={() => setShowWatchlist(false)} />}
      {showChat && <AIChat onClose={() => setShowChat(false)} />}
    </main>
  );
}
