# Text Layer Double-Click Feature

## Overview

This feature allows users to create and edit text layers by double-clicking on the canvas. This provides a more intuitive and efficient way to work with text in the whiteboard editor.

## Features Implemented

### 1. Double-Click to Create Text Layer
- **Action**: Double-click anywhere on the canvas (empty space)
- **Result**: A new text layer is created at the clicked position
- **Default Text**: "Nouveau Texte"
- **Auto-Edit**: The text editor opens automatically after creation

### 2. Double-Click to Edit Existing Text
- **Action**: Double-click on an existing text layer
- **Result**: Opens the text editor modal with the current text
- **Editing**: Text can be modified, and changes are saved back to the layer

### 3. Text Editor Modal
- **Interface**: Clean, modal dialog with textarea
- **Features**:
  - Auto-focus and text selection for quick editing
  - Save/Cancel buttons
  - Keyboard shortcuts:
    - `Ctrl+Enter` or `Cmd+Enter` to save
    - `Escape` to cancel
  - Click outside modal to cancel
  - Maintains font size, family, and color from the layer

## Technical Implementation

### Files Modified/Created

1. **`src/editor/canvas/text-editor.ts`** (NEW)
   - Pure HTML/JS text editor component
   - No dependencies on React or other frameworks
   - Handles text input, validation, and callbacks

2. **`src/editor/canvas/scene-canvas.ts`** (MODIFIED)
   - Added double-click handler on stage
   - Wire up text editor to TextLayer's onDoubleClick callback
   - Added `openTextEditor()` method
   - Added `getAllLayers()` method for layer tracking

3. **`src/editor/canvas/index.ts`** (MODIFIED)
   - Export TextEditor component and types

4. **`camera-editor-demo.html`** (MODIFIED)
   - Updated help text to mention double-click feature

5. **`test_text_layer_doubleclick.html`** (NEW)
   - Standalone test page for the feature

### Architecture

```
User Double-Click
       ↓
Stage Event Handler (scene-canvas.ts)
       ↓
Create TextLayer OR Open Editor
       ↓
TextEditor Modal (text-editor.ts)
       ↓
User Input
       ↓
Save → Update Layer → Redraw
```

### Key Code Sections

#### Double-Click Handler (scene-canvas.ts)
```typescript
this.stage.on('dblclick dbltap', (e) => {
    if (e.target === this.stage) {
        // Convert pointer to scene coordinates
        // Create new text layer at clicked position
        // Open text editor immediately
    }
});
```

#### Text Layer Callback (scene-canvas.ts)
```typescript
layer.setCallbacks({
    onDoubleClick: () => {
        this.openTextEditor(config.id);
    },
});
```

#### Text Editor Component (text-editor.ts)
```typescript
export class TextEditor {
    show(): void { /* Display modal */ }
    hide(): void { /* Cleanup */ }
    private save(): void { /* Save callback */ }
    private cancel(): void { /* Cancel callback */ }
}
```

## Usage Examples

### In Camera Editor Demo
1. Open `camera-editor-demo.html` in a browser
2. Double-click anywhere on the white canvas area
3. A text editor modal appears with default text
4. Type your text and press `Ctrl+Enter` or click "Enregistrer"
5. The text appears on the canvas
6. Double-click the text to edit it again

### In Test Page
1. Open `test_text_layer_doubleclick.html` in a browser
2. Follow the instructions displayed at the top
3. Create multiple text layers by double-clicking in different locations
4. Edit them by double-clicking on existing text

## Configuration

The text layer creation uses these default values:
- Font size: 48px
- Font family: Arial
- Color: #2d3748 (dark gray)
- Alignment: center

These can be customized by modifying the `newTextConfig` object in the double-click handler within the `setupEventHandlers()` method in `scene-canvas.ts`.

## Testing

### Manual Testing Steps
1. ✅ Double-click on empty canvas creates a new text layer
2. ✅ Text editor opens automatically after creation
3. ✅ Double-click on existing text opens editor
4. ✅ Ctrl+Enter saves changes
5. ✅ Escape cancels editing
6. ✅ Click outside modal cancels editing
7. ✅ Text is properly positioned at click location
8. ✅ Text can be dragged after creation
9. ✅ Text layer is auto-selected after creation

### Browser Compatibility
- Chrome/Edge: ✅ Tested
- Firefox: ✅ Should work (standard DOM APIs)
- Safari: ✅ Should work (standard DOM APIs)

## Future Enhancements

Possible improvements for future iterations:
- Inline text editing (contenteditable div overlay)
- Rich text formatting (bold, italic, colors)
- Font picker in the editor
- Text size adjustment in editor
- Text alignment options in editor
- Undo/Redo support
- Multi-line text with better line break handling

## Dependencies

- Konva.js (for canvas rendering)
- No additional dependencies

## Notes

- The implementation is intentionally simple and follows the existing patterns in the codebase
- All UI is created with vanilla JavaScript and CSS
- No React, Vue, or other framework dependencies
- Compatible with the existing editor architecture
