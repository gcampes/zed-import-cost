import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SizeCache } from "../cache";

const sampleSize = { moduleSpecifier: "lodash", rawBytes: 1000, gzipBytes: 500 };
const otherSize = { moduleSpecifier: "react", rawBytes: 2000, gzipBytes: 800 };

describe("SizeCache", () => {
  describe("makeKey", () => {
    it("creates a consistent key", () => {
      const key = SizeCache.makeKey("lodash", "named", ["debounce", "throttle"]);
      expect(key).toBe("lodash::named::debounce,throttle");
    });

    it("sorts specifiers for consistency", () => {
      const key1 = SizeCache.makeKey("lodash", "named", ["throttle", "debounce"]);
      const key2 = SizeCache.makeKey("lodash", "named", ["debounce", "throttle"]);
      expect(key1).toBe(key2);
    });

    it("handles empty specifiers", () => {
      const key = SizeCache.makeKey("lodash", "sideEffect", []);
      expect(key).toBe("lodash::sideEffect::");
    });
  });

  describe("get/set", () => {
    it("returns undefined for missing keys", () => {
      const cache = new SizeCache();
      expect(cache.get("missing")).toBeUndefined();
    });

    it("stores and retrieves values", () => {
      const cache = new SizeCache();
      cache.set("key1", sampleSize);
      expect(cache.get("key1")).toEqual(sampleSize);
    });

    it("overwrites existing values", () => {
      const cache = new SizeCache();
      cache.set("key1", sampleSize);
      cache.set("key1", otherSize);
      expect(cache.get("key1")).toEqual(otherSize);
    });
  });

  describe("TTL expiration", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("expires entries after TTL", () => {
      const cache = new SizeCache(100, 1000); // 1s TTL
      cache.set("key1", sampleSize);

      expect(cache.get("key1")).toEqual(sampleSize);

      vi.advanceTimersByTime(1001);

      expect(cache.get("key1")).toBeUndefined();
    });

    it("keeps entries before TTL", () => {
      const cache = new SizeCache(100, 1000);
      cache.set("key1", sampleSize);

      vi.advanceTimersByTime(500);

      expect(cache.get("key1")).toEqual(sampleSize);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when at capacity", () => {
      const cache = new SizeCache(2); // max 2 entries
      cache.set("a", sampleSize);
      cache.set("b", otherSize);
      cache.set("c", { moduleSpecifier: "c", rawBytes: 300, gzipBytes: 100 });

      // "a" should have been evicted
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toEqual(otherSize);
      expect(cache.get("c")).toBeDefined();
    });

    it("accessing an entry refreshes its position", () => {
      const cache = new SizeCache(2);
      cache.set("a", sampleSize);
      cache.set("b", otherSize);

      // Access "a" to refresh it
      cache.get("a");

      // Add "c" — should evict "b" (least recently used), not "a"
      cache.set("c", { moduleSpecifier: "c", rawBytes: 300, gzipBytes: 100 });

      expect(cache.get("a")).toEqual(sampleSize);
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeDefined();
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      const cache = new SizeCache();
      cache.set("a", sampleSize);
      cache.set("b", otherSize);
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });
  });
});
