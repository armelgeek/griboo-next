# Guide de Configuration Complet

## 📋 Vue d'Ensemble

Ce guide détaille toutes les options de configuration disponibles dans le moteur KIVG. La configuration se fait de manière **déclarative** via des objets JSON-compatibles qui définissent le comportement complet de votre animation.

## 🏗️ Hiérarchie de Configuration

```
WhiteboardConfig (Configuration Globale)
  ├── Paramètres Généraux (dimensions, FPS, etc.)
  ├── Background (arrière-plan)
  ├── Camera (caméra globale)
  ├── HandOverlay (overlay de main globale)
  └── Scenes[] (tableau de scènes)
      └── SceneConfig
          ├── Durée et timing
          ├── Transition
          ├── Audio
          ├── Camera (caméra de scène)
          └── Layers[] (tableau de couches)
              └── LayerConfig
                  ├── Type et position
                  ├── Animations (entrée, sortie, emphase)
                  ├── HandOverlay (overlay de main spécifique)
                  └── Configuration spécifique au type
```

## 📦 WhiteboardConfig - Configuration Globale

### Interface Complète

```typescript
interface WhiteboardConfig {
  // === CONTENEUR ET DIMENSIONS ===
  containerId?: string;           // ID du conteneur DOM (frontend uniquement)
  width?: number;                 // Largeur en pixels (défaut: 1920)
  height?: number;                // Hauteur en pixels (défaut: 1080)
  
  // === PERFORMANCE ===
  fps?: number;                   // Images par seconde (défaut: 30)
  perfMonitor?: boolean;          // Moniteur de performance (défaut: false)
  debug?: boolean;                // Mode debug (défaut: false)
  
  // === SCÈNES ===
  scenes: SceneConfig[];          // Tableau de scènes (OBLIGATOIRE)
  
  // === APPARENCE GLOBALE ===
  background?: string | BackgroundConfig;  // Arrière-plan global
  
  // === CAMÉRA GLOBALE ===
  camera?: CameraSceneConfig;     // Configuration de la caméra globale
  
  // === MAIN ANIMÉE ===
  handOverlay?: {
    enabled?: boolean;            // Activer la main globalement
  };
  hands?: HandPresetsConfig;      // Presets de main personnalisés
  
  // === AUDIO (SERVER UNIQUEMENT) ===
  normalizeAudio?: boolean;       // Normalisation audio (défaut: true)
}
```

### Exemple Complet

```typescript
const config: WhiteboardConfig = {
  // Dimensions standard Full HD
  width: 1920,
  height: 1080,
  fps: 30,
  
  // Arrière-plan avec grille
  background: {
    color: '#ffffff',
    grid: {
      type: 'dots',
      size: 20,
      color: '#e0e0e0',
      opacity: 0.5
    }
  },
  
  // Caméra avec zoom initial
  camera: {
    initial: {
      zoom: 1.0,
      position: { x: 0.5, y: 0.5 }
    },
    virtualSize: { width: 1920, height: 1080 }
  },
  
  // Activer la main animée globalement
  handOverlay: {
    enabled: true
  },
  
  // Scènes
  scenes: [
    // ... configurations de scènes
  ]
};
```

## 🎬 SceneConfig - Configuration de Scène

### Interface Complète

