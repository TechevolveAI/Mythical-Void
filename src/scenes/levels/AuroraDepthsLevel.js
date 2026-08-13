import PlatformerLevelScene from '../PlatformerLevelScene.js';

const SHADOW_PHOENIX_TEXTURE = 'shadowPhoenix';
const SHADOW_PHOENIX_ASSET = '/game/guardians/shadow-phoenix.webp';
const SHADOW_PHOENIX_DISPLAY_SIZE = 230;

const PHOENIX_ATTACK_WINDOWS = Object.freeze({
    flame_dive: 1900,
    shadow_feathers: 1700,
    fire_trail: 2500,
    rebirth_nova: 1900,
    shadow_clones: 2200
});

const PHOENIX_ATTACK_CUES = Object.freeze({
    flame_dive: 'FLAME DIVE // DODGE ACROSS ITS PATH',
    shadow_feathers: 'SHADOW FEATHERS // MOVE THROUGH THE GAPS',
    fire_trail: 'SHADOW FIRE // LEAVE THE GROUND PATH',
    rebirth_nova: 'REBIRTH RING // JUMP THROUGH THE WAVE',
    shadow_clones: 'ECHO DIVES // KEEP MOVING'
});
const PHOENIX_ATTACK_WINDUP = 700;
const PHOENIX_RECOVERY_WINDOW = 650;
const PHOENIX_PHASE_RECOVERY = 1300;

/**
 * AuroraDepthsLevel - Aurora Depths platformer level
 *
 * Story: Deep beneath the aurora, Project Beacon's uplink begins carrying
 * farther than expected. The companion quietly bends the signal away from
 * the sky while the Phoenix shields the reactor from the Void.
 *
 * Features:
 * - Aurora light effects and color-shifting atmosphere
 * - Floating crystal platforms
 * - Three companion-aligned signal prisms and safe checkpoints
 * - Aurora Phoenix guardian restoration
 * - Aurora Reactor offered after the uplink is contained
 */
class AuroraDepthsLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'AuroraDepthsLevel',
            levelId: 'aurora_depths_1',
            biomeId: 'aurora_depths',
            levelWidth: 5000,
            levelHeight: 800,
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
        this.auroraReactorFound = false;
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossBody = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 12;
        this.bossPhase = 1;
        this.bossAITimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossSubtitle = null;
        this.bossExposureText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossPhaseRecoveryTimer = null;
        this.bossRecoveryUntil = 0;
        this.bossEncounterEffects = new Set();
        this.bossEncounterTimers = new Set();
        this.bossAttackPreview = null;
        this.bossBarConfig = null;
        this.bossIndicator = null;
        this.bossTargetScale = 1;

        // Aurora effects
        this.auroraLights = [];
        this.colorShiftTime = 0;
        this.signalPrisms = [];
        this.prismsAligned = 0;
        this.uplinkRiskUnderstood = false;
        this.routeHintUntil = 0;
        this.reactorGateHintUntil = 0;
        this.reactorTriggerZone = null;
        this.auroraFragments = null;
        this.auroraEggAwarded = false;
        this.shadowCurrents = [];
        this.quietLightClaimed = false;
        this.optionalRoutePickup = null;
        this.optionalRoutePickupLabel = null;
        this.optionalRoutePickupTween = null;
        this.optionalRoutePickupOverlap = null;
        this.auroraRouteChoice = null;
        this.currentChargeReady = false;
        this.currentChargeDamage = 2;
        this.currentChargeAura = null;
        this.currentChargeAuraTween = null;
        this.traversalLandingGuides = [];
        this.objectiveDisplay = null;
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    init(data) {
        super.init(data);

        this.testMode = data?.testMode || false;

        this.starFragmentsCollected = 0;
        this.bossDefeated = false;
        this.auroraReactorFound = false;
        this.bossFightActive = false;

        this.boss = null;
        this.bossBody = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAITimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossSubtitle = null;
        this.bossExposureText = null;
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer = null;
        this.bossPhaseRecoveryTimer = null;
        this.bossRecoveryUntil = 0;
        this.bossEncounterEffects = new Set();
        this.bossEncounterTimers = new Set();
        this.bossAttackPreview = [
            'flame_dive',
            'shadow_feathers',
            'fire_trail',
            'rebirth_nova',
            'shadow_clones'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;
        this.bossBarConfig = null;
        this.bossIndicator = null;
        this.bossTargetScale = 1;

        this.auroraLights = [];
        this.colorShiftTime = 0;
        this.signalPrisms = [];
        this.prismsAligned = 0;
        this.uplinkRiskUnderstood = false;
        this.routeHintUntil = 0;
        this.reactorGateHintUntil = 0;
        this.reactorTriggerZone = null;
        this.auroraFragments = null;
        this.auroraEggAwarded = false;
        this.shadowCurrents = [];
        this.quietLightClaimed = false;
        this.optionalRoutePickup = null;
        this.optionalRoutePickupLabel = null;
        this.optionalRoutePickupTween = null;
        this.optionalRoutePickupOverlap = null;
        this.auroraRouteChoice = null;
        this.currentChargeReady = false;
        this.currentChargeDamage = 2;
        this.currentChargeAura = null;
        this.currentChargeAuraTween = null;
        this.traversalLandingGuides = [];
        this.objectiveDisplay = null;
        this.levelEntryDismissing = false;
        this.clearLevelEntryKeyHandler();

        console.log('[AuroraDepthsLevel] Level state reset');
    }

    preload() {
        super.preload();
        this.load.image(SHADOW_PHOENIX_TEXTURE, SHADOW_PHOENIX_ASSET);
    }

    create() {
        super.create();

        if (this.prepareCurrentEcologyPreview()) return;

        if (!this.entryPreview && window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'auroraDepths' });
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
        console.log('[AuroraDepthsLevel] TEST MODE - Starting Phoenix restoration');
        this.createAuroraBackground();
        this.prismsAligned = 3;
        this.uplinkRiskUnderstood = true;

        if (this.player) {
            this.player.setPosition(
                Math.max(80, this.getTestBossSpawnX() - 420),
                this.levelHeight - 360
            );
        }

        this.showPlatformerMobileControls();

        this.time.delayedCall(500, () => this.startBossFight());
    }

    getTestBossSpawnX() {
        const width = this.cameras.main.width;
        return width <= 480 ? width - 110 : width / 2 + 200;
    }

    showLevelEntry() {
        this.levelEntryDismissing = false;
        const layout = this.getLevelModalLayout({ maxWidth: 470, maxHeight: 400 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, contentRight, y, font, buttonPadding
        } = layout;
        const resume = this.getExpeditionResumePresentation();
        const companionName = this.getCompanionName();

        this.physics.pause();

        // Track ALL elements for proper cleanup
        const entryElements = [];

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);
        entryElements.push(overlay);

        const panel = this.add.graphics();
        panel.fillStyle(0x0A1A2A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x00E676, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);
        entryElements.push(panel);

        const title = this.add.text(width / 2, y(50), 'AURORA DEPTHS', {
            fontSize: font(36, 28),
            color: '#00E676',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(title);

        const subtitle = this.add.text(width / 2, y(90), `"${companionName} lowers the light toward home"`, {
            fontSize: font(16, 14),
            color: '#7FFFD4',
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
                : 'PROJECT BEACON // EXPEDITION 05',
            {
            fontSize: font(13, 11),
            color: '#8FA5A0',
            align: 'center',
            wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(mission);

        const mainObj = this.add.text(width / 2, y(172), `Help ${companionName} contain an uplink that can reach Earth`, {
            fontSize: font(20, 17),
            color: '#7FFFD4',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(mainObj);

        const obj1 = this.add.text(contentLeft, y(220), `${
            resume
                ? `[ BEACON ] ${resume.label} link restored`
                : '[ ] Trace the uplink without broadcasting'
        }\n[ ] Restore the Phoenix guardian\n[ OPTIONAL ] Collect Aurora Fragments (0/5)`, {
            fontSize: font(16, 14),
            color: '#AAAAAA',
            lineSpacing: 8,
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);
        entryElements.push(obj1);

        const enterBtn = this.add.text(
            width / 2,
            y(350),
            resume ? '[ RESUME EXPEDITION ]' : '[ DESCEND INTO THE AURORA ]',
            {
            fontSize: font(20, 16),
            color: '#00E676',
            backgroundColor: '#0A1A2A',
            padding: buttonPadding
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });
        entryElements.push(enterBtn);

        enterBtn.on('pointerover', () => enterBtn.setColor('#7FFFD4'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#00E676'));

        // Dismiss function - used by button and tap anywhere
        const dismissEntry = () => {
            if (this.levelEntryDismissing) return;

            this.levelEntryDismissing = true;
            enterBtn.disableInteractive();
            overlay.disableInteractive();
            this.clearLevelEntryKeyHandler();
            this.physics.resume();
            this.showPlatformerMobileControls();
            this.startLevel();
            this.tweens.add({
                targets: entryElements,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    entryElements.forEach(el => {
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
        console.log('[AuroraDepthsLevel] Starting level');
        this.createAuroraBackground();
        this.createLevelSpecificContentOnce();
        this.showObjectiveToast();
    }

    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        const groundY = this.levelHeight - 50;
        const recoveryGround = [
            [0, 810, 'aurora-ground-1'],
            [960, 1060, 'aurora-ground-2'],
            [2190, 1040, 'aurora-ground-3'],
            [3410, 1590, 'aurora-ground-4']
        ];
        recoveryGround.forEach(([x, width, id]) => {
            const platform = this.createPlatform(
                x,
                groundY,
                width,
                80,
                'solid'
            );
            platform.traversalId = id;
        });

        const ledges = [
            [180, groundY - 140, 320, 'aurora-opening-step'],
            [620, groundY - 250, 240, 'aurora-opening-rise'],
            [980, groundY - 165, 280, 'aurora-lower-prism'],
            [1370, groundY - 285, 240, 'aurora-lower-relay'],
            [1740, groundY - 200, 300, 'aurora-heart-approach'],
            [2140, groundY - 320, 240, 'aurora-heart-rise'],
            [2530, groundY - 140, 360, 'aurora-heart-launch'],
            [3420, groundY - 110, 240, 'aurora-sky-rejoin'],
            [3700, groundY - 165, 260, 'aurora-sky-prism'],
            [4140, groundY - 220, 300, 'aurora-phoenix-gate'],
            [4550, groundY - 340, 240, 'aurora-phoenix-overlook']
        ];

        // A short high route avoids the third shadow current and rejoins
        // before the Sky Prism. Every gap stays inside the normal jump arc.
        const quietLightRoute = [
            [2780, groundY - 270, 210, 'aurora-quiet-step-1'],
            [3040, groundY - 380, 220, 'aurora-quiet-step-2'],
            [3310, groundY - 320, 210, 'aurora-quiet-step-3']
        ];

        [...ledges, ...quietLightRoute].forEach(([x, y, width, id = null]) => {
            const platform = this.createPlatform(x, y, width, 28, 'one-way');
            if (id) platform.traversalId = id;
        });

        console.log(`[AuroraDepthsLevel] Created ${this.platforms.getLength()} platforms`);
    }

    getTraversalSupportCheckpoint(id, fallbackX) {
        const support = this.getTraversalSupport(id);
        return {
            x: Phaser.Math.Clamp(
                Number(fallbackX) || support?.x || 120,
                (support?.body?.left || 40) + 30,
                (support?.body?.right || this.levelWidth - 40) - 30
            ),
            y: (support?.body?.top || this.levelHeight - 50) - 76
        };
    }

    createTraversalLandingGuide(id, color = 0x7FFFD4) {
        const support = this.getTraversalSupport(id);
        if (!support?.body) return null;

        const visual = this.add.graphics().setDepth(179);
        const left = support.body.left + 14;
        const right = support.body.right - 14;
        const top = support.body.top - 5;
        visual.lineStyle(4, color, 0.95);
        visual.lineBetween(left, top, right, top);
        visual.fillStyle(color, 0.92);
        visual.fillTriangle(
            support.x - 8,
            top - 13,
            support.x + 8,
            top - 13,
            support.x,
            top - 2
        );
        const tween = this.tweens.add({
            targets: visual,
            alpha: { from: 0.55, to: 1 },
            duration: 720,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        const guide = { id, visual, tween };
        this.traversalLandingGuides.push(guide);
        return guide;
    }

    createAuroraBackground() {
        const { width, height } = this.cameras.main;

        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(-100);

        // Deep blue to teal gradient
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(10 + ratio * 20);
            const g = Math.floor(30 + ratio * 60);
            const b = Math.floor(50 + ratio * 40);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        // Aurora lights
        this.createAuroraLights();
    }

    createAuroraLights() {
        const { width, height } = this.cameras.main;

        for (let i = 0; i < 5; i++) {
            const aurora = this.add.graphics();
            aurora.setScrollFactor(0.2 + i * 0.1);
            aurora.setDepth(-50 + i);
            aurora.setAlpha(0.3);

            const auroraData = {
                graphics: aurora,
                x: Math.random() * width,
                baseY: height * 0.3 + Math.random() * height * 0.2,
                width: 200 + Math.random() * 300,
                colorIndex: i
            };

            this.auroraLights.push(auroraData);
        }

        // Animate aurora
        this.time.addEvent({
            delay: 50,
            callback: () => this.updateAuroraLights(),
            loop: true
        });
    }

    updateAuroraLights() {
        this.colorShiftTime += 0.02;

        const colors = [0x00E676, 0x7FFFD4, 0x00FA9A, 0xFFD700, 0x00CED1];

        this.auroraLights.forEach((aurora, i) => {
            aurora.graphics.clear();

            const colorIndex = Math.floor((this.colorShiftTime + i) % colors.length);
            const color = colors[colorIndex];

            aurora.graphics.fillStyle(color, 0.2 + Math.sin(this.colorShiftTime + i) * 0.1);

            // Wavy aurora shape
            aurora.graphics.beginPath();
            aurora.graphics.moveTo(aurora.x, aurora.baseY + 100);

            for (let x = 0; x < aurora.width; x += 20) {
                const waveY = aurora.baseY + Math.sin((x + this.colorShiftTime * 50) * 0.02) * 30;
                aurora.graphics.lineTo(aurora.x + x, waveY);
            }

            aurora.graphics.lineTo(aurora.x + aurora.width, aurora.baseY + 100);
            aurora.graphics.closePath();
            aurora.graphics.fillPath();
        });
    }

    update(time, delta) {
        if (this.bossBody?.active && this.boss?.active) {
            this.bossBody.setPosition(this.boss.x, this.boss.y + 35);
        }

        super.update(time, delta);
        if (this.levelCompletionActive) return;

        if (this.objectiveDisplay) {
            this.objectiveDisplay.setText(this.getAuroraObjectiveText());
            this.objectiveDisplay.setVisible(
                !(this.isCompactObjectiveHUD && this.bossFightActive)
            );
        }
        if (this.currentChargeAura?.active && this.player?.active) {
            this.currentChargeAura.setPosition(this.player.x, this.player.y);
        }
        this.updateBossIndicator();
    }

    createLevelContent() {
        this.createShadowCurrents();
        this.createAuroraSentinels();
        this.createAuroraFragments();
        this.createSignalPrisms();
        this.createQuietLightRoute();
        this.createBossArena();
    }

    createAuroraSentinels() {
        const groundY = this.levelHeight - 110;
        const encounters = [
            { x: 1460, y: groundY, health: 1, patrolRange: 105, speed: 38 },
            { x: 2810, y: groundY, health: 2, patrolRange: 120, speed: 42 },
            { x: 3920, y: groundY, health: 3, patrolRange: 120, speed: 46 }
        ];

        this.createPatrolSentinels(encounters, {
            enemyType: 'auroraSentinel',
            texturePrefix: 'auroraSentinel',
            bodyColor: 0x173D49,
            accentColor: 0x7FFFD4,
            eyeColor: 0xF2C94C,
            instructionText: 'GOLD MARK // STOMP OR STRIKE'
        });
    }

    createQuietLightRoute() {
        const groundY = this.levelHeight - 50;
        const route = this.add.graphics().setDepth(105);

        route.lineStyle(5, 0x7FFFD4, 0.58);
        route.beginPath();
        route.moveTo(2640, groundY - 150);
        route.lineTo(2885, groundY - 290);
        route.lineTo(3150, groundY - 390);
        route.lineTo(3415, groundY - 330);
        route.lineTo(3590, groundY - 175);
        route.strokePath();

        [2885, 3150, 3415].forEach((x, index) => {
            const y = [groundY - 290, groundY - 390, groundY - 330][index];
            route.fillStyle(index === 2 ? 0xF2C94C : 0xA9F3E4, 0.95);
            route.fillCircle(x, y, index === 2 ? 7 : 5);
        });

        this.tweens.add({
            targets: route,
            alpha: { from: 0.55, to: 1 },
            duration: 1100,
            yoyo: true,
            repeat: -1
        });

        const directRouteMarker = this.add.text(2820, groundY - 82, '', {
            fontSize: '11px',
            color: '#C9A7E8',
            fontStyle: 'bold',
            stroke: '#061319',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);
        const quietLightMarker = this.add.text(2820, groundY - 235, '', {
            fontSize: '12px',
            color: '#A9F3E4',
            fontStyle: 'bold',
            stroke: '#061319',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(182);
        this.registerOptionalRouteReward({
            id: 'aurora_quiet_light',
            title: 'QUIET LIGHT HIGH ROUTE',
            required: 1,
            rewardLabel: 'QUIET LIGHT WARD // 1 HIT',
            marker: quietLightMarker,
            returnLabel: 'DESCEND TO SKY PRISM →',
            choice: {
                mainLabel: 'SHADOW CURRENT →',
                mainTradeoff: 'DIRECT // NEXT PHOENIX HIT +2',
                challengeLabel: 'HIGH JUMPS + CURRENT SHELTER',
                mainMarker: directRouteMarker,
                mainZone: {
                    left: 2700, right: 3500,
                    top: groundY - 180, bottom: this.levelHeight
                },
                mainSupportIds: ['aurora-ground-3'],
                optionalZone: {
                    left: 2700, right: 3500,
                    top: 200, bottom: groundY - 180
                },
                optionalSupportIds: ['aurora-quiet-step-1'],
                rejoinZone: {
                    left: 3500, right: 3900,
                    top: 300, bottom: this.levelHeight
                },
                rejoinSupportIds: [
                    'aurora-sky-rejoin',
                    'aurora-sky-prism'
                ]
            },
            onMainSelected: () => {
                this.selectAuroraRoute('shadow_current');
            },
            onOptionalSelected: () => {
                this.selectAuroraRoute('quiet_light');
            },
            onComplete: () => {
                this.grantOptionalRouteGuard('QUIET LIGHT WARD', 1);
                this.refreshPersistedExpeditionRouteState();
            }
        });

        const shelter = this.add.circle(
            3415,
            groundY - 330,
            18,
            0xF2C94C,
            0.95
        ).setDepth(720);
        shelter.setStrokeStyle(4, 0x7FFFD4, 0.9);
        this.physics.add.existing(shelter);
        shelter.body.setAllowGravity(false);
        shelter.body.setCircle(24, -6, -6);
        shelter.optionalRouteId = 'aurora_quiet_light';
        this.optionalRoutePickup = shelter;

        const shelterLabel = this.add.text(
            shelter.x,
            shelter.y - 38,
            'CURRENT SHELTER',
            {
                fontSize: '11px',
                color: '#F2C94C',
                fontStyle: 'bold',
                stroke: '#061319',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(721);
        this.optionalRoutePickupLabel = shelterLabel;

        this.optionalRoutePickupTween = this.tweens.add({
            targets: [shelter, shelterLabel],
            y: '-=10',
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.optionalRoutePickupOverlap = this.physics.add.overlap(
            this.player,
            shelter,
            () => {
                if (
                    this.quietLightClaimed ||
                    this.auroraRouteChoice === 'shadow_current' ||
                    !shelter.active
                ) return;
                if (!this.isPlayerGroundedOnTraversalSupport(
                    'aurora-quiet-step-3'
                )) return;

                this.quietLightClaimed = true;
                this.selectAuroraRoute('quiet_light');
                const rewardX = shelter.x;
                const rewardY = shelter.y;
                this.clearQuietLightPickup();
                this.recordOptionalRouteProgress('aurora_quiet_light', {
                    x: rewardX,
                    y: rewardY
                });
                window.FXLibrary?.stardustBurst?.(this, rewardX, rewardY, {
                    count: 22,
                    color: [0xF2C94C, 0x7FFFD4, 0xFFFFFF],
                    duration: 1000
                });
                window.AchievementSystem?.recordEvent?.('story_interaction', {
                    event: 'aurora_quiet_light_route'
                });
            }
        );
    }

    clearQuietLightPickup() {
        this.optionalRoutePickupOverlap?.destroy?.();
        this.optionalRoutePickupOverlap = null;
        this.optionalRoutePickupTween?.remove?.();
        this.optionalRoutePickupTween = null;
        this.optionalRoutePickup?.destroy?.();
        this.optionalRoutePickupLabel?.destroy?.();
        this.optionalRoutePickup = null;
        this.optionalRoutePickupLabel = null;
    }

    selectAuroraRoute(choice) {
        if (!['quiet_light', 'shadow_current'].includes(choice)) return false;
        if (this.auroraRouteChoice) return this.auroraRouteChoice === choice;

        this.auroraRouteChoice = choice;
        if (choice === 'shadow_current') {
            this.currentChargeReady = true;
            this.createCurrentChargeAura();
            this.clearQuietLightPickup();
            this.showFloatingText(
                'CURRENT CHARGE // NEXT PHOENIX HIT +2',
                this.player.x,
                this.player.y - 68,
                '#D7A8FF'
            );
            window.FXLibrary?.stardustBurst?.(this, this.player.x, this.player.y, {
                count: 20,
                color: [0xC9A7E8, 0x7FFFD4, 0xFFFFFF],
                duration: 850
            });
        }
        this.refreshPersistedExpeditionRouteState();
        window.AchievementSystem?.recordEvent?.('story_interaction', {
            event: choice === 'quiet_light'
                ? 'aurora_quiet_light_route_selected'
                : 'aurora_shadow_current_route'
        });
        return true;
    }

    clearCurrentChargeAura() {
        this.currentChargeAuraTween?.remove?.();
        this.currentChargeAuraTween = null;
        this.currentChargeAura?.destroy?.();
        this.currentChargeAura = null;
    }

    createCurrentChargeAura() {
        this.clearCurrentChargeAura();
        if (!this.player?.active) return null;

        const aura = this.add.graphics()
            .setPosition(this.player.x, this.player.y)
            .setDepth(755);
        aura.lineStyle(4, 0xC9A7E8, 0.92);
        aura.strokeCircle(0, 0, 34);
        aura.lineStyle(2, 0x7FFFD4, 0.8);
        aura.strokeCircle(0, 0, 43);
        aura.lineBetween(-30, 18, -43, 28);
        aura.lineBetween(30, -18, 43, -28);
        this.currentChargeAuraTween = this.tweens.add({
            targets: aura,
            scale: { from: 0.88, to: 1.12 },
            alpha: { from: 0.55, to: 1 },
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.currentChargeAura = aura;
        return aura;
    }

    consumeCurrentCharge() {
        if (!this.currentChargeReady) return 0;

        this.currentChargeReady = false;
        this.clearCurrentChargeAura();
        this.refreshPersistedExpeditionRouteState();
        window.FXLibrary?.stardustBurst?.(this, this.boss.x, this.boss.y, {
            count: 26,
            color: [0xC9A7E8, 0x7FFFD4, 0xFFFFFF],
            duration: 900
        });
        return this.currentChargeDamage;
    }

    getExpeditionRouteState() {
        if (!this.auroraRouteChoice) return null;
        const quietRoute = this.optionalRouteRewards?.get?.(
            'aurora_quiet_light'
        );
        return {
            auroraRouteChoice: this.auroraRouteChoice,
            currentChargeReady: this.currentChargeReady === true,
            quietLightRewardClaimed: quietRoute?.completed === true,
            quietLightGuardCharges: this.auroraRouteChoice === 'quiet_light'
                ? this.optionalRouteGuardCharges
                : 0
        };
    }

    onOptionalRouteGuardConsumed() {
        if (this.auroraRouteChoice === 'quiet_light') {
            this.refreshPersistedExpeditionRouteState();
        }
    }

    restoreAuroraRouteChoice(routeState) {
        const choice = routeState?.auroraRouteChoice;
        if (!['quiet_light', 'shadow_current'].includes(choice)) return false;

        this.auroraRouteChoice = choice;
        const route = this.optionalRouteRewards?.get?.('aurora_quiet_light');
        const routeChoice = route?.choice;
        if (routeChoice) {
            routeChoice.selectedPath = choice === 'quiet_light'
                ? 'optional'
                : 'main';
            routeChoice.optionalEntered = choice === 'quiet_light';
            routeChoice.mainEntered = choice === 'shadow_current';
            routeChoice.sequence = 1;
        }

        if (choice === 'shadow_current') {
            this.currentChargeReady = routeState?.currentChargeReady === true;
            this.clearQuietLightPickup();
            if (this.currentChargeReady) this.createCurrentChargeAura();
        } else if (routeState?.quietLightRewardClaimed === true) {
            this.quietLightClaimed = true;
            this.optionalRouteGuardCharges = Phaser.Math.Clamp(
                Number(routeState?.quietLightGuardCharges) || 0,
                0,
                1
            );
            if (route) {
                route.progress = route.required;
                route.completed = true;
                this.refreshOptionalRouteReward(route);
            }
            this.clearQuietLightPickup();
        }
        return true;
    }

    createHUD() {
        super.createHUD();

        // Keep objectives readable above the playfield and mobile controls.
        const { width, height } = this.cameras.main;
        const isShortLandscape = width > height && height < 620;
        this.isCompactObjectiveHUD = this.isMobile || width <= 480 || height < 620;
        this.objectiveDisplay = this.add.text(
            width - (this.isCompactObjectiveHUD ? 12 : 20),
            this.isCompactObjectiveHUD ? (isShortLandscape ? 76 : 72) : 20,
            this.getAuroraObjectiveText(),
            {
                fontSize: this.isCompactObjectiveHUD ? '12px' : '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#EFFFFB',
                backgroundColor: 'rgba(6, 24, 31, 0.92)',
                padding: { x: 10, y: 7 },
                lineSpacing: 2,
                align: 'left',
                wordWrap: {
                    width: this.isCompactObjectiveHUD ? 215 : 340
                }
            }
        ).setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);
    }

    getAuroraObjectiveText() {
        const routeReward = this.getOptionalRouteStatusText(
            'aurora_quiet_light',
            'OPTIONAL // QUIET LIGHT WARD'
        );
        const routeStatus = this.auroraRouteChoice === 'shadow_current'
            ? (this.currentChargeReady
                ? 'DIRECT ROUTE // CURRENT CHARGE +2'
                : 'DIRECT ROUTE // CHARGE RELEASED')
            : routeReward;
        const optional = `${routeStatus}\nOPTIONAL // AURORA FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`;

        if (this.bossDefeated) {
            return `QUIET UPLINK READY\nEARTH CONTACT NOT TRANSMITTED\n${optional}`;
        }
        if (this.bossFightActive) {
            return `STABILIZE THE PHOENIX\nKEEP THE UPLINK SHIELDED\n${optional}`;
        }
        if (this.uplinkRiskUnderstood) {
            return `UPLINK CONTAINED // EXPOSURE 0%\nEARTH CAN BE REACHED BY CHOICE\n${optional}`;
        }

        const nextPrism = [
            'LOWER PRISM',
            'HEART PRISM',
            'SKY PRISM'
        ][this.prismsAligned] || 'SKY PRISM';
        const current = Math.min(this.prismsAligned + 1, 3);
        const exposure = Math.max(0, 100 - this.prismsAligned * 33);
        const compass = this.getOrderedRouteCompassText();
        const title = this.isCompactObjectiveHUD
            ? `ALIGNMENT ${current}/3`
            : `QUIET ALIGNMENT ${current}/3 // ${nextPrism}`;
        return `${title}\n${compass || `EXPOSURE ${exposure}% // KEEP THE BEAM DOWN`}\n${optional}`;
    }

    showObjectiveToast() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const toast = this.add.text(
            width / 2,
            isMobileLayout ? 165 : 90,
            'Align the aurora prisms without opening the uplink',
            {
                fontSize: isMobileLayout ? '16px' : '18px',
                color: '#F2C94C',
                backgroundColor: 'rgba(4, 18, 25, 0.82)',
                padding: { x: 16, y: 8 },
                align: 'center',
                wordWrap: { width: width - 40 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2500);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 60,
            delay: 2800,
            duration: 600,
            onComplete: () => toast.destroy()
        });
    }

    createShadowCurrents() {
        const currents = [
            { x: 810, width: 150 },
            { x: 2020, width: 170 },
            { x: 3230, width: 180 }
        ];

        currents.forEach(({ x, width }) => {
            const y = this.levelHeight - 88;
            const zone = this.add.zone(x + width / 2, y, width, 76);
            this.physics.add.existing(zone, true);

            const visual = this.add.graphics();
            visual.fillStyle(0x2D1748, 0.72);
            visual.fillRoundedRect(x, y - 28, width, 56, 12);
            visual.lineStyle(2, 0x7FFFD4, 0.45);
            visual.strokeRoundedRect(x, y - 28, width, 56, 12);
            visual.setDepth(110);

            this.tweens.add({
                targets: visual,
                alpha: { from: 0.45, to: 0.9 },
                duration: 950,
                yoyo: true,
                repeat: -1
            });

            this.physics.add.overlap(this.player, zone, () => {
                if (!this.isInvincible && !this.bossDefeated) {
                    this.takeDamage(1);
                }
            });
            this.shadowCurrents.push({ zone, visual });
        });
    }

    createAuroraFragments() {
        this.auroraFragments = this.physics.add.group();
        const positions = [
            [740, this.levelHeight - 340],
            [1490, this.levelHeight - 395],
            [2260, this.levelHeight - 435],
            [3060, this.levelHeight - 465],
            [3870, this.levelHeight - 415]
        ];

        positions.forEach(([x, y], index) => {
            const fragment = this.add.star(x, y, 5, 7, 18, 0xF2C94C, 1);
            fragment.fragmentIndex = index;
            fragment.setDepth(700);
            this.physics.add.existing(fragment);
            fragment.body.setAllowGravity(false);
            fragment.body.setSize(32, 32);
            this.auroraFragments.add(fragment);

            this.tweens.add({
                targets: fragment,
                angle: 360,
                y: y - 12,
                duration: 1600,
                repeat: -1,
                yoyo: true
            });
        });

        this.physics.add.overlap(
            this.player,
            this.auroraFragments,
            this.collectAuroraFragment,
            null,
            this
        );
    }

    collectAuroraFragment(player, fragment) {
        if (!fragment?.active) return;

        const collectX = fragment.x;
        const collectY = fragment.y;
        this.starFragmentsCollected++;
        fragment.destroy();

        window.FXLibrary?.stardustBurst?.(this, collectX, collectY, {
            count: 18,
            color: [0xF2C94C, 0x7FFFD4, 0xFFFFFF],
            duration: 1200
        });
        this.showFloatingText(
            `AURORA FRAGMENT ${this.starFragmentsCollected}/${this.totalStarFragments}`,
            collectX,
            collectY - 30,
            '#F2C94C'
        );
        window.AudioManager?.playCollect?.();

        if (
            this.starFragmentsCollected >= this.totalStarFragments &&
            !this.auroraEggAwarded
        ) {
            this.auroraEggAwarded = true;
            this.time.delayedCall(450, () => {
                this.showFloatingText(
                    'THE QUIET LIGHT GATHERS AROUND AN EGG',
                    collectX,
                    collectY - 75,
                    '#A9F3E4'
                );
                window.InventoryManager?.addItem?.({
                    id: 'quiet_aurora_egg',
                    name: 'Quiet Aurora Egg',
                    type: 'egg',
                    rarity: 'rare',
                    description: 'An egg sheltered inside the light your companion turned away from the sky.',
                    icon: '🥚🌌'
                });
                window.AudioManager?.playAchievement?.();
            });
        }
    }

    createSignalPrisms() {
        const prisms = [
            {
                id: 'aurora_prism_1',
                x: 1150,
                y: 610,
                label: 'LOWER PRISM',
                activationSupportIds: ['aurora-lower-prism']
            },
            {
                id: 'aurora_prism_2',
                x: 2710,
                y: 580,
                label: 'HEART PRISM',
                activationSupportIds: ['aurora-heart-launch']
            },
            {
                id: 'aurora_prism_3',
                x: 3820,
                y: 560,
                label: 'SKY PRISM',
                activationSupportIds: ['aurora-sky-prism']
            }
        ];

        prisms.forEach((prism, index) => {
            const visual = this.add.graphics();
            visual.setDepth(180);
            this.drawSignalPrism(visual, prism.x, prism.y, false);

            const label = this.add.text(
                prism.x,
                prism.y - 100,
                `${index + 1} // ${prism.label}\nLAND + ALIGN`,
                {
                    fontSize: '11px',
                    color: '#87A49E',
                    fontStyle: 'bold',
                    stroke: '#061319',
                    strokeThickness: 3,
                    align: 'center'
                }
            ).setOrigin(0.5).setDepth(181);

            const zone = this.createObjectiveTriggerZone(
                prism.x,
                prism.y - 35,
                { width: 160, height: 210 }
            );

            const signalPrism = {
                ...prism,
                index,
                visual,
                label,
                zone,
                landingGuide: this.createTraversalLandingGuide(
                    prism.activationSupportIds[0]
                ),
                aligned: false
            };
            this.physics.add.overlap(this.player, zone, () => {
                if (!this.isPlayerGroundedOnTraversalSupport(
                    signalPrism.activationSupportIds
                )) {
                    const now = this.time.now;
                    if (now >= this.routeHintUntil) {
                        this.showFloatingText(
                            `LAND ON THE LIT PLATFORM // ${signalPrism.label}`,
                            signalPrism.x,
                            signalPrism.y - 135,
                            '#F2C94C'
                        );
                        this.routeHintUntil = now + 1400;
                    }
                    return;
                }
                this.alignSignalPrism(signalPrism);
            });
            this.signalPrisms.push(signalPrism);
        });

        this.refreshPrismRouteReadability();
    }

    drawSignalPrism(graphics, x, y, aligned) {
        graphics.clear();
        const color = aligned ? 0xA9F3E4 : 0x385A5B;

        graphics.fillStyle(color, aligned ? 0.24 : 0.12);
        graphics.fillCircle(x, y - 42, 48);
        graphics.lineStyle(4, color, aligned ? 1 : 0.65);
        graphics.strokeTriangle(x, y - 88, x - 28, y - 20, x + 28, y - 20);
        graphics.lineBetween(x, y - 20, x, y + 34);
        graphics.lineBetween(x, y + 34, x - 18, y + 48);
        graphics.lineBetween(x, y + 34, x + 18, y + 48);
        graphics.fillStyle(aligned ? 0xF2C94C : color, 0.95);
        graphics.fillCircle(x, y - 50, 8);

        if (aligned) {
            graphics.lineStyle(2, 0x7FFFD4, 0.7);
            // The companion refracts the uplink into the Fend instead of the sky.
            graphics.lineBetween(x, y - 50, x, y + 58);
            graphics.lineBetween(x, y + 58, x - 34, y + 92);
            graphics.fillStyle(0xF2C94C, 0.9);
            graphics.fillTriangle(
                x - 34,
                y + 99,
                x - 43,
                y + 82,
                x - 24,
                y + 88
            );
            graphics.strokeCircle(x, y - 50, 38);
        }
    }

    retireTraversalLandingGuide(prism) {
        prism?.landingGuide?.tween?.remove?.();
        prism?.landingGuide?.visual?.setAlpha?.(0.18);
    }

    alignSignalPrism(prism) {
        if (!prism || prism.aligned) return;

        if (!this.canActivateOrderedRouteSignal(
            prism,
            this.signalPrisms,
            this.prismsAligned,
            {
                fallbackLabel: 'FOLLOW THE AURORA PRISMS',
                hintOffsetY: -125
            }
        )) {
            return;
        }

        prism.aligned = true;
        prism.zone?.destroy?.();
        prism.zone = null;
        this.retireTraversalLandingGuide(prism);
        this.prismsAligned++;
        this.drawSignalPrism(prism.visual, prism.x, prism.y, true);
        this.refreshPrismRouteReadability();
        const checkpoint = this.getTraversalSupportCheckpoint(
            prism.activationSupportIds[0],
            prism.x
        );
        this.setCheckpoint(checkpoint.x, checkpoint.y, {
            persist: true,
            checkpointId: prism.id,
            checkpointIndex: prism.index
        });

        this.showFloatingText(
            `AURORA PRISM ${this.prismsAligned}/3 ALIGNED`,
            prism.x,
            prism.y - 125,
            '#A9F3E4'
        );

        const companionName = this.getCompanionName();
        const companionLines = [
            `${companionName}: "Project Beacon can reach Earth from here."`,
            `${companionName}: "If Earth hears this, anyone can. Help me turn it down."`,
            `${companionName}: "It is quiet. The choice can wait."`
        ];
        this.time.delayedCall(600, () => {
            this.showFloatingText(
                companionLines[prism.index],
                prism.x,
                prism.y - 165,
                prism.index === 2 ? '#F2C94C' : '#D8FFF6'
            );
        });

        if (this.prismsAligned === 3) {
            this.uplinkRiskUnderstood = true;
            this.time.delayedCall(1350, () => {
                this.showFloatingText(
                    'EARTH CONTACT POSSIBLE // NOTHING TRANSMITTED',
                    prism.x,
                    prism.y - 205,
                    '#F2C94C'
                );
            });
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'beacon_exposure_risk_discovered'
            });
        }

        window.AudioManager?.playAchievement?.();
    }

    refreshPrismRouteReadability() {
        return this.refreshOrderedRouteSignals(
            this.signalPrisms,
            this.prismsAligned,
            {
                activeProperty: 'aligned',
                completeColor: '#A9F3E4',
                futureColor: '#87A49E'
            }
        );
    }

    getTraversalAuditTargets() {
        const shelter = {
            id: 'aurora_quiet_light_shelter',
            label: 'QUIET LIGHT SHELTER',
            optional: true,
            activationSupportIds: ['aurora-quiet-step-3'],
            x: this.optionalRoutePickup?.x || 3415,
            y: this.optionalRoutePickup?.y || this.levelHeight - 380,
            body: this.optionalRoutePickup?.body
        };
        return [
            ...this.signalPrisms,
            shelter,
            {
                id: 'aurora_reactor_gate',
                label: 'PHOENIX REACTOR',
                activationSupportIds: ['aurora-phoenix-gate'],
                x: this.reactorTriggerZone?.x || 4320,
                y: this.reactorTriggerZone?.y || this.levelHeight / 2,
                zone: this.reactorTriggerZone
            }
        ].sort((left, right) => Number(left.x) - Number(right.x));
    }

    restoreExpeditionRouteState(resume) {
        const restored = this.restoreExpeditionRouteSignals(resume, {
            signals: this.signalPrisms,
            activeProperty: 'aligned',
            countProperty: 'prismsAligned',
            readyProperty: 'uplinkRiskUnderstood',
            labelColor: '#A9F3E4',
            drawSignal: prism => {
                this.drawSignalPrism(prism.visual, prism.x, prism.y, true);
                this.retireTraversalLandingGuide(prism);
            },
            onRestored: () => {
                this.restoreAuroraRouteChoice(resume?.routeState);
                this.refreshPrismRouteReadability();
                this.objectiveDisplay?.setText?.(this.getAuroraObjectiveText());
            }
        });
        return restored;
    }

    createBossArena() {
        const arenaX = 4000;
        const arenaWidth = 800;
        const groundY = this.levelHeight - 100;

        const arena = this.add.graphics();
        arena.fillStyle(0x1A3A4A, 1);
        arena.fillRect(arenaX, groundY, arenaWidth, 100);

        // Glowing crystal floor
        arena.fillStyle(0x00E676, 0.3);
        for (let i = 0; i < 30; i++) {
            const crystalX = arenaX + Math.random() * arenaWidth;
            arena.fillTriangle(crystalX - 10, groundY, crystalX, groundY - 15, crystalX + 10, groundY);
        }

        const triggerZone = this.add.zone(
            arenaX + 320,
            this.levelHeight / 2,
            150,
            this.levelHeight
        );
        this.physics.add.existing(triggerZone, true);
        this.reactorTriggerZone = triggerZone;
        this.createGuardianGateState({
            x: arenaX + 320,
            y: groundY - 70,
            title: 'PHOENIX SHIELD',
            getStatus: () => 'ALIGN 3 AURORA PRISMS',
            isReady: () => this.uplinkRiskUnderstood,
            color: 0x00E676,
            readyColor: 0xF2C94C
        });
        this.createTraversalLandingGuide('aurora-phoenix-gate', 0xF2C94C);

        if (this.player) {
            this.physics.add.overlap(this.player, triggerZone, () => {
                if (!this.bossFightActive && !this.bossDefeated) {
                    if (!this.isPlayerGroundedOnTraversalSupport(
                        'aurora-phoenix-gate'
                    )) {
                        const now = this.time.now;
                        if (now >= this.reactorGateHintUntil) {
                            this.showFloatingText(
                                'LAND AT THE PHOENIX GATE',
                                this.player.x,
                                this.player.y - 70,
                                '#F2C94C'
                            );
                            this.reactorGateHintUntil = now + 1400;
                        }
                        return;
                    }
                    if (!this.uplinkRiskUnderstood) {
                        const now = this.time.now;
                        if (now >= this.reactorGateHintUntil) {
                            this.showFloatingText(
                                'The Phoenix keeps its shield raised. Align the aurora prisms.',
                                this.player.x,
                                this.player.y - 70,
                                '#F2C94C'
                            );
                            this.reactorGateHintUntil = now + 1800;
                        }
                        return;
                    }
                    const guardianEntered = this.beginGuardianEncounter({
                        id: 'shadow_phoenix',
                        title: 'AURORA PHOENIX',
                        checkpoint: this.getTraversalSupportCheckpoint(
                            'aurora-phoenix-gate',
                            arenaX + 320
                        ),
                        start: () => this.startBossFight()
                    });
                    if (guardianEntered) {
                        triggerZone.destroy();
                        this.reactorTriggerZone = null;
                    }
                }
            });
        }
    }

    startBossFight() {
        if (this.bossFightActive || this.bossDefeated) return;

        console.log('[AuroraDepthsLevel] Starting Aurora Phoenix restoration!');
        this.bossFightActive = true;

        this.physics.pause();
        window.FeedbackManager?.cameraFlash?.(this, 220, 0, 230, 118);

        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, 'THE PHOENIX IS SHIELDING THE UPLINK', {
            fontSize: width <= 480 ? '20px' : '30px',
            color: '#F2C94C',
            fontStyle: 'bold',
            stroke: '#061319',
            strokeThickness: 4,
            backgroundColor: 'rgba(4, 18, 25, 0.86)',
            padding: { x: 14, y: 9 },
            align: 'center',
            wordWrap: { width: width - 50 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        window.FeedbackManager?.cameraShake?.(this, 650, 0.012);

        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        this.tweens.add({
            targets: warningText,
            alpha: 0,
            delay: 900,
            duration: 300,
            onComplete: () => warningText.destroy()
        });

        this.time.delayedCall(1200, () => {
            if (this.bossDefeated) return;
            this.spawnShadowPhoenix();
            this.physics.resume();
        });
    }

    /**
     * Keep a procedural fallback so a failed asset request cannot block combat.
     */
    ensureShadowPhoenixTexture() {
        const textureKey = SHADOW_PHOENIX_TEXTURE;
        if (this.textures.exists(textureKey)) return textureKey;

        const graphics = this.make.graphics({ add: false });
        const size = 150;
        const centerX = size / 2;
        const centerY = size / 2;

        // Outer fire glow
        graphics.fillStyle(0xFF4500, 0.3);
        graphics.fillCircle(centerX, centerY, size / 2);

        // Shadow aura
        graphics.fillStyle(0x4B0082, 0.2);
        graphics.fillCircle(centerX, centerY + 10, size / 2 - 10);

        // Main body (dark bird shape)
        graphics.fillStyle(0x2F1F4F, 1);

        // Body oval
        graphics.fillEllipse(centerX, centerY + 10, 60, 40);

        // Head
        graphics.fillCircle(centerX, centerY - 25, 25);

        // Beak
        graphics.fillStyle(0xFF6B00, 1);
        graphics.fillTriangle(centerX - 5, centerY - 25, centerX + 5, centerY - 25, centerX, centerY - 40);

        // Eyes (glowing orange)
        graphics.fillStyle(0xFF4500, 1);
        graphics.fillCircle(centerX - 10, centerY - 28, 6);
        graphics.fillCircle(centerX + 10, centerY - 28, 6);

        // Eye glow
        graphics.fillStyle(0xFFD700, 1);
        graphics.fillCircle(centerX - 10, centerY - 28, 3);
        graphics.fillCircle(centerX + 10, centerY - 28, 3);

        // Wings (spread)
        graphics.fillStyle(0x4B0082, 1);

        // Left wing
        graphics.beginPath();
        graphics.moveTo(centerX - 20, centerY);
        graphics.lineTo(centerX - 70, centerY - 30);
        graphics.lineTo(centerX - 65, centerY - 10);
        graphics.lineTo(centerX - 55, centerY + 10);
        graphics.lineTo(centerX - 20, centerY + 15);
        graphics.closePath();
        graphics.fillPath();

        // Right wing
        graphics.beginPath();
        graphics.moveTo(centerX + 20, centerY);
        graphics.lineTo(centerX + 70, centerY - 30);
        graphics.lineTo(centerX + 65, centerY - 10);
        graphics.lineTo(centerX + 55, centerY + 10);
        graphics.lineTo(centerX + 20, centerY + 15);
        graphics.closePath();
        graphics.fillPath();

        // Wing fire edges
        graphics.fillStyle(0xFF4500, 0.8);
        graphics.fillTriangle(centerX - 70, centerY - 30, centerX - 75, centerY - 45, centerX - 60, centerY - 25);
        graphics.fillTriangle(centerX - 65, centerY - 10, centerX - 72, centerY - 20, centerX - 55, centerY - 5);
        graphics.fillTriangle(centerX + 70, centerY - 30, centerX + 75, centerY - 45, centerX + 60, centerY - 25);
        graphics.fillTriangle(centerX + 65, centerY - 10, centerX + 72, centerY - 20, centerX + 55, centerY - 5);

        // Tail feathers (fire)
        graphics.fillStyle(0xFF4500, 1);
        graphics.fillTriangle(centerX - 15, centerY + 30, centerX - 25, centerY + 70, centerX - 5, centerY + 35);
        graphics.fillTriangle(centerX, centerY + 35, centerX, centerY + 80, centerX + 10, centerY + 40);
        graphics.fillTriangle(centerX + 15, centerY + 30, centerX + 25, centerY + 70, centerX + 5, centerY + 35);

        // Inner tail glow
        graphics.fillStyle(0xFFD700, 0.7);
        graphics.fillTriangle(centerX - 10, centerY + 35, centerX - 15, centerY + 55, centerX - 2, centerY + 38);
        graphics.fillTriangle(centerX + 10, centerY + 35, centerX + 15, centerY + 55, centerX + 2, centerY + 38);

        // Crown flames
        graphics.fillStyle(0xFF4500, 1);
        graphics.fillTriangle(centerX - 15, centerY - 45, centerX - 20, centerY - 65, centerX - 10, centerY - 48);
        graphics.fillTriangle(centerX, centerY - 48, centerX, centerY - 70, centerX + 5, centerY - 50);
        graphics.fillTriangle(centerX + 15, centerY - 45, centerX + 20, centerY - 65, centerX + 10, centerY - 48);

        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();

        return textureKey;
    }

    spawnShadowPhoenix() {
        console.log('[AuroraDepthsLevel] Spawning Shadow Phoenix!');

        const textureKey = this.ensureShadowPhoenixTexture();

        const { width } = this.cameras.main;
        const spawnX = this.testMode
            ? this.getTestBossSpawnX()
            : 4620;
        const spawnY = this.levelHeight - 250;

        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.bossTargetScale = SHADOW_PHOENIX_DISPLAY_SIZE /
            Math.max(1, this.boss.width);
        this.boss.body.setSize(this.boss.width * 0.34, this.boss.height * 0.5);
        this.boss.body.setOffset(this.boss.width * 0.33, this.boss.height * 0.2);
        this.boss.setScale(this.bossTargetScale);
        this.boss.body.setAllowGravity(false); // Phoenix floats

        // Keep combat targeting independent of transparent artwork bounds and flips.
        this.bossBody = this.add.zone(spawnX, spawnY + 35, 160, 210);
        this.physics.add.existing(this.bossBody);
        this.bossBody.body.setAllowGravity(false);
        this.bossBody.body.setImmovable(true);

        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.boss.isAttacking = false;
        this.boss.facingRight = false;

        if (this.platforms) {
            this.physics.add.collider(this.boss, this.platforms);
        }

        if (this.player) {
            this.physics.add.overlap(this.player, this.boss, this.handleBossCollision, null, this);
        }

        this.createBossHealthBar();

        this.boss.setAlpha(0);
        this.boss.setScale(this.bossTargetScale * 0.4);

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: this.bossTargetScale,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                if (this.bossAttackPreview) {
                    this.time.delayedCall(800, () => {
                        this.executeBossAttack(this.bossAttackPreview);
                    });
                } else {
                    this.startBossAI();
                }
                window.FeedbackManager?.cameraShake?.(this, 300, 0.01);

                if (window.AudioManager) {
                    window.AudioManager.playError();
                }
            }
        });

        this.createBossAmbientEffects();
    }

    createBossAmbientEffects() {
        if (!this.boss) return;

        const glow = this.add.graphics();
        glow.setDepth(this.boss.depth - 1);

        const updateGlow = () => {
            if (!this.boss || !glow.active) return;

            glow.clear();
            glow.setPosition(this.boss.x, this.boss.y);

            // Fire glow
            glow.fillStyle(0xFF4500, 0.2 + Math.sin(this.time.now * 0.005) * 0.1);
            glow.fillCircle(0, 0, 100);

            // Shadow aura
            glow.fillStyle(0x4B0082, 0.15);
            glow.fillCircle(0, 20, 80);
        };

        this.time.addEvent({
            delay: 50,
            callback: updateGlow,
            loop: true
        });

        this.bossGlow = glow;
    }

    createBossHealthBar() {
        const { width: screenWidth, height: screenHeight } = this.cameras.main;
        const isMobileLayout =
            this.isMobile || screenWidth <= 480 || screenHeight < 620;
        const barWidth = Math.min(380, screenWidth - 80);
        const barHeight = 18;
        const barX = (screenWidth - barWidth) / 2;
        const barY = isMobileLayout ? 118 : 60;
        this.bossBarConfig = {
            x: barX,
            y: barY,
            width: barWidth,
            height: barHeight
        };

        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        this.bossNameText = this.add.text(screenWidth / 2, barY - 28, 'AURORA PHOENIX // SHIELDING US', {
            fontSize: isMobileLayout ? '18px' : '22px',
            color: '#A9F3E4',
            fontStyle: 'bold',
            stroke: '#061319',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        this.bossSubtitle = this.add.text(screenWidth / 2, barY - 8, 'BREAK VOID PRESSURE // KEEP THE UPLINK QUIET', {
            fontSize: isMobileLayout ? '12px' : '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#D8FFF6',
            stroke: '#061319',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.bossUI.add(this.bossSubtitle);

        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x1A1A3E, 0.9);
        bgBar.fillRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        bgBar.lineStyle(2, 0xFF4500, 1);
        bgBar.strokeRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        this.bossUI.add(bgBar);

        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        this.bossExposureText = this.add.text(screenWidth / 2, barY + 9, '', {
            fontSize: isMobileLayout ? '11px' : '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#061319',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.bossUI.add(this.bossExposureText);

        this.updateBossHealthBar();
        this.createBossIndicator();
    }

    updateBossHealthBar() {
        if (!this.bossHealthBar || !this.bossBarConfig) return;

        const {
            x: barX,
            y: barY,
            width: barWidth,
            height: barHeight
        } = this.bossBarConfig;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const currentWidth = barWidth * healthPercent;
        const exposure = Math.max(0, Math.ceil(this.bossHealth));

        // This meter tracks the Void's exposure pressure, not Phoenix life.
        this.bossHealthBar.fillStyle(0xA86BFF, 1);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight, 6);

        this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight / 2, { tl: 6, tr: 6, bl: 0, br: 0 });
        this.bossExposureText?.setText(
            exposure > 0
                ? `UPLINK EXPOSURE // ${exposure}/${this.bossMaxHealth}`
                : 'UPLINK EXPOSURE // CONTAINED'
        );
    }

    createBossIndicator() {
        const { width, height } = this.cameras.main;
        this.bossIndicator = this.add.text(width - 14, height / 2, 'PHOENIX >', {
            fontSize: width <= 480 ? '13px' : '15px',
            color: '#F2C94C',
            backgroundColor: 'rgba(4, 18, 25, 0.82)',
            padding: { x: 7, y: 5 },
            fontStyle: 'bold'
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(1499).setVisible(false);
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
                .setText('PHOENIX >')
                .setPosition(camera.width - 14, camera.height / 2)
                .setOrigin(1, 0.5)
                .setVisible(true);
        } else if (bossScreenX < -padding) {
            this.bossIndicator
                .setText('< PHOENIX')
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

    trackBossTimer(timer) {
        if (timer) this.bossEncounterTimers.add(timer);
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

    createPhoenixAttackTelegraph(attackType, attackTarget) {
        if (!this.boss?.active || !this.player?.active) return null;

        const telegraph = this.trackBossEffect(this.add.graphics());
        const color = attackType === 'rebirth_nova' ? 0xFF6B45 : 0xFFD166;
        telegraph.lineStyle(5, color, 0.92);
        telegraph.fillStyle(color, 0.14);
        telegraph.setDepth(875);

        if (attackType === 'flame_dive') {
            telegraph.lineBetween(this.boss.x, this.boss.y, attackTarget.x, attackTarget.y);
            telegraph.strokeCircle(attackTarget.x, attackTarget.y, 42);
        } else if (attackType === 'shadow_feathers') {
            const baseAngle = Math.atan2(
                attackTarget.y - this.boss.y,
                attackTarget.x - this.boss.x
            );
            [-0.3, 0, 0.3].forEach(offset => {
                telegraph.lineBetween(
                    this.boss.x,
                    this.boss.y,
                    this.boss.x + Math.cos(baseAngle + offset) * 260,
                    this.boss.y + Math.sin(baseAngle + offset) * 260
                );
            });
        } else if (attackType === 'fire_trail') {
            const direction = attackTarget.direction;
            telegraph.fillRect(
                direction > 0 ? this.boss.x : this.boss.x - 300,
                this.levelHeight - 155,
                300,
                45
            );
        } else if (attackType === 'shadow_clones') {
            telegraph.strokeCircle(this.boss.x - 105, this.boss.y, 52);
            telegraph.strokeCircle(this.boss.x + 105, this.boss.y, 52);
        } else {
            telegraph.strokeCircle(this.boss.x, this.boss.y, 95);
            telegraph.strokeCircle(this.boss.x, this.boss.y, 135);
        }

        this.tweens.add({
            targets: telegraph,
            alpha: 0.25,
            duration: 180,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
        return telegraph;
    }

    startBossHover() {
        if (!this.boss?.active || this.bossDefeated) return;
        this.tweens.add({
            targets: this.boss,
            y: this.boss.y - 30,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    startBossAI() {
        console.log('[AuroraDepthsLevel] Starting Shadow Phoenix AI');

        this.bossAITimer = this.time.addEvent({
            delay: 2200,
            callback: () => this.bossAITick(),
            loop: true
        });

        this.startBossHover();
    }

    bossAITick() {
        if (!this.boss || this.bossDefeated || !this.bossFightActive) return;

        if (this.player && this.boss) {
            this.boss.facingRight = this.player.x > this.boss.x;
            this.boss.setFlipX(!this.boss.facingRight);
        }

        const attacks = ['flame_dive', 'shadow_feathers', 'fire_trail'];
        if (this.bossPhase >= 2) {
            attacks.push('rebirth_nova');
        }
        if (this.bossPhase >= 3) {
            attacks.push('shadow_clones');
        }

        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        this.executeBossAttack(attack);
    }

    executeBossAttack(attackType) {
        if (
            !this.boss?.active ||
            !this.player?.active ||
            this.boss.isAttacking ||
            this.bossDefeated ||
            this.time.now < this.bossRecoveryUntil
        ) return;

        this.boss.isAttacking = true;
        const attackWindow = PHOENIX_ATTACK_WINDOWS[attackType] || 1900;
        const attackTarget = {
            x: this.player.x,
            y: this.player.y,
            direction: this.boss.facingRight ? 1 : -1
        };
        this.tweens.killTweensOf(this.boss);
        this.boss.setVelocity?.(0, 0);
        this.showBossAttackInstruction(
            PHOENIX_ATTACK_CUES[attackType],
            PHOENIX_ATTACK_WINDUP + attackWindow + PHOENIX_RECOVERY_WINDOW
        );
        const telegraph = this.createPhoenixAttackTelegraph(attackType, attackTarget);

        this.scheduleBossTimer(PHOENIX_ATTACK_WINDUP, () => {
            this.releaseBossEffect(telegraph);
            if (!this.boss?.active || this.bossDefeated || this.bossPhaseRecoveryTimer) return;
            this.dispatchBossAttack(attackType, attackTarget);
        });
        this.scheduleBossTimer(PHOENIX_ATTACK_WINDUP + attackWindow, () => {
            if (!this.boss?.active || this.bossDefeated) return;
            this.bossRecoveryUntil = this.time.now + PHOENIX_RECOVERY_WINDOW;
            this.bossSubtitle
                ?.setText('RECOVERY WINDOW // BREAK VOID PRESSURE')
                ?.setColor('#D8FFF6');
        });

        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = this.time.delayedCall(
            PHOENIX_ATTACK_WINDUP + attackWindow + PHOENIX_RECOVERY_WINDOW,
            () => {
                if (this.boss?.active && !this.bossDefeated) {
                    this.boss.isAttacking = false;
                    this.startBossHover();
                }
                this.bossAttackUnlockTimer = null;
            }
        );
    }

    dispatchBossAttack(attackType, attackTarget) {
        const attacks = {
            flame_dive: () => this.bossFlameDive(attackTarget),
            shadow_feathers: () => this.bossShadowFeathers(attackTarget),
            fire_trail: () => this.bossFireTrail(attackTarget),
            rebirth_nova: () => this.bossRebirthNova(),
            shadow_clones: () => this.bossShadowClones()
        };
        attacks[attackType]?.();
    }

    showBossAttackInstruction(cue, duration = 1900) {
        if (!cue || !this.bossSubtitle) return;

        this.bossInstructionTimer?.remove?.();
        this.bossSubtitle
            .setText(cue)
            .setColor('#FFD166')
            .setScale(1.04);
        this.tweens.add({
            targets: this.bossSubtitle,
            scaleX: 1,
            scaleY: 1,
            duration: 180,
            ease: 'Sine.easeOut'
        });
        if (this.bossAttackPreview) return;

        this.bossInstructionTimer = this.time.delayedCall(
            Math.max(PHOENIX_ATTACK_WINDUP, duration - PHOENIX_RECOVERY_WINDOW),
            () => {
                this.bossSubtitle
                    ?.setText('RECOVERY WINDOW // BREAK VOID PRESSURE')
                    ?.setColor('#D8FFF6');
                this.bossInstructionTimer = null;
            }
        );
    }

    bossFlameDive(attackTarget) {
        if (!this.boss?.active || !this.player?.active || this.bossDefeated) return;

        const targetX = attackTarget.x;
        const targetY = attackTarget.y;

        this.tweens.add({
            targets: this.boss,
            x: targetX,
            y: targetY,
            duration: 300,
            onComplete: () => {
                if (!this.boss?.active || this.bossDefeated) return;
                if (this.player?.active && Math.abs(this.player.x - this.boss.x) < 50 && Math.abs(this.player.y - this.boss.y) < 50) {
                    this.handlePlayerDamage(1);
                }

                this.tweens.add({
                    targets: this.boss,
                    y: this.levelHeight - 250,
                    duration: 500
                });
            }
        });
    }

    bossShadowFeathers(attackTarget) {
        if (!this.boss?.active || !this.player?.active || this.bossDefeated) return;

        const count = this.bossPhase >= 2 ? 7 : 5;
        const angleSpread = Math.PI * 0.6;
        const baseAngle = Math.atan2(
            attackTarget.y - this.boss.y,
            attackTarget.x - this.boss.x
        );

        for (let i = 0; i < count; i++) {
            const angle = baseAngle - angleSpread / 2 + (angleSpread / (count - 1)) * i;

            const feather = this.trackBossEffect(this.add.graphics());
            feather.fillStyle(0x4B0082, 1);
            feather.fillTriangle(-5, 0, 5, 0, 0, 20);
            feather.setPosition(this.boss.x, this.boss.y);
            feather.setDepth(850);
            feather.rotation = angle + Math.PI / 2;

            const speed = 350;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            this.tweens.add({
                targets: feather,
                x: feather.x + vx,
                y: feather.y + vy,
                duration: 1000,
                onUpdate: () => {
                    if (this.bossDefeated) {
                        this.releaseBossEffect(feather);
                        return;
                    }
                    if (this.player?.active && Math.abs(this.player.x - feather.x) < 20 && Math.abs(this.player.y - feather.y) < 20) {
                        this.handlePlayerDamage(1);
                        this.releaseBossEffect(feather);
                    }
                },
                onComplete: () => {
                    if (feather.active) this.releaseBossEffect(feather);
                }
            });
        }
    }

    bossFireTrail(attackTarget) {
        if (!this.boss?.active || this.bossDefeated) return;

        const direction = attackTarget.direction;

        for (let i = 0; i < 5; i++) {
            this.scheduleBossTimer(i * 150, () => {
                if (!this.boss?.active || this.bossDefeated) return;
                const flame = this.trackBossEffect(this.add.graphics());
                flame.fillStyle(0xFF4500, 0.8);
                flame.fillCircle(0, 0, 25);
                flame.fillStyle(0xFFD700, 0.5);
                flame.fillCircle(0, 0, 15);
                flame.setPosition(this.boss.x + direction * i * 60, this.levelHeight - 130);
                flame.setDepth(100);

                // Damage zone
                this.trackBossTimer(this.time.addEvent({
                    delay: 100,
                    repeat: 10,
                    callback: () => {
                        if (!flame.active || this.bossDefeated) return;
                        if (this.player?.active && Math.abs(this.player.x - flame.x) < 30 && this.player.y > this.levelHeight - 180) {
                            this.handlePlayerDamage(1);
                        }
                    }
                }));

                this.tweens.add({
                    targets: flame,
                    alpha: 0,
                    scale: 0.5,
                    duration: 1500,
                    onComplete: () => this.releaseBossEffect(flame)
                });
            });
        }
    }

    bossRebirthNova() {
        if (!this.boss?.active || this.bossDefeated) return;

        window.FeedbackManager?.cameraFlash?.(this, 500, 255, 69, 0);

        const { width, height } = this.cameras.main;
        const warning = this.trackBossEffect(this.add.text(width / 2, height / 3, 'REBIRTH RING // JUMP', {
            fontSize: '28px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000));

        this.tweens.add({
            targets: warning,
            alpha: 0,
            duration: 1500,
            onComplete: () => this.releaseBossEffect(warning)
        });

        // Expanding fire ring
        const ring = this.trackBossEffect(this.add.graphics());
        ring.setPosition(this.boss.x, this.boss.y);
        ring.setDepth(850);

        let radius = 0;
        this.trackBossTimer(this.time.addEvent({
            delay: 30,
            repeat: 30,
            callback: () => {
                if (!ring.active || this.bossDefeated || !this.boss?.active) {
                    this.releaseBossEffect(ring);
                    return;
                }
                radius += 15;
                ring.clear();
                ring.lineStyle(8, 0xFF4500, 1 - radius / 500);
                ring.strokeCircle(0, 0, radius);

                // Damage at ring edge
                if (this.player) {
                    const dist = Math.sqrt(Math.pow(this.player.x - this.boss.x, 2) + Math.pow(this.player.y - this.boss.y, 2));
                    if (Math.abs(dist - radius) < 30) {
                        this.handlePlayerDamage(2);
                    }
                }
            },
            onComplete: () => {
                if (ring.active) this.releaseBossEffect(ring);
            }
        }));
    }

    bossShadowClones() {
        if (!this.boss?.active || this.bossDefeated) return;

        // Create 2 shadow clones
        for (let i = 0; i < 2; i++) {
            const clone = this.trackBossEffect(
                this.add.sprite(this.boss.x + (i === 0 ? -100 : 100), this.boss.y, 'shadowPhoenix')
            );
            clone.setAlpha(0.5);
            clone.setTint(0x4B0082);
            clone.setScale(this.bossTargetScale * 0.72);
            clone.setDepth(870);

            // Clones dive at player
            this.scheduleBossTimer(500 + i * 300, () => {
                if (this.bossDefeated || !clone.active) {
                    this.releaseBossEffect(clone);
                    return;
                }
                if (this.player?.active) {
                    this.tweens.add({
                        targets: clone,
                        x: this.player.x,
                        y: this.player.y,
                        duration: 400,
                        onComplete: () => {
                            if (!clone.active) return;
                            if (this.bossDefeated) {
                                this.releaseBossEffect(clone);
                                return;
                            }
                            if (this.player?.active && Math.abs(this.player.x - clone.x) < 40 && Math.abs(this.player.y - clone.y) < 40) {
                                this.handlePlayerDamage(1);
                            }
                            this.releaseBossEffect(clone);
                        }
                    });
                } else {
                    this.releaseBossEffect(clone);
                }
            });
        }
    }

    handleBossCollision(player, boss) {
        if (this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(1);
    }

    handlePlayerDamage(damage) {
        this.takeDamage(damage);
    }

    damageBoss(amount = 1) {
        if (!this.boss?.active || this.bossDefeated) return false;

        const recoveryBonus = this.time.now < this.bossRecoveryUntil ? 1 : 0;
        const routeBonus = this.consumeCurrentCharge();
        const finalAmount = amount + recoveryBonus + routeBonus;
        this.bossHealth = Math.max(0, this.bossHealth - finalAmount);
        this.updateBossHealthBar();

        this.showFloatingText(
            routeBonus
                ? `CURRENT RELEASE -${finalAmount}`
                : recoveryBonus
                    ? `OPEN EXPOSURE -${finalAmount}`
                    : `EXPOSURE -${finalAmount}`,
            this.boss.x,
            this.boss.y - 100,
            '#A9F3E4'
        );

        this.boss.setTint(0xA9F3E4);
        this.time.delayedCall(100, () => {
            if (this.boss?.active && !this.bossDefeated) {
                this.boss.clearTint();
            }
        });

        // Phase transitions
        if (
            this.bossHealth > 0 &&
            this.bossHealth <= this.bossMaxHealth * 0.6 &&
            this.bossPhase === 1
        ) {
            this.triggerPhase2();
        } else if (
            this.bossHealth > 0 &&
            this.bossHealth <= this.bossMaxHealth * 0.3 &&
            this.bossPhase === 2
        ) {
            this.triggerPhase3();
        }

        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
        return true;
    }

    beginPhoenixPhase(nextPhase, {
        message,
        color,
        aiDelay
    }) {
        this.bossPhase = nextPhase;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossPhaseRecoveryTimer?.remove?.();
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();

        this.boss.isAttacking = true;
        this.boss.setVelocity?.(0, 0);
        this.tweens.killTweensOf(this.boss);
        this.boss.setTint(color);
        window.FeedbackManager?.cameraShake?.(
            this,
            500,
            nextPhase >= 3 ? 0.03 : 0.02
        );

        const { width, height } = this.cameras.main;
        const phaseText = this.trackBossEffect(this.add.text(width / 2, height / 2, message, {
            fontSize: width <= 480 ? '21px' : '28px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: width - 50 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000));

        const phaseRing = this.trackBossEffect(this.add.graphics());
        phaseRing.lineStyle(7, color, 0.95);
        phaseRing.strokeCircle(0, 0, 85);
        phaseRing.setPosition(this.boss.x, this.boss.y).setDepth(879).setScale(0.4);
        this.bossSubtitle
            ?.setText?.(`PHASE ${nextPhase} // PRESSURE SHIFT - RECOVER`)
            ?.setColor?.('#FFD166');

        this.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 50,
            duration: PHOENIX_PHASE_RECOVERY,
            onComplete: () => this.releaseBossEffect(phaseText)
        });
        this.tweens.add({
            targets: phaseRing,
            scaleX: 2.5,
            scaleY: 2.5,
            alpha: 0,
            duration: PHOENIX_PHASE_RECOVERY,
            ease: 'Sine.easeOut',
            onComplete: () => this.releaseBossEffect(phaseRing)
        });

        if (this.bossAITimer) this.bossAITimer.delay = aiDelay;
        this.bossPhaseRecoveryTimer = this.time.delayedCall(PHOENIX_PHASE_RECOVERY, () => {
            if (!this.boss?.active || this.bossDefeated) return;
            this.boss.clearTint?.();
            this.bossRecoveryUntil = this.time.now + PHOENIX_RECOVERY_WINDOW;
            this.bossSubtitle
                ?.setText?.('RECOVERY WINDOW // BREAK VOID PRESSURE')
                ?.setColor?.('#D8FFF6');
            this.bossPhaseRecoveryTimer = this.time.delayedCall(
                PHOENIX_RECOVERY_WINDOW,
                () => {
                    this.bossPhaseRecoveryTimer = null;
                    if (!this.boss?.active || this.bossDefeated) return;
                    this.boss.isAttacking = false;
                    this.startBossHover();
                }
            );
        });
    }

    triggerPhase2() {
        this.beginPhoenixPhase(2, {
            message: 'VOID PRESSURE SURGES',
            color: 0x6F8DFF,
            aiDelay: 1800
        });
    }

    triggerPhase3() {
        this.beginPhoenixPhase(3, {
            message: 'THE AURORA BREAKS THROUGH',
            color: 0x7FFFD4,
            aiDelay: 1400
        });
    }

    onBossDefeated() {
        if (this.bossDefeated) return;

        console.log('[AuroraDepthsLevel] Aurora Phoenix restored!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        this.bossAITimer?.remove?.();
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossPhaseRecoveryTimer?.remove?.();
        this.bossPhaseRecoveryTimer = null;
        this.bossRecoveryUntil = 0;
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();
        this.bossExposureText?.setText('UPLINK EXPOSURE // CONTAINED');

        if (this.boss?.body) {
            this.boss.body.enable = false;
        }
        if (this.bossBody?.body) {
            this.bossBody.body.enable = false;
        }
        this.boss?.setVelocity?.(0, 0);
        this.bossBody?.setVelocity?.(0, 0);
        this.tweens.killTweensOf(this.boss);
        this.boss?.setTint?.(0xA9F3E4);
        window.FeedbackManager?.cameraFlash?.(this, 420, 169, 243, 228);
        window.FeedbackManager?.cameraShake?.(this, 350, 0.012);
        this.showFloatingText(
            'PHOENIX SIGNAL STABLE',
            this.boss?.x || 4400,
            (this.boss?.y || 550) - 100,
            '#A9F3E4'
        );

        // The restored guardian sheds the remaining Void pressure as warm light.
        for (let i = 0; i < 24; i++) {
            this.time.delayedCall(i * 50, () => {
                const flame = this.add.graphics();
                flame.fillStyle(Math.random() > 0.5 ? 0xA9F3E4 : 0xF2C94C, 1);
                flame.fillCircle(0, 0, 10 + Math.random() * 15);
                flame.setPosition(
                    (this.boss?.x || 4400) + (Math.random() - 0.5) * 100,
                    (this.boss?.y || 550) + (Math.random() - 0.5) * 80
                );
                flame.setDepth(900);

                this.tweens.add({
                    targets: flame,
                    y: flame.y - 100,
                    alpha: 0,
                    scale: 0.3,
                    duration: 1000,
                    onComplete: () => flame.destroy()
                });
            });
        }

        this.tweens.add({
            targets: this.boss,
            alpha: 0.2,
            scale: 0.7,
            y: this.boss.y - 120,
            duration: 1800,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.boss?.destroy?.();
                this.boss = null;
                this.bossBody?.destroy?.();
                this.bossBody = null;

                if (this.bossGlow) {
                    this.bossGlow.destroy();
                }

                this.showBossVictory();
            }
        });

        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 500
            });
        }
    }

    showBossVictory() {
        const layout = this.getLevelModalLayout({ maxWidth: 480, maxHeight: 300 });
        const { width, contentWidth, y, font } = layout;

        this.completeLevelProgression({
            achievementLevelId: 'auroraDepths',
            shipPartId: 'aurora_reactor',
            katanaUpgradeId: 'aurora_guard',
            speedrunThreshold: 300000
        });

        this.auroraReactorFound = true;

        const victoryText = this.add.text(width / 2, y(150), 'AURORA PHOENIX RESTORED', {
            fontSize: font(32, 24),
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: contentWidth }
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
                this.showKatanaUpgradeReveal({
                    onClose: () => this.showLevelComplete()
                });
            }
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('guardian_restored', { bossId: 'shadow_phoenix' });
        }
    }

    showLevelComplete() {
        this.bindLevelCompletionReturn();

        const layout = this.getLevelModalLayout({ maxWidth: 400, maxHeight: 300 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font, buttonPadding
        } = layout;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2500);

        const panel = this.add.graphics();
        panel.fillStyle(0x0A1A2A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x00E676, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(2501);

        this.add.text(width / 2, y(40), 'FINAL ROUTE IDENTIFIED', {
            fontSize: font(28, 23),
            color: '#00E676',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const katanaUpgrade = this.levelCompletionResult?.katanaUpgrade;
        const upgradeStatus = this.levelCompletionResult?.katanaUpgradeAwarded
            ? 'installed'
            : 'online';
        this.add.text(
            width / 2,
            y(105),
            `Phoenix Gift: Aurora Reactor\n` +
            `Guardian Reward: ${this.levelCompletionResult?.coinsAwarded || 0} Cosmic Coins\n` +
            (katanaUpgrade
                ? `Creature-Tech: ${katanaUpgrade.name} ${upgradeStatus}\n`
                : '') +
            'Earth Contact: Possible, not transmitted\n' +
            this.getVillageCompletionCopy({ compact: true }) + '\n' +
            this.getGuardianSanctuaryArrivalCopy({ compact: true }),
            {
            fontSize: font(17, 14),
            color: '#FFD700',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const totalRequired = window.GameState?.get('hubWorld.shipParts.totalRequired') || 5;
        this.add.text(
            width / 2,
            y(195),
            `Ship Parts: ${shipParts.length}/${totalRequired}\n` +
            'Install the Aurora Reactor at Wanderer-77. The Final Void opens next.',
            {
            fontSize: font(16, 14),
            color: '#7FFFD4',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const returnBtn = this.add.text(width / 2, y(260), '[ INSTALL AURORA REACTOR ]', {
            fontSize: font(20, 17),
            color: '#00E676',
            backgroundColor: '#1A3A4A',
            padding: buttonPadding
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ cursor: 'pointer' });

        returnBtn.on('pointerover', () => returnBtn.setColor('#7FFFD4'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#00E676'));
        returnBtn.on('pointerdown', () => {
            this.returnToHub();
        });
    }

    shutdown() {
        console.log('[AuroraDepthsLevel] Shutting down');

        this.clearLevelEntryKeyHandler();
        this.boss?.destroy?.();
        this.boss = null;
        this.bossBody?.destroy?.();
        this.bossBody = null;

        this.bossUI?.destroy?.();
        this.bossUI = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossSubtitle = null;
        this.bossExposureText = null;
        this.bossBarConfig = null;
        this.bossIndicator?.destroy?.();
        this.bossIndicator = null;

        this.bossGlow?.destroy?.();
        this.bossGlow = null;

        this.bossAITimer?.remove?.();
        this.bossAITimer = null;
        this.bossInstructionTimer?.remove?.();
        this.bossInstructionTimer = null;
        this.bossAttackUnlockTimer?.remove?.();
        this.bossAttackUnlockTimer = null;
        this.bossPhaseRecoveryTimer?.remove?.();
        this.bossPhaseRecoveryTimer = null;
        this.bossRecoveryUntil = 0;
        this.clearBossEncounterTimers();
        this.clearBossEncounterEffects();

        this.auroraLights.forEach(aurora => aurora.graphics.destroy());
        this.auroraLights = [];
        this.signalPrisms.forEach(prism => {
            prism.visual?.destroy?.();
            prism.label?.destroy?.();
            prism.zone?.destroy?.();
        });
        this.signalPrisms = [];
        this.shadowCurrents.forEach(current => {
            current.zone?.destroy?.();
            current.visual?.destroy?.();
        });
        this.shadowCurrents = [];
        this.traversalLandingGuides.forEach(guide => {
            guide.tween?.remove?.();
            guide.visual?.destroy?.();
        });
        this.traversalLandingGuides = [];
        this.clearQuietLightPickup();
        this.clearCurrentChargeAura();
        // Phaser owns this physics group and destroys it during Scene shutdown.
        // Clearing it here can run after the physics world has already disposed
        // the group's body set when campaign scenes are stopped in quick succession.
        this.auroraFragments = null;
        this.objectiveDisplay?.destroy?.();
        this.objectiveDisplay = null;

        super.shutdown();
    }
}

export default AuroraDepthsLevel;

if (typeof window !== 'undefined') {
    window.AuroraDepthsLevel = AuroraDepthsLevel;
}
