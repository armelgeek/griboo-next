import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageCache } from '../utils/image_cache';

describe('ImageCache', () => {
    let cache: ImageCache;

    beforeEach(() => {
        cache = (ImageCache as any).getInstance();
        cache.clear();
        // Since it's a singleton, we need to reset the internal state if possible
        // but clear() should be enough for testing logic.
    });

    it('should load and cache an image', async () => {
        const url = 'https://example.com/image.png';
        const mockImage = { src: '' } as HTMLImageElement;
        const loader = vi.fn().mockResolvedValue(mockImage);

        const img1 = await cache.getImage(url, loader);
        expect(img1).toBe(mockImage);
        expect(loader).toHaveBeenCalledTimes(1);

        const img2 = await cache.getImage(url, loader);
        expect(img2).toBe(mockImage);
        expect(loader).toHaveBeenCalledTimes(1); // Should use cache
    });

    it('should evict oldest entries when limit is reached', async () => {
        // Set a smaller limit for testing if possible, but we'll just fill it up to 50 if needed
        // For the sake of the test, let's assume we can modify MAX_ENTRIES or just test the logic
        const maxEntries = (cache as any).MAX_ENTRIES;

        const loader = (url: string) => Promise.resolve({ src: url } as HTMLImageElement);

        // Fill cache
        for (let i = 0; i < maxEntries; i++) {
            await cache.getImage(`url${i}`, loader);
        }

        expect((cache as any).cache.size).toBe(maxEntries);

        // Add one more
        await cache.getImage('url_new', loader);

        expect((cache as any).cache.size).toBe(maxEntries);
        expect((cache as any).cache.has('url0')).toBe(false); // Oldest should be evicted
        expect((cache as any).cache.has('url_new')).toBe(true);
    });

    it('should update LRU on access', async () => {
        const loader = (url: string) => Promise.resolve({ src: url } as HTMLImageElement);
        const maxEntries = (cache as any).MAX_ENTRIES;

        for (let i = 0; i < maxEntries; i++) {
            await cache.getImage(`url${i}`, loader);
        }

        // Access url0 again to make it recently used
        await cache.getImage('url0', loader);

        // Add one more to trigger eviction
        await cache.getImage('url_new', loader);

        expect((cache as any).cache.has('url0')).toBe(true); // url0 should still be there
        expect((cache as any).cache.has('url1')).toBe(false); // url1 should be evicted instead
    });

    it('should clear src on eviction to help GC', async () => {
        const url = 'evict_me';
        const mockImage = { src: url } as HTMLImageElement;
        const loader = vi.fn().mockResolvedValue(mockImage);
        const maxEntries = (cache as any).MAX_ENTRIES;

        await cache.getImage(url, loader);

        // Fill up and evict
        for (let i = 0; i < maxEntries; i++) {
            await cache.getImage(`fill${i}`, (u) => Promise.resolve({ src: u } as HTMLImageElement));
        }

        expect(mockImage.src).toBe(''); // Should have been cleared
    });
});
