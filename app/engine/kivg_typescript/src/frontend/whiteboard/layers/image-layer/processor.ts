import * as ImageProc from '../../../core/rendering/image-processing';
import { extractStrokesCore } from '../../../../shared/graphics/stroke-extraction-core';

import { Point } from '../../../drawing/path_utils';
import { PixelPoint, GeometryUtils, ColorUtils, PixelSorter } from './utils';
import { ColorRegion, ProcessingCache, CacheKey } from './processing-cache';
import { ImageLayerConfig, PreloadedData, WorkerOutput } from './types';
import { isDebugEnabled } from '../../../../shared/config/debug_config';
import { LoadingManager } from '../../../core/infra/loading';

export class ImageProcessor {
    private regionWorker: Worker | null = null;

    async process(
        imagePath: string,
        img: HTMLImageElement,
        config: ImageLayerConfig,
        pixelScale: number,
        loadingIds: any
    ): Promise<PreloadedData> {
        const loadingManager = LoadingManager.getInstance();

        // 1. Calculate Dimensions
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        const MIN_PROCESSING_SIZE = 800;
        const maxDimension = Math.max(naturalWidth, naturalHeight);
        const processingScale = MIN_PROCESSING_SIZE / maxDimension;
        const processingWidth = Math.round(naturalWidth * processingScale);
        const processingHeight = Math.round(naturalHeight * processingScale);

        img.width = processingWidth;
        img.height = processingHeight;

        const userWidth = config.width;
        const userHeight = config.height;

        let displayWidth = userWidth || naturalWidth;
        let displayHeight = userHeight || naturalHeight;

        if (displayWidth === 0) displayWidth = 800;
        if (displayHeight === 0) displayHeight = 800;

        const scaleX = displayWidth / processingWidth;
        const scaleY = displayHeight / processingHeight;
        const cssScale = Math.min(scaleX, scaleY);

        const dpr = window.devicePixelRatio || 1;
        const effectiveDPR = processingWidth / displayWidth;
        const finalPixelScale = effectiveDPR >= dpr ? 1 : (dpr / effectiveDPR);

        const physWidth = Math.round(processingWidth * finalPixelScale);
        const physHeight = Math.round(processingHeight * finalPixelScale);

        // 2. Image Preprocessing
        loadingManager.start(loadingIds.prepare, 'Préparation de l\'image (HD)...');
        const { src, smoothed, gray } = this.prepareImage(img, physWidth, physHeight);
        loadingManager.complete(loadingIds.prepare);

        // 3. Cache Check
        const cache = ProcessingCache.getInstance();
        const cacheKey: CacheKey = {
            imagePath,
            width: physWidth,
            height: physHeight,
            colorTolerance: config.colorTolerance,
            minRegionSize: config.minRegionSize,
            pixelScale: finalPixelScale
        };

        let cachedData = cache.get(cacheKey);
        let strokes: PixelPoint[][] = [];
        let regions: ColorRegion[] = [];

        if (cachedData && cachedData.strokes && cachedData.regions) {
            strokes = cachedData.strokes as PixelPoint[][];
            regions = cachedData.regions;
        } else {
            loadingManager.start(loadingIds.strokes, 'Analyse des traits...');
            strokes = this.extractStrokes(gray, physWidth, physHeight, config);
            loadingManager.complete(loadingIds.strokes);

            loadingManager.start(loadingIds.regions, 'Analyse des couleurs...');
            try {
                regions = await this.detectRegionsWithWorker(smoothed, config, finalPixelScale);
            } catch (error) {
                if (isDebugEnabled()) {
                    console.warn('[ImageProcessor] Worker failed, falling back to main thread:', error);
                }
                regions = this.detectRegions(smoothed, config, finalPixelScale);
            }
            loadingManager.complete(loadingIds.regions);
            cache.set(cacheKey, { strokes, regions });
        }

        // 4. Pixel Sorting
        loadingManager.start(loadingIds.sort, 'Organisation des pixels...');
        const totalStrokePoints = strokes.reduce((sum, s) => sum + s.length, 0);
        const totalRegionPixels = regions.reduce((sum, r) => sum + r.pixels.length, 0);

        const totalDuration = config.duration;
        const strokeRatio = config.strokeRatio || 0.5;
        const fillDuration = totalDuration * (1 - strokeRatio);

        const targetPixelsPerSecond = 40000;
        const pixelBudget = Math.max(5000, fillDuration * targetPixelsPerSecond);

        let globalSamplingRatio = 1;
        if (totalRegionPixels > pixelBudget) {
            globalSamplingRatio = pixelBudget / totalRegionPixels;
        }

        const regionsForAnimation = regions.map(r => {
            let sampledPixels = r.pixels;
            if (globalSamplingRatio < 1) {
                const targetPixelsForRegion = Math.max(100, Math.ceil(r.pixels.length * globalSamplingRatio));
                const numBands = Math.min(20, Math.floor(Math.sqrt(targetPixelsForRegion)));
                const pixelsPerBand = Math.ceil(targetPixelsForRegion / numBands);
                const bandSize = Math.ceil(r.pixels.length / numBands);

                sampledPixels = [];
                for (let band = 0; band < numBands; band++) {
                    const bandStart = band * bandSize;
                    const bandEnd = Math.min((band + 1) * bandSize, r.pixels.length);
                    const bandPixels = r.pixels.slice(bandStart, bandEnd);
                    const step = Math.ceil(bandPixels.length / pixelsPerBand);
                    for (let i = 0; i < bandPixels.length && sampledPixels.length < targetPixelsForRegion; i += step) {
                        sampledPixels.push(bandPixels[i]);
                    }
                }
            }
            return {
                ...r,
                pixels: PixelSorter.sortByDirection(sampledPixels, config.fillDirection),
                size: sampledPixels.length
            };
        });

        const sortedRegions = this.sortRegionsByDirection(regionsForAnimation, config.fillDirection);
        loadingManager.complete(loadingIds.sort);

        return {
            src,
            smoothed,
            gray,
            strokes,
            regions,
            sortedRegions,
            totalStrokePoints,
            totalRegionPixels: sortedRegions.reduce((sum, r) => sum + r.pixels.length, 0),
            physWidth,
            physHeight,
            processingWidth,
            processingHeight,
            displayWidth,
            displayHeight,
            cssScale,
            pixelScale: finalPixelScale
        };
    }

