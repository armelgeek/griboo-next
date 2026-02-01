# OcclusionCullingManager - Gestionnaire d'Occlusion

## 📋 Vue d'Ensemble

Le **OcclusionCullingManager** est un système d'optimisation intelligent qui détecte automatiquement les superpositions de layers et "efface" les parties cachées des layers inférieurs. Ce système améliore le réalisme des animations de type tableau blanc tout en optimisant les performances de rendu.

## 🎯 Responsabilités

L'OcclusionCullingManager gère :

1. **Détection d'occlusion** - Identifie les layers qui se chevauchent
2. **Calcul de masques** - Détermine les zones à effacer
3. **Animation d'effacement** - Anime le gommage des zones cachées
4. **Optimisation spatiale** - Index spatial pour grandes scènes (>100 layers)
5. **Worker offloading** - Calculs lourds en Web Worker
6. **Gestion du cache** - Cache des masques d'occlusion
7. **Seek intelligent** - Restauration d'état lors du seek

## 🏗️ Architecture

```
OcclusionCullingManager
  ├── Spatial Index (>100 layers)
  │   └── Quad-tree pour détection rapide
  │
  ├── Content Mask Cache
  │   └── Cache des proxies d'occlusion
  │
  ├── Web Worker (optionnel)
  │   └── Calculs d'occlusion en background
  │
  ├── OcclusionLogic (shared)
  │   ├── Détection de chevauchement
  │   └── Calcul de masques géométriques
  │
  └── GeometricEraseData[]
      └── Chemins d'effacement par layer
```

## 📦 Interfaces

### OcclusionSceneContext

Interface pour le contexte de scène nécessaire :

```typescript
interface OcclusionSceneContext {
  id: string;                           // ID de la scène
  config: SceneConfig;                  // Configuration de la scène
  layers: Map<string, Layer>;           // Map des layers par ID
  layerOrder: string[];                 // Ordre z-index des layers
  parentSvg: SVGSVGElement | null;      // Élément SVG parent
  handOverlayCanvas: HTMLCanvasElement | null;  // Canvas pour la main
  sceneHandOverlayManager: HandOverlayManager | null;  // Manager de main
  
  // Cache d'effacement partiel
  partialEraseCache: {
    get(key: string): GeometricEraseData[] | undefined;
    set(key: string, value: GeometricEraseData[]): void;
    clear(): void;
  };
  
  partialEraseEnabled: boolean;         // Effacement partiel activé
  
  // Méthodes utilitaires
  parseBackgroundColor(color: any): [number, number, number];
  setHandOverlayManager(manager: HandOverlayManager): void;
  getSceneDimensions(): { width: number; height: number };
}
```

### GeometricEraseData

Données décrivant un effacement géométrique :

```typescript
interface GeometricEraseData {
  layerIds: string[];                   // IDs des layers affectés
  path: Point[];                        // Chemin de la gomme
  radius: number;                       // Rayon de la gomme (pixels)
  showEraser: boolean;                  // Afficher la main gomme
}

interface Point {
  x: number;
  y: number;
}
```

### OcclusionProxy

Proxy léger pour représenter la forme d'un layer :

```typescript
interface OcclusionProxy {
  type: 'rectangle' | 'circle' | 'path' | 'complex';
  
  // Pour rectangle
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  
  // Pour circle
  cx?: number;
  cy?: number;
  r?: number;
  
  // Pour path/complex
  points?: Point[];
  bounds?: LayerBoundingBox;
}
```

## 🔧 API Principale

### Initialisation

```typescript
import { OcclusionCullingManager } from '@kivg/engine/occlusion';

const manager = new OcclusionCullingManager(sceneContext);
```

### Réinitialisation

```typescript
// Réinitialiser l'état d'occlusion
manager.reset();

// Efface tous les caches et l'état des effacements
```

### Marquer comme Effacé

```typescript
// Marquer manuellement un layer comme ayant été effacé
// Utilisé lors des opérations de seek
manager.markAsAutoErased('layer-id');
```

### Nettoyage

```typescript
// Nettoyer les ressources
manager.destroy();
```

