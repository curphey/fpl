"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseEdgeSwipeOptions {
  /** Edge to swipe from */
  edge: "left" | "right";
  /** Width of the edge zone in pixels */
  edgeWidth?: number;
  /** Minimum swipe distance to trigger */
  threshold?: number;
  /** Whether the gesture is enabled */
  enabled?: boolean;
  /** Callback when swipe is triggered */
  onSwipe: () => void;
}

export function useEdgeSwipe({
  edge,
  edgeWidth = 20,
  threshold = 50,
  enabled = true,
  onSwipe,
}: UseEdgeSwipeOptions): void {
  const touchStartRef = useRef<{
    x: number;
    y: number;
    inEdge: boolean;
  } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const screenWidth = window.innerWidth;
      const inEdge =
        edge === "left"
          ? touch.clientX < edgeWidth
          : touch.clientX > screenWidth - edgeWidth;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        inEdge,
      };
    },
    [edge, edgeWidth, enabled],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStartRef.current?.inEdge) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Check if horizontal swipe in the correct direction
      const isCorrectDirection = edge === "left" ? deltaX > 0 : deltaX < 0;

      // Swipe should be more horizontal than vertical
      const isHorizontal = Math.abs(deltaX) > deltaY;

      if (isCorrectDirection && isHorizontal && Math.abs(deltaX) > threshold) {
        onSwipe();
      }

      touchStartRef.current = null;
    },
    [edge, threshold, enabled, onSwipe],
  );

  useEffect(() => {
    if (!enabled) return;

    // Only enable on touch devices
    if (typeof window === "undefined" || !("ontouchstart" in window)) {
      return;
    }

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);
}
