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

        // Enemy spawns
        this.enemySpawns = [];
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
        this.enemySpawns = [];

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
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // Ground - but with gaps for challenge
        this.createPlatform(0, this.levelHeight - 50, 800, 80, 'solid');
        this.createPlatform(900, this.levelHeight - 50, 600, 80, 'solid');
        this.createPlatform(1600, this.levelHeight - 50, 500, 80, 'solid');
        this.createPlatform(2200, this.levelHeight - 50, 800, 80, 'solid');
        this.createPlatform(3100, this.levelHeight - 50, 600, 80, 'solid');
        this.createPlatform(3800, this.levelHeight - 50, 1200, 80, 'solid');  // Boss arena floor

        // ===== SECTION 1: Introduction (0-1000px) =====
        // Safe learning area
        this.createPlatform(100, this.levelHeight - 180, 250, 25, 'solid');
        this.createPlatform(400, this.levelHeight - 280, 200, 25, 'solid');
        this.createPlatform(650, this.levelHeight - 180, 150, 25, 'solid');

        // ===== SECTION 2: First Challenge (1000-2000px) =====
        // Platforms over gap
        this.createPlatform(850, this.levelHeight - 250, 120, 20, 'one-way');
        this.createPlatform(1050, this.levelHeight - 350, 150, 25, 'solid');
        this.createPlatform(1250, this.levelHeight - 280, 180, 25, 'solid');
        this.createPlatform(1500, this.levelHeight - 200, 100, 20, 'one-way');

        // Secret alcove hint (higher platform leading to hidden area)
        this.createPlatform(1100, this.levelHeight - 500, 100, 20, 'one-way');
        this.createPlatform(1300, this.levelHeight - 580, 150, 25, 'solid');  // Secret relic here

        // ===== SECTION 3: Vertical Chamber (2000-3000px) =====
        // Ascending platforms
        this.createPlatform(2100, this.levelHeight - 200, 200, 25, 'solid');
        this.createPlatform(2350, this.levelHeight - 320, 180, 25, 'solid');
        this.createPlatform(2150, this.levelHeight - 440, 150, 25, 'solid');
        this.createPlatform(2400, this.levelHeight - 540, 200, 25, 'solid');
        this.createPlatform(2200, this.levelHeight - 650, 180, 25, 'solid');

        // Side path with secret
        this.createPlatform(2700, this.levelHeight - 280, 150, 25, 'solid');
        this.createPlatform(2900, this.levelHeight - 380, 120, 20, 'one-way');
        this.createPlatform(2750, this.levelHeight - 500, 200, 25, 'solid');  // Relic here

        // ===== SECTION 4: Descent to Boss (3000-4000px) =====
        this.createPlatform(3050, this.levelHeight - 550, 150, 25, 'solid');
        this.createPlatform(3250, this.levelHeight - 450, 180, 25, 'solid');
        this.createPlatform(3100, this.levelHeight - 320, 120, 20, 'one-way');
        this.createPlatform(3350, this.levelHeight - 200, 200, 25, 'solid');
        this.createPlatform(3600, this.levelHeight - 280, 150, 25, 'solid');

        // ===== SECTION 5: Boss Arena (4000-5000px) =====
        // Elevated platforms for boss fight tactics
        this.createPlatform(4000, this.levelHeight - 250, 200, 25, 'solid');
        this.createPlatform(4300, this.levelHeight - 350, 150, 25, 'solid');
        this.createPlatform(4550, this.levelHeight - 250, 200, 25, 'solid');

        // Crystal Heart platform (end goal)
        this.createPlatform(4700, this.levelHeight - 500, 180, 30, 'solid');

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
     */
    createEnemies() {
        this.enemies = this.physics.add.group();

        // Shadow Bats - flutter patrol
        this.createShadowBat(600, this.levelHeight - 350);
        this.createShadowBat(1200, this.levelHeight - 400);
        this.createShadowBat(1800, this.levelHeight - 300);
        this.createShadowBat(2500, this.levelHeight - 450);
        this.createShadowBat(3300, this.levelHeight - 380);

        // Cave Crawlers - ground patrol
        this.createCaveCrawler(500, this.levelHeight - 100);
        this.createCaveCrawler(1400, this.levelHeight - 100);
        this.createCaveCrawler(2600, this.levelHeight - 100);
        this.createCaveCrawler(3500, this.levelHeight - 100);

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
     */
    createCollectibles() {
        this.collectibles = this.physics.add.group();

        // Cosmic coins throughout level
        const coinPositions = [
            { x: 300, y: this.levelHeight - 220 },
            { x: 500, y: this.levelHeight - 320 },
            { x: 1100, y: this.levelHeight - 400 },
            { x: 1600, y: this.levelHeight - 250 },
            { x: 2200, y: this.levelHeight - 250 },
            { x: 2400, y: this.levelHeight - 580 },
            { x: 2900, y: this.levelHeight - 430 },
            { x: 3400, y: this.levelHeight - 250 },
            { x: 4200, y: this.levelHeight - 400 }
        ];

        coinPositions.forEach(pos => {
            this.createCoin(pos.x, pos.y);
        });

        // Ancient Relics (5 total for secondary objective)
        const relicPositions = [
            { x: 1300, y: this.levelHeight - 620 },  // Secret alcove
            { x: 2750, y: this.levelHeight - 540 },  // Side path
            { x: 2200, y: this.levelHeight - 690 },  // Top of chamber
            { x: 3600, y: this.levelHeight - 320 },  // Before boss
            { x: 4800, y: this.levelHeight - 200 }   // After boss (reward)
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
        const heartX = 4700;
        const heartY = this.levelHeight - 550;

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

        // Overlap for collection
        this.physics.add.overlap(this.player, this.crystalHeart, () => {
            if (!this.crystalHeartFound) {
                this.crystalHeartFound = true;
                this.onLevelComplete();
            }
        });
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
}

// Export
export default CrystalCavesLevel;

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.CrystalCavesLevel = CrystalCavesLevel;
}