```typescript
interface SceneConfig {
  // === IDENTIFICATION ===
  id: string;                     // Identifiant unique (OBLIGATOIRE)
  
  // === DURÉE ET TIMING ===
  duration?: number;              // Durée explicite en secondes
  timingConfig?: {
    drawSpeed?: number;           // Vitesse globale (défaut: 1.0)
  };
  
  // === COUCHES ===
  layers: LayerConfig[];          // Tableau de layers (OBLIGATOIRE)
  
  // === TRANSITION ===
  transition?: {
    type: TransitionType;         // Type de transition
    duration: number;             // Durée en secondes
    easing?: string;              // Fonction d'easing
  };
  
  // === GOMME DE SCÈNE ===
  eraser?: {
    enabled?: boolean;            // Activer la gomme
    duration?: number;            // Durée du gommage (secondes)
    delayAfterAnimations?: number; // Délai avant gommage
    showHand?: boolean;           // Afficher la main
    handConfig?: HandOverlayConfig;
  };
  
  // === OCCLUSION CULLING ===
  occlusionCulling?: boolean;     // Activer l'occlusion (défaut: false)
  occlusionCullingConfig?: {
    duration?: number;            // Durée du gommage d'occlusion (1.5s)
    showHand?: boolean;           // Afficher la main pendant gommage
  };
  
  // === CAMÉRA DE SCÈNE ===
  camera?: CameraSceneConfig;     // Configuration caméra de la scène
  
  // === AUDIO (SERVER) ===
  audio?: AudioSceneConfig;       // Configuration audio de la scène
  
  // === ARRIÈRE-PLAN ===
  background?: string | BackgroundConfig;  // Arrière-plan de scène
}
```

### Exemples

#### Scène Simple

```typescript
const simpleScene: SceneConfig = {
  id: 'intro',
  layers: [
    {
      type: 'text',
      id: 'title',
      textConfig: {
        text: 'Bonjour le monde',
        fontSize: 72,
        fontFamily: 'Arial',
        color: '#000000'
      },
      position: { x: 960, y: 540 },
      entrance_animation: {
        type: 'fade_in',
        duration: 1.0
      }
    }
  ]
};
```

#### Scène avec Transition et Gomme

```typescript
const advancedScene: SceneConfig = {
  id: 'demo',
  timingConfig: {
    drawSpeed: 1.5  // 50% plus rapide
  },
  layers: [
    // ... layers
  ],
  eraser: {
    enabled: true,
    duration: 2.0,
    delayAfterAnimations: 0.5,
    showHand: true
  },
  transition: {
    type: 'fade',
    duration: 0.5,
    easing: 'easeInOutCubic'
  }
};
```

#### Scène avec Occlusion Culling

```typescript
const occlusionScene: SceneConfig = {
  id: 'overlap-demo',
  occlusionCulling: true,
  occlusionCullingConfig: {
    duration: 1.5,
    showHand: true
  },
  layers: [
    {
      type: 'shape',
      id: 'circle1',
      shapeConfig: { shape: 'circle', radius: 100 },
      position: { x: 500, y: 500 },
      entrance_animation: { type: 'fade_in', duration: 1 }
    },
    {
      type: 'shape',
      id: 'circle2',
      shapeConfig: { shape: 'circle', radius: 100 },
      position: { x: 550, y: 500 },  // Chevauche circle1
      entrance_animation: { type: 'fade_in', duration: 1 }
      // L'occlusion culling efface automatiquement la partie cachée de circle1
    }
  ]
};
```

## 🎨 LayerConfig - Configuration de Couche

### Interface de Base

```typescript
interface BaseLayerConfig {
  // === IDENTIFICATION ===
  id: string;                     // Identifiant unique (auto-généré si absent)
  type: LayerType;                // Type de layer (OBLIGATOIRE)
  
  // === POSITIONNEMENT ===
  position?: Position;            // Position {x, y} en pixels
  x?: number;                     // Alternative: position X
  y?: number;                     // Alternative: position Y
  zIndex?: number;                // Ordre de superposition
  z_index?: number;               // Alternative: zIndex
  
  // === DIMENSIONS ===
  width?: number;                 // Largeur en pixels
  height?: number;                // Hauteur en pixels
  scale?: number;                 // Échelle uniforme
  scaleX?: number;                // Échelle horizontale
  scaleY?: number;                // Échelle verticale
  
  // === APPARENCE ===
  opacity?: number;               // Opacité 0-1 (défaut: 1)
  rotation?: number;              // Rotation en degrés
  
  // === ANIMATIONS ===
  entrance_animation?: AnimationConfig;      // Animation d'entrée
  exit_animation?: AnimationConfig;          // Animation de sortie
  emphasis_animation?: EmphasisAnimationConfig;  // Animation d'emphase
  
  // === TIMING ===
  timingConfig?: {
    pauseTime?: number;           // Pause après entrée (secondes)
    drawSpeed?: number;           // Vitesse de dessin
  };
  
  // === MAIN ANIMÉE ===
  handOverlay?: boolean | HandOverlayConfig;  // Config de main
  
  // === OCCLUSION ===
  occlusionCulling?: boolean;     // Participe à l'occlusion (défaut: true)
  
  // === MÉTADONNÉES ===
  name?: string;                  // Nom descriptif
  tags?: string[];                // Tags d'organisation
}
```

