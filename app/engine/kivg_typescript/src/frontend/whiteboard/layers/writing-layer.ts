import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, WhiteboardConfig } from '../types';


// Settle ratio (20%) to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = 0.2;

export interface WritingLayerConfig {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: string;
  /** Animation mode: typewriter (character by character) or reveal (fade in progressively) */
  mode?: 'typewriter' | 'reveal';
}

/**
 * WritingLayer - Displays animated handwriting-style text
 * Extends LoadableLayer for consistent API with other layers
 */
export class WritingLayer extends LoadableLayer {
  private writingConfig: WritingLayerConfig;
  private foreignObject: SVGForeignObjectElement | null = null;
  private textContainer: HTMLDivElement | null = null;
  private fullText: string;

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: { displayedLength: number } | null = null;

  constructor(config: LayerConfig, writingConfig: WritingLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.writingConfig = {
      fontSize: 32,
      fontFamily: 'Arial, sans-serif',
      color: '#000000',
      fontWeight: 'normal',
      mode: 'typewriter',
      ...writingConfig
    };
    this.fullText = this.writingConfig.text;
  }

  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Use foreignObject to embed HTML for better text control
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', '800');
    foreignObject.setAttribute('height', '600');
    // Ensure foreignObject doesn't block hand overlay
    foreignObject.style.pointerEvents = 'none';

    // Create text container
    const div = document.createElement('div');
    div.style.fontFamily = this.writingConfig.fontFamily || 'Arial, sans-serif';
    div.style.fontSize = `${this.writingConfig.fontSize || 32}px`;
    div.style.color = this.writingConfig.color || '#000000';
    div.style.fontWeight = this.writingConfig.fontWeight || 'normal';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    // Ensure text container doesn't interfere with hand overlay
    div.style.pointerEvents = 'none';
    div.textContent = '';

    foreignObject.appendChild(div);
    g.appendChild(foreignObject);

    this.foreignObject = foreignObject;
    this.textContainer = div;
    this.element = g;
    this.applyTransform();

