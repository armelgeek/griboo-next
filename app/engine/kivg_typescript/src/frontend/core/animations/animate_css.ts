/**
 * Animate.css Types and Config for Layer Animations
 */

export const AnimateCSSType = {
    NONE: 'none',
    FADE_IN: 'fade_in',
    JACK_IN_THE_BOX: 'jackInTheBox',
    TADA: 'tada',
    BOUNCE_IN: 'bounce_in',
    SLIDE_IN_RIGHT: 'slideInRight',
    ZOOM_IN: 'zoomIn',
    FLIP_IN_X: 'flipInX',
    ROTATE_IN: 'rotateIn',
    BACK_IN_UP: 'backInUp',
    LIGHT_SPEED_IN_RIGHT: 'lightSpeedInRight',
    ROLL_IN: 'rollIn',
} as const;

export type AnimateCSSTypeValue = typeof AnimateCSSType[keyof typeof AnimateCSSType];

export interface LayerAnimationConfig {
    entrance_animation?: AnimateCSSTypeValue | string;
    entrance_duration?: number;
    entrance_delay?: number;
    attention_animation?: AnimateCSSTypeValue | string;
    attention_duration?: number;
    attention_iterations?: number;
    easing?: string;
}

/**
 * Get default duration for a specific animation type.
 */
export function getDefaultAnimationDuration(type: string): number {
    if (type.includes('bounce')) return 0.75;
    if (type.includes('jack')) return 1.0;
    if (type.includes('roll')) return 1.0;
    return 1.0;
}

/**
 * Normalize animation type string.
 */
export function normalizeAnimationType(type: string | undefined): AnimateCSSTypeValue {
    if (!type || type === 'none') return AnimateCSSType.NONE;
    return type as AnimateCSSTypeValue;
}
