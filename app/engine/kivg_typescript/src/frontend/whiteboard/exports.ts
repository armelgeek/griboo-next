/**
 * Whiteboard Module - Exports
 * 
 * This module provides a complete whiteboard animation system with:
 * - Abstract Layer class for extensibility
 * - Concrete layer implementations (TextAnimator, Shape, Path, Image, KIVG, Writing, Eraser, Rubber)
 * - Scene management with transitions
 * - Whiteboard orchestration
 * - Hand overlay management system
 */

// Core classes
export { Layer } from './layer';
export { LoadableLayer } from './layers/loadable-layer';
export { Scene } from './scene';
export { Whiteboard } from './whiteboard';
export { LayerTimingConfig, type LayerTimingConfigData } from './utils/layer-timing-config';
export { TimingManager, type LayerTimingBreakdown, type SceneTimingBreakdown } from './managers/timing-manager';

// Hand overlay management
export {
  HandOverlayManager,
  type HandOverlayConfig,
  type HandOverlayStrategy,
  type HandPosition,
  type EraserLayerData,
  DefaultHandStrategy,
  TextWritingHandStrategy,
  PathDrawingHandStrategy,
  StrokeAnimationHandStrategy,
  ShapeHandStrategy,
  EraserHandStrategy,
  createHandStrategyForLayer
} from './managers/hand-overlay-manager';

// Seek hand management
export {
  SeekHandManager,
  createSeekHandManager
} from './managers/seek-hand-manager';

// Global hand configuration system
export {
  type HandPreset,
  registerHandPreset,
  getHandPreset,
  hasHandPreset,
  getAllHandPresetIds,
  getAllHandPresets,
  removeHandPreset,
  getHandOverlayConfigFromPreset,
  createHandOverlayFromPreset,
  globalHandConfig
} from './utils/hand-config';

export { TextLayer, createTextLayer, type TextLayerConfig } from './layers/text-layer';
export { ShapeLayer } from './layers/shape-layer';
export { PathLayer } from './layers/path-layer';
export { ImageLayer, type ImageLayerConfig } from './layers/image-layer';
export { SvgPathLayer, type SvgPathLayerConfig } from './layers/svg-path-layer';
export { WritingLayer, type WritingLayerConfig } from './layers/writing-layer';
export { EraserLayer, type EraserLayerConfig } from './layers/eraser-layer';
export { RubberLayer, type RubberLayerConfig } from './layers/rubber-layer';
export { PushLayer, type PushLayerConfig } from './layers/push-layer';
export { CaptionLayer } from './layers/caption-layer';

// Types
export type {
  Position,
  AnimationConfig,
  LayerConfig,
  AnimationType,
  TransitionType,
  SceneTransitionConfig,
  SceneConfig,
  ShapeLayerConfig,
  CaptionLayerConfig,
  SubtitleSegment,
  SubtitleStyle,
  WhiteboardConfig
} from './types';
