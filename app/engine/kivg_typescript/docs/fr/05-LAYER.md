# Système Layer

## 📋 Vue d'Ensemble

Un **Layer** (Couche) est un élément visuel individuel dans une scène. Chaque layer peut être animé indépendamment avec des animations d'entrée, de sortie et d'emphase.

## 🎯 Concept

```
Scene
  ├── Layer 1 (TextLayer)
  │   ├── Entrance Animation (fade_in)
  │   ├── Emphasis Animation (pulse)
  │   └── Exit Animation (fade_out)
  │
  ├── Layer 2 (ImageLayer)
  │   ├── Entrance Animation (zoom_in)
  │   └── Exit Animation (zoom_out)
  │
  └── Layer 3 (PathLayer)
      ├── Entrance Animation (draw)
      └── Exit Animation (eraser)
```

## 📦 Interface BaseLayerConfig

Tous les layers partagent ces propriétés communes :

```typescript
interface BaseLayerConfig {
  // Identification
  type: LayerType;                // Type de layer
  id?: string;                    // Identifiant unique (auto-généré si absent)
  
  // Positionnement
  x?: number;                     // Position X (défaut : 0)
  y?: number;                     // Position Y (défaut : 0)
  z_index?: number;               // Ordre de rendu (défaut : ordre du tableau)
  
  // Dimensions
  width?: number;                 // Largeur
  height?: number;                // Hauteur
  scale?: number;                 // Échelle (défaut : 1.0)
  
  // Apparence
  opacity?: number;               // Opacité 0-1 (défaut : 1.0)
  rotation?: number;              // Rotation en degrés (défaut : 0)
  
  // Timing
  entrance_delay?: number;        // Délai avant apparition (secondes)
  entrance_duration?: number;     // Durée d'animation d'entrée
  duration?: number;              // Durée de visibilité
  exit_duration?: number;         // Durée d'animation de sortie
  
  // Animations
  entrance_animation?: EntranceAnimationConfig;
  exit_animation?: ExitAnimationConfig;
  emphasis_animation?: EmphasisAnimationConfig;
  
  // Hand Overlay
  handOverlayEnabled?: boolean;   // Afficher la main (défaut : false)
  handType?: 'draw' | 'erase' | 'push';  // Type de main
  
  // Métadonnées
  name?: string;                  // Nom lisible
  tags?: string[];                // Tags pour organisation
}
```

## 🎨 Types de Layers Disponibles

Le moteur KIVG offre **14 types de layers** différents :

### 1. Layers de Texte
- **TextLayer** : Texte converti en SVG avec animation de trait
- **WritingLayer** : Texte avec effet typewriter ou reveal
- **CaptionLayer** : Légendes/sous-titres

### 2. Layers d'Images
- **ImageLayer** : Image avec animation de coloriage complexe
- **SimpleImageLayer** : Image avec animations simples

### 3. Layers de Dessin
- **PathLayer** : Chemin personnalisé avec animation de trait
- **SvgPathLayer** : Chemin SVG avec animation progressive
- **ShapeLayer** : Formes géométriques (rectangle, cercle, etc.)

### 4. Layers Spéciaux
- **PushLayer** : Objet poussé/glissé sur le canvas
- **EraserLayer** : Gomme interactive
- **RubberLayer** : Gomme avec effet physique
- **MorphLayer** : Morphing entre formes
- **OcclusionLayer** : Gestion des occultations

### 5. Layer de Base
- **WritingLayer** : Animation d'écriture manuscrite

## 📊 Cycle de Vie d'un Layer

```
1. CRÉATION
   └→ new Layer(config)

2. PRÉPARATION
   └→ layer.prepare()
       ├→ Chargement des assets
       ├→ Initialisation du rendu
       └→ Calcul des dimensions

3. ANIMATION D'ENTRÉE
   └→ layer.animateIn(duration)
       └→ Application de entrance_animation

4. VISIBILITÉ
   └→ layer.render(ctx, time)
       ├→ Application de emphasis_animation
       └→ Rendu du contenu

5. ANIMATION DE SORTIE
   └→ layer.animateOut(duration)
       └→ Application de exit_animation

6. NETTOYAGE
   └→ layer.dispose()
       └→ Libération des ressources
```

## ⏱️ Timeline d'un Layer

```
|--entrance_delay--|--entrance_duration--|----duration----|--exit_duration--|

0s                2s                    3s               8s              8.5s
   (attente)      (fade_in)           (visible)      (fade_out)
```

**Calcul du timing** :
- **Start Time** : `entrance_delay`
- **Animation In Start** : `entrance_delay`
- **Animation In End** : `entrance_delay + entrance_duration`
- **Visible Until** : `entrance_delay + entrance_duration + duration`
- **Animation Out Start** : `entrance_delay + entrance_duration + duration`
- **End Time** : `entrance_delay + entrance_duration + duration + exit_duration`

