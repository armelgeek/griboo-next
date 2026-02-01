# Animations d'Entrée (Entrance Animations)

## 📋 Vue d'Ensemble

Les **animations d'entrée** définissent comment un layer apparaît sur le canvas lors de son arrivée dans la scène. Le moteur KIVG propose plus de 80 animations d'entrée professionnelles, allant des simples fondus aux effets complexes inspirés d'Animate.css.

## 🎯 Concept

Une animation d'entrée contrôle :
- **La transition** : Comment le layer passe de invisible à visible
- **La durée** : Combien de temps prend l'animation
- **Le timing** : Quand l'animation démarre (delay)
- **L'easing** : La courbe d'accélération de l'animation

## 📦 Configuration

```typescript
interface EntranceAnimationConfig {
  type: EntranceAnimationType;      // Type d'animation
  duration?: number;                 // Durée en secondes (défaut : 1.0)
  delay?: number;                    // Délai avant démarrage (défaut : 0)
  easing?: string;                   // Fonction d'easing (défaut : 'ease_out')
}
```

## 🎨 Catalogue Complet des Animations

### 1. Animations de Base

#### `none`
Aucune animation. Le layer apparaît instantanément.

```typescript
{
  type: 'none'
}
```

**Cas d'usage** : Éléments statiques, arrière-plans

---

#### `fade_in` / `fadeIn`
Fondu progressif de transparent à opaque.

```typescript
{
  type: 'fade_in',
  duration: 1.0,
  easing: 'ease_out'
}
```

**Cas d'usage** : Transition douce universelle, textes, images

---

#### `fadeblack`
Apparition depuis le noir avec fondu.

```typescript
{
  type: 'fadeblack',
  duration: 1.5
}
```

**Cas d'usage** : Transitions cinématiques, changements de scène dramatiques

---

#### `fadewhite`
Apparition depuis le blanc avec fondu.

```typescript
{
  type: 'fadewhite',
  duration: 1.2
}
```

**Cas d'usage** : Transitions lumineuses, effets de flash

---

### 2. Animations de Glissement (Slide)

#### `slide_in_left` / `slideInLeft`
Glisse depuis la gauche vers la position finale.

```typescript
{
  type: 'slide_in_left',
  duration: 0.8,
  easing: 'ease_out'
}
```

**Cas d'usage** : Textes, titres, éléments de menu

---

#### `slide_in_right` / `slideInRight`
Glisse depuis la droite vers la position finale.

```typescript
{
  type: 'slide_in_right',
  duration: 0.8,
  easing: 'ease_out'
}
```

**Cas d'usage** : Panneaux latéraux, notifications

---

#### `slide_in_top` / `slideInUp`
Glisse depuis le haut vers la position finale.

```typescript
{
  type: 'slide_in_top',
  duration: 0.7,
  easing: 'ease_out'
}
```

**Cas d'usage** : Bandeaux, headers, alertes

---

#### `slide_in_bottom` / `slideInDown`
Glisse depuis le bas vers la position finale.

```typescript
{
  type: 'slide_in_bottom',
  duration: 0.7,
  easing: 'ease_out'
}
```

**Cas d'usage** : Sous-titres, footers, tooltips

---

### 3. Animations de Zoom

#### `zoom_in` / `zoomIn`
Zoom avant depuis un point central.

```typescript
{
  type: 'zoom_in',
  duration: 0.6,
  easing: 'ease_out'
}
```

**Cas d'usage** : Images, icônes, éléments d'accent

---

#### `distance`
Zoom depuis une grande distance avec perspective.

```typescript
{
  type: 'distance',
  duration: 1.5,
  easing: 'ease_out'
}
```

**Cas d'usage** : Effets dramatiques, révélations importantes

---

#### `zoomInDown`
Zoom avant depuis le haut avec mouvement descendant.

```typescript
{
  type: 'zoomInDown',
  duration: 0.8
}
```

---

#### `zoomInLeft`
Zoom avant depuis la gauche.

```typescript
{
  type: 'zoomInLeft',
  duration: 0.8
}
```

---

#### `zoomInRight`
Zoom avant depuis la droite.

```typescript
{
  type: 'zoomInRight',
  duration: 0.8
}
```

---