### Configuration d'Animation

```typescript
interface AnimationConfig {
  type: AnimationType;            // Type d'animation (OBLIGATOIRE)
  duration: number;               // Durée en secondes (OBLIGATOIRE)
  delay?: number;                 // Délai avant démarrage (secondes)
  easing?: EasingFunction;        // Fonction d'easing
}

// Types d'animation d'entrée
type EntranceAnimationType = 
  | 'fade_in' | 'slide_in_left' | 'slide_in_right' | 'slide_in_top' | 'slide_in_bottom'
  | 'zoom_in' | 'bounce_in' | 'flip_in_x' | 'flip_in_y' | 'rotate_in'
  | 'back_in_down' | 'back_in_left' | 'back_in_right' | 'back_in_up'
  | 'fade_in_down' | 'fade_in_left' | 'fade_in_right' | 'fade_in_up'
  | 'zoom_in_down' | 'zoom_in_left' | 'zoom_in_right' | 'zoom_in_up'
  | 'draw' | 'stroke' | 'typewriter' | 'reveal_horizontal' | 'reveal_vertical'
  | 'none';

// Types d'animation de sortie
type ExitAnimationType = 
  | 'fade_out' | 'slide_out_left' | 'slide_out_right' | 'slide_out_top' | 'slide_out_bottom'
  | 'zoom_out' | 'bounce_out' | 'flip_out_x' | 'flip_out_y' | 'rotate_out'
  | 'eraser' | 'none';
```

### Configuration d'Animation d'Emphase

```typescript
interface EmphasisAnimationConfig {
  type: EmphasisAnimationType;    // Type d'emphase (OBLIGATOIRE)
  duration: number;               // Durée d'une itération (secondes)
  delay?: number;                 // Délai avant démarrage
  iterations?: number;            // Nombre de répétitions (Infinity possible)
  intensity?: number;             // Intensité 0-1 (défaut: 0.5)
  easing?: EasingFunction;        // Fonction d'easing
}

type EmphasisAnimationType = 
  | 'pulse' | 'shake' | 'bounce' | 'wiggle' | 'glow' | 'flash'
  | 'rubber_band' | 'swing' | 'tada' | 'wobble' | 'jello' | 'heart_beat'
  | 'none';
```

### Exemples de Layers

#### TextLayer

```typescript
const textLayer: LayerConfig = {
  type: 'text',
  id: 'my-text',
  position: { x: 960, y: 540 },
  textConfig: {
    text: 'Hello World',
    fontSize: 64,
    fontFamily: 'Arial',
    color: '#000000',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  entrance_animation: {
    type: 'typewriter',
    duration: 2.0
  },
  emphasis_animation: {
    type: 'pulse',
    duration: 1.0,
    iterations: 2,
    intensity: 0.3
  },
  exit_animation: {
    type: 'fade_out',
    duration: 0.5
  },
  handOverlay: {
    enabled: true,
    preset: 'pencil-right'
  }
};
```

#### ImageLayer

