/**
 * Context object for animation state and configuration.
 */
export interface AnimationContext {
    widget: any;
    shapeId: string;
    direction: string;
    transition: string;
    duration: number;
    closedShapes: Record<string, any>;
    swSize: [number, number];
    svgFile: string;
}

/**
 * Factory function to create an AnimationContext with default values.
 */
export function createAnimationContext(
    params: Partial<AnimationContext>
): AnimationContext {
    return {
        widget: params.widget ?? null,
        shapeId: params.shapeId ?? '',
        direction: params.direction ?? '',
        transition: params.transition ?? 'linear',
        duration: params.duration ?? 0,
        closedShapes: params.closedShapes ?? {},
        swSize: params.swSize ?? [0, 0],
        svgFile: params.svgFile ?? '',
    };
}

/**
 * Alternative: Class-based implementation if you prefer OOP style.
 */
export class AnimationContextClass {
    widget: any;
    shapeId: string;
    direction: string;
    transition: string;
    duration: number;
    closedShapes: Record<string, any>;
    swSize: [number, number];
    svgFile: string;

    constructor(params: Partial<AnimationContext> = {}) {
        this.widget = params.widget ?? null;
        this.shapeId = params.shapeId ?? '';
        this.direction = params.direction ?? '';
        this.transition = params.transition ?? 'linear';
        this.duration = params.duration ?? 0;
        this.closedShapes = params.closedShapes ?? {};
        this.swSize = params.swSize ?? [0, 0];
        this.svgFile = params.svgFile ?? '';
    }
}

/**
 * Position configuration for layer placement.
 */
export interface LayerPosition {
    x: number;
    y: number;
}

/**
 * Hand rendering mode for kivg layer animation.
 * - 'griboo': Uses griboo-engine's hand overlay method (default)
 * - 'kivg': Uses kivg's native HandOverlay for authentic whiteboard effect
 */
export type HandRenderMode = 'griboo' | 'kivg';

/**
 * Animation mode for kivg layer.
 * - 'draw': Progressive SVG path drawing animation (default for SVG)
 * - 'coloriage': Progressive color reveal animation using patterns
 * - 'coloring': Alias for coloriage
 */
export type KivgLayerMode = 'draw' | 'coloriage' | 'coloring';

/**
 * Coloring pattern for progressive image/SVG reveal.
 * - 'diagonal': Zigzag diagonal pattern from top-left to bottom-right
 * - 'horizontal': Line-by-line horizontal pattern from top to bottom
 * - 'vertical': Column-by-column vertical pattern from left to right
 */
export type ColoringPatternType = 'diagonal' | 'horizontal' | 'vertical';

/**
 * Animation type for kivg layer.
 * - 'seq': Sequential path animation (one path at a time)
 * - 'par': Parallel path animation (all paths simultaneously)
 */
export type KivgAnimationType = 'seq' | 'par';

/**
 * RGBA color tuple (values 0-255).
 */
export type RGBAColor = [number, number, number, number];

/**
 * Kivg layer configuration for griboo-engine.
 * 
 * The kivg layer type supports both SVG and regular image sources.
 * - For SVG sources: Use `svg_path` to specify the SVG file
 * - For image sources: Use `image_path` to specify the image file
 * 
 * Note: Either `svg_path` or `image_path` must be provided.
 * If both are provided, `svg_path` takes priority.
 */
export interface KivgLayerConfig {
    /** Layer type identifier - must be 'kivg' */
    type: 'kivg';
    
    /** Unique layer identifier */
    id?: string;
    
    /** Z-index for layer ordering (higher = on top) */
    z_index?: number;
    
    /**
     * Path to SVG file for SVG-based animation.
     * Use this for SVG files that should be drawn with path animation.
     * Takes priority over `image_path` if both are provided.
     */
    svg_path?: string;
    
    /**
     * Path to image file for image-based animation.
     * Use this for regular images (PNG, JPG, etc.) that should be
     * revealed using coloring patterns.
     * 
     * When image_path is specified, the layer uses coloring animation
     * (diagonal, horizontal, or vertical pattern) to progressively
     * reveal the image.
     */
    image_path?: string;
    
    /**
     * Animation mode for the layer.
     * - 'draw': Progressive path drawing (for SVG)
     * - 'coloriage'/'coloring': Progressive color reveal (for images/SVG)
     * 
     * Default: 'draw' for SVG, 'coloriage' for images
     */
    mode?: KivgLayerMode;
    
    /** Layer width in pixels */
    width?: number;
    
    /** Layer height in pixels */
    height?: number;
    
    /** Layer position on canvas */
    position?: LayerPosition;
    
    /** Whether to fill SVG shapes (default: true) */
    fill?: boolean;
    
    /** Whether to animate the drawing (default: true) */
    animate?: boolean;
    
    /** Animation type: 'seq' for sequential, 'par' for parallel */
    anim_type?: KivgAnimationType;
    
    /** Stroke color as RGBA array [R, G, B, A] (values 0-255) */
    line_color?: RGBAColor;
    
    /** Stroke width in pixels (default: 2) */
    line_width?: number;
    
    /**
     * Coloring pattern for progressive reveal.
     * Used when mode is 'coloriage'/'coloring' or for image sources.
     * Default: 'diagonal'
     */
    coloring_pattern?: ColoringPatternType;
    
    /** Whether to show drawing hand overlay (default: true) */
    hand_draw?: boolean;
    
