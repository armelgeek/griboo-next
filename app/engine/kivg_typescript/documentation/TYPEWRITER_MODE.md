# Typewriter & Stroke Modes

The Kivg Engine provides two professional modes for animating text using the `TextToSVGLayer`.

## 1. Typewriter Mode ⌨️
This mode simulates characters being typed one by one.

### How it works:
- Characters appear instantly at a specific interval.
- Each character is fully filled immediately.
- Ideal for modern, clean UI animations or simulating a computer terminal.

### Configuration:
```typescript
{
    type: 'text_svg',
    textConfig: {
        text: 'Typewriter effect...',
        strokeAnimation: {
            mode: 'typewriter',
            duration: 2.5,   // Total time for all characters
            charDelay: 0.1   // Pause between each character
        }
    }
}
```

## 2. Stroke Mode ✍️
This mode simulates the text being handwritten or drawn with a pen.

### How it works:
- Each character's outlines are drawn stroke by stroke.
- Once a character's stroke is complete, it can optionally "fill in".
- Provides the classic "whiteboard animation" feel.

### Configuration:
```typescript
{
    type: 'text_svg',
    textConfig: {
        text: 'Handwritten look',
        strokeAnimation: {
            mode: 'draw',
            duration: 3.0,
            strokeWidth: 2,
            fillMode: 'end'  // Fill characters after they are drawn
        }
    }
}
```

## Comparison

| Feature | Typewriter Mode | Stroke Mode |
|---------|-----------------|-------------|
| **Visual Style** | Digital / Modern | Organic / Handwritten |
| **Complexity** | Low (Instant reveal) | High (Stroke processing) |
| **Best For** | Captions, UI | Storytelling, Titles |
| **Performance** | Excellent | Heavy (Vector based) |

## Multi-Language Support
Both modes fully support:
- **LTR** (Left-to-Right): English, French, etc.
- **RTL** (Right-to-Left): Arabic, Hebrew.
- **TTB** (Top-to-Bottom): Chinese, Japanese, Korean (with compatible fonts).