#### `zoomInUp`
Zoom avant depuis le bas avec mouvement ascendant.

```typescript
{
  type: 'zoomInUp',
  duration: 0.8
}
```

---

### 4. Animations Push

#### `push_from_left`
Pousse l'écran depuis la gauche (effet de caméra).

```typescript
{
  type: 'push_from_left',
  duration: 1.0
}
```

**Cas d'usage** : Transitions de slides, effets de présentation

---

#### `push_from_right`
Pousse l'écran depuis la droite.

```typescript
{
  type: 'push_from_right',
  duration: 1.0
}
```

---

#### `push_from_top`
Pousse l'écran depuis le haut.

```typescript
{
  type: 'push_from_top',
  duration: 1.0
}
```

---

#### `push_from_bottom`
Pousse l'écran depuis le bas.

```typescript
{
  type: 'push_from_bottom',
  duration: 1.0
}
```

---

#### `push_diagonal`
Pousse l'écran en diagonal.

```typescript
{
  type: 'push_diagonal',
  duration: 1.2
}
```

---

#### `push_horizontally`
Pousse l'écran horizontalement.

```typescript
{
  type: 'push_horizontally',
  duration: 1.0
}
```

---

### 5. Animations Pop/Appear

#### `pop`
Apparition soudaine avec effet de rebond.

```typescript
{
  type: 'pop',
  duration: 0.5,
  easing: 'elastic_out'
}
```

**Cas d'usage** : Bulles de dialogue, notifications, éléments surprises

---

#### `appear`
Apparition instantanée sans transition.

```typescript
{
  type: 'appear'
}
```

**Cas d'usage** : Éléments statiques qui doivent apparaître brusquement

---

### 6. Animations Reveal

#### `reveal`
Révélation progressive par démasquage.

```typescript
{
  type: 'reveal',
  duration: 1.5
}
```

**Cas d'usage** : Images, illustrations, révélations dramatiques

---

#### `draw`
Animation de dessin trait par trait.

```typescript
{
  type: 'draw',
  duration: 2.0,
  easing: 'linear'
}
```

**Cas d'usage** : Chemins SVG, illustrations vectorielles, logos

---

#### `typewriter`
Effet machine à écrire lettre par lettre.

```typescript
{
  type: 'typewriter',
  duration: 3.0,
  easing: 'linear'
}
```

**Cas d'usage** : Textes, codes, messages, dialogues

---

#### `push`
Révélation avec effet de poussée.

```typescript
{
  type: 'push',
  duration: 1.2
}
```

---

### 7. Animations Wipe

#### `wipeleft`
Essuyage depuis la gauche.

```typescript
{
  type: 'wipeleft',
  duration: 1.0
}
```

**Cas d'usage** : Transitions de slides, effets de rideau

---

#### `wiperight`
Essuyage depuis la droite.

```typescript
{
  type: 'wiperight',
  duration: 1.0
}
```

---

#### `wipeup`
Essuyage vers le haut.

```typescript
{
  type: 'wipeup',
  duration: 1.0
}
```

---

#### `wipedown`
Essuyage vers le bas.

```typescript
{
  type: 'wipedown',
  duration: 1.0
}
```

---

### 8. Animations Slide (Aliases)

#### `slideleft`
Alias pour `slide_in_left`.

```typescript
{
  type: 'slideleft',
  duration: 0.8
}
```

---

#### `slideright`
Alias pour `slide_in_right`.

---

#### `slideup`
Alias pour `slide_in_top`.

---

#### `slidedown`
Alias pour `slide_in_bottom`.

---

### 9. Animations Smooth Slide

#### `smoothleft`
Glissement fluide depuis la gauche avec easing doux.

```typescript
{
  type: 'smoothleft',
  duration: 1.2,
  easing: 'ease_in_out'
}
```

---

#### `smoothright`
Glissement fluide depuis la droite.

```typescript
{
  type: 'smoothright',
  duration: 1.2
}
```

---

#### `smoothup`
Glissement fluide vers le haut.

```typescript
{
  type: 'smoothup',
  duration: 1.2
}
```

---

#### `smoothdown`
Glissement fluide vers le bas.

```typescript
{
  type: 'smoothdown',
  duration: 1.2
}
```

---

### 10. Animations Circle/Rect

