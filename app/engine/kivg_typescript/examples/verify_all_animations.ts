import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig, AnimationType, EmphasisAnimationType } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runAnimationVerification() {
    const outputDir = path.join(__dirname, '../output/animation_verification');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoOutputPath = path.join(outputDir, 'all_animations.mp4');

    console.log('🚀 Starting Comprehensive Animation Verification');

    // Comprehensive list of all animation types to verify
    const animations: AnimationType[] = [
        'draw', 'stroke', 'fade_in', 'fade_out',
        'slide_in_left', 'slide_in_right', 'slide_in_top', 'slide_in_bottom',
        'slide_out_left', 'slide_out_right', 'slide_out_top', 'slide_out_bottom',
        'zoom_in', 'zoom_out', 'click', 'pulse', 'typewriter', 'slide_in',
        'bounce', 'bounce_in', 'bounce_out', 'flip_in', 'flip_in_x', 'eraser',
        'flip_in_y', 'flip_out', 'rotate_in', 'rotate_out', 'spin_in', 'spin_out',
        'char_fade', 'push', 'none', 'flash', 'rubber_band', 'shake_x', 'shake_y',
        'head_shake', 'swing', 'tada', 'wobble', 'jello', 'heart_beat',
        'back_in_down', 'back_in_left', 'back_in_right', 'back_in_up',
        'back_out_down', 'back_out_left', 'back_out_right', 'back_out_up',
        'bounce_in_down', 'bounce_in_left', 'bounce_in_right', 'bounce_in_up',
        'bounce_out_down', 'bounce_out_left', 'bounce_out_right', 'bounce_out_up',
        'fade_in_down', 'fade_in_left', 'fade_in_right', 'fade_in_up',
        'fade_in_top_left', 'fade_in_top_right', 'fade_in_bottom_left', 'fade_in_bottom_right',
        'fade_out_down', 'fade_out_down_big', 'fade_out_left', 'fade_out_left_big',
        'fade_out_right', 'fade_out_right_big', 'fade_out_up', 'fade_out_up_big',
        'fade_out_top_left', 'fade_out_top_right', 'fade_out_bottom_left', 'fade_out_bottom_right',
        'flip_out_x', 'flip_out_y', 'rotate_in_down_left', 'rotate_in_down_right',
        'rotate_in_up_left', 'rotate_in_up_right', 'rotate_out_down_left',
        'rotate_out_down_right', 'rotate_out_up_left', 'rotate_out_up_right',
        'zoom_in_down', 'zoom_in_left', 'zoom_in_right', 'zoom_in_up',
        'zoom_out_down', 'zoom_out_left', 'zoom_out_right', 'zoom_out_up',
        'slide_out_top', 'slide_out_bottom', 'slide_out_up', 'slide_out_down',
        'jack_in_the_box', 'roll_in', 'roll_out', 'lightspeed_in', 'lightspeed_out',
        'reveal_horizontal', 'reveal_vertical', 'reveal_diagonal'
    ];

    const emphasisAnimations: EmphasisAnimationType[] = [
        'pulse', 'shake', 'bounce', 'wiggle', 'glow', 'flash',
        'rubber_band', 'swing', 'tada', 'wobble', 'jello', 'heart_beat'
    ];

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        background: "#1e293b",
        hands: {
            draw: {
                imageUrl: path.join(__dirname, '../static/hand/drawing-hand.png'),
                scale: 1,
                offset: [-9, -10]
            },
            erase: {
                imageUrl: path.join(__dirname, '../static/hand/eraser.png'),
                scale: 1,
                offset: [-150, -40]
            }
        },
        scenes: []
    };

    // Create a scene for each animation
    for (const anim of animations) {
        config.scenes!.push({
            id: `scene_${anim}`,
            background: "#1e293b",
            layers: [
                {
                    id: `bg_rect_${anim}`,
                    type: 'shape',
                    shape: 'rectangle',
                    width: 1280,
                    height: 720,
                    fillColor: '#0f172a',
                    position: { x: 640, y: 360 },
                    zIndex: 0
                },
                {
                    id: `label_${anim}`,
                    type: 'text',
                    position: { x: 640, y: 100 },
                    textConfig: {
                        text: `Animation: ${anim}`,
                        fontFamily: "sans-serif",
                        fontSize: 48,
                        color: "#f8fafc",
                        strokeAnimation: {
                            mode: 'draw',
                            duration: 0
                        }
                    }
                },
                {
                    id: `subject_${anim}`,
                    type: 'shape',
                    shape: 'rectangle',
                    width: 300,
                    height: 200,
                    fillColor: '#3b82f6',
                    strokeColor: '#60a5fa',
                    strokeWidth: 5,
                    position: { x: 640, y: 400 },
                    entrance_animation: {
                        type: anim,
                        duration: 1.5,
                        delay: 0.5
                    },
                    timingConfig: {
                        pauseTime: 1.0
                    }
                    // Some animations like reveal needs specific types but we use rectangle for simplicity
                }
            ]
        });
    }

    // Add emphasis animations
    for (const anim of emphasisAnimations) {
        config.scenes!.push({
            id: `scene_emphasis_${anim}`,
            background: "#1e293b",
            layers: [
                {
                    id: `bg_rect_emp_${anim}`,
                    type: 'shape',
                    shape: 'rectangle',
                    width: 1280,
                    height: 720,
                    fillColor: '#1e1b4b',
                    position: { x: 640, y: 360 },
                    zIndex: 0
                },
                {
                    id: `label_emp_${anim}`,
                    type: 'text',
                    position: { x: 640, y: 100 },
                    textConfig: {
                        text: `Emphasis: ${anim}`,
                        fontFamily: "sans-serif",
                        fontSize: 48,
                        color: "#f8fafc",
                    }
                },
                {
                    id: `subject_emp_${anim}`,
                    type: 'shape',
                    shape: 'rectangle',
                    width: 300,
                    height: 200,
                    fillColor: '#ec4899',
                    position: { x: 640, y: 400 },
                    entrance_animation: {
                        type: 'zoom_in',
                        duration: 0.5
                    },
                    emphasis_animation: {
                        type: anim,
                        duration: 1.0,
                        iterations: 2,
                        intensity: 0.5
                    },
                    timingConfig: {
                        pauseTime: 0.5
                    }
                }
            ]
        });
    }

    console.log(`  Created config with ${config.scenes!.length} scenes`);
    const whiteboard = new ServerWhiteboard(config, 1280, 720);

    console.log('  🔄 Preparing whiteboard...');
    await whiteboard.prepare();
    console.log('  ✅ Preparation complete');

    console.log('  🎬 Rendering verification video...');
    await whiteboard.renderToVideo(videoOutputPath, {
        fps: 30,
        resolution: '720p',
        parallelism: 'auto',
        onProgress: (progress: number, eta: number, fps: number) => {
            const percent = (progress * 100).toFixed(1);
            process.stdout.write(`\r  Render Progress: ${percent}% | ETA: ${eta.toFixed(1)}s | FPS: ${fps}    `);
        }
    });

    console.log(`\n✨ Verification complete! Video saved to: ${videoOutputPath}`);
}

runAnimationVerification().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
