/**
 * Timing Precision Utilities
 * 
 * Provides utilities for precise animation timing with adaptive correction
 * and visual smoothing to ensure animations complete within exact durations
 * while remaining visually imperceptible.
 */

/**
 * Tolerance for timing adjustments (1 frame at 60fps)
 * Prevents over-compensation from causing overshoots
 */
export const FRAME_TOLERANCE_MS = 16;



/**
 * Improved settle ratio for better timing precision
 * Increased from 0.2 (20%) to 0.25 (25%) to provide:
 * - Better margin for timing corrections
 * - Smoother visual completion
 * - Less visible timing discrepancies
 */
export const DEFAULT_SETTLE_RATIO = 0.25;

/**
 * Non-blocking wait using hybrid setTimeout and busy-wait for sub-millisecond precision.
 * 
 * @param seconds - Duration to wait in seconds
 * @returns Promise that resolves when the duration has elapsed
 */
export async function preciseWait(seconds: number): Promise<void> {
    const ms = seconds * 1000;
    if (ms <= 0) return;

    const startTime = performance.now();
    const targetTime = startTime + ms;

    // 1. Bulk wait: Use setTimeout for anything over 4ms.
    // We stop 2ms early to account for setTimeout's jitter.
    if (ms > 4) {
        await new Promise(resolve => setTimeout(resolve, ms - 2));
    }

    // 2. Precision wait: Busy-wait for the final few milliseconds to hit the exact target.
    while (performance.now() < targetTime) {
        // Micro-adjustment loop
    }
}

/**
 * Applies precise timing correction to ensure exact duration
 * Uses adaptive approach with busy-wait for sub-millisecond precision
 * 
 * @param startTime - Animation start time from performance.now()
 * @param targetDurationMs - Target duration in milliseconds
 * @returns Promise that resolves when timing is corrected
 */
export async function applyTimingCorrection(
    startTime: number,
    targetDurationMs: number
): Promise<void> {
    const targetTime = startTime + targetDurationMs;

    // 1. Bulk wait: Use setTimeout if we are more than 4ms early
    const remaining = targetTime - performance.now();
    if (remaining > 4) {
        await new Promise(resolve => setTimeout(resolve, remaining - 2));
    }

    // 2. Precision wait: Busy-wait for the final few milliseconds
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        console.log('[TimingPrecision] Skipping busy-wait in test environment');
        return;
    }

    while (performance.now() < targetTime) {
        // Micro-adjustment loop
    }
}

/**
 * Calculates precise settle time with frame tolerance
 * 
 * @param animationStartTime - Start time from performance.now()
 * @param totalDurationMs - Total target duration in milliseconds
 * @param frameTolerance - Tolerance in ms (default: FRAME_TOLERANCE_MS)
 * @returns Settle time in seconds (for use with wait())
 */
export function calculatePreciseSettleTime(
    animationStartTime: number,
    totalDurationMs: number,
    frameTolerance: number = FRAME_TOLERANCE_MS
): number {
    const elapsedBeforeSettle = performance.now() - animationStartTime;
    const remainingTime = totalDurationMs - elapsedBeforeSettle;

    // Subtract frame tolerance to avoid over-compensation
    const preciseSettleTime = Math.max(0, remainingTime - frameTolerance) / 1000;

    return preciseSettleTime;
}

/**
 * Formats timing results for logging with rounded values
 * Rounds to nearest millisecond for cleaner, more readable logs
 * 
 * @param actualDuration - Actual duration in milliseconds
 * @param expectedDuration - Expected duration in milliseconds
 * @returns Object with rounded values
 */
export function formatTimingResult(
    actualDuration: number,
    expectedDuration: number
): { roundedActual: number; roundedExpected: number; difference: number } {
    const roundedActual = Math.round(actualDuration);
    const roundedExpected = Math.round(expectedDuration);
    const difference = roundedActual - roundedExpected;

    return { roundedActual, roundedExpected, difference };
}

/**
 * Complete timing precision workflow
 * Combines settle time calculation and timing correction
 * 
 * @param animationStartTime - Start time from performance.now()
 * @param totalDurationMs - Total target duration in milliseconds
 * @param waitFn - Async wait function (e.g., layer.wait)
 * @returns Promise that resolves when timing is complete
 */
export async function completeTimingPrecision(
    animationStartTime: number,
    totalDurationMs: number,
    waitFn: (seconds: number) => Promise<void>
): Promise<void> {
    // Calculate and wait for settle time
    const settleTime = calculatePreciseSettleTime(animationStartTime, totalDurationMs);

    if (settleTime > 0) {
        await waitFn(settleTime);
    }

    // Apply final timing correction
    await applyTimingCorrection(animationStartTime, totalDurationMs);
}

/**
 * Logs timing result with consistent formatting
 * 
 * @param layerType - Type of layer (e.g., "TextToSVGLayer", "ShapeLayer")
 * @param layerId - Layer ID
 * @param animationType - Animation type (e.g., "stroke", "typewriter", "draw")
 * @param actualDuration - Actual duration in milliseconds
 * @param expectedDuration - Expected duration in milliseconds
 */
export function logTimingResult(
    layerType: string,
    layerId: string,
    animationType: string,
    actualDuration: number,
    expectedDuration: number
): void {
    const { roundedActual, roundedExpected, difference } = formatTimingResult(
        actualDuration,
        expectedDuration
    );

    // Add visual indicator for timing accuracy
    const indicator = Math.abs(difference) <= 1 ? '✓' : (Math.abs(difference) <= 50 ? '~' : '!');

    console.log(
        `[${layerType}] Layer ${layerId} (${animationType}): ` +
        `Expected ${roundedExpected}ms, Actual ${roundedActual}ms ${indicator}`
    );
}
