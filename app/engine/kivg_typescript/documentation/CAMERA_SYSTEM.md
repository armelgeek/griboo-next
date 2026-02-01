# Camera System

## Overview

The camera system is a sophisticated 2D viewport and transformation system for whiteboard animations. It enables zoom, pan, and focus effects on a virtual canvas that can be larger than the output viewport, creating dynamic and engaging animations.

Think of it as a virtual camera filming a large whiteboard: you can zoom in on details, pan across the canvas, and smoothly move from one area to another—all while rendering to a fixed-size output.

## Architecture

The camera is implemented with **dual implementations** for consistency across environments:

- **Server-side**: `ServerCameraController` (`src/server/core/camera.ts`) - for high-quality video/GIF export
- **Client-side**: `CameraController` (`src/frontend/core/logic/camera.ts`) - for real-time browser preview
- **Shared utilities**: `src/shared/utils/camera_utils.ts` - common calculations and helpers

Both implementations maintain identical behavior to ensure what you see in the browser matches the final rendered output.

## Core Concepts

### Virtual Canvas

The camera system introduces the concept of a **virtual canvas**—a design space that can be much larger than your output resolution:

```typescript
const config: WhiteboardConfig = {
    width: 1280,        // Output resolution
    height: 720,
    scenes: [{
        id: 'scene1',
        camera: {
            virtualSize: { width: 4000, height: 3000 }  // Virtual canvas
        }
    }]
};
```

In this example:
- You design your animation on a 4000×3000 canvas
- The camera shows only a portion of this canvas at any time
- The final output is always 1280×720

This allows you to:
- Create complex scenes with many elements spread across a large area
- Pan across the scene without worrying about elements going off-screen
- Zoom in on specific details without loss of quality

### Coordinate System

The camera uses **normalized coordinates** (0.0 to 1.0) for positioning:

```typescript
{
    x: 0.5,  // Center horizontally (50% from left)
    y: 0.5   // Center vertically (50% from top)
}
```

Common positions:
- `{ x: 0.0, y: 0.0 }` - Top-left corner
- `{ x: 0.5, y: 0.5 }` - Center
- `{ x: 1.0, y: 1.0 }` - Bottom-right corner
- `{ x: 0.25, y: 0.75 }` - 25% from left, 75% from top

This normalized system makes it easy to position the camera independent of the actual canvas dimensions.

## Configuration Types

### CameraPosition

Normalized viewport center position:

```typescript
interface CameraPosition {
    x: number;  // 0.0 to 1.0 (left to right)
    y: number;  // 0.0 to 1.0 (top to bottom)
}
```

### CameraSize

Physical dimensions in pixels:

```typescript
interface CameraSize {
    width: number;   // Width in pixels
    height: number;  // Height in pixels
}
```

### CameraConfig

Individual camera state at a point in time:

```typescript
interface CameraConfig {
    zoom?: number;              // Magnification (1.0 = default, 2.0 = 2x zoom)
    position?: CameraPosition;  // Viewport center (normalized)
    size?: CameraSize;          // Viewport dimensions (auto-calculates zoom)
    targetLayerId?: string;     // Optional layer to focus on
    padding?: number;           // Padding around focused layer (default: 50px)
}
```

### CameraKeyframe

Animated camera movement with timing:

```typescript
interface CameraKeyframe extends CameraConfig {
    startTime?: number;           // When this keyframe begins (seconds)
    pauseTime?: number;           // Duration to hold this frame (seconds)
    transitionDuration?: number;  // Time to animate to next keyframe (seconds)
    easing?: string;              // Easing function (see below)
}
```

### CameraSceneConfig

Scene-level camera setup:

```typescript
interface CameraSceneConfig {
    initial?: CameraConfig;           // Starting camera position
    keyframes?: CameraKeyframe[];     // Sequence of camera movements
    virtualSize?: CameraSize;         // Virtual canvas size
    followMode?: 'manual' | 'active_layer' | 'hand';  // Automatic follow behavior
    snapToFirstKeyframe?: boolean;    // Auto-snap to first keyframe if it starts at t=0
}
```

## Camera Configuration Methods

The camera can be configured in three different ways:

### Method 1: Explicit Zoom + Position

Directly specify the zoom level and where the camera is looking:

```typescript
{
    zoom: 2.0,                    // 2x magnification
    position: { x: 0.3, y: 0.5 }  // Looking at 30% from left, center vertically
}
```

### Method 2: Focus on Target Layer

Automatically calculate zoom and position to fit a specific layer:

```typescript
{
    targetLayerId: 'my-shape',  // ID of the layer to focus on
    padding: 100                // Add 100px padding around the layer
}
```

This is perfect for automatically framing content without manual calculations.

### Method 3: Explicit Viewport Size

Specify the exact viewport dimensions (zoom is calculated automatically):

```typescript
{
    size: { width: 800, height: 450 },  // Show an 800×450 area of the canvas
    position: { x: 0.5, y: 0.5 }        // Centered
}
```

