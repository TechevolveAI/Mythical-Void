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
        this.joystickGlow = null; // Glow ring shown when active
        this.joystickZone = null;
        this.joystickActive = false;
        this.joystickStartX = 0;
        this.joystickStartY = 0;
        this.joystickMaxDistance = 50;
        this.deadZone = 0.15; // 15% dead zone - movements within this range return 0
        this.activePointerId = null; // Track which pointer activated joystick

        // Scene-level event handlers (stored for cleanup)
        this.scenePointerUpHandler = null;
        this.scenePointerOutHandler = null;

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
     * More inclusive: shows controls on any touch device OR small screen
     * This ensures tablet users and mobile emulation work correctly
     */
    detectMobile() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 1024; // Increased threshold for tablets
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Show mobile controls if: touch device with small-ish screen, OR mobile user agent
        const result = (isTouchDevice && isSmallScreen) || isMobileUserAgent;

        console.log('[MobileControls] detectMobile:', {
            isTouchDevice,
            isSmallScreen,
            isMobileUserAgent,
            screenWidth: window.innerWidth,
            result
        });

        return result;
    }

    /**
     * Calculate scale factor based on screen width
     * Base size designed for 768px width, scales down proportionally
     */
    getScaleFactor() {
        const width = Math.min(this.scene.scale.width, 768);
        return Math.max(0.7, width / 768); // Min 70% scale
    }

    /**
     * Get layout configuration with all scaled values
     * Edge-anchored positioning with proportional scaling
     */
    getLayoutConfig() {
        const scale = this.getScaleFactor();
        return {
            // Joystick sizes
            joystickBaseRadius: Math.round(60 * scale),
            joystickThumbRadius: Math.round(30 * scale),
            joystickGlowRadius: Math.round(68 * scale),
            joystickMaxDistance: Math.round(50 * scale),
            // Button sizes
            buttonSize: Math.round(56 * scale),
            primaryButtonSize: Math.round(62 * scale),
            // Margins and spacing
            margin: Math.round(16 * scale),
            spacing: Math.round(12 * scale),
            // Minimum margins for touch safety
            minEdgeMargin: 12
        };
    }

    /**
     * Create and show mobile controls
     * @param {boolean} force - Force show even on non-mobile devices (for testing)
     */
    show(force = false) {
        // Re-check mobile detection each time show is called
        this.isMobile = this.detectMobile();

        if (!this.isMobile && !force) {
            console.log('[MobileControls] Not showing - device not detected as mobile. Use show(true) to force.');
            return;
        }

        if (this.isVisible) {
            console.log('[MobileControls] Already visible');
            return;
        }

        console.log('[MobileControls] Creating mobile UI', {
            isMobile: this.isMobile,
            forced: force,
            screenWidth: this.scene.scale.width,
            screenHeight: this.scene.scale.height
        });

        // Create virtual joystick (left side)
        this.createVirtualJoystick();

        // Create action buttons (right side)
        this.createActionButtons();

        // Set up resize handler for screen rotation/resize
        this.resizeHandler = () => this.handleResize();
        this.scene.scale.on('resize', this.resizeHandler);

        this.isVisible = true;
        console.log('[MobileControls] Mobile controls visible at positions:', {
            joystick: { x: this.joystickCenterX, y: this.joystickCenterY },
            buttonCount: Object.keys(this.actionButtons).length
        });
    }

    /**
     * Handle screen resize (rotation, window resize, etc.)
     * Recreates controls at new scaled positions
     */
    handleResize() {
        if (!this.isVisible) return;

        // Check if still mobile after resize
        this.isMobile = this.detectMobile();
        if (!this.isMobile) {
            this.hide();
            return;
        }

        console.log('[MobileControls] Resizing controls for new screen dimensions');

        // Recreate controls with new scaled positions
        // Store visibility state, hide, then show again
        this.hide();
        this.isVisible = false; // Reset to allow show()
        this.show();
    }

    /**
     * Hide mobile controls
     */
    hide() {
        if (!this.isVisible) return;

        // Clean up resize handler
        if (this.resizeHandler) {
            this.scene.scale.off('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        // Clean up scene-level event listeners FIRST (prevents memory leaks)
        if (this.scenePointerMoveHandler) {
            this.scene.input.off('pointermove', this.scenePointerMoveHandler);
            this.scenePointerMoveHandler = null;
        }
        if (this.scenePointerUpHandler) {
            this.scene.input.off('pointerup', this.scenePointerUpHandler);
            this.scenePointerUpHandler = null;
        }
        if (this.scenePointerOutHandler) {
            this.scene.input.off('pointerout', this.scenePointerOutHandler);
            this.scenePointerOutHandler = null;
        }

        // Reset joystick state
        this.joystickActive = false;
        this.activePointerId = null;

        // Destroy joystick
        if (this.joystickGlow) this.joystickGlow.destroy();
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
        const config = this.getLayoutConfig();

        // Edge-anchored positioning: bottom-left corner
        const joystickX = Math.max(config.margin + config.joystickBaseRadius, config.minEdgeMargin + config.joystickBaseRadius);
        const joystickY = height - Math.max(config.margin + config.joystickBaseRadius, config.minEdgeMargin + config.joystickBaseRadius);

        // Store scaled max distance for movement calculations
        this.joystickMaxDistance = config.joystickMaxDistance;

        // Create glow ring (initially invisible, shown when active)
        this.joystickGlow = this.scene.add.graphics();
        this.joystickGlow.setScrollFactor(0);
        this.joystickGlow.setDepth(9999); // Behind base
        this.joystickGlow.lineStyle(6, 0x00CED1, 0.6);
        this.joystickGlow.strokeCircle(joystickX, joystickY, config.joystickGlowRadius);
        this.joystickGlow.setAlpha(0); // Start invisible

        // Create base circle
        this.joystickBase = this.scene.add.graphics();
        this.joystickBase.setScrollFactor(0);
        this.joystickBase.setDepth(10000);
        this.joystickBase.fillStyle(0x000000, 0.3);
        this.joystickBase.fillCircle(joystickX, joystickY, config.joystickBaseRadius);
        this.joystickBase.lineStyle(3, 0xFFFFFF, 0.5);
        this.joystickBase.strokeCircle(joystickX, joystickY, config.joystickBaseRadius);

        // Create thumb (moveable part)
        this.joystickThumb = this.scene.add.graphics();
        this.joystickThumb.setScrollFactor(0);
        this.joystickThumb.setDepth(10001);
        this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
        this.joystickThumb.fillCircle(joystickX, joystickY, config.joystickThumbRadius);
        this.joystickThumb.lineStyle(2, 0x00CED1, 1);
        this.joystickThumb.strokeCircle(joystickX, joystickY, config.joystickThumbRadius);

        // Store thumb radius for movement updates
        this.joystickThumbRadius = config.joystickThumbRadius;

        // Create invisible zone for touch handling (larger than visual)
        const zoneSize = config.joystickBaseRadius * 3; // Touch zone 3x the base radius
        this.joystickZone = this.scene.add.zone(joystickX, joystickY, zoneSize, zoneSize)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive({ draggable: true });

        // Store center position
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;

        // Handle touch/drag events
        this.joystickZone.on('pointerdown', (pointer) => {
            this.joystickActive = true;
            this.activePointerId = pointer.id; // Track which pointer activated joystick
            this.joystickStartX = pointer.x;
            this.joystickStartY = pointer.y;

            // Add subtle pulse effect to base
            this.scene.tweens.add({
                targets: this.joystickBase,
                alpha: 0.5,
                duration: 100,
                yoyo: true
            });

            // Show glow ring with fade-in animation
            if (this.joystickGlow) {
                this.scene.tweens.add({
                    targets: this.joystickGlow,
                    alpha: 1,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            // Trigger haptic feedback if available
            if (window.FeedbackManager) {
                window.FeedbackManager.vibrate('tap');
            }
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
            this.joystickThumb.fillCircle(thumbX, thumbY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 1);
            this.joystickThumb.strokeCircle(thumbX, thumbY, this.joystickThumbRadius);

            // Calculate dead zone in pixels (percentage-based for consistency)
            const deadZonePixels = this.joystickMaxDistance * this.deadZone;

            // Calculate normalized direction (-1 to 1) with dead zone
            let normalizedX = 0;
            let normalizedY = 0;

            if (distance > deadZonePixels) {
                // Remap the remaining range (deadZone to max) to (0 to 1)
                // This gives smooth 0-1 output after passing the dead zone
                const effectiveDistance = clampedDistance - deadZonePixels;
                const effectiveMax = this.joystickMaxDistance - deadZonePixels;
                const magnitude = effectiveDistance / effectiveMax;

                normalizedX = Math.cos(angle) * magnitude;
                normalizedY = Math.sin(angle) * magnitude;
            }

            // Emit virtual joystick event
            this.scene.game.events.emit('virtual-joystick', {
                x: normalizedX,
                y: normalizedY
            });
        });

        // Zone-level pointerup (fires when released within zone)
        this.joystickZone.on('pointerup', (pointer) => {
            if (pointer.id === this.activePointerId) {
                this.resetJoystick();
            }
        });

        // CRITICAL: Scene-level pointermove handler for joystick tracking
        // This allows the joystick to track finger movement even when the finger
        // moves outside the joystick zone (which is common during fast movements)
        this.scenePointerMoveHandler = (pointer) => {
            if (!this.joystickActive || pointer.id !== this.activePointerId) return;

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
            this.joystickThumb.fillCircle(thumbX, thumbY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 1);
            this.joystickThumb.strokeCircle(thumbX, thumbY, this.joystickThumbRadius);

            // Calculate dead zone in pixels (percentage-based for consistency)
            const deadZonePixels = this.joystickMaxDistance * this.deadZone;

            // Calculate normalized direction (-1 to 1) with dead zone
            let normalizedX = 0;
            let normalizedY = 0;

            if (distance > deadZonePixels) {
                // Remap the remaining range (deadZone to max) to (0 to 1)
                const effectiveDistance = clampedDistance - deadZonePixels;
                const effectiveMax = this.joystickMaxDistance - deadZonePixels;
                const magnitude = effectiveDistance / effectiveMax;

                normalizedX = Math.cos(angle) * magnitude;
                normalizedY = Math.sin(angle) * magnitude;
            }

            // Emit virtual joystick event
            this.scene.game.events.emit('virtual-joystick', {
                x: normalizedX,
                y: normalizedY
            });
        };
        this.scene.input.on('pointermove', this.scenePointerMoveHandler);

        // CRITICAL: Scene-level listeners catch pointer releases ANYWHERE on screen
        // This fixes the "sticky joystick" bug where releasing outside the zone
        // would leave the joystick active and the character moving forever
        this.scenePointerUpHandler = (pointer) => {
            if (this.joystickActive && pointer.id === this.activePointerId) {
                this.resetJoystick();
            }
        };
        this.scene.input.on('pointerup', this.scenePointerUpHandler);

        // Also handle pointer leaving the game canvas entirely
        this.scenePointerOutHandler = (pointer) => {
            if (this.joystickActive && pointer.id === this.activePointerId) {
                this.resetJoystick();
            }
        };
        this.scene.input.on('pointerout', this.scenePointerOutHandler);

        console.log('[MobileControls] Virtual joystick created at', joystickX, joystickY);
    }

    /**
     * Reset joystick to center position immediately
     * Called when pointer is released (anywhere on screen or outside canvas)
     */
    resetJoystick() {
        if (!this.joystickActive) return;

        this.joystickActive = false;
        this.activePointerId = null;

        // Immediately snap thumb back to center (no tween for responsiveness)
        if (this.joystickThumb) {
            this.joystickThumb.clear();
            this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
            this.joystickThumb.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 1);
            this.joystickThumb.strokeCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
        }

        // Hide glow ring with fade-out animation
        if (this.joystickGlow) {
            this.scene.tweens.add({
                targets: this.joystickGlow,
                alpha: 0,
                duration: 200,
                ease: 'Power2'
            });
        }

        // Emit zero movement immediately
        this.scene.game.events.emit('virtual-joystick', { x: 0, y: 0 });
    }

    /**
     * Create action buttons for combat, interact, inventory, etc.
     * Optimized 2x2 grid layout:
     *   [Chat]     [Inventory]   <- Top row
     *   [Action]   [Attack]      <- Bottom row
     */
    createActionButtons() {
        const { width, height } = this.scene.scale;
        const config = this.getLayoutConfig();

        // Layout constants - scaled for screen size
        const buttonSize = config.buttonSize;
        const primarySize = config.primaryButtonSize;
        const spacing = config.spacing;
        const marginRight = Math.max(config.margin, config.minEdgeMargin);
        const marginBottom = Math.max(config.margin + 12, config.minEdgeMargin + 12);

        // Edge-anchored positioning: bottom-right corner
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
        console.log('[MobileControls] Button pressed:', buttonId, 'Scene:', this.scene?.scene?.key);

        // Play sound feedback
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Emit appropriate event based on button
        switch (buttonId) {
            case 'attack':
                // Trigger combat projectile
                if (typeof this.scene.fireCombatProjectile === 'function') {
                    console.log('[MobileControls] Firing combat projectile');
                    this.scene.fireCombatProjectile();
                } else {
                    console.warn('[MobileControls] fireCombatProjectile not found on scene');
                    // Try emitting as virtual key as fallback
                    this.scene.game?.events?.emit('virtual-key', { key: 'attack', type: 'down' });
                }
                break;

            case 'interact':
                // Trigger space interaction (shop, flowers, etc.)
                console.log('[MobileControls] Triggering space interaction');
                if (typeof this.scene.handleSpaceInteraction === 'function') {
                    this.scene.handleSpaceInteraction();
                } else {
                    this.scene.game?.events?.emit('virtual-key', {
                        key: 'space',
                        type: 'down'
                    });
                }
                break;

            case 'inventory':
                // Open inventory
                console.log('[MobileControls] Opening inventory');
                if (typeof this.scene.openInventory === 'function') {
                    this.scene.openInventory();
                } else {
                    console.warn('[MobileControls] openInventory not found on scene');
                }
                break;

            case 'chat':
                // Open chat overlay
                console.log('[MobileControls] Opening chat');
                if (typeof this.scene.openChat === 'function') {
                    this.scene.openChat();
                } else {
                    console.warn('[MobileControls] openChat not found on scene');
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
