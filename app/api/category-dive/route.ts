import { NextRequest, NextResponse } from 'next/server';
import { getCategoryDeepDive } from '@/services/categoryAnalyzer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category parameter is required' },
        { status: 400 }
      );
    }

    const analysis = await getCategoryDeepDive(category);
    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    console.error('Category dive error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze category' },
      { status: 500 }
    );
  }
}
