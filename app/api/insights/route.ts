import { NextResponse } from 'next/server';
import { generateMarketInsights } from '@/services/insightGenerator';

export const dynamic = 'force-dynamic';

// GET: Fetch cached insights (or generate if none exist)
export async function GET() {
  try {
    const insights = await generateMarketInsights(false);
    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error('Insights GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// POST: Force refresh insights
export async function POST() {
  try {
    const insights = await generateMarketInsights(true);
    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error('Insights POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
