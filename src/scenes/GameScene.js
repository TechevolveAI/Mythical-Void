/**
 * GameScene - The main gameplay scene with an explorable world
 * Features: player movement, large world, environment objects, collision detection, interactions, AI chat
 */

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
        this.carePanel = null;
        this.isCarePanelOpen = false;
        this.coins = null;
        this.coinRespawnTimers = [];
        this.enemies = null;
        this.projectiles = null;
        this.shop = null;
        this.nearShop = false;
    }

    preload() {
        // Sprites will be created in create() method
    }

    create() {
        try {
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
            
            // Create the world background
            this.createWorldBackground();
            
            // Create the player (hatched creature)
            this.createPlayer();
            
            // Set up camera to follow player
            this.setupCamera();
            
            // Create environment objects
            this.createEnvironmentObjects();

            // Create cosmic coins for collection
            this.createCosmicCoins();

            // Create enemies
            this.createEnemies();

            // Set up input controls
            this.setupInput();
            
            // Create UI elements
            this.createUI();

            // Initialize Kid Mode features if enabled
            this.initializeKidMode();
            
            // Listen for GameState events
            this.setupGameStateListeners();
            
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
            { petal: 0xFF69B4, center: 0xFFD700 }, // Pink with gold center
            { petal: 0x9370DB, center: 0xFFA500 }, // Purple with orange center
            { petal: 0xFF6347, center: 0xFFFFE0 }, // Red with cream center
            { petal: 0x4169E1, center: 0xFFF8DC }, // Blue with cornsilk center
            { petal: 0xFFB6C1, center: 0xFF69B4 }  // Light pink with hot pink center
        ];

        flowerColors.forEach((color, index) => {
            this.graphicsEngine.createEnhancedFlower(color.petal, color.center, 1.0);
        });

        // Create magical sparkle for interactions
        this.graphicsEngine.createMagicalSparkle(0x00FFFF, 0.8); // Cyan sparkle for interactions
    }

    createWorldBackground() {
        // Create cosmic space background with stars and nebula
        const background = this.add.graphics();

        // Deep space gradient (dark blue to purple)
        background.fillGradientStyle(0x0a0a2e, 0x0a0a2e, 0x16213e, 0x1a1a4e, 1);
        background.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Add distant stars
        for (let i = 0; i < 200; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const brightness = Math.random();
            const color = brightness > 0.7 ? 0xFFFFFF : (brightness > 0.4 ? 0xCCCCFF : 0x8888FF);
            const size = brightness > 0.8 ? 2 : 1;

            background.fillStyle(color, brightness);
            background.fillCircle(x, y, size);
        }

        // Add nebula clouds (purple and blue patches)
        const nebulaColors = [
            { color: 0x9370DB, alpha: 0.15 }, // Purple
            { color: 0x4169E1, alpha: 0.12 }, // Blue
            { color: 0xFF1493, alpha: 0.08 }, // Pink
            { color: 0x00CED1, alpha: 0.10 }  // Cyan
        ];

        for (let i = 0; i < 30; i++) {
            const nebula = Phaser.Math.RND.pick(nebulaColors);
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(80, 200);

            background.fillStyle(nebula.color, nebula.alpha);
            background.fillCircle(x, y, size);
        }

        // Add cosmic "ground" platforms (floating crystal platforms)
        background.fillStyle(0x2a2a4e, 0.4);
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const width = Phaser.Math.Between(100, 300);
            const height = Phaser.Math.Between(20, 40);

            background.fillRoundedRect(x, y, width, height, 10);

            // Add crystal edge highlights
            background.fillStyle(0x9370DB, 0.3);
            background.fillRoundedRect(x, y, width, height * 0.3, 5);
        }
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
            this.showCreatureCareMenu();
        });
        
        // Add hover effect to show it's interactive
        this.player.on('pointerover', () => {
            this.player.setTint(0xffcccc); // Light red tint
            this.showInteractionHint('Click to care for your creature');
        });
        
        this.player.on('pointerout', () => {
            this.player.clearTint();
            this.hideInteractionHint();
        });
        
        // Create enhanced walking animation with genetics-based frames
        this.anims.create({
            key: 'walk',
            frames: creatureTextures.map(texture => ({ key: texture })),
            frameRate: 8,
            repeat: -1
        });

        // Create idle animation (just first frame)
        this.anims.create({
            key: 'idle',
            frames: [{ key: creatureTextures[0] }],
            frameRate: 1
        });
        
        console.log('game:info [GameScene] Player creature created with textures:', creatureTextures);
    }

    setupCamera() {
        // Make camera follow the player with smooth following
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // Set camera bounds to match world bounds
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Set default zoom
        this.cameras.main.setZoom(1);

        console.log(`game:info [GameScene] Camera configured - World: ${this.worldWidth}x${this.worldHeight}, Viewport: ${this.cameras.main.width}x${this.cameras.main.height}`);
    }

    createEnvironmentObjects() {
        console.log('game:info [GameScene] Creating cosmic environment objects');

        // Create physics groups
        this.trees = this.physics.add.staticGroup();
        this.rocks = this.physics.add.staticGroup();
        this.flowers = this.physics.add.staticGroup();

        // Verify textures exist before placing objects
        const treeVariants = ['enhancedTree_summer', 'enhancedTree_spring', 'enhancedTree_autumn'];
        const validTreeVariants = treeVariants.filter(tex => this.textures.exists(tex));

        if (validTreeVariants.length > 0) {
            console.log(`game:info [GameScene] Placing ${validTreeVariants.length} tree variants`);
            for (let i = 0; i < 15; i++) {
                const x = Phaser.Math.Between(150, this.worldWidth - 150);
                const y = Phaser.Math.Between(150, this.worldHeight - 150);
                const treeType = Phaser.Math.RND.pick(validTreeVariants);

                try {
                    const tree = this.trees.create(x, y, treeType);
                    tree.setScale(Phaser.Math.FloatBetween(1.0, 1.8));
                    tree.body.setSize(30, 40);
                    tree.setDepth(y); // Depth sorting for proper layering
                } catch (error) {
                    console.warn('game:warn [GameScene] Failed to create tree:', error.message);
                }
            }
        } else {
            console.warn('game:warn [GameScene] No tree textures available');
        }

        // Place cosmic asteroids
        let rockCount = 0;
        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (this.textures.exists(textureName)) {
                for (let j = 0; j < 10; j++) {
                    const x = Phaser.Math.Between(100, this.worldWidth - 100);
                    const y = Phaser.Math.Between(100, this.worldHeight - 100);

                    try {
                        const rock = this.rocks.create(x, y, textureName);
                        rock.setScale(Phaser.Math.FloatBetween(1.2, 2.0));
                        rock.body.setSize(25, 20);
                        rock.setDepth(y);
                        rockCount++;
                    } catch (error) {
                        console.warn('game:warn [GameScene] Failed to create rock:', error.message);
                    }
                }
            }
        }
        console.log(`game:info [GameScene] Placed ${rockCount} cosmic asteroids`);

        // Place cosmic star flowers
        if (this.textures.exists('enhancedFlower')) {
            for (let i = 0; i < 25; i++) {
                const x = Phaser.Math.Between(80, this.worldWidth - 80);
                const y = Phaser.Math.Between(80, this.worldHeight - 80);

                try {
                    const flower = this.flowers.create(x, y, 'enhancedFlower');
                    flower.setScale(Phaser.Math.FloatBetween(1.0, 1.5));
                    flower.body.setSize(15, 20);
                    flower.setDepth(y);

                    // Color variations for variety
                    const tints = [0xFFFFFF, 0xFFB6FF, 0xB6FFFF, 0xFFFFB6, 0xFFB6B6];
                    flower.setTint(Phaser.Math.RND.pick(tints));
                } catch (error) {
                    console.warn('game:warn [GameScene] Failed to create flower:', error.message);
                }
            }
            console.log('game:info [GameScene] Placed 25 cosmic star flowers');
        } else {
            console.warn('game:warn [GameScene] Flower texture not available');
        }

        // Create and place Cosmic Shop
        this.graphicsEngine.createCosmicShop();

        const shopX = 1400; // Right side of the world
        const shopY = 600;  // Center vertically

        this.shop = this.physics.add.staticSprite(shopX, shopY, 'cosmicShop');
        this.shop.setDepth(shopY);

        // Set collision body - LARGE AREA for easy shop entry
        this.shop.body.setSize(200, 200); // Large interaction area
        this.shop.body.setOffset(-50, -50); // Center the collision box

        console.log(`game:info [GameScene] Cosmic Shop placed at (${shopX}, ${shopY})`);
        console.log(`game:debug [GameScene] Shop body: width=${this.shop.body.width}, height=${this.shop.body.height}`);

        // DEBUG: Draw shop collision area (green rectangle)
        const shopDebugGraphics = this.add.graphics();
        shopDebugGraphics.lineStyle(3, 0x00FF00, 0.8);
        shopDebugGraphics.strokeRect(
            this.shop.body.x,
            this.shop.body.y,
            this.shop.body.width,
            this.shop.body.height
        );
        shopDebugGraphics.setDepth(10000); // Very high so it's always visible
        console.log(`game:debug [GameScene] Shop collision area drawn at (${this.shop.body.x}, ${this.shop.body.y})`);

        // Set up collision detection
        if (this.player) {
            this.physics.add.collider(this.player, this.trees);
            this.physics.add.collider(this.player, this.rocks);
            this.physics.add.overlap(this.player, this.flowers, this.handleFlowerInteraction, null, this);

            // Shop proximity detection for entry
            this.physics.add.overlap(this.player, this.shop, this.handleShopProximity, null, this);
            console.log(`game:debug [GameScene] Shop overlap handler set up`);
        }

        console.log('game:info [GameScene] Environment objects creation complete');
    }

    createCosmicCoins() {
        console.log('game:info [GameScene] Creating cosmic coins for collection');

        // Create cosmic coin sprite if it doesn't exist
        this.graphicsEngine.createCosmicCoin();

        // Create physics group for coins (no gravity, not static - they can be collected)
        this.coins = this.physics.add.group({
            defaultKey: 'cosmicCoin',
            maxSize: 20
        });

        // Track coin respawn timers
        this.coinRespawnTimers = [];

        // Spawn initial coins scattered around the world
        const coinCount = 18; // 15-20 coins
        for (let i = 0; i < coinCount; i++) {
            this.spawnCoin();
        }

        // Set up overlap detection for coin collection
        if (this.player) {
            this.physics.add.overlap(this.player, this.coins, this.handleCoinCollection, null, this);
        }

        console.log(`game:info [GameScene] Spawned ${coinCount} cosmic coins`);
    }

    spawnCoin(x = null, y = null) {
        // Use provided position or random position avoiding center (where player starts)
        const coinX = x !== null ? x : Phaser.Math.Between(200, this.worldWidth - 200);
        const coinY = y !== null ? y : Phaser.Math.Between(200, this.worldHeight - 200);

        // Avoid spawning too close to player spawn point (center)
        const centerX = this.worldWidth / 2;
        const centerY = this.worldHeight / 2;
        const distance = Phaser.Math.Distance.Between(coinX, coinY, centerX, centerY);

        if (distance < 150 && x === null) {
            // Too close to center, try again
            return this.spawnCoin();
        }

        // Create coin sprite
        const coin = this.coins.get(coinX, coinY, 'cosmicCoin');

        if (!coin) {
            console.warn('game:warn [GameScene] Could not create coin (group full)');
            return null;
        }

        coin.setActive(true);
        coin.setVisible(true);
        coin.setScale(1.0);
        coin.setDepth(1000); // Above environment objects

        // Store original position for respawn
        coin.setData('originalX', coinX);
        coin.setData('originalY', coinY);
        coin.setData('value', 10); // Each coin worth 10 cosmic coins

        // Floating animation - gentle up/down movement
        this.tweens.add({
            targets: coin,
            y: coinY - 8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Rotation animation - slow spin
        this.tweens.add({
            targets: coin,
            angle: 360,
            duration: 4000,
            repeat: -1
        });

        // Pulse scale animation - subtle breathing effect
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
        // Prevent double collection
        if (!coin.active) return;

        const coinValue = coin.getData('value') || 10;

        // Magnet effect - coin flies toward player before collection
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
                // Add coins to economy
                if (window.EconomyManager) {
                    window.EconomyManager.addCoins(coinValue, 'collection');
                }

                // Particle burst effect
                this.createCollectionParticles(coin.x, coin.y);

                // Play collection sound effect
                if (window.AudioManager) {
                    window.AudioManager.playCoinCollect();
                }

                // Hide coin and mark for respawn
                coin.setActive(false);
                coin.setVisible(false);
                this.tweens.killTweensOf(coin); // Stop all animations on this coin

                // Schedule respawn
                const respawnTime = Phaser.Math.Between(45000, 60000); // 45-60 seconds
                const timer = this.time.delayedCall(respawnTime, () => {
                    this.respawnCoin(coin);
                });

                this.coinRespawnTimers.push(timer);

                console.log(`game:info [GameScene] Collected ${coinValue} cosmic coins. Respawn in ${respawnTime / 1000}s`);
            }
        });
    }

    respawnCoin(coin) {
        const originalX = coin.getData('originalX');
        const originalY = coin.getData('originalY');

        // Reset coin to original position
        coin.setPosition(originalX, originalY);
        coin.setActive(true);
        coin.setVisible(true);
        coin.setAlpha(0);
        coin.setScale(0.5);

        // Fade in animation
        this.tweens.add({
            targets: coin,
            alpha: 1,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Restart floating animations
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
        // Create sparkle particles on coin collection
        const particles = this.add.particles(x, y, 'cosmicCoin', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            gravityY: -100,
            quantity: 8,
            blendMode: 'ADD'
        });

        // Clean up particle emitter after particles fade
        this.time.delayedCall(700, () => {
            particles.destroy();
        });
    }

    createEnemies() {
        console.log('game:info [GameScene] Creating enemy spawning system');

        // Create enemy sprites
        this.graphicsEngine.createVoidWisp();
        this.graphicsEngine.createShadowSprite();

        // Create physics group for enemies
        this.enemies = this.physics.add.group({
            maxSize: 10
        });

        // Create physics group for projectiles
        this.projectiles = this.physics.add.group({
            maxSize: 20
        });

        // Set up ProjectileManager
        if (window.ProjectileManager) {
            window.ProjectileManager.setup(this, this.projectiles, this.enemies);
            console.log('game:info [GameScene] ProjectileManager setup complete');
        } else {
            console.error('[GameScene] ProjectileManager not available');
        }

        // Start enemy spawning via EnemyManager
        if (window.EnemyManager) {
            window.EnemyManager.startSpawning(
                this,
                this.enemies,
                this.player,
                this.worldWidth,
                this.worldHeight
            );

            // Listen for enemy death events to create particles
            window.EnemyManager.on('enemyKilled', (data) => {
                this.createEnemyDeathParticles(data.x, data.y, data.type);
            });

            console.log('game:info [GameScene] Enemy Manager started');
        } else {
            console.error('[GameScene] EnemyManager not available');
        }
    }

    createEnemyDeathParticles(x, y, enemyType) {
        // Determine particle color based on enemy type
        const particleColor = enemyType === 'voidWisp' ? 0x8B00D9 : 0x1A0A2E;

        // Create simple graphics for particles
        const particleGraphics = this.add.graphics();
        particleGraphics.fillStyle(particleColor, 1);
        particleGraphics.fillCircle(4, 4, 4);
        particleGraphics.generateTexture('enemyParticle', 8, 8);
        particleGraphics.destroy();

        // Create explosion particles
        const particles = this.add.particles(x, y, 'enemyParticle', {
            speed: { min: 100, max: 200 },
            scale: { start: 1.0, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 800,
            gravityY: 50,
            quantity: 12,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        });

        // Clean up
        this.time.delayedCall(1000, () => {
            particles.destroy();
            if (this.textures.exists('enemyParticle')) {
                this.textures.remove('enemyParticle');
            }
        });
    }

    setupInput() {
        // Create cursor keys for arrow key movement
        this.cursors = this.input.keyboard.createCursorKeys();

        // Create WASD keys
        this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');

        // C key for chat toggle
        this.chatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

        // Care system keys
        this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.playKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.restKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.careKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);

        // Space key for interactions
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // I key for inventory
        this.inventoryKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);

        // M key for combat (desktop)
        this.combatKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

        // MOBILE: Virtual joystick state
        this.joystickX = 0;
        this.joystickY = 0;

        // Listen for virtual joystick events
        this.game.events.on('virtual-joystick', (data) => {
            this.joystickX = data.x;
            this.joystickY = data.y;
        });

        // Listen for virtual button events
        this.game.events.on('virtual-key', (data) => {
            if (data.key === 'space' && data.type === 'down') {
                this.handleInteraction();
            }
        });

        // MOBILE: Show virtual controls (joystick + action buttons)
        if (window.responsiveManager && window.responsiveManager.isMobile) {
            window.responsiveManager.showVirtualControls();
            console.log('[GameScene] Virtual controls activated for mobile');
        }

        // Resume audio context on first user interaction (required by browsers)
        const resumeAudio = () => {
            if (window.AudioManager) {
                window.AudioManager.resume();
            }
        };

        // Listen for first pointer down or keyboard interaction
        this.input.once('pointerdown', resumeAudio);
        this.input.keyboard.once('keydown', resumeAudio);
    }

    createUI() {
        // Reset button (top-left corner, fixed to camera)
        this.createResetButton();

        // Position display (moved right to make room for reset button)
        this.positionText = this.add.text(16, 60, 'Position: (0, 0)', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 6, y: 3 }
        });
        this.positionText.setScrollFactor(0); // Keep fixed on screen

        // Creature stats display (top-right corner)
        const creature = getGameState().get('creature');
        this.statsText = this.add.text(784, 16, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 },
            align: 'right'
        });
        this.statsText.setOrigin(1, 0);
        this.statsText.setScrollFactor(0);
        this.updateStatsDisplay();

        // Currency HUD (top-right, below stats)
        this.createCurrencyHUD();

        // Daily bonus button (top-center)
        this.createDailyBonusButton();

        // Combat action button (bottom-right)
        this.createCombatButton();

        // Care panel (hidden initially)
        this.createCarePanel();

        // Interaction hint (hidden initially)
        this.interactionText = this.add.text(400, 550, '', {
            fontSize: '16px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 10, y: 6 }
        });
        this.interactionText.setOrigin(0.5);
        this.interactionText.setScrollFactor(0);
        this.interactionText.setDepth(3000); // High depth to ensure visibility
        this.interactionText.setVisible(false);

        // Care hint (bottom-left corner) - DISABLED FOR MOBILE SIMPLICITY
        this.careHintText = this.add.text(16, 584, '', {
            fontSize: '12px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 6, y: 3 }
        });
        this.careHintText.setOrigin(0, 1);
        this.careHintText.setScrollFactor(0);
        this.careHintText.setVisible(false); // Hide on mobile
        // this.updateCareHint(); // Disabled

        // Add innovative cosmic UI elements
        this.createCosmicMiniMap();
        this.createGlowingStatBars();
        this.createFloatingParticles();
    }

    createCurrencyHUD() {
        console.log('[GameScene] Creating currency HUD');

        // Container for currency display (top-right, below stats)
        const hudX = 784;
        const hudY = 90; // Below stats text

        // Background for currency display
        const currencyBg = this.add.graphics();
        currencyBg.setScrollFactor(0);
        currencyBg.setDepth(1000);

        // Cosmic-themed background with glow
        currencyBg.fillStyle(0x9370DB, 0.15); // Purple glow
        currencyBg.fillRoundedRect(hudX - 140, hudY - 8, 140, 32, 8);
        currencyBg.lineStyle(2, 0x00CED1, 0.6); // Cyan border
        currencyBg.strokeRoundedRect(hudX - 140, hudY - 8, 140, 32, 8);

        this.currencyBg = currencyBg;

        // Cosmic coin icon (using the sprite we created)
        this.currencyIcon = this.add.image(hudX - 120, hudY + 8, 'cosmicCoin');
        this.currencyIcon.setScale(0.75);
        this.currencyIcon.setScrollFactor(0);
        this.currencyIcon.setDepth(1001);

        // Add subtle rotation animation to icon
        this.tweens.add({
            targets: this.currencyIcon,
            angle: 360,
            duration: 6000,
            repeat: -1,
            ease: 'Linear'
        });

        // Currency text display
        const initialBalance = window.EconomyManager ? window.EconomyManager.getBalance() : 0;
        this.currencyText = this.add.text(hudX - 95, hudY + 8, this.formatCurrencyText(initialBalance), {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#00CED1', // Cyan
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.currencyText.setOrigin(0, 0.5);
        this.currencyText.setScrollFactor(0);
        this.currencyText.setDepth(1001);

        // Store current balance for animation
        this.currentDisplayedBalance = initialBalance;

        // Listen to EconomyManager events for updates
        if (window.EconomyManager) {
            window.EconomyManager.on('coins:added', this.handleCoinsAdded.bind(this));
            window.EconomyManager.on('coins:spent', this.handleCoinsSpent.bind(this));
            window.EconomyManager.on('coins:insufficient', this.handleInsufficientCoins.bind(this));
        }

        console.log('[GameScene] Currency HUD created with balance:', initialBalance);
    }

    formatCurrencyText(amount) {
        // Format with thousands separator
        return window.EconomyManager ? window.EconomyManager.formatCoins(amount) : '0';
    }

    handleCoinsAdded(data) {
        console.log('[GameScene] Coins added:', data);

        // Animate count-up effect
        this.animateCurrencyChange(data.oldBalance, data.newBalance);

        // Flash effect on background
        this.tweens.add({
            targets: this.currencyBg,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });

        // Pulse effect on icon
        this.tweens.add({
            targets: this.currencyIcon,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 150,
            ease: 'Back.easeOut',
            yoyo: true
        });

        // Glow pulse on text
        this.tweens.add({
            targets: this.currencyText,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    handleCoinsSpent(data) {
        console.log('[GameScene] Coins spent:', data);

        // Animate count-down effect
        this.animateCurrencyChange(data.oldBalance, data.newBalance);

        // Play purchase sound if this was a purchase
        if (window.AudioManager && data.reason && data.reason.startsWith('purchase:')) {
            window.AudioManager.playPurchase();
        }

        // Subtle red flash for spending
        const originalColor = this.currencyText.style.color;
        this.currencyText.setColor('#FF6347'); // Tomato red

        this.time.delayedCall(300, () => {
            this.currencyText.setColor(originalColor);
        });
    }

    handleInsufficientCoins(data) {
        console.log('[GameScene] Insufficient coins:', data);

        // Play error sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Shake effect to indicate can't afford
        const originalX = this.currencyText.x;

        this.tweens.add({
            targets: [this.currencyText, this.currencyIcon, this.currencyBg],
            x: '+=5',
            duration: 50,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.currencyText.x = originalX;
                this.currencyIcon.x = originalX - 25;
            }
        });

        // Flash red
        this.currencyText.setColor('#FF0000');
        this.time.delayedCall(500, () => {
            this.currencyText.setColor('#00CED1');
        });
    }

    animateCurrencyChange(oldBalance, newBalance) {
        // Smooth count-up or count-down animation
        const duration = 500;
        const steps = 20;
        const stepDuration = duration / steps;
        const balanceDiff = newBalance - oldBalance;
        const stepAmount = balanceDiff / steps;

        let currentStep = 0;

        const timer = this.time.addEvent({
            delay: stepDuration,
            callback: () => {
                currentStep++;
                this.currentDisplayedBalance += stepAmount;

                if (currentStep >= steps) {
                    this.currentDisplayedBalance = newBalance; // Ensure exact final value
                    timer.remove();
                }

                this.currencyText.setText(this.formatCurrencyText(Math.floor(this.currentDisplayedBalance)));
            },
            repeat: steps - 1
        });
    }

    createCosmicMiniMap() {
        // Mini-map in bottom-right corner
        const miniMapSize = 120;
        const miniMapX = 800 - 16 - miniMapSize;
        const miniMapY = 600 - 16 - miniMapSize;

        // Mini-map background (cosmic portal style)
        const miniMapBg = this.add.graphics();
        miniMapBg.setScrollFactor(0);
        miniMapBg.setDepth(1000);

        // Outer glow
        miniMapBg.fillStyle(0x9370DB, 0.3);
        miniMapBg.fillCircle(miniMapX + miniMapSize / 2, miniMapY + miniMapSize / 2, miniMapSize / 2 + 5);

        // Main background
        miniMapBg.fillStyle(0x0a0a2e, 0.8);
        miniMapBg.fillCircle(miniMapX + miniMapSize / 2, miniMapY + miniMapSize / 2, miniMapSize / 2);

        // Border
        miniMapBg.lineStyle(2, 0xFFD700, 0.8);
        miniMapBg.strokeCircle(miniMapX + miniMapSize / 2, miniMapY + miniMapSize / 2, miniMapSize / 2);

        // Player position indicator (updated in update loop)
        this.miniMapPlayer = this.add.graphics();
        this.miniMapPlayer.setScrollFactor(0);
        this.miniMapPlayer.setDepth(1001);
        this.miniMapData = { x: miniMapX, y: miniMapY, size: miniMapSize };

        // Mini-map label
        this.add.text(miniMapX + miniMapSize / 2, miniMapY - 10, 'Cosmic Map', {
            fontSize: '10px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);
    }

    createGlowingStatBars() {
        // Enhanced stat bars with glow effects (left side)
        const barX = 16;
        const barY = 100;
        const barWidth = 150;
        const barHeight = 16;
        const barSpacing = 30;

        const creature = getGameState().get('creature');
        const stats = creature.stats || { health: 100, happiness: 100, energy: 100 };

        this.statBars = {
            health: { value: stats.health, color: 0xFF4444, label: '❤️ Health' },
            happiness: { value: stats.happiness, color: 0xFFD700, label: '😊 Joy' },
            energy: { value: stats.energy, color: 0x4444FF, label: '⚡ Energy' }
        };

        this.statBarGraphics = this.add.graphics();
        this.statBarGraphics.setScrollFactor(0);
        this.statBarGraphics.setDepth(1000);

        Object.keys(this.statBars).forEach((key, index) => {
            const stat = this.statBars[key];
            const y = barY + (index * barSpacing);

            // Label
            this.add.text(barX, y - 2, stat.label, {
                fontSize: '12px',
                color: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 2
            }).setScrollFactor(0).setDepth(1000);

            // Store position for dynamic updates
            stat.x = barX;
            stat.y = y + 12;
            stat.width = barWidth;
            stat.height = barHeight;
        });
    }

    createFloatingParticles() {
        // Add ambient floating particles (cosmic dust)
        this.cosmicParticles = [];

        for (let i = 0; i < 15; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, 800),
                Phaser.Math.Between(0, 600),
                Phaser.Math.FloatBetween(1, 3),
                0xFFFFFF,
                Phaser.Math.FloatBetween(0.3, 0.7)
            );
            particle.setScrollFactor(0.1); // Slight parallax
            particle.setDepth(-10); // Behind everything

            // Floating animation
            this.tweens.add({
                targets: particle,
                y: particle.y + Phaser.Math.Between(-50, 50),
                x: particle.x + Phaser.Math.Between(-30, 30),
                alpha: { from: 0.3, to: 0.8 },
                duration: Phaser.Math.Between(3000, 6000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            this.cosmicParticles.push(particle);
        }
    }

    updateCosmicMiniMap() {
        if (!this.miniMapData || !this.miniMapPlayer || !this.player) return;

        // Clear previous player indicator
        this.miniMapPlayer.clear();

        // Calculate player position on mini-map
        const mapX = this.miniMapData.x + this.miniMapData.size / 2;
        const mapY = this.miniMapData.y + this.miniMapData.size / 2;
        const scaleX = (this.player.x / this.worldWidth) * (this.miniMapData.size / 2);
        const scaleY = (this.player.y / this.worldHeight) * (this.miniMapData.size / 2);

        const playerMapX = mapX + (scaleX - this.miniMapData.size / 4);
        const playerMapY = mapY + (scaleY - this.miniMapData.size / 4);

        // Draw pulsing player indicator
        const pulseScale = 1 + Math.sin(this.time.now / 200) * 0.3;

        this.miniMapPlayer.fillStyle(0xFFFFFF, 0.9);
        this.miniMapPlayer.fillCircle(playerMapX, playerMapY, 4 * pulseScale);

        this.miniMapPlayer.fillStyle(0xFFD700, 0.7);
        this.miniMapPlayer.fillCircle(playerMapX, playerMapY, 2 * pulseScale);
    }

    updateGlowingStatBars() {
        if (!this.statBarGraphics || !this.statBars) return;

        this.statBarGraphics.clear();

        const creature = getGameState().get('creature');
        const stats = creature.stats || { health: 100, happiness: 100, energy: 100 };

        // Update values
        this.statBars.health.value = stats.health;
        this.statBars.happiness.value = stats.happiness;
        this.statBars.energy.value = stats.energy;

        Object.keys(this.statBars).forEach(key => {
            const stat = this.statBars[key];
            const fillAmount = (stat.value / 100) * stat.width;
            const pulseAmount = Math.sin(this.time.now / 500) * 0.1 + 0.9;

            // Background
            this.statBarGraphics.fillStyle(0x000000, 0.6);
            this.statBarGraphics.fillRoundedRect(stat.x, stat.y, stat.width, stat.height, 8);

            // Border
            this.statBarGraphics.lineStyle(2, 0x333333, 0.8);
            this.statBarGraphics.strokeRoundedRect(stat.x, stat.y, stat.width, stat.height, 8);

            // Glow effect
            this.statBarGraphics.fillStyle(stat.color, 0.2);
            this.statBarGraphics.fillRoundedRect(stat.x, stat.y, fillAmount, stat.height, 8);

            // Main fill
            this.statBarGraphics.fillStyle(stat.color, pulseAmount);
            this.statBarGraphics.fillRoundedRect(stat.x + 2, stat.y + 2, Math.max(0, fillAmount - 4), stat.height - 4, 6);

            // Shine effect
            this.statBarGraphics.fillStyle(0xFFFFFF, 0.3 * pulseAmount);
            this.statBarGraphics.fillRoundedRect(stat.x + 2, stat.y + 2, Math.max(0, fillAmount - 4), (stat.height - 4) / 2, 6);
        });
    }

    createDailyBonusButton() {
        // Check if care system is available
        if (!this.careSystem) {
            console.warn('CareSystem not available, skipping daily bonus button');
            return;
        }
        
        // Daily bonus button (top-center)
        const dailyBonus = this.careSystem.getDailyLoginBonus();

        this.dailyBonusButton = this.add.text(400, 16, '', {
            fontSize: '14px',
            color: dailyBonus.available ? '#FFD700' : '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: dailyBonus.available ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)',
            padding: { x: 12, y: 6 },
            align: 'center'
        });
        this.dailyBonusButton.setOrigin(0.5, 0);
        this.dailyBonusButton.setScrollFactor(0);
        this.dailyBonusButton.setInteractive({ useHandCursor: true });
        
        // Add accessibility attributes
        this.dailyBonusButton.setData('tooltip', 'Claim your daily bonus for extra XP and rewards');
        this.dailyBonusButton.setData('ariaLabel', 'Daily Bonus Button');

        // Make it clickable with visual feedback
        this.dailyBonusButton.on('pointerdown', () => {
            this.claimDailyBonus();
            // Add visual feedback
            if (window.UXEnhancements) {
                const buttonElement = this.dailyBonusButton;
                buttonElement.setScale(0.95);
                this.time.delayedCall(100, () => buttonElement.setScale(1));
            }
        });
        
        // Add hover effect
        this.dailyBonusButton.on('pointerover', () => {
            this.dailyBonusButton.setScale(1.05);
        });
        
        this.dailyBonusButton.on('pointerout', () => {
            this.dailyBonusButton.setScale(1);
        });

        this.updateDailyBonusButton();
    }

    createCombatButton() {
        console.log('[GameScene] Creating combat action button');

        // Only create visual button on mobile devices
        const isMobile = window.responsiveManager && window.responsiveManager.isMobile;

        if (!isMobile) {
            console.log('[GameScene] Desktop detected - combat button skipped (use M key instead)');
            // Combat state still needed for desktop
            this.combatCooldown = 0;
            this.combatCooldownMax = 1000; // 1 second between attacks
            return;
        }

        // Combat button positioned at bottom-right (easy thumb access on mobile)
        const buttonX = 720;
        const buttonY = 550;
        const buttonWidth = 70;
        const buttonHeight = 70;

        // Button background (glowing cosmic circle)
        const combatBg = this.add.graphics();
        combatBg.setScrollFactor(0);
        combatBg.setDepth(2000);

        // Outer glow
        combatBg.fillStyle(0xFF6B35, 0.3);
        combatBg.fillCircle(buttonX, buttonY, buttonWidth / 2 + 5);

        // Main button circle
        combatBg.fillStyle(0xFF6B35, 0.8);
        combatBg.fillCircle(buttonX, buttonY, buttonWidth / 2);

        // Inner gradient effect
        combatBg.fillStyle(0xFF8C42, 0.6);
        combatBg.fillCircle(buttonX, buttonY, buttonWidth / 2 - 5);

        // Border
        combatBg.lineStyle(3, 0xFFFFFF, 0.8);
        combatBg.strokeCircle(buttonX, buttonY, buttonWidth / 2);

        this.combatBg = combatBg;

        // Attack icon/text
        this.combatText = this.add.text(buttonX, buttonY, '⚔️', {
            fontSize: '32px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.combatText.setOrigin(0.5);
        this.combatText.setScrollFactor(0);
        this.combatText.setDepth(2001);

        // Cooldown text (hidden initially)
        this.combatCooldownText = this.add.text(buttonX, buttonY + 45, '', {
            fontSize: '12px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        });
        this.combatCooldownText.setOrigin(0.5);
        this.combatCooldownText.setScrollFactor(0);
        this.combatCooldownText.setDepth(2001);
        this.combatCooldownText.setVisible(false);

        // Make button interactive
        const hitArea = new Phaser.Geom.Circle(0, 0, buttonWidth / 2);
        const combatButton = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        combatButton.setInteractive({ hitArea, hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
        combatButton.setScrollFactor(0);
        combatButton.setDepth(2000);

        // Combat state
        this.combatCooldown = 0;
        this.combatCooldownMax = 1000; // 1 second between attacks

        // Button press handler
        combatButton.on('pointerdown', () => {
            this.fireCombatProjectile();
        });

        // Hover effects
        combatButton.on('pointerover', () => {
            this.tweens.add({
                targets: [this.combatBg, this.combatText],
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100,
                ease: 'Power2'
            });
        });

        combatButton.on('pointerout', () => {
            this.tweens.add({
                targets: [this.combatBg, this.combatText],
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100,
                ease: 'Power2'
            });
        });

        // Pulse animation
        this.tweens.add({
            targets: combatBg,
            alpha: 0.6,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.combatButton = combatButton;

        console.log('[GameScene] Combat button created (mobile)');
    }

    fireCombatProjectile() {
        // Check cooldown
        if (this.combatCooldown > 0) {
            console.log('[GameScene] Combat on cooldown');
            return;
        }

        // Play attack sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }

        // Get creature rarity for projectile type
        const creatureGenes = window.GameState.get('creature.genes');
        const rarity = creatureGenes?.rarity || 'common';

        // Fire projectile from player toward nearest enemy
        const nearestEnemy = this.findNearestEnemy();

        if (!nearestEnemy) {
            console.log('[GameScene] No enemies to target');
            return;
        }

        // Create projectile (will implement ProjectileManager next)
        if (window.ProjectileManager) {
            window.ProjectileManager.fireProjectile(
                this,
                this.player.x,
                this.player.y,
                nearestEnemy.x,
                nearestEnemy.y,
                rarity
            );
        }

        // Set cooldown
        this.combatCooldown = this.combatCooldownMax;

        // Visual feedback (mobile only)
        if (this.combatText) {
            this.tweens.add({
                targets: this.combatText,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 100,
                yoyo: true,
                ease: 'Back.easeOut'
            });
        }

        console.log(`[GameScene] Fired ${rarity} projectile`);
    }

    findNearestEnemy() {
        if (!this.enemies || !this.player) return null;

        const activeEnemies = this.enemies.getChildren().filter(e => e.active);
        if (activeEnemies.length === 0) return null;

        let nearest = null;
        let nearestDist = Infinity;

        activeEnemies.forEach(enemy => {
            const dist = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                enemy.x,
                enemy.y
            );

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        });

        return nearest;
    }

    updateCombatCooldown(delta) {
        if (this.combatCooldown > 0) {
            this.combatCooldown -= delta;

            if (this.combatCooldown <= 0) {
                this.combatCooldown = 0;
                // Only update UI if it exists (mobile only)
                if (this.combatCooldownText) {
                    this.combatCooldownText.setVisible(false);
                }
            } else {
                // Show cooldown timer (mobile only)
                if (this.combatCooldownText) {
                    const seconds = (this.combatCooldown / 1000).toFixed(1);
                    this.combatCooldownText.setText(`${seconds}s`);
                    this.combatCooldownText.setVisible(true);
                }
            }
        }
    }

    createResetButton() {
        // Reset button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0xFF4444, 0.9);
        buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        buttonBg.setScrollFactor(0); // Keep fixed on screen

        // Reset button text
        const resetText = this.add.text(56, 31, '🔄 RESET', {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        resetText.setScrollFactor(0); // Keep fixed on screen

        // Make button interactive
        const resetButton = this.add.zone(16, 16, 80, 30)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });
        resetButton.setScrollFactor(0); // Keep fixed on screen

        resetButton.on('pointerdown', () => {
            this.resetGameData();
        });

        resetButton.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF6666, 0.9);
            buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        });

        resetButton.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFF4444, 0.9);
            buttonBg.fillRoundedRect(16, 16, 80, 30, 6);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(16, 16, 80, 30, 6);
        });
    }

    resetGameData() {
        // Clear all game data and reload
        localStorage.removeItem('mythical-creature-save');
        console.log('🔄 Game data reset from game scene');
        window.location.reload();
    }

    createCarePanel() {
        // Care panel background (hidden initially)
        this.carePanelBg = this.add.graphics();
        this.carePanelBg.fillStyle(0x000000, 0.8);
        this.carePanelBg.fillRoundedRect(50, 50, 300, 400, 10);
        this.carePanelBg.lineStyle(2, 0x4B0082);
        this.carePanelBg.strokeRoundedRect(50, 50, 300, 400, 10);
        this.carePanelBg.setScrollFactor(0);
        this.carePanelBg.setVisible(false);

        // Care panel title
        this.carePanelTitle = this.add.text(200, 70, 'Creature Care', {
            fontSize: '18px',
            color: '#FFD700',
            align: 'center'
        });
        this.carePanelTitle.setOrigin(0.5, 0);
        this.carePanelTitle.setScrollFactor(0);
        this.carePanelTitle.setVisible(false);

        // Care action buttons - DISABLED FOR MOBILE SIMPLICITY
        // this.createCareButtons();

        // Close button
        this.careCloseButton = this.add.text(330, 60, '✕', {
            fontSize: '20px',
            color: '#FF6347',
            padding: { x: 4, y: 4 }
        });
        this.careCloseButton.setScrollFactor(0);
        this.careCloseButton.setInteractive({ useHandCursor: true });
        this.careCloseButton.setData('tooltip', 'Close care panel');
        this.careCloseButton.setData('ariaLabel', 'Close care panel');
        
        // Add visual feedback on click
        this.careCloseButton.on('pointerdown', () => {
            this.toggleCarePanel();
            if (window.UXEnhancements) {
                window.UXEnhancements.announce('Care panel closed');
            }
        });
        
        // Add hover effect
        this.careCloseButton.on('pointerover', () => {
            this.careCloseButton.setScale(1.2);
        });
        
        this.careCloseButton.on('pointerout', () => {
            this.careCloseButton.setScale(1);
        });
        
        this.careCloseButton.setVisible(false);
    }

    createCareButtons() {
        // Initialize careButtons even if CareSystem is not available
        this.careButtons = {};
        
        if (!this.careSystem) {
            console.warn('CareSystem not available, skipping care buttons');
            return;
        }
        
        const careActions = this.careSystem.getAllCareActionsInfo();
        const buttonY = 100;

        Object.entries(careActions).forEach(([actionType, info], index) => {
            const y = buttonY + (index * 60);

            // Button background
            const buttonBg = this.add.graphics();
            buttonBg.fillStyle(info.canPerform ? 0x228B22 : 0x666666, 0.8);
            buttonBg.fillRoundedRect(70, y, 260, 50, 5);
            buttonBg.setScrollFactor(0);
            buttonBg.setVisible(false);

            // Button text
            const buttonText = this.add.text(200, y + 25, '', {
                fontSize: '14px',
                color: '#FFFFFF',
                align: 'center'
            });
            buttonText.setOrigin(0.5);
            buttonText.setScrollFactor(0);
            buttonText.setVisible(false);

            // Make button interactive
            buttonBg.setInteractive({ useHandCursor: true });
            buttonBg.setData('tooltip', info.description || `Perform ${info.name} action`);
            buttonBg.setData('ariaLabel', `${info.name} button`);
            
            buttonBg.on('pointerdown', () => {
                this.handleCareAction(actionType);
                // Add visual feedback
                buttonBg.setScale(0.95);
                this.time.delayedCall(100, () => buttonBg.setScale(1));
            });
            
            // Add hover effect
            buttonBg.on('pointerover', () => {
                buttonBg.setAlpha(0.9);
            });
            
            buttonBg.on('pointerout', () => {
                buttonBg.setAlpha(1);
            });

            this.careButtons[actionType] = {
                bg: buttonBg,
                text: buttonText,
                y: y
            };
        });

        this.updateCareButtons();
    }

    updateCareHint() {
        if (!this.careSystem) {
            this.careHintText.setText('Care system unavailable');
            return;
        }
        
        const careStatus = this.careSystem.getCareStatus();
        if (!careStatus) return;

        const happinessDesc = this.careSystem.getHappinessDescription(careStatus.happiness);
        const hintText = `TAB: Care Menu | F: Feed (${careStatus.dailyCare.feedCount}/3) | P: Play (${careStatus.dailyCare.playCount}/2) | R: Rest`;

        this.careHintText.setText(hintText);
    }

    checkAndUnlockAchievements() {
        if (!this.achievementSystem) {
            return;
        }
        
        const newUnlocks = this.achievementSystem.checkAchievements();

        newUnlocks.forEach(achievement => {
            this.showAchievementNotification(achievement);
            // Grant XP reward
            getGameState().updateCreature({ experience: achievement.reward });
        });
    }

    showAchievementNotification(achievement) {
        const notification = this.add.text(400, 150, '', {
            fontSize: '18px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 20, y: 12 }
        });
        notification.setOrigin(0.5);

        const message = `🏆 Achievement Unlocked!\n${achievement.icon} ${achievement.name}\n${achievement.description}\n+${achievement.reward} XP`;

        notification.setText(message);
        
        // Announce to screen reader
        if (window.UXEnhancements) {
            window.UXEnhancements.announce(`Achievement unlocked: ${achievement.name}. ${achievement.description}`, 'assertive');
        }

        // Animate notification
        this.tweens.add({
            targets: notification,
            scale: { from: 0.5, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Hold for 3 seconds, then fade out
                this.time.delayedCall(3000, () => {
                    this.tweens.add({
                        targets: notification,
                        alpha: 0,
                        scale: 0.8,
                        duration: 800,
                        onComplete: () => notification.destroy()
                    });
                });
            }
        });
    }

    getAchievementProgressText() {
        if (!this.achievementSystem) {
            return 'Achievements: N/A';
        }
        
        const progress = this.achievementSystem.getProgressPercentage();
        const unlocked = this.achievementSystem.getUnlockedAchievements().length;
        const total = Object.keys(this.achievementSystem.achievements).length;

        return `Achievements: ${unlocked}/${total} (${progress}%)`;
    }

    checkAndCompleteTutorials() {
        if (!this.tutorialSystem) {
            return;
        }
        
        const gameState = getGameState().get();
        const completedSteps = this.tutorialSystem.checkTutorials(gameState, this);

        completedSteps.forEach(step => {
            this.showTutorialCompletion(step);
        });
    }

    showTutorialHintIfNeeded() {
        if (!this.tutorialSystem) {
            return;
        }
        
        const gameState = getGameState().get();
        const nextTutorial = this.tutorialSystem.getNextTutorial(gameState, this);

        if (nextTutorial && !this.isShowingTutorial) {
            this.showTutorialHint(nextTutorial);
        }
    }

    showTutorialHint(tutorial) {
        this.isShowingTutorial = true;

        const hint = this.add.text(400, 100, tutorial.message, {
            fontSize: '16px',
            color: '#87CEEB',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 10 }
        });
        hint.setOrigin(0.5);
        hint.setScrollFactor(0);

        // Add title
        const title = this.add.text(400, 75, `💡 ${tutorial.title} Tutorial`, {
            fontSize: '14px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
        });
        title.setOrigin(0.5);
        title.setScrollFactor(0);

        // Animate in
        this.tweens.add({
            targets: [title, hint],
            alpha: { from: 0, to: 1 },
            y: { from: 50, to: '+=25' },
            duration: 600,
            ease: 'Back.easeOut'
        });

        // Remove after 6 seconds
        this.time.delayedCall(6000, () => {
            this.tweens.add({
                targets: [title, hint],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    title.destroy();
                    hint.destroy();
                    this.isShowingTutorial = false;
                }
            });
        });
    }

    showTutorialCompletion(tutorial) {
        const completion = this.add.text(400, 120, `✅ ${tutorial.title} Complete!`, {
            fontSize: '18px',
            color: '#90EE90',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        completion.setOrigin(0.5);
        completion.setScrollFactor(0);

        this.tweens.add({
            targets: completion,
            scale: { from: 0.8, to: 1.1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: completion,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => completion.destroy()
                    });
                });
            }
        });
    }

    getTutorialProgressText() {
        if (!this.tutorialSystem) {
            return 'Tutorial: N/A';
        }
        return this.tutorialSystem.getProgressText();
    }

    updateDailyBonusButton() {
        if (!this.careSystem || !this.dailyBonusButton) {
            return;
        }
        
        const dailyBonus = this.careSystem.getDailyLoginBonus();

        if (dailyBonus.available) {
            this.dailyBonusButton.setText(`🎁 Daily Bonus Available! (+${dailyBonus.rewards.xp} XP)`);
            this.dailyBonusButton.setBackgroundColor('rgba(255, 215, 0, 0.3)');
        } else if (dailyBonus.claimed) {
            this.dailyBonusButton.setText('✅ Bonus Claimed Today');
            this.dailyBonusButton.setBackgroundColor('rgba(0, 0, 0, 0.5)');
        } else {
            this.dailyBonusButton.setText('🎁 Next Bonus Tomorrow');
            this.dailyBonusButton.setBackgroundColor('rgba(0, 0, 0, 0.5)');
        }
    }

    updateCareButtons() {
        if (!this.careSystem || !this.careButtons) {
            return;
        }
        
        const careActions = this.careSystem.getAllCareActionsInfo();

        Object.entries(careActions).forEach(([actionType, info]) => {
            const button = this.careButtons[actionType];
            if (!button) return;

            const countText = info.isUnlimited ? '' : ` (${info.currentCount}/${info.limit})`;
            const statusText = info.canPerform ? 'Ready' : 'Cooldown';

            button.text.setText(`${info.icon} ${info.name}${countText} - ${statusText}`);

            // Update button color
            button.bg.clear();
            button.bg.fillStyle(info.canPerform ? 0x228B22 : 0x666666, 0.8);
            button.bg.fillRoundedRect(70, button.y, 260, 50, 5);
        });
    }

    claimDailyBonus() {
        if (!this.careSystem) {
            return;
        }
        
        const success = this.careSystem.claimDailyLoginBonus();
        if (success) {
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        }
    }

    async handleCareAction(actionType) {
        if (!this.careSystem) {
            return;
        }

        try {
            const geneticsContext = this.playerGenetics || getGameState().get('creature.genetics') || null;
            const result = await this.careSystem.performCareAction(actionType, geneticsContext);

            if (result && result.success) {
                // GameState emits careActionPerformed which updates UI and messaging
                return;
            } else {
                const reason = result && result.reason ? result.reason : 'Action not available';
                this.showCareActionMessage(actionType, 0, reason);
            }
        } catch (error) {
            console.error('[GameScene] Care action failed:', error);
            this.showCareActionMessage(actionType, 0, 'Action failed');
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

    showCareActionMessage(actionType, happinessBonus, error = null, result = null) {
        if (!this.careSystem) {
            return;
        }

        const actionInfo = this.careSystem.careActions[actionType];
        const actionLabel = actionInfo?.name || actionType.charAt(0).toUpperCase() + actionType.slice(1);
        const icon = actionInfo?.icon || '✨';
        const bonusSegment = happinessBonus > 0 ? ` +${happinessBonus} Happiness!` : '';
        const message = error
            ? `${icon} ${actionLabel} — ${error}`
            : `${icon} ${actionLabel}${bonusSegment}`;
        const color = error ? '#FF6347' : '#90EE90';

        const actionText = this.add.text(400, 120, message, {
            fontSize: '16px',
            color: color,
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 12, y: 6 }
        });
        actionText.setOrigin(0.5);
        actionText.setScrollFactor(0);

        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: actionText,
                alpha: 0,
                duration: 500,
                onComplete: () => actionText.destroy()
            });
        });
    }

    toggleCarePanel() {
        this.isCarePanelOpen = !this.isCarePanelOpen;

        // Toggle visibility of all care panel elements
        this.carePanelBg.setVisible(this.isCarePanelOpen);
        this.carePanelTitle.setVisible(this.isCarePanelOpen);
        this.careCloseButton.setVisible(this.isCarePanelOpen);

        // Only iterate over careButtons if they exist
        if (this.careButtons) {
            Object.values(this.careButtons).forEach(button => {
                button.bg.setVisible(this.isCarePanelOpen);
                button.text.setVisible(this.isCarePanelOpen);
            });
        }

        if (this.isCarePanelOpen) {
            this.updateCareButtons();
            // Announce to screen reader
            if (window.UXEnhancements) {
                window.UXEnhancements.announce('Care panel opened. Use Tab to navigate options.');
            }
        }
    }

    handleFlowerInteraction(player, flower) {
        // Show interaction hint when near flowers
        this.showInteractionHint('Press SPACE to smell the flower');

        // Store reference to current flower for space key interaction
        this.nearbyFlower = flower;
    }

    handleShopProximity(player, shop) {
        // Player is near shop
        console.log('[GameScene] ===== handleShopProximity CALLED =====');
        console.log('[GameScene] Player position:', player.x, player.y);
        console.log('[GameScene] Shop position:', shop.x, shop.y);

        this.nearShop = true;
        console.log('[GameScene] nearShop set to TRUE');

        // Show shop entry hint
        this.showInteractionHint('Press SPACE to enter the Cosmic Shop');
        console.log('[GameScene] Interaction hint shown');
    }

    enterShop() {
        console.log('[GameScene] Entering Cosmic Shop');

        // Play button click sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Start ShopScene
        this.scene.start('ShopScene');
    }

    openInventory() {
        console.log('[GameScene] Opening Inventory');

        // Play button click sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Start InventoryScene
        this.scene.start('InventoryScene');
    }

    showInteractionHint(message) {
        console.log('[GameScene] showInteractionHint called:', message);
        this.interactionText.setText(message);
        this.interactionText.setVisible(true);
        console.log('[GameScene] Interaction text visible:', this.interactionText.visible, 'depth:', this.interactionText.depth);

        // Hide the hint after 3 seconds
        this.time.delayedCall(3000, () => {
            this.interactionText.setVisible(false);
        });
    }

    hideInteractionHint() {
        this.interactionText.setVisible(false);
    }

    showCreatureCareMenu() {
        // Prevent multiple menus
        if (this.careMenuOpen) {
            this.hideCreatureCareMenu();
            return;
        }

        this.careMenuOpen = true;

        // Create semi-transparent background
        this.careMenuBg = this.add.graphics();
        this.careMenuBg.fillStyle(0x000000, 0.7);
        this.careMenuBg.fillRect(0, 0, 800, 600);
        this.careMenuBg.setScrollFactor(0);

        // Create care menu panel
        const panelX = 250;
        const panelY = 150;
        const panelW = 300;
        const panelH = 300;

        this.careMenuPanel = this.add.graphics();
        this.careMenuPanel.fillStyle(0x4B0082, 0.95);
        this.careMenuPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 15);
        this.careMenuPanel.lineStyle(4, 0xFFD700);
        this.careMenuPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 15);
        this.careMenuPanel.setScrollFactor(0);

        // Title
        this.careMenuTitle = this.add.text(400, 180, '💖 Care for Your Creature 💖', {
            fontSize: '20px',
            color: '#FFD700',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.careMenuTitle.setScrollFactor(0);

        // Get creature name
        const creatureName = getGameState().get('creature.name');
        this.creatureNameText = this.add.text(400, 210, `${creatureName} is happy to see you!`, {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5);
        this.creatureNameText.setScrollFactor(0);

        // Care buttons - DISABLED FOR MOBILE SIMPLICITY
        // this.createCareButtons();

        // Close button
        this.createCareMenuCloseButton();

        // Add to a group for easy cleanup
        this.careMenuGroup = [
            this.careMenuBg,
            this.careMenuPanel,
            this.careMenuTitle,
            this.creatureNameText
        ];
    }

    createCareButtons() {
        const buttonY = 250;
        const buttonSpacing = 60;
        const buttonWidth = 80;
        const buttonHeight = 40;

        // Feed button
        this.createCareButton(300, buttonY, buttonWidth, buttonHeight, '🍎 FEED', 'feed', 0x00AA00);
        
        // Play button  
        this.createCareButton(400, buttonY, buttonWidth, buttonHeight, '🎾 PLAY', 'play', 0x0080FF);
        
        // Rest button
        this.createCareButton(500, buttonY, buttonWidth, buttonHeight, '😴 REST', 'rest', 0xFF6600);

        // Pet button (new)
        this.createCareButton(350, buttonY + buttonSpacing, buttonWidth, buttonHeight, '🤗 PET', 'pet', 0xFF69B4);
        
        // Stats button
        this.createCareButton(450, buttonY + buttonSpacing, buttonWidth, buttonHeight, '📊 STATS', 'stats', 0x9370DB);
    }

    createCareButton(x, y, width, height, text, action, color) {
        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(color, 0.9);
        buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
        buttonBg.lineStyle(2, 0xFFFFFF);
        buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        buttonBg.setScrollFactor(0);

        // Button text
        const buttonText = this.add.text(x, y, text, {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        buttonText.setScrollFactor(0);

        // Interactive zone
        const buttonZone = this.add.zone(x, y, width, height)
            .setInteractive({ cursor: 'pointer' });
        buttonZone.setScrollFactor(0);

        buttonZone.on('pointerdown', () => {
            this.handleCareMenuAction(action);
        });

        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            const lighterColor = Phaser.Display.Color.GetColor32(
                Math.min(255, Phaser.Display.Color.GetRed(color) + 30),
                Math.min(255, Phaser.Display.Color.GetGreen(color) + 30),
                Math.min(255, Phaser.Display.Color.GetBlue(color) + 30),
                255
            );
            buttonBg.fillStyle(lighterColor, 0.9);
            buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(color, 0.9);
            buttonBg.fillRoundedRect(x - width/2, y - height/2, width, height, 8);
            buttonBg.lineStyle(2, 0xFFFFFF);
            buttonBg.strokeRoundedRect(x - width/2, y - height/2, width, height, 8);
        });

        // Add to group for cleanup (only if careMenuGroup exists)
        if (this.careMenuGroup) {
            this.careMenuGroup.push(buttonBg, buttonText, buttonZone);
        }
    }

    createCareMenuCloseButton() {
        const closeX = 520;
        const closeY = 170;

        const closeBg = this.add.graphics();
        closeBg.fillStyle(0xFF4444, 0.9);
        closeBg.fillRoundedRect(closeX - 15, closeY - 15, 30, 30, 5);
        closeBg.lineStyle(2, 0xFFFFFF);
        closeBg.strokeRoundedRect(closeX - 15, closeY - 15, 30, 30, 5);
        closeBg.setScrollFactor(0);

        const closeText = this.add.text(closeX, closeY, '✕', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        closeText.setScrollFactor(0);

        const closeZone = this.add.zone(closeX, closeY, 30, 30)
            .setInteractive({ cursor: 'pointer' });
        closeZone.setScrollFactor(0);

        closeZone.on('pointerdown', () => {
            this.hideCreatureCareMenu();
        });

        if (this.careMenuGroup) {
            this.careMenuGroup.push(closeBg, closeText, closeZone);
        }
    }

    hideCreatureCareMenu() {
        if (!this.careMenuOpen) return;

        this.careMenuOpen = false;

        // Clean up all menu elements
        if (this.careMenuGroup) {
            this.careMenuGroup.forEach(element => {
                if (element && element.destroy) {
                    element.destroy();
                }
            });
            this.careMenuGroup = [];
        }
    }

    async handleCareMenuAction(action) {
        const creature = getGameState().get('creature');
        let message = '';
        let effect = null;
        const geneticsContext = this.playerGenetics || getGameState().get('creature.genetics') || null;

        switch (action) {
            case 'feed':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    try {
                        const result = await this.careSystem.performCareAction('feed', geneticsContext);
                        if (result && result.success) {
                            message = `🍎 Fed ${creature.name}! +${result.happinessBonus} Happiness`;
                            this.updateCareButtons();
                            this.updateCareHint();
                        } else {
                            message = result?.reason || 'Feed action not available';
                        }
                    } catch (error) {
                        console.error('[GameScene] Feed action failed:', error);
                        message = 'Feed action failed';
                    }
                } else {
                    getGameState().updateCreature({ experience: 10 });
                    message = `🍎 Fed ${creature.name}! +10 XP`;
                }
                effect = 0x00FF00; // Green
                break;
            case 'play':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    try {
                        const result = await this.careSystem.performCareAction('play', geneticsContext);
                        if (result && result.success) {
                            message = `🎾 Played with ${creature.name}! +${result.happinessBonus} Happiness`;
                            this.updateCareButtons();
                            this.updateCareHint();
                        } else {
                            message = result?.reason || 'Play action not available';
                        }
                    } catch (error) {
                        console.error('[GameScene] Play action failed:', error);
                        message = 'Play action failed';
                    }
                } else {
                    getGameState().updateCreature({ experience: 15 });
                    message = `🎾 Played with ${creature.name}! +15 XP`;
                }
                effect = 0x0080FF; // Blue
                break;
            case 'rest':
                if (this.careSystem && typeof this.careSystem.performCareAction === 'function') {
                    try {
                        const result = await this.careSystem.performCareAction('rest', geneticsContext);
                        if (result && result.success) {
                            message = `😴 ${creature.name} rested! +${result.happinessBonus} Happiness`;
                            this.updateCareButtons();
                            this.updateCareHint();
                        } else {
                            message = result?.reason || 'Rest action not available';
                        }
                    } catch (error) {
                        console.error('[GameScene] Rest action failed:', error);
                        message = 'Rest action failed';
                    }
                } else {
                    getGameState().updateCreature({ experience: 5 });
                    message = `😴 ${creature.name} rested! +5 XP`;
                }
                effect = 0xFF6600; // Orange
                break;
            case 'pet':
                getGameState().updateCreature({ experience: 8 });
                message = `🤗 Petted ${creature.name}! +8 XP`;
                effect = 0xFF69B4; // Pink
                break;
            case 'clean':
                getGameState().updateCreature({ experience: 6 });
                message = `🫧 Cleaned ${creature.name}! +6 XP`;
                effect = 0x00CED1; // Dark turquoise
                break;
            case 'stats':
                const stats = getGameState().get('creature.stats');
                const level = getGameState().get('creature.level');
                const exp = getGameState().get('creature.experience');
                message = `📊 ${creature.name} - Level ${level} | HP:${stats.health} Happiness:${stats.happiness} Energy:${stats.energy} | XP:${exp}`;
                effect = 0x9370DB; // Purple
                break;
            default:
                message = `✨ ${creature.name} feels cared for!`;
                effect = 0xFFD700;
                break;
        }

        // Show care effect
        this.showCareEffect(message, effect);
        
        // Update stats display
        this.updateStatsDisplay();

        // Close menu after action
        this.time.delayedCall(1500, () => {
            this.hideCreatureCareMenu();
        });
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
            }
        }

        // Handle C key for chat toggle
        if (Phaser.Input.Keyboard.JustDown(this.chatKey)) {
            this.toggleChat();
        }

        // Handle care keys (only if care system is available)
        if (this.careSystem) {
            if (Phaser.Input.Keyboard.JustDown(this.feedKey)) {
                this.handleCareAction('feed');
            }
            if (Phaser.Input.Keyboard.JustDown(this.playKey)) {
                this.handleCareAction('play');
            }
            if (Phaser.Input.Keyboard.JustDown(this.restKey)) {
                this.handleCareAction('rest');
            }
            if (Phaser.Input.Keyboard.JustDown(this.careKey)) {
                this.toggleCarePanel();
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

        // Check achievements periodically (every 5 seconds)
        if (this.time.now % 5000 < 100) {
            this.checkAndUnlockAchievements();
        }

        // Check tutorials periodically (every 3 seconds)
        if (this.time.now % 3000 < 100) {
            this.checkAndCompleteTutorials();
        }

        // Show tutorial hint if there's an active tutorial
        if (this.time.now % 8000 < 100) {
            this.showTutorialHintIfNeeded();
        }

        // Reset nearby flower when moving away
        if (!this.physics.overlap(this.player, this.flowers)) {
            this.nearbyFlower = null;
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

        const displayText = [
            `${creature.name} - Level ${creature.level}`,
            `XP: ${creature.experience}/100`,
            `❤️ ${stats.health} 😊 ${stats.happiness} (${happinessDesc.level}) ⚡ ${stats.energy}`,
            `Care Streak: ${careStatus ? careStatus.careStreak : 0} days`,
            `${achievementProgress}`,
            `${tutorialProgress}`,
            `Flowers: ${getGameState().get('world.discoveredObjects.flowers')}`
        ].join('\n');

        this.statsText.setText(displayText);
    }

    setupGameStateListeners() {
        // Listen for level up events
        getGameState().on('levelUp', (data) => {
            // Show level up message
            const levelUpText = this.add.text(400, 200,
                `🎉 Level Up!\nLevel ${data.oldLevel} → ${data.newLevel}`, {
                fontSize: '24px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 16, y: 8 }
            });
            levelUpText.setOrigin(0.5);
            levelUpText.setScrollFactor(0);

            // Animate and remove after 3 seconds
            this.tweens.add({
                targets: levelUpText,
                scale: { from: 0.8, to: 1.2 },
                alpha: { from: 0, to: 1 },
                duration: 500,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.time.delayedCall(2500, () => {
                        this.tweens.add({
                            targets: levelUpText,
                            alpha: 0,
                            duration: 500,
                            onComplete: () => levelUpText.destroy()
                        });
                    });
                }
            });

            this.updateStatsDisplay();
            // Check achievements after level up
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for care action events
        getGameState().on('careActionPerformed', (data) => {
            this.showCareActionMessage(data.action, data.happinessBonus);
            this.updateCareButtons();
            this.updateCareHint();
            this.updateStatsDisplay();
            // Check achievements after care actions
            this.time.delayedCall(500, () => this.checkAndUnlockAchievements());
        });

        // Listen for daily bonus events
        getGameState().on('dailyBonusClaimed', (data) => {
            this.showBonusClaimedMessage();
            this.updateDailyBonusButton();
        });

        // Listen for state changes to update UI
        getGameState().on('stateChanged', (data) => {
            if (data.path.startsWith('creature.stats') ||
                data.path.startsWith('creature.care') ||
                data.path.startsWith('world.discoveredObjects') ||
                data.path.startsWith('dailyBonus')) {
                this.updateStatsDisplay();
                this.updateCareHint();
                this.updateDailyBonusButton();
                if (this.isCarePanelOpen) {
                    this.updateCareButtons();
                }
            }
        });
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
        this.events.on('kid_mode_action', (action) => {
            this.handleKidModeAction(action);
        });

        // Update HUD when stats change
        getGameState().on('stateChanged', (data) => {
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
                this.handleCareMenuAction('feed');
                break;
            case 'play':
                this.handleCareMenuAction('play');
                break;
            case 'rest':
                this.handleCareMenuAction('rest');
                break;
            case 'pet':
                this.handleCareMenuAction('pet');
                break;
            case 'clean':
                this.handleCareMenuAction('clean');
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
     * Toggle chat interface
     */
    toggleChat() {
        console.log('Chat toggle - feature coming soon!');
        // TODO: Implement chat UI when needed
    }
}

export default GameScene;

if (typeof window !== 'undefined') {
    window.GameScene = GameScene;
}
