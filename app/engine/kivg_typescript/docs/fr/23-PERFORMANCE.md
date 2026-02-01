# Guide de Performance

## 📋 Vue d'Ensemble

Ce guide présente les meilleures pratiques et optimisations pour maximiser les performances du moteur KIVG dans les environnements frontend et server.

## 🎨 Performance Frontend (Navigateur)

### Optimisation du Rendu Canvas

#### 1. Utilisation du Cache de Canvas

```typescript
// Activer le cache pour les layers statiques
{
  type: 'image',
  src: '/images/background.png',
  cacheEnabled: true  // Cache le rendu
}
```

**Gains :** 3-5× plus rapide pour les éléments statiques

#### 2. Limitation du FPS

```typescript
// Pour les prévisualisations, réduire le FPS
const whiteboard = new Whiteboard({
  fps: 24,  // Au lieu de 60
  // ...
});
```

**Gains :** 40% de réduction CPU pour 24 FPS vs 60 FPS

#### 3. Occlusion Culling

```typescript
{
  scenes: [{
    occlusionCulling: true,  // Activer par défaut
    layers: [/* ... */]
  }]
}
```

**Gains :** 20-40% selon la complexité de la scène

### Optimisation des Assets

#### 1. Compression d'Images

```bash
# Optimiser PNG
pngquant image.png --quality 80-95 --output image-opt.png

# Optimiser JPG
jpegoptim --max=85 image.jpg

# Convertir en WebP
cwebp -q 85 image.png -o image.webp
```

**Gains :** 50-80% de réduction de taille

#### 2. Lazy Loading

```typescript
{
  preload: false,  // Charger à la demande
  layers: [
    {
      type: 'image',
      src: '/images/large.png',
      lazyLoad: true
    }
  ]
}
```

**Gains :** Démarrage 2-3× plus rapide

#### 3. Sprites et Atlases

```typescript
// Utiliser un atlas d'images au lieu de fichiers séparés
const atlas = {
  src: '/images/atlas.png',
  frames: {
    icon1: { x: 0, y: 0, w: 32, h: 32 },
    icon2: { x: 32, y: 0, w: 32, h: 32 }
  }
};
```

**Gains :** 60% de réduction de requêtes HTTP

### Optimisation Mémoire

#### 1. Libération des Ressources

```typescript
// Libérer les ressources après usage
whiteboard.on('scenechange', (newScene, oldScene) => {
  oldScene.dispose();  // Libère la mémoire
});
```

#### 2. Limitation de la Résolution

```typescript
// Pour mobile ou faible puissance
const whiteboard = new Whiteboard({
  width: 1280,   // Au lieu de 1920
  height: 720,   // Au lieu de 1080
  // ...
});
```

**Gains :** 56% de réduction mémoire (720p vs 1080p)

#### 3. Pool d'Objets

```typescript
// Réutiliser les objets au lieu de créer/détruire
class ObjectPool {
  private pool: any[] = [];
  
  acquire() {
    return this.pool.pop() || this.create();
  }
  
  release(obj: any) {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

### Optimisation des Animations

#### 1. Réduction de Complexité

```typescript
// Éviter les animations complexes sur mobile
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

{
  entrance_animation: {
    type: isMobile ? 'fadeIn' : 'bounceIn',  // Simple sur mobile
    duration: 1
  }
}
```

#### 2. Hardware Acceleration

```typescript
// Forcer l'accélération GPU
canvas.style.transform = 'translateZ(0)';
canvas.style.willChange = 'transform';
```

#### 3. RequestAnimationFrame Optimization

```typescript
// Utiliser RAF intelligent
let rafId: number;
let lastTime = 0;
const targetFPS = 30;
const frameDelay = 1000 / targetFPS;

function render(time: number) {
  rafId = requestAnimationFrame(render);
  
  const delta = time - lastTime;
  if (delta < frameDelay) return;
  
  lastTime = time - (delta % frameDelay);
  
  // Rendu ici
  whiteboard.renderFrame();
}
```

### Monitoring des Performances

#### 1. Performance API

```typescript
// Mesurer le temps de rendu
const perfMonitor = whiteboard.getPerformanceMonitor();

