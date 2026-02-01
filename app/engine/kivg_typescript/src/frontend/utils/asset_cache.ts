/**
 * Frontend Asset Cache
 * Multi-tier caching system using IndexedDB for persistence and in-memory Map for speed
 */

const DB_NAME = 'kivg-asset-cache';
const DB_VERSION = 1;
const STORE_NAME = 'assets';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

export interface CacheMetadata {
    url: string;
    timestamp: number;
    size: number;
    contentType: string;
    ttl?: number;
}

export interface CacheStats {
    entries: number;
    totalSize: number;
    maxSize: number;
    utilizationPercent: number;
    hits: number;
    misses: number;
}

/**
 * Asset cache with IndexedDB persistence and in-memory optimization
 */
export class AssetCache {
    private memoryCache: Map<string, Blob> = new Map();
    private metadata: Map<string, CacheMetadata> = new Map();
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private maxSize: number;
    private stats = {
        hits: 0,
        misses: 0
    };

    constructor(maxSize: number = DEFAULT_MAX_SIZE) {
        this.maxSize = maxSize;
        this.initPromise = this.initDB();
    }

    /**
     * Initialize IndexedDB
     */
    private async initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[AssetCache] Failed to open IndexedDB:', request.error);
                // Don't reject - fallback to memory-only cache
                resolve();
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.loadMetadata().then(resolve).catch(resolve);
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Load metadata from IndexedDB into memory
     */
    private async loadMetadata(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    this.metadata.set(record.url, {
                        url: record.url,
                        timestamp: record.timestamp,
                        size: record.size,
                        contentType: record.contentType,
                        ttl: record.ttl
                    });
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => {
                console.error('[AssetCache] Failed to load metadata');
                resolve();
            };
        });
    }

    /**
     * Get asset from cache
     */
    async get(url: string): Promise<Blob | null> {
        await this.initPromise;

        // Check memory cache first
        if (this.memoryCache.has(url)) {
            const meta = this.metadata.get(url);
            if (meta && this.isValid(meta)) {
                this.stats.hits++;
                return this.memoryCache.get(url)!;
            } else {
                // Expired - remove from memory
                this.memoryCache.delete(url);
                this.metadata.delete(url);
            }
        }

        // Check IndexedDB
        if (this.db) {
            const blob = await this.getFromDB(url);
            if (blob) {
                const meta = this.metadata.get(url);
                if (meta && this.isValid(meta)) {
                    // Load into memory cache
                    this.memoryCache.set(url, blob);
                    this.stats.hits++;
                    return blob;
                } else {
                    // Expired - remove from DB
                    await this.deleteFromDB(url);
                }
            }
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Store asset in cache
     */
    async set(url: string, blob: Blob, metadata?: Partial<CacheMetadata>): Promise<void> {
        await this.initPromise;

        const meta: CacheMetadata = {
            url,
            timestamp: Date.now(),
            size: blob.size,
            contentType: blob.type || 'application/octet-stream',
            ttl: metadata?.ttl || DEFAULT_TTL
        };

        // Check if we need to evict
        const currentSize = this.getTotalSize();
        if (currentSize + blob.size > this.maxSize) {
            await this.evictOldest(blob.size);
        }

        // Store in memory
        this.memoryCache.set(url, blob);
        this.metadata.set(url, meta);

        // Store in IndexedDB
        if (this.db) {
            await this.setInDB(url, blob, meta);
        }
    }

    /**
     * Check if cached entry is still valid
     */
    private isValid(meta: CacheMetadata): boolean {
        const age = Date.now() - meta.timestamp;
        const ttl = meta.ttl || DEFAULT_TTL;
        return age < ttl;
    }

    /**
     * Get asset from IndexedDB
     */
    private async getFromDB(url: string): Promise<Blob | null> {
        if (!this.db) return null;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);

            request.onsuccess = () => {
                const record = request.result;
                resolve(record ? record.blob : null);
            };

            request.onerror = () => {
                console.error('[AssetCache] Failed to get from DB:', url);
                resolve(null);
            };
        });
    }

    /**
     * Store asset in IndexedDB
     */
    private async setInDB(url: string, blob: Blob, meta: CacheMetadata): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                url,
                blob,
                timestamp: meta.timestamp,
                size: meta.size,
                contentType: meta.contentType,
                ttl: meta.ttl
            });

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('[AssetCache] Failed to set in DB:', url);
                resolve();
            };
        });
    }

    /**
     * Delete asset from IndexedDB
     */
    private async deleteFromDB(url: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(url);

            request.onsuccess = () => {
                this.metadata.delete(url);
                resolve();
            };
            request.onerror = () => resolve();
        });
    }

    /**
     * Evict oldest entries to make room
     */
    private async evictOldest(requiredSpace: number): Promise<void> {
        const entries = Array.from(this.metadata.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        let freedSpace = 0;
        for (const [url, meta] of entries) {
            if (freedSpace >= requiredSpace) break;

            this.memoryCache.delete(url);
            this.metadata.delete(url);
            await this.deleteFromDB(url);
            freedSpace += meta.size;
        }
    }

    /**
     * Get total cached size
     */
    private getTotalSize(): number {
        return Array.from(this.metadata.values()).reduce((sum, meta) => sum + meta.size, 0);
    }

    /**
     * Clear all cache
     */
    async clear(): Promise<void> {
        await this.initPromise;

        this.memoryCache.clear();
        this.metadata.clear();

        if (this.db) {
            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            });
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const totalSize = this.getTotalSize();
        const stats = {
            entries: this.metadata.size,
            totalSize,
            maxSize: this.maxSize,
            utilizationPercent: (totalSize / this.maxSize) * 100,
            hits: this.stats.hits,
            misses: this.stats.misses
        };

        if (this.metadata.size > 0) {
            console.log('[AssetCache] Statistics:', stats);
        }

        return stats;
    }
}

// Global cache instance
let globalCache: AssetCache | null = null;

/**
 * Get the global asset cache instance
 */
export function getGlobalCache(): AssetCache {
    if (!globalCache) {
        globalCache = new AssetCache();
    }
    return globalCache;
}

/**
 * Clear the global cache
 */
export async function clearGlobalCache(): Promise<void> {
    if (globalCache) {
        await globalCache.clear();
    }
}
