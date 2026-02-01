# Kivg Engine (TypeScript)

A high-performance, professional whiteboard animation engine for both Browser and Node.js environments.

## 🚀 Key Features

### 🎨 Visuals & Rendering
- **Complex Animation Library**: 90+ professional entrance and exit animations (Drawing, Fading, Sliding, Zooming, Bouncing, etc.).
- **Smart Hand Overlay**: Realistic hand animations for drawing and erasing with customizable hand images and offsets.
- **Occlusion Culling**: Automatic detection of overlapping layers to "erase" hidden parts for a clean drawing look.
- **Multi-Scene Support**: Seamless transitions between scenes with customizable transition effects.
- **Kivg Vector Support**: High-precision rendering of vector graphics with path extraction and stroke-by-stroke animation.
- **Text-to-SVG**: Multi-language text rendering with professional stroke or typewriter animation modes.

### 🎵 Immersive Audio
- **Stereo & Spatial Panning**: All procedural sounds (drawing, typewriter) automatically pan based on their on-screen position.
- **Multi-Track Mixing**: Support for background music, voice-overs, and sound effects with independent volume control.
- **Audio Normalization**: Global loudness normalization for a professional final mix.

### 🎥 High-Quality Export (Node.js)
- **Parallel Rendering**: Multi-core support using worker pools to render frames up to 10x faster.
- **Memory Efficient**: Direct-to-disk frame writing to support hours of high-resolution video without memory leaks.
- **H.264 & H.265 (HEVC)**: Support for industry-standard codecs with hardware acceleration (NVENC) if available.
- **Embedded Subtitles**: Professional subtitle rendering directly into the video stream.

---

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

---

## 💻 Usage

### Browser (Frontend)
```typescript
import { Whiteboard } from './src/frontend/whiteboard/whiteboard';

const config = {
    containerId: 'whiteboard-container',
    width: 1920,
    height: 1080,
    scenes: [
        {
            id: 'scene-1',
            duration: 5,
            layers: [
                {
                    type: 'text',
                    textConfig: { text: "Hello World!", fontSize: 60 },
                    entrance_animation: { type: 'draw', duration: 2 }
                }
            ]
        }
    ]
};

const whiteboard = new Whiteboard(config);
whiteboard.play();
```

### Server (Video Export)
```typescript
import { ServerWhiteboard } from './src/server/whiteboard';

const whiteboard = new ServerWhiteboard(config);
await whiteboard.prepare();

await whiteboard.renderToVideo('output.mp4', {
    resolution: '1080p',
    parallelism: 'auto', // Uses all available CPU cores
    codec: 'libx265',    // H.265 for superior quality
    quality: 20          // High quality CRF
});
```

---

## 📘 Configuration API

### `WhiteboardConfig`
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | `number` | `1920` | Native design width of the whiteboard. |
| `height` | `number` | `1080` | Native design height of the whiteboard. |
| `fps` | `number` | `30` | Playback and export frame rate. |
| `background` | `string \| BackgroundConfig` | `#ffffff` | Background color or detailed grid configuration. |
| `hands` | `object` | - | Global presets for `draw`, `erase`, and `push` hand images. |
| `subtitles` | `object` | - | Global subtitle configuration (styling, positioning). |
| `camera` | `CameraSceneConfig` | - | Global camera settings and keyframes. |

### `SceneConfig`
| Parameter | Type | Description |
|-----------|------|-------------|
| `duration` | `number` | Total duration of the scene in seconds. |
| `transition` | `SceneTransitionConfig` | Transition animation to next scene (fade, slide, eraser, etc.). |
| `occlusionCulling` | `boolean` | Enable automatic erasing of overlapping layers. |
| `layers` | `AnyLayerConfig[]` | List of items to be displayed/animated in the scene. |

---

## 📁 Documentation

### 📚 French Documentation (Complete)
**[docs/fr/README.md](docs/fr/README.md)** - Complete French documentation covering all systems:
- **Frontend System**: All layer types, animations, managers
- **Editor System**: Visual scene editor and camera controls
- **Server System**: Video export, rendering, and audio processing
- **API References**: Complete API documentation for frontend and server
- **Guides**: Performance optimization and best practices

### 📖 English Documentation
- **[USER_GUIDE.md](documentation/USER_GUIDE.md)**: Comprehensive user guide and best practices.
- **[CAMERA_SYSTEM.md](documentation/CAMERA_SYSTEM.md)**: Complete guide to the camera system with zoom, pan, and keyframe animations.
- **[TYPEWRITER_MODE.md](documentation/TYPEWRITER_MODE.md)**: Guide to professional text animations.
- **[ARCHITECTURE_COMPARISON.md](documentation/ARCHITECTURE_COMPARISON.md)**: Deep dive into the engine's design.
- **[ASSET_CONFIGURATION.md](documentation/ASSET_CONFIGURATION.md)**: How to manage and load resources.
- **[archive/](documentation/archive/)**: Historical implementation summaries and bug fix records.

---

## 🤝 Development

```bash
# Start development server
npm start

# Run advanced export tests
npx ts-node --project tsconfig.examples.json examples/advanced_export_test.ts
```

---

## 📦 Publishing to npm

This package is configured to be published to npm automatically via GitHub Actions.

### Automated Publishing (Recommended)

1. **Create a release on GitHub**: When you create a new release, the package will be automatically published to npm.
2. **Manual workflow trigger**: You can also trigger the publish workflow manually from the Actions tab.

### Prerequisites

- An npm account with publishing rights
- `NPM_TOKEN` secret configured in GitHub repository settings:
  1. Generate an npm access token at https://www.npmjs.com/settings/[your-username]/tokens
  2. Add it as a repository secret named `NPM_TOKEN` in GitHub Settings > Secrets and variables > Actions

### Manual Publishing (Local)

```bash
# Ensure you're on the main branch with all changes committed
git checkout main
git pull

# Bump version (patch, minor, or major)
npm version patch

# Build and publish
npm publish

# Push the version tag
git push --follow-tags
```

---

## 📄 License
This project is part of the Griboo Engine eco-system. See the main repository for licensing information.
