/**
 * Canvas2D Renderer - Canvas-based rendering for SVG.
 * Replaces OpenCV canvas for browser-based rendering.
 */

import { normalizeColor, type RGBA } from '../../../shared/utils/color_utils';
import { generateCanvasId } from '../infra/utils';

export type Point = [number, number];

/**
 * Canvas-based renderer for 2D graphics.
 */
export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private background: RGBA;

    constructor(
        width: number,
        height: number,
        background: RGBA = [255, 255, 255, 255]
    ) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = generateCanvasId('renderer');
        this.canvas.width = width;
        this.canvas.height = height;

        const ctx = this.canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;

        this.background = background;
        this.clear();
    }

    /**
     * Get the canvas width.
     */
    get width(): number {
        return this.canvas.width;
    }

    /**
     * Get the canvas height.
     */
    get height(): number {
        return this.canvas.height;
    }

    /**
     * Get the underlying canvas element.
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Get the 2D rendering context.
     */
    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    /**
     * Clear the canvas to background color.
     */
    clear(): void {
        // First, clear the canvas completely (remove all pixels)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Then fill with background color if it's not fully transparent
        const [r, g, b, a] = this.background;
        if (a > 0) {
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Convert RGBA tuple to CSS color string.
     */
    private rgbaToStyle(color: RGBA): string {
        const rgba = normalizeColor(color, '0-255');
        return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
    }

    /**
     * Draw a line on the canvas.
     */
    drawLine(
        start: Point,
        end: Point,
        color: RGBA,
        thickness: number = 1
    ): void {
        // Skip zero-length lines to avoid artifacts (dots) when lineCap is round
        // This is especially important for the start of animations
        if (Math.abs(start[0] - end[0]) < 0.01 && Math.abs(start[1] - end[1]) < 0.01) {
            return;
        }

        const rgba = normalizeColor(color, '0-255');

        this.ctx.save();
        this.ctx.strokeStyle = this.rgbaToStyle(rgba);
        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(start[0], start[1]);
        this.ctx.lineTo(end[0], end[1]);
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * Draw polylines on the canvas.
     */
    drawPolylines(
        points: Point[],
        color: RGBA,
        thickness: number = 1,
        closed: boolean = false
    ): void {
        if (points.length < 2) return;

        // Check if all points are effectively the same (zero length polyline)
        let hasLength = false;
        const first = points[0];
        for (let i = 1; i < points.length; i++) {
            if (Math.abs(points[i][0] - first[0]) > 0.01 || Math.abs(points[i][1] - first[1]) > 0.01) {
                hasLength = true;
                break;
            }
        }
        if (!hasLength) return;

        const rgba = normalizeColor(color, '0-255');

        this.ctx.save();
        this.ctx.strokeStyle = this.rgbaToStyle(rgba);
        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i][0], points[i][1]);
        }

        if (closed) {
            this.ctx.closePath();
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Draw a cubic Bezier curve on the canvas.
     */
    drawBezier(
        start: Point,
        ctrl1: Point,
        ctrl2: Point,
        end: Point,
        color: RGBA,
        thickness: number = 1
    ): void {
        // Skip zero-length curves (where all points are at the same position)
        if (
            Math.abs(start[0] - end[0]) < 0.01 && Math.abs(start[1] - end[1]) < 0.01 &&
            Math.abs(start[0] - ctrl1[0]) < 0.01 && Math.abs(start[1] - ctrl1[1]) < 0.01 &&
            Math.abs(start[0] - ctrl2[0]) < 0.01 && Math.abs(start[1] - ctrl2[1]) < 0.01
        ) {
            return;
        }

        const rgba = normalizeColor(color, '0-255');

        this.ctx.save();
        this.ctx.strokeStyle = this.rgbaToStyle(rgba);
        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(start[0], start[1]);
        this.ctx.bezierCurveTo(
            ctrl1[0], ctrl1[1],
            ctrl2[0], ctrl2[1],
            end[0], end[1]
        );
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * Fill a polygon with color.
     */
    fillPolygon(points: Point[], color: RGBA): void {
        if (points.length < 3) return;

        const rgba = normalizeColor(color, '0-255');

        this.ctx.save();
        this.ctx.fillStyle = this.rgbaToStyle(rgba);

        this.ctx.beginPath();
        this.ctx.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i][0], points[i][1]);
        }

        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Fill multiple polygons with holes support.
     * Uses even-odd fill rule to create holes.
     */
    fillPolygonsWithHoles(contours: Point[][], color: RGBA): void {
        if (contours.length === 0) return;

        const rgba = normalizeColor(color, '0-255');

        this.ctx.save();
        this.ctx.fillStyle = this.rgbaToStyle(rgba);

        this.ctx.beginPath();

        // Add all contours to the path
        for (const contour of contours) {
            if (contour.length < 3) continue;

            this.ctx.moveTo(contour[0][0], contour[0][1]);
            for (let i = 1; i < contour.length; i++) {
                this.ctx.lineTo(contour[i][0], contour[i][1]);
            }
            this.ctx.closePath();
        }

        // Use evenodd fill rule for holes
        this.ctx.fill('evenodd');

        this.ctx.restore();
    }

    /**
     * Draw text on the canvas.
     */
    drawText(
        text: string,
        x: number,
        y: number,
        options: {
            fontFamily?: string;
            fontSize?: number;
            fontWeight?: string;
            fontStyle?: string;
            color?: RGBA;
            textAlign?: CanvasTextAlign;
            textBaseline?: CanvasTextBaseline;
            strokeColor?: RGBA;
            strokeWidth?: number;
        } = {}
    ): void {
        const {
            fontFamily = 'sans-serif',
            fontSize = 16,
            fontWeight = 'normal',
            fontStyle = 'normal',
            color = [0, 0, 0, 255],
            textAlign = 'left',
            textBaseline = 'alphabetic',
            strokeColor,
            strokeWidth = 1
        } = options;

        this.ctx.save();

        // Set font
        this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        this.ctx.textAlign = textAlign;
        this.ctx.textBaseline = textBaseline;

        // Draw stroke if specified
        if (strokeColor) {
            this.ctx.strokeStyle = this.rgbaToStyle(normalizeColor(strokeColor, '0-255'));
            this.ctx.lineWidth = strokeWidth;
            this.ctx.strokeText(text, x, y);
        }

        // Draw fill
        this.ctx.fillStyle = this.rgbaToStyle(normalizeColor(color, '0-255'));
        this.ctx.fillText(text, x, y);

        this.ctx.restore();
    }

    /**
     * Save the canvas to a data URL.
     */
    toDataURL(type: string = 'image/png', quality?: number): string {
        return this.canvas.toDataURL(type, quality);
    }

    /**
     * Save the canvas to a blob.
     */
    async toBlob(type: string = 'image/png', quality?: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                type,
                quality
            );
        });
    }

    /**
     * Download the canvas as an image file.
     */
    async download(filename: string = 'canvas.png'): Promise<void> {
        const blob = await this.toBlob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Get canvas image data.
     */
    getImageData(): ImageData {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Put image data onto the canvas.
     */
    putImageData(imageData: ImageData, x: number = 0, y: number = 0): void {
        this.ctx.putImageData(imageData, x, y);
    }

    /**
     * Apply a transformation matrix to the context.
     */
    transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
        this.ctx.transform(a, b, c, d, e, f);
    }

    /**
     * Reset transformation matrix.
     */
    resetTransform(): void {
        this.ctx.resetTransform();
    }

    /**
     * Save the current context state.
     */
    save(): void {
        this.ctx.save();
    }

    /**
     * Restore the previous context state.
     */
    restore(): void {
        this.ctx.restore();
    }

    /**
     * Set global alpha for all drawing operations.
     */
    setGlobalAlpha(alpha: number): void {
        this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * Set composite operation.
     */
    setCompositeOperation(operation: GlobalCompositeOperation): void {
        this.ctx.globalCompositeOperation = operation;
    }
}