import PlatformerLevelScene from '../PlatformerLevelScene.js';
import {
    FIRST_EXPEDITION_DRILL_STATE_PATH,
    FIRST_EXPEDITION_DRILL_STEPS,
    advanceFirstExpeditionDrill,
    getFirstExpeditionCompanionName,
    getFirstExpeditionDrillStep
} from '../../systems/FirstExpeditionDrill.js';
import {
    buildCreaturePowerProfile,
    recordCreaturePowerEvent
} from '../../systems/CreaturePowerProfile.js';
import { companionMediaService } from '../../systems/CompanionMediaService.js';
import { CINEMATIC_MEDIA, shouldPlayCinematicMedia } from '../../config/cinematic-media.js';

const ELDER_TREANT_TEXTURE = 'elderTreant';
const ELDER_TREANT_ASSET = '/game/guardians/elder-treant.webp';
const ELDER_TREANT_DISPLAY_HEIGHT = 310;
const FOREST_ARRIVAL_TEXTURE = 'mythicalForestArrival';
const FOREST_ARRIVAL_CINEMATIC_VERSION = 2;

const FOREST_GUARDIAN_ATTACK_WINDOWS = Object.freeze({
    root_slam: 1700,
    vine_whip: 1500,
    spore_cloud: 3600,
    nature_fury: 4800
});

const FOREST_GUARDIAN_ATTACK_CUES = Object.freeze({
    root_slam: 'ROOTS RISING // JUMP',
    vine_whip: 'VINE WHIP // MOVE BEHIND IT',
    spore_cloud: 'SPORE CLOUD // LEAVE THE CIRCLE',
    nature_fury: 'FALLING LEAVES // KEEP MOVING'
});

/**
 * MythicalForestLevel - Mystical Forest platformer level
 *
 * Story: "An ancient forest where the trees whisper secrets of the cosmos.
 * The Elder Treant guards the heart of this mystical realm, its roots reaching
 * deep into the void between worlds. The Void has twisted its pain into
 * aggression; clearing that corruption is the first chance to return trust."
 *
 * Features:
 * - Enchanted forest atmosphere with magical particles
 * - Mystical tree enemies and forest spirits
 * - Elder Treant guardian rescue with root/vine attacks
 * - Forest Core offered after the guardian is restored
 */
class MythicalForestLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            biomeId: 'mythical_forest',
            levelWidth: 8000,  // EXTENDED - longer journey to boss
            levelHeight: 1200, // Increased for vertical tree climbing
            movement: {
                playerSpeed: 200,
                jumpVelocity: -450,
                playerAcceleration: 0.20,
                playerDeceleration: 0.70,
                coyoteTime: 150,
                jumpBufferTime: 150
            }
        });

        // Level-specific state
        this.starFragmentsCollected = 0;
        this.totalStarFragments = 5;
        this.bossDefeated = false;
        this.forestCoreFound = false;
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        // Six clean katana hits are enough to teach the rescue fight without
        // making the first guardian more durable than late-game bosses.
        this.bossMaxHealth = 12;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossCorruptionText = null;
        this.bossBarLayout = null;
        this.bossNameText = null;
        this.bossInstructionText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossAttackPreview = null;

        // Forest particles
        this.forestParticles = [];
        this.magicMotes = [];

        // Cosmic trees - the core of this level
        this.cosmicTrees = [];

        // Enemy tracking
        this.voidSprites = [];      // Ground chasers
        this.branchCrawlers = [];   // Platform patrollers
        this.sporeDrifters = [];    // Floating AoE hazards
        this.forestWisps = [];      // Teleporting shooters

        // Platform tracking
        this.branchPlatforms = [];
        this.swingingVines = [];
        this.collapsingBranches = [];
        // Forest enemies use authored overlap callbacks for aerial and branch
        // behavior, while still registering with the shared attack group.
        this.enemyCollisionsManagedByLevel = true;

        // Collectibles
        this.starFragmentSprites = [];
        this.coinSprites = [];
        this.checkpointAnchors = [];
        this.beaconAnchorsActivated = 0;
        this.forestRouteAligned = false;
        this.bossTriggerZone = null;
        this.bossGateHintUntil = 0;
        this.objectiveDisplay = null;
        this.isCompactObjectiveHUD = false;

        // One-time, input-verified onboarding for Expedition 01.
        this.firstExpeditionDrill = null;
        this.firstExpeditionDrillElements = [];
        this.firstExpeditionDrillPreview = false;
        this.firstExpeditionDrillAutoCompletePreview = false;
        this.firstExpeditionDrillStepPreview = 0;
        this.firstExpeditionCompanionNamePreview = null;
        this.levelEntryElements = [];
        this.levelEntryKeyHandler = null;
        this.levelEntryDismissing = false;
        this.forestArrivalElements = [];
        this.forestArrivalRequest = 0;
    }

    /**
     * Override init to reset level-specific state on restart
     */
    init(data) {
        super.init(data);

        // Check if this is a test/preview mode - spawn boss immediately
        this.testMode = data?.testMode || false;
        this.firstExpeditionDrillPreview = data?.firstExpeditionDrillPreview === true;
        this.firstExpeditionDrillAutoCompletePreview =
            this.firstExpeditionDrillPreview &&
            data?.firstExpeditionDrillAutoCompletePreview === true;
        this.firstExpeditionDrillStepPreview =
            this.firstExpeditionDrillPreview &&
            Number.isInteger(data?.firstExpeditionDrillStepPreview)
                ? Phaser.Math.Clamp(data.firstExpeditionDrillStepPreview, 0, 2)
                : 0;
        this.firstExpeditionCompanionNamePreview =
            this.firstExpeditionDrillPreview &&
            typeof data?.companionNamePreview === 'string'
                ? data.companionNamePreview
                : null;

        // Reset level-specific state
        this.starFragmentsCollected = 0;
        this.bossDefeated = false;
        this.forestCoreFound = false;
        this.bossFightActive = false;

        // Reset boss state
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossCorruptionText = null;
        this.bossBarLayout = null;
        this.bossNameText = null;
        this.bossInstructionText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossAttackPreview = [
            'root_slam',
            'vine_whip',
            'spore_cloud',
            'nature_fury'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;

        // Reset particles
        this.forestParticles = [];
        this.magicMotes = [];

        // Reset cosmic trees and platforms
        this.cosmicTrees = [];
        this.branchPlatforms = [];
        this.swingingVines = [];
        this.collapsingBranches = [];

        // Reset enemies
        this.voidSprites = [];
        this.branchCrawlers = [];
        this.sporeDrifters = [];
        this.forestWisps = [];

        // Reset collectibles
        this.starFragmentSprites = [];
        this.coinSprites = [];
        this.checkpointAnchors = [];
        this.beaconAnchorsActivated = 0;
        this.forestRouteAligned = false;
        this.bossTriggerZone = null;
        this.bossGateHintUntil = 0;
        this.objectiveDisplay = null;
        this.isCompactObjectiveHUD = false;
        this.firstExpeditionDrill = null;
        this.firstExpeditionDrillElements = [];
        this.clearLevelEntryKeyHandler();
        this.levelEntryElements = [];
        this.levelEntryDismissing = false;

        console.log('[MythicalForestLevel] Level state reset');
    }

    preload() {
        super.preload();
        this.load.image(ELDER_TREANT_TEXTURE, ELDER_TREANT_ASSET);
        this.load.image(
            FOREST_ARRIVAL_TEXTURE,
            CINEMATIC_MEDIA.mythicalForestArrival.poster
        );
    }

    create() {
        super.create();

        if (this.prepareCurrentEcologyPreview()) return;

        // Record level entry
        if (!this.entryPreview && window.AchievementSystem?.recordEvent) {
            if (!this.firstExpeditionDrillPreview) {
                window.AchievementSystem.recordEvent('level_entered', { levelId: 'mythicalForest' });
            }
        }

        this.levelStartTime = Date.now();
        this.damageTaken = 0;

        // Show level entry or test mode
        if (this.testMode) {
            this.startTestMode();
        } else if (this.firstExpeditionDrillPreview) {
            this.startLevel();
        } else if (this.shouldShowFirstForestArrivalCinematic()) {
            this.showFirstForestArrivalCinematic(() => this.showLevelEntry());
        } else {
            this.showLevelEntry();
        }
    }

    shouldShowFirstForestArrivalCinematic() {
        return Number(window.GameState?.get?.(
            'story.projectBeacon.firstForestCinematicVersion'
        )) < FOREST_ARRIVAL_CINEMATIC_VERSION;
    }

    clearForestArrivalBackdrop() {
        this.forestArrivalElements.forEach(element => {
            element?.stop?.();
            element?.removeVideoElement?.();
            element?.destroy?.();
        });
        this.forestArrivalElements = [];
    }

    createForestArrivalMotionBackdrop(width, height, depth, fallback) {
        if (!shouldPlayCinematicMedia() || !this.add?.video) return null;
        try {
            const video = this.add.video(width / 2, height / 2)
                .setOrigin(0.5)
                .setDisplaySize(
                    Math.max(width, height * (16 / 9)),
                    Math.max(height, width * (9 / 16))
                )
                .setAlpha(0)
                .setDepth(depth)
                .setScrollFactor(0);
            video.loadURL(CINEMATIC_MEDIA.mythicalForestArrival.url, true, 'anonymous');
            video.setMute?.(true);
            video.video?.setAttribute?.('playsinline', '');
            video.once?.('playing', () => {
                video.setAlpha(0.92);
                fallback?.setAlpha?.(0.16);
            });
            video.once?.('error', () => video.destroy?.());
            video.play?.(true);
            return video;
        } catch (error) {
            console.warn('[MythicalForestLevel] Forest motion backdrop unavailable:', error);
            return null;
        }
    }

    showFirstForestArrivalCinematic(onComplete) {
        const requestId = ++this.forestArrivalRequest;
        const { width, height } = this.cameras.main;
        const depth = 3200;
        const scenicElements = [];
        const foregroundElements = [];
        let completed = false;

        this.physics.pause();

        const backgroundImage = this.add.image(
            width / 2,
            height / 2,
            FOREST_ARRIVAL_TEXTURE
        ).setOrigin(0.5)
            .setDisplaySize(
                Math.max(width, height * (16 / 9)),
                Math.max(height, width * (9 / 16))
            )
            .setDepth(depth)
            .setScrollFactor(0);
        scenicElements.push(backgroundImage);
        const motionBackdrop = this.createForestArrivalMotionBackdrop(
            width,
            height,
            depth + 1,
            backgroundImage
        );
        if (motionBackdrop) scenicElements.push(motionBackdrop);

        const background = this.add.graphics()
            .fillStyle(0x020706, 0.38)
            .fillRect(0, 0, width, height)
            .setScrollFactor(0)
            .setDepth(depth + 2);
        const status = this.add.text(
            width / 2,
            height * 0.12,
            'PROJECT BEACON // FIELD BRIEF',
            {
                fontSize: width < 600 ? '13px' : '18px',
                color: '#8FE3CF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4);
        const caption = this.add.text(
            width / 2,
            height * 0.78,
            'A signal is moving through the forest. Follow it and find out who needs help.',
            {
                fontSize: width < 600 ? '17px' : '24px',
                color: '#FFFFFF',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: width * 0.82 },
                stroke: '#020706',
                strokeThickness: 5
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4).setAlpha(0.94);
        const continueText = this.add.text(
            width / 2,
            height * 0.9,
            'TAP TO BEGIN',
            {
                fontSize: width < 600 ? '12px' : '14px',
                color: '#B9DAD7',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4).setAlpha(0.78);
        const skipZone = this.add.zone(0, 0, width, height)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        foregroundElements.push(background, status, caption, continueText, skipZone);
        this.forestArrivalElements = scenicElements;

        const finish = ({ viewed = false } = {}) => {
            if (completed) return false;
            completed = true;
            this.forestArrivalRequest += 1;
            if (viewed) {
                window.GameState?.set?.(
                    'story.projectBeacon.firstForestCinematicSeen',
                    true
                );
                window.GameState?.set?.(
                    'story.projectBeacon.firstForestCinematicVersion',
                    FOREST_ARRIVAL_CINEMATIC_VERSION
                );
                window.GameState?.save?.();
            }
            foregroundElements.forEach(element => element?.destroy?.());
            // Keep the scenery in place beneath the mission panel so the
            // transition remains visual, without obscuring its tap target.
            scenicElements.forEach(element => element?.setDepth?.(2990));
            this.physics.resume();
            onComplete?.();
            return true;
        };
        skipZone.on('pointerdown', () => finish({ viewed: true }));

        const mediaService = window.CompanionMediaService || companionMediaService;
        Promise.resolve(mediaService?.prepareCinematic?.(this, {
            momentId: 'first_forest_arrival',
            stage: window.GameState?.get?.('creature.lifecycle.stage') || 'baby'
        })).catch(() => null);

        this.tweens.add({
            targets: [caption, continueText],
            alpha: 1,
            duration: 500,
            ease: 'Sine.easeOut'
        });
        this.time.delayedCall(5200, () => finish({ viewed: true }));

        return true;
    }

    /**
     * Test mode - spawn boss immediately for preview
     */
    startTestMode() {
        console.log('[MythicalForestLevel] TEST MODE - Spawning boss immediately');

        // Create forest background
        this.createForestBackground();

        // Create basic platform for boss arena
        this.createTestArenaPlatform();

        // Position player
        if (this.player) {
            this.player.setPosition(200, this.levelHeight - 200);
        }
        this.bossFightActive = true;
        this.showPlatformerMobileControls();

        // Spawn the boss immediately
        this.time.delayedCall(500, () => {
            this.spawnElderTreant();
            if (this.bossAttackPreview) {
                this.time.delayedCall(1100, () => {
                    this.executeBossAttack(this.bossAttackPreview);
                });
            }
        });
    }

    /**
     * Create a simple test arena platform
     */
    createTestArenaPlatform() {
        const groundY = this.levelHeight - 100;

        // Ground platform
        const ground = this.add.graphics();
        ground.fillStyle(0x2D4A2D, 1);
        ground.fillRect(0, groundY, this.levelWidth, 100);

        // Add grass texture
        ground.fillStyle(0x3D5A3D, 1);
        for (let x = 0; x < this.levelWidth; x += 20) {
            const grassHeight = 5 + Math.random() * 10;
            ground.fillRect(x, groundY - grassHeight, 3, grassHeight);
        }

        // Create physics platform
        if (!this.platforms) {
            this.platforms = this.physics.add.staticGroup();
        }

        const platformZone = this.add.zone(this.levelWidth / 2, groundY + 50, this.levelWidth, 100);
        this.physics.add.existing(platformZone, true);
        this.platforms.add(platformZone);
    }

    /**
     * Show level entry screen
     */
    showLevelEntry() {
        this.clearLevelEntryKeyHandler();
        this.levelEntryDismissing = false;

        const layout = this.getLevelModalLayout({ maxWidth: 450, maxHeight: 350 });
        const {
            width, height, isCompact, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, contentRight, y, font, buttonPadding
        } = layout;
        const companionName = getFirstExpeditionCompanionName(
            window.GameState?.get?.('creature.name')
        );
        const resume = this.getExpeditionResumePresentation();

        this.physics.pause();

        // Track ALL elements for proper cleanup
        const entryElements = [];

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);
        entryElements.push(overlay);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A251A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x228B22, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);
        entryElements.push(panel);

        // Forest decorations
        this.addForestDecoration(panel, panelX + (isCompact ? 24 : 30), y(30));
        this.addForestDecoration(panel, panelX + panelWidth - (isCompact ? 24 : 30), y(30));

        // Title
        const title = this.add.text(width / 2, y(50), 'MYTHICAL FOREST', {
            fontSize: font(36, 28),
            color: '#228B22',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(title);

        // Subtitle
        const subtitle = this.add.text(
            width / 2,
            y(90),
            `"${companionName} hears a living path through the roots"`,
            {
                fontSize: font(16, 14),
                color: '#90EE90',
                fontStyle: 'italic',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(subtitle);

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(2, 0x228B22, 0.5);
        divider.lineBetween(contentLeft, y(120), contentRight, y(120));
        divider.setScrollFactor(0);
        divider.setDepth(3002);
        entryElements.push(divider);

        // Objective header
        const objHeader = this.add.text(
            width / 2,
            y(145),
            resume
                ? `PROJECT BEACON // RESUME ${resume.current}/${resume.total}`
                : 'PROJECT BEACON // EXPEDITION 01',
            {
            fontSize: font(14, 12),
            color: '#888888'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(objHeader);

        // Main objective
        const mainObj = this.add.text(width / 2, y(175), 'Free the guardian and recover the Forest Core', {
            fontSize: font(20, 17),
            color: '#90EE90',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(mainObj);

        // Secondary objectives
        const secondaryY = y(220);
        const obj1 = this.add.text(
            contentLeft,
            secondaryY,
            resume
                ? `[ BEACON ] ${resume.label} link restored`
                : '[ REQUIRED ] Follow the Current through 3 Beacon anchors',
            {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            wordWrap: { width: contentWidth }
            }
        ).setScrollFactor(0).setDepth(3002);
        entryElements.push(obj1);

        const obj2 = this.add.text(contentLeft, y(250), '[ OPTIONAL ] Collect 5 Star Fragments', {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);
        entryElements.push(obj2);

        // Enter button
        const enterBtn = this.add.text(
            width / 2,
            y(300),
            resume ? '[ RESUME EXPEDITION ]' : '[ ENTER THE FOREST ]',
            {
            fontSize: font(20, 17),
            color: '#228B22',
            backgroundColor: '#1A251A',
            padding: buttonPadding
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });
        entryElements.push(enterBtn);

        enterBtn.on('pointerover', () => enterBtn.setColor('#90EE90'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#228B22'));

        // Dismiss function - used by button and tap anywhere
        const dismissEntry = () => {
            if (this.levelEntryDismissing) {
                return false;
            }
            this.levelEntryDismissing = true;
            this.clearLevelEntryKeyHandler();
            enterBtn.disableInteractive();
            overlay.disableInteractive();

            this.clearForestArrivalBackdrop();

            // Gameplay starts immediately after an accepted input. Visual cleanup
            // can finish independently and can no longer strand a mobile player.
            this.physics.resume();
            this.startLevel();

            // Fade out ALL entry elements after the level is live.
            this.tweens.add({
                targets: entryElements,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    entryElements.forEach(el => {
                        if (el && el.destroy) el.destroy();
                    });
                    this.levelEntryElements = [];
                }
            });
            return true;
        };

        // Click button to enter
        enterBtn.on('pointerdown', dismissEntry);

        // Also allow tapping anywhere on overlay to dismiss (mobile-friendly)
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', dismissEntry);

        this.levelEntryElements = entryElements;
        this.levelEntryKeyHandler = (event) => {
            if (!['Enter', ' '].includes(event.key)) {
                return;
            }
            event.preventDefault?.();
            dismissEntry();
        };
        window.addEventListener('keydown', this.levelEntryKeyHandler);
    }

    clearLevelEntryKeyHandler() {
        if (!this.levelEntryKeyHandler) {
            return;
        }
        window.removeEventListener('keydown', this.levelEntryKeyHandler);
        this.levelEntryKeyHandler = null;
    }

    /**
     * Add forest decoration to panel
     */
    addForestDecoration(graphics, x, y) {
        // Tree silhouette
        graphics.fillStyle(0x228B22, 0.5);
        graphics.fillTriangle(x, y + 20, x - 15, y, x + 15, y);
        graphics.fillTriangle(x, y + 10, x - 10, y - 5, x + 10, y - 5);
        graphics.fillStyle(0x8B4513, 0.5);
        graphics.fillRect(x - 3, y + 20, 6, 10);
    }

    /**
     * Start the actual level
     */
    startLevel() {
        console.log('[MythicalForestLevel] Starting level');
        this.createForestBackground();
        this.createLevelSpecificContentOnce();
        this.showPlatformerMobileControls();
        this.startFirstExpeditionDrill({
            force: this.firstExpeditionDrillPreview
        });
    }

    /**
     * Mythical Forest authors its own separated ground sections. Inheriting the
     * base full-width floor would silently bridge every intended void gap.
     */
    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();
    }

    createHUD() {
        super.createHUD();

        const { width, height } = this.cameras.main;
        const isShortLandscape = width > height && height < 620;
        this.isCompactObjectiveHUD = this.isMobile || width <= 480 || height < 620;
        this.objectiveDisplay = this.add.text(
            width - (this.isCompactObjectiveHUD ? 12 : 20),
            this.isCompactObjectiveHUD
                ? (isShortLandscape ? 76 : 72)
                : 20,
            this.getForestObjectiveText(),
            {
                fontSize: this.isCompactObjectiveHUD ? '12px' : '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#E9FFF8',
                backgroundColor: 'rgba(7, 20, 17, 0.92)',
                padding: { x: 10, y: 7 },
                lineSpacing: 2,
                align: 'left',
                wordWrap: {
                    width: this.isCompactObjectiveHUD ? 190 : 320
                }
            }
        ).setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);
    }

    getForestObjectiveText() {
        const optional = `OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`;

        if (this.bossDefeated) {
            return `CURRENT RESTORED\nTHE GUARDIAN IS SAFE\n${optional}`;
        }

        if (this.bossFightActive) {
            return `RESTORE THE GUARDIAN\nSTRIKE THE PURPLE CORRUPTION\n${optional}`;
        }

        if (this.forestRouteAligned) {
            return `GUARDIAN AHEAD\nCLEAR THE PURPLE CORRUPTION\n${optional}`;
        }

        const nextAnchor = [
            'ROOTWAY',
            'CROWN PATH',
            'GUARDIAN APPROACH'
        ][this.beaconAnchorsActivated] || 'GUARDIAN APPROACH';
        const current = Math.min(this.beaconAnchorsActivated + 1, 3);

        return `ROUTE ${current}/3 // ${nextAnchor}\nFOLLOW THE CURRENT →\n${optional}`;
    }

    startFirstExpeditionDrill({ force = false } = {}) {
        const savedDrill = window.GameState?.get?.(FIRST_EXPEDITION_DRILL_STATE_PATH);
        const shouldStart = force || !savedDrill?.completed;

        if (
            !shouldStart ||
            this.entryPreview ||
            this.testMode ||
            !this.player ||
            this.firstExpeditionDrill?.active
        ) {
            return false;
        }

        this.firstExpeditionDrill = {
            active: true,
            preview: this.firstExpeditionDrillPreview,
            panelVisible: true,
            stepIndex: this.firstExpeditionDrillStepPreview,
            startX: this.player.x,
            companionName: getFirstExpeditionCompanionName(
                this.firstExpeditionCompanionNamePreview ||
                window.GameState?.get?.('creature.name')
            ),
            knot: this.createFirstExpeditionDrillKnot()
        };
        this.createFirstExpeditionDrillPanel();
        this.renderFirstExpeditionDrillStep();
        if (this.firstExpeditionDrillAutoCompletePreview) {
            ['move', 'jump', 'melee'].forEach((action, index) => {
                this.time.delayedCall(350 + index * 250, () => {
                    this.advanceFirstExpeditionDrill(action);
                });
            });
        }
        return true;
    }

    createFirstExpeditionDrillKnot() {
        const knot = this.add.graphics();
        knot.setPosition(335, this.levelHeight - 145);
        knot.setDepth(88);
        knot.fillStyle(0x32134F, 0.95);
        knot.fillCircle(0, 0, 22);
        knot.fillStyle(0x8C3DAD, 0.85);
        knot.fillCircle(-7, -5, 9);
        knot.fillCircle(8, 6, 7);
        knot.lineStyle(3, 0xF2A7FF, 0.9);
        knot.strokeCircle(0, 0, 27);
        knot.lineBetween(-25, 18, -42, 31);
        knot.lineBetween(22, 17, 40, 29);

        this.tweens.add({
            targets: knot,
            alpha: { from: 0.7, to: 1 },
            scaleX: { from: 0.92, to: 1.08 },
            scaleY: { from: 0.92, to: 1.08 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return knot;
    }

    createFirstExpeditionDrillPanel() {
        const { width, height } = this.cameras.main;
        const compact = width < 600 || height < 620;
        const panelWidth = Math.min(compact ? 360 : 430, width - 24);
        const panelHeight = compact ? 112 : 120;
        const panelX = (width - panelWidth) / 2;
        const panelY = width > height && height < 620
            ? 12
            : compact ? 98 : 24;
        const depth = 2400;

        const panel = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth);
        panel.fillStyle(0x071411, 0.94);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x71E6B1, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);

        const header = this.add.text(width / 2, panelY + 15, 'PROJECT BEACON // FIELD DRILL', {
            fontSize: compact ? '10px' : '11px',
            color: '#71E6B1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

        const heading = this.add.text(width / 2, panelY + 37, '', {
            fontSize: compact ? '14px' : '16px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

        const instruction = this.add.text(width / 2, panelY + 60, '', {
            fontSize: compact ? '12px' : '13px',
            color: '#C8D8D4',
            align: 'center',
            wordWrap: { width: panelWidth - 24 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

        const control = this.add.text(width / 2, panelY + 92, '', {
            fontSize: compact ? '11px' : '12px',
            color: '#F3D77B',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

        const progress = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);

        this.firstExpeditionDrillElements = [
            panel,
            header,
            heading,
            instruction,
            control,
            progress
        ];
        this.firstExpeditionDrillUI = {
            heading,
            instruction,
            control,
            progress,
            centerX: width / 2,
            progressY: panelY + panelHeight - 8
        };
    }

    renderFirstExpeditionDrillStep() {
        if (!this.firstExpeditionDrill?.active || !this.firstExpeditionDrillUI) {
            return;
        }

        const step = getFirstExpeditionDrillStep(
            this.firstExpeditionDrill.stepIndex,
            {
                isMobile: this.isMobile,
                companionName: this.firstExpeditionDrill.companionName
            }
        );
        const ui = this.firstExpeditionDrillUI;

        ui.heading.setText(step.heading);
        ui.instruction.setText(step.instruction);
        ui.control.setText(step.control);
        this.showMobileControlCoach?.(
            step.action === 'move' ? 'joystick' : step.action
        );
        ui.progress.clear();

        const spacing = 16;
        const startX = ui.centerX - spacing;
        FIRST_EXPEDITION_DRILL_STEPS.forEach((_, index) => {
            const complete = index < this.firstExpeditionDrill.stepIndex;
            const active = index === this.firstExpeditionDrill.stepIndex;
            ui.progress.fillStyle(
                complete ? 0x71E6B1 : active ? 0xF3D77B : 0x46635C,
                1
            );
            ui.progress.fillCircle(startX + index * spacing, ui.progressY, active ? 4 : 3);
        });
    }

    updateFirstExpeditionDrill() {
        const drill = this.firstExpeditionDrill;
        if (!drill?.active || drill.stepIndex !== 0 || !this.player) {
            return;
        }

        if (Math.abs(this.player.x - drill.startX) >= 48) {
            this.advanceFirstExpeditionDrill('move');
        }
    }

    advanceFirstExpeditionDrill(action) {
        const drill = this.firstExpeditionDrill;
        if (!drill?.active) {
            return false;
        }

        const result = advanceFirstExpeditionDrill(drill.stepIndex, action);
        if (!result.advanced) {
            return false;
        }

        drill.stepIndex = result.stepIndex;
        window.AudioManager?.playButtonClick?.();

        if (result.completed) {
            this.completeFirstExpeditionDrill();
        } else {
            this.renderFirstExpeditionDrillStep();
        }
        return true;
    }

    completeFirstExpeditionDrill() {
        const drill = this.firstExpeditionDrill;
        if (!drill?.active) {
            return;
        }

        drill.active = false;
        const ui = this.firstExpeditionDrillUI;
        const companionName = drill.companionName || 'Your companion';
        const powerProfile = buildCreaturePowerProfile(window.GameState, {
            context: 'fend'
        });
        ui?.heading?.setText('FIELD DRILL COMPLETE');
        ui?.instruction?.setText(
            `${companionName} answers the astronaut's katana stance with ` +
            `${powerProfile.affinityPower.name}.`
        );
        ui?.control?.setText(
            `POWER WITNESSED // ${powerProfile.affinityLabel.toUpperCase()}`
        );
        ui?.progress?.clear();
        this.showFirstExpeditionPowerResponse(
            powerProfile,
            drill.knot
        );

        if (drill.knot?.active) {
            this.tweens.killTweensOf(drill.knot);
            this.tweens.add({
                targets: drill.knot,
                alpha: 0,
                scaleX: 1.7,
                scaleY: 1.7,
                duration: 350,
                onComplete: () => drill.knot?.destroy?.()
            });
        }

        if (!drill.preview && window.GameState) {
            window.GameState.set(FIRST_EXPEDITION_DRILL_STATE_PATH, {
                completed: true,
                completedAt: new Date().toISOString()
            });
            recordCreaturePowerEvent(window.GameState, {
                eventId: 'forest_knot_response',
                powerId: powerProfile.affinityPower.id,
                context: 'fend',
                magnitude: 'major',
                outcome: 'living_path_opened',
                save: false
            });
            window.GameState.save?.();
        }

        window.AudioManager?.playAchievement?.();
        this.time.delayedCall(2400, () => this.clearFirstExpeditionDrill());
    }

    showFirstExpeditionPowerResponse(profile, knot) {
        if (!profile || !knot?.active) {
            return;
        }

        const wave = this.add.graphics()
            .setPosition(knot.x, knot.y)
            .setDepth(90);
        wave.lineStyle(5, profile.color, 0.95);
        wave.strokeCircle(0, 0, 24);
        wave.lineStyle(2, 0xFFFFFF, 0.8);
        wave.strokeCircle(0, 0, 34);

        this.tweens.add({
            targets: wave,
            alpha: 0,
            scaleX: 4,
            scaleY: 4,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => wave.destroy()
        });
        window.FeedbackManager?.cameraFlash?.(this, 220, 143, 227, 207);
        window.FXLibrary?.stardustBurst?.(this, knot.x, knot.y, {
            count: 24,
            color: [profile.color, 0x8FE3CF, 0xFFFFFF],
            duration: 1000
        });
        const cameraView = this.cameras.main.worldView;
        const labelX = Phaser.Math.Clamp(
            knot.x,
            cameraView.x + 110,
            cameraView.right - 110
        );
        this.showFloatingText(
            profile.affinityPower.name.toUpperCase(),
            labelX,
            knot.y - 70,
            '#FFFFFF'
        );
    }

    clearFirstExpeditionDrill() {
        this.clearMobileControlCoach?.();
        this.firstExpeditionDrillElements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.firstExpeditionDrillElements = [];
        this.firstExpeditionDrillUI = null;
        if (this.firstExpeditionDrill) {
            this.firstExpeditionDrill.panelVisible = false;
        }
        this.objectiveDisplay?.setVisible?.(
            !(this.isCompactObjectiveHUD && this.bossFightActive)
        );

        const knot = this.firstExpeditionDrill?.knot;
        if (knot?.active) {
            this.tweens?.killTweensOf?.(knot);
            knot.destroy();
        }
        this.firstExpeditionDrill = null;
    }

    update(time, delta) {
        super.update(time, delta);
        if (this.levelCompletionActive) return;
        this.updateFirstExpeditionDrill();
        if (this.objectiveDisplay) {
            this.objectiveDisplay.setText(this.getForestObjectiveText());
            this.objectiveDisplay.setVisible(
                !this.firstExpeditionDrill?.panelVisible &&
                !(this.isCompactObjectiveHUD && this.bossFightActive)
            );
        }
    }

    executeJump() {
        if (this.levelCompletionActive) return;
        super.executeJump();
        this.advanceFirstExpeditionDrill('jump');
    }

    performAttack() {
        if (this.levelCompletionActive) return;
        const drill = this.firstExpeditionDrill;
        const playerAttackX = this.player.facingRight
            ? this.player.x + 50
            : this.player.x - 50;
        const drillKnot = drill?.active &&
            drill.stepIndex === 2 &&
            drill.knot?.active
            ? drill.knot
            : null;
        const knotInRange = Boolean(
            drillKnot && Math.abs(playerAttackX - drillKnot.x) <= 105
        );
        super.performAttack({
            targetXOverride: knotInRange ? drillKnot.x : null,
            targetYOverride: knotInRange ? drillKnot.y : null
        });

        if (!drill?.active || drill.stepIndex !== 2 || !drill.knot?.active) {
            return;
        }

        if (
            knotInRange &&
            !drill.katanaStrikePending
        ) {
            drill.katanaStrikePending = true;
            this.firstExpeditionDrillUI?.control?.setText(
                'KATANA STRIKE // HOLD THE STANCE'
            );
            this.time.delayedCall(220, () => {
                if (!drill.active) return;
                drill.katanaStrikePending = false;
                this.advanceFirstExpeditionDrill('melee');
            });
        }
    }

    /**
     * Create mystical forest background
     */
    createForestBackground() {
        const { width, height } = this.cameras.main;

        // Dark forest gradient background
        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(-100);

        // Gradient from dark purple to dark green
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(10 + ratio * 20);
            const g = Math.floor(20 + ratio * 40);
            const b = Math.floor(30 + ratio * 20);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        // Add mystical mist/fog
        this.createMysticalMist();

        // Add floating particles
        this.createForestParticles();
    }

    /**
     * Create mystical mist effect
     */
    createMysticalMist() {
        const { width, height } = this.cameras.main;

        for (let i = 0; i < 5; i++) {
            const mist = this.add.graphics();
            mist.setScrollFactor(0.1 + i * 0.1);
            mist.setDepth(-50 + i);
            mist.fillStyle(0x228B22, 0.05);

            // Create organic mist shapes
            for (let j = 0; j < 3; j++) {
                const x = Math.random() * width;
                const y = height * 0.6 + Math.random() * height * 0.3;
                const radius = 100 + Math.random() * 150;
                mist.fillCircle(x, y, radius);
            }
        }
    }

    /**
     * Create floating forest particles
     */
    createForestParticles() {
        // Create floating motes of light
        for (let i = 0; i < 30; i++) {
            const mote = this.add.graphics();
            const x = Math.random() * this.levelWidth;
            const y = Math.random() * this.levelHeight * 0.8;

            // Random green/gold/purple colors
            const colors = [0x90EE90, 0xFFD700, 0x9370DB, 0x00FF7F];
            const color = colors[Math.floor(Math.random() * colors.length)];

            mote.fillStyle(color, 0.6);
            mote.fillCircle(0, 0, 2 + Math.random() * 3);
            mote.setPosition(x, y);
            mote.setDepth(50);

            // Gentle floating animation
            this.tweens.add({
                targets: mote,
                y: y - 20 - Math.random() * 30,
                alpha: { from: 0.6, to: 0.2 },
                duration: 3000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.magicMotes.push(mote);
        }
    }

    /**
     * Create level content - platforms, enemies, collectibles
     *
     * LEVEL LAYOUT:
     * - 6 Cosmic Trees to climb with branch platforms
     * - Ground level with void gaps between trees
     * - Enemies patrolling ground and branches
     * - 5 Star Fragments hidden at challenging locations
     * - Boss arena at the end (Tree 6)
     */
    createLevelContent() {
        console.log('[MythicalForestLevel] Creating level content...');

        // Create ground with void gaps
        this.createGroundPlatforms();

        // Create the 6 cosmic trees - the core vertical platforming
        this.createCosmicTrees();

        // Add enemies throughout the level
        this.createEnemies();

        // Place collectibles
        this.placeCollectibles();

        // Place recovery anchors so a failed rescue does not erase the full expedition.
        this.createBeaconCheckpoints();

        // Create boss arena at the end
        this.createBossArena();

        console.log('[MythicalForestLevel] Level content created!');
    }

    createBeaconCheckpoints() {
        const groundY = this.levelHeight - 100;
        const anchors = [
            { id: 'forest_anchor_1', x: 1770, label: 'ROOTWAY' },
            { id: 'forest_anchor_2', x: 3570, label: 'CROWN PATH' },
            { id: 'forest_anchor_3', x: 5300, label: 'GUARDIAN APPROACH' }
        ];

        anchors.forEach((anchor, index) => {
            const visual = this.add.graphics();
            visual.setDepth(85);
            this.drawBeaconCheckpoint(visual, anchor.x, groundY, false);

            const label = this.add.text(anchor.x, groundY - 118, anchor.label, {
                fontSize: '11px',
                color: '#7F9CA2',
                fontStyle: 'bold',
                stroke: '#071017',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(86);

            // The intended route crosses these points at several heights.
            // Synchronize on horizontal passage so tree climbers cannot miss one.
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
                respawnY: this.levelHeight - 200
            };

            this.physics.add.overlap(this.player, zone, () => {
                this.activateBeaconCheckpoint(checkpoint);
            });
            this.checkpointAnchors.push(checkpoint);
        });
    }

    drawBeaconCheckpoint(graphics, x, groundY, activated) {
        graphics.clear();
        const color = activated ? 0x8FE3CF : 0x35565D;
        const glowAlpha = activated ? 0.3 : 0.12;

        graphics.fillStyle(color, glowAlpha);
        graphics.fillCircle(x, groundY - 62, 34);
        graphics.lineStyle(3, color, activated ? 1 : 0.65);
        graphics.strokeCircle(x, groundY - 62, 24);
        graphics.lineStyle(2, color, 0.8);
        graphics.lineBetween(x, groundY - 38, x, groundY - 5);
        graphics.fillStyle(color, 0.95);
        graphics.fillTriangle(
            x,
            groundY - 86,
            x - 8,
            groundY - 68,
            x + 8,
            groundY - 68
        );
    }

    activateBeaconCheckpoint(checkpoint) {
        if (!checkpoint || checkpoint.activated) return;

        checkpoint.activated = true;
        checkpoint.zone?.destroy?.();
        checkpoint.zone = null;
        this.beaconAnchorsActivated++;
        this.drawBeaconCheckpoint(
            checkpoint.visual,
            checkpoint.x,
            this.levelHeight - 100,
            true
        );
        checkpoint.label.setColor('#8FE3CF');
        this.setCheckpoint(checkpoint.x, checkpoint.respawnY, {
            persist: true,
            checkpointId: checkpoint.id,
            checkpointIndex: checkpoint.index
        });

        const anchorNumber = this.beaconAnchorsActivated;
        this.showFloatingText(
            `PROJECT BEACON ANCHOR ${anchorNumber}/3`,
            checkpoint.x,
            checkpoint.respawnY - 35,
            '#8FE3CF'
        );

        const companionName = getFirstExpeditionCompanionName(
            window.GameState?.get?.('creature.name')
        );
        if (anchorNumber === 1) {
            this.time.delayedCall(700, () => {
                this.showFloatingText(
                    `${companionName}: "Rootway locked. We can return here."`,
                    checkpoint.x,
                    checkpoint.respawnY - 70,
                    '#D6EEF2'
                );
            });
        } else if (anchorNumber === 2) {
            this.time.delayedCall(700, () => {
                this.showFloatingText(
                    `${companionName}: "The Current is stronger. Keep going."`,
                    checkpoint.x,
                    checkpoint.respawnY - 70,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconAnchorsActivated === this.checkpointAnchors.length) {
            this.forestRouteAligned = true;
            this.time.delayedCall(700, () => {
                this.showFloatingText(
                    `${companionName}: "The guardian hears us. Stay close."`,
                    checkpoint.x,
                    checkpoint.respawnY - 70,
                    '#F2C94C'
                );
            });
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'forest_route_aligned'
            });
        }

        window.AudioManager?.playAchievement?.();
    }

    restoreExpeditionRouteState(resume) {
        return this.restoreExpeditionRouteSignals(resume, {
            signals: this.checkpointAnchors,
            countProperty: 'beaconAnchorsActivated',
            readyProperty: 'forestRouteAligned',
            drawSignal: checkpoint => this.drawBeaconCheckpoint(
                checkpoint.visual,
                checkpoint.x,
                this.levelHeight - 100,
                true
            ),
            onRestored: () => {
                this.objectiveDisplay?.setText?.(this.getForestObjectiveText());
            }
        });
    }

    /**
     * Create ground platforms with LARGE void gaps that FORCE tree climbing
     * Players CANNOT simply run across the ground - they MUST use the trees!
     */
    createGroundPlatforms() {
        const groundY = this.levelHeight - 100;

        // Ground sections with MAJOR gaps - impossible to jump across
        // Each gap is 400-600px - players MUST climb trees to cross
        const groundSections = [
            { x: 0, width: 400 },       // Starting area - climb Tree 1
            // GAP: 400-900 (500px) - MUST climb Tree 1 to cross
            { x: 900, width: 200 },     // Small landing
            // GAP: 1100-1700 (600px) - MUST climb Tree 2 to cross
            { x: 1700, width: 300 },    // Mid checkpoint
            // GAP: 2000-2600 (600px) - MUST climb Tree 3 to cross
            { x: 2600, width: 200 },    // Small landing
            // GAP: 2800-3500 (700px) - MUST climb Tree 4 to cross
            { x: 3500, width: 300 },    // Pre-boss area
            // GAP: 3800-5200 (1400px) - MUST climb Tree 5 to reach boss
            { x: 5200, width: 2800 }    // Boss arena (extended for longer level)
        ];

        groundSections.forEach(section => {
            // Visual ground
            const ground = this.add.graphics();
            ground.setDepth(10);

            // Dark cosmic soil
            ground.fillStyle(0x1A251A, 1);
            ground.fillRect(section.x, groundY, section.width, 100);

            // Bioluminescent grass/roots
            ground.fillStyle(0x00FF7F, 0.3);
            for (let x = section.x; x < section.x + section.width; x += 15) {
                const grassHeight = 8 + Math.random() * 12;
                ground.fillRect(x, groundY - grassHeight, 2, grassHeight);
            }

            // Glowing root veins
            ground.lineStyle(2, 0x9370DB, 0.4);
            for (let i = 0; i < 3; i++) {
                const rootX = section.x + Math.random() * section.width;
                ground.lineBetween(rootX, groundY, rootX + (Math.random() - 0.5) * 50, groundY + 50);
            }

            // Physics platform
            const platformZone = this.add.zone(
                section.x + section.width / 2,
                groundY + 10,
                section.width,
                20
            );
            this.physics.add.existing(platformZone, true);
            this.platforms.add(platformZone);
        });

        // Add void pit warnings
        this.createVoidPitWarnings();
    }

    /**
     * Create warning indicators above void pits
     * These are LARGE pits - players must use trees to cross!
     */
    createVoidPitWarnings() {
        // Major void pits - these are IMPASSABLE by jumping
        const voidPits = [
            { x: 400, width: 500 },    // Tree 1 gap - 500px
            { x: 1100, width: 600 },   // Tree 2 gap - 600px
            { x: 2000, width: 600 },   // Tree 3 gap - 600px
            { x: 2800, width: 700 },   // Tree 4 gap - 700px
            { x: 3800, width: 1400 }   // Tree 5 gap - 1400px (final approach to boss)
        ];

        voidPits.forEach(pit => {
            // Ominous glow from below
            const warning = this.add.graphics();
            warning.setDepth(5);
            warning.fillStyle(0x4B0082, 0.3);
            warning.fillRect(pit.x, this.levelHeight - 100, pit.width, 100);

            // Animated warning particles
            this.time.addEvent({
                delay: 500 + Math.random() * 500,
                callback: () => {
                    if (!this.scene.isActive()) return;
                    const particle = this.add.graphics();
                    particle.fillStyle(0x9370DB, 0.6);
                    particle.fillCircle(0, 0, 3);
                    particle.setPosition(
                        pit.x + Math.random() * pit.width,
                        this.levelHeight - 20
                    );
                    particle.setDepth(6);

                    this.tweens.add({
                        targets: particle,
                        y: this.levelHeight - 100,
                        alpha: 0,
                        duration: 1000,
                        onComplete: () => particle.destroy()
                    });
                },
                loop: true
            });
        });
    }

    /**
     * Create the 6 Cosmic Trees - SPACE TREES, not earth trees!
     * These are crystalline spires with bioluminescent foliage
     * CRITICAL: Trees are positioned to span the void gaps - ONLY way to cross!
     */
    createCosmicTrees() {
        const treeConfigs = [
            // Tree 1: Tutorial tree - spans gap at x:400-900 - MUST climb to cross
            { x: 300, baseY: this.levelHeight - 100, height: 500, branches: 5, difficulty: 'easy' },
            // Tree 2: Spans gap at x:1100-1700 - branches reach across
            { x: 1000, baseY: this.levelHeight - 100, height: 600, branches: 6, difficulty: 'medium' },
            // Tree 3: Spans gap at x:2000-2600 - has enemies on branches
            { x: 1900, baseY: this.levelHeight - 100, height: 700, branches: 7, difficulty: 'medium' },
            // Tree 4: Spans gap at x:2800-3500 - tallest, spiral climb
            { x: 2700, baseY: this.levelHeight - 100, height: 850, branches: 9, difficulty: 'hard' },
            // Tree 5: Spans gap at x:3800-4600 - challenging final approach
            { x: 3600, baseY: this.levelHeight - 100, height: 800, branches: 8, difficulty: 'hard' },
            // Tree 6: Boss approach tree - higher platforms for boss arena access
            { x: 5500, baseY: this.levelHeight - 100, height: 700, branches: 6, difficulty: 'boss' }
        ];

        treeConfigs.forEach((config, index) => {
            this.createCosmicTree(config, index);
        });

        // Create connecting platforms between trees
        this.createTreeBridges();
    }

    /**
     * Create a single cosmic tree with branches
     * These are alien crystalline trees, NOT earth trees!
     */
    createCosmicTree(config, treeIndex) {
        const { x, baseY, height, branches, difficulty } = config;

        // === TRUNK: Crystalline spire with glowing veins ===
        const trunk = this.add.graphics();
        trunk.setDepth(20);

        // Main trunk shape (angular, crystalline)
        const trunkWidth = 60 + treeIndex * 5;
        trunk.fillStyle(0x1A1A3E, 1); // Dark purple-blue

        // Draw angular trunk (not round like earth trees)
        trunk.beginPath();
        trunk.moveTo(x - trunkWidth/2, baseY);
        trunk.lineTo(x - trunkWidth/3, baseY - height * 0.3);
        trunk.lineTo(x - trunkWidth/4, baseY - height * 0.6);
        trunk.lineTo(x - trunkWidth/6, baseY - height * 0.85);
        trunk.lineTo(x, baseY - height);
        trunk.lineTo(x + trunkWidth/6, baseY - height * 0.85);
        trunk.lineTo(x + trunkWidth/4, baseY - height * 0.6);
        trunk.lineTo(x + trunkWidth/3, baseY - height * 0.3);
        trunk.lineTo(x + trunkWidth/2, baseY);
        trunk.closePath();
        trunk.fillPath();

        // Glowing energy veins
        const veinColors = [0x00FF7F, 0x9370DB, 0x00CED1, 0xFF69B4];
        const veinColor = veinColors[treeIndex % veinColors.length];
        trunk.lineStyle(3, veinColor, 0.8);

        // Main central vein
        trunk.beginPath();
        trunk.moveTo(x, baseY);
        for (let y = baseY; y > baseY - height; y -= 30) {
            const wobble = Math.sin((baseY - y) * 0.02) * 5;
            trunk.lineTo(x + wobble, y);
        }
        trunk.stroke();

        // Side veins
        trunk.lineStyle(2, veinColor, 0.5);
        for (let i = 0; i < 4; i++) {
            const veinY = baseY - height * (0.2 + i * 0.2);
            const direction = i % 2 === 0 ? -1 : 1;
            trunk.beginPath();
            trunk.moveTo(x, veinY);
            trunk.lineTo(x + direction * (trunkWidth/2 + 20), veinY - 30);
            trunk.stroke();
        }

        // === BRANCHES: Semi-transparent crystalline platforms ===
        const branchSpacing = height / (branches + 1);

        for (let i = 0; i < branches; i++) {
            const branchY = baseY - branchSpacing * (i + 1);
            const direction = i % 2 === 0 ? -1 : 1;
            // Route-critical geometry must be repeatable across runs. Cosmetic
            // particles can vary; a jump target cannot.
            const branchLength = 96 + ((treeIndex * 29 + i * 17) % 36);

            // Visual branch
            const branch = this.add.graphics();
            branch.setDepth(25);

            // Crystal branch (angular, geometric)
            branch.fillStyle(0x2A2A5E, 0.9);
            branch.lineStyle(2, veinColor, 0.6);

            const branchX = x + direction * (trunkWidth/4);
            const endX = branchX + direction * branchLength;

            // Draw angular branch
            branch.beginPath();
            branch.moveTo(branchX, branchY - 8);
            branch.lineTo(endX, branchY - 12);
            branch.lineTo(endX + direction * 10, branchY);
            branch.lineTo(endX, branchY + 12);
            branch.lineTo(branchX, branchY + 8);
            branch.closePath();
            branch.fillPath();
            branch.strokePath();

            // Glowing tip
            branch.fillStyle(veinColor, 0.6);
            branch.fillCircle(endX + direction * 5, branchY, 8);

            // Physics platform for the branch
            const platformWidth = branchLength + 20;
            const platformX = (branchX + endX) / 2;

            const branchPlatform = this.add.zone(platformX, branchY + 10, platformWidth, 20);
            this.physics.add.existing(branchPlatform, true);
            this.platforms.add(branchPlatform);
            this.branchPlatforms.push({
                zone: branchPlatform,
                treeIndex,
                branchIndex: i,
                difficulty
            });

            // Add floating bioluminescent orbs around branches (not leaves!)
            this.createBioluminescentOrbs(endX, branchY, veinColor, 3 + Math.floor(Math.random() * 3));
        }

        // Add special platform at tree top
        const topPlatform = this.add.zone(x, baseY - height + 20, 100, 20);
        this.physics.add.existing(topPlatform, true);
        this.platforms.add(topPlatform);

        // Visual crown at top (crystal formation, not leaves)
        const crown = this.add.graphics();
        crown.setDepth(30);
        crown.fillStyle(veinColor, 0.4);

        // Crystal crown spikes
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI - Math.PI/2;
            const spikeX = x + Math.cos(angle) * 30;
            const spikeY = baseY - height - 20 + Math.sin(angle) * 20;
            crown.fillTriangle(
                x, baseY - height,
                spikeX - 8, spikeY,
                spikeX + 8, spikeY - 15
            );
        }

        // Pulsing glow effect on crown
        this.tweens.add({
            targets: crown,
            alpha: { from: 0.4, to: 0.8 },
            duration: 1500 + treeIndex * 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Store tree reference
        this.cosmicTrees.push({
            x, baseY, height, branches, difficulty, treeIndex,
            trunk, crown, veinColor
        });
    }

    /**
     * Create floating bioluminescent orbs (alien "foliage")
     */
    createBioluminescentOrbs(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const orb = this.add.graphics();
            const orbX = x + (Math.random() - 0.5) * 60;
            const orbY = y + (Math.random() - 0.5) * 40 - 20;
            const orbSize = 4 + Math.random() * 4;

            orb.fillStyle(color, 0.6);
            orb.fillCircle(0, 0, orbSize);
            orb.fillStyle(0xFFFFFF, 0.8);
            orb.fillCircle(-orbSize/3, -orbSize/3, orbSize/3);
            orb.setPosition(orbX, orbY);
            orb.setDepth(35);

            // Gentle floating animation
            this.tweens.add({
                targets: orb,
                y: orbY - 10 - Math.random() * 10,
                x: orbX + (Math.random() - 0.5) * 20,
                alpha: { from: 0.6, to: 0.3 },
                duration: 2000 + Math.random() * 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.magicMotes.push(orb);
        }
    }

    /**
     * Create all enemies for the forest level
     * 4 enemy types with distinct behaviors
     */
    createEnemies() {
        console.log('[MythicalForestLevel] Creating forest enemies...');
        this.enemies = this.physics.add.group();

        // === VOID SPRITES: Ground-based chasers ===
        // These lurk in the shadows and chase the player
        const voidSpritePositions = [
            { x: 700, y: this.levelHeight - 150 },
            { x: 1600, y: this.levelHeight - 150 },
            { x: 2300, y: this.levelHeight - 150 },
            { x: 3100, y: this.levelHeight - 150 },
            { x: 4500, y: this.levelHeight - 150 }
        ];

        voidSpritePositions.forEach((pos, index) => {
            this.createVoidSprite(pos.x, pos.y, index);
        });

        // === BRANCH CRAWLERS: Patrol on tree branches ===
        // These patrol specific branches and knock players off
        const crawlerBranches = [
            { treeIndex: 1, branchIndex: 2 },  // Tree 2, middle branch
            { treeIndex: 2, branchIndex: 3 },  // Tree 3, higher branch
            { treeIndex: 3, branchIndex: 4 },  // Tree 4, mid-high
            { treeIndex: 3, branchIndex: 6 },  // Tree 4, near top
            { treeIndex: 4, branchIndex: 3 },  // Tree 5, middle
            { treeIndex: 4, branchIndex: 5 }   // Tree 5, higher
        ];

        crawlerBranches.forEach((config, index) => {
            this.createBranchCrawler(config, index);
        });

        // === SPORE DRIFTERS: Floating AoE hazards ===
        // These float in clusters and emit damaging spores
        // REDUCED DENSITY: Max 2 per cluster to prevent trapping player
        const sporeDrifterClusters = [
            { x: 900, y: this.levelHeight - 400, count: 2 },
            { x: 1800, y: this.levelHeight - 500, count: 1 },
            { x: 2700, y: this.levelHeight - 450, count: 2 },
            { x: 3600, y: this.levelHeight - 600, count: 2 },
            { x: 4200, y: this.levelHeight - 400, count: 1 }
        ];

        sporeDrifterClusters.forEach((cluster, index) => {
            for (let i = 0; i < cluster.count; i++) {
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 100;
                this.createSporeDrifter(cluster.x + offsetX, cluster.y + offsetY, index * 10 + i);
            }
        });

        // === FOREST WISPS: Teleporting shooters ===
        // These blink in and out, shooting at the player
        const wispPositions = [
            { x: 1100, y: this.levelHeight - 300 },
            { x: 2500, y: this.levelHeight - 500 },
            { x: 3400, y: this.levelHeight - 650 },
            { x: 4600, y: this.levelHeight - 350 }
        ];

        wispPositions.forEach((pos, index) => {
            this.createForestWisp(pos.x, pos.y, index);
        });

        console.log(`[MythicalForestLevel] Created ${this.voidSprites.length} Void Sprites, ${this.branchCrawlers.length} Branch Crawlers, ${this.sporeDrifters.length} Spore Drifters, ${this.forestWisps.length} Forest Wisps`);
    }

    /**
     * Create a Void Sprite enemy - shadow creature that chases player on ground
     */
    createVoidSprite(x, y, index) {
        // Create texture if not exists
        const textureKey = 'voidSprite';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = 40;

            // Shadowy base
            graphics.fillStyle(0x1A0A2E, 1);
            graphics.fillCircle(size/2, size/2 + 5, 15);

            // Wispy tendrils
            graphics.fillStyle(0x4B0082, 0.8);
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const tendrilX = size/2 + Math.cos(angle) * 12;
                const tendrilY = size/2 + 5 + Math.sin(angle) * 8;
                graphics.fillCircle(tendrilX, tendrilY, 5);
            }

            // Glowing eyes
            graphics.fillStyle(0xFF00FF, 1);
            graphics.fillCircle(size/2 - 6, size/2 - 2, 4);
            graphics.fillCircle(size/2 + 6, size/2 - 2, 4);

            // Eye glow
            graphics.fillStyle(0xFF88FF, 0.5);
            graphics.fillCircle(size/2 - 6, size/2 - 2, 6);
            graphics.fillCircle(size/2 + 6, size/2 - 2, 6);

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        // Create sprite
        const sprite = this.physics.add.sprite(x, y, textureKey);
        sprite.setDepth(100);
        sprite.body.setSize(30, 25);
        sprite.body.setOffset(5, 10);
        sprite.setCollideWorldBounds(true);
        sprite.setBounce(0);

        // Enemy properties
        sprite.health = 2;
        sprite.damage = 1;
        sprite.enemyType = 'voidSprite';
        sprite.speed = 80;
        sprite.detectionRange = 250;
        sprite.isChasing = false;
        this.enemies.add(sprite);
        this.configureEnemyCombat(sprite, {
            role: 'chaser',
            maxHealth: 2,
            cueOffsetY: -40,
            onDefeat: enemy => this.killEnemy(enemy)
        });

        // Add to platforms collider
        if (this.platforms) {
            this.physics.add.collider(sprite, this.platforms);
        }

        // Player collision
        if (this.player) {
            this.physics.add.overlap(this.player, sprite, () => {
                this.handleEnemyCollision(sprite);
            });
        }

        // Shadow trail effect
        this.time.addEvent({
            delay: 100,
            callback: () => {
                if (!sprite.active || !this.scene.isActive()) return;
                const shadow = this.add.graphics();
                shadow.fillStyle(0x4B0082, 0.3);
                shadow.fillCircle(0, 0, 10);
                shadow.setPosition(sprite.x, sprite.y + 10);
                shadow.setDepth(99);
                this.tweens.add({
                    targets: shadow,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => shadow.destroy()
                });
            },
            loop: true
        });

        // AI behavior
        this.time.addEvent({
            delay: 200,
            callback: () => this.updateVoidSpriteAI(sprite),
            loop: true
        });

        this.voidSprites.push(sprite);
    }

    /**
     * Void Sprite AI - chase player when in range
     */
    updateVoidSpriteAI(sprite) {
        if (!sprite.active || !this.player || !this.scene.isActive()) return;

        const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);

        if (distance < sprite.detectionRange) {
            sprite.isChasing = true;
            const direction = this.player.x > sprite.x ? 1 : -1;
            sprite.setVelocityX(direction * sprite.speed);
            sprite.setFlipX(direction < 0);
        } else {
            sprite.isChasing = false;
            sprite.setVelocityX(0);
        }
    }

    /**
     * Create a Branch Crawler - patrols on tree branches
     */
    createBranchCrawler(config, index) {
        // Find the branch platform
        const branchPlatform = this.branchPlatforms.find(bp =>
            bp.treeIndex === config.treeIndex && bp.branchIndex === config.branchIndex
        );

        if (!branchPlatform) return;

        const zone = branchPlatform.zone;
        const x = zone.x;
        const y = zone.y - 25;

        // Create texture
        const textureKey = 'branchCrawler';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const width = 50;
            const height = 30;

            // Centipede-like body
            graphics.fillStyle(0x2D5A2D, 1);
            for (let i = 0; i < 5; i++) {
                graphics.fillCircle(8 + i * 9, height/2, 8);
            }

            // Legs
            graphics.lineStyle(2, 0x1A3A1A, 1);
            for (let i = 0; i < 5; i++) {
                const segX = 8 + i * 9;
                graphics.lineBetween(segX, height/2 + 6, segX - 4, height - 2);
                graphics.lineBetween(segX, height/2 + 6, segX + 4, height - 2);
            }

            // Glowing spots
            graphics.fillStyle(0x90EE90, 0.8);
            for (let i = 0; i < 4; i++) {
                graphics.fillCircle(12 + i * 9, height/2 - 2, 3);
            }

            // Mandibles
            graphics.fillStyle(0xFF6347, 1);
            graphics.fillTriangle(2, height/2, -5, height/2 - 5, -5, height/2 + 5);

            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        // Create sprite
        const sprite = this.physics.add.sprite(x, y, textureKey);
        sprite.setDepth(110);
        sprite.body.setSize(40, 20);
        sprite.body.setAllowGravity(false);

        // Patrol properties
        sprite.health = 3;
        sprite.damage = 1;
        sprite.enemyType = 'branchCrawler';
        sprite.speed = 60;
        sprite.patrolLeft = zone.x - zone.width/2 + 30;
        sprite.patrolRight = zone.x + zone.width/2 - 30;
        sprite.direction = 1;
        this.enemies.add(sprite);
        this.configureEnemyCombat(sprite, {
            role: 'armored',
            maxHealth: 3,
            stompDamage: 1,
            cueOffsetY: -34,
            onDefeat: enemy => this.killEnemy(enemy)
        });

        // Player collision
        if (this.player) {
            this.physics.add.overlap(this.player, sprite, () => {
                this.handleEnemyCollision(sprite);
            });
        }

        // Patrol AI
        this.time.addEvent({
            delay: 50,
            callback: () => {
                if (!sprite.active || !this.scene.isActive()) return;

                sprite.x += sprite.direction * sprite.speed * 0.05;

                if (sprite.x >= sprite.patrolRight) {
                    sprite.direction = -1;
                    sprite.setFlipX(true);
                } else if (sprite.x <= sprite.patrolLeft) {
                    sprite.direction = 1;
                    sprite.setFlipX(false);
                }
            },
            loop: true
        });

        this.branchCrawlers.push(sprite);
    }

    /**
     * Create a Spore Drifter - floating AoE hazard
     */
    createSporeDrifter(x, y, index) {
        // Create texture
        const textureKey = 'sporeDrifter';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = 35;

            // Mushroom cap
            graphics.fillStyle(0x9932CC, 0.9);
            graphics.fillCircle(size/2, size/2 - 5, 14);

            // Cap pattern
            graphics.fillStyle(0xDA70D6, 0.6);
            graphics.fillCircle(size/2 - 5, size/2 - 8, 4);
            graphics.fillCircle(size/2 + 4, size/2 - 6, 3);
            graphics.fillCircle(size/2, size/2 - 2, 3);

            // Stem
            graphics.fillStyle(0xDDA0DD, 0.8);
            graphics.fillRect(size/2 - 4, size/2 + 2, 8, 10);

            // Glow
            graphics.fillStyle(0xFF00FF, 0.2);
            graphics.fillCircle(size/2, size/2, 18);

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        // Create sprite
        const sprite = this.physics.add.sprite(x, y, textureKey);
        sprite.setDepth(105);
        sprite.body.setAllowGravity(false);
        sprite.body.setSize(25, 25);

        // Drifter properties
        sprite.health = 1;
        sprite.damage = 1;
        sprite.enemyType = 'sporeDrifter';
        sprite.sporeRadius = 60;
        sprite.lastSporeTime = 0;
        sprite.sporeCooldown = 3000;
        this.enemies.add(sprite);
        this.configureEnemyCombat(sprite, {
            role: 'hazard',
            maxHealth: 1,
            cueOffsetY: -36,
            onDefeat: enemy => this.killEnemy(enemy)
        });

        // Float animation
        this.tweens.add({
            targets: sprite,
            y: y + 15,
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Horizontal drift
        this.tweens.add({
            targets: sprite,
            x: x + (Math.random() - 0.5) * 80,
            duration: 3000 + Math.random() * 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Spore cloud emission
        this.time.addEvent({
            delay: 2000 + Math.random() * 2000,
            callback: () => this.emitSporeCloud(sprite),
            loop: true
        });

        // Player proximity damage
        if (this.player) {
            this.physics.add.overlap(this.player, sprite, () => {
                this.handleEnemyCollision(sprite);
            });
        }

        this.sporeDrifters.push(sprite);
    }

    /**
     * Emit a damaging spore cloud from a drifter
     * Now includes warning glow and knockback
     */
    emitSporeCloud(sprite) {
        if (!sprite.active || !this.scene.isActive() || !this.player) return;

        const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);
        if (distance > 200) return; // Only emit when player is near

        // Warning glow - pulsing red/purple to telegraph the attack
        const warning = this.add.graphics();
        warning.lineStyle(4, 0xFF00FF, 0.8);
        warning.strokeCircle(0, 0, sprite.sporeRadius * 0.8);
        warning.setPosition(sprite.x, sprite.y);
        warning.setDepth(103);

        // Pulse the warning
        this.tweens.add({
            targets: warning,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.3,
            duration: 300,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                warning.destroy();
                // Now emit the actual cloud after warning
                this.emitActualSporeCloud(sprite);
            }
        });
    }

    /**
     * Actually emit the spore cloud after warning telegraph
     */
    emitActualSporeCloud(sprite) {
        if (!sprite.active || !this.scene.isActive() || !this.player) return;

        // Visual spore cloud
        const cloud = this.add.graphics();
        cloud.fillStyle(0x9932CC, 0.4);
        cloud.fillCircle(0, 0, sprite.sporeRadius);
        cloud.setPosition(sprite.x, sprite.y);
        cloud.setDepth(104);

        // Expand and fade
        this.tweens.add({
            targets: cloud,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 1500,
            onComplete: () => cloud.destroy()
        });

        // Damage and knockback check
        const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);
        if (distance < sprite.sporeRadius) {
            this.handlePlayerDamage(1);

            // Apply knockback - push player away from spore drifter
            const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, this.player.x, this.player.y);
            const knockbackForce = 300;
            this.player.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce - 150  // Slight upward boost to help escape
            );
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Create a Forest Wisp - teleporting shooter
     */
    createForestWisp(x, y, index) {
        // Create texture
        const textureKey = 'forestWisp';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = 30;

            // Outer glow
            graphics.fillStyle(0x00FF7F, 0.3);
            graphics.fillCircle(size/2, size/2, 14);

            // Core
            graphics.fillStyle(0x7FFFD4, 0.9);
            graphics.fillCircle(size/2, size/2, 8);

            // Inner bright spot
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 4);

            // Wisp trails
            graphics.fillStyle(0x00FF7F, 0.5);
            graphics.beginPath();
            graphics.moveTo(size/2, size/2 + 8);
            graphics.lineTo(size/2 - 4, size/2 + 15);
            graphics.lineTo(size/2, size/2 + 12);
            graphics.lineTo(size/2 + 4, size/2 + 15);
            graphics.closePath();
            graphics.fillPath();

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        // Create sprite
        const sprite = this.physics.add.sprite(x, y, textureKey);
        sprite.setDepth(115);
        sprite.body.setAllowGravity(false);
        sprite.body.setSize(20, 20);

        // Wisp properties
        sprite.health = 2;
        sprite.damage = 1;
        sprite.enemyType = 'forestWisp';
        sprite.shootRange = 300;
        sprite.teleportRange = 150;
        sprite.homeX = x;
        sprite.homeY = y;
        sprite.lastTeleportTime = 0;
        sprite.teleportCooldown = 6000;  // Increased from 4000 - teleport less often
        sprite.isStunned = false;  // Can't teleport while stunned
        this.enemies.add(sprite);
        this.configureEnemyCombat(sprite, {
            role: 'ranged',
            maxHealth: 2,
            cueOffsetY: -34,
            onDefeat: enemy => this.killEnemy(enemy)
        });

        // Pulse animation
        this.tweens.add({
            targets: sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.7,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Player collision
        if (this.player) {
            this.physics.add.overlap(this.player, sprite, () => {
                this.handleEnemyCollision(sprite);
            });
        }

        // AI behavior - teleport and shoot
        this.time.addEvent({
            delay: 1500,
            callback: () => this.updateForestWispAI(sprite),
            loop: true
        });

        this.forestWisps.push(sprite);
    }

    /**
     * Forest Wisp AI - teleport around and shoot at player
     * IMPROVED: Less frustrating - teleports less often, can be caught after shooting
     */
    updateForestWispAI(sprite) {
        if (!sprite.active || !this.player || !this.scene.isActive()) return;

        // Can't act while stunned (after shooting)
        if (sprite.isStunned) return;

        const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);

        // Teleport only if player gets VERY close (reduced from 100 to 50)
        if (distance < 50 && this.time.now - sprite.lastTeleportTime > sprite.teleportCooldown) {
            this.teleportWisp(sprite);
        }
        // Shoot if in range - then become stunned briefly
        else if (distance < sprite.shootRange && distance > 60) {
            this.wispShoot(sprite);

            // Stun after shooting - player can catch up
            sprite.isStunned = true;
            sprite.setTint(0x666666);  // Dim to show vulnerability

            this.time.delayedCall(2000, () => {
                if (sprite.active) {
                    sprite.isStunned = false;
                    sprite.clearTint();  // Restore normal appearance
                }
            });
        }
    }

    /**
     * Teleport a wisp to a new location
     */
    teleportWisp(sprite) {
        if (!sprite.active) return;

        sprite.lastTeleportTime = this.time.now;

        // Fade out
        this.tweens.add({
            targets: sprite,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 200,
            onComplete: () => {
                if (!sprite.active) return;

                // New position near home
                const newX = sprite.homeX + (Math.random() - 0.5) * sprite.teleportRange * 2;
                const newY = sprite.homeY + (Math.random() - 0.5) * sprite.teleportRange;
                sprite.setPosition(newX, newY);

                // Fade in
                this.tweens.add({
                    targets: sprite,
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200
                });
            }
        });

        // Teleport particles
        const particles = this.add.graphics();
        particles.fillStyle(0x00FF7F, 0.6);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            particles.fillCircle(sprite.x + Math.cos(angle) * 15, sprite.y + Math.sin(angle) * 15, 4);
        }
        particles.setDepth(114);
        this.tweens.add({
            targets: particles,
            alpha: 0,
            duration: 300,
            onComplete: () => particles.destroy()
        });
    }

    /**
     * Wisp shoots a projectile at the player
     */
    wispShoot(sprite) {
        if (!sprite.active || !this.player) return;

        // Calculate direction to player
        const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, this.player.x, this.player.y);

        // Create projectile
        const projectile = this.add.graphics();
        projectile.fillStyle(0x00FF7F, 1);
        projectile.fillCircle(0, 0, 6);
        projectile.fillStyle(0xFFFFFF, 0.8);
        projectile.fillCircle(-2, -2, 2);
        projectile.setPosition(sprite.x, sprite.y);
        projectile.setDepth(120);

        // Move projectile
        const speed = 200;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;

        // Update projectile position
        const projectileTimer = this.time.addEvent({
            delay: 16,
            callback: () => {
                if (!projectile.active || !this.scene.isActive()) {
                    projectileTimer.remove();
                    return;
                }

                projectile.x += velocityX * 0.016;
                projectile.y += velocityY * 0.016;

                // Check player collision
                if (this.player) {
                    const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y);
                    if (dist < 25) {
                        this.handlePlayerDamage(1);
                        projectile.destroy();
                        projectileTimer.remove();
                        return;
                    }
                }

                // Destroy if off-screen or traveled too far
                const distTraveled = Phaser.Math.Distance.Between(sprite.x, sprite.y, projectile.x, projectile.y);
                if (distTraveled > 400) {
                    projectile.destroy();
                    projectileTimer.remove();
                }
            },
            loop: true
        });
    }

    /**
     * Handle collision between player and enemy
     * Now includes knockback to prevent trapping
     */
    handleEnemyCollision(enemy) {
        return this.resolveEnemyContact(this.player, enemy, {
            contactDamage: enemy.damage || 1,
            knockbackX: 250,
            knockbackY: -200
        });
    }

    /**
     * Damage an enemy (called from player attacks)
     */
    damageEnemy(enemy, damage = 1) {
        return super.damageEnemy(enemy, damage);
    }

    /**
     * Kill an enemy with effects
     */
    killEnemy(enemy) {
        if (!enemy.active) return;

        enemy.combatCue?.destroy?.();
        enemy.combatCue = null;

        // Death particles
        const deathFX = this.add.graphics();
        deathFX.fillStyle(0x9370DB, 0.6);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = this.add.graphics();
            particle.fillStyle(0x9370DB, 0.8);
            particle.fillCircle(0, 0, 5);
            particle.setPosition(enemy.x, enemy.y);
            particle.setDepth(150);

            this.tweens.add({
                targets: particle,
                x: enemy.x + Math.cos(angle) * 40,
                y: enemy.y + Math.sin(angle) * 40,
                alpha: 0,
                duration: 500,
                onComplete: () => particle.destroy()
            });
        }

        // Coin drop
        if (Math.random() < 0.5) {
            this.dropCoin(enemy.x, enemy.y);
        }

        enemy.destroy();
        window.AchievementSystem?.recordEvent?.('enemy_defeated', {
            levelId: this.levelId
        });

        // Remove from arrays
        this.voidSprites = this.voidSprites.filter(e => e !== enemy);
        this.branchCrawlers = this.branchCrawlers.filter(e => e !== enemy);
        this.sporeDrifters = this.sporeDrifters.filter(e => e !== enemy);
        this.forestWisps = this.forestWisps.filter(e => e !== enemy);

        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }
    }

    /**
     * Drop a coin at position
     */
    dropCoin(x, y) {
        const coin = this.add.graphics();
        coin.fillStyle(0xFFD700, 1);
        coin.fillCircle(0, 0, 8);
        coin.fillStyle(0xFFA500, 1);
        coin.fillCircle(-2, -2, 3);
        coin.setPosition(x, y);
        coin.setDepth(130);

        // Pop up animation
        this.tweens.add({
            targets: coin,
            y: y - 30,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: coin,
                    y: y,
                    duration: 200,
                    ease: 'Quad.easeIn'
                });
            }
        });

        // Create pickup zone
        const pickupZone = this.add.zone(x, y, 30, 30);
        this.physics.add.existing(pickupZone, true);

        if (this.player) {
            this.physics.add.overlap(this.player, pickupZone, () => {
                if (window.EconomyManager?.addCoins) {
                    window.EconomyManager.addCoins(10, 'forest_platform_coin');
                }
                coin.destroy();
                pickupZone.destroy();

                if (window.AudioManager) {
                    window.AudioManager.playCoinCollect();
                }

                // Floating +10 text
                const coinText = this.add.text(x, y - 20, '+10', {
                    fontSize: '16px',
                    color: '#FFD700',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(200);

                this.tweens.add({
                    targets: coinText,
                    y: y - 60,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => coinText.destroy()
                });
            });
        }

        this.coinSprites.push({ coin, pickupZone });
    }

    /**
     * Place collectibles throughout the level
     * - 5 Star Fragments at challenging locations (required for completion)
     * - Coins throughout for rewards
     */
    placeCollectibles() {
        console.log('[MythicalForestLevel] Placing collectibles...');

        // === STAR FRAGMENTS: 5 hidden at challenging locations ===
        const starFragmentLocations = [
            // Fragment 1: Top of Tree 1 (tutorial, easy to reach)
            { x: 300, y: this.levelHeight - 100 - 400 - 30, hint: 'Tree 1 crown' },
            // Fragment 2: Hidden behind Tree 2's highest branch
            { x: 1300, y: this.levelHeight - 100 - 500 + 50, hint: 'Tree 2 high branch' },
            // Fragment 3: On the vine bridge between Trees 2-3
            { x: 1650, y: this.levelHeight - 450 - 20, hint: 'Vine bridge' },
            // Fragment 4: Very top of Tree 4 (the tallest tree)
            { x: 3200, y: this.levelHeight - 100 - 800 - 30, hint: 'Tree 4 peak' },
            // Fragment 5: Secret location on collapsing bridge (must be quick!)
            { x: 3650, y: this.levelHeight - 600 - 30, hint: 'Collapsing bridge' }
        ];

        starFragmentLocations.forEach((location, index) => {
            this.createStarFragment(location.x, location.y, index);
        });

        // === COINS: Scattered throughout the level ===
        // Ground level coins
        const groundCoinPositions = [
            100, 200, 350, 450, 650, 800, 950, 1100, 1300, 1450,
            1600, 1750, 2000, 2200, 2350, 2600, 2800, 3050, 3250,
            3450, 3650, 3850, 4100, 4350, 4600, 4850
        ];

        groundCoinPositions.forEach(x => {
            this.createCoin(x, this.levelHeight - 130, 'ground');
        });

        // Branch coins (on tree platforms)
        this.branchPlatforms.forEach((branch, index) => {
            // Not every branch - about 60% chance
            if (Math.random() < 0.6) {
                const zone = branch.zone;
                this.createCoin(zone.x, zone.y - 30, 'branch');
            }
        });

        // Bonus coin lines in the air (jumping rewards)
        const bonusCoinArcs = [
            { startX: 550, endX: 600, y: this.levelHeight - 200, count: 3 },  // Over first void pit
            { startX: 1450, endX: 1550, y: this.levelHeight - 250, count: 4 }, // Jump arc
            { startX: 2450, endX: 2550, y: this.levelHeight - 250, count: 4 }, // Another arc
            { startX: 3650, endX: 3700, y: this.levelHeight - 200, count: 3 }  // Near boss
        ];

        bonusCoinArcs.forEach(arc => {
            const spacing = (arc.endX - arc.startX) / (arc.count - 1);
            for (let i = 0; i < arc.count; i++) {
                const x = arc.startX + i * spacing;
                // Arc shape
                const progress = i / (arc.count - 1);
                const arcHeight = Math.sin(progress * Math.PI) * 40;
                this.createCoin(x, arc.y - arcHeight, 'bonus');
            }
        });

        console.log(`[MythicalForestLevel] Placed ${this.starFragmentSprites.length} Star Fragments and ${this.coinSprites.length} coins`);
    }

    /**
     * Create a Star Fragment collectible
     */
    createStarFragment(x, y, index) {
        // Create texture if not exists
        const textureKey = 'starFragment';
        if (!this.textures.exists(textureKey)) {
            const graphics = this.make.graphics({ add: false });
            const size = 32;

            // Outer glow
            graphics.fillStyle(0xFFD700, 0.3);
            graphics.fillCircle(size/2, size/2, 15);

            // Star shape
            graphics.fillStyle(0xFFD700, 1);
            const cx = size / 2;
            const cy = size / 2;
            const outerRadius = 12;
            const innerRadius = 5;
            const points = 5;

            graphics.beginPath();
            for (let i = 0; i < points * 2; i++) {
                const angle = (i * Math.PI / points) - Math.PI / 2;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const px = cx + Math.cos(angle) * radius;
                const py = cy + Math.sin(angle) * radius;
                if (i === 0) {
                    graphics.moveTo(px, py);
                } else {
                    graphics.lineTo(px, py);
                }
            }
            graphics.closePath();
            graphics.fillPath();

            // Bright center
            graphics.fillStyle(0xFFFFFF, 0.9);
            graphics.fillCircle(cx, cy, 4);

            // Sparkle effects
            graphics.fillStyle(0xFFFFFF, 0.8);
            graphics.fillRect(cx - 1, cy - 8, 2, 5);
            graphics.fillRect(cx - 1, cy + 3, 2, 5);
            graphics.fillRect(cx - 8, cy - 1, 5, 2);
            graphics.fillRect(cx + 3, cy - 1, 5, 2);

            graphics.generateTexture(textureKey, size, size);
            graphics.destroy();
        }

        // Create sprite
        const sprite = this.add.sprite(x, y, textureKey);
        sprite.setDepth(140);

        // Floating animation
        this.tweens.add({
            targets: sprite,
            y: y - 8,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Rotation
        this.tweens.add({
            targets: sprite,
            angle: 360,
            duration: 3000,
            repeat: -1
        });

        // Sparkle particles around it
        this.time.addEvent({
            delay: 500,
            callback: () => {
                if (!sprite.active || !this.scene.isActive()) return;
                const particle = this.add.graphics();
                const angle = Math.random() * Math.PI * 2;
                const dist = 15 + Math.random() * 10;
                particle.fillStyle(0xFFD700, 0.8);
                particle.fillCircle(0, 0, 2);
                particle.setPosition(sprite.x + Math.cos(angle) * dist, sprite.y + Math.sin(angle) * dist);
                particle.setDepth(139);

                this.tweens.add({
                    targets: particle,
                    alpha: 0,
                    scale: 0.3,
                    duration: 500,
                    onComplete: () => particle.destroy()
                });
            },
            loop: true
        });

        // Create pickup zone
        const pickupZone = this.add.zone(x, y, 40, 40);
        this.physics.add.existing(pickupZone, true);

        if (this.player) {
            this.physics.add.overlap(this.player, pickupZone, () => {
                this.collectStarFragment(sprite, pickupZone, index);
            });
        }

        this.starFragmentSprites.push({ sprite, pickupZone, collected: false });
    }

    /**
     * Collect a star fragment
     * Properly disables and destroys pickup zone
     */
    collectStarFragment(sprite, zone, index) {
        const fragmentData = this.starFragmentSprites[index];
        if (!fragmentData || fragmentData.collected) return;

        fragmentData.collected = true;
        this.starFragmentsCollected++;

        // IMMEDIATELY disable the pickup zone to prevent duplicate collection
        if (zone.body) {
            zone.body.enable = false;
        }

        // Collection effect
        this.tweens.add({
            targets: sprite,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => sprite.destroy()
        });

        // Particle burst
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const particle = this.add.graphics();
            particle.fillStyle(0xFFD700, 1);
            particle.fillCircle(0, 0, 4);
            particle.setPosition(sprite.x, sprite.y);
            particle.setDepth(150);

            this.tweens.add({
                targets: particle,
                x: sprite.x + Math.cos(angle) * 60,
                y: sprite.y + Math.sin(angle) * 60,
                alpha: 0,
                duration: 600,
                onComplete: () => particle.destroy()
            });
        }

        // Destroy the zone after disabling
        zone.destroy();

        // Update HUD
        if (this.hud?.updateStarFragments) {
            this.hud.updateStarFragments(this.starFragmentsCollected, this.totalStarFragments);
        }

        // Floating text
        const collectText = this.add.text(sprite.x, sprite.y - 30,
            `⭐ ${this.starFragmentsCollected}/${this.totalStarFragments}`,
            {
                fontSize: '20px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: collectText,
            y: sprite.y - 80,
            alpha: 0,
            duration: 1000,
            onComplete: () => collectText.destroy()
        });

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        // Screen flash
        window.FeedbackManager?.cameraFlash?.(this, 200, 255, 215, 0);

        // Check if all collected
        if (this.starFragmentsCollected >= this.totalStarFragments) {
            this.onAllStarFragmentsCollected();
        }
    }

    /**
     * Called when all star fragments are collected
     */
    onAllStarFragmentsCollected() {
        const { width, height } = this.cameras.main;

        const bonusText = this.add.text(width / 2, height / 3, '✨ ALL STAR FRAGMENTS COLLECTED! ✨', {
            fontSize: '24px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: bonusText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.tweens.add({
                    targets: bonusText,
                    alpha: 0,
                    y: height / 3 - 50,
                    duration: 1000,
                    onComplete: () => bonusText.destroy()
                });
            }
        });

        // Bonus coins
        if (window.EconomyManager?.addCoins) {
            window.EconomyManager.addCoins(200, 'forest_fragment_bonus');
        }

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Create a coin collectible
     */
    createCoin(x, y, type = 'ground') {
        const coin = this.add.graphics();
        coin.fillStyle(0xFFD700, 1);
        coin.fillCircle(0, 0, 8);
        coin.fillStyle(0xFFA500, 1);
        coin.fillCircle(-2, -2, 3);
        coin.setPosition(x, y);
        coin.setDepth(125);

        // Gentle bob animation
        this.tweens.add({
            targets: coin,
            y: y - 5,
            duration: 800 + Math.random() * 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create pickup zone
        const pickupZone = this.add.zone(x, y, 25, 25);
        this.physics.add.existing(pickupZone, true);

        if (this.player) {
            this.physics.add.overlap(this.player, pickupZone, () => {
                if (!coin.active) return;

                const coinValue = type === 'bonus' ? 15 : 10;
                if (window.EconomyManager?.addCoins) {
                    window.EconomyManager.addCoins(coinValue, `forest_${type}_coin`);
                }

                // Collection animation
                this.tweens.add({
                    targets: coin,
                    y: coin.y - 30,
                    scaleX: 0,
                    scaleY: 0,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => coin.destroy()
                });

                pickupZone.destroy();

                if (window.AudioManager) {
                    window.AudioManager.playCoinCollect();
                }

                // Small floating text
                const coinText = this.add.text(x, y - 15, `+${coinValue}`, {
                    fontSize: '14px',
                    color: '#FFD700',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(200);

                this.tweens.add({
                    targets: coinText,
                    y: y - 45,
                    alpha: 0,
                    duration: 600,
                    onComplete: () => coinText.destroy()
                });
            });
        }

        this.coinSprites.push({ coin, pickupZone, type });
    }

    /**
     * Create bridges/platforms connecting trees
     */
    createTreeBridges() {
        const bridges = [
            // From Tree 1 to Tree 2
            { x1: 450, x2: 1050, y: this.levelHeight - 350, type: 'static' },
            // From Tree 2 to Tree 3
            { x1: 1400, x2: 1900, y: this.levelHeight - 450, type: 'vine' },
            // From Tree 3 to Tree 4
            { x1: 2400, x2: 3000, y: this.levelHeight - 500, type: 'static' },
            // Readable stepped spine between the two tall-tree routes.
            { x1: 3000, x2: 3260, y: this.levelHeight - 525, type: 'static' },
            { x1: 3260, x2: 3500, y: this.levelHeight - 565, type: 'static' },
            // From Tree 4 to Tree 5
            { x1: 3500, x2: 3800, y: this.levelHeight - 600, type: 'collapsing' },
            // Recovery spine after the collapsing challenge. Players who read
            // the warning still have a clear forward route to Tree 5.
            { x1: 3800, x2: 4050, y: this.levelHeight - 565, type: 'static' },
            { x1: 4050, x2: 4300, y: this.levelHeight - 525, type: 'static' },
            // From Tree 5 to Tree 6
            { x1: 4300, x2: 4900, y: this.levelHeight - 500, type: 'static' }
        ];

        bridges.forEach((bridge, index) => {
            this.createBridge(bridge, index);
        });
    }

    /**
     * Create a single bridge between trees
     */
    createBridge(config, index) {
        const { x1, x2, y, type } = config;
        const width = x2 - x1;

        // Visual bridge
        const bridgeGraphics = this.add.graphics();
        bridgeGraphics.setDepth(15);

        if (type === 'static') {
            // Solid crystal bridge
            bridgeGraphics.fillStyle(0x2A2A5E, 0.8);
            bridgeGraphics.fillRect(x1, y, width, 15);
            bridgeGraphics.lineStyle(2, 0x00FF7F, 0.5);
            bridgeGraphics.strokeRect(x1, y, width, 15);

            // Physics
            const bridgeZone = this.add.zone(x1 + width/2, y + 7, width, 15);
            this.physics.add.existing(bridgeZone, true);
            this.platforms.add(bridgeZone);

        } else if (type === 'vine') {
            // Swinging vine bridge (visual only for now - physics complex)
            bridgeGraphics.lineStyle(4, 0x228B22, 0.8);
            bridgeGraphics.beginPath();
            bridgeGraphics.moveTo(x1, y - 50);

            // Catenary curve
            for (let x = x1; x <= x2; x += 10) {
                const t = (x - x1) / width;
                const sag = Math.sin(t * Math.PI) * 30;
                bridgeGraphics.lineTo(x, y + sag);
            }
            bridgeGraphics.stroke();

            // Stepping stones along vine
            const steps = 5;
            for (let i = 0; i <= steps; i++) {
                const stepX = x1 + (width / steps) * i;
                const t = i / steps;
                const stepY = y + Math.sin(t * Math.PI) * 30;

                bridgeGraphics.fillStyle(0x3D5A3D, 1);
                bridgeGraphics.fillCircle(stepX, stepY, 15);

                // Physics for each step
                const stepZone = this.add.zone(stepX, stepY, 30, 20);
                this.physics.add.existing(stepZone, true);
                this.platforms.add(stepZone);
            }

        } else if (type === 'collapsing') {
            // Collapsing bridge - sections that fall when stepped on
            const sections = 4;
            const sectionWidth = width / sections;

            for (let i = 0; i < sections; i++) {
                const sectionX = x1 + sectionWidth * i;

                const sectionGraphics = this.add.graphics();
                sectionGraphics.setDepth(15);
                sectionGraphics.fillStyle(0x4A2A2A, 0.9);
                sectionGraphics.fillRect(0, 0, sectionWidth - 5, 15);
                sectionGraphics.lineStyle(2, 0xFF6B6B, 0.5);
                sectionGraphics.strokeRect(0, 0, sectionWidth - 5, 15);
                sectionGraphics.setPosition(sectionX, y);

                // Physics zone
                const sectionZone = this.add.zone(sectionX + sectionWidth/2, y + 7, sectionWidth - 5, 15);
                this.physics.add.existing(sectionZone, true);
                this.platforms.add(sectionZone);

                // Store for collapse mechanic
                this.collapsingBranches.push({
                    graphics: sectionGraphics,
                    zone: sectionZone,
                    collapsed: false,
                    collapseDelay: 500 // ms before falling
                });

                // Add overlap trigger for collapsing
                if (this.player) {
                    this.physics.add.overlap(this.player, sectionZone, () => {
                        this.triggerCollapsingPlatform(this.collapsingBranches.length - 1);
                    });
                }
            }
        }
    }

    /**
     * Trigger a collapsing platform
     */
    triggerCollapsingPlatform(index) {
        const platform = this.collapsingBranches[index];
        if (!platform || platform.collapsed) return;

        platform.collapsed = true;

        // Warning shake
        this.tweens.add({
            targets: platform.graphics,
            x: platform.graphics.x + 2,
            duration: 50,
            yoyo: true,
            repeat: 5
        });

        // Collapse after delay
        this.time.delayedCall(platform.collapseDelay, () => {
            // Fall animation
            this.tweens.add({
                targets: platform.graphics,
                y: this.levelHeight + 100,
                alpha: 0,
                duration: 800,
                ease: 'Quad.easeIn'
            });

            // Disable physics
            if (platform.zone && platform.zone.body) {
                platform.zone.body.enable = false;
            }
        });
    }

    /**
     * Create the boss arena at the end of the level (around Tree 6)
     * EXTENDED: Boss is now further into the level for longer journey
     */
    createBossArena() {
        // Boss arena positioned around Tree 6 (x: 5500 in new layout)
        const arenaX = 5200;
        const arenaWidth = 1500;  // Larger arena for epic boss fight
        const groundY = this.levelHeight - 100;

        // Arena floor with cosmic glow
        const arena = this.add.graphics();
        arena.setDepth(8);

        // Base floor
        arena.fillStyle(0x1A251A, 1);
        arena.fillRect(arenaX, groundY, arenaWidth, 100);

        // Glowing ritual circle in center
        const centerX = 5800; // Updated for new Tree 6 location
        arena.lineStyle(3, 0x9370DB, 0.6);
        arena.strokeCircle(centerX, groundY - 5, 120);
        arena.strokeCircle(centerX, groundY - 5, 80);

        // Rune marks
        arena.fillStyle(0x9370DB, 0.4);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const runeX = centerX + Math.cos(angle) * 100;
            const runeY = groundY - 5 + Math.sin(angle) * 30;
            arena.fillCircle(runeX, runeY, 10);
        }

        // Mystical roots pattern
        arena.fillStyle(0x8B4513, 0.5);
        for (let i = 0; i < 30; i++) {
            const rootX = arenaX + Math.random() * arenaWidth;
            arena.fillRect(rootX, groundY - 5, 3, 15);
        }

        // Glowing veins leading to center
        arena.lineStyle(2, 0x00FF7F, 0.4);
        for (let i = 0; i < 6; i++) {
            const startX = arenaX + (i + 0.5) * (arenaWidth / 6);
            arena.beginPath();
            arena.moveTo(startX, groundY);
            arena.lineTo(centerX + (Math.random() - 0.5) * 40, groundY - 5);
            arena.stroke();
        }

        // Introduce the guardian in front of the player on the approach. The
        // previous trigger was to the right of the spawn and made mobile users
        // backtrack into an encounter they could not see.
        const triggerZone = this.add.zone(
            5350,
            this.levelHeight / 2,
            120,
            this.levelHeight
        );
        this.physics.add.existing(triggerZone, true);
        this.bossTriggerZone = triggerZone;

        // Trigger boss fight when player enters
        if (this.player) {
            this.physics.add.overlap(this.player, triggerZone, () => {
                if (!this.bossFightActive && !this.bossDefeated) {
                    if (!this.forestRouteAligned) {
                        const now = this.time.now;
                        if (now >= this.bossGateHintUntil) {
                            this.showFloatingText(
                                'The guardian cannot hear us yet. Align the Beacon anchors.',
                                this.player.x,
                                this.player.y - 70,
                                '#F2C94C'
                            );
                            window.FeedbackManager?.cameraFlash?.(this, 180, 242, 193, 78);
                            this.bossGateHintUntil = now + 1800;
                        }
                        return;
                    }
                    this.startBossFight();
                }
            });
        }

        // Add atmospheric particles in arena
        this.time.addEvent({
            delay: 200,
            callback: () => {
                if (!this.scene.isActive()) return;
                const particle = this.add.graphics();
                particle.fillStyle(0x9370DB, 0.4);
                particle.fillCircle(0, 0, 2 + Math.random() * 2);
                particle.setPosition(
                    arenaX + Math.random() * arenaWidth,
                    groundY - 10 - Math.random() * 50
                );
                particle.setDepth(9);

                this.tweens.add({
                    targets: particle,
                    y: particle.y - 60,
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => particle.destroy()
                });
            },
            loop: true
        });
    }

    /**
     * Start the Elder Treant boss fight
     */
    startBossFight() {
        console.log('[MythicalForestLevel] Starting Elder Treant boss fight!');
        this.bossFightActive = true;
        this.bossTriggerZone?.destroy?.();
        this.bossTriggerZone = null;

        // Dramatic pause
        this.physics.pause();

        // Flash warning
        window.FeedbackManager?.cameraFlash?.(this, 500, 34, 139, 34); // Forest green flash

        // Warning text
        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, '⚠ THE GUARDIAN IS IN PAIN ⚠', {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        // Screen shake
        window.FeedbackManager?.cameraShake?.(this, 1500, 0.015);

        // Play boss intro sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        // Fade out warning
        this.tweens.add({
            targets: warningText,
            alpha: 0,
            duration: 1500,
            onComplete: () => warningText.destroy()
        });

        // Darken the arena
        this.time.delayedCall(1000, () => {
            const darkness = this.add.graphics();
            darkness.fillStyle(0x000000, 0.3);
            darkness.fillRect(0, 0, width, height);
            darkness.setScrollFactor(0);
            darkness.setDepth(100);

            this.tweens.add({
                targets: darkness,
                alpha: 0,
                duration: 5000,
                onComplete: () => darkness.destroy()
            });
        });

        // Spawn boss after atmosphere builds
        this.time.delayedCall(1500, () => {
            this.spawnElderTreant();
            this.physics.resume();
        });
    }

    /**
     * Keep a procedural fallback so a failed asset request cannot block combat.
     *
     * The image shows:
     * - Angry tree face with menacing expression
     * - Glowing red eyes
     * - Purple and green glowing antlers/horns at top
     * - Orange/lava-like veins running through bark
     * - Sharp teeth in screaming mouth
     * - Dark green bark texture
     * - Purple foliage at base
     */
    createElderTreantTexture() {
        const textureKey = ELDER_TREANT_TEXTURE;
        if (this.textures.exists(textureKey)) return textureKey;

        const graphics = this.make.graphics({ add: false });
        const size = 200; // Larger boss
        const centerX = size / 2;
        const centerY = size / 2;

        // === LAYER 1: OUTER GLOW (Menacing aura) ===
        graphics.fillStyle(0x228B22, 0.2); // Forest green glow
        graphics.fillCircle(centerX, centerY + 20, size / 2 + 10);

        // Purple mystical glow
        graphics.fillStyle(0x9370DB, 0.15);
        graphics.fillCircle(centerX, centerY - 20, size / 2);

        // === LAYER 2: MAIN TRUNK/BODY ===
        // Dark bark base color
        graphics.fillStyle(0x2D4A2D, 1); // Dark forest green

        // Main trunk shape - organic tree form
        graphics.beginPath();
        graphics.moveTo(centerX - 50, size - 20); // Bottom left
        graphics.lineTo(centerX - 60, centerY + 40); // Left side
        graphics.lineTo(centerX - 55, centerY); // Left shoulder
        graphics.lineTo(centerX - 40, centerY - 30); // Upper left
        graphics.lineTo(centerX - 20, centerY - 50); // Head left
        graphics.lineTo(centerX + 20, centerY - 50); // Head right
        graphics.lineTo(centerX + 40, centerY - 30); // Upper right
        graphics.lineTo(centerX + 55, centerY); // Right shoulder
        graphics.lineTo(centerX + 60, centerY + 40); // Right side
        graphics.lineTo(centerX + 50, size - 20); // Bottom right
        graphics.closePath();
        graphics.fillPath();

        // === LAYER 3: BARK TEXTURE ===
        // Vertical bark lines
        graphics.lineStyle(2, 0x1A301A, 0.8);
        for (let i = -40; i < 40; i += 8) {
            const startY = centerY - 45 + Math.abs(i) * 0.3;
            const endY = size - 25;
            const waveOffset = Math.sin(i * 0.1) * 3;
            graphics.lineBetween(
                centerX + i + waveOffset,
                startY,
                centerX + i + waveOffset * 0.5,
                endY
            );
        }

        // Horizontal bark cracks
        graphics.lineStyle(1, 0x1A301A, 0.6);
        for (let y = centerY - 30; y < size - 40; y += 15) {
            const leftX = centerX - 45 + (y - centerY) * 0.2;
            const rightX = centerX + 45 - (y - centerY) * 0.2;
            graphics.lineBetween(leftX, y, rightX, y + Math.random() * 5 - 2);
        }

        // === LAYER 4: ORANGE LAVA VEINS ===
        graphics.lineStyle(3, 0xFF4500, 0.9);

        // Main center vein
        graphics.beginPath();
        graphics.moveTo(centerX, size - 30);
        graphics.lineTo(centerX - 5, centerY + 50);
        graphics.lineTo(centerX + 3, centerY + 20);
        graphics.lineTo(centerX - 2, centerY - 10);
        graphics.lineTo(centerX, centerY - 35);
        graphics.stroke();

        // Left branching veins
        graphics.beginPath();
        graphics.moveTo(centerX - 5, centerY + 30);
        graphics.lineTo(centerX - 25, centerY + 10);
        graphics.lineTo(centerX - 45, centerY + 20);
        graphics.stroke();

        graphics.beginPath();
        graphics.moveTo(centerX - 2, centerY - 5);
        graphics.lineTo(centerX - 30, centerY - 25);
        graphics.stroke();

        // Right branching veins
        graphics.beginPath();
        graphics.moveTo(centerX + 3, centerY + 25);
        graphics.lineTo(centerX + 20, centerY + 5);
        graphics.lineTo(centerX + 40, centerY + 15);
        graphics.stroke();

        graphics.beginPath();
        graphics.moveTo(centerX + 1, centerY - 8);
        graphics.lineTo(centerX + 28, centerY - 20);
        graphics.stroke();

        // Glowing effect on veins
        graphics.lineStyle(6, 0xFF6600, 0.3);
        graphics.beginPath();
        graphics.moveTo(centerX, size - 30);
        graphics.lineTo(centerX, centerY - 35);
        graphics.stroke();

        // === LAYER 5: FACE - ANGRY EXPRESSION ===
        // Brow ridge / forehead wrinkles
        graphics.fillStyle(0x1A301A, 1);

        // Angry brow - left
        graphics.beginPath();
        graphics.moveTo(centerX - 35, centerY - 25);
        graphics.lineTo(centerX - 15, centerY - 35);
        graphics.lineTo(centerX - 10, centerY - 30);
        graphics.lineTo(centerX - 30, centerY - 20);
        graphics.closePath();
        graphics.fillPath();

        // Angry brow - right
        graphics.beginPath();
        graphics.moveTo(centerX + 35, centerY - 25);
        graphics.lineTo(centerX + 15, centerY - 35);
        graphics.lineTo(centerX + 10, centerY - 30);
        graphics.lineTo(centerX + 30, centerY - 20);
        graphics.closePath();
        graphics.fillPath();

        // === LAYER 6: GLOWING RED EYES ===
        // Eye glow (outer)
        graphics.fillStyle(0xFF0000, 0.4);
        graphics.fillCircle(centerX - 22, centerY - 15, 18);
        graphics.fillCircle(centerX + 22, centerY - 15, 18);

        // Eye sockets (dark)
        graphics.fillStyle(0x1A0000, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 12);
        graphics.fillCircle(centerX + 22, centerY - 15, 12);

        // Glowing red iris
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 8);
        graphics.fillCircle(centerX + 22, centerY - 15, 8);

        // Bright center
        graphics.fillStyle(0xFF6666, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 4);
        graphics.fillCircle(centerX + 22, centerY - 15, 4);

        // Hot white core
        graphics.fillStyle(0xFFAAAA, 1);
        graphics.fillCircle(centerX - 22, centerY - 15, 2);
        graphics.fillCircle(centerX + 22, centerY - 15, 2);

        // === LAYER 7: SCREAMING MOUTH WITH TEETH ===
        // Mouth cavity (dark)
        graphics.fillStyle(0x1A0000, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 30, centerY + 15);
        graphics.lineTo(centerX - 25, centerY + 45);
        graphics.lineTo(centerX + 25, centerY + 45);
        graphics.lineTo(centerX + 30, centerY + 15);
        graphics.closePath();
        graphics.fillPath();

        // Inner mouth (deep red)
        graphics.fillStyle(0x4A0000, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 25, centerY + 20);
        graphics.lineTo(centerX - 20, centerY + 40);
        graphics.lineTo(centerX + 20, centerY + 40);
        graphics.lineTo(centerX + 25, centerY + 20);
        graphics.closePath();
        graphics.fillPath();

        // Sharp teeth - top row
        graphics.fillStyle(0xFFFACD, 1);
        const teethTopY = centerY + 18;
        const teethWidth = 8;
        for (let i = 0; i < 5; i++) {
            const toothX = centerX - 20 + i * 10;
            graphics.fillTriangle(
                toothX - teethWidth/2, teethTopY,
                toothX + teethWidth/2, teethTopY,
                toothX, teethTopY + 12 + Math.random() * 5
            );
        }

        // Sharp teeth - bottom row
        const teethBottomY = centerY + 42;
        for (let i = 0; i < 4; i++) {
            const toothX = centerX - 15 + i * 10;
            graphics.fillTriangle(
                toothX - teethWidth/2, teethBottomY,
                toothX + teethWidth/2, teethBottomY,
                toothX, teethBottomY - 10 - Math.random() * 5
            );
        }

        // === LAYER 8: ANTLERS/HORNS ===
        // Purple glowing horn (left)
        graphics.fillStyle(0x9932CC, 1);
        this.drawAntler(graphics, centerX - 30, centerY - 55, -1, 0x9932CC);

        // Green glowing horn (right)
        graphics.fillStyle(0x32CD32, 1);
        this.drawAntler(graphics, centerX + 30, centerY - 55, 1, 0x32CD32);

        // Horn glow effects
        graphics.fillStyle(0xDA70D6, 0.4);
        graphics.fillCircle(centerX - 35, centerY - 75, 15);
        graphics.fillStyle(0x90EE90, 0.4);
        graphics.fillCircle(centerX + 35, centerY - 75, 15);

        // === LAYER 9: PURPLE FOLIAGE AT BASE ===
        graphics.fillStyle(0x8B008B, 0.7);
        for (let i = 0; i < 8; i++) {
            const leafX = centerX - 40 + i * 12 + Math.random() * 5;
            const leafY = size - 15;
            this.drawLeaf(graphics, leafX, leafY, 0x8B008B);
        }

        // Some green leaves mixed in
        graphics.fillStyle(0x228B22, 0.6);
        for (let i = 0; i < 4; i++) {
            const leafX = centerX - 30 + i * 18 + Math.random() * 8;
            const leafY = size - 18;
            this.drawLeaf(graphics, leafX, leafY, 0x228B22);
        }

        // Generate texture
        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();

        return textureKey;
    }

    /**
     * Draw an antler/horn shape
     */
    drawAntler(graphics, x, y, direction, color) {
        graphics.fillStyle(color, 1);

        // Main horn trunk
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(x + direction * 5, y - 25);
        graphics.lineTo(x + direction * 15, y - 50);
        graphics.lineTo(x + direction * 10, y - 52);
        graphics.lineTo(x + direction * 2, y - 28);
        graphics.lineTo(x - direction * 3, y);
        graphics.closePath();
        graphics.fillPath();

        // Branch 1
        graphics.beginPath();
        graphics.moveTo(x + direction * 8, y - 30);
        graphics.lineTo(x + direction * 25, y - 40);
        graphics.lineTo(x + direction * 22, y - 45);
        graphics.lineTo(x + direction * 6, y - 35);
        graphics.closePath();
        graphics.fillPath();

        // Branch 2
        graphics.beginPath();
        graphics.moveTo(x + direction * 12, y - 45);
        graphics.lineTo(x + direction * 5, y - 65);
        graphics.lineTo(x + direction * 10, y - 65);
        graphics.lineTo(x + direction * 15, y - 47);
        graphics.closePath();
        graphics.fillPath();

        // Glow segments (lighter color)
        const glowColor = color === 0x9932CC ? 0xDA70D6 : 0x90EE90;
        graphics.fillStyle(glowColor, 0.6);

        // Glow on tips
        graphics.fillCircle(x + direction * 15, y - 50, 4);
        graphics.fillCircle(x + direction * 25, y - 42, 3);
        graphics.fillCircle(x + direction * 7, y - 65, 3);
    }

    /**
     * Draw a leaf shape
     */
    drawLeaf(graphics, x, y, color) {
        graphics.fillStyle(color, 0.8);
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(x - 5, y - 8);
        graphics.lineTo(x, y - 15);
        graphics.lineTo(x + 5, y - 8);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Spawn the Elder Treant boss
     */
    spawnElderTreant() {
        console.log('[MythicalForestLevel] Spawning Elder Treant!');

        // Create boss texture
        const textureKey = this.createElderTreantTexture();

        // Spawn position - center of screen for test mode, or boss arena (Tree 6 area)
        const { width, height } = this.cameras.main;
        const spawnX = this.testMode ? width / 2 + 200 : 5900;
        const spawnY = this.levelHeight - 220;

        // Create boss sprite
        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.bossTargetScale = ELDER_TREANT_DISPLAY_HEIGHT /
            Math.max(1, this.boss.height);
        this.boss.body.setSize(
            this.boss.width * 0.48,
            this.boss.height * 0.68
        );
        this.boss.body.setOffset(
            this.boss.width * 0.26,
            this.boss.height * 0.2
        );
        this.boss.setScale(this.bossTargetScale);

        // Initialize boss state
        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.boss.isAttacking = false;
        this.boss.facingRight = false;

        // Boss collision with platforms
        if (this.platforms) {
            this.physics.add.collider(this.boss, this.platforms);
        }

        // Boss collision with player
        if (this.player) {
            this.physics.add.overlap(this.player, this.boss, this.handleBossCollision, null, this);
        }

        // Create boss health bar
        this.createBossHealthBar();

        // Add entrance animation
        this.boss.setAlpha(0);
        this.boss.setScale(this.bossTargetScale * 0.35);

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: this.bossTargetScale,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Start boss AI
                if (!this.bossAttackPreview) {
                    this.startBossAI();
                }

                // Camera shake for dramatic effect
                window.FeedbackManager?.cameraShake?.(this, 300, 0.01);

                if (window.AudioManager) {
                    window.AudioManager.playError();
                }
            }
        });

        // Add ambient glow effect
        this.createBossAmbientEffects();
    }

    /**
     * Create ambient visual effects around the boss
     */
    createBossAmbientEffects() {
        if (!this.boss) return;

        // Pulsing glow
        const glow = this.add.graphics();
        glow.setDepth(this.boss.depth - 1);

        const updateGlow = () => {
            if (!this.boss || !glow.active) return;

            glow.clear();
            glow.setPosition(this.boss.x, this.boss.y);

            // Orange vein glow
            glow.fillStyle(0xFF4500, 0.2 + Math.sin(this.time.now * 0.003) * 0.1);
            glow.fillCircle(0, 0, 120);

            // Purple mystical aura
            glow.fillStyle(0x9932CC, 0.1);
            glow.fillCircle(-40, -80, 40);

            // Green aura
            glow.fillStyle(0x32CD32, 0.1);
            glow.fillCircle(40, -80, 40);
        };

        this.time.addEvent({
            delay: 50,
            callback: updateGlow,
            loop: true
        });

        this.bossGlow = glow;
    }

    /**
     * Create boss health bar UI
     */
    createBossHealthBar() {
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(350, screenWidth - 60);
        const barHeight = 28;
        const barX = (screenWidth - barWidth) / 2;
        const isMobileLayout = screenWidth <= 480;
        const barY = isMobileLayout ? 118 : 55;
        this.bossBarLayout = { barX, barY, barWidth, barHeight };

        // UI container
        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        // Boss name
        this.bossNameText = this.add.text(screenWidth / 2, barY - 28, 'ELDER TREANT // TRAPPED', {
            fontSize: isMobileLayout ? '18px' : '22px',
            color: '#90EE90',
            fontStyle: 'bold',
            stroke: '#1A251A',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        // Subtitle
        this.bossInstructionText = this.add.text(
            screenWidth / 2,
            barY - 8,
            'STRIKE PURPLE CORRUPTION // FREE THE GUARDIAN',
            {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#B8F3C8',
            fontStyle: 'bold',
            stroke: '#142016',
            strokeThickness: 2,
            align: 'center'
            }
        ).setOrigin(0.5);
        this.bossUI.add(this.bossInstructionText);

        // Health bar background
        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x1A251A, 0.9);
        bgBar.fillRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        bgBar.lineStyle(2, 0x228B22, 1);
        bgBar.strokeRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        this.bossUI.add(bgBar);

        // Health bar
        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        this.bossCorruptionText = this.add.text(
            screenWidth / 2,
            barY + (barHeight / 2),
            '',
            {
                fontSize: isMobileLayout ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold',
                stroke: '#2A0B38',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.bossUI.add(this.bossCorruptionText);

        // Initial draw
        this.updateBossHealthBar(barX, barY, barWidth, barHeight);
    }

    /**
     * Update boss health bar
     */
    updateBossHealthBar(barX, barY, barWidth, barHeight) {
        if (!this.bossHealthBar) return;

        const layout = this.bossBarLayout || {
            barX: (this.cameras.main.width - Math.min(350, this.cameras.main.width - 60)) / 2,
            barY: this.cameras.main.width <= 480 ? 118 : 55,
            barWidth: Math.min(350, this.cameras.main.width - 60),
            barHeight: 28
        };
        barX = barX ?? layout.barX;
        barY = barY ?? layout.barY;
        barWidth = barWidth ?? layout.barWidth;
        barHeight = barHeight ?? layout.barHeight;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const currentWidth = barWidth * healthPercent;
        const corruptionRemaining = Math.max(0, Math.ceil(this.bossHealth));

        // The bar represents corruption remaining, not the guardian's life.
        this.bossHealthBar.fillStyle(0x8B2FC9, 1);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight, 6);

        // Shiny overlay
        this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight / 2, { tl: 6, tr: 6, bl: 0, br: 0 });
        this.bossCorruptionText?.setText(
            corruptionRemaining > 0
                ? `VOID CORRUPTION // ${corruptionRemaining}/${this.bossMaxHealth}`
                : 'VOID CORRUPTION // CLEARED'
        );
    }

    /**
     * Start boss AI behavior
     */
    startBossAI() {
        console.log('[MythicalForestLevel] Starting Elder Treant AI');

        // Boss AI timer
        this.bossAITimer = this.time.addEvent({
            delay: 2000,
            callback: () => this.bossAITick(),
            loop: true
        });
    }

    /**
     * Boss AI tick - choose and execute attacks
     */
    bossAITick() {
        if (!this.boss || this.bossDefeated || !this.bossFightActive) return;

        // Face the player
        if (this.player && this.boss) {
            this.boss.facingRight = this.player.x > this.boss.x;
            this.boss.setFlipX(!this.boss.facingRight);
        }

        // Choose attack based on phase
        const attacks = ['root_slam', 'vine_whip', 'spore_cloud'];
        if (this.bossPhase >= 2) {
            attacks.push('nature_fury');
        }

        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        this.executeBossAttack(attack);
    }

    /**
     * Execute a boss attack
     */
    executeBossAttack(attackType) {
        if (!this.boss || this.boss.isAttacking) return;

        this.boss.isAttacking = true;
        const attackWindow = FOREST_GUARDIAN_ATTACK_WINDOWS[attackType] || 1800;
        this.showBossAttackInstruction(
            FOREST_GUARDIAN_ATTACK_CUES[attackType],
            attackWindow
        );

        switch (attackType) {
            case 'root_slam':
                this.bossRootSlam();
                break;
            case 'vine_whip':
                this.bossVineWhip();
                break;
            case 'spore_cloud':
                this.bossSporeCloud();
                break;
            case 'nature_fury':
                this.bossNatureFury();
                break;
        }

        // Keep the guardian locked until every active hazard has resolved.
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = this.time.delayedCall(attackWindow, () => {
            if (this.boss) {
                this.boss.isAttacking = false;
            }
            this.bossAttackUnlockTimer = null;
        });
    }

    showBossAttackInstruction(cue, duration = 1800) {
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
        this.bossInstructionTimer = this.time.delayedCall(
            Math.max(600, duration - 250),
            () => {
                this.bossInstructionText
                    ?.setText('STRIKE PURPLE CORRUPTION // FREE THE GUARDIAN')
                    ?.setColor('#B8F3C8');
                this.bossInstructionTimer = null;
            }
        );
    }

    /**
     * Root Slam attack - ground shockwave with attack telegraph!
     */
    async bossRootSlam() {
        if (!this.boss) return;

        // COMBAT JUICE: Attack telegraph before dangerous attack
        if (this.combatJuice) {
            await this.combatJuice.attackTelegraph(this.boss, 'slam', 600);
        } else {
            // Fallback telegraph
            const telegraph = this.add.graphics();
            telegraph.fillStyle(0xFF4500, 0.3);
            telegraph.fillRect(this.boss.x - 150, this.levelHeight - 120, 300, 30);
            telegraph.setDepth(100);
            this.time.delayedCall(400, () => telegraph.destroy());
        }

        // Screen shake on impact
        if (this.combatJuice) {
            this.combatJuice.screenShake(7, 200);
            this.combatJuice.hapticFeedback('heavy');
        } else {
            window.FeedbackManager?.cameraShake?.(this, 200, 0.01);
        }

        // Create root spikes
        for (let i = -3; i <= 3; i++) {
            const rootX = this.boss.x + i * 50;
            const rootY = this.levelHeight - 120;

            const root = this.add.graphics();
            root.fillStyle(0x8B4513, 1);
            root.fillTriangle(rootX - 10, rootY, rootX + 10, rootY, rootX, rootY - 40);
            root.setDepth(850);

            // Damage check
            if (this.player &&
                Math.abs(this.player.x - rootX) < 30 &&
                this.player.y > rootY - 60) {
                this.handlePlayerDamage(1);
            }

            // Remove root after delay
            this.time.delayedCall(1000, () => root.destroy());
        }
    }

    /**
     * Vine Whip attack - with charge telegraph!
     */
    async bossVineWhip() {
        if (!this.boss || !this.player) return;

        const direction = this.boss.facingRight ? 1 : -1;

        // COMBAT JUICE: Attack telegraph for charge attack
        if (this.combatJuice) {
            await this.combatJuice.attackTelegraph(this.boss, 'charge', 500);
        }

        // Create vine projectile
        const vine = this.add.graphics();
        vine.fillStyle(0x228B22, 1);
        vine.fillRect(0, -5, 80, 10);
        vine.setPosition(this.boss.x + direction * 50, this.boss.y);
        vine.setDepth(850);

        // Animate vine extending with combat juice
        if (this.combatJuice) {
            this.combatJuice.directionalShake(direction, 0, 3);
        }

        this.tweens.add({
            targets: vine,
            x: vine.x + direction * 300,
            duration: 300,
            onComplete: () => {
                // Check collision
                if (this.player &&
                    Math.abs(this.player.x - vine.x) < 100 &&
                    Math.abs(this.player.y - vine.y) < 30) {
                    this.handlePlayerDamage(1);
                }

                // Retract
                this.tweens.add({
                    targets: vine,
                    x: this.boss.x + direction * 50,
                    duration: 200,
                    onComplete: () => vine.destroy()
                });
            }
        });
    }

    /**
     * Spore Cloud attack - area denial with projectile telegraph!
     */
    async bossSporeCloud() {
        if (!this.boss || !this.player) return;

        // COMBAT JUICE: Projectile telegraph
        if (this.combatJuice) {
            await this.combatJuice.attackTelegraph(this.boss, 'projectile', 400);
        }

        // Target player position
        const targetX = this.player.x;
        const targetY = this.player.y;

        // COMBAT JUICE: Spawn warning at target location
        if (this.combatJuice) {
            await this.combatJuice.spawnWarning(targetX, targetY, 600);
        }

        // Create spore cloud
        const cloud = this.add.graphics();
        cloud.fillStyle(0x9932CC, 0.5);
        cloud.fillCircle(0, 0, 60);
        cloud.setPosition(targetX, targetY);
        cloud.setDepth(100);
        cloud.setAlpha(0);

        // Fade in
        this.tweens.add({
            targets: cloud,
            alpha: 1,
            duration: 500
        });

        // Damage over time zone
        let ticks = 0;
        const damageInterval = this.time.addEvent({
            delay: 500,
            callback: () => {
                if (this.player &&
                    Math.abs(this.player.x - cloud.x) < 60 &&
                    Math.abs(this.player.y - cloud.y) < 60) {
                    this.handlePlayerDamage(1);
                }
                ticks++;
                if (ticks >= 4) {
                    damageInterval.remove();
                    this.tweens.add({
                        targets: cloud,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => cloud.destroy()
                    });
                }
            },
            loop: true
        });
    }

    /**
     * Nature Fury attack - Phase 2 ultimate with AoE telegraph!
     */
    async bossNatureFury() {
        if (!this.boss) return;

        // COMBAT JUICE: AoE attack telegraph - big warning!
        if (this.combatJuice) {
            await this.combatJuice.attackTelegraph(this.boss, 'aoe', 1000);
            this.combatJuice.screenShake(6, 300);
            this.combatJuice.hapticFeedback('critical');
        }

        // Screen flash
        window.FeedbackManager?.cameraFlash?.(this, 500, 34, 139, 34);

        // Warning text
        const { width, height } = this.cameras.main;
        const warning = this.add.text(width / 2, height / 3, '🌿 NATURE\'S FURY! 🌿', {
            fontSize: '28px',
            color: '#90EE90',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: warning,
            alpha: 0,
            duration: 1500,
            onComplete: () => warning.destroy()
        });

        // Rain of leaves/projectiles
        for (let i = 0; i < 10; i++) {
            this.time.delayedCall(i * 200, () => {
                const leafX = Math.random() * width;

                const leaf = this.add.graphics();
                leaf.fillStyle(Math.random() > 0.5 ? 0x228B22 : 0x8B008B, 1);
                leaf.fillTriangle(-10, 0, 10, 0, 0, 20);
                leaf.setPosition(leafX, -20);
                leaf.setDepth(850);

                this.tweens.add({
                    targets: leaf,
                    y: this.levelHeight,
                    x: leafX + (Math.random() - 0.5) * 100,
                    rotation: Math.PI * 2,
                    duration: 1500,
                    onComplete: () => {
                        // Damage check at landing
                        if (this.player && Math.abs(this.player.x - leaf.x) < 30) {
                            this.handlePlayerDamage(1);
                        }
                        leaf.destroy();
                    }
                });
            });
        }
    }

    /**
     * Handle collision between player and boss
     */
    handleBossCollision(player, boss) {
        if (this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(1);
    }

    /**
     * Handle player taking damage - delegates to base class for proper UI update
     */
    handlePlayerDamage(damage) {
        // Use the parent class's takeDamage which properly handles:
        // - Health reduction
        // - Invincibility frames
        // - Visual feedback (flashing, knockback)
        // - Health display update
        // - Death handling
        this.takeDamage(damage);
    }

    // Player death is now handled by the parent class (PlatformerLevelScene.onPlayerDeath)

    /**
     * Handle boss taking damage - with exciting combat juice!
     */
    damageBoss(amount = 1) {
        if (!this.boss || this.bossDefeated) return;

        this.bossHealth -= amount;
        this.updateBossHealthBar();

        // COMBAT JUICE: Exciting boss hit feedback!
        if (this.combatJuice) {
            // Register hit for combo system
            this.combatJuice.registerHit(amount);

            this.showFloatingText(
                `CORRUPTION -${amount}`,
                this.boss.x,
                this.boss.y - 80,
                '#D9B8FF'
            );

            // Screen shake - bigger for bosses
            this.combatJuice.screenShake(5, 150);

            // Hit flash on boss
            this.combatJuice.hitFlash(this.boss, 0xFFFFFF, 100);

            // Brief hit stop for satisfying impact
            this.combatJuice.hitStop(40);
        } else {
            // Fallback: flash the corruption color, not a damage-state red.
            this.boss.setTint(0x8B2FC9);
            this.time.delayedCall(100, () => {
                if (this.boss) this.boss.clearTint();
            });
        }

        // Phase transition at 50% health
        if (this.bossHealth <= this.bossMaxHealth * 0.5 && this.bossPhase === 1) {
            this.triggerPhase2();
        }

        // The final impact clears the guardian's corruption.
        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    /**
     * Trigger phase 2 - DRAMATIC phase transition with combat juice!
     */
    triggerPhase2() {
        this.bossPhase = 2;

        // COMBAT JUICE: Dramatic phase transition!
        if (this.combatJuice && this.boss) {
            this.combatJuice.phaseTransition(this.boss, 2, '🌿 CORRUPTION SURGES! 🌿');
        } else {
            // Fallback: original transition
            window.FeedbackManager?.cameraShake?.(this, 500, 0.02);
            this.boss.setTint(0xFF6B6B);

            const { width, height } = this.cameras.main;
            const phaseText = this.add.text(width / 2, height / 2, '🌿 CORRUPTION SURGES! 🌿', {
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
        }

        // Speed up AI - boss gets angrier!
        if (this.bossAITimer) {
            this.bossAITimer.delay = 1500;
        }

        if (window.AudioManager) {
            window.AudioManager.playError(); // Angry sound
        }
    }

    /**
     * Handle guardian restoration.
     */
    onBossDefeated() {
        console.log('[MythicalForestLevel] Elder Treant restored!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        // Stop AI
        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;
        this.bossCorruptionText?.setText('VOID CORRUPTION // CLEARED');

        // The guardian recovers and withdraws after the corruption is cleared.
        this.boss.setVelocity(0, 0);
        this.boss.body.setAllowGravity(false);
        this.boss.clearTint?.();
        this.boss.setTint(0x8FE3CF);

        window.FeedbackManager?.cameraFlash?.(this, 600, 143, 227, 207);
        window.FXLibrary?.stardustBurst?.(this, this.boss.x, this.boss.y, {
            count: 35,
            color: [0x8FE3CF, 0x90EE90, 0xFFFFFF],
            duration: 1800
        });
        this.showFloatingText(
            'VOID CORRUPTION CLEARED',
            this.boss.x,
            this.boss.y - 110,
            '#8FE3CF'
        );

        // A calm departure replaces a death animation.
        this.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: this.bossTargetScale * 1.08,
            scaleY: this.bossTargetScale * 1.08,
            y: this.boss.y - 25,
            duration: 2000,
            onComplete: () => {
                this.boss.destroy();
                this.boss = null;

                if (this.bossGlow) {
                    this.bossGlow.destroy();
                }

                this.showBossVictory();
            }
        });

        // Hide health bar
        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 500
            });
        }
    }

    /**
     * Show boss victory screen with ship part reward
     */
    showBossVictory() {
        this.bindLevelCompletionReturn();

        const layout = this.getLevelModalLayout({ maxWidth: 420, maxHeight: 370 });
        const {
            width, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font, buttonPadding
        } = layout;

        const completionResult = this.completeLevelProgression({
            achievementLevelId: 'mythicalForest',
            shipPartId: 'forest_core',
            speedrunThreshold: 240000,
            rewardBonusCount: this.starFragmentsCollected
        });

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('guardian_restored', { bossId: 'elder_treant' });
        }

        const coinsEarned = completionResult?.coinsAwarded || 0;
        const ecology = completionResult?.currentEcology;

        // Victory text
        const victoryText = this.add.text(width / 2, y(45), '🌳 ELDER TREANT RESTORED 🌳', {
            fontSize: font(32, 24),
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2500).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 500
        });

        // Create victory panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A301A, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x228B22);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0).setDepth(2499);

        // Rewards header
        this.add.text(width / 2, y(100), 'LIVING CURRENT RECOVERING', {
            fontSize: font(22, 18),
            color: '#90EE90',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        this.add.text(
            width / 2,
            y(140),
            ecology
                ? `${ecology.regionLabel}: ${ecology.beforeVitality}% -> ${ecology.afterVitality}%`
                : 'The forest roots carry life again.',
            {
                fontSize: font(15, 13),
                color: '#D8FFF0',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        // Coins earned
        this.add.text(width / 2, y(182), `💰 ${coinsEarned} Coins`, {
            fontSize: font(18, 16),
            color: '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        // Ship part notification
        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        this.add.text(width / 2, y(222), `🌳 Guardian's Gift: Forest Core`, {
            fontSize: font(18, 15),
            color: '#90EE90',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const totalRequired = window.GameState?.get('hubWorld.shipParts.totalRequired') || 5;
        this.add.text(
            width / 2,
            y(260),
            (ecology
                ? `Current regions: ${ecology.restoredCount}/${ecology.totalRegions}  |  Ship parts: ${shipParts.length}/${totalRequired}`
                : `Ship Parts: ${shipParts.length}/${totalRequired}`) +
                `\n${this.getVillageCompletionCopy({ compact: true })}` +
                `\n${this.getGuardianSanctuaryArrivalCopy({ compact: true })}`,
            {
            fontSize: font(13, 11),
            color: '#7FFFD4',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        // Continue button
        const continueBtn = this.add.text(width / 2, y(320), '[ RETURN TO HUB ]', {
            fontSize: font(18, 16),
            color: '#FFFFFF',
            backgroundColor: '#228B22',
            padding: buttonPadding
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive();

        continueBtn.on('pointerover', () => continueBtn.setColor('#90EE90'));
        continueBtn.on('pointerout', () => continueBtn.setColor('#FFFFFF'));
        continueBtn.on('pointerdown', () => {
            window.GameState?.save();
            this.returnToHub();
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Override shutdown for cleanup
     */
    shutdown() {
        console.log('[MythicalForestLevel] Shutting down');
        this.forestArrivalRequest += 1;
        this.forestArrivalElements.forEach(element => element?.destroy?.());
        this.forestArrivalElements = [];
        this.clearLevelEntryKeyHandler();
        this.levelEntryElements = [];
        this.clearFirstExpeditionDrill();
        this.objectiveDisplay?.destroy?.();
        this.objectiveDisplay = null;
        this.bossTriggerZone?.destroy?.();
        this.bossTriggerZone = null;
        this.checkpointAnchors.forEach(checkpoint => {
            checkpoint.zone?.destroy?.();
            checkpoint.visual?.destroy?.();
            checkpoint.label?.destroy?.();
        });
        this.checkpointAnchors = [];

        // Clean up boss
        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }

        if (this.bossUI) {
            this.bossUI.destroy();
            this.bossUI = null;
        }
        this.bossInstructionText = null;
        this.bossCorruptionText = null;
        this.bossBarLayout = null;

        if (this.bossGlow) {
            this.bossGlow.destroy();
            this.bossGlow = null;
        }

        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;

        // Clean up enemies
        this.voidSprites.forEach(e => e.destroy());
        this.voidSprites = [];

        this.branchCrawlers.forEach(e => e.destroy());
        this.branchCrawlers = [];

        this.sporeDrifters.forEach(e => e.destroy());
        this.sporeDrifters = [];

        this.forestWisps.forEach(e => e.destroy());
        this.forestWisps = [];

        // Clean up collectibles
        this.starFragmentSprites.forEach(sf => {
            if (sf.sprite?.active) sf.sprite.destroy();
            if (sf.pickupZone?.active) sf.pickupZone.destroy();
        });
        this.starFragmentSprites = [];

        this.coinSprites.forEach(c => {
            if (c.coin?.active) c.coin.destroy();
            if (c.pickupZone?.active) c.pickupZone.destroy();
        });
        this.coinSprites = [];

        // Clean up platforms
        this.branchPlatforms = [];
        this.collapsingBranches = [];
        this.cosmicTrees = [];

        // Clean up particles
        this.magicMotes.forEach(mote => {
            if (mote?.active) mote.destroy();
        });
        this.magicMotes = [];

        super.shutdown();
    }
}

// Export for module system
export default MythicalForestLevel;

// Also export to window for global access
if (typeof window !== 'undefined') {
    window.MythicalForestLevel = MythicalForestLevel;
}