## 💡 Fonctionnement

### Processus de Détection

```
1. Scene avec occlusionCulling: true
   └→ Analyse des layers dans l'ordre z-index

2. Pour chaque layer L[i]
   └→ Comparer avec tous les layers précédents L[0..i-1]
      └→ Si chevauchement détecté
         └→ Calculer le masque d'effacement
            └→ Créer GeometricEraseData
               └→ Animer l'effacement

3. Stocker dans partialEraseCache
   └→ Pour réutilisation lors du seek
```

### Algorithme de Détection de Chevauchement

```typescript
function detectOverlap(layer1, layer2): boolean {
  // 1. Obtenir les proxies d'occlusion
  const proxy1 = layer1.getOcclusionProxy();
  const proxy2 = layer2.getOcclusionProxy();
  
  // 2. Tester l'intersection selon le type
  if (proxy1.type === 'rectangle' && proxy2.type === 'rectangle') {
    return rectanglesIntersect(proxy1, proxy2);
  }
  
  if (proxy1.type === 'circle' && proxy2.type === 'circle') {
    return circlesIntersect(proxy1, proxy2);
  }
  
  // 3. Fallback sur les bounding boxes
  return boundingBoxesIntersect(
    TimingManager.getLayerBoundingBox(layer1),
    TimingManager.getLayerBoundingBox(layer2)
  );
}
```

### Calcul du Masque d'Effacement

```typescript
function calculateEraseMask(hiddenLayer, visibleLayer): GeometricEraseData {
  // 1. Obtenir la zone de chevauchement
  const overlapArea = getOverlapArea(hiddenLayer, visibleLayer);
  
  // 2. Générer le chemin de gomme
  const erasePath = generateErasePath(overlapArea);
  
  // 3. Déterminer le rayon de la gomme
  const radius = calculateEraseRadius(overlapArea);
  
  return {
    layerIds: [hiddenLayer.id],
    path: erasePath,
    radius: radius,
    showEraser: true
  };
}
```

## 🎯 Exemples d'Utilisation

### Exemple 1 : Configuration Basique

```typescript
const scene: SceneConfig = {
  id: 'demo',
  occlusionCulling: true,  // Activer l'occlusion culling
  occlusionCullingConfig: {
    duration: 1.5,         // Durée de l'effacement (secondes)
    showHand: true         // Afficher la main gomme
  },
  layers: [
    {
      type: 'shape',
      id: 'circle1',
      position: { x: 500, y: 500 },
      shapeConfig: { shape: 'circle', radius: 100 }
    },
    {
      type: 'shape',
      id: 'circle2',
      position: { x: 550, y: 500 },  // Chevauche circle1
      shapeConfig: { shape: 'circle', radius: 100 }
    }
  ]
};

// L'OcclusionCullingManager détecte automatiquement
// le chevauchement et efface la zone cachée de circle1
```

### Exemple 2 : Désactivation pour un Layer Spécifique

```typescript
const layer: LayerConfig = {
  type: 'image',
  id: 'background-image',
  imageUrl: '/assets/bg.jpg',
  occlusionCulling: false,  // Ce layer ne sera jamais effacé
  zIndex: 0
};

// Même si d'autres layers le recouvrent,
// background-image ne sera pas effacé
```

### Exemple 3 : Occlusion avec Texte

```typescript
const scene: SceneConfig = {
  id: 'text-demo',
  occlusionCulling: true,
  layers: [
    {
      type: 'text',
      id: 'title-1',
      position: { x: 500, y: 500 },
      textConfig: { text: 'Premier Titre', fontSize: 64 },
      entrance_animation: { type: 'typewriter', duration: 2 }
    },
    {
      type: 'text',
      id: 'title-2',
      position: { x: 500, y: 520 },  // Chevauche légèrement
      textConfig: { text: 'Deuxième Titre', fontSize: 64 },
      entrance_animation: { type: 'typewriter', duration: 2 }
    }
  ]
};

// La partie cachée de title-1 sera effacée
// avec un chemin suivant les contours du texte
```

### Exemple 4 : Occlusion Complexe avec Multiples Layers

