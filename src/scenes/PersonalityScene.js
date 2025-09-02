/**
 * PersonalityScene - Reveals the creature's personality and traits after hatching
 * Features: personality display, genetics showcase, creature animation
 */

class PersonalityScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PersonalityScene' });
        this.revealed = false;
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        // Set current scene in GameState
        GameState.set('session.currentScene', 'PersonalityScene');

        // Initialize graphics engine
        this.graphicsEngine = new GraphicsEngine(this);

        // Create background
        this.createBackground();

        // Generate creature traits if not already done
        this.generateCreatureTraits();

        // Display the creature
        this.displayCreature();

        // Show personality reveal
        this.showPersonalityReveal();

        // Set up input handling
        this.setupInput();
    }

    createBackground() {
        // Create a magical gradient background
        const background = this.add.graphics();
        background.fillGradientStyle(0x4B0082, 0x4B0082, 0x9370DB, 0x9370DB, 1);
        background.fillRect(0, 0, 800, 600);

        // Add magical sparkles
        for (let i = 0; i < 20; i++) {
            const sparkle = this.add.graphics();
            sparkle.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
            sparkle.fillCircle(0, 0, Phaser.Math.Between(1, 3));
            sparkle.x = Phaser.Math.Between(50, 750);
            sparkle.y = Phaser.Math.Between(50, 550);

            // Twinkle animation
            this.tweens.add({
                targets: sparkle,
                alpha: { from: 0.2, to: 1 },
                scale: { from: 0.5, to: 1.5 },
                duration: Phaser.Math.Between(1000, 3000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 1000)
            });
        }
    }

    generateCreatureTraits() {
        const creatureData = GameState.get('creature');
        
        // Check if we have genetics from HatchingScene
        if (creatureData && creatureData.genetics) {
            console.log('personality:info [PersonalityScene] Using genetics from HatchingScene:', creatureData.genetics.id);
            this.creatureGenetics = creatureData.genetics;
        } else {
            console.warn('personality:warn [PersonalityScene] No genetics found, generating fallback');
            // Fallback: generate basic genetics if somehow missing
            if (window.CreatureGenetics) {
                this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics();
                GameState.set('creature.genetics', this.creatureGenetics);
            } else {
                // Final fallback to legacy system
                this.generateLegacyTraits(creatureData);
                return;
            }
        }

        // Update creature data with genetics info
        if (!creatureData.personality) {
            const geneticsPersonality = this.creatureGenetics.personality;
            const displayPersonality = {
                name: this.getPersonalityDisplayName(geneticsPersonality.core),
                description: geneticsPersonality.description,
                core: geneticsPersonality.core,
                quirks: geneticsPersonality.quirks,
                socialLevel: geneticsPersonality.socialLevel,
                cosmicAffinity: this.creatureGenetics.cosmicAffinity
            };
            
            creatureData.personality = displayPersonality;
            GameState.set('creature.personality', displayPersonality);
        }

        // Create legacy genes object for display compatibility
        if (!creatureData.genes) {
            creatureData.genes = this.convertGeneticsToLegacyGenes(this.creatureGenetics);
            GameState.set('creature.genes', creatureData.genes);
        }

        this.creatureData = GameState.get('creature');
    }

    generateLegacyTraits(creatureData) {
        // Legacy fallback system
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

    getPersonalityDisplayName(core) {
        const displayNames = {
            curious: 'Curious Explorer',
            playful: 'Playful Spirit',
            gentle: 'Gentle Soul',
            wise: 'Ancient Sage',
            energetic: 'Energetic Spark'
        };
        return displayNames[core] || 'Mysterious Being';
    }

    convertGeneticsToLegacyGenes(genetics) {
        if (!genetics) return null;

        // Map new genetics system to legacy display format
        const bodyShapeToSize = {
            'slender': 'small',
            'balanced': 'medium', 
            'sturdy': 'large',
            'fish': 'medium',
            'cyclops': 'large',
            'serpentine': 'medium'
        };

        const markingsToPattern = {
            'solid': 'solid',
            'striped': 'striped', 
            'spotted': 'spotted',
            'scales': 'scaled',
            'crystalline': 'crystalline'
        };

        const personalityToTemperament = {
            'curious': 'curious',
            'playful': 'playful',
            'gentle': 'gentle',
            'wise': 'wise',
            'energetic': 'energetic'
        };

        return {
            size: bodyShapeToSize[genetics.traits.bodyShape.type] || 'medium',
            pattern: markingsToPattern[genetics.traits.features.markings?.type] || 'solid',
            eyeColor: genetics.traits.colorGenome.eyeColor || 0x4169E1,
            temperament: personalityToTemperament[genetics.personality.core] || 'gentle',
            specialTrait: genetics.traits.features.specialFeatures?.length > 0 ? 
                genetics.traits.features.specialFeatures[0] : 'none'
        };
    }

    displayCreature() {
        let textureName = 'enhancedCreature0'; // Default fallback
        
        // Use genetics system if available
        if (this.creatureGenetics) {
            console.log('personality:info [PersonalityScene] Creating creature with genetics');
            const spriteResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(this.creatureGenetics, 0);
            textureName = spriteResult.textureName;
        } else if (this.creatureData && this.creatureData.colors) {
            // Legacy fallback
            console.log('personality:info [PersonalityScene] Using legacy creature rendering');
            this.graphicsEngine.createEnhancedCreature(
                this.creatureData.colors.body,
                this.creatureData.colors.head,
                this.creatureData.colors.wings,
                0,
                this.creatureData.genes
            );
        } else {
            // Final fallback - create a basic creature
            console.warn('personality:warn [PersonalityScene] Using basic fallback creature');
            this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, 0, null);
        }

        // Display the creature in center-left
        this.creature = this.add.image(200, 300, textureName);
        this.creature.setScale(2.0); // Make it bigger for the reveal
        this.creature.setAlpha(0); // Start invisible

        // Dramatic entrance animation
        this.tweens.add({
            targets: this.creature,
            alpha: 1,
            scale: 1.5,
            duration: 1500,
            ease: 'Back.easeOut',
            delay: 500
        });

        // Gentle breathing animation
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: this.creature,
                scaleY: 1.55,
                duration: 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });
    }

    showPersonalityReveal() {
        // Title appears first
        this.titleText = this.add.text(400, 80, '✨ Your Creature\'s Soul Revealed! ✨', {
            fontSize: '32px',
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.titleText.setAlpha(0);

        // Animate title
        this.tweens.add({
            targets: this.titleText,
            alpha: 1,
            y: this.titleText.y - 10,
            duration: 1000,
            ease: 'Power2',
            delay: 1000
        });

        // Create personality reveal panel
        this.time.delayedCall(2000, () => {
            this.createPersonalityPanel();
        });

        // Continue button appears last
        this.time.delayedCall(4000, () => {
            this.createContinueButton();
        });
    }

    createPersonalityPanel() {
        // Background panel with magical border
        const panelX = 350;
        const panelY = 150;
        const panelW = 400;
        const panelH = 350;

        this.panel = this.add.graphics();
        this.panel.fillStyle(0x000000, 0.8);
        this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
        
        // Magical border
        this.panel.lineStyle(4, 0xFFD700);
        this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
        
        // Inner border
        this.panel.lineStyle(2, 0xFF69B4);
        this.panel.strokeRoundedRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 15);

        this.panel.setAlpha(0);

        // Animate panel appearance
        this.tweens.add({
            targets: this.panel,
            alpha: 1,
            scaleX: { from: 0.8, to: 1 },
            scaleY: { from: 0.8, to: 1 },
            duration: 800,
            ease: 'Back.easeOut'
        });

        // Personality section
        this.personalityTitle = this.add.text(550, 180, '🌟 Personality 🌟', {
            fontSize: '24px',
            color: '#FFD700',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.personalityName = this.add.text(550, 220, this.creatureData.personality.name, {
            fontSize: '20px',
            color: '#FF69B4',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.personalityDesc = this.add.text(550, 250, this.creatureData.personality.description, {
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        // Genetics section
        this.geneticsTitle = this.add.text(550, 320, '🧬 Genetics 🧬', {
            fontSize: '20px',
            color: '#87CEEB',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        const genetics = this.creatureData.genes;
        const geneticsInfo = [
            `Size: ${genetics.size}`,
            `Pattern: ${genetics.pattern}`,
            `Temperament: ${genetics.temperament}`,
            genetics.specialTrait !== 'none' ? `Special: ${genetics.specialTrait.replace('_', ' ')}` : ''
        ].filter(text => text).join('\n');

        this.geneticsText = this.add.text(550, 365, geneticsInfo, {
            fontSize: '14px',
            color: '#E0E0E0',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        // Hide all text initially
        [this.personalityTitle, this.personalityName, this.personalityDesc, this.geneticsTitle, this.geneticsText].forEach(text => {
            text.setAlpha(0);
        });

        // Stagger text animations
        const textElements = [this.personalityTitle, this.personalityName, this.personalityDesc, this.geneticsTitle, this.geneticsText];
        textElements.forEach((text, index) => {
            this.tweens.add({
                targets: text,
                alpha: 1,
                x: text.x + 20,
                duration: 600,
                ease: 'Power2',
                delay: 200 + (index * 300)
            });
        });
    }

    createContinueButton() {
        // Continue button with magical styling
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x9370DB, 0.9);
        buttonBg.fillRoundedRect(300, 520, 200, 50, 15);
        buttonBg.lineStyle(3, 0xFFD700);
        buttonBg.strokeRoundedRect(300, 520, 200, 50, 15);

        const buttonText = this.add.text(400, 545, '💫 NAME YOUR CREATURE', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Make button interactive
        const buttonZone = this.add.zone(300, 520, 200, 50)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Button animations
        this.tweens.add({
            targets: [buttonBg, buttonText],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        buttonZone.on('pointerdown', () => {
            this.transitionToNaming();
        });

        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xBA55D3, 0.9);
            buttonBg.fillRoundedRect(300, 520, 200, 50, 15);
            buttonBg.lineStyle(3, 0xFFD700);
            buttonBg.strokeRoundedRect(300, 520, 200, 50, 15);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x9370DB, 0.9);
            buttonBg.fillRoundedRect(300, 520, 200, 50, 15);
            buttonBg.lineStyle(3, 0xFFD700);
            buttonBg.strokeRoundedRect(300, 520, 200, 50, 15);
        });

        // Start all elements as invisible
        [buttonBg, buttonText, buttonZone].forEach(element => {
            element.setAlpha(0);
        });

        // Animate button appearance
        this.tweens.add({
            targets: [buttonBg, buttonText],
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });
    }

    setupInput() {
        // Space key as alternative to button
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    transitionToNaming() {
        // Fade out effect
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, 800, 600);

        this.tweens.add({
            targets: fadeGraphics,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.scene.start('NamingScene');
            }
        });
    }

    update() {
        // Check for space key or enter key to continue
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            if (this.revealed) {
                this.transitionToNaming();
            }
        }

        // Mark as revealed after 4 seconds
        if (!this.revealed && this.time.now > 4000) {
            this.revealed = true;
        }
    }
}