import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test the LRU cache implementation used in the FPL client.
 * We recreate the LRU cache class here to test it in isolation.
 */
class LRUCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(key: string, data: T, ttlMs: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

describe("LRUCache", () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new LRUCache<string>(3); // Small size for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic operations", () => {
    it("stores and retrieves values", () => {
      cache.set("key1", "value1", 60000);
      expect(cache.get("key1")).toBe("value1");
    });

    it("returns null for missing keys", () => {
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("tracks size correctly", () => {
      expect(cache.size).toBe(0);
      cache.set("key1", "value1", 60000);
      expect(cache.size).toBe(1);
      cache.set("key2", "value2", 60000);
      expect(cache.size).toBe(2);
    });

    it("clears all entries", () => {
      cache.set("key1", "value1", 60000);
      cache.set("key2", "value2", 60000);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("key1")).toBeNull();
    });
  });

  describe("TTL expiration", () => {
    it("returns null for expired entries", () => {
      cache.set("key1", "value1", 1000); // 1 second TTL
      expect(cache.get("key1")).toBe("value1");

      // Advance time past TTL
      vi.advanceTimersByTime(1500);
      expect(cache.get("key1")).toBeNull();
    });

    it("removes expired entries from cache on access", () => {
      cache.set("key1", "value1", 1000);
      vi.advanceTimersByTime(1500);

      cache.get("key1"); // This should remove the expired entry
      // Size should decrease (entry was removed)
      expect(cache.size).toBe(0);
    });

    it("keeps non-expired entries", () => {
      cache.set("key1", "value1", 10000);
      vi.advanceTimersByTime(5000);
      expect(cache.get("key1")).toBe("value1");
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when at capacity", () => {
      cache.set("key1", "value1", 60000);
      cache.set("key2", "value2", 60000);
      cache.set("key3", "value3", 60000);
      expect(cache.size).toBe(3);

      // Adding a 4th entry should evict key1 (oldest)
      cache.set("key4", "value4", 60000);
      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("moves accessed entries to end (most recent)", () => {
      cache.set("key1", "value1", 60000);
      cache.set("key2", "value2", 60000);
      cache.set("key3", "value3", 60000);

      // Access key1, making it most recently used
      cache.get("key1");

      // Adding key4 should now evict key2 (oldest after key1 was accessed)
      cache.set("key4", "value4", 60000);
      expect(cache.get("key1")).toBe("value1"); // Still there
      expect(cache.get("key2")).toBeNull(); // Evicted
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("updates position when setting existing key", () => {
      cache.set("key1", "value1", 60000);
      cache.set("key2", "value2", 60000);
      cache.set("key3", "value3", 60000);

      // Update key1 with new value, making it most recent
      cache.set("key1", "updated1", 60000);

      // Adding key4 should evict key2 (oldest after key1 was updated)
      cache.set("key4", "value4", 60000);
      expect(cache.get("key1")).toBe("updated1");
      expect(cache.get("key2")).toBeNull();
    });

    it("does not exceed max size", () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`, 60000);
      }
      expect(cache.size).toBe(3); // Should never exceed maxSize
    });
  });

  describe("edge cases", () => {
    it("handles cache with maxSize of 1", () => {
      const tinyCache = new LRUCache<string>(1);
      tinyCache.set("key1", "value1", 60000);
      expect(tinyCache.get("key1")).toBe("value1");

      tinyCache.set("key2", "value2", 60000);
      expect(tinyCache.get("key1")).toBeNull();
      expect(tinyCache.get("key2")).toBe("value2");
      expect(tinyCache.size).toBe(1);
    });

    it("handles updating same key multiple times", () => {
      cache.set("key1", "v1", 60000);
      cache.set("key1", "v2", 60000);
      cache.set("key1", "v3", 60000);
      expect(cache.get("key1")).toBe("v3");
      expect(cache.size).toBe(1);
    });

    it("handles mixed operations", () => {
      cache.set("a", "1", 60000);
      cache.set("b", "2", 60000);
      expect(cache.get("a")).toBe("1");
      cache.set("c", "3", 60000);
      cache.set("d", "4", 60000); // Should evict 'b'
      expect(cache.get("b")).toBeNull();
      expect(cache.get("a")).toBe("1");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });
  });
});
