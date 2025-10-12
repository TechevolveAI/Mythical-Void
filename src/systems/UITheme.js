const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * UITheme - Centralized UI theme system for consistent styling
 * Manages colors, typography, spacing, and responsive design
 */

class UITheme {
    constructor() {
        // Color palette
        this.colors = {
            // Primary colors
            primary: '#4B0082',      // Indigo
            primaryDark: '#310054',
            primaryLight: '#7B68EE',
            
            // Secondary colors
            secondary: '#FFD700',    // Gold
            secondaryDark: '#FFA500',
            secondaryLight: '#FFEB3B',
            
            // Semantic colors
            success: '#28A745',
            warning: '#FFC107',
            danger: '#DC3545',
            info: '#17A2B8',
            
            // Neutral colors
            white: '#FFFFFF',
            black: '#000000',
            gray: {
                50: '#F8F9FA',
                100: '#F1F3F5',
                200: '#E9ECEF',
                300: '#DEE2E6',
                400: '#CED4DA',
                500: '#ADB5BD',
                600: '#6C757D',
                700: '#495057',
                800: '#343A40',
                900: '#212529'
            },
            
            // Game-specific colors
            creature: {
                health: '#FF6B6B',
                happiness: '#FFD93D',
                energy: '#6BCF7F',
                experience: '#4ECDC4'
            },

            // Space-Mythic theme colors for Kid Mode
            spaceMythic: {
                starGold: 'hsl(45,90%,64%)',       // Primary action color
                auroraTeal: 'hsl(180,60%,68%)',    // Secondary actions
                crystalLilac: 'hsl(265,55%,78%)',  // Background tint
                deepInk: 'hsl(240,25%,24%)',       // Text color
                cosmicGreen: 'hsl(120,65%,70%)',   // Success states
                asteroidOrange: 'hsl(30,85%,68%)', // Warnings
                nebulaRed: 'hsl(0,75%,72%)',       // Danger states
                cometBlue: 'hsl(210,75%,70%)',     // Cool accents
                nebulaPink: 'hsl(330,85%,72%)',    // Warm accents
                stellarWhite: 'hsl(0,0%,95%)',     // Light text
                voidDark: 'hsl(240,30%,15%)'       // Dark elements
            },
            
            // Kid Mode specific colors (legacy support)
            kidMode: {
                primary: 'hsl(45,90%,64%)',
                secondary: 'hsl(180,60%,68%)',
                background: 'hsl(265,55%,78%)',
                text: 'hsl(240,25%,24%)',
                textSecondary: 'hsl(210,75%,70%)',
                success: 'hsl(120,65%,70%)',
                warning: 'hsl(30,85%,68%)',
                danger: 'hsl(0,75%,72%)',
                playful: 'hsl(330,85%,72%)',
                calm: 'hsl(180,60%,68%)',
                energetic: 'hsl(45,90%,64%)'
            },
            
            // Background colors
            background: {
                light: '#F0F8FF',    // Alice blue
                dark: '#2C2C2C',
                overlay: 'rgba(0, 0, 0, 0.5)',
                glass: 'rgba(255, 255, 255, 0.1)'
            },
            
            // Text colors
            text: {
                primary: '#212529',
                secondary: '#6C757D',
                light: '#FFFFFF',
                dark: '#000000',
                muted: '#ADB5BD'
            }
        };
        
        // Typography
        this.typography = {
            fontFamily: {
                base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                heading: '"Fredoka One", cursive',
                mono: '"Courier New", Courier, monospace'
            },
            
            fontSize: {
                xs: 12,
                sm: 14,
                base: 16,
                lg: 18,
                xl: 20,
                '2xl': 24,
                '3xl': 30,
                '4xl': 36,
                '5xl': 48
            },
            
            fontWeight: {
                light: 300,
                normal: 400,
                medium: 500,
                semibold: 600,
                bold: 700
            },
            
            lineHeight: {
                tight: 1.2,
                normal: 1.5,
                relaxed: 1.75,
                loose: 2
            }
        };

        // Kid Mode scaling factors
        this.kidMode = {
            fontScale: 1.2,           // 20% larger fonts
            paddingScale: 1.3,        // 30% more padding
            hitboxMin: 64,            // Minimum 64px touch targets
            buttonRadius: 12,         // Rounded button corners
            animationDuration: 100,   // Quick feedback animations
            spacing: {
                xs: 6,    // Scaled up from base spacing
                sm: 10,
                base: 13,
                lg: 20,
                xl: 26,
                '2xl': 32,
                '3xl': 52,
                '4xl': 65
            },
            fontSize: {
                xs: 15,   // All font sizes scaled by 1.2
                sm: 17,
                base: 19,
                lg: 22,
                xl: 24,
                '2xl': 29,
                '3xl': 36,
                '4xl': 43,
                '5xl': 58
            }
        };
        
        // Spacing
        this.spacing = {
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
            '2xl': 48,
            '3xl': 64
        };
        
        // Border radius
        this.borderRadius = {
            none: 0,
            sm: 4,
            md: 8,
            lg: 12,
            xl: 16,
            full: 9999
        };
        
        // Shadows
        this.shadows = {
            none: 'none',
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
        };
        
        // Breakpoints for responsive design
        this.breakpoints = {
            xs: 0,
            sm: 576,
            md: 768,
            lg: 992,
            xl: 1200,
            '2xl': 1400
        };
        
        // Z-index layers
        this.zIndex = {
            background: -1,
            base: 0,
            elevated: 10,
            sticky: 100,
            overlay: 1000,
            modal: 10000,
            popover: 100000,
            tooltip: 1000000
        };
        
        // Animation durations
        this.animation = {
            duration: {
                instant: 0,
                fast: 150,
                normal: 300,
                slow: 500,
                slower: 1000
            },
            
            easing: {
                linear: 'linear',
                easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
                easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
                easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }
        };
        
        // Current viewport info
        this.viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            breakpoint: this.getCurrentBreakpoint()
        };
        