    return g;
  }


  /**
   * Preload resources needed for animation (hand overlay, etc.)
   * Call this before timing-sensitive operations to ensure initialization
   * overhead doesn't affect animation precision measurements.
   */
  async preload(): Promise<void> {
    await this.waitForHandOverlayReady();
  }

  /**
   * Prepare method called by Scene during preload phase.
   * Delegates to preload() and marks layer as prepared.
   */
  async prepare(): Promise<void> {
    if (this.isPrepared) return;
    await this.preload();
    this.isPrepared = true;
  }

  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.element || !this.foreignObject || !this.textContainer) return;

    if (config.warmUp) {
      // Reduced warm-up delay for faster initialization
      await this.wait(0.01);
      return;
    }

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    // For draw and typewriter animations, use the specific implementation in WritingLayer
    if (type === 'draw' || type === 'typewriter') {
      // Normalize duration: config.duration is in MS, while internal methods expect seconds
      const duration = config.duration !== undefined ? config.duration / 1000 : 3.0;
      return new Promise((resolve) => {
        this.animateTypewriter(duration, resolve, initialProgress);
      });
    }

    // For other animation types, ensure text is visible so group-level animation works
    this.textContainer!.textContent = this.fullText;

    // Use the parent class implementation (LayerAnimator)
    return super.animate(type, config, initialProgress);
  }


  private animateTypewriter(duration: number, resolve: () => void, initialProgress: number = 0): void {
    // Ensure the group is visible
    this.setOpacity(1);

    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.1, duration);
    // Calculate settle time based on compensated duration
    const settleTime = compensatedDuration * SETTLE_RATIO;
    // Effective duration for drawing is compensated duration minus settle time
    const drawingDuration = Math.max(0.1, compensatedDuration - settleTime);
    const charDuration = (drawingDuration * 1000) / Math.max(1, this.fullText.length);
    let currentIndex = 0;

    const animationStartTime = performance.now() - (initialProgress * duration * 1000);

    this.foreignObject!.setAttribute('opacity', '1');
    this.textContainer!.textContent = '';

    // Create a temporary container to measure character positions
    // We'll wrap each character in a span to get its exact position
    const measureContainer = document.createElement('div');
    measureContainer.style.cssText = this.textContainer!.style.cssText;
    measureContainer.style.position = 'absolute';
    measureContainer.style.visibility = 'hidden';
    measureContainer.style.width = this.foreignObject!.getAttribute('width') + 'px';
    document.body.appendChild(measureContainer);

    const charSpans: HTMLSpanElement[] = [];
    for (const char of this.fullText) {
      const span = document.createElement('span');
      span.textContent = char;
      measureContainer.appendChild(span);
      charSpans.push(span);
    }

    let startTime: number | null = null;

    const animate = async (currentTime: number) => {
      if (this.isStopped) {
        document.body.removeChild(measureContainer);
        return;
      }
      await this.checkPlaybackState();

      if (startTime === null) {
        startTime = currentTime;
        if (initialProgress > 0) {
          startTime -= (drawingDuration * 1000 * initialProgress);
        }
      }
      const elapsed = currentTime - startTime;
      const targetIndex = Math.floor(elapsed / charDuration);

      while (currentIndex <= targetIndex && currentIndex < this.fullText.length) {
        const char = this.fullText[currentIndex];
        const span = document.createElement('span');
        span.textContent = char;
        this.textContainer!.appendChild(span);

        // Update hand overlay position
        if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
          // Ensure progress reaches 1.0 for the last character
          const progress = currentIndex / (this.fullText.length - 1 || 1);

          // Get precise position from the measurement span
          const measureSpan = charSpans[currentIndex];
          const rect = measureSpan.getBoundingClientRect();
          const containerRect = measureContainer.getBoundingClientRect();

          const currentCharPosition = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top + (rect.height * 0.8) // Position at baseline-ish
          };

          // Transform to global coordinates
          const globalPos = this.transformToGlobal(currentCharPosition);

          this.handOverlayManager.updateHandPosition(progress, {
            currentCharPosition: globalPos
          }, this.handOverlayCanvas || undefined);
        }

        currentIndex++;
      }

      if (currentIndex < this.fullText.length) {
        requestAnimationFrame(animate);
      } else {
        document.body.removeChild(measureContainer);

        // Frame-perfect timing: Calculate precise settle time to hit exact target duration
        const elapsedBeforeSettle = performance.now() - animationStartTime;
        const remainingTime = (duration * 1000) - elapsedBeforeSettle;
        const preciseSettleTime = Math.max(0, remainingTime / 1000);

        // Wait for settle time
        if (!this.isStopped && preciseSettleTime > 0) {
          await this.wait(preciseSettleTime);

          // FORCE EXACT TIMING: Ensure we hit the exact target duration
          // This handles setTimeout firing slightly early
          const targetDurationMs = duration * 1000;
          while (performance.now() - animationStartTime < targetDurationMs) {
            // Busy wait for final micro-adjustments to hit exact target
          }
        }

        // Hide hand after settle time
        if (this.handOverlayManager && this.handOverlayCanvas) {
          this.handOverlayManager.hideHand(this.handOverlayCanvas);
        }

        resolve();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Update text content dynamically
   */
  setText(text: string): void {
    this.fullText = text;
    this.writingConfig.text = text;
    if (this.textContainer) {
      this.textContainer.textContent = text;
    }
  }

  /**
   * Get writing configuration
   */
  getWritingConfig(): WritingLayerConfig {
    return this.writingConfig;
  }

  /**
   * Get layer type for hand overlay strategy selection
   * WritingLayer uses text writing strategy for typewriter effect
   */
  protected getLayerType(): string {
    return 'textwriting';
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * WritingLayer supports typewriter and reveal animations.
   */
  seek(progress: number): void {
    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    const config = this.config.entrance_animation;
    if (!config || !this.textContainer) return;

    // Initialize state tracking if needed
    if (!this.lastSeekState) {
      this.lastSeekState = { displayedLength: -1 };
    }

    // Get seek direction for potential optimizations
    const direction = this.getSeekDirection(progress);
    const isIncremental = this.isIncrementalSeek(progress, 0.05);

    const type = config.type;

    // WritingLayer treats 'draw' as an alias for 'typewriter' animation
    if (type === 'draw' || type === 'typewriter') {
      this.seekTypewriter(progress, direction, isIncremental);
    } else {
      // For non-typewriter animations, the base Layer.seek handles it
      // We just ensure the full text is visible
      if (progress > 0) {
        this.textContainer.textContent = this.fullText;
        if (this.foreignObject) {
          this.foreignObject.setAttribute('opacity', '1');
        }
      }
    }
  }

  /**
   * Seek implementation for typewriter animation
   */
  private seekTypewriter(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    if (!this.textContainer || !this.foreignObject) return;

    // Ensure layer opacity is 1 for typewriter
    this.setOpacity(1);
    this.foreignObject.setAttribute('opacity', '1');

    // Calculate how many characters to display
    const targetLength = Math.floor(progress * this.fullText.length);

    // SMART SEEK: Only update if the displayed length changed
    if (!isIncremental || this.lastSeekState!.displayedLength !== targetLength) {
      const displayText = this.fullText.substring(0, targetLength);
      this.textContainer.textContent = displayText;
      this.lastSeekState!.displayedLength = targetLength;

      // Update hand position if typing is active using SeekHandManager
      if (progress > 0 && progress < 1) {
        // For simplicity, we position the hand at a fixed location relative to the text
        // A more sophisticated implementation would calculate the exact position of the last character
        const rect = this.textContainer.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const x = (this.config.position?.x || 0) + rect.width * 0.8;
          const y = (this.config.position?.y || 0) + rect.height * 0.5;

          // Use the SeekHandManager for consistent hand positioning
          this.updateHandDuringSeek(progress, {
            currentCharPosition: { x, y }
          });
        }
      }
    }

    // Note: We don't hide the hand here during seek, as other layers might be showing their hands
    // The scene clears the hand canvas once at the start of seek
  }
}
