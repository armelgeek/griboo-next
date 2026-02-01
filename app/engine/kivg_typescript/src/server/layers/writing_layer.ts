import { ServerTextLayer } from './text_layer';
import { LayerConfig, WhiteboardConfig } from '../../shared/types';

/**
 * Server-side WritingLayer
 * Provides animated text rendering similar to the frontend WritingLayer.
 * Internally uses ServerTextSvgLayer with typewriter mode for character-by-character animation.
 */
export interface WritingLayerConfig {
    text: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    fontWeight?: string;
    /** Animation mode: typewriter (character by character) or reveal (fade in progressively) */
    mode?: 'typewriter' | 'reveal';
}

export class ServerWritingLayer extends ServerTextLayer {
    constructor(config: LayerConfig & { writingConfig?: WritingLayerConfig }, handsConfig?: WhiteboardConfig['hands']) {
        // Transform writingConfig to textConfig format
        const writingConfig = config.writingConfig || {} as WritingLayerConfig;
        const mode = writingConfig.mode || 'typewriter';

        const transformedConfig: LayerConfig = {
            ...config,
            textConfig: {
                text: writingConfig.text || '',
                fontSize: writingConfig.fontSize || 32,
                fontFamily: writingConfig.fontFamily || 'Arial',
                color: writingConfig.color || '#000000',
                strokeAnimation: {
                    mode: mode === 'typewriter' ? 'typewriter' : 'char_fade',
                    strokeWidth: 2,
                    strokeColor: writingConfig.color || '#000000',
                    duration: config.entrance_animation?.duration ? config.entrance_animation.duration / 1000 : 1.5
                }
            }
        };

        // Set animation type based on mode
        if (!transformedConfig.entrance_animation) {
            transformedConfig.entrance_animation = {
                type: mode === 'typewriter' ? 'typewriter' : 'char_fade',
                duration: 1500
            };
        } else {
            transformedConfig.entrance_animation.type = mode === 'typewriter' ? 'typewriter' : 'char_fade';
        }

        super(transformedConfig, handsConfig);
    }
}
