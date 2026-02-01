import { isDebugEnabled } from '../../../../shared/config/debug_config';

export class AdaptiveQualityManager {
    private targetFPS: number = 60;
    private minFPS: number = 45; // Threshold below which we reduce quality
    private samplingRate: number = 1.0; // 1.0 = 100% of pixels
    private pixelRadius: number = 1; // Radius for pixel drawing
    private adjustmentHistory: number[] = [];
    private readonly HISTORY_SIZE = 10;

    private readonly MIN_SAMPLING_RATE = 0.3; // Never go below 30% sampling
    private readonly MAX_SAMPLING_RATE = 1.0; // 100% maximum
    private readonly MIN_PIXEL_RADIUS = 1;
    private readonly MAX_PIXEL_RADIUS = 3;

    private readonly QUALITY_DECREASE_FACTOR = 0.85; // Reduce by 15%
    private readonly QUALITY_INCREASE_FACTOR = 1.05; // Increase by 5%

    constructor(targetFPS: number = 60) {
        this.targetFPS = targetFPS;
        this.minFPS = targetFPS * 0.75; // 75% of target
    }

    adjustQuality(measuredFPS: number): boolean {
        this.adjustmentHistory.push(measuredFPS);
        if (this.adjustmentHistory.length > this.HISTORY_SIZE) {
            this.adjustmentHistory.shift();
        }

        if (this.adjustmentHistory.length < 5) {
            return false;
        }

        const avgFPS = this.adjustmentHistory.reduce((a, b) => a + b, 0) / this.adjustmentHistory.length;

        let adjusted = false;

        if (avgFPS < this.minFPS) {
            if (this.samplingRate > this.MIN_SAMPLING_RATE) {
                this.samplingRate = Math.max(
                    this.MIN_SAMPLING_RATE,
                    this.samplingRate * this.QUALITY_DECREASE_FACTOR
                );
                adjusted = true;
                if (isDebugEnabled()) {
                    console.log(`[AdaptiveQuality] Reduced sampling rate to ${(this.samplingRate * 100).toFixed(1)}% (FPS: ${avgFPS.toFixed(1)})`);
                }
            } else if (this.pixelRadius < this.MAX_PIXEL_RADIUS) {
                this.pixelRadius = Math.min(
                    this.MAX_PIXEL_RADIUS,
                    this.pixelRadius + 1
                );
                adjusted = true;
                if (isDebugEnabled()) {
                    console.log(`[AdaptiveQuality] Increased pixel radius to ${this.pixelRadius} (FPS: ${avgFPS.toFixed(1)})`);
                }
            }
        } else if (avgFPS > this.targetFPS * 0.95) {
            if (this.pixelRadius > this.MIN_PIXEL_RADIUS && this.samplingRate > 0.9) {
                this.pixelRadius = Math.max(
                    this.MIN_PIXEL_RADIUS,
                    this.pixelRadius - 1
                );
                adjusted = true;
                if (isDebugEnabled()) {
                    console.log(`[AdaptiveQuality] Reduced pixel radius to ${this.pixelRadius} (FPS: ${avgFPS.toFixed(1)})`);
                }
            } else if (this.samplingRate < this.MAX_SAMPLING_RATE) {
                this.samplingRate = Math.min(
                    this.MAX_SAMPLING_RATE,
                    this.samplingRate * this.QUALITY_INCREASE_FACTOR
                );
                adjusted = true;
                if (isDebugEnabled()) {
                    console.log(`[AdaptiveQuality] Increased sampling rate to ${(this.samplingRate * 100).toFixed(1)}% (FPS: ${avgFPS.toFixed(1)})`);
                }
            }
        }

        return adjusted;
    }

    getSamplingRate(): number {
        return this.samplingRate;
    }

    getPixelRadius(): number {
        return this.pixelRadius;
    }

    reset(): void {
        this.samplingRate = this.MAX_SAMPLING_RATE;
        this.pixelRadius = this.MIN_PIXEL_RADIUS;
        this.adjustmentHistory = [];
    }

    getStatus(): { samplingRate: number; pixelRadius: number; avgFPS: number | null } {
        const avgFPS = this.adjustmentHistory.length > 0
            ? this.adjustmentHistory.reduce((a, b) => a + b, 0) / this.adjustmentHistory.length
            : null;

        return {
            samplingRate: this.samplingRate,
            pixelRadius: this.pixelRadius,
            avgFPS
        };
    }
}
