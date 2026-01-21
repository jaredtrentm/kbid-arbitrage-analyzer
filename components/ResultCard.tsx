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

  const profitColor = profit.expectedProfit >= 100 ? 'text-green-600' :
                      profit.expectedProfit >= 50 ? 'text-green-500' :
                      profit.expectedProfit > 0 ? 'text-yellow-600' : 'text-red-500';

  const confidenceColor = valuation.confidence === 'high' ? 'bg-green-100 text-green-800' :
                          valuation.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800';

  const riskColor = resale.riskScore === 'low' ? 'bg-green-100 text-green-800' :
                    resale.riskScore === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800';

  // Card border color based on meetsCriteria
  const cardBorder = meetsCriteria ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300';

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${cardBorder}`}>
      {/* Image section */}
      {item.imageUrl && !imgError && (
        <div className="relative w-full h-32 sm:h-40 bg-gray-100">
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
              <h3 className="font-semibold text-gray-800 text-sm sm:text-base line-clamp-2">
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
              <p className="text-xs text-orange-600 mt-0.5">
                Closes: {item.auctionEndDate}
              </p>
            )}
          </div>
          <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs font-medium whitespace-nowrap ${confidenceColor}`}>
            {valuation.confidence}
          </span>
        </div>

        {/* Price grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs sm:text-sm mb-2 sm:mb-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Current:</span>
            <span className="font-medium text-gray-900">${item.currentBid.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Max Bid:</span>
            <span className="font-medium text-blue-600">${profit.maxBid.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Value:</span>
            <span className="font-medium text-gray-900">${valuation.estimatedValue.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Profit:</span>
            <span className={`font-bold ${profitColor}`}>${profit.expectedProfit.toFixed(0)}</span>
          </div>
        </div>

        {/* ROI and Risk row */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-500">ROI:</span>
            <span className={`font-bold text-sm sm:text-base ${profitColor}`}>{profit.expectedROI.toFixed(0)}%</span>
          </div>
          <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-xs font-medium ${riskColor}`}>
            {resale.riskScore} risk
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-1.5 sm:py-2 px-2 sm:px-3 bg-gray-100 hover:bg-gray-200 rounded text-xs sm:text-sm font-medium text-gray-700 transition-colors"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded text-xs sm:text-sm font-medium transition-colors
                ${saved
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : saving
                    ? 'bg-gray-300 text-gray-500 cursor-wait'
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
        <div className="border-t border-gray-200 p-3 sm:p-4 bg-gray-50 text-xs sm:text-sm">
          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Valuation</h4>
            <p className="text-gray-600">{valuation.reasoning}</p>
          </div>

          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Costs</h4>
            <div className="text-gray-600 grid grid-cols-2 gap-1">
              <span>Shipping: ${profit.shippingEstimate}</span>
              <span>Fees: ${profit.fees.toFixed(0)}</span>
              <span className="col-span-2">Break-even: ${profit.breakEvenPrice.toFixed(0)}</span>
            </div>
          </div>

          <div className="mb-2 sm:mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Resale</h4>
            <p className="text-gray-600">
              <strong>{resale.recommendedChannel}</strong> - {resale.riskReasoning}
            </p>
          </div>

          {resale.tips.length > 0 && (
            <div className="mb-2 sm:mb-3">
              <h4 className="font-medium text-gray-700 mb-1">Tips</h4>
              <ul className="text-gray-600 list-disc list-inside">
                {resale.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {valuation.sources.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-1">Sources</h4>
              <ul className="text-gray-500 text-xs">
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
