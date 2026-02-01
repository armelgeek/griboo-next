import { PerformanceMetrics, PerformanceAlert, PerformanceReport } from '../../shared/types';

/**
 * ServerPerformanceMonitor
 * 
 * Monitors video export performance, memory usage, and detects leaks.
 */
export class ServerPerformanceMonitor {
    private metricsHistory: PerformanceMetrics[] = [];
    private alerts: PerformanceAlert[] = [];
    private startTime: number = 0;
    private totalFrames: number = 0;

    // Leak Detection
    private heapTrend: number[] = [];
    private readonly LEAK_TOLERANCE = 10 * 1024 * 1024; // 10MB increase threshold

    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Record metrics for a single frame
     */
    recordFrame(renderTimeMs: number, activeLayers: number) {
        const mem = process.memoryUsage();
        const memoryUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
        const memoryTotalMb = Math.round(mem.heapTotal / (1024 * 1024));

        this.totalFrames++;

        const metrics: PerformanceMetrics = {
            fps: 0, // Not applicable for server export directly per frame
            frameTimeMs: 0,
            renderTimeMs,
            memoryUsedMb,
            memoryTotalMb,
            activeLayers,
            timestamp: Date.now()
        };

        this.metricsHistory.push(metrics);
        this.heapTrend.push(mem.heapUsed);

        // Periodically check for leaks (every 100 frames)
        if (this.totalFrames % 100 === 0) {
            this.detectLeaks();
        }

        // Check for slow rendering
        if (renderTimeMs > 200) { // arbitrary threshold for server
            this.addAlert('slow_frame', 'info', `Slow render: ${renderTimeMs.toFixed(0)}ms`, { renderTimeMs });
        }
    }

    private detectLeaks() {
        if (this.heapTrend.length < 100) return;

        // Simple linear regression (slope) check
        const startHeap = this.heapTrend[this.heapTrend.length - 100];
        const endHeap = this.heapTrend[this.heapTrend.length - 1];
        const growth = endHeap - startHeap;

        if (growth > this.LEAK_TOLERANCE) {
            this.addAlert('memory_leak', 'warning', `Potential memory leak: ${Math.round(growth / (1024 * 1024))}MB growth over last 100 frames`, {
                memoryUsedMb: Math.round(endHeap / (1024 * 1024))
            });
        }
    }

    private addAlert(type: PerformanceAlert['type'], severity: PerformanceAlert['severity'], message: string, metrics: Partial<PerformanceMetrics>) {
        const alert: PerformanceAlert = {
            type,
            severity,
            message,
            metrics,
            timestamp: Date.now()
        };
        this.alerts.push(alert);
        console.log(`[ServerPerf] ${severity.toUpperCase()}: ${message}`);
    }

    /**
     * Generate a summary report
     */
    getSummaryReport(): PerformanceReport {
        const frameTimes = this.metricsHistory.map(m => m.renderTimeMs);
        const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);

        const avgRenderTime = frameTimes.length > 0
            ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
            : 0;

        const peakMem = Math.max(...this.metricsHistory.map(m => m.memoryUsedMb));
        const p95 = sortedFrameTimes.length > 0
            ? sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)]
            : 0;

        const totalTimeS = (Date.now() - this.startTime) / 1000;
        const averageFps = totalTimeS > 0 ? this.totalFrames / totalTimeS : 0;

        return {
            averageFps,
            maxFrameTimeMs: sortedFrameTimes.length > 0 ? sortedFrameTimes[sortedFrameTimes.length - 1] : 0,
            p95FrameTimeMs: p95,
            peakMemoryMb: peakMem,
            totalFrames: this.totalFrames,
            alerts: this.alerts
        };
    }
}
