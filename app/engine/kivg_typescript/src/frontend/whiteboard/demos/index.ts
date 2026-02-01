import { Whiteboard } from "../whiteboard";
import { Scene } from "../scene";
import { ShapeLayer } from "../layers/shape-layer";
import { PushLayer } from "../layers/push-layer";
import { TextLayer } from "../layers/text-layer";
import { ImageLayer } from "../layers/image-layer";
import { SvgLayer } from "../../core/layers/svg-layer";


// ==================== WHITEBOARD SETUP WITH GLOBAL SUBTITLES ====================
// ==================== WHITEBOARD SETUP WITH GLOBAL SUBTITLES ====================
const whiteboard = new Whiteboard({
    containerId: "app",
    width: 800,
    height: 450,
    debug: true,
    perfMonitor: true,
    background: "#ffffff",
    // ... subtitles config ... (keeping existing logic if needed, but for brevity assuming it's part of the file context I shouldn't delete if not showing)
    subtitles: {
        enabled: true,
        position: 'bottom',
        offset: { x: 0, y: 0 },
        style: {
            fontSize: 28,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            color: '#ffffff',
            backgroundColor: '#000000',
            backgroundOpacity: 0.8,
            padding: 16,
            borderRadius: 8,
            alignment: 'center',
            maxWidth: 700,
            stroke: {
                color: '#000000',
                width: 2
            },
            shadow: {
                color: 'rgba(0, 0, 0, 0.5)',
                blur: 4,
                offsetX: 2,
                offsetY: 2
            },
            animation: {
                in: 'fade',
                out: 'fade',
                duration: 0.3
            }
        },
        segments: [
            {
                id: 'sub1',
                text: 'Welcome to the IMMENSE infinite canvas!',
                startTime: 0,
                endTime: 3000
            },
            {
                id: 'sub2',
                text: 'Use Middle Mouse Button to PAN',
                startTime: 3000,
                endTime: 6000
            },
            {
                id: 'sub3',
                text: 'Use Wheel to ZOOM in/out',
                startTime: 6000,
                endTime: 9000
            }
        ]
    }
});

// ==================== SCENE: SIMPLE TEXT DEMO ====================

// ==================== SCENE: REVEAL DEMO ====================
const scene = new Scene({
    id: "reveal_scene",
    background: "#ffffff",
    transition: { type: "eraser", duration: 3 },
    camera: {
        virtualSize: { width: 2000, height: 2000 },
        followMode: 'manual',
        initial: {
            size: { width: 2000, height: 2000 },
            zoom: 1,
            position: { x: 1000, y: 1000 }// Center of immense scene
        },
        keyframes: []
    },
    // Multiple Cameras definition for the Editor
    cameras: [
        {
            id: 'cam-main',
            name: 'Main View',
            position: { x: 1000, y: 1000 },
            width: 800,
            height: 450,
            zoom: 1,
            isDefault: true
        },
        {
            id: 'cam-detail-1',
            name: 'Detail Top-Left',
            position: { x: 400, y: 400 },
            width: 400,
            height: 300,
            zoom: 1.5
        },
        {
            id: 'cam-detail-2',
            name: 'Detail Bottom-Right',
            position: { x: 1600, y: 1600 },
            width: 400,
            height: 300,
            zoom: 1.5
        }
    ],
    eraser_config: {
        enabled: true,
        delayAfterAnimations: 0.3,
        pattern: "diagonal",
        backgroundColor: [240, 249, 255],
        showEraser: true,
        radius: 30,
    }
});

