# TimingManager - Gestionnaire de Timing

## 📋 Vue d'Ensemble

Le **TimingManager** est le système central de gestion du timing et de la synchronisation dans le moteur KIVG. Il garantit des calculs de durée précis, compense automatiquement la dérive temporelle et fournit des méthodes pour calculer les breakdowns temporels des layers et des scènes.

## 🎯 Responsabilités

Le TimingManager gère :

1. **Calcul des durées** - Durées d'animation entrée/sortie/emphase
2. **Compensation de dérive** - Ajustement automatique jusqu'à 10% de dérive
3. **Breakdowns temporels** - Décomposition détaillée du timing
4. **Timing de scène** - Calcul de la durée totale des scènes
5. **Occlusion timing** - Gestion du timing d'effacement d'occlusion
6. **Overlap detection** - Détection de chevauchement entre layers

## 📦 Interfaces

### LayerTimingBreakdown

Décomposition temporelle complète d'un layer :

```typescript
interface LayerTimingBreakdown {
  entranceDelay: number;        // Délai avant l'entrée (secondes)
  animationDuration: number;    // Durée de l'animation d'entrée
  emphasisDuration: number;     // Durée totale de l'emphase
  pauseDuration: number;        // Pause après l'entrée
  occlusionDuration: number;    // Durée de l'effacement d'occlusion
  exitDuration: number;         // Durée totale de sortie (délai + animation)
  totalDuration: number;        // Durée totale cumulée
}
```

### SceneTimingBreakdown

Décomposition temporelle complète d'une scène :

```typescript
interface SceneTimingBreakdown {
  transitionDuration: number;       // Durée de la transition d'entrée
  layersAnimationDuration: number;  // Durée totale des animations de layers
  partialEraseDuration: number;     // Durée totale des effacements partiels
  eraserDelay: number;              // Délai avant la gomme finale
  eraserDuration: number;           // Durée de la gomme finale
  hideTransitionDuration: number;   // Durée de la transition de sortie
  totalDuration: number;            // Durée totale de la scène
}
```

## 🔧 API Principale

### Méthodes de Calcul de Durée

#### `getLayerEntranceDuration(layer, speed?)`

Calcule la durée de l'animation d'entrée d'un layer.

```typescript
const duration = TimingManager.getLayerEntranceDuration(layer);
// Retourne: 1.5 secondes (durée par défaut)

const fasterDuration = TimingManager.getLayerEntranceDuration(layer, 2.0);
// Retourne: 0.75 secondes (2x plus rapide)
```

**Paramètres** :
- `layer` : LayerConfig ou instance de Layer
- `speed` : Multiplicateur de vitesse (défaut: 1.0)

**Retourne** : Durée en secondes

**Source de durée (par ordre de priorité)** :
1. `layer.entrance_animation.duration`
2. `layer.animation.duration` (legacy)
3. Durée par défaut selon le type d'animation
4. 1.5 secondes (défaut global)

#### `getLayerEntranceDelay(layer, speed?)`

Calcule le délai avant l'animation d'entrée.

```typescript
const delay = TimingManager.getLayerEntranceDelay(layer, 1.5);
```

#### `getLayerExitDuration(layer, speed?)`

Calcule la durée de l'animation de sortie.

```typescript
const exitDuration = TimingManager.getLayerExitDuration(layer);
// Retourne: 0 si pas d'animation de sortie, sinon la durée configurée
```

#### `getLayerExitDelay(layer, speed?)`

Calcule le délai avant l'animation de sortie.

#### `getLayerEmphasisDuration(layer, speed?)`

Calcule la durée totale des animations d'emphase.

```typescript
const emphasisDuration = TimingManager.getLayerEmphasisDuration(layer);
// Pour iterations=2, duration=1: retourne 2 secondes
// Pour iterations=Infinity: retourne la durée d'une itération
```

