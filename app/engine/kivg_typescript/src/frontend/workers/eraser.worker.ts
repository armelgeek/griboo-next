/**
 * Eraser Worker
 * Handles loading and processing of eraser hand images off the main thread.
 */

// Define types for worker messages
export type EraserWorkerInput = {
    type: 'loadEraser';
    eraserPath: string;
    maskPath?: string;
} | {
    type: 'generateFrames';
    sourceBuffer: ArrayBuffer;
    width: number;
    height: number;
    numFrames: number;
    pattern: string;
    backgroundColor: [number, number, number];
    showEraser: boolean;
    radius: number;
    addHandWiggle: boolean;
    wiggleAmplitude: number;
    wiggleFrequency: number;
    eraserData?: {
        imageBuffer: ArrayBuffer;
        maskInvBuffer: ArrayBuffer;
        width: number;
        height: number;
    };
};

export type EraserWorkerOutput = {
    type: 'success';
    data: {
        imageBuffer: ArrayBuffer;
        maskBuffer: ArrayBuffer;
        maskInvBuffer: ArrayBuffer;
        width: number;
        height: number;
    };
} | {
    type: 'error';
    message: string;
};

const MAX_DIMENSION = 800;

self.onmessage = async (e: MessageEvent<EraserWorkerInput>) => {
    const data = e.data;

    if (data.type === 'loadEraser') {
        const { eraserPath, maskPath } = data;
        try {
            const eraserBitmap = await loadImage(eraserPath);

            // Calculate dimensions
            let width = eraserBitmap.width;
            let height = eraserBitmap.height;

            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                const scale = MAX_DIMENSION / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }

            // Create OffscreenCanvas
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

            if (!ctx) throw new Error('Failed to create OffscreenCanvas context');

            // Draw eraser image
            ctx.drawImage(eraserBitmap, 0, 0, width, height);
            const eraserImageData = ctx.getImageData(0, 0, width, height);

            // Process mask
            let maskImageData: ImageData;
            if (maskPath) {
                try {
                    const maskBitmap = await loadImage(maskPath);
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(maskBitmap, 0, 0, width, height);
                    maskImageData = ctx.getImageData(0, 0, width, height);
                } catch (err) {
                    // Fallback to alpha mask
                    maskImageData = createMaskFromAlpha(eraserImageData);
                }
            } else {
                maskImageData = createMaskFromAlpha(eraserImageData);
            }

            // Create inverted mask (Uint8Array)
            const pixelCount = width * height;
            const maskInv = new Uint8Array(pixelCount);
            const maskData32 = new Uint32Array(maskImageData.data.buffer);

            for (let i = 0; i < pixelCount; i++) {
                // maskData pixels are (alpha, alpha, alpha, 255)
                // In Little Endian Uint32: 255 << 24 | alpha << 16 | alpha << 8 | alpha
                // So lowest byte is alpha
                const alpha = maskData32[i] & 0xFF;
                maskInv[i] = 255 - alpha;
            }

            // Transfer buffers
            const imageBuffer = eraserImageData.data.buffer;
            const maskBuffer = maskImageData.data.buffer;
            const maskInvBuffer = maskInv.buffer;

            (self as any).postMessage({
                type: 'success',
                data: {
                    imageBuffer,
                    maskBuffer,
                    maskInvBuffer,
                    width,
                    height
                }
            }, [imageBuffer, maskBuffer, maskInvBuffer] as unknown as Transferable[]);

            // Cleanup
            eraserBitmap.close();

        } catch (error) {
            (self as any).postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    } else if (data.type === 'generateFrames') {
        try {
            const {
                sourceBuffer,
                width,
                height,
                numFrames,
                pattern,
                backgroundColor,
                showEraser,
                radius,
                addHandWiggle,
                wiggleAmplitude,
                wiggleFrequency,
                eraserData
            } = data;

            // Reconstruct source ImageData
            const sourceImageData = new ImageData(
                new Uint8ClampedArray(sourceBuffer),
                width,
                height
            );

            // Generate frames
            const result = generateEraserFrames(
                sourceImageData,
                numFrames,
                pattern,
                backgroundColor,
                showEraser,
                radius,
                addHandWiggle,
                wiggleAmplitude,
                wiggleFrequency,
                eraserData
            );

            // Transfer buffers back
            const framesBuffers = result.frames.map(f => f.data.buffer);

            (self as any).postMessage({
                type: 'success',
                data: {
                    framesBuffers,
                    positions: result.positions,
                    width,
                    height
                }
            }, framesBuffers as unknown as Transferable[]);

        } catch (error) {
            (self as any).postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};

async function loadImage(src: string): Promise<ImageBitmap> {
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(src, {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            return createImageBitmap(blob);
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;

            if (isLastAttempt) {
                throw error;
            }

            // Exponential backoff
            const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed to load image after ${maxRetries} attempts: ${src}`);
}

function createMaskFromAlpha(imageData: ImageData): ImageData {
    const mask = new ImageData(imageData.width, imageData.height);
    const src32 = new Uint32Array(imageData.data.buffer);
    const dst32 = new Uint32Array(mask.data.buffer);
    const len = src32.length;

    for (let i = 0; i < len; i++) {
        // Little-endian: ABGR
        // alpha is bits 24-31
        const alpha = src32[i] >>> 24;

        // We want grayscale alpha: R=alpha, G=alpha, B=alpha, A=255
        // Memory: alpha, alpha, alpha, 255
        // LE u32: 255(24-31) alpha(16-23) alpha(8-15) alpha(0-7)
        dst32[i] = (255 << 24) | (alpha << 16) | (alpha << 8) | alpha;
    }
    return mask;
}

// --- Helper Functions duplicated from eraser.ts for Worker ---

type Point = [number, number];

interface EraserFrameResult {
    frames: ImageData[];
    positions: Point[];
}

interface EraserHandData {
    imageBuffer: ArrayBuffer;
    maskInvBuffer: ArrayBuffer;
    width: number;
    height: number;
}

function generateEraserFrames(
    sourceImage: ImageData,
    numFrames: number,
    pattern: string,
    backgroundColor: [number, number, number],
    showEraser: boolean,
    radius: number,
    addHandWiggle: boolean,
    wiggleAmplitude: number,
    wiggleFrequency: number,
    eraserData?: EraserHandData
): EraserFrameResult {
    const { width, height } = sourceImage;
    const frames: ImageData[] = [];
    const positions: Point[] = [];

    // Generate erase path
    const useWhiteboardWipe = pattern !== 'diagonal';
    const erasePath = generateErasePath(width, height, radius, useWhiteboardWipe);

    // Create OffscreenCanvas for drawing
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    if (!ctx) return { frames: [], positions: [] };

    // Create eraser hand canvas if needed
    let eraserCanvas: OffscreenCanvas | null = null;
    let eraserCtx: OffscreenCanvasRenderingContext2D | null = null;
    let eraserImage: ImageData | null = null;
    let eraserMaskInv: Uint8Array | null = null;

    if (showEraser && eraserData) {
        eraserCanvas = new OffscreenCanvas(width, height);
        eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

        eraserImage = new ImageData(
            new Uint8ClampedArray(eraserData.imageBuffer),
            eraserData.width,
            eraserData.height
        );
        eraserMaskInv = new Uint8Array(eraserData.maskInvBuffer);
    }

    // Copy source to canvas
    ctx.putImageData(sourceImage, 0, 0);

    const totalPoints = erasePath.length;
    let lastPointIdx = 0;

    for (let frameIdx = 0; frameIdx <= numFrames; frameIdx++) {
        const progress = frameIdx === numFrames ? 1.0 : (frameIdx + 1) / (numFrames + 1);
        const pointsToProcess = Math.min(Math.floor(totalPoints * progress), totalPoints);

        // Erase new points
        if (useWhiteboardWipe) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgb(${backgroundColor[0]}, ${backgroundColor[1]}, ${backgroundColor[2]})`;
        } else {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'black';
        }

        for (let i = lastPointIdx; i < pointsToProcess; i++) {
            const [x, y] = erasePath[i];
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        lastPointIdx = pointsToProcess;

        // Get current position
        let currentPos: Point;
        if (lastPointIdx > 0 && lastPointIdx <= totalPoints) {
            currentPos = erasePath[Math.min(lastPointIdx - 1, totalPoints - 1)];
        } else if (totalPoints > 0) {
            currentPos = erasePath[0];
        } else {
            currentPos = [Math.floor(width / 2), Math.floor(height / 2)];
        }
        positions.push(currentPos);

        // Capture frame
        if (showEraser && eraserData && eraserCtx && eraserImage && eraserMaskInv && frameIdx < numFrames) {
            eraserCtx.clearRect(0, 0, width, height);
            eraserCtx.drawImage(canvas, 0, 0);

            // Draw eraser hand manually since we have raw buffers
            drawEraserOnCanvas(
                eraserCtx,
                eraserImage,
                eraserMaskInv,
                eraserData.width,
                eraserData.height,
                currentPos[0],
                currentPos[1]
            );

            frames.push(eraserCtx.getImageData(0, 0, width, height));
        } else {
            frames.push(ctx.getImageData(0, 0, width, height));
        }
    }

    // Apply wiggle
    if (addHandWiggle && positions.length > 0) {
        const wiggledPositions = addWiggleToPositions(positions, wiggleAmplitude, wiggleFrequency);
        // Update positions in place
        for (let i = 0; i < positions.length; i++) {
            positions[i] = wiggledPositions[i];
        }
    }

    return { frames, positions };
}

function generateErasePath(width: number, height: number, eraseRadius: number, useWhiteboardWipe: boolean): Point[] {
    let erasePath: Point[] = [];

    if (useWhiteboardWipe) {
        const stripHeight = Math.max(10, eraseRadius * 2 / 3);
        const stepSize = Math.max(5, eraseRadius / 2);
        let currentY = 0;
        let direction = 1;

        while (currentY < height) {
            const xValues = direction === 1
                ? Array.from({ length: Math.ceil(width / stepSize) }, (_, i) => i * stepSize)
                : Array.from({ length: Math.ceil(width / stepSize) }, (_, i) => width - 1 - i * stepSize);

            for (const x of xValues) {
                if (x >= 0 && x < width) {
                    erasePath.push([x, currentY]);
                }
            }

            currentY += stripHeight;
            direction *= -1;
        }
    } else {
        // Diagonal
        const diagonalBands = new Map<number, Point[]>();
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const diagIdx = row + col;
                if (!diagonalBands.has(diagIdx)) {
                    diagonalBands.set(diagIdx, []);
                }
                diagonalBands.get(diagIdx)!.push([col, row]);
            }
        }
        const sortedDiags = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
        for (let i = 0; i < sortedDiags.length; i++) {
            const pixels = diagonalBands.get(sortedDiags[i])!;
            if (i % 2 === 0) pixels.sort((a, b) => a[1] - b[1]);
            else pixels.sort((a, b) => b[1] - a[1]);
            erasePath.push(...pixels);
        }
    }

    if (!erasePath.length) {
        erasePath = [[Math.floor(width / 2), Math.floor(height / 2)]];
    }
    return erasePath;
}

function addWiggleToPositions(positions: Point[], amplitude: number, frequency: number): Point[] {
    return positions.map((pos, i) => {
        const t = i / positions.length;

        // Simplified wiggle for worker
        const primaryX = amplitude * Math.sin(2 * Math.PI * frequency * t);
        const primaryY = amplitude * 0.6 * Math.cos(2 * Math.PI * frequency * t);

        return [
            Math.round(pos[0] + primaryX),
            Math.round(pos[1] + primaryY)
        ] as Point;
    });
}

function drawEraserOnCanvas(
    ctx: OffscreenCanvasRenderingContext2D,
    eraserImage: ImageData,
    maskInv: Uint8Array,
    eraserWd: number,
    eraserHt: number,
    x: number,
    y: number
): void {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;

    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    const x2 = Math.min(canvasW, x + eraserWd);
    const y2 = Math.min(canvasH, y + eraserHt);

    if (x2 <= x1 || y2 <= y1) return;

    const srcX1 = Math.max(0, -x);
    const srcY1 = Math.max(0, -y);

    const currentData = ctx.getImageData(x1, y1, x2 - x1, y2 - y1);
    const dstData = currentData.data;
    const srcData = eraserImage.data;
    const dstWidth = x2 - x1;
    const height = y2 - y1;

    let srcRowOffset = srcY1 * eraserWd + srcX1;
    let dstRowOffset = 0;

    for (let dy = 0; dy < height; dy++) {
        let srcIdx = srcRowOffset;
        let dstIdx = dstRowOffset;

        for (let dx = 0; dx < dstWidth; dx++) {
            const maskVal = maskInv[srcIdx];

            dstData[dstIdx] = (dstData[dstIdx] * maskVal + srcData[srcIdx * 4] * 255 + 128) >> 8;
            dstData[dstIdx + 1] = (dstData[dstIdx + 1] * maskVal + srcData[srcIdx * 4 + 1] * 255 + 128) >> 8;
            dstData[dstIdx + 2] = (dstData[dstIdx + 2] * maskVal + srcData[srcIdx * 4 + 2] * 255 + 128) >> 8;
            dstData[dstIdx + 3] = (dstData[dstIdx + 3] * maskVal + srcData[srcIdx * 4 + 3] * 255 + 128) >> 8;

            srcIdx++;
            dstIdx += 4;
        }
        srcRowOffset += eraserWd;
        dstRowOffset += dstWidth * 4;
    }
    ctx.putImageData(currentData, x1, y1);
}
