import { SceneConfig as Scene, AnyLayerConfig as Layer, CameraSceneConfig, SimpleImageConfig, ShapeLayerConfig } from '../../shared/types';
import { Camera } from './scene-canvas'; // Import Camera interface from scene-canvas
import { v4 as uuidv4 } from 'uuid';

// Extended Layer type for Editor (ensure id presence)
// We intersect AnyLayerConfig with a guaranteed ID and type since the union might have loose types.
// Also add position as optional since it's common.
export type EditorLayer = Layer & { id: string; type: string; position?: { x: number; y: number } };

// Extended Scene type for Editor
export interface EditorScene extends Omit<Scene, 'layers' | 'cameras'> {
    duration: number; // Ensure duration is mandatory
    layers: EditorLayer[];
    sceneCameras?: Camera[]; // Editor uses specific camera objects
}

// --- Utilities (Stubbed/Simplified for pure TS adaptation) ---

export const CANVAS_DEFAULTS = {
    WIDTH: 1920,
    HEIGHT: 1080
};

// Simple EventBus implementation
class EventBus {
    private listeners: { [key: string]: Function[] } = {};

    on(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: Function) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event: string, data?: any) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

export const eventBus = new EventBus();

// Simplified duration calculator
const calculateSceneDuration = (scene: EditorScene): number => {
    // Basic implementation: transition + content duration or default
    return scene.duration || 5;
};

// Simplified timeline calculator
const calculateTimeline = (scenes: EditorScene[]) => {
    let acc = 0;
    const cumulativeTimes = scenes.map((scene, index) => {
        const duration = scene.duration || 5;
        const start = acc;
        acc += duration;
        return {
            start,
            totalDur: duration,
            showDur: 1, // Default
            hideDur: 1, // Default
            contentDur: duration - 2
        };
    });
    return { cumulativeTimes, totalDuration: acc };
};

// --- Editor Store ---

export interface EditorState {
    scenes: EditorScene[];
    cumulativeTimes: any[];
    totalDuration: number;
    currentProjectId: string | null;

    // UI State
    selectedSceneIndex: number;
    selectedLayerId: string | null;
    selectedLayerIds: string[];
    activeTab: string;

    // Preview
    previewMode: boolean;
    previewType: 'full' | 'scene' | null;

    // Mode
    mode: 'editor' | 'preview';
}

export class EditorStore {
    private static instance: EditorStore;

    private state: EditorState = {
        scenes: [],
        cumulativeTimes: [],
        totalDuration: 0,
        currentProjectId: null,
        selectedSceneIndex: 0,
        selectedLayerId: null,
        selectedLayerIds: [],
        activeTab: 'properties',
        previewMode: false,
        previewType: null,
        mode: 'editor'
    };

    private listeners: Function[] = [];

    private constructor() { }

    public static getInstance(): EditorStore {
        if (!EditorStore.instance) {
            EditorStore.instance = new EditorStore();
        }
        return EditorStore.instance;
    }

