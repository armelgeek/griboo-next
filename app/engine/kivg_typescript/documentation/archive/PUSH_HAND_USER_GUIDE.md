# Push Hand Position Fix - User Guide

## What Was Fixed
The push hand configuration in `examples/shared_config.ts` has been updated to use the correct offset value.

### Change Made
```typescript
// Before:
hands: {
    push: {
        imageUrl: 'static/hand/push_hand_real.png',
        scale: 0.35,
        offset: [-100, -80]  // Old default
    }
}

// After:
hands: {
    push: {
        imageUrl: 'static/hand/push_hand_real.png',
        scale: 0.35,
        offset: [-40, -32]  // Corrected value
    }
}
```

## How to Test
1. Run the demo generation:
   ```bash
   npm run generate:demo
   ```

2. Check the generated frames in `temp_frames/`:
   - Frames 0-89 show the push animation
   - The hand should be positioned correctly behind the pushed object

## Understanding the Configuration

### Global Hands Config
The global `hands` config in your whiteboard configuration defines default values for all layers:

```typescript
hands: {
    push: {
        imageUrl: 'static/hand/push_hand_real.png',
        scale: 0.35,
        offset: [-40, -32]
    }
}
```

### Layer-Specific Override
Individual layers can override these defaults:

```typescript
{
    id: 'my_push_layer',
    type: 'push',
    handOverlay: {
        enabled: true,
        scale: 0.4,  // Overrides the global scale of 0.35
        // offset is NOT specified, so it uses the global offset [-40, -32]
    },
    pushConfig: {
        // ... push configuration
    }
}
```

## Adjusting the Hand Position

### Offset Values
The offset `[-40, -32]` means:
- **X offset (-40)**: Moves hand 40 pixels to the LEFT from the contact point
- **Y offset (-32)**: Moves hand 32 pixels UP from the contact point

### To Adjust Position
If the hand position is still not perfect for your specific hand image:

1. **Move hand left/right**: Change the first value in offset
   - More negative = further left
   - Less negative (or positive) = further right
   - Example: `[-50, -32]` moves hand 10px more to the left

2. **Move hand up/down**: Change the second value in offset
   - More negative = further up
   - Less negative (or positive) = further down
   - Example: `[-40, -40]` moves hand 8px more upward

3. **Scale adjustment**: Change the scale value
   - Smaller scale (e.g., 0.3) = smaller hand
   - Larger scale (e.g., 0.4) = larger hand

### Testing Different Values
To test different offset/scale combinations:

1. Edit `examples/shared_config.ts` or your own config file
2. Run `npm run generate:demo` to render frames
3. Check frames in `temp_frames/` directory
4. Repeat until satisfied with the result

## Common Issues

### Hand appears in wrong position
- Check if a layer is overriding the offset with its own value
- Verify the `from` direction in `pushConfig` matches your intention
- Adjust the offset values as described above

### Hand appears too large/small
- Check if a layer is overriding the scale
- Adjust the global `hands.push.scale` value
- Remember: layer-specific scale overrides global scale

### Hand not visible
- Ensure `handOverlay.enabled` is not set to `false`
- Check that the hand image file exists at the specified path
- Verify the animation is actually playing (check progress < 1)

## Example Configurations

### Hand pushing from bottom (default in demo)
```typescript
pushConfig: {
    from: 'bottom',
    // Hand will be at bottom-center of object
}
hands: {
    push: {
        offset: [-40, -32]  // Positions hand behind object
    }
}
```

### Hand pushing from left
```typescript
pushConfig: {
    from: 'left',
    // Hand will be at left-center of object
}
hands: {
    push: {
        offset: [-50, -20]  // Adjust as needed
    }
}
```

### Hand pushing from right
```typescript
pushConfig: {
    from: 'right',
    // Hand will be at right-center of object
}
hands: {
    push: {
        offset: [10, -20]  // Positive X to move hand right
    }
}
```

## Support
If you need further adjustments, modify the offset values in your configuration and regenerate the frames to see the result.
