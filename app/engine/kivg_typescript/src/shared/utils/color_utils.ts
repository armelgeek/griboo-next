import type { RGB, RGBA } from '../types';
export type { RGB, RGBA };

export type Color = number[] | RGB | RGBA;
export type InputRange = 'auto' | '0-1' | '0-255';

/**
 * Normalize color to RGBA format with 0-255 range.
 * 
 * @param color - Color as array (RGB or RGBA)
 * @param inputRange - 'auto' (detect), '0-1', or '0-255'
 * @returns RGBA tuple with values in 0-255 range
 */
export function normalizeColor(
    color: Color,
    inputRange: InputRange = 'auto'
): RGBA {
    if (!color || color.length < 3) {
        return [0, 0, 0, 255];
    }

    let r = color[0];
    let g = color[1];
    let b = color[2];
    let a: number = color.length > 3 ? (color[3] ?? 1.0) : 1.0;

    // Auto-detect range
    let range = inputRange;
    if (range === 'auto') {
        // If all RGB values <= 1.0, assume 0-1 range
        if (Math.max(r, g, b) <= 1.0) {
            range = '0-1';
        } else {
            range = '0-255';
        }
    }

    // Convert to 0-255 range
    if (range === '0-1') {
        r = Math.floor(r * 255);
        g = Math.floor(g * 255);
        b = Math.floor(b * 255);
        a = a <= 1.0 ? Math.floor(a * 255) : Math.floor(a);
    } else {
        r = Math.floor(r);
        g = Math.floor(g);
        b = Math.floor(b);
        a = Math.floor(a);
    }

    // Clamp values
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    a = Math.max(0, Math.min(255, a));

    return [r, g, b, a];
}

/**
 * Convert color to 0-1 range (Kivy style).
 * 
 * @param color - RGBA color in any range
 * @returns Array of [r, g, b, a] in 0-1 range
 */
export function colorTo01Range(color: Color): number[] {
    const rgba = normalizeColor(color);
    return [
        rgba[0] / 255.0,
        rgba[1] / 255.0,
        rgba[2] / 255.0,
        rgba[3] / 255.0
    ];
}

/**
 * Convert hex color string to RGBA tuple (0-255 range).
 * 
 * @param hexColor - Hex color string (e.g., '#FF0000', '#F00', 'FF0000', '0xFF0000')
 * @param alpha - Alpha value (0.0-1.0 or 0-255)
 * @returns RGBA tuple (0-255 range)
 */
export function hexToRgba(hexColor: string | number, alpha: number = 1.0): RGBA {
    if (typeof hexColor === 'number') {
        const r = (hexColor >> 16) & 255;
        const g = (hexColor >> 8) & 255;
        const b = hexColor & 255;
        const a = alpha <= 1.0 ? Math.floor(alpha * 255) : Math.floor(alpha);
        return [r, g, b, a];
    }

    let hex = hexColor.replace(/^#/, '');

    // Handle 0x prefix
    if (hex.startsWith('0x')) {
        hex = hex.substring(2);
    }

    // Handle 3-character hex (e.g., 'F00' -> 'FF0000')
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }

    // Handle 4-character hex with alpha (e.g., 'F00F' -> 'FF0000FF')
    if (hex.length === 4) {
        hex = hex.split('').map(c => c + c).join('');
    }

    try {
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const a = alpha <= 1.0 ? Math.floor(alpha * 255) : Math.floor(alpha);
            return [r, g, b, a];
        } else if (hex.length === 8) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const a = parseInt(hex.substring(6, 8), 16);
            return [r, g, b, a];
        }
    } catch (error) {
        // Return default on error
    }

    // Default: transparent white
    return [255, 255, 255, 0];
}

/**
 * Normalize any color input to a CSS hex string (#RRGGBB).
 */
export function normalizeColorToHex(color: any): string {
    if (color === null || color === undefined) return '#000000';

    if (typeof color === 'number') {
        return '#' + color.toString(16).padStart(6, '0').toUpperCase();
    }

    if (typeof color === 'string') {
        if (color.startsWith('#')) return color;
        if (color.startsWith('0x')) {
            return '#' + color.substring(2).padStart(6, '0').toUpperCase();
        }
        // Check if it's a bare hex string (3, 4, 6, or 8 chars)
        if (/^[0-9A-Fa-f]{3,8}$/.test(color)) {
            let hex = color;
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
            // We only return 6 chars for CSS hex unless it's 8
            if (hex.length === 8) return '#' + hex.toUpperCase();
            return '#' + hex.substring(0, 6).toUpperCase();
        }
        return color; // Might be 'red', 'rgba(...)', etc.
    }

    if (Array.isArray(color)) {
        return rgbaToHex(normalizeColor(color));
    }

    return '#000000';
}

/**
 * Convert RGBA to BGRA (OpenCV format).
 * 
 * @param color - RGBA tuple
 * @returns BGRA tuple
 */
export function rgbaToBgra(color: RGBA): RGBA {
    return [color[2], color[1], color[0], color[3]];
}

/**
 * Apply additional opacity to a color.
 * 
 * @param color - RGBA color
 * @param opacity - Opacity multiplier (0.0-1.0)
 * @returns RGBA color with modified alpha
 */
export function applyOpacity(color: RGBA, opacity: number): RGBA {
    const clampedOpacity = Math.max(0.0, Math.min(1.0, opacity));
    const newAlpha = Math.floor(color[3] * clampedOpacity);
    return [color[0], color[1], color[2], newAlpha];
}

/**
 * Convert color from 0-1 range (SVG/Kivy style) to 0-255 RGBA tuple (OpenCV style).
 * 
 * @param color - Color as array [r, g, b, a] in 0-1 range, or null
 * @returns RGBA tuple with values in 0-255 range, or null if input is null
 */
export function color01To0255(color: number[] | null): RGBA | null {
    if (color === null) {
        return null;
    }

    if (color.length < 3) {
        return null;
    }

    let r = Math.floor(color[0] * 255);
    let g = Math.floor(color[1] * 255);
    let b = Math.floor(color[2] * 255);
    let a = color.length > 3 ? Math.floor(color[3] * 255) : 255;

    // Clamp values
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    a = Math.max(0, Math.min(255, a));

    return [r, g, b, a];
}

/**
 * Convert RGBA (0-255) to CSS rgba string.
 * 
 * @param color - RGBA tuple (0-255 range)
 * @returns CSS rgba string
 */
export function rgbaToCss(color: RGBA): string {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

/**
 * Convert RGBA (0-255) to hex string.
 * 
 * @param color - RGBA tuple (0-255 range)
 * @param includeAlpha - Whether to include alpha channel in output
 * @returns Hex color string (e.g., '#FF0000' or '#FF0000FF')
 */
export function rgbaToHex(color: RGBA, includeAlpha: boolean = false): string {
    const toHex = (n: number) => {
        const hex = n.toString(16).padStart(2, '0');
        return hex.toUpperCase();
    };

    const hex = `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;

    if (includeAlpha) {
        return `${hex}${toHex(color[3])}`;
    }

    return hex;
}