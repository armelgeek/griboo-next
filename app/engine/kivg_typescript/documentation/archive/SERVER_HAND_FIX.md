# Server-Side Occlusion Hand Display Fix

## Problem
The eraser hand was not displaying during occlusion culling in server-side rendering (as mentioned in comment on `server_demo_test.ts`), even though it was configured with `occlusionCullingConfig.showEraser: true`.

## Root Cause
The server-side code was not checking or using the `showEraser` configuration option from `occlusionCullingConfig`. While the eraser hand manager was initialized and the hand position was calculated, the `showEraser` flag was never passed through the occlusion path data, so there was no way to conditionally show/hide the eraser hand.

## Solution
Added support for the `showEraser` configuration flag throughout the server-side occlusion culling pipeline:

### Changes Made

1. **src/server/scene.ts** (line ~251)
   - Extract `showEraser` from `occlusionCullingConfig` (defaults to `true`)
   - Pass the flag to `setActiveOcclusionPath()` method

2. **src/server/layer.ts**
   - Updated `activeOcclusionPath` type to include `showEraser: boolean` field
   - Modified `setActiveOcclusionPath()` to accept and store the `showEraser` parameter
   - Updated `getHandPosition()` to check `showEraser` flag before returning eraser hand position
   - Updated `getActiveHandManager()` to check `showEraser` flag before returning eraser hand manager

## How It Works

### Configuration
```typescript
{
  occlusionCulling: true,
  occlusionCullingConfig: {
    showEraser: true,  // Enable eraser hand display
    radius: 20,
    duration: 1.0
  }
}
```

### Flow

1. **Scene Setup** (`performOcclusionCulling`)
   ```typescript
   const showEraser = occlusionConfig.showEraser !== false; // Default true
   upperLayer.setActiveOcclusionPath(path, radius, startTime, duration, showEraser);
   ```

2. **Layer Storage**
   ```typescript
   activeOcclusionPath = { path, radius, startTime, duration, showEraser }
   ```

3. **Hand Position Calculation** (`getHandPosition`)
   ```typescript
   if (showEraser && time >= startTime && time < startTime + duration) {
     // Calculate and return eraser hand position
     return this.eraserHandManager.calculateHandPosition(progress, layerData);
   }
   ```

4. **Hand Manager Selection** (`getActiveHandManager`)
   ```typescript
   if (showEraser && time >= startTime && time < startTime + duration) {
     return this.eraserHandManager;
   }
   ```

5. **Rendering** (`renderFrame`)
   - Scene calls `layer.getHandPosition(time)` for each layer
   - If occlusion is active and `showEraser` is true, returns eraser hand position
   - Scene calls `layer.getActiveHandManager(time)` to get the correct manager
   - Hand manager renders the eraser hand at the calculated position

## Testing

### Expected Behavior
When `occlusionCullingConfig.showEraser: true`:
- ✅ Eraser hand appears during occlusion culling
- ✅ Hand follows the zigzag erase path
- ✅ Hand uses the configured eraser hand image
- ✅ Hand disappears after occlusion completes

When `occlusionCullingConfig.showEraser: false`:
- ✅ No eraser hand is displayed
- ✅ Occlusion culling still functions (mask is applied)
- ✅ Content is still erased, just without visual hand

### Verification
The fix can be verified by running `server_demo_test.ts`:
```bash
npx ts-node --project tsconfig.examples.json examples/server_demo_test.ts
```

In the generated video, scene 3 ("Occlusion Culling") should now show the eraser hand moving across the overlapping area when the red rectangle appears over the green circle.

## Consistency with Frontend

The server now matches the frontend behavior:
- Both check `occlusionCullingConfig.showEraser`
- Both default to `true` if not specified
- Both use the same eraser hand preset
- Both calculate hand position along the zigzag erase path

## Implementation Details

### Type Signature
```typescript
setActiveOcclusionPath(
  path: Coordinate[],
  radius: number,
  startTime: number,
  duration: number,
  showEraser: boolean = true  // New parameter
): void
```

### State Storage
```typescript
protected activeOcclusionPath: {
  path: Coordinate[],
  radius: number,
  startTime: number,
  duration: number,
  showEraser: boolean  // New field
} | null = null;
```

## Benefits
- ✅ Server-side rendering now shows eraser hand during occlusion (matching frontend)
- ✅ Configurable via `occlusionCullingConfig.showEraser`
- ✅ Consistent behavior between frontend and server
- ✅ No breaking changes (defaults to `true`)
- ✅ Minimal code changes (3 lines modified, 1 line added)
