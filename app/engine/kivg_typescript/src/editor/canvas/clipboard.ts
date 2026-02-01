import { BaseLayerConfig } from './scene-canvas';

export class ClipboardManager {
    private clipboard: BaseLayerConfig[] = [];

    /**
     * Copy layers to clipboard
     */
    public copy(layers: BaseLayerConfig[]): void {
        // Deep clone to prevent reference issues
        this.clipboard = JSON.parse(JSON.stringify(layers));
        console.log(`[Clipboard] Copied ${this.clipboard.length} layers`);
    }

    /**
     * Get layers from clipboard for pasting
     * Returns cloned layers with new IDs and offset positions
     */
    public paste(offset: { x: number; y: number } = { x: 20, y: 20 }): BaseLayerConfig[] {
        if (this.clipboard.length === 0) {
            return [];
        }

        return this.clipboard.map(layer => {
            const newLayer = JSON.parse(JSON.stringify(layer));

            // Generate new ID
            newLayer.id = this.generateId(newLayer.type);

            // Offset position
            if (newLayer.position) {
                newLayer.position.x += offset.x;
                newLayer.position.y += offset.y;
            }

            return newLayer;
        });
    }

    public isEmpty(): boolean {
        return this.clipboard.length === 0;
    }

    private generateId(prefix: string): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `${prefix}-${crypto.randomUUID()}`;
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
}
