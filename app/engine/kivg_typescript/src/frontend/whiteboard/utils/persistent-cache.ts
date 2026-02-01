/**
 * Persistent Cache Manager for Kivg Engine
 * Uses IndexedDB to store expensive preparation results across page reloads.
 */

export class PersistentCacheManager {
    private dbName = 'KivgEngineCache';
    private storeName = 'scene_preparation';
    private db: IDBDatabase | null = null;
    private static instance: PersistentCacheManager | null = null;

    private constructor() { }

    static getInstance(): PersistentCacheManager {
        if (!PersistentCacheManager.instance) {
            PersistentCacheManager.instance = new PersistentCacheManager();
        }
        return PersistentCacheManager.instance;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init(): Promise<void> {
        if (this.db) return;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2); // Bump version for new updates

            request.onupgradeneeded = (e) => {
                const db = (e.target as any).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = (e) => {
                this.db = (e.target as any).result;
                resolve();
            };

            request.onerror = (e) => {
                console.error('[PersistentCache] Failed to open IndexedDB:', e);
                reject(e);
            };
        });
    }

    /**
     * Get a cached result from IndexedDB
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            await this.init();
            if (!this.db) return null;

            return new Promise((resolve) => {
                const transaction = this.db!.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (result && result.data) {
                        // Check TTL (e.g., 7 days)
                        const maxAge = 7 * 24 * 60 * 60 * 1000;
                        if (Date.now() - result.timestamp < maxAge) {
                            resolve(result.data as T);
                            return;
                        }
                        // Expired - delete it
                        this.delete(key);
                    }
                    resolve(null);
                };

                request.onerror = () => resolve(null);
            });
        } catch (err) {
            console.warn('[PersistentCache] Error during GET:', err);
            return null;
        }
    }

    /**
     * Store a result in IndexedDB
     */
    async set<T>(key: string, data: T): Promise<void> {
        try {
            await this.init();
            if (!this.db) return;

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const entry = {
                    data,
                    timestamp: Date.now()
                };

                const request = store.put(entry, key);

                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        } catch (err) {
            console.warn('[PersistentCache] Error during SET:', err);
        }
    }

    /**
     * Delete an entry from the cache
     */
    async delete(key: string): Promise<void> {
        try {
            await this.init();
            if (!this.db) return;

            return new Promise((resolve) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            });
        } catch (err) {
            console.warn('[PersistentCache] Error during DELETE:', err);
        }
    }

    /**
     * Clear the entire cache
     */
    async clear(): Promise<void> {
        try {
            await this.init();
            if (!this.db) return;

            return new Promise((resolve) => {
                const transaction = this.db!.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            });
        } catch (err) {
            console.warn('[PersistentCache] Error during CLEAR:', err);
        }
    }
}
