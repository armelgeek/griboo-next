import { createCanvas, loadImage, ImageData } from 'canvas';
import {
    Point,
    Coordinate,
    RGBA,
    ColorRegion,
    StrokePath,
    HybridImageConfig,
    HybridFrame
} from '../../shared/types';
import {
    extractStrokes,
    extractColorRegions,
    sortPixelsByDirection
} from '../../shared/utils';

export class HybridImageAnimator {
    private width: number;
    private height: number;
    private background: RGBA;
    private strokeDurationRatio: number;
    private colorTolerance: number;
    private minRegionSize: number;
    private strokeWidth: number;
    private fillDirection: 'diagonal' | 'vertical' | 'horizontal';

    private sourceImageData: ImageData | null = null;
    private strokes: StrokePath[] = [];
    private colorRegions: ColorRegion[] = [];
    private allFillPixels: Point[] = [];
    private totalStrokePoints: number = 0;
    private totalFillPixels: number = 0;

    constructor(config: HybridImageConfig) {
        this.width = config.width;
        this.height = config.height;
        this.background = config.background ?? [255, 255, 255, 255];
        this.strokeDurationRatio = config.strokeDurationRatio ?? 0.7;
        this.colorTolerance = config.colorTolerance ?? 10.0;
        this.minRegionSize = config.minRegionSize ?? 50;
        this.strokeWidth = config.strokeWidth ?? 3;
        this.fillDirection = config.fillDirection ?? 'diagonal';
    }

    /**
     * Load image from URL or path (server-side)
     */
    async loadImage(source: string | Buffer): Promise<void> {
        const image = await loadImage(source);
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');

        // Don't draw a background - keep the canvas transparent
        // This allows layers below to show through when occlusion culling is disabled

        // Draw image directly without background
        ctx.drawImage(image, 0, 0, this.width, this.height);
        this.sourceImageData = ctx.getImageData(0, 0, this.width, this.height);

        // Process image using shared utilities
        this.strokes = extractStrokes(this.sourceImageData);
        this.colorRegions = extractColorRegions(
            this.sourceImageData,
            this.colorTolerance,
            this.minRegionSize,
            this.fillDirection
        );

        // Create a global flattened list of all fill pixels for a continuous sweep
        const rawPixels: Point[] = [];
        for (const region of this.colorRegions) {
            rawPixels.push(...region.pixels);
        }

        // Sort the global list by direction (includes zigzag)
        this.allFillPixels = sortPixelsByDirection(rawPixels, this.fillDirection);

        this.totalStrokePoints = this.strokes.reduce((sum, s) => sum + s.points.length, 0);
        this.totalFillPixels = this.allFillPixels.length;
    }


