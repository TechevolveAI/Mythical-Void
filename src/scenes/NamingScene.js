/**
 * NamingScene - Scene for naming the creature and displaying its characteristics
 * Features: creature naming, genetics display, personality traits, transition to game world
 */

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
        // Set current scene in GameState
        GameState.set('session.currentScene', 'NamingScene');

        // Initialize graphics engine
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
        // Create a gentle gradient background
        const background = this.add.graphics();
        background.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xE0F6FF, 0xE0F6FF, 1);
        background.fillRect(0, 0, 800, 600);

        // Add some floating clouds
        this.clouds = this.add.group();
        for (let i = 0; i < 3; i++) {
            // Create simple cloud graphics
            const cloudGraphics = this.add.graphics();
            cloudGraphics.fillStyle(0xFFFFFF, 0.8);
            cloudGraphics.fillCircle(0, 0, 25);
            cloudGraphics.fillCircle(20, -5, 30);
            cloudGraphics.fillCircle(40, 0, 25);
            cloudGraphics.fillCircle(25, 10, 20);
            
            const cloud = this.add.container(
                Phaser.Math.Between(100, 700),
                Phaser.Math.Between(50, 150)
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
        const creatureData = GameState.get('creature');
        
        // Generate genetics if not exists
        if (!creatureData.genes) {
            creatureData.genes = {
                size: Phaser.Math.RND.pick(['small', 'medium', 'large']),
                pattern: Phaser.Math.RND.pick(['solid', 'striped', 'spotted']),
                eyeColor: Phaser.Math.RND.pick([0x4169E1, 0x228B22, 0x8B4513, 0x9370DB]),
                temperament: Phaser.Math.RND.pick(['gentle', 'playful', 'curious', 'wise']),
                specialTrait: Phaser.Math.RND.pick(['none', 'horns', 'crest', 'extra_fluffy'])
            };
            GameState.set('creature.genes', creatureData.genes);
        }

        // Generate personality
        if (!creatureData.personality) {
            const personalities = [
                { name: 'Gentle Spirit', description: 'Calm and nurturing, loves peaceful moments' },
                { name: 'Curious Explorer', description: 'Always eager to discover new things' },
                { name: 'Playful Friend', description: 'Energetic and loves to have fun' },
                { name: 'Wise Oracle', description: 'Thoughtful and observant of the world' }
            ];
            
            const personality = Phaser.Math.RND.pick(personalities);
            creatureData.personality = personality;
            GameState.set('creature.personality', personality);
        }

        this.creatureData = GameState.get('creature');
    }

    displayCreature() {
        // Create enhanced creature sprite
        this.graphicsEngine.createEnhancedCreature(
            this.creatureData.colors.body,
            this.creatureData.colors.head,
            this.creatureData.colors.wings,
            0,
            this.creatureData.genes
        );

        // Display the creature
        this.creature = this.add.image(200, 300, 'enhancedCreature0');
        this.creature.setScale(1.5);

        // Gentle breathing animation
        this.tweens.add({
            targets: this.creature,
            scaleY: 1.55,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    createUI() {
        // Enhanced title with emoji
        this.titleText = this.add.text(400, 40, '🎉 Meet Your Magical Creature! 🎉', {
            fontSize: '28px',
            color: '#4B0082',
            stroke: '#FFFFFF',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.subtitleText = this.add.text(400, 75, 'Your creature has hatched! Now give it a special name.', {
            fontSize: '16px',
            color: '#2E8B57',
            stroke: '#FFFFFF',
            strokeThickness: 1,
            align: 'center'
        }).setOrigin(0.5);

        // Reset button in top right
        this.createResetButton();

        // Creature info panel
        this.createInfoPanel();

        // Naming section
        this.createNamingSection();

        // Enhanced instructions with better styling
        this.instructionText = this.add.text(400, 520, '✨ Press ENTER when ready to explore the magical world! ✨', {
            fontSize: '18px',
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Control hints
        this.controlText = this.add.text(400, 550, '🎮 Type to name • Backspace to delete • ENTER to continue', {
            fontSize: '14px',
            color: '#666666',
            align: 'center'
        }).setOrigin(0.5);
    }

    createResetButton() {
        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(680, 10, 100, 35, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(680, 10, 100, 35, 8);

        // Reset button text
        const resetText = this.add.text(730, 27, '🔄 RESET', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const resetButton = this.add.zone(680, 10, 100, 35)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(680, 10, 100, 35, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(680, 10, 100, 35, 8);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(680, 10, 100, 35, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(680, 10, 100, 35, 8);
        });
    }

    resetGameData() {
        // Clear all game data and reload
        localStorage.removeItem('mythical-creature-save');
        console.log('🔄 Game data reset from naming scene');
        window.location.reload();
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

        // Current name or default
        const currentName = this.creatureData.name;
        if (currentName && currentName !== 'Your Creature') {
            this.nameInput = currentName;
        }

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
            GameState.set('creature.name', this.nameInput.trim());
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