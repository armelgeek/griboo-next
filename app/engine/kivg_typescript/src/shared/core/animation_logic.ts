import { AnimationType, Position, EmphasisAnimationType } from '../types';
import { AnimationTransition } from './easing';

export interface AnimationState {
    position: Position;
    scale: number;
    rotation: number;
    opacity: number;
    scaleX?: number;
    scaleY?: number;
    skewX?: number;
    strokeProgress?: number; // Progress of drawing/writing (0-1)
    revealProgress?: number; // Progress of reveal animation (0-1)
    eraseProgress?: number; // Progress of eraser animation (0-1)
    revealPattern?: 'horizontal' | 'vertical' | 'diagonal';
}

/**
 * Calculate the current animation state based on type and progress.
 * Ported from frontend LayerAnimator.applyFrame and server ServerLayer.applyTransform.
 */
export function calculateAnimationState(
    type: AnimationType,
    progress: number,
    startState: AnimationState,
    exitType?: AnimationType,
    exitProgress?: number,
    emphasisType?: EmphasisAnimationType,
    emphasisProgress?: number,
    emphasisIntensity: number = 1.0
): AnimationState {
    const state: AnimationState = {
        position: { ...startState.position },
        scale: startState.scale,
        rotation: startState.rotation,
        opacity: startState.opacity,
        scaleX: startState.scaleX ?? startState.scale ?? 1,
        scaleY: startState.scaleY ?? startState.scale ?? 1,
        skewX: startState.skewX ?? 0
    };

    // Helper to set opacity safely
    const setOpacity = (o: number) => {
        state.opacity = startState.opacity * o;
    };

    const SLIDE_OFFSET = 1000;

    // 1. Handle Entrance Animation
    if (progress <= 1.0) {
        switch (type) {
            case 'fade_in':
                setOpacity(progress);
                break;
            case 'fade_out':
                setOpacity(1 - progress);
                break;
            case 'slide_in_left':
                state.position.x -= SLIDE_OFFSET * (1 - progress);
                setOpacity(progress);
                break;
            case 'slide_in_right':
                state.position.x += SLIDE_OFFSET * (1 - progress);
                setOpacity(progress);
                break;
            case 'slide_in_top':
                state.position.y -= SLIDE_OFFSET * (1 - progress);
                setOpacity(progress);
                break;
            case 'slide_in_bottom':
                state.position.y += SLIDE_OFFSET * (1 - progress);
                setOpacity(progress);
                break;
            case 'slide_out_left':
                state.position.x -= SLIDE_OFFSET * progress;
                setOpacity(1 - progress);
                break;
            case 'slide_out_right':
                state.position.x += SLIDE_OFFSET * progress;
                setOpacity(1 - progress);
                break;
            case 'slide_out_top':
            case 'slide_out_up':
                state.position.y -= SLIDE_OFFSET * progress;
                setOpacity(1 - progress);
                break;
            case 'slide_out_bottom':
            case 'slide_out_down':
                state.position.y += SLIDE_OFFSET * progress;
                setOpacity(1 - progress);
                break;
            case 'zoom_in':
                state.scale *= (0.3 + 0.7 * progress);
                setOpacity(progress);
                break;
            case 'zoom_out':
                state.scale *= (1 - progress);
                setOpacity(1 - progress);
                break;
            case 'bounce':
            case 'bounce_in': {
                let bounceScale: number;
                if (progress < 0.6) {
                    bounceScale = (progress / 0.6) * 1.2;
                } else if (progress < 0.8) {
                    bounceScale = 1.2 - ((progress - 0.6) / 0.2) * 0.3;
                } else {
                    bounceScale = 0.9 + ((progress - 0.8) / 0.2) * 0.1;
                }
                state.scale *= bounceScale;
                setOpacity(Math.min(progress * 2, 1));
                break;
            }
            case 'bounce_out':
                // Bounce out is primarily an exit animation. 
                // As an entrance, we'll treat it as a scale-up bounce
                state.scale *= (progress < 0.8 ? 1.1 : 1.0);
                setOpacity(progress);
                break;
            case 'rotate_in':
            case 'spin_in':
                state.rotation += -180 + (progress * 180);
                state.scale *= progress;
                setOpacity(progress);
                break;
            case 'rotate_out':
            case 'spin_out':
                state.rotation += progress * (type === 'spin_out' ? 360 : 200);
                state.scale *= (1 - progress);
                setOpacity(1 - progress);
                break;
            case 'pulse': {
                const pulseScale = 1 + 0.05 * Math.sin(progress * Math.PI);
                state.scale *= pulseScale;
                break;
            }
            case 'click': {
                const clickScale = progress < 0.5
                    ? 1 - (progress * 2 * 0.1)
                    : 0.9 + ((progress - 0.5) * 2 * 0.1);
                state.scale *= clickScale;
                break;
            }
            case 'shake_x':
                state.position.x += 10 * Math.sin(progress * Math.PI * 10);
                break;
            case 'shake_y':
                state.position.y += 10 * Math.sin(progress * Math.PI * 10);
                break;
            case 'tada': {
                const s = progress < 0.2 ? 0.9 : (progress < 0.9 ? 1.1 : 1.0);
                const r = 3 * Math.sin(progress * Math.PI * 10);
                state.scale *= s;
                state.rotation += r;
                break;
            }
            case 'flash': {
                const flashOpacity = Math.floor(progress * 4) % 2 === 0 ? 1 : 0;
                setOpacity(flashOpacity);
                break;
            }
            case 'head_shake': {
                state.position.x += 6 * Math.sin(progress * Math.PI * 4);
                state.rotation += 2 * Math.sin(progress * Math.PI * 4);
                break;
            }
            case 'jello': {
                const skew = 12 * Math.sin(progress * Math.PI * 4) * (1 - progress);
                state.skewX = skew;
                break;
            }
            case 'rubber_band': {
                // Approximating rubber band with scaleX/scaleY
                if (progress < 0.3) {
                    state.scaleX = 1.25; state.scaleY = 0.75;
                } else if (progress < 0.4) {
                    state.scaleX = 0.75; state.scaleY = 1.25;
                } else if (progress < 0.5) {
                    state.scaleX = 1.15; state.scaleY = 0.85;
                } else if (progress < 0.65) {
                    state.scaleX = 0.95; state.scaleY = 1.05;
                } else if (progress < 0.75) {
                    state.scaleX = 1.05; state.scaleY = 0.95;
                } else {
                    state.scaleX = 1; state.scaleY = 1;
                }
                break;
            }
            case 'swing': {
                state.rotation += 15 * Math.sin(progress * Math.PI * 3);
                break;
            }
            case 'wobble': {
                state.position.x += 20 * Math.sin(progress * Math.PI * 3);
                state.rotation += 5 * Math.sin(progress * Math.PI * 3);
                break;
            }
            case 'heart_beat': {
                const s = 1 + 0.3 * Math.abs(Math.sin(progress * Math.PI * 2));
                state.scale *= s;
                break;
            }
            // Directional Fades
            case 'fade_in_down':
                state.position.y += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_up':
                state.position.y += 100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_left':
                state.position.x += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_right':
                state.position.x += 100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_top_left':
                state.position.x += -100 * (1 - progress);
                state.position.y += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_top_right':
                state.position.x += 100 * (1 - progress);
                state.position.y += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_bottom_left':
                state.position.x += -100 * (1 - progress);
                state.position.y += 100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'fade_in_bottom_right':
                state.position.x += 100 * (1 - progress);
                state.position.y += 100 * (1 - progress);
                setOpacity(progress);
                break;
            // Directional Back Entrances
            case 'back_in_down':
                state.position.y += -1200 * (1 - progress);
                state.scale *= (0.7 + 0.3 * progress);
                setOpacity(0.7 + 0.3 * progress);
                break;
            case 'back_in_up':
                state.position.y += 1200 * (1 - progress);
                state.scale *= (0.7 + 0.3 * progress);
                setOpacity(0.7 + 0.3 * progress);
                break;
            case 'back_in_left':
                state.position.x += -2000 * (1 - progress);
                state.scale *= (0.7 + 0.3 * progress);
                setOpacity(0.7 + 0.3 * progress);
                break;
            case 'back_in_right':
                state.position.x += 2000 * (1 - progress);
                state.scale *= (0.7 + 0.3 * progress);
                setOpacity(0.7 + 0.3 * progress);
                break;
            // Directional Bounce Entrances
            case 'bounce_in_down':
                state.position.y += -3000 * Math.pow(1 - progress, 2);
                setOpacity(progress > 0.1 ? 1 : 0);
                break;
            case 'bounce_in_up':
                state.position.y += 3000 * Math.pow(1 - progress, 2);
                setOpacity(progress > 0.1 ? 1 : 0);
                break;
            case 'bounce_in_left':
                state.position.x += -3000 * Math.pow(1 - progress, 2);
                setOpacity(progress > 0.1 ? 1 : 0);
                break;
            case 'bounce_in_right':
                state.position.x += 3000 * Math.pow(1 - progress, 2);
                setOpacity(progress > 0.1 ? 1 : 0);
                break;
            // Directional Zooms
            case 'zoom_in_down':
                state.scale *= (0.1 + 0.9 * progress);
                state.position.y += -1000 * (1 - progress);
                setOpacity(progress);
                break;
            case 'zoom_in_up':
                state.scale *= (0.1 + 0.9 * progress);
                state.position.y += 1000 * (1 - progress);
                setOpacity(progress);
                break;
            case 'zoom_in_left':
                state.scale *= (0.1 + 0.9 * progress);
                state.position.x += -1000 * (1 - progress);
                setOpacity(progress);
                break;
            case 'zoom_in_right':
                state.scale *= (0.1 + 0.9 * progress);
                state.position.x += 1000 * (1 - progress);
                setOpacity(progress);
                break;
            // Specials
            case 'jack_in_the_box':
                if (progress < 0.5) {
                    state.scale *= (0.1 + 0.9 * (progress / 0.5));
                    state.rotation += 30 - 40 * (progress / 0.5);
                    setOpacity(progress / 0.5);
                } else {
                    state.scale = 1;
                    state.rotation += -10 + 10 * (progress - 0.5) / 0.5;
                    setOpacity(1);
                }
                break;
            case 'roll_in':
                state.position.x += -200 * (1 - progress);
                state.rotation += -120 * (1 - progress);
                setOpacity(progress);
                break;
            case 'lightspeed_in':
                state.position.x += 1000 * (1 - progress);
                state.skewX = -30 * (1 - progress);
                setOpacity(progress);
                break;
            case 'flip_in':
            case 'flip_in_x':
                // Simulate flip by scaling Y
                state.scaleY = progress;
                setOpacity(progress);
                break;
            case 'flip_in_y':
                // Simulate flip by scaling X
                state.scaleX = progress;
                setOpacity(progress);
                break;
            case 'rotate_in_down_left':
                state.rotation += -45 * (1 - progress);
                state.position.x += -100 * (1 - progress);
                state.position.y += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'rotate_in_down_right':
                state.rotation += 45 * (1 - progress);
                state.position.x += 100 * (1 - progress);
                state.position.y += -100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'rotate_in_up_left':
                state.rotation += 45 * (1 - progress);
                state.position.x += -100 * (1 - progress);
                state.position.y += 100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'rotate_in_up_right':
                state.rotation += -45 * (1 - progress);
                state.position.x += 100 * (1 - progress);
                state.position.y += 100 * (1 - progress);
                setOpacity(progress);
                break;
            case 'rotate_in':
            case 'spin_in':
                state.rotation += (1 - progress) * (type === 'spin_in' ? -360 : -200);
                state.scale *= progress;
                setOpacity(progress);
                break;
            case 'reveal_diagonal':
                setOpacity(1);
                state.revealProgress = progress;
                state.revealPattern = 'diagonal';
                break;
            case 'reveal_horizontal':
                setOpacity(1);
                state.revealProgress = progress;
                state.revealPattern = 'horizontal';
                break;
            case 'reveal_vertical':
                setOpacity(1);
                state.revealProgress = progress;
                state.revealPattern = 'vertical';
                break;
            case 'slide_in':
                state.position.x -= SLIDE_OFFSET * (1 - progress);
                setOpacity(progress);
                break;
            case 'push':
                state.opacity = progress > 0 ? 1 : 0;
                // Position is handled by the layer's specific logic (like PushLayer)
                break;
            case 'none':
            case 'draw':
            case 'typewriter':
            case 'char_fade':
                setOpacity(1);
                state.strokeProgress = progress;
                break;
            default:
                // Fallback to fade in for unknown types
                setOpacity(progress);
                break;
        }
    }

    // 2. Handle Emphasis Animation
    if (emphasisType && emphasisProgress !== undefined) {
        // emphasisProgress is 0-1 for a single cycle
        const p = emphasisProgress;
        const scale = emphasisIntensity;

        switch (emphasisType) {
            case 'pulse':
                // 0 -> 1.1 -> 1
                const pulseScale = 1 + (0.1 * scale) * Math.sin(p * Math.PI);
                state.scale *= pulseScale;
                break;
            case 'shake':
                // Left -> Right -> ...
                const shakeAmount = 10 * scale;
                // Simple sine wave shake: 5 cycles
                state.position.x += shakeAmount * Math.sin(p * Math.PI * 10);
                break;
            case 'bounce':
                // Up -> Down
                // y: 0 -> -30 -> 0 -> -15 -> 0
                if (p < 0.2 || p > 0.8) {
                    // Ground
                } else if (p < 0.5) {
                    state.position.y -= (30 * scale) * Math.sin((p - 0.2) / 0.3 * Math.PI);
                } else {
                    state.position.y -= (15 * scale) * Math.sin((p - 0.5) / 0.3 * Math.PI);
                }
                break;
            case 'swing':
                const swingAngle = 15 * scale;
                state.rotation += swingAngle * Math.sin(p * Math.PI * 2);
                break;
            case 'flash':
                // Opacity flicker
                if (p < 0.5) state.opacity = 1;
                else state.opacity = 0;
                break;
            case 'tada':
                // Scale + Rotate
                if (p > 0.1 && p < 0.9) {
                    state.scale *= (1 + 0.1 * scale);
                    state.rotation += (3 * scale) * Math.sin(p * Math.PI * 8);
                }
                break;
            case 'wobble':
                state.position.x += (20 * scale) * Math.sin(p * Math.PI * 4);
                state.rotation += (5 * scale) * Math.sin(p * Math.PI * 4);
                break;
            case 'wiggle':
                state.rotation += (10 * scale) * Math.sin(p * Math.PI * 6);
                break;
            case 'rubber_band':
                if (p < 0.3) {
                    state.scaleX = (state.scaleX ?? 1) * (1 + 0.25 * scale);
                    state.scaleY = (state.scaleX ?? 1) * (1 - 0.25 * scale);
                } else if (p < 0.45) {
                    state.scaleX = (state.scaleX ?? 1) * (1 - 0.25 * scale);
                    state.scaleY = (state.scaleX ?? 1) * (1 + 0.25 * scale);
                } else {
                    state.scaleX = (state.scaleX ?? 1) * 1;
                    state.scaleY = (state.scaleX ?? 1) * 1;
                }
                break;
            case 'jello':
                state.skewX = (12 * scale) * Math.sin(p * Math.PI * 4) * (1 - p);
                break;
            case 'heart_beat':
                state.scale *= (1 + 0.3 * scale * Math.abs(Math.sin(p * Math.PI * 2)));
                break;
            case 'glow':
                // Glow is usually handled by a filter/shadow in renderer,
                // but we can simulate intensity by subtle scale or passing a property
                state.scale *= (1 + 0.02 * scale * Math.sin(p * Math.PI));
                break;
            case 'click':
                const clickScale = p < 0.5
                    ? 1 - (p * 2 * 0.1 * scale)
                    : (1 - 0.1 * scale) + ((p - 0.5) * 2 * 0.1 * scale);
                state.scale *= clickScale;
                break;
        }
    }

    // 3. Handle Exit Animation
    if (exitType && exitProgress && exitProgress > 0) {
        switch (exitType) {
            case 'fade_out':
                state.opacity *= (1 - exitProgress);
                break;
            case 'zoom_out':
                state.scale *= (1 - exitProgress);
                state.opacity *= (1 - exitProgress);
                break;
            case 'slide_out_left':
                state.position.x -= SLIDE_OFFSET * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'slide_out_right':
                state.position.x += SLIDE_OFFSET * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'slide_out_top':
            case 'slide_out_up':
                state.position.y -= SLIDE_OFFSET * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'slide_out_bottom':
            case 'slide_out_down':
                state.position.y += SLIDE_OFFSET * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'back_out_down':
                state.scale *= (1 - 0.3 * exitProgress);
                state.position.y += 700 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'back_out_up':
                state.scale *= (1 - 0.3 * exitProgress);
                state.position.y -= 700 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'back_out_left':
                state.scale *= (1 - 0.3 * exitProgress);
                state.position.x -= 2000 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'back_out_right':
                state.scale *= (1 - 0.3 * exitProgress);
                state.position.x += 2000 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'bounce_out_down':
                state.position.y += SLIDE_OFFSET * exitProgress;
                state.scale *= (1 + 0.1 * Math.sin(exitProgress * Math.PI));
                state.opacity *= (1 - exitProgress);
                break;
            case 'bounce_out_left':
                state.position.x -= SLIDE_OFFSET * exitProgress;
                state.scale *= (1 + 0.1 * Math.sin(exitProgress * Math.PI));
                state.opacity *= (1 - exitProgress);
                break;
            case 'bounce_out_right':
                state.position.x += SLIDE_OFFSET * exitProgress;
                state.scale *= (1 + 0.1 * Math.sin(exitProgress * Math.PI));
                state.opacity *= (1 - exitProgress);
                break;
            case 'bounce_out_up':
                state.position.y -= SLIDE_OFFSET * exitProgress;
                state.scale *= (1 + 0.1 * Math.sin(exitProgress * Math.PI));
                state.opacity *= (1 - exitProgress);
                break;
            case 'bounce_out':
                if (exitProgress < 0.2) {
                    state.scale *= (1 + (exitProgress / 0.2) * 0.1);
                } else {
                    state.scale *= (1.1 * (1 - (exitProgress - 0.2) / 0.8));
                }
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_down':
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_down_big':
                state.position.y += 500 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_left':
                state.position.x -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_left_big':
                state.position.x -= 500 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_right':
                state.position.x += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_right_big':
                state.position.x += 500 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_up':
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_up_big':
                state.position.y -= 500 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_top_left':
                state.position.x -= 100 * exitProgress;
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_top_right':
                state.position.x += 100 * exitProgress;
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_bottom_left':
                state.position.x -= 100 * exitProgress;
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'fade_out_bottom_right':
                state.position.x += 100 * exitProgress;
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'roll_out':
                state.position.x += 200 * exitProgress;
                state.rotation += 120 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'rotate_out':
            case 'spin_out':
                state.rotation += exitProgress * (exitType === 'spin_out' ? 360 : 200);
                state.scale *= (1 - exitProgress);
                state.opacity *= (1 - exitProgress);
                break;
            case 'rotate_out_down_left':
                state.rotation += 45 * exitProgress;
                state.position.x -= 100 * exitProgress;
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'rotate_out_down_right':
                state.rotation -= 45 * exitProgress;
                state.position.x += 100 * exitProgress;
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'rotate_out_up_left':
                state.rotation -= 45 * exitProgress;
                state.position.x -= 100 * exitProgress;
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'rotate_out_up_right':
                state.rotation += 45 * exitProgress;
                state.position.x += 100 * exitProgress;
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'lightspeed_out':
                state.position.x += 1000 * exitProgress;
                state.skewX = 30 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'flip_out':
            case 'flip_out_x':
                state.scaleY = (state.scaleY ?? 1) * (1 - exitProgress);
                state.opacity *= (1 - exitProgress);
                break;
            case 'flip_out_y':
                state.scaleX = (state.scaleX ?? 1) * (1 - exitProgress);
                state.opacity *= (1 - exitProgress);
                break;
            case 'zoom_out_down':
                state.scale *= (1 - exitProgress);
                state.position.y += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'zoom_out_left':
                state.scale *= (1 - exitProgress);
                state.position.x -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'zoom_out_right':
                state.scale *= (1 - exitProgress);
                state.position.x += 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'zoom_out_up':
                state.scale *= (1 - exitProgress);
                state.position.y -= 100 * exitProgress;
                state.opacity *= (1 - exitProgress);
                break;
            case 'eraser':
                // Eraser animation is handled by renderer (masking + hand)
                // We pass the progress for the renderer to use
                state.eraseProgress = exitProgress;
                // Layer stays fully opaque/visible until erased by the mask
                state.opacity = 1;
                break;
        }
    }

    return state;
}

/**
 * Interpolate between keyframes.
 */
export function interpolateKeyframes(progress: number, keyframes: any[]): any {
    if (keyframes.length === 0) return {};
    if (keyframes.length === 1) return keyframes[0];

    for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].p && progress <= keyframes[i + 1].p) {
            const t = (progress - keyframes[i].p) / (keyframes[i + 1].p - keyframes[i].p);
            const nextFrame = keyframes[i + 1];
            const currentFrame = keyframes[i];

            const frame = { ...currentFrame };

            for (const key in currentFrame) {
                if (key !== 'p' && typeof currentFrame[key] === 'number' && typeof nextFrame[key] === 'number') {
                    frame[key] = currentFrame[key] + (nextFrame[key] - currentFrame[key]) * t;
                }
            }
            return frame;
        }
    }
    return keyframes[keyframes.length - 1];
}
