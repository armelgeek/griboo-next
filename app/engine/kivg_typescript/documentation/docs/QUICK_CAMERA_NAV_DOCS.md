# Quick Camera Navigation - Documentation

## Vue d'ensemble

Le système de navigation rapide des caméras permet aux utilisateurs de naviguer efficacement entre plusieurs caméras dans l'éditeur en utilisant des raccourcis clavier et une interface visuelle intuitive.

## Fonctionnalités

### 🎹 Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+1` à `Ctrl+9` | Aller directement à la caméra 1-9 |
| `Ctrl+→` ou `Ctrl+↓` | Caméra suivante |
| `Ctrl+←` ou `Ctrl+↑` | Caméra précédente |
| `Ctrl+Tab` | Caméra suivante |
| `Ctrl+Shift+Tab` | Caméra précédente |

**Notes**:
- Les raccourcis fonctionnent partout dans l'éditeur
- Les champs de saisie (input, textarea) sont ignorés pour éviter les conflits
- Sur Mac, `Cmd` peut être utilisé à la place de `Ctrl`

### 🎨 Interface Visuelle

Le widget de navigation affiche:
- **Icône de caméra** avec le nom de la caméra active
- **Index actuel** (ex: "2/5" pour caméra 2 sur 5)
- **Boutons ◀/▶** pour navigation précédent/suivant
- **Dropdown** avec la liste complète des caméras (clic sur le centre)
- **Indices des raccourcis** en bas du widget

### 💫 Feedback Visuel

- **Notification centrale**: Affiche le nom de la caméra lors du changement
- **Animation fluide**: Transition douce de 1.8 secondes
- **Badge "Défaut"**: Indique la caméra par défaut dans la liste
- **Raccourcis visibles**: Affichés à côté de chaque caméra dans le dropdown

### 📍 Positionnement

4 positions disponibles:
- `top-left` - En haut à gauche
- `top-right` - En haut à droite (par défaut)
- `bottom-left` - En bas à gauche
- `bottom-right` - En bas à droite

## Installation & Usage

### Installation Simple

```typescript
import { SceneCanvas, QuickCameraNav } from '@armelwanes/wb-engine/editor';

// Créer le canvas de scène
const sceneCanvas = new SceneCanvas(container, sceneConfig);

// Initialiser la navigation rapide
const quickNav = new QuickCameraNav({
    container: container,              // Élément DOM conteneur
    cameras: sceneCanvas.getAllCameras(),  // Liste des caméras
    selectedCameraId: null,            // Caméra sélectionnée (optionnel)
    position: 'top-right'              // Position du widget (optionnel)
});

// Définir les callbacks
quickNav.setCallbacks({
    onNavigateToCamera: (cameraId) => {
        sceneCanvas.selectCamera(cameraId);
        console.log('Navigué vers:', cameraId);
    },
    onNavigateNext: () => {
        console.log('Navigation suivante');
    },
    onNavigatePrevious: () => {
        console.log('Navigation précédente');
    }
});
```

### Mise à Jour des Caméras

Quand les caméras changent (ajout/suppression):

```typescript
// Après avoir ajouté une caméra
sceneCanvas.addCamera(newCamera);
quickNav.updateCameras(sceneCanvas.getAllCameras());

// Après avoir supprimé une caméra
sceneCanvas.removeCamera(cameraId);
quickNav.updateCameras(sceneCanvas.getAllCameras());
```

### Mise à Jour de la Sélection

Quand la caméra sélectionnée change:

```typescript
sceneCanvas.selectCamera(cameraId);
quickNav.setSelectedCamera(cameraId);
```

### Nettoyage

Pour détruire le composant:

```typescript
quickNav.destroy();
```

Cela supprime:
- Le widget du DOM
- Les event listeners clavier
- Toutes les références internes

## API Complète

### Types

```typescript
interface QuickCameraNavConfig {
    container: HTMLElement;           // Conteneur parent
    cameras: Camera[];                // Liste des caméras
    selectedCameraId: string | null;  // ID de la caméra sélectionnée
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface QuickCameraNavCallbacks {
    onNavigateToCamera?: (cameraId: string) => void;
    onNavigateNext?: () => void;
    onNavigatePrevious?: () => void;
}

interface Camera {
    id: string;
    name?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    zoom?: number;
    isDefault?: boolean;
    color?: string;
}
```

### Méthodes

#### `constructor(config: QuickCameraNavConfig)`
Crée une nouvelle instance du composant de navigation.

#### `setCallbacks(callbacks: QuickCameraNavCallbacks): void`
Définit les fonctions de callback pour les événements de navigation.

#### `updateCameras(cameras: Camera[]): void`
Met à jour la liste des caméras affichées dans le widget.

