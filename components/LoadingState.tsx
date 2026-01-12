export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
      <p className="text-gray-600 text-center">
        Analyzing K-Bid auctions...
        <br />
        <span className="text-sm text-gray-500">This may take a few minutes</span>
      </p>
    </div>
  );
}
