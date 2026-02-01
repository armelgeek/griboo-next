# Système Scene

## 📋 Vue d'Ensemble

Une **Scene** (Scène) est une séquence temporelle qui contient plusieurs **Layers** (couches). Chaque scène a une durée définie et peut avoir des transitions vers la scène suivante.

## 🎯 Concept

```
Whiteboard
  └── Scene 1 (5 secondes)
      ├── Layer A (texte)
      ├── Layer B (image)
      └── Layer C (forme)
      └→ Transition (fade)
  └── Scene 2 (7 secondes)
      ├── Layer D (texte)
      └── Layer E (path SVG)
      └→ Transition (slide)
  └── Scene 3 (4 secondes)
      └── Layer F (vidéo)
```

## 📦 Interface SceneConfig

### Structure Complète

```typescript
interface SceneConfig {
  // Identification
  id: string;                     // Identifiant unique
  
  // Durée
  duration: number;               // Durée en secondes
  
  // Layers
  layers: LayerConfig[];          // Couches de la scène
  
  // Transition vers la scène suivante
  transition?: SceneTransitionConfig;
  
  // Occlusion culling
  occlusionCulling?: boolean;     // Défaut : true
  
  // Arrière-plan spécifique (override global)
  background?: string | BackgroundConfig;
  
  // Caméra spécifique (override global)
  camera?: CameraSceneConfig;
  
  // Audio spécifique
  audio?: SceneAudioConfig;
  
  // Métadonnées
  name?: string;                  // Nom lisible
  description?: string;           // Description
  tags?: string[];                // Tags pour organisation
}
```

## ⏱️ Gestion du Timing

### Durée de Scène

La durée totale d'une scène est définie par le paramètre `duration` :

```typescript
{
  id: 'scene-1',
  duration: 10,  // 10 secondes
  layers: [/* ... */]
}
```

### Timeline des Layers

Les layers dans une scène ont leur propre timing via :
- `entrance_delay` : Délai avant l'apparition
- `entrance_duration` : Durée de l'animation d'entrée
- `duration` : Temps pendant lequel le layer est visible
- `exit_duration` : Durée de l'animation de sortie

```typescript
{
  id: 'scene-1',
  duration: 10,
  layers: [
    {
      type: 'text',
      textConfig: { text: "Premier" },
      entrance_delay: 0,           // Apparaît immédiatement
      entrance_duration: 1,        // 1s d'animation d'entrée
      duration: 5,                 // Visible pendant 5s
      exit_duration: 0.5          // 0.5s d'animation de sortie
    },
    {
      type: 'text',
      textConfig: { text: "Deuxième" },
      entrance_delay: 3,           // Apparaît après 3s
      entrance_duration: 1,
      duration: 4,
      exit_duration: 0.5
    }
  ]
}
```

### Calcul Automatique du Timing

Le `TimingManager` calcule automatiquement :

```typescript
interface SceneTimingBreakdown {
  sceneDuration: number;          // Durée totale de la scène
  layers: LayerTimingBreakdown[]; // Timing de chaque layer
  totalLayerTime: number;         // Temps total des layers
  overlap: number;                // Temps de superposition
}

interface LayerTimingBreakdown {
  layerId: string;
  startTime: number;              // Quand le layer commence
  endTime: number;                // Quand le layer termine
  visibleDuration: number;        // Durée de visibilité
  totalDuration: number;          // Durée totale (avec animations)
}
```

## 🎬 Transitions de Scènes

### Types de Transitions

```typescript
interface SceneTransitionConfig {
  type: TransitionType;
  duration: number;               // Durée en secondes
  easing?: string;                // Fonction d'easing
  direction?: 'left' | 'right' | 'top' | 'bottom';
  color?: string;                 // Pour certains types
}

type TransitionType = 
  | 'none'          // Pas de transition
  | 'fade'          // Fondu
  | 'crossfade'     // Fondu croisé
  | 'wipe'          // Essuie
  | 'slide'         // Glissement
  | 'push'          // Poussée
  | 'eraser'        // Gomme
  | 'zoom'          // Zoom
  | 'blur'          // Flou
  | 'pixelate'      // Pixelisation
  | 'circle'        // Ouverture/fermeture circulaire
  | 'rect'          // Ouverture/fermeture rectangulaire
  | 'diagonal';     // Diagonal
```

### Exemples de Transitions

#### Fondu Simple

```typescript
{
  transition: {
    type: 'fade',
    duration: 1,
    easing: 'ease_in_out'
  }
}
```

#### Glissement avec Direction

```typescript
{
  transition: {
    type: 'slide',
    duration: 0.8,
    direction: 'left',
    easing: 'ease_out'
  }
}
```

#### Transition Personnalisée

```typescript
{
  transition: {
    type: 'eraser',
    duration: 1.5,
    easing: 'ease_in_out_cubic',
    color: '#ffffff'
  }
}
```

## 🎨 Configuration Spécifique par Scène

### Arrière-plan Personnalisé

