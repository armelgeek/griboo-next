import { OcclusionProxy, Coordinate } from '../types';
import { proxiesIntersect } from '../utils/performance_utils';

/**
 * Shared Occlusion Logic
 * Handles overlap detection and erase path generation for occlusion culling.
 */
export class OcclusionLogic {
    /**
     * Get the intersection rectangle of two proxies.
     * 
     * For occlusion culling: expands only the upper layer (a) to define the erase zone,
     * and uses the actual bounds of the lower layer (b) for intersection check.
     * This ensures the erase zone is constrained to the upper element's footprint.
     * 
     * @param a - First occlusion proxy (typically the upper/occluding layer)
     * @param b - Second occlusion proxy (typically the lower/occluded layer)
     * @param marginRatio - Ratio of object size to use as margin for the upper layer (default: 0.05 = 5%)
     * @returns Intersection rectangle or null if no overlap
     */
    static getIntersectionRect(
        a: OcclusionProxy,
        b: OcclusionProxy,
        marginRatio: number = 0.05
    ): { left: number, top: number, right: number, bottom: number } | null {
        // Calculate margins based on object dimensions
        // Use logical dimensions if available (respects scale), otherwise use physical dimensions
        const aWidth = a.logicalWidth || a.width;
        const aHeight = a.logicalHeight || a.height;

        // Calculate margins only for the upper layer (a) to define the erase zone.
        // The lower layer (b) is NOT expanded - it uses its actual bounds to constrain the erase zone.
        const aMarginX = aWidth * marginRatio;
        const aMarginY = aHeight * marginRatio;

        // Get base edges for each object
        // For rect, x/y are top-left. For circle/ellipse, x/y are center.
        const aBaseLeft = (a.type === 'rect' ? a.x : a.x - a.width / 2);
        const aBaseRight = (a.type === 'rect' ? a.x + a.width : a.x + a.width / 2);
        const aBaseTop = (a.type === 'rect' ? a.y : a.y - a.height / 2);
        const aBaseBottom = (a.type === 'rect' ? a.y + a.height : a.y + a.height / 2);

        const bBaseLeft = (b.type === 'rect' ? b.x : b.x - b.width / 2);
        const bBaseRight = (b.type === 'rect' ? b.x + b.width : b.x + b.width / 2);
        const bBaseTop = (b.type === 'rect' ? b.y : b.y - b.height / 2);
        const bBaseBottom = (b.type === 'rect' ? b.y + b.height : b.y + b.height / 2);

        // Apply margins to expand only the upper layer (a)
        const aLeft = aBaseLeft - aMarginX;
        const aRight = aBaseRight + aMarginX;
        const aTop = aBaseTop - aMarginY;
        const aBottom = aBaseBottom + aMarginY;

        // Calculate intersection: the erase zone is the overlap between
        // the expanded upper layer (a) and the actual lower layer (b)
        const iLeft = Math.max(aLeft, bBaseLeft);
        const iRight = Math.min(aRight, bBaseRight);
        const iTop = Math.max(aTop, bBaseTop);
        const iBottom = Math.min(aBottom, bBaseBottom);

        // Check if there's a valid intersection
        if (iLeft >= iRight || iTop >= iBottom) {
            return null;
        }

        // Add additional padding to ensure smooth eraser coverage at edges
        const edgePadding = 2;
        return {
            left: iLeft - edgePadding,
            top: iTop - edgePadding,
            right: iRight + edgePadding,
            bottom: iBottom + edgePadding
        };
    }

    /**
     * Get the union intersection rectangle of a target proxy with multiple other proxies.
     */
    static getUnionIntersectionRect(
        target: OcclusionProxy,
        others: OcclusionProxy[],
        marginRatio: number = 0.05
    ): { left: number, top: number, right: number, bottom: number } | null {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasOverlap = false;

        for (const other of others) {
            const intersection = this.getIntersectionRect(target, other, marginRatio);
            if (intersection) {
                minX = Math.min(minX, intersection.left);
                minY = Math.min(minY, intersection.top);
                maxX = Math.max(maxX, intersection.right);
                maxY = Math.max(maxY, intersection.bottom);
                hasOverlap = true;
            }
        }

        if (!hasOverlap) return null;

        return { left: minX, top: minY, right: maxX, bottom: maxY };
    }

    /**
     * Ensure the erase zone has a minimum size relative to the eraser radius.
     * Small intersections (e.g., 1-2px) are expanded to be at least 2x the radius
     * to ensure effective visual erasing.
     */
    static ensureMinimumEraseZone(
        rect: { left: number, top: number, right: number, bottom: number },
        radius: number
    ): { left: number, top: number, right: number, bottom: number } {
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;

        // Minimum size should be at least 1x the radius for effective erasing
        const minSize = radius;

        let newRect = { ...rect };

        if (width < minSize) {
            const expansion = (minSize - width) / 2;
            newRect.left -= expansion;
            newRect.right += expansion;
        }

        if (height < minSize) {
            const expansion = (minSize - height) / 2;
            newRect.top -= expansion;
            newRect.bottom += expansion;
        }

        return newRect;
    }

    /**
     * Generate a zigzag path covering a rectangle.
     */
    static generateZigzagPath(
        left: number,
        top: number,
        right: number,
        bottom: number,
        radius: number
    ): Coordinate[] {
        const path: Coordinate[] = [];
        const stepY = radius * 1.2;
        const stepX = radius * 1.5;

        let goingRight = true;
        let y = top;

        while (y <= bottom) {
            const currentY = y;
            if (goingRight) {
                for (let x = left; x <= right; x += stepX) {
                    path.push([x, currentY]);
                }
                // Ensure we reach the right edge
                if (path[path.length - 1][0] < right) {
                    path.push([right, currentY]);
                }
            } else {
                for (let x = right; x >= left; x -= stepX) {
                    path.push([x, currentY]);
                }
                // Ensure we reach the left edge
                if (path[path.length - 1][0] > left) {
                    path.push([left, currentY]);
                }
            }

            if (y === bottom) break;
            y += stepY;
            if (y > bottom) y = bottom; // Ensure last row is exactly at bottom
            goingRight = !goingRight;
        }
        return path;
    }

    /**
     * Draw the geometric shape of a proxy onto a canvas context.
     */
    static drawProxy(ctx: CanvasRenderingContext2D | any, proxy: OcclusionProxy): void {
        ctx.save();

        if (proxy.transform) {
            // This is a simplified transform application for the server
            // In a real scenario, we might need a full SVG transform parser
            // but for now we assume basic translate/rotate/scale if present.
        }

        ctx.beginPath();
        if (proxy.type === 'rect') {
            ctx.rect(proxy.x, proxy.y, proxy.width, proxy.height);
        } else if (proxy.type === 'circle') {
            const radius = proxy.radius || proxy.width / 2;
            ctx.arc(proxy.x, proxy.y, radius, 0, Math.PI * 2);
        } else if (proxy.type === 'ellipse') {
            const rx = proxy.radiusX || proxy.width / 2;
            const ry = proxy.radiusY || proxy.height / 2;
            ctx.ellipse(proxy.x, proxy.y, rx, ry, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        ctx.restore();
    }
}
