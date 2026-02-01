import { HandOverlayConfig, Coordinate } from '../types';

/**
 * Position information for hand overlay
 */
export interface HandPosition {
    x: number;
    y: number;
    /** Optional rotation angle in radians */
    rotation?: number;
}

/**
 * Strategy interface for hand overlay positioning
 * Different layer types implement different positioning strategies
 */
export interface HandOverlayStrategy {
    /**
     * Get the current hand position for the layer's current animation state
     * @param progress - Animation progress (0-1)
     * @param layerData - Layer-specific data needed for positioning
     * @returns Hand position in scene coordinates
     */
    getHandPosition(progress: number, layerData: any): HandPosition | null;

    /**
     * Check if hand should be visible at the current progress
     * @param progress - Animation progress (0-1)
     * @param layerData - Optional layer-specific data for visibility decisions
     * @returns true if hand should be shown
     */
    shouldShowHand(progress: number, layerData?: any): boolean;
}

/**
 * Default strategy - hand doesn't move (useful for static layers)
 */
export class DefaultHandStrategy implements HandOverlayStrategy {
    private position: HandPosition;

    constructor(x: number = 0, y: number = 0) {
        this.position = { x, y };
    }

    getHandPosition(_progress: number, layerData: any): HandPosition | null {
        let x = this.position.x;
        let y = this.position.y;

        if (layerData?.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress <= 1.0;
    }
}

/**
 * Text writing strategy - hand follows character positions during typewriter effect
 */
export class TextWritingHandStrategy implements HandOverlayStrategy {
    getHandPosition(_progress: number, layerData: any): HandPosition | null {
        if (!layerData || !layerData.currentCharPosition) {
            return null;
        }

        let pos = layerData.currentCharPosition;
        if (layerData.transform) {
            pos = layerData.transform(pos);
        }

        let x = pos.x;
        let y = pos.y;

        if (layerData?.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y, rotation: 0 };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress <= 1.0;
    }
}

/**
 * Path drawing strategy - hand follows path points during drawing animation
 */
export class PathDrawingHandStrategy implements HandOverlayStrategy {
    getHandPosition(_progress: number, layerData: any): HandPosition | null {
        if (!layerData || !layerData.currentPoint) {
            return null;
        }

        let current = layerData.currentPoint;
        let next = layerData.nextPoint;

        if (layerData.transform) {
            current = layerData.transform(current);
            if (next) next = layerData.transform(next);
        }

        const curX = Array.isArray(current) ? current[0] : current.x;
        const curY = Array.isArray(current) ? current[1] : current.y;

        const rotation = 0;

        let x = curX;
        let y = curY;

        if (layerData?.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y, rotation };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress <= 1.0;
    }
}

/**
 * Interface for path elements (e.g. SVGPathElement in browser)
 */
export interface IPathElement {
    getTotalLength(): number;
    getPointAtLength(distance: number): { x: number, y: number };
}

/**
 * SVG stroke animation strategy - hand follows stroke path
 */
export class StrokeAnimationHandStrategy implements HandOverlayStrategy {
    private pathElement: IPathElement | null = null;
    private cachedPathLength: number | null = null;

    constructor(pathElement?: IPathElement) {
        this.pathElement = pathElement || null;
    }

    setPath(pathElement: IPathElement) {
        this.pathElement = pathElement;
        this.cachedPathLength = null;
    }

