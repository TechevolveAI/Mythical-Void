/**
 * MobileControls - Professional mobile control system with virtual joystick and action buttons
 * Provides touch-based controls for mobile devices while maintaining desktop keyboard controls
 */

import { devLog } from '../utils/devLogger.js';
import {
    getMobileControlLayout,
    getJoystickVector,
    getSafeAreaInsets
} from './MobileControlLayout.js';

class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.isMobile = this.detectMobile();
        this.isVisible = false;
        this.isSuspended = false;
        this.dockBackground = null;

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
        this.joystickActivatedAt = 0;
        this.lastJoystickMagnitude = 0;
        this.minimumFlickDuration = 140;
        this.pendingJoystickReset = null;
        this.inputAbortHandler = null;
        this.visibilityChangeHandler = null;

        // Scene-level event handlers (stored for cleanup)
        this.scenePointerUpHandler = null;
        this.scenePointerOutHandler = null;
        this.windowPointerUpHandler = null;
        this.windowPointerCancelHandler = null;
        this.canvasTouchEndHandler = null;

        // Action buttons
        this.actionButtons = {};

        // Button state tracking
        this.buttonStates = {
            attack: false,
            interact: false,
            inventory: false,
            care: false
        };

        devLog('[MobileControls] Initialized, isMobile:', this.isMobile);
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

        devLog('[MobileControls] detectMobile - AGGRESSIVE CHECK:', {
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
        return getSafeAreaInsets();
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
            devLog('[MobileControls] FALLBACK: Touch detected, forcing controls visible');
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

        devLog('[MobileControls] Fallback touch listener installed');
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
            devLog('[MobileControls] Not detected as mobile initially. Installing fallback touch listener.');
            this.setupFallbackTouchListener();
            return;
        }

        // ALWAYS clean up existing event handlers first to prevent duplicates
        // This is critical when show() is called multiple times (e.g., after creature switch)
        this.cleanupEventHandlers();

        if (this.isVisible) {
            devLog('[MobileControls] Already visible, refreshing handlers');
            // Even if visible, we've cleaned up handlers, so recreate joystick handlers
            this.createVirtualJoystick();
            return;
        }

        devLog('[MobileControls] Creating mobile UI', {
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
        devLog('[MobileControls] Mobile controls visible at positions:', {
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

        devLog('[MobileControls] Resizing controls for new screen dimensions');

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
        this.resetJoystick(true);
        const canvas = this.scene?.game?.canvas;
        if (this.canvasPointerDownHandler && canvas) {
            canvas.removeEventListener(
                'pointerdown',
                this.canvasPointerDownHandler,
                true
            );
            canvas.removeEventListener(
                'pointermove',
                this.canvasPointerMoveHandler,
                true
            );
            canvas.removeEventListener(
                'pointerup',
                this.canvasPointerUpHandler,
                true
            );
            canvas.removeEventListener(
                'pointercancel',
                this.canvasPointerCancelHandler,
                true
            );
            canvas.removeEventListener(
                'lostpointercapture',
                this.canvasLostPointerCaptureHandler,
                true
            );
            canvas.removeEventListener(
                'touchend',
                this.canvasTouchEndHandler,
                true
            );
            this.canvasPointerDownHandler = null;
            this.canvasPointerMoveHandler = null;
            this.canvasPointerUpHandler = null;
            this.canvasPointerCancelHandler = null;
            this.canvasLostPointerCaptureHandler = null;
            this.canvasTouchEndHandler = null;
        }
        if (this.inputAbortHandler) {
            window.removeEventListener('blur', this.inputAbortHandler);
            window.removeEventListener('pagehide', this.inputAbortHandler);
            this.inputAbortHandler = null;
        }
        if (this.visibilityChangeHandler) {
            document.removeEventListener(
                'visibilitychange',
                this.visibilityChangeHandler
            );
            this.visibilityChangeHandler = null;
        }
        if (this.windowPointerUpHandler) {
            window.removeEventListener('pointerup', this.windowPointerUpHandler, true);
            this.windowPointerUpHandler = null;
        }
        if (this.windowPointerCancelHandler) {
            window.removeEventListener('pointercancel', this.windowPointerCancelHandler, true);
            this.windowPointerCancelHandler = null;
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
        if (this.dockBackground) {
            this.dockBackground.destroy();
            this.dockBackground = null;
        }

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
        this.isSuspended = false;
        devLog('[MobileControls] Mobile controls hidden');
    }

    getControlElements() {
        const elements = [
            this.dockBackground,
            this.joystickGlow,
            this.joystickBase,
            this.joystickThumb,
            this.joystickZone,
            this.buttonContainer
        ];
        Object.values(this.actionButtons).forEach(button => {
            elements.push(button.bg, button.icon, button.zone, button.glow);
        });
        return elements.filter(Boolean);
    }

    suspend() {
        if (!this.isVisible || this.isSuspended) return false;
        this.resetJoystick();
        this.getControlElements().forEach(element => {
            element.setVisible?.(false);
            if (element.input) element.input.enabled = false;
        });
        this.isSuspended = true;
        return true;
    }

    resume() {
        if (!this.isVisible || !this.isSuspended) return;
        this.getControlElements().forEach(element => {
            element.setVisible?.(true);
            if (element.input) element.input.enabled = true;
        });
        this.joystickGlow?.setVisible(false);
        this.isSuspended = false;
    }

    /**
     * Create virtual joystick for movement
     */
    createVirtualJoystick() {
        const { width, height } = this.scene.scale;
        const layout = getMobileControlLayout({
            width,
            height,
            safeArea: this.getSafeAreaInsets()
        });
        const joystickX = layout.joystick.x;
        const joystickY = layout.joystick.y;
        const joystickBaseRadius = layout.joystick.radius;
        const joystickGlowRadius = joystickBaseRadius + 6;
        const joystickThumbRadius = layout.joystick.thumbRadius;

        // Store scaled max distance for movement calculations
        this.joystickMaxDistance = layout.joystick.maxDistance;

        if (!this.dockBackground) {
            this.dockBackground = this.scene.add.graphics();
            this.dockBackground.setScrollFactor(0).setDepth(9998);
            this.dockBackground.fillStyle(0x080A17, 0.9);
            this.dockBackground.fillRect(
                0,
                layout.dockTop,
                width,
                height - layout.dockTop
            );
            this.dockBackground.lineStyle(1, 0x8FE3CF, 0.35);
            this.dockBackground.lineBetween(0, layout.dockTop, width, layout.dockTop);
        }

        // Create glow ring (initially invisible, shown when active)
        this.joystickGlow = this.scene.add.graphics();
        this.joystickGlow.setScrollFactor(0);
        this.joystickGlow.setDepth(9999); // Behind base
        this.joystickGlow.lineStyle(6, 0x00CED1, 0.6);
        this.joystickGlow.strokeCircle(joystickX, joystickY, joystickGlowRadius);
        this.joystickGlow.setAlpha(0); // Start invisible

        // Create base circle
        this.joystickBase = this.scene.add.graphics();
        this.joystickBase.setScrollFactor(0);
        this.joystickBase.setDepth(10000);
        this.joystickBase.fillStyle(0x000000, 0.3);
        this.joystickBase.fillCircle(joystickX, joystickY, joystickBaseRadius);
        this.joystickBase.lineStyle(3, 0xFFFFFF, 0.5);
        this.joystickBase.strokeCircle(joystickX, joystickY, joystickBaseRadius);
        this.drawJoystickDirections(
            this.joystickBase,
            joystickX,
            joystickY,
            joystickBaseRadius
        );

        // Create thumb (moveable part)
        this.joystickThumb = this.scene.add.graphics();
        this.joystickThumb.setScrollFactor(0);
        this.joystickThumb.setDepth(10001);
        this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
        this.joystickThumb.fillCircle(joystickX, joystickY, joystickThumbRadius);
        this.joystickThumb.lineStyle(2, 0x00CED1, 1);
        this.joystickThumb.strokeCircle(joystickX, joystickY, joystickThumbRadius);

        // Store thumb radius for movement updates
        this.joystickThumbRadius = joystickThumbRadius;

        // Create invisible zone for touch handling (MUCH larger than visual for reliable tracking)
        this.joystickZone = this.scene.add.zone(
            layout.joystick.zoneWidth / 2,
            joystickY,
            layout.joystick.zoneWidth,
            layout.joystick.zoneHeight
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002);

        console.log('[MobileControls] Joystick zone created in bottom dock');

        // Store center position
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;
        this.joystickHitBounds = {
            left: joystickX - layout.joystick.zoneWidth / 2,
            right: joystickX + layout.joystick.zoneWidth / 2,
            top: layout.dockTop,
            bottom: layout.dockBottom
        };
        this.joystickZone.setPosition(
            joystickX,
            joystickY
        );
        this.setupCanvasJoystickInput();

        // NOTE: Removed pointerout handler - it was causing false resets on mobile
        // when finger moved between interactive elements

        devLog('[MobileControls] Virtual joystick created at', joystickX, joystickY);
    }

    drawJoystickDirections(graphics, x, y, radius) {
        const edge = radius - 8;
        const half = 6;
        graphics.fillStyle(0xFFFFFF, 0.42);
        graphics.fillTriangle(x, y - edge, x - half, y - edge + 9, x + half, y - edge + 9);
        graphics.fillTriangle(x, y + edge, x - half, y + edge - 9, x + half, y + edge - 9);
        graphics.fillTriangle(x - edge, y, x - edge + 9, y - half, x - edge + 9, y + half);
        graphics.fillTriangle(x + edge, y, x + edge - 9, y - half, x + edge - 9, y + half);
    }

    setupCanvasJoystickInput() {
        const canvas = this.scene?.game?.canvas;
        if (!canvas) return;

        const getPointerId = (value) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (value === null || value === undefined) return null;
            const converted = Number(value);
            return Number.isFinite(converted) ? converted : null;
        };

        const isMatchingPointerId = (pointerId) => {
            const normalizedPointerId = getPointerId(pointerId);
            if (this.activePointerId === null || normalizedPointerId === null) {
                return false;
            }
            return normalizedPointerId === this.activePointerId;
        };

        const activateJoystick = (event, point) => {
            const normalizedPoint = point;
            if (!normalizedPoint || !this.isJoystickHit(normalizedPoint)) {
                return false;
            }

            const normalizedPointerId = getPointerId(event?.pointerId);
            if (normalizedPointerId === null) return false;

            this.clearPendingJoystickReset();
            this.joystickActive = true;
            this.activePointerId = normalizedPointerId;
            this.joystickActivatedAt = performance.now();
            this.lastJoystickMagnitude = 0;
            this.updateJoystickFromPointer(normalizedPoint);

            try {
                // Keep legacy string-assertion compatibility by attempting both raw and
                // normalized pointer IDs. Some environments report string IDs even when
                // the runtime expects numeric values, so we guard conversion explicitly.
                canvas.setPointerCapture?.(event.pointerId);
                if (event.pointerId !== normalizedPointerId) {
                    canvas.setPointerCapture?.(normalizedPointerId);
                }
            } catch (error) {
                devLog('[MobileControls] Pointer capture unavailable');
            }

            this.scene.tweens?.add({
                targets: this.joystickBase,
                alpha: 0.5,
                duration: 100,
                yoyo: true
            });
            this.scene.tweens?.add({
                targets: this.joystickGlow,
                alpha: 1,
                duration: 100,
                ease: 'Power2'
            });
            window.FeedbackManager?.vibrate?.('tap');

            return true;
        };

        const isJoystickPointer = (pointerId) => isMatchingPointerId(pointerId);

        this.canvasPointerDownHandler = event => {
            if (this.isSuspended || this.activePointerId !== null) return;
            const point = this.getCanvasGamePoint(event);
            if (!this.isJoystickHit(point)) return;

            event._mvfPointerId = getPointerId(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
            activateJoystick({
                pointerId: event._mvfPointerId ?? event.pointerId
            }, point);
        };

        this.canvasPointerMoveHandler = event => {
            const point = this.getCanvasGamePoint(event);
            if (!point) return;
            const eventPointerId = getPointerId(event.pointerId);

            // Intentionally do not auto-activate from move events.
            // Activation must come from pointerdown to avoid stealing active touches
            // from action buttons or creating sticky/strobing behavior.

            if (!this.joystickActive || !isJoystickPointer(eventPointerId)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.updateJoystickFromPointer(point);
        };

        this.canvasPointerUpHandler = event => {
            if (!isJoystickPointer(getPointerId(event.pointerId))) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.finishJoystickInput(this.activePointerId);
        };
        this.canvasTouchEndHandler = event => {
            if (!this.joystickActive || !this.activePointerId) return;

            const changed = event.changedTouches || [];
            for (let i = 0; i < changed.length; i += 1) {
                const identifier = getPointerId(changed[i].identifier);
                if (identifier === this.activePointerId) {
                    event.preventDefault();
                    event.stopImmediatePropagation?.();
                    this.finishJoystickInput(identifier);
                    return;
                }
            }
        };
        this.canvasPointerCancelHandler = event => {
            const eventPointerId = getPointerId(event.pointerId);
            if (isJoystickPointer(eventPointerId)) {
                this.resetJoystick(true);
            }
        };
        this.canvasLostPointerCaptureHandler = event => {
            const eventPointerId = getPointerId(event.pointerId);
            if (isJoystickPointer(eventPointerId)) {
                this.finishJoystickInput(this.activePointerId);
            }
        };

        // Phaser pointer events can miss a release if the finger exits the canvas.
        // Keep direct fallbacks that also filter by joystick pointer ID.
        this.scenePointerUpHandler = (pointer) => {
            const pointerId = getPointerId(pointer?.id);
            if (!this.joystickActive || pointerId === null || pointerId !== this.activePointerId) return;
            this.finishJoystickInput(pointerId);
        };

        this.scene.input.on('pointerup', this.scenePointerUpHandler);
        this.windowPointerUpHandler = (event) => {
            if (!this.joystickActive) return;
            const eventPointerId = getPointerId(event?.pointerId);
            if (eventPointerId === null || this.activePointerId === null || eventPointerId !== this.activePointerId) {
                return;
            }
            this.resetJoystick(true);
        };
        this.windowPointerCancelHandler = (event) => {
            if (!this.joystickActive) return;
            const eventPointerId = getPointerId(event?.pointerId);
            if (eventPointerId === null || this.activePointerId === null || eventPointerId !== this.activePointerId) {
                return;
            }
            this.resetJoystick(true);
        };
        window.addEventListener('pointerup', this.windowPointerUpHandler, { capture: true, passive: true });
        window.addEventListener('pointercancel', this.windowPointerCancelHandler, { capture: true, passive: true });

        const captureOptions = { capture: true, passive: false };
        canvas.addEventListener('pointerdown', this.canvasPointerDownHandler, captureOptions);
        canvas.addEventListener('pointermove', this.canvasPointerMoveHandler, captureOptions);
        canvas.addEventListener('pointerup', this.canvasPointerUpHandler, captureOptions);
        canvas.addEventListener('pointercancel', this.canvasPointerCancelHandler, captureOptions);
        canvas.addEventListener('touchend', this.canvasTouchEndHandler, captureOptions);
        canvas.addEventListener(
            'lostpointercapture',
            this.canvasLostPointerCaptureHandler,
            captureOptions
        );

        this.inputAbortHandler = () => this.resetJoystick(true);
        this.visibilityChangeHandler = () => {
            if (document.hidden) this.resetJoystick(true);
        };
        window.addEventListener('blur', this.inputAbortHandler);
        window.addEventListener('pagehide', this.inputAbortHandler);
        document.addEventListener(
            'visibilitychange',
            this.visibilityChangeHandler
        );
    }

    getCanvasGamePoint(event) {
        const rect = this.scene.game.canvas.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || !rect.width || !rect.height) {
            return null;
        }
        return {
            x: (event.clientX - rect.left) * (this.scene.scale.width / rect.width),
            y: (event.clientY - rect.top) * (this.scene.scale.height / rect.height)
        };
    }

    isJoystickHit(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            return false;
        }
        const bounds = this.joystickHitBounds;
        return Boolean(bounds) &&
            point.x >= bounds.left &&
            point.x <= bounds.right &&
            point.y >= bounds.top &&
            point.y <= bounds.bottom;
    }

    finishJoystickInput(pointerId) {
        const canvas = this.scene?.game?.canvas;
        const normalizedPointerId = (() => {
            if (typeof pointerId === 'number' && Number.isFinite(pointerId)) return pointerId;
            const converted = Number(pointerId);
            return Number.isFinite(converted) ? converted : null;
        })();
        const elapsed = performance.now() - this.joystickActivatedAt;
        const remainingPulse = this.minimumFlickDuration - elapsed;
        this.joystickActive = false;
        this.activePointerId = null;

        try {
            if (canvas?.hasPointerCapture?.(normalizedPointerId)) {
                canvas.releasePointerCapture(normalizedPointerId);
            }
        } catch (error) {
            devLog('[MobileControls] Pointer release already completed');
        }

        if (this.lastJoystickMagnitude > 0.1 && remainingPulse > 0) {
            this.pendingJoystickReset = window.setTimeout(() => {
                this.pendingJoystickReset = null;
                this.resetJoystick(true);
            }, remainingPulse);
            return;
        }
        this.resetJoystick(true);
    }

    clearPendingJoystickReset() {
        if (this.pendingJoystickReset !== null) {
            window.clearTimeout(this.pendingJoystickReset);
            this.pendingJoystickReset = null;
        }
    }

    updateJoystickFromPointer(pointer) {
        const vector = getJoystickVector({
            pointerX: pointer?.x,
            pointerY: pointer?.y,
            centerX: this.joystickCenterX,
            centerY: this.joystickCenterY,
            maxDistance: this.joystickMaxDistance,
            deadZone: this.deadZone
        });

        this.joystickThumb.clear();
        this.joystickThumb.fillStyle(0xFFFFFF, 0.9);
        this.joystickThumb.fillCircle(
            vector.thumbX,
            vector.thumbY,
            this.joystickThumbRadius
        );
        this.joystickThumb.lineStyle(2, 0x00CED1, 1);
        this.joystickThumb.strokeCircle(
            vector.thumbX,
            vector.thumbY,
            this.joystickThumbRadius
        );

        this.scene.game.events.emit('virtual-joystick', {
            x: vector.x,
            y: vector.y
        });
        this.lastJoystickMagnitude = Math.hypot(vector.x, vector.y);
    }

    /**
     * Reset joystick to center position immediately
     * Called when pointer is released (anywhere on screen or outside canvas)
     */
    resetJoystick(force = false) {
        if (!force && !this.joystickActive) return;

        this.clearPendingJoystickReset();
        this.joystickActive = false;
        this.activePointerId = null;
        this.lastJoystickMagnitude = 0;

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
        const layout = getMobileControlLayout({
            width,
            height,
            safeArea: this.getSafeAreaInsets()
        });
        const buttonSize = layout.secondarySize;
        const primarySize = layout.primarySize;
        const {
            leftX: leftColX,
            rightX: rightColX,
            topY: topRowY,
            bottomY: bottomRowY
        } = layout.actions;

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

        buttons.forEach(config => {
            this.createActionButton(config);
        });

        devLog('[MobileControls] Created', buttons.length, 'action buttons in optimized 2x2 grid');
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
        devLog('[MobileControls] Button pressed:', buttonId, 'Scene:', this.scene?.scene?.key);

        // Play sound feedback
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Emit appropriate event based on button
        switch (buttonId) {
            case 'attack':
                // Trigger combat projectile
                if (typeof this.scene.fireCombatProjectile === 'function') {
                    devLog('[MobileControls] Firing combat projectile');
                    this.scene.fireCombatProjectile();
                } else {
                    console.warn('[MobileControls] fireCombatProjectile not found on scene');
                    // Try emitting as virtual key as fallback
                    this.scene.game?.events?.emit('virtual-key', { key: 'attack', type: 'down' });
                }
                break;

            case 'interact':
                // Trigger space interaction (shop, flowers, etc.)
                devLog('[MobileControls] Triggering space interaction');
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
                devLog('[MobileControls] Opening inventory');
                if (typeof this.scene.openInventory === 'function') {
                    this.scene.openInventory();
                } else {
                    console.warn('[MobileControls] openInventory not found on scene');
                }
                break;

            case 'chat':
                // Open chat overlay
                devLog('[MobileControls] Opening chat');
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
        devLog('[MobileControls] Interact icon updated to:', newIcon);
    }

    /**
     * Refresh mobile controls - resets joystick and ensures handlers are properly attached
     * Call this when game state changes (e.g., creature switching) to ensure responsiveness
     */
    refresh() {
        if (!this.isVisible) return;

        devLog('[MobileControls] Refreshing controls');

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

        devLog('[MobileControls] Refresh complete - joystick reset and handlers recreated');
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
        devLog('[MobileControls] Destroying mobile controls');
        this.hide();
    }
}

// Export for use in game
if (typeof window !== 'undefined') {
    window.MobileControls = MobileControls;
}

export default MobileControls;