    /**
     * Render a single frame at a given progress (0.0 to 1.0)
     */
    renderFrame(progress: number): HybridFrame {
        if (!this.sourceImageData) throw new Error('Image not loaded');

        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');

        // Don't draw a background - keep the canvas transparent
        // so that layers below can show through

        let handPosition: Coordinate | null = null;
        let nextHandPosition: Coordinate | null = null;
        let isStrokePhase = progress <= this.strokeDurationRatio;

        // Initialize handPosition to the last point of the strokes if we are in fill phase
        if (!isStrokePhase && this.strokes.length > 0) {
            const lastStroke = this.strokes[this.strokes.length - 1];
            if (lastStroke.points.length > 0) {
                handPosition = lastStroke.points[lastStroke.points.length - 1];
            }
        }

        // Optimization: If progress is 1, just draw the original image
        if (progress >= 1.0) {
            ctx.putImageData(this.sourceImageData, 0, 0);
            return {
                imageData: canvas.toBuffer('image/png'),
                handPosition: null,
                nextHandPosition: null,
                isStrokePhase: false
            };
        }

        // Create a mask canvas to draw the shape of what should be revealed
        const maskCanvas = createCanvas(this.width, this.height);
        const maskCtx = maskCanvas.getContext('2d');

        // We will draw white on transparent background for the mask
        maskCtx.fillStyle = 'rgba(0,0,0,0)';
        maskCtx.clearRect(0, 0, this.width, this.height);

        // Common stroke settings for mask
        maskCtx.strokeStyle = 'white';
        maskCtx.lineWidth = this.strokeWidth; // Should match frontend strokeRevealRadius (default 3 there, we use strokeWidth)
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';

        if (isStrokePhase) {
            // Stroke phase
            const strokeProgress = progress / this.strokeDurationRatio;
            const pointsToDraw = Math.floor(strokeProgress * this.totalStrokePoints);
            let drawnPoints = 0;

            for (const stroke of this.strokes) {
                if (drawnPoints >= pointsToDraw) break;

                maskCtx.beginPath();
                let first = true;
                for (let i = 0; i < stroke.points.length; i++) {
                    const [x, y] = stroke.points[i];
                    if (drawnPoints >= pointsToDraw) {
                        handPosition = [x, y];
                        // Get next point for rotation calculation
                        if (i + 1 < stroke.points.length) {
                            nextHandPosition = stroke.points[i + 1];
                        }
                        break;
                    }
                    if (first) {
                        maskCtx.moveTo(x, y);
                        first = false;
                    } else {
                        maskCtx.lineTo(x, y);
                    }
                    drawnPoints++;
                }
                maskCtx.stroke();
            }
        } else {
            // Fill phase
            // First draw all strokes completed on the mask
            for (const stroke of this.strokes) {
                maskCtx.beginPath();
                let first = true;
                for (const [x, y] of stroke.points) {
                    if (first) { maskCtx.moveTo(x, y); first = false; }
                    else maskCtx.lineTo(x, y);
                }
                maskCtx.stroke();
            }

            const fillProgress = (progress - this.strokeDurationRatio) / (1 - this.strokeDurationRatio);
            const pixelsToDraw = Math.floor(fillProgress * this.totalFillPixels);
            let drawnPixels = 0;

            // Adaptive brush radius matching frontend logic:
            // pixelRadius = Math.min(3, Math.max(1, Math.ceil(2 / Math.sqrt(regions.length / 50))))
            const brushRadius = Math.min(3, Math.max(1, Math.ceil(2 / Math.sqrt(Math.max(1, this.colorRegions.length) / 50))));

            const brushOffsets: [number, number][] = [];
            if (brushRadius > 1) {
                for (let dy = -brushRadius; dy <= brushRadius; dy++) {
                    for (let dx = -brushRadius; dx <= brushRadius; dx++) {
                        if (dx * dx + dy * dy <= brushRadius * brushRadius) {
                            brushOffsets.push([dx, dy]);
                        }
                    }
                }
            }

            // Draw fill pixels from the global sweep list
            maskCtx.fillStyle = 'white';
            const maskData = maskCtx.getImageData(0, 0, this.width, this.height);
            const mData = maskData.data;

            for (let i = 0; i < pixelsToDraw; i++) {
                const [row, col] = this.allFillPixels[i];

                if (i === pixelsToDraw - 1) {
                    handPosition = [col, row]; // [x, y]
                }

                // Draw pixel with brush effect on mask
                if (brushRadius === 1) {
                    const idx = (row * this.width + col) * 4;
                    mData[idx] = 255;
                    mData[idx + 1] = 255;
                    mData[idx + 2] = 255;
                    mData[idx + 3] = 255;
                } else {
                    for (const [dx, dy] of brushOffsets) {
                        const r = row + dy;
                        const c = col + dx;
                        if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
                            const idx = (r * this.width + c) * 4;
                            mData[idx] = 255;
                            mData[idx + 1] = 255;
                            mData[idx + 2] = 255;
                            mData[idx + 3] = 255;
                        }
                    }
                }
            }
            maskCtx.putImageData(maskData, 0, 0);
        }

        // Composite: Draw source image masked by the maskCanvas
        // 1. Create a temp canvas for the masked source
        const tempCanvas = createCanvas(this.width, this.height);
        const tempCtx = tempCanvas.getContext('2d');

        // Draw mask
        tempCtx.drawImage(maskCanvas, 0, 0);

        // Composite source image IN the mask (keeps source pixels where mask is opaque)
        tempCtx.globalCompositeOperation = 'source-in';
        const sourceImage = createCanvas(this.width, this.height);
        const sCtx = sourceImage.getContext('2d');
        sCtx.putImageData(this.sourceImageData, 0, 0);
        tempCtx.drawImage(sourceImage, 0, 0);

        // Draw the result onto the main background
        ctx.drawImage(tempCanvas, 0, 0);

        return {
            imageData: canvas.toBuffer('image/png'), // Return PNG buffer for server-side
            handPosition,
            nextHandPosition,
            isStrokePhase
        };
    }

    /**
     * Get the number of strokes extracted
     */
    getStrokeCount(): number {
        return this.strokes.length;
    }

    /**
     * Get the number of color regions extracted
     */
    getColorRegionCount(): number {
        return this.colorRegions.length;
    }
}
