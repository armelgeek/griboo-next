# HandOverlayManager - Gestionnaire de Main Animée

## 📋 Vue d'Ensemble

Le **HandOverlayManager** gère l'affichage et le positionnement de la main animée qui suit les actions de dessin, d'écriture et d'effacement dans le moteur KIVG. Il utilise le **pattern Strategy** pour adapter le comportement de la main selon le type de layer et d'animation.

## 🎯 Responsabilités

Le HandOverlayManager gère :

1. **Chargement d'images** - Images de main personnalisées ou presets
2. **Positionnement dynamique** - Calcul de position en temps réel
3. **Stratégies adaptatives** - Comportement selon le type de layer
4. **Animations d'arrivée/départ** - Transitions fluides on/off screen
5. **Transformation caméra** - Conversion coordonnées scène → viewport
6. **Optimisation** - Cache de contextes canvas et images

## 🏗️ Architecture - Pattern Strategy

```
HandOverlayManager
  ├── HandOverlay (Rendu de l'image)
  └── HandOverlayStrategy (Positionnement)
      ├── DefaultHandStrategy
      ├── TextWritingHandStrategy
      ├── PathDrawingHandStrategy
      ├── StrokeAnimationHandStrategy
      ├── ShapeHandStrategy
      ├── EraserHandStrategy
      └── RevealHandStrategy
```

## 📦 Interface HandOverlayConfig

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

## 🎨 Stratégies de Positionnement

### Interface HandOverlayStrategy

```typescript
interface HandOverlayStrategy {
  /**
   * Calcule la position de la main pour un moment donné
   * @param progress - Progression de l'animation (0-1)
   * @param layerData - Données spécifiques au layer
   * @param transform - Transformation optionnelle des coordonnées
   * @returns Position {x, y} ou null si invisible
   */
  getPosition(
    progress: number,
    layerData: any,
    transform?: (p: { x: number; y: number }) => { x: number; y: number }
  ): HandPosition | null;
}

interface HandPosition {
  x: number;                      // Position X (coordonnées scène)
  y: number;                      // Position Y (coordonnées scène)
  visible?: boolean;              // Visibilité (défaut: true)
  rotation?: number;              // Rotation optionnelle (degrés)
}
```

### 1. DefaultHandStrategy

Stratégie par défaut avec position fixe.

```typescript
import { DefaultHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new DefaultHandStrategy();
// Position centrée par défaut
const position = strategy.getPosition(0.5, layer);
// { x: 400, y: 300 }
```

**Utilisation** : Layers sans animation de dessin spécifique.

### 2. TextWritingHandStrategy

Suit le texte qui s'écrit caractère par caractère.

```typescript
import { TextWritingHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new TextWritingHandStrategy();
const position = strategy.getPosition(progress, {
  svgTextElement: textElement,
  charIndex: Math.floor(progress * totalChars)
});
```

**Algorithme** :
1. Obtient la position du caractère courant via `getStartPositionOfChar()`
2. Applique les transformations de position du layer
3. Ajoute l'offset configuré pour la pointe du crayon

**Utilisation** : `TextLayer` avec animations `typewriter`, `char_fade`, `writetyping`.

### 3. PathDrawingHandStrategy

Suit un chemin SVG pendant qu'il se dessine.

```typescript
import { PathDrawingHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new PathDrawingHandStrategy();
const position = strategy.getPosition(progress, {
  pathElement: svgPath,
  totalLength: pathLength
});
```

**Algorithme** :
1. Calcule la longueur parcourue : `distance = progress * totalLength`
2. Obtient le point sur le chemin via `getPointAtLength(distance)`
3. Applique les transformations et l'offset

**Utilisation** : `PathLayer`, `SvgPathLayer` avec animation `draw`.

### 4. StrokeAnimationHandStrategy

Suit les traits d'un SVG complexe pendant l'animation stroke.

```typescript
import { StrokeAnimationHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new StrokeAnimationHandStrategy();
const position = strategy.getPosition(progress, {
  svgElement: complexSvg,
  currentStrokeIndex: 0
});
```

