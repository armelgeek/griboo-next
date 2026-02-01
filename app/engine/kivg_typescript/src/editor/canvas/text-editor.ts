/**
 * TextEditor
 * A simple inline text editor overlay for editing text layers
 */

export interface TextEditorCallbacks {
    onSave?: (text: string) => void;
    onCancel?: () => void;
}

export interface TextEditorConfig {
    initialText?: string;
    position?: { x: number; y: number };
    fontSize?: number;
    fontFamily?: string;
    color?: string;
}

/**
 * Pure HTML/JS class for inline text editing
 */
export class TextEditor {
    private overlay: HTMLDivElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private callbacks: TextEditorCallbacks = {};
    private config: TextEditorConfig;

    constructor(config: TextEditorConfig = {}) {
        this.config = {
            initialText: config.initialText || '',
            position: config.position || { x: 0, y: 0 },
            fontSize: config.fontSize || 48,
            fontFamily: config.fontFamily || 'Arial',
            color: config.color || '#000000',
        };
    }

    public setCallbacks(callbacks: TextEditorCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Show the text editor at the specified position
     */
    public show(): void {
        if (this.overlay) {
            return; // Already showing
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create editor container
        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            min-width: 400px;
            max-width: 600px;
        `;

        // Create title
        const title = document.createElement('h3');
        title.textContent = 'Modifier le texte';
        title.style.cssText = `
            margin: 0 0 15px 0;
            font-size: 18px;
            color: #2d3748;
        `;
        editorContainer.appendChild(title);

        // Create textarea
        this.textarea = document.createElement('textarea');
        this.textarea.value = this.config.initialText || '';
        this.textarea.style.cssText = `
            width: 100%;
            min-height: 150px;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            font-size: ${(this.config.fontSize || 48) / 2}px;
            font-family: ${this.config.fontFamily || 'Arial'};
            color: ${this.config.color || '#000000'};
            resize: vertical;
            outline: none;
            box-sizing: border-box;
        `;
        this.textarea.placeholder = 'Entrez votre texte ici...';

        // Focus and select all text
        setTimeout(() => {
            if (this.textarea) {
                this.textarea.focus();
                this.textarea.select();
            }
        }, 10);

        editorContainer.appendChild(this.textarea);

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 15px;
            justify-content: flex-end;
        `;

        // Create cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Annuler';
        cancelButton.style.cssText = `
            padding: 10px 20px;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            background: white;
            color: #4a5568;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;
        cancelButton.addEventListener('mouseover', () => {
            cancelButton.style.background = '#f7fafc';
        });
        cancelButton.addEventListener('mouseout', () => {
            cancelButton.style.background = 'white';
        });
        cancelButton.addEventListener('click', () => {
            this.cancel();
        });

        // Create save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Enregistrer';
        saveButton.style.cssText = `
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            background: #667eea;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
        `;
        saveButton.addEventListener('mouseover', () => {
            saveButton.style.background = '#5568d3';
        });
        saveButton.addEventListener('mouseout', () => {
            saveButton.style.background = '#667eea';
        });
        saveButton.addEventListener('click', () => {
            this.save();
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        editorContainer.appendChild(buttonContainer);

        // Handle keyboard shortcuts
        this.textarea.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.save();
            }
            // Escape to cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            }
        });

        this.overlay.appendChild(editorContainer);
        document.body.appendChild(this.overlay);

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.cancel();
            }
        });
    }

    /**
     * Hide and cleanup the editor
     */
    public hide(): void {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
            this.textarea = null;
        }
    }

    /**
     * Save the text and close
     */
    private save(): void {
        const text = this.textarea?.value || '';
        this.hide();
        if (this.callbacks.onSave) {
            this.callbacks.onSave(text);
        }
    }

    /**
     * Cancel editing and close
     */
    private cancel(): void {
        this.hide();
        if (this.callbacks.onCancel) {
            this.callbacks.onCancel();
        }
    }
}
