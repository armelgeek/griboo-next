/**
 * Custom scrollbars for the SceneCanvas
 * Provides visual navigation aids for large scenes
 */

export interface ScrollbarsConfig {
    container: HTMLDivElement;
    sceneWidth: number;
    sceneHeight: number;
    onScroll: (x: number, y: number) => void;
}

export class Scrollbars {
    private container: HTMLDivElement;
    private sceneWidth: number;
    private sceneHeight: number;
    private onScroll: (x: number, y: number) => void;

    private horizontalScrollbar: HTMLDivElement | null = null;
    private verticalScrollbar: HTMLDivElement | null = null;
    private horizontalThumb: HTMLDivElement | null = null;
    private verticalThumb: HTMLDivElement | null = null;

    private isDraggingHorizontal = false;
    private isDraggingVertical = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragStartScrollX = 0;
    private dragStartScrollY = 0;

    private currentX = 0;
    private currentY = 0;
    private currentZoom = 1;

    constructor(config: ScrollbarsConfig) {
        this.container = config.container;
        this.sceneWidth = config.sceneWidth;
        this.sceneHeight = config.sceneHeight;
        this.onScroll = config.onScroll;

        this.createScrollbars();
        this.setupEventListeners();
    }

    private createScrollbars(): void {
        const scrollbarStyle = (isVertical: boolean) => `
            position: absolute;
            ${isVertical ? 'top: 6px; right: 6px; bottom: 6px; width: 6px;' : 'bottom: 6px; left: 6px; right: 6px; height: 6px;'}
            background: rgba(0, 0, 0, 0.05);
            border-radius: 10px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(4px);
        `;

        const thumbStyle = (isVertical: boolean) => `
            position: absolute;
            top: 0;
            left: 0;
            ${isVertical ? 'width: 100%;' : 'height: 100%;'}
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.2s, transform 0.2s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        // Horizontal scrollbar
        this.horizontalScrollbar = document.createElement('div');
        this.horizontalScrollbar.className = 'scene-scrollbar scene-scrollbar-horizontal';
        this.horizontalScrollbar.style.cssText = scrollbarStyle(false);

        this.horizontalThumb = document.createElement('div');
        this.horizontalThumb.className = 'scene-scrollbar-thumb';
        this.horizontalThumb.style.cssText = thumbStyle(false);
        this.horizontalScrollbar.appendChild(this.horizontalThumb);
        this.container.appendChild(this.horizontalScrollbar);

        // Vertical scrollbar
        this.verticalScrollbar = document.createElement('div');
        this.verticalScrollbar.className = 'scene-scrollbar scene-scrollbar-vertical';
        this.verticalScrollbar.style.cssText = scrollbarStyle(true);

        this.verticalThumb = document.createElement('div');
        this.verticalThumb.className = 'scene-scrollbar-thumb';
        this.verticalThumb.style.cssText = thumbStyle(true);
        this.verticalScrollbar.appendChild(this.verticalThumb);
        this.container.appendChild(this.verticalScrollbar);

        // Hover effects in JS (since we're modifying inline styles)
        const setupHover = (track: HTMLElement, thumb: HTMLElement, isVertical: boolean) => {
            track.addEventListener('mouseenter', () => {
                track.style.opacity = '1';
                track.style[isVertical ? 'width' : 'height'] = '10px';
                thumb.style.background = 'rgba(0, 0, 0, 0.3)';
            });
            track.addEventListener('mouseleave', () => {
                if (!this.isDraggingHorizontal && !this.isDraggingVertical) {
                    track.style[isVertical ? 'width' : 'height'] = '6px';
                    thumb.style.background = 'rgba(0, 0, 0, 0.2)';
                }
            });
        };

        if (this.horizontalScrollbar && this.horizontalThumb) setupHover(this.horizontalScrollbar, this.horizontalThumb, false);
        if (this.verticalScrollbar && this.verticalThumb) setupHover(this.verticalScrollbar, this.verticalThumb, true);

        // Show scrollbars more prominently on container hover
        const onContainerEnter = () => {
            if (this.horizontalScrollbar) this.horizontalScrollbar.style.opacity = '1';
            if (this.verticalScrollbar) this.verticalScrollbar.style.opacity = '1';
        };

        const onContainerLeave = () => {
            if (!this.isDraggingHorizontal && !this.isDraggingVertical) {
                if (this.horizontalScrollbar) this.horizontalScrollbar.style.opacity = '0';
                if (this.verticalScrollbar) this.verticalScrollbar.style.opacity = '0';
            }
        };

        this.container.addEventListener('mouseenter', onContainerEnter);
        this.container.addEventListener('mouseleave', onContainerLeave);

        // Initial update
        setTimeout(() => this.updateThumbPositions(), 100);
    }


    private setupEventListeners(): void {
        // Horizontal thumb drag
        this.horizontalThumb?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingHorizontal = true;
            this.dragStartX = e.clientX;
            this.dragStartScrollX = this.currentX;
            this.horizontalThumb!.style.background = 'rgba(0, 0, 0, 0.5)';
        });

        // Vertical thumb drag
        this.verticalThumb?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDraggingVertical = true;
            this.dragStartY = e.clientY;
            this.dragStartScrollY = this.currentY;
            this.verticalThumb!.style.background = 'rgba(0, 0, 0, 0.5)';
        });

        // Global mouse move and up
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Click on scrollbar track to jump
        this.horizontalScrollbar?.addEventListener('click', (e) => {
            if (e.target === this.horizontalScrollbar) {
                const rect = this.horizontalScrollbar!.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const trackWidth = rect.width;
                const scrollableWidth = this.getScrollableWidth();
                const newX = -(clickX / trackWidth) * scrollableWidth;
                this.onScroll(newX, this.currentY);
            }
        });

        this.verticalScrollbar?.addEventListener('click', (e) => {
            if (e.target === this.verticalScrollbar) {
                const rect = this.verticalScrollbar!.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const trackHeight = rect.height;
                const scrollableHeight = this.getScrollableHeight();
                const newY = -(clickY / trackHeight) * scrollableHeight;
                this.onScroll(this.currentX, newY);
            }
        });
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.isDraggingHorizontal && this.horizontalScrollbar) {
            const deltaX = e.clientX - this.dragStartX;
            const trackWidth = this.horizontalScrollbar.getBoundingClientRect().width;
            const scrollableWidth = this.getScrollableWidth();
            const scrollRatio = scrollableWidth / trackWidth;
            const newX = this.dragStartScrollX - deltaX * scrollRatio;
            const clampedX = Math.max(-scrollableWidth + this.container.clientWidth, Math.min(0, newX));
            this.onScroll(clampedX, this.currentY);
        }

        if (this.isDraggingVertical && this.verticalScrollbar) {
            const deltaY = e.clientY - this.dragStartY;
            const trackHeight = this.verticalScrollbar.getBoundingClientRect().height;
            const scrollableHeight = this.getScrollableHeight();
            const scrollRatio = scrollableHeight / trackHeight;
            const newY = this.dragStartScrollY - deltaY * scrollRatio;
            const clampedY = Math.max(-scrollableHeight + this.container.clientHeight, Math.min(0, newY));
            this.onScroll(this.currentX, clampedY);
        }
    }

    private handleMouseUp(): void {
        if (this.isDraggingHorizontal) {
            this.isDraggingHorizontal = false;
            if (this.horizontalThumb) {
                this.horizontalThumb.style.background = 'rgba(0, 0, 0, 0.3)';
            }
        }

        if (this.isDraggingVertical) {
            this.isDraggingVertical = false;
            if (this.verticalThumb) {
                this.verticalThumb.style.background = 'rgba(0, 0, 0, 0.3)';
            }
        }

        // Hide scrollbars if mouse is outside container
        const rect = this.container.getBoundingClientRect();
        const mouseX = (window as any).event?.clientX || 0;
        const mouseY = (window as any).event?.clientY || 0;
        if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
            if (this.horizontalScrollbar) this.horizontalScrollbar.style.opacity = '0';
            if (this.verticalScrollbar) this.verticalScrollbar.style.opacity = '0';
        }
    }

    private getScrollableWidth(): number {
        return this.sceneWidth * this.currentZoom;
    }

    private getScrollableHeight(): number {
        return this.sceneHeight * this.currentZoom;
    }

    public update(x: number, y: number, zoom: number): void {
        this.currentX = x;
        this.currentY = y;
        this.currentZoom = zoom;

        this.updateThumbPositions();
    }

    public updateSceneSize(width: number, height: number): void {
        this.sceneWidth = width;
        this.sceneHeight = height;
        this.updateThumbPositions();
    }

    private updateThumbPositions(): void {
        if (!this.horizontalScrollbar || !this.horizontalThumb) return;
        if (!this.verticalScrollbar || !this.verticalThumb) return;

        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        const scrollableWidth = this.getScrollableWidth();
        const scrollableHeight = this.getScrollableHeight();

        // Calculate thumb sizes (proportion of viewport to total scrollable area)
        const hThumbWidth = Math.max(30, (containerWidth / scrollableWidth) * this.horizontalScrollbar.clientWidth);
        const vThumbHeight = Math.max(30, (containerHeight / scrollableHeight) * this.verticalScrollbar.clientHeight);

        // Calculate thumb positions
        const hTrackWidth = this.horizontalScrollbar.clientWidth - hThumbWidth;
        const vTrackHeight = this.verticalScrollbar.clientHeight - vThumbHeight;

        // Position is based on current pan position relative to max scroll
        const maxScrollX = scrollableWidth - containerWidth;
        const maxScrollY = scrollableHeight - containerHeight;

        const hThumbPos = maxScrollX > 0 ? (-this.currentX / maxScrollX) * hTrackWidth : 0;
        const vThumbPos = maxScrollY > 0 ? (-this.currentY / maxScrollY) * vTrackHeight : 0;

        // Apply sizes and positions
        this.horizontalThumb.style.width = `${hThumbWidth}px`;
        this.horizontalThumb.style.left = `${Math.max(0, Math.min(hTrackWidth, hThumbPos))}px`;

        this.verticalThumb.style.height = `${vThumbHeight}px`;
        this.verticalThumb.style.top = `${Math.max(0, Math.min(vTrackHeight, vThumbPos))}px`;

        // Hide scrollbars if content fits
        this.horizontalScrollbar.style.display = scrollableWidth > containerWidth ? 'block' : 'none';
        this.verticalScrollbar.style.display = scrollableHeight > containerHeight ? 'block' : 'none';
    }

    public destroy(): void {
        if (this.horizontalScrollbar) {
            this.horizontalScrollbar.remove();
        }
        if (this.verticalScrollbar) {
            this.verticalScrollbar.remove();
        }
    }
}
