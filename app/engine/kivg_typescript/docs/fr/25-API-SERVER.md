# API Server - Référence Complète

## 📋 Vue d'Ensemble

Cette page documente l'API complète du server KIVG pour l'export vidéo sous Node.js.

## 📦 Installation

```bash
npm install @kivg/engine
npm install canvas  # Dépendance requise pour Node.js
npm install ffmpeg-static  # FFmpeg pour export vidéo
```

## 🎬 Classe ServerWhiteboard

### Import

```typescript
import { ServerWhiteboard } from '@kivg/engine/server';
// Ou depuis le source
import { ServerWhiteboard } from './src/server/core/whiteboard';
```

### Constructor

```typescript
constructor(config: WhiteboardConfig)
```

**Paramètres :**
- `config`: Configuration identique au frontend

**Exemple :**
```typescript
const whiteboard = new ServerWhiteboard({
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [/* ... */]
});
```

### Méthodes Principales

#### prepare()

```typescript
async prepare(): Promise<void>
```

Précharge tous les assets nécessaires au rendu.

**Retourne :** Promise qui se résout quand prêt

**Exemple :**
```typescript
await whiteboard.prepare();
console.log('Prêt pour le rendu!');
```

#### renderToVideo()

```typescript
async renderToVideo(
  outputPath: string,
  options?: VideoExportOptions
): Promise<void>
```

Exporte l'animation en vidéo.

**Paramètres :**
- `outputPath`: Chemin du fichier de sortie
- `options`: Options d'export (optionnel)

**Retourne :** Promise qui se résout à la fin du rendu

**Exemple :**
```typescript
await whiteboard.renderToVideo('output.mp4', {
  resolution: '1080p',
  codec: 'libx264',
  quality: 23,
  parallelism: 'auto'
});
```

#### renderToGif()

```typescript
async renderToGif(
  outputPath: string,
  options?: GifExportOptions
): Promise<void>
```

Exporte l'animation en GIF.

**Paramètres :**
- `outputPath`: Chemin du fichier GIF
- `options`: Options d'export GIF

**Exemple :**
```typescript
await whiteboard.renderToGif('output.gif', {
  width: 800,
  height: 450,
  fps: 15,
  quality: 80
});
```

#### renderFrames()

```typescript
async renderFrames(
  outputDir: string,
  options?: FrameExportOptions
): Promise<void>
```

Exporte les frames individuels.

**Paramètres :**
- `outputDir`: Répertoire de sortie
- `options`: Options d'export

**Exemple :**
```typescript
await whiteboard.renderFrames('./frames', {
  format: 'png',
  quality: 90,
  pattern: 'frame-%04d.png'
});
```

#### dispose()

```typescript
dispose(): void
```

Libère toutes les ressources.

**Exemple :**
```typescript
whiteboard.dispose();
```

### Méthodes d'Information

#### getDuration()

```typescript
getDuration(): number
```

**Retourne :** Durée totale en secondes

#### getFrameCount()

```typescript
getFrameCount(): number
```

**Retourne :** Nombre total de frames

#### getScenes()

```typescript
getScenes(): ServerScene[]
```

**Retourne :** Liste de toutes les scènes

## 🎞️ Classe ServerScene

### Constructor

```typescript
constructor(config: SceneConfig, context: SceneContext)
```

### Méthodes

#### prepare()

```typescript
async prepare(): Promise<void>
```

Prépare la scène (charge assets, initialise layers).

#### renderFrame()

```typescript
async renderFrame(frameNumber: number): Promise<Buffer>
```

Rend un frame spécifique en buffer PNG.

**Paramètres :**
- `frameNumber`: Numéro du frame (0-indexed)

**Retourne :** Buffer contenant l'image PNG

**Exemple :**
```typescript
const scene = whiteboard.getScenes()[0];
const frameBuffer = await scene.renderFrame(150);
fs.writeFileSync('frame-150.png', frameBuffer);
```

#### renderFrameToCanvas()

```typescript
async renderFrameToCanvas(
  frameNumber: number,
  canvas: Canvas
): Promise<void>
```

