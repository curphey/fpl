import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEdgeSwipe } from "../use-edge-swipe";

describe("useEdgeSwipe", () => {
  const mockOnSwipe = vi.fn();
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  const listeners: Map<string, EventListener> = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();

    // Mock touch device
    Object.defineProperty(window, "ontouchstart", {
      value: () => {},
      configurable: true,
    });

    Object.defineProperty(window, "innerWidth", {
      value: 375,
      configurable: true,
    });

    addEventListenerSpy = vi
      .spyOn(document, "addEventListener")
      .mockImplementation(
        (type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.set(type, listener as EventListener);
        },
      );

    removeEventListenerSpy = vi
      .spyOn(document, "removeEventListener")
      .mockImplementation((type: string) => {
        listeners.delete(type);
      });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    delete (window as { ontouchstart?: unknown }).ontouchstart;
  });

  it("adds event listeners on mount when enabled", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        onSwipe: mockOnSwipe,
      }),
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "touchstart",
      expect.any(Function),
      { passive: true },
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "touchend",
      expect.any(Function),
      { passive: true },
    );
  });

  it("removes event listeners on unmount", () => {
    const { unmount } = renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        onSwipe: mockOnSwipe,
      }),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "touchstart",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "touchend",
      expect.any(Function),
    );
  });

  it("does not add listeners when disabled", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        enabled: false,
        onSwipe: mockOnSwipe,
      }),
    );

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it("triggers onSwipe when swiping from left edge", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    expect(touchStartHandler).toBeDefined();
    expect(touchEndHandler).toBeDefined();

    // Simulate touch start near left edge
    touchStartHandler!({
      touches: [{ clientX: 10, clientY: 100 }],
    } as unknown as TouchEvent);

    // Simulate touch end with swipe to the right
    touchEndHandler!({
      changedTouches: [{ clientX: 80, clientY: 105 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).toHaveBeenCalled();
  });

  it("does not trigger onSwipe when not starting from edge", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    // Touch starts far from left edge
    touchStartHandler!({
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as TouchEvent);

    touchEndHandler!({
      changedTouches: [{ clientX: 200, clientY: 100 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).not.toHaveBeenCalled();
  });

  it("does not trigger onSwipe when swipe is below threshold", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    touchStartHandler!({
      touches: [{ clientX: 10, clientY: 100 }],
    } as unknown as TouchEvent);

    // Small swipe that doesn't meet threshold
    touchEndHandler!({
      changedTouches: [{ clientX: 30, clientY: 100 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).not.toHaveBeenCalled();
  });

  it("does not trigger onSwipe when swipe direction is wrong", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    touchStartHandler!({
      touches: [{ clientX: 10, clientY: 100 }],
    } as unknown as TouchEvent);

    // Swipe to the left (wrong direction for left edge)
    touchEndHandler!({
      changedTouches: [{ clientX: -50, clientY: 100 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).not.toHaveBeenCalled();
  });

  it("does not trigger onSwipe when swipe is more vertical than horizontal", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    touchStartHandler!({
      touches: [{ clientX: 10, clientY: 100 }],
    } as unknown as TouchEvent);

    // Mostly vertical movement
    touchEndHandler!({
      changedTouches: [{ clientX: 70, clientY: 250 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).not.toHaveBeenCalled();
  });

  it("works for right edge", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "right",
        edgeWidth: 20,
        threshold: 50,
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    // Touch starts near right edge (375 - 20 = 355)
    touchStartHandler!({
      touches: [{ clientX: 365, clientY: 100 }],
    } as unknown as TouchEvent);

    // Swipe to the left
    touchEndHandler!({
      changedTouches: [{ clientX: 300, clientY: 100 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).toHaveBeenCalled();
  });

  it("handles missing touch data gracefully", () => {
    renderHook(() =>
      useEdgeSwipe({
        edge: "left",
        onSwipe: mockOnSwipe,
      }),
    );

    const touchStartHandler = listeners.get("touchstart");
    const touchEndHandler = listeners.get("touchend");

    // Touch start with no touches
    touchStartHandler!({
      touches: [],
    } as unknown as TouchEvent);

    touchEndHandler!({
      changedTouches: [{ clientX: 80, clientY: 100 }],
    } as unknown as TouchEvent);

    expect(mockOnSwipe).not.toHaveBeenCalled();
  });

  it("updates listeners when enabled changes", () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useEdgeSwipe({
          edge: "left",
          enabled,
          onSwipe: mockOnSwipe,
        }),
      { initialProps: { enabled: true } },
    );

    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

    rerender({ enabled: false });

    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});
