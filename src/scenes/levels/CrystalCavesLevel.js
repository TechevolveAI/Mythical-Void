import PlatformerLevelScene from '../PlatformerLevelScene.js';
import {
    buildCreaturePowerProfile,
    recordCreaturePowerEvent
} from '../../systems/CreaturePowerProfile.js';

const CRYSTAL_GUARDIAN_TEXTURE = 'crystalGuardianArtwork';
const CRYSTAL_GUARDIAN_ASSET = '/game/guardians/crystal-guardian.webp';
const CRYSTAL_GUARDIAN_DISPLAY_HEIGHT = 190;

const CRYSTAL_GUARDIAN_ATTACK_WINDOWS = Object.freeze({
    ground_slam: 1400,
    crystal_barrage: 2600,
    charge: 1700
});

const CRYSTAL_GUARDIAN_ATTACK_CUES = Object.freeze({
    ground_slam: 'GROUND PULSE // JUMP',
    crystal_barrage: 'CRYSTAL BARRAGE // MOVE BETWEEN SHOTS',
    charge: 'GUARDIAN CHARGE // GET BEHIND IT'
});

/**
 * CrystalCavesLevel - Crystal Caves platformer level
 *
 * Story: "Ancient extraction scars still interrupt the living pulse of these caves.
 * The astronaut enters looking for a ship system, but the companion first stops
 * to tend the damage. The Crystal Guardian must be stabilized before it can trust
 * them with the Core."
 *
 * Features:
 * - Dynamic lighting: Player glow + crystal proximity activation
 * - Crystal Spider miniboss: Mid-level challenge with web/pounce attacks
 * - Secret slide: Hidden path to Crystal Shield power-up (15s invincibility)
 * - Boss arena: Crystal Pillars (cover), Stalactites (hazard), Power Well (energy regen)
 *
 * Objectives:
 * - Primary: Find the Crystal Core Engine (ship part)
 * - Secondary: Tend the fractured grove, activate Beacon anchors, collect 5 Star Fragments
 * - Bonus: Collect all Star Fragments for a special Cosmic Egg reward!
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

        // MOBILE-OPTIMIZED PHYSICS: More responsive controls
        this.playerSpeed = 220;           // Faster movement (was 180 default)
        this.jumpVelocity = -460;         // Higher jumps (was -420 default)
        this.playerAcceleration = 0.22;   // Faster acceleration (was 0.15 default)
        this.playerDeceleration = 0.68;   // Quicker stops (was 0.75 default)
        this.coyoteTime = 150;            // More forgiving jump timing (was 100ms)
        this.jumpBufferTime = 150;        // More forgiving jump buffer (was 100ms)

        // Level-specific state
        this.starFragmentsCollected = 0;
        this.totalStarFragments = 5;
        this.cosmicEggAwarded = false;
        this.bossDefeated = false;
        this.crystalCoreFound = false;  // Renamed from crystalHeartFound
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 8;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossPulseText = null;
        this.bossInstructionText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossAttackPreview = null;
        this.bossTargetScale = 1;

        // Enemy spawns
        this.enemySpawns = [];

        // Ambient audio controller
        this.ambientAudio = null;

        // Dynamic lighting system
        this.playerGlow = null;
        this.playerGlowRadius = 150;
        this.backgroundCrystals = []; // Track crystals for proximity activation
        this.crystalProximityDistance = 200;

        // Project Beacon expedition state
        this.beaconAnchors = [];
        this.beaconAnchorsActivated = 0;
        this.caveRouteAligned = false;
        this.crystalWoundTended = false;
        this.woundedCrystalGrove = null;
        this.coreGateHintUntil = 0;
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    preload() {
        super.preload();
        this.load.image(CRYSTAL_GUARDIAN_TEXTURE, CRYSTAL_GUARDIAN_ASSET);
    }

    /**
     * Override init to reset level-specific state on restart
     */
    init(data) {
        // Call parent init first (resets base game state)
        super.init(data);
        this.testMode = data?.testMode || false;

        // Reset level-specific state
        this.starFragmentsCollected = 0;
        this.cosmicEggAwarded = false;
        this.bossDefeated = false;
        this.crystalCoreFound = false;  // Renamed from crystalHeartFound
        this.bossFightActive = false;
        this.enemySpawns = [];

        // Reset boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossPulseText = null;
        this.bossInstructionText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossTargetScale = 1;
        this.bossAttackPreview = [
            'ground_slam',
            'crystal_barrage',
            'charge'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;

        // Reset ambient audio
        this.ambientAudio = null;

        // Reset lighting
        this.playerGlow = null;
        this.backgroundCrystals = [];
        this.beaconAnchors = [];
        this.beaconAnchorsActivated = 0;
        this.caveRouteAligned = false;
        this.crystalWoundTended = false;
        this.woundedCrystalGrove = null;
        this.coreGateHintUntil = 0;
        this.levelEntryDismissing = false;
        this.clearLevelEntryKeyHandler();

        console.log('[CrystalCavesLevel] Level-specific state reset for restart');
    }

    create() {
        // Call parent create
        super.create();

        // Record level entry for achievements
        if (!this.entryPreview && window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'crystalCaves' });
        }

        // Track start time for speedrun achievements
        this.levelStartTime = Date.now();
        this.damageTaken = 0;

        if (this.testMode) {
            this.startTestMode();
        } else {
            this.showLevelEntry();
        }
    }

    startTestMode() {
        console.log('[CrystalCavesLevel] TEST MODE - Spawning Crystal Golem');

        if (this.player) {
            this.player.setPosition(this.levelWidth - 900, this.levelHeight - 200);
        }

        this.time.delayedCall(300, () => {
            this.crystalCoreFound = true;
            this.startBossFight();
        });
    }

    /**
     * Show level entry screen with objectives
     */
    showLevelEntry() {
        this.levelEntryDismissing = false;
        const layout = this.getLevelModalLayout({ maxWidth: 450, maxHeight: 400 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, contentRight, y, font, buttonPadding
        } = layout;
        const resume = this.getExpeditionResumePresentation();
        const companionName = this.getCompanionName();

        // Pause game briefly
        this.physics.pause();

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel background
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
        const title = this.add.text(width / 2, y(48), 'CRYSTAL CAVES', {
            fontSize: font(36, 28),
            color: '#7B68EE',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Subtitle
        const subtitle = this.add.text(width / 2, y(86), `"${companionName} hears pain beneath the stone"`, {
            fontSize: font(16, 14),
            color: '#9370DB',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x7B68EE, 0.5);
        divider.lineBetween(contentLeft, y(116), contentRight, y(116));
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Objective header
        const objHeader = this.add.text(
            width / 2,
            y(140),
            resume
                ? `PROJECT BEACON // RESUME ${resume.current}/${resume.total}`
                : 'PROJECT BEACON // EXPEDITION 02',
            {
            fontSize: font(14, 12),
            color: '#888888'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Main objective
        const mainObj = this.add.text(width / 2, y(172), 'Answer the wounded Current and reach the Crystal Core', {
            fontSize: font(20, 17),
            color: '#00FFFF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Secondary objectives
        const secondaryY = y(220);
        const anchors = this.add.text(
            contentLeft,
            secondaryY,
            resume
                ? `[ BEACON ] ${resume.label} link restored`
                : '[ REQUIRED ] Follow 3 Beacon pulses',
            {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            wordWrap: { width: contentWidth }
            }
        ).setScrollFactor(0).setDepth(3002);

        const grove = this.add.text(contentLeft, y(250), '[ REQUIRED ] Reach the fractured grove', {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);

        const relic = this.add.text(contentLeft, y(280), '[ OPTIONAL ] Collect 5 Star Fragments', {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);

        // Enter button
        const enterBtn = this.add.text(
            width / 2,
            y(340),
            resume ? '[ RESUME EXPEDITION ]' : '[ ENTER THE CAVES ]',
            {
            fontSize: font(20, 17),
            color: '#7B68EE',
            backgroundColor: '#2D1B3D',
            padding: buttonPadding
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        // Button hover effects
        enterBtn.on('pointerover', () => {
            enterBtn.setColor('#E040FB');
            enterBtn.setScale(1.05);
        });
        enterBtn.on('pointerout', () => {
            enterBtn.setColor('#7B68EE');
            enterBtn.setScale(1.0);
        });

        // Collect all elements for proper cleanup
        const allElements = [overlay, panel, title, subtitle, divider, objHeader, mainObj, anchors, grove, relic, enterBtn];

        // Dismiss function - used by button and tap anywhere
        const dismissEntry = () => {
            if (this.levelEntryDismissing) return;

            this.levelEntryDismissing = true;
            enterBtn.disableInteractive();
            overlay.disableInteractive();
            this.clearLevelEntryKeyHandler();
            this.physics.resume();
            this.showPlatformerMobileControls();
            this.tweens.add({
                targets: allElements,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    allElements.forEach(el => {
                        if (el && el.destroy) el.destroy();
                    });
                }
            });
        };

        enterBtn.on('pointerdown', dismissEntry);

        // Also allow tapping anywhere on overlay to dismiss (mobile-friendly)
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', dismissEntry);

        this.levelEntryKeyHandler = event => {
            if (!['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            dismissEntry();
        };
        window.addEventListener('keydown', this.levelEntryKeyHandler);

        // Pulsing animation on button
        this.tweens.add({
            targets: enterBtn,
            alpha: { from: 0.8, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }

    clearLevelEntryKeyHandler() {
        if (!this.levelEntryKeyHandler) return;

        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.levelEntryKeyHandler);
        }
        this.levelEntryKeyHandler = null;
    }

    getCompanionName() {
        return String(
            window.GameState?.get?.('creature.name') || 'Your companion'
        ).trim().replace(/\s+/g, ' ').slice(0, 20) || 'Your companion';
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

        // ===== SIMPLIFIED GROUND - ONLY 2 GAPS with clear bridge routes =====
        // Gap 1: At x=1400-1600 (200px) - Optional challenge with bridge above
        // Gap 2: At x=3200-3400 (200px) - Before boss with bridge

        this.createPlatform(0, this.levelHeight - 50, 1400, 80, 'solid');      // Start to first gap (continuous)
        this.createPlatform(1600, this.levelHeight - 50, 1600, 80, 'solid');   // After gap 1 to gap 2
        this.createPlatform(3400, this.levelHeight - 50, 1600, 80, 'solid');   // Boss arena (continuous)

        // ===== SECTION 1: Tutorial Zone (0-800px) =====
        // Simple introductory platforms - no danger, learn jumping
        this.createPlatform(200, this.levelHeight - 150, 220, 25, 'solid');   // First platform
        this.createPlatform(500, this.levelHeight - 150, 200, 25, 'solid');   // Same height (easy hop)
        this.createPlatform(780, this.levelHeight - 220, 180, 25, 'solid');   // Slight elevation

        // ===== SECTION 2: Exploration Zone (800-1400px) =====
        // Optional vertical exploration before first gap
        this.createPlatform(950, this.levelHeight - 150, 180, 25, 'solid');   // Ground level step
        this.createPlatform(1150, this.levelHeight - 220, 200, 25, 'solid');  // Medium height

        // Upper path for collectibles (optional)
        this.createPlatform(1000, this.levelHeight - 350, 150, 20, 'one-way'); // Upper exploration
        this.createPlatform(1200, this.levelHeight - 420, 140, 20, 'one-way'); // Secret area access

        // ===== GAP 1 BRIDGE (x=1400-1600) - Easy to cross =====
        // Wide, obvious bridge platform over the gap
        this.createPlatform(1350, this.levelHeight - 130, 300, 25, 'solid');  // Main bridge (overlaps gap)

        // ===== SECTION 3: Crystal Chamber (1600-2400px) =====
        // Interesting vertical platforming - all optional, ground is continuous
        this.createPlatform(1700, this.levelHeight - 170, 180, 25, 'solid');  // Entry step
        this.createPlatform(1950, this.levelHeight - 280, 200, 25, 'solid');  // Mid level
        this.createPlatform(2150, this.levelHeight - 380, 180, 25, 'solid');  // Upper level
        this.createPlatform(2350, this.levelHeight - 280, 180, 25, 'solid');  // Descent path

        // Crystal Spider miniboss area (elevated)
        this.createPlatform(2100, this.levelHeight - 520, 250, 30, 'solid');  // Spider arena

        // ===== SECRET SLIDE (accessible from Crystal Chamber) =====
        // Hidden slide entrance from upper platforming
        this.slidePlatforms = [];
        this.createPlatform(1800, this.levelHeight - 520, 100, 20, 'one-way');  // Secret entrance

        // Crystal Slide segments
        this.createSlidePlatform(1750, this.levelHeight - 560, 120, 15, -0.4);
        this.createSlidePlatform(1670, this.levelHeight - 500, 100, 15, -0.35);
        this.createSlidePlatform(1600, this.levelHeight - 450, 100, 15, -0.3);

        // Secret alcove with Crystal Shield
        this.createPlatform(1500, this.levelHeight - 400, 180, 25, 'solid');  // Shield landing

        // ===== SECTION 4: Approach to Boss (2400-3200px) =====
        // Build tension - platforms lead naturally to arena
        this.createPlatform(2550, this.levelHeight - 170, 200, 25, 'solid');  // Low step
        this.createPlatform(2800, this.levelHeight - 250, 200, 25, 'solid');  // Rising
        this.createPlatform(3050, this.levelHeight - 180, 200, 25, 'solid');  // Descending

        // Star Fragment platform (optional side path)
        this.createPlatform(2900, this.levelHeight - 400, 150, 25, 'solid');  // Relic alcove

        // ===== GAP 2 BRIDGE (x=3200-3400) =====
        // Final bridge before boss arena
        this.createPlatform(3150, this.levelHeight - 130, 300, 25, 'solid');  // Main bridge

        // ===== SECTION 5: Boss Arena (3400-5000px) =====
        // Open arena with tactical platforms
        this.createPlatform(3600, this.levelHeight - 180, 220, 25, 'solid');  // Left platform
        this.createPlatform(3900, this.levelHeight - 300, 250, 25, 'solid');  // Center platform
        this.createPlatform(4200, this.levelHeight - 180, 220, 25, 'solid');  // Right platform
        this.createPlatform(4050, this.levelHeight - 450, 200, 20, 'one-way'); // High refuge

        // Path to Crystal Core Engine (boss reward)
        this.createPlatform(4450, this.levelHeight - 280, 180, 25, 'solid');  // Step 1
        this.createPlatform(4600, this.levelHeight - 380, 180, 25, 'solid');  // Step 2
        this.createPlatform(4700, this.levelHeight - 480, 200, 30, 'solid');  // Final platform

        // Boss arena interactive elements
        this.createBossArenaElements();

        console.log(`[CrystalCavesLevel] Created ${this.platforms.getLength()} platforms (including ${this.slidePlatforms?.length || 0} slide segments)`);
    }

    /**
     * Create an angled slide platform
     * Players slide down these with reduced friction
     */
    createSlidePlatform(x, y, width, height, angle) {
        // Generate slide texture
        const textureKey = `slideplatform_${width}_${height}_${Math.abs(angle * 100).toFixed(0)}`;

        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Crystal slide gradient (purple to cyan)
            graphics.fillStyle(0x7B68EE, 1);
            graphics.fillRoundedRect(0, 0, width, height, 8);

            // Sparkle highlights
            graphics.fillStyle(0x00FFFF, 0.5);
            for (let i = 0; i < 5; i++) {
                const sx = Phaser.Math.Between(5, width - 5);
                graphics.fillCircle(sx, height / 2, 3);
            }

            // Top shine
            graphics.fillStyle(0xFFFFFF, 0.3);
            graphics.fillRect(5, 2, width - 10, 4);

            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        const platform = this.platforms.create(x + width / 2, y + height / 2, textureKey);
        platform.setImmovable(true);
        platform.body.setSize(width, height);
        platform.body.setOffset(-width / 2 + (platform.width / 2), -height / 2 + (platform.height / 2));
        platform.setDepth(y);
        platform.setRotation(angle);
        platform.platformType = 'slide';
        platform.slideAngle = angle;
        platform.slideDirection = angle < 0 ? -1 : 1; // -1 = slide left, 1 = slide right

        // One-way for slides (can jump through from below)
        platform.body.checkCollision.down = false;
        platform.body.checkCollision.left = false;
        platform.body.checkCollision.right = false;

        // Store for slide physics
        if (!this.slidePlatforms) this.slidePlatforms = [];
        this.slidePlatforms.push(platform);

        return platform;
    }

    /**
     * Create boss arena interactive elements
     * - Crystal Power Well (energy regen)
     * - Destructible Crystal Pillars (cover)
     * - Stalactites (triggered by boss slam)
     */
    createBossArenaElements() {
        // Initialize arena element arrays
        this.crystalPillars = [];
        this.stalactites = [];
        this.powerWell = null;

        // === CRYSTAL POWER WELL ===
        // Positioned on ground in boss arena - standing on it doubles energy regen
        this.createCrystalPowerWell(4050, this.levelHeight - 80);

        // === DESTRUCTIBLE CRYSTAL PILLARS (3 total) ===
        // Provide temporary cover from projectiles
        this.createCrystalPillar(3800, this.levelHeight - 150, 0);
        this.createCrystalPillar(4200, this.levelHeight - 150, 1);
        this.createCrystalPillar(4450, this.levelHeight - 150, 2);

        // === STALACTITES ===
        // Fall when boss does ground slam (visual warning first)
        this.createStalactite(3700, 100);
        this.createStalactite(3950, 120);
        this.createStalactite(4200, 90);
        this.createStalactite(4400, 110);

        console.log('[CrystalCavesLevel] Boss arena elements created: Power Well, 3 Pillars, 4 Stalactites');
    }

    /**
     * Create Crystal Power Well - energy regenerates 2x faster when standing on it
     */
    createCrystalPowerWell(x, y) {
        // Create well texture
        const textureKey = 'crystalPowerWell';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Base circle with glow
            graphics.fillStyle(0x7B68EE, 0.3);
            graphics.fillCircle(40, 40, 38);

            // Inner circles
            graphics.fillStyle(0x9370DB, 0.5);
            graphics.fillCircle(40, 40, 30);

            graphics.fillStyle(0xE040FB, 0.6);
            graphics.fillCircle(40, 40, 20);

            // Center glow
            graphics.fillStyle(0xFFFFFF, 0.4);
            graphics.fillCircle(40, 40, 10);

            // Rune symbols
            graphics.lineStyle(2, 0x00FFFF, 0.8);
            graphics.strokeCircle(40, 40, 25);

            graphics.generateTexture(textureKey, 80, 80);
            graphics.destroy();
        }

        // Create well sprite
        this.powerWell = this.add.image(x, y, textureKey);
        this.powerWell.setDepth(-5);

        // Store position for overlap check
        this.powerWell.wellX = x;
        this.powerWell.wellY = y;
        this.powerWell.wellRadius = 35;

        // Pulsing animation
        this.tweens.add({
            targets: this.powerWell,
            alpha: { from: 0.7, to: 1 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Particle effect
        this.time.addEvent({
            delay: 500,
            callback: () => {
                if (this.powerWell && window.FXLibrary) {
                    window.FXLibrary.stardustBurst(this, this.powerWell.wellX, this.powerWell.wellY - 10, {
                        count: 3,
                        color: [0xE040FB, 0x7B68EE],
                        duration: 800
                    });
                }
            },
            loop: true
        });

        // Set up energy regen check timer
        this.powerWellTimer = this.time.addEvent({
            delay: 2000, // Energy regen every 2s (1s when on well)
            callback: () => this.checkPowerWellEffect(),
            loop: true
        });
    }

    /**
     * Check if player is on power well and apply effect
     */
    checkPowerWellEffect() {
        if (!this.player || !this.powerWell || this.isPlayerDead || !this.bossFightActive) return;

        const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.powerWell.wellX, this.powerWell.wellY
        );

        if (dist < this.powerWell.wellRadius && this.crystalEnergy < this.maxCrystalEnergy) {
            // On power well - regen 1 energy (2x rate since timer fires every 2s)
            this.crystalEnergy = Math.min(this.crystalEnergy + 1, this.maxCrystalEnergy);
            this.updateEnergyDisplay();

            // Visual feedback
            this.showFloatingText('+1⚡', this.player.x, this.player.y - 30, '#E040FB');

            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, this.player.x, this.player.y, {
                    count: 5,
                    color: [0xE040FB, 0xFFFFFF],
                    duration: 400
                });
            }
        }
    }

    /**
     * Create a destructible crystal pillar
     */
    createCrystalPillar(x, y, index) {
        // Create pillar texture
        const textureKey = 'crystalPillar';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Pillar body
            graphics.fillStyle(0x4B0082, 1);
            graphics.fillRect(10, 0, 30, 100);

            // Crystal formations on pillar
            graphics.fillStyle(0x7B68EE, 0.9);
            graphics.fillTriangle(5, 100, 25, 100, 15, 70);
            graphics.fillTriangle(25, 100, 45, 100, 35, 75);
            graphics.fillTriangle(15, 50, 35, 50, 25, 20);

            // Glowing tips
            graphics.fillStyle(0x00FFFF, 0.6);
            graphics.fillCircle(15, 70, 5);
            graphics.fillCircle(35, 75, 5);
            graphics.fillCircle(25, 20, 6);

            graphics.generateTexture(textureKey, 50, 100);
            graphics.destroy();
        }

        // Create pillar as physics body
        const pillar = this.physics.add.staticSprite(x, y, textureKey);
        pillar.setDepth(50);
        pillar.body.setSize(30, 90);
        pillar.body.setOffset(10, 5);

        // Pillar properties
        pillar.pillarIndex = index;
        pillar.pillarHealth = 2; // Takes 2 hits from boss to destroy
        pillar.isDestroyed = false;

        // Add to physics collision (blocks projectiles)
        this.crystalPillars.push(pillar);

        return pillar;
    }

    /**
     * Damage a crystal pillar (called by boss attacks)
     */
    damageCrystalPillar(pillar) {
        if (!pillar || pillar.isDestroyed) return;

        pillar.pillarHealth--;

        // Flash effect
        pillar.setTint(0xFFFFFF);
        this.time.delayedCall(100, () => {
            if (pillar.active) pillar.clearTint();
        });

        // Crack particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, pillar.x, pillar.y, {
                count: 8,
                color: [0x7B68EE, 0x4B0082],
                duration: 500
            });
        }

        if (pillar.pillarHealth <= 0) {
            this.destroyCrystalPillar(pillar);
        }
    }

    /**
     * Destroy a crystal pillar
     */
    destroyCrystalPillar(pillar) {
        if (!pillar || pillar.isDestroyed) return;

        pillar.isDestroyed = true;

        // Destruction particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, pillar.x, pillar.y, {
                count: 20,
                color: [0x7B68EE, 0x4B0082, 0x00FFFF],
                duration: 1000
            });
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        // Fade and destroy
        this.tweens.add({
            targets: pillar,
            alpha: 0,
            scaleX: 1.2,
            scaleY: 0.3,
            duration: 300,
            onComplete: () => {
                pillar.destroy();
            }
        });

        // Regenerate after 30 seconds
        const pillarX = pillar.x;
        const pillarY = pillar.y;
        const pillarIndex = pillar.pillarIndex;

        this.time.delayedCall(30000, () => {
            if (this.bossFightActive && !this.bossDefeated) {
                this.crystalPillars[pillarIndex] = this.createCrystalPillar(pillarX, pillarY, pillarIndex);
            }
        });
    }

    /**
     * Create a stalactite (falls when boss slams)
     */
    createStalactite(x, y) {
        // Create stalactite texture
        const textureKey = 'stalactite';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Rocky stalactite
            graphics.fillStyle(0x2D1B4E, 1);
            graphics.fillTriangle(0, 0, 40, 0, 20, 80);

            // Crystal vein
            graphics.fillStyle(0x7B68EE, 0.7);
            graphics.fillTriangle(15, 10, 25, 10, 20, 60);

            graphics.generateTexture(textureKey, 40, 80);
            graphics.destroy();
        }

        // Create stalactite data (not physics yet - activated on slam)
        const stalactite = {
            x: x,
            y: y,
            active: true,
            falling: false,
            sprite: null,
            shadow: null
        };

        // Create visual sprite
        stalactite.sprite = this.add.image(x, y, textureKey);
        stalactite.sprite.setDepth(-20);
        stalactite.sprite.setOrigin(0.5, 0);

        this.stalactites.push(stalactite);

        return stalactite;
    }

    /**
     * Trigger stalactites to fall (called by boss ground slam in Phase 2)
     */
    triggerStalactiteFall() {
        if (this.bossPhase < 2) return;

        // Random 2-3 stalactites fall
        const availableStalactites = this.stalactites.filter(s => s.active && !s.falling);
        const fallCount = Math.min(Phaser.Math.Between(2, 3), availableStalactites.length);

        const toFall = Phaser.Utils.Array.Shuffle(availableStalactites).slice(0, fallCount);

        toFall.forEach((stalactite, index) => {
            this.time.delayedCall(index * 200, () => {
                this.dropStalactite(stalactite);
            });
        });
    }

    /**
     * Drop a single stalactite
     */
    dropStalactite(stalactite) {
        if (!stalactite || stalactite.falling || !stalactite.active) return;

        stalactite.falling = true;

        // Warning shadow on ground
        stalactite.shadow = this.add.graphics();
        stalactite.shadow.fillStyle(0xFF0000, 0.3);
        stalactite.shadow.fillEllipse(stalactite.x, this.levelHeight - 60, 50, 15);
        stalactite.shadow.setDepth(49);

        // Pulse warning
        this.tweens.add({
            targets: stalactite.shadow,
            alpha: { from: 0.3, to: 0.7 },
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            duration: 300,
            yoyo: true,
            repeat: 1
        });

        // Shake before falling
        this.tweens.add({
            targets: stalactite.sprite,
            x: { from: stalactite.x - 3, to: stalactite.x + 3 },
            duration: 50,
            yoyo: true,
            repeat: 8,
            onComplete: () => {
                // Actually fall
                this.tweens.add({
                    targets: stalactite.sprite,
                    y: this.levelHeight - 80,
                    duration: 400,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.onStalactiteImpact(stalactite);
                    }
                });
            }
        });
    }

    /**
     * Handle stalactite impact
     */
    onStalactiteImpact(stalactite) {
        if (!stalactite) return;

        const impactX = stalactite.x;
        const impactY = this.levelHeight - 80;

        // Impact particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, impactX, impactY, {
                count: 15,
                color: [0x2D1B4E, 0x7B68EE],
                duration: 800
            });
        }

        // Screen shake
        window.FeedbackManager?.cameraShake?.(this, 200, 0.01);

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }

        // Check if hit player
        const playerDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, impactX, impactY);
        if (playerDist < 40) {
            this.takeDamage(1);
        }

        // Check if hit boss
        if (this.boss && this.boss.active) {
            const bossDist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, impactX, impactY);
            if (bossDist < 60) {
                this.damageBoss(1);
                console.log('[CrystalCavesLevel] Boss hit by stalactite!');
            }
        }

        // Clean up
        stalactite.shadow?.destroy();
        stalactite.sprite?.destroy();
        stalactite.active = false;
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

        // Make recovery and the wounded-world story beat part of play.
        this.createBeaconCheckpoints();
        this.createWoundedCrystalGrove();

        // Create the Crystal Core Engine goal (ship part)
        this.createCrystalCoreEngine();
    }

    createBeaconCheckpoints() {
        const groundY = this.levelHeight - 50;
        const anchors = [
            { id: 'caves_anchor_1', x: 1220, label: 'ECHO PASS' },
            { id: 'caves_anchor_2', x: 2520, label: 'LIVING CHAMBER' },
            { id: 'caves_anchor_3', x: 3480, label: 'GUARDIAN THRESHOLD' }
        ];

        anchors.forEach((anchor, index) => {
            const visual = this.add.graphics();
            visual.setDepth(85);
            this.drawCaveBeacon(visual, anchor.x, groundY, false);

            const label = this.add.text(anchor.x, groundY - 120, anchor.label, {
                fontSize: '11px',
                color: '#756D91',
                fontStyle: 'bold',
                stroke: '#080510',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(86);

            // Full-height anchors cannot be skipped by taking an elevated cave path.
            const zone = this.add.zone(
                anchor.x,
                this.levelHeight / 2,
                110,
                this.levelHeight
            );
            this.physics.add.existing(zone, true);

            const checkpoint = {
                ...anchor,
                index,
                visual,
                label,
                zone,
                activated: false,
                respawnY: this.levelHeight - 150
            };

            this.physics.add.overlap(this.player, zone, () => {
                this.activateCaveBeacon(checkpoint);
            });
            this.beaconAnchors.push(checkpoint);
        });
    }

    drawCaveBeacon(graphics, x, groundY, activated) {
        graphics.clear();
        const color = activated ? 0x8FE3CF : 0x4A4268;

        graphics.fillStyle(color, activated ? 0.26 : 0.1);
        graphics.fillCircle(x, groundY - 64, 36);
        graphics.lineStyle(3, color, activated ? 1 : 0.7);
        graphics.strokeCircle(x, groundY - 64, 24);
        graphics.lineStyle(2, color, 0.9);
        graphics.lineBetween(x, groundY - 40, x, groundY - 6);
        graphics.lineBetween(x, groundY - 25, x - 13, groundY - 6);
        graphics.lineBetween(x, groundY - 25, x + 13, groundY - 6);
        graphics.fillStyle(activated ? 0xF2C94C : color, 0.95);
        graphics.fillTriangle(
            x,
            groundY - 88,
            x - 9,
            groundY - 68,
            x + 9,
            groundY - 68
        );
    }

    activateCaveBeacon(checkpoint) {
        if (!checkpoint || checkpoint.activated) return;

        checkpoint.activated = true;
        checkpoint.zone?.destroy?.();
        checkpoint.zone = null;
        this.beaconAnchorsActivated++;
        this.drawCaveBeacon(checkpoint.visual, checkpoint.x, this.levelHeight - 50, true);
        checkpoint.label.setColor('#8FE3CF');
        this.setCheckpoint(checkpoint.x, checkpoint.respawnY, {
            persist: true,
            checkpointId: checkpoint.id,
            checkpointIndex: checkpoint.index
        });

        const anchorNumber = this.beaconAnchorsActivated;
        const companionName = this.getCompanionName();
        this.showFloatingText(
            `PROJECT BEACON ANCHOR ${anchorNumber}/3`,
            checkpoint.x,
            checkpoint.respawnY - 38,
            '#8FE3CF'
        );

        if (anchorNumber === 1) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    `${companionName}: "Echo Pass locked. The cave remembers us."`,
                    checkpoint.x,
                    checkpoint.respawnY - 72,
                    '#D6EEF2'
                );
            });
        } else if (anchorNumber === 2) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    `${companionName}: "The wound is close. Slow down."`,
                    checkpoint.x,
                    checkpoint.respawnY - 72,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconAnchorsActivated === this.beaconAnchors.length) {
            this.caveRouteAligned = true;
            this.refreshCrystalCoreHint();
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    `${companionName}: "The guardian is answering."`,
                    checkpoint.x,
                    checkpoint.respawnY - 72,
                    '#F2C94C'
                );
            });
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'crystal_route_aligned'
            });
        }

        window.AudioManager?.playAchievement?.();
    }

    restoreExpeditionRouteState(resume) {
        return this.restoreExpeditionRouteSignals(resume, {
            signals: this.beaconAnchors,
            countProperty: 'beaconAnchorsActivated',
            readyProperty: 'caveRouteAligned',
            drawSignal: checkpoint => this.drawCaveBeacon(
                checkpoint.visual,
                checkpoint.x,
                this.levelHeight - 50,
                true
            ),
            onRestored: () => {
                this.refreshCrystalCoreHint();
                this.objectiveDisplay?.setText?.(this.getCrystalObjectiveText());
            }
        });
    }

    createWoundedCrystalGrove() {
        const x = 2730;
        const groundY = this.levelHeight - 50;
        const visual = this.add.graphics();
        visual.setDepth(82);
        this.drawWoundedCrystalGrove(visual, x, groundY, false);

        const label = this.add.text(x, groundY - 155, 'FRACTURED GROVE', {
            fontSize: '12px',
            color: '#A78BCB',
            fontStyle: 'bold',
            stroke: '#080510',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(86);

        // Full-height trigger makes the story beat reliable across every traversal path.
        const zone = this.add.zone(x, this.levelHeight / 2, 190, this.levelHeight);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => {
            this.tendWoundedCrystalGrove();
        });

        this.woundedCrystalGrove = { x, groundY, visual, label, zone };
    }

    drawWoundedCrystalGrove(graphics, x, groundY, tended) {
        graphics.clear();
        const crystalColor = tended ? 0x78D9BC : 0x695080;
        const coreColor = tended ? 0xE8FFF7 : 0x321A45;
        const glowColor = tended ? 0x8FE3CF : 0x7D2A7D;

        graphics.fillStyle(glowColor, tended ? 0.22 : 0.14);
        graphics.fillEllipse(x, groundY - 55, 155, 105);
        graphics.lineStyle(3, coreColor, tended ? 0.9 : 0.75);
        graphics.lineBetween(x - 72, groundY - 8, x - 24, groundY - 34);
        graphics.lineBetween(x + 72, groundY - 8, x + 24, groundY - 34);
        graphics.lineBetween(x - 24, groundY - 34, x + 24, groundY - 34);

        [
            { dx: -54, height: 70, width: 28 },
            { dx: -20, height: 104, width: 34 },
            { dx: 22, height: 82, width: 30 },
            { dx: 55, height: 58, width: 24 }
        ].forEach(({ dx, height, width }) => {
            graphics.fillStyle(crystalColor, 0.9);
            graphics.fillTriangle(
                x + dx - width / 2,
                groundY - 10,
                x + dx + width / 2,
                groundY - 10,
                x + dx,
                groundY - height
            );
            graphics.fillStyle(coreColor, tended ? 0.7 : 0.35);
            graphics.fillTriangle(
                x + dx - width / 5,
                groundY - 15,
                x + dx + width / 5,
                groundY - 15,
                x + dx,
                groundY - height + 16
            );
        });
    }

    tendWoundedCrystalGrove() {
        if (this.crystalWoundTended || !this.woundedCrystalGrove) return;

        this.crystalWoundTended = true;
        this.refreshCrystalCoreHint();
        const grove = this.woundedCrystalGrove;
        const companionName = this.getCompanionName();
        const powerProfile = buildCreaturePowerProfile(window.GameState, {
            context: 'fend'
        });
        grove.zone?.destroy?.();
        grove.zone = null;
        this.drawWoundedCrystalGrove(grove.visual, grove.x, grove.groundY, true);
        grove.label.setText('LIVING PULSE RESTORED').setColor('#8FE3CF');
        this.setCheckpoint(grove.x, this.levelHeight - 150);

        this.showFloatingText(
            `${companionName}: ${powerProfile.affinityPower.name}`,
            grove.x,
            grove.groundY - 175,
            `#${powerProfile.color.toString(16).padStart(6, '0')}`
        );
        this.time.delayedCall(850, () => {
            this.showFloatingText(
                'THE FRACTURED CURRENT STABILIZES',
                grove.x,
                grove.groundY - 205,
                '#D6EEF2'
            );
        });

        const wave = this.add.graphics()
            .setPosition(grove.x, grove.groundY - 48)
            .setDepth(90);
        wave.lineStyle(5, powerProfile.color, 0.95);
        wave.strokeEllipse(0, 0, 120, 72);
        wave.lineStyle(2, 0xFFFFFF, 0.75);
        wave.strokeEllipse(0, 0, 150, 92);
        this.tweens.add({
            targets: wave,
            alpha: 0,
            scaleX: 2.4,
            scaleY: 2.4,
            duration: 850,
            ease: 'Cubic.easeOut',
            onComplete: () => wave.destroy()
        });
        window.FXLibrary?.stardustBurst?.(this, grove.x, grove.groundY - 55, {
            count: 28,
            color: [powerProfile.color, 0x8FE3CF, 0xFFFFFF],
            duration: 1200
        });
        recordCreaturePowerEvent(window.GameState, {
            eventId: 'crystal_grove_response',
            powerId: powerProfile.affinityPower.id,
            context: 'fend',
            magnitude: 'major',
            outcome: 'fractured_current_stabilized',
            save: false
        });

        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: 'crystal_grove_tended'
        });
        window.AudioManager?.playAchievement?.();
    }

    /**
     * Create enemies for this level
     * Positioned to match the new platform layout
     */
    createEnemies() {
        this.enemies = this.physics.add.group();

        // PURPOSEFUL ENEMY PLACEMENT - Each enemy has a clear role
        // Total: 2 bats + 2 crawlers + 1 miniboss = 5 enemies (reduced from 11)

        // Shadow Bats - Guard optional exploration paths
        this.createShadowBat(1100, this.levelHeight - 380);   // Guards upper exploration area
        this.createShadowBat(2900, this.levelHeight - 350);   // Warns of approaching boss area

        // Cave Crawlers - Ground threats in key areas
        this.createCaveCrawler(800, this.levelHeight - 100);   // Tutorial - teaches stomping
        this.createCaveCrawler(3800, this.levelHeight - 100);  // Boss arena - adds arena tension

        // Crystal Spider Miniboss - Guards Crystal Chamber
        this.createCrystalSpider(2100, this.levelHeight - 560); // On the elevated spider arena platform

        // Set up enemy collisions
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.player, this.enemies, this.onEnemyCollision, null, this);

        console.log(`[CrystalCavesLevel] Created ${this.enemies.getLength()} enemies (including Crystal Spider miniboss)`);
    }

    /**
     * Create the Crystal Spider miniboss
     * A mid-level challenge that blocks the path until defeated
     */
    createCrystalSpider(x, y) {
        // Create spider texture
        const textureKey = 'crystalSpider';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Body (crystalline purple)
            graphics.fillStyle(0x4B0082, 1);
            graphics.fillEllipse(30, 25, 50, 40);

            // Crystal growths on body
            graphics.fillStyle(0x9370DB, 0.9);
            graphics.fillTriangle(20, 15, 15, 5, 25, 15);
            graphics.fillTriangle(40, 15, 35, 5, 45, 15);

            // Legs (8 legs - crystal-tipped)
            graphics.lineStyle(3, 0x6A0DAD, 1);
            // Left side
            graphics.lineBetween(10, 20, 0, 10);
            graphics.lineBetween(8, 25, -5, 20);
            graphics.lineBetween(8, 30, -5, 35);
            graphics.lineBetween(10, 35, 0, 45);
            // Right side
            graphics.lineBetween(50, 20, 60, 10);
            graphics.lineBetween(52, 25, 65, 20);
            graphics.lineBetween(52, 30, 65, 35);
            graphics.lineBetween(50, 35, 60, 45);

            // Eyes (multiple, glowing red-purple)
            graphics.fillStyle(0xFF00FF, 1);
            graphics.fillCircle(22, 28, 5);
            graphics.fillCircle(38, 28, 5);
            graphics.fillStyle(0xE040FB, 1);
            graphics.fillCircle(27, 22, 3);
            graphics.fillCircle(33, 22, 3);
            graphics.fillCircle(30, 32, 3);

            // Eye highlights
            graphics.fillStyle(0xFFFFFF, 0.6);
            graphics.fillCircle(23, 27, 2);
            graphics.fillCircle(39, 27, 2);

            // Fangs
            graphics.fillStyle(0xE0E0E0, 1);
            graphics.fillTriangle(25, 38, 28, 38, 26, 48);
            graphics.fillTriangle(32, 38, 35, 38, 34, 48);

            graphics.generateTexture(textureKey, 65, 50);
            graphics.destroy();
        }

        // Create spider sprite
        this.crystalSpider = this.enemies.create(x, y, textureKey);
        this.crystalSpider.setCollideWorldBounds(true);
        this.crystalSpider.setBounce(0);
        this.crystalSpider.setDepth(860);
        this.crystalSpider.health = 4;
        this.crystalSpider.maxHealth = 4;
        this.crystalSpider.enemyType = 'crystalSpider';
        this.crystalSpider.isMiniboss = true;

        // Spider-specific state
        this.crystalSpider.isOnCeiling = true;
        this.crystalSpider.attackCooldown = 0;
        this.crystalSpider.patrolDirection = 1;
        this.crystalSpider.patrolStartX = x - 150;
        this.crystalSpider.patrolEndX = x + 150;
        this.crystalSpider.homeY = y;
        this.crystalSpider.isAttacking = false;
        this.crystalSpider.defeated = false;

        // Make it hang upside down initially
        this.crystalSpider.setFlipY(true);
        this.crystalSpider.body.setAllowGravity(false);

        // Create miniboss health bar
        this.createSpiderHealthBar();

        // Start spider AI
        this.spiderAITimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updateCrystalSpiderAI(),
            loop: true
        });

        // Attack timer
        this.spiderAttackTimer = this.time.addEvent({
            delay: 3000,
            callback: () => this.spiderPerformAttack(),
            loop: true
        });

        // Web spray timer - sprays web downward while patrolling on ceiling
        this.spiderWebSprayTimer = this.time.addEvent({
            delay: 1500,
            callback: () => this.spiderSprayWebDown(),
            loop: true
        });

        console.log('[CrystalCavesLevel] Crystal Spider miniboss created at', x, y);

        return this.crystalSpider;
    }

    /**
     * Create spider miniboss health bar (smaller than boss)
     */
    createSpiderHealthBar() {
        if (!this.crystalSpider) return;

        // Container for spider UI (follows spider)
        this.spiderUI = this.add.container(0, 0);
        this.spiderUI.setDepth(1400);

        // Name text
        this.spiderNameText = this.add.text(0, -50, '🕷️ Crystal Spider', {
            fontSize: '14px',
            color: '#E040FB',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.spiderUI.add(this.spiderNameText);

        // Health bar background
        const barWidth = 80;
        const barHeight = 8;

        this.spiderHealthBarBg = this.add.graphics();
        this.spiderHealthBarBg.fillStyle(0x2D1B4E, 0.8);
        this.spiderHealthBarBg.fillRoundedRect(-barWidth / 2, -35, barWidth, barHeight, 3);
        this.spiderHealthBarBg.lineStyle(1, 0x9370DB, 0.8);
        this.spiderHealthBarBg.strokeRoundedRect(-barWidth / 2, -35, barWidth, barHeight, 3);
        this.spiderUI.add(this.spiderHealthBarBg);

        // Health bar fill
        this.spiderHealthBar = this.add.graphics();
        this.spiderUI.add(this.spiderHealthBar);

        this.updateSpiderHealthBar();
    }

    /**
     * Update spider health bar
     */
    updateSpiderHealthBar() {
        if (!this.spiderHealthBar || !this.crystalSpider) return;

        const barWidth = 76;
        const barHeight = 6;
        const healthPercent = this.crystalSpider.health / this.crystalSpider.maxHealth;
        const fillWidth = barWidth * healthPercent;

        this.spiderHealthBar.clear();
        this.spiderHealthBar.fillStyle(0xE040FB, 1);
        this.spiderHealthBar.fillRoundedRect(-barWidth / 2, -34, fillWidth, barHeight, 2);
    }

    /**
     * Update Crystal Spider AI
     */
    updateCrystalSpiderAI() {
        if (!this.crystalSpider || !this.crystalSpider.active || this.crystalSpider.defeated) return;
        if (!this.player) return;

        const spider = this.crystalSpider;
        const distToPlayer = Phaser.Math.Distance.Between(
            spider.x, spider.y,
            this.player.x, this.player.y
        );

        // Update health bar position
        if (this.spiderUI) {
            this.spiderUI.setPosition(spider.x, spider.y);
        }

        // Face player
        if (this.player.x < spider.x) {
            spider.setFlipX(true);
        } else {
            spider.setFlipX(false);
        }

        // Movement behavior
        if (!spider.isAttacking) {
            if (spider.isOnCeiling) {
                // Patrol on ceiling
                const speed = 60;
                spider.setVelocityX(speed * spider.patrolDirection);

                if (spider.x >= spider.patrolEndX) {
                    spider.patrolDirection = -1;
                } else if (spider.x <= spider.patrolStartX) {
                    spider.patrolDirection = 1;
                }

                // Drop down if player is close
                if (distToPlayer < 200 && this.player.y > spider.y) {
                    this.spiderDropDown();
                }
            } else {
                // On ground, chase player if close
                if (distToPlayer < 250) {
                    const direction = this.player.x < spider.x ? -1 : 1;
                    spider.setVelocityX(80 * direction);
                } else {
                    // Return to ceiling
                    this.spiderClimbUp();
                }
            }
        }
    }

    /**
     * Spider drops from ceiling to attack
     */
    spiderDropDown() {
        if (!this.crystalSpider || this.crystalSpider.isAttacking) return;

        const spider = this.crystalSpider;
        spider.isOnCeiling = false;
        spider.isAttacking = true;
        spider.setFlipY(false);
        spider.body.setAllowGravity(true);

        // Warning hiss
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // After landing, reset attack state
        this.time.delayedCall(800, () => {
            if (spider.active) {
                spider.isAttacking = false;
            }
        });
    }

    /**
     * Spider climbs back to ceiling
     */
    spiderClimbUp() {
        if (!this.crystalSpider || this.crystalSpider.isOnCeiling) return;

        const spider = this.crystalSpider;
        spider.isAttacking = true;

        // Animate climbing up
        spider.body.setAllowGravity(false);
        this.tweens.add({
            targets: spider,
            y: spider.homeY,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                spider.isOnCeiling = true;
                spider.isAttacking = false;
                spider.setFlipY(true);
            }
        });
    }

    /**
     * Spider performs an attack
     */
    spiderPerformAttack() {
        if (!this.crystalSpider || !this.crystalSpider.active || this.crystalSpider.isAttacking || this.crystalSpider.defeated) return;
        if (!this.player) return;

        const spider = this.crystalSpider;
        const distToPlayer = Phaser.Math.Distance.Between(spider.x, spider.y, this.player.x, this.player.y);

        if (distToPlayer > 350) return; // Too far to attack

        // Choose attack based on position
        if (spider.isOnCeiling) {
            this.spiderDropDown();
        } else if (distToPlayer < 200) {
            // Pounce attack
            this.spiderPounce();
        } else {
            // Web shot
            this.spiderWebShot();
        }
    }

    /**
     * Spider pounce attack - jumps at player
     */
    spiderPounce() {
        if (!this.crystalSpider) return;

        const spider = this.crystalSpider;
        spider.isAttacking = true;

        // Telegraph with color flash
        spider.setTint(0xFF0000);

        // Wind-up
        this.time.delayedCall(400, () => {
            if (!spider.active) return;

            spider.clearTint();

            // Jump towards player
            const angle = Phaser.Math.Angle.Between(spider.x, spider.y, this.player.x, this.player.y);
            const jumpSpeed = 350;

            spider.setVelocity(
                Math.cos(angle) * jumpSpeed,
                Math.sin(angle) * jumpSpeed - 200
            );

            // Sound
            if (window.AudioManager) {
                window.AudioManager.playAttack();
            }

            // Reset after pounce
            this.time.delayedCall(800, () => {
                if (spider.active) {
                    spider.isAttacking = false;
                }
            });
        });
    }

    /**
     * Spider web shot - slows player if hit
     */
    spiderWebShot() {
        if (!this.crystalSpider || !this.player) return;

        const spider = this.crystalSpider;

        // Create web projectile
        const web = this.add.graphics();
        web.fillStyle(0xDDDDDD, 0.8);
        web.fillCircle(0, 0, 10);
        // Web pattern
        web.lineStyle(1, 0xFFFFFF, 0.6);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            web.lineBetween(0, 0, Math.cos(angle) * 10, Math.sin(angle) * 10);
        }

        web.setPosition(spider.x, spider.y);
        web.setDepth(855);

        // Add physics
        this.physics.add.existing(web);
        web.body.setAllowGravity(false);
        web.body.setCircle(10);

        // Aim at player
        const angle = Phaser.Math.Angle.Between(spider.x, spider.y, this.player.x, this.player.y);
        const speed = 200;
        web.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

        // Player collision - slow effect
        this.physics.add.overlap(this.player, web, () => {
            this.applyWebSlow();
            web.destroy();
        });

        // Destroy after time
        this.time.delayedCall(2500, () => {
            if (web.active) web.destroy();
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Spider sprays web downward while patrolling on ceiling
     * Creates hazards that fall down to lower levels
     */
    spiderSprayWebDown() {
        if (!this.crystalSpider || !this.crystalSpider.active || this.crystalSpider.defeated) return;
        if (!this.crystalSpider.isOnCeiling) return; // Only spray when on ceiling

        const spider = this.crystalSpider;

        // Create falling web projectile
        const web = this.add.graphics();
        web.fillStyle(0xDDDDDD, 0.7);
        web.fillCircle(0, 0, 8);
        // Web drip pattern
        web.fillStyle(0xFFFFFF, 0.5);
        web.fillCircle(0, 5, 4);
        web.fillCircle(0, 10, 3);

        web.setPosition(spider.x, spider.y + 20);
        web.setDepth(850);

        // Add physics
        this.physics.add.existing(web);
        web.body.setAllowGravity(true);
        web.body.setGravityY(150); // Slower fall for better visibility
        web.body.setCircle(8);
        web.body.setVelocityY(50); // Initial downward velocity

        // Slight horizontal spread based on patrol direction
        web.body.setVelocityX(spider.patrolDirection * Phaser.Math.Between(10, 30));

        // Player collision - slow effect
        const webCollider = this.physics.add.overlap(this.player, web, () => {
            this.applyWebSlow();
            web.destroy();
            this.physics.world.removeCollider(webCollider);
        });

        // Platform collision - create web puddle hazard
        const platformCollider = this.physics.add.collider(web, this.platforms, (webObj, platform) => {
            // Create web puddle at impact location
            this.createWebPuddle(webObj.x, platform.y - platform.body.height / 2 - 5);
            webObj.destroy();
            this.physics.world.removeCollider(platformCollider);
            this.physics.world.removeCollider(webCollider);
        });

        // Auto-destroy if it goes off-screen or after 5 seconds
        this.time.delayedCall(5000, () => {
            if (web && web.active) {
                web.destroy();
            }
        });
    }

    /**
     * Create a web puddle hazard on the ground
     * Slows player if they walk through it
     */
    createWebPuddle(x, y) {
        const puddle = this.add.graphics();
        puddle.fillStyle(0xDDDDDD, 0.4);
        puddle.fillEllipse(0, 0, 40, 15);
        // Web texture
        puddle.lineStyle(1, 0xFFFFFF, 0.3);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            puddle.lineBetween(0, 0, Math.cos(angle) * 18, Math.sin(angle) * 6);
        }

        puddle.setPosition(x, y);
        puddle.setDepth(100);

        // Add collision zone
        const zone = this.add.zone(x, y, 40, 15);
        this.physics.add.existing(zone, true);

        // Player collision - slow effect
        this.physics.add.overlap(this.player, zone, () => {
            this.applyWebSlow();
        });

        // Puddle fades and disappears after 4 seconds
        this.tweens.add({
            targets: puddle,
            alpha: 0,
            duration: 1000,
            delay: 3000,
            onComplete: () => {
                puddle.destroy();
                zone.destroy();
            }
        });
    }

    /**
     * Apply web slow effect to player
     */
    applyWebSlow() {
        if (this.isWebbed) return;

        console.log('[CrystalCavesLevel] Player webbed!');
        this.isWebbed = true;

        // Slow player movement
        const originalSpeed = this.playerSpeed;
        this.playerSpeed = originalSpeed * 0.5;

        // Visual effect - white tint
        this.player.setTint(0xCCCCCC);

        // Floating text
        this.showFloatingText('SLOWED!', this.player.x, this.player.y - 40, '#AAAAAA');

        // Remove after 2 seconds
        this.time.delayedCall(2000, () => {
            this.playerSpeed = originalSpeed;
            this.player.clearTint();
            this.isWebbed = false;
        });
    }

    /**
     * Override enemy collision to handle spider miniboss
     */
    onEnemyCollision(player, enemy) {
        // Special handling for Crystal Spider
        if (enemy.isMiniboss && enemy.enemyType === 'crystalSpider') {
            this.onSpiderCollision(player, enemy);
            return;
        }

        // Call parent for regular enemies
        super.onEnemyCollision(player, enemy);
    }

    /**
     * Handle collision with Crystal Spider
     */
    onSpiderCollision(player, spider) {
        if (!spider.active || spider.defeated) return;

        const playerBottom = player.body.bottom;
        const spiderTop = spider.body.top;
        const spiderHeight = spider.body.height;

        // Stomp detection - more generous for miniboss
        const isStomping = player.body.velocity.y > 0 &&
                          playerBottom <= spiderTop + (spiderHeight * 0.6);

        if (isStomping) {
            this.damageSpider(1);
            player.setVelocityY(this.jumpVelocity * 0.7);

            if (window.AudioManager) {
                window.AudioManager.playEnemyHit();
            }
        } else {
            // Player takes damage
            this.takeDamage(1);
        }
    }

    /**
     * Damage the Crystal Spider
     */
    damageSpider(amount) {
        if (!this.crystalSpider || !this.crystalSpider.active || this.crystalSpider.defeated) return;

        this.crystalSpider.health -= amount;
        this.updateSpiderHealthBar();

        // Flash effect
        this.crystalSpider.setTint(0xFFFFFF);
        this.time.delayedCall(100, () => {
            if (this.crystalSpider && this.crystalSpider.active) {
                this.crystalSpider.clearTint();
            }
        });

        // Particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, this.crystalSpider.x, this.crystalSpider.y, {
                count: 8,
                color: [0xE040FB, 0x9370DB],
                duration: 600
            });
        }

        console.log(`[CrystalCavesLevel] Spider health: ${this.crystalSpider.health}/${this.crystalSpider.maxHealth}`);

        // Check defeat
        if (this.crystalSpider.health <= 0) {
            this.onSpiderDefeated();
        }
    }

    /**
     * Handle Spider defeat
     */
    onSpiderDefeated() {
        console.log('[CrystalCavesLevel] Crystal Spider calmed.');

        const spider = this.crystalSpider;
        spider.defeated = true;

        // Stop AI timers
        if (this.spiderAITimer) {
            this.spiderAITimer.remove();
        }
        if (this.spiderAttackTimer) {
            this.spiderAttackTimer.remove();
        }
        if (this.spiderWebSprayTimer) {
            this.spiderWebSprayTimer.remove();
        }

        // The spider settles as the crystal pulse clears.
        spider.setVelocity(0, 0);
        spider.body.setAllowGravity(false);
        spider.setTint(0x8FE3CF);

        // Gentle resonance particles mark the restored passage.
        for (let i = 0; i < 5; i++) {
            this.time.delayedCall(i * 100, () => {
                if (window.FXLibrary) {
                    window.FXLibrary.stardustBurst(this, spider.x + Phaser.Math.Between(-20, 20), spider.y + Phaser.Math.Between(-20, 20), {
                        count: 12,
                        color: [0xE040FB, 0x9370DB, 0x7B68EE],
                        duration: 1000
                    });
                }
            });
        }

        // The spider withdraws into the crystal wall.
        this.tweens.add({
            targets: spider,
            alpha: 0,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 800,
            onComplete: () => {
                spider.destroy();
            }
        });

        // Hide spider UI
        if (this.spiderUI) {
            const spiderUIRef = this.spiderUI;
            this.tweens.add({
                targets: spiderUIRef,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    spiderUIRef.destroy();
                }
            });
            this.spiderUI = null; // Clear reference immediately
            this.spiderHealthBar = null;
            this.spiderHealthBarBg = null;
            this.spiderNameText = null;
        }

        // Restoration effects
        this.showFloatingText('CRYSTAL SPIDER CALMED', spider.x, spider.y - 60, '#8FE3CF');

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Rewards
        this.time.delayedCall(500, () => {
            // Full energy refill
            this.crystalEnergy = this.maxCrystalEnergy;
            this.updateEnergyDisplay();
            this.showFloatingText('Energy Restored!', this.player.x, this.player.y - 40, '#7B68EE');

            // Award coins
            const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
            window.GameState?.set('player.cosmicCoins', currentCoins + 50);
            this.showFloatingText('+50 Coins', this.player.x, this.player.y - 80, '#FFD700');

            // Set checkpoint
            this.setCheckpoint(spider.x, spider.y);
        });
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

        // Cosmic coins - Guide player along main path (updated for new layout)
        const coinPositions = [
            // Tutorial zone (0-800)
            { x: 300, y: this.levelHeight - 190 },   // Above first platform
            { x: 600, y: this.levelHeight - 190 },   // Between tutorial platforms
            { x: 870, y: this.levelHeight - 260 },   // Above elevated platform
            // Exploration zone (800-1400)
            { x: 1050, y: this.levelHeight - 260 },  // Ground level path
            { x: 1300, y: this.levelHeight - 260 },  // Near bridge
            // Crystal Chamber (1600-2400)
            { x: 1800, y: this.levelHeight - 210 },  // Entry area
            { x: 2050, y: this.levelHeight - 320 },  // Mid level
            { x: 2250, y: this.levelHeight - 420 },  // Upper platforms
            // Approach to Boss (2400-3200)
            { x: 2650, y: this.levelHeight - 210 },  // Low step
            { x: 2900, y: this.levelHeight - 290 },  // Rising path
            // Boss arena (3400+)
            { x: 4000, y: this.levelHeight - 340 },  // Above center platform
        ];

        coinPositions.forEach(pos => {
            this.createCoin(pos.x, pos.y);
        });

        // Star Fragments (5 total) - Reward exploration
        const relicPositions = [
            { x: 1100, y: this.levelHeight - 460 },  // Upper exploration path
            { x: 1550, y: this.levelHeight - 440 },  // Secret slide reward area
            { x: 2100, y: this.levelHeight - 560 },  // Above spider arena
            { x: 2900, y: this.levelHeight - 440 },  // Relic alcove
            { x: 4740, y: this.levelHeight - 550 }   // Final approach, before the Core trigger
        ];

        relicPositions.forEach(pos => {
            this.createStarFragment(pos.x, pos.y);
        });

        // Crystal Shield power-up (at end of secret slide - updated position)
        this.createCrystalShield(1550, this.levelHeight - 440);

        // Hint crystal near slide entrance (extra bright to draw attention)
        this.createHintCrystal(1750, this.levelHeight - 560);

        // Set up collectible overlaps
        this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);

        console.log(`[CrystalCavesLevel] Created ${this.collectibles.getLength()} collectibles (including Crystal Shield)`);
    }

    /**
     * Create the Crystal Shield power-up
     */
    createCrystalShield(x, y) {
        const textureKey = 'crystalShieldPowerup';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });

            // Outer glow (pulsing cyan)
            graphics.fillStyle(0x00FFFF, 0.3);
            graphics.fillCircle(30, 30, 28);

            // Shield body (hexagonal shape)
            graphics.fillStyle(0x00FFFF, 0.9);
            // Shield outline
            graphics.beginPath();
            graphics.moveTo(30, 5);   // Top
            graphics.lineTo(50, 15);  // Top right
            graphics.lineTo(50, 40);  // Bottom right
            graphics.lineTo(30, 55);  // Bottom
            graphics.lineTo(10, 40);  // Bottom left
            graphics.lineTo(10, 15);  // Top left
            graphics.closePath();
            graphics.fill();

            // Inner shield highlight
            graphics.fillStyle(0xFFFFFF, 0.5);
            graphics.beginPath();
            graphics.moveTo(30, 12);
            graphics.lineTo(42, 18);
            graphics.lineTo(42, 35);
            graphics.lineTo(30, 45);
            graphics.lineTo(18, 35);
            graphics.lineTo(18, 18);
            graphics.closePath();
            graphics.fill();

            // Star symbol in center (drawn manually - 5-pointed star)
            graphics.fillStyle(0x00FFFF, 1);
            const centerX = 30, centerY = 30;
            const outerRadius = 8, innerRadius = 4;
            for (let i = 0; i < 5; i++) {
                const outerAngle = (i * Math.PI * 2 / 5) - Math.PI / 2;
                const innerAngle = outerAngle + Math.PI / 5;
                const outerX = centerX + Math.cos(outerAngle) * outerRadius;
                const outerY = centerY + Math.sin(outerAngle) * outerRadius;
                const innerX = centerX + Math.cos(innerAngle) * innerRadius;
                const innerY = centerY + Math.sin(innerAngle) * innerRadius;
                graphics.fillTriangle(centerX, centerY, outerX, outerY, innerX, innerY);
            }

            graphics.generateTexture(textureKey, 60, 60);
            graphics.destroy();
        }

        const shield = this.collectibles.create(x, y, textureKey);
        shield.body.setAllowGravity(false);
        shield.collectibleType = 'crystalShield';

        // Pulsing glow animation
        this.tweens.add({
            targets: shield,
            alpha: { from: 0.8, to: 1 },
            scaleX: { from: 1, to: 1.15 },
            scaleY: { from: 1, to: 1.15 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Rotating shine effect
        this.tweens.add({
            targets: shield,
            angle: { from: -5, to: 5 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return shield;
    }

    /**
     * Create a hint crystal (extra bright) near secret areas
     */
    createHintCrystal(x, y) {
        const crystal = this.add.graphics();

        // Extra bright outer glow
        crystal.fillStyle(0x00FFFF, 0.4);
        crystal.fillCircle(0, 0, 35);

        // Middle bright glow
        crystal.fillStyle(0x00FFFF, 0.6);
        crystal.fillCircle(0, 0, 25);

        // Inner bright core
        crystal.fillStyle(0xFFFFFF, 0.5);
        crystal.fillCircle(0, 0, 15);

        // Crystal shape
        crystal.fillStyle(0x00FFFF, 1);
        crystal.fillTriangle(-12, 20, 12, 20, 0, -25);

        // White highlight
        crystal.fillStyle(0xFFFFFF, 0.8);
        crystal.fillTriangle(-6, 12, 6, 12, 0, -15);

        crystal.setPosition(x, y);
        crystal.setDepth(-5);

        // Prominent pulse animation
        this.tweens.add({
            targets: crystal,
            alpha: { from: 0.7, to: 1 },
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Store as background crystal for proximity lighting too
        crystal.crystalColor = 0x00FFFF;
        crystal.crystalSize = 25;
        crystal.crystalX = x;
        crystal.crystalY = y;
        crystal.baseAlpha = 0.7;  // Already bright
        crystal.activeAlpha = 1.0;
        crystal.currentAlpha = 0.7;
        this.backgroundCrystals.push(crystal);

        return crystal;
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
    createStarFragment(x, y) {
        const textureKey = 'starFragment';
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
        relic.collectibleType = 'starFragment';

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

        } else if (item.collectibleType === 'starFragment') {
            this.starFragmentsCollected++;

            // Celebration effect
            this.showFloatingText(`⭐ Fragment ${this.starFragmentsCollected}/${this.totalStarFragments}`, item.x, item.y - 30, '#FFD700');

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

            // Check if all Star Fragments collected - award Cosmic Egg!
            if (this.starFragmentsCollected >= this.totalStarFragments) {
                this.showFloatingText('All Star Fragments! 🥚 Cosmic Egg Earned!', player.x, player.y - 80, '#00FFFF');

                // Award Cosmic Egg to inventory
                if (window.InventoryManager && !this.cosmicEggAwarded) {
                    this.cosmicEggAwarded = true;
                    window.InventoryManager.addItem({
                        id: 'cosmic_egg',
                        name: 'Cosmic Egg',
                        type: 'egg',
                        rarity: 'rare',
                        description: 'A mysterious egg infused with Star Fragment energy. What creature awaits within?',
                        icon: '🥚✨'
                    });
                    console.log('[CrystalCavesLevel] Cosmic Egg awarded for collecting all Star Fragments!');
                }
            }

        } else if (item.collectibleType === 'crystalShield') {
            // Crystal Shield power-up!
            console.log('[CrystalCavesLevel] Crystal Shield collected!');

            // Activate shield in player (method from PlatformerLevelScene)
            this.activateShield();

            // Major celebration effect
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, item.x, item.y, {
                    count: 30,
                    color: [0x00FFFF, 0xFFFFFF, 0x7B68EE],
                    duration: 2000
                });
            }

            // Camera flash
            window.FeedbackManager?.cameraFlash?.(this, 300, 0, 255, 255);
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

        // Create parallax background layers
        this.createParallaxLayers();

        // Create environmental storytelling elements
        this.createStorytellingElements();

        // Create player glow for dynamic lighting
        this.createPlayerGlow();

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

        console.log('[CrystalCavesLevel] Dynamic lighting initialized with', this.backgroundCrystals.length, 'crystals');
    }

    /**
     * Create parallax background layers for depth
     */
    createParallaxLayers() {
        // Far background layer (distant crystal formations) - 0.2 scroll factor
        this.createParallaxLayer(0.2, [
            { x: 500, type: 'crystalCluster', size: 80 },
            { x: 1200, type: 'crystalCluster', size: 100 },
            { x: 2000, type: 'stalactites', size: 120 },
            { x: 2800, type: 'crystalCluster', size: 90 },
            { x: 3600, type: 'stalactites', size: 110 },
            { x: 4400, type: 'crystalCluster', size: 150 }
        ], -50);

        // Mid background layer (cave walls) - 0.5 scroll factor
        this.createParallaxLayer(0.5, [
            { x: 300, type: 'caveWall', size: 200 },
            { x: 900, type: 'caveWall', size: 180 },
            { x: 1600, type: 'caveWall', size: 220 },
            { x: 2400, type: 'caveWall', size: 190 },
            { x: 3200, type: 'caveWall', size: 210 },
            { x: 4100, type: 'caveWall', size: 200 }
        ], -40);

        console.log('[CrystalCavesLevel] Parallax layers created');
    }

    /**
     * Create a parallax background layer
     */
    createParallaxLayer(scrollFactor, elements, depth) {
        elements.forEach(element => {
            const graphics = this.add.graphics();

            if (element.type === 'crystalCluster') {
                // Distant crystal cluster
                const baseAlpha = 0.2 + (scrollFactor * 0.2);
                graphics.fillStyle(0x7B68EE, baseAlpha);

                // Multiple overlapping crystals
                for (let i = 0; i < 5; i++) {
                    const offsetX = Phaser.Math.Between(-element.size / 2, element.size / 2);
                    const height = Phaser.Math.Between(element.size * 0.5, element.size);
                    graphics.fillTriangle(
                        offsetX - 15, 0,
                        offsetX + 15, 0,
                        offsetX, -height
                    );
                }
            } else if (element.type === 'stalactites') {
                // Stalactite formations
                graphics.fillStyle(0x2D1B4E, 0.3);

                for (let i = 0; i < 7; i++) {
                    const offsetX = (i - 3) * 20;
                    const height = Phaser.Math.Between(40, element.size);
                    graphics.fillTriangle(
                        offsetX - 8, 0,
                        offsetX + 8, 0,
                        offsetX, height
                    );
                }
            } else if (element.type === 'caveWall') {
                // Cave wall formation
                graphics.fillStyle(0x1A1025, 0.4);
                graphics.fillRect(-element.size / 2, -100, element.size, 300);

                // Add some texture
                graphics.fillStyle(0x2D1B4E, 0.3);
                for (let i = 0; i < 8; i++) {
                    const x = Phaser.Math.Between(-element.size / 2, element.size / 2);
                    const y = Phaser.Math.Between(-80, 180);
                    graphics.fillCircle(x, y, Phaser.Math.Between(5, 20));
                }
            }

            graphics.setPosition(element.x, this.levelHeight - 300);
            graphics.setScrollFactor(scrollFactor, 1);
            graphics.setDepth(depth);
        });
    }

    /**
     * Create environmental storytelling elements
     */
    createStorytellingElements() {
        // Abandoned minecart near level start (tutorial area)
        this.createMinecart(350, this.levelHeight - 75);

        // Broken lanterns on key platforms (updated for new layout)
        this.createBrokenLantern(600, this.levelHeight - 170);  // Tutorial platform
        this.createBrokenLantern(2000, this.levelHeight - 320); // Crystal chamber

        // Ancient runes on walls (glow when player is near)
        this.createAncientRune(700, this.levelHeight - 300, 'left');   // Exploration zone
        this.createAncientRune(1900, this.levelHeight - 450, 'right'); // Crystal chamber
        this.createAncientRune(3100, this.levelHeight - 350, 'left');  // Pre-boss area

        // Miner skeleton near secret slide area
        this.createMinerSkeleton(1550, this.levelHeight - 480);

        console.log('[CrystalCavesLevel] Storytelling elements created');
    }

    /**
     * Create abandoned minecart decoration
     */
    createMinecart(x, y) {
        const graphics = this.add.graphics();

        // Cart body
        graphics.fillStyle(0x4A3B2A, 1);
        graphics.fillRect(-25, -20, 50, 25);

        // Cart wheels
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(-15, 10, 8);
        graphics.fillCircle(15, 10, 8);

        // Wheel spokes
        graphics.lineStyle(1, 0x555555, 1);
        graphics.strokeCircle(-15, 10, 6);
        graphics.strokeCircle(15, 10, 6);

        // Rust spots
        graphics.fillStyle(0x8B4513, 0.5);
        graphics.fillCircle(-10, -10, 4);
        graphics.fillCircle(8, -5, 3);

        graphics.setPosition(x, y);
        graphics.setDepth(15);
    }

    /**
     * Create broken lantern decoration
     */
    createBrokenLantern(x, y) {
        const graphics = this.add.graphics();

        // Lantern base (broken)
        graphics.fillStyle(0x654321, 1);
        graphics.fillRect(-8, 0, 16, 5);

        // Lantern cage (partially)
        graphics.lineStyle(2, 0x8B7355, 0.8);
        graphics.lineBetween(-6, -15, -6, 0);
        graphics.lineBetween(6, -10, 6, 0);

        // Broken glass shards
        graphics.fillStyle(0xFFFFCC, 0.3);
        graphics.fillTriangle(-4, -8, 0, -5, 2, -10);

        // Faint glow (dying light)
        graphics.fillStyle(0xFFAA00, 0.1);
        graphics.fillCircle(0, -5, 12);

        graphics.setPosition(x, y);
        graphics.setDepth(20);

        // Subtle flicker
        this.tweens.add({
            targets: graphics,
            alpha: { from: 0.6, to: 0.9 },
            duration: Phaser.Math.Between(200, 400),
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create ancient rune on wall (glows when player is near)
     */
    createAncientRune(x, y, side) {
        const graphics = this.add.graphics();

        // Rune symbol (mystical shape)
        graphics.lineStyle(2, 0x7B68EE, 0.3);

        // Draw a mystical rune pattern
        graphics.lineBetween(-15, -20, 0, -30);
        graphics.lineBetween(0, -30, 15, -20);
        graphics.lineBetween(-15, -20, -15, 10);
        graphics.lineBetween(15, -20, 15, 10);
        graphics.lineBetween(-15, 10, 0, 20);
        graphics.lineBetween(15, 10, 0, 20);
        graphics.lineBetween(-10, -10, 10, -10);
        graphics.lineBetween(0, -20, 0, 10);

        graphics.setPosition(x, y);
        graphics.setDepth(5);

        // Store for proximity check
        graphics.runeX = x;
        graphics.runeY = y;
        graphics.baseAlpha = 0.3;
        graphics.activeAlpha = 1.0;
        graphics.currentAlpha = 0.3;

        // Add to background crystals array for proximity lighting
        this.backgroundCrystals.push(graphics);
    }

    /**
     * Create miner skeleton decoration (tells the story)
     */
    createMinerSkeleton(x, y) {
        const graphics = this.add.graphics();

        // Skull
        graphics.fillStyle(0xE8E8E8, 0.8);
        graphics.fillCircle(0, -15, 10);

        // Eye sockets
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(-4, -17, 3);
        graphics.fillCircle(4, -17, 3);

        // Jaw
        graphics.fillStyle(0xD8D8D8, 0.7);
        graphics.fillRect(-6, -8, 12, 5);

        // Ribcage
        graphics.lineStyle(2, 0xCCCCCC, 0.6);
        for (let i = 0; i < 4; i++) {
            graphics.lineBetween(-8, i * 6, 8, i * 6);
        }

        // Arm bones (reaching toward crystal)
        graphics.lineBetween(8, 0, 25, -10);
        graphics.lineBetween(25, -10, 35, -5);

        // Pickaxe nearby
        graphics.fillStyle(0x4A4A4A, 1);
        graphics.fillRect(40, -15, 4, 25);
        graphics.fillStyle(0x6B6B6B, 1);
        graphics.fillRect(35, -18, 15, 5);

        // Old miner's helmet
        graphics.fillStyle(0x8B4513, 0.6);
        graphics.fillRect(-12, -28, 24, 8);

        graphics.setPosition(x, y);
        graphics.setDepth(10);

        // Subtle ambient movement (settling dust)
        this.tweens.add({
            targets: graphics,
            alpha: { from: 0.8, to: 0.9 },
            duration: 3000,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create soft glow around player for cave atmosphere
     */
    createPlayerGlow() {
        // Create glow texture if it doesn't exist
        const textureKey = 'playerGlow';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = this.playerGlowRadius * 2;

            // Create radial gradient effect
            for (let r = this.playerGlowRadius; r > 0; r -= 5) {
                const alpha = 0.3 * (r / this.playerGlowRadius);
                graphics.fillStyle(0x7B68EE, alpha);
                graphics.fillCircle(size / 2, size / 2, r);
            }

            // Add warm inner glow
            for (let r = 60; r > 0; r -= 5) {
                const alpha = 0.2 * (r / 60);
                graphics.fillStyle(0xFFFFFF, alpha);
                graphics.fillCircle(size / 2, size / 2, r);
            }

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        // Create the glow sprite
        this.playerGlow = this.add.image(0, 0, textureKey);
        this.playerGlow.setBlendMode(Phaser.BlendModes.ADD);
        this.playerGlow.setDepth(this.player.depth - 1);
        this.playerGlow.setAlpha(0.5);

        console.log('[CrystalCavesLevel] Player glow created');
    }

    /**
     * Create a glowing background crystal with proximity lighting
     */
    createBackgroundCrystal(x, y, size) {
        const crystal = this.add.graphics();
        const color = Phaser.Math.RND.pick([0x7B68EE, 0x00FFFF, 0xE040FB]);

        // Store crystal info for proximity updates
        crystal.crystalColor = color;
        crystal.crystalSize = size;
        crystal.crystalX = x;
        crystal.crystalY = y;
        crystal.baseAlpha = 0.3; // Dimmer when far from player
        crystal.activeAlpha = 0.9; // Brighter when player is near
        crystal.currentAlpha = 0.3;

        // Initial draw (dim)
        this.drawCrystal(crystal, color, size, crystal.baseAlpha);

        crystal.setPosition(x, y);
        crystal.setDepth(-10);  // Behind platforms

        // Subtle pulse animation
        this.tweens.add({
            targets: crystal,
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: Phaser.Math.Between(2000, 3500),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Store for proximity updates
        this.backgroundCrystals.push(crystal);
    }

    /**
     * Draw crystal graphics with specified intensity
     */
    drawCrystal(crystal, color, size, intensity) {
        crystal.clear();

        // Outer glow (scales with intensity)
        crystal.fillStyle(color, 0.15 * intensity);
        crystal.fillCircle(0, 0, size * 1.8);

        // Middle glow
        crystal.fillStyle(color, 0.3 * intensity);
        crystal.fillCircle(0, 0, size * 1.2);

        // Inner glow
        crystal.fillStyle(color, 0.5 * intensity);
        crystal.fillCircle(0, 0, size);

        // Crystal shape (always somewhat visible)
        crystal.fillStyle(color, 0.3 + (0.6 * intensity));
        crystal.fillTriangle(-size / 3, size / 2, size / 3, size / 2, 0, -size / 2);

        // Bright highlight when active
        if (intensity > 0.6) {
            crystal.fillStyle(0xFFFFFF, 0.3 * intensity);
            crystal.fillTriangle(-size / 6, size / 4, size / 6, size / 4, 0, -size / 4);
        }
    }

    /**
     * Update dynamic lighting each frame
     */
    updateLighting() {
        if (!this.player) return;

        // Update player glow position
        if (this.playerGlow) {
            this.playerGlow.setPosition(this.player.x, this.player.y);
        }

        // Update crystal proximity lighting
        this.backgroundCrystals.forEach(crystal => {
            if (!crystal.active) return;

            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                crystal.crystalX, crystal.crystalY
            );

            // Calculate target alpha based on distance
            let targetAlpha;
            if (dist < this.crystalProximityDistance) {
                // Within range - interpolate from base to active
                const proximity = 1 - (dist / this.crystalProximityDistance);
                targetAlpha = crystal.baseAlpha + (crystal.activeAlpha - crystal.baseAlpha) * proximity;
            } else {
                targetAlpha = crystal.baseAlpha;
            }

            // Smooth transition
            crystal.currentAlpha += (targetAlpha - crystal.currentAlpha) * 0.1;

            // Only redraw if alpha changed significantly
            if (Math.abs(crystal.currentAlpha - crystal.lastDrawnAlpha) > 0.02) {
                this.drawCrystal(crystal, crystal.crystalColor, crystal.crystalSize, crystal.currentAlpha);
                crystal.lastDrawnAlpha = crystal.currentAlpha;
            }
        });
    }

    /**
     * Create the Crystal Core Engine (ship part - level goal)
     * Hexagonal core with rotating crystal rings
     */
    createCrystalCoreEngine() {
        // Position above the final stepped platform (4750, levelHeight - 480)
        const coreX = 4850;
        const coreY = this.levelHeight - 530;

        // Create core engine texture
        const textureKey = 'crystalCoreEngine';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = 80;
            const center = size / 2;

            // Outer glow ring
            graphics.fillStyle(0x00FFFF, 0.2);
            graphics.fillCircle(center, center, 38);

            // Middle energy ring
            graphics.lineStyle(3, 0x7B68EE, 0.8);
            graphics.strokeCircle(center, center, 32);

            // Hexagonal core body
            graphics.fillStyle(0x2D1B4E, 1);
            const hexRadius = 22;
            graphics.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const x = center + Math.cos(angle) * hexRadius;
                const y = center + Math.sin(angle) * hexRadius;
                if (i === 0) graphics.moveTo(x, y);
                else graphics.lineTo(x, y);
            }
            graphics.closePath();
            graphics.fill();

            // Hexagon outline
            graphics.lineStyle(2, 0x00FFFF, 1);
            graphics.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const x = center + Math.cos(angle) * hexRadius;
                const y = center + Math.sin(angle) * hexRadius;
                if (i === 0) graphics.moveTo(x, y);
                else graphics.lineTo(x, y);
            }
            graphics.closePath();
            graphics.stroke();

            // Inner crystal core (glowing)
            graphics.fillStyle(0x00FFFF, 0.9);
            graphics.fillCircle(center, center, 12);

            // Core highlight
            graphics.fillStyle(0xFFFFFF, 0.7);
            graphics.fillCircle(center - 3, center - 3, 5);

            // Energy lines radiating out
            graphics.lineStyle(1, 0xE040FB, 0.6);
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x1 = center + Math.cos(angle) * 14;
                const y1 = center + Math.sin(angle) * 14;
                const x2 = center + Math.cos(angle) * 30;
                const y2 = center + Math.sin(angle) * 30;
                graphics.lineBetween(x1, y1, x2, y2);
            }

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        this.crystalCore = this.physics.add.staticSprite(coreX, coreY, textureKey);
        this.crystalCore.setDepth(50);

        // Pulsing animation
        this.tweens.add({
            targets: this.crystalCore,
            scaleX: { from: 1, to: 1.15 },
            scaleY: { from: 1, to: 1.15 },
            alpha: { from: 0.8, to: 1 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Slow rotation
        this.tweens.add({
            targets: this.crystalCore,
            angle: 360,
            duration: 8000,
            repeat: -1,
            ease: 'Linear'
        });

        // Add floating label above the Crystal Core
        this.crystalCoreLabel = this.add.text(coreX, coreY - 70, '⬇ CRYSTAL CORE ENGINE ⬇', {
            fontSize: '16px',
            color: '#00FFFF',
            fontStyle: 'bold',
            stroke: '#1A0A2E',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setDepth(60);

        // Label hint text
        this.crystalCoreHint = this.add.text(coreX, coreY - 50, this.getCrystalCoreHintText(), {
            fontSize: '12px',
            color: '#E040FB',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(60);

        // Pulsing animation for label
        this.tweens.add({
            targets: [this.crystalCoreLabel, this.crystalCoreHint],
            alpha: { from: 0.6, to: 1 },
            y: '-=5',
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Beacon effect - vertical light beam
        const beacon = this.add.graphics();
        beacon.setDepth(45);
        beacon.fillStyle(0x00FFFF, 0.15);
        beacon.fillRect(coreX - 15, 0, 30, coreY);
        beacon.fillStyle(0x00FFFF, 0.25);
        beacon.fillRect(coreX - 8, 0, 16, coreY);

        // Pulsing beacon
        this.tweens.add({
            targets: beacon,
            alpha: { from: 0.3, to: 0.8 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Overlap for collection - triggers boss fight
        this.physics.add.overlap(this.player, this.crystalCore, () => {
            if (!this.crystalCoreFound && !this.bossFightActive) {
                if (!this.canActivateCrystalCore()) {
                    this.showCrystalCoreGateHint();
                    return;
                }

                this.crystalCoreFound = true;
                // Hide labels when boss fight starts
                this.crystalCoreLabel?.destroy();
                this.crystalCoreHint?.destroy();
                beacon?.destroy();
                this.startBossFight();
            }
        });
    }

    canActivateCrystalCore() {
        return this.caveRouteAligned && this.crystalWoundTended;
    }

    getCrystalCoreHintText() {
        if (!this.caveRouteAligned) return 'Align the Beacon anchors';
        if (!this.crystalWoundTended) return 'Tend the fractured grove';
        return 'Touch to Answer the Guardian';
    }

    refreshCrystalCoreHint() {
        this.crystalCoreHint?.setText?.(this.getCrystalCoreHintText());
    }

    showCrystalCoreGateHint() {
        const now = this.time.now;
        if (now < this.coreGateHintUntil) return;

        const message = !this.caveRouteAligned
            ? 'The Core signal is incomplete. Align the Beacon anchors.'
            : 'Your companion still hears the fractured grove.';
        this.showFloatingText(message, this.player.x, this.player.y - 70, '#F2C94C');
        window.FeedbackManager?.cameraFlash?.(this, 180, 242, 193, 78);
        this.coreGateHintUntil = now + 1800;
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
        window.FeedbackManager?.cameraFlash?.(this, 500, 150, 0, 200);

        // Warning text
        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, 'THE CAVE GUARDIAN IS HURTING', {
            fontSize: width <= 480 ? '22px' : '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width - 50 }
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
        window.FeedbackManager?.cameraShake?.(this, 1500, 0.015);

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

        // Finished guardian art is preferred; the procedural texture remains a
        // size-independent fallback if the asset cannot be loaded.
        const textureKey = this.textures.exists(CRYSTAL_GUARDIAN_TEXTURE)
            ? CRYSTAL_GUARDIAN_TEXTURE
            : this.createCrystalGolemTexture();

        // Spawn position - center of boss arena (section 5)
        const spawnX = 4300;
        const spawnY = this.levelHeight - 180;

        // Create boss sprite
        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.bossTargetScale = textureKey === CRYSTAL_GUARDIAN_TEXTURE
            ? CRYSTAL_GUARDIAN_DISPLAY_HEIGHT / this.boss.height
            : 1;
        const bodyWidth = this.boss.width * 0.48;
        const bodyHeight = this.boss.height * 0.68;
        this.boss.body.setSize(bodyWidth, bodyHeight);
        this.boss.body.setOffset(
            (this.boss.width - bodyWidth) / 2,
            this.boss.height * 0.23
        );

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
        this.boss.setScale(this.bossTargetScale * 0.5);
        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scaleX: this.bossTargetScale * 1.2,
            scaleY: this.bossTargetScale * 1.2,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                // Settle to normal size
                this.tweens.add({
                    targets: this.boss,
                    scaleX: this.bossTargetScale,
                    scaleY: this.bossTargetScale,
                    duration: 300
                });
            }
        });

        // Create boss health bar
        this.createBossHealthBar();

        // Keep authored attack previews deterministic for mobile QA.
        if (this.bossAttackPreview) {
            this.time.delayedCall(650, () => {
                this.bossPerformAttack(this.bossAttackPreview);
            });
        } else {
            this.startBossAI();
        }

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
     * Create boss health bar UI with enhanced visibility
     */
    createBossHealthBar() {
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(320, screenWidth - 60);
        const barHeight = 26;
        const barX = (screenWidth - barWidth) / 2;
        const screenHeight = this.cameras.main.height;
        const isMobileLayout = this.isMobile || screenWidth <= 480 || screenHeight < 620;
        const barY = isMobileLayout ? 118 : 55;

        // Store for updateBossHealthBar
        this.bossBarConfig = { x: barX, y: barY, width: barWidth, height: barHeight };

        // Container for boss UI
        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        // Boss name with enhanced visibility
        this.bossNameText = this.add.text(screenWidth / 2, barY - 28, 'CRYSTAL GUARDIAN // WOUNDED', {
            fontSize: isMobileLayout ? '18px' : '22px',
            color: '#A9F3E4',
            fontStyle: 'bold',
            stroke: '#2D1B4E',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        // Subtitle
        this.bossInstructionText = this.add.text(screenWidth / 2, barY - 8, 'STRIKE THE UNSTABLE PULSE', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#D8FFF6',
            fontStyle: 'bold',
            stroke: '#160D24',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);
        this.bossUI.add(this.bossInstructionText);

        // Health bar background with glow
        const barBg = this.add.graphics();
        // Glow layer
        barBg.fillStyle(0x7B68EE, 0.2);
        barBg.fillRoundedRect(barX - 6, barY - 2, barWidth + 12, barHeight + 14, 10);
        // Main background
        barBg.fillStyle(0x1A1025, 0.95);
        barBg.fillRoundedRect(barX - 2, barY + 2, barWidth + 4, barHeight + 4, 6);
        barBg.lineStyle(3, 0x7B68EE, 0.9);
        barBg.strokeRoundedRect(barX - 2, barY + 2, barWidth + 4, barHeight + 4, 6);
        this.bossUI.add(barBg);

        // Health bar fill
        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        this.bossPulseText = this.add.text(
            screenWidth / 2,
            barY + 17,
            '',
            {
                fontSize: isMobileLayout ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold',
                stroke: '#160D24',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.bossUI.add(this.bossPulseText);

        this.updateBossHealthBar();

        // Camera zoom out for better boss visibility
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 0.92,
            duration: 800,
            ease: 'Power2'
        });

        // Start off-screen boss indicator
        this.startBossIndicator();
    }

    /**
     * Update boss health bar display
     */
    updateBossHealthBar() {
        if (!this.bossHealthBar || !this.bossBarConfig) return;

        const { x, y, width, height } = this.bossBarConfig;
        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const fillWidth = (width - 4) * healthPercent;
        const unstablePulse = Math.max(0, Math.ceil(this.bossHealth));

        this.bossHealthBar.clear();

        // This meter is the unstable pulse remaining, not guardian life.
        this.bossHealthBar.fillStyle(0xE040FB, 1);
        this.bossHealthBar.fillRoundedRect(x, y + 4, fillWidth, height, 4);

        // Inner highlight
        if (healthPercent > 0.1) {
            this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
            this.bossHealthBar.fillRoundedRect(x + 2, y + 6, fillWidth - 4, height / 3, 2);
        }
        this.bossPulseText?.setText(
            unstablePulse > 0
                ? `UNSTABLE PULSE // ${unstablePulse}/${this.bossMaxHealth}`
                : 'UNSTABLE PULSE // STABLE'
        );
    }

    /**
     * Off-screen boss indicator
     */
    startBossIndicator() {
        this.bossIndicator = this.add.graphics();
        this.bossIndicator.setScrollFactor(0);
        this.bossIndicator.setDepth(1499);
        this.bossIndicator.setAlpha(0);

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

        const bossScreenX = this.boss.x - camera.scrollX;
        const bossScreenY = this.boss.y - camera.scrollY;

        const padding = 80;
        const isOffScreen = bossScreenX < -padding || bossScreenX > screenWidth + padding ||
                           bossScreenY < -padding || bossScreenY > screenHeight + padding;

        if (isOffScreen && this.bossFightActive) {
            this.bossIndicator.setAlpha(0.9);
            this.bossIndicator.clear();

            const playerScreenX = this.player.x - camera.scrollX;
            const playerScreenY = this.player.y - camera.scrollY;
            const angle = Math.atan2(bossScreenY - playerScreenY, bossScreenX - playerScreenX);

            const indicatorDist = Math.min(screenWidth, screenHeight) * 0.35;
            let indicatorX = playerScreenX + Math.cos(angle) * indicatorDist;
            let indicatorY = playerScreenY + Math.sin(angle) * indicatorDist;

            indicatorX = Phaser.Math.Clamp(indicatorX, 50, screenWidth - 50);
            indicatorY = Phaser.Math.Clamp(indicatorY, 100, screenHeight - 150);

            // Arrow pointing to boss
            this.bossIndicator.fillStyle(0xFF6B4A, 1);
            const arrowSize = 18;

            this.bossIndicator.save();
            this.bossIndicator.translateCanvas(indicatorX, indicatorY);
            this.bossIndicator.rotateCanvas(angle);

            this.bossIndicator.fillTriangle(
                arrowSize, 0,
                -arrowSize / 2, -arrowSize / 2,
                -arrowSize / 2, arrowSize / 2
            );

            const pulseSize = 7 + Math.sin(this.time.now / 200) * 3;
            this.bossIndicator.fillStyle(0xFF4500, 0.6);
            this.bossIndicator.fillCircle(-arrowSize, 0, pulseSize);

            this.bossIndicator.restore();
        } else {
            this.bossIndicator.setAlpha(0);
        }
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
        window.FeedbackManager?.cameraShake?.(this, 500, 0.02);
        this.boss.setTint(0xFF6B6B);

        // Flash warning
        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, 'THE WOUND SURGES!', {
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
    bossPerformAttack(forcedAttack = null) {
        if (!this.boss || !this.boss.active || this.boss.isAttacking) return;

        const attackType = forcedAttack || {
            1: 'ground_slam',
            2: 'crystal_barrage',
            3: 'charge'
        }[Phaser.Math.Between(1, this.bossPhase >= 2 ? 3 : 2)];
        const attackWindow =
            CRYSTAL_GUARDIAN_ATTACK_WINDOWS[attackType] || 1400;

        this.boss.isAttacking = true;
        this.boss.setVelocityX(0);
        this.showBossAttackInstruction(
            CRYSTAL_GUARDIAN_ATTACK_CUES[attackType],
            attackWindow
        );

        switch (attackType) {
            case 'ground_slam':
                this.bossGroundSlam();
                break;
            case 'crystal_barrage':
                this.bossCrystalBarrage();
                break;
            case 'charge':
                this.bossChargeAttack();
                break;
        }

        // Keep attacks from overlapping while projectiles and charge lanes remain active.
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = this.time.delayedCall(attackWindow, () => {
            if (this.boss) {
                this.boss.isAttacking = false;
            }
            this.bossAttackUnlockTimer = null;
        });
    }

    showBossAttackInstruction(cue, duration = 1400) {
        if (!cue || !this.bossInstructionText) return;

        this.bossInstructionTimer?.remove?.();
        this.bossInstructionText
            .setText(cue)
            .setColor('#FFD166')
            .setScale(1.04);
        this.tweens.add({
            targets: this.bossInstructionText,
            scaleX: 1,
            scaleY: 1,
            duration: 180,
            ease: 'Sine.easeOut'
        });
        if (this.bossAttackPreview) {
            return;
        }
        this.bossInstructionTimer = this.time.delayedCall(
            Math.max(600, duration - 250),
            () => {
                this.bossInstructionText
                    ?.setText('STRIKE THE UNSTABLE PULSE')
                    ?.setColor('#D8FFF6');
                this.bossInstructionTimer = null;
            }
        );
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
                window.FeedbackManager?.cameraShake?.(this, 300, 0.03);

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

                // Trigger stalactites in Phase 2
                if (this.bossPhase >= 2) {
                    this.triggerStalactiteFall();
                }

                // Damage nearby pillars
                this.crystalPillars.forEach(pillar => {
                    if (pillar && !pillar.isDestroyed) {
                        const pillarDist = Math.abs(pillar.x - this.boss.x);
                        if (pillarDist < 150) {
                            this.damageCrystalPillar(pillar);
                        }
                    }
                });

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
        this.showFloatingText(
            `PULSE -${amount}`,
            this.boss.x,
            this.boss.y - 80,
            '#F0B6FF'
        );

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
     * Handle guardian restoration.
     */
    onBossDefeated() {
        console.log('[CrystalCavesLevel] Crystal Guardian stabilized!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        // Record guardian restoration for achievements.
        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('guardian_restored', { bossId: 'crystal_golem' });
        }

        // Stop boss AI
        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }
        if (this.bossAttackTimer) {
            this.bossAttackTimer.remove();
        }
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;
        this.bossPulseText?.setText('UNSTABLE PULSE // STABLE');

        // The guardian calms as the unstable pulse clears.
        this.boss.setVelocity(0, 0);
        this.boss.body.setAllowGravity(false);
        this.boss.setTint(0x8FE3CF);

        window.FeedbackManager?.cameraShake?.(this, 350, 0.01);
        window.FeedbackManager?.cameraFlash?.(this, 450, 143, 227, 207);
        this.showFloatingText(
            'GUARDIAN PULSE STABLE',
            this.boss.x,
            this.boss.y - 95,
            '#8FE3CF'
        );

        // Resonance particles replace the previous destruction effect.
        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 130, () => {
                if (window.FXLibrary && this.boss) {
                    const offsetX = Phaser.Math.Between(-40, 40);
                    const offsetY = Phaser.Math.Between(-50, 30);
                    window.FXLibrary.stardustBurst(this, this.boss.x + offsetX, this.boss.y + offsetY, {
                        count: 12,
                        color: [0x8FE3CF, 0x00FFFF, 0xBFA6FF, 0xFFD700],
                        duration: 1200
                    });
                }
            });
        }

        // The restored guardian withdraws into the crystal wall.
        this.tweens.add({
            targets: this.boss,
            alpha: 0.15,
            scaleX: this.bossTargetScale * 0.88,
            scaleY: this.bossTargetScale * 0.88,
            duration: 1800,
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
        const victoryText = this.add.text(width / 2, height / 2, 'CRYSTAL GUARDIAN RESTORED', {
            fontSize: width <= 480 ? '24px' : '32px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width - 50 }
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

        this.completeLevelProgression({
            achievementLevelId: 'crystalCaves',
            shipPartId: 'crystal_core',
            katanaUpgradeId: 'crystal_edge',
            speedrunThreshold: 180000,
            rewardBonusCount: this.starFragmentsCollected
        });

        // Pause gameplay
        this.physics.pause();

        // Celebration effects
        window.FeedbackManager?.cameraFlash?.(this, 500, 0, 255, 255);

        if (window.FXLibrary && this.crystalCore) {
            for (let i = 0; i < 5; i++) {
                this.time.delayedCall(i * 200, () => {
                    window.FXLibrary.stardustBurst(this, this.crystalCore.x, this.crystalCore.y, {
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
            this.showKatanaUpgradeReveal({
                onClose: () => this.showCompletionScreen()
            });
        });
    }

    /**
     * Show level completion screen
     */
    showCompletionScreen() {
        this.bindLevelCompletionReturn();

        const layout = this.getLevelModalLayout({ maxWidth: 450, maxHeight: 400 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, contentRight, y, font, buttonPadding
        } = layout;

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1025, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x00FFFF, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Title
        const title = this.add.text(width / 2, y(50), 'LEVEL COMPLETE', {
            fontSize: font(36, 28),
            color: '#00FFFF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x7B68EE, 0.5);
        divider.lineBetween(contentLeft, y(90), contentRight, y(90));
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        // Results
        const resultY = y(120);
        const results = [
            { text: 'Beacon Route Aligned', done: this.caveRouteAligned },
            { text: 'Fractured Grove Tended', done: this.crystalWoundTended },
            { text: `Star Fragments: ${this.starFragmentsCollected}/${this.totalStarFragments}`, done: this.starFragmentsCollected >= this.totalStarFragments },
            { text: 'Crystal Guardian Stabilized', done: this.bossDefeated }
        ];

        // Ship part already awarded via InventoryManager in onLevelComplete()

        results.forEach((result, i) => {
            const icon = result.done ? '[x]' : '[ ]';
            const color = result.done ? '#00FF00' : '#888888';
            this.add.text(contentLeft, resultY + i * (y(35) - panelY), `${icon} ${result.text}`, {
                fontSize: font(18, 15),
                color: color,
                wordWrap: { width: contentWidth }
            }).setScrollFactor(0).setDepth(3002);
        });

        // Rewards
        const rewardY = y(250);
        this.add.text(width / 2, rewardY, 'REWARDS', {
            fontSize: font(14, 12),
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const coins = this.levelCompletionResult?.coinsAwarded || 0;
        this.add.text(width / 2, rewardY + 30, `+ ${coins} Cosmic Coins`, {
            fontSize: font(22, 18),
            color: '#FFD700',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Ship part notification
        const currentShipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const totalRequired = window.GameState?.get('hubWorld.shipParts.totalRequired') || 5;
        const katanaUpgrade = this.levelCompletionResult?.katanaUpgrade;
        const upgradeStatus = this.levelCompletionResult?.katanaUpgradeAwarded
            ? 'installed'
            : 'online';
        const guardianGifts = katanaUpgrade
            ? `Guardian Gifts: Crystal Core + ${katanaUpgrade.name} ${upgradeStatus}`
            : 'Guardian Gift: Crystal Core';
        this.add.text(
            width / 2,
            y(300),
            `${guardianGifts}\n${this.getVillageCompletionCopy({ compact: true })}\n${this.getGuardianSanctuaryArrivalCopy({ compact: true })}`,
            {
            fontSize: font(14, 12),
            color: '#00FFFF',
            fontStyle: 'bold',
            align: 'center',
            lineSpacing: 3,
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, y(335), `Ship Repair Progress: ${currentShipParts.length}/${totalRequired} parts`, {
            fontSize: font(14, 12),
            color: '#9370DB',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Return button
        const returnBtn = this.add.text(width / 2, y(365), '[ RETURN TO HUB ]', {
            fontSize: font(20, 16),
            color: '#7B68EE',
            backgroundColor: '#2D1B3D',
            padding: buttonPadding
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
            this.returnToHub();
        });
    }

    /**
     * Override parent HUD to add objective tracking
     */
    createHUD() {
        super.createHUD();

        // Keep the objective away from mobile movement and combat controls.
        const { width, height } = this.cameras.main;
        const isShortLandscape = width > height && height < 620;
        this.isCompactObjectiveHUD = this.isMobile || width <= 480 || height < 620;
        this.objectiveDisplay = this.add.text(
            width - (this.isCompactObjectiveHUD ? 12 : 20),
            this.isCompactObjectiveHUD ? (isShortLandscape ? 76 : 72) : 20,
            this.getCrystalObjectiveText(),
            {
            fontSize: this.isCompactObjectiveHUD ? '12px' : '15px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#F4EDFF',
            backgroundColor: 'rgba(26, 16, 37, 0.92)',
            padding: { x: 10, y: 7 },
            lineSpacing: 2,
            align: 'left',
            wordWrap: {
                width: this.isCompactObjectiveHUD ? 205 : 330
            }
        }).setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);
    }

    getCrystalObjectiveText() {
        const optional = `OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`;

        if (this.bossDefeated) {
            return `CURRENT STABILIZED\nTHE GUARDIAN IS SAFE\n${optional}`;
        }
        if (this.bossFightActive) {
            return `STABILIZE THE GUARDIAN\nSTRIKE THE UNSTABLE PULSE\n${optional}`;
        }
        if (this.canActivateCrystalCore()) {
            return `CRYSTAL CORE AHEAD\nTOUCH THE CORE TO ANSWER\n${optional}`;
        }
        if (!this.crystalWoundTended && this.beaconAnchorsActivated >= 2) {
            return `FRACTURED GROVE AHEAD\nREACH IT TOGETHER →\n${optional}`;
        }

        const nextAnchor = [
            'ECHO PASS',
            'LIVING CHAMBER',
            'GUARDIAN THRESHOLD'
        ][this.beaconAnchorsActivated] || 'GUARDIAN THRESHOLD';
        const current = Math.min(this.beaconAnchorsActivated + 1, 3);
        const pulse = this.crystalWoundTended
            ? 'FOLLOW THE STEADY PULSE →'
            : 'FOLLOW THE CAVE PULSE →';
        return `ROUTE ${current}/3 // ${nextAnchor}\n${pulse}\n${optional}`;
    }

    /**
     * Override update to refresh objective display, lighting, and slide physics
     */
    update(time, delta) {
        super.update(time, delta);
        if (this.levelCompletionActive) return;

        // Update objective display
        if (this.objectiveDisplay) {
            this.objectiveDisplay.setText(this.getCrystalObjectiveText());
            this.objectiveDisplay.setVisible(
                !(this.isCompactObjectiveHUD && this.bossFightActive)
            );
        }

        // Update dynamic lighting
        this.updateLighting();

        // Update slide physics
        this.updateSlidePhysics();
    }

    /**
     * Apply slide physics when player is on slide platforms
     */
    updateSlidePhysics() {
        if (!this.player || !this.slidePlatforms || this.slidePlatforms.length === 0) return;

        // Check if player is on any slide platform
        let isOnSlide = false;
        let slideDirection = 0;

        this.slidePlatforms.forEach(slidePlatform => {
            if (!slidePlatform.active) return;

            // Check if player is touching this slide platform
            if (this.physics.world.overlap(this.player, slidePlatform)) {
                isOnSlide = true;
                slideDirection = slidePlatform.slideDirection;
            }
        });

        if (isOnSlide && this.isGrounded) {
            // Apply slide velocity
            const slideSpeed = 220;
            this.player.setVelocityX(slideSpeed * slideDirection);

            // Reduce gravity while sliding for smooth motion
            this.player.body.setAllowGravity(true);

            // Slide particles (occasional sparkles)
            if (!this.slideParticleThrottle) {
                if (window.FXLibrary) {
                    window.FXLibrary.speedLines(this, this.player.x, this.player.y, -slideDirection, {
                        count: 3,
                        color: 0x00FFFF,
                        alpha: { start: 0.7, end: 0 }
                    });
                }
                this.slideParticleThrottle = true;
                this.time.delayedCall(100, () => {
                    this.slideParticleThrottle = false;
                });
            }
        }
    }

    /**
     * Clean up boss resources on shutdown
     */
    shutdown() {
        console.log('[CrystalCavesLevel] Shutting down - cleaning up boss resources');
        this.clearLevelEntryKeyHandler();

        // Stop ambient audio
        if (this.ambientAudio && this.ambientAudio.stop) {
            this.ambientAudio.stop();
            this.ambientAudio = null;
        }

        // Clean up lighting
        if (this.playerGlow) {
            this.playerGlow.destroy();
            this.playerGlow = null;
        }
        this.backgroundCrystals = [];

        // Clean up Crystal Spider miniboss
        if (this.spiderAITimer) {
            this.spiderAITimer.remove();
            this.spiderAITimer = null;
        }
        if (this.spiderAttackTimer) {
            this.spiderAttackTimer.remove();
            this.spiderAttackTimer = null;
        }
        if (this.spiderWebSprayTimer) {
            this.spiderWebSprayTimer.remove();
            this.spiderWebSprayTimer = null;
        }
        if (this.crystalSpider) {
            this.crystalSpider.destroy();
            this.crystalSpider = null;
        }
        if (this.spiderUI) {
            this.spiderUI.destroy();
            this.spiderUI = null;
        }
        this.slidePlatforms = [];

        this.beaconAnchors.forEach(anchor => {
            anchor.visual?.destroy?.();
            anchor.label?.destroy?.();
            anchor.zone?.destroy?.();
        });
        this.beaconAnchors = [];

        if (this.woundedCrystalGrove) {
            this.woundedCrystalGrove.visual?.destroy?.();
            this.woundedCrystalGrove.label?.destroy?.();
            this.woundedCrystalGrove.zone?.destroy?.();
            this.woundedCrystalGrove = null;
        }

        // Clean up boss arena elements
        if (this.powerWellTimer) {
            this.powerWellTimer.remove();
            this.powerWellTimer = null;
        }
        if (this.powerWell) {
            this.powerWell.destroy();
            this.powerWell = null;
        }
        if (this.crystalPillars) {
            this.crystalPillars.forEach(p => p?.destroy());
            this.crystalPillars = [];
        }
        if (this.stalactites) {
            this.stalactites.forEach(s => {
                s.sprite?.destroy();
                s.shadow?.destroy();
            });
            this.stalactites = [];
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
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;

        // Clean up boss indicator
        if (this.bossIndicatorTimer) {
            this.bossIndicatorTimer.remove();
            this.bossIndicatorTimer = null;
        }
        if (this.bossIndicator) {
            this.bossIndicator.destroy();
            this.bossIndicator = null;
        }

        // Reset camera zoom
        if (this.cameras?.main) {
            this.cameras.main.setZoom(1.0);
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
        this.bossPulseText = null;
        this.bossInstructionText = null;
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

        // Destroy crystal core engine
        if (this.crystalCore) {
            this.crystalCore.destroy();
            this.crystalCore = null;
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
