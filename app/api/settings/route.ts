import { NextRequest, NextResponse } from "next/server";
import {
  getAnthropicApiKey,
  setAnthropicApiKey,
  hasAnthropicApiKey,
} from "@/lib/db/settings";

/**
 * GET /api/settings
 *
 * Returns current settings status (not the actual values for security)
 */
export async function GET() {
  return NextResponse.json({
    hasAnthropicApiKey: hasAnthropicApiKey(),
  });
}

/**
 * POST /api/settings
 *
 * Update settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anthropicApiKey } = body;

    if (anthropicApiKey !== undefined) {
      // Validate the key format
      if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-")) {
        return NextResponse.json(
          { error: "Invalid API key format. Key should start with 'sk-ant-'" },
          { status: 400 },
        );
      }

      // Test the key by making a simple API call
      if (anthropicApiKey) {
        try {
          const response = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicApiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 10,
                messages: [{ role: "user", content: "Hi" }],
              }),
            },
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return NextResponse.json(
              {
                error:
                  error.error?.message ||
                  "Invalid API key. Please check your key and try again.",
              },
              { status: 400 },
            );
          }
        } catch {
          return NextResponse.json(
            { error: "Failed to validate API key. Please try again." },
            { status: 400 },
          );
        }
      }

      setAnthropicApiKey(anthropicApiKey || null);
    }

    return NextResponse.json({
      success: true,
      hasAnthropicApiKey: hasAnthropicApiKey(),
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/settings
 *
 * Clear the API key
 */
export async function DELETE() {
  setAnthropicApiKey(null);
  return NextResponse.json({
    success: true,
    hasAnthropicApiKey: hasAnthropicApiKey(),
  });
}