Rend un frame sur un canvas existant.

**Paramètres :**
- `frameNumber`: Numéro du frame
- `canvas`: Instance de canvas node-canvas

#### getDuration()

```typescript
getDuration(): number
```

**Retourne :** Durée de la scène en secondes

#### getFrameCount()

```typescript
getFrameCount(): number
```

**Retourne :** Nombre de frames dans la scène

#### getLayers()

```typescript
getLayers(): ServerLayer[]
```

**Retourne :** Tous les layers de la scène

#### getLayerById()

```typescript
getLayerById(id: string): ServerLayer | undefined
```

**Retourne :** Le layer avec l'ID spécifié

#### getCameraAtFrame()

```typescript
getCameraAtFrame(frame: number): CameraState
```

**Retourne :** État de la caméra pour ce frame

#### generateAudioForFrame()

```typescript
generateAudioForFrame(frame: number): AudioSample[]
```

**Retourne :** Échantillons audio pour ce frame

#### dispose()

```typescript
dispose(): void
```

Libère les ressources de la scène.

## 🎨 Classe ServerLayer (Base)

### Méthodes Abstraites

```typescript
abstract class ServerLayer {
  abstract async prepare(): Promise<void>;
  abstract dispose(): void;
  abstract async render(
    canvas: Canvas,
    context: CanvasRenderingContext2D,
    frameNumber: number
  ): Promise<void>;
}
```

### Méthodes Communes

#### isVisibleAtFrame()

```typescript
isVisibleAtFrame(frame: number): boolean
```

**Retourne :** `true` si le layer est visible à ce frame

#### getOpacityAtFrame()

```typescript
getOpacityAtFrame(frame: number): number
```

**Retourne :** Opacité du layer à ce frame (0.0 à 1.0)

#### getTransformAtFrame()

```typescript
getTransformAtFrame(frame: number): Transform
```

**Retourne :** Transformation du layer à ce frame

## ⚙️ Options d'Export

### VideoExportOptions

```typescript
interface VideoExportOptions {
  // Résolution
  resolution?: '480p' | '720p' | '1080p' | '1440p' | '4k' | 'custom';
  width?: number;
  height?: number;
  
  // Codec et Qualité
  codec?: 'libx264' | 'libx265' | 'vp9' | 'h264_nvenc' | 'hevc_nvenc';
  quality?: number;          // CRF: 0-51 (18-28 recommandé)
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' 
         | 'medium' | 'slow' | 'slower' | 'veryslow';
  
  // Audio
  includeAudio?: boolean;
  audioCodec?: 'aac' | 'mp3' | 'opus';
  audioBitrate?: string;     // Ex: '192k', '320k'
  audioSampleRate?: number;  // Ex: 44100, 48000
  
  // Performance
  parallelism?: 'auto' | 'single' | number;
  workers?: number;
  
  // Avancé
  pixelFormat?: 'yuv420p' | 'yuv444p' | 'rgb24';
  frameRate?: number;        // Override du FPS
  gop?: number;              // Group of Pictures
  bufferSize?: string;       // Ex: '2M'
  
  // Hardware Acceleration
  hwAccel?: boolean;
  hwAccelDevice?: string;    // Ex: 'cuda', 'qsv', 'vaapi'
  
  // Callbacks
  onProgress?: (progress: ProgressInfo) => void;
  onFrameRendered?: (frame: number) => void;
  
  // FFmpeg
  extraFFmpegArgs?: string[];
  ffmpegPath?: string;
}
```

### GifExportOptions

```typescript
interface GifExportOptions {
  // Dimensions
  width?: number;
  height?: number;
  
  // Qualité
  fps?: number;              // FPS réduit recommandé (10-20)
  quality?: number;          // 0-100
  colors?: number;           // Max 256
  
  // Optimisation
  dither?: 'none' | 'bayer' | 'floyd_steinberg' | 'sierra2' | 'sierra2_4a';
  lossy?: number;            // 0-200 (plus haut = plus compressé)
  
  // Performance
  parallelism?: 'auto' | 'single' | number;
  
  // Callbacks
  onProgress?: (progress: ProgressInfo) => void;
}
```

