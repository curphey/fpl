import { NextRequest, NextResponse } from 'next/server';
import { fplClient, FPLApiError } from '@/lib/fpl/client';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const managerId = parseInt(id, 10);

    if (isNaN(managerId)) {
      return NextResponse.json(
        { error: 'Invalid manager ID' },
        { status: 400 }
      );
    }

    const data = await fplClient.getManager(managerId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch manager data' },
      { status: 500 }
    );
  }
}
