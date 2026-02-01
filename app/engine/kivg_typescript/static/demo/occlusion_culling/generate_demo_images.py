#!/usr/bin/env python3
"""
Script to generate demo images for occlusion culling demonstration.

This creates two overlapping shapes to demonstrate the intelligent
layer superposition (2D Occlusion Culling) feature.
"""

import numpy as np
import cv2
import os

# Output directory
DEMO_DIR = os.path.dirname(os.path.abspath(__file__))

def create_circle_layer(width=800, height=600, center=(250, 300), radius=150, color=(0, 0, 255)):
    """Create a layer with a colored circle."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    cv2.circle(img, center, radius, color, -1, cv2.LINE_AA)
    # Add a border
    cv2.circle(img, center, radius, (0, 0, 0), 3, cv2.LINE_AA)
    return img

def create_rectangle_layer(width=800, height=600, rect=(350, 200, 300, 200), color=(255, 0, 0)):
    """Create a layer with a colored rectangle."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    x, y, w, h = rect
    cv2.rectangle(img, (x, y), (x+w, y+h), color, -1, cv2.LINE_AA)
    # Add a border
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 0), 3, cv2.LINE_AA)
    return img

def create_star_layer(width=800, height=600, center=(400, 300), size=100, color=(0, 255, 0)):
    """Create a layer with a colored star."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Create star points
    import math
    points = []
    for i in range(5):
        # Outer points
        angle = math.radians(-90 + i * 72)
        x = center[0] + int(size * math.cos(angle))
        y = center[1] + int(size * math.sin(angle))
        points.append([x, y])
        
        # Inner points
        angle = math.radians(-90 + i * 72 + 36)
        x = center[0] + int(size * 0.4 * math.cos(angle))
        y = center[1] + int(size * 0.4 * math.sin(angle))
        points.append([x, y])
    
    pts = np.array(points, np.int32)
    pts = pts.reshape((-1, 1, 2))
    cv2.fillPoly(img, [pts], color, cv2.LINE_AA)
    cv2.polylines(img, [pts], True, (0, 0, 0), 2, cv2.LINE_AA)
    
    return img

def main():
    print("🎨 Generating demo images for occlusion culling...")
    
    # Create layer 1: Red circle (bottom layer, z_index=0)
    layer1 = create_circle_layer(
        width=800, height=600,
        center=(250, 300),
        radius=150,
        color=(0, 0, 255)  # Red in BGR
    )
    
    # Create layer 2: Blue rectangle (overlaps circle, z_index=1)
    layer2 = create_rectangle_layer(
        width=800, height=600,
        rect=(300, 200, 250, 200),
        color=(255, 0, 0)  # Blue in BGR
    )
    
    # Create layer 3: Green star (overlaps rectangle, z_index=2)
    layer3 = create_star_layer(
        width=800, height=600,
        center=(450, 350),
        size=120,
        color=(0, 255, 0)  # Green in BGR
    )
    
    # Save layers
    cv2.imwrite(os.path.join(DEMO_DIR, 'layer_circle_red.png'), layer1)
    cv2.imwrite(os.path.join(DEMO_DIR, 'layer_rectangle_blue.png'), layer2)
    cv2.imwrite(os.path.join(DEMO_DIR, 'layer_star_green.png'), layer3)
    
    print(f"  ✅ Created layer_circle_red.png (z_index=0)")
    print(f"  ✅ Created layer_rectangle_blue.png (z_index=1)")
    print(f"  ✅ Created layer_star_green.png (z_index=2)")
    
    # Create a combined preview showing the overlap
    combined = np.ones((600, 800, 3), dtype=np.uint8) * 255
    
    # Draw in z-order
    mask1 = np.any(layer1 != [255, 255, 255], axis=2)
    combined[mask1] = layer1[mask1]
    
    mask2 = np.any(layer2 != [255, 255, 255], axis=2)
    combined[mask2] = layer2[mask2]
    
    mask3 = np.any(layer3 != [255, 255, 255], axis=2)
    combined[mask3] = layer3[mask3]
    
    cv2.imwrite(os.path.join(DEMO_DIR, 'combined_preview.png'), combined)
    print(f"  ✅ Created combined_preview.png (expected result)")
    
    print("\n📄 Demo images created in:", DEMO_DIR)
    print("\n📌 To test occlusion culling, run:")
    print(f"   python griboo-engine.py --config demo/occlusion_culling/demo_occlusion.json --occlusion-culling")

if __name__ == "__main__":
    main()
