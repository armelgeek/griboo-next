/** * HybridImageAnimator - Hybrid rendering for SVG/Image speed drawing animations * * This module implements a two-layer hybrid rendering approach for maximum * performance while maintaining pixel-perfect fidelity to the source image. * * Architecture: * - Stroke Layer: Vectorized path animation for line/stroke drawing * - Fill Layer: Color coalescing with near-zero tolerance for pixel-perfect fills * - Sequential Rendering: Strokes first, fills revealed only after stroke completion * * Based on the Python implementation in whiteboard_modules/hybrid_renderer.py */

// Type definitions
type Point = [number, number]; // [row, col] or [y, x]
type Coordinate = [number, number]; // [x, y]
type RGB = [number, number, number];
type RGBA = [number, number, number, number];

/**
 * Color region extracted from image for fill animation
 */
interface ColorRegion {
  color: RGB; // BGR color
  pixels: Point[]; // List of (row, col) pixel coordinates
  centroid: Point; // (row, col) centroid
  size: number; // Number of pixels
}

/**
 * Stroke path extracted from image edges
 */
interface StrokePath {
  points: Coordinate[]; // List of (x, y) points
}

/**
 * Configuration for hybrid animation
 */
export interface HybridAnimatorConfig {
  width: number;
  height: number;
  background?: RGBA;
  strokeDurationRatio?: number; // Ratio of animation for stroke phase (0.0-1.0)
  colorTolerance?: number; // Color tolerance for region coalescing
  minRegionSize?: number; // Minimum pixel count for color regions
  strokeWidth?: number; // Width of stroke lines
}

/**
 * Frame result from hybrid animation
 */
export interface HybridFrame {
  imageData: ImageData;
  handPosition: Coordinate | null;
  isStrokePhase: boolean;
}

// ============================================================================
// Constants for Hybrid Rendering
// ============================================================================

/** Color tolerance for lossless color coalescing (ΔE value) - higher values group more similar colors */
const DEFAULT_COLOR_TOLERANCE = 10.0;

/** Default width for stroke lines in pixels */
const DEFAULT_STROKE_WIDTH = 3;

/** Default stroke color for the sketch phase (gray for pencil/sketch effect) */
const DEFAULT_STROKE_COLOR: RGB = [128, 128, 128];

/** Minimum pixel count for a valid color region - filters out noise */
const DEFAULT_MIN_REGION_SIZE = 50;

/**
 * Threshold for non-white (content) pixels in grayscale (0-255).
 * Pixels with grayscale value above this are considered background/white.
 */
const NON_WHITE_THRESHOLD = 250;

/**
 * Threshold for filtering "white-like" color regions.
 * Regions with grayscale value above this are considered background and skipped.
 * Slightly lower than NON_WHITE_THRESHOLD to filter near-white noise.
 */
const WHITE_LIKE_THRESHOLD = 240;

/**
 * Minimum number of points for a valid stroke contour.
 * Smaller contours are filtered out as noise fragments.
 */
const MIN_STROKE_CONTOUR_POINTS = 15;

/**
 * Edge detection threshold for Sobel operator.
 * Lower values detect more edges, higher values only detect stronger edges.
 */
const EDGE_DETECTION_THRESHOLD = 50;

/**
 * Calculate perceptual color difference (simplified ΔE)
 */
function calculateDeltaE(color1: RGB, color2: RGB): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  const rMean = (r1 + r2) / 2.0;
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;
  const weightR = 2 + rMean / 256.0;
  const weightG = 4.0;
  const weightB = 2 + (255 - rMean) / 256.0;
  const deltaE = Math.sqrt(weightR * deltaR * deltaR + weightG * deltaG * deltaG + weightB * deltaB * deltaB);
  return deltaE * (100.0 / 255.0);
}

/**
 * Check if two colors match exactly (all RGB components equal)
 */
function colorsMatchExact(color1: RGB, color2: RGB): boolean {
  return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2];
}

/**
 * Calculate color difference based on tolerance.
 * For tolerance === 0, returns 0 for exact match, Infinity otherwise.
 * For tolerance > 0, returns the ΔE perceptual difference.
 */
function getColorDifference(color1: RGB, color2: RGB, tolerance: number): number {
  if (tolerance === 0) {
    return colorsMatchExact(color1, color2) ? 0 : Infinity;
  }
  return calculateDeltaE(color1, color2);
}

