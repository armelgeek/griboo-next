/**
 * PreciseAnimationEngine - Orchestrates Layer Playback with Temporal Buffers
 * 
 * Manages the complete animation lifecycle with precise timing control,
 * real-time drift compensation, and performance monitoring.
 * 
 * Features:
 * - Temporal buffer insertion between layers
 * - Real-time timing drift compensation
 * - Adaptive buffer adjustment based on performance
 * - Comprehensive performance reporting
 * - Integration with existing timing systems
 * 
 * @example
 * ```typescript
 * const engine = new PreciseAnimationEngine({ 
 *   buffer: 100, 
 *   tolerance: 50,
 *   adaptive: true
 * });
 * 
 * // Add layers
 * engine.addLayer(1500, async () => { await animateLayer1(); });
 * engine.addLayer(2000, async () => { await animateLayer2(); });
 * engine.addLayer(1000, async () => { await animateLayer3(); });
 * 
 * // Play with monitoring
 * await engine.play();
 * 
 * // Get performance report
 * const report = engine.getPerformanceReport();
 * console.log(`Average drift: ${report.avgDrift}ms`);
 * ```
 */

import { SceneTimelineManager, TimelineResult, TimelineEntry } from './SceneTimelineManager';
import { AdaptiveBuffer } from '../infra/AdaptiveBuffer';
import { ProgressBarManager } from '../infra/ProgressBarManager';
import { perfMonitor } from '../infra/performance-monitor';
import { perfHUD } from '../infra/performance-hud';

export interface LayerAnimationFn {
  (): Promise<void>;
}

export interface TimelineLayer {
  /** Logical duration of the layer (ms) */
  duration: number;
  /** Animation function to execute */
  animate: LayerAnimationFn;
  /** Optional layer data/metadata */
  data?: any;
}

export interface LayerPerformanceReport {
  /** Layer index */
  index: number;
  /** Expected duration (ms) */
  expectedDuration: number;
  /** Actual duration (ms) */
  actualDuration: number;
  /** Timing drift (actual - expected, ms) */
  drift: number;
  /** Drift as percentage of expected duration */
  driftPercent: number;
  /** Expected start time (ms) */
  expectedStart: number;
  /** Actual start time (ms) */
  actualStart: number;
  /** Start time drift (ms) */
  startDrift: number;
  /** Buffer added after this layer (ms) */
  buffer: number;
  /** Layer data/metadata */
  data?: any;
}

export interface EnginePerformanceReport {
  /** Per-layer performance reports */
  layers: LayerPerformanceReport[];
  /** Total expected duration (logical, ms) */
  expectedTotalDuration: number;
  /** Total actual duration (with buffers, ms) */
  actualTotalDuration: number;
  /** Total timing drift (ms) */
  totalDrift: number;
  /** Average drift per layer (ms) */
  avgDrift: number;
  /** Maximum drift across all layers (ms) */
  maxDrift: number;
  /** Minimum drift across all layers (ms) */
  minDrift: number;
  /** Standard deviation of drift (ms) */
  stdDevDrift: number;
  /** Total buffer overhead (ms) */
  totalBufferOverhead: number;
  /** Buffer overhead as percentage */
  bufferOverheadPercent: number;
  /** Whether adaptive buffering was used */
  adaptiveBuffering: boolean;
  /** Overall timing accuracy (percentage of layers within tolerance) */
  timingAccuracy: number;
}

export interface PreciseAnimationEngineConfig {
  /** Default buffer between layers (ms). Default: 100ms */
  buffer?: number;
  /** Timing tolerance for "accurate" classification (ms). Default: 50ms */
  tolerance?: number;
  /** Maximum buffer overhead (0-1). Default: 0.05 (5%) */
  maxBufferOverhead?: number;
  /** Enable adaptive buffering. Default: false */
  adaptive?: boolean;
  /** Enable progress monitoring. Default: false */
  progressMonitoring?: boolean;
  /** Progress callback (called periodically during playback) */
  onProgress?: (progress: number, actualTime: number, logicalTime: number) => void;
  /** Enable debug logging. Default: false */
  debug?: boolean;
}