```typescript
const imageLayer: LayerConfig = {
  type: 'image',
  id: 'photo',
  imageUrl: '/assets/photo.jpg',
  position: { x: 960, y: 540 },
  width: 400,
  height: 300,
  entrance_animation: {
    type: 'zoom_in',
    duration: 1.0,
    easing: 'easeOutBack'
  },
  exit_animation: {
    type: 'zoom_out',
    duration: 0.5
  }
};
```

#### ShapeLayer

```typescript
const shapeLayer: LayerConfig = {
  type: 'shape',
  id: 'circle',
  position: { x: 500, y: 500 },
  shapeConfig: {
    shape: 'circle',
    radius: 150,
    fillColor: '#ff6b6b',
    strokeColor: '#000000',
    strokeWidth: 3
  },
  entrance_animation: {
    type: 'draw',
    duration: 2.0
  },
  handOverlay: true
};
```

#### PathLayer

```typescript
const pathLayer: LayerConfig = {
  type: 'path',
  id: 'arrow',
  pathConfig: {
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 }
    ],
    strokeColor: '#000000',
    strokeWidth: 5,
    smooth: true
  },
  entrance_animation: {
    type: 'draw',
    duration: 1.5
  }
};
```

## 🎥 CameraSceneConfig - Configuration de la Caméra

### Interface

```typescript
interface CameraSceneConfig {
  // === ÉTAT INITIAL ===
  initial?: CameraConfig;         // Configuration initiale
  
  // === KEYFRAMES ===
  keyframes?: CameraKeyframe[];   // Points de caméra animés
  
  // === TAILLE VIRTUELLE ===
  virtualSize?: {
    width: number;
    height: number;
  };
  
  // === MODE DE SUIVI ===
  followMode?: 'manual' | 'active_layer' | 'hand';
  
  // === OPTIONS ===
  snapToFirstKeyframe?: boolean;  // Sauter au premier keyframe
}

interface CameraConfig {
  zoom?: number;                  // Niveau de zoom (défaut: 1.0)
  position?: Position;            // Position {x, y} normalisée (0-1)
  size?: {                        // Taille du viewport virtuel
    width: number;
    height: number;
  } | null;
  targetLayerId?: string;         // ID du layer à suivre
  padding?: number;               // Padding autour du layer ciblé
}

interface CameraKeyframe extends CameraConfig {
  startTime?: number;             // Temps de début (secondes)
  pauseTime?: number;             // Pause à ce keyframe (secondes)
  transitionDuration?: number;    // Durée de transition (secondes)
  easing?: EasingFunction;        // Fonction d'easing
}
```

### Exemples

#### Caméra Statique avec Zoom

```typescript
const staticCamera: CameraSceneConfig = {
  initial: {
    zoom: 1.5,
    position: { x: 0.5, y: 0.5 }
  },
  virtualSize: { width: 1920, height: 1080 }
};
```

#### Caméra avec Keyframes Animés

```typescript
const animatedCamera: CameraSceneConfig = {
  virtualSize: { width: 1920, height: 1080 },
  keyframes: [
    {
      zoom: 1.0,
      position: { x: 0.5, y: 0.5 },
      startTime: 0,
      pauseTime: 2,
      transitionDuration: 0
    },
    {
      zoom: 2.0,
      position: { x: 0.3, y: 0.3 },
      pauseTime: 2,
      transitionDuration: 1.5,
      easing: 'easeInOutCubic'
    },
    {
      zoom: 1.0,
      position: { x: 0.5, y: 0.5 },
      pauseTime: 1,
      transitionDuration: 1.0,
      easing: 'easeInOutCubic'
    }
  ]
};
```

#### Caméra Suivant un Layer

```typescript
const followCamera: CameraSceneConfig = {
  virtualSize: { width: 1920, height: 1080 },
  followMode: 'active_layer',
  initial: {
    zoom: 1.5,
    targetLayerId: 'my-layer',
    padding: 50
  }
};
```

## 🎨 BackgroundConfig - Configuration d'Arrière-plan

### Interface

