# Éditeur de Caméra

## 📋 Vue d'Ensemble

L'**éditeur de caméra** est un système avancé qui permet de gérer plusieurs caméras dans des scènes de grande taille, offrant des contrôles visuels interactifs et des fonctionnalités d'animation sophistiquées.

## 🎯 Cas d'Usage

### Scènes Immenses
- Créer des scènes virtuelles de 4000×3000px ou plus
- Définir plusieurs points de vue (caméras) dans la scène
- Animer des transitions fluides entre caméras
- Zoomer et explorer différentes régions

### Production Vidéo
- Planifier des séquences de caméra pour l'export vidéo
- Prévisualiser les mouvements de caméra
- Définir des timings précis pour chaque vue
- Créer des effets cinématographiques (zoom, pan, etc.)

## 📷 Concepts de Base

### Caméra vs Scène

```
┌─────────────────────────────────────┐
│   Scène Virtuelle (4000×3000)       │
│                                     │
│   ┌──────────┐                     │
│   │ Caméra 1 │  (1920×1080)        │
│   │  Intro   │                     │
│   └──────────┘                     │
│                                     │
│              ┌──────────┐          │
│              │ Caméra 2 │          │
│              │  Détail  │          │
│              └──────────┘          │
│                                     │
│   ┌──────────┐                     │
│   │ Caméra 3 │                     │
│   │  Outro   │                     │
│   └──────────┘                     │
└─────────────────────────────────────┘
```

### Propriétés d'une Caméra

```typescript
interface Camera {
  // Identification
  id: string;                         // ID unique
  name?: string;                      // Nom descriptif
  
  // Position et Taille
  position: { x: number; y: number }; // Position absolue (pixels)
  width?: number;                     // Largeur viewport (défaut: 1920)
  height?: number;                    // Hauteur viewport (défaut: 1080)
  
  // Zoom
  zoom?: number;                      // 0.1 à 3.0 (défaut: 1.0)
  
  // Animation (pour export vidéo)
  duration?: number;                  // Durée d'affichage (secondes)
  transition_duration?: number;       // Durée transition vers suivante
  easing?: string;                    // Fonction d'easing
  
  // État
  locked?: boolean;                   // Verrouillage édition
  isDefault?: boolean;                // Caméra par défaut
  
  // Apparence
  color?: string;                     // Couleur bordure (hex)
}
```

## 🎨 Interface Utilisateur

### Vue Canvas

Les caméras sont représentées visuellement sur le canvas :

```typescript
// Apparence visuelle :
// - Rectangle de bordure coloré
// - Nom de la caméra en haut à gauche
// - Poignées de redimensionnement
// - Indicateur de verrouillage (si locked)
// - Style spécial pour caméra sélectionnée
```

### Panneau de Contrôle

```typescript
interface CameraControlPanel {
  // Liste des caméras
  cameraList: {
    displayName: string;
    isSelected: boolean;
    isLocked: boolean;
    isDefault: boolean;
  }[];
  
  // Propriétés de la caméra sélectionnée
  properties: {
    name: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    zoom: number;
    locked: boolean;
  };
  
  // Actions
  actions: {
    add: () => void;
    remove: () => void;
    duplicate: () => void;
    lock: () => void;
    setAsDefault: () => void;
  };
}
```

## 🛠️ Manipulation des Caméras

### Création d'une Caméra

```typescript
// Méthode programmatique
sceneCanvas.addCamera({
  id: 'camera-detail',
  name: 'Vue Détail',
  position: { x: 1000, y: 500 },
  width: 1280,
  height: 720,
  zoom: 1.5,
  color: '#3498db'
});

// Via l'interface
// 1. Cliquer sur "Ajouter Caméra"
// 2. La nouvelle caméra apparaît au centre de la vue
// 3. Ajuster position et taille visuellement
```

### Sélection

```typescript
// Méthode programmatique
sceneCanvas.selectCamera('camera-detail');

// Via l'interface
// 1. Cliquer sur la bordure de la caméra sur le canvas
// 2. OU cliquer dans la liste des caméras
// 3. La caméra sélectionnée affiche des poignées de transformation
```

### Déplacement

```typescript
// Via drag & drop
// 1. Cliquer sur la bordure (pas les poignées)
// 2. Glisser vers la nouvelle position
// 3. Relâcher

// Avec guides intelligents
// - Les guides apparaissent automatiquement
// - Alignement sur autres caméras
// - Alignement sur bords de scène
// - Snapping pour alignement précis
```

