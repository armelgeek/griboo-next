# Types de Layers - Guide Complet

## 📋 Vue d'Ensemble

Le moteur KIVG offre **14 types de layers** différents, chacun avec des capacités spécifiques. Ce guide détaille tous les types disponibles et leurs configurations.

## 🗂️ Classification des Layers

```
Layers KIVG (14 types)
│
├── Texte (3)
│   ├── TextLayer         - Texte en SVG avec animation de trait
│   ├── WritingLayer      - Texte typewriter ou reveal
│   └── CaptionLayer      - Légendes et sous-titres
│
├── Images (2)
│   ├── ImageLayer        - Animation de coloriage complexe
│   └── SimpleImageLayer  - Image simple avec animations
│
├── Dessin (4)
│   ├── PathLayer         - Chemins personnalisés
│   ├── SvgPathLayer      - Chemins SVG
│   ├── ShapeLayer        - Formes géométriques
│   └── WritingLayer      - Écriture manuscrite
│
└── Spéciaux (5)
    ├── PushLayer         - Objets poussés
    ├── EraserLayer       - Gomme interactive
    ├── RubberLayer       - Gomme avec physique
    ├── MorphLayer        - Morphing de formes
    └── OcclusionLayer    - Gestion occultations
```

## 📊 Tableau Comparatif

| Type | Use Case | Hand Overlay | Complexité | Performance |
|------|----------|--------------|------------|-------------|
| **TextLayer** | Texte animé trait par trait | ✅ | Moyenne | Bonne |
| **WritingLayer** | Effet typewriter | ✅ | Faible | Excellente |
| **CaptionLayer** | Sous-titres | ❌ | Faible | Excellente |
| **ImageLayer** | Coloriage d'images | ✅ | Élevée | Moyenne |
| **SimpleImageLayer** | Images statiques/simples | ❌ | Faible | Excellente |
| **PathLayer** | Dessins personnalisés | ✅ | Moyenne | Bonne |
| **SvgPathLayer** | Icônes, logos SVG | ✅ | Moyenne | Bonne |
| **ShapeLayer** | Formes géométriques | ✅ | Faible | Excellente |
| **PushLayer** | Objets glissants | ✅ | Moyenne | Bonne |
| **EraserLayer** | Effacer interactivement | ✅ | Élevée | Moyenne |
| **RubberLayer** | Gomme réaliste | ✅ | Élevée | Moyenne |
| **MorphLayer** | Transitions de formes | ❌ | Élevée | Moyenne |
| **OcclusionLayer** | Optimisation rendu | ❌ | Élevée | N/A |

## 📝 Layers de Texte

### 1. TextLayer

Convertit le texte en chemins SVG et l'anime trait par trait.

```typescript
{
  type: 'text',
  textConfig: {
    text: string;                    // Texte à afficher (requis)
    fontSize?: number;               // Taille (défaut : 100)
    fontFamily?: string;             // Police (défaut : 'Roboto')
    color?: string;                  // Couleur (défaut : '#000000')
    fontWeight?: string;             // Poids (défaut : '400')
    textAlign?: 'left' | 'center' | 'right';
    
    // Animation de trait
    strokeAnimation?: {
      duration?: number;             // Durée d'animation
      strokeWidth?: number;          // Épaisseur du trait
      strokeColor?: string;          // Couleur du trait
      charDelay?: number;            // Délai entre caractères
      mode?: 'stroke' | 'typewriter'; // Mode d'animation
      fillMode?: 'start' | 'end' | 'none'; // Quand remplir
    }
  },
  
  // Position et dimensions héritées de BaseLayerConfig
  x?: number;
  y?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'text',
  textConfig: {
    text: "Bienvenue dans KIVG!",
    fontSize: 72,
    fontFamily: 'Roboto',
    color: '#2c3e50',
    strokeAnimation: {
      mode: 'stroke',
      duration: 3,
      strokeWidth: 2,
      strokeColor: '#000000',
      charDelay: 0.1,
      fillMode: 'end'
    }
  },
  x: 100,
  y: 200,
  handOverlayEnabled: true,
  handType: 'draw'
}
```

**Cas d'usage** :
- Titres animés professionnels
- Logos texte
- Texte dessiné à la main
- Effet d'écriture réaliste

### 2. WritingLayer

