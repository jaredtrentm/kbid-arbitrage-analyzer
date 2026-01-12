interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorDisplay({ message, onRetry }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
      <p className="text-red-700 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
