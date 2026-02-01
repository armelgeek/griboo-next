/**
 * Valid layer types
 */
const VALID_LAYER_TYPES = ['text', 'image', 'shape', 'svg_path', 'text_svg', 'kivg', 'writing'] as const;

/**
 * Valid shape types
 */
const VALID_SHAPE_TYPES = ['rectangle', 'circle', 'ellipse', 'line', 'polygon'] as const;

/**
 * Valid text directions
 */
const VALID_TEXT_DIRECTIONS = ['ltr', 'rtl', 'ttb'] as const;

/**
 * Valid easing functions
 */
const VALID_EASINGS = [
    'linear', 'ease_in', 'ease_out', 'ease_in_out',
    'ease_in_cubic', 'ease_out_cubic', 'ease_in_out_cubic',
    'ease_in_back', 'ease_out_back', 'ease_in_out_back'
] as const;

/**
 * Configuration Validator
 * Validates KIVG animation configurations and provides helpful error messages
 */

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationWarning {
    field: string;
    message: string;
    suggestion: string;
}

/**
 * Validates a KIVG configuration object
 * @param config Configuration object to validate
 * @returns Validation result with errors and warnings
 */
export function validateConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if config exists
    if (!config) {
        errors.push({
            field: 'config',
            message: 'Configuration object is required',
            code: 'CONFIG_REQUIRED'
        });
        return { valid: false, errors, warnings };
    }

    // Validate scene dimensions
    if (!config.scene_width || !config.scene_height) {
        errors.push({
            field: 'scene_width/scene_height',
            message: 'Scene dimensions (scene_width and scene_height) are required',
            code: 'DIMENSIONS_REQUIRED'
        });
    } else {
        if (config.scene_width < 1 || config.scene_height < 1) {
            errors.push({
                field: 'scene_width/scene_height',
                message: 'Scene dimensions must be greater than 0',
                code: 'INVALID_DIMENSIONS'
            });
        }
        
        if (config.scene_width > 7680 || config.scene_height > 4320) {
            warnings.push({
                field: 'scene_width/scene_height',
                message: 'Very large dimensions may impact performance',
                suggestion: 'Consider using dimensions up to 4K (3840x2160) for best performance'
            });
        }
    }

    // Validate FPS
    if (config.fps !== undefined) {
        if (config.fps < 1 || config.fps > 120) {
            errors.push({
                field: 'fps',
                message: 'FPS must be between 1 and 120',
                code: 'INVALID_FPS'
            });
        } else if (config.fps > 60) {
            warnings.push({
                field: 'fps',
                message: 'FPS above 60 may not be supported by all browsers',
                suggestion: 'Use 30 or 60 FPS for best compatibility'
            });
        }
    }

    // Validate slides
    if (!config.slides || !Array.isArray(config.slides)) {
        errors.push({
            field: 'slides',
            message: 'Slides array is required',
            code: 'SLIDES_REQUIRED'
        });
    } else {
        if (config.slides.length === 0) {
            warnings.push({
                field: 'slides',
                message: 'No slides defined',
                suggestion: 'Add at least one slide to create an animation'
            });
        }

        // Validate each slide
        config.slides.forEach((slide: any, index: number) => {
            validateSlide(slide, index, errors, warnings);
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates a single slide configuration
 */
function validateSlide(
    slide: any,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    const slidePrefix = `slides[${index}]`;

    // Check slide index
    if (slide.index === undefined) {
        errors.push({
            field: `${slidePrefix}.index`,
            message: `Slide at position ${index} is missing index property`,
            code: 'SLIDE_INDEX_REQUIRED'
        });
    }

    // Check duration
    if (slide.duration === undefined) {
        warnings.push({
            field: `${slidePrefix}.duration`,
            message: `Slide ${index} has no duration specified`,
            suggestion: 'Set a duration in seconds (e.g., 5 for 5 seconds)'
        });
    } else if (slide.duration < 0) {
        errors.push({
            field: `${slidePrefix}.duration`,
            message: `Slide ${index} has negative duration`,
            code: 'INVALID_DURATION'
        });
    } else if (slide.duration > 300) {
        warnings.push({
            field: `${slidePrefix}.duration`,
            message: `Slide ${index} has very long duration (${slide.duration}s)`,
            suggestion: 'Consider breaking long animations into multiple slides'
        });
    }

    // Validate layers
    if (!slide.layers || !Array.isArray(slide.layers)) {
        warnings.push({
            field: `${slidePrefix}.layers`,
            message: `Slide ${index} has no layers`,
            suggestion: 'Add layers to display content'
        });
    } else {
        if (slide.layers.length > 50) {
            warnings.push({
                field: `${slidePrefix}.layers`,
                message: `Slide ${index} has many layers (${slide.layers.length})`,
                suggestion: 'Too many layers may impact performance. Consider optimizing.'
            });
        }

        slide.layers.forEach((layer: any, layerIndex: number) => {
            validateLayer(layer, index, layerIndex, errors, warnings);
        });
    }
}

/**
 * Validates a layer configuration
 */
function validateLayer(
    layer: any,
    slideIndex: number,
    layerIndex: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    const layerPrefix = `slides[${slideIndex}].layers[${layerIndex}]`;

    // Check layer type
    if (!layer.type) {
        errors.push({
            field: `${layerPrefix}.type`,
            message: `Layer ${layerIndex} in slide ${slideIndex} is missing type`,
            code: 'LAYER_TYPE_REQUIRED'
        });
        return;
    }

    if (!VALID_LAYER_TYPES.includes(layer.type as any)) {
        errors.push({
            field: `${layerPrefix}.type`,
            message: `Invalid layer type '${layer.type}'. Valid types: ${VALID_LAYER_TYPES.join(', ')}`,
            code: 'INVALID_LAYER_TYPE'
        });
        return;
    }

    // Validate type-specific properties
    switch (layer.type) {
        case 'text':
            validateTextLayer(layer, layerPrefix, errors, warnings);
            break;
        case 'image':
            validateImageLayer(layer, layerPrefix, errors, warnings);
            break;
        case 'shape':
            validateShapeLayer(layer, layerPrefix, errors, warnings);
            break;
        case 'text_svg':
            validateTextSVGLayer(layer, layerPrefix, errors, warnings);
            break;
    }

    // Validate animations
    if (layer.entrance_animation) {
        validateAnimation(layer.entrance_animation, `${layerPrefix}.entrance_animation`, 'entrance', errors, warnings);
    }
}

/**
 * Validates text layer configuration
 */
function validateTextLayer(
    layer: any,
    prefix: string,
    errors: ValidationError[],
    _warnings: ValidationWarning[]
): void {
    if (!layer.text_config) {
        errors.push({
            field: `${prefix}.text_config`,
            message: 'Text layer requires text_config',
            code: 'TEXT_CONFIG_REQUIRED'
        });
        return;
    }

    if (!layer.text_config.text) {
        errors.push({
            field: `${prefix}.text_config.text`,
            message: 'Text content is required',
            code: 'TEXT_REQUIRED'
        });
    }

    if (layer.text_config.size !== undefined && layer.text_config.size < 1) {
        errors.push({
            field: `${prefix}.text_config.size`,
            message: 'Text size must be greater than 0',
            code: 'INVALID_TEXT_SIZE'
        });
    }

    if (layer.text_config.color && !Array.isArray(layer.text_config.color)) {
        errors.push({
            field: `${prefix}.text_config.color`,
            message: 'Text color must be an array [r, g, b] or [r, g, b, a]',
            code: 'INVALID_COLOR_FORMAT'
        });
    }
}

/**
 * Validates image layer configuration
 */
function validateImageLayer(
    layer: any,
    prefix: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    if (!layer.image_path && !layer.image) {
        errors.push({
            field: `${prefix}.image_path`,
            message: 'Image layer requires image_path or image property',
            code: 'IMAGE_PATH_REQUIRED'
        });
    }

    // Check if image path looks like a URL or relative path
    if (layer.image_path) {
        const path = layer.image_path.toLowerCase();
        if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('./')) {
            warnings.push({
                field: `${prefix}.image_path`,
                message: 'Image path should be a URL or relative path',
                suggestion: 'Use "./images/file.png" or "https://..."'
            });
        }
    }
}

/**
 * Validates shape layer configuration
 */
function validateShapeLayer(
    layer: any,
    prefix: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    if (!layer.shape_config) {
        errors.push({
            field: `${prefix}.shape_config`,
            message: 'Shape layer requires shape_config',
            code: 'SHAPE_CONFIG_REQUIRED'
        });
        return;
    }

    if (layer.shape_config.type && !VALID_SHAPE_TYPES.includes(layer.shape_config.type as any)) {
        warnings.push({
            field: `${prefix}.shape_config.type`,
            message: `Unknown shape type '${layer.shape_config.type}'`,
            suggestion: `Use one of: ${VALID_SHAPE_TYPES.join(', ')}`
        });
    }
}

/**
 * Validates text SVG layer configuration
 */
function validateTextSVGLayer(
    layer: any,
    prefix: string,
    errors: ValidationError[],
    _warnings: ValidationWarning[]
): void {
    if (!layer.text) {
        errors.push({
            field: `${prefix}.text`,
            message: 'Text SVG layer requires text property',
            code: 'TEXT_REQUIRED'
        });
    }

    if (layer.direction && !VALID_TEXT_DIRECTIONS.includes(layer.direction as any)) {
        errors.push({
            field: `${prefix}.direction`,
            message: `Invalid text direction '${layer.direction}'. Valid directions: ${VALID_TEXT_DIRECTIONS.join(', ')}`,
            code: 'INVALID_DIRECTION'
        });
    }
}

/**
 * Validates animation configuration
 */
function validateAnimation(
    animation: any,
    prefix: string,
    _type: 'entrance' | 'exit',
    errors: ValidationError[],
    warnings: ValidationWarning[]
): void {
    if (!animation.type) {
        errors.push({
            field: `${prefix}.type`,
            message: 'Animation type is required',
            code: 'ANIMATION_TYPE_REQUIRED'
        });
        return;
    }

    // Validate duration
    if (animation.duration !== undefined) {
        if (animation.duration < 0) {
            errors.push({
                field: `${prefix}.duration`,
                message: 'Animation duration cannot be negative',
                code: 'INVALID_DURATION'
            });
        } else if (animation.duration > 30) {
            warnings.push({
                field: `${prefix}.duration`,
                message: `Very long animation duration (${animation.duration}s)`,
                suggestion: 'Consider using shorter durations for better user experience'
            });
        }
    }

    // Validate easing
    if (animation.easing && !VALID_EASINGS.includes(animation.easing as any)) {
        warnings.push({
            field: `${prefix}.easing`,
            message: `Unknown easing function '${animation.easing}'`,
            suggestion: `Use one of: ${VALID_EASINGS.join(', ')}`
        });
    }
}

/**
 * Formats validation results as a human-readable string
 */
export function formatValidationResults(result: ValidationResult): string {
    let output = '';

    if (result.valid) {
        output += '✅ Configuration is valid!\n';
    } else {
        output += '❌ Configuration has errors:\n';
    }

    if (result.errors.length > 0) {
        output += '\nErrors:\n';
        result.errors.forEach((error, index) => {
            output += `  ${index + 1}. [${error.code}] ${error.field}: ${error.message}\n`;
        });
    }

    if (result.warnings.length > 0) {
        output += '\nWarnings:\n';
        result.warnings.forEach((warning, index) => {
            output += `  ${index + 1}. ${warning.field}: ${warning.message}\n`;
            output += `     💡 ${warning.suggestion}\n`;
        });
    }

    return output;
}

/**
 * Quick validation function that throws on error
 */
export function validateConfigOrThrow(config: any): void {
    const result = validateConfig(config);
    
    if (!result.valid) {
        const message = formatValidationResults(result);
        throw new Error(`Configuration validation failed:\n${message}`);
    }

    // Log warnings even if valid
    if (result.warnings.length > 0) {
        console.warn('Configuration warnings:');
        result.warnings.forEach(warning => {
            console.warn(`  ${warning.field}: ${warning.message}`);
            console.warn(`  💡 ${warning.suggestion}`);
        });
    }
}
