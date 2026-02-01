/**
 * Global Hand Configuration System
 * 
 * Centralized configuration for hand overlays, allowing shared presets.
 */

import { HandOverlayConfig } from '../types';
// No default assets - all configuration must be provided explicitly

/**
 * Hand preset definition
 */
export interface HandPreset {
    name: string;
    imageUrl: string | (() => string);  // Support both static strings and dynamic functions
    scale: number;
    offset: [number, number];
    anchorPoint?: [number, number];
    anchorTopLeft?: boolean;
}

/**
 * Internal preset configuration that uses dynamic URLs
 */
interface PresetConfig {
    name: string;
    getImageUrl: () => string;
    scale: number;
    offset: [number, number];
    anchorPoint?: [number, number];
    anchorTopLeft?: boolean;
}

/**
 * Helper function to register hand presets from WhiteboardConfig.hands
 * Used by both frontend and server to ensure consistent registration logic
 */
export function registerHandPresetsFromConfig(
    handsConfig: {
        draw?: { imageUrl?: string; scale?: number; offset?: [number, number]; anchorPoint?: [number, number]; anchorTopLeft?: boolean; };
        erase?: { imageUrl?: string; scale?: number; offset?: [number, number]; anchorPoint?: [number, number]; anchorTopLeft?: boolean; };
        push?: { imageUrl?: string; scale?: number; offset?: [number, number]; anchorPoint?: [number, number]; anchorTopLeft?: boolean; };
    },
    registry: HandConfigRegistry
): void {
    // Register drawing hand if provided
    if (handsConfig.draw) {
        if (!handsConfig.draw.imageUrl) {
            throw new Error('Hand configuration error: imageUrl is required for draw hand preset');
        }
        registry.registerPreset('drawing', {
            name: 'Drawing Hand',
            imageUrl: handsConfig.draw.imageUrl,
            scale: handsConfig.draw.scale !== undefined ? handsConfig.draw.scale : 0.80,
            offset: handsConfig.draw.offset || [-18, -20],
            anchorPoint: handsConfig.draw.anchorPoint,
            anchorTopLeft: handsConfig.draw.anchorTopLeft
        });
    }

    // Register eraser hand if provided
    if (handsConfig.erase) {
        if (!handsConfig.erase.imageUrl) {
            throw new Error('Hand configuration error: imageUrl is required for erase hand preset');
        }
        registry.registerPreset('eraser', {
            name: 'Eraser Hand',
            imageUrl: handsConfig.erase.imageUrl,
            scale: handsConfig.erase.scale !== undefined ? handsConfig.erase.scale : 0.4,
            offset: handsConfig.erase.offset || [-150, -40],
            anchorPoint: handsConfig.erase.anchorPoint,
            anchorTopLeft: handsConfig.erase.anchorTopLeft
        });
    }

    // Register push hand if provided
    if (handsConfig.push) {
        if (!handsConfig.push.imageUrl) {
            throw new Error('Hand configuration error: imageUrl is required for push hand preset');
        }
        registry.registerPreset('push', {
            name: 'Push Hand',
            imageUrl: handsConfig.push.imageUrl,
            scale: handsConfig.push.scale !== undefined ? handsConfig.push.scale : 0.35,
            offset: handsConfig.push.offset || [-100, -80],
            anchorPoint: handsConfig.push.anchorPoint,
            anchorTopLeft: handsConfig.push.anchorTopLeft
        });
    }
}

/**
 * Global hand configuration registry
 */
export class HandConfigRegistry {
    private presets: Map<string, PresetConfig> = new Map();

    constructor() {
        // No default presets - all hand configs must come from WhiteboardConfig.hands
    }

    registerPreset(id: string, preset: HandPreset): void {
        const config: PresetConfig = {
            name: preset.name,
            getImageUrl: typeof preset.imageUrl === 'function' ? preset.imageUrl : () => preset.imageUrl as string,
            scale: preset.scale,
            offset: preset.offset,
            anchorPoint: preset.anchorPoint,
            anchorTopLeft: preset.anchorTopLeft
        };
        this.presets.set(id, config);
    }

