/**
 * Utility Module for Kivg Core
 * 
 * Provides common utility functions used across the rendering engine.
 * 
 * Features:
 * - Canvas ID generation for unique canvas identification
 * - Color parsing and conversion (hex, RGB, BGR)
 * - Position normalization for various formats
 * - Aspect ratio calculations and warnings
 * - Common helper functions
 * 
 * Usage:
 *     import { parseColor, normalizePosition, lerp, clamp, generateCanvasId } from './core/utils';
 *     
 *     const rgb = parseColorToRgb('#ff0000');
 *     const pos = normalizePosition('center', 1920, 1080);
 *     const canvasId = generateCanvasId('eraser');
 */

/**
 * Counter for generating unique canvas IDs.
 */
let canvasIdCounter = 0;

/**
 * Generate a unique ID for canvas elements.
 * This ensures that each canvas can be uniquely identified and manipulated,
 * preventing conflicts when multiple components create canvas elements.
 * 
 * @param prefix - Optional prefix to identify the canvas purpose (e.g., 'eraser', 'hybrid', 'animator')
 * @returns A unique canvas ID string
 * 
 * @example
 * const canvasId = generateCanvasId('eraser'); // Returns 'kivg-canvas-eraser-0'
 * const canvas = document.createElement('canvas');
 * canvas.id = canvasId;
 */
export function generateCanvasId(prefix: string = 'canvas'): string {
    return `kivg-canvas-${prefix}-${canvasIdCounter++}`;
}

/**
 * Reset the canvas ID counter (useful for testing).
 */
export function resetCanvasIdCounter(): void {
    canvasIdCounter = 0;
}

/**
 * RGB color tuple [R, G, B].
 */
export type RgbColor = [number, number, number];

/**
 * BGR color tuple [B, G, R] for OpenCV compatibility.
 */
export type BgrColor = [number, number, number];

/**
 * Point coordinate [x, y].
 */
export type Point = [number, number];

/**
 * Position dictionary format.
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Aspect ratio warning threshold.
 */
export const ASPECT_RATIO_WARNING_THRESHOLD = 0.05;

/**
 * Parse color value to BGR format for OpenCV.
 */
export function parseColor(
    colorValue: string | number[] | RgbColor
): BgrColor {
    if (typeof colorValue === 'string' && colorValue.startsWith('#')) {
        const hexColor = colorValue.slice(1);
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        return [b, g, r]; // BGR for OpenCV
    }

    if (Array.isArray(colorValue) && colorValue.length === 3) {
        // Assume RGB, convert to BGR
        return [colorValue[2], colorValue[1], colorValue[0]];
    }

    return colorValue as BgrColor;
}

/**
 * Parse color value to RGB format.
 */
export function parseColorToRgb(
    colorValue: string | number[] | RgbColor
): RgbColor {
    if (typeof colorValue === 'string' && colorValue.startsWith('#')) {
        const hexColor = colorValue.slice(1);
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        return [r, g, b];
    }

    if (Array.isArray(colorValue) && colorValue.length === 3) {
        return [colorValue[0], colorValue[1], colorValue[2]];
    }

    return colorValue as RgbColor;
}

/**
 * Convert RGB to BGR for OpenCV.
 */
export function rgbToBgr(rgb: RgbColor): BgrColor {
    return [rgb[2], rgb[1], rgb[0]];
}

/**
 * Convert BGR to RGB.
 */
export function bgrToRgb(bgr: BgrColor): RgbColor {
    return [bgr[2], bgr[1], bgr[0]];
}

/**
 * Convert RGB to hex string.
 */
