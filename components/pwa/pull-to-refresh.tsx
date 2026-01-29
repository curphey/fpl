"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start if at top of scroll
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      if (startY.current === 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0 && containerRef.current?.scrollTop === 0) {
        // Apply resistance to the pull
        const resistance = 0.4;
        setPullDistance(Math.min(diff * resistance, threshold * 1.5));
      }
    },
    [isRefreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    startY.current = 0;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const showIndicator = pullDistance > 10 || isRefreshing;
  const indicatorOpacity = Math.min(pullDistance / threshold, 1);
  const indicatorRotation = isRefreshing ? 0 : (pullDistance / threshold) * 180;

  return (
    <div
      ref={containerRef}
      className="relative min-h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center"
          style={{
            top: Math.max(pullDistance - 40, 8),
            opacity: indicatorOpacity,
          }}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-fpl-card shadow-lg ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${indicatorRotation}deg)`,
            }}
          >
            <svg
              className="h-5 w-5 text-fpl-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {isRefreshing ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              )}
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
