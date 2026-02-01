# Multi-Select Drag Feature

## Overview

This feature allows users to select multiple elements by dragging the mouse to create a selection box. Users can then manipulate all selected elements together.

## Features Implemented

### 1. Drag-to-Select
- **Action**: Click and drag on empty canvas area
- **Result**: A blue dashed rectangle appears showing the selection area
- **Behavior**: All elements within or intersecting the rectangle are selected
- **Visual**: Selection box only appears if dragged more than 3 pixels

### 2. Multi-Selection Support
- **Data Structure**: Uses `Set<string>` for efficient selection management
- **Visual Feedback**: All selected layers show their transformers
- **Compatible**: Works with all layer types (Text, Image, SVG, Shape)

### 3. Ctrl+Click to Add/Remove
- **Action**: Hold Ctrl/Cmd and click on a layer
- **Result**: Toggles that layer in the current selection
- **Use Case**: Fine-tune selection by adding or removing specific elements

### 4. Batch Operations
- **Delete**: Press Delete or Backspace to remove all selected layers
- **Escape**: Deselect all elements
- **Future**: Can extend to support batch move, resize, or property changes

## Technical Implementation

### Files Modified

1. **`src/editor/canvas/scene-canvas.ts`** (+250 lines, -13 lines)
   - Added `selectedLayerIds: Set<string>` for multi-selection tracking
   - Added selection box visualization (Konva.Rect)
   - Added selection layer for rendering selection box
   - Implemented drag-to-select logic
   - Added helper methods for multi-selection

### Key Components

#### Selection State
```typescript
// Multiple selection tracking
private selectedLayerIds: Set<string> = new Set();

// Selection box visualization
private selectionBox: Konva.Rect | null = null;
private selectionLayer: Konva.Layer | null = null;
private isSelecting: boolean = false;
private selectionStart: Position | null = null;
```

#### Selection Box Creation
```typescript
private initSelectionBox(): void {
    this.selectionBox = new Konva.Rect({
        fill: 'rgba(0, 123, 255, 0.1)',
        stroke: '#007bff',
        strokeWidth: 2,
        dash: [5, 5],
        visible: false,
    });
    
    if (this.selectionLayer) {
        this.selectionLayer.add(this.selectionBox);
    }
}
```

#### Drag Selection Logic
The implementation follows this flow:

1. **Mouse Down on Stage**: 
   - Start selection mode
   - Store starting position
   - Clear selection (unless Ctrl is pressed)

2. **Mouse Move**:
   - Update selection box dimensions
   - Show box if dragged > 3px

3. **Mouse Up**:
   - Convert selection box to scene coordinates
   - Find all layers intersecting with box
   - Select or add to selection (based on Ctrl key)
   - Hide selection box

#### Intersection Detection
```typescript
// Check if layer intersects with selection box
const nodeBox = node.getClientRect();
const nodeX1 = (nodeBox.x - layerPos.x) / scale;
const nodeY1 = (nodeBox.y - layerPos.y) / scale;
const nodeX2 = nodeX1 + nodeBox.width / scale;
const nodeY2 = nodeY1 + nodeBox.height / scale;

// AABB intersection test
if (!(nodeX2 < sceneX1 || nodeX1 > sceneX2 || 
      nodeY2 < sceneY1 || nodeY1 > sceneY2)) {
    selectedIds.push(id);
}
```

### New Methods

#### `selectLayers(layerIds: string[])`
Select multiple layers at once.
```typescript
public selectLayers(layerIds: string[]): void
```

#### `addToSelection(layerId: string)`
Add a single layer to the current selection.
```typescript
public addToSelection(layerId: string): void
```

#### `removeFromSelection(layerId: string)`
Remove a layer from the current selection.
```typescript
public removeFromSelection(layerId: string): void
```

#### `getSelectedLayerIds()`
Get array of all selected layer IDs.
```typescript
public getSelectedLayerIds(): string[]
```