export function rgbToHex(rgb: RgbColor): string {
    const r = Math.max(0, Math.min(255, Math.round(rgb[0])));
    const g = Math.max(0, Math.min(255, Math.round(rgb[1])));
    const b = Math.max(0, Math.min(255, Math.round(rgb[2])));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Normalize position parameter to dictionary format.
 */
export function normalizePosition(
    position: Position | string | number[] | Point,
    width: number,
    height: number
): Position {
    if (typeof position === 'object' && !Array.isArray(position)) {
        return position as Position;
    }

    if (typeof position === 'string') {
        const posLower = position.toLowerCase();
        switch (posLower) {
            case 'center':
                return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
            case 'top-left':
            case 'topleft':
                return { x: 0, y: 0 };
            case 'top-right':
            case 'topright':
                return { x: width, y: 0 };
            case 'bottom-left':
            case 'bottomleft':
                return { x: 0, y: height };
            case 'bottom-right':
            case 'bottomright':
                return { x: width, y: height };
            case 'top-center':
            case 'topcenter':
                return { x: Math.floor(width / 2), y: 0 };
            case 'bottom-center':
            case 'bottomcenter':
                return { x: Math.floor(width / 2), y: height };
            case 'left-center':
            case 'leftcenter':
                return { x: 0, y: Math.floor(height / 2) };
            case 'right-center':
            case 'rightcenter':
                return { x: width, y: Math.floor(height / 2) };
            default:
                console.warn(`Unknown position string '${position}', defaulting to center`);
                return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        }
    }

    if (Array.isArray(position) && position.length >= 2) {
        return { x: Math.floor(position[0]), y: Math.floor(position[1]) };
    }

    console.warn(`Invalid position format, defaulting to (0, 0)`);
    return { x: 0, y: 0 };
}

/**
 * Check if scaling causes non-uniform scaling.
 */
export function checkAspectRatioAndWarn(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    contentType: string = 'content'
): boolean {
    if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
        return false;
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = targetWidth / targetHeight;
    const aspectDiff = Math.abs(sourceAspect - targetAspect) / sourceAspect;

    if (aspectDiff > ASPECT_RATIO_WARNING_THRESHOLD) {
        const suggestedHeight = targetWidth / sourceAspect;
        const suggestedWidth = targetHeight * sourceAspect;

        console.warn(`NON-UNIFORM SCALING DETECTED: ${contentType}`);
        console.warn(`  Source aspect: ${sourceAspect.toFixed(2)}, Target aspect: ${targetAspect.toFixed(2)}`);
        console.warn(`  Suggested dimensions to maintain aspect ratio:`);
        console.warn(`  - width: ${targetWidth}, height: ${Math.round(suggestedHeight)}`);
        console.warn(`  - width: ${Math.round(suggestedWidth)}, height: ${targetHeight}`);
        return true;
    }

    return false;
}

/**
 * Calculate dimensions for a given aspect ratio.
 */
export function calculateAspectRatioDimensions(
    originalWidth: number,
    originalHeight: number,
    aspectRatio: string
): [number, number] {
    if (aspectRatio === 'original' || !aspectRatio) {
        return [originalWidth, originalHeight];
    }

    if (aspectRatio.includes(':')) {
        const parts = aspectRatio.split(':');
        try {
            const ratioW = parseFloat(parts[0]);
            const ratioH = parseFloat(parts[1]);

            if (ratioH === 0) {
                return [originalWidth, originalHeight];
            }

            const targetRatio = ratioW / ratioH;
            const currentRatio = originalWidth / originalHeight;

            if (currentRatio > targetRatio) {
                // Width is the constraint
                const newHeight = Math.round(originalWidth / targetRatio);
                return [originalWidth, newHeight];
            } else {
                // Height is the constraint
                const newWidth = Math.round(originalHeight * targetRatio);
                return [newWidth, originalHeight];
            }
        } catch {
            return [originalWidth, originalHeight];
        }
    }

    return [originalWidth, originalHeight];
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, minVal: number, maxVal: number): number {
    return Math.max(minVal, Math.min(maxVal, value));
}

/**
 * Linear interpolation between two values.
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Linear interpolation between two colors.
 */
export function lerpColor(
    color1: RgbColor,
    color2: RgbColor,
    t: number
): RgbColor {
    return [
        Math.round(lerp(color1[0], color2[0], t)),
        Math.round(lerp(color1[1], color2[1], t)),
        Math.round(lerp(color1[2], color2[2], t))
    ];
}

/**
 * Calculate Euclidean distance between two points.
 */
export function euclideanDistance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
}

/**
 * Calculate total length of a path defined by points.
 */
export function calculatePathLength(points: Point[]): number {
    if (points.length < 2) {
        return 0.0;
    }

    let totalLength = 0.0;
    for (let i = 1; i < points.length; i++) {
        totalLength += euclideanDistance(points[i - 1], points[i]);
    }

    return totalLength;
}

/**
 * Get a point along a path at a given progress.
 */
export function getPointOnPath(
    points: Point[],
    progress: number
): Point {
    if (points.length === 0) {
        return [0, 0];
    }
    if (points.length === 1) {
        return points[0];
    }
    if (progress <= 0) {
        return points[0];
    }
    if (progress >= 1) {
        return points[points.length - 1];
    }

    // Calculate total path length
    const totalLength = calculatePathLength(points);
    if (totalLength === 0) {
        return points[0];
    }

    // Find the point at the given progress
    const targetLength = totalLength * progress;
    let currentLength = 0.0;

    for (let i = 1; i < points.length; i++) {
        const segmentLength = euclideanDistance(points[i - 1], points[i]);
        if (currentLength + segmentLength >= targetLength) {
            // Interpolate within this segment
            const segmentProgress = (targetLength - currentLength) / segmentLength;
            const x = lerp(points[i - 1][0], points[i][0], segmentProgress);
            const y = lerp(points[i - 1][1], points[i][1], segmentProgress);
            return [x, y];
        }
        currentLength += segmentLength;
    }

    return points[points.length - 1];
}

