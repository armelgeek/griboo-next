# Server Push Hand Position Fix - Summary

## Issue
The push hand overlay on the server was not positioned correctly. The hand offset was being applied in virtual canvas coordinates before the camera transformation, which caused incorrect positioning when the camera viewport differed from the virtual canvas size.

## Root Cause
The hand overlay offset (e.g., `[-40, -32]` pixels) was being applied by the `PushHandStrategy` in virtual space before the camera transformation. This meant:
1. The offset was included in the virtual hand position
2. The entire position (including offset) was transformed by the camera
3. With zoom ≠ 1, the offset would be scaled incorrectly

**Example with zoom = 0.5:**
- **OLD BEHAVIOR**: Offset applied in virtual space, then scaled
  - Virtual position: (275 - 40, 350 - 32) = (235, 318)  
  - Screen position: (235 * 0.5, 318 * 0.5 + 25) = (117.5, 184)
  - Effective screen offset: [-20, -16] pixels (half of intended)

- **NEW BEHAVIOR**: Offset applied in screen space
  - Virtual position: (275, 350)
  - Screen position: (275 * 0.5, 350 * 0.5 + 25) = (137.5, 200)
  - Final position: (137.5 - 40, 200 - 32) = (97.5, 168)
  - Effective screen offset: [-40, -32] pixels (as intended)

## Solution
Modified the server-side rendering to apply the hand offset in screen space after the camera transformation:

1. **BaseHandOverlayManager** (`src/shared/hand_overlay_manager.ts`):
   - Added `applyOffset` parameter (default: `true`) to `getHandPosition()`
   - When `applyOffset = false`, offset is not passed to the strategy
   - Added `getConfig()` method for type-safe config access

2. **ServerHandOverlayManager** (`src/server/hand_overlay_manager.ts`):
   - Modified `calculateHandPosition()` to pass `applyOffset: false`
   - Added comment explaining offset will be applied in screen space

3. **ServerScene** (`src/server/scene.ts`):
   - In `renderFrame()`, after transforming hand position to screen coordinates, now applies the hand offset
   - Retrieves offset from hand manager config and adds it to screen position
   - Added comments explaining why offset is applied in screen space

## Verification
### Debug Output Comparison

**BEFORE FIX** (from issue report):
```
[ServerScene Debug] Layer push_box: Virtual Hand (235.0, 372.7) -> Screen (235.0, 397.7)
```
- Virtual Hand X = 235.0 (offset already applied)
- Screen X = 235.0 (scaled virtual position)

**AFTER FIX**:
```
[ServerScene Debug] Layer push_box: Virtual Hand (275.0, 404.7) -> Screen (275.0, 429.7) -> Final (235.0, 397.7), offset: [-40, -32]
```
- Virtual Hand X = 275.0 (offset NOT applied)
- Screen X = 275.0 (scaled virtual position)
- Final X = 235.0 (screen position + offset)

### Test Results
- Created `test_push_hand_position.ts` to verify camera transformation math
- Test passes with correct final positions
- Generated 646 frames successfully with `npm run generate:demo`
- No security vulnerabilities found (CodeQL scan)

## Impact
- **Frontend**: No changes - continues to apply offset in virtual space
- **Server**: Now correctly applies offset in screen space
- **Zoom invariance**: Hand offset remains constant in screen pixels regardless of camera zoom
- **Backward compatibility**: With zoom = 1 and matching virtual/screen sizes, behavior is identical

## Files Changed
1. `src/shared/hand_overlay_manager.ts` - Added `applyOffset` parameter and `getConfig()` method
2. `src/server/hand_overlay_manager.ts` - Pass `applyOffset: false`
3. `src/server/scene.ts` - Apply offset in screen space after camera transform
4. `test_push_hand_position.ts` - Test to verify fix

## Notes
- The frontend behavior is unchanged because it typically doesn't use the camera transformation for hand positioning
- This fix is crucial for server-side rendering where camera zoom and viewport can vary significantly from virtual canvas size
- The hand offset represents the pixel distance from the object contact point to the hand image anchor point
- Applying offset in screen space ensures the hand image aligns correctly with the object at all zoom levels
