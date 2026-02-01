import { PixelPoint } from './utils';
import { ColorRegion } from './processing-cache';
import { Point } from '../../../drawing/path_utils';
import { ImageLayerConfig, PreloadedData } from './types';
import { HandOverlayManager } from '../../managers/hand-overlay-manager';
import { PathDrawingHandStrategy } from '../../../../shared/core/hand_overlay_manager';

export class ImageSeeker {
    private seekMaskCanvas: HTMLCanvasElement | null = null;
    private seekMaskCtx: CanvasRenderingContext2D | null = null;
    private lastSeekProgress: number = -1;

    constructor() { }

    seek(
        progress: number,
        previousProgress: number,
        preloadedData: PreloadedData,
        config: ImageLayerConfig,
        canvas: HTMLCanvasElement,
        handOverlayManager: HandOverlayManager | null,
        handOverlayCanvas: HTMLCanvasElement | null,
        transformToGlobal: (p: PixelPoint) => Point
    ): void {
        const ctx = canvas.getContext('2d')!;

        if (progress < 0.001) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.lastSeekProgress = 0;
            if (this.seekMaskCtx) {
                this.seekMaskCtx.fillStyle = 'black';
                this.seekMaskCtx.fillRect(0, 0, this.seekMaskCanvas!.width, this.seekMaskCanvas!.height);
            }
            if (handOverlayManager && handOverlayCanvas) {
                handOverlayManager.hideHand(handOverlayCanvas);
            }
            return;
        }

        if (progress > 0.999) {
            if (preloadedData.src) {
                ctx.putImageData(preloadedData.src, 0, 0);
            }
            this.lastSeekProgress = 1;
            if (this.seekMaskCtx) {
                this.seekMaskCtx.fillStyle = 'white';
                this.seekMaskCtx.fillRect(0, 0, this.seekMaskCanvas!.width, this.seekMaskCanvas!.height);
            }
            if (handOverlayManager && handOverlayCanvas) {
                handOverlayManager.hideHand(handOverlayCanvas);
            }
            return;
        }

        const { strokes, sortedRegions, totalStrokePoints, totalRegionPixels, src, physWidth, physHeight } = preloadedData;

        if (!this.seekMaskCanvas || this.seekMaskCanvas.width !== physWidth || this.seekMaskCanvas.height !== physHeight) {
            this.seekMaskCanvas = document.createElement('canvas');
            this.seekMaskCanvas.width = physWidth;
            this.seekMaskCanvas.height = physHeight;
            this.seekMaskCtx = this.seekMaskCanvas.getContext('2d')!;
            this.seekMaskCtx.fillStyle = 'black';
            this.seekMaskCtx.fillRect(0, 0, physWidth, physHeight);
            this.lastSeekProgress = -1;
        }

        const strokeRatio = config.strokeRatio || 0.7;
        const currentPoints = Math.floor(totalStrokePoints * Math.min(progress / strokeRatio, 1));
        const lastPoints = previousProgress >= 0 ? Math.floor(totalStrokePoints * Math.min(previousProgress / strokeRatio, 1)) : -1;

        const currentPixels = progress > strokeRatio ? Math.floor(totalRegionPixels * (progress - strokeRatio) / (1 - strokeRatio)) : 0;
        const lastPixels = previousProgress > strokeRatio ? Math.floor(totalRegionPixels * (previousProgress - strokeRatio) / (1 - strokeRatio)) : 0;

        const isForward = progress > previousProgress;
        const isIncremental = previousProgress >= 0 && Math.abs(progress - previousProgress) < 0.2;

        let handPos: PixelPoint | null = null;
        let nextPos: PixelPoint | null = null;

