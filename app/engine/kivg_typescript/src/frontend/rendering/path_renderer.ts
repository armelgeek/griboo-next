/**
 * Path rendering functionality for canvas-based SVG rendering.
 */

import { color01To0255, type RGBA } from '../../shared/utils/color_utils';
import type { CanvasRenderer } from '../core/rendering/canvas';
import { getAllPoints, type Point } from '../drawing/path_utils';

interface PathElement {
    type: 'Line' | 'CubicBezier' | 'Move' | 'Close';
    [key: string]: any;
}

/**
 * Handles rendering of SVG paths to canvas.
 */
export class PathRenderer {
    /**
     * Update the canvas with the current path elements.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param widget - Widget containing path properties
     * @param pathElements - Array of SVG path elements
     * @param defaultColor - Default RGBA color for lines without stroke attribute
     * @param defaultWidth - Default width for lines without stroke-width attribute
     */
    static updateCanvas(
        renderer: CanvasRenderer,
        widget: any,
        pathElements: PathElement[],
        defaultColor: RGBA = [0, 0, 0, 255],
        defaultWidth: number = 1
    ): void {
        let lineCount = 0;
        let bezierCount = 0;

        // Draw each path element
        for (const element of pathElements) {
            if (element.type === 'Line') {
                this._drawLine(renderer, widget, lineCount, defaultColor, defaultWidth);
                lineCount++;
            } else if (element.type === 'CubicBezier') {
                this._drawBezier(renderer, widget, bezierCount, defaultColor, defaultWidth);
                bezierCount++;
            }
        }
    }

    /**
     * Update the canvas with only the original SVG strokes.
     * Only draws strokes for elements that have stroke defined in the original SVG.
     * Skips elements with stroke="none" or no stroke attribute.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param widget - Widget containing path properties
     * @param pathElements - Array of SVG path elements
     * @param defaultWidth - Default width for lines without stroke-width attribute
     */
    static updateCanvasOriginalStrokes(
        renderer: CanvasRenderer,
        widget: any,
        pathElements: PathElement[],
        defaultWidth: number = 1
    ): void {
        let lineCount = 0;
        let bezierCount = 0;

        // Draw each path element only if it has an original SVG stroke
        for (const element of pathElements) {
            if (element.type === 'Line') {
                this._drawLineOriginalStroke(renderer, widget, lineCount, defaultWidth);
                lineCount++;
            } else if (element.type === 'CubicBezier') {
                this._drawBezierOriginalStroke(renderer, widget, bezierCount, defaultWidth);
                bezierCount++;
            }
        }
    }

    /**
     * Draw a line element on the canvas.
     */
    private static _drawLine(
        renderer: CanvasRenderer,
        widget: any,
        lineIndex: number,
        defaultColor: RGBA,
        defaultWidth: number
    ): void {
        // Check if this line has been set up with properties
        if (!widget.hasOwnProperty(`line${lineIndex}_start_x`)) {
            return;
        }

        const startX = Math.floor(widget[`line${lineIndex}_start_x`]);
        const startY = Math.floor(widget[`line${lineIndex}_start_y`]);
        const endX = Math.floor(widget[`line${lineIndex}_end_x`]);
        const endY = Math.floor(widget[`line${lineIndex}_end_y`]);

        // Get stroke color from SVG attributes or use default
        const strokeColor = widget[`line${lineIndex}_stroke_color`];
        let color: RGBA;

        if (strokeColor !== undefined && strokeColor !== null) {
            const converted = color01To0255(strokeColor);
            color = converted !== null ? converted : defaultColor;
        } else {
            color = defaultColor;
        }

        // Get stroke width from SVG attributes or use default/animated width
        const strokeWidth = widget[`line${lineIndex}_stroke_width`];
        let width: number;

        if (strokeWidth !== undefined && strokeWidth !== null) {
            width = Math.floor(strokeWidth);
        } else {
            // Fall back to animated width or default
            width = Math.floor(widget[`line${lineIndex}_width`] ?? defaultWidth);
        }

        renderer.drawLine([startX, startY], [endX, endY], color, width);
    }

