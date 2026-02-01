# Système Éditeur (Editor)

## 📋 Vue d'Ensemble

Le **système éditeur** (`src/editor`) est une interface visuelle interactive basée sur Konva.js qui permet de créer, éditer et prévisualiser des scènes d'animation KIVG de manière intuitive.

## 🎯 Objectif

L'éditeur fournit une interface WYSIWYG (What You See Is What You Get) pour :
- Créer et éditer des scènes visuellement
- Gérer plusieurs caméras dans de grandes scènes
- Manipuler des layers avec des contrôles interactifs
- Prévisualiser les animations en temps réel
- Exporter la configuration finale

## 🏗️ Architecture

```
src/editor/
└── canvas/                    # Éditeur basé sur Konva.js
    ├── scene-canvas.ts        # Canvas principal et orchestration
    ├── konva-camera.ts        # Système de caméra éditable
    ├── konva-background.ts    # Arrière-plans et grilles
    ├── layer-*.ts             # Éditeurs de layers spécifiques
    ├── camera-controls.ts     # Contrôles de caméra UI
    ├── camera-animator.ts     # Prévisualisation d'animations caméra
    ├── zoom-controls.ts       # Contrôles de zoom
    ├── scrollbars.ts          # Barres de défilement
    ├── smart-guides.ts        # Guides intelligents d'alignement
    ├── history.ts             # Système undo/redo
    ├── clipboard.ts           # Copier/coller
    ├── text-editor.ts         # Éditeur de texte inline
    ├── export.ts              # Export de configuration
    └── quick-camera-nav.ts    # Navigation rapide par caméra
```

## 📦 Composant Principal : SceneCanvas

### Création d'une Instance

```typescript
import { SceneCanvas, type SceneConfig } from './editor/canvas';

const config: SceneConfig = {
  id: 'scene-1',
  name: 'Ma Scène',
  width: 4000,    // Taille virtuelle (peut être > viewport)
  height: 3000,
  background: {
    color: '#ffffff',
    grid: {
      type: 'dots',
      size: 20,
      color: '#cccccc'
    }
  },
  cameras: [{
    id: 'camera-1',
    name: 'Vue Principale',
    position: { x: 0, y: 0 },
    width: 1920,
    height: 1080,
    zoom: 1.0
  }],
  layers: []
};

const sceneCanvas = new SceneCanvas(
  'container-id',
  config,
  {
    onLayerSelect: (layerId) => console.log('Selected:', layerId),
    onLayerChange: (layer) => console.log('Changed:', layer),
    onCameraChange: (camera) => console.log('Camera updated:', camera)
  }
);
```

### Méthodes Principales

```typescript
class SceneCanvas {
  // Gestion des Layers
  addLayer(config: BaseLayerConfig): string;
  removeLayer(layerId: string): void;
  updateLayer(layerId: string, updates: Partial<BaseLayerConfig>): void;
  selectLayer(layerId: string | null): void;
  getSelectedLayerId(): string | null;
  getAllLayers(): BaseLayerConfig[];
  
  // Gestion des Caméras
  addCamera(camera: Camera): void;
  removeCamera(cameraId: string): void;
  updateCamera(cameraId: string, updates: Partial<Camera>): void;
  selectCamera(cameraId: string | null): void;
  getAllCameras(): Camera[];
  duplicateCamera(cameraId: string): void;
  
  // Historique (Undo/Redo)
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  
  // Clipboard
  copy(): void;
  paste(): void;
  cut(): void;
  
  // Vue et Navigation
  setZoom(zoom: number): void;
  getZoom(): number;
  centerView(): void;
  fitToView(): void;
  
  // Export
  exportConfig(): SceneConfig;
  exportToJSON(): string;
  
  // Nettoyage
  destroy(): void;
}
```

## 🎨 Types de Layers Supportés

### 1. Image Layer

```typescript
interface ImageLayerConfig extends BaseLayerConfig {
  type: 'image';
  src: string;
  width?: number;
  height?: number;
}

// Utilisation
sceneCanvas.addLayer({
  type: 'image',
  src: '/images/logo.png',
  position: { x: 100, y: 100 },
  width: 300,
  height: 200
});
```

### 2. Text Layer

