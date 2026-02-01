/**
 * Path utilities for SVG to canvas coordinate conversion.
 * Contains functions to convert SVG paths to canvas-compatible coordinates.
 * Note: Canvas and SVG share the same coordinate system (Y increases downward),
 * so no Y-axis inversion is needed.
 */

export type Point = [number, number];

export interface Point2D {
    x: number;
    y: number;
}

export interface Line {
    start: Point2D;
    end: Point2D;
}

export interface CubicBezier {
    start: Point2D;
    control1: Point2D;
    control2: Point2D;
    end: Point2D;
}

/**
 * Transform an X coordinate from SVG to canvas coordinate system.
 * 
 * @param xPos - SVG x coordinate
 * @param widgetX - Widget x position
 * @param widgetWidth - Widget width
 * @param svgWidth - SVG width
 * @param svgFile - SVG file path (for special kivy icon handling)
 * @returns Transformed x coordinate
 */
export function transformX(
    xPos: number,
    widgetX: number,
    widgetWidth: number,
    svgWidth: number,
    svgFile: string
): number {
    // Special handling for Kivy SVG icons (legacy compatibility)
    if (svgFile.includes('kivy')) {
        return widgetX + (widgetWidth * (xPos / 10) / svgWidth);
    }
    return widgetX + widgetWidth * xPos / svgWidth;
}

/**
 * Transform a Y coordinate from SVG to canvas coordinate system.
 * 
 * Note: Canvas has the same coordinate system as SVG (Y increases downward),
 * so no inversion is needed.
 * 
 * @param yPos - SVG y coordinate
 * @param widgetY - Widget y position
 * @param widgetHeight - Widget height
 * @param svgHeight - SVG height
 * @param svgFile - SVG file path (for special kivy icon handling)
 * @returns Transformed y coordinate
 */
export function transformY(
    yPos: number,
    widgetY: number,
    widgetHeight: number,
    svgHeight: number,
    svgFile: string
): number {
    // Special handling for Kivy SVG icons (legacy compatibility)
    if (svgFile.includes('kivy')) {
        return widgetY + (widgetHeight * (yPos / 10) / svgHeight);
    }
    // Canvas has same coordinate system as SVG - no Y inversion needed
    return widgetY + widgetHeight * yPos / svgHeight;
}

/**
 * Transform a point from SVG to canvas coordinate system.
 * 
 * @param point - SVG point
 * @param widgetSize - [width, height] of widget/canvas
 * @param widgetPos - [x, y] position of widget/canvas
 * @param svgSize - [width, height] of SVG
 * @param svgFile - SVG file path
 * @returns [x, y] transformed coordinates
 */
export function transformPoint(
    point: Point2D,
    widgetSize: Point,
    widgetPos: Point,
    svgSize: Point,
    svgFile: string
): Point {
    const [w, h] = widgetSize;
    const [wx, wy] = widgetPos;
    const [sw, sh] = svgSize;

    return [
        transformX(point.x, wx, w, sw, svgFile),
        transformY(point.y, wy, h, sh, svgFile)
    ];
}

/**
 * Convert a CubicBezier to canvas-compatible bezier points.
 * 
 * @param bezier - CubicBezier object
 * @param widgetSize - [width, height] of widget/canvas
 * @param widgetPos - [x, y] position of widget/canvas
 * @param svgSize - [width, height] of SVG
 * @param svgFile - SVG file path
 * @returns Array of points [x1, y1, cx1, cy1, cx2, cy2, x2, y2]
 */
export function bezierPoints(
    bezier: CubicBezier,
    widgetSize: Point,
    widgetPos: Point,
    svgSize: Point,
    svgFile: string
): number[] {
    return [
        ...transformPoint(bezier.start, widgetSize, widgetPos, svgSize, svgFile),
        ...transformPoint(bezier.control1, widgetSize, widgetPos, svgSize, svgFile),
        ...transformPoint(bezier.control2, widgetSize, widgetPos, svgSize, svgFile),
        ...transformPoint(bezier.end, widgetSize, widgetPos, svgSize, svgFile)
    ];
}

/**
 * Convert a Line to canvas-compatible line points.
 * 
 * @param line - Line object
 * @param widgetSize - [width, height] of widget/canvas
 * @param widgetPos - [x, y] position of widget/canvas
 * @param svgSize - [width, height] of SVG
 * @param svgFile - SVG file path
 * @returns Array of points [x1, y1, x2, y2]
 */
export function linePoints(
    line: Line,
    widgetSize: Point,
    widgetPos: Point,
    svgSize: Point,
    svgFile: string
): number[] {
    return [
        ...transformPoint(line.start, widgetSize, widgetPos, svgSize, svgFile),
        ...transformPoint(line.end, widgetSize, widgetPos, svgSize, svgFile)
    ];
}

// Bernstein polynomials for Bezier calculation
// https://stackoverflow.com/a/15399173/8871954
const B0_t = (t: number): number => Math.pow(1 - t, 3);
const B1_t = (t: number): number => 3 * t * Math.pow(1 - t, 2);
const B2_t = (t: number): number => 3 * Math.pow(t, 2) * (1 - t);
const B3_t = (t: number): number => Math.pow(t, 3);

/**
 * Generate discrete points along a cubic bezier curve.
 * 
 * @param start - Starting point [x, y]
 * @param control1 - First control point [x, y]
 * @param control2 - Second control point [x, y]
 * @param end - End point [x, y]
 * @param segments - Number of segments to generate (default: 100)
 * @returns Flattened array of points [x1, y1, x2, y2, ...]
 */
export function getAllPoints(
    start: Point,
    control1: Point,
    control2: Point,
    end: Point,
    segments: number = 100
): number[] {
    const points: number[] = [];
    const [ax, ay] = start;
    const [bx, by] = control1;
    const [cx, cy] = control2;
    const [dx, dy] = end;

    const seg = 1 / segments;
    let t = 0;

    while (t <= 1) {
        points.push(
            B0_t(t) * ax + B1_t(t) * bx + B2_t(t) * cx + B3_t(t) * dx,
            B0_t(t) * ay + B1_t(t) * by + B2_t(t) * cy + B3_t(t) * dy
        );
        t += seg;
    }

    return points;
}

/**
 * Find the center value of a sorted list.
 * 
 * @param sortedList - A sorted array of numbers
 * @returns The center value or average of the two middle values
 */
export function findCenter(sortedList: number[]): number {
    const middle = sortedList.length / 2;

    if (middle % 1 !== 0) {
        // Odd number of elements
        return sortedList[Math.floor(middle)];
    } else {
        // Even number of elements
        return (sortedList[middle] + sortedList[middle - 1]) / 2;
    }
}

/**
 * Helper function to create a Point2D from x and y coordinates.
 * 
 * @param x - The x coordinate
 * @param y - The y coordinate
 * @returns Point2D object
 */
export function createPoint(x: number, y: number): Point2D {
    return { x, y };
}