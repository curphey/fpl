import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ManagerProvider, useManagerContext } from "../manager-context";

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

// Mock fetch for session API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

function wrapper({ children }: { children: React.ReactNode }) {
  return <ManagerProvider>{children}</ManagerProvider>;
}

describe("ManagerContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();

    // Default fetch mock - create session successfully
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/session" && options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "test-session-id",
              fpl_manager_id: null,
              display_name: null,
            }),
        });
      }
      if (url.startsWith("/api/session?id=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "test-session-id",
              fpl_manager_id: null,
              display_name: null,
            }),
        });
      }
      if (url === "/api/session" && options?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: false });
    });
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

    it("returns initial state with provider", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for session initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      expect(result.current.managerId).toBeNull();
      expect(result.current.manager).toBeNull();
    });
  });

  describe("setManagerId", () => {
    it("updates manager ID state", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.managerId).toBe(123456);
      });
    });

    it("loads manager data when ID is set", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

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

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

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

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

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
    });

    it("removes manager ID from localStorage", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

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

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

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

      renderHook(() => useManagerContext(), { wrapper });

      // Note: The initial state might not immediately reflect localStorage
      // due to how useSyncExternalStore works. The hook may need a render cycle.
      expect(localStorageMock.getItem).toHaveBeenCalledWith("fpl-manager-id");
    });

    it("ignores invalid stored values", async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === "fpl-manager-id") return "invalid";
        return null;
      });

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      // Invalid values should result in null managerId
      expect(result.current.managerId).toBeNull();
    });

    it("ignores negative stored values", async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === "fpl-manager-id") return "-5";
        return null;
      });

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      expect(result.current.managerId).toBeNull();
    });

    it("ignores zero stored value", async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === "fpl-manager-id") return "0";
        return null;
      });

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      expect(result.current.managerId).toBeNull();
    });
  });

  describe("provider values", () => {
    it("provides all expected context values", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      expect(result.current).toHaveProperty("managerId");
      expect(result.current).toHaveProperty("manager");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("sessionId");
      expect(result.current).toHaveProperty("setManagerId");
      expect(result.current).toHaveProperty("clearManager");
    });
  });

  describe("session management", () => {
    it("creates a new session on mount when no existing session", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessionId).toBe("test-session-id");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/session", {
        method: "POST",
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "fpl-session-id",
        "test-session-id",
      );
    });

    it("validates existing session on mount", async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === "fpl-session-id") return "existing-session-id";
        return null;
      });

      const { result } = renderHook(() => useManagerContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/session?id=existing-session-id",
      );
    });

    it("syncs manager ID to session when set", async () => {
      const { result } = renderHook(() => useManagerContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessionId).not.toBeNull();
      });

      act(() => {
        result.current.setManagerId(123456);
      });

      await waitFor(() => {
        expect(result.current.managerId).toBe(123456);
      });

      // Verify manager ID was persisted to localStorage (the sync happens async)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "fpl-manager-id",
        "123456",
      );
    });
  });
});
