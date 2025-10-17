/**
 * HatchingScene - The first scene where the player clicks an egg to hatch their mythical creature
 * Features: floating egg animation, progressive hatching with color changes, sparkle effects
 */

import hatchCinematicsConfig from '../config/hatch-cinematics.json';
import MobileHelpers from '../utils/mobile-helpers.js';
const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

const cloneConfig = (config) => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(config);
        }
    } catch (err) {
        // Ignore and fall back to JSON cloning
    }
    return JSON.parse(JSON.stringify(config));
};

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
        
        const GameState = getGameState();

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
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Enable Space-Mythic theme
        if (window.UITheme) {
            window.UITheme.applySpaceMythicTheme();
        }
        if (window.KidMode) {
            window.KidMode.enableKidMode();
        }

        // Create enhanced starfield background
        this.createEnhancedBackground();

        // Create animated stardust particles
        this.createStardustParticles();

        // Main title with glow effect
        this.createEnhancedTitle();

        // Create enhanced START button with glassmorphism
        this.createEnhancedStartButton();

        // Game features preview cards
        this.createFeatureCards();

        // Bottom hint text
        this.createBottomHints();
    }

    showHatchingScreen() {
        // Initialize enhanced graphics engine
        const GraphicsEngine = getGraphicsEngine();
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
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
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
            const state = getGameState();
            
            // Mark game as started
            state.set('session.gameStarted', true);
            console.log('✅ Set gameStarted to true');
            
            // CRITICAL: Reset creature to unhatched state for fresh game flow
            state.set('creature.hatched', false);
            state.set('creature.name', 'Your Creature');
            state.set('creature.hatchTime', null);
            state.set('creature.experience', 0);
            state.set('creature.level', 1);
            console.log('✅ Set creature.hatched to false');
            
            // Reset creature stats to defaults
            state.set('creature.stats', {
                happiness: 100,
                energy: 100,
                health: 100
            });
            
            // Clear personality and genes to regenerate fresh
            state.set('creature.personality', null);
            state.set('creature.genes', null);
            
            console.log('🔄 Creature reset complete - forcing save before scene transition...');
            
            // CRITICAL: Force immediate save to localStorage before scene restart
            // This ensures the reset state persists when scene restarts
            state.save();
            
            // Verify the state before restarting
            console.log('🔍 Pre-restart verification:');
            console.log('  gameStarted:', state.get('session.gameStarted'));
            console.log('  creatureHatched:', state.get('creature.hatched'));
            
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
        const creatureColors = getGameState().get('creature.colors') || {
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
        this.graphicsEngine.createMagicalSparkle(0xFFD54F, 1.0);

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
            graphics.fillStyle(0xFFD54F);
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
        // Create the enhanced egg sprite (responsive position)
        const pos = MobileHelpers.getResponsivePosition(this.scale, { x: 400, y: 300 });
        this.egg = this.add.image(pos.x, pos.y, 'enhancedEgg');

        // Mobile-optimized touch area (larger hit area for easier tapping)
        const isMobile = MobileHelpers.isMobile();
        const hitAreaPadding = isMobile ? 40 : 0;
        this.egg.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, (this.egg.width / 2) + hitAreaPadding),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            cursor: isMobile ? 'default' : 'pointer'
        });

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
        // Handle egg click with haptic feedback
        this.egg.on('pointerdown', () => {
            if (!this.hatchingStarted && !this.creatureAppeared) {
                MobileHelpers.vibrate(30); // Gentle haptic feedback
                this.startHatching();
            }
        });

        // Handle space key for scene transition (with null check for touch devices)
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
    }

    createUI() {
        // Main title
        const titleText = this.add.text(400, 60, '🌟 Mythical Creature Game 🌟', {
            fontSize: '32px',
            color: '#FFD54F',
            stroke: '#7B1FA2',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        const subtitleText = this.add.text(400, 100, 'Your magical adventure begins here!', {
            fontSize: '18px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
        }).setOrigin(0.5);

        // Instructions text with better styling
        this.instructionText = this.add.text(400, 150, '👆 Click the magical egg below to hatch your creature! 👆', {
            fontSize: '20px',
            color: '#FFFFFF',
            stroke: '#7B1FA2',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Create UI panel background
        this.createControlPanel();

        // Progress text (hidden initially)
        this.progressText = this.add.text(400, 450, '', {
            fontSize: '24px',
            color: '#FFD54F',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Adventure text removed - replaced by Keep/Reroll UI
    }

    createControlPanel() {
        // Control panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.7);
        panelBg.fillRoundedRect(50, 480, 700, 100, 15);
        panelBg.lineStyle(3, 0xFFD54F);
        panelBg.strokeRoundedRect(50, 480, 700, 100, 15);

        // Instructions
        this.add.text(400, 500, '🎮 Click egg to hatch • SPACE to continue • WASD/Arrows to move', {
            fontSize: '16px',
            color: '#F5F5F5',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Game info
        this.add.text(400, 530, '🏆 Hatch → Name → Explore the magical world!', {
            fontSize: '14px',
            color: '#80CBC4',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
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
        eggGraphics.fillStyle(0xFFD54F); // Keep yellow spots
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
        getGameState().completeHatching();

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
        console.log('hatch:info [HatchingScene] === showCreature() called ===');
        this.creatureAppeared = true;

        // Generate unique genetics for this creature
        console.log('hatch:info [HatchingScene] Step 1: Generating creature genetics...');
        this.generateCreatureGenetics();

        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] CRITICAL: generateCreatureGenetics() returned null!');
            this.showCriticalError('Failed to generate creature genetics');
            return;
        }

        console.log('hatch:info [HatchingScene] Step 2: Creating creature sprite...');
        // Create the creature sprite using genetics
        const creatureResult = this.createUniqueCreature();

        console.log('hatch:info [HatchingScene] Step 3: Creature result:', creatureResult ? 'SUCCESS' : 'FAILED');

        if (creatureResult && creatureResult.textureName) {
            console.log('hatch:info [HatchingScene] Step 4: Creating sprite with texture:', creatureResult.textureName);

            // Verify texture exists
            if (!this.textures.exists(creatureResult.textureName)) {
                console.error('hatch:error [HatchingScene] Texture does not exist in cache!');
                this.showCriticalError('Creature texture generation failed');
                return;
            }

            // Create the enhanced creature with the new texture
            this.creature = this.add.image(400, 300, creatureResult.textureName);
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);

            // Store genetics data on the sprite for later access
            this.creature.genetics = this.creatureGenetics;

            console.log('hatch:info [HatchingScene] Step 5: Fading in creature...');
            // Fade in the creature
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 1000,
                ease: 'Back.easeOut',
                onComplete: () => {
                    console.log('hatch:info [HatchingScene] Creature fade-in complete');
                }
            });

            // Add cosmic effects based on genetics
            this.addGeneticEffects();

            // Save genetics to GameState
            this.saveCreatureGenetics();

        } else {
            // Fallback to default creature
            console.warn('hatch:warn [HatchingScene] Failed to create genetic creature, using default fallback');

            // Check if default texture exists
            if (!this.textures.exists('enhancedCreature0')) {
                console.error('hatch:error [HatchingScene] Default texture enhancedCreature0 also missing!');
                this.showCriticalError('No creature textures available');
                return;
            }

            this.creature = this.add.image(400, 300, 'enhancedCreature0');
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);

            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 1000,
                ease: 'Back.easeOut'
            });
        }

        console.log('hatch:info [HatchingScene] Step 6: Creating sparkle effects...');
        // Create sparkle effects around the creature
        this.createSparkles();

        console.log('hatch:info [HatchingScene] Step 7: Setting up reroll system...');
        // Start reroll session if system is available
        if (window.rerollSystem && this.creatureGenetics) {
            window.rerollSystem.startHatchSession({
                genetics: this.creatureGenetics,
                rarity: this.creatureGenetics.rarity
            });

            // Show rarity announcement and reroll options
            this.time.delayedCall(1500, () => {
                console.log('hatch:info [HatchingScene] Showing rarity reveal and reroll options');
                this.showRarityReveal();
                this.showRerollOptions();
            });
        } else {
            // Fallback: Show old adventure text behavior
            console.warn('hatch:warn [HatchingScene] RerollSystem not available, using simple transition');
            this.time.delayedCall(1500, () => {
                const continueText = this.add.text(400, 500, '✨ Press SPACE to continue! ✨', {
                    fontSize: '20px',
                    color: '#FFD54F',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);

                this.tweens.add({
                    targets: continueText,
                    alpha: { from: 0, to: 1 },
                    duration: 500
                });
            });
        }

        console.log('hatch:info [HatchingScene] === showCreature() complete ===');
    }

    /**
     * Show critical error message to user
     */
    showCriticalError(message) {
        const errorText = this.add.text(400, 300, `❌ ${message}\n\nPlease refresh the page`, {
            fontSize: '24px',
            color: '#FF4444',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 600 }
        }).setOrigin(0.5);

        errorText.setDepth(1000);
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
            this.hatchConfig = cloneConfig(hatchCinematicsConfig);
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
     * Generate unique genetics for this creature with rarity system
     */
    generateCreatureGenetics() {
        if (!window.CreatureGenetics) {
            console.warn('hatch:warn [HatchingScene] CreatureGenetics system not available');
            return;
        }

        // Check if RaritySystem is available
        if (!window.raritySystem) {
            console.warn('hatch:warn [HatchingScene] RaritySystem not available, using default generation');
            this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics();
            this.rarityInfo = { name: 'Unknown', emoji: '🔮', displayColor: '#9370DB' };
            return;
        }

        // Get pity data from GameState
        const state = getGameState();
        let pityData = state.get('pitySystem');

        // Initialize pity system if needed
        if (!pityData || typeof pityData.hatchesSinceEpic === 'undefined') {
            pityData = window.raritySystem.initializePitySystem();
        }

        // Roll rarity using pity system
        const rollResult = window.raritySystem.rollRarity(pityData);
        const rarity = rollResult.rarity;

        // Update pity data in GameState
        state.set('pitySystem', rollResult.pityData);

        // Generate creature with the rolled rarity
        this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics(rarity);

        // Store rarity info for UI
        this.rarityInfo = window.raritySystem.getRarityInfo(rarity);

        console.log(`hatch:info [HatchingScene] Generated ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}:`, {
            id: this.creatureGenetics.id,
            personality: this.creatureGenetics.personality.core,
            cosmicElement: this.creatureGenetics.cosmicAffinity.element,
            specialFeatures: this.creatureGenetics.traits.features.specialFeatures?.length || 0,
            pityCounter: `${rollResult.pityData.hatchesSinceEpic}/${window.raritySystem.PITY_THRESHOLD}`
        });
    }

    /**
     * Create unique creature sprite using GraphicsEngine
     */
    createUniqueCreature() {
        console.log('hatch:debug [HatchingScene] createUniqueCreature() called');

        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] No genetics available!');
            return null;
        }

        if (!this.graphicsEngine) {
            console.error('hatch:error [HatchingScene] No graphics engine available!');
            return null;
        }

        console.log('hatch:debug [HatchingScene] Genetics:', {
            id: this.creatureGenetics.id,
            species: this.creatureGenetics.species,
            rarity: this.creatureGenetics.rarity,
            bodyType: this.creatureGenetics.traits?.bodyShape?.type,
            colors: this.creatureGenetics.traits?.colorGenome
        });

        try {
            // Ensure graphics engine has necessary methods
            if (typeof this.graphicsEngine.createRandomizedSpaceMythicCreature !== 'function') {
                console.error('hatch:error [HatchingScene] GraphicsEngine missing createRandomizedSpaceMythicCreature method');
                return null;
            }

            console.log('hatch:debug [HatchingScene] Calling createRandomizedSpaceMythicCreature...');

            // Use the GraphicsEngine to create a randomized creature
            const creatureResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                this.creatureGenetics,
                0 // frame 0
            );

            console.log('hatch:debug [HatchingScene] createRandomizedSpaceMythicCreature returned:', creatureResult);

            // Validate the result
            if (!creatureResult || !creatureResult.textureName) {
                console.error('hatch:error [HatchingScene] Graphics engine returned invalid result:', creatureResult);
                return null;
            }

            console.log('hatch:info [HatchingScene] Successfully created creature texture:', creatureResult.textureName);
            return creatureResult;
        } catch (error) {
            console.error('hatch:error [HatchingScene] Failed to create unique creature:', error);
            console.error('hatch:error [HatchingScene] Error message:', error.message);
            console.error('hatch:error [HatchingScene] Stack trace:', error.stack);
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
        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] Cannot save - no genetics generated!');
            return;
        }

        // Save the complete genetic profile
        const state = getGameState();

        state.set('creature.genetics', this.creatureGenetics);

        // Save the texture name for consistency across scenes
        const textureName = this.creature?.texture?.key || `creature_${this.creatureGenetics.id}_0`;
        state.set('creature.textureName', textureName);

        // Save key traits for easy access
        state.set('creature.species', this.creatureGenetics.species);
        state.set('creature.personality', this.creatureGenetics.personality.core);
        state.set('creature.rarity', this.creatureGenetics.rarity);
        state.set('creature.cosmicElement', this.creatureGenetics.cosmicAffinity.element);

        // Generate a descriptive name based on genetics
        const descriptiveName = this.generateCreatureName();
        state.set('creature.descriptiveName', descriptiveName);

        // CRITICAL: Force save to localStorage immediately
        state.save();

        console.log(`hatch:info [HatchingScene] Saved genetics for ${descriptiveName} with texture ${textureName}`);
        console.log(`hatch:debug [HatchingScene] Genetics body type: ${this.creatureGenetics.traits.bodyShape.type}`);
        console.log(`hatch:debug [HatchingScene] Genetics colors:`, this.creatureGenetics.traits.colorGenome);
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
        const state = getGameState();
        state.set('creature.hatched', true);
        state.set('creature.hatchTime', Date.now());
        
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
    update() {
        // Check for space key to start cinematic hatch or transition
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.egg && !this.isHatching && !this.creatureAppeared) {
                this.startCinematicHatch();
            } else if (this.creatureAppeared) {
                this.transitionToPersonality();
            }
        }
    }

    /**
     * Show rarity announcement banner
     */
    showRarityReveal() {
        try {
            if (!this.creatureGenetics || !this.rarityInfo) {
                console.error('hatch:error [HatchingScene] Missing genetics or rarity info for reveal');
                return;
            }

            if (!this.creatureGenetics.rarity) {
                console.error('hatch:error [HatchingScene] Creature genetics missing rarity field');
                return;
            }

            const rarity = this.creatureGenetics.rarity;
            const rarityInfo = this.rarityInfo;

            // Create banner background
            const bannerBg = this.add.graphics();
            bannerBg.fillStyle(0x000000, 0.8);
            bannerBg.fillRoundedRect(150, 50, 500, 80, 10);
            bannerBg.lineStyle(3, parseInt(rarityInfo.displayColor.replace('#', '0x')));
            bannerBg.strokeRoundedRect(150, 50, 500, 80, 10);

            // Rarity title
            const rarityText = this.add.text(400, 70, `${rarityInfo.emoji} ${rarityInfo.name} Creature!`, {
                fontSize: '28px',
                color: rarityInfo.displayColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);

            // Creature name/species
            const speciesText = this.add.text(400, 105, `${this.creatureGenetics.species} • ${this.creatureGenetics.personality.core}`, {
                fontSize: '18px',
                color: '#FFFFFF'
            }).setOrigin(0.5);

            // Animate banner
            [bannerBg, rarityText, speciesText].forEach(element => {
                element.setAlpha(0);
                this.tweens.add({
                    targets: element,
                    alpha: 1,
                    y: element.y + 10,
                    duration: 600,
                    ease: 'Back.easeOut'
                });
            });

            // Store references for cleanup
            this.rarityBanner = { bannerBg, rarityText, speciesText };

        } catch (error) {
            console.error('hatch:error [HatchingScene] Error in showRarityReveal:', error);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'scene',
                    severity: 'error',
                    message: 'Failed to show rarity reveal: ' + error.message,
                    stack: error.stack
                });
            }
        }
    }

    /**
     * Show Keep/Reroll buttons
     */
    showRerollOptions() {
        try {
            if (!window.rerollSystem) {
                console.error('hatch:error [HatchingScene] RerollSystem not available');
                return;
            }

            if (!this.creatureGenetics || !this.creatureGenetics.rarity) {
                console.error('hatch:error [HatchingScene] Creature genetics or rarity missing for reroll options');
                return;
            }

            const canReroll = window.rerollSystem.canReroll();

            // Button container
            const buttonY = 500;

            // KEEP button
            const keepBg = this.add.graphics();
            keepBg.fillStyle(0x228B22, 0.9);
            keepBg.fillRoundedRect(200, buttonY, 150, 50, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(200, buttonY, 150, 50, 10);

            const keepText = this.add.text(275, buttonY + 25, '✓ KEEP', {
                fontSize: '22px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            const keepZone = this.add.zone(200, buttonY, 150, 50).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

            // REROLL button (if available)
            let rerollBg, rerollText, rerollZone;
            if (canReroll) {
                rerollBg = this.add.graphics();
                rerollBg.fillStyle(0x4169E1, 0.9);
                rerollBg.fillRoundedRect(450, buttonY, 150, 50, 10);
                rerollBg.lineStyle(3, 0xFFD54F);
                rerollBg.strokeRoundedRect(450, buttonY, 150, 50, 10);

                rerollText = this.add.text(525, buttonY + 25, '🔄 REROLL', {
                    fontSize: '22px',
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                }).setOrigin(0.5);

                rerollZone = this.add.zone(450, buttonY, 150, 50).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });
            }

            // Advice text
            const advice = window.rerollSystem.getRerollAdvice(this.creatureGenetics.rarity);
            const adviceText = this.add.text(400, 450, advice.message, {
                fontSize: '14px',
                color: '#FFFF00',
                align: 'center',
                wordWrap: { width: 500 }
            }).setOrigin(0.5);

            // Animate elements
            const elements = [keepBg, keepText, adviceText];
            if (canReroll) {
                elements.push(rerollBg, rerollText);
            }

            elements.forEach((el, index) => {
                el.setAlpha(0);
                this.tweens.add({
                    targets: el,
                    alpha: 1,
                    duration: 500,
                    delay: index * 100,
                    ease: 'Power2'
                });
            });

            // Button interactions
            keepZone.on('pointerdown', () => this.handleKeepCreature());
            keepZone.on('pointerover', () => {
                keepBg.clear();
                keepBg.fillStyle(0x32CD32, 0.9);
                keepBg.fillRoundedRect(200, buttonY, 150, 50, 10);
                keepBg.lineStyle(3, 0xFFD54F);
                keepBg.strokeRoundedRect(200, buttonY, 150, 50, 10);
            });
            keepZone.on('pointerout', () => {
                keepBg.clear();
                keepBg.fillStyle(0x228B22, 0.9);
                keepBg.fillRoundedRect(200, buttonY, 150, 50, 10);
                keepBg.lineStyle(3, 0xFFD54F);
                keepBg.strokeRoundedRect(200, buttonY, 150, 50, 10);
            });

            if (canReroll) {
                console.log('hatch:info [HatchingScene] Reroll button enabled and interactive');
                rerollZone.on('pointerdown', () => {
                    console.log('hatch:info [HatchingScene] Reroll zone clicked!');
                    this.handleRerollCreature();
                });
                rerollZone.on('pointerover', () => {
                    rerollBg.clear();
                    rerollBg.fillStyle(0x6495ED, 0.9);
                    rerollBg.fillRoundedRect(450, buttonY, 150, 50, 10);
                    rerollBg.lineStyle(3, 0xFFD54F);
                    rerollBg.strokeRoundedRect(450, buttonY, 150, 50, 10);
                });
                rerollZone.on('pointerout', () => {
                    rerollBg.clear();
                    rerollBg.fillStyle(0x4169E1, 0.9);
                    rerollBg.fillRoundedRect(450, buttonY, 150, 50, 10);
                    rerollBg.lineStyle(3, 0xFFD54F);
                    rerollBg.strokeRoundedRect(450, buttonY, 150, 50, 10);
                });

                this.rerollUI = { rerollBg, rerollText, rerollZone };
            }

            this.keepUI = { keepBg, keepText, keepZone };
            this.adviceText = adviceText;

        } catch (error) {
            console.error('hatch:error [HatchingScene] Error in showRerollOptions:', error);
            if (window.errorHandler) {
                window.errorHandler.handleError({
                    type: 'scene',
                    severity: 'error',
                    message: 'Failed to show reroll options: ' + error.message,
                    stack: error.stack
                });
            }
        }
    }

    /**
     * Handle KEEP button click
     */
    handleKeepCreature() {
        console.log('hatch:info [HatchingScene] Player kept creature');

        // Cleanup UI
        this.cleanupRerollUI();

        // End reroll session
        window.rerollSystem.endHatchSession();

        // Show "Great choice!" message
        const confirmText = this.add.text(400, 480, '✨ Great choice! ✨', {
            fontSize: '24px',
            color: '#FFD54F',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: confirmText,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.8, to: 1.2 },
            duration: 500,
            yoyo: true,
            onComplete: () => {
                confirmText.destroy();
                this.transitionToPersonality();
            }
        });
    }

    /**
     * Handle REROLL button click
     */
    handleRerollCreature() {
        console.log('hatch:info [HatchingScene] 🔄 REROLL BUTTON CLICKED!');

        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] No creature genetics to reroll');
            return;
        }

        const originalRarity = this.creatureGenetics.rarity;
        console.log(`hatch:info [HatchingScene] Player rerolling ${originalRarity} creature`);

        // Execute reroll
        if (!window.rerollSystem.executeReroll()) {
            console.warn('hatch:warn [HatchingScene] Reroll failed - already used or not available');
            return;
        }

        // Track reroll in GameState
        const state = getGameState();
        let rerollData = state.get('rerollSystem');
        if (!rerollData) {
            rerollData = window.rerollSystem.initializeRerollData();
        }
        rerollData = window.rerollSystem.trackReroll(originalRarity, 'pending', rerollData);
        state.set('rerollSystem', rerollData);

        // Cleanup current UI
        this.cleanupRerollUI();

        // Check if creature exists
        if (!this.creature) {
            console.error('hatch:error [HatchingScene] No creature object to animate');
            // Skip animation and regenerate immediately
            this.performRerollRegeneration(originalRarity, rerollData, state);
            return;
        }

        console.log('hatch:info [HatchingScene] Fading out current creature...');

        // Fade out current creature
        this.tweens.add({
            targets: this.creature,
            alpha: 0,
            scale: 0.5,
            duration: 500,
            onComplete: () => {
                console.log('hatch:info [HatchingScene] Creature fade out complete, destroying...');
                this.creature.destroy();

                this.performRerollRegeneration(originalRarity, rerollData, state);
            }
        });
    }

    /**
     * Perform the creature regeneration after reroll
     */
    performRerollRegeneration(originalRarity, rerollData, state) {
        console.log('hatch:info [HatchingScene] Generating new creature after reroll...');

        // Generate NEW creature
        this.generateCreatureGenetics();

        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] Failed to generate new genetics');
            return;
        }

        console.log(`hatch:info [HatchingScene] New creature generated: ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}`);

        const creatureResult = this.createUniqueCreature();

        if (creatureResult && creatureResult.textureName) {
            console.log('hatch:info [HatchingScene] Creating new creature sprite with texture:', creatureResult.textureName);

            // Verify texture exists before creating sprite
            if (!this.textures.exists(creatureResult.textureName)) {
                console.error('hatch:error [HatchingScene] Texture was not created properly:', creatureResult.textureName);
                this.showRerollError('Failed to generate creature appearance');
                return;
            }

            this.creature = this.add.image(400, 300, creatureResult.textureName);
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);
            this.creature.genetics = this.creatureGenetics;

            // Fade in new creature
            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: 1.2,
                duration: 1000,
                ease: 'Back.easeOut'
            });

            // Bring back sparkle reveal & genetic VFX
            this.createSparkles();
            this.addGeneticEffects();

            // Persist latest genetics/texture to GameState so downstream scenes use the rerolled creature
            this.saveCreatureGenetics();

            // Update reroll tracking with new rarity
            rerollData = window.rerollSystem.trackReroll(originalRarity, this.creatureGenetics.rarity, rerollData);
            state.set('rerollSystem', rerollData);

            console.log(`hatch:info [HatchingScene] Reroll complete: ${originalRarity} → ${this.creatureGenetics.rarity}`);

            // Set rerolled creature in system
            window.rerollSystem.setRerolledCreature({
                genetics: this.creatureGenetics,
                rarity: this.creatureGenetics.rarity
            });

            // Show new rarity reveal
            this.time.delayedCall(1000, () => {
                console.log('hatch:info [HatchingScene] Showing new rarity reveal and final keep button');
                this.showRarityReveal();

                // Show ONLY keep button (no second reroll)
                this.showFinalKeepButton();
            });
        } else {
            console.error('hatch:error [HatchingScene] Failed to create creature result');
            this.showRerollError('Creature generation failed - please try again');
        }
    }

    /**
     * Show final KEEP button after reroll (no second reroll allowed)
     */
    showFinalKeepButton() {
        const buttonY = 500;

        const keepBg = this.add.graphics();
        keepBg.fillStyle(0x228B22, 0.9);
        keepBg.fillRoundedRect(325, buttonY, 150, 50, 10);
        keepBg.lineStyle(3, 0xFFD54F);
        keepBg.strokeRoundedRect(325, buttonY, 150, 50, 10);

        const keepText = this.add.text(400, buttonY + 25, '✓ KEEP THIS ONE', {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const keepZone = this.add.zone(325, buttonY, 150, 50).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

        const finalText = this.add.text(400, 450, '✅ This is your final creature!', {
            fontSize: '16px',
            color: '#90EE90'
        }).setOrigin(0.5);

        [keepBg, keepText, finalText].forEach(el => {
            el.setAlpha(0);
            this.tweens.add({
                targets: el,
                alpha: 1,
                duration: 500,
                ease: 'Power2'
            });
        });

        keepZone.on('pointerdown', () => this.handleKeepCreature());
        keepZone.on('pointerover', () => {
            keepBg.clear();
            keepBg.fillStyle(0x32CD32, 0.9);
            keepBg.fillRoundedRect(325, buttonY, 150, 50, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(325, buttonY, 150, 50, 10);
        });
        keepZone.on('pointerout', () => {
            keepBg.clear();
            keepBg.fillStyle(0x228B22, 0.9);
            keepBg.fillRoundedRect(325, buttonY, 150, 50, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(325, buttonY, 150, 50, 10);
        });

        this.keepUI = { keepBg, keepText, keepZone };
        this.finalText = finalText;
    }

    /**
     * Show error message when reroll fails
     */
    showRerollError(message) {
        const errorText = this.add.text(400, 300, `⚠️ ${message}`, {
            fontSize: '24px',
            color: '#FF6B6B',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: 600 }
        }).setOrigin(0.5);

        errorText.setAlpha(0);
        this.tweens.add({
            targets: errorText,
            alpha: 1,
            duration: 500
        });

        // Show retry button after delay
        this.time.delayedCall(2000, () => {
            this.showFinalKeepButton();
        });
    }

    /**
     * Cleanup reroll UI elements
     */
    cleanupRerollUI() {
        if (this.rarityBanner) {
            Object.values(this.rarityBanner).forEach(el => el && el.destroy());
            this.rarityBanner = null;
        }
        if (this.keepUI) {
            Object.values(this.keepUI).forEach(el => el && el.destroy());
            this.keepUI = null;
        }
        if (this.rerollUI) {
            Object.values(this.rerollUI).forEach(el => el && el.destroy());
            this.rerollUI = null;
        }
        if (this.adviceText) {
            this.adviceText.destroy();
            this.adviceText = null;
        }
        if (this.finalText) {
            this.finalText.destroy();
            this.finalText = null;
        }
    }

    // ==========================================
    // ENHANCED HOME SCREEN UI METHODS
    // ==========================================

    /**
     * Create enhanced starfield background with depth
     */
    createEnhancedBackground() {
        // Deep space gradient background - responsive to screen size
        const { width, height } = this.scale;
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x2C1B47, 0x4A148C, 0x6A1B9A, 0x4A148C, 1);
        bg.fillRect(0, 0, width, height);

        // Add nebula clouds
        for (let i = 0; i < 3; i++) {
            const nebula = this.add.graphics();
            nebula.fillStyle(0x9C27B0, 0.1 + Math.random() * 0.1);
            nebula.fillCircle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(100, 200)
            );
            nebula.setBlendMode(Phaser.BlendModes.ADD);

            // Slow drift animation
            this.tweens.add({
                targets: nebula,
                x: nebula.x + Phaser.Math.Between(-50, 50),
                y: nebula.y + Phaser.Math.Between(-30, 30),
                duration: Phaser.Math.Between(8000, 12000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Multiple star layers for parallax depth
        for (let layer = 0; layer < 3; layer++) {
            const starCount = 30 - (layer * 8);
            const starSize = 1 + layer;
            const twinkleSpeed = 1500 + (layer * 500);

            for (let i = 0; i < starCount; i++) {
                const star = this.add.circle(
                    Phaser.Math.Between(0, width),
                    Phaser.Math.Between(0, height),
                    starSize,
                    0xFFFFFF,
                    0.3 + (layer * 0.3)
                );

                // Twinkling animation
                this.tweens.add({
                    targets: star,
                    alpha: 0.1 + Math.random() * 0.3,
                    duration: twinkleSpeed,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: Math.random() * 1000
                });
            }
        }
    }

    /**
     * Create animated stardust particles
     */
    createStardustParticles() {
        // Create floating stardust particles
        const { width, height } = this.scale;
        for (let i = 0; i < 15; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                2,
                0xFFD54F,
                0.6
            );

            // Floating animation
            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(100, 200),
                x: particle.x + Phaser.Math.Between(-20, 20),
                alpha: 0,
                duration: Phaser.Math.Between(4000, 6000),
                ease: 'Sine.easeOut',
                delay: Math.random() * 2000,
                repeat: -1,
                onRepeat: () => {
                    particle.y = 650;
                    particle.x = Phaser.Math.Between(0, 800);
                    particle.alpha = 0.6;
                }
            });
        }
    }

    /**
     * Create enhanced title with glow effect
     */
    createEnhancedTitle() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const titleY = Math.min(120, height * 0.15);
        const panelWidth = Math.min(400, width * 0.6);
        const panelHeight = 120;

        // Glassmorphic panel behind title
        const titlePanel = this.add.graphics();
        titlePanel.fillStyle(0xFFFFFF, 0.1);
        titlePanel.fillRoundedRect(centerX - panelWidth/2, titleY - 40, panelWidth, panelHeight, 20);
        titlePanel.lineStyle(2, 0xFFD54F, 0.5);
        titlePanel.strokeRoundedRect(centerX - panelWidth/2, titleY - 40, panelWidth, panelHeight, 20);

        // Main title with glow
        const titleText = this.add.text(centerX, titleY, 'MYTHICAL VOID', {
            fontSize: '64px',
            color: '#FFD54F',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            stroke: '#7B1FA2',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Add glow effect
        titleText.setStyle({
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(255, 213, 79, 0.8)',
                blur: 20,
                stroke: true,
                fill: false
            }
        });

        // Pulsing glow animation
        this.tweens.add({
            targets: titleText,
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Subtitle
        const subtitleText = this.add.text(centerX, titleY + 70, 'Where Space Meets Magic', {
            fontSize: '20px',
            color: '#000000',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'italic'
        }).setOrigin(0.5);
    }

    /**
     * Create enhanced START button with glassmorphism
     */
    createEnhancedStartButton() {
        const { width, height } = this.scale;
        const buttonX = width / 2;
        const buttonY = height / 2;

        // Responsive button sizing for mobile
        const buttonSize = MobileHelpers.getButtonSize(this.scale, { width: 340, height: 95 });
        const buttonWidth = buttonSize.width;
        const buttonHeight = buttonSize.height;

        // Create container for the button
        const buttonContainer = this.add.container(buttonX, buttonY);

        // LAYERED GLOW SYSTEM - Creates magnetic visual pull
        const outerGlow = this.add.graphics();
        outerGlow.fillStyle(0xFF6B35, 0.12);
        outerGlow.fillRoundedRect(-buttonWidth/2 - 24, -buttonHeight/2 - 24, buttonWidth + 48, buttonHeight + 48, 28);
        outerGlow.setBlendMode(Phaser.BlendModes.ADD);

        const middleGlow = this.add.graphics();
        middleGlow.fillStyle(0xFF6B35, 0.2);
        middleGlow.fillRoundedRect(-buttonWidth/2 - 14, -buttonHeight/2 - 14, buttonWidth + 28, buttonHeight + 28, 24);
        middleGlow.setBlendMode(Phaser.BlendModes.ADD);

        const innerGlow = this.add.graphics();
        innerGlow.fillStyle(0xFF6B35, 0.3);
        innerGlow.fillRoundedRect(-buttonWidth/2 - 5, -buttonHeight/2 - 5, buttonWidth + 10, buttonHeight + 10, 20);
        innerGlow.setBlendMode(Phaser.BlendModes.ADD);

        // WARM GRADIENT BACKGROUND - Orange (urgency) to yellow (optimism)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0xFF6B35, 0xFF6B35, 0xFFB347, 0xFFB347, 1, 1, 1, 1);
        bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 18);

        // Bright border for definition
        bg.lineStyle(3, 0xFFFFFF, 0.95);
        bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 18);

        // Top shine for 3D depth
        const shine = this.add.graphics();
        shine.fillStyle(0xFFFFFF, 0.22);
        shine.fillRoundedRect(-buttonWidth/2 + 8, -buttonHeight/2 + 8, buttonWidth - 16, buttonHeight/2 - 10, 14);

        // POWER WORDS - Action-oriented, benefit-focused (responsive font size)
        const fontSize = MobileHelpers.getFontSize(this.scale, 28);
        const buttonText = this.add.text(0, 0, 'START YOUR ADVENTURE', {
            fontSize: fontSize,
            color: '#FFFFFF',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: '900',
            align: 'center',
            stroke: '#8B3000',
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 2,
                color: 'rgba(0,0,0,0.35)',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        // ROCKET EMOJI - Visual anchor + emotional connection
        const rocket = this.add.text(0, -33, '🚀', {
            fontSize: '36px'
        }).setOrigin(0.5);

        // URGENCY PULSE DOT - Triggers FOMO
        const urgencyDot = this.add.circle(buttonWidth/2 - 22, -buttonHeight/2 + 14, 5, 0x00FF88, 1);

        buttonContainer.add([outerGlow, middleGlow, innerGlow, bg, shine, rocket, buttonText, urgencyDot]);

        // Mobile-optimized touch hit area
        MobileHelpers.setTouchHitArea(buttonContainer, buttonWidth, buttonHeight, 30);

        // BREATHING ANIMATION - Subconscious familiarity
        this.tweens.add({
            targets: buttonContainer,
            scaleX: 1.025,
            scaleY: 1.025,
            duration: 2200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // LAYERED GLOW PULSE - Energy feeling
        this.tweens.add({
            targets: [outerGlow, middleGlow, innerGlow],
            alpha: '-=0.08',
            duration: 1900,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // URGENCY DOT PULSE - FOMO trigger
        this.tweens.add({
            targets: urgencyDot,
            alpha: 0.4,
            scale: 1.4,
            duration: 1100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // ROCKET FLOAT - Motion draws attention
        this.tweens.add({
            targets: rocket,
            y: -35,
            duration: 1600,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // HOVER - Immediate dopamine feedback
        buttonContainer.on('pointerover', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1.09,
                scaleY: 1.09,
                duration: 160,
                ease: 'Back.easeOut.config(1.4)'
            });
            this.tweens.add({
                targets: [outerGlow, middleGlow, innerGlow],
                alpha: '+=0.25',
                duration: 160
            });
            this.tweens.add({
                targets: buttonText,
                y: -3,
                duration: 160,
                ease: 'Back.easeOut'
            });
            this.tweens.add({
                targets: rocket,
                angle: -12,
                scale: 1.2,
                duration: 160
            });
        });

        buttonContainer.on('pointerout', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
            this.tweens.add({
                targets: [outerGlow, middleGlow, innerGlow],
                alpha: '-=0.25',
                duration: 200
            });
            this.tweens.add({
                targets: buttonText,
                y: 0,
                duration: 200
            });
            this.tweens.add({
                targets: rocket,
                angle: 0,
                scale: 1,
                duration: 200
            });
        });

        // CLICK - Tactile satisfaction & reward
        buttonContainer.on('pointerdown', () => {
            console.log('🚀 START GAME button clicked!');

            // Haptic feedback for mobile
            MobileHelpers.vibrate(50);

            // Squash effect
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 0.94,
                scaleY: 0.94,
                duration: 85,
                ease: 'Power2'
            });
            // Flash
            this.tweens.add({
                targets: shine,
                alpha: 0.55,
                duration: 85
            });
        });

        buttonContainer.on('pointerup', () => {
            // Satisfying bounce back
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1.06,
                scaleY: 1.06,
                duration: 110,
                ease: 'Back.easeOut'
            });

            // Success burst
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                const distance = 90;
                const particle = this.add.circle(buttonX, buttonY, 5, 0xFFD700, 1);
                this.tweens.add({
                    targets: particle,
                    x: buttonX + Math.cos(angle) * distance,
                    y: buttonY + Math.sin(angle) * distance,
                    alpha: 0,
                    scale: 0,
                    duration: 650,
                    ease: 'Power2.easeOut',
                    onComplete: () => particle.destroy()
                });
            }

            // Fade and transition
            this.tweens.add({
                targets: buttonContainer,
                alpha: 0,
                scaleX: 1.25,
                scaleY: 1.25,
                duration: 350,
                delay: 150,
                ease: 'Back.easeIn',
                onComplete: () => {
                    this.showHatchingScreen();
                }
            });
        });

        this.startButton = buttonContainer;
    }

    /**
     * Create feature preview cards
     */
    createFeatureCards() {
        const { width, height } = this.scale;
        const cardWidth = 180;
        const cardHeight = 120;
        const centerX = width / 2;
        const cardY = height - 180;
        const spacing = Math.min(215, width / 4);

        const cards = [
            { icon: '🥚', title: 'HATCH', desc: 'Discover your\nunique companion', x: centerX - spacing, color: 0xFFD54F },
            { icon: '✨', title: 'EVOLVE', desc: 'Unlock cosmic\npowers', x: centerX, color: 0xB39DDB },
            { icon: '🌍', title: 'EXPLORE', desc: 'Navigate vast\nstar systems', x: centerX + spacing, color: 0x80CBC4 }
        ];

        cards.forEach(card => {
            // Glassmorphic card with subtle gradient
            const cardBg = this.add.graphics();
            cardBg.fillStyle(0xFFFFFF, 0.12);
            cardBg.fillRoundedRect(card.x - cardWidth/2, cardY, cardWidth, cardHeight, 12);
            cardBg.lineStyle(2, card.color, 0.5);
            cardBg.strokeRoundedRect(card.x - cardWidth/2, cardY, cardWidth, cardHeight, 12);

            // Icon
            const icon = this.add.text(card.x, cardY + 30, card.icon, {
                fontSize: '40px'
            }).setOrigin(0.5);

            // Title
            const title = this.add.text(card.x, cardY + 70, card.title, {
                fontSize: '18px',
                color: '#FFD54F',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Description
            const desc = this.add.text(card.x, cardY + 100, card.desc, {
                fontSize: '12px',
                color: '#B39DDB',
                fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
                align: 'center'
            }).setOrigin(0.5);

            // Hover animation
            const cardContainer = this.add.container(0, 0, [cardBg, icon, title, desc]);
            cardContainer.setSize(cardWidth, cardHeight);
            cardContainer.setInteractive({ cursor: 'pointer' });

            cardContainer.on('pointerover', () => {
                this.tweens.add({
                    targets: [icon, title, desc],
                    y: '+=- 5',
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            });

            cardContainer.on('pointerout', () => {
                this.tweens.add({
                    targets: [icon, title, desc],
                    y: '+= 5',
                    duration: 200,
                    ease: 'Back.easeIn'
                });
            });
        });
    }

    /**
     * Create bottom hint text
     */
    createBottomHints() {
        const { width, height } = this.scale;
        const hintText = this.add.text(width / 2, height - 30, 'Click BEGIN ADVENTURE to start your cosmic journey!', {
            fontSize: '16px',
            color: '#000000',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            align: 'center'
        }).setOrigin(0.5);

        // Gentle fade animation
        this.tweens.add({
            targets: hintText,
            alpha: 0.6,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create star burst particle effect
     */
    createStartBurstEffect(x, y) {
        // Create particles radiating outward
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const distance = 60;

            const particle = this.add.circle(x, y, 4, 0xFFD54F, 1);

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scale: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }

        // Central flash
        const flash = this.add.circle(x, y, 20, 0xFFFFFF, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
            targets: flash,
            scale: 3,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
    }

    /**
     * Handle start game button click
     */
    handleStartGame() {
        const state = getGameState();

        // Mark game as started
        state.set('session.gameStarted', true);
        console.log('✅ Set gameStarted to true');

        // CRITICAL: Reset creature to unhatched state for fresh game flow
        state.set('creature.hatched', false);
        state.set('creature.name', 'Your Creature');
        state.set('creature.hatchTime', null);
        state.set('creature.experience', 0);
        state.set('creature.level', 1);
        console.log('✅ Set creature.hatched to false');

        // Reset creature stats to defaults
        state.set('creature.stats', {
            happiness: 100,
            energy: 100,
            health: 100
        });

        // Clear personality and genes to regenerate fresh
        state.set('creature.personality', null);
        state.set('creature.genes', null);

        console.log('🔄 Creature reset complete - forcing save before scene transition...');

        // CRITICAL: Force immediate save to localStorage before scene restart
        state.save();

        // Verify the state before restarting
        console.log('🔍 Pre-restart verification:');
        console.log('  gameStarted:', state.get('session.gameStarted'));
        console.log('  creatureHatched:', state.get('creature.hatched'));

        // Restart scene to trigger hatching flow
        this.scene.restart();
    }
}

export default HatchingScene;

if (typeof window !== 'undefined') {
    window.HatchingScene = HatchingScene;
}
