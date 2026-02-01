/**
 * KivgTemplate - Template rendering system for KIVG animations
 * 
 * This module provides the template logic extracted from HTML files
 * into proper TypeScript classes for better maintainability and reusability.
 * 
 * It includes:
 * - Animation rendering pipeline
 * - Stroke and fill animation coordination
 * - Frame generation for progressive drawing
 */

import { HybridImageAnimator, HybridAnimatorConfig, HybridFrame } from './hybrid_animator';

// Type definitions
type RGB = [number, number, number];

/**
 * Default alpha value for RGBA conversion from RGB backgrounds
 */
const DEFAULT_ALPHA = 255;

/**
 * Default color for hand position indicator (red with 50% opacity)
 */
const DEFAULT_HAND_INDICATOR_COLOR = 'rgba(255, 0, 0, 0.5)';

/**
 * Default radius for hand position indicator in pixels
 */
const DEFAULT_HAND_INDICATOR_RADIUS = 6;

/**
 * Configuration for KIVG template rendering
 */
export interface KivgTemplateConfig {
    width?: number;
    height?: number;
    background?: RGB;
    colorTolerance?: number;
    strokeRatio?: number;
    fillDirection?: 'diagonal' | 'vertical' | 'horizontal';
    minRegionSize?: number;
    minRegionDuration?: number;
    handIndicatorColor?: string;  // CSS color string for hand indicator
    handIndicatorRadius?: number; // Radius of hand indicator in pixels
}

/**
 * Animation state for progressive rendering
 */
export interface AnimationState {
    stopped: boolean;
    currentFrame?: number;
    totalFrames?: number;
    phase?: 'stroke' | 'fill';
}

/**
 * KivgTemplateRenderer - Main class for template-based animation rendering
 * 
 * This class provides a high-level API for rendering animations using
 * the KIVG template system, which combines stroke and fill phases for
 * progressive drawing animations.
 */
export class KivgTemplateRenderer {
    private config: Required<KivgTemplateConfig>;
    private animator: HybridImageAnimator | null = null;
    private animationState: AnimationState = { stopped: false };
    
    constructor(config: KivgTemplateConfig = {}) {
        this.config = {
            width: config.width ?? 800,
            height: config.height ?? 600,
            background: config.background ?? [255, 255, 255],
            colorTolerance: config.colorTolerance ?? 10.0,
            strokeRatio: config.strokeRatio ?? 0.7,
            fillDirection: config.fillDirection ?? 'diagonal',
            minRegionSize: config.minRegionSize ?? 50,
            minRegionDuration: config.minRegionDuration ?? 800,
            handIndicatorColor: config.handIndicatorColor ?? DEFAULT_HAND_INDICATOR_COLOR,
            handIndicatorRadius: config.handIndicatorRadius ?? DEFAULT_HAND_INDICATOR_RADIUS
        };
    }
    
    /**
     * Load an image for rendering
     * 
     * @param imageSource - Image element, canvas, ImageData, or URL string
     * @returns Promise<boolean> - True if loaded successfully
     */
    async loadImage(imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | string): Promise<boolean> {
        const animatorConfig: HybridAnimatorConfig = {
            width: this.config.width,
            height: this.config.height,
            // Convert RGB to RGBA by appending default alpha channel
            background: [...this.config.background, DEFAULT_ALPHA],
            colorTolerance: this.config.colorTolerance,
            strokeDurationRatio: this.config.strokeRatio,
            minRegionSize: this.config.minRegionSize,
            // Note: fillDirection from KivgTemplateConfig is not passed to HybridAnimatorConfig
            // because HybridImageAnimator uses a fixed diagonal fill pattern (top-left to bottom-right).
            // See sortPixelsDiagonally() in text/text_rendering.ts for implementation details.
        };
        
        this.animator = new HybridImageAnimator(animatorConfig);
        
        if (typeof imageSource === 'string') {
            return await this.animator.loadImageFromUrl(imageSource);
        } else {
            return await this.animator.loadImage(imageSource);
        }
    }
    