Chaque scène peut avoir son propre arrière-plan :

```typescript
{
  id: 'scene-1',
  duration: 5,
  background: '#f0f0f0',  // Override l'arrière-plan global
  layers: [/* ... */]
}
```

Ou avec grille :

```typescript
{
  id: 'scene-2',
  duration: 7,
  background: {
    color: '#ffffff',
    grid: {
      type: 'dots',
      size: 30,
      color: '#cccccc',
      opacity: 0.3
    }
  },
  layers: [/* ... */]
}
```

### Caméra par Scène

Configuration de caméra spécifique à une scène :

```typescript
{
  id: 'scene-zoom',
  duration: 10,
  camera: {
    position: { x: 0, y: 0 },
    zoom: 1.0,
    keyframes: [
      {
        time: 0,
        position: { x: 0, y: 0 },
        zoom: 1.0,
        easing: 'ease_out'
      },
      {
        time: 5,
        position: { x: 200, y: 100 },
        zoom: 2.0,
        easing: 'ease_in_out'
      },
      {
        time: 10,
        position: { x: 0, y: 0 },
        zoom: 1.0,
        easing: 'ease_in'
      }
    ]
  },
  layers: [/* ... */]
}
```

### Audio par Scène

Chaque scène peut avoir son propre audio :

```typescript
{
  id: 'scene-with-audio',
  duration: 8,
  audio: {
    voiceover: {
      src: './audio/scene-1-voiceover.mp3',
      volume: 1.0,
      fadeIn: 0.5,
      fadeOut: 0.5
    },
    soundEffects: [
      {
        src: './audio/swoosh.mp3',
        time: 2,
        volume: 0.8
      },
      {
        src: './audio/pop.mp3',
        time: 5,
        volume: 0.6
      }
    ]
  },
  layers: [/* ... */]
}
```

## 🎭 Occlusion Culling

### Activation/Désactivation

```typescript
{
  id: 'scene-1',
  duration: 5,
  occlusionCulling: true,  // Activé par défaut
  layers: [/* ... */]
}
```

### Comportement

Quand activé, l'occlusion culling :
1. Détecte les layers qui se superposent
2. Calcule les zones d'occultation
3. "Efface" automatiquement les parties cachées
4. Optimise le rendu (moins de pixels à dessiner)

**Exemple** :
```
Layer A (texte)    [========]
Layer B (rectangle)    [===========]
                       ↓
Résultat : La partie de A sous B est automatiquement effacée
```

### Cas d'Usage

✅ **Activez pour** :
- Effet de dessin réaliste
- Animations d'écriture sur tableau blanc
- Superposition de formes
- Performance optimale

❌ **Désactivez pour** :
- Transparence entre layers
- Effets de superposition voulus
- Layers semi-transparents

## 📊 Gestion des Layers

### Ordre des Layers (Z-Index)

Les layers sont rendus dans l'ordre de leur tableau, avec support du `z_index` :

```typescript
{
  layers: [
    {
      type: 'image',
      z_index: 0,       // Arrière-plan
      // ...
    },
    {
      type: 'text',
      z_index: 10,      // Au-dessus de l'image
      // ...
    },
    {
      type: 'shape',
      z_index: 5,       // Entre les deux
      // ...
    }
  ]
}
```

**Ordre de rendu** : 
1. Tri par `z_index` (croissant)
2. Si même `z_index`, ordre dans le tableau
3. Layers avec `z_index` undefined sont rendus en dernier

### Groupement de Layers

Organisez les layers par groupe logique :

```typescript
{
  layers: [
    // Groupe : Arrière-plan
    { type: 'image', id: 'bg', z_index: 0 },
    { type: 'shape', id: 'bg-overlay', z_index: 1 },
    
    // Groupe : Contenu principal
    { type: 'text', id: 'title', z_index: 10 },
    { type: 'text', id: 'subtitle', z_index: 11 },
    
    // Groupe : Décorations
    { type: 'shape', id: 'deco-1', z_index: 20 },
    { type: 'shape', id: 'deco-2', z_index: 21 }
  ]
}
```

## 🎯 Exemples Pratiques

### Scène Simple

```typescript
const scene: SceneConfig = {
  id: 'intro',
  duration: 5,
  layers: [
    {
      type: 'text',
      textConfig: {
        text: "Bienvenue!",
        fontSize: 72,
        color: '#000000'
      },
      entrance_animation: {
        type: 'fade_in',
        duration: 1
      }
    }
  ]
};
```

### Scène Multi-Layers avec Timeline

