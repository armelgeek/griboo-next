# Hand Offset and Camera Zoom Issue

## Problem
Hand offsets are currently applied in virtual space before camera transformation, which causes them to be scaled by the camera zoom factor. This results in hand cursors appearing too far from their target points when the camera is zoomed in.

## Current Behavior
1. Hand position is calculated in virtual space
2. Hand offset is applied in virtual space: `position + offset`
3. Final position is transformed to screen space: `(position + offset) * zoom`
4. Result: offset is scaled by zoom, making it too large

## Example
With a zoom of 2.5x and drawing hand offset of `[-18, -20]`:
- Virtual position: (100, 100)
- After offset in virtual space: (100 + (-18), 100 + (-20)) = (82, 80)
- After camera transform: (82 * 2.5, 80 * 2.5) = (205, 200)
- Effective offset in screen space: (205 - 250, 200 - 250) = (-45, -50)
- Expected: offset of (-18, -20) in screen space

## Current Workaround (server_demo_test.ts)
For demos with known zoom levels, offsets can be pre-adjusted by dividing by the zoom factor:
- Drawing hand at zoom 2.0: `[-18, -20]` → `[-9, -10]`
- Push hand at zoom 2.5: `[-100, -80]` → `[-40, -32]`
- Shape hand at zoom 2.5: `[-18, -20]` → `[-7, -8]`

## Proper Architectural Solution (Future Work)
To fix this properly across all use cases:

1. **Modify Hand Strategy Interface**: Return position without offset
   ```typescript
   interface HandPosition {
       x: number;
       y: number;
       rotation?: number;
       offset?: [number, number];  // NEW: return offset separately
   }
   ```

2. **Modify Scene Rendering**: Apply offset after camera transform
   ```typescript
   // In scene.ts
   const handPos = layer.getHandPosition(time);
   if (handPos) {
       const handManager = layer.getActiveHandManager(time);
       if (handManager) {
           // Transform position (without offset) to screen space
           const screenPos = this.cameraController.transformPoint(handPos, time, this.layers);
           
           // Apply offset in screen space
           const offsetX = handPos.offset?.[0] || 0;
           const offsetY = handPos.offset?.[1] || 0;
           const finalX = screenPos.x + offsetX;
           const finalY = screenPos.y + offsetY;
           
           handManager.renderHandAt(ctx, finalX, finalY, handPos.rotation || 0);
       }
   }
   ```

3. **Update All Hand Strategies**: Remove offset application from strategy implementations
   - Currently: strategies apply `handOffset` from `layerData`
   - After fix: strategies return position only, offset is returned separately

## Impact
This change would affect:
- `src/shared/hand_overlay_manager.ts` - All strategy implementations
- `src/server/scene.ts` - Hand rendering logic
- `src/server/layer.ts` - `getHandPosition` method
- All layer implementations that calculate hand positions

## Benefits
- Hand offsets would work correctly at any zoom level
- No need to manually adjust offsets for different zoom levels
- More intuitive behavior - offset in pixels always means screen pixels
- Consistent behavior between frontend and server

## Migration
Once implemented:
- All manual offset adjustments for zoom (like in server_demo_test.ts) should be reverted
- Update documentation to clarify that offsets are in screen space
- Add tests to verify hand positioning at various zoom levels
