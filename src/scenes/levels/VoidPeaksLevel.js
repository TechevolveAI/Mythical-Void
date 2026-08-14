import PlatformerLevelScene from '../PlatformerLevelScene.js';
import { calculateBallisticLaunchVelocity } from '../../systems/TraversalTopology.js';

const COSMIC_TITAN_TEXTURE = 'cosmicTitan';
const COSMIC_TITAN_ASSET = '/game/guardians/cosmic-titan.webp';
const COSMIC_TITAN_DISPLAY_HEIGHT = 300;
const COSMIC_TITAN_MOBILE_DISPLAY_HEIGHT = 240;

const TITAN_ARENA = Object.freeze({
    playerEntryX: 4500,
    introFocusX: 4610,
    bossX: 4720,
    playerBottomOffset: 295,
    bossBottomOffset: 435,
    openingGraceMs: 3000
});

const TITAN_ATTACK_WINDOWS = Object.freeze({
    gravityCrush: 1800,
    starRain: 2600,
    voidPunch: 1500,
    singularity: 1800
});
const TITAN_ATTACK_WINDUP = 700;
const TITAN_RECOVERY_WINDOW = 650;
const TITAN_PHASE_RECOVERY = 1300;

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
        supportId: 'peak-ground-lower-relay',
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
        supportId: 'peak-floor-lower',
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
        supportId: 'peak-ground-titan-pass',
        lane: 'shared',
        offsetX: -450,
        health: 3,
        patrolRange: 110,
        speed: 46
    }),
    Object.freeze({
        beat: 'titan-overlook',
        supportId: 'peak-titan-overlook',
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
            levelHeight: 850,
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
        this.bossFightActive = false;
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossMaxHealth = 15;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.peakHazards = [];
        this.peakReturnCurrents = [];
        this.activePeakReturnCurrent = null;
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
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
        this.bossPressureText = null;
        this.peakEncounterRhythm = [];
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    init(data) {
        super.init(data);

        this.testMode = data?.testMode || false;
        this.starFragmentsCollected = 0;
        this.peakCollectedFragmentMask = 0;
        this.peakRouteChoice = '';
        this.bossDefeated = false;
        this.bossFightActive = false;
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.peakHazards = [];
        this.peakReturnCurrents = [];
        this.activePeakReturnCurrent = null;
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
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

        if (this.player) {
            this.player.setPosition(
                TITAN_ARENA.playerEntryX,
                this.levelHeight - TITAN_ARENA.playerBottomOffset
            );
        }

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

        const subtitle = this.add.text(width / 2, y(92), `"${companionName} hears answers on the wind"`, {
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

        const objective = this.add.text(width / 2, y(172), `Carry ${companionName}'s warning to three settlements`, {
            fontSize: font(19, 16),
            color: '#8FE3CF',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(objective);

        const checklist = this.add.text(contentLeft, y(220), `${
            resume
                ? `[ BEACON ] ${resume.label} link restored`
                : '[ ] Reach the creature signal network'
        }\n[ ] Stabilize the Cosmic Titan\n[ OPTIONAL ] Collect Star Fragments (0/5)`, {
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
            window.GameState?.get?.('creature.name') || 'Your companion'
        ).trim().replace(/\s+/g, ' ').slice(0, 20) || 'Your companion';
    }

    startLevel() {
        console.log('[VoidPeaksLevel] Starting level');
        this.createPeakAtmosphere();
        this.showPlatformerMobileControls();
        this.showObjectiveToast();
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

        const groundY = this.levelHeight - 50;
        // Floor islands are recovery spaces. Wide geyser breaks keep them from becoming a bypass.
        const arrivalGround = this.createPlatform(0, groundY, 620, 80, 'solid');
        arrivalGround.traversalId = 'peak-ground-arrival';
        const lowerRelayGround = this.createPlatform(980, groundY, 520, 80, 'solid');
        lowerRelayGround.traversalId = 'peak-ground-lower-relay';
        const lowerRecoveryIsland = this.createPlatform(1880, groundY, 540, 80, 'solid');
        lowerRecoveryIsland.traversalId = 'peak-floor-lower';
        lowerRecoveryIsland.traversalLinks = ['peak-warning-lower'];
        const summitRecoveryIsland = this.createPlatform(2920, groundY, 460, 80, 'solid');
        summitRecoveryIsland.traversalId = 'peak-floor-summit';
        summitRecoveryIsland.traversalLinks = ['peak-warning-summit'];
        const titanGround = this.createPlatform(3900, groundY, 1300, 80, 'solid');
        titanGround.traversalId = 'peak-ground-titan-pass';

        const ledges = [
            // Keep the first required landing inside the opening mobile view.
            [300, groundY - 145, 210, 'solid', 'peak-opening-step'],
            [600, groundY - 245, 180, 'solid', 'peak-opening-rise'],
            [980, groundY - 150, 460, 'solid', 'peak-lower-relay-overlook'],
            [1560, groundY - 290, 220, 'solid', 'peak-lower-ascent'],
            [1980, groundY - 235, 230, 'solid', 'peak-ridge-approach'],
            [2280, groundY - 365, 320, 'one-way', 'peak-warning-lower'],
            [2780, groundY - 265, 210, 'solid', 'peak-main-handoff'],
            [3180, groundY - 400, 240, 'one-way', 'peak-warning-summit'],
            [3580, groundY - 270, 220, 'solid', 'peak-summit-relay'],
            [4020, groundY - 210, 260, 'solid', 'peak-titan-approach'],
            [4420, groundY - 320, 240, 'solid', 'peak-titan-overlook']
        ];

        ledges.forEach(([x, y, width, type = 'solid', id = null]) => {
            const platform = this.createPlatform(x, y, width, 28, type);
            if (id) platform.traversalId = id;
        });

        // Optional Relic Ridge: a higher, safer line with two Star Fragments.
        const relicRidge = [
            [2640, 345, 180, 'peak-relic-ridge-1'],
            [2910, 280, 190, 'peak-relic-ridge-2'],
            [3190, 250, 200, 'peak-relic-ridge-3'],
            [3440, 350, 180, 'peak-relic-ridge-4']
        ];
        relicRidge.forEach(([x, y, width, id]) => {
            const platform = this.createPlatform(x, y, width, 28, 'one-way');
            platform.traversalId = id;
        });

        this.createBossArena();
        console.log(`[VoidPeaksLevel] Created ${this.platforms.getLength()} platforms`);
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
            { x: 620, width: 360 }, { x: 1500, width: 380 },
            { x: 2420, width: 500 }, { x: 3380, width: 520 }
        ];

        geysers.forEach(({ x, width }) => {
            const y = this.levelHeight - 92;
            const hazard = this.add.zone(x + width / 2, y - 40, width, 90);
            this.physics.add.existing(hazard, true);
            hazard.damage = 1;
            this.peakHazards.push(hazard);

            const visual = this.add.graphics();
            visual.fillStyle(0x4B0082, 0.55);
            visual.fillRoundedRect(x, y - 86, width, 86, 10);
            visual.lineStyle(2, 0xFF4500, 0.75);
            visual.strokeRoundedRect(x, y - 86, width, 86, 10);
            visual.setDepth(120);

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
        const currents = [
            {
                id: 'peak-return-lower',
                x: 2350,
                top: 460,
                bottom: this.levelHeight - 48,
                width: 120,
                destinationId: 'peak-warning-lower'
            },
            {
                id: 'peak-return-summit',
                x: 3260,
                top: 425,
                bottom: this.levelHeight - 48,
                width: 150,
                destinationId: 'peak-warning-summit'
            }
        ];

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
                'RETURN CURRENT\nTO WARNING LINE ↑',
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
        const inLaunchBand = body.bottom >= current.bottom - 90;
        const now = Number(this.time?.now) || 0;

        if (!grounded || !inLaunchBand) return false;
        if (now - current.lastLiftAt < 650) return false;

        current.activations += 1;
        current.lastLiftAt = now;
        this.showFloatingText(
            'RETURN CURRENT // WARNING LINE',
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
            enemy.body.setSize(44, 52, true);
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
        if (this.textures.exists(textureKey)) return;

        const g = this.make.graphics({ add: false });
        g.fillStyle(color, 1);
        g.fillRoundedRect(12, 16, 40, 44, 10);
        g.fillStyle(0xFF4500, 0.85);
        g.fillTriangle(32, 0, 12, 24, 52, 24);
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillCircle(24, 35, 4);
        g.fillCircle(40, 35, 4);
        g.lineStyle(3, 0x9400D3, 0.8);
        g.strokeRoundedRect(12, 16, 40, 44, 10);
        g.generateTexture(textureKey, 64, 70);
        g.destroy();
    }

    createStarFragments() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const positions = [
            [610, this.levelHeight - 240], [1680, this.levelHeight - 395],
            [2730, 300, 'peaks_relic_ridge'],
            [3000, 235, 'peaks_relic_ridge'],
            [3660, this.levelHeight - 355]
        ];

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
        const optional = this.peakRouteChoice === 'main'
            ? this.freeSpecialAttackCharges > 0
                ? 'TITAN SURGE // 1 FREE BLAST READY'
                : 'TITAN SURGE // FREE BLAST SPENT'
            : this.getOptionalRouteStatusText(
                'peaks_relic_ridge',
                `OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`
            );

        if (this.bossDefeated) {
            return `WARNING NETWORK RESTORED\nTHE TITAN IS SAFE\n${optional}`;
        }
        if (this.bossFightActive) {
            return `STABILIZE THE TITAN\nREAD THE NETWORK WARNINGS\n${optional}`;
        }
        if (this.creatureNetworkReached) {
            return `TITAN PASS OPEN\nFOLLOW THE REPLY LIGHTS →\n${optional}`;
        }

        const nextRelay = [
            'LOWER RELAY',
            'RIDGE RELAY',
            'SUMMIT RELAY'
        ][this.beaconRelaysActivated] || 'SUMMIT RELAY';
        const current = Math.min(this.beaconRelaysActivated + 1, 3);
        const compass = this.getOrderedRouteCompassText();
        const title = this.isCompactObjectiveHUD
            ? `WARNING ${current}/3`
            : `WARNING ${current}/3 // ${nextRelay}`;
        return `${title}\n${compass || 'CLIMB TOWARD THE SIGNAL'}\n${optional}`;
    }

    createSignalRelays() {
        const animateRouteDecorations = this.shouldAnimatePeakRouteDecorations();
        const relays = [
            {
                id: 'peaks_relay_1',
                x: 1280,
                y: 605,
                label: 'LOWER RELAY',
                activationSupportIds: ['peak-lower-relay-overlook']
            },
            {
                id: 'peaks_relay_2',
                x: 2380,
                y: 390,
                label: 'RIDGE RELAY',
                activationSupportIds: ['peak-warning-lower']
            },
            {
                id: 'peaks_relay_3',
                x: 3680,
                y: 485,
                label: 'SUMMIT RELAY',
                activationSupportIds: ['peak-summit-relay']
            }
        ];

        relays.forEach((relay, index) => {
            const visual = this.add.graphics();
            visual.setDepth(180);
            this.drawSignalRelay(visual, relay.x, relay.y, false);

            const label = this.add.text(relay.x, relay.y - 94, `${index + 1} // ${relay.label}\nLAND + TRANSMIT`, {
                fontSize: '11px',
                color: '#7E718A',
                fontStyle: 'bold',
                stroke: '#09030E',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setDepth(181);

            const zone = this.createObjectiveTriggerZone(
                relay.x,
                relay.y - 35,
                { width: 150, height: 190 }
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
                            `LAND ON THE LIT PLATFORM // ${beacon.label}`,
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
                x: this.titanGate?.x || 4680,
                y: this.titanGate?.y || this.levelHeight - 158,
                zone: this.titanGate
            }
        ];
    }

    drawSignalRelay(graphics, x, y, activated) {
        graphics.clear();
        const color = activated ? 0x8FE3CF : 0x54395F;

        graphics.fillStyle(color, activated ? 0.22 : 0.1);
        graphics.fillCircle(x, y - 35, 42);
        graphics.lineStyle(4, color, activated ? 1 : 0.7);
        graphics.lineBetween(x, y + 20, x, y - 38);
        graphics.lineBetween(x, y + 20, x - 18, y + 38);
        graphics.lineBetween(x, y + 20, x + 18, y + 38);
        graphics.strokeCircle(x, y - 44, 18);
        graphics.fillStyle(activated ? 0xF2C94C : color, 0.95);
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

        this.showFloatingText(
            `PROJECT BEACON RELAY ${this.beaconRelaysActivated}/3`,
            relay.x,
            relay.y - 120,
            '#8FE3CF'
        );

        const companionName = this.getCompanionName();
        if (this.beaconRelaysActivated === 1) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    `${companionName}: "Warning sent. Stay close."`,
                    relay.x,
                    relay.y - 155,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconRelaysActivated === 2) {
            this.time.delayedCall(650, () => {
                this.showFloatingText(
                    'UNKNOWN REPLY: "RIDGE FALLING. TITAN HOLDING LINE."',
                    relay.x,
                    relay.y - 155,
                    '#D6EEF2'
                );
            });
        } else if (this.beaconRelaysActivated === 3) {
            this.creatureNetworkReached = true;
            this.showDistantReplyNetwork(relay);
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
        const spine = this.add.text(2530, 615, '', {
            fontSize: '12px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(182);

        const relicRoute = this.add.text(2670, 250, '', {
            fontSize: '11px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);

        this.registerOptionalRouteReward({
            id: 'peaks_relic_ridge',
            title: 'RELIC RIDGE',
            required: 2,
            rewardLabel: 'RIDGE GUARD // 1 HIT',
            marker: relicRoute,
            returnLabel: 'WARNING LINE →',
            choice: {
                mainLabel: 'LOW WARNING LINE →',
                mainTradeoff: 'SHORT + RISKY\nEARNS: TITAN SURGE // 1 FREE BLAST',
                challengeLabel: 'HIGH RIDGE // 2 RELICS, FEWER GUARDS',
                mainMarker: spine,
                mainZone: {
                    left: 2440, right: 3420,
                    top: 470, bottom: this.levelHeight
                },
                mainSupportIds: [
                    'peak-main-handoff',
                    'peak-floor-summit'
                ],
                optionalZone: {
                    left: 2520, right: 3500,
                    top: 150, bottom: 470
                },
                optionalSupportIds: ['peak-relic-ridge-1'],
                rejoinZone: {
                    left: 3500, right: 4100,
                    top: 300, bottom: this.levelHeight
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
                    this.showDistantReplyNetwork(relay);
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
            name: 'Signal Egg',
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

    showDistantReplyNetwork(relay) {
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

        this.time.delayedCall(600, () => {
            this.showFloatingText(
                `THREE SETTLEMENTS ANSWER ${this.getCompanionName().toUpperCase()}`,
                relay.x,
                relay.y - 150,
                '#F2C94C'
            );
        });
        this.time.delayedCall(1500, () => {
            this.showFloatingText(
                'They are warning you about the Titan. They want it saved.',
                relay.x,
                relay.y - 185,
                '#D6EEF2'
            );
        });
    }

    createTitanGate() {
        const x = 4680;
        const y = this.levelHeight - 158;
        const gate = this.add.zone(x, y, 150, 190);
        this.physics.add.existing(gate, true);
        this.titanGate = gate;

        this.createGuardianGateState({
            x,
            y,
            title: 'TITAN PASS',
            getStatus: () => 'RESTORE 3 WARNING RELAYS',
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
                            'LAND AT TITAN PASS',
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
                            'Titan Pass is silent. Restore the warning relays.',
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
                    title: 'COSMIC TITAN',
                    checkpoint: this.getTraversalSupportCheckpoint(
                        'peak-titan-gate',
                        4680
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
        const gate = this.createPlatform(
            4230,
            this.levelHeight - 225,
            900,
            35,
            'solid'
        );
        gate.traversalId = 'peak-titan-gate';
        const left = this.createPlatform(
            4300,
            this.levelHeight - 350,
            190,
            28,
            'solid'
        );
        left.traversalId = 'peak-titan-left';
        const right = this.createPlatform(
            4700,
            this.levelHeight - 350,
            190,
            28,
            'solid'
        );
        right.traversalId = 'peak-titan-right';
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
            'Restore the warning relays and reach Titan Pass',
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
        this.updatePeakEnemyActivation();
        super.update(time, delta);
        if (this.levelCompletionActive) return;

        this.drawPeakEmbers(time);
        this.updatePeakReturnCurrentGuidance();

        this.syncCampaignObjectiveDisplay({
            visible: !(this.isCompactObjectiveHUD && this.bossFightActive)
        });
        this.updateBossIndicator();
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
                        'ALL SIGNAL FRAGMENTS - EGG AWAKENED',
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

        console.log('[VoidPeaksLevel] Starting Cosmic Titan boss fight!');
        this.bossFightActive = true;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.bossAttackPreviewTimer?.remove?.();
        this.bossAttackPreviewTimer = null;
        this.titanAttackLocked = true;
        this.retirePeakPatrolsForTitan();
        this.clearGuardianGateState();
        this.physics.pause();
        this.hidePlatformerMobileControls();
        this.stageTitanArenaEntry();
        this.cameras.main.stopFollow();
        this.cameras.main.pan(
            TITAN_ARENA.introFocusX,
            this.levelHeight / 2,
            900
        );
        window.FeedbackManager?.cameraFlash?.(this, 220, 75, 0, 130);
        window.FeedbackManager?.cameraShake?.(this, 450, 0.012);

        const { width, height } = this.cameras.main;
        const warning = this.add.text(
            width / 2,
            height / 2,
            'THE TITAN IS HOLDING THE WARNING LINE',
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

        this.time.delayedCall(900, () => {
            warning.destroy();
            this.spawnCosmicTitan();
        });
    }

    stageTitanArenaEntry() {
        if (!this.player) return false;

        const y = this.levelHeight - TITAN_ARENA.playerBottomOffset;
        if (this.player.body?.reset) {
            this.player.body.reset(TITAN_ARENA.playerEntryX, y);
        } else {
            this.player.setPosition(TITAN_ARENA.playerEntryX, y);
        }
        this.player.setVelocity?.(0, 0);
        this.player.facingRight = true;
        return true;
    }

    spawnCosmicTitan() {
        this.createTitanTexture();

        this.boss = this.physics.add.sprite(
            TITAN_ARENA.bossX,
            this.levelHeight - TITAN_ARENA.bossBottomOffset,
            COSMIC_TITAN_TEXTURE
        );
        this.boss.setImmovable(true);
        this.boss.setCollideWorldBounds(true);
        this.boss.body.setAllowGravity(false);
        const isMobileArena = this.isMobile ||
            this.cameras.main.width <= 480;
        const desktopBossScale = COSMIC_TITAN_DISPLAY_HEIGHT /
            Math.max(1, this.boss.height);
        const mobileBossScale = COSMIC_TITAN_MOBILE_DISPLAY_HEIGHT /
            Math.max(1, this.boss.height);
        this.bossTargetScale = isMobileArena
            ? mobileBossScale
            : desktopBossScale;
        this.boss.body.setSize(
            this.boss.width * 0.4,
            this.boss.height * 0.66
        );
        this.boss.body.setOffset(
            this.boss.width * 0.3,
            this.boss.height * 0.2
        );
        this.boss.setScale(this.bossTargetScale);
        this.boss.health = this.bossMaxHealth;
        this.boss.setDepth(920);

        this.bossHealth = this.bossMaxHealth;
        this.createBossHealthBar();
        this.time.delayedCall(500, () => {
            if (!this.player?.active || !this.cameras.main) return;
            this.cameras.main.pan(
                this.player.x,
                this.player.y,
                1000,
                'Power2',
                true,
                (camera, progress) => {
                    if (progress >= 0.999) {
                        this.beginTitanCombat(camera);
                    }
                }
            );
        });
    }

    beginTitanCombat(camera = this.cameras.main) {
        if (
            this.bossCombatReady ||
            !this.bossFightActive ||
            !this.boss?.active ||
            !this.player?.active
        ) return false;

        this.bossCombatReady = true;
        this.bossCombatReadyAt = this.time.now;
        this.titanAttackLocked = false;
        if (this.isMobile || camera.width <= 480) {
            this.cameraLeadAmount = Math.max(
                this.cameraLeadAmount,
                camera.width * 0.35
            );
        }
        camera.startFollow(this.player, true, 0.08, 0.1);
        camera.setFollowOffset(
            -this.cameraLeadAmount,
            this.cameraBaseOffsetY
        );
        this.currentCameraLeadX = -this.cameraLeadAmount;
        this.targetCameraLeadX = -this.cameraLeadAmount;
        this.physics.resume();
        this.showPlatformerMobileControls();
        this.bossSubtitle?.setText?.(
            'TITAN IN VIEW // READ THE WARNING LINE'
        );

        this.bossAttackPreviewTimer = this.time.delayedCall(
            TITAN_ARENA.openingGraceMs,
            () => {
                this.bossAttackPreviewTimer = null;
                if (this.bossAttackPreview) {
                    this.performTitanAttack(this.bossAttackPreview);
                } else {
                    this.performTitanAttack();
                    this.startTitanAttackLoop();
                }
            }
        );
        console.log('[VoidPeaksLevel] Arena framed; Titan combat enabled');
        return true;
    }

    startTitanAttackLoop() {
        if (!this.bossCombatReady || !this.bossFightActive || this.bossDefeated) {
            return null;
        }
        this.bossAttackTimer?.remove?.();
        this.bossAttackTimer = this.time.addEvent({
            delay: 2600,
            callback: () => this.performTitanAttack(),
            loop: true
        });
        return this.bossAttackTimer;
    }

    createTitanTexture() {
        if (this.textures.exists(COSMIC_TITAN_TEXTURE)) return;

        const g = this.make.graphics({ add: false });
        g.fillStyle(0x16091F, 1);
        g.fillRoundedRect(34, 44, 92, 132, 22);
        g.fillStyle(0x4B0082, 1);
        g.fillTriangle(80, 0, 20, 72, 140, 72);
        g.fillStyle(0xFF4500, 0.9);
        g.fillCircle(58, 86, 9);
        g.fillCircle(102, 86, 9);
        g.fillStyle(0x9400D3, 0.75);
        g.fillCircle(80, 130, 24);
        g.lineStyle(5, 0xFF4500, 0.9);
        g.strokeRoundedRect(34, 44, 92, 132, 22);
        g.generateTexture(COSMIC_TITAN_TEXTURE, 160, 190);
        g.destroy();
    }

    createBossHealthBar() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const barWidth = Math.min(420, width - 80);
        const barX = (width - barWidth) / 2;
        const barY = isMobileLayout ? 118 : 60;
        this.bossBarConfig = { x: barX, y: barY, width: barWidth, height: 18 };

        this.bossNameText = this.add.text(width / 2, barY - 28, 'COSMIC TITAN // HOLDING THE LINE', {
            fontSize: isMobileLayout ? '18px' : '22px',
            color: '#A9F3E4',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);

        this.bossSubtitle = this.add.text(width / 2, barY - 8, 'WARNING LINE ONLINE // WATCH FOR ATTACK CALLS', {
            fontSize: isMobileLayout ? '12px' : '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#D8FFF6',
            stroke: '#160D24',
            strokeThickness: 2
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

        const {
            x,
            y,
            width: barWidth,
            height: barHeight
        } = this.bossBarConfig;
        const ratio = Phaser.Math.Clamp(this.bossHealth / this.bossMaxHealth, 0, 1);

        this.bossHealthBar.clear();
        this.bossHealthBar.fillStyle(0x000000, 0.72);
        this.bossHealthBar.fillRoundedRect(x, y, barWidth, barHeight, 9);
        this.bossHealthBar.fillStyle(0x8B2FC9, 0.95);
        this.bossHealthBar.fillRoundedRect(
            x + 2,
            y + 2,
            Math.max(0, (barWidth - 4) * ratio),
            barHeight - 4,
            7
        );
        this.bossHealthBar.lineStyle(2, 0x8FE3CF, 0.85);
        this.bossHealthBar.strokeRoundedRect(x, y, barWidth, barHeight, 9);
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
        if (!effect) return;
        this.bossEncounterEffects.delete(effect);
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

    clearBossEncounterTimers() {
        this.bossEncounterTimers.forEach(timer => timer?.remove?.(false));
        this.bossEncounterTimers.clear();
    }

    clearBossEncounterEffects() {
        this.bossEncounterEffects.forEach(effect => effect?.destroy?.());
        this.bossEncounterEffects.clear();
    }

    createTitanAttackTelegraph(attack, target) {
        if (!this.boss?.active || !this.player?.active) return null;

        const telegraph = this.trackBossEffect(this.add.graphics());
        const color = attack === 'singularity' ? 0xB66BFF : 0xFF9B45;
        telegraph.lineStyle(5, color, 0.9);
        telegraph.fillStyle(color, 0.16);
        telegraph.setDepth(915);

        if (attack === 'starRain') {
            const warningY = Math.max(80, this.player.y - 260);
            telegraph.fillRect(4100, warningY, 850, 45);
            telegraph.strokeRect(4100, warningY, 850, 45);
        } else if (attack === 'voidPunch') {
            telegraph.lineBetween(this.boss.x, this.boss.y, target.x, target.y);
            telegraph.strokeCircle(this.boss.x, this.boss.y, 72);
        } else if (attack === 'singularity') {
            const x = Phaser.Math.Clamp(target.x, 4120, 4920);
            telegraph.fillCircle(x, this.levelHeight - 260, 82);
            telegraph.strokeCircle(x, this.levelHeight - 260, 82);
        } else {
            telegraph.fillCircle(target.x, this.levelHeight - 82, 70);
            telegraph.strokeCircle(target.x, this.levelHeight - 82, 70);
        }

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
            this.titanAttackLocked ||
            this.time.now < this.titanRecoveryUntil
        ) return;

        const attacks = ['gravityCrush', 'starRain'];
        if (this.bossPhase >= 2) attacks.push('voidPunch');
        if (this.bossPhase >= 3) attacks.push('singularity');

        const attack = forcedAttack || Phaser.Utils.Array.GetRandom(attacks);
        const attackWindow = TITAN_ATTACK_WINDOWS[attack] || 1800;
        const attackTarget = { x: this.player.x, y: this.player.y };
        this.titanAttackLocked = true;
        this.broadcastTitanWarning(attack, attackTarget);

        this.titanAttackUnlockTimer?.remove?.();
        this.titanAttackUnlockTimer = this.time.delayedCall(
            TITAN_ATTACK_WINDUP + attackWindow + TITAN_RECOVERY_WINDOW,
            () => {
                if (!this.titanPhaseRecoveryTimer && !this.bossDefeated) {
                    this.titanAttackLocked = false;
                }
                this.titanAttackUnlockTimer = null;
            }
        );
    }

    broadcastTitanWarning(attack, attackTarget) {
        const warnings = {
            gravityCrush: 'NETWORK WARNING // GROUND IMPACT - MOVE',
            starRain: 'NETWORK WARNING // STAR RAIN - KEEP MOVING',
            voidPunch: 'NETWORK WARNING // TITAN LUNGE - BREAK RANGE',
            singularity: 'NETWORK WARNING // SINGULARITY - CLEAR THE FIELD'
        };

        this.bossSubtitle?.setText?.(warnings[attack] || 'NETWORK WARNING // PRESSURE SURGE');
        const telegraph = this.createTitanAttackTelegraph(attack, attackTarget);
        this.titanWarningTimer?.remove?.();
        this.titanWarningTimer = this.time.delayedCall(TITAN_ATTACK_WINDUP, () => {
            this.titanWarningTimer = null;
            this.releaseBossEffect(telegraph);
            if (!this.boss?.active || this.bossDefeated || this.titanPhaseRecoveryTimer) return;
            this.executeTitanAttack(attack, attackTarget);
            const recoveryDelay = TITAN_ATTACK_WINDOWS[attack] || 1800;
            this.scheduleBossTimer(recoveryDelay, () => {
                if (!this.bossDefeated) {
                    this.titanRecoveryUntil = this.time.now + TITAN_RECOVERY_WINDOW;
                    this.bossSubtitle?.setText?.('RECOVERY WINDOW // PRESS THE ATTACK');
                }
            });
        });
    }

    executeTitanAttack(attack, attackTarget) {
        if (attack === 'gravityCrush') {
            this.gravityCrush(attackTarget);
        } else if (attack === 'starRain') {
            this.starRain();
        } else if (attack === 'voidPunch') {
            this.voidPunch(attackTarget);
        } else {
            this.singularity(attackTarget);
        }
    }

    gravityCrush(attackTarget) {
        const marker = this.trackBossEffect(
            this.add.circle(attackTarget.x, this.levelHeight - 82, 58, 0xFF4500, 0.28)
        );
        marker.setDepth(500);

        this.scheduleBossTimer(650, () => {
            if (!marker.active || this.bossDefeated) {
                this.releaseBossEffect(marker);
                return;
            }
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y);
            if (dist < 115) {
                this.takeDamage(2);
            }
            window.FeedbackManager?.cameraShake?.(this, 180, 0.01);
            this.releaseBossEffect(marker);
        });
    }

    starRain() {
        for (let i = 0; i < 7; i++) {
            this.scheduleBossTimer(i * 120, () => {
                if (this.bossDefeated) return;
                const x = Phaser.Math.Between(4100, 4950);
                const bolt = this.trackBossEffect(
                    this.add.star(x, 40, 5, 8, 18, 0xFF4500, 1)
                );
                this.physics.add.existing(bolt);
                bolt.body.setAllowGravity(false);
                bolt.body.setVelocityY(360);
                bolt.setDepth(910);

                this.physics.add.overlap(this.player, bolt, () => {
                    if (!this.bossDefeated) {
                        this.takeDamage(1);
                    }
                    this.releaseBossEffect(bolt);
                });

                this.scheduleBossTimer(2600, () => {
                    if (bolt.active) this.releaseBossEffect(bolt);
                });
            });
        }
    }

    voidPunch(attackTarget) {
        const direction = attackTarget.x < this.boss.x ? -1 : 1;
        this.boss.setVelocityX(260 * direction);

        this.scheduleBossTimer(450, () => {
            if (!this.boss?.active || this.bossDefeated) return;
            this.boss.setVelocityX(0);
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
            if (dist < 135) {
                this.takeDamage(2);
            }
        });
    }

    singularity(attackTarget) {
        const x = Phaser.Math.Clamp(attackTarget.x, 4120, 4920);
        const field = this.trackBossEffect(
            this.add.circle(x, this.levelHeight - 260, 20, 0x9400D3, 0.55)
        );
        field.setDepth(905);

        this.tweens.add({
            targets: field,
            scaleX: 8,
            scaleY: 8,
            alpha: 0.15,
            duration: 1000,
            onComplete: () => {
                if (this.player?.active && !this.bossDefeated) {
                    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, this.levelHeight - 260);
                    if (dist < 260) {
                        this.takeDamage(3);
                    }
                }
                this.releaseBossEffect(field);
            }
        });
    }

    enterTitanPhase(nextPhase) {
        this.bossPhase = nextPhase;
        this.titanAttackLocked = true;
        this.titanWarningTimer?.remove?.();
        this.titanWarningTimer = null;
        this.titanAttackUnlockTimer?.remove?.();
        this.titanAttackUnlockTimer = null;
        this.titanPhaseRecoveryTimer?.remove?.();
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();
        this.boss?.setVelocity?.(0, 0);

        const phaseColor = nextPhase >= 4 ? 0xFF6B6B : 0xB66BFF;
        const phaseRing = this.trackBossEffect(this.add.graphics());
        phaseRing.lineStyle(7, phaseColor, 0.95);
        phaseRing.strokeCircle(0, 0, 90);
        phaseRing.setPosition(this.boss.x, this.boss.y).setDepth(914).setScale(0.35);
        this.bossSubtitle?.setText?.(`PHASE ${nextPhase} // PRESSURE SHIFT - RECOVER`);
        window.FeedbackManager?.cameraShake?.(this, 350, 0.018);
        this.boss.setScale(
            this.bossTargetScale * (1 + (this.bossPhase - 1) * 0.08)
        );
        this.tweens.add({
            targets: phaseRing,
            scaleX: 2.4,
            scaleY: 2.4,
            alpha: 0,
            duration: TITAN_PHASE_RECOVERY,
            ease: 'Sine.easeOut',
            onComplete: () => this.releaseBossEffect(phaseRing)
        });

        this.titanPhaseRecoveryTimer = this.time.delayedCall(TITAN_PHASE_RECOVERY, () => {
            this.titanPhaseRecoveryTimer = null;
            if (!this.boss?.active || this.bossDefeated) return;
            this.titanAttackLocked = false;
            this.titanRecoveryUntil = this.time.now + TITAN_RECOVERY_WINDOW;
            this.bossSubtitle?.setText?.('RECOVERY WINDOW // PRESS THE ATTACK');
        });
    }

    damageBoss(amount) {
        if (!this.boss?.active || this.bossDefeated) return false;

        const recoveryBonus = this.time.now < this.titanRecoveryUntil ? 1 : 0;
        const finalAmount = amount + recoveryBonus;
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
        const nextPhase = healthRatio <= 0.15 ? 4 : healthRatio <= 0.4 ? 3 : healthRatio <= 0.7 ? 2 : 1;
        if (this.bossHealth > 0 && nextPhase > this.bossPhase) {
            this.enterTitanPhase(nextPhase);
        }

        if (this.bossHealth <= 0) {
            this.defeatBoss();
        }
        return true;
    }

    defeatBoss() {
        if (this.bossDefeated) return;

        console.log('[VoidPeaksLevel] Cosmic Titan restored!');
        this.bossDefeated = true;
        this.bossFightActive = false;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
        this.bossAttackTimer?.remove?.();
        this.bossAttackPreviewTimer?.remove?.();
        this.bossAttackPreviewTimer = null;
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
        this.bossPressureText?.setText('VOID PRESSURE // CLEARED');

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('guardian_restored', { bossId: 'cosmic_titan' });
        }

        if (this.boss?.body) {
            this.boss.body.enable = false;
        }
        this.boss?.setVelocity?.(0, 0);
        this.boss?.setTint?.(0x8FE3CF);
        window.FeedbackManager?.cameraFlash?.(this, 450, 143, 227, 207);
        this.showFloatingText(
            'TITAN SIGNAL STABLE',
            this.boss?.x || 4720,
            (this.boss?.y || 415) - 110,
            '#8FE3CF'
        );

        window.FXLibrary?.stardustBurst?.(
            this,
            this.boss?.x || 4720,
            this.boss?.y || 415,
            {
                count: 36,
                color: [0x8FE3CF, 0xF2C94C, 0xBFA6FF, 0xFFFFFF],
                duration: 1800
            }
        );

        this.tweens.add({
            targets: this.boss,
            alpha: 0.12,
            scale: this.bossTargetScale * 0.88,
            duration: 1800,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.boss?.destroy?.();
                this.boss = null;
                this.showBossVictory();
            }
        });

        this.tweens.add({
            targets: [
                this.bossNameText,
                this.bossSubtitle,
                this.bossHealthBar,
                this.bossPressureText
            ],
            alpha: 0,
            duration: 500
        });
    }

    showBossVictory() {
        this.completeLevelProgression({
            achievementLevelId: 'voidPeaks',
            shipPartId: 'hull_plating',
            speedrunThreshold: 180000
        });

        const layout = this.getLevelModalLayout({ maxWidth: 440, maxHeight: 260 });
        const { width, contentWidth, y, font } = layout;
        const victoryText = this.add.text(width / 2, y(130), 'COSMIC TITAN RESTORED', {
            fontSize: font(32, 25),
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2500).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.6, to: 1 },
            scaleY: { from: 0.6, to: 1 },
            duration: 500,
            yoyo: true,
            hold: 1800,
            onComplete: () => {
                victoryText.destroy();
                this.showLevelComplete();
            }
        });

        window.AudioManager?.playLevelUp?.();
    }

    showLevelComplete() {
        this.bindLevelCompletionReturn();

        this.physics.pause();

        const layout = this.getLevelModalLayout({ maxWidth: 440, maxHeight: 300 });
        const {
            width, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font, buttonPadding
        } = layout;

        const panel = this.add.graphics();
        panel.fillStyle(0x12081F, 0.96);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
        panel.lineStyle(3, 0xFFD700, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
        panel.setScrollFactor(0);
        panel.setDepth(3000);

        this.add.text(width / 2, y(50), 'WARNING NETWORK RESTORED', {
            fontSize: font(28, 23),
            color: '#8FE3CF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const totalRequired = window.GameState?.get('hubWorld.shipParts.totalRequired') || 5;
        this.add.text(
            width / 2,
            y(130),
            `Distant Replies: Confirmed\n` +
            `Network Witness: ${this.getCompanionName()}\n` +
            `Titan's Gift: Hull Plating\n` +
            `Guardian Reward: ${this.levelCompletionResult?.coinsAwarded || 0} Cosmic Coins\n` +
            `Ship Parts: ${shipParts.length}/${totalRequired}\n` +
            this.getVillageCompletionCopy({ compact: true }) + '\n' +
            this.getGuardianSanctuaryArrivalCopy({ compact: true }),
            {
            fontSize: font(18, 16),
            color: '#FFFFFF',
            align: 'center',
            lineSpacing: 8,
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const returnBtn = this.add.text(width / 2, y(250), '[ RETURN TO HUB ]', {
            fontSize: font(20, 17),
            color: '#00CED1',
            backgroundColor: '#0A1A2A',
            padding: buttonPadding
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001).setInteractive({ useHandCursor: true });

        returnBtn.on('pointerdown', () => this.returnToHub());
    }

    shutdown() {
        this.clearLevelEntryKeyHandler();
        this.bossAttackTimer?.remove?.();
        this.bossAttackPreviewTimer?.remove?.();
        this.bossAttackPreviewTimer = null;
        this.bossCombatReady = false;
        this.bossCombatReadyAt = 0;
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

export default VoidPeaksLevel;

if (typeof window !== 'undefined') {
    window.VoidPeaksLevel = VoidPeaksLevel;
}