Texte avec effet machine à écrire ou révélation progressive.

```typescript
{
  type: 'writing',
  writingConfig: {
    text: string;                    // Texte (requis)
    fontSize?: number;               // Taille (défaut : 32)
    fontFamily?: string;             // Police
    color?: string;                  // Couleur
    mode?: 'typewriter' | 'reveal';  // Mode (défaut : 'typewriter')
    speed?: number;                  // Vitesse (chars/seconde)
    soundEnabled?: boolean;          // Son typewriter
  },
  
  x?: number;
  y?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'writing',
  writingConfig: {
    text: "Ceci est un texte avec effet typewriter...",
    fontSize: 36,
    fontFamily: 'Courier New',
    color: '#000000',
    mode: 'typewriter',
    speed: 10,
    soundEnabled: true
  },
  x: 50,
  y: 100,
  entrance_animation: {
    type: 'fade_in',
    duration: 0.5
  }
}
```

**Cas d'usage** :
- Dialogues
- Narration textuelle
- Effet machine à écrire classique
- Révélation progressive de contenu

### 3. CaptionLayer

Sous-titres et légendes simples.

```typescript
{
  type: 'caption',
  captionConfig: {
    text: string;                    // Texte (requis)
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;        // Fond (optionnel)
    padding?: number;
    position?: 'top' | 'bottom' | 'center';
  },
  
  x?: number;
  y?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'caption',
  captionConfig: {
    text: "Chapitre 1 : Introduction",
    fontSize: 28,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    position: 'bottom'
  },
  entrance_animation: {
    type: 'slide_in_bottom',
    duration: 0.5
  }
}
```

**Cas d'usage** :
- Sous-titres vidéo
- Légendes
- Titres de chapitre
- Annotations

## 🖼️ Layers d'Images

### 4. ImageLayer

Image avec animation de coloriage complexe.

```typescript
{
  type: 'image',
  imageConfig: {
    imagePath: string;               // Chemin image (requis)
    duration: number;                // Durée coloriage
    strokeRatio?: number;            // Ratio trait/remplissage (0-1)
    colorTolerance?: number;         // Tolérance couleur
    minRegionSize?: number;          // Taille min région
    fillDirection?: 'diagonal' | 'vertical' | 'horizontal';
    sweepSpeed?: number;             // Vitesse balayage
    handOverlayEnabled?: boolean;
  },
  
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'image',
  imageConfig: {
    imagePath: './assets/illustration.png',
    duration: 5,
    strokeRatio: 0.3,
    colorTolerance: 10,
    minRegionSize: 100,
    fillDirection: 'diagonal',
    handOverlayEnabled: true
  },
  x: 0,
  y: 0,
  width: 1920,
  height: 1080
}
```

**Cas d'usage** :
- Illustrations animées
- Coloriage progressif
- Effet de dessin d'image
- Révélation artistique

### 5. SimpleImageLayer

Image simple avec animations classiques.

```typescript
{
  type: 'simple-image',
  imageConfig: {
    imagePath: string;               // Chemin image (requis)
    fit?: 'contain' | 'cover' | 'fill' | 'none';
    opacity?: number;
  },
  
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'simple-image',
  imageConfig: {
    imagePath: './assets/logo.png',
    fit: 'contain'
  },
  x: 100,
  y: 100,
  width: 400,
  height: 300,
  entrance_animation: {
    type: 'zoom_in',
    duration: 1
  },
  exit_animation: {
    type: 'fade_out',
    duration: 0.5
  }
}
```

**Cas d'usage** :
- Logos
- Photos
- Icônes grandes
- Arrière-plans

## ✏️ Layers de Dessin

### 6. PathLayer

Chemin SVG personnalisé avec animation de trait.

```typescript
{
  type: 'path',
  pathConfig: {
    pathData: string;                // Données SVG path (requis)
    strokeColor?: string;            // Couleur trait
    strokeWidth?: number;            // Épaisseur trait
    fillColor?: string;              // Couleur remplissage
    fillAfterStroke?: boolean;       // Remplir après trait
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  },
  
  x?: number;
  y?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'path',
  pathConfig: {
    pathData: 'M 10 80 Q 95 10 180 80',
    strokeColor: '#000000',
    strokeWidth: 3,
    fillColor: '#ff6b6b',
    fillAfterStroke: true
  },
  x: 100,
  y: 100,
  entrance_animation: {
    type: 'draw',
    duration: 2
  },
  handOverlayEnabled: true
}
```

