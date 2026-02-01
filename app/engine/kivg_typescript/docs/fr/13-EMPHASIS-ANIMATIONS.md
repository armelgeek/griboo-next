# Animations d'Emphase (Emphasis Animations)

## 📋 Vue d'Ensemble

Les **animations d'emphase** sont des animations qui se jouent **pendant** que le layer est visible, sans changer sa position finale. Elles servent à attirer l'attention sur un élément spécifique et à créer du dynamisme dans vos animations.

## 🎯 Concept

Contrairement aux animations d'entrée et de sortie :
- **Jouent pendant la visibilité** : Entre l'entrée et la sortie
- **Pas de changement permanent** : L'élément revient à son état initial
- **Peuvent se répéter** : Support des boucles infinies ou multiples
- **Attirent l'attention** : Signalent l'importance d'un élément

## 📦 Configuration

```typescript
interface EmphasisAnimationConfig {
  type: EmphasisAnimationType;       // Type d'animation
  duration: number;                  // Durée d'un cycle (secondes)
  delay?: number;                    // Délai avant démarrage (défaut : 0)
  iterations?: number;               // Nombre de répétitions (défaut : 1, Infinity pour infini)
  intensity?: number;                // Intensité de l'effet (défaut : 1.0, plage : 0.1-2.0)
  easing?: string;                   // Fonction d'easing (défaut : 'ease-in-out')
}
```

## 🎨 Catalogue Complet des Animations

### 1. Animation de Base

#### `none`
Aucune animation d'emphase.

```typescript
{
  type: 'none'
}
```

---

### 2. Pulse (Pulsation)

#### `pulse`
Pulsation douce avec changement d'échelle.

```typescript
{
  type: 'pulse',
  duration: 1.0,
  iterations: 3,
  intensity: 1.0
}
```

**Effet** : L'élément grandit légèrement (110%) puis revient à sa taille normale.

**Cas d'usage** : 
- Boutons d'appel à l'action (CTA)
- Notifications importantes
- Éléments interactifs
- Indicateurs d'attention

**Exemples** :
```typescript
// Pulsation légère
{ type: 'pulse', duration: 0.8, intensity: 0.5, iterations: 2 }

// Pulsation forte et continue
{ type: 'pulse', duration: 1.0, intensity: 1.5, iterations: Infinity }
```

---

### 3. Shake (Secousse)

#### `shake`
Secousse horizontale rapide.

```typescript
{
  type: 'shake',
  duration: 0.8,
  iterations: 1,
  intensity: 1.0
}
```

**Effet** : L'élément se déplace rapidement de gauche à droite (±10px par défaut).

**Cas d'usage** :
- Champs de formulaire invalides
- Erreurs d'authentification
- Gestes de "non" ou refus
- Alertes d'erreur

**Exemples** :
```typescript
// Secousse légère pour avertissement
{ type: 'shake', duration: 0.5, intensity: 0.5 }

// Secousse intense pour erreur critique
{ type: 'shake', duration: 0.8, intensity: 2.0, iterations: 2 }
```

---

### 4. Bounce (Rebond)

#### `bounce`
Rebond vertical avec effet de gravité.

```typescript
{
  type: 'bounce',
  duration: 1.0,
  iterations: 2,
  intensity: 1.0
}
```

**Effet** : L'élément rebondit verticalement avec des hauteurs décroissantes.

**Cas d'usage** :
- Éléments ludiques et joyeux
- Confirmations de succès
- Éléments de jeu
- Animations enjouées

**Exemples** :
```typescript
// Petit rebond unique
{ type: 'bounce', duration: 0.6, intensity: 0.7, iterations: 1 }

// Rebonds multiples énergiques
{ type: 'bounce', duration: 1.2, intensity: 1.5, iterations: 3 }
```

---

### 5. Wiggle (Vacillement)

#### `wiggle`
Oscillation rotative comme un pendule.

```typescript
{
  type: 'wiggle',
  duration: 0.8,
  iterations: 2,
  intensity: 1.0
}
```

**Effet** : Rotation légère de -5° à +5° (par défaut).

