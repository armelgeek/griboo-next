# BackgroundManager - Gestionnaire d'Arrière-plan

## 📋 Vue d'Ensemble

Le **BackgroundManager** gère l'affichage et l'animation des arrière-plans dans le moteur KIVG. Il supporte les couleurs unies, les grilles de différents types, les dégradés, les images de fond et les effets visuels, le tout avec une synchronisation parfaite avec la caméra.

## 🎯 Responsabilités

Le BackgroundManager gère :

1. **Couleurs de fond** - Couleurs unies ou dégradés
2. **Grilles** - 5 types de grilles (points, lignes, carrés, hexagones, isométrique)
3. **Images de fond** - Templates/textures avec opacité
4. **Effets visuels** - Flou, filtres de couleur
5. **Animations** - Défilement, rotation, pulsation
6. **Synchronisation caméra** - Transformation automatique avec les mouvements de caméra
7. **Préchargement** - Chargement anticipé des images de fond

## 🏗️ Architecture

```
BackgroundManager
  ├── SVG Container
  │   ├── <defs> (Patterns, Gradients, Filters)
  │   ├── <rect> Background Rect (couleur/gradient)
  │   └── <g> Background Group (éléments suivant la caméra)
  │       ├── Grid Pattern
  │       ├── Template Image
  │       └── Effects
  └── Animation Loop (optionnel)
```

## 📦 Interface BackgroundConfig

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
```

### GridConfig - Configuration de Grille

```typescript
interface GridConfig {
  type: GridType;                 // Type de grille (OBLIGATOIRE)
  size?: number;                  // Taille du motif en pixels (défaut: 20)
  color?: string;                 // Couleur (défaut: '#cccccc')
  opacity?: number;               // Opacité 0-1 (défaut: 0.5)
  lineWidth?: number;             // Épaisseur des lignes (défaut: 1)
}

type GridType = 
  | 'dots'       // Points réguliers
  | 'lines'      // Lignes horizontales
  | 'squares'    // Carrés (grille standard)
  | 'hexagonal'  // Hexagones (nid d'abeille)
  | 'isometric'; // Grille isométrique (30°/150°)
```

### GradientConfig - Configuration de Dégradé

```typescript
interface GradientConfig {
  type: 'linear' | 'radial';      // Type de dégradé
  stops: GradientStop[];          // Points de couleur
  
  // Pour gradient linéaire
  angle?: number;                 // Angle en degrés (défaut: 0)
  
  // Pour gradient radial
  cx?: number;                    // Centre X en pourcentage (défaut: 50)
  cy?: number;                    // Centre Y en pourcentage (défaut: 50)
  r?: number;                     // Rayon en pourcentage (défaut: 50)
}

interface GradientStop {
  offset: number;                 // Position 0-1
  color: string;                  // Couleur CSS
  opacity?: number;               // Opacité optionnelle 0-1
}
```

### TemplateConfig - Configuration de Template

```typescript
interface TemplateConfig {
  url: string;                    // URL de l'image (OBLIGATOIRE)
  opacity?: number;               // Opacité 0-1 (défaut: 1)
}
```

### BackgroundEffectConfig - Effets Visuels

```typescript
interface BackgroundEffectConfig {
  blur?: number;                  // Flou en pixels
  grayscale?: number;             // Niveau de gris 0-1
  sepia?: number;                 // Effet sépia 0-1
  brightness?: number;            // Luminosité (1 = normal)
  contrast?: number;              // Contraste (1 = normal)
  hueRotate?: number;             // Rotation de teinte en degrés
  invert?: number;                // Inversion 0-1
}
```

### BackgroundAnimationConfig - Animations

```typescript
interface BackgroundAnimationConfig {
  type: 'scroll' | 'rotate' | 'pulse';  // Type d'animation
  
  // Pour 'scroll'
  speedX?: number;                // Vitesse horizontale (pixels/seconde)
  speedY?: number;                // Vitesse verticale (pixels/seconde)
  
  // Pour 'rotate'
  rotationSpeed?: number;         // Vitesse de rotation (degrés/seconde)
  
