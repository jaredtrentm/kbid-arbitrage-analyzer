export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-blue-600 border-t-transparent mb-3 sm:mb-4"></div>
      <p className="text-gray-600 text-center text-sm sm:text-base">
        Analyzing auctions...
        <br />
        <span className="text-xs sm:text-sm text-gray-500">This may take a minute</span>
      </p>
    </div>
  );
}
