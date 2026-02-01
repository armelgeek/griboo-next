# Camera Editor Documentation

## Overview

The Camera Editor provides a comprehensive solution for managing multiple cameras in large, immense scenes within the KIVG whiteboard animation engine.

## Features

### ✅ Multi-Camera Management
- Add unlimited cameras to a scene
- Remove cameras (except the default camera)
- Duplicate existing cameras
- Select and configure individual cameras

### ✅ Camera Properties
- **Name**: Custom label for each camera
- **Position**: X/Y coordinates (0-100%, normalized)
- **Dimensions**: Width and height in pixels
- **Zoom**: Zoom level (0.1x - 3.0x)
- **Lock State**: Lock/unlock camera to prevent accidental changes

### ✅ Large Scene Support
- Configure virtual canvas size (e.g., 4000×3000px for immense scenes)
- Multiple cameras can view different regions of the large canvas
- Zoom and pan across the entire virtual space
- **Pan/Drag Navigation**: 
  - Hold **Space** + drag to pan the canvas
  - Use middle mouse button to drag
  - Mouse wheel to zoom in/out (centered on cursor)
  - Zoom controls with center-point awareness

### ✅ Visual Editor
- Interactive camera viewports on the canvas
- Drag cameras to reposition
- Resize cameras using transform handles
- Visual feedback for selection and lock state

## API Reference

### SceneCanvas

Enhanced camera management methods:

```typescript
// Get all cameras
getAllCameras(): Camera[]

// Update camera properties
updateCamera(cameraId: string, updates: Partial<Camera>): void

// Duplicate a camera
duplicateCamera(cameraId: string): Camera | null

// Remove a camera
removeCamera(cameraId: string): void

// Select a camera
selectCamera(cameraId: string | null): void

// Pan and zoom controls
setZoom(zoom: number, centerX?: number, centerY?: number): void
getZoom(): number
zoomIn(factor?: number): void
zoomOut(factor?: number): void
fitToViewport(): void
setPan(x: number, y: number): void
getPan(): { x: number; y: number }
resetPan(): void
resetView(): void  // Reset zoom to 1.0 and pan to (0, 0)
```

### CameraControls

UI panel for camera management:

```typescript
// Initialize camera controls
const cameraControls = new CameraControls({
    container: HTMLElement,
    cameras: Camera[],
    selectedCameraId: string | null,
    virtualSize?: { width: number; height: number }
});

// Set callbacks
cameraControls.setCallbacks({
    onCameraSelect?: (cameraId: string | null) => void,
    onCameraAdd?: () => void,
    onCameraRemove?: (cameraId: string) => void,
    onCameraDuplicate?: (cameraId: string) => void,
    onCameraUpdate?: (cameraId: string, updates: Partial<Camera>) => void,
    onVirtualSizeUpdate?: (width: number, height: number) => void
});
```

### Camera Interface

```typescript
interface Camera {
    id: string;
    name?: string;
    position: { x: number; y: number };  // Normalized 0-1
    width?: number;   // Viewport width in pixels
    height?: number;  // Viewport height in pixels
    zoom?: number;    // Zoom level
    locked?: boolean; // Prevent modifications
    isDefault?: boolean; // Default camera (cannot be deleted)
}
```

## Usage Example

### Basic Setup

```typescript
import { SceneCanvas, CameraControls } from './src/editor/canvas/index';

// Create scene with large virtual size
const sceneConfig = {
    id: 'my-scene',
    width: 4000,  // Large canvas
    height: 3000,
    cameras: [
        {
            id: 'main-cam',
            name: 'Main View',
            position: { x: 0.5, y: 0.5 },
            width: 800,
            height: 450,
            zoom: 1,
            isDefault: true
        }
    ]
};

// Initialize scene canvas
const sceneCanvas = new SceneCanvas(container, sceneConfig);

// Initialize camera controls
const cameraControls = new CameraControls({
    container: controlPanel,
    cameras: sceneCanvas.getAllCameras(),
    selectedCameraId: null
});

// Wire up callbacks
cameraControls.setCallbacks({
    onCameraAdd: () => {
        const newCamera = {
            id: `cam-${Date.now()}`,
            name: 'New Camera',
            position: { x: 0.5, y: 0.5 },
            width: 800,
            height: 450,
            zoom: 1
        };
        sceneCanvas.addCamera(newCamera);
        cameraControls.updateCameras(sceneCanvas.getAllCameras());
    },
    onCameraUpdate: (cameraId, updates) => {
        sceneCanvas.updateCamera(cameraId, updates);
    }
});
```

### HTML Demo

See `camera-editor-demo.html` for a complete working example with:
- Sidebar camera controls panel
- Main canvas area
- Toolbar with zoom/export controls
- Multiple pre-configured cameras
- Large scene demonstration

## Demo Files

1. **camera-editor-demo.html** - Standalone HTML demo with embedded script
   - Demonstrates pan/drag navigation with Space key or middle mouse button
   - Mouse wheel zoom centered on cursor position
   - Reset view button to restore default zoom and pan
2. **examples/camera_editor_demo.ts** - TypeScript demo for the main app

## Architecture

### Components

1. **SceneCanvas** (`src/editor/canvas/scene-canvas.ts`)
   - Core canvas management
   - Camera CRUD operations
   - Layer management
   - Event coordination

2. **CameraControls** (`src/editor/canvas/camera-controls.ts`)
   - Pure HTML/CSS/JS UI panel
   - Camera list and selection
   - Property editors
   - Virtual size configuration

3. **EditorCamera** (`src/editor/canvas/konva-camera.ts`)
   - Visual camera viewport rendering
   - Interactive manipulation (drag, resize)
   - Selection and lock states

### Data Flow

```
User Action (UI)
    ↓
CameraControls (callbacks)
    ↓
SceneCanvas (update state)
    ↓
EditorCamera (visual update)
    ↓
Canvas Redraw
```

## Best Practices

1. **Always have a default camera** - The default camera cannot be deleted
2. **Use normalized positions** - Position coordinates are 0-1 (converted to pixels internally)
3. **Consider viewport sizes** - Match camera dimensions to your output resolution
4. **Lock important cameras** - Prevent accidental modifications to key camera setups
5. **Name your cameras** - Use descriptive names for complex multi-camera setups
6. **Use pan/drag for large scenes** - Hold Space or use middle mouse button to navigate large canvases efficiently
7. **Zoom to cursor** - Mouse wheel zoom centers on cursor position for precise navigation

## Troubleshooting

### Camera not visible
- Check that camera position is within 0-1 range
- Verify camera dimensions are reasonable (> 100px)
- Ensure camera is not locked when trying to manipulate

### Cannot delete camera
- Default cameras cannot be deleted
- Check if camera has `isDefault: true`

### Virtual size not updating
- Use the `onVirtualSizeUpdate` callback
- Call `sceneCanvas.updateScene({ width, height })`
- Cameras may need repositioning after size changes

## Contributing

When adding camera-related features:

1. Update `Camera` interface in `scene-canvas.ts`
2. Add corresponding UI controls in `camera-controls.ts`
3. Update EditorCamera visualization if needed
4. Add tests for new functionality
5. Update this documentation

## License

Part of the KIVG Animation Engine - See main repository LICENSE file.
