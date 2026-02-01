# Hand Configuration Migration

This document explains the migration from static hand presets to dynamic hand configuration from WhiteboardConfig.

## What Changed

Previously, the hand configuration system had hardcoded default presets for `drawing`, `eraser`, and `push` hands. These defaults are now removed, and all hand configurations must come from the `WhiteboardConfig.hands` property.

## Migration Guide

### Before (Old Approach - No Longer Supported)

```typescript
// Hand presets were automatically available
const config: WhiteboardConfig = {
  width: 800,
  height: 450,
  scenes: [
    {
      id: 'scene1',
      layers: [
        {
          id: 'layer1',
          type: 'text',
          // Hand would use default 'drawing' preset automatically
          handOverlay: { enabled: true, preset: 'drawing' }
        }
      ]
    }
  ]
};
```

### After (New Approach - Required)

```typescript
// You must define hand configs in WhiteboardConfig.hands
const config: WhiteboardConfig = {
  width: 800,
  height: 450,
  hands: {
    draw: {
      imageUrl: '/path/to/drawing-hand.png',
      scale: 0.80,
      offset: [-18, -20]
    },
    erase: {
      imageUrl: '/path/to/eraser.png',
      scale: 0.4,
      offset: [-150, -40]
    },
    push: {
      imageUrl: '/path/to/push-hand.png',
      scale: 0.35,
      offset: [-100, -80]
    }
  },
  scenes: [
    {
      id: 'scene1',
      layers: [
        {
          id: 'layer1',
          type: 'text',
          // Now uses the 'draw' preset from config.hands above
          handOverlay: { enabled: true, preset: 'drawing' }
        }
      ]
    }
  ]
};
```

## Hand Configuration Properties

Each hand preset in `WhiteboardConfig.hands` can have the following properties:

- **`imageUrl`** (string, required): Path to the hand image
- **`scale`** (number, optional): Scale factor for the hand (default varies by type)
- **`offset`** (array, optional): `[x, y]` offset from the animation point
- **`anchorPoint`** (array, optional): `[x, y]` anchor point (0-1 normalized)
- **`anchorTopLeft`** (boolean, optional): Whether to anchor at top-left

## Default Values

When not specified in the whiteboard config, the following defaults are used:

- **Drawing hand**: `scale: 0.80`, `offset: [-18, -20]`
- **Eraser hand**: `scale: 0.4`, `offset: [-150, -40]`
- **Push hand**: `scale: 0.35`, `offset: [-100, -80]`

## Examples

### Minimal Configuration

```typescript
const config: WhiteboardConfig = {
  width: 800,
  height: 450,
  hands: {
    draw: {
      imageUrl: '/assets/hand/drawing-hand.png',
      // scale and offset will use defaults
    }
  },
  scenes: [/* ... */]
};
```

### Custom Configuration

```typescript
const config: WhiteboardConfig = {
  width: 800,
  height: 450,
  hands: {
    draw: {
      imageUrl: '/assets/custom-hand.png',
      scale: 1.2,
      offset: [-25, -30],
      anchorPoint: [0.5, 0.5]
    },
    erase: {
      imageUrl: '/assets/custom-eraser.png',
      scale: 0.6,
      offset: [-100, -50]
    },
    push: {
      imageUrl: '/assets/custom-push.png',
      scale: 0.5,
      offset: [-60, -40]
    }
  },
  scenes: [/* ... */]
};
```

### Using Different Hands for Different Layers

```typescript
const config: WhiteboardConfig = {
  hands: {
    draw: { imageUrl: '/hand1.png', scale: 0.8, offset: [-18, -20] }
  },
  scenes: [
    {
      id: 'scene1',
      layers: [
        {
          id: 'text-layer',
          type: 'text',
          // Uses 'drawing' preset from config.hands
          handOverlay: { enabled: true, preset: 'drawing' }
        },
        {
          id: 'custom-layer',
          type: 'text',
          // Uses completely custom hand config (bypasses presets)
          handOverlay: {
            enabled: true,
            imageUrl: '/custom-hand.png',
            scale: 1.0,
            offset: [-20, -25]
          }
        }
      ]
    }
  ]
};
```

## Benefits of This Change

1. **No hardcoded defaults**: All hand assets are explicitly configured
2. **Flexibility**: Each whiteboard instance can use different hand images
3. **Consistency**: Hand configurations are part of the whiteboard config, making it easier to share and version
4. **Cleaner architecture**: Removes static state from the library

## Backward Compatibility

This is a **breaking change**. Existing code that relies on default hand presets will need to be updated to include explicit hand configurations in the `WhiteboardConfig.hands` property.

## See Also

- [examples/server_demo_test.ts](../examples/server_demo_test.ts) - Working example with hand configuration
- [src/shared/types/index.ts](../src/shared/types/index.ts) - Type definitions for `WhiteboardConfig.hands`