**Cas d'usage** :
- Dessins personnalisés
- Flèches et lignes
- Formes complexes
- Schémas techniques

### 7. SvgPathLayer

Importe et anime des chemins SVG existants.

```typescript
{
  type: 'svg-path',
  svgConfig: {
    svgPath: string;                 // Chemin fichier SVG (requis)
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    preserveAspectRatio?: boolean;
  },
  
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // ...
}
```

**Exemple** :
```typescript
{
  type: 'svg-path',
  svgConfig: {
    svgPath: './assets/icon.svg',
    strokeColor: '#3498db',
    strokeWidth: 2,
    fillColor: '#ecf0f1'
  },
  x: 500,
  y: 300,
  width: 200,
  height: 200,
  entrance_animation: {
    type: 'draw',
    duration: 3
  },
  handOverlayEnabled: true
}
```

**Cas d'usage** :
- Icônes SVG
- Logos vectoriels
- Illustrations vectorielles
- Graphiques techniques

### 8. ShapeLayer

Formes géométriques prédéfinies.

```typescript
{
  type: 'shape',
  shapeConfig: {
    shape: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'polygon';
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    
    // Pour polygon
    sides?: number;                  // Nombre de côtés
    
    // Pour rounded rectangle
    borderRadius?: number;
  },
  
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // ...
}
```

**Exemple Rectangle** :
```typescript
{
  type: 'shape',
  shapeConfig: {
    shape: 'rectangle',
    strokeColor: '#2c3e50',
    strokeWidth: 4,
    fillColor: '#3498db',
    borderRadius: 10
  },
  x: 200,
  y: 200,
  width: 400,
  height: 200,
  entrance_animation: {
    type: 'draw',
    duration: 1.5
  }
}
```

**Exemple Cercle** :
```typescript
{
  type: 'shape',
  shapeConfig: {
    shape: 'circle',
    strokeColor: '#e74c3c',
    strokeWidth: 3,
    fillColor: '#ecf0f1'
  },
  x: 500,
  y: 300,
  width: 150,
  height: 150,
  entrance_animation: {
    type: 'zoom_in',
    duration: 1
  }
}
```

**Exemple Polygone** :
```typescript
{
  type: 'shape',
  shapeConfig: {
    shape: 'polygon',
    sides: 6,                        // Hexagone
    strokeColor: '#16a085',
    strokeWidth: 2,
    fillColor: '#1abc9c'
  },
  x: 800,
  y: 400,
  width: 200,
  height: 200
}
```

**Cas d'usage** :
- Formes décoratives
- Cadres et bordures
- Diagrammes
- Éléments UI

## 🎯 Layers Spéciaux

### 9. PushLayer

Objet poussé/glissé sur le canvas avec easing.

```typescript
{
  type: 'push',
  pushConfig: {
    imageUrl: string;                // Image à pousser (requis)
    startPosition: [number, number]; // Position départ [x, y]
    endPosition: [number, number];   // Position arrivée [x, y]
    pushDuration: number;            // Durée du mouvement
    pushEasing?: string;             // Easing (défaut : 'ease_out')
    from?: 'left' | 'right' | 'top' | 'bottom';
    width?: number;
    height?: number;
  }
}
```

**Exemple** :
```typescript
{
  type: 'push',
  pushConfig: {
    imageUrl: './assets/object.png',
    startPosition: [-100, 300],      // Hors écran à gauche
    endPosition: [500, 300],         // Centre de l'écran
    pushDuration: 2,
    pushEasing: 'ease_out_cubic',
    from: 'left',
    width: 150,
    height: 150
  },
  handOverlayEnabled: true,
  handType: 'push'
}
```

**Cas d'usage** :
- Objets poussés sur le canvas
- Entrées dynamiques
- Animations physiques
- Éléments interactifs

### 10. EraserLayer

Gomme interactive qui efface le contenu.

```typescript
{
  type: 'eraser',
  eraserConfig: {
    eraserSize?: number;             // Taille gomme (défaut : 50)
    eraserShape?: 'circle' | 'square';
    path?: Array<{x: number, y: number}>;  // Chemin d'effacement
    duration?: number;               // Durée d'effacement
    easing?: string;
  }
}
```