#### `handleLayerSelection(layerId: string, event?: any)`
Internal helper for handling click selection with Ctrl support.
```typescript
private handleLayerSelection(layerId: string, event?: any): void
```

## User Interaction Flow

### Scenario 1: Drag to Select Multiple Elements
```
User clicks on empty canvas
    ↓
Drag mouse (creates selection box)
    ↓
Mouse move updates box size/position
    ↓
Release mouse
    ↓
Calculate which layers intersect
    ↓
Select all intersecting layers
    ↓
Show transformers on all selected layers
```

### Scenario 2: Add Element to Selection with Ctrl+Click
```
User has 3 elements selected
    ↓
User holds Ctrl and clicks on another element
    ↓
Element is added to selection (now 4 selected)
    ↓
User holds Ctrl and clicks on selected element
    ↓
Element is removed from selection (now 3 selected)
```

### Scenario 3: Delete Multiple Selected Elements
```
User has 5 elements selected
    ↓
User presses Delete key
    ↓
All 5 elements are removed from canvas
    ↓
Selection is cleared
```

## Configuration

### Selection Box Styling
The selection box can be customized in `initSelectionBox()`:

```typescript
this.selectionBox = new Konva.Rect({
    fill: 'rgba(0, 123, 255, 0.1)',    // Light blue fill
    stroke: '#007bff',                  // Blue border
    strokeWidth: 2,                     // Border width
    dash: [5, 5],                       // Dashed line pattern
    visible: false,                     // Initially hidden
});
```

### Minimum Drag Distance
Selection box only appears if dragged more than 3 pixels:
```typescript
const dragDistance = Math.sqrt(
    Math.pow(pointer.x - this.selectionStart.x, 2) + 
    Math.pow(pointer.y - this.selectionStart.y, 2)
);

if (dragDistance > 3) {
    // Perform selection
}
```

## Testing

### Manual Testing Steps
1. ✅ Drag on empty canvas creates selection box
2. ✅ Selection box is blue with dashed border
3. ✅ Elements within box are selected
4. ✅ Transformers appear on all selected elements
5. ✅ Ctrl+Click adds element to selection
6. ✅ Ctrl+Click on selected element removes it
7. ✅ Delete key removes all selected elements
8. ✅ Escape deselects all elements
9. ✅ Space key panning still works (doesn't trigger selection)
10. ✅ Small drags (<3px) don't trigger selection

### Test Pages
- `test_multi_select.html` - Focused test for multi-selection
- `camera-editor-demo.html` - Full editor with multi-selection

## Browser Compatibility
- Chrome/Edge: ✅ Tested
- Firefox: ✅ Should work (standard DOM/Konva APIs)
- Safari: ✅ Should work (standard DOM/Konva APIs)

## Known Limitations

1. **No Multi-Layer Transform**: Currently, transforming (scaling/rotating) works per-layer. To transform all selected layers together would require a group transformer.

2. **No Drag Move for Multiple**: Selected layers can be moved individually but not as a group. This could be added in the future.

3. **Backward Compatibility**: The original `selectedLayerId` property is maintained for backward compatibility and is set to the first selected layer.

## Future Enhancements

Possible improvements:
- Group drag: Move all selected layers together
- Group transform: Scale/rotate all selected layers as a unit
- Align operations: Align selected layers (left, center, right, top, middle, bottom)
- Distribute operations: Evenly space selected layers
- Group layer properties: Change color/opacity of all selected layers
- Selection inversion: Select all except currently selected
- Select by type: Select all text layers, all shapes, etc.

## Dependencies

- Konva.js (for canvas rendering and shapes)
- No additional dependencies

## Notes

- The implementation is designed to be non-intrusive and backward compatible
- Existing single-selection functionality continues to work
- The selection box is rendered on a separate layer above content but below UI
- Coordinate transformations account for zoom and pan state
- Selection state is properly cleaned up when layers are deleted
