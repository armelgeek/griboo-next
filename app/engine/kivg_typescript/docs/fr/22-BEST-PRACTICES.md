# Meilleures Pratiques

## 📋 Vue d'Ensemble

Ce guide présente les meilleures pratiques pour développer avec le moteur KIVG de manière efficace, maintenable et performante.

## 🎯 Organisation du Code

### Structure des Fichiers

```
project/
├── assets/
│   ├── images/          # Images optimisées
│   ├── audio/           # Fichiers audio
│   ├── fonts/           # Polices custom
│   └── svg/             # Fichiers SVG
├── configs/
│   ├── scenes/          # Configurations de scènes
│   ├── layers/          # Configs de layers réutilisables
│   └── animations/      # Presets d'animations
├── src/
│   ├── whiteboard.ts    # Configuration principale
│   ├── scenes.ts        # Définitions de scènes
│   └── utils.ts         # Utilitaires
└── dist/                # Build final
```

### Séparation des Préoccupations

```typescript
// ✅ BON : Séparer configuration et logique
// config/scene1.ts
export const scene1Config = {
  id: 'scene-1',
  duration: 10,
  layers: [/* ... */]
};

// src/whiteboard.ts
import { scene1Config } from './config/scene1';

const whiteboard = new Whiteboard({
  scenes: [scene1Config, scene2Config]
});
```

```typescript
// ❌ MAUVAIS : Tout dans un fichier
const whiteboard = new Whiteboard({
  scenes: [{
    id: 'scene-1',
    // 500 lignes de configuration...
  }]
});
```

## 🎨 Configuration des Scènes

### Nommage Cohérent

```typescript
// ✅ BON : Noms descriptifs et consistants
{
  scenes: [
    { id: 'intro-welcome', name: 'Introduction - Bienvenue' },
    { id: 'content-features', name: 'Contenu - Fonctionnalités' },
    { id: 'outro-cta', name: 'Conclusion - Call to Action' }
  ]
}
```

```typescript
// ❌ MAUVAIS : Noms vagues
{
  scenes: [
    { id: 'scene1', name: 'Scene 1' },
    { id: 's2', name: 'Another' }
  ]
}
```

### Réutilisation de Configurations

```typescript
// ✅ BON : Créer des presets réutilisables
const titleStyle = {
  fontSize: 60,
  fontFamily: 'Arial Bold',
  color: '#000000',
  align: 'center' as const
};

const fadeInAnimation = {
  type: 'fadeIn' as const,
  duration: 1,
  easing: 'easeInOutQuad'
};

// Utiliser dans plusieurs layers
{
  type: 'text',
  textConfig: { text: 'Titre 1', ...titleStyle },
  entrance_animation: fadeInAnimation
}
```

### Constantes Centralisées

```typescript
// config/constants.ts
export const TIMING = {
  SHORT: 1,
  MEDIUM: 2,
  LONG: 3
};

export const COLORS = {
  PRIMARY: '#3498db',
  SECONDARY: '#2ecc71',
  ACCENT: '#e74c3c'
};

export const POSITIONS = {
  CENTER: { x: 960, y: 540 },
  TOP_LEFT: { x: 100, y: 100 },
  BOTTOM_RIGHT: { x: 1820, y: 980 }
};

// Utilisation
{
  textConfig: { color: COLORS.PRIMARY },
  position: POSITIONS.CENTER,
  entrance_duration: TIMING.MEDIUM
}
```

## 🎬 Gestion des Layers

### Organisation par Z-Index

```typescript
// ✅ BON : Z-index logiques et espacés
const Z_INDEX = {
  BACKGROUND: 0,
  CONTENT: 100,
  OVERLAY: 200,
  UI: 300
};

{
  layers: [
    { type: 'image', src: 'bg.png', z_index: Z_INDEX.BACKGROUND },
    { type: 'text', text: 'Titre', z_index: Z_INDEX.CONTENT },
    { type: 'shape', z_index: Z_INDEX.OVERLAY }
  ]
}
```

### Timing Précis

```typescript
// ✅ BON : Timeline claire avec commentaires
{
  duration: 10,
  layers: [
    {
      // Apparaît immédiatement
      entrance_delay: 0,
      entrance_duration: 1,
      duration: 8,
      exit_duration: 1
      // Total : 0-9s (reste 1s de buffer)
    },
    {
      // Apparaît après 3s
      entrance_delay: 3,
      entrance_duration: 1,
      duration: 5,
      exit_duration: 1
      // Total : 3-10s
    }
  ]
}
```

### Validation des Configs

```typescript
// ✅ BON : Valider avant utilisation
import { validateConfig } from '@kivg/engine/validator';

const config = { /* ... */ };

const validation = validateConfig(config);
if (!validation.valid) {
  console.error('Erreurs:', validation.errors);
  throw new Error('Configuration invalide');
}

const whiteboard = new Whiteboard(config);
```

## 🎥 Animations

### Choix d'Animations Appropriées