/**
 * Check if a color is "white-like" (background)
 */
function isWhiteLike(color: RGB): boolean {
  const [r, g, b] = color;
  const grayValue = 0.299 * r + 0.587 * g + 0.114 * b;
  return grayValue > WHITE_LIKE_THRESHOLD;
}

/**
 * Sort pixels in diagonal order (top-left to bottom-right).
 *
 * This organizes pixels into diagonal bands where diagIdx = row + col,
 * and within each band, pixels are sorted in a zigzag pattern to create
 * smooth diagonal sweep animation matching the Python implementation.
 *
 * @param pixels - Array of [row, col] points
 * @returns Pixels sorted in diagonal sweep order
 */
function sortPixelsDiagonally(pixels: Point[]): Point[] {
  if (pixels.length === 0) return pixels;

  // Group pixels by diagonal index (row + col)
  const diagonalBands = new Map<number, Point[]>();
  for (const [row, col] of pixels) {
    const diagIdx = row + col;
    if (!diagonalBands.has(diagIdx)) {
      diagonalBands.set(diagIdx, []);
    }
    diagonalBands.get(diagIdx)!.push([row, col]);
  }

  // Sort diagonal indices
  const sortedDiagIndices = Array.from(diagonalBands.keys()).sort((a, b) => a - b);

  // Build ordered pixel list with zigzag pattern within each diagonal
  const orderedPixels: Point[] = [];
  for (let i = 0; i < sortedDiagIndices.length; i++) {
    const diagIdx = sortedDiagIndices[i];
    const bandPixels = diagonalBands.get(diagIdx)!;

    // Zigzag: alternate sort direction (by row) for smooth animation
    if (i % 2 === 0) {
      bandPixels.sort((a, b) => a[0] - b[0]); // Sort by row ascending
    } else {
      bandPixels.sort((a, b) => b[0] - a[0]); // Sort by row descending
    }

    orderedPixels.push(...bandPixels);
  }

  return orderedPixels;
}

/**
 * Extract strokes from image using edge detection (Sobel operator)
 */
function extractStrokes(
  imageData: ImageData,
  colorRegionsOrMinContour?: ColorRegion[] | number,
  minContourPoints: number = MIN_STROKE_CONTOUR_POINTS
): StrokePath[] {
  const { width, height, data } = imageData;

  // Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // If color regions were provided, derive boundary edges from region shapes
  let useRegionBoundaries = false;
  let regionBoundaries: Uint8Array | null = null;
  if (Array.isArray(colorRegionsOrMinContour)) {
    useRegionBoundaries = true;
    regionBoundaries = new Uint8Array(width * height);
    
    for (const region of colorRegionsOrMinContour) {
      // Create a quick lookup mask for region pixels
      const mask = new Uint8Array(width * height);
      for (const [ry, rx] of region.pixels) {
        if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
          mask[ry * width + rx] = 1;
        }
      }

      // For each pixel in region, test 4-neighbors for boundary
      for (const [ry, rx] of region.pixels) {
        const idx = ry * width + rx;
        if (ry - 1 < 0 || ry + 1 >= height || rx - 1 < 0 || rx + 1 >= width) {
          regionBoundaries[idx] = 255;
        } else {
          if (
            mask[(ry - 1) * width + rx] === 0 ||
            mask[(ry + 1) * width + rx] === 0 ||
            mask[ry * width + (rx - 1)] === 0 ||
            mask[ry * width + (rx + 1)] === 0
          ) {
            regionBoundaries[idx] = 255;
          }
        }
      }
    }
  }

  // Apply Sobel edge detection
  const edges = new Uint8Array(width * height);
  const sourceEdges = regionBoundaries || edges;

  if (!useRegionBoundaries) {
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)];
            gx += pixel * sobelX[ky + 1][kx + 1];
            gy += pixel * sobelY[ky + 1][kx + 1];
          }
        }
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > EDGE_DETECTION_THRESHOLD ? 255 : 0;
      }
    }
  }

  // Dilate edges slightly for better connectivity
  const dilatedEdges = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          maxVal = Math.max(maxVal, sourceEdges[(y + dy) * width + (x + dx)]);
        }
      }
      dilatedEdges[y * width + x] = maxVal;
    }
  }

  // Extract contours using connected component labeling
  const visited = new Uint8Array(width * height);
  const strokes: StrokePath[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dilatedEdges[y * width + x] > 0 && !visited[y * width + x]) {
        // Trace ordered contour for this connected component
        const contour = traceContour(x, y, dilatedEdges, width, height, visited);
        if (contour.length >= minContourPoints) {
          // Simplify, smooth & interpolate contour for ultra-smooth strokes
          // 1. RDP simplification with conservative threshold to preserve curves
          const simplified = simplifyRDP(contour, 1.0);
          // 2. Chaikin smoothing with 4 iterations for corner cutting
          const smoothed = smoothChaikin(simplified, 4);
          // 3. Catmull-Rom spline interpolation for continuous smooth curves
          const interpolated = interpolateCatmullRom(smoothed, 0.5, 4);
          strokes.push({ points: interpolated });
        }
      }
    }
  }

  // Sort strokes by starting position (top-left to bottom-right)
  strokes.sort((a, b) => {
    if (a.points.length === 0 || b.points.length === 0) return 0;
    const [ax, ay] = a.points[0];
    const [bx, by] = b.points[0];
    return (ay + ax) - (by + bx);
  });

  return strokes;
}

