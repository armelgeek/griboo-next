import { OcclusionProxy, Coordinate } from '../../shared/types';
import { OcclusionLogic } from '../../shared/core/occlusion_logic';

/**
 * Server-side Occlusion Manager
 * Handles overlap detection and erase path generation for occlusion culling.
 * Now uses shared OcclusionLogic for consistency with the frontend.
 */
export class ServerOcclusionManager {
    /**
     * Check if two proxies intersect.
     */
    static proxiesIntersect(a: OcclusionProxy, b: OcclusionProxy, marginRatio: number = 0.1): boolean {
        return OcclusionLogic.getIntersectionRect(a, b, marginRatio) !== null;
    }

    /**
     * Get the intersection rectangle of two proxies.
     */
    static getIntersectionRect(
        a: OcclusionProxy,
        b: OcclusionProxy,
        marginRatio: number = 0.1
    ): { left: number, top: number, right: number, bottom: number } | null {
        return OcclusionLogic.getIntersectionRect(a, b, marginRatio);
    }

    /**
     * Get the union intersection rectangle of a target proxy with multiple other proxies.
     */
    static getUnionIntersectionRect(
        target: OcclusionProxy,
        others: OcclusionProxy[],
        marginRatio: number = 0.1
    ): { left: number, top: number, right: number, bottom: number } | null {
        return OcclusionLogic.getUnionIntersectionRect(target, others, marginRatio);
    }

    /**
     * Ensure the erase zone has a minimum size relative to the eraser radius.
     */
    static ensureMinimumEraseZone(
        rect: { left: number, top: number, right: number, bottom: number },
        radius: number
    ): { left: number, top: number, right: number, bottom: number } {
        return OcclusionLogic.ensureMinimumEraseZone(rect, radius);
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
        return OcclusionLogic.generateZigzagPath(left, top, right, bottom, radius);
    }
}
