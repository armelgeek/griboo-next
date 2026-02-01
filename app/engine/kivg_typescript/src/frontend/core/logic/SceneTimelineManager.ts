/**
 * SceneTimelineManager - Manages the timeline of layers and buffers
 * 
 * Responsible for calculating the exact start and end times of each layer,
 * inserting buffers to prevent drift, and ensuring the total buffer overhead
 * stays within configured limits.
 */

export interface TimelineEntry {
  /** Index of the layer */
  index: number;
  /** Logical duration (ms) */
  duration: number;
  /** Buffer duration added after this layer (ms) */
  buffer: number;
  /** Expected start time relative to engine start (ms) */
  actualStart: number;
  /** Expected end time (including buffer) relative to engine start (ms) */
  actualEnd: number;
  /** Layer data */
  data?: any;
}

export interface TimelineResult {
  entries: TimelineEntry[];
  /** Total duration of just the layers (ms) */
  logicalDuration: number;
  /** Total duration including buffers (ms) */
  actualDuration: number;
  /** Total buffer time added (ms) */
  bufferOverhead: number;
  /** Buffer overhead as a percentage of logical duration (0-1) */
  bufferOverheadPercent: number;
}

export class SceneTimelineManager {
  private layers: { duration: number; data?: any }[] = [];
  private buffer: number;
  private maxBufferOverhead: number;
  private debug: boolean;

  constructor(config: { buffer: number; maxBufferOverhead: number; debug: boolean }) {
    this.buffer = config.buffer;
    this.maxBufferOverhead = config.maxBufferOverhead;
    this.debug = config.debug;
  }

  /**
   * Add a layer to the timeline
   */
  public addLayer(duration: number, data?: any): void {
    this.layers.push({ duration, data });
  }

  /**
   * Update the default buffer duration
   */
  public setBuffer(buffer: number): void {
    this.buffer = buffer;
  }

  /**
   * Clear all layers
   */
  public clear(): void {
    this.layers = [];
  }

  /**
   * Build the timeline with current settings
   */
  public build(): TimelineResult {
    const entries: TimelineEntry[] = [];
    let currentTime = 0;
    let totalLogicalDuration = 0;
    let totalBuffer = 0;

    // First pass: Calculate logical duration
    for (const layer of this.layers) {
      totalLogicalDuration += layer.duration;
    }

    // Calculate max allowed buffer
    const maxTotalBuffer = totalLogicalDuration * this.maxBufferOverhead;

    // Determine effective buffer per layer to stay within limits
    // We add buffer after every layer except the last one
    const bufferCount = Math.max(0, this.layers.length - 1);
    let effectiveBuffer = this.buffer;

    if (bufferCount > 0) {
      const projectedTotalBuffer = bufferCount * this.buffer;
      if (projectedTotalBuffer > maxTotalBuffer) {
        effectiveBuffer = maxTotalBuffer / bufferCount;
        if (this.debug) {
          console.warn(`[SceneTimelineManager] Buffer reduced from ${this.buffer}ms to ${effectiveBuffer.toFixed(1)}ms to meet overhead limit.`);
        }
      }
    }

    // Second pass: Build entries
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const isLast = i === this.layers.length - 1;
      const currentBuffer = isLast ? 0 : effectiveBuffer;

      const entry: TimelineEntry = {
        index: i,
        duration: layer.duration,
        buffer: currentBuffer,
        actualStart: currentTime,
        actualEnd: currentTime + layer.duration + currentBuffer,
        data: layer.data
      };

      entries.push(entry);

      currentTime += layer.duration + currentBuffer;
      totalBuffer += currentBuffer;
    }

    return {
      entries,
      logicalDuration: totalLogicalDuration,
      actualDuration: currentTime,
      bufferOverhead: totalBuffer,
      bufferOverheadPercent: totalLogicalDuration > 0 ? totalBuffer / totalLogicalDuration : 0
    };
  }
}