### Redimensionnement

```typescript
// Via les poignées
// 1. Sélectionner la caméra
// 2. Glisser une des 8 poignées de redimensionnement
// 3. Maintenir SHIFT pour conserver le ratio

// Méthode programmatique
sceneCanvas.updateCamera('camera-detail', {
  width: 1600,
  height: 900
});
```

### Zoom

```typescript
// Via le panneau de propriétés
// Slider de zoom : 0.1× à 3.0×

// Méthode programmatique
sceneCanvas.updateCamera('camera-detail', {
  zoom: 2.0
});

// Effet visuel
// Le contenu de la scène visible dans la caméra
// est agrandi selon le facteur de zoom
```

### Verrouillage

```typescript
// Verrouiller pour empêcher modifications
sceneCanvas.updateCamera('camera-detail', {
  locked: true
});

// Une caméra verrouillée :
// - Ne peut pas être déplacée
// - Ne peut pas être redimensionnée
// - Affiche une icône de cadenas
// - Peut toujours être sélectionnée (pour voir propriétés)
```

### Duplication

```typescript
// Créer une copie d'une caméra existante
sceneCanvas.duplicateCamera('camera-detail');

// Résultat :
// - Nouvelle caméra avec ID unique
// - Nom suffixé avec " (Copie)"
// - Mêmes propriétés (position décalée de 20px)
// - Non verrouillée même si l'originale l'était
```

### Suppression

```typescript
// Méthode programmatique
sceneCanvas.removeCamera('camera-detail');

// Via l'interface
// Bouton "Supprimer" dans le panneau
// Note : La caméra par défaut ne peut pas être supprimée
```

## 🎬 Animation de Caméra

### Configuration d'Animation

```typescript
// Définir la durée d'affichage
sceneCanvas.updateCamera('camera-1', {
  duration: 5  // Affichée pendant 5 secondes
});

// Définir la transition vers la caméra suivante
sceneCanvas.updateCamera('camera-1', {
  transition_duration: 2,     // Transition de 2 secondes
  easing: 'easeInOutCubic'   // Fonction d'easing
});
```

### Prévisualisation

```typescript
import { CameraAnimator } from './editor/canvas/camera-animator';

// Créer l'animateur
const animator = new CameraAnimator(stage, cameras);

// Animer entre deux caméras
animator.animateBetweenCameras(
  'camera-1',
  'camera-2',
  2000,              // 2 secondes
  'easeInOutQuad'
);

// Animer vers une position/zoom spécifique
animator.animateToPosition(
  { x: 1000, y: 500 },
  1.5,               // zoom
  1500,              // 1.5 secondes
  'easeOutCubic'
);

// Arrêter l'animation
animator.stop();
```

### Séquence de Caméras

```typescript
// Configuration pour l'export vidéo
const cameraSequence = [
  {
    id: 'camera-intro',
    name: 'Introduction',
    position: { x: 0, y: 0 },
    duration: 5,                    // 5 secondes
    transition_duration: 2,         // 2s vers suivante
    easing: 'easeInOutQuad'
  },
  {
    id: 'camera-detail',
    name: 'Détail',
    position: { x: 1500, y: 800 },
    zoom: 2.0,
    duration: 8,
    transition_duration: 1.5,
    easing: 'easeInOutCubic'
  },
  {
    id: 'camera-outro',
    name: 'Conclusion',
    position: { x: 500, y: 300 },
    zoom: 1.0,
    duration: 4,
    transition_duration: 0,         // Pas de transition (fin)
    easing: 'linear'
  }
];

// Lors de l'export vidéo, les caméras seront
// animées dans cet ordre avec les timings définis
```

## 🎮 Navigation Rapide

### Quick Camera Navigation

Le système de navigation rapide permet de passer instantanément d'une caméra à l'autre pendant l'édition :

```typescript
import { QuickCameraNav } from './editor/canvas/quick-camera-nav';

const quickNav = new QuickCameraNav(sceneCanvas);

// Navigation clavier
// 1, 2, 3, ... : Passer à la caméra N
// Tab : Caméra suivante
// Shift+Tab : Caméra précédente

// Navigation visuelle
// Minimap avec aperçu de toutes les caméras
// Cliquer sur une miniature pour y aller
```