```typescript
const complexScene: SceneConfig = {
  id: 'complex',
  occlusionCulling: true,
  occlusionCullingConfig: {
    duration: 2.0,
    showHand: true
  },
  layers: [
    // Layer 1 : Fond
    {
      type: 'shape',
      id: 'background',
      position: { x: 400, y: 400 },
      shapeConfig: { shape: 'rectangle', width: 600, height: 400 },
      zIndex: 0
    },
    // Layer 2 : Chevauche partiellement le fond
    {
      type: 'shape',
      id: 'middle',
      position: { x: 500, y: 450 },
      shapeConfig: { shape: 'circle', radius: 150 },
      zIndex: 1
    },
    // Layer 3 : Chevauche middle et background
    {
      type: 'shape',
      id: 'top',
      position: { x: 600, y: 500 },
      shapeConfig: { shape: 'circle', radius: 100 },
      zIndex: 2
    }
  ]
};

// Résultat :
// - background : zones cachées par middle et top effacées
// - middle : zone cachée par top effacée
// - top : rien n'est effacé (layer supérieur)
```

### Exemple 5 : Utilisation Programmatique

```typescript
import { OcclusionCullingManager } from '@kivg/engine/occlusion';

const context: OcclusionSceneContext = {
  id: 'my-scene',
  config: sceneConfig,
  layers: new Map(),
  layerOrder: ['layer1', 'layer2', 'layer3'],
  parentSvg: svgElement,
  handOverlayCanvas: canvasElement,
  sceneHandOverlayManager: handManager,
  partialEraseCache: new Map(),
  partialEraseEnabled: true,
  parseBackgroundColor: (color) => [255, 255, 255],
  setHandOverlayManager: (manager) => {},
  getSceneDimensions: () => ({ width: 1920, height: 1080 })
};

const occlusionManager = new OcclusionCullingManager(context);

// Le manager est maintenant utilisé automatiquement
// lors du rendu des layers
```

### Exemple 6 : Seek avec Restauration d'État

```typescript
// Lors d'une opération de seek, l'état d'occlusion doit être restauré

function seekToTime(targetTime: number) {
  // 1. Réinitialiser l'état
  occlusionManager.reset();
  
  // 2. Calculer quels layers sont visibles à ce moment
  const visibleLayers = getVisibleLayersAt(targetTime);
  
  // 3. Rejouer les occlusions
  visibleLayers.forEach((layer, index) => {
    if (index > 0) {
      // Vérifier si ce layer cache des layers précédents
      for (let i = 0; i < index; i++) {
        const prevLayer = visibleLayers[i];
        if (TimingManager.doLayersOverlap(layer, prevLayer)) {
          // Marquer comme effacé sans animer
          occlusionManager.markAsAutoErased(prevLayer.id);
        }
      }
    }
  });
  
  // 4. Rendre la frame cible
  renderFrame(targetTime);
}
```

## 🚀 Optimisations

### Index Spatial pour Grandes Scènes

Pour les scènes avec plus de 100 layers, un index spatial est automatiquement construit :

```typescript
// Automatique dans le manager
if (layerOrder.length > 100) {
  // Construction d'un quad-tree spatial
  spatialIndex.buildIndex(layers, getBoundingBox);
  
  // Détection O(log n) au lieu de O(n)
  const overlapping = spatialIndex.findOverlappingLayers(
    currentLayer,
    currentIndex,
    getBoundingBox
  );
}
```

**Bénéfices** :
- Complexité réduite de O(n²) à O(n log n)
- Scalabilité jusqu'à 1000+ layers
- Détection ultra-rapide

### Web Worker Offloading

Les calculs lourds sont déportés dans un Web Worker :

```typescript
// Automatique pour scènes complexes
if (isWorkerSupported && layerOrder.length > 100) {
  const result = await callWorker('BUILD_INDEX', {
    layers: layersData,
    layerOrder: layerOrder
  });
  
  // Les calculs se font en background
  // sans bloquer le thread principal
}
```

**Avantages** :
- Interface reste fluide
- Rendu non bloqué
- Utilisation multi-cœurs

### Cache de Masques

