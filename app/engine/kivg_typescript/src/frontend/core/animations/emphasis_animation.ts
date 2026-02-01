/**
 * Emphasis Animation Module
 * 
 * Provides emphasis animations that play while an element is visible.
 * These animations attract attention without changing the element's position.
 */

import { EmphasisAnimationType } from '../../../shared/types';

export interface EmphasisAnimationConfig {
    type: EmphasisAnimationType;
    duration: number;
    delay?: number;
    iterations?: number;
    intensity?: number;
    easing?: string;
}

// Unique ID counter for keyframe names
let keyframeCounter = 0;

/**
 * Generate CSS keyframes for emphasis animations
 */
function generateKeyframes(type: EmphasisAnimationType, intensity: number = 1.0): string {
    const scale = intensity;

    switch (type) {
        case 'pulse':
            return `
                0%, 100% { transform: scale(1); }
                50% { transform: scale(${1 + 0.1 * scale}); }
            `;

        case 'shake':
            const shakeAmount = 10 * scale;
            return `
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-${shakeAmount}px); }
                20%, 40%, 60%, 80% { transform: translateX(${shakeAmount}px); }
            `;

        case 'bounce':
            return `
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-${30 * scale}px); }
                60% { transform: translateY(-${15 * scale}px); }
            `;

        case 'wiggle':
            const wiggleAngle = 5 * scale;
            return `
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-${wiggleAngle}deg); }
                50% { transform: rotate(${wiggleAngle}deg); }
                75% { transform: rotate(-${wiggleAngle}deg); }
            `;

        case 'glow':
            return `
                0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 255, 0, 0)); }
                50% { filter: drop-shadow(0 0 ${10 * scale}px rgba(255, 255, 0, 0.8)); }
            `;

        case 'flash':
            return `
                0%, 50%, 100% { opacity: 1; }
                25%, 75% { opacity: 0; }
            `;

        case 'rubber_band':
            return `
                0% { transform: scaleX(1) scaleY(1); }
                30% { transform: scaleX(${1 + 0.25 * scale}) scaleY(${1 - 0.25 * scale}); }
                40% { transform: scaleX(${1 - 0.25 * scale}) scaleY(${1 + 0.25 * scale}); }
                50% { transform: scaleX(${1 + 0.15 * scale}) scaleY(${1 - 0.15 * scale}); }
                65% { transform: scaleX(${1 - 0.05 * scale}) scaleY(${1 + 0.05 * scale}); }
                75% { transform: scaleX(${1 + 0.05 * scale}) scaleY(${1 - 0.05 * scale}); }
                100% { transform: scaleX(1) scaleY(1); }
            `;

        case 'swing':
            const swingAngle = 15 * scale;
            return `
                0% { transform: rotate(0deg); }
                20% { transform: rotate(${swingAngle}deg); }
                40% { transform: rotate(-${swingAngle * 0.67}deg); }
                60% { transform: rotate(${swingAngle * 0.33}deg); }
                80% { transform: rotate(-${swingAngle * 0.17}deg); }
                100% { transform: rotate(0deg); }
            `;

        case 'tada':
            return `
                0% { transform: scale(1) rotate(0deg); }
                10%, 20% { transform: scale(${1 - 0.1 * scale}) rotate(-${3 * scale}deg); }
                30%, 50%, 70%, 90% { transform: scale(${1 + 0.1 * scale}) rotate(${3 * scale}deg); }
                40%, 60%, 80% { transform: scale(${1 + 0.1 * scale}) rotate(-${3 * scale}deg); }
                100% { transform: scale(1) rotate(0deg); }
            `;

        case 'wobble':
            return `
                0% { transform: translateX(0) rotate(0deg); }
                15% { transform: translateX(-${25 * scale}%) rotate(-${5 * scale}deg); }
                30% { transform: translateX(${20 * scale}%) rotate(${3 * scale}deg); }
                45% { transform: translateX(-${15 * scale}%) rotate(-${3 * scale}deg); }
                60% { transform: translateX(${10 * scale}%) rotate(${2 * scale}deg); }
                75% { transform: translateX(-${5 * scale}%) rotate(-${1 * scale}deg); }
                100% { transform: translateX(0) rotate(0deg); }
            `;

        case 'jello':
            return `
                0%, 100% { transform: skewX(0deg) skewY(0deg); }
                11.1% { transform: skewX(-${12.5 * scale}deg) skewY(-${12.5 * scale}deg); }
                22.2% { transform: skewX(${6.25 * scale}deg) skewY(${6.25 * scale}deg); }
                33.3% { transform: skewX(-${3.125 * scale}deg) skewY(-${3.125 * scale}deg); }
                44.4% { transform: skewX(${1.5625 * scale}deg) skewY(${1.5625 * scale}deg); }
                55.5% { transform: skewX(-${0.78125 * scale}deg) skewY(-${0.78125 * scale}deg); }
                66.6% { transform: skewX(${0.390625 * scale}deg) skewY(${0.390625 * scale}deg); }
                77.7% { transform: skewX(-${0.1953125 * scale}deg) skewY(-${0.1953125 * scale}deg); }
            `;

        case 'heart_beat':
            return `
                0% { transform: scale(1); }
                14% { transform: scale(${1 + 0.3 * scale}); }
                28% { transform: scale(1); }
                42% { transform: scale(${1 + 0.3 * scale}); }
                70% { transform: scale(1); }
            `;

        case 'none':
        default:
            return '';
    }
}