/**
 * Trace ordered contour of connected edge pixels using Moore-neighbor tracing.
 * This creates a consistently ordered closed loop for each connected edge component.
 */
function traceContour(startX: number, startY: number, edges: Uint8Array, width: number, height: number, visited: Uint8Array): Coordinate[] {
  const neighbors: Coordinate[] = [
    [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]
  ];

  const points: Coordinate[] = [];
  let x = startX;
  let y = startY;
  let prevX = startX - 1;
  let prevY = startY;
  const maxIter = width * height * 2;
  let iter = 0;

  // Mark starting point
  visited[y * width + x] = 1;
  points.push([x, y]);

  while (iter++ < maxIter) {
    let found = false;
    const dx = x - prevX;
    const dy = y - prevY;
    let startIdx = 0;

    for (let i = 0; i < neighbors.length; i++) {
      if (neighbors[i][0] === dx && neighbors[i][1] === dy) {
        startIdx = (i + 6) % 8;
        break;
      }
    }

    let nextX = x;
    let nextY = y;
    let bestDist = Infinity;

    // Find nearest unvisited edge pixel (prefer closer neighbors for smoother contours)
    for (let k = 0; k < neighbors.length; k++) {
      const ni = (startIdx + k) % neighbors.length;
      const nx = x + neighbors[ni][0];
      const ny = y + neighbors[ni][1];

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (edges[ny * width + nx] > 0 && !visited[ny * width + nx]) {
        const dist = Math.abs(neighbors[ni][0]) + Math.abs(neighbors[ni][1]);
        if (dist < bestDist) {
          nextX = nx;
          nextY = ny;
          bestDist = dist;
          found = true;
        }
      }
    }

    if (!found) {
      // Try to close the loop by checking if we can reach the start
      for (let k = 0; k < neighbors.length; k++) {
        const ni = (startIdx + k) % neighbors.length;
        const nx = x + neighbors[ni][0];
        const ny = y + neighbors[ni][1];
        if (nx === points[0][0] && ny === points[0][1] && points.length > 10) {
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    if (nextX === points[0][0] && nextY === points[0][1] && points.length > 10) {
      break;
    }

    if (!found) break;

    points.push([nextX, nextY]);
    visited[nextY * width + nextX] = 1;

    prevX = x;
    prevY = y;
    x = nextX;
    y = nextY;
  }

  return points;
}

/**
 * Simplify points with Ramer–Douglas–Peucker algorithm to reduce jitter and points count.
 * Uses a gentler epsilon to preserve curved contours better.
 */
function simplifyRDP(points: Coordinate[], epsilon: number): Coordinate[] {
  if (points.length < 3) return points.slice();

  function perpendicularDistance(pt: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
    const [x, y] = pt;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);

    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(x - projX, y - projY);
  }

  function rdpRecursive(pts: Coordinate[], start: number, end: number, dst: boolean[]) {
    let maxDist = 0;
    let index = 0;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(pts[i], pts[start], pts[end]);
      if (d > maxDist) {
        index = i;
        maxDist = d;
      }
    }

    if (maxDist > epsilon) {
      dst[index] = true;
      rdpRecursive(pts, start, index, dst);
      rdpRecursive(pts, index, end, dst);
    }
  }

  const dst = new Array(points.length).fill(false);
  dst[0] = true;
  dst[points.length - 1] = true;
  rdpRecursive(points, 0, points.length - 1, dst);

  const simplified: Coordinate[] = [];
  for (let i = 0; i < points.length; i++) if (dst[i]) simplified.push(points[i]);
  return simplified;
}

/**
 * Chaikin smoothing for corner cutting to smooth jagged paths
 * Uses floating point for smoother curves, only rounds at final output
 */
function smoothChaikin(points: Coordinate[], iterations: number = 4): Coordinate[] {
  if (points.length < 3) return points.slice();
  
  // Work with floating point precision
  let pts: [number, number][] = points.map(p => [p[0], p[1]]);
  
  for (let iter = 0; iter < iterations; iter++) {
    const res: [number, number][] = [];
    res.push(pts[0]); // keep first
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      // Use floating point for smooth interpolation
      const q: [number, number] = [0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2];
      const r: [number, number] = [0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2];
      res.push(q);
      res.push(r);
    }
    res.push(pts[pts.length - 1]); // keep last
    pts = res;
  }
  
  // Round only at the end for final coordinates
  return pts.map(p => [Math.round(p[0]), Math.round(p[1])] as Coordinate);
}

