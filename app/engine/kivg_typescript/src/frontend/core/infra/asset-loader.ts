/**
 * Asset Loading Manager with Progress Tracking
 * Provides user feedback during asset loading
 */

/**
 * Configuration options for asset loading
 */
export interface AssetLoaderConfig {
    /** Timeout in milliseconds for loading assets (default: 30000) */
    timeout?: number;
    /** Delay before hiding success indicator in ms (default: 1000) */
    successDelay?: number;
    /** Delay before hiding error indicator in ms (default: 3000) */
    errorDelay?: number;
}

export interface LoadingProgress {
    total: number;
    loaded: number;
    percentage: number;
    current: string;
    status: 'loading' | 'complete' | 'error';
    errors: string[];
}

export type LoadingCallback = (progress: LoadingProgress) => void;

/**
 * Asset Loader with progress tracking and error handling
 */
export class AssetLoader {
    private config: Required<AssetLoaderConfig>;
    private progress: LoadingProgress = {
        total: 0,
        loaded: 0,
        percentage: 0,
        current: '',
        status: 'loading',
        errors: []
    };

    private callbacks: LoadingCallback[] = [];
    private loadedAssets: Map<string, any> = new Map();

    constructor(config: AssetLoaderConfig = {}) {
        this.config = {
            timeout: config.timeout ?? 30000,
            successDelay: config.successDelay ?? 1000,
            errorDelay: config.errorDelay ?? 3000
        };
    }

    /**
     * Register a callback to be called on progress updates
     */
    onProgress(callback: LoadingCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Load multiple assets with progress tracking
     */
    async loadAssets(assets: { type: string; path: string; name: string }[]): Promise<Map<string, any>> {
        this.progress.total = assets.length;
        this.progress.loaded = 0;
        this.progress.status = 'loading';
        this.progress.errors = [];
        this.notifyProgress();

        for (const asset of assets) {
            try {
                this.progress.current = asset.name || asset.path;
                this.notifyProgress();

                const loaded = await this.loadAsset(asset.type, asset.path);
                this.loadedAssets.set(asset.name || asset.path, loaded);

                this.progress.loaded++;
                this.progress.percentage = (this.progress.loaded / this.progress.total) * 100;
                this.notifyProgress();
            } catch (error) {
                const errorMsg = `Failed to load ${asset.type}: ${asset.path} - ${error}`;
                this.progress.errors.push(errorMsg);
                console.error(errorMsg);
            }
        }

        this.progress.status = this.progress.errors.length > 0 ? 'error' : 'complete';
        this.progress.current = '';
        this.notifyProgress();

        return this.loadedAssets;
    }

    /**
     * Load a single asset
     */
    private async loadAsset(type: string, path: string): Promise<any> {
        switch (type) {
            case 'image':
                return this.loadImage(path);
            case 'audio':
                return this.loadAudio(path);
            case 'font':
                return this.loadFont(path);
            case 'json':
                return this.loadJSON(path);
            case 'svg':
                return this.loadSVG(path);
            case 'blob':
                return this.loadBlob(path);
            default:
                throw new Error(`Unknown asset type: ${type}`);
        }
    }

    /**
     * Load an image with HTTP support and caching
     */
    private async loadImage(path: string): Promise<HTMLImageElement> {
        // Use HTTP loader for remote URLs
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return this.loadImageFromHttp(path);
        }

        // Local path or data URL - use standard Image API
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onerror = () => {
                reject(new Error(`Image not found or failed to load: ${path}`));
            };

            img.onload = () => {
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    reject(new Error(`Image loaded but has invalid dimensions: ${path}`));
                } else {
                    resolve(img);
                }
            };

            img.src = path;

