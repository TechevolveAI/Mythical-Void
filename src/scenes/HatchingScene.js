/**
 * HatchingScene - The first scene where the player clicks an egg to hatch their mythical creature
 * Features: floating egg animation, progressive hatching with color changes, sparkle effects
 */

class HatchingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HatchingScene' });
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null; // Store the generated genetics
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        console.log('🎬 HatchingScene.create() called');
        
        // Set current scene in GameState
        GameState.set('session.currentScene', 'HatchingScene');

        // Check game flow state
        const gameStarted = GameState.get('session.gameStarted') || false;
        const creatureHatched = GameState.get('creature.hatched') || false;
        const creatureName = GameState.get('creature.name');
        const creatureNamed = creatureName && creatureName !== 'Your Creature';

        // DEBUG: Log the COMPLETE current state
        console.log('🔍 HatchingScene.create() - FULL Game State Check:');
        console.log('  gameStarted:', gameStarted);
        console.log('  creatureHatched:', creatureHatched);
        console.log('  creatureName:', creatureName);
        console.log('  creatureNamed:', creatureNamed);
        console.log('  Full creature object:', GameState.get('creature'));
        console.log('  Full session object:', GameState.get('session'));

        // ⚠️ CRITICAL SECTION - DO NOT MODIFY - GAME FLOW LOGIC
        // This logic ensures the correct scene flow: Home → Hatch → Personality → Name → Game
        // See GAME_FLOW_DOCUMENTATION.md for details
        // 🚨 PROTECTED CODE - ANY CHANGES REQUIRE TEAM REVIEW 🚨
        
        // Determine which state to show
        if (!gameStarted) {
            // Always show home screen first if game hasn't been started this session
            console.log('🏠 Showing home screen - game not started');
            this.showHomeScreen();
            return;
        } else if (gameStarted && !creatureHatched) {
            // Game started but creature not hatched - show hatching process
            console.log('🥚 Showing hatching screen - game started, creature not hatched');
            this.showHatchingScreen();
        } else if (gameStarted && creatureHatched && !creatureNamed) {
            // Game started, hatched but not named - go to personality scene first
            console.log('✨ Going to personality scene - creature hatched but not named');
            this.scene.start('PersonalityScene');
            return;
        } else if (gameStarted && creatureHatched && creatureNamed) {
            // Game started, fully set up - go to game scene
            console.log('🌍 Going to game scene - creature fully set up');
            this.scene.start('GameScene');
            return;
        } else {
            // Fallback to home screen
            console.log('🏠 Fallback to home screen');
            this.showHomeScreen();
            return;
        }
        // ⚠️ END CRITICAL SECTION - DO NOT MODIFY ⚠️
    }

    showHomeScreen() {
        // Initialize graphics engine for development mode
        this.graphicsEngine = new GraphicsEngine(this);

        // Create beautiful home screen background
        this.createBackground();

        // Main title
        const titleText = this.add.text(400, 150, '🌟 Mythical Creature Game 🌟', {
            fontSize: '42px',
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 4,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        const subtitleText = this.add.text(400, 210, 'Begin Your Magical Adventure!', {
            fontSize: '24px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);

        // Create animated START button
        this.createStartButton();

        // Game features preview
        this.add.text(400, 350, '🥚 Hatch your creature  •  🏷️ Give it a name  •  🌍 Explore together', {
            fontSize: '18px',
            color: '#87CEEB',
            align: 'center'
        }).setOrigin(0.5);

        // Reset button
        this.createResetButton();

        // Development Mode: Creature Generator Button (also available on home screen)
        this.createDevGeneratorButton();

        // Control hints
        this.add.text(400, 520, '🎮 Click START to begin your journey! • Press G key or GEN button to test creatures', {
            fontSize: '14px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
        }).setOrigin(0.5);
    }

    showHatchingScreen() {
        // Initialize enhanced graphics engine
        this.graphicsEngine = new GraphicsEngine(this);

        // Create enhanced programmatic sprites
        this.createEnhancedSprites();

        // Create beautiful sky background with clouds
        this.createBackground();

        // Create the ground
        this.createGround();

        // Create the egg with floating animation
        this.createEgg();

        // Set up input handling
        this.setupInput();

        // Create UI text elements
        this.createUI();

        // Initialize hatch cinematics if available
        if (window.HatchCinematics) {
            // Load config
            this.loadHatchConfig();
        }
    }

    createStartButton() {
        // Animated START button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x00FF00, 0.9);
        buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
        buttonBg.lineStyle(4, 0xFFFFFF);
        buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);

        // START button text
        const startText = this.add.text(400, 310, '🚀 START GAME', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const startButton = this.add.zone(300, 280, 200, 60)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Button animations
        this.tweens.add({
            targets: [buttonBg, startText],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // ⚠️ CRITICAL GAME FLOW FIX - DO NOT MODIFY WITHOUT TEAM REVIEW ⚠️
        // This handler fixes the core bug where game would skip egg hatching
        // The timing of GameState.save() and scene restart is critical
        // See GAME_FLOW_DOCUMENTATION.md for full explanation
        startButton.on('pointerdown', () => {
            console.log('🚀 START GAME button clicked!');
            
            // Mark game as started
            GameState.set('session.gameStarted', true);
            console.log('✅ Set gameStarted to true');
            
            // CRITICAL: Reset creature to unhatched state for fresh game flow
            GameState.set('creature.hatched', false);
            GameState.set('creature.name', 'Your Creature');
            GameState.set('creature.hatchTime', null);
            GameState.set('creature.experience', 0);
            GameState.set('creature.level', 1);
            console.log('✅ Set creature.hatched to false');
            
            // Reset creature stats to defaults
            GameState.set('creature.stats', {
                happiness: 100,
                energy: 100,
                health: 100
            });
            
            // Clear personality and genes to regenerate fresh
            GameState.set('creature.personality', null);
            GameState.set('creature.genes', null);
            
            console.log('🔄 Creature reset complete - forcing save before scene transition...');
            
            // CRITICAL: Force immediate save to localStorage before scene restart
            // This ensures the reset state persists when scene restarts
            GameState.save();
            
            // Verify the state before restarting
            console.log('🔍 Pre-restart verification:');
            console.log('  gameStarted:', GameState.get('session.gameStarted'));
            console.log('  creatureHatched:', GameState.get('creature.hatched'));
            
            // Check what's actually in localStorage
            const savedData = localStorage.getItem('mythical-creature-save');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                console.log('💾 localStorage verification:');
                console.log('  creature.hatched in localStorage:', parsed.creature?.hatched);
                console.log('  Full creature in localStorage:', parsed.creature);
            } else {
                console.log('💾 No data found in localStorage!');
            }
            
            // Small delay to ensure save completes, then transition to hatching screen
            // The 100ms delay is critical - removing it breaks the flow
            this.time.delayedCall(100, () => {
                console.log('🔄 Now restarting scene to show hatching experience...');
                this.scene.restart();
            });
        });
        // ⚠️ END CRITICAL SECTION - TESTED AND WORKING ⚠️

        startButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x00FF66, 0.9);
            buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
            buttonBg.lineStyle(4, 0xFFFFFF);
            buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);
        });

        startButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x00FF00, 0.9);
            buttonBg.fillRoundedRect(300, 280, 200, 60, 15);
            buttonBg.lineStyle(4, 0xFFFFFF);
            buttonBg.strokeRoundedRect(300, 280, 200, 60, 15);
        });
    }

    createEnhancedSprites() {
        // Create enhanced egg with realistic shading and texture
        this.createEnhancedEgg();

        // Get creature colors from GameState (allows customization later)
        const creatureColors = GameState.get('creature.colors') || {
            body: 0x9370DB,  // Default purple
            head: 0xDDA0DD,  // Default plum
            wings: 0x8A2BE2  // Default blue violet
        };

        // Create enhanced creature sprite with realistic depth
        this.graphicsEngine.createEnhancedCreature(
            creatureColors.body,
            creatureColors.head,
            creatureColors.wings,
            0
        );

        // Create magical sparkle effects
        this.graphicsEngine.createMagicalSparkle(0xFFD700, 1.0);

        // Create enhanced volumetric clouds
        this.createEnhancedClouds();
    }

    createEnhancedEgg() {
        const graphics = this.add.graphics();
        const center = { x: 50, y: 75 };

        // === ENHANCED EGG WITH REALISTIC SHADING ===

        // Egg shadow on ground
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 85, 45);

        // Egg base layer (darkest)
        graphics.fillStyle(0xE6E6E6); // Light gray base
        graphics.fillEllipse(center.x, center.y, 84, 104);

        // Egg main color (cream)
        graphics.fillStyle(0xF5F5DC);
        graphics.fillEllipse(center.x - 2, center.y - 2, 80, 100);

        // Egg highlight (creates 3D roundness)
        graphics.fillStyle(0xFFFAF0);
        graphics.fillEllipse(center.x - 8, center.y - 8, 65, 85);

        // Egg shine (realistic light reflection)
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillEllipse(center.x - 15, center.y - 15, 35, 45);

        // Enhanced spots with depth
        const spots = [
            { x: 35, y: 60, size: 8 },
            { x: 65, y: 85, size: 6 },
            { x: 45, y: 95, size: 5 },
            { x: 30, y: 80, size: 4 },
            { x: 55, y: 65, size: 3 }
        ];

        spots.forEach(spot => {
            // Spot shadow
            graphics.fillStyle(0xDAA520, 0.8);
            graphics.fillCircle(spot.x + 1, spot.y + 1, spot.size);

            // Main spot
            graphics.fillStyle(0xFFD700);
            graphics.fillCircle(spot.x, spot.y, spot.size);

            // Spot highlight
            graphics.fillStyle(0xFFFACD, 0.7);
            graphics.fillCircle(spot.x - 1, spot.y - 1, spot.size * 0.6);
        });

        // Egg outline for definition
        graphics.lineStyle(2, 0x8B4513, 0.8);
        graphics.strokeEllipse(center.x - 2, center.y - 2, 80, 100);

        graphics.generateTexture('enhancedEgg', 100, 150);
        graphics.destroy();
    }

    createEnhancedClouds() {
        const graphics = this.add.graphics();

        // Volumetric clouds with multiple layers
        const cloudLayers = [
            { offset: { x: 0, y: 0 }, alpha: 0.3, size: 1.2, color: 0xF0F8FF },
            { offset: { x: -3, y: -2 }, alpha: 0.5, size: 1.0, color: 0xFFFFFF },
            { offset: { x: -6, y: -4 }, alpha: 0.7, size: 0.8, color: 0xFFFAF0 },
            { offset: { x: -8, y: -5 }, alpha: 0.9, size: 0.6, color: 0xFFFFFF }
        ];

        cloudLayers.forEach((layer, index) => {
            graphics.fillStyle(layer.color, layer.alpha);
            const scale = layer.size;
            const offsetX = layer.offset.x;
            const offsetY = layer.offset.y;

            // Organic cloud shape with multiple connected circles
            graphics.fillCircle(30 + offsetX, 25 + offsetY, 25 * scale);
            graphics.fillCircle(50 + offsetX, 20 + offsetY, 30 * scale);
            graphics.fillCircle(70 + offsetX, 25 + offsetY, 25 * scale);
            graphics.fillCircle(45 + offsetX, 35 + offsetY, 20 * scale);
            graphics.fillCircle(25 + offsetX, 30 + offsetY, 15 * scale);
            graphics.fillCircle(65 + offsetX, 32 + offsetY, 18 * scale);

            // Additional cloud wisps for realism
            graphics.fillCircle(15 + offsetX, 28 + offsetY, 12 * scale);
            graphics.fillCircle(80 + offsetX, 28 + offsetY, 14 * scale);
        });

        graphics.generateTexture('enhancedCloud', 100, 60);
        graphics.destroy();
    }

    createBackground() {
        // Add floating enhanced clouds
        this.clouds = this.add.group();
        for (let i = 0; i < 4; i++) {
            const cloud = this.add.image(
                Phaser.Math.Between(100, 700),
                Phaser.Math.Between(50, 150),
                'enhancedCloud'
            );
            cloud.setAlpha(0.8);
            cloud.setScale(Phaser.Math.FloatBetween(0.8, 1.2));
            this.clouds.add(cloud);

            // Gentle cloud movement
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(8000, 12000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    createGround() {
        // Create green ground at the bottom
        const ground = this.add.graphics();
        ground.fillStyle(0x228B22); // Forest green
        ground.fillRect(0, 500, 800, 100);

        // Add some grass details
        ground.fillStyle(0x32CD32); // Lime green
        for (let i = 0; i < 20; i++) {
            const x = i * 40 + Phaser.Math.Between(-10, 10);
            ground.fillTriangle(x, 500, x + 5, 490, x + 10, 500);
        }
    }

    createEgg() {
        // Create the enhanced egg sprite
        this.egg = this.add.image(400, 300, 'enhancedEgg');
        this.egg.setInteractive({ cursor: 'pointer' });
        this.egg.setScale(1.2);

        // Create floating animation for the egg
        this.tweens.add({
            targets: this.egg,
            y: this.egg.y - 20,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    setupInput() {
        // Handle egg click
        this.egg.on('pointerdown', () => {
            if (!this.hatchingStarted && !this.creatureAppeared) {
                this.startHatching();
            }
        });

        // Handle space key for scene transition (with null check for touch devices)
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            // Development mode: G key for creature generation
            this.gKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
        }
    }

    createUI() {
        // Main title
        const titleText = this.add.text(400, 60, '🌟 Mythical Creature Game 🌟', {
            fontSize: '32px',
            color: '#FFD700',
            stroke: '#4B0082',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        const subtitleText = this.add.text(400, 100, 'Your magical adventure begins here!', {
            fontSize: '18px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);

        // Instructions text with better styling
        this.instructionText = this.add.text(400, 150, '👆 Click the magical egg below to hatch your creature! 👆', {
            fontSize: '20px',
            color: '#FFFFFF',
            stroke: '#4B0082',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Create UI panel background
        this.createControlPanel();

        // Progress text (hidden initially)
        this.progressText = this.add.text(400, 450, '', {
            fontSize: '24px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Adventure text (hidden initially)
        this.adventureText = this.add.text(400, 500, '✨ Press SPACE to meet your creature! ✨', {
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setVisible(false);
    }

    createControlPanel() {
        // Control panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.7);
        panelBg.fillRoundedRect(50, 480, 700, 100, 15);
        panelBg.lineStyle(3, 0xFFD700);
        panelBg.strokeRoundedRect(50, 480, 700, 100, 15);

        // Reset Game Button
        this.createResetButton();

        // Development Mode: Creature Generator Button
        this.createDevGeneratorButton();

        // Instructions
        this.add.text(400, 500, '🎮 Controls: Click egg to hatch • SPACE to continue • G key / GEN button to generate • WASD/Arrows to move', {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5);

        // Game info
        this.add.text(400, 520, '🏆 Goal: Hatch → Name → Explore the magical world with your creature!', {
            fontSize: '14px',
            color: '#87CEEB',
            align: 'center'
        }).setOrigin(0.5);

        // Debug info
        this.add.text(400, 545, '🔧 Debug: Use Reset button to start over • Save data persists between sessions', {
            fontSize: '12px',
            color: '#999999',
            align: 'center'
        }).setOrigin(0.5);
    }

    createResetButton() {
        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(680, 55, 100, 35, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(680, 55, 100, 35, 8);

        // Reset button text
        const resetText = this.add.text(730, 72, '🔄 RESET', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const resetButton = this.add.zone(680, 55, 100, 35)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(680, 55, 100, 35, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(680, 55, 100, 35, 8);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(680, 55, 100, 35, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(680, 55, 100, 35, 8);
        });
    }

    createDevGeneratorButton() {
        // Dev Generator button background
        const devButtonBg = this.add.graphics();
        devButtonBg.fillStyle(0x9370DB, 0.9);
        devButtonBg.fillRoundedRect(570, 55, 100, 35, 8);
        devButtonBg.lineStyle(2, 0xFFFFFF);
        devButtonBg.strokeRoundedRect(570, 55, 100, 35, 8);

        // Dev Generator button text
        const devText = this.add.text(620, 72, '🧪 GEN', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Make button interactive
        const devButton = this.add.zone(570, 55, 100, 35)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        devButton.on('pointerdown', () => {
            this.startDevGeneration();
        });

        devButton.on('pointerover', () => {
            devButtonBg.clear();
            devButtonBg.fillStyle(0xBA55D3, 0.9);
            devButtonBg.fillRoundedRect(570, 55, 100, 35, 8);
            devButtonBg.lineStyle(2, 0xFFFFFF);
            devButtonBg.strokeRoundedRect(570, 55, 100, 35, 8);
        });

        devButton.on('pointerout', () => {
            devButtonBg.clear();
            devButtonBg.fillStyle(0x9370DB, 0.9);
            devButtonBg.fillRoundedRect(570, 55, 100, 35, 8);
            devButtonBg.lineStyle(2, 0xFFFFFF);
            devButtonBg.strokeRoundedRect(570, 55, 100, 35, 8);
        });
    }

    resetGameData() {
        // Show confirmation
        const confirmBg = this.add.graphics();
        confirmBg.fillStyle(0x000000, 0.8);
        confirmBg.fillRect(0, 0, 800, 600);

        const confirmPanel = this.add.graphics();
        confirmPanel.fillStyle(0x333333, 0.95);
        confirmPanel.fillRoundedRect(200, 200, 400, 200, 15);
        confirmPanel.lineStyle(3, 0xFF4444);
        confirmPanel.strokeRoundedRect(200, 200, 400, 200, 15);

        const confirmText = this.add.text(400, 280, '🚨 Reset Game Data? 🚨\n\nThis will delete your creature\nand start completely over.', {
            fontSize: '18px',
            color: '#FFFFFF',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Yes button
        const yesButton = this.add.text(330, 350, '✅ YES', {
            fontSize: '16px',
            color: '#00FF00',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

        // No button
        const noButton = this.add.text(470, 350, '❌ NO', {
            fontSize: '16px',
            color: '#FF4444',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

        yesButton.on('pointerdown', () => {
            // Clear all game data completely
            localStorage.removeItem('mythical-creature-save');
            console.log('🔄 Game data reset - localStorage cleared');
            
            // Reload the page to start fresh
            window.location.reload();
        });

        noButton.on('pointerdown', () => {
            // Close confirmation dialog
            confirmBg.destroy();
            confirmPanel.destroy();
            confirmText.destroy();
            yesButton.destroy();
            noButton.destroy();
        });
    }

    startHatching() {
        this.hatchingStarted = true;
        this.isHatching = true;
        this.instructionText.setVisible(false);
        this.progressText.setVisible(true);

        // Start shaking animation
        this.tweens.add({
            targets: this.egg,
            x: this.egg.x + 5,
            duration: 100,
            ease: 'Power2',
            yoyo: true,
            repeat: -1
        });

        // Progressive hatching timer
        this.hatchingTimer = this.time.addEvent({
            delay: 100,
            callback: this.updateHatching,
            callbackScope: this,
            loop: true
        });
    }

    updateHatching() {
        this.hatchingProgress += 2;
        this.progressText.setText(`Hatching... ${this.hatchingProgress}%`);

        // Change egg color as it hatches
        if (this.hatchingProgress >= 33 && this.hatchingProgress < 66) {
            // Change to pink
            this.updateEggColor(0xFFC0CB, 0x8B4513); // Pink with brown outline
        } else if (this.hatchingProgress >= 66) {
            // Change to red
            this.updateEggColor(0xFF6B6B, 0x8B4513); // Red with brown outline
        }

        // Complete hatching at 100%
        if (this.hatchingProgress >= 100) {
            this.completeHatching();
        }
    }

    updateEggColor(fillColor, strokeColor) {
        // Recreate egg texture with new colors
        const eggGraphics = this.add.graphics();
        eggGraphics.fillStyle(fillColor);
        eggGraphics.fillEllipse(50, 75, 80, 100);
        eggGraphics.lineStyle(3, strokeColor);
        eggGraphics.strokeEllipse(50, 75, 80, 100);
        eggGraphics.fillStyle(0xFFD700); // Keep yellow spots
        eggGraphics.fillCircle(35, 60, 8);
        eggGraphics.fillCircle(65, 85, 6);
        eggGraphics.fillCircle(45, 95, 5);
        eggGraphics.generateTexture('eggHatching', 100, 150);
        eggGraphics.destroy();

        this.egg.setTexture('eggHatching');
    }

    completeHatching() {
        this.hatchingTimer.destroy();
        this.isHatching = false;
        this.progressText.setVisible(false);

        // Update GameState - creature has hatched!
        GameState.completeHatching();

        // Stop shaking and floating animations
        this.tweens.killTweensOf(this.egg);

        // Make egg disappear with fade effect
        this.tweens.add({
            targets: this.egg,
            alpha: 0,
            scale: 0,
            duration: 500,
            onComplete: () => {
                this.egg.destroy();
                this.showCreature();
            }
        });
    }

    showCreature() {
        this.creatureAppeared = true;

        // Generate unique genetics for this creature
        this.generateCreatureGenetics();

        // Create the creature sprite using genetics
        const creatureResult = this.createUniqueCreature();

        if (creatureResult && creatureResult.textureName) {
            // Create the enhanced creature with the new texture
            this.creature = this.add.image(400, 300, creatureResult.textureName);
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);

            // Store genetics data on the sprite for later access
            this.creature.genetics = this.creatureGenetics;

            // Fade in the creature
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 1000,
                ease: 'Back.easeOut'
            });

            // Add cosmic effects based on genetics
            this.addGeneticEffects();

            // Save genetics to GameState
            this.saveCreatureGenetics();
            
        } else {
            // Fallback to default creature
            console.warn('hatch:warn [HatchingScene] Failed to create genetic creature, using default');
            this.creature = this.add.image(400, 300, 'enhancedCreature0');
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);

            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 1000,
                ease: 'Back.easeOut'
            });
        }

        // Create sparkle effects around the creature
        this.createSparkles();

        // Show adventure text
        this.time.delayedCall(1500, () => {
            this.adventureText.setVisible(true);
            this.tweens.add({
                targets: this.adventureText,
                alpha: { from: 0, to: 1 },
                scale: { from: 0.8, to: 1 },
                duration: 500
            });
        });
    }

    createSparkles() {
        const sparkles = [];
        for (let i = 0; i < 8; i++) {
            const sparkle = this.add.image(
                400 + Phaser.Math.Between(-100, 100),
                300 + Phaser.Math.Between(-80, 80),
                'magicalSparkle'
            );
            sparkle.setScale(0);
            sparkles.push(sparkle);

            // Animate sparkles appearing
            this.tweens.add({
                targets: sparkle,
                scale: 1,
                alpha: { from: 0, to: 1 },
                duration: 300,
                delay: i * 100,
                onComplete: () => {
                    // Fade out sparkles
                    this.tweens.add({
                        targets: sparkle,
                        alpha: 0,
                        scale: 0.5,
                        duration: 800,
                        delay: 500,
                        onComplete: () => sparkle.destroy()
                    });
                }
            });
        }
    }

    /**
     * Load hatch cinematics configuration
     */
    async loadHatchConfig() {
        try {
            const response = await fetch('src/config/hatch-cinematics.json');
            this.hatchConfig = await response.json();
            console.log('cinematic:debug [HatchingScene] Config loaded', this.hatchConfig);
        } catch (error) {
            console.log('cinematic:debug [HatchingScene] Using default config:', error.message);
            this.hatchConfig = null; // Will use defaults
        }
    }

    /**
     * Enhanced hatching sequence with cinematic timing
     */
    async startCinematicHatch() {
        if (!window.HatchCinematics) {
            // Fallback to original hatching
            this.startHatching();
            return;
        }

        try {
            // Initialize hatch cinematics with our config
            if (this.hatchConfig) {
                window.HatchCinematics.initialize(this.hatchConfig);
            }

            console.log('cinematic:info [HatchingScene] Starting cinematic hatch sequence');
            
            // Store references for cinematics system
            if (this.egg) {
                this.egg.name = 'egg';
            }

            // Play the full 8-beat cinematic sequence
            await window.HatchCinematics.play(this, {
                assets: {
                    egg: this.egg,
                    creature: this.creature
                }
            });

            // After cinematics complete, trigger transition
            this.time.delayedCall(1000, () => {
                this.transitionToPersonality();
            });

        } catch (error) {
            console.warn('cinematic:warn [HatchingScene] Cinematics failed, using fallback:', error);
            this.startHatching(); // Fallback to original
        }
    }

    /**
     * Trigger the first emote after naming
     */
    triggerFirstEmote() {
        if (window.HatchCinematics && this.creature) {
            window.HatchCinematics.triggerFirstEmote(this, this.hatchConfig);
        }
    }

    /**
     * Generate unique genetics for this creature
     */
    generateCreatureGenetics() {
        if (!window.CreatureGenetics) {
            console.warn('hatch:warn [HatchingScene] CreatureGenetics system not available');
            return;
        }

        // Generate a completely unique creature
        this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics();
        
        console.log(`hatch:info [HatchingScene] Generated ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}:`, {
            id: this.creatureGenetics.id,
            personality: this.creatureGenetics.personality.core,
            cosmicElement: this.creatureGenetics.cosmicAffinity.element,
            specialFeatures: this.creatureGenetics.traits.features.specialFeatures?.length || 0
        });
    }

    /**
     * Create unique creature sprite using GraphicsEngine
     */
    createUniqueCreature() {
        if (!this.creatureGenetics || !this.graphicsEngine) {
            console.warn('hatch:warn [HatchingScene] Missing genetics or graphics engine');
            return null;
        }

        try {
            // Use the GraphicsEngine to create a randomized creature
            const creatureResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                this.creatureGenetics, 
                0 // frame 0
            );

            return creatureResult;
        } catch (error) {
            console.error('hatch:error [HatchingScene] Failed to create unique creature:', error);
            return null;
        }
    }

    /**
     * Add visual effects based on creature genetics
     */
    addGeneticEffects() {
        if (!this.creatureGenetics || !this.creature) return;

        const genetics = this.creatureGenetics;
        const creature = this.creature;

        // Add cosmic affinity-based particle effects
        if (window.FXLibrary && genetics.cosmicAffinity.powerLevel > 0.6) {
            const element = genetics.cosmicAffinity.element;
            
            // Different effects based on cosmic element
            switch (element) {
                case 'star':
                    window.FXLibrary.stardustBurst(this, creature.x, creature.y, {
                        count: 6,
                        color: [0xFFD54F, 0xF5F5F5],
                        duration: 2000
                    });
                    break;
                case 'nebula':
                    window.FXLibrary.auroraPass(this, {
                        strips: 1,
                        colors: [0xF48FB1, 0x64B5F6]
                    });
                    break;
                case 'crystal':
                    window.FXLibrary.biolumePulse(creature, {
                        color: 0xB39DDB,
                        intensity: { min: 0.3, max: 0.7 }
                    });
                    break;
            }
        }

        // Add personality-based subtle effects
        if (genetics.personality.core === 'energetic') {
            // Gentle bounce animation
            this.tweens.add({
                targets: creature,
                y: creature.y - 5,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Add rarity-based glow
        if (genetics.rarity === 'legendary') {
            // Golden legendary glow
            this.tweens.add({
                targets: creature,
                alpha: 0.8,
                duration: 1500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }

    /**
     * Save creature genetics to GameState
     */
    saveCreatureGenetics() {
        if (!this.creatureGenetics) return;

        // Save the complete genetic profile
        GameState.set('creature.genetics', this.creatureGenetics);
        
        // Save key traits for easy access
        GameState.set('creature.species', this.creatureGenetics.species);
        GameState.set('creature.personality', this.creatureGenetics.personality.core);
        GameState.set('creature.rarity', this.creatureGenetics.rarity);
        GameState.set('creature.cosmicElement', this.creatureGenetics.cosmicAffinity.element);
        
        // Generate a descriptive name based on genetics
        const descriptiveName = this.generateCreatureName();
        GameState.set('creature.descriptiveName', descriptiveName);
        
        console.log(`hatch:info [HatchingScene] Saved genetics for ${descriptiveName}`);
    }

    /**
     * Generate a Space-Mythic descriptive name based on genetics
     */
    generateCreatureName() {
        if (!this.creatureGenetics) return 'Cosmic Friend';

        const genetics = this.creatureGenetics;
        
        // Create descriptive name parts
        const elementPrefix = {
            star: 'Stellar',
            moon: 'Lunar', 
            nebula: 'Nebula',
            crystal: 'Crystal',
            void: 'Void'
        };

        const personalityType = {
            curious: 'Explorer',
            playful: 'Dancer',
            gentle: 'Whisperer', 
            wise: 'Sage',
            energetic: 'Spark'
        };

        const speciesSuffix = {
            stellarWyrm: 'Wyrm',
            crystalDrake: 'Drake',
            nebulaSprite: 'Sprite'
        };

        const prefix = elementPrefix[genetics.cosmicAffinity.element] || 'Cosmic';
        const middle = personalityType[genetics.personality.core] || 'Friend';
        const suffix = speciesSuffix[genetics.species] || 'Being';

        return `${prefix} ${middle} ${suffix}`;
    }

    /**
     * Transition to personality scene
     */
    transitionToPersonality() {
        // Mark creature as hatched
        GameState.set('creature.hatched', true);
        GameState.set('creature.hatchTime', Date.now());
        
        // Fade transition
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, 800, 600);

        this.tweens.add({
            targets: fadeGraphics,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.scene.start('PersonalityScene');
            }
        });
    }

    /**
     * Development mode: Generate and display a new creature without game flow
     */
    startDevGeneration() {
        console.log('🧪 [DEV MODE] Starting creature generation test');
        
        // Clear existing creature if any
        if (this.creature) {
            this.creature.destroy();
        }
        
        // Clear existing textures to prevent black sprite issue
        this.clearCreatureTextures();
        
        // Generate fresh genetics
        this.generateCreatureGenetics();
        
        // Create creature with new genetics
        const creatureResult = this.createUniqueCreature();
        
        if (creatureResult && creatureResult.textureName) {
            // Create the creature sprite
            this.creature = this.add.image(400, 300, creatureResult.textureName);
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            
            // Store genetics for debugging
            this.creature.genetics = this.creatureGenetics;
            
            // Animate appearance
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 800,
                ease: 'Back.easeOut'
            });
            
            // Add genetics-based effects
            this.addGeneticEffects();
            
            // Show creature info in console for debugging
            console.log('🧪 [DEV MODE] Generated creature:', {
                id: this.creatureGenetics.id,
                species: this.creatureGenetics.species,
                bodyType: this.creatureGenetics.traits.bodyShape.type,
                personality: this.creatureGenetics.personality.core,
                rarity: this.creatureGenetics.rarity,
                element: this.creatureGenetics.cosmicAffinity.element,
                textureName: creatureResult.textureName
            });
            
            // Update save data for testing persistence
            this.saveCreatureGenetics();
            
        } else {
            console.error('🧪 [DEV MODE] Failed to generate creature - black sprite issue detected');
            
            // Try fallback generation
            this.creature = this.add.image(400, 300, 'enhancedCreature0');
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2, 
                duration: 800,
                ease: 'Back.easeOut'
            });
        }
        
        // Add sparkle effects for visual feedback
        this.createSparkles();
    }
    
    /**
     * Clear creature textures to prevent black sprite issues
     */
    clearCreatureTextures() {
        const textureManager = this.textures;
        
        // Clear all dynamic creature textures
        const texturesToClear = [];
        textureManager.each((key, texture) => {
            if (key.includes('creature_') || key.includes('space_creature_') || key.includes('enhancedCreature')) {
                texturesToClear.push(key);
            }
        });
        
        texturesToClear.forEach(key => {
            if (textureManager.exists(key)) {
                textureManager.remove(key);
                console.log(`🧹 [DEV MODE] Cleared texture: ${key}`);
            }
        });
        
        console.log(`🧹 [DEV MODE] Cleared ${texturesToClear.length} creature textures`);
    }

    update() {
        // Check for space key to start cinematic hatch or transition
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.egg && !this.isHatching && !this.creatureAppeared) {
                this.startCinematicHatch();
            } else if (this.creatureAppeared) {
                this.transitionToPersonality();
            }
        }
        
        // Development mode: G key for creature generation
        if (this.gKey && Phaser.Input.Keyboard.JustDown(this.gKey)) {
            this.startDevGeneration();
        }
    }
}