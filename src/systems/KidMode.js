const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * KidMode - Child-friendly UI system for ages 8+
 * Provides larger touch targets, contextual guidance, and simplified space-themed interactions
 */

class KidModeManager {
    constructor() {
        this.enabled = false;
        this.config = null;
        this.emotionActionMap = {
            hungry: { 
                action: 'feed', 
                icon: '🍎', 
                text: 'FEED', 
                message: "Your cosmic friend needs stardust nutrients!",
                color: 'hsl(15,85%,68%)'
            },
            sleepy: { 
                action: 'rest', 
                icon: '🌙', 
                text: 'REST', 
                message: "Time for a peaceful nebula nap!",
                color: 'hsl(210,75%,70%)'
            },
            bored: { 
                action: 'play', 
                icon: '🎈', 
                text: 'PLAY', 
                message: "Let's explore the crystal gardens together!",
                color: 'hsl(45,90%,64%)'
            },
            excited: { 
                action: 'photo', 
                icon: '📸', 
                text: 'PHOTO', 
                message: "Capture this magical space moment!",
                color: 'hsl(330,85%,72%)'
            },
            dirty: { 
                action: 'clean', 
                icon: '🫧', 
                text: 'CLEAN', 
                message: "Aurora shower time for your friend!",
                color: 'hsl(180,60%,68%)'
            },
            default: { 
                action: 'pet', 
                icon: '🤗', 
                text: 'PET', 
                message: "Give your stellar companion some love!",
                color: 'hsl(265,55%,78%)'
            }
        };
    }

    /**
     * Initialize Kid Mode system
     * @param {Object} config - Configuration object from kid-mode.json
     */
    initialize(config = null) {
        this.config = config || this.getDefaultConfig();

        // Check for URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('kid') === '1') {
            this.enableKidMode();
        }

