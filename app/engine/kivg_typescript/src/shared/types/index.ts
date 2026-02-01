export type Point = [number, number];
export type Coordinate = [number, number];
export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export interface Position {
    x: number;
    y: number;
}

/**
 * Color region extracted from image for fill animation
 */
export interface ColorRegion {
    color: RGB;
    pixels: Point[];
    centroid: Point;
    size: number;
}

/**
 * Stroke path extracted from image edges
 */
export interface StrokePath {
    points: Coordinate[];
}

export interface HandOverlayConfig {
    enabled?: boolean;
    imageUrl?: string;
    scale?: number;
    offset?: Point;
    anchorPoint?: [number, number];
    anchorTopLeft?: boolean;
    preset?: string;
}

/**
 * Configuration for image-based hybrid animation
 */
export interface HybridImageConfig {
    width: number;
    height: number;
    background?: RGBA;
    strokeDurationRatio?: number;
    colorTolerance?: number;
    minRegionSize?: number;
    strokeWidth?: number;
    fillDirection?: 'diagonal' | 'vertical' | 'horizontal';
    sweepSpeed?: number;
    handOverlay?: HandOverlayConfig;
}

/**
 * Configuration for simple image layers
 */
export interface SimpleImageConfig {
    imageUrl?: string;
    width?: number;
    height?: number;
    maintainAspectRatio?: boolean;
}

export interface LayerBoundingBox {
    left: number;
    right: number;
    top: number;
    bottom: number;
    logicalWidth: number;
    logicalHeight: number;
}

export interface AnimationConfig {
    duration: number;
    delay?: number;
    scale?: number;
    easing?: string;
    settleRatio?: number;
    warmUp?: boolean;
    strokeRatio?: number;
}

export interface HandOverlayPreset {
    imageUrl?: string;
    scale?: number;
    offset?: [number, number];
    anchorPoint?: [number, number];
    anchorTopLeft?: boolean;
}

export interface GridConfig {
    type: 'dots' | 'lines' | 'squares' | 'hexagonal' | 'isometric';
    size?: number;
    color?: string;
    opacity?: number;
    lineWidth?: number;
}

export interface TemplateConfig {
    type: 'map' | 'custom';
    url?: string;
    opacity?: number;
}

export interface GradientStop {
    offset: number;
    color: string;
    opacity?: number;
}

export interface GradientConfig {
    type: 'linear' | 'radial';
    angle?: number;
    cx?: number;
    cy?: number;
    r?: number;
    stops: GradientStop[];
}

export interface BackgroundEffectConfig {
    blur?: number;
    grayscale?: number;
    sepia?: number;
    brightness?: number;
    contrast?: number;
    hueRotate?: number;
    invert?: number;
}

export interface BackgroundAnimationConfig {
    type: 'scroll' | 'rotate' | 'pulse';
    speedX?: number;
    speedY?: number;
    rotationSpeed?: number;
    pulseFrequency?: number;
    pulseIntensity?: number;
}

export interface BackgroundConfig {
    color?: string;
    grid?: GridConfig;
    template?: TemplateConfig;
    gradient?: GradientConfig;
    effects?: BackgroundEffectConfig;
    animation?: BackgroundAnimationConfig;
}

export type WhiteboardStatus = 'idle' | 'preparing' | 'playing' | 'stopped' | 'completed';

export interface MorphLayerConfig extends LayerConfig {
    type: 'morph';
    fromPath: {
        x: number;
        y: number;
    }[];
    toPath: {
        x: number;
        y: number;
    }[];
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
}

/**
 * Style configuration for subtitle text
 */
export interface SubtitleStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    backgroundColor?: string;
    backgroundOpacity?: number;
    stroke?: {
        color: string;
        width: number;
    };
    shadow?: {
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    animation?: {
        in?: 'fade' | 'slide' | 'bounce' | 'none';
        out?: 'fade' | 'slide' | 'none';
        duration?: number;
    };
    alignment?: 'left' | 'center' | 'right';
    maxWidth?: number;
    padding?: number;
    borderRadius?: number;
}

/**
 * Individual subtitle segment with timing
 */
