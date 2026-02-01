# Système Server (Node.js)

## 📋 Vue d'Ensemble

Le **système server** (`src/server`) est l'implémentation Node.js du moteur KIVG, optimisée pour l'**export vidéo haute qualité** avec rendu parallèle multi-cœurs et traitement audio professionnel.

## 🎯 Objectifs

### Export Vidéo Professionnel
- **Haute qualité** : Export 1080p, 4K et au-delà
- **Performance** : Rendu parallèle utilisant tous les cœurs CPU
- **Codecs modernes** : H.264, H.265 (HEVC), VP9
- **Formats multiples** : MP4, WebM, MOV, GIF

### Traitement Audio
- **Mixage multi-pistes** : Musique, voix, effets sonores
- **Panoramique spatial** : Sons positionnés selon leur localisation visuelle
- **Normalisation** : Loudness normalization professionnelle
- **Synchronisation** : Timing audio/vidéo précis au frame

### Optimisations Serveur
- **Mémoire efficace** : Écriture directe sur disque, pas de buffer en RAM
- **Scalabilité** : Support de projets de plusieurs heures
- **Workers** : Pool de workers pour rendu parallèle
- **Cache** : Cache intelligent des assets et rendus

## 🏗️ Architecture

```
src/server/
├── core/                      # Classes de base
│   ├── whiteboard.ts          # ServerWhiteboard
│   ├── scene.ts               # ServerScene
│   ├── layer.ts               # ServerLayer (base)
│   ├── layer_factory.ts       # Factory pour créer layers
│   ├── camera.ts              # Système caméra server
│   ├── audio.ts               # Traitement audio
│   ├── hand_overlay.ts        # Overlay de main
│   ├── hand_overlay_manager.ts
│   ├── occlusion_manager.ts   # Occlusion culling
│   ├── svg_layer.ts           # Layer SVG server
│   └── timing_monitor.ts      # Monitoring du timing
│
├── layers/                    # Implémentations de layers
│   ├── image_layer.ts         # Layer image
│   ├── simple_image_layer.ts  # Image simple (sans animation)
│   ├── text_layer.ts          # Layer texte
│   ├── caption_layer.ts       # Sous-titres
│   ├── writing_layer.ts       # Écriture manuscrite
│   ├── path_layer.ts          # Chemins SVG
│   ├── svg_path_layer.ts      # SVG paths
│   ├── shape_layer.ts         # Formes géométriques
│   ├── eraser_layer.ts        # Effaceur
│   ├── rubber_layer.ts        # Gomme
│   ├── push_layer.ts          # Poussée
│   ├── morph_layer.ts         # Morphing
│   └── occlusion_layer.ts     # Occlusion
│
├── rendering/                 # Moteur de rendu
│   ├── transition_renderer.ts # Transitions entre scènes
│   └── background_renderer.ts # Rendu d'arrière-plans
│
├── animators/                 # Animateurs
│   ├── hybrid_video_animator.ts
│   ├── hybrid_layer_animator.ts
│   └── hybrid_animator.ts
│
├── infra/                     # Infrastructure
│   ├── video_exporter.ts      # Export vidéo
│   ├── worker_pool.ts         # Pool de workers
│   └── frame_writer.ts        # Écriture frames sur disque
│
└── utils/                     # Utilitaires
    ├── path_utils.ts          # Gestion des chemins
    ├── asset_cache.ts         # Cache d'assets
    ├── svg_utils.ts           # Utilitaires SVG
    └── http_loader.ts         # Chargement HTTP
```

## 📦 Classe Principale : ServerWhiteboard

### Installation et Import

```typescript
// Installation des dépendances
// npm install canvas ffmpeg-static @ffmpeg/ffmpeg

import { ServerWhiteboard } from './src/server';
import type { WhiteboardConfig } from './src/shared/types';
```

### Création et Configuration

