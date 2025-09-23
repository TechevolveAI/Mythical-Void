/**
 * ResponsiveManager - Handles responsive design, scaling, and touch support
 * Ensures the game works across all device sizes and input methods
 */

class ResponsiveManager {
    constructor() {
        this.game = null;
        this.baseWidth = 800;
        this.baseHeight = 600;
        this.currentScale = 1;
        this.orientation = 'landscape';
        this.isMobile = false;
        this.isTouchDevice = false;
        this.isFullscreen = false;
        this.virtualJoystick = null;
        this.touchButtons = new Map();
        this.resizeHandler = null;
        this.orientationHandler = null;
        this.cleanupTasks = [];
        this.resolutionMediaQuery = null;
        this.fullscreenButton = null;
        this.fullscreenChangeHandler = null;
    }

    /**
     * Initialize the responsive manager
     */
    initialize(game) {
        this.game = game;
        
        // Detect device capabilities
        this.detectDevice();
        
        // Set up responsive scaling
        this.setupResponsiveScaling();
        
        // Set up touch support if needed
        if (this.isTouchDevice) {
            this.setupTouchSupport();
        }
        
        // Set up orientation handling
        this.setupOrientationHandling();
        
        // Set up fullscreen support
        this.setupFullscreenSupport();
        
        // Initial resize
        this.handleResize();
        
        // Initialize Kid Mode responsive positioning
        this.initializeKidModeSupport();
        
        console.log('responsive:info [ResponsiveManager] Responsive system initialized with Kid Mode support');
        console.log(`[ResponsiveManager] Mobile: ${this.isMobile}, Touch: ${this.isTouchDevice}`);
    }

    /**
     * Detect device type and capabilities
     */
    detectDevice() {
        // Check for touch support
        this.isTouchDevice = 'ontouchstart' in window || 
                            navigator.maxTouchPoints > 0 || 
                            navigator.msMaxTouchPoints > 0;
        
        // Check for mobile device
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Alternative mobile check based on screen size
        if (!this.isMobile && window.innerWidth <= 768) {
            this.isMobile = true;
        }
        
        // Check orientation
        this.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }

    /**
     * Set up responsive scaling
     */
    setupResponsiveScaling() {
        // Create resize handler
        this.resizeHandler = this.debounce(() => {
            this.handleResize();
        }, 100);
        
        // Listen for resize events
        this.addManagedEvent(window, 'resize', this.resizeHandler);
        this.addManagedEvent(window, 'orientationchange', this.resizeHandler);

        // Listen for device pixel ratio changes (zoom)
        if (window.matchMedia) {
            this.resolutionMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            const mediaHandler = this.resizeHandler;
            if (this.resolutionMediaQuery.addEventListener) {
                this.resolutionMediaQuery.addEventListener('change', mediaHandler);
                this.registerCleanup(() => this.resolutionMediaQuery.removeEventListener('change', mediaHandler));
            } else if (this.resolutionMediaQuery.addListener) {
                this.resolutionMediaQuery.addListener(mediaHandler);
                this.registerCleanup(() => this.resolutionMediaQuery.removeListener(mediaHandler));
            }
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (!this.game) return;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Calculate scale to fit window while maintaining aspect ratio
        const scaleX = windowWidth / this.baseWidth;
        const scaleY = windowHeight / this.baseHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Apply minimum scale for readability
        const minScale = this.isMobile ? 0.5 : 0.75;
        this.currentScale = Math.max(scale, minScale);
        
        // Calculate new dimensions
        const newWidth = Math.floor(this.baseWidth * this.currentScale);
        const newHeight = Math.floor(this.baseHeight * this.currentScale);
        
        // Update Phaser game size
        if (this.game.scale) {
            this.game.scale.resize(newWidth, newHeight);
        }
        
        // Center the game canvas
        this.centerCanvas();
        
        // Update UI scale
        this.updateUIScale();
        
        // Emit resize event
        if (this.game.events) {
            this.game.events.emit('resize', {
                width: newWidth,
                height: newHeight,
                scale: this.currentScale,
                windowWidth,
                windowHeight
            });
        }
        
        console.log(`[ResponsiveManager] Resized to ${newWidth}x${newHeight} (scale: ${this.currentScale.toFixed(2)})`);
    }

    /**
     * Center the game canvas
     */
    centerCanvas() {
        const canvas = this.game.canvas;
        if (!canvas) return;
        
        // Apply centering styles
        canvas.style.position = 'absolute';
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        
        // Prevent mobile browser scaling
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.webkitTouchCallout = 'none';
    }

    /**
     * Update UI element scaling
     */
    updateUIScale() {
        // Update font sizes based on scale
        const baseFontSize = 16;
        const scaledFontSize = Math.max(12, Math.floor(baseFontSize * this.currentScale));
        
        // Apply to all text elements in the game
        if (this.game.scene) {
            const scenes = this.game.scene.scenes;
            scenes.forEach(scene => {
                if (scene && scene.children) {
                    scene.children.list.forEach(child => {
                        if (child.type === 'Text') {
                            const originalSize = parseInt(child.style.fontSize) || baseFontSize;
                            const newSize = Math.floor(originalSize * this.currentScale);
                            child.setFontSize(newSize);
                        }
                    });
                }
            });
        }
    }

    /**
     * Set up touch support
     */
    setupTouchSupport() {
        // Prevent default touch behaviors
        const preventHandler = (event) => this.preventDefaults(event);
        this.addManagedEvent(document, 'touchstart', preventHandler, { passive: false });
        this.addManagedEvent(document, 'touchmove', preventHandler, { passive: false });
        this.addManagedEvent(document, 'touchend', preventHandler, { passive: false });

        // Add touch-specific styles
        const styleAdded = this.addTouchStyles();
        if (styleAdded) {
            this.registerCleanup(() => {
                const style = document.getElementById('responsive-touch-styles');
                if (style) {
                    style.remove();
                }
                document.body.classList.remove('responsive-touch-active');
            });
        }

        // Create virtual controls if mobile
        if (this.isMobile) {
            this.createVirtualControls();
        }

        // Set up touch-to-mouse event mapping
        this.setupTouchToMouse();
    }

    /**
     * Prevent default touch behaviors
     */
    preventDefaults(e) {
        // Allow scrolling on specific elements
        if (e.target.classList && e.target.classList.contains('allow-scroll')) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Add touch-specific styles
     */
    addTouchStyles() {
        if (document.getElementById('responsive-touch-styles')) return false;
        
        const style = document.createElement('style');
        style.id = 'responsive-touch-styles';
        style.textContent = `
            * {
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
            }
            
            body {
                touch-action: none;
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
            }
            
            canvas {
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
            }
            
            .virtual-button {
                position: absolute;
                background: rgba(255, 255, 255, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: white;
                user-select: none;
                z-index: 1000;
                transition: background 0.1s;
            }
            
            .virtual-button:active {
                background: rgba(255, 255, 255, 0.5);
            }
            
            .virtual-joystick {
                position: absolute;
                width: 120px;
                height: 120px;
                bottom: 20px;
                left: 20px;
                z-index: 1000;
            }
            
            .joystick-base {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.4);
                border-radius: 50%;
            }
            
            .joystick-stick {
                position: absolute;
                width: 40px;
                height: 40px;
                background: rgba(255, 255, 255, 0.6);
                border: 2px solid white;
                border-radius: 50%;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                transition: none;
            }
        `;
       
       document.head.appendChild(style);
        document.body.classList.add('responsive-touch-active');

        return true;
    }

    /**
     * Create virtual controls for mobile
     */
    createVirtualControls() {
        // Create virtual joystick
        this.createVirtualJoystick();
        
        // Create action buttons
        this.createActionButtons();
    }

    /**
     * Create virtual joystick
     */
    createVirtualJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.className = 'virtual-joystick';
        joystickContainer.innerHTML = `
            <div class="joystick-base"></div>
            <div class="joystick-stick" id="joystick-stick"></div>
        `;
        document.body.appendChild(joystickContainer);
        
        const stick = document.getElementById('joystick-stick');
        const base = joystickContainer.querySelector('.joystick-base');
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        
        const handleStart = (e) => {
            isDragging = true;
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            // Limit stick movement to base radius
            const maxDistance = 40;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const limitedDistance = Math.min(distance, maxDistance);
            const angle = Math.atan2(deltaY, deltaX);
            
            const limitedX = Math.cos(angle) * limitedDistance;
            const limitedY = Math.sin(angle) * limitedDistance;
            
            stick.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
            
            // Emit joystick event
            this.emitJoystickEvent(limitedX / maxDistance, limitedY / maxDistance);
        };
        
        const handleEnd = () => {
            isDragging = false;
            stick.style.transform = 'translate(-50%, -50%)';
            this.emitJoystickEvent(0, 0);
        };
        
        // Add event listeners
        this.addManagedEvent(joystickContainer, 'touchstart', handleStart, { passive: false });
        this.addManagedEvent(joystickContainer, 'touchmove', handleMove, { passive: false });
        this.addManagedEvent(joystickContainer, 'touchend', handleEnd, { passive: false });
        this.addManagedEvent(joystickContainer, 'mousedown', handleStart);
        this.addManagedEvent(document, 'mousemove', handleMove);
        this.addManagedEvent(document, 'mouseup', handleEnd);

        this.virtualJoystick = joystickContainer;
        this.registerCleanup(() => {
            if (this.virtualJoystick) {
                this.virtualJoystick.remove();
                this.virtualJoystick = null;
            }
        });
    }

    /**
     * Create action buttons
     */
    createActionButtons() {
        const buttons = [
            { id: 'btn-interact', icon: '👆', x: 'right: 20px', y: 'bottom: 80px', key: 'space' },
            { id: 'btn-menu', icon: '☰', x: 'right: 20px', y: 'top: 20px', key: 'escape' },
            { id: 'btn-care', icon: '❤️', x: 'right: 90px', y: 'bottom: 80px', key: 'tab' }
        ];
        
        buttons.forEach(btnConfig => {
            const button = document.createElement('div');
            button.className = 'virtual-button';
            button.id = btnConfig.id;
            button.innerHTML = btnConfig.icon;
            button.style.left = btnConfig.x.includes('left') ? btnConfig.x.split(':')[1] : 'auto';
            button.style.right = btnConfig.x.includes('right') ? btnConfig.x.split(':')[1] : 'auto';
            button.style.top = btnConfig.y.includes('top') ? btnConfig.y.split(':')[1] : 'auto';
            button.style.bottom = btnConfig.y.includes('bottom') ? btnConfig.y.split(':')[1] : 'auto';
            
            // Handle button press
            const handlePress = () => {
                this.emitKeyEvent(btnConfig.key, 'down');
            };
            
            const handleRelease = () => {
                this.emitKeyEvent(btnConfig.key, 'up');
            };
            
            this.addManagedEvent(button, 'touchstart', handlePress, { passive: false });
            this.addManagedEvent(button, 'touchend', handleRelease, { passive: false });
            this.addManagedEvent(button, 'mousedown', handlePress);
            this.addManagedEvent(button, 'mouseup', handleRelease);

            document.body.appendChild(button);
            this.touchButtons.set(btnConfig.id, button);
            this.registerCleanup(() => {
                this.touchButtons.delete(btnConfig.id);
                button.remove();
            });
        });
    }

    /**
     * Emit joystick event
     */
    emitJoystickEvent(x, y) {
        if (!this.game || !this.game.events) return;
        
        this.game.events.emit('virtual-joystick', { x, y });
    }

    /**
     * Emit virtual key event
     */
    emitKeyEvent(key, type) {
        if (!this.game || !this.game.events) return;
        
        this.game.events.emit('virtual-key', { key, type });
    }

    /**
     * Set up touch to mouse event mapping
     */
    setupTouchToMouse() {
        const canvas = this.game.canvas;
        if (!canvas) return;
        
        // Map touch events to mouse events
        const touchStartHandler = (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        };

        const touchMoveHandler = (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        };

        const touchEndHandler = (e) => {
            if (e && e.cancelable) e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
        };

        this.addManagedEvent(canvas, 'touchstart', touchStartHandler, { passive: false });
        this.addManagedEvent(canvas, 'touchmove', touchMoveHandler, { passive: false });
        this.addManagedEvent(canvas, 'touchend', touchEndHandler, { passive: false });
    }

    /**
     * Set up orientation handling
     */
    setupOrientationHandling() {
        this.orientationHandler = () => {
            const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
            
            if (newOrientation !== this.orientation) {
                this.orientation = newOrientation;
                console.log(`[ResponsiveManager] Orientation changed to: ${this.orientation}`);
                
                if (this.isMobile && this.orientation === 'portrait') {
                    this.showOrientationMessage();
                } else {
                    this.hideOrientationMessage();
                }
                
                // Trigger resize
                this.handleResize();
            }
        };
        
        this.addManagedEvent(window, 'orientationchange', this.orientationHandler);
        this.addManagedEvent(window, 'resize', this.orientationHandler);
    }

    /**
     * Show orientation message
     */
    showOrientationMessage() {
        if (document.getElementById('orientation-message')) return;
        
        const message = document.createElement('div');
        message.id = 'orientation-message';
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
            ">
                <div>
                    <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                    <h2>Please Rotate Your Device</h2>
                    <p>This game is best played in landscape mode</p>
                </div>
            </div>
        `;
        document.body.appendChild(message);
    }

    /**
     * Hide orientation message
     */
    hideOrientationMessage() {
        const message = document.getElementById('orientation-message');
        if (message) {
            message.remove();
        }
    }

    /**
     * Set up fullscreen support
     */
    setupFullscreenSupport() {
        // Add fullscreen button for mobile
        if (this.isMobile) {
            const fullscreenBtn = document.createElement('div');
            fullscreenBtn.className = 'virtual-button';
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.style.right = '20px';
            fullscreenBtn.style.top = '80px';
            
            const onClick = () => this.toggleFullscreen();
            this.addManagedEvent(fullscreenBtn, 'click', onClick);
            
            document.body.appendChild(fullscreenBtn);
            this.fullscreenButton = fullscreenBtn;
            this.registerCleanup(() => {
                if (this.fullscreenButton) {
                    this.fullscreenButton.remove();
                    this.fullscreenButton = null;
                }
            });
        }

        this.fullscreenChangeHandler = () => {
            this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        };
        this.addManagedEvent(document, 'fullscreenchange', this.fullscreenChangeHandler);
        this.addManagedEvent(document, 'webkitfullscreenchange', this.fullscreenChangeHandler);
        this.addManagedEvent(document, 'msfullscreenchange', this.fullscreenChangeHandler);
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!this.isFullscreen) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
            this.isFullscreen = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.isFullscreen = false;
        }
    }

    /**
     * Initialize Kid Mode responsive support
     */
    initializeKidModeSupport() {
        // Listen for Kid Mode toggle events
        if (window.GameState && typeof window.GameState.on === 'function') {
            const disposer = window.GameState.on('ui/kidmode_toggled', (data) => {
                this.handleKidModeToggle(data.enabled);
            });
            this.registerCleanup(() => {
                if (typeof disposer === 'function') {
                    disposer();
                }
            });
        }
        
        // Apply initial Kid Mode positioning if active
        if (window.KidMode && window.KidMode.isKidMode()) {
            this.applyKidModeLayout();
        }
    }
    
    /**
     * Handle Kid Mode toggle
     * @param {boolean} enabled - Whether Kid Mode is enabled
     */
    handleKidModeToggle(enabled) {
        if (enabled) {
            this.applyKidModeLayout();
        } else {
            this.removeKidModeLayout();
        }
        
        console.log(`responsive:info [ResponsiveManager] Kid Mode layout ${enabled ? 'applied' : 'removed'}`);
    }
    
    /**
     * Apply Kid Mode responsive layout
     */
    applyKidModeLayout() {
        // Adjust virtual controls for Kid Mode
        if (this.isMobile) {
            this.adjustVirtualControlsForKidMode();
        }
        
        // Update CSS for Kid Mode scaling
        this.injectKidModeResponsiveCSS();
        
        // Trigger resize to apply new scaling
        this.handleResize();
    }
    
    /**
     * Remove Kid Mode responsive layout
     */
    removeKidModeLayout() {
        const kidModeStyles = document.getElementById('kidmode-responsive-styles');
        if (kidModeStyles) {
            kidModeStyles.remove();
        }
        
        // Reset virtual controls
        if (this.isMobile) {
            this.resetVirtualControls();
        }
        
        this.handleResize();
    }
    
    /**
     * Adjust virtual controls for Kid Mode (larger hit targets)
     */
    adjustVirtualControlsForKidMode() {
        const config = window.KidMode?.getConfig() || { hitboxMin: 64, paddingScale: 1.3 };
        
        // Update virtual buttons
        this.touchButtons.forEach(button => {
            button.style.width = `${config.hitboxMin}px`;
            button.style.height = `${config.hitboxMin}px`;
            button.style.fontSize = `${Math.floor(config.hitboxMin * 0.4)}px`;
        });
        
        // Update joystick size
        if (this.virtualJoystick) {
            const newSize = Math.max(140, config.hitboxMin * 2.2);
            this.virtualJoystick.style.width = `${newSize}px`;
            this.virtualJoystick.style.height = `${newSize}px`;
            
            const stick = this.virtualJoystick.querySelector('.joystick-stick');
            if (stick) {
                const stickSize = Math.floor(newSize * 0.3);
                stick.style.width = `${stickSize}px`;
                stick.style.height = `${stickSize}px`;
            }
        }
    }
    
    /**
     * Reset virtual controls to default size
     */
    resetVirtualControls() {
        // Reset button sizes
        this.touchButtons.forEach(button => {
            button.style.width = '60px';
            button.style.height = '60px';
            button.style.fontSize = '24px';
        });
        
        // Reset joystick size
        if (this.virtualJoystick) {
            this.virtualJoystick.style.width = '120px';
            this.virtualJoystick.style.height = '120px';
            
            const stick = this.virtualJoystick.querySelector('.joystick-stick');
            if (stick) {
                stick.style.width = '40px';
                stick.style.height = '40px';
            }
        }
    }
    
    /**
     * Inject Kid Mode responsive CSS
     */
    injectKidModeResponsiveCSS() {
        if (document.getElementById('kidmode-responsive-styles')) return;
        
        const config = window.KidMode?.getConfig() || { 
            fontScale: 1.2, 
            paddingScale: 1.3, 
            hitboxMin: 64 
        };
        
        const style = document.createElement('style');
        style.id = 'kidmode-responsive-styles';
        style.textContent = `
            /* Kid Mode Responsive Overrides */
            body.kid-mode .virtual-button {
                width: ${config.hitboxMin}px !important;
                height: ${config.hitboxMin}px !important;
                font-size: ${Math.floor(config.hitboxMin * 0.4)}px !important;
                border-radius: 16px !important;
                border-width: 3px !important;
            }
            
            body.kid-mode .virtual-joystick {
                width: ${Math.max(140, config.hitboxMin * 2.2)}px !important;
                height: ${Math.max(140, config.hitboxMin * 2.2)}px !important;
            }
            
            body.kid-mode .joystick-stick {
                width: ${Math.floor(config.hitboxMin * 0.6)}px !important;
                height: ${Math.floor(config.hitboxMin * 0.6)}px !important;
            }
            
            /* Enhanced touch targets for Kid Mode */
            body.kid-mode .kid-mode-ui {
                padding: ${Math.floor(8 * config.paddingScale)}px !important;
                min-height: ${config.hitboxMin}px !important;
                font-size: ${Math.floor(16 * config.fontScale)}px !important;
            }
            
            /* Mobile-first Kid Mode CTA positioning */
            @media (max-width: 768px) {
                body.kid-mode .kid-cta-bar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 999;
                    padding: 20px;
                    background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
                }
                
                body.kid-mode .kid-status-bar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 999;
                    padding: 15px;
                    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);
                }
            }
            
            /* Tablet optimizations */
            @media (min-width: 769px) and (max-width: 1024px) {
                body.kid-mode .kid-cta-bar {
                    position: fixed;
                    bottom: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 999;
                    border-radius: 20px;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(10px);
                    padding: 15px 25px;
                }
            }
            
            /* Desktop floating UI */
            @media (min-width: 1025px) {
                body.kid-mode .kid-cta-bar {
                    position: fixed;
                    bottom: 60px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 999;
                    border-radius: 25px;
                    background: rgba(255,255,255,0.15);
                    backdrop-filter: blur(15px);
                    border: 2px solid rgba(255,215,0,0.3);
                    padding: 20px 30px;
                }
                
                body.kid-mode .kid-status-bar {
                    position: fixed;
                    top: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 999;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.12);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 15px 25px;
                }
            }
            
            /* Reduced motion support for Kid Mode */
            @media (prefers-reduced-motion: reduce) {
                body.kid-mode .virtual-button,
                body.kid-mode .kid-mode-ui {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Get current device info
     */
    getDeviceInfo() {
        return {
            isMobile: this.isMobile,
            isTouchDevice: this.isTouchDevice,
            orientation: this.orientation,
            scale: this.currentScale,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio,
            isFullscreen: this.isFullscreen
        };
    }

    /**
     * Create Kid Mode CTA bar with Space-Mythic theming and responsive positioning
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} config - CTA configuration
     * @returns {Phaser.GameObjects.Container} CTA container
     */
    createSpaceMythicCTABar(scene, config = {}) {
        const isKidMode = window.KidMode && window.KidMode.isKidMode();
        if (!isKidMode) return null;

        const { 
            primaryAction = { icon: '🤗', text: 'PET', action: 'pet', color: 'hsl(265,55%,78%)' },
            secondaryActions = [],
            showPhoto = true,
            emotion = 'default'
        } = config;

        const screenWidth = scene.cameras.main.width;
        const screenHeight = scene.cameras.main.height;
        
        // Responsive positioning based on device type
        let barY;
        let backgroundStyle;
        
        if (this.isMobile) {
            barY = screenHeight - 50;
            backgroundStyle = {
                width: screenWidth,
                height: 80,
                radius: 0,
                alpha: 0.4
            };
        } else if (window.innerWidth < 1024) {
            // Tablet
            barY = screenHeight - 70;
            backgroundStyle = {
                width: Math.min(600, screenWidth * 0.8),
                height: 70,
                radius: 20,
                alpha: 0.3
            };
        } else {
            // Desktop - floating glassmorphism bar
            barY = screenHeight - 90;
            backgroundStyle = {
                width: Math.min(500, screenWidth * 0.6),
                height: 65,
                radius: 25,
                alpha: 0.15
            };
        }
        
        const ctaContainer = scene.add.container(screenWidth / 2, barY);
        ctaContainer.setScrollFactor(0);
        ctaContainer.name = 'kid-cta-bar';
        
        // Space-Mythic glassmorphism background
        const barBg = scene.add.graphics();
        
        // Base glass effect
        barBg.fillStyle(0xFFFFFF, backgroundStyle.alpha);
        barBg.fillRoundedRect(
            -backgroundStyle.width / 2, 
            -backgroundStyle.height / 2, 
            backgroundStyle.width, 
            backgroundStyle.height, 
            backgroundStyle.radius
        );
        
        // Border glow
        barBg.lineStyle(2, 0xFFD54F, 0.6);
        barBg.strokeRoundedRect(
            -backgroundStyle.width / 2, 
            -backgroundStyle.height / 2, 
            backgroundStyle.width, 
            backgroundStyle.height, 
            backgroundStyle.radius
        );
        
        // Inner highlight
        barBg.lineStyle(1, 0xFFFFFF, 0.3);
        barBg.strokeRoundedRect(
            -backgroundStyle.width / 2 + 2, 
            -backgroundStyle.height / 2 + 2, 
            backgroundStyle.width - 4, 
            backgroundStyle.height - 4, 
            backgroundStyle.radius - 2
        );
        
        ctaContainer.add(barBg);

        // Get contextual action from Kid Mode system
        const nextAction = window.KidMode.getNextBestAction(emotion);
        const actualPrimaryAction = nextAction || primaryAction;
        
        // Primary action button (Space-Mythic themed)
        if (actualPrimaryAction) {
            const primaryBtn = window.KidMode.createSpaceButton(
                scene,
                0,
                0,
                actualPrimaryAction.text,
                actualPrimaryAction.icon,
                () => {
                    scene.events.emit('kid_mode_action', actualPrimaryAction.action);
                    // Show contextual help
                    if (actualPrimaryAction.message) {
                        window.KidMode.showSpaceHelpMessage(scene, actualPrimaryAction.message);
                    }
                },
                { 
                    primary: true, 
                    width: this.isMobile ? 90 : 100, 
                    height: this.isMobile ? 50 : 55,
                    color: actualPrimaryAction.color || 'hsl(45,90%,64%)'
                }
            );
            ctaContainer.add(primaryBtn);
        }

        // Photo button (right side) - always available
        if (showPhoto) {
            const photoX = this.isMobile ? screenWidth / 2 - 70 : backgroundStyle.width / 2 - 60;
            const photoBtn = window.KidMode.createSpaceButton(
                scene,
                photoX,
                0,
                'PHOTO',
                '📸',
                () => {
                    scene.events.emit('kid_mode_action', 'photo');
                    window.FXLibrary?.stardustBurst(scene, photoX, barY, {
                        count: 12,
                        color: [0xF48FB1, 0xFFD54F]
                    });
                },
                { 
                    width: this.isMobile ? 60 : 64, 
                    height: this.isMobile ? 45 : 48,
                    color: 'hsl(330,85%,72%)'
                }
            );
            ctaContainer.add(photoBtn);
        }

        // Secondary actions (left side) - contextual based on current emotion
        const contextualActions = window.KidMode.getSecondaryActions(actualPrimaryAction?.action);
        const actionsToShow = contextualActions.slice(0, this.isMobile ? 2 : 3);
        
        actionsToShow.forEach((action, index) => {
            const xOffset = this.isMobile ? 
                -(screenWidth / 2 - 40) + (index * 65) : 
                -(backgroundStyle.width / 2 - 50) + (index * 70);
                
            const secondaryBtn = window.KidMode.createSpaceButton(
                scene,
                xOffset,
                0,
                action.text,
                action.icon,
                () => {
                    scene.events.emit('kid_mode_action', action.action);
                    // Visual feedback
                    window.FXLibrary?.stardustBurst(scene, xOffset, barY, {
                        count: 6,
                        color: [window.UITheme.hslToHex(action.color)]
                    });
                },
                { 
                    width: this.isMobile ? 55 : 60, 
                    height: this.isMobile ? 35 : 40,
                    color: action.color
                }
            );
            ctaContainer.add(secondaryBtn);
        });

        return ctaContainer;
    }
    
    /**
     * Legacy CTA bar method (redirects to Space-Mythic version)
     */
    createKidModeCTABar(scene, config = {}) {
        return this.createSpaceMythicCTABar(scene, config);
    }

    /**
     * Create Space-Mythic themed status bar with responsive design
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} needs - Creature needs data
     * @returns {Phaser.GameObjects.Container} Status bar container
     */
    createSpaceMythicStatusBar(scene, needs = {}) {
        const isKidMode = window.KidMode && window.KidMode.isKidMode();
        if (!isKidMode) return null;

        const screenWidth = scene.cameras.main.width;
        
        // Responsive positioning
        let barY, bgWidth, bgHeight;
        if (this.isMobile) {
            barY = 35;
            bgWidth = screenWidth * 0.95;
            bgHeight = 50;
        } else if (window.innerWidth < 1024) {
            barY = 45;
            bgWidth = Math.min(500, screenWidth * 0.8);
            bgHeight = 45;
        } else {
            barY = 55;
            bgWidth = Math.min(450, screenWidth * 0.6);
            bgHeight = 40;
        }
        
        const statusContainer = scene.add.container(screenWidth / 2, barY);
        statusContainer.setScrollFactor(0);
        statusContainer.name = 'kid-status-bar';

        // Space-Mythic glassmorphism background
        const statusBg = scene.add.graphics();
        
        // Base glass effect
        statusBg.fillStyle(0xFFFFFF, 0.12);
        statusBg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 15);
        
        // Subtle border
        statusBg.lineStyle(1, 0xFFFFFF, 0.2);
        statusBg.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 15);
        
        statusContainer.add(statusBg);

        // Space-themed need bars
        const needTypes = [
            { key: 'hunger', name: 'Cosmic Energy' },
            { key: 'energy', name: 'Nebula Rest' },
            { key: 'fun', name: 'Stellar Joy' }
        ];
        
        const barSpacing = this.isMobile ? bgWidth / 4 : 120;
        const maxBars = this.isMobile ? 3 : needTypes.length;
        
        needTypes.slice(0, maxBars).forEach((need, index) => {
            const xOffset = (index - (maxBars - 1) / 2) * barSpacing;
            const value = needs[need.key] || Math.floor(Math.random() * 100);
            
            const needBar = window.KidMode.createSpaceNeedBar(
                scene, 
                xOffset, 
                0, 
                need.key, 
                value
            );
            statusContainer.add(needBar);
        });

        // Add subtle cosmic particle effect around status bar
        if (window.FXLibrary && !this.isMobile) {
            scene.time.delayedCall(1000, () => {
                window.FXLibrary.stardustBurst(scene, screenWidth / 2, barY, {
                    count: 3,
                    speed: { min: 10, max: 20 },
                    duration: 3000,
                    color: [0x80CBC4, 0xB39DDB],
                    spread: 60
                });
            });
        }

        return statusContainer;
    }
    
    /**
     * Legacy status bar method (redirects to Space-Mythic version)
     */
    createKidModeStatusBar(scene, needs = {}) {
        return this.createSpaceMythicStatusBar(scene, needs);
    }

    /**
     * Position Space-Mythic UI elements based on screen size and device capabilities
     * @param {Array} elements - UI elements to position
     * @param {string} layout - Layout type ('mobile', 'tablet', 'desktop')
     */
    arrangeSpaceMythicUI(elements, layout = 'auto') {
        if (layout === 'auto') {
            layout = this.isMobile ? 'mobile' : (window.innerWidth < 1024 ? 'tablet' : 'desktop');
        }

        const arrangements = {
            mobile: {
                statusBar: { x: 0.5, y: 0.05, scale: 1.0 },
                ctaBar: { x: 0.5, y: 0.92, scale: 1.0 },
                helpMessage: { x: 0.5, y: 0.15, scale: 1.1 },
                creature: { x: 0.5, y: 0.55, scale: 1.2 },
                biomeEffects: { scale: 0.8 }
            },
            tablet: {
                statusBar: { x: 0.5, y: 0.08, scale: 1.0 },
                ctaBar: { x: 0.5, y: 0.88, scale: 1.0 },
                helpMessage: { x: 0.5, y: 0.18, scale: 1.0 },
                creature: { x: 0.5, y: 0.5, scale: 1.1 },
                biomeEffects: { scale: 0.9 }
            },
            desktop: {
                statusBar: { x: 0.5, y: 0.1, scale: 1.0 },
                ctaBar: { x: 0.5, y: 0.82, scale: 1.0 },
                helpMessage: { x: 0.5, y: 0.22, scale: 1.0 },
                creature: { x: 0.5, y: 0.5, scale: 1.0 },
                biomeEffects: { scale: 1.0 }
            }
        };

        const config = arrangements[layout];
        const screenWidth = scene?.cameras?.main?.width || window.innerWidth;
        const screenHeight = scene?.cameras?.main?.height || window.innerHeight;

        elements.forEach(element => {
            if (element && element.type && config[element.type]) {
                const pos = config[element.type];
                
                if (element.object && element.object.setPosition) {
                    element.object.setPosition(
                        screenWidth * pos.x,
                        screenHeight * pos.y
                    );
                    
                    // Apply responsive scaling
                    if (pos.scale && element.object.setScale) {
                        element.object.setScale(pos.scale);
                    }
                }
            }
        });
        
        console.log(`responsive:debug [ResponsiveManager] Space-Mythic UI arranged for ${layout} layout`);
    }
    
    /**
     * Legacy UI arrangement method (redirects to Space-Mythic version)
     */
    arrangeKidModeUI(elements, layout = 'auto') {
        return this.arrangeSpaceMythicUI(elements, layout);
    }

    /**
     * Debounce helper function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    registerCleanup(task) {
        if (typeof task === 'function') {
            this.cleanupTasks.push(task);
        }
    }

    addManagedEvent(target, type, handler, options) {
        if (!target || !target.addEventListener) return;
        target.addEventListener(type, handler, options);
        this.registerCleanup(() => {
            try {
                target.removeEventListener(type, handler, options);
            } catch (error) {
                console.warn('responsive:warn [ResponsiveManager] Failed to remove event listener', { type, error });
            }
        });
    }

    runCleanupTasks() {
        while (this.cleanupTasks.length) {
            const task = this.cleanupTasks.pop();
            try {
                task();
            } catch (error) {
                console.warn('responsive:warn [ResponsiveManager] Cleanup task failed', error);
            }
        }
        this.cleanupTasks.length = 0;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.runCleanupTasks();

        this.touchButtons.clear();
        this.virtualJoystick = null;
        this.fullscreenButton = null;

        this.hideOrientationMessage();
        
        // Remove Kid Mode styles
        this.removeKidModeLayout();
        const touchStyle = document.getElementById('responsive-touch-styles');
        if (touchStyle) {
            touchStyle.remove();
        }
        if (document.body) {
            document.body.classList.remove('responsive-touch-active');
        }

        this.game = null;
        
        console.log('responsive:info [ResponsiveManager] Destroyed');
    }
}

// Create global instance
window.ResponsiveManager = ResponsiveManager;
