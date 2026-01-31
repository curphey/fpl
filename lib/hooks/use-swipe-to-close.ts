"use client";

import { useRef, useState, useCallback } from "react";
import { useDrag } from "@use-gesture/react";

interface UseSwipeToCloseOptions {
  /** Direction to swipe to close */
  direction: "left" | "right";
  /** Threshold percentage (0-1) of element width to trigger close */
  threshold?: number;
  /** Whether the gesture is enabled */
  enabled?: boolean;
  /** Callback when close is triggered */
  onClose: () => void;
}

interface UseSwipeToCloseReturn {
  /** Ref callback to attach to the swipeable element */
  setRef: (node: HTMLElement | null) => void;
  /** Bind props to attach to the swipeable element */
  bind: ReturnType<typeof useDrag>;
  /** Current drag offset in pixels */
  offset: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Style object for transform */
  style: React.CSSProperties;
}

export function useSwipeToClose({
  direction,
  threshold = 0.3,
  enabled = true,
  onClose,
}: UseSwipeToCloseOptions): UseSwipeToCloseReturn {
  const elementRef = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Ref callback for setting the element reference
  const setRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], cancel }) => {
      if (!enabled) {
        cancel?.();
        return;
      }

      const elementWidth = elementRef.current?.offsetWidth || 240;

      // For left direction: negative movement closes
      // For right direction: positive movement closes
      const isClosingDirection = direction === "left" ? mx < 0 : mx > 0;
      const absMovement = Math.abs(mx);
      const absVelocity = Math.abs(vx);

      if (down) {
        setIsDragging(true);
        // Only allow movement in the closing direction
        if (isClosingDirection) {
          // Clamp to element width
          const clampedOffset = Math.max(-elementWidth, Math.min(0, mx));
          setOffset(direction === "left" ? clampedOffset : -clampedOffset);
        } else {
          // Allow small overscroll with resistance
          setOffset(mx * 0.2);
        }
      } else {
        setIsDragging(false);

        // Check if should close based on distance or velocity
        const shouldClose =
          isClosingDirection &&
          (absMovement > elementWidth * threshold || absVelocity > 0.5);

        if (shouldClose) {
          onClose();
        }

        // Reset offset
        setOffset(0);
      }
    },
    {
      axis: "x",
      filterTaps: true,
      pointer: { touch: true },
    },
  );

  // Calculate transform based on offset
  const getTransform = useCallback(() => {
    if (offset === 0) return undefined;
    return `translateX(${offset}px)`;
  }, [offset]);

  const style: React.CSSProperties = {
    transform: getTransform(),
    transition: isDragging ? "none" : "transform 0.2s ease-out",
  };

  return {
    setRef,
    bind,
    offset,
    isDragging,
    style,
  };
}
