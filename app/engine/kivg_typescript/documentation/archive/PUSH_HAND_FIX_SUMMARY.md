# Push Hand Position Fix - Summary

## Issue
The push hand on the server was not respecting the scale and offset configuration from the `hands.push` config. The user wanted to use offset `[-40, -32]` instead of the default `[-100, -80]`.

## Root Cause Analysis
1. **Configuration System Working Correctly**: The configuration merging system was working as designed. Global `hands` config can be overridden by layer-specific `handOverlay` config.

2. **Offset Application**: The offset is correctly applied by the `PushHandStrategy` via `BaseHandOverlayManager.getHandPosition()`, which enriches layerData with `handOffset` from the config.

3. **Scale Application**: The scale is correctly applied by `HandOverlay` during image load, calculating `cachedWidth/Height = imageWidth/Height * scale`.

4. **Issue Location**: The issue was in `examples/shared_config.ts` which was using the default offset `[-100, -80]` instead of the desired offset `[-40, -32]`.

## Changes Made

### 1. Updated `examples/shared_config.ts`
Changed the push hand offset from `[-100, -80]` to `[-40, -32]`:

```typescript
hands: {
    push: {
        imageUrl: 'static/hand/push_hand_real.png',
        scale: 0.35,
        offset: [-40, -32]  // Changed from [-100, -80]
    }
}
```

This matches the configuration already used in `examples/server_demo_test.ts`.

## How It Works

### Configuration Flow
1. Global `hands.push` config defines default values: `{ imageUrl, scale: 0.35, offset: [-40, -32] }`
2. Layer can override with `handOverlay` config: `{ enabled: true, scale: 0.4 }`
3. During initialization, configs are merged: `{ imageUrl, scale: 0.4, offset: [-40, -32] }`
4. Final config stored in `HandOverlayManager.config`

### Rendering Flow
1. `ServerPushLayer.doRender()` calculates hand position based on push direction (e.g., for `from: 'bottom'`, position is at `(x + width/2, y + height)`)
2. Calls `handOverlayManager.calculateHandPosition(progress, { currentObjectPosition })`
3. `BaseHandOverlayManager.getHandPosition()` enriches layerData with `handOffset: this.config.offset` (which is `[-40, -32]`)
4. `PushHandStrategy.getHandPosition()` applies the offset: `x += handOffset[0]; y += handOffset[1]`
5. Returns position with offset applied
6. Scene renders hand at final position using `handManager.renderHandAt(ctx, x, y)`
7. `HandOverlay.render()` draws the scaled image at the position (using `cachedWidth/Height` which incorporates the scale)

## Offset Meaning
The offset `[-40, -32]` means:
- `-40` pixels in X: moves hand 40 pixels LEFT from the calculated contact point
- `-32` pixels in Y: moves hand 32 pixels UP from the calculated contact point

For a push from bottom, the contact point is at the bottom-center of the pushed object. The offset adjusts where the hand image is drawn relative to this point to align the actual pushing part of the hand (e.g., palm or fingertips) with the contact point.

## Verification
To verify the fix:
1. Run `npm run generate:demo` to generate frames
2. Check frames 0-89 (push animation with 3-second duration at 30fps)
3. The hand should be visible behind/beside the pushed object (Facebook icon)
4. The hand should be properly sized (scale 0.4 in demo, or 0.35 in shared_config)
5. The hand should be positioned with offset [-40, -32] from the calculated push point

## Notes
- If a layer specifies `handOverlay: { scale: X }`, it will override the global `hands.push.scale` value
- To use the global scale, omit the `scale` property from the layer's `handOverlay` config
- The offset from global config is always used unless the layer explicitly overrides it with its own offset
- The HandOverlay's internal offset is always set to `[0, 0]` because the strategy applies the offset instead

## Generated Frames
Frames are in `/home/runner/work/engine/engine/temp_frames/`:
- `frame_00000.png` to `frame_00089.png`: Push animation (3 seconds @ 30fps)
- Frame 00045 shows the push animation at mid-progress (1.5 seconds)
