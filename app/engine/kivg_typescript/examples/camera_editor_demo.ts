/**
 * Camera Editor Demo
 * Demonstrates multi-camera management for large scenes
 */

import { SceneCanvas, CameraControls, type Camera } from '../src/editor/canvas/index';

// Initialize demo when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeCameraDemo();
});

function initializeCameraDemo() {
    console.log('🎬 Starting Camera Editor Demo...');

    // Create container elements
    const appContainer = document.getElementById('app');
    if (!appContainer) {
        console.error('App container not found');
        return;
    }

    // Clear and setup app container
    appContainer.innerHTML = `
        <div style="display: flex; height: 100vh;">
            <div id="camera-controls-panel" style="width: 320px; background: white; border-right: 1px solid #ccc; overflow-y: auto;"></div>
            <div id="canvas-container" style="flex: 1; background: #f0f0f0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;"></div>
        </div>
    `;

    const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement;
    const controlsPanel = document.getElementById('camera-controls-panel') as HTMLDivElement;

    // Scene configuration with large virtual size
    const sceneConfig = {
        id: 'demo-scene',
        name: 'Large Scene Demo',
        width: 4000,  // Large immense scene width
        height: 3000,  // Large immense scene height
        background: {
            color: '#ffffff',
            grid: {
                type: 'dots' as const,
                size: 50,
                color: '#cbd5e0',
                opacity: 0.3
            }
        },
        cameras: [
            {
                id: 'default-camera',
                name: 'Caméra Principale',
                position: { x: 0.5, y: 0.5 },
                width: 800,
                height: 450,
                zoom: 1,
                locked: false,
                isDefault: true
            },
            {
                id: 'camera-2',
                name: 'Vue Gauche',
                position: { x: 0.25, y: 0.25 },
                width: 640,
                height: 360,
                zoom: 1.5,
                locked: false,
                isDefault: false
            },
            {
                id: 'camera-3',
                name: 'Vue Droite',
                position: { x: 0.75, y: 0.75 },
                width: 640,
                height: 360,
                zoom: 1.2,
                locked: false,
                isDefault: false
            }
        ] as Camera[],
        layers: []
    };

    // Create scene canvas
    const sceneCanvas = new SceneCanvas(canvasContainer, sceneConfig);

    // Create camera controls
    const cameraControls = new CameraControls({
        container: controlsPanel,
        cameras: sceneCanvas.getAllCameras(),
        selectedCameraId: null,
        virtualSize: { width: sceneConfig.width, height: sceneConfig.height }
    });

    // Wire up camera controls callbacks
    cameraControls.setCallbacks({
        onCameraSelect: (cameraId) => {
            sceneCanvas.selectCamera(cameraId);
            console.log('Camera selected:', cameraId);
        },
        onCameraAdd: () => {
            const cameras = sceneCanvas.getAllCameras();
            // Generate unique ID using crypto.randomUUID() if available, fallback to timestamp + random
            const generateId = (): string => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return `camera-${crypto.randomUUID()}`;
                }
                return `camera-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            };

            const newCamera: Camera = {
                id: generateId(),
                name: `Caméra ${cameras.length + 1}`,
                position: { x: 0, y: 0 }, // Will use current viewport position
                width: 800,
                height: 450,
                zoom: 1,
                locked: false,
                isDefault: false
            };
            sceneCanvas.addCamera(newCamera);
            cameraControls.updateCameras(sceneCanvas.getAllCameras());
            console.log('Camera added:', newCamera.name);
        },
        onCameraRemove: (cameraId) => {
            sceneCanvas.removeCamera(cameraId);
            cameraControls.updateCameras(sceneCanvas.getAllCameras());
            cameraControls.setSelectedCamera(null);
            console.log('Camera removed:', cameraId);
        },
        onCameraDuplicate: (cameraId) => {
            const duplicated = sceneCanvas.duplicateCamera(cameraId);
            if (duplicated) {
                cameraControls.updateCameras(sceneCanvas.getAllCameras());
                console.log('Camera duplicated:', duplicated.name);
            }
        },
        onCameraUpdate: (cameraId, updates) => {
            sceneCanvas.updateCamera(cameraId, updates);
            console.log('Camera updated:', cameraId, updates);
        },
        onVirtualSizeUpdate: (width, height) => {
            sceneCanvas.updateScene({ width, height });
            console.log('Virtual size updated:', width, 'x', height);
        }
    });

    // Wire up scene canvas callbacks
    sceneCanvas.setCallbacks({
        onCameraSelect: (camera) => {
            cameraControls.setSelectedCamera(camera ? camera.id : null);
        },
        onCameraChange: (camera) => {
            cameraControls.updateCameras(sceneCanvas.getAllCameras());
        },
        onZoomChange: (zoom) => {
            console.log('Zoom changed:', zoom);
        }
    });

    // Add some demo shapes to visualize the large canvas
    setTimeout(() => {
        // Add shapes at different positions
        const shapes = [
            { x: 500, y: 500, color: '#3b82f6', name: 'Blue Shape' },
            { x: 1500, y: 1000, color: '#ef4444', name: 'Red Shape' },
            { x: 2500, y: 2000, color: '#10b981', name: 'Green Shape' },
            { x: 3500, y: 1500, color: '#f59e0b', name: 'Orange Shape' },
        ];

        shapes.forEach((shape, index) => {
            sceneCanvas.addShapeLayer({
                id: `shape-${index}`,
                type: 'shape',
                position: { x: shape.x, y: shape.y },
                shape: 'rectangle',
                width: 200,
                height: 150,
                fillColor: shape.color,
                strokeColor: '#1e293b',
                strokeWidth: 3
            });
        });

        console.log('✅ Demo shapes added across the large canvas');
    }, 500);

    // Fit to viewport after initialization
    setTimeout(() => {
        sceneCanvas.fitToViewport();
        console.log('✅ Camera Editor Demo initialized successfully!');
        console.log('📸 Scene size:', `${sceneConfig.width}x${sceneConfig.height}px`);
        console.log('📷 Cameras:', sceneCanvas.getAllCameras().length);
    }, 600);
}
