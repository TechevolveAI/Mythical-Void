/**
 * ControlsTutorialOverlay - One-time overlay showing game controls
 * Shows mobile or desktop controls based on device
 */

import { devLog } from '../utils/devLogger.js';
import { createCanvasTapBridge } from '../utils/CanvasTapBridge.js';

export default class ControlsTutorialOverlay {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.isVisible = false;
        this.anyKeyHandler = null;
        this.continueTapBridge = null;
        this.nativeContinueDom = null;
        this.nativeContinueButton = null;
        this.nativeContinueHandler = null;
        this.previousDomContainerStyles = null;
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
    show({ force = false } = {}) {
        if (!force && !this.shouldShow()) {
            devLog('[ControlsTutorialOverlay] Already seen, skipping');
            return;
        }

        this.isVisible = true;
        this.restoreMobileControls = this.scene.mobileControls?.suspend?.() === true;
        const { width, height } = this.scene.scale;
        const isMobile = width < 600 ||
            ('ontouchstart' in window && window.innerWidth < 768);

        // Full screen overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x02080B, 0.94);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(13000);
        overlay.setScrollFactor(0);
        this.elements.push(overlay);

        // Title
        const title = this.scene.add.text(width / 2, isMobile ? 50 : 70, 'PROJECT BEACON // FIELD CONTROLS', {
            fontSize: isMobile ? '17px' : '30px',
            color: '#F2C14E',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(title);

        // Subtitle
        const subtitle = this.scene.add.text(width / 2, isMobile ? 90 : 120, 'You are in control. Keep the hatchling close.', {
            fontSize: isMobile ? '14px' : '19px',
            color: '#B9DAD7'
        }).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(subtitle);

        if (isMobile) {
            this.createMobileControls(width, height);
        } else {
            this.createDesktopControls(width, height);
        }

        // Continue button
        const continueBtn = this.scene.add.text(width / 2, height - (isMobile ? 60 : 80), 'START FIELDWORK', {
            fontSize: isMobile ? '20px' : '26px',
            color: '#061116',
            backgroundColor: '#6FE7DD',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setDepth(13002).setScrollFactor(0);
        continueBtn.setInteractive({ useHandCursor: true });
        this.continueTapBridge?.destroy?.();
        this.continueTapBridge = createCanvasTapBridge({
            canvas: this.scene.game?.canvas,
            getGameSize: () => ({
                width: this.scene.scale.width,
                height: this.scene.scale.height
            }),
            getBounds: () => continueBtn.active ? continueBtn.getBounds() : null,
            onActivate: () => this.hide()
        });
        // Phaser has already hit-tested the button at this point. Rechecking
        // its coordinates through the canvas bridge can disagree after mobile
        // canvas scaling and leave this blocking overlay visible.
        continueBtn.on('pointerup', () => this.hide());
        continueBtn.on('pointerover', () => continueBtn.setBackgroundColor('#8AF5EC'));
        continueBtn.on('pointerout', () => continueBtn.setBackgroundColor('#6FE7DD'));
        this.elements.push(continueBtn);

        // Keep the only blocking action on the browser input layer as well as
        // the Phaser canvas. Physical iPhones can lose a canvas release after
        // the portrait/story DOM handoff, while a native button remains stable.
        const domContainer = this.scene.game?.domContainer || null;
        if (domContainer) {
            this.previousDomContainerStyles = {
                zIndex: domContainer.style.zIndex,
                pointerEvents: domContainer.style.pointerEvents
            };
            domContainer.style.zIndex = '13010';
            domContainer.style.pointerEvents = 'auto';

            const nativeButton = document.createElement('button');
            nativeButton.type = 'button';
            nativeButton.className = 'field-controls-continue';
            nativeButton.textContent = 'START FIELDWORK';
            nativeButton.setAttribute('aria-label', 'Start exploring the Sanctuary');
            nativeButton.setAttribute('data-testid', 'field-controls-continue');
            this.nativeContinueHandler = event => {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                this.hide();
            };
            nativeButton.addEventListener('pointerdown', this.nativeContinueHandler);
            nativeButton.addEventListener('touchstart', this.nativeContinueHandler, {
                passive: false
            });
            nativeButton.addEventListener('click', this.nativeContinueHandler);
            this.nativeContinueButton = nativeButton;
            this.nativeContinueDom = this.scene.add.dom(
                width / 2,
                height - (isMobile ? 60 : 80),
                nativeButton
            ).setOrigin(0.5).setDepth(13011).setScrollFactor(0);
            continueBtn.setAlpha(0);
        }

        // Click anywhere to dismiss
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.hide());
        overlay.on('pointerup', () => this.hide());

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
        }).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(moveTitle);

        // Draw joystick diagram
        const joystickGraphic = this.scene.add.graphics();
        joystickGraphic.setDepth(13001).setScrollFactor(0);
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
        }).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(joystickLabel);