## Keyframe-Based Animation

The camera system uses keyframes to create smooth, timed animations:

```typescript
camera: {
    virtualSize: { width: 4000, height: 3000 },
    initial: {
        zoom: 0.5,
        position: { x: 0.5, y: 0.5 }
    },
    keyframes: [
        {
            startTime: 1.5,              // Trigger at 1.5 seconds
            targetLayerId: 'shape1',      // Focus on this layer
            padding: 100,
            transitionDuration: 1.5,      // Take 1.5 seconds to move here
            easing: 'ease_in_out'
        },
        {
            startTime: 5.0,              // Trigger at 5 seconds
            position: { x: 0.3, y: 0.7 },
            zoom: 2.0,
            pauseTime: 2.0,              // Hold this position for 2 seconds
            transitionDuration: 1.0,      // Then take 1 second to move to next
            easing: 'out_bounce'
        }
    ]
}
```

### Keyframe Timing

Each keyframe follows this timeline:

1. **Trigger**: At `startTime`, the keyframe becomes active
2. **Transition**: Over `transitionDuration`, the camera smoothly moves from the previous state to this keyframe's state
3. **Pause**: Once arrived, the camera holds for `pauseTime` (if specified)
4. **Next**: When the next keyframe's `startTime` is reached, repeat

### Transition Behavior

The transition includes a built-in **20% pause** at the start before easing begins. This creates a more natural feel—the camera briefly holds before starting to move.

## Follow Modes

The camera can automatically follow content using three modes:

### 1. Manual Mode (Default)

Camera movements are controlled entirely by keyframes:

```typescript
camera: {
    followMode: 'manual',  // or omit (this is the default)
    keyframes: [/* ... */]
}
```

### 2. Active Layer Mode

Camera automatically follows the currently animating layer:

```typescript
camera: {
    followMode: 'active_layer',
    padding: 150  // Keep 150px padding around the active layer
}
```

Perfect for educational content where you want the camera to automatically focus on whatever is being drawn or animated.

### 3. Hand Mode

Camera follows the hand position during drawing:

```typescript
camera: {
    followMode: 'hand'  // Auto-applies 2.0x zoom and follows hand
}
```

This creates an intimate "over the shoulder" perspective, great for drawing demonstrations.

## Easing Functions

The camera supports a rich set of easing functions for transitions:

### Basic Easings
- `linear` - Constant speed
- `ease_in` - Start slow, end fast
- `ease_out` - Start fast, end slow
- `ease_in_out` - Smooth acceleration and deceleration

### Cubic Easings
- `ease_in_cubic` - Strong acceleration
- `ease_out_cubic` - Strong deceleration
- `ease_in_out_cubic` - Strong S-curve

### Bounce Easings
- `in_bounce` - Bounce at start
- `out_bounce` - Bounce at end
- `in_out_bounce` - Bounce at both ends

### Elastic Easings
- `in_elastic` - Elastic wobble at start
- `out_elastic` - Elastic wobble at end
- `in_out_elastic` - Elastic wobble at both ends

### Back Easings
- `in_back` - Slight back-up before moving forward
- `out_back` - Slight overshoot at end
- `in_out_back` - Back-up at start and overshoot at end

### Exponential Easings
- `in_expo` - Exponential acceleration
- `out_expo` - Exponential deceleration
- `in_out_expo` - Exponential S-curve

## Complete Example

Here's a comprehensive example showing camera capabilities:

```typescript
const config: WhiteboardConfig = {
    width: 1280,
    height: 720,
    scenes: [{
        id: 'tutorial-scene',
        camera: {
            // Large virtual canvas
            virtualSize: { width: 5000, height: 3000 },
            
            // Start zoomed out to show the big picture
            initial: {
                zoom: 0.4,
                position: { x: 0.5, y: 0.5 }
            },
            
            keyframes: [
                // Zoom into title
                {
                    startTime: 1.0,
                    targetLayerId: 'title-text',
                    padding: 200,
                    transitionDuration: 2.0,
                    easing: 'ease_in_out'
                },
                
                // Pan to diagram 1
                {
                    startTime: 4.0,
                    targetLayerId: 'diagram-1',
                    padding: 150,
                    pauseTime: 3.0,  // Hold for 3 seconds
                    transitionDuration: 1.5,
                    easing: 'ease_out_cubic'
                },
                
                // Pan to diagram 2
                {
                    startTime: 9.0,
                    targetLayerId: 'diagram-2',
                    padding: 150,
                    pauseTime: 3.0,
                    transitionDuration: 1.5,
                    easing: 'ease_out_cubic'
                },
                
                // Zoom out to conclusion with bounce
                {
                    startTime: 14.0,
                    position: { x: 0.5, y: 0.8 },
                    zoom: 0.6,
                    transitionDuration: 2.0,
                    easing: 'out_bounce'
                }
            ]
        },
        layers: [
            {
                id: 'title-text',
                type: 'text',
                textConfig: {
                    text: 'Welcome to the Tutorial',
                    fontSize: 80
                },
                position: { x: 2500, y: 300 }
            },
            {
                id: 'diagram-1',
                type: 'kivg',
                svgUrl: '/diagrams/concept-1.svg',
                position: { x: 1500, y: 1500 }
            },
            {
                id: 'diagram-2',
                type: 'kivg',
                svgUrl: '/diagrams/concept-2.svg',
                position: { x: 3500, y: 1500 }
            }
        ]
    }]
};
```