    /**
     * Draw a bezier curve element on the canvas.
     */
    private static _drawBezier(
        renderer: CanvasRenderer,
        widget: any,
        bezierIndex: number,
        defaultColor: RGBA,
        defaultWidth: number
    ): void {
        // Check if this bezier has been set up with properties
        if (!widget.hasOwnProperty(`bezier${bezierIndex}_start_x`)) {
            return;
        }

        const startX = Math.floor(widget[`bezier${bezierIndex}_start_x`]);
        const startY = Math.floor(widget[`bezier${bezierIndex}_start_y`]);
        const ctrl1X = Math.floor(widget[`bezier${bezierIndex}_control1_x`]);
        const ctrl1Y = Math.floor(widget[`bezier${bezierIndex}_control1_y`]);
        const ctrl2X = Math.floor(widget[`bezier${bezierIndex}_control2_x`]);
        const ctrl2Y = Math.floor(widget[`bezier${bezierIndex}_control2_y`]);
        const endX = Math.floor(widget[`bezier${bezierIndex}_end_x`]);
        const endY = Math.floor(widget[`bezier${bezierIndex}_end_y`]);

        // Get stroke color from SVG attributes or use default
        const strokeColor = widget[`bezier${bezierIndex}_stroke_color`];
        let color: RGBA;

        if (strokeColor !== undefined && strokeColor !== null) {
            const converted = color01To0255(strokeColor);
            color = converted !== null ? converted : defaultColor;
        } else {
            color = defaultColor;
        }

        // Get stroke width from SVG attributes or use default/animated width
        const strokeWidth = widget[`bezier${bezierIndex}_stroke_width`];
        let width: number;

        if (strokeWidth !== undefined && strokeWidth !== null) {
            width = Math.floor(strokeWidth);
        } else {
            // Fall back to animated width or default
            width = Math.floor(widget[`bezier${bezierIndex}_width`] ?? defaultWidth);
        }

        // Debug: Log the first bezier draw attempt
        if (bezierIndex === 0 && Math.random() < 0.01) {  // Log 1% of the time to avoid spam
            console.log(`[PathRenderer] Drawing bezier${bezierIndex}: start=(${startX},${startY}), end=(${endX},${endY}), color=${JSON.stringify(color)}, width=${width}`);
        }

        renderer.drawBezier(
            [startX, startY],
            [ctrl1X, ctrl1Y],
            [ctrl2X, ctrl2Y],
            [endX, endY],
            color,
            width
        );
    }

    /**
     * Draw a line element only if it has an original SVG stroke defined.
     * Skips drawing if stroke_color is null (meaning stroke="none" in SVG).
     */
    private static _drawLineOriginalStroke(
        renderer: CanvasRenderer,
        widget: any,
        lineIndex: number,
        defaultWidth: number
    ): void {
        // Check if this line has been set up with properties
        if (!widget.hasOwnProperty(`line${lineIndex}_start_x`)) {
            return;
        }

        // Get stroke color from SVG attributes - only draw if original SVG has stroke defined
        const strokeColor = widget[`line${lineIndex}_stroke_color`];
        
        // Skip drawing if no original stroke is defined (stroke="none" or no stroke attribute)
        if (strokeColor === undefined || strokeColor === null) {
            return;
        }

        const startX = Math.floor(widget[`line${lineIndex}_start_x`]);
        const startY = Math.floor(widget[`line${lineIndex}_start_y`]);
        const endX = Math.floor(widget[`line${lineIndex}_end_x`]);
        const endY = Math.floor(widget[`line${lineIndex}_end_y`]);

        const converted = color01To0255(strokeColor);
        if (converted === null) {
            return;
        }
        const color: RGBA = converted;

        // Get stroke width from SVG attributes or use default
        const strokeWidth = widget[`line${lineIndex}_stroke_width`];
        const width = strokeWidth !== undefined && strokeWidth !== null 
            ? Math.floor(strokeWidth) 
            : Math.floor(defaultWidth);

        renderer.drawLine([startX, startY], [endX, endY], color, width);
    }

