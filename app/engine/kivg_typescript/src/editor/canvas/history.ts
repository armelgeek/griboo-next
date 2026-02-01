import { SceneCanvas, BaseLayerConfig } from './scene-canvas';

/**
 * Command Interface
 */
export interface Command {
    execute(): void;
    undo(): void;
    description: string;
    timestamp: number;
}

/**
 * History Manager
 */
export class HistoryManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];
    private limit: number;

    constructor(limit: number = 50) {
        this.limit = limit;
    }

    public execute(command: Command): void {
        command.execute();
        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo stack on new action
    }

    public addOnly(command: Command): void {
        // Add to stack without executing (for actions already performed by UI)
        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    public undo(): void {
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
        }
    }

    public redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
        }
    }

    public clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    public canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public getUndoStack(): Command[] {
        return [...this.undoStack];
    }

    public getRedoStack(): Command[] {
        return [...this.redoStack];
    }
}

// ============================================================================
// Concrete Commands
// ============================================================================

export class AddLayerCommand implements Command {
    public description: string;
    public timestamp: number;

    constructor(
        private canvas: SceneCanvas,
        private layerConfig: BaseLayerConfig
    ) {
        this.description = `Ajout du calque ${layerConfig.name || layerConfig.type}`;
        this.timestamp = Date.now();
    }

    execute(): void {
        // If layer already exists (redo), we might need to handle it differently
        // but SceneCanvas.addLayer usually handles creation
        this.canvas.addLayerInternal(this.layerConfig);
        this.canvas.selectLayer(this.layerConfig.id);
    }

    undo(): void {
        this.canvas.removeLayerInternal(this.layerConfig.id);
        this.canvas.selectLayer(null); // Or select previous... complex to track
    }
}

export class RemoveLayerCommand implements Command {
    public description: string;
    public timestamp: number;

    constructor(
        private canvas: SceneCanvas,
        private layerConfig: BaseLayerConfig
    ) {
        this.description = `Suppression du calque ${layerConfig.name || layerConfig.type}`;
        this.timestamp = Date.now();
    }

    execute(): void {
        this.canvas.removeLayerInternal(this.layerConfig.id);
        this.canvas.selectLayer(null);
    }

    undo(): void {
        this.canvas.addLayerInternal(this.layerConfig);
        this.canvas.selectLayer(this.layerConfig.id);
    }
}

export class UpdateLayerCommand implements Command {
    public description: string;
    public timestamp: number;

    constructor(
        private canvas: SceneCanvas,
        private layerId: string,
        private oldConfig: Partial<BaseLayerConfig>,
        private newConfig: Partial<BaseLayerConfig>
    ) {
        this.description = `Modification du calque ${newConfig.name || layerId}`;
        this.timestamp = Date.now();
    }

    execute(): void {
        this.canvas.updateLayerInternal(this.layerId, this.newConfig);
    }

    undo(): void {
        this.canvas.updateLayerInternal(this.layerId, this.oldConfig);
    }
}

export class TransformLayerCommand implements Command {
    public description: string;
    public timestamp: number;

    constructor(
        private canvas: SceneCanvas,
        private layers: { id: string; oldConfig: Partial<BaseLayerConfig>; newConfig: Partial<BaseLayerConfig> }[]
    ) {
        this.description = `Transformation de ${layers.length} calque(s)`;
        this.timestamp = Date.now();
    }

    execute(): void {
        this.layers.forEach(item => {
            this.canvas.updateLayerInternal(item.id, item.newConfig);
        });
    }

    undo(): void {
        this.layers.forEach(item => {
            this.canvas.updateLayerInternal(item.id, item.oldConfig);
        });
    }
}
