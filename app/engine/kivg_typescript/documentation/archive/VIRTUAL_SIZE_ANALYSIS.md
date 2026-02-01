# Virtual Size Support - Analysis & Roadmap

## Executive Summary

The infrastructure for **virtual size support** in hand overlays is **already in place** and working. The issue is not missing functionality but rather **inconsistent coordinate transformations** in some layers, particularly TextSVGLayer.

## Current State ✅

### Working Infrastructure
1. **HandOverlayManager** correctly uses virtualSize for camera→viewport transformations
2. **Scene.applyCameraTransformToSvg()** propagates virtualSize to all layer hand managers
3. **All layers** inherit hand overlay initialization from base Layer class

### Coordinate System Flow
```
Local Layer Space (SVG viewBox, canvas pixels, etc.)
    ↓ transformToGlobal/transformToGlobalAnimated()
Scene/Virtual Space (typically 800x450 or scene dimensions)
    ↓ HandOverlayManager.updateHandPosition()
    ↓ Applies cameraTransform (uses virtualSize)
Viewport Space (actual canvas 1920x1080)
```

## Identified Issues

### TextSVGLayer Specific Problems

#### 1. Bounce Offset Applied in Wrong Coordinate System
**File:** `src/frontend/whiteboard/text-svg-layer.ts`  
**Line:** ~1514

**Current (Incorrect):**
```typescript
const globalPoint = this.transformToGlobal({ x: point.x, y: point.y });
// Bounce added AFTER transform - in global/scene space
currentPoint: { x: smoothed.x, y: smoothed.y + bounceOffset }
```

**Should Be:**
```typescript
// Bounce added BEFORE transform - in local SVG space
const bouncedLocal = { x: point.x, y: point.y + bounceOffset };
const globalPoint = this.transformToGlobal(bouncedLocal);
currentPoint: globalPoint
```

**Impact:** Hand bounce animation appears in wrong scale/direction when camera zoom != 1.0

---

#### 2. Layer Dimensions Not Validated
**File:** `src/frontend/whiteboard/text-svg-layer.ts`  
**Line:** ~367-368

**Current:**
```typescript
const layerWidth = this.config.width || 800;  // Fallback might be wrong scale
const layerHeight = this.config.height || 200;
```

**Should Include:**
```typescript
if (!this.config.width || !this.config.height) {
  if (isDebugEnabled()) {
    console.warn(`[TextSVGLayer] Layer ${this.config.id} missing dimensions, using defaults`);
  }
}
```

**Impact:** Hand position scaling incorrect when layer dimensions not specified

---

#### 3. Silent Error Handling
**Files:** Multiple locations (~891, 944, 963)

**Current:**
```typescript
try {
  const point = path.getPointAtLength(pathLength);
  // ...
} catch (e) {
  // Ignore error
}
```

**Should Be:**
```typescript
try {
  const point = path.getPointAtLength(pathLength);
  // ...
} catch (e) {
  if (isDebugEnabled()) {
    console.warn(`[TextSVGLayer] Error getting point at length:`, e);
  }
}
```

**Impact:** Hard to debug when hand disappears due to invalid path data

---

#### 4. Inconsistent Pattern vs KivgLayer
**TextSVGLayer:** Pre-transforms coordinates before passing to updateHandPosition  
**KivgLayer:** Passes transform callback to updateHandPosition

**Recommendation:** Both patterns work, but should be consistent across codebase for maintainability.

## Required Fixes (Priority Order)

### High Priority
1. ✅ Fix bounce offset coordinate system in TextSVGLayer
2. ✅ Add dimension validation warnings

### Medium Priority
3. ✅ Improve error logging in getPointAtLength() calls
4. ⚠️ Consider aligning pattern with KivgLayer (breaking change)

### Low Priority
5. ⚠️ Audit other layers for similar issues (likely minimal)
6. ⚠️ Add coordinate system documentation

## Testing Plan

### Test Cases
1. **Basic Virtual Size Test**
   - Scene: 1920x1080
   - Virtual: 800x450
   - Verify hand scales correctly

2. **Camera Zoom Test**
   - zoom: 1.5x
   - position: {0.5, 0.5}
   - Verify hand follows drawing precisely

3. **Camera Pan Test**
   - zoom: 1.0
   - position: {0.3, 0.7}
   - Verify hand offset correct

4. **Layer Transform Test**
   - Layer rotation: 45°
   - Layer scale: 2.0
   - Verify hand rotates/scales with layer

### Test Script
Use `test-virtual-size-support.ts` to verify all layers receive correct virtualSize.

## Implementation Estimate

| Task | Time | Status |
|------|------|--------|
| Fix TextSVGLayer bounce offset | 30min | ⏳ Todo |
| Add dimension validation | 15min | ⏳ Todo |
| Improve error handling | 15min | ⏳ Todo |
| Test with various configs | 1h | ⏳ Todo |
| Documentation | 30min | ⏳ Todo |
| **Total** | **2.5h** | |

## Conclusion

**The virtual size infrastructure is solid.** This is a refinement task to fix coordinate transformation edge cases in TextSVGLayer, not a fundamental architecture issue.

**Key Takeaway:** Always transform coordinates to scene space BEFORE passing to `updateHandPosition()`. HandOverlayManager handles the scene→viewport transformation using virtualSize automatically.
