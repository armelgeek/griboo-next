/**
 * Morphing Module for Kivg Core
 * 
 * Provides morphing and blending effects for animations.
 * 
 * Features:
 * - Frame-to-frame morphing transitions
 * - Content-aware position interpolation
 * - Bezier curve evaluation for smooth animations
 * - Path-based morphing effects
 * 
 * Usage:
 *     import { generateMorphFrames, morphBetweenLayers } from './core/morphing';
 *     
 *     const frames = generateMorphFrames(frame1, frame2, 30);
 *     const layerMorph = morphBetweenLayers(layer1, layer2, 30, 'crossfade');
 */

/**
 * Content threshold for detecting non-white pixels.
 */
export const LAYER_WHITE_THRESHOLD = 250;

/**
 * Point coordinate [x, y].
 */
export type Point = [number, number];

/**
 * Bounding box [x_min, y_min, x_max, y_max].
 */
export type BoundingBox = [number, number, number, number];

/**
 * Get bounding box of non-white content in an image.
 */
export function getContentBbox(
    imageData: ImageData,
    threshold: number = LAYER_WHITE_THRESHOLD
): BoundingBox | null {
    const { width, height, data } = imageData;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Check if any channel is below threshold (non-white)
            if (data[idx] < threshold || data[idx + 1] < threshold || data[idx + 2] < threshold) {
                hasContent = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (!hasContent) {
        return null;
    }

    return [minX, minY, maxX, maxY];
}

/**
 * Get center of content in a frame.
 */
export function getContentCenter(
    imageData: ImageData,
    threshold: number = LAYER_WHITE_THRESHOLD
): Point | null {
    const bbox = getContentBbox(imageData, threshold);
    if (!bbox) {
        return null;
    }

    const centerX = (bbox[0] + bbox[2]) / 2;
    const centerY = (bbox[1] + bbox[3]) / 2;
    return [centerX, centerY];
}

/**
 * Evaluate a cubic Bezier curve at parameter t.
 */
export function evaluateBezierCubic(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number
): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0];
    const y = mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1];

    return [x, y];
}

/**
 * Evaluate a quadratic Bezier curve at parameter t.
 */
export function evaluateBezierQuadratic(
    p0: Point,
    p1: Point,
    p2: Point,
    t: number
): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const x = mt2 * p0[0] + 2 * mt * t * p1[0] + t2 * p2[0];
    const y = mt2 * p0[1] + 2 * mt * t * p1[1] + t2 * p2[1];

    return [x, y];
}

/**
 * Simple alpha blending between two frames.
 */
export function simpleBlend(
    frame1: ImageData,
    frame2: ImageData,
    alpha: number
): ImageData {
    const result = new ImageData(frame1.width, frame1.height);
    const beta = 1 - alpha;

    for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = Math.round(frame1.data[i] * beta + frame2.data[i] * alpha);
        result.data[i + 1] = Math.round(frame1.data[i + 1] * beta + frame2.data[i + 1] * alpha);
        result.data[i + 2] = Math.round(frame1.data[i + 2] * beta + frame2.data[i + 2] * alpha);
        result.data[i + 3] = 255;
    }

    return result;
}

/**
 * Generate simple crossfade frames between two frames.
 */
export function generateCrossfadeFrames(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number
): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const alpha = (i + 1) / (numFrames + 1);
        frames.push(simpleBlend(frame1, frame2, alpha));
    }

    return frames;
}

/**
 * Translate content in a frame.
 */
export function translateContent(
    imageData: ImageData,
    offsetX: number,
    offsetY: number,
    backgroundColor: [number, number, number] = [255, 255, 255]
): ImageData {
    const { width, height } = imageData;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    // Fill with background
    ctx.fillStyle = `rgb(${backgroundColor[0]}, ${backgroundColor[1]}, ${backgroundColor[2]})`;
    ctx.fillRect(0, 0, width, height);

    // Draw translated image
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return imageData;

    srcCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(srcCanvas, offsetX, offsetY);

    return ctx.getImageData(0, 0, width, height);
}

/**
 * Scale content in a frame around a center point.
 */
