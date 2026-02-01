/**
 * Camera Controls Panel
 * Provides UI for managing multiple cameras in the editor
 */

import { Camera } from './scene-canvas';

export interface CameraControlsCallbacks {
    onCameraSelect?: (cameraId: string | null) => void;
    onCameraAdd?: () => void;
    onCameraRemove?: (cameraId: string) => void;
    onCameraDuplicate?: (cameraId: string) => void;
    onCameraUpdate?: (cameraId: string, updates: Partial<Camera>) => void;
    onVirtualSizeUpdate?: (width: number, height: number) => void;
}

export interface CameraControlsConfig {
    container: HTMLElement;
    cameras: Camera[];
    selectedCameraId: string | null;
    virtualSize?: { width: number; height: number };
}

/**
 * Pure HTML/JS class for rendering camera control panel
 */
export class CameraControls {
    private container: HTMLElement;
    private cameras: Camera[];
    private selectedCameraId: string | null;
    private virtualSize: { width: number; height: number };
    private callbacks: CameraControlsCallbacks = {};
    private panelElement: HTMLDivElement;

    constructor(config: CameraControlsConfig) {
        this.container = config.container;
        this.cameras = config.cameras;
        this.selectedCameraId = config.selectedCameraId;
        this.virtualSize = config.virtualSize || { width: 1920, height: 1080 };

        this.panelElement = document.createElement('div');
        this.render();
        this.container.appendChild(this.panelElement);
    }

