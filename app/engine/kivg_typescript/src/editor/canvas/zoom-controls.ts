/**
 * Zoom Controls UI Component
 * Provides visual controls for zoom in/out and displays current zoom level
 */

export interface ZoomControlsConfig {
    container: HTMLElement;
    initialZoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onZoomReset?: () => void;
}

export class ZoomControls {
    private container: HTMLElement;
    private controlsContainer: HTMLDivElement;
    private zoomDisplay: HTMLDivElement;
    private currentZoom: number;
    private minZoom: number;
    private maxZoom: number;
    private config: ZoomControlsConfig;

    constructor(config: ZoomControlsConfig) {
        this.config = config;
        this.container = config.container;
        this.currentZoom = config.initialZoom || 1.0;
        this.minZoom = config.minZoom || 0.1;
        this.maxZoom = config.maxZoom || 5.0;

        this.controlsContainer = this.createControlsUI();
        this.zoomDisplay = this.controlsContainer.querySelector('.zoom-display') as HTMLDivElement;
        
        this.container.appendChild(this.controlsContainer);
        this.updateZoomDisplay();
    }

    private createControlsUI(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'zoom-controls';
        container.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
        `;

        // Zoom Out Button
        const zoomOutBtn = this.createButton('-', 'Zoom Out', () => {
            if (this.config.onZoomOut) {
                this.config.onZoomOut();
            }
        });

        // Zoom Display
        const zoomDisplay = document.createElement('div');
        zoomDisplay.className = 'zoom-display';
        zoomDisplay.style.cssText = `
            min-width: 60px;
            text-align: center;
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        `;
        zoomDisplay.title = 'Click to reset zoom (Fit to Screen)';
        zoomDisplay.addEventListener('click', () => {
            if (this.config.onZoomReset) {
                this.config.onZoomReset();
            }
        });
        zoomDisplay.addEventListener('mouseenter', () => {
            zoomDisplay.style.backgroundColor = '#f7fafc';
        });
        zoomDisplay.addEventListener('mouseleave', () => {
            zoomDisplay.style.backgroundColor = 'transparent';
        });

        // Zoom In Button
        const zoomInBtn = this.createButton('+', 'Zoom In', () => {
            if (this.config.onZoomIn) {
                this.config.onZoomIn();
            }
        });

        // Instructions tooltip
        const helpIcon = document.createElement('div');
        helpIcon.innerHTML = '?';
        helpIcon.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #667eea;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            cursor: help;
            margin-left: 4px;
        `;
        helpIcon.title = 'Controls:\n• Mouse Wheel: Zoom in/out\n• Space + Drag: Pan canvas\n• Middle Mouse: Pan canvas';
        helpIcon.setAttribute('role', 'button');
        helpIcon.setAttribute('aria-label', 'Show zoom and pan controls help');
        helpIcon.setAttribute('tabindex', '0');

        container.appendChild(zoomOutBtn);
        container.appendChild(zoomDisplay);
        container.appendChild(zoomInBtn);
        container.appendChild(helpIcon);

        return container;
    }

    private createButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = label;
        button.title = title;
        button.style.cssText = `
            width: 32px;
            height: 32px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: white;
            color: #2d3748;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#667eea';
            button.style.color = 'white';
            button.style.borderColor = '#667eea';
            button.style.transform = 'scale(1.05)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'white';
            button.style.color = '#2d3748';
            button.style.borderColor = '#e2e8f0';
            button.style.transform = 'scale(1)';
        });

        button.addEventListener('click', onClick);

        return button;
    }

    public updateZoom(zoom: number): void {
        this.currentZoom = zoom;
        this.updateZoomDisplay();
    }

    private updateZoomDisplay(): void {
        const percentage = Math.round(this.currentZoom * 100);
        this.zoomDisplay.textContent = `${percentage}%`;
    }

    public destroy(): void {
        if (this.controlsContainer && this.controlsContainer.parentElement) {
            this.controlsContainer.parentElement.removeChild(this.controlsContainer);
        }
    }

    public show(): void {
        this.controlsContainer.style.display = 'flex';
    }

    public hide(): void {
        this.controlsContainer.style.display = 'none';
    }
}