console.log(`FPS: ${perfMonitor.getFPS()}`);
console.log(`Temps de rendu: ${perfMonitor.getRenderTime()}ms`);
console.log(`Frames droppés: ${perfMonitor.getDroppedFrames()}`);
```

#### 2. Memory Profiling

```typescript
// Surveiller la mémoire
if (performance.memory) {
  const used = performance.memory.usedJSHeapSize / 1048576;
  const total = performance.memory.totalJSHeapSize / 1048576;
  console.log(`Mémoire: ${used.toFixed(0)}MB / ${total.toFixed(0)}MB`);
}
```

#### 3. Chrome DevTools

```typescript
// Activer les markers pour DevTools
performance.mark('whiteboard-start');
await whiteboard.prepare();
performance.mark('whiteboard-ready');
performance.measure('preparation', 'whiteboard-start', 'whiteboard-ready');
```

## 🖥️ Performance Server (Node.js)

### Optimisation du Rendu Parallèle

#### 1. Configuration Optimale des Workers

```typescript
import os from 'os';

const cpuCount = os.cpus().length;

// Laisser 1-2 cœurs pour le système
const workers = Math.max(1, cpuCount - 2);

await whiteboard.renderToVideo('output.mp4', {
  parallelism: workers
});
```

**Gains :** 6-8× plus rapide sur 8 cœurs

#### 2. Batch Processing

```typescript
// Rendre par batches de frames
const batchSize = 100;
for (let i = 0; i < totalFrames; i += batchSize) {
  const end = Math.min(i + batchSize, totalFrames);
  await whiteboard.renderFrames('./frames', {
    frameRange: [i, end]
  });
}
```

**Gains :** Meilleure gestion mémoire pour longs projets

#### 3. Worker Pool Sizing

```typescript
// Adapter selon la complexité
const complexity = calculateSceneComplexity(scenes);

const workers = complexity > 0.7 
  ? Math.max(1, cpuCount - 2)  // Scène complexe
  : Math.ceil(cpuCount / 2);    // Scène simple
```

### Optimisation Mémoire Server

#### 1. Streaming de Frames

```typescript
// Écrire frames directement sur disque
for (let i = 0; i < frameCount; i++) {
  const frame = await scene.renderFrame(i);
  await writeFrameToDisk(frame, i);
  // frame est immédiatement libéré
}
```

**Gains :** Mémoire constante indépendante de la durée

#### 2. Asset Cache Intelligent

```typescript
const cache = new AssetCache({
  maxSize: 500 * 1024 * 1024,  // 500 MB
  maxAge: 3600 * 1000,          // 1 heure
  strategy: 'lru'               // Least Recently Used
});
```

#### 3. Garbage Collection

```typescript
// Forcer le GC périodiquement pour longs rendus
if (global.gc && frameNumber % 1000 === 0) {
  global.gc();
}
```

Lancer Node avec : `node --expose-gc script.js`

### Optimisation des Codecs

#### 1. Prévisualisation Rapide

```typescript
// Configuration ultrafast pour tests
{
  codec: 'libx264',
  preset: 'ultrafast',
  quality: 28,
  resolution: '720p'
}
```

**Gains :** 10× plus rapide que "slow"

#### 2. Production Optimisée

```typescript
// Balance qualité/vitesse
{
  codec: 'libx264',
  preset: 'medium',
  quality: 23,
  resolution: '1080p'
}
```

#### 3. Hardware Acceleration

```typescript
// Utiliser NVENC si disponible (GPU NVIDIA)
{
  codec: 'h264_nvenc',
  quality: 23,
  hwAccel: true,
  hwAccelDevice: 'cuda'
}
```

**Gains :** 3-5× plus rapide avec GPU

### Optimisation FFmpeg

#### 1. Paramètres Optimaux

```typescript
{
  extraFFmpegArgs: [
    '-tune', 'animation',        // Optimisé pour animation
    '-movflags', '+faststart',   // Streaming optimisé
    '-threads', '0',             // Utiliser tous les threads
    '-preset', 'medium',
    '-crf', '23'
  ]
}
```

#### 2. Buffers et GOP

```typescript
{
  gop: 250,                      // Group of Pictures
  bufferSize: '2M',              // Buffer FFmpeg
  extraFFmpegArgs: [
    '-bf', '2',                  // B-frames
    '-g', '250'                  // GOP size
  ]
}
```

### Optimisation I/O

#### 1. SSD vs HDD

- **SSD** : 5-10× plus rapide pour l'écriture de frames
- Utiliser SSD pour frames temporaires
- HDD acceptable pour fichier final

#### 2. RAM Disk (Optionnel)

```bash
# Linux - Créer RAM disk pour frames temporaires
mkdir /mnt/ramdisk
mount -t tmpfs -o size=4G tmpfs /mnt/ramdisk
```

**Gains :** 20-30× plus rapide que HDD

#### 3. Écriture Asynchrone

```typescript
import { promises as fs } from 'fs';