/**
 * Apply aspect ratio padding to an ImageData.
 */
export function applyAspectRatioPadding(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    paddingColor: RgbColor = [255, 255, 255]
): ImageData {
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;

    // Calculate scaling to fit while maintaining aspect ratio
    const scaleW = targetWidth / srcWidth;
    const scaleH = targetHeight / srcHeight;
    const scale = Math.min(scaleW, scaleH);

    const newW = Math.round(srcWidth * scale);
    const newH = Math.round(srcHeight * scale);

    // Create padded canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    // Fill with padding color
    ctx.fillStyle = `rgb(${paddingColor[0]}, ${paddingColor[1]}, ${paddingColor[2]})`;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Create source canvas
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcWidth;
    srcCanvas.height = srcHeight;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return imageData;

    srcCtx.putImageData(imageData, 0, 0);

    // Center the resized image
    const xOffset = Math.floor((targetWidth - newW) / 2);
    const yOffset = Math.floor((targetHeight - newH) / 2);

    ctx.drawImage(srcCanvas, xOffset, yOffset, newW, newH);

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Degrees to radians conversion.
 */
export function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Radians to degrees conversion.
 */
export function radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Map a value from one range to another.
 */
export function mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number {
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

/**
 * Check if a point is inside a rectangle.
 */
export function pointInRect(
    x: number,
    y: number,
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number
): boolean {
    return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
}

/**
 * Check if two rectangles overlap.
 */
export function rectsOverlap(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
): boolean {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
}

/**
 * Generate a unique identifier.
 */
export function generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Deep clone an object.
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as T;
    }

    const clone = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (clone as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key]);
        }
    }
    return clone;
}

/**
 * Debounce a function.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function(...args: Parameters<T>): void {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle a function.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return function(...args: Parameters<T>): void {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Format duration in seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
        return `${minutes}m ${secs.toFixed(0)}s`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m ${secs.toFixed(0)}s`;
}

/**
 * Parse duration string to seconds.
 */
export function parseDuration(durationStr: string): number {
    // Handle formats like "1.5s", "2m", "1h30m", "1:30:00"
    const trimmed = durationStr.trim().toLowerCase();

    // Try seconds format (e.g., "1.5s", "30")
    if (trimmed.endsWith('s')) {
        return parseFloat(trimmed.slice(0, -1));
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    // Try minutes format (e.g., "2m")
    if (trimmed.endsWith('m') && !trimmed.includes('h')) {
        return parseFloat(trimmed.slice(0, -1)) * 60;
    }

    // Try hours format (e.g., "1h")
    if (trimmed.endsWith('h')) {
        return parseFloat(trimmed.slice(0, -1)) * 3600;
    }

    // Try colon format (e.g., "1:30:00" or "1:30")
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map(p => parseFloat(p) || 0);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }

    return parseFloat(trimmed) || 0;
}

/**
 * Create a solid color ImageData frame.
 * 
 * @param width - Frame width
 * @param height - Frame height
 * @param color - RGB color [r, g, b] values 0-255, defaults to white
 * @returns Solid color ImageData
 */
export function createSolidFrame(
    width: number, 
    height: number, 
    color: RgbColor = [255, 255, 255]
): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = color[0];     // R
        data[i + 1] = color[1]; // G
        data[i + 2] = color[2]; // B
        data[i + 3] = 255;      // A
    }
    return new ImageData(data, width, height);
}

/**
 * Create a white ImageData frame.
 * 
 * @param width - Frame width
 * @param height - Frame height
 * @returns White ImageData
 */
export function createWhiteFrame(width: number, height: number): ImageData {
    return createSolidFrame(width, height, [255, 255, 255]);
}

/**
 * Create a black ImageData frame.
 * 
 * @param width - Frame width
 * @param height - Frame height
 * @returns Black ImageData
 */
export function createBlackFrame(width: number, height: number): ImageData {
    return createSolidFrame(width, height, [0, 0, 0]);
}

/**
 * Blend two ImageData frames with alpha value.
 * 
 * @param frame1 - First frame
 * @param frame2 - Second frame
 * @param alpha - Blend amount (0.0 = frame1, 1.0 = frame2)
 * @returns Blended ImageData
 */
export function blendFrames(frame1: ImageData, frame2: ImageData, alpha: number): ImageData {
    const result = new ImageData(frame1.width, frame1.height);
    const beta = 1 - alpha;
    
    for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = Math.round(frame1.data[i] * beta + frame2.data[i] * alpha);
        result.data[i + 1] = Math.round(frame1.data[i + 1] * beta + frame2.data[i + 1] * alpha);
        result.data[i + 2] = Math.round(frame1.data[i + 2] * beta + frame2.data[i + 2] * alpha);
        result.data[i + 3] = 255;
    }
    
    return result;
}