/**
 * PreciseAnimationEngine
 * 
 * High-level animation orchestrator that manages layer playback with
 * precise timing control and comprehensive performance monitoring.
 */
export class PreciseAnimationEngine {
  private layers: TimelineLayer[] = [];
  private config: Required<Omit<PreciseAnimationEngineConfig, 'onProgress'>> & Pick<PreciseAnimationEngineConfig, 'onProgress'>;
  private timelineManager: SceneTimelineManager;
  private adaptiveBuffer?: AdaptiveBuffer;
  private progressManager?: ProgressBarManager;
  private performanceData: LayerPerformanceReport[] = [];
  private engineStartTime: number = 0;
  private engineEndTime: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private pauseStartTime: number = 0;
  private pausePromise: Promise<void> | null = null;
  private pauseResolver: (() => void) | null = null;
  private tickerId: number | null = null;

  constructor(config: PreciseAnimationEngineConfig = {}) {
    this.config = {
      buffer: config.buffer ?? 100,
      tolerance: config.tolerance ?? 50,
      maxBufferOverhead: config.maxBufferOverhead ?? 0.05,
      adaptive: config.adaptive ?? false,
      progressMonitoring: config.progressMonitoring ?? false,
      onProgress: config.onProgress,
      debug: config.debug ?? false,
    };

    // Initialize timeline manager
    this.timelineManager = new SceneTimelineManager({
      buffer: this.config.buffer,
      maxBufferOverhead: this.config.maxBufferOverhead,
      debug: this.config.debug,
    });

    // Initialize adaptive buffer if enabled
    if (this.config.adaptive) {
      this.adaptiveBuffer = new AdaptiveBuffer({
        baseBuffer: this.config.buffer,
        debug: this.config.debug,
      });
    }

    if (this.config.debug) {
      console.log('[PreciseAnimationEngine] Initialized with config:', {
        buffer: this.config.buffer,
        tolerance: this.config.tolerance,
        adaptive: this.config.adaptive,
        progressMonitoring: this.config.progressMonitoring,
      });
    }
  }

  /**
   * Add a layer to the animation sequence
   * 
   * @param duration - Logical duration of the layer animation (ms)
   * @param animate - Async function that performs the animation
   * @param data - Optional layer data/metadata
   */
  public addLayer(duration: number, animate: LayerAnimationFn, data?: any): void {
    if (duration < 0) {
      throw new Error(`Invalid duration: ${duration}ms. Duration must be >= 0.`);
    }

    if (typeof animate !== 'function') {
      throw new Error('animate parameter must be a function.');
    }

    this.layers.push({
      duration,
      animate,
      data,
    });

    // Update timeline manager
    this.timelineManager.addLayer(duration, data);

    if (this.config.debug) {
      console.log(`[PreciseAnimationEngine] Added layer #${this.layers.length}: ${duration}ms`);
    }
  }