```typescript
interface TextLayerConfig extends BaseLayerConfig {
  type: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: 'normal' | 'bold' | 'italic';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

// Utilisation
sceneCanvas.addLayer({
  type: 'text',
  text: 'Hello World',
  fontSize: 48,
  fontFamily: 'Arial',
  color: '#000000',
  position: { x: 200, y: 150 }
});
```

### 3. SVG Layer

```typescript
interface SvgLayerConfig extends BaseLayerConfig {
  type: 'svg';
  src: string;          // URL du fichier SVG
  width?: number;
  height?: number;
}

// Utilisation
sceneCanvas.addLayer({
  type: 'svg',
  src: '/icons/star.svg',
  position: { x: 300, y: 200 },
  width: 100,
  height: 100
});
```

### 4. Shape Layer

```typescript
interface ShapeLayerConfig extends BaseLayerConfig {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'polygon';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  width?: number;
  height?: number;
  // Propriétés spécifiques selon shapeType
  radius?: number;        // Pour circle
  radiusX?: number;       // Pour ellipse
  radiusY?: number;
  points?: number;        // Pour star, polygon
  innerRadius?: number;   // Pour star
}

// Utilisation
sceneCanvas.addLayer({
  type: 'shape',
  shapeType: 'rectangle',
  width: 200,
  height: 150,
  fill: '#ff6b6b',
  stroke: '#000000',
  strokeWidth: 2,
  position: { x: 100, y: 100 }
});
```

## 📷 Système de Caméra

### Configuration de Caméra

```typescript
interface Camera {
  id: string;
  name?: string;
  position: { x: number; y: number };  // Position absolue dans la scène
  width?: number;                       // Largeur du viewport
  height?: number;                      // Hauteur du viewport
  zoom?: number;                        // Niveau de zoom (0.1 - 3.0)
  locked?: boolean;                     // Verrouillage
  isDefault?: boolean;                  // Caméra par défaut
  color?: string;                       // Couleur de bordure
}
```

### Manipulation des Caméras

```typescript
// Ajouter une nouvelle caméra
const cameraId = sceneCanvas.addCamera({
  id: 'cam-2',
  name: 'Vue Détail',
  position: { x: 1000, y: 500 },
  width: 1280,
  height: 720,
  zoom: 1.5
});

// Mettre à jour
sceneCanvas.updateCamera('cam-2', {
  position: { x: 1200, y: 600 },
  zoom: 2.0
});

// Dupliquer
sceneCanvas.duplicateCamera('cam-2');

// Supprimer
sceneCanvas.removeCamera('cam-2');

// Verrouiller/déverrouiller
sceneCanvas.updateCamera('cam-2', { locked: true });
```

### Navigation Pan/Zoom

L'éditeur supporte plusieurs méthodes de navigation :

```typescript
// Navigation par drag
// - Maintenir SPACE + glisser souris
// - Bouton milieu de souris + glisser

// Zoom
// - Molette de souris (centré sur curseur)
// - Contrôles de zoom UI
// - Raccourcis: Ctrl/Cmd + / Ctrl/Cmd -

// Méthodes programmatiques
sceneCanvas.setZoom(1.5);
sceneCanvas.centerView();        // Centre la vue sur la scène
sceneCanvas.fitToView();         // Ajuste la vue pour voir toute la scène
```

## 🎯 Fonctionnalités Avancées

### 1. Guides Intelligents (Smart Guides)

Les guides intelligents aident à aligner les layers automatiquement :

```typescript
// Activés automatiquement lors du déplacement
// Alignement sur :
// - Bords d'autres layers
// - Centres d'autres layers
// - Bords de la scène
// - Centres de caméras
```

### 2. Historique (Undo/Redo)

```typescript
// Opérations trackées automatiquement :
// - Ajout/suppression de layers
// - Modification de propriétés
// - Transformations (déplacement, rotation, scale)

// Utilisation
sceneCanvas.undo();    // Ctrl/Cmd + Z
sceneCanvas.redo();    // Ctrl/Cmd + Shift + Z

// Vérifier disponibilité
if (sceneCanvas.canUndo()) {
  sceneCanvas.undo();
}
```

### 3. Clipboard (Copier/Coller)

```typescript
// Sélectionner un layer puis :
sceneCanvas.copy();    // Ctrl/Cmd + C
sceneCanvas.cut();     // Ctrl/Cmd + X
sceneCanvas.paste();   // Ctrl/Cmd + V

// Le collage crée une copie décalée
// de 20px pour éviter la superposition exacte
```