  // Pour 'pulse'
  pulseFrequency?: number;        // Fréquence en Hz (défaut: 1)
  pulseIntensity?: number;        // Intensité 0-1 (défaut: 0.1)
}
```

## 🎨 Types de Grilles

### 1. Grille de Points (dots)

Points régulièrement espacés.

```typescript
const dotsGrid: GridConfig = {
  type: 'dots',
  size: 25,
  color: '#e0e0e0',
  opacity: 0.6,
  lineWidth: 2  // Rayon des points
};
```

**Rendu SVG** :
```xml
<pattern id="grid-dots" width="25" height="25">
  <circle cx="12.5" cy="12.5" r="2" fill="#e0e0e0" opacity="0.6"/>
</pattern>
```

**Cas d'usage** : Cahiers, notebooks, designs minimalistes.

### 2. Grille de Lignes (lines)

Lignes horizontales parallèles.

```typescript
const linesGrid: GridConfig = {
  type: 'lines',
  size: 30,
  color: '#b0b0b0',
  opacity: 0.4,
  lineWidth: 1
};
```

**Rendu SVG** :
```xml
<pattern id="grid-lines" width="30" height="30">
  <line x1="0" y1="15" x2="30" y2="15" 
        stroke="#b0b0b0" stroke-width="1" opacity="0.4"/>
</pattern>
```

**Cas d'usage** : Feuilles lignées, effets de style cahier.

### 3. Grille de Carrés (squares)

Grille carrée standard.

```typescript
const squaresGrid: GridConfig = {
  type: 'squares',
  size: 50,
  color: '#cccccc',
  opacity: 0.5,
  lineWidth: 1
};
```

**Rendu SVG** :
```xml
<pattern id="grid-squares" width="50" height="50">
  <rect x="0" y="0" width="50" height="50" 
        fill="none" stroke="#cccccc" stroke-width="1" opacity="0.5"/>
</pattern>
```

**Cas d'usage** : Papier millimétré, grilles techniques, designs géométriques.

### 4. Grille Hexagonale (hexagonal)

Motif en nid d'abeille.

```typescript
const hexGrid: GridConfig = {
  type: 'hexagonal',
  size: 30,
  color: '#3498db',
  opacity: 0.3,
  lineWidth: 2
};
```

**Algorithme** :
```typescript
// Dimensions hexagone
const hexWidth = size * Math.sqrt(3);
const hexHeight = size * 2;

// Pattern avec décalage vertical pour effet "brick"
pattern.setAttribute('width', hexWidth);
pattern.setAttribute('height', size * 3);
```

**Cas d'usage** : Designs modernes, arrière-plans tech, effets futuristes.

### 5. Grille Isométrique (isometric)

Grille avec angles 30°/150° pour perspective isométrique.

```typescript
const isoGrid: GridConfig = {
  type: 'isometric',
  size: 40,
  color: '#2ecc71',
  opacity: 0.4,
  lineWidth: 1
};
```

**Algorithme** :
```typescript
// Lignes à 30° et 150°
const isoWidth = size * Math.sqrt(3);
const isoHeight = size;

// Crée un losange avec diagonales
const path = `M 0,${ih/2} L ${iw/2},0 L ${iw},${ih/2} L ${iw/2},${ih} Z 
              M 0,${ih/2} L ${iw},${ih/2} 
              M ${iw/2},0 L ${iw/2},${ih}`;
```

**Cas d'usage** : Dessins isométriques, jeux vidéo, architecture.

## 🔧 API du BackgroundManager

### Initialisation

```typescript
import { BackgroundManager } from '@kivg/engine/background';

const svg = document.querySelector('#whiteboard-svg');
const manager = new BackgroundManager(svg, 1920, 1080);
```

### Appliquer un Arrière-plan

#### Couleur Simple

```typescript
// Couleur unie
manager.apply('#ffffff');