```typescript
const scene: SceneConfig = {
  id: 'presentation',
  duration: 15,
  layers: [
    // Titre apparaît immédiatement
    {
      type: 'text',
      textConfig: { text: "Présentation", fontSize: 60 },
      entrance_delay: 0,
      entrance_duration: 1,
      duration: 15,
      entrance_animation: { type: 'slide_in_top', duration: 1 }
    },
    
    // Image apparaît après 2 secondes
    {
      type: 'image',
      imagePath: './assets/diagram.png',
      entrance_delay: 2,
      entrance_duration: 1,
      duration: 10,
      entrance_animation: { type: 'zoom_in', duration: 1 }
    },
    
    // Points clés apparaissent progressivement
    {
      type: 'text',
      textConfig: { text: "• Point 1", fontSize: 32 },
      entrance_delay: 5,
      entrance_duration: 0.5,
      duration: 10,
      entrance_animation: { type: 'slide_in_left', duration: 0.5 }
    },
    {
      type: 'text',
      textConfig: { text: "• Point 2", fontSize: 32 },
      entrance_delay: 7,
      entrance_duration: 0.5,
      duration: 8,
      entrance_animation: { type: 'slide_in_left', duration: 0.5 }
    },
    {
      type: 'text',
      textConfig: { text: "• Point 3", fontSize: 32 },
      entrance_delay: 9,
      entrance_duration: 0.5,
      duration: 6,
      entrance_animation: { type: 'slide_in_left', duration: 0.5 }
    }
  ]
};
```

### Scène avec Transition Complexe

```typescript
const scene: SceneConfig = {
  id: 'chapter-1',
  duration: 10,
  transition: {
    type: 'eraser',
    duration: 1.5,
    easing: 'ease_in_out_cubic'
  },
  background: {
    color: '#f5f5f5',
    grid: {
      type: 'dots',
      size: 20,
      color: '#d0d0d0',
      opacity: 0.4
    }
  },
  camera: {
    zoom: 1.0,
    position: { x: 0, y: 0 }
  },
  layers: [/* ... */]
};
```

### Scène avec Audio Synchronisé

```typescript
const scene: SceneConfig = {
  id: 'explanation',
  duration: 12,
  audio: {
    voiceover: {
      src: './audio/explanation.mp3',
      volume: 1.0,
      fadeIn: 0.3,
      fadeOut: 0.5
    }
  },
  layers: [
    {
      type: 'text',
      textConfig: { text: "Étape 1" },
      entrance_delay: 0,
      entrance_duration: 0.5
    },
    {
      type: 'text',
      textConfig: { text: "Étape 2" },
      entrance_delay: 4,  // Synchronisé avec le voiceover
      entrance_duration: 0.5
    },
    {
      type: 'text',
      textConfig: { text: "Étape 3" },
      entrance_delay: 8,  // Synchronisé avec le voiceover
      entrance_duration: 0.5
    }
  ]
};
```

## 🔧 API de Scene

### Frontend

```typescript
class Scene {
  // Propriétés
  readonly id: string;
  readonly duration: number;
  readonly layers: Layer[];
  
  // Lifecycle
  async prepare(): Promise<void>;
  render(ctx: CanvasRenderingContext2D, time: number): void;
  dispose(): void;
  
  // État
  getCurrentTime(): number;
  isActive(time: number): boolean;
  getVisibleLayers(time: number): Layer[];
  
  // Transitions
  renderTransition(
    ctx: CanvasRenderingContext2D,
    progress: number
  ): void;
}
```

### Server

```typescript
class ServerScene {
  // Mêmes méthodes que Scene, adaptées pour Node.js
  async prepare(): Promise<void>;
  render(ctx: NodeCanvasRenderingContext2D, time: number): void;
  dispose(): void;
}
```

## 📊 Métriques et Debugging

### Timing Info

```typescript
const timingInfo = scene.getTimingBreakdown();

console.log({
  sceneDuration: timingInfo.sceneDuration,
  layerCount: timingInfo.layers.length,
  totalLayerTime: timingInfo.totalLayerTime,
  overlap: timingInfo.overlap
});
```

### Layer Visibility

```typescript
// À un instant donné, quels layers sont visibles ?
const time = 5;  // 5 secondes
const visibleLayers = scene.getVisibleLayers(time);

console.log('Layers visibles:', visibleLayers.map(l => l.id));
```

## ⚡ Optimisations

### Lazy Loading

Les scenes chargent leurs assets uniquement quand nécessaire :

```typescript
// Préparation à la demande
scene.on('before-activate', async () => {
  await scene.prepare();
});

// Nettoyage après utilisation
scene.on('after-deactivate', () => {
  scene.dispose();
});
```

### Culling Intelligent

Les layers hors écran ou complètement occultés ne sont pas rendus :

```typescript
// Rendu optimisé
scene.render(ctx, time, {
  enableCulling: true,
  viewport: { x: 0, y: 0, width: 1920, height: 1080 }
});
```

## 📚 Voir Aussi

- [Système Whiteboard](./03-WHITEBOARD.md)
- [Système Layer](./05-LAYER.md)
- [Animations](./11-ENTRANCE-ANIMATIONS.md)
- [Configuration](./14-CONFIGURATION.md)

---

**Navigation** : [← Précédent : Whiteboard](./03-WHITEBOARD.md) | [Suivant : Layer →](./05-LAYER.md)
