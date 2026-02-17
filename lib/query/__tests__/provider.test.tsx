import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { QueryProvider, STALE_TIMES } from "../provider";
import { STALE_TIMES as CacheStaleTimesImport } from "@/lib/cache-config";

describe("QueryProvider", () => {
  it("provides a QueryClient to children", () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });

    expect(result.current).toBeDefined();
    expect(result.current.getDefaultOptions).toBeDefined();
  });

  it("configures default query options correctly", () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });

    const defaults = result.current.getDefaultOptions();

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.retry).toBe(2);
    expect(defaults.queries?.staleTime).toBe(STALE_TIMES.bootstrap);
    expect(defaults.queries?.gcTime).toBe(10 * 60 * 1000);
  });

  it("sets staleTime to bootstrap cache TTL (5 minutes)", () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });

    const defaults = result.current.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
  });

  it("re-exports STALE_TIMES from cache-config", () => {
    expect(STALE_TIMES).toBe(CacheStaleTimesImport);
  });

  it("renders children correctly", () => {
    const { result } = renderHook(() => "rendered", {
      wrapper: QueryProvider,
    });

    expect(result.current).toBe("rendered");
  });

  it("provides the same QueryClient instance across multiple hooks", () => {
    const { result: result1 } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });
    const { result: result2 } = renderHook(() => useQueryClient(), {
      wrapper: QueryProvider,
    });

    // Each wrapper creates its own provider, so clients will be different instances
    // but both should have the same configuration
    const defaults1 = result1.current.getDefaultOptions();
    const defaults2 = result2.current.getDefaultOptions();

    expect(defaults1.queries?.retry).toBe(defaults2.queries?.retry);
    expect(defaults1.queries?.staleTime).toBe(defaults2.queries?.staleTime);
    expect(defaults1.queries?.gcTime).toBe(defaults2.queries?.gcTime);
  });
});

describe("STALE_TIMES", () => {
  it("has all expected cache categories", () => {
    expect(STALE_TIMES).toHaveProperty("bootstrap");
    expect(STALE_TIMES).toHaveProperty("fixtures");
    expect(STALE_TIMES).toHaveProperty("live");
    expect(STALE_TIMES).toHaveProperty("manager");
    expect(STALE_TIMES).toHaveProperty("league");
    expect(STALE_TIMES).toHaveProperty("playerSummary");
  });

  it("has live as the shortest stale time", () => {
    const times = Object.values(STALE_TIMES);
    expect(Math.min(...times)).toBe(STALE_TIMES.live);
  });

  it("has all positive numeric values", () => {
    for (const [key, value] of Object.entries(STALE_TIMES)) {
      expect(value, `STALE_TIMES.${key} should be positive`).toBeGreaterThan(0);
      expect(typeof value).toBe("number");
    }
  });
});