export function scaleContent(
    imageData: ImageData,
    scale: number,
    center?: Point,
    backgroundColor: [number, number, number] = [255, 255, 255]
): ImageData {
    const { width, height } = imageData;
    const cx = center ? center[0] : width / 2;
    const cy = center ? center[1] : height / 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    // Fill with background
    ctx.fillStyle = `rgb(${backgroundColor[0]}, ${backgroundColor[1]}, ${backgroundColor[2]})`;
    ctx.fillRect(0, 0, width, height);

    // Draw scaled image
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return imageData;

    srcCtx.putImageData(imageData, 0, 0);

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.drawImage(srcCanvas, 0, 0);

    return ctx.getImageData(0, 0, width, height);
}

/**
 * Rotate content in a frame around a center point.
 */
export function rotateContent(
    imageData: ImageData,
    angle: number,
    center?: Point,
    scale: number = 1.0,
    backgroundColor: [number, number, number] = [255, 255, 255]
): ImageData {
    const { width, height } = imageData;
    const cx = center ? center[0] : width / 2;
    const cy = center ? center[1] : height / 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    // Fill with background
    ctx.fillStyle = `rgb(${backgroundColor[0]}, ${backgroundColor[1]}, ${backgroundColor[2]})`;
    ctx.fillRect(0, 0, width, height);

    // Draw rotated image
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return imageData;

    srcCtx.putImageData(imageData, 0, 0);

    ctx.translate(cx, cy);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.drawImage(srcCanvas, 0, 0);

    return ctx.getImageData(0, 0, width, height);
}

/**
 * Interpolate between two sets of points.
 */
export function interpolatePoints(
    points1: Point[],
    points2: Point[],
    progress: number
): Point[] {
    const minLen = Math.min(points1.length, points2.length);
    const result: Point[] = [];

    for (let i = 0; i < minLen; i++) {
        const x = points1[i][0] * (1 - progress) + points2[i][0] * progress;
        const y = points1[i][1] * (1 - progress) + points2[i][1] * progress;
        result.push([x, y]);
    }

    return result;
}

/**
 * Generate morph transition frames between two frames.
 */
export function generateMorphFrames(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number
): ImageData[] {
    if (numFrames <= 0) {
        return [];
    }

    const morphFrames: ImageData[] = [];

    // Detect content regions
    const bbox1 = getContentBbox(frame1);
    const bbox2 = getContentBbox(frame2);

    // If no content in either frame, just do simple blending
    if (!bbox1 || !bbox2) {
        return generateCrossfadeFrames(frame1, frame2, numFrames);
    }

    // Calculate centers of content regions
    const center1X = (bbox1[0] + bbox1[2]) / 2;
    const center1Y = (bbox1[1] + bbox1[3]) / 2;
    const center2X = (bbox2[0] + bbox2[2]) / 2;
    const center2Y = (bbox2[1] + bbox2[3]) / 2;

    // Check if there's significant position difference
    const positionDiff = Math.sqrt(
        Math.pow(center2X - center1X, 2) + Math.pow(center2Y - center1Y, 2)
    );

    // If positions are very similar, use simple blending
    if (positionDiff < 10) {
        return generateCrossfadeFrames(frame1, frame2, numFrames);
    }

    // Position-aware morphing
    for (let i = 0; i < numFrames; i++) {
        const alpha = (i + 1) / (numFrames + 1);

        // Interpolate center position
        const interpCenterX = center1X * (1 - alpha) + center2X * alpha;
        const interpCenterY = center1Y * (1 - alpha) + center2Y * alpha;

        // Calculate translation needed for each frame
        const offset1X = interpCenterX - center1X;
        const offset1Y = interpCenterY - center1Y;
        const offset2X = interpCenterX - center2X;
        const offset2Y = interpCenterY - center2Y;

        // Translate frames
        const frame1Translated = translateContent(frame1, Math.round(offset1X), Math.round(offset1Y));
        const frame2Translated = translateContent(frame2, Math.round(offset2X), Math.round(offset2Y));

        // Blend the translated frames
        morphFrames.push(simpleBlend(frame1Translated, frame2Translated, alpha));
    }

    return morphFrames;
}