**Cas d'usage** :
- Éléments qui disent "non"
- Indicateurs d'attention douce
- Éléments suspendus
- Objets qui se balancent

**Exemples** :
```typescript
// Léger vacillement
{ type: 'wiggle', duration: 0.6, intensity: 0.5 }

// Vacillement prononcé
{ type: 'wiggle', duration: 1.0, intensity: 2.0, iterations: 3 }
```

---

### 6. Glow (Lueur)

#### `glow`
Effet de lueur pulsante avec ombre portée.

```typescript
{
  type: 'glow',
  duration: 1.5,
  iterations: Infinity,
  intensity: 1.0
}
```

**Effet** : Ombre jaune pulsante qui crée un effet de luminosité (0-10px par défaut).

**Cas d'usage** :
- Éléments premium ou spéciaux
- Indicateurs de sélection
- Objets magiques ou spéciaux
- Mise en valeur subtile

**Exemples** :
```typescript
// Lueur douce continue
{ type: 'glow', duration: 2.0, intensity: 0.8, iterations: Infinity }

// Flash lumineux intense
{ type: 'glow', duration: 0.5, intensity: 2.0, iterations: 3 }
```

**Note** : La couleur de la lueur est jaune par défaut (rgba(255, 255, 0, 0.8)).

---

### 7. Flash (Clignotement)

#### `flash`
Clignotements rapides d'opacité.

```typescript
{
  type: 'flash',
  duration: 1.0,
  iterations: 2,
  intensity: 1.0
}
```

**Effet** : Alternance rapide entre opacité 1 et 0.

**Cas d'usage** :
- Alertes urgentes
- Notifications critiques
- Effets d'appareil photo
- Attention immédiate requise

**Exemples** :
```typescript
// Flash simple
{ type: 'flash', duration: 0.5, iterations: 1 }

// Clignotement d'alerte
{ type: 'flash', duration: 0.8, iterations: 5 }
```

**⚠️ Attention** : Évitez les clignotements rapides prolongés (risque de crises photosensibles).

---

### 8. Rubber Band (Élastique)

#### `rubber_band`
Étirement élastique horizontal et vertical.

```typescript
{
  type: 'rubber_band',
  duration: 1.0,
  iterations: 1,
  intensity: 1.0
}
```

**Effet** : L'élément s'étire comme un élastique avec des oscillations de scaleX et scaleY.

**Cas d'usage** :
- Effets comiques
- Réactions élastiques
- Feedbacks tactiles
- Animations ludiques

**Exemples** :
```typescript
// Étirement léger
{ type: 'rubber_band', duration: 0.8, intensity: 0.6 }

// Étirement prononcé
{ type: 'rubber_band', duration: 1.2, intensity: 1.5, iterations: 2 }
```

---

### 9. Swing (Balancement)

#### `swing`
Balancement comme un pendule avec rotation.

```typescript
{
  type: 'swing',
  duration: 1.0,
  iterations: 2,
  intensity: 1.0
}
```

**Effet** : Rotation oscillante de ±15° (par défaut) avec décroissance progressive.

**Cas d'usage** :
- Objets suspendus (lampes, enseignes)
- Éléments qui se balancent naturellement
- Animations douces d'attention
- Mouvements organiques

**Exemples** :
```typescript
// Balancement doux
{ type: 'swing', duration: 1.5, intensity: 0.7, iterations: 3 }

// Balancement fort
{ type: 'swing', duration: 1.0, intensity: 1.5, iterations: 5 }
```

---

### 10. Tada (Célébration)

#### `tada`
Célébration avec rotation et zoom.

```typescript
{
  type: 'tada',
  duration: 1.0,
  iterations: 2,
  intensity: 1.0
}
```

**Effet** : Combinaison de rotations alternées (±3°) et de zoom (110%).

**Cas d'usage** :
- Célébration de succès
- Victoires et récompenses
- Confirmations positives
- Moments de joie

**Exemples** :
```typescript
// Petit tada de confirmation
{ type: 'tada', duration: 0.8, intensity: 0.7, iterations: 1 }

// Grande célébration
{ type: 'tada', duration: 1.2, intensity: 1.5, iterations: 3 }
```