        console.log('ui:info [KidMode] Space-Mythic Kid Mode system initialized', { config: this.config });
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            fontScale: 1.2,
            paddingScale: 1.3,
            hitboxMin: 64,
            emojiFallbacks: true,
            animationDuration: 100,
            buttonRadius: 16,
            glowIntensity: 0.3,
            colors: {
                primary: 'hsl(45,90%,64%)',      // Star Gold
                secondary: 'hsl(180,60%,68%)',   // Aurora Teal  
                background: 'hsl(265,55%,78%)',  // Crystal Lilac
                text: 'hsl(240,25%,24%)',        // Deep Ink
                success: 'hsl(120,65%,70%)',     // Cosmic Green
                warning: 'hsl(30,85%,68%)',      // Asteroid Orange
                danger: 'hsl(0,75%,72%)'         // Nebula Red
            }
        };
    }

    /**
     * Enable Kid Mode - Space-themed version
     */
    enableKidMode() {
        if (this.enabled) return;
        
        this.enabled = true;
        
        // Add CSS class with space theme
        if (typeof document !== 'undefined') {
            document.body.classList.add('kid-mode', 'space-mythic');
        }

        // Emit event for other systems
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('ui/kidmode_toggled', { enabled: true, theme: 'spaceMythic' });
            window.GameState.set('ui.kidMode', true);
            window.GameState.set('ui.theme', 'spaceMythic');
        }

        console.log('ui:info [KidMode] Space-Mythic Kid Mode enabled - stellar UI active!');
    }

    /**
     * Disable Kid Mode
     */
    disableKidMode() {
        if (!this.enabled) return;
        
        this.enabled = false;
        
        if (typeof document !== 'undefined') {
            document.body.classList.remove('kid-mode', 'space-mythic');
        }

        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('ui/kidmode_toggled', { enabled: false });
            window.GameState.set('ui.kidMode', false);
        }

        console.log('ui:info [KidMode] Kid Mode disabled - standard UI restored');
    }

    /**
     * Check if Kid Mode is enabled
     */
    isKidMode() {
        return this.enabled;
    }

    /**
     * Get the best next action based on creature emotion/state and genetics
     * @param {string} emotion - Current creature emotional state
     * @param {Object} genetics - Creature genetics data (optional)
     * @returns {Object} Action object with space-themed messaging
     */
    getNextBestAction(emotion, genetics = null) {
        // Use genetics-based suggestions if available
        if (genetics && genetics.personality) {
            return this.getGeneticsBasedAction(emotion, genetics);
        }
        
        // Fallback to emotion-based suggestions
        return this.getEmotionBasedAction(emotion);
    }

    /**
     * Get action suggestion based on creature genetics and personality
     */
    getGeneticsBasedAction(emotion, genetics) {
        const personality = genetics.personality;
        const carePrefs = personality.carePreferences || {};
        
        // Get base action from emotion
        const baseAction = this.getEmotionBasedAction(emotion);
        
        // Find preferred activities based on personality
        const topPreferences = Object.entries(carePrefs)
            .filter(([_, value]) => value > 1.0)
            .sort((a, b) => b[1] - a[1]);
        
        // If creature has strong preferences, suggest those with personality context
        if (topPreferences.length > 0) {
            const [preferredAction, preference] = topPreferences[0];
            const actionData = this.getPersonalizedActionData(preferredAction, personality, genetics);
            
            if (actionData) {
                console.log(`ui:debug [KidMode] Genetics-based suggestion: ${preferredAction} (preference: ${preference.toFixed(2)})`);
                return {
                    ...actionData,
                    emotion: emotion,
                    personalityBased: true,
                    preferenceStrength: preference
                };
            }
        }
        
        // Enhance base action with personality context
        return this.enhanceActionWithPersonality(baseAction, personality, genetics);
    }

    /**
     * Get traditional emotion-based action
     */
    getEmotionBasedAction(emotion) {
        const normalizedEmotion = (emotion || 'default').toLowerCase();
        const actionData = this.emotionActionMap[normalizedEmotion] || this.emotionActionMap.default;
        
        return {
            action: actionData.action,
            icon: actionData.icon,
            text: actionData.text,
            message: actionData.message,
            color: actionData.color,
            emotion: normalizedEmotion
        };
    }

    /**
     * Get personalized action data based on care preference and personality
     */
    getPersonalizedActionData(action, personality, genetics) {
        const personalizedActions = {
            feed: {
                action: 'feed',
                icon: '🍎',
                text: 'FEED',
                messages: {
                    curious: `Your curious ${genetics.species} loves discovering new cosmic flavors!`,
                    playful: `Feed your energetic ${genetics.species} some stellar treats!`,
                    gentle: `Your gentle ${genetics.species} enjoys peaceful meals with stardust`,
                    wise: `Nourish your wise ${genetics.species} with ancient cosmic knowledge`,
                    energetic: `Power up your energetic ${genetics.species} with nebula nutrients!`
                },
                color: 'hsl(15,85%,68%)'
            },
            play: {
                action: 'play',
                icon: '🎈',
                text: 'PLAY',
                messages: {
                    curious: `Explore crystal formations with your inquisitive ${genetics.species}!`,
                    playful: `Dance through the nebula clouds with your joyful companion!`,
                    gentle: `Enjoy gentle float-games with your peaceful ${genetics.species}`,
                    wise: `Share constellation wisdom through playful learning!`,
                    energetic: `Race through asteroid fields with your speedy friend!`
                },
                color: 'hsl(45,90%,64%)'
            },
            pet: {
                action: 'pet',
                icon: '🤗',
                text: 'PET',
                messages: {
                    curious: `Your ${genetics.species} loves gentle touches while exploring!`,
                    playful: `Tickle and cuddle your joyful space companion!`,
                    gentle: `Soothe your peaceful ${genetics.species} with loving pets`,
                    wise: `Share quiet moments of connection with your sage friend`,
                    energetic: `Give quick loving pets to your active ${genetics.species}!`
                },
                color: 'hsl(265,55%,78%)'
            },
            rest: {
                action: 'rest',
                icon: '🌙',
                text: 'REST',
                messages: {
                    curious: `Dream of new worlds to explore, dear ${genetics.species}`,
                    playful: `Recharge for more cosmic adventures tomorrow!`,
                    gentle: `Peaceful nebula dreams for your calm ${genetics.species}`,
                    wise: `Meditate under the cosmic aurora with your sage friend`,
                    energetic: `Power down time for your active ${genetics.species}!`
                },
                color: 'hsl(210,75%,70%)'
            },
            photo: {
                action: 'photo',
                icon: '📸',
                text: 'PHOTO',
                messages: {
                    curious: `Capture your ${genetics.species}'s wonderful discoveries!`,
                    playful: `Snap fun photos of your joyful cosmic friend!`,
                    gentle: `Preserve peaceful moments with your serene ${genetics.species}`,
                    wise: `Document the wisdom of your ancient ${genetics.species}`,
                    energetic: `Catch action shots of your speedy ${genetics.species}!`
                },
                color: 'hsl(330,85%,72%)'
            },
            clean: {
                action: 'clean',
                icon: '🫧',
                text: 'CLEAN',
                messages: {
                    curious: `Aurora bubble bath exploration for your ${genetics.species}!`,
                    playful: `Splashy stardust cleaning fun with your friend!`,
                    gentle: `Gentle cosmic cleansing for your peaceful ${genetics.species}`,
                    wise: `Purifying ritual with your enlightened ${genetics.species}`,
                    energetic: `Quick cosmic shower for your active ${genetics.species}!`
                },
                color: 'hsl(180,60%,68%)'
            }
        };
        
        const actionInfo = personalizedActions[action];
        if (!actionInfo) return null;
        
        const personalityCore = personality.core || 'curious';
        const message = actionInfo.messages[personalityCore] || actionInfo.messages.curious;
        
        return {
            action: actionInfo.action,
            icon: actionInfo.icon,
            text: actionInfo.text,
            message: message,
            color: actionInfo.color
        };
    }

    /**
     * Enhance base action with personality context
     */
    enhanceActionWithPersonality(baseAction, personality, genetics) {
        const quirks = personality.quirks || [];
        const cosmicElement = genetics.cosmicAffinity?.element || 'star';
        
        // Add personality flair to the message
        let enhancedMessage = baseAction.message;
        
        // Add cosmic affinity context
        const cosmicContexts = {
            star: "under the warm stellar glow",
            moon: "in the gentle lunar light",
            nebula: "surrounded by colorful cosmic mists", 
            crystal: "among resonating crystal formations",
            void: "in the mysterious depths of space"
        };
        
        const cosmicContext = cosmicContexts[cosmicElement] || cosmicContexts.star;
        enhancedMessage = enhancedMessage.replace(/!$/, ` ${cosmicContext}!`);
        
        // Add quirk context if available
        if (quirks.length > 0) {
            const quirkHints = {
                head_tilter: "Notice how they tilt their head curiously!",
                star_gazer: "They love looking at distant stars!",
                bounce_dancer: "Watch them bounce with joy!",
                soft_hummer: "Listen to their gentle humming!",
                constellation_reader: "They see patterns in everything!"
            };
            
            const relevantQuirk = quirks.find(q => quirkHints[q]);
            if (relevantQuirk) {
                enhancedMessage += ` ${quirkHints[relevantQuirk]}`;
            }
        }
        
        return {
            ...baseAction,
            message: enhancedMessage,
            personalityEnhanced: true
        };
    }

    /**
     * Get secondary actions (excluding primary)
     */
    getSecondaryActions(primaryAction) {
        const secondaryActions = [];
        const primaryActionName = primaryAction?.toLowerCase();

        for (const [emotion, data] of Object.entries(this.emotionActionMap)) {
            if (emotion !== 'default' && data.action !== primaryActionName) {
                secondaryActions.push({
                    action: data.action,
                    icon: data.icon,
                    text: data.text.split(' ')[0],
                    emotion: emotion,
                    color: data.color
                });
            }
        }

        return secondaryActions.slice(0, 3);
    }

    /**
     * Create space-themed kid button with glassmorphism
     */
    createSpaceButton(scene, x, y, text, emoji, callback, options = {}) {
        const opts = {
            width: this.config.hitboxMin,
            height: this.config.hitboxMin * 0.75,
            primary: false,
            fontSize: 18 * this.config.fontScale,
            color: this.config.colors.primary,
            ...options
        };

        const button = scene.add.container(x, y);

        // Glassmorphism background with nebula glow
        const bg = scene.add.graphics();
        
        // Base glass effect
        bg.fillStyle(0xFFFFFF, 0.15);
        bg.fillRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, this.config.buttonRadius);
        
        // Nebula glow border
        bg.lineStyle(2, this.hexToNumber(opts.color), 0.8);
        bg.strokeRoundedRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, this.config.buttonRadius);
        
        // Inner highlight
        bg.lineStyle(1, 0xFFFFFF, 0.3);
        bg.strokeRoundedRect(-opts.width / 2 + 2, -opts.height / 2 + 2, opts.width - 4, opts.height - 4, this.config.buttonRadius - 2);

        // Text with space styling
        const displayText = this.config.emojiFallbacks ? `${emoji} ${text}` : text;
        const label = scene.add.text(0, 0, displayText, {
            fontSize: `${opts.fontSize}px`,
            fontFamily: 'Arial, sans-serif',
            color: opts.color,
            align: 'center',
            fontStyle: 'bold',
            stroke: 'hsl(240,25%,24%)',
            strokeThickness: 1
        }).setOrigin(0.5);

        button.add([bg, label]);
        button.setSize(opts.width, opts.height);
        button.setInteractive({ 
            cursor: 'pointer',
            useHandCursor: true
        });

        // Accessibility
        button.setData('ariaLabel', `${text} button - ${this.getActionDescription(text)}`);

        // Space-themed animations
        button.on('pointerdown', () => {
            scene.tweens.add({
                targets: button,
                scale: 0.95,
                duration: this.config.animationDuration / 2,
                yoyo: true,
                ease: 'Back.easeOut',
                onComplete: () => {
                    if (callback) callback();
                }
            });

            this.playSpaceSound(scene, 'cosmic_button');
            this.createStarBurst(scene, x, y);
        });

        // Hover glow effect
        button.on('pointerover', () => {
            scene.tweens.add({
                targets: bg,
                alpha: bg.alpha * 1.3,
                duration: this.config.animationDuration,
                ease: 'Power2'
            });
        });

        button.on('pointerout', () => {
            scene.tweens.add({
                targets: bg,
                alpha: bg.alpha / 1.3,
                duration: this.config.animationDuration,
                ease: 'Power2'
            });
        });

        return button;
    }

    /**
     * Create needs bar with space theming
     */
    createSpaceNeedBar(scene, x, y, need, value) {
        const needConfig = {
            hunger: { 
                icon: '🍎', 
                color: 'hsl(15,85%,68%)', 
                text: 'Cosmic Energy',
                description: 'Stardust nutrition level'
            },
            energy: { 
                icon: '🌙', 
                color: 'hsl(210,75%,70%)', 
                text: 'Nebula Rest',
                description: 'Space sleep quality' 
            },
            fun: { 
                icon: '🎈', 
                color: 'hsl(45,90%,64%)', 
                text: 'Stellar Joy',
                description: 'Cosmic happiness level'
            },
            hygiene: { 
                icon: '🫧', 
                color: 'hsl(180,60%,68%)', 
                text: 'Aurora Clean',
                description: 'Crystal cleanliness'
            }
        };

        const config = needConfig[need] || needConfig.hunger;
        const container = scene.add.container(x, y);

        // Glassmorphism bar background
        const bgBar = scene.add.graphics();
        bgBar.fillStyle(0x000000, 0.2);
        bgBar.fillRoundedRect(0, 0, 80, 10, 5);
        bgBar.lineStyle(1, 0xFFFFFF, 0.3);
        bgBar.strokeRoundedRect(0, 0, 80, 10, 5);

        // Fill bar with space gradient
        const fillBar = scene.add.graphics();
        const fillColor = this.hexToNumber(config.color);
        fillBar.fillStyle(fillColor, 0.9);
        const fillWidth = (value / 100) * 80;
        fillBar.fillRoundedRect(0, 0, fillWidth, 10, 5);

        // Glow effect on fill
        if (value > 0) {
            const glow = scene.add.graphics();
            glow.fillStyle(fillColor, 0.3);
            glow.fillRoundedRect(-2, -2, fillWidth + 4, 14, 7);
        }

        // Icon and text with accessibility
        const icon = scene.add.text(-15, 5, config.icon, {
            fontSize: '14px'
        }).setOrigin(0.5);

        const text = scene.add.text(40, -15, config.text, {
            fontSize: '11px',
            color: config.color,
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Accessibility data
        container.setData('ariaLabel', `${config.description}: ${value} percent`);
        container.setData('value', value);
        container.setData('maxValue', 100);
        container.setData('role', 'progressbar');

        container.add([bgBar, fillBar, icon, text]);
        return container;
    }

    /**
     * Create small starburst effect on button press
     */
    createStarBurst(scene, x, y, opts = {}) {
        if (!window.FXLibrary) return;
        
        window.FXLibrary.stardustBurst(scene, x, y, {
            count: 5,
            color: 0xFFD700,
            scale: 0.5,
            duration: 400,
            ...opts
        });
    }

    /**
     * Play space-themed sound effect
     */
    playSpaceSound(scene, soundKey) {
        try {
            if (scene.sound && scene.sound.play) {
                scene.sound.play(soundKey, { 
                    volume: 0.3,
                    rate: Phaser.Math.FloatBetween(0.9, 1.1) // Slight pitch variation
                });
            }
        } catch (error) {
            console.log(`ui:debug [KidMode] Space sound '${soundKey}' not available:`, error.message);
        }
    }

    /**
     * Show contextual space-themed help message
     */
    showSpaceHelpMessage(scene, message, duration = 3000) {
        const helpContainer = scene.add.container(scene.cameras.main.width / 2, 60);
        helpContainer.setScrollFactor(0);

        // Glassmorphism background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.3);
        bg.fillRoundedRect(-200, -25, 400, 50, 15);
        bg.lineStyle(2, 0x87CEEB, 0.6);
        bg.strokeRoundedRect(-200, -25, 400, 50, 15);

        const helpText = scene.add.text(0, 0, message, {
            fontSize: `${16 * this.config.fontScale}px`,
            color: 'hsl(45,90%,64%)',
            stroke: 'hsl(240,25%,24%)',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: 380 }
        }).setOrigin(0.5);

        helpContainer.add([bg, helpText]);

        // Accessibility
        helpContainer.setData('ariaLabel', message);
        helpContainer.setData('role', 'alert');

        // Gentle fade in
        helpContainer.setAlpha(0);
        scene.tweens.add({
            targets: helpContainer,
            alpha: 1,
            y: helpContainer.y + 10,
            duration: 300,
            ease: 'Power2'
        });

        // Auto-remove with fade out
        scene.time.delayedCall(duration, () => {
            scene.tweens.add({
                targets: helpContainer,
                alpha: 0,
                y: helpContainer.y - 10,
                duration: 300,
                ease: 'Power2',
                onComplete: () => helpContainer.destroy()
            });
        });

        return helpContainer;
    }

    /**
     * Get action description for accessibility
     */
    getActionDescription(action) {
        const descriptions = {
            'FEED': 'Provides cosmic nutrition to your space friend',
            'REST': 'Helps your companion sleep peacefully in the nebula',
            'PLAY': 'Explore the crystal gardens together',
            'PET': 'Give affection to your stellar companion',
            'CLEAN': 'Refresh with aurora shower particles',
            'PHOTO': 'Capture a beautiful moment with your friend'
        };
        return descriptions[action] || 'Interact with your space companion';
    }

    /**
     * Convert HSL color to Phaser hex number
     */
    hexToNumber(hslString) {
        // Simple conversion - in production would use proper HSL to RGB conversion
        const colorMap = {
            'hsl(330,85%,72%)': 0xF48FB1,  // Nebula Pink
            'hsl(180,60%,68%)': 0x80CBC4,  // Aurora Teal
            'hsl(45,90%,64%)': 0xFFD54F,   // Star Gold
            'hsl(210,75%,70%)': 0x64B5F6,  // Comet Blue
            'hsl(265,55%,78%)': 0xB39DDB,  // Crystal Lilac
            'hsl(240,25%,24%)': 0x37474F   // Deep Ink
        };
        return colorMap[hslString] || 0xFFFFFF;
    }

    /**
     * Get configuration value
     */
    getConfig(key) {
        return this.config ? this.config[key] : null;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('ui:debug [KidMode] Configuration updated', newConfig);
    }
}

// Create singleton instance
window.KidMode = window.KidMode || new KidModeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KidModeManager;
}