**Algorithme** :
1. Trouve tous les chemins `<path>` dans le SVG
2. Détermine quel chemin est en cours de dessin
3. Calcule la position sur le chemin actif
4. Gère les transitions entre chemins

**Utilisation** : `ImageLayer`, layers SVG complexes avec animation `stroke`.

### 5. ShapeHandStrategy

Suit le périmètre des formes géométriques.

```typescript
import { ShapeHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new ShapeHandStrategy();
const position = strategy.getPosition(progress, {
  shapeType: 'circle',
  center: { x: 500, y: 500 },
  radius: 100
});
```

**Formes supportées** :
- **Circle** : Suit le périmètre circulaire
- **Rectangle** : Suit les quatre côtés dans l'ordre
- **Line** : Suit la ligne du début à la fin
- **Ellipse** : Suit le périmètre elliptique
- **Polygon** : Suit les segments dans l'ordre

**Algorithme** :
```typescript
// Exemple cercle
const angle = progress * Math.PI * 2;
const x = center.x + Math.cos(angle) * radius;
const y = center.y + Math.sin(angle) * radius;
```

**Utilisation** : `ShapeLayer` avec animation `draw`.

### 6. EraserHandStrategy

Suit le mouvement de la gomme pendant l'effacement.

```typescript
import { EraserHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new EraserHandStrategy();
const position = strategy.getPosition(progress, {
  path: eraserPath,        // Chemin de la gomme
  radius: 30,              // Rayon de la gomme
  showEraser: true         // Afficher la gomme
});
```

**Algorithme** :
1. Interpole entre les points du chemin selon `progress`
2. Applique le lissage (smoothing) si configuré
3. Ajuste l'offset pour centrer sur la zone d'effacement

**Utilisation** : `EraserLayer`, `RubberLayer`, transitions de type `eraser`.

### 7. RevealHandStrategy

Suit le mouvement de révélation (wipe/reveal).

```typescript
import { RevealHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new RevealHandStrategy();
const position = strategy.getPosition(progress, {
  direction: 'horizontal',  // ou 'vertical', 'diagonal'
  bounds: { x: 0, y: 0, width: 800, height: 600 }
});
```

**Directions** :
- `horizontal` : Gauche → Droite
- `vertical` : Haut → Bas
- `diagonal` : Coin supérieur gauche → Coin inférieur droit

**Utilisation** : Animations `reveal_horizontal`, `reveal_vertical`, `reveal_diagonal`.

## 🔧 API du HandOverlayManager

### Initialisation

```typescript
import { HandOverlayManager } from '@kivg/engine/hand-overlay';

// Avec configuration manuelle
const manager = new HandOverlayManager({
  enabled: true,
  imageUrl: '/assets/hand-pencil.png',
  scale: 0.4,
  offset: [-15, -25],
  anchorPoint: [0.9, 0.1]
});

await manager.initialize(config);

// Avec preset
const manager2 = new HandOverlayManager({
  enabled: true,
  preset: 'pencil-right'
});

await manager2.initialize(config);
```

### Définir la Stratégie

```typescript
import { TextWritingHandStrategy } from '@kivg/engine/hand-overlay';

const strategy = new TextWritingHandStrategy();
manager.setStrategy(strategy);
```

### Mise à Jour de Position

```typescript
// Dans la boucle d'animation
manager.updateHandPosition(
  progress,       // 0-1
  layerData,      // Données du layer
  canvas          // Canvas de destination (optionnel)
);
```

### Animations d'Arrivée/Départ

#### Arrivée (Off-screen → Target)

```typescript
const targetPosition = { x: 500, y: 500 };
await manager.animateArrival(targetPosition, canvas, 0.4);
// La main arrive en 0.4 secondes avec easing outQuad
```

#### Départ (Position → Off-screen)

```typescript
const currentPosition = { x: 500, y: 500 };
await manager.animateDeparture(currentPosition, canvas, 0.4);
// La main part en 0.4 secondes avec easing inQuad
```

