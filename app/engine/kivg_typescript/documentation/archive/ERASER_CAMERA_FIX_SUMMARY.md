# Eraser Layer Camera Integration Fix

## Issue Summary
The eraser layer's hand overlay was misaligned when using camera zoom/pan. The French issue description translates to: "take into account the camera in eraser layer on the server and frontend"

## Root Cause Analysis

### The Problem
The `ServerEraserLayer` class had **inconsistent dimension handling** between rendering and hand position calculation:

1. **Rendering** (line 48-49 in `renderEraser()`):
   ```typescript
   const w = ctx.canvas.width;
   const h = ctx.canvas.height;
   ```
   ✅ Correctly uses actual canvas dimensions

2. **Hand Position** (line 87-88 in `getLayerDataForHand()`):
   ```typescript
   const w = this.config.width || 800;
   const h = this.config.height || 600;
   ```
   ❌ Incorrectly uses layer config dimensions

### Why This Matters
When a scene has a camera with a `virtualSize` different from the output size:
- Canvas dimensions = virtualSize (e.g., 2400×1350)
- Layer config dimensions might be different or unset (e.g., 800×600)
- Hand positions calculated using config dimensions don't align with actual eraser rendering

### Example Scenario
```typescript
camera: {
  virtualSize: { width: 2400, height: 1350 },  // Virtual canvas
  initial: { zoom: 1.0, position: { x: 0.5, y: 0.5 } }
}
// Output size: 1920×1080
```

The eraser renders on a 2400×1350 canvas, but hand positions were calculated for 800×600, causing misalignment.

## The Fix

### Server Side (src/server/layers/eraser_layer.ts)

**Changed 1:** Pass canvas dimensions to hand calculation
```typescript
// Line 37 - in doRender()
const layerData = this.getLayerDataForHand(progress, ctx.canvas.width, ctx.canvas.height);
```

**Changed 2:** Accept and prioritize canvas dimensions
```typescript
// Line 86 - updated signature
protected getLayerDataForHand(progress: number, canvasWidth?: number, canvasHeight?: number): any {
    // Use canvas dimensions if provided, otherwise fall back to config
    const w = canvasWidth ?? this.config.width ?? 800;
    const h = canvasHeight ?? this.config.height ?? 600;
    // ... rest of method
}
```

### Frontend Side
No changes needed! The frontend already handles this correctly:
- Uses `ImageData` with explicit dimensions from source image
- `HandOverlayManager` applies camera transforms via `setCameraTransform()`
- Progressive erase context uses actual canvas dimensions

## How Camera Transform Works

### Complete Transform Chain
1. **Layer-local coords** (e.g., eraser at x=100, y=200 in layer space)
   ↓ `transformToGlobalAnimated(p, time)`
2. **Scene/virtual coords** (accounting for layer position, rotation, scale)
   ↓ `cameraController.transformPoint(handPos, time, layers)`
3. **Screen coords** (accounting for camera zoom/pan to output dimensions)

### Scene Rendering Flow (server)
```typescript
// 1. Render layers to virtual canvas (e.g., 2400×1350)
await this.renderToCanvas(canvas, time, monitor, renderHandsInVirtualSpace);

// 2. Apply camera transform to canvas (output to 1920×1080)
const transformedCanvas = this.cameraController.applyToCanvas(canvas, time, this.layers, bgColor);

// 3. Render hands in screen space on transformed canvas
for (const layer of this.layers) {
    const handPos = layer.getHandPosition(time);  // Returns virtual coords
    if (handPos) {
        // Transform virtual → screen coords
        const screenPos = this.cameraController.transformPoint(handPos, time, this.layers);
        handManager.renderHandAt(ctx, screenPos.x, screenPos.y, handPos.rotation || 0);
    }
}
```

## Testing

### Test File Created
`examples/test_eraser_camera.ts` - Tests eraser layer with camera movements:
- Virtual size: 2400×1350
- Output size: 1920×1080
- Camera zooms from 1.5 to 2.0
- Camera pans from (0.3, 0.3) to (0.7, 0.7)
- Eraser layer with diagonal pattern
- Expected: Hand stays aligned with eraser path throughout

### Manual Verification Recommended
Run the test and verify:
1. Hand overlay is visible throughout eraser animation
2. Hand follows the diagonal eraser path correctly
3. Hand position remains accurate during camera zoom
4. Hand position remains accurate during camera pan

## Security & Quality Checks
- ✅ Code review: Passed (1 minor non-blocking comment)
- ✅ CodeQL security scan: 0 alerts
- ✅ No new dependencies added
- ✅ Backward compatible (optional parameters with fallbacks)

## Impact
- **Scope**: Minimal - only affects `ServerEraserLayer` hand position calculation
- **Risk**: Low - maintains backward compatibility via optional parameters
- **Benefit**: Fixes hand misalignment when using camera with eraser layers

## Related Code
- `src/server/scene.ts` (lines 343-361): Camera transformation and hand rendering
- `src/server/camera.ts` (lines 231-248): `transformPoint()` implementation
- `src/frontend/whiteboard/hand-overlay-manager.ts` (lines 306-318, 361-373): Camera transform application
- `src/frontend/whiteboard/scene.ts` (lines 1570-1603): SVG camera transform and propagation
