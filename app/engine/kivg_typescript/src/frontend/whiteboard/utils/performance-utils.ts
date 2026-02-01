/**
 * Performance Utilities for Scene Animation Engine
 * 
 * This module contains optimized data structures and utilities to improve
 * the performance of scene animations, including:
 * - Spatial indexing for efficient overlap detection
 * - Memoization caching for bounding boxes
 * - LRU cache with TTL for memory management
 * - Unified animation scheduler
 * - DOM operation batching
 */

export * from "../../../shared/utils/performance_utils";


/**
 * LRU (Least Recently Used) cache with automatic cleanup
 * Prevents unbounded memory growth
 * 
 * @example
 * const cache = new LRUCache<string, Data>(50, 30000, (key, value) => {
 *   // Cleanup callback
 *   URL.revokeObjectURL(value);
 * });
 */
export class LRUCache<K, V> {
  private cache = new Map<K, {
    value: V;
    lastAccess: number;
  }>();

  private maxSize: number;
  private cleanupInterval: ReturnType<typeof setInterval>;
  private onEvict?: (key: K, value: V) => void;

  /**
   * @param maxSize - Maximum number of entries (default: 100)
   * @param cleanupIntervalMs - Cleanup interval in milliseconds (default: 30000)
   * @param onEvict - Callback when an entry is evicted
   */
  constructor(
    maxSize = 100,
    cleanupIntervalMs = 30000,
    onEvict?: (key: K, value: V) => void
  ) {
    this.maxSize = maxSize;
    this.onEvict = onEvict;

    // Periodic cleanup of stale entries
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      cleanupIntervalMs
    );
  }

  /**
   * Set a value in the cache
   * Evicts oldest entry if at capacity
   */
  set(key: K, value: V): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      lastAccess: performance.now()
    });
  }

  /**
   * Get a value from the cache
   * Updates access time (LRU)
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      // Update access time (LRU)
      entry.lastAccess = performance.now();
      return entry.value;
    }

    return undefined;
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from cache
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry && this.onEvict) {
      this.onEvict(key, entry.value);
    }
    return this.cache.delete(key);
  }

  /**
   * Evict least recently used entry
   */
  private evictOldest(): void {
    let oldestKey: K | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      const entry = this.cache.get(oldestKey);
      if (entry && this.onEvict) {
        this.onEvict(oldestKey, entry.value);
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove entries older than TTL (60 seconds)
   */
  private cleanup(): void {
    const now = performance.now();
    const maxAge = 60000; // 1 minute TTL

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.lastAccess > maxAge) {
        if (this.onEvict) {
          this.onEvict(key, entry.value);
        }
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries and call onEvict for each
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of Array.from(this.cache.entries())) {
        this.onEvict(key, entry.value);
      }
    }
    this.cache.clear();
  }

  /**
   * Destroy the cache and stop cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.keys())
    };
  }
}

/**
 * Centralized animation scheduler with priority and frame budget management
 * Replaces multiple RAF loops with single coordinated loop
 * 
 * @example
 * const scheduler = AnimationScheduler.getInstance();
 * scheduler.schedule('my-task', (deltaTime, frameDeadline) => {
 *   // Do animation work
 *   return true; // Continue
 * }, 10);
 */
export class AnimationScheduler {
  private static instance: AnimationScheduler | null = null;

  // Configuration
  private static readonly FRAME_TARGET_MS = 16.67; // 60 FPS
  private static readonly MIN_PRIORITY_THRESHOLD = 5; // Tasks below this are deferred if frame budget exceeded

  private tasks: Map<string, {
    callback: (deltaTime: number, frameDeadline: number) => boolean;
    priority: number;
  }> = new Map();

