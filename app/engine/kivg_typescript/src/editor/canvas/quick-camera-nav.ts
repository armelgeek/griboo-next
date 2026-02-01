/**
 * Quick Camera Navigation Component
 * Provides rapid navigation between cameras using keyboard shortcuts and visual UI
 */

import { Camera } from './scene-canvas';

export interface QuickCameraNavCallbacks {
    onNavigateToCamera?: (cameraId: string) => void;
    onNavigateNext?: () => void;
    onNavigatePrevious?: () => void;
}

export interface QuickCameraNavConfig {
    container: HTMLElement;
    cameras: Camera[];
    selectedCameraId: string | null;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * QuickCameraNav - Floating navigation component for quick camera switching
 * Features:
 * - Keyboard shortcuts (Ctrl+1-9 for cameras 1-9, Ctrl+Arrow for next/prev)
 * - Visual dropdown with camera list
 * - Current camera indicator
 * - Smooth transitions
 */
export class QuickCameraNav {
    private container: HTMLElement;
    private cameras: Camera[];
    private selectedCameraId: string | null;
    private callbacks: QuickCameraNavCallbacks = {};
    private navElement: HTMLDivElement;
    private position: string;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private isDropdownOpen: boolean = false;

    constructor(config: QuickCameraNavConfig) {
        this.container = config.container;
        this.cameras = config.cameras;
        this.selectedCameraId = config.selectedCameraId;
        this.position = config.position || 'top-right';

        this.navElement = document.createElement('div');
        this.navElement.className = 'quick-camera-nav';
        this.render();
        this.container.appendChild(this.navElement);

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    public setCallbacks(callbacks: QuickCameraNavCallbacks): void {
        this.callbacks = callbacks;
    }

    public updateCameras(cameras: Camera[]): void {
        this.cameras = cameras;
        this.render();
    }

    public setSelectedCamera(cameraId: string | null): void {
        this.selectedCameraId = cameraId;
        this.render();
    }

    private setupKeyboardShortcuts(): void {
        this.keydownHandler = (e: KeyboardEvent) => {
            // Only handle if Ctrl/Cmd is pressed
            if (!e.ctrlKey && !e.metaKey) return;

            // Ignore if typing in input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Number keys: Ctrl+1 through Ctrl+9
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < this.cameras.length) {
                    e.preventDefault();
                    const camera = this.cameras[index];
                    this.navigateToCamera(camera.id);
                }
                return;
            }

            // Arrow keys for next/previous
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateNext();
                return;
            }

            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigatePrevious();
                return;
            }

