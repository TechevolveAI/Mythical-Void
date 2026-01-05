/**
 * ControlsTutorialOverlay - One-time overlay showing game controls
 * Shows mobile or desktop controls based on device
 */

import { devLog } from '../utils/devLogger.js';

export default class ControlsTutorialOverlay {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.isVisible = false;
        this.anyKeyHandler = null;
    }

    /**
     * Check if tutorial should be shown
     */
    shouldShow() {
        return !window.GameState?.get('tutorial.controlsSeen');
    }

    /**
     * Show the controls tutorial
     */
    show() {
        if (!this.shouldShow()) {
            devLog('[ControlsTutorialOverlay] Already seen, skipping');
            return;
        }

        this.isVisible = true;
        const { width, height } = this.scene.scale;
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Full screen overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.92);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(10000);
        overlay.setScrollFactor(0);
        this.elements.push(overlay);

        // Title
        const title = this.scene.add.text(width / 2, isMobile ? 50 : 70, 'Welcome to Mythical Void!', {
            fontSize: isMobile ? '24px' : '36px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(width / 2, isMobile ? 90 : 120, 'Here\'s how to play:', {
            fontSize: isMobile ? '16px' : '22px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
        this.elements.push(subtitle);

        if (isMobile) {
            this.createMobileControls(width, height);
        } else {
            this.createDesktopControls(width, height);
        }

        // Continue button
        const continueBtn = this.scene.add.text(width / 2, height - (isMobile ? 60 : 80), 'TAP TO START', {
            fontSize: isMobile ? '20px' : '26px',
            color: '#FFFFFF',
            backgroundColor: '#7B68EE',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
        continueBtn.setInteractive({ useHandCursor: true });
        continueBtn.on('pointerdown', () => this.hide());
        continueBtn.on('pointerover', () => continueBtn.setBackgroundColor('#9370DB'));
        continueBtn.on('pointerout', () => continueBtn.setBackgroundColor('#7B68EE'));
        this.elements.push(continueBtn);

        // Click anywhere to dismiss
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.hide());

        // Any key to dismiss (desktop)
        if (!isMobile) {
            this.anyKeyHandler = () => this.hide();
            this.scene.input.keyboard?.once('keydown', this.anyKeyHandler);
        }

        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        devLog('[ControlsTutorialOverlay] Shown');
    }

    createMobileControls(width, height) {
        const centerY = height / 2;
        const leftX = width * 0.28;
        const rightX = width * 0.72;

        // Left side: Joystick
        const moveTitle = this.scene.add.text(leftX, centerY - 100, 'MOVE', {
            fontSize: '18px',
            color: '#4ECDC4',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
        this.elements.push(moveTitle);

        // Draw joystick diagram
        const joystickGraphic = this.scene.add.graphics();
        joystickGraphic.setDepth(10001).setScrollFactor(0);
        joystickGraphic.fillStyle(0x333333, 0.8);
        joystickGraphic.fillCircle(leftX, centerY, 45);
        joystickGraphic.fillStyle(0x666666, 0.9);
        joystickGraphic.fillCircle(leftX, centerY, 22);
        // Arrows
        joystickGraphic.lineStyle(3, 0x4ECDC4);
        joystickGraphic.lineBetween(leftX, centerY - 28, leftX, centerY - 40);
        joystickGraphic.lineBetween(leftX, centerY + 28, leftX, centerY + 40);
        joystickGraphic.lineBetween(leftX - 28, centerY, leftX - 40, centerY);
        joystickGraphic.lineBetween(leftX + 28, centerY, leftX + 40, centerY);
        this.elements.push(joystickGraphic);

        const joystickLabel = this.scene.add.text(leftX, centerY + 70, 'Drag to move', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
        this.elements.push(joystickLabel);

        // Right side: Action buttons
        const actionTitle = this.scene.add.text(rightX, centerY - 100, 'ACTIONS', {
            fontSize: '18px',
            color: '#FFD166',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
        this.elements.push(actionTitle);

        // Draw action buttons
        const buttons = [
            { emoji: '💬', desc: 'Chat with creature', y: centerY - 40 },
            { emoji: '🎒', desc: 'Open inventory', y: centerY },
            { emoji: '⚔️', desc: 'Attack enemies', y: centerY + 40 }
        ];

        buttons.forEach(btn => {
            const btnBg = this.scene.add.graphics();
            btnBg.setDepth(10001).setScrollFactor(0);
            btnBg.fillStyle(0x7B68EE, 0.8);
            btnBg.fillCircle(rightX - 50, btn.y, 22);
            this.elements.push(btnBg);

            const btnText = this.scene.add.text(rightX - 50, btn.y, btn.emoji, {
                fontSize: '18px'
            }).setOrigin(0.5).setDepth(10002).setScrollFactor(0);
            this.elements.push(btnText);

            const descText = this.scene.add.text(rightX - 15, btn.y, btn.desc, {
                fontSize: '13px',
                color: '#FFFFFF'
            }).setOrigin(0, 0.5).setDepth(10001).setScrollFactor(0);
            this.elements.push(descText);
        });
    }

    createDesktopControls(width, height) {
        const centerY = height / 2;

        // Panel background
        const panel = this.scene.add.graphics();
        panel.setDepth(10001).setScrollFactor(0);
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(width / 2 - 280, centerY - 180, 560, 360, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(width / 2 - 280, centerY - 180, 560, 360, 15);
        this.elements.push(panel);

        const controls = [
            { keys: 'W A S D / Arrow Keys', action: 'Move your creature' },
            { keys: 'SPACE', action: 'Interact with objects' },
            { keys: 'TAB', action: 'Open care menu' },
            { keys: 'C', action: 'Switch creatures' },
            { keys: 'I', action: 'Open inventory' },
            { keys: 'Click Chat Bubble', action: 'Talk to your creature' },
            { keys: 'ESC', action: 'Close menus' }
        ];

        controls.forEach((ctrl, index) => {
            const y = centerY - 130 + index * 45;

            const keyText = this.scene.add.text(width / 2 - 230, y, ctrl.keys, {
                fontSize: '18px',
                color: '#4ECDC4',
                fontStyle: 'bold'
            }).setDepth(10002).setScrollFactor(0);
            this.elements.push(keyText);

            const actionText = this.scene.add.text(width / 2 + 20, y, ctrl.action, {
                fontSize: '18px',
                color: '#FFFFFF'
            }).setDepth(10002).setScrollFactor(0);
            this.elements.push(actionText);
        });
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;

        // Mark as seen
        window.GameState?.set('tutorial.controlsSeen', true);
        window.GameState?.save();

        // Cleanup
        if (this.anyKeyHandler) {
            this.scene.input.keyboard?.off('keydown', this.anyKeyHandler);
            this.anyKeyHandler = null;
        }

        this.elements.forEach(el => {
            if (el) {
                el.removeAllListeners?.();
                el.destroy?.();
            }
        });
        this.elements = [];

        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        devLog('[ControlsTutorialOverlay] Hidden and marked as seen');
    }

    cleanup() {
        this.hide();
    }
}
