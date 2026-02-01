# Pan/Drag Feature Implementation

## Overview

This document describes the pan/drag navigation feature added to the KIVG scene canvas editor, enabling users to easily navigate large scenes (e.g., 4000×3000px canvases).

## Features

### 1. Pan/Drag Navigation

Users can now pan the canvas using two methods:

#### Method 1: Space Key + Drag
- Hold down the **Space** key
- Click and drag anywhere on the canvas
- Release to stop panning
- Visual feedback: cursor changes to "grab" when Space is pressed

#### Method 2: Middle Mouse Button
- Click and hold the **middle mouse button**
- Drag to pan the canvas
- Release to stop panning
- Visual feedback: cursor changes to "grabbing" during drag

### 2. Mouse Wheel Zoom

- Scroll up to zoom in
- Scroll down to zoom out
- Zoom is **centered on the cursor position** for precise navigation
- Zoom range: 10% to 500%

### 3. Zoom Controls

New zoom features:
- **Center-point aware zooming**: When zooming programmatically, you can specify a center point
- **Fit to viewport**: Automatically scales and centers the scene to fit the viewport
- **Reset view**: Restores zoom to 100% and pan to (0, 0)

## API Reference

### Pan Methods

```typescript
// Set pan position programmatically
setPan(x: number, y: number): void

// Get current pan position
getPan(): { x: number; y: number }

// Reset pan to origin (0, 0)
resetPan(): void
```

### Enhanced Zoom Methods

```typescript
// Set zoom with optional center point
setZoom(zoom: number, centerX?: number, centerY?: number): void

// Get current zoom level
getZoom(): number

// Zoom in by factor (default 1.2x), centered on viewport
zoomIn(factor?: number): void

// Zoom out by factor (default 1.2x), centered on viewport
zoomOut(factor?: number): void

// Fit scene to viewport with centering
fitToViewport(): void

// Reset both zoom and pan
resetView(): void
```

## Usage Examples

### Example 1: Programmatic Pan

```typescript
import { SceneCanvas } from './src/editor/canvas/scene-canvas';

const sceneCanvas = new SceneCanvas(container, config);

// Pan to specific position
sceneCanvas.setPan(100, 200);

// Get current position
const { x, y } = sceneCanvas.getPan();
console.log(`Current pan: (${x}, ${y})`);

// Reset pan to origin
sceneCanvas.resetPan();
```

### Example 2: Programmatic Zoom

```typescript
// Zoom to 150% centered on point (400, 300)
sceneCanvas.setZoom(1.5, 400, 300);

// Zoom in 20% centered on viewport center
sceneCanvas.zoomIn(1.2);

// Fit scene to viewport
sceneCanvas.fitToViewport();

// Reset everything
sceneCanvas.resetView();
```

### Example 3: Complete Demo Setup

```typescript
// Create scene with large canvas
const sceneConfig = {
    id: 'large-scene',
    width: 4000,
    height: 3000,
    cameras: [/* camera configs */]
};

const sceneCanvas = new SceneCanvas(container, sceneConfig);

// Add UI controls
document.getElementById('btn-fit').addEventListener('click', () => {
    sceneCanvas.fitToViewport();
});

document.getElementById('btn-reset').addEventListener('click', () => {
    sceneCanvas.resetView();
});

// Listen to zoom changes
sceneCanvas.setCallbacks({
    onZoomChange: (zoom) => {
        console.log(`Zoom changed to ${Math.round(zoom * 100)}%`);
    }
});
```

## User Interface

### Keyboard Shortcuts

- **Space + Drag**: Pan the canvas
- **Escape**: Deselect all

### Mouse Controls

- **Middle Mouse Button + Drag**: Pan the canvas
- **Mouse Wheel**: Zoom in/out (centered on cursor)
- **Left Click**: Select camera or layer

### Toolbar Buttons

The camera editor demo includes these buttons:

- **🔍-** : Zoom out
- **100%** : Reset zoom to 100%
- **🔍+** : Zoom in
- **📐 Ajuster** : Fit to viewport
- **🎯 Réinitialiser** : Reset view (zoom + pan)

## Implementation Details

### Cursor Management

The cursor changes to provide visual feedback:

- **default**: Normal state
- **grab**: Space key is pressed (ready to pan)
- **grabbing**: Actively dragging/panning

The implementation properly handles overlapping states (e.g., Space pressed + middle mouse button).

### Event Handling

Event listeners are properly managed:

1. Listeners are stored as instance properties
2. They're added during initialization
3. They're removed in the `destroy()` method to prevent memory leaks

### Zoom Center Point Algorithm

When zooming to a specific point:

```typescript
// Calculate the scene point under the cursor before zoom
const mousePointTo = {
    x: (cursorX - stage.x()) / oldZoom,
    y: (cursorY - stage.y()) / oldZoom
};

// Apply new zoom
stage.scale({ x: newZoom, y: newZoom });

// Adjust pan so the same scene point is under cursor
const newPos = {
    x: cursorX - mousePointTo.x * newZoom,
    y: cursorY - mousePointTo.y * newZoom
};
stage.position(newPos);
```

This ensures the point under the cursor stays fixed during zoom.

## Browser Compatibility

Tested and working on:
- Chrome/Edge (Chromium-based)
- Firefox
- Safari

Required browser features:
- ES6+ JavaScript
- HTML5 Canvas
- KeyboardEvent.code
- Mouse button detection

## Performance Considerations

1. **Batch Drawing**: Uses `stage.batchDraw()` instead of `stage.draw()` for better performance
2. **Event Throttling**: Mouse wheel zoom is not throttled by default, but you can add throttling if needed
3. **Memory Management**: Event listeners are properly cleaned up to prevent memory leaks

## Troubleshooting

### Pan not working
- Ensure you're holding Space key or middle mouse button
- Check that the canvas container has focus
- Verify stage is not locked or disabled

### Zoom not centered correctly
- This usually happens if the container size is incorrect
- Ensure the container has explicit width/height set

### Cursor not changing
- Check CSS cursor property isn't being overridden
- Verify event handlers are attached correctly

## Future Enhancements

Possible improvements:

1. Touch gesture support for mobile (pinch to zoom, two-finger pan)
2. Zoom to selection (zoom to fit selected cameras/layers)
3. Pan animation/easing for smoother navigation
4. Minimap overview for large scenes
5. Zoom limits per-scene configuration

## License

Part of the KIVG Animation Engine. See main repository LICENSE.