```typescript
interface BackgroundConfig {
  // === COULEUR DE BASE ===
  color?: string;                 // Couleur de fond (défaut: '#ffffff')
  
  // === GRILLE ===
  grid?: GridConfig;              // Configuration de grille
  
  // === GRADIENT ===
  gradient?: GradientConfig;      // Dégradé de fond
  
  // === TEMPLATE/IMAGE ===
  template?: TemplateConfig;      // Image de fond
  
  // === EFFETS ===
  effects?: BackgroundEffectConfig;  // Effets visuels
  
  // === ANIMATION ===
  animation?: BackgroundAnimationConfig;  // Animation de fond
}

interface GridConfig {
  type: GridType;                 // Type de grille (OBLIGATOIRE)
  size?: number;                  // Taille du motif (défaut: 20)
  color?: string;                 // Couleur (défaut: '#cccccc')
  opacity?: number;               // Opacité 0-1 (défaut: 0.5)
  lineWidth?: number;             // Épaisseur des lignes (défaut: 1)
}

type GridType = 
  | 'dots'       // Points réguliers
  | 'lines'      // Lignes horizontales
  | 'squares'    // Carrés
  | 'hexagonal'  // Hexagones
  | 'isometric'; // Grille isométrique

interface GradientConfig {
  type: 'linear' | 'radial';
  stops: Array<{
    offset: number;               // Position 0-1
    color: string;                // Couleur au point
    opacity?: number;             // Opacité optionnelle
  }>;
  angle?: number;                 // Angle pour gradients linéaires
  cx?: number;                    // Centre X pour radial (0-100)
  cy?: number;                    // Centre Y pour radial (0-100)
  r?: number;                     // Rayon pour radial (0-100)
}
```

### Exemples

#### Fond avec Grille de Points

```typescript
const dottedBackground: BackgroundConfig = {
  color: '#ffffff',
  grid: {
    type: 'dots',
    size: 25,
    color: '#e0e0e0',
    opacity: 0.6
  }
};
```

#### Fond avec Grille Isométrique

```typescript
const isometricBackground: BackgroundConfig = {
  color: '#f0f0f0',
  grid: {
    type: 'isometric',
    size: 30,
    color: '#3498db',
    opacity: 0.3,
    lineWidth: 1
  }
};
```

#### Fond avec Dégradé

```typescript
const gradientBackground: BackgroundConfig = {
  gradient: {
    type: 'linear',
    angle: 135,
    stops: [
      { offset: 0, color: '#667eea' },
      { offset: 1, color: '#764ba2' }
    ]
  }
};
```

#### Fond avec Image

```typescript
const templateBackground: BackgroundConfig = {
  color: '#ffffff',
  template: {
    url: '/assets/notebook-background.jpg',
    opacity: 0.3
  }
};
```

## ✋ HandOverlayConfig - Configuration de la Main

### Interface

```typescript
interface HandOverlayConfig {
  enabled?: boolean;              // Activer la main (défaut: true)
  imageUrl?: string;              // URL de l'image de main
  scale?: number;                 // Échelle de la main (défaut: 0.35)
  offset?: [number, number];      // Décalage [x, y] en pixels
  anchorPoint?: [number, number]; // Point d'ancrage normalisé [0-1, 0-1]
  anchorTopLeft?: boolean;        // Ancrer en haut à gauche
  preset?: string;                // Nom du preset à utiliser
}
```

### Presets Disponibles

Le moteur KIVG fournit plusieurs presets de main prédéfinis :

- **`pencil-right`** : Main droite tenant un crayon
- **`pencil-left`** : Main gauche tenant un crayon
- **`pen-right`** : Main droite tenant un stylo
- **`marker-right`** : Main droite tenant un marqueur
- **`eraser-right`** : Main droite tenant une gomme
- **`finger-right`** : Main droite avec index pointé

### Exemples

#### Utilisation d'un Preset

```typescript
const handConfig: HandOverlayConfig = {
  enabled: true,
  preset: 'pencil-right'
};
```

