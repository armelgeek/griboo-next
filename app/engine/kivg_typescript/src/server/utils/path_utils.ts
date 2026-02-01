import * as path from 'path';
import * as fs from 'fs';
import { getGlobalCache } from './asset_cache';
import { fetchImage, fetchFont, fetchAudio, fetchAsset } from './http_loader';

/**
 * Resolves an asset path to an absolute path on the server.
 * For HTTP/HTTPS URLs, returns the URL as-is (will be loaded via loadAssetFromPath).
 * For local paths, maps 'assets/' to 'public/assets/' if needed.
 * 
 * @param assetPath - The path to resolve (e.g., 'assets/hand/eraser.png', '/assets/...', or 'https://...')
 * @returns The absolute path or URL to the asset
 */
export function resolveAssetPath(assetPath: string): string {
    if (!assetPath) return assetPath;

    // If it's already an absolute path that exists, return it
    if (path.isAbsolute(assetPath) && fs.existsSync(assetPath)) {
        return assetPath;
    }

    // If it's a URL, return as-is (will be loaded later)
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        return assetPath;
    }

    let normalizedPath = assetPath;

    // Remove leading slash if present
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
    }

    // Map 'assets/' to 'public/assets/'
    if (normalizedPath.startsWith('assets/')) {
        normalizedPath = path.join('public', normalizedPath);
    }

    // Resolve relative to process.cwd()
    const resolvedPath = path.join(process.cwd(), normalizedPath);

    // If it doesn't exist at the mapped path, try the original path relative to cwd
    if (!fs.existsSync(resolvedPath)) {
        const fallbackPath = path.join(process.cwd(), assetPath.startsWith('/') ? assetPath.substring(1) : assetPath);
        if (fs.existsSync(fallbackPath)) {
            return fallbackPath;
        }

        // Try mapping to static/ directory (e.g., /hand/... -> static/hand/...)
        const staticPath = path.join(process.cwd(), 'static', normalizedPath);
        if (fs.existsSync(staticPath)) {
            return staticPath;
        }
    }

    return resolvedPath;
}

import { Logger } from '../../shared/infra/logger';
import { AssetError, ErrorCode } from '../../shared/infra/errors';

export const DEFAULT_IMAGE_FALLBACK = 'public/assets/placeholder.png';

/**
 * Load an asset from a path or URL with caching.
 * This is the main entry point for loading assets that might be HTTP URLs.
 * 
 * @param pathOrUrl - Local path or HTTP/HTTPS URL
 * @param type - Type of asset for proper content validation ('image', 'font', 'svg', 'generic')
 * @returns Buffer containing the asset data
 */
export async function loadAssetFromPath(
    pathOrUrl: string,
    type: 'image' | 'font' | 'svg' | 'audio' | 'generic' = 'generic',
    options: { silentFailure?: boolean; fallback?: string } = {}
): Promise<Buffer> {
    // Determine effective fallback
    let effectiveFallback = options.fallback;
    if (!effectiveFallback && type === 'image') {
        effectiveFallback = path.join(process.cwd(), DEFAULT_IMAGE_FALLBACK);
    }

    // HTTP/HTTPS URL - use cache and HTTP loader
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        const cache = getGlobalCache();

        // Check cache first
        const cached = cache.get(pathOrUrl);
        if (cached) {
            return cached;
        }

        // Download asset
        let data: Buffer | null = null;
        try {
            switch (type) {
                case 'image':
                case 'svg':
                    data = await fetchImage(pathOrUrl, { silentFailure: options.silentFailure });
                    break;
                case 'font':
                    data = await fetchFont(pathOrUrl, { silentFailure: options.silentFailure });
                    break;
                case 'audio':
                    data = await fetchAudio(pathOrUrl, { silentFailure: options.silentFailure });
                    break;
                default:
                    data = await fetchAsset(pathOrUrl, { silentFailure: options.silentFailure });
            }
        } catch (error) {
            if (effectiveFallback) {
                Logger.warn(`Failed to load ${pathOrUrl}, using fallback: ${effectiveFallback}`, { error: (error as Error).message });
                return loadAssetFromPath(effectiveFallback, type, { silentFailure: options.silentFailure });
            }
            throw error;
        }

        if (!data) {
            if (effectiveFallback) {
                Logger.warn(`Failed to load ${pathOrUrl} (null), using fallback: ${effectiveFallback}`);
                return loadAssetFromPath(effectiveFallback, type, { silentFailure: options.silentFailure });
            }
            if (options.silentFailure) return null as any;
            throw new AssetError(ErrorCode.ASSET_LOAD_FAILED, `Failed to load asset from URL: ${pathOrUrl}`, pathOrUrl);
        }

        // Cache the result
        cache.set(pathOrUrl, data);
        return data;
    }

    // Local file - read directly
    if (!fs.existsSync(pathOrUrl)) {
        if (effectiveFallback && fs.existsSync(effectiveFallback)) {
            Logger.warn(`Local asset not found: ${pathOrUrl}, using fallback: ${effectiveFallback}`);
            return fs.readFileSync(effectiveFallback);
        }
        if (options.silentFailure) return null as any;
        throw new AssetError(ErrorCode.ASSET_NOT_FOUND, `Asset not found: ${pathOrUrl}`, pathOrUrl);
    }

    try {
        return fs.readFileSync(pathOrUrl);
    } catch (error) {
        if (effectiveFallback && fs.existsSync(effectiveFallback)) {
            Logger.warn(`Failed to read local asset: ${pathOrUrl}, using fallback: ${effectiveFallback}`, { error: (error as Error).message });
            return fs.readFileSync(effectiveFallback);
        }
        throw new AssetError(ErrorCode.ASSET_LOAD_FAILED, `Failed to read asset: ${pathOrUrl}`, pathOrUrl);
    }
}

/**
 * Check if a path represents an HTTP/HTTPS URL
 */
export function isHttpUrl(pathOrUrl: string): boolean {
    return pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
}
