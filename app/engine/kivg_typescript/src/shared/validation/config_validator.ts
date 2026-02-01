import { z } from 'zod';
import {
    AnimationType,
    TransitionType,
    EmphasisAnimationType
} from '../types';

/**
 * Zod schema for Coordinate [x, y]
 */
export const CoordinateSchema = z.tuple([z.number(), z.number()]);

/**
 * Zod schema for RGB [r, g, b]
 */
export const RGBSchema = z.tuple([z.number(), z.number(), z.number()]);

/**
 * Zod schema for RGBA [r, g, b, a]
 */
export const RGBASchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/**
 * Zod schema for Position {x, y}
 */
export const PositionSchema = z.object({
    x: z.number(),
    y: z.number()
});

/**
 * Animation Types
 */
const ANIMATION_TYPES: [AnimationType, ...AnimationType[]] = [
    'draw', 'stroke', 'fade_in', 'fade_out', 'slide_in_left', 'slide_in_right',
    'slide_in_top', 'slide_in_bottom', 'slide_out_left', 'slide_out_right',
    'slide_out_top', 'slide_out_bottom', 'slide_out_up', 'slide_out_down',
    'zoom_in', 'zoom_out', 'click', 'pulse', 'typewriter', 'slide_in',
    'bounce', 'bounce_in', 'bounce_out', 'flip_in', 'flip_in_x', 'eraser',
    'flip_in_y', 'flip_out', 'rotate_in', 'rotate_out', 'spin_in', 'spin_out',
    'char_fade', 'push', 'none', 'flash', 'rubber_band', 'shake_x', 'shake_y',
    'head_shake', 'swing', 'tada', 'wobble', 'jello', 'heart_beat',
    'back_in_down', 'back_in_left', 'back_in_right', 'back_in_up',
    'back_out_down', 'back_out_left', 'back_out_right', 'back_out_up',
    'bounce_in_down', 'bounce_in_left', 'bounce_in_right', 'bounce_in_up',
    'bounce_out_down', 'bounce_out_left', 'bounce_out_right', 'bounce_out_up',
    'fade_in_down', 'fade_in_left', 'fade_in_right', 'fade_in_up',
    'fade_in_top_left', 'fade_in_top_right', 'fade_in_bottom_left', 'fade_in_bottom_right',
    'fade_out_down', 'fade_out_down_big', 'fade_out_left', 'fade_out_left_big',
    'fade_out_right', 'fade_out_right_big', 'fade_out_up', 'fade_out_up_big',
    'fade_out_top_left', 'fade_out_top_right', 'fade_out_bottom_left', 'fade_out_bottom_right',
    'flip_out_x', 'flip_out_y', 'rotate_in_down_left', 'rotate_in_down_right',
    'rotate_in_up_left', 'rotate_in_up_right', 'rotate_out_down_left',
    'rotate_out_down_right', 'rotate_out_up_left', 'rotate_out_up_right',
    'zoom_in_down', 'zoom_in_left', 'zoom_in_right', 'zoom_in_up',
    'zoom_out_down', 'zoom_out_left', 'zoom_out_right', 'zoom_out_up',
    'jack_in_the_box', 'roll_in', 'roll_out', 'lightspeed_in', 'lightspeed_out',
    'reveal_horizontal', 'reveal_vertical', 'reveal_diagonal'
] as any;

/**
 * Transition Types
 */
const TRANSITION_TYPES: [TransitionType, ...TransitionType[]] = [
    'fade', 'slide_left', 'slide_right', 'slide_up', 'slide_down', 'slide_top',
    'slide_bottom', 'wipe', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down',
    'iris', 'fade_to_black', 'fade_to_white', 'diagonal_wipe', 'clock_wipe',
    'radial_wipe', 'dissolve', 'morph', 'crossfade_blur', 'flip', 'bounce',
    'rotate', 'zoom', 'zoom_in', 'zoom_out', 'eraser', 'none'
] as any;

/**
 * Emphasis Animation Types
 */
const EMPHASIS_ANIMATION_TYPES: [EmphasisAnimationType, ...EmphasisAnimationType[]] = [
    'pulse', 'shake', 'bounce', 'wiggle', 'glow', 'flash', 'rubber_band',
    'swing', 'tada', 'wobble', 'jello', 'heart_beat', 'none'
] as any;

export const AnimationConfigSchema = z.object({
    type: z.enum(ANIMATION_TYPES),
    duration: z.number().nonnegative(),
    delay: z.number().nonnegative().optional(),
    easing: z.string().optional()
});

export const EmphasisAnimationConfigSchema = z.object({
    type: z.enum(EMPHASIS_ANIMATION_TYPES),
    duration: z.number().nonnegative(),
    delay: z.number().nonnegative().optional(),
    iterations: z.number().optional(),
    intensity: z.number().min(0).max(1).optional(),
    easing: z.string().optional()
});

