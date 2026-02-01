import { Layer } from '../layer';
import { MorphLayerConfig, WhiteboardConfig } from '../../../shared/types';
import { interpolatePath, Point } from '../../../shared/graphics/path_utils';

/**
 * Frontend Morph Layer
 * Interpolates between two paths (fromPath to toPath) based on animation progress.
 */
export class MorphLayer extends Layer {
    private fromPath: { x: number; y: number }[];
    private toPath: { x: number; y: number }[];
    private strokeColor: string;
    private fillColor: string;
    private strokeWidth: number;
    private pathElement: SVGPathElement | null = null;

    constructor(config: MorphLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.fromPath = config.fromPath || [];
        this.toPath = config.toPath || [];
        this.strokeColor = config.strokeColor || '#000000';
        this.fillColor = config.fillColor || 'transparent';
        this.strokeWidth = config.strokeWidth || 2;
    }

    render(): SVGElement {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        this.pathElement.setAttribute('stroke', this.strokeColor);
        this.pathElement.setAttribute('fill', this.fillColor);
        this.pathElement.setAttribute('stroke-width', this.strokeWidth.toString());
        this.pathElement.setAttribute('stroke-linecap', 'round');
        this.pathElement.setAttribute('stroke-linejoin', 'round');

        group.appendChild(this.pathElement);
        this.element = group;

        this.applyTransform();
        this.updatePath(0);

        return group;
    }

    /**
     * Update the SVG path based on progress.
     */
    private updatePath(progress: number): void {
        if (!this.pathElement || this.fromPath.length === 0 || this.toPath.length === 0) return;

        const currentPath = this.interpolatePaths(this.fromPath, this.toPath, progress);

        if (currentPath.length === 0) return;

        let d = `M ${currentPath[0].x} ${currentPath[0].y}`;
        for (let i = 1; i < currentPath.length; i++) {
            d += ` L ${currentPath[i].x} ${currentPath[i].y}`;
        }

        this.pathElement.setAttribute('d', d);
    }

    /**
     * Interpolate between two paths.
     * Normalizes both paths to the same number of points for smooth morphing.
     */
    private interpolatePaths(
        path1: { x: number; y: number }[],
        path2: { x: number; y: number }[],
        progress: number
    ): { x: number; y: number }[] {
        const numPoints = Math.max(path1.length, path2.length, 50);

        const pts1: Point[] = path1.map(p => [p.x, p.y]);
        const pts2: Point[] = path2.map(p => [p.x, p.y]);

        const norm1 = interpolatePath(pts1, numPoints);
        const norm2 = interpolatePath(pts2, numPoints);

        const result: { x: number; y: number }[] = [];

        for (let i = 0; i < numPoints; i++) {
            const p1 = norm1[i];
            const p2 = norm2[i];

            result.push({
                x: p1[0] * (1 - progress) + p2[0] * progress,
                y: p1[1] * (1 - progress) + p2[1] * progress
            });
        }

        return result;
    }

    /**
     * Seek to a specific progress in the animation.
     */
    seek(progress: number): void {
        super.seek(progress);
        this.updatePath(progress);

        // Update hand position during seek
        if (this.handOverlayCanvas && progress > 0 && progress < 1) {
            const currentPath = this.interpolatePaths(this.fromPath, this.toPath, progress);
            const lastPoint = currentPath[currentPath.length - 1];
            const globalPos = this.transformToGlobal(lastPoint);

            this.updateHandDuringSeek(progress, {
                currentPoint: globalPos
            });
        }
    }

    async animate(type: string, config: any, initialProgress: number = 0): Promise<void> {
        // MorphLayer is inherently an animation of its path
        // We can use a simple loop to animate the progress
        const duration = config.duration || 1000;
        const startTime = performance.now() - (initialProgress * duration);

        return new Promise((resolve) => {
            const step = (timestamp: number) => {
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / duration, 1);

                this.updatePath(progress);

                // Update hand position
                if (this.handOverlayManager && progress < 1) {
                    const currentPath = this.interpolatePaths(this.fromPath, this.toPath, progress);
                    const lastPoint = currentPath[currentPath.length - 1];
                    const globalPos = this.transformToGlobal(lastPoint);

                    this.handOverlayManager.updateHandPosition(progress, {
                        currentPoint: globalPos
                    }, this.handOverlayCanvas || undefined);
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    if (this.handOverlayManager && this.handOverlayCanvas) {
                        this.handOverlayManager.hideHand(this.handOverlayCanvas);
                    }
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    protected getLayerType(): string {
        return 'morph';
    }
}
