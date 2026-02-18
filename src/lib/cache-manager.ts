import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CacheEntry, CacheConfig } from '@/lib/types';

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_CONFIG: CacheConfig = {
  defaultTtl: 3600000, // 1 hour
  maxEntries: 500,
  dbName: 'gitted-cache',
  storeName: 'cache-entries',
  version: 1,
};

// TTL presets following Rule 11
export const CACHE_TTL = {
  COMMITS: 86400000,       // 24 hours (incremental fetching corrects stale data)
  ANALYTICS: 86400000,     // 24 hours
  STORIES: 86400000,       // 24 hours
  REPOS: 3600000,          // 1 hour
  DEFAULT: 3600000,        // 1 hour
} as const;

// =============================================================================
// IndexedDB Schema
// =============================================================================

interface GittedCacheDB extends DBSchema {
  'cache-entries': {
    key: string;
    value: CacheEntry;
    indexes: {
      'by-expiry': number;
    };
  };
}

// =============================================================================
// Singleton DB Instance
// =============================================================================

let dbInstance: IDBPDatabase<GittedCacheDB> | null = null;
let dbInitPromise: Promise<IDBPDatabase<GittedCacheDB>> | null = null;

async function getDB(): Promise<IDBPDatabase<GittedCacheDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = openDB<GittedCacheDB>(CACHE_CONFIG.dbName, CACHE_CONFIG.version, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cache-entries')) {
        const store = db.createObjectStore('cache-entries', { keyPath: 'key' });
        store.createIndex('by-expiry', 'expiresAt');
      }
    },
    blocked() {
      console.warn('[CacheManager] Database upgrade blocked by another tab');
    },
    blocking() {
      console.warn('[CacheManager] This tab is blocking a database upgrade');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.warn('[CacheManager] Database connection terminated unexpectedly');
      dbInstance = null;
      dbInitPromise = null;
    },
  });

  dbInstance = await dbInitPromise;
  dbInitPromise = null;

  return dbInstance;
}

// =============================================================================
// Cache Manager Functions
// =============================================================================

/**
 * Retrieve a cached value by key.
 * Returns null if the key doesn't exist or the entry has expired.
 * Automatically cleans up expired entries on access.
 */
export async function get<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = await db.get('cache-entries', key);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    // Check if entry has expired
    if (now > entry.expiresAt) {
      // Clean up expired entry asynchronously
      db.delete('cache-entries', key).catch((err) => {
        console.warn(`[CacheManager] Failed to delete expired key "${key}":`, err);
      });
      return null;
    }

    return entry.data as T;
  } catch (error) {
    console.error(`[CacheManager] Error reading key "${key}":`, error);
    return null;
  }
}

/**
 * Store a value in the cache with a TTL (time-to-live) in milliseconds.
 * If no TTL is provided, the default TTL from config is used.
 */
export async function set<T = unknown>(
  key: string,
  data: T,
  ttl: number = CACHE_CONFIG.defaultTtl
): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: now,
      ttl,
      expiresAt: now + ttl,
      version: CACHE_CONFIG.version,
    };

    await db.put('cache-entries', entry as CacheEntry);

    // Trigger cleanup if we're potentially over the max entries limit
    // Do this asynchronously to not block the set operation
    scheduleCleanup();
  } catch (error) {
    console.error(`[CacheManager] Error writing key "${key}":`, error);
  }
}

/**
 * Check if a key exists in the cache and is not expired.
 */
