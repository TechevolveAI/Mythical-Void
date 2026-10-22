import PlatformerLevelScene from '../PlatformerLevelScene.js';
import { createPeaksCompletionHandler } from '../controllers/PeaksCompletionTransaction.js';
import { calculateBallisticLaunchVelocity } from '../../systems/TraversalTopology.js';
import { MOUNTAIN_BOSS_NAME, MOUNTAIN_ASCENT, mountainSteps, mountainStepRise, mountainEmitter } from '../../systems/MountainBossAscent.js';
import { drawMountainPressureBar } from '../../systems/MountainBossPresentation.js';
import { PEAK_WORLD_HEIGHT, PEAK_ROUTE, PEAK_RELAYS, PEAK_FRAGMENTS, PEAK_RETURN_CURRENTS, peakCheckpointSupport } from '../../systems/VoidPeaksRoute.js';
import { nextMountainAttack, mountainAttackPlan } from '../../systems/MountainBossPatterns.js';
import { PATROL_SENTINEL_FRAME } from '../../systems/PatrolSentinelArtwork.js';

const COSMIC_TITAN_TEXTURE = 'cosmicTitan';
const COSMIC_TITAN_ASSET = '/game/guardians/peak-of-the-mountain-cosmic.webp';

const TITAN_ARENA = Object.freeze({
    playerEntryX: 5040,
    introFocusX: 4740,
    bossX: 4890,
    combatHeight: 225,
    openingGraceMs: 1200
});

const TITAN_ATTACK_WINDOWS = Object.freeze({
    gravityCrush: 1800,
    starRain: 2600,
    voidPunch: 2600,
    singularity: 3000
});
const TITAN_ATTACK_WINDUP = 700;
const TITAN_RECOVERY_WINDOW = 1800;
const TITAN_PHASE_RECOVERY = 1300;
const PEAK_RETURN_CURRENT_LAUNCH_BAND = 130;

const PEAK_ENCOUNTER_PLAN = Object.freeze([
    Object.freeze({
        beat: 'opening-clear',
        supportId: 'peak-opening-step',
        lane: 'shared',
        health: 1,
        patrolRange: 55,
        speed: 38
    }),
    Object.freeze({
        beat: 'lower-relay-lesson',
        supportId: 'peak-lower-relay-overlook',
        lane: 'shared',
        offsetX: -160,
        health: 2,
        patrolRange: 80,
        speed: 40
    }),
    Object.freeze({
        beat: 'climb-pressure',
        supportId: 'peak-lower-ascent',
        lane: 'shared',
        health: 2,
        patrolRange: 55,
        speed: 42
    }),
    Object.freeze({
        beat: 'lower-route-guard',
        supportId: 'peak-ridge-approach',
        lane: 'shared',
        offsetX: -100,
        health: 3,
        patrolRange: 90,
        speed: 43
    }),
    Object.freeze({
        beat: 'warning-line-guard',
        supportId: 'peak-floor-summit',
        lane: 'main',
        offsetX: -140,
        health: 2,
        patrolRange: 50,
        speed: 44
    }),
    Object.freeze({
        beat: 'summit-floor-guard',
        supportId: 'peak-floor-summit',
        lane: 'main',
        offsetX: 120,
        health: 3,
        patrolRange: 55,
        speed: 45
    }),
    Object.freeze({
        beat: 'titan-approach',
        supportId: 'peak-titan-approach',
        lane: 'shared',
        offsetX: -100,
        health: 3,
        patrolRange: 110,
        speed: 46
    }),
    Object.freeze({
        beat: 'titan-overlook',
        supportId: 'peak-summit-relay',
        lane: 'shared',
        health: 4,
        patrolRange: 65,
        speed: 47
    })
]);

/**
 * VoidPeaksLevel - mountain platformer level before the final void.
 *
 * Features:
 * - Jagged cliff climb with void geyser hazards
 * - Creature warning relays answered by distant settlements
 * - Cosmic Titan guardian restoration
 * - Hull Plating offered after the signal network is restored
 */
class VoidPeaksLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'VoidPeaksLevel',
            levelId: 'void_peaks_1',
            biomeId: 'void_peaks',
            levelWidth: 5200,
            levelHeight: PEAK_WORLD_HEIGHT,
            movement: {
                playerSpeed: 195,
                jumpVelocity: -455,
                playerAcceleration: 0.18,
                playerDeceleration: 0.72,
                coyoteTime: 150,
                jumpBufferTime: 150
            }
        });

        this.starFragmentsCollected = 0;
        this.peakCollectedFragmentMask = 0;
        this.peakRouteChoice = '';
        this.totalStarFragments = 5;
        this.bossDefeated = false;
        this.peakVictoryShown = false;
        this.peakResultShown = false;
        this.mountainAwake = false;
        this.peakResultElements = [];
        this.bossFightActive = false;
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossMaxHealth = 24;
        this.bossPhase = 1;
        this.titanAttackIndex = 0;
        this.bossAttackTimer = null;
        this.titanControlTimers = new Map();
        this.peakHazards = [];
        this.peakReturnCurrents = [];
        this.activePeakReturnCurrent = null;
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
        this.creatureWarningResponse = null;
        this.creatureWarningResponseTween = null;
        this.warningReplyCameraFocusUntil = 0;
        this.peakStarField = [];
        this.peakStarLayer = null;
        this.peakEmbers = [];
        this.peakEmberLayer = null;
        this.peakEmberDrawNextAt = 0;
        this.peakEmberViewCenterX = Number.NaN;
        this.peakEmberDrawCount = 0;
        this.peakEmberVisibleCount = 0;
        this.peakProximityEnemies = [];
        this.peakEnemyAISchedulerActive = false;
        this.peakEnemyActivationBounds = null;
        this.peakEnemyActivationNextAt = 0;
        this.peakEnemyPatrolNextAt = 0;
        this.peakEnemyPatrolUpdateCount = 0;
        this.titanGate = null;
        this.bossGateHintUntil = 0;
        this.routeHintUntil = 0;
        this.cosmicEggAwarded = false;
        this.titanWarningTimer = null;
        this.titanAttackUnlockTimer = null;
        this.titanPhaseRecoveryTimer = null;
        this.titanAttackLocked = false;
        this.titanRecoveryUntil = 0;
        this.bossEncounterEffects = new Set();
        this.bossEncounterTimers = new Set();
        this.bossAttackPreview = null;
        this.bossAttackPreviewTimer = null;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.deferredTitanCombat = null;
        this.titanEntrance = null;
        this.titanRecoveryDamage = 0;
        this.titanAttacksCompleted = 0;
        this.titanLastHitAt = -Infinity;
        this.titanOpeningCameraFraming = false;
        this.bossPressureText = null;
        this.peakEncounterRhythm = [];
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    init(data) {
        this.completionSaveAttempt?.retire();
        this.completionSaveAttempt = null;
        this.completionSaveLifetime = {};
        this.clearTitanEntrance();
        this.clearTitanControlTimers();
        this.clearTitanWindup();
        this.deferredTitanCombat = null;
        this.titanEntrance = null;
        this.clearMountainAttackLaunches();
        this.clearMountainProjectiles();
        this.clearMountainSnowGrenades();
        super.init(data);

        this.testMode = data?.testMode || false;
        this.starFragmentsCollected = 0;
        this.peakCollectedFragmentMask = 0;
        this.peakRouteChoice = '';
        this.bossDefeated = false;
        this.peakVictoryShown = false;
        this.peakResultShown = false;
        this.mountainAwake = false;
        this.peakResultElements = [];
        this.bossFightActive = false;
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.titanAttackIndex = 0;
        this.bossAttackTimer = null;
        this.titanControlTimers = new Map();
        this.peakHazards = [];
        this.peakReturnCurrents = [];
        this.activePeakReturnCurrent = null;
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
        this.creatureWarningResponse = null;
        this.creatureWarningResponseTween = null;
        this.warningReplyCameraFocusUntil = 0;
        this.peakStarField = [];
        this.peakStarLayer = null;
        this.peakEmbers = [];
        this.peakEmberLayer = null;
        this.peakEmberDrawNextAt = 0;
        this.peakEmberViewCenterX = Number.NaN;
        this.peakEmberDrawCount = 0;
        this.peakEmberVisibleCount = 0;
        this.peakProximityEnemies = [];
        this.peakEnemyAISchedulerActive = false;
        this.peakEnemyActivationBounds = null;
        this.peakEnemyActivationNextAt = 0;
        this.peakEnemyPatrolNextAt = 0;
        this.peakEnemyPatrolUpdateCount = 0;
        this.titanGate = null;
        this.bossGateHintUntil = 0;
        this.routeHintUntil = 0;
        this.cosmicEggAwarded = false;
        this.titanWarningTimer = null;
        this.titanAttackUnlockTimer = null;
        this.titanPhaseRecoveryTimer = null;
        this.titanAttackLocked = false;
        this.titanRecoveryUntil = 0;
        this.bossEncounterEffects = new Set();
        this.bossEncounterTimers = new Set();
        this.bossAttackPreviewTimer = null;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.titanRecoveryDamage = 0;
        this.titanAttacksCompleted = 0;
        this.titanLastHitAt = -Infinity;
        this.titanOpeningCameraFraming = false;
        this.bossAttackPreview = [
            'gravityCrush',
            'starRain',
            'voidPunch',
            'singularity'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;
        this.bossPressureText = null;
        this.peakEncounterRhythm = [];
        this.levelEntryDismissing = false;
        this.clearLevelEntryKeyHandler();

        console.log('[VoidPeaksLevel] Level state reset');
    }

    preload() {
        super.preload();
        this.load.image(COSMIC_TITAN_TEXTURE, COSMIC_TITAN_ASSET);
        this.load.image('peak-meteor-stone', '/game/terrain/peaks-meteor-basalt-v1.webp');
    }

    create() {
        super.create();

        if (this.prepareCurrentEcologyPreview()) return;

        if (!this.entryPreview && window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'voidPeaks' });
        }

        this.levelStartTime = Date.now();
        this.damageTaken = 0;

        if (this.testMode) {
            this.startTestMode();
        } else {
            this.showLevelEntry();
        }
    }

    startTestMode() {
        console.log('[VoidPeaksLevel] TEST MODE - Spawning Cosmic Titan');
        this.createPeakAtmosphere();

        this.stageTitanArenaEntry();

        this.showPlatformerMobileControls();

        this.time.delayedCall(500, () => this.startBossFight());
    }

    showLevelEntry() {
        this.levelEntryDismissing = false;
        const layout = this.getLevelModalLayout({ maxWidth: 480, maxHeight: 400 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, y, font, buttonPadding
        } = layout;
        const resume = this.getExpeditionResumePresentation();
        const companionName = this.getCompanionName();
        this.physics.pause();

        const entryElements = [];
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);
        entryElements.push(overlay);

        const panel = this.add.graphics();
        panel.fillStyle(0x12081F, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
        panel.lineStyle(3, 0xFF4500, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
        panel.setScrollFactor(0);
        panel.setDepth(3001);
        entryElements.push(panel);

        const title = this.add.text(width / 2, y(50), 'VOID PEAKS', {
            fontSize: font(38, 29),
            color: '#FF6B35',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(title);

        const subtitle = this.add.text(width / 2, y(92), `"${companionName} catches a warning in the wind"`, {
            fontSize: font(16, 14),
            color: '#DA70D6',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(subtitle);

        const mission = this.add.text(
            width / 2,
            y(132),
            resume
                ? `PROJECT BEACON // RESUME ${resume.current}/${resume.total}`
                : 'PROJECT BEACON // EXPEDITION 04',
            {
            fontSize: font(13, 11),
            color: '#8A8196',
            align: 'center',
            wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(mission);

        const objective = this.add.text(width / 2, y(172), 'Reach the summit. The mountain is alive.', {
            fontSize: font(19, 16),
            color: '#8FE3CF',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(objective);

        const checklist = this.add.text(contentLeft, y(220), `${
            resume
                ? `Continue from ${resume.label}`
                : 'The lights along the climb save your progress.'
        }\nFree the Peak of the Mountain.\nTake the high ridge for an extra shield.`, {
            fontSize: font(16, 14),
            color: '#CCCCCC',
            lineSpacing: 8,
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);
        entryElements.push(checklist);

        const enterBtn = this.add.text(
            width / 2,
            y(342),
            resume ? '[ RESUME EXPEDITION ]' : '[ CLIMB THE PEAKS ]',
            {
            fontSize: font(20, 17),
            color: '#FF6B35',
            backgroundColor: '#1A0A2E',
            padding: buttonPadding
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });
        entryElements.push(enterBtn);

        this.layoutCampaignEntryContent(
            layout,
            [title, subtitle, mission, objective, checklist, enterBtn],
            { gaps: [8, 10, 10, 10, 14] }
        );

        enterBtn.on('pointerover', () => enterBtn.setColor('#FFD700'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#FF6B35'));

        const dismissEntry = () => {
            if (this.levelEntryDismissing) return;

            this.levelEntryDismissing = true;
            enterBtn.disableInteractive();
            overlay.disableInteractive();
            this.clearLevelEntryKeyHandler();
            this.physics.resume();
            this.startLevel();
            this.tweens.add({
                targets: entryElements,
                alpha: 0,
                duration: 700,
                onComplete: () => {
                    entryElements.forEach(el => el?.destroy?.());
                }
            });
        };

        enterBtn.on('pointerdown', dismissEntry);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', dismissEntry);

        this.levelEntryKeyHandler = event => {
            if (!['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            dismissEntry();
        };
        window.addEventListener('keydown', this.levelEntryKeyHandler);
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
            window.GameState?.get?.('creature.name') || 'Your creature'
        ).trim().replace(/\s+/g, ' ').slice(0, 20) || 'Your creature';
    }

    startLevel() {
        console.log('[VoidPeaksLevel] Starting level');
        this.createPeakAtmosphere();
        this.showPlatformerMobileControls();
        if (!this.checkpointResumeApplied) this.showObjectiveToast();
    }

    setupCamera() {
        super.setupCamera();
        this.configureMountainCameraBounds();
    }

    handlePlatformerMobileResize() {
        super.handlePlatformerMobileResize();
        this.configureMountainCameraBounds();
    }

    configureMountainCameraBounds() {
        const camera = this.cameras?.main;
        if (!camera || !this.player?.active) return;
        if (this.isMobile || camera.width <= 480) {
            // Extra camera space, not extra playable world: feet at the foothills
            // must remain above touch controls instead of hitting the bottom clamp.
            camera.setBounds(0, 0, this.levelWidth, this.levelHeight + 260);
            camera.setDeadzone(camera.width * 0.1, camera.height * 0.14);
        }
    }

    createBackground() {
        super.createBackground();

        const bg = this.add.graphics();
        for (let y = 0; y < this.levelHeight; y += 3) {
            const t = y / this.levelHeight;
            const r = Math.floor(5 + t * 22);
            const g = Math.floor(3 + t * 6);
            const b = Math.floor(18 + t * 28);
            bg.fillStyle((r << 16) | (g << 8) | b, 0.88);
            bg.fillRect(0, y, this.levelWidth, 3);
        }
        bg.setDepth(-900);

        this.peakStarField = Array.from({ length: 35 }, () => ({
            x: Phaser.Math.Between(0, this.levelWidth),
            y: Phaser.Math.Between(20, 360),
            radius: Phaser.Math.FloatBetween(1, 3),
            color: Phaser.Utils.Array.GetRandom([0x8B008B, 0xFF4500, 0xFFFFFF]),
            alpha: Phaser.Math.FloatBetween(0.25, 0.75),
            batched: true
        }));
        this.peakStarLayer = this.add.graphics()
            .setScrollFactor(0.18)
            .setDepth(-850);
        this.peakStarField.forEach(star => {
            this.peakStarLayer.fillStyle(star.color, star.alpha);
            this.peakStarLayer.fillCircle(star.x, star.y, star.radius);
        });
    }

    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        // Continuous stone beneath the climb catches missed jumps. Only the
        // thin shelves are one-way; the mountain itself is solid.
        PEAK_ROUTE.forEach(({ x, y, width, type, id }) => {
            const height = type === 'solid' ? this.levelHeight - y + 20 : 28;
            const platform = this.createPeakTerrainSupport(x, y, width, height, type);
            platform.traversalId = id;
            if (id === 'peak-floor-lower') platform.traversalLinks = ['peak-warning-lower'];
            if (id === 'peak-floor-summit') platform.traversalLinks = ['peak-warning-summit'];
        });

        this.createBossArena();
        console.log(`[VoidPeaksLevel] Created ${this.platforms.getLength()} platforms`);
    }

    createPeakTerrainSupport(x, y, width, height, type) {
        // A tiny shared collision texture avoids baking world-height bitmaps.
        const key = 'peak-terrain-collider';
        if (!this.textures.exists(key)) {
            const texture = this.make.graphics({ add: false });
            texture.fillStyle(0xFFFFFF).fillRect(0, 0, 2, 2);
            texture.generateTexture(key, 2, 2);
            texture.destroy();
        }
        const support = this.platforms.create(x + width / 2, y + height / 2, key);
        support.setDisplaySize(width, height).refreshBody().setVisible(false);
        support.removeFromDisplayList();
        support.platformType = type;
        if (type === 'one-way') {
            support.body.checkCollision.down = false;
            support.body.checkCollision.left = false;
            support.body.checkCollision.right = false;
        }
        this.peakTerrainArt ||= [];
        if (this.textures.exists('peak-meteor-stone')) {
            const material = this.add.tileSprite(x, y, width, height, 'peak-meteor-stone')
                .setOrigin(0).setDepth(140).setTint(0xB4C4C9);
            material.tilePositionX = x;
            material.tilePositionY = y;
            this.peakTerrainArt.push(material);
        }
        if (!this.peakTerrainStone) {
            this.peakTerrainStone = this.add.graphics().setDepth(141);
            this.peakTerrainArt.push(this.peakTerrainStone);
        }
        const stone = this.peakTerrainStone;
        const faceHeight = type === 'one-way' ? 28 : height;
        stone.fillStyle(0x07111B, this.textures.exists('peak-meteor-stone') ? 0.18 : 1)
            .fillRect(x, y, width, faceHeight);
        for (let band = 1; band <= 4; band++) {
            const top = Math.min(faceHeight, band * 85);
            stone.fillStyle(0x08151E, 0.1).fillRect(x, y + top, width, faceHeight - top);
        }
        for (let i = 0; i < width; i += 23) {
            stone.fillStyle(i % 46 ? 0x9CB3BB : 0x506D7B, 0.9);
            stone.fillTriangle(x + i, y, x + Math.min(width, i + 22), y, x + i + 13, y + 7 + i % 5);
        }
        // The bright mineral lip is exactly on the physical landing surface.
        stone.lineStyle(2, 0xDEEBE9, 0.95).lineBetween(x, y, x + width, y);
        return support;
    }

    createLevelContent() {
        this.enemies = this.physics.add.group();
        this.collectibles = this.physics.add.group();

        this.createVoidGeysers();
        this.createPeakReturnCurrents();
        this.createPeakEnemies();
        this.createStarFragments();
        this.createSignalRelays();
        this.createPeakRouteChoiceMarkers();
        this.createTitanGate();

        this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    shouldAnimatePeakRouteDecorations() {
        const width = Number(this.cameras?.main?.width) || 0;
        const height = Number(this.cameras?.main?.height) || 0;
        return !(this.isMobile || width <= 480 || height < 620);
    }

    createPeakAtmosphere() {
        this.peakEmberLayer?.destroy?.();
        this.peakEmberLayer = this.add.graphics().setDepth(40);
        this.peakEmbers = Array.from({ length: 18 }, () => ({
            x: Phaser.Math.Between(0, this.levelWidth),
            originY: Phaser.Math.Between(120, this.levelHeight - 180),
            radius: Phaser.Math.FloatBetween(3, 8),
            color: Phaser.Utils.Array.GetRandom([0xFF4500, 0x9400D3, 0xFFD700]),
            travel: Phaser.Math.Between(80, 180),
            duration: Phaser.Math.Between(3200, 6200),
            phaseOffset: Phaser.Math.Between(0, 6200),
            batched: true
        }));
        this.peakEmberDrawNextAt = 0;
        this.peakEmberViewCenterX = Number.NaN;
        this.peakEmberDrawCount = 0;
        this.drawPeakEmbers(0, true);
    }

    drawPeakEmbers(time, force = false) {
        if (!this.peakEmberLayer?.active) return;

        const now = Number(time) || 0;
        const view = this.cameras?.main?.worldView;
        const left = Number(view?.left) || 0;
        const right = Number(view?.right) || this.levelWidth;
        const top = Number(view?.top) || 0;
        const bottom = Number(view?.bottom) || this.levelHeight;
        const viewCenterX = (left + right) / 2;
        const compactViewport = this.isMobile ||
            (Number(this.cameras?.main?.width) || 0) <= 480 ||
            (Number(this.cameras?.main?.height) || 0) < 620;

        if (!force && compactViewport) {
            const redrawDistance = Math.max(180, (right - left) * 0.45);
            if (
                Number.isFinite(this.peakEmberViewCenterX) &&
                Math.abs(viewCenterX - this.peakEmberViewCenterX) < redrawDistance
            ) return;
        } else if (!force && now < this.peakEmberDrawNextAt) {
            return;
        }

        this.peakEmberDrawNextAt = now + 50;
        this.peakEmberViewCenterX = viewCenterX;
        const renderTime = compactViewport ? 0 : now;
        let visibleCount = 0;
        this.peakEmberLayer.clear();
        this.peakEmbers.forEach(ember => {
            if (ember.x < left - 140 || ember.x > right + 140) return;
            const phase = ((renderTime + ember.phaseOffset) % ember.duration) /
                ember.duration;
            const rise = (Math.sin((phase * Math.PI * 2) - (Math.PI / 2)) + 1) / 2;
            const y = ember.originY - (ember.travel * rise);
            if (y < top - 100 || y > bottom + 100) return;
            const alpha = 0.05 + ((1 - rise) * 0.5);

            visibleCount += 1;
            this.peakEmberLayer.fillStyle(ember.color, alpha * 0.34);
            this.peakEmberLayer.fillCircle(ember.x, y, ember.radius * 1.8);
            this.peakEmberLayer.fillStyle(ember.color, alpha);
            this.peakEmberLayer.fillCircle(ember.x, y, ember.radius);
        });
        this.peakEmberVisibleCount = visibleCount;
        this.peakEmberDrawCount += 1;
    }

    createVoidGeysers() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const geysers = [
            { x: 2150, y: 1490, width: 38 },
            { x: 3030, y: 1120, width: 38 }
        ];

        geysers.forEach(({ x, y, width }) => {
            const hazard = this.add.zone(x + width / 2, y - 9, width, 18);
            this.physics.add.existing(hazard, true);
            hazard.damage = 1;
            this.peakHazards.push(hazard);

            const visual = this.add.graphics();
            visual.fillStyle(0xB84235, 0.8);
            visual.fillTriangle(x, y, x + width / 2, y - 22, x + width, y);
            visual.lineStyle(3, 0xFFC377, 1);
            visual.lineBetween(x + 6, y - 3, x + width - 6, y - 3);
            visual.setDepth(160);

            if (animateRouteDecorations) {
                this.tweens.add({
                    targets: visual,
                    alpha: { from: 0.35, to: 0.85 },
                    duration: 900,
                    yoyo: true,
                    repeat: -1
                });
            }

            this.physics.add.overlap(this.player, hazard, () => {
                if (!this.isInvincible) {
                    this.takeDamage(1);
                }
            });
        });
    }

    createPeakReturnCurrents() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const currents = PEAK_RETURN_CURRENTS;

        currents.forEach(definition => {
            const height = definition.bottom - definition.top;
            const zone = this.add.zone(
                definition.x,
                definition.top + height / 2,
                definition.width,
                height
            );
            this.physics.add.existing(zone, true);

            const visual = this.add.graphics();
            visual.fillStyle(0x8FE3CF, 0.12);
            visual.fillRoundedRect(
                definition.x - definition.width / 2,
                definition.top,
                definition.width,
                height,
                14
            );
            visual.lineStyle(2, 0x8FE3CF, 0.72);
            visual.lineBetween(
                definition.x,
                definition.bottom - 18,
                definition.x,
                definition.top + 24
            );
            for (let y = definition.bottom - 55; y > definition.top + 35; y -= 58) {
                visual.strokeTriangle(
                    definition.x - 14,
                    y + 10,
                    definition.x,
                    y - 8,
                    definition.x + 14,
                    y + 10
                );
            }
            visual.setDepth(130);

            const label = this.add.text(
                definition.x,
                definition.bottom - 68,
                'UPDRAFT',
                {
                    fontSize: '11px',
                    color: '#8FE3CF',
                    fontStyle: 'bold',
                    stroke: '#09030E',
                    strokeThickness: 4,
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(185);

            const current = {
                ...definition,
                zone,
                visual,
                label,
                activations: 0,
                lastLiftAt: Number.NEGATIVE_INFINITY
            };
            this.physics.add.overlap(this.player, zone, () => {
                this.activatePeakReturnCurrent(current);
            });
            if (animateRouteDecorations) {
                this.tweens.add({
                    targets: visual,
                    alpha: { from: 0.55, to: 1 },
                    duration: 720,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            this.peakReturnCurrents.push(current);
        });
    }

    activatePeakReturnCurrent(current) {
        if (
            !current ||
            !this.player?.body ||
            this.isPlayerDead ||
            this.activePeakReturnCurrent
        ) return false;

        const body = this.player.body;
        const grounded = body.blocked.down || this.isGrounded;
        const descendingIntoCurrent = body.velocity.y >= -20;
        const inLaunchBand = body.bottom >=
            current.bottom - PEAK_RETURN_CURRENT_LAUNCH_BAND;
        const now = Number(this.time?.now) || 0;

        if ((!grounded && !descendingIntoCurrent) || !inLaunchBand) return false;
        if (now - current.lastLiftAt < 650) return false;

        current.activations += 1;
        current.lastLiftAt = now;
        this.showFloatingText(
            'Back up!',
            current.x,
            this.player.y - 55,
            '#8FE3CF'
        );

        const horizontalCorrection = Phaser.Math.Clamp(
            (current.x - this.player.x) * 2.4,
            -85,
            85
        );
        const launchVelocity = calculateBallisticLaunchVelocity({
            gravityY: this.gravityY,
            rise: current.bottom - current.top - 20,
            minimumSpeed: 330
        });
        this.player.setVelocityX(horizontalCorrection);
        this.player.setVelocityY(Math.max(launchVelocity, -470));
        this.activePeakReturnCurrent = {
            id: current.id,
            destinationId: current.destinationId,
            phase: 'lift',
            expiresAt: now + 3600
        };
        return true;
    }

    updatePeakReturnCurrentGuidance() {
        const active = this.activePeakReturnCurrent;
        const body = this.player?.body;
        if (!active || !body) return false;
        if (this.isPlayerDead || this.isRespawning) {
            this.activePeakReturnCurrent = null;
            return false;
        }

        if (this.isPlayerSettledOnTraversalSupport(active.destinationId)) {
            this.activePeakReturnCurrent = null;
            return true;
        }

        const now = Number(this.time?.now) || 0;
        const destination = this.getTraversalSupport(active.destinationId);
        if (!destination?.body || now >= active.expiresAt) {
            this.activePeakReturnCurrent = null;
            return false;
        }

        const targetX = Phaser.Math.Clamp(
            destination.x,
            destination.body.left + 42,
            destination.body.right - 42
        );
        const correction = Phaser.Math.Clamp(
            (targetX - this.player.x) * 1.35,
            -150,
            150
        );
        if (Math.abs(targetX - this.player.x) > 8) {
            this.player.setVelocityX(correction);
        }
        if (active.phase === 'lift') {
            if (body.bottom > destination.body.top - 70) {
                this.player.setVelocityY(Math.min(body.velocity.y, -330));
            } else {
                active.phase = 'settle';
                this.player.setVelocityY(Math.max(body.velocity.y, 35));
            }
        } else if (body.velocity.y < 25) {
            this.player.setVelocityY(25);
        }
        return true;
    }

    createPeakEnemies() {
        this.peakEncounterRhythm = PEAK_ENCOUNTER_PLAN.map((encounter, index) => {
            const support = this.getTraversalSupport(encounter.supportId);
            if (!support?.body) {
                throw new Error(
                    `[VoidPeaksLevel] Missing encounter support ${encounter.supportId}`
                );
            }

            const bodyInset = 28;
            const centerX = (support.body.left + support.body.right) / 2;
            const x = Phaser.Math.Clamp(
                centerX + (Number(encounter.offsetX) || 0),
                support.body.left + bodyInset,
                support.body.right - bodyInset
            );
            const availablePatrol = Math.max(0, Math.min(
                x - support.body.left - bodyInset,
                support.body.right - bodyInset - x
            ));
            const patrolRange = Math.min(encounter.patrolRange, availablePatrol);
            const textureKey = `voidPeakSentinel_${index}`;
            const bodyColor = encounter.health === 1
                ? 0x275B68
                : encounter.health >= 3
                    ? 0x4B0082
                    : 0x8B3658;
            this.createSentinelTexture(textureKey, bodyColor);

            const enemy = this.physics.add.sprite(
                x,
                support.body.top - 36,
                textureKey
            );
            enemy.setCollideWorldBounds(true);
            enemy.setBounce(0.05);
            enemy.body.setSize(PATROL_SENTINEL_FRAME.bodyWidth, PATROL_SENTINEL_FRAME.bodyHeight, true);
            enemy.health = encounter.health;
            enemy.maxHealth = encounter.health;
            enemy.enemyType = 'voidPeakSentinel';
            enemy.encounterBeat = encounter.beat;
            enemy.encounterLane = encounter.lane;
            enemy.encounterSupportId = encounter.supportId;
            enemy.patrolMin = x - patrolRange;
            enemy.patrolMax = x + patrolRange;
            enemy.patrolSpeed = encounter.speed;
            enemy.setVelocityX(index % 2 === 0 ? encounter.speed : -encounter.speed);
            enemy.setDepth(850);
            enemy.peakProximityActive = null;

            this.configureEnemyCombat(enemy, {
                role: encounter.health >= 3 ? 'armored' : 'stompable',
                maxHealth: encounter.health,
                stompDamage: 1,
                cueOffsetY: -62
            });

            this.enemies.add(enemy);
            this.physics.add.collider(enemy, this.platforms);
            return enemy;
        });

        this.startPeakEnemyScheduler();
        return this.peakEncounterRhythm;
    }

    retirePeakPatrolsForTitan() {
        const patrols = [...(this.enemies?.getChildren?.() || [])];
        this.peakEnemyAISchedulerActive = false;
        this.peakProximityEnemies = [];
        this.peakEnemyActivationBounds = null;
        const retirement = this.retireRouteEnemies(patrols);
        this.peakEncounterRhythm = [];
        this.peakEnemyPatrolNextAt = 0;
        return retirement.enemyCount;
    }

    startPeakEnemyScheduler() {
        this.peakEnemyAISchedulerActive = true;
        this.peakEnemyActivationNextAt = 0;
        this.peakEnemyPatrolNextAt = 0;
        this.peakEnemyPatrolUpdateCount = 0;
        this.updatePeakEnemyActivation(true);
    }

    getPeakEnemyActivationBounds() {
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

    setPeakEnemyRenderAttached(enemy, attached) {
        if (!enemy || !this.children) return 0;
        const targets = [
            enemy,
            enemy.combatCue,
            enemy.instructionLabel
        ].filter(target => Boolean(target) && target.active !== false);
        let changedCount = 0;
        targets.forEach(target => {
            const isAttached = target.displayList === this.children;
            if (attached && !isAttached) {
                this.children.add(target);
                changedCount += 1;
            } else if (!attached && isAttached) {
                this.children.remove(target);
                changedCount += 1;
            }
        });
        return changedCount;
    }

    setPeakEnemyProximityActive(enemy, enabled) {
        if (!enemy?.active || !enemy.body) return false;
        const nextState = enabled === true;
        if (enemy.peakProximityActive === nextState) return nextState;

        const firstActivationDecision = enemy.peakProximityActive == null;
        enemy.peakProximityActive = nextState;
        if (nextState) {
            this.setPeakEnemyRenderAttached(enemy, true);
            enemy.setVisible(true);
            enemy.body.enable = true;
            enemy.body.updateFromGameObject?.();
            const patrolSpeed = Math.max(25, Number(enemy.patrolSpeed) || 42);
            enemy.setVelocityX(enemy.flipX ? -patrolSpeed : patrolSpeed);
        } else {
            if (firstActivationDecision) {
                const support = this.getTraversalSupport(
                    enemy.encounterSupportId
                );
                if (support?.body) {
                    enemy.setY(
                        support.body.top -
                        (Number(enemy.body.halfHeight) || 0)
                    );
                }
            }
            enemy.setVelocity?.(0, 0);
            enemy.body.updateFromGameObject?.();
            enemy.body.enable = false;
            enemy.setVisible(false);
            enemy.combatCue?.setVisible?.(false);
            enemy.instructionLabel?.setVisible?.(false);
            this.setPeakEnemyRenderAttached(enemy, false);
        }
        return nextState;
    }

    updatePeakEnemyActivation(force = false) {
        if (!this.peakEnemyAISchedulerActive || !this.scene.isActive()) return 0;
        const now = Number(this.time?.now) || 0;
        if (!force && now < this.peakEnemyActivationNextAt) {
            return this.peakProximityEnemies.length;
        }
        this.peakEnemyActivationNextAt = now + (this.isMobile ? 120 : 80);

        const bounds = this.getPeakEnemyActivationBounds();
        const nearby = [];
        (this.enemies?.getChildren?.() || []).forEach(enemy => {
            if (!enemy?.active || !enemy.body) return;
            const shouldWake =
                enemy.x >= bounds.left &&
                enemy.x <= bounds.right &&
                enemy.y >= bounds.top &&
                enemy.y <= bounds.bottom;
            this.setPeakEnemyProximityActive(enemy, shouldWake);
            if (shouldWake) nearby.push(enemy);
        });
        this.peakProximityEnemies = nearby;
        this.peakEnemyActivationBounds = bounds;
        return nearby.length;
    }

    getRuntimePatrolEnemies() {
        if (!this.peakEnemyAISchedulerActive) {
            return super.getRuntimePatrolEnemies();
        }
        return this.peakProximityEnemies;
    }

    updatePatrolEnemyMovement() {
        if (!this.peakEnemyAISchedulerActive) {
            return super.updatePatrolEnemyMovement();
        }
        return this.updatePeakEnemyPatrols(this.time?.now);
    }

    updatePeakEnemyPatrols(time) {
        const now = Number(time) || 0;
        if (now < this.peakEnemyPatrolNextAt) return true;
        this.peakEnemyPatrolNextAt = now + (this.isMobile ? 80 : 40);
        this.peakEnemyPatrolUpdateCount += 1;
        return super.updatePatrolEnemyMovement();
    }

    createSentinelTexture(textureKey, color) {
        this.createPatrolSentinelTexture(textureKey, {
            bodyColor: color,
            accentColor: 0x9400D3,
            eyeColor: 0xFFFFFF
        });
    }

    createStarFragments() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const positions = PEAK_FRAGMENTS;

        positions.forEach(([x, y, optionalRouteId], index) => {
            const fragment = this.add.star(x, y, 5, 7, 18, 0xFFD700, 1);
            fragment.setDepth(700);
            this.physics.add.existing(fragment);
            this.collectibles.add(fragment);
            fragment.body.setAllowGravity(false);
            fragment.body.setVelocity(0, 0);
            fragment.body.setSize(32, 32);
            fragment.fragmentIndex = index;
            fragment.optionalRouteId = optionalRouteId || null;

            if (animateRouteDecorations) {
                this.tweens.add({
                    targets: fragment,
                    angle: 360,
                    y: y - 12,
                    duration: 1600,
                    repeat: -1,
                    yoyo: true
                });
            }
        });
    }

    createHUD() {
        super.createHUD();
        this.createCampaignObjectiveDisplay(
            () => this.getPeakObjectiveText(),
            {
                color: '#F8F2FF',
                backgroundColor: 'rgba(12, 4, 22, 0.92)'
            }
        );
    }

    getPeakObjectiveText() {
        if (this.bossDefeated) return 'THE MOUNTAIN IS FREE';
        if (this.bossFightActive) return 'FREE THE MOUNTAIN';
        if (this.creatureNetworkReached) return 'SUMMIT AHEAD';
        return `REACH THE SUMMIT  ${this.beaconRelaysActivated}/3`;
    }

    createSignalRelays() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const relays = PEAK_RELAYS;

        relays.forEach((relay, index) => {
            const visual = this.add.graphics();
            visual.setDepth(180);
            this.drawSignalRelay(visual, relay.x, relay.y, false);

            const label = this.add.text(relay.x, relay.y - 94, `${index + 1} / 3`, {
                fontSize: '11px',
                color: '#7E718A',
                fontStyle: 'bold',
                stroke: '#09030E',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setDepth(181);

            const support = this.getTraversalSupport(relay.activationSupportIds[0]);
            const zone = this.createObjectiveTriggerZone(
                support.x,
                relay.y - 35,
                { width: support.body.width, height: 190 }
            );

            const beacon = {
                ...relay,
                index,
                visual,
                label,
                zone,
                landingGuide: this.createTraversalLandingGuide(
                    relay.activationSupportIds[0],
                    0xFF8A4C,
                    { animate: animateRouteDecorations }
                ),
                activated: false
            };
            this.physics.add.overlap(this.player, zone, () => {
                if (!this.isPlayerGroundedOnTraversalSupport(
                    beacon.activationSupportIds
                )) {
                    const now = this.time.now;
                    if (now >= this.routeHintUntil) {
                        this.showFloatingText(
                            'Land by the light',
                            beacon.x,
                            beacon.y - 125,
                            '#F2C94C'
                        );
                        this.routeHintUntil = now + 1400;
                    }
                    return;
                }
                this.activateSignalRelay(beacon);
            });
            this.beaconRelays.push(beacon);
        });

        this.refreshSignalRouteReadability();
    }

    getTraversalAuditTargets() {
        return [
            ...this.beaconRelays,
            {
                id: 'titan_pass',
                label: 'TITAN PASS',
                activationSupportIds: ['peak-titan-gate'],
                x: this.titanGate?.x || TITAN_ARENA.playerEntryX,
                y: this.titanGate?.y || MOUNTAIN_ASCENT.summitY - 65,
                zone: this.titanGate
            }
        ];
    }

    drawSignalRelay(graphics, x, y, activated) {
        graphics.clear();
        const color = activated ? 0x8FE3CF : 0xF2C94C;

        graphics.fillStyle(color, activated ? 0.22 : 0.1);
        graphics.fillCircle(x, y - 35, 42);
        graphics.lineStyle(4, color, 1);
        graphics.lineBetween(x, y + 20, x, y - 38);
        graphics.lineBetween(x, y + 20, x - 18, y + 38);
        graphics.lineBetween(x, y + 20, x + 18, y + 38);
        graphics.strokeCircle(x, y - 44, 18);
        graphics.fillStyle(color, 0.95);
        graphics.fillCircle(x, y - 44, 7);

        if (activated) {
            graphics.lineStyle(2, 0x8FE3CF, 0.65);
            graphics.strokeCircle(x, y - 44, 30);
            graphics.strokeCircle(x, y - 44, 39);
        }
    }

    activateSignalRelay(relay) {
        if (!relay || relay.activated) return;

        if (!this.canActivateOrderedRouteSignal(
            relay,
            this.beaconRelays,
            this.beaconRelaysActivated,
            {
                fallbackLabel: 'FOLLOW THE WARNING LINE',
                hintOffsetY: -120
            }
        )) {
            return;
        }

        relay.activated = true;
        relay.zone?.destroy?.();
        relay.zone = null;
        this.beaconRelaysActivated++;
        this.drawSignalRelay(relay.visual, relay.x, relay.y, true);
        relay.label?.setVisible?.(false);
        this.retireTraversalLandingGuide(relay);
        this.refreshSignalRouteReadability();
        const checkpoint = this.getTraversalSupportCheckpoint(
            relay.activationSupportIds[0],
            relay.x
        );
        this.setCheckpoint(checkpoint.x, checkpoint.y, {
            persist: true,
            checkpointId: relay.id,
            checkpointIndex: relay.index
        });

        if (this.beaconRelaysActivated < 3) {
            this.showFloatingText(
                'Climb saved',
                relay.x,
                relay.y - 120,
                '#8FE3CF'
            );
        }

        const companionName = this.getCompanionName();
        if (this.beaconRelaysActivated === 1) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    `${companionName}: "The mountain can feel us."`,
                    relay.x,
                    relay.y - 155,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconRelaysActivated === 2) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    '"Keep climbing. We need your help!"',
                    relay.x,
                    relay.y - 155,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconRelaysActivated === 3) {
            this.creatureNetworkReached = true;
            if (!this.playCreatureWarningResponse(relay)) {
                this.showDistantReplyNetwork(relay);
            }
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'creature_warning_network_reached'
            });
        }

        window.AudioManager?.playAchievement?.();
    }

    refreshSignalRouteReadability() {
        return this.refreshOrderedRouteSignals(
            this.beaconRelays,
            this.beaconRelaysActivated
        );
    }

    createPeakRouteChoiceMarkers() {
        const spine = this.add.text(2850, 1160, '', {
            fontSize: '12px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(182);

        const relicRoute = this.add.text(2525, 1055, '', {
            fontSize: '11px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);

        this.registerOptionalRouteReward({
            id: 'peaks_relic_ridge',
            title: 'HIGH RIDGE',
            required: 2,
            rewardLabel: 'RIDGE GUARD // 1 HIT',
            marker: relicRoute,
            returnLabel: 'WARNING LINE →',
            choice: {
                mainLabel: 'QUICK CLIMB',
                mainTradeoff: 'Extra blast',
                challengeLabel: 'EXTRA SHIELD',
                mainMarker: spine,
                mainZone: {
                    left: 2780, right: 3420,
                    top: 1040, bottom: 1500
                },
                mainSupportIds: [
                    'peak-main-handoff',
                    'peak-floor-summit'
                ],
                optionalZone: {
                    left: 2640, right: 3580,
                    top: 680, bottom: 1110
                },
                optionalSupportIds: ['peak-relic-ridge-1'],
                rejoinZone: {
                    left: 3580, right: 4100,
                    top: 730, bottom: 960
                },
                rejoinSupportIds: ['peak-summit-relay']
            },
            onMainSelected: () => this.selectPeakRoute('main'),
            onOptionalSelected: () => this.selectPeakRoute('optional'),
            onComplete: () => {
                this.grantOptionalRouteGuard('RIDGE GUARD', 1);
                this.refreshPersistedExpeditionRouteState();
            }
        });

        if (this.shouldAnimatePeakRouteDecorations()) {
            this.tweens.add({
                targets: [spine, relicRoute],
                alpha: { from: 0.68, to: 1 },
                duration: 900,
                yoyo: true,
                repeat: -1
            });
        } else {
            spine.setAlpha(0.9);
            relicRoute.setAlpha(0.9);
        }
    }

    refreshOptionalRouteReward(routeOrId) {
        const refreshed = super.refreshOptionalRouteReward(routeOrId);
        const route = typeof routeOrId === 'string'
            ? this.optionalRouteRewards.get(routeOrId) : routeOrId;
        if (route?.id === 'peaks_relic_ridge') {
            const visible = !route.choice?.selectedPath;
            route.marker?.setText('HIGH RIDGE\nExtra shield').setVisible(visible);
            route.choice?.mainMarker?.setText('QUICK CLIMB\nExtra blast').setVisible(visible);
        }
        return refreshed;
    }

    restoreExpeditionRouteState(resume) {
        const signalsRestored = this.restoreExpeditionRouteSignals(resume, {
            signals: this.beaconRelays,
            countProperty: 'beaconRelaysActivated',
            readyProperty: 'creatureNetworkReached',
            drawSignal: relay => {
                this.drawSignalRelay(relay.visual, relay.x, relay.y, true);
                this.retireTraversalLandingGuide(relay);
            },
            onRestored: (relay, restoredCount) => {
                this.refreshSignalRouteReadability();
                if (restoredCount === this.beaconRelays.length) {
                    this.showDistantReplyNetwork(relay, { announce: false });
                }
                this.syncCampaignObjectiveDisplay();
            }
        });
        if (!signalsRestored) return false;

        this.restorePeakRouteState(resume.routeState, {
            rejoined: Number(resume.checkpointIndex) >= 2
        });
        this.syncCampaignObjectiveDisplay();
        return true;
    }

    restorePersistedExpeditionCheckpoint() {
        const restored = super.restorePersistedExpeditionCheckpoint();
        if (!restored) return false;
        const supportId = peakCheckpointSupport(this.checkpointPosition?.id);
        if (supportId) {
            // Base restoration moves the sprite before Arcade's next update.
            // Synchronize first so clearance is measured from the same position.
            this.player.body?.updateFromGameObject?.();
            const point = this.getTraversalSupportCheckpoint(supportId, this.checkpointPosition.x);
            this.checkpointPosition = { ...this.checkpointPosition, ...point };
            this.player.setPosition(point.x, point.y);
            this.player.body?.updateFromGameObject?.();
            this.player.setVelocity?.(0, 0);
        }
        return true;
    }

    getExpeditionRouteState() {
        const route = this.optionalRouteRewards?.get?.('peaks_relic_ridge');
        return {
            peakRouteChoice: this.peakRouteChoice || '',
            peakFragmentMask: this.peakCollectedFragmentMask,
            relicRidgeProgress: Number(route?.progress) || 0,
            relicRidgeCompleted: route?.completed === true,
            titanSurgeCharges: this.peakRouteChoice === 'main'
                ? this.freeSpecialAttackCharges
                : 0,
            ridgeGuardCharges: this.peakRouteChoice === 'optional'
                ? this.optionalRouteGuardCharges
                : 0,
            peakSignalEggAwarded: this.cosmicEggAwarded === true
        };
    }

    selectPeakRoute(path, { restoring = false, rejoined = false } = {}) {
        if (!['main', 'optional'].includes(path)) return false;
        if (this.peakRouteChoice && this.peakRouteChoice !== path) return false;

        const firstSelection = !this.peakRouteChoice;
        this.peakRouteChoice = path;
        const choice = this.optionalRouteRewards?.get?.('peaks_relic_ridge')?.choice;
        if (choice) {
            choice.selectedPath = path;
            choice.mainEntered = path === 'main';
            choice.optionalEntered = path === 'optional';
            choice.rejoined = rejoined && path === 'optional';
            choice.sequence ||= 1;
        }
        if (path === 'main') {
            this.retireUnavailablePeakRouteFragments();
            if (!restoring && firstSelection) {
                this.freeSpecialAttackCharges += 1;
            }
        }
        if (!restoring) this.refreshPersistedExpeditionRouteState();
        this.refreshOptionalRouteReward?.('peaks_relic_ridge');
        return true;
    }

    restorePeakRouteState(routeState, { rejoined = false } = {}) {
        if (!routeState || typeof routeState !== 'object') return false;

        const path = routeState.peakRouteChoice;
        if (['main', 'optional'].includes(path)) {
            this.selectPeakRoute(path, { restoring: true, rejoined });
        }

        this.peakCollectedFragmentMask = Phaser.Math.Clamp(
            Math.floor(Number(routeState.peakFragmentMask) || 0),
            0,
            (1 << this.totalStarFragments) - 1
        );
        this.starFragmentsCollected = this.countCollectedPeakFragments();
        this.cosmicEggAwarded = routeState.peakSignalEggAwarded === true ||
            this.hasPeakSignalEgg();
        this.retireCollectedPeakFragments();

        const route = this.optionalRouteRewards?.get?.('peaks_relic_ridge');
        if (path === 'main') {
            const persistedSurgeCharges = Number(routeState.titanSurgeCharges);
            this.freeSpecialAttackCharges = Phaser.Math.Clamp(
                Number.isFinite(persistedSurgeCharges)
                    ? persistedSurgeCharges
                    : 1,
                0,
                10
            );
        } else if (route && path === 'optional') {
            route.progress = Phaser.Math.Clamp(
                Number(routeState.relicRidgeProgress) || 0,
                0,
                route.required
            );
            route.completed = routeState.relicRidgeCompleted === true ||
                route.progress >= route.required;
            this.refreshOptionalRouteReward(route);
            this.optionalRouteGuardLabel = 'RIDGE GUARD';
            this.optionalRouteGuardCharges = Phaser.Math.Clamp(
                Number(routeState.ridgeGuardCharges) || 0,
                0,
                1
            );
        }

        if (
            this.starFragmentsCollected >= this.totalStarFragments &&
            !this.cosmicEggAwarded &&
            this.awardPeakSignalEgg()
        ) {
            this.refreshPersistedExpeditionRouteState();
        }
        return true;
    }

    retireUnavailablePeakRouteFragments() {
        [...(this.collectibles?.getChildren?.() || [])].forEach(item => {
            if (item?.optionalRouteId === 'peaks_relic_ridge') {
                item.destroy?.();
            }
        });
    }

    countCollectedPeakFragments() {
        let count = 0;
        for (let index = 0; index < this.totalStarFragments; index += 1) {
            if ((this.peakCollectedFragmentMask & (1 << index)) !== 0) count++;
        }
        return count;
    }

    retireCollectedPeakFragments() {
        const fragments = [...(this.collectibles?.getChildren?.() || [])];
        fragments.forEach(item => {
            if (
                item?.fragmentIndex !== undefined &&
                (this.peakCollectedFragmentMask & (1 << item.fragmentIndex)) !== 0
            ) {
                item.destroy?.();
            }
        });
    }

    hasPeakSignalEgg() {
        return window.InventoryManager?.getAllItems?.().some(
            item => item?.id === 'peak_signal_egg'
        ) === true;
    }

    awardPeakSignalEgg() {
        if (this.cosmicEggAwarded || this.hasPeakSignalEgg()) {
            this.cosmicEggAwarded = true;
            return true;
        }
        const awarded = window.InventoryManager?.addItem?.({
            id: 'peak_signal_egg',
            name: 'Strange Egg',
            type: 'egg',
            rarity: 'rare',
            description: 'An egg warmed by the warning calls exchanged across the Void Peaks.',
            icon: '🥚📡'
        }) === true;
        if (awarded) this.cosmicEggAwarded = true;
        return awarded;
    }

    onOptionalRouteGuardConsumed() {
        if (this.peakRouteChoice === 'optional') {
            this.refreshPersistedExpeditionRouteState();
        }
    }

    onFreeSpecialAttackConsumed() {
        if (this.peakRouteChoice === 'main') {
            this.refreshPersistedExpeditionRouteState();
        }
    }

    drawCreatureWarningResponse(response) {
        const graphics = response?.visual;
        if (!graphics?.active) return false;

        const progress = Phaser.Math.Clamp(Number(response.progress) || 0, 0, 1);
        const travel = Phaser.Math.Clamp(progress / 0.72, 0, 1);
        const answer = Phaser.Math.Clamp((progress - 0.58) / 0.42, 0, 1);
        graphics.clear();

        const segmentCount = 14;
        let previousPoint = null;
        for (let index = 0; index <= segmentCount; index += 1) {
            const pathProgress = index / segmentCount;
            if (pathProgress > travel) break;
            const bend = Math.sin(pathProgress * Math.PI) * -42;
            const x = Phaser.Math.Linear(
                response.sourceX,
                response.targetX,
                pathProgress
            );
            const y = Phaser.Math.Linear(
                response.sourceY,
                response.targetY,
                pathProgress
            ) + bend;
            const width = 34 - pathProgress * 12;
            if (previousPoint) {
                graphics.lineStyle(width * 0.62, 0xFFB15C, 0.38);
                graphics.lineBetween(previousPoint.x, previousPoint.y, x, y);
                graphics.lineStyle(width * 0.22, 0x8FE3CF, 0.92);
                graphics.lineBetween(previousPoint.x, previousPoint.y, x, y);
            }
            graphics.fillStyle(0xFFE0A3, 0.72);
            graphics.fillEllipse(x, y, width * 0.42, width * 0.26);
            previousPoint = { x, y };
        }

        if (answer > 0) {
            const spread = 28 + answer * 48;
            graphics.fillStyle(0x8FE3CF, 0.15 + answer * 0.18);
            graphics.fillEllipse(
                response.targetX,
                response.targetY,
                58 + answer * 54,
                48 + answer * 42
            );
            graphics.fillStyle(0xF2C94C, 0.55 + answer * 0.35);
            graphics.fillEllipse(
                response.targetX - spread * 0.52,
                response.targetY - spread * 0.38,
                18,
                30
            );
            graphics.fillEllipse(
                response.targetX + spread * 0.12,
                response.targetY - spread * 0.58,
                16,
                34
            );
            graphics.fillEllipse(
                response.targetX + spread * 0.58,
                response.targetY - spread * 0.3,
                18,
                28
            );
        }
        response.label?.setText?.(
            answer > 0
                ? 'THE RIDGE ANSWERS'
                : `${this.getCompanionName()} SENDS THE WARNING`
        );
        return true;
    }

    playCreatureWarningResponse(relay) {
        const body = this.player?.body;
        if (!relay?.visual?.active || !body) return false;

        this.clearCreatureWarningResponse();
        const response = {
            relayId: relay.id,
            sourceX: body.center.x,
            sourceY: body.bottom,
            targetX: relay.x,
            targetY: relay.y - 44,
            progress: 0,
            stage: 'sending',
            settled: false,
            previousAllowGravity: body.allowGravity !== false,
            visual: this.add.graphics().setDepth(184),
            label: this.add.text(
                Phaser.Math.Linear(body.center.x, relay.x, 0.5) - 36,
                Phaser.Math.Linear(body.bottom, relay.y - 44, 0.5),
                '',
                {
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: '#FFF2C7',
                    backgroundColor: 'rgba(9, 3, 14, 0.88)',
                    padding: { x: 8, y: 5 },
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(185)
        };
        body.allowGravity = false;
        this.recoveryInputLockedUntil = Math.max(
            Number(this.recoveryInputLockedUntil) || 0,
            (Number(this.time?.now) || 0) + 1600
        );
        this.player?.setVelocityX?.(0);
        this.player?.setVelocityY?.(0);
        if (this.cameras?.main?.width <= 480) {
            response.controlAlphas = this.mobileControlElements
                ?.filter(element => element?.active && Number.isFinite(element.alpha))
                .map(element => ({ element, alpha: element.alpha })) || [];
            response.controlAlphas.forEach(({ element }) => {
                element.setAlpha?.(Math.min(element.alpha, 0.24));
            });
        }
        const follower = this.astronautFollower;
        if (follower?.sprite?.active) {
            response.previousAstronautFormation = follower.contextualFormation
                ? { ...follower.contextualFormation }
                : null;
            const witnessOffsetX = body.center.x <= relay.x ? -72 : 72;
            follower.setContextualFormation?.(
                { x: witnessOffsetX, y: 0 },
                'peaks_warning_witness'
            );
            follower.resetTrail?.();
            const followerAnchor = follower.getTargetAnchor?.() || {
                x: body.center.x,
                y: this.player?.y || body.center.y
            };
            follower.sprite.setPosition(
                followerAnchor.x + witnessOffsetX,
                followerAnchor.y
            );
        }
        this.creatureWarningResponse = response;
        this.warningReplyCameraFocusUntil = (Number(this.time?.now) || 0) + 1850;
        this.drawCreatureWarningResponse(response);
        this.creatureWarningResponseTween = this.tweens.add({
            targets: response,
            progress: 1,
            duration: 1600,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                const currentBody = this.player?.body;
                if (currentBody && response.progress < 0.65) {
                    response.sourceX = currentBody.center.x;
                    response.sourceY = currentBody.bottom;
                }
                response.stage = response.progress < 0.58
                    ? 'sending'
                    : 'answering';
                this.drawCreatureWarningResponse(response);
            },
            onComplete: () => {
                response.progress = 1;
                response.stage = 'settled';
                response.settled = true;
                this.drawCreatureWarningResponse(response);
                this.showDistantReplyNetwork(relay);
                this.restoreCreatureWarningPresentation(response);
                this.creatureWarningResponseTween = null;
            }
        });
        return true;
    }

    getCreatureWarningResponseSnapshot() {
        const response = this.creatureWarningResponse;
        if (!response) return null;
        return {
            relayId: response.relayId,
            sourceX: response.sourceX,
            sourceY: response.sourceY,
            targetX: response.targetX,
            targetY: response.targetY,
            progress: Number(response.progress) || 0,
            stage: response.stage,
            settled: response.settled === true,
            visualActive: response.visual?.active === true,
            replyCount: this.replySignals.length
        };
    }

    restoreCreatureWarningPresentation(response) {
        if (this.player?.body && response?.previousAllowGravity != null) {
            this.player.body.allowGravity = response.previousAllowGravity;
        }
        response?.controlAlphas?.forEach(({ element, alpha }) => {
            if (element?.active) element.setAlpha?.(alpha);
        });
        if (
            this.astronautFollower?.contextualFormation?.context ===
            'peaks_warning_witness'
        ) {
            this.astronautFollower.setContextualFormation?.(
                response?.previousAstronautFormation || null,
                response?.previousAstronautFormation?.context || null
            );
        }
        if (response) response.controlAlphas = [];
    }

    clearCreatureWarningResponse() {
        this.restoreCreatureWarningPresentation(this.creatureWarningResponse);
        this.creatureWarningResponseTween?.remove?.();
        this.creatureWarningResponseTween = null;
        this.creatureWarningResponse?.visual?.destroy?.();
        this.creatureWarningResponse?.label?.destroy?.();
        this.creatureWarningResponse = null;
    }

    showDistantReplyNetwork(relay, { announce = true } = {}) {
        const lineLayer = this.add.graphics();
        lineLayer.setDepth(175);
        lineLayer.lineStyle(2, 0x8FE3CF, 0.42);

        const replies = [
            { x: 3920, y: 190 },
            { x: 4210, y: 260 },
            { x: 4520, y: 155 }
        ];
        replies.forEach(reply => {
            lineLayer.lineBetween(relay.x, relay.y - 44, reply.x, reply.y);
            const signal = this.add.circle(reply.x, reply.y, 9, 0x8FE3CF, 0.9);
            signal.setDepth(176);
            this.tweens.add({
                targets: signal,
                scale: { from: 0.75, to: 1.45 },
                alpha: { from: 0.45, to: 1 },
                duration: 900,
                yoyo: true,
                repeat: -1
            });
            this.replySignals.push(signal);
        });
        this.replySignals.push(lineLayer);

        if (announce) {
            this.time.delayedCall(600, () => {
                this.showFloatingText('It heard us!', relay.x, relay.y - 150, '#F2C94C');
            });
        }
    }

    createTitanGate() {
        const x = TITAN_ARENA.playerEntryX;
        const y = MOUNTAIN_ASCENT.summitY - 65;
        // A jump can land beyond the entrance marker. Any grounded summit
        // landing must wake the boss, not only walking through that marker.
        const gate = this.add.zone(
            MOUNTAIN_ASCENT.summitX + MOUNTAIN_ASCENT.summitWidth / 2,
            y,
            MOUNTAIN_ASCENT.summitWidth,
            130
        );
        this.physics.add.existing(gate, true);
        this.titanGate = gate;

        this.createGuardianGateState({
            x,
            y,
            title: 'MOUNTAIN SUMMIT',
            getStatus: () => 'LIGHT 3 WARNING BEACONS',
            isReady: () => this.creatureNetworkReached,
            color: 0xFF4500,
            readyColor: 0x8FE3CF
        });
        const titanLandingGuide = this.createTraversalLandingGuide(
            'peak-titan-gate',
            0xF2C94C,
            { animate: this.shouldAnimatePeakRouteDecorations() }
        );

        this.physics.add.overlap(this.player, gate, () => {
            if (!this.bossFightActive && !this.bossDefeated) {
                if (!this.isPlayerGroundedOnTraversalSupport('peak-titan-gate')) {
                    const now = this.time.now;
                    if (now >= this.bossGateHintUntil) {
                        this.showFloatingText(
                            'Follow the stone steps to the summit',
                            this.player.x,
                            this.player.y - 70,
                            '#F2C94C'
                        );
                        this.bossGateHintUntil = now + 1400;
                    }
                    return;
                }
                if (!this.creatureNetworkReached) {
                    const now = this.time.now;
                    if (now >= this.bossGateHintUntil) {
                        this.showFloatingText(
                            'Light all 3 warning beacons first.',
                            this.player.x,
                            this.player.y - 70,
                            '#F2C94C'
                        );
                        this.bossGateHintUntil = now + 1800;
                    }
                    return;
                }
                const guardianEntered = this.beginGuardianEncounter({
                    id: 'cosmic_titan',
                    title: MOUNTAIN_BOSS_NAME.toUpperCase(),
                    checkpoint: this.getTraversalSupportCheckpoint(
                        'peak-titan-gate',
                        TITAN_ARENA.playerEntryX
                    ),
                    start: () => this.startBossFight()
                });
                if (guardianEntered) {
                    titanLandingGuide?.tween?.remove?.();
                    titanLandingGuide?.visual?.setAlpha?.(0.18);
                    gate.destroy();
                    this.titanGate = null;
                }
            }
        });
    }

    createBossArena() {
        this.createTitanTexture();
        this.mountainAwake = false;
        this.mountainBody = this.add.image(MOUNTAIN_ASCENT.faceX, MOUNTAIN_ASCENT.faceY, COSMIC_TITAN_TEXTURE)
            .setOrigin(MOUNTAIN_ASCENT.originX, MOUNTAIN_ASCENT.originY)
            .setScale(MOUNTAIN_ASCENT.displayHeight / this.textures.get(COSMIC_TITAN_TEXTURE).getSourceImage().height)
            .setTint(0x829BAC).setDepth(190);
        const stone = this.add.graphics().setDepth(850);
        this.mountainStone = stone;
        this.mountainSupports = [];
        mountainSteps().forEach((step, index) => {
            const platform = this.createPlatform(step.x, step.y, step.width, step.height, 'solid');
            platform.traversalId = step.id;
            platform.mountainStair = true;
            platform.setVisible(false);
            platform.removeFromDisplayList();
            this.mountainSupports.push(platform);
            // Joined basalt, not floating ledges: every riser extends into the body.
            stone.fillStyle(index % 3 === 0 ? 0x30444C : 0x182930, 0.98);
            stone.fillRect(step.x, step.y, step.width, Math.min(56, step.height));
            stone.fillStyle(0x457785, 0.4);
            stone.fillTriangle(step.x + 2, step.y + 5, step.x + 13, step.y + 12, step.x + 4, step.y + 30);
            stone.lineStyle(2, 0xC5DCEC, 0.9);
            stone.lineBetween(step.x, step.y, step.x + step.width, step.y);
            stone.lineStyle(1, index % 4 === 0 ? 0xD8AC69 : 0x5A9BA4, 0.65);
            stone.lineBetween(step.x + 3, step.y + 11, step.x + 9, step.y + 19);
            stone.lineBetween(step.x + 9, step.y + 19, step.x + 6, step.y + 28);
            if (index === 18) platform.traversalId = 'peak-titan-overlook';
        });
        const gate = this.createPlatform(MOUNTAIN_ASCENT.summitX, MOUNTAIN_ASCENT.summitY,
            MOUNTAIN_ASCENT.summitWidth, 400, 'solid');
        gate.traversalId = 'peak-titan-gate';
        gate.mountainStair = true;
        gate.setVisible(false);
        gate.removeFromDisplayList();
        this.mountainSupports.push(gate);
        stone.fillStyle(0x182930, 1);
        stone.fillPoints([
            { x: 4780, y: 400 }, { x: 5200, y: 400 }, { x: 5200, y: 800 },
            { x: 5040, y: 800 }, { x: 4960, y: 535 }, { x: 4780, y: 455 }
        ], true);
        stone.fillStyle(0x243D48, 1);
        stone.fillTriangle(4790, 422, 4950, 450, 4980, 630);
        stone.fillStyle(0x325764, 0.7);
        stone.fillTriangle(5050, 445, 5200, 425, 5100, 685);
        stone.lineStyle(3, 0xBA965E, 0.65);
        stone.lineBetween(4920, 425, 5000, 492);
        stone.lineBetween(5000, 492, 4980, 553);
        stone.lineStyle(2, 0x79CFD1, 0.55);
        stone.lineBetween(5040, 432, 5070, 530);
        stone.lineBetween(5070, 530, 5150, 608);
        stone.fillStyle(0x6B9EAA, 1);
        stone.fillRect(4780, 400, 420, 12);
        stone.lineStyle(3, 0xE2EAF0, 1);
        stone.lineBetween(4780, 400, 5200, 400);
        for (let i = 0; i < 17; i++) {
            const x = 4790 + i * 24;
            stone.lineStyle(1, i % 2 ? 0x689CAA : 0x101E27, 0.8);
            stone.lineBetween(x, 416, x + 11, 440 + i % 3 * 12);
        }
        this.mountainName = this.add.text(MOUNTAIN_ASCENT.faceX, 130,
            MOUNTAIN_BOSS_NAME.toUpperCase().replace(' OF ', '\nOF '), {
                fontSize: '17px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold', color: '#EDF5FF',
                stroke: '#17212C', strokeThickness: 4, align: 'center', wordWrap: { width: 190 }
            }).setOrigin(0.5).setDepth(851);
        this.mountainApproachLabel = this.add.text(4350, 712, 'THE PEAK OF THE MOUNTAIN\nFollow the stone steps', {
            fontSize: '13px', color: '#E5EDF4', stroke: '#0C121A', strokeThickness: 4,
            align: 'center', wordWrap: { width: 210 }
        }).setOrigin(0.5).setDepth(851);
    }

    shouldProcessPlatformCollision(player, platform) {
        if (platform.mountainStair && player === this.player) {
            const body = player.body;
            const grounded = body.blocked.down || body.touching.down ||
                (this.wasGrounded && this.time.now - this.lastGroundedTime < 100);
            const rise = mountainStepRise(body, platform.body, grounded);
            if (rise) {
                // Inside Arcade's collision pass: move the body, not the stale sprite.
                body.position.y -= rise;
                body.updateCenter();
                body.velocity.y = 0;
                body.blocked.down = true;
                body.blocked.none = false;
                return false;
            }
        }
        return super.shouldProcessPlatformCollision(player, platform);
    }

    showObjectiveToast() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const toastY = isMobileLayout
            ? (height < 620 ? Math.min(142, height * 0.38) : Math.min(225, height * 0.28))
            : 90;
        const toast = this.add.text(
            width / 2,
            toastY,
            'Follow the pale stone edges up.',
            {
            fontSize: isMobileLayout ? '15px' : '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0,0,0,0.72)',
            padding: { x: 18, y: 8 },
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2500);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            y: toastY - 20,
            delay: 2600,
            duration: 600,
            onComplete: () => toast.destroy()
        });
    }

    update(time, delta) {
        if (this.pauseMenuActive) { super.update(time, delta); return; }
        this.keepMountainArenaGrounded();
        this.updatePeakEnemyActivation();
        super.update(time, delta);
        this.updateTitanEntrance(time, delta);
        this.updateDeferredTitanCombat();
        if (this.levelCompletionActive) return;

        if (!this.mountainAwake && this.player?.x >= 4640 && this.player.body?.bottom <= 560) {
            this.mountainAwake = true;
            this.mountainBody?.clearTint();
            window.FeedbackManager?.cameraShake?.(this, 300, 0.003);
        }

        this.drawPeakEmbers(time);
        this.updatePeakReturnCurrentGuidance();

        this.syncCampaignObjectiveDisplay({
            visible: !(
                (this.isCompactObjectiveHUD && this.bossFightActive) ||
                (Number(this.time?.now) || 0) < this.warningReplyCameraFocusUntil
            )
        });
        this.updateBossIndicator();
    }

    updateCameraLead() {
        const camera = this.cameras?.main;
        if (
            this.player?.active &&
            (Number(this.time?.now) || 0) < this.warningReplyCameraFocusUntil
        ) {
            this.currentCameraLeadX = 0;
            this.targetCameraLeadX = 0;
            const phoneActionLift = camera?.width <= 480
                ? Math.min(100, camera.height * 0.12)
                : 0;
            camera?.setFollowOffset?.(
                0,
                this.cameraBaseOffsetY - phoneActionLift
            );
            return;
        }
        const keepTitanInOpeningFrame =
            this.titanOpeningCameraFraming &&
            this.bossFightActive &&
            this.bossCombatReady &&
            this.player?.active &&
            this.boss?.active &&
            (this.isMobile || camera?.width <= 480);

        if (!keepTitanInOpeningFrame) {
            super.updateCameraLead();
            return;
        }

        camera.scrollX = this.getTitanOpeningCameraCenterX(camera) -
            camera.width / 2;
    }

    getTitanOpeningCameraCenterX(camera = this.cameras?.main) {
        if (!camera || !this.player || !this.boss) return 0;
        const bossBounds = this.boss.getBounds();
        const playerBounds = this.player.getBounds();
        const astronautBounds = this.astronautFollower?.sprite?.getBounds?.() || playerBounds;
        return Phaser.Math.Clamp(
            (Math.min(bossBounds.left, playerBounds.left, astronautBounds.left) +
                Math.max(bossBounds.right, playerBounds.right, astronautBounds.right)) / 2,
            camera.width / 2,
            Math.max(camera.width / 2, this.levelWidth - camera.width / 2)
        );
    }

    releaseTitanOpeningCameraFraming(camera = this.cameras?.main) {
        if (!this.titanOpeningCameraFraming || !camera || !this.player) return;

        const midpointOffset = this.boss?.active
            ? -(this.boss.x - this.player.x) / 2
            : -this.cameraLeadAmount;
        const followOffset = Phaser.Math.Clamp(
            midpointOffset,
            -camera.width * 0.32,
            camera.width * 0.32
        );
        this.titanOpeningCameraFraming = false;
        this.currentCameraLeadX = followOffset;
        this.targetCameraLeadX = followOffset;
        camera.startFollow(
            this.player,
            true,
            0.08,
            0.1,
            followOffset,
            this.cameraBaseOffsetY
        );
    }

    collectItem(player, item) {
        if (item.fragmentIndex !== undefined) {
            const collectX = item.x;
            const collectY = item.y;
            const fragmentIndex = Math.max(0, Number(item.fragmentIndex) || 0);
            const fragmentBit = 1 << fragmentIndex;
            if ((this.peakCollectedFragmentMask & fragmentBit) !== 0) return;
            if (
                item.optionalRouteId &&
                !this.recordOptionalRouteProgress(item.optionalRouteId, {
                    x: collectX,
                    y: collectY
                })
            ) {
                return;
            }
            this.peakCollectedFragmentMask |= fragmentBit;
            this.starFragmentsCollected += 1;
            const completedCollection =
                this.starFragmentsCollected >= this.totalStarFragments;
            const signalEggAwarded = completedCollection &&
                !this.cosmicEggAwarded &&
                this.awardPeakSignalEgg();
            this.refreshPersistedExpeditionRouteState();
            window.FXLibrary?.stardustBurst?.(this, collectX, collectY, {
                count: 18,
                color: [0xFFD700, 0x8FE3CF, 0xFFFFFF],
                duration: 1200
            });
            this.showFloatingText(
                `STAR FRAGMENT ${this.starFragmentsCollected}/${this.totalStarFragments}`,
                collectX,
                collectY - 30,
                '#FFD700'
            );
            window.AudioManager?.playCollect?.();
            item.destroy();

            if (signalEggAwarded) {
                this.time.delayedCall(450, () => {
                    this.showFloatingText(
                        'ALL FRAGMENTS - EGG AWAKENED',
                        collectX,
                        collectY - 75,
                        '#8FE3CF'
                    );
                    window.AudioManager?.playAchievement?.();
                });
            }
            return;
        }

        super.collectItem?.(player, item);
    }

    startBossFight() {
        if (this.bossFightActive || this.bossDefeated) return;

        this.deferredTitanCombat = null;
        console.log('[VoidPeaksLevel] Starting Cosmic Titan boss fight!');
        this.bossFightActive = true;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.cancelTitanControlTimer('bossAttackPreviewTimer');
        this.titanAttackLocked = true;
        const entrance = this.createTitanEntrance();
        this.retirePeakPatrolsForTitan();
        this.clearGuardianGateState();
        this.mountainApproachLabel?.setVisible(false);
        this.replySignals?.forEach(signal => {
            this.tweens.killTweensOf(signal);
            signal.setVisible(false);
        });
        this.physics.pause();
        this.hidePlatformerMobileControls();
        this.astronautFollower?.setContextualFormation?.({ x: 62, y: 0 }, 'mountain-guardian');
        this.stageTitanArenaEntry();
        this.cameras.main.stopFollow();
        if (!entrance.isCurrent()) { entrance.retire(); return; }
        entrance.panTo(
            TITAN_ARENA.introFocusX,
            MOUNTAIN_ASCENT.faceY,
            900
        );
        if (!entrance.isCurrent()) { entrance.retire(); return; }

        const { width, height } = this.cameras.main;
        entrance.warning = this.add.text(
            width / 2,
            height / 2,
            MOUNTAIN_BOSS_NAME.toUpperCase(),
            {
                fontSize: width <= 480 ? '21px' : '30px',
                color: '#F2C94C',
                fontStyle: 'bold',
                stroke: '#09030E',
                strokeThickness: 4,
                backgroundColor: 'rgba(9, 3, 14, 0.84)',
                padding: { x: 14, y: 9 },
                align: 'center',
                wordWrap: { width: width - 50 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2600);

        if (!entrance.isCurrent()) { entrance.warning.destroy(); entrance.warning = null; entrance.retire(); return; }
        entrance.after('peaks-guardian-spawn', 900, () => {
            entrance.spawnPending = true;
            this.updateTitanEntrance();
        });
        try {
            window.FeedbackManager?.cameraFlash?.(this, 220, 75, 0, 130);
            if (entrance.isCurrent()) window.FeedbackManager?.cameraShake?.(this, 450, 0.012);
        } catch (error) {
            console.warn('[VoidPeaksLevel] Optional entrance feedback failed', error);
        }
    }

    createTitanEntrance() {
        this.clearTitanEntrance();
        const player = this.player, playerBody = player?.body, camera = this.cameras.main;
        const plugin = this.scene, encounter = this.guardianEncounter, phase = this.bossPhase;
        const clock = this.time, tweens = this.tweens, world = this.physics.world, events = this.events;
        const guards = this.guardianTransitionGuards;
        const entrance = { boss: this.boss, bossBody: this.boss?.body, camera, transitions: new Map(), retired: false,
            spawnPending: false, panPending: false, panSettled: false, motionFinished: false, emerged: false };
        entrance.isCurrent = () => !entrance.retired && this.titanEntrance === entrance &&
            this.player === player && player?.active && player.body === playerBody &&
            this.boss === entrance.boss && (!entrance.boss || (entrance.boss.active && entrance.boss.body === entrance.bossBody)) &&
            this.cameras.main === camera && this.scene === plugin && this.guardianEncounter === encounter && this.bossPhase === phase &&
            this.guardianTransitionGuards === guards &&
            this.time === clock && this.tweens === tweens && this.physics.world === world && this.events === events &&
            this.bossFightActive && !this.bossDefeated && !this.bossCombatReady && !this.levelCompletionActive;
        entrance.playable = () => !this.isPlayerDead && !this.pauseMenuActive && !clock.paused &&
            this.sys?.isActive?.() !== false && playerBody?.enable && (!entrance.boss || entrance.bossBody?.enable);
        entrance.cancel = key => {
            const owned = entrance.transitions.get(key);
            if (!owned) return;
            entrance.transitions.delete(key);
            const { guards, record } = owned;
            if (record.cancel) { record.cancel(); return; }
            record.settled = true;
            record.sceneTimer?.remove?.();
            if (record.wallTimer != null) window.clearTimeout(record.wallTimer);
            if (guards.get(key) === record) guards.delete(key);
        };
        entrance.after = (key, delay, callback) => {
            if (!entrance.isCurrent()) return null;
            entrance.cancel(key);
            const record = this.scheduleGuardianTransition(key, delay, () => {
                if (entrance.transitions.get(key)?.record !== record) return;
                entrance.transitions.delete(key);
                if (!entrance.isCurrent()) { entrance.retire(); return; }
                try { callback(); } catch (error) { entrance.retire(); throw error; }
            });
            entrance.transitions.set(key, { guards, record });
        };
        entrance.retire = () => {
            if (entrance.retired) return;
            entrance.retired = true;
            if (this.titanEntrance === entrance) this.titanEntrance = null;
            [...entrance.transitions.keys()].forEach(entrance.cancel);
            entrance.motion?.remove(); entrance.pan?.reset(); entrance.pan = null; entrance.warning?.destroy();
            events.off('shutdown', entrance.retire); player.off('destroy', entrance.retire);
            entrance.boss?.off('destroy', entrance.retire);
        };
        entrance.panTo = (x, y, duration, ease = 'Linear', complete = () => {}) => {
            if (!entrance.isCurrent()) return;
            entrance.pan?.reset();
            // Native Pan writes through a guarded camera boundary, so a retired
            // first update cannot move a camera reused by another presentation.
            const proxy = {
                scene: this,
                get scrollX() { return camera.scrollX; }, get scrollY() { return camera.scrollY; },
                getScroll: (...args) => camera.getScroll(...args),
                setScroll: (...args) => { if (entrance.isCurrent() && entrance.playable()) camera.setScroll(...args); },
                centerOn: (...args) => { if (entrance.isCurrent() && entrance.playable()) camera.centerOn(...args); },
                emit: (event, _proxy, ...args) => { if (entrance.isCurrent()) camera.emit(event, camera, ...args); }
            };
            const pan = entrance.pan = new Phaser.Cameras.Scene2D.Effects.Pan(proxy);
            pan.start(x, y, duration, ease, true, (_camera, progress) => {
                if (!entrance.isCurrent()) { entrance.retire(); return; }
                if (progress >= 0.999) complete();
            });
        };
        this.titanEntrance = entrance;
        try { events.once('shutdown', entrance.retire); player.once('destroy', entrance.retire); }
        catch (error) { entrance.retire(); throw error; }
        return entrance;
    }

    clearTitanEntrance() {
        this.titanEntrance?.retire();
    }

    updateTitanEntrance(time = 0, delta = 0) {
        const entrance = this.titanEntrance;
        if (!entrance) return false;
        if (!entrance.isCurrent()) { entrance.retire(); return false; }
        if (!entrance.playable()) return false;
        if (entrance.spawnPending) {
            entrance.spawnPending = false;
            entrance.warning?.destroy(); entrance.warning = null;
            try { this.spawnCosmicTitan(); } catch (error) { entrance.retire(); throw error; }
            if (!entrance.isCurrent()) return false;
        }
        if (entrance.motionFinished && !entrance.emerged) {
            entrance.emerged = true;
            const boss = entrance.boss;
            boss.setOrigin(MOUNTAIN_ASCENT.originX, 0.97);
            boss.setPosition(TITAN_ARENA.bossX, MOUNTAIN_ASCENT.summitY);
            boss.setAngle(0);
            this.bossTargetScale = entrance.endScale;
            boss.body.updateFromGameObject();
            try { window.FeedbackManager?.cameraShake?.(this, 180, 0.004); }
            catch (error) { console.warn('[VoidPeaksLevel] Optional emergence feedback failed', error); }
            if (!entrance.isCurrent()) return false;
        }
        if (entrance.panPending) {
            entrance.panPending = false;
            entrance.panTo(this.player.x, this.player.y, 1000, 'Power2', () => { entrance.panSettled = true; });
            entrance.after('peaks-guardian-arena-pan', 1500, () => {
                entrance.panSettled = true;
                this.updateTitanEntrance();
            });
        }
        entrance.pan?.update(time, delta);
        if (!entrance.isCurrent()) return false;
        if (entrance.emerged && entrance.panSettled) {
            const camera = entrance.camera;
            entrance.retire();
            return this.beginTitanCombat(camera);
        }
        return false;
    }

    stageTitanArenaEntry() {
        if (!this.player) return false;

        const y = MOUNTAIN_ASCENT.summitY - 50;
        this.player.setPosition(TITAN_ARENA.playerEntryX, y);
        this.player.body?.updateFromGameObject?.();
        const body = this.player.body;
        const arena = this.getTraversalSupport?.('peak-titan-gate');
        if (body && arena?.body) {
            this.player.x += TITAN_ARENA.playerEntryX - body.center.x;
            this.player.y += arena.body.top - body.bottom - 4;
            body.updateFromGameObject?.();
        }
        this.player.setVelocity?.(0, 0);
        this.resetJoystick?.();
        this.clearVirtualJumpInput?.();
        this.platformDropThroughUntil = 0;
        this.platformDropSource = null;
        for (const key of ['prev', 'prevFrame', 'autoFrame']) body?.[key]?.copy?.(body.position);
        this.player.facingRight = false;
        return true;
    }

    spawnCosmicTitan() {
        const entrance = this.titanEntrance;
        if (!entrance?.isCurrent() || this.boss?.active) return false;
        this.createTitanTexture();
        if (!entrance.isCurrent()) return false;

        this.boss = this.physics.add.sprite(
            MOUNTAIN_ASCENT.faceX,
            MOUNTAIN_ASCENT.faceY,
            COSMIC_TITAN_TEXTURE
        );
        const boss = entrance.boss = this.boss;
        entrance.bossBody = boss.body;
        boss.once('destroy', entrance.retire);
        this.boss.setImmovable(true);
        this.boss.setCollideWorldBounds(false);
        this.boss.body.setAllowGravity(false);
        this.boss.setOrigin(MOUNTAIN_ASCENT.originX, MOUNTAIN_ASCENT.originY);
        this.bossTargetScale = MOUNTAIN_ASCENT.displayHeight / Math.max(1, this.boss.height);
        this.boss.body.setSize(
            this.boss.width * 0.34,
            this.boss.height * 0.82
        );
        this.boss.body.setOffset(
            this.boss.width * 0.32,
            this.boss.height * 0.14
        );
        this.boss.setScale(this.bossTargetScale);
        this.boss.health = this.bossMaxHealth;
        this.boss.setDepth(900);
        this.mountainBody?.setVisible(false);
        this.mountainName?.setVisible(false);

        // The climb remains solid terrain; the awakened character leaves it.
        const endScale = TITAN_ARENA.combatHeight / this.boss.height;
        entrance.endScale = endScale;
        const motion = { progress: 0 };
        const target = { x: TITAN_ARENA.bossX,
            y: MOUNTAIN_ASCENT.summitY - TITAN_ARENA.combatHeight * (0.97 - MOUNTAIN_ASCENT.originY),
            scaleX: endScale, scaleY: endScale, angle: -7 };
        const keys = Object.keys(target);
        let start;
        entrance.motion = this.tweens.add({
            targets: motion, progress: 1,
            duration: 900, ease: 'Cubic.easeOut',
            onStart: () => {
                if (!entrance.isCurrent()) { entrance.retire(); return; }
                start = Object.fromEntries(keys.map(key => [key, boss[key]]));
            },
            onUpdate: () => {
                if (!entrance.isCurrent()) { entrance.retire(); return; }
                if (!entrance.playable() || !start) return;
                keys.forEach(key => { boss[key] = start[key] + (target[key] - start[key]) * motion.progress; });
            },
            onComplete: () => {
                if (!entrance.isCurrent()) { entrance.retire(); return; }
                entrance.motionFinished = true;
                this.updateTitanEntrance();
            }
        });

        this.bossHealth = this.bossMaxHealth;
        this.createBossHealthBar();
        entrance.after('peaks-guardian-pan-start', 500, () => {
            entrance.panPending = true;
            this.updateTitanEntrance();
        });
        return true;
    }

    beginTitanCombat(camera = this.cameras.main) {
        if (
            this.bossCombatReady ||
            this.levelCompletionActive ||
            !this.bossFightActive ||
            !this.boss?.active ||
            !this.player?.active
        ) return false;

        if (this.isPlayerDead || this.pauseMenuActive || this.time.paused || this.sys?.isActive?.() === false) {
            this.deferredTitanCombat = {
                boss: this.boss, bossBody: this.boss.body,
                player: this.player, playerBody: this.player.body,
                plugin: this.scene, encounter: this.guardianEncounter,
                clock: this.time, world: this.physics.world
            };
            return false;
        }
        this.deferredTitanCombat = null;
        this.bossCombatReady = true;
        this.bossCombatReadyAt = this.time.now;
        this.titanAttackLocked = false;
        camera.panEffect?.reset?.();
        camera.centerOn(this.getTitanOpeningCameraCenterX(camera), Math.max(camera.height / 2, this.player.y));
        this.titanOpeningCameraFraming =
            this.isMobile || camera.width <= 480;
        if (this.titanOpeningCameraFraming) {
            camera.panEffect?.reset?.();
            camera.stopFollow();
            camera.scrollX = this.getTitanOpeningCameraCenterX(camera) -
                camera.width / 2;
        } else {
            camera.scrollX = this.getTitanOpeningCameraCenterX(camera) - camera.width / 2;
            camera.startFollow(
                this.player,
                true,
                0.08,
                0.1,
                -this.cameraLeadAmount,
                this.cameraBaseOffsetY
            );
            this.currentCameraLeadX = -this.cameraLeadAmount;
            this.targetCameraLeadX = -this.cameraLeadAmount;
        }
        this.physics.resume();
        this.input?.keyboard?.resetKeys?.();
        this.resetJoystick?.();
        this.releaseAllPlatformerActionButtons?.();
        this.clearVirtualJumpInput?.();
        this.showPlatformerMobileControls();
        this.bossSubtitle?.setText?.(
            'Dodge the snow. Strike while the peaks are quiet!'
        );

        this.scheduleTitanControlTimer('bossAttackPreviewTimer',
            TITAN_ARENA.openingGraceMs,
            isCurrent => {
                if (this.bossAttackPreview) {
                    this.performTitanAttack(this.bossAttackPreview);
                } else {
                    this.performTitanAttack();
                    if (isCurrent()) this.startTitanAttackLoop();
                }
            }
        );
        console.log('[VoidPeaksLevel] Arena framed; Titan combat enabled');
        return true;
    }

    updateDeferredTitanCombat() {
        const pending = this.deferredTitanCombat;
        if (!pending) return false;
        if (this.boss !== pending.boss || !pending.boss.active || pending.boss.body !== pending.bossBody ||
            this.player !== pending.player || !pending.player.active || pending.player.body !== pending.playerBody ||
            this.scene !== pending.plugin || this.guardianEncounter !== pending.encounter ||
            this.time !== pending.clock || this.physics?.world !== pending.world ||
            !this.bossFightActive || this.bossDefeated || this.levelCompletionActive || this.bossCombatReady) {
            this.deferredTitanCombat = null;
            return false;
        }
        if (this.isPlayerDead || this.pauseMenuActive || this.time.paused ||
            this.sys?.isActive?.() === false || !this.cameras?.main) return false;
        this.deferredTitanCombat = null;
        return this.beginTitanCombat(this.cameras.main);
    }

    startTitanAttackLoop() {
        if (!this.bossCombatReady || !this.bossFightActive || this.bossDefeated) {
            return null;
        }
        return this.scheduleTitanControlTimer('bossAttackTimer', 2600,
            () => this.performTitanAttack(), { loop: true, phaseBound: false });
    }

    createTitanTexture() {
        if (this.textures.exists(COSMIC_TITAN_TEXTURE)) return;

        const g = this.make.graphics({ add: false });
        g.fillStyle(0x343A43, 1);
        g.fillTriangle(30, 980, 180, 950, 475, 440);
        g.fillTriangle(980, 980, 850, 950, 520, 440);
        g.fillTriangle(0, 100, 70, 370, 540, 580);
        g.fillTriangle(1000, 100, 940, 370, 450, 580);
        g.fillRoundedRect(350, 270, 300, 360, 34);
        for (const [x, y, w, h] of [[490, 100, 240, 300], [130, 15, 240, 250], [885, 35, 230, 240], [220, 790, 190, 180], [825, 785, 190, 180]]) {
            g.fillStyle(0x242930, 1);
            g.fillTriangle(x, y, x - w / 2, y + h, x + w / 2, y + h);
            g.fillStyle(0xF0F4F8, 1);
            g.fillTriangle(x, y, x - w / 5, y + h * 0.4, x + w / 5, y + h * 0.4);
        }
        g.fillStyle(0xFFFFFF, 1);
        g.fillEllipse(451, 275, 30, 44);
        g.fillEllipse(527, 275, 30, 44);
        g.fillStyle(0x111820, 1);
        g.fillCircle(453, 278, 7);
        g.fillCircle(525, 278, 7);
        g.lineStyle(12, 0x111820, 1);
        g.lineBetween(432, 233, 469, 252);
        g.lineBetween(510, 252, 549, 233);
        g.fillTriangle(490, 315, 454, 366, 527, 366);
        g.fillStyle(0xFFFFFF, 1);
        g.fillTriangle(490, 315, 474, 339, 506, 339);
        g.generateTexture(COSMIC_TITAN_TEXTURE, 1000, 1000);
        g.destroy();
    }

    createBossHealthBar() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const barWidth = Math.min(420, width - 80);
        const barX = (width - barWidth) / 2;
        const barY = isMobileLayout ? 118 : 60;
        this.bossBarConfig = { x: barX, y: barY, width: barWidth, height: 18 };

        this.bossNameText = this.add.text(width / 2, barY - 30, MOUNTAIN_BOSS_NAME.toUpperCase(), {
            fontSize: isMobileLayout ? '17px' : '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#EDF5FF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center', wordWrap: { width: width - 32 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);

        this.bossSubtitle = this.add.text(width / 2, barY + 36, 'Watch the snowy peaks flash', {
            fontSize: isMobileLayout ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#D8FFF6',
            stroke: '#160D24',
            strokeThickness: 2,
            align: 'center', wordWrap: { width: width - 32 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);

        this.bossHealthBar = this.add.graphics();
        this.bossHealthBar.setScrollFactor(0);
        this.bossHealthBar.setDepth(2999);

        this.bossPressureText = this.add.text(width / 2, barY + 9, '', {
            fontSize: isMobileLayout ? '11px' : '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#160D24',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);
        this.updateBossHealthBar();
        this.createBossIndicator();
    }

    updateBossHealthBar() {
        if (!this.bossHealthBar || !this.bossBarConfig) return;

        const ratio = Phaser.Math.Clamp(this.bossHealth / this.bossMaxHealth, 0, 1);
        drawMountainPressureBar(this.bossHealthBar, this.bossBarConfig, ratio);
        const pressure = Math.max(0, Math.ceil(this.bossHealth));
        this.bossPressureText?.setText(
            pressure > 0
                ? `VOID PRESSURE // ${pressure}/${this.bossMaxHealth}`
                : 'VOID PRESSURE // CLEARED'
        );
    }

    createBossIndicator() {
        const { width, height } = this.cameras.main;
        this.bossIndicator = this.add.text(width - 14, height / 2, 'TITAN >', {
            fontSize: width <= 480 ? '13px' : '15px',
            color: '#F2C94C',
            backgroundColor: 'rgba(9, 3, 14, 0.78)',
            padding: { x: 7, y: 5 },
            fontStyle: 'bold'
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(2998).setVisible(false);
    }

    updateBossIndicator() {
        if (!this.bossIndicator || !this.boss?.active || this.bossDefeated) {
            this.bossIndicator?.setVisible?.(false);
            return;
        }

        const camera = this.cameras.main;
        const bossScreenX = this.boss.x - camera.scrollX;
        const padding = 45;

        if (bossScreenX > camera.width + padding) {
            this.bossIndicator
                .setText('TITAN >')
                .setPosition(camera.width - 14, camera.height / 2)
                .setOrigin(1, 0.5)
                .setVisible(true);
        } else if (bossScreenX < -padding) {
            this.bossIndicator
                .setText('< TITAN')
                .setPosition(14, camera.height / 2)
                .setOrigin(0, 0.5)
                .setVisible(true);
        } else {
            this.bossIndicator.setVisible(false);
        }
    }

    trackBossEffect(effect) {
        if (effect) this.bossEncounterEffects.add(effect);
        return effect;
    }

    releaseBossEffect(effect) {
        if (!effect || !this.bossEncounterEffects.delete(effect)) return;
        effect.destroy?.();
    }

    scheduleBossTimer(delay, callback) {
        let timer = null;
        timer = this.time.delayedCall(delay, () => {
            this.bossEncounterTimers.delete(timer);
            callback();
        });
        this.bossEncounterTimers.add(timer);
        return timer;
    }

    cancelTitanControlTimer(slot) {
        const owner = this.titanControlTimers?.get(slot);
        if (owner) owner.retire();
        else {
            this[slot]?.remove?.(false);
            this[slot] = null;
        }
    }

    clearTitanControlTimers() {
        [...(this.titanControlTimers?.values() || [])].forEach(owner => owner.retire());
    }

    isTitanControlTimerPending(slot) {
        const owner = this.titanControlTimers?.get(slot);
        return Boolean(owner?.isCurrent() && owner.timer.getRemaining() > 0);
    }

    scheduleTitanControlTimer(slot, delay, callback, { loop = false, phaseBound = true, encounterTimer = false } = {}) {
        this.cancelTitanControlTimer(slot);
        const owners = this.titanControlTimers ||= new Map();
        const boss = this.boss, player = this.player, bossBody = boss?.body, playerBody = player?.body;
        const plugin = this.scene, encounter = this.guardianEncounter, phase = this.bossPhase;
        const clock = this.time, tweens = this.tweens, world = this.physics?.world, events = this.events;
        const timers = this.bossEncounterTimers;
        // Pause and checkpoint recovery retain native Clock time. Actor/phase
        // ownership is separate from the attack method's live-player guard.
        const ownsContext = () => bossBody && playerBody && this.boss === boss && boss?.active && boss.body === bossBody &&
            this.player === player && player?.active && player.body === playerBody &&
            this.scene === plugin && this.guardianEncounter === encounter && (!phaseBound || this.bossPhase === phase) &&
            this.time === clock && this.tweens === tweens && this.physics?.world === world && this.events === events &&
            this.bossFightActive && this.bossCombatReady && !this.bossDefeated && !this.levelCompletionActive;
        if (!ownsContext()) return null;
        const owner = { timer: null, retired: false, delivering: false, fired: false };
        const isCurrent = () => !owner.retired && this.titanControlTimers === owners && owners.get(slot) === owner &&
            (this[slot] === owner.timer || (owner.delivering && this[slot] === null)) &&
            (!encounterTimer || (this.bossEncounterTimers === timers && (owner.delivering || timers.has(owner.timer)))) && ownsContext();
        owner.isCurrent = isCurrent;
        owner.retire = () => {
            if (owner.retired) return;
            owner.retired = true;
            // Do not delete a replacement record or clear its native timer alias.
            if (owners.get(slot) === owner) owners.delete(slot);
            if (this[slot] === owner.timer) this[slot] = null;
            timers?.delete(owner.timer);
            events.off('shutdown', owner.retire);
            boss.off('destroy', owner.retire); player.off('destroy', owner.retire);
            owner.timer?.remove(false);
        };
        owners.set(slot, owner);
        try {
            events.once('shutdown', owner.retire); boss.once('destroy', owner.retire); player.once('destroy', owner.retire);
            const deliver = () => {
                if (owner.delivering || (!loop && owner.fired)) return;
                if (!isCurrent()) { owner.retire(); return; }
                owner.delivering = true;
                if (!loop) { owner.fired = true; this[slot] = null; timers?.delete(owner.timer); }
                try { callback(isCurrent); }
                catch (error) { owner.retire(); throw error; }
                finally { owner.delivering = false; if (!loop) owner.retire(); }
            };
            owner.timer = loop ? clock.addEvent({ delay, callback: deliver, loop: true }) : clock.delayedCall(delay, deliver);
            if (owner.retired || owners.get(slot) !== owner) { owner.timer.remove(false); return null; }
            this[slot] = owner.timer;
            if (encounterTimer) timers.add(owner.timer);
            return owner.timer;
        } catch (error) { owner.retire(); throw error; }
    }

    clearBossEncounterTimers() {
        this.cancelTitanControlTimer('titanAttackRecoveryTimer');
        this.cancelTitanControlTimer('titanCounterWindowTimer');
        this.cancelTitanControlTimer('titanHitCooldownTimer');
        this.bossEncounterTimers.forEach(timer => timer?.remove?.(false));
        this.bossEncounterTimers.clear();
    }

    clearBossEncounterEffects() {
        this.clearMountainAttackLaunches();
        this.clearMountainProjectiles();
        this.clearMountainSnowGrenades();
        this.bossEncounterEffects.forEach(effect => this.releaseBossEffect(effect));
    }

    createTitanAttackTelegraph(attack, target) {
        if (!this.boss?.active || !this.player?.active) return null;

        const telegraph = this.trackBossEffect(this.add.graphics());
        const color = 0xFFCA78;
        telegraph.lineStyle(2, color, 0.65);
        telegraph.fillStyle(color, 0.9);
        telegraph.setDepth(915);
        if (attack === 'voidPunch') {
            telegraph.strokeCircle(Phaser.Math.Clamp(target.x, 4814, 5166), MOUNTAIN_ASCENT.summitY - 14, 46);
        }
        if (attack === 'starRain' || attack === 'singularity') {
            telegraph.fillStyle(0xFFB968, 0.4);
            telegraph.fillRect(MOUNTAIN_ASCENT.summitX, MOUNTAIN_ASCENT.summitY - 8, MOUNTAIN_ASCENT.summitWidth, 8);
        }
        this.getMountainAttackEmitters(attack).forEach(kind => {
            const origin = mountainEmitter(this.boss, kind);
            telegraph.fillTriangle(origin.x, origin.y - 12, origin.x - 9, origin.y + 6, origin.x + 9, origin.y + 6);
            if (attack !== 'starRain') telegraph.lineBetween(origin.x, origin.y, target.x, target.y);
        });

        this.tweens.add({
            targets: telegraph,
            alpha: 0.3,
            duration: 180,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
        return telegraph;
    }

    performTitanAttack(forcedAttack = null) {
        if (
            !this.bossCombatReady ||
            !this.bossFightActive ||
            !this.boss?.active ||
            !this.player?.active ||
            this.bossDefeated ||
            this.pauseMenuActive || this.time.paused || this.physics?.world?.isPaused ||
            this.titanAttackLocked ||
            this.isTitanControlTimerPending('titanCounterWindowTimer')
        ) return;

        const windupContext = this.captureMountainAttackContext();
        if (!windupContext.isCurrent()) return;
        const attack = forcedAttack || nextMountainAttack(this.titanAttackIndex++, this.bossPhase);
        const attackWindow = TITAN_ATTACK_WINDOWS[attack] || 1800;
        const attackTarget = { x: this.player.x, y: this.player.y };
        if (!this.startTitanWindup(windupContext)) return;
        this.titanAttackLocked = true;
        this.titanRecoveryUntil = 0;
        this.broadcastTitanWarning(attack, attackTarget);

        this.scheduleTitanControlTimer('titanAttackUnlockTimer',
            TITAN_ATTACK_WINDUP + attackWindow + TITAN_RECOVERY_WINDOW,
            () => {
                if (!this.titanPhaseRecoveryTimer && !this.bossDefeated) {
                    this.titanAttackLocked = false;
                    this.bossSubtitle?.setText?.('Watch the snowy peaks');
                }
            }
        );
    }

    startTitanWindup(context = this.captureMountainAttackContext()) {
        this.clearTitanWindup();
        if (!context.isCurrent()) return null;
        const { boss, player, tweenManager } = context;
        const events = this.events;
        const endX = Phaser.Math.Clamp(boss.x + (player.x > boss.x ? 42 : -42), 4870, 5010);
        const endAngle = player.x > boss.x ? 5 : -5;
        const motion = { progress: 0 };
        const owner = { tween: null, retired: false, started: false };
        let startX, startAngle;
        const isCurrent = () => !owner.retired && this.titanWindupMotion === owner &&
            this.events === events && context.isCurrent();
        owner.retire = () => {
            if (owner.retired) return;
            owner.retired = true;
            if (this.titanWindupMotion === owner) this.titanWindupMotion = null;
            events.off('shutdown', owner.retire);
            boss.off('destroy', owner.retire);
            player.off('destroy', owner.retire);
            owner.tween?.remove();
            owner.tween = null;
        };
        owner.cancel = () => {
            if (owner.started && isCurrent()) boss.angle = startAngle;
            owner.retire();
        };
        this.titanWindupMotion = owner;
        try {
            events.once('shutdown', owner.retire);
            boss.once('destroy', owner.retire);
            player.once('destroy', owner.retire);
            // Tween a local value so even the first stale update cannot move a
            // reused actor before an onUpdate ownership check gets to run.
            owner.tween = tweenManager.add({
                targets: motion, progress: 1,
                duration: TITAN_ATTACK_WINDUP, ease: 'Sine.easeInOut',
                onStart: () => {
                    if (!isCurrent()) { owner.retire(); return; }
                    startX = boss.x;
                    startAngle = boss.angle;
                    owner.started = true;
                },
                onUpdate: () => {
                    if (!isCurrent()) { owner.retire(); return; }
                    if (!owner.started) return;
                    boss.x = startX + (endX - startX) * motion.progress;
                    boss.angle = startAngle + (endAngle - startAngle) * motion.progress;
                },
                onComplete: owner.retire
            });
            if (owner.retired) { owner.tween?.remove(); return null; }
            return owner;
        } catch (error) { owner.retire(); throw error; }
    }

    clearTitanWindup() {
        this.titanWindupMotion?.cancel();
    }

    broadcastTitanWarning(attack, attackTarget) {
        const warnings = {
            gravityCrush: 'Snow burst! Step aside',
            starRain: 'Rolling snowball! Jump!',
            voidPunch: 'Snow grenade! Leave the landing spot',
            singularity: 'Snow burst, then jump!'
        };

        this.bossSubtitle?.setText?.(warnings[attack] || 'NETWORK WARNING // PRESSURE SURGE');
        const telegraph = this.createTitanAttackTelegraph(attack, attackTarget);
        this.scheduleTitanControlTimer('titanWarningTimer', TITAN_ATTACK_WINDUP, isCurrent => {
            this.releaseBossEffect(telegraph);
            if (!isCurrent() || this.titanPhaseRecoveryTimer) return;
            this.executeTitanAttack(attack, attackTarget);
            if (!isCurrent()) return;
            const recoveryDelay = TITAN_ATTACK_WINDOWS[attack] || 1800;
            this.scheduleTitanControlTimer('titanAttackRecoveryTimer', recoveryDelay, recoveryCurrent => {
                this.clearBossEncounterEffects();
                if (!recoveryCurrent()) return;
                this.titanAttacksCompleted += 1;
                this.titanRecoveryDamage = 0;
                // Clock.now advances behind a menu; native remaining time does not.
                this.titanRecoveryUntil = this.time.now + TITAN_RECOVERY_WINDOW;
                this.scheduleTitanControlTimer('titanCounterWindowTimer', TITAN_RECOVERY_WINDOW,
                    () => { this.titanRecoveryUntil = 0; }, { encounterTimer: true });
                if (!recoveryCurrent()) return;
                this.bossSubtitle?.setText?.('Your turn! Strike now');
                if (recoveryCurrent()) this.tweens.add({ targets: this.boss, angle: 0, duration: 250 });
            }, { encounterTimer: true });
        });
    }

    captureMountainAttackContext() {
        const boss = this.boss, player = this.player;
        const bossBody = boss?.body, playerBody = player?.body;
        const plugin = this.scene, encounter = this.guardianEncounter, phase = this.bossPhase;
        const clock = this.time, tweenManager = this.tweens, world = this.physics?.world;
        return { boss, player, clock, tweenManager,
            isCurrent: () => this.boss === boss && this.player === player &&
                boss?.active && boss.body === bossBody && bossBody?.enable &&
                player?.active && player.body === playerBody && playerBody?.enable &&
                this.scene === plugin && this.guardianEncounter === encounter && this.bossPhase === phase &&
                this.time === clock && this.tweens === tweenManager && this.physics?.world === world &&
                this.bossFightActive && this.bossCombatReady && !this.bossDefeated &&
                !this.isPlayerDead && !this.levelCompletionActive && this.sys.isActive()
        };
    }

    executeTitanAttack(attack, attackTarget) {
        const context = this.captureMountainAttackContext();
        if (!context.isCurrent()) return;
        if (attack === 'voidPunch') {
            this.fireMountainSnowGrenade(attackTarget);
            return;
        }
        this.mountainAttackLaunches ??= new Set();
        const launches = this.mountainAttackLaunches, timers = this.bossEncounterTimers;
        const launch = { retired: false, pending: new Set() };
        const target = { x: attackTarget.x, y: attackTarget.y };
        launch.retire = () => {
            if (launch.retired) return;
            launch.retired = true;
            launches.delete(launch);
            this.events.off('shutdown', launch.retire);
            context.boss.off('destroy', launch.retire);
            context.player.off('destroy', launch.retire);
            launch.pending.forEach(record => {
                record.active = false;
                timers.delete(record.timer);
                record.timer.remove(false);
            });
            launch.pending.clear();
        };
        launches.add(launch);
        try {
            this.events.once('shutdown', launch.retire);
            context.boss.once('destroy', launch.retire);
            context.player.once('destroy', launch.retire);
            mountainAttackPlan(attack).forEach(({ at, kind }) => {
                const record = { active: true, timer: null };
                record.timer = context.clock.delayedCall(at, () => {
                    if (!record.active || launch.retired) return;
                    record.active = false;
                    launch.pending.delete(record);
                    timers.delete(record.timer);
                    if (!context.isCurrent()) { launch.retire(); return; }
                    try {
                        if (kind === 'groundWave') this.fireMountainGroundWave();
                        else this.fireMountainLaser(kind, target);
                    } catch (error) { launch.retire(); throw error; }
                    if (!launch.pending.size) launch.retire();
                });
                launch.pending.add(record);
                timers.add(record.timer);
            });
        } catch (error) { launch.retire(); throw error; }
    }

    clearMountainAttackLaunches() {
        [...(this.mountainAttackLaunches || [])].forEach(launch => launch.retire());
    }

    fireMountainGroundWave() {
        return this.fireMountainProjectile('groundWave');
    }

    getMountainAttackEmitters(attack) {
        if (attack === 'voidPunch') return ['summit'];
        return [...new Set(mountainAttackPlan(attack)
            .map(shot => shot.kind).filter(kind => kind !== 'groundWave'))];
    }

    fireMountainLaser(kind, target) {
        return this.fireMountainProjectile(kind, target);
    }

    fireMountainProjectile(kind, target = null) {
        const context = this.captureMountainAttackContext();
        if (!context.isCurrent()) return null;
        const { boss, player, clock, tweenManager } = context;
        this.mountainProjectiles ??= new Set();
        const owners = this.mountainProjectiles, effects = this.bossEncounterEffects, timers = this.bossEncounterTimers;
        const owner = { retired: false };
        let projectile, overlap, expiry, spin, destroying = false, consumed = false;
        const onDestroy = () => { destroying = true; owner.retire(); };
        owner.retire = () => {
            if (owner.retired) return;
            owner.retired = true;
            owners.delete(owner);
            this.events.off('shutdown', owner.retire);
            boss.off('destroy', owner.retire);
            player.off('destroy', owner.retire);
            expiry?.remove(false);
            timers.delete(expiry);
            spin?.stop();
            effects.delete(overlap);
            overlap?.destroy();
            effects.delete(projectile);
            projectile?.off('destroy', onDestroy);
            if (!destroying) projectile?.destroy();
        };
        const requireCurrent = () => {
            if (!owner.retired && context.isCurrent()) return true;
            owner.retire();
            return false;
        };
        owners.add(owner);
        try {
            this.events.once('shutdown', owner.retire);
            boss.once('destroy', owner.retire);
            player.once('destroy', owner.retire);
            const wave = kind === 'groundWave';
            const direction = player.x >= boss.x ? 1 : -1;
            const origin = wave ? { x: boss.x + direction * 62, y: MOUNTAIN_ASCENT.summitY - 26 }
                : mountainEmitter(boss, kind);
            projectile = this.add.circle(origin.x, origin.y, wave ? 26 : 8, wave ? 0xE8F9FF : 0xF0FCFF)
                .setStrokeStyle(wave ? 4 : 2, wave ? 0x81CFE0 : 0x79C7DD).setDepth(910);
            effects.add(projectile);
            projectile.once('destroy', onDestroy);
            this.physics.add.existing(projectile);
            if (wave) {
                projectile.body.setAllowGravity(false).setCircle(26).setVelocityX(direction * 180);
                spin = tweenManager.add({ targets: projectile, angle: direction * 720, duration: 1800,
                    onUpdate: requireCurrent });
            } else {
                const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
                projectile.body.setAllowGravity(false).setCircle(8);
                projectile.body.setVelocity(Math.cos(angle) * 255, Math.sin(angle) * 255);
            }
            overlap = this.physics.add.overlap(player, projectile, () => {
                if (consumed || !requireCurrent() || !projectile.active) return;
                consumed = true;
                try { this.takeDamage(1); }
                finally { owner.retire(); }
            }, () => !consumed && requireCurrent() && projectile.active);
            effects.add(overlap);
            expiry = clock.delayedCall(wave ? 1850 : 2400, owner.retire);
            timers.add(expiry);
            return projectile;
        } catch (error) { owner.retire(); throw error; }
    }

    clearMountainProjectiles() {
        [...(this.mountainProjectiles || [])].forEach(projectile => projectile.retire());
    }

    fireMountainSnowGrenade(target) {
        const boss = this.boss, player = this.player;
        const bossBody = boss?.body, playerBody = player?.body;
        const plugin = this.scene, encounter = this.guardianEncounter, phase = this.bossPhase;
        const clock = this.time, tweenManager = this.tweens, world = this.physics?.world;
        const effects = this.bossEncounterEffects, encounterTimers = this.bossEncounterTimers;
        const grenade = { retired: false, timers: new Set(), tweens: new Set(), objects: new Map() };
        const isCurrent = () => !grenade.retired && this.boss === boss && this.player === player &&
            boss?.active && boss.body === bossBody && bossBody?.enable &&
            player?.active && player.body === playerBody && playerBody?.enable &&
            this.scene === plugin && this.guardianEncounter === encounter && this.bossPhase === phase &&
            this.time === clock && this.tweens === tweenManager && this.physics?.world === world &&
            this.bossFightActive && this.bossCombatReady && !this.bossDefeated &&
            !this.isPlayerDead && !this.levelCompletionActive && this.sys.isActive();
        if (!isCurrent()) return null;

        this.mountainSnowGrenades ??= new Set();
        const owners = this.mountainSnowGrenades;
        owners.add(grenade);
        let destroying = null;
        const release = object => {
            if (!grenade.objects.has(object)) return;
            const onDestroy = grenade.objects.get(object);
            if (onDestroy) object.off('destroy', onDestroy);
            grenade.objects.delete(object);
            effects.delete(object);
            if (object !== destroying) object.destroy();
        };
        grenade.retire = () => {
            if (grenade.retired) return;
            grenade.retired = true;
            owners.delete(grenade);
            this.events.off('shutdown', grenade.retire);
            boss.off('destroy', grenade.retire);
            player.off('destroy', grenade.retire);
            grenade.timers.forEach(record => {
                record.active = false;
                encounterTimers.delete(record.timer);
                record.timer.remove(false);
            });
            grenade.timers.clear();
            grenade.tweens.forEach(tween => tween.stop());
            grenade.tweens.clear();
            [...grenade.objects.keys()].forEach(release);
        };
        const requireCurrent = () => {
            if (isCurrent()) return true;
            grenade.retire();
            return false;
        };
        const own = object => {
            const onDestroy = () => { destroying = object; grenade.retire(); };
            grenade.objects.set(object, onDestroy);
            effects.add(object);
            object.once('destroy', onDestroy);
            return object;
        };
        const after = (delay, callback) => {
            const record = { active: true, timer: null };
            record.timer = clock.delayedCall(delay, () => {
                if (!record.active || grenade.retired) return;
                record.active = false;
                grenade.timers.delete(record);
                encounterTimers.delete(record.timer);
                if (!requireCurrent()) return;
                try { callback(); }
                catch (error) { grenade.retire(); throw error; }
            });
            grenade.timers.add(record);
            encounterTimers.add(record.timer);
        };
        const animate = config => {
            const tween = tweenManager.add({ ...config,
                onUpdate: () => { if (requireCurrent()) config.onUpdate?.(); }
            });
            grenade.tweens.add(tween);
        };
        const origin = mountainEmitter(boss);
        const landingX = Phaser.Math.Clamp(target.x, MOUNTAIN_ASCENT.summitX + 34, 5166);
        const landingY = MOUNTAIN_ASCENT.summitY - 14;
        try {
            this.events.once('shutdown', grenade.retire);
            boss.once('destroy', grenade.retire);
            player.once('destroy', grenade.retire);
            const snow = own(this.add.circle(origin.x, origin.y, 14, 0xEAFBFF)
                .setStrokeStyle(3, 0x82CDDC).setDepth(910));
            const progress = { t: 0 };
            animate({ targets: progress, t: 1, duration: 1000,
                onUpdate: () => {
                    if (!snow.active) return;
                    snow.setPosition(origin.x + (landingX - origin.x) * progress.t,
                        origin.y + (landingY - origin.y) * progress.t - Math.sin(Math.PI * progress.t) * 72);
                }
            });
            after(1000, () => {
                release(snow);
                const burst = own(this.add.circle(landingX, landingY, 46, 0xD8F7FF, 0.7)
                    .setStrokeStyle(3, 0xFFFFFF).setDepth(910));
                this.physics.add.existing(burst);
                burst.body.setAllowGravity(false).setCircle(46);
                const overlap = this.physics.add.overlap(player, burst, () => {
                    if (requireCurrent() && burst.active) this.takeDamage(1);
                });
                // Colliders have no GameObject destroy event, but share its cleanup.
                grenade.objects.set(overlap, null);
                effects.add(overlap);
                animate({ targets: burst, alpha: 0.15, duration: 650 });
                after(650, grenade.retire);
            });
            return snow;
        } catch (error) { grenade.retire(); throw error; }
    }

    clearMountainSnowGrenades() {
        [...(this.mountainSnowGrenades || [])].forEach(grenade => grenade.retire());
    }

    onPlayerDeath() {
        if (this.isPlayerDead) return;
        this.clearTitanWindup();
        this.cancelTitanControlTimer('titanWarningTimer');
        this.cancelTitanControlTimer('titanAttackUnlockTimer');
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();
        this.titanRecoveryUntil = 0;
        if (!this.titanPhaseRecoveryTimer) this.titanAttackLocked = false;
        return super.onPlayerDeath();
    }

    keepMountainArenaGrounded() {
        const body = this.player?.body;
        if (!body || !this.bossFightActive || !this.bossCombatReady || this.isPlayerDead) return;
        // The summit remains solid even if a frame is dropped during the reveal.
        if (body.left >= MOUNTAIN_ASCENT.summitX && body.bottom > MOUNTAIN_ASCENT.summitY + 22) {
            this.player.y += MOUNTAIN_ASCENT.summitY - body.bottom - 2;
            body.updateFromGameObject();
            for (const key of ['prev', 'prevFrame', 'autoFrame']) body[key]?.copy?.(body.position);
            this.player.setVelocityY(0);
        }
    }

    enterTitanPhase(nextPhase) {
        this.clearTitanWindup();
        this.bossPhase = nextPhase;
        this.titanAttackLocked = true;
        this.cancelTitanControlTimer('titanWarningTimer');
        this.cancelTitanControlTimer('titanAttackUnlockTimer');
        this.cancelTitanControlTimer('titanPhaseRecoveryTimer');
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();
        this.boss?.setVelocity?.(0, 0);

        const phaseColor = nextPhase >= 4 ? 0xFF6B6B : 0xB66BFF;
        const phaseRing = this.trackBossEffect(this.add.graphics());
        phaseRing.lineStyle(7, phaseColor, 0.95);
        phaseRing.strokeCircle(0, 0, 90);
        phaseRing.setPosition(this.boss.x, this.boss.y).setDepth(914).setScale(0.35);
        this.bossSubtitle?.setText?.('The peaks are shifting. Catch your breath!');
        window.FeedbackManager?.cameraShake?.(this, 350, 0.018);
        // Arena terrain stays independent of the awakened character.
        this.tweens.add({
            targets: phaseRing,
            scaleX: 2.4,
            scaleY: 2.4,
            alpha: 0,
            duration: TITAN_PHASE_RECOVERY,
            ease: 'Sine.easeOut',
            onComplete: () => this.releaseBossEffect(phaseRing)
        });

        this.scheduleTitanControlTimer('titanPhaseRecoveryTimer', TITAN_PHASE_RECOVERY, () => {
            this.titanAttackLocked = false;
            this.titanRecoveryUntil = 0;
            this.performTitanAttack();
        });
    }

    damageBoss(amount) {
        if (!this.boss?.active || this.bossDefeated) return false;
        if (!this.bossCombatReady || !this.titanAttacksCompleted ||
            this.pauseMenuActive || this.time.paused || this.physics?.world?.isPaused ||
            this.isPlayerDead || this.levelCompletionActive || this.sys?.isActive?.() === false ||
            !this.isTitanControlTimerPending('titanCounterWindowTimer') || this.titanPhaseRecoveryTimer ||
            this.titanRecoveryDamage >= 4 || this.isTitanControlTimerPending('titanHitCooldownTimer') ||
            !Number.isFinite(amount) || amount <= 0) return false;
        if (!this.scheduleTitanControlTimer('titanHitCooldownTimer', 350, () => {}, { encounterTimer: true })) return false;
        const recoveryBonus = 1;
        const finalAmount = Math.min(4 - this.titanRecoveryDamage, Math.min(3, amount) + recoveryBonus);
        this.titanRecoveryDamage += finalAmount;
        this.titanLastHitAt = this.time.now;
        if (this.titanRecoveryDamage >= 4) this.bossSubtitle?.setText?.('Good hit! Get ready');
        this.bossHealth = Math.max(0, this.bossHealth - finalAmount);
        this.boss.health = this.bossHealth;
        this.updateBossHealthBar();

        this.showFloatingText(
            recoveryBonus
                ? `OPEN PRESSURE -${finalAmount}`
                : `PRESSURE -${finalAmount}`,
            this.boss.x,
            this.boss.y - 115,
            '#8FE3CF'
        );

        this.boss.setTint(0x8FE3CF);
        this.time.delayedCall(90, () => this.boss?.clearTint?.());

        const healthRatio = this.bossHealth / this.bossMaxHealth;
        const nextPhase = healthRatio <= 0.5 ? 3 : 1;
        if (this.bossHealth > 0 && nextPhase > this.bossPhase) {
            this.enterTitanPhase(nextPhase);
        }

        if (this.bossHealth <= 0) {
            this.defeatBoss();
        }
        return true;
    }

    defeatBoss() {
        if (this.bossDefeated) return false;
        const state = window.GameState, root = state?.state, admission = state?.saveAdmission;
        const epoch = state?.getSaveAdmission?.().epoch;
        const reader = state?.captureSaveAdmissionOwner?.();
        const cloud = window.CloudSave, cloudEpoch = cloud?.campaignEpoch, cloudUser = cloud?.currentUser?.id;
        const physics = this.physics, boss = this.boss, player = this.player, body = player?.body, world = physics?.world;
        const sys = this.sys, events = this.events, lifetime = this.completionSaveLifetime;
        const input = this.input, camera = this.cameras?.main, encounter = this.guardianEncounter, clock = this.time, plugin = this.scene;
        const original = () => window.GameState === state && state?.state === root && state?.saveAdmission === admission &&
            (!reader || reader.isCurrent()) && window.CloudSave === cloud && cloud?.campaignEpoch === cloudEpoch && cloud?.currentUser?.id === cloudUser &&
            state?.getSaveAdmission?.().epoch === epoch && this.boss === boss && this.player === player && player?.body === body &&
            this.physics === physics && physics?.world === world && this.sys === sys && this.events === events && this.completionSaveLifetime === lifetime &&
            this.input === input && this.cameras?.main === camera && this.guardianEncounter === encounter &&
            this.time === clock && this.scene === plugin && this.sys?.isActive?.() !== false && !this._returningToHub;
        const optional = action => { if (original()) { try { action(); } catch { /* Cleanup must not swallow the save/recovery route. */ } } };
        console.log('[VoidPeaksLevel] Cosmic Titan restored!');
        this.bossDefeated = true;
        this.bossFightActive = false;
        this.enterLevelCompletionState();
        if (!original()) return false;
        optional(() => this.clearTitanEntrance());
        optional(() => this.clearTitanControlTimers());
        optional(() => this.clearTitanWindup());
        optional(() => this.astronautFollower?.setContextualFormation?.(null));
        if (!original()) return false;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.titanOpeningCameraFraming = false;
        optional(() => this.bossAttackTimer?.remove?.());
        optional(() => this.bossAttackPreviewTimer?.remove?.());
        if (!original()) return false;
        this.bossAttackPreviewTimer = null;
        optional(() => this.titanWarningTimer?.remove?.());
        if (!original()) return false;
        this.titanWarningTimer = null;
        optional(() => this.titanAttackUnlockTimer?.remove?.());
        if (!original()) return false;
        this.titanAttackUnlockTimer = null;
        optional(() => this.titanPhaseRecoveryTimer?.remove?.());
        if (!original()) return false;
        this.titanPhaseRecoveryTimer = null;
        optional(() => this.clearBossEncounterTimers());
        optional(() => this.clearBossEncounterEffects());
        if (!original()) return false;
        this.titanAttackLocked = false;
        this.titanRecoveryUntil = 0;
        return finishPeaksCompletion(this);
    }

    startSavedPeakVictory({ isCurrent }) {
        if (!isCurrent()) return false;
        const boss = this.boss, terrain = this.mountainBody, clock = this.time, tweens = this.tweens;
        const body = boss?.body, owner = boss?.scene, active = boss?.active, destroy = boss?.destroy;
        const bodyWorld = body?.world, bodyObject = body?.gameObject, destroyBody = body?.destroy;
        const fields = ['bossNameText', 'bossSubtitle', 'bossHealthBar', 'bossPressureText'];
        const actors = fields.map(name => this[name]);
        const stable = () => isCurrent() && this.time === clock && this.tweens === tweens && this.mountainBody === terrain &&
            fields.every((name, index) => this[name] === actors[index]);
        const current = () => stable() && this.boss === boss && boss?.body === body && boss?.scene === owner && boss?.active === active &&
            boss?.destroy === destroy && body?.world === bodyWorld && body?.gameObject === bodyObject && body?.destroy === destroyBody;
        const optional = action => { if (current()) { try { action(); } catch { /* Saved rewards remain accessible without optional feedback. */ } } };
        const finish = () => {
            if (!current()) return false;
            optional(() => destroy?.call(boss));
            // Native GameObject.destroy retires these exact slots. Only this
            // known transition permits clearing the old scene's boss pointer.
            if (!stable() || this.boss !== boss || boss?.body !== undefined || boss?.scene !== undefined || boss?.active !== false) return false;
            this.boss = null;
            try { if (stable()) terrain?.setVisible(true).clearTint(); } catch { /* Optional terrain feedback. */ }
            if (!stable() || this.boss !== null) return false;
            return this.showBossVictory();
        };
        // Establish the mandatory exit before optional effects can fail.
        if (!this.scheduleGuardianTransition('peaks-saved-victory', 1800, finish)) return false;
        optional(() => { if (boss?.body) boss.body.enable = false; });
        optional(() => boss?.setVelocity?.(0, 0));
        optional(() => boss?.setTint?.(0x8FE3CF));
        optional(() => this.bossPressureText?.setText('VOID PRESSURE // CLEARED'));
        optional(() => window.FeedbackManager?.cameraFlash?.(this, 450, 143, 227, 207));
        optional(() => this.showFloatingText(
            'TITAN ROUTE STABLE',
            boss?.x || 4720,
            (boss?.y || 415) - 110,
            '#8FE3CF'
        ));
        optional(() => window.FXLibrary?.stardustBurst?.(
            this,
            boss?.x || 4720,
            boss?.y || 415,
            {
                count: 36,
                color: [0x8FE3CF, 0xF2C94C, 0xBFA6FF, 0xFFFFFF],
                duration: 1800
            }
        ));
        optional(() => tweens.add({
            targets: boss,
            alpha: 0.12,
            duration: 1800,
            ease: 'Sine.easeInOut'
        }));
        optional(() => tweens.add({
            targets: actors,
            alpha: 0,
            duration: 500
        }));
        return stable();
    }

    showBossVictory() {
        return finishPeaksCompletion.present(this);
    }

    showLevelComplete() {
        return finishPeaksCompletion.present(this);
    }

    shutdown() {
        this.completionSaveAttempt?.retire();
        this.clearTitanEntrance();
        this.clearTitanControlTimers();
        this.clearTitanWindup();
        this.deferredTitanCombat = null;
        this.peakTerrainArt?.forEach(art => art.destroy());
        this.peakTerrainArt = [];
        this.peakTerrainStone = null;
        this.clearLevelEntryKeyHandler();
        this.bossAttackTimer?.remove?.();
        this.bossAttackPreviewTimer?.remove?.();
        this.bossAttackPreviewTimer = null;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.titanOpeningCameraFraming = false;
        this.titanWarningTimer?.remove?.();
        this.titanWarningTimer = null;
        this.titanAttackUnlockTimer?.remove?.();
        this.titanAttackUnlockTimer = null;
        this.titanPhaseRecoveryTimer?.remove?.();
        this.titanPhaseRecoveryTimer = null;
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();
        this.titanAttackLocked = false;
        this.titanRecoveryUntil = 0;
        this.peakHazards = [];
        this.peakReturnCurrents = [];
        this.activePeakReturnCurrent = null;
        this.boss?.destroy?.();
        this.boss = null;
        this.mountainBody?.destroy();
        this.mountainStone?.destroy();
        this.mountainName?.destroy();
        this.mountainSupports?.forEach(platform => platform.destroy());
        this.mountainSupports = [];
        this.mountainBody = null;
        this.mountainStone = null;
        this.mountainName = null;
        this.bossHealthBar?.destroy?.();
        this.bossNameText?.destroy?.();
        this.bossSubtitle?.destroy?.();
        this.bossPressureText?.destroy?.();
        this.bossPressureText = null;
        this.bossIndicator?.destroy?.();
        this.bossIndicator = null;
        this.bossBarConfig = null;
        this.objectiveDisplay?.destroy?.();
        this.objectiveDisplay = null;
        this.beaconRelays.forEach(relay => {
            relay.visual?.destroy?.();
            relay.label?.destroy?.();
            relay.zone?.destroy?.();
        });
        this.beaconRelays = [];
        this.clearCreatureWarningResponse();
        this.replySignals.forEach(signal => signal?.destroy?.());
        this.replySignals = [];
        this.peakStarLayer?.destroy?.();
        this.peakStarLayer = null;
        this.peakStarField = [];
        this.peakEmberLayer?.destroy?.();
        this.peakEmberLayer = null;
        this.peakEmbers = [];
        this.peakEmberDrawNextAt = 0;
        this.peakEmberViewCenterX = Number.NaN;
        this.peakEmberDrawCount = 0;
        this.peakEmberVisibleCount = 0;
        this.peakEnemyAISchedulerActive = false;
        this.peakProximityEnemies = [];
        this.peakEnemyActivationBounds = null;
        this.peakEnemyActivationNextAt = 0;
        this.peakEnemyPatrolNextAt = 0;
        this.peakEnemyPatrolUpdateCount = 0;
        super.shutdown();
        console.log('[VoidPeaksLevel] Shutting down');
    }
}

const finishPeaksCompletion = createPeaksCompletionHandler(Object.freeze({
    prototype: VoidPeaksLevel.prototype,
    methods: Object.freeze(Object.fromEntries(['defeatBoss', 'startSavedPeakVictory', 'showBossVictory', 'showLevelComplete',
        'showRegionalVictorySummary', 'syncCampaignObjectiveDisplay', 'refreshCurrentEcologyNode', 'scheduleGuardianTransition', 'returnToHub']
        .map(name => [name, VoidPeaksLevel.prototype[name]])))
}));

export default VoidPeaksLevel;

if (typeof window !== 'undefined') {
    window.VoidPeaksLevel = VoidPeaksLevel;
}
