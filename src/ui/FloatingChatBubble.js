/**
 * FloatingChatBubble - Persistent chat button that follows the creature
 * Pulses periodically to attract attention
 */

import { devLog } from '../utils/devLogger.js';

export default class FloatingChatBubble {
    constructor(scene) {
        this.scene = scene;
        this.bubble = null;
        this.bubbleText = null;
        this.hitArea = null;
        this.pulseTween = null;
        this.pulseTimer = null;
        this.isVisible = false;
        this.presentationVisible = null;
        this.player = null;
        this.offsetX = 45;  // Offset from player
        this.offsetY = -55; // Above player
    }

    /**
     * Initialize the floating chat bubble
     * @param {Phaser.GameObjects.Sprite} player - The player sprite to follow
     */
    init(player) {
        this.player = player;
        if (!player) {
            console.warn('[FloatingChatBubble] No player provided');
            return;
        }

        this.create();
        this.isVisible = true;
        this.syncPresentationVisibility();

        devLog('[FloatingChatBubble] Initialized');
    }

    create() {
        // Create bubble background (speech bubble shape)
        this.bubble = this.scene.add.graphics();
        this.bubble.setDepth(2500);

        this.drawBubble(0xFFFFFF, 0.92);

        // Chat icon text
        this.bubbleText = this.scene.add.text(0, 0, '💬', {
            fontSize: '22px'
        }).setOrigin(0.5).setDepth(2501);

        // Interactive zone
        this.hitArea = this.scene.add.zone(0, 0, 55, 55)
            .setInteractive({ useHandCursor: true })
            .setDepth(2502);

        this.hitArea.on('pointerdown', () => this.onClick());
        this.hitArea.on('pointerover', () => {
            this.drawBubble(0xFFD700, 1);
            this.scene.tweens.add({
                targets: [this.bubbleText],
                scale: 1.15,
                duration: 100
            });
        });
        this.hitArea.on('pointerout', () => {
            this.drawBubble(0xFFFFFF, 0.92);
            this.scene.tweens.add({
                targets: [this.bubbleText],
                scale: 1,
                duration: 100
            });
        });

        // Start pulse animation timer (every 8 seconds)
        this.pulseTimer = this.scene.time.addEvent({
            delay: 8000,
            callback: () => this.pulse(),
            loop: true
        });

        // Initial pulse after 2 seconds
        this.scene.time.delayedCall(2000, () => this.pulse());
    }

    drawBubble(fillColor, alpha) {
        if (!this.bubble) return;

        this.bubble.clear();

        // Outer glow
        this.bubble.fillStyle(0x7B68EE, 0.3);
        this.bubble.fillCircle(0, 0, 28);

        // Main bubble
        this.bubble.fillStyle(fillColor, alpha);
        this.bubble.lineStyle(2, 0x7B68EE);
        this.bubble.fillCircle(0, 0, 24);
        this.bubble.strokeCircle(0, 0, 24);

        // Speech bubble tail
        this.bubble.fillStyle(fillColor, alpha);
        this.bubble.fillTriangle(-6, 20, 6, 20, 0, 32);
        this.bubble.lineStyle(2, 0x7B68EE);
        this.bubble.lineBetween(-6, 20, 0, 32);
        this.bubble.lineBetween(6, 20, 0, 32);
    }

    pulse() {
        if (!this.bubble || !this.isVisible || !this.presentationVisible) return;

        // Cancel existing pulse
        this.pulseTween?.stop();

        // Pulse animation - scale up and glow
        this.pulseTween = this.scene.tweens.add({
            targets: [this.bubble, this.bubbleText],
            scale: { from: 1, to: 1.25 },
            duration: 250,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
    }

    onClick() {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        // Trigger chat overlay in GameScene
        this.scene.events.emit('openChat');

        devLog('[FloatingChatBubble] Clicked - opening chat');
    }

    /**
     * Update bubble position to follow player
     * Called from scene's update() loop
     */
    update() {
        if (!this.player || !this.isVisible) return;
        if (!this.bubble || !this.bubbleText || !this.hitArea) return;
        if (!this.syncPresentationVisibility()) return;

        const x = this.player.x + this.offsetX;
        const y = this.player.y + this.offsetY;

        // Update positions (relative to world, not screen)
        this.bubble.setPosition(x, y);
        this.bubbleText.setPosition(x, y);
        this.hitArea.setPosition(x, y);
    }

    hide() {
        this.isVisible = false;
        this.syncPresentationVisibility();
    }

    show() {
        this.isVisible = true;
        this.syncPresentationVisibility();
    }

    syncPresentationVisibility() {
        const visible = this.isVisible &&
            this.scene?.hasVisibleTouchControls?.() !== true;
        if (this.presentationVisible !== visible) {
            this.presentationVisible = visible;
            this.bubble?.setVisible(visible);
            this.bubbleText?.setVisible(visible);
            this.hitArea?.setVisible(visible);
        }
        return visible;
    }

    destroy() {
        this.pulseTween?.stop();
        this.pulseTimer?.remove();

        this.hitArea?.removeAllListeners();
        this.hitArea?.destroy();
        this.bubble?.destroy();
        this.bubbleText?.destroy();

        this.bubble = null;
        this.bubbleText = null;
        this.hitArea = null;
        this.isVisible = false;
        this.presentationVisible = false;
        this.player = null;

        devLog('[FloatingChatBubble] Destroyed');
    }
}