### FrameExportOptions

```typescript
interface FrameExportOptions {
  // Format
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
  quality?: number;          // Pour jpg/webp (0-100)
  
  // Nommage
  pattern?: string;          // Ex: 'frame-%04d.png'
  startFrame?: number;       // Numéro de début
  
  // Sélection
  frameRange?: [number, number]; // [début, fin] inclusif
  frameStep?: number;        // Sauter N frames (défaut: 1)
  
  // Performance
  parallelism?: 'auto' | 'single' | number;
  
  // Callbacks
  onProgress?: (progress: ProgressInfo) => void;
  onFrameWritten?: (frame: number, path: string) => void;
}
```

### ProgressInfo

```typescript
interface ProgressInfo {
  currentFrame: number;
  totalFrames: number;
  progress: number;          // 0.0 à 1.0
  elapsedTime: number;       // En millisecondes
  estimatedTimeRemaining: number; // En millisecondes
  fps: number;               // FPS de rendu actuel
}
```

## 🎥 VideoExporter

### Classe VideoExporter

```typescript
import { VideoExporter } from '@kivg/engine/server';

class VideoExporter {
  constructor(
    whiteboard: ServerWhiteboard,
    outputPath: string,
    options: VideoExportOptions
  );
  
  async export(): Promise<void>;
  cancel(): void;
  getProgress(): ProgressInfo;
}
```

### Exemple d'Utilisation

```typescript
const exporter = new VideoExporter(
  whiteboard,
  'output.mp4',
  {
    resolution: '1080p',
    codec: 'libx264',
    quality: 23,
    onProgress: (info) => {
      console.log(`Progression: ${(info.progress * 100).toFixed(1)}%`);
      console.log(`FPS: ${info.fps.toFixed(1)}`);
      console.log(`Temps restant: ${(info.estimatedTimeRemaining / 1000).toFixed(0)}s`);
    }
  }
);

await exporter.export();
```

## 🔊 Classe AudioProcessor

### Constructor et Méthodes

```typescript
import { AudioProcessor } from './src/server/core/audio';

class AudioProcessor {
  constructor(config: AudioConfig);
  
  // Mixage
  mixTracks(tracks: AudioTrack[]): AudioBuffer;
  
  // Effets
  applyPanning(buffer: AudioBuffer, pan: number): AudioBuffer;
  applyVolume(buffer: AudioBuffer, volume: number): AudioBuffer;
  applyFade(
    buffer: AudioBuffer,
    fadeIn: number,
    fadeOut: number
  ): AudioBuffer;
  
  // Normalisation
  normalize(
    buffer: AudioBuffer,
    targetLoudness: number
  ): AudioBuffer;
  
  // Analyse
  analyzeLoudness(buffer: AudioBuffer): LoudnessInfo;
  detectPeaks(buffer: AudioBuffer): number[];
  
  // Export
  async exportToFile(
    buffer: AudioBuffer,
    outputPath: string,
    format: 'wav' | 'mp3' | 'aac' | 'opus'
  ): Promise<void>;
}
```

### AudioConfig

```typescript
interface AudioConfig {
  sampleRate: number;        // Ex: 44100, 48000
  channels: number;          // 1 (mono) ou 2 (stereo)
  bitDepth: number;          // 16, 24, ou 32
  
  // Normalisation
  normalization?: {
    enabled: boolean;
    targetLoudness: number;  // LUFS (ex: -16)
    truePeak: number;        // dBTP (ex: -1.0)
  };
  
  // Spatial Audio
  spatialAudio?: {
    enabled: boolean;
    panningStrength: number; // 0.0 à 1.0
    distanceAttenuation: boolean;
  };
}
```

## 🏊 WorkerPool

### Gestion du Pool de Workers

