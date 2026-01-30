"use client";

import { useState } from "react";
import type {
  OptimizeResponse,
  OptimizeError,
  OptimizationType,
  TransferConstraints,
  TeamContext,
} from "@/lib/claude/types";
import { Card, CardContent } from "@/components/ui/card";
import { OptimizeForm } from "@/components/optimize/optimize-form";
import { ThinkingDisplay } from "@/components/optimize/thinking-display";
import { RecommendationsDisplay } from "@/components/optimize/recommendations-display";

export default function OptimizePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: {
    type: OptimizationType;
    query: string;
    constraints: TransferConstraints;
    currentTeam?: TeamContext;
  }) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        const errResponse = json as OptimizeError;
        throw new Error(errResponse.error || "Optimization failed");
      }

      setResult(json as OptimizeResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">AI Optimizer</h1>
        <p className="text-sm text-fpl-muted">
          Powered by Claude with extended thinking for complex FPL decisions
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-4">
          <OptimizeForm onSubmit={handleSubmit} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-fpl-green border-t-transparent" />
              <p className="text-sm text-fpl-muted">
                Claude is analyzing your request...
              </p>
              <p className="text-xs text-fpl-muted">
                Extended thinking may take up to 30 seconds
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-fpl-danger/30 bg-fpl-danger/10 p-4">
          <h3 className="mb-1 font-semibold text-fpl-danger">Error</h3>
          <p className="text-sm text-fpl-danger/80">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <ThinkingDisplay thinking={result.thinking} />
          <RecommendationsDisplay
            type={result.type}
            summary={result.summary}
            recommendations={result.recommendations}
            warnings={result.warnings}
            processingTime={result.processingTime}
          />
        </div>
      )}

      {/* Info card when no results */}
      {!isLoading && !result && !error && (
        <Card>
          <CardContent className="py-8">
            <div className="mx-auto max-w-md text-center">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-fpl-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h3 className="mb-2 font-semibold">How it works</h3>
              <ul className="space-y-2 text-sm text-fpl-muted">
                <li>
                  <strong className="text-foreground">1.</strong> Choose
                  optimization type (transfers, chip timing, or wildcard)
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Describe what
                  you want in natural language
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> Claude
                  analyzes live FPL data with extended thinking
                </li>
                <li>
                  <strong className="text-foreground">4.</strong> Get
                  data-driven recommendations with full reasoning
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
