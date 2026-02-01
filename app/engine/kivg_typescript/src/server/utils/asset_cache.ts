/**
 * Asset Cache for HTTP-loaded assets
 * 
 * Provides in-memory caching of assets downloaded from HTTP/HTTPS URLs
 * with TTL, size limits, and LRU eviction.
 */

interface CacheEntry {
    data: Buffer;
    url: string;
    timestamp: number;
    size: number;
    hits: number;
}

export interface AssetCacheOptions {
    /** Maximum cache size in bytes (default: 500MB) */
    maxSize?: number;
    /** Time to live in milliseconds (default: 1 hour) */
    ttl?: number;
    /** Enable verbose logging */
    verbose?: boolean;
}

export class AssetCache {
    private cache: Map<string, CacheEntry> = new Map();
    private totalSize: number = 0;
    private options: Required<AssetCacheOptions>;

    constructor(options: AssetCacheOptions = {}) {
        this.options = {
            maxSize: options.maxSize ?? 500 * 1024 * 1024, // 500 MB
            ttl: options.ttl ?? 3600000, // 1 hour
            verbose: options.verbose ?? false
        };
    }

    /**
     * Get an asset from cache if available and not expired
     */
    get(url: string): Buffer | null {
        const entry = this.cache.get(url);

        if (!entry) {
            return null;
        }

        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > this.options.ttl) {
            if (this.options.verbose) {
                console.log(`[AssetCache] Cache expired for ${url} (age: ${Math.round(age / 1000)}s)`);
            }
            this.delete(url);
            return null;
        }

        // Update hit count
        entry.hits++;

        if (this.options.verbose) {
            console.log(`[AssetCache] Cache HIT for ${url} (hits: ${entry.hits})`);
        }

        return entry.data;
    }

    /**
     * Store an asset in the cache
     */
    set(url: string, data: Buffer): void {
        const size = data.length;

        // Remove existing entry if present
        if (this.cache.has(url)) {
            this.delete(url);
        }

        // Evict entries if we would exceed max size
        while (this.totalSize + size > this.options.maxSize && this.cache.size > 0) {
            this.evictLRU();
        }

        // Don't cache if single asset is larger than max size
        if (size > this.options.maxSize) {
            console.warn(
                `[AssetCache] Asset too large to cache: ${url} (${Math.round(size / 1024 / 1024)}MB > ${Math.round(this.options.maxSize / 1024 / 1024)}MB)`
            );
            return;
        }

        const entry: CacheEntry = {
            data,
            url,
            timestamp: Date.now(),
            size,
            hits: 0
        };

        this.cache.set(url, entry);
        this.totalSize += size;

        if (this.options.verbose) {
            console.log(
                `[AssetCache] Cached ${url} (${Math.round(size / 1024)}KB, total: ${Math.round(this.totalSize / 1024 / 1024)}MB)`
            );
        }
    }

    /**
     * Check if URL is in cache and not expired
     */
    has(url: string): boolean {
        return this.get(url) !== null;
    }

    /**
     * Delete an entry from cache
     */
    private delete(url: string): void {
        const entry = this.cache.get(url);
        if (entry) {
            this.cache.delete(url);
            this.totalSize -= entry.size;
        }
    }

    /**
     * Evict the least recently used (lowest hits, oldest timestamp)
     */
    private evictLRU(): void {
        if (this.cache.size === 0) return;

        let lruUrl: string | null = null;
        let lruScore = Infinity;

        for (const [url, entry] of this.cache.entries()) {
            // Score based on hits (primary) and age (secondary)
            const age = Date.now() - entry.timestamp;
            const score = entry.hits - (age / this.options.ttl);

            if (score < lruScore) {
                lruScore = score;
                lruUrl = url;
            }
        }

        if (lruUrl) {
            const entry = this.cache.get(lruUrl)!;
            if (this.options.verbose) {
                console.log(
                    `[AssetCache] Evicting ${lruUrl} (hits: ${entry.hits}, age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`
                );
            }
            this.delete(lruUrl);
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.totalSize = 0;
        if (this.options.verbose) {
            console.log('[AssetCache] Cache cleared');
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        entries: number;
        totalSize: number;
        maxSize: number;
        utilizationPercent: number;
    } {
        return {
            entries: this.cache.size,
            totalSize: this.totalSize,
            maxSize: this.options.maxSize,
            utilizationPercent: (this.totalSize / this.options.maxSize) * 100
        };
    }

    /**
     * Clean expired entries
     */
    cleanExpired(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [url, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.options.ttl) {
                this.delete(url);
                cleaned++;
            }
        }

        if (this.options.verbose && cleaned > 0) {
            console.log(`[AssetCache] Cleaned ${cleaned} expired entries`);
        }

        return cleaned;
    }
}

// Global shared cache instance
let globalCache: AssetCache | null = null;

/**
 * Get or create the global asset cache
 */
export function getGlobalCache(options?: AssetCacheOptions): AssetCache {
    if (!globalCache) {
        globalCache = new AssetCache(options);

        // Periodically clean expired entries (every 10 minutes)
        setInterval(() => {
            globalCache?.cleanExpired();
        }, 600000);
    }
    return globalCache;
}

/**
 * Reset the global cache (useful for tests)
 */
export function resetGlobalCache(): void {
    globalCache?.clear();
    globalCache = null;
}
