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
        this.messageElements = [];
    }

    /**
     * Show the chat overlay
     */
    async show() {
        if (this.isVisible) return;

        // Initialize ChatManager if needed
        if (window.ChatManager && !window.ChatManager.isInitialized) {
            await window.ChatManager.initialize();
        }

        this.isVisible = true;
        const { width, height } = this.scene.scale;

        // Create dark overlay background
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.75);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(300);
        this.overlay.setScrollFactor(0);
        this.elements.push(this.overlay);

        // Calculate panel dimensions - centered at bottom
        const panelWidth = Math.min(width - 40, 420);
        const panelHeight = Math.min(height * 0.6, 450);
        const panelX = (width - panelWidth) / 2;
        const panelY = height - panelHeight - 30;

        // Store for positioning
        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };

        // Create main panel
        this.panel = this.scene.add.graphics();
        this.panel.fillStyle(0x1A1A3E, 0.95);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        this.panel.lineStyle(3, 0x7B68EE);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        this.panel.setDepth(301);
        this.panel.setScrollFactor(0);
        this.elements.push(this.panel);

        // Create header
        this.createHeader();

        // Create message area
        this.createMessageArea();

        // Get greeting and show it
        const greeting = window.ChatManager?.getGreeting() || { text: '*looks at you curiously*' };
        this.addMessage('creature', greeting.text);

        // Create response buttons
        const options = window.ChatManager?.getResponseOptions('general') || [
            'How are you feeling?',
            'Want to play?',
            'Tell me about your day',
            'I love you!'
        ];
        this.createResponseButtons(options);

        // Make overlay close on tap outside panel
        this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this.overlay.on('pointerdown', (pointer) => {
            // Check if click is outside panel
            if (pointer.x < panelX || pointer.x > panelX + panelWidth ||
                pointer.y < panelY || pointer.y > panelY + panelHeight) {
                this.hide();
            }
        });

        // ESC key to close
        if (this.scene.input?.keyboard) {
            this.escHandler = (event) => {
                if (event.key === 'Escape') this.hide();
            };
            this.scene.input.keyboard.on('keydown', this.escHandler);
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ChatOverlay] Shown');
    }

    /**
     * Create header with title and close button
     */
    createHeader() {
        const { x, y, width } = this.panelBounds;
        const creatureName = window.GameState?.get('creature.name') || 'Creature';

        // Title
        this.title = this.scene.add.text(
            x + 20,
            y + 15,
            `Chat with ${creatureName}`,
            {
                fontSize: '18px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setDepth(302).setScrollFactor(0);
        this.elements.push(this.title);

        // Close button
        const btnSize = 32;
        const btnX = x + width - btnSize - 10;
        const btnY = y + 10;

        const closeBtn = this.scene.add.graphics();
        closeBtn.fillStyle(0xFF6B6B, 1);
        closeBtn.fillCircle(btnX + btnSize/2, btnY + btnSize/2, btnSize/2);
        closeBtn.setDepth(303);
        closeBtn.setScrollFactor(0);
        this.elements.push(closeBtn);

        const closeText = this.scene.add.text(
            btnX + btnSize/2,
            btnY + btnSize/2,
            '✕',
            { fontSize: '18px', color: '#FFFFFF', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(304).setScrollFactor(0);
        this.elements.push(closeText);

        // Make close button interactive
        const closeZone = this.scene.add.zone(btnX + btnSize/2, btnY + btnSize/2, btnSize, btnSize)
            .setInteractive()
            .setDepth(305)
            .setScrollFactor(0);

        closeZone.on('pointerdown', () => this.hide());
        closeZone.on('pointerover', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0xFF8888, 1);
            closeBtn.fillCircle(btnX + btnSize/2, btnY + btnSize/2, btnSize/2);
        });
        closeZone.on('pointerout', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0xFF6B6B, 1);
            closeBtn.fillCircle(btnX + btnSize/2, btnY + btnSize/2, btnSize/2);
        });
        this.elements.push(closeZone);
    }

    /**
     * Create message display area
     */
    createMessageArea() {
        const { x, y, width, height } = this.panelBounds;

        // Message area background
        const msgAreaY = y + 55;
        const msgAreaHeight = height - 200; // Leave room for buttons

        const msgBg = this.scene.add.graphics();
        msgBg.fillStyle(0x0D0D1F, 0.8);
        msgBg.fillRoundedRect(x + 15, msgAreaY, width - 30, msgAreaHeight, 10);
        msgBg.setDepth(302);
        msgBg.setScrollFactor(0);
        this.elements.push(msgBg);

        // Store message area bounds
        this.messageArea = {
            x: x + 25,
            y: msgAreaY + 10,
            width: width - 50,
            height: msgAreaHeight - 20,
            currentY: msgAreaY + 10
        };
    }

    /**
     * Add a message bubble
     */
    addMessage(speaker, text) {
        const { x, width, currentY } = this.messageArea;
        const isCreature = speaker === 'creature';

        // Create message text to measure
        const msgText = this.scene.add.text(
            isCreature ? x : x + width,
            currentY,
            text,
            {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                wordWrap: { width: width - 20 }
            }
        ).setOrigin(isCreature ? 0 : 1, 0).setDepth(303).setScrollFactor(0);

        this.elements.push(msgText);
        this.messageElements.push(msgText);

        // Update Y position for next message
        this.messageArea.currentY = currentY + msgText.height + 15;
    }

    /**
     * Create response buttons in 2x2 grid
     */
    createResponseButtons(options) {
        // Clear existing buttons
        this.responseButtons.forEach(btn => {
            btn.zone?.destroy();
            btn.bg?.destroy();
            btn.text?.destroy();
        });
        this.responseButtons = [];

        const { x, y, width, height } = this.panelBounds;
        const buttonAreaY = y + height - 135;
        const buttonWidth = (width - 50) / 2;
        const buttonHeight = 50;
        const gap = 10;

        // Take up to 4 options
        const displayOptions = options.slice(0, 4);

        displayOptions.forEach((option, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);

            const btnX = x + 15 + col * (buttonWidth + gap);
            const btnY = buttonAreaY + row * (buttonHeight + gap);

            // Button background
            const btnBg = this.scene.add.graphics();
            btnBg.fillStyle(0x6B5B95, 1);
            btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            btnBg.setDepth(302);
            btnBg.setScrollFactor(0);
            this.elements.push(btnBg);

            // Button text
            const btnText = this.scene.add.text(
                btnX + buttonWidth / 2,
                btnY + buttonHeight / 2,
                option,
                {
                    fontSize: '13px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF',
                    align: 'center',
                    wordWrap: { width: buttonWidth - 10 }
                }
            ).setOrigin(0.5).setDepth(303).setScrollFactor(0);
            this.elements.push(btnText);

            // Interactive zone
            const zone = this.scene.add.zone(btnX + buttonWidth/2, btnY + buttonHeight/2, buttonWidth, buttonHeight)
                .setInteractive()
                .setDepth(304)
                .setScrollFactor(0);

            zone.on('pointerdown', () => this.onOptionSelected(option));
            zone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x8B7BB5, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            });
            zone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x6B5B95, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            });

            this.elements.push(zone);
            this.responseButtons.push({ zone, bg: btnBg, text: btnText });
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

        // Add player message
        this.addMessage('player', option);

        // Get creature response
        const response = window.ChatManager?.getCreatureResponse(option);
        if (!response) return;

        // Add creature response with slight delay
        this.scene.time.delayedCall(300, () => {
            this.addMessage('creature', response.text);

            // Apply mood boost
            if (response.moodBoost?.applied) {
                window.ChatManager?.applyMoodBoost(response.moodBoost.amount);
                this.showMoodBoostFeedback(response.moodBoost.amount);
            }

            // Update buttons with new options
            this.createResponseButtons(response.nextOptions || []);
        });
    }

    /**
     * Show mood boost feedback
     */
    showMoodBoostFeedback(amount) {
        const { width, height } = this.scene.scale;

        const feedback = this.scene.add.text(
            width / 2,
            height / 2 - 50,
            `+${amount} 💬`,
            {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(400).setScrollFactor(0);

        this.scene.tweens.add({
            targets: feedback,
            y: feedback.y - 60,
            alpha: 0,
            duration: 1500,
            onComplete: () => feedback.destroy()
        });
    }

    /**
     * Hide the chat overlay
     */
    hide() {
        if (!this.isVisible) return;

        this.cleanup();
        this.isVisible = false;

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ChatOverlay] Hidden');
    }

    /**
     * Cleanup all elements
     */
    cleanup() {
        // Remove keyboard listener
        if (this.escHandler && this.scene.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this.escHandler);
            this.escHandler = null;
        }

        // Destroy all elements
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });

        this.elements = [];
        this.responseButtons = [];
        this.messageElements = [];
        this.overlay = null;
        this.panel = null;
        this.title = null;
    }

    /**
     * Check if overlay is visible
     */
    getIsVisible() {
        return this.isVisible;
    }
}

export default ChatOverlay;