    private prepareImage(img: HTMLImageElement, targetWidth: number, targetHeight: number): { src: ImageData; smoothed: ImageData; gray: Uint8Array } {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const src = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const gray = ImageProc.grayscale(src);
        const smoothedGray = ImageProc.gaussianBlur(gray, targetWidth, targetHeight, 1);
        const smoothed = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
        return { src, smoothed, gray: smoothedGray };
    }

    private extractStrokes(gray: Uint8Array, width: number, height: number, config: ImageLayerConfig): PixelPoint[][] {
        const rawPaths = extractStrokesCore(gray, width, height) as unknown as PixelPoint[][];
        const strokes: PixelPoint[][] = [];
        for (const points of rawPaths) {
            if (points.length > 2) {
                const aggressiveEpsilon = Math.max(2.0, 2.0 * (width / 600));
                let simplified = GeometryUtils.douglasPeucker(points, aggressiveEpsilon);
                const strokeDuration = config.duration * (config.strokeRatio || 0.5);
                const targetPoints = Math.max(5, Math.round(strokeDuration * 10));
                if (simplified.length > targetPoints) {
                    const step = Math.ceil(simplified.length / targetPoints);
                    simplified = simplified.filter((_, idx) => idx % step === 0);
                    if (simplified[simplified.length - 1] !== points[points.length - 1]) {
                        simplified.push(points[points.length - 1]);
                    }
                }
                strokes.push(GeometryUtils.catmullRom(simplified, 2));
            } else if (points.length > 0) {
                strokes.push(points);
            }
        }
        return strokes;
    }

