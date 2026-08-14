/**
 * NASAContentModal - Display NASA daily content (APOD, Mars photos)
 *
 * Shows beautiful modals with space imagery and creature commentary
 * Dismissible by clicking button or background
 */

class NASAContentModal {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.htmlElements = []; // Track HTML elements separately
        this.currentContentIndex = 0;
        this.contentQueue = [];
        this.onComplete = null;
        this.isAdvancing = false;
        this.dismissButton = null;
        this.previousDomContainerStyles = null;
    }

    /**
     * Show NASA content modal with queue of content
     * @param {Array} contentQueue - Array of content objects
     * @param {Function} onComplete - Callback when all content dismissed
     */
    async show(contentQueue, onComplete = null) {
        if (!contentQueue || contentQueue.length === 0) return;

        this.contentQueue = contentQueue;
        this.currentContentIndex = 0;
        this.onComplete = onComplete;

        try {
            await this.showCurrentContent();
        } catch (error) {
            console.error('[NASAContentModal] Error displaying content:', error);
            this.cleanup();
        }
    }

    /**
     * Show the current content item
     */
    async showCurrentContent() {
        if (this.currentContentIndex >= this.contentQueue.length) {
            this.complete();
            return;
        }

        const content = this.contentQueue[this.currentContentIndex];
        await this.displayContent(content);
    }

    /**
     * Display a single content item
     */
    async displayContent(content) {
        this.cleanup();
        this.isVisible = true;

        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dark overlay - depth must be above HamburgerMenu (15000) and MobileControls (10000)
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(16000);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this.elements.push(overlay);

        // Modal panel
        const panelWidth = Math.min(560, width - 32);
        const panelHeight = Math.min(720, height - 32);
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(16001);
        this.elements.push(panel);

        const typeIcon = content.type === 'apod' ? '✦' : '●';
        const typeColor = content.type === 'apod' ? '#FFD66B' : '#FF8A62';

        // Title
        const title = this.scene.add.text(centerX, panelY + 22, `${typeIcon} ${content.title}`, {
            fontSize: '19px',
            fontFamily: 'Arial, sans-serif',
            color: typeColor,
            fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16002);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(centerX, panelY + 51, content.subtitle, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: panelWidth - 44 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16002);
        this.elements.push(subtitle);

        const realDataLabel = this.scene.add.text(
            centerX,
            panelY + 78,
            `${content.realDataLabel || 'REAL NASA DATA'}  •  ${content.date || 'DATE RECORDED'}`,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#0D0D2B',
                backgroundColor: '#8FE3CF',
                fontStyle: 'bold',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16003);
        this.elements.push(realDataLabel);

        // Image container
        const imageY = panelY + 112;
        const imageMaxWidth = panelWidth - 40;
        const imageMaxHeight = Math.min(width < 600 ? 220 : 280, panelHeight - 390);

        // Load and display image
        let displayedImageHeight = imageMaxHeight;
        try {
            const displayedImage = await this.loadAndDisplayImage(
                content.imageUrl,
                centerX,
                imageY,
                imageMaxWidth,
                imageMaxHeight
            );
            displayedImageHeight = displayedImage?.sceneHeight || imageMaxHeight;
        } catch (e) {
            // Show placeholder on error
            const placeholder = this.scene.add.text(centerX, imageY + imageMaxHeight / 2,
                '🌌 Image loading...', {
                    fontSize: '18px',
                    color: '#666666'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(16002);
            this.elements.push(placeholder);
        }

        // Description
        const descY = imageY + displayedImageHeight + 12;
        const description = this.scene.add.text(centerX, descY, content.description, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#CCCCCC',
            wordWrap: { width: panelWidth - 40 },
            align: 'center'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16002);
        this.elements.push(description);

        const scienceTop = Math.min(
            panelY + panelHeight - 320,
            Math.max(descY + 58, panelY + 360)
        );
        const scienceCard = this.scene.add.graphics();
        scienceCard.fillStyle(0x15143B, 0.96);
        scienceCard.fillRoundedRect(panelX + 20, scienceTop, panelWidth - 40, 104, 10);
        scienceCard.lineStyle(1, 0x3D7990, 0.9);
        scienceCard.strokeRoundedRect(panelX + 20, scienceTop, panelWidth - 40, 104, 10);
        scienceCard.setScrollFactor(0).setDepth(16002);
        this.elements.push(scienceCard);

        const scienceSteps = content.scienceSteps || [
            'OBSERVE — What can you see?',
            'INFER — What might it mean?',
            'CHECK — What evidence would help?'
        ];
        const scienceLog = this.scene.add.text(
            panelX + 34,
            scienceTop + 10,
            `SPACE SCIENTIST’S LOG\n${scienceSteps.join('\n')}`,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#DDECF2',
                lineSpacing: 4,
                wordWrap: { width: panelWidth - 68 }
            }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(16003);
        this.elements.push(scienceLog);

        const sourceY = panelY + panelHeight - 196;
        const source = this.scene.add.text(
            centerX,
            sourceY,
            `${content.sourceLabel || 'NASA public data'}\n${content.sourceCredit || 'Source credit supplied by NASA'}`,
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                align: 'center',
                wordWrap: { width: panelWidth - 44 }
            }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16002);
        this.elements.push(source);

        const prompt = this.scene.add.text(
            centerX,
            panelY + panelHeight - 151,
            `LOOK CLOSER  •  ${content.learningPrompt || 'What do you notice?'}`,
            {
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD66B',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: panelWidth - 50 }
            }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(16002);
        this.elements.push(prompt);

        // Creature comment bubble
        const commentY = panelY + panelHeight - 92;
        const commentBg = this.scene.add.graphics();
        commentBg.fillStyle(0x4B0082, 0.8);
        commentBg.fillRoundedRect(panelX + 20, commentY - 12, panelWidth - 40, 48, 10);
        commentBg.setScrollFactor(0).setDepth(16002);
        this.elements.push(commentBg);

        const comment = this.scene.add.text(
            centerX,
            commentY + 11,
            `${content.storyBoundaryLabel || 'MYTHICAL VOID IMAGINES'}\n“${content.creatureComment}”`,
            {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'italic',
            wordWrap: { width: panelWidth - 60 },
            align: 'center'
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(16003);
        this.elements.push(comment);

        // Dismiss button
        const buttonY = panelY + panelHeight - 24;
        const buttonText = this.currentContentIndex < this.contentQueue.length - 1 ? 'Next discovery' : 'Back to the adventure';

        const button = this.scene.add.text(centerX, buttonY, buttonText, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#7B68EE',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(16003);
        button.setInteractive({ useHandCursor: true });

        button.on('pointerover', () => button.setStyle({ backgroundColor: '#9B88FF' }));
        button.on('pointerout', () => button.setStyle({ backgroundColor: '#7B68EE' }));
        const advance = () => this.next();
        button.on('pointerup', advance);
        button.on('pointerdown', advance);

        this.elements.push(button);

        // Click overlay to dismiss
        overlay.on('pointerup', advance);

        // Keep the primary action on the browser input layer. Phaser canvas
        // events can be interrupted by stale mobile pointers after scene resume.
        if (this.scene.game?.domContainer) {
            const domContainer = this.scene.game.domContainer;
            this.previousDomContainerStyles = {
                zIndex: domContainer.style.zIndex,
                pointerEvents: domContainer.style.pointerEvents
            };
            domContainer.style.zIndex = '110';
            domContainer.style.pointerEvents = 'auto';
            const nativeButton = document.createElement('button');
            nativeButton.type = 'button';
            nativeButton.className = 'nasa-content-dismiss';
            nativeButton.textContent = buttonText.replace(/[➡️✨]/gu, '').trim();
            nativeButton.style.width = '216px';
            nativeButton.style.height = '44px';
            nativeButton.style.minWidth = '216px';
            nativeButton.style.minHeight = '44px';
            nativeButton.style.display = 'flex';
            nativeButton.style.alignItems = 'center';
            nativeButton.style.justifyContent = 'center';
            nativeButton.style.whiteSpace = 'nowrap';
            nativeButton.style.fontSize = '13px';
            nativeButton.setAttribute('aria-label', nativeButton.textContent);
            nativeButton.setAttribute('data-testid', 'nasa-content-dismiss');
            const nativeAdvance = event => {
                event.preventDefault();
                event.stopPropagation();
                this.next();
            };
            nativeButton.addEventListener('pointerup', nativeAdvance);
            nativeButton.addEventListener('touchend', nativeAdvance, {
                passive: false
            });
            nativeButton.addEventListener('click', nativeAdvance);
            const nativeDom = this.scene.add.dom(
                centerX,
                buttonY,
                nativeButton
            ).setOrigin(0.5).setScrollFactor(0).setDepth(16004);
            this.dismissButton = nativeButton;
            this.elements.push(nativeDom);
        }

        // Play reveal sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Load and display image using HTML img element to bypass CORS
     * Note: We don't use crossOrigin since we only need to display, not read pixels
     */
    async loadAndDisplayImage(url, x, y, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            console.log('[NASAModal] Loading image:', url);

            // Create HTML img element (no crossOrigin = can display any image)
            const img = document.createElement('img');
            img.referrerPolicy = 'no-referrer';

            const canvas = this.scene.game?.canvas;
            const canvasBounds = canvas?.getBoundingClientRect?.() || {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight
            };
            const sceneWidth = this.scene.scale?.width || window.innerWidth;
            const sceneHeight = this.scene.scale?.height || window.innerHeight;
            const scaleX = canvasBounds.width / sceneWidth;
            const scaleY = canvasBounds.height / sceneHeight;
            const screenX = canvasBounds.left + x * scaleX;
            const screenY = canvasBounds.top + y * scaleY;

            // Use simpler viewport-centered positioning
            img.style.cssText = `
                position: fixed;
                top: ${screenY}px;
                left: ${screenX}px;
                transform: translate(-50%, 0);
                max-width: ${Math.min(maxWidth * scaleX, window.innerWidth - 50)}px;
                max-height: ${Math.min(maxHeight * scaleY, window.innerHeight * 0.38)}px;
                width: auto;
                height: auto;
                object-fit: contain;
                z-index: 10002;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(123, 104, 238, 0.5);
                background-color: #1A1A3E;
                pointer-events: none;
            `;

            // Append to DOM immediately to show placeholder
            document.body.appendChild(img);
            this.htmlElements.push(img);

            img.onload = () => {
                console.log('[NASAModal] Image loaded! Size:', img.naturalWidth, 'x', img.naturalHeight);
                img.style.backgroundColor = 'transparent';
                requestAnimationFrame(() => {
                    const renderedHeight = img.getBoundingClientRect().height;
                    resolve({
                        sceneHeight: renderedHeight / Math.max(scaleY, 0.001)
                    });
                });
            };

            img.onerror = (e) => {
                console.error('[NASAModal] Image FAILED to load!');
                console.error('[NASAModal] URL:', url);
                console.error('[NASAModal] Error event:', e);

                // Show URL in placeholder for debugging
                img.style.display = 'none';

                // Create a text placeholder showing what went wrong
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -40%);
                    width: ${maxWidth}px;
                    height: ${maxHeight}px;
                    background-color: #1A1A3E;
                    border-radius: 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #888;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    text-align: center;
                    padding: 20px;
                    box-sizing: border-box;
                    z-index: 10002;
                `;
                placeholder.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 10px;">🌌</div>
                    <div>Image couldn't load</div>
                    <div style="font-size: 10px; color: #666; margin-top: 10px; word-break: break-all; max-width: 90%;">${url.substring(0, 100)}...</div>
                `;
                document.body.appendChild(placeholder);
                this.htmlElements.push(placeholder);

                reject(new Error('Failed to load image'));
            };

            // Set src to start loading
            img.src = url;
        });
    }

    /**
     * Go to next content or close
     */
    next() {
        if (this.isAdvancing || !this.isVisible) return;
        this.isAdvancing = true;
        this.currentContentIndex++;
        void this.showCurrentContent().finally(() => {
            if (this.isVisible) this.isAdvancing = false;
        });
    }

    /**
     * Complete and close modal
     */
    complete() {
        this.cleanup();

        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Cleanup all elements
     */
    cleanup() {
        // Cleanup Phaser elements
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.elements = [];

        // Cleanup HTML elements
        this.htmlElements.forEach(el => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        this.htmlElements = [];

        if (this.previousDomContainerStyles && this.scene.game?.domContainer) {
            this.scene.game.domContainer.style.zIndex =
                this.previousDomContainerStyles.zIndex;
            this.scene.game.domContainer.style.pointerEvents =
                this.previousDomContainerStyles.pointerEvents;
        }
        this.previousDomContainerStyles = null;

        this.isVisible = false;
        this.dismissButton = null;
    }
}

export default NASAContentModal;