```typescript
import { WorkerPool } from './src/server/infra/worker_pool';

class WorkerPool {
  constructor(options: WorkerPoolOptions);
  
  async execute<T>(task: Task): Promise<T>;
  async executeAll<T>(tasks: Task[]): Promise<T[]>;
  
  getActiveWorkers(): number;
  getQueueSize(): number;
  
  async terminate(): Promise<void>;
}
```

### WorkerPoolOptions

```typescript
interface WorkerPoolOptions {
  workers: number;           // Nombre de workers
  workerScript: string;      // Chemin du script worker
  maxQueueSize?: number;     // Taille max de la queue
  timeout?: number;          // Timeout par tâche (ms)
  
  // Callbacks
  onWorkerError?: (error: Error, workerId: number) => void;
  onTaskComplete?: (task: Task, result: any) => void;
}
```

### Exemple

```typescript
const pool = new WorkerPool({
  workers: 4,
  workerScript: './render-worker.js',
  maxQueueSize: 100,
  onTaskComplete: (task, result) => {
    console.log(`Frame ${task.frameNumber} rendu`);
  }
});

// Rendre frames en parallèle
const tasks = [];
for (let i = 0; i < frameCount; i++) {
  tasks.push({
    type: 'render_frame',
    sceneId: 'scene-1',
    frameNumber: i
  });
}

const results = await pool.executeAll(tasks);

await pool.terminate();
```

## 📂 AssetCache

### Gestion du Cache d'Assets

```typescript
import { AssetCache } from './src/server/utils/asset_cache';

class AssetCache {
  constructor(config?: CacheConfig);
  
  // Images
  async loadImage(path: string): Promise<Image>;
  async preloadImages(paths: string[]): Promise<void>;
  
  // SVG
  async loadSvg(path: string): Promise<SVGElement>;
  async parseSvgString(svgContent: string): Promise<SVGElement>;
  
  // Polices
  async loadFont(path: string): Promise<Font>;
  
  // Gestion
  clear(): void;
  clearOldEntries(maxAge: number): void;
  
  // Statistiques
  getStats(): CacheStats;
  getSize(): number;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  maxSize?: number;          // Taille max en bytes
  maxAge?: number;           // Age max en ms
  preload?: string[];        // Assets à précharger
  
  // Stratégie
  strategy?: 'lru' | 'lfu' | 'fifo';
  
  // Options
  enableCompression?: boolean;
  persistToDisk?: boolean;
}
```

## 🎯 Utilitaires

### resolveAssetPath()

```typescript
import { resolveAssetPath } from './src/server/utils/path_utils';

function resolveAssetPath(path: string): string;
```

Résout un chemin d'asset en cherchant dans plusieurs emplacements.

**Exemple :**
```typescript
const imagePath = resolveAssetPath('/images/logo.png');
// Cherche dans :
// 1. Chemin absolu
// 2. Relatif au répertoire de travail
// 3. Dossier public/
// 4. URLs HTTP(S)
```

### loadImageFromUrl()

```typescript
import { loadImageFromUrl } from './src/server/utils/http_loader';

async function loadImageFromUrl(url: string): Promise<Image>;
```

Charge une image depuis une URL HTTP(S).

### parseSvg()

```typescript
import { parseSvg } from './src/server/utils/svg_utils';

async function parseSvg(svgContent: string): Promise<{
  width: number;
  height: number;
  paths: SVGPath[];
}>;
```

Parse un contenu SVG et extrait les paths.

## 📊 Monitoring

### ServerPerfMonitor

```typescript
import { ServerPerfMonitor } from './src/server/core/server_perf_monitor';

class ServerPerfMonitor {
  startTask(taskName: string): void;
  endTask(taskName: string): void;
  
  recordMetric(name: string, value: number): void;
  
  getStats(): PerfStats;
  getTaskStats(taskName: string): TaskStats;
  
  reset(): void;
  
  // Export
  exportToJSON(): string;
  exportToCSV(): string;
}
```

### Exemple