## Advanced Features

### Parallax Depth Effects

The camera system supports depth-based parallax effects. Layers with different depth values move at different rates when the camera pans:

```typescript
{
    id: 'background',
    depth: 0.5,  // Moves slower (appears further away)
    // ...
},
{
    id: 'foreground',
    depth: 1.5,  // Moves faster (appears closer)
    // ...
}
```

### Snap to First Keyframe

If your first keyframe starts at time 0, you can snap to it immediately:

```typescript
camera: {
    snapToFirstKeyframe: true,
    keyframes: [
        { startTime: 0, zoom: 2.0, /* ... */ },
        // ...
    ]
}
```

This avoids the brief transition from the initial position to the first keyframe.

## Best Practices

### 1. Plan Your Virtual Canvas

Think about your scene layout before setting `virtualSize`:
- Too small: No room for camera movement
- Too large: May impact performance
- Just right: Enough space for all elements with comfortable padding

### 2. Use Normalized Positions

Always use normalized coordinates (0-1) for `position`. This makes your animation resolution-independent.

### 3. Add Padding to Focused Elements

When using `targetLayerId`, always add appropriate `padding`:
- Text: 100-200px
- Diagrams: 150-250px
- Complex scenes: 200-300px

### 4. Choose Appropriate Easing

Match easing to the emotion of the moment:
- **Professional/Technical**: `ease_in_out`, `ease_out_cubic`
- **Playful/Fun**: `out_bounce`, `out_elastic`
- **Dramatic**: `in_expo`, `out_expo`
- **Quick cuts**: `linear`

### 5. Test Transition Durations

Common durations:
- Quick cuts: 0.5-1.0 seconds
- Standard transitions: 1.0-2.0 seconds
- Dramatic reveals: 2.0-3.0 seconds
- Establishing shots: 3.0-5.0 seconds

### 6. Combine with Layer Animations

Time your camera keyframes to match layer entrance/exit animations for maximum impact:

```typescript
layers: [{
    id: 'diagram',
    entrance: { animation: 'fade_in', duration: 1.0, delay: 2.5 }
}],
camera: {
    keyframes: [{
        startTime: 2.0,  // Camera arrives 0.5s before diagram fades in
        targetLayerId: 'diagram'
    }]
}
```

## Transform Pipeline

Internally, the camera applies transformations in this order:

1. **Virtual Canvas** → Layer positions are defined on the large virtual canvas
2. **Camera Viewport** → The camera's zoom and position determine what portion is visible
3. **Parallax Depth** → Layers with different depth values are offset
4. **Output Rendering** → The visible portion is rendered to the output resolution

## Performance Considerations

- **Warmup**: The camera controller has a `warmup()` method that pre-resolves all keyframes. This is called automatically before rendering.
- **Settled State**: Use `isCameraSettled(time)` to check if the camera is moving, which can help optimize rendering decisions.
- **Keyframe Caching**: The controller caches calculations between keyframes to minimize overhead.

## Debugging Tips

### Visualize the Virtual Canvas

When designing, mentally map your virtual canvas:
```
Virtual: 4000×3000
Output: 1280×720

At zoom 1.0, output shows 1280×720 of the virtual canvas
At zoom 2.0, output shows 640×360 of the virtual canvas (2x magnification)
At zoom 0.5, output shows 2560×1440 of the virtual canvas (zoomed out)
```

### Check Keyframe Timing

Use `getCameraSettleTime(time)` to see when a transition completes:
```typescript
const settleTime = cameraController.getCameraSettleTime(5.0);
console.log(`Camera will finish moving at ${settleTime}s`);
```

### Inspect Current State

Use `getConfigAtTime(time, layers)` to see exactly what the camera is doing at any moment:
```typescript
const cameraState = cameraController.getConfigAtTime(5.5, layers);
console.log('Camera at 5.5s:', cameraState);
```

## Related Documentation

- **User Guide** (`USER_GUIDE.md`) - General animation concepts
- **Asset Configuration** (`ASSET_CONFIGURATION.md`) - Managing asset paths
- **Architecture** (`ARCHITECTURE_COMPARISON.md`) - Understanding server vs. client rendering

## Conclusion

The camera system is a powerful tool for creating professional, dynamic animations. By combining virtual canvases, keyframe animations, and smart follow modes, you can guide your viewer's attention exactly where you want it, when you want it.

Start simple with manual keyframes, then experiment with follow modes and advanced easing functions to find the style that works for your content.
