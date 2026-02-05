import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * ReefLevel - The Cosmic Abyss (Stellar Reef) underwater level
 *
 * Story: "The Stellar Reef exists between dimensions - a luminous void where cosmic
 * energy flows like water. Ancient star-travelers built waypoints here, but the
 * Void Incursion twisted this realm. Strange entities now drift through the ethereal
 * currents, and the ancient guardian Nyx'voral - a serpentine being of pure void
 * energy - has become corrupted, blocking passage through this critical route.
 *
 * A piece of your crashed ship's Dimensional Drive lies somewhere in this realm.
 * Recover it, collect the Star Fragments, and defeat Nyx'voral to restore
 * the cosmic passage."
 *
 * Objectives:
 * - Primary: Defeat Nyx'voral the Void Serpent
 * - Critical: Recover the Dimensional Drive Fragment (ship part)
 * - Secondary: Collect 5 Star Fragments
 */
class ReefLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'ReefLevel',
            levelId: 'reef_1',
            biomeId: 'stellar_reef',
            levelWidth: 6000,
            levelHeight: 1200
        });

        // Override physics for cosmic void swimming
        // TUNED: More responsive swimming with noticeable gravity
        this.gravityY = 150;           // Higher gravity - player sinks when not swimming
        this.playerSpeed = 200;        // Faster horizontal movement
        this.jumpVelocity = -320;      // Stronger swim thrust to counter gravity
        this.playerAcceleration = 0.18; // More responsive acceleration
        this.playerDeceleration = 0.94; // Drifty momentum
        this.swimDrag = 0.90;          // Faster velocity decay when not actively swimming
        this.swimAcceleration = 0.20;  // How quickly swim velocity builds

        // Swimming physics - player should noticeably sink when not swimming
        this.sinkSpeed = 60;           // Faster sink rate
        this.maxSinkSpeed = 180;       // Higher max sink speed

        // Level-specific state
        this.starFragmentsCollected = 0;
        this.totalStarFragments = 5;
        this.shipPartCollected = false;
        this.bossDefeated = false;
        this.bossFightActive = false;

        // Boss state - Nyx'voral the Void Serpent
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 15;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossMinions = [];

        // Cosmic enemy types
        this.voidSpores = [];      // Replaces pufferfish - crystalline void organisms
        this.plasmaDarts = [];     // Replaces barracuda - fast energy projectiles
        this.phaseDrifters = [];   // Replaces jellyfish - ethereal phase beings
        this.lureWraiths = [];     // Replaces anglerfish - void predators

        // Collectibles
        this.starFragments = [];
        this.shipPart = null;
        this.cosmicEggAwarded = false;

        // Cosmic effects
        this.nebulaParticles = [];
        this.voidRifts = [];
        this.starfieldLayer = null;
    }

    init(data) {
        super.init(data);

        // Reset level state
        this.starFragmentsCollected = 0;
        this.shipPartCollected = false;
        this.bossDefeated = false;
        this.bossFightActive = false;
        this.cosmicEggAwarded = false;

        // Reset boss
        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossMinions = [];

        // Reset enemies
        this.voidSpores = [];
        this.plasmaDarts = [];
        this.phaseDrifters = [];
        this.lureWraiths = [];

        // Reset collectibles
        this.starFragments = [];
        this.shipPart = null;

        console.log('[ReefLevel] Cosmic Abyss state reset');
    }

    create() {
        super.create();

        // Record level entry for achievements
        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'cosmicReef' });
        }

        // Track start time for speedrun achievements
        this.levelStartTime = Date.now();
        this.damageTaken = 0;

        this.showLevelEntry();
    }

    setupPlatformerPhysics() {
        this.physics.world.gravity.y = this.gravityY;
        console.log(`[ReefLevel] Cosmic void physics: gravity.y = ${this.gravityY}`);
    }

    /**
     * Show cosmic level entry screen
     */
    showLevelEntry() {
        const { width, height } = this.cameras.main;
        this.physics.pause();

        // Deep cosmic overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x0A0015, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Add floating stars to overlay
        for (let i = 0; i < 50; i++) {
            const starX = Math.random() * width;
            const starY = Math.random() * height;
            const starSize = 1 + Math.random() * 2;
            const starAlpha = 0.3 + Math.random() * 0.7;
            overlay.fillStyle(0xFFFFFF, starAlpha);
            overlay.fillCircle(starX, starY, starSize);
        }

        // Panel
        const panelWidth = Math.min(520, width - 40);
        const panelHeight = 480;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0D0020, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        // Cosmic purple border with glow
        panel.lineStyle(4, 0x9B30FF, 0.8);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(8, 0x9B30FF, 0.2);
        panel.strokeRoundedRect(panelX - 4, panelY - 4, panelWidth + 8, panelHeight + 8, 24);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Cosmic decorations
        this.addCosmicDecoration(panelX + 40, panelY + 40);
        this.addCosmicDecoration(panelX + panelWidth - 40, panelY + 40);

        // Title
        const title = this.add.text(width / 2, panelY + 55, '✧ THE COSMIC ABYSS ✧', {
            fontSize: '30px',
            color: '#E066FF',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Subtitle
        const subtitle = this.add.text(width / 2, panelY + 95,
            '"Where dimensions blur and void energy flows like water"', {
            fontSize: '13px',
            color: '#BA55D3',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Story text
        const storyText = this.add.text(width / 2, panelY + 150,
            'The Void Incursion corrupted this dimensional crossing.\n' +
            'Ancient star-beings drift in eternal confusion.\n' +
            'Nyx\'voral, the Void Serpent, guards the passage.\n\n' +
            'A fragment of your ship\'s Dimensional Drive is here.', {
            fontSize: '12px',
            color: '#9370DB',
            align: 'center',
            lineSpacing: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider with cosmic energy
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x9B30FF, 0.6);
        divider.lineBetween(panelX + 50, panelY + 210, panelX + panelWidth - 50, panelY + 210);
        // Add glow dots
        for (let i = 0; i < 5; i++) {
            const dotX = panelX + 50 + i * ((panelWidth - 100) / 4);
            divider.fillStyle(0xE066FF, 0.8);
            divider.fillCircle(dotX, panelY + 210, 3);
        }
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Objectives header
        const objHeader = this.add.text(width / 2, panelY + 235, 'MISSION OBJECTIVES', {
            fontSize: '14px',
            color: '#666688'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Primary objective
        const mainObj = this.add.text(width / 2, panelY + 265, '⚔️ Defeat Nyx\'voral the Void Serpent', {
            fontSize: '16px',
            color: '#FF6B9D',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Ship part objective (critical!)
        const shipObj = this.add.text(width / 2, panelY + 295, '🔧 Recover Dimensional Drive Fragment', {
            fontSize: '15px',
            color: '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Secondary objectives
        const relicObj = this.add.text(panelX + 60, panelY + 330, '✧ Collect Star Fragments (0/5)', {
            fontSize: '13px',
            color: '#AAAACC'
        }).setScrollFactor(0).setDepth(3002);

        // Controls hint - mobile-aware
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;
        const controlsHint = this.add.text(width / 2, panelY + 370,
            isMobile
                ? '📱 HOLD the JUMP button to swim upward!\nRelease to sink. Tap joystick to move.'
                : '🎮 HOLD ↑/W/SPACE to swim up • Release to sink', {
            fontSize: isMobile ? '13px' : '11px',
            color: '#9370DB',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Enter button
        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ ENTER THE ABYSS ]', {
            fontSize: '18px',
            color: '#E066FF',
            backgroundColor: '#1A0030',
            padding: { x: 30, y: 14 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        enterBtn.on('pointerover', () => {
            enterBtn.setColor('#FF88FF');
            enterBtn.setScale(1.05);
        });
        enterBtn.on('pointerout', () => {
            enterBtn.setColor('#E066FF');
            enterBtn.setScale(1.0);
        });

        // Collect all elements for dismissal
        const allElements = [overlay, panel, title, subtitle, storyText, divider,
                           objHeader, mainObj, shipObj, relicObj, controlsHint, enterBtn];

        // Dismiss function - used by button and tap anywhere
        const dismissEntry = () => {
            this.tweens.add({
                targets: allElements,
                alpha: 0,
                duration: 600,
                onComplete: () => {
                    allElements.forEach(el => {
                        if (el && el.destroy) el.destroy();
                    });
                    this.physics.resume();
                    this.startCosmicAmbience();
                    // Show mobile controls now that intro is dismissed
                    this.showPlatformerMobileControls();
                    // Create swim indicator HUD
                    this.createSwimIndicator();
                }
            });
        };

        enterBtn.on('pointerdown', dismissEntry);

        // Also allow tapping anywhere on overlay to dismiss (mobile-friendly)
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', dismissEntry);

        // Animate cosmic particles around panel
        this.createEntryCosmicParticles(panelX, panelY, panelWidth, panelHeight);
    }

    /**
     * Add cosmic decoration (rotating nebula orb)
     */
    addCosmicDecoration(x, y) {
        const orb = this.add.graphics();
        orb.setScrollFactor(0);
        orb.setDepth(3002);

        // Outer glow
        orb.fillStyle(0x9B30FF, 0.2);
        orb.fillCircle(x, y, 20);
        // Inner core
        orb.fillStyle(0xE066FF, 0.6);
        orb.fillCircle(x, y, 10);
        // Bright center
        orb.fillStyle(0xFFFFFF, 0.8);
        orb.fillCircle(x, y, 4);

        // Orbit particles
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const orbX = x + Math.cos(angle) * 15;
            const orbY = y + Math.sin(angle) * 15;
            orb.fillStyle(0x00FFFF, 0.7);
            orb.fillCircle(orbX, orbY, 2);
        }
    }

    /**
     * Create cosmic particles for entry screen
     */
    createEntryCosmicParticles(panelX, panelY, panelWidth, panelHeight) {
        for (let i = 0; i < 15; i++) {
            const particle = this.add.graphics();
            particle.setScrollFactor(0);
            particle.setDepth(2999);

            const startX = panelX + Math.random() * panelWidth;
            const startY = panelY + panelHeight + 30;
            const colors = [0x9B30FF, 0xE066FF, 0x00FFFF, 0xFF69B4];
            const color = Phaser.Utils.Array.GetRandom(colors);

            particle.fillStyle(color, 0.6);
            particle.fillCircle(startX, startY, 2 + Math.random() * 4);

            this.tweens.add({
                targets: particle,
                y: -panelHeight - 100,
                x: (Math.random() - 0.5) * 100,
                alpha: 0,
                duration: 4000 + Math.random() * 3000,
                delay: i * 200,
                onComplete: () => particle.destroy()
            });
        }
    }

    /**
     * Start cosmic ambient effects
     */
    startCosmicAmbience() {
        console.log('[ReefLevel] Starting cosmic void ambience');

        this.createStarfield();
        this.createNebulaWisps();
        this.createVoidRifts();
        this.createCosmicDust();
    }

    /**
     * Create parallax starfield background
     */
    createStarfield() {
        const starfield = this.add.graphics();
        starfield.setDepth(-900);
        starfield.setScrollFactor(0.1); // Slow parallax

        // Background nebula gradient
        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const r = Math.floor(10 + t * 15);
            const g = Math.floor(0 + t * 10);
            const b = Math.floor(30 + t * 30);
            const color = (r << 16) | (g << 8) | b;

            starfield.fillStyle(color, 0.3);
            starfield.fillRect(0, i * (this.levelHeight / 10), this.levelWidth, this.levelHeight / 10 + 5);
        }

        // Add stars
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * this.levelWidth;
            const y = Math.random() * this.levelHeight;
            const size = Math.random() * 2;
            const alpha = 0.3 + Math.random() * 0.7;

            // Color variety - some blue, some white, some purple
            const colors = [0xFFFFFF, 0xAABBFF, 0xFFAAFF, 0x88FFFF];
            const color = Phaser.Utils.Array.GetRandom(colors);

            starfield.fillStyle(color, alpha);
            starfield.fillCircle(x, y, size);
        }

        this.starfieldLayer = starfield;
    }

    /**
     * Create floating nebula wisps (like underwater currents but cosmic)
     */
    createNebulaWisps() {
        const wispColors = [0x9B30FF, 0xE066FF, 0x00FFFF, 0xFF1493, 0x4169E1];

        for (let i = 0; i < 20; i++) {
            const wisp = this.add.graphics();
            wisp.setDepth(-100);

            const x = Math.random() * this.levelWidth;
            const y = Math.random() * this.levelHeight;
            const color = Phaser.Utils.Array.GetRandom(wispColors);
            const size = 30 + Math.random() * 50;

            // Soft glowing wisp
            wisp.fillStyle(color, 0.15);
            wisp.fillCircle(x, y, size);
            wisp.fillStyle(color, 0.25);
            wisp.fillCircle(x, y, size * 0.6);
            wisp.fillStyle(color, 0.4);
            wisp.fillCircle(x, y, size * 0.3);

            // Animate drifting
            this.tweens.add({
                targets: wisp,
                x: (Math.random() - 0.5) * 150,
                y: (Math.random() - 0.5) * 100,
                alpha: { from: 1, to: 0.5 },
                duration: 8000 + Math.random() * 5000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.nebulaParticles.push(wisp);
        }
    }

    /**
     * Create dimensional void rifts (visual hazard indicators)
     */
    createVoidRifts() {
        const riftPositions = [
            { x: 800, y: 400 },
            { x: 1800, y: 700 },
            { x: 2800, y: 300 },
            { x: 4000, y: 600 },
        ];

        riftPositions.forEach(pos => {
            const rift = this.add.graphics();
            rift.setDepth(-50);

            // Draw swirling void rift
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const innerRadius = 30;
                const outerRadius = 80;

                rift.lineStyle(3, 0x9B30FF, 0.4 - i * 0.04);
                rift.beginPath();
                rift.arc(pos.x, pos.y, innerRadius + i * 6, angle, angle + 1.5);
                rift.strokePath();
            }

            // Center void
            rift.fillStyle(0x1A0030, 0.8);
            rift.fillCircle(pos.x, pos.y, 25);
            rift.fillStyle(0x000000, 0.9);
            rift.fillCircle(pos.x, pos.y, 15);

            // Animate rotation effect
            this.tweens.add({
                targets: rift,
                angle: 360,
                duration: 10000,
                repeat: -1,
                ease: 'Linear'
            });

            this.voidRifts.push(rift);
        });
    }

    /**
     * Create cosmic dust particles
     */
    createCosmicDust() {
        // Continuous particle spawning
        this.time.addEvent({
            delay: 200,
            callback: () => {
                if (Math.random() > 0.5) return;

                const dust = this.add.graphics();
                dust.setDepth(50);

                const x = this.cameras.main.scrollX + Math.random() * this.cameras.main.width;
                const y = this.cameras.main.scrollY + this.cameras.main.height + 20;
                const colors = [0xE066FF, 0x00FFFF, 0xFFFFFF, 0x9B30FF];
                const color = Phaser.Utils.Array.GetRandom(colors);

                dust.fillStyle(color, 0.5);
                dust.fillCircle(x, y, 1 + Math.random() * 2);

                this.tweens.add({
                    targets: dust,
                    y: y - 300 - Math.random() * 200,
                    x: x + (Math.random() - 0.5) * 100,
                    alpha: 0,
                    duration: 3000 + Math.random() * 2000,
                    onComplete: () => dust.destroy()
                });
            },
            loop: true
        });
    }

    /**
     * Override background for cosmic void
     */
    createBackground() {
        // Deep void base
        const bg = this.add.graphics();
        bg.setDepth(-1000);

        // Cosmic gradient - deep purple to void black
        const steps = 15;
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const r = Math.floor(8 + t * 12);
            const g = Math.floor(0 + t * 5);
            const b = Math.floor(20 + t * 25);
            const color = (r << 16) | (g << 8) | b;

            bg.fillStyle(color, 1);
            bg.fillRect(0, i * (this.levelHeight / steps), this.levelWidth, this.levelHeight / steps + 2);
        }

        // Add distant cosmic structures
        this.createCosmicStructures();
    }

    /**
     * Create distant cosmic structures (alien coral equivalent)
     */
    createCosmicStructures() {
        const layer = this.add.graphics();
        layer.setScrollFactor(0.3);
        layer.setDepth(-700);

        // Crystalline void formations
        const formations = [
            { x: 300, height: 350 },
            { x: 900, height: 280 },
            { x: 1500, height: 400 },
            { x: 2200, height: 320 },
            { x: 3000, height: 380 },
            { x: 3800, height: 300 },
            { x: 4600, height: 360 },
        ];

        formations.forEach(form => {
            const baseY = this.levelHeight;

            // Draw crystalline structure
            const colors = [0x9B30FF, 0x4B0082, 0x1A0030];

            // Main crystal spires
            for (let i = 0; i < 4; i++) {
                const spireX = form.x + (i - 1.5) * 30;
                const spireHeight = form.height * (0.5 + Math.random() * 0.5);

                // Crystal body
                layer.fillStyle(colors[i % 3], 0.6);
                layer.fillTriangle(
                    spireX - 15, baseY,
                    spireX + 15, baseY,
                    spireX, baseY - spireHeight
                );

                // Inner glow
                layer.fillStyle(0xE066FF, 0.3);
                layer.fillTriangle(
                    spireX - 8, baseY - 20,
                    spireX + 8, baseY - 20,
                    spireX, baseY - spireHeight + 20
                );
            }

            // Glowing orbs around structure
            for (let i = 0; i < 5; i++) {
                const orbX = form.x + (Math.random() - 0.5) * 100;
                const orbY = baseY - form.height * Math.random();
                layer.fillStyle(0x00FFFF, 0.4);
                layer.fillCircle(orbX, orbY, 5 + Math.random() * 8);
            }
        });
    }

    /**
     * Create cosmic platforms (floating void crystals)
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        const platformData = [
            // Starting area
            { x: 100, y: this.levelHeight - 150, width: 250, type: 'crystal' },
            { x: 450, y: this.levelHeight - 300, width: 180, type: 'void' },
            { x: 750, y: this.levelHeight - 450, width: 200, type: 'crystal' },

            // Mid section
            { x: 1000, y: this.levelHeight - 600, width: 160, type: 'crystal' },
            { x: 1300, y: this.levelHeight - 400, width: 180, type: 'void' },
            { x: 1600, y: this.levelHeight - 700, width: 220, type: 'crystal' },
            { x: 1900, y: this.levelHeight - 500, width: 150, type: 'void' },

            // Deep section - ship part area
            { x: 2200, y: this.levelHeight - 800, width: 200, type: 'crystal' },
            { x: 2500, y: this.levelHeight - 600, width: 180, type: 'void' },
            { x: 2800, y: this.levelHeight - 900, width: 250, type: 'relic' }, // Ship part here
            { x: 3100, y: this.levelHeight - 700, width: 160, type: 'crystal' },

            // Pre-boss
            { x: 3400, y: this.levelHeight - 1000, width: 220, type: 'crystal' },
            { x: 3800, y: this.levelHeight - 800, width: 200, type: 'void' },
            { x: 4200, y: this.levelHeight - 600, width: 180, type: 'crystal' },

            // Boss approach
            { x: 4600, y: this.levelHeight - 500, width: 250, type: 'void' },
            { x: 5000, y: this.levelHeight - 400, width: 200, type: 'crystal' },

            // Boss arena
            { x: 5400, y: this.levelHeight - 300, width: 500, type: 'arena' },
        ];

        platformData.forEach(data => {
            this.createCosmicPlatform(data.x, data.y, data.width, data.type);
        });
    }

    /**
     * Create a cosmic floating platform
     */
    createCosmicPlatform(x, y, width, type) {
        const platform = this.add.graphics();
        const height = 35;

        if (type === 'crystal') {
            // Crystalline void platform - purple/magenta
            platform.fillStyle(0x9B30FF, 0.7);
            platform.fillRoundedRect(x, y, width, height, 8);

            // Crystal facets
            platform.fillStyle(0xE066FF, 0.5);
            for (let i = 0; i < width / 25; i++) {
                const facetX = x + 12 + i * 25;
                platform.fillTriangle(facetX - 8, y, facetX + 8, y, facetX, y - 15);
            }

            // Glow
            platform.fillStyle(0x9B30FF, 0.15);
            platform.fillRoundedRect(x - 8, y - 8, width + 16, height + 16, 12);

        } else if (type === 'void') {
            // Void energy platform - cyan/blue
            platform.fillStyle(0x0066AA, 0.6);
            platform.fillRoundedRect(x, y, width, height, 10);

            // Energy patterns
            platform.lineStyle(2, 0x00FFFF, 0.6);
            for (let i = 0; i < width / 30; i++) {
                const lineX = x + 15 + i * 30;
                platform.lineBetween(lineX, y + 5, lineX, y + height - 5);
            }

            // Outer glow
            platform.fillStyle(0x00FFFF, 0.1);
            platform.fillRoundedRect(x - 5, y - 5, width + 10, height + 10, 12);

        } else if (type === 'relic') {
            // Special platform for ship part - golden
            platform.fillStyle(0x4A3000, 0.8);
            platform.fillRoundedRect(x, y, width, height, 10);

            // Golden energy lines
            platform.lineStyle(3, 0xFFD700, 0.7);
            platform.strokeRoundedRect(x + 5, y + 5, width - 10, height - 10, 6);

            // Pulsing glow
            platform.fillStyle(0xFFD700, 0.2);
            platform.fillRoundedRect(x - 10, y - 10, width + 20, height + 20, 15);

        } else if (type === 'arena') {
            // Boss arena - ominous void
            platform.fillStyle(0x1A0020, 0.95);
            platform.fillRoundedRect(x, y, width, height + 30, 15);

            // Red warning runes
            platform.lineStyle(3, 0xFF0066, 0.6);
            for (let i = 0; i < width / 60; i++) {
                const runeX = x + 30 + i * 60;
                platform.strokeCircle(runeX, y + 25, 12);
                // Inner symbol
                platform.lineBetween(runeX - 6, y + 25, runeX + 6, y + 25);
                platform.lineBetween(runeX, y + 19, runeX, y + 31);
            }

            // Void energy border
            platform.fillStyle(0xFF0066, 0.1);
            platform.fillRoundedRect(x - 10, y - 10, width + 20, height + 50, 18);
        }

        platform.setDepth(50);

        // Physics body
        const body = this.platforms.create(x + width / 2, y + height / 2, null);
        body.setVisible(false);
        body.body.setSize(width, height);
        body.body.setOffset(-width / 2, -height / 2);
    }

    /**
     * Create level content - cosmic enemies, collectibles
     */
    createLevelContent() {
        console.log('[ReefLevel] Creating cosmic abyss content');

        this.enemies = this.physics.add.group();

        // Spawn cosmic entities
        this.spawnVoidSpores();
        this.spawnPlasmaDarts();
        this.spawnPhaseDrifters();
        this.spawnLureWraiths();

        // Collectibles
        this.spawnStarFragments();
        this.spawnShipPart();

        // Boss trigger
        this.createBossTrigger();
    }

    /**
     * Spawn Void Spores - crystalline organisms that burst into void shards
     */
    spawnVoidSpores() {
        const positions = [
            { x: 600, y: this.levelHeight - 500 },
            { x: 1400, y: this.levelHeight - 650 },
            { x: 2100, y: this.levelHeight - 750 },
            { x: 2900, y: this.levelHeight - 550 },
            { x: 3600, y: this.levelHeight - 850 },
        ];

        positions.forEach(pos => {
            const spore = this.createVoidSpore(pos.x, pos.y);
            this.voidSpores.push(spore);
            this.enemies.add(spore);
        });
    }

    /**
     * Create a Void Spore - crystalline pulsing organism
     */
    createVoidSpore(x, y) {
        const spore = this.add.graphics();
        spore.setDepth(200);

        const size = 35;

        // Outer crystal shell
        spore.fillStyle(0x9B30FF, 0.4);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const pointX = x + Math.cos(angle) * size;
            const pointY = y + Math.sin(angle) * size;
            spore.fillTriangle(x, y, pointX - 8, pointY - 8, pointX + 8, pointY + 8);
        }

        // Inner void core
        spore.fillStyle(0x4B0082, 0.9);
        spore.fillCircle(x, y, size * 0.5);

        // Pulsing energy center
        spore.fillStyle(0xE066FF, 0.8);
        spore.fillCircle(x, y, size * 0.25);

        // Bright core
        spore.fillStyle(0xFFFFFF, 0.9);
        spore.fillCircle(x, y, 5);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(size * 2, size * 2);
        body.body.setAllowGravity(false);

        body.graphics = spore;
        body.enemyType = 'voidSpore';
        body.health = 2;
        body.baseX = x;
        body.baseY = y;
        body.phase = Math.random() * Math.PI * 2;

        return body;
    }

    /**
     * Spawn Plasma Darts - fast-moving energy beings
     */
    spawnPlasmaDarts() {
        const positions = [
            { x: 900, y: this.levelHeight - 400 },
            { x: 1700, y: this.levelHeight - 700 },
            { x: 2600, y: this.levelHeight - 500 },
            { x: 3400, y: this.levelHeight - 900 },
            { x: 4200, y: this.levelHeight - 600 },
        ];

        positions.forEach(pos => {
            const dart = this.createPlasmaDart(pos.x, pos.y);
            this.plasmaDarts.push(dart);
            this.enemies.add(dart);
        });
    }

    /**
     * Create a Plasma Dart - elongated energy projectile creature
     */
    createPlasmaDart(x, y) {
        const dart = this.add.graphics();
        dart.setDepth(200);

        const length = 70;
        const height = 18;

        // Energy trail
        dart.fillStyle(0x00FFFF, 0.2);
        dart.fillTriangle(x - length, y, x - length / 2, y - height, x - length / 2, y + height);

        // Main body - elongated energy form
        dart.fillStyle(0x00CCFF, 0.8);
        dart.fillRoundedRect(x - length / 2, y - height / 2, length, height, 5);

        // Energy core line
        dart.fillStyle(0xFFFFFF, 0.9);
        dart.fillRoundedRect(x - length / 3, y - 3, length / 2, 6, 3);

        // Head - pointed and bright
        dart.fillStyle(0x00FFFF, 1);
        dart.fillTriangle(x + length / 2, y, x + length / 2 + 20, y, x + length / 2, y);
        dart.fillCircle(x + length / 2, y, 8);

        // Eye-like sensor
        dart.fillStyle(0xFF0066, 1);
        dart.fillCircle(x + length / 3, y, 4);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(length + 20, height);
        body.body.setAllowGravity(false);

        body.graphics = dart;
        body.enemyType = 'plasmaDart';
        body.health = 2;
        body.baseX = x;
        body.baseY = y;
        body.isCharging = false;
        body.facingRight = true;

        return body;
    }

    /**
     * Spawn Phase Drifters - ethereal beings that phase in and out
     */
    spawnPhaseDrifters() {
        const positions = [
            { x: 500, y: this.levelHeight - 600 },
            { x: 1100, y: this.levelHeight - 450 },
            { x: 1900, y: this.levelHeight - 800 },
            { x: 2700, y: this.levelHeight - 650 },
            { x: 3500, y: this.levelHeight - 750 },
            { x: 4000, y: this.levelHeight - 550 },
        ];

        positions.forEach(pos => {
            const drifter = this.createPhaseDrifter(pos.x, pos.y);
            this.phaseDrifters.push(drifter);
            this.enemies.add(drifter);
        });
    }

    /**
     * Create a Phase Drifter - ghostly dimensional being
     */
    createPhaseDrifter(x, y) {
        const drifter = this.add.graphics();
        drifter.setDepth(200);

        // Ethereal body - multiple translucent layers
        drifter.fillStyle(0xE066FF, 0.15);
        drifter.fillCircle(x, y, 45);

        drifter.fillStyle(0xE066FF, 0.25);
        drifter.fillCircle(x, y, 35);

        drifter.fillStyle(0xE066FF, 0.4);
        drifter.fillCircle(x, y, 25);

        // Central form
        drifter.fillStyle(0xFF69B4, 0.6);
        drifter.fillCircle(x, y - 5, 15);

        // Trailing tendrils (like a cosmic jellyfish but more ethereal)
        drifter.lineStyle(3, 0xE066FF, 0.5);
        for (let i = 0; i < 5; i++) {
            const tendrilX = x - 15 + i * 8;
            drifter.beginPath();
            drifter.moveTo(tendrilX, y + 15);
            // Approximate curve with line segments
            drifter.lineTo(tendrilX + 5, y + 30);
            drifter.lineTo(tendrilX + 8, y + 50);
            drifter.lineTo(tendrilX, y + 70);
            drifter.lineTo(tendrilX + 3, y + 90);
            drifter.lineTo(tendrilX, y + 110);
            drifter.strokePath();
        }

        // Eyes - hollow void eyes
        drifter.fillStyle(0x000000, 0.9);
        drifter.fillCircle(x - 8, y - 8, 5);
        drifter.fillCircle(x + 8, y - 8, 5);
        drifter.fillStyle(0xFFFFFF, 0.7);
        drifter.fillCircle(x - 6, y - 9, 2);
        drifter.fillCircle(x + 10, y - 9, 2);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(60, 120);
        body.body.setAllowGravity(false);

        body.graphics = drifter;
        body.enemyType = 'phaseDrifter';
        body.health = 1;
        body.baseX = x;
        body.baseY = y;
        body.isPhased = false;
        body.phaseTimer = 0;

        return body;
    }

    /**
     * Spawn Lure Wraiths - void predators with hypnotic lures
     */
    spawnLureWraiths() {
        const positions = [
            { x: 1500, y: this.levelHeight - 250 },
            { x: 3000, y: this.levelHeight - 350 },
            { x: 4400, y: this.levelHeight - 300 },
        ];

        positions.forEach(pos => {
            const wraith = this.createLureWraith(pos.x, pos.y);
            this.lureWraiths.push(wraith);
            this.enemies.add(wraith);
        });
    }

    /**
     * Create a Lure Wraith - massive void predator with dimensional lure
     */
    createLureWraith(x, y) {
        const wraith = this.add.graphics();
        wraith.setDepth(200);

        const size = 55;

        // Shadowy body mass
        wraith.fillStyle(0x0A0015, 0.95);
        wraith.fillCircle(x, y, size);

        // Void texture patterns
        wraith.fillStyle(0x1A0030, 0.8);
        wraith.fillCircle(x - 15, y + 10, 20);
        wraith.fillCircle(x + 20, y - 5, 18);

        // Massive maw
        wraith.fillStyle(0x000000, 1);
        wraith.fillCircle(x + 35, y, 30);

        // Teeth - crystalline void fangs
        wraith.fillStyle(0x9B30FF, 0.9);
        for (let i = 0; i < 10; i++) {
            const angle = -0.6 + (i / 10) * 1.2;
            const toothX = x + 35 + Math.cos(angle) * 25;
            const toothY = y + Math.sin(angle) * 25;
            wraith.fillTriangle(
                toothX, toothY,
                toothX + Math.cos(angle) * 15, toothY + Math.sin(angle) * 15,
                toothX + 5, toothY + 5
            );
        }

        // The Lure - hypnotic dimensional orb
        const lureX = x + 70;
        const lureY = y - 40;

        // Lure tendril - approximate curve with line segments
        wraith.lineStyle(4, 0x4B0082, 0.8);
        wraith.beginPath();
        wraith.moveTo(x + 20, y - 30);
        wraith.lineTo(x + 35, y - 45);
        wraith.lineTo(x + 50, y - 50);
        wraith.lineTo(lureX, lureY);
        wraith.strokePath();

        // Lure orb - mesmerizing
        wraith.fillStyle(0x00FF00, 0.3);
        wraith.fillCircle(lureX, lureY, 20);
        wraith.fillStyle(0x00FF00, 0.6);
        wraith.fillCircle(lureX, lureY, 12);
        wraith.fillStyle(0xFFFFFF, 0.9);
        wraith.fillCircle(lureX, lureY, 5);

        // Eye - single massive void eye
        wraith.fillStyle(0xFF0066, 0.9);
        wraith.fillCircle(x - 15, y - 15, 12);
        wraith.fillStyle(0x000000, 1);
        wraith.fillCircle(x - 13, y - 15, 6);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(size * 2 + 30, size * 2);
        body.body.setAllowGravity(false);

        body.graphics = wraith;
        body.enemyType = 'lureWraith';
        body.health = 5;
        body.baseX = x;
        body.baseY = y;
        body.isLurking = true;
        body.isLunging = false;

        return body;
    }

    /**
     * Update enemies
     */
    updateEnemies(time, delta) {
        // Void Spores - crystalline pulsing
        this.voidSpores.forEach(spore => {
            if (!spore.active) return;

            const wobble = Math.sin(time / 800 + spore.phase) * 25;
            spore.x = spore.baseX + wobble;
            spore.y = spore.baseY + Math.sin(time / 600 + spore.phase) * 15;

            this.updateEnemyGraphics(spore);
        });

        // Plasma Darts - patrol and charge
        this.plasmaDarts.forEach(dart => {
            if (!dart.active) return;
            this.updatePlasmaDartAI(dart, time);
        });

        // Phase Drifters - drift and phase
        this.phaseDrifters.forEach(drifter => {
            if (!drifter.active) return;
            this.updatePhaseDrifterAI(drifter, time);
        });

        // Lure Wraiths - lurk and lunge
        this.lureWraiths.forEach(wraith => {
            if (!wraith.active) return;
            this.updateLureWraithAI(wraith, time);
        });
    }

    updateEnemyGraphics(enemy) {
        if (enemy.graphics) {
            enemy.graphics.x = enemy.x - enemy.baseX;
            enemy.graphics.y = enemy.y - enemy.baseY;
        }
    }

    updatePlasmaDartAI(dart, time) {
        const distToPlayer = Phaser.Math.Distance.Between(
            dart.x, dart.y, this.player.x, this.player.y
        );

        if (dart.isCharging) {
            if (time > dart.chargeTime + 1200) {
                dart.isCharging = false;
                dart.setVelocity(0, 0);
            }
        } else {
            // Patrol
            const patrol = Math.sin(time / 1500 + dart.baseX) * 120;
            dart.x = dart.baseX + patrol;

            // Check for charge
            if (distToPlayer < 350 && Math.random() > 0.985) {
                dart.isCharging = true;
                dart.chargeTime = time;

                const angle = Phaser.Math.Angle.Between(
                    dart.x, dart.y, this.player.x, this.player.y
                );

                dart.setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500);
                dart.facingRight = this.player.x > dart.x;
            }
        }

        this.updateEnemyGraphics(dart);
    }

    updatePhaseDrifterAI(drifter, time) {
        // Gentle drift
        const driftX = Math.sin(time / 2500 + drifter.baseX) * 30;
        const driftY = Math.sin(time / 2000 + drifter.baseY) * 40;

        drifter.x = drifter.baseX + driftX;
        drifter.y = drifter.baseY + driftY;

        // Phase in/out
        if (time > drifter.phaseTimer + 4000) {
            drifter.phaseTimer = time;
            drifter.isPhased = !drifter.isPhased;

            if (drifter.graphics) {
                this.tweens.add({
                    targets: drifter.graphics,
                    alpha: drifter.isPhased ? 0.2 : 1,
                    duration: 500
                });
            }
        }

        this.updateEnemyGraphics(drifter);
    }

    updateLureWraithAI(wraith, time) {
        const distToPlayer = Phaser.Math.Distance.Between(
            wraith.x, wraith.y, this.player.x, this.player.y
        );

        if (wraith.isLurking) {
            if (distToPlayer < 250) {
                wraith.isLurking = false;
                wraith.isLunging = true;

                const angle = Phaser.Math.Angle.Between(
                    wraith.x, wraith.y, this.player.x, this.player.y
                );

                wraith.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);

                this.time.delayedCall(1200, () => {
                    wraith.isLunging = false;

                    this.tweens.add({
                        targets: wraith,
                        x: wraith.baseX,
                        y: wraith.baseY,
                        duration: 2500,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            wraith.isLurking = true;
                            wraith.setVelocity(0, 0);
                        }
                    });
                });
            }
        }

        this.updateEnemyGraphics(wraith);
    }

    /**
     * Spawn Star Fragments
     */
    spawnStarFragments() {
        const positions = [
            { x: 500, y: this.levelHeight - 450 },
            { x: 1300, y: this.levelHeight - 750 },
            { x: 2200, y: this.levelHeight - 850 },
            { x: 3200, y: this.levelHeight - 650 },
            { x: 4100, y: this.levelHeight - 750 },
        ];

        positions.forEach((pos, index) => {
            const fragment = this.createStarFragment(pos.x, pos.y, index);
            this.starFragments.push(fragment);
        });
    }

    createStarFragment(x, y, index) {
        const fragment = this.add.graphics();
        fragment.setDepth(250);

        // Outer cosmic glow
        fragment.fillStyle(0xFFD700, 0.2);
        fragment.fillCircle(x, y, 30);

        // Star shape
        fragment.fillStyle(0xFFD700, 0.8);
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const innerAngle = angle + Math.PI / 5;
            const outerX = x + Math.cos(angle) * 18;
            const outerY = y + Math.sin(angle) * 18;
            const innerX = x + Math.cos(innerAngle) * 8;
            const innerY = y + Math.sin(innerAngle) * 8;

            fragment.fillTriangle(x, y, outerX, outerY, innerX, innerY);
        }

        // Bright center
        fragment.fillStyle(0xFFFFFF, 0.9);
        fragment.fillCircle(x, y, 6);

        // Physics
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(40, 40);
        body.body.setAllowGravity(false);
        body.graphics = fragment;
        body.fragmentIndex = index;

        this.physics.add.overlap(this.player, body, () => this.collectStarFragment(body));

        // Pulse animation
        this.tweens.add({
            targets: fragment,
            alpha: 0.6,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 1200,
            yoyo: true,
            repeat: -1
        });

        return body;
    }

    collectStarFragment(fragment) {
        if (!fragment.active) return;

        fragment.active = false;
        this.starFragmentsCollected++;

        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, fragment.x, fragment.y, {
                count: 20,
                color: [0xFFD700, 0xFFFFFF, 0xE066FF],
                duration: 1200
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playCoinCollect();
        }

        const collectX = fragment.x;
        const collectY = fragment.y;

        fragment.graphics?.destroy();
        fragment.destroy();

        this.showFloatingText(`✧ Star Fragment ${this.starFragmentsCollected}/${this.totalStarFragments}`, collectX, collectY - 30, '#FFD700');

        console.log(`[ReefLevel] Collected Star Fragment ${this.starFragmentsCollected}/${this.totalStarFragments}`);

        // Award Cosmic Egg when all fragments collected
        if (this.starFragmentsCollected >= this.totalStarFragments && !this.cosmicEggAwarded) {
            this.cosmicEggAwarded = true;

            this.time.delayedCall(500, () => {
                this.showFloatingText('✨ All Star Fragments! 🥚 Cosmic Egg Earned!', collectX, collectY - 80, '#00FFFF');

                if (window.InventoryManager) {
                    window.InventoryManager.addItem({
                        id: 'cosmic_egg_reef',
                        name: 'Void Cosmic Egg',
                        type: 'egg',
                        rarity: 'rare',
                        description: 'A mysterious egg infused with void energy from the Cosmic Abyss.',
                        icon: '🥚🌌'
                    });
                }

                if (window.AudioManager) {
                    window.AudioManager.playAchievement();
                }
            });
        }
    }

    /**
     * Spawn the Ship Part - Dimensional Drive Fragment
     */
    spawnShipPart() {
        // Located on the special 'relic' platform
        const x = 2800;
        const y = this.levelHeight - 950;

        const shipPart = this.add.graphics();
        shipPart.setDepth(300);

        // Technological artifact appearance
        // Outer energy field
        shipPart.fillStyle(0x00FFFF, 0.15);
        shipPart.fillCircle(x, y, 45);

        // Rotating energy rings
        shipPart.lineStyle(3, 0x00FFFF, 0.6);
        shipPart.strokeCircle(x, y, 35);
        shipPart.lineStyle(2, 0x00FFFF, 0.4);
        shipPart.strokeCircle(x, y, 40);

        // Core device - hexagonal
        shipPart.fillStyle(0x1A3A4A, 0.95);
        const hexPoints = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            hexPoints.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20 });
        }
        shipPart.fillPoints(hexPoints, true);

        // Inner glow
        shipPart.fillStyle(0x00FFFF, 0.8);
        shipPart.fillCircle(x, y, 10);

        // Bright core
        shipPart.fillStyle(0xFFFFFF, 1);
        shipPart.fillCircle(x, y, 5);

        // Label
        const label = this.add.text(x, y - 60, '🔧 SHIP PART', {
            fontSize: '14px',
            color: '#00FFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(301);

        // Physics
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(60, 60);
        body.body.setAllowGravity(false);
        body.graphics = shipPart;
        body.label = label;

        this.physics.add.overlap(this.player, body, () => this.collectShipPart(body));

        // Rotation animation for energy rings
        this.tweens.add({
            targets: shipPart,
            angle: 360,
            duration: 8000,
            repeat: -1,
            ease: 'Linear'
        });

        // Pulse
        this.tweens.add({
            targets: [shipPart, label],
            alpha: 0.7,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        this.shipPart = body;
    }

    collectShipPart(part) {
        if (!part.active || this.shipPartCollected) return;

        part.active = false;
        this.shipPartCollected = true;

        // Major celebration!
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, part.x, part.y, {
                count: 40,
                color: [0x00FFFF, 0xFFFFFF, 0x00FF00, 0xFFD700],
                duration: 2000
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        part.graphics?.destroy();
        part.label?.destroy();
        part.destroy();

        // Show big message
        this.showFloatingText('⚙️ DIMENSIONAL DRIVE ACQUIRED!', part.x, part.y - 50, '#00FFFF');

        // Note: Ship part is officially awarded via InventoryManager in showVictoryScreen()
        // This pickup just marks it visually
        this.dimensionalDriveFound = true;

        console.log('[ReefLevel] Dimensional drive pickup collected!');
    }

    /**
     * Create boss trigger
     */
    createBossTrigger() {
        const triggerZone = this.add.zone(5200, this.levelHeight / 2, 100, this.levelHeight);
        this.physics.add.existing(triggerZone, true);

        this.physics.add.overlap(this.player, triggerZone, () => {
            if (!this.bossFightActive && !this.bossDefeated) {
                this.startBossFight();
            }
        });
    }

    /**
     * Start boss fight with Nyx'voral
     */
    startBossFight() {
        this.bossFightActive = true;
        this.bossHealth = this.bossMaxHealth;

        console.log('[ReefLevel] BOSS FIGHT: Nyx\'voral the Void Serpent!');

        this.cameras.main.stopFollow();
        this.cameras.main.pan(5600, this.levelHeight / 2, 1200);

        this.showBossIntro();
    }

    showBossIntro() {
        const { width, height } = this.cameras.main;

        // Void darkness
        const darkness = this.add.graphics();
        darkness.fillStyle(0x0A0015, 0.85);
        darkness.fillRect(5000, 0, 1500, this.levelHeight);
        darkness.setDepth(2000);

        // Boss name with cosmic styling
        const bossTitle = this.add.text(5600, 200, 'NYX\'VORAL', {
            fontSize: '52px',
            color: '#E066FF',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(2001).setAlpha(0);

        const bossSubtitle = this.add.text(5600, 270, 'The Void Serpent', {
            fontSize: '24px',
            color: '#9B30FF',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(2001).setAlpha(0);

        // Animate intro
        this.tweens.add({
            targets: [bossTitle, bossSubtitle],
            alpha: 1,
            duration: 1200,
            onComplete: () => {
                this.time.delayedCall(2500, () => {
                    this.tweens.add({
                        targets: [darkness, bossTitle, bossSubtitle],
                        alpha: 0,
                        duration: 600,
                        onComplete: () => {
                            darkness.destroy();
                            bossTitle.destroy();
                            bossSubtitle.destroy();

                            this.spawnNyxvoral();
                        }
                    });
                });
            }
        });

        if (window.AudioManager?.playBossMusic) {
            window.AudioManager.playBossMusic();
        }
    }

    /**
     * Spawn Nyx'voral the Void Serpent
     */
    spawnNyxvoral() {
        const bossX = 5700;
        const bossY = this.levelHeight - 500;

        this.boss = this.add.graphics();
        this.boss.setDepth(300);

        this.drawNyxvoral(bossX, bossY, 1);

        this.bossBody = this.physics.add.sprite(bossX, bossY, null);
        this.bossBody.setVisible(false);
        this.bossBody.body.setSize(280, 100);
        this.bossBody.body.setAllowGravity(false);

        this.physics.add.overlap(this.player, this.bossBody, () => {
            this.takeDamage(2);
        });

        this.createBossHealthBar();
        this.startBossAI();

        // CRITICAL: Restore camera to follow player after boss intro
        // Pan back to player first, then re-enable follow
        this.time.delayedCall(500, () => {
            if (this.player && this.cameras.main) {
                // Smooth pan back to player position
                this.cameras.main.pan(
                    this.player.x,
                    this.player.y,
                    1000, // 1 second pan
                    'Power2',
                    true, // force
                    (camera, progress) => {
                        // When pan completes, restore camera follow
                        if (progress === 1) {
                            camera.startFollow(this.player, true, 0.08, 0.1);
                            console.log('[ReefLevel] Camera follow restored after boss intro');
                        }
                    }
                );
            }
        });
    }

    /**
     * Draw Nyx'voral - cosmic void serpent
     */
    drawNyxvoral(x, y, phase) {
        this.boss.clear();

        const length = 300;
        const bodyWidth = 60;

        // Phase colors
        const phaseColors = {
            1: { body: 0x4B0082, accent: 0x9B30FF, glow: 0xE066FF },
            2: { body: 0x800040, accent: 0xFF0066, glow: 0xFF69B4 },
            3: { body: 0x000020, accent: 0xFF0000, glow: 0xFF4444 }
        };

        const colors = phaseColors[phase] || phaseColors[1];

        // Serpentine body segments
        const segments = 10;
        for (let i = 0; i < segments; i++) {
            const segWidth = bodyWidth * (1 - i * 0.06);
            const wave = Math.sin(this.time.now / 250 + i * 0.6) * 30;

            const segX = x - i * (length / segments);
            const segY = y + wave;

            // Body segment with cosmic pattern
            this.boss.fillStyle(colors.body, 0.95);
            this.boss.fillCircle(segX, segY, segWidth / 2);

            // Void energy spine
            this.boss.fillStyle(colors.accent, 0.6);
            this.boss.fillCircle(segX, segY - segWidth / 3, 8);

            // Small orbiting particles on some segments
            if (i % 3 === 0) {
                const orbAngle = this.time.now / 500 + i;
                const orbX = segX + Math.cos(orbAngle) * (segWidth / 2 + 10);
                const orbY = segY + Math.sin(orbAngle) * (segWidth / 2 + 10);
                this.boss.fillStyle(colors.glow, 0.7);
                this.boss.fillCircle(orbX, orbY, 4);
            }
        }

        // Head - larger, more menacing
        this.boss.fillStyle(colors.body, 1);
        this.boss.fillCircle(x + 50, y, 45);

        // Crown of void crystals
        for (let i = 0; i < 5; i++) {
            const crownAngle = -0.8 + (i / 4) * 0.8 - 0.4;
            const crownX = x + 50 + Math.cos(crownAngle) * 40;
            const crownY = y + Math.sin(crownAngle) * 40 - 10;
            this.boss.fillStyle(colors.accent, 0.9);
            this.boss.fillTriangle(
                crownX - 5, crownY + 5,
                crownX + 5, crownY + 5,
                crownX, crownY - 20
            );
        }

        // Massive maw
        this.boss.fillStyle(0x000000, 1);
        this.boss.fillCircle(x + 90, y, 35);

        // Void energy teeth
        this.boss.fillStyle(colors.glow, 0.9);
        for (let i = 0; i < 8; i++) {
            const angle = -0.5 + (i / 8) * 1;
            const toothX = x + 90 + Math.cos(angle) * 30;
            const toothY = y + Math.sin(angle) * 30;
            this.boss.fillTriangle(
                toothX, toothY,
                toothX + Math.cos(angle) * 18, toothY + Math.sin(angle) * 18,
                toothX + 6, toothY + 4
            );
        }

        // Eyes - three void eyes
        const eyePositions = [
            { x: x + 30, y: y - 25 },
            { x: x + 50, y: y - 30 },
            { x: x + 70, y: y - 25 },
        ];

        eyePositions.forEach(eye => {
            this.boss.fillStyle(colors.glow, 1);
            this.boss.fillCircle(eye.x, eye.y, 10);
            this.boss.fillStyle(0x000000, 1);
            this.boss.fillCircle(eye.x + 2, eye.y, 5);
        });

        // Void aura
        this.boss.fillStyle(colors.glow, 0.1);
        this.boss.fillCircle(x + 20, y, 120);
    }

    createBossHealthBar() {
        // Use SCREEN coordinates (center of camera view)
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(350, screenWidth - 60);
        const barHeight = 28;
        const x = (screenWidth - barWidth) / 2;
        const y = 55;

        // Boss UI container for all elements
        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500); // Higher depth for visibility

        // Boss name with enhanced visibility
        this.bossNameText = this.add.text(screenWidth / 2, y - 28, '⚔️ NYX\'VORAL ⚔️', {
            fontSize: '24px',
            color: '#E066FF',
            fontStyle: 'bold',
            stroke: '#2D0050',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0);
        this.bossUI.add(this.bossNameText);

        // Subtitle
        this.bossSubtitle = this.add.text(screenWidth / 2, y - 8, 'Void Serpent', {
            fontSize: '12px',
            color: '#9B7FEE'
        }).setOrigin(0.5).setScrollFactor(0);
        this.bossUI.add(this.bossSubtitle);

        // Health bar background with glow
        this.bossHealthBg = this.add.graphics();
        this.bossHealthBg.setScrollFactor(0);
        // Glow layer
        this.bossHealthBg.fillStyle(0x9B30FF, 0.2);
        this.bossHealthBg.fillRoundedRect(x - 8, y - 3, barWidth + 16, barHeight + 16, 12);
        // Main background
        this.bossHealthBg.fillStyle(0x1A0030, 0.95);
        this.bossHealthBg.fillRoundedRect(x - 3, y + 2, barWidth + 6, barHeight + 6, 8);
        this.bossHealthBg.lineStyle(3, 0x9B30FF, 0.9);
        this.bossHealthBg.strokeRoundedRect(x - 3, y + 2, barWidth + 6, barHeight + 6, 8);
        this.bossUI.add(this.bossHealthBg);

        // Health bar fill
        this.bossHealthBar = this.add.graphics();
        this.bossHealthBar.setScrollFactor(0);
        this.bossUI.add(this.bossHealthBar);

        // Store dimensions for updateBossHealthBar
        this.bossBarConfig = { x, y: y + 5, width: barWidth, height: barHeight };

        // Camera zoom out for better boss visibility
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 0.9,
            duration: 1000,
            ease: 'Power2'
        });

        this.updateBossHealthBar();

        // Start off-screen boss indicator updates
        this.startBossIndicator();
    }

    updateBossHealthBar() {
        if (!this.bossHealthBar || !this.bossBarConfig) return;

        const { x, y, width, height } = this.bossBarConfig;
        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;

        // Color gradient based on health
        let color = 0xE066FF;
        if (healthPercent < 0.25) color = 0xFF0066;
        else if (healthPercent < 0.5) color = 0xFF69B4;

        // Health fill
        this.bossHealthBar.fillStyle(color, 1);
        this.bossHealthBar.fillRoundedRect(x, y, width * healthPercent, height, 5);

        // Inner highlight for depth
        if (healthPercent > 0.1) {
            this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
            this.bossHealthBar.fillRoundedRect(x + 2, y + 2, (width * healthPercent) - 4, height / 3, 3);
        }
    }

    /**
     * Off-screen boss indicator - shows arrow pointing to boss when off-screen
     */
    startBossIndicator() {
        // Create indicator arrow
        this.bossIndicator = this.add.graphics();
        this.bossIndicator.setScrollFactor(0);
        this.bossIndicator.setDepth(1499);
        this.bossIndicator.setAlpha(0);

        // Update indicator position every frame
        this.bossIndicatorTimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updateBossIndicator(),
            loop: true
        });
    }

    updateBossIndicator() {
        if (!this.boss || !this.bossIndicator || this.bossDefeated) return;

        const camera = this.cameras.main;
        const screenWidth = camera.width;
        const screenHeight = camera.height;

        // Get boss position relative to camera
        const bossScreenX = this.boss.x - camera.scrollX;
        const bossScreenY = this.boss.y - camera.scrollY;

        // Check if boss is off-screen
        const padding = 100;
        const isOffScreen = bossScreenX < -padding || bossScreenX > screenWidth + padding ||
                           bossScreenY < -padding || bossScreenY > screenHeight + padding;

        if (isOffScreen && this.bossFightActive) {
            // Show indicator pointing to boss
            this.bossIndicator.setAlpha(0.9);
            this.bossIndicator.clear();

            // Calculate angle to boss
            const playerScreenX = this.player.x - camera.scrollX;
            const playerScreenY = this.player.y - camera.scrollY;
            const angle = Math.atan2(bossScreenY - playerScreenY, bossScreenX - playerScreenX);

            // Position indicator at edge of screen
            const indicatorDist = Math.min(screenWidth, screenHeight) * 0.35;
            let indicatorX = playerScreenX + Math.cos(angle) * indicatorDist;
            let indicatorY = playerScreenY + Math.sin(angle) * indicatorDist;

            // Clamp to screen bounds
            indicatorX = Phaser.Math.Clamp(indicatorX, 50, screenWidth - 50);
            indicatorY = Phaser.Math.Clamp(indicatorY, 100, screenHeight - 150);

            // Draw arrow pointing to boss
            this.bossIndicator.fillStyle(0xE066FF, 1);
            const arrowSize = 20;

            // Rotate arrow to point at boss
            this.bossIndicator.save();
            this.bossIndicator.translateCanvas(indicatorX, indicatorY);
            this.bossIndicator.rotateCanvas(angle);

            // Arrow shape
            this.bossIndicator.fillTriangle(
                arrowSize, 0,
                -arrowSize / 2, -arrowSize / 2,
                -arrowSize / 2, arrowSize / 2
            );

            // Pulsing circle behind
            const pulseSize = 8 + Math.sin(this.time.now / 200) * 3;
            this.bossIndicator.fillStyle(0xFF0066, 0.6);
            this.bossIndicator.fillCircle(-arrowSize, 0, pulseSize);

            this.bossIndicator.restore();
        } else {
            // Hide indicator when boss is on-screen
            this.bossIndicator.setAlpha(0);
        }
    }

    startBossAI() {
        this.bossAttackTimer = this.time.addEvent({
            delay: 2500,
            callback: () => this.bossAttack(),
            loop: true
        });
    }

    bossAttack() {
        if (!this.bossFightActive || this.bossDefeated) return;

        const attacks = ['voidLunge', 'dimensionalTear', 'summonMinions'];
        const attack = Phaser.Utils.Array.GetRandom(attacks);

        console.log(`[ReefLevel] Nyx'voral attack: ${attack}`);

        switch (attack) {
            case 'voidLunge':
                this.bossVoidLunge();
                break;
            case 'dimensionalTear':
                this.bossDimensionalTear();
                break;
            case 'summonMinions':
                this.bossSummonMinions();
                break;
        }
    }

    bossVoidLunge() {
        if (!this.bossBody) return;

        const targetX = this.player.x;
        const targetY = this.player.y;

        // Telegraph with glow
        this.tweens.add({
            targets: this.boss,
            alpha: 0.5,
            duration: 400,
            yoyo: true,
            onComplete: () => {
                this.tweens.add({
                    targets: this.bossBody,
                    x: targetX,
                    y: targetY,
                    duration: 400,
                    ease: 'Power3',
                    onComplete: () => {
                        this.tweens.add({
                            targets: this.bossBody,
                            x: 5700,
                            y: this.levelHeight - 500,
                            duration: 1200,
                            ease: 'Sine.easeInOut'
                        });
                    }
                });
            }
        });
    }

    bossDimensionalTear() {
        // Create a void rift at player position
        const tear = this.add.graphics();
        tear.setDepth(400);

        const tearX = this.player.x + (Math.random() - 0.5) * 100;
        const tearY = this.player.y + (Math.random() - 0.5) * 100;

        // Expanding void tear
        tear.fillStyle(0x9B30FF, 0.8);
        tear.fillCircle(tearX, tearY, 10);

        this.tweens.add({
            targets: tear,
            scaleX: 15,
            scaleY: 15,
            alpha: 0,
            duration: 2000,
            onComplete: () => tear.destroy()
        });

        // Damage zone
        const damageZone = this.add.zone(tearX, tearY, 150, 150);
        this.physics.add.existing(damageZone, true);

        const overlap = this.physics.add.overlap(this.player, damageZone, () => {
            this.takeDamage(1);
        });

        this.time.delayedCall(2000, () => {
            overlap.destroy();
            damageZone.destroy();
        });
    }

    bossSummonMinions() {
        for (let i = 0; i < 4; i++) {
            this.time.delayedCall(i * 250, () => {
                const minion = this.createVoidMinion(
                    5700 + (Math.random() - 0.5) * 200,
                    this.levelHeight - 400 + (Math.random() - 0.5) * 300
                );
                this.bossMinions.push(minion);
            });
        }
    }

    createVoidMinion(x, y) {
        const minion = this.add.graphics();
        minion.setDepth(280);

        minion.fillStyle(0x9B30FF, 0.6);
        minion.fillCircle(x, y, 20);
        minion.fillStyle(0xE066FF, 0.8);
        minion.fillCircle(x, y, 12);
        minion.fillStyle(0xFFFFFF, 0.9);
        minion.fillCircle(x, y, 5);

        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(40, 40);
        body.body.setAllowGravity(false);
        body.graphics = minion;
        body.health = 1;

        // Chase player
        this.tweens.add({
            targets: body,
            x: this.player.x,
            y: this.player.y,
            duration: 2500,
            ease: 'Linear',
            onUpdate: () => {
                minion.x = body.x - x;
                minion.y = body.y - y;
            },
            onComplete: () => {
                body.destroy();
                minion.destroy();
            }
        });

        this.physics.add.overlap(this.player, body, () => {
            this.takeDamage(1);
            body.destroy();
            minion.destroy();
        });

        return body;
    }

    updateBoss(time, delta) {
        if (!this.boss || !this.bossBody) return;

        this.drawNyxvoral(this.bossBody.x, this.bossBody.y, this.bossPhase);

        const healthPercent = this.bossHealth / this.bossMaxHealth;

        if (healthPercent < 0.3 && this.bossPhase < 3) {
            this.bossPhase = 3;
            console.log('[ReefLevel] Nyx\'voral entering phase 3!');
            if (this.bossAttackTimer) this.bossAttackTimer.delay = 1500;
        } else if (healthPercent < 0.6 && this.bossPhase < 2) {
            this.bossPhase = 2;
            console.log('[ReefLevel] Nyx\'voral entering phase 2!');
            if (this.bossAttackTimer) this.bossAttackTimer.delay = 2000;
        }
    }

    performAttack() {
        console.log('[ReefLevel] Void energy attack');

        const attackX = this.player.facingRight ? this.player.x + 70 : this.player.x - 70;
        const attackY = this.player.y;

        const attack = this.add.graphics();
        attack.setDepth(300);

        // Cosmic energy burst
        attack.fillStyle(0xE066FF, 0.6);
        attack.fillCircle(attackX, attackY, 50);
        attack.fillStyle(0x00FFFF, 0.8);
        attack.fillCircle(attackX, attackY, 30);

        this.tweens.add({
            targets: attack,
            alpha: 0,
            scaleX: 1.8,
            scaleY: 1.8,
            duration: 350,
            onComplete: () => attack.destroy()
        });

        // Check enemy hits
        this.enemies.children.each(enemy => {
            if (!enemy.active) return;

            const dist = Phaser.Math.Distance.Between(attackX, attackY, enemy.x, enemy.y);
            if (dist < 70) {
                this.damageEnemy(enemy, 1);
            }
        });

        // Check boss hit
        if (this.bossFightActive && this.bossBody) {
            const distToBoss = Phaser.Math.Distance.Between(attackX, attackY, this.bossBody.x, this.bossBody.y);
            if (distToBoss < 120) {
                this.damageBoss(1);
            }
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    damageEnemy(enemy, amount) {
        enemy.health -= amount;

        if (enemy.graphics) {
            this.tweens.add({
                targets: enemy.graphics,
                alpha: 0.2,
                duration: 80,
                yoyo: true,
                repeat: 2
            });
        }

        if (enemy.health <= 0) {
            this.defeatEnemy(enemy);
        }
    }

    damageBoss(amount) {
        this.bossHealth -= amount;
        this.updateBossHealthBar();

        this.tweens.add({
            targets: this.boss,
            alpha: 0.3,
            duration: 80,
            yoyo: true,
            repeat: 3
        });

        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        if (this.bossHealth <= 0) {
            this.defeatBoss();
        }
    }

    defeatBoss() {
        console.log('[ReefLevel] Nyx\'voral defeated!');

        this.bossDefeated = true;
        this.bossFightActive = false;

        // Record boss defeat for achievements
        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('boss_defeated', { bossId: 'nyxvoral' });
        }

        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }

        // Epic death
        this.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 2500,
            ease: 'Power2'
        });

        if (window.FXLibrary) {
            for (let i = 0; i < 6; i++) {
                this.time.delayedCall(i * 350, () => {
                    window.FXLibrary.stardustBurst(this,
                        this.bossBody.x + (Math.random() - 0.5) * 150,
                        this.bossBody.y + (Math.random() - 0.5) * 80,
                        {
                            count: 35,
                            color: [0xE066FF, 0x9B30FF, 0x00FFFF, 0xFF69B4, 0xFFFFFF],
                            duration: 2500
                        }
                    );
                });
            }
        }

        this.time.delayedCall(3000, () => {
            this.showVictoryScreen();
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    showVictoryScreen() {
        // Record success for contextual thoughts (enables special encouragement if struggled)
        this.recordLevelSuccess();

        // Award ship part for completing this level (Stellar Reef -> dimensional_drive)
        if (window.InventoryManager?.addShipPart) {
            const awarded = window.InventoryManager.addShipPart('dimensional_drive');
            if (awarded) {
                console.log('[ReefLevel] Awarded Dimensional Drive ship part!');
            }
        }

        // Calculate completion stats for achievements
        const completionTime = Date.now() - (this.levelStartTime || Date.now());
        const noDamage = (this.damageTaken || 0) === 0;
        const speedrunThreshold = 240000; // 4 minutes

        // Record level completion for achievements
        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_completed', {
                levelId: 'cosmicReef',
                noDamage: noDamage,
                time: completionTime,
                speedrunThreshold: speedrunThreshold
            });
        }

        // Record level completion for bond progression
        const bondData = window.GameState?.get('creature.bond');
        if (bondData) {
            const levelXP = 10; // Bond XP for completing a level
            const newExperience = (bondData.experience || 0) + levelXP;
            const newLevel = Math.floor(newExperience / 50) + 1;
            const leveledUp = newLevel > (bondData.level || 1);

            window.GameState.set('creature.bond', {
                ...bondData,
                experience: newExperience,
                level: newLevel,
                levelsCompleted: (bondData.levelsCompleted || 0) + 1,
                totalInteractions: (bondData.totalInteractions || 0) + 1,
                abilitySlots: {
                    ...bondData.abilitySlots,
                    slot2: newLevel >= 5 || bondData.abilitySlots?.slot2,
                    slot3: newLevel >= 10 || bondData.abilitySlots?.slot3
                }
            });

            if (leveledUp) {
                console.log(`[ReefLevel] Bond level up! Now level ${newLevel}`);
                window.GameState.emit('bondLevelUp', { level: newLevel });
            }
        }

        const { width, height } = this.cameras.main;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x0A0015, 0.95);
        overlay.fillRect(0, 0, width + 2000, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        const victoryText = this.add.text(width / 2, height / 2 - 100, '✧ COSMIC ABYSS CLEARED ✧', {
            fontSize: '34px',
            color: '#E066FF',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const statsText = this.add.text(width / 2, height / 2,
            `Star Fragments: ${this.starFragmentsCollected}/${this.totalStarFragments}\n` +
            `Ship Part: ⚙️ Dimensional Drive\n` +
            `Ship Parts Collected: ${shipParts.length}/5\n` +
            `Nyx'voral Defeated: ✓`, {
            fontSize: '18px',
            color: '#CCAAFF',
            align: 'center',
            lineSpacing: 12
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const continueBtn = this.add.text(width / 2, height / 2 + 130, '[ RETURN TO SANCTUARY ]', {
            fontSize: '20px',
            color: '#E066FF',
            backgroundColor: '#1A0030',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001).setInteractive();

        continueBtn.on('pointerover', () => continueBtn.setColor('#FF88FF'));
        continueBtn.on('pointerout', () => continueBtn.setColor('#E066FF'));
        continueBtn.on('pointerdown', () => this.returnToSanctuary());
    }

    showFloatingText(text, x, y, color = '#FFFFFF') {
        const floatText = this.add.text(x, y, text, {
            fontSize: '16px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: floatText,
            y: y - 60,
            alpha: 0,
            duration: 1800,
            onComplete: () => floatText.destroy()
        });
    }

    handleMovement() {
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;
        const virtualLeft = this.virtualJoystickX < -0.2;
        const virtualRight = this.virtualJoystickX > 0.2;

        if (leftPressed || virtualLeft) {
            const mult = virtualLeft ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const target = -this.playerSpeed * mult;
            const newVel = this.player.body.velocity.x + (target - this.player.body.velocity.x) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = false;
        } else if (rightPressed || virtualRight) {
            const mult = virtualRight ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const target = this.playerSpeed * mult;
            const newVel = this.player.body.velocity.x + (target - this.player.body.velocity.x) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = true;
        } else {
            this.player.setVelocityX(this.player.body.velocity.x * this.swimDrag);
            if (Math.abs(this.player.body.velocity.x) < 3) {
                this.player.setVelocityX(0);
            }
        }

        // When not actively swimming, player sinks noticeably
        if (!this.isSwimmingUp && this.player.body.velocity.y < this.maxSinkSpeed) {
            // Apply sink speed more aggressively so player feels gravity
            this.player.setVelocityY(this.player.body.velocity.y + this.sinkSpeed * 0.18);
        }
    }

    handleJump() {
        const swimPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown ||
                           this.virtualJumpPressed;

        if (swimPressed) {
            this.isSwimmingUp = true;
            const target = this.jumpVelocity;
            // Use swimAcceleration for more responsive feel
            const accel = this.swimAcceleration || 0.20;
            const newVel = this.player.body.velocity.y + (target - this.player.body.velocity.y) * accel;
            this.player.setVelocityY(newVel);

            // INCREASED: Visual feedback when swimming - 60% chance of trail
            if (Math.random() > 0.4) {
                this.createPlayerCosmicTrail();
            }

            // Add subtle forward boost when swimming up
            if (this.player.facingRight !== undefined) {
                const forwardBoost = this.player.facingRight ? 15 : -15;
                this.player.setVelocityX(this.player.body.velocity.x + forwardBoost * 0.1);
            }
        } else {
            this.isSwimmingUp = false;
            // Apply drag but let gravity do more work (don't reduce Y velocity as much)
            this.player.setVelocityY(this.player.body.velocity.y * this.swimDrag);
        }

        // Sink faster when pressing down
        const sinkPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;
        if (sinkPressed) {
            const newVel = this.player.body.velocity.y + (this.maxSinkSpeed - this.player.body.velocity.y) * 0.15;
            this.player.setVelocityY(newVel);
        }
    }

    createPlayerCosmicTrail() {
        const trail = this.add.graphics();
        trail.setDepth(150);

        const x = this.player.x + (Math.random() - 0.5) * 25;
        const y = this.player.y + 15;
        const colors = [0xE066FF, 0x00FFFF, 0x9B30FF];
        const color = Phaser.Utils.Array.GetRandom(colors);

        trail.fillStyle(color, 0.6);
        trail.fillCircle(x, y, 3 + Math.random() * 3);

        this.tweens.add({
            targets: trail,
            y: y + 80,
            alpha: 0,
            duration: 1200,
            onComplete: () => trail.destroy()
        });
    }

    update(time, delta) {
        if (!this.player) return;

        this.isGrounded = false;
        this.handleMovement();
        this.handleJump();
        this.updatePlayerFacing();
        this.updateEnemies(time, delta);

        if (this.bossFightActive) {
            this.updateBoss(time, delta);
        }

        // Update swim indicator
        this.updateSwimIndicator();
    }

    /**
     * Create swim indicator HUD element
     */
    createSwimIndicator() {
        const { width, height } = this.cameras.main;
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Position above mobile controls or at bottom center
        const indicatorY = isMobile ? height - 160 : height - 80;

        // Background
        this.swimIndicatorBg = this.add.graphics();
        this.swimIndicatorBg.fillStyle(0x0A0015, 0.7);
        this.swimIndicatorBg.fillRoundedRect(width / 2 - 55, indicatorY - 15, 110, 30, 8);
        this.swimIndicatorBg.setScrollFactor(0);
        this.swimIndicatorBg.setDepth(2000);
        this.swimIndicatorBg.setAlpha(0);

        // Text
        this.swimIndicatorText = this.add.text(width / 2, indicatorY, '🌊 SWIMMING', {
            fontSize: '14px',
            color: '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
        this.swimIndicatorText.setAlpha(0);

        // Pulse animation for when swimming
        this.swimIndicatorPulse = this.tweens.add({
            targets: this.swimIndicatorText,
            scale: { from: 1, to: 1.1 },
            duration: 300,
            yoyo: true,
            repeat: -1,
            paused: true
        });
    }

    /**
     * Update swim indicator visibility based on input
     */
    updateSwimIndicator() {
        if (!this.swimIndicatorText) return;

        if (this.isSwimmingUp) {
            // Show indicator when swimming
            if (this.swimIndicatorText.alpha < 0.9) {
                this.swimIndicatorBg.setAlpha(1);
                this.swimIndicatorText.setAlpha(1);
                this.swimIndicatorPulse?.resume();
            }
        } else {
            // Fade out when not swimming
            if (this.swimIndicatorText.alpha > 0.1) {
                this.swimIndicatorBg.setAlpha(0);
                this.swimIndicatorText.setAlpha(0);
                this.swimIndicatorPulse?.pause();
            }
        }
    }

    shutdown() {
        console.log('[ReefLevel] Shutting down Cosmic Abyss');

        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }

        // Clean up boss indicator
        if (this.bossIndicatorTimer) {
            this.bossIndicatorTimer.remove();
            this.bossIndicatorTimer = null;
        }
        if (this.bossIndicator) {
            this.bossIndicator.destroy();
            this.bossIndicator = null;
        }
        if (this.bossUI) {
            this.bossUI.destroy();
            this.bossUI = null;
        }

        // Reset camera zoom
        if (this.cameras?.main) {
            this.cameras.main.setZoom(1.0);
        }

        this.nebulaParticles.forEach(p => p?.destroy());
        this.voidRifts.forEach(r => r?.destroy());
        this.starfieldLayer?.destroy();

        super.shutdown();
    }
}

export default ReefLevel;

if (typeof window !== 'undefined') {
    window.ReefLevel = ReefLevel;
}