    getHandPosition(progress: number, layerData: any): HandPosition | null {
        const path = layerData?.pathElement || this.pathElement;
        if (!path) return null;

        try {
            if (this.cachedPathLength === null || path !== this.pathElement) {
                this.cachedPathLength = path.getTotalLength();
                this.pathElement = path;
            }
            const length = this.cachedPathLength;
            if (length === null) return null;

            let point = path.getPointAtLength(progress * length);

            const rotation = 0;


            if (progress < 1.0) {
                if (layerData.transform) {
                    point = layerData.transform(point);
                }
            } else if (layerData.transform) {
                point = layerData.transform(point);
            }

            let x = point.x;
            let y = point.y;

            if (layerData?.handOffset) {
                x += layerData.handOffset[0];
                y += layerData.handOffset[1];
            }

            return { x, y, rotation };
        } catch (error) {
            return null;
        }
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress <= 1.0;
    }
}

/**
 * Data structure for eraser hand positioning
 */
export interface EraserLayerData {
    /** Current erase position */
    currentErasePosition?: { x: number; y: number };
    /** Next erase position (for rotation calculation) */
    nextErasePosition?: { x: number; y: number };
    /** Hand offset from erase position */
    handOffset?: [number, number];
}

/**
 * Eraser strategy - hand follows erase path with eraser image
 */
export class EraserHandStrategy implements HandOverlayStrategy {
    getHandPosition(_progress: number, layerData: any): HandPosition | null {
        if (!layerData || !layerData.currentErasePosition) {
            return null;
        }

        let current = layerData.currentErasePosition;
        let next = layerData.nextErasePosition;

        if (layerData.transform) {
            current = layerData.transform(current);
            if (next) next = layerData.transform(next);
        }

        const curX = Array.isArray(current) ? current[0] : current.x;
        const curY = Array.isArray(current) ? current[1] : current.y;

        const rotation = 0;

        let x = curX;
        let y = curY;

        if (layerData?.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y, rotation };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress <= 1.0;
    }
}

/**
 * Shape drawing strategy - hand follows shape perimeter during drawing animation
 */
export class ShapeHandStrategy implements HandOverlayStrategy {
    getHandPosition(progress: number, layerData: any): HandPosition | null {
        if (progress < 0 || progress > 1 || !layerData || !layerData.currentPoint) {
            return null;
        }

        let current = layerData.currentPoint;
        let next = layerData.nextPoint;

        if (layerData.transform) {
            current = layerData.transform(current);
            if (next) next = layerData.transform(next);
        }

        let rotation = 0;
        if (next) {
            rotation = Math.atan2(next.y - current.y, next.x - current.x);
        }

        let x = current.x;
        let y = current.y;

        if (layerData.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y, rotation };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress >= 0 && progress <= 1.0;
    }
}

/**
 * Reveal animation strategy - hand follows the reveal edge
 */
export class RevealHandStrategy implements HandOverlayStrategy {
    getHandPosition(progress: number, layerData: any): HandPosition | null {
        if (!layerData || !layerData.proxy) return null;
        const { proxy } = layerData;

        // Derive left/top if missing
        const left = proxy.left ?? (proxy.type === 'rect' ? proxy.x : proxy.x - proxy.width / 2);
        const top = proxy.top ?? (proxy.type === 'rect' ? proxy.y : proxy.y - proxy.height / 2);
        const width = proxy.width;
        const height = proxy.height;

        // Sweeping parameters - reduced for diagonal to prevent overshooting boundaries
        const sweepFrequency = 8; // Number of zigzags
        const sweepAmplitude = 0.3; // 30% of the edge length (reduced from 0.8)

        // Triangle wave for a more "eraser-like" zigzag motion
        // (progress * freq) % 1 gives a sawtooth, 2 * abs(sawtooth - 0.5) gives a triangle wave [0, 1]
        // Then map [0, 1] to [-1, 1]
        const sawtooth = (progress * sweepFrequency) % 1;
        const triangle = 2 * Math.abs(sawtooth - 0.5);
        const sweep = (triangle * 2 - 1); // Range [-1, 1]

        let x = left;
        let y = top;

        // Get the reveal pattern from layerData (defaults to diagonal)
        const pattern = layerData.revealPattern || 'diagonal';

        if (pattern === 'horizontal') {
            // Horizontal reveal: sweep from left to right
            x = left + width * progress;
            // Add vertical sweep motion
            const t = (sweep + 1) / 2 * sweepAmplitude + (1 - sweepAmplitude) / 2;
            y = top + height * t;
        } else if (pattern === 'vertical') {
            // Vertical reveal: sweep from top to bottom
            y = top + height * progress;
            // Add horizontal sweep motion
            const t = (sweep + 1) / 2 * sweepAmplitude + (1 - sweepAmplitude) / 2;
            x = left + width * t;
        } else {
            // Diagonal reveal logic
            const p = progress * 2;
            if (p <= 1) {
                // Leading edge: (left + width*p, top) to (left, top + height*p)
                // First half: triangle growing from top-left corner
                const x1 = left + width * p;
                const y1 = top;
                const x2 = left;
                const y2 = top + height * p;

                // Interpolate along the edge using sweep (mapped from [-1, 1] to [0, 1])
                // Center the sweep more with reduced amplitude
                const t = (sweep + 1) / 2 * sweepAmplitude + (1 - sweepAmplitude) / 2;
                x = x1 + (x2 - x1) * t;
                y = y1 + (y2 - y1) * t;
            } else {
                const p2 = p - 1;
                // Leading edge: (left + width, top + height*p2) to (left + width*p2, top + height)
                // Second half: trapezoid/pentagon filling the rest
                const x1 = left + width;
                const y1 = top + height * p2;
                const x2 = left + width * p2;
                const y2 = top + height;

                const t = (sweep + 1) / 2 * sweepAmplitude + (1 - sweepAmplitude) / 2;
                x = x1 + (x2 - x1) * t;
                y = y1 + (y2 - y1) * t;
            }
        }

        // Apply handOffset if provided
        if (layerData.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        // IMPORTANT: Clamp hand position to stay within layer boundaries
        // This prevents the hand from going beyond the layer edges
        x = Math.max(left, Math.min(left + width, x));
        y = Math.max(top, Math.min(top + height, y));

        // IMPORTANT: proxy.left/top are already in global space.
        // We only apply transform if it's NOT a global transform (e.g. local adjustments).
        if (layerData.transform && !layerData.isGlobalProxy) {
            const transformed = layerData.transform({ x, y });
            x = transformed.x;
            y = transformed.y;
        }

        if (Math.random() < 0.05) { // Log 5% of frames to avoid spam
            console.log(`[RevealHandStrategy] progress: ${progress.toFixed(2)}, pattern: ${pattern}, pos: (${x.toFixed(1)}, ${y.toFixed(1)}), offset: [${layerData.handOffset?.[0] || 0}, ${layerData.handOffset?.[1] || 0}]`);
        }

        return { x, y, rotation: 0 };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress >= 0 && progress < 1.0;
    }
}

/**
 * Push animation strategy - hand follows pushed object
 */
export class PushHandStrategy implements HandOverlayStrategy {
    getHandPosition(progress: number, layerData: any): HandPosition | null {
        if (progress < 0 || progress > 1 || !layerData || !layerData.currentObjectPosition) {
            return null;
        }

        let objectPos = layerData.currentObjectPosition;
        if (layerData.transform) {
            objectPos = layerData.transform(objectPos);
        }

        let x = objectPos.x;
        let y = objectPos.y;

        if (layerData.handOffset) {
            x += layerData.handOffset[0];
            y += layerData.handOffset[1];
        }

        return { x, y };
    }

