import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeToClose } from "../use-swipe-to-close";

// Mock @use-gesture/react
vi.mock("@use-gesture/react", () => ({
  useDrag: (handler: (state: unknown) => void) => {
    // Return a function that simulates the bind() call
    const bindFn = () => ({
      onPointerDown: () => {
        // Store handler for testing
        (bindFn as unknown as { _handler: typeof handler })._handler = handler;
      },
    });
    (bindFn as unknown as { _handler: typeof handler })._handler = handler;
    return bindFn;
  },
}));

describe("useSwipeToClose", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        onClose: mockOnClose,
      }),
    );

    expect(result.current.offset).toBe(0);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.setRef).toBeDefined();
    expect(result.current.bind).toBeDefined();
  });

  it("returns style object with no transform when offset is 0", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        onClose: mockOnClose,
      }),
    );

    expect(result.current.style.transform).toBeUndefined();
    expect(result.current.style.transition).toBe("transform 0.2s ease-out");
  });

  it("accepts custom threshold", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        threshold: 0.5,
        onClose: mockOnClose,
      }),
    );

    expect(result.current).toBeDefined();
  });

  it("can be disabled", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        enabled: false,
        onClose: mockOnClose,
      }),
    );

    expect(result.current).toBeDefined();
  });

  it("supports right direction", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "right",
        onClose: mockOnClose,
      }),
    );

    expect(result.current).toBeDefined();
  });

  it("provides bind function that returns gesture props", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        onClose: mockOnClose,
      }),
    );

    const bindResult = result.current.bind();
    expect(bindResult).toBeDefined();
  });
});

describe("useSwipeToClose gesture simulation", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers onClose when threshold is exceeded", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        threshold: 0.3,
        enabled: true,
        onClose: mockOnClose,
      }),
    );

    // Get the handler from the mock
    const bind = result.current.bind as unknown as {
      _handler: (state: unknown) => void;
    };
    const handler = bind._handler;

    // Set up ref with mock element using setRef callback
    act(() => {
      result.current.setRef({ offsetWidth: 240 } as HTMLElement);
    });

    // Simulate drag start (finger down)
    act(() => {
      handler({
        down: true,
        movement: [-100, 0],
        velocity: [0.3, 0],
      });
    });

    expect(result.current.isDragging).toBe(true);

    // Simulate drag end with enough distance to close
    act(() => {
      handler({
        down: false,
        movement: [-100, 0],
        velocity: [0.3, 0],
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.offset).toBe(0);
  });

  it("does not trigger onClose when threshold is not exceeded", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        threshold: 0.3,
        enabled: true,
        onClose: mockOnClose,
      }),
    );

    const bind = result.current.bind as unknown as {
      _handler: (state: unknown) => void;
    };
    const handler = bind._handler;

    act(() => {
      result.current.setRef({ offsetWidth: 240 } as HTMLElement);
    });

    // Simulate small drag that doesn't exceed threshold
    act(() => {
      handler({
        down: true,
        movement: [-30, 0],
        velocity: [0.1, 0],
      });
    });

    act(() => {
      handler({
        down: false,
        movement: [-30, 0],
        velocity: [0.1, 0],
      });
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("triggers onClose with high velocity even below threshold", () => {
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        threshold: 0.3,
        enabled: true,
        onClose: mockOnClose,
      }),
    );

    const bind = result.current.bind as unknown as {
      _handler: (state: unknown) => void;
    };
    const handler = bind._handler;

    act(() => {
      result.current.setRef({ offsetWidth: 240 } as HTMLElement);
    });

    // Small distance but high velocity
    act(() => {
      handler({
        down: false,
        movement: [-40, 0],
        velocity: [0.8, 0],
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("cancels gesture when disabled", () => {
    const mockCancel = vi.fn();
    const { result } = renderHook(() =>
      useSwipeToClose({
        direction: "left",
        enabled: false,
        onClose: mockOnClose,
      }),
    );

    const bind = result.current.bind as unknown as {
      _handler: (state: unknown) => void;
    };
    const handler = bind._handler;

    act(() => {
      handler({
        down: true,
        movement: [-100, 0],
        velocity: [0.5, 0],
        cancel: mockCancel,
      });
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
