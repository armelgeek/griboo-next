# Introduction au Moteur KIVG

## 🎯 Vue d'Ensemble

Le **moteur KIVG** (Kivg Animation Engine) est un moteur d'animation professionnel haute performance conçu pour créer des animations de type "tableau blanc" (whiteboard animations). Il fonctionne à la fois dans le navigateur et sous Node.js pour l'export vidéo.

## ✨ Caractéristiques Principales

### 🎨 Visuels et Rendu
- **Bibliothèque d'Animations Complexes** : Plus de 90 animations professionnelles (entrée, sortie, emphase)
- **Overlay de Main Intelligent** : Animations réalistes de main pour dessiner et effacer avec images personnalisables
- **Occlusion Culling** : Détection automatique des superpositions de couches pour un rendu optimisé
- **Support Multi-Scènes** : Transitions fluides entre scènes avec effets personnalisables
- **Support Vectoriel Kivg** : Rendu haute précision de graphiques vectoriels avec animation trait par trait
- **Texte vers SVG** : Rendu de texte multilingue avec modes d'animation stroke ou typewriter

### 🎵 Audio Immersif
- **Panoramique Stéréo et Spatial** : Tous les sons procéduraux se positionnent automatiquement selon leur position à l'écran
- **Mixage Multi-Pistes** : Support pour musique de fond, voix off et effets sonores avec contrôle de volume indépendant
- **Normalisation Audio** : Normalisation globale du volume pour un mix final professionnel

### 🎥 Export Haute Qualité (Node.js)
- **Rendu Parallèle** : Support multi-cœurs avec pools de workers pour un rendu jusqu'à 10x plus rapide
- **Mémoire Efficace** : Écriture directe sur disque pour supporter des heures de vidéo haute résolution sans fuite mémoire
- **H.264 & H.265 (HEVC)** : Support des codecs standards de l'industrie avec accélération matérielle (NVENC) si disponible
- **Sous-titres Intégrés** : Rendu professionnel de sous-titres directement dans le flux vidéo

## 🏗️ Architecture

Le moteur KIVG est structuré en trois composants principaux :

```
KIVG Engine
├── Frontend (Navigateur)
│   ├── Whiteboard System
│   ├── Scene Management
│   ├── Layer System
│   └── Animation Engine
│
├── Server (Node.js)
│   ├── Video Export
│   ├── Parallel Rendering
│   └── Audio Processing
│
└── Shared (Commun)
    ├── Types & Interfaces
    ├── Core Logic
    └── Utilities
```

### Frontend (`src/frontend`)
- Implémentation navigateur pour prévisualisation en temps réel
- Utilise HTML5 Canvas et ImageData
- Alias `@engine/*` pour imports simplifiés

### Server (`src/server`)
- Implémentation Node.js pour export vidéo/GIF haute qualité
- Utilise `node-canvas` et `ffmpeg`
- Classes préfixées `Server` (ex: `ServerScene`, `ServerWhiteboard`)

### Shared (`src/shared`)
- Types communs (`types/index.ts`)
- Logique d'easing
- Utilitaires universels

## 🎯 Cas d'Usage

### 1. Prévisualisation Interactive (Frontend)
```typescript
import { Whiteboard } from '@kivg/engine';

const whiteboard = new Whiteboard(config);
whiteboard.play();
whiteboard.pause();
whiteboard.seek(0.5); // Aller à 50%
```

### 2. Export Vidéo Professionnel (Server)
```typescript
import { ServerWhiteboard } from '@kivg/engine/server';

const whiteboard = new ServerWhiteboard(config);
await whiteboard.prepare();
await whiteboard.renderToVideo('output.mp4', {
  resolution: '1080p',
  codec: 'libx265',
  quality: 20
});
```

### 3. Export GIF Animé (Server)
```typescript
await whiteboard.renderToGif('animation.gif', {
  width: 800,
  height: 600,
  fps: 15
});
```

## 📊 Hiérarchie des Concepts

```
Whiteboard (Tableau Blanc)
  └── Scene (Scène) - Durée définie
      └── Layer (Couche) - Élément visuel animé
          ├── Entrance Animation (Animation d'entrée)
          ├── Emphasis Animation (Animation d'emphase)
          └── Exit Animation (Animation de sortie)
```

## 🔑 Concepts Clés

### Whiteboard (Tableau Blanc)
Le conteneur principal qui gère toutes les scènes et la configuration globale.

### Scene (Scène)
Une séquence temporelle contenant plusieurs couches (layers). Chaque scène a une durée définie et peut avoir des transitions vers la scène suivante.

### Layer (Couche)
Un élément visuel individuel (texte, image, forme, chemin SVG) qui peut être animé indépendamment.

### Animations
- **Entrance** : Comment le layer apparaît
- **Emphasis** : Animations pendant que le layer est visible
- **Exit** : Comment le layer disparaît

### Hand Overlay
Animation de main réaliste qui suit automatiquement les actions de dessin/écriture/effacement.

### Occlusion Culling
Optimisation intelligente qui détecte et "efface" les parties cachées des layers superposés.

## 🎓 Philosophie de Conception

1. **Configuration-First** : Tout le rendu est piloté par des configs JSON-compatibles
2. **Type Safety** : Strictement typé avec TypeScript
3. **Performance** : Optimisations avec cache, culling et rendu parallèle
4. **Flexibilité** : Support frontend et server avec même API
5. **Professionalisme** : Qualité vidéo broadcast-ready

## 🚀 Prochaines Étapes

1. Explorez l'[Architecture](./02-ARCHITECTURE.md) pour comprendre en profondeur
2. Consultez le [Système Whiteboard](./03-WHITEBOARD.md) pour commencer
3. Découvrez les [Types de Layers](./06-TYPES-LAYERS.md) disponibles
4. Apprenez les [Animations](./11-ENTRANCE-ANIMATIONS.md) disponibles

## 📚 Resources Additionnelles

- [Guide de Configuration](./14-CONFIGURATION.md)
- [Exemples Pratiques](./21-EXEMPLES.md)
- [Meilleures Pratiques](./22-BEST-PRACTICES.md)
- [API Reference](./24-API-FRONTEND.md)

---

**Navigation** : [Suivant : Architecture →](./02-ARCHITECTURE.md)
