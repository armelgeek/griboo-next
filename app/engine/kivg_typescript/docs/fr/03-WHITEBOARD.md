# Système Whiteboard

## 📋 Vue d'Ensemble

Le **Whiteboard** est le conteneur principal du moteur KIVG. Il gère la configuration globale, orchestre toutes les scènes, et coordonne le système d'animation complet.

## 🎯 Responsabilités

- **Gestion des Scènes** : Création, orchestration et transitions
- **Configuration Globale** : Dimensions, FPS, arrière-plan, assets
- **Cycle de Vie** : Préparation, lecture, pause, seek, arrêt
- **Coordination** : Timing, rendering, audio, animations

## 📦 Classes Principales

### Frontend : `Whiteboard`

```typescript
import { Whiteboard } from '@kivg/engine';

class Whiteboard {
  constructor(config: WhiteboardConfig);
  
  // Lifecycle
  async prepare(): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  
  // Navigation
  seek(ratio: number): void;  // 0.0 à 1.0
  seekToTime(seconds: number): void;
  
  // État
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  
  // Scènes
  getCurrentScene(): Scene;
  goToScene(sceneId: string): void;
  
  // Événements
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}
```

### Server : `ServerWhiteboard`

```typescript
import { ServerWhiteboard } from '@kivg/engine/server';

class ServerWhiteboard {
  constructor(config: WhiteboardConfig);
  
  // Préparation
  async prepare(): Promise<void>;
  
  // Export Vidéo
  async renderToVideo(
    outputPath: string,
    options?: VideoExportOptions
  ): Promise<void>;
  
  // Export GIF
  async renderToGif(
    outputPath: string,
    options?: GifExportOptions
  ): Promise<void>;
  
  // Export Frames
  async renderFrames(
    outputDir: string,
    options?: FrameExportOptions
  ): Promise<void>;
  
  // Cleanup
  dispose(): void;
}
```

## ⚙️ WhiteboardConfig

### Structure Complète

```typescript
interface WhiteboardConfig {
  // Identifiant (optionnel)
  id?: string;
  
  // Conteneur (frontend uniquement)
  containerId?: string;
  
  // Dimensions
  width?: number;              // Défaut : 1920
  height?: number;             // Défaut : 1080
  
  // Framerate
  fps?: number;                // Défaut : 30
  
  // Arrière-plan
  background?: string | BackgroundConfig;
  
  // Scènes (requis)
  scenes: SceneConfig[];
  
  // Configuration des mains
  hands?: HandsConfig;
  
  // Sous-titres
  subtitles?: SubtitlesConfig;
  
  // Caméra globale
  camera?: CameraConfig;
  
  // Audio
  audio?: AudioConfig;
  
  // Debug
  debug?: DebugConfig;
}
```

### Paramètres Détaillés

#### Dimensions et Vidéo

```typescript
{
  width: 1920,        // Largeur native en pixels
  height: 1080,       // Hauteur native en pixels
  fps: 30,           // Images par seconde (30 ou 60 recommandé)
}
```

#### Arrière-plan

**Simple (couleur unie)** :
```typescript
{
  background: '#ffffff'  // Hex, RGB, ou nom de couleur
}
```

**Avancé (avec grille)** :
```typescript
{
  background: {
    color: '#ffffff',
    grid: {
      type: 'dots',           // 'dots' | 'lines' | 'squares' | 'hexagonal' | 'isometric'
      size: 20,               // Taille de la grille
      color: '#e0e0e0',       // Couleur de la grille
      opacity: 0.5            // Opacité (0-1)
    }
  }
}
```

**Types de grilles disponibles** :
- `dots` : Points réguliers
- `lines` : Lignes horizontales et verticales
- `squares` : Grille carrée
- `hexagonal` : Grille hexagonale
- `isometric` : Grille isométrique

#### Configuration des Mains

```typescript
{
  hands: {
    draw: {
      imagePath: './assets/hand-draw.png',
      maskPath: './assets/hand-draw-mask.png',
      offset: { x: -10, y: -10 }
    },
    erase: {
      imagePath: './assets/hand-erase.png',
      maskPath: './assets/hand-erase-mask.png',
      offset: { x: 0, y: 0 }
    },
    push: {
      imagePath: './assets/hand-push.png',
      maskPath: './assets/hand-push-mask.png',
      offset: { x: -20, y: -20 }
    }
  }
}
```

#### Configuration Audio

```typescript
{
  audio: {
    // Musique de fond
    backgroundMusic: {
      src: './audio/background.mp3',
      volume: 0.5,
      loop: true,
      fadeIn: 2,
      fadeOut: 2
    },
    
    // Voix off
    voiceover: {
      src: './audio/voiceover.mp3',
      volume: 1.0
    },
    
    // Sons procéduraux
    procedural: {
      drawing: true,        // Sons de dessin
      typewriter: true,     // Sons de machine à écrire
      erasing: true,        // Sons de gomme
      panning: true,        // Panoramique spatial
      volume: 0.8
    },
    
    // Normalisation
    normalize: true,
    targetLoudness: -16    // LUFS
  }
}
```