            setTimeout(() => {
                if (!img.complete) {
                    reject(new Error(`Image load timeout after ${this.config.timeout}ms: ${path}`));
                }
            }, this.config.timeout);
        });
    }

    /**
     * Load image from HTTP/HTTPS URL with caching and retry
     */
    private async loadImageFromHttp(url: string): Promise<HTMLImageElement> {
        const { getGlobalCache } = await import('../../utils/asset_cache');
        const { fetchImage } = await import('../../utils/http_loader');

        const cache = getGlobalCache();

        // Check cache first
        let blob = await cache.get(url);

        if (!blob) {
            // Download with retry logic
            blob = await fetchImage(url, {
                retries: 3,
                timeout: this.config.timeout
            });

            // Store in cache
            await cache.set(url, blob);
        }

        // Convert blob to Image
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    reject(new Error(`Image loaded but has invalid dimensions: ${url}`));
                } else {
                    resolve(img);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Failed to decode image: ${url}`));
            };

            img.src = objectUrl;
        });
    }

    /**
     * Load an audio file with HTTP support and caching
     */
    private async loadAudio(path: string): Promise<HTMLAudioElement> {
        // Use HTTP loader for remote URLs
        if (path.startsWith('http://') || path.startsWith('https://')) {
            const { getGlobalCache } = await import('../../utils/asset_cache');
            const { fetchAudio } = await import('../../utils/http_loader');
            const cache = getGlobalCache();

            let blob = await cache.get(path);
            if (!blob) {
                blob = await fetchAudio(path, { timeout: this.config.timeout });
                await cache.set(path, blob);
            }

            const objectUrl = URL.createObjectURL(blob);
            return new Promise((resolve, reject) => {
                const audio = new Audio();
                audio.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error(`Audio decoding failed: ${path}`));
                };
                audio.oncanplaythrough = () => {
                    // Note: We don't revoke here because audio needs it during playback
                    // but we should track it to revoke eventually
                    resolve(audio);
                };
                audio.src = objectUrl;
                audio.load();
                setTimeout(() => {
                    if (audio.readyState < 4) {
                        reject(new Error(`Audio timeout: ${path}`));
                    }
                }, this.config.timeout);
            });
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.onerror = () => reject(new Error(`Audio file not found: ${path}`));
            audio.oncanplaythrough = () => resolve(audio);
            audio.src = path;
            audio.load();
            setTimeout(() => {
                if (audio.readyState < 4) reject(new Error(`Audio load timeout: ${path}`));
            }, this.config.timeout);
        });
    }

    /**
     * Load a font with HTTP support and caching
     */
    private async loadFont(path: string, name?: string): Promise<FontFace> {
        const fontName = name || this.extractFontName(path);

        try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchFont } = await import('../../utils/http_loader');
                const cache = getGlobalCache();

                let blob = await cache.get(path);
                if (!blob) {
                    blob = await fetchFont(path, { timeout: this.config.timeout });
                    await cache.set(path, blob);
                }

                const arrayBuffer = await blob.arrayBuffer();
                const fontFace = new FontFace(fontName, arrayBuffer);
                const loadedFont = await fontFace.load();
                document.fonts.add(loadedFont);
                return loadedFont;
            }

            const fontFace = new FontFace(fontName, `url(${path})`);
            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);
            return loadedFont;
        } catch (error) {
            throw new Error(`Font failed to load: ${path} - ${error}`);
        }
    }

    /**
     * Extract font name from path
     * Handles complex paths and filenames
     */
    private extractFontName(path: string): string {
        try {
            // Try URL parsing for absolute URLs
            if (path.startsWith('http')) {
                const url = new URL(path);
                path = url.pathname;
            }

            // Extract filename and remove extension
            const parts = path.split('/');
            const filename = parts[parts.length - 1];
            const nameWithoutExt = filename.split('.')[0];

            // Clean up the name (remove hyphens, underscores)
            return nameWithoutExt.replace(/[-_]/g, ' ');
        } catch {
            // Fallback to generic name
            return 'CustomFont';
        }
    }

    /**
     * Load a JSON file with HTTP support and caching
     */
    private async loadJSON(path: string): Promise<any> {
        try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchJSON } = await import('../../utils/http_loader');
                const cache = getGlobalCache();

                // We store JSON as Blobs in cache for consistency
                let blob = await cache.get(path);
                if (!blob) {
                    const data = await fetchJSON(path, { timeout: this.config.timeout });
                    blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                    await cache.set(path, blob);
                    return data;
                }
                return JSON.parse(await blob.text());
            }

            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            throw new Error(`JSON failed to load: ${path} - ${error}`);
        }
    }

    /**
     * Load an SVG file with HTTP support and caching
     */
    private async loadSVG(path: string): Promise<string> {
        try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchText } = await import('../../utils/http_loader');
                const cache = getGlobalCache();

                let blob = await cache.get(path);
                if (!blob) {
                    blob = await fetchText(path, { timeout: this.config.timeout });
                    await cache.set(path, blob);
                }
                return await blob.text();
            }

            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            throw new Error(`SVG failed to load: ${path} - ${error}`);
        }
    }

    /**
     * Load a raw Blob with HTTP support and caching
     */
    private async loadBlob(path: string): Promise<Blob> {
        try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchBlob } = await import('../../utils/http_loader');
                const cache = getGlobalCache();

                let blob = await cache.get(path);
                if (!blob) {
                    blob = await fetchBlob(path, { timeout: this.config.timeout });
                    await cache.set(path, blob);
                }
                return blob;
            }

            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.blob();
        } catch (error) {
            throw new Error(`Blob failed to load: ${path} - ${error}`);
        }
    }

    /**
     * Notify all callbacks of progress update
     */
    private notifyProgress(): void {
        this.callbacks.forEach(callback => {
            callback({ ...this.progress });
        });
    }

    /**
     * Get current progress
     */
    getProgress(): LoadingProgress {
        return { ...this.progress };
    }

    /**
     * Get a loaded asset
     */
    getAsset(name: string): any {
        return this.loadedAssets.get(name);
    }

    /**
     * Clear all loaded assets
     */
    clear(): void {
        this.loadedAssets.clear();
        this.progress = {
            total: 0,
            loaded: 0,
            percentage: 0,
            current: '',
            status: 'loading',
            errors: []
        };
    }
}

/**
 * Create a loading indicator UI element
 */
export function createLoadingIndicator(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'kivg-loading-indicator';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        min-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Loading Assets...';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #2d3748;
        font-size: 1.5em;
    `;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        width: 100%;
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 15px;
    `;

    const progressFill = document.createElement('div');
    progressFill.id = 'kivg-progress-fill';
    progressFill.style.cssText = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
    `;

    const statusText = document.createElement('div');
    statusText.id = 'kivg-status-text';
    statusText.style.cssText = `
        color: #718096;
        font-size: 0.9em;
        margin-bottom: 10px;
    `;

    const percentageText = document.createElement('div');
    percentageText.id = 'kivg-percentage-text';
    percentageText.style.cssText = `
        color: #2d3748;
        font-size: 1.2em;
        font-weight: 600;
        text-align: center;
    `;

    const errorContainer = document.createElement('div');
    errorContainer.id = 'kivg-error-container';
    errorContainer.style.cssText = `
        margin-top: 15px;
        max-height: 150px;
        overflow-y: auto;
        display: none;
    `;

    progressBar.appendChild(progressFill);
    content.appendChild(title);
    content.appendChild(progressBar);
    content.appendChild(statusText);
    content.appendChild(percentageText);
    content.appendChild(errorContainer);
    container.appendChild(content);

    return container;
}