    public subscribe(listener: (state: EditorState) => void): () => void {
        this.listeners.push(listener);
        listener(this.state); // Initial emission
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private setState(partialState: Partial<EditorState>) {
        this.state = { ...this.state, ...partialState };
        this.notify();
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    public getState(): EditorState {
        return this.state;
    }

    // --- Actions ---

    public setScenes(scenes: EditorScene[]) {
        const scenesWithDuration = scenes.map(s => ({ ...s, duration: calculateSceneDuration(s) }));
        const { cumulativeTimes, totalDuration } = calculateTimeline(scenesWithDuration);
        this.setState({
            scenes: scenesWithDuration,
            cumulativeTimes,
            totalDuration
        });
    }

    public addScene(scene: EditorScene, afterIndex?: number) {
        const scenes = [...this.state.scenes];
        if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < scenes.length) {
            scenes.splice(afterIndex + 1, 0, scene);
        } else {
            scenes.push(scene);
        }

        const { cumulativeTimes, totalDuration } = calculateTimeline(scenes);
        this.setState({ scenes, cumulativeTimes, totalDuration });
        eventBus.emit('SCENE_ADDED', { scene, afterIndex });
    }

    public updateScene(scene: EditorScene) {
        const updatedScene = { ...scene, duration: calculateSceneDuration(scene) };
        const scenes = this.state.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
        const { cumulativeTimes, totalDuration } = calculateTimeline(scenes);

        this.setState({ scenes, cumulativeTimes, totalDuration });
        eventBus.emit('SCENE_MODIFIED', { sceneId: updatedScene.id, scene: updatedScene, property: 'all' });
    }

    public updateSceneProperty(sceneId: string, property: string, value: any) {
        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId) return s;
            const updatedScene = { ...s, [property]: value } as EditorScene;
            // Recalculate duration if needed (simplified check)
            if (property === 'duration' || property === 'sceneAudio') {
                updatedScene.duration = calculateSceneDuration(updatedScene);
            }
            return updatedScene;
        });

        const { cumulativeTimes, totalDuration } = calculateTimeline(scenes);
        this.setState({ scenes, cumulativeTimes, totalDuration });

        const updatedScene = scenes.find(s => s.id === sceneId);
        if (updatedScene) {
            eventBus.emit('SCENE_MODIFIED', { sceneId, scene: updatedScene, property });
        }
    }

    public deleteScene(id: string) {
        const scenes = this.state.scenes.filter(s => s.id !== id);
        const { cumulativeTimes, totalDuration } = calculateTimeline(scenes);

        let newIndex = this.state.selectedSceneIndex;
        if (newIndex >= scenes.length) {
            newIndex = Math.max(0, scenes.length - 1);
        }

        this.setState({
            scenes,
            cumulativeTimes,
            totalDuration,
            selectedSceneIndex: newIndex,
            selectedLayerId: null,
            selectedLayerIds: []
        });

        eventBus.emit('SCENE_DELETED', { sceneId: id });
    }

    // --- Layer Actions ---

    public addLayer(sceneId: string, layer: EditorLayer) {
        let addedLayer = { ...layer };

        // Auto-center (simplified)
        if (!addedLayer.position) {
            addedLayer.position = { x: CANVAS_DEFAULTS.WIDTH / 2, y: CANVAS_DEFAULTS.HEIGHT / 2 };
        }

        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId) return s;
            return { ...s, layers: [...(s.layers || []), addedLayer] };
        });

        this.setState({ scenes });
        eventBus.emit('LAYER_ADDED', { sceneId, layerId: addedLayer.id, layer: addedLayer });
    }

    public updateLayer(sceneId: string, layer: EditorLayer) {
        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId) return s;
            return {
                ...s,
                layers: (s.layers || []).map(l => l.id === layer.id ? layer : l)
            };
        });

        this.setState({ scenes });
        eventBus.emit('LAYER_MODIFIED', { sceneId, layerId: layer.id, layer, property: 'all' });
    }

    public updateLayerProperty(sceneId: string, layerId: string, property: string, value: any) {
        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId) return s;
            const layers = (s.layers || []).map(l => {
                if (l.id !== layerId) return l;
                return { ...l, [property]: value } as EditorLayer;
            });
            return { ...s, layers };
        });

        this.setState({ scenes });

        const scene = scenes.find(s => s.id === sceneId);
        const layer = scene?.layers?.find(l => l.id === layerId);
        if (layer) {
            eventBus.emit('LAYER_MODIFIED', { sceneId, layerId, layer, property });
        }
    }

    public deleteLayer(sceneId: string, layerId: string) {
        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId) return s;
            return {
                ...s,
                layers: (s.layers || []).filter(l => l.id !== layerId)
            };
        });

        this.setState({ scenes });
        // Clear selection if deleted
        if (this.state.selectedLayerId === layerId) {
            this.setState({ selectedLayerId: null, selectedLayerIds: [] });
        } else if (this.state.selectedLayerIds.includes(layerId)) {
            this.setState({ selectedLayerIds: this.state.selectedLayerIds.filter(id => id !== layerId) });
        }

        eventBus.emit('LAYER_DELETED', { sceneId, layerId });
    }

    public moveLayer(sceneId: string, from: number, to: number) {
        const scenes = this.state.scenes.map(s => {
            if (s.id !== sceneId || !(s.layers && s.layers.length > 0)) return s;
            const layers = [...s.layers];
            const [moved] = layers.splice(from, 1);
            layers.splice(to, 0, moved);
            return { ...s, layers };
        });

        this.setState({ scenes });

        const scene = scenes.find(s => s.id === sceneId);
        if (scene) {
            eventBus.emit('LAYER_REORDERED', { sceneId, layerIds: scene.layers.map(l => l.id) });
        }
    }

    // --- Selection Actions ---

    public setSelectedSceneIndex(index: number) {
        this.setState({
            selectedSceneIndex: index,
            selectedLayerId: null,
            selectedLayerIds: []
        });
    }

    public setSelectedLayerId(id: string | null) {
        this.setState({
            selectedLayerId: id,
            selectedLayerIds: id ? [id] : []
        });
    }

    public toggleLayerSelection(id: string) {
        const currentIds = this.state.selectedLayerIds;
        const isSelected = currentIds.includes(id);
        const newIds = isSelected
            ? currentIds.filter(layerId => layerId !== id)
            : [...currentIds, id];

        this.setState({
            selectedLayerIds: newIds,
            selectedLayerId: newIds.length === 1 ? newIds[0] : (newIds.length > 0 ? newIds[0] : null)
        });
    }

    public clearSelection() {
        this.setState({ selectedLayerId: null, selectedLayerIds: [] });
    }

    public setActiveTab(tab: string) {
        this.setState({ activeTab: tab });
    }

    public setMode(mode: 'editor' | 'preview') {
        this.setState({ mode });
    }
}
