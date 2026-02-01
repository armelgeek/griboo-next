# Documentation KIVG - Français 🇫🇷

Bienvenue dans la documentation complète en français du moteur d'animation KIVG (Kivg Animation Engine).

## 📚 Table des Matières

### 🎯 Introduction
- [Vue d'ensemble du moteur KIVG](./01-INTRODUCTION.md)
- [Architecture et concepts clés](./02-ARCHITECTURE.md)

### 🎨 Systèmes Principaux
- [Système Whiteboard](./03-WHITEBOARD.md) - Configuration et utilisation du tableau blanc
- [Système Scene](./04-SCENE.md) - Gestion des scènes et transitions
- [Système Layer](./05-LAYER.md) - Couches et rendus

### 🖼️ Types de Layers
- [Guide des Layers](./06-TYPES-LAYERS.md) - Tous les types de couches disponibles
- [Layers d'Images](./07-IMAGE-LAYERS.md) - Image, SimpleImage
- [Layers de Texte](./08-TEXT-LAYERS.md) - Text, Writing, Caption
- [Layers de Dessin](./09-DRAWING-LAYERS.md) - Path, SVGPath, Writing, Shape
- [Layers Spéciaux](./10-SPECIAL-LAYERS.md) - Push, Eraser, Rubber, Morph, Occlusion

### 🎬 Animations
- [Animations d'Entrée](./11-ENTRANCE-ANIMATIONS.md) - 80+ animations d'apparition
- [Animations de Sortie](./12-EXIT-ANIMATIONS.md) - 60+ animations de disparition
- [Animations d'Emphase](./13-EMPHASIS-ANIMATIONS.md) - 12 animations d'emphase

### ⚙️ Configuration
- [Guide de Configuration](./14-CONFIGURATION.md) - Tous les paramètres disponibles
- [Configuration Vidéo](./15-VIDEO-CONFIG.md) - Paramètres de rendu vidéo
- [Configuration des Mains](./16-HAND-CONFIG.md) - Overlay de main animée

### 🔧 Managers et Utilitaires
- [Système de Timing](./17-TIMING-MANAGER.md) - Gestion précise du temps
- [Hand Overlay Manager](./18-HAND-OVERLAY-MANAGER.md) - Gestion de l'animation des mains
- [Background Manager](./19-BACKGROUND-MANAGER.md) - Gestion des arrière-plans
- [Occlusion Culling](./20-OCCLUSION-CULLING.md) - Optimisation du rendu

### 📖 Guides Pratiques
- [Exemples d'Utilisation](./21-EXEMPLES.md) - Exemples pratiques complets
- [Meilleures Pratiques](./22-BEST-PRACTICES.md) - Recommandations et astuces
- [Guide de Performance](./23-PERFORMANCE.md) - Optimisation et performances

### 🔍 Référence API
- [API Frontend](./24-API-FRONTEND.md) - Interface navigateur
- [API Server](./25-API-SERVER.md) - Interface Node.js pour export vidéo
- [Types TypeScript](./26-TYPES-REFERENCE.md) - Référence complète des types

### 🎨 Système Éditeur
- [Éditeur de Scènes](./30-EDITEUR.md) - Interface visuelle d'édition
- [Éditeur de Caméra](./31-CAMERA-EDITEUR.md) - Gestion multi-caméras avancée

### 🖥️ Système Server
- [Server et Export Vidéo](./32-SERVER.md) - Rendu Node.js haute qualité

## 🚀 Démarrage Rapide

```typescript
import { Whiteboard } from '@kivg/engine';

const config = {
  scenes: [{
    id: 'scene-1',
    duration: 5,
    layers: [{
      type: 'text',
      textConfig: {
        text: "Bonjour le monde!",
        fontSize: 60
      },
      entrance_animation: {
        type: 'draw',
        duration: 2
      }
    }]
  }]
};

const whiteboard = new Whiteboard(config);
whiteboard.play();
```

## 📝 Note sur la Documentation

Cette documentation couvre **tous les systèmes** du moteur KIVG, incluant :
- ✅ Système Frontend : Tous les types de layers (14 types)
- ✅ Animations : 80+ entrées, 60+ sorties, 12 emphases
- ✅ Système Éditeur : Interface visuelle d'édition de scènes
- ✅ Système Server : Export vidéo haute qualité avec Node.js
- ✅ Managers et utilitaires : Timing, audio, caméra, etc.
- ✅ Configuration complète avec exemples
- ✅ Guides pratiques et meilleures pratiques

## 🆘 Besoin d'Aide ?

- 📖 Consultez les [Exemples Pratiques](./21-EXEMPLES.md)
- 💡 Lisez les [Meilleures Pratiques](./22-BEST-PRACTICES.md)
- 🐛 Référez-vous au [Guide de Performance](./23-PERFORMANCE.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