```typescript
// ✅ BON : Animations cohérentes par contexte
{
  // Intro : Animations dynamiques
  entrance_animation: { type: 'bounceIn', duration: 1 },
  
  // Contenu : Animations subtiles
  entrance_animation: { type: 'fadeIn', duration: 0.5 },
  
  // Outro : Animations élégantes
  exit_animation: { type: 'fadeOut', duration: 1 }
}
```

### Durées Cohérentes

```typescript
// ✅ BON : Durées standardisées
const ANIMATION_DURATION = {
  INSTANT: 0.3,
  FAST: 0.5,
  NORMAL: 1.0,
  SLOW: 2.0
};

// Rapide pour UI
{ entrance_animation: { type: 'fadeIn', duration: ANIMATION_DURATION.FAST } }

// Normal pour contenu
{ entrance_animation: { type: 'draw', duration: ANIMATION_DURATION.NORMAL } }

// Lent pour emphase
{ entrance_animation: { type: 'bounceIn', duration: ANIMATION_DURATION.SLOW } }
```

### Easing Functions

```typescript
// ✅ BON : Easing adapté au mouvement
{
  // Naturel pour la plupart des cas
  easing: 'easeInOutQuad',
  
  // Élastique pour effets ludiques
  easing: 'easeOutElastic',
  
  // Exponentiel pour accélérations
  easing: 'easeInExpo',
  
  // Linéaire pour mouvements mécaniques
  easing: 'linear'
}
```

## 🖼️ Assets

### Optimisation des Images

```typescript
// ✅ BON : Images optimisées
// - PNG pour transparence, compressé avec pngquant
// - JPG pour photos, qualité 85%
// - WebP pour support moderne
// - SVG pour icons et logos

{
  type: 'image',
  src: '/images/logo.webp',  // Format moderne
  fallback: '/images/logo.png'  // Fallback
}
```

### Chemins Relatifs vs Absolus

```typescript
// ✅ BON : Chemins relatifs à la config
const BASE_PATH = process.env.ASSET_PATH || '/assets';

{
  src: `${BASE_PATH}/images/logo.png`
}
```

### Préchargement Sélectif

```typescript
// ✅ BON : Précharger assets critiques uniquement
{
  preload: {
    images: [
      '/images/logo.png',      // Logo (critique)
      '/images/intro-bg.png'   // Background intro (critique)
    ],
    // Pas de préchargement des images de scènes ultérieures
  }
}
```

## 🔊 Audio

### Normalisation du Volume

```typescript
// ✅ BON : Volumes normalisés et cohérents
{
  audio: {
    tracks: [
      { type: 'background', src: 'music.mp3', volume: 0.3 },
      { type: 'voiceover', src: 'narration.wav', volume: 0.8 },
      { type: 'sfx', volume: 0.5 }
    ],
    masterVolume: 1.0,
    normalization: {
      enabled: true,
      targetLoudness: -16  // LUFS standard
    }
  }
}
```

### Formats Audio

```typescript
// ✅ BON : Formats optimaux par usage
// MP3 : Musique de fond (bon ratio qualité/taille)
// WAV : Voix off (qualité max)
// OGG : Effets sonores (petit et qualité correcte)

{
  tracks: [
    { src: 'music.mp3', format: 'mp3' },
    { src: 'voice.wav', format: 'wav' },
    { src: 'click.ogg', format: 'ogg' }
  ]
}
```

## 📷 Caméra

### Planning de Séquence

```typescript
// ✅ BON : Séquence de caméras planifiée
{
  cameras: [
    {
      id: 'cam-wide',
      name: 'Vue Large',
      position: { x: 0, y: 0 },
      zoom: 1.0,
      duration: 5,
      transition_duration: 2
    },
    {
      id: 'cam-detail',
      name: 'Détail Produit',
      position: { x: 1200, y: 600 },
      zoom: 2.0,
      duration: 8,
      transition_duration: 1.5
    },
    {
      id: 'cam-outro',
      name: 'Conclusion',
      position: { x: 500, y: 300 },
      zoom: 1.0,
      duration: 4,
      transition_duration: 0
    }
  ]
}
```

### Transitions Fluides

```typescript
// ✅ BON : Durées adaptées à la distance
function calculateTransitionDuration(cam1, cam2) {
  const dx = cam2.position.x - cam1.position.x;
  const dy = cam2.position.y - cam1.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Plus la distance est grande, plus la transition est longue
  return Math.max(1.0, Math.min(3.0, distance / 1000));
}
```

## 💾 Export Vidéo

### Prévisualisation Rapide

```typescript
// ✅ BON : Config rapide pour tests
await whiteboard.renderToVideo('test.mp4', {
  resolution: '720p',
  codec: 'libx264',
  preset: 'ultrafast',
  quality: 28,
  frameRange: [0, 150]  // 5 secondes seulement
});
```

### Production Finale

```typescript
// ✅ BON : Config optimale pour production
await whiteboard.renderToVideo('final.mp4', {
  resolution: '1080p',
  codec: 'libx264',
  preset: 'medium',
  quality: 23,
  includeAudio: true,
  audioCodec: 'aac',
  audioBitrate: '192k',
  parallelism: 'auto'
});
```