### 4. Sélection Multiple

```typescript
// Maintenir Shift + cliquer pour sélection multiple
// Opérations disponibles :
// - Déplacement groupé
// - Suppression groupée
// - Copier/coller groupé
// - Alignement groupé
```

### 5. Éditeur de Texte Inline

Double-cliquer sur un text layer pour éditer directement :

```typescript
// Fonctionnalités :
// - Édition WYSIWYG
// - Mise en forme (gras, italique)
// - Alignement
// - Taille de police
// - Couleur
// - Police de caractères
```

## 🔄 Animation de Caméra

### Prévisualisation d'Animations

```typescript
import { CameraAnimator } from './editor/canvas/camera-animator';

const animator = new CameraAnimator(stage, cameras);

// Prévisualiser une transition entre caméras
animator.animateBetweenCameras(
  'camera-1',
  'camera-2',
  2000,           // Durée en ms
  'easeInOutQuad' // Fonction d'easing
);

// Arrêter l'animation
animator.stop();
```

### Easing Functions Disponibles

```typescript
// Linear
'linear'

// Quadratic
'easeInQuad', 'easeOutQuad', 'easeInOutQuad'

// Cubic
'easeInCubic', 'easeOutCubic', 'easeInOutCubic'

// Quartic
'easeInQuart', 'easeOutQuart', 'easeInOutQuart'

// Quintic
'easeInQuint', 'easeOutQuint', 'easeInOutQuint'

// Sinusoidal
'easeInSine', 'easeOutSine', 'easeInOutSine'

// Exponential
'easeInExpo', 'easeOutExpo', 'easeInOutExpo'

// Circular
'easeInCirc', 'easeOutCirc', 'easeInOutCirc'

// Elastic
'easeInElastic', 'easeOutElastic', 'easeInOutElastic'

// Back
'easeInBack', 'easeOutBack', 'easeInOutBack'

// Bounce
'easeInBounce', 'easeOutBounce', 'easeInOutBounce'
```

## 💾 Export de Configuration

### Export Simple

```typescript
// Obtenir la configuration complète
const config = sceneCanvas.exportConfig();

// Obtenir le JSON
const json = sceneCanvas.exportToJSON();

// Sauvegarder dans un fichier
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'scene-config.json';
a.click();
```

### Export Avancé avec Options

```typescript
import { exportSceneConfig } from './editor/canvas/export';

const exportOptions = {
  format: 'json',           // ou 'yaml'
  pretty: true,             // Formatage lisible
  includeDefaults: false,   // Exclure valeurs par défaut
  minify: false,            // Minifier le JSON
  validation: true          // Valider avant export
};

const exported = exportSceneConfig(config, exportOptions);
```

## 🎨 Arrière-plans (Backgrounds)

### Types d'Arrière-plans

```typescript
// Couleur simple
background: {
  color: '#ffffff'
}

// Avec grille de points
background: {
  color: '#ffffff',
  grid: {
    type: 'dots',
    size: 20,
    color: '#cccccc',
    opacity: 0.5
  }
}

// Avec grille de lignes
background: {
  color: '#f8f9fa',
  grid: {
    type: 'lines',
    size: 50,
    color: '#dee2e6',
    lineWidth: 1
  }
}

// Avec grille de carrés
background: {
  color: '#ffffff',
  grid: {
    type: 'squares',
    size: 100,
    color: '#e9ecef',
    lineWidth: 2
  }
}

// Avec grille hexagonale
background: {
  color: '#fefefe',
  grid: {
    type: 'hexagonal',
    size: 30,
    color: '#adb5bd',
    opacity: 0.3
  }
}

// Avec grille isométrique
background: {
  color: '#ffffff',
  grid: {
    type: 'isometric',
    size: 40,
    color: '#6c757d',
    opacity: 0.2
  }
}

// Avec template/image
background: {
  color: '#ffffff',
  template: {
    src: '/templates/wireframe.png',
    opacity: 0.3
  }
}
```

## ⚡ Optimisations et Performance

### Grandes Scènes

Pour les scènes de très grande taille (>5000px) :

```typescript
const config: SceneConfig = {
  id: 'large-scene',
  width: 10000,   // Scène immense
  height: 8000,
  // L'éditeur gère automatiquement :
  // - Rendu optimisé par viewport
  // - Lazy loading des images
  // - Culling des éléments hors écran
};
```

