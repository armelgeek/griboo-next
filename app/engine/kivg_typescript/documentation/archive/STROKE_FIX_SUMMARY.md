# Résolution du problème de détection des strokes

## Problème initial

Lors de l'animation des "hybrid layers", les zones blanches de l'image originale devenaient plus foncées (grises ou noires) au lieu de rester blanches. Cela était particulièrement visible dans les illustrations avec des zones blanches importantes (ex: chemises blanches, arrière-plans clairs, etc.).

### Images de référence
- **Résultat actuel (avant correction)**: Zones blanches devenant grises/foncées
- **Résultat souhaité**: Zones blanches restant proprement blanches
- **Image originale**: Illustration colorée avec des zones blanches claires

## Causes identifiées

### 1. Logique inversée dans le seuillage adaptatif

**Fichier**: `src/shared/image-processing.ts`

**Ligne problématique (avant)**:
```typescript
output[y * width + x] = data[y * width + x] > (mean - C) ? 0 : 255;
```

**Explication du problème**:
- Les pixels **clairs** (valeur haute, proche de 255 = blanc) étaient marqués à **0** (noir dans l'image binaire)
- Les pixels **foncés** (valeur basse, proche de 0 = noir) étaient marqués à **255** (blanc dans l'image binaire)
- Résultat: Le fond blanc était traité comme un stroke, et les vrais strokes comme du fond

**Ligne corrigée**:
```typescript
// If pixel is darker than mean-C, it's a stroke (set to 255 = white in binary)
// If pixel is lighter than mean-C, it's background (set to 0 = black in binary)
output[y * width + x] = data[y * width + x] < (mean - C) ? 255 : 0;
```

### 2. Opérations morphologiques trop agressives

**Fichiers**: 
- `src/shared/utils.ts`
- `src/frontend/core/hybrid_layer_animator.ts`

**Code problématique (avant)**:
```typescript
// 3. Morphological operations
const closed = ImageProc.dilate(binary, width, height, 3);
const dilated = ImageProc.dilate(closed, width, height, 3);
```

**Explication du problème**:
- Deux dilatations consécutives avec un kernel de taille 3
- Total: 6 pixels d'expansion autour de chaque stroke
- Résultat: Les strokes "débordent" dans les zones blanches adjacentes, les rendant plus foncées

**Code corrigé**:
```typescript
// 3. Morphological operations to clean up the binary image
// Use closing to fill small holes in strokes without expanding them too much
const closed = ImageProc.closing(binary, width, height, 2);

// Light dilation to connect nearby stroke fragments (reduced from 3 to 2 for less expansion)
const dilated = ImageProc.dilate(closed, width, height, 2);
```

**Améliorations**:
1. Ajout d'une opération de **closing** (dilate puis erode):
   - Comble les petits trous dans les strokes
   - Revient à la taille originale (pas d'expansion nette)
   
2. Réduction du kernel de dilation de 3 à 2:
   - Moins d'expansion dans les zones adjacentes
   - Expansion totale: 2 pixels au lieu de 6

3. Nouvelle fonction `closing` ajoutée dans `image-processing.ts`:
```typescript
/**
 * Morphological Closing (Dilate then Erode)
 * Used to fill small holes in strokes while maintaining stroke width
 */
export function closing(data: Uint8Array, width: number, height: number, size: number = 3): Uint8Array {
    const dilated = dilate(data, width, height, size);
    return erode(dilated, width, height, size);
}
```

## Tests ajoutés

### Fichier: `src/shared/__tests__/stroke-extraction.test.ts`

**Tests pour le seuillage adaptatif**:
1. ✅ Vérification que les pixels foncés sont marqués comme strokes (255)
2. ✅ Vérification que les pixels clairs sont marqués comme fond (0)
3. ✅ Gestion d'une image entièrement blanche (pas de strokes)
4. ✅ Gestion d'une image uniforme (cas edge)
5. ✅ Pattern simple noir sur blanc

**Tests pour les opérations morphologiques**:
6. ✅ Closing remplit les petits trous
7. ✅ Dilate expand les régions claires
8. ✅ Erode réduit les régions claires

**Tests de conversion**:
9. ✅ Grayscale préserve les pixels blancs à 255
10. ✅ Grayscale convertit les pixels noirs à 0

## Résultats

### Tests
- ✅ 9 nouveaux tests ajoutés, tous passent
- ✅ 46 tests frontend existants passent toujours
- ✅ Aucune régression introduite

### Sécurité
- ✅ Scan CodeQL: 0 vulnérabilité
- ✅ Aucun problème de sécurité introduit

### Synchronisation
- ✅ Changements appliqués dans `src/shared` (code partagé)
- ✅ Frontend et server utilisent la même logique
- ✅ Comportement identique sur les deux environnements

## Impact attendu

**Avant les corrections**:
- Zones blanches devenant grises/foncées pendant l'animation
- Strokes débordant sur les zones adjacentes
- Perte de fidélité par rapport à l'image originale

**Après les corrections**:
- Zones blanches restant proprement blanches
- Strokes bien définis et précis
- Meilleure fidélité à l'image originale
- Détection plus professionnelle

## Prochaines étapes recommandées

1. **Test visuel sur le server**: Générer des frames avec le script `test_stroke_fix.ts` pour vérification visuelle
2. **Test avec diverses images**: Tester avec différents types d'illustrations (ligne art, aquarelle, dessin coloré)
3. **Ajustement fin si nécessaire**: Les paramètres suivants peuvent être ajustés si besoin:
   - `blockSize` dans `adaptiveThreshold` (actuellement 15)
   - `C` dans `adaptiveThreshold` (actuellement 2)
   - Kernel size pour `closing` (actuellement 2)
   - Kernel size pour `dilate` (actuellement 2)

## Fichiers modifiés

1. `src/shared/image-processing.ts`
   - Correction de `adaptiveThreshold` (ligne 108)
   - Ajout de la fonction `closing`

2. `src/shared/utils.ts`
   - Mise à jour des opérations morphologiques dans `extractStrokes`

3. `src/frontend/core/hybrid_layer_animator.ts`
   - Synchronisation des opérations morphologiques dans `extractStrokes`

4. `src/shared/__tests__/stroke-extraction.test.ts` (nouveau)
   - Tests complets pour validation

5. `test_stroke_fix.ts` (nouveau)
   - Script de test visuel pour validation sur le server
