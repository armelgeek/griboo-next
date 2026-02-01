# HandOverlay Image Loading Fix - Summary

## Issue Description

The server-side HandOverlay was failing to load hand images with the error:
```
[HandOverlay Server] Failed to load hand image: Error: No such file or directory
```

This occurred when running `examples/whiteboard_complete.ts` and other server-side examples that use hand overlays.

## Root Cause

The `resolveAssetPath` function in `src/server/utils/path_utils.ts` didn't properly map paths like `/hand/drawing-hand.png` to the actual file location at `static/hand/drawing-hand.png`.

The resolution logic tried:
1. Absolute paths (not applicable)
2. URLs (not applicable)  
3. `public/` directory mapping (file not there)
4. Direct relative path (file not at `/hand/` in project root)

But never tried the `static/` directory where the actual hand images are located.

## Solution Implemented

### 1. Fixed Path Resolution (Primary Fix)

Enhanced `src/server/utils/path_utils.ts` to try the `static/` directory:

```typescript
// Try mapping to static/ directory (e.g., /hand/... -> static/hand/...)
const staticPath = path.join(process.cwd(), 'static', normalizedPath);
if (fs.existsSync(staticPath)) {
    return staticPath;
}
```

This allows paths like `/hand/drawing-hand.png` to resolve to `static/hand/drawing-hand.png`.

### 2. Centralized Asset Configuration (Enhancement)

Created a new configuration system to eliminate hard-coded asset paths and enable dynamic configuration.

**New File:** `src/shared/asset_config.ts`
- Provides `getAssetPaths()`, `setAssetPaths()`, `resetAssetPaths()`, `getAssetPath()`
- Allows runtime configuration of asset paths
- Works in both frontend and server environments

**Updated Files:**
- `src/shared/hand_config.ts` - Now uses centralized configuration with lazy evaluation
- `src/frontend/rendering/hand_overlay.ts` - Imports from centralized config

### 3. Lazy Evaluation for Dynamic Updates

Implemented lazy evaluation in the preset system so that:
- Asset path changes are immediately reflected in hand presets
- No module reload required
- Presets use function references instead of static values

```typescript
// Before: Evaluated at module load time
imageUrl: '/hand/drawing-hand.png'

// After: Evaluated when accessed
imageUrl: getDrawingHandImageUrl  // Function reference
```

## Files Modified

1. **src/server/utils/path_utils.ts** - Added `static/` directory mapping
2. **src/shared/asset_config.ts** - NEW: Centralized asset configuration
3. **src/shared/hand_config.ts** - Uses asset config with lazy evaluation
4. **src/frontend/rendering/hand_overlay.ts** - Uses centralized config
5. **ASSET_CONFIGURATION.md** - NEW: Comprehensive documentation

## Test Files Created

1. **examples/test_hand_loading.ts** - Verifies hand images load without errors
2. **examples/test_dynamic_config.ts** - Validates dynamic path configuration

## Test Results

✅ **Primary Fix Verified:**
```bash
npx tsx examples/test_hand_loading.ts
```
- No "Failed to load hand image" errors
- 62 frames rendered successfully
- Hand overlay visible in generated frames

✅ **Dynamic Configuration Verified:**
```bash
npx tsx examples/test_dynamic_config.ts
```
- Default paths work correctly
- Custom paths can be set at runtime
- Presets reflect path changes immediately
- Reset functionality works

✅ **Security Check:**
- CodeQL analysis: 0 vulnerabilities found

## Usage Examples

### Basic Usage (No Changes Needed)
```typescript
import { ServerWhiteboard } from './src/server/whiteboard';

const whiteboard = new ServerWhiteboard({ width: 1280, height: 720 });
whiteboard.addScene({
    layers: [{
        type: 'text',
        textConfig: { text: 'Hello' },
        handOverlay: { enabled: true }  // Works automatically
    }]
});
```

### Dynamic Configuration
```typescript
import { setAssetPaths } from './src/shared/asset_config';

// Set custom paths before creating whiteboard
setAssetPaths({
    handDrawing: '/custom/hand.png',
    handEraser: '/custom/eraser.png'
});

const whiteboard = new ServerWhiteboard({ width: 1280, height: 720 });
// Will use custom paths automatically
```

## Benefits

1. **Fixed Original Issue** - Hand images now load correctly on server-side
2. **Flexible Configuration** - Easy to customize asset paths per project/environment
3. **Dynamic Updates** - Path changes take effect immediately without reload
4. **Backward Compatible** - Existing code works without modifications
5. **Well Documented** - Comprehensive guide in ASSET_CONFIGURATION.md
6. **Future-Proof** - Easy to extend for other asset types

## Migration Notes

**No migration needed for existing code!** The fix is backward compatible.

**To use custom paths:**
```typescript
import { setAssetPaths } from './src/shared/asset_config';

setAssetPaths({
    handDrawing: '/your/custom/path.png'
});
```

## Related Files

- Hand images located in: `static/hand/`
  - `drawing-hand.png`
  - `eraser.png`
  - `push_hand_real.png`

## Technical Details

### Path Resolution Order (Server-Side)

1. Check if absolute path exists → use as-is
2. Check if URL (http/https) → pass through
3. Remove leading `/` to normalize
4. If starts with `assets/` → map to `public/assets/`
5. Try relative to `process.cwd()`
6. Try fallback path relative to cwd
7. **NEW:** Try `static/` directory mapping ⭐

### Lazy Evaluation Implementation

Presets now store function references instead of resolved values:
```typescript
interface PresetConfig {
    getImageUrl: () => string;  // Function that resolves URL when called
    // ... other fields
}
```

When `getPreset()` is called, it resolves the URL dynamically:
```typescript
return {
    imageUrl: config.getImageUrl()  // Calls function to get current path
};
```

This ensures path changes are immediately reflected without requiring preset re-registration.