        // Dark mode state
        this.isDarkMode = false;
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the theme system
     */
    initialize() {
        // Set up viewport listener
        this.setupViewportListener();
        
        // Check for dark mode preference
        this.checkDarkModePreference();
        
        // Apply base styles
        this.applyBaseStyles();
        
        // Apply Space-Mythic theme if Kid Mode is active
        this.checkSpaceMythicTheme();
        
        console.log('ui:info [UITheme] Theme system initialized with Space-Mythic support');
    }
    
    /**
     * Set up viewport size listener
     */
    setupViewportListener() {
        let resizeTimer;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.viewport.width = window.innerWidth;
                this.viewport.height = window.innerHeight;
                this.viewport.breakpoint = this.getCurrentBreakpoint();
                
                // Emit resize event
                if (window.mythicalGame) {
                    window.mythicalGame.events.emit('viewport-resize', this.viewport);
                }
            }, 100);
        });
    }
    
    /**
     * Check user's dark mode preference
     */
    checkDarkModePreference() {
        // Check localStorage
        const savedPreference = localStorage.getItem('darkMode');
        if (savedPreference !== null) {
            this.isDarkMode = savedPreference === 'true';
            return;
        }
        
        // Check system preference
        if (window.matchMedia) {
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    }
    
    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode.toString());
        this.applyDarkMode();
        
        // Emit event
        if (window.mythicalGame) {
            window.mythicalGame.events.emit('theme-change', { darkMode: this.isDarkMode });
        }
    }
    
    /**
     * Check if Space-Mythic theme should be applied
     */
    checkSpaceMythicTheme() {
        if (window.KidMode && window.KidMode.isKidMode()) {
            this.applySpaceMythicTheme();
        }
    }
    
    /**
     * Apply Space-Mythic theme styling
     */
    applySpaceMythicTheme() {
        document.body.classList.add('space-mythic', 'kid-mode');
        
        // Create glassmorphism CSS
        this.injectSpaceMythicStyles();
        
        console.log('ui:info [UITheme] Space-Mythic theme applied');
        
        // Emit theme change event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('ui/theme_changed', { 
                theme: 'spaceMythic',
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Remove Space-Mythic theme styling
     */
    removeSpaceMythicTheme() {
        document.body.classList.remove('space-mythic', 'kid-mode');
        
        const existingStyles = document.getElementById('space-mythic-styles');
        if (existingStyles) {
            existingStyles.remove();
        }
        
        console.log('ui:info [UITheme] Space-Mythic theme removed');
    }
    
    /**
     * Inject Space-Mythic CSS styles
     */
    injectSpaceMythicStyles() {
        if (document.getElementById('space-mythic-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'space-mythic-styles';
        style.textContent = `
            /* Space-Mythic Theme Styles */
            body.space-mythic {
                background: #0a0118;
                min-height: 100vh;
                position: relative;
                overflow: hidden;
            }

            body.space-mythic::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background:
                    radial-gradient(circle at 20% 30%, rgba(138,43,226,0.08) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(75,0,130,0.06) 0%, transparent 50%);
                pointer-events: none;
                z-index: -1;
            }
            
            /* Glassmorphism effects */
            .space-mythic .glass-panel {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            }
            
            .space-mythic .glass-button {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(8px);
                border: 2px solid rgba(255, 215, 0, 0.6);
                border-radius: 16px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                position: relative;
            }
            
            .space-mythic .glass-button:hover {
                background: rgba(255, 255, 255, 0.25);
                border-color: rgba(255, 215, 0, 0.8);
                transform: translateY(-2px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
            }
            
            .space-mythic .glass-button:active {
                transform: translateY(0);
                background: rgba(255, 255, 255, 0.1);
            }
            
            /* Floating stardust animation */
            .space-mythic .stardust {
                position: fixed;
                width: 2px;
                height: 2px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 50%;
                animation: float 8s infinite linear;
                pointer-events: none;
            }
            
            @keyframes float {
                0% {
                    transform: translateY(100vh) translateX(0);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(-10vh) translateX(20px);
                    opacity: 0;
                }
            }
            
            /* Text styling for space theme */
            .space-mythic .cosmic-text {
                color: hsl(45,90%,64%);
                text-shadow: 
                    0 0 10px rgba(255, 215, 0, 0.3),
                    0 0 20px rgba(255, 215, 0, 0.1);
                font-weight: bold;
            }
            
            .space-mythic .stellar-text {
                color: hsl(0,0%,95%);
                text-shadow: 
                    0 1px 0 hsl(240,25%,24%),
                    0 0 8px rgba(255, 255, 255, 0.2);
            }
            
            /* Kid Mode enhancements */
            body.kid-mode.space-mythic button,
            body.kid-mode.space-mythic .interactive {
                min-width: 64px;
                min-height: 64px;
                font-size: 19px;
                padding: 13px;
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .space-mythic .stardust {
                    animation: none;
                }
                
                .space-mythic .glass-button {
                    transition: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Apply dark mode styles
     */
    applyDarkMode() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            
            // Swap colors for dark mode
            this.colors.background = {
                light: '#1A1A1A',
                dark: '#000000',
                overlay: 'rgba(255, 255, 255, 0.1)',
                glass: 'rgba(0, 0, 0, 0.3)'
            };
            
            this.colors.text = {
                primary: '#F8F9FA',
                secondary: '#ADB5BD',
                light: '#FFFFFF',
                dark: '#212529',
                muted: '#6C757D'
            };
        } else {
            document.body.classList.remove('dark-mode');
            
            // Reset to light mode colors
            this.colors.background = {
                light: '#F0F8FF',
                dark: '#2C2C2C',
                overlay: 'rgba(0, 0, 0, 0.5)',
                glass: 'rgba(255, 255, 255, 0.1)'
            };
            
            this.colors.text = {
                primary: '#212529',
                secondary: '#6C757D',
                light: '#FFFFFF',
                dark: '#000000',
                muted: '#ADB5BD'
            };
        }
    }
    
    /**
     * Get current breakpoint
     */
    getCurrentBreakpoint() {
        const width = window.innerWidth;
        
        if (width >= this.breakpoints['2xl']) return '2xl';
        if (width >= this.breakpoints.xl) return 'xl';
        if (width >= this.breakpoints.lg) return 'lg';
        if (width >= this.breakpoints.md) return 'md';
        if (width >= this.breakpoints.sm) return 'sm';
        return 'xs';
    }
    
    /**
     * Check if viewport is at least the specified breakpoint
     */
    isBreakpoint(breakpoint) {
        return window.innerWidth >= this.breakpoints[breakpoint];
    }
    
    /**
     * Get responsive value based on breakpoint
     */
    getResponsiveValue(values) {
        const breakpoint = this.getCurrentBreakpoint();
        
        // If object with breakpoint keys
        if (typeof values === 'object' && !Array.isArray(values)) {
            return values[breakpoint] || values.base || values;
        }
        
        // If array [xs, sm, md, lg, xl, 2xl]
        if (Array.isArray(values)) {
            const breakpointIndex = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].indexOf(breakpoint);
            return values[breakpointIndex] || values[0];
        }
        
        return values;
    }
    
    /**
     * Get Phaser text style configuration
     */
    getTextStyle(preset = 'body', overrides = {}) {
        const presets = {
            heading1: {
                fontFamily: this.typography.fontFamily.heading,
                fontSize: this.getResponsiveValue([24, 28, 32, 36, 40, 48]),
                fontStyle: 'bold',
                color: this.isDarkMode ? '#FFFFFF' : '#212529'
            },
            
            heading2: {
                fontFamily: this.typography.fontFamily.heading,
                fontSize: this.getResponsiveValue([20, 24, 28, 32, 36, 40]),
                fontStyle: 'bold',
                color: this.isDarkMode ? '#FFFFFF' : '#212529'
            },
            
            heading3: {
                fontFamily: this.typography.fontFamily.base,
                fontSize: this.getResponsiveValue([18, 20, 24, 28, 32, 36]),
                fontStyle: 'bold',
                color: this.isDarkMode ? '#F8F9FA' : '#343A40'
            },
            
            body: {
                fontFamily: this.typography.fontFamily.base,
                fontSize: this.getResponsiveValue([14, 14, 16, 16, 18, 18]),
                color: this.isDarkMode ? '#E9ECEF' : '#495057'
            },
            
            small: {
                fontFamily: this.typography.fontFamily.base,
                fontSize: this.getResponsiveValue([12, 12, 14, 14, 14, 16]),
                color: this.isDarkMode ? '#ADB5BD' : '#6C757D'
            },
            
            button: {
                fontFamily: this.typography.fontFamily.base,
                fontSize: this.getResponsiveValue([14, 14, 16, 16, 16, 18]),
                fontStyle: 'bold',
                color: '#FFFFFF'
            },
            
            stat: {
                fontFamily: this.typography.fontFamily.mono,
                fontSize: this.getResponsiveValue([12, 12, 14, 14, 14, 14]),
                color: this.isDarkMode ? '#FFD700' : '#4B0082'
            }
        };
        
        const baseStyle = presets[preset] || presets.body;
        
        // Convert to Phaser format and apply overrides
        return {
            fontFamily: overrides.fontFamily || baseStyle.fontFamily,
            fontSize: `${overrides.fontSize || baseStyle.fontSize}px`,
            fontStyle: overrides.fontStyle || baseStyle.fontStyle || 'normal',
            color: overrides.color || baseStyle.color,
            stroke: overrides.stroke || (this.isDarkMode ? '#000000' : '#FFFFFF'),
            strokeThickness: overrides.strokeThickness !== undefined ? overrides.strokeThickness : 1,
            align: overrides.align || 'left',
            backgroundColor: overrides.backgroundColor || 'transparent',
            padding: overrides.padding || { x: 8, y: 4 },
            wordWrap: overrides.wordWrap || { width: 0, useAdvancedWrap: true }
        };
    }
    
    /**
     * Apply base styles to document
     */
    applyBaseStyles() {
        if (document.getElementById('ui-theme-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ui-theme-styles';
        style.textContent = `
            * {
                box-sizing: border-box;
            }
            
            body {
                font-family: ${this.typography.fontFamily.base};
                font-size: ${this.typography.fontSize.base}px;
                line-height: ${this.typography.lineHeight.normal};
                color: ${this.colors.text.primary};
                background-color: ${this.colors.background.light};
                margin: 0;
                padding: 0;
                transition: background-color ${this.animation.duration.normal}ms ${this.animation.easing.easeInOut},
                            color ${this.animation.duration.normal}ms ${this.animation.easing.easeInOut};
            }
            
            body.dark-mode {
                background-color: ${this.colors.background.dark};
                color: ${this.colors.text.light};
            }
            
            canvas {
                image-rendering: -webkit-optimize-contrast;
                image-rendering: crisp-edges;
                image-rendering: pixelated;
            }
            
            /* Accessibility */
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                    scroll-behavior: auto !important;
                }
            }
            
            /* Focus styles */
            *:focus-visible {
                outline: 2px solid ${this.colors.primary};
                outline-offset: 2px;
            }
            
            /* Responsive text */
            @media (max-width: ${this.breakpoints.sm}px) {
                body { font-size: ${this.typography.fontSize.sm}px; }
            }
            
            @media (min-width: ${this.breakpoints.lg}px) {
                body { font-size: ${this.typography.fontSize.lg}px; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Get color with opacity
     */
    getColorWithOpacity(color, opacity) {
        // Convert hex to rgba
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    /**
     * Convert hex color to Phaser number format
     */
    hexToNumber(hex) {
        return parseInt(hex.replace('#', '0x'));
    }

    /**
     * Get Space-Mythic text style configuration
     * @param {string} variant - Style variant (cosmic, stellar, ethereal)
     * @param {string} size - Font size key (xs, sm, base, etc.)
     * @param {Object} overrides - Style overrides
     * @returns {Object} Phaser text style configuration
     */
    getSpaceMythicTextStyle(variant = 'cosmic', size = 'base', overrides = {}) {
        const isKidMode = window.KidMode && window.KidMode.isKidMode();
        const fontSize = isKidMode ? this.kidMode.fontSize[size] : this.typography.fontSize[size];
        
        const variants = {
            cosmic: {
                color: this.colors.spaceMythic.starGold,
                stroke: this.colors.spaceMythic.deepInk,
                strokeThickness: 2,
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: 'rgba(255,215,0,0.3)',
                    blur: 8,
                    stroke: true,
                    fill: false
                }
            },
            stellar: {
                color: this.colors.spaceMythic.stellarWhite,
                stroke: this.colors.spaceMythic.voidDark,
                strokeThickness: 1,
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: 'rgba(255,255,255,0.2)',
                    blur: 4
                }
            },
            ethereal: {
                color: this.colors.spaceMythic.crystalLilac,
                stroke: this.colors.spaceMythic.deepInk,
                strokeThickness: 1
            }
        };
        
        const variantStyle = variants[variant] || variants.cosmic;
        
        return {
            fontSize: `${fontSize}px`,
            fontFamily: this.typography.fontFamily.base,
            fontStyle: 'bold',
            align: 'center',
            ...variantStyle,
            ...overrides
        };
    }
    
    /**
     * Get Kid Mode text style configuration (legacy support)
     * @param {string} size - Font size key (xs, sm, base, etc.)
     * @param {Object} overrides - Style overrides
     * @returns {Object} Phaser text style configuration
     */
    getKidModeTextStyle(size = 'base', overrides = {}) {
        // Use Space-Mythic styling if Kid Mode is active
        if (window.KidMode && window.KidMode.isKidMode()) {
            return this.getSpaceMythicTextStyle('cosmic', size, overrides);
        }
        
        const fontSize = this.typography.fontSize[size];
        
        return {
            fontSize: `${fontSize}px`,
            fontFamily: this.typography.fontFamily.base,
            color: this.colors.kidMode.text,
            fontStyle: 'bold',
            align: 'center',
            ...overrides
        };
    }

    /**
     * Get Space-Mythic button style configuration
     * @param {string} type - Button type (primary, secondary, ethereal)
     * @param {Object} overrides - Style overrides
     * @returns {Object} Button style configuration
     */
    getSpaceMythicButtonStyle(type = 'primary', overrides = {}) {
        const isKidMode = window.KidMode && window.KidMode.isKidMode();
        
        const types = {
            primary: {
                backgroundColor: this.colors.spaceMythic.starGold,
                borderColor: this.colors.spaceMythic.starGold,
                textColor: this.colors.spaceMythic.deepInk
            },
            secondary: {
                backgroundColor: this.colors.spaceMythic.auroraTeal,
                borderColor: this.colors.spaceMythic.auroraTeal,
                textColor: this.colors.spaceMythic.deepInk
            },
            ethereal: {
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderColor: this.colors.spaceMythic.crystalLilac,
                textColor: this.colors.spaceMythic.stellarWhite
            }
        };
        
        const buttonType = types[type] || types.primary;
        
        return {
            width: isKidMode ? this.kidMode.hitboxMin : 48,
            height: isKidMode ? this.kidMode.hitboxMin * 0.75 : 36,
            backgroundColor: buttonType.backgroundColor,
            borderColor: buttonType.borderColor,
            borderRadius: 16,
            fontSize: isKidMode ? this.kidMode.fontSize.base : this.typography.fontSize.base,
            padding: isKidMode ? this.kidMode.spacing.base : this.spacing.sm,
            textColor: buttonType.textColor,
            glassmorphism: type === 'ethereal',
            ...overrides
        };
    }
    
    /**
     * Get Kid Mode button style configuration (legacy support)
     * @param {boolean} isPrimary - Whether this is a primary button
     * @param {Object} overrides - Style overrides
     * @returns {Object} Button style configuration
     */
    getKidModeButtonStyle(isPrimary = false, overrides = {}) {
        // Use Space-Mythic styling if Kid Mode is active
        if (window.KidMode && window.KidMode.isKidMode()) {
            return this.getSpaceMythicButtonStyle(isPrimary ? 'primary' : 'secondary', overrides);
        }
        
        return {
            width: 48,
            height: 36,
            backgroundColor: isPrimary ? this.colors.kidMode.primary : this.colors.kidMode.secondary,
            borderRadius: this.kidMode.buttonRadius,
            fontSize: this.typography.fontSize.base,
            padding: this.spacing.sm,
            ...overrides
        };
    }

    /**
     * Get responsive sizing based on Kid Mode state
     * @param {string} property - Property to scale (fontSize, padding, etc.)
     * @param {string} size - Size key
     * @returns {number} Scaled value
     */
    getKidModeSize(property, size) {
        const isKidMode = window.KidMode && window.KidMode.isKidMode();
        
        if (isKidMode && this.kidMode[property] && this.kidMode[property][size]) {
            return this.kidMode[property][size];
        }
        
        return this[property] && this[property][size] ? this[property][size] : 16;
    }
    
    /**
     * Convert HSL string to hex number for Phaser
     * @param {string} hslString - HSL color string
     * @returns {number} Hex color number
     */
    hslToHex(hslString) {
        // Enhanced conversion for Space-Mythic colors
        const hslMap = {
            'hsl(45,90%,64%)': 0xFFD54F,   // Star Gold
            'hsl(180,60%,68%)': 0x80CBC4,  // Aurora Teal
            'hsl(265,55%,78%)': 0xB39DDB,  // Crystal Lilac
            'hsl(240,25%,24%)': 0x37474F,  // Deep Ink
            'hsl(120,65%,70%)': 0x81C784,  // Cosmic Green
            'hsl(30,85%,68%)': 0xFFB74D,   // Asteroid Orange
            'hsl(0,75%,72%)': 0xF48FB1,    // Nebula Red
            'hsl(210,75%,70%)': 0x64B5F6,  // Comet Blue
            'hsl(330,85%,72%)': 0xF48FB1,  // Nebula Pink
            'hsl(0,0%,95%)': 0xF5F5F5,     // Stellar White
            'hsl(240,30%,15%)': 0x263238   // Void Dark
        };
        
        return hslMap[hslString] || 0xFFFFFF;
    }
    
    /**
     * Get Space-Mythic color palette
     * @returns {Object} Color palette object
     */
    getSpaceMythicPalette() {
        return {
            starGold: this.hslToHex(this.colors.spaceMythic.starGold),
            auroraTeal: this.hslToHex(this.colors.spaceMythic.auroraTeal),
            crystalLilac: this.hslToHex(this.colors.spaceMythic.crystalLilac),
            deepInk: this.hslToHex(this.colors.spaceMythic.deepInk),
            cosmicGreen: this.hslToHex(this.colors.spaceMythic.cosmicGreen),
            asteroidOrange: this.hslToHex(this.colors.spaceMythic.asteroidOrange),
            nebulaRed: this.hslToHex(this.colors.spaceMythic.nebulaRed),
            cometBlue: this.hslToHex(this.colors.spaceMythic.cometBlue),
            nebulaPink: this.hslToHex(this.colors.spaceMythic.nebulaPink),
            stellarWhite: this.hslToHex(this.colors.spaceMythic.stellarWhite),
            voidDark: this.hslToHex(this.colors.spaceMythic.voidDark)
        };
    }
}

// Create global instance
window.UITheme = new UITheme();