### Méthodes Utilitaires

```typescript
// Vérifier si chargée
if (manager.isLoaded()) {
  console.log('Main prête');
}

// Vérifier si activée
if (manager.isEnabled()) {
  console.log('Main activée');
}

// Obtenir la configuration
const config = manager.getConfig();

// Changer l'échelle
manager.setScale(0.5);

// Masquer la main
manager.hideHand(canvas);

// Dessiner à une position spécifique
manager.drawHandAt(x, y, canvas);

// Nettoyer les ressources
manager.cleanup();
```

## 💡 Exemples d'Utilisation

### Exemple 1 : TextLayer avec Main Animée

```typescript
import { 
  HandOverlayManager, 
  TextWritingHandStrategy 
} from '@kivg/engine/hand-overlay';

// Configuration
const handConfig = {
  enabled: true,
  preset: 'pencil-right'
};

const manager = new HandOverlayManager(handConfig);
await manager.initialize(handConfig);

// Stratégie pour texte
const strategy = new TextWritingHandStrategy();
manager.setStrategy(strategy);

// Dans la boucle d'animation
function animate(progress) {
  const layerData = {
    svgTextElement: textElement,
    charIndex: Math.floor(progress * text.length)
  };
  
  manager.updateHandPosition(progress, layerData, handCanvas);
  
  requestAnimationFrame(() => animate(progress + 0.01));
}

animate(0);
```

### Exemple 2 : PathLayer avec Main Suivant le Chemin

```typescript
import { 
  HandOverlayManager, 
  PathDrawingHandStrategy 
} from '@kivg/engine/hand-overlay';

const manager = new HandOverlayManager({
  enabled: true,
  imageUrl: '/assets/hand-marker.png',
  scale: 0.35,
  offset: [-10, -20]
});

await manager.initialize(config);

const strategy = new PathDrawingHandStrategy();
manager.setStrategy(strategy);

const pathElement = document.querySelector('#my-path');
const totalLength = pathElement.getTotalLength();

function drawPath(progress) {
  const layerData = {
    pathElement: pathElement,
    totalLength: totalLength
  };
  
  manager.updateHandPosition(progress, layerData, handCanvas);
}
```

### Exemple 3 : ShapeLayer avec Main sur Forme

```typescript
import { 
  HandOverlayManager, 
  ShapeHandStrategy 
} from '@kivg/engine/hand-overlay';

const manager = new HandOverlayManager({
  preset: 'pencil-right'
});

await manager.initialize(config);

const strategy = new ShapeHandStrategy();
manager.setStrategy(strategy);

// Dessiner un cercle
function drawCircle(progress) {
  const layerData = {
    shapeType: 'circle',
    center: { x: 500, y: 500 },
    radius: 150
  };
  
  manager.updateHandPosition(progress, layerData, handCanvas);
}
```

### Exemple 4 : EraserLayer avec Gomme

```typescript
import { 
  HandOverlayManager, 
  EraserHandStrategy 
} from '@kivg/engine/hand-overlay';

const manager = new HandOverlayManager({
  enabled: true,
  preset: 'eraser-right'
});

await manager.initialize(config);

const strategy = new EraserHandStrategy();
manager.setStrategy(strategy);

// Chemin de gomme
const eraserPath = [
  { x: 100, y: 100 },
  { x: 200, y: 150 },
  { x: 300, y: 100 },
  { x: 400, y: 200 }
];

function eraseContent(progress) {
  const layerData = {
    path: eraserPath,
    radius: 30,
    showEraser: true
  };
  
  manager.updateHandPosition(progress, layerData, handCanvas);
}
```

### Exemple 5 : Séquence Complète avec Arrivée/Départ

