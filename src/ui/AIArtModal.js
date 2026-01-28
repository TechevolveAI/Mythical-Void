/**
 * AIArtModal - Generate realistic AI art of your creature
 *
 * Uses Replicate API via Netlify function to transform creature images
 * into beautiful artistic renditions in various styles.
 */

import { devLog, devWarn } from '../utils/devLogger.js';

class AIArtModal {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.isGenerating = false;
        this.elements = [];
        this.htmlElements = [];
        this.currentStyle = 'fantasy';
        this.generatedImageUrl = null;

        // Available art styles
        this.styles = [
            { id: 'realistic', label: '📷 Realistic', desc: 'Photorealistic render' },
            { id: 'fantasy', label: '✨ Fantasy', desc: 'Magical fantasy art' },
            { id: 'anime', label: '🎨 Anime', desc: 'Studio Ghibli inspired' },
            { id: 'oil_painting', label: '🖼️ Oil Painting', desc: 'Classical masterpiece' },
            { id: 'cosmic', label: '🌌 Cosmic', desc: 'Space nebula theme' }
        ];
    }

    /**
     * Show the AI Art modal
     * @param {Object} creatureData - Creature genetics and info
     * @param {Phaser.GameObjects.Sprite} creatureSprite - The creature sprite to capture
     */
    show(creatureData, creatureSprite) {
        if (this.isVisible) return;

        this.isVisible = true;
        this.creatureData = creatureData;
        this.creatureSprite = creatureSprite;
        this.generatedImageUrl = null;

        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(17000);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => {
            if (!this.isGenerating) this.close();
        });
        this.elements.push(overlay);

        // Modal panel
        const panelWidth = Math.min(420, width - 40);
        const panelHeight = Math.min(550, height - 60);
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x9370DB);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(17001);
        this.elements.push(panel);

        // Title
        const title = this.scene.add.text(centerX, panelY + 25, '🎨 AI Art Generator', {
            fontSize: isMobile ? '20px' : '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(17002);
        this.elements.push(title);

        // Subtitle
        const creatureName = creatureData?.name || 'Your Creature';
        const subtitle = this.scene.add.text(centerX, panelY + 55,
            `Transform ${creatureName} into realistic art!`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAFF',
            fontStyle: 'italic'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(17002);
        this.elements.push(subtitle);

        // Style selection section
        const styleLabel = this.scene.add.text(panelX + 20, panelY + 90, 'Choose Style:', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setScrollFactor(0).setDepth(17002);
        this.elements.push(styleLabel);

        // Style buttons (2 per row)
        const buttonWidth = (panelWidth - 60) / 2;
        const buttonHeight = 45;
        let styleY = panelY + 115;

        this.styleButtons = [];
        this.styles.forEach((style, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const btnX = panelX + 20 + col * (buttonWidth + 10);
            const btnY = styleY + row * (buttonHeight + 8);

            const btn = this.scene.add.graphics();
            const isSelected = style.id === this.currentStyle;
            btn.fillStyle(isSelected ? 0x7B68EE : 0x2A2A4E, 1);
            btn.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            if (isSelected) {
                btn.lineStyle(2, 0xFFD700);
                btn.strokeRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            }
            btn.setScrollFactor(0).setDepth(17002);
            this.elements.push(btn);

            const btnText = this.scene.add.text(btnX + buttonWidth / 2, btnY + buttonHeight / 2 - 6,
                style.label, {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: isSelected ? '#FFD700' : '#FFFFFF',
                fontStyle: isSelected ? 'bold' : 'normal'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
            this.elements.push(btnText);

            const descText = this.scene.add.text(btnX + buttonWidth / 2, btnY + buttonHeight / 2 + 10,
                style.desc, {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#888888'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
            this.elements.push(descText);

            // Interactive zone
            const zone = this.scene.add.zone(btnX, btnY, buttonWidth, buttonHeight)
                .setOrigin(0)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0)
                .setDepth(17004);

            zone.on('pointerdown', () => {
                if (!this.isGenerating) {
                    this.currentStyle = style.id;
                    this.refreshStyleButtons();
                    if (window.AudioManager) window.AudioManager.playButtonClick();
                }
            });

            this.elements.push(zone);
            this.styleButtons.push({ btn, btnText, descText, zone, style });
        });

        // Preview area
        const previewY = styleY + Math.ceil(this.styles.length / 2) * (buttonHeight + 8) + 20;
        const previewHeight = 180;

        const previewBg = this.scene.add.graphics();
        previewBg.fillStyle(0x1A1A3E, 1);
        previewBg.fillRoundedRect(panelX + 20, previewY, panelWidth - 40, previewHeight, 10);
        previewBg.setScrollFactor(0).setDepth(17002);
        this.elements.push(previewBg);
        this.previewBg = previewBg;
        this.previewY = previewY;
        this.previewHeight = previewHeight;

        // Preview placeholder
        this.previewText = this.scene.add.text(centerX, previewY + previewHeight / 2,
            '✨ Your AI art will appear here', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#666666'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        this.elements.push(this.previewText);

        // Generate button
        const generateY = previewY + previewHeight + 20;

        this.generateBtn = this.scene.add.text(centerX, generateY, '🚀 Generate AI Art', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#9370DB',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        this.generateBtn.setInteractive({ useHandCursor: true });

        this.generateBtn.on('pointerover', () => {
            if (!this.isGenerating) this.generateBtn.setStyle({ backgroundColor: '#A080E0' });
        });
        this.generateBtn.on('pointerout', () => {
            if (!this.isGenerating) this.generateBtn.setStyle({ backgroundColor: '#9370DB' });
        });
        this.generateBtn.on('pointerdown', () => this.generate());

        this.elements.push(this.generateBtn);

        // Cost info
        const costText = this.scene.add.text(centerX, generateY + 45,
            '💫 Free during beta!', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#88FF88'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17002);
        this.elements.push(costText);

        // Close button
        const closeBtn = this.scene.add.text(panelX + panelWidth - 15, panelY + 15, '✕', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerover', () => closeBtn.setColor('#FFFFFF'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
        closeBtn.on('pointerdown', () => {
            if (!this.isGenerating) this.close();
        });
        this.elements.push(closeBtn);

        // ESC to close
        this.escHandler = (event) => {
            if (event.key === 'Escape' && !this.isGenerating) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[AIArtModal] Opened');
    }

    /**
     * Refresh style button visuals after selection change
     */
    refreshStyleButtons() {
        this.styleButtons.forEach(({ btn, btnText, descText, style }) => {
            const isSelected = style.id === this.currentStyle;
            btn.clear();
            btn.fillStyle(isSelected ? 0x7B68EE : 0x2A2A4E, 1);

            // Get position from btnText
            const textX = btnText.x;
            const textY = btnText.y - 6;
            const buttonWidth = (Math.min(420, this.scene.cameras.main.width - 40) - 60) / 2;
            const buttonHeight = 45;
            const btnX = textX - buttonWidth / 2;
            const btnY = textY - buttonHeight / 2 + 6;

            btn.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            if (isSelected) {
                btn.lineStyle(2, 0xFFD700);
                btn.strokeRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            }

            btnText.setColor(isSelected ? '#FFD700' : '#FFFFFF');
            btnText.setFontStyle(isSelected ? 'bold' : 'normal');
        });
    }

    /**
     * Generate the AI art
     */
    async generate() {
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.generateBtn.setText('⏳ Generating...');
        this.generateBtn.setStyle({ backgroundColor: '#555555' });
        this.previewText.setText('🎨 Creating your masterpiece...\nThis may take 30-60 seconds');

        try {
            // Prepare creature data for the API
            const requestData = {
                style: this.currentStyle,
                creatureData: {
                    name: this.creatureData?.name || 'Mythical Creature',
                    personality: this.creatureData?.personality?.core || 'curious',
                    rarity: this.creatureData?.rarity || 'common',
                    colors: {
                        primary: this.getColorName(this.creatureData?.traits?.colorGenome?.primary),
                        secondary: this.getColorName(this.creatureData?.traits?.colorGenome?.secondary),
                        accent: this.getColorName(this.creatureData?.traits?.colorGenome?.accent)
                    },
                    bodyType: this.creatureData?.traits?.bodyShape?.type || 'balanced',
                    cosmicAffinity: this.creatureData?.cosmicAffinity?.element || 'star'
                },
                mode: 'text2img' // Generate from description (safer, no base64 needed)
            };

            devLog('[AIArtModal] Requesting AI generation:', requestData);

            // Call the Netlify function
            const response = await fetch('/.netlify/functions/generate-ai-art', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            // Check for HTTP errors before parsing JSON
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Generation failed');
            }

            devLog('[AIArtModal] Generated image URL:', result.imageUrl);
            this.generatedImageUrl = result.imageUrl;

            // Display the generated image
            this.displayGeneratedImage(result.imageUrl);

            // Play success sound
            if (window.AudioManager) {
                window.AudioManager.playLevelUp();
            }

        } catch (error) {
            console.error('[AIArtModal] Generation error:', error);
            this.previewText.setText(`❌ Generation failed\n${error.message}\n\nTry again later`);

            if (window.AudioManager) {
                window.AudioManager.playError();
            }
        } finally {
            this.isGenerating = false;
            this.generateBtn.setText('🚀 Generate Again');
            this.generateBtn.setStyle({ backgroundColor: '#9370DB' });
        }
    }

    /**
     * Convert hex color to approximate color name
     */
    getColorName(hexColor) {
        if (!hexColor || typeof hexColor !== 'number') return 'purple';

        const r = (hexColor >> 16) & 0xFF;
        const g = (hexColor >> 8) & 0xFF;
        const b = hexColor & 0xFF;

        // Simple color classification
        if (r > 200 && g < 100 && b < 100) return 'red';
        if (r > 200 && g > 150 && b < 100) return 'orange';
        if (r > 200 && g > 200 && b < 100) return 'yellow';
        if (r < 100 && g > 200 && b < 100) return 'green';
        if (r < 100 && g > 200 && b > 200) return 'cyan';
        if (r < 100 && g < 100 && b > 200) return 'blue';
        if (r > 150 && g < 100 && b > 200) return 'purple';
        if (r > 200 && g < 150 && b > 200) return 'pink';
        if (r > 200 && g > 200 && b > 200) return 'white';
        if (r < 50 && g < 50 && b < 50) return 'black';

        return 'purple'; // Default
    }

    /**
     * Display the generated image in the preview area
     */
    displayGeneratedImage(imageUrl) {
        // Remove placeholder text
        if (this.previewText) {
            this.previewText.destroy();
            this.previewText = null;
        }

        // Remove existing image if any
        this.htmlElements.forEach(el => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this.htmlElements = [];

        const { width } = this.scene.cameras.main;
        const panelWidth = Math.min(420, width - 40);

        // Create HTML img element for the result
        const img = document.createElement('img');
        img.src = imageUrl;
        img.referrerPolicy = 'no-referrer';

        img.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -15%);
            max-width: ${panelWidth - 60}px;
            max-height: ${this.previewHeight - 20}px;
            width: auto;
            height: auto;
            object-fit: contain;
            z-index: 17005;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(147, 112, 219, 0.6);
            background-color: #1A1A3E;
        `;

        img.onload = () => {
            img.style.backgroundColor = 'transparent';
            devLog('[AIArtModal] Image displayed successfully');
        };

        img.onerror = () => {
            devWarn('[AIArtModal] Failed to display generated image');
            this.previewText = this.scene.add.text(
                this.scene.cameras.main.width / 2,
                this.previewY + this.previewHeight / 2,
                '⚠️ Image display failed\nURL copied to clipboard', {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFAA00',
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
            this.elements.push(this.previewText);

            // Copy URL to clipboard as fallback
            navigator.clipboard?.writeText(imageUrl);
        };

        document.body.appendChild(img);
        this.htmlElements.push(img);

        // Add download/share buttons
        this.addActionButtons();
    }

    /**
     * Add download and share buttons after generation
     */
    addActionButtons() {
        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const panelWidth = Math.min(420, width - 40);
        const panelHeight = Math.min(550, height - 60);
        const panelY = (height - panelHeight) / 2;
        const buttonY = panelY + panelHeight - 45;

        // Download button
        const downloadBtn = this.scene.add.text(centerX - 60, buttonY, '💾 Save', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#4CAF50',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        downloadBtn.setInteractive({ useHandCursor: true });
        downloadBtn.on('pointerdown', () => this.downloadImage());
        this.elements.push(downloadBtn);

        // Share button
        const shareBtn = this.scene.add.text(centerX + 60, buttonY, '📤 Share', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#2196F3',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        shareBtn.setInteractive({ useHandCursor: true });
        shareBtn.on('pointerdown', () => this.shareImage());
        this.elements.push(shareBtn);
    }

    /**
     * Download the generated image
     */
    downloadImage() {
        if (!this.generatedImageUrl) return;

        const link = document.createElement('a');
        link.href = this.generatedImageUrl;
        link.download = `${this.creatureData?.name || 'creature'}_ai_art.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Share the generated image
     */
    async shareImage() {
        if (!this.generatedImageUrl) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${this.creatureData?.name || 'My Creature'} - AI Art`,
                    text: `Check out this AI art of my creature from Mythical Void!`,
                    url: this.generatedImageUrl
                });
            } catch (e) {
                // User cancelled or error
                devLog('[AIArtModal] Share cancelled or failed');
            }
        } else {
            // Fallback: copy URL to clipboard
            await navigator.clipboard?.writeText(this.generatedImageUrl);

            // Show copied toast
            const toast = this.scene.add.text(
                this.scene.cameras.main.width / 2,
                this.scene.cameras.main.height - 100,
                '📋 Link copied to clipboard!', {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                backgroundColor: '#333333',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(17010);

            this.scene.tweens.add({
                targets: toast,
                alpha: 0,
                y: toast.y - 30,
                duration: 2000,
                delay: 1500,
                onComplete: () => toast.destroy()
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.isVisible) return;

        this.isVisible = false;

        // Cleanup Phaser elements
        this.elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.elements = [];
        this.styleButtons = [];

        // Cleanup HTML elements
        this.htmlElements.forEach(el => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this.htmlElements = [];

        // Remove keyboard listener
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[AIArtModal] Closed');
    }

    /**
     * Cleanup on scene shutdown
     */
    cleanup() {
        this.close();
    }
}

export default AIArtModal;
