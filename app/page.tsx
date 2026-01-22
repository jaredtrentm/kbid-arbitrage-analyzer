'use client';

import { useState, useEffect } from 'react';
import ParameterForm from '@/components/ParameterForm';
import ResultsGrid from '@/components/ResultsGrid';
import LoadingState from '@/components/LoadingState';
import ErrorDisplay from '@/components/ErrorDisplay';
import Watchlist from '@/components/Watchlist';
import AIChat from '@/components/AIChat';
import ThemeToggle from '@/components/ThemeToggle';
import Dashboard from '@/components/Dashboard';
import OverpayObservatory from '@/components/OverpayObservatory';
import { AnalysisParams, AnalysisResponse, RawKBidItem, AnalyzedItem } from '@/lib/types';
import { SCRAPE_CONFIG } from '@/lib/config';
import { WatchlistInsert } from '@/lib/supabase';

const BATCH_SIZE = SCRAPE_CONFIG.batchSize;

type AppTab = 'dashboard' | 'analyze' | 'observatory';
type WorkflowStep = 'idle' | 'scraping' | 'scraped' | 'analyzing' | 'adding';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';
type InterestFilter = 'all' | 'low' | 'medium' | 'high';

export default function Home() {
  // Tab state
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [dashboardKey, setDashboardKey] = useState(0);
  const [observatoryKey, setObservatoryKey] = useState(0);

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

  // Interest filter
  const [interestFilter, setInterestFilter] = useState<InterestFilter>('all');

  // Dynamic filter sliders (for results view)
  const [filterMinProfit, setFilterMinProfit] = useState<number>(0);
  const [filterMinROI, setFilterMinROI] = useState<number>(0);

  // Shipping toggle - when off, recalculates assuming local pickup
  const [includeShipping, setIncludeShipping] = useState<boolean>(true);

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

  const handleScrape = async (params: AnalysisParams, appendMode = false) => {
    setStep('scraping');
    setError(null);

    if (!appendMode) {
      // Fresh start - clear everything
      setRawItems([]);
      setAnalyzedItems([]);
      setBatchIndex(0);
      setSummary({ totalScraped: 0, totalAnalyzed: 0, totalProfitable: 0, errors: 0 });
      // Initialize filter sliders from search params
      setFilterMinProfit(params.profit_min_dollars);
      setFilterMinROI(params.profit_min_percent);
    }

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
        setStep(appendMode ? 'scraped' : 'idle');
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to scrape items');
        setStep(appendMode ? 'scraped' : 'idle');
        return;
      }

      if (appendMode) {
        // Append new items to existing, update batch index to point to new items
        const existingCount = rawItems.length;
        setRawItems(prev => [...prev, ...data.items]);
        setBatchIndex(Math.ceil(existingCount / BATCH_SIZE)); // Point to start of new items
        setSummary(prev => ({ ...prev, totalScraped: prev.totalScraped + data.totalCount }));
      } else {
        setRawItems(data.items);
        setSummary(prev => ({ ...prev, totalScraped: data.totalCount }));
      }

      setStep('scraped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape items');
      setStep(appendMode ? 'scraped' : 'idle');
    }
  };

  const handleAddMore = () => {
    setStep('adding');
  };

  const handleScrapeMore = async (params: AnalysisParams) => {
    await handleScrape(params, true);
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
    setInterestFilter('all');
    setFilterMinProfit(0);
    setFilterMinROI(0);
    setIncludeShipping(true);
  };

  const isLoading = step === 'scraping' || step === 'analyzing';
  const hasMoreBatches = rawItems.length > 0 && (batchIndex * BATCH_SIZE) < rawItems.length;
  const analyzedCount = batchIndex * BATCH_SIZE;
  const nextBatchEnd = Math.min((batchIndex + 1) * BATCH_SIZE, rawItems.length);

  // Adjust item values based on shipping toggle and filter
  const filteredItems = analyzedItems
    .map(item => {
      // If shipping is excluded, recalculate profit values
      if (!includeShipping) {
        const shippingSavings = item.profit.shippingEstimate;
        const adjustedProfit = item.profit.expectedProfit + shippingSavings;
        const adjustedMaxBid = item.profit.maxBid + shippingSavings;
        const adjustedROI = adjustedMaxBid > 0 ? (adjustedProfit / adjustedMaxBid) * 100 : 0;
        return {
          ...item,
          profit: {
            ...item.profit,
            expectedProfit: adjustedProfit,
            expectedROI: adjustedROI,
            maxBid: adjustedMaxBid,
            breakEvenPrice: item.profit.breakEvenPrice + shippingSavings,
            shippingEstimate: 0 // Show as 0 when excluded
          }
        };
      }
      return item;
    })
    .filter(item => {
      // Exclude overbid items (current bid > max bid) - these go to Worst Deals
      if (item.item.currentBid > item.profit.maxBid) return false;
      // Risk filter
      if (riskFilter !== 'all' && item.resale.riskScore !== riskFilter) return false;
      // Interest filter
      if (interestFilter !== 'all' && item.item.interestLevel !== interestFilter) return false;
      // Profit filter - use actual profit at current bid
      if (item.profit.actualProfit < filterMinProfit) return false;
      // ROI filter - use actual ROI at current bid
      if (item.profit.actualROI < filterMinROI) return false;
      return true;
    });

  // Count items by risk level
  const riskCounts = {
    all: analyzedItems.length,
    low: analyzedItems.filter(i => i.resale.riskScore === 'low').length,
    medium: analyzedItems.filter(i => i.resale.riskScore === 'medium').length,
    high: analyzedItems.filter(i => i.resale.riskScore === 'high').length,
  };

  // Count items by interest level
  const interestCounts = {
    all: analyzedItems.length,
    low: analyzedItems.filter(i => i.item.interestLevel === 'low').length,
    medium: analyzedItems.filter(i => i.item.interestLevel === 'medium').length,
    high: analyzedItems.filter(i => i.item.interestLevel === 'high').length,
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-8">
        <header className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              K-Bid Arbitrage
            </h1>
            <p className="text-xs sm:text-base text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
              Find profitable auctions with AI valuations
            </p>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
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

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'dashboard' as AppTab, label: 'Dashboard', icon: '📊' },
            { id: 'analyze' as AppTab, label: 'Analyze', icon: '🔍' },
            { id: 'observatory' as AppTab, label: 'Overpay Observatory', icon: '👀' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'dashboard') {
                  setDashboardKey(k => k + 1);
                } else if (tab.id === 'observatory') {
                  setObservatoryKey(k => k + 1);
                }
              }}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="hidden sm:inline mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <Dashboard key={dashboardKey} />
        )}

        {/* Overpay Observatory Tab */}
        {activeTab === 'observatory' && (
          <OverpayObservatory key={observatoryKey} />
        )}

        {/* Analyze Tab - Original Content */}
        {activeTab === 'analyze' && (
          <>
        {/* Parameter Form - show when idle or adding more */}
        {(step === 'idle' || step === 'adding') && (
          <div className="mb-3 sm:mb-6">
            {step === 'adding' && analyzedItems.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>{analyzedItems.length}</strong> items already analyzed. New items will be added to your results.
                </p>
                <button
                  onClick={() => setStep('scraped')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
            <ParameterForm
              onSubmit={step === 'adding' ? handleScrapeMore : handleScrape}
              isLoading={false}
              buttonText={step === 'adding' ? "Add Items" : "Scrape Items"}
            />
          </div>
        )}

        {/* Scraping State */}
        {step === 'scraping' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-700 dark:text-gray-200 font-medium">Scraping K-Bid auction...</span>
              </div>
              <div className="w-full max-w-md">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Fetching items, extracting bids and images...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scraped State - Ready to analyze */}
        {(step === 'scraped' || step === 'analyzing') && rawItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200">
                  <strong>{rawItems.length}</strong> items scraped
                  {analyzedCount > 0 && (
                    <span className="text-green-600 dark:text-green-400"> | <strong>{summary.totalAnalyzed}</strong> analyzed</span>
                  )}
                </p>
                {hasMoreBatches && (
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {step === 'analyzing' ? 'Analyzing...' : (
                      analyzedCount === 0 ? 'Analyze First Batch' : 'Analyze Next Batch'
                    )}
                  </button>
                )}
                {!hasMoreBatches && analyzedItems.length > 0 && (
                  <button
                    onClick={handleAddMore}
                    disabled={step === 'analyzing'}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
                  >
                    + Add More Items
                  </button>
                )}
                <button
                  onClick={handleReset}
                  disabled={step === 'analyzing'}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded font-medium text-gray-700 dark:text-gray-200 text-sm transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {rawItems.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{Math.min(analyzedCount, rawItems.length)} / {rawItems.length}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
        {analyzedItems.length > 0 && step !== 'analyzing' && step !== 'scraping' && (
          <div>
            {/* AI Disclaimer */}
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                AI-generated valuations may be inaccurate. Always verify prices independently before bidding.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <strong>{summary.totalProfitable}</strong> profitable
                <span className="hidden sm:inline"> of {summary.totalAnalyzed} analyzed ({summary.totalScraped} scraped)</span>
                {filteredItems.length !== analyzedItems.length && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">| Showing {filteredItems.length} filtered</span>
                )}
              </div>
              <button
                onClick={handleExportCSV}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-xs sm:text-sm transition-colors"
              >
                Export CSV
              </button>
            </div>

            {/* Filter Sliders */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Min Profit
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={filterMinProfit}
                        onChange={(e) => setFilterMinProfit(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
                        className="w-16 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="1"
                    value={filterMinProfit}
                    onChange={(e) => setFilterMinProfit(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>$0</span>
                    <span>$500</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Min ROI
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={filterMinROI}
                        onChange={(e) => setFilterMinROI(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                        className="w-16 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="1"
                    value={filterMinROI}
                    onChange={(e) => setFilterMinROI(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span>
                    <span>200%</span>
                  </div>
                </div>
              </div>

              {/* Shipping Toggle */}
              <div className="sm:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Include Shipping Costs
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {includeShipping ? 'Calculating with shipping' : 'Local pickup assumed (no shipping)'}
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={includeShipping}
                      onChange={(e) => setIncludeShipping(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Risk Filter */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 self-center mr-1">Risk:</span>
              {(['all', 'low', 'medium', 'high'] as RiskFilter[]).map((level) => {
                const isActive = riskFilter === level;
                const colorClasses = {
                  all: isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                  low: isActive ? 'bg-green-600 text-white' : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900',
                  medium: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900',
                  high: isActive ? 'bg-red-600 text-white' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900',
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

            {/* Interest Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 self-center mr-1">Interest:</span>
              {(['all', 'low', 'medium', 'high'] as InterestFilter[]).map((level) => {
                const isActive = interestFilter === level;
                const labels = {
                  all: 'All',
                  low: '💤 Low',
                  medium: '👀 Medium',
                  high: '🔥 High',
                };
                const colorClasses = {
                  all: isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                  low: isActive ? 'bg-gray-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                  medium: isActive ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900',
                  high: isActive ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900',
                };
                return (
                  <button
                    key={level}
                    onClick={() => setInterestFilter(level)}
                    className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${colorClasses[level]}`}
                  >
                    {labels[level]} ({interestCounts[level]})
                  </button>
                );
              })}
            </div>

            {filteredItems.length > 0 ? (
              <ResultsGrid items={filteredItems} onSave={handleSaveItem} savedUrls={savedUrls} />
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center text-gray-600 dark:text-gray-400">
                No items match your current filters. Try adjusting min profit (${filterMinProfit}) or min ROI ({filterMinROI}%).
              </div>
            )}
          </div>
        )}

        {/* No results message */}
        {analyzedItems.length === 0 && !hasMoreBatches && step === 'scraped' && rawItems.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-800 dark:text-yellow-300">
            <p className="text-center font-medium">No profitable items found in {summary.totalAnalyzed} analyzed items.</p>
            <p className="text-center text-sm mt-2">
              Scraped {rawItems.length} items total. Try adjusting profit thresholds or adding another auction URL.
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <button
                onClick={handleAddMore}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
              >
                + Add More Items
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded font-medium text-gray-700 dark:text-gray-200 text-sm transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Modals */}
      {showWatchlist && <Watchlist onClose={() => setShowWatchlist(false)} />}
      {showChat && <AIChat onClose={() => setShowChat(false)} displayedResults={filteredItems} />}
    </main>
  );
}
