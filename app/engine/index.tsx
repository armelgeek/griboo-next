'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    SceneCanvas,
    CameraControls,
    QuickCameraNav,
    type SceneConfig,
    type Camera,
    type BaseLayerConfig
} from './kivg_typescript/src/editor/canvas/index';
import { Whiteboard } from './kivg_typescript/src/frontend/whiteboard/whiteboard';

/**
 * React Camera Editor Component
 * Wraps the Konva-based SceneCanvas and its controls in a modern React interface.
 */
export default function CameraEditor() {
    // Refs for engine instances
    const canvasRef = useRef<HTMLDivElement>(null);
    const cameraControlsRef = useRef<HTMLDivElement>(null);
    const quickNavRef = useRef<HTMLDivElement>(null);
    const sceneCanvasInstance = useRef<SceneCanvas | null>(null);
    const cameraControlsInstance = useRef<CameraControls | null>(null);
    const quickNavInstance = useRef<QuickCameraNav | null>(null);

    // React State for UI synchronization
    const [zoom, setZoom] = useState(1);
    const [cameraCount, setCameraCount] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [sceneSize, setSceneSize] = useState({ width: 3000, height: 5000 });
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [previewConfig, setPreviewConfig] = useState<SceneConfig | null>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const whiteboardInstance = useRef<Whiteboard | null>(null);

    // Initial configuration
    const initialConfig: SceneConfig = {
        id: 'demo-scene',
        name: 'Demo Scene',
        width: 3000,
        height: 5000,
        background: {
            color: '#ffffff',
            grid: {
                type: 'dots',
                size: 50,
                color: '#cbd5e0',
                opacity: 0.3
            }
        },
        cameras: [
            {
                id: 'default-camera',
                name: 'Caméra Principale',
                position: { x: 1500, y: 2500 },
                width: 800,
                height: 450,
                zoom: 1,
                locked: false,
                isDefault: true
            },
            {
                id: 'camera-2',
                name: 'Caméra Secondaire',
                position: { x: 750, y: 1250 },
                width: 640,
                height: 360,
                zoom: 1.5,
                locked: false,
                isDefault: false
            }
        ],
        layers: []
    };

    useEffect(() => {
        if (!canvasRef.current || !cameraControlsRef.current || !quickNavRef.current) return;

        // 1. Initialize SceneCanvas
        const sceneCanvas = new SceneCanvas(canvasRef.current, initialConfig);
        sceneCanvasInstance.current = sceneCanvas;

        // 2. Initialize CameraControls
        const cameraControls = new CameraControls({
            container: cameraControlsRef.current,
            cameras: sceneCanvas.getAllCameras(),
            selectedCameraId: null,
            virtualSize: { width: initialConfig.width, height: initialConfig.height }
        });
        cameraControlsInstance.current = cameraControls;

        // 3. Initialize QuickCameraNav
        const quickNav = new QuickCameraNav({
            container: quickNavRef.current,
            cameras: sceneCanvas.getAllCameras(),
            selectedCameraId: 'default-camera',
            position: 'top-right'
        });
        quickNavInstance.current = quickNav;

        // Setup Callbacks
        sceneCanvas.setCallbacks({
            onCameraSelect: (camera) => {
                const id = camera ? camera.id : null;
                setSelectedCameraId(id);
                cameraControls.setSelectedCamera(id);
                quickNav.setSelectedCamera(id);
                if (camera) sceneCanvas.focusToCamera(camera.id);
            },
            onCameraChange: () => {
                const cameras = sceneCanvas.getAllCameras();
                cameraControls.updateCameras(cameras);
                quickNav.updateCameras(cameras);
                setCameraCount(cameras.length);
            },
            onZoomChange: (z) => setZoom(z),
            onLayerSelect: (layerId) => setSelectedId(layerId),
            onHistoryChange: (undo, redo) => {
                setCanUndo(undo);
                setCanRedo(redo);
            }
        });

        cameraControls.setCallbacks({
            onCameraSelect: (id) => {
                sceneCanvas.selectCamera(id);
                setSelectedCameraId(id);
                quickNav.setSelectedCamera(id);
                if (id) sceneCanvas.focusToCamera(id);
            },
            onCameraAdd: () => {
                const id = `camera-${Date.now()}`;
                const newCamera: Camera = {
                    id,
                    name: `Caméra ${sceneCanvas.getAllCameras().length + 1}`,
                    position: { x: initialConfig.width / 2, y: initialConfig.height / 2 },
                    width: 800,
                    height: 450,
                    zoom: 1,
                    locked: false,
                    isDefault: false
                };
                sceneCanvas.addCamera(newCamera);
                cameraControls.updateCameras(sceneCanvas.getAllCameras());
                quickNav.updateCameras(sceneCanvas.getAllCameras());
                setCameraCount(sceneCanvas.getAllCameras().length);
            },
            onCameraRemove: (id) => {
                sceneCanvas.removeCamera(id);
                cameraControls.updateCameras(sceneCanvas.getAllCameras());
                quickNav.updateCameras(sceneCanvas.getAllCameras());
                setCameraCount(sceneCanvas.getAllCameras().length);
            },
            onCameraDuplicate: (id) => {
                sceneCanvas.duplicateCamera(id);
                cameraControls.updateCameras(sceneCanvas.getAllCameras());
                quickNav.updateCameras(sceneCanvas.getAllCameras());
                setCameraCount(sceneCanvas.getAllCameras().length);
            },
            onCameraUpdate: (id, updates) => {
                sceneCanvas.updateCamera(id, updates);
            },
            onVirtualSizeUpdate: (w, h) => {
                sceneCanvas.updateScene({ width: w, height: h });
                setSceneSize({ width: w, height: h });
            }
        });

        quickNav.setCallbacks({
            onNavigateToCamera: (id) => {
                sceneCanvas.focusToCamera(id);
                sceneCanvas.selectCamera(id);
                cameraControls.setSelectedCamera(id);
                setSelectedCameraId(id);
            }
        });

        // Focus default camera
        setTimeout(() => sceneCanvas.focusDefaultCamera(), 100);

        return () => {
            // Cleanup engine instances if they have destroy methods
            // (Assuming they might since they manipulate DOM)
            if (cameraControlsInstance.current?.destroy) cameraControlsInstance.current.destroy();
            if (quickNavInstance.current?.destroy) quickNavInstance.current.destroy();
        };
    }, []);

    // Toolbar Actions
    const handleExport = () => {
        if (!sceneCanvasInstance.current) return;
        const config = {
            scene: sceneCanvasInstance.current.getConfig(),
            cameras: sceneCanvasInstance.current.getAllCameras()
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'camera-configuration.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const addShape = () => {
        sceneCanvasInstance.current?.addShapeLayer({
            id: `shape-${Date.now()}`,
            shape: 'rectangle' as any,
            width: 200,
            height: 150,
            fillColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
            strokeColor: '#2d3748',
            strokeWidth: 3,
            type: 'shape'
        });
    };

    const addText = () => {
        sceneCanvasInstance.current?.addTextLayer({
            id: `text-${Date.now()}`,
            text_config: {
                text: 'Nouveau Texte',
                size: 60,
                color: '#4a5568',
                align: 'center'
            },
            type: 'text' as any
        });
    };

    const addImage = async () => {
        await sceneCanvasInstance.current?.addImageLayer({
            id: `image-${Date.now()}`,
            image_path: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=300&fit=crop',
            width: 400,
            height: 300,
            type: 'image' as any
        });
    };

    const addSvg = async () => {
        const heartSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZTUzZTNlIj48cGF0aCBkPSJNMTIgMjEuMzVsLTEuNDUtMS4zMkM1LjQgMTUuMzYgMiAxMi4yNyAyIDguNUNhNS41IDUuNSAwIDAgMSA1LjUtNS41Yy4zIDAgNi4xIDIuMDIgOC41IDUuMTJDMTUuMTQgMy41MiAxOS4yMyAzIDIyIDIyYTUuNSA1LjUgMCAwIDEgNSu1IDUuNWMwIDMuNzctMy40IDYuODYtOC41NSAxMS41NEwxMiAyMS4zNXoiLz48L3N2Zz4=';
        await sceneCanvasInstance.current?.addSvgLayer({
            id: `svg-${Date.now()}`,
            svg_path: heartSvg,
            scale: 2.0,
            type: 'svg' as any
        });
    };

    const handlePreview = () => {
        if (!sceneCanvasInstance.current) return;
        const currentConfig = sceneCanvasInstance.current.getConfig();
        setPreviewConfig(currentConfig);
        setIsPreview(true);
    };

    const closePreview = () => {
        setIsPreview(false);
        setPreviewConfig(null);
    };

    // Dedicated useEffect for preview lifecycle - ensures DOM is ready
    useEffect(() => {
        if (!isPreview || !previewConfig) return;

        // Small delay to ensure React has rendered the container
        const timeoutId = setTimeout(() => {
            console.log('wwww')
            if (!previewContainerRef.current) {
                console.warn('[Preview] Container ref not available');
                return;
            }

            // Initialize Whiteboard for preview
            const wb = new Whiteboard({
                containerId: 'preview-whiteboard-container',
                width: 1280,
                height: 720,
                debug: false,
                background: previewConfig.background?.color || '#ffffff'
            });


            whiteboardInstance.current = wb;

            // Map Editor Scene to Whiteboard Scene
            console.log('[Preview] Config layers:', previewConfig.layers);
            console.log('[Preview] Config cameras:', previewConfig.cameras);
            wb.addStoreScenes([{
                id: previewConfig.id,
                background: previewConfig.background?.color || '#ffffff',
                sceneWidth: previewConfig.width,
                sceneHeight: previewConfig.height,
                layers: previewConfig.layers,
                sceneCameras: previewConfig.cameras ? previewConfig.cameras.map(cam => ({
                    id: cam.id,
                    startTime: 0,
                    name: cam.name,
                    position: cam.position,
                    zoom: cam.zoom,
                    locked: cam.locked,
                    size: {
                        width: cam.width,
                        height: cam.height
                    }
                })) : []
            }], 'single').then(() => {
                console.log('ittttttt')
                wb.play();
            });
        }, 50);

        return () => {
            clearTimeout(timeoutId);
            if (whiteboardInstance.current) {
                whiteboardInstance.current.destroy();
                whiteboardInstance.current = null;
            }
        };
    }, [isPreview, previewConfig]);

    return (
        <div className="flex h-screen w-full bg-[#f0f4f8] overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-[#e2e8f0] flex flex-col overflow-hidden">
                <header className="p-5 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
                    <h1 className="text-xl font-bold mb-1">📷 Éditeur de Caméras</h1>
                    <p className="text-xs opacity-90">Gérez plusieurs caméras pour des scènes immenses</p>
                </header>

                <div className="flex-1 overflow-y-auto" ref={cameraControlsRef}>
                    {/* CameraControls will be injected here */}
                </div>

                <div className="p-5 bg-[#f7fafc] border-t border-[#e2e8f0]">
                    <div className="flex justify-between py-1 text-sm text-[#4a5568]">
                        <span className="font-semibold">Scène:</span>
                        <span className="text-[#667eea]">{sceneSize.width}×{sceneSize.height}px</span>
                    </div>
                    <div className="flex justify-between py-1 text-sm text-[#4a5568]">
                        <span className="font-semibold">Caméras:</span>
                        <span className="text-[#667eea]">{cameraCount}</span>
                    </div>
                    <div className="flex justify-between py-1 text-sm text-[#4a5568]">
                        <span className="font-semibold">Sélection:</span>
                        <span className="text-[#667eea] truncate max-w-[120px]">{selectedId || 'Aucune'}</span>
                    </div>
                </div>

                <div className="p-5 bg-[#2d3748] border-t border-[#e2e8f0] text-white">
                    <h1 className="text-lg font-bold">🛠️ Propriétés</h1>
                </div>

                {selectedId && (
                    <div className="p-5 bg-[#f7fafc] border-t border-[#e2e8f0] space-y-3">
                        <button
                            className="w-full py-2 bg-[#667eea] hover:bg-[#5568d3] text-white rounded-md text-sm transition-colors"
                            onClick={() => sceneCanvasInstance.current?.updateLayer(selectedId, { scale: 2 })}
                        >
                            🔍 Doubler la Taille
                        </button>
                        <button
                            className="w-full py-2 border border-[#feb2b2] text-[#e53e3e] hover:bg-[#fff5f5] rounded-md text-sm transition-colors"
                            onClick={() => {
                                sceneCanvasInstance.current?.removeLayer(selectedId);
                                setSelectedId(null);
                            }}
                        >
                            🗑️ Supprimer le Calque
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Toolbar */}
                <nav className="flex justify-between items-center px-5 py-3 bg-white border-b border-[#e2e8f0] shadow-sm z-10">
                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 bg-[#667eea] hover:bg-[#5568d3] text-white rounded-md text-sm transition-colors"
                            onClick={handleExport}
                        >
                            💾 Exporter
                        </button>
                        <button
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors flex items-center gap-2"
                            onClick={handlePreview}
                        >
                            ▶️ Play
                        </button>
                        <div className="h-6 w-[1px] bg-[#cbd5e0] mx-2" />
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md text-sm transition-all" onClick={addShape}>🟦 Forme</button>
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md text-sm transition-all" onClick={addImage}>🖼️ Image</button>
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md text-sm transition-all" onClick={addSvg}>🎨 SVG</button>
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md text-sm transition-all" onClick={addText}>🔤 Texte</button>
                        <div className="h-6 w-[1px] bg-[#cbd5e0] mx-2" />
                        <button
                            className={`p-2 border border-[#cbd5e0] rounded-md transition-all ${!canUndo ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#667eea]'}`}
                            onClick={() => sceneCanvasInstance.current?.undo()}
                            disabled={!canUndo}
                        >↩️</button>
                        <button
                            className={`p-2 border border-[#cbd5e0] rounded-md transition-all ${!canRedo ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#667eea]'}`}
                            onClick={() => sceneCanvasInstance.current?.redo()}
                            disabled={!canRedo}
                        >↪️</button>
                        <div className="h-6 w-[1px] bg-[#cbd5e0] mx-2" />
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.copy()} title="Copier">📋</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.paste()} title="Coller">📌</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.cut()} title="Couper">✂️</button>
                        <div className="h-6 w-[1px] bg-[#cbd5e0] mx-2" />
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.toggleLock()} title="Verrouiller">🔒</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.flipHorizontal()} title="Miroir Horizontal">↔️</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.flipVertical()} title="Miroir Vertical">↕️</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.bringToFront()} title="Mettre au premier plan">⬆️</button>
                        <button className="p-2 border border-[#cbd5e0] hover:border-[#667eea] rounded-md transition-all" onClick={() => sceneCanvasInstance.current?.sendToBack()} title="Mettre en arrière plan">⬇️</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2 border border-[#cbd5e0] hover:bg-gray-50 rounded-md" onClick={() => sceneCanvasInstance.current?.zoomOut()}>🔍-</button>
                        <span className="text-sm font-bold text-[#4a5568] min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
                        <button className="p-2 border border-[#cbd5e0] hover:bg-gray-50 rounded-md" onClick={() => sceneCanvasInstance.current?.zoomIn()}>🔍+</button>
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:bg-gray-50 rounded-md text-sm" onClick={() => sceneCanvasInstance.current?.fitToViewport()}>📐 Ajuster</button>
                        <button className="px-3 py-2 border border-[#cbd5e0] hover:bg-gray-50 rounded-md text-sm" onClick={() => sceneCanvasInstance.current?.focusDefaultCamera()}>🎯 Reset</button>
                    </div>
                </nav>

                {/* Canvas Area */}
                <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center overflow-hidden">
                    {/* Quick Nav Container */}
                    <div ref={quickNavRef} />

                    {/* Help Text */}
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-white text-xs text-[#4a5568] max-w-xl text-center z-10 pointer-events-none">
                        💡 <strong>Astuces:</strong>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
                            <span>Annuler: <kbd className="bg-[#f7fafc] border border-[#cbd5e0] rounded px-1 font-mono">Ctrl+Z</kbd></span>
                            <span>Espace + Glisser: Déplacer la scène</span>
                            <span>Molette: Zoom</span>
                            <span>Double-clic: Ajouter texte</span>
                        </div>
                    </div>

                    {/* Konva Canvas Container */}
                    <div id="scene-canvas" className="w-full h-full bg-white" ref={canvasRef} />
                </div>

                {/* Preview Overlay */}
                {isPreview && (
                    <div className="absolute inset-0 z-[1000] bg-black/90 flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
                        <div className="relative bg-white shadow-2xl rounded-lg overflow-hidden" style={{ width: 1280, height: 720 }}>
                            <div id="preview-whiteboard-container" ref={previewContainerRef} className="w-full h-full" />

                            <button
                                onClick={closePreview}
                                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all z-[1001]"
                            >
                                ✕ Fermer
                            </button>
                        </div>
                        <div className="mt-6 text-white text-lg font-medium">Prévisualisation de l'animation</div>
                    </div>
                )}
            </main>
        </div>
    );
}
