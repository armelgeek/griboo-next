import { PerformanceMetrics, PerformanceAlert } from '../../../shared/types';
import { perfMonitor } from './performance-monitor';

/**
 * PerformanceHUD - Visual overlay for real-time metrics
 */
export class PerformanceHUD {
    private container: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private isVisible: boolean = false;
    private lastUpdate: number = 0;

    constructor() {
        this.createUI();
    }

    private createUI() {
        if (typeof document === 'undefined') return;

        this.container = document.createElement('div');
        this.container.id = 'kivg-perf-hud';
        this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 200px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      border-radius: 4px;
      z-index: 9999;
      pointer-events: none;
      display: none;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;

        const title = document.createElement('div');
        title.textContent = 'Kivg Performance';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        title.style.borderBottom = '1px solid #444';
        this.container.appendChild(title);

        const stats = document.createElement('div');
        stats.id = 'kivg-perf-stats';
        this.container.appendChild(stats);

        this.canvas = document.createElement('canvas');
        this.canvas.width = 180;
        this.canvas.height = 40;
        this.canvas.style.marginTop = '5px';
        this.canvas.style.background = '#111';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        document.body.appendChild(this.container);
    }

    show() {
        this.isVisible = true;
        if (this.container) this.container.style.display = 'block';
    }

    hide() {
        this.isVisible = false;
        if (this.container) this.container.style.display = 'none';
    }

    update() {
        if (!this.isVisible || !this.container) return;

        const metrics = perfMonitor.getMetrics();
        if (!metrics) return;

        // Only update text content every 100ms for readability
        const now = performance.now();
        if (now - this.lastUpdate > 100) {
            this.updateStats(metrics);
            this.lastUpdate = now;
        }

        this.drawGraph();
    }

    private updateStats(metrics: PerformanceMetrics) {
        const stats = document.getElementById('kivg-perf-stats');
        if (!stats) return;

        const fpsColor = metrics.fps >= 55 ? '#00ff00' : (metrics.fps >= 30 ? '#ffff00' : '#ff0000');

        stats.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <span>FPS:</span>
        <span style="color: ${fpsColor}">${metrics.fps}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Frame:</span>
        <span>${metrics.frameTimeMs.toFixed(1)}ms</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Render:</span>
        <span>${metrics.renderTimeMs.toFixed(1)}ms</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Layers:</span>
        <span>${metrics.activeLayers}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Memory:</span>
        <span>${metrics.memoryUsedMb}MB</span>
      </div>
    `;

        // Show latest alert if it's recent (last 3 seconds)
        const alerts = perfMonitor.getAlerts();
        if (alerts.length > 0) {
            const lastAlert = alerts[alerts.length - 1];
            if (performance.now() - lastAlert.timestamp < 3000) {
                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = `
          margin-top: 5px;
          padding: 2px;
          background: ${lastAlert.severity === 'critical' ? 'rgba(255,0,0,0.5)' : 'rgba(255,165,0,0.5)'};
          color: #fff;
          font-size: 9px;
        `;
                alertDiv.textContent = `! ${lastAlert.message}`;
                stats.appendChild(alertDiv);
            }
        }
    }

    private drawGraph() {
        if (!this.ctx || !this.canvas) return;

        const history = perfMonitor.getHistory();
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.clearRect(0, 0, width, height);

        // Draw grid
        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();

        if (history.length < 2) return;

        const barWidth = width / history.length;

        // Draw Frame Times (blue)
        this.ctx.fillStyle = '#4488ff';
        history.forEach((m, i) => {
            // 33ms is base scale
            const h = Math.min(height, (m.frameTimeMs / 33) * height);
            this.ctx?.fillRect(i * barWidth, height - h, Math.max(1, barWidth - 1), h);
        });

        // Draw Render Times (yellow) - on top
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        history.forEach((m, i) => {
            const h = Math.min(height, (m.renderTimeMs / 33) * height);
            this.ctx?.fillRect(i * barWidth, height - h, Math.max(1, barWidth - 1), h);
        });
    }
}

export const perfHUD = new PerformanceHUD();