    shouldShowHand(progress: number, _layerData?: any): boolean {
        return progress >= 0 && progress <= 1.0;
    }
}

/**
 * Base Hand Overlay Manager - Manages hand overlay strategies and position calculations.
 * Platform-agnostic.
 */
export abstract class BaseHandOverlayManager {
    protected config: HandOverlayConfig | null = null;
    protected strategy: HandOverlayStrategy | null = null;
    protected viewportScale: number = 1.0;
    public isInitialized: boolean = false;

    constructor(config?: HandOverlayConfig) {
        if (config) {
            this.config = config;
        }
    }

    setViewportScale(scale: number): void {
        this.viewportScale = scale;
    }

    setStrategy(strategy: HandOverlayStrategy): void {
        this.strategy = strategy;
    }

    getStrategy(): HandOverlayStrategy | null {
        return this.strategy;
    }

    /**
     * Get the current configuration
     */
    getConfig(): HandOverlayConfig | null {
        return this.config;
    }

    /**
     * Calculate the hand position for the current progress.
     * @param applyOffset - If false, the offset will not be passed to the strategy (for server-side rendering where offset is applied in screen space)
     */
    getHandPosition(progress: number, layerData: any, transform?: (p: { x: number, y: number }) => { x: number, y: number }, applyOffset: boolean = true): HandPosition | null {
        if (!this.strategy) return null;

        const enrichedLayerData = {
            ...(layerData || {}),
            handOffset: applyOffset ? (layerData?.handOffset || this.config?.offset || [0, 0]) : [0, 0],
            transform: layerData?.transform || transform
        };

        if (!this.strategy.shouldShowHand(progress, enrichedLayerData)) {
            return null;
        }

        return this.strategy.getHandPosition(progress, enrichedLayerData);
    }
}

/**
 * Factory function to create appropriate strategy based on layer type
 */
export function createHandStrategyForLayer(layerType: string, layerData?: any): HandOverlayStrategy {
    switch (layerType.toLowerCase()) {
        case 'text':
        case 'textanimator':
        case 'textwriting':
            return new TextWritingHandStrategy();

        case 'path':
        case 'drawing':
        case 'writing':
            return new PathDrawingHandStrategy();

        case 'shape':
            return new ShapeHandStrategy();

        case 'eraser':
        case 'rubber':
            return new EraserHandStrategy();

        case 'push':
            return new PushHandStrategy();

        case 'reveal':
            return new RevealHandStrategy();

        case 'svg':
        case 'stroke':
            return new StrokeAnimationHandStrategy(layerData?.pathElement);

        default:
            return new DefaultHandStrategy(layerData?.x || 0, layerData?.y || 0);
    }
}