```typescript
const monitor = new ServerPerfMonitor();

monitor.startTask('render_video');

for (let i = 0; i < frameCount; i++) {
  monitor.startTask('render_frame');
  await scene.renderFrame(i);
  monitor.endTask('render_frame');
}

monitor.endTask('render_video');

const stats = monitor.getStats();
console.log(`Temps total: ${stats.totalTime}ms`);
console.log(`FPS moyen: ${stats.avgFPS}`);
console.log(`Temps par frame: ${stats.avgFrameTime}ms`);
```

## 🐛 Gestion d'Erreurs

### ErrorCodes

```typescript
enum ServerErrorCode {
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  INVALID_CONFIG = 'INVALID_CONFIG',
  FFMPEG_ERROR = 'FFMPEG_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  WORKER_ERROR = 'WORKER_ERROR',
  AUDIO_ERROR = 'AUDIO_ERROR',
  IO_ERROR = 'IO_ERROR'
}
```

### ServerError

```typescript
class ServerError extends Error {
  code: ServerErrorCode;
  details?: any;
  
  constructor(code: ServerErrorCode, message: string, details?: any);
}
```

### Exemple de Gestion

```typescript
try {
  await whiteboard.renderToVideo('output.mp4');
} catch (error) {
  if (error instanceof ServerError) {
    switch (error.code) {
      case ServerErrorCode.ASSET_NOT_FOUND:
        console.error('Asset manquant:', error.details.path);
        break;
      case ServerErrorCode.FFMPEG_ERROR:
        console.error('Erreur FFmpeg:', error.message);
        console.error('Logs:', error.details.logs);
        break;
      case ServerErrorCode.MEMORY_ERROR:
        console.error('Mémoire insuffisante:', error.details.required);
        break;
      default:
        console.error('Erreur:', error.message);
    }
  } else {
    console.error('Erreur inattendue:', error);
  }
}
```

## 📝 Exemples Pratiques

### Export Vidéo Basique

```typescript
import { ServerWhiteboard } from '@kivg/engine/server';

const whiteboard = new ServerWhiteboard({
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [/* ... */]
});

await whiteboard.prepare();
await whiteboard.renderToVideo('output.mp4');
```

### Export Haute Qualité

```typescript
await whiteboard.renderToVideo('output-hq.mp4', {
  resolution: '4k',
  codec: 'libx265',
  preset: 'slow',
  quality: 18,
  parallelism: 8,
  includeAudio: true,
  audioCodec: 'aac',
  audioBitrate: '320k'
});
```

### Export avec Progression

```typescript
await whiteboard.renderToVideo('output.mp4', {
  resolution: '1080p',
  parallelism: 'auto',
  onProgress: (info) => {
    const percent = (info.progress * 100).toFixed(1);
    const eta = (info.estimatedTimeRemaining / 1000).toFixed(0);
    console.log(`${percent}% - ETA: ${eta}s - FPS: ${info.fps.toFixed(1)}`);
  },
  onFrameRendered: (frame) => {
    if (frame % 30 === 0) {
      console.log(`Frame ${frame} rendu`);
    }
  }
});
```

### Export par Segments

```typescript
// Segment 1
await whiteboard.renderToVideo('part1.mp4', {
  frameRange: [0, 3000]
});

// Segment 2
await whiteboard.renderToVideo('part2.mp4', {
  frameRange: [3000, 6000]
});

// Concaténer avec FFmpeg
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
await execAsync(
  'ffmpeg -i concat:"part1.mp4|part2.mp4" -c copy final.mp4'
);
```

### Export GIF Optimisé

```typescript
await whiteboard.renderToGif('animation.gif', {
  width: 800,
  height: 450,
  fps: 15,
  quality: 85,
  colors: 256,
  dither: 'sierra2_4a',
  lossy: 80
});
```

## 📚 Ressources

### Documentation Connexe
- [Système Server](./32-SERVER.md)
- [Architecture](./02-ARCHITECTURE.md)
- [Configuration](./14-CONFIGURATION.md)

### Exemples de Code
- `examples/server-basic.ts`
- `examples/server-advanced.ts`
- `examples/server-parallel.ts`

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