        // Right side: Action buttons
        const actionTitle = this.scene.add.text(rightX, centerY - 100, 'ACTIONS', {
            fontSize: '18px',
            color: '#FFD166',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(actionTitle);

        // Draw action buttons
        const buttons = [
            { emoji: '💬', desc: 'Chat', y: centerY - 40 },
            { emoji: '🎒', desc: 'Inventory', y: centerY },
            { emoji: '✋', desc: 'Interact', y: centerY + 40 }
        ];

        buttons.forEach(btn => {
            const btnBg = this.scene.add.graphics();
            btnBg.setDepth(13001).setScrollFactor(0);
            btnBg.fillStyle(0x7B68EE, 0.8);
            btnBg.fillCircle(rightX - 50, btn.y, 22);
            this.elements.push(btnBg);

            const btnText = this.scene.add.text(rightX - 50, btn.y, btn.emoji, {
                fontSize: '18px'
            }).setOrigin(0.5).setDepth(13002).setScrollFactor(0);
            this.elements.push(btnText);

            const descText = this.scene.add.text(rightX - 15, btn.y, btn.desc, {
                fontSize: '12px',
                color: '#FFFFFF'
            }).setOrigin(0, 0.5).setDepth(13001).setScrollFactor(0);
            this.elements.push(descText);
        });

        const companionNote = this.scene.add.text(
            width / 2,
            centerY + 135,
            'Tap creature: Care, Chat, Profile.',
            {
                fontSize: '13px',
                color: '#B9DAD7',
                align: 'center',
                wordWrap: { width: width - 40 }
            }
        ).setOrigin(0.5).setDepth(13001).setScrollFactor(0);
        this.elements.push(companionNote);
    }

    createDesktopControls(width, height) {
        const centerY = height / 2;

        // Panel background
        const panel = this.scene.add.graphics();
        panel.setDepth(13001).setScrollFactor(0);
        panel.fillStyle(0x071418, 0.97);
        panel.fillRoundedRect(width / 2 - 280, centerY - 180, 560, 360, 15);
        panel.lineStyle(3, 0x6FE7DD);
        panel.strokeRoundedRect(width / 2 - 280, centerY - 180, 560, 360, 15);
        this.elements.push(panel);

        const controls = [
            { keys: 'W A S D / Arrow Keys', action: 'Move together' },
            { keys: 'SPACE', action: 'Interact with markers' },
            { keys: 'TAB', action: 'Open Care Corner' },
            { keys: 'F / Y / R', action: 'Feed, play, or rest' },
            { keys: 'T', action: 'Talk with creature' },
            { keys: 'I', action: 'Open field inventory' },
            { keys: 'ESC', action: 'Close menus' }
        ];

        controls.forEach((ctrl, index) => {
            const y = centerY - 130 + index * 45;

            const keyText = this.scene.add.text(width / 2 - 230, y, ctrl.keys, {
                fontSize: '18px',
                color: '#4ECDC4',
                fontStyle: 'bold'
            }).setDepth(13002).setScrollFactor(0);
            this.elements.push(keyText);

            const actionText = this.scene.add.text(width / 2 + 20, y, ctrl.action, {
                fontSize: '18px',
                color: '#FFFFFF'
            }).setDepth(13002).setScrollFactor(0);
            this.elements.push(actionText);
        });
    }

    hide() {
        if (!this.isVisible && this.elements.length === 0 && !this.nativeContinueDom) return;
        this.isVisible = false;

        // Release every blocking input layer before persistence. Storage and
        // telemetry are allowed to fail; they must never trap a child here.
        if (this.anyKeyHandler) {
            this.scene.input.keyboard?.off('keydown', this.anyKeyHandler);
            this.anyKeyHandler = null;
        }
        this.continueTapBridge?.destroy?.();
        this.continueTapBridge = null;

        if (this.nativeContinueButton && this.nativeContinueHandler) {
            this.nativeContinueButton.removeEventListener(
                'pointerdown',
                this.nativeContinueHandler
            );
            this.nativeContinueButton.removeEventListener(
                'touchstart',
                this.nativeContinueHandler
            );
            this.nativeContinueButton.removeEventListener(
                'click',
                this.nativeContinueHandler
            );
        }
        this.nativeContinueDom?.destroy?.();
        this.nativeContinueDom = null;
        this.nativeContinueButton = null;
        this.nativeContinueHandler = null;

        const domContainer = this.scene.game?.domContainer || null;
        if (domContainer && this.previousDomContainerStyles) {
            domContainer.style.zIndex = this.previousDomContainerStyles.zIndex;
            domContainer.style.pointerEvents =
                this.previousDomContainerStyles.pointerEvents || 'none';
        }
        this.previousDomContainerStyles = null;

        this.elements.forEach(el => {
            if (el) {
                el.removeAllListeners?.();
                el.destroy?.();
            }
        });
        this.elements = [];
        if (this.restoreMobileControls) {
            this.scene.mobileControls?.resume?.();
        }
        this.restoreMobileControls = false;

        try {
            window.GameState?.set('tutorial.controlsSeen', true);
            window.GameState?.recordOpeningMilestone?.('controls_completed');
            window.GameState?.save?.();
        } catch (error) {
            console.error('[ControlsTutorialOverlay] Progress record failed:', error);
        }

        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        devLog('[ControlsTutorialOverlay] Hidden and marked as seen');
    }

    cleanup() {
        this.hide();
    }
}