```typescript
const config: WhiteboardConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#ffffff',
  scenes: [
    {
      id: 'scene-1',
      duration: 10,
      layers: [
        {
          type: 'text',
          textConfig: {
            text: "Hello World!",
            fontSize: 60,
            fontFamily: 'Arial',
            color: '#000000'
          },
          entrance_animation: {
            type: 'draw',
            duration: 2
          }
        }
      ]
    }
  ]
};

// Créer l'instance
const whiteboard = new ServerWhiteboard(config);
```

### Préparation

```typescript
// Précharger tous les assets nécessaires
await whiteboard.prepare();

// La préparation :
// - Charge toutes les images
// - Parse tous les SVG
// - Génère les polices en SVG
// - Initialise les caches
// - Valide la configuration
```

### Export Vidéo

```typescript
// Export basique
await whiteboard.renderToVideo('output.mp4');

// Export avec options
await whiteboard.renderToVideo('output.mp4', {
  // Résolution
  resolution: '1080p',        // '720p', '1080p', '4k', ou custom
  width: 1920,                // Override si resolution custom
  height: 1080,
  
  // Codec et qualité
  codec: 'libx264',           // 'libx264', 'libx265', 'vp9'
  quality: 23,                // CRF: 18-28 (plus bas = meilleure qualité)
  preset: 'medium',           // 'ultrafast' à 'veryslow'
  
  // Performance
  parallelism: 'auto',        // 'auto', 'single', ou nombre de workers
  workers: 4,                 // Nombre exact de workers
  
  // Audio
  includeAudio: true,
  audioCodec: 'aac',          // 'aac', 'mp3', 'opus'
  audioBitrate: '192k',
  
  // Avancé
  pixelFormat: 'yuv420p',     // Format de pixels
  hwAccel: true,              // Accélération matérielle (si dispo)
  extraFFmpegArgs: []         // Arguments ffmpeg supplémentaires
});
```

### Export GIF

```typescript
await whiteboard.renderToGif('output.gif', {
  // Dimensions
  width: 800,                 // Réduire pour taille fichier
  height: 450,
  
  // Qualité
  fps: 15,                    // FPS réduit pour GIF
  quality: 80,                // 0-100
  
  // Optimisation
  dither: 'sierra2_4a',       // Algorithme de dithering
  colors: 256,                // Nombre de couleurs (max 256)
  
  // Performance
  parallelism: 'auto'
});
```

### Export Frames Individuels

```typescript
await whiteboard.renderFrames('./frames', {
  // Format
  format: 'png',              // 'png', 'jpg', 'webp'
  quality: 90,                // Pour jpg/webp
  
  // Nommage
  pattern: 'frame-%04d.png',  // frame-0001.png, frame-0002.png, ...
  startFrame: 0,
  
  // Sélection
  frameRange: [0, 300],       // Frames 0 à 300 uniquement
  
  // Performance
  parallelism: 'auto'
});
```

### Nettoyage

```typescript
// Libérer ressources
whiteboard.dispose();

// Important pour :
// - Fermer les workers
// - Libérer la mémoire
// - Nettoyer les caches
// - Fermer les fichiers temporaires
```

## 🎬 ServerScene

### Fonctionnalités

```typescript
import { ServerScene } from './src/server';

class ServerScene {
  constructor(config: SceneConfig, context: SceneContext);
  
  // Préparation
  async prepare(): Promise<void>;
  
  // Rendu
  async renderFrame(frameNumber: number): Promise<Buffer>;
  async renderFrameToCanvas(
    frameNumber: number,
    canvas: Canvas
  ): Promise<void>;
  
  // Informations
  getDuration(): number;
  getFrameCount(): number;
  
  // Gestion des layers
  getLayers(): ServerLayer[];
  getLayerById(id: string): ServerLayer | undefined;
  
  // Caméra
  getCameraAtFrame(frame: number): CameraState;
  
  // Audio
  generateAudioForFrame(frame: number): AudioSample[];
  
  // Nettoyage
  dispose(): void;
}
```

### Exemple d'Utilisation

```typescript
const scene = new ServerScene(sceneConfig, context);
await scene.prepare();

// Rendre un frame spécifique
const frameBuffer = await scene.renderFrame(150);
fs.writeFileSync('frame-150.png', frameBuffer);

// Itérer sur tous les frames
const frameCount = scene.getFrameCount();
for (let i = 0; i < frameCount; i++) {
  const frame = await scene.renderFrame(i);
  // Traiter le frame
}

scene.dispose();
```

