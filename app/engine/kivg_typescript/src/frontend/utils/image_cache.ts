/**
 * Shared Image Cache for Frontend
 * Caches HTMLImageElement objects to avoid redundant loading and decoding.
 * Implements LRU eviction to manage memory.
 */

export class ImageCache {
    private static instance: ImageCache | null = null;
    private cache: Map<string, HTMLImageElement> = new Map();
    private lruList: string[] = [];
    private readonly MAX_ENTRIES = 50;

    private constructor() { }

    /**
     * Get the singleton instance
     */
    static getInstance(): ImageCache {
        if (!ImageCache.instance) {
            ImageCache.instance = new ImageCache();
        }
        return ImageCache.instance;
    }

    /**
     * Get an image from cache or load it
     */
    async getImage(url: string, loader?: (url: string) => Promise<HTMLImageElement>): Promise<HTMLImageElement> {
        // Check cache
        if (this.cache.has(url)) {
            this.updateLRU(url);
            return this.cache.get(url)!;
        }

        // Load image
        const img = loader ? await loader(url) : await this.defaultLoader(url);

        // Add to cache
        this.cache.set(url, img);
        this.lruList.push(url);

        // Evict if necessary
        if (this.cache.size > this.MAX_ENTRIES) {
            this.evict();
        }

        return img;
    }

    /**
     * Remove an image from cache
     */
    remove(url: string): void {
        const img = this.cache.get(url);
        if (img) {
            img.src = ''; // Help GC
            this.cache.delete(url);
            this.lruList = this.lruList.filter(item => item !== url);
        }
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.forEach(img => {
            img.src = '';
        });
        this.cache.clear();
        this.lruList = [];
    }

    private updateLRU(url: string): void {
        const index = this.lruList.indexOf(url);
        if (index > -1) {
            this.lruList.splice(index, 1);
            this.lruList.push(url);
        }
    }

    private evict(): void {
        const oldest = this.lruList.shift();
        if (oldest) {
            const img = this.cache.get(oldest);
            if (img) {
                img.src = '';
                this.cache.delete(oldest);
            }
        }
    }

    /**
     * Default loader using standard Image API
     */
    private defaultLoader(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
}

export const imageCache = ImageCache.getInstance();
