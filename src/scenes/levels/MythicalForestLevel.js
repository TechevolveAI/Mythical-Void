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

const FOREST_GROUND_SECTIONS = Object.freeze([
    Object.freeze({ id: 'forest-ground-1', x: 0, width: 400 }),
    Object.freeze({ id: 'forest-ground-2', x: 900, width: 200, enemyX: 1000 }),
    Object.freeze({ id: 'forest-ground-3', x: 1700, width: 300, enemyX: 1850 }),
    Object.freeze({ id: 'forest-ground-4', x: 2600, width: 200, enemyX: 2700 }),
    Object.freeze({ id: 'forest-ground-5', x: 3500, width: 300, enemyX: 3650 }),
    Object.freeze({ id: 'forest-ground-6', x: 5200, width: 2800, enemyX: 5350 })
]);

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

const FOREST_GUARDIAN_ATTACK_PACING = Object.freeze({
    root_slam: { windup: 650, recovery: 850, color: 0xFF8A4C },
    vine_whip: { windup: 550, recovery: 800, color: 0xFFD166 },
    spore_cloud: { windup: 700, recovery: 950, color: 0xD47CFF },
    nature_fury: { windup: 1000, recovery: 1100, color: 0x90EE90 }
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
        this.forestCollectedFragmentMask = 0;
        this.forestRouteChoice = '';
        this.forestFragmentBonusAwarded = false;
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
        this.bossAttackWindupTimer = null;
        this.bossRecoveryTimer = null;
        this.bossPhaseTransitionTimer = null;
        this.bossPhaseTransitioning = false;
        this.bossPhasePending = false;
        this.bossTelegraphs = new Set();
        this.bossAttackPreview = null;

        // Forest particles
        this.forestAmbientLayers = [];
        this.forestAmbientPointCount = 0;
        this.forestGroundLayer = null;
        this.forestVoidLayer = null;
        this.forestVoidMoteLayer = null;
        this.forestTreeStructureLayer = null;
        this.forestFoliageLayer = null;
        this.forestFoliageTween = null;
        this.forestBridgeLayer = null;
        this.forestEnemyTrailLayer = null;
        this.forestEnemyTrailTimer = null;
        this.forestArenaAmbientLayer = null;
        this.forestArenaAmbientTimer = null;
        this.forestEnemyAISchedulerActive = false;
        this.forestEnemyAICursor = 0;
        this.forestEnemyMotionNextAt = 0;
        this.forestEnemyActivationNextAt = 0;
        this.forestProximityEnemies = [];
        this.forestEnemyActivationBounds = null;
        this.forestEnemyOverlap = null;
        this.forestCoinLayer = null;
        this.forestCoinLayerTween = null;

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
        this.forestCollectedFragmentMask = 0;
        this.forestRouteChoice = '';
        this.forestFragmentBonusAwarded = false;
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
        this.bossAttackWindupTimer = null;
        this.bossRecoveryTimer = null;
        this.bossPhaseTransitionTimer = null;
        this.bossPhaseTransitioning = false;
        this.bossPhasePending = false;
        this.bossTelegraphs = new Set();
        this.bossAttackPreview = [
            'root_slam',
            'vine_whip',
            'spore_cloud',
            'nature_fury'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;

        // Reset particles
        this.forestAmbientLayers = [];
        this.forestAmbientPointCount = 0;
        this.forestGroundLayer = null;
        this.forestVoidLayer = null;
        this.forestVoidMoteLayer = null;
        this.forestTreeStructureLayer = null;
        this.forestFoliageLayer = null;
        this.forestFoliageTween = null;
        this.forestBridgeLayer = null;
        this.forestEnemyTrailLayer = null;
        this.forestEnemyTrailTimer = null;
        this.forestArenaAmbientLayer = null;
        this.forestArenaAmbientTimer = null;
        this.forestEnemyAISchedulerActive = false;
        this.forestEnemyAICursor = 0;
        this.forestEnemyMotionNextAt = 0;
        this.forestEnemyActivationNextAt = 0;
        this.forestProximityEnemies = [];
        this.forestEnemyActivationBounds = null;
        this.forestEnemyOverlap = null;
        this.forestCoinLayer = null;
        this.forestCoinLayerTween = null;

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

        divider.setVisible(!isCompact);
        this.layoutCampaignEntryContent(
            layout,
            [title, subtitle, objHeader, mainObj, obj1, obj2, enterBtn],
            { gaps: [8, 10, 8, 10, 6, 12] }
        );

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

    configureForestClimbSupport(platform) {
        if (!platform?.body) return platform;
        platform.platformType = 'one-way';
        platform.body.checkCollision.down = false;
        platform.body.checkCollision.left = false;
        platform.body.checkCollision.right = false;
        return platform;
    }

    createHUD() {
        super.createHUD();
        this.createCampaignObjectiveDisplay(
            () => this.getForestObjectiveText(),
            {
                color: '#E9FFF8',
                backgroundColor: 'rgba(7, 20, 17, 0.92)'
            }
        );
    }

    getForestObjectiveText() {
        const optionalFallback =
            `OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`;
        const optional = typeof this.getOptionalRouteStatusText === 'function'
            ? this.getOptionalRouteStatusText('forest_canopy_run', optionalFallback)
            : optionalFallback;

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
        const compass = typeof this.getOrderedRouteCompassText === 'function'
            ? this.getOrderedRouteCompassText()
            : '';
        const title = this.isCompactObjectiveHUD
            ? `ROUTE ${current}/3`
            : `ROUTE ${current}/3 // ${nextAnchor}`;

        return `${title}\n${compass || 'FOLLOW THE CURRENT →'}\n${optional}`;
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
        this.updateForestEnemyActivation();
        if (this.forestEnemyAISchedulerActive) this.updateForestEnemyAI();
        this.updateForestEnemyMotion(time);
        this.updateForestCoinPickups();
        this.updateFirstExpeditionDrill();
        this.syncCampaignObjectiveDisplay({
            visible:
                !this.firstExpeditionDrill?.panelVisible &&
                !(this.isCompactObjectiveHUD && this.bossFightActive)
        });
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

    shouldAnimateForestDecorations() {
        const width = Number(this.cameras?.main?.width) || 0;
        const height = Number(this.cameras?.main?.height) || 0;
        return !(this.isMobile || width <= 480 || height < 620);
    }

    createBeaconCheckpoints() {
        const animateRouteDecorations = this.shouldAnimateForestDecorations();
        const groundY = this.levelHeight - 100;
        const anchors = [
            {
                id: 'forest_anchor_1',
                x: 1770,
                label: 'ROOTWAY',
                activationSupportIds: ['forest-ground-3']
            },
            {
                id: 'forest_anchor_2',
                x: 3570,
                label: 'CROWN PATH',
                activationSupportIds: ['forest-ground-5']
            },
            {
                id: 'forest_anchor_3',
                x: 5300,
                label: 'GUARDIAN APPROACH',
                activationSupportIds: ['forest-ground-6']
            }
        ];

        anchors.forEach((anchor, index) => {
            const supportId = anchor.activationSupportIds[0];
            const support = this.getTraversalSupport(supportId);
            const supportCheckpoint = this.getTraversalSupportCheckpoint(
                supportId,
                anchor.x
            );
            const anchorX = supportCheckpoint.x;
            const supportY = support?.body?.top || groundY;
            const visual = this.add.graphics();
            visual.setDepth(85);
            this.drawBeaconCheckpoint(visual, anchorX, supportY, false);

            const label = this.add.text(anchorX, supportY - 118, anchor.label, {
                fontSize: '11px',
                color: '#7F9CA2',
                fontStyle: 'bold',
                stroke: '#071017',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(86);

            const zone = this.createObjectiveTriggerZone(
                anchorX,
                supportY - 62,
                { width: 150, height: 280 }
            );

            const checkpoint = {
                ...anchor,
                x: anchorX,
                index,
                y: supportY - 62,
                supportY,
                visual,
                label,
                zone,
                landingGuide: this.createTraversalLandingGuide(
                    supportId,
                    0x8FE3CF,
                    { depth: 84, animate: animateRouteDecorations }
                ),
                activated: false,
                respawnY: supportCheckpoint.y
            };

            this.physics.add.overlap(this.player, zone, () => {
                this.activateBeaconCheckpoint(checkpoint);
            });
            this.checkpointAnchors.push(checkpoint);
        });

        this.refreshForestRouteReadability();
    }

    getTraversalAuditTargets() {
        return [
            ...this.checkpointAnchors,
            {
                id: 'forest_guardian_gate',
                label: 'GUARDIAN APPROACH',
                x: this.bossTriggerZone?.x || 5350,
                y: this.bossTriggerZone?.y || this.levelHeight / 2,
                zone: this.bossTriggerZone
            }
        ];
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

        if (!this.canActivateOrderedRouteSignal(
            checkpoint,
            this.checkpointAnchors,
            this.beaconAnchorsActivated,
            { hintOffsetY: -92 }
        )) {
            return;
        }

        checkpoint.activated = true;
        checkpoint.zone?.destroy?.();
        checkpoint.zone = null;
        this.beaconAnchorsActivated++;
        this.drawBeaconCheckpoint(
            checkpoint.visual,
            checkpoint.x,
            checkpoint.supportY,
            true
        );
        this.retireTraversalLandingGuide(checkpoint);
        this.refreshForestRouteReadability();
        const supportCheckpoint = this.getTraversalSupportCheckpoint(
            checkpoint.activationSupportIds[0],
            checkpoint.x
        );
        checkpoint.respawnY = supportCheckpoint.y;
        this.setCheckpoint(supportCheckpoint.x, supportCheckpoint.y, {
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

    refreshForestRouteReadability() {
        return this.refreshOrderedRouteSignals(
            this.checkpointAnchors,
            this.beaconAnchorsActivated,
            { futureColor: '#7F9CA2' }
        );
    }

    restoreExpeditionRouteState(resume) {
        const signalsRestored = this.restoreExpeditionRouteSignals(resume, {
            signals: this.checkpointAnchors,
            countProperty: 'beaconAnchorsActivated',
            readyProperty: 'forestRouteAligned',
            drawSignal: checkpoint => {
                this.drawBeaconCheckpoint(
                    checkpoint.visual,
                    checkpoint.x,
                    checkpoint.supportY,
                    true
                );
                this.retireTraversalLandingGuide(checkpoint);
            },
            onRestored: () => {
                this.refreshForestRouteReadability();
                this.syncCampaignObjectiveDisplay();
            }
        });
        if (!signalsRestored) return false;

        this.restoreForestRouteState(resume.routeState, {
            rejoined: Number(resume.checkpointIndex) >= 2
        });
        this.syncCampaignObjectiveDisplay();
        return true;
    }

    getExpeditionRouteState() {
        const route = this.optionalRouteRewards?.get?.('forest_canopy_run');
        return {
            forestRouteChoice: this.forestRouteChoice || '',
            forestFragmentMask: this.forestCollectedFragmentMask,
            canopyProgress: Number(route?.progress) || 0,
            canopyCompleted: route?.completed === true,
            canopyGuardCharges: this.forestRouteChoice === 'optional'
                ? this.optionalRouteGuardCharges
                : 0,
            forestFragmentBonusAwarded: this.forestFragmentBonusAwarded === true
        };
    }

    selectForestRoute(path, { restoring = false, rejoined = false } = {}) {
        if (!['main', 'optional'].includes(path)) return false;
        if (this.forestRouteChoice && this.forestRouteChoice !== path) return false;

        this.forestRouteChoice = path;
        const choice = this.optionalRouteRewards?.get?.('forest_canopy_run')?.choice;
        if (choice) {
            choice.selectedPath = path;
            choice.mainEntered = path === 'main';
            choice.optionalEntered = path === 'optional';
            choice.rejoined = rejoined && path === 'optional';
            choice.sequence ||= 1;
        }
        if (!restoring) this.refreshPersistedExpeditionRouteState();
        return true;
    }

    restoreForestRouteState(routeState, { rejoined = false } = {}) {
        if (!routeState || typeof routeState !== 'object') return false;

        const path = routeState.forestRouteChoice;
        if (['main', 'optional'].includes(path)) {
            this.selectForestRoute(path, { restoring: true, rejoined });
        }

        this.forestCollectedFragmentMask = Phaser.Math.Clamp(
            Math.floor(Number(routeState.forestFragmentMask) || 0),
            0,
            (1 << this.totalStarFragments) - 1
        );
        this.starFragmentsCollected = this.countCollectedForestFragments();
        this.forestFragmentBonusAwarded =
            routeState.forestFragmentBonusAwarded === true;
        this.retireCollectedForestFragments();
        this.hud?.updateStarFragments?.(
            this.starFragmentsCollected,
            this.totalStarFragments
        );

        const route = this.optionalRouteRewards?.get?.('forest_canopy_run');
        if (route && path === 'optional') {
            route.progress = Phaser.Math.Clamp(
                Number(routeState.canopyProgress) || 0,
                0,
                route.required
            );
            route.completed = routeState.canopyCompleted === true ||
                route.progress >= route.required;
            this.refreshOptionalRouteReward(route);
            this.optionalRouteGuardLabel = 'CANOPY GUARD';
            this.optionalRouteGuardCharges = Phaser.Math.Clamp(
                Number(routeState.canopyGuardCharges) || 0,
                0,
                1
            );
        }

        if (
            this.starFragmentsCollected >= this.totalStarFragments &&
            !this.forestFragmentBonusAwarded &&
            this.awardForestFragmentBonus()
        ) {
            this.refreshPersistedExpeditionRouteState();
        }
        return true;
    }

    countCollectedForestFragments() {
        let count = 0;
        for (let index = 0; index < this.totalStarFragments; index += 1) {
            if ((this.forestCollectedFragmentMask & (1 << index)) !== 0) count++;
        }
        return count;
    }

    retireCollectedForestFragments() {
        this.starFragmentSprites.forEach((fragment, index) => {
            if ((this.forestCollectedFragmentMask & (1 << index)) === 0) return;
            fragment.collected = true;
            if (fragment.pickupZone?.body) fragment.pickupZone.body.enable = false;
            fragment.pickupZone?.destroy?.();
            fragment.pickupZone = null;
            fragment.sprite?.destroy?.();
            fragment.sprite = null;
        });
    }

    awardForestFragmentBonus() {
        if (this.forestFragmentBonusAwarded) return true;
        const balance = window.EconomyManager?.addCoins?.(
            200,
            'forest_fragment_bonus'
        );
        if (!Number.isFinite(balance)) return false;
        this.forestFragmentBonusAwarded = true;
        return true;
    }

    onOptionalRouteGuardConsumed() {
        if (this.forestRouteChoice === 'optional') {
            this.refreshPersistedExpeditionRouteState();
        }
    }

    /**
     * Create ground platforms with LARGE void gaps that FORCE tree climbing
     * Players CANNOT simply run across the ground - they MUST use the trees!
     */
    createGroundPlatforms() {
        const groundY = this.levelHeight - 100;
        const groundLayer = this.add.graphics().setDepth(10);
        this.forestGroundLayer = groundLayer;

        // Ground sections with MAJOR gaps - impossible to jump across
        // Each gap is 400-600px - players MUST climb trees to cross
        FOREST_GROUND_SECTIONS.forEach(section => {
            // Dark cosmic soil
            groundLayer.fillStyle(0x1A251A, 1);
            groundLayer.fillRect(section.x, groundY, section.width, 100);

            // Bioluminescent grass/roots
            groundLayer.fillStyle(0x00FF7F, 0.3);
            for (let x = section.x; x < section.x + section.width; x += 15) {
                const grassHeight = 8 + Math.random() * 12;
                groundLayer.fillRect(x, groundY - grassHeight, 2, grassHeight);
            }

            // Glowing root veins
            groundLayer.lineStyle(2, 0x9370DB, 0.4);
            for (let i = 0; i < 3; i++) {
                const rootX = section.x + Math.random() * section.width;
                groundLayer.lineBetween(
                    rootX,
                    groundY,
                    rootX + (Math.random() - 0.5) * 50,
                    groundY + 50
                );
            }

            // Physics platform
            const platformZone = this.add.zone(
                section.x + section.width / 2,
                groundY + 10,
                section.width,
                20
            );
            this.physics.add.existing(platformZone, true);
            platformZone.traversalId = section.id;
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

        const warningLayer = this.add.graphics().setDepth(5);
        const moteLayer = this.add.graphics().setDepth(6);
        this.forestVoidLayer = warningLayer;
        this.forestVoidMoteLayer = moteLayer;

        voidPits.forEach((pit, pitIndex) => {
            warningLayer.fillStyle(0x4B0082, 0.3);
            warningLayer.fillRect(pit.x, this.levelHeight - 100, pit.width, 100);
            for (let moteIndex = 0; moteIndex < 5; moteIndex += 1) {
                const ratio = (moteIndex + 1) / 6;
                moteLayer.fillStyle(0x9370DB, 0.3 + pitIndex * 0.04);
                moteLayer.fillCircle(
                    pit.x + pit.width * ratio,
                    this.levelHeight - 20 - (moteIndex % 3) * 26,
                    2 + (moteIndex % 2)
                );
            }
        });
        if (this.shouldAnimateForestDecorations()) {
            this.tweens.add({
                targets: moteLayer,
                y: { from: 8, to: -16 },
                alpha: { from: 0.35, to: 0.75 },
                duration: 1800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        } else {
            moteLayer.setPosition(0, -4).setAlpha(0.58);
        }
    }

    /**
     * Create the 6 Cosmic Trees - SPACE TREES, not earth trees!
     * These are crystalline spires with bioluminescent foliage
     * CRITICAL: Trees are positioned to span the void gaps - ONLY way to cross!
     */
    createCosmicTrees() {
        this.forestTreeStructureLayer = this.add.graphics().setDepth(25);
        this.forestFoliageLayer = this.add.graphics().setDepth(35);
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

        if (this.isMobile) {
            this.forestFoliageLayer.setAlpha(0.82);
        } else {
            this.forestFoliageTween = this.tweens.add({
                targets: this.forestFoliageLayer,
                x: { from: -2, to: 2 },
                y: { from: 1, to: -5 },
                alpha: { from: 0.62, to: 0.9 },
                duration: 2600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        this.forestAmbientLayers.push(this.forestFoliageLayer);

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
        const structure = this.forestTreeStructureLayer;

        // Main trunk shape (angular, crystalline)
        const trunkWidth = 60 + treeIndex * 5;
        structure.fillStyle(0x1A1A3E, 1); // Dark purple-blue

        // Draw angular trunk (not round like earth trees)
        structure.beginPath();
        structure.moveTo(x - trunkWidth/2, baseY);
        structure.lineTo(x - trunkWidth/3, baseY - height * 0.3);
        structure.lineTo(x - trunkWidth/4, baseY - height * 0.6);
        structure.lineTo(x - trunkWidth/6, baseY - height * 0.85);
        structure.lineTo(x, baseY - height);
        structure.lineTo(x + trunkWidth/6, baseY - height * 0.85);
        structure.lineTo(x + trunkWidth/4, baseY - height * 0.6);
        structure.lineTo(x + trunkWidth/3, baseY - height * 0.3);
        structure.lineTo(x + trunkWidth/2, baseY);
        structure.closePath();
        structure.fillPath();

        // Glowing energy veins
        const veinColors = [0x00FF7F, 0x9370DB, 0x00CED1, 0xFF69B4];
        const veinColor = veinColors[treeIndex % veinColors.length];
        const foliageGlow = this.forestFoliageLayer;
        structure.lineStyle(3, veinColor, 0.8);

        // Main central vein
        structure.beginPath();
        structure.moveTo(x, baseY);
        for (let y = baseY; y > baseY - height; y -= 30) {
            const wobble = Math.sin((baseY - y) * 0.02) * 5;
            structure.lineTo(x + wobble, y);
        }
        structure.stroke();

        // Side veins
        structure.lineStyle(2, veinColor, 0.5);
        for (let i = 0; i < 4; i++) {
            const veinY = baseY - height * (0.2 + i * 0.2);
            const direction = i % 2 === 0 ? -1 : 1;
            structure.beginPath();
            structure.moveTo(x, veinY);
            structure.lineTo(x + direction * (trunkWidth/2 + 20), veinY - 30);
            structure.stroke();
        }

        // === BRANCHES: Semi-transparent crystalline platforms ===
        const branchSpacing = height / (branches + 1);

        for (let i = 0; i < branches; i++) {
            const branchY = baseY - branchSpacing * (i + 1);
            const direction = i % 2 === 0 ? -1 : 1;
            // Route-critical geometry must be repeatable across runs. Cosmetic
            // particles can vary; a jump target cannot.
            const branchLength = 96 + ((treeIndex * 29 + i * 17) % 36);

            // Crystal branch (angular, geometric)
            structure.fillStyle(0x2A2A5E, 0.9);
            structure.lineStyle(2, veinColor, 0.6);

            const branchX = x + direction * (trunkWidth/4);
            const endX = branchX + direction * branchLength;

            // Draw angular branch
            structure.beginPath();
            structure.moveTo(branchX, branchY - 8);
            structure.lineTo(endX, branchY - 12);
            structure.lineTo(endX + direction * 10, branchY);
            structure.lineTo(endX, branchY + 12);
            structure.lineTo(branchX, branchY + 8);
            structure.closePath();
            structure.fillPath();
            structure.strokePath();

            // Glowing tip
            structure.fillStyle(veinColor, 0.6);
            structure.fillCircle(endX + direction * 5, branchY, 8);

            // Physics platform for the branch
            const platformWidth = branchLength + 20;
            const platformX = (branchX + endX) / 2;

            const branchPlatform = this.add.zone(platformX, branchY + 10, platformWidth, 20);
            this.physics.add.existing(branchPlatform, true);
            this.configureForestClimbSupport(branchPlatform);
            branchPlatform.traversalId = `forest-tree-${treeIndex + 1}-branch-${i + 1}`;
            this.platforms.add(branchPlatform);
            this.branchPlatforms.push({
                zone: branchPlatform,
                treeIndex,
                branchIndex: i,
                difficulty
            });

            // Add floating bioluminescent orbs around branches (not leaves!)
            this.createBioluminescentOrbs(
                foliageGlow,
                endX,
                branchY,
                veinColor,
                3 + ((treeIndex * 7 + i * 5) % 3)
            );
        }

        // Add special platform at tree top
        const topPlatform = this.add.zone(x, baseY - height + 20, 100, 20);
        this.physics.add.existing(topPlatform, true);
        this.configureForestClimbSupport(topPlatform);
        topPlatform.traversalId = `forest-tree-${treeIndex + 1}-crown`;
        this.platforms.add(topPlatform);

        // Visual crown at top (crystal formation, not leaves)
        structure.fillStyle(veinColor, 0.4);

        // Crystal crown spikes
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI - Math.PI/2;
            const spikeX = x + Math.cos(angle) * 30;
            const spikeY = baseY - height - 20 + Math.sin(angle) * 20;
            structure.fillTriangle(
                x, baseY - height,
                spikeX - 8, spikeY,
                spikeX + 8, spikeY - 15
            );
        }

        // Store tree reference
        this.cosmicTrees.push({
            x, baseY, height, branches, difficulty, treeIndex,
            veinColor
        });
    }

    /**
     * Create floating bioluminescent orbs (alien "foliage")
     */
    createBioluminescentOrbs(layer, x, y, color, count) {
        layer.fillStyle(color, this.isMobile ? 0.72 : 0.6);
        for (let i = 0; i < count; i++) {
            const orbX = x + (Math.random() - 0.5) * 60;
            const orbY = y + (Math.random() - 0.5) * 40 - 20;
            const orbSize = 4 + Math.random() * 4;

            layer.fillCircle(orbX, orbY, orbSize);
            if (!this.isMobile) {
                layer.fillStyle(0xFFFFFF, 0.8);
                layer.fillCircle(
                    orbX - orbSize / 3,
                    orbY - orbSize / 3,
                    orbSize / 3
                );
                layer.fillStyle(color, 0.6);
            }
            this.forestAmbientPointCount += 1;
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
        const voidSpritePositions = FOREST_GROUND_SECTIONS
            .filter(section => Number.isFinite(section.enemyX))
            .map(section => ({
                x: section.enemyX,
                y: this.levelHeight - 150,
                support: section
            }));

        voidSpritePositions.forEach((pos, index) => {
            this.createVoidSprite(pos.x, pos.y, index, pos.support);
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
        this.startForestEnemyAIScheduler();
        this.forestEnemyOverlap = this.physics.add.overlap(
            this.player,
            this.enemies,
            (_player, enemy) => this.handleEnemyCollision(enemy)
        );
        this.startForestEnemyTrailRenderer();

        console.log(`[MythicalForestLevel] Created ${this.voidSprites.length} Void Sprites, ${this.branchCrawlers.length} Branch Crawlers, ${this.sporeDrifters.length} Spore Drifters, ${this.forestWisps.length} Forest Wisps`);
    }

    retireForestPatrolsForElder() {
        const patrols = [...(this.enemies?.getChildren?.() || [])];
        this.forestEnemyAISchedulerActive = false;
        this.forestProximityEnemies = [];
        this.forestEnemyActivationBounds = null;
        const retirement = this.retireRouteEnemies(patrols);

        this.forestEnemyOverlap?.destroy?.();
        this.forestEnemyOverlap = null;
        this.forestEnemyTrailTimer?.remove?.();
        this.forestEnemyTrailTimer = null;
        this.forestEnemyTrailLayer?.clear?.();
        this.voidSprites = [];
        this.branchCrawlers = [];
        this.sporeDrifters = [];
        this.forestWisps = [];
        return retirement.enemyCount;
    }

    registerForestEnemyAI(sprite, interval, { jitter = 0 } = {}) {
        if (!sprite) return;
        sprite.forestAiInterval = Math.max(50, Number(interval) || 50);
        sprite.forestAiJitter = Math.max(0, Number(jitter) || 0);
        sprite.forestNextAiAt = (Number(this.time?.now) || 0) +
            sprite.forestAiInterval + Math.random() * sprite.forestAiJitter;
    }

    startForestEnemyAIScheduler() {
        this.forestEnemyAICursor = 0;
        this.forestEnemyAISchedulerActive = true;
        this.updateForestEnemyActivation(true);
    }

    getForestEnemyActivationBounds() {
        const view = this.cameras?.main?.worldView;
        const playerX = Number(this.player?.x) || 0;
        const playerY = Number(this.player?.y) || 0;
        const width = Math.max(
            320,
            Number(view?.width) || Number(this.cameras?.main?.width) || 390
        );
        const height = Math.max(
            320,
            Number(view?.height) || Number(this.cameras?.main?.height) || 720
        );
        const horizontalMargin = this.isMobile ? 520 : 800;
        const verticalMargin = this.isMobile ? 280 : 420;
        const viewLeft = Number(view?.left) || 0;
        const viewRight = Number(view?.right) || width;
        const viewTop = Number(view?.top) || 0;
        const viewBottom = Number(view?.bottom) || height;
        return {
            left: Math.min(viewLeft, playerX - width / 2) - horizontalMargin,
            right: Math.max(viewRight, playerX + width / 2) + horizontalMargin,
            top: Math.min(viewTop, playerY - height / 2) - verticalMargin,
            bottom: Math.max(viewBottom, playerY + height / 2) + verticalMargin,
            horizontalMargin,
            verticalMargin
        };
    }

    setForestEnemyRenderAttached(enemy, attached) {
        const displayList = this.children;
        if (!enemy || !displayList) return 0;

        const targets = [
            enemy,
            enemy.combatCue,
            enemy.instructionLabel
        ].filter(target => Boolean(target) && target.active !== false);
        let changedCount = 0;

        targets.forEach(target => {
            const isAttached = target.displayList === displayList;
            if (attached && !isAttached) {
                displayList.add(target);
                changedCount += 1;
            } else if (!attached && isAttached) {
                displayList.remove(target);
                changedCount += 1;
            }
        });

        return changedCount;
    }

    setForestEnemyProximityActive(enemy, enabled) {
        if (!enemy?.active || !enemy.body) return false;
        const nextState = enabled === true;
        if (enemy.forestProximityActive === nextState) return nextState;

        enemy.forestProximityActive = nextState;
        if (nextState) {
            this.setForestEnemyRenderAttached(enemy, true);
            enemy.body.enable = true;
            enemy.body.updateFromGameObject?.();
            enemy.setVisible?.(true);
            enemy.forestNextAiAt = Math.min(
                Number(enemy.forestNextAiAt) || Number.POSITIVE_INFINITY,
                (Number(this.time?.now) || 0) + 40
            );
        } else {
            enemy.setVelocity?.(0, 0);
            enemy.body.enable = false;
            enemy.setVisible?.(false);
            enemy.forestTrail = [];
            enemy.combatCue?.setVisible?.(false);
            enemy.instructionLabel?.setVisible?.(false);
            this.setForestEnemyRenderAttached(enemy, false);
        }
        return nextState;
    }

    isForestEnemyReadyForSuspension(enemy) {
        if (!enemy?.body || enemy.enemyType !== 'voidSprite') return true;
        if (enemy.forestSettledForStreaming) return true;

        const support = this.getTraversalSupport?.(enemy.forestSupportId);
        const grounded = Boolean(
            enemy.body.blocked?.down || enemy.body.touching?.down
        );
        const settled = Boolean(
            grounded &&
            support?.body &&
            enemy.body.right > support.body.left + 4 &&
            enemy.body.left < support.body.right - 4 &&
            Math.abs(enemy.body.bottom - support.body.top) <= 12
        );
        if (settled) enemy.forestSettledForStreaming = true;
        return settled;
    }

    updateForestEnemyActivation(force = false) {
        if (!this.scene.isActive()) return 0;
        const now = Number(this.time?.now) || 0;
        if (!force && now < this.forestEnemyActivationNextAt) {
            return this.forestProximityEnemies.length;
        }
        this.forestEnemyActivationNextAt = now + (this.isMobile ? 120 : 80);

        const bounds = this.getForestEnemyActivationBounds();
        const nearby = [];
        (this.enemies?.getChildren?.() || []).forEach(enemy => {
            if (!enemy?.active || !enemy.body) return;
            const inWindow =
                enemy.x >= bounds.left &&
                enemy.x <= bounds.right &&
                enemy.y >= bounds.top &&
                enemy.y <= bounds.bottom;
            const shouldStayActive = inWindow ||
                !this.isForestEnemyReadyForSuspension(enemy);
            this.setForestEnemyProximityActive(enemy, shouldStayActive);
            if (shouldStayActive) nearby.push(enemy);
        });
        this.forestProximityEnemies = nearby;
        this.forestEnemyActivationBounds = bounds;
        this.forestEnemyAICursor = nearby.length
            ? this.forestEnemyAICursor % nearby.length
            : 0;
        return nearby.length;
    }

    updateForestEnemyAI() {
        if (!this.scene.isActive()) return;

        const now = Number(this.time?.now) || 0;
        const enemies = this.forestProximityEnemies || [];
        if (!enemies.length) return;
        const actionBudget = this.isMobile ? 3 : 5;
        let scannedCount = 0;
        let actionCount = 0;
        while (scannedCount < enemies.length && actionCount < actionBudget) {
            const index = (
                this.forestEnemyAICursor + scannedCount
            ) % enemies.length;
            scannedCount += 1;
            const sprite = enemies[index];
            if (
                !sprite?.active ||
                !Number.isFinite(sprite.forestNextAiAt) ||
                now < sprite.forestNextAiAt
            ) continue;

            switch (sprite.enemyType) {
                case 'voidSprite':
                    this.updateVoidSpriteAI(sprite);
                    break;
                case 'branchCrawler':
                    this.updateBranchCrawlerAI(sprite);
                    break;
                case 'sporeDrifter':
                    this.emitSporeCloud(sprite);
                    break;
                case 'forestWisp':
                    this.updateForestWispAI(sprite);
                    break;
                default:
                    continue;
            }

            actionCount += 1;
            sprite.forestNextAiAt = now + sprite.forestAiInterval +
                Math.random() * sprite.forestAiJitter;
        }
        this.forestEnemyAICursor = (
            this.forestEnemyAICursor + scannedCount
        ) % enemies.length;
    }

    updateForestEnemyMotion(time) {
        const now = Number(time) || 0;
        if (now < this.forestEnemyMotionNextAt) return;
        this.forestEnemyMotionNextAt = now + (this.isMobile ? 32 : 16);
        this.sporeDrifters.forEach(sprite => {
            if (!sprite?.active || sprite.forestProximityActive === false) return;
            const phase = (
                (now + sprite.forestMotionOffset) % sprite.forestMotionDuration
            ) / sprite.forestMotionDuration;
            const drift = (
                Math.sin((phase * Math.PI * 2) - (Math.PI / 2)) + 1
            ) / 2;
            sprite.setPosition(
                sprite.forestMotionOriginX + sprite.forestMotionTravelX * drift,
                sprite.forestMotionOriginY + 15 * drift
            );
        });

        this.forestWisps.forEach(sprite => {
            if (
                !sprite?.active ||
                sprite.forestProximityActive === false ||
                sprite.forestTeleporting
            ) return;
            const phase = (
                (now + sprite.forestMotionOffset) % 1600
            ) / 1600;
            const pulse = (
                Math.sin((phase * Math.PI * 2) - (Math.PI / 2)) + 1
            ) / 2;
            sprite.setScale(1 + 0.2 * pulse);
            sprite.setAlpha(1 - 0.3 * pulse);
        });
    }

    startForestEnemyTrailRenderer() {
        this.forestEnemyTrailTimer?.remove?.();
        this.forestEnemyTrailLayer?.destroy?.();
        const layer = this.add.graphics().setDepth(99);
        this.forestEnemyTrailLayer = layer;

        this.forestEnemyTrailTimer = this.time.addEvent({
            delay: this.isMobile ? 180 : 100,
            callback: () => {
                if (!this.scene.isActive()) return;
                layer.clear();
                const view = this.cameras.main.worldView;
                this.voidSprites.forEach(sprite => {
                    if (!sprite?.active || sprite.forestProximityActive === false) return;
                    if (
                        sprite.x < view.left - 120 ||
                        sprite.x > view.right + 120 ||
                        sprite.y < view.top - 120 ||
                        sprite.y > view.bottom + 120
                    ) {
                        sprite.forestTrail = [];
                        return;
                    }
                    sprite.forestTrail ||= [];
                    sprite.forestTrail.push({ x: sprite.x, y: sprite.y + 10 });
                    sprite.forestTrail = sprite.forestTrail.slice(-3);
                    sprite.forestTrail.forEach((point, index) => {
                        layer.fillStyle(0x4B0082, 0.1 + index * 0.08);
                        layer.fillCircle(point.x, point.y, 7 + index * 1.5);
                    });
                });
            },
            loop: true
        });
    }

    /**
     * Create a Void Sprite enemy - shadow creature that chases player on ground
     */
    createVoidSprite(x, y, index, support) {
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
        sprite.forestSupportId = support?.id || null;
        sprite.forestPatrolLeft = Number.isFinite(support?.x)
            ? support.x + 40
            : null;
        sprite.forestPatrolRight = Number.isFinite(support?.x) &&
            Number.isFinite(support?.width)
            ? support.x + support.width - 40
            : null;
        this.enemies.add(sprite);
        this.configureEnemyCombat(sprite, {
            role: 'chaser',
            maxHealth: 2,
            cueOffsetY: -40,
            onDefeat: enemy => this.killEnemy(enemy)
        });
        if (index === 0) {
            sprite.instructionLabel = this.add.text(
                sprite.x,
                sprite.y - 78,
                'GOLD = JUMP ON TOP\nPIPS = JUMPS LEFT',
                {
                    fontSize: '11px',
                    color: '#F2C94C',
                    fontStyle: 'bold',
                    align: 'center',
                    stroke: '#061319',
                    strokeThickness: 4
                }
            ).setOrigin(0.5).setDepth(852);
            sprite.instructionLabelFollowEnemy = true;
        }

        // Add to platforms collider
        if (this.platforms) {
            this.physics.add.collider(sprite, this.platforms);
        }

        this.registerForestEnemyAI(sprite, 200);

        this.voidSprites.push(sprite);
    }

    /**
     * Void Sprite AI - chase player when in range
     */
    updateVoidSpriteAI(sprite) {
        if (!sprite.active || !this.player || !this.scene.isActive()) return;

        const hasPatrolBounds = Number.isFinite(sprite.forestPatrolLeft) &&
            Number.isFinite(sprite.forestPatrolRight);
        if (hasPatrolBounds) {
            const supportedX = Phaser.Math.Clamp(
                sprite.x,
                sprite.forestPatrolLeft,
                sprite.forestPatrolRight
            );
            if (supportedX !== sprite.x) {
                sprite.setX(supportedX);
                sprite.body?.updateFromGameObject?.();
            }
        }

        const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.player.x, this.player.y);

        if (distance < sprite.detectionRange) {
            sprite.isChasing = true;
            const direction = this.player.x > sprite.x ? 1 : -1;
            const atSupportEdge = hasPatrolBounds && (
                (direction < 0 && sprite.x <= sprite.forestPatrolLeft) ||
                (direction > 0 && sprite.x >= sprite.forestPatrolRight)
            );
            sprite.setVelocityX(atSupportEdge ? 0 : direction * sprite.speed);
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

        this.registerForestEnemyAI(sprite, 100);

        this.branchCrawlers.push(sprite);
    }

    updateBranchCrawlerAI(sprite) {
        if (!sprite?.active || !this.scene.isActive()) return;

        if (sprite.x >= sprite.patrolRight) {
            sprite.direction = -1;
            sprite.setFlipX(true);
        } else if (sprite.x <= sprite.patrolLeft) {
            sprite.direction = 1;
            sprite.setFlipX(false);
        }
        sprite.setVelocityX(sprite.direction * sprite.speed);
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

        sprite.forestMotionOriginX = x;
        sprite.forestMotionOriginY = y;
        sprite.forestMotionTravelX = (Math.random() - 0.5) * 80;
        sprite.forestMotionDuration = 2400 + Math.random() * 900;
        sprite.forestMotionOffset = Math.random() * sprite.forestMotionDuration;
        this.registerForestEnemyAI(sprite, 2000, { jitter: 2000 });

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

        sprite.forestMotionOffset = Math.random() * 1600;
        sprite.forestTeleporting = false;
        this.registerForestEnemyAI(sprite, 1500);

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

            this.trackEnemyTimer(sprite, this.time.delayedCall(2000, () => {
                if (sprite.active) {
                    sprite.isStunned = false;
                    sprite.clearTint();  // Restore normal appearance
                }
            }));
        }
    }

    /**
     * Teleport a wisp to a new location
     */
    teleportWisp(sprite) {
        if (!sprite.active) return;

        sprite.lastTeleportTime = this.time.now;
        sprite.forestTeleporting = true;

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
                    duration: 200,
                    onComplete: () => {
                        if (sprite.active) sprite.forestTeleporting = false;
                    }
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
        this.trackEnemyArtifact(sprite, projectile);

        // Move projectile
        const speed = 200;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;

        let projectileTimer = null;
        const retireProjectile = () => {
            projectileTimer?.remove?.(false);
            sprite.runtimeTimers?.delete?.(projectileTimer);
            projectile?.destroy?.();
            sprite.runtimeArtifacts?.delete?.(projectile);
        };

        // Update projectile position
        projectileTimer = this.trackEnemyTimer(sprite, this.time.addEvent({
            delay: 16,
            callback: () => {
                if (!projectile.active || !this.scene.isActive()) {
                    retireProjectile();
                    return;
                }

                projectile.x += velocityX * 0.016;
                projectile.y += velocityY * 0.016;

                // Check player collision
                if (this.player) {
                    const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y);
                    if (dist < 25) {
                        this.handlePlayerDamage(1);
                        retireProjectile();
                        return;
                    }
                }

                // Destroy if off-screen or traveled too far
                const distTraveled = Phaser.Math.Distance.Between(sprite.x, sprite.y, projectile.x, projectile.y);
                if (distTraveled > 400) {
                    retireProjectile();
                }
            },
            loop: true
        }));
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

        this.disposeEnemyRuntime(enemy);

        enemy.combatCue?.destroy?.();
        enemy.combatCue = null;
        enemy.instructionLabel?.destroy?.();
        enemy.instructionLabel = null;

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
        this.forestProximityEnemies = this.forestProximityEnemies.filter(
            candidate => candidate !== enemy
        );

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

        this.coinSprites.push({
            x,
            y,
            type: 'drop',
            collected: false,
            batched: false,
            coin
        });
    }

    /**
     * Place collectibles throughout the level
     * - 5 Star Fragments at challenging locations (required for completion)
     * - Coins throughout for rewards
     */
    placeCollectibles() {
        console.log('[MythicalForestLevel] Placing collectibles...');

        const canopyMainMarker = this.add.text(2860, this.levelHeight - 390, '', {
            fontSize: '11px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#071017',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);
        const canopyRouteMarker = this.add.text(2820, this.levelHeight - 610, '', {
            fontSize: '11px',
            color: '#F2C94C',
            fontStyle: 'bold',
            stroke: '#071017',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);
        this.registerOptionalRouteReward({
            id: 'forest_canopy_run',
            title: 'CANOPY RUN',
            required: 2,
            rewardLabel: 'CANOPY GUARD // 1 HIT',
            marker: canopyRouteMarker,
            returnLabel: 'DESCEND TO GUARDIAN APPROACH →',
            choice: {
                mainLabel: 'MID-BRANCH CROSSING →',
                mainTradeoff: 'STEADY // CRAWLER PATROLS',
                challengeLabel: 'HIGH CLIMB + 2 FRAGMENTS',
                mainMarker: canopyMainMarker,
                mainZone: {
                    left: 2760, right: 3400,
                    top: this.levelHeight - 590, bottom: this.levelHeight - 350
                },
                mainSupportIds: ['forest-bridge-4'],
                optionalZone: {
                    left: 2740, right: 3700,
                    top: 180, bottom: this.levelHeight - 600
                },
                optionalSupportIds: ['forest-tree-4-branch-6'],
                rejoinZone: {
                    left: 3780, right: 4350,
                    top: 500, bottom: this.levelHeight - 300
                },
                rejoinSupportIds: ['forest-bridge-10']
            },
            onMainSelected: () => this.selectForestRoute('main'),
            onOptionalSelected: () => this.selectForestRoute('optional'),
            onComplete: () => {
                this.grantOptionalRouteGuard('CANOPY GUARD', 1);
                this.refreshPersistedExpeditionRouteState();
            }
        });

        // === STAR FRAGMENTS: 5 hidden at challenging locations ===
        const starFragmentLocations = [
            // Fragment 1: Top of Tree 1 (tutorial, easy to reach)
            { x: 300, y: this.levelHeight - 100 - 400 - 30, hint: 'Tree 1 crown' },
            // Fragment 2: Hidden behind Tree 2's highest branch
            { x: 1300, y: this.levelHeight - 100 - 500 + 50, hint: 'Tree 2 high branch' },
            // Fragment 3: On the vine bridge between Trees 2-3
            { x: 1650, y: this.levelHeight - 450 - 20, hint: 'Vine bridge' },
            // Fragment 4: Very top of Tree 4 (the tallest tree)
            {
                x: 3200,
                y: this.levelHeight - 100 - 800 - 30,
                hint: 'Tree 4 peak',
                optionalRouteId: 'forest_canopy_run'
            },
            // Fragment 5: Secret location on collapsing bridge (must be quick!)
            {
                x: 3650,
                y: this.levelHeight - 600 - 30,
                hint: 'Collapsing bridge',
                optionalRouteId: 'forest_canopy_run'
            }
        ];

        starFragmentLocations.forEach((location, index) => {
            this.createStarFragment(
                location.x,
                location.y,
                index,
                location.optionalRouteId
            );
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

        this.redrawForestCoinLayer();
        console.log(`[MythicalForestLevel] Placed ${this.starFragmentSprites.length} Star Fragments and ${this.coinSprites.length} coins`);
    }

    /**
     * Create a Star Fragment collectible
     */
    createStarFragment(x, y, index, optionalRouteId = null) {
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
        sprite.optionalRouteId = optionalRouteId;

        // Keep collectible silhouettes strong on compact screens without five
        // permanent transforms competing with movement and enemy updates.
        if (this.shouldAnimateForestDecorations()) {
            this.tweens.add({
                targets: sprite,
                angle: 360,
                duration: 3000,
                repeat: -1,
                onUpdate: tween => {
                    sprite.y = y - Math.sin(tween.progress * Math.PI) * 8;
                }
            });
        } else {
            sprite.setAngle(index * 18);
        }

        // Sparkle particles around it
        if (!this.isMobile) {
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
        }

        // Create pickup zone
        const pickupZone = this.add.zone(x, y, 40, 40);
        this.physics.add.existing(pickupZone, true);
        pickupZone.optionalRouteId = optionalRouteId;

        if (this.player) {
            this.physics.add.overlap(this.player, pickupZone, () => {
                this.collectStarFragment(sprite, pickupZone, index);
            });
        }

        this.starFragmentSprites.push({
            sprite,
            pickupZone,
            collected: false,
            optionalRouteId
        });
    }

    /**
     * Collect a star fragment
     * Properly disables and destroys pickup zone
     */
    collectStarFragment(sprite, zone, index) {
        const fragmentData = this.starFragmentSprites[index];
        if (!fragmentData || fragmentData.collected) return;

        const fragmentBit = 1 << index;
        if ((this.forestCollectedFragmentMask & fragmentBit) !== 0) return;
        if (
            fragmentData.optionalRouteId &&
            !this.recordOptionalRouteProgress(fragmentData.optionalRouteId, {
                x: sprite.x,
                y: sprite.y
            })
        ) {
            return;
        }

        fragmentData.collected = true;
        this.forestCollectedFragmentMask |= fragmentBit;
        this.starFragmentsCollected = this.countCollectedForestFragments();
        const completedCollection =
            this.starFragmentsCollected >= this.totalStarFragments;
        if (completedCollection) this.awardForestFragmentBonus();
        this.refreshPersistedExpeditionRouteState();

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
        if (completedCollection) {
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

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }
    }

    /**
     * Create a coin collectible
     */
    createCoin(x, y, type = 'ground') {
        this.ensureForestCoinLayer();
        const pickup = {
            x,
            y,
            type,
            collected: false,
            batched: true
        };
        this.coinSprites.push(pickup);
    }

    ensureForestCoinLayer() {
        if (!this.forestCoinLayer?.active) {
            this.forestCoinLayer = this.add.graphics().setDepth(125);
            if (!this.isMobile) {
                this.forestCoinLayerTween = this.tweens.add({
                    targets: this.forestCoinLayer,
                    y: { from: 0, to: -5 },
                    duration: 960,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        }
    }

    redrawForestCoinLayer() {
        const layer = this.forestCoinLayer;
        if (!layer?.active) return false;
        layer.clear();
        layer.fillStyle(0xFFD700, 1);
        this.coinSprites.forEach(pickup => {
            if (!pickup?.batched || pickup.collected) return;
            layer.fillCircle(pickup.x, pickup.y, 8);
        });
        if (!this.isMobile) {
            layer.fillStyle(0xFFA500, 1);
            this.coinSprites.forEach(pickup => {
                if (!pickup?.batched || pickup.collected) return;
                layer.fillCircle(pickup.x - 2, pickup.y - 2, 3);
            });
        }
        return true;
    }

    updateForestCoinPickups() {
        const body = this.player?.body;
        if (!body) return 0;

        const pickupPadding = 15;
        let collectedCount = 0;
        this.coinSprites.forEach(pickup => {
            if (!pickup || pickup.collected) return;
            const visual = pickup.coin?.active ? pickup.coin : null;
            const x = visual?.x ?? pickup.x;
            const y = visual?.y ?? pickup.y;
            const overlapsPlayer =
                x >= body.left - pickupPadding &&
                x <= body.right + pickupPadding &&
                y >= body.top - pickupPadding &&
                y <= body.bottom + pickupPadding;
            if (!overlapsPlayer) return;
            if (this.collectForestCoin(pickup, { redraw: false })) {
                collectedCount += 1;
            }
        });

        if (collectedCount > 0) this.redrawForestCoinLayer();
        return collectedCount;
    }

    collectForestCoin(pickup, { redraw = true } = {}) {
        if (!pickup || pickup.collected) return false;
        pickup.collected = true;
        pickup.coin?.destroy?.();
        pickup.coin = null;
        if (pickup.batched && redraw) this.redrawForestCoinLayer();

        const coinValue = pickup.type === 'bonus' ? 15 : 10;
        window.EconomyManager?.addCoins?.(
            coinValue,
            `forest_${pickup.type}_coin`
        );
        window.AudioManager?.playCoinCollect?.();

        const coinText = this.add.text(pickup.x, pickup.y - 15, `+${coinValue}`, {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
            targets: coinText,
            y: pickup.y - 45,
            alpha: 0,
            duration: 600,
            onComplete: () => coinText.destroy()
        });
        return true;
    }

    /**
     * Create bridges/platforms connecting trees
     */
    createTreeBridges() {
        this.forestBridgeLayer = this.add.graphics().setDepth(15);
        const bridges = [
            // From Tree 1 to Tree 2
            { x1: 450, x2: 1050, y: this.levelHeight - 350, type: 'static' },
            // From Tree 2 to Tree 3
            { x1: 1400, x2: 1900, y: this.levelHeight - 450, type: 'vine' },
            // From Tree 3 to Tree 4
            {
                x1: 2100,
                x2: 3000,
                y: this.levelHeight - 500,
                type: 'static',
                id: 'forest-tree-3-handoff'
            },
            // Readable stepped spine between the two tall-tree routes.
            { x1: 3000, x2: 3260, y: this.levelHeight - 525, type: 'static' },
            { x1: 3260, x2: 3500, y: this.levelHeight - 565, type: 'static' },
            // From Tree 4 to Tree 5
            { x1: 3500, x2: 3800, y: this.levelHeight - 600, type: 'collapsing' },
            // A permanent lower recovery route keeps the expedition viable
            // after the faster upper bridge collapses.
            { x1: 3460, x2: 3640, y: this.levelHeight - 470, type: 'static' },
            { x1: 3640, x2: 3830, y: this.levelHeight - 430, type: 'static' },
            { x1: 3830, x2: 4010, y: this.levelHeight - 485, type: 'static' },
            // Rejoin the forward spine toward Tree 5.
            { x1: 3800, x2: 4050, y: this.levelHeight - 565, type: 'static' },
            { x1: 4050, x2: 4300, y: this.levelHeight - 525, type: 'static' },
            // From Tree 5 to Tree 6
            {
                x1: 4300,
                x2: 5200,
                y: this.levelHeight - 500,
                type: 'static',
                id: 'forest-guardian-handoff'
            }
        ];

        bridges.forEach((bridge, index) => {
            this.createBridge(bridge, index);
        });
    }

    /**
     * Create a single bridge between trees
     */
    createBridge(config, index) {
        const { x1, x2, y, type, id = null } = config;
        const width = x2 - x1;

        const bridgeGraphics = this.forestBridgeLayer;

        if (type === 'static') {
            // Solid crystal bridge
            bridgeGraphics.fillStyle(0x2A2A5E, 0.8);
            bridgeGraphics.fillRect(x1, y, width, 15);
            bridgeGraphics.lineStyle(2, 0x00FF7F, 0.5);
            bridgeGraphics.strokeRect(x1, y, width, 15);

            // Physics
            const bridgeZone = this.add.zone(x1 + width/2, y + 7, width, 15);
            this.physics.add.existing(bridgeZone, true);
            this.configureForestClimbSupport(bridgeZone);
            bridgeZone.traversalId = id || `forest-bridge-${index + 1}`;
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
                this.configureForestClimbSupport(stepZone);
                stepZone.traversalId = `forest-vine-${index + 1}-step-${i + 1}`;
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
                sectionZone.platformType = 'collapsing';
                sectionZone.traversalId =
                    `forest-collapse-${index + 1}-section-${i + 1}`;
                sectionZone.traversalOneWay = true;
                sectionZone.traversalTransient = true;
                sectionZone.body.checkCollision.down = false;
                sectionZone.body.checkCollision.left = false;
                sectionZone.body.checkCollision.right = false;
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
        const guardianGateX = 5520;
        const triggerZone = this.add.zone(
            guardianGateX,
            this.levelHeight / 2,
            120,
            this.levelHeight
        );
        this.physics.add.existing(triggerZone, true);
        this.bossTriggerZone = triggerZone;
        this.createGuardianGateState({
            x: guardianGateX,
            y: groundY - 72,
            title: 'ELDER GROVE',
            getStatus: () => 'ALIGN 3 BEACON ANCHORS',
            isReady: () => this.forestRouteAligned,
            color: 0x9370DB,
            readyColor: 0x8FE3CF
        });

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
                    const guardianEntered = this.beginGuardianEncounter({
                        id: 'elder_treant',
                        title: 'ELDER TREANT',
                        checkpoint: {
                            x: 5380,
                            y: this.levelHeight - 170
                        },
                        start: () => this.startBossFight()
                    });
                    if (!guardianEntered) return;

                    this.bossTriggerZone?.destroy?.();
                    this.bossTriggerZone = null;
                }
            });
        }

        // The arena is several screens away at spawn. Phones keep one batched
        // field instead of allocating and destroying offscreen particles for
        // the whole expedition; desktop retains the moving treatment.
        if (this.shouldAnimateForestDecorations()) {
            this.forestArenaAmbientTimer = this.time.addEvent({
                delay: 200,
                callback: () => {
                    if (!this.scene.isActive()) return;
                    const particle = this.add.graphics();
                    particle.forestArenaAmbientParticle = true;
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
        } else {
            const ambient = this.add.graphics().setDepth(9).setAlpha(0.68);
            for (let index = 0; index < 16; index += 1) {
                ambient.fillStyle(0x9370DB, 0.22 + (index % 3) * 0.07);
                ambient.fillCircle(
                    arenaX + 52 + index * 88,
                    groundY - 18 - (index % 4) * 13,
                    2 + (index % 2)
                );
            }
            this.forestArenaAmbientLayer = ambient;
        }
    }

    /**
     * Start the Elder Treant boss fight
     */
    startBossFight() {
        console.log('[MythicalForestLevel] Starting Elder Treant boss fight!');
        this.bossFightActive = true;
        this.retireForestPatrolsForElder();

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
        if (!this.boss || this.boss.isAttacking || this.bossPhaseTransitioning) return;

        const pacing = FOREST_GUARDIAN_ATTACK_PACING[attackType] ||
            { windup: 600, recovery: 850, color: 0xFFD166 };
        this.boss.isAttacking = true;
        this.boss.isRecovering = false;
        this.boss.setVelocityX?.(0);
        const attackWindow = FOREST_GUARDIAN_ATTACK_WINDOWS[attackType] || 1800;
        this.showBossAttackInstruction(
            FOREST_GUARDIAN_ATTACK_CUES[attackType],
            pacing.windup + attackWindow
        );
        this.createForestBossTelegraph(attackType, pacing);

        this.bossAttackWindupTimer?.remove?.();
        this.bossAttackWindupTimer = this.time.delayedCall(pacing.windup, () => {
            this.bossAttackWindupTimer = null;
            if (!this.boss?.active || this.bossDefeated || this.bossPhaseTransitioning) return;

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
        });

        this.bossRecoveryTimer?.remove?.();
        this.bossRecoveryTimer = this.time.delayedCall(
            pacing.windup + attackWindow,
            () => {
                this.bossRecoveryTimer = null;
                if (this.boss?.active && !this.bossDefeated && !this.bossPhaseTransitioning) {
                    this.showForestBossRecovery(pacing.recovery);
                }
            }
        );

        // Keep the guardian locked through a guaranteed post-attack opening.
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = this.time.delayedCall(
            pacing.windup + attackWindow + pacing.recovery,
            () => {
                if (this.boss && !this.bossPhaseTransitioning) {
                    this.boss.isAttacking = false;
                    this.boss.isRecovering = false;
                }
                this.bossAttackUnlockTimer = null;
            }
        );
    }

    createForestBossTelegraph(attackType, pacing) {
        if (!this.boss || !this.player) return null;

        const warning = this.add.graphics();
        const color = pacing.color;
        const groundY = this.levelHeight - 120;
        const direction = this.boss.facingRight ? 1 : -1;
        const camera = this.cameras.main;
        const viewX = camera.worldView?.x ?? camera.scrollX ?? 0;

        warning.fillStyle(color, 0.14);
        warning.lineStyle(4, color, 0.95);
        if (attackType === 'root_slam') {
            warning.fillRect(this.boss.x - 220, groundY - 18, 440, 36);
            warning.strokeRect(this.boss.x - 220, groundY - 18, 440, 36);
        } else if (attackType === 'vine_whip') {
            const laneX = direction > 0 ? this.boss.x + 45 : this.boss.x - 365;
            warning.fillRect(laneX, this.boss.y - 24, 320, 48);
            warning.strokeRect(laneX, this.boss.y - 24, 320, 48);
        } else if (attackType === 'spore_cloud') {
            warning.fillCircle(this.player.x, this.player.y, 72);
            warning.strokeCircle(this.player.x, this.player.y, 72);
        } else {
            warning.fillRect(viewX + 12, 24, camera.width - 24, this.levelHeight - 145);
            warning.strokeRect(viewX + 12, 24, camera.width - 24, this.levelHeight - 145);
        }

        warning.setDepth(845).setAlpha(0.9);
        this.bossTelegraphs.add(warning);
        this.tweens.add({
            targets: warning,
            alpha: 0.28,
            duration: Math.max(120, Math.floor(pacing.windup / 4)),
            yoyo: true,
            repeat: 2,
            onComplete: () => this.destroyForestBossTelegraph(warning)
        });
        return warning;
    }

    showForestBossRecovery(duration) {
        if (!this.boss?.active) return;
        if (this.bossPhasePending) {
            this.bossPhasePending = false;
            this.triggerPhase2();
            return;
        }

        this.boss.isRecovering = true;
        this.bossInstructionText
            ?.setText('OPENING // STRIKE THE PURPLE CORRUPTION')
            ?.setColor('#8FE3CF');
        const opening = this.add.graphics();
        opening.lineStyle(5, 0x8FE3CF, 0.9);
        opening.strokeCircle(0, 0, 105);
        opening.setPosition(this.boss.x, this.boss.y).setDepth(885);
        this.bossTelegraphs.add(opening);
        this.tweens.add({
            targets: opening,
            alpha: 0,
            scaleX: 1.35,
            scaleY: 1.35,
            duration,
            ease: 'Sine.easeOut',
            onComplete: () => this.destroyForestBossTelegraph(opening)
        });
    }

    destroyForestBossTelegraph(graphic) {
        if (!graphic) return;
        this.tweens.killTweensOf?.(graphic);
        this.bossTelegraphs.delete(graphic);
        graphic.destroy?.();
    }

    clearForestBossPacing({ includePhase = false } = {}) {
        this.bossAttackWindupTimer?.remove?.();
        this.bossAttackWindupTimer = null;
        this.bossRecoveryTimer?.remove?.();
        this.bossRecoveryTimer = null;
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        if (includePhase) {
            this.bossPhaseTransitionTimer?.remove?.();
            this.bossPhaseTransitionTimer = null;
            this.bossPhaseTransitioning = false;
            this.bossPhasePending = false;
        }
        this.bossTelegraphs.forEach(graphic => {
            this.tweens.killTweensOf?.(graphic);
            graphic.destroy?.();
        });
        this.bossTelegraphs.clear();
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
    bossRootSlam() {
        if (!this.boss) return;

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
    bossVineWhip() {
        if (!this.boss || !this.player) return;

        const direction = this.boss.facingRight ? 1 : -1;

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
    bossSporeCloud() {
        if (!this.boss || !this.player) return;

        // Target player position
        const targetX = this.player.x;
        const targetY = this.player.y;

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
    bossNatureFury() {
        if (!this.boss) return;

        // The lane warning is authored before this impact in executeBossAttack.
        if (this.combatJuice) {
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
                const viewX = this.cameras.main.worldView?.x ?? this.cameras.main.scrollX ?? 0;
                const leafX = viewX + Math.random() * width;

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
        if (!this.boss || this.bossDefeated) return false;

        const recoveryBonus = this.boss.isRecovering ? 1 : 0;
        const finalAmount = amount + recoveryBonus;
        this.bossHealth = Math.max(0, this.bossHealth - finalAmount);
        this.updateBossHealthBar();

        // COMBAT JUICE: Exciting boss hit feedback!
        if (this.combatJuice) {
            // Register hit for combo system
            this.combatJuice.registerHit(finalAmount);

            this.showFloatingText(
                recoveryBonus
                    ? `OPEN CORRUPTION -${finalAmount}`
                    : `CORRUPTION -${finalAmount}`,
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

        // The final impact clears the guardian's corruption.
        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        } else if (
            this.bossHealth <= this.bossMaxHealth * 0.5 &&
            this.bossPhase === 1
        ) {
            this.requestForestBossPhase2();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
        return true;
    }

    requestForestBossPhase2() {
        if (this.boss?.isAttacking && !this.boss?.isRecovering) {
            this.bossPhasePending = true;
            return;
        }

        this.triggerPhase2();
    }

    /**
     * Trigger phase 2 - DRAMATIC phase transition with combat juice!
     */
    triggerPhase2() {
        if (
            !this.boss?.active ||
            this.bossDefeated ||
            this.bossPhase !== 1 ||
            this.bossPhaseTransitioning
        ) return;

        this.bossPhasePending = false;
        this.bossPhase = 2;
        this.bossPhaseTransitioning = true;
        this.clearForestBossPacing();
        this.boss.isAttacking = true;
        this.boss.isRecovering = false;
        this.boss.setVelocity?.(0, 0);
        if (this.bossAITimer) {
            this.bossAITimer.paused = true;
        }

        if (this.combatJuice) {
            this.combatJuice.phaseTransition(this.boss, 2, '🌿 CORRUPTION SURGES! 🌿');
        }
        window.FeedbackManager?.cameraShake?.(this, 500, 0.02);
        this.boss.setTint(0xFF6B6B);

        const { width, height } = this.cameras.main;
        const phaseRing = this.add.graphics();
        phaseRing.lineStyle(7, 0xFF8A4C, 0.95);
        phaseRing.strokeCircle(0, 0, 90);
        phaseRing.setPosition(this.boss.x, this.boss.y).setDepth(890);
        this.bossTelegraphs.add(phaseRing);
        this.tweens.add({
            targets: phaseRing,
            alpha: 0,
            scaleX: 2.2,
            scaleY: 2.2,
            duration: 1500,
            ease: 'Sine.easeOut',
            onComplete: () => this.destroyForestBossTelegraph(phaseRing)
        });

        const phaseText = this.add.text(width / 2, height / 2, 'CORRUPTION SURGES // WATCH THE NEW PATTERN', {
            fontSize: width <= 480 ? '20px' : '28px',
            color: '#FFB27A',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width - 50 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 50,
            duration: 1500,
            onComplete: () => phaseText.destroy()
        });

        // Phase two adds a new pattern without deleting the player's reading time.
        if (this.bossAITimer) {
            this.bossAITimer.delay = 1900;
        }

        this.bossPhaseTransitionTimer?.remove?.();
        this.bossPhaseTransitionTimer = this.time.delayedCall(1650, () => {
            this.bossPhaseTransitionTimer = null;
            this.bossPhaseTransitioning = false;
            if (!this.boss?.active || this.bossDefeated) return;

            if (this.bossAITimer) {
                this.bossAITimer.paused = false;
            }
            this.showForestBossRecovery(900);
            this.bossAttackUnlockTimer = this.time.delayedCall(900, () => {
                if (this.boss) {
                    this.boss.isAttacking = false;
                    this.boss.isRecovering = false;
                }
                this.bossAttackUnlockTimer = null;
            });
        });

        if (window.AudioManager) {
            window.AudioManager.playError();
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
        this.clearForestBossPacing({ includePhase: true });
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
        this.clearForestBossPacing({ includePhase: true });
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
        });
        this.coinSprites = [];
        this.forestCoinLayerTween?.remove?.();
        this.forestCoinLayerTween = null;
        this.forestCoinLayer?.destroy?.();
        this.forestCoinLayer = null;
        this.forestEnemyOverlap?.destroy?.();
        this.forestEnemyOverlap = null;
        this.forestEnemyAISchedulerActive = false;
        this.forestProximityEnemies = [];
        this.forestEnemyActivationBounds = null;
        this.forestEnemyActivationNextAt = 0;

        // Clean up platforms
        this.branchPlatforms = [];
        this.collapsingBranches = [];
        this.cosmicTrees = [];

        // Clean up particles
        this.forestAmbientLayers.forEach(layer => {
            this.tweens?.killTweensOf?.(layer);
            if (layer?.active) layer.destroy();
        });
        this.forestAmbientLayers = [];
        this.forestAmbientPointCount = 0;
        this.forestFoliageTween?.remove?.();
        this.forestFoliageTween = null;
        this.forestFoliageLayer = null;
        this.forestEnemyTrailTimer?.remove?.();
        this.forestEnemyTrailTimer = null;
        this.forestArenaAmbientTimer?.remove?.();
        this.forestArenaAmbientTimer = null;
        [
            'forestGroundLayer',
            'forestVoidLayer',
            'forestVoidMoteLayer',
            'forestTreeStructureLayer',
            'forestBridgeLayer',
            'forestEnemyTrailLayer',
            'forestArenaAmbientLayer'
        ].forEach(property => {
            this.tweens?.killTweensOf?.(this[property]);
            this[property]?.destroy?.();
            this[property] = null;
        });

        super.shutdown();
    }
}

// Export for module system
export default MythicalForestLevel;

// Also export to window for global access
if (typeof window !== 'undefined') {
    window.MythicalForestLevel = MythicalForestLevel;
}
