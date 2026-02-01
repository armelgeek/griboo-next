import { Point } from '../../../drawing/path_utils';
import { PixelPoint } from './utils';
import { ColorRegion } from './processing-cache';

export interface ImageLayerConfig {
    width?: number;
    height?: number;
    duration: number;
    strokeRatio: number;
    colorTolerance: number;
    minRegionSize: number;
    fillDirection: 'diagonal' | 'vertical' | 'horizontal';
    sweepSpeed?: number;
    handOverlayEnabled?: boolean;
    handImageUrl?: string;
    handScale?: number;
    handOffset?: { x: number; y: number };
}

/**
 * Preloaded data from heavy image processing.
 */
export interface PreloadedData {
    src: ImageData;
    smoothed: ImageData;
    gray: Uint8Array;
    strokes: PixelPoint[][];
    regions: ColorRegion[];
    sortedRegions: ColorRegion[];
    totalStrokePoints: number;
    totalRegionPixels: number;
    physWidth: number;
    physHeight: number;
    processingWidth: number;
    processingHeight: number;
    displayWidth: number;
    displayHeight: number;
    cssScale: number;
    pixelScale: number;
}

export interface WorkerOutput {
    type: 'result' | 'error';
    regions: ColorRegion[];
    message?: string;
}
