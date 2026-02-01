/**
 * DrawingManager handles SVG path processing and rendering preparation.
 */

import { Animation } from '../core/animations/animation';

import { getAllPoints, bezierPoints, linePoints, type Point, type Point2D, type Line, type CubicBezier } from '../drawing/path_utils';
import { parseSvg } from '../core/logic/svg_parser';

// SVG path parsing types
interface PathElement {
    type: 'Line' | 'CubicBezier' | 'Move' | 'Close';
    start?: Point2D;
    end?: Point2D;
    control1?: Point2D;
    control2?: Point2D;
    x?: number;
    y?: number;
}

interface ClosedShape {
    [key: string]: any;
    color: number[];
    stroke?: number[] | null;
    strokeWidth?: number | null;
}

/**
 * Handles the drawing and rendering of SVG paths.
 */
export class DrawingManager {
    /**
     * Process SVG file and extract path data.
     * 
     * @param svgContent - SVG content as string
     * @returns Object containing svg dimensions, closed shapes, and path elements
     */
    static async processPathData(svgContent: string): Promise<{
        svgSize: [number, number];
        closedShapes: Map<string, ClosedShape>;
        pathElements: PathElement[];
    }> {
        const { svgDimensions, pathData } = parseSvg(svgContent);

        const pathElements: PathElement[] = [];
        const closedShapes = new Map<string, ClosedShape>();

        for (const [pathString, id, attrs] of pathData) {
            const shape: ClosedShape = {
                [`${id}paths`]: [],
                [`${id}shapes`]: [],
                color: attrs.fill,
                stroke: attrs.stroke,
                strokeWidth: attrs.strokeWidth
            };

            // Parse path string and extract elements
            const parsedPath = this._parsePath(pathString);

            let moveFound = false;
            let tmp: PathElement[] = [];

            for (const element of parsedPath) {
                pathElements.push(element);

                if (element.type === 'Close' || (element.type === 'Move' && moveFound)) {
                    shape[`${id}paths`].push([...tmp]);
                    moveFound = false;
                }

                if (element.type === 'Move') {
                    tmp = [];
                    moveFound = true;
                }

                if (element.type !== 'Move' && moveFound) {
                    tmp.push(element);
                }
            }

            closedShapes.set(id, shape);
        }

        return {
            svgSize: svgDimensions,
            closedShapes,
            pathElements
        };
    }

    /**
     * Helper to check if a token is a command letter.
     */
    private static _isCommand(token: string): boolean {
        return /^[a-df-z]$/i.test(token);
    }