#### Configuration Personnalisée

```typescript
const customHand: HandOverlayConfig = {
  enabled: true,
  imageUrl: '/assets/custom-hand.png',
  scale: 0.4,
  offset: [-20, -30],
  anchorPoint: [0.9, 0.1]  // Pointe du crayon en bas à droite
};
```

#### Désactivation de la Main

```typescript
const noHand: HandOverlayConfig = {
  enabled: false
};

// Ou simplement
const alsoNoHand = false;
```

## 🎵 AudioSceneConfig - Configuration Audio

> **Note** : La configuration audio est uniquement disponible pour le rendu server (export vidéo).

### Interface

```typescript
interface AudioSceneConfig {
  // === MUSIQUE DE FOND ===
  background_music?: string | {
    path: string;                 // Chemin du fichier audio
    volume?: number;              // Volume 0-1 (défaut: 0.5)
    loop?: boolean;               // Boucle (défaut: false)
    fade_in?: number;             // Fade in (secondes)
    fade_out?: number;            // Fade out (secondes)
  };
  
  // === EFFETS SONORES ===
  sound_effects?: Array<{
    path: string;                 // Chemin du fichier
    start_time?: number;          // Temps de début (secondes)
    volume?: number;              // Volume 0-1
    duration?: number;            // Durée de lecture
  }>;
  
  // === VOIX OFF ===
  voice_overs?: Array<{
    path: string;                 // Chemin du fichier
    start_time?: number;          // Temps de début (secondes)
    volume?: number;              // Volume 0-1
  }>;
  
  // === SONS PROCÉDURAUX ===
  typewriter?: {
    start_time?: number;          // Temps de début
    num_characters?: number;      // Nombre de caractères
    char_interval?: number;       // Intervalle entre caractères (ms)
    volume?: number;              // Volume 0-1
  };
  
  drawing_sound?: {
    start_time?: number;          // Temps de début
    duration?: number;            // Durée du son de dessin
    volume?: number;              // Volume 0-1
  };
}
```

### Exemple

```typescript
const audioConfig: AudioSceneConfig = {
  background_music: {
    path: '/audio/background.mp3',
    volume: 0.3,
    loop: true,
    fade_in: 2,
    fade_out: 2
  },
  voice_overs: [
    {
      path: '/audio/narration-1.mp3',
      start_time: 0,
      volume: 0.8
    }
  ],
  sound_effects: [
    {
      path: '/audio/pop.wav',
      start_time: 3.5,
      volume: 0.6
    }
  ],
  drawing_sound: {
    start_time: 1,
    duration: 5,
    volume: 0.4
  }
};
```

## ⚙️ Fonctions d'Easing

Les fonctions d'easing contrôlent la courbe de progression des animations.

### Fonctions Disponibles

```typescript
type EasingFunction = 
  // Linear
  | 'linear'
  
  // Quad
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  
  // Cubic
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  
  // Quart
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  
  // Quint
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  
  // Sine
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  
  // Expo
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
  
  // Circ
  | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc'
  
  // Back (avec dépassement)
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  
  // Elastic (élastique)
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  
  // Bounce (rebond)
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';
```

### Exemple d'Utilisation

```typescript
const layer: LayerConfig = {
  type: 'shape',
  id: 'bouncy-circle',
  entrance_animation: {
    type: 'zoom_in',
    duration: 1.0,
    easing: 'easeOutBounce'  // Effet de rebond à l'arrivée
  }
};
```

## 🎯 Validation de Configuration

### Utilisation du Validateur

```typescript
import { 
  validateWhiteboardConfig,
  safeValidateWhiteboardConfig 
} from '@kivg/engine/validation';

// Validation avec exception en cas d'erreur
try {
  const validConfig = validateWhiteboardConfig(myConfig);
  // Configuration valide
} catch (error) {
  console.error('Configuration invalide:', error);
}

// Validation sûre avec résultat
const result = safeValidateWhiteboardConfig(myConfig);
if (result.success) {
  const validConfig = result.data;
  // Utiliser la configuration validée
} else {
  console.error('Erreurs de validation:', result.error.errors);
}
```