### Minimap

```typescript
interface MinimapConfig {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  size: number;              // Taille de la minimap
  opacity: number;           // 0-1
  showCameras: boolean;      // Afficher les caméras
  showLayers: boolean;       // Afficher les layers
}

const minimap = new Minimap(sceneCanvas, {
  position: 'bottom-right',
  size: 200,
  opacity: 0.8,
  showCameras: true,
  showLayers: true
});
```

## 📐 Contrôles de Caméra Avancés

### Pan & Zoom

```typescript
// Navigation libre dans la scène
// Indépendante des caméras définies

// Pan (déplacement)
// - Space + Drag
// - Bouton milieu souris + Drag
// - Flèches directionnelles

// Zoom
// - Molette souris (centré sur curseur)
// - Ctrl/Cmd + +/-
// - Pinch sur trackpad
// - Contrôles UI

// Reset
sceneCanvas.centerView();     // Centrer sur scène
sceneCanvas.fitToView();      // Ajuster pour voir toute la scène
sceneCanvas.setZoom(1.0);     // Zoom 100%
```

### Scrollbars

```typescript
// Barres de défilement automatiques
// Apparaissent quand la scène dépasse le viewport

const scrollbars = new Scrollbars(stage, {
  width: viewportWidth,
  height: viewportHeight,
  contentWidth: sceneWidth,
  contentHeight: sceneHeight,
  onScroll: (x, y) => {
    // Callback lors du scroll
  }
});
```

### Zoom Controls UI

```typescript
const zoomControls = new ZoomControls(container, {
  minZoom: 0.1,
  maxZoom: 3.0,
  step: 0.1,
  onChange: (zoom) => {
    sceneCanvas.setZoom(zoom);
  }
});

// Boutons :
// - Zoom In (+)
// - Zoom Out (-)
// - Fit (ajuster à la vue)
// - 100% (reset)
// - Slider continu
```

## 🎨 Personnalisation Visuelle

### Couleurs de Caméra

```typescript
// Chaque caméra peut avoir sa propre couleur
sceneCanvas.updateCamera('camera-1', {
  color: '#e74c3c'  // Rouge
});

sceneCanvas.updateCamera('camera-2', {
  color: '#3498db'  // Bleu
});

sceneCanvas.updateCamera('camera-3', {
  color: '#2ecc71'  // Vert
});

// Utile pour :
// - Identifier rapidement les caméras
// - Organisation visuelle
// - Groupes logiques
```

### Styles de Bordure

```typescript
// Configuration globale des styles
interface CameraStyle {
  borderWidth: number;        // Épaisseur bordure
  borderStyle: 'solid' | 'dashed' | 'dotted';
  selectedBorderWidth: number;
  selectedOpacity: number;
  lockedOpacity: number;
  handleSize: number;         // Taille des poignées
  handleColor: string;
}
```

## 📊 Informations et Statistiques

### Overlay d'Informations

```typescript
// Afficher des infos en temps réel sur les caméras
interface CameraInfoOverlay {
  showPosition: boolean;      // Position (x, y)
  showDimensions: boolean;    // Dimensions (w × h)
  showZoom: boolean;          // Niveau de zoom
  showCoverage: boolean;      // % de scène couverte
  showName: boolean;          // Nom de la caméra
}

// Exemple d'affichage :
// ┌─────────────────────┐
// │ Intro               │
// │ 0, 0                │
// │ 1920 × 1080         │
// │ Zoom: 1.0×          │
// │ Couverture: 12%     │
// └─────────────────────┘
```

### Calculs Automatiques

```typescript
// Le système calcule automatiquement :

// Couverture de scène
const coverage = (camera.width * camera.height) / (scene.width * scene.height);
// Exemple : 12% de la scène totale

// Résolution effective
const effectiveWidth = camera.width * camera.zoom;
const effectiveHeight = camera.height * camera.zoom;
// Avec zoom 2.0 : 3840 × 2160 effective

// Chevauchement entre caméras
const overlap = calculateCameraOverlap(camera1, camera2);
// Retourne % de chevauchement et zone commune
```

## ⚡ Performance

### Optimisations

```typescript
// Rendu optimisé automatiquement
// - Seules les caméras visibles sont rendues
// - Cache des transformations
// - Dirty checking pour éviter re-renders inutiles
// - GPU acceleration via Konva

// Pour scènes avec 10+ caméras :
// Pas de dégradation perceptible de performance
```