// Ou avec objet
manager.apply({
  color: '#f0f0f0'
});
```

#### Couleur + Grille

```typescript
manager.apply({
  color: '#ffffff',
  grid: {
    type: 'dots',
    size: 25,
    color: '#e0e0e0',
    opacity: 0.5
  }
});
```

#### Dégradé Linéaire

```typescript
manager.apply({
  gradient: {
    type: 'linear',
    angle: 135,  // Diagonal
    stops: [
      { offset: 0, color: '#667eea' },
      { offset: 1, color: '#764ba2' }
    ]
  }
});
```

#### Dégradé Radial

```typescript
manager.apply({
  gradient: {
    type: 'radial',
    cx: 50,  // Centre
    cy: 50,
    r: 70,   // Rayon
    stops: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.5, color: '#3498db', opacity: 0.8 },
      { offset: 1, color: '#2c3e50' }
    ]
  }
});
```

#### Image de Fond

```typescript
manager.apply({
  color: '#ffffff',
  template: {
    url: '/assets/notebook-texture.jpg',
    opacity: 0.3
  }
});
```

#### Configuration Complète

```typescript
manager.apply({
  color: '#fafafa',
  grid: {
    type: 'squares',
    size: 50,
    color: '#e0e0e0',
    opacity: 0.4
  },
  template: {
    url: '/assets/paper-texture.png',
    opacity: 0.2
  },
  effects: {
    blur: 0.5,
    brightness: 1.1
  },
  animation: {
    type: 'scroll',
    speedX: 10,
    speedY: 5
  }
});
```

### Synchronisation avec la Caméra

```typescript
// Mettre à jour la transformation caméra
manager.setCameraTransform(
  zoom,           // Niveau de zoom (ex: 1.5)
  position,       // Position {x: 0.5, y: 0.5} normalisée 0-1
  virtualSize     // Taille virtuelle {width: 1920, height: 1080}
);

// Le BackgroundManager applique automatiquement la transformation
// aux grilles et templates pour suivre la caméra
```

### Préchargement d'Images

```typescript
// Précharger avant utilisation
await manager.preload();

// Ou précharger une URL spécifique
await manager.preloadUrl('/assets/background.jpg');
```

### Mise à Jour des Dimensions

```typescript
// Redimensionner le background
manager.updateDimensions(newWidth, newHeight);
```

### Nettoyage

```typescript
// Nettoyer les ressources
manager.cleanup();
```

## 💡 Exemples d'Utilisation

### Exemple 1 : Tableau Blanc avec Grille de Points

```typescript
const manager = new BackgroundManager(svg, 1920, 1080);

manager.apply({
  color: '#ffffff',
  grid: {
    type: 'dots',
    size: 30,
    color: '#d0d0d0',
    opacity: 0.5
  }
});
```

### Exemple 2 : Fond Dégradé Moderne

```typescript
manager.apply({
  gradient: {
    type: 'linear',
    angle: 135,
    stops: [
      { offset: 0, color: '#fa709a' },
      { offset: 0.5, color: '#fee140' },
      { offset: 1, color: '#30cfd0' }
    ]
  }
});
```

### Exemple 3 : Cahier Ligné Réaliste

```typescript
manager.apply({
  color: '#fffef0',  // Papier légèrement jauni
  template: {
    url: '/assets/paper-texture.jpg',
    opacity: 0.15
  },
  grid: {
    type: 'lines',
    size: 40,
    color: '#3498db',
    opacity: 0.3,
    lineWidth: 1
  }
});
```

### Exemple 4 : Grille Isométrique pour Dessin Technique

```typescript
manager.apply({
  color: '#f8f9fa',
  grid: {
    type: 'isometric',
    size: 50,
    color: '#2ecc71',
    opacity: 0.4,
    lineWidth: 1
  }
});
```

### Exemple 5 : Arrière-plan Animé

```typescript
manager.apply({
  color: '#ffffff',
  grid: {
    type: 'hexagonal',
    size: 30,
    color: '#3498db',
    opacity: 0.3
  },
  animation: {
    type: 'scroll',
    speedX: 5,
    speedY: 2
  }
});

// L'animation démarre automatiquement
```

### Exemple 6 : Effets Visuels Artistiques

```typescript
manager.apply({
  template: {
    url: '/assets/watercolor-texture.jpg',
    opacity: 0.6
  },
  effects: {
    blur: 1,
    brightness: 1.2,
    contrast: 0.9,
    hueRotate: 15
  }
});
```

### Exemple 7 : Avec Synchronisation Caméra

```typescript
const manager = new BackgroundManager(svg, 1920, 1080);