## 🎨 ServerLayer

### Classe de Base

```typescript
import { ServerLayer } from './src/server/core/layer';

abstract class ServerLayer {
  protected config: LayerConfig;
  protected context: RenderContext;
  
  // Lifecycle
  abstract async prepare(): Promise<void>;
  abstract dispose(): void;
  
  // Rendu
  abstract async render(
    canvas: Canvas,
    context: CanvasRenderingContext2D,
    frameNumber: number
  ): Promise<void>;
  
  // État
  isVisibleAtFrame(frame: number): boolean;
  getOpacityAtFrame(frame: number): number;
  getTransformAtFrame(frame: number): Transform;
  
  // Audio (optionnel)
  generateAudioForFrame?(frame: number): AudioSample[];
}
```

### Types de Layers Disponibles

#### 1. ImageLayer

```typescript
import { ImageLayer } from './src/server/layers/image_layer';

// Charge et anime des images
// - Support PNG, JPG, WebP
// - Animations d'entrée/sortie
// - Transformations
// - Cache automatique
```

#### 2. TextLayer

```typescript
import { TextLayer } from './src/server/layers/text_layer';

// Rendu de texte professionnel
// - Conversion texte → SVG → paths
// - Support multi-langues
// - Animations de dessin stroke-by-stroke
// - Mode typewriter avec sons
```

#### 3. PathLayer

```typescript
import { PathLayer } from './src/server/layers/path_layer';

// Dessins vectoriels
// - Paths SVG personnalisés
// - Animation stroke progressive
// - Main overlay automatique
// - Sons de dessin spatialisés
```

#### 4. ShapeLayer

```typescript
import { ShapeLayer } from './src/server/layers/shape_layer';

// Formes géométriques
// - Rectangle, cercle, ellipse, triangle
// - Polygones, étoiles
// - Fill et stroke personnalisés
// - Animations de dessin
```

#### 5. WritingLayer

```typescript
import { WritingLayer } from './src/server/layers/writing_layer';

// Écriture manuscrite
// - Simulation d'écriture à la main
// - Vitesse variable
// - Main overlay réaliste
// - Sons de stylo synchronisés
```

#### 6. SVGPathLayer

```typescript
import { SVGPathLayer } from './src/server/layers/svg_path_layer';

// Import de fichiers SVG complexes
// - Parse SVG complets
// - Extraction de paths
// - Animation path par path
// - Préserve les styles
```

#### 7. CaptionLayer

```typescript
import { CaptionLayer } from './src/server/layers/caption_layer';

// Sous-titres professionnels
// - Timing précis
// - Styles personnalisables
// - Positionnement flexible
// - Fond semi-transparent
```

#### 8. EraserLayer

```typescript
import { EraserLayer } from './src/server/layers/eraser_layer';

// Effacement de contenu
// - Efface les layers précédents
// - Main overlay avec gomme
// - Animation progressive
// - Sons d'effacement
```

#### 9. PushLayer

```typescript
import { PushLayer } from './src/server/layers/push_layer';

// Poussée d'objets
// - Déplace les layers existants
// - Main overlay animée
// - Mouvement fluide
// - Sons de poussée
```

#### 10. MorphLayer

```typescript
import { MorphLayer } from './src/server/layers/morph_layer';

// Morphing entre formes
// - Transition fluide entre 2 SVG
// - Interpolation de paths
// - Timing personnalisable
// - Préservation de la topologie
```

#### 11. OcclusionLayer

```typescript
import { OcclusionLayer } from './src/server/layers/occlusion_layer';

// Gestion des occlusions
// - Détecte les superpositions
// - Efface les parties cachées
// - Optimise le rendu
// - Cache les résultats
```

#### 12. RubberLayer

```typescript
import { RubberLayer } from './src/server/layers/rubber_layer';

// Gomme avancée
// - Effacement partiel
// - Masques de transparence
// - Animation de gomme
// - Réaliste
```

