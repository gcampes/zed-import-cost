import type { ImportSize } from "./calculator";

interface CacheEntry {
  size: ImportSize;
  timestamp: number;
}

const DEFAULT_MAX_SIZE = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple LRU cache for import size results.
 * Keyed on "packageName::importType::specifiers" to account for tree-shaking differences.
 */
export class SizeCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = DEFAULT_MAX_SIZE, ttlMs = DEFAULT_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  static makeKey(moduleSpecifier: string, importType: string, specifiers: string[]): string {
    return `${moduleSpecifier}::${importType}::${specifiers.sort().join(",")}`;
  }

  get(key: string): ImportSize | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.size;
  }

  set(key: string, size: ImportSize): void {
    // Delete first to update position
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { size, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
