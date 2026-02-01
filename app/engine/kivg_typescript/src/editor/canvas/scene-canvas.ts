import Konva from 'konva';
import { KonvaBackground, type KonvaBackgroundConfig } from './konva-background';
import { EditorCamera, type CameraConfig } from './konva-camera';
import { ImageLayer, type ImageLayerConfig } from './layer-image';
import { SvgLayer, type SvgLayerConfig } from './layer-svg';
import { TextLayer, type TextLayerConfig } from './layer-text';
import { ShapeLayer, type ShapeLayerConfig } from './layer-shape';
import { ZoomControls } from './zoom-controls';
import { Scrollbars } from './scrollbars';
import { LoadingManager } from '../../frontend/core/infra/loading';
import { TextEditor } from './text-editor';
import { HistoryManager, Command, AddLayerCommand, RemoveLayerCommand, UpdateLayerCommand, TransformLayerCommand } from './history';
import { ClipboardManager } from './clipboard';
import { SmartGuides, type ElementBounds } from './smart-guides';


// ============================================================================
// Types
// ============================================================================

export interface Position {
    x: number;
    y: number;
}

export interface Camera {
    id: string;
    name?: string;
    position: Position; // Absolute position in pixels relative to scene (top-left)
    width?: number;
    height?: number;
    zoom?: number;
    duration?: number;
    transition_duration?: number;
    easing?: string;
    locked?: boolean;
    isDefault?: boolean;
    scale?: number;
    color?: string; // Border color for this camera (hex format)
}

export interface BackgroundConfig {
    color?: string;
    grid?: {
        type: 'dots' | 'lines' | 'squares' | 'hexagonal' | 'isometric';
        size?: number;
        color?: string;
        opacity?: number;
        lineWidth?: number;
    };
    template?: {
        src: string;
        opacity?: number;
    };
}

export type LayerType = 'image' | 'text' | 'svg' | 'shape';

export interface BaseLayerConfig {
    id: string;
    name?: string;
    type: LayerType;
    position?: Position;
    width?: number;
    height?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
    z_index?: number;
    locked?: boolean;
    flipX?: boolean;
    flipY?: boolean;
}

export interface SceneConfig {
    id: string;
    name?: string;
    width: number;
    height: number;
    background?: BackgroundConfig;
    cameras?: Camera[];
    layers?: BaseLayerConfig[];
}

export interface SceneCanvasCallbacks {
    onLayerSelect?: (layerId: string | null) => void;
    onLayerAdd?: (layer: BaseLayerConfig) => void;
    onLayerRemove?: (layerId: string) => void;
    onLayerChange?: (layer: BaseLayerConfig) => void;
    onCameraSelect?: (camera: Camera | null) => void;
    onCameraChange?: (camera: Camera) => void;
    onSceneChange?: (scene: Partial<SceneConfig>) => void;
    onZoomChange?: (zoom: number) => void;
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

// ============================================================================
// Layer Instance Types (union of all layer classes)
// ============================================================================

type LayerInstance = ImageLayer | SvgLayer | TextLayer | ShapeLayer;

// ============================================================================
// Loading Messages Constants
// ============================================================================

const LOADING_MESSAGES = {
    IMAGE: {
        START: 'Initialisation de l\'image...',
        PREPARE: 'Préparation du layer...',
        LOADING: 'Chargement de l\'image...',
        FINALIZE: 'Finalisation...'
    },
    SVG: {
        START: 'Initialisation du SVG...',
        PREPARE: 'Préparation du layer...',
        LOADING: 'Chargement du SVG...',
        FINALIZE: 'Finalisation...'
    }
} as const;

// ============================================================================
// SceneCanvas Class
// ============================================================================

/**
 * Pure Konva.js class for rendering and managing a complete scene canvas.
 * Replaces the React-based SceneCanvas component.
 */
export class SceneCanvas {
    private container: HTMLDivElement;
    private stage: Konva.Stage;
    private backgroundLayer: Konva.Layer;
    private cameraLayer: Konva.Layer;
    private contentLayer: Konva.Layer;

    private background: KonvaBackground | null = null;
    private cameras: Map<string, EditorCamera> = new Map();
    private layers: Map<string, LayerInstance> = new Map();

    private config: SceneConfig;
    private callbacks: SceneCanvasCallbacks = {};

    private selectedLayerId: string | null = null;
    private selectedLayerIds: Set<string> = new Set();
    private selectedCameraId: string | null = null;
    private sceneZoom: number = 1.0;
    private isDraggingOver: boolean = false;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
    private spacePressed: boolean = false;
    private ctrlPressed: boolean = false;
    private zoomControls: ZoomControls | null = null;
    private scrollbars: Scrollbars | null = null;

    private historyManager: HistoryManager;
    private clipboardManager: ClipboardManager;
    private smartGuides: SmartGuides;

    private autoScrollRequestId: number | null = null;
    private autoScrollVelocity: Position = { x: 0, y: 0 };
    private targetAutoScrollVelocity: Position = { x: 0, y: 0 };
    private viewportTracker: HTMLDivElement | null = null;
    private loadingManager: LoadingManager;

    // Selection box for drag-to-select
    private selectionBox: Konva.Rect | null = null;
    private selectionLayer: Konva.Layer | null = null;
    private isSelecting: boolean = false;
    private selectionStart: Position | null = null;

    // Color palette for camera borders
    private static readonly CAMERA_COLORS = [
        '#f9a8d4', // Pink (original)
        '#60a5fa', // Blue
        '#34d399', // Green
        '#fbbf24', // Yellow
        '#f87171', // Red
        '#a78bfa', // Purple
        '#fb923c', // Orange
        '#2dd4bf', // Teal
        '#c084fc', // Lavender
        '#fb7185', // Rose
    ];
    private nextColorIndex: number = 0;

    constructor(container: string | HTMLDivElement, config: SceneConfig, callbacks?: SceneCanvasCallbacks) {
        if (typeof container === 'string') {
            const element = document.getElementById(container);
            if (!element) {
                throw new Error(`Container element with id '${container}' not found`);
            }
            this.container = element as HTMLDivElement;
        } else {
            this.container = container;
        }

        this.config = config;
        if (callbacks) {
            this.callbacks = callbacks;
        }

        // Get loading manager instance (UI is created automatically)
        this.loadingManager = LoadingManager.getInstance();

        // Create Konva Stage - Fixed at (0,0)
        this.stage = new Konva.Stage({
            container: this.container,
            width: this.container.clientWidth || config.width,
            height: this.container.clientHeight || config.height,
            draggable: false
        });


        // Add resize observer to keep stage sized to container
        this.setupResizeObserver();

        // Create layers
        this.backgroundLayer = new Konva.Layer();
        this.cameraLayer = new Konva.Layer();
        this.contentLayer = new Konva.Layer();
        this.selectionLayer = new Konva.Layer();

        this.stage.add(this.backgroundLayer);
        this.stage.add(this.cameraLayer);
        this.stage.add(this.contentLayer);
        this.stage.add(this.selectionLayer);

        // Initialize selection box
        this.initSelectionBox();

        // Initialize background
        this.initBackground();

        // Initialize cameras
        this.initCameras();

        // Setup event handlers
        this.setupEventHandlers();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup drag & drop
        this.setupDragAndDrop();

        // Initialize zoom controls
        this.initZoomControls();

        // Initialize scrollbars
        this.initScrollbars();

        // Initialize minimap


        // Create viewport tracker
        this.initViewportTracker();

        // Initialize History and Clipboard
        this.historyManager = new HistoryManager();
        this.clipboardManager = new ClipboardManager();

        // Initialize Smart Guides
        this.smartGuides = new SmartGuides({
            layer: this.selectionLayer, // Draw guides on top
            sceneWidth: this.config.width,
            sceneHeight: this.config.height,
            snapThreshold: 10,
            enabled: true
        });
    }

    public undo(): void {
        this.historyManager.undo();
        this.callbacks.onHistoryChange?.(this.canUndo(), this.canRedo());
    }

    public redo(): void {
        this.historyManager.redo();
        this.callbacks.onHistoryChange?.(this.canUndo(), this.canRedo());
    }

    public canUndo(): boolean {
        return this.historyManager.canUndo();
    }

    public canRedo(): boolean {
        return this.historyManager.canRedo();
    }