            // Tab key (Ctrl+Tab for next camera)
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.navigatePrevious();
                } else {
                    this.navigateNext();
                }
                return;
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
    }

    private navigateToCamera(cameraId: string): void {
        if (this.callbacks.onNavigateToCamera) {
            this.callbacks.onNavigateToCamera(cameraId);
        }
        this.setSelectedCamera(cameraId);
        this.showNotification(`Caméra: ${this.getCameraName(cameraId)}`);
    }

    private navigateNext(): void {
        if (this.cameras.length === 0) return;

        const currentIndex = this.cameras.findIndex(c => c.id === this.selectedCameraId);
        const nextIndex = (currentIndex + 1) % this.cameras.length;
        const nextCamera = this.cameras[nextIndex];

        if (this.callbacks.onNavigateNext) {
            this.callbacks.onNavigateNext();
        }
        this.navigateToCamera(nextCamera.id);
    }

    private navigatePrevious(): void {
        if (this.cameras.length === 0) return;

        const currentIndex = this.cameras.findIndex(c => c.id === this.selectedCameraId);
        const prevIndex = currentIndex <= 0 ? this.cameras.length - 1 : currentIndex - 1;
        const prevCamera = this.cameras[prevIndex];

        if (this.callbacks.onNavigatePrevious) {
            this.callbacks.onNavigatePrevious();
        }
        this.navigateToCamera(prevCamera.id);
    }

    private getCameraName(cameraId: string): string {
        const camera = this.cameras.find(c => c.id === cameraId);
        return camera?.name || cameraId;
    }

    private showNotification(message: string): void {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'camera-nav-notification';
        notification.textContent = message;
        this.navElement.appendChild(notification);

        // Remove after animation
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 1500);
    }

    private toggleDropdown(): void {
        this.isDropdownOpen = !this.isDropdownOpen;
        this.render();
    }

    private render(): void {
        const selectedCamera = this.cameras.find(c => c.id === this.selectedCameraId);
        const currentCameraName = selectedCamera?.name || 'Aucune caméra';
        const currentIndex = this.cameras.findIndex(c => c.id === this.selectedCameraId);

        this.navElement.innerHTML = `
            ${this.getStyles()}
            <div class="camera-nav-widget ${this.position}">
                <div class="camera-nav-header">
                    <button class="nav-btn nav-prev" title="Caméra précédente (Ctrl+←)" aria-label="Caméra précédente">
                        ◀
                    </button>
                    <button class="camera-current" title="Cliquer pour voir toutes les caméras">
                        <span class="camera-icon">📷</span>
                        <span class="camera-label">${currentCameraName}</span>
                        <span class="camera-index">${currentIndex + 1}/${this.cameras.length}</span>
                    </button>
                    <button class="nav-btn nav-next" title="Caméra suivante (Ctrl+→)" aria-label="Caméra suivante">
                        ▶
                    </button>
                </div>
                ${this.isDropdownOpen ? this.renderDropdown() : ''}
                <div class="shortcuts-hint">
                    💡 Raccourcis: Ctrl+1-9 | Ctrl+← →
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
    }

    private renderDropdown(): string {
        const items = this.cameras.map((camera, index) => {
            const isSelected = camera.id === this.selectedCameraId;
            const shortcut = index < 9 ? `Ctrl+${index + 1}` : '';
            return `
                <div class="dropdown-item ${isSelected ? 'selected' : ''}" data-camera-id="${camera.id}">
                    <span class="item-icon">${isSelected ? '✓' : '📷'}</span>
                    <span class="item-name">${camera.name || camera.id}</span>
                    ${camera.isDefault ? '<span class="item-badge">Défaut</span>' : ''}
                    ${shortcut ? `<span class="item-shortcut">${shortcut}</span>` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="camera-dropdown">
                ${items || '<div class="dropdown-empty">Aucune caméra disponible</div>'}
            </div>
        `;
    }

    private attachEventListeners(): void {
        // Previous button
        const prevBtn = this.navElement.querySelector('.nav-prev') as HTMLButtonElement;
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigatePrevious();
            });
        }

        // Next button
        const nextBtn = this.navElement.querySelector('.nav-next') as HTMLButtonElement;
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigateNext();
            });
        }

        // Current camera button (toggle dropdown)
        const currentBtn = this.navElement.querySelector('.camera-current') as HTMLButtonElement;
        if (currentBtn) {
            currentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Dropdown items
        const dropdownItems = this.navElement.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const cameraId = item.getAttribute('data-camera-id');
                if (cameraId) {
                    this.navigateToCamera(cameraId);
                    this.isDropdownOpen = false;
                    this.render();
                }
            });
        });

        // Close dropdown when clicking outside
        if (this.isDropdownOpen) {
            const closeDropdown = (e: MouseEvent) => {
                if (!this.navElement.contains(e.target as Node)) {
                    this.isDropdownOpen = false;
                    this.render();
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 0);
        }
    }

    private getStyles(): string {
        return `
            <style>
                .quick-camera-nav {
                    position: relative;
                    z-index: 9999;
                }

                .camera-nav-widget {
                    position: fixed;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    padding: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    min-width: 280px;
                }

                .camera-nav-widget.top-left {
                    top: 20px;
                    left: 20px;
                }

                .camera-nav-widget.top-right {
                    top: 20px;
                    right: 20px;
                }

                .camera-nav-widget.bottom-left {
                    bottom: 20px;
                    left: 20px;
                }

                .camera-nav-widget.bottom-right {
                    bottom: 20px;
                    right: 20px;
                }

                .camera-nav-header {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .nav-btn {
                    width: 32px;
                    height: 32px;
                    border: 1px solid #cbd5e0;
                    border-radius: 6px;
                    background: white;
                    color: #4a5568;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nav-btn:hover {
                    background: #f7fafc;
                    border-color: #667eea;
                    color: #667eea;
                }

                .nav-btn:active {
                    transform: scale(0.95);
                }

                .camera-current {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border: 1px solid #cbd5e0;
                    border-radius: 6px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }

                .camera-current:hover {
                    background: #f7fafc;
                    border-color: #667eea;
                }

                .camera-icon {
                    font-size: 16px;
                }

                .camera-label {
                    flex: 1;
                    text-align: left;
                    font-weight: 500;
                    color: #2d3748;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .camera-index {
                    font-size: 12px;
                    color: #a0aec0;
                    background: #f7fafc;
                    padding: 2px 8px;
                    border-radius: 12px;
                }

                .shortcuts-hint {
                    font-size: 11px;
                    color: #718096;
                    text-align: center;
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #e2e8f0;
                }

                .camera-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 4px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    max-height: 300px;
                    overflow-y: auto;
                    z-index: 10000;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                    border-bottom: 1px solid #f7fafc;
                }

                .dropdown-item:last-child {
                    border-bottom: none;
                }

                .dropdown-item:hover {
                    background: #f7fafc;
                }

                .dropdown-item.selected {
                    background: #edf2f7;
                    font-weight: 500;
                }

                .item-icon {
                    font-size: 14px;
                }

                .item-name {
                    flex: 1;
                    font-size: 13px;
                    color: #2d3748;
                }

                .item-badge {
                    font-size: 10px;
                    background: #667eea;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 8px;
                }

                .item-shortcut {
                    font-size: 11px;
                    color: #a0aec0;
                    background: #f7fafc;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }

                .dropdown-empty {
                    padding: 16px;
                    text-align: center;
                    color: #a0aec0;
                    font-size: 13px;
                }

                .camera-nav-notification {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.85);
                    color: white;
                    padding: 16px 32px;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: 500;
                    pointer-events: none;
                    z-index: 10001;
                    animation: fadeInOut 1.8s ease;
                }

                .camera-nav-notification.fade-out {
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
            </style>
        `;
    }

    public destroy(): void {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        this.navElement.remove();
    }
}
