import Phaser from 'phaser';

/**
 * PlatformerLevelScene - Base class for side-scrolling platformer levels
 *
 * Provides core platformer mechanics:
 * - Gravity-based physics
 * - Jump mechanics with grounded detection
 * - Horizontal camera following
 * - Platform collision system
 * - Combat input handling
 *
 * Extend this class for specific levels (CrystalCavesLevel, etc.)
 */
class PlatformerLevelScene extends Phaser.Scene {
    constructor(config = {}) {
        super({ key: config.key || 'PlatformerLevel' });

        // Level configuration
        this.levelId = config.levelId || 'unknown';
        this.biomeId = config.biomeId || 'crystal_caves';
        this.levelWidth = config.levelWidth || 5000;
        this.levelHeight = config.levelHeight || 800;

        // Physics settings
        this.gravityY = 500;
        this.playerSpeed = 250;
        this.jumpVelocity = -420;

        // State
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.isGrounded = false;
        this.canJump = true;
        this.jumpCooldown = 100; // ms between jumps

        // Combat
        this.crystalEnergy = 5;
        this.maxCrystalEnergy = 5;
        this.health = 4;
        this.maxHealth = 4;
        this.isPlayerDead = false; // Debounce flag for death handling
        this.isRestarting = false; // Debounce flag for restart handling
        this.deathScreenElements = null; // Track death screen UI for cleanup

        // Input
        this.cursors = null;
        this.jumpKey = null;
        this.attackKey = null;
        this.specialKey = null;

        // Graphics
        this.graphicsEngine = null;
        this.platformBuilder = null;

        // UI
        this.hud = null;
    }

    init(data) {
        // Accept level data from scene transition
        if (data) {
            this.levelId = data.levelId || this.levelId;
            this.biomeId = data.biomeId || this.biomeId;
        }

        // CRITICAL: Reset ALL state on init (called on scene.restart())
        // The constructor only runs once when scene is first registered,
        // but init() runs every time the scene starts/restarts
        this.resetGameState();

        console.log(`[PlatformerLevel] Initializing level: ${this.levelId} (biome: ${this.biomeId})`);
    }

    /**
     * Reset all game state - called on init() for restart support
     */
    resetGameState() {
        // Reset combat state
        this.health = this.maxHealth || 4;
        this.crystalEnergy = this.maxCrystalEnergy || 5;

        // Reset flags
        this.isGrounded = false;
        this.canJump = true;
        this.isPlayerDead = false;
        this.isRestarting = false;

        // Clear references (will be recreated in create())
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.deathScreenElements = null;

        console.log('[PlatformerLevel] Game state reset for restart');
    }

    create() {
        console.log(`[PlatformerLevel] Creating level: ${this.levelId}`);

        // CRITICAL: Re-enable keyboard input (disabled on death, must be restored on restart)
        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = true;
        }

