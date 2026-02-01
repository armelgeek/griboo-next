/**
 * Camera Animator Utility
 * Handles camera sequences, transitions, and animations
 */

import { interpolate, interpolatePosition, type Position } from './easing-functions';

/**
 * Camera configuration interface
 */
export interface Camera {
    id: string;
    name?: string;
    zoom?: number;
    position: Position;
    duration?: number;
    transition_duration?: number;
    startTime?: number;
    easing?: string;
    width?: number;
    height?: number;
    locked?: boolean;
    isDefault?: boolean;
    pauseDuration?: number;
    movementType?: string;
    scale?: number;
}

export interface CameraState {
    zoom: number;
    position: Position;
    cameraIndex: number;
    isTransitioning?: boolean;
}

export interface LayerCamera {
    zoom?: number;
    position?: Position;
}

export interface Animation {
    type?: string;
    start_zoom?: number;
    end_zoom?: number;
    focus_position?: Position;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Default camera configuration
 */
export const DEFAULT_CAMERA: Camera = {
    id: 'default',
    name: 'Default',
    zoom: 1,
    position: { x: 0.5, y: 0.5 },
    duration: 2.0,
    transition_duration: 0,
    startTime: 0,
    easing: 'ease_out',
    width: 800,
    height: 450,
    locked: false,
    isDefault: false,
    pauseDuration: 0,
    movementType: 'ease_out',
};

/**
 * Create a default camera object
 * @param {object} overrides - Properties to override defaults
 * @returns {object} Camera configuration
 */
export const createCamera = (overrides: Partial<Camera> = {}): Camera => {
    return {
        ...DEFAULT_CAMERA,
        ...overrides,
        position: {
            ...DEFAULT_CAMERA.position,
            ...(overrides.position || {}),
        },
    };
};

/**
 * Create the initial default camera for a scene
 * This camera is centered and unlocked by default
 * @param {string} aspectRatio - Aspect ratio (e.g., '16:9', '4:3')
 * @returns {object} Default camera configuration
 */
export const createDefaultCamera = (aspectRatio: string = '16:9'): Camera => {
    let cameraWidth = 800;
    let cameraHeight = 600;

    if (aspectRatio === '16:9') {
        cameraWidth = 800;
        cameraHeight = 450;
    } else if (aspectRatio === '4:3') {
        cameraWidth = 800;
        cameraHeight = 600;
    } else if (aspectRatio === '1:1') {
        cameraWidth = 600;
        cameraHeight = 600;
    }

    return {
        id: 'default-camera',
        name: 'Caméra Par Défaut',
        zoom: 1,
        position: { x: 0.5, y: 0.5 },
        duration: 2.0,
        transition_duration: 0,
        easing: 'ease_out',
        width: cameraWidth,
        height: cameraHeight,
        locked: true,
        isDefault: true,
        pauseDuration: 0,
        movementType: 'ease_out',
        scale: 1,
    };
};

/**
 * Calculate camera state at a specific time in a camera sequence
 * @param {array} cameras - Array of camera configurations
 * @param {number} currentTime - Current time in seconds
 * @returns {object} Current camera state {zoom, position, cameraIndex}
 */
export const getCameraAtTime = (cameras: Camera[], currentTime: number): CameraState => {
    if (!cameras || cameras.length === 0) {
        return {
            ...DEFAULT_CAMERA,
            zoom: DEFAULT_CAMERA.zoom || 1,
            cameraIndex: -1
        };
    }

    let accumulatedTime = 0;
    let previousCamera = cameras[0];

    for (let i = 0; i < cameras.length; i++) {
        const camera = cameras[i];
        const transitionDuration = camera.transition_duration || 0;
        const holdDuration = camera.duration || 2.0;

        // Use explicit startTime if available, otherwise use accumulated time
        const currentCameraStart = camera.startTime !== undefined ? camera.startTime : accumulatedTime;

        // Transition period (from previous camera to this one)
        if (currentTime < currentCameraStart + transitionDuration) {
            const transitionProgress = (currentTime - currentCameraStart) / Math.max(0.01, transitionDuration);
            return {
                zoom: interpolate(previousCamera.zoom ?? 1, camera.zoom ?? 1, transitionProgress, camera.easing),
                position: interpolatePosition(
                    previousCamera.position,
                    camera.position,
                    transitionProgress,
                    camera.easing
                ),
                cameraIndex: i,
                isTransitioning: true,
            };
        }

        // Hold period
        if (currentTime < currentCameraStart + transitionDuration + holdDuration) {
            return {
                zoom: camera.zoom ?? 1,
                position: { ...camera.position },
                cameraIndex: i,
                isTransitioning: false,
            };
        }

        // If using explicit startTime, don't necessarily update accumulatedTime 
        // in a way that affects subsequent cameras that MIGHT also have explicit startTimes.
        // However, for consistency with the loop, we update it.
        accumulatedTime = currentCameraStart + transitionDuration + holdDuration;
        previousCamera = camera;
    }

    const lastCamera = cameras[cameras.length - 1];
    return {
        zoom: lastCamera.zoom ?? 1,
        position: { ...lastCamera.position },
        cameraIndex: cameras.length - 1,
        isTransitioning: false,
    };
};

/**
 * Calculate total duration of a camera sequence
 * @param {array} cameras - Array of camera configurations
 * @returns {number} Total duration in seconds
 */
export const getTotalCameraDuration = (cameras: Camera[]): number => {
    if (!cameras || cameras.length === 0) return 0;

    return cameras.reduce((total, camera) => {
        return total + (camera.transition_duration || 0) + (camera.duration || 0);
    }, 0);
};

/**
 * Apply layer-level camera transformation
 * @param {object} layer - Layer object with optional camera settings
 * @returns {object} Camera transformation to apply {zoom, position}
 */
export const getLayerCamera = (layer: { camera?: LayerCamera }): { zoom: number; position: Position } => {
    if (!layer.camera) {
        return { zoom: 1.0, position: { x: 0.5, y: 0.5 } };
    }

    return {
        zoom: layer.camera.zoom || 1.0,
        position: layer.camera.position || { x: 0.5, y: 0.5 },
    };
};

/**
 * Calculate animation state for layer animations (zoom_in, zoom_out)
 * @param {object} animation - Animation configuration
 * @param {number} progress - Progress value between 0 and 1
 * @returns {object} Animation state {zoom, position}
 */
export const getLayerAnimationState = (animation: Animation | null, progress: number): { zoom: number; position: Position } | null => {
    if (!animation || !animation.type) {
        return null;
    }

    const { type, start_zoom = 1.0, end_zoom = 2.0, focus_position } = animation;

    if (type === 'zoom_in' || type === 'zoom_out') {
        const currentZoom = interpolate(start_zoom, end_zoom, progress, 'ease_out');
        return {
            zoom: currentZoom,
            position: focus_position || { x: 0.5, y: 0.5 },
        };
    }

    return null;
};

/**
 * Validate camera configuration
 * @param {object} camera - Camera configuration to validate
 * @returns {object} Validation result {valid, errors}
 */
export const validateCamera = (camera: Partial<Camera>): ValidationResult => {
    const errors: string[] = [];

    if (camera.zoom !== undefined && (camera.zoom < 0.1 || camera.zoom > 10)) {
        errors.push('Zoom must be between 0.1 and 10');
    }

    if (camera.position) {
        if (camera.position.x < 0 || camera.position.x > 1) {
            errors.push('Position x must be between 0 and 1');
        }
        if (camera.position.y < 0 || camera.position.y > 1) {
            errors.push('Position y must be between 0 and 1');
        }
    }

    if (camera.duration !== undefined && camera.duration < 0) {
        errors.push('Duration must be positive');
    }

    if (camera.transition_duration !== undefined && camera.transition_duration < 0) {
        errors.push('Transition duration must be positive');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Normalize position coordinates to ensure they're within 0-1 range
 * @param {object} position - Position {x, y}
 * @returns {object} Normalized position {x, y}
 */
export const normalizePosition = (position: Position): Position => {
    return {
        x: Math.max(0, Math.min(1, position.x)),
        y: Math.max(0, Math.min(1, position.y)),
    };
};

/**
 * Calculate layer position relative to camera viewport
 * @param {object} layerPosition - Layer position in scene coordinates {x, y}
 * @param {object} camera - Camera configuration
 * @param {number} sceneWidth - Scene width in pixels
 * @param {number} sceneHeight - Scene height in pixels
 * @returns {object} Position relative to camera viewport {x, y}
 */
export const calculateCameraRelativePosition = (
    layerPosition: Position,
    camera: Camera,
    sceneWidth: number,
    sceneHeight: number
): Position => {
    // Calculate camera viewport top-left corner in scene coordinates
    const cameraX = (camera.position.x * sceneWidth) - ((camera.width || 800) / 2);
    const cameraY = (camera.position.y * sceneHeight) - ((camera.height || 450) / 2);

    // Calculate layer position relative to camera viewport
    return {
        x: layerPosition.x - cameraX,
        y: layerPosition.y - cameraY,
    };
};

/**
 * Update a layer with a new camera_position based on its current position
 * This function finds the default camera and recalculates the camera_position
 * @param {object} layer - The layer to update
 * @param {array} cameras - Array of cameras in the scene
 * @param {number} sceneWidth - Scene width in pixels
 * @param {number} sceneHeight - Scene height in pixels
 * @returns {object} Updated layer with recalculated camera_position
 */
export const updateLayerCameraPosition = (
    layer: any,
    cameras: Camera[] = [],
    sceneWidth: number,
    sceneHeight: number
): any => {
    // Find the default camera
    const defaultCamera = cameras.find(cam => cam.isDefault === true) || createDefaultCamera('16:9');

    // Calculate the new camera_position based on current layer position
    const cameraPosition = calculateCameraRelativePosition(
        layer.position,
        defaultCamera,
        sceneWidth,
        sceneHeight
    );

    // Return the updated layer with new camera_position
    return {
        ...layer,
        camera_position: cameraPosition
    };
};

export default {
    createCamera,
    createDefaultCamera,
    getCameraAtTime,
    getTotalCameraDuration,
    getLayerCamera,
    getLayerAnimationState,
    validateCamera,
    normalizePosition,
    calculateCameraRelativePosition,
    updateLayerCameraPosition,
    DEFAULT_CAMERA,
};