/**
 * Generate morph frames with scaling effect.
 */
export function generateScaleMorphFrames(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number,
    scaleStart: number = 1.0,
    scaleMid: number = 0.5,
    scaleEnd: number = 1.0
): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const progress = (i + 1) / (numFrames + 1);

        if (progress < 0.5) {
            // First half: scale down frame1
            const localProgress = progress * 2;
            const currentScale = scaleStart + (scaleMid - scaleStart) * localProgress;
            const alpha = localProgress;

            const scaled1 = scaleContent(frame1, currentScale);
            const scaled2 = scaleContent(frame2, scaleMid);
            frames.push(simpleBlend(scaled1, scaled2, alpha * 0.5));
        } else {
            // Second half: scale up frame2
            const localProgress = (progress - 0.5) * 2;
            const currentScale = scaleMid + (scaleEnd - scaleMid) * localProgress;
            const alpha = 0.5 + localProgress * 0.5;

            const scaled1 = scaleContent(frame1, scaleMid);
            const scaled2 = scaleContent(frame2, currentScale);
            frames.push(simpleBlend(scaled1, scaled2, alpha));
        }
    }

    return frames;
}

/**
 * Morph type for layer morphing.
 */
export type MorphType = 'blend' | 'crossfade' | 'dissolve';

/**
 * Create smooth morphing transition between two layers.
 */
export function morphBetweenLayers(
    layer1: ImageData,
    layer2: ImageData,
    numFrames: number = 30,
    morphType: MorphType = 'blend'
): ImageData[] {
    // Ensure both layers have the same size
    let resizedLayer2 = layer2;
    if (layer1.width !== layer2.width || layer1.height !== layer2.height) {
        resizedLayer2 = resizeImageData(layer2, layer1.width, layer1.height);
    }

    switch (morphType) {
        case 'blend':
            return morphBlend(layer1, resizedLayer2, numFrames);
        case 'crossfade':
            return morphCrossfadeEased(layer1, resizedLayer2, numFrames);
        case 'dissolve':
            return morphDissolve(layer1, resizedLayer2, numFrames);
        default:
            return morphBlend(layer1, resizedLayer2, numFrames);
    }
}

/**
 * Resize ImageData to new dimensions.
 */
function resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    ctx.putImageData(imageData, 0, 0);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;
    const resizedCtx = resizedCanvas.getContext('2d');
    if (!resizedCtx) return imageData;

    resizedCtx.drawImage(canvas, 0, 0, width, height);
    return resizedCtx.getImageData(0, 0, width, height);
}

/**
 * Morphing by linear blending.
 */
function morphBlend(layer1: ImageData, layer2: ImageData, numFrames: number): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const alpha = numFrames > 1 ? i / (numFrames - 1) : 1.0;
        frames.push(simpleBlend(layer1, layer2, alpha));
    }

    return frames;
}

/**
 * Morphing with ease-in-out curve.
 */
function morphCrossfadeEased(layer1: ImageData, layer2: ImageData, numFrames: number): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const t = numFrames > 1 ? i / (numFrames - 1) : 1.0;
        // Ease-in-out function: f(t) = 3t² - 2t³
        const alpha = 3 * t * t - 2 * t * t * t;
        frames.push(simpleBlend(layer1, layer2, alpha));
    }

    return frames;
}

/**
 * Morphing with progressive dissolve effect.
 */
function morphDissolve(
    layer1: ImageData,
    layer2: ImageData,
    numFrames: number,
    seed: number = 42
): ImageData[] {
    const frames: ImageData[] = [];
    const { width, height } = layer1;
    const totalPixels = width * height;

    // Create random order using a seeded shuffle
    const dissolveOrder = createSeededOrder(totalPixels, seed);

    for (let i = 0; i < numFrames; i++) {
        const numPixelsFromLayer2 = Math.floor(
            (numFrames > 1 ? i / (numFrames - 1) : 1.0) * totalPixels
        );

        const result = new ImageData(width, height);
        result.data.set(layer1.data);

        // Set pixels from layer2 according to dissolve order
        for (let j = 0; j < numPixelsFromLayer2; j++) {
            const pixelIdx = dissolveOrder[j];
            const dataIdx = pixelIdx * 4;
            result.data[dataIdx] = layer2.data[dataIdx];
            result.data[dataIdx + 1] = layer2.data[dataIdx + 1];
            result.data[dataIdx + 2] = layer2.data[dataIdx + 2];
            result.data[dataIdx + 3] = layer2.data[dataIdx + 3];
        }

        frames.push(result);
    }

    return frames;
}

