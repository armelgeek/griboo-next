/**
 * SVG Utility functions for server-side rendering
 */

export interface Point2D {
    x: number;
    y: number;
}

export interface PathElement {
    type: 'Line' | 'CubicBezier' | 'Move' | 'Close';
    start?: Point2D;
    end?: Point2D;
    control1?: Point2D;
    control2?: Point2D;
    x?: number;
    y?: number;
}

/**
 * Convert an SVG arc to cubic bezier curves.
 * Ported from frontend DrawingManager.
 */
export function arcToBezier(
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
    let curX = x1;
    let curY = y1;

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
            start: { x: curX, y: curY },
            control1: { x: cp1x, y: cp1y },
            control2: { x: cp2x, y: cp2y },
            end: { x: endX, y: endY }
        });

        currentTheta = nextTheta;
        curX = endX;
        curY = endY;
    }

    return elements;
}

/**
 * Convert basic SVG shapes to path data strings.
 */
export function shapeToPath(element: any): string | null {
    const type = element.tagName.toLowerCase();
    switch (type) {
        case 'rect': {
            const x = parseFloat(element.getAttribute('x') || '0');
            const y = parseFloat(element.getAttribute('y') || '0');
            const w = parseFloat(element.getAttribute('width') || '0');
            const h = parseFloat(element.getAttribute('height') || '0');
            const rx = parseFloat(element.getAttribute('rx') || '0');
            const ry = parseFloat(element.getAttribute('ry') || '0');

            if (rx > 0 || ry > 0) {
                // Rounded rect
                const r = rx || ry;
                return `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r} z`;
            }
            return `M${x},${y} h${w} v${h} h-${w} z`;
        }
        case 'circle': {
            const cx = parseFloat(element.getAttribute('cx') || '0');
            const cy = parseFloat(element.getAttribute('cy') || '0');
            const r = parseFloat(element.getAttribute('r') || '0');
            return `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 -${2 * r},0 z`;
        }
        case 'ellipse': {
            const cx = parseFloat(element.getAttribute('cx') || '0');
            const cy = parseFloat(element.getAttribute('cy') || '0');
            const rx = parseFloat(element.getAttribute('rx') || '0');
            const ry = parseFloat(element.getAttribute('ry') || '0');
            return `M${cx - rx},${cy} a${rx},${ry} 0 1 0 ${2 * rx},0 a${rx},${ry} 0 1 0 -${2 * rx},0 z`;
        }
        case 'line': {
            const x1 = parseFloat(element.getAttribute('x1') || '0');
            const y1 = parseFloat(element.getAttribute('y1') || '0');
            const x2 = parseFloat(element.getAttribute('x2') || '0');
            const y2 = parseFloat(element.getAttribute('y2') || '0');
            return `M${x1},${y1} L${x2},${y2}`;
        }
        case 'polyline':
        case 'polygon': {
            const points = element.getAttribute('points');
            if (!points) return null;
            const d = points.trim().split(/[\s,]+/).reduce((acc: string, val: string, i: number) => {
                return acc + (i % 2 === 0 ? (i === 0 ? 'M' : ' L') : ',') + val;
            }, '');
            return type === 'polygon' ? d + ' z' : d;
        }
    }
    return null;
}

/**
 * Draw SVG path commands onto a canvas context.
 */
export function drawPathCommands(ctx: any, commands: any[]): void {
    let lastX = 0;
    let lastY = 0;
    let lastC2X = 0;
    let lastC2Y = 0;
    let lastQ1X = 0;
    let lastQ1Y = 0;

    for (const cmd of commands) {
        switch (cmd.code) {
            case 'M':
                ctx.moveTo(cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                break;
            case 'L':
                ctx.lineTo(cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                break;
            case 'H':
                ctx.lineTo(cmd.x, lastY);
                lastX = cmd.x;
                break;
            case 'V':
                ctx.lineTo(lastX, cmd.y);
                lastY = cmd.y;
                break;
            case 'C':
                ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                lastC2X = cmd.x2;
                lastC2Y = cmd.y2;
                break;
            case 'S': {
                // Smooth cubic bezier
                const x1 = (['C', 'c', 'S', 's'].includes(cmd.previousCommand))
                    ? 2 * lastX - lastC2X
                    : lastX;
                const y1 = (['C', 'c', 'S', 's'].includes(cmd.previousCommand))
                    ? 2 * lastY - lastC2Y
                    : lastY;
                ctx.bezierCurveTo(x1, y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                lastC2X = cmd.x2;
                lastC2Y = cmd.y2;
                break;
            }
            case 'Q':
                ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                lastQ1X = cmd.x1;
                lastQ1Y = cmd.y1;
                break;
            case 'T': {
                // Smooth quadratic bezier
                const x1 = (['Q', 'q', 'T', 't'].includes(cmd.previousCommand))
                    ? 2 * lastX - lastQ1X
                    : lastX;
                const y1 = (['Q', 'q', 'T', 't'].includes(cmd.previousCommand))
                    ? 2 * lastY - lastQ1Y
                    : lastY;
                ctx.quadraticCurveTo(x1, y1, cmd.x, cmd.y);
                lastX = cmd.x;
                lastY = cmd.y;
                lastQ1X = x1;
                lastQ1Y = y1;
                break;
            }
            case 'A': {
                // Convert Arc to Beziers
                const beziers = arcToBezier(
                    lastX, lastY, cmd.x, cmd.y,
                    cmd.rx, cmd.ry, cmd.xAxisRotation,
                    cmd.largeArc, cmd.sweep
                );
                for (const b of beziers) {
                    if (b.type === 'CubicBezier' && b.control1 && b.control2 && b.end) {
                        ctx.bezierCurveTo(b.control1.x, b.control1.y, b.control2.x, b.control2.y, b.end.x, b.end.y);
                    } else if (b.type === 'Line' && b.end) {
                        ctx.lineTo(b.end.x, b.end.y);
                    }
                }
                lastX = cmd.x;
                lastY = cmd.y;
                break;
            }
            case 'Z':
                ctx.closePath();
                break;
        }
    }
}
