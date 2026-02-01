# Kivg Engine User Guide

This guide provides technical details and best practices for creating animations with the Kivg Engine.

## 🛠️ Configuration Overview

The Kivg Engine is driven by a JSON-serializable configuration object.

### Whiteboard Dimensions
The `width` and `height` properties define the "design space". All coordinates in layers are relative to this space.
- Default: `1920x1080` (16:9)
- For high-resolution exports, the engine automatically scales this design space to the target resolution (e.g., 720p, 1080p, 4K).

## 🎬 Scenes & Transitions

Animations are organized into scenes. When one scene ends, a transition can be applied to reveal the next one.

### Supported Transitions
- `fade`: Simple cross-fade between scenes.
- `slide_left`, `slide_right`, `slide_up`, `slide_down`: Current scene slides out while next scene slides in.
- `wipe_left`, `wipe_right`, `wipe_up`, `wipe_down`: Next scene wipes over the current one.
- `iris`: Typical circular expansion from the center.
- `eraser`: A realistic hand-eraser effect that "wipes away" the old scene.
  - Options: `eraserPattern` ('diagonal', 'horizontal', 'vertical'), `handImage`, `handScale`.

## 🎨 Layer Types

### 1. Kivg Layer (Vector Animation)
The core of the engine. Use this for stroke-by-stroke drawing animations.
- **`pathData`**: Compressed SVG-like path data.
- **`svgUrl`**: Path to an external SVG file for processing.
- **Animations**: `draw` (realistic stroke animation), `fade_in`, `reveal`.

### 2. Push Layer
Specialized for "pushing" items onto the screen.
- **`from`**: 'left', 'right', 'top', or 'bottom'.
- **`pushDuration`**: Controls the speed of the entry.
- **`pushEasing`**: Supports standard CSS-like easings (e.g., `ease_out_back`).

### 3. Text & Subtitles
- **Standard Text**: Basic canvas text rendering.
- **Text-to-SVG**: Professional rendering using fonts. Supports `typewriter` and `stroke` modes.
- **Global Subtitles**: Configure in `WhiteboardConfig.subtitles`. These are rendered on top of everything.

## 🎵 Audio System

The engine supports advanced audio mixing and procedural sound generation.

### Spatial Audio
Procedural sounds (like drawing or typewriter clicks) automatically calculate their **pan** value based on the horizontal position of the hand/text on the whiteboard.
- **Left side**: Sound leans towards the left channel.
- **Right side**: Sound leans towards the right channel.

### Audio Normalization
When exporting video, set `normalize: true` to ensure the final audio mix hits a professional loudness level without clipping.

## 🎥 Server-side Export (Node.js)

### Parallel Rendering
Uses a worker pool to process frames across multiple CPU cores.
- **`parallelism: 'auto'`**: Recommended. Matches your CPU thread count.
- **`parallelism: 1`**: Sequential rendering (safer for debugging).

### Codecs and Quality
- **`libx264`**: Fast, widely compatible.
- **`libx265`**: Slower, much smaller file size, superior quality.
- **`quality` (CRF)**: `18-23` is recommended for high quality. Lower values = better quality but larger files.

---

## 💡 Best Practices
1. **Use Parallelism**: Always use `parallelism: 'auto'` for faster exports on the server.
2. **Audio Tracks**: Use the `audioTracks` option in `renderToVideo` to add high-quality WAV files for voice-overs instead of MP3s to avoid compression artifacts.
3. **Occlusion Culling**: Enable `occlusionCulling: true` on scenes with many overlapping objects to avoid "ghosting" effects when drawing.
