/**
 * AnimationTimingController - Reusable timing correction for animations
 * 
 * Ensures animations finish exactly on target duration by continuously
 * adjusting playback speed based on real-time progress feedback.
 * 
 * Analogy: GPS navigation that adjusts speed to arrive on time
 * 
 * ## How It Works
 * 
 * Think of animation timing like GPS navigation:
 * 
 * **❌ Bad Approach (Old)**
 * - Drive at 50 km/h without checking time
 * - At 5 minutes from arrival, realize you're late
 * - Accelerate brutally to 150 km/h → dangerous!
 * 
 * **✅ Good Approach (This Controller)**
 * - GPS says "arrival in 30 minutes"
 * - Every minute, check: "am I ahead/behind?"
 * - If behind: accelerate gradually 50 → 60 → 70 km/h
 * - If ahead: decelerate gradually 70 → 60 → 50 km/h
 * - Arrive exactly on time, smoothly
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const controller = new AnimationTimingController({
 *   totalDuration: 5000,  // 5 seconds
 *   totalWork: 10000,     // 10000 pixels to draw
 * });
 * 
 * let workDone = 0;
 * while (!controller.isComplete(workDone)) {
 *   const workToDo = controller.getWorkToDo(workDone);
 *   // ... perform work ...
 *   workDone += workToDo;
 *   await nextFrame();
 * }
 * 
 * const report = controller.getFinalReport(workDone);
 * console.log(`Timing error: ${report.timingErrorPercent.toFixed(1)}%`);
 * ```
 * 
 * @module timing-controller
 */

/**
 * Configuration options for the timing controller
 */
export interface TimingControllerConfig {
  /** Total duration in milliseconds */
  totalDuration: number;

  /** Total amount of work to complete (e.g., pixels, frames, points) */
  totalWork: number;

  /** 
   * Correction aggressiveness (0.1-0.5, default: 0.3)
   * Higher = more aggressive correction, Lower = smoother but slower to correct
   */
  correctionFactor?: number;

  /** Minimum speed multiplier (default: 0.5 = 50% speed) */
  minSpeed?: number;

  /** Maximum speed multiplier (default: 2.0 = 200% speed) */
  maxSpeed?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Initial progress (0-1, default: 0) */
  initialProgress?: number;
}

/**
 * Current timing statistics
 */
export interface TimingStats {
  /** Current progress (0-1) */
  progress: number;

  /** Expected progress at this time (0-1) */
  expectedProgress: number;

  /** Progress error (expectedProgress - actualProgress) */
  progressError: number;

  /** Current speed multiplier being applied */
  speedMultiplier: number;

  /** Elapsed time in milliseconds */
  elapsedMs: number;

  /** Work completed so far */
  workDone: number;

  /** Estimated time to completion in milliseconds */
  estimatedTimeRemaining: number;
}

/**
 * AnimationTimingController
 * 
 * Manages progressive timing correction for animations to ensure they
 * finish exactly on time, even when performance varies.
 * 
 * ## Core Algorithm
 * 
 * 1. **Measure Progress**: Compare actual work done vs expected progress
 * 2. **Calculate Error**: Determine how far behind/ahead we are
 * 3. **Adjust Speed**: Progressively speed up or slow down
 * 4. **Apply Limits**: Keep adjustments within safe bounds
 * 
 * The controller uses a proportional correction approach:
 * ```
 * speedMultiplier = 1 + (progressError * correctionFactor)
 * ```
 * 
 * Where:
 * - `progressError > 0`: Behind schedule → speed up
 * - `progressError < 0`: Ahead of schedule → slow down
 * - `progressError = 0`: On schedule → maintain speed
 */
export class AnimationTimingController {
  private config: Required<TimingControllerConfig>;
  private startTime: number;
  private lastLogTime: number = 0;
  private frameCount: number = 0;
  private pauseStartTime: number | null = null;
  private totalPauseDuration: number = 0;

  constructor(config: TimingControllerConfig) {
    this.config = {
      totalDuration: config.totalDuration,
      totalWork: config.totalWork,
      correctionFactor: config.correctionFactor ?? 0.3,
      minSpeed: config.minSpeed ?? 0.5,
      maxSpeed: config.maxSpeed ?? 2.0,
      debug: config.debug ?? false,
      initialProgress: config.initialProgress ?? 0,
    };

    this.startTime = performance.now();

    // Adjust startTime if we are starting from a specific progress
    if (config.initialProgress && config.initialProgress > 0) {
      this.startTime -= (this.config.totalDuration * config.initialProgress);
    }

    if (this.config.debug) {
      console.log('[TimingController] Initialized:', {
        duration: this.config.totalDuration,
        work: this.config.totalWork,
        correctionFactor: this.config.correctionFactor,
      });
    }
  }