/**
 * Catmull-Rom spline interpolation for ultra-smooth curves.
 * Generates additional intermediate points between control points for seamless curves.
 * 
 * @param points - Array of control points
 * @param tension - Tension parameter (0.0-1.0, default 0.5 for centripetal)
 * @param numSegments - Number of interpolated points between each pair of control points
 * @returns Array of interpolated points forming a smooth curve
 */
function interpolateCatmullRom(
  points: Coordinate[],
  tension: number = 0.5,
  numSegments: number = 5
): Coordinate[] {
  if (points.length < 2) return points.slice();
  if (points.length === 2) {
    // Simple linear interpolation for just 2 points
    const result: Coordinate[] = [points[0]];
    for (let i = 1; i < numSegments; i++) {
      const t = i / numSegments;
      const x = points[0][0] + t * (points[1][0] - points[0][0]);
      const y = points[0][1] + t * (points[1][1] - points[0][1]);
      result.push([Math.round(x), Math.round(y)]);
    }
    result.push(points[1]);
    return result;
  }
  
  const result: Coordinate[] = [];
  
  // Extend points array with phantom points for closed-loop handling
  const extended: Coordinate[] = [
    points[0], // duplicate first
    ...points,
    points[points.length - 1] // duplicate last
  ];
  
  // Process each segment
  for (let i = 1; i < extended.length - 2; i++) {
    const p0 = extended[i - 1];
    const p1 = extended[i];
    const p2 = extended[i + 1];
    const p3 = extended[i + 2];
    
    // Add the starting control point
    if (result.length === 0) {
      result.push(p1);
    }
    
    // Generate intermediate points using Catmull-Rom formula
    for (let j = 1; j <= numSegments; j++) {
      const t = j / numSegments;
      const t2 = t * t;
      const t3 = t2 * t;
      
      // Catmull-Rom coefficients
      const c0 = -tension * t3 + 2 * tension * t2 - tension * t;
      const c1 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
      const c2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
      const c3 = tension * t3 - tension * t2;
      
      const x = c0 * p0[0] + c1 * p1[0] + c2 * p2[0] + c3 * p3[0];
      const y = c0 * p0[1] + c1 * p1[1] + c2 * p2[1] + c3 * p3[1];
      
      result.push([Math.round(x), Math.round(y)]);
    }
  }
  
  return result;
}

/**
 * Extract color regions from image using flood fill
 */