## 🎵 Système Audio

### AudioProcessor

```typescript
import { AudioProcessor } from './src/server/core/audio';

class AudioProcessor {
  constructor(config: AudioConfig);
  
  // Mixage
  mixTracks(tracks: AudioTrack[]): AudioBuffer;
  
  // Effets
  applyPanning(buffer: AudioBuffer, pan: number): AudioBuffer;
  applyVolume(buffer: AudioBuffer, volume: number): AudioBuffer;
  
  // Normalisation
  normalize(buffer: AudioBuffer, targetLoudness: number): AudioBuffer;
  
  // Export
  async exportToFile(
    buffer: AudioBuffer,
    outputPath: string,
    format: 'wav' | 'mp3' | 'aac'
  ): Promise<void>;
}
```

### Panoramique Spatial

```typescript
// Sons positionnés automatiquement selon leur position visuelle
interface SpatialAudioConfig {
  enabled: boolean;
  panningStrength: number;    // 0-1, intensité du panning
  distanceAttenuation: boolean; // Atténuation par distance
}

// Exemple : un son à gauche de l'écran sera panoramisé à gauche
const soundPosition = { x: 100, y: 500 };  // Gauche de l'écran
const pan = calculatePan(soundPosition, screenWidth);
// pan = -0.8 (gauche)
```

### Mixage Multi-Pistes

```typescript
const audioConfig = {
  tracks: [
    {
      type: 'background',
      src: '/audio/music.mp3',
      volume: 0.3,
      loop: true
    },
    {
      type: 'voiceover',
      src: '/audio/narration.wav',
      volume: 0.8,
      startTime: 2.0
    },
    {
      type: 'sfx',
      procedural: true,         // Sons générés
      volume: 0.5
    }
  ],
  masterVolume: 1.0,
  normalization: {
    enabled: true,
    targetLoudness: -16,        // LUFS
    truePeak: -1.0              // dBTP
  }
};
```

## 🎥 Rendu Parallèle

### Worker Pool

```typescript
import { WorkerPool } from './src/server/infra/worker_pool';

// Création du pool
const pool = new WorkerPool({
  workers: 4,                   // Nombre de workers
  workerScript: './worker.js',  // Script du worker
  maxQueueSize: 100             // Taille max de la queue
});

// Utilisation
const result = await pool.execute({
  type: 'render_frame',
  sceneId: 'scene-1',
  frameNumber: 150
});

// Fermeture
await pool.terminate();
```

### Stratégies de Parallélisation

```typescript
// Auto : Détecte le nombre de cœurs disponibles
parallelism: 'auto'

// Single : Pas de parallélisation (utile pour debug)
parallelism: 'single'

// Nombre fixe : Utilise N workers
parallelism: 4

// Le système distribue intelligemment :
// - Frames consécutifs sur différents workers
// - Load balancing automatique
// - Gestion des erreurs par worker
```

### Performance

```typescript
// Mesures typiques sur un CPU 8-cores :
// - Single-threaded : 5 FPS
// - 4 workers : 18 FPS (3.6× speedup)
// - 8 workers : 32 FPS (6.4× speedup)

// Facteurs d'impact :
// - Complexité de la scène
// - Nombre et type de layers
// - Résolution de sortie
// - Codec utilisé
```

## 🖼️ Rendu de Canvas

### node-canvas

Le server utilise `node-canvas` pour le rendu :

```typescript
import { createCanvas, loadImage } from 'canvas';

// Créer un canvas
const canvas = createCanvas(1920, 1080);
const ctx = canvas.getContext('2d');

// Dessiner
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 1920, 1080);

// Charger une image
const image = await loadImage('/path/to/image.png');
ctx.drawImage(image, 0, 0);

// Exporter
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('output.png', buffer);
```

### Différences avec le Frontend

```typescript
// Frontend (Browser)
// - Utilise HTMLCanvasElement natif
// - ImageData, ImageBitmap
// - requestAnimationFrame
// - GPU acceleration automatique

// Server (Node.js)
// - Utilise node-canvas (binding Cairo)
// - Canvas virtuel en mémoire
// - Contrôle manuel du timing
// - CPU rendering principalement
```

