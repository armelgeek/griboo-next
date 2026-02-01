# Asset Configuration System

## Overview

The KIVG engine now includes a centralized asset configuration system that allows you to dynamically configure asset paths for hand images and other resources. This works for both frontend (browser) and server (Node.js) environments.

## Problem Solved

Previously, asset paths were hard-coded in multiple files:
- `/hand/drawing-hand.png`
- `/hand/eraser.png`  
- `/hand/push_hand_real.png`

This made it difficult to:
- Customize asset locations
- Use different assets for different projects
- Deploy to different environments with different asset paths

## Solution

The new system provides:
1. **Centralized Configuration** - All asset paths in one place (`src/shared/asset_config.ts`)
2. **Dynamic Updates** - Change paths at runtime before rendering
3. **Universal** - Works in both frontend and server environments
4. **Backward Compatible** - Existing code continues to work with default paths

## Usage

### Basic Usage (Default Paths)

No changes needed! The engine uses default paths automatically:

```typescript
import { ServerWhiteboard } from './src/server/whiteboard';

const whiteboard = new ServerWhiteboard({
    width: 1280,
    height: 720
});

whiteboard.addScene({
    id: 'scene-1',
    layers: [{
        id: 'text-1',
        type: 'text',
        textConfig: { text: 'Hello' },
        handOverlay: {
            enabled: true  // Uses default hand image
        }
    }]
});
```

### Custom Asset Paths

Configure custom paths before creating scenes:

```typescript
import { setAssetPaths } from './src/shared/asset_config';
import { ServerWhiteboard } from './src/server/whiteboard';

// Configure custom asset paths
setAssetPaths({
    handDrawing: '/custom/path/my-hand.png',
    handEraser: '/custom/path/my-eraser.png',
    handPush: '/custom/path/my-push-hand.png'
});

// Now create your whiteboard - it will use custom paths
const whiteboard = new ServerWhiteboard({
    width: 1280,
    height: 720
});
```

### Partial Updates

You can update only specific asset paths:

```typescript
import { setAssetPaths } from './src/shared/asset_config';

// Only change the drawing hand, keep others as default
setAssetPaths({
    handDrawing: '/my-custom-hand.png'
});
```

### Frontend Usage

The same API works in the browser:

```typescript
import { setAssetPaths } from '@engine/shared/asset_config';
import { Whiteboard } from '@engine/whiteboard';

// Configure before creating whiteboard
setAssetPaths({
    handDrawing: 'https://cdn.example.com/hand.png'
});

const whiteboard = new Whiteboard(canvas);
```

### Getting Current Configuration

```typescript
import { getAssetPaths, getAssetPath } from './src/shared/asset_config';

// Get all paths
const allPaths = getAssetPaths();
console.log(allPaths);
// { handDrawing: '/hand/drawing-hand.png', ... }

// Get specific path
const drawingHandPath = getAssetPath('handDrawing');
console.log(drawingHandPath);
// '/hand/drawing-hand.png'
```

### Resetting to Defaults

```typescript
import { resetAssetPaths } from './src/shared/asset_config';

// Reset all paths to defaults
resetAssetPaths();
```

## Default Paths

The default asset paths are:
- `handDrawing`: `/hand/drawing-hand.png`
- `handEraser`: `/hand/eraser.png`
- `handPush`: `/hand/push_hand_real.png`

These are resolved by the engine to:
- **Frontend**: Loaded from the web server (e.g., `http://localhost:1234/hand/drawing-hand.png`)
- **Server**: Resolved to `static/hand/drawing-hand.png` in your project directory

## Path Resolution (Server-Side)

The server-side path resolution (`resolveAssetPath` in `src/server/utils/path_utils.ts`) handles:

1. **Absolute paths** - Used as-is if they exist
2. **URLs** - Passed through unchanged (`http://`, `https://`)
3. **Relative paths** - Resolved relative to `process.cwd()`
4. **Asset mapping** - `assets/` → `public/assets/`
5. **Static mapping** - Tries `static/` directory (e.g., `/hand/...` → `static/hand/...`)

## Architecture

### Files Modified/Created

1. **`src/shared/asset_config.ts`** (NEW)
   - Core configuration system
   - Exports: `getAssetPaths()`, `setAssetPaths()`, `resetAssetPaths()`, `getAssetPath()`

2. **`src/shared/hand_config.ts`** (MODIFIED)
   - Now imports from `asset_config.ts`
   - Uses dynamic functions instead of hard-coded constants
   - Maintains backward compatibility

3. **`src/frontend/rendering/hand_overlay.ts`** (MODIFIED)
   - Imports from centralized config
   - Removed hard-coded paths

4. **`src/server/utils/path_utils.ts`** (MODIFIED)
   - Enhanced to support `static/` directory mapping
   - Fixes the original "No such file or directory" error

## Migration Guide

### If you have custom hand images

**Before:**
```typescript
// Had to modify source code to change paths
```

**After:**
```typescript
import { setAssetPaths } from './src/shared/asset_config';

setAssetPaths({
    handDrawing: '/path/to/your/custom-hand.png'
});
```

### If you deploy to different environments

```typescript
import { setAssetPaths } from './src/shared/asset_config';

// Development
if (process.env.NODE_ENV === 'development') {
    setAssetPaths({
        handDrawing: '/local/hand.png'
    });
}

// Production
if (process.env.NODE_ENV === 'production') {
    setAssetPaths({
        handDrawing: 'https://cdn.mysite.com/assets/hand.png'
    });
}
```

## Benefits

1. **Flexibility** - Easily customize asset paths per project
2. **Environment-aware** - Different paths for dev/staging/production
3. **CDN Support** - Can use full URLs for CDN-hosted assets
4. **Cleaner Code** - No more hard-coded paths scattered throughout codebase
5. **Future-proof** - Easy to add new asset types to the configuration

## Example: Multi-tenant Application

```typescript
import { setAssetPaths } from './src/shared/asset_config';

function setupTenant(tenantId: string) {
    // Each tenant can have custom hand images
    setAssetPaths({
        handDrawing: `/tenants/${tenantId}/hand.png`,
        handEraser: `/tenants/${tenantId}/eraser.png`
    });
}

// Tenant A
setupTenant('tenant-a');
const whiteboardA = new ServerWhiteboard({ width: 1280, height: 720 });

// Tenant B  
setupTenant('tenant-b');
const whiteboardB = new ServerWhiteboard({ width: 1280, height: 720 });
```

## Testing

A test example is provided in `examples/test_hand_loading.ts`:

```bash
npx tsx examples/test_hand_loading.ts
```

This verifies that:
1. Hand images are loaded correctly
2. No "Failed to load hand image" errors occur
3. Frames are rendered with hand overlays

## 🛡️ Error Handling & Fallbacks

The engine is designed to be resilient against missing assets, preventing crashes during multi-hour exports.

### Silent Failures
When loading assets, you can enable `silentFailure` to log a warning instead of throwing an error.

```typescript
const options = {
    silentFailure: true // Defaults to true in most loaders
};
```

### Font Fallbacks
If a requested font (e.g., requested via `textConfig`) is missing or fails to load:
1. The engine logs a warning.
2. It automatically falls back to **Roboto** (which is bundled with the server-side package).
3. If Roboto is also missing, it falls back to the system's default **serif** or **sans-serif** font.

### Custom Hand Image Fallbacks
If a custom hand image URL is provided but fails to load:
1. The engine falls back to the **default drawing/eraser/push hand** defined in the configuration.
2. This ensures the animation still plays even if external CDNs are down.

## Future Enhancements
...
