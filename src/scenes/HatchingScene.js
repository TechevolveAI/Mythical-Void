/**
 * HatchingScene - The first scene where the player clicks an egg to hatch their mythical creature
 * Features: floating egg animation, progressive hatching with color changes, sparkle effects
 */

import hatchCinematicsConfig from '../config/hatch-cinematics.json';
import evolutionConfig from '../config/evolution.json';
import MobileHelpers from '../utils/mobile-helpers.js';
const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

// Make evolution config available globally for GraphicsEngine and other systems
if (typeof window !== 'undefined') {
    window.evolutionConfig = evolutionConfig;
    console.log('[HatchingScene] Evolution config loaded globally:', {
        visionEnabled: evolutionConfig?.hatching?.visionReveal?.enabled,
        visionDuration: evolutionConfig?.hatching?.visionReveal?.visionDuration,
        babyScale: evolutionConfig?.stages?.baby?.visual?.scale,
        babySaturation: evolutionConfig?.stages?.baby?.visual?.colorSaturation
    });
}

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

        // Egg hatching mode properties
        this.isEggHatch = false;
        this.eggType = null; // 'cosmic' or 'stellar'
        this.spawnPosition = null; // Where to spawn new creature
    }

    /**
     * Initialize scene with data (used for egg hatching)
     */
    init(data) {
        // Reset all scene state properties (important for scene restarts)
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null;
        this.creatureDNA = null;
        this.rarityInfo = null;
        this.eggTextureName = null;

        // Set egg hatching properties from passed data
        this.isEggHatch = data?.isEggHatch || false;
        this.eggType = data?.eggType || null;
        this.spawnPosition = data?.spawnPosition || null;
    }

    preload() {
        // Nothing to preload - sprites created in create()
    }

    create() {
        // Stop all other scenes to ensure clean display
        const scenesToStop = ['GameScene', 'InventoryScene', 'ShopScene'];
        scenesToStop.forEach(sceneKey => {
            try {
                this.scene.stop(sceneKey);
            } catch (e) {
                // Scene might not exist - that's fine
            }
        });
        this.scene.bringToTop();

        const GameState = getGameState();

        // Set current scene in GameState
        GameState.set('session.currentScene', 'HatchingScene');

        // Check game flow state
        const gameStarted = GameState.get('session.gameStarted') || false;
        const creatureHatched = GameState.get('creature.hatched') || false;
        const creatureName = GameState.get('creature.name');
        const creatureNamed = creatureName && creatureName !== 'Your Creature';

        // ⚠️ CRITICAL SECTION - DO NOT MODIFY - GAME FLOW LOGIC
        // This logic ensures the correct scene flow: Home → Hatch → Personality → Name → Game
        // See GAME_FLOW_DOCUMENTATION.md for details
        // 🚨 PROTECTED CODE - ANY CHANGES REQUIRE TEAM REVIEW 🚨

        // Special handling for egg hatching from inventory
        if (this.isEggHatch) {
            // Store spawn position for GameScene
            if (this.spawnPosition) {
                GameState.set('creature.spawnPosition', this.spawnPosition);
            }
            this.showHatchingScreen();
            return;
        }

        // Determine which state to show based on game progress
        if (!gameStarted) {
            // Show home screen first if game hasn't been started
            this.showHomeScreen();
            return;
        } else if (gameStarted && !creatureHatched) {
            // Game started but creature not hatched - show hatching process
            this.showHatchingScreen();
        } else if (gameStarted && creatureHatched && !creatureNamed) {
            // Hatched but not named - go to personality scene
            this.scene.start('PersonalityScene');
            return;
        } else if (gameStarted && creatureHatched && creatureNamed) {
            // Fully set up - go to game scene
            this.scene.start('GameScene');
            return;
        } else {
            // Fallback to home screen
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
        console.log('[HatchingScene] 🥚 Showing hatching screen with audio');

        // Play suspenseful ambient sound
        if (window.AudioManager) {
            window.AudioManager.playSuspenseAmbient();
            console.log('[HatchingScene] 🎵 Playing suspense ambient sound');
        }

        // Initialize enhanced graphics engine
        const GraphicsEngine = getGraphicsEngine();
        this.graphicsEngine = new GraphicsEngine(this);

        // Generate creature genetics early so egg can have proper rarity pattern
        this.generateCreatureGenetics();

        // Create enhanced programmatic sprites (now with rarity info)
        this.createEnhancedSprites();

        // Add audio indicator
        this.createAudioIndicator();

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

        // Show tutorial hints for first-time players
        if (!this.hasSeenTutorial()) {
            // Create visual pointer to egg
            this.createTutorialPointer();

            // Show initial tutorial hint after a brief delay
            this.time.delayedCall(1000, () => {
                this.showTutorialHint('preHatch');
            });
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

            // Play button click sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            const state = getGameState();

            // Mark game as started
            state.set('session.gameStarted', true);
            console.log('✅ Set gameStarted to true');

            // CRITICAL: Reset creature collection to clear old test creatures
            if (state.resetCreatureCollection) {
                state.resetCreatureCollection();
                console.log('✅ Reset creature collection for fresh start');
            }

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
            
            // Clear personality, genes, DNA, and personality state to regenerate fresh
            state.set('creature.personality', null);
            state.set('creature.genes', null);
            state.set('creature.dna', null);
            state.set('creature.personalityState', null);
            
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
        // Get rarity from creature DNA (generated in showHatchingScreen)
        const rarityKey = this.creatureDNA?.raritySignature || 'common';

        // Create enhanced egg with rarity-specific pattern
        const eggTextureName = this.createEnhancedEgg(rarityKey);

        // Store texture name for later use
        this.eggTextureName = eggTextureName || 'enhancedEgg_common';

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

    createEnhancedEgg(rarityKey = 'common') {
        // Load rarity config if not already loaded
        if (!this.rarityConfig) {
            try {
                this.rarityConfig = require('../config/rarity-config.json');
            } catch (error) {
                console.warn('hatching:warn [HatchingScene] Could not load rarity config, using defaults');
                this.rarityConfig = {};
            }
        }

        // Get rarity-specific egg configuration
        const rarityData = this.rarityConfig[rarityKey] || this.rarityConfig.common || {};
        const eggConfig = rarityData.egg || {
            baseColor: '#90EE90',
            pattern: 'speckled',
            patternColor: '#7CFC00',
            shimmer: 0.3
        };

        // Convert hex colors to numbers for Phaser
        const baseColor = parseInt(eggConfig.baseColor.replace('#', ''), 16);
        const patternColor = parseInt(eggConfig.patternColor.replace('#', ''), 16);

        // Check if texture already exists (prevent duplicate textures on scene restart)
        const textureName = `enhancedEgg_${rarityKey}`;
        if (this.textures.exists(textureName)) {
            console.log(`hatching:info [HatchingScene] Egg texture ${textureName} already exists, skipping generation`);
            return textureName;
        }

        const graphics = this.add.graphics();
        const center = { x: 50, y: 75 };

        // === RARITY-ENHANCED EGG WITH REALISTIC SHADING ===

        // Egg shadow on ground
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 85, 45);

        // Egg base layer (darkest) - using rarity color darkened
        const darkBase = Phaser.Display.Color.ValueToColor(baseColor).darken(30).color;
        graphics.fillStyle(darkBase);
        graphics.fillEllipse(center.x, center.y, 84, 104);

        // Egg main color (from rarity config)
        graphics.fillStyle(baseColor);
        graphics.fillEllipse(center.x - 2, center.y - 2, 80, 100);

        // Egg highlight (creates 3D roundness) - lighter version of base
        const lightBase = Phaser.Display.Color.ValueToColor(baseColor).lighten(20).color;
        graphics.fillStyle(lightBase);
        graphics.fillEllipse(center.x - 8, center.y - 8, 65, 85);

        // Egg shine (realistic light reflection) with shimmer intensity
        graphics.fillStyle(0xFFFFFF, eggConfig.shimmer);
        graphics.fillEllipse(center.x - 15, center.y - 15, 35, 45);

        // Apply pattern based on rarity
        this.applyEggPattern(graphics, center, eggConfig.pattern, patternColor, eggConfig.shimmer);

        // Egg outline for definition
        graphics.lineStyle(2, 0x8B4513, 0.8);
        graphics.strokeEllipse(center.x - 2, center.y - 2, 80, 100);

        graphics.generateTexture(textureName, 100, 150);
        graphics.destroy();

        return textureName;
    }

    /**
     * Apply pattern to egg based on rarity configuration
     */
    applyEggPattern(graphics, center, pattern, patternColor, shimmer) {
        switch (pattern) {
            case 'speckled': // Common
                const spots = [
                    { x: 35, y: 60, size: 8 },
                    { x: 65, y: 85, size: 6 },
                    { x: 45, y: 95, size: 5 },
                    { x: 30, y: 80, size: 4 },
                    { x: 55, y: 65, size: 3 }
                ];
                spots.forEach(spot => {
                    graphics.fillStyle(patternColor, 0.8);
                    graphics.fillCircle(center.x + spot.x - 50, center.y + spot.y - 75, spot.size);
                });
                break;

            case 'striped': // Unusual
                for (let i = 0; i < 5; i++) {
                    graphics.fillStyle(patternColor, 0.4 + i * 0.1);
                    graphics.fillRect(center.x - 40, center.y - 40 + i * 20, 80, 8);
                }
                break;

            case 'crystalline': // Rare
                const crystalPoints = [
                    [center.x - 20, center.y - 30],
                    [center.x + 10, center.y - 20],
                    [center.x - 15, center.y + 10],
                    [center.x + 15, center.y + 20]
                ];
                crystalPoints.forEach(([x, y]) => {
                    graphics.fillStyle(patternColor, shimmer);
                    graphics.fillTriangle(x, y, x + 8, y + 12, x - 8, y + 12);
                    graphics.fillStyle(0xFFFFFF, shimmer * 1.5);
                    graphics.fillTriangle(x, y, x + 4, y + 6, x - 4, y + 6);
                });
                break;

            case 'cosmic': // Epic
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const radius = 35 + Math.sin(angle * 3) * 8;
                    const x = center.x + Math.cos(angle) * radius;
                    const y = center.y + Math.sin(angle) * radius * 1.2;
                    graphics.fillStyle(patternColor, shimmer);
                    graphics.fillCircle(x, y, 3 + Math.sin(angle * 5) * 2);
                }
                break;

            case 'radiant': // Legendary
                const rays = 8;
                for (let i = 0; i < rays; i++) {
                    const angle = (i / rays) * Math.PI * 2;
                    graphics.lineStyle(2, patternColor, shimmer);
                    graphics.lineBetween(
                        center.x,
                        center.y,
                        center.x + Math.cos(angle) * 40,
                        center.y + Math.sin(angle) * 50
                    );
                }
                // Add central glow
                graphics.fillStyle(0xFFFFFF, shimmer);
                graphics.fillCircle(center.x, center.y, 10);
                break;

            case 'nebula': // Mythic
                for (let i = 0; i < 20; i++) {
                    const x = center.x + Phaser.Math.Between(-35, 35);
                    const y = center.y + Phaser.Math.Between(-45, 45);
                    const size = Phaser.Math.Between(2, 6);
                    graphics.fillStyle(patternColor, shimmer * Phaser.Math.FloatBetween(0.3, 0.9));
                    graphics.fillCircle(x, y, size);
                }
                break;

            case 'glitched': // Secret
                // Intentional "glitch" effect with random rectangles
                for (let i = 0; i < 15; i++) {
                    const x = center.x + Phaser.Math.Between(-40, 40);
                    const y = center.y + Phaser.Math.Between(-50, 50);
                    const w = Phaser.Math.Between(5, 15);
                    const h = Phaser.Math.Between(2, 8);
                    graphics.fillStyle(patternColor, Phaser.Math.FloatBetween(0.3, 1.0));
                    graphics.fillRect(x, y, w, h);
                }
                // Add cyan/magenta glitch offsets
                graphics.fillStyle(0x00FFFF, 0.3);
                graphics.fillEllipse(center.x - 3, center.y, 80, 100);
                graphics.fillStyle(0xFF00FF, 0.3);
                graphics.fillEllipse(center.x + 3, center.y, 80, 100);
                break;

            default:
                // Default to speckled
                this.applyEggPattern(graphics, center, 'speckled', patternColor, shimmer);
        }
    }

    createEnhancedClouds() {
        // Check if texture already exists
        if (this.textures.exists('enhancedCloud')) {
            return;
        }

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
        // MOBILE-RESPONSIVE cloud positioning
        const { width, height } = this.scale;

        // Add floating enhanced clouds
        this.clouds = this.add.group();
        const cloudCount = width < 600 ? 3 : 4; // Fewer clouds on mobile

        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.add.image(
                Phaser.Math.Between(width * 0.1, width * 0.9),  // 10%-90% of screen width
                Phaser.Math.Between(height * 0.08, height * 0.25), // Top 8%-25% of screen
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
        // MOBILE-RESPONSIVE ground positioning
        const { width, height } = this.scale;
        const groundY = height * 0.83; // Ground at 83% down the screen
        const groundHeight = height * 0.17; // Ground is 17% of screen height

        // Create green ground at the bottom
        const ground = this.add.graphics();
        ground.fillStyle(0x228B22); // Forest green
        ground.fillRect(0, groundY, width, groundHeight);

        // Add some grass details - responsive count based on width
        ground.fillStyle(0x32CD32); // Lime green
        const grassCount = Math.floor(width / 40); // One grass tuft per 40px
        for (let i = 0; i < grassCount; i++) {
            const x = i * 40 + Phaser.Math.Between(-10, 10);
            ground.fillTriangle(x, groundY, x + 5, groundY - 10, x + 10, groundY);
        }
    }

    createEgg() {
        // FIX #3: Improved cleanup - kill tweens AND destroy sprite to prevent duplication
        if (this.egg) {
            this.tweens.killTweensOf(this.egg);
            this.egg.destroy();
            this.egg = null;
        }

        // MOBILE-RESPONSIVE egg positioning
        // Center the egg in the middle of the viewport
        const { width, height } = this.scale;
        const eggX = width / 2;
        const eggY = height * 0.45;

        // Stellar egg golden aura effect
        if (this.isEggHatch && this.eggType === 'stellar') {
            // Outer golden glow
            this.stellarGlow = this.add.graphics();
            this.stellarGlow.fillStyle(0xFFD700, 0.15);
            this.stellarGlow.fillCircle(eggX, eggY, 120);
            this.stellarGlow.fillStyle(0xFFD700, 0.25);
            this.stellarGlow.fillCircle(eggX, eggY, 80);
            this.stellarGlow.fillStyle(0xFFA500, 0.3);
            this.stellarGlow.fillCircle(eggX, eggY, 50);

            // Pulsing animation for glow
            this.tweens.add({
                targets: this.stellarGlow,
                alpha: { from: 1, to: 0.6 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Golden particles orbiting the egg
            this.stellarParticles = [];
            for (let i = 0; i < 12; i++) {
                const particle = this.add.graphics();
                particle.fillStyle(0xFFD700, 0.9);
                particle.fillCircle(0, 0, 4);
                particle.fillStyle(0xFFFFFF, 0.8);
                particle.fillCircle(0, 0, 2);
                particle.setPosition(eggX, eggY);

                // Orbit animation
                const angle = (i / 12) * Math.PI * 2;
                const radius = 90;
                this.tweens.add({
                    targets: particle,
                    x: { from: eggX + Math.cos(angle) * radius, to: eggX + Math.cos(angle + Math.PI * 2) * radius },
                    y: { from: eggY + Math.sin(angle) * radius, to: eggY + Math.sin(angle + Math.PI * 2) * radius },
                    duration: 4000,
                    repeat: -1,
                    ease: 'Linear'
                });

                this.stellarParticles.push(particle);
            }

            console.log('hatch:info [HatchingScene] ✨ Stellar egg golden visuals created');
        }

        // Use rarity-specific egg texture
        const textureName = this.eggTextureName || 'enhancedEgg_common';
        this.egg = this.add.image(eggX, eggY, textureName);  // Slightly above center

        // Apply golden tint for Stellar eggs
        if (this.isEggHatch && this.eggType === 'stellar') {
            this.egg.setTint(0xFFE4B5); // Soft golden tint
        }

        // IMPORTANT: Set scale BEFORE interactive to ensure hit area matches visual size
        this.egg.setScale(1.2);

        // LARGE touch area for easy clicking - significantly bigger than the egg
        // This ensures clicking anywhere near the egg will trigger hatching
        const isMobile = MobileHelpers.isMobile();
        const hitAreaPadding = isMobile ? 80 : 60; // Even larger hit area
        // Now the hit area will correctly match the scaled egg size PLUS generous padding
        this.egg.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, (this.egg.width / 2) + hitAreaPadding),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            cursor: isMobile ? 'default' : 'pointer'
        });

        // CRITICAL FIX: Attach click handler HERE immediately after making egg interactive
        // This ensures the handler is ALWAYS attached when egg is created/recreated
        // Previously this was in setupInput() which meant handlers were lost on egg recreation
        this.egg.on('pointerdown', () => {
            console.log('🥚 EGG CLICKED! Starting hatching sequence...');

            if (!this.hatchingStarted && !this.creatureAppeared) {
                MobileHelpers.vibrate(30); // Gentle haptic feedback

                // Hide "Tap to Hatch" text on first click
                if (this.tapToHatchText) {
                    this.tweens.add({
                        targets: this.tapToHatchText,
                        alpha: 0,
                        scale: 0.8,
                        duration: 300,
                        onComplete: () => {
                            this.tapToHatchText.destroy();
                            this.tapToHatchText = null;
                        }
                    });
                }

                this.startHatching();
            } else {
                console.log('🥚 Egg click ignored - hatching already in progress or creature appeared');
            }
        });

        // Create floating animation for the egg
        this.tweens.add({
            targets: this.egg,
            y: this.egg.y - 20,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Add "Tap to Hatch" instruction text (Quick Win #1 from QA Audit)
        this.createTapToHatchText();
    }

    setupInput() {
        // NOTE: Egg click handler is now attached directly in createEgg()
        // This ensures the handler persists when egg is recreated

        // Handle space key for scene transition (with null check for touch devices)
        if (this.input.keyboard) {
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
    }

    /**
     * Check if player has seen the tutorial before
     * @returns {boolean} True if tutorial has been seen
     */
    hasSeenTutorial() {
        const gameState = getGameState();
        return gameState.get('tutorial.hatchingSeen') || false;
    }

    /**
     * Mark the hatching tutorial as seen
     */
    markTutorialSeen() {
        const gameState = getGameState();
        gameState.set('tutorial.hatchingSeen', true);
        console.log('[HatchingScene] Tutorial marked as seen');
    }

    /**
     * Create a visual pointer/indicator to guide player to the egg
     */
    createTutorialPointer() {
        if (this.hasSeenTutorial() || this.tutorialPointer) {
            return; // Don't show if already seen or already exists
        }

        const { width, height } = this.scale;
        const eggX = width / 2;
        const eggY = height * 0.45;

        // Create animated arrow pointing down at the egg
        const arrowGraphics = this.add.graphics();
        arrowGraphics.fillStyle(0xFFD700, 1);

        // Draw arrow shape
        const arrowSize = 30;
        const arrowX = eggX;
        const arrowY = eggY - 100;

        arrowGraphics.beginPath();
        arrowGraphics.moveTo(arrowX, arrowY);
        arrowGraphics.lineTo(arrowX - arrowSize/2, arrowY - arrowSize);
        arrowGraphics.lineTo(arrowX + arrowSize/2, arrowY - arrowSize);
        arrowGraphics.closePath();
        arrowGraphics.fillPath();

        // Draw arrow shaft
        arrowGraphics.fillRect(arrowX - 5, arrowY - arrowSize - 20, 10, 20);

        this.tutorialPointer = arrowGraphics;

        // Animate the pointer with bouncing effect
        this.tweens.add({
            targets: this.tutorialPointer,
            y: '+=15',
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Add glow effect
        this.tweens.add({
            targets: this.tutorialPointer,
            alpha: 0.6,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        console.log('[HatchingScene] Tutorial pointer created');
    }

    /**
     * Show contextual tutorial hint based on current state
     * @param {string} stage - Tutorial stage: 'preHatch', 'hatching', 'postHatch'
     */
    showTutorialHint(stage) {
        if (this.hasSeenTutorial()) {
            return; // Skip hints for experienced players
        }

        const { width, height } = this.scale;
        let hintText = '';
        let duration = 4000;

        switch (stage) {
            case 'preHatch':
                hintText = '💡 Tip: Click anywhere on or near the egg to begin!';
                break;
            case 'hatching':
                hintText = '✨ Your creature is hatching! Watch as it reveals its unique traits...';
                duration = 3000;
                break;
            case 'postHatch':
                hintText = '🎉 Amazing! Next you\'ll choose its personality and give it a name.';
                duration = 5000;
                break;
            default:
                return;
        }

        // Remove existing hint if present
        if (this.tutorialHintText) {
            this.tweens.killTweensOf(this.tutorialHintText);
            this.tutorialHintText.destroy();
        }

        // Create hint text
        this.tutorialHintText = this.add.text(width / 2, height * 0.75, hintText, {
            fontSize: '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 20, y: 10 },
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5).setAlpha(0);

        // Fade in
        this.tweens.add({
            targets: this.tutorialHintText,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });

        // Auto-dismiss after duration
        this.time.delayedCall(duration, () => {
            if (this.tutorialHintText) {
                this.tweens.add({
                    targets: this.tutorialHintText,
                    alpha: 0,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        if (this.tutorialHintText) {
                            this.tutorialHintText.destroy();
                            this.tutorialHintText = null;
                        }
                    }
                });
            }
        });

        console.log(`[HatchingScene] Showing tutorial hint: ${stage}`);
    }

    createUI() {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // MOBILE-RESPONSIVE font sizes
        const titleFontSize = Math.max(20, Math.min(32, width * 0.07));
        const subtitleFontSize = Math.max(14, Math.min(18, width * 0.04));
        const instructionFontSize = Math.max(16, Math.min(20, width * 0.045));

        // Main title
        const titleText = this.add.text(centerX, height * 0.08, '🌟 Mythical Creature Game 🌟', {
            fontSize: `${titleFontSize}px`,
            color: '#FFD54F',
            stroke: '#7B1FA2',
            strokeThickness: 3,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        const subtitleText = this.add.text(centerX, height * 0.13, 'Your magical adventure begins here!', {
            fontSize: `${subtitleFontSize}px`,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
        }).setOrigin(0.5);

        // Instructions text with better styling and enhanced tutorial hints
        const tutorialText = this.hasSeenTutorial()
            ? '👆 Click the magical egg below to hatch your creature! 👆'
            : '✨ Welcome! Click or tap the egg below to begin.\nYour creature will hatch and reveal its unique traits! ✨';

        this.instructionText = this.add.text(centerX, height * 0.2, tutorialText, {
            fontSize: `${instructionFontSize}px`,
            color: '#FFFFFF',
            stroke: '#7B1FA2',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Add pulsing animation to make instruction more noticeable
        if (!this.hasSeenTutorial()) {
            this.tweens.add({
                targets: this.instructionText,
                scale: 1.05,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

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
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Skip control panel on mobile to simplify UI
        if (width < 600) {
            return;
        }

        // Desktop: Control panel at bottom
        const panelWidth = Math.min(width * 0.9, 700);
        const panelHeight = 100;
        const panelY = height - 120;

        // Control panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.7);
        panelBg.fillRoundedRect(centerX - panelWidth/2, panelY, panelWidth, panelHeight, 15);
        panelBg.lineStyle(3, 0xFFD54F);
        panelBg.strokeRoundedRect(centerX - panelWidth/2, panelY, panelWidth, panelHeight, 15);

        // Instructions
        this.add.text(centerX, panelY + 30, '🎮 Click egg to hatch • SPACE to continue • WASD/Arrows to move', {
            fontSize: '16px',
            color: '#F5F5F5',
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // Game info
        this.add.text(centerX, panelY + 60, '🏆 Hatch → Name → Explore the magical world!', {
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

        // Hide tutorial pointer if present
        if (this.tutorialPointer) {
            this.tweens.add({
                targets: this.tutorialPointer,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.tutorialPointer) {
                        this.tutorialPointer.destroy();
                        this.tutorialPointer = null;
                    }
                }
            });
        }

        // Show hatching tutorial hint
        this.showTutorialHint('hatching');

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

        // Change egg color as it hatches with crack sounds
        if (this.hatchingProgress >= 33 && this.hatchingProgress < 35) {
            // First crack at 33%
            console.log('[HatchingScene] 🔊 First crack sound (33%)');
            if (window.AudioManager) {
                window.AudioManager.playEggCrack();
            }
            // Change to pink
            this.updateEggColor(0xFFC0CB, 0x8B4513); // Pink with brown outline
        } else if (this.hatchingProgress >= 66 && this.hatchingProgress < 68) {
            // Second crack at 66%
            console.log('[HatchingScene] 🔊 Second crack sound (66%)');
            if (window.AudioManager) {
                window.AudioManager.playEggCrack();
            }
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
        console.log('[HatchingScene] 🎉 Egg hatched! Playing celebration sound');

        // Get rarity-specific effects configuration
        const rarityKey = this.creatureDNA?.raritySignature || 'common';
        const rarityConfig = this.rarityConfig?.[rarityKey] || this.rarityConfig?.common || {};
        const hatchEffects = rarityConfig.hatchingEffects || {};
        const celebrationMsg = rarityConfig.celebrationMessage || 'You hatched a wonderful companion!';

        // Play celebration sound
        if (window.AudioManager) {
            window.AudioManager.playHatchCelebration();
        }

        // Add rarity-specific camera effects for Epic+
        const rarityTiers = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
        const rarityTier = rarityTiers.indexOf(rarityKey);
        const isEpicOrHigher = rarityTier >= 3; // Epic and above

        if (isEpicOrHigher) {
            // Camera shake effect
            if (hatchEffects.cameraShake && this.cameras.main) {
                this.cameras.main.shake(300, 0.005);
            }

            // Camera zoom effect
            if (hatchEffects.cameraZoom && this.cameras.main) {
                const originalZoom = this.cameras.main.zoom;
                this.tweens.add({
                    targets: this.cameras.main,
                    zoom: originalZoom + 0.1,
                    duration: 300,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });
            }
        }

        // Add extra sparkles based on rarity
        if (hatchEffects.extraSparkles > 0 && window.FXLibrary) {
            const { width, height } = this.scale;
            const eggX = width / 2;
            const eggY = height * 0.45;

            window.FXLibrary.stardustBurst(this, eggX, eggY, {
                count: hatchEffects.particleCount || 20,
                color: [0xFFD700, 0xFFA500, 0xFFFFFF],
                duration: 2000
            });
        }

        // Show celebration banner
        this.showCelebrationBanner(celebrationMsg, rarityConfig);

        this.hatchingTimer.destroy();
        this.isHatching = false;
        this.progressText.setVisible(false);

        // Update GameState - creature has hatched!
        getGameState().completeHatching();

        // Stop shaking and floating animations
        this.tweens.killTweensOf(this.egg);

        // Make egg disappear with fade effect (with flash intensity based on rarity)
        const flashIntensity = hatchEffects.flashIntensity || 0.2;
        this.createFlashEffect(flashIntensity);

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

    /**
     * Show celebration banner with rarity-specific message
     */
    showCelebrationBanner(message, rarityConfig) {
        const { width, height } = this.scale;

        // Get rarity display name and visual config
        const displayName = rarityConfig.displayName || 'Companion';
        const visualConfig = rarityConfig.visual || {};
        const frameColor = visualConfig.frame ? parseInt(visualConfig.frame.replace('#', ''), 16) : 0x7CFC00;
        const badge = visualConfig.badge || '✨';

        // Create banner background
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(0x000000, 0.7);
        bannerBg.fillRoundedRect(width / 2 - 250, height * 0.15, 500, 100, 15);
        bannerBg.lineStyle(3, frameColor, 1);
        bannerBg.strokeRoundedRect(width / 2 - 250, height * 0.15, 500, 100, 15);
        bannerBg.setDepth(1000);

        // Create banner text
        const bannerText = this.add.text(width / 2, height * 0.15 + 30, `${badge} ${displayName}!`, {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif'
        }).setOrigin(0.5).setDepth(1001);

        const messageText = this.add.text(width / 2, height * 0.15 + 65, message, {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            wordWrap: { width: 480 }
        }).setOrigin(0.5).setDepth(1001);

        // Fade in animation
        bannerBg.setAlpha(0);
        bannerText.setAlpha(0);
        messageText.setAlpha(0);

        this.tweens.add({
            targets: [bannerBg, bannerText, messageText],
            alpha: 1,
            duration: 500,
            ease: 'Sine.easeOut'
        });

        // Scale animation for text
        bannerText.setScale(0.5);
        this.tweens.add({
            targets: bannerText,
            scale: 1,
            duration: 600,
            ease: 'Back.easeOut'
        });

        // Auto-dismiss after 3 seconds
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [bannerBg, bannerText, messageText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    bannerBg.destroy();
                    bannerText.destroy();
                    messageText.destroy();
                }
            });
        });
    }

    /**
     * Create flash effect for hatching
     */
    createFlashEffect(intensity = 0.3) {
        const { width, height } = this.scale;
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, intensity);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(500);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    showCreature() {
        console.log('hatch:info [HatchingScene] === showCreature() called ===');
        this.creatureAppeared = true;

        // Show loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Generating your creature...');
        }

        // Use setTimeout to allow loading overlay to render
        this.time.delayedCall(100, () => {
            try {
                // Generate genetics if not already generated (should be generated in showHatchingScreen)
                if (!this.creatureGenetics) {
                    console.log('hatch:info [HatchingScene] Step 1: Generating creature genetics (fallback)...');
                    this.generateCreatureGenetics();

                    if (!this.creatureGenetics) {
                        console.error('hatch:error [HatchingScene] CRITICAL: generateCreatureGenetics() returned null!');
                        if (window.UXEnhancements) {
                            window.UXEnhancements.hideLoading();
                        }
                        this.showCriticalError('Failed to generate creature genetics');
                        return;
                    }
                } else {
                    console.log('hatch:info [HatchingScene] Step 1: Using pre-generated creature genetics');
                }

                // Check if vision reveal is enabled
                const visionConfig = evolutionConfig?.hatching?.visionReveal;
                const showVisionFirst = visionConfig?.enabled && visionConfig?.showAdultFirst;

                if (showVisionFirst) {
                    console.log('hatch:info [HatchingScene] Step 2: Showing adult vision first...');
                    this.showAdultVision(visionConfig);
                } else {
                    console.log('hatch:info [HatchingScene] Step 2: Creating creature sprite (no vision)...');
                    const creatureResult = this.createUniqueCreature('baby');
                    if (window.UXEnhancements) {
                        window.UXEnhancements.hideLoading();
                    }
                    this.completeCreatureDisplay(creatureResult);
                }
            } catch (error) {
                console.error('hatch:error [HatchingScene] Error during creature generation:', error);
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                this.showCriticalError('An error occurred during creature generation');
            }
        });
    }

    /**
     * Show the adult vision of the creature before revealing the baby
     */
    showAdultVision(visionConfig) {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const creatureY = height * 0.45;
        const targetScale = width < 600 ? Math.min(1.8, width / 250) : 1.8; // Larger for more impact

        console.log('hatch:info [HatchingScene] ========================================');
        console.log('hatch:info [HatchingScene] STARTING ADULT VISION REVEAL');
        console.log('hatch:info [HatchingScene] Vision duration:', visionConfig.visionDuration, 'ms');
        console.log('hatch:info [HatchingScene] ========================================');

        // Create dark overlay for dramatic effect (more contrast)
        this.visionOverlay = this.add.graphics();
        this.visionOverlay.fillStyle(0x000033, 0.6);
        this.visionOverlay.fillRect(0, 0, width, height);
        this.visionOverlay.setDepth(10);
        this.visionOverlay.setAlpha(0);

        // Create the ADULT version of the creature
        console.log('hatch:info [HatchingScene] Creating adult vision creature...');
        const adultResult = this.createUniqueCreature('adult');

        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        if (!adultResult || !adultResult.textureName) {
            console.error('hatch:error [HatchingScene] Failed to create adult vision');
            if (this.visionOverlay) this.visionOverlay.destroy();
            const babyResult = this.createUniqueCreature('baby');
            this.completeCreatureDisplay(babyResult);
            return;
        }

        console.log('hatch:info [HatchingScene] Adult creature created:', adultResult.textureName);

        // Create ethereal glow behind the creature (more prominent)
        const glowColor = visionConfig.visionEffects?.glowColor ?
            parseInt(visionConfig.visionEffects.glowColor.replace('#', ''), 16) : 0xFFD700; // Gold glow
        const glowIntensity = visionConfig.visionEffects?.glowIntensity || 1.0;

        const glow = this.add.graphics();
        // Much larger glow for dramatic effect
        glow.fillStyle(glowColor, glowIntensity * 0.15);
        glow.fillCircle(centerX, creatureY, 200);
        glow.fillStyle(glowColor, glowIntensity * 0.3);
        glow.fillCircle(centerX, creatureY, 150);
        glow.fillStyle(glowColor, glowIntensity * 0.5);
        glow.fillCircle(centerX, creatureY, 100);
        glow.fillStyle(glowColor, glowIntensity * 0.7);
        glow.fillCircle(centerX, creatureY, 60);
        glow.setDepth(15);
        glow.setAlpha(0);

        // Create the adult creature sprite (vision)
        this.visionCreature = this.add.image(centerX, creatureY, adultResult.textureName);
        this.visionCreature.setScale(0.3);
        this.visionCreature.setAlpha(0);
        this.visionCreature.setDepth(20);
        // Add slight golden tint for "destiny" effect
        this.visionCreature.setTint(0xFFFACD);

        // Create vision message with more emphasis
        const visionMessage = this.add.text(centerX, height * 0.1, visionConfig.visionMessage || '✨ Behold their magnificent destiny... ✨', {
            fontSize: width < 600 ? '20px' : '26px',
            color: '#FFD700',
            fontStyle: 'bold italic',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5).setDepth(25).setAlpha(0);

        // Fade in dark overlay first
        this.tweens.add({
            targets: this.visionOverlay,
            alpha: 1,
            duration: 400,
            ease: 'Sine.easeIn'
        });

        // Fade in glow
        this.tweens.add({
            targets: glow,
            alpha: 1,
            duration: 600,
            ease: 'Sine.easeIn',
            delay: 200
        });

        // Play mystical vision reveal sound
        this.time.delayedCall(300, () => {
            if (window.AudioManager) {
                window.AudioManager.playVisionReveal();
            }
        });

        // Fade in and scale up the adult vision with dramatic entrance
        this.tweens.add({
            targets: this.visionCreature,
            alpha: 1,
            scale: targetScale,
            duration: 1200,
            ease: 'Back.easeOut',
            delay: 400
        });

        // Fade in message
        this.tweens.add({
            targets: visionMessage,
            alpha: 1,
            duration: 800,
            delay: 600
        });

        // Add floating animation to vision
        this.tweens.add({
            targets: this.visionCreature,
            y: creatureY - 20,
            duration: 1800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 1600
        });

        // Add destiny sparkles
        if (visionConfig.visionEffects?.particles) {
            this.createVisionParticles(centerX, creatureY);
        }

        // After vision duration, transition to baby
        const visionDuration = visionConfig.visionDuration || 4000;

        console.log('hatch:info [HatchingScene] Vision will transition in', visionDuration, 'ms');

        this.time.delayedCall(visionDuration, () => {
            console.log('hatch:info [HatchingScene] Starting transition from adult vision to baby...');

            // Show transition message with baby reveal message
            const transitionMsg = visionConfig.transitionMessage || 'Watch them grow into this incredible form!';
            visionMessage.setText(transitionMsg);
            visionMessage.setColor('#FFFFFF');

            this.tweens.add({
                targets: visionMessage,
                alpha: { from: 1, to: 0.9 },
                duration: 400,
                yoyo: true,
                onComplete: () => {
                    // Fade out vision creature, glow, and overlay
                    this.tweens.add({
                        targets: [this.visionCreature, glow, this.visionOverlay],
                        alpha: 0,
                        duration: 1000,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            // Cleanup vision elements
                            if (this.visionCreature) {
                                this.visionCreature.destroy();
                                this.visionCreature = null;
                            }
                            glow.destroy();
                            if (this.visionOverlay) {
                                this.visionOverlay.destroy();
                                this.visionOverlay = null;
                            }

                            // Update message for baby reveal
                            const babyMsg = visionConfig.babyRevealMessage || '🐣 Your journey together begins now!';
                            visionMessage.setText(babyMsg);
                            visionMessage.setColor('#98FB98');

                            this.tweens.add({
                                targets: visionMessage,
                                alpha: { from: 0, to: 1 },
                                duration: 500
                            });

                            // Fade out message after a moment
                            this.time.delayedCall(2000, () => {
                                this.tweens.add({
                                    targets: visionMessage,
                                    alpha: 0,
                                    duration: 500,
                                    onComplete: () => visionMessage.destroy()
                                });
                            });

                            // Now show the baby version
                            console.log('hatch:info [HatchingScene] Creating baby creature...');
                            const babyResult = this.createUniqueCreature('baby');
                            this.completeCreatureDisplay(babyResult);
                        }
                    });
                }
            });
        });
    }

    /**
     * Create destiny sparkle particles for vision reveal
     */
    createVisionParticles(centerX, centerY) {
        const colors = [0xFFFFFF, 0xFFD700, 0xE6E6FA, 0x87CEEB];

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const distance = 80 + Math.random() * 60;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            const particle = this.add.graphics();
            particle.fillStyle(colors[i % colors.length], 0.8);
            particle.fillCircle(0, 0, 2 + Math.random() * 2);
            particle.setPosition(x, y);
            particle.setDepth(22);
            particle.setAlpha(0);

            // Animate particles in a cosmic swirl
            this.tweens.add({
                targets: particle,
                alpha: { from: 0, to: 0.8 },
                duration: 500,
                delay: i * 50,
                onComplete: () => {
                    this.tweens.add({
                        targets: particle,
                        x: centerX + Math.cos(angle + 0.5) * (distance - 20),
                        y: centerY + Math.sin(angle + 0.5) * (distance - 20),
                        alpha: 0,
                        duration: 2000,
                        ease: 'Sine.easeOut',
                        onComplete: () => particle.destroy()
                    });
                }
            });
        }
    }

    completeCreatureDisplay(creatureResult) {

        console.log('hatch:info [HatchingScene] Step 3: Creature result:', creatureResult ? 'SUCCESS' : 'FAILED');

        if (creatureResult && creatureResult.textureName) {
            console.log('hatch:info [HatchingScene] Step 4: Creating sprite with texture:', creatureResult.textureName);

            // Verify texture exists
            if (!this.textures.exists(creatureResult.textureName)) {
                console.error('hatch:error [HatchingScene] Texture does not exist in cache!');
                this.showCriticalError('Creature texture generation failed');
                return;
            }

            // MOBILE-RESPONSIVE creature positioning
            const { width, height } = this.scale;
            const centerX = width / 2;
            const creatureY = height * 0.45; // Center at 45% height
            const targetScale = width < 600 ? Math.min(1.2, width / 350) : 1.2;

            // Create the enhanced creature with the new texture
            this.creature = this.add.image(centerX, creatureY, creatureResult.textureName);
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
                scale: targetScale,
                duration: 1000,
                ease: 'Back.easeOut',
                onComplete: () => {
                    console.log('hatch:info [HatchingScene] Creature fade-in complete');

                    // Add cute baby idle animations
                    this.addCuteIdleAnimations(this.creature, targetScale);

                    // Play cute baby sound
                    if (window.AudioManager) {
                        window.AudioManager.playBabyCoo();
                    }

                    // Show post-hatch tutorial hint and mark tutorial as seen
                    if (!this.hasSeenTutorial()) {
                        this.time.delayedCall(500, () => {
                            this.showTutorialHint('postHatch');
                            this.markTutorialSeen();
                        });
                    }
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

            // MOBILE-RESPONSIVE fallback creature positioning
            const { width, height } = this.scale;
            const centerX = width / 2;
            const creatureY = height * 0.45;
            const targetScale = width < 600 ? Math.min(1.2, width / 350) : 1.2;

            this.creature = this.add.image(centerX, creatureY, 'enhancedCreature0');
            this.creature.setScale(1.5);
            this.creature.setAlpha(0);
            this.creature.setDepth(20);

            this.tweens.add({
                targets: this.creature,
                alpha: 1,
                scale: targetScale,
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
                // MOBILE-RESPONSIVE continue text
                const { width, height } = this.scale;
                const centerX = width / 2;
                const fontSize = Math.max(16, Math.min(20, width * 0.048));

                const continueText = this.add.text(centerX, height * 0.88, '✨ Press SPACE to continue! ✨', {
                    fontSize: `${fontSize}px`,
                    color: '#FFD54F',
                    stroke: '#000000',
                    strokeThickness: 2,
                    wordWrap: { width: width * 0.9 }
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
        // MOBILE-RESPONSIVE error message
        const { width, height } = this.scale;
        const centerX = width / 2;
        const fontSize = Math.max(18, Math.min(24, width * 0.055));

        const errorText = this.add.text(centerX, height * 0.5, `❌ ${message}\n\nPlease refresh the page`, {
            fontSize: `${fontSize}px`,
            color: '#FF4444',
            wordWrap: { width: width * 0.8 },
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

        let rarity;

        // Check if in egg hatching mode - use egg-specific rarity rolling
        if (this.isEggHatch && this.eggType) {
            // Use egg-specific rarity (no pity system)
            rarity = window.raritySystem.rollEggRarity(this.eggType);
            console.log(`hatch:info [HatchingScene] 🥚 Egg rarity roll (${this.eggType}): ${rarity}`);

            // Don't update pity for egg hatching - it was already reset
        } else {
            // Roll rarity using pity system (normal flow)
            const rollResult = window.raritySystem.rollRarity(pityData);
            rarity = rollResult.rarity;

            // Update pity data in GameState
            state.set('pitySystem', rollResult.pityData);
        }

        // Generate creature with the rolled rarity
        this.creatureGenetics = window.CreatureGenetics.generateCreatureGenetics(rarity);

        // Store rarity info for UI
        this.rarityInfo = window.raritySystem.getRarityInfo(rarity);

        // Generate DNA profile (DNA v1)
        if (window.CreatureDNA) {
            this.creatureDNA = window.CreatureDNA.generateDNA({ forcedRarity: rarity });

            // Store DNA in GameState for persistence
            state.set('creature.dna', this.creatureDNA);

            console.log(`hatch:info [HatchingScene] Generated DNA profile:`, {
                id: this.creatureDNA.id,
                body: this.creatureDNA.bodyArchetype,
                head: this.creatureDNA.headArchetype,
                hybrid: this.creatureDNA.hybridTag,
                temperament: this.creatureDNA.temperament,
                rarity: this.creatureDNA.raritySignature
            });

            // Initialize personality shaping system (Personality v1)
            if (window.PersonalitySystem) {
                const personalityState = window.PersonalitySystem.initializePersonalityState(this.creatureDNA);
                state.set('creature.personalityState', personalityState);
                console.log('hatch:info [HatchingScene] Initialized personality shaping system');
            }
        } else {
            console.warn('hatch:warn [HatchingScene] CreatureDNA system not available');
        }

        // Get pity counter info (only available for normal hatching, not egg hatching)
        const pityInfo = this.isEggHatch
            ? 'N/A (egg hatch)'
            : `${pityData.hatchesSinceEpic}/${window.raritySystem.PITY_THRESHOLD}`;

        console.log(`hatch:info [HatchingScene] Generated ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}:`, {
            id: this.creatureGenetics.id,
            personality: this.creatureGenetics.personality.core,
            cosmicElement: this.creatureGenetics.cosmicAffinity.element,
            specialFeatures: this.creatureGenetics.traits.features.specialFeatures?.length || 0,
            pityCounter: pityInfo
        });
    }

    /**
     * Create unique creature sprite using GraphicsEngine
     */
    createUniqueCreature(stage = 'adult') {
        console.log('hatch:debug [HatchingScene] createUniqueCreature() called with stage:', stage);

        if (!this.graphicsEngine) {
            console.error('hatch:error [HatchingScene] No graphics engine available!');
            return null;
        }

        // Try DNA-based rendering first (if CreatureDNA is available)
        if (this.creatureDNA && typeof this.graphicsEngine.createCreatureFromDNA === 'function') {
            console.log('hatch:info [HatchingScene] Using DNA-based creature rendering');
            console.log('hatch:debug [HatchingScene] DNA:', {
                id: this.creatureDNA.id,
                body: this.creatureDNA.bodyArchetype,
                head: this.creatureDNA.headArchetype,
                hybrid: this.creatureDNA.hybridTag,
                aura: this.creatureDNA.elementalAura,
                rarity: this.creatureDNA.raritySignature
            });

            try {
                const creatureResult = this.graphicsEngine.createCreatureFromDNA(this.creatureDNA, 0, stage);

                if (!creatureResult || !creatureResult.textureName) {
                    console.warn('hatch:warn [HatchingScene] DNA rendering failed, falling back to genetics');
                } else {
                    console.log('hatch:info [HatchingScene] Successfully created DNA-based creature:', creatureResult.textureName);
                    return creatureResult;
                }
            } catch (error) {
                console.error('hatch:error [HatchingScene] DNA rendering error, falling back to genetics:', error);
            }
        }

        // Fallback to genetics-based rendering
        if (!this.creatureGenetics) {
            console.error('hatch:error [HatchingScene] No genetics available!');
            return null;
        }

        console.log('hatch:info [HatchingScene] Using genetics-based creature rendering with stage:', stage);
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

            console.log('hatch:debug [HatchingScene] Calling createRandomizedSpaceMythicCreature with stage:', stage);

            // Use the GraphicsEngine to create a randomized creature with the specified stage
            const creatureResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                this.creatureGenetics,
                0, // frame 0
                stage // lifecycle stage (baby, juvenile, adult, elder)
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
     * Add cute idle animations for baby creatures
     * Based on cartoon animation principles: breathing, bobbing, squash & stretch
     * @param {Phaser.GameObjects.Image} creature - The creature sprite
     * @param {number} baseScale - The base scale of the creature
     */
    addCuteIdleAnimations(creature, baseScale) {
        if (!creature) return;

        const stage = window.GameState?.get('creature.lifecycle.stage') || 'baby';

        // Only add extra cute animations for babies
        const isBaby = stage === 'baby';
        const breathingIntensity = isBaby ? 0.05 : 0.02;
        const bobbingAmplitude = isBaby ? 8 : 3;
        const breathingDuration = isBaby ? 1500 : 2500;

        console.log('hatch:info [HatchingScene] Adding cute idle animations for stage:', stage);

        // Breathing animation - gentle scale oscillation (squash/stretch)
        this.tweens.add({
            targets: creature,
            scaleX: baseScale * (1 + breathingIntensity),
            scaleY: baseScale * (1 - breathingIntensity * 0.5),
            duration: breathingDuration,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Bobbing animation - gentle up/down movement
        this.tweens.add({
            targets: creature,
            y: creature.y - bobbingAmplitude,
            duration: breathingDuration * 1.3,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 200 // Slight offset from breathing for natural feel
        });

        // For babies, add occasional cute reactions
        if (isBaby) {
            // Random "excited" bounce every 5-8 seconds
            this.time.addEvent({
                delay: 5000 + Math.random() * 3000,
                callback: () => {
                    if (!creature || !creature.active) return;

                    // Quick excited bounce
                    this.tweens.add({
                        targets: creature,
                        scaleX: baseScale * 1.15,
                        scaleY: baseScale * 0.85,
                        duration: 100,
                        ease: 'Quad.easeOut',
                        yoyo: true,
                        onComplete: () => {
                            // Rebound stretch
                            this.tweens.add({
                                targets: creature,
                                scaleX: baseScale * 0.92,
                                scaleY: baseScale * 1.08,
                                duration: 100,
                                ease: 'Quad.easeOut',
                                yoyo: true
                            });
                        }
                    });

                    // Play cute sound
                    if (window.AudioManager && Math.random() > 0.5) {
                        window.AudioManager.playBabyChirp();
                    }
                },
                loop: true
            });

            // Add sparkle particles around baby periodically
            if (window.FXLibrary) {
                this.time.addEvent({
                    delay: 3000,
                    callback: () => {
                        if (!creature || !creature.active) return;
                        window.FXLibrary.stardustBurst(this, creature.x, creature.y, {
                            count: 3,
                            color: [0xFFB6C1, 0xFFFFFF, 0x87CEEB],
                            duration: 1500
                        });
                    },
                    loop: true
                });
            }
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

        // Fade transition - responsive to screen size
        const { width, height } = this.scale;
        const fadeGraphics = this.add.graphics();
        fadeGraphics.fillStyle(0x000000, 0);
        fadeGraphics.fillRect(0, 0, width, height);

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
     * Create audio indicator with mute/unmute toggle
     */
    createAudioIndicator() {
        const width = this.cameras.main.width;
        const isMobile = width < 600;

        // Position in top-right corner
        const x = width - (isMobile ? 50 : 70);
        const y = isMobile ? 30 : 40;
        const size = isMobile ? 40 : 50;

        // Create background circle
        this.audioIndicatorBg = this.add.graphics();
        this.audioIndicatorBg.fillStyle(0x2A0A4E, 0.8);
        this.audioIndicatorBg.fillCircle(x, y, size / 2);
        this.audioIndicatorBg.lineStyle(2, 0x7B68EE);
        this.audioIndicatorBg.strokeCircle(x, y, size / 2);
        this.audioIndicatorBg.setDepth(1000);

        // Create audio icon (speaker with waves)
        this.audioIcon = this.add.text(x, y, '🔊', {
            fontSize: isMobile ? '24px' : '28px'
        }).setOrigin(0.5).setDepth(1001);

        // Pulsing animation for audio waves
        this.tweens.add({
            targets: this.audioIcon,
            scale: { from: 1, to: 1.1 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Make it interactive
        const hitArea = new Phaser.Geom.Circle(0, 0, size / 2);
        this.audioIcon.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

        // Toggle mute on click
        this.audioIcon.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.toggleMute();
                const isMuted = window.AudioManager.muted;
                this.audioIcon.setText(isMuted ? '🔇' : '🔊');

                // Play feedback sound if unmuting
                if (!isMuted && window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                console.log(`[HatchingScene] Audio ${isMuted ? 'muted' : 'unmuted'}`);
            }
        });

        // Hover effect
        this.audioIcon.on('pointerover', () => {
            this.audioIndicatorBg.clear();
            this.audioIndicatorBg.fillStyle(0x4A0080, 1);
            this.audioIndicatorBg.fillCircle(x, y, size / 2);
            this.audioIndicatorBg.lineStyle(3, 0xFFD700);
            this.audioIndicatorBg.strokeCircle(x, y, size / 2);
        });

        this.audioIcon.on('pointerout', () => {
            this.audioIndicatorBg.clear();
            this.audioIndicatorBg.fillStyle(0x2A0A4E, 0.8);
            this.audioIndicatorBg.fillCircle(x, y, size / 2);
            this.audioIndicatorBg.lineStyle(2, 0x7B68EE);
            this.audioIndicatorBg.strokeCircle(x, y, size / 2);
        });

        // Update icon based on current mute state
        if (window.AudioManager && window.AudioManager.muted) {
            this.audioIcon.setText('🔇');
        }

        console.log('[HatchingScene] ✅ Audio indicator created');
    }

    /**
     * FIX #5: Scene cleanup to prevent duplication on restart
     * Called automatically by Phaser when scene stops/restarts
     */
    shutdown() {
        console.log('🧹 HatchingScene.shutdown() - Cleaning up scene resources');

        // Clean up tap to hatch text
        if (this.tapToHatchText) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.destroy();
            this.tapToHatchText = null;
        }

        // Clean up egg
        if (this.egg) {
            this.tweens.killTweensOf(this.egg);
            this.egg.destroy();
            this.egg = null;
        }

        // Clean up creature
        if (this.creature) {
            this.tweens.killTweensOf(this.creature);
            this.creature.destroy();
            this.creature = null;
        }

        // Clean up clouds group
        if (this.clouds) {
            this.clouds.clear(true, true);
            this.clouds = null;
        }

        // Clean up UI elements
        if (this.instructionText) {
            this.instructionText.destroy();
            this.instructionText = null;
        }

        if (this.progressText) {
            this.progressText.destroy();
            this.progressText = null;
        }

        // Clean up tutorial elements
        if (this.tutorialPointer) {
            this.tweens.killTweensOf(this.tutorialPointer);
            this.tutorialPointer.destroy();
            this.tutorialPointer = null;
        }

        if (this.tutorialHintText) {
            this.tweens.killTweensOf(this.tutorialHintText);
            this.tutorialHintText.destroy();
            this.tutorialHintText = null;
        }

        // Clean up reroll UI elements
        this.cleanupRerollUI();

        // Clean up graphics engine
        if (this.graphicsEngine) {
            this.graphicsEngine = null;
        }

        // Reset scene state flags
        this.hatchingProgress = 0;
        this.isHatching = false;
        this.hatchingStarted = false;
        this.creatureAppeared = false;
        this.creatureGenetics = null;

        console.log('✅ HatchingScene cleanup complete');
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

            // MOBILE-RESPONSIVE rarity banner
            const { width, height } = this.scale;
            const centerX = width / 2;
            const bannerWidth = Math.min(width * 0.9, 500);
            const bannerHeight = Math.min(height * 0.12, 80);
            const bannerX = centerX - (bannerWidth / 2);
            const bannerY = height * 0.08;

            // Responsive font sizes
            const titleSize = Math.max(20, Math.min(28, width * 0.065));
            const subtitleSize = Math.max(14, Math.min(18, width * 0.042));

            // Create banner background
            const bannerBg = this.add.graphics();
            bannerBg.fillStyle(0x000000, 0.8);
            bannerBg.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 10);
            bannerBg.lineStyle(3, parseInt(rarityInfo.displayColor.replace('#', '0x')));
            bannerBg.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 10);

            // Rarity title
            const rarityText = this.add.text(centerX, bannerY + (bannerHeight * 0.35), `${rarityInfo.emoji} ${rarityInfo.name} Creature!`, {
                fontSize: `${titleSize}px`,
                color: rarityInfo.displayColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3,
                wordWrap: { width: bannerWidth * 0.9 }
            }).setOrigin(0.5);

            // Creature name/species
            const speciesText = this.add.text(centerX, bannerY + (bannerHeight * 0.75), `${this.creatureGenetics.species} • ${this.creatureGenetics.personality.core}`, {
                fontSize: `${subtitleSize}px`,
                color: '#FFFFFF',
                wordWrap: { width: bannerWidth * 0.9 }
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

            // Disable reroll for egg hatching
            const canReroll = this.isEggHatch ? false : window.rerollSystem.canReroll();

            console.log('hatch:info [HatchingScene] Reroll check:', {
                isEggHatch: this.isEggHatch,
                canReroll: canReroll,
                hasRerollState: !!window.rerollSystem.currentRerollState
            });

            if (this.isEggHatch) {
                console.log('hatch:info [HatchingScene] 🥚 Reroll disabled for egg hatching');
            }

            // MOBILE-RESPONSIVE button positioning
            const { width, height } = this.scale;
            const centerX = width / 2;
            const isMobile = width < 600;

            // Responsive sizing
            const buttonWidth = isMobile ? Math.min(width * 0.4, 140) : 150;
            const buttonHeight = isMobile ? Math.min(height * 0.07, 50) : 50;
            const buttonSpacing = isMobile ? width * 0.05 : 50;
            const buttonY = height * 0.78; // 78% from top
            const fontSize = Math.max(18, Math.min(22, width * 0.05));

            // Calculate button positions (centered pair)
            const keepX = canReroll ?
                (centerX - buttonWidth - (buttonSpacing / 2)) :
                (centerX - (buttonWidth / 2));
            const rerollX = centerX + (buttonSpacing / 2);

            // KEEP button
            const keepBg = this.add.graphics();
            keepBg.fillStyle(0x228B22, 0.9);
            keepBg.fillRoundedRect(keepX, buttonY, buttonWidth, buttonHeight, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(keepX, buttonY, buttonWidth, buttonHeight, 10);

            const keepText = this.add.text(keepX + (buttonWidth / 2), buttonY + (buttonHeight / 2), '✓ KEEP', {
                fontSize: `${fontSize}px`,
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            const keepZone = this.add.zone(keepX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

            // Store dimensions for hover effects
            this.keepButtonDims = { x: keepX, y: buttonY, w: buttonWidth, h: buttonHeight };

            // REROLL button (if available)
            let rerollBg, rerollText, rerollZone;
            if (canReroll) {
                rerollBg = this.add.graphics();
                rerollBg.fillStyle(0x4169E1, 0.9);
                rerollBg.fillRoundedRect(rerollX, buttonY, buttonWidth, buttonHeight, 10);
                rerollBg.lineStyle(3, 0xFFD54F);
                rerollBg.strokeRoundedRect(rerollX, buttonY, buttonWidth, buttonHeight, 10);

                rerollText = this.add.text(rerollX + (buttonWidth / 2), buttonY + (buttonHeight / 2), '🔄 REROLL', {
                    fontSize: `${fontSize}px`,
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                }).setOrigin(0.5);

                rerollZone = this.add.zone(rerollX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

                // Store dimensions for hover effects
                this.rerollButtonDims = { x: rerollX, y: buttonY, w: buttonWidth, h: buttonHeight };
            }

            // Advice text
            const advice = window.rerollSystem.getRerollAdvice(this.creatureGenetics.rarity);
            const adviceFontSize = Math.max(13, Math.min(14, width * 0.036));
            const adviceText = this.add.text(centerX, height * 0.7, advice.message, {
                fontSize: `${adviceFontSize}px`,
                color: '#FFFF00',
                align: 'center',
                wordWrap: { width: width * 0.9 }
            }).setOrigin(0.5);

            // Tutorial hint for first-time players
            let tutorialHint = null;
            const gameState = getGameState();
            const hasSeenRerollTutorial = gameState.get('tutorial.rerollSeen') || false;

            if (!hasSeenRerollTutorial && canReroll) {
                const tutorialFontSize = Math.max(14, Math.min(16, width * 0.04));
                tutorialHint = this.add.text(centerX, height * 0.63,
                    '💡 Choose KEEP to continue, or REROLL for a different creature!\nRerolls are limited - use them wisely!', {
                    fontSize: `${tutorialFontSize}px`,
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(123, 31, 162, 0.8)',
                    padding: { x: 15, y: 10 },
                    align: 'center',
                    fontFamily: 'Arial, sans-serif',
                    wordWrap: { width: width * 0.85 }
                }).setOrigin(0.5).setAlpha(0);

                // Mark tutorial as seen
                gameState.set('tutorial.rerollSeen', true);
            }

            // Animate elements
            const elements = [keepBg, keepText, adviceText];
            if (canReroll) {
                elements.push(rerollBg, rerollText);
            }
            if (tutorialHint) {
                elements.push(tutorialHint);
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
                const dims = this.keepButtonDims;
                keepBg.clear();
                keepBg.fillStyle(0x32CD32, 0.9);
                keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
                keepBg.lineStyle(3, 0xFFD54F);
                keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            });
            keepZone.on('pointerout', () => {
                const dims = this.keepButtonDims;
                keepBg.clear();
                keepBg.fillStyle(0x228B22, 0.9);
                keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
                keepBg.lineStyle(3, 0xFFD54F);
                keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            });

            if (canReroll) {
                console.log('hatch:info [HatchingScene] Reroll button enabled and interactive');
                rerollZone.on('pointerdown', () => {
                    console.log('hatch:info [HatchingScene] Reroll zone clicked!');
                    this.handleRerollCreature();
                });
                rerollZone.on('pointerover', () => {
                    const dims = this.rerollButtonDims;
                    rerollBg.clear();
                    rerollBg.fillStyle(0x6495ED, 0.9);
                    rerollBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
                    rerollBg.lineStyle(3, 0xFFD54F);
                    rerollBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
                });
                rerollZone.on('pointerout', () => {
                    const dims = this.rerollButtonDims;
                    rerollBg.clear();
                    rerollBg.fillStyle(0x4169E1, 0.9);
                    rerollBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
                    rerollBg.lineStyle(3, 0xFFD54F);
                    rerollBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
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

        // Generate NEW creature with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        let creatureResult = null;

        while (retryCount < maxRetries && !creatureResult) {
            // Generate NEW creature genetics
            this.generateCreatureGenetics();

            if (!this.creatureGenetics) {
                console.error(`hatch:error [HatchingScene] Failed to generate new genetics (attempt ${retryCount + 1})`);
                retryCount++;
                continue;
            }

            console.log(`hatch:info [HatchingScene] New creature generated: ${this.creatureGenetics.rarity} ${this.creatureGenetics.species}`);

            // Try to create the creature (always baby when hatching)
            creatureResult = this.createUniqueCreature('baby');

            if (!creatureResult || !creatureResult.textureName) {
                console.warn(`hatch:warn [HatchingScene] Creature creation failed (attempt ${retryCount + 1}), retrying...`);
                creatureResult = null;
                retryCount++;

                // Clear DNA and try genetics-only on retry
                if (retryCount > 1) {
                    this.creatureDNA = null;
                }
            }
        }

        // Final validation
        if (!creatureResult || !creatureResult.textureName) {
            console.error('hatch:error [HatchingScene] Failed to create creature after all retries');
            this.showRerollError('Creature generation failed - please try again');
            return;
        }

        console.log('hatch:info [HatchingScene] Creating new creature sprite with texture:', creatureResult.textureName);

        // Verify texture exists before creating sprite
        if (!this.textures.exists(creatureResult.textureName)) {
            console.error('hatch:error [HatchingScene] Texture was not created properly:', creatureResult.textureName);
            this.showRerollError('Failed to generate creature appearance');
            return;
        }

        // MOBILE-RESPONSIVE rerolled creature positioning
        const { width, height } = this.scale;
        const centerX = width / 2;
        const creatureY = height * 0.45;
        const targetScale = width < 600 ? Math.min(1.2, width / 350) : 1.2;

        this.creature = this.add.image(centerX, creatureY, creatureResult.textureName);
        this.creature.setScale(1.5);
        this.creature.setAlpha(0);
        this.creature.setDepth(20);
        this.creature.genetics = this.creatureGenetics;

        // Fade in new creature with audio feedback
        this.tweens.add({
            targets: this.creature,
            alpha: 1,
            scale: targetScale,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Play reveal sound for dramatic effect
                if (window.AudioManager) {
                    window.AudioManager.playLevelUp();
                }
            }
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
    }

    /**
     * Show final KEEP button after reroll (no second reroll allowed)
     */
    showFinalKeepButton() {
        // MOBILE-RESPONSIVE final keep button (after reroll)
        const { width, height } = this.scale;
        const centerX = width / 2;
        const isMobile = width < 600;

        // Button sizing
        const buttonWidth = isMobile ? Math.min(width * 0.65, 180) : 150;
        const buttonHeight = isMobile ? Math.min(height * 0.08, 60) : 50;
        const buttonX = centerX - (buttonWidth / 2);
        const buttonY = height * 0.78;
        const fontSize = Math.max(18, Math.min(20, width * 0.048));
        const textFontSize = Math.max(14, Math.min(16, width * 0.04));

        const keepBg = this.add.graphics();
        keepBg.fillStyle(0x228B22, 0.9);
        keepBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
        keepBg.lineStyle(3, 0xFFD54F);
        keepBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);

        const keepText = this.add.text(centerX, buttonY + (buttonHeight / 2), '✓ KEEP THIS ONE', {
            fontSize: `${fontSize}px`,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const keepZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });

        const finalText = this.add.text(centerX, height * 0.7, '✅ This is your final creature!', {
            fontSize: `${textFontSize}px`,
            color: '#90EE90',
            wordWrap: { width: width * 0.9 }
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

        // Store dimensions for hover effects
        this.finalKeepButtonDims = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };

        keepZone.on('pointerdown', () => this.handleKeepCreature());
        keepZone.on('pointerover', () => {
            const dims = this.finalKeepButtonDims;
            keepBg.clear();
            keepBg.fillStyle(0x32CD32, 0.9);
            keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
        });
        keepZone.on('pointerout', () => {
            const dims = this.finalKeepButtonDims;
            keepBg.clear();
            keepBg.fillStyle(0x228B22, 0.9);
            keepBg.fillRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
            keepBg.lineStyle(3, 0xFFD54F);
            keepBg.strokeRoundedRect(dims.x, dims.y, dims.w, dims.h, 10);
        });

        this.keepUI = { keepBg, keepText, keepZone };
        this.finalText = finalText;
    }

    /**
     * Show error message when reroll fails
     */
    showRerollError(message) {
        // MOBILE-RESPONSIVE error message positioning
        const { width, height } = this.scale;
        const centerX = width / 2;
        const errorY = height * 0.4; // 40% from top
        const fontSize = Math.max(18, Math.min(24, width * 0.055));

        const errorText = this.add.text(centerX, errorY, `⚠️ ${message}`, {
            fontSize: `${fontSize}px`,
            color: '#FF6B6B',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width * 0.9 }
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
     * MOBILE-FIRST RESPONSIVE: Now uses actual viewport dimensions
     * RESIZE mode means width/height are the actual screen pixels
     */
    createEnhancedTitle() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const titleY = height * 0.15;  // 15% from top - works for portrait
        const panelWidth = Math.min(width * 0.95, 600);  // 95% of screen width, max 600px
        const panelHeight = Math.min(height * 0.18, 150);  // Taller panel for both lines

        // MOBILE-RESPONSIVE font sizes - scaled for readability
        // Desktop: 48px title, 18px subtitle
        // Mobile (390px): 31px title, 14px subtitle
        const titleFontSize = Math.max(28, Math.min(48, width * 0.08));  // 8% of screen width, min 28px
        const subtitleFontSize = Math.max(14, Math.min(18, width * 0.036));  // 3.6% of screen width

        // Glassmorphic panel behind title
        const titlePanel = this.add.graphics();
        titlePanel.fillStyle(0xFFFFFF, 0.1);
        titlePanel.fillRoundedRect(centerX - panelWidth/2, titleY - 30, panelWidth, panelHeight, 20);
        titlePanel.lineStyle(2, 0xFFD54F, 0.5);
        titlePanel.strokeRoundedRect(centerX - panelWidth/2, titleY - 30, panelWidth, panelHeight, 20);

        // Main title - "MYTHICAL VOID" stays on ONE line (NO word wrap)
        const titleText = this.add.text(centerX, titleY, 'MYTHICAL VOID', {
            fontSize: `${titleFontSize}px`,
            color: '#FFD54F',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            stroke: '#7B1FA2',
            strokeThickness: 3
            // NO wordWrap - title must never break across lines
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

        // Subtitle - "Where Space Meets Magic" on SEPARATE line below
        // Dynamic spacing based on title font size for proper visual hierarchy
        const subtitleY = titleY + (titleFontSize * 1.6);  // 1.6x title size = proper spacing
        const subtitleText = this.add.text(centerX, subtitleY, 'Where Space Meets Magic', {
            fontSize: `${subtitleFontSize}px`,
            color: '#B0B0B0',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Store for cleanup
        this.titlePanel = titlePanel;
        this.titleText = titleText;
        this.subtitleText = subtitleText;
    }

    /**
     * Create enhanced START button with glassmorphism
     * MOBILE-RESPONSIVE positioning
     */
    createEnhancedStartButton() {
        const { width, height } = this.scale;
        const buttonX = width / 2;
        const buttonY = height * 0.5;  // Center vertically at 50%

        // Responsive button sizing for mobile - wider for portrait screens
        const buttonWidth = Math.min(width * 0.85, 340);  // 85% of screen width, max 340px
        const buttonHeight = Math.min(height * 0.08, 95);  // 8% of screen height, max 95px

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

            // Fade and transition - CRITICAL FIX: Use handleStartGame() for proper state management
            this.tweens.add({
                targets: buttonContainer,
                alpha: 0,
                scaleX: 1.25,
                scaleY: 1.25,
                duration: 350,
                delay: 150,
                ease: 'Back.easeIn',
                onComplete: () => {
                    // Use the proper state management flow
                    this.handleStartGame();
                }
            });
        });

        this.startButton = buttonContainer;
    }

    /**
     * Create feature preview cards
     * MOBILE-RESPONSIVE: Stack vertically on narrow screens
     */
    createFeatureCards() {
        const { width, height } = this.scale;
        const centerX = width / 2;

        // Skip feature cards on mobile to simplify UI
        // They're just informational and clutter the portrait layout
        if (width < 600) {
            return;
        }

        // Desktop: Horizontal layout
        const cardWidth = 180;
        const cardHeight = 120;
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
     * Create "Tap to Hatch" instructional text over the egg
     * Quick Win #1 from QA Audit - improves discoverability
     * FIX #1: Make text non-interactive so clicks pass through to egg
     * FIX #2: Destroy existing text to prevent duplication
     */
    createTapToHatchText() {
        // FIX #2: Destroy existing text if it exists (prevents duplication)
        if (this.tapToHatchText) {
            this.tweens.killTweensOf(this.tapToHatchText);
            this.tapToHatchText.destroy();
            this.tapToHatchText = null;
        }

        const isMobile = MobileHelpers.isMobile();
        const text = isMobile ? '👆 TAP TO HATCH 👆' : '👆 CLICK TO HATCH 👆';

        // MOBILE-RESPONSIVE positioning - position relative to egg
        const { width, height } = this.scale;
        const textX = width / 2;
        const textY = (height * 0.45) - 120; // Position above the egg
        const fontSize = Math.max(20, Math.min(28, width * 0.065));

        this.tapToHatchText = this.add.text(textX, textY, text, {
            fontSize: `${fontSize}px`,
            color: '#FFD54F',
            fontFamily: 'Poppins, Inter, system-ui, -apple-system, sans-serif',
            fontStyle: 'bold',
            stroke: '#7B1FA2',
            strokeThickness: 4,
            align: 'center',
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(255, 213, 79, 0.8)',
                blur: 15,
                fill: true
            }
        }).setOrigin(0.5);

        // Pulsing animation - draws attention without being annoying
        this.tweens.add({
            targets: this.tapToHatchText,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.85,
            duration: 1200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Gentle floating animation synced with egg
        this.tweens.add({
            targets: this.tapToHatchText,
            y: 170,
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
     * ⚠️ CRITICAL SECTION - DO NOT MODIFY - GAME FLOW LOGIC ⚠️
     */
    handleStartGame() {
        const GameState = getGameState();

        // Mark game as started - CRITICAL for game flow validation
        GameState.set('session.gameStarted', true);
        console.log('✅ Set gameStarted to true');

        // CRITICAL: Reset creature collection to clear old test creatures
        if (GameState.resetCreatureCollection) {
            GameState.resetCreatureCollection();
            console.log('✅ Reset creature collection for fresh start');
        }

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

        // Clear personality, genes, DNA, and personality state to regenerate fresh
        GameState.set('creature.personality', null);
        GameState.set('creature.genes', null);
        GameState.set('creature.dna', null);
        GameState.set('creature.personalityState', null);

        console.log('🔄 Creature reset complete - forcing save before scene transition...');

        // CRITICAL: Force immediate save to localStorage before scene restart
        GameState.save();

        // Verify the state before restarting
        console.log('🔍 Pre-restart verification:');
        console.log('  gameStarted:', GameState.get('session.gameStarted'));
        console.log('  creatureHatched:', GameState.get('creature.hatched'));

        // Delayed restart to ensure save completes
        this.time.delayedCall(100, () => {
            this.scene.restart();
        });
    }
}

export default HatchingScene;

if (typeof window !== 'undefined') {
    window.HatchingScene = HatchingScene;
}