## 📂 Gestion des Assets

### Chargement

```typescript
import { resolveAssetPath } from './src/server/utils/path_utils';

// Résolution de chemins
const imagePath = resolveAssetPath('/images/logo.png');
// Cherche dans :
// 1. Chemin absolu
// 2. Relatif au projet
// 3. Dossier public/
// 4. URLs HTTP(S)

// Chargement avec cache
import { AssetCache } from './src/server/utils/asset_cache';

const cache = new AssetCache();
const image = await cache.loadImage('/images/logo.png');
// La deuxième fois, retourne depuis le cache
```

### Cache Intelligent

```typescript
interface CacheConfig {
  maxSize: number;              // Taille max en bytes
  maxAge: number;               // Age max en ms
  preload: string[];            // Assets à précharger
}

const cache = new AssetCache({
  maxSize: 500 * 1024 * 1024,   // 500 MB
  maxAge: 3600 * 1000,          // 1 heure
  preload: [
    '/images/logo.png',
    '/fonts/Arial.ttf',
    '/audio/music.mp3'
  ]
});

// Statistiques
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Size: ${stats.sizeInMB} MB`);
```

## 🎬 Transitions entre Scènes

### Types de Transitions

```typescript
import { TransitionRenderer } from './src/server/rendering/transition_renderer';

// Fade
{
  type: 'fade',
  duration: 1.0
}

// Slide
{
  type: 'slide',
  direction: 'left' | 'right' | 'up' | 'down',
  duration: 1.5
}

// Eraser
{
  type: 'eraser',
  duration: 2.0,
  handConfig: { /* ... */ }
}

// Zoom
{
  type: 'zoom',
  direction: 'in' | 'out',
  duration: 1.0
}

// Custom
{
  type: 'custom',
  renderFunction: (progress: number) => { /* ... */ }
}
```

### Rendu de Transition

```typescript
const renderer = new TransitionRenderer({
  fromScene: scene1,
  toScene: scene2,
  transition: {
    type: 'fade',
    duration: 1.0
  },
  fps: 30
});

await renderer.prepare();

// Rendre tous les frames de transition
const frameCount = renderer.getFrameCount();
for (let i = 0; i < frameCount; i++) {
  const frame = await renderer.renderFrame(i);
  // Écrire le frame
}
```

## 🎯 Optimisations Serveur

### Mémoire

```typescript
// Streaming de frames
// Au lieu de stocker tous les frames en mémoire :
for (let i = 0; i < totalFrames; i++) {
  const frame = await scene.renderFrame(i);
  await frameWriter.write(frame);  // Écrit immédiatement sur disque
  // frame est libéré de la mémoire
}

// Limite la mémoire utilisée indépendamment
// de la durée de la vidéo
```

### CPU

```typescript
// Cache de rendu
// Les layers qui ne changent pas sont cachés
interface RenderCache {
  enabled: boolean;
  staticLayers: boolean;        // Cache layers statiques
  backgrounds: boolean;         // Cache backgrounds
  maxCacheSize: number;
}

// Dirty tracking
// Seuls les layers modifiés sont re-rendus
```

### I/O

```typescript
// Écriture asynchrone
await Promise.all([
  frameWriter.write(frame1),
  frameWriter.write(frame2),
  frameWriter.write(frame3)
]);

// Buffer pool réutilisable
const bufferPool = new BufferPool({
  size: 10,
  bufferSize: 1920 * 1080 * 4  // RGBA
});
```

## 📊 Monitoring et Logs

### Performance Monitor

```typescript
import { ServerPerfMonitor } from './src/server/core/server_perf_monitor';

const monitor = new ServerPerfMonitor();

monitor.startTask('render_scene');
// ... rendu ...
monitor.endTask('render_scene');

// Statistiques
const stats = monitor.getStats();
console.log(`Avg frame time: ${stats.avgFrameTime}ms`);
console.log(`FPS: ${stats.fps}`);
console.log(`Memory: ${stats.memoryUsage}MB`);
```

### Logging

```typescript
import { Logger } from './src/server/utils/logger';