```typescript
async function animateLayerWithHand(layer, manager, canvas) {
  // 1. Calculer la position de départ
  const startPosition = calculateStartPosition(layer);
  
  // 2. Animer l'arrivée de la main
  await manager.animateArrival(startPosition, canvas, 0.4);
  
  // 3. Animer le dessin
  const strategy = selectStrategyForLayer(layer);
  manager.setStrategy(strategy);
  
  await animateDrawing(layer, manager, canvas);
  
  // 4. Calculer la position finale
  const endPosition = calculateEndPosition(layer);
  
  // 5. Animer le départ de la main
  await manager.animateDeparture(endPosition, canvas, 0.4);
}

function selectStrategyForLayer(layer) {
  switch (layer.type) {
    case 'text':
      return new TextWritingHandStrategy();
    case 'path':
      return new PathDrawingHandStrategy();
    case 'shape':
      return new ShapeHandStrategy();
    case 'eraser':
      return new EraserHandStrategy();
    default:
      return new DefaultHandStrategy();
  }
}
```

## 🎨 Presets de Main Disponibles

### Presets Intégrés

```typescript
const presets = {
  'pencil-right': {
    imageUrl: '/assets/hands/pencil-right.png',
    scale: 0.35,
    offset: [-15, -25],
    anchorPoint: [0.9, 0.1]
  },
  'pencil-left': {
    imageUrl: '/assets/hands/pencil-left.png',
    scale: 0.35,
    offset: [15, -25],
    anchorPoint: [0.1, 0.1]
  },
  'pen-right': {
    imageUrl: '/assets/hands/pen-right.png',
    scale: 0.35,
    offset: [-12, -28],
    anchorPoint: [0.85, 0.15]
  },
  'marker-right': {
    imageUrl: '/assets/hands/marker-right.png',
    scale: 0.4,
    offset: [-18, -30],
    anchorPoint: [0.88, 0.12]
  },
  'eraser-right': {
    imageUrl: '/assets/hands/eraser-right.png',
    scale: 0.4,
    offset: [-20, -20],
    anchorPoint: [0.5, 0.5]
  },
  'finger-right': {
    imageUrl: '/assets/hands/finger-right.png',
    scale: 0.35,
    offset: [-10, -35],
    anchorPoint: [0.8, 0.2]
  }
};
```

### Créer un Preset Personnalisé

```typescript
import { registerHandPreset } from '@kivg/engine/hand-overlay';

registerHandPreset('my-custom-hand', {
  imageUrl: '/assets/my-hand.png',
  scale: 0.45,
  offset: [-20, -30],
  anchorPoint: [0.85, 0.15]
});

// Utilisation
const manager = new HandOverlayManager({
  preset: 'my-custom-hand'
});
```

## 🎯 Cas d'Usage Avancés

### Synchronisation Main-Caméra

```typescript
class SynchronizedHandManager extends HandOverlayManager {
  private cameraTransform = { zoom: 1, position: { x: 0.5, y: 0.5 } };
  
  setCameraTransform(zoom, position, virtualSize) {
    super.setCameraTransform(zoom, position, virtualSize);
    this.cameraTransform = { zoom, position, virtualSize };
  }
  
  updateHandPosition(progress, layerData, canvas) {
    // La transformation caméra est automatiquement appliquée
    super.updateHandPosition(progress, layerData, canvas);
  }
}
```

### Stratégie Composite

```typescript
class CompositeHandStrategy implements HandOverlayStrategy {
  private strategies: HandOverlayStrategy[];
  private currentIndex = 0;
  
  constructor(...strategies: HandOverlayStrategy[]) {
    this.strategies = strategies;
  }
  
  getPosition(progress, layerData, transform) {
    // Diviser le progrès entre les stratégies
    const segmentLength = 1 / this.strategies.length;
    const index = Math.floor(progress / segmentLength);
    const localProgress = (progress % segmentLength) / segmentLength;
    
    const strategy = this.strategies[Math.min(index, this.strategies.length - 1)];
    return strategy.getPosition(localProgress, layerData, transform);
  }
}

// Utilisation : dessiner puis effacer
const composite = new CompositeHandStrategy(
  new PathDrawingHandStrategy(),
  new EraserHandStrategy()
);
```

### Debug et Visualisation