Les masques d'occlusion sont mis en cache :

```typescript
// Cache interne automatique
private contentMaskCache: Map<string, {
  proxy: OcclusionProxy,
  timestamp: number
}>;

// Évite le recalcul des proxies coûteux
```

### Seek Intelligent

Le manager garde l'état précédent pour optimiser les seeks :

```typescript
private lastSeekState: Map<string, {
  progress: number;
  pathIndex: number;
  pathD: string;
}>;

// Permet des transitions incrémentales
// au lieu de tout recalculer
```

## 🎨 Proxies d'Occlusion

### Types de Proxies

#### Rectangle

```typescript
const rectangleProxy: OcclusionProxy = {
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 400,
  height: 300
};
```

#### Circle

```typescript
const circleProxy: OcclusionProxy = {
  type: 'circle',
  cx: 500,
  cy: 500,
  r: 150
};
```

#### Path

```typescript
const pathProxy: OcclusionProxy = {
  type: 'path',
  points: [
    { x: 100, y: 100 },
    { x: 200, y: 150 },
    { x: 300, y: 100 }
  ],
  bounds: {
    left: 100,
    right: 300,
    top: 100,
    bottom: 150
  }
};
```

### Implémentation dans les Layers

```typescript
class MyCustomLayer extends BaseLayer {
  /**
   * Retourne un proxy léger pour la détection d'occlusion
   */
  getOcclusionProxy(): OcclusionProxy {
    if (this.shapeType === 'circle') {
      return {
        type: 'circle',
        cx: this.position.x,
        cy: this.position.y,
        r: this.radius
      };
    }
    
    // Fallback sur rectangle
    return {
      type: 'rectangle',
      x: this.position.x - this.width / 2,
      y: this.position.y - this.height / 2,
      width: this.width,
      height: this.height
    };
  }
}
```

## 📊 Métriques et Performance

### Mesurer l'Impact

```typescript
console.time('Occlusion Detection');

const occlusionManager = new OcclusionCullingManager(context);
// ... détection automatique ...

console.timeEnd('Occlusion Detection');
// Occlusion Detection: 12.5ms (pour 50 layers)
```

### Analyse de Complexité

```typescript
function analyzeOcclusionComplexity(scene) {
  const layerCount = scene.layers.length;
  
  // Sans optimisation
  const naiveComplexity = layerCount * (layerCount - 1) / 2;
  
  // Avec index spatial
  const optimizedComplexity = layerCount * Math.log2(layerCount);
  
  console.log(`Layers: ${layerCount}`);
  console.log(`Naive complexity: ${naiveComplexity} comparisons`);
  console.log(`Optimized: ~${Math.ceil(optimizedComplexity)} comparisons`);
  console.log(`Gain: ${(naiveComplexity / optimizedComplexity).toFixed(1)}x`);
}

// Exemple avec 100 layers :
// Layers: 100
// Naive complexity: 4950 comparisons
// Optimized: ~664 comparisons
// Gain: 7.5x
```

## 🐛 Dépannage

### Problème : Occlusion Non Détectée

**Diagnostic** :
```typescript
// 1. Vérifier que l'occlusion est activée
console.log(scene.occlusionCulling);  // Doit être true

// 2. Vérifier le chevauchement manuel
const overlap = TimingManager.doLayersOverlap(layer1, layer2);
console.log('Chevauchement:', overlap);

// 3. Vérifier les bounding boxes
const bbox1 = TimingManager.getLayerBoundingBox(layer1);
const bbox2 = TimingManager.getLayerBoundingBox(layer2);
console.log('BBox 1:', bbox1);
console.log('BBox 2:', bbox2);

// 4. Vérifier le z-index
console.log('zIndex layer1:', layer1.zIndex);
console.log('zIndex layer2:', layer2.zIndex);
// layer2 doit avoir un zIndex supérieur
```

### Problème : Performance Dégradée