const logger = new Logger({
  level: 'info',                // 'debug', 'info', 'warn', 'error'
  outputFile: './render.log',
  console: true
});

logger.info('Starting render...', { frameCount: 300 });
logger.warn('Low memory detected', { available: '100MB' });
logger.error('Failed to load asset', { path: '/images/logo.png' });
```

## 🐛 Gestion d'Erreurs

### Try-Catch Pattern

```typescript
try {
  await whiteboard.renderToVideo('output.mp4');
} catch (error) {
  if (error.code === 'ASSET_NOT_FOUND') {
    console.error('Asset manquant:', error.assetPath);
  } else if (error.code === 'FFMPEG_ERROR') {
    console.error('Erreur FFmpeg:', error.message);
  } else {
    console.error('Erreur inconnue:', error);
  }
}
```

### Codes d'Erreur

```typescript
enum ErrorCode {
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  INVALID_CONFIG = 'INVALID_CONFIG',
  FFMPEG_ERROR = 'FFMPEG_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  WORKER_ERROR = 'WORKER_ERROR'
}
```

## 📝 Meilleures Pratiques

### 1. Préparation des Assets

```typescript
// Optimiser les images avant le rendu
// - Compresser PNG/JPG
// - Redimensionner à la taille utilisée
// - Convertir en format optimal

// Placer les assets localement
// Éviter les URLs HTTP pour la production
```

### 2. Configuration de Qualité

```typescript
// Pour prévisualisation rapide
{
  resolution: '720p',
  codec: 'libx264',
  preset: 'ultrafast',
  quality: 28,
  parallelism: 'auto'
}

// Pour production finale
{
  resolution: '1080p',
  codec: 'libx265',
  preset: 'slow',
  quality: 20,
  parallelism: 'auto'
}
```

### 3. Gestion de la Mémoire

```typescript
// Limiter la résolution pour longs projets
// Ou découper en segments

// Segment 1
await whiteboard.renderToVideo('part1.mp4', {
  frameRange: [0, 3000]
});

// Segment 2
await whiteboard.renderToVideo('part2.mp4', {
  frameRange: [3000, 6000]
});

// Concaténer avec FFmpeg
// ffmpeg -i concat:part1.mp4|part2.mp4 -c copy final.mp4
```

### 4. Tests Progressifs

```typescript
// 1. Tester avec 1 frame
await whiteboard.renderFrames('./test', {
  frameRange: [150, 151]
});

// 2. Tester avec 5 secondes
await whiteboard.renderToVideo('test.mp4', {
  frameRange: [0, 150]
});

// 3. Rendu complet
await whiteboard.renderToVideo('final.mp4');
```

## 🔧 Configuration FFmpeg

### Installation

```bash
# Automatique avec ffmpeg-static
npm install ffmpeg-static

# Ou installation système
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Télécharger depuis ffmpeg.org
```

### Configuration Avancée

```typescript
{
  ffmpegPath: '/usr/local/bin/ffmpeg',  // Chemin custom
  extraArgs: [
    '-tune', 'animation',               // Optimisé pour animation
    '-movflags', '+faststart',          // Streaming optimisé
    '-pix_fmt', 'yuv420p'              // Compatibilité max
  ],
  hwAccel: {
    enabled: true,
    device: 'cuda',                     // 'cuda', 'qsv', 'vaapi'
    encoder: 'h264_nvenc'               // Encodeur hardware
  }
}
```

## 📚 Ressources

### Exemples de Code
- `examples/server-basic.ts` - Export vidéo basique
- `examples/server-advanced.ts` - Options avancées
- `examples/server-parallel.ts` - Rendu parallèle
- `examples/server-audio.ts` - Mixage audio

### Documentation Connexe
- [Architecture](./02-ARCHITECTURE.md)
- [Système Whiteboard](./03-WHITEBOARD.md)
- [Configuration](./14-CONFIGURATION.md)
- [Performance](./23-PERFORMANCE.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