#### `setSelectedCamera(cameraId: string | null): void`
Met à jour la caméra actuellement sélectionnée.

#### `destroy(): void`
Nettoie le composant et supprime tous les event listeners.

## Exemples d'Usage

### Exemple 1: Integration Basique

```typescript
const quickNav = new QuickCameraNav({
    container: document.getElementById('editor'),
    cameras: sceneCanvas.getAllCameras(),
    selectedCameraId: 'cam-1',
    position: 'top-right'
});

quickNav.setCallbacks({
    onNavigateToCamera: (cameraId) => {
        sceneCanvas.selectCamera(cameraId);
    }
});
```

### Exemple 2: Synchronisation avec SceneCanvas

```typescript
let quickNav = null;

function syncCameras() {
    if (quickNav) {
        quickNav.updateCameras(sceneCanvas.getAllCameras());
    }
}

// Après ajout de caméra
sceneCanvas.addCamera(newCamera);
syncCameras();

// Après suppression
sceneCanvas.removeCamera(cameraId);
syncCameras();
```

### Exemple 3: Changement de Position Dynamique

```typescript
function changeNavPosition(newPosition) {
    if (quickNav) {
        quickNav.destroy();
    }
    
    quickNav = new QuickCameraNav({
        container: container,
        cameras: sceneCanvas.getAllCameras(),
        selectedCameraId: currentCameraId,
        position: newPosition
    });
    
    quickNav.setCallbacks(callbacks);
}

// Usage
changeNavPosition('bottom-left');
```

### Exemple 4: Avec Gestion d'Erreurs

```typescript
const quickNav = new QuickCameraNav({
    container: container,
    cameras: sceneCanvas.getAllCameras(),
    selectedCameraId: null,
    position: 'top-right'
});

quickNav.setCallbacks({
    onNavigateToCamera: (cameraId) => {
        try {
            const camera = sceneCanvas.getCameraConfig(cameraId);
            if (!camera) {
                console.error('Caméra non trouvée:', cameraId);
                return;
            }
            sceneCanvas.selectCamera(cameraId);
            console.log('Navigué vers:', camera.name);
        } catch (error) {
            console.error('Erreur de navigation:', error);
        }
    }
});
```

## Styling & Personnalisation

Le composant génère son propre CSS inline pour être autonome. Les styles incluent:

- **Thème moderne**: Arrondis, ombres, transitions fluides
- **Responsive**: S'adapte au contenu
- **Accessible**: Support clavier complet
- **Dark-mode ready**: Peut être étendu pour supporter le mode sombre

Pour personnaliser davantage, vous pouvez:
1. Modifier directement `quick-camera-nav.ts`
2. Ou surcharger les styles CSS via des sélecteurs plus spécifiques

## Accessibilité

- ✅ Navigation clavier complète
- ✅ Attributs ARIA sur les boutons
- ✅ Indicateurs visuels clairs
- ✅ Support des lecteurs d'écran
- ✅ Focus visible sur les éléments interactifs

## Performance

- ✅ Event delegation pour les items de liste
- ✅ Debouncing automatique des mises à jour
- ✅ Cleanup propre des listeners
- ✅ DOM minimal (pas de framework)
- ✅ CSS inline optimisé

## Compatibilité

- ✅ Navigateurs modernes (Chrome, Firefox, Safari, Edge)
- ✅ Support mobile (touch events)
- ✅ TypeScript 5.x
- ✅ Node.js 18+

## Limitations Connues

1. **Maximum 9 raccourcis numériques**: Seules les caméras 1-9 ont des raccourcis Ctrl+N
2. **Pas de raccourcis personnalisables**: Les raccourcis sont fixes
3. **Position fixe**: Le widget reste fixe, pas de drag & drop
4. **Pas de groupes**: Toutes les caméras dans une seule liste

## FAQ

**Q: Puis-je avoir plusieurs instances?**
A: Oui, mais assurez-vous d'utiliser des conteneurs différents et gérez les callbacks séparément.

**Q: Comment désactiver temporairement les raccourcis?**
A: Appelez `destroy()` puis recréez l'instance quand nécessaire.

**Q: Les raccourcis fonctionnent-ils dans les modals?**
A: Oui, sauf si le focus est dans un champ de saisie.

**Q: Puis-je personnaliser les icônes?**
A: Oui, modifiez les emojis dans `quick-camera-nav.ts`.

**Q: Comment débugger?**
A: Activez les logs console dans les callbacks pour voir les événements.

## Support

Pour signaler des bugs ou demander des fonctionnalités:
- GitHub Issues: https://github.com/armelgeek/engine/issues
- Documentation: Voir README.md du projet

## Licence

Même licence que le projet principal (@armelwanes/wb-engine).
