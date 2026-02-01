#!/usr/bin/env python3
"""
Comprehensive Demo for kivg Eraser and Rubber Effects.

This demo showcases all eraser functionalities:
1. Layer Eraser - Progressive erasing of individual layers
2. Scene Eraser - Erasing entire scenes with multiple layers
3. Rubber Tool - Direct pixel manipulation for doodle-style erasing

Usage:
    python demo/demo_eraser_rubber_comprehensive.py

Output:
    - Screenshots in demo/output/
    - Videos demonstrating each effect
"""

import glob
import os
import sys
import numpy as np
import cv2

# Add project paths
project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_dir)
sys.path.insert(0, os.path.join(project_dir, 'plugins'))

from kivg.core.eraser import (
    EraserStyle,
    EraserDirection,
    LayerEraser,
    SceneEraser,
    Rubber,
    apply_eraser,
    generate_eraser_frames_diagonal,
    generate_slide_eraser_config,
    apply_slide_eraser,
    generate_delay_frames
)


# Output directory
OUTPUT_DIR = os.path.join(project_dir, 'demo', 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def create_layer_content(width=400, height=300, layer_num=1):
    """Create a sample layer with drawable content."""
    # White background
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    if layer_num == 1:
        # Layer 1: Simple shapes
        cv2.rectangle(img, (50, 50), (150, 120), (0, 100, 200), -1)  # Blue rectangle
        cv2.circle(img, (250, 100), 40, (0, 150, 0), -1)  # Green circle
        cv2.putText(img, "Layer 1", (130, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    elif layer_num == 2:
        # Layer 2: Lines and text
        cv2.line(img, (50, 100), (350, 100), (255, 0, 0), 3)
        cv2.line(img, (50, 150), (350, 150), (0, 0, 255), 3)
        cv2.putText(img, "Layer 2", (130, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    elif layer_num == 3:
        # Layer 3: Complex shape
        pts = np.array([[200, 50], [150, 150], [250, 150]], dtype=np.int32)
        cv2.fillPoly(img, [pts], (200, 100, 50))
        cv2.putText(img, "Layer 3", (130, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    
    return img


def create_scene_image(width=640, height=480):
    """Create a demo scene with multiple elements (simulating multiple layers)."""
    img = np.full((height, width, 3), [240, 240, 240], dtype=np.uint8)  # Light gray background
    
    # Title
    cv2.putText(img, "SCENE ERASER DEMO", (width // 2 - 160, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 100), 3)
    
    # Draw multiple elements (simulating layers)
    # Element 1: Rectangle
    cv2.rectangle(img, (50, 100), (200, 200), (255, 100, 50), -1)
    
    # Element 2: Circle
    cv2.circle(img, (350, 150), 60, (50, 150, 50), -1)
    
    # Element 3: Triangle
    pts = np.array([[550, 200], [480, 100], [620, 100]], dtype=np.int32)
    cv2.fillPoly(img, [pts], (50, 100, 255))
    
    # Element 4: Lines
    cv2.line(img, (50, 300), (590, 300), (0, 0, 0), 4)
    cv2.line(img, (100, 350), (540, 350), (100, 100, 100), 3)
    
    # Element 5: Text
    cv2.putText(img, "Content to be erased", (width // 2 - 150, 420), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    
    return img


def demo_layer_eraser():
    """
    Demo 1: Layer Eraser
    
    Demonstrates progressive erasing of a single layer using 
    whiteboard-style wiping motion.
    """
    print("\n" + "=" * 70)
    print("🧹 DEMO 1: LAYER ERASER")
    print("    Progressive erasing with whiteboard-style wiping")
    print("=" * 70)
    
    # Create layer content
    layer_img = create_layer_content(400, 300, layer_num=1)
    
    # Save original
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'layer_eraser_01_original.png'), layer_img)
    print("  ✅ Saved: layer_eraser_01_original.png")
    
    # Create a simulated draw sequence (the path the hand took while drawing)
    # This is used when use_whiteboard_wipe=False
    draw_sequence = []
    # Rectangle path
    for x in range(50, 151, 5):
        draw_sequence.append((x, 50))
    for y in range(50, 121, 5):
        draw_sequence.append((150, y))
    for x in range(150, 49, -5):
        draw_sequence.append((x, 120))
    for y in range(120, 49, -5):
        draw_sequence.append((50, y))
    
    # Circle path (approximate)
    for angle in range(0, 360, 10):
        x = int(250 + 40 * np.cos(np.radians(angle)))
        y = int(100 + 40 * np.sin(np.radians(angle)))
        draw_sequence.append((x, y))
    
    # Create different eraser styles - all using whiteboard wipe for natural effect
    styles = [
        ('progressive', EraserStyle.PROGRESSIVE, EraserDirection.NORMAL),
        ('reversed', EraserStyle.PROGRESSIVE, EraserDirection.REVERSED),
        ('fast', EraserStyle.FAST, EraserDirection.NORMAL),
    ]
    
    for style_name, style, direction in styles:
        print(f"\n  📌 Style: {style_name}")
        
        eraser = LayerEraser(
            style=style,
            direction=direction,
            background_color=(255, 255, 255)
        )
        
        # Generate erase frames with whiteboard-style wiping
        # This ensures the entire layer is erased with natural wiping motion
        frames = eraser.generate_erase_frames(
            layer_img.copy(),
            draw_sequence,
            num_frames=30,
            erase_radius=8,
            show_eraser=True,  # Show eraser hand
            use_whiteboard_wipe=True  # Use natural wiping motion
        )
        
        # Save first, middle, and last frames
        if len(frames) >= 3:
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'layer_eraser_02_{style_name}_start.png'),
                frames[0]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'layer_eraser_03_{style_name}_middle.png'),
                frames[len(frames) // 2]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'layer_eraser_04_{style_name}_end.png'),
                frames[-1]
            )
            print(f"     ✅ Saved {style_name} frames")
        
        # Create video
        video_path = os.path.join(OUTPUT_DIR, f'layer_eraser_{style_name}.mp4')
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(video_path, fourcc, 30, (400, 300))
        
        for frame in frames:
            video_writer.write(frame)
        
        video_writer.release()
        print(f"     ✅ Created video: layer_eraser_{style_name}.mp4")
    
    print("\n  ✅ Layer Eraser demo complete!")


def demo_scene_eraser():
    """
    Demo 2: Scene Eraser
    
    Demonstrates erasing an entire scene with multiple layers/elements.
    """
    print("\n" + "=" * 70)
    print("🎬 DEMO 2: SCENE ERASER")
    print("    Erasing entire scenes with multiple layers")
    print("=" * 70)
    
    # Create scene image
    scene_img = create_scene_image(640, 480)
    
    # Save original
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'scene_eraser_01_original.png'), scene_img)
    print("  ✅ Saved: scene_eraser_01_original.png")
    
    # Simulate multiple layers with their draw sequences
    layer_data = [
        {
            'id': 'rectangle',
            'draw_sequence': [(x, y) for x in range(50, 201, 10) for y in range(100, 201, 10)]
        },
        {
            'id': 'circle',
            'draw_sequence': [
                (int(350 + 60 * np.cos(np.radians(a))), int(150 + 60 * np.sin(np.radians(a))))
                for a in range(0, 360, 15)
            ]
        },
        {
            'id': 'triangle',
            'draw_sequence': [(550, 200), (480, 100), (620, 100), (550, 200)]
        }
    ]
    
    # Test different layer orders
    orders = ['sequential', 'reversed', 'simultaneous']
    
    for order in orders:
        print(f"\n  📌 Layer order: {order}")
        
        scene_eraser = SceneEraser(
            style=EraserStyle.PROGRESSIVE,
            direction=EraserDirection.NORMAL,
            layer_order=order,
            background_color=(255, 255, 255)
        )
        
        # Generate scene erase frames
        frames = scene_eraser.generate_scene_erase_frames(
            scene_img.copy(),
            layer_data,
            num_frames=60,
            show_eraser=False
        )
        
        # Save sample frames
        if len(frames) >= 3:
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'scene_eraser_02_{order}_start.png'),
                frames[0]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'scene_eraser_03_{order}_middle.png'),
                frames[len(frames) // 2]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'scene_eraser_04_{order}_end.png'),
                frames[-1]
            )
            print(f"     ✅ Saved {order} frames")
        
        # Create video
        video_path = os.path.join(OUTPUT_DIR, f'scene_eraser_{order}.mp4')
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(video_path, fourcc, 30, (640, 480))
        
        for frame in frames:
            video_writer.write(frame)
        
        video_writer.release()
        print(f"     ✅ Created video: scene_eraser_{order}.mp4")
    
    print("\n  ✅ Scene Eraser demo complete!")


def demo_rubber_tool():
    """
    Demo 3: Rubber (Eraser) Tool
    
    Demonstrates direct pixel manipulation for erasing doodles.
    """
    print("\n" + "=" * 70)
    print("✏️ DEMO 3: RUBBER TOOL")
    print("    Direct pixel manipulation for doodle-style erasing")
    print("=" * 70)
    
    # Create a doodle image
    width, height = 500, 350
    img = np.ones((height, width, 3), dtype=np.uint8) * 255  # White background
    
    # Draw doodles
    cv2.putText(img, "Rubber Tool Demo", (width // 2 - 130, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    
    # Draw shapes to erase
    cv2.circle(img, (100, 150), 50, (255, 0, 0), -1)  # Red circle
    cv2.rectangle(img, (200, 100), (300, 200), (0, 255, 0), -1)  # Green rect
    cv2.circle(img, (400, 150), 50, (0, 0, 255), -1)  # Blue circle
    
    # Draw lines
    cv2.line(img, (50, 280), (450, 280), (0, 0, 0), 4)
    cv2.line(img, (100, 310), (400, 310), (100, 100, 100), 3)
    
    # Save original
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_01_original.png'), img)
    print("  ✅ Saved: rubber_tool_01_original.png")
    
    # Demo 3a: Single point erasing
    print("\n  📌 Single point erasing")
    rubber = Rubber(radius=30, shape='circle', background_color=(255, 255, 255))
    
    erased = rubber.apply_eraser(img.copy(), center_x=100, center_y=150)
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_02_single_erase.png'), erased)
    print("     ✅ Saved: rubber_tool_02_single_erase.png")
    
    # Demo 3b: Path erasing
    print("\n  📌 Path erasing (horizontal wipe)")
    path = [(x, 150) for x in range(80, 420, 15)]
    erased_path = rubber.erase_along_path(img.copy(), path)
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_03_path_erase.png'), erased_path)
    print("     ✅ Saved: rubber_tool_03_path_erase.png")
    
    # Demo 3c: Different shapes (circle vs square)
    print("\n  📌 Eraser shapes comparison (circle vs square)")
    comparison = np.zeros((300, 500, 3), dtype=np.uint8)
    cv2.putText(comparison, "Circle Eraser", (70, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(comparison, "Square Eraser", (320, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    
    circle_rubber = Rubber(radius=60, shape='circle', background_color=(255, 255, 255))
    comparison = circle_rubber.apply_eraser(comparison, center_x=125, center_y=150)
    
    square_rubber = Rubber(radius=60, shape='square', background_color=(255, 255, 255))
    comparison = square_rubber.apply_eraser(comparison, center_x=375, center_y=150)
    
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_04_shapes.png'), comparison)
    print("     ✅ Saved: rubber_tool_04_shapes.png")
    
    # Demo 3d: Soft edge erasing
    print("\n  📌 Soft edge erasing")
    soft_comparison = np.zeros((200, 500, 3), dtype=np.uint8) + 50  # Dark gray
    
    cv2.putText(soft_comparison, "Hard Edge", (50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(soft_comparison, "Soft Edge", (300, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    hard_rubber = Rubber(radius=50, softness=0.0, background_color=(255, 255, 255))
    soft_comparison = hard_rubber.apply_eraser(soft_comparison, center_x=100, center_y=100)
    
    soft_rubber = Rubber(radius=50, softness=0.7, background_color=(255, 255, 255))
    soft_comparison = soft_rubber.apply_eraser(soft_comparison, center_x=350, center_y=100)
    
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_05_soft_edge.png'), soft_comparison)
    print("     ✅ Saved: rubber_tool_05_soft_edge.png")
    
    # Demo 3e: Animation (full erase animation)
    print("\n  📌 Full erase animation")
    rubber_anim = Rubber(radius=25, background_color=(255, 255, 255))
    frames, positions = rubber_anim.generate_erase_animation(
        img.copy(),
        num_frames=45,
        pattern='diagonal'
    )
    
    # Save key frames
    if len(frames) > 0:
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_06_anim_start.png'), frames[0])
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_07_anim_mid.png'), frames[len(frames) // 2])
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'rubber_tool_08_anim_end.png'), frames[-1])
        
        # Create video
        video_path = os.path.join(OUTPUT_DIR, 'rubber_tool_animation.mp4')
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(video_path, fourcc, 30, (width, height))
        
        for frame in frames:
            video_writer.write(frame)
        
        video_writer.release()
        print("     ✅ Created video: rubber_tool_animation.mp4")
    
    print("\n  ✅ Rubber Tool demo complete!")


def demo_diagonal_patterns():
    """
    Demo 4: Diagonal Pattern Erasing
    
    Demonstrates the diagonal, horizontal, and vertical erasing patterns.
    """
    print("\n" + "=" * 70)
    print("🔲 DEMO 4: DIAGONAL PATTERN ERASING")
    print("    Different erasing patterns for scene transitions")
    print("=" * 70)
    
    # Create a colorful test image
    width, height = 400, 300
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Create gradient
    for y in range(height):
        for x in range(width):
            img[y, x] = [
                int(255 * x / width),          # Blue gradient
                int(128 + 127 * np.sin(x / 30)),  # Green sine wave
                int(255 * y / height)           # Red gradient
            ]
    
    # Add text
    cv2.putText(img, "Pattern Test", (width // 2 - 80, height // 2), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Save original
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'pattern_01_original.png'), img)
    print("  ✅ Saved: pattern_01_original.png")
    
    # Test each pattern
    patterns = ['diagonal', 'horizontal', 'vertical']
    
    for pattern in patterns:
        print(f"\n  📌 Pattern: {pattern}")
        
        frames, positions = generate_eraser_frames_diagonal(
            source_image=img.copy(),
            num_frames=30,
            pattern=pattern,
            background_color=(255, 255, 255),
            radius=20
        )
        
        # Save frames
        if len(frames) >= 3:
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'pattern_02_{pattern}_start.png'),
                frames[0]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'pattern_03_{pattern}_middle.png'),
                frames[len(frames) // 2]
            )
            cv2.imwrite(
                os.path.join(OUTPUT_DIR, f'pattern_04_{pattern}_end.png'),
                frames[-1]
            )
            print(f"     ✅ Saved {pattern} frames")
        
        # Create video
        video_path = os.path.join(OUTPUT_DIR, f'pattern_{pattern}.mp4')
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(video_path, fourcc, 30, (width, height))
        
        for frame in frames:
            video_writer.write(frame)
        
        video_writer.release()
        print(f"     ✅ Created video: pattern_{pattern}.mp4")
    
    print("\n  ✅ Diagonal Pattern demo complete!")


def demo_slide_eraser():
    """
    Demo 5: Slide Eraser (End of Slide Transition)
    
    Demonstrates the slide eraser effect used at the end of slides
    with an erasing hand overlay.
    """
    print("\n" + "=" * 70)
    print("📽️ DEMO 5: SLIDE ERASER")
    print("    End-of-slide transition with delay, erase, and hand overlay")
    print("=" * 70)
    
    # Create a slide-like image
    width, height = 640, 480
    slide = np.ones((height, width, 3), dtype=np.uint8) * 250  # Light background
    
    # Add slide content
    cv2.rectangle(slide, (0, 0), (width, 60), (50, 80, 120), -1)  # Header
    cv2.putText(slide, "Slide Title", (width // 2 - 80, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    
    # Bullet points
    cv2.putText(slide, "• Point 1: Important concept", (50, 120), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.putText(slide, "• Point 2: Key feature", (50, 170), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.putText(slide, "• Point 3: Conclusion", (50, 220), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    
    # Diagram placeholder
    cv2.rectangle(slide, (400, 100), (600, 250), (200, 200, 200), -1)
    cv2.putText(slide, "Diagram", (450, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 2)
    
    # Footer
    cv2.rectangle(slide, (0, height - 40), (width, height), (50, 80, 120), -1)
    cv2.putText(slide, "Page 1", (width - 80, height - 15), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    # Save original slide
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'slide_eraser_01_original.png'), slide)
    print("  ✅ Saved: slide_eraser_01_original.png")
    
    # Try to load eraser hand image
    hand_image = None
    hand_mask_inv = None
    hand_ht = 0
    hand_wd = 0
    
    # Check for eraser images in data/images
    eraser_path = os.path.join(project_dir, 'data', 'images', 'eraser.png')
    eraser_mask_path = os.path.join(project_dir, 'data', 'images', 'eraser-mask.png')
    
    if os.path.exists(eraser_path) and os.path.exists(eraser_mask_path):
        print("\n  📌 Loading eraser hand image...")
        hand_image = cv2.imread(eraser_path)
        eraser_mask = cv2.imread(eraser_mask_path, cv2.IMREAD_GRAYSCALE)
        
        if hand_image is not None and eraser_mask is not None:
            # Crop to mask bounds
            indices = np.where(eraser_mask > 127)
            if len(indices[0]) > 0:
                y_coords, x_coords = indices
                top, bottom = np.min(y_coords), np.max(y_coords)
                left, right = np.min(x_coords), np.max(x_coords)
                
                hand_image = hand_image[top:bottom, left:right]
                eraser_mask = eraser_mask[top:bottom, left:right]
                
                # Create inverted mask and normalize
                hand_mask_inv = (255 - eraser_mask) / 255.0
                hand_ht, hand_wd = hand_image.shape[:2]
                
                # Make background black
                bg_indices = np.where(eraser_mask < 128)
                hand_image[bg_indices] = [0, 0, 0]
                
                print(f"     Loaded eraser hand: {hand_wd}x{hand_ht}")
    else:
        print("\n  ⚠️ Eraser hand images not found, proceeding without hand overlay")
    
    # Generate delay frames (pause before erasing)
    print("\n  📌 Generating delay frames...")
    delay_frames = generate_delay_frames(slide, delay_seconds=0.5, frame_rate=30)
    print(f"     Generated {len(delay_frames)} delay frames")
    
    # Generate slide eraser config
    print("\n  📌 Generating slide eraser config...")
    eraser_config = generate_slide_eraser_config(
        duration=1.5,
        delay_after_animations=0,
        pattern='horizontal',  # Use horizontal for natural whiteboard wiping
        background_color=(255, 255, 255),
        show_eraser=True
    )
    print(f"     Config: {eraser_config}")
    
    # Apply slide eraser with hand overlay
    print("\n  📌 Applying slide eraser...")
    eraser_frames, positions = apply_slide_eraser(
        current_frame=slide,
        eraser_config=eraser_config,
        frame_rate=30,
        hand_image=hand_image,
        hand_mask_inv=hand_mask_inv,
        hand_ht=hand_ht,
        hand_wd=hand_wd
    )
    print(f"     Generated {len(eraser_frames)} eraser frames")
    
    # Combine all frames
    all_frames = delay_frames + eraser_frames
    print(f"     Total frames: {len(all_frames)}")
    
    # Save key frames
    if eraser_frames:
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'slide_eraser_02_erase_start.png'), eraser_frames[0])
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'slide_eraser_03_erase_mid.png'), eraser_frames[len(eraser_frames) // 2])
        cv2.imwrite(os.path.join(OUTPUT_DIR, 'slide_eraser_04_erase_end.png'), eraser_frames[-1])
        print("     ✅ Saved eraser frames")
    
    # Create video
    video_path = os.path.join(OUTPUT_DIR, 'slide_eraser_transition.mp4')
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_writer = cv2.VideoWriter(video_path, fourcc, 30, (width, height))
    
    for frame in all_frames:
        video_writer.write(frame)
    
    video_writer.release()
    print("     ✅ Created video: slide_eraser_transition.mp4")
    
    print("\n  ✅ Slide Eraser demo complete!")


def demo_apply_eraser_function():
    """
    Demo 6: apply_eraser Convenience Function
    
    Demonstrates the simple apply_eraser function for quick erasing.
    """
    print("\n" + "=" * 70)
    print("⚡ DEMO 6: APPLY_ERASER FUNCTION")
    print("    Quick one-shot erasing for simple use cases")
    print("=" * 70)
    
    # Create simple test image
    img = np.zeros((200, 300, 3), dtype=np.uint8)
    cv2.putText(img, "Quick Erase", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.circle(img, (150, 150), 30, (0, 200, 200), -1)
    
    # Save original
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'apply_eraser_01_original.png'), img)
    print("  ✅ Saved: apply_eraser_01_original.png")
    
    # Apply eraser using convenience function
    print("\n  📌 Using apply_eraser function...")
    erased = apply_eraser(
        image_matrix=img.copy(),
        center_x=150,
        center_y=100,
        radius=40,
        color_value=(255, 255, 255),
        shape='circle'
    )
    
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'apply_eraser_02_result.png'), erased)
    print("  ✅ Saved: apply_eraser_02_result.png")
    
    # Grayscale test
    print("\n  📌 Grayscale erasing...")
    gray_img = np.zeros((100, 150), dtype=np.uint8)
    cv2.putText(gray_img, "GRAY", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, 255, 2)
    
    gray_erased = apply_eraser(
        image_matrix=gray_img.copy(),
        center_x=75,
        center_y=50,
        radius=25,
        color_value=128  # Gray instead of white
    )
    
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'apply_eraser_03_grayscale.png'), gray_erased)
    print("  ✅ Saved: apply_eraser_03_grayscale.png")
    
    print("\n  ✅ apply_eraser function demo complete!")


def create_summary_image():
    """Create a summary image showing all eraser effects."""
    print("\n" + "=" * 70)
    print("📊 CREATING SUMMARY IMAGE")
    print("=" * 70)
    
    # Load some key demo images
    summary_width = 900
    summary_height = 700
    summary = np.ones((summary_height, summary_width, 3), dtype=np.uint8) * 255
    
    # Title
    cv2.putText(summary, "KIVG ERASER & RUBBER TOOL DEMO SUMMARY", (130, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 100), 2)
    
    # Add sections
    sections = [
        ("1. Layer Eraser", 60),
        ("   Progressive erasing of individual layers", 90),
        ("2. Scene Eraser", 140),
        ("   Erasing entire scenes with multiple layers", 170),
        ("3. Rubber Tool", 220),
        ("   Direct pixel manipulation for doodle-style erasing", 250),
        ("4. Diagonal Patterns", 300),
        ("   diagonal, horizontal, vertical patterns", 330),
        ("5. Slide Eraser", 380),
        ("   End-of-slide transition effects", 410),
        ("6. apply_eraser Function", 460),
        ("   Quick one-shot erasing utility", 490),
    ]
    
    for text, y in sections:
        if text.startswith("   "):
            cv2.putText(summary, text, (50, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 100, 100), 1)
        else:
            cv2.putText(summary, text, (30, y), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    
    # Try to load and embed thumbnails
    thumb_y = 540
    thumb_size = (120, 90)
    
    thumbnails = [
        ('layer_eraser_01_original.png', 50),
        ('scene_eraser_01_original.png', 200),
        ('rubber_tool_01_original.png', 350),
        ('pattern_01_original.png', 500),
        ('slide_eraser_01_original.png', 650),
    ]
    
    for filename, x in thumbnails:
        filepath = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(filepath):
            thumb = cv2.imread(filepath)
            if thumb is not None:
                thumb = cv2.resize(thumb, thumb_size)
                summary[thumb_y:thumb_y + thumb_size[1], x:x + thumb_size[0]] = thumb
    
    # Footer
    cv2.putText(summary, "Run: python demo/demo_eraser_rubber_comprehensive.py", (200, 680), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 1)
    
    cv2.imwrite(os.path.join(OUTPUT_DIR, 'demo_summary.png'), summary)
    print("  ✅ Saved: demo_summary.png")


def main():
    """Run all eraser and rubber tool demos."""
    print("\n" + "=" * 70)
    print("🎨 KIVG ERASER & RUBBER TOOL COMPREHENSIVE DEMO")
    print("    Demonstrating all eraser effects for scenes and layers")
    print("=" * 70)
    
    # Run all demos
    demo_layer_eraser()
    demo_scene_eraser()
    demo_rubber_tool()
    demo_diagonal_patterns()
    demo_slide_eraser()
    demo_apply_eraser_function()
    
    # Create summary
    create_summary_image()
    
    print("\n" + "=" * 70)
    print("🎉 ALL DEMOS COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print(f"\n📁 Output directory: {OUTPUT_DIR}")
    print("\nGenerated files:")
    
    # List all generated files
    files = sorted(glob.glob(os.path.join(OUTPUT_DIR, '*.png')))
    videos = sorted(glob.glob(os.path.join(OUTPUT_DIR, '*.mp4')))
    
    print("\n  Images:")
    for f in files:
        print(f"    - {os.path.basename(f)}")
    
    print("\n  Videos:")
    for v in videos:
        print(f"    - {os.path.basename(v)}")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
