/**
 * LegalDocumentsModal - Display Privacy Policy and Terms of Service
 *
 * Accessible from hamburger menu and footer
 * Displays legal documents from config/legal.json
 */

import legalConfig from '../config/legal.json';

class LegalDocumentsModal {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.currentDocument = null; // 'privacy' or 'terms'
        this.scrollY = 0;
        this.maxScroll = 0;
    }

    /**
     * Show the legal documents selector
     */
    show() {
        this.cleanup();
        this.isVisible = true;
        this.showDocumentSelector();
    }

    /**
     * Show document type selector
     */
    showDocumentSelector() {
        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(17000);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.hide());
        this.elements.push(overlay);

        // Panel
        const panelWidth = Math.min(400, width - 40);
        const panelHeight = 280;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(17001);
        this.elements.push(panel);

        // Title
        const title = this.scene.add.text(centerX, panelY + 30, '📜 Legal Documents', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17002);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(centerX, panelY + 60, legalConfig.copyright.notice, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17002);
        this.elements.push(subtitle);

        // Privacy Policy button
        const privacyBtn = this.createButton(
            centerX,
            panelY + 110,
            '🔒 Privacy Policy',
            () => this.showDocument('privacy')
        );
        this.elements.push(...privacyBtn);

        // Terms of Service button
        const termsBtn = this.createButton(
            centerX,
            panelY + 165,
            '📋 Terms of Service',
            () => this.showDocument('terms')
        );
        this.elements.push(...termsBtn);

        // Close button
        const closeBtn = this.scene.add.text(centerX, panelY + panelHeight - 35, '✕ Close', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17002);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerover', () => closeBtn.setColor('#FFFFFF'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#AAAAAA'));
        closeBtn.on('pointerdown', () => this.hide());
        this.elements.push(closeBtn);
    }

    /**
     * Show a specific document
     */
    showDocument(type) {
        this.cleanup();
        this.currentDocument = type;
        this.scrollY = 0;

        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;

        // Get document content
        const doc = type === 'privacy'
            ? legalConfig.privacyPolicy
            : legalConfig.termsOfService;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(17000);
        this.elements.push(overlay);

        // Panel (nearly full screen for reading)
        const panelPadding = 20;
        const panelWidth = Math.min(600, width - panelPadding * 2);
        const panelHeight = height - panelPadding * 2;
        const panelX = centerX - panelWidth / 2;
        const panelY = panelPadding;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(2, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(17001);
        this.elements.push(panel);

        // Header background
        const headerBg = this.scene.add.graphics();
        headerBg.fillStyle(0x1A1A3E, 1);
        headerBg.fillRoundedRect(panelX, panelY, panelWidth, 60, { tl: 15, tr: 15, bl: 0, br: 0 });
        headerBg.setScrollFactor(0);
        headerBg.setDepth(17002);
        this.elements.push(headerBg);

        // Title
        const icon = type === 'privacy' ? '🔒' : '📋';
        const title = this.scene.add.text(centerX, panelY + 25, `${icon} ${doc.title}`, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        this.elements.push(title);

        // Last updated
        const updated = this.scene.add.text(centerX, panelY + 48, `Last updated: ${doc.lastUpdated}`, {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        this.elements.push(updated);

        // Back button
        const backBtn = this.scene.add.text(panelX + 15, panelY + 25, '← Back', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#7B68EE'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(17003);
        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerover', () => backBtn.setColor('#9B88FF'));
        backBtn.on('pointerout', () => backBtn.setColor('#7B68EE'));
        backBtn.on('pointerdown', () => this.show());
        this.elements.push(backBtn);

        // Content area (scrollable)
        const contentY = panelY + 70;
        const contentHeight = panelHeight - 110;
        const contentWidth = panelWidth - 40;

        // Create mask for scrolling
        const maskGraphics = this.scene.make.graphics();
        maskGraphics.fillRect(panelX + 20, contentY, contentWidth, contentHeight);
        const mask = maskGraphics.createGeometryMask();

        // Content container
        this.contentContainer = this.scene.add.container(panelX + 20, contentY);
        this.contentContainer.setMask(mask);
        this.contentContainer.setDepth(17002);

        // Build content text
        let yOffset = 10;
        const lineHeight = 18;
        const sectionGap = 25;

        doc.sections.forEach(section => {
            // Section heading
            const heading = this.scene.add.text(0, yOffset, section.heading, {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#7B68EE',
                fontStyle: 'bold'
            }).setScrollFactor(0);
            this.contentContainer.add(heading);
            yOffset += 25;

            // Section content
            const content = this.scene.add.text(0, yOffset, section.content, {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#CCCCCC',
                wordWrap: { width: contentWidth - 10 },
                lineSpacing: 4
            }).setScrollFactor(0);
            this.contentContainer.add(content);
            yOffset += content.height + sectionGap;
        });

        // Calculate max scroll
        this.maxScroll = Math.max(0, yOffset - contentHeight + 20);
        this.contentHeight = contentHeight;

        // Scroll indicator if needed
        if (this.maxScroll > 0) {
            const scrollHint = this.scene.add.text(
                centerX,
                panelY + panelHeight - 35,
                '↕ Scroll to read more',
                {
                    fontSize: '12px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#666666'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
            this.elements.push(scrollHint);

            // Fade hint after 3 seconds
            this.scene.tweens.add({
                targets: scrollHint,
                alpha: 0,
                delay: 3000,
                duration: 1000
            });
        }

        // Handle scrolling
        this.scene.input.on('wheel', this.handleScroll, this);

        // Touch/drag scrolling
        let startY = 0;
        let startScroll = 0;

        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', (pointer) => {
            startY = pointer.y;
            startScroll = this.scrollY;
        });
        overlay.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                const delta = startY - pointer.y;
                this.scrollY = Phaser.Math.Clamp(startScroll + delta, 0, this.maxScroll);
                this.contentContainer.y = contentY - this.scrollY;
            }
        });

        this.elements.push(this.contentContainer);
    }

    /**
     * Handle mouse wheel scrolling
     */
    handleScroll(pointer, gameObjects, deltaX, deltaY) {
        if (!this.contentContainer || this.maxScroll === 0) return;

        this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll);
        const contentY = this.scene.cameras.main.height * 0.025 + 70; // Match panelY + 70
        this.contentContainer.y = 20 + 70 - this.scrollY;
    }

    /**
     * Create a styled button
     */
    createButton(x, y, text, onClick) {
        const elements = [];

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x2D1B4E, 1);
        bg.fillRoundedRect(x - 140, y - 20, 280, 40, 10);
        bg.lineStyle(2, 0x7B68EE, 0.8);
        bg.strokeRoundedRect(x - 140, y - 20, 280, 40, 10);
        bg.setScrollFactor(0);
        bg.setDepth(17002);
        elements.push(bg);

        const btn = this.scene.add.text(x, y, text, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(17003);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x3D2B5E, 1);
            bg.fillRoundedRect(x - 140, y - 20, 280, 40, 10);
            bg.lineStyle(2, 0x9B88FF, 1);
            bg.strokeRoundedRect(x - 140, y - 20, 280, 40, 10);
        });
        btn.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x2D1B4E, 1);
            bg.fillRoundedRect(x - 140, y - 20, 280, 40, 10);
            bg.lineStyle(2, 0x7B68EE, 0.8);
            bg.strokeRoundedRect(x - 140, y - 20, 280, 40, 10);
        });
        btn.on('pointerdown', onClick);

        elements.push(btn);
        return elements;
    }

    /**
     * Hide the modal
     */
    hide() {
        this.scene.input.off('wheel', this.handleScroll, this);
        this.cleanup();
    }

    /**
     * Cleanup all elements
     */
    cleanup() {
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.elements = [];
        this.contentContainer = null;
        this.isVisible = false;
    }
}

export default LegalDocumentsModal;
