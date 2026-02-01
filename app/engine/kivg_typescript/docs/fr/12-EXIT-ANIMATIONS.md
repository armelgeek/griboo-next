# Animations de Sortie (Exit Animations)

## 📋 Vue d'Ensemble

Les **animations de sortie** définissent comment un layer disparaît du canvas à la fin de sa durée de visibilité. Le moteur KIVG propose plus de 60 animations de sortie professionnelles, permettant des transitions élégantes et des effets dramatiques.

## 🎯 Concept

Une animation de sortie contrôle :
- **La transition** : Comment le layer passe de visible à invisible
- **La durée** : Combien de temps prend la disparition
- **Le timing** : Quand démarre la sortie (basé sur `duration` du layer)
- **L'easing** : La courbe d'accélération de l'animation

## 📦 Configuration

```typescript
interface ExitAnimationConfig {
  type: ExitAnimationType;          // Type d'animation
  duration?: number;                 // Durée en secondes (défaut : 1.0)
  delay?: number;                    // Délai avant sortie (défaut : 0)
  easing?: string;                   // Fonction d'easing (défaut : 'ease_in')
}
```

## 🎨 Catalogue Complet des Animations

### 1. Animations de Base

#### `none`
Aucune animation. Le layer disparaît instantanément.

```typescript
{
  type: 'none'
}
```

**Cas d'usage** : Coupes nettes, transitions instantanées

---

#### `fade_out` / `fadeOut`
Fondu progressif d'opaque à transparent.

```typescript
{
  type: 'fade_out',
  duration: 1.0,
  easing: 'ease_in'
}
```

**Cas d'usage** : Transition universelle douce pour tous types de contenus

---

### 2. Animations de Glissement (Slide)

#### `slide_out_left`
Glisse vers la gauche hors de l'écran.

```typescript
{
  type: 'slide_out_left',
  duration: 0.8,
  easing: 'ease_in'
}
```

**Cas d'usage** : Menus latéraux, panneaux qui se ferment

---

#### `slide_out_right`
Glisse vers la droite hors de l'écran.

```typescript
{
  type: 'slide_out_right',
  duration: 0.8,
  easing: 'ease_in'
}
```

**Cas d'usage** : Notifications qui partent, slides de présentation

---

#### `slide_out_top`
Glisse vers le haut hors de l'écran.

```typescript
{
  type: 'slide_out_top',
  duration: 0.7,
  easing: 'ease_in'
}
```

**Cas d'usage** : Bandeaux, headers qui disparaissent

---

#### `slide_out_bottom`
Glisse vers le bas hors de l'écran.

```typescript
{
  type: 'slide_out_bottom',
  duration: 0.7,
  easing: 'ease_in'
}
```

**Cas d'usage** : Sous-titres, footers, tooltips

---

#### `slideOutDown`
Glisse vers le bas avec fondu (style Animate.css).

```typescript
{
  type: 'slideOutDown',
  duration: 0.8
}
```

---

#### `slideOutLeft`
Glisse vers la gauche avec effet étendu.

```typescript
{
  type: 'slideOutLeft',
  duration: 0.8
}
```

---

#### `slideOutRight`
Glisse vers la droite avec effet étendu.

```typescript
{
  type: 'slideOutRight',
  duration: 0.8
}
```

---

#### `slideOutUp`
Glisse vers le haut avec fondu.

```typescript
{
  type: 'slideOutUp',
  duration: 0.8
}
```

---

### 3. Animations de Zoom

#### `zoom_out` / `zoomOut`
Zoom arrière vers un point central.

```typescript
{
  type: 'zoom_out',
  duration: 0.6,
  easing: 'ease_in'
}
```

**Cas d'usage** : Réduction d'images, fermeture de modales, disparition d'icônes

---

#### `zoomOutDown`
Zoom arrière vers le bas.

```typescript
{
  type: 'zoomOutDown',
  duration: 0.8
}
```

**Cas d'usage** : Éléments qui tombent en s'éloignant

---

#### `zoomOutLeft`
Zoom arrière vers la gauche.

```typescript
{
  type: 'zoomOutLeft',
  duration: 0.8
}
```

---

#### `zoomOutRight`
Zoom arrière vers la droite.

```typescript
{
  type: 'zoomOutRight',
  duration: 0.8
}
```

---

#### `zoomOutUp`
Zoom arrière vers le haut.

```typescript
{
  type: 'zoomOutUp',
  duration: 0.8
}
```

---

### 4. Animations Bounce (Rebond)

#### `bounce_out`
Rebond élastique avant disparition.