**Solutions** :
```typescript
// 1. Vérifier le nombre de layers
if (scene.layers.length > 100) {
  console.log('Scène complexe détectée');
  // L'index spatial devrait s'activer automatiquement
}

// 2. Désactiver l'occlusion pour les layers statiques
backgroundLayers.forEach(layer => {
  layer.occlusionCulling = false;
});

// 3. Simplifier les proxies d'occlusion
class OptimizedLayer extends BaseLayer {
  getOcclusionProxy() {
    // Utiliser un rectangle même pour des formes complexes
    return {
      type: 'rectangle',
      ...this.getBoundingBox()
    };
  }
}
```

### Problème : Effacement Incorrect

**Diagnostic** :
```typescript
// 1. Vérifier le cache d'effacement
console.log(scene.partialEraseCache);

// 2. Vérifier les données d'effacement
const eraseData = scene.partialEraseCache.get(layer.id);
console.log('EraseData:', eraseData);

// 3. Vérifier la durée d'effacement
console.log('Duration:', scene.occlusionCullingConfig?.duration);

// 4. Tester manuellement le proxy
const proxy = layer.getOcclusionProxy();
console.log('Proxy:', proxy);
```

### Problème : Memory Leak

**Solution** :
```typescript
// Nettoyer explicitement le manager
occlusionManager.destroy();

// Nettoyer les caches
scene.partialEraseCache.clear();
occlusionManager.reset();
```

## 🔬 Détails d'Implémentation

### Algorithme de Génération de Chemin

```typescript
function generateErasePath(overlapArea: Rectangle): Point[] {
  const path: Point[] = [];
  const { left, top, width, height } = overlapArea;
  
  // Stratégie de balayage horizontal
  const rows = Math.ceil(height / eraseRadius);
  
  for (let row = 0; row < rows; row++) {
    const y = top + row * eraseRadius;
    const evenRow = row % 2 === 0;
    
    if (evenRow) {
      // Gauche → Droite
      for (let x = left; x <= left + width; x += eraseRadius) {
        path.push({ x, y });
      }
    } else {
      // Droite → Gauche (zigzag pour continuité)
      for (let x = left + width; x >= left; x -= eraseRadius) {
        path.push({ x, y });
      }
    }
  }
  
  return path;
}
```

### Test d'Intersection Rectangle-Rectangle

```typescript
function rectanglesIntersect(r1: Rectangle, r2: Rectangle): boolean {
  return !(
    r1.right <= r2.left ||
    r1.left >= r2.right ||
    r1.bottom <= r2.top ||
    r1.top >= r2.bottom
  );
}
```

### Test d'Intersection Cercle-Cercle

```typescript
function circlesIntersect(c1: Circle, c2: Circle): boolean {
  const dx = c2.cx - c1.cx;
  const dy = c2.cy - c1.cy;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = c1.r + c2.r;
  
  return distanceSquared <= radiusSum * radiusSum;
}
```

## 📚 Références

### Configuration dans SceneConfig

```typescript
interface SceneConfig {
  occlusionCulling?: boolean;     // Activer (défaut: false)
  occlusionCullingConfig?: {
    duration?: number;            // Durée effacement (défaut: 1.5s)
    showHand?: boolean;           // Afficher main (défaut: true)
  };
}
```

### Configuration dans LayerConfig

```typescript
interface LayerConfig {
  occlusionCulling?: boolean;     // Participer (défaut: true)
}
```

### Constantes

```typescript
const DEFAULT_ERASE_FRAME_RATE = 30;  // FPS pour animations d'effacement
const OCCLUSION_DEFAULT_DURATION = 1.5;  // Durée par défaut (secondes)
const SPATIAL_INDEX_THRESHOLD = 100;  // Seuil pour activation index spatial
```

## 🔗 Ressources Complémentaires

- [Architecture du Moteur](./02-ARCHITECTURE.md)
- [Timing Manager](./17-TIMING-MANAGER.md)
- [Hand Overlay Manager](./18-HAND-OVERLAY-MANAGER.md)
- [Guide de Configuration](./14-CONFIGURATION.md)
- [Guide de Performance](./23-PERFORMANCE.md)

---

**Navigation** : [← Précédent : Background Manager](./19-BACKGROUND-MANAGER.md) | [Suivant : Exemples →](./21-EXEMPLES.md)