    /**
     * Draw a bezier curve only if it has an original SVG stroke defined.
     * Skips drawing if stroke_color is null (meaning stroke="none" in SVG).
     */
    private static _drawBezierOriginalStroke(
        renderer: CanvasRenderer,
        widget: any,
        bezierIndex: number,
        defaultWidth: number
    ): void {
        // Check if this bezier has been set up with properties
        if (!widget.hasOwnProperty(`bezier${bezierIndex}_start_x`)) {
            return;
        }

        // Get stroke color from SVG attributes - only draw if original SVG has stroke defined
        const strokeColor = widget[`bezier${bezierIndex}_stroke_color`];
        
        // Skip drawing if no original stroke is defined (stroke="none" or no stroke attribute)
        if (strokeColor === undefined || strokeColor === null) {
            return;
        }

        const startX = Math.floor(widget[`bezier${bezierIndex}_start_x`]);
        const startY = Math.floor(widget[`bezier${bezierIndex}_start_y`]);
        const ctrl1X = Math.floor(widget[`bezier${bezierIndex}_control1_x`]);
        const ctrl1Y = Math.floor(widget[`bezier${bezierIndex}_control1_y`]);
        const ctrl2X = Math.floor(widget[`bezier${bezierIndex}_control2_x`]);
        const ctrl2Y = Math.floor(widget[`bezier${bezierIndex}_control2_y`]);
        const endX = Math.floor(widget[`bezier${bezierIndex}_end_x`]);
        const endY = Math.floor(widget[`bezier${bezierIndex}_end_y`]);

        const converted = color01To0255(strokeColor);
        if (converted === null) {
            return;
        }
        const color: RGBA = converted;

        // Get stroke width from SVG attributes or use default
        const strokeWidth = widget[`bezier${bezierIndex}_stroke_width`];
        const width = strokeWidth !== undefined && strokeWidth !== null 
            ? Math.floor(strokeWidth) 
            : Math.floor(defaultWidth);

        renderer.drawBezier(
            [startX, startY],
            [ctrl1X, ctrl1Y],
            [ctrl2X, ctrl2Y],
            [endX, endY],
            color,
            width
        );
    }

    /**
     * Collect all current points for a shape during animation.
     * 
     * @param tmpElementsLists - Path data from shape animation
     * @param widget - Widget containing animation properties
     * @param shapeId - ID of the shape
     * @returns Array of points representing the current shape state
     */
    static collectShapePoints(
        tmpElementsLists: any[][],
        widget: any,
        shapeId: string
    ): number[] {
        const shapeList: number[] = [];
        let lineCount = 0;
        let bezierCount = 0;

        for (const pathElements of tmpElementsLists) {
            for (const element of pathElements) {
                // Collect line points
                if (element.length === 2) {
                    // Line
                    shapeList.push(
                        widget[`${shapeId}_mesh_line${lineCount}_start_x`],
                        widget[`${shapeId}_mesh_line${lineCount}_start_y`],
                        widget[`${shapeId}_mesh_line${lineCount}_end_x`],
                        widget[`${shapeId}_mesh_line${lineCount}_end_y`]
                    );
                    lineCount++;
                }

                // Collect bezier points
                if (element.length === 4) {
                    // Bezier
                    const points = getAllPoints(
                        [
                            widget[`${shapeId}_mesh_bezier${bezierCount}_start_x`],
                            widget[`${shapeId}_mesh_bezier${bezierCount}_start_y`]
                        ],
                        [
                            widget[`${shapeId}_mesh_bezier${bezierCount}_control1_x`],
                            widget[`${shapeId}_mesh_bezier${bezierCount}_control1_y`]
                        ],
                        [
                            widget[`${shapeId}_mesh_bezier${bezierCount}_control2_x`],
                            widget[`${shapeId}_mesh_bezier${bezierCount}_control2_y`]
                        ],
                        [
                            widget[`${shapeId}_mesh_bezier${bezierCount}_end_x`],
                            widget[`${shapeId}_mesh_bezier${bezierCount}_end_y`]
                        ]
                    );
                    shapeList.push(...points);
                    bezierCount++;
                }
            }
        }

        return shapeList;
    }

