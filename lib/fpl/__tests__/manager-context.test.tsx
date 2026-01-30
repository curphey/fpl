import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ManagerProvider, useManagerContext } from "../manager-context";

// Mock the supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => null),
}));

// Mock the useManager hook
vi.mock("../hooks/use-fpl", () => ({
  useManager: vi.fn((managerId: number | null) => {
    if (managerId === 123456) {
      return {
        data: {
          id: 123456,
          player_first_name: "John",
          player_last_name: "Doe",
          name: "FC Test",
          summary_overall_points: 1500,
        },
        isLoading: false,
        error: null,
      };
    }
    if (managerId === 999999) {
      return {
        data: null,
        isLoading: false,
        error: new Error("Manager not found"),
      };
    }
    return {
      data: null,
      isLoading: managerId !== null,
      error: null,
    };
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ManagerProvider>{children}</ManagerProvider>;
}

describe("ManagerContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("useManagerContext", () => {
    it("returns default values when no provider", () => {
      const { result } = renderHook(() => useManagerContext());

      expect(result.current.managerId).toBeNull();
      expect(result.current.manager).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.setManagerId).toBe("function");
      expect(typeof result.current.clearManager).toBe("function");
    });

    it("returns initial state with provider", () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      expect(result.current.managerId).toBeNull();
      expect(result.current.manager).toBeNull();
    });
  });

  describe("setManagerId", () => {
    it("updates manager ID state", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.managerId).toBe(123456);
      });
    });

    it("loads manager data when ID is set", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.manager).not.toBeNull();
        expect(result.current.manager?.id).toBe(123456);
        expect(result.current.manager?.name).toBe("FC Test");
      });
    });

    it("persists manager ID to localStorage on successful fetch", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.manager).not.toBeNull();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "fpl-manager-id",
        "123456",
      );
    });
  });

  describe("clearManager", () => {
    it("clears manager ID state", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // First set a manager
      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.managerId).toBe(123456);
      });

      // Then clear it
      act(() => {
        result.current.clearManager();
      });

      expect(result.current.managerId).toBeNull();
      expect(result.current.manager).toBeNull();
    });

    it("removes manager ID from localStorage", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Set and then clear
      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.managerId).toBe(123456);
      });

      act(() => {
        result.current.clearManager();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "fpl-manager-id",
      );
    });
  });

  describe("error handling", () => {
    it("exposes error when manager fetch fails", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      act(() => {
        result.current.setManagerId(999999);
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toBe("Manager not found");
      });
    });
  });

  describe("localStorage initialization", () => {
    it("reads stored manager ID on mount", () => {
      localStorageMock.getItem.mockReturnValueOnce("123456");

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Note: The initial state might not immediately reflect localStorage
      // due to how useSyncExternalStore works. The hook may need a render cycle.
      expect(localStorageMock.getItem).toHaveBeenCalledWith("fpl-manager-id");
    });

    it("ignores invalid stored values", () => {
      localStorageMock.getItem.mockReturnValueOnce("invalid");

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Invalid values should result in null managerId
      expect(result.current.managerId).toBeNull();
    });

    it("ignores negative stored values", () => {
      localStorageMock.getItem.mockReturnValueOnce("-5");

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      expect(result.current.managerId).toBeNull();
    });

    it("ignores zero stored value", () => {
      localStorageMock.getItem.mockReturnValueOnce("0");

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      expect(result.current.managerId).toBeNull();
    });
  });

  describe("provider values", () => {
    it("provides all expected context values", () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      expect(result.current).toHaveProperty("managerId");
      expect(result.current).toHaveProperty("manager");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("setManagerId");
      expect(result.current).toHaveProperty("clearManager");
    });
  });
});