#### Configuration Caméra

```typescript
{
  camera: {
    // Position initiale
    position: { x: 0, y: 0 },
    zoom: 1.0,
    
    // Keyframes d'animation
    keyframes: [
      {
        time: 0,
        position: { x: 0, y: 0 },
        zoom: 1.0,
        easing: 'ease_in_out'
      },
      {
        time: 5,
        position: { x: 100, y: 50 },
        zoom: 1.5,
        easing: 'ease_out'
      }
    ],
    
    // Limites
    bounds: {
      minZoom: 0.5,
      maxZoom: 3.0,
      minX: -500,
      maxX: 500,
      minY: -500,
      maxY: 500
    }
  }
}
```

#### Configuration Debug

```typescript
{
  debug: {
    showBounds: true,        // Afficher les bounding boxes
    showTiming: true,        // Afficher les infos de timing
    showFPS: true,           // Afficher le compteur FPS
    logPerformance: true,    // Logger les métriques
    logLayers: true,         // Logger les layers
    logAnimations: true      // Logger les animations
  }
}
```

## 🎬 Cycle de Vie

### 1. Initialisation

```typescript
const config: WhiteboardConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#ffffff',
  scenes: [/* ... */]
};

const whiteboard = new Whiteboard(config);
```

### 2. Préparation

```typescript
// Charge tous les assets et prépare les scènes
await whiteboard.prepare();

// Événements de progression
whiteboard.on('prepare:progress', (progress) => {
  console.log(`Préparation: ${progress * 100}%`);
});

whiteboard.on('prepare:complete', () => {
  console.log('Prêt à jouer');
});
```

### 3. Lecture

```typescript
// Démarrer la lecture
whiteboard.play();

// Événements de lecture
whiteboard.on('play', () => {
  console.log('Lecture démarrée');
});

whiteboard.on('time-update', (time) => {
  console.log(`Temps: ${time}s`);
});

whiteboard.on('scene-change', (scene) => {
  console.log(`Nouvelle scène: ${scene.id}`);
});
```

### 4. Contrôle

```typescript
// Pause
whiteboard.pause();

// Reprendre
whiteboard.play();

// Naviguer (ratio 0-1)
whiteboard.seek(0.5);  // Aller à 50%

// Naviguer (temps en secondes)
whiteboard.seekToTime(10);

// Arrêter
whiteboard.stop();
```

### 5. Nettoyage

```typescript
// Libérer les ressources
whiteboard.dispose();
```

## 📡 Événements

### Événements de Cycle de Vie

```typescript
whiteboard.on('prepare:start', () => {});
whiteboard.on('prepare:progress', (progress: number) => {});
whiteboard.on('prepare:complete', () => {});
whiteboard.on('play', () => {});
whiteboard.on('pause', () => {});
whiteboard.on('stop', () => {});
whiteboard.on('complete', () => {});
```

### Événements de Timing

```typescript
whiteboard.on('time-update', (time: number) => {});
whiteboard.on('progress', (ratio: number) => {});
whiteboard.on('scene-change', (scene: Scene) => {});
whiteboard.on('scene-complete', (scene: Scene) => {});
```

### Événements de Layers

```typescript
whiteboard.on('layer-start', (layer: Layer) => {});
whiteboard.on('layer-complete', (layer: Layer) => {});
whiteboard.on('layer-animate-in', (layer: Layer) => {});
whiteboard.on('layer-animate-out', (layer: Layer) => {});
```

### Événements d'Erreur

```typescript
whiteboard.on('error', (error: Error) => {});
whiteboard.on('asset-error', (asset: string, error: Error) => {});
```

## 🎥 Export Vidéo (Server)

### Options d'Export Vidéo

```typescript
interface VideoExportOptions {
  // Résolution
  resolution?: '720p' | '1080p' | '4k' | 'custom';
  width?: number;        // Si resolution='custom'
  height?: number;       // Si resolution='custom'
  
  // Codec
  codec?: 'libx264' | 'libx265' | 'libvpx-vp9';
  
  // Qualité
  quality?: number;      // CRF (18-28 recommandé)
  preset?: string;       // ultrafast, fast, medium, slow, veryslow
  
  // Performance
  parallelism?: number | 'auto';  // Nombre de workers
  
  // Audio
  audioCodec?: 'aac' | 'mp3' | 'opus';
  audioBitrate?: string; // Ex: '128k'
  
  // Avancé
  pixelFormat?: string;  // yuv420p par défaut
  hardwareAccel?: boolean; // NVENC si disponible
  
  // Callbacks
  onProgress?: (progress: number) => void;
  onFrame?: (frame: number) => void;
}
```

