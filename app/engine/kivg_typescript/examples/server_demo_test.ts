import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runServerDemoTest() {
    const outputDir = path.join(__dirname, '../output/server_demo');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoOutputPath = path.join(outputDir, 'server_demo.mp4');

    console.log('🚀 Starting Server-side Demo Test');
    console.log(`  Output Dir: ${outputDir}`);
    console.log(`  Video Output: ${videoOutputPath}`);

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        debug: true,
        background: "#ffffff",
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
            },
            push: {
                imageUrl: path.join(__dirname, '../static/hand/push_hand_real.png'),
                scale: 0.3,
                offset: [-40, -32]
            }
        },
        scenes: [
            {
                id: "reveal_scene",
                background: "#ffffff",
                transition: { type: "eraser", duration: 3.5 },
                camera: {
                    virtualSize: { width: 4000, height: 3000 },
                    followMode: 'manual',
                    initial: {
                        size: { width: 800, height: 450 },
                        position: { x: 400, y: 225 }
                    },
                    keyframes: [
                        {
                            startTime: 1.5,
                            position: { x: 400, y: 225 },
                            transitionDuration: 1.5,
                            size: { width: 800, height: 450 },
                            zoom: 1
                        },
                        {
                            startTime: 3,
                            position: { x: 500, y: 225 },
                            transitionDuration: 1.5,
                            size: { width: 800, height: 450 },
                            zoom: 2.5
                        }
                    ]
                },
                eraser_config: {
                    enabled: true,
                    delayAfterAnimations: 1.5,
                    pattern: "diagonal",
                    backgroundColor: [240, 249, 255],
                    showEraser: true,
                    radius: 30,
                },
                layers: [
                    {
                        id: "reveal-title",
                        type: "text",
                        position: { x: 400, y: 100 },
                        textConfig: {
                            text: "Reveal Scene",
                            fontFamily: "sans-serif",
                            fontSize: 36,
                            color: "#0f172a",
                            strokeAnimation: {
                                duration: 1.5,
                                mode: 'typewriter',
                            }
                        },
                        handOverlay: {
                            enabled: true,
                            offset: [-9, -10]
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.5,
                            delay: 0
                        }
                    },
                    {
                        id: 'push_box',
                        type: 'push',
                        position: { x: 200, y: 200 },
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: 'push',
                            duration: 3,
                            delay: 0
                        },
                        pushConfig: {
                            imageUrl: path.join(__dirname, '../static/demo/icons/facebook2.svg'),
                            width: 150,
                            height: 150,
                            from: 'left',
                            pushEasing: 'out_cubic'
                        }
                    },
                    {
                        id: "star-shape",
                        type: "shape",
                        shape: 'star',
                        width: 60,
                        strokeColor: '#eab308',
                        strokeWidth: 3,
                        position: { x: 600, y: 200 },
                        zIndex: 2,
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.5,
                            delay: 0
                        }
                    },
                    {
                        id: "hybrid-image",
                        type: "image",
                        position: { x: 400, y: 300 },
                        width: 200,
                        height: 200,
                        zIndex: 5,
                        imageUrl: path.join(__dirname, '../static/demo/icons/facebook2.svg'),
                        handOverlay: {
                            enabled: true,
                            scale: 0.8
                        },
                        entrance_animation: {
                            type: "reveal_diagonal",
                            duration: 2,
                            delay: 0
                        }
                    },
                    {
                        id: "svg-player-example",
                        type: "kivg",
                        position: { x: 450, y: 150 },
                        width: 150,
                        height: 150,
                        svgUrl: path.join(__dirname, '../static/demo/icons/typescript.svg'),
                        entrance_animation: {
                            type: "draw",
                            duration: 3,
                            delay: 0
                        },
                        handOverlay: {
                            enabled: true,
                            scale: 1.0
                        }
                    }
                ]
            },
            // Scene 2: Shape Layers
            {
                id: "scene-shapes",
                background: "#fef3c7",
                transition: { type: "slide_left", duration: 0.5 },
                camera: {
                    virtualSize: { width: 4000, height: 3000 },
                    followMode: 'manual',
                    initial: {
                        size: { width: 800, height: 450 },
                        position: { x: 400, y: 200 }
                    },
                    keyframes: [
                        {
                            startTime: 15,
                            position: { x: 400, y: 225 },
                            transitionDuration: 1.5,
                            size: { width: 800, height: 450 },
                            zoom: 1
                        },
                        {
                            startTime: 18,
                            position: { x: 500, y: 225 },
                            transitionDuration: 1.5,
                            size: { width: 800, height: 450 },
                            zoom: 2.5
                        }
                    ]
                },
                eraser_config: {
                    enabled: true,
                    duration: 1.5,
                    delayAfterAnimations: 0.3,
                    pattern: "horizontal",
                    backgroundColor: [254, 243, 199],
                    showEraser: true,
                    radius: 30,
                },
                layers: [
                    {
                        id: "shapes-title",
                        type: "text",
                        position: { x: 400, y: 60 },
                        textConfig: {
                            text: "Shape Layers",
                            fontFamily: "sans-serif",
                            fontSize: 36,
                            color: "#92400e",
                            strokeAnimation: {
                                duration: 1.5,
                                mode: 'typewriter',
                            }
                        },
                        handOverlay: {
                            enabled: true,
                            offset: [-9, -10]
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.5,
                            delay: 0
                        }
                    },
                    {
                        id: "circle-shape",
                        type: "shape",
                        shape: 'circle',
                        width: 80,
                        strokeColor: '#dc2626',
                        strokeWidth: 3,
                        position: { x: 150, y: 225 },
                        zIndex: 2,
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 0.8,
                            delay: 0
                        }
                    },
                    {
                        id: "rect-shape",
                        type: "shape",
                        shape: 'rectangle',
                        width: 140,
                        strokeColor: '#2563eb',
                        strokeWidth: 3,
                        position: { x: 400, y: 225 },
                        zIndex: 2,
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 0.8,
                            delay: 0
                        }
                    },
                    {
                        id: "circle-shape2",
                        type: "shape",
                        shape: 'circle',
                        width: 70,
                        strokeColor: '#16a34a',
                        strokeWidth: 3,
                        position: { x: 650, y: 225 },
                        zIndex: 2,
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 0.8,
                            delay: 0
                        }
                    }
                ]
            },
            // Scene 3: Occlusion Culling
            {
                id: "occlusion_scene",
                background: "#f0fdf4",
                transition: { type: "slide_up", duration: 0.5 },
                occlusionCulling: true,
                occlusionCullingConfig: {
                    duration: 1.0,
                    showEraser: true,
                    radius: 20
                },
                camera: {
                    virtualSize: { width: 4000, height: 3000 },
                    followMode: 'manual',
                    initial: {
                        size: { width: 800, height: 450 },
                        position: { x: 400, y: 200 }
                    },
                    keyframes: []
                },
                layers: [
                    {
                        id: "occlusion-title",
                        type: "text",
                        position: { x: 400, y: 60 },
                        textConfig: {
                            text: "Occlusion Culling",
                            fontFamily: "sans-serif",
                            fontSize: 36,
                            color: "#14532d",
                            strokeAnimation: {
                                duration: 1.5,
                                mode: 'typewriter',
                            }
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.5,
                            delay: 0
                        }
                    },
                    {
                        id: "background-circle",
                        type: "shape",
                        shape: 'circle',
                        width: 100,
                        strokeColor: '#16a34a',
                        fillColor: '#16a34a',
                        strokeWidth: 3,
                        position: { x: 400, y: 250 },
                        zIndex: 1,
                        entrance_animation: {
                            type: "draw",
                            duration: 1.0,
                            delay: 0
                        }
                    },
                    {
                        id: "foreground-rect",
                        type: "shape",
                        shape: 'rectangle',
                        width: 120,
                        strokeColor: '#dc2626',
                        fillColor: '#dc2626',
                        strokeWidth: 3,
                        position: { x: 400, y: 250 },
                        zIndex: 2,
                        occlusionMode: 'auto',
                        entrance_animation: {
                            type: "draw",
                            duration: 1.0,
                            delay: 1.5
                        }
                    }
                ]
            },
            // Scene 4: Emphasis and Exit Animations
            {
                id: "emphasis_exit_scene",
                background: "#f0fdf4",
                transition: { type: "slide_up", duration: 0.5 },
                camera: {
                    virtualSize: { width: 4000, height: 3000 },
                    followMode: 'manual',
                    initial: {
                        size: { width: 800, height: 450 },
                        position: { x: 400, y: 225 }
                    },
                    keyframes: []
                },
                layers: [
                    {
                        id: "anim-title",
                        type: "text",
                        position: { x: 400, y: 50 },
                        textConfig: {
                            text: "Emphasis & Exit",
                            fontFamily: "sans-serif",
                            fontSize: 36,
                            color: "#1e3a8a",
                            strokeAnimation: {
                                duration: 1.0,
                                mode: 'typewriter',
                            }
                        },
                        entrance_animation: {
                            type: "fade_in_down",
                            duration: 1.0,
                            delay: 0
                        }
                    },
                    {
                        id: "pulse-circle",
                        type: "shape",
                        shape: 'circle',
                        width: 80,
                        strokeColor: '#ea580c',
                        fillColor: '#ea580c',
                        position: { x: 250, y: 250 },
                        entrance_animation: {
                            type: "zoom_in",
                            duration: 1.0,
                            delay: 0.5
                        },
                        emphasis_animation: {
                            type: "pulse",
                            duration: 1.0,
                            iterations: 2,
                            intensity: 0.2
                        },
                        exit_animation: {
                            type: "zoom_out",
                            duration: 0.8,
                            delay: 0
                        },
                        timingConfig: {
                            pauseTime: 2.5
                        }
                    },
                    {
                        id: "shake-rect",
                        type: "shape",
                        shape: 'rectangle',
                        width: 100,
                        strokeColor: '#7c3aed',
                        fillColor: '#7c3aed',
                        position: { x: 550, y: 250 },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.0,
                            delay: 1.0
                        },
                        emphasis_animation: {
                            type: "shake",
                            duration: 1.0,
                            iterations: 3,
                            intensity: 0.1
                        },
                        exit_animation: {
                            type: "eraser",
                            duration: 1.5
                        },
                        timingConfig: {
                            pauseTime: 3.5
                        }
                    }
                ]
            }
        ]
    };

    // Note: ServerWhiteboard constructor might take different args depending on implementation
    // Assuming (config, width, height) based on occlusion_test.ts
    const whiteboard = new ServerWhiteboard(config, 800, 450);

    console.log('  🔄 Preparing whiteboard...');
    await whiteboard.prepare();
    console.log('  ✅ Preparation complete');

    // Print calculated durations
    console.log('\n⏱️ Scene Durations:');
    let totalComputed = 0;
    whiteboard.getScenes().forEach((scene: any, i: number) => {
        const duration = scene.getDuration();
        console.log(`  Scene ${i + 1} (${scene.getConfig().id}): ${duration.toFixed(2)}s`);
        totalComputed += duration;
    });
    console.log(`  Total computed duration: ${totalComputed.toFixed(2)}s\n`);

    console.log('  🎬 Rendering video...');
    await whiteboard.renderToVideo(videoOutputPath, {
        fps: 30,
        resolution: '720p',
        parallelism: 'auto',
        onProgress: (progress: number, eta: number, fps: number) => {
            const percent = (progress * 100).toFixed(1);
            process.stdout.write(`\r  Render Progress: ${percent}% | ETA: ${eta.toFixed(1)}s | FPS: ${fps}    `);
        },
        keepTemp: false
    });

    console.log('\n✨ Test complete! Check the output directory for results.');
}

runServerDemoTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
