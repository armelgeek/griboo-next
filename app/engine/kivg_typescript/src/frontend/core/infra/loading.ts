/**
 * Loading Indicator System for Heavy Operations
 * 
 * This module provides a centralized loading indicator system for operations
 * that take significant time to complete, such as:
 * - Image processing (resizing with INTER_LANCZOS4)
 * - Stroke extraction with edge detection
 * - Color region detection with flood fill
 * - Large data processing
 * 
 * The system supports:
 * - Multiple concurrent loading operations
 * - Progress tracking with percentage
 * - Custom messages for each operation
 * - Automatic cleanup on completion
 * - Event callbacks for state changes
 */

export interface LoadingState {
    id: string;
    message: string;
    progress?: number;  // 0-100, undefined for indeterminate
    startTime: number;
}

export type LoadingCallback = (states: LoadingState[]) => void;

/**
 * LoadingManager - Centralized loading state management
 * Automatically creates and manages a LoadingIndicatorUI for visual feedback
 */
export class LoadingManager {
    private static instance: LoadingManager | null = null;
    private loadingStates: Map<string, LoadingState> = new Map();
    private callbacks: Set<LoadingCallback> = new Set();
    private autoUI: LoadingIndicatorUI | null = null;

    private constructor() {
        LoadingManager.instance = this;
        // Auto-create UI when in browser environment
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            // Wait for DOM to be ready, then create UI
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.initializeAutoUI();
                });
            } else {
                // DOM already loaded
                this.initializeAutoUI();
            }
        }
    }

    /**
     * Initialize the automatic UI indicator
     * This is called automatically - no manual setup needed
     */
    private initializeAutoUI(): void {
        if (!this.autoUI && typeof document !== 'undefined') {
            try {
                this.autoUI = new LoadingIndicatorUI();
            } catch (error) {
                console.warn('[LoadingManager] Failed to create auto UI:', error);
            }
        }
    }

    /**
     * Get singleton instance
     * The UI is automatically created when first accessed
     */
    static getInstance(): LoadingManager {
        if (!LoadingManager.instance) {
            LoadingManager.instance = new LoadingManager();
        }
        return LoadingManager.instance;
    }

    /**
     * Start a new loading operation
     * @param id - Unique identifier for this operation
     * @param message - Human-readable message describing the operation
     * @param progress - Optional initial progress (0-100)
     */
    start(id: string, message: string, progress?: number): void {
        const state: LoadingState = {
            id,
            message,
            progress,
            startTime: Date.now()
        };
        this.loadingStates.set(id, state);
        this.notifyCallbacks();
    }

    /**
     * Update progress for an existing loading operation
     * @param id - Operation identifier
     * @param progress - Progress value (0-100)
     * @param message - Optional updated message
     */
    updateProgress(id: string, progress: number, message?: string): void {
        const state = this.loadingStates.get(id);
        if (state) {
            state.progress = progress;
            if (message) {
                state.message = message;
            }
            this.notifyCallbacks();
        }
    }

    /**
     * Update message for an existing loading operation
     * @param id - Operation identifier
     * @param message - New message
     */
    updateMessage(id: string, message: string): void {
        const state = this.loadingStates.get(id);
        if (state) {
            state.message = message;
            this.notifyCallbacks();
        }
    }

    /**
     * Complete and remove a loading operation
     * @param id - Operation identifier
     */
    complete(id: string): void {
        this.loadingStates.delete(id);
        this.notifyCallbacks();
    }

    /**
     * Check if any operations are currently loading
     */
    isLoading(): boolean {
        return this.loadingStates.size > 0;
    }

    /**
     * Get all current loading states
     */
    getStates(): LoadingState[] {
        return Array.from(this.loadingStates.values());
    }

    /**
     * Register a callback to be notified of state changes
     * @param callback - Function to call when loading state changes
     * @returns Unsubscribe function
     */
    subscribe(callback: LoadingCallback): () => void {
        this.callbacks.add(callback);
        // Return unsubscribe function
        return () => {
            this.callbacks.delete(callback);
        };
    }

    /**
     * Notify all registered callbacks
     */
    private notifyCallbacks(): void {
        const states = this.getStates();
        this.callbacks.forEach(callback => {
            try {
                callback(states);
            } catch (error) {
                console.error('[LoadingManager] Callback error:', error);
            }
        });
    }

    /**
     * Clear all loading states (use with caution)
     */
    clearAll(): void {
        this.loadingStates.clear();
        this.notifyCallbacks();
    }
}

/**
 * LoadingIndicatorUI - Visual loading indicator component
 * Creates a DOM element to show loading states
 */
export class LoadingIndicatorUI {
    private container: HTMLDivElement | null = null;
    private unsubscribe: (() => void) | null = null;
    private manager: LoadingManager;

    constructor(targetElement?: HTMLElement) {
        this.manager = LoadingManager.getInstance();
        this.createUI(targetElement);
        this.unsubscribe = this.manager.subscribe(this.render.bind(this));
    }

    /**
     * Create the loading indicator UI
     */
    private createUI(targetElement?: HTMLElement): void {
        this.container = document.createElement('div');
        this.container.id = 'kivg-loading-indicator';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 250px;
            max-width: 400px;
            display: none;
            transition: opacity 0.3s ease;
        `;

        if (targetElement) {
            targetElement.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }
    }

    /**
     * Render the loading states
     */
    private render(states: LoadingState[]): void {
        if (!this.container) return;

        if (states.length === 0) {
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'block';

        const html = states.map(state => {
            const elapsed = Math.round((Date.now() - state.startTime) / 1000);
            const progressBar = state.progress !== undefined
                ? `<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-top: 8px; overflow: hidden;">
                     <div style="width: ${state.progress}%; height: 100%; background: #3b82f6; transition: width 0.3s ease;"></div>
                   </div>`
                : '';

            return `
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; margin-bottom: 4px;">
                        <div class="spinner" style="
                            width: 16px;
                            height: 16px;
                            border: 2px solid rgba(255,255,255,0.3);
                            border-top-color: #3b82f6;
                            border-radius: 50%;
                            animation: spin 0.8s linear infinite;
                            margin-right: 8px;
                        "></div>
                        <span style="flex: 1;">${state.message}</span>
                        <span style="font-size: 12px; opacity: 0.7;">${elapsed}s</span>
                    </div>
                    ${progressBar}
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
            ${html}
        `;
    }

    /**
     * Destroy the loading indicator and clean up
     */
    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}

/**
 * Helper function to wrap an async operation with loading indicator
 * @param id - Unique identifier for the operation
 * @param message - Loading message
 * @param operation - Async function to execute
 * @returns Promise with the operation result
 */
export async function withLoading<T>(
    id: string,
    message: string,
    operation: () => Promise<T>
): Promise<T> {
    const manager = LoadingManager.getInstance();

    try {
        manager.start(id, message);
        const result = await operation();
        manager.complete(id);
        return result;
    } catch (error) {
        manager.complete(id);
        throw error;
    }
}

/**
 * Helper function to wrap a sync operation with loading indicator
 * Uses requestAnimationFrame to ensure UI updates before starting heavy operation
 */
export async function withLoadingSync<T>(
    id: string,
    message: string,
    operation: () => T
): Promise<T> {
    const manager = LoadingManager.getInstance();

    try {
        manager.start(id, message);
        // Allow UI to update by waiting for next animation frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        const result = operation();
        manager.complete(id);
        return result;
    } catch (error) {
        manager.complete(id);
        throw error;
    }
}