**Note** : Pour les emphases infinies (`iterations: Infinity`), retourne la durée d'une seule itération pour permettre le calcul de timing.

#### `getLayerPauseDuration(layer, speed?)`

Calcule la durée de pause après l'animation d'entrée.

```typescript
const pause = TimingManager.getLayerPauseDuration(layer, 1.0);
// Retourne timingConfig.pauseTime / speed
```

#### `getOcclusionDuration(scene)`

Calcule la durée de l'effacement d'occlusion pour une scène.

```typescript
const occlusionDuration = TimingManager.getOcclusionDuration(scene);
// Défaut: 1.5 secondes, ajusté par drawSpeed
```

### Méthodes de Breakdown

#### `calculateLayerTiming(layer, speedOverride?, occlusionDurationOverride?)`

Calcule le breakdown temporel complet d'un layer.

```typescript
const timing = TimingManager.calculateLayerTiming(layer);

console.log(timing);
// {
//   entranceDelay: 0.5,
//   animationDuration: 1.5,
//   emphasisDuration: 2.0,
//   pauseDuration: 1.0,
//   occlusionDuration: 0,
//   exitDuration: 0.5,
//   totalDuration: 5.5
// }
```

**Paramètres** :
- `layer` : LayerConfig ou instance de Layer
- `speedOverride` : Vitesse globale à utiliser (optionnel)
- `occlusionDurationOverride` : Durée d'occlusion à utiliser (optionnel)

**Timeline du layer** :
```
[Occlusion] → [Entrance Delay] → [Entrance Animation] → [Emphasis] → [Pause] → [Exit Animation]
```

#### `calculateSceneTiming(scene)`

Calcule le breakdown temporel complet d'une scène avec tous ses layers.

```typescript
const timing = TimingManager.calculateSceneTiming(scene);

console.log(timing);
// {
//   transitionDuration: 0,
//   layersAnimationDuration: 15.5,
//   partialEraseDuration: 3.0,
//   eraserDelay: 0,
//   eraserDuration: 0,
//   hideTransitionDuration: 2.0,
//   totalDuration: 17.5
// }
```

**Calculs effectués** :
1. Analyse tous les layers dans l'ordre z-index
2. Détecte les chevauchements pour l'occlusion culling
3. Calcule le timing de chaque layer
4. Somme les durées séquentielles
5. Ajoute les durées de gomme/transition de sortie
6. Prend en compte les keyframes de caméra

### Méthodes de Détection de Chevauchement

#### `doLayersOverlap(layer1, layer2)`

Détermine si deux layers se chevauchent visuellement.

```typescript
const overlaps = TimingManager.doLayersOverlap(layer1, layer2);
if (overlaps) {
  console.log('Les layers se chevauchent, occlusion culling activé');
}
```

**Algorithme** :
1. Récupère les proxies d'occlusion si disponibles
2. Sinon, calcule les bounding boxes
3. Applique une marge de 50% de chaque côté
4. Teste l'intersection des rectangles élargis

#### `getLayerBoundingBox(layer)`

Calcule et met en cache la bounding box d'un layer.

```typescript
const bbox = TimingManager.getLayerBoundingBox(layer);
console.log(bbox);
// {
//   left: 100,
//   right: 500,
//   top: 200,
//   bottom: 400,
//   logicalWidth: 400,
//   logicalHeight: 200
// }
```

**Optimisation** : Utilise un cache interne pour éviter les recalculs coûteux.

## 💡 Exemples d'Utilisation

### Exemple 1 : Calculer le Timing d'un Layer