---

### 11. Wobble (Vacillement Avancé)

#### `wobble`
Vacillement complexe avec translation et rotation.

```typescript
{
  type: 'wobble',
  duration: 1.0,
  iterations: 1,
  intensity: 1.0
}
```

**Effet** : Mouvement complexe combinant déplacements horizontaux (±25%) et rotations (±5°).

**Cas d'usage** :
- Effets de déséquilibre
- Objets instables
- Animations comiques
- Réactions physiques

**Exemples** :
```typescript
// Léger vacillement
{ type: 'wobble', duration: 0.8, intensity: 0.5 }

// Vacillement prononcé
{ type: 'wobble', duration: 1.2, intensity: 1.8, iterations: 2 }
```

---

### 12. Jello (Gélatine)

#### `jello`
Effet gélatine avec distorsions skew.

```typescript
{
  type: 'jello',
  duration: 0.8,
  iterations: 1,
  intensity: 1.0
}
```

**Effet** : Distorsions progressives avec skewX et skewY (±12.5° par défaut).

**Cas d'usage** :
- Effets de matière molle
- Réactions élastiques
- Animations ludiques
- Feedbacks tactiles

**Exemples** :
```typescript
// Léger effet gélatine
{ type: 'jello', duration: 0.6, intensity: 0.6 }

// Effet gélatine prononcé
{ type: 'jello', duration: 1.0, intensity: 1.5, iterations: 2 }
```

---

### 13. Heart Beat (Battement de Cœur)

#### `heart_beat`
Pulsation rapide en deux temps comme un battement de cœur.

```typescript
{
  type: 'heart_beat',
  duration: 1.2,
  iterations: Infinity,
  intensity: 1.0
}
```

