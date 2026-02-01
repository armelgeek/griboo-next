import { PixelPoint } from './utils';

export interface ColorRegion {
    color: [number, number, number];
    pixels: PixelPoint[];
    centroid: PixelPoint;
    size: number;
}

export interface CacheKey {
    imagePath: string;
    width: number;
    height: number;
    colorTolerance?: number;
    minRegionSize?: number;
    pixelScale?: number;
}

export interface CachedData {
    strokes?: PixelPoint[][];
    regions?: ColorRegion[];
    timestamp: number;
}

export class ProcessingCache {
    private static instance: ProcessingCache;
    private cache: Map<string, CachedData> = new Map();
    private readonly MAX_CACHE_SIZE = 20; // Keep last 20 processed items
    private readonly CACHE_TTL = 1000 * 60 * 30; // 30 minutes

    static getInstance(): ProcessingCache {
        if (!ProcessingCache.instance) {
            ProcessingCache.instance = new ProcessingCache();
        }
        return ProcessingCache.instance;
    }

    private generateKey(key: CacheKey): string {
        return JSON.stringify(key);
    }

    get(key: CacheKey): CachedData | undefined {
        const k = this.generateKey(key);
        const data = this.cache.get(k);

        if (data) {
            if (Date.now() - data.timestamp > this.CACHE_TTL) {
                this.cache.delete(k);
                return undefined;
            }
            return data;
        }
        return undefined;
    }

    set(key: CacheKey, data: Partial<CachedData>): void {
        const k = this.generateKey(key);

        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        const existing = this.cache.get(k) || { timestamp: Date.now() };
        this.cache.set(k, { ...existing, ...data, timestamp: Date.now() });
    }

    clear(): void {
        this.cache.clear();
    }
}
