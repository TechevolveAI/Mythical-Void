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

        // Destroy button container
        if (this.buttonContainer) {
            this.buttonContainer.destroy();
            this.buttonContainer = null;
        }

        // Destroy buttons
        Object.values(this.actionButtons).forEach(button => {
            if (button.bg) button.bg.destroy();
            if (button.icon) button.icon.destroy();
            if (button.zone) button.zone.destroy();
            if (button.glow) button.glow.destroy();
        });

        this.actionButtons = {};
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
     * Optimized 2x2 grid layout:
     *   [Chat]     [Inventory]   <- Top row
     *   [Action]   [Attack]      <- Bottom row
     */
    createActionButtons() {
        const { width, height } = this.scene.scale;

        // Layout constants - optimized for mobile touch
        const buttonSize = 56; // Uniform size for consistency
        const primarySize = 62; // Slightly larger for primary actions
        const spacing = 12; // Gap between buttons
        const marginRight = 20; // Distance from right edge
        const marginBottom = 28; // Distance from bottom edge

        // Calculate grid positions
        // Right column X (primary actions - Attack, Inventory)
        const rightColX = width - marginRight - buttonSize / 2;
        // Left column X (secondary actions - Chat, Action)
        const leftColX = rightColX - buttonSize - spacing;

        // Bottom row Y (Attack, Action)
        const bottomRowY = height - marginBottom - primarySize / 2;
        // Top row Y (Inventory, Chat)
        const topRowY = bottomRowY - primarySize - spacing;

        // Button configurations in optimal game design order:
        // Top-Left: Chat (social/secondary)
        // Top-Right: Inventory/Skill Bag (utility)
        // Bottom-Left: Action/Interact (context-sensitive)
        // Bottom-Right: Attack (primary combat)
        const buttons = [
            {
                id: 'chat',
                label: '💬',
                x: leftColX,
                y: topRowY,
                size: buttonSize,
                color: 0x9B59B6, // Purple - social
                glowColor: 0xBB8FCE,
                action: () => this.handleButtonPress('chat'),
                priority: 'secondary'
            },
            {
                id: 'inventory',
                label: '🎒',
                x: rightColX,
                y: topRowY,
                size: buttonSize,
                color: 0x3498DB, // Blue - utility
                glowColor: 0x5DADE2,
                action: () => this.handleButtonPress('inventory'),
                priority: 'secondary'
            },
            {
                id: 'interact',
                label: '✋',
                x: leftColX,
                y: bottomRowY,
                size: primarySize,
                color: 0x27AE60, // Green - action
                glowColor: 0x58D68D,
                action: () => this.handleButtonPress('interact'),
                priority: 'primary'
            },
            {
                id: 'attack',
                label: '⚔️',
                x: rightColX,
                y: bottomRowY,
                size: primarySize,
                color: 0xE74C3C, // Red - combat
                glowColor: 0xEC7063,
                action: () => this.handleButtonPress('attack'),
                priority: 'primary'
            }
        ];

        // Create button container background for visual grouping
        this.createButtonContainer(leftColX, topRowY, rightColX, bottomRowY, buttonSize, primarySize, spacing);

        buttons.forEach(config => {
            this.createActionButton(config);
        });

        console.log('[MobileControls] Created', buttons.length, 'action buttons in optimized 2x2 grid');
    }

    /**
     * Create semi-transparent container for button group
     */
    createButtonContainer(leftX, topY, rightX, bottomY, smallSize, bigSize, spacing) {
        const padding = 10;
        const containerWidth = (rightX - leftX) + bigSize + padding * 2;
        const containerHeight = (bottomY - topY) + bigSize + padding * 2;
        const containerX = leftX - smallSize / 2 - padding;
        const containerY = topY - smallSize / 2 - padding;

        this.buttonContainer = this.scene.add.graphics();
        this.buttonContainer.setScrollFactor(0);
        this.buttonContainer.setDepth(9999);

        // Subtle dark background with rounded corners
        this.buttonContainer.fillStyle(0x0D0D1A, 0.4);
        this.buttonContainer.fillRoundedRect(containerX, containerY, containerWidth, containerHeight, 16);

        // Subtle border
        this.buttonContainer.lineStyle(1, 0xFFFFFF, 0.15);
        this.buttonContainer.strokeRoundedRect(containerX, containerY, containerWidth, containerHeight, 16);
    }

    /**
     * Create a single action button with modern glass-morphism design
     */
    createActionButton(config) {
        const { id, label, x, y, size, color, glowColor, action, priority } = config;
        const radius = size / 2;

        // Create outer glow ring for primary buttons
        let glow = null;
        if (priority === 'primary') {
            glow = this.scene.add.graphics();
            glow.setScrollFactor(0);
            glow.setDepth(9999);
            glow.lineStyle(3, glowColor || color, 0.3);
            glow.strokeCircle(x, y, radius + 4);
        }

        // Create background circle with gradient effect
        const bg = this.scene.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);

        // Draw button with layered effect
        this.drawButton(bg, x, y, radius, color, false);

        // Create icon/label with shadow for depth
        const icon = this.scene.add.text(x, y, label, {
            fontSize: `${size * 0.45}px`,
            color: '#FFFFFF',
            fontStyle: 'bold',
            shadow: {
                offsetX: 1,
                offsetY: 1,
                color: 'rgba(0,0,0,0.5)',
                blur: 2,
                fill: true
            }
        });
        icon.setOrigin(0.5);
        icon.setScrollFactor(0);
        icon.setDepth(10001);

        // Create larger interactive zone for easier touch
        const touchPadding = 8;
        const zone = this.scene.add.zone(x, y, size + touchPadding, size + touchPadding)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive();

        // Handle touch events with enhanced feedback
        zone.on('pointerdown', () => {
            // Visual feedback - pressed state
            this.drawButton(bg, x, y, radius, color, true);

            // Scale down animation
            this.scene.tweens.add({
                targets: icon,
                scaleX: 0.85,
                scaleY: 0.85,
                duration: 60,
                ease: 'Power2'
            });

            // Pulse glow on primary buttons
            if (glow) {
                this.scene.tweens.add({
                    targets: glow,
                    alpha: 0.8,
                    duration: 100
                });
            }

            // Play haptic/sound feedback
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            // Execute action
            action();
        });

        zone.on('pointerup', () => {
            // Reset visual
            this.drawButton(bg, x, y, radius, color, false);

            // Scale back animation
            this.scene.tweens.add({
                targets: icon,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Back.easeOut'
            });

            // Reset glow
            if (glow) {
                this.scene.tweens.add({
                    targets: glow,
                    alpha: 1,
                    duration: 150
                });
            }
        });

        zone.on('pointerout', () => {
            // Reset if finger leaves button
            this.drawButton(bg, x, y, radius, color, false);

            this.scene.tweens.add({
                targets: icon,
                scaleX: 1,
                scaleY: 1,
                duration: 80
            });

            if (glow) {
                glow.setAlpha(1);
            }
        });

        // Store button references
        this.actionButtons[id] = { bg, icon, zone, glow, x, y, radius, color };
    }

    /**
     * Draw a button with modern styling
     */
    drawButton(graphics, x, y, radius, color, pressed) {
        graphics.clear();

        if (pressed) {
            // Pressed state - darker, slightly smaller
            graphics.fillStyle(this.darkenColor(color, 0.3), 0.95);
            graphics.fillCircle(x, y, radius - 2);
            graphics.lineStyle(2, 0xFFFFFF, 0.6);
            graphics.strokeCircle(x, y, radius - 2);
        } else {
            // Normal state - gradient-like effect with inner highlight
            // Outer darker ring
            graphics.fillStyle(this.darkenColor(color, 0.2), 0.9);
            graphics.fillCircle(x, y, radius);

            // Inner lighter fill
            graphics.fillStyle(color, 0.85);
            graphics.fillCircle(x, y, radius - 3);

            // Top highlight arc for 3D effect
            graphics.lineStyle(2, 0xFFFFFF, 0.4);
            graphics.beginPath();
            graphics.arc(x, y, radius - 4, Math.PI * 1.2, Math.PI * 1.8);
            graphics.strokePath();

            // Outer border
            graphics.lineStyle(2, 0xFFFFFF, 0.5);
            graphics.strokeCircle(x, y, radius);
        }
    }

    /**
     * Darken a color by a factor
     */
    darkenColor(color, factor) {
        const r = Math.floor(((color >> 16) & 0xFF) * (1 - factor));
        const g = Math.floor(((color >> 8) & 0xFF) * (1 - factor));
        const b = Math.floor((color & 0xFF) * (1 - factor));
        return (r << 16) | (g << 8) | b;
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

            case 'chat':
                // Open chat overlay
                if (this.scene.openChat) {
                    this.scene.openChat();
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
