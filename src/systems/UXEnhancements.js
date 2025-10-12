/**
 * UXEnhancements - Comprehensive UX improvements for accessibility, usability, and visual consistency
 * Addresses WCAG 2.1 guidelines and modern UX best practices
 */

class UXEnhancements {
    constructor() {
        this.initialized = false;
        this.focusableElements = [];
        this.currentFocusIndex = 0;
        this.announcementQueue = [];
        this.tooltips = new Map();
        this.animations = {
            duration: {
                instant: 0,
                fast: 150,
                normal: 300,
                slow: 500
            }
        };
        this.cleanupTasks = [];
        this.eventScope = null;
        this.manualEvents = [];
        this.observers = [];
    }

    registerCleanup(task) {
        if (typeof task === 'function') {
            this.cleanupTasks.push(task);
        }
    }

    addManagedEvent(target, event, handler, options) {
        if (!target || typeof handler !== 'function') return;

        if (this.eventScope && typeof this.eventScope.addEventListener === 'function') {
            this.eventScope.addEventListener(target, event, handler, options);
        } else if (target.addEventListener) {
            target.addEventListener(event, handler, options);
            this.manualEvents.push({ target, event, handler, options });
        }
    }

    addMediaQueryListener(query, handler) {
        if (!query || typeof handler !== 'function') return;
        if (query.addEventListener) {
            query.addEventListener('change', handler);
            this.registerCleanup(() => query.removeEventListener('change', handler));
        } else if (query.addListener) {
            query.addListener(handler);
            this.registerCleanup(() => query.removeListener(handler));
        }
    }

    runCleanupTasks() {
        while (this.cleanupTasks.length) {
            const task = this.cleanupTasks.pop();
            try {
                task();
            } catch (error) {
                console.warn('[UXEnhancements] Cleanup task failed', error);
            }
        }
        this.cleanupTasks.length = 0;
    }

    /**
     * Initialize UX enhancements
     */
    initialize(game) {
        if (this.initialized) return;
        
        this.game = game;
        if (window.memoryManager && typeof window.memoryManager.createScope === 'function') {
            this.eventScope = window.memoryManager.createScope();
        }

        // Set up accessibility features
        this.setupAccessibility();
        
        // Enhance visual feedback
        this.enhanceVisualFeedback();
        
        // Improve mobile experience
        this.enhanceMobileExperience();
        
        // Set up keyboard navigation
        this.setupKeyboardNavigation();
        
        // Add loading states
        this.setupLoadingStates();
        
        // Enhance animations
        this.setupAnimationPreferences();
        
        // Add tooltips system
        this.setupTooltips();
        
        // Set up focus management
        this.setupFocusManagement();
        
        // Add contrast controls
        this.setupContrastControls();
        
        this.initialized = true;
        console.log('[UXEnhancements] System initialized');
    }

    /**
     * Set up comprehensive accessibility features
     */
    setupAccessibility() {
        // Create live region for screen reader announcements
        const liveRegion = document.createElement('div');
        liveRegion.id = 'game-announcer';
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
        
        // Add ARIA labels to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.setAttribute('role', 'application');
            gameContainer.setAttribute('aria-label', 'Mythical Creature Game - Interactive Game World');
            gameContainer.setAttribute('aria-describedby', 'game-instructions');
        }
        
        // Create hidden instructions for screen readers
        const instructions = document.createElement('div');
        instructions.id = 'game-instructions';
        instructions.className = 'sr-only';
        instructions.innerHTML = `
            <h2>Game Controls</h2>
            <ul>
                <li>Use Arrow Keys or W,A,S,D to move your creature</li>
                <li>Press Space to interact with objects</li>
                <li>Press Tab to open the care menu</li>
                <li>Press C to open chat with your creature</li>
                <li>Press Escape to pause the game</li>
                <li>Press Alt+H for help</li>
            </ul>
        `;
        document.body.appendChild(instructions);
        
