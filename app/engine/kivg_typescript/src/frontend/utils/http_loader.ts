/**
 * Frontend HTTP Asset Loader
 * Browser-compatible HTTP/HTTPS asset fetching with retry logic and validation
 * Mirrors backend http_loader.ts but uses browser fetch() API
 */

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
}

interface FetchResult {
    blob: Blob;
    contentType: string;
    statusCode: number;
}

/**
 * Download an asset from an HTTP/HTTPS URL with retry logic and validation.
 */
export async function fetchAsset(
    url: string,
    options: HttpLoaderOptions = {}
): Promise<Blob> {
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
                    throw new Error(
                        `Invalid content type: ${result.contentType}. Expected one of: ${expectedContentTypes.join(', ')}`
                    );
                }
            }

            return result.blob;
        } catch (error: any) {
            lastError = error;

            if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                console.warn(
                    `[HttpLoader] Attempt ${attempt + 1}/${retries + 1} failed for ${url}: ${error.message}. Retrying in ${delay}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(
        `Failed to fetch ${url} after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    );
}

/**
 * Fetch URL with timeout using AbortController
 */
function fetchWithTimeout(
    url: string,
    timeout: number,
    headers: Record<string, string>
): Promise<FetchResult> {
    return new Promise(async (resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'image/*, application/*, text/*',
                    ...headers
                },
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                return;
            }

            const blob = await response.blob();
            const contentType = response.headers.get('content-type') || 'application/octet-stream';

            resolve({
                blob,
                contentType,
                statusCode: response.status
            });
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                reject(new Error(`Request timeout after ${timeout}ms`));
            } else {
                reject(error);
            }
        }
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

    // Default: allow any content type
    return [];
}

/**
 * Convenience function to fetch image with proper validation
 */
export async function fetchImage(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<Blob> {
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
): Promise<Blob> {
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
): Promise<Blob> {
    return fetchAsset(url, {
        ...options,
        expectedContentTypes: ['audio/', 'application/octet-stream']
    });
}

/**
 * Convenience function to fetch JSON
 */
export async function fetchJSON(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<any> {
    const blob = await fetchAsset(url, {
        ...options,
        expectedContentTypes: ['application/json']
    });
    const text = await blob.text();
    return JSON.parse(text);
}

/**
 * Convenience function to fetch any resource as a Blob
 */
export async function fetchBlob(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes' | 'validateContentType'> = {}
): Promise<Blob> {
    return fetchAsset(url, {
        ...options,
        validateContentType: false
    });
}

/**
 * Convenience function to fetch text content (SVG, XML, etc.)
 */
export async function fetchText(
    url: string,
    options: Omit<HttpLoaderOptions, 'expectedContentTypes'> = {}
): Promise<Blob> {
    return fetchAsset(url, {
        ...options,
        expectedContentTypes: ['text/', 'application/xml', 'image/svg']
    });
}
