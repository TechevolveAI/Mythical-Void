import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * CrystalCavesLevel - Crystal Caves platformer level
 *
 * Story: "Ancient miners once harvested the mystical crystals that glow in these depths.
 * Now abandoned, the caves are home to shadow bats and crystal golems.
 * Deep within lies the Crystal Heart - a legendary artifact that pulses with ancient energy."
 *
 * Objectives:
 * - Primary: Reach the Crystal Heart at the end
 * - Secondary: Collect 5 Ancient Relics, Defeat Crystal Golem boss
 */
class CrystalCavesLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'CrystalCavesLevel',
            levelId: 'crystal_caves_1',
            biomeId: 'crystal_caves',
            levelWidth: 5000,
            levelHeight: 800
        });

        // Level-specific state
        this.relicsCollected = 0;
        this.totalRelics = 5;
        this.bossDefeated = false;
        this.crystalHeartFound = false;
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 8;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Enemy spawns
        this.enemySpawns = [];

        // Ambient audio controller
        this.ambientAudio = null;
    }

    /**
     * Override init to reset level-specific state on restart
     */
    init(data) {
        // Call parent init first (resets base game state)
        super.init(data);

        // Reset level-specific state
        this.relicsCollected = 0;
        this.bossDefeated = false;
        this.crystalHeartFound = false;
        this.bossFightActive = false;
        this.enemySpawns = [];

        // Reset boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Reset ambient audio
        this.ambientAudio = null;

        console.log('[CrystalCavesLevel] Level-specific state reset for restart');
    }

    create() {
        // Call parent create
        super.create();

        // Show level entry screen
        this.showLevelEntry();
    }

    /**
     * Show level entry screen with objectives
     */
    showLevelEntry() {
        const { width, height } = this.cameras.main;

        // Pause game briefly
        this.physics.pause();

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel background
        const panelWidth = 450;
        const panelHeight = 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1025, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x7B68EE, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Crystal decorations
        this.addCrystalDecoration(panel, panelX + 30, panelY + 30);
        this.addCrystalDecoration(panel, panelX + panelWidth - 30, panelY + 30);

        // Title
        const title = this.add.text(width / 2, panelY + 50, 'CRYSTAL CAVES', {
            fontSize: '36px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Subtitle
        const subtitle = this.add.text(width / 2, panelY + 90, '"Deep below, ancient crystals sing"', {
            fontSize: '16px',
            color: '#9370DB',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x7B68EE, 0.5);
        divider.lineBetween(panelX + 40, panelY + 120, panelX + panelWidth - 40, panelY + 120);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Objective header
        const objHeader = this.add.text(width / 2, panelY + 145, 'OBJECTIVE', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Main objective
        const mainObj = this.add.text(width / 2, panelY + 175, 'Find the Crystal Heart', {
            fontSize: '22px',
            color: '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Secondary objectives
        const secondaryY = panelY + 220;
        const relic = this.add.text(panelX + 60, secondaryY, '[ ] Collect Ancient Relics (0/5)', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        const boss = this.add.text(panelX + 60, secondaryY + 30, '[ ] Defeat the Crystal Golem', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        // Enter button
        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ ENTER THE CAVES ]', {
            fontSize: '20px',
            color: '#7B68EE',
            backgroundColor: '#2D1B3D',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        // Button hover effects
        enterBtn.on('pointerover', () => {
            enterBtn.setColor('#E040FB');
            enterBtn.setScale(1.05);
        });
        enterBtn.on('pointerout', () => {
            enterBtn.setColor('#7B68EE');
            enterBtn.setScale(1.0);
        });
        enterBtn.on('pointerdown', () => {
            // Fade out and start level
            this.tweens.add({
                targets: [overlay, panel, title, subtitle, divider, objHeader, mainObj, relic, boss, enterBtn],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    panel.destroy();
                    title.destroy();
                    subtitle.destroy();
                    divider.destroy();
                    objHeader.destroy();
                    mainObj.destroy();
                    relic.destroy();
                    boss.destroy();
                    enterBtn.destroy();

                    // Resume game
                    this.physics.resume();
                }
            });
        });

        // Pulsing animation on button
        this.tweens.add({
            targets: enterBtn,
            alpha: { from: 0.8, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Add crystal decoration to panel
     */
    addCrystalDecoration(graphics, x, y) {
        graphics.fillStyle(0x7B68EE, 0.6);
        graphics.fillTriangle(x - 8, y + 15, x + 8, y + 15, x, y - 10);
        graphics.fillStyle(0x00FFFF, 0.4);
        graphics.fillTriangle(x - 5, y + 12, x + 5, y + 12, x, y - 5);
    }

    /**
     * Create level-specific platforms layout
     *
     * PLATFORMER DESIGN PRINCIPLES:
     * - Physics: gravity=500, jump=-420, speed=180
     * - Max jump height: ~176px → Safe vertical gaps: 100-140px
     * - Max horizontal: ~300px → Safe horizontal gaps: 180-240px
     * - Multiple paths for creativity
     * - Visual flow showing the intended route
     * - Generous platforms near hazards
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // ===== GROUND SECTIONS (with jumpable gaps) =====
        // Gap widths: ~200px (safe jumps)
        this.createPlatform(0, this.levelHeight - 50, 900, 80, 'solid');      // Start area
        this.createPlatform(1100, this.levelHeight - 50, 700, 80, 'solid');   // After first gap (200px gap)
        this.createPlatform(2000, this.levelHeight - 50, 600, 80, 'solid');   // Mid section (200px gap)
        this.createPlatform(2800, this.levelHeight - 50, 500, 80, 'solid');   // Pre-climb (200px gap)
        this.createPlatform(3500, this.levelHeight - 50, 1500, 80, 'solid');  // Boss arena (200px gap)

        // ===== SECTION 1: Tutorial Zone (0-900px) =====
        // Teach basic mechanics - low risk, clear progression
        this.createPlatform(150, this.levelHeight - 150, 200, 25, 'solid');   // First platform (100px up)
        this.createPlatform(400, this.levelHeight - 150, 180, 25, 'solid');   // Same height (easy hop)
        this.createPlatform(630, this.levelHeight - 230, 200, 25, 'solid');   // Slightly higher (80px up)

        // Optional upper path (teaches vertical exploration)
        this.createPlatform(300, this.levelHeight - 300, 150, 20, 'one-way'); // 70px up from 630 platform

        // ===== SECTION 2: First Challenge (900-1800px) =====
        // Over the first ground gap - multiple solutions

        // LOW PATH (safe, longer)
        this.createPlatform(850, this.levelHeight - 180, 180, 25, 'solid');   // Jump from ground
        this.createPlatform(1080, this.levelHeight - 180, 150, 25, 'solid');  // 230px gap (safe)

        // HIGH PATH (risky, faster) - requires good timing
        this.createPlatform(900, this.levelHeight - 320, 140, 20, 'one-way'); // 140px up
        this.createPlatform(1100, this.levelHeight - 400, 160, 25, 'solid');  // 80px up, 200px gap

        // Converging platforms
        this.createPlatform(1350, this.levelHeight - 280, 200, 25, 'solid');  // Both paths can reach
        this.createPlatform(1600, this.levelHeight - 200, 180, 25, 'solid');  // Descent to ground

        // SECRET: Upper alcove with relic (accessible from high path)
        this.createPlatform(1200, this.levelHeight - 520, 150, 25, 'solid');  // 120px above high path

        // ===== SECTION 3: Vertical Chamber (1800-2800px) =====
        // Climbing section - zigzag pattern for clear visual flow

        // Entry platforms
        this.createPlatform(1900, this.levelHeight - 150, 180, 25, 'solid');  // From ground

        // Zigzag ascent (alternating left-right, 100-120px vertical gaps)
        this.createPlatform(2100, this.levelHeight - 250, 180, 25, 'solid');  // 100px up
        this.createPlatform(2350, this.levelHeight - 350, 180, 25, 'solid');  // 100px up, 250px right
        this.createPlatform(2150, this.levelHeight - 450, 180, 25, 'solid');  // 100px up, 200px left
        this.createPlatform(2400, this.levelHeight - 530, 180, 25, 'solid');  // 80px up, 250px right
        this.createPlatform(2200, this.levelHeight - 620, 180, 25, 'solid');  // 90px up (top of chamber)

        // Alternative side path (for exploration)
        this.createPlatform(2600, this.levelHeight - 200, 160, 25, 'solid');  // From ground
        this.createPlatform(2650, this.levelHeight - 340, 160, 25, 'solid');  // 140px up
        this.createPlatform(2600, this.levelHeight - 470, 180, 25, 'solid');  // Relic platform

        // ===== SECTION 4: Descent to Arena (2800-3500px) =====
        // Controlled descent - can't go too fast or you'll miss platforms

        this.createPlatform(2850, this.levelHeight - 550, 160, 25, 'solid');  // High start
        this.createPlatform(3050, this.levelHeight - 450, 180, 25, 'solid');  // 100px down
        this.createPlatform(3280, this.levelHeight - 350, 180, 25, 'solid');  // 100px down
        this.createPlatform(3100, this.levelHeight - 250, 180, 25, 'solid');  // 100px down
        this.createPlatform(3350, this.levelHeight - 150, 200, 25, 'solid');  // Near ground level

        // ===== SECTION 5: Boss Arena (3500-5000px) =====
        // Open arena with tactical elevation options

        // Tactical platforms (for dodging boss attacks)
        this.createPlatform(3700, this.levelHeight - 180, 200, 25, 'solid');  // Low left
        this.createPlatform(4000, this.levelHeight - 280, 220, 25, 'solid');  // Mid center
        this.createPlatform(4350, this.levelHeight - 180, 200, 25, 'solid');  // Low right
        this.createPlatform(4150, this.levelHeight - 400, 180, 20, 'one-way'); // High center (refuge)

        // Path to Crystal Heart (stepped approach - 100px vertical gaps)
        this.createPlatform(4550, this.levelHeight - 280, 180, 25, 'solid');  // Step 1
        this.createPlatform(4700, this.levelHeight - 380, 180, 25, 'solid');  // Step 2 (100px up)

        // Crystal Heart platform (final goal)
        this.createPlatform(4750, this.levelHeight - 480, 200, 30, 'solid');  // Step 3 (100px up)

        console.log(`[CrystalCavesLevel] Created ${this.platforms.getLength()} platforms`);
    }

    /**
     * Create level-specific content
     */
    createLevelContent() {
        // Create enemies
        this.createEnemies();

        // Create collectibles
        this.createCollectibles();

        // Create atmospheric elements
        this.createAtmosphere();

        // Create the Crystal Heart goal
        this.createCrystalHeart();
    }

    /**
     * Create enemies for this level
     * Positioned to match the new platform layout
     */
    createEnemies() {
        this.enemies = this.physics.add.group();

        // Shadow Bats - flutter patrol (positioned near platform routes)
        this.createShadowBat(500, this.levelHeight - 280);    // Tutorial area - above platforms
        this.createShadowBat(1000, this.levelHeight - 350);   // Over first gap - challenge
        this.createShadowBat(1450, this.levelHeight - 380);   // Near converging platform
        this.createShadowBat(2300, this.levelHeight - 450);   // Vertical chamber
        this.createShadowBat(3150, this.levelHeight - 400);   // Descent section

        // Cave Crawlers - ground patrol (on ground sections)
        this.createCaveCrawler(600, this.levelHeight - 100);   // Tutorial ground
        this.createCaveCrawler(1300, this.levelHeight - 100);  // Second ground section
        this.createCaveCrawler(2200, this.levelHeight - 100);  // Mid ground
        this.createCaveCrawler(3000, this.levelHeight - 100);  // Pre-climb ground
        this.createCaveCrawler(4100, this.levelHeight - 100);  // Boss arena

        // Set up enemy collisions
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.player, this.enemies, this.onEnemyCollision, null, this);

        console.log(`[CrystalCavesLevel] Created ${this.enemies.getLength()} enemies`);
    }

    /**
     * Create a Shadow Bat enemy
     */
    createShadowBat(x, y) {
        // Generate bat texture
        const textureKey = 'shadowBat';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Bat body
            graphics.fillStyle(0x2D1B3D, 1);
            graphics.fillEllipse(20, 15, 30, 20);

            // Wings
            graphics.fillStyle(0x3D2B4D, 0.9);
            graphics.fillTriangle(5, 15, 0, 5, 15, 15);
            graphics.fillTriangle(35, 15, 40, 5, 25, 15);

            // Eyes
            graphics.fillStyle(0xE040FB, 1);
            graphics.fillCircle(15, 12, 4);
            graphics.fillCircle(25, 12, 4);

            graphics.generateTexture(textureKey, 40, 30);
            graphics.destroy();
        }

        const bat = this.enemies.create(x, y, textureKey);
        bat.setCollideWorldBounds(true);
        bat.setBounce(0);
        bat.body.setAllowGravity(false);  // Bats fly
        bat.setDepth(850); // Above platforms (Y-based depth up to 800), below player (900)
        bat.health = 1;
        bat.enemyType = 'shadowBat';
        bat.patrolStartX = x - 100;
        bat.patrolEndX = x + 100;
        bat.patrolDirection = 1;

        // Flutter animation
        this.tweens.add({
            targets: bat,
            scaleY: { from: 0.9, to: 1.1 },
            duration: 150,
            yoyo: true,
            repeat: -1
        });

        // Patrol behavior
        this.time.addEvent({
            delay: 50,
            callback: () => this.updateBatPatrol(bat),
            loop: true
        });

        return bat;
    }

    /**
     * Update bat patrol movement
     */
    updateBatPatrol(bat) {
        if (!bat.active) return;

        const speed = 80;
        bat.setVelocityX(speed * bat.patrolDirection);

        // Reverse at patrol bounds
        if (bat.x >= bat.patrolEndX) {
            bat.patrolDirection = -1;
            bat.setFlipX(true);
        } else if (bat.x <= bat.patrolStartX) {
            bat.patrolDirection = 1;
            bat.setFlipX(false);
        }

        // Sine wave vertical movement
        bat.y += Math.sin(this.time.now / 200) * 0.5;
    }

    /**
     * Create a Cave Crawler enemy
     */
    createCaveCrawler(x, y) {
        const textureKey = 'caveCrawler';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Body (armored beetle-like)
            graphics.fillStyle(0x2C3E50, 1);
            graphics.fillEllipse(25, 20, 45, 30);

            // Shell segments
            graphics.lineStyle(2, 0x1A252F, 1);
            graphics.lineBetween(15, 10, 15, 30);
            graphics.lineBetween(25, 8, 25, 32);
            graphics.lineBetween(35, 10, 35, 30);

            // Eyes
            graphics.fillStyle(0xFF4500, 1);
            graphics.fillCircle(10, 15, 4);
            graphics.fillCircle(40, 15, 4);

            // Legs
            graphics.lineStyle(3, 0x1A252F, 1);
            graphics.lineBetween(10, 25, 5, 35);
            graphics.lineBetween(20, 28, 18, 38);
            graphics.lineBetween(30, 28, 32, 38);
            graphics.lineBetween(40, 25, 45, 35);

            graphics.generateTexture(textureKey, 50, 40);
            graphics.destroy();
        }

        const crawler = this.enemies.create(x, y, textureKey);
        crawler.setCollideWorldBounds(true);
        crawler.setBounce(0);
        crawler.setDepth(850); // Above platforms (Y-based depth up to 800), below player (900)
        crawler.health = 2;
        crawler.enemyType = 'caveCrawler';
        crawler.patrolStartX = x - 150;
        crawler.patrolEndX = x + 150;
        crawler.patrolDirection = 1;

        // Patrol movement
        this.time.addEvent({
            delay: 50,
            callback: () => this.updateCrawlerPatrol(crawler),
            loop: true
        });

        return crawler;
    }

    /**
     * Update crawler patrol movement
     */
    updateCrawlerPatrol(crawler) {
        if (!crawler.active) return;

        const speed = 60;
        crawler.setVelocityX(speed * crawler.patrolDirection);

        // Reverse at patrol bounds
        if (crawler.x >= crawler.patrolEndX) {
            crawler.patrolDirection = -1;
            crawler.setFlipX(true);
        } else if (crawler.x <= crawler.patrolStartX) {
            crawler.patrolDirection = 1;
            crawler.setFlipX(false);
        }
    }

    /**
     * Create collectibles (coins, relics)
     * Positioned to reward exploration and mark platform routes
     */
    createCollectibles() {
        this.collectibles = this.physics.add.group();

        // Cosmic coins throughout level - guide player along routes
        const coinPositions = [
            // Tutorial area
            { x: 250, y: this.levelHeight - 190 },   // Above first platform
            { x: 500, y: this.levelHeight - 190 },   // Between tutorial platforms
            { x: 720, y: this.levelHeight - 280 },   // Above 3rd tutorial platform
            // First challenge
            { x: 950, y: this.levelHeight - 230 },   // Low path marker
            { x: 1000, y: this.levelHeight - 370 },  // High path marker
            // Vertical chamber
            { x: 2250, y: this.levelHeight - 400 },  // Zigzag climb
            { x: 2500, y: this.levelHeight - 570 },  // Upper climb
            // Descent
            { x: 2950, y: this.levelHeight - 500 },  // Descent path
            { x: 3200, y: this.levelHeight - 300 },  // Mid descent
            // Boss arena
            { x: 4100, y: this.levelHeight - 330 },  // Above tactical platform
        ];

        coinPositions.forEach(pos => {
            this.createCoin(pos.x, pos.y);
        });

        // Ancient Relics (5 total for secondary objective)
        // Placed in slightly hidden or challenging spots
        const relicPositions = [
            { x: 370, y: this.levelHeight - 340 },   // Optional upper path (tutorial secret)
            { x: 1270, y: this.levelHeight - 560 },  // Secret alcove above high path
            { x: 2290, y: this.levelHeight - 660 },  // Top of vertical chamber
            { x: 2680, y: this.levelHeight - 510 },  // Alternative side path
            { x: 4900, y: this.levelHeight - 200 }   // After boss (reward on ground)
        ];

        relicPositions.forEach(pos => {
            this.createRelic(pos.x, pos.y);
        });

        // Set up collectible overlaps
        this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);

        console.log(`[CrystalCavesLevel] Created ${this.collectibles.getLength()} collectibles`);
    }

    /**
     * Create a cosmic coin
     */
    createCoin(x, y) {
        // Use existing cosmic coin texture if available
        let textureKey = 'cosmicCoin';
        if (!this.textures.exists(textureKey)) {
            if (this.graphicsEngine) {
                this.graphicsEngine.createCosmicCoin();
            } else {
                // Fallback simple coin
                const graphics = this.make.graphics({ add: false });
                graphics.fillStyle(0xFFD700, 1);
                graphics.fillCircle(12, 12, 10);
                graphics.fillStyle(0xFFA500, 1);
                graphics.fillCircle(12, 12, 6);
                graphics.generateTexture(textureKey, 24, 24);
                graphics.destroy();
            }
        }

        const coin = this.collectibles.create(x, y, textureKey);
        coin.body.setAllowGravity(false);
        coin.collectibleType = 'coin';
        coin.value = 10;

        // Floating animation
        this.tweens.add({
            targets: coin,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return coin;
    }

    /**
     * Create an ancient relic
     */
    createRelic(x, y) {
        const textureKey = 'ancientRelic';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Glow
            graphics.fillStyle(0xE040FB, 0.3);
            graphics.fillCircle(20, 20, 18);

            // Crystal relic shape
            graphics.fillStyle(0xE040FB, 0.9);
            graphics.fillTriangle(10, 30, 30, 30, 20, 5);

            // Inner glow
            graphics.fillStyle(0xFFFFFF, 0.6);
            graphics.fillTriangle(15, 25, 25, 25, 20, 12);

            graphics.generateTexture(textureKey, 40, 40);
            graphics.destroy();
        }

        const relic = this.collectibles.create(x, y, textureKey);
        relic.body.setAllowGravity(false);
        relic.collectibleType = 'relic';

        // Pulsing glow animation
        this.tweens.add({
            targets: relic,
            alpha: { from: 0.7, to: 1 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return relic;
    }

    /**
     * Handle collecting an item
     */
    collectItem(player, item) {
        if (item.collectibleType === 'coin') {
            // Add coins
            const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
            window.GameState?.set('player.cosmicCoins', currentCoins + item.value);

            // Floating text
            this.showFloatingText(`+${item.value}`, item.x, item.y, '#FFD700');

            // Sound
            if (window.AudioManager) {
                window.AudioManager.playCoinCollect();
            }

        } else if (item.collectibleType === 'relic') {
            this.relicsCollected++;

            // Celebration effect
            this.showFloatingText(`Relic ${this.relicsCollected}/${this.totalRelics}`, item.x, item.y - 30, '#E040FB');

            // Particle burst
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, item.x, item.y, {
                    count: 20,
                    color: [0xE040FB, 0x7B68EE, 0x00FFFF],
                    duration: 1500
                });
            }

            // Sound
            if (window.AudioManager) {
                window.AudioManager.playAchievement();
            }

            // Check if all relics collected
            if (this.relicsCollected >= this.totalRelics) {
                this.showFloatingText('All Relics Found!', player.x, player.y - 80, '#00FFFF');
            }
        }

        // Destroy collected item
        item.destroy();
    }

    /**
     * Show floating text animation
     */
    showFloatingText(text, x, y, color = '#FFFFFF') {
        const floatText = this.add.text(x, y, text, {
            fontSize: '20px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: floatText,
            y: y - 60,
            alpha: 0,
            duration: 1200,
            onComplete: () => floatText.destroy()
        });
    }

    /**
     * Create atmospheric cave elements
     */
    createAtmosphere() {
        // Start eerie crystal cave ambient audio
        if (window.AudioManager && window.AudioManager.startCrystalCaveAmbient) {
            this.ambientAudio = window.AudioManager.startCrystalCaveAmbient(this);
            console.log('[CrystalCavesLevel] Started eerie crystal cave ambient audio');
        }

        // Glowing crystals in background
        const crystalPositions = [
            { x: 200, y: this.levelHeight - 400, size: 40 },
            { x: 700, y: this.levelHeight - 500, size: 30 },
            { x: 1100, y: this.levelHeight - 350, size: 35 },
            { x: 1500, y: this.levelHeight - 550, size: 45 },
            { x: 1900, y: this.levelHeight - 400, size: 30 },
            { x: 2300, y: this.levelHeight - 600, size: 40 },
            { x: 2700, y: this.levelHeight - 450, size: 35 },
            { x: 3100, y: this.levelHeight - 500, size: 30 },
            { x: 3500, y: this.levelHeight - 400, size: 40 },
            { x: 4000, y: this.levelHeight - 550, size: 50 },
            { x: 4400, y: this.levelHeight - 400, size: 35 }
        ];

        crystalPositions.forEach(pos => {
            this.createBackgroundCrystal(pos.x, pos.y, pos.size);
        });
    }

    /**
     * Create a glowing background crystal
     */
    createBackgroundCrystal(x, y, size) {
        const crystal = this.add.graphics();
        const color = Phaser.Math.RND.pick([0x7B68EE, 0x00FFFF, 0xE040FB]);

        // Outer glow
        crystal.fillStyle(color, 0.2);
        crystal.fillCircle(0, 0, size * 1.5);

        // Middle glow
        crystal.fillStyle(color, 0.4);
        crystal.fillCircle(0, 0, size);

        // Crystal shape
        crystal.fillStyle(color, 0.8);
        crystal.fillTriangle(-size / 3, size / 2, size / 3, size / 2, 0, -size / 2);

        crystal.setPosition(x, y);
        crystal.setDepth(-10);  // Behind platforms

        // Pulse animation
        this.tweens.add({
            targets: crystal,
            alpha: { from: 0.5, to: 0.9 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: Phaser.Math.Between(2000, 3500),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Create the Crystal Heart (level goal)
     */
    createCrystalHeart() {
        // Position above the final stepped platform (4750, levelHeight - 480)
        const heartX = 4850;
        const heartY = this.levelHeight - 530;

        // Create heart texture
        const textureKey = 'crystalHeart';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Outer glow
            graphics.fillStyle(0x00FFFF, 0.3);
            graphics.fillCircle(40, 40, 35);

            // Heart shape (stylized crystal heart)
            graphics.fillStyle(0x00FFFF, 0.9);
            graphics.fillCircle(30, 30, 15);
            graphics.fillCircle(50, 30, 15);
            graphics.fillTriangle(15, 35, 65, 35, 40, 70);

            // Inner glow
            graphics.fillStyle(0xFFFFFF, 0.6);
            graphics.fillCircle(35, 35, 8);

            graphics.generateTexture(textureKey, 80, 80);
            graphics.destroy();
        }

        this.crystalHeart = this.physics.add.staticSprite(heartX, heartY, textureKey);
        this.crystalHeart.setDepth(50);

        // Pulsing animation
        this.tweens.add({
            targets: this.crystalHeart,
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            alpha: { from: 0.8, to: 1 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Overlap for collection - triggers boss fight
        this.physics.add.overlap(this.player, this.crystalHeart, () => {
            if (!this.crystalHeartFound && !this.bossFightActive) {
                this.crystalHeartFound = true;
                this.startBossFight();
            }
        });
    }

    /**
     * Start the Crystal Golem boss fight
     */
    startBossFight() {
        console.log('[CrystalCavesLevel] Starting Crystal Golem boss fight!');
        this.bossFightActive = true;

        // Dramatic pause
        this.physics.pause();

        // Flash warning
        this.cameras.main.flash(500, 150, 0, 200);

        // Warning text
        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, '⚠ THE GUARDIAN AWAKENS ⚠', {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        // Fade in warning
        this.tweens.add({
            targets: warningText,
            alpha: 1,
            duration: 500,
            yoyo: true,
            hold: 1500,
            onComplete: () => {
                warningText.destroy();
                this.triggerAtmosphereChange();
            }
        });

        // Play ominous sound
        if (window.AudioManager) {
            window.AudioManager.playError(); // Dramatic low tone
        }
    }

    /**
     * Change atmosphere to spooky for boss fight
     */
    triggerAtmosphereChange() {
        const { width, height } = this.cameras.main;

        // Create darkness overlay that follows camera
        this.bossOverlay = this.add.graphics();
        this.bossOverlay.fillStyle(0x1A0A2E, 0.4);
        this.bossOverlay.fillRect(0, 0, width, height);
        this.bossOverlay.setScrollFactor(0);
        this.bossOverlay.setDepth(100);
        this.bossOverlay.setAlpha(0);

        // Fade in darkness
        this.tweens.add({
            targets: this.bossOverlay,
            alpha: 1,
            duration: 1000
        });

        // Camera zoom for intensity
        this.cameras.main.zoomTo(1.1, 1000);

        // Shake the ground
        this.cameras.main.shake(1500, 0.015);

        // After atmosphere change, spawn the boss
        this.time.delayedCall(1500, () => {
            this.spawnCrystalGolem();
            this.physics.resume();
        });
    }

    /**
     * Create the Crystal Golem boss texture
     */
    createCrystalGolemTexture() {
        const textureKey = 'crystalGolem';
        if (this.textures.exists(textureKey)) return textureKey;

        const graphics = this.make.graphics({ add: false });
        const size = 120;

        // Outer glow (menacing purple)
        graphics.fillStyle(0x8B008B, 0.3);
        graphics.fillCircle(size / 2, size / 2, size / 2);

        // Main body (dark crystalline)
        graphics.fillStyle(0x2D1B4E, 1);
        // Body - hexagonal rock shape
        graphics.fillTriangle(size / 2, 10, 20, 50, size - 20, 50); // Head
        graphics.fillRect(25, 50, size - 50, 50); // Torso
        graphics.fillTriangle(20, 100, size - 20, 100, size / 2, size - 5); // Legs

        // Crystal formations on body
        const crystalColors = [0x7B68EE, 0x9370DB, 0xE040FB, 0x00FFFF];

        // Shoulder crystals
        graphics.fillStyle(crystalColors[0], 0.9);
        graphics.fillTriangle(15, 55, 5, 75, 25, 75);
        graphics.fillTriangle(size - 15, 55, size - 5, 75, size - 25, 75);

        // Chest crystal
        graphics.fillStyle(crystalColors[2], 0.9);
        graphics.fillTriangle(size / 2 - 15, 60, size / 2 + 15, 60, size / 2, 85);

        // Inner glow for chest crystal
        graphics.fillStyle(0xFFFFFF, 0.5);
        graphics.fillTriangle(size / 2 - 8, 65, size / 2 + 8, 65, size / 2, 78);

        // Glowing eyes (menacing red-orange)
        graphics.fillStyle(0xFF4500, 1);
        graphics.fillCircle(40, 35, 8);
        graphics.fillCircle(80, 35, 8);

        // Eye pupils (darker center)
        graphics.fillStyle(0x8B0000, 1);
        graphics.fillCircle(42, 35, 4);
        graphics.fillCircle(82, 35, 4);

        // Eye glow
        graphics.fillStyle(0xFF6B00, 0.5);
        graphics.fillCircle(40, 35, 12);
        graphics.fillCircle(80, 35, 12);

        // Crystal crown/horns
        graphics.fillStyle(crystalColors[1], 0.9);
        graphics.fillTriangle(30, 15, 25, 0, 35, 15);
        graphics.fillTriangle(size / 2, 10, size / 2 - 5, -5, size / 2 + 5, 10);
        graphics.fillTriangle(size - 30, 15, size - 25, 0, size - 35, 15);

        // Arm crystals
        graphics.fillStyle(crystalColors[3], 0.8);
        graphics.fillTriangle(10, 70, 0, 90, 20, 90);
        graphics.fillTriangle(size - 10, 70, size, 90, size - 20, 90);

        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();

        return textureKey;
    }

    /**
     * Spawn the Crystal Golem boss
     */
    spawnCrystalGolem() {
        console.log('[CrystalCavesLevel] Spawning Crystal Golem!');

        // Create boss texture
        const textureKey = this.createCrystalGolemTexture();

        // Spawn position - center of boss arena (section 5)
        const spawnX = 4300;
        const spawnY = this.levelHeight - 180;

        // Create boss sprite
        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.boss.body.setSize(80, 100);
        this.boss.body.setOffset(20, 20);

        // Initialize boss state
        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.boss.isAttacking = false;
        this.boss.facingRight = false;
        this.boss.patrolDirection = -1;

        // Boss collision with platforms
        this.physics.add.collider(this.boss, this.platforms);

        // Boss collision with player
        this.physics.add.collider(this.player, this.boss, this.onBossCollision, null, this);

        // Spawn animation - rise from ground
        this.boss.setAlpha(0);
        this.boss.setScale(0.5);
        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                // Settle to normal size
                this.tweens.add({
                    targets: this.boss,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 300
                });
            }
        });

        // Create boss health bar
        this.createBossHealthBar();

        // Start boss AI
        this.startBossAI();

        // Ground slam effect
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, spawnX, spawnY + 50, {
                count: 30,
                color: [0x7B68EE, 0x9370DB, 0x2D1B4E],
                duration: 1500
            });
        }

        // Roar sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Create boss health bar UI
     */
    createBossHealthBar() {
        const { width } = this.cameras.main;
        const barWidth = 300;
        const barHeight = 20;
        const barX = (width - barWidth) / 2;
        const barY = 80;

        // Container for boss UI
        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        // Boss name
        this.bossNameText = this.add.text(width / 2, barY - 25, 'CRYSTAL GOLEM', {
            fontSize: '18px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        // Health bar background
        const barBg = this.add.graphics();
        barBg.fillStyle(0x1A1025, 1);
        barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);
        barBg.lineStyle(2, 0x7B68EE, 1);
        barBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 5);
        this.bossUI.add(barBg);

        // Health bar fill
        this.bossHealthBar = this.add.graphics();
        this.updateBossHealthBar();
        this.bossUI.add(this.bossHealthBar);
    }

    /**
     * Update boss health bar display
     */
    updateBossHealthBar() {
        if (!this.bossHealthBar) return;

        const { width } = this.cameras.main;
        const barWidth = 300;
        const barHeight = 20;
        const barX = (width - barWidth) / 2;
        const barY = 80;

        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const fillWidth = (barWidth - 6) * healthPercent;

        this.bossHealthBar.clear();

        // Health fill color based on health
        let fillColor = 0xFF4500; // Orange-red
        if (healthPercent > 0.5) {
            fillColor = 0x7B68EE; // Purple when healthy
        } else if (healthPercent > 0.25) {
            fillColor = 0xFFA500; // Orange when damaged
        }

        this.bossHealthBar.fillStyle(fillColor, 1);
        this.bossHealthBar.fillRoundedRect(barX + 3, barY + 3, fillWidth, barHeight - 6, 3);
    }

    /**
     * Start boss AI behavior
     */
    startBossAI() {
        // Main AI update loop
        this.bossAITimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updateBossAI(),
            loop: true
        });

        // Attack timer
        this.bossAttackTimer = this.time.addEvent({
            delay: 2500,
            callback: () => this.bossPerformAttack(),
            loop: true
        });
    }

    /**
     * Update boss AI movement and behavior
     */
    updateBossAI() {
        if (!this.boss || !this.boss.active || !this.player) return;

        const distToPlayer = Phaser.Math.Distance.Between(
            this.boss.x, this.boss.y,
            this.player.x, this.player.y
        );

        // Face player
        if (this.player.x < this.boss.x) {
            this.boss.facingRight = false;
            this.boss.setFlipX(false);
        } else {
            this.boss.facingRight = true;
            this.boss.setFlipX(true);
        }

        // Movement based on distance to player
        if (!this.boss.isAttacking) {
            if (distToPlayer > 150) {
                // Move towards player
                const speed = this.bossPhase >= 2 ? 120 : 80;
                const direction = this.player.x < this.boss.x ? -1 : 1;
                this.boss.setVelocityX(speed * direction);
            } else if (distToPlayer < 80) {
                // Too close, back up slightly
                const direction = this.player.x < this.boss.x ? 1 : -1;
                this.boss.setVelocityX(40 * direction);
            } else {
                // In attack range, slow down
                this.boss.setVelocityX(this.boss.body.velocity.x * 0.9);
            }
        }

        // Phase 2 behavior (below 50% health)
        if (this.bossHealth <= this.bossMaxHealth * 0.5 && this.bossPhase === 1) {
            this.triggerPhase2();
        }
    }

    /**
     * Trigger boss phase 2 (enraged)
     */
    triggerPhase2() {
        console.log('[CrystalCavesLevel] Boss entering phase 2!');
        this.bossPhase = 2;

        // Visual feedback
        this.cameras.main.shake(500, 0.02);
        this.boss.setTint(0xFF6B6B);

        // Flash warning
        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, 'GOLEM ENRAGED!', {
            fontSize: '28px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 50,
            duration: 1500,
            onComplete: () => phaseText.destroy()
        });

        // Speed up attack timer
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }
        this.bossAttackTimer = this.time.addEvent({
            delay: 1800,
            callback: () => this.bossPerformAttack(),
            loop: true
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    /**
     * Boss performs an attack
     */
    bossPerformAttack() {
        if (!this.boss || !this.boss.active || this.boss.isAttacking) return;

        const attackType = Phaser.Math.Between(1, this.bossPhase >= 2 ? 3 : 2);

        this.boss.isAttacking = true;
        this.boss.setVelocityX(0);

        switch (attackType) {
            case 1:
                this.bossGroundSlam();
                break;
            case 2:
                this.bossCrystalBarrage();
                break;
            case 3:
                this.bossChargeAttack();
                break;
        }

        // End attack state after a delay
        this.time.delayedCall(1200, () => {
            if (this.boss) this.boss.isAttacking = false;
        });
    }

    /**
     * Boss attack: Ground Slam - creates shockwave
     */
    bossGroundSlam() {
        console.log('[CrystalCavesLevel] Boss: Ground Slam!');

        // Wind-up animation
        this.tweens.add({
            targets: this.boss,
            y: this.boss.y - 40,
            duration: 400,
            yoyo: true,
            onYoyo: () => {
                // Slam down
                this.cameras.main.shake(300, 0.03);

                // Create shockwave
                const shockwave = this.add.graphics();
                shockwave.fillStyle(0x7B68EE, 0.6);
                shockwave.fillRect(-200, -10, 400, 20);
                shockwave.setPosition(this.boss.x, this.boss.y + 50);
                shockwave.setDepth(850);

                this.tweens.add({
                    targets: shockwave,
                    scaleX: 2,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => shockwave.destroy()
                });

                // Damage player if in range and on ground
                if (this.player && this.isGrounded) {
                    const dist = Math.abs(this.player.x - this.boss.x);
                    if (dist < 250) {
                        this.takeDamage(1);
                    }
                }

                // Sound
                if (window.AudioManager) {
                    window.AudioManager.playAttack();
                }
            }
        });
    }

    /**
     * Boss attack: Crystal Barrage - shoots crystals
     */
    bossCrystalBarrage() {
        console.log('[CrystalCavesLevel] Boss: Crystal Barrage!');

        const crystalCount = this.bossPhase >= 2 ? 5 : 3;

        for (let i = 0; i < crystalCount; i++) {
            this.time.delayedCall(i * 200, () => {
                if (!this.boss || !this.boss.active) return;

                // Create crystal projectile
                const crystal = this.add.graphics();
                crystal.fillStyle(0xE040FB, 0.9);
                crystal.fillTriangle(-10, 15, 10, 15, 0, -15);
                crystal.setPosition(this.boss.x, this.boss.y - 20);
                crystal.setDepth(860);

                // Add to physics for collision
                const crystalBody = this.physics.add.existing(crystal);
                crystal.body.setAllowGravity(false);
                crystal.body.setSize(20, 30);

                // Aim at player with some spread
                const angle = Phaser.Math.Angle.Between(
                    this.boss.x, this.boss.y,
                    this.player.x, this.player.y
                ) + Phaser.Math.FloatBetween(-0.3, 0.3);

                const speed = 300;
                crystal.body.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );

                // Rotate crystal to face direction
                crystal.setRotation(angle + Math.PI / 2);

                // Player collision
                this.physics.add.overlap(this.player, crystal, () => {
                    this.takeDamage(1);
                    crystal.destroy();
                });

                // Destroy after time
                this.time.delayedCall(2000, () => {
                    if (crystal.active) crystal.destroy();
                });
            });
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Boss attack: Charge Attack (Phase 2 only)
     */
    bossChargeAttack() {
        console.log('[CrystalCavesLevel] Boss: Charge Attack!');

        // Telegraph with glow
        this.boss.setTint(0xFF0000);

        // Wind-up
        this.time.delayedCall(500, () => {
            if (!this.boss || !this.boss.active) return;

            // Charge towards player
            const direction = this.player.x < this.boss.x ? -1 : 1;
            this.boss.setVelocityX(400 * direction);

            // Trail effect
            const trail = this.time.addEvent({
                delay: 50,
                callback: () => {
                    if (!this.boss || !this.boss.active) return;
                    const afterImage = this.add.graphics();
                    afterImage.fillStyle(0x7B68EE, 0.4);
                    afterImage.fillCircle(0, 0, 40);
                    afterImage.setPosition(this.boss.x, this.boss.y);
                    afterImage.setDepth(870);

                    this.tweens.add({
                        targets: afterImage,
                        alpha: 0,
                        scaleX: 0.5,
                        scaleY: 0.5,
                        duration: 300,
                        onComplete: () => afterImage.destroy()
                    });
                },
                repeat: 8
            });

            // Stop after duration
            this.time.delayedCall(600, () => {
                if (this.boss) {
                    this.boss.setVelocityX(0);
                    this.boss.clearTint();
                    if (this.bossPhase >= 2) {
                        this.boss.setTint(0xFF6B6B);
                    }
                }
            });
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Handle player collision with boss
     */
    onBossCollision(player, boss) {
        // Check if jumping on boss head
        if (player.body.velocity.y > 0 && player.y < boss.y - 30) {
            this.damageBoss(1);
            player.setVelocityY(this.jumpVelocity * 0.7);
        } else {
            // Player takes damage
            this.takeDamage(1);
        }
    }

    /**
     * Damage the boss
     */
    damageBoss(amount) {
        if (!this.boss || !this.boss.active) return;

        this.bossHealth -= amount;
        this.updateBossHealthBar();

        // Flash effect
        this.boss.setTint(0xFFFFFF);
        this.time.delayedCall(100, () => {
            if (this.boss && this.boss.active) {
                if (this.bossPhase >= 2) {
                    this.boss.setTint(0xFF6B6B);
                } else {
                    this.boss.clearTint();
                }
            }
        });

        // Knockback boss slightly
        const knockDir = this.player.x < this.boss.x ? 1 : -1;
        this.boss.setVelocityX(100 * knockDir);

        // Particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, this.boss.x, this.boss.y, {
                count: 10,
                color: [0x7B68EE, 0xE040FB],
                duration: 800
            });
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        // Check for defeat
        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }
    }

    /**
     * Handle boss defeat
     */
    onBossDefeated() {
        console.log('[CrystalCavesLevel] Crystal Golem defeated!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        // Stop boss AI
        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }

        // Boss death animation
        this.boss.setVelocity(0, 0);
        this.boss.body.setAllowGravity(false);

        // Screen shake
        this.cameras.main.shake(1000, 0.04);

        // Explosion of crystals
        for (let i = 0; i < 8; i++) {
            this.time.delayedCall(i * 100, () => {
                if (window.FXLibrary && this.boss) {
                    const offsetX = Phaser.Math.Between(-40, 40);
                    const offsetY = Phaser.Math.Between(-50, 30);
                    window.FXLibrary.stardustBurst(this, this.boss.x + offsetX, this.boss.y + offsetY, {
                        count: 15,
                        color: [0x7B68EE, 0xE040FB, 0x00FFFF, 0xFFD700],
                        duration: 1200
                    });
                }
            });
        }

        // Fade out boss
        this.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 1500,
            onComplete: () => {
                if (this.boss) this.boss.destroy();
            }
        });

        // Victory sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Hide boss UI
        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    this.bossUI.destroy();
                }
            });
        }

        // Remove darkness overlay
        if (this.bossOverlay) {
            this.tweens.add({
                targets: this.bossOverlay,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    this.bossOverlay.destroy();
                }
            });
        }

        // Reset camera zoom
        this.cameras.main.zoomTo(1.0, 1000);

        // Victory message and level complete
        this.time.delayedCall(2000, () => {
            this.showBossVictory();
        });
    }

    /**
     * Show boss victory screen before level complete
     */
    showBossVictory() {
        const { width, height } = this.cameras.main;

        // Victory text
        const victoryText = this.add.text(width / 2, height / 2, '💎 CRYSTAL GOLEM DEFEATED 💎', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 500,
            yoyo: true,
            hold: 2000,
            onComplete: () => {
                victoryText.destroy();
                this.onLevelComplete();
            }
        });

        // Celebration particles
        for (let i = 0; i < 5; i++) {
            this.time.delayedCall(i * 300, () => {
                if (window.FXLibrary) {
                    const x = Phaser.Math.Between(100, width - 100);
                    window.FXLibrary.stardustBurst(this, x + this.cameras.main.scrollX, height / 2, {
                        count: 20,
                        color: [0xFFD700, 0x7B68EE, 0x00FFFF],
                        duration: 2000
                    });
                }
            });
        }
    }

    /**
     * Handle level completion
     */
    onLevelComplete() {
        console.log('[CrystalCavesLevel] Level complete!');

        // Pause gameplay
        this.physics.pause();

        // Celebration effects
        this.cameras.main.flash(500, 0, 255, 255);

        if (window.FXLibrary) {
            for (let i = 0; i < 5; i++) {
                this.time.delayedCall(i * 200, () => {
                    window.FXLibrary.stardustBurst(this, this.crystalHeart.x, this.crystalHeart.y, {
                        count: 30,
                        color: [0x00FFFF, 0x7B68EE, 0xE040FB, 0xFFD700],
                        duration: 2000
                    });
                });
            }
        }

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Show completion screen after celebration
        this.time.delayedCall(1500, () => {
            this.showCompletionScreen();
        });
    }

    /**
     * Show level completion screen
     */
    showCompletionScreen() {
        const { width, height } = this.cameras.main;

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel
        const panelWidth = 450;
        const panelHeight = 400;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1025, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x00FFFF, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Title
        const title = this.add.text(width / 2, panelY + 50, 'LEVEL COMPLETE', {
            fontSize: '36px',
            color: '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x7B68EE, 0.5);
        divider.lineBetween(panelX + 40, panelY + 90, panelX + panelWidth - 40, panelY + 90);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Results
        const resultY = panelY + 120;
        const results = [
            { text: 'Crystal Heart Found', done: true },
            { text: `Ancient Relics: ${this.relicsCollected}/${this.totalRelics}`, done: this.relicsCollected >= this.totalRelics },
            { text: 'Crystal Golem Defeated', done: this.bossDefeated }
        ];

        results.forEach((result, i) => {
            const icon = result.done ? '[x]' : '[ ]';
            const color = result.done ? '#00FF00' : '#888888';
            this.add.text(panelX + 60, resultY + i * 35, `${icon} ${result.text}`, {
                fontSize: '18px',
                color: color
            }).setScrollFactor(0).setDepth(3002);
        });

        // Rewards
        const rewardY = resultY + 130;
        this.add.text(width / 2, rewardY, 'REWARDS', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const coins = 500 + (this.relicsCollected * 100);
        this.add.text(width / 2, rewardY + 30, `+ ${coins} Cosmic Coins`, {
            fontSize: '22px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Award coins
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
        window.GameState?.set('player.cosmicCoins', currentCoins + coins);

        // Return button
        const returnBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ RETURN TO SANCTUARY ]', {
            fontSize: '20px',
            color: '#7B68EE',
            backgroundColor: '#2D1B3D',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        returnBtn.on('pointerover', () => {
            returnBtn.setColor('#E040FB');
            returnBtn.setScale(1.05);
        });
        returnBtn.on('pointerout', () => {
            returnBtn.setColor('#7B68EE');
            returnBtn.setScale(1.0);
        });
        returnBtn.on('pointerdown', () => {
            this.returnToSanctuary();
        });
    }

    /**
     * Override parent HUD to add objective tracking
     */
    createHUD() {
        super.createHUD();

        // Objective display (bottom right)
        const { width, height } = this.cameras.main;
        this.objectiveDisplay = this.add.text(width - 20, height - 30, `Relics: ${this.relicsCollected}/${this.totalRelics}`, {
            fontSize: '16px',
            color: '#9370DB',
            backgroundColor: 'rgba(26, 16, 37, 0.7)',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(1000);
    }

    /**
     * Override update to refresh objective display
     */
    update(time, delta) {
        super.update(time, delta);

        // Update objective display
        if (this.objectiveDisplay) {
            this.objectiveDisplay.setText(`Relics: ${this.relicsCollected}/${this.totalRelics}`);
        }
    }

    /**
     * Clean up boss resources on shutdown
     */
    shutdown() {
        console.log('[CrystalCavesLevel] Shutting down - cleaning up boss resources');

        // Stop ambient audio
        if (this.ambientAudio && this.ambientAudio.stop) {
            this.ambientAudio.stop();
            this.ambientAudio = null;
        }

        // Stop boss AI timers
        if (this.bossAITimer) {
            this.bossAITimer.remove();
            this.bossAITimer = null;
        }
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
            this.bossAttackTimer = null;
        }

        // Destroy boss
        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }

        // Destroy boss UI
        if (this.bossUI) {
            this.bossUI.destroy();
            this.bossUI = null;
        }
        if (this.bossHealthBar) {
            this.bossHealthBar.destroy();
            this.bossHealthBar = null;
        }
        if (this.bossNameText) {
            this.bossNameText.destroy();
            this.bossNameText = null;
        }

        // Destroy boss overlay
        if (this.bossOverlay) {
            this.bossOverlay.destroy();
            this.bossOverlay = null;
        }

        // Destroy crystal heart
        if (this.crystalHeart) {
            this.crystalHeart.destroy();
            this.crystalHeart = null;
        }

        // Destroy objective display
        if (this.objectiveDisplay) {
            this.objectiveDisplay.destroy();
            this.objectiveDisplay = null;
        }

        // Call parent shutdown for base cleanup
        super.shutdown();

        console.log('[CrystalCavesLevel] Boss cleanup complete');
    }
}

// Export
export default CrystalCavesLevel;

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.CrystalCavesLevel = CrystalCavesLevel;
}