**Exemple** :
```typescript
{
  type: 'eraser',
  eraserConfig: {
    eraserSize: 60,
    eraserShape: 'circle',
    path: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 }
    ],
    duration: 3,
    easing: 'linear'
  },
  handOverlayEnabled: true,
  handType: 'erase'
}
```

**Cas d'usage** :
- Effacement progressif
- Révélation par gomme
- Transitions créatives
- Effets de nettoyage

### 11. RubberLayer

Gomme avec effet physique réaliste.

```typescript
{
  type: 'rubber',
  rubberConfig: {
    eraserSize?: number;
    pressure?: number;               // Pression (0-1)
    speed?: number;                  // Vitesse effacement
    path?: Array<{x: number, y: number}>;
    duration?: number;
  }
}
```

**Exemple** :
```typescript
{
  type: 'rubber',
  rubberConfig: {
    eraserSize: 40,
    pressure: 0.8,
    speed: 1.0,
    path: [
      { x: 100, y: 100 },
      { x: 800, y: 100 },
      { x: 800, y: 600 }
    ],
    duration: 4
  },
  handOverlayEnabled: true
}
```

**Cas d'usage** :
- Effacement réaliste
- Simulation physique
- Animations organiques
- Effets naturels

### 12. MorphLayer

Morphing entre deux formes.

```typescript
{
  type: 'morph',
  morphConfig: {
    fromShape: string;               // Path SVG départ
    toShape: string;                 // Path SVG arrivée
    duration: number;                // Durée morphing
    easing?: string;
    strokeColor?: string;
    fillColor?: string;
  }
}
```

**Exemple** :
```typescript
{
  type: 'morph',
  morphConfig: {
    fromShape: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',  // Carré
    toShape: 'M 50 0 L 100 50 L 50 100 L 0 50 Z',     // Losange
    duration: 2,
    easing: 'ease_in_out',
    strokeColor: '#000000',
    fillColor: '#3498db'
  },
  x: 400,
  y: 300
}
```

**Cas d'usage** :
- Transitions de formes
- Animations logo
- Effets de transformation
- Storytelling visuel

### 13. OcclusionLayer

Gestion des occultations pour optimisation.

```typescript
{
  type: 'occlusion',
  occlusionConfig: {
    mode: 'auto' | 'manual';
    layers?: string[];               // IDs des layers à gérer
  }
}
```

**Note** : Géré automatiquement par le système, rarement configuré manuellement.

**Cas d'usage** :
- Optimisation rendu
- Gestion superpositions
- Performance

## 🎨 Guide de Sélection

### Pour du Texte

| Besoin | Layer Recommandé |
|--------|------------------|
| Titre animé trait par trait | `TextLayer` |
| Effet machine à écrire | `WritingLayer` |
| Sous-titres simples | `CaptionLayer` |

### Pour des Images

| Besoin | Layer Recommandé |
|--------|------------------|
| Animation coloriage complexe | `ImageLayer` |
| Image statique/simple | `SimpleImageLayer` |
| Logo | `SimpleImageLayer` ou `SvgPathLayer` |

### Pour du Dessin

| Besoin | Layer Recommandé |
|--------|------------------|
| Chemin personnalisé | `PathLayer` |
| Icône SVG | `SvgPathLayer` |
| Forme simple | `ShapeLayer` |
| Écriture manuscrite | `WritingLayer` |

### Pour Effets Spéciaux

| Besoin | Layer Recommandé |
|--------|------------------|
| Objet poussé | `PushLayer` |
| Effacement | `EraserLayer` ou `RubberLayer` |
| Transformation | `MorphLayer` |

## 📚 Voir Aussi

- [Système Layer](./05-LAYER.md)
- [Layers d'Images Détaillés](./07-IMAGE-LAYERS.md)
- [Layers de Texte Détaillés](./08-TEXT-LAYERS.md)
- [Layers de Dessin Détaillés](./09-DRAWING-LAYERS.md)
- [Layers Spéciaux Détaillés](./10-SPECIAL-LAYERS.md)

---

**Navigation** : [← Précédent : Layer](./05-LAYER.md) | [Suivant : Image Layers →](./07-IMAGE-LAYERS.md)
