/**
 * SVG parsing utilities.
 * Handles parsing SVG files and extracting path data and text elements.
 */

import { hexToRgba, colorTo01Range } from '../../../shared/utils/color_utils';


export interface PathAttributes {
    fill: number[];
    stroke: number[] | null;
    strokeWidth: number | null;
}

export type PathData = [string, string, PathAttributes];

export interface TextElement {
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    fill: number[];
    stroke: number[] | null;
    strokeWidth: number | null;
    textAnchor: string;
    dominantBaseline: string;
    letterSpacing: number;
    textDecoration: string;
    opacity: number;
    id: string;
}

/**
 * Extract the first color from a gradient definition.
 * 
 * @param doc - Parsed SVG document
 * @param gradientUrl - URL reference like 'url(#gradientId)'
 * @returns RGBA color array in 0-1 range, or null if not found
 */
function extractGradientColor(doc: Document, gradientUrl: string): number[] | null {
    // Extract gradient ID from url(#id) format
    const match = gradientUrl.match(/url\s*\(\s*#([^)]+)\s*\)/i);
    if (!match) {
        return null;
    }

    const gradientId = match[1];
    const gradient = doc.getElementById(gradientId);

    if (!gradient) {
        return null;
    }

    // Find the first stop element with a color
    const stops = gradient.querySelectorAll('stop');
    if (stops.length === 0) {
        return null;
    }

    // Get the first stop's color
    const firstStop = stops[0];
    let stopColor = firstStop.getAttribute('stop-color');

    // If stop-color is not present, try to get it from style attribute
    if (!stopColor) {
        const style = firstStop.getAttribute('style');
        if (style) {
            const colorMatch = style.match(/stop-color\s*:\s*([^;]+)/i);
            if (colorMatch) {
                stopColor = colorMatch[1].trim();
            }
        }
    }

    if (!stopColor) {
        return null;
    }

    try {
        const rgba = hexToRgba(stopColor);
        return colorTo01Range(rgba);
    } catch (error) {
        return null;
    }
}

/**
 * Parse SVG length value (e.g., '12px', '10', '1.5em') to float.
 * 
 * @param value - SVG length string
 * @returns Float value or null if parsing fails
 */
function parseLength(value: string): number | null {
    if (!value) {
        return null;
    }

    // Remove common units and parse the numeric value
    const trimmed = value.trim();
    // Match valid decimal numbers (with optional decimal point and digits)
    const match = trimmed.match(/^(\d*\.?\d+)\s*(px|pt|em|rem|%)?$/i);

    if (match) {
        try {
            let num = parseFloat(match[1]);
            const unit = match[2];

            // Convert pt to px (1pt = 1.333px approximately)
            if (unit && unit.toLowerCase() === 'pt') {
                num *= 1.333;
            }

            return num;
        } catch (error) {
            return null;
        }
    }

    return null;
}

/**
 * Interface for 2D transform matrix
 */
interface Transform {
    a: number; // scale x
    b: number; // skew y
    c: number; // skew x
    d: number; // scale y
    e: number; // translate x
    f: number; // translate y
}

/**
 * Create an identity transform
 */
function identityTransform(): Transform {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * Multiply two transform matrices
 */
function multiplyTransforms(t1: Transform, t2: Transform): Transform {
    return {
        a: t1.a * t2.a + t1.c * t2.b,
        b: t1.b * t2.a + t1.d * t2.b,
        c: t1.a * t2.c + t1.c * t2.d,
        d: t1.b * t2.c + t1.d * t2.d,
        e: t1.a * t2.e + t1.c * t2.f + t1.e,
        f: t1.b * t2.e + t1.d * t2.f + t1.f
    };
}

/**
 * Apply transform to a point
 */
function applyTransform(x: number, y: number, t: Transform): [number, number] {
    return [
        t.a * x + t.c * y + t.e,
        t.b * x + t.d * y + t.f
    ];
}

/**
 * Parse SVG transform attribute string into a Transform
 */
function parseTransform(transformStr: string): Transform {
    let result = identityTransform();

    if (!transformStr) return result;

    // Match transform functions like translate(x,y), scale(x,y), rotate(angle), matrix(a,b,c,d,e,f)
    const transformRegex = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(\s*([^)]+)\s*\)/gi;
    let match;

    while ((match = transformRegex.exec(transformStr)) !== null) {
        const func = match[1].toLowerCase();
        const args = match[2].split(/[\s,]+/).map(parseFloat);

        let t: Transform = identityTransform();

        switch (func) {
            case 'translate': {
                const tx = args[0] || 0;
                const ty = args[1] !== undefined ? args[1] : 0;
                t = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
                break;
            }
            case 'scale': {
                const sx = args[0] || 1;
                const sy = args[1] !== undefined ? args[1] : sx;
                t = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
                break;
            }
            case 'rotate': {
                const angle = (args[0] || 0) * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                if (args.length === 3) {
                    // rotate(angle, cx, cy)
                    const cx = args[1];
                    const cy = args[2];
                    t = {
                        a: cos, b: sin, c: -sin, d: cos,
                        e: cx - cos * cx + sin * cy,
                        f: cy - sin * cx - cos * cy
                    };
                } else {
                    t = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
                }
                break;
            }
            case 'matrix': {
                t = {
                    a: args[0] || 1,
                    b: args[1] || 0,
                    c: args[2] || 0,
                    d: args[3] || 1,
                    e: args[4] || 0,
                    f: args[5] || 0
                };
                break;
            }
            case 'skewx': {
                const angle = (args[0] || 0) * Math.PI / 180;
                t = { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
                break;
            }
            case 'skewy': {
                const angle = (args[0] || 0) * Math.PI / 180;
                t = { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
                break;
            }
        }

        result = multiplyTransforms(result, t);
    }

    return result;
}

/**
 * Apply transform to all coordinates in a path string
 */
function transformPath(pathStr: string, transform: Transform): string {
    if (transform.a === 1 && transform.b === 0 && transform.c === 0 &&
        transform.d === 1 && transform.e === 0 && transform.f === 0) {
        // Identity transform, return as is
        return pathStr;
    }

    // Parse and transform path coordinates
    const tokens = pathStr.match(/[a-df-z]|[\-+]?(?:\d+\.?\d*|\.?\d+)(?:e[\-+]?\d+)?/gi);
    if (!tokens) return pathStr;

    let result = '';
    let i = 0;
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    const isCommand = (token: string) => /^[a-df-z]$/i.test(token);

    while (i < tokens.length) {
        const command = tokens[i];
        if (!isCommand(command)) {
            i++;
            continue;
        }
        i++;
        result += command;

        switch (command) {
            case 'M':
            case 'L': {
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                const [tx, ty] = applyTransform(x, y, transform);
                result += ` ${tx} ${ty} `;
                currentX = x;
                currentY = y;
                if (command === 'M') {
                    startX = x;
                    startY = y;
                }
                break;
            }
            case 'm':
            case 'l': {
                const dx = parseFloat(tokens[i++]);
                const dy = parseFloat(tokens[i++]);
                // For relative commands, only apply rotation/scale, not translation
                const [tdx, tdy] = applyTransform(dx, dy, { ...transform, e: 0, f: 0 });
                result += ` ${tdx} ${tdy} `;
                currentX += dx;
                currentY += dy;
                if (command === 'm') {
                    startX = currentX;
                    startY = currentY;
                }
                break;
            }
            case 'H': {
                const x = parseFloat(tokens[i++]);
                const [tx, ty] = applyTransform(x, currentY, transform);
                // H becomes L after transform if there's rotation
                if (transform.b !== 0 || transform.c !== 0) {
                    result = result.slice(0, -1) + 'L';
                    result += ` ${tx} ${ty} `;
                } else {
                    result += ` ${tx} `;
                }
                currentX = x;
                break;
            }
            case 'h': {
                const dx = parseFloat(tokens[i++]);
                const [tdx, tdy] = applyTransform(dx, 0, { ...transform, e: 0, f: 0 });
                if (transform.b !== 0 || transform.c !== 0) {
                    result = result.slice(0, -1) + 'l';
                    result += ` ${tdx} ${tdy} `;
                } else {
                    result += ` ${tdx} `;
                }
                currentX += dx;
                break;
            }
            case 'V': {
                const y = parseFloat(tokens[i++]);
                const [tx, ty] = applyTransform(currentX, y, transform);
                if (transform.b !== 0 || transform.c !== 0) {
                    result = result.slice(0, -1) + 'L';
                    result += ` ${tx} ${ty} `;
                } else {
                    result += ` ${ty} `;
                }
                currentY = y;
                break;
            }
            case 'v': {
                const dy = parseFloat(tokens[i++]);
                const [tdx, tdy] = applyTransform(0, dy, { ...transform, e: 0, f: 0 });
                if (transform.b !== 0 || transform.c !== 0) {
                    result = result.slice(0, -1) + 'l';
                    result += ` ${tdx} ${tdy} `;
                } else {
                    result += ` ${tdy} `;
                }
                currentY += dy;
                break;
            }
            case 'C': {
                for (let j = 0; j < 3; j++) {
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    const [tx, ty] = applyTransform(x, y, transform);
                    result += ` ${tx} ${ty}`;
                    if (j === 2) {
                        currentX = x;
                        currentY = y;
                    }
                }
                result += ' ';
                break;
            }
            case 'c': {
                for (let j = 0; j < 3; j++) {
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);
                    const [tdx, tdy] = applyTransform(dx, dy, { ...transform, e: 0, f: 0 });
                    result += ` ${tdx} ${tdy}`;
                    if (j === 2) {
                        currentX += dx;
                        currentY += dy;
                    }
                }
                result += ' ';
                break;
            }
            case 'S':
            case 'Q': {
                for (let j = 0; j < 2; j++) {
                    const x = parseFloat(tokens[i++]);
                    const y = parseFloat(tokens[i++]);
                    const [tx, ty] = applyTransform(x, y, transform);
                    result += ` ${tx} ${ty}`;
                    if (j === 1) {
                        currentX = x;
                        currentY = y;
                    }
                }
                result += ' ';
                break;
            }
            case 's':
            case 'q': {
                for (let j = 0; j < 2; j++) {
                    const dx = parseFloat(tokens[i++]);
                    const dy = parseFloat(tokens[i++]);
                    const [tdx, tdy] = applyTransform(dx, dy, { ...transform, e: 0, f: 0 });
                    result += ` ${tdx} ${tdy}`;
                    if (j === 1) {
                        currentX += dx;
                        currentY += dy;
                    }
                }
                result += ' ';
                break;
            }
            case 'T': {
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                const [tx, ty] = applyTransform(x, y, transform);
                result += ` ${tx} ${ty} `;
                currentX = x;
                currentY = y;
                break;
            }
            case 't': {
                const dx = parseFloat(tokens[i++]);
                const dy = parseFloat(tokens[i++]);
                const [tdx, tdy] = applyTransform(dx, dy, { ...transform, e: 0, f: 0 });
                result += ` ${tdx} ${tdy} `;
                currentX += dx;
                currentY += dy;
                break;
            }
            case 'A': {
                const rx = parseFloat(tokens[i++]);
                const ry = parseFloat(tokens[i++]);
                const xRotation = parseFloat(tokens[i++]);
                const largeArc = tokens[i++];
                const sweep = tokens[i++];
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                // For arcs, we need to transform radii and endpoint
                const [tx, ty] = applyTransform(x, y, transform);
                // Scale radii (simplified - doesn't handle rotation properly)
                const trx = rx * Math.sqrt(transform.a * transform.a + transform.c * transform.c);
                const tryVal = ry * Math.sqrt(transform.b * transform.b + transform.d * transform.d);
                result += ` ${trx} ${tryVal} ${xRotation} ${largeArc} ${sweep} ${tx} ${ty} `;
                currentX = x;
                currentY = y;
                break;
            }
            case 'a': {
                const rx = parseFloat(tokens[i++]);
                const ry = parseFloat(tokens[i++]);
                const xRotation = parseFloat(tokens[i++]);
                const largeArc = tokens[i++];
                const sweep = tokens[i++];
                const dx = parseFloat(tokens[i++]);
                const dy = parseFloat(tokens[i++]);
                const [tdx, tdy] = applyTransform(dx, dy, { ...transform, e: 0, f: 0 });
                const trx = rx * Math.sqrt(transform.a * transform.a + transform.c * transform.c);
                const tryVal = ry * Math.sqrt(transform.b * transform.b + transform.d * transform.d);
                result += ` ${trx} ${tryVal} ${xRotation} ${largeArc} ${sweep} ${tdx} ${tdy} `;
                currentX += dx;
                currentY += dy;
                break;
            }
            case 'Z':
            case 'z':
                result += ' ';
                currentX = startX;
                currentY = startY;
                break;
            default:
                break;
        }
    }

    return result.trim();
}

/**
 * Convert a circle element to a path string
 */
function circleToPath(cx: number, cy: number, r: number): string {
    // Using two arc commands to create a full circle
    return `M ${cx - r} ${cy} ` +
        `A ${r} ${r} 0 1 0 ${cx + r} ${cy} ` +
        `A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/**
 * Convert an ellipse element to a path string
 */
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string {
    return `M ${cx - rx} ${cy} ` +
        `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} ` +
        `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

/**
 * Convert a rect element to a path string
 */
function rectToPath(x: number, y: number, width: number, height: number, rx: number = 0, ry: number = 0): string {
    if (rx === 0 && ry === 0) {
        // Simple rectangle without rounded corners
        return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    }

    // Rectangle with rounded corners
    // Clamp rx and ry to half the width/height
    rx = Math.min(rx, width / 2);
    ry = Math.min(ry, height / 2);

    return `M ${x + rx} ${y} ` +
        `L ${x + width - rx} ${y} ` +
        `A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry} ` +
        `L ${x + width} ${y + height - ry} ` +
        `A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height} ` +
        `L ${x + rx} ${y + height} ` +
        `A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry} ` +
        `L ${x} ${y + ry} ` +
        `A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
}

/**
 * Convert a line element to a path string
 */
function lineToPath(x1: number, y1: number, x2: number, y2: number): string {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * Convert a polyline element to a path string
 */
function polylineToPath(points: string): string {
    const coords = points.trim().split(/[\s,]+/).map(parseFloat);
    if (coords.length < 4) return '';

    let path = `M ${coords[0]} ${coords[1]}`;
    for (let i = 2; i < coords.length; i += 2) {
        path += ` L ${coords[i]} ${coords[i + 1]}`;
    }
    return path;
}

/**
 * Convert a polygon element to a path string
 */
function polygonToPath(points: string): string {
    return polylineToPath(points) + ' Z';
}

/**
 * Get the cumulative transform for an element including all parent transforms
 */
function getCumulativeTransform(element: Element): Transform {
    let transform = identityTransform();
    const ancestors: Element[] = [];

    let current: Element | null = element;
    while (current && current.tagName !== 'svg') {
        ancestors.unshift(current);
        current = current.parentElement;
    }

    for (const ancestor of ancestors) {
        const transformAttr = ancestor.getAttribute('transform');
        if (transformAttr) {
            const t = parseTransform(transformAttr);
            transform = multiplyTransforms(transform, t);
        }
    }

    return transform;
}

/**
 * Get an inherited attribute value by traversing up the DOM tree
 * @param element - Starting element
 * @param attrName - Attribute name to look for
 * @returns The attribute value or null if not found
 */
function getInheritedAttribute(element: Element, attrName: string): string | null {
    let current: Element | null = element;
    while (current && current.tagName.toLowerCase() !== 'svg') {
        const value = current.getAttribute(attrName);
        if (value !== null) {
            return value;
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * Parse fill and stroke attributes from an element, including inherited values from parent groups
 */
function parseElementAttributes(element: Element, doc: Document): PathAttributes {
    // Parse fill attribute (check element first, then inherited)
    let fillAttr = element.getAttribute('fill');
    if (fillAttr === null) {
        fillAttr = getInheritedAttribute(element.parentElement!, 'fill');
    }

    let fillColor: number[];
    if (fillAttr && fillAttr.toLowerCase() !== 'none') {
        // Check if fill is a gradient URL reference
        if (fillAttr.startsWith('url(')) {
            // Extract the first color from the gradient definition
            const gradientColor = extractGradientColor(doc, fillAttr);
            if (gradientColor) {
                fillColor = gradientColor;
            } else {
                // Fallback to a visible color if gradient parsing fails
                fillColor = [0.5, 0.5, 0.5, 1]; // Gray as fallback
            }
        } else {
            try {
                const fillRgba = hexToRgba(fillAttr);
                fillColor = colorTo01Range(fillRgba);
            } catch (error) {
                fillColor = [1, 1, 1, 0]; // Transparent white
            }
        }
    } else if (fillAttr && fillAttr.toLowerCase() === 'none') {
        fillColor = [1, 1, 1, 0]; // Transparent (no fill)
    } else {
        // Default fill is black per SVG spec
        fillColor = [0, 0, 0, 1];
    }

    // Parse stroke attribute (check element first, then inherited)
    let strokeAttr = element.getAttribute('stroke');
    if (strokeAttr === null) {
        strokeAttr = getInheritedAttribute(element.parentElement!, 'stroke');
    }

    let strokeColor: number[] | null = null;
    // If stroke is explicitly "none" (either on element or inherited), keep strokeColor as null
    if (strokeAttr && strokeAttr.toLowerCase() !== 'none') {
        try {
            const strokeRgba = hexToRgba(strokeAttr);
            strokeColor = colorTo01Range(strokeRgba);
        } catch (error) {
            strokeColor = null;
        }
    }
    // Note: if strokeAttr is null (not defined anywhere) or "none", strokeColor remains null

    // Parse stroke-width attribute (check element first, then inherited)
    let strokeWidthAttr = element.getAttribute('stroke-width');
    if (strokeWidthAttr === null) {
        strokeWidthAttr = getInheritedAttribute(element.parentElement!, 'stroke-width');
    }

    let strokeWidth: number | null = null;
    if (strokeWidthAttr) {
        try {
            strokeWidth = parseFloat(strokeWidthAttr);
        } catch (error) {
            strokeWidth = null;
        }
    }

    return {
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth
    };
}

/**
 * Parse an SVG file and extract relevant information.
 * 
 * @param svgContent - SVG content as string
 * @returns Object containing svg_dimensions and path_data
 */
export function parseSvg(svgContent: string): {
    svgDimensions: [number, number];
    pathData: PathData[];
} {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error(`Failed to parse SVG: ${parserError.textContent}`);
    }

    // Extract viewBox
    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
        throw new Error('No SVG element found');
    }

    const viewboxString = svgElement.getAttribute('viewBox') || '';

    // Parse viewBox dimensions
    let svgDimensions: [number, number];
    let viewBoxTransform = identityTransform();

    if (viewboxString) {
        // Handle both comma and space separated values
        const parts = viewboxString.split(/[,\s]+/).filter(s => s.trim()).map(parseFloat);
        const minX = parts[0] || 0;
        const minY = parts[1] || 0;
        const width = parts[2];
        const height = parts[3];
        svgDimensions = [width, height];

        // Create transform to shift content by -minX, -minY
        if (minX !== 0 || minY !== 0) {
            viewBoxTransform = { a: 1, b: 0, c: 0, d: 1, e: -minX, f: -minY };
        }
    } else {
        // Fallback to width/height attributes
        const width = parseFloat(svgElement.getAttribute('width') || '512');
        const height = parseFloat(svgElement.getAttribute('height') || '512');
        svgDimensions = [width, height];
    }

    // Extract path data from all supported elements
    let pathCount = 0;
    const pathData: PathData[] = [];

    // Process path elements
    const paths = doc.querySelectorAll('path');
    paths.forEach((path) => {
        const id = path.getAttribute('id') || `path_${pathCount}`;
        let d = path.getAttribute('d') || '';

        // Apply any transforms
        let transform = getCumulativeTransform(path);
        // Apply viewBox transform (normalization)
        transform = multiplyTransforms(viewBoxTransform, transform);
        d = transformPath(d, transform);

        const attrs = parseElementAttributes(path, doc);
        pathData.push([d, id, attrs]);
        pathCount++;
    });

    // Process circle elements
    const circles = doc.querySelectorAll('circle');
    circles.forEach((circle) => {
        const id = circle.getAttribute('id') || `circle_${pathCount}`;
        const cx = parseFloat(circle.getAttribute('cx') || '0');
        const cy = parseFloat(circle.getAttribute('cy') || '0');
        const r = parseFloat(circle.getAttribute('r') || '0');

        if (r > 0) {
            let d = circleToPath(cx, cy, r);
            let transform = getCumulativeTransform(circle);
            transform = multiplyTransforms(viewBoxTransform, transform);
            d = transformPath(d, transform);

            const attrs = parseElementAttributes(circle, doc);
            pathData.push([d, id, attrs]);
            pathCount++;
        }
    });

    // Process ellipse elements
    const ellipses = doc.querySelectorAll('ellipse');
    ellipses.forEach((ellipse) => {
        const id = ellipse.getAttribute('id') || `ellipse_${pathCount}`;
        const cx = parseFloat(ellipse.getAttribute('cx') || '0');
        const cy = parseFloat(ellipse.getAttribute('cy') || '0');
        const rx = parseFloat(ellipse.getAttribute('rx') || '0');
        const ry = parseFloat(ellipse.getAttribute('ry') || '0');

        if (rx > 0 && ry > 0) {
            let d = ellipseToPath(cx, cy, rx, ry);
            let transform = getCumulativeTransform(ellipse);
            transform = multiplyTransforms(viewBoxTransform, transform);
            d = transformPath(d, transform);

            const attrs = parseElementAttributes(ellipse, doc);
            pathData.push([d, id, attrs]);
            pathCount++;
        }
    });

    // Process rect elements
    const rects = doc.querySelectorAll('rect');
    rects.forEach((rect) => {
        const id = rect.getAttribute('id') || `rect_${pathCount}`;
        const x = parseFloat(rect.getAttribute('x') || '0');
        const y = parseFloat(rect.getAttribute('y') || '0');
        const width = parseFloat(rect.getAttribute('width') || '0');
        const height = parseFloat(rect.getAttribute('height') || '0');
        const rx = parseFloat(rect.getAttribute('rx') || '0');
        const ry = parseFloat(rect.getAttribute('ry') || rect.getAttribute('rx') || '0');

        if (width > 0 && height > 0) {
            let d = rectToPath(x, y, width, height, rx, ry);
            let transform = getCumulativeTransform(rect);
            transform = multiplyTransforms(viewBoxTransform, transform);
            d = transformPath(d, transform);

            const attrs = parseElementAttributes(rect, doc);
            pathData.push([d, id, attrs]);
            pathCount++;
        }
    });

    // Process line elements
    const lines = doc.querySelectorAll('line');
    lines.forEach((line) => {
        const id = line.getAttribute('id') || `line_${pathCount}`;
        const x1 = parseFloat(line.getAttribute('x1') || '0');
        const y1 = parseFloat(line.getAttribute('y1') || '0');
        const x2 = parseFloat(line.getAttribute('x2') || '0');
        const y2 = parseFloat(line.getAttribute('y2') || '0');

        let d = lineToPath(x1, y1, x2, y2);
        const transform = getCumulativeTransform(line);
        d = transformPath(d, transform);

        const attrs = parseElementAttributes(line, doc);
        pathData.push([d, id, attrs]);
        pathCount++;
    });

    // Process polyline elements
    const polylines = doc.querySelectorAll('polyline');
    polylines.forEach((polyline) => {
        const id = polyline.getAttribute('id') || `polyline_${pathCount}`;
        const points = polyline.getAttribute('points') || '';

        if (points) {
            let d = polylineToPath(points);
            if (d) {
                const transform = getCumulativeTransform(polyline);
                d = transformPath(d, transform);

                const attrs = parseElementAttributes(polyline, doc);
                pathData.push([d, id, attrs]);
                pathCount++;
            }
        }
    });

    // Process polygon elements
    const polygons = doc.querySelectorAll('polygon');
    polygons.forEach((polygon) => {
        const id = polygon.getAttribute('id') || `polygon_${pathCount}`;
        const points = polygon.getAttribute('points') || '';

        if (points) {
            let d = polygonToPath(points);
            if (d) {
                const transform = getCumulativeTransform(polygon);
                d = transformPath(d, transform);

                const attrs = parseElementAttributes(polygon, doc);
                pathData.push([d, id, attrs]);
                pathCount++;
            }
        }
    });

    return { svgDimensions, pathData };
}

/**
 * Parse text elements from an SVG string.
 * 
 * @param svgContent - SVG content as string
 * @returns Object containing svg_dimensions and text_elements
 */
export function parseTextElements(svgContent: string): {
    svgDimensions: [number, number];
    textElements: TextElement[];
} {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error(`Failed to parse SVG: ${parserError.textContent}`);
    }

    // Extract viewBox
    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
        throw new Error('No SVG element found');
    }

    const viewboxString = svgElement.getAttribute('viewBox') || '';

    // Parse viewBox dimensions
    let svgDimensions: [number, number];
    if (viewboxString.includes(',')) {
        const parts = viewboxString.split(',').slice(2).map(parseFloat);
        svgDimensions = [parts[0], parts[1]];
    } else {
        const parts = viewboxString.split(/\s+/).slice(2).map(parseFloat);
        svgDimensions = [parts[0], parts[1]];
    }

    const textElements: TextElement[] = [];
    let textCount = 0;

    const texts = doc.querySelectorAll('text');
    texts.forEach((textElem) => {
        const textData = parseTextElement(textElem, textCount);
        if (textData) {
            textElements.push(textData);
            textCount++;
        }
    });

    return { svgDimensions, textElements };
}

/**
 * Parse a single text element and extract its properties.
 * 
 * @param textElem - DOM text element
 * @param textCount - Current text element count for ID generation
 * @returns Text element properties or null if parsing fails
 */
function parseTextElement(
    textElem: Element,
    textCount: number
): TextElement | null {
    // Get text content (handle nested tspan elements)
    const textContent = getTextContent(textElem);
    if (!textContent) {
        return null;
    }

    // Get element ID
    const id = textElem.getAttribute('id') || `text_${textCount}`;

    // Parse position
    const x = parseLength(textElem.getAttribute('x') || '') || 0;
    const y = parseLength(textElem.getAttribute('y') || '') || 0;

    // Parse font properties
    const fontFamily = textElem.getAttribute('font-family') || 'sans-serif';
    const fontSize = parseLength(textElem.getAttribute('font-size') || '') || 16;
    const fontWeight = textElem.getAttribute('font-weight') || 'normal';
    const fontStyle = textElem.getAttribute('font-style') || 'normal';

    // Parse fill color
    const fillAttr = textElem.getAttribute('fill');
    let fillColor: number[];
    if (fillAttr && fillAttr.toLowerCase() !== 'none') {
        try {
            const fillRgba = hexToRgba(fillAttr);
            fillColor = colorTo01Range(fillRgba);
        } catch (error) {
            fillColor = [0, 0, 0, 1]; // Default: opaque black
        }
    } else {
        fillColor = [0, 0, 0, 1]; // Default: opaque black
    }

    // Parse stroke color
    const strokeAttr = textElem.getAttribute('stroke');
    let strokeColor: number[] | null = null;
    if (strokeAttr && strokeAttr.toLowerCase() !== 'none') {
        try {
            const strokeRgba = hexToRgba(strokeAttr);
            strokeColor = colorTo01Range(strokeRgba);
        } catch (error) {
            strokeColor = null;
        }
    }

    // Parse stroke width
    const strokeWidthAttr = textElem.getAttribute('stroke-width');
    let strokeWidth: number | null = null;
    if (strokeWidthAttr) {
        try {
            strokeWidth = parseFloat(strokeWidthAttr);
        } catch (error) {
            strokeWidth = null;
        }
    }

    // Parse text alignment
    const textAnchor = textElem.getAttribute('text-anchor') || 'start';
    const dominantBaseline = textElem.getAttribute('dominant-baseline') || 'auto';

    // Parse letter spacing
    const letterSpacingAttr = textElem.getAttribute('letter-spacing');
    const letterSpacing = letterSpacingAttr ? (parseLength(letterSpacingAttr) || 0) : 0;

    // Parse text decoration
    const textDecoration = textElem.getAttribute('text-decoration') || 'none';

    // Parse opacity
    const opacityAttr = textElem.getAttribute('opacity');
    let opacity = 1.0;
    if (opacityAttr) {
        try {
            opacity = parseFloat(opacityAttr);
        } catch (error) {
            opacity = 1.0;
        }
    }

    return {
        text: textContent,
        x,
        y,
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth,
        textAnchor,
        dominantBaseline,
        letterSpacing,
        textDecoration,
        opacity,
        id
    };
}

/**
 * Extract text content from a text element, handling nested tspan elements.
 * 
 * @param textElem - DOM text element
 * @returns Combined text content string
 */
function getTextContent(textElem: Element): string {
    const textParts: string[] = [];

    textElem.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = (child.textContent || '').trim();
            if (text) {
                textParts.push(text);
            }
        } else if (child.nodeName.toLowerCase() === 'tspan' && child instanceof Element) {
            // Recursively get text from tspan
            const tspanText = getTextContent(child);
            if (tspanText) {
                textParts.push(tspanText);
            }
        }
    });

    return textParts.join(' ');
}

/**
 * Load and parse an SVG file from a URL.
 * 
 * @param svgUrl - URL or path to the SVG file
 * @returns Promise resolving to parsed SVG data
 */
export async function loadAndParseSvg(svgUrl: string): Promise<{
    svgDimensions: [number, number];
    pathData: PathData[];
}> {
    const response = await fetch(svgUrl);
    if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.statusText}`);
    }
    const svgContent = await response.text();
    return parseSvg(svgContent);
}

/**
 * Load and parse text elements from an SVG file URL.
 * 
 * @param svgUrl - URL or path to the SVG file
 * @returns Promise resolving to parsed text elements
 */
export async function loadAndParseTextElements(svgUrl: string): Promise<{
    svgDimensions: [number, number];
    textElements: TextElement[];
}> {
    const response = await fetch(svgUrl);
    if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.statusText}`);
    }
    const svgContent = await response.text();
    return parseTextElements(svgContent);
}