#### `circlecrop` / `circleopen`
Ouverture circulaire depuis le centre.

```typescript
{
  type: 'circleopen',
  duration: 1.0
}
```

**Cas d'usage** : Révélations focalisées, portraits, spots

---

#### `circleclose`
Fermeture circulaire vers le centre (utilisé comme entrée inversée).

```typescript
{
  type: 'circleclose',
  duration: 1.0
}
```

---

#### `rectcrop`
Révélation rectangulaire progressive.

```typescript
{
  type: 'rectcrop',
  duration: 1.2
}
```

**Cas d'usage** : Cadres, fenêtres, zones de texte

---

### 11. Animations Bounce (Rebond)

#### `bounce_in` / `bounce`
Rebond élastique à l'arrivée.

```typescript
{
  type: 'bounce_in',
  duration: 1.0,
  easing: 'bounce_out'
}
```

**Cas d'usage** : Éléments ludiques, jeux, animations enjouées

---

#### `bounceInDown`
Rebond depuis le haut.

```typescript
{
  type: 'bounceInDown',
  duration: 1.0
}
```

---

#### `bounceInUp`
Rebond depuis le bas.

```typescript
{
  type: 'bounceInUp',
  duration: 1.0
}
```

---

#### `bounceInLeft`
Rebond depuis la gauche.

```typescript
{
  type: 'bounceInLeft',
  duration: 1.0
}
```

---

#### `bounceInRight`
Rebond depuis la droite.

```typescript
{
  type: 'bounceInRight',
  duration: 1.0
}
```

---

### 12. Animations Rotate/Spin

#### `rotate_in` / `spin_in`
Rotation d'entrée avec zoom.

```typescript
{
  type: 'rotate_in',
  duration: 0.8
}
```

**Cas d'usage** : Logos, badges, éléments circulaires

---

#### `rotateInDownLeft`
Rotation depuis le haut-gauche.

```typescript
{
  type: 'rotateInDownLeft',
  duration: 0.8
}
```

---

#### `rotateInDownRight`
Rotation depuis le haut-droite.

```typescript
{
  type: 'rotateInDownRight',
  duration: 0.8
}
```

---

#### `rotateInUpLeft`
Rotation depuis le bas-gauche.

```typescript
{
  type: 'rotateInUpLeft',
  duration: 0.8
}
```

---

#### `rotateInUpRight`
Rotation depuis le bas-droite.

```typescript
{
  type: 'rotateInUpRight',
  duration: 0.8
}
```

---

### 13. Animations Flip