export async function has(key: string): Promise<boolean> {
  try {
    const db = await getDB();
    const entry = await db.get('cache-entries', key);

    if (!entry) {
      return false;
    }

    const now = Date.now();

    if (now > entry.expiresAt) {
      // Clean up expired entry
      db.delete('cache-entries', key).catch((err) => {
        console.warn(`[CacheManager] Failed to delete expired key "${key}":`, err);
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[CacheManager] Error checking key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all entries from the cache.
 */
export async function clear(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('cache-entries');
  } catch (error) {
    console.error('[CacheManager] Error clearing cache:', error);
  }
}

/**
 * Clear all entries whose keys start with the given prefix.
 * Useful for invalidating groups of related cache entries,
 * e.g., clearByPrefix('commits:') to clear all commit caches.
 */
export async function clearByPrefix(prefix: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('cache-entries', 'readwrite');
    const store = tx.objectStore('cache-entries');

    let cursor = await store.openCursor();
    const keysToDelete: string[] = [];

    while (cursor) {
      if (cursor.key.startsWith(prefix)) {
        keysToDelete.push(cursor.key);
      }
      cursor = await cursor.continue();
    }

    // Delete all matched keys
    await Promise.all(keysToDelete.map((key) => store.delete(key)));
    await tx.done;

    if (keysToDelete.length > 0) {
      console.debug(
        `[CacheManager] Cleared ${keysToDelete.length} entries with prefix "${prefix}"`
      );
    }
  } catch (error) {
    console.error(`[CacheManager] Error clearing prefix "${prefix}":`, error);
  }
}

/**
 * Get all keys currently in the cache (including expired ones).
 * Primarily useful for debugging.
 */
export async function getAllKeys(): Promise<string[]> {
  try {
    const db = await getDB();
    return await db.getAllKeys('cache-entries');
  } catch (error) {
    console.error('[CacheManager] Error getting all keys:', error);
    return [];
  }
}

/**
 * Get the total number of entries in the cache.
 */
export async function count(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count('cache-entries');
  } catch (error) {
    console.error('[CacheManager] Error counting entries:', error);
    return 0;
  }
}

/**
 * Remove all expired entries from the cache.
 * Called automatically during set operations but can also be called manually.
 */
export async function removeExpired(): Promise<number> {
  try {
    const db = await getDB();
    const now = Date.now();
    const tx = db.transaction('cache-entries', 'readwrite');
    const store = tx.objectStore('cache-entries');
    const index = store.index('by-expiry');

    // Use the index to efficiently find expired entries
    const range = IDBKeyRange.upperBound(now);
    let cursor = await index.openCursor(range);
    let removedCount = 0;

    while (cursor) {
      await cursor.delete();
      removedCount++;
      cursor = await cursor.continue();
    }

    await tx.done;

    if (removedCount > 0) {
      console.debug(`[CacheManager] Removed ${removedCount} expired entries`);
    }

    return removedCount;
  } catch (error) {
    console.error('[CacheManager] Error removing expired entries:', error);
    return 0;
  }
}

/**
 * Enforce the maximum entries limit by removing the oldest entries first.
 */
async function enforceMaxEntries(): Promise<void> {
  try {
    const db = await getDB();
    const totalCount = await db.count('cache-entries');

    if (totalCount <= CACHE_CONFIG.maxEntries) {
      return;
    }

    const entriesToRemove = totalCount - CACHE_CONFIG.maxEntries;
    const tx = db.transaction('cache-entries', 'readwrite');
    const store = tx.objectStore('cache-entries');
    const index = store.index('by-expiry');

    // Remove entries with the earliest expiry first (oldest data)
    let cursor = await index.openCursor();
    let removed = 0;

    while (cursor && removed < entriesToRemove) {
      await cursor.delete();
      removed++;
      cursor = await cursor.continue();
    }

    await tx.done;

    if (removed > 0) {
      console.debug(
        `[CacheManager] Evicted ${removed} entries to enforce max entries limit (${CACHE_CONFIG.maxEntries})`
      );
    }
  } catch (error) {
    console.error('[CacheManager] Error enforcing max entries:', error);
  }
}

// =============================================================================
// Cleanup Scheduling
// =============================================================================

let cleanupScheduled = false;

function scheduleCleanup(): void {
  if (cleanupScheduled) {
    return;
  }

  cleanupScheduled = true;

  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1000);

  schedule(async () => {
    cleanupScheduled = false;
    await removeExpired();
    await enforceMaxEntries();
  });
}

// =============================================================================
// Helper: Generate cache keys following project conventions (Rule 11)
// =============================================================================

export function cacheKey(
  type: 'repos' | 'commits' | 'analytics' | 'story' | 'story:unified',
  identifier: string
): string {
  return `${type}:${identifier}`;
}

/**
 * Generate a deterministic hash for a set of repo IDs.
 * Used for analytics and unified story cache keys.
 */
export function hashSelectedRepos(repoIds: string[]): string {
  const sorted = [...repoIds].sort();
  const combined = sorted.join('|');

  // Simple but deterministic hash (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) & 0xffffffff;
  }

  return Math.abs(hash).toString(36);
}

// =============================================================================
// Convenience methods for typed cache access
// =============================================================================

/**
 * Get or compute: returns cached value if available, otherwise calls the
 * factory function, caches the result, and returns it.
 */
export async function getOrCompute<T>(
  key: string,
  factory: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTtl
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const computed = await factory();
  await set(key, computed, ttl);
  return computed;
}

// =============================================================================
// Export the cache manager as a namespace-like object for convenient import
// =============================================================================

const cacheManager = {
  get,
  set,
  has,
  clear,
  clearByPrefix,
  getAllKeys,
  count,
  removeExpired,
  getOrCompute,
  cacheKey,
  hashSelectedRepos,
  CACHE_TTL,
};

export default cacheManager;