    /**
     * Parse an SVG path string into path elements.
     * Handles M, L, C, Z, H, V, S, Q, A commands and their lowercase relatives.
     * Also handles implicit repeated commands per SVG spec.
     */
    private static _parsePath(pathString: string): PathElement[] {
        const elements: PathElement[] = [];

        // Improved tokenization to handle numbers without spaces (e.g., "100.5.5")
        const tokens = pathString.match(/[a-df-z]|[\-+]?(?:\d+\.?\d*|\.?\d+)(?:e[\-+]?\d+)?/gi);

        if (!tokens) return elements;

        let i = 0;
        let currentX = 0;
        let currentY = 0;
        let startX = 0;
        let startY = 0;
        let lastCommand = '';
        let lastControl2X = 0;  // For smooth curves (S/s)
        let lastControl2Y = 0;
        let lastQControlX = 0;  // For smooth quadratic curves (T/t)
        let lastQControlY = 0;

        while (i < tokens.length) {
            let command = tokens[i];

            // Check if current token is a command or just continuation of previous command
            if (this._isCommand(command)) {
                i++;
            } else {
                // It's a number, so use implicit command continuation
                // After M/m, subsequent coords become L/l
                // For other commands, the same command is repeated
                if (lastCommand === 'M') {
                    command = 'L';
                } else if (lastCommand === 'm') {
                    command = 'l';
                } else {
                    command = lastCommand;
                }
            }

            switch (command) {
                case 'M': {
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    elements.push({ type: 'Move', x, y });
                    currentX = x;
                    currentY = y;
                    startX = x;
                    startY = y;
                    lastCommand = 'M';
                    break;
                }
                case 'L': {
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x, y }
                    });
                    currentX = x;
                    currentY = y;
                    lastCommand = 'L';
                    break;
                }
                case 'C': {
                    const x1 = parseFloat(tokens[i++]);
                    const y1 = parseFloat(tokens[i++]);
                    const x2 = parseFloat(tokens[i++]);
                    const y2 = parseFloat(tokens[i++]);
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: x1, y: y1 },
                        control2: { x: x2, y: y2 },
                        end: { x, y }
                    });
                    lastControl2X = x2;
                    lastControl2Y = y2;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'C';
                    break;
                }
                case 'Z':
                case 'z': {
                    elements.push({ type: 'Close' });
                    currentX = startX;
                    currentY = startY;
                    lastCommand = 'Z';
                    break;
                }
                case 'm': {
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);
                    const x = currentX + dx;
                    const y = currentY + dy;
                    elements.push({ type: 'Move', x, y });
                    currentX = x;
                    currentY = y;
                    startX = x;
                    startY = y;
                    lastCommand = 'm';
                    break;
                }
                case 'l': {
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);
                    const x = currentX + dx;
                    const y = currentY + dy;
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x, y }
                    });
                    currentX = x;
                    currentY = y;
                    lastCommand = 'l';
                    break;
                }
                case 'c': {
                    const dx1 = parseFloat(tokens[i++]);
                    const dy1 = parseFloat(tokens[i++]);
                    const dx2 = parseFloat(tokens[i++]);
                    const dy2 = parseFloat(tokens[i++]);
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);

                    const x1 = currentX + dx1;
                    const y1 = currentY + dy1;
                    const x2 = currentX + dx2;
                    const y2 = currentY + dy2;
                    const x = currentX + dx;
                    const y = currentY + dy;

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: x1, y: y1 },
                        control2: { x: x2, y: y2 },
                        end: { x, y }
                    });
                    lastControl2X = x2;
                    lastControl2Y = y2;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'c';
                    break;
                }
                case 'A': {
                    // Parse arc parameters (consume them from tokens)
                    const rx = parseFloat(tokens[i++]);
                    const ry = parseFloat(tokens[i++]);
                    const xAxisRotation = parseFloat(tokens[i++]);
                    const largeArcFlag = parseFloat(tokens[i++]);
                    const sweepFlag = parseFloat(tokens[i++]);
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);

                    // Convert arc to bezier curves for better approximation
                    const arcElements = this._arcToBezier(
                        currentX, currentY, x, y, rx, ry,
                        xAxisRotation, largeArcFlag !== 0, sweepFlag !== 0
                    );
                    elements.push(...arcElements);

                    currentX = x;
                    currentY = y;
                    lastCommand = 'A';
                    break;
                }
                case 'a': {
                    // Parse arc parameters (consume them from tokens)
                    const rx = parseFloat(tokens[i++]);
                    const ry = parseFloat(tokens[i++]);
                    const xAxisRotation = parseFloat(tokens[i++]);
                    const largeArcFlag = parseFloat(tokens[i++]);
                    const sweepFlag = parseFloat(tokens[i++]);
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);

                    const x = currentX + dx;
                    const y = currentY + dy;

                    // Convert arc to bezier curves for better approximation
                    const arcElements = this._arcToBezier(
                        currentX, currentY, x, y, rx, ry,
                        xAxisRotation, largeArcFlag !== 0, sweepFlag !== 0
                    );
                    elements.push(...arcElements);

                    currentX = x;
                    currentY = y;
                    lastCommand = 'a';
                    break;
                }
                case 'H': {
                    // Absolute horizontal line
                    const x = parseFloat(tokens[i++]);
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x, y: currentY }
                    });
                    currentX = x;
                    lastCommand = 'H';
                    break;
                }
                case 'h': {
                    // Relative horizontal line
                    const dx = parseFloat(tokens[i++]);
                    const x = currentX + dx;
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x, y: currentY }
                    });
                    currentX = x;
                    lastCommand = 'h';
                    break;
                }
                case 'V': {
                    // Absolute vertical line
                    const y = parseFloat(tokens[i++]);
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x: currentX, y }
                    });
                    currentY = y;
                    lastCommand = 'V';
                    break;
                }
                case 'v': {
                    // Relative vertical line
                    const dy = parseFloat(tokens[i++]);
                    const y = currentY + dy;
                    elements.push({
                        type: 'Line',
                        start: { x: currentX, y: currentY },
                        end: { x: currentX, y }
                    });
                    currentY = y;
                    lastCommand = 'v';
                    break;
                }
                case 'S': {
                    // Smooth cubic bezier (absolute)
                    // Control point 1 is the reflection of the previous control point 2
                    const x2 = parseFloat(tokens[i++]);
                    const y2 = parseFloat(tokens[i++]);
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);

                    // Calculate reflected control point
                    let x1: number, y1: number;
                    if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
                        x1 = 2 * currentX - lastControl2X;
                        y1 = 2 * currentY - lastControl2Y;
                    } else {
                        x1 = currentX;
                        y1 = currentY;
                    }

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: x1, y: y1 },
                        control2: { x: x2, y: y2 },
                        end: { x, y }
                    });
                    lastControl2X = x2;
                    lastControl2Y = y2;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'S';
                    break;
                }
                case 's': {
                    // Smooth cubic bezier (relative)
                    const dx2 = parseFloat(tokens[i++]);
                    const dy2 = parseFloat(tokens[i++]);
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);

                    const x2 = currentX + dx2;
                    const y2 = currentY + dy2;
                    const x = currentX + dx;
                    const y = currentY + dy;

                    // Calculate reflected control point
                    let x1: number, y1: number;
                    if (lastCommand === 'C' || lastCommand === 'c' || lastCommand === 'S' || lastCommand === 's') {
                        x1 = 2 * currentX - lastControl2X;
                        y1 = 2 * currentY - lastControl2Y;
                    } else {
                        x1 = currentX;
                        y1 = currentY;
                    }

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: x1, y: y1 },
                        control2: { x: x2, y: y2 },
                        end: { x, y }
                    });
                    lastControl2X = x2;
                    lastControl2Y = y2;
                    currentX = x;
                    currentY = y;
                    lastCommand = 's';
                    break;
                }
                case 'Q': {
                    // Quadratic bezier (absolute) - convert to cubic
                    const qx = parseFloat(tokens[i++]);
                    const qy = parseFloat(tokens[i++]);
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);

                    // Convert quadratic to cubic bezier
                    const cp1x = currentX + (2 / 3) * (qx - currentX);
                    const cp1y = currentY + (2 / 3) * (qy - currentY);
                    const cp2x = x + (2 / 3) * (qx - x);
                    const cp2y = y + (2 / 3) * (qy - y);

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: cp1x, y: cp1y },
                        control2: { x: cp2x, y: cp2y },
                        end: { x, y }
                    });
                    lastQControlX = qx;
                    lastQControlY = qy;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'Q';
                    break;
                }
                case 'q': {
                    // Quadratic bezier (relative) - convert to cubic
                    const dqx = parseFloat(tokens[i++]);
                    const dqy = parseFloat(tokens[i++]);
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);

                    const qx = currentX + dqx;
                    const qy = currentY + dqy;
                    const x = currentX + dx;
                    const y = currentY + dy;

                    // Convert quadratic to cubic bezier
                    const cp1x = currentX + (2 / 3) * (qx - currentX);
                    const cp1y = currentY + (2 / 3) * (qy - currentY);
                    const cp2x = x + (2 / 3) * (qx - x);
                    const cp2y = y + (2 / 3) * (qy - y);

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: cp1x, y: cp1y },
                        control2: { x: cp2x, y: cp2y },
                        end: { x, y }
                    });
                    lastQControlX = qx;
                    lastQControlY = qy;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'q';
                    break;
                }
                case 'T': {
                    // Smooth quadratic bezier (absolute)
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);

                    // Calculate reflected control point
                    let qx: number, qy: number;
                    if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
                        qx = 2 * currentX - lastQControlX;
                        qy = 2 * currentY - lastQControlY;
                    } else {
                        qx = currentX;
                        qy = currentY;
                    }

                    // Convert quadratic to cubic bezier
                    const cp1x = currentX + (2 / 3) * (qx - currentX);
                    const cp1y = currentY + (2 / 3) * (qy - currentY);
                    const cp2x = x + (2 / 3) * (qx - x);
                    const cp2y = y + (2 / 3) * (qy - y);

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: cp1x, y: cp1y },
                        control2: { x: cp2x, y: cp2y },
                        end: { x, y }
                    });
                    lastQControlX = qx;
                    lastQControlY = qy;
                    currentX = x;
                    currentY = y;
                    lastCommand = 'T';
                    break;
                }
                case 't': {
                    // Smooth quadratic bezier (relative)
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);

                    const x = currentX + dx;
                    const y = currentY + dy;

                    // Calculate reflected control point
                    let qx: number, qy: number;
                    if (lastCommand === 'Q' || lastCommand === 'q' || lastCommand === 'T' || lastCommand === 't') {
                        qx = 2 * currentX - lastQControlX;
                        qy = 2 * currentY - lastQControlY;
                    } else {
                        qx = currentX;
                        qy = currentY;
                    }

                    // Convert quadratic to cubic bezier
                    const cp1x = currentX + (2 / 3) * (qx - currentX);
                    const cp1y = currentY + (2 / 3) * (qy - currentY);
                    const cp2x = x + (2 / 3) * (qx - x);
                    const cp2y = y + (2 / 3) * (qy - y);

                    elements.push({
                        type: 'CubicBezier',
                        start: { x: currentX, y: currentY },
                        control1: { x: cp1x, y: cp1y },
                        control2: { x: cp2x, y: cp2y },
                        end: { x, y }
                    });
                    lastQControlX = qx;
                    lastQControlY = qy;
                    currentX = x;
                    currentY = y;
                    lastCommand = 't';
                    break;
                }
                default:
                    break;
            }
        }

        return elements;
    }

    /**
     * Convert an SVG arc to cubic bezier curves.
     * This provides a better approximation than a simple line.
     */
    private static _arcToBezier(
        x1: number, y1: number,
        x2: number, y2: number,
        rx: number, ry: number,
        xAxisRotation: number,
        largeArcFlag: boolean,
        sweepFlag: boolean
    ): PathElement[] {
        // Handle edge cases
        if (rx === 0 || ry === 0) {
            return [{
                type: 'Line',
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 }
            }];
        }

        // Ensure radii are positive
        rx = Math.abs(rx);
        ry = Math.abs(ry);

        const phi = xAxisRotation * Math.PI / 180;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        // Step 1: Compute (x1', y1')
        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;
        const x1p = cosPhi * dx + sinPhi * dy;
        const y1p = -sinPhi * dx + cosPhi * dy;

        // Step 2: Compute (cx', cy')
        const x1pSq = x1p * x1p;
        const y1pSq = y1p * y1p;
        const rxSq = rx * rx;
        const rySq = ry * ry;

        // Correct radii if they're too small
        const lambda = x1pSq / rxSq + y1pSq / rySq;
        if (lambda > 1) {
            const sqrtLambda = Math.sqrt(lambda);
            rx *= sqrtLambda;
            ry *= sqrtLambda;
        }

        // Compute center point
        const rxSqNew = rx * rx;
        const rySqNew = ry * ry;

        let sq = Math.max(0, (rxSqNew * rySqNew - rxSqNew * y1pSq - rySqNew * x1pSq) /
            (rxSqNew * y1pSq + rySqNew * x1pSq));
        sq = Math.sqrt(sq);

        if (largeArcFlag === sweepFlag) {
            sq = -sq;
        }

        const cxp = sq * rx * y1p / ry;
        const cyp = -sq * ry * x1p / rx;

        // Step 3: Compute (cx, cy) from (cx', cy')
        const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
        const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

        // Step 4: Compute theta1 and dtheta
        const ux = (x1p - cxp) / rx;
        const uy = (y1p - cyp) / ry;
        const vx = (-x1p - cxp) / rx;
        const vy = (-y1p - cyp) / ry;

        const n = Math.sqrt(ux * ux + uy * uy);
        let p = ux;
        let theta1 = (uy < 0 ? -1 : 1) * Math.acos(p / n);

        p = ux * vx + uy * vy;
        const nn = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
        let dtheta = (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(Math.max(-1, Math.min(1, p / nn)));

        if (!sweepFlag && dtheta > 0) {
            dtheta -= 2 * Math.PI;
        } else if (sweepFlag && dtheta < 0) {
            dtheta += 2 * Math.PI;
        }

        // Convert to bezier curves
        const segments = Math.ceil(Math.abs(dtheta) / (Math.PI / 2));
        const delta = dtheta / segments;
        const t = (8 / 3) * Math.sin(delta / 4) * Math.sin(delta / 4) / Math.sin(delta / 2);

        const elements: PathElement[] = [];
        let currentTheta = theta1;
        let currentX = x1;
        let currentY = y1;

        for (let i = 0; i < segments; i++) {
            const nextTheta = currentTheta + delta;

            const cosTheta1 = Math.cos(currentTheta);
            const sinTheta1 = Math.sin(currentTheta);
            const cosTheta2 = Math.cos(nextTheta);
            const sinTheta2 = Math.sin(nextTheta);

            // Control point 1
            const cp1x = cx + cosPhi * rx * (cosTheta1 - t * sinTheta1) - sinPhi * ry * (sinTheta1 + t * cosTheta1);
            const cp1y = cy + sinPhi * rx * (cosTheta1 - t * sinTheta1) + cosPhi * ry * (sinTheta1 + t * cosTheta1);

            // Control point 2
            const cp2x = cx + cosPhi * rx * (cosTheta2 + t * sinTheta2) - sinPhi * ry * (sinTheta2 - t * cosTheta2);
            const cp2y = cy + sinPhi * rx * (cosTheta2 + t * sinTheta2) + cosPhi * ry * (sinTheta2 - t * cosTheta2);

            // End point
            const endX = cx + cosPhi * rx * cosTheta2 - sinPhi * ry * sinTheta2;
            const endY = cy + sinPhi * rx * cosTheta2 + cosPhi * ry * sinTheta2;

            elements.push({
                type: 'CubicBezier',
                start: { x: currentX, y: currentY },
                control1: { x: cp1x, y: cp1y },
                control2: { x: cp2x, y: cp2y },
                end: { x: endX, y: endY }
            });

            currentTheta = nextTheta;
            currentX = endX;
            currentY = endY;
        }

        return elements;
    }

    /**
     * Calculate and set up path properties for rendering.
     * 
     * @param widget - Widget to draw on
     * @param closedShapes - Path data organized by shape ID
     * @param svgSize - SVG dimensions [width, height]
     * @param svgFile - SVG file path/name
     * @param animate - Whether to animate the drawing
     * @param lineWidth - Width of the drawn lines
     * @param duration - Duration for each animation step
     * @returns Array of Animation objects if animate=true
     */
    static calculatePaths(
        widget: any,
        closedShapes: Map<string, ClosedShape>,
        svgSize: Point,
        svgFile: string,
        animate: boolean = false,
        lineWidth: number = 2,
        duration: number = 0.02
    ): Animation[] {
        let lineCount = 0;
        let bezierCount = 0;
        const animList: Animation[] = [];

        for (const [id, closedPaths] of closedShapes.entries()) {
            const paths = closedPaths[`${id}paths`] || [];

            for (const pathSegments of paths) {
                const tmp: number[] = [];

                for (const element of pathSegments) {
                    if (this._isLine(element)) {
                        const lp = linePoints(
                            element as Line,
                            [widget.width, widget.height],
                            [widget.pos[0], widget.pos[1]],
                            svgSize,
                            svgFile
                        );

                        this._setupLineProperties(
                            widget,
                            lineCount,
                            lp,
                            animate,
                            lineWidth
                        );

                        // Store stroke information for this line
                        widget[`line${lineCount}_stroke_color`] = closedPaths.stroke;
                        widget[`line${lineCount}_stroke_width`] = closedPaths.strokeWidth;

                        if (animate) {
                            animList.push(
                                new Animation({
                                    duration,
                                    [`line${lineCount}_end_x`]: lp[2],
                                    [`line${lineCount}_end_y`]: lp[3],
                                    [`line${lineCount}_width`]: lineWidth
                                })
                            );
                        }

                        lineCount++;
                        tmp.push(...lp);

                    } else if (this._isCubicBezier(element)) {
                        const bp = bezierPoints(
                            element as CubicBezier,
                            [widget.width, widget.height],
                            [widget.pos[0], widget.pos[1]],
                            svgSize,
                            svgFile
                        );

                        this._setupBezierProperties(
                            widget,
                            bezierCount,
                            bp,
                            animate,
                            lineWidth
                        );

                        // Store stroke information for this bezier
                        widget[`bezier${bezierCount}_stroke_color`] = closedPaths.stroke;
                        widget[`bezier${bezierCount}_stroke_width`] = closedPaths.strokeWidth;

                        if (animate) {
                            animList.push(
                                new Animation({
                                    duration,
                                    [`bezier${bezierCount}_control1_x`]: bp[2],
                                    [`bezier${bezierCount}_control1_y`]: bp[3],
                                    [`bezier${bezierCount}_control2_x`]: bp[4],
                                    [`bezier${bezierCount}_control2_y`]: bp[5],
                                    [`bezier${bezierCount}_end_x`]: bp[6],
                                    [`bezier${bezierCount}_end_y`]: bp[7],
                                    [`bezier${bezierCount}_width`]: lineWidth
                                })
                            );
                        }

                        bezierCount++;

                        const points = getAllPoints(
                            [bp[0], bp[1]],
                            [bp[2], bp[3]],
                            [bp[4], bp[5]],
                            [bp[6], bp[7]]
                        );
                        tmp.push(...points);
                    }
                }

                const shapes = closedPaths[`${id}shapes`] || [];
                if (!shapes.some((s: number[]) => this._arraysEqual(s, tmp))) {
                    shapes.push(tmp);
                }
            }
        }

        return animList;
    }

    /**
     * Set up line properties on the widget.
     */
    private static _setupLineProperties(
        widget: any,
        lineIndex: number,
        linePoints: number[],
        animate: boolean,
        lineWidth: number
    ): void {
        widget[`line${lineIndex}_start_x`] = linePoints[0];
        widget[`line${lineIndex}_start_y`] = linePoints[1];
        widget[`line${lineIndex}_end_x`] = animate ? linePoints[0] : linePoints[2];
        widget[`line${lineIndex}_end_y`] = animate ? linePoints[1] : linePoints[3];
        widget[`line${lineIndex}_width`] = animate ? 1 : lineWidth;
    }

    /**
     * Set up bezier curve properties on the widget.
     */
    private static _setupBezierProperties(
        widget: any,
        bezierIndex: number,
        bezierPoints: number[],
        animate: boolean,
        lineWidth: number
    ): void {
        // Start point
        widget[`bezier${bezierIndex}_start_x`] = bezierPoints[0];
        widget[`bezier${bezierIndex}_start_y`] = bezierPoints[1];

        // Control points
        widget[`bezier${bezierIndex}_control1_x`] = animate ? bezierPoints[0] : bezierPoints[2];
        widget[`bezier${bezierIndex}_control1_y`] = animate ? bezierPoints[1] : bezierPoints[3];
        widget[`bezier${bezierIndex}_control2_x`] = animate ? bezierPoints[0] : bezierPoints[4];
        widget[`bezier${bezierIndex}_control2_y`] = animate ? bezierPoints[1] : bezierPoints[5];

        // End point
        widget[`bezier${bezierIndex}_end_x`] = animate ? bezierPoints[0] : bezierPoints[6];
        widget[`bezier${bezierIndex}_end_y`] = animate ? bezierPoints[1] : bezierPoints[7];

        // Width
        widget[`bezier${bezierIndex}_width`] = animate ? 1 : lineWidth;
    }

    /**
     * Type guard to check if element is a Line.
     */
    private static _isLine(element: PathElement): boolean {
        return element.type === 'Line';
    }

    /**
     * Type guard to check if element is a CubicBezier.
     */
    private static _isCubicBezier(element: PathElement): boolean {
        return element.type === 'CubicBezier';
    }

    /**
     * Check if two arrays are equal.
     */
    private static _arraysEqual(a: number[], b: number[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (Math.abs(a[i] - b[i]) > 0.001) return false;
        }
        return true;
    }

    /**
     * Create a simple drawing animation sequence.
     * 
     * @param animations - Array of animations to sequence
     * @returns Combined sequential animation
     */
    static createDrawingSequence(animations: Animation[]): Animation | null {
        if (animations.length === 0) {
            return null;
        }

        let combined = animations[0];
        for (let i = 1; i < animations.length; i++) {
            combined = combined.then(animations[i]);
        }

        return combined;
    }

    /**
     * Reset all drawing properties on a widget.
     * 
     * @param widget - Widget to reset
     * @param lineCount - Number of lines to reset
     * @param bezierCount - Number of bezier curves to reset
     */
    static resetDrawingProperties(
        widget: any,
        lineCount: number,
        bezierCount: number
    ): void {
        for (let i = 0; i < lineCount; i++) {
            delete widget[`line${i}_start_x`];
            delete widget[`line${i}_start_y`];
            delete widget[`line${i}_end_x`];
            delete widget[`line${i}_end_y`];
            delete widget[`line${i}_width`];
            delete widget[`line${i}_stroke_color`];
            delete widget[`line${i}_stroke_width`];
        }

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
}