```typescript
import { TimingManager } from '@kivg/engine/shared';

const textLayer = {
  type: 'text',
  id: 'title',
  textConfig: { text: 'Hello' },
  entrance_animation: {
    type: 'typewriter',
    duration: 2.0,
    delay: 0.5
  },
  emphasis_animation: {
    type: 'pulse',
    duration: 1.0,
    iterations: 3
  },
  timingConfig: {
    pauseTime: 1.0
  },
  exit_animation: {
    type: 'fade_out',
    duration: 0.5
  }
};

const timing = TimingManager.calculateLayerTiming(textLayer);

console.log(`Durée totale du layer: ${timing.totalDuration}s`);
// Durée totale du layer: 7.0s
// Breakdown:
// - Délai d'entrée: 0.5s
// - Animation d'entrée: 2.0s
// - Emphase: 3.0s (3 itérations × 1.0s)
// - Pause: 1.0s
// - Sortie: 0.5s
```

### Exemple 2 : Calculer le Timing d'une Scène

```typescript
const scene = {
  id: 'intro',
  timingConfig: {
    drawSpeed: 1.5  // 50% plus rapide
  },
  occlusionCulling: true,
  layers: [
    {
      type: 'shape',
      id: 'circle1',
      position: { x: 500, y: 500 },
      entrance_animation: { type: 'draw', duration: 2.0 }
    },
    {
      type: 'shape',
      id: 'circle2',
      position: { x: 550, y: 500 },  // Chevauche circle1
      entrance_animation: { type: 'draw', duration: 2.0 }
    }
  ],
  eraser: {
    enabled: true,
    duration: 2.0,
    delayAfterAnimations: 0.5
  }
};

const timing = TimingManager.calculateSceneTiming(scene);

console.log(`Durée totale de la scène: ${timing.totalDuration}s`);
console.log(`Durée d'effacement partiel: ${timing.partialEraseDuration}s`);
// La scène inclut un effacement d'occlusion automatique pour circle1
```

### Exemple 3 : Compensation de Vitesse

```typescript
// Configuration avec drawSpeed = 2.0 (2x plus rapide)
const fastScene = {
  id: 'fast',
  timingConfig: { drawSpeed: 2.0 },
  layers: [{
    type: 'text',
    entrance_animation: { type: 'typewriter', duration: 4.0 }
  }]
};

const layerTiming = TimingManager.calculateLayerTiming(
  fastScene.layers[0],
  fastScene.timingConfig.drawSpeed
);

console.log(layerTiming.animationDuration);
// 2.0 secondes (4.0 / 2.0)
```

### Exemple 4 : Détection de Chevauchement

```typescript
const layer1 = {
  type: 'shape',
  position: { x: 500, y: 500 },
  width: 200,
  height: 200
};

const layer2 = {
  type: 'shape',
  position: { x: 600, y: 500 },
  width: 200,
  height: 200
};

