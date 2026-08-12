/**
 * ControlsHintPanel - Toggleable control hints for desktop players
 * Shows keyboard controls with visual indicators
 * Can be toggled with 'H' key or by clicking help icon
 */

import { devLog } from '../utils/devLogger.js';

export default class ControlsHintPanel {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.elements = [];
        this.isVisible = false;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
        const touchCapable = 'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            coarsePointer;
        this.isMobile = window.innerWidth < 600 ||
            (touchCapable && window.innerWidth < 1024);

        // Configuration
        this.position = options.position || 'top-right'; // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
        this.showOnStart = options.showOnStart !== undefined ? options.showOnStart : !this.isMobile;
        this.autoHideDelay = options.autoHideDelay || 8000; // Auto-hide after 8 seconds
        this.controls = options.controls || this.getDefaultControls();

        // Toggle key
        this.toggleKey = null;
        this.helpIcon = null;
        this.autoHideTimer = null;
    }

    /**
     * Get default control scheme based on scene
     */
    getDefaultControls() {
        const sceneKey = this.scene?.scene?.key || '';

        if (sceneKey === 'PlatformerLevelScene' || sceneKey.includes('Platformer') || sceneKey.includes('Caves')) {
            return this.getPlatformerControls();
        } else if (sceneKey === 'HubWorldScene') {
            return this.getHubWorldControls();
        } else {
            return this.getGameSceneControls();
        }
    }

    getGameSceneControls() {
        return [
            { key: 'WASD / Arrows', action: 'Move creature' },
            { key: 'SPACE', action: 'Interact with objects/portals' },
            { key: 'E', action: 'Attack enemies' },
            { key: 'I', action: 'Open inventory' },
            { key: 'S', action: 'Open shop' },
            { key: 'C', action: 'Chat with creature' },
            { key: 'ESC', action: 'Pause game' },
            { key: 'H', action: 'Toggle this help' }
        ];
    }

    getPlatformerControls() {
        return [
            { key: 'A / Left Arrow', action: 'Move left' },
            { key: 'D / Right Arrow', action: 'Move right' },
            { key: 'SPACE / W / Up', action: 'Jump' },
            { key: 'E', action: 'Attack' },
            { key: 'Q', action: 'Special ability' },
            { key: 'ESC', action: 'Return to hub' },
            { key: 'H', action: 'Toggle this help' }
        ];
    }

    getHubWorldControls() {
        return [
            { key: 'A / D / Arrows', action: 'Navigate gates' },
            { key: 'SPACE / Enter', action: 'Select gate' },
            { key: 'TAB', action: 'View creature collection' },
            { key: 'ESC', action: 'Return to sanctuary' },
            { key: 'H', action: 'Toggle this help' }
        ];
    }

    /**
     * Initialize the control hints
     */
    init() {
        if (this.isMobile) {
            devLog('[ControlsHintPanel] Skipping on mobile device');
            return;
        }

        // Set up toggle key (H for help)
        if (this.scene.input && this.scene.input.keyboard) {
            this.toggleKey = this.scene.input.keyboard.addKey('H');
            this.toggleKey.on('down', () => this.toggle());
        }

        // Create help icon button in corner
        this.createHelpIcon();

        // Show on start if configured AND not already seen
        // Only show controls on first ever visit to prevent annoyance
        const hasSeenControls = window.GameState?.get('tutorial.controlsSeen');
        if (this.showOnStart && !hasSeenControls) {
            this.show(true); // true = auto-hide
            // Mark as seen when shown
            window.GameState?.set('tutorial.controlsSeen', true);
            window.GameState?.save?.();
        }

        devLog('[ControlsHintPanel] Initialized');
    }

    /**
     * Create help icon button
     */
    createHelpIcon() {
        const { width, height } = this.scene.scale;
        let x, y;

        switch (this.position) {
            case 'top-right':
                x = width - 40;
                y = 40;
                break;
            case 'top-left':
                x = 40;
                y = 40;
                break;
            case 'bottom-right':
                x = width - 40;
                y = height - 40;
                break;
            case 'bottom-left':
                x = 40;
                y = height - 40;
                break;
            default:
                x = width - 40;
                y = 40;
        }

        // Help icon background circle
        const iconBg = this.scene.add.graphics();
        iconBg.fillStyle(0x7B68EE, 0.8);
        iconBg.fillCircle(x, y, 24);
        iconBg.lineStyle(2, 0xFFFFFF, 0.9);
        iconBg.strokeCircle(x, y, 24);
        iconBg.setDepth(9998);
        iconBg.setScrollFactor(0);

        // Help icon text
        const iconText = this.scene.add.text(x, y, 'H', {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(9999).setScrollFactor(0);

        // Make interactive
        const hitArea = this.scene.add.zone(x, y, 48, 48);
        hitArea.setInteractive({ useHandCursor: true });
        hitArea.setDepth(9999);
        hitArea.setScrollFactor(0);

        hitArea.on('pointerover', () => {
            iconBg.clear();
            iconBg.fillStyle(0x9B7FFF, 0.9);
            iconBg.fillCircle(x, y, 26);
            iconBg.lineStyle(2, 0xFFD700, 1);
            iconBg.strokeCircle(x, y, 26);
        });

        hitArea.on('pointerout', () => {
            iconBg.clear();
            iconBg.fillStyle(0x7B68EE, 0.8);
            iconBg.fillCircle(x, y, 24);
            iconBg.lineStyle(2, 0xFFFFFF, 0.9);
            iconBg.strokeCircle(x, y, 24);
        });

        hitArea.on('pointerdown', () => {
            this.toggle();
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
        });

        this.helpIcon = { bg: iconBg, text: iconText, zone: hitArea };
    }

    /**
     * Show the control hints panel
     * @param {boolean} autoHide - Whether to auto-hide after delay
     */
    show(autoHide = false) {
        if (this.isVisible || this.isMobile) return;

        const { width, height } = this.scene.scale;

        // Semi-transparent overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.4);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(9990);
        overlay.setScrollFactor(0);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.hide());
        this.elements.push(overlay);

        // Panel dimensions
        const panelWidth = Math.min(500, width - 80);
        const panelHeight = Math.min(400, height - 120);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        // Panel background
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(9991);
        panel.setScrollFactor(0);
        this.elements.push(panel);

        // Title
        const title = this.scene.add.text(width / 2, panelY + 30, '⌨️ Keyboard Controls', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(9992).setScrollFactor(0);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(width / 2, panelY + 62, 'Press H to toggle this panel anytime', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(9992).setScrollFactor(0);
        this.elements.push(subtitle);

        // Controls list
        const startY = panelY + 100;
        const lineHeight = 32;

        this.controls.forEach((control, index) => {
            const y = startY + (index * lineHeight);

            // Key background
            const keyBg = this.scene.add.graphics();
            keyBg.fillStyle(0x2A2A5E, 0.8);
            keyBg.fillRoundedRect(panelX + 30, y - 12, 150, 28, 6);
            keyBg.lineStyle(1, 0x7B68EE, 0.5);
            keyBg.strokeRoundedRect(panelX + 30, y - 12, 150, 28, 6);
            keyBg.setDepth(9992);
            keyBg.setScrollFactor(0);
            this.elements.push(keyBg);

            // Key text
            const keyText = this.scene.add.text(panelX + 105, y, control.key, {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(9993).setScrollFactor(0);
            this.elements.push(keyText);

            // Action text
            const actionText = this.scene.add.text(panelX + 200, y, control.action, {
                fontSize: '14px',
                color: '#FFFFFF'
            }).setDepth(9993).setScrollFactor(0);
            this.elements.push(actionText);
        });

        // Close button
        const closeBtn = this.scene.add.text(width / 2, panelY + panelHeight - 35, 'CLOSE (ESC or H)', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#555555',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setDepth(9994).setScrollFactor(0);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.hide());
        closeBtn.on('pointerover', () => closeBtn.setBackgroundColor('#777777'));
        closeBtn.on('pointerout', () => closeBtn.setBackgroundColor('#555555'));
        this.elements.push(closeBtn);

        // ESC key to close
        const escKey = this.scene.input.keyboard?.addKey('ESC');
        if (escKey) {
            const escHandler = () => {
                this.hide();
                escKey.off('down', escHandler);
            };
            escKey.on('down', escHandler);
        }

        // Fade in animation
        this.elements.forEach(el => {
            if (el.setAlpha) {
                el.setAlpha(0);
                this.scene.tweens.add({
                    targets: el,
                    alpha: el.type === 'Graphics' && el !== overlay ? 1 : el.alpha || 1,
                    duration: 300,
                    ease: 'Power2'
                });
            }
        });

        this.isVisible = true;

        // Auto-hide if requested
        if (autoHide && this.autoHideDelay > 0) {
            this.autoHideTimer = this.scene.time.delayedCall(this.autoHideDelay, () => {
                this.hide();
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[ControlsHintPanel] Shown');
    }

    /**
     * Hide the control hints panel
     */
    hide() {
        if (!this.isVisible) return;

        // Cancel auto-hide timer
        if (this.autoHideTimer) {
            this.autoHideTimer.remove();
            this.autoHideTimer = null;
        }

        // Fade out and destroy
        this.elements.forEach(el => {
            if (el) {
                this.scene.tweens.add({
                    targets: el,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        el.removeAllListeners?.();
                        el.destroy?.();
                    }
                });
            }
        });

        this.elements = [];
        this.isVisible = false;

        devLog('[ControlsHintPanel] Hidden');
    }

    /**
     * Toggle visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(false); // Manual toggle = no auto-hide
        }
    }

    /**
     * Clean up
     */
    cleanup() {
        this.hide();

        if (this.toggleKey) {
            this.toggleKey.removeAllListeners();
            this.toggleKey = null;
        }

        if (this.helpIcon) {
            this.helpIcon.bg?.destroy();
            this.helpIcon.text?.destroy();
            this.helpIcon.zone?.destroy();
            this.helpIcon = null;
        }

        devLog('[ControlsHintPanel] Cleaned up');
    }
}
