/**
 * ChatOverlay - Modern mobile-optimized chat UI with creature avatar and message bubbles
 *
 * Features:
 * - Creature avatar display in header
 * - Message bubbles with distinct player/creature styling
 * - Scrollable message history
 * - Quick response buttons in compact grid
 */

import { devLog } from '../utils/devLogger.js';

class ChatOverlay {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.responseButtons = [];
        this.messageElements = [];
        this.messages = []; // Store message data
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

        // Create semi-transparent overlay - not as dark
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.6);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(5000);
        this.overlay.setScrollFactor(0);
        this.elements.push(this.overlay);

        // Calculate panel dimensions - more compact, bottom-centered
        const panelWidth = Math.min(width - 30, 380);
        const panelHeight = Math.min(height * 0.55, 420);
        const panelX = (width - panelWidth) / 2;
        const panelY = height - panelHeight - 25;

        // Store for positioning
        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };

        // Create main panel with gradient effect
        this.createPanel();

        // Create header with avatar
        this.createHeader();

        // Create message area with bubbles
        this.createMessageArea();

        // Get greeting and show it
        const greeting = window.ChatManager?.getGreeting() || { text: '*looks at you curiously*' };
        this.addMessage('creature', greeting.text);

        // Create response buttons
        const options = window.ChatManager?.getResponseOptions('general') || [
            'What changed while I was away?',
            'How is your signal?',
            'Which route would you choose?',
            'Do you need food, movement, or quiet?'
        ];
        this.createResponseButtons(options);

        // Make overlay close on tap outside panel
        this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this.overlay.on('pointerdown', (pointer) => {
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

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ChatOverlay] Shown with enhanced UI');
    }

    /**
     * Create main panel with modern styling
     */
    createPanel() {
        const { x, y, width, height } = this.panelBounds;

        // Outer glow effect
        const glow = this.scene.add.graphics();
        glow.fillStyle(0x7B68EE, 0.15);
        glow.fillRoundedRect(x - 4, y - 4, width + 8, height + 8, 20);
        glow.setDepth(5000);
        glow.setScrollFactor(0);
        this.elements.push(glow);

        // Main panel
        this.panel = this.scene.add.graphics();
        // Gradient-like effect with layers
        this.panel.fillStyle(0x1A1A3E, 0.98);
        this.panel.fillRoundedRect(x, y, width, height, 16);
        // Top highlight
        this.panel.fillStyle(0x2D2D5E, 0.5);
        this.panel.fillRoundedRect(x + 2, y + 2, width - 4, 40, { tl: 14, tr: 14, bl: 0, br: 0 });
        // Border
        this.panel.lineStyle(2, 0x9B7FEE, 0.8);
        this.panel.strokeRoundedRect(x, y, width, height, 16);
        this.panel.setDepth(5001);
        this.panel.setScrollFactor(0);
        this.elements.push(this.panel);
    }

    /**
     * Create header with avatar and creature name
     */
    createHeader() {
        const { x, y, width } = this.panelBounds;
        const creatureName = window.GameState?.get('creature.name') || 'Creature';
        const personality = window.GameState?.get('creature.genes')?.personality?.core || 'curious';

        // Avatar container (circular)
        const avatarSize = 50;
        const avatarX = x + 35;
        const avatarY = y + 35;

        // Avatar background circle
        const avatarBg = this.scene.add.graphics();
        avatarBg.fillStyle(0x2D2D5E, 1);
        avatarBg.fillCircle(avatarX, avatarY, avatarSize / 2 + 3);
        avatarBg.lineStyle(2, 0x9B7FEE, 1);
        avatarBg.strokeCircle(avatarX, avatarY, avatarSize / 2 + 3);
        avatarBg.setDepth(5002);
        avatarBg.setScrollFactor(0);
        this.elements.push(avatarBg);

        // Try to get creature texture
        const creatureTexture = window.GameState?.get('creature.textureName');
        if (creatureTexture && this.scene.textures.exists(creatureTexture)) {
            const avatar = this.scene.add.sprite(avatarX, avatarY, creatureTexture);
            const maxDim = Math.max(avatar.width, avatar.height);
            const scale = (avatarSize - 6) / maxDim;
            avatar.setScale(scale);
            avatar.setDepth(5003);
            avatar.setScrollFactor(0);
            this.elements.push(avatar);
        } else {
            // Fallback: emoji avatar
            const emojiAvatar = this.scene.add.text(avatarX, avatarY, '🐾', {
                fontSize: '28px'
            }).setOrigin(0.5).setDepth(5003).setScrollFactor(0);
            this.elements.push(emojiAvatar);
        }

        // Name and personality
        const nameText = this.scene.add.text(
            avatarX + avatarSize / 2 + 12,
            y + 20,
            creatureName,
            {
                fontSize: '18px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setDepth(5002).setScrollFactor(0);
        this.elements.push(nameText);

        // Personality badge
        const personalityEmojis = {
            curious: '🔍',
            playful: '🎮',
            gentle: '💫',
            wise: '📚',
            energetic: '⚡'
        };
        const personalityBadge = this.scene.add.text(
            avatarX + avatarSize / 2 + 12,
            y + 42,
            `${personalityEmojis[personality] || '✨'} ${personality}`,
            {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#9B7FEE'
            }
        ).setDepth(5002).setScrollFactor(0);
        this.elements.push(personalityBadge);

        // Close button (top right)
        const closeSize = 30;
        const closeX = x + width - closeSize - 12;
        const closeY = y + 12;

        const closeBtn = this.scene.add.graphics();
        closeBtn.fillStyle(0x3D3D6E, 1);
        closeBtn.fillCircle(closeX + closeSize/2, closeY + closeSize/2, closeSize/2);
        closeBtn.setDepth(5003);
        closeBtn.setScrollFactor(0);
        this.elements.push(closeBtn);

        const closeText = this.scene.add.text(
            closeX + closeSize/2,
            closeY + closeSize/2,
            '✕',
            { fontSize: '16px', color: '#AAAAAA', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(5004).setScrollFactor(0);
        this.elements.push(closeText);

        const closeZone = this.scene.add.zone(closeX + closeSize/2, closeY + closeSize/2, closeSize + 10, closeSize + 10)
            .setInteractive()
            .setDepth(5005)
            .setScrollFactor(0);

        closeZone.on('pointerdown', () => this.hide());
        closeZone.on('pointerover', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0x6B5B95, 1);
            closeBtn.fillCircle(closeX + closeSize/2, closeY + closeSize/2, closeSize/2);
            closeText.setColor('#FFFFFF');
        });
        closeZone.on('pointerout', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0x3D3D6E, 1);
            closeBtn.fillCircle(closeX + closeSize/2, closeY + closeSize/2, closeSize/2);
            closeText.setColor('#AAAAAA');
        });
        this.elements.push(closeZone);
    }

    /**
     * Create message display area
     */
    createMessageArea() {
        const { x, y, width, height } = this.panelBounds;

        // Message area starts below header
        const msgAreaY = y + 70;
        const msgAreaHeight = height - 185; // Leave room for buttons

        // Message area background
        const msgBg = this.scene.add.graphics();
        msgBg.fillStyle(0x12122A, 0.9);
        msgBg.fillRoundedRect(x + 10, msgAreaY, width - 20, msgAreaHeight, 10);
        msgBg.setDepth(5002);
        msgBg.setScrollFactor(0);
        this.elements.push(msgBg);

        // Store message area bounds
        this.messageArea = {
            x: x + 18,
            y: msgAreaY + 10,
            width: width - 36,
            height: msgAreaHeight - 20,
            currentY: msgAreaY + 10,
            maxY: msgAreaY + msgAreaHeight - 20
        };
    }

    /**
     * Add a message bubble with proper styling
     */
    addMessage(speaker, text) {
        const { x, width, currentY, maxY } = this.messageArea;
        const isCreature = speaker === 'creature';

        // Calculate bubble dimensions
        const maxBubbleWidth = width * 0.85;
        const padding = 10;

        // Create temporary text to measure
        const tempText = this.scene.add.text(0, 0, text, {
            fontSize: '13px',
            fontFamily: 'Arial',
            wordWrap: { width: maxBubbleWidth - padding * 2 }
        });
        const textHeight = tempText.height;
        const textWidth = Math.min(tempText.width, maxBubbleWidth - padding * 2);
        tempText.destroy();

        const bubbleWidth = textWidth + padding * 2 + 8;
        const bubbleHeight = textHeight + padding * 2;

        // Check if we need to scroll/clear old messages
        if (currentY + bubbleHeight > maxY) {
            // Remove oldest message if too many
            if (this.messageElements.length > 4) {
                const toRemove = this.messageElements.shift();
                if (toRemove) {
                    if (toRemove.bubble) toRemove.bubble.destroy();
                    if (toRemove.text) toRemove.text.destroy();
                }
                // Shift remaining messages up
                this.messageArea.currentY = this.messageArea.y;
                this.messageElements.forEach(el => {
                    if (el.bubble) el.bubble.y -= bubbleHeight + 8;
                    if (el.text) el.text.y -= bubbleHeight + 8;
                });
            }
        }

        // Calculate bubble position
        const bubbleX = isCreature ? x : x + width - bubbleWidth;
        const bubbleY = this.messageArea.currentY;

        // Create bubble background
        const bubble = this.scene.add.graphics();
        if (isCreature) {
            // Creature bubble - purple gradient
            bubble.fillStyle(0x4A3A7A, 1);
            bubble.fillRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12);
            // Small tail on left
            bubble.fillTriangle(
                bubbleX + 8, bubbleY + bubbleHeight - 5,
                bubbleX - 5, bubbleY + bubbleHeight,
                bubbleX + 8, bubbleY + bubbleHeight
            );
        } else {
            // Player bubble - teal/cyan
            bubble.fillStyle(0x2A5A6A, 1);
            bubble.fillRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 12);
            // Small tail on right
            bubble.fillTriangle(
                bubbleX + bubbleWidth - 8, bubbleY + bubbleHeight - 5,
                bubbleX + bubbleWidth + 5, bubbleY + bubbleHeight,
                bubbleX + bubbleWidth - 8, bubbleY + bubbleHeight
            );
        }
        bubble.setDepth(5003);
        bubble.setScrollFactor(0);
        this.elements.push(bubble);

        // Create message text
        const msgText = this.scene.add.text(
            bubbleX + padding + 4,
            bubbleY + padding,
            text,
            {
                fontSize: '13px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                wordWrap: { width: maxBubbleWidth - padding * 2 }
            }
        ).setDepth(5004).setScrollFactor(0);
        this.elements.push(msgText);

        // Store message elements
        this.messageElements.push({ bubble, text: msgText });

        // Update Y position for next message
        this.messageArea.currentY = bubbleY + bubbleHeight + 8;
    }

    /**
     * Create response buttons in 2x2 grid with compact styling
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
        const buttonAreaY = y + height - 105;
        const buttonWidth = (width - 40) / 2;
        const buttonHeight = 42;
        const gap = 8;

        // Take up to 4 options
        const displayOptions = options.slice(0, 4);

        displayOptions.forEach((option, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);

            const btnX = x + 12 + col * (buttonWidth + gap);
            const btnY = buttonAreaY + row * (buttonHeight + gap);

            // Button background with gradient effect
            const btnBg = this.scene.add.graphics();
            btnBg.fillStyle(0x5B4B85, 1);
            btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
            // Top highlight
            btnBg.fillStyle(0x6B5B95, 0.5);
            btnBg.fillRoundedRect(btnX + 1, btnY + 1, buttonWidth - 2, buttonHeight / 2, { tl: 7, tr: 7, bl: 0, br: 0 });
            btnBg.setDepth(5002);
            btnBg.setScrollFactor(0);
            this.elements.push(btnBg);

            // Truncate long options
            const displayText = option.length > 20 ? option.substring(0, 18) + '...' : option;

            const btnText = this.scene.add.text(
                btnX + buttonWidth / 2,
                btnY + buttonHeight / 2,
                displayText,
                {
                    fontSize: '12px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF',
                    align: 'center',
                    wordWrap: { width: buttonWidth - 12 }
                }
            ).setOrigin(0.5).setDepth(5003).setScrollFactor(0);
            this.elements.push(btnText);

            const zone = this.scene.add.zone(btnX + buttonWidth/2, btnY + buttonHeight/2, buttonWidth, buttonHeight)
                .setInteractive()
                .setDepth(5004)
                .setScrollFactor(0);

            zone.on('pointerdown', () => this.onOptionSelected(option));
            zone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x7B6BA5, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
                btnBg.fillStyle(0x8B7BB5, 0.5);
                btnBg.fillRoundedRect(btnX + 1, btnY + 1, buttonWidth - 2, buttonHeight / 2, { tl: 7, tr: 7, bl: 0, br: 0 });
            });
            zone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x5B4B85, 1);
                btnBg.fillRoundedRect(btnX, btnY, buttonWidth, buttonHeight, 8);
                btnBg.fillStyle(0x6B5B95, 0.5);
                btnBg.fillRoundedRect(btnX + 1, btnY + 1, buttonWidth - 2, buttonHeight / 2, { tl: 7, tr: 7, bl: 0, br: 0 });
            });

            this.elements.push(zone);
            this.responseButtons.push({ zone, bg: btnBg, text: btnText });
        });
    }

    /**
     * Handle option selection
     */
    onOptionSelected(option) {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Add player message
        this.addMessage('player', option);

        // Get creature response
        const response = window.ChatManager?.getCreatureResponse(option);
        if (!response) return;

        // Add creature response with slight delay for realism
        this.scene.time.delayedCall(400, () => {
            this.addMessage('creature', response.text);

            // Apply mood boost
            if (response.moodBoost?.applied) {
                window.ChatManager?.applyMoodBoost(response.moodBoost.amount);
                this.showMoodBoostFeedback(response.moodBoost.amount);
            }

            // Record chat conversation for bond progression
            if (this.scene.recordBondActivity) {
                this.scene.recordBondActivity('chat');
            }

            // Update buttons with new options
            this.createResponseButtons(response.nextOptions || []);
        });
    }

    /**
     * Show mood boost feedback with animation
     */
    showMoodBoostFeedback(amount) {
        const { x, y, width } = this.panelBounds;

        const feedback = this.scene.add.text(
            x + width / 2,
            y - 20,
            `+${amount} 💜`,
            {
                fontSize: '22px',
                fontFamily: 'Arial',
                color: '#E066FF',
                fontStyle: 'bold',
                stroke: '#2D1B4E',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(5100).setScrollFactor(0);

        this.scene.tweens.add({
            targets: feedback,
            y: feedback.y - 50,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.3 },
            duration: 1200,
            ease: 'Power2',
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

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ChatOverlay] Hidden');
    }

    /**
     * Cleanup all elements
     */
    cleanup() {
        if (this.escHandler && this.scene.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this.escHandler);
            this.escHandler = null;
        }

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
    }

    /**
     * Check if overlay is visible
     */
    getIsVisible() {
        return this.isVisible;
    }
}

export default ChatOverlay;
