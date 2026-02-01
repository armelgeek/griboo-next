# API Frontend - Référence Complète

## 📋 Vue d'Ensemble

Cette page documente l'API complète du frontend KIVG pour une utilisation dans le navigateur.

## 📦 Installation et Import

```typescript
// Import depuis le package npm
import { Whiteboard } from '@kivg/engine';

// Ou import depuis le code source
import { Whiteboard } from './src/frontend/whiteboard/whiteboard';
```

## 🎨 Classe Whiteboard

### Constructor

```typescript
constructor(config: WhiteboardConfig)
```

**Paramètres :**
- `config`: Configuration complète du whiteboard

**Exemple :**
```typescript
const whiteboard = new Whiteboard({
  containerId: 'my-container',
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [/* ... */]
});
```

### Méthodes de Lifecycle

#### prepare()

```typescript
async prepare(): Promise<void>
```

Prépare le whiteboard en préchargeant tous les assets.

**Retourne :** Promise qui se résout quand tout est prêt

**Exemple :**
```typescript
await whiteboard.prepare();
console.log('Prêt à jouer!');
```

#### play()

```typescript
play(): void
```

Démarre la lecture de l'animation.

**Exemple :**
```typescript
whiteboard.play();
```

#### pause()

```typescript
pause(): void
```

Met en pause la lecture.

**Exemple :**
```typescript
whiteboard.pause();
```

#### stop()

```typescript
stop(): void
```

Arrête la lecture et remet à zéro.

**Exemple :**
```typescript
whiteboard.stop();
```

#### resume()

```typescript
resume(): void
```

Reprend la lecture après une pause.

**Exemple :**
```typescript
whiteboard.resume();
```

### Méthodes de Navigation

#### seek()

```typescript
seek(ratio: number): void
```

Navigue vers une position spécifique (0.0 à 1.0).

**Paramètres :**
- `ratio`: Position relative (0.0 = début, 1.0 = fin)

**Exemple :**
```typescript
whiteboard.seek(0.5); // Aller à 50%
```

#### seekToTime()

```typescript
seekToTime(seconds: number): void
```

Navigue vers un temps spécifique en secondes.

**Paramètres :**
- `seconds`: Temps en secondes

**Exemple :**
```typescript
whiteboard.seekToTime(15); // Aller à 15 secondes
```

#### goToScene()

```typescript
goToScene(sceneId: string): void
```

Navigue directement vers une scène spécifique.

**Paramètres :**
- `sceneId`: ID de la scène cible

**Exemple :**
```typescript
whiteboard.goToScene('scene-2');
```

### Méthodes d'État

#### getCurrentTime()

```typescript
getCurrentTime(): number
```

**Retourne :** Temps actuel en secondes

**Exemple :**
```typescript
const time = whiteboard.getCurrentTime();
console.log(`Position: ${time}s`);
```

#### getDuration()

```typescript
getDuration(): number
```

**Retourne :** Durée totale en secondes

**Exemple :**
```typescript
const duration = whiteboard.getDuration();
console.log(`Durée totale: ${duration}s`);
```

#### isPlaying()

```typescript
isPlaying(): boolean
```

**Retourne :** `true` si en cours de lecture

**Exemple :**
```typescript
if (whiteboard.isPlaying()) {
  console.log('En lecture...');
}
```

#### isPaused()

```typescript
isPaused(): boolean
```

**Retourne :** `true` si en pause

#### getCurrentScene()

```typescript
getCurrentScene(): Scene
```

**Retourne :** La scène actuellement active

**Exemple :**
```typescript
const scene = whiteboard.getCurrentScene();
console.log(`Scène actuelle: ${scene.id}`);
```

### Méthodes d'Événements

#### on()

```typescript
on(event: string, callback: Function): void
```

S'abonne à un événement.