## 🔧 Bonnes Pratiques

### 1. Utiliser des IDs Descriptifs

```typescript
// ❌ Mauvais
{ id: 'l1', type: 'text' }

// ✅ Bon
{ id: 'intro-title', type: 'text' }
```

### 2. Externaliser les Configurations Complexes

```typescript
// Séparer les configurations en modules
import { introScene } from './scenes/intro';
import { mainScene } from './scenes/main';

const config: WhiteboardConfig = {
  scenes: [introScene, mainScene]
};
```

### 3. Utiliser des Constantes pour les Valeurs Répétées

```typescript
const BRAND_COLOR = '#3498db';
const ANIMATION_DURATION = 1.0;

const config = {
  scenes: [{
    layers: [
      {
        type: 'shape',
        shapeConfig: { fillColor: BRAND_COLOR },
        entrance_animation: { type: 'fade_in', duration: ANIMATION_DURATION }
      }
    ]
  }]
};
```

### 4. Valider Tôt et Souvent

```typescript
// Valider après chaque modification importante
const config = buildConfig();
const validation = safeValidateWhiteboardConfig(config);
if (!validation.success) {
  console.error('Erreurs:', validation.error);
  // Corriger avant de continuer
}
```

### 5. Documenter les Configurations Complexes

```typescript
const scene: SceneConfig = {
  id: 'complex-animation',
  // Cette scène montre une séquence de 3 layers qui s'enchaînent
  // avec des délais précis pour synchroniser avec la voix off
  layers: [
    // Premier élément : titre principal (0-2s)
    { /* ... */ },
    // Deuxième élément : sous-titre (2-4s)
    { /* ... */ },
    // Troisième élément : graphique (4-7s)
    { /* ... */ }
  ]
};
```

## 🐛 Dépannage

### Problème : La Main ne S'affiche pas

**Solutions** :
1. Vérifier que `handOverlay.enabled` est `true`
2. S'assurer que l'URL de l'image est correcte
3. Vérifier la console pour les erreurs de chargement
4. Utiliser un preset prédéfini pour tester

### Problème : Les Animations ne Jouent pas Correctement

**Solutions** :
1. Vérifier les durées (`duration` doit être > 0)
2. S'assurer que le type d'animation est valide
3. Vérifier que les `delay` ne créent pas de chevauchements
4. Utiliser `debug: true` pour visualiser le timing

### Problème : La Caméra ne Bouge pas

**Solutions** :
1. Vérifier que `virtualSize` est défini
2. S'assurer que les keyframes ont des `transitionDuration` > 0
3. Vérifier que les positions sont dans la plage 0-1
4. Tester avec une configuration simple d'abord

### Problème : L'Occlusion Culling ne Fonctionne pas

**Solutions** :
1. Activer `occlusionCulling: true` dans la scène
2. Vérifier que les layers se chevauchent réellement
3. S'assurer que `zIndex` est correctement défini
4. Vérifier que les layers n'ont pas `occlusionCulling: false`

## 📚 Ressources Complémentaires

- [Architecture du Moteur](./02-ARCHITECTURE.md)
- [Système de Layers](./05-LAYER.md)
- [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md)
- [Animations de Sortie](./12-EXIT-ANIMATIONS.md)
- [Gestionnaire de Timing](./17-TIMING-MANAGER.md)
- [Gestionnaire de Main](./18-HAND-OVERLAY-MANAGER.md)
- [Gestionnaire d'Arrière-plan](./19-BACKGROUND-MANAGER.md)
- [Occlusion Culling](./20-OCCLUSION-CULLING.md)

---

**Navigation** : [← Précédent : Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md) | [Suivant : Timing Manager →](./17-TIMING-MANAGER.md)