```typescript
class DebugHandOverlayManager extends HandOverlayManager {
  updateHandPosition(progress, layerData, canvas, transform) {
    super.updateHandPosition(progress, layerData, canvas, transform);
    
    // Dessiner le chemin suivi
    const position = this.getHandPosition(progress, layerData, transform);
    if (position && canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(position.x - 2, position.y - 2, 4, 4);
    }
  }
}
```

## ⚡ Optimisations et Performances

### Cache de Contextes Canvas

Le manager cache les contextes canvas pour éviter les appels répétés à `getContext('2d')` :

```typescript
// Automatiquement mis en cache
manager.updateHandPosition(progress, layerData, canvas);
// Pas de nouveau getContext() sur le prochain frame
```

### Réutilisation d'Images

Les images de main sont chargées une seule fois et réutilisées :

```typescript
// Première initialisation : charge l'image
await manager1.initialize({ imageUrl: '/hand.png' });

// Deuxième instance avec même URL : réutilise l'image
await manager2.initialize({ imageUrl: '/hand.png' });
```

### Clear Optimisé

```typescript
// Clear optimal du canvas
manager.hideHand(canvas);
// Utilise setTransform(1,0,0,1,0,0) avant clearRect
// pour garantir un nettoyage complet
```

## 🐛 Dépannage

### Problème : La Main ne S'affiche pas

**Vérifications** :
```typescript
// 1. Vérifier l'initialisation
console.log(manager.isInitialized);  // doit être true

// 2. Vérifier le chargement
console.log(manager.isLoaded());  // doit être true

// 3. Vérifier l'activation
console.log(manager.isEnabled());  // doit être true

// 4. Vérifier la stratégie
console.log(manager.getStrategy());  // ne doit pas être null

// 5. Vérifier la position
const pos = manager.getHandPosition(0.5, layerData);
console.log(pos);  // doit retourner {x, y}
```

### Problème : Position Incorrecte

**Debug** :
```typescript
// Logger les positions brutes
const strategy = manager.getStrategy();
const rawPosition = strategy.getPosition(progress, layerData);
console.log('Position brute:', rawPosition);

// Logger après transformation
const transformedPosition = manager.getHandPosition(progress, layerData);
console.log('Position transformée:', transformedPosition);
```

### Problème : Mauvaise Synchronisation avec Caméra

**Solution** :
```typescript
// S'assurer de mettre à jour la transformation caméra
manager.setCameraTransform(
  cameraZoom,
  cameraPosition,
  virtualSize
);

// Appeler AVANT updateHandPosition
```

### Problème : Performance Dégradée

**Optimisations** :
```typescript
// 1. Réduire la fréquence de mise à jour
let frameCount = 0;
if (frameCount % 2 === 0) {  // Mettre à jour 1 frame sur 2
  manager.updateHandPosition(progress, layerData, canvas);
}
frameCount++;

// 2. Désactiver la main pour les layers courts
if (layerDuration < 0.5) {
  layerConfig.handOverlay = { enabled: false };
}

// 3. Utiliser des presets au lieu de charger des images personnalisées
```

## 📚 Références

### Factory de Stratégies

```typescript
import { createHandStrategyForLayer } from '@kivg/engine/hand-overlay';

// Créer automatiquement la bonne stratégie selon le type
const strategy = createHandStrategyForLayer('text', layerData);
manager.setStrategy(strategy);
```

### Types TypeScript Complets

```typescript
import type {
  HandOverlayStrategy,
  HandPosition,
  HandOverlayConfig,
  EraserLayerData
} from '@kivg/engine/hand-overlay';
```

## 🔗 Ressources Complémentaires

- [Architecture du Moteur](./02-ARCHITECTURE.md)
- [Guide de Configuration](./14-CONFIGURATION.md)
- [Timing Manager](./17-TIMING-MANAGER.md)
- [Background Manager](./19-BACKGROUND-MANAGER.md)
- [Système de Layers](./05-LAYER.md)

---

**Navigation** : [← Précédent : Timing Manager](./17-TIMING-MANAGER.md) | [Suivant : Background Manager →](./19-BACKGROUND-MANAGER.md)
