/**
 * Performance timing utilities for debugging
 * Lightweight timing that doesn't slow down execution
 */

import { PerformanceMetrics, PerformanceAlert } from '../../../shared/types';

interface TimingEntry {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private timings: Map<string, TimingEntry> = new Map();
  private enabled: boolean = false;

  // Metrics History
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly HISTORY_SIZE = 60; // 1 second at 60fps

  // FPS Tracking
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private lastFpsUpdate: number = 0;

  // Alerts
  private alerts: PerformanceAlert[] = [];
  private readonly SLOW_FRAME_THRESHOLD = 32; // > 32ms (roughly < 30fps)

  enable() {
    this.enabled = true;
    this.timings.clear();
  }

  disable() {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  start(label: string) {
    if (!this.enabled) return;
    this.timings.set(label, {
      label,
      startTime: performance.now()
    });
  }

  end(label: string): number | undefined {
    if (!this.enabled) return undefined;

    const entry = this.timings.get(label);
    if (!entry) return undefined;

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    return entry.duration;
  }

  /**
   * Record a full frame's metrics
   */
  recordFrame(renderTimeMs: number, activeLayers: number) {
    if (!this.enabled) return;

    const now = performance.now();
    this.frameCount++;

    // Calculate FPS every 500ms
    if (now - this.lastFpsUpdate > 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    const frameTimeMs = this.lastFrameTime > 0 ? now - this.lastFrameTime : 16.6;
    this.lastFrameTime = now;

    // Memory info (Chrome only)
    const memInfo = (performance as any).memory;
    const memoryUsedMb = memInfo ? Math.round(memInfo.usedJSHeapSize / (1024 * 1024)) : 0;
    const memoryTotalMb = memInfo ? Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)) : 0;

    const metrics: PerformanceMetrics = {
      fps: this.fps,
      frameTimeMs,
      renderTimeMs,
      memoryUsedMb,
      memoryTotalMb,
      activeLayers,
      timestamp: now
    };

    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.HISTORY_SIZE) {
      this.metricsHistory.shift();
    }

    // Check for alerts
    if (frameTimeMs > this.SLOW_FRAME_THRESHOLD) {
      this.addAlert('slow_frame', 'warning', `Slow frame detected: ${frameTimeMs.toFixed(1)}ms`, { frameTimeMs });
    }
  }

  private addAlert(type: PerformanceAlert['type'], severity: PerformanceAlert['severity'], message: string, metrics: Partial<PerformanceMetrics>) {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      metrics,
      timestamp: performance.now()
    };

    this.alerts.push(alert);
    if (this.alerts.length > 50) this.alerts.shift();

    if (severity === 'critical' || severity === 'warning') {
      console.warn(`[Performance] ${message}`, metrics);
    }
  }

  getMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  getHistory(): PerformanceMetrics[] {
    return this.metricsHistory;
  }

  getAlerts(): PerformanceAlert[] {
    return this.alerts;
  }

  getReport(): string {
    if (!this.enabled) return 'Performance monitoring is disabled';

    const sorted = Array.from(this.timings.values())
      .filter(e => e.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    let report = '\n=== Performance Report ===\n';
    report += `Total entries: ${sorted.length}\n\n`;

    sorted.forEach(entry => {
      report += `${entry.label}: ${entry.duration!.toFixed(2)}ms\n`;
    });

    return report;
  }

  clear() {
    this.timings.clear();
  }

  logSlowest(count: number = 10) {
    if (!this.enabled) return;

    const sorted = Array.from(this.timings.values())
      .filter(e => e.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, count);

    console.log('\n🐌 Slowest operations:');
    sorted.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.label}: ${entry.duration!.toFixed(2)}ms`);
    });
  }
}

export const perfMonitor = new PerformanceMonitor();