### Nombre de Layers

L'éditeur peut gérer efficacement jusqu'à 500+ layers :

```typescript
// Optimisations automatiques :
// - Virtualisation des layers non visibles
// - Cache des transformations
// - Batching des opérations de rendu
```

## 🎹 Raccourcis Clavier

### Navigation
- **Space + Drag** : Pan (déplacement de la vue)
- **Molette** : Zoom in/out
- **Ctrl/Cmd + +** : Zoom in
- **Ctrl/Cmd + -** : Zoom out
- **Ctrl/Cmd + 0** : Reset zoom (100%)

### Édition
- **Ctrl/Cmd + Z** : Undo
- **Ctrl/Cmd + Shift + Z** : Redo
- **Ctrl/Cmd + C** : Copy
- **Ctrl/Cmd + X** : Cut
- **Ctrl/Cmd + V** : Paste
- **Delete/Backspace** : Supprimer sélection
- **Ctrl/Cmd + A** : Sélectionner tout

### Layers
- **Shift + Click** : Sélection multiple
- **Ctrl/Cmd + Click** : Ajouter/retirer de sélection
- **Double-Click** : Éditer texte (text layer)
- **Alt + Drag** : Dupliquer en déplaçant

### Transformation
- **Shift + Drag** : Déplacement contraint (H/V)
- **Shift + Rotate** : Rotation par incréments de 15°
- **Shift + Scale** : Scale proportionnel

## 🐛 Debugging et Développement

### Mode Debug

```typescript
// Activer le mode debug
sceneCanvas.setDebugMode(true);

// Informations affichées :
// - Bounding boxes des layers
// - Axes de transformation
// - Positions des caméras
// - FPS et performance
// - Logs d'événements
```

### Logs

```typescript
// Logger les événements
sceneCanvas.on('layer:transform', (e) => {
  console.log('Layer transformé:', e.layerId, e.transform);
});

sceneCanvas.on('camera:change', (e) => {
  console.log('Caméra changée:', e.cameraId, e.properties);
});
```

## 📝 Meilleures Pratiques

### 1. Nommage des Éléments

```typescript
// Toujours donner des noms significatifs
{
  cameras: [
    { id: 'cam-intro', name: 'Introduction' },
    { id: 'cam-detail', name: 'Vue Détaillée' }
  ],
  layers: [
    { id: 'layer-title', name: 'Titre Principal', type: 'text' },
    { id: 'layer-logo', name: 'Logo Entreprise', type: 'image' }
  ]
}
```

### 2. Organisation des Layers

```typescript
// Utiliser z_index pour gérer l'ordre
layers: [
  { z_index: 0, name: 'Background' },
  { z_index: 10, name: 'Content' },
  { z_index: 20, name: 'Overlay' }
]
```

### 3. Verrouillage

```typescript
// Verrouiller les éléments importants
// pour éviter les modifications accidentelles
{
  locked: true,
  name: 'Template Background - NE PAS MODIFIER'
}
```

### 4. Groupes Logiques

```typescript
// Préfixer les noms pour créer des groupes visuels
layers: [
  { name: 'Intro_Title' },
  { name: 'Intro_Subtitle' },
  { name: 'Intro_Background' },
  { name: 'Content_Text' },
  { name: 'Content_Image' }
]
```

## 🔗 Intégration avec le Frontend

La configuration exportée depuis l'éditeur peut être directement utilisée dans le frontend :

```typescript
// 1. Créer et exporter depuis l'éditeur
const sceneCanvas = new SceneCanvas('editor', config);
// ... édition ...
const exportedConfig = sceneCanvas.exportConfig();

// 2. Utiliser dans le frontend
import { Whiteboard } from '@kivg/engine';

const whiteboard = new Whiteboard({
  containerId: 'player',
  scenes: [exportedConfig]  // Utiliser la config exportée
});

await whiteboard.prepare();
whiteboard.play();
```

## 📚 Ressources

### Exemples de Code
- `examples/editor-basic.html` - Exemple basique
- `examples/editor-advanced.html` - Exemple avancé
- `examples/editor-multi-camera.html` - Multi-caméras

### Documentation Connexe
- [Architecture](./02-ARCHITECTURE.md)
- [Système Scene](./04-SCENE.md)
- [Système Layer](./05-LAYER.md)
- [Système Caméra](./31-CAMERA-EDITEUR.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
