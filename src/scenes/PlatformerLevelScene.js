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
        this.playerSpeed = 180;         // Reduced from 250 for less sensitive movement
        this.jumpVelocity = -420;
        this.playerAcceleration = 0.15; // Smooth acceleration factor
        this.playerDeceleration = 0.75; // Slower deceleration for precise control

        // State
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.collectibles = null;
        this.isGrounded = false;
        this.canJump = true;
        this.jumpCooldown = 100; // ms between jumps
        this.isDucking = false;  // Crouch/duck state
        this.normalBodyHeight = 55; // Normal collision height
        this.duckBodyHeight = 30;   // Ducking collision height

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
        this.rangedKey = null;  // M key for ranged attack
        this.duckKey = null;    // Down arrow/S for ducking

        // Graphics
        this.graphicsEngine = null;
        this.platformBuilder = null;

        // UI
        this.hud = null;

        // Mobile controls for platformer
        this.mobileControls = null;
        this.isMobile = false;
        this.virtualJoystickX = 0;  // -1 to 1 from virtual joystick
        this.virtualJumpPressed = false;
        this.mobileControlElements = []; // Track all mobile UI elements for cleanup

        // Pause menu state
        this.pauseMenuActive = false;
        this.pauseMenuElements = [];
        this.pauseEscHandler = null;
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
        this.isDucking = false;

        // Reset mobile control state
        this.virtualJoystickX = 0;
        this.virtualJumpPressed = false;

        // Reset pause menu state
        this.pauseMenuActive = false;
        this.pauseMenuElements = [];
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }

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

        // Detect if mobile for camera offset adjustment
        const isMobileDevice = this.detectMobile();

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

        // Camera follow offset - on mobile, push player UP on screen to leave room
        // for controls at the bottom (controls take ~200px, offset compensates)
        // Positive Y offset = camera looks lower = player appears HIGHER on screen
        let followOffsetY;
        if (isMobileDevice) {
            // Mobile: significant offset to keep player in upper 60% of screen
            // This leaves the bottom 40% for controls without obscuring gameplay
            followOffsetY = screenHeight * 0.25;
            console.log(`[PlatformerLevel] Mobile detected - applying camera offset for controls`);
        } else {
            // Desktop: slight offset for better ground visibility
            followOffsetY = screenHeight * 0.1;
        }
        camera.setFollowOffset(0, followOffsetY);

        // Zoom for better view
        camera.setZoom(1.0);

        console.log(`[PlatformerLevel] Camera set up: ${this.levelWidth}x${boundsHeight}, screen: ${camera.width}x${screenHeight}, offsetY: ${followOffsetY}`);
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

        // Attack key (X) - melee attack
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackKey.on('down', () => this.performAttack());

        // Special attack key (Z) - AoE attack
        this.specialKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.specialKey.on('down', () => this.performSpecialAttack());

        // Ranged attack key (M) - projectile attack
        this.rangedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.rangedKey.on('down', () => this.performRangedAttack());

        // ESC to pause/return
        this.input.keyboard.on('keydown-ESC', () => this.showPauseMenu());

        console.log('[PlatformerLevel] Input set up: Arrows/WASD, Space=Jump, X=Melee, Z=Special, M=Ranged, Down=Duck');

        // Set up mobile controls for touch devices
        this.setupPlatformerMobileControls();
    }

    /**
     * Detect if device is mobile/touch-capable
     */
    detectMobile() {
        const hasOnTouchStart = 'ontouchstart' in window;
        const hasTouchPoints = navigator.maxTouchPoints > 0;
        const isTouchPrimary = window.matchMedia?.('(pointer: coarse)')?.matches;
        const isHoverNone = window.matchMedia?.('(hover: none)')?.matches;
        const userAgent = navigator.userAgent || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(userAgent);

        return (hasOnTouchStart || hasTouchPoints) && (isTouchPrimary || isMobileUA || isHoverNone);
    }

    /**
     * Get safe area insets for devices with notches/home indicators
     */
    getSafeAreaInsets() {
        const computedStyle = getComputedStyle(document.documentElement);
        return {
            top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
            bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10) || 20,
            left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10),
            right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10)
        };
    }

    /**
     * Set up platformer-specific mobile controls
     * Layout:
     *   [Special Z]    [Attack X]     <- Top row (secondary attacks)
     *   [Jump]         [Attack]       <- Bottom row (primary actions)
     *   [Joystick]                    <- Movement
     */
    setupPlatformerMobileControls() {
        this.isMobile = this.detectMobile();

        if (!this.isMobile) {
            console.log('[PlatformerLevel] Not mobile device, skipping mobile controls');
            return;
        }

        console.log('[PlatformerLevel] Setting up platformer mobile controls');

        const { width, height } = this.scale;
        const safeArea = this.getSafeAreaInsets();

        // Layout configuration
        const buttonSize = 70;
        const primarySize = 80;
        const spacing = 15;
        const marginBottom = Math.max(20, safeArea.bottom);
        const marginRight = Math.max(15, safeArea.right);
        const marginLeft = Math.max(15, safeArea.left);

        // ============ JOYSTICK (bottom-left) ============
        const joystickX = marginLeft + 70;
        const joystickY = height - marginBottom - 80;
        const joystickBaseRadius = 55;
        const joystickThumbRadius = 25;

        // Joystick base
        const joystickBase = this.add.graphics();
        joystickBase.setScrollFactor(0);
        joystickBase.setDepth(10000);
        joystickBase.fillStyle(0x000000, 0.4);
        joystickBase.fillCircle(joystickX, joystickY, joystickBaseRadius);
        joystickBase.lineStyle(3, 0xFFFFFF, 0.5);
        joystickBase.strokeCircle(joystickX, joystickY, joystickBaseRadius);
        this.mobileControlElements.push(joystickBase);

        // Joystick thumb
        const joystickThumb = this.add.graphics();
        joystickThumb.setScrollFactor(0);
        joystickThumb.setDepth(10001);
        joystickThumb.fillStyle(0xFFFFFF, 0.8);
        joystickThumb.fillCircle(joystickX, joystickY, joystickThumbRadius);
        joystickThumb.lineStyle(2, 0x00CED1, 1);
        joystickThumb.strokeCircle(joystickX, joystickY, joystickThumbRadius);
        this.mobileControlElements.push(joystickThumb);

        // Store joystick state
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;
        this.joystickMaxDistance = 45;
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickThumb = joystickThumb;
        this.joystickThumbRadius = joystickThumbRadius;

        // Joystick touch zone (larger for easier use)
        const joystickZone = this.add.zone(joystickX, joystickY, joystickBaseRadius * 4, joystickBaseRadius * 4)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ draggable: true });
        this.mobileControlElements.push(joystickZone);

        joystickZone.on('pointerdown', (pointer) => {
            this.joystickActive = true;
            this.joystickPointerId = pointer.id;
        });

        joystickZone.on('pointermove', (pointer) => {
            if (!this.joystickActive) return;
            this.updateJoystick(pointer);
        });

        joystickZone.on('pointerup', (pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.resetJoystick();
            }
        });

        // Scene-level pointer tracking for joystick
        this.input.on('pointermove', (pointer) => {
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.updateJoystick(pointer);
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.resetJoystick();
            }
        });

        // Native touch end handler for reliability
        this.game.canvas.addEventListener('touchend', () => {
            if (this.joystickActive) {
                this.resetJoystick();
            }
        }, { passive: true });

        // ============ ACTION BUTTONS (right side) ============
        const rightColX = width - marginRight - primarySize / 2;
        const leftColX = rightColX - primarySize - spacing;
        const bottomRowY = height - marginBottom - primarySize / 2;
        const topRowY = bottomRowY - primarySize - spacing;

        // Button configs for platformer
        const buttons = [
            {
                id: 'special',
                label: '⚡',
                x: leftColX,
                y: topRowY,
                size: buttonSize,
                color: 0x9B59B6, // Purple - special
                action: () => this.performSpecialAttack()
            },
            {
                id: 'attack2',
                label: '🗡️',
                x: rightColX,
                y: topRowY,
                size: buttonSize,
                color: 0xE67E22, // Orange - secondary attack
                action: () => this.performAttack()
            },
            {
                id: 'jump',
                label: '⬆️',
                x: leftColX,
                y: bottomRowY,
                size: primarySize,
                color: 0x27AE60, // Green - jump
                action: () => { this.virtualJumpPressed = true; },
                onRelease: () => { this.virtualJumpPressed = false; }
            },
            {
                id: 'attack',
                label: '⚔️',
                x: rightColX,
                y: bottomRowY,
                size: primarySize,
                color: 0xE74C3C, // Red - attack
                action: () => this.performAttack()
            }
        ];

        // Create button container background
        const containerPadding = 12;
        const containerX = leftColX - buttonSize / 2 - containerPadding;
        const containerY = topRowY - buttonSize / 2 - containerPadding;
        const containerWidth = (rightColX - leftColX) + primarySize + containerPadding * 2;
        const containerHeight = (bottomRowY - topRowY) + primarySize + containerPadding * 2;

        const buttonContainer = this.add.graphics();
        buttonContainer.setScrollFactor(0);
        buttonContainer.setDepth(9999);
        buttonContainer.fillStyle(0x0D0D1A, 0.4);
        buttonContainer.fillRoundedRect(containerX, containerY, containerWidth, containerHeight, 16);
        buttonContainer.lineStyle(1, 0xFFFFFF, 0.15);
        buttonContainer.strokeRoundedRect(containerX, containerY, containerWidth, containerHeight, 16);
        this.mobileControlElements.push(buttonContainer);

        // Create each button
        buttons.forEach(config => {
            this.createPlatformerButton(config);
        });

        // ============ MENU BUTTON (top-left) ============
        this.createMenuButton(marginLeft + 30, Math.max(40, safeArea.top + 20));

        console.log('[PlatformerLevel] Mobile controls created: Joystick + 4 action buttons + menu');
    }

    /**
     * Create the menu/pause button for mobile
     */
    createMenuButton(x, y) {
        const size = 50;

        // Button background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);
        bg.fillStyle(0x0D0D1A, 0.7);
        bg.fillCircle(x, y, size / 2);
        bg.lineStyle(2, 0xFFFFFF, 0.4);
        bg.strokeCircle(x, y, size / 2);
        this.mobileControlElements.push(bg);

        // Hamburger icon (three lines)
        const icon = this.add.text(x, y, '☰', {
            fontSize: '28px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        this.mobileControlElements.push(icon);

        // Interactive zone
        const zone = this.add.zone(x, y, size + 20, size + 20)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });
        this.mobileControlElements.push(zone);

        zone.on('pointerdown', () => {
            bg.clear();
            bg.fillStyle(0x4B0082, 0.8);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(2, 0xE066FF, 0.8);
            bg.strokeCircle(x, y, size / 2);

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            this.showPauseMenu();
        });

        zone.on('pointerup', () => {
            bg.clear();
            bg.fillStyle(0x0D0D1A, 0.7);
            bg.fillCircle(x, y, size / 2);
            bg.lineStyle(2, 0xFFFFFF, 0.4);
            bg.strokeCircle(x, y, size / 2);
        });
    }

    /**
     * Create a platformer action button
     */
    createPlatformerButton(config) {
        const { id, label, x, y, size, color, action, onRelease } = config;
        const radius = size / 2;

        // Button background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);
        this.drawPlatformerButton(bg, x, y, radius, color, false);
        this.mobileControlElements.push(bg);

        // Button icon
        const icon = this.add.text(x, y, label, {
            fontSize: `${size * 0.45}px`,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        this.mobileControlElements.push(icon);

        // Interactive zone
        const zone = this.add.zone(x, y, size + 10, size + 10)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });
        this.mobileControlElements.push(zone);

        zone.on('pointerdown', () => {
            this.drawPlatformerButton(bg, x, y, radius, color, true);
            this.tweens.add({
                targets: icon,
                scaleX: 0.85,
                scaleY: 0.85,
                duration: 60
            });

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            action();
        });

        zone.on('pointerup', () => {
            this.drawPlatformerButton(bg, x, y, radius, color, false);
            this.tweens.add({
                targets: icon,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
                ease: 'Back.easeOut'
            });

            if (onRelease) {
                onRelease();
            }
        });

        zone.on('pointerout', () => {
            this.drawPlatformerButton(bg, x, y, radius, color, false);
            icon.setScale(1);

            if (onRelease) {
                onRelease();
            }
        });
    }

    /**
     * Draw a platformer button with glass effect
     */
    drawPlatformerButton(graphics, x, y, radius, color, pressed) {
        graphics.clear();

        // Outer shadow
        graphics.fillStyle(0x000000, pressed ? 0.3 : 0.4);
        graphics.fillCircle(x + 2, y + 2, radius);

        // Main button
        graphics.fillStyle(color, pressed ? 0.9 : 0.7);
        graphics.fillCircle(x, y, radius);

        // Inner highlight
        graphics.fillStyle(0xFFFFFF, pressed ? 0.1 : 0.2);
        graphics.fillCircle(x, y - radius * 0.2, radius * 0.7);

        // Border
        graphics.lineStyle(2, 0xFFFFFF, pressed ? 0.3 : 0.5);
        graphics.strokeCircle(x, y, radius);
    }

    /**
     * Update joystick thumb position and calculate input
     */
    updateJoystick(pointer) {
        const offsetX = pointer.x - this.joystickCenterX;
        const offsetY = pointer.y - this.joystickCenterY;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        const angle = Math.atan2(offsetY, offsetX);

        const clampedDistance = Math.min(distance, this.joystickMaxDistance);
        const thumbX = this.joystickCenterX + Math.cos(angle) * clampedDistance;
        const thumbY = this.joystickCenterY + Math.sin(angle) * clampedDistance;

        // Update thumb visual
        this.joystickThumb.clear();
        this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
        this.joystickThumb.fillCircle(thumbX, thumbY, this.joystickThumbRadius);
        this.joystickThumb.lineStyle(2, 0x00CED1, 1);
        this.joystickThumb.strokeCircle(thumbX, thumbY, this.joystickThumbRadius);

        // Calculate normalized X input (-1 to 1) with dead zone
        const deadZone = this.joystickMaxDistance * 0.15;
        if (distance > deadZone) {
            const effectiveDistance = clampedDistance - deadZone;
            const effectiveMax = this.joystickMaxDistance - deadZone;
            const magnitude = effectiveDistance / effectiveMax;
            this.virtualJoystickX = Math.cos(angle) * magnitude;
        } else {
            this.virtualJoystickX = 0;
        }
    }

    /**
     * Reset joystick to center
     */
    resetJoystick() {
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.virtualJoystickX = 0;

        // Reset thumb to center
        if (this.joystickThumb) {
            this.joystickThumb.clear();
            this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
            this.joystickThumb.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 1);
            this.joystickThumb.strokeCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
        }
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

        // Handle ducking (must check before movement)
        this.handleDuck();

        // Handle movement (with smooth acceleration)
        this.handleMovement();

        // Handle jumping (only if not ducking)
        if (!this.isDucking) {
            this.handleJump();
        }

        // Update player facing direction
        this.updatePlayerFacing();
    }

    /**
     * Handle horizontal movement with smooth acceleration
     * More responsive but less twitchy than instant velocity
     * Supports both keyboard and virtual joystick input
     */
    handleMovement() {
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;

        // Check virtual joystick input (threshold for direction)
        const virtualLeft = this.virtualJoystickX < -0.2;
        const virtualRight = this.virtualJoystickX > 0.2;

        // Reduce speed while ducking
        const currentMaxSpeed = this.isDucking ? this.playerSpeed * 0.4 : this.playerSpeed;

        if (leftPressed || virtualLeft) {
            // For virtual input, scale speed by joystick magnitude
            const speedMultiplier = virtualLeft ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = -currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = false;
        } else if (rightPressed || virtualRight) {
            // For virtual input, scale speed by joystick magnitude
            const speedMultiplier = virtualRight ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = true;
        } else {
            // Smooth deceleration when no input
            this.player.setVelocityX(this.player.body.velocity.x * this.playerDeceleration);

            // Stop completely if very slow (prevents sliding)
            if (Math.abs(this.player.body.velocity.x) < 5) {
                this.player.setVelocityX(0);
            }
        }
    }

    /**
     * Handle duck/crouch mechanic
     * Down arrow or S key to duck - reduces hitbox and slows movement
     * Note: Only requires grounded to START ducking, stays ducked while key held
     */
    handleDuck() {
        const duckPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;

        if (duckPressed) {
            // Can only START ducking while grounded, but STAY ducked while key held
            if (!this.isDucking && this.isGrounded) {
                this.isDucking = true;

                // Shrink hitbox (lower height, keeping feet planted)
                this.player.body.setSize(40, this.duckBodyHeight);
                this.player.body.setOffset(10, 15 + (this.normalBodyHeight - this.duckBodyHeight));

                // Visual squash for duck
                this.player.setScale(1, 0.6);

                // Play duck sound
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }
            }
            // If already ducking, stay ducked (don't check grounded again)
        } else {
            // Only stand up when key is released
            if (this.isDucking) {
                this.isDucking = false;

                // Restore normal hitbox
                this.player.body.setSize(40, this.normalBodyHeight);
                this.player.body.setOffset(10, 15);

                // Restore normal scale
                this.player.setScale(1, 1);
            }
        }
    }

    /**
     * Handle jump input
     * Supports both keyboard and virtual jump button
     */
    handleJump() {
        const jumpPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown ||
                           this.virtualJumpPressed;  // Mobile virtual jump button

        if (jumpPressed && this.isGrounded && this.canJump) {
            this.player.setVelocityY(this.jumpVelocity);
            this.canJump = false;
            this.isGrounded = false;

            // Reset virtual jump to prevent continuous jumping
            this.virtualJumpPressed = false;

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
     * Perform basic melee attack - override in subclass for creature-specific attacks
     * Checks both regular enemies AND boss (if present)
     */
    performAttack() {
        console.log('[PlatformerLevel] Melee attack performed');

        // Create basic attack effect
        const attackX = this.player.facingRight ?
                        this.player.x + 50 :
                        this.player.x - 50;

        // Visual effect - melee slash
        const attackEffect = this.add.graphics();
        attackEffect.fillStyle(0x7B68EE, 0.8);
        attackEffect.fillCircle(0, 0, 25);
        attackEffect.setPosition(attackX, this.player.y);
        attackEffect.setDepth(899);

        // Arc slash effect
        const slash = this.add.graphics();
        slash.lineStyle(4, 0xE040FB, 1);
        slash.beginPath();
        const startAngle = this.player.facingRight ? -Math.PI / 2 : Math.PI / 2;
        slash.arc(0, 0, 40, startAngle - 0.5, startAngle + 1, false);
        slash.strokePath();
        slash.setPosition(attackX, this.player.y);
        slash.setDepth(899);

        // Animate and destroy
        this.tweens.add({
            targets: [attackEffect, slash],
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                attackEffect.destroy();
                slash.destroy();
            }
        });

        // Check enemy hits
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                const dist = Phaser.Math.Distance.Between(
                    attackX, this.player.y,
                    enemy.x, enemy.y
                );
                if (dist < 70) {
                    this.damageEnemy(enemy, 1);
                }
            });
        }

        // Check boss hit (if boss exists and is active)
        if (this.boss && this.boss.active) {
            const dist = Phaser.Math.Distance.Between(
                attackX, this.player.y,
                this.boss.x, this.boss.y
            );
            if (dist < 80) {
                // Call damageBoss if it exists (implemented in subclass)
                if (typeof this.damageBoss === 'function') {
                    this.damageBoss(1);
                    console.log('[PlatformerLevel] Boss hit by melee attack!');
                }
            }
        }

        // Play attack sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Perform ranged attack (M key) - fires a projectile
     * Uses 1 crystal energy per shot
     */
    performRangedAttack() {
        if (this.crystalEnergy < 1) {
            console.log('[PlatformerLevel] Not enough crystal energy for ranged attack');
            if (window.AudioManager) {
                window.AudioManager.playError();
            }
            return;
        }

        console.log('[PlatformerLevel] Ranged attack performed');

        // Use energy
        this.crystalEnergy -= 1;
        this.updateEnergyDisplay();

        // Create projectile
        const startX = this.player.x;
        const startY = this.player.y - 10;
        const direction = this.player.facingRight ? 1 : -1;

        // Projectile visual (energy bolt)
        const projectile = this.add.graphics();
        projectile.fillStyle(0x00FFFF, 1);
        // Bolt shape
        projectile.fillTriangle(0, 5, 20, 0, 0, -5);
        projectile.fillStyle(0xFFFFFF, 0.8);
        projectile.fillCircle(5, 0, 4);
        projectile.setPosition(startX, startY);
        projectile.setDepth(898);
        projectile.setRotation(direction > 0 ? 0 : Math.PI);

        // Add physics body
        this.physics.add.existing(projectile);
        projectile.body.setAllowGravity(false);
        projectile.body.setSize(20, 10);
        projectile.body.setVelocityX(400 * direction);

        // Trail effect
        const trailInterval = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (!projectile.active) return;
                const trail = this.add.graphics();
                trail.fillStyle(0x00FFFF, 0.4);
                trail.fillCircle(0, 0, 5);
                trail.setPosition(projectile.x, projectile.y);
                trail.setDepth(897);
                this.tweens.add({
                    targets: trail,
                    alpha: 0,
                    scaleX: 0.3,
                    scaleY: 0.3,
                    duration: 150,
                    onComplete: () => trail.destroy()
                });
            },
            repeat: 15
        });

        // Check collisions with enemies
        if (this.enemies) {
            this.physics.add.overlap(projectile, this.enemies, (proj, enemy) => {
                this.damageEnemy(enemy, 1);
                this.createProjectileImpact(proj.x, proj.y);
                trailInterval.remove();
                proj.destroy();
            });
        }

        // Check collision with boss
        if (this.boss && this.boss.active) {
            this.physics.add.overlap(projectile, this.boss, (proj, boss) => {
                if (typeof this.damageBoss === 'function') {
                    this.damageBoss(1);
                    console.log('[PlatformerLevel] Boss hit by ranged attack!');
                }
                this.createProjectileImpact(proj.x, proj.y);
                trailInterval.remove();
                proj.destroy();
            });
        }

        // Destroy after time/distance
        this.time.delayedCall(1500, () => {
            if (projectile.active) {
                trailInterval.remove();
                projectile.destroy();
            }
        });

        // Play ranged attack sound (use a crystal-like sound)
        if (window.AudioManager) {
            window.AudioManager.playBossProjectile(); // Reuse this sound
        }
    }

    /**
     * Create impact effect when projectile hits
     */
    createProjectileImpact(x, y) {
        const impact = this.add.graphics();
        impact.fillStyle(0x00FFFF, 0.8);
        impact.fillCircle(0, 0, 10);
        impact.setPosition(x, y);
        impact.setDepth(898);

        this.tweens.add({
            targets: impact,
            scaleX: 2.5,
            scaleY: 2.5,
            alpha: 0,
            duration: 200,
            onComplete: () => impact.destroy()
        });

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 8,
                color: [0x00FFFF, 0x7B68EE],
                duration: 500
            });
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
     * Show pause menu with resume and exit options
     */
    showPauseMenu() {
        // Prevent multiple pause menus
        if (this.pauseMenuActive) return;
        this.pauseMenuActive = true;

        // Pause physics but keep rendering
        this.physics.pause();

        const { width, height } = this.cameras.main;
        this.pauseMenuElements = [];

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(5000);
        this.pauseMenuElements.push(overlay);

        // Panel
        const panelWidth = Math.min(350, width - 60);
        const panelHeight = 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1025, 0.98);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x9B30FF, 0.8);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(5001);
        this.pauseMenuElements.push(panel);

        // Title
        const title = this.add.text(width / 2, panelY + 40, '⏸️ PAUSED', {
            fontSize: '32px',
            color: '#E066FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
        this.pauseMenuElements.push(title);

        // Resume button
        const resumeBtn = this.add.text(width / 2, panelY + 110, '▶️  RESUME', {
            fontSize: '22px',
            color: '#00FF88',
            backgroundColor: '#1A3D1A',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002).setInteractive({ useHandCursor: true });
        this.pauseMenuElements.push(resumeBtn);

        resumeBtn.on('pointerover', () => resumeBtn.setColor('#88FF88').setScale(1.05));
        resumeBtn.on('pointerout', () => resumeBtn.setColor('#00FF88').setScale(1.0));
        resumeBtn.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.hidePauseMenu();
        });

        // Exit to Hub button
        const exitBtn = this.add.text(width / 2, panelY + 175, '🚪  EXIT TO HUB', {
            fontSize: '22px',
            color: '#FF6666',
            backgroundColor: '#3D1A1A',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002).setInteractive({ useHandCursor: true });
        this.pauseMenuElements.push(exitBtn);

        exitBtn.on('pointerover', () => exitBtn.setColor('#FF9999').setScale(1.05));
        exitBtn.on('pointerout', () => exitBtn.setColor('#FF6666').setScale(1.0));
        exitBtn.on('pointerdown', () => {
            if (window.AudioManager) window.AudioManager.playButtonClick();
            this.hidePauseMenu();
            this.returnToHub();
        });

        // Hint text
        const hint = this.add.text(width / 2, panelY + panelHeight - 30, 'Press ESC to resume', {
            fontSize: '12px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(5002);
        this.pauseMenuElements.push(hint);

        // ESC to resume while paused
        this.pauseEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.hidePauseMenu();
            }
        };
        window.addEventListener('keydown', this.pauseEscHandler);

        console.log('[PlatformerLevel] Pause menu shown');
    }

    /**
     * Hide the pause menu and resume game
     */
    hidePauseMenu() {
        if (!this.pauseMenuActive) return;

        // Remove ESC listener
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }

        // Destroy menu elements
        if (this.pauseMenuElements) {
            this.pauseMenuElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {}
            });
            this.pauseMenuElements = [];
        }

        this.pauseMenuActive = false;

        // Resume physics
        this.physics.resume();

        console.log('[PlatformerLevel] Game resumed');
    }

    /**
     * Return to hub world
     */
    returnToHub() {
        // Reset physics for hub (top-down)
        this.physics.world.gravity.y = 0;

        // Go to HubWorldScene
        this.scene.start('HubWorldScene');
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
            if (this.rangedKey) this.rangedKey.off('down');
        }

        // Clean up mobile controls
        if (this.mobileControlElements && this.mobileControlElements.length > 0) {
            this.mobileControlElements.forEach(element => {
                try {
                    element?.removeAllListeners?.();
                    element?.destroy?.();
                } catch (e) {
                    // Element may already be destroyed
                }
            });
            this.mobileControlElements = [];
        }

        // Reset mobile control state
        this.joystickActive = false;
        this.virtualJoystickX = 0;
        this.virtualJumpPressed = false;
        this.joystickThumb = null;

        // Clean up pause menu
        if (this.pauseEscHandler) {
            window.removeEventListener('keydown', this.pauseEscHandler);
            this.pauseEscHandler = null;
        }
        if (this.pauseMenuElements && this.pauseMenuElements.length > 0) {
            this.pauseMenuElements.forEach(el => {
                try {
                    el?.removeAllListeners?.();
                    el?.destroy?.();
                } catch (e) {}
            });
            this.pauseMenuElements = [];
        }
        this.pauseMenuActive = false;

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