#### `flip_in_x` / `flip_in_horizontal` / `flipInX`
Retournement horizontal (flip sur l'axe X).

```typescript
{
  type: 'flip_in_x',
  duration: 0.8
}
```

**Cas d'usage** : Cartes, révélations de dos/face

---

#### `flip_in_y` / `flip_in_vertical` / `flipInY`
Retournement vertical (flip sur l'axe Y).

```typescript
{
  type: 'flip_in_y',
  duration: 0.8
}
```

---

#### `flip`
Retournement 3D complet.

```typescript
{
  type: 'flip',
  duration: 1.0
}
```

---

### 14. Animations Scale/Blur

#### `scale_pulse`
Pulsation avec changement d'échelle.

```typescript
{
  type: 'scale_pulse',
  duration: 0.6
}
```

---

#### `blur_in`
Apparition depuis le flou vers la netteté.

```typescript
{
  type: 'blur_in',
  duration: 1.0
}
```

**Cas d'usage** : Effets de mise au point, transitions photographiques

---

#### `focus_in`
Mise au point progressive.

```typescript
{
  type: 'focus_in',
  duration: 0.8
}
```

---

### 15. Animations Elastic/Back

#### `elastic_in`
Entrée élastique avec rebond.

```typescript
{
  type: 'elastic_in',
  duration: 1.0,
  easing: 'elastic_out'
}
```

**Cas d'usage** : UI dynamiques, effets ludiques

---

#### `back_in`
Entrée avec léger recul avant arrivée.

```typescript
{
  type: 'back_in',
  duration: 0.8,
  easing: 'back_out'
}
```

---

#### `backInDown`
Entrée avec recul depuis le haut.

```typescript
{
  type: 'backInDown',
  duration: 0.8
}
```

---

#### `backInLeft`
Entrée avec recul depuis la gauche.

```typescript
{
  type: 'backInLeft',
  duration: 0.8
}
```

---

#### `backInRight`
Entrée avec recul depuis la droite.

```typescript
{
  type: 'backInRight',
  duration: 0.8
}
```

---

#### `backInUp`
Entrée avec recul depuis le bas.

```typescript
{
  type: 'backInUp',
  duration: 0.8
}
```

---

### 16. Animations Attention (Style Animate.css)

#### `flash`
Clignotements rapides d'opacité.

```typescript
{
  type: 'flash',
  duration: 1.0
}
```

**Cas d'usage** : Alertes, notifications importantes

---

#### `pulse`
Pulsation douce de l'échelle.

```typescript
{
  type: 'pulse',
  duration: 0.8
}
```

---

#### `rubberBand`
Étirement élastique comme un élastique.

```typescript
{
  type: 'rubberBand',
  duration: 1.0
}
```

---

#### `shakeX`
Secousse horizontale.

```typescript
{
  type: 'shakeX',
  duration: 0.8
}
```

**Cas d'usage** : Erreurs, avertissements, refus

---

#### `shakeY`
Secousse verticale.

```typescript
{
  type: 'shakeY',
  duration: 0.8
}
```

---

#### `headShake`
Secousse de tête (non/refus).

```typescript
{
  type: 'headShake',
  duration: 1.0
}
```

---

#### `swing`
Balancement comme un pendule.

```typescript
{
  type: 'swing',
  duration: 1.0
}
```

---

#### `tada`
Célébration avec rotation et zoom.

```typescript
{
  type: 'tada',
  duration: 1.0
}
```

**Cas d'usage** : Succès, victoires, récompenses

---

#### `wobble`
Vacillement de gauche à droite.

```typescript
{
  type: 'wobble',
  duration: 1.0
}
```

---

#### `jello`
Effet gélatine avec skew.

```typescript
{
  type: 'jello',
  duration: 0.8
}
```

---

#### `heartBeat`
Battement de cœur avec pulsations.

```typescript
{
  type: 'heartBeat',
  duration: 1.2
}
```

**Cas d'usage** : Likes, favoris, éléments romantiques

---

### 17. Animations Fade Avancées

#### `fadeInDown`
Fondu depuis le haut vers le bas.

```typescript
{
  type: 'fadeInDown',
  duration: 1.0
}
```

---

#### `fadeInDownBig`
Fondu depuis loin en haut.

```typescript
{
  type: 'fadeInDownBig',
  duration: 1.2
}
```

---

#### `fadeInLeft`
Fondu depuis la gauche.

```typescript
{
  type: 'fadeInLeft',
  duration: 1.0
}
```

---

#### `fadeInLeftBig`
Fondu depuis loin à gauche.

```typescript
{
  type: 'fadeInLeftBig',
  duration: 1.2
}
```

---

#### `fadeInRight`
Fondu depuis la droite.

```typescript
{
  type: 'fadeInRight',
  duration: 1.0
}
```

---

#### `fadeInRightBig`
Fondu depuis loin à droite.

```typescript
{
  type: 'fadeInRightBig',
  duration: 1.2
}
```

---

#### `fadeInUp`
Fondu depuis le bas vers le haut.

```typescript
{
  type: 'fadeInUp',
  duration: 1.0
}
```

---

#### `fadeInUpBig`
Fondu depuis loin en bas.

```typescript
{
  type: 'fadeInUpBig',
  duration: 1.2
}
```

---

#### `fadeInTopLeft`
Fondu depuis le coin haut-gauche.

```typescript
{
  type: 'fadeInTopLeft',
  duration: 1.0
}
```

---

#### `fadeInTopRight`
Fondu depuis le coin haut-droite.

```typescript
{
  type: 'fadeInTopRight',
  duration: 1.0
}
```

---

#### `fadeInBottomLeft`
Fondu depuis le coin bas-gauche.

```typescript
{
  type: 'fadeInBottomLeft',
  duration: 1.0
}
```

---

#### `fadeInBottomRight`
Fondu depuis le coin bas-droite.

```typescript
{
  type: 'fadeInBottomRight',
  duration: 1.0
}
```

---

### 18. Animations LightSpeed

#### `lightSpeedInLeft`
Entrée ultra-rapide depuis la gauche avec effet de vitesse.

```typescript
{
  type: 'lightSpeedInLeft',
  duration: 0.6
}
```

**Cas d'usage** : Effets de vitesse, super-héros, transitions rapides

---

#### `lightSpeedInRight`
Entrée ultra-rapide depuis la droite.

```typescript
{
  type: 'lightSpeedInRight',
  duration: 0.6
}
```

---

### 19. Animations Spéciales

#### `hinge`
Chute avec rotation comme une porte qui tombe.

```typescript
{
  type: 'hinge',
  duration: 2.0
}
```

**Cas d'usage** : Effets comiques, défaites, chutes dramatiques

---

#### `jackInTheBox`
Surgissement comme un diable en boîte.

```typescript
{
  type: 'jackInTheBox',
  duration: 1.0
}
```

**Cas d'usage** : Surprises, révélations soudaines, éléments ludiques

---

## ⚙️ Fonctions d'Easing

Les fonctions d'easing contrôlent l'accélération de l'animation :

```typescript
type EasingFunction = 
  | 'linear'              // Vitesse constante
  | 'ease_in'             // Accélération progressive
  | 'ease_out'            // Décélération progressive (recommandé)
  | 'ease_in_out'         // Accélération puis décélération
  | 'bounce_in'           // Rebond à l'entrée
  | 'bounce_out'          // Rebond à la sortie
  | 'elastic_in'          // Élastique à l'entrée
  | 'elastic_out'         // Élastique à la sortie
  | 'back_in'             // Recul avant entrée
  | 'back_out';           // Dépassement puis retour
```

### Recommandations par Type d'Animation

| Type d'Animation | Easing Recommandé | Raison |
|-----------------|-------------------|---------|
| Slide | `ease_out` | Arrivée naturelle |
| Zoom | `ease_out` | Ralentissement naturel |
| Bounce | `bounce_out` | Accentue l'effet rebond |
| Rotate | `ease_in_out` | Rotation fluide |
| Fade | `linear` ou `ease_out` | Transition douce |
| Elastic | `elastic_out` | Exagère l'élasticité |

## 💡 Exemples Pratiques

### Exemple 1 : Titre avec Entrée Dramatique

```typescript
const titleLayer: TextLayerConfig = {
  type: 'text',
  content: 'Bienvenue !',
  x: 400,
  y: 200,
  entrance_animation: {
    type: 'bounce_in',
    duration: 1.2,
    delay: 0.5,
    easing: 'bounce_out'
  }
};
```

### Exemple 2 : Image avec Reveal Progressif

```typescript
const imageLayer: ImageLayerConfig = {
  type: 'image',
  src: 'illustration.png',
  x: 300,
  y: 150,
  entrance_animation: {
    type: 'reveal',
    duration: 2.0,
    easing: 'ease_out'
  }
};
```

### Exemple 3 : Texte avec Effet Machine à Écrire

```typescript
const textLayer: TextLayerConfig = {
  type: 'text',
  content: 'Voici un message important...',
  entrance_animation: {
    type: 'typewriter',
    duration: 3.0,
    easing: 'linear'
  }
};
```

### Exemple 4 : Menu Latéral qui Glisse

```typescript
const menuLayer: ShapeLayerConfig = {
  type: 'shape',
  shape: 'rectangle',
  x: -200,
  y: 0,
  width: 200,
  height: 600,
  entrance_animation: {
    type: 'slide_in_left',
    duration: 0.8,
    delay: 0.3,
    easing: 'ease_out'
  }
};
```

### Exemple 5 : Logo avec Rotation Dynamique

```typescript
const logoLayer: ImageLayerConfig = {
  type: 'image',
  src: 'logo.svg',
  x: 400,
  y: 300,
  entrance_animation: {
    type: 'rotate_in',
    duration: 1.0,
    easing: 'back_out'
  }
};
```

### Exemple 6 : Notification avec Flash

```typescript
const notificationLayer: TextLayerConfig = {
  type: 'text',
  content: '🔔 Nouvelle notification',
  entrance_animation: {
    type: 'flash',
    duration: 1.0
  }
};
```

## 🎬 Séquences d'Animations

Créer des entrées séquencées avec des delays progressifs :

```typescript
const layers = [
  {
    type: 'text',
    content: 'Premier',
    entrance_animation: { type: 'fadeInDown', duration: 0.8, delay: 0 }
  },
  {
    type: 'text',
    content: 'Deuxième',
    entrance_animation: { type: 'fadeInDown', duration: 0.8, delay: 0.3 }
  },
  {
    type: 'text',
    content: 'Troisième',
    entrance_animation: { type: 'fadeInDown', duration: 0.8, delay: 0.6 }
  }
];
```

## 🎨 Bonnes Pratiques

### 1. **Choisir l'Animation Appropriée**
- **Textes** : `fade_in`, `typewriter`, `slideInLeft`
- **Images** : `zoom_in`, `reveal`, `fade_in`
- **Logos** : `rotate_in`, `bounce_in`, `tada`
- **Notifications** : `flash`, `bounceInDown`, `pulse`
- **UI Elements** : `slide_in_*`, `fade_in`, `scale_pulse`

### 2. **Durées Recommandées**
```typescript
// Court - Éléments UI
duration: 0.3 - 0.6  // Rapide et réactif

// Moyen - Standard
duration: 0.8 - 1.2  // Équilibré

// Long - Dramatique
duration: 1.5 - 3.0  // Emphase, révélations
```

### 3. **Utiliser les Delays Stratégiquement**
```typescript
// Créer du rythme
const title = { entrance_animation: { delay: 0 } };
const subtitle = { entrance_animation: { delay: 0.5 } };
const content = { entrance_animation: { delay: 1.0 } };
```

### 4. **Cohérence Visuelle**
Utilisez le même type d'animation pour des éléments similaires :
```typescript
// Tous les titres entrent de la même façon
const titleAnimation = {
  type: 'fadeInDown',
  duration: 1.0,
  easing: 'ease_out'
};
```

### 5. **Performance**
- Les animations simples (`fade_in`, `slide_in_*`) sont plus performantes
- Les animations complexes (`draw`, `typewriter`, `circleopen`) demandent plus de ressources
- Limitez le nombre d'animations simultanées lourdes

### 6. **Accessibilité**
- Évitez les animations trop rapides (< 0.3s)
- Évitez les clignotements rapides qui peuvent causer des crises (`flash`)
- Proposez une option pour réduire les mouvements

## 🔧 API Programmatique

### Appliquer une Animation Dynamiquement

```typescript
import { applyEntranceAnimation } from '@engine/core/animations/entrance_animation';

// Exemple d'utilisation dans le rendu frame par frame
const animatedFrame = applyEntranceAnimation(
  originalFrame,
  {
    type: 'bounce_in',
    duration: 1.0,
    easing: 'bounce_out'
  },
  currentFrameIndex,
  totalAnimationFrames,
  fps
);
```

### Calculer la Durée Totale

```typescript
// Durée totale = delay + duration
const totalTime = (config.delay || 0) + (config.duration || 1.0);
```

## 🌐 Compatibilité

| Environnement | Support | Notes |
|--------------|---------|-------|
| Frontend (Browser) | ✅ Complet | Toutes les animations supportées |
| Server (Node.js) | ✅ Complet | Rendu avec node-canvas |
| Export Vidéo | ✅ Complet | Frame-by-frame rendering |
| Export GIF | ✅ Complet | Avec limitation de FPS |

## 📚 Ressources Complémentaires

- [Guide des Layers](./05-LAYER.md)
- [Animations de Sortie](./12-EXIT-ANIMATIONS.md)
- [Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md)
- [Système de Timing](./04-SCENE.md)
- [Fonctions d'Easing](../shared/easing.ts)

## 🎯 Résumé

Les animations d'entrée KIVG offrent :
- **80+ animations professionnelles** de tous styles
- **Configuration simple** avec type, durée, delay et easing
- **Flexibilité totale** pour créer des expériences uniques
- **Performance optimisée** pour navigateur et export vidéo
- **Compatibilité Animate.css** pour transition facile

Choisissez l'animation qui correspond à votre message et à votre audience pour créer des expériences visuelles mémorables ! 🚀
