/**
 * Layer Timing Configuration Class
 * 
 * Manages timing parameters for layer animations using OOP principles.
 * This class handles:
 * - Transition Time: Duration for transition animations
 * - Pause Time: Duration to pause after animation completes
 * - Max Draw Time: Maximum duration for drawing animations
 */
export class LayerTimingConfig {
  private transitionTime: number;
  private pauseTime: number;
  private maxDrawTime: number;

  /**
   * Creates a new LayerTimingConfig instance
   * @param transitionTime - Duration for transition animations in seconds (default: 0.5)
   * @param pauseTime - Duration to pause after animation in seconds (default: 0.5)
   * @param maxDrawTime - Maximum duration for drawing animations in seconds (default: 3.0)
   */
  constructor(
    transitionTime: number = 0.5,
    pauseTime: number = 0.5,
    maxDrawTime: number = 3.0
  ) {
    this.transitionTime = this.validateTime(transitionTime, 0.1, 10.0, 0.5);
    this.pauseTime = this.validateTime(pauseTime, 0.0, 10.0, 0.5);
    this.maxDrawTime = this.validateTime(maxDrawTime, 0.5, 30.0, 3.0);
  }

  /**
   * Validates and clamps time values to acceptable ranges
   * @param value - The value to validate
   * @param min - Minimum acceptable value
   * @param max - Maximum acceptable value
   * @param defaultValue - Default value if validation fails
   * @returns Validated time value
   */
  private validateTime(value: number, min: number, max: number, defaultValue: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return defaultValue;
    }
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Gets the transition time in seconds
   */
  getTransitionTime(): number {
    return this.transitionTime;
  }

  /**
   * Sets the transition time in seconds
   * @param time - Duration in seconds (will be clamped to 0.1-10.0)
   */
  setTransitionTime(time: number): void {
    this.transitionTime = this.validateTime(time, 0.1, 10.0, 0.5);
  }

  /**
   * Gets the pause time in seconds
   */
  getPauseTime(): number {
    return this.pauseTime;
  }

  /**
   * Sets the pause time in seconds
   * @param time - Duration in seconds (will be clamped to 0.0-10.0)
   */
  setPauseTime(time: number): void {
    this.pauseTime = this.validateTime(time, 0.0, 10.0, 0.5);
  }

  /**
   * Gets the max draw time in seconds
   */
  getMaxDrawTime(): number {
    return this.maxDrawTime;
  }

  /**
   * Sets the max draw time in seconds
   * @param time - Duration in seconds (will be clamped to 0.5-30.0)
   */
  setMaxDrawTime(time: number): void {
    this.maxDrawTime = this.validateTime(time, 0.5, 30.0, 3.0);
  }

  /**
   * Converts the timing config to a plain object for serialization
   */
  toJSON(): LayerTimingConfigData {
    return {
      transitionTime: this.transitionTime,
      pauseTime: this.pauseTime,
      maxDrawTime: this.maxDrawTime
    };
  }

  /**
   * Creates a LayerTimingConfig from a plain object
   * @param data - Plain object with timing data
   */
  static fromJSON(data?: Partial<LayerTimingConfigData>): LayerTimingConfig {
    if (!data) {
      return new LayerTimingConfig();
    }
    return new LayerTimingConfig(
      data.transitionTime,
      data.pauseTime,
      data.maxDrawTime
    );
  }

  /**
   * Creates a copy of this timing config
   */
  clone(): LayerTimingConfig {
    return new LayerTimingConfig(
      this.transitionTime,
      this.pauseTime,
      this.maxDrawTime
    );
  }

  /**
   * Checks if this config equals another
   */
  equals(other: LayerTimingConfig): boolean {
    return (
      this.transitionTime === other.transitionTime &&
      this.pauseTime === other.pauseTime &&
      this.maxDrawTime === other.maxDrawTime
    );
  }
}

/**
 * Plain object representation of LayerTimingConfig for serialization
 */
export interface LayerTimingConfigData {
  transitionTime: number;
  pauseTime: number;
  maxDrawTime: number;
}