/**
 * Update the loading indicator UI
 */
export function updateLoadingIndicator(progress: LoadingProgress): void {
    const indicator = document.getElementById('kivg-loading-indicator');
    if (!indicator) return;

    const fill = document.getElementById('kivg-progress-fill');
    const status = document.getElementById('kivg-status-text');
    const percentage = document.getElementById('kivg-percentage-text');
    const errorContainer = document.getElementById('kivg-error-container');

    if (fill) {
        fill.style.width = `${progress.percentage}%`;
    }

    if (status) {
        if (progress.status === 'loading') {
            status.textContent = `Loading: ${progress.current}`;
        } else if (progress.status === 'complete') {
            status.textContent = 'All assets loaded successfully!';
        } else if (progress.status === 'error') {
            status.textContent = 'Some assets failed to load';
            status.style.color = '#e53e3e';
        }
    }

    if (percentage) {
        percentage.textContent = `${Math.round(progress.percentage)}% (${progress.loaded}/${progress.total})`;
    }

    if (errorContainer && progress.errors.length > 0) {
        errorContainer.style.display = 'block';
        errorContainer.innerHTML = '<div style="color: #e53e3e; font-size: 0.9em; margin-bottom: 5px;"><strong>Errors:</strong></div>';
        progress.errors.forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.style.cssText = 'color: #e53e3e; font-size: 0.85em; margin-bottom: 5px; padding: 5px; background: #fff5f5; border-radius: 4px;';
            errorItem.textContent = error;
            errorContainer.appendChild(errorItem);
        });
    }
}

/**
 * Remove the loading indicator
 */
export function removeLoadingIndicator(): void {
    const indicator = document.getElementById('kivg-loading-indicator');
    if (indicator) {
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            indicator.remove();
        }, 300);
    }
}

/**
 * Convenience function to show loading indicator with asset loader
 */
export async function loadAssetsWithProgress(
    assets: { type: string; path: string; name: string }[],
    config?: AssetLoaderConfig
): Promise<Map<string, any>> {
    const loader = new AssetLoader(config);
    const indicator = createLoadingIndicator();
    document.body.appendChild(indicator);

    const loaderConfig = {
        timeout: config?.timeout ?? 30000,
        successDelay: config?.successDelay ?? 1000,
        errorDelay: config?.errorDelay ?? 3000
    };

    loader.onProgress((progress) => {
        updateLoadingIndicator(progress);

        if (progress.status === 'complete' || progress.status === 'error') {
            const delay = progress.errors.length > 0 ? loaderConfig.errorDelay : loaderConfig.successDelay;
            setTimeout(() => {
                removeLoadingIndicator();
            }, delay);
        }
    });

    return loader.loadAssets(assets);
}
