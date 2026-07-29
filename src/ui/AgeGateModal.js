/**
 * AgeGateModal - Age verification modal for first-time users
 *
 * Shows on first launch to collect age confirmation
 * All users can play - under-13 gets a privacy notice
 * Stores confirmation in localStorage
 */

import legalConfig from '../config/legal.json';

class AgeGateModal {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.isCompleting = false;
        this.elements = [];
        this.onComplete = null;
    }

    /**
     * Check if age gate has been confirmed
     */
    static hasConfirmed() {
        return localStorage.getItem('mythical_void_age_confirmed') === 'true';
    }

    /**
     * Get stored age group
     */
    static getAgeGroup() {
        return localStorage.getItem('mythical_void_age_group') || null;
    }

    /**
     * Show the age gate modal
     * @param {Function} onComplete - Callback when age gate is completed
     */
    show(onComplete = null) {
        if (!legalConfig.ageGate?.enabled) {
            // Age gate disabled, proceed immediately
            if (onComplete) onComplete();
            return;
        }

        this.cleanup();
        this.isVisible = true;
        this.isCompleting = false;
        this.onComplete = onComplete;

        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.92);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(18000);
        this.elements.push(overlay);

        // Panel
        const panelWidth = Math.min(420, width - 40);
        const panelHeight = 340;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(18001);
        this.elements.push(panel);

        // Cosmic decoration at top
        const starDecor = this.scene.add.text(centerX, panelY + 35, '✨🌌✨', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(starDecor);

        // Title
        const title = this.scene.add.text(centerX, panelY + 75, legalConfig.ageGate.title, {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(centerX, panelY + 105, legalConfig.ageGate.subtitle, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(subtitle);

        // Create age option buttons
        const options = legalConfig.ageGate.options;
        let buttonY = panelY + 155;

        options.forEach((option, index) => {
            const btn = this.createAgeButton(
                centerX,
                buttonY + (index * 60),
                option.label,
                () => this.selectAge(option)
            );
            this.elements.push(...btn);
        });

        // Footer text
        const footer = this.scene.add.text(centerX, panelY + panelHeight - 30, legalConfig.ageGate.footer, {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#666666'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(footer);
    }

    /**
     * Create a styled age selection button
     */
    createAgeButton(x, y, text, onClick) {
        const elements = [];
        const btnWidth = 280;
        const btnHeight = 44;

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x2D1B4E, 1);
        bg.fillRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
        bg.lineStyle(2, 0x7B68EE, 0.8);
        bg.strokeRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
        bg.setScrollFactor(0);
        bg.setDepth(18002);
        elements.push(bg);

        const btn = this.scene.add.text(x, y, text, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18003);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x4D3B6E, 1);
            bg.fillRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
            bg.lineStyle(2, 0x9B88FF, 1);
            bg.strokeRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
        });
        btn.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x2D1B4E, 1);
            bg.fillRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
            bg.lineStyle(2, 0x7B68EE, 0.8);
            bg.strokeRoundedRect(x - btnWidth/2, y - btnHeight/2, btnWidth, btnHeight, 12);
        });
        btn.on('pointerup', onClick);

        elements.push(btn);
        return elements;
    }

    /**
     * Handle age selection
     */
    selectAge(option) {
        // Play button click sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Store confirmation
        localStorage.setItem('mythical_void_age_confirmed', 'true');
        localStorage.setItem('mythical_void_age_group', option.storeAs);

        if (option.action === 'continue_with_notice') {
            // Show the notice for under-13 users
            this.showNotice(option.notice, () => {
                this.complete();
            });
        } else {
            // Continue directly for 13+
            this.complete();
        }
    }

    /**
     * Show a notice message (for under-13 users)
     */
    showNotice(message, onDismiss) {
        this.cleanup();

        const { width, height } = this.scene.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.92);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(18000);
        this.elements.push(overlay);

        // Panel
        const panelWidth = Math.min(420, width - 40);
        const panelHeight = 300;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0D0D2B, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x4CAF50);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(18001);
        this.elements.push(panel);

        // Safety icon
        const icon = this.scene.add.text(centerX, panelY + 40, '🛡️', {
            fontSize: '36px',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(icon);

        // Title
        const title = this.scene.add.text(centerX, panelY + 80, 'Your Privacy Matters!', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#4CAF50',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(title);

        // Message
        const messageText = this.scene.add.text(centerX, panelY + 140, message, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#CCCCCC',
            wordWrap: { width: panelWidth - 50 },
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18002);
        this.elements.push(messageText);

        // Continue button
        const continueBtn = this.scene.add.text(centerX, panelY + panelHeight - 45, '🚀 Start Playing!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: '#4CAF50',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(18003);
        continueBtn.setInteractive({ useHandCursor: true });

        continueBtn.on('pointerover', () => continueBtn.setStyle({ backgroundColor: '#66BB6A' }));
        continueBtn.on('pointerout', () => continueBtn.setStyle({ backgroundColor: '#4CAF50' }));
        continueBtn.on('pointerup', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
            onDismiss();
        });

        this.elements.push(continueBtn);
    }

    /**
     * Complete and close the age gate
     */
    complete() {
        if (this.isCompleting) {
            return;
        }
        this.isCompleting = true;

        const onComplete = this.onComplete;
        this.onComplete = null;
        this.cleanup();

        if (onComplete) {
            // Wait until the confirming pointer has fully cleared before creating
            // the Start control beneath the modal.
            this.scene.time.delayedCall(50, () => {
                onComplete();
            });
        }
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
        this.isVisible = false;
    }
}

export default AgeGateModal;