```typescript
{
  type: 'bounce_out',
  duration: 1.0,
  easing: 'bounce_in'
}
```

**Cas d'usage** : Éléments ludiques, jeux, effets rebondissants

---

#### `bounceOutDown`
Rebond vers le bas puis disparition.

```typescript
{
  type: 'bounceOutDown',
  duration: 1.0
}
```

**Cas d'usage** : Éléments qui tombent avec rebonds

---

#### `bounceOutUp`
Rebond vers le haut puis disparition.

```typescript
{
  type: 'bounceOutUp',
  duration: 1.0
}
```

---

#### `bounceOutLeft`
Rebond vers la gauche puis disparition.

```typescript
{
  type: 'bounceOutLeft',
  duration: 1.0
}
```

---

#### `bounceOutRight`
Rebond vers la droite puis disparition.

```typescript
{
  type: 'bounceOutRight',
  duration: 1.0
}
```

---

### 5. Animations Rotate/Spin

#### `rotate_out` / `spin_out`
Rotation de sortie avec zoom arrière.

```typescript
{
  type: 'rotate_out',
  duration: 0.8
}
```

**Cas d'usage** : Fermeture de badges, logos qui tournent, effets de transition

---

#### `rotateOut`
Rotation standard de sortie (Animate.css).

```typescript
{
  type: 'rotateOut',
  duration: 0.8
}
```

---

#### `rotateOutDownLeft`
Rotation vers le bas-gauche.

```typescript
{
  type: 'rotateOutDownLeft',
  duration: 0.8
}
```

---

#### `rotateOutDownRight`
Rotation vers le bas-droite.

```typescript
{
  type: 'rotateOutDownRight',
  duration: 0.8
}
```

---

#### `rotateOutUpLeft`
Rotation vers le haut-gauche.

```typescript
{
  type: 'rotateOutUpLeft',
  duration: 0.8
}
```

---

#### `rotateOutUpRight`
Rotation vers le haut-droite.

```typescript
{
  type: 'rotateOutUpRight',
  duration: 0.8
}
```

---

### 6. Animations Flip