        // Add skip navigation links
        this.addSkipLinks();
    }

    /**
     * Add skip links for keyboard navigation
     */
    addSkipLinks() {
        const skipNav = document.createElement('nav');
        skipNav.className = 'skip-navigation';
        skipNav.innerHTML = `
            <a href="#game-canvas" class="skip-link">Skip to Game</a>
            <a href="#game-stats" class="skip-link">Skip to Stats</a>
            <a href="#game-controls" class="skip-link">Skip to Controls</a>
        `;
        document.body.insertBefore(skipNav, document.body.firstChild);
        
        // Style skip links (visually hidden until focused)
        const style = document.createElement('style');
        style.textContent = `
            .skip-navigation {
                position: absolute;
                left: -10000px;
                width: 1px;
                height: 1px;
                overflow: hidden;
                z-index: 100001;
            }

            .skip-link {
                position: absolute;
                left: -10000px;
                top: auto;
                width: 1px;
                height: 1px;
                overflow: hidden;
                background: #4B0082;
                color: white;
                padding: 8px 16px;
                text-decoration: none;
                border-radius: 0 0 8px 0;
            }

            .skip-link:focus {
                position: fixed;
                left: 0;
                top: 0;
                width: auto;
                height: auto;
                overflow: visible;
                outline: 3px solid #FFD700;
                outline-offset: 2px;
            }

            .skip-link:focus:nth-child(2) { left: 120px; }
            .skip-link:focus:nth-child(3) { left: 240px; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enhance visual feedback for all interactions
     */
    enhanceVisualFeedback() {
        // Add CSS for enhanced feedback
        const style = document.createElement('style');
        style.id = 'ux-visual-feedback';
        style.textContent = `
            /* Enhanced button states */
            .game-button {
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                user-select: none;
            }
            
            .game-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            }
            
            .game-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .game-button:focus-visible {
                outline: 3px solid #FFD700;
                outline-offset: 3px;
            }
            
            /* Ripple effect for buttons */
            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.7);
                transform: scale(0);
                animation: ripple-animation 0.6s ease-out;
            }
            
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            /* Loading states */
            .loading {
                position: relative;
                pointer-events: none;
                opacity: 0.6;
            }
            
            .loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                margin: -10px;
                border: 2px solid #fff;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spinner 0.8s linear infinite;
            }
            
            @keyframes spinner {
                to { transform: rotate(360deg); }
            }
            
            /* Success feedback */
            .success-feedback {
                animation: success-pulse 0.5s ease-out;
            }
            
            @keyframes success-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); background-color: #28a745; }
                100% { transform: scale(1); }
            }
            
            /* Error feedback */
            .error-feedback {
                animation: error-shake 0.5s ease-out;
            }
            
            @keyframes error-shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            /* Focus indicators */
            *:focus-visible {
                outline: 3px solid #FFD700;
                outline-offset: 2px;
            }
            
            /* Tooltip styles */
            .tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                pointer-events: none;
                z-index: 100000;
                opacity: 0;
                transform: translateY(-5px);
                transition: all 0.3s ease;
                max-width: 250px;
                line-height: 1.4;
            }
            
            .tooltip.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .tooltip::before {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid rgba(0, 0, 0, 0.9);
            }
            
            /* High contrast mode */
            @media (prefers-contrast: high) {
                .game-button {
                    border: 2px solid currentColor;
                }
                
                *:focus-visible {
                    outline-width: 4px;
                    outline-color: currentColor;
                }
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enhance mobile experience with better touch targets and gestures
     */
    enhanceMobileExperience() {
        if (!this.isMobileDevice()) return;
        
        // Increase touch target sizes
        const style = document.createElement('style');
        style.id = 'ux-mobile-enhancements';
        style.textContent = `
            /* Larger touch targets for mobile */
            @media (pointer: coarse) {
                .game-button,
                .virtual-button {
                    min-width: 44px;
                    min-height: 44px;
                    padding: 12px 16px;
                }
                
                .virtual-button {
                    width: 72px;
                    height: 72px;
                    font-size: 28px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                }
                
                .virtual-joystick {
                    width: 140px;
                    height: 140px;
                    opacity: 0.8;
                }
                
                /* Better spacing for mobile */
                .care-panel {
                    padding: 16px;
                    margin: 8px;
                }
                
                /* Larger text for readability */
                body {
                    font-size: 16px;
                }
            }
            
            /* Haptic feedback indication */
            .haptic-feedback {
                animation: haptic-pulse 0.1s ease-out;
            }
            
            @keyframes haptic-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        // Add haptic feedback for interactions
        this.addHapticFeedback();
    }

    /**
     * Set up keyboard navigation system
     */
    setupKeyboardNavigation() {
        // Track focusable elements
        this.updateFocusableElements();
        
        // Add keyboard event listeners
        const handleKeydown = (e) => {
            // Tab navigation enhancement
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
            
            // Quick actions
            if (e.altKey) {
                switch(e.key.toLowerCase()) {
                    case 'h': // Help
                        this.showHelp();
                        e.preventDefault();
                        break;
                    case 's': // Stats
                        this.focusStats();
                        e.preventDefault();
                        break;
                    case 'c': // Contrast toggle
                        this.toggleHighContrast();
                        e.preventDefault();
                        break;
                    case 'a': // Announce current state
                        this.announceGameState();
                        e.preventDefault();
                        break;
                }
            }
        };

        this.addManagedEvent(document, 'keydown', handleKeydown);
        
        // Update focusable elements when DOM changes
        const observer = new MutationObserver(() => {
            this.updateFocusableElements();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        this.observers.push(observer);
        this.registerCleanup(() => observer.disconnect());
    }

    /**
     * Handle enhanced tab navigation
     */
    handleTabNavigation(e) {
        const focusableElements = this.focusableElements;
        if (focusableElements.length === 0) return;
        
        const currentElement = document.activeElement;
        const currentIndex = focusableElements.indexOf(currentElement);
        
        if (e.shiftKey) {
            // Backwards navigation
            const nextIndex = currentIndex <= 0 ? 
                focusableElements.length - 1 : currentIndex - 1;
            focusableElements[nextIndex].focus();
            e.preventDefault();
        } else {
            // Forward navigation
            const nextIndex = currentIndex >= focusableElements.length - 1 ? 
                0 : currentIndex + 1;
            focusableElements[nextIndex].focus();
            e.preventDefault();
        }
        
        // Announce element to screen reader
        this.announceElement(document.activeElement);
    }

    /**
     * Update list of focusable elements
     */
    updateFocusableElements() {
        const selector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '.game-button:not(.disabled)',
            '.virtual-button'
        ].join(', ');
        
        this.focusableElements = Array.from(document.querySelectorAll(selector))
            .filter(el => el.offsetParent !== null); // Visible elements only
    }

    /**
     * Set up loading states for async operations
     */
    setupLoadingStates() {
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay hidden';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                transition: opacity 0.3s;
            }
            
            .loading-overlay.hidden {
                display: none;
            }
            
            .loading-content {
                text-align: center;
                color: white;
            }
            
            .loading-spinner {
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .loading-text {
                font-size: 18px;
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Set up animation preferences based on user settings
     */
    setupAnimationPreferences() {
        // Check for reduced motion preference
        const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const prefersReducedMotion = reduceQuery.matches;
        
        if (prefersReducedMotion) {
            // Override animation durations
            this.animations.duration = {
                instant: 0,
                fast: 1,
                normal: 1,
                slow: 1
            };
            
            // Add class to body for CSS
            document.body.classList.add('reduced-motion');
        }
        
        // Listen for changes
        const motionHandler = (e) => {
            if (e.matches) {
                document.body.classList.add('reduced-motion');
            } else {
                document.body.classList.remove('reduced-motion');
            }
        };
        this.addMediaQueryListener(reduceQuery, motionHandler);
    }

    /**
     * Set up tooltip system for better information disclosure
     */
    setupTooltips() {
        // Create tooltip container
        const tooltipContainer = document.createElement('div');
        tooltipContainer.id = 'tooltip-container';
        tooltipContainer.className = 'tooltip';
        document.body.appendChild(tooltipContainer);
        
        // Add tooltip to elements with data-tooltip attribute
        const handleMouseOver = (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.showTooltip(element);
            }
        };

        const handleMouseOut = (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.hideTooltip();
            }
        };

        // Touch support for tooltips
        const handleTouchStart = (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.showTooltip(element);
                setTimeout(() => this.hideTooltip(), 3000);
            }
        };

        this.addManagedEvent(document, 'mouseover', handleMouseOver);
        this.addManagedEvent(document, 'mouseout', handleMouseOut);
        this.addManagedEvent(document, 'touchstart', handleTouchStart, { passive: true });
        this.registerCleanup(() => tooltipContainer.remove());
    }

    /**
     * Show tooltip for element
     */
    showTooltip(element) {
        const tooltip = document.getElementById('tooltip-container');
        const text = element.getAttribute('data-tooltip');
        
        if (!text) return;
        
        tooltip.textContent = text;
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - 10) + 'px';
        tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
        
        // Show with animation
        tooltip.classList.add('visible');
        
        // Announce to screen reader
        this.announce(text);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip-container');
        tooltip.classList.remove('visible');
    }

    /**
     * Set up focus management for modal dialogs and panels
     */
    setupFocusManagement() {
        // Track focus history
        this.focusHistory = [];
        
        // Monitor focus changes
        const handleFocusIn = (e) => {
            if (!e.target.closest('.modal, .panel')) {
                this.focusHistory.push(e.target);
                
                // Keep history size manageable
                if (this.focusHistory.length > 10) {
                    this.focusHistory.shift();
                }
            }
        };

        this.addManagedEvent(document, 'focusin', handleFocusIn);
    }

    /**
     * Trap focus within element (for modals)
     */
    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        // Focus first element
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Trap focus
        const trapHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        };
        
        this.addManagedEvent(element, 'keydown', trapHandler);
        element.dataset.focusTrap = true;
        
        // Store handler for cleanup
        element._focusTrapHandler = trapHandler;
    }

    /**
     * Release focus trap
     */
    releaseFocusTrap(element) {
        if (element._focusTrapHandler) {
            element.removeEventListener('keydown', element._focusTrapHandler);
            delete element._focusTrapHandler;
            delete element.dataset.focusTrap;
        }
        
        // Restore previous focus
        if (this.focusHistory.length > 0) {
            const previousFocus = this.focusHistory.pop();
            if (previousFocus && previousFocus.focus) {
                previousFocus.focus();
            }
        }
    }

    /**
     * Set up contrast controls for better visibility
     */
    setupContrastControls() {
        // Check for high contrast preference
        const contrastQuery = window.matchMedia('(prefers-contrast: high)');
        const prefersHighContrast = contrastQuery.matches;
        
        if (prefersHighContrast) {
            document.body.classList.add('high-contrast');
        }
        
        // Listen for changes
        const contrastHandler = (e) => {
            if (e.matches) {
                document.body.classList.add('high-contrast');
            } else {
                document.body.classList.remove('high-contrast');
            }
        };
        this.addMediaQueryListener(contrastQuery, contrastHandler);
        
        // Add high contrast styles
        const style = document.createElement('style');
        style.textContent = `
            .high-contrast {
                filter: contrast(1.2);
            }
            
            .high-contrast * {
                border-width: 2px !important;
            }
            
            .high-contrast button,
            .high-contrast .game-button {
                border: 2px solid currentColor !important;
            }
            
            .high-contrast .tooltip {
                border: 2px solid white !important;
            }
        `;
        document.head.appendChild(style);
        this.registerCleanup(() => style.remove());
    }

    /**
     * Add haptic feedback for mobile devices
     */
    addHapticFeedback() {
        if (!navigator.vibrate) return;
        
        // Add haptic feedback to buttons
        const handleTouchStart = (e) => {
            if (e.target.closest('button, .game-button, .virtual-button')) {
                // Light haptic feedback
                navigator.vibrate(10);
                e.target.classList.add('haptic-feedback');
                setTimeout(() => e.target.classList.remove('haptic-feedback'), 100);
            }
        };

        // Stronger feedback for important actions
        const handleClick = (e) => {
            if (e.target.closest('.important-action')) {
                navigator.vibrate([20, 10, 20]);
            }
        };

        this.addManagedEvent(document, 'touchstart', handleTouchStart, { passive: true });
        this.addManagedEvent(document, 'click', handleClick);
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        
        text.textContent = message;
        overlay.classList.remove('hidden');
        
        // Announce to screen reader
        this.announce(`Loading: ${message}`);
        
        // Trap focus in loading overlay
        this.trapFocus(overlay);
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
        
        // Release focus trap
        this.releaseFocusTrap(overlay);
        
        // Announce completion
        this.announce('Loading complete');
    }

    /**
     * Add ripple effect to element
     */
    addRippleEffect(element, event) {
        const rect = element.getBoundingClientRect();
        const ripple = document.createElement('span');
        const diameter = Math.max(element.clientWidth, element.clientHeight);
        const radius = diameter / 2;
        
        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${event.clientX - rect.left - radius}px`;
        ripple.style.top = `${event.clientY - rect.top - radius}px`;
        ripple.classList.add('ripple');
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    /**
     * Show help overlay
     */
    showHelp() {
        const helpOverlay = document.createElement('div');
        helpOverlay.className = 'help-overlay';
        helpOverlay.innerHTML = `
            <div class="help-content">
                <h2>Game Help</h2>
                <button class="close-help" aria-label="Close help">×</button>
                <div class="help-section">
                    <h3>Keyboard Controls</h3>
                    <dl>
                        <dt>Arrow Keys / WASD</dt><dd>Move your creature</dd>
                        <dt>Space</dt><dd>Interact with objects</dd>
                        <dt>Tab</dt><dd>Open care menu</dd>
                        <dt>C</dt><dd>Chat with creature</dd>
                        <dt>F / P / R</dt><dd>Feed / Play / Rest</dd>
                        <dt>Escape</dt><dd>Pause game</dd>
                        <dt>Alt + H</dt><dd>Show this help</dd>
                        <dt>Alt + C</dt><dd>Toggle high contrast</dd>
                    </dl>
                </div>
                <div class="help-section">
                    <h3>Game Tips</h3>
                    <ul>
                        <li>Interact with flowers to gain XP</li>
                        <li>Take care of your creature daily</li>
                        <li>Complete tutorials for bonus rewards</li>
                        <li>Explore the world to discover secrets</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .help-overlay {
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
                animation: fadeIn 0.3s ease;
            }
            
            .help-content {
                background: white;
                color: #333;
                padding: 30px;
                border-radius: 10px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            }
            
            .help-content h2 {
                margin-top: 0;
                color: #4B0082;
            }
            
            .help-content h3 {
                color: #4B0082;
                margin-top: 20px;
            }
            
            .close-help {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                font-size: 30px;
                cursor: pointer;
                color: #666;
            }
            
            .help-section dt {
                font-weight: bold;
                color: #4B0082;
                margin-top: 10px;
            }
            
            .help-section dd {
                margin-left: 20px;
                color: #666;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(helpOverlay);
        
        // Trap focus
        this.trapFocus(helpOverlay);
        
        // Close handler
        const closeBtn = helpOverlay.querySelector('.close-help');
        closeBtn.addEventListener('click', () => {
            this.releaseFocusTrap(helpOverlay);
            helpOverlay.remove();
        });
        
        // Close on Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.releaseFocusTrap(helpOverlay);
                helpOverlay.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Announce to screen reader
        this.announce('Help menu opened. Press Escape to close.');
    }

    /**
     * Toggle high contrast mode
     */
    toggleHighContrast() {
        document.body.classList.toggle('high-contrast');
        const isHighContrast = document.body.classList.contains('high-contrast');
        
        // Save preference
        localStorage.setItem('highContrast', isHighContrast);
        
        // Announce change
        this.announce(isHighContrast ? 'High contrast mode enabled' : 'High contrast mode disabled');
    }

    /**
     * Announce message to screen reader
     */
    announce(message, priority = 'polite') {
        const announcer = document.getElementById('game-announcer');
        if (!announcer) return;
        
        // Clear previous announcement
        announcer.textContent = '';
        
        // Set new announcement after a brief delay (ensures screen reader picks it up)
        setTimeout(() => {
            announcer.textContent = message;
            announcer.setAttribute('aria-live', priority);
        }, 100);
        
        // Clear after announcement
        setTimeout(() => {
            announcer.textContent = '';
        }, 3000);
    }

    /**
     * Announce current game state
     */
    announceGameState() {
        if (!this.game || !window.GameState) return;
        
        const creature = window.GameState.get('creature');
        const stats = creature.stats;
        const message = `
            ${creature.name} is at level ${creature.level}.
            Health: ${stats.health}.
            Happiness: ${stats.happiness}.
            Energy: ${stats.energy}.
            Experience: ${creature.experience} out of 100.
        `;
        
        this.announce(message, 'assertive');
    }

    /**
     * Announce element details
     */
    announceElement(element) {
        if (!element) return;
        
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('data-tooltip') || 
                     element.textContent || 
                     element.value || 
                     'Interactive element';
        
        this.announce(`Focused: ${label}`);
    }

    /**
     * Focus stats area
     */
    focusStats() {
        const statsElement = document.querySelector('.stats-text, #game-stats');
        if (statsElement) {
            statsElement.focus();
            statsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.announce('Stats area focused');
        }
    }

    /**
     * Check if device is mobile
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    /**
     * Get animation duration based on user preference
     */
    getAnimationDuration(speed = 'normal') {
        return this.animations.duration[speed] || this.animations.duration.normal;
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.eventScope && typeof this.eventScope.cleanup === 'function') {
            this.eventScope.cleanup();
            this.eventScope = null;
        }

        if (this.manualEvents.length) {
            this.manualEvents.forEach(({ target, event, handler, options }) => {
                try {
                    target.removeEventListener(event, handler, options);
                } catch (error) {
                    console.warn('[UXEnhancements] Failed to remove manual event listener', { event, error });
                }
            });
            this.manualEvents = [];
        }

        if (this.observers.length) {
            this.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (error) {
                    console.warn('[UXEnhancements] Failed to disconnect observer', error);
                }
            });
            this.observers = [];
        }

        this.runCleanupTasks();

        // Remove added elements
        const elementsToRemove = [
            'game-announcer',
            'game-instructions',
            'loading-overlay',
            'tooltip-container',
            'ux-visual-feedback',
            'ux-mobile-enhancements'
        ];
        
        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });
        
        // Clear references
        this.focusableElements = [];
        this.focusHistory = [];
        this.tooltips.clear();
        
        this.initialized = false;
        this.game = null;

        console.log('[UXEnhancements] Destroyed');
    }
}

// Create global instance
window.UXEnhancements = new UXEnhancements();
