# Architecture du Moteur KIVG

## 🏗️ Vue d'Ensemble de l'Architecture

Le moteur KIVG utilise une architecture **hybride** qui sépare clairement les préoccupations entre le frontend (navigateur) et le server (Node.js), tout en partageant la logique commune.

```
┌─────────────────────────────────────────────────┐
│           APPLICATION UTILISATEUR               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐         ┌─────────────────┐  │
│  │   Frontend   │         │     Server      │  │
│  │  (Browser)   │         │   (Node.js)     │  │
│  └──────┬───────┘         └────────┬────────┘  │
│         │                          │           │
│         └──────────┬───────────────┘           │
│                    │                           │
│         ┌──────────▼───────────┐               │
│         │   Shared (Common)    │               │
│         │  Types & Utilities   │               │
│         └──────────────────────┘               │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 📦 Structure des Dossiers

```
src/
├── frontend/              # Implémentation navigateur
│   ├── whiteboard/       # Système principal Whiteboard
│   │   ├── whiteboard.ts # Classe Whiteboard
│   │   ├── scene.ts      # Gestion des scènes
│   │   ├── layer.ts      # Classe de base Layer
│   │   ├── layers/       # Tous les types de layers
│   │   ├── managers/     # Gestionnaires système
│   │   └── utils/        # Utilitaires frontend
│   ├── core/             # Logique de base
│   │   ├── animations/   # Moteur d'animation
│   │   ├── rendering/    # Système de rendu
│   │   └── logic/        # Logique métier
│   ├── animations/       # Handlers d'animation
│   ├── drawing/          # Système de dessin
│   └── assets/           # Chargement d'assets
│
├── server/               # Implémentation Node.js
│   ├── core/            # Classes de base server
│   │   ├── whiteboard.ts # ServerWhiteboard
│   │   ├── scene.ts      # ServerScene
│   │   └── layer.ts      # ServerLayer
│   ├── layers/          # Implémentations server des layers
│   ├── animators/       # Animateurs server
│   └── utils/           # Utilitaires server
│
└── shared/              # Code partagé
    ├── types/           # Définitions TypeScript
    ├── core/            # Logique commune
    ├── utils/           # Utilitaires partagés
    ├── graphics/        # Traitement graphique
    └── config/          # Configuration partagée
```

## 🎯 Principes Architecturaux

### 1. Configuration-First
Tout le système est piloté par des configurations JSON-compatibles définies dans `src/shared/types/`.

```typescript
// Configuration déclarative
const config: WhiteboardConfig = {
  scenes: [{
    duration: 5,
    layers: [{
      type: 'text',
      textConfig: { text: "Hello" },
      entrance_animation: { type: 'fade_in', duration: 1 }
    }]
  }]
};
```

### 2. Type Safety
Utilisation stricte des types TypeScript pour éviter les erreurs à l'exécution.

```typescript
// Types stricts depuis src/shared/types/
import type { 
  WhiteboardConfig, 
  SceneConfig, 
  LayerConfig 
} from '@engine/types';
```

### 3. Pattern Strategy
Utilisation intensive du pattern Strategy, notamment pour les hand overlays.

```typescript
interface HandStrategy {
  update(time: number, layer: Layer): HandPosition;
}

class TextWritingHandStrategy implements HandStrategy { ... }
class PathDrawingHandStrategy implements HandStrategy { ... }
```

### 4. Pattern Factory
Création de layers via un factory pattern.

```typescript
class LayerFactory {
  createLayer(config: LayerConfig): Layer {
    switch(config.type) {
      case 'text': return new TextLayer(config);
      case 'image': return new ImageLayer(config);
      // ...
    }
  }
}
```

## 🔄 Flux de Rendu

### Frontend (Prévisualisation)

```
1. Configuration
   └→ Whiteboard.constructor(config)

2. Préparation
   └→ whiteboard.prepare()
       ├→ Chargement des assets
       ├→ Initialisation des scènes
       └→ Création des layers

3. Lecture
   └→ whiteboard.play()
       ├→ Boucle d'animation (requestAnimationFrame)
       ├→ Update timing
       ├→ Render frame
       └→ Draw to canvas

4. Interaction
   ├→ whiteboard.pause()
   ├→ whiteboard.seek(ratio)
   └→ whiteboard.stop()
```

### Server (Export Vidéo)

```
1. Configuration
   └→ ServerWhiteboard.constructor(config)

2. Préparation
   └→ await whiteboard.prepare()
       ├→ Résolution des chemins assets
       ├→ Chargement des ressources
       └→ Initialisation du pipeline

3. Rendu Parallèle
   └→ await whiteboard.renderToVideo(path, options)
       ├→ Création du worker pool
       ├→ Rendu frames en parallèle
       ├→ Écriture directe sur disque
       └→ Encodage ffmpeg final

4. Export
   └→ Fichier vidéo/GIF généré
```

## 🎨 Système de Layers

### Hiérarchie des Classes

```
BaseLayer (Abstract)
├── LoadableLayer (Abstract)
│   ├── ImageLayer
│   ├── SimpleImageLayer
│   ├── TextLayer
│   └── SvgPathLayer
│
├── WritingLayer
├── PathLayer
├── ShapeLayer
├── PushLayer
├── EraserLayer
├── RubberLayer
├── MorphLayer
├── OcclusionLayer
└── CaptionLayer
```

### Interface Layer Commune

Tous les layers implémentent l'interface de base :

```typescript
interface Layer {
  id: string;
  type: LayerType;
  
  // Lifecycle
  prepare(): Promise<void>;
  render(ctx: CanvasRenderingContext2D, time: number): void;
  dispose(): void;
  
