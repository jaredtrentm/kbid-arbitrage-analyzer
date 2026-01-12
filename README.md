# K-Bid Arbitrage Analyzer

AI-powered tool to find profitable arbitrage opportunities on K-Bid auctions.

## Features

- Scrapes K-Bid auctions automatically using Playwright
- AI extracts and categorizes item details
- Web search-based valuations (via Serper API)
- Claude AI analyzes pricing data
- Calculates max bid, profit, and ROI
- Mobile-responsive interface
- CSV export

## Setup

### Prerequisites

- Node.js 18+
- Anthropic API key
- Serper API key (get one at https://serper.dev)

### Installation

```bash
# Clone the repo
git clone <your-repo>
cd kbid-arbitrage-analyzer

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Copy env file and add your keys
cp .env.example .env.local
```

### Environment Variables

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-your-key
SERPER_API_KEY=your-serper-key
```

### Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

**Note:** The Hobby plan has a 60-second function timeout. For full analysis, you may need Vercel Pro (300s timeout).

## Usage

1. Set your parameters:
   - **Min Profit ($)**: Minimum profit per item
   - **Min ROI (%)**: Minimum return on investment
   - **Selling Fees (%)**: Platform fees (eBay ~13%, FB Marketplace ~5%)
   - **Max Items**: Number of items to analyze

2. Click "Run Analysis"

3. Review results sorted by profit potential

4. Click "View" to see the auction on K-Bid

5. Export to CSV for tracking

## How It Works

1. **Scrape**: Playwright visits K-Bid and extracts auction items
2. **Parse**: Claude AI extracts structured data (title, price, category, size)
3. **Valuate**: Serper searches for comparable prices, Claude analyzes results
4. **Calculate**: Computes max bid to achieve target profit/ROI
5. **Advise**: Claude recommends best resale channel and identifies risks

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Scraping**: Playwright with Chromium
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Search**: Serper API (Google Search)
- **Deployment**: Vercel serverless

## Limitations

- K-Bid website structure may change (scraper may need updates)
- Valuations are estimates based on web search results
- Vercel Hobby plan limits function runtime to 60 seconds
- Rate limits apply to Anthropic and Serper APIs

## License

MIT
