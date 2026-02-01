# Hand Configuration Fix

## Issue
The `hands` configuration in `WhiteboardConfig` was not being applied on the server-side. When users specified custom hand images, scales, and offsets in the whiteboard config like:

```typescript
const config: WhiteboardConfig = {
    hands: {
        push: {
            imageUrl: 'path/to/custom-push-hand.png',
            scale: 0.35,
            offset: [-100, -80]
        }
    },
    // ... scenes
}
```

The server-side rendering would ignore these settings and use default values instead.

## Root Cause
The frontend `Whiteboard` class called `updateHandPreset()` to apply the hands configuration to the global hand preset registry, but the server-side `ServerWhiteboard` class did not have equivalent logic.

## Solution

### 1. ServerWhiteboard Constructor
Added logic to apply hands configuration from WhiteboardConfig to the global hand preset registry:

```typescript
// src/server/whiteboard.ts
constructor(config: WhiteboardConfig, ...) {
    // Apply hand presets if provided in config
    if (config.hands) {
        if (config.hands.draw) {
            globalHandConfig.updatePreset('drawing', config.hands.draw);
        }
        if (config.hands.erase) {
            globalHandConfig.updatePreset('eraser', config.hands.erase);
        }
        if (config.hands.push) {
            globalHandConfig.updatePreset('push', config.hands.push);
        }
    }
    // ... rest of constructor
}
```

### 2. ServerPushLayer Default Preset
Added default preset selection for push layers when no explicit handOverlay is specified:

```typescript
// src/server/layers/push_layer.ts
constructor(config: LayerConfig) {
    // Set default handOverlay preset for push layers if not specified
    if (config.handOverlay === undefined) {
        config.handOverlay = { preset: 'push' };
    }
    
    super(config);
    // ... rest of constructor
}
```

## Flow
1. User creates WhiteboardConfig with custom `hands` settings
2. ServerWhiteboard constructor updates global hand presets
3. ServerPushLayer constructor sets default preset if none specified
4. HandOverlayManager.initialize() resolves the preset from global registry
5. Custom hand image and settings are applied during rendering

## Testing
This fix ensures that push layers (and other layer types) use the hand configurations specified in WhiteboardConfig instead of hardcoded defaults. The behavior now matches the frontend implementation.

## Consistency
This change brings server-side behavior in line with the frontend:
- Frontend: `src/frontend/whiteboard/whiteboard.ts` calls `updateHandPreset()`
- Server: `src/server/whiteboard.ts` now calls `globalHandConfig.updatePreset()`

Both now properly respect the `hands` configuration from WhiteboardConfig.
