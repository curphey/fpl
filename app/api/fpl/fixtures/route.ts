import { NextRequest, NextResponse } from 'next/server';
import { fplClient, FPLApiError } from '@/lib/fpl/client';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const event = searchParams.get('event');

    let data;
    if (event) {
      data = await fplClient.getFixturesByGameweek(parseInt(event, 10));
    } else {
      data = await fplClient.getFixtures();
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
