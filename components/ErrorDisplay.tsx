interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorDisplay({ message, onRetry }: Props) {
  return (
    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 text-center">
      <p className="text-red-700 dark:text-red-300 text-sm sm:text-base mb-2 sm:mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-sm transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
