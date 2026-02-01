/**
 * Layer Animation Utility Module for Kivg Core
 * 
 * Provides utilities for applying entrance animations to layers.
 * This module bridges the configuration-based approach with the actual
 * animation rendering.
 * 
 * Usage:
 *     import { 
 *         applyLayerEntrance,
 *         getLayerAnimationConfig 
 *     } from './core/layer_animation';
 *     
 *     // Apply entrance animation to a frame
 *     const animatedFrame = applyLayerEntrance(frame, config, frameIndex, fps);
 */

import { applyEntranceAnimation, EntranceAnimationConfig } from './entrance_animation';
import {
    AnimateCSSType,
    getDefaultAnimationDuration,
    normalizeAnimationType,
    LayerAnimationConfig
} from './animate_css';
import { createWhiteFrame } from '../infra/utils';

/**
 * Layer animation state for tracking animation progress.
 */
export interface LayerAnimationState {
    layerId: string;
    isEntering: boolean;
    isAttention: boolean;
    entranceStartFrame: number;
    attentionStartFrame: number;
    entranceEndFrame: number;
    attentionIteration: number;
}

/**
 * Create initial layer animation state.
 */
export function createLayerAnimationState(layerId: string): LayerAnimationState {
    return {
        layerId,
        isEntering: false,
        isAttention: false,
        entranceStartFrame: 0,
        attentionStartFrame: 0,
        entranceEndFrame: 0,
        attentionIteration: 0
    };
}

/**
 * Apply layer entrance animation to a frame.
 * 
 * @param frame - The source frame (ImageData)
 * @param config - Layer animation configuration
 * @param frameIndex - Current frame index from layer start
 * @param fps - Frames per second
 * @returns Animated frame as ImageData
 */
export function applyLayerEntrance(
    frame: ImageData,
    config: LayerAnimationConfig,
    frameIndex: number,
    fps: number
): ImageData {
    if (!config.entrance_animation || config.entrance_animation === 'none') {
        return frame;
    }

    // Normalize the animation type
    const animType = normalizeAnimationType(config.entrance_animation);
    const duration = config.entrance_duration ?? getDefaultAnimationDuration(animType);

    // Calculate delay frames
    const delayFrames = Math.floor((config.entrance_delay ?? 0) * fps);

    // If we haven't reached the delay yet, return transparent/white frame
    if (frameIndex < delayFrames) {
        return createWhiteFrame(frame.width, frame.height);
    }

    // Adjust frame index for delay
    const adjustedFrameIndex = frameIndex - delayFrames;
    const totalAnimFrames = Math.floor(duration * fps);

    // If animation is complete, return the original frame
    if (adjustedFrameIndex >= totalAnimFrames) {
        return frame;
    }

    // Create entrance animation config
    const entranceConfig: EntranceAnimationConfig = {
        type: animType,
        duration: duration,
        easing: config.easing ?? 'ease_in_out'
    };

    return applyEntranceAnimation(
        frame,
        entranceConfig,
        adjustedFrameIndex,
        totalAnimFrames,
        fps
    );
}

/**
 * Apply attention animation to a frame (looping effect).
 * 
 * @param frame - The source frame (ImageData)
 * @param config - Layer animation configuration
 * @param frameIndex - Current frame index from attention start
 * @param fps - Frames per second
 * @returns Animated frame as ImageData
 */
export function applyLayerAttention(
    frame: ImageData,
    config: LayerAnimationConfig,
    frameIndex: number,
    fps: number
): ImageData {
    if (!config.attention_animation || config.attention_animation === 'none') {
        return frame;
    }

    const animType = normalizeAnimationType(config.attention_animation);
    const duration = config.attention_duration ?? getDefaultAnimationDuration(animType);
    const totalAnimFrames = Math.floor(duration * fps);

    // Handle iterations
    const maxIterations = config.attention_iterations ?? 0; // 0 = infinite
    const currentIteration = Math.floor(frameIndex / totalAnimFrames);

    if (maxIterations > 0 && currentIteration >= maxIterations) {
        return frame;
    }

    // Calculate frame within current iteration (loop)
    const iterationFrameIndex = frameIndex % totalAnimFrames;

    // Use entrance animation for attention effects (they work well for looping)
    const attentionConfig: EntranceAnimationConfig = {
        type: animType,
        duration: duration,
        easing: config.easing ?? 'ease_in_out'
    };

    return applyEntranceAnimation(
        frame,
        attentionConfig,
        iterationFrameIndex,
        totalAnimFrames,
        fps
    );
}

/**
 * Calculate the total duration of a layer including all animations.
 * 
 * @param config - Layer animation configuration
 * @param contentDuration - Duration of the layer content in seconds
 * @returns Total duration including entrance animation
 */
export function calculateLayerTotalDuration(
    config: LayerAnimationConfig,
    contentDuration: number
): number {
    let total = contentDuration;

    // Add entrance duration and delay
    if (config.entrance_animation && config.entrance_animation !== 'none') {
        const entranceType = normalizeAnimationType(config.entrance_animation);
        const entranceDuration = config.entrance_duration ?? getDefaultAnimationDuration(entranceType);
        const entranceDelay = config.entrance_delay ?? 0;
        total = Math.max(total, entranceDuration + entranceDelay);
    }

    return total;
}

/**
 * Get animation frames needed for a layer.
 * 
 * @param config - Layer animation configuration
 * @param fps - Frames per second
 * @returns Object with entrance and attention frame counts
 */
