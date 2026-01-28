'use client';

import { useState } from 'react';

export function ThinkingDisplay({ thinking }: { thinking: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinking) return null;

  // Truncate for preview
  const previewLength = 300;
  const isLong = thinking.length > previewLength;
  const preview = isLong ? thinking.slice(0, previewLength) + '...' : thinking;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-purple-light/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-fpl-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-medium text-fpl-muted">
            Claude&apos;s Reasoning
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-fpl-muted transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div className="border-t border-fpl-border px-4 py-3">
        <div className="prose prose-invert prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-xs text-fpl-muted leading-relaxed">
            {isExpanded ? thinking : preview}
          </pre>
        </div>

        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-fpl-green hover:underline"
          >
            {isExpanded ? 'Show less' : 'Show full reasoning'}
          </button>
        )}
      </div>
    </div>
  );
}
