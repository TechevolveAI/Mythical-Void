/**
 * GameScene - The main gameplay scene with an explorable world
 * Features: player movement, large world, environment objects, collision detection, interactions, AI chat
 */

import EconomyHudManager from '../systems/ui/EconomyHudManager.js';
import CarePanelManager from '../systems/ui/CarePanelManager.js';
import WorldBuilder from '../systems/world/WorldBuilder.js';

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function requireGlobal(name) {
    if (typeof window === 'undefined' || !window[name]) {
        throw new Error(`${name} system not ready`);
    }
    return window[name];
}

const getGameState = () => requireGlobal('GameState');
const getGraphicsEngine = () => requireGlobal('GraphicsEngine');
const getCreatureAI = () => requireGlobal('CreatureAI');

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.wasdKeys = null;
        this.spaceKey = null;
        this.chatKey = null;
        this.feedKey = null;
        this.playKey = null;
        this.restKey = null;
        this.careKey = null;
        this.worldWidth = 1600;
        this.worldHeight = 1200;
        this.trees = null;
        this.rocks = null;
        this.flowers = null;
        this.creatureAI = null;
        this.chatUI = null;
        this.isChatOpen = false;
        this.careSystem = null;
        this.carePanelManager = null;
        this.coins = null;
        this.coinRespawnTimers = [];
        this.enemies = null;
        this.projectiles = null;
        this.shop = null;
        this.nearShop = false;
        this.mobileControls = null;
        this.economyHud = null;
        this.worldBuilder = null;
        this.currentCameraZoom = 1;
        this.gameStateUnsubscribers = [];
        this._sceneLifecycleRegistered = false;
        this._isShuttingDown = false;
        this.kidModeActionHandler = null;
        this.joystickX = 0;
        this.joystickY = 0;
        this.virtualJoystickHandler = null;
        this.virtualKeyHandler = null;
        this.positionText = null;
        this.statsText = null;
        this.statsPulseAnimation = null;
        this.interactionText = null;
        this.cosmicMiniMap = null;
        this.miniMapPlayerDot = null;
        this.statBarGraphics = null;
        this.statBars = [];
        this.floatingParticles = [];
        this.enemyManagerListeners = [];
        this.combatCooldown = 0;
        this.combatCooldownMax = 1200;
        this.combatCooldownText = null;
        this.combatButton = null;
        this.combatBg = null;
        this.combatText = null;
        this.dailyBonusButton = null;
        this.dailyBonusGlow = null;
        this.isShowingTutorial = false;
        this.welcomeToastDisplayed = false;
    }

    preload() {
        // Sprites will be created in create() method
    }

    create() {
        try {
            this.initializeLifecycleTracking();
            this.registerSceneLifecycleEvents();

            // Set current scene in GameState
            getGameState().set('session.currentScene', 'GameScene');

            // Initialize CreatureAI for chat functionality
            const CreatureAI = getCreatureAI();
            this.creatureAI = new CreatureAI();
            this.creatureAI.initialize();

            // Initialize CareSystem for creature care mechanics
            if (typeof window.CareSystem !== 'undefined' && window.CareSystem) {
                this.careSystem = window.CareSystem;
                // Initialize if not already done
                if (typeof this.careSystem.initialize === 'function' && !this.careSystem.initialized) {
                    this.careSystem.initialize();
                }
                console.log('[GameScene] CareSystem ready');
            } else {
                console.error('CareSystem not available, care features will be disabled');
                this.careSystem = null;
            }

            this.carePanelManager = new CarePanelManager(this, {
                careSystem: this.careSystem,
                playerProvider: () => this.player,
                geneticsProvider: () => this.playerGenetics || getGameState().get('creature.genetics')
            });

            // Initialize AchievementSystem for basic achievements
            if (typeof window.AchievementSystem !== 'undefined' && window.AchievementSystem) {
                this.achievementSystem = window.AchievementSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.achievementSystem.initialize === 'function' && !this.achievementSystem.initialized) {
                    this.achievementSystem.initialize();
                }
                console.log('[GameScene] AchievementSystem ready');
            } else {
                console.error('AchievementSystem not available, achievement features will be disabled');
                this.achievementSystem = null;
            }

            // Initialize TutorialSystem for progressive onboarding
            if (typeof window.TutorialSystem !== 'undefined' && window.TutorialSystem) {
                this.tutorialSystem = window.TutorialSystem;
                // Call initialize if it exists and hasn't been called
                if (typeof this.tutorialSystem.initialize === 'function' && !this.tutorialSystem.initialized) {
                    this.tutorialSystem.initialize();
                }
                console.log('[GameScene] TutorialSystem ready');
            } else {
                console.error('TutorialSystem not available, tutorial features will be disabled');
                this.tutorialSystem = null;
            }

            // Initialize enhanced graphics engine
            const GraphicsEngine = getGraphicsEngine();
            this.graphicsEngine = new GraphicsEngine(this);
            
            // Create enhanced sprites programmatically
            this.createEnhancedEnvironmentSprites();
            
            // Set world bounds for the large explorable area
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            this.worldBuilder = new WorldBuilder(this, this.graphicsEngine, {
                worldWidth: this.worldWidth,
                worldHeight: this.worldHeight
            });
            const worldPieces = this.worldBuilder.build();
            this.worldBackground = worldPieces.background;
            this.trees = worldPieces.trees;
            this.rocks = worldPieces.rocks;
            this.flowers = worldPieces.flowers;
            this.shop = worldPieces.shop;
            
            // Create the player (hatched creature)
            this.createPlayer();
            
            // Set up camera to follow player
            this.setupCamera();
            
            if (this.player) {
                this.physics.add.collider(this.player, this.trees);
                this.physics.add.collider(this.player, this.rocks);
                this.physics.add.overlap(this.player, this.flowers, this.handleFlowerInteraction, null, this);
                this.physics.add.overlap(this.player, this.shop, this.handleShopProximity, null, this);
            }

            // Create cosmic coins for collection
            this.createCosmicCoins();

            // Create enemies
            this.createEnemies();

            // Set up input controls
            this.setupInput();
            
            // Create UI elements
            this.createUI();

            this.showWelcomeToastIfNeeded();

            // Initialize mobile controls if on mobile device
            if (window.MobileControls) {
                this.mobileControls = new window.MobileControls(this);
                this.mobileControls.show();
                console.log('[GameScene] Mobile controls initialized');
            }

            // Initialize Kid Mode features if enabled
            this.initializeKidMode();
            
            // Listen for GameState events
            this.setupGameStateListeners();

            // Set up periodic timers for achievements and tutorials
            this.setupPeriodicTimers();

            console.log('[GameScene] Scene created successfully');
        } catch (error) {
            console.error('[GameScene] Error during scene creation:', error);
            console.error('[GameScene] Error stack:', error.stack);
            
            // Try to recover by showing a simple error message
            const errorText = this.add.text(400, 300, 'Error loading game scene.\nPlease refresh the page.', {
                fontSize: '20px',
                color: '#FF0000',
                stroke: '#FFFFFF',
                strokeThickness: 2,
                align: 'center'
            });
            errorText.setOrigin(0.5);
            
            // Still throw the error so it gets properly logged
            throw error;
        }
    }

    initializeLifecycleTracking() {
        this._isShuttingDown = false;
        this._sceneLifecycleRegistered = false;
        this.gameStateUnsubscribers = [];
        this.enemyManagerListeners = [];
        this.virtualJoystickHandler = null;
        this.virtualKeyHandler = null;
        this.joystickX = 0;
        this.joystickY = 0;
        this.isShowingTutorial = false;
        this.welcomeToastDisplayed = false;
        this.combatCooldown = 0;
        this.floatingParticles = [];
        this.statBars = [];
        this.statBarGraphics = null;
        this.cosmicMiniMap = null;
        this.miniMapPlayerDot = null;

        if (this.kidModeActionHandler && this.events?.off) {
            this.events.off('kid_mode_action', this.kidModeActionHandler, this);
        }
        this.kidModeActionHandler = null;
    }

    registerSceneLifecycleEvents() {
        if (!this.events || this._sceneLifecycleRegistered) {
            return;
        }

        if (typeof Phaser !== 'undefined' && Phaser?.Scenes?.Events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        }

        this._sceneLifecycleRegistered = true;
    }

    setupCamera() {
        const camera = this.cameras?.main;

        if (!camera) {
            console.warn('[GameScene] Camera not ready yet, skipping setup');
            return;
        }

        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

        if (this.player) {
            camera.startFollow(this.player, true, 0.12, 0.12);
            camera.setDeadzone(
                Math.round(camera.width * 0.15),
                Math.round(camera.height * 0.2)
            );
        }

        const responsiveManager = window.responsiveManager;
        const isMobile = responsiveManager?.isMobile ?? window.innerWidth < 768;
        const zoom = isMobile ? 0.85 : 1.0;

        camera.setZoom(zoom);
        camera.setRoundPixels(true);
        camera.setBackgroundColor('#050214');

        this.currentCameraZoom = zoom;
    }

    createEnhancedEnvironmentSprites() {
        // Get creature colors from GameState or use defaults
        const creatureColors = getGameState().get('creature.colors') || {
            body: 0x9370DB,  // Default purple
            head: 0xDDA0DD,  // Default plum
            wings: 0x8A2BE2  // Default blue violet
        };
        
        // Create enhanced player creature sprites (4 frames for walking animation)
        // Note: This is now handled in createPlayer() using genetics, but kept for compatibility
        for (let i = 0; i < 4; i++) {
            this.graphicsEngine.createEnhancedCreature(
                creatureColors.body, 
                creatureColors.head, 
                creatureColors.wings, 
                i
            );
        }

        // Create enhanced environment objects with variations
        this.createEnvironmentVariations();
    }

    createEnvironmentVariations() {
        // Create multiple tree variations (different seasons/ages)
        this.graphicsEngine.createEnhancedTree(1.0, 'summer');
        this.graphicsEngine.createEnhancedTree(0.8, 'spring');
        this.graphicsEngine.createEnhancedTree(1.2, 'autumn');

        // Create rock variations with different moss levels
        for (let i = 0; i < 3; i++) {
            const mossiness = i * 0.3;
            this.graphicsEngine.createEnhancedRock(1.0, mossiness);
        }

        // Create flower variations with different colors
        const flowerColors = [
            { petal: 0xFF69B4, center: 0xFFD700 },
            { petal: 0x9370DB, center: 0xFFA500 },
            { petal: 0xFF6347, center: 0xFFFFE0 },
            { petal: 0x4169E1, center: 0xFFF8DC },
            { petal: 0xFFB6C1, center: 0xFF69B4 }
        ];

        flowerColors.forEach((color) => {
            this.graphicsEngine.createEnhancedFlower(color.petal, color.center, 1.0);
        });

        // Create magical sparkle for interactions
        this.graphicsEngine.createMagicalSparkle(0x00FFFF, 0.8);
    }

    createPlayer() {
        // Get saved position or use center of world
        const savedPos = getGameState().get('world.currentPosition');
        const startX = savedPos ? savedPos.x : this.worldWidth / 2;
        const startY = savedPos ? savedPos.y : this.worldHeight / 2;
        
        // Get creature genetics for proper sprite creation
        const creatureData = getGameState().get('creature');
        let creatureTextures = ['enhancedCreature0']; // Default fallback

        if (creatureData && creatureData.genetics) {
            console.log('game:info [GameScene] Creating player with genetics:', creatureData.genetics.id);

            // Check if textures already exist (created in previous scenes)
            const baseTextureName = `creature_${creatureData.genetics.id}`;
            const frame0Exists = this.textures.exists(`${baseTextureName}_0`);

            if (frame0Exists) {
                // Reuse existing textures from previous scenes
                console.log('game:info [GameScene] Reusing existing creature textures');
                creatureTextures = [];
                for (let frame = 0; frame < 4; frame++) {
                    const textureName = `${baseTextureName}_${frame}`;
                    if (this.textures.exists(textureName)) {
                        creatureTextures.push(textureName);
                    } else {
                        // Create missing frame
                        const spriteResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(creatureData.genetics, frame);
                        creatureTextures.push(spriteResult.textureName);
                    }
                }
            } else {
                // Create all creature sprite frames with genetics
                console.log('game:info [GameScene] Creating new creature sprite frames');
                const spriteResults = [];
                for (let frame = 0; frame < 4; frame++) {
                    const spriteResult = this.graphicsEngine.createRandomizedSpaceMythicCreature(creatureData.genetics, frame);
                    spriteResults.push(spriteResult.textureName);
                }
                creatureTextures = spriteResults;
            }

            // Store the genetics reference for later use
            this.playerGenetics = creatureData.genetics;
        } else {
            console.warn('game:warn [GameScene] No genetics found, using default creature sprites');
            // Create fallback enhanced creature frames
            for (let frame = 0; frame < 4; frame++) {
                this.graphicsEngine.createEnhancedCreature(0x9370DB, 0xDDA0DD, 0x8A2BE2, frame, null);
            }
        }
        
        // Create physics sprite with the first texture
        this.player = this.physics.add.sprite(startX, startY, creatureTextures[0]);
        this.player.setScale(1.0);

        // Enable collision with world bounds
        this.player.setCollideWorldBounds(true);

        // Set player collision body size (slightly smaller than sprite for better gameplay)
        this.player.body.setSize(40, 60);
        this.player.body.setOffset(10, 10);

        console.log(`game:info [GameScene] Player created at (${startX}, ${startY}) with world bounds: ${this.worldWidth}x${this.worldHeight}`);
        
        // Make creature clickable for care interactions
        this.player.setInteractive({ cursor: 'pointer' });
        this.player.on('pointerdown', () => {
            this.carePanelManager?.togglePanel();
        });
    }

    createCosmicCoins() {
        console.log('game:info [GameScene] Creating cosmic coins for collection');

        this.graphicsEngine?.createCosmicCoin();

        if (this.coins) {
            this.coins.clear(true, true);
        }

        this.coins = this.physics.add.group({
            defaultKey: 'cosmicCoin',
            maxSize: 20
        });

        this.coinRespawnTimers = [];

        const coinCount = 18;
        for (let i = 0; i < coinCount; i++) {
            this.spawnCoin();
        }

        if (this.player) {
            this.physics.add.overlap(this.player, this.coins, this.handleCoinCollection, null, this);
        }

        console.log(`game:info [GameScene] Spawned ${coinCount} cosmic coins`);
    }

    spawnCoin(x = null, y = null) {
        if (!this.coins) return null;

        const coinX = x ?? Phaser.Math.Between(200, this.worldWidth - 200);
        const coinY = y ?? Phaser.Math.Between(200, this.worldHeight - 200);

        const centerX = this.worldWidth / 2;
        const centerY = this.worldHeight / 2;
        const distance = Phaser.Math.Distance.Between(coinX, coinY, centerX, centerY);

        if (distance < 150 && x === null && y === null) {
            return this.spawnCoin();
        }

        const coin = this.coins.get(coinX, coinY, 'cosmicCoin');
        if (!coin) {
            console.warn('game:warn [GameScene] Could not create coin (group full)');
            return null;
        }

        coin.setActive(true);
        coin.setVisible(true);
        coin.setScale(1.0);
        coin.setDepth(1000);

        coin.setData('originalX', coinX);
        coin.setData('originalY', coinY);
        coin.setData('value', 10);

        this.tweens.add({
            targets: coin,
            y: coinY - 8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        return coin;
    }

    handleCoinCollection(player, coin) {
        if (!coin?.active) return;

        const coinValue = coin.getData('value') ?? 10;

        this.tweens.add({
            targets: coin,
            x: player.x,
            y: player.y,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 1,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                window.EconomyManager?.addCoins?.(coinValue, 'collection');
                this.createCollectionParticles(coin.x, coin.y);
                window.AudioManager?.playCoinCollect?.();

                coin.setActive(false);
                coin.setVisible(false);
                this.tweens.killTweensOf(coin);

                const respawnTime = Phaser.Math.Between(45000, 60000);
                const timer = this.time.delayedCall(respawnTime, () => {
                    this.respawnCoin(coin);
                });

                this.coinRespawnTimers.push(timer);
                console.log(`game:info [GameScene] Collected ${coinValue} cosmic coins. Respawn in ${respawnTime / 1000}s`);
            }
        });
    }

    respawnCoin(coin) {
        if (!coin) return;

        const originalX = coin.getData('originalX');
        const originalY = coin.getData('originalY');

        coin.setPosition(originalX, originalY);
        coin.setActive(true);
        coin.setVisible(true);
        coin.setAlpha(0);
        coin.setScale(0.5);

        this.tweens.add({
            targets: coin,
            alpha: 1,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 500,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: coin,
            y: originalY - 8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        this.tweens.add({
            targets: coin,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        console.log('game:info [GameScene] Coin respawned at', originalX, originalY);
    }

    createCollectionParticles(x, y) {
        const particles = this.add.particles(x, y, 'cosmicCoin', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            gravityY: -100,
            quantity: 8,
            blendMode: 'ADD'
        });

        this.time.delayedCall(700, () => particles.destroy());
    }

    registerEnemyManagerListener(event, handler) {
        if (!window.EnemyManager || typeof window.EnemyManager.on !== 'function' || typeof handler !== 'function') {
            return;
        }
        window.EnemyManager.on(event, handler);
        this.enemyManagerListeners.push({ event, handler });
    }

    createEnemies() {
        console.log('game:info [GameScene] Initializing friendly enemies');

        this.graphicsEngine?.createVoidWisp?.();
        this.graphicsEngine?.createShadowSprite?.();

        this.enemies = this.physics.add.group({ maxSize: 6 });
        this.projectiles = this.physics.add.group({ maxSize: 20 });

        if (window.ProjectileManager) {
            window.ProjectileManager.setup(this, this.projectiles, this.enemies);
        }

        if (window.EnemyManager) {
            window.EnemyManager.startSpawning(this, this.enemies, this.player, this.worldWidth, this.worldHeight);
            const calmHandler = (data) => this.handleEnemyCalmed(data);
            this.registerEnemyManagerListener('wispCalmed', calmHandler);
        } else {
            console.warn('[GameScene] EnemyManager not available');
        }

        if (this.player && this.enemies) {
            this.physics.add.collider(this.player, this.enemies, () => {
                if (window.UXEnhancements) {
                    window.UXEnhancements.announce('Stay cozy! Use gentle attacks to calm wisps.', 'polite');
                }
            });
        }
    }

    handleEnemyCalmed(data = {}) {
        const x = data.x ?? this.player?.x ?? 0;
        const y = data.y ?? this.player?.y ?? 0;
        const type = data.type ?? 'voidWisp';
        this.createEnemyCalmParticles(x, y, type);

        if (data.coinDrop && this.economyHud?.showFloatingCoinText) {
            this.economyHud.showFloatingCoinText(data.coinDrop);
        }
    }

    createEnemyCalmParticles(x, y, enemyType) {
        const particleColor = enemyType === 'shadowSprite' ? 0x6A5ACD : 0x8B00D9;
        const textureKey = `enemyParticle_${enemyType}`;

        if (!this.textures.exists(textureKey)) {
            const graphics = this.add.graphics();
            graphics.fillStyle(particleColor, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture(textureKey, 8, 8);
            graphics.destroy();
        }

        const particles = this.add.particles(x, y, textureKey, {
            speed: { min: 80, max: 170 },
            scale: { start: 1.0, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 900,
            gravityY: 40,
            quantity: 12,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        });

        this.time.delayedCall(1000, () => particles.destroy());
    }

    setupInput() {
        if (!this.input || !this.input.keyboard) {
            console.warn('[GameScene] Keyboard input not ready');
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');
        this.chatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.playKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.restKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.careKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.inventoryKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
        this.combatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

        this.joystickX = 0;
        this.joystickY = 0;

        this.virtualJoystickHandler = (data = {}) => {
            this.joystickX = data.x ?? 0;
            this.joystickY = data.y ?? 0;
        };

        this.virtualKeyHandler = (data = {}) => {
            if (data.key === 'space' && data.type === 'down') {
                this.handleSpaceInteraction();
            }
            if (data.key === 'care' && data.type === 'down') {
                this.toggleCarePanel();
            }
        };

        if (this.game?.events) {
            this.game.events.on('virtual-joystick', this.virtualJoystickHandler, this);
            this.game.events.on('virtual-key', this.virtualKeyHandler, this);
        }

        const resumeAudio = () => {
            try {
                window.AudioManager?.resume?.();
            } catch (error) {
                console.warn('[GameScene] Audio resume failed', error);
            }
        };

        this.input.once('pointerdown', resumeAudio);
        this.input.keyboard.once('keydown', resumeAudio);
    }

    createUI() {
        const { width, height } = this.scale;
        this.createResetButton();

        this.positionText = this.add.text(16, 52, 'Position: (0, 0)', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: { x: 6, y: 3 }
        });
        this.positionText.setScrollFactor(0);

        this.statsText = this.add.text(width - 16, 16, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: { x: 8, y: 4 },
            align: 'right'
        });
        this.statsText.setOrigin(1, 0);
        this.statsText.setScrollFactor(0);
        this.updateStatsDisplay();

        this.interactionText = this.add.text(width / 2, height - 40, '', {
            fontSize: '16px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            align: 'center',
            padding: { x: 10, y: 6 }
        });
        this.interactionText.setOrigin(0.5);
        this.interactionText.setScrollFactor(0);
        this.interactionText.setDepth(3000);
        this.interactionText.setVisible(false);

        if (!this.economyHud) {
            this.economyHud = new EconomyHudManager(this, {
                economyManager: window.EconomyManager,
                playerProvider: () => this.player
            });
        }
        this.economyHud.init();

        this.carePanelManager?.init();

        this.createDailyBonusButton();
        this.createCombatButton();
        this.createCosmicMiniMap();
        this.createGlowingStatBars();
        this.createFloatingParticles();
        this.createChatUI();
    }

    createResetButton() {
        const button = this.add.text(16, 16, '↺ Re-center', {
            fontSize: '12px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        });
        button.setScrollFactor(0);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => {
            window.AudioManager?.playButtonClick?.();
            const startX = this.worldWidth / 2;
            const startY = this.worldHeight / 2;
            if (this.player) {
                this.player.setPosition(startX, startY);
                getGameState().set('world.currentPosition', { x: startX, y: startY });
            }
        });
    }

    createDailyBonusButton() {
        if (!this.careSystem?.getDailyLoginBonus) {
            return;
        }
        this.dailyBonusButton?.destroy();
        const button = this.add.text(this.scale.width / 2, 12, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            padding: { x: 12, y: 4 },
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            align: 'center'
        });
        button.setScrollFactor(0);
        button.setOrigin(0.5, 0);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => this.claimDailyBonus());
        this.dailyBonusButton = button;
        this.updateDailyBonusButton();
    }

    updateDailyBonusButton() {
        if (!this.dailyBonusButton || !this.careSystem?.getDailyLoginBonus) {
            return;
        }
        const bonus = this.careSystem.getDailyLoginBonus();
        if (!bonus) {
            this.dailyBonusButton.setVisible(false);
            return;
        }
        const text = bonus.available ?
            `🎁 Cozy Daily Gift Ready! (Streak ${bonus.streak})` :
            `🌙 Come back tomorrow for more cozy coins (${bonus.streak}-day streak)`;
        this.dailyBonusButton.setVisible(true);
        this.dailyBonusButton.setText(text);
        this.dailyBonusButton.setColor(bonus.available ? '#FFD700' : '#FFFFFF');
        this.dailyBonusButton.setBackgroundColor(bonus.available ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.55)');
    }

    claimDailyBonus() {
        if (!this.careSystem?.claimDailyLoginBonus) return;

        try {
            const result = this.careSystem.claimDailyLoginBonus();
            if (result?.success) {
                this.showBonusClaimedMessage();
                this.updateDailyBonusButton();
            } else if (result?.message) {
                this.showInteractionHint(result.message);
            }
        } catch (error) {
            console.warn('[GameScene] Failed to claim daily bonus', error);
        }
    }

    createCombatButton() {
        const isMobile = window.responsiveManager?.isMobile;
        this.combatCooldown = 0;
        this.combatCooldownMax = 1200;

        if (!isMobile) {
            return;
        }

        const buttonX = this.scale.width - 90;
        const buttonY = this.scale.height - 90;

        this.combatBg?.destroy();
        this.combatBg = this.add.graphics();
        this.combatBg.setScrollFactor(0);
        this.combatBg.fillStyle(0xFF6B35, 0.85);
        this.combatBg.fillCircle(buttonX, buttonY, 40);
        this.combatBg.lineStyle(3, 0xFFFFFF, 0.8);
        this.combatBg.strokeCircle(buttonX, buttonY, 40);

        this.combatText?.destroy();
        this.combatText = this.add.text(buttonX, buttonY, '⚡', {
            fontSize: '32px'
        }).setOrigin(0.5);
        this.combatText.setScrollFactor(0);

        this.combatCooldownText?.destroy();
        this.combatCooldownText = this.add.text(buttonX, buttonY + 35, '0s', {
            fontSize: '14px',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.combatCooldownText.setScrollFactor(0);
        this.combatCooldownText.setVisible(false);

        const zone = this.add.zone(buttonX, buttonY, 80, 80).setOrigin(0.5);
        zone.setScrollFactor(0);
        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.fireCombatProjectile());
        this.combatButton = zone;
    }

    toggleCarePanel() {
        this.carePanelManager?.togglePanel();
    }

    showWelcomeToastIfNeeded() {
        const gameState = getGameState();
        if (!gameState.get('session.showWelcomeToast') || this.welcomeToastDisplayed) {
            return;
        }

        const creatureName = gameState.get('session.pendingWelcomeName') || gameState.get('creature.name');
        const toast = this.add.text(this.scale.width / 2, 120, `Welcome to the sanctuary, ${creatureName}!`, {
            fontSize: '20px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: { x: 20, y: 10 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        toast.setDepth(4000);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 2200,
            duration: 600,
            onComplete: () => toast.destroy()
        });

        gameState.set('session.showWelcomeToast', false);
        gameState.set('session.pendingWelcomeName', null);
        this.welcomeToastDisplayed = true;
    }

    createCosmicMiniMap() {
        const size = 120;
        const margin = 16;
        const mapX = this.scale.width - size - margin;
        const mapY = this.scale.height - size - margin;

        const background = this.add.graphics();
        background.setScrollFactor(0);
        background.setDepth(1500);
        background.fillStyle(0x0a0118, 0.8);
        background.fillRoundedRect(mapX, mapY, size, size, 12);
        background.lineStyle(2, 0x00CED1, 0.8);
        background.strokeRoundedRect(mapX, mapY, size, size, 12);

        this.miniMapPlayerDot?.destroy();
        this.miniMapPlayerDot = this.add.circle(mapX + size / 2, mapY + size / 2, 4, 0xFFD700);
        this.miniMapPlayerDot.setScrollFactor(0);
        this.miniMapPlayerDot.setDepth(1501);

        this.cosmicMiniMap = { x: mapX, y: mapY, size, background };
    }

    updateCosmicMiniMap() {
        if (!this.cosmicMiniMap || !this.miniMapPlayerDot || !this.player) {
            return;
        }
        const relX = Phaser.Math.Clamp(this.player.x / this.worldWidth, 0, 1);
        const relY = Phaser.Math.Clamp(this.player.y / this.worldHeight, 0, 1);
        this.miniMapPlayerDot.setPosition(
            this.cosmicMiniMap.x + relX * this.cosmicMiniMap.size,
            this.cosmicMiniMap.y + relY * this.cosmicMiniMap.size
        );
    }

    createGlowingStatBars() {
        this.statBarGraphics?.destroy();
        this.statBarGraphics = this.add.graphics();
        this.statBarGraphics.setScrollFactor(0);
        this.statBarGraphics.setDepth(1400);
        this.statBars = [
            { key: 'health', color: 0xFF6B6B, x: 16, y: this.scale.height - 90, width: 200, height: 12 },
            { key: 'happiness', color: 0xFFD166, x: 16, y: this.scale.height - 70, width: 200, height: 12 },
            { key: 'energy', color: 0x4ECDC4, x: 16, y: this.scale.height - 50, width: 200, height: 12 }
        ];
        this.updateGlowingStatBars();
    }

    updateGlowingStatBars() {
        if (!this.statBarGraphics || !this.statBars.length) return;
        const stats = getGameState().get('creature.stats');
        if (!stats) return;

        this.statBarGraphics.clear();
        this.statBars.forEach((bar) => {
            const value = Phaser.Math.Clamp(stats[bar.key] ?? 0, 0, 100);
            const fill = (value / 100) * bar.width;
            this.statBarGraphics.fillStyle(0x000000, 0.5);
            this.statBarGraphics.fillRoundedRect(bar.x, bar.y, bar.width, bar.height, 8);
            this.statBarGraphics.fillStyle(bar.color, 0.8);
            this.statBarGraphics.fillRoundedRect(bar.x + 2, bar.y + 2, Math.max(0, fill - 4), bar.height - 4, 6);
        });
    }

    createFloatingParticles() {
        this.floatingParticles.forEach((particle) => particle.destroy());
        this.floatingParticles = [];

        if (!this.textures.exists('magicalSparkle')) {
            return;
        }

        const emitter = this.add.particles(0, 0, 'magicalSparkle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: 200 },
            lifespan: 4000,
            speedY: { min: 10, max: 40 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            quantity: 1,
            frequency: 600,
            tint: [0x00CED1, 0xFFD700, 0x9370DB],
            blendMode: 'ADD'
        });
        emitter.setScrollFactor(0);
        emitter.setDepth(200);
        this.floatingParticles.push(emitter);
    }

    fireCombatProjectile() {
        if (this.combatCooldown > 0) {
            return;
        }

        const nearestEnemy = this.findNearestEnemy();
        if (!nearestEnemy) {
            this.showInteractionHint('All calm! Explore or care for your buddy.');
            return;
        }

        const genes = getGameState().get('creature.genes');
        const rarity = genes?.rarity || 'common';

        window.AudioManager?.playAttack?.();
        window.ProjectileManager?.fireProjectile(
            this,
            this.player.x,
            this.player.y,
            nearestEnemy.x,
            nearestEnemy.y,
            rarity
        );

        this.combatCooldown = this.combatCooldownMax;
        if (this.combatText) {
            this.tweens.add({
                targets: this.combatText,
                scale: { from: 1, to: 1.2 },
                duration: 100,
                yoyo: true
            });
        }
    }

    findNearestEnemy() {
        if (!this.enemies || !this.player) return null;
        const activeEnemies = this.enemies.getChildren().filter((enemy) => enemy.active);
        if (!activeEnemies.length) return null;

        let closest = null;
        let minDist = Infinity;
        activeEnemies.forEach((enemy) => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < minDist) {
                minDist = distance;
                closest = enemy;
            }
        });
        return closest;
    }

    updateCombatCooldown(delta) {
        if (!this.combatCooldown || this.combatCooldown <= 0) {
            this.combatCooldown = 0;
            this.combatCooldownText?.setVisible(false);
            return;
        }

        this.combatCooldown = Math.max(0, this.combatCooldown - delta);
        if (this.combatCooldownText && this.combatCooldown > 0) {
            const seconds = (this.combatCooldown / 1000).toFixed(1);
            this.combatCooldownText.setText(`${seconds}s`);
            this.combatCooldownText.setVisible(true);
        }
    }

    showBonusClaimedMessage() {
        const bonusText = this.add.text(400, 100, '🎉 Daily Bonus Claimed!', {
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        bonusText.setOrigin(0.5);
        bonusText.setScrollFactor(0);
        
        // Announce to screen reader
        if (window.UXEnhancements) {
            window.UXEnhancements.announce('Daily bonus claimed successfully!', 'assertive');
        }

        this.tweens.add({
            targets: bonusText,
            scale: { from: 0.8, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: bonusText,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => bonusText.destroy()
                    });
                });
            }
        });
    }

    handleFlowerInteraction(player, flower) {
        // Only show hint once per flower interaction to prevent spam
        if (!this.nearbyFlower) {
            // Show interaction hint when near flowers
            this.showInteractionHint('Press SPACE to smell the flower');

            // Update mobile interact button icon to flower
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🌸');
            }
        }

        // Store reference to current flower for space key interaction
        this.nearbyFlower = flower;
    }

    handleShopProximity(player, shop) {
        // Only execute once per shop proximity to prevent performance issues
        if (!this.nearShop) {
            this.nearShop = true;
            console.log('[GameScene] Player near shop - showing interaction hint');

            // Show shop entry hint
            this.showInteractionHint('Press SPACE to visit the Cozy Cosmic Boutique');

            // Update mobile interact button icon to shop
            if (this.mobileControls) {
                this.mobileControls.updateInteractIcon('🏪');
            }
        }
    }

    enterShop() {
        console.log('[GameScene] Entering Cosmic Shop');

        // Check cooldown to prevent rapid scene transitions
        if (this.shopEntryCooldown) {
            console.log('[GameScene] Shop entry on cooldown');
            return;
        }

        // Set cooldown flag
        this.shopEntryCooldown = true;
        this.time.delayedCall(1000, () => {
            this.shopEntryCooldown = false;
        });

        // Reset nearShop flag before entering
        this.nearShop = false;

        // Save current player position before entering shop
        getGameState().set('world.lastPosition', {
            x: this.player.x,
            y: this.player.y
        });
        console.log('[GameScene] Saved player position:', this.player.x, this.player.y);

        // Play button click sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Show loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Opening Cosmic Shop...');
        }

        // Pause this scene and launch ShopScene on top
        this.scene.pause();
        this.scene.launch('ShopScene');
    }

    openInventory() {
        console.log('[GameScene] Opening Inventory');

        // Play button click sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Show loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Opening Inventory...');
        }

        // Pause this scene and launch InventoryScene on top
        this.scene.pause();
        this.scene.launch('InventoryScene');
    }

    showInteractionHint(message) {
        this.interactionText.setText(message);
        this.interactionText.setVisible(true);

        // Hide the hint after 3 seconds
        this.time.delayedCall(3000, () => {
            this.interactionText.setVisible(false);
        });
    }

    hideInteractionHint() {
        this.interactionText.setVisible(false);
    }


    showCareEffect(message, color) {
        // Create floating message
        const effectText = this.add.text(this.player.x, this.player.y - 50, message, {
            fontSize: '14px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Animate the message
        this.tweens.add({
            targets: effectText,
            y: effectText.y - 30,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                effectText.destroy();
            }
        });

        // Creature happiness animation
        this.tweens.add({
            targets: this.player,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    handleSpaceInteraction() {
        console.log('[GameScene] SPACE pressed - nearShop:', this.nearShop, 'nearbyFlower:', !!this.nearbyFlower);

        // Check for shop entry first
        if (this.nearShop) {
            console.log('[GameScene] Entering shop from SPACE handler');
            this.enterShop();
            this.nearShop = false;
            return;
        }

        if (this.nearbyFlower) {
            // Track interaction in GameState
            getGameState().updateWorldExploration(
                { x: this.player.x, y: this.player.y }, 
                'flowers'
            );
            
            // Create a magical sparkle effect on the flower
            const sparkle = this.add.image(this.nearbyFlower.x, this.nearbyFlower.y - 20, 'magicalSparkle');
            sparkle.setScale(0.6);
            
            // Animate the sparkle
            this.tweens.add({
                targets: sparkle,
                y: sparkle.y - 30,
                alpha: { from: 1, to: 0 },
                scale: { from: 0.5, to: 1 },
                duration: 1000,
                onComplete: () => sparkle.destroy()
            });
            
            // Update creature happiness
            getGameState().updateCreature({
                stats: { happiness: getGameState().get('creature.stats.happiness') + 2 }
            });

            // Show interaction message
            this.showInteractionHint('*sniff* What a lovely smell! (+2 Happiness, +5 XP)');
            this.nearbyFlower = null;

            // Reset mobile interact button icon to default (unless near shop)
            if (this.mobileControls && !this.nearShop) {
                this.mobileControls.updateInteractIcon('👆');
            }

            // Update stats display
            this.updateStatsDisplay();

            // Check achievements after flower interaction
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        }
    }

    update() {
        // Handle player movement
        this.handleMovement();

        // Update position display
        this.updatePositionDisplay();

        // Update cosmic UI elements
        this.updateCosmicMiniMap();
        this.updateGlowingStatBars();

        // Update enemy AI
        if (this.enemies && window.EnemyManager) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.active) {
                    window.EnemyManager.updateEnemyAI(enemy, this.game.loop.delta);
                }
            });
        }

        // Update combat cooldown
        this.updateCombatCooldown(this.game.loop.delta);

        // Check shop proximity distance
        if (this.nearShop && this.shop && this.player) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.shop.x,
                this.shop.y
            );

            // Reset nearShop flag if player moved away (> 250 pixels - accounts for 200x200 body)
            if (distance > 250) {
                console.log('[GameScene] Player moved away from shop, distance:', distance);
                this.nearShop = false;
                this.hideInteractionHint();

                // Reset mobile interact button icon to default
                if (this.mobileControls && !this.nearbyFlower) {
                    this.mobileControls.updateInteractIcon('👆');
                }
            }
        }

        // Handle C key for chat toggle
        if (Phaser.Input.Keyboard.JustDown(this.chatKey)) {
            this.toggleChat();
        }

        // Handle care keys (only if care system is available)
        if (this.carePanelManager) {
            if (Phaser.Input.Keyboard.JustDown(this.feedKey)) {
                this.carePanelManager.performAction('feed');
            }
            if (Phaser.Input.Keyboard.JustDown(this.playKey)) {
                this.carePanelManager.performAction('play');
            }
            if (Phaser.Input.Keyboard.JustDown(this.restKey)) {
                this.carePanelManager.performAction('rest');
            }
            if (Phaser.Input.Keyboard.JustDown(this.careKey)) {
                this.carePanelManager.togglePanel();
            }
        }

        // Handle space key for interactions
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.handleSpaceInteraction();
        }

        // Handle I key for inventory
        if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
            this.openInventory();
        }

        // Handle M key for combat (desktop)
        if (Phaser.Input.Keyboard.JustDown(this.combatKey)) {
            this.fireCombatProjectile();
        }

        // Periodic checks for achievements and tutorials are now handled by timers
        // in setupPeriodicTimers() to improve performance

        // Reset nearby flower when moving away
        if (!this.physics.overlap(this.player, this.flowers)) {
            if (this.nearbyFlower) {
                this.nearbyFlower = null;

                // Reset mobile interact button icon to default (unless near shop)
                if (this.mobileControls && !this.nearShop) {
                    this.mobileControls.updateInteractIcon('👆');
                }
            }
        }
    }

    handleMovement() {
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;

        // Check for virtual joystick input (mobile)
        const joystickThreshold = 0.1; // Ignore very small joystick movements
        if (Math.abs(this.joystickX) > joystickThreshold || Math.abs(this.joystickY) > joystickThreshold) {
            velocityX = this.joystickX * speed;
            velocityY = this.joystickY * speed;
            isMoving = true;
        } else {
            // Check for input from arrow keys and WASD (desktop)
            if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
                velocityX = -speed;
                isMoving = true;
            } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
                velocityX = speed;
                isMoving = true;
            }

            if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
                velocityY = -speed;
                isMoving = true;
            } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
                velocityY = speed;
                isMoving = true;
            }
        }

        // Normalize diagonal movement for keyboard (joystick already normalized)
        if (this.joystickX === 0 && this.joystickY === 0 && velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707; // 1/√2 for normalized diagonal movement
            velocityY *= 0.707;
        }

        // Apply velocity to player
        this.player.setVelocity(velocityX, velocityY);

        // Handle animations
        if (isMoving) {
            this.player.anims.play('walk', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // Flip player sprite based on movement direction
        if (velocityX < 0) {
            this.player.setFlipX(true);
        } else if (velocityX > 0) {
            this.player.setFlipX(false);
        }
    }

    updatePositionDisplay() {
        const x = Math.round(this.player.x);
        const y = Math.round(this.player.y);
        this.positionText.setText(`Position: (${x}, ${y})`);

        // Update position in GameState every few pixels
        if (Math.abs(x - (getGameState().get('world.currentPosition.x') || 0)) > 5 ||
            Math.abs(y - (getGameState().get('world.currentPosition.y') || 0)) > 5) {
            getGameState().updateWorldExploration({ x, y });

            // Check tutorials after movement
            this.time.delayedCall(300, () => this.checkAndCompleteTutorials());
        }
    }

    updateStatsDisplay() {
        const creature = getGameState().get('creature');
        const stats = creature.stats;

        let careStatus = null;
        let happinessDesc = { level: 'unknown' };

        if (this.careSystem) {
            try {
                if (typeof this.careSystem.getCareStatus === 'function') {
                    careStatus = this.careSystem.getCareStatus();
                }
                if (typeof this.careSystem.getHappinessDescription === 'function') {
                    happinessDesc = this.careSystem.getHappinessDescription(stats.happiness);
                }
            } catch (careError) {
                console.warn('[GameScene] Error getting care status:', careError);
                careStatus = null;
                happinessDesc = { level: 'unknown' };
            }
        }

        const achievementProgress = this.getAchievementProgressText();
        const tutorialProgress = this.getTutorialProgressText();

        // Check for low/critical stat values and add warnings
        const healthWarning = this.getStatWarning(stats.health, 100);
        const happinessWarning = this.getStatWarning(stats.happiness, 100);
        const energyWarning = this.getStatWarning(stats.energy, 100);

        const hasCriticalStats = healthWarning.critical || happinessWarning.critical || energyWarning.critical;

        const displayText = [
            `${creature.name} - Level ${creature.level}`,
            `XP: ${creature.experience}/100`,
            `${healthWarning.icon} ${stats.health} ${happinessWarning.icon} ${stats.happiness} (${happinessDesc.level}) ${energyWarning.icon} ${stats.energy}`,
            `Care Streak: ${careStatus ? careStatus.careStreak : 0} days`,
            `${achievementProgress}`,
            `${tutorialProgress}`,
            `Flowers: ${getGameState().get('world.discoveredObjects.flowers')}`
        ].join('\n');

        this.statsText.setText(displayText);

        // Change background color based on stat levels
        if (hasCriticalStats) {
            this.statsText.setBackgroundColor('rgba(139, 0, 0, 0.8)'); // Dark red for critical

            // Add pulsing animation for critical stats
            if (!this.statsPulseAnimation) {
                this.statsPulseAnimation = this.tweens.add({
                    targets: this.statsText,
                    alpha: 0.7,
                    duration: 500,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
        } else if (healthWarning.warning || happinessWarning.warning || energyWarning.warning) {
            this.statsText.setBackgroundColor('rgba(139, 69, 0, 0.8)'); // Dark orange for warning

            // Stop critical pulse if it exists
            if (this.statsPulseAnimation) {
                this.statsPulseAnimation.stop();
                this.statsPulseAnimation = null;
                this.statsText.setAlpha(1);
            }
        } else {
            this.statsText.setBackgroundColor('rgba(0, 0, 0, 0.7)'); // Normal

            // Stop pulse if it exists
            if (this.statsPulseAnimation) {
                this.statsPulseAnimation.stop();
                this.statsPulseAnimation = null;
                this.statsText.setAlpha(1);
            }
        }

        this.updateGlowingStatBars();
    }

    /**
     * Get warning indicator for a stat value
     * @param {number} value - Current stat value
     * @param {number} max - Maximum stat value
     * @returns {Object} Warning info {icon, warning, critical}
     */
    getStatWarning(value, max) {
        const percentage = (value / max) * 100;

        if (percentage <= 20) {
            // Critical - show red warning
            return { icon: '🔴', warning: true, critical: true };
        } else if (percentage <= 40) {
            // Low - show yellow warning
            return { icon: '🟡', warning: true, critical: false };
        } else {
            // Good - show normal icon
            if (value === 100) {
                return { icon: '❤️', warning: false, critical: false }; // Health
            }
            return { icon: '✅', warning: false, critical: false };
        }
    }

    getAchievementProgressText() {
        if (!this.achievementSystem) {
            return 'Achievements: N/A';
        }
        const unlocked = this.achievementSystem.getUnlockedAchievements?.().length ?? 0;
        const total = Object.keys(this.achievementSystem.achievements || {}).length || 0;
        const percent = typeof this.achievementSystem.getProgressPercentage === 'function'
            ? this.achievementSystem.getProgressPercentage()
            : (total ? Math.round((unlocked / total) * 100) : 0);
        return `Achievements: ${unlocked}/${total || '?'} (${percent}%)`;
    }

    getTutorialProgressText() {
        if (!this.tutorialSystem) {
            return 'Tutorials: Cozy hints ready';
        }
        if (typeof this.tutorialSystem.getProgressSummary === 'function') {
            return this.tutorialSystem.getProgressSummary();
        }

        const tutorialState = getGameState().get('tutorial') || {};
        const completedCount = Object.values(tutorialState).filter(Boolean).length;
        return `Tutorials: ${completedCount} tips learned`;
    }

    checkAndUnlockAchievements() {
        if (!this.achievementSystem?.checkAchievements) {
            return;
        }
        const newUnlocks = this.achievementSystem.checkAchievements() || [];
        newUnlocks.forEach((achievement) => this.showAchievementToast(achievement));
    }

    showAchievementToast(achievement) {
        if (!achievement) return;
        const toast = this.add.text(this.scale.width / 2, 180, `⭐ Achievement: ${achievement.name}`, {
            fontSize: '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 18, y: 8 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        toast.setDepth(4100);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 2000,
            duration: 600,
            onComplete: () => toast.destroy()
        });
    }

    checkAndCompleteTutorials() {
        if (!this.tutorialSystem?.checkTutorials) {
            return;
        }
        const completed = this.tutorialSystem.checkTutorials(getGameState().get(), this) || [];
        completed.forEach((tutorial) => this.showTutorialCompletion(tutorial));
    }

    showTutorialHintIfNeeded() {
        if (!this.tutorialSystem?.getNextTutorial || this.isShowingTutorial) {
            return;
        }
        const next = this.tutorialSystem.getNextTutorial(getGameState().get(), this);
        if (next) {
            this.showTutorialHint(next);
        }
    }

    showTutorialHint(tutorial) {
        this.isShowingTutorial = true;
        const hint = this.add.text(this.scale.width / 2, 140, tutorial.message, {
            fontSize: '16px',
            color: '#87CEEB',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 },
            align: 'center'
        }).setOrigin(0.5);
        hint.setScrollFactor(0);
        hint.setDepth(4050);

        this.tweens.add({
            targets: hint,
            alpha: 0,
            delay: 4500,
            duration: 600,
            onComplete: () => {
                hint.destroy();
                this.isShowingTutorial = false;
            }
        });
    }

    showTutorialCompletion(tutorial) {
        if (!tutorial) return;
        const completion = this.add.text(this.scale.width / 2, 170, `✅ ${tutorial.title} complete`, {
            fontSize: '16px',
            color: '#98FB98',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: { x: 16, y: 6 },
            align: 'center'
        }).setOrigin(0.5);
        completion.setScrollFactor(0);
        completion.setDepth(4060);

        this.tweens.add({
            targets: completion,
            alpha: 0,
            delay: 2000,
            duration: 500,
            onComplete: () => completion.destroy()
        });
    }

    registerGameStateListener(event, handler) {
        try {
            const gameState = getGameState();
            if (!gameState || typeof gameState.on !== 'function') {
                return null;
            }

            const unsubscribe = gameState.on(event, handler);
            if (typeof unsubscribe === 'function') {
                this.gameStateUnsubscribers.push(unsubscribe);
            }

            return unsubscribe;
        } catch (error) {
            console.warn(`[GameScene] Failed to register GameState listener for ${event}`, error);
            return null;
        }
    }

    setupGameStateListeners() {
        // Listen for level up events
        this.registerGameStateListener('levelUp', (data) => {
            console.log('[GameScene] Level up celebration triggered!', data);

            // Trigger level up celebration animation
            this.showLevelUpCelebration(data);

            this.updateStatsDisplay();
            // Check achievements after level up
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for care action events
        this.registerGameStateListener('careActionPerformed', (data) => {
            this.carePanelManager?.handleCareEvent(data);
            this.updateStatsDisplay();
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for daily bonus events
        this.registerGameStateListener('dailyBonusClaimed', () => {
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        });

        // Listen for state changes to update UI
        this.registerGameStateListener('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') ||
                data.path.startsWith('creature.care') ||
                data.path.startsWith('world.discoveredObjects') ||
                data.path.startsWith('dailyBonus')) {
                this.updateStatsDisplay();
                this.carePanelManager?.updateHint();
                this.carePanelManager?.updateButtons();
                this.updateDailyBonusButton();
            }
        });
    }

    /**
     * Set up periodic timers for achievements and tutorials
     * Replaces inefficient modulo checks in update loop
     */
    setupPeriodicTimers() {
        // Check achievements every 5 seconds
        this.time.addEvent({
            delay: 5000,
            callback: () => this.checkAndUnlockAchievements(),
            loop: true
        });

        // Check tutorials every 3 seconds
        this.time.addEvent({
            delay: 3000,
            callback: () => this.checkAndCompleteTutorials(),
            loop: true
        });

        // Show tutorial hints every 8 seconds
        this.time.addEvent({
            delay: 8000,
            callback: () => this.showTutorialHintIfNeeded(),
            loop: true
        });

        console.log('[GameScene] Periodic timers set up');
    }

    /**
     * Initialize Kid Mode UI components
     */
    initializeKidMode() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        console.log('ui:info [GameScene] Initializing Kid Mode UI');

        // Create Kid Mode HUD elements
        this.createKidModeHUD();

        // Set up Kid Mode event handlers
        this.setupKidModeEvents();

        // Update creature interaction for Kid Mode
        this.enhanceCreatureInteraction();
    }

    /**
     * Create Kid Mode HUD with status bars and CTA buttons
     */
    createKidModeHUD() {
        // Get creature stats for status bars
        const creatureStats = getGameState().get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        const needsData = {
            hunger: 100 - creatureStats.happiness,
            energy: 100 - creatureStats.energy, 
            fun: Math.max(0, 100 - creatureStats.happiness - 20)
        };

        // Create status bar at top
        if (window.responsiveManager) {
            this.kidModeStatusBar = window.responsiveManager.createKidModeStatusBar(this, needsData);
        }

        // Get next best action based on creature state
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);
        const secondaryActions = window.KidMode.getSecondaryActions(bestAction.action);

        // Create CTA bar at bottom - DISABLED FOR MOBILE SIMPLICITY
        // if (window.responsiveManager) {
        //     this.kidModeCTABar = window.responsiveManager.createKidModeCTABar(this, {
        //         primaryAction: bestAction,
        //         secondaryActions: secondaryActions.slice(0, 2), // Limit to 2 secondary
        //         showPhoto: true
        //     });
        // }

        // Show contextual help message
        if (bestAction.message && window.KidMode && window.KidMode.showSpaceHelpMessage) {
            window.KidMode.showSpaceHelpMessage(this, bestAction.message);
        }
    }

    /**
     * Determine creature's current emotion based on stats
     * @param {Object} stats - Creature stats object
     * @returns {string} Emotion string
     */
    determineCreatureEmotion(stats) {
        const { happiness, energy, health } = stats;

        // Prioritize critical needs
        if (happiness < 30) return 'hungry';
        if (energy < 30) return 'sleepy'; 
        if (health < 50) return 'dirty';
        
        // Secondary states
        if (happiness < 60) return 'bored';
        if (happiness > 80 && energy > 70) return 'excited';
        
        return 'default'; // Happy/content
    }

    /**
     * Set up Kid Mode event handlers
     */
    setupKidModeEvents() {
        // Listen for Kid Mode actions from UI
        if (this.events && !this.kidModeActionHandler) {
            this.kidModeActionHandler = (action) => this.handleKidModeAction(action);
            this.events.on('kid_mode_action', this.kidModeActionHandler);
        }

        // Update HUD when stats change
        this.registerGameStateListener('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') && window.KidMode && window.KidMode.isKidMode()) {
                this.updateKidModeHUD();
            }
        });
    }

    /**
     * Handle Kid Mode action buttons
     * @param {string} action - Action to perform
     */
    handleKidModeAction(action) {
        console.log(`ui:info [GameScene] Kid Mode action: ${action}`);

        switch (action) {
            case 'feed':
                this.carePanelManager?.performAction('feed');
                break;
            case 'play':
                this.carePanelManager?.performAction('play');
                break;
            case 'rest':
                this.carePanelManager?.performAction('rest');
                break;
            case 'pet':
                this.carePanelManager?.performAction('pet');
                break;
            case 'clean':
                this.carePanelManager?.performAction('clean');
                break;
            case 'photo':
                this.takeCreaturePhoto();
                break;
            default:
                console.log(`ui:warn [GameScene] Unknown Kid Mode action: ${action}`);
        }

        // Refresh HUD after action
        this.time.delayedCall(500, () => {
            this.updateKidModeHUD();
        });
    }

    /**
     * Take a photo of the creature (Kid Mode feature)
     */
    takeCreaturePhoto() {
        console.log('ui:info [GameScene] Taking creature photo');

        // Create camera flash effect
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, 0.8);
        flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        flash.setScrollFactor(0);

        // Flash animation
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy()
        });

        // Show photo feedback
        window.KidMode.showHelpMessage(this, '📸 Photo saved! Your creature looks adorable!', 2000);

        // Play camera sound
        window.KidMode.playButtonSound(this);

        // Update stats slightly (creatures like attention)
        if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
            this.careSystem.performCareAction('pet', 0.5); // Small happiness boost
        }
    }

    /**
     * Update Kid Mode HUD elements
     */
    updateKidModeHUD() {
        if (!window.KidMode || !window.KidMode.isKidMode()) {
            return;
        }

        // Get current stats
        const creatureStats = getGameState().get('creature.stats') || { happiness: 80, energy: 60, health: 90 };
        
        // Determine new best action
        const emotion = this.determineCreatureEmotion(creatureStats);
        const bestAction = window.KidMode.getNextBestAction(emotion);

        // Update CTA bar primary button
        if (this.kidModeCTABar) {
            // This is a simplified update - in practice you'd rebuild or update specific elements
            console.log(`ui:debug [GameScene] Updating Kid Mode HUD, new primary action: ${bestAction.action}`);
        }

        // Show new contextual message if emotion changed
        if (this.lastEmotion !== emotion) {
            window.KidMode.showHelpMessage(this, bestAction.message);
            this.lastEmotion = emotion;
        }
    }

    /**
     * Enhance creature interaction for Kid Mode (larger click target)
     */
    enhanceCreatureInteraction() {
        if (this.player && window.KidMode && window.KidMode.isKidMode()) {
            // Make creature more clickable in Kid Mode
            this.player.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
            
            // Visual feedback for Kid Mode
            this.player.on('pointerover', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 200,
                    ease: 'Power2'
                });
            });

            this.player.on('pointerout', () => {
                this.tweens.add({
                    targets: this.player,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 200,
                    ease: 'Power2'
                });
            });
        }
    }

    /**
     * Create chat UI system with Space-Mythic theme
     */
    createChatUI() {
        const width = 800;
        const height = 600;
        const centerX = width / 2;
        const centerY = height / 2;

        // Chat container (starts hidden)
        this.chatContainer = this.add.container(0, 0);
        this.chatContainer.setScrollFactor(0);
        this.chatContainer.setDepth(5000);
        this.chatContainer.setVisible(false);

        // Semi-transparent overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        this.chatContainer.add(overlay);

        // Chat panel background (glassmorphism Space-Mythic style)
        const panelBg = this.add.graphics();
        const panelX = centerX - 300;
        const panelY = centerY - 200;
        const panelWidth = 600;
        const panelHeight = 400;

        // Cosmic gradient background
        panelBg.fillGradientStyle(0x4A148C, 0x4A148C, 0x1A237E, 0x1A237E, 0.95);
        panelBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);

        // Glowing border
        panelBg.lineStyle(3, 0x00CED1, 0.8);
        panelBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);

        this.chatContainer.add(panelBg);

        // Title
        const titleText = this.add.text(centerX, panelY + 30, `Chat with ${getGameState().get('creature.name')}`, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#00CED1',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        titleText.setOrigin(0.5);
        this.chatContainer.add(titleText);

        // Message history container
        const historyBg = this.add.graphics();
        historyBg.fillStyle(0x0a0118, 0.8);
        historyBg.fillRoundedRect(panelX + 20, panelY + 60, panelWidth - 40, 240, 8);
        this.chatContainer.add(historyBg);

        // Chat history text
        this.chatHistoryText = this.add.text(panelX + 30, panelY + 70, 'Start a conversation with your cosmic companion!', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            wordWrap: { width: panelWidth - 60 },
            lineSpacing: 8
        });
        this.chatContainer.add(this.chatHistoryText);

        // Input prompt text
        const promptText = this.add.text(panelX + 20, panelY + 315, 'Quick messages:', {
            fontSize: '12px',
            color: '#00CED1'
        });
        this.chatContainer.add(promptText);

        // Quick message buttons
        const quickMessages = ['Hello!', 'How are you?', 'Tell me about yourself', 'What can you do?'];
        const buttonY = panelY + 340;
        const buttonSpacing = (panelWidth - 40) / 4;

        quickMessages.forEach((message, index) => {
            const buttonX = panelX + 20 + (buttonSpacing * index) + (buttonSpacing / 2);

            const buttonBg = this.add.graphics();
            const btnWidth = buttonSpacing - 10;
            const btnHeight = 35;

            buttonBg.fillStyle(0x00CED1, 0.3);
            buttonBg.fillRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
            buttonBg.lineStyle(2, 0x00CED1, 0.6);
            buttonBg.strokeRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
            buttonBg.setInteractive(new Phaser.Geom.Rectangle(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight), Phaser.Geom.Rectangle.Contains);

            const buttonText = this.add.text(buttonX, buttonY + btnHeight/2, message, {
                fontSize: '12px',
                color: '#FFFFFF',
                align: 'center'
            });
            buttonText.setOrigin(0.5);

            buttonBg.on('pointerdown', () => {
                if (window.AudioManager) window.AudioManager.playButtonClick();
                this.sendChatMessage(message);
            });

            buttonBg.on('pointerover', () => {
                buttonBg.clear();
                buttonBg.fillStyle(0x00CED1, 0.5);
                buttonBg.fillRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
                buttonBg.lineStyle(2, 0xFFD700, 0.8);
                buttonBg.strokeRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
            });

            buttonBg.on('pointerout', () => {
                buttonBg.clear();
                buttonBg.fillStyle(0x00CED1, 0.3);
                buttonBg.fillRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
                buttonBg.lineStyle(2, 0x00CED1, 0.6);
                buttonBg.strokeRoundedRect(buttonX - btnWidth/2, buttonY, btnWidth, btnHeight, 8);
            });

            this.chatContainer.add(buttonBg);
            this.chatContainer.add(buttonText);
        });

        // Close button
        const closeBtn = this.add.text(panelX + panelWidth - 40, panelY + 20, 'X', {
            fontSize: '24px',
            color: '#FF6B6B',
            fontStyle: 'bold'
        });
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive();
        closeBtn.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.toggleChat();
        });
        closeBtn.on('pointerover', () => closeBtn.setColor('#FF4444'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#FF6B6B'));
        this.chatContainer.add(closeBtn);

        // Chat button (always visible bottom-right)
        const chatBtnX = 730;
        const chatBtnY = 530;

        const chatButtonBg = this.add.graphics();
        chatButtonBg.fillStyle(0x00CED1, 0.9);
        chatButtonBg.fillCircle(chatBtnX, chatBtnY, 30);
        chatButtonBg.lineStyle(3, 0xFFD700, 0.8);
        chatButtonBg.strokeCircle(chatBtnX, chatBtnY, 30);
        chatButtonBg.setScrollFactor(0);
        chatButtonBg.setDepth(4000);
        chatButtonBg.setInteractive(new Phaser.Geom.Circle(chatBtnX, chatBtnY, 30), Phaser.Geom.Circle.Contains);

        const chatButtonText = this.add.text(chatBtnX, chatBtnY, '💬', {
            fontSize: '32px'
        });
        chatButtonText.setOrigin(0.5);
        chatButtonText.setScrollFactor(0);
        chatButtonText.setDepth(4001);

        chatButtonBg.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.toggleChat();
        });

        chatButtonBg.on('pointerover', () => {
            chatButtonBg.clear();
            chatButtonBg.fillStyle(0x00CED1, 1.0);
            chatButtonBg.fillCircle(chatBtnX, chatBtnY, 32);
            chatButtonBg.lineStyle(3, 0xFFD700, 1.0);
            chatButtonBg.strokeCircle(chatBtnX, chatBtnY, 32);
            chatButtonText.setScale(1.1);
        });

        chatButtonBg.on('pointerout', () => {
            chatButtonBg.clear();
            chatButtonBg.fillStyle(0x00CED1, 0.9);
            chatButtonBg.fillCircle(chatBtnX, chatBtnY, 30);
            chatButtonBg.lineStyle(3, 0xFFD700, 0.8);
            chatButtonBg.strokeCircle(chatBtnX, chatBtnY, 30);
            chatButtonText.setScale(1.0);
        });

        this.chatButton = chatButtonBg;
        this.chatButtonText = chatButtonText;

        console.log('[GameScene] Chat UI created');
    }

    /**
     * Send a chat message to the creature AI
     */
    async sendChatMessage(message) {
        if (!this.creatureAI) {
            console.warn('[GameScene] CreatureAI not initialized');
            return;
        }

        // Add user message to history
        const currentHistory = this.chatHistoryText.text;
        this.chatHistoryText.setText(currentHistory + `\n\nYou: ${message}`);

        // Show "thinking" indicator
        this.chatHistoryText.setText(this.chatHistoryText.text + `\n\n${getGameState().get('creature.name')}: ...`);

        try {
            // Get creature data for AI context
            const creatureData = {
                name: getGameState().get('creature.name'),
                level: getGameState().get('creature.level'),
                experience: getGameState().get('creature.experience'),
                stats: getGameState().get('creature.stats'),
                colors: getGameState().get('creature.colors'),
                genetics: getGameState().get('creature.genes')
            };

            // Send message to AI
            const response = await this.creatureAI.sendMessage(message, creatureData);

            // Remove "thinking" indicator and add response
            const historyWithoutThinking = this.chatHistoryText.text.replace(/\n\n.*: \.\.\.$/, '');
            this.chatHistoryText.setText(historyWithoutThinking + `\n\n${getGameState().get('creature.name')}: ${response}`);

            // Auto-scroll to bottom (simulate)
            // Trim history if too long
            const lines = this.chatHistoryText.text.split('\n');
            if (lines.length > 20) {
                this.chatHistoryText.setText(lines.slice(-20).join('\n'));
            }

        } catch (error) {
            console.error('[GameScene] Chat error:', error);
            const historyWithoutThinking = this.chatHistoryText.text.replace(/\n\n.*: \.\.\.$/, '');
            this.chatHistoryText.setText(historyWithoutThinking + `\n\n${getGameState().get('creature.name')}: Sorry, I couldn't respond right now.`);
        }
    }

    /**
     * Toggle chat interface
     */
    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        this.chatContainer.setVisible(this.isChatOpen);

        console.log(`[GameScene] Chat ${this.isChatOpen ? 'opened' : 'closed'}`);
    }

    /**
     * Shutdown and cleanup
     * Called when scene is stopped/destroyed
     */
    shutdown() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;
        console.log('[GameScene] Shutting down - cleaning up event listeners');

        // Remove global enemy listeners
        if (window.EnemyManager) {
            if (Array.isArray(this.enemyManagerListeners)) {
                this.enemyManagerListeners.forEach(({ event, handler }) => {
                    try {
                        window.EnemyManager.off(event, handler);
                    } catch (error) {
                        console.warn(`[GameScene] Failed to remove EnemyManager listener for ${event}`, error);
                    }
                });
            }
            this.enemyManagerListeners = [];
            window.EnemyManager.stopSpawning?.();
        }

        // Unsubscribe GameState listeners
        if (Array.isArray(this.gameStateUnsubscribers)) {
            this.gameStateUnsubscribers.forEach((unsubscribe, index) => {
                try {
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    }
                } catch (error) {
                    console.warn(`[GameScene] Failed to unsubscribe GameState listener #${index}`, error);
                }
            });
            this.gameStateUnsubscribers = [];
        }

        // Remove game event listeners
        if (this.game && this.game.events) {
            if (this.virtualJoystickHandler) {
                this.game.events.off('virtual-joystick', this.virtualJoystickHandler, this);
                this.virtualJoystickHandler = null;
            }
            if (this.virtualKeyHandler) {
                this.game.events.off('virtual-key', this.virtualKeyHandler, this);
                this.virtualKeyHandler = null;
            }
        }

        // Remove scene event listeners
        if (this.events && this.kidModeActionHandler) {
            this.events.off('kid_mode_action', this.kidModeActionHandler, this);
            this.kidModeActionHandler = null;
        }

        // Remove input event listeners
        if (this.input) {
            this.input.off('pointerdown');
            if (this.input.keyboard) {
                this.input.keyboard.off('keydown');
            }
        }

        this.economyHud?.destroy();
        this.economyHud = null;
        this.carePanelManager?.destroy();
        this.carePanelManager = null;
        this.worldBuilder?.destroy();
        this.worldBuilder = null;
        if (this.statBarGraphics) {
            this.statBarGraphics.destroy();
            this.statBarGraphics = null;
        }
        if (this.cosmicMiniMap?.background) {
            this.cosmicMiniMap.background.destroy();
            this.cosmicMiniMap = null;
        }
        if (this.miniMapPlayerDot) {
            this.miniMapPlayerDot.destroy();
            this.miniMapPlayerDot = null;
        }

        // Destroy interactive objects (this removes their listeners)
        const interactiveObjects = [
            this.player,
            this.dailyBonusButton,
            this.chatButtonBg
        ];

        interactiveObjects.forEach(obj => {
            if (obj && obj.removeAllListeners) {
                obj.removeAllListeners();
            }
        });
        this.dailyBonusButton?.destroy();
        this.dailyBonusButton = null;
        this.positionText?.destroy();
        this.positionText = null;
        this.statsText?.destroy();
        this.statsText = null;
        this.interactionText?.destroy();
        this.interactionText = null;
        if (this.combatButton?.destroy) {
            this.combatButton.destroy(true);
            this.combatButton = null;
        }
        this.combatBg?.destroy();
        this.combatBg = null;
        this.combatText?.destroy();
        this.combatText = null;
        this.combatCooldownText?.destroy();
        this.combatCooldownText = null;

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        if (Array.isArray(this.coinRespawnTimers)) {
            this.coinRespawnTimers.forEach((timer, index) => {
                try {
                    if (timer?.remove) {
                        timer.remove();
                    } else if (timer?.destroy) {
                        timer.destroy();
                    }
                } catch (error) {
                    console.warn(`[GameScene] Failed to clear coin timer #${index}`, error);
                }
            });
            this.coinRespawnTimers = [];
        }

        if (this.coins) {
            this.coins.clear(true, true);
            this.coins = null;
        }
        if (this.projectiles) {
            this.projectiles.clear(true, true);
            this.projectiles = null;
        }
        if (this.enemies) {
            this.enemies.clear(true, true);
            this.enemies = null;
        }

        this.floatingParticles?.forEach((particle) => {
            try {
                particle.destroy();
            } catch (error) {
                console.warn('[GameScene] Failed to destroy floating particle', error);
            }
        });
        this.floatingParticles = [];

        // Clean up mobile controls
        if (this.mobileControls) {
            this.mobileControls.destroy();
            this.mobileControls = null;
            console.log('[GameScene] Mobile controls cleaned up');
        }

        // Clean up graphics engine
        if (this.graphicsEngine) {
            this.graphicsEngine = null;
        }

        if (this.cameras?.main) {
            this.cameras.main.stopFollow();
        }

        this._sceneLifecycleRegistered = false;

        console.log('[GameScene] Cleanup complete');
    }
}

export default GameScene;

if (typeof window !== 'undefined') {
    window.GameScene = GameScene;
}