  /**
   * Play all layers in sequence with precise timing
   * 
   * This method:
   * 1. Builds the timeline with optimal buffers
   * 2. Executes each layer animation
   * 3. Inserts buffers between layers
   * 4. Records performance metrics
   * 5. Adapts buffers based on actual performance (if adaptive mode enabled)
   * 
   * @param signal - Optional AbortSignal to cancel playback
   * @returns Promise that resolves when all layers complete
   */
  public async play(signal?: AbortSignal): Promise<void> {
    if (this.isPlaying) {
      throw new Error('Animation is already playing.');
    }

    if (this.layers.length === 0) {
      if (this.config.debug) {
        console.log('[PreciseAnimationEngine] No layers to play.');
      }
      return;
    }

    this.isPlaying = true;
    this.performanceData = [];
    this.engineStartTime = performance.now();

    // Enable performance monitoring
    perfMonitor.enable();
    perfHUD.show();

    // Start high-frequency ticker for smooth progress updates
    this.startTicker();

    try {
      // Build timeline
      const timeline = this.timelineManager.build();

      if (this.config.debug) {
        console.log('[PreciseAnimationEngine] Starting playback:', {
          layers: this.layers.length,
          logicalDuration: `${timeline.logicalDuration}ms`,
          actualDuration: `${timeline.actualDuration}ms`,
          bufferOverhead: `${timeline.bufferOverheadPercent.toFixed(1)}%`,
        });
      }

      // Initialize progress manager if enabled
      if (this.config.progressMonitoring) {
        this.progressManager = new ProgressBarManager(timeline, {
          smoothing: true,
          debug: this.config.debug,
        });
      }

      // Play each layer
      for (let i = 0; i < this.layers.length; i++) {
        // Check for abortion
        if (signal?.aborted) {
          if (this.config.debug) {
            console.log('[PreciseAnimationEngine] Playback aborted');
          }
          this.stopTicker(); // Stop ticker immediately on abort
          break;
        }
        const layer = this.layers[i];
        const entry = timeline.entries[i];

        // Record expected start time
        const expectedStart = entry.actualStart;
        const actualStart = performance.now() - this.engineStartTime;
        const startDrift = actualStart - expectedStart;

        if (this.config.debug) {
          console.log(`[PreciseAnimationEngine] Layer ${i} starting:`, {
            expectedStart: `${expectedStart}ms`,
            actualStart: `${actualStart.toFixed(1)}ms`,
            startDrift: `${startDrift.toFixed(1)}ms`,
          });
        }

        // Execute layer animation
        await this.checkPauseState();
        const layerStartTime = performance.now();
        await layer.animate();
        await this.checkPauseState();

        // Final Micro-Adjustment: Busy-wait to hit exact target duration if we are early.
        // This eliminates negative drift and ensures sub-millisecond precision for the report.
        const expectedLayerEnd = layerStartTime + layer.duration;
        while (performance.now() < expectedLayerEnd) {
          // Check for pause during busy wait
          if (this.isPaused) {
            await this.checkPauseState();
            // After resuming, we must adjust expectedLayerEnd because performance.now() kept moving
            // but the logical time was frozen.
            // However, it's simpler to just break and accept a tiny drift if we pause 
            // during the micro-adjustment phase (which is usually < 16ms).
            break;
          }
          // High-precision busy wait
        }

        const layerEndTime = performance.now();

        const actualDuration = layerEndTime - layerStartTime;
        const drift = actualDuration - layer.duration;
        const driftPercent = (drift / layer.duration) * 100;

        // Record performance
        const report: LayerPerformanceReport = {
          index: i,
          expectedDuration: layer.duration,
          actualDuration,
          drift,
          driftPercent,
          expectedStart,
          actualStart,
          startDrift,
          buffer: entry.buffer,
          data: layer.data,
        };

        this.performanceData.push(report);

        if (this.config.debug) {
          console.log(`[PreciseAnimationEngine] Layer ${i} completed:`, {
            expectedDuration: `${layer.duration}ms`,
            actualDuration: `${actualDuration.toFixed(1)}ms`,
            drift: `${drift.toFixed(1)}ms (${driftPercent.toFixed(1)}%)`,
          });
        }

        // Record drift for adaptive buffer
        if (this.adaptiveBuffer) {
          this.adaptiveBuffer.recordDrift(layer.duration, actualDuration);

          // Update buffer for next iteration if we have enough data
          if (this.adaptiveBuffer.hasEnoughData() && i < this.layers.length - 1) {
            const optimalBuffer = this.adaptiveBuffer.getOptimalBuffer();
            this.timelineManager.setBuffer(optimalBuffer);

            if (this.config.debug) {
              console.log(`[PreciseAnimationEngine] Adaptive buffer updated: ${optimalBuffer}ms`);
            }
          }
        }

        // Insert buffer (wait period) if not the last layer
        if (entry.buffer > 0) {
          // ACTIVE DRIFT COMPENSATION:
          // Calculate how much we are currently drifting from the expected end of this layer.
          // We subtract this drift from the next buffer to ensure the NEXT layer starts on time.
          const currentAbsoluteTime = performance.now() - this.engineStartTime;
          const currentDrift = currentAbsoluteTime - entry.actualEnd;
          const adjustedBuffer = Math.max(0, entry.buffer - currentDrift);

          if (this.config.debug) {
            console.log(`[PreciseAnimationEngine] Inserting compensated buffer: ${adjustedBuffer.toFixed(1)}ms (original: ${entry.buffer}ms, drift: ${currentDrift.toFixed(1)}ms)`);
          }

          if (adjustedBuffer > 0) {
            // Check for abortion before wait
            if (signal?.aborted) break;
            await this.wait(adjustedBuffer);
            // Check for abortion after wait
            if (signal?.aborted) break;
          }
        }

        // Progress callback
        if (this.config.onProgress && this.progressManager) {
          const currentTime = performance.now() - this.engineStartTime;
          const progress = this.progressManager.getSmoothProgress(currentTime);
          const logicalTime = this.progressManager.getLogicalTime(currentTime);
          this.config.onProgress(progress, currentTime, logicalTime);
        }
      }

      this.engineEndTime = performance.now();

      if (this.config.debug) {
        const report = this.getPerformanceReport();
        console.log('[PreciseAnimationEngine] Playback completed:', {
          expectedDuration: `${report.expectedTotalDuration}ms`,
          actualDuration: `${report.actualTotalDuration}ms`,
          totalDrift: `${report.totalDrift.toFixed(1)}ms`,
          avgDrift: `${report.avgDrift.toFixed(1)}ms`,
          timingAccuracy: `${report.timingAccuracy.toFixed(1)}%`,
        });
      }
    } finally {
      this.stopTicker();
      perfHUD.hide();
      this.isPlaying = false;
    }
  }