        // Show loading state
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Entering the caves...');
        }

        try {
            // 1. Set up platformer physics (gravity enabled)
            this.setupPlatformerPhysics();

            // 2. Set world bounds
            this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

            // 3. Create graphics engine
            if (window.GraphicsEngine) {
                this.graphicsEngine = new window.GraphicsEngine(this);
            }

            // 4. Create parallax background
            this.createBackground();

            // 5. Create platforms
            this.createPlatforms();

            // 6. Create player
            this.createPlayer();

            // 7. Set up camera
            this.setupCamera();

            // 8. Set up input
            this.setupInput();

            // 9. Create HUD
            this.createHUD();

            // 10. Create level-specific content (override in subclass)
            this.createLevelContent();

            // 11. Set up collisions
            this.setupCollisions();

            // Hide loading
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            console.log(`[PlatformerLevel] Level created successfully`);

        } catch (error) {
            console.error('[PlatformerLevel] Error creating level:', error);
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }
        }
    }

    /**
     * Set up platformer physics with gravity
     */
    setupPlatformerPhysics() {
        // Enable gravity for platformer mode
        this.physics.world.gravity.y = this.gravityY;

        console.log(`[PlatformerLevel] Physics: gravity.y = ${this.gravityY}`);
    }

    /**
     * Create parallax background layers
     */
    createBackground() {
        const screenHeight = this.cameras.main.height;
        const screenWidth = this.cameras.main.width;

        // Use ParallaxBiome for biome-themed background
        if (window.ParallaxBiome) {
            window.ParallaxBiome.initialize(this, this.biomeId);
            window.ParallaxBiome.createBiome();
        }

        // Add a base dark layer for the cave - cover full screen
        const bg = this.add.graphics();
        bg.fillStyle(0x050308, 1);
        // Fill extra area in case screen is larger than level
        const bgHeight = Math.max(this.levelHeight, screenHeight) + 200;
        bg.fillRect(0, 0, this.levelWidth, bgHeight);
        bg.setScrollFactor(0);
        bg.setDepth(-1000);

        // Add a ground fill layer that extends below visible platforms
        // This prevents seeing "below the world" on taller screens
        const groundFill = this.add.graphics();
        groundFill.fillStyle(0x0D0818, 1); // Darker ground color
        // Ground starts at levelHeight - 50 (top of ground platform), extends downward
        groundFill.fillRect(0, this.levelHeight - 50, this.levelWidth, 300);
        groundFill.setDepth(-500);
    }

    /**
     * Create platforms - override in subclass for level-specific layout
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // Default ground platform (full width)
        this.createPlatform(0, this.levelHeight - 50, this.levelWidth, 80, 'solid');

        // Starting platform area (safe zone)
        this.createPlatform(100, this.levelHeight - 200, 300, 30, 'solid');
        this.createPlatform(500, this.levelHeight - 300, 250, 30, 'solid');
        this.createPlatform(850, this.levelHeight - 200, 200, 30, 'solid');

        console.log(`[PlatformerLevel] Created ${this.platforms.getLength()} platforms`);
    }

    /**
     * Create a single platform with organic visuals
     */
    createPlatform(x, y, width, height, type = 'solid') {
        const textureKey = this.generatePlatformTexture(width, height, type);

        const platform = this.platforms.create(x + width / 2, y + height / 2, textureKey);
        platform.setImmovable(true);
        platform.body.setSize(width, height);
        platform.body.setOffset(-width / 2 + (platform.width / 2), -height / 2 + (platform.height / 2));
        platform.setDepth(y);
        platform.platformType = type;

        // One-way platforms allow jumping through from below
        if (type === 'one-way') {
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;
        }

        return platform;
    }

    /**
     * Generate organic platform texture (not sharp triangles)
     */
    generatePlatformTexture(width, height, type) {
        const textureKey = `platform_${width}_${height}_${type}_${this.biomeId}`;

        if (this.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.make.graphics({ add: false });

        // Color palette based on biome
        const colors = this.getPlatformColors();

        // Draw organic platform shape with rounded edges
        graphics.fillStyle(colors.base, 1);

        // Main body with rounded corners
        const cornerRadius = Math.min(15, height / 2);
        graphics.fillRoundedRect(0, 0, width, height, cornerRadius);

        // Top highlight (lighter edge)
        graphics.fillStyle(colors.highlight, 0.4);
        graphics.fillRoundedRect(2, 2, width - 4, height / 3, cornerRadius - 2);

        // Bottom shadow (darker edge)
        graphics.fillStyle(colors.shadow, 0.5);
        graphics.fillRoundedRect(2, height * 0.7, width - 4, height * 0.28, cornerRadius - 2);

        // Add rock texture variations
        for (let i = 0; i < Math.floor(width / 40); i++) {
            const rx = Phaser.Math.Between(10, width - 30);
            const ry = Phaser.Math.Between(5, height - 15);
            const rw = Phaser.Math.Between(15, 35);
            const rh = Phaser.Math.Between(8, 18);
            graphics.fillStyle(colors.texture, 0.3);
            graphics.fillRoundedRect(rx, ry, rw, rh, 5);
        }

        // Add crystal accents for cave theme
        if (this.biomeId === 'crystal_caves' && type === 'solid') {
            const crystalCount = Math.floor(width / 150);
            for (let i = 0; i < crystalCount; i++) {
                const cx = Phaser.Math.Between(20, width - 20);
                const cy = 0;
                this.drawCrystalAccent(graphics, cx, cy, colors.crystal);
            }
        }

        graphics.generateTexture(textureKey, width, height);
        graphics.destroy();

        return textureKey;
    }

    /**
     * Draw a small crystal accent on platform
     */
    drawCrystalAccent(graphics, x, y, color) {
        const size = Phaser.Math.Between(8, 15);

        // Crystal glow
        graphics.fillStyle(color, 0.3);
        graphics.fillCircle(x, y + size / 2, size);

        // Crystal shape (pointing up)
        graphics.fillStyle(color, 0.8);
        graphics.fillTriangle(
            x - size / 3, y + size,
            x + size / 3, y + size,
            x, y - size / 2
        );
    }

    /**
     * Get platform colors based on biome
     */
    getPlatformColors() {
        const palettes = {
            crystal_caves: {
                base: 0x1A1025,
                highlight: 0x2D1B3D,
                shadow: 0x0D0818,
                texture: 0x3D2B5D,
                crystal: 0x7B68EE
            },
            stellar_reef: {
                base: 0x1A237E,
                highlight: 0x283593,
                shadow: 0x0D1642,
                texture: 0x3949AB,
                crystal: 0x00BCD4
            },
            void_peaks: {
                base: 0x1A1A2E,
                highlight: 0x2F2F4F,
                shadow: 0x0D0D0D,
                texture: 0x483D8B,
                crystal: 0xFF4500
            },
            aurora_depths: {
                base: 0x0A192F,
                highlight: 0x1B4332,
                shadow: 0x051210,
                texture: 0x2D6A4F,
                crystal: 0x00FF7F
            }
        };

        return palettes[this.biomeId] || palettes.crystal_caves;
    }

    /**
     * Create the player creature
     */
    createPlayer() {
        const startX = 200;
        // Spawn player above the ground (ground is at levelHeight - 50, ground surface is ~levelHeight - 90)
        // Player body is ~55px tall, so spawn them so their feet are just above ground
        const groundSurfaceY = this.levelHeight - 90;
        const startY = groundSurfaceY - 30; // Player center 30px above ground surface

        // Generate creature texture using existing system
        let textureName = 'platformerCreature';

        if (this.graphicsEngine) {
            try {
                const textures = this.graphicsEngine.createCreatureAnimationFrames();
                if (textures && textures.length > 0) {
                    textureName = textures[0];
                }
            } catch (e) {
                console.warn('[PlatformerLevel] Using fallback creature texture');
                this.createFallbackCreatureTexture();
            }
        } else {
            this.createFallbackCreatureTexture();
        }

        // Create physics sprite
        this.player = this.physics.add.sprite(startX, startY, textureName);
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0.1);
        this.player.setDrag(100, 0);

        // Set body size for better collision
        this.player.body.setSize(40, 55);
        this.player.body.setOffset(10, 15);

        // Player properties - depth must be higher than platforms (which use Y position as depth)
        // Platforms at Y=750 (ground) have depth 750, so player needs depth > 800
        this.player.setDepth(900);
        this.player.facingRight = true;

        console.log(`[PlatformerLevel] Player created at (${startX}, ${startY})`);
    }

    /**
     * Create fallback creature texture
     */
    createFallbackCreatureTexture() {
        if (this.textures.exists('platformerCreature')) return;

        const graphics = this.make.graphics({ add: false });

        // Simple creature shape
        graphics.fillStyle(0x9370DB, 1);
        graphics.fillEllipse(30, 35, 50, 60);

        // Eyes
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(20, 25, 8);
        graphics.fillCircle(40, 25, 8);
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(22, 25, 4);
        graphics.fillCircle(42, 25, 4);

        graphics.generateTexture('platformerCreature', 60, 70);
        graphics.destroy();
    }

    /**
     * Set up horizontal camera following
     */
    setupCamera() {
        const camera = this.cameras.main;
        const screenHeight = camera.height;

        // Calculate camera bounds based on screen vs level height
        // If screen is taller than level, clamp camera so ground stays at bottom
        const effectiveLevelHeight = Math.max(this.levelHeight, screenHeight);

        // Calculate the vertical offset to ensure ground (at levelHeight - 50)
        // stays near the bottom of the screen, not floating in the middle
        const groundY = this.levelHeight - 50;
        const cameraBottomMargin = 50; // Small margin below ground

        // Set bounds: X is full level width, Y adjusted so camera can't go below ground
        // Top bound is 0, bottom bound ensures ground stays visible at screen bottom
        const boundsHeight = this.levelHeight + cameraBottomMargin;
        camera.setBounds(0, 0, this.levelWidth, boundsHeight);

        // Follow player with smooth easing
        camera.startFollow(this.player, true, 0.1, 0.1);

        // Set deadzone for smooth scrolling
        // Larger vertical deadzone so camera doesn't bounce on every small jump
        camera.setDeadzone(camera.width * 0.2, camera.height * 0.4);

        // Offset camera to prefer showing more above the player (ground is reference)
        // This helps keep ground visible when player is near it
        camera.setFollowOffset(0, screenHeight * 0.1);

        // Zoom for better view
        camera.setZoom(1.0);

        console.log(`[PlatformerLevel] Camera set up: ${this.levelWidth}x${boundsHeight}, screen: ${camera.width}x${screenHeight}`);
    }

    /**
     * Set up input controls
     */
    setupInput() {
        // Arrow keys / WASD
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D');

        // Jump key (Space or W or Up)
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Attack key (X)
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackKey.on('down', () => this.performAttack());

        // Special attack key (Z)
        this.specialKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.specialKey.on('down', () => this.performSpecialAttack());

        // ESC to pause/return
        this.input.keyboard.on('keydown-ESC', () => this.showPauseMenu());

        console.log('[PlatformerLevel] Input set up: Arrows/WASD, Space=Jump, X=Attack, Z=Special');
    }

    /**
     * Set up collision handlers
     */
    setupCollisions() {
        if (this.player && this.platforms) {
            this.physics.add.collider(this.player, this.platforms, this.onPlatformCollision, null, this);
        }

        // Enemies collision (to be set up in subclass)
        if (this.enemies) {
            this.physics.add.collider(this.player, this.enemies, this.onEnemyCollision, null, this);
            this.physics.add.collider(this.enemies, this.platforms);
        }
    }

    /**
     * Handle platform collision
     */
    onPlatformCollision(player, platform) {
        // Check if landing on top of platform
        if (player.body.touching.down) {
            this.isGrounded = true;
        }
    }

    /**
     * Handle enemy collision (override in subclass)
     */
    onEnemyCollision(player, enemy) {
        // Check if jumping on enemy (Mario-style)
        if (player.body.velocity.y > 0 && player.y < enemy.y - 20) {
            this.defeatEnemy(enemy);
            player.setVelocityY(this.jumpVelocity * 0.6); // Bounce
        } else {
            this.takeDamage(1);
        }
    }

    /**
     * Create HUD - override in subclass for themed HUD
     */
    createHUD() {
        // Health display (hearts)
        this.healthDisplay = this.add.container(20, 20);
        this.healthDisplay.setScrollFactor(0);
        this.healthDisplay.setDepth(1000);
        this.updateHealthDisplay();

        // Crystal energy display
        this.energyDisplay = this.add.container(20, 60);
        this.energyDisplay.setScrollFactor(0);
        this.energyDisplay.setDepth(1000);
        this.updateEnergyDisplay();
    }

    /**
     * Update health hearts display
     */
    updateHealthDisplay() {
        this.healthDisplay.removeAll(true);

        for (let i = 0; i < this.maxHealth; i++) {
            const heart = this.add.graphics();
            const filled = i < this.health;

            // Draw heart shape
            heart.fillStyle(filled ? 0xFF6B6B : 0x3D2B5D, 1);
            heart.fillCircle(8, 8, 8);
            heart.fillCircle(18, 8, 8);
            heart.fillTriangle(0, 10, 26, 10, 13, 26);

            heart.setPosition(i * 35, 0);
            this.healthDisplay.add(heart);
        }
    }

    /**
     * Update crystal energy display
     */
    updateEnergyDisplay() {
        this.energyDisplay.removeAll(true);

        for (let i = 0; i < this.maxCrystalEnergy; i++) {
            const crystal = this.add.graphics();
            const filled = i < this.crystalEnergy;

            // Draw crystal diamond shape
            crystal.fillStyle(filled ? 0x7B68EE : 0x3D2B5D, filled ? 1 : 0.5);
            crystal.fillTriangle(10, 0, 0, 12, 10, 24);
            crystal.fillTriangle(10, 0, 20, 12, 10, 24);

            // Glow effect for filled
            if (filled) {
                crystal.fillStyle(0x7B68EE, 0.3);
                crystal.fillCircle(10, 12, 12);
            }

            crystal.setPosition(i * 28, 0);
            this.energyDisplay.add(crystal);
        }
    }

    /**
     * Create level-specific content - override in subclass
     */
    createLevelContent() {
        // Override in subclass to add:
        // - Enemies
        // - Collectibles
        // - Secrets
        // - Boss arena
        console.log('[PlatformerLevel] createLevelContent - override in subclass');
    }

    /**
     * Main update loop
     */
    update(time, delta) {
        if (!this.player) return;

        // Check if grounded
        this.isGrounded = this.player.body.blocked.down || this.player.body.touching.down;

        // Handle movement
        this.handleMovement();

        // Handle jumping
        this.handleJump();

        // Update player facing direction
        this.updatePlayerFacing();
    }

    /**
     * Handle horizontal movement
     */
    handleMovement() {
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;

        if (leftPressed) {
            this.player.setVelocityX(-this.playerSpeed);
            this.player.facingRight = false;
        } else if (rightPressed) {
            this.player.setVelocityX(this.playerSpeed);
            this.player.facingRight = true;
        } else {
            // Decelerate when no input
            this.player.setVelocityX(this.player.body.velocity.x * 0.85);
        }
    }

    /**
     * Handle jump input
     */
    handleJump() {
        const jumpPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown;

        if (jumpPressed && this.isGrounded && this.canJump) {
            this.player.setVelocityY(this.jumpVelocity);
            this.canJump = false;
            this.isGrounded = false;

            // Play jump sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            // Jump cooldown
            this.time.delayedCall(this.jumpCooldown, () => {
                this.canJump = true;
            });
        }
    }

    /**
     * Update player sprite facing direction
     */
    updatePlayerFacing() {
        if (this.player.facingRight) {
            this.player.setFlipX(false);
        } else {
            this.player.setFlipX(true);
        }
    }

    /**
     * Perform basic attack - override in subclass for creature-specific attacks
     */
    performAttack() {
        console.log('[PlatformerLevel] Attack performed');

        // Create basic attack effect
        const attackX = this.player.facingRight ?
                        this.player.x + 50 :
                        this.player.x - 50;

        // Visual effect
        const attackEffect = this.add.graphics();
        attackEffect.fillStyle(0x7B68EE, 0.8);
        attackEffect.fillCircle(0, 0, 20);
        attackEffect.setPosition(attackX, this.player.y);
        attackEffect.setDepth(899); // Just below player depth (900)

        // Animate and destroy
        this.tweens.add({
            targets: attackEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => attackEffect.destroy()
        });

        // Check enemy hits
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    attackX, this.player.y,
                    enemy.x, enemy.y
                );
                if (dist < 60) {
                    this.damageEnemy(enemy, 1);
                }
            });
        }

        // Play attack sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Perform special attack (uses crystal energy)
     */
    performSpecialAttack() {
        if (this.crystalEnergy < 3) {
            console.log('[PlatformerLevel] Not enough crystal energy');
            return;
        }

        console.log('[PlatformerLevel] Special attack: Super Obliterate!');

        this.crystalEnergy -= 3;
        this.updateEnergyDisplay();

        // Screen shake
        this.cameras.main.shake(300, 0.02);

        // Massive area effect
        const blast = this.add.graphics();
        blast.fillStyle(0xE040FB, 0.6);
        blast.fillCircle(0, 0, 50);
        blast.setPosition(this.player.x, this.player.y);
        blast.setDepth(895); // Above platforms, below player

        // Expand blast
        this.tweens.add({
            targets: blast,
            scaleX: 4,
            scaleY: 4,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => blast.destroy()
        });

        // Damage all nearby enemies
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y,
                    enemy.x, enemy.y
                );
                if (dist < 300) {
                    this.defeatEnemy(enemy);
                }
            });
        }

        // Epic sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Damage an enemy
     */
    damageEnemy(enemy, damage) {
        if (!enemy.health) enemy.health = 2;
        enemy.health -= damage;

        // Flash red
        enemy.setTint(0xFF0000);
        this.time.delayedCall(100, () => {
            if (enemy.active) enemy.clearTint();
        });

        if (enemy.health <= 0) {
            this.defeatEnemy(enemy);
        }
    }

    /**
     * Defeat an enemy
     */
    defeatEnemy(enemy) {
        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, enemy.x, enemy.y, {
                count: 15,
                color: [0x7B68EE, 0xE040FB, 0x00FFFF],
                duration: 1000
            });
        }

        // Award crystal energy
        this.crystalEnergy = Math.min(this.crystalEnergy + 1, this.maxCrystalEnergy);
        this.updateEnergyDisplay();

        // Destroy enemy
        enemy.destroy();

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }
    }

    /**
     * Player takes damage
     */
    takeDamage(amount) {
        this.health -= amount;
        this.updateHealthDisplay();

        // Flash and knockback
        this.player.setTint(0xFF0000);
        this.time.delayedCall(200, () => {
            if (this.player) this.player.clearTint();
        });

        // Knockback
        const knockbackX = this.player.facingRight ? -200 : 200;
        this.player.setVelocity(knockbackX, -150);

        // Invincibility frames
        this.player.setAlpha(0.5);
        this.time.delayedCall(1000, () => {
            if (this.player) this.player.setAlpha(1);
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Check for death
        if (this.health <= 0) {
            this.onPlayerDeath();
        }
    }

    /**
     * Handle player death
     */
    onPlayerDeath() {
        // Prevent multiple death calls (debounce)
        if (this.isPlayerDead) {
            return;
        }
        this.isPlayerDead = true;

        console.log('[PlatformerLevel] Player died');

        // Disable input
        this.input.keyboard.enabled = false;

        // Death animation
        this.tweens.add({
            targets: this.player,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 1000,
            onComplete: () => {
                this.showDeathScreen();
            }
        });
    }

    /**
     * Show death/retry screen
     */
    showDeathScreen() {
        const { width, height } = this.cameras.main;

        // Store death screen elements for cleanup
        this.deathScreenElements = [];

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2000);
        this.deathScreenElements.push(overlay);

        // Death text
        const text = this.add.text(width / 2, height / 2 - 50, 'YOU FELL', {
            fontSize: '48px',
            color: '#FF6B6B',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
        this.deathScreenElements.push(text);

        // Retry button
        const retryBtn = this.add.text(width / 2, height / 2 + 50, '[ TRY AGAIN ]', {
            fontSize: '24px',
            color: '#7B68EE',
            backgroundColor: '#1A1025',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ cursor: 'pointer' });
        this.deathScreenElements.push(retryBtn);

        retryBtn.on('pointerover', () => retryBtn.setColor('#E040FB'));
        retryBtn.on('pointerout', () => retryBtn.setColor('#7B68EE'));
        retryBtn.on('pointerdown', () => {
            this.restartLevel();
        });

        // Return button
        const returnBtn = this.add.text(width / 2, height / 2 + 110, '[ RETURN TO SANCTUARY ]', {
            fontSize: '18px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive({ cursor: 'pointer' });
        this.deathScreenElements.push(returnBtn);

        returnBtn.on('pointerover', () => returnBtn.setColor('#FFFFFF'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#888888'));
        returnBtn.on('pointerdown', () => {
            this.returnToSanctuary();
        });
    }

    /**
     * Safely restart the level with proper cleanup
     */
    restartLevel() {
        console.log('[PlatformerLevel] Restarting level...');

        // Prevent double-click issues
        if (this.isRestarting) {
            return;
        }
        this.isRestarting = true;

        // Clean up death screen elements first
        if (this.deathScreenElements) {
            this.deathScreenElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {
                    // Element may already be destroyed
                }
            });
            this.deathScreenElements = null;
        }

        // Small delay to ensure cleanup completes before restart
        this.time.delayedCall(100, () => {
            this.scene.restart();
        });
    }

    /**
     * Show pause menu
     */
    showPauseMenu() {
        // Simple pause - can be expanded
        this.scene.pause();

        // TODO: Create proper pause overlay scene
        console.log('[PlatformerLevel] Game paused');
    }

    /**
     * Return to sanctuary (main hub)
     */
    returnToSanctuary() {
        // Reset physics for sanctuary (top-down)
        this.physics.world.gravity.y = 0;

        // Transition to GameScene
        this.scene.start('GameScene', { biome: 'nebula' });
    }

    /**
     * Clean up on shutdown
     */
    shutdown() {
        console.log('[PlatformerLevel] Shutting down - cleaning up resources');

        // Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-ESC');
            if (this.attackKey) this.attackKey.off('down');
            if (this.specialKey) this.specialKey.off('down');
        }

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Reset gravity
        if (this.physics && this.physics.world) {
            this.physics.world.gravity.y = 0;
        }

        // Clean up ParallaxBiome
        if (window.ParallaxBiome) {
            window.ParallaxBiome.cleanup();
        }

        // Clean up death screen elements if they exist
        if (this.deathScreenElements) {
            this.deathScreenElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {
                    // Element may already be destroyed
                }
            });
            this.deathScreenElements = null;
        }

        // Null references
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.graphicsEngine = null;
        this.isPlayerDead = false;
        this.isRestarting = false;

        console.log('[PlatformerLevel] Cleanup complete');
    }
}

// Export for module systems
export default PlatformerLevelScene;

// Also expose globally for Phaser scene registration
if (typeof window !== 'undefined') {
    window.PlatformerLevelScene = PlatformerLevelScene;
}
