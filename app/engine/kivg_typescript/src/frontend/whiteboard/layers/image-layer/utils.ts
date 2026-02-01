export interface PixelPoint {
    x: number;
    y: number;
}

export class ColorUtils {
    static calculateDeltaE(c1: [number, number, number], c2: [number, number, number]): number {
        const r1 = c1[0], g1 = c1[1], b1 = c1[2];
        const r2 = c2[0], g2 = c2[1], b2 = c2[2];
        const rMean = (r1 + r2) / 2;
        const dR = r1 - r2;
        const dG = g1 - g2;
        const dB = b1 - b2;
        const wR = 2 + rMean / 256;
        const wG = 4;
        const wB = 2 + (255 - rMean) / 256;
        return Math.sqrt(wR * dR * dR + wG * dG * dG + wB * dB * dB) * (100 / 255);
    }

    private static readonly LUMA_R = 0.299;
    private static readonly LUMA_G = 0.587;
    private static readonly LUMA_B = 0.114;

    /**
     * Calculate grayscale value using standard luma coefficients
     * Matches Python: 0.299 * r + 0.587 * g + 0.114 * b
     */
    static calculateGrayscale(color: [number, number, number]): number {
        const r = color[0];
        const g = color[1];
        const b = color[2];
        return ColorUtils.LUMA_R * r + ColorUtils.LUMA_G * g + ColorUtils.LUMA_B * b;
    }
}

export class GeometryUtils {
    static douglasPeucker(points: PixelPoint[], epsilon: number = 1.5): PixelPoint[] {
        if (points.length < 3) return points;

        function getPerpendicularDistance(pt: PixelPoint, lineStart: PixelPoint, lineEnd: PixelPoint): number {
            const dx = lineEnd.x - lineStart.x;
            const dy = lineEnd.y - lineStart.y;
            if (dx === 0 && dy === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
            const t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (dx * dx + dy * dy);
            const projX = lineStart.x + t * dx;
            const projY = lineStart.y + t * dy;
            return Math.hypot(pt.x - projX, pt.y - projY);
        }

        function simplify(pts: PixelPoint[], startIdx: number, endIdx: number): PixelPoint[] {
            if (endIdx - startIdx < 2) return [pts[startIdx]];
            let maxDist = 0, maxIdx = startIdx;
            for (let i = startIdx + 1; i < endIdx; i++) {
                const dist = getPerpendicularDistance(pts[i], pts[startIdx], pts[endIdx]);
                if (dist > maxDist) { maxDist = dist; maxIdx = i; }
            }
            if (maxDist > epsilon) {
                const left = simplify(pts, startIdx, maxIdx);
                const right = simplify(pts, maxIdx, endIdx);
                return left.concat(right);
            } else {
                return [pts[startIdx]];
            }
        }

        const result = simplify(points, 0, points.length - 1);
        result.push(points[points.length - 1]);
        return result;
    }

    static catmullRom(points: PixelPoint[], samples: number = 8): PixelPoint[] {
        if (points.length < 4) return points;
        const result: PixelPoint[] = [];
        result.push(points[0]);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[Math.min(points.length - 1, i + 1)];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            for (let j = 1; j < samples; j++) {
                const t = j / samples;
                const t2 = t * t;
                const t3 = t2 * t;
                const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                result.push({ x, y });
            }
        }
        result.push(points[points.length - 1]);
        return result;
    }
}

export class PixelSorter {
    static sortByDirection(pixels: PixelPoint[], direction: 'diagonal' | 'vertical' | 'horizontal'): PixelPoint[] {
        switch (direction) {
            case 'vertical': return this.sortVertically(pixels);
            case 'horizontal': return this.sortHorizontally(pixels);
            default: return this.sortDiagonally(pixels);
        }
    }

    static sortDiagonally(pixels: PixelPoint[]): PixelPoint[] {
        if (pixels.length === 0) return pixels;

        const diagonalBands = new Map<number, PixelPoint[]>();
        for (const p of pixels) {
            const diagIdx = p.y + p.x;
            if (!diagonalBands.has(diagIdx)) {
                diagonalBands.set(diagIdx, []);
            }
            diagonalBands.get(diagIdx)!.push(p);
        }

        const sortedDiagIndices = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
        const orderedPixels: PixelPoint[] = [];

        for (let i = 0; i < sortedDiagIndices.length; i++) {
            const diagIdx = sortedDiagIndices[i];
            const bandPixels = diagonalBands.get(diagIdx)!;

            if (i % 2 === 0) {
                bandPixels.sort((a, b) => a.y - b.y);
            } else {
                bandPixels.sort((a, b) => b.y - a.y);
            }
            orderedPixels.push(...bandPixels);
        }
        return orderedPixels;
    }

    static sortVertically(pixels: PixelPoint[]): PixelPoint[] {
        if (pixels.length === 0) return pixels;
        return [...pixels].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.y - b.y;
        });
    }

    static sortHorizontally(pixels: PixelPoint[]): PixelPoint[] {
        if (pixels.length === 0) return pixels;
        return [...pixels].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }
}
