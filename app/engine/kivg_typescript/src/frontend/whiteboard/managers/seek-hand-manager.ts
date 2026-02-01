/**
 * Seek Hand Manager - Dedicated manager for hand overlay during seek operations
 * 
 * This class manages hand overlay positioning during seek/rewind operations,
 * ensuring the hand follows the animation path correctly whether moving forward
 * or backward. It uses the same strategy pattern as normal animations but is
 * specifically designed for seek-guided hand positioning.
 */

import { HandOverlayManager, HandOverlayStrategy, HandPosition } from './hand-overlay-manager';
import { isDebugEnabled } from '../../../shared/config/debug_config';

/**
 * Seek state tracking for hand positioning
 */
interface SeekState {
  /** Current seek progress (0-1) */
  progress: number;
  /** Last progress value for direction detection */
  lastProgress: number | null;
  /** Seek direction: forward, rewind, or initial */
  direction: 'forward' | 'rewind' | null;
  /** Whether this is an incremental seek (small change) */
  isIncremental: boolean;
  /** Timestamp of last update */
  timestamp: number;
}

/**
 * SeekHandManager - Manages hand overlay during seek operations
 * 
 * This manager wraps the HandOverlayManager and provides seek-specific
 * functionality to ensure the hand follows animations correctly during
 * rewind and forward seek operations.
 */
export class SeekHandManager {
  private handOverlayManager: HandOverlayManager | null = null;
  private handOverlayCanvas: HTMLCanvasElement | null = null;
  private seekState: SeekState | null = null;
  private strategy: HandOverlayStrategy | null = null;
  
  // Configuration
  private readonly INCREMENTAL_THRESHOLD = 0.05; // 5% change is considered incremental

  constructor(
    handOverlayManager: HandOverlayManager | null,
    handOverlayCanvas: HTMLCanvasElement | null
  ) {
    this.handOverlayManager = handOverlayManager;
    this.handOverlayCanvas = handOverlayCanvas;
  }

  /**
   * Set the positioning strategy for the hand
   */
  setStrategy(strategy: HandOverlayStrategy): void {
    this.strategy = strategy;
    if (this.handOverlayManager) {
      this.handOverlayManager.setStrategy(strategy);
    }
  }

  /**
   * Get the current strategy
   */
  getStrategy(): HandOverlayStrategy | null {
    return this.strategy;
  }

  /**
   * Update hand position during seek operation
   * This method should be called instead of handOverlayManager.drawHandAt()
   * 
   * @param progress - Seek progress (0-1)
   * @param layerData - Layer-specific data for positioning
   */
  updateHandPositionDuringSeek(progress: number, layerData: any): void {
    if (!this.handOverlayManager || !this.handOverlayCanvas || !this.strategy) {
      if (isDebugEnabled() && Math.random() < 0.01) {
        console.warn('[SeekHandManager] Cannot update hand: manager, canvas, or strategy not available');
      }
      return;
    }

    // Update seek state
    this.updateSeekState(progress);

    // Check if hand should be visible
    if (!this.strategy.shouldShowHand(progress, layerData)) {
      // Hide hand if strategy says it shouldn't be visible
      this.hideHand();
      return;
    }

    // Use the strategy to get hand position
    // This ensures consistency with normal animation behavior
    this.handOverlayManager.updateHandPosition(
      progress,
      layerData,
      this.handOverlayCanvas
    );

    if (isDebugEnabled() && Math.random() < 0.01) {
      console.log('[SeekHandManager] Updated hand position:', {
        progress,
        direction: this.seekState?.direction,
        isIncremental: this.seekState?.isIncremental
      });
    }
  }

  /**
   * Update internal seek state tracking
   */
  private updateSeekState(progress: number): void {
    const now = performance.now();

    if (!this.seekState) {
      // Initialize seek state
      this.seekState = {
        progress,
        lastProgress: null,
        direction: null,
        isIncremental: false,
        timestamp: now
      };
      return;
    }

    // Detect direction
    let direction: 'forward' | 'rewind' | null = null;
    if (this.seekState.lastProgress !== null) {
      if (progress > this.seekState.lastProgress) {
        direction = 'forward';
      } else if (progress < this.seekState.lastProgress) {
        direction = 'rewind';
      }
    }

    // Detect if incremental
    const progressDelta = this.seekState.lastProgress !== null 
      ? Math.abs(progress - this.seekState.lastProgress)
      : 1.0;
    const isIncremental = progressDelta < this.INCREMENTAL_THRESHOLD;

    // Update state
    this.seekState = {
      progress,
      lastProgress: this.seekState.progress,
      direction,
      isIncremental,
      timestamp: now
    };
  }

  /**
   * Get current seek direction
   */
  getSeekDirection(): 'forward' | 'rewind' | null {
    return this.seekState?.direction || null;
  }

  /**
   * Check if current seek is incremental
   */
  isIncrementalSeek(): boolean {
    return this.seekState?.isIncremental || false;
  }

  /**
   * Hide the hand overlay
   */
  hideHand(): void {
    if (this.handOverlayManager && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
  }

  /**
   * Clear the hand overlay canvas
   */
  clearHandCanvas(): void {
    if (this.handOverlayCanvas) {
      const ctx = this.handOverlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.handOverlayCanvas.width, this.handOverlayCanvas.height);
      }
    }
  }

  /**
   * Reset seek state (useful when starting a new seek operation)
   */
  resetSeekState(): void {
    this.seekState = null;
  }

  /**
   * Check if hand overlay is enabled and ready
   */
  isEnabled(): boolean {
    return this.handOverlayManager?.isEnabled() || false;
  }

  /**
   * Update the hand overlay manager reference
   */
  setHandOverlayManager(manager: HandOverlayManager | null): void {
    this.handOverlayManager = manager;
    if (this.strategy && manager) {
      manager.setStrategy(this.strategy);
    }
  }

  /**
   * Update the hand overlay canvas reference
   */
  setHandOverlayCanvas(canvas: HTMLCanvasElement | null): void {
    this.handOverlayCanvas = canvas;
  }

  /**
   * Get the underlying hand overlay manager
   */
  getHandOverlayManager(): HandOverlayManager | null {
    return this.handOverlayManager;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.seekState = null;
    this.strategy = null;
  }
}

/**
 * Factory function to create a SeekHandManager for a layer
 * @param handOverlayManager - The hand overlay manager instance
 * @param handOverlayCanvas - The canvas element for hand overlay
 * @param layerType - Type of layer (for strategy selection)
 * @param layerData - Optional layer-specific data
 */
export function createSeekHandManager(
  handOverlayManager: HandOverlayManager | null,
  handOverlayCanvas: HTMLCanvasElement | null,
  strategy?: HandOverlayStrategy
): SeekHandManager {
  const seekManager = new SeekHandManager(handOverlayManager, handOverlayCanvas);
  
  if (strategy) {
    seekManager.setStrategy(strategy);
  }
  
  return seekManager;
}