    /**
     * Draw animated stroke following a path.
     * Useful for "drawing" animation effects.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param points - Array of points defining the path
     * @param progress - Animation progress (0.0 to 1.0)
     * @param color - Stroke color
     * @param width - Stroke width
     */
    static drawAnimatedStroke(
        renderer: CanvasRenderer,
        points: Point[],
        progress: number,
        color: RGBA,
        width: number
    ): void {
        if (points.length < 2) return;

        const totalPoints = points.length;
        const endIndex = Math.floor(totalPoints * progress);

        if (endIndex < 2) return;

        // Draw polyline up to the progress point
        const visiblePoints = points.slice(0, endIndex);
        renderer.drawPolylines(visiblePoints, color, width, false);
    }

    /**
     * Clear all path-related properties from a widget.
     * 
     * @param widget - Widget to clear properties from
     * @param lineCount - Number of line properties to clear
     * @param bezierCount - Number of bezier properties to clear
     */
    static clearPathProperties(
        widget: any,
        lineCount: number,
        bezierCount: number
    ): void {
        // Clear line properties
        for (let i = 0; i < lineCount; i++) {
            delete widget[`line${i}_start_x`];
            delete widget[`line${i}_start_y`];
            delete widget[`line${i}_end_x`];
            delete widget[`line${i}_end_y`];
            delete widget[`line${i}_width`];
            delete widget[`line${i}_stroke_color`];
            delete widget[`line${i}_stroke_width`];
        }

        // Clear bezier properties
        for (let i = 0; i < bezierCount; i++) {
            delete widget[`bezier${i}_start_x`];
            delete widget[`bezier${i}_start_y`];
            delete widget[`bezier${i}_control1_x`];
            delete widget[`bezier${i}_control1_y`];
            delete widget[`bezier${i}_control2_x`];
            delete widget[`bezier${i}_control2_y`];
            delete widget[`bezier${i}_end_x`];
            delete widget[`bezier${i}_end_y`];
            delete widget[`bezier${i}_width`];
            delete widget[`bezier${i}_stroke_color`];
            delete widget[`bezier${i}_stroke_width`];
        }
    }

    /**
     * Get bounds of all paths in a widget.
     * 
     * @param widget - Widget containing path properties
     * @param lineCount - Number of lines
     * @param bezierCount - Number of bezier curves
     * @returns Bounding box [minX, minY, maxX, maxY] or null
     */
    static getPathBounds(
        widget: any,
        lineCount: number,
        bezierCount: number
    ): [number, number, number, number] | null {
        const points: Point[] = [];

        // Collect line endpoints
        for (let i = 0; i < lineCount; i++) {
            if (widget.hasOwnProperty(`line${i}_start_x`)) {
                points.push([
                    widget[`line${i}_start_x`],
                    widget[`line${i}_start_y`]
                ]);
                points.push([
                    widget[`line${i}_end_x`],
                    widget[`line${i}_end_y`]
                ]);
            }
        }

        // Collect bezier points
        for (let i = 0; i < bezierCount; i++) {
            if (widget.hasOwnProperty(`bezier${i}_start_x`)) {
                points.push([widget[`bezier${i}_start_x`], widget[`bezier${i}_start_y`]]);
                points.push([widget[`bezier${i}_control1_x`], widget[`bezier${i}_control1_y`]]);
                points.push([widget[`bezier${i}_control2_x`], widget[`bezier${i}_control2_y`]]);
                points.push([widget[`bezier${i}_end_x`], widget[`bezier${i}_end_y`]]);
            }
        }

        if (points.length === 0) {
            return null;
        }

        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);

        return [
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs),
            Math.max(...ys)
        ];
    }
}