  private lastTimestamp = 0;
  private rafId: number | null = null;
  private isRunning = false;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): AnimationScheduler {
    if (!AnimationScheduler.instance) {
      AnimationScheduler.instance = new AnimationScheduler();
    }
    return AnimationScheduler.instance;
  }

  /**
   * Schedule a task with priority
   * 
   * @param id - Unique task identifier
   * @param callback - Task callback, returns false to remove task
   * @param priority - Higher priority runs first (default: 0)
   */
  schedule(
    id: string,
    callback: (deltaTime: number, frameDeadline: number) => boolean,
    priority = 0
  ): void {
    this.tasks.set(id, { callback, priority });

    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Unschedule a task
   */
  unschedule(id: string): void {
    this.tasks.delete(id);
    if (this.tasks.size === 0) {
      this.stop();
    }
  }

  /**
   * Start the scheduler
   */
  private start(): void {
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.tick(this.lastTimestamp);
  }

  /**
   * Stop the scheduler
   */
  private stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRunning = false;
  }

  /**
   * Main animation loop with frame budget management
   */
  private tick = (timestamp: number): void => {
    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Frame deadline for 60fps
    const frameDeadline = timestamp + AnimationScheduler.FRAME_TARGET_MS;

    // Sort tasks by priority (higher first)
    const sorted = Array.from(this.tasks.entries())
      .sort((a, b) => b[1].priority - a[1].priority);

    // Execute tasks with budget monitoring
    for (const [id, task] of sorted) {
      const now = performance.now();

      // Skip low-priority tasks if frame budget exceeded
      // Tasks with priority >= MIN_PRIORITY_THRESHOLD always run
      if (now >= frameDeadline && task.priority < AnimationScheduler.MIN_PRIORITY_THRESHOLD) {
        console.warn(`[AnimationScheduler] Frame budget exceeded, deferring task: ${id}`);
        continue;
      }

      try {
        const shouldContinue = task.callback(deltaTime, frameDeadline);
        if (!shouldContinue) {
          this.tasks.delete(id);
        }
      } catch (error) {
        console.error(`[AnimationScheduler] Task error: ${id}`, error);
        this.tasks.delete(id);
      }
    }

    // Continue loop if tasks remain
    if (this.tasks.size > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.stop();
    }
  };

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      activeTasks: this.tasks.size,
      taskList: Array.from(this.tasks.keys()),
      isRunning: this.isRunning
    };
  }
}

/**
 * DOM operation batcher to minimize layout reflows
 * Batches read and write operations separately
 * 
 * @example
 * const batcher = DOMBatcher.getInstance();
 * batcher.write(() => {
 *   element.style.width = '100px';
 * });
 */
export class DOMBatcher {
  private static instance: DOMBatcher | null = null;

  private readQueue: Array<() => any> = [];
  private writeQueue: Array<() => void> = [];
  private scheduled = false;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): DOMBatcher {
    if (!DOMBatcher.instance) {
      DOMBatcher.instance = new DOMBatcher();
    }
    return DOMBatcher.instance;
  }

  /**
   * Schedule a read operation (batched in read phase)
   */
  read<T>(fn: () => T): Promise<T> {
    return new Promise(resolve => {
      this.readQueue.push(() => {
        const result = fn();
        resolve(result);
        return result;
      });
      this.schedule();
    });
  }

  /**
   * Schedule a write operation (batched in write phase)
   */
  write(fn: () => void): Promise<void> {
    return new Promise(resolve => {
      this.writeQueue.push(() => {
        fn();
        resolve();
      });
      this.schedule();
    });
  }

  /**
   * Schedule batched execution in next frame
   */
  private schedule(): void {
    if (this.scheduled) return;

    this.scheduled = true;
    requestAnimationFrame(() => {
      // PHASE 1: All reads (minimizes reflows)
      this.readQueue.forEach(fn => fn());
      this.readQueue = [];

      // PHASE 2: All writes (single reflow at end)
      this.writeQueue.forEach(fn => fn());
      this.writeQueue = [];

      this.scheduled = false;
    });
  }

  /**
   * Flush immediately (for critical operations)
   */
  flush(): void {
    if (!this.scheduled) return;

    this.readQueue.forEach(fn => fn());
    this.readQueue = [];

    this.writeQueue.forEach(fn => fn());
    this.writeQueue = [];

    this.scheduled = false;
  }
}

// proxiesIntersect is now re-exported from shared/performance_utils
