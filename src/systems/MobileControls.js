/**
 * MobileControls - Professional mobile control system with virtual joystick and action buttons
 * Provides touch-based controls for mobile devices while maintaining desktop keyboard controls
 */

class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.isMobile = this.detectMobile();
        this.isVisible = false;

        // Joystick state
        this.joystickBase = null;
        this.joystickThumb = null;
        this.joystickZone = null;
        this.joystickActive = false;
        this.joystickStartX = 0;
        this.joystickStartY = 0;
        this.joystickMaxDistance = 50;

        // Action buttons
        this.actionButtons = {};

        // Button state tracking
        this.buttonStates = {
            attack: false,
            interact: false,
            inventory: false,
            care: false
        };

        console.log('[MobileControls] Initialized, isMobile:', this.isMobile);
    }

    /**
     * Detect if device is mobile or touch-capable
     */
    detectMobile() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 768;
        return isTouchDevice && isSmallScreen;
    }

    /**
     * Create and show mobile controls
     */
    show() {
        if (!this.isMobile || this.isVisible) return;

        console.log('[MobileControls] Creating mobile UI');

        // Create virtual joystick (left side)
        this.createVirtualJoystick();

        // Create action buttons (right side)
        this.createActionButtons();

        this.isVisible = true;
        console.log('[MobileControls] Mobile controls visible');
    }

    /**
     * Hide mobile controls
     */
    hide() {
        if (!this.isVisible) return;

        // Destroy joystick
        if (this.joystickBase) this.joystickBase.destroy();
        if (this.joystickThumb) this.joystickThumb.destroy();
        if (this.joystickZone) this.joystickZone.destroy();

        // Destroy buttons
        Object.values(this.actionButtons).forEach(button => {
            if (button.bg) button.bg.destroy();
            if (button.icon) button.icon.destroy();
            if (button.zone) button.zone.destroy();
        });

        this.isVisible = false;
        console.log('[MobileControls] Mobile controls hidden');
    }

    /**
     * Create virtual joystick for movement
     */
    createVirtualJoystick() {
        const { width, height } = this.scene.scale;

        // Position joystick in bottom-left
        const joystickX = 100;
        const joystickY = height - 100;

        // Create base circle
        this.joystickBase = this.scene.add.graphics();
        this.joystickBase.setScrollFactor(0);
        this.joystickBase.setDepth(10000);
        this.joystickBase.fillStyle(0x000000, 0.3);
        this.joystickBase.fillCircle(joystickX, joystickY, 60);
        this.joystickBase.lineStyle(3, 0xFFFFFF, 0.5);
        this.joystickBase.strokeCircle(joystickX, joystickY, 60);

        // Create thumb (moveable part)
        this.joystickThumb = this.scene.add.graphics();
        this.joystickThumb.setScrollFactor(0);
        this.joystickThumb.setDepth(10001);
        this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
        this.joystickThumb.fillCircle(joystickX, joystickY, 30);
        this.joystickThumb.lineStyle(2, 0x00CED1, 1);
        this.joystickThumb.strokeCircle(joystickX, joystickY, 30);

        // Create invisible zone for touch handling (larger than visual)
        this.joystickZone = this.scene.add.zone(joystickX, joystickY, 200, 200)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive({ draggable: true });

        // Store center position
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;

        // Handle touch/drag events
        this.joystickZone.on('pointerdown', (pointer) => {
            this.joystickActive = true;
            this.joystickStartX = pointer.x;
            this.joystickStartY = pointer.y;

            // Add subtle pulse effect
            this.scene.tweens.add({
                targets: this.joystickBase,
                alpha: 0.5,
                duration: 100,
                yoyo: true
            });
        });

        this.joystickZone.on('pointermove', (pointer) => {
            if (!this.joystickActive) return;

            // Calculate offset from center
            const offsetX = pointer.x - this.joystickCenterX;
            const offsetY = pointer.y - this.joystickCenterY;

            // Calculate distance and angle
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const angle = Math.atan2(offsetY, offsetX);

            // Clamp distance to max
            const clampedDistance = Math.min(distance, this.joystickMaxDistance);

            // Update thumb position
            const thumbX = this.joystickCenterX + Math.cos(angle) * clampedDistance;
            const thumbY = this.joystickCenterY + Math.sin(angle) * clampedDistance;

            this.joystickThumb.clear();
            this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
            this.joystickThumb.fillCircle(thumbX, thumbY, 30);
            this.joystickThumb.lineStyle(2, 0x00CED1, 1);
            this.joystickThumb.strokeCircle(thumbX, thumbY, 30);

            // Calculate normalized direction (-1 to 1)
            const normalizedX = (distance > 5) ? (Math.cos(angle) * (clampedDistance / this.joystickMaxDistance)) : 0;
            const normalizedY = (distance > 5) ? (Math.sin(angle) * (clampedDistance / this.joystickMaxDistance)) : 0;

            // Emit virtual joystick event
            this.scene.game.events.emit('virtual-joystick', {
                x: normalizedX,
                y: normalizedY
            });
        });

        this.joystickZone.on('pointerup', () => {
            this.joystickActive = false;

            // Reset thumb to center with tween
            this.scene.tweens.add({
                targets: this.joystickThumb,
                alpha: 1,
                duration: 150,
                ease: 'Back.easeOut',
                onUpdate: (tween) => {
                    const progress = tween.progress;
                    const currentX = this.joystickCenterX;
                    const currentY = this.joystickCenterY;

                    this.joystickThumb.clear();
                    this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
                    this.joystickThumb.fillCircle(currentX, currentY, 30);
                    this.joystickThumb.lineStyle(2, 0x00CED1, 1);
                    this.joystickThumb.strokeCircle(currentX, currentY, 30);
                }
            });

            // Emit zero movement
            this.scene.game.events.emit('virtual-joystick', { x: 0, y: 0 });
        });

        console.log('[MobileControls] Virtual joystick created at', joystickX, joystickY);
    }

    /**
     * Create action buttons for combat, interact, inventory, etc.
     */
    createActionButtons() {
        const { width, height } = this.scene.scale;

        // Button configurations (right side layout)
        const buttons = [
            {
                id: 'attack',
                label: '⚔️',
                x: width - 80,
                y: height - 100,
                size: 70,
                color: 0xFF4444,
                action: () => this.handleButtonPress('attack')
            },
            {
                id: 'interact',
                label: '👆',
                x: width - 180,
                y: height - 100,
                size: 60,
                color: 0x44FF44,
                action: () => this.handleButtonPress('interact')
            },
            {
                id: 'inventory',
                label: '🎒',
                x: width - 80,
                y: height - 190,
                size: 55,
                color: 0x4444FF,
                action: () => this.handleButtonPress('inventory')
            },
            {
                id: 'care',
                label: '❤️',
                x: width - 180,
                y: height - 190,
                size: 55,
                color: 0xFF44FF,
                action: () => this.handleButtonPress('care')
            }
        ];

        buttons.forEach(config => {
            this.createActionButton(config);
        });

        console.log('[MobileControls] Created', buttons.length, 'action buttons');
    }

    /**
     * Create a single action button
     */
    createActionButton(config) {
        const { id, label, x, y, size, color, action } = config;

        // Create background circle
        const bg = this.scene.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);
        bg.fillStyle(color, 0.7);
        bg.fillCircle(x, y, size / 2);
        bg.lineStyle(3, 0xFFFFFF, 0.8);
        bg.strokeCircle(x, y, size / 2);

        // Create icon/label
        const icon = this.scene.add.text(x, y, label, {
            fontSize: `${size * 0.5}px`,
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        icon.setOrigin(0.5);
        icon.setScrollFactor(0);
        icon.setDepth(10001);

        // Create interactive zone
        const zone = this.scene.add.zone(x, y, size, size)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive();

        // Handle touch events
        zone.on('pointerdown', () => {
            // Visual feedback
            bg.clear();
            bg.fillStyle(color, 1);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(4, 0xFFFFFF, 1);
            bg.strokeCircle(x, y, size / 2);

            // Scale animation
            this.scene.tweens.add({
                targets: [bg, icon],
                scaleX: 0.9,
                scaleY: 0.9,
                duration: 50,
                yoyo: true
            });

            // Execute action
            action();
        });

        zone.on('pointerup', () => {
            // Reset visual
            bg.clear();
            bg.fillStyle(color, 0.7);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(3, 0xFFFFFF, 0.8);
            bg.strokeCircle(x, y, size / 2);
        });

        zone.on('pointerout', () => {
            // Reset if finger leaves button
            bg.clear();
            bg.fillStyle(color, 0.7);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(3, 0xFFFFFF, 0.8);
            bg.strokeCircle(x, y, size / 2);
        });

        // Store button references
        this.actionButtons[id] = { bg, icon, zone };
    }

    /**
     * Handle action button press
     */
    handleButtonPress(buttonId) {
        console.log('[MobileControls] Button pressed:', buttonId);

        // Play sound feedback
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Emit appropriate event based on button
        switch (buttonId) {
            case 'attack':
                // Trigger combat projectile
                if (this.scene.fireCombatProjectile) {
                    this.scene.fireCombatProjectile();
                }
                break;

            case 'interact':
                // Trigger space interaction (shop, flowers, etc.)
                this.scene.game.events.emit('virtual-key', {
                    key: 'space',
                    type: 'down'
                });
                break;

            case 'inventory':
                // Open inventory
                if (this.scene.openInventory) {
                    this.scene.openInventory();
                }
                break;

            case 'care':
                // Open care panel
                if (this.scene.toggleCarePanel) {
                    this.scene.toggleCarePanel();
                }
                break;
        }
    }

    /**
     * Update the interact button icon based on context
     * @param {string} newIcon - Emoji icon to display (👆, 🏪, 🌸, 💬, etc.)
     */
    updateInteractIcon(newIcon) {
        if (!this.isVisible || !this.actionButtons.interact || !this.actionButtons.interact.icon) {
            return;
        }

        const icon = this.actionButtons.interact.icon;
        icon.setText(newIcon);
        console.log('[MobileControls] Interact icon updated to:', newIcon);
    }

    /**
     * Update method (called each frame if needed)
     */
    update() {
        // Currently no per-frame updates needed
        // Joystick handles movement via events
    }

    /**
     * Clean up mobile controls
     */
    destroy() {
        console.log('[MobileControls] Destroying mobile controls');
        this.hide();
    }
}

// Export for use in game
if (typeof window !== 'undefined') {
    window.MobileControls = MobileControls;
}

export default MobileControls;