    public copy(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        const layersToCopy: BaseLayerConfig[] = [];
        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                layersToCopy.push((layer as any).config);
            }
        });
        this.clipboardManager.copy(layersToCopy);
    }

    public paste(): void {
        const newLayers = this.clipboardManager.paste();
        if (newLayers.length === 0) return;

        this.deselectAll();

        newLayers.forEach(config => {
            // We use the public methods to add layers so they get added to history
            // Wait, if we use public methods, they add to history individually.
            // Ideally paste should be a single "Macro Command" but individual is fine for now.
            // Or we treat paste as a single transaction?
            // For simplicity, let's just add them.
            switch (config.type) {
                case 'image': this.addImageLayer(config as ImageLayerConfig); break;
                case 'svg': this.addSvgLayer(config as SvgLayerConfig); break;
                case 'text': this.addTextLayer(config as TextLayerConfig); break;
                case 'shape': this.addShapeLayer(config as ShapeLayerConfig); break;
            }
            this.addToSelection(config.id);
        });
    }

    public cut(): void {
        this.copy();
        const selectedIds = this.getSelectedLayerIds();
        selectedIds.forEach(id => this.removeLayer(id));
    }

    private setupResizeObserver(): void {
        const resizeObserver = new ResizeObserver(() => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.stage.width(width);
            this.stage.height(height);

            this.stage.batchDraw();
            this.updateScrollbars();
            this.updateScrollbars();
        });
        resizeObserver.observe(this.container);

        // Store for cleanup
        (this as any)._resizeObserver = resizeObserver;
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initBackground(): void {
        const bgConfig: KonvaBackgroundConfig = {
            width: this.config.width,
            height: this.config.height,
            config: (this.config.background || { color: '#ffffff' }) as any,
        };

        this.background = new KonvaBackground(bgConfig);
        this.backgroundLayer.add(this.background.getNode());
        this.backgroundLayer.draw();
    }

    private initCameras(): void {
        const cameras = this.config.cameras || [];

        // Ensure there's a default camera
        let hasDefault = cameras.some(cam => cam.isDefault);
        if (!hasDefault) {
            const defaultCamera = this.createDefaultCamera();
            cameras.unshift(defaultCamera);
        }

        cameras.forEach(camera => {
            this.addCamera(camera);
        });
    }

    private createDefaultCamera(): Camera {
        return {
            id: 'default-camera',
            name: 'Default Camera',
            position: { x: this.config.width / 2, y: this.config.height / 2 },
            width: 800,
            height: 450,
            zoom: 1,
            duration: 2,
            transition_duration: 0,
            easing: 'ease_out',
            locked: true,
            isDefault: true,
            scale: 1,
        };
    }

    private initSelectionBox(): void {
        // Create selection rectangle (initially hidden)
        this.selectionBox = new Konva.Rect({
            fill: 'rgba(0, 123, 255, 0.1)',
            stroke: '#007bff',
            strokeWidth: 2,
            dash: [5, 5],
            visible: false,
        });

        if (this.selectionLayer) {
            this.selectionLayer.add(this.selectionBox);
        }
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    private setupEventHandlers(): void {
        // Click/drag on empty space for selection
        this.stage.on('mousedown touchstart', (e) => {
            // Only handle if clicking on the stage (not on a layer or camera)
            if (e.target === this.stage) {
                // Don't start selection if space or ctrl is pressed (panning mode)
                if (this.spacePressed || this.ctrlPressed) {
                    return;
                }

                const pointer = this.stage.getPointerPosition();
                if (!pointer) return;

                // Start selection
                this.isSelecting = true;
                this.selectionStart = pointer;

                // If not holding Ctrl, deselect all
                if (!this.isMultiSelectModifier(e)) {
                    this.deselectAll();
                }
            }
        });

        // Handle mouse move for selection box
        this.stage.on('mousemove', (e) => {
            if (!this.isSelecting || !this.selectionStart || !this.selectionBox) {
                return;
            }

            const pointer = this.stage.getPointerPosition();
            if (!pointer) return;

            // Calculate selection box dimensions
            const x = Math.min(this.selectionStart.x, pointer.x);
            const y = Math.min(this.selectionStart.y, pointer.y);
            const width = Math.abs(pointer.x - this.selectionStart.x);
            const height = Math.abs(pointer.y - this.selectionStart.y);

            // Update selection box
            this.selectionBox.setAttrs({
                x,
                y,
                width,
                height,
                visible: width > 3 || height > 3, // Only show if dragged more than 3px
            });

            this.selectionLayer?.batchDraw();
        });

        // Handle mouse up to finalize selection
        this.stage.on('mouseup touchend', (e) => {
            if (this.isSelecting && this.selectionBox && this.selectionStart) {
                const pointer = this.stage.getPointerPosition();
                if (pointer) {
                    // Calculate selection box in scene coordinates
                    const scale = this.sceneZoom;
                    const layerPos = this.contentLayer.position();

                    const x1 = Math.min(this.selectionStart.x, pointer.x);
                    const y1 = Math.min(this.selectionStart.y, pointer.y);
                    const x2 = Math.max(this.selectionStart.x, pointer.x);
                    const y2 = Math.max(this.selectionStart.y, pointer.y);

                    // Convert to scene coordinates
                    const sceneX1 = (x1 - layerPos.x) / scale;
                    const sceneY1 = (y1 - layerPos.y) / scale;
                    const sceneX2 = (x2 - layerPos.x) / scale;
                    const sceneY2 = (y2 - layerPos.y) / scale;

                    // Only perform selection if dragged more than 3px
                    const dragDistance = Math.sqrt(
                        Math.pow(pointer.x - this.selectionStart.x, 2) +
                        Math.pow(pointer.y - this.selectionStart.y, 2)
                    );

                    if (dragDistance > 3) {
                        // Find layers within selection box
                        const selectedIds: string[] = [];
                        this.layers.forEach((layer, id) => {
                            const node = layer.getNode();
                            if (!node) return;

                            // Get node bounds in scene coordinates
                            const nodeBox = node.getClientRect();
                            const nodeX1 = (nodeBox.x - layerPos.x) / scale;
                            const nodeY1 = (nodeBox.y - layerPos.y) / scale;
                            const nodeX2 = nodeX1 + nodeBox.width / scale;
                            const nodeY2 = nodeY1 + nodeBox.height / scale;

                            // Check if node intersects with selection box
                            if (!(nodeX2 < sceneX1 || nodeX1 > sceneX2 ||
                                nodeY2 < sceneY1 || nodeY1 > sceneY2)) {
                                selectedIds.push(id);
                            }
                        });

                        // Select the layers
                        if (this.isMultiSelectModifier(e)) {
                            // Add to existing selection
                            selectedIds.forEach(id => this.selectedLayerIds.add(id));
                            this.updateMultiSelection();
                        } else {
                            // Replace selection
                            this.selectLayers(selectedIds);
                        }
                    }
                }

                // Hide and reset selection box
                this.selectionBox.visible(false);
                this.selectionLayer?.batchDraw();
            }

            this.isSelecting = false;
            this.selectionStart = null;
        });

        // Double-click on empty space to create a new text layer
        this.stage.on('dblclick dbltap', (e) => {
            // Only create text if clicking on the stage (not on a layer or camera)
            if (e.target === this.stage) {
                const pointer = this.stage.getPointerPosition();
                if (!pointer) return;

                // Convert pointer position to scene coordinates
                const scale = this.sceneZoom;
                const layerPos = this.contentLayer.position();
                const sceneX = (pointer.x - layerPos.x) / scale;
                const sceneY = (pointer.y - layerPos.y) / scale;

                // Generate unique ID using timestamp + random string for uniqueness
                // Note: crypto.randomUUID is preferred when available as it provides stronger guarantees
                const generateId = (): string => {
                    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                        return `text-${crypto.randomUUID()}`;
                    }
                    // Fallback: combine timestamp with random string to minimize collision risk
                    // Even in rapid succession, Math.random() provides different values
                    return `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                };

                // Create a new text layer at the clicked position
                const newTextConfig: TextLayerConfig = {
                    id: generateId(),
                    type: 'text',
                    position: { x: sceneX, y: sceneY },
                    text_config: {
                        text: 'Nouveau Texte',
                        size: 48,
                        color: '#2d3748',
                        align: 'center'
                    }
                };

                // Add the text layer
                this.addTextLayer(newTextConfig);

                // Select the new text layer
                this.selectLayer(newTextConfig.id);

                // Wait for layer to be fully rendered and selected before opening editor
                // This ensures the text layer is ready and properly displayed
                const LAYER_RENDER_DELAY_MS = 100;
                setTimeout(() => {
                    this.openTextEditor(newTextConfig.id);
                }, LAYER_RENDER_DELAY_MS);
            }
        });

        // Pan with mouse wheel + drag or right mouse button
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();

            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();

            if (!pointer) return;

            const layerPos = this.contentLayer.position();
            const mousePointTo = {
                x: (pointer.x - layerPos.x) / oldScale,
                y: (pointer.y - layerPos.y) / oldScale,
            };

            // Zoom with mouse wheel
            const scaleBy = 1.1;
            const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

            this.sceneZoom = Math.max(0.1, Math.min(5, newScale));

            const newPos = {
                x: pointer.x - mousePointTo.x * this.sceneZoom,
                y: pointer.y - mousePointTo.y * this.sceneZoom,
            };

            this.applyTransformToLayers(newPos.x, newPos.y, this.sceneZoom);
            this.stage.batchDraw();

            // Update zoom controls display
            if (this.zoomControls) {
                this.zoomControls.updateZoom(this.sceneZoom);
            }

            if (this.callbacks.onZoomChange) {
                this.callbacks.onZoomChange(this.sceneZoom);
            }

            // Update scrollbars
            this.updateScrollbars();
        });

        // Panning with space key, ctrl key, or middle mouse button
        this.keydownHandler = (e: KeyboardEvent) => {
            // Space key for panning
            if (e.code === 'Space' && !this.spacePressed) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
                e.preventDefault();
                this.spacePressed = true;
                this.enablePanningMode(true);
            }

            // Ctrl key for panning (standard editor behavior)
            if ((e.key === 'Control' || e.ctrlKey) && !this.ctrlPressed) {
                this.ctrlPressed = true;
                this.enablePanningMode(true);
            }
        };

        this.keyupHandler = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                // Only disable dragging if ctrl is also not pressed
                if (!this.ctrlPressed) {
                    this.enablePanningMode(false);
                }
            }

            if (e.key === 'Control') {
                this.ctrlPressed = false;
                // Only disable dragging if space is also not pressed
                if (!this.spacePressed) {
                    this.enablePanningMode(false);
                }
            }
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);

        // Handle middle mouse button for panning
        this.stage.on('mousedown', (e) => {
            if (e.evt.button === 1) { // Middle mouse button
                e.evt.preventDefault();
                this.enablePanningMode(true);
                this.container.style.cursor = 'grabbing';
            }
        });

        this.stage.on('mouseup', (e) => {
            if (e.evt.button === 1) {
                // If space or ctrl is not pressed, disable panning mode
                if (!this.spacePressed && !this.ctrlPressed) {
                    this.enablePanningMode(false);
                } else {
                    this.container.style.cursor = 'grab';
                }
            }
        });

        // Update cursor during drag
        this.stage.on('dragstart', () => {
            this.container.style.cursor = 'grabbing';
        });

        this.stage.on('dragend', () => {
            // Restore cursor based on whether space or ctrl is still pressed
            this.container.style.cursor = (this.spacePressed || this.ctrlPressed) ? 'grab' : 'default';
            // Update scrollbars after pan
            this.updateScrollbars();
        });

        this.setupAutoScroll();
    }

    private setupAutoScroll(): void {
        this.stage.on('dragmove', (e) => {
            // If the stage itself is being dragged (panning), don't auto-scroll
            if (e.target === this.stage) {
                this.stopAutoScroll();
                return;
            }

            const pointerPos = this.stage.getPointerPosition();
            if (!pointerPos) return;

            const margin = 50;
            const maxSpeed = 20;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            let vx = 0;
            let vy = 0;

            // Calculate horizontal velocity
            if (pointerPos.x < margin) {
                vx = -maxSpeed * (1 - Math.max(0, pointerPos.x) / margin);
            } else if (pointerPos.x > width - margin) {
                vx = maxSpeed * (1 - Math.max(0, width - pointerPos.x) / margin);
            }

            // Calculate vertical velocity
            if (pointerPos.y < margin) {
                vy = -maxSpeed * (1 - Math.max(0, pointerPos.y) / margin);
            } else if (pointerPos.y > height - margin) {
                vy = maxSpeed * (1 - Math.max(0, height - pointerPos.y) / margin);
            }

            if (vx !== 0 || vy !== 0) {
                this.targetAutoScrollVelocity = { x: vx, y: vy };
                this.startAutoScroll();
            } else {
                this.targetAutoScrollVelocity = { x: 0, y: 0 };
            }
        });

        this.stage.on('dragend', () => {
            this.stopAutoScroll();
        });
    }

    private startAutoScroll(): void {
        if (this.autoScrollRequestId !== null) return;

        const scroll = () => {
            // Smoothly interpolate current velocity towards target velocity
            const lerp = 0.15;
            this.autoScrollVelocity.x += (this.targetAutoScrollVelocity.x - this.autoScrollVelocity.x) * lerp;
            this.autoScrollVelocity.y += (this.targetAutoScrollVelocity.y - this.autoScrollVelocity.y) * lerp;

            // If velocity is negligible and target is zero, stop the loop
            if (Math.abs(this.autoScrollVelocity.x) < 0.1 &&
                Math.abs(this.autoScrollVelocity.y) < 0.1 &&
                this.targetAutoScrollVelocity.x === 0 &&
                this.targetAutoScrollVelocity.y === 0) {
                this.stopAutoScroll();
                return;
            }

            const currentLayerPos = this.contentLayer.position();
            const newPos = {
                x: currentLayerPos.x - this.autoScrollVelocity.x,
                y: currentLayerPos.y - this.autoScrollVelocity.y
            };

            // Apply clamping (similar to stage movement but for layers)
            const sceneScale = this.sceneZoom;
            const containerWidth = this.container.clientWidth;
            const containerHeight = this.container.clientHeight;
            const sceneWidth = this.config.width * sceneScale;
            const sceneHeight = this.config.height * sceneScale;

            if (sceneWidth > containerWidth) {
                newPos.x = Math.max(containerWidth - sceneWidth, Math.min(0, newPos.x));
            } else {
                newPos.x = (containerWidth - sceneWidth) / 2;
            }

            if (sceneHeight > containerHeight) {
                newPos.y = Math.max(containerHeight - sceneHeight, Math.min(0, newPos.y));
            } else {
                newPos.y = (containerHeight - sceneHeight) / 2;
            }

            this.applyTransformToLayers(newPos.x, newPos.y, this.sceneZoom);
            this.updateScrollbars();
            this.autoScrollRequestId = requestAnimationFrame(scroll);
        };

        this.autoScrollRequestId = requestAnimationFrame(scroll);
    }

    private stopAutoScroll(): void {
        if (this.autoScrollRequestId !== null) {
            cancelAnimationFrame(this.autoScrollRequestId);
            this.autoScrollRequestId = null;
        }
    }

    private enablePanningMode(enabled: boolean): void {
        // We handle panning by moving layers, but we need to capture drag events
        // Konva's 'draggable' on stage moves the stage. We want to move layers instead.
        // So we'll disable Konva's built-in drag and implement our own for panning.

        if (enabled) {
            this.container.style.cursor = 'grab';

            let lastPos: { x: number; y: number } | null = null;

            const handleMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
                const pos = this.stage.getPointerPosition();
                if (!pos || !lastPos) {
                    lastPos = pos;
                    return;
                }

                const dx = pos.x - lastPos.x;
                const dy = pos.y - lastPos.y;
                const layerPos = this.contentLayer.position();

                this.setPan(layerPos.x + dx, layerPos.y + dy);
                lastPos = pos;
            };

            const handleUp = () => {
                this.stage.off('mousemove', handleMove);
                window.removeEventListener('mouseup', handleUp);
                lastPos = null;
                if (!this.spacePressed && !this.ctrlPressed) {
                    this.enablePanningMode(false);
                } else {
                    this.container.style.cursor = 'grab';
                }
            };

            this.stage.on('mousedown', () => {
                lastPos = this.stage.getPointerPosition();
                this.container.style.cursor = 'grabbing';
                this.stage.on('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
            });
        }

        // Disable interactivity on content and camera layers to prevent accidental selection
        this.contentLayer.listening(!enabled);
        this.cameraLayer.listening(!enabled);

        if (!enabled) {
            this.container.style.cursor = 'default';
            this.stage.off('mousedown');
            this.stage.off('mousemove');
        }
    }

    private setupKeyboardShortcuts(): void {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Delete or Backspace - delete selected layers
            if ((e.key === 'Delete' || e.key === 'Backspace') &&
                (this.selectedLayerId || this.selectedLayerIds.size > 0)) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }

                e.preventDefault();

                // Delete all selected layers
                if (this.selectedLayerIds.size > 0) {
                    const layersToDelete = Array.from(this.selectedLayerIds);
                    layersToDelete.forEach(id => this.removeLayer(id));
                } else if (this.selectedLayerId) {
                    this.removeLayer(this.selectedLayerId);
                }
            }

            // Undo (Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }

            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z' || e.key === 'Z'))) {
                e.preventDefault();
                this.redo();
            }

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // Don't trigger if in input
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

                e.preventDefault();
                this.copy();
            }

            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                // Don't trigger if in input
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

                e.preventDefault();
                this.paste();
            }

            // Cut (Ctrl+X)
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                // Don't trigger if in input
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

                e.preventDefault();
                this.cut();
            }

            // Escape - deselect all
            if (e.key === 'Escape') {
                this.deselectAll();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
    }

    private setupDragAndDrop(): void {
        this.container.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.isDraggingOver = true;
            this.container.classList.add('drag-over');
        });

        this.container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            const rect = this.container.getBoundingClientRect();
            const isOutside =
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom;

            if (isOutside) {
                this.isDraggingOver = false;
                this.container.classList.remove('drag-over');
            }
        });

        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.isDraggingOver = false;
            this.container.classList.remove('drag-over');
            this.handleDrop(e);
        });
    }

    private handleDrop(e: DragEvent): void {
        if (!e.dataTransfer) return;

        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (!jsonData) return;

            const data = JSON.parse(jsonData);
            const dropPos = this.getDropPosition(e.clientX, e.clientY);

            if (data.type === 'image' && data.url) {
                this.addImageLayer({
                    id: `image-${Date.now()}`,
                    type: 'image',
                    image_path: data.url,
                    position: dropPos,
                    scale: data.scale || 1,
                });
            } else if (data.type === 'shape' && data.shape) {
                this.addShapeLayer({
                    id: `shape-${Date.now()}`,
                    type: 'shape',
                    shape: data.shape.type || 'rectangle',
                    position: dropPos,
                    width: data.shape.width || 100,
                    height: data.shape.height || 100,
                    fillColor: data.shape.fillColor || '#3b82f6',
                    strokeColor: data.shape.strokeColor || '#1e40af',
                    strokeWidth: data.shape.strokeWidth || 2,
                });
            }
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }

    public getDropPosition(clientX: number, clientY: number): Position {
        const rect = this.container.getBoundingClientRect();
        // Layers have the transformation, Stage is at (0,0)
        const layerPos = this.contentLayer.position();
        return {
            x: (clientX - rect.left - layerPos.x) / this.sceneZoom,
            y: (clientY - rect.top - layerPos.y) / this.sceneZoom,
        };
    }

    /**
     * Get the top-left corner of the currently visible viewport area in scene coordinates.
     * This represents the current viewport position in the scene.
     */
    public getViewportPosition(): Position {
        const layerPos = this.contentLayer.position();
        return {
            x: -layerPos.x / this.sceneZoom,
            y: -layerPos.y / this.sceneZoom,
        };
    }

    /**
     * Get the center of the currently visible viewport area in scene coordinates.
     */
    public getViewportCenter(): Position {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        const layerPos = this.contentLayer.position();

        return {
            x: (containerWidth / 2 - layerPos.x) / this.sceneZoom,
            y: (containerHeight / 2 - layerPos.y) / this.sceneZoom,
        };
    }

    /**
     * Get the next color from the camera color palette
     */
    private getNextCameraColor(): string {
        const color = SceneCanvas.CAMERA_COLORS[this.nextColorIndex];
        this.nextColorIndex = (this.nextColorIndex + 1) % SceneCanvas.CAMERA_COLORS.length;
        return color;
    }

    // ========================================================================
    // Camera Management
    // ========================================================================

    public addCamera(camera: Camera): void {
        // If position is missing OR is exactly {0,0}, use the current viewport position (center)
        if (!camera.position || (camera.position.x === 0 && camera.position.y === 0)) {
            camera.position = this.getViewportCenter();
        }

        // Assign a color if not provided (skip default camera to keep original color)
        if (!camera.color && !camera.isDefault) {
            camera.color = this.getNextCameraColor();
        }

        // Clamp camera to scene boundaries
        const clampedCamera = this.clampCameraToScene(camera);

        // Store the camera config
        this.cameraConfigs.set(clampedCamera.id, clampedCamera);

        const editorCamera = new EditorCamera(
            clampedCamera as CameraConfig,
            this.config.width,
            this.config.height
        );

        editorCamera.setCallbacks({
            onUpdate: (cameraId: string, updates: Partial<CameraConfig>) => {
                this.updateCamera(cameraId, updates);
            },
            onSelect: () => {
                this.selectCamera(camera.id);
            },
        });

        this.cameras.set(camera.id, editorCamera);

        const node = editorCamera.getNode();
        if (node) {
            this.cameraLayer.add(node);
        }
        this.cameraLayer.add(editorCamera.getTransformer());
        this.cameraLayer.draw();
    }

    public removeCamera(cameraId: string): void {
        const camera = this.cameras.get(cameraId);
        if (camera) {
            camera.destroy();
            this.cameras.delete(cameraId);
            this.cameraConfigs.delete(cameraId);
            this.cameraLayer.draw();

            if (this.selectedCameraId === cameraId) {
                this.selectedCameraId = null;
            }
        }
    }

    public selectCamera(cameraId: string | null): void {
        // Deselect all cameras
        this.cameras.forEach((cam, id) => {
            cam.setSelected(id === cameraId);
        });

        this.selectedCameraId = cameraId;

        // Deselect layers when selecting camera
        if (cameraId) {
            this.selectLayer(null);
        }

        if (this.callbacks.onCameraSelect) {
            const camera = cameraId ? this.getCameraConfig(cameraId) : null;
            this.callbacks.onCameraSelect(camera);
        }
    }

    private cameraConfigs: Map<string, Camera> = new Map();

    public getCameraConfig(cameraId: string): Camera | null {
        return this.cameraConfigs.get(cameraId) || null;
    }

    public getAllCameras(): any[] {
        return Array.from(this.cameras.values()).map(cam => cam.getConfig());
    }

    public getAllLayers(): BaseLayerConfig[] {
        return Array.from(this.layers.values()).map(layer => (layer as any).config);
    }

    public updateCamera(cameraId: string, updates: Partial<Camera>): void {
        const existingConfig = this.cameraConfigs.get(cameraId);
        if (!existingConfig) return;

        const updatedCamera = this.clampCameraToScene({ ...existingConfig, ...updates });
        this.cameraConfigs.set(cameraId, updatedCamera);

        const editorCamera = this.cameras.get(cameraId);
        if (editorCamera) {
            editorCamera.update(updatedCamera as any);
            this.cameraLayer.draw();
        }

        if (this.callbacks.onCameraChange) {
            this.callbacks.onCameraChange(updatedCamera);
        }
    }

    public duplicateCamera(cameraId: string): Camera | null {
        const existingCamera = this.cameraConfigs.get(cameraId);
        if (!existingCamera) return null;

        // Generate unique ID using crypto.randomUUID() if available, fallback to timestamp + random
        const generateId = (): string => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return `camera-${crypto.randomUUID()}`;
            }
            return `camera-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        };

        const newCamera: Camera = {
            ...existingCamera,
            id: generateId(),
            name: `${existingCamera.name || 'Camera'} (Copy)`,
            isDefault: false,
            color: undefined, // Remove color so a new one is assigned
            position: {
                x: Math.min(this.config.width, existingCamera.position.x + 50),
                y: Math.min(this.config.height, existingCamera.position.y + 50),
            },
        };

        this.addCamera(newCamera);
        return newCamera;
    }

    /**
     * Clamp camera to scene boundaries
     */
    private clampCameraToScene(camera: Camera): Camera {
        const width = camera.width || 800;
        const height = camera.height || 450;

        // Ensure camera size doesn't exceed scene size
        const clampedWidth = Math.min(width, this.config.width);
        const clampedHeight = Math.min(height, this.config.height);

        // Position is now directly in pixels (center)
        let centerX = camera.position.x;
        let centerY = camera.position.y;

        // Calculate min/max allowed pixel positions for the center
        const halfWidth = clampedWidth / 2;
        const halfHeight = clampedHeight / 2;

        const minCenterX = halfWidth;
        const maxCenterX = this.config.width - halfWidth;
        const minCenterY = halfHeight;
        const maxCenterY = this.config.height - halfHeight;

        // Clamp pixel position
        centerX = Math.max(minCenterX, Math.min(maxCenterX, centerX));
        centerY = Math.max(minCenterY, Math.min(maxCenterY, centerY));

        return {
            ...camera,
            width: clampedWidth,
            height: clampedHeight,
            position: {
                x: centerX,
                y: centerY
            }
        };
    }

    // ========================================================================
    // Layer Management
    // ========================================================================

    // ========================================================================
    // Internal Layer Operations (Used by Commands)
    // ========================================================================

    public addLayerInternal(config: BaseLayerConfig): void {
        switch (config.type) {
            case 'shape':
                this.addShapeLayerInternal(config as ShapeLayerConfig);
                break;
            case 'text':
                this.addTextLayerInternal(config as TextLayerConfig);
                break;
            case 'image':
                this.addImageLayerInternal(config as ImageLayerConfig);
                break;
            case 'svg':
                this.addSvgLayerInternal(config as SvgLayerConfig);
                break;
        }
    }

    public removeLayerInternal(layerId: string): void {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.destroy();
            this.layers.delete(layerId);

            if (this.selectedLayerId === layerId) {
                this.selectedLayerId = null;
            }

            this.selectedLayerIds.delete(layerId);

            if (this.callbacks.onLayerRemove) {
                this.callbacks.onLayerRemove(layerId);
            }

            this.contentLayer.draw();
        }
    }

    public updateLayerInternal(layerId: string, updates: Partial<BaseLayerConfig>): void {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.update(updates as any);
            this.contentLayer.draw();

            if (this.callbacks.onLayerChange) {
                const config = (layer as any).config;
                this.callbacks.onLayerChange(config);
            }
        }
    }

    /**
     * Setup smart guides for a layer node
     */
    private setupSmartGuidesForLayer(layer: LayerInstance, id: string): void {
        const node = layer.getNode();
        if (!node) return;

        // Set drag bound function for snapping
        node.dragBoundFunc((pos) => this.snapDragBoundFunc(pos, id));

        // Update elements on drag start
        node.on('dragstart', () => {
            this.updateSmartGuidesElements();
        });

        // Clear guides on drag end
        node.on('dragend', () => {
            this.smartGuides.clearGuides();
            // Also update elements as position changed
            this.updateSmartGuidesElements();
        });
    }

    /**
     * Update all layer element bounds in smart guides
     */
    private updateSmartGuidesElements(): void {
        const elements: Array<{
            id: string;
            x: number;
            y: number;
            width: number;
            height: number;
            centerX: number;
            centerY: number;
            right: number;
            bottom: number;
        }> = [];

        this.layers.forEach((layer, id) => {
            const node = layer.getNode();
            if (!node) return;

            const clientRect = node.getClientRect();
            elements.push({
                id,
                x: clientRect.x,
                y: clientRect.y,
                width: clientRect.width,
                height: clientRect.height,
                centerX: clientRect.x + clientRect.width / 2,
                centerY: clientRect.y + clientRect.height / 2,
                right: clientRect.x + clientRect.width,
                bottom: clientRect.y + clientRect.height,
            });
        });

        this.smartGuides.updateElements(elements);
    }

    /**
     * Snap drag bound function for layer dragging with smart guides
     */
    private snapDragBoundFunc(pos: { x: number; y: number }, layerId: string): { x: number; y: number } {
        const layer = this.layers.get(layerId);
        if (!layer) return pos;

        const node = layer.getNode();
        if (!node) return pos;

        const clientRect = node.getClientRect();
        const movingElement = {
            id: layerId,
            x: pos.x,
            y: pos.y,
            width: clientRect.width,
            height: clientRect.height,
            centerX: pos.x + clientRect.width / 2,
            centerY: pos.y + clientRect.height / 2,
            right: pos.x + clientRect.width,
            bottom: pos.y + clientRect.height,
        };

        const snapResult = this.smartGuides.calculateSnap(movingElement, [layerId]);
        this.smartGuides.showGuides(movingElement, [layerId]);

        return {
            x: snapResult.x !== undefined ? snapResult.x : pos.x,
            y: snapResult.y !== undefined ? snapResult.y : pos.y,
        };
    }

    public centerView(): void {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        const sceneWidth = this.config.width * this.sceneZoom;
        const sceneHeight = this.config.height * this.sceneZoom;

        const x = (containerWidth - sceneWidth) / 2;
        const y = (containerHeight - sceneHeight) / 2;

        this.applyTransformToLayers(x, y, this.sceneZoom);
        this.updateScrollbars();
    }

    // ========================================================================
    // Layer Creation (Public wrapping Commands)
    // ========================================================================

    public async addLayer(config: BaseLayerConfig): Promise<void> {
        switch (config.type) {
            case 'image':
                await this.addImageLayer(config as ImageLayerConfig);
                break;
            case 'svg':
                await this.addSvgLayer(config as SvgLayerConfig);
                break;
            case 'text':
                this.addTextLayer(config as TextLayerConfig);
                break;
            case 'shape':
                this.addShapeLayer(config as ShapeLayerConfig);
                break;
        }
    }

    public async addImageLayer(config: ImageLayerConfig): Promise<void> {
        // For async loading layers (image/svg), we load first then add command?
        // Or we make the command handle the add.
        // For simplicity, we treat the 'add' as the action of putting it in the scene.
        // But for ImageLayer, 'addImageLayerInternal' will need to trigger load.

        // Since original method returns Promise, we should respect that.
        // But undo/redo stack is sync.
        // We will execute the internal method directly first (to await it), THEN add to history.
        // BUT wait, if we execute directly, we are "doing" it.
        // Command.execute() does it too.
        // So:
        // 1. await internal add
        // 2. history.addOnly(new AddLayerCommand(this, config));

        await this.addImageLayerInternal(config);
        this.historyManager.addOnly(new AddLayerCommand(this, config));
    }

    private async addImageLayerInternal(config: ImageLayerConfig): Promise<void> {
        // Generate unique loading ID
        const loadingId = `editor-image-layer-${config.id}`;

        try {
            // Start loading indicator
            this.loadingManager.start(loadingId, LOADING_MESSAGES.IMAGE.START, 0);

            // If position is missing OR is exactly {0,0}, we center it in the viewport
            if (!config.position || (config.position.x === 0 && config.position.y === 0)) {
                config.position = this.getViewportCenter();
            }

            this.loadingManager.updateProgress(loadingId, 30, LOADING_MESSAGES.IMAGE.PREPARE);

            const layer = new ImageLayer(config);

            layer.setCallbacks({
                onChange: (updated) => {
                    if (this.callbacks.onLayerChange) {
                        this.callbacks.onLayerChange(updated as unknown as BaseLayerConfig);
                    }
                },
                onSelect: (e?: any) => {
                    this.handleLayerSelection(config.id, e);
                },
            });

            this.loadingManager.updateProgress(loadingId, 60, LOADING_MESSAGES.IMAGE.LOADING);

            await layer.loadImage();

            this.loadingManager.updateProgress(loadingId, 90, LOADING_MESSAGES.IMAGE.FINALIZE);

            this.layers.set(config.id, layer);

            const node = layer.getNode();
            if (node) {
                this.contentLayer.add(node);
                this.setupSmartGuidesForLayer(layer, config.id);
            }
            this.contentLayer.add(layer.getTransformer());
            this.contentLayer.draw();

            // Complete loading
            this.loadingManager.complete(loadingId);

            if (this.callbacks.onLayerAdd) {
                this.callbacks.onLayerAdd(config as unknown as BaseLayerConfig);
            }
        } catch (error) {
            // Clean up loading indicator on error
            this.loadingManager.complete(loadingId);
            throw error;
        }
    }

    public async addSvgLayer(config: SvgLayerConfig): Promise<void> {
        await this.addSvgLayerInternal(config);
        this.historyManager.addOnly(new AddLayerCommand(this, config));
    }

    private async addSvgLayerInternal(config: SvgLayerConfig): Promise<void> {
        // Generate unique loading ID
        const loadingId = `editor-svg-layer-${config.id}`;

        try {
            // Start loading indicator
            this.loadingManager.start(loadingId, LOADING_MESSAGES.SVG.START, 0);

            // If position is missing OR is exactly {0,0}, we center it in the viewport
            if (!config.position || (config.position.x === 0 && config.position.y === 0)) {
                config.position = this.getViewportCenter();
            }

            this.loadingManager.updateProgress(loadingId, 30, LOADING_MESSAGES.SVG.PREPARE);

            const layer = new SvgLayer(config);

            layer.setCallbacks({
                onChange: (updated) => {
                    this.updateSmartGuidesElements();
                    if (this.callbacks.onLayerChange) {
                        this.callbacks.onLayerChange(updated as unknown as BaseLayerConfig);
                    }
                },
                onSelect: (e?: any) => {
                    this.handleLayerSelection(config.id, e);
                },
            });

            this.loadingManager.updateProgress(loadingId, 60, LOADING_MESSAGES.SVG.LOADING);

            await layer.loadSvg();

            this.loadingManager.updateProgress(loadingId, 90, LOADING_MESSAGES.SVG.FINALIZE);

            this.layers.set(config.id, layer);

            const node = layer.getNode();
            if (node) {
                this.contentLayer.add(node);
                this.setupSmartGuidesForLayer(layer, config.id);
            }
            this.contentLayer.add(layer.getTransformer());
            this.contentLayer.draw();

            // Complete loading
            this.loadingManager.complete(loadingId);

            if (this.callbacks.onLayerAdd) {
                this.callbacks.onLayerAdd(config as unknown as BaseLayerConfig);
            }
        } catch (error) {
            // Clean up loading indicator on error
            this.loadingManager.complete(loadingId);
            throw error;
        }
    }

    public addTextLayer(config: TextLayerConfig): void {
        this.addTextLayerInternal(config);
        this.historyManager.addOnly(new AddLayerCommand(this, config));
    }

    private addTextLayerInternal(config: TextLayerConfig): void {
        // If position is missing OR is exactly {0,0}, we center it in the viewport
        if (!config.position || (config.position.x === 0 && config.position.y === 0)) {
            config.position = this.getViewportCenter();
        }
        const layer = new TextLayer(config);

        layer.setCallbacks({
            onChange: (updated) => {
                this.updateSmartGuidesElements();
                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange(updated as unknown as BaseLayerConfig);
                }
            },
            onSelect: (e?: any) => {
                this.handleLayerSelection(config.id, e);
            },
            onDoubleClick: () => {
                // Open text editor when double-clicking text layer
                this.openTextEditor(config.id);
            },
        });

        this.layers.set(config.id, layer);

        const node = layer.getNode();
        if (node) {
            this.contentLayer.add(node);
            this.setupSmartGuidesForLayer(layer, config.id);
        }
        this.contentLayer.add(layer.getTransformer());
        this.contentLayer.draw();

        if (this.callbacks.onLayerAdd) {
            this.callbacks.onLayerAdd(config as unknown as BaseLayerConfig);
        }
    }

    public addShapeLayer(config: ShapeLayerConfig): void {
        this.addShapeLayerInternal(config);
        this.historyManager.addOnly(new AddLayerCommand(this, config));
    }

    private addShapeLayerInternal(config: ShapeLayerConfig): void {
        // If position is missing OR is exactly {0,0}, we center it in the viewport
        if (!config.position || (config.position.x === 0 && config.position.y === 0)) {
            config.position = this.getViewportCenter();
        }
        const layer = new ShapeLayer(config);

        layer.setCallbacks({
            onChange: (updated) => {
                this.updateSmartGuidesElements();
                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange(updated as unknown as BaseLayerConfig);
                }
            },
            onSelect: (e?: any) => {
                this.handleLayerSelection(config.id, e);
            },
        });

        this.layers.set(config.id, layer);

        const node = layer.getNode();
        if (node) {
            this.contentLayer.add(node);
            this.setupSmartGuidesForLayer(layer, config.id);
        }
        this.contentLayer.add(layer.getTransformer());
        this.contentLayer.draw();

        if (this.callbacks.onLayerAdd) {
            this.callbacks.onLayerAdd(config as unknown as BaseLayerConfig);
        }
    }

    public removeLayer(layerId: string): void {
        const layer = this.layers.get(layerId);
        if (layer) {
            const config = (layer as any).config;
            this.historyManager.execute(new RemoveLayerCommand(this, config));
        }
    }

    public selectLayer(layerId: string | null): void {
        // Deselect all layers
        this.layers.forEach((layer, id) => {
            layer.setSelected(id === layerId);
        });

        this.selectedLayerId = layerId;

        // Deselect cameras when selecting layer
        if (layerId) {
            this.selectCamera(null);
        }

        if (this.callbacks.onLayerSelect) {
            this.callbacks.onLayerSelect(layerId);
        }

        this.contentLayer.draw();
    }

    /**
     * Select multiple layers
     */
    public selectLayers(layerIds: string[]): void {
        // Clear old selection
        this.selectedLayerIds.clear();

        // Add new selection
        layerIds.forEach(id => {
            if (this.layers.has(id)) {
                this.selectedLayerIds.add(id);
            }
        });

        // Update visual state
        this.updateMultiSelection();

        // For backward compatibility, set selectedLayerId to first selected or null
        this.selectedLayerId = layerIds.length > 0 ? layerIds[0] : null;

        // Deselect cameras when selecting layers
        if (this.selectedLayerIds.size > 0) {
            this.selectCamera(null);
        }

        if (this.callbacks.onLayerSelect) {
            // Call with first selected layer for compatibility
            this.callbacks.onLayerSelect(this.selectedLayerId);
        }

        this.contentLayer.draw();
    }

    /**
     * Update the visual selection state for all layers based on selectedLayerIds
     */
    private updateMultiSelection(): void {
        this.layers.forEach((layer, id) => {
            layer.setSelected(this.selectedLayerIds.has(id));
        });

        this.contentLayer.draw();
    }

    /**
     * Add a layer to the current selection
     */
    public addToSelection(layerId: string): void {
        if (this.layers.has(layerId)) {
            this.selectedLayerIds.add(layerId);
            this.updateMultiSelection();
        }
    }

    /**
     * Remove a layer from the current selection
     */
    public removeFromSelection(layerId: string): void {
        this.selectedLayerIds.delete(layerId);
        this.updateMultiSelection();
    }

    /**
     * Get all selected layer IDs
     */
    public getSelectedLayerIds(): string[] {
        return Array.from(this.selectedLayerIds);
    }

    /**
     * Check if multi-select modifier key (Ctrl/Cmd) is pressed
     */
    private isMultiSelectModifier(event?: any): boolean {
        return event?.evt && (event.evt.ctrlKey || event.evt.metaKey);
    }

    /**
     * Handle layer selection with support for multi-select (Ctrl+Click)
     */
    private handleLayerSelection(layerId: string, event?: any): void {
        // Check if Ctrl/Cmd key is pressed for multi-selection
        if (this.isMultiSelectModifier(event)) {
            // Toggle this layer in selection
            if (this.selectedLayerIds.has(layerId)) {
                this.removeFromSelection(layerId);
            } else {
                this.addToSelection(layerId);
            }
        } else {
            // Single selection
            this.selectLayer(layerId);
        }
    }

    // ========================================================================
    // Layer Operations (Z-Index, Alignment, Flip, etc.)
    // ========================================================================

    /**
     * Bring selected layers to the very front
     */
    public bringToFront(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const node = layer.getNode();
                const transformer = layer.getTransformer();
                if (node) node.moveToTop();
                if (transformer) transformer.moveToTop();

                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange((layer as any).config);
                }
            }
        });
        this.contentLayer.draw();
        this.triggerHistoryChange();
    }

    public sendToBack(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const node = layer.getNode();
                const transformer = layer.getTransformer();
                if (node) node.moveToBottom();
                if (transformer) transformer.moveToTop(); // Keep transformer above

                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange((layer as any).config);
                }
            }
        });
        this.contentLayer.draw();
        this.triggerHistoryChange();
    }

    public moveUp(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const node = layer.getNode();
                if (node) node.moveUp();

                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange((layer as any).config);
                }
            }
        });
        this.contentLayer.draw();
        this.triggerHistoryChange();
    }

    public moveDown(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const node = layer.getNode();
                if (node) node.moveDown();

                if (this.callbacks.onLayerChange) {
                    this.callbacks.onLayerChange((layer as any).config);
                }
            }
        });
        this.contentLayer.draw();
        this.triggerHistoryChange();
    }

    public async duplicateLayer(layerId: string): Promise<void> {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        const config = (layer as any).config;
        const newId = `${config.id}_copy_${Date.now()}`;
        const newConfig = {
            ...config,
            id: newId,
            name: `${config.name || config.type} (copy)`,
            position: {
                x: (config.position?.x || 0) + 20,
                y: (config.position?.y || 0) + 20
            }
        };

        await this.addLayer(newConfig);
        this.selectLayer(newId);
    }

    /**
     * Align selected layers
     */
    public alignLayers(alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length < 2) return;

        // Get bounding boxes for all selected layers
        const boxes = selectedIds.map(id => {
            const node = this.layers.get(id)?.getNode();
            if (!node) return null;
            return { id, box: node.getClientRect() };
        }).filter(b => b !== null) as { id: string, box: Konva.RectConfig }[];

        if (boxes.length < 2) return;

        // Find reference value
        let refValue: number;
        switch (alignment) {
            case 'left': refValue = Math.min(...boxes.map(b => b.box.x || 0)); break;
            case 'right': refValue = Math.max(...boxes.map(b => (b.box.x || 0) + (b.box.width || 0))); break;
            case 'top': refValue = Math.min(...boxes.map(b => b.box.y || 0)); break;
            case 'bottom': refValue = Math.max(...boxes.map(b => (b.box.y || 0) + (b.box.height || 0))); break;
            case 'center':
                const minX = Math.min(...boxes.map(b => b.box.x || 0));
                const maxX = Math.max(...boxes.map(b => (b.box.x || 0) + (b.box.width || 0)));
                refValue = (minX + maxX) / 2;
                break;
            case 'middle':
                const minY = Math.min(...boxes.map(b => b.box.y || 0));
                const maxY = Math.max(...boxes.map(b => (b.box.y || 0) + (b.box.height || 0)));
                refValue = (minY + maxY) / 2;
                break;
        }

        // Apply alignment
        boxes.forEach(b => {
            const layer = this.layers.get(b.id);
            if (!layer) return;

            const updates: any = {};
            const node = layer.getNode();
            if (!node) return;

            const currentX = node.x();
            const currentY = node.y();
            const offsetX = node.offsetX();
            const offsetY = node.offsetY();
            const width = node.width() * Math.abs(node.scaleX());
            const height = node.height() * Math.abs(node.scaleY());

            // Calculate theoretical top-left in scene coords for math
            // Since Konva nodes now have centeral offset (offsetX = width/2)
            // node.x() is the center. But getClientRect() returns top-left.
            // We'll use the bounding box logic.

            switch (alignment) {
                case 'left': updates.position = { x: refValue + (b.box.width! / 2), y: currentY }; break;
                case 'right': updates.position = { x: refValue - (b.box.width! / 2), y: currentY }; break;
                case 'top': updates.position = { x: currentX, y: refValue + (b.box.height! / 2) }; break;
                case 'bottom': updates.position = { x: currentX, y: refValue - (b.box.height! / 2) }; break;
                case 'center': updates.position = { x: refValue, y: currentY }; break;
                case 'middle': updates.position = { x: currentX, y: refValue }; break;
            }

            if (updates.position) {
                this.updateLayer(b.id, updates);
            }
        });
    }

    /**
     * Toggle lock state for selected layers
     */
    public toggleLock(): void {
        const selectedIds = this.getSelectedLayerIds();
        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const config = (layer as any).config; // Accessing internal config
                this.updateLayer(id, { locked: !config.locked });
            }
        });
    }

    /**
     * Flip selected layers horizontally
     */
    public flipHorizontal(): void {
        const selectedIds = this.getSelectedLayerIds();
        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const config = (layer as any).config;
                this.updateLayer(id, { flipX: !config.flipX });
            }
        });
    }

    /**
     * Flip selected layers vertically
     */
    public flipVertical(): void {
        const selectedIds = this.getSelectedLayerIds();
        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (layer) {
                const config = (layer as any).config;
                this.updateLayer(id, { flipY: !config.flipY });
            }
        });
    }

    /**
     * Duplicate selected layers
     */
    public duplicateSelectedLayers(): void {
        const selectedIds = this.getSelectedLayerIds();
        if (selectedIds.length === 0) return;

        const newIds: string[] = [];

        selectedIds.forEach(id => {
            const layer = this.layers.get(id);
            if (!layer) return;

            // Get current config
            const config = (layer as any).config;

            // Generate unique ID
            const generateId = (): string => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return `${config.type}-${crypto.randomUUID()}`;
                }
                return `${config.type}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            };

            const newId = generateId();
            const newConfig = {
                ...config,
                id: newId,
                position: {
                    x: (config.position?.x || 0) + 20,
                    y: (config.position?.y || 0) + 20
                }
            };

            // Add new layer based on type
            switch (config.type) {
                case 'image': this.addImageLayer(newConfig as ImageLayerConfig); break;
                case 'svg': this.addSvgLayer(newConfig as SvgLayerConfig); break;
                case 'text': this.addTextLayer(newConfig as TextLayerConfig); break;
                case 'shape': this.addShapeLayer(newConfig as ShapeLayerConfig); break;
            }

            newIds.push(newId);
        });

        // Select the new layers after a short delay to ensure they are created
        setTimeout(() => {
            this.selectLayers(newIds);
        }, 100);
    }

    public updateLayer(layerId: string, updates: Partial<BaseLayerConfig>): void {
        const layer = this.layers.get(layerId);
        if (layer) {
            const oldConfig = { ...(layer as any).config };
            // Execute via history manager to track change
            // We need to construct the full new config if we want to store it, 
            // but UpdateLayerCommand logic is "apply updates".
            // Actually UpdateLayerCommand takes update delta.
            this.historyManager.execute(new UpdateLayerCommand(this, layerId, oldConfig, updates));
        }
    }

    /**
     * Open text editor for a specific text layer
     */
    private openTextEditor(layerId: string): void {
        const layer = this.layers.get(layerId);
        if (!layer || !(layer instanceof TextLayer)) {
            return;
        }

        // Get current text configuration
        const textNode = layer.getNode();
        const currentText = textNode.text();
        const fontSize = textNode.fontSize();
        const fontFamily = textNode.fontFamily();
        const color = textNode.fill();

        // Create and show text editor

        const textEditor = new TextEditor({
            initialText: currentText,
            fontSize: fontSize,
            fontFamily: fontFamily,
            color: typeof color === 'string' ? color : undefined,
        });

        textEditor.setCallbacks({
            onSave: (newText: string) => {
                // Update the text layer with new text
                this.updateLayer(layerId, {
                    text_config: {
                        text: newText,
                    }
                } as any);
            },
            onCancel: () => {
                // Do nothing on cancel
            }
        });

        textEditor.show();
    }

    // ========================================================================
    // Selection
    // ========================================================================

    public deselectAll(): void {
        this.selectedLayerIds.clear();
        this.selectLayer(null);
        this.selectCamera(null);
    }

    public getSelectedLayerId(): string | null {
        return this.selectedLayerId;
    }

    public getSelectedCameraId(): string | null {
        return this.selectedCameraId;
    }

    // ========================================================================
    // Zoom & Pan
    // ========================================================================

    private initZoomControls(): void {
        this.zoomControls = new ZoomControls({
            container: this.container,
            initialZoom: this.sceneZoom,
            minZoom: 0.1,
            maxZoom: 5.0,
            onZoomIn: () => this.zoomIn(),
            onZoomOut: () => this.zoomOut(),
            onZoomReset: () => this.fitToViewport(),
        });
    }

    private initScrollbars(): void {
        this.scrollbars = new Scrollbars({
            container: this.container,
            sceneWidth: this.config.width,
            sceneHeight: this.config.height,
            onScroll: (x: number, y: number) => {
                this.setPan(x, y);
            },
        });
        // Initial update to show scrollbars if scene is larger than viewport
        setTimeout(() => this.updateScrollbars(), 0);
    }



    private updateScrollbars(): void {
        if (this.scrollbars) {
            const pos = this.contentLayer.position();
            this.scrollbars.update(pos.x, pos.y, this.sceneZoom);
        }
        this.updateViewportTracker();

    }



    private initViewportTracker(): void {
        this.viewportTracker = document.createElement('div');
        this.viewportTracker.style.position = 'absolute';
        this.viewportTracker.style.bottom = '10px';
        this.viewportTracker.style.left = '50%';
        this.viewportTracker.style.transform = 'translateX(-50%)';
        this.viewportTracker.style.background = 'rgba(0, 0, 0, 0.5)';
        this.viewportTracker.style.color = '#fff';
        this.viewportTracker.style.padding = '4px 8px';
        this.viewportTracker.style.borderRadius = '4px';
        this.viewportTracker.style.fontSize = '10px';
        this.viewportTracker.style.pointerEvents = 'none';
        this.viewportTracker.style.zIndex = '1000';
        this.viewportTracker.style.fontFamily = 'monospace';
        this.container.appendChild(this.viewportTracker);
        this.updateViewportTracker();
    }

    private updateViewportTracker(): void {
        if (this.viewportTracker) {
            const center = this.getViewportCenter();
            this.viewportTracker.innerText = `Viewport Center: ${Math.round(center.x)}, ${Math.round(center.y)} (Zoom: ${Math.round(this.sceneZoom * 100)}%)`;
        }
    }

    public setZoom(zoom: number, centerX?: number, centerY?: number): void {
        const oldScale = this.sceneZoom;
        this.sceneZoom = Math.max(0.1, Math.min(5, zoom));

        const layerPos = this.contentLayer.position();

        // If center point is provided, zoom to that point
        if (centerX !== undefined && centerY !== undefined) {
            const mousePointTo = {
                x: (centerX - layerPos.x) / oldScale,
                y: (centerY - layerPos.y) / oldScale,
            };

            const newPos = {
                x: centerX - mousePointTo.x * this.sceneZoom,
                y: centerY - mousePointTo.y * this.sceneZoom,
            };

            this.applyTransformToLayers(newPos.x, newPos.y, this.sceneZoom);
        } else {
            this.applyTransformToLayers(layerPos.x, layerPos.y, this.sceneZoom);
        }

        this.stage.batchDraw();

        // Update zoom controls display
        if (this.zoomControls) {
            this.zoomControls.updateZoom(this.sceneZoom);
        }

        // Update scrollbars
        this.updateScrollbars();

        if (this.callbacks.onZoomChange) {
            this.callbacks.onZoomChange(this.sceneZoom);
        }
    }

    public getZoom(): number {
        return this.sceneZoom;
    }

    public zoomIn(factor: number = 1.2): void {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        this.setZoom(this.sceneZoom * factor, containerWidth / 2, containerHeight / 2);
    }

    public zoomOut(factor: number = 1.2): void {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        this.setZoom(this.sceneZoom / factor, containerWidth / 2, containerHeight / 2);
    }

    public fitToViewport(): void {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        const zoomX = (containerWidth * 0.9) / this.config.width;
        const zoomY = (containerHeight * 0.9) / this.config.height;
        const newZoom = Math.min(zoomX, zoomY, 1.0);

        // Calculate target position to center the scene in the viewport
        const targetX = (containerWidth - this.config.width * newZoom) / 2;
        const targetY = (containerHeight - this.config.height * newZoom) / 2;

        this.animateViewport(targetX, targetY, newZoom);
    }

    /**
     * Focus the viewport on a specific camera with 100% zoom
     */
    public focusToCamera(cameraId: string): void {
        const camera = this.getCameraConfig(cameraId);
        if (!camera) return;

        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        // Calculate position to center the camera in the viewport at 100% zoom
        const targetX = (containerWidth / 2) - camera.position.x;
        const targetY = (containerHeight / 2) - camera.position.y;

        this.animateViewport(targetX, targetY, 1.0);
    }

    /**
     * Internal method to animate stage position and scale
     */
    private animateViewport(x: number, y: number, zoom: number): void {
        this.sceneZoom = zoom;

        // Animate layers instead of stage
        const layers = [this.backgroundLayer, this.cameraLayer, this.contentLayer];

        layers.forEach((layer, index) => {
            layer.to({
                x: x,
                y: y,
                scaleX: zoom,
                scaleY: zoom,
                duration: 0.4,
                easing: Konva.Easings.EaseInOut,
                onUpdate: () => {
                    if (index === 0) {
                        this.updateScrollbars();
                        if (this.zoomControls) {
                            this.zoomControls.updateZoom(zoom);
                        }
                    }
                },
                onFinish: () => {
                    if (index === 0 && this.callbacks.onZoomChange) {
                        this.callbacks.onZoomChange(this.sceneZoom);
                    }
                }
            });
        });
    }

    private applyTransformToLayers(x: number, y: number, zoom: number): void {
        const layers = [this.backgroundLayer, this.cameraLayer, this.contentLayer];
        layers.forEach(layer => {
            layer.position({ x, y });
            layer.scale({ x: zoom, y: zoom });
        });
    }

    public resetView(): void {
        this.focusDefaultCamera();
    }

    /**
     * Focus on the default camera
     */
    public focusDefaultCamera(): void {
        const defaultCamera = Array.from(this.cameraConfigs.values()).find(c => c.isDefault);
        if (defaultCamera) {
            this.focusToCamera(defaultCamera.id);
        } else if (this.cameraConfigs.size > 0) {
            const firstCameraId = this.cameraConfigs.keys().next().value;
            if (firstCameraId) {
                this.focusToCamera(firstCameraId);
            }
        } else {
            this.fitToViewport();
        }
    }

    public setPan(x: number, y: number): void {
        this.applyTransformToLayers(x, y, this.sceneZoom);
        this.stage.batchDraw();
        this.updateScrollbars();
    }

    public getPan(): { x: number; y: number } {
        return this.contentLayer.position();
    }

    public resetPan(): void {
        this.applyTransformToLayers(0, 0, this.sceneZoom);
        this.stage.batchDraw();
        this.updateScrollbars();
    }


    // ========================================================================
    // Background
    // ========================================================================

    public updateBackground(config: BackgroundConfig): void {
        if (this.background) {
            this.background.update({
                width: this.config.width,
                height: this.config.height,
                config: config as any,
            });
            this.backgroundLayer.draw();
        }
    }

    // ========================================================================
    // Scene Configuration
    // ========================================================================

    public async updateScene(updates: Partial<SceneConfig>): Promise<void> {
        // Update config
        Object.assign(this.config, updates);

        // Update container dimensions if provided
        if (updates.width || updates.height) {
            // Update smart guides
            if (this.smartGuides) {
                this.smartGuides.updateSceneSize(this.config.width, this.config.height);
            }

            if (this.scrollbars) {
                this.scrollbars.updateSceneSize(this.config.width, this.config.height);
            }
        }

        // Update background if provided
        if (updates.background) {
            this.updateBackground(updates.background);
        }

        this.stage.batchDraw();

        if (this.callbacks.onSceneChange) {
            this.callbacks.onSceneChange(this.config);
        }
    }

    public getConfig(): SceneConfig {
        return {
            ...this.config,
            cameras: this.getAllCameras(),
            layers: this.getAllLayers()
        };
    }

    // ========================================================================
    // Callbacks
    // ========================================================================

    public setCallbacks(callbacks: SceneCanvasCallbacks): void {
        this.callbacks = callbacks;
    }

    public getCallbacks(): SceneCanvasCallbacks {
        return this.callbacks;
    }

    public getUndoStack(): any[] {
        return this.historyManager.getUndoStack();
    }

    public getRedoStack(): any[] {
        return this.historyManager.getRedoStack();
    }

    private triggerHistoryChange(): void {
        if (this.callbacks.onHistoryChange) {
            this.callbacks.onHistoryChange(this.canUndo(), this.canRedo());
        }
    }

    // ========================================================================
    // Export & Utility
    // ========================================================================

    public toDataURL(config?: { pixelRatio?: number; mimeType?: string; quality?: number }): string {
        return this.stage.toDataURL(config);
    }

    public getStage(): Konva.Stage {
        return this.stage;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    public destroy(): void {
        // Remove event listeners
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
        }

        // Cleanup zoom controls
        if (this.zoomControls) {
            this.zoomControls.destroy();
        }

        // Cleanup scrollbars
        if (this.scrollbars) {
            this.scrollbars.destroy();
        }

        // Cleanup resize observer
        if ((this as any)._resizeObserver) {
            (this as any)._resizeObserver.disconnect();
        }

        // Cleanup all layers
        this.layers.forEach(layer => layer.destroy());
        this.layers.clear();

        // Cleanup all cameras
        this.cameras.forEach(camera => camera.destroy());
        this.cameras.clear();

        // Cleanup viewport tracker
        if (this.viewportTracker && this.viewportTracker.parentNode) {
            this.viewportTracker.parentNode.removeChild(this.viewportTracker);
        }

        // Cleanup background
        if (this.background) {
            this.background.destroy();
        }

        // Destroy stage
        this.stage.destroy();
    }
}
