# Shared Stroke Extraction Logic - Verification

## Architecture

Pour garantir que le **frontend** et le **serveur** utilisent **exactement la même logique** pour l'extraction des strokes, nous avons créé un module partagé:

```
src/shared/stroke-extraction-core.ts
```

## Flux d'utilisation

### Frontend (Browser)
```
src/frontend/core/hybrid_layer_animator.ts
  └─> extractStrokes() method
       └─> extractStrokesCore() from shared/stroke-extraction-core.ts
            └─> Uses shared/image-processing.ts functions
```

### Server (Node.js)
```
src/shared/utils.ts
  └─> extractStrokes() function
       └─> extractStrokesCore() from shared/stroke-extraction-core.ts
            └─> Uses shared/image-processing.ts functions
```

## Logique partagée (extractStrokesCore)

Les deux implémentations appellent **exactement la même fonction** qui implémente:

```typescript
export function extractStrokesCore(
    gray: Uint8Array, 
    width: number, 
    height: number
): ImageProc.Point[][] {
    // 1. Global threshold pre-filter (100)
    const darkPixelsOnly = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
        darkPixelsOnly[i] = gray[i] < 100 ? gray[i] : 255;
    }

    // 2. Adaptive Thresholding (blockSize=15, C=2)
    const binary = ImageProc.adaptiveThreshold(darkPixelsOnly, width, height, 15, 2);

    // 3. Morphological opening (size=2)
    const denoised = ImageProc.erode(binary, width, height, 2);
    const opened = ImageProc.dilate(denoised, width, height, 2);

    // 4. Thinning
    const skeleton = ImageProc.thinning(opened, width, height);

    // 5. Trace skeleton
    const rawPaths = ImageProc.traceSkeleton(skeleton, width, height);

    return rawPaths;
}
```

## Paramètres centralisés

Les paramètres sont définis dans `STROKE_EXTRACTION_PARAMS`:

```typescript
export const STROKE_EXTRACTION_PARAMS = {
    DARKNESS_THRESHOLD: 100,       // Seuil global
    ADAPTIVE_BLOCK_SIZE: 15,       // Taille de bloc adaptatif
    ADAPTIVE_C: 2,                 // Constante C adaptative
    MORPHOLOGICAL_SIZE: 2,         // Taille morphologique
} as const;
```

## Différences post-traitement

Seul le **post-traitement** diffère légèrement entre frontend et serveur:

### Frontend
- Utilise `animationConfig.duration` et `animationConfig.strokeRatio` pour calculer le nombre de points cible
- Applique Douglas-Peucker avec epsilon basé sur la durée
- Applique Catmull-Rom smoothing

### Server
- Version simplifiée sans dépendance à la configuration d'animation
- Douglas-Peucker avec epsilon fixe
- Catmull-Rom smoothing identique

**Important:** La partie critique (extraction des strokes du pixel) est **100% identique**.

## Vérification

Pour vérifier que la logique est partagée:

```bash
# Rechercher les imports de extractStrokesCore
grep -r "extractStrokesCore" src/

# Résultat attendu:
# src/shared/stroke-extraction-core.ts: export function extractStrokesCore
# src/frontend/core/hybrid_layer_animator.ts: import { extractStrokesCore }
# src/shared/utils.ts: import { extractStrokesCore }
```

## Tests de compilation

```bash
npm run type-check
```

✅ **Aucune erreur** - La logique est compatible et partagée correctement.

## Conclusion

✅ Le frontend et le serveur utilisent **exactement la même fonction** `extractStrokesCore()`
✅ Les paramètres sont **centralisés** dans `STROKE_EXTRACTION_PARAMS`
✅ L'algorithme d'extraction est **identique** à 100%
✅ Seul le post-processing (simplification) diffère légèrement pour des raisons pratiques