export interface SubtitleSegment {
    id: string;
    text: string;
    startTime: number;
    endTime: number;
    sceneId?: string;
}

/**
 * Caption/Subtitle layer configuration
 */
export interface CaptionLayerConfig extends LayerConfig {
    type: 'caption';
    text: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    backgroundColor?: string;
    backgroundOpacity?: number;
    stroke?: {
        color: string;
        width: number;
    };
    shadow?: {
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    textAlign?: 'left' | 'center' | 'right';
    maxWidth?: number;
    padding?: number;
    borderRadius?: number;
    lineHeight?: number;
}

export type AnyLayerConfig = LayerConfig | ShapeLayerConfig | PathLayerConfig | EraserLayerConfig | MorphLayerConfig | PushLayerConfig | CaptionLayerConfig | SvgPathLayerConfig | HybridImageConfig | SimpleImageConfig;

export interface WhiteboardConfig {
    containerId?: string;
    width?: number;
    height?: number;
    fps?: number;
    debug?: boolean;
    perfMonitor?: boolean;
    scenes?: SceneConfig[];
    background?: string | BackgroundConfig;
    handOverlay?: {
        /** Whether to show the hand overlay. Defaults to true if not specified. */
        enabled?: boolean;
    };
    hands?: {
        draw?: HandOverlayPreset;
        erase?: HandOverlayPreset;
        push?: HandOverlayPreset;
    };
    /** Global subtitles configuration */
    subtitles?: {
        enabled: boolean;
        position?: 'top' | 'center' | 'bottom';
        offset?: {
            x: number;
            y: number;
        };
        style?: SubtitleStyle;
        segments?: SubtitleSegment[];
    };
    /** Apply loudness normalization to the final audio mix */
    normalizeAudio?: boolean;
    /** Camera configuration for the whiteboard */
    camera?: CameraSceneConfig;
    /** Callback for status changes */
    onStatusChange?: (status: WhiteboardStatus, progress?: number) => void;
    /** Callback when preparation (including warm-up) is complete */
    onPrepared?: (sceneIndex: number) => void;
    /** Callback for time updates during playback */
    onTimeUpdate?: (time: number) => void;
    /** Callback when playback completes naturally */
    onCompleted?: () => void;
    /** Editor configuration */
    editor?: {
        enabled: boolean;
        callbacks?: {
            onLayerSelect?: (layerId: string | null) => void;
            onLayerAdd?: (layer: any) => void;
            onLayerRemove?: (layerId: string) => void;
            onLayerChange?: (layer: any) => void;
            onCameraSelect?: (camera: any | null) => void;
            onCameraChange?: (camera: any) => void;
            onSceneChange?: (scene: any) => void;
            onZoomChange?: (zoom: number) => void;
            onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
        };
    };
}

export interface SceneConfig {
    id: string;
    background?: string | BackgroundConfig;
    /** Total duration in seconds for the scene animation */
    duration?: number;
    /** Exit transition animation when scene disappears. Applied at the END of the scene. */
    transition?: SceneTransitionConfig;
    /**
     * Optional eraser configuration for the scene. If enabled, replaces the exit transition.
     * @deprecated Use eraser_config instead for consistency with the UI.
     */
    eraser?: SlideEraserConfig;
    /** Optional eraser configuration for the scene. If enabled, replaces the exit transition. */
    eraser_config?: SlideEraserConfig;
    /** Default hand overlay configuration for all layers in this scene */
    handOverlay?: {
        /** Whether to show the hand overlay. Defaults to true if not specified. */
        enabled: boolean;
    };
    /**
     * Enable automatic occlusion culling for layers.
     * When enabled, overlapping portions of lower z-index layers are automatically erased.
     */
    occlusionCulling?: boolean;
    /**
     * Configuration for occlusion culling behavior.
     */
    occlusionCullingConfig?: {
        /** Default duration for occlusion erase animations in seconds (default: 1.5) */
        duration?: number;
        /** Eraser radius in pixels (default: 30) */
        radius?: number;
        /** Show eraser hand during animation (default: true) */
        showEraser?: boolean;
        /** Content threshold for occlusion detection 0-255 (default: 250) */
        contentThreshold?: number;
        /** Only apply occlusion to layers that are currently being animated (default: true) */
        autoOnly?: boolean;
        /**
         * Margin ratio for intersection calculation (0.0 to 1.0).
         * This margin is applied to both objects before calculating intersection,
         * making the system more tolerant of small overlaps and near-misses.
         * Default: 0.1 (10% of object size)
         */
        intersectionMarginRatio?: number;
    };
    /**
     * Enable debug logging for performance monitoring.
     */
    debug?: boolean;
    /**
     * Number of critical layers to prepare synchronously during fast seek preparation.
     */
    fastPrepareLayerCount?: number;
    /**
     * Timing configuration for the scene.
     */
    timingConfig?: {
        /**
         * Global speed multiplier for all animations in the scene.
         */
        drawSpeed?: number;
    };
    layers?: AnyLayerConfig[];
    /** Audio configuration for the scene */
    audio?: AudioSceneConfig;
    /** Camera configuration for the scene */
    camera?: CameraSceneConfig;
}

export interface AudioSceneConfig {
    background_music?: string | {
        path: string;
        volume?: number;
        loop?: boolean;
        fade_in?: number;
        fade_out?: number;
    };
    sound_effects?: Array<{
        path: string;
        start_time?: number;
        volume?: number;
        duration?: number;
    }>;
    voice_overs?: Array<{
        path: string;
        start_time?: number;
        volume?: number;
    }>;
    typewriter?: {
        start_time?: number;
        num_characters?: number;
        char_interval?: number;
        volume?: number;
    };
    drawing_sound?: {
        start_time?: number;
        duration?: number;
        volume?: number;
    };
}

export interface CameraPosition {
    x: number;
    y: number;
}

export interface CameraSize {
    width: number;
    height: number;
}

export interface CameraConfig {
    zoom?: number;
    position?: CameraPosition;
    size?: CameraSize | null;
    /** Optional target layer ID to focus on */
    targetLayerId?: string;
    /** Padding in pixels when focusing on a layer */
    padding?: number;
}

export interface CameraKeyframe extends CameraConfig {
    pauseTime?: number;
    transitionDuration?: number;
    easing?: string;
    startTime?: number;
}

export interface CameraSceneConfig {
    initial?: CameraConfig;
    keyframes?: CameraKeyframe[];
    /** Virtual canvas size (e.g., 7680x4320 for a 4x larger whiteboard) */
    virtualSize?: CameraSize;
    /** Automatic follow mode */
    followMode?: 'manual' | 'active_layer' | 'hand';
    /** Automatically snap initial camera to the first keyframe if it starts at t=0 */
    snapToFirstKeyframe?: boolean;
}

export interface SlideEraserConfig {
    enabled: boolean;
    duration?: number;
    delayAfterAnimations?: number;
    pattern?: 'diagonal' | 'horizontal' | 'vertical';
    backgroundColor?: [number, number, number];
    showEraser?: boolean;
    radius?: number;
    imageQuality?: number;
}

export interface OcclusionProxy {
    type: 'rect' | 'circle' | 'ellipse' | 'path';
    x: number;
    y: number;
    width: number;
    height: number;
    logicalWidth?: number;
    logicalHeight?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    points?: {
        x: number;
        y: number;
    }[];
    transform?: string;
    opacity?: number;
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
}

/**
 * Types of emphasis animations that play while an element is visible
 */
export type EmphasisAnimationType = 'pulse' | 'shake' | 'bounce' | 'wiggle' | 'glow' | 'flash' | 'rubber_band' | 'swing' | 'tada' | 'wobble' | 'jello' | 'heart_beat' | 'none';

export type AnimationType = 'draw' | 'stroke' | 'fade_in' | 'fade_out' | 'slide_in_left' | 'slide_in_right' | 'slide_in_top' | 'slide_in_bottom' | 'slide_out_left' | 'slide_out_right' | 'slide_out_top' | 'slide_out_bottom' | 'zoom_in' | 'zoom_out' | 'click' | 'pulse' | 'typewriter' | 'slide_in' | 'bounce' | 'bounce_in' | 'bounce_out' | 'flip_in' | 'flip_in_x' | 'eraser' | 'flip_in_y' | 'flip_out' | 'rotate_in' | 'rotate_out' | 'spin_in' | 'spin_out' | 'char_fade' | 'push' | 'none' | 'flash' | 'rubber_band' | 'shake_x' | 'shake_y' | 'head_shake' | 'swing' | 'tada' | 'wobble' | 'jello' | 'heart_beat' | 'back_in_down' | 'back_in_left' | 'back_in_right' | 'back_in_up' | 'back_out_down' | 'back_out_left' | 'back_out_right' | 'back_out_up' | 'bounce_in_down' | 'bounce_in_left' | 'bounce_in_right' | 'bounce_in_up' | 'bounce_out_down' | 'bounce_out_left' | 'bounce_out_right' | 'bounce_out_up' | 'fade_in_down' | 'fade_in_left' | 'fade_in_right' | 'fade_in_up' | 'fade_in_top_left' | 'fade_in_top_right' | 'fade_in_bottom_left' | 'fade_in_bottom_right' | 'fade_out_down' | 'fade_out_down_big' | 'fade_out_left' | 'fade_out_left_big' | 'fade_out_right' | 'fade_out_right_big' | 'fade_out_up' | 'fade_out_up_big' | 'fade_out_top_left' | 'fade_out_top_right' | 'fade_out_bottom_left' | 'fade_out_bottom_right' | 'flip_out_x' | 'flip_out_y' | 'rotate_in_down_left' | 'rotate_in_down_right' | 'rotate_in_up_left' | 'rotate_in_up_right' | 'rotate_out_down_left' | 'rotate_out_down_right' | 'rotate_out_up_left' | 'rotate_out_up_right' | 'zoom_in_down' | 'zoom_in_left' | 'zoom_in_right' | 'zoom_in_up' | 'zoom_out_down' | 'zoom_out_left' | 'zoom_out_right' | 'zoom_out_up' | 'slide_out_top' | 'slide_out_bottom' | 'slide_out_up' | 'slide_out_down' | 'jack_in_the_box' | 'roll_in' | 'roll_out' | 'lightspeed_in' | 'lightspeed_out' | 'reveal_horizontal' | 'reveal_vertical' | 'reveal_diagonal';

export type TransitionType = 'fade' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'slide_top' | 'slide_bottom' | 'wipe' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' | 'iris' | 'fade_to_black' | 'fade_to_white' | 'diagonal_wipe' | 'clock_wipe' | 'radial_wipe' | 'dissolve' | 'morph' | 'crossfade_blur' | 'flip' | 'bounce' | 'rotate' | 'zoom' | 'zoom_in' | 'zoom_out' | 'eraser' | 'none';

export interface SceneTransitionConfig {
    type: TransitionType;
    duration: number;
    easing?: string;
    eraserPattern?: 'diagonal' | 'horizontal' | 'vertical';
    handImage?: string;
    handOffset?: [number, number];
    handScale?: number;
    after_slide?: number;
}

export interface LayerConfig {
    id: string;
    type?: string;
    position?: Position;
    opacity?: number;
    scale?: number;
    rotation?: number;
    zIndex?: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
    skewX?: number;
    skewY?: number;
    entrance_animation?: {
        type: AnimationType;
        duration: number;
        delay?: number;
        easing?: string;
    };
    exit_animation?: {
        type: AnimationType;
        duration: number;
        delay?: number;
        easing?: string;
    };
    /** Emphasis animation that plays while the element is visible */
    emphasis_animation?: {
        type: EmphasisAnimationType;
        duration: number;
        delay?: number;
        iterations?: number;
        intensity?: number;
        easing?: string;
    };
    /**
     * @deprecated Main animation configuration for the layer.
     * This property is deprecated. Use entrance_animation instead.
     */
    animation?: {
        type: AnimationType;
        duration: number;
        delay?: number;
        easing?: string;
        scale?: number;
    };
    /** Hand overlay configuration for this layer */
    handOverlay?: boolean | HandOverlayConfig;
    /**
     * Layer timing configuration
     */
    timingConfig?: {
        /** Duration to pause after animation completes in seconds (default: 0.5) */
        pauseTime?: number;
    };
    /**
     * Enable automatic occlusion culling for this layer.
     */
    occlusionCulling?: boolean;
    /**
     * Occlusion mode for this layer.
     */
    occlusionMode?: 'auto' | 'static' | 'none';
    /** Enable debug logging for this layer */
    debug?: boolean;
    imageUrl?: string;
    imageData?: any;
    maintainAspectRatio?: boolean;
    pathData?: string;
    svgContent?: string;
    svgUrl?: string;
    svgPathConfig?: {
        strokeColor?: string;
        fillColor?: string;
        strokeWidth?: number;
    };
    textConfig?: {
        text: string;
        fontSize?: number;
        fontFamily?: string;
        color?: string | number;
        textAlign?: 'left' | 'center' | 'right';
        strokeAnimation?: {
            mode?: 'draw' | 'typewriter' | 'char_fade' | 'stroke';
            duration?: number;
            strokeColor?: string | number;
            strokeWidth?: number;
            fillMode?: 'start' | 'end' | 'none';
            charDelay?: number;
        };
    };
    hybridConfig?: Partial<HybridImageConfig>;
    shape?: 'circle' | 'rectangle' | 'square' | 'star' | 'line' | 'ellipse' | 'triangle' | 'polygon' | 'hexagon' | 'path' | 'svg';
    radius?: number;
    strokeColor?: string | number;
    fillColor?: string | number;
    strokeWidth?: number;
    points?: any;
    cornerRadius?: number;
    lineCap?: string;
    lineJoin?: string;
    pushConfig?: PushLayerConfig;
}

/**
 * Configuration specific to PushLayer
 */
export interface PushLayerConfig {
    /** Image URL to be pushed */
    imageUrl?: string;
    /** ImageData to be pushed */
    imageData?: any;
    /** Width of the image */
    width?: number;
    /** Height of the image */
    height?: number;
    /** Side from which the object enters ('left', 'right', 'top', 'bottom') */
    from?: 'left' | 'right' | 'top' | 'bottom';
    /** Start position for push animation (optional, calculated from 'from' if not provided) */
    startPosition?: [number, number];
    /** End position for push animation (optional, uses config.position if not provided) */
    endPosition?: [number, number];
    /** Duration of push animation in seconds */
    pushDuration?: number;
    /** Easing function for push animation */
    pushEasing?: string;
    /** Background color for animation frames [r, g, b, a] */
    backgroundColor?: [number, number, number, number];
    /** Frame rate for animation */
    frameRate?: number;
    /** Number of frames to hold at end position */
    finalHoldFrames?: number;
    /** Canvas width for frame generation (defaults to 1920) */
    canvasWidth?: number;
    /** Canvas height for frame generation (defaults to 1080) */
    canvasHeight?: number;
    /** Image quality for JPEG compression (0.0-1.0, default: 0.8) */
    imageQuality?: number;
}

export interface SvgPathLayerConfig extends LayerConfig {
    svgContent?: string;
    svgUrl?: string;
    pathData?: string;
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
}

export interface ShapeLayerConfig extends LayerConfig {
    shape?: 'circle' | 'rectangle' | 'square' | 'star' | 'line' | 'ellipse' | 'triangle' | 'polygon' | 'hexagon' | 'path' | 'svg';
    radius?: number;
    strokeColor?: string | number;
    fillColor?: string | number;
    strokeWidth?: number;
    points?: number[];
    cornerRadius?: number;
    lineCap?: string;
    lineJoin?: string;
    pathData?: string;
    svgUrl?: string;
}

export interface PathLayerConfig extends LayerConfig {
    points: Coordinate[];
    strokeColor?: string;
    strokeWidth?: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
}

export interface EraserLayerConfig extends LayerConfig {
    radius?: number;
    pattern?: 'diagonal' | 'horizontal' | 'vertical';
}

/**
 * Frame result from hybrid animation
 */
export interface HybridFrame {
    imageData: any;
    handPosition: Coordinate | null;
    nextHandPosition?: Coordinate | null;
    isStrokePhase: boolean;
}

export interface OcclusionCullingConfig {
    duration?: number;
    radius?: number;
    showEraser?: boolean;
    contentThreshold?: number;
    autoOnly?: boolean;
    intersectionMarginRatio?: number;
}
