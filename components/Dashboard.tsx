'use client';

import { useState, useEffect } from 'react';

interface DashboardStats {
  totalAnalyzed: number;
  totalProfitable: number;
  totalOverbid: number;
  avgOverpayPercent: number;
  totalPotentialProfit: number;
  recentActivity: RecentActivityItem[];
  categoryPerformance: CategoryPerformance[];
}

interface RecentActivityItem {
  id: string;
  title: string;
  category: string;
  current_bid: number;
  estimated_value: number;
  actual_profit: number;
  is_overbid: boolean;
  is_profitable: boolean;
  created_at: string;
  auction_url: string;
}

interface CategoryPerformance {
  category: string;
  total_analyzed: number;
  total_profitable: number;
  total_overbid: number;
  avg_overpay_percent: number;
  avg_profit: number;
  opportunity_score: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analytics/dashboard');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Data Yet</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Run an auction analysis to start building your market intelligence.
        </p>
      </div>
    );
  }

  const hasData = stats.totalAnalyzed > 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          title="Auctions Analyzed"
          value={stats.totalAnalyzed}
          icon="chart"
          color="blue"
        />
        <StatCard
          title="Best Deals Found"
          value={stats.totalProfitable}
          icon="check"
          color="green"
        />
        <StatCard
          title="Worst Deals Logged"
          value={stats.totalOverbid}
          icon="alert"
          color="red"
        />
        <StatCard
          title="Avg Overpay"
          value={`${stats.avgOverpayPercent.toFixed(0)}%`}
          icon="trending"
          color="orange"
        />
        <StatCard
          title="Potential Profit"
          value={`$${stats.totalPotentialProfit.toFixed(0)}`}
          icon="dollar"
          color="emerald"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Recent Activity
          </h3>
          {hasData && stats.recentActivity.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stats.recentActivity.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No recent activity. Analyze some auctions to see activity here.
            </p>
          )}
        </div>

        {/* Category Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Category Opportunities
          </h3>
          {hasData && stats.categoryPerformance.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stats.categoryPerformance.map((cat) => (
                <CategoryBar key={cat.category} category={cat} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No category data yet. Analyze auctions to build insights.
            </p>
          )}
        </div>
      </div>

      {/* AI Insights Placeholder */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-600 dark:text-purple-400 text-xl">AI</span>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Market Insights
          </h3>
        </div>
        {hasData ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {stats.totalOverbid > stats.totalProfitable
              ? `Buyers are currently overpaying more often than finding deals. Consider listing items now - the market is hot.`
              : stats.totalProfitable > 0
              ? `Found ${stats.totalProfitable} profitable opportunities. Best categories for flipping: ${stats.categoryPerformance.slice(0, 2).map(c => c.category).join(', ') || 'analyzing...'}`
              : 'Continue analyzing auctions to generate market insights.'}
          </p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Analyze auctions to generate AI-powered market insights.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className={`rounded-lg p-3 sm:p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-xs sm:text-sm opacity-80">{title}</p>
      <p className="text-lg sm:text-2xl font-bold">{value}</p>
    </div>
  );
}

function ActivityItem({ item }: { item: RecentActivityItem }) {
  const isGood = item.is_profitable;
  const isBad = item.is_overbid;

  return (
    <a
      href={item.auction_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {item.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.category} • ${item.current_bid}
          </p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
          isGood
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
            : isBad
            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
          {isGood ? `+$${item.actual_profit.toFixed(0)}` : isBad ? 'Overbid' : 'Neutral'}
        </div>
      </div>
    </a>
  );
}

function CategoryBar({ category }: { category: CategoryPerformance }) {
  // Opportunity score ranges from -100 to 100
  // Positive = more profitable items, negative = more overbid items
  const score = category.opportunity_score;
  const isPositive = score >= 0;
  const barWidth = Math.min(Math.abs(score), 100);

  return (
    <div className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {category.category}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {category.total_analyzed} analyzed
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isPositive ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-green-600 dark:text-green-400">
          {category.total_profitable} deals
        </span>
        <span className="text-red-600 dark:text-red-400">
          {category.total_overbid} overbids
        </span>
      </div>
    </div>
  );
}