**Effet** : Double pulsation rapide (130% d'échelle) suivie d'un retour à la normale.

**Cas d'usage** :
- Boutons "J'aime" / Like
- Favoris et cœurs
- Éléments romantiques
- Indicateurs de vie

**Exemples** :
```typescript
// Battement léger continu
{ type: 'heart_beat', duration: 1.5, intensity: 0.7, iterations: Infinity }

// Battement intense
{ type: 'heart_beat', duration: 0.8, intensity: 1.5, iterations: 5 }
```

---

## 🎛️ Paramètres Avancés

### Intensity (Intensité)

L'intensité contrôle l'amplitude de l'animation :

```typescript
// Subtile
{ type: 'pulse', intensity: 0.3 }  // Zoom jusqu'à 103%

// Normale
{ type: 'pulse', intensity: 1.0 }  // Zoom jusqu'à 110%

// Intense
{ type: 'pulse', intensity: 2.0 }  // Zoom jusqu'à 120%
```

**Plage recommandée** : 0.1 à 2.0

### Iterations (Répétitions)

Contrôle le nombre de cycles :

```typescript
// Une seule fois
{ type: 'bounce', iterations: 1 }

// Plusieurs fois
{ type: 'shake', iterations: 3 }

// Infini (boucle continue)
{ type: 'glow', iterations: Infinity }
```

### Delay (Délai)

Décalage avant le début de l'animation :

```typescript
{
  type: 'pulse',
  duration: 1.0,
  delay: 2.0,        // Attend 2 secondes après l'entrée
  iterations: 3
}
```

## 💡 Exemples Pratiques

### Exemple 1 : Bouton CTA avec Pulse Infini

```typescript
const ctaButton: ShapeLayerConfig = {
  type: 'shape',
  shape: 'rectangle',
  x: 400,
  y: 500,
  width: 200,
  height: 60,
  emphasis_animation: {
    type: 'pulse',
    duration: 1.5,
    delay: 1.0,
    iterations: Infinity,
    intensity: 0.8,
    easing: 'ease-in-out'
  }
};
```

### Exemple 2 : Erreur de Formulaire avec Shake

```typescript
const errorField: TextLayerConfig = {
  type: 'text',
  content: '❌ Champ invalide',
  emphasis_animation: {
    type: 'shake',
    duration: 0.5,
    iterations: 2,
    intensity: 1.5
  }
};
```

### Exemple 3 : Badge "Nouveau" avec Glow

```typescript
const newBadge: ImageLayerConfig = {
  type: 'image',
  src: 'badge-new.png',
  emphasis_animation: {
    type: 'glow',
    duration: 2.0,
    iterations: Infinity,
    intensity: 1.2
  }
};
```

### Exemple 4 : Succès avec Tada

```typescript
const successIcon: TextLayerConfig = {
  type: 'text',
  content: '✓ Succès !',
  entrance_animation: { type: 'zoom_in', duration: 0.6 },
  emphasis_animation: {
    type: 'tada',
    duration: 1.0,
    delay: 0.6,
    iterations: 2,
    intensity: 1.3
  }
};
```

### Exemple 5 : Icône de Favori avec Heart Beat

```typescript
const favoriteIcon: TextLayerConfig = {
  type: 'text',
  content: '❤️',
  emphasis_animation: {
    type: 'heart_beat',
    duration: 1.2,
    iterations: Infinity,
    intensity: 1.0
  }
};
```

### Exemple 6 : Élément Instable avec Wobble

```typescript
const unstableElement: ImageLayerConfig = {
  type: 'image',
  src: 'object.png',
  emphasis_animation: {
    type: 'wobble',
    duration: 1.0,
    delay: 2.0,
    iterations: 1,
    intensity: 1.5
  }
};
```

## 🎬 Combinaisons d'Animations

### Entrée + Emphase + Sortie

```typescript
const completeLayer: TextLayerConfig = {
  type: 'text',
  content: 'Attention !',
  
  // Entrée
  entrance_animation: {
    type: 'bounce_in',
    duration: 1.0
  },
  
  // Emphase pendant la visibilité
  emphasis_animation: {
    type: 'pulse',
    duration: 1.5,
    delay: 1.0,        // Commence après l'entrée
    iterations: 3,
    intensity: 1.0
  },
  
  // Sortie
  duration: 8.0,
  exit_animation: {
    type: 'fade_out',
    duration: 1.0
  }
};
```

### Emphases Multiples Séquencées

Pour créer plusieurs emphases successives, utilisez des layers séparés ou contrôlez via JavaScript :

```typescript
const layer: TextLayerConfig = {
  type: 'text',
  content: 'Important !',
  emphasis_animation: {
    type: 'shake',
    duration: 0.5,
    delay: 2.0,
    iterations: 2
  }
};

// Puis changez dynamiquement l'animation pour une seconde emphase
// (nécessite API programmatique)
```

## 🎨 Bonnes Pratiques

### 1. **Choisir l'Animation selon le Contexte**

| Contexte | Animation Recommandée |
|----------|----------------------|
| Appel à l'action | `pulse`, `glow` |
| Erreur / Refus | `shake`, `wiggle` |
| Succès / Victoire | `tada`, `bounce` |
| Attention douce | `pulse`, `swing` |
| Alerte urgente | `flash`, `shake` |
| Élément premium | `glow`, `pulse` |
| Interactions ludiques | `rubber_band`, `jello`, `wobble` |
| Favoris / J'aime | `heart_beat`, `pulse` |

### 2. **Intensité Appropriée**

```typescript
// UI professionnelle : intensité faible
{ intensity: 0.3 - 0.7 }

// UI standard : intensité normale
{ intensity: 0.8 - 1.2 }

// UI ludique : intensité élevée
{ intensity: 1.3 - 2.0 }
```

### 3. **Durée et Rythme**

```typescript
// Rapide - Réactivité
duration: 0.3 - 0.6

// Normal - Équilibré
duration: 0.8 - 1.2

// Lent - Dramatique
duration: 1.5 - 2.5
```

### 4. **Iterations**

```typescript
// Une seule fois : feedback ponctuel
iterations: 1

// Quelques fois : attirer l'attention
iterations: 2 - 5

// Infini : état permanent (indicateurs)
iterations: Infinity
```

⚠️ **Attention** : Utilisez `Infinity` avec parcimonie pour éviter la fatigue visuelle.

### 5. **Timing et Delay**

```typescript
// Commence immédiatement après l'entrée
delay: 0

// Laisse le temps de voir l'élément
delay: 1.0 - 2.0

// Emphase tardive
delay: 3.0+
```

### 6. **Performance**

**Animations légères** (peu de ressources) :
- `pulse`, `fade`, `scale`

**Animations moyennes** :
- `shake`, `bounce`, `wiggle`, `swing`

**Animations lourdes** (plus de calculs) :
- `rubber_band`, `wobble`, `jello` (avec skew)
- `glow` (avec shadow)

**Recommandation** : Limitez à 3-5 animations d'emphase simultanées.

### 7. **Accessibilité**

- ⚠️ Évitez `flash` avec durée < 0.5s (risque de crises)
- ⚠️ Évitez `iterations: Infinity` sur trop d'éléments
- ✅ Proposez une option "Réduire les mouvements"
- ✅ Testez l'intensité pour éviter la fatigue visuelle

### 8. **Cohérence Visuelle**

Utilisez un style cohérent dans toute l'animation :

```typescript
// Style doux et professionnel
const softStyle = {
  duration: 1.2,
  intensity: 0.6,
  easing: 'ease-in-out'
};

// Style dynamique et énergique
const dynamicStyle = {
  duration: 0.6,
  intensity: 1.5,
  iterations: 3
};
```

## 🔧 API Programmatique

### Appliquer une Animation d'Emphase

```typescript
import { 
  applyEmphasisAnimation,
  stopEmphasisAnimation,
  pauseEmphasisAnimation,
  resumeEmphasisAnimation
} from '@engine/core/animations/emphasis_animation';

// Appliquer
const element = document.querySelector('.my-element');
applyEmphasisAnimation(element, {
  type: 'pulse',
  duration: 1.0,
  iterations: 3,
  intensity: 1.0
});

// Arrêter
stopEmphasisAnimation(element);

// Pause / Reprise
pauseEmphasisAnimation(element);
resumeEmphasisAnimation(element);
```

### Calculer la Durée Totale

```typescript
import { getEmphasisDuration } from '@engine/core/animations/emphasis_animation';

const config = {
  type: 'pulse',
  duration: 1.0,
  delay: 2.0,
  iterations: 3
};

const totalDuration = getEmphasisDuration(config);
// Résultat : 2.0 + (1.0 × 3) = 5.0 secondes
```

## 🌐 Compatibilité

| Environnement | Support | Notes |
|--------------|---------|-------|
| Frontend (Browser) | ✅ Complet | CSS animations natives |
| Server (Node.js) | ⚠️ Limité | Rendu frame-by-frame possible |
| Export Vidéo | ✅ Complet | Rendu calculé par frame |
| Export GIF | ✅ Complet | Avec limitation de FPS |

**Note** : Les animations d'emphase utilisent des CSS keyframes en frontend. Pour l'export, elles sont calculées frame par frame.

## 📚 Ressources Complémentaires

- [Guide des Layers](./05-LAYER.md)
- [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md)
- [Animations de Sortie](./12-EXIT-ANIMATIONS.md)
- [Système de Timing](./04-SCENE.md)
- [Configuration Whiteboard](./03-WHITEBOARD.md)

## 🎯 Résumé

Les animations d'emphase KIVG offrent :
- **12 animations professionnelles** pour tous les besoins
- **Contrôle fin** avec intensity, iterations, delay
- **Répétitions flexibles** de 1 fois à l'infini
- **Performance optimisée** avec CSS animations
- **Combinaisons puissantes** avec entrées et sorties

Les animations d'emphase sont l'outil parfait pour :
- ✨ Guider l'attention de l'utilisateur
- 🎯 Signaler les éléments importants
- 🎨 Ajouter du dynamisme à vos animations
- 💬 Communiquer des états (succès, erreur, attention)

Utilisez-les avec parcimonie et intention pour créer des expériences visuelles captivantes sans submerger votre audience ! 🚀