**Événements disponibles :**
- `ready` : Whiteboard prêt après prepare()
- `play` : Lecture démarrée
- `pause` : Lecture mise en pause
- `stop` : Lecture arrêtée
- `end` : Fin de l'animation
- `timeupdate` : Mise à jour du temps (chaque frame)
- `scenechange` : Changement de scène
- `layerenter` : Un layer devient visible
- `layerexit` : Un layer disparaît
- `error` : Une erreur s'est produite

**Exemple :**
```typescript
whiteboard.on('ready', () => {
  console.log('Prêt!');
});

whiteboard.on('timeupdate', (time) => {
  console.log(`Temps: ${time}s`);
});

whiteboard.on('scenechange', (scene) => {
  console.log(`Nouvelle scène: ${scene.id}`);
});
```

#### off()

```typescript
off(event: string, callback: Function): void
```

Se désabonne d'un événement.

**Exemple :**
```typescript
const onTimeUpdate = (time) => console.log(time);
whiteboard.on('timeupdate', onTimeUpdate);
// ... plus tard ...
whiteboard.off('timeupdate', onTimeUpdate);
```

#### once()

```typescript
once(event: string, callback: Function): void
```

S'abonne à un événement une seule fois.

**Exemple :**
```typescript
whiteboard.once('end', () => {
  console.log('Animation terminée!');
});
```

### Méthodes de Contrôle Audio

#### setVolume()

```typescript
setVolume(volume: number): void
```

Définit le volume global (0.0 à 1.0).

**Exemple :**
```typescript
whiteboard.setVolume(0.5); // 50%
```

#### mute()

```typescript
mute(): void
```

Coupe le son.

#### unmute()

```typescript
unmute(): void
```

Réactive le son.

#### isMuted()

```typescript
isMuted(): boolean
```

**Retourne :** `true` si le son est coupé

### Méthodes de Configuration

#### getConfig()

```typescript
getConfig(): WhiteboardConfig
```

**Retourne :** La configuration actuelle

**Exemple :**
```typescript
const config = whiteboard.getConfig();
console.log('FPS:', config.fps);
```

#### updateConfig()

```typescript
updateConfig(updates: Partial<WhiteboardConfig>): void
```

Met à jour la configuration (nécessite un redémarrage).

**Exemple :**
```typescript
whiteboard.updateConfig({
  fps: 60,
  background: '#000000'
});
```

### Méthodes de Nettoyage

#### destroy()

```typescript
destroy(): void
```

Détruit le whiteboard et libère les ressources.

**Exemple :**
```typescript
whiteboard.destroy();
```

## 🎬 Classe Scene

### Propriétés

```typescript
class Scene {
  id: string;
  duration: number;
  layers: Layer[];
}
```

### Méthodes

#### getLayers()

```typescript
getLayers(): Layer[]
```

**Retourne :** Tous les layers de la scène

#### getLayerById()

```typescript
getLayerById(id: string): Layer | undefined
```

**Retourne :** Le layer avec l'ID spécifié

#### getDuration()

```typescript
getDuration(): number
```

**Retourne :** Durée de la scène en secondes

## 🎨 Classe Layer (Base)

### Propriétés Communes

```typescript
class Layer {
  id: string;
  type: LayerType;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
  visible: boolean;
}
```

### Méthodes

#### isVisible()

```typescript
isVisible(): boolean
```

**Retourne :** `true` si le layer est visible

#### getOpacity()

```typescript
getOpacity(): number
```

**Retourne :** Opacité actuelle (0.0 à 1.0)

#### getTransform()

```typescript
getTransform(): Transform
```

**Retourne :** Transformation actuelle (position, rotation, scale)

## 🖼️ Layers Spécialisés

### ImageLayer

```typescript
import { ImageLayer } from '@kivg/engine';

class ImageLayer extends Layer {
  src: string;
  
  async load(): Promise<void>;
  isLoaded(): boolean;
}
```