        if (!isIncremental) {
            this.seekMaskCtx!.fillStyle = 'black';
            this.seekMaskCtx!.fillRect(0, 0, physWidth, physHeight);

            if (currentPoints > 0) {
                this.seekMaskCtx!.strokeStyle = 'white';
                this.seekMaskCtx!.lineCap = 'round';
                this.seekMaskCtx!.lineWidth = 3;
                let pointsDrawn = 0;
                for (let i = 0; i < strokes.length; i++) {
                    const stroke = strokes[i];
                    if (pointsDrawn >= currentPoints) break;
                    this.seekMaskCtx!.beginPath();
                    if (stroke.length > 0) {
                        pointsDrawn++;
                        if (pointsDrawn === currentPoints) {
                            handPos = stroke[0];
                            if (stroke.length > 1) nextPos = stroke[1];
                            else if (i + 1 < strokes.length) nextPos = strokes[i + 1][0];
                        }
                        this.seekMaskCtx!.moveTo(stroke[0].x, stroke[0].y);
                        for (let j = 1; j < stroke.length; j++) {
                            if (pointsDrawn >= currentPoints) break;
                            this.seekMaskCtx!.lineTo(stroke[j].x, stroke[j].y);
                            pointsDrawn++;
                            if (pointsDrawn === currentPoints) {
                                handPos = stroke[j];
                                if (j + 1 < stroke.length) nextPos = stroke[j + 1];
                                else if (i + 1 < strokes.length) nextPos = strokes[i + 1][0];
                            }
                        }
                    }
                    this.seekMaskCtx!.stroke();
                }
            }

            if (currentPixels > 0) {
                const maskData = this.seekMaskCtx!.getImageData(0, 0, physWidth, physHeight);
                const data = maskData.data;
                let pixelsDrawn = 0;
                for (let i = 0; i < sortedRegions.length; i++) {
                    const region = sortedRegions[i];
                    if (pixelsDrawn >= currentPixels) break;
                    const take = Math.min(currentPixels - pixelsDrawn, region.pixels.length);
                    for (let j = 0; j < take; j++) {
                        const p = region.pixels[j];
                        const idx = (p.y * physWidth + p.x) * 4;
                        data[idx] = data[idx + 1] = data[idx + 2] = 255;
                        data[idx + 3] = 255;
                        pixelsDrawn++;
                        if (pixelsDrawn === currentPixels) {
                            handPos = p;
                            if (j + 1 < region.pixels.length) nextPos = region.pixels[j + 1];
                            else if (i + 1 < sortedRegions.length) nextPos = sortedRegions[i + 1].pixels[0];
                        }
                    }
                }
                this.seekMaskCtx!.putImageData(maskData, 0, 0);
            }
        } else {
            this.seekMaskCtx!.lineCap = 'round';
            this.seekMaskCtx!.lineWidth = 3;
            if (isForward) {
                this.seekMaskCtx!.strokeStyle = 'white';
                if (currentPoints > lastPoints) {
                    let pointsCounted = 0;
                    for (let i = 0; i < strokes.length; i++) {
                        const stroke = strokes[i];
                        if (pointsCounted + stroke.length <= lastPoints) {
                            pointsCounted += stroke.length;
                            continue;
                        }
                        this.seekMaskCtx!.beginPath();
                        const startIdx = Math.max(0, lastPoints - pointsCounted);
                        this.seekMaskCtx!.moveTo(stroke[startIdx].x, stroke[startIdx].y);
                        if (startIdx === 0 && pointsCounted + 1 > lastPoints) {
                            if (pointsCounted + 1 === currentPoints) {
                                handPos = stroke[0];
                                if (stroke.length > 1) nextPos = stroke[1];
                                else if (i + 1 < strokes.length) nextPos = strokes[i + 1][0];
                            }
                        }
                        for (let j = startIdx + 1; j < stroke.length; j++) {
                            const globalIdx = pointsCounted + j + 1;
                            if (globalIdx > currentPoints) break;
                            this.seekMaskCtx!.lineTo(stroke[j].x, stroke[j].y);
                            if (globalIdx === currentPoints) {
                                handPos = stroke[j];
                                if (j + 1 < stroke.length) nextPos = stroke[j + 1];
                                else if (i + 1 < strokes.length) nextPos = strokes[i + 1][0];
                            }
                        }
                        this.seekMaskCtx!.stroke();
                        pointsCounted += stroke.length;
                        if (pointsCounted >= currentPoints) break;
                    }
                }
                if (currentPixels > lastPixels) {
                    const maskData = this.seekMaskCtx!.getImageData(0, 0, physWidth, physHeight);
                    const data = maskData.data;
                    let pixelsCounted = 0;
                    for (let i = 0; i < sortedRegions.length; i++) {
                        const region = sortedRegions[i];
                        if (pixelsCounted + region.pixels.length <= lastPixels) {
                            pixelsCounted += region.pixels.length;
                            continue;
                        }
                        const startIdx = Math.max(0, lastPixels - pixelsCounted);
                        const endIdx = Math.min(region.pixels.length, currentPixels - pixelsCounted);
                        for (let j = startIdx; j < endIdx; j++) {
                            const p = region.pixels[j];
                            const idx = (p.y * physWidth + p.x) * 4;
                            data[idx] = data[idx + 1] = data[idx + 2] = 255;
                            data[idx + 3] = 255;
                            if (pixelsCounted + j + 1 === currentPixels) {
                                handPos = p;
                                if (j + 1 < region.pixels.length) nextPos = region.pixels[j + 1];
                                else if (i + 1 < sortedRegions.length) nextPos = sortedRegions[i + 1].pixels[0];
                            }
                        }
                        pixelsCounted += region.pixels.length;
                        if (pixelsCounted >= currentPixels) break;
                    }
                    this.seekMaskCtx!.putImageData(maskData, 0, 0);
                }
            } else {
                this.seekMaskCtx!.strokeStyle = 'black';
                if (lastPixels > currentPixels) {
                    const maskData = this.seekMaskCtx!.getImageData(0, 0, physWidth, physHeight);
                    const data = maskData.data;
                    let pixelsCounted = 0;
                    for (let i = 0; i < sortedRegions.length; i++) {
                        const region = sortedRegions[i];
                        if (pixelsCounted + region.pixels.length <= currentPixels) {
                            pixelsCounted += region.pixels.length;
                            continue;
                        }
                        const startIdx = Math.max(0, currentPixels - pixelsCounted);
                        const endIdx = Math.min(region.pixels.length, lastPixels - pixelsCounted);
                        let lastErasedIdx = -1;
                        for (let j = startIdx; j < endIdx; j++) {
                            const p = region.pixels[j];
                            const idx = (p.y * physWidth + p.x) * 4;
                            data[idx] = data[idx + 1] = data[idx + 2] = 0;
                            data[idx + 3] = 255;
                            lastErasedIdx = j;
                            if (pixelsCounted + j === currentPixels) {
                                handPos = p;
                                if (j > 0) nextPos = region.pixels[j - 1];
                                else if (i > 0) nextPos = sortedRegions[i - 1].pixels[sortedRegions[i - 1].pixels.length - 1];
                            }
                        }
                        if (!handPos && lastErasedIdx >= 0 && startIdx < endIdx) {
                            if (startIdx >= 0 && startIdx < region.pixels.length) {
                                handPos = region.pixels[startIdx];
                                if (startIdx > 0) nextPos = region.pixels[startIdx - 1];
                                else if (i > 0) nextPos = sortedRegions[i - 1].pixels[sortedRegions[i - 1].pixels.length - 1];
                            }
                        }
                        pixelsCounted += region.pixels.length;
                        if (pixelsCounted >= lastPixels) break;
                    }
                    this.seekMaskCtx!.putImageData(maskData, 0, 0);
                }
                if (lastPoints > currentPoints) {
                    let pointsCounted = 0;
                    for (let i = 0; i < strokes.length; i++) {
                        const stroke = strokes[i];
                        if (pointsCounted + stroke.length <= currentPoints) {
                            pointsCounted += stroke.length;
                            continue;
                        }
                        this.seekMaskCtx!.beginPath();
                        const startIdx = Math.max(0, currentPoints - pointsCounted);
                        const endIdx = Math.min(stroke.length - 1, lastPoints - pointsCounted);
                        this.seekMaskCtx!.moveTo(stroke[startIdx].x, stroke[startIdx].y);
                        let lastErasedIdx = -1;
                        if (pointsCounted + startIdx + 1 === currentPoints) {
                            handPos = stroke[startIdx];
                            if (startIdx > 0) nextPos = stroke[startIdx - 1];
                            else if (i > 0) nextPos = strokes[i - 1][strokes[i - 1].length - 1];
                        }
                        for (let j = startIdx + 1; j <= endIdx; j++) {
                            this.seekMaskCtx!.lineTo(stroke[j].x, stroke[j].y);
                            lastErasedIdx = j;
                            if (pointsCounted + j + 1 === currentPoints) {
                                handPos = stroke[j];
                                if (j > 0) nextPos = stroke[j - 1];
                                else if (i > 0) nextPos = strokes[i - 1][strokes[i - 1].length - 1];
                            }
                        }
                        if (!handPos && lastErasedIdx >= 0 && startIdx <= endIdx) {
                            if (startIdx >= 0 && startIdx < stroke.length) {
                                handPos = stroke[startIdx];
                                if (startIdx > 0) nextPos = stroke[startIdx - 1];
                                else if (i > 0) nextPos = strokes[i - 1][strokes[i - 1].length - 1];
                            }
                        }
                        this.seekMaskCtx!.stroke();
                        pointsCounted += stroke.length;
                        if (pointsCounted >= lastPoints) break;
                    }
                }
            }
        }

        const maskedData = new ImageData(new Uint8ClampedArray(src.data), physWidth, physHeight);
        const revealMask = this.seekMaskCtx!.getImageData(0, 0, physWidth, physHeight).data;
        for (let i = 0; i < revealMask.length; i += 4) {
            maskedData.data[i + 3] = revealMask[i];
        }
        ctx.putImageData(maskedData, 0, 0);

        if (handOverlayManager && handPos && handOverlayCanvas) {
            const strategy = new PathDrawingHandStrategy();
            handOverlayManager.setStrategy(strategy);
            const transformedPos = transformToGlobal(handPos);
            const transformedNext = nextPos ? transformToGlobal(nextPos) : undefined;
            handOverlayManager.updateHandPosition(progress, {
                currentPoint: transformedPos,
                nextPoint: transformedNext
            }, handOverlayCanvas);
        } else if (handOverlayManager && handOverlayCanvas) {
            handOverlayManager.hideHand(handOverlayCanvas);
        }

        this.lastSeekProgress = progress;
    }
}