/**
 * Apply emphasis animation to an SVG element
 */
export function applyEmphasisAnimation(
    element: SVGElement | HTMLElement,
    config: EmphasisAnimationConfig
): string | null {
    if (config.type === 'none') {
        return null;
    }

    const keyframeName = `emphasis-${config.type}-${keyframeCounter++}`;
    const intensity = config.intensity ?? 1.0;
    const keyframes = generateKeyframes(config.type, intensity);

    if (!keyframes) {
        return null;
    }

    // Create and inject keyframes
    const styleId = `emphasis-style-${keyframeName}`;
    let styleElement = document.getElementById(styleId);

    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
        @keyframes ${keyframeName} {
            ${keyframes}
        }
    `;

    // Apply animation to element
    const duration = config.duration || 1;
    const delay = config.delay || 0;
    const iterations = config.iterations ?? 1;
    const easing = config.easing || 'ease-in-out';
    const iterationValue = iterations === Infinity ? 'infinite' : iterations.toString();

    element.style.animation = `${keyframeName} ${duration}s ${easing} ${delay}s ${iterationValue}`;
    element.style.transformOrigin = 'center center';

    // Store animation name for cleanup
    (element as any).__emphasisAnimationName = keyframeName;
    (element as any).__emphasisStyleId = styleId;

    return keyframeName;
}

/**
 * Stop emphasis animation on an element
 */
export function stopEmphasisAnimation(element: SVGElement | HTMLElement): void {
    element.style.animation = '';

    // Clean up stored references
    const styleId = (element as any).__emphasisStyleId;
    if (styleId) {
        const styleElement = document.getElementById(styleId);
        if (styleElement) {
            styleElement.remove();
        }
    }

    delete (element as any).__emphasisAnimationName;
    delete (element as any).__emphasisStyleId;
}

/**
 * Pause emphasis animation on an element
 */
export function pauseEmphasisAnimation(element: SVGElement | HTMLElement): void {
    element.style.animationPlayState = 'paused';
}

/**
 * Resume emphasis animation on an element
 */
export function resumeEmphasisAnimation(element: SVGElement | HTMLElement): void {
    element.style.animationPlayState = 'running';
}

/**
 * Check if element has an active emphasis animation
 */
export function hasEmphasisAnimation(element: SVGElement | HTMLElement): boolean {
    return !!(element as any).__emphasisAnimationName;
}

/**
 * Get the total duration of the emphasis animation including all iterations
 */
export function getEmphasisDuration(config: EmphasisAnimationConfig): number {
    if (config.type === 'none') return 0;

    const duration = config.duration || 1;
    const delay = config.delay || 0;
    const iterations = config.iterations ?? 1;

    // If infinite, return just one cycle duration for timing purposes
    if (iterations === Infinity) {
        return delay + duration;
    }

    return delay + (duration * iterations);
}