    /**
     * Hand rendering mode.
     * - 'griboo': Uses griboo-engine's hand overlay (default, better for custom positions)
     * - 'kivg': Uses kivg's native HandOverlay (better for full-canvas animations)
     */
    hand_render_mode?: HandRenderMode;
    
    /** Custom hand image path (for 'kivg' hand mode) */
    hand_image?: string;
    
    /** Hand scale factor 0.0-1.0 (default: 0.30) */
    hand_scale?: number;
    
    /** Hand offset from drawing point [x, y] (default: [-18, -140]) */
    hand_offset?: [number, number];
    
    /** Frames per second for animation (default: 30) */
    fps?: number;
    
    /** Animation duration in seconds */
    duration?: number;
    
    /** Use optimized renderer for complex SVGs (default: false) */
    optimized?: boolean;
    
    /** Points per bezier segment for optimized renderer (default: 15) */
    points_per_segment?: number;
    
    /** Source width for scaling calculations */
    source_width?: number;
    
    /** Source height for scaling calculations */
    source_height?: number;
}

/**
 * Generic layer type that can be image, text, shape, arrow, or kivg.
 */
export type LayerType = 'image' | 'text' | 'shape' | 'arrow' | 'kivg';

/**
 * Base layer configuration shared by all layer types.
 */
export interface BaseLayerConfig {
    /** Layer type */
    type: LayerType;
    
    /** Unique layer identifier */
    id?: string;
    
    /** Z-index for layer ordering */
    z_index?: number;
    
    /** Layer width */
    width?: number;
    
    /** Layer height */
    height?: number;
    
    /** Layer position */
    position?: LayerPosition;
    
    /** Layer opacity (0.0-1.0) */
    opacity?: number;
    
    /** Layer scale factor */
    scale?: number;
    
    /** Entrance animation type (when layer appears) */
    entrance_animation?: string;
    
    /** Duration of entrance animation in seconds */
    entrance_duration?: number;
    
    /** Delay before entrance animation starts in seconds */
    entrance_delay?: number;
    
    /** Attention animation (looping effect while layer is visible) */
    attention_animation?: string;
    
    /** Duration of each attention animation cycle */
    attention_duration?: number;
    
    /** Number of attention animation iterations (0 for infinite) */
    attention_iterations?: number;
    
    /** Easing function for animations */
    animation_easing?: string;
}

/**
 * Image layer configuration.
 */
export interface ImageLayerConfig extends BaseLayerConfig {
    type: 'image';
    
    /** Path to image file */
    image_path: string;
    
    /** Coloring pattern for animation */
    coloring_pattern?: ColoringPatternType;
    
    /** Preserve alpha channel */
    preserve_alpha?: boolean;
    
    /** Animation configuration */
    animation?: {
        type: 'coloring' | 'whiteboard' | 'none';
        fps?: number;
        duration?: number;
    };
}

/**
 * Union type for all layer configurations.
 */
export type LayerConfig = KivgLayerConfig | ImageLayerConfig | BaseLayerConfig;

/**
 * Video configuration for slide exports.
 */
export interface VideoConfig {
    /** Video width in pixels */
    width: number;
    
    /** Video height in pixels */
    height: number;
    
    /** Frames per second */
    fps: number;
    
    /** Background color (hex or RGB) */
    background_color?: string;
}

/**
 * Hand configuration for drawing animations.
 */
export interface HandConfig {
    /** Path to hand image */
    image_path: string;
    
    /** Path to hand mask image */
    mask_path: string;
}

/**
 * Slide configuration.
 */
export interface SlideConfig {
    /** Slide index */
    index: number;
    
    /** Slide name for identification */
    name?: string;
    
    /** Slide description */
    description?: string;
    
    /** Skip rate for animation speed */
    skip_rate?: number;
    
    /** Slide duration in seconds */
    duration?: number;
    
    /** Array of layers in this slide */
    layers: LayerConfig[];
    
    /** Transition to this slide from the previous slide */
    transition?: SceneTransitionConfig;
    
    /** Scene entrance animation (after transition completes) */
    scene_entrance?: string;
    
    /** Scene exit animation (before transition to next slide) */
    scene_exit?: string;
    
    /** Scene entrance animation duration */
    scene_entrance_duration?: number;
    
    /** Scene exit animation duration */
    scene_exit_duration?: number;
}

/**
 * Scene transition configuration.
 */
export interface SceneTransitionConfig {
    /** Transition type (fade, wipe, push, slide, etc.) */
    type?: string;
    
    /** Duration of the transition in seconds */
    duration?: number;
    
    /** Easing function for the transition */
    easing?: string;
    
    /** Direction for directional transitions (left, right, up, down) */
    direction?: 'left' | 'right' | 'up' | 'down';
}

/**
 * Complete griboo-engine configuration for slide-based video generation.
 */
export interface GribooConfig {
    /** JSON schema reference */
    $schema?: string;
    
    /** Configuration description */
    description?: string;
    
    /** Array of slides */
    slides: SlideConfig[];
    
    /** Video output settings */
    video: VideoConfig;
    
    /** Hand overlay settings */
    hand?: HandConfig;
    
    /** Default transition for all slides */
    default_transition?: SceneTransitionConfig;
    
    /** Default layer entrance animation */
    default_entrance_animation?: string;
    
    /** Default animation duration */
    default_animation_duration?: number;
}