import { TimelineResult } from '../logic/SceneTimelineManager';


/**
 * ProgressBarManager - Manages progress calculation for UI
 * 
 * Maps the actual playback time (which includes variable buffers) back to a 
 * smooth, logical progress value (0-1) and logical time for display.
 * This ensures the progress bar moves smoothly even when the engine is 
 * waiting in a buffer or compensating for drift.
 */
export class ProgressBarManager {
    private timeline: TimelineResult;
    private smoothing: boolean;
    private debug: boolean;
    private lastProgress: number = 0;

    constructor(timeline: TimelineResult, config: { smoothing: boolean; debug: boolean }) {
        this.timeline = timeline;
        this.smoothing = config.smoothing;
        this.debug = config.debug;
    }

    /**
     * Reset the manager state
     */
    public reset(): void {
        this.lastProgress = 0;
    }

    /**
     * Get the logical time (excluding buffers) corresponding to the current actual time
     */
    public getLogicalTime(currentActualTime: number): number {
        // Find which entry we are currently in or have passed
        let logicalTime = 0;

        for (const entry of this.timeline.entries) {
            if (currentActualTime < entry.actualStart) {
                // We are before this layer (shouldn't happen if iterating in order, unless time went backwards)
                break;
            }

            if (currentActualTime >= entry.actualEnd) {
                // We have fully completed this layer and its buffer
                logicalTime += entry.duration;
            } else {
                // We are inside this layer or its buffer
                const timeInLayer = currentActualTime - entry.actualStart;

                if (timeInLayer <= entry.duration) {
                    // Inside the animation part
                    logicalTime += timeInLayer;
                } else {
                    // Inside the buffer part
                    // We clamp to the end of the animation duration so logical time "pauses" during buffer
                    logicalTime += entry.duration;
                }
                break;
            }
        }

        return Math.min(logicalTime, this.timeline.logicalDuration);
    }

    /**
     * Get the smooth progress (0-1) for the UI
     */
    public getSmoothProgress(currentActualTime: number): number {
        if (this.timeline.logicalDuration === 0) return 0;

        let progress: number;

        if (this.smoothing) {
            // SMOOTH MODE: Map actual time to total actual duration
            // This makes the progress bar move continuously even during buffers,
            // which feels smoother to the user than pausing.
            progress = currentActualTime / this.timeline.actualDuration;
        } else {
            // STRICT MODE: Map logical time to logical duration
            // The progress bar will pause during buffers.
            const logicalTime = this.getLogicalTime(currentActualTime);
            progress = logicalTime / this.timeline.logicalDuration;
        }

        // Clamp and ensure monotonicity (progress bar should never go backwards during playback)
        progress = Math.max(0, Math.min(1, progress));

        if (progress < this.lastProgress && Math.abs(progress - this.lastProgress) < 0.1) {
            // Only prevent small regressions (jitter), allow large jumps (seeking)
            return this.lastProgress;
        }

        this.lastProgress = progress;
        return progress;
    }
}