## 🐛 Debugging

### Logs Structurés

```typescript
// ✅ BON : Logs avec contexte
whiteboard.on('error', (error) => {
  console.error('[KIVG Error]', {
    type: error.type,
    message: error.message,
    scene: error.sceneId,
    layer: error.layerId,
    timestamp: new Date().toISOString()
  });
});
```

### Mode Debug

```typescript
// ✅ BON : Activer debug pendant développement
if (process.env.NODE_ENV === 'development') {
  whiteboard.setDebugMode(true);
  whiteboard.setLogLevel('debug');
}
```

### Tests Progressifs

```typescript
// ✅ BON : Tester étape par étape
// 1. Tester une scène
const testScene = scenes[0];
await whiteboard.testScene(testScene);

// 2. Tester une transition
await whiteboard.testTransition(scene1, scene2);

// 3. Tester export court
await whiteboard.renderToVideo('test.mp4', {
  frameRange: [0, 30]  // 1 seconde
});

// 4. Export complet
await whiteboard.renderToVideo('final.mp4');
```

## 🔒 Sécurité

### Validation des Entrées Utilisateur

```typescript
// ✅ BON : Valider et sanitizer
function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '')  // Retirer HTML
    .substring(0, 1000);   // Limiter longueur
}

{
  type: 'text',
  textConfig: {
    text: sanitizeText(userInput)
  }
}
```

### Gestion des Chemins

```typescript
// ✅ BON : Valider les chemins d'assets
import path from 'path';

function validateAssetPath(assetPath: string): boolean {
  const normalized = path.normalize(assetPath);
  return !normalized.includes('..') && 
         !path.isAbsolute(normalized);
}

if (!validateAssetPath(userProvidedPath)) {
  throw new Error('Chemin invalide');
}
```

## 📊 Performance

### Lazy Loading Intelligent

```typescript
// ✅ BON : Charger selon la scène active
whiteboard.on('scenechange', async (newScene) => {
  // Précharger la scène suivante
  const nextScene = getNextScene(newScene);
  if (nextScene) {
    await nextScene.preload();
  }
  
  // Libérer la scène précédente
  const prevScene = getPrevScene(newScene);
  if (prevScene) {
    prevScene.dispose();
  }
});
```

### Caching Stratégique

```typescript
// ✅ BON : Cache pour assets réutilisés
const logoConfig = {
  type: 'image',
  src: '/images/logo.png',
  cacheKey: 'logo',      // Réutilisé dans plusieurs scènes
  cacheEnabled: true
};

// Réutiliser dans plusieurs scènes
scenes.forEach(scene => {
  scene.layers.push({ ...logoConfig, position: { x: 100, y: 100 } });
});
```

## 📝 Documentation

### Commentaires Utiles

```typescript
// ✅ BON : Commenter l'intention, pas l'évident
{
  // Animation rapide pour ne pas ralentir le flux
  entrance_duration: 0.5,
  
  // Zoom pour montrer les détails du produit
  zoom: 2.0,
  
  // Positionné selon les règles de composition (règle des tiers)
  position: { x: 640, y: 360 }
}
```

```typescript
// ❌ MAUVAIS : Commenter l'évident
{
  // Durée d'entrée à 0.5
  entrance_duration: 0.5,
  
  // Zoom à 2.0
  zoom: 2.0
}
```

### README du Projet

```markdown
# Mon Projet KIVG

## Description
Animation promotionnelle pour le produit X.

## Structure
- `src/scenes/` : Configurations des scènes
- `assets/` : Images, audio, SVG
- `dist/` : Vidéos finales

## Scripts
- `npm run dev` : Prévisualisation
- `npm run build` : Export production

## Conventions
- Durées en secondes
- Positions en pixels (origin top-left)
- Colors en hex (#RRGGBB)
```

## 🔄 CI/CD

### Scripts de Build

```json
{
  "scripts": {
    "preview": "node render.js --mode=preview",
    "build:test": "node render.js --quality=draft",
    "build:prod": "node render.js --quality=production",
    "validate": "node validate-config.js"
  }
}
```

### Automatisation

```yaml
# .github/workflows/render.yml
name: Render Video
on:
  push:
    branches: [main]

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
      - name: Install deps
        run: npm install
      - name: Validate config
        run: npm run validate
      - name: Render video
        run: npm run build:prod
      - name: Upload artifact
        uses: actions/upload-artifact@v2
        with:
          name: video
          path: dist/*.mp4
```

## 📚 Ressources

### Documentation Connexe
- [Architecture](./02-ARCHITECTURE.md)
- [Configuration](./14-CONFIGURATION.md)
- [Performance](./23-PERFORMANCE.md)
- [API Frontend](./24-API-FRONTEND.md)

### Exemples
- `examples/best-practices/` - Exemples de bonnes pratiques
- `examples/anti-patterns/` - Pièges à éviter

---

**Version** : 1.0.0  
**Dernière mise à jour** : Février 2026