/**
 * Create a seeded random order for pixels.
 */
function createSeededOrder(length: number, seed: number): number[] {
    const order = Array.from({ length }, (_, i) => i);

    // Simple seeded random shuffle
    let s = seed;
    const random = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };

    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
}

/**
 * Create morphing sequence for multiple layers.
 */
export function morphLayerSequence(
    layers: ImageData[],
    framesPerTransition: number = 30,
    morphType: MorphType = 'crossfade',
    holdDuration: number = 10
): ImageData[] {
    if (layers.length < 2) {
        return layers;
    }

    const allFrames: ImageData[] = [];

    for (let i = 0; i < layers.length - 1; i++) {
        // Hold current layer
        for (let j = 0; j < holdDuration; j++) {
            const copy = new ImageData(layers[i].width, layers[i].height);
            copy.data.set(layers[i].data);
            allFrames.push(copy);
        }

        // Morph to next layer
        const morphFrames = morphBetweenLayers(
            layers[i],
            layers[i + 1],
            framesPerTransition,
            morphType
        );
        allFrames.push(...morphFrames);
    }

    // Hold the last layer
    for (let j = 0; j < holdDuration; j++) {
        const lastLayer = layers[layers.length - 1];
        const copy = new ImageData(lastLayer.width, lastLayer.height);
        copy.data.set(lastLayer.data);
        allFrames.push(copy);
    }

    return allFrames;
}

/**
 * Alignment method for content-aligned morphing.
 */
export type AlignMethod = 'center' | 'mass_center' | 'none';

/**
 * Morphing with intelligent content alignment.
 */
export function morphWithContentAlignment(
    layer1: ImageData,
    layer2: ImageData,
    numFrames: number = 30,
    alignMethod: AlignMethod = 'center'
): ImageData[] {
    let l1 = layer1;
    let l2 = layer2;

    // Ensure same size
    if (l1.width !== l2.width || l1.height !== l2.height) {
        l2 = resizeImageData(l2, l1.width, l1.height);
    }

    if (alignMethod === 'mass_center') {
        [l1, l2] = alignByMassCenter(l1, l2);
    }

    return morphBetweenLayers(l1, l2, numFrames, 'crossfade');
}

/**
 * Align two layers by their content center of mass.
 */
function alignByMassCenter(
    layer1: ImageData,
    layer2: ImageData
): [ImageData, ImageData] {
    const getMassCenter = (img: ImageData): Point => {
        const { width, height, data } = img;
        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Check if pixel is content (non-white)
                if (data[idx] < LAYER_WHITE_THRESHOLD ||
                    data[idx + 1] < LAYER_WHITE_THRESHOLD ||
                    data[idx + 2] < LAYER_WHITE_THRESHOLD) {
                    sumX += x;
                    sumY += y;
                    count++;
                }
            }
        }

        if (count === 0) {
            return [width / 2, height / 2];
        }

        return [sumX / count, sumY / count];
    };

    const center1 = getMassCenter(layer1);
    const center2 = getMassCenter(layer2);

    const offsetX = center1[0] - center2[0];
    const offsetY = center1[1] - center2[1];

    if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) {
        return [layer1, layer2];
    }

    const layer2Aligned = translateContent(
        layer2,
        Math.round(offsetX),
        Math.round(offsetY)
    );

    return [layer1, layer2Aligned];
}

/**
 * Create a morph where layer1 moves along a path while transforming.
 */