#### `flip_out_x` / `flip_out_horizontal` / `flipOutX`
Retournement horizontal (flip sur l'axe X).

```typescript
{
  type: 'flip_out_x',
  duration: 0.8
}
```

**Cas d'usage** : Cartes qui se retournent, transitions face/dos

---

#### `flip_out_y` / `flip_out_vertical` / `flipOutY`
Retournement vertical (flip sur l'axe Y).

```typescript
{
  type: 'flip_out_y',
  duration: 0.8
}
```

---

### 7. Animations Scale

#### `scale_out`
Réduction d'échelle progressive.

```typescript
{
  type: 'scale_out',
  duration: 0.6,
  easing: 'ease_in'
}
```

**Cas d'usage** : Rétrécissement d'éléments, miniaturisation

---

#### `scale_down`
Réduction d'échelle rapide.

```typescript
{
  type: 'scale_down',
  duration: 0.4,
  easing: 'ease_in'
}
```

---

### 8. Animations Blur/Focus

#### `blur_out`
Transition de net à flou avant disparition.

```typescript
{
  type: 'blur_out',
  duration: 1.0
}
```

**Cas d'usage** : Perte de focus, transitions photographiques, effets de profondeur

---

#### `focus_out`
Perte de mise au point progressive.

```typescript
{
  type: 'focus_out',
  duration: 0.8
}
```

---

### 9. Animations Elastic

#### `elastic_out`
Sortie élastique avec rebond.

```typescript
{
  type: 'elastic_out',
  duration: 1.0,
  easing: 'elastic_in'
}
```

**Cas d'usage** : Effets ludiques, UI dynamiques

---

### 10. Animations Fade Avancées

#### `fadeOutDown`
Fondu en glissant vers le bas.

```typescript
{
  type: 'fadeOutDown',
  duration: 1.0
}
```

---

#### `fadeOutDownBig`
Fondu en glissant loin vers le bas.

```typescript
{
  type: 'fadeOutDownBig',
  duration: 1.2
}
```

---

#### `fadeOutLeft`
Fondu en glissant vers la gauche.

```typescript
{
  type: 'fadeOutLeft',
  duration: 1.0
}
```

---

#### `fadeOutLeftBig`
Fondu en glissant loin vers la gauche.

```typescript
{
  type: 'fadeOutLeftBig',
  duration: 1.2
}
```

---

#### `fadeOutRight`
Fondu en glissant vers la droite.

```typescript
{
  type: 'fadeOutRight',
  duration: 1.0
}
```

---

#### `fadeOutRightBig`
Fondu en glissant loin vers la droite.

```typescript
{
  type: 'fadeOutRightBig',
  duration: 1.2
}
```

---

#### `fadeOutUp`
Fondu en glissant vers le haut.

```typescript
{
  type: 'fadeOutUp',
  duration: 1.0
}
```

---

#### `fadeOutUpBig`
Fondu en glissant loin vers le haut.

```typescript
{
  type: 'fadeOutUpBig',
  duration: 1.2
}
```

---

#### `fadeOutTopLeft`
Fondu vers le coin haut-gauche.

```typescript
{
  type: 'fadeOutTopLeft',
  duration: 1.0
}
```

---

#### `fadeOutTopRight`
Fondu vers le coin haut-droite.

```typescript
{
  type: 'fadeOutTopRight',
  duration: 1.0
}
```

---

#### `fadeOutBottomLeft`
Fondu vers le coin bas-gauche.

```typescript
{
  type: 'fadeOutBottomLeft',
  duration: 1.0
}
```

---

#### `fadeOutBottomRight`
Fondu vers le coin bas-droite.

```typescript
{
  type: 'fadeOutBottomRight',
  duration: 1.0
}
```

---

### 11. Animations LightSpeed

#### `lightSpeedOutLeft`
Sortie ultra-rapide vers la gauche avec effet de vitesse.

```typescript
{
  type: 'lightSpeedOutLeft',
  duration: 0.6
}
```

**Cas d'usage** : Effets de vitesse, transitions rapides, super-héros

---

#### `lightSpeedOutRight`
Sortie ultra-rapide vers la droite.

```typescript
{
  type: 'lightSpeedOutRight',
  duration: 0.6
}
```

---

### 12. Animations Roll

#### `rollOut`
Roulement vers l'extérieur avec rotation.

```typescript
{
  type: 'rollOut',
  duration: 1.0
}
```

**Cas d'usage** : Objets sphériques, balles, roues

---

### 13. Animations Back

#### `backOutDown`
Sortie vers le bas avec dépassement.

```typescript
{
  type: 'backOutDown',
  duration: 0.8,
  easing: 'back_in'
}
```

**Cas d'usage** : Effets de ressort, mouvements naturels

---

#### `backOutLeft`
Sortie vers la gauche avec dépassement.

```typescript
{
  type: 'backOutLeft',
  duration: 0.8
}
```

---

#### `backOutRight`
Sortie vers la droite avec dépassement.

```typescript
{
  type: 'backOutRight',
  duration: 0.8
}
```

---

#### `backOutUp`
Sortie vers le haut avec dépassement.

```typescript
{
  type: 'backOutUp',
  duration: 0.8
}
```

---

### 14. Animations Spéciales

#### `eraser`
Effet de gomme qui efface le layer progressivement.

```typescript
{
  type: 'eraser',
  duration: 2.0,
  easing: 'linear'
}
```

**Cas d'usage** : Animations de tableau blanc, effets d'effacement réalistes, corrections

---

#### `hinge`
Chute avec rotation comme une porte qui tombe de ses gonds.

```typescript
{
  type: 'hinge',
  duration: 2.0
}
```

**Cas d'usage** : Effets dramatiques, défaites, chutes comiques

---

## ⚙️ Fonctions d'Easing

Les fonctions d'easing contrôlent l'accélération de la sortie :

```typescript
type EasingFunction = 
  | 'linear'              // Vitesse constante
  | 'ease_in'             // Accélération progressive (recommandé)
  | 'ease_out'            // Décélération progressive
  | 'ease_in_out'         // Accélération puis décélération
  | 'bounce_in'           // Rebond à l'entrée
  | 'bounce_out'          // Rebond à la sortie
  | 'elastic_in'          // Élastique à l'entrée
  | 'elastic_out'         // Élastique à la sortie
  | 'back_in'             // Dépassement puis retour
  | 'back_out';           // Recul puis départ
```

### Recommandations par Type de Sortie

| Type d'Animation | Easing Recommandé | Raison |
|-----------------|-------------------|---------|
| Slide Out | `ease_in` | Accélération naturelle |
| Zoom Out | `ease_in` | Rétrécissement fluide |
| Bounce Out | `bounce_in` | Accentue l'effet rebond |
| Rotate Out | `ease_in` | Rotation qui accélère |
| Fade Out | `linear` ou `ease_in` | Disparition douce |
| Eraser | `linear` | Vitesse constante |

## 💡 Exemples Pratiques

### Exemple 1 : Texte qui Fond Élégamment

```typescript
const textLayer: TextLayerConfig = {
  type: 'text',
  content: 'Au revoir !',
  x: 400,
  y: 200,
  duration: 5.0,
  exit_animation: {
    type: 'fade_out',
    duration: 1.5,
    easing: 'ease_in'
  }
};
```

### Exemple 2 : Image avec Zoom Arrière Dramatique

```typescript
const imageLayer: ImageLayerConfig = {
  type: 'image',
  src: 'photo.jpg',
  x: 300,
  y: 150,
  duration: 8.0,
  exit_animation: {
    type: 'zoom_out',
    duration: 1.2,
    easing: 'ease_in'
  }
};
```

### Exemple 3 : Notification qui Part Rapidement

```typescript
const notificationLayer: ShapeLayerConfig = {
  type: 'shape',
  shape: 'rectangle',
  duration: 3.0,
  exit_animation: {
    type: 'slideOutRight',
    duration: 0.5,
    easing: 'ease_in'
  }
};
```

### Exemple 4 : Élément Effacé avec Gomme

```typescript
const drawingLayer: PathLayerConfig = {
  type: 'path',
  path: 'M 100 100 L 200 200',
  duration: 10.0,
  exit_animation: {
    type: 'eraser',
    duration: 2.5,
    easing: 'linear'
  }
};
```

### Exemple 5 : Logo avec Rotation de Sortie

```typescript
const logoLayer: ImageLayerConfig = {
  type: 'image',
  src: 'logo.svg',
  duration: 6.0,
  exit_animation: {
    type: 'rotate_out',
    duration: 1.0,
    easing: 'ease_in_out'
  }
};
```

### Exemple 6 : Élément qui Rebondit Avant de Partir

```typescript
const bubbleLayer: ShapeLayerConfig = {
  type: 'shape',
  shape: 'circle',
  duration: 4.0,
  exit_animation: {
    type: 'bounceOutDown',
    duration: 1.2,
    easing: 'bounce_in'
  }
};
```

## 🎬 Sorties Séquencées

Créer des sorties progressives :

```typescript
const layers = [
  {
    type: 'text',
    content: 'Premier',
    duration: 5.0,
    exit_animation: { type: 'fadeOutUp', duration: 0.8, delay: 0 }
  },
  {
    type: 'text',
    content: 'Deuxième',
    duration: 5.3,
    exit_animation: { type: 'fadeOutUp', duration: 0.8, delay: 0 }
  },
  {
    type: 'text',
    content: 'Troisième',
    duration: 5.6,
    exit_animation: { type: 'fadeOutUp', duration: 0.8, delay: 0 }
  }
];
// Les éléments partent les uns après les autres grâce à duration différente
```

## 🎨 Bonnes Pratiques

### 1. **Symétrie Entrée/Sortie**

Associez des animations complémentaires :

```typescript
// Entrée de gauche, sortie à droite
entrance_animation: { type: 'slide_in_left', duration: 0.8 },
exit_animation: { type: 'slide_out_right', duration: 0.8 }

// Zoom in, zoom out
entrance_animation: { type: 'zoom_in', duration: 0.6 },
exit_animation: { type: 'zoom_out', duration: 0.6 }

// Fade in, fade out
entrance_animation: { type: 'fade_in', duration: 1.0 },
exit_animation: { type: 'fade_out', duration: 1.0 }
```

### 2. **Durées de Sortie**

Les sorties sont généralement plus rapides que les entrées :

```typescript
// Entrée : 1.2s, Sortie : 0.8s
entrance_animation: { type: 'bounce_in', duration: 1.2 },
exit_animation: { type: 'bounce_out', duration: 0.8 }
```

**Ratio recommandé** : Sortie = 60-80% de la durée d'entrée

### 3. **Easing Opposé**

Utilisez des easings complémentaires :

```typescript
// Entrée ralentit, Sortie accélère
entrance_animation: { type: 'slide_in_left', easing: 'ease_out' },
exit_animation: { type: 'slide_out_right', easing: 'ease_in' }
```

### 4. **Animations par Type de Contenu**

| Type de Contenu | Sorties Recommandées |
|----------------|---------------------|
| **Textes** | `fade_out`, `fadeOutUp`, `slideOutLeft` |
| **Images** | `zoom_out`, `fade_out`, `blur_out` |
| **Logos** | `rotate_out`, `scale_out`, `zoom_out` |
| **Notifications** | `slideOutRight`, `bounceOutUp`, `fadeOutRight` |
| **Dessins** | `eraser`, `fade_out` |
| **UI Elements** | `slide_out_*`, `scale_out` |

### 5. **Timing de Sortie**

```typescript
// Le layer reste visible pendant 'duration' secondes
// puis joue l'exit_animation
const layer = {
  type: 'text',
  content: 'Visible 5 secondes',
  duration: 5.0,                    // Temps de visibilité
  exit_animation: {
    type: 'fade_out',
    duration: 1.0                    // Temps de disparition
  }
  // Total screen time = 5.0 + 1.0 = 6.0 secondes
};
```

### 6. **Effets Spéciaux**

Pour les animations de tableau blanc, utilisez `eraser` :

```typescript
const whiteboardLayer = {
  type: 'path',
  path: svgPath,
  entrance_animation: { type: 'draw', duration: 3.0 },
  exit_animation: { type: 'eraser', duration: 2.0 }
};
```

### 7. **Performance**

- **Rapides** : `fade_out`, `slide_out_*`, `scale_out`
- **Moyennes** : `zoom_out`, `rotate_out`, `bounce_out`
- **Lourdes** : `eraser`, `blur_out`, animations complexes

Limitez les animations lourdes simultanées.

### 8. **Transitions entre Scènes**

Coordonnez les sorties avec les changements de scène :

```typescript
// Dernière scène : sortie douce
lastScene.layers.forEach(layer => {
  layer.exit_animation = {
    type: 'fadeOutDown',
    duration: 1.0
  };
});
```

## 🔧 API Programmatique

### Appliquer une Animation de Sortie Dynamiquement

```typescript
import { applyExitAnimation } from '@engine/core/animations/exit_animation';

// Rendu frame par frame
const animatedFrame = applyExitAnimation(
  originalFrame,
  {
    type: 'fade_out',
    duration: 0.8,
    easing: 'ease_in'
  },
  currentFrameIndex,
  totalAnimationFrames,
  fps
);
```

### Calculer le Temps Total de Présence

```typescript
// Temps total = entrance_delay + entrance_duration + duration + exit_duration
const totalTime = 
  (layer.entrance_delay || 0) +
  (layer.entrance_animation?.duration || 0) +
  (layer.duration || 0) +
  (layer.exit_animation?.duration || 0);
```

## 🌐 Compatibilité

| Environnement | Support | Notes |
|--------------|---------|-------|
| Frontend (Browser) | ✅ Complet | Toutes les animations supportées |
| Server (Node.js) | ✅ Complet | Rendu avec node-canvas |
| Export Vidéo | ✅ Complet | Frame-by-frame rendering |
| Export GIF | ✅ Complet | Avec limitation de FPS |

## 🔄 Correspondance Entrée/Sortie

Tableau de référence pour créer des paires cohérentes :

| Animation d'Entrée | Animation de Sortie Recommandée |
|-------------------|--------------------------------|
| `fade_in` | `fade_out` |
| `slide_in_left` | `slide_out_left` ou `slide_out_right` |
| `slide_in_right` | `slide_out_right` ou `slide_out_left` |
| `slide_in_top` | `slide_out_top` ou `slide_out_bottom` |
| `slide_in_bottom` | `slide_out_bottom` ou `slide_out_top` |
| `zoom_in` | `zoom_out` |
| `bounce_in` | `bounce_out` |
| `rotate_in` | `rotate_out` |
| `flip_in_x` | `flip_out_x` |
| `flip_in_y` | `flip_out_y` |
| `bounceInDown` | `bounceOutDown` |
| `bounceInUp` | `bounceOutUp` |
| `fadeInDown` | `fadeOutDown` |
| `fadeInUp` | `fadeOutUp` |
| `lightSpeedInLeft` | `lightSpeedOutLeft` |
| `lightSpeedInRight` | `lightSpeedOutRight` |
| `draw` | `eraser` |

## 📚 Ressources Complémentaires

- [Guide des Layers](./05-LAYER.md)
- [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md)
- [Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md)
- [Système de Timing](./04-SCENE.md)
- [Fonctions d'Easing](../shared/easing.ts)

## 🎯 Résumé

Les animations de sortie KIVG offrent :
- **60+ animations professionnelles** pour tous les styles
- **Configuration intuitive** avec type, durée et easing
- **Symétrie parfaite** avec les animations d'entrée
- **Effet spécial `eraser`** pour animations tableau blanc
- **Optimisation performance** pour navigateur et export

Créez des sorties mémorables qui complètent parfaitement vos entrées et renforcent votre message ! 🎬