    public setCallbacks(callbacks: CameraControlsCallbacks): void {
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

    public updateVirtualSize(width: number, height: number): void {
        this.virtualSize = { width, height };
        this.render();
    }

    private render(): void {
        this.panelElement.innerHTML = '';
        this.panelElement.className = 'camera-controls-panel';
        this.panelElement.innerHTML = this.getStyles();

        const panel = document.createElement('div');
        panel.className = 'camera-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'camera-panel-header';
        header.innerHTML = `
            <h3 aria-label="Caméras">📷 Caméras</h3>
            <button class="btn-add-camera" title="Ajouter une caméra" aria-label="Ajouter une caméra">+</button>
        `;
        panel.appendChild(header);

        // Add camera button handler
        const addBtn = header.querySelector('.btn-add-camera') as HTMLButtonElement;
        addBtn.addEventListener('click', () => {
            if (this.callbacks.onCameraAdd) {
                this.callbacks.onCameraAdd();
            }
        });

        // Virtual canvas size section
        const virtualSection = document.createElement('div');
        virtualSection.className = 'virtual-size-section';
        virtualSection.innerHTML = `
            <div class="section-title">Taille de la Scène</div>
            <div class="input-row">
                <div class="input-group">
                    <label>Largeur</label>
                    <input type="number" class="input-width" value="${this.virtualSize.width}" min="100" step="100" />
                </div>
                <div class="input-group">
                    <label>Hauteur</label>
                    <input type="number" class="input-height" value="${this.virtualSize.height}" min="100" step="100" />
                </div>
            </div>
        `;
        panel.appendChild(virtualSection);

        // Virtual size input handlers
        const widthInput = virtualSection.querySelector('.input-width') as HTMLInputElement;
        const heightInput = virtualSection.querySelector('.input-height') as HTMLInputElement;

        const updateVirtualSize = () => {
            const width = parseInt(widthInput.value) || 1920;
            const height = parseInt(heightInput.value) || 1080;
            if (this.callbacks.onVirtualSizeUpdate) {
                this.callbacks.onVirtualSizeUpdate(width, height);
            }
        };

        widthInput.addEventListener('change', updateVirtualSize);
        heightInput.addEventListener('change', updateVirtualSize);

        // Camera list
        const listContainer = document.createElement('div');
        listContainer.className = 'camera-list';

        if (this.cameras.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Aucune caméra. Cliquez + pour en ajouter.';
            listContainer.appendChild(emptyState);
        } else {
            this.cameras.forEach(camera => {
                const item = this.createCameraItem(camera);
                listContainer.appendChild(item);
            });
        }

        panel.appendChild(listContainer);

        // Camera properties (if selected)
        if (this.selectedCameraId) {
            const selectedCamera = this.cameras.find(c => c.id === this.selectedCameraId);
            if (selectedCamera) {
                const properties = this.createCameraProperties(selectedCamera);
                panel.appendChild(properties);
            }
        }

        this.panelElement.appendChild(panel);
    }

    private createCameraItem(camera: Camera): HTMLDivElement {
        const item = document.createElement('div');
        item.className = `camera-item ${camera.id === this.selectedCameraId ? 'selected' : ''}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'camera-name';
        nameSpan.textContent = camera.name || camera.id;
        if (camera.isDefault) {
            const badge = document.createElement('span');
            badge.className = 'default-badge';
            badge.textContent = 'Défaut';
            nameSpan.appendChild(badge);
        }
        item.appendChild(nameSpan);

        const actions = document.createElement('div');
        actions.className = 'camera-actions';

        // Duplicate button
        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'btn-icon';
        duplicateBtn.title = 'Dupliquer';
        duplicateBtn.innerHTML = '📋';
        duplicateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.callbacks.onCameraDuplicate) {
                this.callbacks.onCameraDuplicate(camera.id);
            }
        });
        actions.appendChild(duplicateBtn);

        // Delete button (disabled for default camera)
        if (!camera.isDefault) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon btn-danger';
            deleteBtn.title = 'Supprimer';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Supprimer la caméra "${camera.name || camera.id}" ?`)) {
                    if (this.callbacks.onCameraRemove) {
                        this.callbacks.onCameraRemove(camera.id);
                    }
                }
            });
            actions.appendChild(deleteBtn);
        }

        item.appendChild(actions);

        // Click to select
        item.addEventListener('click', () => {
            if (this.callbacks.onCameraSelect) {
                this.callbacks.onCameraSelect(camera.id);
            }
        });

        return item;
    }

    private createCameraProperties(camera: Camera): HTMLDivElement {
        const properties = document.createElement('div');
        properties.className = 'camera-properties';

        properties.innerHTML = `
            <div class="section-title">Propriétés de la Caméra</div>
            
            <div class="input-group">
                <label>Nom</label>
                <input type="text" class="input-name" value="${camera.name || ''}" />
            </div>

            <div class="input-row">
                <div class="input-group">
                    <label>Largeur</label>
                    <input type="number" class="input-width" value="${camera.width || 800}" min="100" step="10" />
                </div>
                <div class="input-group">
                    <label>Hauteur</label>
                    <input type="number" class="input-height" value="${camera.height || 450}" min="100" step="10" />
                </div>
            </div>

            <div class="input-row">
                <div class="input-group">
                    <label>Position X (Centre)</label>
                    <input type="number" class="input-pos-x" value="${camera.position.x.toFixed(0)}" min="0" max="${this.virtualSize.width}" step="1" />
                    <span class="input-suffix">px</span>
                </div>
                <div class="input-group">
                    <label>Position Y (Centre)</label>
                    <input type="number" class="input-pos-y" value="${camera.position.y.toFixed(0)}" min="0" max="${this.virtualSize.height}" step="1" />
                    <span class="input-suffix">px</span>
                </div>
            </div>

            <div class="input-group">
                <label>Zoom</label>
                <input type="range" class="input-zoom" min="0.1" max="3" step="0.1" value="${camera.zoom || 1}" />
                <span class="zoom-value">${(camera.zoom || 1).toFixed(1)}x</span>
            </div>

            <div class="input-group">
                <label>
                    <input type="checkbox" class="input-locked" ${camera.locked ? 'checked' : ''} />
                    Verrouillé
                </label>
            </div>
        `;

        // Event handlers for property changes
        const nameInput = properties.querySelector('.input-name') as HTMLInputElement;
        const widthInput = properties.querySelector('.input-width') as HTMLInputElement;
        const heightInput = properties.querySelector('.input-height') as HTMLInputElement;
        const posXInput = properties.querySelector('.input-pos-x') as HTMLInputElement;
        const posYInput = properties.querySelector('.input-pos-y') as HTMLInputElement;
        const zoomInput = properties.querySelector('.input-zoom') as HTMLInputElement;
        const zoomValue = properties.querySelector('.zoom-value') as HTMLSpanElement;
        const lockedInput = properties.querySelector('.input-locked') as HTMLInputElement;

        const updateCamera = () => {
            if (this.callbacks.onCameraUpdate) {
                this.callbacks.onCameraUpdate(camera.id, {
                    name: nameInput.value,
                    width: parseInt(widthInput.value) || 800,
                    height: parseInt(heightInput.value) || 450,
                    position: {
                        x: parseFloat(posXInput.value),
                        y: parseFloat(posYInput.value),
                    },
                    zoom: parseFloat(zoomInput.value),
                    locked: lockedInput.checked,
                });
            }
        };

        nameInput.addEventListener('change', updateCamera);
        widthInput.addEventListener('change', updateCamera);
        heightInput.addEventListener('change', updateCamera);
        posXInput.addEventListener('change', updateCamera);
        posYInput.addEventListener('change', updateCamera);
        lockedInput.addEventListener('change', updateCamera);

        zoomInput.addEventListener('input', () => {
            zoomValue.textContent = `${parseFloat(zoomInput.value).toFixed(1)}x`;
        });
        zoomInput.addEventListener('change', updateCamera);

        return properties;
    }

    private getStyles(): string {
        return `
            <style>
                .camera-controls-panel {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    font-size: 14px;
                    color: #2d3748;
                }

                .camera-panel {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .camera-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .camera-panel-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .btn-add-camera {
                    background: white;
                    color: #667eea;
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    font-size: 20px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-add-camera:hover {
                    transform: scale(1.1);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }

                .virtual-size-section {
                    padding: 16px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #f7fafc;
                }

                .section-title {
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: #4a5568;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .input-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    position: relative;
                }

                .input-group label {
                    font-size: 12px;
                    color: #718096;
                    font-weight: 500;
                }

                .input-group input[type="text"],
                .input-group input[type="number"] {
                    padding: 8px;
                    border: 1px solid #cbd5e0;
                    border-radius: 4px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }

                .input-group input[type="text"]:focus,
                .input-group input[type="number"]:focus {
                    outline: none;
                    border-color: #667eea;
                }

                .input-group input[type="range"] {
                    width: 100%;
                }

                .input-suffix {
                    position: absolute;
                    right: 12px;
                    top: 32px;
                    color: #a0aec0;
                    font-size: 12px;
                    pointer-events: none;
                }

                .zoom-value {
                    font-size: 12px;
                    color: #667eea;
                    font-weight: 600;
                    text-align: center;
                    margin-top: 4px;
                }

                .camera-list {
                    max-height: 300px;
                    overflow-y: auto;
                }

                .empty-state {
                    padding: 40px 20px;
                    text-align: center;
                    color: #a0aec0;
                    font-style: italic;
                }

                .camera-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid #e2e8f0;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .camera-item:hover {
                    background: #f7fafc;
                }

                .camera-item.selected {
                    background: #edf2f7;
                    border-left: 3px solid #667eea;
                }

                .camera-name {
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .default-badge {
                    display: inline-block;
                    background: #48bb78;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .camera-actions {
                    display: flex;
                    gap: 4px;
                }

                .btn-icon {
                    background: transparent;
                    border: 1px solid #cbd5e0;
                    border-radius: 4px;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }

                .btn-icon:hover {
                    background: #edf2f7;
                    transform: scale(1.05);
                }

                .btn-icon.btn-danger:hover {
                    background: #fed7d7;
                    border-color: #fc8181;
                }

                .camera-properties {
                    padding: 16px;
                    border-top: 2px solid #e2e8f0;
                    background: #f7fafc;
                }

                .camera-properties .input-group {
                    margin-bottom: 12px;
                }
            </style>
        `;
    }

    public destroy(): void {
        this.panelElement.remove();
    }
}
