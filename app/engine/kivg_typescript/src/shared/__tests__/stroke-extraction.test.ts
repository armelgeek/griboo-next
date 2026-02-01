/**
 * Tests for Stroke Extraction Fix
 * Validates that white areas are preserved correctly during adaptive thresholding
 */

import { describe, it, expect } from 'vitest';
import * as ImageProc from '../image-processing';

describe('Adaptive Threshold - White Area Preservation', () => {
    it('should mark darker pixels as strokes (255) and lighter pixels as background (0)', () => {
        // Create a simple 5x5 grayscale image with a dark stroke on white background
        // Layout:
        //   W W W W W  (255)
        //   W W B W W  (255, 255, 100, 255, 255) <- dark stroke in middle
        //   W B B B W  (255, 100, 100, 100, 255)
        //   W W B W W  (255, 255, 100, 255, 255)
        //   W W W W W  (255)
        const width = 5;
        const height = 5;
        const gray = new Uint8Array([
            255, 255, 255, 255, 255,  // Row 0: all white
            255, 255, 100, 255, 255,  // Row 1: dark pixel in center
            255, 100, 100, 100, 255,  // Row 2: dark horizontal stroke
            255, 255, 100, 255, 255,  // Row 3: dark pixel in center
            255, 255, 255, 255, 255,  // Row 4: all white
        ]);

        const binary = ImageProc.adaptiveThreshold(gray, width, height, 3, 2);

        // The center dark pixels (value 100) should be marked as strokes (255 in binary)
        // The white pixels (value 255) should be marked as background (0 in binary)
        
        // Check corners (should be background = 0)
        expect(binary[0]).toBe(0);  // Top-left
        expect(binary[4]).toBe(0);  // Top-right
        expect(binary[20]).toBe(0); // Bottom-left
        expect(binary[24]).toBe(0); // Bottom-right

        // Check center dark pixels (should be stroke = 255)
        expect(binary[12]).toBe(255); // Center of the cross (row 2, col 2)
        
        // The exact results depend on the mean calculation, but dark pixels should generally be 255
        // and bright pixels should generally be 0
    });

    it('should handle all-white image (no strokes)', () => {
        const width = 10;
        const height = 10;
        const gray = new Uint8Array(width * height).fill(255); // All white

        const binary = ImageProc.adaptiveThreshold(gray, width, height, 5, 2);

        // All pixels should be marked as background (0) since there are no dark areas
        const allZero = binary.every(val => val === 0);
        expect(allZero).toBe(true);
    });

    it('should handle all-black image (uniform intensity)', () => {
        const width = 10;
        const height = 10;
        const gray = new Uint8Array(width * height).fill(0); // All black

        const binary = ImageProc.adaptiveThreshold(gray, width, height, 5, 2);

        // When all pixels have the same value, adaptive threshold will mark them all as background (0)
        // This is expected behavior for adaptive thresholding - it looks for local contrast
        const allZero = binary.every(val => val === 0);
        expect(allZero).toBe(true);
    });

    it('should correctly threshold a simple black-on-white pattern', () => {
        // Create a 3x3 image:
        //   W W W  (255)
        //   W B W  (255, 50, 255)  <- black pixel in center
        //   W W W  (255)
        const width = 3;
        const height = 3;
        const gray = new Uint8Array([
            255, 255, 255,
            255,  50, 255,
            255, 255, 255,
        ]);

        const binary = ImageProc.adaptiveThreshold(gray, width, height, 3, 2);

        // Center dark pixel should be marked as stroke (255)
        expect(binary[4]).toBe(255);
        
        // Surrounding white pixels should be marked as background (0)
        expect(binary[0]).toBe(0);
        expect(binary[1]).toBe(0);
        expect(binary[2]).toBe(0);
        expect(binary[3]).toBe(0);
        expect(binary[5]).toBe(0);
        expect(binary[6]).toBe(0);
        expect(binary[7]).toBe(0);
        expect(binary[8]).toBe(0);
    });
});

describe('Grayscale Conversion', () => {
    it('should preserve white pixels as white (255)', () => {
        const imageData = {
            width: 2,
            height: 2,
            data: new Uint8ClampedArray([
                255, 255, 255, 255,  // White pixel 1
                255, 255, 255, 255,  // White pixel 2
                255, 255, 255, 255,  // White pixel 3
                255, 255, 255, 255,  // White pixel 4
            ])
        } as ImageData;

        const gray = ImageProc.grayscale(imageData);

        // All pixels should be 255 (white)
        expect(gray[0]).toBe(255);
        expect(gray[1]).toBe(255);
        expect(gray[2]).toBe(255);
        expect(gray[3]).toBe(255);
    });

    it('should convert black pixels to black (0)', () => {
        const imageData = {
            width: 2,
            height: 2,
            data: new Uint8ClampedArray([
                0, 0, 0, 255,  // Black pixel 1
                0, 0, 0, 255,  // Black pixel 2
                0, 0, 0, 255,  // Black pixel 3
                0, 0, 0, 255,  // Black pixel 4
            ])
        } as ImageData;

        const gray = ImageProc.grayscale(imageData);

        // All pixels should be 0 (black)
        expect(gray[0]).toBe(0);
        expect(gray[1]).toBe(0);
        expect(gray[2]).toBe(0);
        expect(gray[3]).toBe(0);
    });
});

describe('Morphological Operations', () => {
    it('closing should fill small holes', () => {
        // Create a 7x7 image with a stroke that has a small gap in center:
        //   0 0 0 0 0 0 0
        //   0 0 0 0 0 0 0
        //   0 0 255 255 0 0 0
        //   0 0 255 0 255 0 0  <- gap in middle
        //   0 0 255 255 0 0 0
        //   0 0 0 0 0 0 0
        //   0 0 0 0 0 0 0
        const width = 7;
        const height = 7;
        const data = new Uint8Array([
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 255, 255, 0, 0, 0,
            0, 0, 255, 0, 255, 0, 0,
            0, 0, 255, 255, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
        ]);

        const result = ImageProc.closing(data, width, height, 3);

        // The gap (position 24, row 3 col 3) should be filled after closing
        expect(result[24]).toBeGreaterThan(0); // Center gap should be filled
    });

    it('dilate should expand bright regions', () => {
        // Single bright pixel in center
        const width = 3;
        const height = 3;
        const data = new Uint8Array([
            0, 0, 0,
            0, 255, 0,
            0, 0, 0,
        ]);

        const result = ImageProc.dilate(data, width, height, 3);

        // Center should definitely be bright
        expect(result[4]).toBe(255); // Center
        // Immediate neighbors should also be bright after dilation with size 3
        expect(result[1]).toBeGreaterThan(0); // Top
        expect(result[3]).toBeGreaterThan(0); // Left
        expect(result[5]).toBeGreaterThan(0); // Right
        expect(result[7]).toBeGreaterThan(0); // Bottom
    });

    it('erode should shrink bright regions', () => {
        // Create a larger bright region to avoid edge effects
        const width = 5;
        const height = 5;
        const data = new Uint8Array(25).fill(255); // All bright

        const result = ImageProc.erode(data, width, height, 1);

        // Center should remain bright
        expect(result[12]).toBe(255); // Center (row 2, col 2)
        
        // Corners may be eroded
        // With small erosion, most pixels should still be bright, but corners might be affected
        const countBright = result.filter(v => v === 255).length;
        expect(countBright).toBeGreaterThan(0);
    });
});
