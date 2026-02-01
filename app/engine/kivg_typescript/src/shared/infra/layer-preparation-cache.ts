/**
 * LayerPreparationCache - Persistent cache for layer preparation state
 * 
 * This service prevents redundant layer preparation by caching the prepared state
 * based on layer configuration. When a layer's configuration hasn't changed,
 * we can skip the expensive prepare() operation.
 * 
 * Performance Impact:
 * - First prepare: Same duration (varies by layer type)
 * - Subsequent prepares with same config: ~0ms (instant cache hit)
 * - Persists across page reloads using localStorage
 * 
 * Example:
 * ```typescript
 * const cache = LayerPreparationCache.getInstance();
 * const configHash = cache.generateConfigHash(layer);
 * if (cache.isPrepared(configHash)) {
 *   // Skip prepare() - already done!
 * } else {
 *   await layer.prepare();
 *   cache.markPrepared(configHash);
 * }
 * ```
 */

import { isDebugEnabled } from '../config/debug_config';

interface CacheEntry {
  configHash: string;
  timestamp: number;
  layerType: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class LayerPreparationCache {
  private static instance: LayerPreparationCache;

  /**
   * In-memory cache: configHash -> entry
   */
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Cache statistics
   */
  private stats = {
    hits: 0,
    misses: 0
  };

  /**
   * Cache settings
   */
  private readonly STORAGE_KEY = 'layer_preparation_cache';
  private readonly MAX_CACHE_SIZE = 500; // Maximum number of cached entries
  private readonly CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Get singleton instance
   */
  static getInstance(): LayerPreparationCache {
    if (!LayerPreparationCache.instance) {
      LayerPreparationCache.instance = new LayerPreparationCache();
    }
    return LayerPreparationCache.instance;
  }

  private constructor() {
    // Load cache from localStorage on initialization
    this.loadFromStorage();
  }

  /**
   * Generate a unique hash from layer configuration
   * This hash identifies a unique layer configuration state
   */
  generateConfigHash(layerConfig: any): string {
    // Extract relevant properties that affect preparation
    const relevantProps = {
      type: layerConfig.type,
      // For text layers
      text: layerConfig.text,
      fontFamily: layerConfig.fontFamily,
      fontSize: layerConfig.fontSize,
      fontVariant: layerConfig.fontVariant,
      // For image layers
      imagePath: layerConfig.imagePath,
      imageUrl: layerConfig.imageUrl,
      // For shape layers
      shape: layerConfig.shape,
      // For path layers
      pathData: layerConfig.pathData,
      // Other properties that affect rendering
      reversePath: layerConfig.reversePath,
      lineHeight: layerConfig.lineHeight,
      letterSpacing: layerConfig.letterSpacing,
      align: layerConfig.align,
    };

    // Remove undefined values
    const cleanedProps = Object.fromEntries(
      Object.entries(relevantProps).filter(([_, v]) => v !== undefined)
    );

    // Generate hash from JSON string
    const jsonStr = JSON.stringify(cleanedProps, Object.keys(cleanedProps).sort());
    return this.simpleHash(jsonStr);
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if a layer configuration has been prepared
   */
  isPrepared(configHash: string): boolean {
    const entry = this.cache.get(configHash);

    if (!entry) {
      this.stats.misses++;
      if (isDebugEnabled()) {
        console.debug(`[LayerPrepCache] MISS for hash: ${configHash}`);
      }
      return false;
    }

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_EXPIRY_MS) {
      this.cache.delete(configHash);
      this.stats.misses++;
      if (isDebugEnabled()) {
        console.debug(`[LayerPrepCache] EXPIRED for hash: ${configHash}`);
      }
      return false;
    }

    this.stats.hits++;
    if (isDebugEnabled()) {
      console.debug(`[LayerPrepCache] HIT for hash: ${configHash} (type: ${entry.layerType})`);
    }
    return true;
  }

  /**
   * Mark a layer configuration as prepared
   */
  markPrepared(configHash: string, layerType: string = 'unknown'): void {
    // LRU eviction: if cache is full, remove oldest entry
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        if (isDebugEnabled()) {
          console.debug(`[LayerPrepCache] Evicted oldest entry (LRU): ${firstKey}`);
        }
      }
    }

    const entry: CacheEntry = {
      configHash,
      timestamp: Date.now(),
      layerType
    };

    this.cache.set(configHash, entry);

    // Persist to storage
    this.saveToStorage();

    if (isDebugEnabled()) {
      console.debug(`[LayerPrepCache] Marked prepared: ${configHash} (type: ${layerType})`);
    }
  }

  /**
   * Clear a specific entry
   */
  clear(configHash: string): void {
    this.cache.delete(configHash);
    this.saveToStorage();
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.saveToStorage();
    if (isDebugEnabled()) {
      console.debug('[LayerPrepCache] Cache cleared');
    }
  }

  /**
   * Remove expired entries from cache
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.CACHE_EXPIRY_MS) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveToStorage();
      if (isDebugEnabled()) {
        console.debug(`[LayerPrepCache] Cleaned ${removed} expired entries`);
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate
    };
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const entries = Array.from(this.cache.entries());
      const data = {
        entries,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Silently fail if localStorage is not available or full
      console.warn('[LayerPrepCache] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      const entries = data.entries as [string, CacheEntry][];

      // Filter out expired entries while loading
      const now = Date.now();
      let loaded = 0;
      let expired = 0;

      for (const [key, entry] of entries) {
        if (now - entry.timestamp <= this.CACHE_EXPIRY_MS) {
          this.cache.set(key, entry);
          loaded++;
        } else {
          expired++;
        }
      }

      if (isDebugEnabled()) {
        console.debug(`[LayerPrepCache] Loaded ${loaded} entries from storage (${expired} expired)`);
      }
    } catch (error) {
      // Silently fail if localStorage data is corrupted
      console.warn('[LayerPrepCache] Failed to load from localStorage:', error);
    }
  }

  /**
   * Invalidate cache for a specific layer type
   * Useful when a layer type's preparation logic changes
   */
  invalidateLayerType(layerType: string): number {
    let removed = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.layerType === layerType) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveToStorage();
      if (isDebugEnabled()) {
        console.debug(`[LayerPrepCache] Invalidated ${removed} entries for type: ${layerType}`);
      }
    }

    return removed;
  }
}

// Export singleton instance
export const layerPreparationCache = LayerPreparationCache.getInstance();