scene
    .addLayer(new TextLayer({
        id: "reveal-title",
        position: { x: 900, y: 100 },
        text: "Large Canvas Demo",
        fontFamily: "sans-serif",
        fontSize: 48,
        color: "#0f172a",
        direction: "ltr",
        strokeAnimation: {
            duration: 1.5,
            mode: 'typewriter',
        },
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }))
    .addLayer(new TextLayer({
        id: "subtitle",
        position: { x: 850, y: 180 },
        text: "Zoom & Pan to Explore",
        fontFamily: "sans-serif",
        fontSize: 28,
        color: "#64748b",
        direction: "ltr",
        strokeAnimation: {
            duration: 1.0,
            mode: 'typewriter',
        },
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.0,
            delay: 0.5
        }
    }))
    .addLayer(new ShapeLayer({
        id: "circle-top-left",
        position: { x: 300, y: 300 },
        zIndex: 2,
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }, 'circle', 100, '#ef4444', 'none', 4))
    .addLayer(new ShapeLayer({
        id: "star-top-right",
        position: { x: 1700, y: 300 },
        zIndex: 2,
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }, 'star', 80, '#eab308', 'none', 4))
    .addLayer(new ShapeLayer({
        id: "rect-bottom-left",
        position: { x: 300, y: 1700 },
        zIndex: 2,
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }, 'rectangle', 150, '#3b82f6', 'none', 4))
    .addLayer(new ShapeLayer({
        id: "circle-bottom-right",
        position: { x: 1700, y: 1700 },
        zIndex: 2,
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }, 'circle', 100, '#10b981', 'none', 4))
    .addLayer(new ShapeLayer({
        id: "center-star",
        position: { x: 1000, y: 1000 },
        zIndex: 2,
        handOverlay: {
            enabled: false,
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        },
        emphasis_animation: {
            type: "flash",
            duration: 1.5,
            delay: 0,
            iterations: 2,
            intensity: 5
        }
    }, 'star', 120, '#8b5cf6', 'none', 5))
    .addLayer(new SvgLayer("/icons/facebook2.svg", {
        id: "kivg-icon",
        position: { x: 950, y: 250 },
        entrance_animation: {
            type: "draw",
            duration: 2,
            delay: 0.5
        },
        fill: true,
        lineWidth: 2
    }))