    getPreset(id: string): HandPreset | undefined {
        const config = this.presets.get(id);
        if (!config) return undefined;

        // Convert internal config back to HandPreset with resolved URL
        return {
            name: config.name,
            imageUrl: config.getImageUrl(),  // Resolve URL dynamically
            scale: config.scale,
            offset: config.offset,
            anchorPoint: config.anchorPoint,
            anchorTopLeft: config.anchorTopLeft
        };
    }

    hasPreset(id: string): boolean {
        return this.presets.has(id);
    }

    getAllPresetIds(): string[] {
        return Array.from(this.presets.keys());
    }

    getAllPresets(): Map<string, HandPreset> {
        const result = new Map<string, HandPreset>();
        for (const [id, config] of this.presets) {
            const preset = this.getPreset(id);
            if (preset) {
                result.set(id, preset);
            }
        }
        return result;
    }

    removePreset(id: string): boolean {
        return this.presets.delete(id);
    }

    updatePreset(id: string, updates: Partial<HandPreset>): boolean {
        const existing = this.presets.get(id);
        if (!existing) return false;

        // Merge updates with existing config
        const updatedConfig: PresetConfig = {
            ...existing,
            name: updates.name ?? existing.name,
            scale: updates.scale ?? existing.scale,
            offset: updates.offset ?? existing.offset,
            anchorPoint: updates.anchorPoint ?? existing.anchorPoint,
            anchorTopLeft: updates.anchorTopLeft ?? existing.anchorTopLeft
        };

        // Handle imageUrl update
        if (updates.imageUrl !== undefined) {
            updatedConfig.getImageUrl = typeof updates.imageUrl === 'function'
                ? updates.imageUrl
                : () => updates.imageUrl as string;
        }

        this.presets.set(id, updatedConfig);
        return true;
    }

    getHandOverlayConfig(
        id: string,
        overrides?: Partial<HandOverlayConfig>
    ): HandOverlayConfig | undefined {
        const preset = this.getPreset(id);
        if (!preset) return undefined;

        return {
            enabled: true,
            imageUrl: typeof preset.imageUrl === 'function' ? preset.imageUrl() : preset.imageUrl,
            scale: preset.scale,
            offset: preset.offset,
            anchorPoint: preset.anchorPoint,
            anchorTopLeft: preset.anchorTopLeft,
            ...overrides
        };
    }
}

// Global singleton instance
export const globalHandConfig = new HandConfigRegistry();

export function registerHandPreset(id: string, preset: HandPreset): void {
    globalHandConfig.registerPreset(id, preset);
}

export function getHandPreset(id: string): HandPreset | undefined {
    return globalHandConfig.getPreset(id);
}

export function hasHandPreset(id: string): boolean {
    return globalHandConfig.hasPreset(id);
}

export function getAllHandPresetIds(): string[] {
    return globalHandConfig.getAllPresetIds();
}

export function getHandOverlayConfigFromPreset(
    id: string,
    overrides?: Partial<HandOverlayConfig>
): HandOverlayConfig | undefined {
    return globalHandConfig.getHandOverlayConfig(id, overrides);
}

export function createHandOverlayFromPreset(
    presetId: string,
    overrides?: Partial<HandOverlayConfig>
): HandOverlayConfig | undefined {
    if (presetId === 'none') {
        return { enabled: false };
    }
    return getHandOverlayConfigFromPreset(presetId, overrides);
}

export function getAllHandPresets(): Map<string, HandPreset> {
    return globalHandConfig.getAllPresets();
}

export function removeHandPreset(id: string): boolean {
    return globalHandConfig.removePreset(id);
}

export function updateHandPreset(id: string, updates: Partial<HandPreset>): boolean {
    return globalHandConfig.updatePreset(id, updates);
}
