/**
 * CreatureRadialMenu - Radial menu shown when tapping/clicking the creature
 * Provides quick access to the creature's relationship and utility actions.
 */

import { devLog } from '../utils/devLogger.js';

export default class CreatureRadialMenu {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.isAnimating = false;

        const actions = [
            { id: 'profile', icon: '📋', label: 'Profile' },
            { id: 'chat', icon: '💬', label: 'Chat' },
            ...(window.APIConfig?.isEnabled?.()
                ? [{ id: 'ai_art', icon: '🎨', label: 'AI Art' }]
                : []),
            { id: 'abilities', icon: '✨', label: 'Abilities' },
            { id: 'pet', icon: '🤲', label: 'Pet' },
            { id: 'care', icon: '💖', label: 'Care' }
        ];
        const angleStep = 360 / actions.length;
        this.menuItems = actions.map((item, index) => ({
            ...item,
            angle: -90 + (index * angleStep)
        }));

        // UI elements
        this.container = null;
        this.centerCircle = null;
        this.buttons = [];
        this.labels = [];
        this.backdrop = null;

        // Animation config
        const isCompact = (this.scene.scale?.width || window.innerWidth) < 520;
        this.radius = isCompact ? 74 : 88;
        this.buttonSize = isCompact ? 44 : 48;
        this.labelRadius = this.radius + (isCompact ? 32 : 40);
    }

    /**
     * Show the radial menu at creature position
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     */
    show(x, y) {
        if (this.isVisible || this.isAnimating) return;

        this.isAnimating = true;
        const center = this.getMenuCenter(x, y);
        this.create(center.x, center.y);
        this.animateIn();

        devLog('[CreatureRadialMenu] Showing at', center.x, center.y);
    }

    getMenuCenter(x, y) {
        const camera = this.scene.cameras?.main;
        const worldView = camera?.worldView;
        if (!worldView) return { x, y };

        const zoom = camera.zoom || 1;
        const horizontalMargin = Math.min(
            (worldView.width / 2) - 8,
            (this.labelRadius + 38) / zoom
        );
        const verticalMargin = Math.min(
            (worldView.height / 2) - 8,
            (this.labelRadius + 20) / zoom
        );
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        return {
            x: clamp(x, worldView.left + horizontalMargin, worldView.right - horizontalMargin),
            y: clamp(y, worldView.top + verticalMargin, worldView.bottom - verticalMargin)
        };
    }

    /**
     * Hide and destroy the radial menu
     */
    hide() {
        if (!this.isVisible || this.isAnimating) return;

        this.isAnimating = true;
        this.animateOut();

        devLog('[CreatureRadialMenu] Hiding');
    }

    create(x, y) {
        // Semi-transparent backdrop to detect outside clicks
        this.backdrop = this.scene.add.graphics();
        this.backdrop.fillStyle(0x000000, 0.3);
        this.backdrop.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
        this.backdrop.setScrollFactor(0);
        this.backdrop.setDepth(2998);

        // Make backdrop interactive to close menu
        const backdropZone = this.scene.add.zone(
            this.scene.scale.width / 2,
            this.scene.scale.height / 2,
            this.scene.scale.width,
            this.scene.scale.height
        ).setInteractive().setScrollFactor(0).setDepth(2998);

        backdropZone.on('pointerdown', () => {
            this.hide();
        });
        this.backdropZone = backdropZone;

        // Create container for the menu (in world space)
        this.container = this.scene.add.container(x, y);
        this.container.setDepth(3000);

        // Center circle (creature indicator)
        this.centerCircle = this.scene.add.graphics();
        this.centerCircle.fillStyle(0x7B68EE, 0.8);
        this.centerCircle.fillCircle(0, 0, 30);
        this.centerCircle.lineStyle(3, 0xFFFFFF, 0.9);
        this.centerCircle.strokeCircle(0, 0, 30);
        this.container.add(this.centerCircle);

        // Center icon (creature emoji)
        const centerIcon = this.scene.add.text(0, 0, '🐾', {
            fontSize: '24px'
        }).setOrigin(0.5);
        this.container.add(centerIcon);
        this.centerIcon = centerIcon;

        // Create radial buttons
        this.menuItems.forEach((item, index) => {
            const button = this.createButton(item, index);
            this.buttons.push(button);
        });
    }

    createButton(item, index) {
        const angleRad = Phaser.Math.DegToRad(item.angle);
        const targetX = Math.cos(angleRad) * this.radius;
        const targetY = Math.sin(angleRad) * this.radius;

        // Button group
        const buttonGroup = {
            graphics: null,
            icon: null,
            label: null,
            hitArea: null,
            targetX,
            targetY,
            item
        };

        // Button background
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x1A1A3E, 0.95);
        graphics.fillCircle(0, 0, this.buttonSize / 2);
        graphics.lineStyle(3, 0x7B68EE, 1);
        graphics.strokeCircle(0, 0, this.buttonSize / 2);
        graphics.setPosition(0, 0); // Start at center
        graphics.setAlpha(0);
        this.container.add(graphics);
        buttonGroup.graphics = graphics;

        // Button icon
        const icon = this.scene.add.text(0, 0, item.icon, {
            fontSize: '24px'
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(icon);
        buttonGroup.icon = icon;

        // Keep labels outside the action ring for any enabled action count.
        const labelX = Math.cos(angleRad) * this.labelRadius;
        const labelY = Math.sin(angleRad) * this.labelRadius;

        const label = this.scene.add.text(0, 0, item.label, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(label);
        buttonGroup.label = label;
        buttonGroup.labelTargetX = labelX;
        buttonGroup.labelTargetY = labelY;

        // Hit area for interaction
        const hitArea = this.scene.add.zone(0, 0, this.buttonSize + 10, this.buttonSize + 10)
            .setInteractive({ useHandCursor: true });
        this.container.add(hitArea);
        buttonGroup.hitArea = hitArea;

        // Hover effects
        hitArea.on('pointerover', () => {
            this.scene.tweens.add({
                targets: [graphics, icon],
                scale: 1.15,
                duration: 100,
                ease: 'Back.easeOut'
            });
            graphics.clear();
            graphics.fillStyle(0x7B68EE, 1);
            graphics.fillCircle(0, 0, this.buttonSize / 2);
            graphics.lineStyle(3, 0xFFD700, 1);
            graphics.strokeCircle(0, 0, this.buttonSize / 2);
        });

        hitArea.on('pointerout', () => {
            this.scene.tweens.add({
                targets: [graphics, icon],
                scale: 1,
                duration: 100
            });
            graphics.clear();
            graphics.fillStyle(0x1A1A3E, 0.95);
            graphics.fillCircle(0, 0, this.buttonSize / 2);
            graphics.lineStyle(3, 0x7B68EE, 1);
            graphics.strokeCircle(0, 0, this.buttonSize / 2);
        });

        // Click handler
        hitArea.on('pointerdown', () => {
            this.onButtonClick(item.id);
        });

        return buttonGroup;
    }

    animateIn() {
        // Animate center circle
        this.centerCircle.setScale(0);
        this.scene.tweens.add({
            targets: this.centerCircle,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });

        this.centerIcon.setScale(0);
        this.scene.tweens.add({
            targets: this.centerIcon,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });

        // Animate buttons outward with stagger
        this.buttons.forEach((button, index) => {
            const delay = index * 50;

            // Graphics expand outward
            this.scene.tweens.add({
                targets: button.graphics,
                x: button.targetX,
                y: button.targetY,
                alpha: 1,
                duration: 300,
                delay: delay,
                ease: 'Back.easeOut'
            });

            // Icon follows
            this.scene.tweens.add({
                targets: button.icon,
                x: button.targetX,
                y: button.targetY,
                alpha: 1,
                duration: 300,
                delay: delay,
                ease: 'Back.easeOut'
            });

            // Hit area follows
            this.scene.tweens.add({
                targets: button.hitArea,
                x: button.targetX,
                y: button.targetY,
                duration: 300,
                delay: delay,
                ease: 'Back.easeOut'
            });

            // Label fades in
            this.scene.tweens.add({
                targets: button.label,
                x: button.labelTargetX,
                y: button.labelTargetY,
                alpha: 1,
                duration: 300,
                delay: delay + 100,
                ease: 'Power2'
            });
        });

        // Mark as visible after animation
        this.scene.time.delayedCall(400, () => {
            this.isVisible = true;
            this.isAnimating = false;
        });
    }

    animateOut() {
        // Animate buttons back to center
        this.buttons.forEach((button, index) => {
            const delay = (this.buttons.length - 1 - index) * 30;

            this.scene.tweens.add({
                targets: [button.graphics, button.icon, button.hitArea],
                x: 0,
                y: 0,
                alpha: 0,
                duration: 200,
                delay: delay,
                ease: 'Back.easeIn'
            });

            this.scene.tweens.add({
                targets: button.label,
                alpha: 0,
                duration: 150,
                delay: delay
            });
        });

        // Animate center out
        this.scene.tweens.add({
            targets: [this.centerCircle, this.centerIcon],
            scale: 0,
            alpha: 0,
            duration: 200,
            delay: 120
        });

        // Fade backdrop
        this.scene.tweens.add({
            targets: this.backdrop,
            alpha: 0,
            duration: 200
        });

        // Cleanup after animation
        this.scene.time.delayedCall(350, () => {
            this.destroy();
            this.isVisible = false;
            this.isAnimating = false;
        });
    }

    onButtonClick(itemId) {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        devLog('[CreatureRadialMenu] Button clicked:', itemId);

        // Emit event for the scene to handle
        this.scene.events.emit('radialMenuSelect', itemId);

        // Close menu
        this.hide();
    }

    destroy() {
        // Clean up buttons
        this.buttons.forEach(button => {
            button.hitArea?.removeAllListeners();
            button.hitArea?.destroy();
            button.graphics?.destroy();
            button.icon?.destroy();
            button.label?.destroy();
        });
        this.buttons = [];

        // Clean up center
        this.centerCircle?.destroy();
        this.centerIcon?.destroy();

        // Clean up container
        this.container?.destroy();
        this.container = null;

        // Clean up backdrop
        this.backdrop?.destroy();
        this.backdrop = null;
        this.backdropZone?.removeAllListeners();
        this.backdropZone?.destroy();
        this.backdropZone = null;

        devLog('[CreatureRadialMenu] Destroyed');
    }
}
