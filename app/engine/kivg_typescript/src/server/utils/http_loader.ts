import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface HttpLoaderOptions {
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Number of retry attempts on failure (default: 3) */
    retries?: number;
    /** Custom HTTP headers */
    headers?: Record<string, string>;
    /** Validate Content-Type header (default: true) */
    validateContentType?: boolean;
    /** Expected content types (default: auto-detect based on URL) */
    expectedContentTypes?: string[];
    /** Do not throw on failure, return null instead */
    silentFailure?: boolean;
}

interface FetchResult {
    data: Buffer;
    contentType: string;
    statusCode: number;
}

import { Logger } from '../../shared/infra/logger';
import { AssetError, ErrorCode } from '../../shared/infra/errors';

/**
 * Download an asset from an HTTP/HTTPS URL with retry logic and validation.
 */
export async function fetchAsset(
    url: string,
    options: HttpLoaderOptions = {}
): Promise<Buffer> {
    const {
        timeout = 30000,
        retries = 3,
        headers = {},
        validateContentType = true,
        expectedContentTypes
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await fetchWithTimeout(url, timeout, headers);

            // Validate content type if requested
            if (validateContentType && expectedContentTypes) {
                const contentType = result.contentType.toLowerCase();
                const isValidType = expectedContentTypes.some(type =>
                    contentType.includes(type.toLowerCase())
                );

                if (!isValidType) {
                    throw new AssetError(
                        ErrorCode.ASSET_LOAD_FAILED,
                        `Invalid content type: ${result.contentType}. Expected one of: ${expectedContentTypes.join(', ')}`,
                        url
                    );
                }
            }

            return result.data;
        } catch (error: any) {
            lastError = error;

            if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                Logger.warn(`[HttpLoader] Attempt ${attempt + 1}/${retries + 1} failed, retrying...`, {
                    url,
                    error: error.message,
                    delayMs: delay
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    if (options.silentFailure) {
        return null as any;
    }

    Logger.error(`Failed to fetch asset after ${retries + 1} attempts`, lastError, { url });

    throw new AssetError(
        ErrorCode.NETWORK_ERROR,
        `Failed to fetch ${url} after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
        url
    );
}

/**
 * Fetch URL with timeout
 */
function fetchWithTimeout(
    url: string,
    timeout: number,
    headers: Record<string, string>
): Promise<FetchResult> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const requestOptions = {
            headers: {
                'User-Agent': 'KIVG-Engine/1.0',
                'Accept': 'image/*, application/*, text/*',
                'Accept-Encoding': 'gzip, deflate',
                ...headers
            },
            timeout
        };

        const req = protocol.get(url, requestOptions, (res) => {
            // Handle redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                console.log(`[HttpLoader] Following redirect: ${url} -> ${redirectUrl}`);

                fetchWithTimeout(redirectUrl, timeout, headers)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            // Handle HTTP errors
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            const chunks: Buffer[] = [];
            const contentType = res.headers['content-type'] || 'application/octet-stream';

            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                const data = Buffer.concat(chunks);
                resolve({
                    data,
                    contentType,
                    statusCode: res.statusCode!
                });
            });

            res.on('error', (error) => {
                reject(error);
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

/**
 * Guess expected content types from URL extension
 */
export function guessContentTypes(url: string): string[] {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp)($|\?)/)) {
        return ['image/'];
    }
    if (lowerUrl.match(/\.svg($|\?)/)) {
        return ['image/svg', 'text/xml', 'application/xml'];
    }
    if (lowerUrl.match(/\.(woff|woff2|ttf|otf)($|\?)/)) {
        return ['font/', 'application/font', 'application/octet-stream'];
    }
    if (lowerUrl.match(/\.json($|\?)/)) {
        return ['application/json'];
    }
    if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|aac)($|\?)/)) {
        return ['audio/', 'application/octet-stream'];
    }

    // Default: allow any content type
    return [];
}

/**
 * Convenience function to fetch image with proper validation
 */
export async function fetchImage(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<Buffer> {
    const contentTypes = guessContentTypes(url);
    return fetchAsset(url, {
        ...options,
        expectedContentTypes: contentTypes.length > 0 ? contentTypes : ['image/', 'application/octet-stream']
    });
}

/**
 * Convenience function to fetch font with proper validation
 */
export async function fetchFont(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<Buffer> {
    return fetchAsset(url, {
        ...options,
        expectedContentTypes: ['font/', 'application/font', 'application/octet-stream']
    });
}

/**
 * Convenience function to fetch audio with proper validation
 */
export async function fetchAudio(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<Buffer> {
    return fetchAsset(url, {
        ...options,
        expectedContentTypes: ['audio/', 'application/octet-stream']
    });
}
