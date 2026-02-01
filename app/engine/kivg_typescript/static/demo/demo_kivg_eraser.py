#!/usr/bin/env python3
"""
Demo script for kivg eraser functionality.

This demo shows how the kivg eraser works with diagonal pattern,
similar to the coloring mode but for erasing instead of drawing.

Usage:
    python demo/demo_kivg_eraser.py
"""

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
    generate_eraser_frames_diagonal,
    generate_slide_eraser_config,
    apply_slide_eraser,
    generate_delay_frames,
    organize_pixels_by_diagonal_pattern
)


def create_demo_image(width=320, height=240):
    """Create a demo image with some content to erase."""
    # Create a colored background
    img = np.full((height, width, 3), [200, 220, 240], dtype=np.uint8)  # Light blue-ish
    
    # Draw some shapes
    cv2.rectangle(img, (50, 50), (150, 100), (0, 100, 200), -1)  # Orange rectangle
    cv2.circle(img, (240, 120), 50, (50, 150, 50), -1)  # Green circle
    cv2.putText(img, "ERASE ME!", (80, 180), cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 50, 150), 2)
    
    return img


def demo_diagonal_eraser():
    """Demo: Show diagonal eraser pattern in action."""
    print("\n" + "=" * 60)
    print("📋 KIVG ERASER DEMO - Diagonal Pattern")
    print("=" * 60)
    
    # Create demo image
    print("\n1. Creating demo image...")
    demo_img = create_demo_image()
    print(f"   Created image: {demo_img.shape}")
    
    # Generate eraser frames
    print("\n2. Generating eraser frames with diagonal pattern...")
    frames, positions = generate_eraser_frames_diagonal(
        source_image=demo_img,
        num_frames=30,  # 1 second at 30fps
        pattern='diagonal',
        background_color=(255, 255, 255),  # White background
        show_eraser=True
    )
    
    print(f"   Generated {len(frames)} frames")
    print(f"   Generated {len(positions)} eraser positions")
    
    # Show some statistics
    first_frame = frames[0]
    middle_frame = frames[len(frames)//2]
    last_frame = frames[-1]
    
    print(f"\n3. Frame analysis:")
    print(f"   First frame mean pixel value: {np.mean(first_frame):.1f}")
    print(f"   Middle frame mean pixel value: {np.mean(middle_frame):.1f}")
    print(f"   Last frame mean pixel value: {np.mean(last_frame):.1f}")
    print(f"   (Higher = more white = more erased)")
    
    # Save output frames
    output_dir = os.path.join(project_dir, 'demo', 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n4. Saving frames to {output_dir}...")
    
    # Save first, middle, and last frames
    cv2.imwrite(os.path.join(output_dir, 'eraser_frame_first.png'), first_frame)
    cv2.imwrite(os.path.join(output_dir, 'eraser_frame_middle.png'), middle_frame)
    cv2.imwrite(os.path.join(output_dir, 'eraser_frame_last.png'), last_frame)
    
    print("   ✅ Saved eraser_frame_first.png")
    print("   ✅ Saved eraser_frame_middle.png")
    print("   ✅ Saved eraser_frame_last.png")
    
    # Create a video from frames
    video_path = os.path.join(output_dir, 'eraser_demo.mp4')
    print(f"\n5. Creating demo video: {video_path}")
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_writer = cv2.VideoWriter(video_path, fourcc, 30, (demo_img.shape[1], demo_img.shape[0]))
    
    for frame in frames:
        video_writer.write(frame)
    
    video_writer.release()
    print("   ✅ Video created successfully")
    
    print("\n" + "=" * 60)
    print("✅ Demo complete!")
    print("=" * 60 + "\n")


def demo_slide_eraser_config():
    """Demo: Show slide eraser configuration."""
    print("\n" + "=" * 60)
    print("📋 KIVG ERASER DEMO - Slide Eraser Config")
    print("=" * 60)
    
    # Generate different configurations
    print("\n1. Default configuration:")
    default_config = generate_slide_eraser_config()
    for key, value in default_config.items():
        print(f"   {key}: {value}")
    
    print("\n2. Custom configuration (end of slide eraser):")
    custom_config = generate_slide_eraser_config(
        duration=3.0,  # 3 seconds to erase
        delay_after_animations=1.0,  # Wait 1 second after animations complete
        pattern='diagonal',  # Diagonal zigzag pattern
        background_color=(255, 255, 255),  # White background
        show_eraser=True
    )
    for key, value in custom_config.items():
        print(f"   {key}: {value}")
    
    print("\n" + "=" * 60)
    print("✅ Config demo complete!")
    print("=" * 60 + "\n")


def demo_delay_and_erase():
    """Demo: Show delay followed by erasing (like end of slide)."""
    print("\n" + "=" * 60)
    print("📋 KIVG ERASER DEMO - Delay + Erase (End of Slide)")
    print("=" * 60)
    
    # Create demo image
    print("\n1. Creating demo slide content...")
    demo_img = create_demo_image()
    
    # Generate delay frames (hold the slide for 0.5 seconds at 30fps)
    print("\n2. Generating delay frames (wait after animations)...")
    delay_frames = generate_delay_frames(demo_img, 0.5, 30)
    print(f"   Generated {len(delay_frames)} delay frames")
    
    # Generate eraser config
    print("\n3. Creating eraser config...")
    eraser_config = generate_slide_eraser_config(
        duration=1.0,
        delay_after_animations=0,  # Delay already handled
        pattern='diagonal'
    )
    
    # Apply slide eraser
    print("\n4. Applying slide eraser...")
    eraser_frames, positions = apply_slide_eraser(
        current_frame=demo_img,
        eraser_config=eraser_config,
        frame_rate=30
    )
    print(f"   Generated {len(eraser_frames)} eraser frames")
    
    # Combine all frames
    all_frames = delay_frames + eraser_frames
    print(f"\n5. Total frames: {len(all_frames)}")
    print(f"   - Delay: {len(delay_frames)} frames")
    print(f"   - Erase: {len(eraser_frames)} frames")
    
    # Save as video
    output_dir = os.path.join(project_dir, 'demo', 'output')
    os.makedirs(output_dir, exist_ok=True)
    video_path = os.path.join(output_dir, 'slide_end_eraser_demo.mp4')
    
    print(f"\n6. Creating demo video: {video_path}")
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_writer = cv2.VideoWriter(video_path, fourcc, 30, (demo_img.shape[1], demo_img.shape[0]))
    
    for frame in all_frames:
        video_writer.write(frame)
    
    video_writer.release()
    print("   ✅ Video created successfully")
    
    print("\n" + "=" * 60)
    print("✅ Delay + Erase demo complete!")
    print("=" * 60 + "\n")


def demo_pattern_comparison():
    """Demo: Compare different erasing patterns."""
    print("\n" + "=" * 60)
    print("📋 KIVG ERASER DEMO - Pattern Comparison")
    print("=" * 60)
    
    # Create demo image
    demo_img = create_demo_image()
    
    patterns = ['diagonal', 'horizontal', 'vertical']
    output_dir = os.path.join(project_dir, 'demo', 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    for pattern in patterns:
        print(f"\n📌 Pattern: {pattern}")
        
        # Generate frames for this pattern
        frames, positions = generate_eraser_frames_diagonal(
            source_image=demo_img,
            num_frames=20,
            pattern=pattern,
            background_color=(255, 255, 255)
        )
        
        # Save middle frame to show pattern
        middle_frame = frames[len(frames)//2]
        filename = f'eraser_pattern_{pattern}.png'
        cv2.imwrite(os.path.join(output_dir, filename), middle_frame)
        print(f"   ✅ Saved {filename}")
    
    print("\n" + "=" * 60)
    print("✅ Pattern comparison demo complete!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    print("=" * 60)
    print("  KIVG ERASER DEMO")
    print("  Diagonal coloring pattern for erasing whiteboard")
    print("=" * 60)
    
    # Run all demos
    demo_diagonal_eraser()
    demo_slide_eraser_config()
    demo_delay_and_erase()
    demo_pattern_comparison()
    
    print("\n" + "=" * 60)
    print("🎉 All demos completed successfully!")
    print("=" * 60)