  /**
   * Calculate how much work to do in this iteration
   * 
   * This is the core method that applies progressive timing correction.
   * 
   * @param workDone - Amount of work completed so far
   * @returns Amount of work to do in this iteration
   */
  public getWorkToDo(workDone: number): number {
    const stats = this.getStats(workDone);

    // Calculate raw target based on expected progress
    const expectedWork = stats.expectedProgress * this.config.totalWork;
    const rawTarget = expectedWork - workDone;

    // Apply speed adjustment with correction
    const adjustedTarget = Math.floor(rawTarget * stats.speedMultiplier);

    // Clamp to reasonable bounds
    const workToDo = Math.max(
      1, // Always make at least 1 unit of progress
      Math.min(
        adjustedTarget,
        this.config.totalWork - workDone // Don't overshoot total work
      )
    );

    // Debug logging (throttled to every 30 frames)
    if (this.config.debug && this.frameCount % 30 === 0) {
      console.log('[TimingController]', {
        progress: `${(stats.progress * 100).toFixed(1)}%`,
        error: `${(stats.progressError * 100).toFixed(1)}%`,
        speed: `${stats.speedMultiplier.toFixed(2)}x`,
        workToDo,
        remaining: `${stats.estimatedTimeRemaining.toFixed(0)}ms`,
      });
    }

    this.frameCount++;
    return workToDo;
  }

  /**
   * Pause the timing controller
   */
  public pause(): void {
    if (this.pauseStartTime === null) {
      this.pauseStartTime = performance.now();
    }
  }

  /**
   * Resume the timing controller
   */
  public resume(): void {
    if (this.pauseStartTime !== null) {
      this.totalPauseDuration += (performance.now() - this.pauseStartTime);
      this.pauseStartTime = null;
    }
  }

  /**
   * Get current timing statistics
   * 
   * Provides detailed information about current animation state,
   * progress, and timing corrections being applied.
   * 
   * @param workDone - Amount of work completed so far
   * @returns Current timing statistics
   */
  public getStats(workDone: number): TimingStats {
    const now = performance.now();
    const currentPauseDuration = this.pauseStartTime ? (now - this.pauseStartTime) : 0;
    const elapsedMs = now - this.startTime - this.totalPauseDuration - currentPauseDuration;

    // 1. Where should we be? (GPS: expected destination)
    const expectedProgress = Math.min(
      elapsedMs / this.config.totalDuration,
      1.0
    );

    // 2. Where are we actually? (GPS: current position)
    const actualProgress = workDone / this.config.totalWork;

    // 3. Calculate error (GPS: how late/early?)
    const progressError = expectedProgress - actualProgress;

    // 4. Adjust speed progressively (GPS: accelerate/decelerate)
    // If progressError > 0: we're behind → speed up
    // If progressError < 0: we're ahead → slow down
    const speedMultiplier = Math.max(
      this.config.minSpeed,
      Math.min(
        this.config.maxSpeed,
        1 + (progressError * this.config.correctionFactor)
      )
    );

    // 5. Estimate remaining time
    const workRemaining = this.config.totalWork - workDone;
    const currentRate = workDone / Math.max(elapsedMs, 1); // work per ms
    const adjustedRate = currentRate * speedMultiplier;
    const estimatedTimeRemaining = workRemaining / Math.max(adjustedRate, 0.001);

    return {
      progress: actualProgress,
      expectedProgress,
      progressError,
      speedMultiplier,
      elapsedMs,
      workDone,
      estimatedTimeRemaining,
    };
  }

  /**
   * Check if animation should be complete
   * 
   * Animation is considered complete when:
   * 1. All work is done, OR
   * 2. Time has elapsed (allows early exit if work finishes early)
   * 
   * Special case: If totalWork is 0, only check time elapsed
   * 
   * @param workDone - Amount of work completed so far
   * @returns True if animation is complete
   */
  public isComplete(workDone: number): boolean {
    const now = performance.now();
    const currentPauseDuration = this.pauseStartTime ? (now - this.pauseStartTime) : 0;
    const elapsed = now - this.startTime - this.totalPauseDuration - currentPauseDuration;

    // Special case: If there's no work to do, only check time
    if (this.config.totalWork === 0) {
      return elapsed >= this.config.totalDuration;
    }

    // Complete if either:
    // 1. All work is done
    // 2. Time has elapsed (allows early exit if work finishes early)
    return workDone >= this.config.totalWork || elapsed >= this.config.totalDuration;
  }

  /**
   * Reset the controller for a new animation
   * 
   * Resets all timing state while keeping the same configuration.
   * Useful for reusing a controller instance.
   */
  public reset(): void {
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastLogTime = 0;
    this.pauseStartTime = null;
    this.totalPauseDuration = 0;
  }

  /**
   * Get final timing report
   * 
   * Provides a summary of timing accuracy after animation completes.
   * Use this to validate that timing correction worked as expected.
   * 
   * @param actualWorkDone - Total work actually completed
   * @returns Final timing statistics
   */
  public getFinalReport(actualWorkDone: number): {
    targetDuration: number;
    actualDuration: number;
    timingError: number;
    timingErrorPercent: number;
    workCompleted: number;
    workTarget: number;
  } {
    const actualDuration = performance.now() - this.startTime;
    const timingError = actualDuration - this.config.totalDuration;
    const timingErrorPercent = (timingError / this.config.totalDuration) * 100;

    return {
      targetDuration: this.config.totalDuration,
      actualDuration,
      timingError,
      timingErrorPercent,
      workCompleted: actualWorkDone,
      workTarget: this.config.totalWork,
    };
  }
}
