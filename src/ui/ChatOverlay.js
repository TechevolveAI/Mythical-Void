/**
 * ChatOverlay - Mobile-optimized chat UI overlay for creature conversations
 */

import { devLog } from '../utils/devLogger.js';

class ChatOverlay {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.responseButtons = [];
        this.conversationBubbles = [];

        // Layout constants
        this.padding = 20;
        this.bubbleMaxWidth = 280;
        this.buttonHeight = 50;
        this.buttonSpacing = 10;
    }

    /**
     * Show the chat overlay
     */
    async show() {
        if (this.isVisible) return;

        // Ensure ChatManager is initialized
        if (!window.ChatManager?.isInitialized) {
            await window.ChatManager?.initialize();
        }

        this.isVisible = true;
        const { width, height } = this.scene.scale;

        // Create dark overlay background
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.75);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(300);
        this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this.elements.push(this.overlay);

        // Create chat container (white/purple panel)
        const panelHeight = Math.min(height * 0.7, 500);
        const panelWidth = Math.min(width - 40, 400);
        const panelX = (width - panelWidth) / 2;
        const panelY = height - panelHeight - 20;

        this.panel = this.scene.add.graphics();
        this.panel.fillStyle(0x1A1A3E, 0.95);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.lineStyle(3, 0x7B68EE);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.setDepth(301);
        this.elements.push(this.panel);

        // Store panel dimensions for positioning
        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };

        // Create close button
        this.createCloseButton();

        // Create chat title
        const creatureName = window.GameState?.get('creature.name') || 'Creature';
        this.title = this.scene.add.text(
            panelX + panelWidth / 2,
            panelY + 25,
            `Chat with ${creatureName}`,
            {
                fontSize: '18px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0).setDepth(302);
        this.elements.push(this.title);

        // Get and show greeting
        const greeting = window.ChatManager?.getGreeting() || { text: '*Creature looks at you*' };
        this.showCreatureMessage(greeting.text);

        // Show response options
        const options = window.ChatManager?.getResponseOptions('general') || [];
        this.showResponseOptions(options);

        // Add slide-up animation
        this.animateIn();

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ChatOverlay] Shown');
    }

    /**
     * Hide the chat overlay
     */
    hide() {
        if (!this.isVisible) return;

        this.animateOut(() => {
            this.cleanup();
            this.isVisible = false;
            devLog('[ChatOverlay] Hidden');
        });

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Create close button
     */
    createCloseButton() {
        const { x, y, width } = this.panelBounds;

        // Close button background
        const btnSize = 36;
        const btnX = x + width - btnSize - 10;
        const btnY = y + 10;

        this.closeBtn = this.scene.add.graphics();
        this.closeBtn.fillStyle(0xFF6B6B, 1);
        this.closeBtn.fillCircle(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2);
        this.closeBtn.setDepth(303);
        this.elements.push(this.closeBtn);

        // X text
        this.closeBtnText = this.scene.add.text(
            btnX + btnSize / 2,
            btnY + btnSize / 2,
            'X',
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(304);
        this.elements.push(this.closeBtnText);

        // Make interactive
        const hitArea = new Phaser.Geom.Circle(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2);
        this.closeBtn.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
        this.closeBtn.on('pointerdown', () => this.hide());
        this.closeBtn.on('pointerover', () => {
            this.closeBtn.clear();
            this.closeBtn.fillStyle(0xFF8888, 1);
            this.closeBtn.fillCircle(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2);
        });
        this.closeBtn.on('pointerout', () => {
            this.closeBtn.clear();
            this.closeBtn.fillStyle(0xFF6B6B, 1);
            this.closeBtn.fillCircle(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2);
        });

        // ESC key to close
        if (this.scene.input?.keyboard) {
            this.escKey = this.scene.input.keyboard.addKey('ESC');
            this.escKey.on('down', () => this.hide());
        }
    }

    /**
     * Show creature message bubble
     */
    showCreatureMessage(text) {
        const { x, y, width } = this.panelBounds;

        // Clear previous bubbles if too many
        if (this.conversationBubbles.length > 3) {
            const oldBubble = this.conversationBubbles.shift();
            if (oldBubble) {
                oldBubble.bg?.destroy();
                oldBubble.text?.destroy();
            }
        }

        // Calculate Y position based on existing bubbles
        let bubbleY = y + 60;
        this.conversationBubbles.forEach(bubble => {
            bubbleY += bubble.height + 10;
        });

        // Create bubble background
        const bubbleWidth = Math.min(width - 60, this.bubbleMaxWidth);
        const textObj = this.scene.add.text(0, 0, text, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            wordWrap: { width: bubbleWidth - 20 }
        });
        const textHeight = textObj.height;
        textObj.destroy();

        const bubbleHeight = textHeight + 20;
        const bubbleX = x + 20;

        const bubbleBg = this.scene.add.graphics();
        bubbleBg.fillStyle(0x4A3F8A, 0.9);
        bubbleBg.fillRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12);
        bubbleBg.setDepth(302);
        this.elements.push(bubbleBg);

        const bubbleText = this.scene.add.text(
            bubbleX + 10,
            bubbleY + 10,
            text,
            {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                wordWrap: { width: bubbleWidth - 20 }
            }
        ).setDepth(303);
        this.elements.push(bubbleText);

        this.conversationBubbles.push({
            bg: bubbleBg,
            text: bubbleText,
            height: bubbleHeight
        });

        // Animate in
        bubbleBg.setAlpha(0);
        bubbleText.setAlpha(0);
        this.scene.tweens.add({
            targets: [bubbleBg, bubbleText],
            alpha: 1,
            duration: 200
        });
    }

    /**
     * Show response option buttons
     */
    showResponseOptions(options) {
        // Clear existing buttons
        this.responseButtons.forEach(btn => {
            btn.bg?.destroy();
            btn.text?.destroy();
        });
        this.responseButtons = [];

        const { x, y, width, height } = this.panelBounds;
        const buttonWidth = width - 40;
        const startY = y + height - (options.length * (this.buttonHeight + this.buttonSpacing)) - 20;

        options.forEach((option, index) => {
            const btnY = startY + index * (this.buttonHeight + this.buttonSpacing);
            const btnX = x + 20;

            // Button background
            const btnBg = this.scene.add.graphics();
            btnBg.fillStyle(0x6B5B95, 1);
            btnBg.fillRoundedRect(btnX, btnY, buttonWidth, this.buttonHeight, 10);
            btnBg.setDepth(302);
            this.elements.push(btnBg);

            // Button text
            const btnText = this.scene.add.text(
                btnX + buttonWidth / 2,
                btnY + this.buttonHeight / 2,
                option,
                {
                    fontSize: '14px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF',
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(303);
            this.elements.push(btnText);

            // Make interactive
            btnBg.setInteractive(
                new Phaser.Geom.Rectangle(btnX, btnY, buttonWidth, this.buttonHeight),
                Phaser.Geom.Rectangle.Contains
            );

            btnBg.on('pointerdown', () => this.onOptionSelected(option));
            btnBg.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x8B7BB5, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, this.buttonHeight, 10);
            });
            btnBg.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x6B5B95, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, this.buttonHeight, 10);
            });

            this.responseButtons.push({ bg: btnBg, text: btnText });
        });
    }

    /**
     * Handle option selection
     */
    onOptionSelected(option) {
        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Get creature response
        const response = window.ChatManager?.getCreatureResponse(option);
        if (!response) return;

        // Show creature response
        this.showCreatureMessage(response.text);

        // Apply mood boost if applicable
        if (response.moodBoost?.applied) {
            window.ChatManager?.applyMoodBoost(response.moodBoost.amount);
            this.showMoodBoostFeedback(response.moodBoost.amount);
        }

        // Show new options
        this.showResponseOptions(response.nextOptions || []);
    }

    /**
     * Show mood boost feedback
     */
    showMoodBoostFeedback(amount) {
        const { width, height } = this.scene.scale;

        const feedback = this.scene.add.text(
            width / 2,
            height / 2 - 100,
            `+${amount} Happiness`,
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(400);

        this.scene.tweens.add({
            targets: feedback,
            y: feedback.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => feedback.destroy()
        });
    }

    /**
     * Animate overlay in
     */
    animateIn() {
        // Start panel off-screen (below)
        const targetY = this.panelBounds.y;
        const startY = this.scene.scale.height + 50;

        // Move all panel elements down
        const offset = startY - targetY;
        this.elements.forEach(el => {
            if (el !== this.overlay && el.y !== undefined) {
                el.y += offset;
            }
        });
        if (this.panel) {
            this.panel.y = startY;
        }

        // Animate up
        this.scene.tweens.add({
            targets: this.elements.filter(el => el !== this.overlay),
            y: `-=${offset}`,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // Fade in overlay
        this.overlay.setAlpha(0);
        this.scene.tweens.add({
            targets: this.overlay,
            alpha: 1,
            duration: 200
        });
    }

    /**
     * Animate overlay out
     */
    animateOut(onComplete) {
        const { height } = this.scene.scale;
        const offset = height - this.panelBounds.y + 100;

        // Animate down
        this.scene.tweens.add({
            targets: this.elements.filter(el => el !== this.overlay),
            y: `+=${offset}`,
            duration: 250,
            ease: 'Back.easeIn'
        });

        // Fade out overlay
        this.scene.tweens.add({
            targets: this.overlay,
            alpha: 0,
            duration: 200,
            onComplete
        });
    }

    /**
     * Cleanup all elements
     */
    cleanup() {
        // Remove ESC key listener
        if (this.escKey) {
            this.escKey.off('down');
            this.escKey = null;
        }

        // Destroy all elements
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.elements = [];
        this.responseButtons = [];
        this.conversationBubbles = [];

        this.overlay = null;
        this.panel = null;
        this.title = null;
        this.closeBtn = null;
        this.closeBtnText = null;
    }

    /**
     * Check if overlay is currently visible
     */
    getIsVisible() {
        return this.isVisible;
    }
}

export default ChatOverlay;