### Exemple d'Export Haute Qualité

```typescript
import { ServerWhiteboard } from '@kivg/engine/server';

const whiteboard = new ServerWhiteboard(config);
await whiteboard.prepare();

await whiteboard.renderToVideo('output.mp4', {
  resolution: '1080p',
  codec: 'libx265',
  quality: 20,
  preset: 'slow',
  parallelism: 'auto',
  hardwareAccel: true,
  onProgress: (progress) => {
    console.log(`Export: ${(progress * 100).toFixed(1)}%`);
  }
});

console.log('Export terminé!');
```

### Export GIF Optimisé

```typescript
await whiteboard.renderToGif('animation.gif', {
  width: 800,
  height: 600,
  fps: 15,
  quality: 'high',
  dither: 'sierra2_4a',
  onProgress: (progress) => {
    console.log(`GIF: ${(progress * 100).toFixed(1)}%`);
  }
});
```

## 🔧 Méthodes Utilitaires

### Obtenir des Informations

```typescript
// Durée totale
const duration = whiteboard.getDuration();

// Temps actuel
const currentTime = whiteboard.getCurrentTime();

// Progression (0-1)
const progress = currentTime / duration;

// État de lecture
const playing = whiteboard.isPlaying();

// Scène actuelle
const scene = whiteboard.getCurrentScene();

// Toutes les scènes
const scenes = whiteboard.getScenes();
```

### Navigation de Scènes

```typescript
// Aller à une scène spécifique
whiteboard.goToScene('scene-2');

// Scène suivante
whiteboard.nextScene();

// Scène précédente
whiteboard.previousScene();

// Première scène
whiteboard.goToFirstScene();

// Dernière scène
whiteboard.goToLastScene();
```

## 🎯 Exemples Pratiques

### Exemple Simple

```typescript
const config = {
  scenes: [{
    id: 'intro',
    duration: 3,
    layers: [{
      type: 'text',
      textConfig: { 
        text: "Bienvenue!", 
        fontSize: 72 
      },
      entrance_animation: { 
        type: 'fade_in', 
        duration: 1 
      }
    }]
  }]
};

const whiteboard = new Whiteboard(config);
await whiteboard.prepare();
whiteboard.play();
```

### Exemple avec Contrôles

```typescript
// Boutons de contrôle
document.getElementById('play')?.addEventListener('click', () => {
  whiteboard.play();
});

document.getElementById('pause')?.addEventListener('click', () => {
  whiteboard.pause();
});

// Barre de progression
const progressBar = document.getElementById('progress');
whiteboard.on('time-update', (time) => {
  const progress = time / whiteboard.getDuration();
  progressBar.style.width = `${progress * 100}%`;
});

// Seek avec slider
const slider = document.getElementById('slider');
slider.addEventListener('input', (e) => {
  const ratio = e.target.value / 100;
  whiteboard.seek(ratio);
});
```

### Exemple Multi-Scènes

```typescript
const config = {
  scenes: [
    {
      id: 'scene-1',
      duration: 5,
      transition: { type: 'fade', duration: 1 },
      layers: [/* ... */]
    },
    {
      id: 'scene-2',
      duration: 7,
      transition: { type: 'slide', direction: 'left', duration: 0.5 },
      layers: [/* ... */]
    },
    {
      id: 'scene-3',
      duration: 4,
      layers: [/* ... */]
    }
  ]
};

const whiteboard = new Whiteboard(config);
await whiteboard.prepare();

// Navigation manuelle entre scènes
whiteboard.on('scene-complete', (scene) => {
  console.log(`Scène ${scene.id} terminée`);
});

// Bouton "Scène suivante"
document.getElementById('next')?.addEventListener('click', () => {
  whiteboard.nextScene();
});
```

## ⚡ Performance

### Optimisations Automatiques

Le Whiteboard applique automatiquement plusieurs optimisations :

1. **Lazy Loading** : Assets chargés à la demande
2. **Layer Pooling** : Réutilisation des objets layers
3. **Occlusion Culling** : Layers cachés non rendus
4. **Dirty Region** : Mise à jour partielle du canvas
5. **RAF Throttling** : Limitation du framerate si nécessaire

### Métriques de Performance

```typescript
whiteboard.on('performance', (metrics) => {
  console.log({
    fps: metrics.fps,
    renderTime: metrics.renderTime,
    memoryUsage: metrics.memory,
    layerCount: metrics.layerCount
  });
});
```

## 📚 Voir Aussi

- [Système Scene](./04-SCENE.md)
- [Système Layer](./05-LAYER.md)
- [Configuration](./14-CONFIGURATION.md)
- [API Frontend](./24-API-FRONTEND.md)
- [API Server](./25-API-SERVER.md)

---

**Navigation** : [← Précédent : Architecture](./02-ARCHITECTURE.md) | [Suivant : Scene →](./04-SCENE.md)