## 🎬 Configuration des Animations

### Animation d'Entrée

```typescript
entrance_animation: {
  type: 'fade_in',              // Type d'animation
  duration: 1,                  // Durée (peut override entrance_duration)
  easing: 'ease_out',          // Fonction d'easing
  settleRatio: 0.25,           // Ratio de stabilisation
  warmUp: false                // Pré-chargement
}
```

**Types disponibles** : Plus de 40 animations (voir [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md))

### Animation de Sortie

```typescript
exit_animation: {
  type: 'fade_out',
  duration: 0.5,
  easing: 'ease_in'
}
```

**Types disponibles** : Plus de 25 animations (voir [Animations de Sortie](./12-EXIT-ANIMATIONS.md))

### Animation d'Emphase

```typescript
emphasis_animation: {
  type: 'pulse',
  duration: 1,
  delay: 0,
  iterations: 0,               // 0 = infini
  intensity: 1.0,              // Intensité de l'effet
  easing: 'ease_in_out'
}
```

**Types disponibles** : 12 animations (voir [Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md))

## 🎨 Propriétés Visuelles

### Position et Dimensions

```typescript
{
  x: 100,                // Position X en pixels
  y: 200,                // Position Y en pixels
  width: 400,            // Largeur en pixels
  height: 300,           // Hauteur en pixels
  scale: 1.5,            // Échelle (1.0 = 100%)
  rotation: 45           // Rotation en degrés
}
```

### Apparence

```typescript
{
  opacity: 0.8,          // Opacité (0 = transparent, 1 = opaque)
  z_index: 10            // Ordre de rendu (plus élevé = devant)
}
```

## 🖐️ Hand Overlay

Le hand overlay affiche une main animée pendant les animations de dessin/écriture/effacement.

### Configuration

```typescript
{
  handOverlayEnabled: true,
  handType: 'draw',           // 'draw' | 'erase' | 'push'
}
```

### Comportement Automatique

Le hand overlay :
1. Suit automatiquement le tracé/texte en cours de dessin
2. S'adapte au type d'animation
3. Utilise la stratégie appropriée selon le layer
4. Se cache automatiquement quand l'animation est terminée

### Stratégies de Main

Le système utilise différentes stratégies selon le contexte :
- **TextWritingHandStrategy** : Suit l'écriture de texte
- **PathDrawingHandStrategy** : Suit le tracé d'un chemin
- **StrokeAnimationHandStrategy** : Suit l'animation de trait SVG
- **ShapeHandStrategy** : Suit le dessin de formes
- **EraserHandStrategy** : Suit la gomme
- **RevealHandStrategy** : Suit l'effet de révélation

## 🎯 Exemples Pratiques

### Layer Texte Simple

```typescript
{
  type: 'text',
  textConfig: {
    text: "Bonjour le monde!",
    fontSize: 48,
    color: '#000000',
    fontFamily: 'Roboto'
  },
  x: 100,
  y: 200,
  entrance_animation: {
    type: 'fade_in',
    duration: 1
  },
  exit_animation: {
    type: 'fade_out',
    duration: 0.5
  }
}
```

### Layer Image avec Timeline

```typescript
{
  type: 'image',
  imagePath: './assets/diagram.png',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  entrance_delay: 2,           // Apparaît après 2 secondes
  entrance_duration: 1.5,
  duration: 10,                // Visible pendant 10 secondes
  exit_duration: 1,
  entrance_animation: {
    type: 'zoom_in',
    duration: 1.5
  },
  exit_animation: {
    type: 'zoom_out',
    duration: 1
  }
}
```

### Layer avec Animation d'Emphase

```typescript
{
  type: 'shape',
  shapeType: 'circle',
  x: 500,
  y: 300,
  width: 100,
  height: 100,
  color: '#ff0000',
  entrance_animation: {
    type: 'bounce_in',
    duration: 1
  },
  emphasis_animation: {
    type: 'pulse',
    duration: 1,
    iterations: 0,             // Pulse en boucle
    intensity: 1.2
  }
}
```

### Layer Path avec Hand Overlay

```typescript
{
  type: 'path',
  pathData: 'M 10 10 L 90 90 L 10 90 Z',
  strokeColor: '#000000',
  strokeWidth: 3,
  fillColor: '#ff0000',
  entrance_animation: {
    type: 'draw',
    duration: 3
  },
  handOverlayEnabled: true,
  handType: 'draw'
}
```

### Layer avec Z-Index