  /**
   * Start high-frequency ticker for smooth progress updates
   */
  private startTicker(): void {
    this.stopTicker();

    const tick = () => {
      if (!this.isPlaying) return;

      // Skip progress updates while paused to stop the progress bar
      if (this.isPaused) {
        this.tickerId = requestAnimationFrame(tick);
        return;
      }

      if (this.config.onProgress && this.progressManager) {
        const currentTime = performance.now() - this.engineStartTime;
        const progress = this.progressManager.getSmoothProgress(currentTime);
        const logicalTime = this.progressManager.getLogicalTime(currentTime);
        this.config.onProgress(progress, currentTime, logicalTime);
      }

      // Track frame performance and update HUD
      const frameRenderStart = performance.now();
      // (Note: render actually happens triggered by onProgress usually, 
      // but here we just track the ticker frame)
      const renderTime = performance.now() - frameRenderStart;

      perfMonitor.recordFrame(renderTime, 0); // Layer count not easily available here, passing 0
      perfHUD.update();

      this.tickerId = requestAnimationFrame(tick);
    };

    this.tickerId = requestAnimationFrame(tick);
  }

  /**
   * Stop the high-frequency ticker
   */
  private stopTicker(): void {
    if (this.tickerId !== null) {
      cancelAnimationFrame(this.tickerId);
      this.tickerId = null;
    }
  }


  /**
   * Get the complete performance report
   * 
   * @returns Performance report with detailed metrics
   */
  public getPerformanceReport(): EnginePerformanceReport {
    const timeline = this.timelineManager.build();
    const drifts = this.performanceData.map(r => r.drift);

    const avgDrift = drifts.length > 0
      ? drifts.reduce((sum, d) => sum + d, 0) / drifts.length
      : 0;

    const maxDrift = drifts.length > 0 ? Math.max(...drifts) : 0;
    const minDrift = drifts.length > 0 ? Math.min(...drifts) : 0;

    const variance = drifts.length > 0
      ? drifts.reduce((sum, d) => sum + Math.pow(d - avgDrift, 2), 0) / drifts.length
      : 0;
    const stdDevDrift = Math.sqrt(variance);

    const layersWithinTolerance = this.performanceData.filter(
      r => Math.abs(r.drift) <= this.config.tolerance
    ).length;
    const timingAccuracy = this.performanceData.length > 0
      ? (layersWithinTolerance / this.performanceData.length) * 100
      : 0;

    const actualTotalDuration = this.engineEndTime > 0
      ? this.engineEndTime - this.engineStartTime
      : 0;

    const totalDrift = actualTotalDuration - timeline.logicalDuration;

    return {
      layers: [...this.performanceData],
      expectedTotalDuration: timeline.logicalDuration,
      actualTotalDuration,
      totalDrift,
      avgDrift,
      maxDrift,
      minDrift,
      stdDevDrift,
      totalBufferOverhead: timeline.bufferOverhead,
      bufferOverheadPercent: timeline.bufferOverheadPercent,
      adaptiveBuffering: this.config.adaptive,
      timingAccuracy,
    };
  }