manager.apply({
  color: '#ffffff',
  grid: {
    type: 'squares',
    size: 50,
    color: '#e0e0e0',
    opacity: 0.5
  }
});

// Lors du zoom/pan de la caméra
function onCameraUpdate(zoom, position) {
  manager.setCameraTransform(
    zoom,
    position,
    { width: 1920, height: 1080 }
  );
  // La grille suit automatiquement la caméra
}
```

## 🎯 Cas d'Usage Avancés

### Animation Personnalisée

```typescript
class CustomBackgroundManager extends BackgroundManager {
  private customAnimationTime = 0;
  
  startCustomAnimation() {
    const animate = () => {
      this.customAnimationTime += 0.016;  // ~60fps
      
      // Modifier dynamiquement la transformation
      const offsetX = Math.sin(this.customAnimationTime) * 10;
      const offsetY = Math.cos(this.customAnimationTime) * 10;
      
      // Appliquer la transformation personnalisée
      this.applyCustomTransform(offsetX, offsetY);
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
}
```

### Arrière-plan Réactif à la Progression

```typescript
function updateBackgroundBasedOnProgress(progress: number) {
  // Changer la grille au fil de la progression
  const gridSize = 20 + progress * 30;  // De 20 à 50
  const opacity = 0.3 + progress * 0.3;  // De 0.3 à 0.6
  
  manager.apply({
    color: '#ffffff',
    grid: {
      type: 'squares',
      size: gridSize,
      color: '#3498db',
      opacity: opacity
    }
  });
}
```

### Transitions de Fond

```typescript
async function transitionBackground(fromConfig, toConfig, duration) {
  const steps = 60;  // 60 frames
  const delay = duration / steps * 1000;
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    
    // Interpoler entre les deux configurations
    const interpolatedConfig = interpolateConfigs(fromConfig, toConfig, progress);
    
    manager.apply(interpolatedConfig);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

function interpolateConfigs(from, to, progress) {
  return {
    color: interpolateColor(from.color, to.color, progress),
    grid: {
      type: to.grid.type,
      size: from.grid.size + (to.grid.size - from.grid.size) * progress,
      opacity: from.grid.opacity + (to.grid.opacity - from.grid.opacity) * progress
    }
  };
}
```

### Préchargement Intelligent

```typescript
async function preloadAllBackgrounds(scenes) {
  const urls = new Set();
  
  // Collecter toutes les URLs de fond
  scenes.forEach(scene => {
    if (scene.background?.template?.url) {
      urls.add(scene.background.template.url);
    }
  });
  
  // Précharger en parallèle
  await Promise.all(
    Array.from(urls).map(url => manager.preloadUrl(url))
  );
  
  console.log(`${urls.size} arrière-plans préchargés`);
}
```

## ⚡ Optimisations et Performances

### Évitement de Réapplication Inutile

```typescript
// Le BackgroundManager détecte automatiquement si la config est identique
manager.apply(config1);  // Applique
manager.apply(config1);  // Skip (config identique)
manager.apply(config2);  // Applique (config différente)
```

### Cache de Patterns SVG

```typescript
// Les patterns SVG sont automatiquement cachés
const patternId = `grid-pattern-${type}-${size}-${color}`;
let pattern = defs.querySelector(`#${patternId}`);

if (!pattern) {
  // Créer seulement si n'existe pas
  pattern = GridRenderer.createPattern(patternId, gridConfig);
  defs.appendChild(pattern);
}
```

### Optimisation de Rendu

```typescript
// Éléments fixes (couleur/gradient) ne suivent pas la caméra
// Seuls les éléments du backgroundGroup sont transformés

backgroundRect.setAttribute('fill', color);  // Fixe
backgroundGroup.setAttribute('transform', ...);  // Suit la caméra
```

### Préchargement avec Cache HTTP

```typescript
// Utilise le cache HTTP du navigateur
await manager.preloadUrl('https://example.com/bg.jpg');
// Les requêtes suivantes utilisent le cache
```

## 🐛 Dépannage

### Problème : La Grille ne S'affiche pas

**Vérifications** :
```typescript
// 1. Vérifier la configuration
console.log(manager['currentConfig']);

// 2. Vérifier le SVG
const pattern = svg.querySelector('pattern');
console.log('Pattern trouvé:', pattern);

// 3. Vérifier l'opacité
console.log('Opacité:', gridConfig.opacity);  // Doit être > 0

// 4. Vérifier la taille
console.log('Taille:', gridConfig.size);  // Doit être raisonnable (10-100)
```

### Problème : Image de Fond ne Se Charge pas

**Solutions** :
```typescript
// 1. Tester le préchargement
try {
  await manager.preloadUrl('/assets/bg.jpg');
  console.log('Image chargée avec succès');
} catch (error) {
  console.error('Échec du chargement:', error);
}

// 2. Vérifier CORS pour images externes
// Les images doivent être servies avec les bons headers CORS

// 3. Vérifier le chemin
const fullUrl = new URL('/assets/bg.jpg', window.location.href);
console.log('URL complète:', fullUrl.toString());
```

### Problème : La Grille ne Suit pas la Caméra

**Solution** :
```typescript
// S'assurer que setCameraTransform est appelée
manager.setCameraTransform(zoom, position, virtualSize);

// Vérifier la transformation appliquée
const group = svg.querySelector('#whiteboard-background-group');
console.log('Transform:', group.getAttribute('transform'));
```

### Problème : Performance Dégradée avec Animation

**Optimisations** :
```typescript
// 1. Utiliser requestAnimationFrame au lieu de setInterval
// (déjà fait dans le BackgroundManager)

// 2. Désactiver l'animation si non nécessaire
manager.apply({
  ...config,
  animation: undefined  // Pas d'animation
});

// 3. Réduire la complexité de la grille
manager.apply({
  grid: {
    type: 'dots',  // Plus performant que 'hexagonal'
    size: 50       // Grille plus espacée = moins d'éléments
  }
});
```

## 📚 Renderers Internes

### GridRenderer

Génère les patterns SVG pour les grilles.

```typescript
GridRenderer.createPattern(id, config): SVGPatternElement
```

### GradientRenderer

Génère les gradients SVG.

```typescript
GradientRenderer.createGradient(id, config): SVGGradientElement
```

### TemplateRenderer

Génère les éléments `<image>` SVG.

```typescript
TemplateRenderer.createTemplate(config, width, height): SVGImageElement
```

### FilterRenderer

Génère les filtres SVG pour les effets.

```typescript
FilterRenderer.createFilter(id, config): SVGFilterElement
```

## 🎨 Formules de Transformation

### Transformation Caméra

```typescript
// Calcul des coordonnées viewport
const centerX = virtualSize.width * cameraPosition.x;
const centerY = virtualSize.height * cameraPosition.y;

const translateX = viewportWidth / 2 - centerX * zoom;
const translateY = viewportHeight / 2 - centerY * zoom;

// Transformation SVG
transform = `translate(${translateX}, ${translateY}) scale(${zoom})`;
```

### Animation Scroll

```typescript
// Offset basé sur le temps écoulé
const elapsed = (now - startTime) / 1000;  // secondes
const offsetX = speedX * elapsed * zoom;
const offsetY = speedY * elapsed * zoom;

transform = `translate(${baseX + offsetX}, ${baseY + offsetY}) scale(${zoom})`;
```

### Animation Pulse

```typescript
// Pulsation sinusoïdale
const pulse = 1 + Math.sin(elapsed * frequency * Math.PI * 2) * intensity;
const scale = zoom * pulse;

transform = `translate(${x}, ${y}) scale(${scale})`;
```

## 🔗 Ressources Complémentaires

- [Architecture du Moteur](./02-ARCHITECTURE.md)
- [Guide de Configuration](./14-CONFIGURATION.md)
- [Système de Caméra](./15-CAMERA.md)
- [Hand Overlay Manager](./18-HAND-OVERLAY-MANAGER.md)
- [Occlusion Culling](./20-OCCLUSION-CULLING.md)

---

**Navigation** : [← Précédent : Hand Overlay Manager](./18-HAND-OVERLAY-MANAGER.md) | [Suivant : Occlusion Culling →](./20-OCCLUSION-CULLING.md)
