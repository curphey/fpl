import { NextResponse } from 'next/server';
import { fplClient, FPLApiError } from '@/lib/fpl/client';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const data = await fplClient.getBootstrapStatic();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch bootstrap data' },
      { status: 500 }
    );
  }
}
