/**
 * Shared utility functions for generating SVG path data for shapes.
 * Used by both frontend and server to ensure identical rendering.
 */

export const ShapeUtils = {
    /**
     * Generate path data for a 5-pointed star
     */
    getStarPathData(radius: number): string {
        const points = [];
        const innerRadius = radius * 0.4;

        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radius : innerRadius;
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            points.push(`${x},${y}`);
        }

        return `M ${points[0]} L ${points.slice(1).join(' ')} Z`;
    },

    /**
     * Generate path data for a regular polygon
     */
    getPolygonPathData(radius: number, sides: number): string {
        const points = [];

        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            points.push(`${x},${y}`);
        }

        return `M ${points[0]} L ${points.slice(1).join(' ')} Z`;
    },

    /**
     * Generate path data for a rectangle
     */
    getRectPathData(width: number, height: number, cornerRadius: number = 0): string {
        const x = -width / 2;
        const y = -height / 2;

        if (cornerRadius > 0) {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            return `M ${x + r},${y} 
                    L ${x + width - r},${y} 
                    A ${r},${r} 0 0 1 ${x + width},${y + r} 
                    L ${x + width},${y + height - r} 
                    A ${r},${r} 0 0 1 ${x + width - r},${y + height} 
                    L ${x + r},${y + height} 
                    A ${r},${r} 0 0 1 ${x},${y + height - r} 
                    L ${x},${y + r} 
                    A ${r},${r} 0 0 1 ${x + r},${y} Z`;
        }

        return `M ${x},${y} L ${x + width},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
    },

    /**
     * Generate path data for a circle
     * Note: Uses 2 arcs to form a circle, starting from top (12 o'clock) if rotated -90
     */
    getCirclePathData(radius: number): string {
        // Two arcs: top-to-bottom and bottom-to-top
        // Start at (r, 0) relative to center, which becomes top after -90 rotation?
        // Frontend uses: M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}
        // And applies transform="rotate(-90)"

        // We'll generate it centered at 0,0
        return `M ${-radius},0 A ${radius},${radius} 0 1 0 ${radius},0 A ${radius},${radius} 0 1 0 ${-radius},0 Z`;
    },

    /**
     * Generate path data for an ellipse
     */
    getEllipsePathData(rx: number, ry: number): string {
        return `M ${-rx},0 A ${rx},${ry} 0 1 0 ${rx},0 A ${rx},${ry} 0 1 0 ${-rx},0 Z`;
    },

    /**
     * Generate path data for a line
     */
    getLinePathData(x1: number, y1: number, x2: number, y2: number): string {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }
};