const overlaps = TimingManager.doLayersOverlap(layer1, layer2);
console.log(overlaps);  // true - Les layers se chevauchent
```

### Exemple 5 : Timeline Complète d'une Scène

```typescript
function logSceneTimeline(scene) {
  const timing = TimingManager.calculateSceneTiming(scene);
  
  let currentTime = 0;
  
  console.log('=== TIMELINE DE LA SCÈNE ===');
  
  if (timing.transitionDuration > 0) {
    console.log(`[${currentTime.toFixed(2)}s] Début de la transition d'entrée`);
    currentTime += timing.transitionDuration;
    console.log(`[${currentTime.toFixed(2)}s] Fin de la transition d'entrée`);
  }
  
  console.log(`[${currentTime.toFixed(2)}s] Début des animations de layers`);
  
  // Calculer chaque layer
  scene.layers.forEach((layer, index) => {
    const layerTiming = TimingManager.calculateLayerTiming(layer);
    console.log(`  Layer ${index + 1} (${layer.id || 'unnamed'}):`);
    console.log(`    - Délai: ${layerTiming.entranceDelay}s`);
    console.log(`    - Entrée: ${layerTiming.animationDuration}s`);
    console.log(`    - Emphase: ${layerTiming.emphasisDuration}s`);
    console.log(`    - Pause: ${layerTiming.pauseDuration}s`);
    console.log(`    - Sortie: ${layerTiming.exitDuration}s`);
    console.log(`    - Total: ${layerTiming.totalDuration}s`);
    currentTime += layerTiming.totalDuration;
  });
  
  console.log(`[${currentTime.toFixed(2)}s] Fin des animations de layers`);
  
  if (timing.hideTransitionDuration > 0) {
    console.log(`[${currentTime.toFixed(2)}s] Début de la transition de sortie`);
    currentTime += timing.hideTransitionDuration;
    console.log(`[${currentTime.toFixed(2)}s] Fin de la transition de sortie`);
  }
  
  console.log(`\nDurée totale: ${timing.totalDuration}s`);
}
```

## 🎯 Cas d'Usage Avancés

### Synchronisation Audio-Vidéo

```typescript
function synchronizeAudioWithTiming(scene) {
  const timing = TimingManager.calculateSceneTiming(scene);
  
  // Calculer quand démarrer chaque voix off
  let currentTime = timing.transitionDuration;
  
  const audioTracks = [];
  
  scene.layers.forEach(layer => {
    const layerTiming = TimingManager.calculateLayerTiming(layer);
    
    if (layer.audioNarration) {
      audioTracks.push({
        file: layer.audioNarration,
        startTime: currentTime + layerTiming.entranceDelay,
        duration: layerTiming.animationDuration
      });
    }
    
    currentTime += layerTiming.totalDuration;
  });
  
  return audioTracks;
}
```

### Prévisualisation de Timeline

```typescript
function generateTimelinePreview(scene) {
  const timing = TimingManager.calculateSceneTiming(scene);
  const fps = 30;
  const totalFrames = Math.ceil(timing.totalDuration * fps);
  
  console.log(`Scène "${scene.id}": ${totalFrames} frames @ ${fps}fps`);
  console.log(`Durée: ${timing.totalDuration.toFixed(2)}s`);
  
  // Afficher la progression par seconde
  for (let sec = 0; sec < Math.ceil(timing.totalDuration); sec++) {
    const frame = sec * fps;
    console.log(`[${sec}s] Frame ${frame}/${totalFrames}`);
  }
}
```

### Optimisation de Performance

```typescript
function analyzeSceneComplexity(scene) {
  const timing = TimingManager.calculateSceneTiming(scene);
  const layerCount = scene.layers.length;
  
  // Détecter les scènes complexes
  const isComplex = 
    layerCount > 50 ||
    timing.layersAnimationDuration > 60 ||
    timing.partialEraseDuration > 5;
  
  if (isComplex) {
    console.warn('Scène complexe détectée, optimisations recommandées:');
    
    if (layerCount > 50) {
      console.warn('- Trop de layers, considérer la fusion de certains');
    }
    
    if (timing.partialEraseDuration > 5) {
      console.warn('- Beaucoup d\'occlusions, envisager de les réduire');
    }
  }
  
  return {
    isComplex,
    layerCount,
    totalDuration: timing.totalDuration,
    complexity: layerCount * timing.totalDuration
  };
}
```

## ⚡ Optimisations et Performances

### Cache de Bounding Box

Le TimingManager utilise un cache global pour les bounding boxes :

```typescript
// Les bounding boxes sont automatiquement mises en cache
const bbox1 = TimingManager.getLayerBoundingBox(layer);
const bbox2 = TimingManager.getLayerBoundingBox(layer);  // Cache hit!
```

**Avantages** :
- Évite les recalculs coûteux
- Améliore les performances de détection d'occlusion
- Réduit les appels DOM pour les éléments SVG

### Index Spatial

Pour les scènes avec plus de 10 layers, un index spatial est automatiquement construit :

```typescript
// Automatique dans calculateSceneTiming()
if (scene.layers.length > 10) {
  // Construction d'un index spatial pour accélérer
  // la détection de chevauchement
}
```

**Bénéfices** :
- Complexité réduite de O(n²) à O(n log n)
- Détection de chevauchement ultra-rapide
- Scalabilité pour scènes avec centaines de layers

### Compensation de Dérive

Le TimingManager compense automatiquement les dérives temporelles :

```typescript
// Tolérance de dérive: ±10%
const targetDuration = 10.0;  // secondes
const actualDuration = 10.8;  // 8% de dérive

