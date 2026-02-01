/**
 * AdaptiveBuffer - Real-time drift compensation and buffer adjustment
 * 
 * Tracks timing drift across animation layers and calculates an optimal
 * buffer duration to ensure subsequent layers start on time without
 * excessive overhead.
 */
export class AdaptiveBuffer {
    private history: number[] = [];
    private readonly MAX_HISTORY = 10;
    private readonly baseBuffer: number;
    private readonly debug: boolean;

    constructor(config: { baseBuffer: number; debug: boolean }) {
        this.baseBuffer = config.baseBuffer;
        this.debug = config.debug;
    }

    /**
     * Record the actual drift of a layer
     * @param expected - Expected duration (ms)
     * @param actual - Actual duration (ms)
     */
    public recordDrift(expected: number, actual: number): void {
        const drift = actual - expected;
        this.history.push(drift);

        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }

        if (this.debug) {
            console.log(`[AdaptiveBuffer] Recorded drift: ${drift.toFixed(1)}ms (avg: ${this.getAverageDrift().toFixed(1)}ms)`);
        }
    }

    /**
     * Check if we have enough data to make an informed adjustment
     */
    public hasEnoughData(): boolean {
        return this.history.length >= 3;
    }

    /**
     * Calculate the optimal buffer based on recent drift history
     */
    public getOptimalBuffer(): number {
        if (this.history.length === 0) return this.baseBuffer;

        const avgDrift = this.getAverageDrift();

        // If we are drifting positively (running slow), increase the buffer
        // to give the system more "breathing room" between layers.
        // If we are drifting negatively (running fast - rare), we can decrease it.

        // We target a buffer that is at least 2x the average drift to be safe,
        // but never less than 16ms (one frame) and never more than 5x the base buffer.
        const suggestedBuffer = Math.max(16, avgDrift * 2);
        const cappedBuffer = Math.min(suggestedBuffer, this.baseBuffer * 5);

        return Math.round(cappedBuffer);
    }

    /**
     * Clear the drift history
     */
    public clearHistory(): void {
        this.history = [];
    }

    private getAverageDrift(): number {
        if (this.history.length === 0) return 0;
        const sum = this.history.reduce((a, b) => a + b, 0);
        return sum / this.history.length;
    }
}
