# Hand Configuration Flow - Visual Summary

## Before Fix ❌
```
User Config (WhiteboardConfig)
    ↓
    hands: {
        push: { imageUrl: 'custom.png', scale: 0.35, ... }
    }
    ↓
ServerWhiteboard Constructor
    ↓
    ❌ Config NOT applied to global registry
    ↓
ServerPushLayer created
    ↓
    ❌ No default preset set
    ↓
HandOverlayManager.initialize()
    ↓
    ❌ Uses hardcoded defaults
    ↓
RESULT: Custom config ignored, wrong hand image used
```

## After Fix ✅
```
User Config (WhiteboardConfig)
    ↓
    hands: {
        push: { imageUrl: 'custom.png', scale: 0.35, ... }
    }
    ↓
ServerWhiteboard Constructor
    ↓
    ✅ globalHandConfig.updatePreset('push', config.hands.push)
    ↓
    Global 'push' preset updated with custom values
    ↓
ServerPushLayer Constructor
    ↓
    ✅ config.handOverlay = { preset: 'push' } (if undefined)
    ↓
HandOverlayManager.initialize()
    ↓
    ✅ getHandOverlayConfigFromPreset('push') → returns custom config
    ↓
RESULT: Custom config applied, correct hand image used
```

## Code Locations

### 1. Apply Config (src/server/whiteboard.ts, line 31-42)
```typescript
// Apply hand presets if provided in config
if (config.hands) {
    if (config.hands.push) {
        globalHandConfig.updatePreset('push', config.hands.push);
    }
}
```

### 2. Set Default Preset (src/server/layers/push_layer.ts, line 14-17)
```typescript
// Set default handOverlay preset for push layers if not specified
if (config.handOverlay === undefined) {
    config.handOverlay = { preset: 'push' };
}
```

### 3. Resolve Preset (src/server/hand_overlay_manager.ts, line 29-36)
```typescript
// Handle presets if provided
if (config.preset) {
    const presetConfig = getHandOverlayConfigFromPreset(config.preset, config);
    if (presetConfig) {
        config = presetConfig;  // Uses updated global preset
    }
}
```

## Example Usage

### Before (not working)
```typescript
const config: WhiteboardConfig = {
    hands: {
        push: {
            imageUrl: 'my-custom-push-hand.png',
            scale: 0.5,
            offset: [-120, -90]
        }
    },
    scenes: [{
        layers: [{
            type: 'push',
            // ... push hand would use wrong image
        }]
    }]
}
```

### After (working)
```typescript
const config: WhiteboardConfig = {
    hands: {
        push: {
            imageUrl: 'my-custom-push-hand.png',  // ✅ This is now used!
            scale: 0.5,                           // ✅ This is now used!
            offset: [-120, -90]                   // ✅ This is now used!
        }
    },
    scenes: [{
        layers: [{
            type: 'push',
            // ... push hand now uses custom config automatically
        }]
    }]
}
```

## Testing

To verify the fix works:
1. Create a WhiteboardConfig with custom hands.push configuration
2. Create a ServerWhiteboard with this config
3. Add a push layer WITHOUT explicit handOverlay
4. The push layer should use the custom hand image from config.hands.push

## Compatibility

✅ Backward compatible - existing code continues to work
✅ Layers with explicit handOverlay still work as before
✅ Only affects layers without explicit handOverlay configuration
