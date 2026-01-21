interface Props {
  batchSize?: number;
  currentBatch?: number;
  totalItems?: number;
}

export default function LoadingState({ batchSize = 50, currentBatch = 1, totalItems }: Props) {
  const stages = [
    'Extracting item details with AI...',
    'Searching web for comparable prices...',
    'Calculating profit margins...',
    'Getting resale recommendations...'
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4">
      <div className="flex flex-col items-center justify-center py-4">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
        <p className="text-gray-700 dark:text-gray-200 font-medium text-center text-sm sm:text-base mb-2">
          Analyzing batch {currentBatch}
          {totalItems && ` (up to ${Math.min(batchSize, totalItems)} items)`}
        </p>
        <div className="w-full max-w-sm space-y-2 mt-2">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
              {stage}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Each item requires AI analysis + web search. This typically takes 2-4 minutes per batch.
        </p>
      </div>
    </div>
  );
}
