import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * ReefLevel - Bioluminescent Reef underwater level
 *
 * Story: "The Bioluminescent Reef was once a peaceful trade passage between star systems,
 * where cosmic travelers would rest among the glowing corals. After the Void Incursion,
 * the waters became infested with corrupted sea creatures. Now, the ancient Void Moray
 * 'Typhonix' guards these depths, its presence poisoning the once-pristine waters.
 *
 * To restore the cosmic trade routes, you must navigate the treacherous reef,
 * survive its corrupted inhabitants, and defeat Typhonix to cleanse the passage."
 *
 * Objectives:
 * - Primary: Defeat Typhonix the Void Moray and cleanse the reef
 * - Secondary: Collect 5 Coral Pearls, Free 3 Trapped Travelers
 */
class ReefLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'ReefLevel',
            levelId: 'reef_1',
            biomeId: 'reef',
            levelWidth: 6000,
            levelHeight: 1200  // Taller for vertical swimming
        });

        // Override physics for underwater swimming
        this.gravityY = 80;           // Very low gravity for floaty swimming
        this.playerSpeed = 160;        // Slightly slower horizontal
        this.jumpVelocity = -200;      // Swim upward thrust
        this.playerAcceleration = 0.12; // Smooth acceleration
        this.playerDeceleration = 0.92; // Slow deceleration (momentum in water)

        // Swimming-specific physics
        this.swimBoostVelocity = -350;  // Boost when holding swim
        this.sinkSpeed = 30;            // Natural sinking rate
        this.maxSinkSpeed = 120;        // Terminal sinking velocity
        this.swimDrag = 0.98;           // Water resistance

        // Level-specific state
        this.pearlsCollected = 0;
        this.totalPearls = 5;
        this.travelersFreed = 0;
        this.totalTravelers = 3;
        this.bossDefeated = false;
        this.reefCleansed = false;
        this.bossFightActive = false;

        // Boss state - Typhonix the Void Moray
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 12;  // More health than Crystal Golem
        this.bossPhase = 1;       // 3 phases
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossInkClouds = [];
        this.bossMinions = [];

        // Enemy types for this level
        this.pufferfish = [];
        this.barracudas = [];
        this.jellyfish = [];
        this.anglerfish = [];

        // Collectibles
        this.pearls = [];
        this.trappedTravelers = [];

        // Ambient effects
        this.bubbleEmitters = [];
        this.bioluminescentParticles = null;
        this.causticLightEffect = null;

        // Water current zones
        this.currentZones = [];
    }

    /**
     * Override init to reset level-specific state on restart
     */
    init(data) {
        super.init(data);

        // Reset level-specific state
        this.pearlsCollected = 0;
        this.travelersFreed = 0;
        this.bossDefeated = false;
        this.reefCleansed = false;
        this.bossFightActive = false;

        // Reset boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossInkClouds = [];
        this.bossMinions = [];

        // Reset enemies
        this.pufferfish = [];
        this.barracudas = [];
        this.jellyfish = [];
        this.anglerfish = [];

        // Reset collectibles
        this.pearls = [];
        this.trappedTravelers = [];

        // Reset effects
        this.bubbleEmitters = [];
        this.bioluminescentParticles = null;
        this.causticLightEffect = null;
        this.currentZones = [];

        console.log('[ReefLevel] Level state reset for restart');
    }

    create() {
        // Call parent create (sets up physics, player, camera, input)
        super.create();

        // Show level entry screen
        this.showLevelEntry();
    }

    /**
     * Override physics setup for underwater swimming
     */
    setupPlatformerPhysics() {
        // Much lower gravity for underwater feel
        this.physics.world.gravity.y = this.gravityY;
        console.log(`[ReefLevel] Underwater physics: gravity.y = ${this.gravityY}`);
    }

    /**
     * Show level entry screen with story and objectives
     */
    showLevelEntry() {
        const { width, height } = this.cameras.main;

        // Pause game
        this.physics.pause();

        // Dark overlay with blue tint
        const overlay = this.add.graphics();
        overlay.fillStyle(0x001830, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel background
        const panelWidth = Math.min(500, width - 40);
        const panelHeight = 420;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0A1628, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x00CED1, 1);  // Cyan border
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Coral decorations
        this.addCoralDecoration(panel, panelX + 30, panelY + 30);
        this.addCoralDecoration(panel, panelX + panelWidth - 30, panelY + 30);

        // Title with water effect
        const title = this.add.text(width / 2, panelY + 50, '🐚 THE BIOLUMINESCENT REEF 🐚', {
            fontSize: '28px',
            color: '#00CED1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Subtitle - story hook
        const subtitle = this.add.text(width / 2, panelY + 90, '"Where corrupted waters hide ancient secrets"', {
            fontSize: '14px',
            color: '#40E0D0',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Story text
        const storyText = this.add.text(width / 2, panelY + 140,
            'The Void Moray Typhonix has poisoned these\nonce-peaceful trade waters. Cleanse the reef\nand restore the cosmic passage!', {
            fontSize: '13px',
            color: '#88CCCC',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x00CED1, 0.5);
        divider.lineBetween(panelX + 40, panelY + 190, panelX + panelWidth - 40, panelY + 190);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Objectives header
        const objHeader = this.add.text(width / 2, panelY + 210, 'OBJECTIVES', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Main objective
        const mainObj = this.add.text(width / 2, panelY + 240, '⚔️ Defeat Typhonix the Void Moray', {
            fontSize: '18px',
            color: '#FF6B6B',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Secondary objectives
        const pearl = this.add.text(panelX + 50, panelY + 280, '🔮 Collect Coral Pearls (0/5)', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        const travelers = this.add.text(panelX + 50, panelY + 305, '👤 Free Trapped Travelers (0/3)', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        // Controls hint
        const controlsHint = this.add.text(width / 2, panelY + 345,
            '🎮 Use SWIM (↑/W) to rise • Attacks work underwater!', {
            fontSize: '12px',
            color: '#666666'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Enter button
        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 45, '[ DIVE INTO THE REEF ]', {
            fontSize: '18px',
            color: '#00CED1',
            backgroundColor: '#0A2840',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        // Button hover effects
        enterBtn.on('pointerover', () => {
            enterBtn.setColor('#40E0D0');
            enterBtn.setScale(1.05);
        });
        enterBtn.on('pointerout', () => {
            enterBtn.setColor('#00CED1');
            enterBtn.setScale(1.0);
        });
        enterBtn.on('pointerdown', () => {
            // Fade out and start level
            const allElements = [overlay, panel, title, subtitle, storyText, divider,
                               objHeader, mainObj, pearl, travelers, controlsHint, enterBtn];

            this.tweens.add({
                targets: allElements,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    allElements.forEach(el => el.destroy());
                    this.physics.resume();
                    this.startUnderwaterAmbience();
                }
            });
        });

        // Animate bubbles rising behind panel
        this.createEntryBubbles(panelX, panelY, panelWidth, panelHeight);
    }

    /**
     * Add coral decoration to panel
     */
    addCoralDecoration(panel, x, y) {
        const coral = this.add.graphics();
        coral.setScrollFactor(0);
        coral.setDepth(3002);

        // Draw stylized coral
        const colors = [0xFF6B6B, 0xFF8C94, 0x00CED1, 0x40E0D0];
        const color = Phaser.Utils.Array.GetRandom(colors);

        coral.fillStyle(color, 0.8);
        coral.fillCircle(x, y, 8);
        coral.fillCircle(x - 6, y + 10, 6);
        coral.fillCircle(x + 6, y + 10, 6);
        coral.fillCircle(x, y + 18, 5);
    }

    /**
     * Create bubbles animation for entry screen
     */
    createEntryBubbles(panelX, panelY, panelWidth, panelHeight) {
        // Create multiple bubble streams
        for (let i = 0; i < 8; i++) {
            const x = panelX + Math.random() * panelWidth;
            const startY = panelY + panelHeight + 50;

            this.time.addEvent({
                delay: i * 200,
                callback: () => {
                    this.createBubble(x, startY, panelY - 50);
                }
            });
        }
    }

    /**
     * Create a single rising bubble
     */
    createBubble(x, startY, endY) {
        const bubble = this.add.graphics();
        bubble.setScrollFactor(0);
        bubble.setDepth(2999);

        const size = 3 + Math.random() * 6;
        bubble.fillStyle(0x88CCCC, 0.4);
        bubble.fillCircle(x, startY, size);
        bubble.lineStyle(1, 0xAAEEEE, 0.6);
        bubble.strokeCircle(x, startY, size);

        // Animate rising with wobble
        this.tweens.add({
            targets: bubble,
            y: endY - startY,
            duration: 3000 + Math.random() * 2000,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                const progress = tween.progress;
                const wobble = Math.sin(progress * Math.PI * 4) * 10;
                bubble.x = wobble;
            },
            onComplete: () => bubble.destroy()
        });
    }

    /**
     * Start underwater ambient effects
     */
    startUnderwaterAmbience() {
        console.log('[ReefLevel] Starting underwater ambience');

        // Create caustic light effect (moving light patterns)
        this.createCausticLights();

        // Create bioluminescent particle system
        this.createBioluminescence();

        // Create bubble streams at various points
        this.createAmbientBubbles();

        // Start subtle underwater sound (if AudioManager supports it)
        if (window.AudioManager && window.AudioManager.playAmbientLoop) {
            window.AudioManager.playAmbientLoop('underwater');
        }
    }

    /**
     * Create caustic light effect (rippling light patterns)
     */
    createCausticLights() {
        // Create moving light rays from above
        const rayCount = 5;
        this.causticRays = [];

        for (let i = 0; i < rayCount; i++) {
            const ray = this.add.graphics();
            ray.setDepth(-100);

            const x = 200 + i * 400 + Math.random() * 200;
            const width = 80 + Math.random() * 60;
            const height = 600;

            // Draw gradient ray
            for (let j = 0; j < 20; j++) {
                const alpha = 0.03 * (1 - j / 20);
                ray.fillStyle(0x40E0D0, alpha);
                ray.fillTriangle(
                    x - width / 2 + j * 2, 0,
                    x + width / 2 - j * 2, 0,
                    x, height - j * 30
                );
            }

            this.causticRays.push({ graphics: ray, baseX: x });

            // Animate the ray swaying
            this.tweens.add({
                targets: ray,
                x: 50,
                duration: 4000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    /**
     * Create bioluminescent particle system
     */
    createBioluminescence() {
        // Create glowing particles throughout the level
        const colors = [0x00FFFF, 0x00CED1, 0x40E0D0, 0xFF69B4, 0x9370DB, 0x00FF7F];

        // Create particle emitter zones at intervals
        for (let x = 100; x < this.levelWidth - 200; x += 300) {
            for (let y = 100; y < this.levelHeight - 200; y += 250) {
                // Random chance to place a bioluminescent zone
                if (Math.random() > 0.4) continue;

                const color = Phaser.Utils.Array.GetRandom(colors);
                this.createGlowingOrganism(x + Math.random() * 100, y + Math.random() * 100, color);
            }
        }
    }

    /**
     * Create a single glowing bioluminescent organism
     */
    createGlowingOrganism(x, y, color) {
        const organism = this.add.graphics();
        organism.setDepth(-50);

        const size = 2 + Math.random() * 4;

        // Draw glowing core
        organism.fillStyle(color, 0.8);
        organism.fillCircle(x, y, size);

        // Draw glow halo
        organism.fillStyle(color, 0.2);
        organism.fillCircle(x, y, size * 3);

        // Pulse animation
        this.tweens.add({
            targets: organism,
            alpha: 0.3,
            duration: 1500 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Slow drift
        this.tweens.add({
            targets: organism,
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 30,
            duration: 5000 + Math.random() * 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Create ambient bubble streams
     */
    createAmbientBubbles() {
        // Place bubble emitters at coral/rock formations
        const bubblePoints = [
            { x: 300, y: this.levelHeight - 100 },
            { x: 800, y: this.levelHeight - 150 },
            { x: 1500, y: this.levelHeight - 80 },
            { x: 2200, y: this.levelHeight - 120 },
            { x: 3000, y: this.levelHeight - 90 },
            { x: 3800, y: this.levelHeight - 140 },
            { x: 4500, y: this.levelHeight - 100 },
        ];

        bubblePoints.forEach(point => {
            this.time.addEvent({
                delay: 2000 + Math.random() * 3000,
                callback: () => this.emitBubbleStream(point.x, point.y),
                loop: true
            });
        });
    }

    /**
     * Emit a stream of bubbles from a point
     */
    emitBubbleStream(x, y) {
        const bubbleCount = 3 + Math.floor(Math.random() * 4);

        for (let i = 0; i < bubbleCount; i++) {
            this.time.delayedCall(i * 150, () => {
                const bubble = this.add.graphics();
                bubble.setDepth(50);

                const size = 2 + Math.random() * 5;
                const startX = x + (Math.random() - 0.5) * 20;

                bubble.fillStyle(0x88CCCC, 0.5);
                bubble.fillCircle(startX, y, size);
                bubble.lineStyle(1, 0xAAEEEE, 0.7);
                bubble.strokeCircle(startX, y, size);

                // Rise with wobble
                this.tweens.add({
                    targets: bubble,
                    y: -this.levelHeight,
                    duration: 4000 + Math.random() * 3000,
                    ease: 'Linear',
                    onUpdate: () => {
                        const wobble = Math.sin(this.time.now / 200) * 15;
                        bubble.x = wobble;
                    },
                    onComplete: () => bubble.destroy()
                });
            });
        }
    }

    /**
     * Override background creation for underwater reef
     */
    createBackground() {
        const screenHeight = this.cameras.main.height;
        const screenWidth = this.cameras.main.width;

        // Deep ocean gradient base
        const bg = this.add.graphics();
        bg.setDepth(-1000);

        // Create vertical gradient from dark blue (top) to darker (bottom)
        const steps = 20;
        const stepHeight = Math.max(this.levelHeight, screenHeight) / steps;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const r = Math.floor(0 + t * 5);
            const g = Math.floor(20 + t * 10);
            const b = Math.floor(40 + t * 20);
            const color = (r << 16) | (g << 8) | b;

            bg.fillStyle(color, 1);
            bg.fillRect(0, i * stepHeight, this.levelWidth, stepHeight + 2);
        }

        // Add distant coral silhouettes (parallax layer 1)
        this.createDistantCorals();

        // Add mid-ground coral formations (parallax layer 2)
        this.createMidgroundCorals();

        // Add foreground decorative elements
        this.createForegroundDecor();
    }

    /**
     * Create distant coral silhouettes
     */
    createDistantCorals() {
        const layer = this.add.graphics();
        layer.setScrollFactor(0.2); // Slow parallax
        layer.setDepth(-800);

        // Draw silhouetted coral shapes
        const coralPositions = [
            { x: 200, height: 300 },
            { x: 600, height: 250 },
            { x: 1100, height: 350 },
            { x: 1600, height: 280 },
            { x: 2100, height: 320 },
            { x: 2800, height: 290 },
            { x: 3400, height: 340 },
        ];

        coralPositions.forEach(coral => {
            const baseY = this.levelHeight;

            // Draw coral as dark silhouette
            layer.fillStyle(0x051020, 0.6);

            // Main stem
            layer.fillRect(coral.x - 15, baseY - coral.height, 30, coral.height);

            // Branches
            for (let i = 0; i < 5; i++) {
                const branchY = baseY - coral.height * (0.3 + i * 0.15);
                const branchLen = 40 + Math.random() * 30;
                const direction = i % 2 === 0 ? 1 : -1;

                layer.fillRect(
                    coral.x,
                    branchY,
                    branchLen * direction,
                    8
                );

                // Branch tip
                layer.fillCircle(coral.x + branchLen * direction, branchY + 4, 12);
            }
        });
    }

    /**
     * Create mid-ground coral formations with color
     */
    createMidgroundCorals() {
        const layer = this.add.graphics();
        layer.setScrollFactor(0.5); // Medium parallax
        layer.setDepth(-500);

        const coralColors = [0xFF6B6B, 0xFF8C42, 0xFFD93D, 0x00CED1, 0x9370DB, 0xFF69B4];

        // Create colorful coral formations
        for (let x = 100; x < this.levelWidth; x += 400 + Math.random() * 200) {
            const color = Phaser.Utils.Array.GetRandom(coralColors);
            const height = 100 + Math.random() * 150;
            const baseY = this.levelHeight - 50;

            this.drawCoralFormation(layer, x, baseY, height, color);
        }
    }

    /**
     * Draw a coral formation
     */
    drawCoralFormation(graphics, x, baseY, height, color) {
        // Coral base
        graphics.fillStyle(color, 0.7);

        // Main structure - branching coral
        const branches = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < branches; i++) {
            const branchX = x + (i - branches / 2) * 25;
            const branchHeight = height * (0.6 + Math.random() * 0.4);

            // Draw branch as elongated shape
            graphics.fillRoundedRect(
                branchX - 8,
                baseY - branchHeight,
                16,
                branchHeight,
                8
            );

            // Add polyps (small circles) along branch
            for (let j = 0; j < 5; j++) {
                const polypY = baseY - branchHeight * (j / 5);
                graphics.fillCircle(branchX - 12, polypY, 4);
                graphics.fillCircle(branchX + 12, polypY, 4);
            }

            // Branch tip
            graphics.fillCircle(branchX, baseY - branchHeight, 12);
        }

        // Add glow effect
        graphics.fillStyle(color, 0.15);
        graphics.fillCircle(x, baseY - height / 2, height * 0.6);
    }

    /**
     * Create foreground decorative elements
     */
    createForegroundDecor() {
        // Seaweed swaying in the current
        for (let x = 50; x < this.levelWidth; x += 150 + Math.random() * 100) {
            if (Math.random() > 0.6) continue;

            this.createSeaweed(x, this.levelHeight - 30);
        }
    }

    /**
     * Create animated seaweed
     */
    createSeaweed(x, baseY) {
        const segments = 6 + Math.floor(Math.random() * 4);
        const segmentHeight = 25;
        const color = Math.random() > 0.5 ? 0x228B22 : 0x2E8B57;

        const seaweed = this.add.graphics();
        seaweed.setDepth(100);

        // Store seaweed data for animation
        const seaweedData = {
            graphics: seaweed,
            x: x,
            baseY: baseY,
            segments: segments,
            segmentHeight: segmentHeight,
            color: color,
            phase: Math.random() * Math.PI * 2
        };

        // Add to update list
        if (!this.seaweedList) this.seaweedList = [];
        this.seaweedList.push(seaweedData);
    }

    /**
     * Override createPlatforms for underwater coral platforms
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // Create coral/rock platforms throughout the level
        // These are swim-through areas with solid surfaces

        const platformData = [
            // Starting area - tutorial platforms
            { x: 100, y: this.levelHeight - 100, width: 200, type: 'coral' },
            { x: 400, y: this.levelHeight - 200, width: 150, type: 'rock' },
            { x: 650, y: this.levelHeight - 350, width: 180, type: 'coral' },

            // Mid section - more vertical
            { x: 900, y: this.levelHeight - 500, width: 160, type: 'coral' },
            { x: 1100, y: this.levelHeight - 300, width: 140, type: 'rock' },
            { x: 1400, y: this.levelHeight - 600, width: 200, type: 'coral' },
            { x: 1700, y: this.levelHeight - 400, width: 150, type: 'rock' },

            // Deep section - challenging
            { x: 2000, y: this.levelHeight - 700, width: 180, type: 'coral' },
            { x: 2300, y: this.levelHeight - 500, width: 160, type: 'rock' },
            { x: 2600, y: this.levelHeight - 800, width: 200, type: 'coral' },
            { x: 2900, y: this.levelHeight - 600, width: 140, type: 'rock' },

            // Pre-boss area
            { x: 3200, y: this.levelHeight - 900, width: 220, type: 'coral' },
            { x: 3500, y: this.levelHeight - 700, width: 180, type: 'rock' },
            { x: 3800, y: this.levelHeight - 500, width: 200, type: 'coral' },

            // Boss approach
            { x: 4200, y: this.levelHeight - 600, width: 250, type: 'rock' },
            { x: 4600, y: this.levelHeight - 400, width: 200, type: 'coral' },

            // Boss arena floor
            { x: 5200, y: this.levelHeight - 200, width: 600, type: 'arena' },
        ];

        platformData.forEach(data => {
            this.createCoralPlatform(data.x, data.y, data.width, data.type);
        });

        // Add cave ceiling for some areas
        this.createCaveCeilings();
    }

    /**
     * Create a coral/rock platform
     */
    createCoralPlatform(x, y, width, type) {
        const platform = this.add.graphics();
        const height = 30;

        if (type === 'coral') {
            // Coral platform - colorful
            const color = Phaser.Utils.Array.GetRandom([0xFF6B6B, 0xFF8C42, 0x00CED1, 0x9370DB]);
            platform.fillStyle(color, 0.8);
            platform.fillRoundedRect(x, y, width, height, 10);

            // Add coral texture/bumps
            platform.fillStyle(color, 1);
            for (let i = 0; i < width / 20; i++) {
                const bumpX = x + 10 + i * 20 + Math.random() * 5;
                const bumpSize = 8 + Math.random() * 6;
                platform.fillCircle(bumpX, y, bumpSize);
            }

            // Glow
            platform.fillStyle(color, 0.2);
            platform.fillRoundedRect(x - 5, y - 5, width + 10, height + 10, 15);
        } else if (type === 'rock') {
            // Rock platform - darker, natural
            platform.fillStyle(0x3D3D5C, 0.9);
            platform.fillRoundedRect(x, y, width, height, 8);

            // Rock texture
            platform.fillStyle(0x4A4A6A, 0.8);
            for (let i = 0; i < width / 30; i++) {
                const rockX = x + 15 + i * 30;
                platform.fillCircle(rockX, y + 10, 12);
            }
        } else if (type === 'arena') {
            // Boss arena - large, ominous
            platform.fillStyle(0x1A1A3E, 0.95);
            platform.fillRoundedRect(x, y, width, height + 20, 15);

            // Glowing runes
            platform.lineStyle(2, 0xFF0000, 0.5);
            for (let i = 0; i < width / 50; i++) {
                const runeX = x + 25 + i * 50;
                platform.strokeCircle(runeX, y + 20, 10);
            }
        }

        platform.setDepth(50);

        // Create physics body
        const body = this.platforms.create(x + width / 2, y + height / 2, null);
        body.setVisible(false);
        body.body.setSize(width, height);
        body.body.setOffset(-width / 2, -height / 2);
    }

    /**
     * Create cave ceiling obstacles
     */
    createCaveCeilings() {
        // Add some overhead obstacles
        const ceilings = [
            { x: 1200, y: 50, width: 300 },
            { x: 2400, y: 80, width: 400 },
            { x: 3600, y: 60, width: 350 },
        ];

        ceilings.forEach(data => {
            const ceiling = this.add.graphics();
            ceiling.fillStyle(0x1A1A2E, 0.9);
            ceiling.fillRect(data.x, data.y, data.width, 40);

            // Stalactites
            for (let i = 0; i < data.width / 40; i++) {
                const stalX = data.x + 20 + i * 40;
                const stalLen = 30 + Math.random() * 40;
                ceiling.fillTriangle(
                    stalX - 10, data.y + 40,
                    stalX + 10, data.y + 40,
                    stalX, data.y + 40 + stalLen
                );
            }

            ceiling.setDepth(60);

            // Physics body
            const body = this.platforms.create(data.x + data.width / 2, data.y + 20, null);
            body.setVisible(false);
            body.body.setSize(data.width, 40);
            body.body.setOffset(-data.width / 2, -20);
        });
    }

    /**
     * Override handleMovement for swimming physics
     */
    handleMovement() {
        const leftPressed = this.cursors.left.isDown || this.wasdKeys.A.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasdKeys.D.isDown;

        // Virtual joystick support
        const virtualLeft = this.virtualJoystickX < -0.2;
        const virtualRight = this.virtualJoystickX > 0.2;

        // Swimming has momentum - slower acceleration but maintains speed
        const currentMaxSpeed = this.playerSpeed;

        if (leftPressed || virtualLeft) {
            const speedMultiplier = virtualLeft ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = -currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            // Slower acceleration in water
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = false;
        } else if (rightPressed || virtualRight) {
            const speedMultiplier = virtualRight ? Math.min(1, Math.abs(this.virtualJoystickX) * 1.5) : 1;
            const targetVel = currentMaxSpeed * speedMultiplier;
            const currentVel = this.player.body.velocity.x;
            const newVel = currentVel + (targetVel - currentVel) * this.playerAcceleration;
            this.player.setVelocityX(newVel);
            this.player.facingRight = true;
        } else {
            // Water resistance slows you down gradually
            this.player.setVelocityX(this.player.body.velocity.x * this.swimDrag);

            if (Math.abs(this.player.body.velocity.x) < 3) {
                this.player.setVelocityX(0);
            }
        }

        // Apply natural sinking when not actively swimming up
        if (!this.isSwimmingUp && this.player.body.velocity.y < this.maxSinkSpeed) {
            this.player.setVelocityY(this.player.body.velocity.y + this.sinkSpeed * 0.1);
        }
    }

    /**
     * Override handleJump for swimming up
     */
    handleJump() {
        const swimPressed = this.jumpKey.isDown ||
                           this.cursors.up.isDown ||
                           this.wasdKeys.W.isDown ||
                           this.virtualJumpPressed;

        if (swimPressed) {
            this.isSwimmingUp = true;

            // Continuous swim thrust while held
            const currentVelY = this.player.body.velocity.y;
            const targetVelY = this.jumpVelocity;

            // Smooth acceleration upward
            const newVelY = currentVelY + (targetVelY - currentVelY) * 0.15;
            this.player.setVelocityY(newVelY);

            // Create bubble trail
            if (Math.random() > 0.7) {
                this.createPlayerBubble();
            }

            // Reset virtual jump for continuous swimming
            // (Unlike platformer jump, swimming is continuous while held)
        } else {
            this.isSwimmingUp = false;
            // Apply water drag when not swimming
            this.player.setVelocityY(this.player.body.velocity.y * this.swimDrag);
        }

        // Also allow swimming down with down key
        const sinkPressed = this.cursors.down.isDown || this.wasdKeys.S.isDown;
        if (sinkPressed) {
            const currentVelY = this.player.body.velocity.y;
            const targetVelY = this.maxSinkSpeed;
            const newVelY = currentVelY + (targetVelY - currentVelY) * 0.1;
            this.player.setVelocityY(newVelY);
        }
    }

    /**
     * Create bubble from player while swimming
     */
    createPlayerBubble() {
        const bubble = this.add.graphics();
        bubble.setDepth(150);

        const size = 2 + Math.random() * 3;
        const x = this.player.x + (Math.random() - 0.5) * 20;
        const y = this.player.y + 10;

        bubble.fillStyle(0x88CCCC, 0.6);
        bubble.fillCircle(x, y, size);

        // Rise and fade
        this.tweens.add({
            targets: bubble,
            y: y - 100,
            alpha: 0,
            duration: 1500,
            ease: 'Sine.easeOut',
            onComplete: () => bubble.destroy()
        });
    }

    /**
     * Override update for swimming physics and level elements
     */
    update(time, delta) {
        if (!this.player) return;

        // Swimming has no "grounded" - always in water
        this.isGrounded = false;

        // Handle movement with water physics
        this.handleMovement();

        // Handle swimming (up/down)
        this.handleJump();

        // Update player facing
        this.updatePlayerFacing();

        // Update seaweed animation
        this.updateSeaweed(time);

        // Update enemies
        this.updateEnemies(time, delta);

        // Check boss phase transitions
        if (this.bossFightActive) {
            this.updateBoss(time, delta);
        }
    }

    /**
     * Update seaweed animation
     */
    updateSeaweed(time) {
        if (!this.seaweedList) return;

        this.seaweedList.forEach(sw => {
            sw.graphics.clear();
            sw.graphics.fillStyle(sw.color, 0.8);

            let prevX = sw.x;
            let prevY = sw.baseY;

            for (let i = 0; i < sw.segments; i++) {
                const wave = Math.sin(time / 1000 + sw.phase + i * 0.5) * (5 + i * 3);
                const segX = sw.x + wave;
                const segY = sw.baseY - (i + 1) * sw.segmentHeight;

                // Draw segment
                sw.graphics.fillRoundedRect(segX - 4, segY, 8, sw.segmentHeight + 5, 4);

                prevX = segX;
                prevY = segY;
            }
        });
    }

    /**
     * Create level content - enemies, collectibles, etc.
     */
    createLevelContent() {
        console.log('[ReefLevel] Creating level content');

        // Create enemy groups
        this.enemies = this.physics.add.group();

        // Spawn enemies
        this.spawnPufferfish();
        this.spawnBarracudas();
        this.spawnJellyfish();
        this.spawnAnglerfish();

        // Create collectibles
        this.spawnCoralPearls();
        this.spawnTrappedTravelers();

        // Create water current zones
        this.createCurrentZones();

        // Set up boss trigger zone
        this.createBossTrigger();
    }

    /**
     * Spawn pufferfish enemies
     * - Slow moving, explode on contact dealing AoE damage
     */
    spawnPufferfish() {
        const positions = [
            { x: 600, y: this.levelHeight - 400 },
            { x: 1300, y: this.levelHeight - 500 },
            { x: 2000, y: this.levelHeight - 600 },
            { x: 2700, y: this.levelHeight - 450 },
            { x: 3400, y: this.levelHeight - 700 },
        ];

        positions.forEach(pos => {
            const puffer = this.createPufferfish(pos.x, pos.y);
            this.pufferfish.push(puffer);
            this.enemies.add(puffer);
        });
    }

    /**
     * Create a pufferfish enemy
     */
    createPufferfish(x, y) {
        const puffer = this.add.graphics();
        puffer.setDepth(200);

        // Draw pufferfish
        const size = 30;
        const color = 0xFFD93D;  // Yellow

        // Body
        puffer.fillStyle(color, 0.9);
        puffer.fillCircle(x, y, size);

        // Spines
        puffer.fillStyle(0xAA8800, 0.9);
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const spineX = x + Math.cos(angle) * (size + 8);
            const spineY = y + Math.sin(angle) * (size + 8);
            puffer.fillTriangle(
                x + Math.cos(angle) * size, y + Math.sin(angle) * size,
                spineX - 3, spineY - 3,
                spineX + 3, spineY + 3
            );
        }

        // Eyes
        puffer.fillStyle(0x000000, 1);
        puffer.fillCircle(x - 10, y - 5, 5);
        puffer.fillCircle(x + 10, y - 5, 5);
        puffer.fillStyle(0xFFFFFF, 1);
        puffer.fillCircle(x - 8, y - 6, 2);
        puffer.fillCircle(x + 12, y - 6, 2);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(size * 2, size * 2);
        body.body.setAllowGravity(false);

        // Store reference
        body.graphics = puffer;
        body.enemyType = 'pufferfish';
        body.health = 2;
        body.baseX = x;
        body.baseY = y;
        body.phase = Math.random() * Math.PI * 2;

        return body;
    }

    /**
     * Spawn barracuda enemies
     * - Fast, charge attack in straight line
     */
    spawnBarracudas() {
        const positions = [
            { x: 800, y: this.levelHeight - 300 },
            { x: 1600, y: this.levelHeight - 600 },
            { x: 2400, y: this.levelHeight - 400 },
            { x: 3200, y: this.levelHeight - 800 },
            { x: 4000, y: this.levelHeight - 500 },
        ];

        positions.forEach(pos => {
            const barracuda = this.createBarracuda(pos.x, pos.y);
            this.barracudas.push(barracuda);
            this.enemies.add(barracuda);
        });
    }

    /**
     * Create a barracuda enemy
     */
    createBarracuda(x, y) {
        const barracuda = this.add.graphics();
        barracuda.setDepth(200);

        const length = 60;
        const height = 15;
        const color = 0x4169E1;  // Royal blue

        // Body
        barracuda.fillStyle(color, 0.9);
        barracuda.fillRoundedRect(x - length / 2, y - height / 2, length, height, 5);

        // Fins
        barracuda.fillStyle(0x1E90FF, 0.8);
        barracuda.fillTriangle(x + 10, y - height / 2, x + 25, y - height / 2 - 10, x + 25, y);
        barracuda.fillTriangle(x - 20, y + height / 2, x - 5, y + height / 2 + 8, x - 5, y);

        // Tail
        barracuda.fillTriangle(
            x - length / 2, y,
            x - length / 2 - 15, y - 12,
            x - length / 2 - 15, y + 12
        );

        // Eye
        barracuda.fillStyle(0xFF0000, 1);
        barracuda.fillCircle(x + length / 2 - 10, y - 2, 4);
        barracuda.fillStyle(0x000000, 1);
        barracuda.fillCircle(x + length / 2 - 9, y - 2, 2);

        // Teeth
        barracuda.fillStyle(0xFFFFFF, 1);
        for (let i = 0; i < 4; i++) {
            const toothX = x + length / 2 - 2 + i * 2;
            barracuda.fillTriangle(toothX, y + 2, toothX + 2, y + 2, toothX + 1, y + 5);
        }

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(length, height);
        body.body.setAllowGravity(false);

        body.graphics = barracuda;
        body.enemyType = 'barracuda';
        body.health = 3;
        body.baseX = x;
        body.baseY = y;
        body.isCharging = false;
        body.facingRight = true;

        return body;
    }

    /**
     * Spawn jellyfish hazards
     * - Static/slow drift, periodic electric shock
     */
    spawnJellyfish() {
        const positions = [
            { x: 500, y: this.levelHeight - 500 },
            { x: 1000, y: this.levelHeight - 350 },
            { x: 1800, y: this.levelHeight - 700 },
            { x: 2500, y: this.levelHeight - 550 },
            { x: 3100, y: this.levelHeight - 650 },
            { x: 3800, y: this.levelHeight - 450 },
        ];

        positions.forEach(pos => {
            const jelly = this.createJellyfish(pos.x, pos.y);
            this.jellyfish.push(jelly);
            this.enemies.add(jelly);
        });
    }

    /**
     * Create a jellyfish enemy
     */
    createJellyfish(x, y) {
        const jelly = this.add.graphics();
        jelly.setDepth(200);

        const color = 0xFF69B4;  // Hot pink

        // Bell (dome)
        jelly.fillStyle(color, 0.6);
        jelly.fillCircle(x, y, 25);
        jelly.fillStyle(color, 0.3);
        jelly.fillCircle(x, y, 35);  // Glow

        // Tentacles
        jelly.lineStyle(3, color, 0.7);
        for (let i = 0; i < 6; i++) {
            const tentX = x - 15 + i * 6;
            jelly.beginPath();
            jelly.moveTo(tentX, y + 20);
            jelly.lineTo(tentX + 5, y + 50);
            jelly.lineTo(tentX - 5, y + 80);
            jelly.lineTo(tentX + 3, y + 100);
            jelly.strokePath();
        }

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(50, 100);
        body.body.setAllowGravity(false);

        body.graphics = jelly;
        body.enemyType = 'jellyfish';
        body.health = 1;  // One-hit kill but respawns
        body.baseX = x;
        body.baseY = y;
        body.isShocking = false;
        body.shockTimer = 0;

        return body;
    }

    /**
     * Spawn anglerfish enemies
     * - Lurk in dark areas, lunge when player gets close
     */
    spawnAnglerfish() {
        const positions = [
            { x: 1400, y: this.levelHeight - 200 },  // Hidden in depth
            { x: 2800, y: this.levelHeight - 300 },
            { x: 4200, y: this.levelHeight - 250 },
        ];

        positions.forEach(pos => {
            const angler = this.createAnglerfish(pos.x, pos.y);
            this.anglerfish.push(angler);
            this.enemies.add(angler);
        });
    }

    /**
     * Create an anglerfish enemy
     */
    createAnglerfish(x, y) {
        const angler = this.add.graphics();
        angler.setDepth(200);

        const size = 45;

        // Body - dark, menacing
        angler.fillStyle(0x1A1A2E, 0.95);
        angler.fillCircle(x, y, size);

        // Mouth
        angler.fillStyle(0x2D1B3D, 1);
        angler.fillCircle(x + 30, y, 25);

        // Teeth
        angler.fillStyle(0xFFFFFF, 1);
        for (let i = 0; i < 8; i++) {
            const angle = -0.5 + (i / 8) * 1;
            const toothX = x + 30 + Math.cos(angle) * 20;
            const toothY = y + Math.sin(angle) * 20;
            angler.fillTriangle(
                toothX, toothY,
                toothX + Math.cos(angle) * 10, toothY + Math.sin(angle) * 10,
                toothX + 5, toothY + 5
            );
        }

        // Glowing lure
        angler.fillStyle(0x00FF00, 1);
        angler.fillCircle(x + 60, y - 30, 8);
        angler.fillStyle(0x00FF00, 0.3);
        angler.fillCircle(x + 60, y - 30, 15);

        // Eye
        angler.fillStyle(0xFF0000, 1);
        angler.fillCircle(x - 10, y - 10, 8);
        angler.fillStyle(0x000000, 1);
        angler.fillCircle(x - 8, y - 10, 4);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(size * 2 + 20, size * 2);
        body.body.setAllowGravity(false);

        body.graphics = angler;
        body.enemyType = 'anglerfish';
        body.health = 4;
        body.baseX = x;
        body.baseY = y;
        body.isLurking = true;
        body.isLunging = false;

        return body;
    }

    /**
     * Update enemies AI and animations
     */
    updateEnemies(time, delta) {
        // Update pufferfish - slow patrol
        this.pufferfish.forEach(puffer => {
            if (!puffer.active) return;

            const wobble = Math.sin(time / 1000 + puffer.phase) * 30;
            puffer.x = puffer.baseX + wobble;
            puffer.y = puffer.baseY + Math.sin(time / 800 + puffer.phase) * 15;

            // Update graphics position
            this.updateEnemyGraphics(puffer);
        });

        // Update barracudas - patrol and charge
        this.barracudas.forEach(barracuda => {
            if (!barracuda.active) return;
            this.updateBarracudaAI(barracuda, time);
        });

        // Update jellyfish - drift and shock
        this.jellyfish.forEach(jelly => {
            if (!jelly.active) return;
            this.updateJellyfishAI(jelly, time);
        });

        // Update anglerfish - lurk and lunge
        this.anglerfish.forEach(angler => {
            if (!angler.active) return;
            this.updateAnglerfishAI(angler, time);
        });
    }

    /**
     * Update enemy graphics position
     */
    updateEnemyGraphics(enemy) {
        if (enemy.graphics) {
            const dx = enemy.x - enemy.baseX;
            const dy = enemy.y - enemy.baseY;
            enemy.graphics.x = dx;
            enemy.graphics.y = dy;
        }
    }

    /**
     * Barracuda AI - patrol and charge at player
     */
    updateBarracudaAI(barracuda, time) {
        const distToPlayer = Phaser.Math.Distance.Between(
            barracuda.x, barracuda.y,
            this.player.x, this.player.y
        );

        if (barracuda.isCharging) {
            // Continue charge
            if (barracuda.chargeTime && time > barracuda.chargeTime + 1500) {
                barracuda.isCharging = false;
                barracuda.setVelocity(0, 0);
            }
        } else {
            // Patrol movement
            const patrol = Math.sin(time / 2000 + barracuda.baseX) * 100;
            barracuda.x = barracuda.baseX + patrol;

            // Check for charge
            if (distToPlayer < 300 && Math.random() > 0.99) {
                // Start charge!
                barracuda.isCharging = true;
                barracuda.chargeTime = time;

                const angle = Phaser.Math.Angle.Between(
                    barracuda.x, barracuda.y,
                    this.player.x, this.player.y
                );

                barracuda.setVelocity(
                    Math.cos(angle) * 400,
                    Math.sin(angle) * 400
                );

                barracuda.facingRight = this.player.x > barracuda.x;
            }
        }

        this.updateEnemyGraphics(barracuda);
        barracuda.graphics.setFlipX(!barracuda.facingRight);
    }

    /**
     * Jellyfish AI - drift and shock
     */
    updateJellyfishAI(jelly, time) {
        // Gentle drift
        const driftX = Math.sin(time / 3000 + jelly.baseX) * 20;
        const driftY = Math.sin(time / 2000 + jelly.baseY) * 30;

        jelly.x = jelly.baseX + driftX;
        jelly.y = jelly.baseY + driftY;

        // Periodic shock
        if (time > jelly.shockTimer + 3000) {
            jelly.shockTimer = time;
            jelly.isShocking = true;

            // Visual shock effect
            if (jelly.graphics) {
                this.tweens.add({
                    targets: jelly.graphics,
                    alpha: 0.3,
                    duration: 200,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => {
                        jelly.isShocking = false;
                    }
                });
            }
        }

        this.updateEnemyGraphics(jelly);
    }

    /**
     * Anglerfish AI - lurk and lunge
     */
    updateAnglerfishAI(angler, time) {
        const distToPlayer = Phaser.Math.Distance.Between(
            angler.x, angler.y,
            this.player.x, this.player.y
        );

        if (angler.isLurking) {
            // Wait for player to get close
            if (distToPlayer < 200) {
                angler.isLurking = false;
                angler.isLunging = true;

                // Lunge at player!
                const angle = Phaser.Math.Angle.Between(
                    angler.x, angler.y,
                    this.player.x, this.player.y
                );

                angler.setVelocity(
                    Math.cos(angle) * 300,
                    Math.sin(angle) * 300
                );

                // Return after lunge
                this.time.delayedCall(1000, () => {
                    angler.isLunging = false;

                    // Return to base
                    this.tweens.add({
                        targets: angler,
                        x: angler.baseX,
                        y: angler.baseY,
                        duration: 2000,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            angler.isLurking = true;
                            angler.setVelocity(0, 0);
                        }
                    });
                });
            }
        }

        this.updateEnemyGraphics(angler);
    }

    /**
     * Spawn coral pearls (collectibles)
     */
    spawnCoralPearls() {
        const positions = [
            { x: 450, y: this.levelHeight - 350 },
            { x: 1200, y: this.levelHeight - 650 },
            { x: 2100, y: this.levelHeight - 750 },
            { x: 3000, y: this.levelHeight - 550 },
            { x: 3900, y: this.levelHeight - 650 },
        ];

        positions.forEach((pos, index) => {
            const pearl = this.createCoralPearl(pos.x, pos.y, index);
            this.pearls.push(pearl);
        });
    }

    /**
     * Create a coral pearl collectible
     */
    createCoralPearl(x, y, index) {
        const pearl = this.add.graphics();
        pearl.setDepth(250);

        // Glowing pearl
        pearl.fillStyle(0xFF69B4, 0.3);
        pearl.fillCircle(x, y, 25);
        pearl.fillStyle(0xFF69B4, 0.6);
        pearl.fillCircle(x, y, 15);
        pearl.fillStyle(0xFFFFFF, 0.9);
        pearl.fillCircle(x, y, 8);

        // Shimmer
        pearl.fillStyle(0xFFFFFF, 0.5);
        pearl.fillCircle(x - 3, y - 3, 3);

        // Physics body for collection
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(30, 30);
        body.body.setAllowGravity(false);
        body.graphics = pearl;
        body.pearlIndex = index;

        // Collection overlap
        this.physics.add.overlap(this.player, body, () => this.collectPearl(body));

        // Pulse animation
        this.tweens.add({
            targets: pearl,
            alpha: 0.6,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return body;
    }

    /**
     * Collect a coral pearl
     */
    collectPearl(pearl) {
        if (!pearl.active) return;

        pearl.active = false;
        this.pearlsCollected++;

        // Effects
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, pearl.x, pearl.y, {
                count: 15,
                color: [0xFF69B4, 0xFFFFFF, 0x00CED1],
                duration: 1000
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playCoinCollect();
        }

        // Destroy graphics
        pearl.graphics?.destroy();
        pearl.destroy();

        // Update HUD
        this.showFloatingText(`Pearl ${this.pearlsCollected}/${this.totalPearls}`, pearl.x, pearl.y - 30, '#FF69B4');

        console.log(`[ReefLevel] Collected pearl ${this.pearlsCollected}/${this.totalPearls}`);
    }

    /**
     * Spawn trapped travelers to rescue
     */
    spawnTrappedTravelers() {
        const positions = [
            { x: 900, y: this.levelHeight - 400 },
            { x: 2300, y: this.levelHeight - 700 },
            { x: 3600, y: this.levelHeight - 550 },
        ];

        positions.forEach((pos, index) => {
            const traveler = this.createTrappedTraveler(pos.x, pos.y, index);
            this.trappedTravelers.push(traveler);
        });
    }

    /**
     * Create a trapped traveler
     */
    createTrappedTraveler(x, y, index) {
        const traveler = this.add.graphics();
        traveler.setDepth(250);

        // Draw trapped figure in bubble
        // Bubble cage
        traveler.lineStyle(3, 0x00FF00, 0.6);
        traveler.strokeCircle(x, y, 35);
        traveler.fillStyle(0x00FF00, 0.1);
        traveler.fillCircle(x, y, 35);

        // Figure inside
        traveler.fillStyle(0x8888FF, 0.9);
        traveler.fillCircle(x, y - 10, 12);  // Head
        traveler.fillRoundedRect(x - 8, y, 16, 20, 4);  // Body

        // Help text
        const helpText = this.add.text(x, y - 55, '❓', {
            fontSize: '24px'
        }).setOrigin(0.5).setDepth(251);

        // Physics body
        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(70, 70);
        body.body.setAllowGravity(false);
        body.graphics = traveler;
        body.helpText = helpText;
        body.travelerIndex = index;

        // Rescue overlap
        this.physics.add.overlap(this.player, body, () => this.rescueTraveler(body));

        return body;
    }

    /**
     * Rescue a trapped traveler
     */
    rescueTraveler(traveler) {
        if (!traveler.active) return;

        traveler.active = false;
        this.travelersFreed++;

        // Effects
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, traveler.x, traveler.y, {
                count: 20,
                color: [0x00FF00, 0xFFFFFF, 0x8888FF],
                duration: 1500
            });
        }

        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        // Thank you message
        this.showFloatingText('Thank you!', traveler.x, traveler.y - 50, '#00FF00');
        this.showFloatingText(`Rescued ${this.travelersFreed}/${this.totalTravelers}`, traveler.x, traveler.y - 80, '#FFFFFF');

        // Destroy
        traveler.graphics?.destroy();
        traveler.helpText?.destroy();
        traveler.destroy();

        console.log(`[ReefLevel] Rescued traveler ${this.travelersFreed}/${this.totalTravelers}`);
    }

    /**
     * Create water current zones
     */
    createCurrentZones() {
        const currents = [
            { x: 1000, y: 200, width: 300, height: 400, dirX: 0, dirY: 100 },  // Downward
            { x: 2000, y: 400, width: 200, height: 500, dirX: 0, dirY: -150 }, // Upward
            { x: 3500, y: 300, width: 400, height: 300, dirX: 200, dirY: 0 },  // Rightward
        ];

        currents.forEach(current => {
            const zone = this.add.zone(
                current.x + current.width / 2,
                current.y + current.height / 2,
                current.width,
                current.height
            );

            this.physics.add.existing(zone, true);

            // Visual indicator (subtle particles)
            const indicator = this.add.graphics();
            indicator.setDepth(-10);
            indicator.fillStyle(0x00CED1, 0.1);
            indicator.fillRect(current.x, current.y, current.width, current.height);

            // Store current data
            zone.currentDir = { x: current.dirX, y: current.dirY };

            // Apply current force when player overlaps
            this.physics.add.overlap(this.player, zone, () => {
                this.player.body.velocity.x += zone.currentDir.x * 0.1;
                this.player.body.velocity.y += zone.currentDir.y * 0.1;
            });

            this.currentZones.push(zone);
        });
    }

    /**
     * Create boss trigger zone
     */
    createBossTrigger() {
        // Boss area starts at x: 5000
        const triggerZone = this.add.zone(5000, this.levelHeight / 2, 100, this.levelHeight);
        this.physics.add.existing(triggerZone, true);

        this.physics.add.overlap(this.player, triggerZone, () => {
            if (!this.bossFightActive && !this.bossDefeated) {
                this.startBossFight();
            }
        });
    }

    /**
     * Start the boss fight with Typhonix
     */
    startBossFight() {
        this.bossFightActive = true;
        this.bossHealth = this.bossMaxHealth;

        console.log('[ReefLevel] BOSS FIGHT: Typhonix the Void Moray!');

        // Lock camera to boss arena
        this.cameras.main.stopFollow();
        this.cameras.main.pan(5400, this.levelHeight / 2, 1000);

        // Dramatic intro
        this.showBossIntro();
    }

    /**
     * Show boss intro sequence
     */
    showBossIntro() {
        const { width, height } = this.cameras.main;

        // Darken screen
        const darkness = this.add.graphics();
        darkness.fillStyle(0x000000, 0.7);
        darkness.fillRect(4800, 0, 1200, this.levelHeight);
        darkness.setDepth(2000);

        // Boss name reveal
        const bossTitle = this.add.text(5400, 200, 'TYPHONIX', {
            fontSize: '48px',
            color: '#FF0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(2001).setAlpha(0);

        const bossSubtitle = this.add.text(5400, 260, 'The Void Moray', {
            fontSize: '24px',
            color: '#FF6666',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(2001).setAlpha(0);

        // Animate intro
        this.tweens.add({
            targets: [bossTitle, bossSubtitle],
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: [darkness, bossTitle, bossSubtitle],
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            darkness.destroy();
                            bossTitle.destroy();
                            bossSubtitle.destroy();

                            // Spawn boss
                            this.spawnTyphonix();
                        }
                    });
                });
            }
        });

        // Play boss music
        if (window.AudioManager && window.AudioManager.playBossMusic) {
            window.AudioManager.playBossMusic();
        }
    }

    /**
     * Spawn Typhonix the Void Moray boss
     */
    spawnTyphonix() {
        const bossX = 5600;
        const bossY = this.levelHeight - 400;

        // Create boss graphics
        this.boss = this.add.graphics();
        this.boss.setDepth(300);

        this.drawTyphonix(bossX, bossY, 1);

        // Boss physics body
        this.bossBody = this.physics.add.sprite(bossX, bossY, null);
        this.bossBody.setVisible(false);
        this.bossBody.body.setSize(200, 80);
        this.bossBody.body.setAllowGravity(false);

        // Boss collision
        this.physics.add.overlap(this.player, this.bossBody, () => {
            this.takeDamage(2);  // Boss deals 2 damage
        });

        // Create boss health bar
        this.createBossHealthBar();

        // Start boss AI
        this.startBossAI();
    }

    /**
     * Draw Typhonix the Void Moray
     */
    drawTyphonix(x, y, phase) {
        this.boss.clear();

        const length = 250;
        const bodyWidth = 50;

        // Colors based on phase
        const colors = {
            1: { body: 0x4B0082, glow: 0x8A2BE2 },
            2: { body: 0x800000, glow: 0xFF4500 },
            3: { body: 0x000000, glow: 0xFF0000 }
        };

        const color = colors[phase] || colors[1];

        // Body segments (serpentine)
        const segments = 8;
        let prevX = x;
        let prevY = y;

        for (let i = 0; i < segments; i++) {
            const segmentWidth = bodyWidth * (1 - i * 0.08);
            const wave = Math.sin(this.time.now / 300 + i * 0.5) * 20;

            const segX = x - i * (length / segments);
            const segY = y + wave;

            // Body segment
            this.boss.fillStyle(color.body, 0.9);
            this.boss.fillCircle(segX, segY, segmentWidth / 2);

            // Spine
            this.boss.fillStyle(color.glow, 0.5);
            this.boss.fillCircle(segX, segY - segmentWidth / 3, 5);

            prevX = segX;
            prevY = segY;
        }

        // Head
        this.boss.fillStyle(color.body, 1);
        this.boss.fillCircle(x + 40, y, 35);

        // Jaws
        this.boss.fillStyle(0x1A1A1A, 1);
        this.boss.fillCircle(x + 70, y, 20);

        // Teeth
        this.boss.fillStyle(0xFFFFFF, 1);
        for (let i = 0; i < 6; i++) {
            const angle = -0.4 + (i / 6) * 0.8;
            const toothX = x + 70 + Math.cos(angle) * 18;
            const toothY = y + Math.sin(angle) * 18;
            this.boss.fillTriangle(
                toothX, toothY,
                toothX + Math.cos(angle) * 15, toothY + Math.sin(angle) * 15,
                toothX + 5, toothY + 5
            );
        }

        // Eyes (glowing)
        this.boss.fillStyle(color.glow, 1);
        this.boss.fillCircle(x + 30, y - 15, 10);
        this.boss.fillStyle(0xFF0000, 1);
        this.boss.fillCircle(x + 32, y - 15, 5);

        // Void energy aura
        this.boss.fillStyle(color.glow, 0.2);
        this.boss.fillCircle(x, y, 100);
    }

    /**
     * Create boss health bar
     */
    createBossHealthBar() {
        const barWidth = 300;
        const barHeight = 20;
        const x = 5400 - barWidth / 2;
        const y = 50;

        // Background
        this.bossHealthBg = this.add.graphics();
        this.bossHealthBg.setScrollFactor(0);
        this.bossHealthBg.setDepth(1000);
        this.bossHealthBg.fillStyle(0x333333, 0.8);
        this.bossHealthBg.fillRoundedRect(x - 5, y - 5, barWidth + 10, barHeight + 10, 5);

        // Health bar
        this.bossHealthBar = this.add.graphics();
        this.bossHealthBar.setScrollFactor(0);
        this.bossHealthBar.setDepth(1001);

        // Boss name
        this.bossNameText = this.add.text(5400, y - 25, 'TYPHONIX', {
            fontSize: '20px',
            color: '#FF4444',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        this.updateBossHealthBar();
    }

    /**
     * Update boss health bar display
     */
    updateBossHealthBar() {
        const barWidth = 300;
        const barHeight = 20;
        const x = 5400 - barWidth / 2;
        const y = 50;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;

        // Color based on health
        let color = 0x00FF00;
        if (healthPercent < 0.3) color = 0xFF0000;
        else if (healthPercent < 0.6) color = 0xFFFF00;

        this.bossHealthBar.fillStyle(color, 1);
        this.bossHealthBar.fillRoundedRect(x, y, barWidth * healthPercent, barHeight, 3);
    }

    /**
     * Start boss AI patterns
     */
    startBossAI() {
        // Boss attack pattern timer
        this.bossAttackTimer = this.time.addEvent({
            delay: 3000,
            callback: () => this.bossAttack(),
            loop: true
        });
    }

    /**
     * Boss attack patterns
     */
    bossAttack() {
        if (!this.bossFightActive || this.bossDefeated) return;

        const attacks = ['lunge', 'inkCloud', 'summonMinions'];
        const attack = Phaser.Utils.Array.GetRandom(attacks);

        console.log(`[ReefLevel] Boss attack: ${attack}`);

        switch (attack) {
            case 'lunge':
                this.bossLungeAttack();
                break;
            case 'inkCloud':
                this.bossInkCloudAttack();
                break;
            case 'summonMinions':
                this.bossSummonMinions();
                break;
        }
    }

    /**
     * Boss lunge attack
     */
    bossLungeAttack() {
        if (!this.bossBody) return;

        const targetX = this.player.x;
        const targetY = this.player.y;

        // Telegraph
        this.tweens.add({
            targets: this.boss,
            alpha: 0.5,
            duration: 300,
            yoyo: true,
            onComplete: () => {
                // Lunge!
                this.tweens.add({
                    targets: this.bossBody,
                    x: targetX,
                    y: targetY,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        // Return
                        this.tweens.add({
                            targets: this.bossBody,
                            x: 5600,
                            y: this.levelHeight - 400,
                            duration: 1000,
                            ease: 'Sine.easeInOut'
                        });
                    }
                });
            }
        });
    }

    /**
     * Boss ink cloud attack
     */
    bossInkCloudAttack() {
        // Create ink cloud that obscures vision
        const ink = this.add.graphics();
        ink.setDepth(500);
        ink.fillStyle(0x000000, 0.8);
        ink.fillCircle(this.player.x, this.player.y, 150);

        // Fade out
        this.tweens.add({
            targets: ink,
            alpha: 0,
            duration: 3000,
            onComplete: () => ink.destroy()
        });
    }

    /**
     * Boss summon minions attack
     */
    bossSummonMinions() {
        // Summon small void fish
        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 300, () => {
                const minion = this.createVoidMinion(
                    5600 + Math.random() * 100,
                    this.levelHeight - 300 + Math.random() * 200
                );
                this.bossMinions.push(minion);
            });
        }
    }

    /**
     * Create a void minion
     */
    createVoidMinion(x, y) {
        const minion = this.add.graphics();
        minion.setDepth(280);

        minion.fillStyle(0x4B0082, 0.8);
        minion.fillCircle(x, y, 15);
        minion.fillStyle(0x8A2BE2, 0.4);
        minion.fillCircle(x, y, 25);

        const body = this.physics.add.sprite(x, y, null);
        body.setVisible(false);
        body.body.setSize(30, 30);
        body.body.setAllowGravity(false);
        body.graphics = minion;
        body.health = 1;

        // Chase player
        this.tweens.add({
            targets: body,
            x: this.player.x,
            y: this.player.y,
            duration: 2000,
            ease: 'Linear',
            onUpdate: () => {
                minion.x = body.x - x;
                minion.y = body.y - y;
            }
        });

        // Collision
        this.physics.add.overlap(this.player, body, () => {
            this.takeDamage(1);
            body.destroy();
            minion.destroy();
        });

        return body;
    }

    /**
     * Update boss during fight
     */
    updateBoss(time, delta) {
        if (!this.boss || !this.bossBody) return;

        // Update boss graphics position
        this.drawTyphonix(this.bossBody.x, this.bossBody.y, this.bossPhase);

        // Check phase transitions
        const healthPercent = this.bossHealth / this.bossMaxHealth;

        if (healthPercent < 0.3 && this.bossPhase < 3) {
            this.bossPhase = 3;
            console.log('[ReefLevel] Boss entering phase 3!');
            // Speed up attacks
            if (this.bossAttackTimer) {
                this.bossAttackTimer.delay = 1500;
            }
        } else if (healthPercent < 0.6 && this.bossPhase < 2) {
            this.bossPhase = 2;
            console.log('[ReefLevel] Boss entering phase 2!');
            if (this.bossAttackTimer) {
                this.bossAttackTimer.delay = 2000;
            }
        }
    }

    /**
     * Override performAttack for underwater combat
     */
    performAttack() {
        console.log('[ReefLevel] Underwater melee attack');

        // Create water slash effect
        const slashX = this.player.facingRight ? this.player.x + 60 : this.player.x - 60;
        const slashY = this.player.y;

        const slash = this.add.graphics();
        slash.setDepth(300);

        // Bubble burst attack visual
        slash.fillStyle(0x00CED1, 0.6);
        slash.fillCircle(slashX, slashY, 40);
        slash.lineStyle(3, 0xFFFFFF, 0.8);
        slash.strokeCircle(slashX, slashY, 40);

        // Animate and check hits
        this.tweens.add({
            targets: slash,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            onComplete: () => slash.destroy()
        });

        // Check enemy hits
        this.enemies.children.each(enemy => {
            if (!enemy.active) return;

            const dist = Phaser.Math.Distance.Between(slashX, slashY, enemy.x, enemy.y);
            if (dist < 60) {
                this.damageEnemy(enemy, 1);
            }
        });

        // Check boss hit
        if (this.bossFightActive && this.bossBody) {
            const distToBoss = Phaser.Math.Distance.Between(slashX, slashY, this.bossBody.x, this.bossBody.y);
            if (distToBoss < 100) {
                this.damageBoss(1);
            }
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Damage an enemy
     */
    damageEnemy(enemy, amount) {
        enemy.health -= amount;

        // Flash red
        if (enemy.graphics) {
            this.tweens.add({
                targets: enemy.graphics,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 2
            });
        }

        if (enemy.health <= 0) {
            this.defeatEnemy(enemy);
        }
    }

    /**
     * Damage the boss
     */
    damageBoss(amount) {
        this.bossHealth -= amount;
        this.updateBossHealthBar();

        // Flash effect
        this.tweens.add({
            targets: this.boss,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 2
        });

        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        if (this.bossHealth <= 0) {
            this.defeatBoss();
        }
    }

    /**
     * Defeat the boss
     */
    defeatBoss() {
        console.log('[ReefLevel] BOSS DEFEATED: Typhonix has fallen!');

        this.bossDefeated = true;
        this.bossFightActive = false;

        // Stop attack timer
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }

        // Epic death animation
        this.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 2000,
            ease: 'Power2'
        });

        // Explosion particles
        if (window.FXLibrary) {
            for (let i = 0; i < 5; i++) {
                this.time.delayedCall(i * 300, () => {
                    window.FXLibrary.stardustBurst(this,
                        this.bossBody.x + (Math.random() - 0.5) * 100,
                        this.bossBody.y + (Math.random() - 0.5) * 50,
                        {
                            count: 30,
                            color: [0xFF0000, 0x8A2BE2, 0x4B0082, 0xFFFFFF],
                            duration: 2000
                        }
                    );
                });
            }
        }

        // Victory screen
        this.time.delayedCall(2500, () => {
            this.showVictoryScreen();
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Show victory screen
     */
    showVictoryScreen() {
        const { width, height } = this.cameras.main;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x001830, 0.9);
        overlay.fillRect(0, 0, width + 1000, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        const victoryText = this.add.text(width / 2, height / 2 - 80, '🎉 REEF CLEANSED! 🎉', {
            fontSize: '36px',
            color: '#00CED1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const statsText = this.add.text(width / 2, height / 2,
            `Pearls: ${this.pearlsCollected}/${this.totalPearls}\n` +
            `Travelers Rescued: ${this.travelersFreed}/${this.totalTravelers}\n` +
            `Typhonix Defeated: ✓`, {
            fontSize: '20px',
            color: '#FFFFFF',
            align: 'center',
            lineSpacing: 10
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const continueBtn = this.add.text(width / 2, height / 2 + 120, '[ RETURN TO SANCTUARY ]', {
            fontSize: '20px',
            color: '#00CED1',
            backgroundColor: '#0A2840',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001).setInteractive();

        continueBtn.on('pointerdown', () => {
            this.returnToSanctuary();
        });
    }

    /**
     * Show floating text
     */
    showFloatingText(text, x, y, color = '#FFFFFF') {
        const floatText = this.add.text(x, y, text, {
            fontSize: '18px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: floatText,
            y: y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => floatText.destroy()
        });
    }

    /**
     * Override shutdown for cleanup
     */
    shutdown() {
        console.log('[ReefLevel] Shutting down');

        // Clean up boss
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }

        // Clean up seaweed
        if (this.seaweedList) {
            this.seaweedList.forEach(sw => sw.graphics?.destroy());
            this.seaweedList = [];
        }

        // Clean up caustic rays
        if (this.causticRays) {
            this.causticRays.forEach(ray => ray.graphics?.destroy());
            this.causticRays = [];
        }

        // Call parent shutdown
        super.shutdown();
    }
}

// Export
export default ReefLevel;

if (typeof window !== 'undefined') {
    window.ReefLevel = ReefLevel;
}
