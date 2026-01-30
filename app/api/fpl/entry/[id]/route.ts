import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { managerIdSchema, validationErrorResponse } from "@/lib/api/validation";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate manager ID with Zod
    const parseResult = managerIdSchema.safeParse(id);
    if (!parseResult.success) {
      return NextResponse.json(validationErrorResponse(parseResult.error), {
        status: 400,
      });
    }
    const managerId = parseResult.data;

    const data = await fplClient.getManager(managerId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch manager data" },
      { status: 500 },
    );
  }
}