```typescript
{
  // Arrière-plan
  type: 'image',
  id: 'background',
  imagePath: './bg.png',
  z_index: 0
},
{
  // Contenu principal
  type: 'text',
  id: 'title',
  textConfig: { text: "Titre" },
  z_index: 10
},
{
  // Premier plan
  type: 'shape',
  id: 'highlight',
  shapeType: 'circle',
  z_index: 20
}
```

## 🔧 API de Layer

### Interface Layer

```typescript
interface Layer {
  // Propriétés
  readonly id: string;
  readonly type: LayerType;
  readonly config: LayerConfig;
  
  // Lifecycle
  prepare(): Promise<void>;
  render(ctx: CanvasRenderingContext2D, time: number): void;
  dispose(): void;
  
  // Animations
  animateIn(duration: number, animationConfig?: EntranceAnimationConfig): Promise<void>;
  animateOut(duration: number, animationConfig?: ExitAnimationConfig): Promise<void>;
  
  // État
  isVisible(time: number): boolean;
  isActive(time: number): boolean;
  getBounds(): Rectangle;
  
  // Transformations
  setPosition(x: number, y: number): void;
  setScale(scale: number): void;
  setRotation(degrees: number): void;
  setOpacity(opacity: number): void;
}
```

### Méthodes Utilitaires

```typescript
// Obtenir les bounds
const bounds = layer.getBounds();
// { x, y, width, height }

// Vérifier la visibilité
const visible = layer.isVisible(currentTime);

// Vérifier si actif
const active = layer.isActive(currentTime);
```

## 🎨 Classe de Base

### BaseLayer (Abstract)

Tous les layers héritent de `BaseLayer` :

```typescript
abstract class BaseLayer implements Layer {
  // Propriétés communes
  protected config: BaseLayerConfig;
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  
  // Méthodes abstraites (à implémenter)
  abstract prepare(): Promise<void>;
  abstract renderContent(ctx: CanvasRenderingContext2D, time: number): void;
  
  // Méthodes implémentées
  render(ctx: CanvasRenderingContext2D, time: number): void {
    this.applyTransformations(ctx);
    this.renderContent(ctx, time);
    this.restoreTransformations(ctx);
  }
  
  protected applyTransformations(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.config.x, this.config.y);
    ctx.rotate(this.config.rotation * Math.PI / 180);
    ctx.scale(this.config.scale, this.config.scale);
    ctx.globalAlpha = this.config.opacity;
  }
  
  protected restoreTransformations(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
```

## 📊 LoadableLayer

Pour les layers qui doivent charger des assets :

```typescript
abstract class LoadableLayer extends BaseLayer {
  protected isLoaded: boolean = false;
  protected loadingProgress: number = 0;
  
  async prepare(): Promise<void> {
    // Affiche un indicateur de chargement
    this.showLoadingIndicator();
    
    // Charge les assets
    await this.loadAssets();
    
    // Marque comme chargé
    this.isLoaded = true;
    this.hideLoadingIndicator();
  }
  
  protected abstract loadAssets(): Promise<void>;
  
  protected showLoadingIndicator(): void {
    // Affiche spinner ou barre de progression
  }
}
```

## 🔍 Debugging

### Mode Debug

```typescript
{
  type: 'text',
  textConfig: { text: "Test" },
  debug: {
    showBounds: true,           // Afficher la bounding box
    showAnchor: true,           // Afficher le point d'ancrage
    logTiming: true,            // Logger le timing
    logRender: true             // Logger les rendus
  }
}
```

### Métriques

```typescript
layer.on('render', (metrics) => {
  console.log({
    renderTime: metrics.time,
    visible: metrics.visible,
    bounds: metrics.bounds
  });
});
```

## ⚡ Performance

### Optimisations Automatiques

1. **Culling** : Layers hors écran non rendus
2. **Cache** : Rendu mis en cache si statique
3. **Lazy Loading** : Assets chargés à la demande
4. **Occlusion** : Parties cachées non dessinées

### Bonnes Pratiques

✅ **Faire** :
- Définir des dimensions explicites
- Utiliser `z_index` pour contrôler l'ordre
- Activer le hand overlay pour effet réaliste
- Réutiliser les configurations communes

❌ **Éviter** :
- Trop de layers simultanés (>50)
- Layers très larges sans nécessité
- Assets non optimisés
- Animations trop complexes simultanées

## 📚 Voir Aussi

- [Types de Layers](./06-TYPES-LAYERS.md) - Détails sur chaque type
- [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md)
- [Animations de Sortie](./12-EXIT-ANIMATIONS.md)
- [Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md)
- [Configuration](./14-CONFIGURATION.md)

---

**Navigation** : [← Précédent : Scene](./04-SCENE.md) | [Suivant : Types de Layers →](./06-TYPES-LAYERS.md)
