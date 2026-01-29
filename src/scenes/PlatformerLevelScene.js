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
        this.isInvincible = false; // Invincibility frames after taking damage
        this.isRespawning = false; // Debounce flag for pit respawn
        this.invincibilityDuration = 1500; // 1.5 seconds of invincibility
        this.invincibilityTween = null; // Reference to flashing tween
        this.deathScreenElements = null; // Track death screen UI for cleanup

        // Checkpoint system
        this.lastSafePosition = null; // Last ground position for respawn
        this.checkpointPosition = null; // Explicit checkpoint if set

        // Movement feel enhancements
        this.coyoteTime = 100; // ms grace period to jump after leaving platform
        this.lastGroundedTime = 0; // Timestamp when last grounded
        this.jumpBufferTime = 100; // ms to buffer jump input before landing
        this.jumpBufferPressed = false; // Whether jump was pressed recently (for buffering)
        this.jumpBufferTimestamp = 0; // When jump buffer was activated
        this.wasGrounded = false; // Track previous grounded state for landing detection
        this.lastLandingY = 0; // Track Y position to calculate fall distance for dust

        // Crystal Shield power-up
        this.hasShield = false; // Whether player has active shield
        this.shieldTimeRemaining = 0; // Time left on shield
        this.shieldDuration = 15000; // 15 seconds of shield
        this.shieldAuraController = null; // FXLibrary shield aura controller

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
        this.actionButtonPointers = new Set(); // Track which pointers are on action buttons (prevents joystick reset)

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
        this.isInvincible = false;
        this.isRespawning = false;
        this.invincibilityTween = null;

        // Reset checkpoint data
        this.lastSafePosition = null;
        this.checkpointPosition = null;

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

        // Reset movement feel state
        this.lastGroundedTime = 0;
        this.jumpBufferPressed = false;
        this.jumpBufferTimestamp = 0;
        this.wasGrounded = false;
        this.lastLandingY = 0;

        // Reset Crystal Shield state
        this.hasShield = false;
        this.shieldTimeRemaining = 0;
        if (this.shieldAuraController) {
            this.shieldAuraController.destroy();
            this.shieldAuraController = null;
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
        // Ground platform starts at y = levelHeight - 50, with height 80
        // So ground TOP surface is at y = levelHeight - 50
        // Player body is ~55px tall, spawn player well above ground to ensure visibility
        const groundTopY = this.levelHeight - 50;
        const startY = groundTopY - 80; // Player center 80px above ground top (generous buffer)

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

        // Get actual texture dimensions for proper physics body sizing
        const textureWidth = this.player.width;
        const textureHeight = this.player.height;

        // MOBILE UX FIX: Physics body aligned to visual "feet" of creature
        // The body should be at the VERY bottom of the sprite so creature
        // visually sits ON TOP of platforms, not floating or embedded
        //
        // Body sizing: small hitbox for precise platforming
        const bodyWidth = Math.min(28, textureWidth * 0.35);  // Narrower for tighter platforming
        const bodyHeight = Math.min(40, textureHeight * 0.40); // Shorter body

        // CRITICAL: Creature textures have significant padding for visual effects
        // (cosmic auras, sparkles, etc). The actual creature visual is centered in the texture.
        // We need to offset the physics body to align with where the creature's FEET appear.
        //
        // For a 220x260 texture with 60x80 creature centered:
        // - The creature visual sits in the center
        // - We need physics body to align with the visual creature's feet
        // - Testing showed 90px was too much (creature below platform), trying ~55-60px
        const estimatedBottomPadding = Math.min(55, textureHeight * 0.22); // Reduced from 90px - creature was below platforms
        const offsetX = (textureWidth - bodyWidth) / 2;
        const offsetY = textureHeight - bodyHeight - estimatedBottomPadding;

        this.player.body.setSize(bodyWidth, bodyHeight);
        this.player.body.setOffset(offsetX, offsetY);

        // Anchor point adjustment for visual grounding
        // Default origin is 0.5, 0.5 (center). Keep this for proper flip behavior.

        // Player properties - depth must be higher than platforms (which use Y position as depth)
        // Platforms at Y=750 (ground) have depth 750, so player needs depth > 800
        this.player.setDepth(900);
        this.player.facingRight = true;

        console.log(`[PlatformerLevel] Player created at (${startX}, ${startY})`);
        console.log(`[PlatformerLevel] Texture size: ${textureWidth}x${textureHeight}, Body: ${bodyWidth}x${bodyHeight}, Offset: (${offsetX}, ${offsetY})`);
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
     * Set up horizontal camera following with directional lead
     * MOBILE UX ENHANCEMENT: Camera leads ahead of player movement direction
     */
    setupCamera() {
        const camera = this.cameras.main;
        const screenHeight = camera.height;
        const screenWidth = camera.width;

        // Detect if mobile for camera adjustments
        this.isMobileDevice = this.detectMobile();

        // Calculate camera bounds
        const boundsHeight = this.levelHeight + 50;
        camera.setBounds(0, 0, this.levelWidth, boundsHeight);

        // Follow player with smooth easing
        // Slower horizontal lerp for smoother directional lead
        camera.startFollow(this.player, true, 0.08, 0.1);

        // Set deadzone for smooth scrolling
        // Smaller horizontal deadzone to allow directional lead to work
        camera.setDeadzone(screenWidth * 0.1, screenHeight * 0.35);

        // MOBILE UX: Calculate vertical offset for control safe zone
        // Controls are overlaid at bottom of screen
        // NEGATIVE camera offset = camera ABOVE player = shows more BELOW = player appears HIGHER on screen
        if (this.isMobileDevice) {
            // Get actual safe area for this device (iPhone notch, home indicator, etc.)
            const safeArea = this.getSafeAreaInsets();

            // Mobile control zone is a fixed 120px + bottom safe area
            // This ensures controls don't overlap with home indicator
            this.mobileControlZoneHeight = 120 + safeArea.bottom;

            // NEGATIVE offset pushes gameplay UP (player appears higher on screen)
            // This leaves room for controls at bottom without obscuring gameplay
            // Use 15% of screen height as offset (not 45% which was way too much)
            this.cameraBaseOffsetY = -screenHeight * 0.12;

            console.log(`[PlatformerLevel] Mobile camera: controlZone=${this.mobileControlZoneHeight}px, offsetY=${this.cameraBaseOffsetY}px, safeBottom=${safeArea.bottom}px`);
        } else {
            this.mobileControlZoneHeight = 0;
            this.cameraBaseOffsetY = screenHeight * 0.05; // Slight offset for desktop
        }

        // DIRECTIONAL LEAD: Offset camera based on player facing
        // This shows more of the level AHEAD of the player
        this.cameraLeadAmount = this.isMobileDevice ? screenWidth * 0.15 : screenWidth * 0.1;
        this.currentCameraLeadX = 0;
        this.targetCameraLeadX = 0;

        // Initial camera offset
        camera.setFollowOffset(0, this.cameraBaseOffsetY);

        // Zoom out on mobile for better visibility of the level
        // More zoom out = see more of the level = easier to play
        if (this.isMobileDevice) {
            // Calculate appropriate zoom based on screen size
            const screenAspect = screenWidth / screenHeight;
            // Portrait mode needs more zoom out, landscape less
            const zoomFactor = screenAspect < 1 ? 0.75 : 0.85;
            camera.setZoom(zoomFactor);
            console.log(`[PlatformerLevel] Mobile zoom: ${zoomFactor} (aspect: ${screenAspect.toFixed(2)})`);
        } else {
            camera.setZoom(1.0);
        }

        console.log(`[PlatformerLevel] Camera: bounds ${this.levelWidth}x${boundsHeight}, lead=${this.cameraLeadAmount}px, zoom=${camera.zoom}`);
    }

    /**
     * Update camera directional lead based on player movement
     * Called from update() loop
     */
    updateCameraLead() {
        if (!this.player || !this.cameras.main) return;

        const camera = this.cameras.main;

        // Determine target lead based on facing direction
        // Positive X offset = camera looks RIGHT = shows more of RIGHT side
        // Negative X offset = camera looks LEFT = shows more of LEFT side
        this.targetCameraLeadX = this.player.facingRight ? -this.cameraLeadAmount : this.cameraLeadAmount;

        // Smooth interpolation toward target lead (slower = smoother transition)
        const lerpFactor = 0.03;
        this.currentCameraLeadX += (this.targetCameraLeadX - this.currentCameraLeadX) * lerpFactor;

        // Apply combined offset
        camera.setFollowOffset(this.currentCameraLeadX, this.cameraBaseOffsetY);
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
     * MOBILE UX REDESIGN: Controls at VERY BOTTOM, gameplay appears ABOVE
     *
     * Layout (at very bottom of screen):
     *   [Joystick]          [Special] [Ranged]
     *                       [Jump]    [Melee]
     *
     * Key improvements:
     * - Controls positioned at VERY BOTTOM of screen (85%+ from top)
     * - Camera offset pushes gameplay UP so it appears ABOVE controls
     * - Smaller, semi-transparent controls
     * - Horizontal joystick-only (no vertical needed for platformer)
     * - Ground level and creatures appear ABOVE the control zone
     */
    setupPlatformerMobileControls() {
        this.isMobile = this.detectMobile();

        if (!this.isMobile) {
            console.log('[PlatformerLevel] Not mobile device, skipping mobile controls');
            return;
        }

        console.log('[PlatformerLevel] Setting up BOTTOM-POSITIONED mobile controls');

        const { width, height } = this.scale;
        const safeArea = this.getSafeAreaInsets();

        // MOBILE UX: Controls positioned at the VERY BOTTOM of screen
        // This places them in the "underground" visual area below the playable ground
        // Only account for minimal safe area (home indicator on newer iPhones)
        const bottomSafeMargin = Math.max(8, safeArea.bottom); // Minimal margin - just above home indicator
        const sideSafeMargin = Math.max(10, Math.max(safeArea.left, safeArea.right));

        // Control zone: Expanded to 120px for larger touch targets (ergonomic for thumbs)
        // Stays at the very bottom of screen to not overlay gameplay
        const controlZoneHeight = 120;
        const controlZoneTop = height - bottomSafeMargin - controlZoneHeight;

        console.log(`[PlatformerLevel] Mobile controls: height=${height}, safeBottom=${safeArea.bottom}, controlZoneTop=${controlZoneTop}`);

        // Responsive button sizes - LARGER for better thumb reach
        const isSmallScreen = width < 400;
        const jumpButtonSize = isSmallScreen ? 80 : 100;    // Large jump button (primary action)
        const meleeButtonSize = isSmallScreen ? 56 : 70;    // Medium melee button (frequent)
        const secondarySize = isSmallScreen ? 46 : 56;      // Smaller secondary buttons (ranged, special)
        const spacing = isSmallScreen ? 8 : 12;
        const marginRight = sideSafeMargin + 5;
        const marginLeft = sideSafeMargin + 5;

        // Control opacity - semi-transparent to not fully obscure gameplay
        const controlOpacity = 0.85;
        const containerOpacity = 0.45;

        // ============ JOYSTICK (left side, centered in control zone) ============
        // LARGER: 140px diameter for comfortable thumb control
        const joystickBaseRadius = isSmallScreen ? 55 : 70;   // 110-140px diameter
        const joystickThumbRadius = isSmallScreen ? 22 : 28;  // 44-56px thumb
        const joystickX = marginLeft + joystickBaseRadius + 10;
        const joystickY = controlZoneTop + controlZoneHeight / 2; // Centered vertically in control zone

        // Joystick base - semi-transparent for better gameplay visibility
        const joystickBase = this.add.graphics();
        joystickBase.setScrollFactor(0);
        joystickBase.setDepth(10000);
        joystickBase.fillStyle(0x000000, containerOpacity);
        joystickBase.fillCircle(joystickX, joystickY, joystickBaseRadius);
        joystickBase.lineStyle(2, 0xFFFFFF, 0.4);
        joystickBase.strokeCircle(joystickX, joystickY, joystickBaseRadius);
        // Add directional indicators (left/right arrows)
        joystickBase.fillStyle(0xFFFFFF, 0.3);
        joystickBase.fillTriangle(
            joystickX - joystickBaseRadius + 10, joystickY,
            joystickX - joystickBaseRadius + 22, joystickY - 8,
            joystickX - joystickBaseRadius + 22, joystickY + 8
        );
        joystickBase.fillTriangle(
            joystickX + joystickBaseRadius - 10, joystickY,
            joystickX + joystickBaseRadius - 22, joystickY - 8,
            joystickX + joystickBaseRadius - 22, joystickY + 8
        );
        this.mobileControlElements.push(joystickBase);

        // Joystick thumb - more visible for feedback
        const joystickThumb = this.add.graphics();
        joystickThumb.setScrollFactor(0);
        joystickThumb.setDepth(10001);
        joystickThumb.fillStyle(0xFFFFFF, controlOpacity);
        joystickThumb.fillCircle(joystickX, joystickY, joystickThumbRadius);
        joystickThumb.lineStyle(2, 0x00CED1, 0.8);
        joystickThumb.strokeCircle(joystickX, joystickY, joystickThumbRadius);
        this.mobileControlElements.push(joystickThumb);

        // Store joystick state
        this.joystickCenterX = joystickX;
        this.joystickCenterY = joystickY;
        this.joystickMaxDistance = joystickBaseRadius - 5; // Max distance based on base size
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickThumb = joystickThumb;
        this.joystickThumbRadius = joystickThumbRadius;

        // Joystick touch zone - IMPROVED: larger zone that extends higher for easier reach
        const joystickZoneWidth = width * 0.45; // Left 45% of screen (was 40%)
        const joystickZoneHeight = controlZoneHeight + 40; // Extend above control zone for easier reach
        const joystickZone = this.add.zone(joystickZoneWidth / 2, controlZoneTop + controlZoneHeight / 2 - 15, joystickZoneWidth, joystickZoneHeight)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ draggable: true });
        this.mobileControlElements.push(joystickZone);

        // Store joystick base reference for floating joystick feature
        this.joystickBase = joystickBase;
        this.joystickBaseRadius = joystickBaseRadius;
        this.originalJoystickX = joystickX;
        this.originalJoystickY = joystickY;

        joystickZone.on('pointerdown', (pointer) => {
            this.joystickActive = true;
            this.joystickPointerId = pointer.id;

            // FLOATING JOYSTICK: Move joystick to where finger touches (within bounds)
            const touchX = Math.max(marginLeft + joystickBaseRadius, Math.min(pointer.x, joystickZoneWidth - joystickBaseRadius));
            const touchY = Math.max(controlZoneTop + joystickBaseRadius / 2, Math.min(pointer.y, height - bottomSafeMargin - joystickBaseRadius / 2));

            // Only move if touch is reasonably close to joystick area
            const distFromOriginal = Math.sqrt(Math.pow(pointer.x - joystickX, 2) + Math.pow(pointer.y - joystickY, 2));
            if (distFromOriginal > joystickBaseRadius * 1.5) {
                // Move joystick center to touch position
                this.joystickCenterX = touchX;
                this.joystickCenterY = touchY;

                // Redraw joystick base at new position
                this.joystickBase.clear();
                this.joystickBase.fillStyle(0x000000, containerOpacity);
                this.joystickBase.fillCircle(touchX, touchY, joystickBaseRadius);
                this.joystickBase.lineStyle(3, 0x00CED1, 0.7); // Brighter border when active
                this.joystickBase.strokeCircle(touchX, touchY, joystickBaseRadius);
                // Redraw directional arrows
                this.joystickBase.fillStyle(0xFFFFFF, 0.4);
                this.joystickBase.fillTriangle(
                    touchX - joystickBaseRadius + 12, touchY,
                    touchX - joystickBaseRadius + 26, touchY - 10,
                    touchX - joystickBaseRadius + 26, touchY + 10
                );
                this.joystickBase.fillTriangle(
                    touchX + joystickBaseRadius - 12, touchY,
                    touchX + joystickBaseRadius - 26, touchY - 10,
                    touchX + joystickBaseRadius - 26, touchY + 10
                );
            }
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
            // CRITICAL: Don't reset joystick if this pointer is on an action button
            // This prevents joystick from resetting when pressing jump while moving
            if (this.actionButtonPointers.has(pointer.id)) {
                return;
            }
            if (this.joystickActive && pointer.id === this.joystickPointerId) {
                this.resetJoystick();
            }
        });

        // Native touch end handler for reliability - only reset if no active touches remain on joystick
        this.game.canvas.addEventListener('touchend', (event) => {
            // Only reset if there are no remaining touches OR if the joystick pointer specifically ended
            if (this.joystickActive && event.touches.length === 0) {
                // All touches ended - reset joystick
                this.resetJoystick();
            }
        }, { passive: true });

        // ============ ACTION BUTTONS (right side, arc layout above large jump button) ============
        // New ergonomic layout:
        //            [Special]        <- top of arc (rare use)
        //        [Ranged]  [Melee]    <- sides of arc (frequent use)
        //           [  JUMP  ]        <- large button at bottom (primary action)

        // Jump button position (bottom-right, large)
        const jumpRadius = jumpButtonSize / 2;
        const jumpX = width - marginRight - jumpRadius - 10;
        const jumpY = controlZoneTop + controlZoneHeight - jumpRadius - 8;

        // Arc buttons positioned above jump button
        const arcRadius = jumpRadius + spacing + secondarySize / 2; // Distance from jump center to attack buttons
        const meleeX = jumpX + arcRadius * 0.7;    // Right side of arc
        const meleeY = jumpY - arcRadius * 0.6;    // Slightly above jump center
        const rangedX = jumpX - arcRadius * 0.7;   // Left side of arc
        const rangedY = jumpY - arcRadius * 0.6;   // Slightly above jump center
        const specialX = jumpX;                     // Top center of arc
        const specialY = jumpY - arcRadius - spacing; // Directly above

        // Button configs for platformer - ergonomic arc layout
        const buttons = [
            {
                id: 'special',
                label: '💥',
                x: specialX,
                y: specialY,
                size: secondarySize,
                color: 0x9B59B6, // Purple - special (costs 3 energy)
                action: () => this.performSpecialAttack(),
                energyCost: 3,
                opacity: controlOpacity
            },
            {
                id: 'ranged',
                label: '🔫',
                x: rangedX,
                y: rangedY,
                size: secondarySize,
                color: 0x00CED1, // Cyan - ranged attack (costs 1 energy)
                action: () => this.performRangedAttack(),
                energyCost: 1,
                opacity: controlOpacity
            },
            {
                id: 'melee',
                label: '👊',
                x: meleeX,
                y: meleeY,
                size: meleeButtonSize,
                color: 0xE74C3C, // Red - melee attack (free, frequent use)
                action: () => this.performAttack(),
                energyCost: 0,
                opacity: controlOpacity
            },
            {
                id: 'jump',
                label: '', // Will be drawn as arrow icon
                x: jumpX,
                y: jumpY,
                size: jumpButtonSize,
                color: 0x27AE60, // Green - jump (free)
                action: () => { this.virtualJumpPressed = true; },
                onRelease: () => { this.virtualJumpPressed = false; },
                energyCost: 0,
                opacity: controlOpacity,
                isJumpButton: true // Flag for special rendering
            }
        ];

        // Create full-width control zone background - semi-transparent
        const controlBg = this.add.graphics();
        controlBg.setScrollFactor(0);
        controlBg.setDepth(9998);
        controlBg.fillStyle(0x0D0D1A, containerOpacity * 0.8);
        controlBg.fillRect(0, controlZoneTop, width, controlZoneHeight + bottomSafeMargin);
        // Subtle top border
        controlBg.lineStyle(1, 0xFFFFFF, 0.15);
        controlBg.lineBetween(0, controlZoneTop, width, controlZoneTop);
        this.mobileControlElements.push(controlBg);

        // Button container background (right side) - encompasses arc layout
        const containerPadding = 10;
        // Calculate bounds of all buttons on right side
        const minButtonX = Math.min(rangedX, specialX) - secondarySize / 2;
        const maxButtonX = Math.max(meleeX, jumpX) + Math.max(meleeButtonSize, jumpButtonSize) / 2;
        const minButtonY = specialY - secondarySize / 2;
        const maxButtonY = jumpY + jumpRadius;

        const containerX = minButtonX - containerPadding;
        const containerY = minButtonY - containerPadding;
        const containerWidth = (maxButtonX - minButtonX) + containerPadding * 2;
        const containerHeight = (maxButtonY - minButtonY) + containerPadding * 2;

        const buttonContainer = this.add.graphics();
        buttonContainer.setScrollFactor(0);
        buttonContainer.setDepth(9999);
        buttonContainer.fillStyle(0x1A1A3E, containerOpacity);
        buttonContainer.fillRoundedRect(containerX, containerY, containerWidth, containerHeight, 15);
        buttonContainer.lineStyle(1, 0x9370DB, 0.25);
        buttonContainer.strokeRoundedRect(containerX, containerY, containerWidth, containerHeight, 15);
        this.mobileControlElements.push(buttonContainer);

        // Create each button
        buttons.forEach(config => {
            this.createPlatformerButton(config);
        });

        // ============ MENU BUTTON (top-left) ============
        this.createMenuButton(marginLeft + 30, Math.max(40, safeArea.top + 20));

        console.log('[PlatformerLevel] Mobile controls created: Joystick + 4 action buttons + menu');

        // CRITICAL: Hide controls initially - they'll be shown when intro screen is dismissed
        // This prevents controls from being visible during level entry screens
        this.hidePlatformerMobileControls();
    }

    /**
     * Hide platformer mobile controls (during intro screens)
     */
    hidePlatformerMobileControls() {
        if (!this.mobileControlElements || this.mobileControlElements.length === 0) return;

        this.mobileControlElements.forEach(element => {
            if (element && typeof element.setAlpha === 'function') {
                element.setAlpha(0);
            } else if (element && element.visible !== undefined) {
                element.visible = false;
            }
        });

        this.platformerControlsVisible = false;
        console.log('[PlatformerLevel] Mobile controls hidden (for intro screen)');
    }

    /**
     * Show platformer mobile controls (after intro screen is dismissed)
     * Call this from subclass when level entry is dismissed
     */
    showPlatformerMobileControls() {
        if (!this.isMobile || !this.mobileControlElements || this.mobileControlElements.length === 0) return;

        this.mobileControlElements.forEach(element => {
            if (element && typeof element.setAlpha === 'function') {
                element.setAlpha(1);
            } else if (element && element.visible !== undefined) {
                element.visible = true;
            }
        });

        this.platformerControlsVisible = true;
        console.log('[PlatformerLevel] Mobile controls shown (intro dismissed)');
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

        zone.on('pointerdown', (pointer) => {
            // Track this pointer as an action button pointer (prevents joystick reset)
            this.actionButtonPointers.add(pointer.id);

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

        zone.on('pointerup', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

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
        const { id, label, x, y, size, color, action, onRelease, energyCost = 0, isJumpButton = false } = config;
        const radius = size / 2;

        // Energy ring (for buttons that cost energy)
        let energyRing = null;
        if (energyCost > 0) {
            energyRing = this.add.graphics();
            energyRing.setScrollFactor(0);
            energyRing.setDepth(9999); // Below button
            this.mobileControlElements.push(energyRing);

            // Store reference for updating
            if (!this.energyRingButtons) this.energyRingButtons = {};
            this.energyRingButtons[id] = { ring: energyRing, x, y, radius: radius + 6, cost: energyCost };

            // Initial draw
            this.drawEnergyRing(energyRing, x, y, radius + 6, energyCost);
        }

        // Button background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(10000);

        // Jump button has special rendering with glow ring
        if (isJumpButton) {
            this.drawJumpButton(bg, x, y, radius, color, false);
        } else {
            this.drawPlatformerButton(bg, x, y, radius, color, false);
        }
        this.mobileControlElements.push(bg);

        // Button icon - jump button uses drawn arrow, others use emoji
        let icon = null;
        let arrowGraphics = null;

        if (isJumpButton) {
            // Draw arrow icon for jump button
            arrowGraphics = this.add.graphics();
            arrowGraphics.setScrollFactor(0);
            arrowGraphics.setDepth(10001);
            this.drawJumpArrow(arrowGraphics, x, y, radius);
            this.mobileControlElements.push(arrowGraphics);

            // "JUMP" label is part of the button itself, not separate
        } else {
            // Standard emoji icon for other buttons
            icon = this.add.text(x, y, label, {
                fontSize: `${size * 0.5}px`,
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
            this.mobileControlElements.push(icon);
        }

        // Interactive zone - larger for jump button
        const zoneSize = isJumpButton ? size + 20 : size + 10;
        const zone = this.add.zone(x, y, zoneSize, zoneSize)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002)
            .setInteractive({ useHandCursor: false });
        this.mobileControlElements.push(zone);

        zone.on('pointerdown', (pointer) => {
            // Track this pointer as an action button pointer (prevents joystick reset)
            this.actionButtonPointers.add(pointer.id);

            // Draw pressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, true);
                this.drawJumpArrow(arrowGraphics, x, y, radius, true);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, true);
                if (icon) {
                    this.tweens.add({
                        targets: icon,
                        scaleX: 0.85,
                        scaleY: 0.85,
                        duration: 60
                    });
                }
            }

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            action();
        });

        zone.on('pointerup', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

            // Draw unpressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, false);
                this.drawJumpArrow(arrowGraphics, x, y, radius, false);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, false);
                if (icon) {
                    this.tweens.add({
                        targets: icon,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 100,
                        ease: 'Back.easeOut'
                    });
                }
            }

            if (onRelease) {
                onRelease();
            }
        });

        zone.on('pointerout', (pointer) => {
            // Remove this pointer from action button tracking
            this.actionButtonPointers.delete(pointer.id);

            // Draw unpressed state
            if (isJumpButton) {
                this.drawJumpButton(bg, x, y, radius, color, false);
                this.drawJumpArrow(arrowGraphics, x, y, radius, false);
            } else {
                this.drawPlatformerButton(bg, x, y, radius, color, false);
                if (icon) {
                    icon.setScale(1);
                }
            }

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
     * Draw the jump button with special glow ring and larger visual presence
     */
    drawJumpButton(graphics, x, y, radius, color, pressed) {
        graphics.clear();

        // Outer glow ring (distinctive for jump)
        graphics.lineStyle(pressed ? 3 : 4, 0x2ECC71, pressed ? 0.5 : 0.7);
        graphics.strokeCircle(x, y, radius + 4);

        // Outer shadow
        graphics.fillStyle(0x000000, pressed ? 0.3 : 0.4);
        graphics.fillCircle(x + 2, y + 3, radius);

        // Main button - larger and more prominent
        graphics.fillStyle(color, pressed ? 0.95 : 0.85);
        graphics.fillCircle(x, y, radius);

        // Inner gradient highlight (top)
        graphics.fillStyle(0xFFFFFF, pressed ? 0.1 : 0.25);
        graphics.fillCircle(x, y - radius * 0.25, radius * 0.65);

        // Border with glow
        graphics.lineStyle(3, 0xFFFFFF, pressed ? 0.4 : 0.6);
        graphics.strokeCircle(x, y, radius);

        // "JUMP" label at bottom of button
        // Note: This is drawn as part of the graphics, not as text
        // The actual text will be shown in the arrow graphics
    }

    /**
     * Draw the jump arrow icon (drawn graphics, not emoji)
     */
    drawJumpArrow(graphics, x, y, radius, pressed = false) {
        graphics.clear();

        // Arrow shaft
        const arrowHeight = radius * 0.6;
        const arrowWidth = radius * 0.15;
        const arrowheadWidth = radius * 0.4;
        const arrowheadHeight = radius * 0.3;

        const color = pressed ? 0xE0E0E0 : 0xFFFFFF;
        const alpha = pressed ? 0.8 : 1;

        // Draw arrow pointing up
        graphics.fillStyle(color, alpha);

        // Arrow shaft (vertical rectangle)
        graphics.fillRect(
            x - arrowWidth / 2,
            y - arrowHeight / 2 + arrowheadHeight / 2,
            arrowWidth,
            arrowHeight - arrowheadHeight / 2
        );

        // Arrowhead (triangle pointing up)
        graphics.fillTriangle(
            x, y - arrowHeight / 2 - arrowheadHeight / 3,  // Top point
            x - arrowheadWidth / 2, y - arrowHeight / 2 + arrowheadHeight / 2,  // Bottom left
            x + arrowheadWidth / 2, y - arrowHeight / 2 + arrowheadHeight / 2   // Bottom right
        );

        // Add "JUMP" text below arrow
        // Note: We can't draw text with graphics, so we'll just make the arrow prominent
        // The arrow itself clearly indicates "jump"
    }

    /**
     * Draw energy ring around a button
     * Shows how much energy is available vs required
     */
    drawEnergyRing(graphics, x, y, radius, energyCost) {
        graphics.clear();

        const hasEnough = this.crystalEnergy >= energyCost;
        const energyPercent = Math.min(this.crystalEnergy / energyCost, 1);

        // Background ring (dark, shows what's missing)
        graphics.lineStyle(4, 0x2D2D4D, 0.6);
        graphics.beginPath();
        graphics.arc(x, y, radius, 0, Math.PI * 2);
        graphics.strokePath();

        if (hasEnough) {
            // Full ring when ready (bright cyan glow)
            graphics.lineStyle(4, 0x00FFFF, 0.9);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, Math.PI * 1.5);
            graphics.strokePath();

            // Pulsing glow effect
            graphics.lineStyle(8, 0x00FFFF, 0.2);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, Math.PI * 1.5);
            graphics.strokePath();
        } else {
            // Partial ring showing energy progress (yellow/orange)
            const angle = -Math.PI / 2 + (Math.PI * 2 * energyPercent);
            graphics.lineStyle(4, 0xFFAA00, 0.8);
            graphics.beginPath();
            graphics.arc(x, y, radius, -Math.PI / 2, angle);
            graphics.strokePath();

            // Small indicator for required energy
            const costText = this.add.text(x + radius - 2, y - radius + 2, `${energyCost}⚡`, {
                fontSize: '10px',
                color: hasEnough ? '#00FFFF' : '#FF6B6B',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10003);
            this.mobileControlElements.push(costText);

            // Store for cleanup on redraw
            if (!this.energyCostLabels) this.energyCostLabels = {};
            if (this.energyCostLabels[`${x}_${y}`]) {
                this.energyCostLabels[`${x}_${y}`].destroy();
            }
            this.energyCostLabels[`${x}_${y}`] = costText;
        }
    }

    /**
     * Update all energy ring indicators
     */
    updateEnergyRings() {
        if (!this.energyRingButtons) return;

        Object.values(this.energyRingButtons).forEach(btn => {
            this.drawEnergyRing(btn.ring, btn.x, btn.y, btn.radius, btn.cost);
        });
    }

    /**
     * Update joystick thumb position and calculate input
     * IMPROVED: Larger dead zone, horizontal lock for platformers, better visual feedback
     */
    updateJoystick(pointer) {
        const offsetX = pointer.x - this.joystickCenterX;
        const offsetY = pointer.y - this.joystickCenterY;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        let angle = Math.atan2(offsetY, offsetX);

        // HORIZONTAL LOCK: For platformers, strongly favor horizontal movement
        // If moving mostly horizontal (within 35 degrees of horizontal), snap to pure horizontal
        const angleDeg = Math.abs(angle * 180 / Math.PI);
        const isNearHorizontal = angleDeg < 35 || angleDeg > 145;
        if (isNearHorizontal && distance > this.joystickMaxDistance * 0.2) {
            // Snap to pure horizontal (left or right)
            angle = offsetX >= 0 ? 0 : Math.PI;
        }

        const clampedDistance = Math.min(distance, this.joystickMaxDistance);
        const thumbX = this.joystickCenterX + Math.cos(angle) * clampedDistance;
        // For horizontal lock, keep thumb on horizontal axis
        const thumbY = isNearHorizontal && distance > this.joystickMaxDistance * 0.2
            ? this.joystickCenterY
            : this.joystickCenterY + Math.sin(angle) * clampedDistance;

        // Update thumb visual with active state
        this.joystickThumb.clear();
        // Brighter when actively moving
        const isMoving = distance > this.joystickMaxDistance * 0.25;
        this.joystickThumb.fillStyle(isMoving ? 0x00CED1 : 0xFFFFFF, 0.9);
        this.joystickThumb.fillCircle(thumbX, thumbY, this.joystickThumbRadius);
        this.joystickThumb.lineStyle(3, isMoving ? 0xFFFFFF : 0x00CED1, 1);
        this.joystickThumb.strokeCircle(thumbX, thumbY, this.joystickThumbRadius);

        // Add direction arrow when moving
        if (isMoving) {
            const arrowDir = offsetX >= 0 ? 1 : -1;
            this.joystickThumb.fillStyle(0xFFFFFF, 0.8);
            this.joystickThumb.fillTriangle(
                thumbX + arrowDir * 8, thumbY,
                thumbX - arrowDir * 4, thumbY - 6,
                thumbX - arrowDir * 4, thumbY + 6
            );
        }

        // Calculate normalized X input (-1 to 1) with LARGER dead zone (25%)
        const deadZone = this.joystickMaxDistance * 0.25; // Was 0.15, now 0.25
        if (distance > deadZone) {
            const effectiveDistance = clampedDistance - deadZone;
            const effectiveMax = this.joystickMaxDistance - deadZone;
            const magnitude = Math.min(1, effectiveDistance / effectiveMax);

            // For horizontal lock, use full magnitude
            if (isNearHorizontal) {
                this.virtualJoystickX = offsetX >= 0 ? magnitude : -magnitude;
            } else {
                this.virtualJoystickX = Math.cos(angle) * magnitude;
            }
        } else {
            this.virtualJoystickX = 0;
        }
    }

    /**
     * Reset joystick to center and original position (for floating joystick)
     */
    resetJoystick() {
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.virtualJoystickX = 0;

        // Reset joystick to original position (floating joystick returns home)
        if (this.originalJoystickX && this.originalJoystickY) {
            this.joystickCenterX = this.originalJoystickX;
            this.joystickCenterY = this.originalJoystickY;

            // Redraw base at original position with inactive styling
            if (this.joystickBase && this.joystickBaseRadius) {
                this.joystickBase.clear();
                this.joystickBase.fillStyle(0x000000, 0.4); // More transparent when inactive
                this.joystickBase.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickBaseRadius);
                this.joystickBase.lineStyle(2, 0xFFFFFF, 0.4);
                this.joystickBase.strokeCircle(this.joystickCenterX, this.joystickCenterY, this.joystickBaseRadius);
                // Directional arrows
                this.joystickBase.fillStyle(0xFFFFFF, 0.3);
                this.joystickBase.fillTriangle(
                    this.joystickCenterX - this.joystickBaseRadius + 12, this.joystickCenterY,
                    this.joystickCenterX - this.joystickBaseRadius + 26, this.joystickCenterY - 10,
                    this.joystickCenterX - this.joystickBaseRadius + 26, this.joystickCenterY + 10
                );
                this.joystickBase.fillTriangle(
                    this.joystickCenterX + this.joystickBaseRadius - 12, this.joystickCenterY,
                    this.joystickCenterX + this.joystickBaseRadius - 26, this.joystickCenterY - 10,
                    this.joystickCenterX + this.joystickBaseRadius - 26, this.joystickCenterY + 10
                );
            }
        }

        // Reset thumb to center with inactive styling
        if (this.joystickThumb) {
            this.joystickThumb.clear();
            this.joystickThumb.fillStyle(0xFFFFFF, 0.7);
            this.joystickThumb.fillCircle(this.joystickCenterX, this.joystickCenterY, this.joystickThumbRadius);
            this.joystickThumb.lineStyle(2, 0x00CED1, 0.8);
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
        // Skip if enemy is already defeated
        if (!enemy.active) return;

        // Get collision info
        const playerCenterY = player.body.center.y;
        const playerBottom = player.body.bottom;
        const playerVelocityY = player.body.velocity.y;
        const enemyCenterY = enemy.body.center.y;
        const enemyTop = enemy.body.top;

        // Mario-style stomp detection - GENEROUS for better game feel:
        // 1. Player must be falling (positive Y velocity) OR just landed (velocity near 0 but was falling)
        // 2. Player's CENTER must be above enemy's CENTER (player approaching from above)
        // 3. Player's BOTTOM must be in upper portion of enemy (feet hitting head)
        const isFalling = playerVelocityY > -50; // Allow small upward velocity (just bounced)
        const isAboveEnemy = playerCenterY < enemyCenterY; // Player center is higher (lower Y)
        const feetNearTop = playerBottom <= enemyTop + (enemy.body.height * 0.6); // Generous 60%

        const isStomping = isFalling && isAboveEnemy && feetNearTop;

        if (isStomping) {
            console.log('[PlatformerLevel] Enemy stomped! Player Y:', playerCenterY, 'Enemy Y:', enemyCenterY);
            this.defeatEnemy(enemy);
            player.setVelocityY(this.jumpVelocity * 0.6); // Bounce up

            // Satisfying stomp sound
            if (window.AudioManager) {
                window.AudioManager.playEnemyHit();
            }
        } else {
            // Player touched enemy from side/below - take damage
            console.log('[PlatformerLevel] Enemy collision - damage! Player Y:', playerCenterY, 'Enemy Y:', enemyCenterY);
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

        // Also update mobile button energy rings
        this.updateEnergyRings();
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
        if (!this.player || this.isPlayerDead) return;

        // Check if grounded
        this.isGrounded = this.player.body.blocked.down || this.player.body.touching.down;

        // Track coyote time - record when we were last grounded
        if (this.isGrounded) {
            this.lastGroundedTime = time;
        }

        // Detect landing (transition from air to ground) for dust effect
        if (this.isGrounded && !this.wasGrounded) {
            this.onLanding(time);
        }
        this.wasGrounded = this.isGrounded;

        // Track last safe position when grounded (for respawn after pit falls)
        if (this.isGrounded && !this.isInvincible) {
            this.updateLastSafePosition();
        }

        // Check for fall out of bounds (kill zone)
        this.checkFallOutOfBounds();

        // Handle ducking (must check before movement)
        this.handleDuck();

        // Handle movement (with smooth acceleration)
        this.handleMovement();

        // Handle jumping (only if not ducking)
        if (!this.isDucking) {
            this.handleJump(time);
        }

        // Update player facing direction
        this.updatePlayerFacing();

        // MOBILE UX: Update camera directional lead
        this.updateCameraLead();

        // Update Crystal Shield if active
        if (this.hasShield) {
            this.updateShield(delta);
        }
    }

    /**
     * Called when player lands on ground
     * Triggers landing dust effect if falling from height
     */
    onLanding(time) {
        const fallDistance = this.player.y - this.lastLandingY;

        // Only show dust if fell a significant distance (not just stepping down)
        if (fallDistance > 50 && window.FXLibrary) {
            window.FXLibrary.landingDust(this, this.player.x, this.player.body.bottom, {
                count: Math.min(15, Math.floor(fallDistance / 30) + 5)
            });
        }

        // Update last landing Y for next comparison
        this.lastLandingY = this.player.y;

        // Check for jump buffer - if player pressed jump while in air near landing
        if (this.jumpBufferPressed && (time - this.jumpBufferTimestamp) < this.jumpBufferTime) {
            // Execute buffered jump immediately
            this.time.delayedCall(20, () => {
                if (this.isGrounded && this.canJump && !this.isDucking) {
                    this.executeJump();
                }
            });
        }
    }

    /**
     * Update Crystal Shield power-up
     */
    updateShield(delta) {
        this.shieldTimeRemaining -= delta;

        // Update shield aura visual
        if (this.shieldAuraController) {
            this.shieldAuraController.update(this.player.x, this.player.y);
        }

        // Shield expired
        if (this.shieldTimeRemaining <= 0) {
            this.deactivateShield();
        }
    }

    /**
     * Activate Crystal Shield power-up
     */
    activateShield() {
        console.log('[PlatformerLevel] Crystal Shield activated!');

        this.hasShield = true;
        this.shieldTimeRemaining = this.shieldDuration;

        // Create shield aura visual
        if (window.FXLibrary) {
            this.shieldAuraController = window.FXLibrary.shieldAura(this, this.player, {
                radius: 45,
                color: 0x00FFFF
            });
        }

        // Play activation sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Show floating text
        this.showFloatingText('SHIELD ACTIVE!', this.player.x, this.player.y - 60, '#00FFFF');
    }

    /**
     * Deactivate Crystal Shield
     */
    deactivateShield() {
        console.log('[PlatformerLevel] Crystal Shield expired');

        this.hasShield = false;
        this.shieldTimeRemaining = 0;

        // Destroy shield aura
        if (this.shieldAuraController) {
            this.shieldAuraController.destroy();
            this.shieldAuraController = null;
        }

        // Play expiration sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Show floating text
        this.showFloatingText('Shield Faded', this.player.x, this.player.y - 60, '#888888');
    }

    /**
     * Show floating text that rises and fades
     */
    showFloatingText(text, x, y, color = '#FFD700') {
        const floatingText = this.add.text(x, y, text, {
            fontSize: '20px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(950);

        this.tweens.add({
            targets: floatingText,
            y: y - 60,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.3 },
            duration: 1200,
            onComplete: () => floatingText.destroy()
        });
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

        // Speed lines when moving fast (velocity > 150)
        const speed = Math.abs(this.player.body.velocity.x);
        if (speed > 150 && window.FXLibrary && !this.speedLineThrottle) {
            const direction = this.player.body.velocity.x > 0 ? -1 : 1;
            window.FXLibrary.speedLines(this, this.player.x, this.player.y, direction);

            // Throttle speed lines to prevent too many particles
            this.speedLineThrottle = true;
            this.time.delayedCall(80, () => {
                this.speedLineThrottle = false;
            });
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
     * Handle jump input with coyote time and jump buffering
     * - Coyote time: 100ms grace period after leaving platform
     * - Jump buffering: Accept jump input 100ms before landing
     * Supports both keyboard and virtual jump button
     */
    handleJump(time) {
        const jumpPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown ||
                           this.virtualJumpPressed;  // Mobile virtual jump button

        // Calculate if within coyote time (recently was grounded)
        const timeSinceGrounded = time - this.lastGroundedTime;
        const canCoyoteJump = timeSinceGrounded < this.coyoteTime;

        // Determine if we can jump (grounded OR within coyote time)
        const canJumpNow = (this.isGrounded || canCoyoteJump) && this.canJump;

        if (jumpPressed && canJumpNow) {
            this.executeJump();
        } else if (jumpPressed && !this.isGrounded) {
            // Player pressed jump while in air - buffer it for landing
            this.jumpBufferPressed = true;
            this.jumpBufferTimestamp = time;
        }

        // Clear jump buffer if grounded and no jump pressed
        if (this.isGrounded && !jumpPressed) {
            this.jumpBufferPressed = false;
        }
    }

    /**
     * Execute the actual jump
     * Separated to allow calling from handleJump and jump buffer
     */
    executeJump() {
        // Track Y position before jump for landing dust calculation
        this.lastLandingY = this.player.y;

        this.player.setVelocityY(this.jumpVelocity);
        this.canJump = false;
        this.isGrounded = false;

        // Reset virtual jump to prevent continuous jumping
        this.virtualJumpPressed = false;

        // Clear jump buffer since we just jumped
        this.jumpBufferPressed = false;

        // Play jump sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Jump cooldown
        this.time.delayedCall(this.jumpCooldown, () => {
            this.canJump = true;
        });
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
     * @param {number} amount - Damage amount (1 = 1 heart)
     * @param {boolean} bypassInvincibility - If true, ignore invincibility (for pit falls)
     */
    takeDamage(amount, bypassInvincibility = false) {
        // Crystal Shield blocks all damage
        if (this.hasShield) {
            console.log('[PlatformerLevel] Damage blocked by Crystal Shield!');
            // Visual feedback - shield absorb effect
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, this.player.x, this.player.y, {
                    count: 8,
                    color: [0x00FFFF, 0xFFFFFF],
                    duration: 400
                });
            }
            return;
        }

        // Check invincibility - prevents multi-hit from overlapping enemies
        if (this.isInvincible && !bypassInvincibility) {
            return;
        }

        // Check if already dead
        if (this.isPlayerDead) {
            return;
        }

        this.health -= amount;
        this.updateHealthDisplay();

        // Track damage for achievement purposes (no-damage run tracking)
        this.damageTaken = (this.damageTaken || 0) + amount;

        console.log(`[PlatformerLevel] Player took ${amount} damage, health: ${this.health}/${this.maxHealth}`);

        // Check for death first
        if (this.health <= 0) {
            this.onPlayerDeath();
            return;
        }

        // Start invincibility period
        this.isInvincible = true;

        // Flash red initially
        this.player.setTint(0xFF0000);
        this.time.delayedCall(200, () => {
            if (this.player) this.player.clearTint();
        });

        // Knockback
        const knockbackX = this.player.facingRight ? -200 : 200;
        this.player.setVelocity(knockbackX, -150);

        // Flashing effect during invincibility
        this.startInvincibilityFlash();

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // End invincibility after duration
        this.time.delayedCall(this.invincibilityDuration, () => {
            this.endInvincibility();
        });
    }

    /**
     * Start flashing effect during invincibility
     */
    startInvincibilityFlash() {
        if (!this.player) return;

        // Create flashing tween
        this.invincibilityTween = this.tweens.add({
            targets: this.player,
            alpha: { from: 1, to: 0.3 },
            duration: 100,
            yoyo: true,
            repeat: -1 // Repeat until stopped
        });
    }

    /**
     * End invincibility period
     */
    endInvincibility() {
        this.isInvincible = false;

        // Stop flashing
        if (this.invincibilityTween) {
            this.invincibilityTween.stop();
            this.invincibilityTween = null;
        }

        // Reset alpha
        if (this.player) {
            this.player.setAlpha(1);
        }
    }

    /**
     * Update last safe position (called when grounded)
     * Only updates if player has moved significantly from last position
     */
    updateLastSafePosition() {
        const currentPos = { x: this.player.x, y: this.player.y };

        // Only update if moved more than 50px from last safe position
        // This prevents constant updates while standing still
        if (!this.lastSafePosition ||
            Math.abs(currentPos.x - this.lastSafePosition.x) > 50 ||
            Math.abs(currentPos.y - this.lastSafePosition.y) > 50) {
            this.lastSafePosition = currentPos;
        }
    }

    /**
     * Set an explicit checkpoint (for mid-level checkpoints)
     */
    setCheckpoint(x, y) {
        this.checkpointPosition = { x, y };
        console.log(`[PlatformerLevel] Checkpoint set at (${x}, ${y})`);

        // Visual feedback
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 15,
                color: [0x00FF00, 0x7CFC00],
                duration: 1000
            });
        }
    }

    /**
     * Check if player has fallen out of bounds (below level)
     */
    checkFallOutOfBounds() {
        if (!this.player || this.isPlayerDead) return;

        // Fall threshold: below level height + buffer
        const fallThreshold = this.levelHeight + 200;

        if (this.player.y > fallThreshold) {
            console.log('[PlatformerLevel] Player fell out of bounds');
            this.onPitFall();
        }
    }

    /**
     * Handle falling into a pit
     * Takes 1 heart of damage and respawns at checkpoint
     */
    onPitFall() {
        // Prevent multiple pit fall triggers
        if (this.isRespawning) return;
        this.isRespawning = true;

        // Take 1 heart damage (bypass invincibility since it's a pit)
        this.health -= 1;
        this.updateHealthDisplay();

        console.log(`[PlatformerLevel] Pit fall! Health: ${this.health}/${this.maxHealth}`);

        // Check for death
        if (this.health <= 0) {
            this.isRespawning = false;
            this.onPlayerDeath();
            return;
        }

        // Play fall sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Brief screen effect
        const flash = this.add.graphics();
        flash.fillStyle(0x000000, 0.8);
        flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        flash.setScrollFactor(0);
        flash.setDepth(1500);

        // Respawn after short delay
        this.time.delayedCall(300, () => {
            this.respawnAtCheckpoint();
            flash.destroy();
        });
    }

    /**
     * Respawn player at last checkpoint or safe position
     */
    respawnAtCheckpoint() {
        // Use explicit checkpoint if set, otherwise last safe position, otherwise level start
        const respawnPos = this.checkpointPosition ||
                          this.lastSafePosition ||
                          { x: 150, y: this.levelHeight - 200 };

        console.log(`[PlatformerLevel] Respawning at (${respawnPos.x}, ${respawnPos.y})`);

        // Teleport player
        this.player.setPosition(respawnPos.x, respawnPos.y);
        this.player.setVelocity(0, 0);

        // Brief invincibility after respawn
        this.isInvincible = true;
        this.startInvincibilityFlash();

        this.time.delayedCall(this.invincibilityDuration, () => {
            this.endInvincibility();
        });

        // Reset respawning flag
        this.isRespawning = false;
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

        // Record failure for contextual thoughts
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.recordFailure(this.levelId || this.scene.key);
        }

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
                } catch (e) {
                    // Element already destroyed - safe to ignore during cleanup
                }
            });
            this.pauseMenuElements = [];
        }

        this.pauseMenuActive = false;

        // Resume physics
        this.physics.resume();
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
                } catch (e) {
                    // Element already destroyed - safe to ignore during shutdown
                }
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

    // ==========================================
    // CREATURE INTELLIGENCE HOOKS
    // ==========================================

    /**
     * Record level success for contextual thoughts
     * Call from child classes when level is completed
     */
    recordLevelSuccess() {
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.recordSuccess(this.levelId || this.scene.key);
        }
    }

    /**
     * Notify thought system of current biome
     * Call from child classes in create()
     */
    notifyBiomeEntered(biomeType) {
        if (window.ThoughtBubbleSystem) {
            window.ThoughtBubbleSystem.setBiome(biomeType);
        }
    }
}

// Export for module systems
export default PlatformerLevelScene;

// Also expose globally for Phaser scene registration
if (typeof window !== 'undefined') {
    window.PlatformerLevelScene = PlatformerLevelScene;
}