**Exemple :**
```typescript
const imageLayer = new ImageLayer({
  type: 'image',
  src: '/images/logo.png',
  position: { x: 100, y: 100 },
  width: 300,
  height: 200
});
```

### TextLayer

```typescript
import { TextLayer } from '@kivg/engine';

class TextLayer extends Layer {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  
  setText(text: string): void;
  getText(): string;
}
```

**Exemple :**
```typescript
const textLayer = new TextLayer({
  type: 'text',
  textConfig: {
    text: 'Hello World',
    fontSize: 48,
    fontFamily: 'Arial',
    color: '#000000'
  }
});
```

### ShapeLayer

```typescript
import { ShapeLayer } from '@kivg/engine';

class ShapeLayer extends Layer {
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'polygon';
  fill: string;
  stroke: string;
  strokeWidth: number;
}
```

**Exemple :**
```typescript
const shapeLayer = new ShapeLayer({
  type: 'shape',
  shapeType: 'rectangle',
  width: 200,
  height: 150,
  fill: '#ff6b6b',
  stroke: '#000000',
  strokeWidth: 2
});
```

### SvgPathLayer

```typescript
import { SvgPathLayer } from '@kivg/engine';

class SvgPathLayer extends Layer {
  src: string;
  
  async load(): Promise<void>;
  getPaths(): SVGPath[];
}
```

### MorphLayer

```typescript
import { MorphLayer } from '@kivg/engine';

class MorphLayer extends Layer {
  fromSrc: string;
  toSrc: string;
  morphDuration: number;
}
```

### PushLayer

```typescript
import { PushLayer } from '@kivg/engine';

class PushLayer extends Layer {
  direction: 'up' | 'down' | 'left' | 'right';
  distance: number;
}
```

### CaptionLayer

```typescript
import { CaptionLayer } from '@kivg/engine';

class CaptionLayer extends Layer {
  text: string;
  startTime: number;
  endTime: number;
  style: CaptionStyle;
}
```

## ⚙️ Interfaces de Configuration

### WhiteboardConfig

```typescript
interface WhiteboardConfig {
  // Conteneur
  containerId?: string;
  
  // Dimensions
  width?: number;
  height?: number;
  
  // Performance
  fps?: number;
  
  // Visuel
  background?: string | BackgroundConfig;
  
  // Contenu
  scenes: SceneConfig[];
  
  // Audio
  audio?: AudioConfig;
  
  // Caméra
  camera?: CameraConfig;
  
  // Assets
  hands?: HandsConfig;
  
  // Options
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: boolean;
}
```

### SceneConfig

```typescript
interface SceneConfig {
  id: string;
  duration: number;
  layers: LayerConfig[];
  transition?: TransitionConfig;
  occlusionCulling?: boolean;
  background?: string | BackgroundConfig;
  camera?: CameraSceneConfig;
  audio?: SceneAudioConfig;
}
```

### LayerConfig (Base)

```typescript
interface LayerConfig {
  type: LayerType;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  opacity?: number;
  z_index?: number;
  
  // Animations
  entrance_animation?: AnimationConfig;
  exit_animation?: AnimationConfig;
  emphasis_animations?: EmphasisAnimationConfig[];
  
  // Timing
  entrance_delay?: number;
  entrance_duration?: number;
  duration?: number;
  exit_duration?: number;
}
```

### AnimationConfig

```typescript
interface AnimationConfig {
  type: AnimationType;
  duration: number;
  delay?: number;
  easing?: string;
  
  // Spécifique à certains types
  direction?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  origin?: { x: number; y: number };
  
  // Options avancées
  handConfig?: HandConfig;
  soundConfig?: SoundConfig;
}
```

## 🎮 Contrôles et UI

### Player Controls

```typescript
interface PlayerControls {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ratio: number) => void;
  setVolume: (volume: number) => void;
}
```

### Timeline