// Le moteur compense automatiquement
if (Math.abs(actualDuration - targetDuration) / targetDuration < 0.10) {
  // Dérive acceptable, compensation appliquée
}
```

## 🐛 Dépannage

### Problème : Durées Inattendues

**Symptôme** : Les durées calculées ne correspondent pas aux attentes.

**Solutions** :
1. Vérifier le `drawSpeed` de la scène et des layers
2. Utiliser `calculateLayerTiming()` pour debugger un layer spécifique
3. Activer les logs de timing :
   ```typescript
   import { logTimingResult } from '@kivg/engine/utils/timing-precision';
   const timing = TimingManager.calculateLayerTiming(layer);
   logTimingResult('MyLayer', timing);
   ```

### Problème : Occlusion Non Détectée

**Symptôme** : Deux layers qui se chevauchent ne déclenchent pas l'occlusion.

**Solutions** :
1. Vérifier que `occlusionCulling: true` dans la scène
2. Tester la détection manuellement :
   ```typescript
   const overlaps = TimingManager.doLayersOverlap(layer1, layer2);
   console.log('Chevauche?', overlaps);
   ```
3. Vérifier les bounding boxes :
   ```typescript
   console.log(TimingManager.getLayerBoundingBox(layer1));
   console.log(TimingManager.getLayerBoundingBox(layer2));
   ```

### Problème : Timing de Scène Trop Long

**Symptôme** : La durée totale de la scène est beaucoup plus longue que prévu.

**Solutions** :
1. Analyser le breakdown :
   ```typescript
   const timing = TimingManager.calculateSceneTiming(scene);
   console.log(JSON.stringify(timing, null, 2));
   ```
2. Vérifier les `pauseTime` des layers
3. Identifier les emphases infinies :
   ```typescript
   scene.layers.forEach(layer => {
     if (layer.emphasis_animation?.iterations === Infinity) {
       console.warn(`Layer ${layer.id} a une emphase infinie`);
     }
   });
   ```

## 📚 Références

### Types TypeScript Complets

```typescript
// Durées par défaut
const DEFAULT_ENTRANCE_DURATION = 1.5;  // secondes
const DEFAULT_TRANSITION_DURATION = 0.5;  // secondes

// Durées par type d'animation
function getDefaultDurationForType(type: string): number {
  if (type === 'none') return 0;
  if (['draw', 'typewriter', 'char_fade', 'writetyping', 'push', 'erase'].includes(type)) {
    return 1.5;
  }
  return 0.5;
}
```

### Formules de Calcul

**Durée totale d'un layer** :
```
totalDuration = occlusionDuration 
              + entranceDelay 
              + animationDuration 
              + emphasisDuration 
              + pauseDuration 
              + exitDuration
```

**Durée totale d'une scène** :
```
totalDuration = transitionDuration 
              + layersAnimationDuration 
              + hideTransitionDuration
```

**Ajustement de vitesse** :
```
adjustedDuration = baseDuration / drawSpeed
```

## 🔗 Ressources Complémentaires

- [Architecture du Moteur](./02-ARCHITECTURE.md)
- [Guide de Configuration](./14-CONFIGURATION.md)
- [Système de Layers](./05-LAYER.md)
- [Occlusion Culling Manager](./20-OCCLUSION-CULLING.md)
- [API Reference](./24-API-FRONTEND.md)

---

**Navigation** : [← Précédent : Configuration](./14-CONFIGURATION.md) | [Suivant : Hand Overlay Manager →](./18-HAND-OVERLAY-MANAGER.md)