export function createMorphWithPath(
    layer1: ImageData,
    layer2: ImageData,
    numFrames: number = 30,
    pathPoints?: Point[]
): ImageData[] {
    if (!pathPoints || pathPoints.length < 2) {
        return morphBetweenLayers(layer1, layer2, numFrames);
    }

    const frames: ImageData[] = [];
    const { width: canvasW, height: canvasH } = layer1;

    // Interpolate path points
    const pathPositions = interpolatePathForMorph(pathPoints, numFrames);

    for (let i = 0; i < pathPositions.length; i++) {
        const [x, y] = pathPositions[i];
        const alpha = numFrames > 1 ? i / (numFrames - 1) : 1.0;

        // Blend layers
        const morphed = simpleBlend(layer1, layer2, alpha);

        // Create canvas with morphed content at path position
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            frames.push(morphed);
            continue;
        }

        // Fill with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Draw morphed at position
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = morphed.width;
        srcCanvas.height = morphed.height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) {
            frames.push(morphed);
            continue;
        }

        srcCtx.putImageData(morphed, 0, 0);

        const offsetX = x - morphed.width / 2;
        const offsetY = y - morphed.height / 2;
        ctx.drawImage(srcCanvas, offsetX, offsetY);

        frames.push(ctx.getImageData(0, 0, canvasW, canvasH));
    }

    return frames;
}

/**
 * Interpolate a path to get a specific number of points.
 */
function interpolatePathForMorph(
    pathPoints: Point[],
    numPoints: number
): Point[] {
    if (pathPoints.length === 0) return [];
    if (pathPoints.length === 1) {
        return Array(numPoints).fill(pathPoints[0]);
    }

    // Calculate cumulative distances
    const distances = [0];
    for (let i = 1; i < pathPoints.length; i++) {
        const dx = pathPoints[i][0] - pathPoints[i - 1][0];
        const dy = pathPoints[i][1] - pathPoints[i - 1][1];
        distances.push(distances[distances.length - 1] + Math.sqrt(dx * dx + dy * dy));
    }

    const totalDistance = distances[distances.length - 1];
    if (totalDistance === 0) {
        return Array(numPoints).fill(pathPoints[0]);
    }

    // Interpolate uniformly
    const interpolated: Point[] = [];
    for (let i = 0; i < numPoints; i++) {
        const targetDist = numPoints > 1
            ? (i / (numPoints - 1)) * totalDistance
            : 0;

        // Find corresponding segment
        for (let j = 0; j < distances.length - 1; j++) {
            if (distances[j] <= targetDist && targetDist <= distances[j + 1]) {
                const segmentDist = distances[j + 1] - distances[j];
                const t = segmentDist > 0
                    ? (targetDist - distances[j]) / segmentDist
                    : 0;

                const x = pathPoints[j][0] * (1 - t) + pathPoints[j + 1][0] * t;
                const y = pathPoints[j][1] * (1 - t) + pathPoints[j + 1][1] * t;
                interpolated.push([Math.round(x), Math.round(y)]);
                break;
            }
        }
    }

    // Fill any remaining points
    while (interpolated.length < numPoints) {
        interpolated.push(pathPoints[pathPoints.length - 1]);
    }

    return interpolated;
}

/**
 * Generate a preview grid showing key morph stages.
 */
export function getMorphPreviewGrid(
    layer1: ImageData,
    layer2: ImageData,
    numPreviews: number = 5
): ImageData {
    const morphFrames = morphBetweenLayers(layer1, layer2, numPreviews);

    // Calculate grid size
    const cols = Math.min(numPreviews, 5);
    const rows = Math.ceil(numPreviews / cols);

    const { width: w, height: h } = layer1;
    const gridWidth = w * cols;
    const gridHeight = h * rows;

    const canvas = document.createElement('canvas');
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return layer1;
    }

    // Fill with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, gridWidth, gridHeight);

    // Place each frame in the grid
    for (let i = 0; i < morphFrames.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = w;
        frameCanvas.height = h;
        const frameCtx = frameCanvas.getContext('2d');
        if (frameCtx) {
            frameCtx.putImageData(morphFrames[i], 0, 0);
            ctx.drawImage(frameCanvas, col * w, row * h);
        }
    }

    return ctx.getImageData(0, 0, gridWidth, gridHeight);
}
