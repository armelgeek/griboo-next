/**
 * LoadableLayer - Base class for layers with automatic loading management
 * 
 * This class extends the base Layer class and automatically manages loading
 * indicators for heavy operations without requiring external configuration.
 * 
 * Features:
 * - Automatic LoadingManager integration
 * - Unique layer IDs for tracking operations
 * - Protected methods for easy loading management
 * - Automatic cleanup on errors
 * - No external configuration needed - works internally
 * 
 * Usage:
 * ```typescript
 * class MyLayer extends LoadableLayer {
 *   async heavyOperation() {
 *     await this.withLoading('operation-id', 'Chargement...', async () => {
 *       // Heavy operation here
 *     });
 *   }
 * }
 * ```
 */

import { Layer } from '../layer';
import { LayerConfig, WhiteboardConfig } from '../types';
import { LoadingManager } from '../../core/infra/loading';

export abstract class LoadableLayer extends Layer {
    protected loadingManager: LoadingManager;
    protected layerLoadingId: string;
    protected activeLoadingOperations: Set<string>;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        
        // Initialize loading management automatically (internal)
        this.loadingManager = LoadingManager.getInstance();
        this.layerLoadingId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.activeLoadingOperations = new Set();
    }

    /**
     * Execute an async operation with automatic loading indicator
     * This method manages the loading state internally without external configuration
     * 
     * @param operationId - Unique identifier for this operation (e.g., 'load', 'process', 'render')
     * @param message - French message describing the operation
     * @param operation - Async function to execute
     * @param progress - Optional initial progress (0-100)
     * @returns Promise with operation result
     */
    protected async withLoading<T>(
        operationId: string,
        message: string,
        operation: () => Promise<T>,
        progress?: number
    ): Promise<T> {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        
        try {
            // Start loading indicator
            this.activeLoadingOperations.add(fullId);
            this.loadingManager.start(fullId, message, progress);
            
            // Execute operation
            const result = await operation();
            
            // Complete loading
            this.loadingManager.complete(fullId);
            this.activeLoadingOperations.delete(fullId);
            
            return result;
        } catch (error) {
            // Automatic cleanup on error
            this.loadingManager.complete(fullId);
            this.activeLoadingOperations.delete(fullId);
            throw error;
        }
    }

    /**
     * Execute a sync operation with automatic loading indicator
     * Uses requestAnimationFrame to ensure UI updates before starting
     * 
     * @param operationId - Unique identifier for this operation
     * @param message - French message describing the operation
     * @param operation - Sync function to execute
     * @param progress - Optional initial progress (0-100)
     * @returns Promise with operation result
     */
    protected async withLoadingSync<T>(
        operationId: string,
        message: string,
        operation: () => T,
        progress?: number
    ): Promise<T> {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        
        try {
            // Start loading indicator
            this.activeLoadingOperations.add(fullId);
            this.loadingManager.start(fullId, message, progress);
            
            // Allow UI to update
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Execute operation
            const result = operation();
            
            // Complete loading
            this.loadingManager.complete(fullId);
            this.activeLoadingOperations.delete(fullId);
            
            return result;
        } catch (error) {
            // Automatic cleanup on error
            this.loadingManager.complete(fullId);
            this.activeLoadingOperations.delete(fullId);
            throw error;
        }
    }

    /**
     * Update progress for an active loading operation
     * 
     * @param operationId - Operation identifier
     * @param progress - Progress value (0-100)
     * @param message - Optional updated message
     */
    protected updateLoadingProgress(
        operationId: string,
        progress: number,
        message?: string
    ): void {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        if (this.activeLoadingOperations.has(fullId)) {
            this.loadingManager.updateProgress(fullId, progress, message);
        }
    }

    /**
     * Update message for an active loading operation
     * 
     * @param operationId - Operation identifier
     * @param message - New message
     */
    protected updateLoadingMessage(operationId: string, message: string): void {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        if (this.activeLoadingOperations.has(fullId)) {
            this.loadingManager.updateMessage(fullId, message);
        }
    }

    /**
     * Start a loading operation manually (for more control)
     * Use this for operations where you need manual control over completion
     * 
     * @param operationId - Unique identifier
     * @param message - French message
     * @param progress - Optional progress (0-100)
     */
    protected startLoading(
        operationId: string,
        message: string,
        progress?: number
    ): void {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        this.activeLoadingOperations.add(fullId);
        this.loadingManager.start(fullId, message, progress);
    }

    /**
     * Complete a manually started loading operation
     * 
     * @param operationId - Operation identifier
     */
    protected completeLoading(operationId: string): void {
        const fullId = `${this.layerLoadingId}-${operationId}`;
        this.loadingManager.complete(fullId);
        this.activeLoadingOperations.delete(fullId);
    }

    /**
     * Clean up all active loading operations
     * Called automatically on dispose or can be called manually
     */
    protected cleanupLoadingOperations(): void {
        this.activeLoadingOperations.forEach(fullId => {
            this.loadingManager.complete(fullId);
        });
        this.activeLoadingOperations.clear();
    }

    /**
     * Dispose of the layer and cleanup loading operations
     * Override this in subclasses and call super.dispose()
     */
    dispose(): void {
        // Cleanup all active loading operations
        this.cleanupLoadingOperations();
    }

    /**
     * Check if this layer has any active loading operations
     */
    isLoading(): boolean {
        return this.activeLoadingOperations.size > 0;
    }

    /**
     * Get count of active loading operations
     */
    getActiveLoadingCount(): number {
        return this.activeLoadingOperations.size;
    }
}
