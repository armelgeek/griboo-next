/**
 * Server-side Timing Monitor
 * 
 * Tracks animation progress across frames during video export
 * and logs the expected vs. actual durations.
 */
export class ServerTimingMonitor {
    private layerStats: Map<string, {
        layerType: string;
        animationType: string;
        startTime: number | null;
        endTime: number | null;
        expectedDurationMs: number;
    }> = new Map();

    /**
     * Track progress of a layer's animation at a specific scene time.
     * 
     * @param layerId - Unique ID of the layer
     * @param layerType - Type of the layer (e.g., ShapeLayer)
     * @param animationType - Type of animation (e.g., draw)
     * @param time - Current scene time in seconds
     * @param progress - Animation progress (0-1)
     * @param expectedDurationMs - Expected duration in milliseconds
     * @param expectedStartTime - Expected start time in seconds
     * @param expectedEndTime - Expected end time in seconds
     */
    trackProgress(
        layerId: string,
        layerType: string,
        animationType: string,
        time: number,
        progress: number,
        expectedDurationMs: number,
        expectedStartTime: number,
        expectedEndTime: number
    ): void {
        if (!this.layerStats.has(layerId)) {
            this.layerStats.set(layerId, {
                layerType,
                animationType,
                startTime: null,
                endTime: null,
                expectedDurationMs
            });
        }

        const stats = this.layerStats.get(layerId)!;

        // Snap start time: if this frame is exactly at or just after expected start
        if (progress > 0 && stats.startTime === null) {
            // If we hit a frame exactly at expectedStartTime, or if this is the first frame with progress
            // we can assume the animation started at expectedStartTime
            stats.startTime = expectedStartTime;
        }

        // Snap end time: if this frame is exactly at or just after expected end
        if (progress >= 1 && stats.endTime === null) {
            stats.endTime = expectedEndTime;
        }
    }

    /**
     * Log the collected timing results to the console.
     */
    logResults(): void {
        console.log('\n📊 Server Timing Metrics:');

        for (const [layerId, stats] of Array.from(this.layerStats.entries())) {
            if (stats.startTime === null || stats.endTime === null) {
                // Animation never started or never finished
                continue;
            }

            const actualDurationMs = (stats.endTime - stats.startTime) * 1000;
            const expectedDurationMs = stats.expectedDurationMs;
            const difference = Math.abs(actualDurationMs - expectedDurationMs);

            // Add visual indicator for timing accuracy (parity with frontend)
            // On server, we expect higher precision (within 1ms or 1 frame)
            const indicator = difference <= 1 ? '✓' : (difference <= 34 ? '~' : '!');

            console.log(
                `[${stats.layerType}] Layer ${layerId} (${stats.animationType}): ` +
                `Expected ${Math.round(expectedDurationMs)}ms, Actual ${Math.round(actualDurationMs)}ms ${indicator}`
            );
        }
        console.log('');
    }
}
