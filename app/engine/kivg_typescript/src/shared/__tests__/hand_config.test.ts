import { describe, it, expect, beforeEach } from 'vitest';
import { 
  HandConfigRegistry,
  globalHandConfig,
  registerHandPreset,
  getHandPreset,
  hasHandPreset,
  getHandOverlayConfigFromPreset,
  registerHandPresetsFromConfig
} from '../config/hand_config';

describe('HandConfigRegistry', () => {
  beforeEach(() => {
    // Clear all presets before each test
    const presetIds = globalHandConfig.getAllPresetIds();
    presetIds.forEach(id => globalHandConfig.removePreset(id));
  });

  it('should start with no default presets', () => {
    const presets = globalHandConfig.getAllPresetIds();
    expect(presets).toEqual([]);
  });

  it('should allow registering custom presets', () => {
    registerHandPreset('custom', {
      name: 'Custom Hand',
      imageUrl: '/path/to/hand.png',
      scale: 0.5,
      offset: [-10, -20]
    });

    expect(hasHandPreset('custom')).toBe(true);
    const preset = getHandPreset('custom');
    expect(preset).toBeDefined();
    expect(preset?.name).toBe('Custom Hand');
    expect(preset?.scale).toBe(0.5);
  });

  it('should allow registering presets with dynamic imageUrl functions', () => {
    const getImageUrl = () => '/dynamic/path.png';
    
    registerHandPreset('dynamic', {
      name: 'Dynamic Hand',
      imageUrl: getImageUrl,
      scale: 0.6,
      offset: [-15, -25]
    });

    const preset = getHandPreset('dynamic');
    expect(preset).toBeDefined();
    expect(preset?.imageUrl).toBe('/dynamic/path.png');
  });

  it('should allow registering drawing, eraser, and push presets from config', () => {
    // Simulate registering hands from WhiteboardConfig.hands
    registerHandPresetsFromConfig({
      draw: {
        imageUrl: '/hands/draw.png',
        scale: 0.80,
        offset: [-18, -20] as [number, number]
      },
      erase: {
        imageUrl: '/hands/erase.png',
        scale: 0.4,
        offset: [-150, -40] as [number, number]
      },
      push: {
        imageUrl: '/hands/push.png',
        scale: 0.35,
        offset: [-100, -80] as [number, number]
      }
    }, globalHandConfig);

    expect(hasHandPreset('drawing')).toBe(true);
    expect(hasHandPreset('eraser')).toBe(true);
    expect(hasHandPreset('push')).toBe(true);

    const drawingPreset = getHandPreset('drawing');
    expect(drawingPreset?.imageUrl).toBe('/hands/draw.png');
    expect(drawingPreset?.scale).toBe(0.80);
  });

  it('should throw error if imageUrl is missing when registering from config', () => {
    expect(() => {
      registerHandPresetsFromConfig({
        draw: {
          scale: 0.80,
          offset: [-18, -20] as [number, number]
        }
      }, globalHandConfig);
    }).toThrow('imageUrl is required for draw hand preset');
  });

  it('should create HandOverlayConfig from preset', () => {
    registerHandPreset('test', {
      name: 'Test Hand',
      imageUrl: '/test.png',
      scale: 0.7,
      offset: [-20, -30],
      anchorPoint: [0.5, 0.5],
      anchorTopLeft: true
    });

    const config = getHandOverlayConfigFromPreset('test');
    expect(config).toBeDefined();
    expect(config?.enabled).toBe(true);
    expect(config?.imageUrl).toBe('/test.png');
    expect(config?.scale).toBe(0.7);
    expect(config?.offset).toEqual([-20, -30]);
    expect(config?.anchorPoint).toEqual([0.5, 0.5]);
    expect(config?.anchorTopLeft).toBe(true);
  });

  it('should allow overriding preset values when creating HandOverlayConfig', () => {
    registerHandPreset('base', {
      name: 'Base Hand',
      imageUrl: '/base.png',
      scale: 0.5,
      offset: [-10, -10]
    });

    const config = getHandOverlayConfigFromPreset('base', {
      scale: 0.8,
      offset: [-20, -20]
    });

    expect(config?.imageUrl).toBe('/base.png'); // From preset
    expect(config?.scale).toBe(0.8); // Overridden
    expect(config?.offset).toEqual([-20, -20]); // Overridden
  });

  it('should return undefined for non-existent presets', () => {
    const preset = getHandPreset('non-existent');
    expect(preset).toBeUndefined();

    const config = getHandOverlayConfigFromPreset('non-existent');
    expect(config).toBeUndefined();
  });

  it('should allow updating existing presets', () => {
    registerHandPreset('update-test', {
      name: 'Original',
      imageUrl: '/original.png',
      scale: 0.5,
      offset: [-10, -10]
    });

    const updated = globalHandConfig.updatePreset('update-test', {
      scale: 0.9,
      name: 'Updated'
    });

    expect(updated).toBe(true);
    const preset = getHandPreset('update-test');
    expect(preset?.name).toBe('Updated');
    expect(preset?.scale).toBe(0.9);
    expect(preset?.imageUrl).toBe('/original.png'); // Unchanged
  });

  it('should allow removing presets', () => {
    registerHandPreset('remove-test', {
      name: 'Remove Me',
      imageUrl: '/remove.png',
      scale: 0.5,
      offset: [-10, -10]
    });

    expect(hasHandPreset('remove-test')).toBe(true);
    
    const removed = globalHandConfig.removePreset('remove-test');
    expect(removed).toBe(true);
    expect(hasHandPreset('remove-test')).toBe(false);
  });
});