    private async detectRegionsWithWorker(smoothed: ImageData, config: ImageLayerConfig, pixelScale: number = 1): Promise<ColorRegion[]> {
        if (!this.regionWorker) {
            this.regionWorker = new Worker(
                new URL('../../../workers/region-detection.worker.ts', import.meta.url),
                { type: 'module' }
            );
        }
        const { data, width, height } = smoothed;
        return new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent<WorkerOutput>) => {
                if (e.data.type === 'result') {
                    cleanup();
                    resolve(e.data.regions);
                } else if (e.data.type === 'error') {
                    cleanup();
                    reject(new Error(e.data.message));
                }
            };
            const handleError = (e: ErrorEvent) => {
                cleanup();
                reject(new Error(`Worker error: ${e.message}`));
            };
            const cleanup = () => {
                this.regionWorker?.removeEventListener('message', handleMessage);
                this.regionWorker?.removeEventListener('error', handleError);
            };
            this.regionWorker!.addEventListener('message', handleMessage);
            this.regionWorker!.addEventListener('error', handleError);
            const input = {
                type: 'detectRegions',
                imageData: data,
                width,
                height,
                channels: 4,
                colorTolerance: config.colorTolerance ?? 5,
                minRegionSize: config.minRegionSize ?? 50,
                pixelScale
            };
            this.regionWorker!.postMessage(input, [data.buffer]);
        });
    }

    private detectRegions(smoothed: ImageData, config: ImageLayerConfig, pixelScale: number = 1): ColorRegion[] {
        const { width, height, data } = smoothed;
        const visited = new Uint8Array(width * height);
        const regions: ColorRegion[] = [];
        const colorTolerance = config.colorTolerance ?? 5;
        const imageArea = width * height;
        const baseMinRegionSize = (config.minRegionSize || 50) * (imageArea > 1000000 ? 5 : (imageArea > 500000 ? 3 : 1));
        const scaledMinRegionSize = Math.round(baseMinRegionSize * pixelScale * pixelScale);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (visited[idx]) continue;
                const offset = idx * 4;
                const startColor: [number, number, number] = [data[offset], data[offset + 1], data[offset + 2]];
                const gray = ColorUtils.calculateGrayscale(startColor);
                if (gray >= 250) continue;

                const pixels: PixelPoint[] = [];
                const stack: PixelPoint[] = [{ x, y }];
                while (stack.length > 0) {
                    const p = stack.pop()!;
                    if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;
                    const pIdx = p.y * width + p.x;
                    if (visited[pIdx]) continue;
                    const pOffset = pIdx * 4;
                    const pColor: [number, number, number] = [data[pOffset], data[pOffset + 1], data[pOffset + 2]];
                    if (ColorUtils.calculateDeltaE(startColor, pColor) > colorTolerance) continue;

                    visited[pIdx] = 1;
                    pixels.push(p);
                    if (pixels.length >= 1000000) break;
                    stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
                }

                if (pixels.length >= scaledMinRegionSize) {
                    let sumX = 0, sumY = 0;
                    for (const p of pixels) { sumX += p.x; sumY += p.y; }
                    regions.push({
                        color: startColor,
                        pixels,
                        centroid: { x: sumX / pixels.length, y: sumY / pixels.length },
                        size: pixels.length
                    });
                    if (regions.length >= 50) return regions;
                }
            }
        }
        return regions;
    }

    private sortRegionsByDirection(regions: ColorRegion[], direction: 'diagonal' | 'vertical' | 'horizontal'): ColorRegion[] {
        const colorGroups = new Map<string, ColorRegion[]>();
        for (const r of regions) {
            const key = `${r.color[0]},${r.color[1]},${r.color[2]}`;
            if (!colorGroups.has(key)) colorGroups.set(key, []);
            colorGroups.get(key)!.push(r);
        }
        const sortedColors = Array.from(colorGroups.keys()).sort((a, b) => {
            const regsA = colorGroups.get(a)!;
            const regsB = colorGroups.get(b)!;
            const avgA = regsA.reduce((sum, r) => sum + (r.centroid.x + r.centroid.y), 0) / regsA.length;
            const avgB = regsB.reduce((sum, r) => sum + (r.centroid.x + r.centroid.y), 0) / regsB.length;
            return avgA - avgB;
        });
        const sortedRegions: ColorRegion[] = [];
        for (const colorKey of sortedColors) {
            const group = colorGroups.get(colorKey)!;
            group.sort((a, b) => {
                if (direction === 'vertical') return a.centroid.x !== b.centroid.x ? a.centroid.x - b.centroid.x : a.centroid.y - b.centroid.y;
                if (direction === 'horizontal') return a.centroid.y !== b.centroid.y ? a.centroid.y - b.centroid.y : a.centroid.x - b.centroid.x;
                return (a.centroid.y + a.centroid.x) - (b.centroid.y + b.centroid.x);
            });
            sortedRegions.push(...group);
        }
        return sortedRegions;
    }

    dispose(): void {
        if (this.regionWorker) {
            this.regionWorker.terminate();
            this.regionWorker = null;
        }
    }
}