// Écrire de manière asynchrone
const writePromises = [];
for (let i = 0; i < frameCount; i++) {
  const frame = await scene.renderFrame(i);
  writePromises.push(
    fs.writeFile(`frame-${i}.png`, frame)
  );
  
  // Limiter les écritures en parallèle
  if (writePromises.length >= 10) {
    await Promise.all(writePromises);
    writePromises.length = 0;
  }
}
```

### Profiling Server

#### 1. Node.js Profiler

```bash
# Profiler avec clinic.js
npx clinic doctor -- node render.js
npx clinic flame -- node render.js
npx clinic bubbleprof -- node render.js
```

#### 2. Memory Leak Detection

```bash
# Détecter les fuites mémoire
node --inspect render.js

# Dans Chrome DevTools:
# chrome://inspect
# Prendre heap snapshots à intervalles réguliers
```

#### 3. Custom Monitoring

```typescript
import { ServerPerfMonitor } from './src/server/core/server_perf_monitor';

const monitor = new ServerPerfMonitor();

monitor.startTask('render');
await whiteboard.renderToVideo('output.mp4');
monitor.endTask('render');

const stats = monitor.getStats();
console.log(`Temps total: ${stats.totalTime}ms`);
console.log(`FPS: ${stats.avgFPS}`);
console.log(`Mémoire pic: ${stats.peakMemory}MB`);
```

## 📊 Benchmarks

### Frontend (Navigateur)

| Scénario | Chrome | Firefox | Safari | Mobile |
|----------|--------|---------|--------|--------|
| Simple (5 layers) | 60 FPS | 60 FPS | 60 FPS | 30 FPS |
| Moyen (20 layers) | 60 FPS | 55 FPS | 50 FPS | 24 FPS |
| Complexe (50 layers) | 45 FPS | 40 FPS | 35 FPS | 15 FPS |

### Server (Node.js)

| Configuration | FPS Rendu | Temps 1min vidéo |
|---------------|-----------|------------------|
| Single-thread | 5 FPS | 6 minutes |
| 4 workers | 18 FPS | 1.7 minutes |
| 8 workers | 32 FPS | 56 secondes |
| 8 workers + NVENC | 120 FPS | 15 secondes |

## 🎯 Recommandations par Cas d'Usage

### Prévisualisation Interactive

```typescript
{
  fps: 24,
  resolution: '720p',
  occlusionCulling: true,
  lazyLoad: true,
  cacheEnabled: true
}
```

### Export Vidéo Production

```typescript
{
  resolution: '1080p',
  codec: 'libx264',
  preset: 'medium',
  quality: 23,
  parallelism: 'auto',
  includeAudio: true
}
```

### Export Ultra Haute Qualité

```typescript
{
  resolution: '4k',
  codec: 'libx265',
  preset: 'slow',
  quality: 18,
  parallelism: 8,
  pixelFormat: 'yuv444p'
}
```

### Mobile / Low-End

```typescript
{
  width: 1280,
  height: 720,
  fps: 24,
  simpleAnimations: true,
  occlusionCulling: true,
  preload: false
}
```

## 🐛 Résolution de Problèmes

### FPS Bas

1. Réduire le nombre de layers visibles
2. Activer occlusion culling
3. Simplifier les animations
4. Réduire la résolution
5. Utiliser le cache de canvas

### Utilisation Mémoire Élevée

1. Activer lazy loading
2. Libérer les scènes inactives
3. Réduire la résolution des images
4. Limiter le cache size
5. Utiliser le garbage collector

### Rendu Lent (Server)

1. Augmenter le nombre de workers
2. Utiliser preset plus rapide
3. Activer hardware acceleration
4. Utiliser SSD pour frames
5. Optimiser les assets

### Fichier Vidéo Volumineux

1. Augmenter le CRF (qualité)
2. Utiliser H.265 au lieu de H.264
3. Réduire le bitrate audio
4. Optimiser les keyframes
5. Utiliser codec plus efficace

## 📚 Ressources

### Outils de Profiling

- Chrome DevTools Performance
- Firefox Performance Tools
- Node.js Profiler (clinic.js)
- WebPageTest
- Lighthouse

### Documentation Connexe

- [Architecture](./02-ARCHITECTURE.md)
- [Configuration](./14-CONFIGURATION.md)
- [API Frontend](./24-API-FRONTEND.md)
- [API Server](./25-API-SERVER.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
