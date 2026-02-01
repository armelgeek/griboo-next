# Occlusion Culling Fix - Visual Explanation

## The Problem (Before Fix)

```
BEFORE FIX - Both rectangles expanded before intersection:

Lower Rectangle (Blue)          Upper Rectangle (Red)
with 5% margin                  with 5% margin
┌─────────────────────────┐    
│  ╔═══════════════════╗  │    ┌─────────────────────┐
│  ║                   ║  │    │  ╔═══════════════╗  │
│  ║   Blue Layer      ║  │    │  ║               ║  │
│  ║   (Actual)        ║  │    │  ║  Red Layer    ║  │
│  ║                   ║  │    │  ║  (Actual)     ║  │
│  ║              ┌────╫──┼────┼──╫─────────┐     ║  │
│  ║              │ ❌ ║  │    │  ║         │     ║  │
│  ║              │HUGE║  │    │  ║  ERASE  │     ║  │
│  ╚══════════════│ERASE══╝  │    │  ╚═══════│ZONE════╝  │
│                 │ ZONE  │    │            │         │
└─────────────────┼───────┘    └────────────┼─────────┘
                  │                          │
                  └──────────────────────────┘
                    Union of expanded rects
                    = TOO LARGE! ❌

Result: Erases 73,312 sq pixels - includes area beyond red rectangle
```

## The Solution (After Fix)

```
AFTER FIX - Only upper rectangle expanded:

Lower Rectangle (Blue)          Upper Rectangle (Red)
NO margin expansion             with 5% margin
╔═══════════════════╗           
║                   ║           ┌─────────────────────┐
║   Blue Layer      ║           │  ╔═══════════════╗  │
║   (Actual bounds) ║           │  ║               ║  │
║                   ║           │  ║  Red Layer    ║  │
║           ┌───────╫───────────┼──╫─────────┐     ║  │
║           │  ✅   ║           │  ║         │     ║  │
║           │CORRECT║           │  ║  ERASE  │     ║  │
╚═══════════│═ERASE═╝           │  ╚═══════│═ZONE════╝  │
            │ ZONE               │           │         │
            └────────────────────┴───────────┼─────────┘
                                             │
              Constrained to red's footprint │
              = CORRECT SIZE! ✅              │
                                             
Result: Erases 64,210 sq pixels - only area under red rectangle
```

## Key Difference

### Before Fix
```typescript
// WRONG: Expand BOTH rectangles
const aLeft = aBaseLeft - aMarginX;    // Upper expanded ❌
const bLeft = bBaseLeft - bMarginX;    // Lower expanded ❌

const iLeft = Math.max(aLeft, bLeft);  // Union is too large
```

**Problem**: The intersection includes area from both expanded rectangles, 
creating a larger erase zone than the upper element actually covers.

### After Fix
```typescript
// CORRECT: Expand only UPPER rectangle
const aLeft = aBaseLeft - aMarginX;    // Upper expanded ✅

const iLeft = Math.max(aLeft, bBaseLeft);  // Lower NOT expanded ✅
```

**Solution**: The intersection is constrained by the actual lower bounds,
so the erase zone only covers where the upper element truly overlaps.

## Real-World Impact

### Example from Issue
- **Upper Element**: Red rectangle at (550, 380), size 350×250
- **Lower Element**: Blue rectangle at (400, 300), size 400×300

**Before Fix**:
- Both rectangles expanded by 5%
- Erase zone: 291.5 × 251.5 pixels = **73,312 sq pixels**
- Erases area extending beyond red rectangle ❌

**After Fix**:
- Only red rectangle expanded by 5%
- Erase zone: 271.5 × 236.5 pixels = **64,210 sq pixels**
- Erase zone constrained to red rectangle's footprint ✅

**Improvement**: **12.4% reduction** in erased area

## Why This Matters

### Visual Quality
- **Before**: Visible "halo" of erased space around overlapping elements
- **After**: Clean occlusion that matches the upper element's actual shape

### Performance
- **Before**: Unnecessary erasing of extra pixels
- **After**: Minimal erasing, only where needed

### Correctness
- **Before**: Erase zone doesn't match visual appearance
- **After**: Erase zone precisely matches what the user sees

## Architecture

```
┌──────────────────────────────────────────────┐
│  Shared Logic (Single Source of Truth)      │
│  src/shared/occlusion_logic.ts               │
│  ├─ getIntersectionRect() ← FIXED HERE      │
│  ├─ getUnionIntersectionRect()               │
│  ├─ ensureMinimumEraseZone()                 │
│  └─ generateZigzagPath()                     │
└──────────────────┬───────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
    ┌─────▼─────┐    ┌─────▼──────┐
    │ Frontend  │    │  Server    │
    │ Uses ✅   │    │  Uses ✅   │
    │ OcclusionLogic │ OcclusionLogic │
    └───────────┘    └────────────┘

Both frontend and server automatically
benefit from the fix in shared logic!
```

## Summary

✅ **One change** in `src/shared/occlusion_logic.ts`
✅ **Two systems fixed** (frontend + server)
✅ **12.4% reduction** in erased area
✅ **Correct behavior** restored
