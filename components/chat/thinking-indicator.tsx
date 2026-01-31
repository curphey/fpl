"use client";

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-fpl-muted">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-fpl-muted [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-fpl-muted [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-fpl-muted" />
      </div>
      <span className="text-xs">Analyzing...</span>
    </div>
  );
}
