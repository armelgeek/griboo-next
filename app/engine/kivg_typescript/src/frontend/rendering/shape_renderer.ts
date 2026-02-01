/**
 * Shape rendering (polygon filling) for canvas-based SVG rendering.
 * Handles filled shapes with support for holes and complex polygons.
 */

import type { CanvasRenderer } from '../core/rendering/canvas';
import { type RGBA } from '../../shared/utils/color_utils';
import type { Point } from '../drawing/path_utils';

/**
 * Handler for rendering filled shapes using Canvas2D.
 */
export class ShapeRenderer {
    /**
     * Render filled shapes onto the canvas with hole support.
     * 
     * Canvas2D's fill() with 'evenodd' rule handles tessellation automatically
     * for concave polygons. When multiple shapes are passed, they are rendered
     * together to support holes (inner shapes become cutouts).
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param shapes - Array of shapes, each shape is a flat array of points [x1, y1, x2, y2, ...]
     * @param color - RGBA color (0-255 for each component)
     * @param opacity - Additional opacity modifier (0.0-1.0)
     */
    static renderShapes(
        renderer: CanvasRenderer,
        shapes: number[][],
        color: RGBA,
        opacity: number = 1.0
    ): void {
        // Apply opacity to color alpha
        const finalAlpha = Math.floor(color[3] * opacity);
        const finalColor: RGBA = [color[0], color[1], color[2], finalAlpha];

        // Convert all shapes to point lists
        const contours: Point[][] = [];
        for (const shape of shapes) {
            if (shape.length >= 6) {
                // At least 3 points (6 values)
                const points = this._flatToPoints(shape);
                contours.push(points);
            }
        }

        if (contours.length > 1) {
            // Multiple contours - use fill with holes support
            renderer.fillPolygonsWithHoles(contours, finalColor);
        } else if (contours.length === 1) {
            // Single contour - use simple fill
            renderer.fillPolygon(contours[0], finalColor);
        }
    }

    /**
     * Convert flat array [x1, y1, x2, y2, ...] to array of points [[x1, y1], ...].
     * 
     * @param flatList - Flat array of coordinates
     * @returns Array of [x, y] tuples
     */
    private static _flatToPoints(flatList: number[]): Point[] {
        const points: Point[] = [];
        for (let i = 0; i < flatList.length; i += 2) {
            if (i + 1 < flatList.length) {
                points.push([
                    Math.floor(flatList[i]),
                    Math.floor(flatList[i + 1])
                ]);
            }
        }
        return points;
    }

    /**
     * Render meshes onto the canvas (compatible with animation-style API).
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param widget - Widget that may contain opacity attribute
     * @param shapes - Array of shapes represented as arrays of points
     * @param color - RGB or RGBA color values (0-1 range)
     * @param opacityAttr - Name of the attribute containing opacity value
     */
    static renderMesh(
        renderer: CanvasRenderer,
        widget: any,
        shapes: number[][],
        color: number[],
        opacityAttr: string
    ): void {
        // Get the opacity value
        const opacity = widget[opacityAttr] ?? 1.0;

        // Convert color from 0-1 range to 0-255 range
        let rgbaColor: RGBA;
        if (color.length >= 3) {
            const r = Math.floor(color[0] * 255);
            const g = Math.floor(color[1] * 255);
            const b = Math.floor(color[2] * 255);
            const a = Math.floor((color.length > 3 ? color[3] : 1.0) * 255 * opacity);
            rgbaColor = [r, g, b, a];
        } else {
            rgbaColor = [255, 255, 255, Math.floor(255 * opacity)];
        }

        this.renderShapes(renderer, shapes, rgbaColor, 1.0);
    }

    /**
     * Render a gradient-filled shape.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param points - Array of points defining the shape
     * @param gradient - Gradient configuration
     */
    static renderGradientShape(
        renderer: CanvasRenderer,
        points: Point[],
        gradient: {
            type: 'linear' | 'radial';
            start: Point;
            end: Point;
            colorStops: Array<{ offset: number; color: RGBA }>;
        }
    ): void {
        if (points.length < 3) return;

        const ctx = renderer.getContext();
        ctx.save();

        // Create gradient
        let canvasGradient: CanvasGradient;
        if (gradient.type === 'linear') {
            canvasGradient = ctx.createLinearGradient(
                gradient.start[0],
                gradient.start[1],
                gradient.end[0],
                gradient.end[1]
            );
        } else {
            const radius = Math.hypot(
                gradient.end[0] - gradient.start[0],
                gradient.end[1] - gradient.start[1]
            );
            canvasGradient = ctx.createRadialGradient(
                gradient.start[0],
                gradient.start[1],
                0,
                gradient.start[0],
                gradient.start[1],
                radius
            );
        }

        // Add color stops
        for (const stop of gradient.colorStops) {
            const [r, g, b, a] = stop.color;
            canvasGradient.addColorStop(
                stop.offset,
                `rgba(${r}, ${g}, ${b}, ${a / 255})`
            );
        }

        // Draw shape with gradient
        ctx.fillStyle = canvasGradient;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /**
     * Render a shape with a pattern fill.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param points - Array of points defining the shape
     * @param patternImage - Image to use as pattern
     * @param repetition - Pattern repetition mode
     */
    static renderPatternShape(
        renderer: CanvasRenderer,
        points: Point[],
        patternImage: HTMLImageElement | HTMLCanvasElement,
        repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat' = 'repeat'
    ): void {
        if (points.length < 3) return;

        const ctx = renderer.getContext();
        ctx.save();

        // Create pattern
        const pattern = ctx.createPattern(patternImage, repetition);
        if (!pattern) {
            ctx.restore();
            return;
        }

        ctx.fillStyle = pattern;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /**
     * Render a shape with a stroke outline.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param points - Array of points defining the shape
     * @param fillColor - Fill color (null for no fill)
     * @param strokeColor - Stroke color
     * @param strokeWidth - Stroke width
     */
    static renderStrokedShape(
        renderer: CanvasRenderer,
        points: Point[],
        fillColor: RGBA | null,
        strokeColor: RGBA,
        strokeWidth: number
    ): void {
        if (points.length < 3) return;

        const ctx = renderer.getContext();
        ctx.save();

        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();

        // Fill
        if (fillColor) {
            const [r, g, b, a] = fillColor;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            ctx.fill();
        }

        // Stroke
        const [r, g, b, a] = strokeColor;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Calculate the area of a polygon.
     * Uses the shoelace formula.
     * 
     * @param points - Array of points defining the polygon
     * @returns Area of the polygon (absolute value)
     */
    static calculatePolygonArea(points: Point[]): number {
        if (points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }
        return Math.abs(area / 2);
    }

    /**
     * Calculate the centroid of a polygon.
     * 
     * @param points - Array of points defining the polygon
     * @returns Centroid point [x, y]
     */
    static calculatePolygonCentroid(points: Point[]): Point {
        if (points.length === 0) return [0, 0];

        let cx = 0;
        let cy = 0;
        for (const [x, y] of points) {
            cx += x;
            cy += y;
        }
        return [cx / points.length, cy / points.length];
    }

    /**
     * Check if a point is inside a polygon.
     * Uses ray casting algorithm.
     * 
     * @param point - Point to test [x, y]
     * @param polygon - Array of points defining the polygon
     * @returns True if point is inside polygon
     */
    static isPointInPolygon(point: Point, polygon: Point[]): boolean {
        const [x, y] = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];

            const intersect =
                yi > y !== yj > y &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

            if (intersect) inside = !inside;
        }

        return inside;
    }
}