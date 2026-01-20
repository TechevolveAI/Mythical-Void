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
     * AGGRESSIVE detection: shows controls on ANY touch-capable device
     * Better to show controls unnecessarily than to not show them when needed
     */
    detectMobile() {
        // Check multiple touch indicators
        const hasOnTouchStart = 'ontouchstart' in window;
        const hasTouchPoints = navigator.maxTouchPoints > 0;
        const hasDocumentTouch = 'ontouchstart' in document.documentElement;
        const hasTouchEvent = 'TouchEvent' in window;

        // Check user agent for mobile platforms
        const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i.test(userAgent);

        // Check for tablet-specific indicators
        const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);

        // Check screen characteristics (but don't require small screen)
        const isSmallScreen = window.innerWidth <= 1366 || window.innerHeight <= 1024;
        const isPortrait = window.innerHeight > window.innerWidth;

        // Check for touch-primary input
        const isTouchPrimary = window.matchMedia?.('(pointer: coarse)')?.matches;
        const isHoverNone = window.matchMedia?.('(hover: none)')?.matches;

        // AGGRESSIVE: Show controls if ANY touch indicator is true
        const isTouchDevice = hasOnTouchStart || hasTouchPoints || hasDocumentTouch || hasTouchEvent;

        // Show controls if:
        // 1. Device has touch capability AND (small screen OR touch is primary input)
        // 2. OR mobile/tablet user agent detected
        // 3. OR pointer is coarse (touch) AND no hover (mobile)
        const result = (isTouchDevice && (isSmallScreen || isTouchPrimary)) ||
                       isMobileUA ||
                       isTablet ||
                       (isTouchPrimary && isHoverNone);

        console.log('[MobileControls] detectMobile - AGGRESSIVE CHECK:', {
            hasOnTouchStart,
            hasTouchPoints,
            hasDocumentTouch,
            hasTouchEvent,
            isMobileUA,
            isTablet,
            isSmallScreen,
            isTouchPrimary,
            isHoverNone,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: userAgent.substring(0, 100),
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
     * Get safe area insets for devices with notches, home indicators, etc.
     * Uses CSS environment variables when available
     */
    getSafeAreaInsets() {
        const computedStyle = getComputedStyle(document.documentElement);

        // Try to get CSS env() values for safe areas
        const safeTop = parseInt(computedStyle.getPropertyValue('--sat') || '0') ||
                       parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0') || 0;
        const safeBottom = parseInt(computedStyle.getPropertyValue('--sab') || '0') ||
                          parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0') || 0;
        const safeLeft = parseInt(computedStyle.getPropertyValue('--sal') || '0') ||
                        parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0') || 0;
        const safeRight = parseInt(computedStyle.getPropertyValue('--sar') || '0') ||
                         parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0') || 0;

        // Fallback: detect if likely an iPhone with notch/dynamic island
        const isIPhoneWithNotch = /iPhone/.test(navigator.userAgent) &&
                                  window.screen.height >= 812 &&
                                  window.devicePixelRatio >= 2;

        // Apply minimum safe areas for known devices
        return {
            top: Math.max(safeTop, isIPhoneWithNotch ? 44 : 0),
            bottom: Math.max(safeBottom, isIPhoneWithNotch ? 34 : 20), // Always add some bottom padding
            left: Math.max(safeLeft, 0),
            right: Math.max(safeRight, 0)
        };
    }

    /**
     * Get layout configuration with all scaled values
     * Edge-anchored positioning with proportional scaling and safe area support
     */
    getLayoutConfig() {
        const scale = this.getScaleFactor();
        const safeArea = this.getSafeAreaInsets();

        return {
            // Joystick sizes
            joystickBaseRadius: Math.round(60 * scale),
            joystickThumbRadius: Math.round(30 * scale),
            joystickGlowRadius: Math.round(68 * scale),
            joystickMaxDistance: Math.round(50 * scale),
            // Button sizes
            buttonSize: Math.round(56 * scale),
            primaryButtonSize: Math.round(62 * scale),
            // Margins and spacing (include safe area)
            margin: Math.round(20 * scale),
            spacing: Math.round(14 * scale),
            // Safe area insets
            safeBottom: safeArea.bottom,
            safeLeft: safeArea.left,
            safeRight: safeArea.right,
            // Minimum margins for touch safety
            minEdgeMargin: 16
        };
    }

    /**
     * Setup fallback touch listener that will show controls on first touch
     * This catches cases where initial detection failed
     */
    setupFallbackTouchListener() {
        if (this.fallbackTouchListenerSetup) return;
        this.fallbackTouchListenerSetup = true;

        const showOnTouch = (e) => {
            console.log('[MobileControls] FALLBACK: Touch detected, forcing controls visible');
            // Remove this listener after first touch
            document.removeEventListener('touchstart', showOnTouch, { passive: true });
            window.removeEventListener('touchstart', showOnTouch, { passive: true });

            // Force show controls
            if (!this.isVisible) {
                this.isMobile = true;
                this.show(true);
            }
        };

        // Add to both document and window for maximum coverage
        document.addEventListener('touchstart', showOnTouch, { passive: true, once: true });
        window.addEventListener('touchstart', showOnTouch, { passive: true, once: true });

        console.log('[MobileControls] Fallback touch listener installed');
    }

    /**
     * Create and show mobile controls
     * @param {boolean} force - Force show even on non-mobile devices (for testing)
     */
    show(force = false) {
        // Re-check mobile detection each time show is called
        this.isMobile = this.detectMobile();

        // If not detected as mobile, setup fallback listener for first touch
        if (!this.isMobile && !force) {
            console.log('[MobileControls] Not detected as mobile initially. Installing fallback touch listener.');
            this.setupFallbackTouchListener();
            return;
        }

        // ALWAYS clean up existing event handlers first to prevent duplicates
        // This is critical when show() is called multiple times (e.g., after creature switch)
        this.cleanupEventHandlers();

        if (this.isVisible) {
            console.log('[MobileControls] Already visible, refreshing handlers');
            // Even if visible, we've cleaned up handlers, so recreate joystick handlers
            this.createVirtualJoystick();
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
     * Clean up all event handlers (can be called independently)
     * This ensures handlers are removed even if isVisible is out of sync
     */
    cleanupEventHandlers() {
        // Clean up scene-level event listeners
        if (this.scenePointerMoveHandler && this.scene?.input) {
            this.scene.input.off('pointermove', this.scenePointerMoveHandler);
            this.scenePointerMoveHandler = null;
        }
        if (this.scenePointerUpHandler && this.scene?.input) {
            this.scene.input.off('pointerup', this.scenePointerUpHandler);
            this.scenePointerUpHandler = null;
        }
        // Clean up native touch listeners
        if (this.sceneTouchCancelHandler && this.scene?.game?.canvas) {
            this.scene.game.canvas.removeEventListener('touchend', this.sceneTouchCancelHandler);
            this.scene.game.canvas.removeEventListener('touchcancel', this.sceneTouchCancelHandler);
            this.sceneTouchCancelHandler = null;
        }

        // Reset joystick state
        this.joystickActive = false;
        this.activePointerId = null;
    }

    /**
     * Hide mobile controls
     */
    hide() {
        // ALWAYS clean up event handlers first (even if not visible)
        // This prevents orphaned handlers when state gets out of sync
        this.cleanupEventHandlers();

        if (!this.isVisible) return;

        // Clean up resize handler
        if (this.resizeHandler) {
            this.scene.scale.off('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

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
        const { height } = this.scene.scale;
        const config = this.getLayoutConfig();

        // Edge-anchored positioning: bottom-left corner with safe area
        // Use minimal left margin for edge-hugging placement
        const leftMargin = config.safeLeft + 8; // Minimal margin, just safe area + tiny buffer
        const bottomMargin = Math.max(config.margin, config.minEdgeMargin) + config.safeBottom;

        const joystickX = leftMargin + config.joystickBaseRadius;
        const joystickY = height - bottomMargin - config.joystickBaseRadius;

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

        // Create invisible zone for touch handling (MUCH larger than visual for reliable tracking)
        const zoneSize = config.joystickBaseRadius * 5; // Touch zone 5x the base radius for smooth dragging
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

        // Handle touch cancel (when browser cancels touch, e.g., palm rejection)
        this.sceneTouchCancelHandler = () => {
            if (this.joystickActive) {
                this.resetJoystick();
            }
        };

        // Use native touchend/touchcancel for more reliable detection on mobile
        if (this.scene.game.canvas) {
            this.scene.game.canvas.addEventListener('touchend', this.sceneTouchCancelHandler, { passive: true });
            this.scene.game.canvas.addEventListener('touchcancel', this.sceneTouchCancelHandler, { passive: true });
        }

        // NOTE: Removed pointerout handler - it was causing false resets on mobile
        // when finger moved between interactive elements

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

        // Layout constants - scaled for screen size with safe area
        const buttonSize = config.buttonSize;
        const primarySize = config.primaryButtonSize;
        const spacing = config.spacing;
        const marginRight = Math.max(config.margin, config.minEdgeMargin) + config.safeRight;
        const marginBottom = Math.max(config.margin, config.minEdgeMargin) + config.safeBottom;

        // Edge-anchored positioning: bottom-right corner with safe area
        // Right column X (primary actions - Attack, Inventory)
        const rightColX = width - marginRight - primarySize / 2;
        // Left column X (secondary actions - Chat, Action)
        const leftColX = rightColX - primarySize - spacing;

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
        // CRITICAL: Zone needs high depth to stay above all game elements (campfire glow, etc.)
        const touchPadding = 8;
        const zone = this.scene.add.zone(x, y, size + touchPadding, size + touchPadding)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });

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
     * Refresh mobile controls - resets joystick and ensures handlers are properly attached
     * Call this when game state changes (e.g., creature switching) to ensure responsiveness
     */
    refresh() {
        if (!this.isVisible) return;

        console.log('[MobileControls] Refreshing controls');

        // Reset joystick to center
        this.resetJoystick();

        // Clean up and recreate handlers to ensure they're properly attached
        this.cleanupEventHandlers();

        // Recreate the joystick with fresh handlers
        // First destroy the old visual elements
        if (this.joystickGlow) this.joystickGlow.destroy();
        if (this.joystickBase) this.joystickBase.destroy();
        if (this.joystickThumb) this.joystickThumb.destroy();
        if (this.joystickZone) this.joystickZone.destroy();

        // Recreate the joystick
        this.createVirtualJoystick();

        console.log('[MobileControls] Refresh complete - joystick reset and handlers recreated');
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