### Limits Recommandés

```typescript
// Nombre de caméras : Illimité en théorie
// Recommandé : < 20 caméras pour une UX optimale

// Taille de scène : Illimité en théorie
// Recommandé : < 10000 × 10000 pixels

// Zoom min/max : 0.1× à 3.0×
// Peut être étendu si nécessaire
```

## 🔗 Intégration avec le Frontend

### Export pour Rendu Vidéo

```typescript
// 1. Créer et configurer les caméras dans l'éditeur
const cameras = sceneCanvas.getAllCameras();

// 2. Exporter la configuration
const config = sceneCanvas.exportConfig();

// 3. Utiliser dans le frontend pour l'animation
import { Whiteboard } from '@kivg/engine';

const whiteboard = new Whiteboard({
  scenes: [{
    ...config,
    // Les caméras seront animées automatiquement
    // selon leurs durées et transitions
  }]
});
```

### Système de Caméra Frontend

```typescript
// Le frontend interprète la configuration caméra :
// - Anime les transitions entre caméras
// - Applique les fonctions d'easing
// - Gère le timing précis
// - Synchronise avec les layers et audio

// Voir documentation frontend pour détails :
// docs/fr/32-CAMERA-FRONTEND.md
```

## 📝 Meilleures Pratiques

### 1. Nommage Cohérent

```typescript
// Utiliser des noms descriptifs
cameras: [
  { id: 'cam-01-intro', name: 'Introduction - Vue Large' },
  { id: 'cam-02-detail', name: 'Détail Produit - Zoom' },
  { id: 'cam-03-outro', name: 'Conclusion - Retour Large' }
]
```

### 2. Planning de Séquence

```typescript
// Planifier la séquence de caméras avant l'édition
// 1. Storyboard papier
// 2. Définir les points clés
// 3. Créer les caméras dans l'ordre
// 4. Affiner les timings
```

### 3. Utilisation du Zoom

```typescript
// Zoom > 1.0 : Pour détails et emphase
{ zoom: 1.5, duration: 3 }  // Zoom pour montrer détails

// Zoom = 1.0 : Pour vues normales
{ zoom: 1.0, duration: 5 }  // Vue standard

// Zoom < 1.0 : Pour contexte large
{ zoom: 0.7, duration: 4 }  // Montrer plus de contexte
```

### 4. Transitions Fluides

```typescript
// Adapter la durée selon la distance
// Distance courte : transition rapide
{ transition_duration: 1, easing: 'easeInOutQuad' }

// Distance longue : transition lente
{ transition_duration: 3, easing: 'easeInOutCubic' }

// Pas de distance : pas de transition
{ transition_duration: 0 }
```

### 5. Verrouillage Stratégique

```typescript
// Verrouiller les caméras validées
// pour éviter modifications accidentelles
cameras.forEach(cam => {
  if (cam.validated) {
    sceneCanvas.updateCamera(cam.id, { locked: true });
  }
});
```

## 🐛 Dépannage

### Caméra Invisible

```typescript
// Vérifier que la caméra est dans les limites de la scène
if (camera.position.x < 0 || camera.position.x > scene.width ||
    camera.position.y < 0 || camera.position.y > scene.height) {
  // Repositionner
  sceneCanvas.updateCamera(camera.id, {
    position: { x: 0, y: 0 }
  });
}
```

### Performance Dégradée

```typescript
// Réduire la résolution de la scène virtuelle
// Ou réduire le nombre de layers visibles
// Ou activer le mode "wireframe" pour édition
sceneCanvas.setRenderMode('wireframe');
```

### Animations Saccadées

```typescript
// Vérifier le GPU acceleration
stage.container().style.transform = 'translateZ(0)';

// Réduire la complexité des layers
// Ou augmenter la step d'animation
animator.setAnimationStep(50); // 50ms au lieu de 16ms
```

## 📚 Ressources

### Exemples
- `examples/camera-basic.html` - Caméra unique
- `examples/camera-multi.html` - Multi-caméras
- `examples/camera-animation.html` - Animations
- `examples/camera-large-scene.html` - Scène immense

### Documentation Connexe
- [Système Éditeur](./30-EDITEUR.md)
- [Système Caméra Frontend](./32-CAMERA-FRONTEND.md)
- [Architecture](./02-ARCHITECTURE.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