export const HandOverlayConfigSchema = z.object({
    enabled: z.boolean().optional(),
    imageUrl: z.string().optional(),
    scale: z.number().optional(),
    offset: z.tuple([z.number(), z.number()]).optional(),
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
    anchorTopLeft: z.boolean().optional(),
    preset: z.string().optional()
});

export const LayerConfigSchema = z.object({
    id: z.string(),
    type: z.string().optional(),
    position: PositionSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
    scale: z.number().optional(),
    rotation: z.number().optional(),
    zIndex: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    entrance_animation: AnimationConfigSchema.optional(),
    exit_animation: AnimationConfigSchema.optional(),
    emphasis_animation: EmphasisAnimationConfigSchema.optional(),
    handOverlay: z.union([z.boolean(), HandOverlayConfigSchema]).optional(),
    timingConfig: z.object({
        pauseTime: z.number().nonnegative().optional()
    }).optional(),
    imageUrl: z.string().optional(),
    textConfig: z.object({
        text: z.string(),
        fontSize: z.number().optional(),
        fontFamily: z.string().optional(),
        color: z.union([z.string(), z.number(), z.array(z.number())]).optional()
    }).optional(),
    // Add other type-specific configs as needed
}).passthrough();

export const AudioSceneConfigSchema = z.object({
    background_music: z.union([
        z.string(),
        z.object({
            path: z.string(),
            volume: z.number().min(0).max(1).optional(),
            loop: z.boolean().optional(),
            fade_in: z.number().optional(),
            fade_out: z.number().optional()
        })
    ]).optional(),
    sound_effects: z.array(z.object({
        path: z.string(),
        start_time: z.number().optional(),
        volume: z.number().optional(),
        duration: z.number().optional()
    })).optional(),
    voice_overs: z.array(z.object({
        path: z.string(),
        start_time: z.number().optional(),
        volume: z.number().optional()
    })).optional(),
    typewriter: z.object({
        start_time: z.number().optional(),
        num_characters: z.number().optional(),
        char_interval: z.number().optional(),
        volume: z.number().optional()
    }).optional(),
    drawing_sound: z.object({
        start_time: z.number().optional(),
        duration: z.number().optional(),
        volume: z.number().optional()
    }).optional()
});

export const CameraConfigSchema = z.object({
    zoom: z.number().optional(),
    position: PositionSchema.optional(),
    size: z.object({
        width: z.number(),
        height: z.number()
    }).nullable().optional(),
    targetLayerId: z.string().optional(),
    padding: z.number().optional()
});

export const CameraKeyframeSchema = CameraConfigSchema.extend({
    pauseTime: z.number().optional(),
    transitionDuration: z.number().optional(),
    easing: z.string().optional(),
    startTime: z.number().optional()
});

export const CameraSceneConfigSchema = z.object({
    initial: CameraConfigSchema.optional(),
    keyframes: z.array(CameraKeyframeSchema).optional(),
    virtualSize: z.object({
        width: z.number(),
        height: z.number()
    }).optional(),
    followMode: z.enum(['manual', 'active_layer', 'hand']).optional(),
    snapToFirstKeyframe: z.boolean().optional()
});

export const SceneConfigSchema = z.object({
    id: z.string(),
    duration: z.number().nonnegative().optional(),
    layers: z.array(LayerConfigSchema).optional(),
    audio: AudioSceneConfigSchema.optional(),
    camera: CameraSceneConfigSchema.optional(),
    transition: z.object({
        type: z.enum(TRANSITION_TYPES),
        duration: z.number().nonnegative(),
        easing: z.string().optional()
    }).optional()
}).passthrough();

export const WhiteboardConfigSchema = z.object({
    containerId: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    debug: z.boolean().optional(),
    perfMonitor: z.boolean().optional(),
    scenes: z.array(SceneConfigSchema).optional(),
    background: z.union([z.string(), z.any()]).optional(),
    fps: z.number().optional(),
    normalizeAudio: z.boolean().optional(),
    handOverlay: z.object({
        enabled: z.boolean().optional()
    }).optional(),
    camera: CameraSceneConfigSchema.optional()
}).passthrough();

/**
 * Validates a WhiteboardConfig object
 * @param config The configuration to validate
 * @returns The validated configuration or throws an error
 */
export function validateWhiteboardConfig(config: any) {
    return WhiteboardConfigSchema.parse(config);
}

/**
 * Safely validates a WhiteboardConfig object
 * @param config The configuration to validate
 * @returns An object with success status and either data or error
 */
export function safeValidateWhiteboardConfig(config: any) {
    return WhiteboardConfigSchema.safeParse(config);
}