```typescript
interface Timeline {
  getCurrentTime: () => number;
  getDuration: () => number;
  getProgress: () => number; // 0.0 à 1.0
  getScenes: () => Scene[];
  getCurrentScene: () => Scene;
}
```

## 🔊 API Audio

### AudioManager

```typescript
interface AudioManager {
  setVolume(volume: number): void;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  
  // Pistes individuelles
  setTrackVolume(trackId: string, volume: number): void;
  muteTrack(trackId: string): void;
  unmuteTrack(trackId: string): void;
}
```

### SpatialAudio

```typescript
interface SpatialAudio {
  enabled: boolean;
  panningStrength: number;
  distanceAttenuation: boolean;
}
```

## 📊 Monitoring et Debug

### PerformanceMonitor

```typescript
interface PerformanceMonitor {
  getFPS(): number;
  getAverageFPS(): number;
  getMemoryUsage(): number;
  getDroppedFrames(): number;
  getRenderTime(): number;
}
```

### DebugMode

```typescript
whiteboard.setDebugMode(true);

// Affiche :
// - FPS en temps réel
// - Bounding boxes des layers
// - Lignes de timing
// - État des animations
// - Logs détaillés
```

## 🎯 Exemples Pratiques

### Exemple Complet

```typescript
import { Whiteboard } from '@kivg/engine';

const whiteboard = new Whiteboard({
  containerId: 'player',
  width: 1920,
  height: 1080,
  fps: 30,
  autoplay: false,
  scenes: [
    {
      id: 'intro',
      duration: 10,
      layers: [
        {
          type: 'text',
          textConfig: {
            text: 'Bienvenue!',
            fontSize: 72,
            fontFamily: 'Arial',
            color: '#000000'
          },
          position: { x: 960, y: 540 },
          entrance_animation: {
            type: 'fadeIn',
            duration: 1
          },
          exit_animation: {
            type: 'fadeOut',
            duration: 1
          }
        }
      ]
    }
  ]
});

// Préparer et lire
await whiteboard.prepare();
whiteboard.play();

// Écouter les événements
whiteboard.on('end', () => {
  console.log('Animation terminée!');
});

// Contrôles
document.getElementById('pause').onclick = () => {
  whiteboard.pause();
};

document.getElementById('resume').onclick = () => {
  whiteboard.resume();
};

// Nettoyage
window.addEventListener('beforeunload', () => {
  whiteboard.destroy();
});
```

### Exemple avec Timeline Personnalisée

```typescript
const whiteboard = new Whiteboard(config);
await whiteboard.prepare();

// Timeline custom
const timeline = document.getElementById('timeline');
whiteboard.on('timeupdate', (time) => {
  const progress = time / whiteboard.getDuration();
  timeline.style.width = `${progress * 100}%`;
});

// Seek au clic
timeline.parentElement.onclick = (e) => {
  const rect = timeline.parentElement.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  whiteboard.seek(ratio);
};
```

### Exemple avec Contrôle de Volume

```typescript
const volumeSlider = document.getElementById('volume');
volumeSlider.oninput = (e) => {
  const volume = e.target.value / 100;
  whiteboard.setVolume(volume);
};

const muteButton = document.getElementById('mute');
muteButton.onclick = () => {
  if (whiteboard.isMuted()) {
    whiteboard.unmute();
    muteButton.textContent = '🔊';
  } else {
    whiteboard.mute();
    muteButton.textContent = '🔇';
  }
};
```

## 📚 Ressources

### Documentation Connexe
- [Introduction](./01-INTRODUCTION.md)
- [Architecture](./02-ARCHITECTURE.md)
- [Configuration](./14-CONFIGURATION.md)
- [Types de Layers](./06-TYPES-LAYERS.md)
- [Animations](./11-ENTRANCE-ANIMATIONS.md)

### Exemples de Code
- `examples/basic.html` - Exemple basique
- `examples/advanced.html` - Exemple avancé
- `examples/interactive.html` - Contrôles interactifs

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
