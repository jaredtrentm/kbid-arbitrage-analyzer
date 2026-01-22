'use client';

import { useState } from 'react';
import { AnalyzedItem } from '@/lib/types';

interface Props {
  data: AnalyzedItem;
  onSave?: (data: AnalyzedItem) => Promise<void>;
  isSaved?: boolean;
}

export default function ResultCard({ data, onSave, isSaved = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const { item, valuation, profit, resale, meetsCriteria } = data;

  const handleSave = async () => {
    if (!onSave || saving || saved) return;
    setSaving(true);
    try {
      await onSave(data);
      setSaved(true);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  // Use actual profit (at current bid) for color coding
  const actualProfitColor = profit.actualProfit >= 100 ? 'text-green-600 dark:text-green-400' :
                            profit.actualProfit >= 50 ? 'text-green-500 dark:text-green-400' :
                            profit.actualProfit > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';

  // Is current bid already over max bid?
  const isOverbid = item.currentBid > profit.maxBid;

  const riskColor = resale.riskScore === 'low' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                    resale.riskScore === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' :
                    'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';

  const interestColor = item.interestLevel === 'high' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300' :
                        item.interestLevel === 'medium' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  // Card border color based on meetsCriteria
  const cardBorder = meetsCriteria ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300 dark:border-l-gray-600';

  // Determine quickTake sentiment based on keywords
  const getQuickTakeSentiment = (text?: string): 'positive' | 'negative' | 'neutral' => {
    if (!text) return 'neutral';
    const lower = text.toLowerCase();
    const positiveWords = ['strong', 'good', 'great', 'excellent', 'flip', 'profit', 'demand', 'hot', 'buy', 'recommend', 'opportunity'];
    const negativeWords = ['skip', 'avoid', 'pass', 'overpriced', 'risky', 'low demand', 'saturated', 'difficult', 'loss'];
    if (positiveWords.some(word => lower.includes(word))) return 'positive';
    if (negativeWords.some(word => lower.includes(word))) return 'negative';
    return 'neutral';
  };

  const quickTakeSentiment = getQuickTakeSentiment(resale.quickTake);
  const quickTakeColor = quickTakeSentiment === 'positive' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' :
                         quickTakeSentiment === 'negative' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' :
                         'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${cardBorder}`}>
      {/* Image section */}
      {item.imageUrl && !imgError && (
        <div className="relative w-full h-32 sm:h-40 bg-gray-100 dark:bg-gray-700">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-3 sm:p-4">
        {/* Title row with shipping indicator */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base line-clamp-2">
                {item.title}
              </h3>
              {item.shippingAvailable && (
                <span className="text-green-500 flex-shrink-0" title="Shipping Available">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
            {/* Closing time */}
            {item.auctionEndDate && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                Closes: {item.auctionEndDate}
              </p>
            )}
          </div>
        </div>

        {/* Quick Take */}
        {resale.quickTake && (
          <div className={`px-2 py-1.5 rounded text-xs sm:text-sm mb-2 ${quickTakeColor}`}>
            <span className="font-medium">AI:</span> {resale.quickTake}
          </div>
        )}

        {/* Price grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs sm:text-sm mb-2 sm:mb-3">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Current:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">${item.currentBid.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Max Bid:</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">${profit.maxBid.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Value:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">${valuation.estimatedValue.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Profit:</span>
            <span className={`font-bold ${actualProfitColor}`}>${profit.actualProfit.toFixed(0)}</span>
          </div>
        </div>

        {/* ROI row - show both actual and target */}
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">ROI:</span>
            <span className={`font-bold text-sm sm:text-base ${actualProfitColor}`} title="ROI at current bid">
              {profit.actualROI.toFixed(0)}%
            </span>
            {!isOverbid && (
              <span className="text-xs text-gray-400 dark:text-gray-500" title="Target ROI at max bid">
                ({profit.expectedROI.toFixed(0)}% @max)
              </span>
            )}
            {isOverbid && (
              <span className="text-xs text-red-500 dark:text-red-400 font-medium">
                OVERBID
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {item.interestLevel && (
              <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs font-medium ${interestColor}`}>
                {item.interestLevel === 'high' ? '🔥' : item.interestLevel === 'medium' ? '👀' : '💤'}
              </span>
            )}
            <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs font-medium ${riskColor}`}>
              {resale.riskScore} risk
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-1.5 sm:py-2 px-2 sm:px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded text-xs sm:text-sm font-medium transition-colors
                ${saved
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 cursor-default'
                  : saving
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-wait'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
            >
              {saved ? 'Saved' : saving ? '...' : 'Save'}
            </button>
          )}
          {item.auctionUrl && (
            <a
              href={item.auctionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 sm:py-2 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm font-medium text-white transition-colors"
            >
              View
            </a>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 text-xs sm:text-sm">
          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Valuation</h4>
            <p className="text-gray-600 dark:text-gray-400">{valuation.reasoning}</p>
          </div>

          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Costs</h4>
            <div className="text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-1">
              <span>Shipping: ${profit.shippingEstimate}</span>
              <span>Fees (platform): ${profit.fees.toFixed(0)}</span>
              <span className="col-span-2">Break-even: ${profit.breakEvenPrice.toFixed(0)}</span>
            </div>
          </div>

          {(item.bidCount !== undefined || item.bidderCount !== undefined) && (
            <div className="mb-2 sm:mb-3">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Bid Activity</h4>
              <div className="text-gray-600 dark:text-gray-400 flex items-center gap-3">
                {item.bidCount !== undefined && <span>{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>}
                {item.bidderCount !== undefined && <span>{item.bidderCount} bidder{item.bidderCount !== 1 ? 's' : ''}</span>}
                {item.interestLevel && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${interestColor}`}>
                    {item.interestLevel} interest
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Resale</h4>
            <p className="text-gray-600 dark:text-gray-400">
              <strong>{resale.recommendedChannel}</strong> - {resale.riskReasoning}
            </p>
          </div>

          {resale.tips.length > 0 && (
            <div className="mb-2 sm:mb-3">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Tips</h4>
              <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside">
                {resale.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {valuation.sources.length > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Sources</h4>
              <ul className="text-gray-500 dark:text-gray-500 text-xs">
                {valuation.sources.map((source, i) => (
                  <li key={i} className="truncate">{source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