  // Animations
  animateIn(duration: number): Promise<void>;
  animateOut(duration: number): Promise<void>;
  
  // État
  isVisible(time: number): boolean;
  getBounds(): Rectangle;
}
```

## ⚙️ Système de Managers

Les managers coordonnent des aspects spécifiques du système :

### TimingManager
Gère la précision temporelle et compense le drift.

```typescript
class TimingManager {
  calculateSceneTiming(scene: Scene): SceneTimingBreakdown;
  compensateDrift(target: number, actual: number): number;
}
```

### HandOverlayManager
Gère l'affichage et le mouvement de la main animée.

```typescript
class HandOverlayManager {
  setStrategy(strategy: HandStrategy): void;
  update(time: number, layer: Layer): void;
  render(ctx: CanvasRenderingContext2D): void;
}
```

### BackgroundManager
Gère les arrière-plans et grilles.

```typescript
class BackgroundManager {
  renderBackground(ctx: CanvasRenderingContext2D): void;
  setGrid(type: GridType, config: GridConfig): void;
}
```

### OcclusionCullingManager
Optimise le rendu en détectant les occultations.

```typescript
class OcclusionCullingManager {
  calculateOcclusions(layers: Layer[]): OcclusionData[];
  applyOcclusion(ctx: CanvasRenderingContext2D, layer: Layer): void;
}
```

## 🎬 Système d'Animation

### Pipeline d'Animation

```
Layer Config
  └→ AnimationConfig
      └→ EntranceAnimation | ExitAnimation | EmphasisAnimation
          └→ Easing Function
              └→ Interpolation
                  └→ Render Update
```

### Composants d'Animation

1. **Animation Types** : Définissent le comportement (fade, slide, zoom, etc.)
2. **Easing Functions** : Contrôlent la courbe de progression
3. **Interpolators** : Calculent les valeurs intermédiaires
4. **Renderers** : Appliquent les transformations visuelles

## 🔧 Système de Cache

### Cache de Performance

```typescript
// Cache WeakMap pour longueurs SVG
private pathLengthCache = new WeakMap<SVGPathElement, number>();

// Cache Canvas pour hand overlay
private handCanvasCache = new Map<string, HTMLCanvasElement>();

// Cache d'images pré-chargées
private imageCache = new Map<string, HTMLImageElement>();
```

### Stratégies de Cache

1. **SVG Path Length** : Cache les calculs de longueur coûteux
2. **Hand Overlay** : Cache les images de main transformées
3. **Assets** : Pré-charge et cache tous les assets
4. **Layer Rendering** : Cache optionnel des layers statiques

## 📊 Gestion de la Mémoire

### Frontend
- Nettoyage automatique des ressources via `dispose()`
- WeakMap pour éviter les fuites mémoire
- Libération des contextes canvas inutilisés

### Server
- Écriture directe sur disque (pas de buffer en mémoire)
- Worker pool avec limite de mémoire par worker
- Garbage collection entre les batches de frames

## 🔒 Type Safety et Validation

### Validation de Configuration

```typescript
import { validateConfig } from '@engine/config-validator';

const result = validateConfig(config);
if (!result.valid) {
  console.error('Configuration invalide:', result.errors);
}
```

### Types Stricts

```typescript
// Type unions pour type safety
type LayerType = 
  | 'text' 
  | 'image' 
  | 'path' 
  | 'shape'
  // ... etc

// Interfaces strictes
interface TextLayerConfig extends BaseLayerConfig {
  type: 'text';
  textConfig: TextConfig; // Required
}
```

## 🎯 Extensibilité

### Ajouter un Nouveau Layer

```typescript
// 1. Définir l'interface dans shared/types
export interface MyCustomLayerConfig extends BaseLayerConfig {
  type: 'custom';
  customProperty: string;
}

// 2. Implémenter la classe frontend
export class MyCustomLayer extends BaseLayer {
  async prepare() { ... }
  render(ctx, time) { ... }
}

// 3. Implémenter la classe server
export class ServerMyCustomLayer extends ServerBaseLayer {
  async prepare() { ... }
  render(ctx, time) { ... }
}

// 4. Ajouter au factory
LayerFactory.register('custom', MyCustomLayer);
```

## 📈 Performance et Optimisation

### Techniques d'Optimisation

1. **Occlusion Culling** : Ne rend que les layers visibles
2. **Dirty Region** : Mise à jour partielle du canvas
3. **Off-screen Canvas** : Pré-rendu de layers complexes
4. **Worker Pool** : Parallélisation du rendu server
5. **Path Simplification** : Réduction de points pour SVG complexes

### Métriques de Performance

```typescript
// Timing précis
const start = performance.now();
// ... render operation
const duration = performance.now() - start;

// Compensation de drift
if (Math.abs(actualDuration - targetDuration) > threshold) {
  compensate(drift);
}
```

## 🔍 Debugging et Logging

### Système de Logs

```typescript
import { logger } from '@engine/logger';

logger.debug('Layer created', { id: layer.id });
logger.info('Animation started');
logger.warn('Performance threshold exceeded');
logger.error('Failed to load asset', error);
```

### Mode Debug

```typescript
const config = {
  debug: {
    showBounds: true,
    showTiming: true,
    logPerformance: true
  },
  // ...
};
```

## 📚 Ressources Supplémentaires

- [Système Whiteboard](./03-WHITEBOARD.md)
- [Système Scene](./04-SCENE.md)
- [Système Layer](./05-LAYER.md)
- [Guide de Performance](./23-PERFORMANCE.md)

---

**Navigation** : [← Précédent : Introduction](./01-INTRODUCTION.md) | [Suivant : Whiteboard →](./03-WHITEBOARD.md)
