import { NextRequest, NextResponse } from 'next/server';
import { fplClient, FPLApiError } from '@/lib/fpl/client';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 1 minute during live games

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gw: string }> }
) {
  try {
    const { gw } = await params;
    const gameweek = parseInt(gw, 10);

    if (isNaN(gameweek) || gameweek < 1 || gameweek > 38) {
      return NextResponse.json(
        { error: 'Invalid gameweek (must be 1-38)' },
        { status: 400 }
      );
    }

    const data = await fplClient.getLiveGameweek(gameweek);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch live gameweek data' },
      { status: 500 }
    );
  }
}
