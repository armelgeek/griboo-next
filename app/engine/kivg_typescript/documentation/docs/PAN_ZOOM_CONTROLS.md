# Canvas Pan & Zoom Controls

This document describes the pan and zoom functionality available in the KIVG Engine editor mode.

## Overview

The editor canvas supports intuitive pan (drag) and zoom controls similar to VideoScribe and other professional whiteboard animation tools. This allows you to navigate large canvases and focus on specific areas while editing.

## Features

### Zoom Controls
- **Zoom In/Out Buttons**: Located in the bottom-right corner
- **Zoom Level Display**: Shows current zoom percentage (e.g., "94%")
- **Zoom Range**: 10% to 500%
- **Visual Feedback**: Real-time zoom level updates

### Pan Controls
- **Space + Drag**: Hold spacebar and drag with mouse to pan
- **Middle Mouse Button**: Click and drag with middle mouse button to pan
- **Cursor Feedback**: Cursor changes to indicate pan mode

### Mouse Wheel Zoom
- **Scroll to Zoom**: Use mouse wheel to zoom in/out
- **Context-Aware**: Zooms towards the mouse cursor position

## How to Use

### Zooming

1. **Zoom In**:
   - Click the `+` button in the bottom-right corner, OR
   - Scroll up with your mouse wheel

2. **Zoom Out**:
   - Click the `-` button in the bottom-right corner, OR
   - Scroll down with your mouse wheel

3. **Reset Zoom (Fit to Screen)**:
   - Click on the zoom percentage display (e.g., "94%")
   - This will fit the entire canvas to your viewport

### Panning

1. **Space Key Method**:
   - Press and hold the `Space` key
   - Click and drag anywhere on the canvas
   - Release the `Space` key when done

2. **Middle Mouse Button Method**:
   - Click and hold the middle mouse button
   - Drag to pan the canvas
   - Release when done

### Help Icon

Click the blue `?` icon in the bottom-right corner to see a tooltip with all available controls.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space + Drag` | Pan canvas |
| `Mouse Wheel` | Zoom in/out |
| `Middle Mouse + Drag` | Pan canvas |

## Visual Controls

The zoom controls panel in the bottom-right corner includes:

```
┌──────────────────────┐
│  -   94%   +    ?    │
└──────────────────────┘
```

- **`-`**: Zoom out button
- **`94%`**: Current zoom level (click to reset)
- **`+`**: Zoom in button
- **`?`**: Help/instructions icon

## Technical Details

### Zoom Implementation
- Built on Konva.js stage scaling
- Smooth zoom transitions
- Center-point zoom for mouse wheel
- Viewport-center zoom for button controls

### Pan Implementation
- Native Konva.js draggable stage
- Cursor feedback during pan operations
- Space key and middle mouse button triggers

### Integration
The pan/zoom functionality is integrated into the `SceneCanvas` class:
- `src/editor/canvas/scene-canvas.ts`: Core canvas implementation
- `src/editor/canvas/zoom-controls.ts`: Zoom controls UI component

## Demo

The main demo (`index.html`) showcases the pan/zoom functionality with:
- An infinite canvas (2000x2000px)
- Multiple shapes positioned across the canvas
- Camera visualizations
- Instructions for using the controls

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Tips

1. **Explore Large Canvases**: Use zoom out to see the entire scene, then zoom in to focus on details
2. **Precise Positioning**: Zoom in when positioning elements for pixel-perfect placement
3. **Quick Navigation**: Use Space + Drag for fast canvas navigation
4. **Reset View**: Click the zoom percentage to quickly reset to fit-to-screen view

## Future Enhancements

Potential future improvements:
- Zoom to selection
- Pan boundaries (optional constraint)
- Touch gesture support for tablets
- Minimap overview
- Zoom presets (25%, 50%, 100%, 200%)

## See Also

- [Editor Documentation](../docs/EDITOR.md)
- [Camera System](../docs/CAMERA.md)
- [Keyboard Shortcuts](../docs/SHORTCUTS.md)
