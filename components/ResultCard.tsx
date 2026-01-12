'use client';

import { useState } from 'react';
import { AnalyzedItem } from '@/lib/types';

interface Props {
  data: AnalyzedItem;
}

export default function ResultCard({ data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { item, valuation, profit, resale } = data;

  const profitColor = profit.expectedProfit >= 100 ? 'text-green-600' :
                      profit.expectedProfit >= 50 ? 'text-green-500' : 'text-yellow-600';

  const confidenceColor = valuation.confidence === 'high' ? 'bg-green-100 text-green-800' :
                          valuation.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800';

  const riskColor = resale.riskScore === 'low' ? 'bg-green-100 text-green-800' :
                    resale.riskScore === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-800 flex-1 pr-2 line-clamp-2">
            {item.title}
          </h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${confidenceColor}`}>
            {valuation.confidence}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-gray-500">Current Bid:</span>
            <span className="ml-1 font-medium text-gray-900">${item.currentBid.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Max Bid:</span>
            <span className="ml-1 font-medium text-blue-600">${profit.maxBid.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Est. Value:</span>
            <span className="ml-1 font-medium text-gray-900">${valuation.estimatedValue.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Profit:</span>
            <span className={`ml-1 font-bold ${profitColor}`}>
              ${profit.expectedProfit.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ROI:</span>
            <span className={`font-bold ${profitColor}`}>{profit.expectedROI.toFixed(0)}%</span>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${riskColor}`}>
            {resale.riskScore} risk
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors"
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
          {item.auctionUrl && (
            <a
              href={item.auctionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium text-white transition-colors"
            >
              View
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 text-sm">
          <div className="mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Valuation Reasoning</h4>
            <p className="text-gray-600">{valuation.reasoning}</p>
          </div>

          <div className="mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Cost Breakdown</h4>
            <ul className="text-gray-600 space-y-1">
              <li>Shipping Est: ${profit.shippingEstimate}</li>
              <li>Platform Fees: ${profit.fees.toFixed(2)}</li>
              <li>Break-even: ${profit.breakEvenPrice.toFixed(2)}</li>
            </ul>
          </div>

          <div className="mb-3">
            <h4 className="font-medium text-gray-700 mb-1">Resale Recommendation</h4>
            <p className="text-gray-600">
              <strong>{resale.recommendedChannel}</strong> - {resale.riskReasoning}
            </p>
          </div>

          {resale.tips.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Tips</h4>
              <ul className="text-gray-600 list-disc list-inside">
                {resale.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {valuation.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
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