function extractColorRegions(
  imageData: ImageData,
  tolerance: number = DEFAULT_COLOR_TOLERANCE,
  minRegionSize: number = DEFAULT_MIN_REGION_SIZE
): ColorRegion[] {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const regions: ColorRegion[] = [];

  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      const startIdx = startY * width + startX;
      if (visited[startIdx]) continue;

      // Get pixel color
      const pixelIdx = startIdx * 4;
      const startColor: RGB = [data[pixelIdx], data[pixelIdx + 1], data[pixelIdx + 2]];

      // Skip white/near-white pixels
      const grayValue = 0.299 * startColor[0] + 0.587 * startColor[1] + 0.114 * startColor[2];
      if (grayValue >= NON_WHITE_THRESHOLD) {
        visited[startIdx] = 1;
        continue;
      }

      // Flood fill
      const regionPixels: Point[] = [];
      const stack: Point[] = [[startY, startX]];

      while (stack.length > 0) {
        const [y, x] = stack.pop()!;
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[idx]) continue;

        const pIdx = idx * 4;
        const pixelColor: RGB = [data[pIdx], data[pIdx + 1], data[pIdx + 2]];

        // Check color match using helper function
        const colorDiff = getColorDifference(startColor, pixelColor, tolerance);
        if (colorDiff > tolerance) continue;

        visited[idx] = 1;
        regionPixels.push([y, x]);

        // 4-connectivity neighbors
        stack.push([y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]);
      }

      // Add region if large enough and not white-like
      if (regionPixels.length >= minRegionSize && !isWhiteLike(startColor)) {
        // Sort pixels diagonally within the region
        const sortedPixels = sortPixelsDiagonally(regionPixels);

        // Calculate centroid
        let sumY = 0, sumX = 0;
        for (const [py, px] of sortedPixels) {
          sumY += py;
          sumX += px;
        }
        const centroidY = Math.round(sumY / sortedPixels.length);
        const centroidX = Math.round(sumX / sortedPixels.length);

        regions.push({
          color: startColor,
          pixels: sortedPixels,
          centroid: [centroidY, centroidX],
          size: sortedPixels.length
        });
      }
    }
  }

  // Sort regions by diagonal index for natural drawing order
  regions.sort((a, b) => (a.centroid[0] + a.centroid[1]) - (b.centroid[0] + b.centroid[1]));

  return regions;
}

/**
 * HybridImageAnimator - Main class for hybrid rendering animations
 */
export class HybridImageAnimator {
  private width: number;
  private height: number;
  private background: RGBA;
  private strokeDurationRatio: number;
  private colorTolerance: number;
  private minRegionSize: number;
  private strokeWidth: number;

  // Source data
  private sourceImageData: ImageData | null = null;
  private strokes: StrokePath[] = [];
  private colorRegions: ColorRegion[] = [];
  private totalStrokePoints: number = 0;
  private totalFillPixels: number = 0;

  constructor(config: HybridAnimatorConfig) {
    this.width = config.width;
    this.height = config.height;
    this.background = config.background ?? [255, 255, 255, 255];
    this.strokeDurationRatio = config.strokeDurationRatio ?? 0.7;
    this.colorTolerance = config.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
    this.minRegionSize = config.minRegionSize ?? DEFAULT_MIN_REGION_SIZE;
    this.strokeWidth = config.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  }

  /**
   * Load an image for hybrid rendering
   */
  async loadImage(image: HTMLImageElement | HTMLCanvasElement | ImageData): Promise<boolean> {
    try {
      // Get ImageData from source
      if (image instanceof ImageData) {
        if (image.width !== this.width || image.height !== this.height) {
          this.sourceImageData = this.resizeImageData(image, this.width, this.height);
        } else {
          this.sourceImageData = image;
        }
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        ctx.drawImage(image, 0, 0, this.width, this.height);
        this.sourceImageData = ctx.getImageData(0, 0, this.width, this.height);
      }

      console.log('🔄 Preprocessing image for hybrid rendering...');

      // Extract color regions first
      console.log(`🎨 Extracting color regions (ΔE < ${this.colorTolerance})...`);
      this.colorRegions = extractColorRegions(this.sourceImageData, this.colorTolerance, this.minRegionSize);
      this.totalFillPixels = this.colorRegions.reduce((sum, r) => sum + r.size, 0);
      console.log(`✅ Found ${this.colorRegions.length} color regions with ${this.totalFillPixels} total pixels`);

      // Extract strokes using region boundaries
      console.log('📝 Extracting strokes (vectorization from region boundaries)...');
      this.strokes = extractStrokes(this.sourceImageData, this.colorRegions);
      this.totalStrokePoints = this.strokes.reduce((sum, s) => sum + s.points.length, 0);
      console.log(`✅ Found ${this.strokes.length} strokes with ${this.totalStrokePoints} total points`);

      return true;
    } catch (error) {
      console.error('Failed to load image:', error);
      return false;
    }
  }