const scene2 = new Scene({
    id: "scene-shapes",
    background: "#fef3c7",
    transition: { type: "slide_left", duration: 0.5 },
    camera: {
        virtualSize: { width: 1000, height: 1000 },
        followMode: 'manual',
        initial: {
            size: { width: 1000, height: 1000 },
            zoom: 1,
            position: { x: 400, y: 200 }
        },
        keyframes: [
            // 1. Focus on the first circle (red)
            {
                position: { x: 150, y: 225 },
                zoom: 2.5,
                transitionDuration: 1.5,
                easing: 'ease_in_out',
                pauseTime: 1
            },
            // 2. Focus on the rectangle (blue)
            {
                position: { x: 400, y: 225 },
                zoom: 2.5,
                transitionDuration: 1.5,
                easing: 'ease_in_out',
                pauseTime: 1
            },
            // 3. Focus on the second circle (green)
            {
                position: { x: 650, y: 225 },
                zoom: 2.5,
                transitionDuration: 1.5,
                easing: 'ease_in_out',
                pauseTime: 1
            },
            // 4. Zoom out to see everything
            {
                position: { x: 400, y: 200 },
                zoom: 1,
                transitionDuration: 1.5,
                easing: 'ease_in_out'
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
    }
});

scene2
    .addLayer(
        new TextLayer({
            id: "shapes-title",
            position: { x: 400, y: 60 },
            text: "Shape Layers",
            fontFamily: "sans-serif",
            fontSize: 36,
            color: "#92400e",
            direction: "ltr",
            strokeAnimation: {
                duration: 1.5,
                mode: 'typewriter',
            },
            handOverlay: {
                enabled: false,

            },
            entrance_animation: {
                type: "draw",
                duration: 1.5,
                delay: 0
            }
        })
    )
    .addLayer(
        new ShapeLayer(
            {
                id: "circle-shape",
                position: { x: 150, y: 225 },
                zIndex: 2,
                handOverlay: {
                    enabled: false,

                },
                entrance_animation: {
                    type: "draw",
                    duration: 0.8,
                    delay: 0
                }
            },
            'circle',
            80,
            '#dc2626',
            'none',
            3
        )
    )
    .addLayer(
        new ShapeLayer(
            {
                id: "rect-shape",
                position: { x: 400, y: 225 },
                zIndex: 2,
                handOverlay: {
                    enabled: false
                },
                entrance_animation: {
                    type: "draw",
                    duration: 0.8,
                    delay: 0
                }
            },
            'rectangle',
            140,
            '#2563eb',
            'none',
            3
        )
    )
    .addLayer(
        new ShapeLayer(
            {
                id: "circle-shape2",
                position: { x: 650, y: 225 },
                zIndex: 2,
                handOverlay: {
                    enabled: false,

                },
                entrance_animation: {
                    type: "draw",
                    duration: 0.8,
                    delay: 0
                }
            },
            'circle',
            70,
            '#16a34a',
            'none',
            3
        )
    );

const scene3 = new Scene({
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
        virtualSize: { width: 1000, height: 1000 },
        followMode: 'manual',
        initial: {
            size: { width: 1000, height: 1000 },
            zoom: 1,
            position: { x: 400, y: 200 }
        }
    }
});

scene3
    .addLayer(new TextLayer({
        id: "occlusion-title",
        position: { x: 400, y: 60 },
        text: "Occlusion Culling",
        fontFamily: "sans-serif",
        fontSize: 36,
        color: "#14532d",
        direction: "ltr",
        strokeAnimation: {
            duration: 1.5,
            mode: 'typewriter',
        },
        entrance_animation: {
            type: "draw",
            duration: 1.5,
            delay: 0
        }
    }))
    .addLayer(new ShapeLayer({
        id: "background-circle",
        position: { x: 400, y: 250 },
        zIndex: 1,
        entrance_animation: {
            type: "draw",
            duration: 1.0,
            delay: 0
        }
    }, 'circle', 100, '#16a34a', '#16a34a', 3))
    .addLayer(new ShapeLayer({
        id: "foreground-rect",
        position: { x: 400, y: 200 },
        zIndex: 2,
        occlusionMode: 'auto',
        entrance_animation: {
            type: "draw",
            duration: 1.0,
            delay: 1.5
        }
    }, 'rectangle', 120, '#dc2626', '#dc2626', 3));


whiteboard.addScene(scene).addScene(scene2).addScene(scene3);

// ==================== POSITION LOGGING ====================
const positionLogs: any[] = [];
let isLogging = false;

// Add time update callback to log positions
const originalOnTimeUpdate = whiteboard['onTimeUpdate'];
whiteboard['onTimeUpdate'] = (time: number) => {
    if (originalOnTimeUpdate) {
        originalOnTimeUpdate(time);
    }

    // Only log for the first scene
    if (isLogging && whiteboard['currentSceneIndex'] === 0) {
        const currentScene = whiteboard['scenes'][0];
        if (currentScene) {
            currentScene.layers.forEach((layer: any) => {
                const element = layer.getElement();
                if (element) {
                    // Extract position from transform attribute
                    const transform = element.getAttribute('transform') || '';
                    const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

                    if (translateMatch) {
                        const x = parseFloat(translateMatch[1]);
                        const y = parseFloat(translateMatch[2]);

                        positionLogs.push({
                            time: parseFloat(time.toFixed(3)),
                            layerId: layer.getConfig().id,
                            x: parseFloat(x.toFixed(2)),
                            y: parseFloat(y.toFixed(2))
                        });
                    }
                }
            });
        }
    }
};


// Start in Editor mode by default
whiteboard.setMode('editor');
console.log("🖱️ Editor Mode Active by default");

// ==================== EDITOR INTEGRATION DEMO ====================

// Add a button to toggle editor mode
const button = document.createElement('button');
button.innerText = 'Switch to Preview'; // Default is now Editor
button.style.position = 'fixed';
button.style.bottom = '20px';
button.style.right = '20px';
button.style.padding = '15px 30px';
button.style.fontSize = '18px';
button.style.backgroundColor = '#667eea';
button.style.color = 'white';
button.style.border = 'none';
button.style.borderRadius = '8px';
button.style.cursor = 'pointer';
button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
button.style.zIndex = '1000';

button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.backgroundColor = '#5a67d8';
});

button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.backgroundColor = '#667eea';
});

button.onclick = () => {
    const isCurrentlyEditor = whiteboard['mode'] === 'editor';

    if (isCurrentlyEditor) {
        // Switch to Preview
        whiteboard.setMode('preview');
        whiteboard.play(); // Auto-play when entering preview
        button.innerText = 'Switch to Editor';
        console.log("Switched to Preview mode (Playing)");
    } else {
        // Switch to Editor
        whiteboard.setMode('editor');
        button.innerText = 'Switch to Preview';
        console.log("Switched to Editor mode (Paused)");
        console.log("🖱️ Editor Mode Active: Click and drag elements to move/resize. Use handles to rotate.");
    }
};

document.body.appendChild(button);

export default whiteboard;