  /**
   * Get the current timeline result
   * 
   * @returns Timeline result with all timing information
   */
  public getTimeline(): TimelineResult {
    return this.timelineManager.build();
  }

  /**
   * Get the number of layers
   */
  public getLayerCount(): number {
    return this.layers.length;
  }

  /**
   * Check if the engine is currently playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Clear all layers and reset the engine
   */
  public clear(): void {
    if (this.isPlaying) {
      throw new Error('Cannot clear while animation is playing.');
    }

    this.layers = [];
    this.performanceData = [];
    this.engineStartTime = 0;
    this.engineEndTime = 0;
    this.stopTicker();
    this.timelineManager.clear();

    if (this.adaptiveBuffer) {
      this.adaptiveBuffer.clearHistory();
    }

    if (this.progressManager) {
      this.progressManager.reset();
    }

    if (this.config.debug) {
      console.log('[PreciseAnimationEngine] Engine cleared');
    }
  }

  /**
   * Print a formatted performance report to console
   */
  public printPerformanceReport(): void {
    const report = this.getPerformanceReport();

    console.log('\n========== Performance Report ==========');
    console.log(`Total Layers: ${report.layers.length}`);
    console.log(`Expected Duration: ${report.expectedTotalDuration}ms`);
    console.log(`Actual Duration: ${report.actualTotalDuration.toFixed(1)}ms`);
    console.log(`Total Drift: ${report.totalDrift.toFixed(1)}ms`);
    console.log(`Average Drift: ${report.avgDrift.toFixed(1)}ms`);
    console.log(`Max Drift: ${report.maxDrift.toFixed(1)}ms`);
    console.log(`Min Drift: ${report.minDrift.toFixed(1)}ms`);
    console.log(`Std Dev Drift: ${report.stdDevDrift.toFixed(1)}ms`);
    console.log(`Buffer Overhead: ${report.totalBufferOverhead}ms (${report.bufferOverheadPercent.toFixed(1)}%)`);
    console.log(`Timing Accuracy: ${report.timingAccuracy.toFixed(1)}%`);
    console.log(`Adaptive Buffering: ${report.adaptiveBuffering ? 'Enabled' : 'Disabled'}`);
    console.log('\nPer-Layer Report:');
    report.layers.forEach(layer => {
      const indicator = Math.abs(layer.drift) <= this.config.tolerance ? '✓' :
        Math.abs(layer.drift) <= this.config.tolerance * 2 ? '~' : '!';
      console.log(
        `  Layer ${layer.index}: ` +
        `Expected ${layer.expectedDuration}ms, ` +
        `Actual ${layer.actualDuration.toFixed(1)}ms, ` +
        `Drift ${layer.drift.toFixed(1)}ms ${indicator}`
      );
    });
    console.log('========================================\n');
  }

  /**
   * Pause the animation engine
   */
  public pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pauseStartTime = performance.now();
    this.pausePromise = new Promise((resolve) => {
      this.pauseResolver = resolve;
    });

    if (this.config.debug) {
      console.log('[PreciseAnimationEngine] Paused');
    }
  }

  /**
   * Resume the animation engine
   */
  public resume(): void {
    if (!this.isPaused) return;

    // Adjust engineStartTime to account for the time spent in pause
    const pauseDuration = performance.now() - this.pauseStartTime;
    this.engineStartTime += pauseDuration;

    this.isPaused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
      this.pausePromise = null;
    }

    if (this.config.debug) {
      console.log('[PreciseAnimationEngine] Resumed');
    }
  }

  /**
   * Check and wait if paused
   */
  private async checkPauseState(): Promise<void> {
    if (this.isPaused && this.pausePromise) {
      await this.pausePromise;
    }
  }

  /**
   * Wait for a specified duration (ms)
   * Interruptible by pause
   */
  private async wait(ms: number): Promise<void> {
    const start = performance.now();
    while (performance.now() - start < ms) {
      await this.checkPauseState();
      // Small delay to prevent tight loop during wait
      await new Promise(r => setTimeout(r, 10));
    }
  }
}
