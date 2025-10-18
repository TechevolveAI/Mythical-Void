/**
 * NamingScene - Scene for naming the creature and displaying its characteristics
 * Features: creature naming, genetics display, personality traits, transition to game world
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function requireGlobal(name) {
    if (typeof window === 'undefined' || !window[name]) {
        throw new Error(`${name} system not ready`);
    }
    return window[name];
}

function getGameState() {
    return requireGlobal('GameState');
}

function getGraphicsEngine() {
    return requireGlobal('GraphicsEngine');
}

class NamingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'NamingScene' });
        this.nameInput = '';
        this.maxNameLength = 20;
        this.cursorBlink = true;
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        const state = getGameState();

        // Set current scene in GameState
        state.set('session.currentScene', 'NamingScene');

        // Initialize graphics engine
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Create background
        this.createBackground();

        // Generate creature genetics and personality
        this.generateCreatureTraits();

        // Display the creature
        this.displayCreature();

        // Create UI elements
        this.createUI();

        // Set up input handling
        this.setupInput();

        // Create cursor blink timer
        this.createCursorBlink();
    }

    createBackground() {
        // MOBILE-RESPONSIVE background
        const { width, height } = this.scale;

        // Create a gentle gradient background
        const background = this.add.graphics();
        background.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xE0F6FF, 0xE0F6FF, 1);
        background.fillRect(0, 0, width, height);

        // Add some floating clouds (fewer on mobile)
        this.clouds = this.add.group();
        const cloudCount = width < 600 ? 2 : 3;
        for (let i = 0; i < cloudCount; i++) {
            // Create simple cloud graphics
            const cloudGraphics = this.add.graphics();
            cloudGraphics.fillStyle(0xFFFFFF, 0.8);
            cloudGraphics.fillCircle(0, 0, 25);
            cloudGraphics.fillCircle(20, -5, 30);
            cloudGraphics.fillCircle(40, 0, 25);
            cloudGraphics.fillCircle(25, 10, 20);

            const cloud = this.add.container(
                Phaser.Math.Between(width * 0.1, width * 0.9),
                Phaser.Math.Between(height * 0.05, height * 0.25)
            );
            cloud.add(cloudGraphics);
            cloud.setAlpha(0.6);
            this.clouds.add(cloud);

            // Gentle movement
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(-30, 30),
                duration: Phaser.Math.Between(8000, 12000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    generateCreatureTraits() {
        const state = getGameState();
        const creatureData = state.get('creature');

        if (!creatureData.genes) {
            creatureData.genes = {
                size: Phaser.Math.RND.pick(['small', 'medium', 'large']),
                pattern: Phaser.Math.RND.pick(['solid', 'striped', 'spotted']),
                eyeColor: Phaser.Math.RND.pick([0x4169E1, 0x228B22, 0x8B4513, 0x9370DB]),
                temperament: Phaser.Math.RND.pick(['gentle', 'playful', 'curious', 'wise']),
                specialTrait: Phaser.Math.RND.pick(['none', 'horns', 'crest', 'extra_fluffy'])
            };
            state.set('creature.genes', creatureData.genes);
        }

        if (!creatureData.personality) {
            const personalities = [
                { name: 'Gentle Spirit', description: 'Calm and nurturing, loves peaceful moments' },
                { name: 'Curious Explorer', description: 'Always eager to discover new things' },
                { name: 'Playful Friend', description: 'Energetic and loves to have fun' },
                { name: 'Wise Oracle', description: 'Thoughtful and observant of the world' }
            ];

            const personality = Phaser.Math.RND.pick(personalities);
            creatureData.personality = personality;
            state.set('creature.personality', personality);
        }

        this.creatureData = state.get('creature');
    }

    displayCreature() {
        const state = getGameState();
        const genetics = state.get('creature.genetics'); // Fixed: was 'creature.genes', should be 'creature.genetics'

        console.log('naming:debug [NamingScene] Loading creature genetics:', genetics);

        // Check if we have genetics from hatching
        if (genetics && genetics.id) {
            console.log('naming:info [NamingScene] Using genetics from hatching scene');

            // Use the same method as HatchingScene to create creature
            try {
                const creatureResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    genetics,
                    0 // frame 0
                );

                if (creatureResult && creatureResult.textureName) {
                    console.log('naming:info [NamingScene] Created creature texture:', creatureResult.textureName);

                    // MOBILE-RESPONSIVE creature positioning
                    // Mobile layout will reposition this later if needed
                    const { width, height } = this.scale;
                    const isMobile = width < 600;
                    const creatureX = isMobile ? width / 2 : 200;
                    const creatureY = isMobile ? height * 0.25 : 300;
                    const baseScale = isMobile ? Math.min(1.5, width / 300) : 1.5;

                    // Display the creature with the correct texture
                    this.creature = this.add.image(creatureX, creatureY, creatureResult.textureName);
                    this.creature.setScale(baseScale);

                    // Gentle breathing animation
                    this.tweens.add({
                        targets: this.creature,
                        scaleY: baseScale * 1.05,
                        duration: 2000,
                        ease: 'Sine.easeInOut',
                        yoyo: true,
                        repeat: -1
                    });

                    return;
                } else {
                    console.warn('naming:warn [NamingScene] Failed to create creature from genetics, using fallback');
                }
            } catch (error) {
                console.error('naming:error [NamingScene] Error creating creature:', error);
            }
        } else {
            console.warn('naming:warn [NamingScene] No genetics found in GameState');
        }

        // Fallback: Use default creature
        console.log('naming:info [NamingScene] Using default creature sprite');
        this.graphicsEngine.createEnhancedCreature(
            this.creatureData.colors.body,
            this.creatureData.colors.head,
            this.creatureData.colors.wings,
            0,
            this.creatureData.genes
        );

        const { width, height } = this.scale;
        const isMobile = width < 600;
        const creatureX = isMobile ? width / 2 : 200;
        const creatureY = isMobile ? height * 0.25 : 300;
        const baseScale = isMobile ? Math.min(1.5, width / 300) : 1.5;

        this.creature = this.add.image(creatureX, creatureY, 'enhancedCreature0');
        this.creature.setScale(baseScale);

        this.tweens.add({
            targets: this.creature,
            scaleY: baseScale * 1.05,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    createUI() {
        // MOBILE-RESPONSIVE UI with vertical stacking for mobile
        const { width, height } = this.scale;
        const centerX = width / 2;
        const isMobile = width < 600;

        // Responsive font sizes
        const titleSize = Math.max(20, Math.min(28, width * 0.065));
        const subtitleSize = Math.max(14, Math.min(16, width * 0.04));
        const instructionSize = Math.max(14, Math.min(18, width * 0.042));

        // Enhanced title with emoji
        this.titleText = this.add.text(centerX, height * 0.04, '🎉 Meet Your Magical Creature! 🎉', {
            fontSize: `${titleSize}px`,
            color: '#4B0082',
            stroke: '#FFFFFF',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Subtitle
        this.subtitleText = this.add.text(centerX, height * 0.09, 'Your creature has hatched! Now give it a special name.', {
            fontSize: `${subtitleSize}px`,
            color: '#2E8B57',
            stroke: '#FFFFFF',
            strokeThickness: 1,
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Reset button in top right
        this.createResetButton();

        if (isMobile) {
            // MOBILE LAYOUT: Stack vertically
            this.createMobileLayout();
        } else {
            // DESKTOP LAYOUT: Side-by-side
            this.createInfoPanel();
            this.createNamingSection();
        }

        // Enhanced instructions with better styling
        this.instructionText = this.add.text(centerX, height * 0.92, '✨ Press ENTER when ready to explore! ✨', {
            fontSize: `${instructionSize}px`,
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Control hints (hide on mobile to save space)
        if (!isMobile) {
            this.controlText = this.add.text(centerX, height * 0.97, '🎮 Type to name • Backspace to delete • ENTER to continue', {
                fontSize: '14px',
                color: '#666666',
                align: 'center'
            }).setOrigin(0.5);
        }
    }

    createResetButton() {
        // MOBILE-RESPONSIVE reset button in top right
        const { width, height } = this.scale;

        const buttonWidth = Math.min(100, width * 0.22);
        const buttonHeight = Math.min(35, height * 0.045);
        const buttonX = width - buttonWidth - (width * 0.03);
        const buttonY = height * 0.015;
        const fontSize = Math.max(12, Math.min(14, width * 0.035));

        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);

        // Reset button text
        const resetText = this.add.text(buttonX + buttonWidth/2, buttonY + buttonHeight/2, '🔄 RESET', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const resetButton = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Store dimensions for hover effects
        this.resetButtonDims = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });
    }

    resetGameData() {
        // Clear all game data and reload
        localStorage.removeItem('mythical-creature-save');
        console.log('🔄 Game data reset from naming scene');
        window.location.reload();
    }

    createMobileLayout() {
        // MOBILE VERTICAL STACK: Creature → Name Input → Info
        const { width, height } = this.scale;
        const centerX = width / 2;
        let currentY = height * 0.15; // Start below subtitle

        // Responsive font sizes for mobile
        const labelSize = Math.max(16, Math.min(18, width * 0.045));
        const bodySize = Math.max(13, Math.min(14, width * 0.036));
        const titleSize = Math.max(14, Math.min(16, width * 0.04));

        // Reposition creature to center (already created in displayCreature)
        if (this.creature) {
            this.creature.x = centerX;
            this.creature.y = currentY + (height * 0.12); // Give it some space
            const scale = Math.min(1.5, width / 300);
            this.creature.setScale(scale);
        }

        currentY += height * 0.25; // Move past creature

        // NAME INPUT SECTION
        const inputWidth = width * 0.8;
        const inputHeight = height * 0.06;
        const inputX = centerX - (inputWidth / 2);
        const inputY = currentY;

        // Name label
        this.add.text(centerX, inputY - (height * 0.03), 'Name your creature:', {
            fontSize: `${labelSize}px`,
            color: '#4B0082',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Name input background
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0xFFFFFF, 0.9);
        inputBg.fillRoundedRect(inputX, inputY, inputWidth, inputHeight, 8);
        inputBg.lineStyle(2, 0x4B0082);
        inputBg.strokeRoundedRect(inputX, inputY, inputWidth, inputHeight, 8);

        // ALWAYS start with blank name field
        this.nameInput = '';
        console.log('naming:info [NamingScene] Name field initialized as blank (mobile)');

        // Name input display
        this.nameText = this.add.text(centerX, inputY + (inputHeight / 2), '', {
            fontSize: `${bodySize}px`,
            color: '#333333'
        }).setOrigin(0.5);

        this.updateNameDisplay();

        currentY += inputHeight + (height * 0.05);

        // COMPACT INFO PANEL
        const panelWidth = width * 0.9;
        const panelHeight = height * 0.28;
        const panelX = centerX - (panelWidth / 2);
        const panelY = currentY;

        // Background panel
        const panelGraphics = this.add.graphics();
        panelGraphics.fillStyle(0xFFFFFF, 0.9);
        panelGraphics.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panelGraphics.lineStyle(3, 0x4B0082);
        panelGraphics.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);

        const contentX = panelX + (panelWidth * 0.05);
        let infoY = panelY + (panelHeight * 0.08);

        // Personality section
        this.add.text(contentX, infoY, 'Personality:', {
            fontSize: `${titleSize}px`,
            color: '#4B0082',
            fontStyle: 'bold'
        });
        infoY += titleSize * 1.3;

        this.add.text(contentX, infoY, this.creatureData.personality.name, {
            fontSize: `${bodySize}px`,
            color: '#2E8B57',
            fontStyle: 'bold'
        });
        infoY += bodySize * 1.5;

        this.add.text(contentX, infoY, this.creatureData.personality.description, {
            fontSize: `${bodySize - 1}px`,
            color: '#666666',
            wordWrap: { width: panelWidth * 0.9 }
        });
        infoY += (bodySize * 3); // Account for wrapped text

        // Genetics section (compact)
        this.add.text(contentX, infoY, 'Genetics:', {
            fontSize: `${titleSize}px`,
            color: '#4B0082',
            fontStyle: 'bold'
        });
        infoY += titleSize * 1.3;

        const genetics = this.creatureData.genes;
        const geneticsText = [
            `Size: ${genetics.size}`,
            `Pattern: ${genetics.pattern}`,
            `Mood: ${genetics.temperament}`
        ].join(' • '); // Use bullets to save space

        this.add.text(contentX, infoY, geneticsText, {
            fontSize: `${bodySize - 1}px`,
            color: '#666666',
            wordWrap: { width: panelWidth * 0.9 }
        });
    }

    createInfoPanel() {
        // Background panel
        const panelGraphics = this.add.graphics();
        panelGraphics.fillStyle(0xFFFFFF, 0.9);
        panelGraphics.fillRoundedRect(420, 120, 360, 280, 15);
        panelGraphics.lineStyle(3, 0x4B0082);
        panelGraphics.strokeRoundedRect(420, 120, 360, 280, 15);

        // Personality section
        this.add.text(440, 140, 'Personality:', {
            fontSize: '20px',
            color: '#4B0082',
            fontStyle: 'bold'
        });

        this.add.text(440, 170, this.creatureData.personality.name, {
            fontSize: '18px',
            color: '#2E8B57'
        });

        this.add.text(440, 195, this.creatureData.personality.description, {
            fontSize: '14px',
            color: '#666666',
            wordWrap: { width: 320 }
        });

        // Genetics section
        this.add.text(440, 240, 'Genetics:', {
            fontSize: '20px',
            color: '#4B0082',
            fontStyle: 'bold'
        });

        const genetics = this.creatureData.genes;
        const geneticsText = [
            `Size: ${genetics.size}`,
            `Pattern: ${genetics.pattern}`,
            `Temperament: ${genetics.temperament}`,
            genetics.specialTrait !== 'none' ? `Special: ${genetics.specialTrait}` : ''
        ].filter(text => text).join('\n');

        this.add.text(440, 265, geneticsText, {
            fontSize: '14px',
            color: '#666666',
            lineSpacing: 5
        });

        // Stats section
        this.add.text(440, 340, 'Stats:', {
            fontSize: '20px',
            color: '#4B0082',
            fontStyle: 'bold'
        });

        const stats = this.creatureData.stats;
        this.add.text(440, 365, `❤️ Health: ${stats.health} | 😊 Happiness: ${stats.happiness} | ⚡ Energy: ${stats.energy}`, {
            fontSize: '14px',
            color: '#666666'
        });
    }

    createNamingSection() {
        // Name input background
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0xFFFFFF, 0.9);
        inputBg.fillRoundedRect(300, 430, 200, 40, 8);
        inputBg.lineStyle(2, 0x4B0082);
        inputBg.strokeRoundedRect(300, 430, 200, 40, 8);

        // Name label
        this.add.text(400, 415, 'Name your creature:', {
            fontSize: '18px',
            color: '#4B0082',
            align: 'center'
        }).setOrigin(0.5);

        // ALWAYS start with blank name field
        // User must type a new name each time they reach this scene
        this.nameInput = '';
        console.log('naming:info [NamingScene] Name field initialized as blank');

        // Name input display
        this.nameText = this.add.text(410, 450, '', {
            fontSize: '16px',
            color: '#333333'
        }).setOrigin(0.5);

        this.updateNameDisplay();
    }

    setupInput() {
        // Set up keyboard input for naming
        this.input.keyboard.on('keydown', (event) => {
            if (event.key === 'Enter') {
                this.finalizeName();
            } else if (event.key === 'Backspace') {
                this.nameInput = this.nameInput.slice(0, -1);
                this.updateNameDisplay();
                this.validateName();
            } else if (event.key.length === 1 && this.nameInput.length < this.maxNameLength) {
                // Use input validator with safe fallback
                const testInput = this.nameInput + event.key;
                let validation;
                
                if (window.InputValidator && typeof window.InputValidator.validate === 'function') {
                    try {
                        validation = window.InputValidator.validate(testInput, 'username', { maxLength: this.maxNameLength });
                    } catch (validatorError) {
                        console.warn('InputValidator error, using fallback:', validatorError);
                        validation = this.fallbackValidation(testInput, event.key);
                    }
                } else {
                    validation = this.fallbackValidation(testInput, event.key);
                }
                
                if (validation.isValid) {
                    this.nameInput = validation.sanitized || testInput;
                    this.updateNameDisplay();
                    this.validateName();
                }
            }
        });
    }
    
    /**
     * Fallback validation when InputValidator is not available
     */
    fallbackValidation(testInput, key) {
        // Allow letters, numbers, spaces, and common punctuation
        const isValidChar = /[a-zA-Z0-9 \-_']/.test(key);
        const sanitized = testInput.replace(/[^a-zA-Z0-9 \-_']/g, '');
        
        return {
            isValid: isValidChar && testInput.length <= this.maxNameLength,
            sanitized: sanitized,
            errors: []
        };
    }
    
    validateName() {
        // Real-time validation feedback
        if (!window.InputValidator) return true;
        
        const validation = window.InputValidator.validate(this.nameInput, 'username', {
            minLength: 1,
            maxLength: this.maxNameLength
        });
        
        // Update visual feedback
        if (!this.validationText) {
            this.validationText = this.add.text(400, 475, '', {
                fontSize: '12px',
                color: '#FF0000',
                align: 'center'
            }).setOrigin(0.5);
        }
        
        if (!validation.isValid && this.nameInput.length > 0) {
            this.validationText.setText(validation.errors[0] || '');
            this.validationText.setColor('#FF0000');
        } else if (this.nameInput.length > 0) {
            this.validationText.setText('✓ Valid name');
            this.validationText.setColor('#00FF00');
        } else {
            this.validationText.setText('');
        }
        
        return validation.isValid;
    }

    createCursorBlink() {
        this.time.addEvent({
            delay: 500,
            callback: () => {
                this.cursorBlink = !this.cursorBlink;
                this.updateNameDisplay();
            },
            loop: true
        });
    }

    updateNameDisplay() {
        const displayName = this.nameInput || 'Enter name';
        const cursor = this.cursorBlink ? '|' : '';
        this.nameText.setText(displayName + cursor);
    }

    finalizeName() {
        if (this.nameInput.trim().length > 0) {
            getGameState().set('creature.name', this.nameInput.trim());
            this.transitionToGame();
        } else {
            // Show error message briefly
            const errorText = this.add.text(400, 480, 'Please enter a name!', {
                fontSize: '14px',
                color: '#FF0000'
            }).setOrigin(0.5);

            this.time.delayedCall(2000, () => {
                errorText.destroy();
            });
        }
    }

    transitionToGame() {
        // Stop all tweens before transition
        this.tweens.killAll();
        
        // Remove keyboard listeners
        this.input.keyboard.removeAllListeners();
        
        // Fade out effect
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, 800, 600);

        this.tweens.add({
            targets: fadeGraphics,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                // Use stop instead of start to properly clean up
                this.scene.stop('NamingScene');
                this.scene.start('GameScene');
            }
        });
    }

    update() {
        // Scene handled by input events
    }
}

export default NamingScene;

if (typeof window !== 'undefined') {
    window.NamingScene = NamingScene;
}