  /**
   * Load image from URL
   */
  async loadImageFromUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const result = await this.loadImage(img);
        resolve(result);
      };
      img.onerror = () => {
        console.error('Failed to load image from URL:', url);
        resolve(false);
      };
      img.src = url;
    });
  }

  /**
   * Resize ImageData to target dimensions
   */
  private resizeImageData(source: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(source, 0, 0);

    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = targetWidth;
    resizeCanvas.height = targetHeight;
    const resizeCtx = resizeCanvas.getContext('2d')!;
    resizeCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    return resizeCtx.getImageData(0, 0, targetWidth, targetHeight);
  }

  /**
   * Generate hybrid animation frames
   */
  generateAnimation(fps: number = 30, duration: number = 5.0): HybridFrame[] {
    if (!this.sourceImageData) {
      console.warn('No image loaded. Call loadImage() first.');
      return [];
    }

    const totalFrames = Math.floor(fps * duration);
    const strokeFrames = Math.floor(totalFrames * this.strokeDurationRatio);
    const fillFrames = totalFrames - strokeFrames;

    console.log(`🎬 Rendering hybrid animation:`);
    console.log(`   - Total: ${totalFrames} frames (${duration.toFixed(1)}s)`);
    console.log(`   - Stroke phase: ${strokeFrames} frames`);
    console.log(`   - Fill phase: ${fillFrames} frames`);

    const results: HybridFrame[] = [];
    const revealMask = new Uint8Array(this.width * this.height);

    // Create stroke canvas
    const strokeCanvas = new ImageData(this.width, this.height);
    const [bgR, bgG, bgB, bgA] = this.background;
    for (let i = 0; i < this.width * this.height; i++) {
      const idx = i * 4;
      strokeCanvas.data[idx] = bgR;
      strokeCanvas.data[idx + 1] = bgG;
      strokeCanvas.data[idx + 2] = bgB;
      strokeCanvas.data[idx + 3] = bgA;
    }

    // PHASE 1: Stroke Animation
    console.log('📝 Phase 1: Drawing strokes...');
    let pointsDrawn = 0;
    let strokeIdx = 0;
    let pointInStroke = 0;
    let prevPoint: Coordinate | null = null;
    const strokeColor = DEFAULT_STROKE_COLOR;

    for (let frameIdx = 0; frameIdx < strokeFrames; frameIdx++) {
      const targetPoints = Math.floor((frameIdx + 1) / strokeFrames * this.totalStrokePoints);
      let pointsToDraw = targetPoints - pointsDrawn;

      let currentPos: Coordinate | null = null;
      if (strokeIdx < this.strokes.length && this.strokes[strokeIdx].points.length > 0) {
        const stroke = this.strokes[strokeIdx];
        const pointIdx = Math.min(pointInStroke, stroke.points.length - 1);
        currentPos = stroke.points[pointIdx];
      }

      while (pointsToDraw > 0 && strokeIdx < this.strokes.length) {
        const stroke = this.strokes[strokeIdx];
        if (pointInStroke < stroke.points.length) {
          const [x, y] = stroke.points[pointInStroke];
          currentPos = [x, y];

          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (prevPoint && pointInStroke > 0) {
              this.drawStrokeLine(strokeCanvas, prevPoint, [x, y], this.strokeWidth, strokeColor);
            } else {
              this.drawStrokePoint(strokeCanvas, x, y, this.strokeWidth, strokeColor);
            }
            prevPoint = [x, y];
            this.revealCircle(revealMask, x, y, Math.ceil(this.strokeWidth / 2));
          }

          pointInStroke++;
          pointsDrawn++;
          pointsToDraw--;
        } else {
          strokeIdx++;
          pointInStroke = 0;
          prevPoint = null;
        }
      }

      const frameData = new ImageData(
        new Uint8ClampedArray(strokeCanvas.data),
        this.width,
        this.height
      );
      results.push({
        imageData: frameData,
        handPosition: currentPos,
        isStrokePhase: true
      });

      if (strokeFrames > 0 && (frameIdx + 1) % Math.max(1, Math.floor(strokeFrames / 5)) === 0) {
        console.log(`   Stroke progress: ${Math.round((frameIdx + 1) / strokeFrames * 100)}%`);
      }
    }

    console.log(`   ✅ Stroke phase complete: ${pointsDrawn} points drawn`);

    // PHASE 2: Fill Animation
    console.log('🎨 Phase 2: Filling colors...');
    let regionsProcessed = 0;
    let pixelsFilled = 0;
    let regionIdx = 0;
    let pixelInRegion = 0;

    const fillCanvas = new ImageData(
      new Uint8ClampedArray(strokeCanvas.data),
      this.width,
      this.height
    );

    for (let frameIdx = 0; frameIdx < fillFrames; frameIdx++) {
      const targetPixels = Math.floor((frameIdx + 1) / fillFrames * this.totalFillPixels);
      let pixelsToFill = targetPixels - pixelsFilled;

      let currentPos: Coordinate | null = null;
      if (regionIdx < this.colorRegions.length) {
        const region = this.colorRegions[regionIdx];
        currentPos = [region.centroid[1], region.centroid[0]];
      }

      while (pixelsToFill > 0 && regionIdx < this.colorRegions.length) {
        const region = this.colorRegions[regionIdx];
        if (pixelInRegion < region.pixels.length) {
          const [py, px] = region.pixels[pixelInRegion];
          currentPos = [px, py];

          if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
            const idx = (py * this.width + px) * 4;
            fillCanvas.data[idx] = this.sourceImageData!.data[idx];
            fillCanvas.data[idx + 1] = this.sourceImageData!.data[idx + 1];
            fillCanvas.data[idx + 2] = this.sourceImageData!.data[idx + 2];
            fillCanvas.data[idx + 3] = 255;
            revealMask[py * this.width + px] = 255;
          }

          pixelInRegion++;
          pixelsFilled++;
          pixelsToFill--;
        } else {
          regionIdx++;
          pixelInRegion = 0;
          regionsProcessed++;
        }
      }

      const frameData = new ImageData(
        new Uint8ClampedArray(fillCanvas.data),
        this.width,
        this.height
      );
      results.push({
        imageData: frameData,
        handPosition: currentPos,
        isStrokePhase: false
      });

      if (fillFrames > 0 && (frameIdx + 1) % Math.max(1, Math.floor(fillFrames / 5)) === 0) {
        console.log(`   Fill progress: ${Math.round((frameIdx + 1) / fillFrames * 100)}%`);
      }
    }

    console.log(`   ✅ Fill phase complete: ${regionsProcessed} regions filled`);

    // Final frame
    const finalFrame = new ImageData(
      new Uint8ClampedArray(this.sourceImageData.data),
      this.width,
      this.height
    );
    results.push({
      imageData: finalFrame,
      handPosition: null,
      isStrokePhase: false
    });

    console.log(`   ✅ Hybrid animation complete: ${results.length} total frames`);
    return results;
  }

  /**
   * Reveal a circle area in the mask
   */
  private revealCircle(mask: Uint8Array, x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            mask[ny * this.width + nx] = 255;
          }
        }
      }
    }
  }

  /**
   * Draw a stroke line on the canvas between two points with anti-aliasing.
   * Uses smooth interpolation for high-quality rendering.
   */
  private drawStrokeLine(canvas: ImageData, start: Coordinate, end: Coordinate, thickness: number, color: RGB): void {
    const [x1, y1] = start;
    const [x2, y2] = end;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.5) {
      // Points are very close, just draw a single point
      this.drawStrokePointAntiAliased(canvas, x1, y1, thickness, color);
      return;
    }
    
    // Use sub-pixel stepping for smooth lines
    const steps = Math.max(Math.ceil(dist), 1);
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    for (let i = 0; i <= steps; i++) {
      const px = x1 + i * stepX;
      const py = y1 + i * stepY;
      this.drawStrokePointAntiAliased(canvas, px, py, thickness, color);
    }
  }

  /**
   * Draw a stroke point (filled circle) on the canvas with anti-aliasing
   * for smoother edges.
   */
  private drawStrokePoint(canvas: ImageData, x: number, y: number, thickness: number, color: RGB): void {
    this.drawStrokePointAntiAliased(canvas, x, y, thickness, color);
  }
  
  /**
   * Draw an anti-aliased stroke point using distance-based alpha blending.
   * Creates smooth circular points with soft edges.
   */
  private drawStrokePointAntiAliased(canvas: ImageData, x: number, y: number, thickness: number, color: RGB): void {
    const radius = thickness / 2;
    const outerRadius = radius + 0.5; // Extend slightly for anti-aliasing
    const innerRadius = Math.max(0, radius - 0.5);
    const outerR2 = outerRadius * outerRadius;
    const innerR2 = innerRadius * innerRadius;
    const [r, g, b] = color;
    
    const minX = Math.max(0, Math.floor(x - outerRadius));
    const maxX = Math.min(this.width - 1, Math.ceil(x + outerRadius));
    const minY = Math.max(0, Math.floor(y - outerRadius));
    const maxY = Math.min(this.height - 1, Math.ceil(y + outerRadius));
    
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - x;
        const dy = py - y;
        const d2 = dx * dx + dy * dy;
        
        if (d2 <= outerR2) {
          const idx = (py * this.width + px) * 4;
          
          if (d2 <= innerR2) {
            // Fully inside the circle
            canvas.data[idx] = r;
            canvas.data[idx + 1] = g;
            canvas.data[idx + 2] = b;
            canvas.data[idx + 3] = 255;
          } else {
            // Anti-aliased edge - blend based on distance
            const dist = Math.sqrt(d2);
            // Normalize alpha to 0-1 range based on distance between inner and outer radius
            const radiusDiff = outerRadius - innerRadius;
            const alpha = radiusDiff > 0 
              ? Math.max(0, Math.min(1, (outerRadius - dist) / radiusDiff))
              : 1;
            
            // Alpha blend with existing pixel
            const existingR = canvas.data[idx];
            const existingG = canvas.data[idx + 1];
            const existingB = canvas.data[idx + 2];
            const existingA = canvas.data[idx + 3] / 255;
            
            // Blend colors
            const newA = alpha + existingA * (1 - alpha);
            if (newA > 0) {
              canvas.data[idx] = Math.round((r * alpha + existingR * existingA * (1 - alpha)) / newA);
              canvas.data[idx + 1] = Math.round((g * alpha + existingG * existingA * (1 - alpha)) / newA);
              canvas.data[idx + 2] = Math.round((b * alpha + existingB * existingA * (1 - alpha)) / newA);
              canvas.data[idx + 3] = Math.round(newA * 255);
            }
          }
        }
      }
    }
  }

  /**
   * Get the number of strokes extracted
   */
  getStrokeCount(): number {
    return this.strokes.length;
  }

  /**
   * Get the number of color regions extracted
   */
  getColorRegionCount(): number {
    return this.colorRegions.length;
  }

  /**
   * Reset animator state
   */
  reset(): void {
    this.sourceImageData = null;
    this.strokes = [];
    this.colorRegions = [];
    this.totalStrokePoints = 0;
    this.totalFillPixels = 0;
  }
}

/**
 * Convenience function to render a hybrid animation
 */
export async function renderHybridAnimation(
  imageSource: string | HTMLImageElement | HTMLCanvasElement | ImageData,
  options: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    strokeRatio?: number;
    colorTolerance?: number;
    background?: RGBA;
  } = {}
): Promise<HybridFrame[]> {
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const fps = options.fps ?? 30;
  const duration = options.duration ?? 5.0;

  const animator = new HybridImageAnimator({
    width,
    height,
    strokeDurationRatio: options.strokeRatio ?? 0.7,
    colorTolerance: options.colorTolerance ?? DEFAULT_COLOR_TOLERANCE,
    background: options.background ?? [255, 255, 255, 255]
  });

  let loaded = false;
  if (typeof imageSource === 'string') {
    loaded = await animator.loadImageFromUrl(imageSource);
  } else {
    loaded = await animator.loadImage(imageSource);
  }

  if (!loaded) {
    console.error('Failed to load image for hybrid animation');
    return [];
  }

  return animator.generateAnimation(fps, duration);
}