    /**
     * Generate animation frames
     * 
     * @param fps - Frames per second
     * @param duration - Total animation duration in seconds
     * @returns Array of animation frames
     */
    generateFrames(fps: number = 30, duration: number = 5.0): HybridFrame[] {
        if (!this.animator) {
            console.error('No image loaded. Call loadImage() first.');
            return [];
        }
        
        return this.animator.generateAnimation(fps, duration);
    }
    
    /**
     * Render animation to a canvas element
     * 
     * @param canvas - Target canvas element
     * @param fps - Frames per second
     * @param duration - Total animation duration in seconds
     * @param onProgress - Optional progress callback
     * @returns Promise that resolves when animation completes
     */
    async renderToCanvas(
        canvas: HTMLCanvasElement,
        fps: number = 30,
        duration: number = 5.0,
        onProgress?: (frame: number, total: number, phase: 'stroke' | 'fill') => void
    ): Promise<void> {
        const frames = this.generateFrames(fps, duration);
        if (frames.length === 0) {
            console.error('No frames generated');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
            return;
        }
        
        // Set canvas dimensions
        canvas.width = this.config.width;
        canvas.height = this.config.height;
        
        this.animationState = {
            stopped: false,
            currentFrame: 0,
            totalFrames: frames.length,
            phase: 'stroke'
        };
        
        // Render frames progressively
        for (let i = 0; i < frames.length && !this.animationState.stopped; i++) {
            const frame = frames[i];
            
            // Update phase
            this.animationState.phase = frame.isStrokePhase ? 'stroke' : 'fill';
            this.animationState.currentFrame = i;
            
            // Render frame to canvas
            ctx.putImageData(frame.imageData, 0, 0);
            
            // Draw hand indicator if position is available
            if (frame.handPosition) {
                const [x, y] = frame.handPosition;
                ctx.fillStyle = this.config.handIndicatorColor;
                ctx.beginPath();
                ctx.arc(x, y, this.config.handIndicatorRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Call progress callback
            if (onProgress) {
                onProgress(i + 1, frames.length, this.animationState.phase);
            }
            
            // Wait for next frame
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
    
    /**
     * Stop current animation
     */
    stopAnimation(): void {
        this.animationState.stopped = true;
    }
    
    /**
     * Reset renderer state
     */
    reset(): void {
        if (this.animator) {
            this.animator.reset();
        }
        this.animator = null;
        this.animationState = { stopped: false };
    }
    
    /**
     * Get animation statistics
     */
    getStats(): { strokes: number; colorRegions: number } | null {
        if (!this.animator) {
            return null;
        }
        
        return {
            strokes: this.animator.getStrokeCount(),
            colorRegions: this.animator.getColorRegionCount()
        };
    }
}

/**
 * Utility function to extract ImageData from various image sources
 */
export function getImageDataFromSource(
    source: HTMLImageElement | HTMLCanvasElement | ImageData,
    width?: number,
    height?: number
): ImageData {
    if (source instanceof ImageData) {
        if (width && height && (source.width !== width || source.height !== height)) {
            // Resize if needed
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = source.width;
            tempCanvas.height = source.height;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.putImageData(source, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, width, height);
            return ctx.getImageData(0, 0, width, height);
        }
        return source;
    }
    
    const canvas = document.createElement('canvas');
    const w = width ?? source.width;
    const h = height ?? source.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

/**
 * Utility function to render a frame to a canvas
 */
export function renderFrameToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
    if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.putImageData(imageData, 0, 0);
    }
}

/**
 * Factory function for quick template rendering
 */
export async function createKivgAnimation(
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | string,
    options: KivgTemplateConfig = {}
): Promise<KivgTemplateRenderer> {
    const renderer = new KivgTemplateRenderer(options);
    await renderer.loadImage(imageSource);
    return renderer;
}