export function getLayerAnimationFrameCounts(
    config: LayerAnimationConfig,
    fps: number
): { entranceFrames: number; attentionFramesPerCycle: number } {
    let entranceFrames = 0;
    let attentionFramesPerCycle = 0;

    if (config.entrance_animation && config.entrance_animation !== 'none') {
        const entranceType = normalizeAnimationType(config.entrance_animation);
        const duration = config.entrance_duration ?? getDefaultAnimationDuration(entranceType);
        const delay = config.entrance_delay ?? 0;
        entranceFrames = Math.floor((duration + delay) * fps);
    }

    if (config.attention_animation && config.attention_animation !== 'none') {
        const attentionType = normalizeAnimationType(config.attention_animation);
        const duration = config.attention_duration ?? getDefaultAnimationDuration(attentionType);
        attentionFramesPerCycle = Math.floor(duration * fps);
    }

    return { entranceFrames, attentionFramesPerCycle };
}

/**
 * Generate animation frames for a complete layer lifecycle.
 * 
 * @param sourceFrame - The static source frame
 * @param config - Layer animation configuration
 * @param contentDurationSeconds - How long the content should be visible (excluding animations)
 * @param fps - Frames per second
 * @returns Array of animated frames
 */
export function generateLayerAnimationFrames(
    sourceFrame: ImageData,
    config: LayerAnimationConfig,
    contentDurationSeconds: number,
    fps: number
): ImageData[] {
    const frames: ImageData[] = [];
    const frameCounts = getLayerAnimationFrameCounts(config, fps);
    const contentFrames = Math.floor(contentDurationSeconds * fps);

    // Phase 1: Entrance animation
    for (let i = 0; i < frameCounts.entranceFrames; i++) {
        const animatedFrame = applyLayerEntrance(sourceFrame, config, i, fps);
        frames.push(animatedFrame);
    }

    // Phase 2: Content display (with optional attention animation)
    for (let i = 0; i < contentFrames; i++) {
        if (config.attention_animation && config.attention_animation !== 'none') {
            const attentionFrame = applyLayerAttention(sourceFrame, config, i, fps);
            frames.push(attentionFrame);
        } else {
            // Clone the source frame
            const contentFrame = new ImageData(
                new Uint8ClampedArray(sourceFrame.data),
                sourceFrame.width,
                sourceFrame.height
            );
            frames.push(contentFrame);
        }
    }

    return frames;
}

/**
 * Validate and normalize a layer animation configuration.
 * 
 * @param config - Partial layer animation configuration
 * @returns Complete and validated configuration
 */
export function normalizeLayerAnimationConfig(
    config: Partial<LayerAnimationConfig>
): LayerAnimationConfig {
    const normalized: LayerAnimationConfig = {};

    // Normalize entrance animation
    if (config.entrance_animation) {
        const entranceType = normalizeAnimationType(config.entrance_animation);
        if (entranceType !== AnimateCSSType.NONE) {
            normalized.entrance_animation = entranceType;
            normalized.entrance_duration = config.entrance_duration ??
                getDefaultAnimationDuration(entranceType);
            normalized.entrance_delay = config.entrance_delay ?? 0;
        }
    }

    // Normalize attention animation
    if (config.attention_animation) {
        const attentionType = normalizeAnimationType(config.attention_animation);
        if (attentionType !== AnimateCSSType.NONE) {
            normalized.attention_animation = attentionType;
            normalized.attention_duration = config.attention_duration ??
                getDefaultAnimationDuration(attentionType);
            normalized.attention_iterations = config.attention_iterations ?? 0;
        }
    }

    // Copy easing if provided
    if (config.easing) {
        normalized.easing = config.easing;
    }

    return normalized;
}

/**
 * Get a suggested animation configuration based on style.
 * 
 * @param style - Style name: 'subtle', 'dramatic', 'bounce', 'slide', 'zoom', 'flip', 'rotate'
 * @returns Animation configuration with entrance animation
 */
export function getSuggestedAnimationPair(style: string): LayerAnimationConfig {
    const styleLower = style.toLowerCase();

    switch (styleLower) {
        case 'subtle':
            return {
                entrance_animation: AnimateCSSType.FADE_IN,
                entrance_duration: 0.5
            };

        case 'dramatic':
            return {
                entrance_animation: AnimateCSSType.JACK_IN_THE_BOX,
                entrance_duration: 1.0,
                attention_animation: AnimateCSSType.TADA,
                attention_duration: 1.0,
                attention_iterations: 2
            };

        case 'bounce':
            return {
                entrance_animation: AnimateCSSType.BOUNCE_IN,
                entrance_duration: 0.75
            };

        case 'slide':
            return {
                entrance_animation: AnimateCSSType.SLIDE_IN_RIGHT,
                entrance_duration: 0.5
            };

        case 'zoom':
            return {
                entrance_animation: AnimateCSSType.ZOOM_IN,
                entrance_duration: 0.5
            };

        case 'flip':
            return {
                entrance_animation: AnimateCSSType.FLIP_IN_X,
                entrance_duration: 0.75
            };

        case 'rotate':
            return {
                entrance_animation: AnimateCSSType.ROTATE_IN,
                entrance_duration: 0.6
            };

        case 'back':
            return {
                entrance_animation: AnimateCSSType.BACK_IN_UP,
                entrance_duration: 0.6
            };

        case 'lightspeed':
            return {
                entrance_animation: AnimateCSSType.LIGHT_SPEED_IN_RIGHT,
                entrance_duration: 0.5
            };

        case 'roll':
            return {
                entrance_animation: AnimateCSSType.ROLL_IN,
                entrance_duration: 1.0
            };

        default:
            // Default to subtle fade
            return {
                entrance_animation: AnimateCSSType.FADE_IN,
                entrance_duration: 0.5
            };
    }
}
