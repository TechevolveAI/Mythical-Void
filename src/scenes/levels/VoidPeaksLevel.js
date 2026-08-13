import PlatformerLevelScene from '../PlatformerLevelScene.js';

const COSMIC_TITAN_TEXTURE = 'cosmicTitan';
const COSMIC_TITAN_ASSET = '/game/guardians/cosmic-titan.webp';
const COSMIC_TITAN_DISPLAY_HEIGHT = 300;

const TITAN_ATTACK_WINDOWS = Object.freeze({
    gravityCrush: 1800,
    starRain: 2600,
    voidPunch: 1500,
    singularity: 1800
});
const TITAN_ATTACK_WINDUP = 700;
const TITAN_RECOVERY_WINDOW = 650;
const TITAN_PHASE_RECOVERY = 1300;

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
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
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
        this.bossPressureText = null;
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    init(data) {
        super.init(data);

        this.testMode = data?.testMode || false;
        this.starFragmentsCollected = 0;
        this.bossDefeated = false;
        this.bossFightActive = false;
        this.boss = null;
        this.bossTargetScale = 1;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.peakHazards = [];
        this.beaconRelays = [];
        this.beaconRelaysActivated = 0;
        this.creatureNetworkReached = false;
        this.replySignals = [];
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
        this.bossAttackPreview = [
            'gravityCrush',
            'starRain',
            'voidPunch',
            'singularity'
        ].includes(data?.bossAttackPreview)
            ? data.bossAttackPreview
            : null;
        this.bossPressureText = null;
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
            this.player.setPosition(4200, this.levelHeight - 210);
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

        for (let i = 0; i < 35; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, this.levelWidth),
                Phaser.Math.Between(20, 360),
                Phaser.Math.FloatBetween(1, 3),
                Phaser.Utils.Array.GetRandom([0x8B008B, 0xFF4500, 0xFFFFFF]),
                Phaser.Math.FloatBetween(0.25, 0.75)
            );
            star.setScrollFactor(0.18);
            star.setDepth(-850);
        }
    }

    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        const groundY = this.levelHeight - 50;
        // Floor islands are recovery spaces. Wide geyser breaks keep them from becoming a bypass.
        this.createPlatform(0, groundY, 620, 80, 'solid');
        this.createPlatform(980, groundY, 520, 80, 'solid');
        this.createPlatform(1880, groundY, 540, 80, 'solid');
        this.createPlatform(2920, groundY, 460, 80, 'solid');
        this.createPlatform(3900, groundY, 1300, 80, 'solid');

        const ledges = [
            [520, groundY - 145, 210], [820, groundY - 245, 180], [1180, groundY - 180, 260],
            [1560, groundY - 310, 220], [1980, groundY - 235, 230], [2380, groundY - 365, 220],
            [2780, groundY - 265, 210], [3180, groundY - 400, 240], [3580, groundY - 270, 220],
            [4020, groundY - 210, 260], [4420, groundY - 320, 240]
        ];

        ledges.forEach(([x, y, width]) => {
            this.createPlatform(x, y, width, 28, 'solid');
        });

        // Optional Relic Ridge: a higher, safer line with two Star Fragments.
        const relicRidge = [
            [2640, 345, 180],
            [2910, 280, 190],
            [3190, 250, 200],
            [3440, 350, 180]
        ];
        relicRidge.forEach(([x, y, width]) => {
            this.createPlatform(x, y, width, 28, 'one-way');
        });

        this.createBossArena();
        console.log(`[VoidPeaksLevel] Created ${this.platforms.getLength()} platforms`);
    }

    createLevelContent() {
        this.enemies = this.physics.add.group();
        this.collectibles = this.physics.add.group();

        this.createVoidGeysers();
        this.createPeakEnemies();
        this.createStarFragments();
        this.createSignalRelays();
        this.createPeakRouteChoiceMarkers();
        this.createTitanGate();

        this.physics.add.overlap(this.player, this.collectibles, this.collectItem, null, this);
    }

    createPeakAtmosphere() {
        for (let i = 0; i < 18; i++) {
            const ember = this.add.circle(
                Phaser.Math.Between(0, this.levelWidth),
                Phaser.Math.Between(120, this.levelHeight - 180),
                Phaser.Math.FloatBetween(3, 8),
                Phaser.Utils.Array.GetRandom([0xFF4500, 0x9400D3, 0xFFD700]),
                0.55
            );
            ember.setDepth(40);
            this.tweens.add({
                targets: ember,
                y: ember.y - Phaser.Math.Between(80, 180),
                alpha: 0.05,
                duration: Phaser.Math.Between(3200, 6200),
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createVoidGeysers() {
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

            this.tweens.add({
                targets: visual,
                alpha: { from: 0.35, to: 0.85 },
                duration: 900,
                yoyo: true,
                repeat: -1
            });

            this.physics.add.overlap(this.player, hazard, () => {
                if (!this.isInvincible) {
                    this.takeDamage(1);
                }
            });
        });
    }

    createPeakEnemies() {
        const enemyPositions = [
            { x: 1160, y: this.levelHeight - 110, health: 3 },
            { x: 2050, y: this.levelHeight - 110, health: 3 },
            { x: 3200, y: this.levelHeight - 110, health: 4 },
            { x: 4300, y: this.levelHeight - 110, health: 4 }
        ];

        enemyPositions.forEach((enemyData, index) => {
            const textureKey = `voidPeakSentinel_${index}`;
            this.createSentinelTexture(textureKey, index % 2 === 0 ? 0x4B0082 : 0x8B0000);

            const enemy = this.physics.add.sprite(enemyData.x, enemyData.y, textureKey);
            enemy.setCollideWorldBounds(true);
            enemy.setBounce(0.1);
            enemy.health = enemyData.health;
            enemy.maxHealth = enemyData.health;
            enemy.enemyType = 'voidPeakSentinel';
            enemy.patrolMin = enemyData.x - 130;
            enemy.patrolMax = enemyData.x + 130;
            enemy.setVelocityX(index % 2 === 0 ? 45 : -45);
            enemy.setDepth(850);

            this.configureEnemyCombat(enemy, {
                role: 'armored',
                maxHealth: enemyData.health,
                stompDamage: 1,
                cueOffsetY: -62
            });

            this.enemies.add(enemy);
            this.physics.add.collider(enemy, this.platforms);
        });
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
        const positions = [
            [610, this.levelHeight - 240], [1680, this.levelHeight - 395],
            [2730, 300], [3000, 235],
            [3660, this.levelHeight - 355]
        ];

        positions.forEach(([x, y], index) => {
            const fragment = this.add.star(x, y, 5, 7, 18, 0xFFD700, 1);
            fragment.setDepth(700);
            this.physics.add.existing(fragment);
            fragment.body.setAllowGravity(false);
            fragment.body.setSize(32, 32);
            fragment.fragmentIndex = index;
            this.collectibles.add(fragment);

            this.tweens.add({
                targets: fragment,
                angle: 360,
                y: y - 12,
                duration: 1600,
                repeat: -1,
                yoyo: true
            });
        });
    }

    createHUD() {
        super.createHUD();

        // Keep objectives above the playfield and away from mobile controls.
        const { width, height } = this.cameras.main;
        const isShortLandscape = width > height && height < 620;
        this.isCompactObjectiveHUD = this.isMobile || width <= 480 || height < 620;
        this.objectiveDisplay = this.add.text(
            width - (this.isCompactObjectiveHUD ? 12 : 20),
            this.isCompactObjectiveHUD ? (isShortLandscape ? 76 : 72) : 20,
            this.getPeakObjectiveText(),
            {
                fontSize: this.isCompactObjectiveHUD ? '12px' : '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#F8F2FF',
                backgroundColor: 'rgba(12, 4, 22, 0.92)',
                padding: { x: 10, y: 7 },
                lineSpacing: 2,
                align: 'left',
                wordWrap: {
                    width: this.isCompactObjectiveHUD ? 205 : 330
                }
            }
        ).setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000);
    }

    getPeakObjectiveText() {
        const optional = `OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}`;

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
        const relays = [
            { id: 'peaks_relay_1', x: 1180, y: 680, label: 'LOWER RELAY', respawnY: 700 },
            { id: 'peaks_relay_2', x: 2380, y: 520, label: 'RIDGE RELAY', respawnY: 700 },
            // The summit relay sits above a ground gap. Respawn above its ledge,
            // not beneath it, so a fall cannot become a checkpoint death loop.
            { id: 'peaks_relay_3', x: 3680, y: 600, label: 'SUMMIT RELAY', respawnY: 480 }
        ];

        relays.forEach((relay, index) => {
            const visual = this.add.graphics();
            visual.setDepth(180);
            this.drawSignalRelay(visual, relay.x, relay.y, false);

            const label = this.add.text(relay.x, relay.y - 94, `${index + 1} // ${relay.label}`, {
                fontSize: '11px',
                color: '#7E718A',
                fontStyle: 'bold',
                stroke: '#09030E',
                strokeThickness: 3
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
                activated: false
            };
            this.physics.add.overlap(this.player, zone, () => {
                this.activateSignalRelay(beacon);
            });
            this.beaconRelays.push(beacon);
        });

        this.refreshSignalRouteReadability();
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
        this.refreshSignalRouteReadability();
        this.setCheckpoint(relay.x, relay.respawnY, {
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
        const spine = this.add.text(2530, 615, 'WARNING LINE →', {
            fontSize: '12px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(182);

        const relicRoute = this.add.text(2670, 250, 'RELIC RIDGE ↑ // 2 FRAGMENTS', {
            fontSize: '12px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#09030E',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(182);

        this.tweens.add({
            targets: [spine, relicRoute],
            alpha: { from: 0.68, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });
    }

    restoreExpeditionRouteState(resume) {
        return this.restoreExpeditionRouteSignals(resume, {
            signals: this.beaconRelays,
            countProperty: 'beaconRelaysActivated',
            readyProperty: 'creatureNetworkReached',
            drawSignal: relay => this.drawSignalRelay(
                relay.visual,
                relay.x,
                relay.y,
                true
            ),
            onRestored: (relay, restoredCount) => {
                this.refreshSignalRouteReadability();
                if (restoredCount === this.beaconRelays.length) {
                    this.showDistantReplyNetwork(relay);
                }
                this.objectiveDisplay?.setText?.(this.getPeakObjectiveText());
            }
        });
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

        const visual = this.add.graphics();
        visual.fillStyle(0x4B0082, 0.45);
        visual.fillCircle(x, y, 72);
        visual.lineStyle(4, 0xFF4500, 0.95);
        visual.strokeCircle(x, y, 72);
        visual.setDepth(250);

        const label = this.add.text(x, y - 105, 'TITAN PASS', {
            fontSize: '15px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(251);

        this.physics.add.overlap(this.player, gate, () => {
            if (!this.bossFightActive && !this.bossDefeated) {
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
                this.startBossFight();
                visual.destroy();
                label.destroy();
                gate.destroy();
            }
        });
    }

    createBossArena() {
        this.createPlatform(4050, this.levelHeight - 225, 900, 35, 'solid');
        this.createPlatform(4300, this.levelHeight - 350, 190, 28, 'solid');
        this.createPlatform(4700, this.levelHeight - 350, 190, 28, 'solid');
    }

    showObjectiveToast() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const toast = this.add.text(
            width / 2,
            isMobileLayout ? 165 : 90,
            'Restore the warning relays and reach Titan Pass',
            {
            fontSize: '18px',
            color: '#FFD700',
            backgroundColor: 'rgba(0,0,0,0.72)',
            padding: { x: 18, y: 8 },
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2500);

        this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 60,
            delay: 2600,
            duration: 600,
            onComplete: () => toast.destroy()
        });
    }

    update(time, delta) {
        super.update(time, delta);
        if (this.levelCompletionActive) return;

        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.enemyType === 'voidPeakSentinel') {
                    if (enemy.x <= enemy.patrolMin) {
                        enemy.setVelocityX(Math.abs(enemy.body.velocity.x || 45));
                        enemy.setFlipX(false);
                    } else if (enemy.x >= enemy.patrolMax) {
                        enemy.setVelocityX(-Math.abs(enemy.body.velocity.x || 45));
                        enemy.setFlipX(true);
                    }
                }
            });
        }

        if (this.objectiveDisplay) {
            this.objectiveDisplay.setText(this.getPeakObjectiveText());
            this.objectiveDisplay.setVisible(
                !(this.isCompactObjectiveHUD && this.bossFightActive)
            );
        }
        this.updateBossIndicator();
    }

    collectItem(player, item) {
        if (item.fragmentIndex !== undefined) {
            const collectX = item.x;
            const collectY = item.y;
            this.starFragmentsCollected += 1;
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

            if (
                this.starFragmentsCollected >= this.totalStarFragments &&
                !this.cosmicEggAwarded
            ) {
                this.cosmicEggAwarded = true;
                this.time.delayedCall(450, () => {
                    this.showFloatingText(
                        'ALL SIGNAL FRAGMENTS - EGG AWAKENED',
                        collectX,
                        collectY - 75,
                        '#8FE3CF'
                    );
                    window.InventoryManager?.addItem?.({
                        id: 'peak_signal_egg',
                        name: 'Signal Egg',
                        type: 'egg',
                        rarity: 'rare',
                        description: 'An egg warmed by the warning calls exchanged across the Void Peaks.',
                        icon: '🥚📡'
                    });
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
        this.physics.pause();
        window.FeedbackManager?.cameraFlash?.(this, 220, 75, 0, 130);
        window.FeedbackManager?.cameraShake?.(this, 450, 0.012);

        if (this.player) {
            this.player.setPosition(4180, this.levelHeight - 295);
        }

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

    spawnCosmicTitan() {
        this.createTitanTexture();

        this.boss = this.physics.add.sprite(
            4720,
            this.levelHeight - 435,
            COSMIC_TITAN_TEXTURE
        );
        this.boss.setImmovable(true);
        this.boss.setCollideWorldBounds(true);
        this.boss.body.setAllowGravity(false);
        this.bossTargetScale = COSMIC_TITAN_DISPLAY_HEIGHT /
            Math.max(1, this.boss.height);
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
        this.physics.resume();
        if (this.bossAttackPreview) {
            this.time.delayedCall(1200, () => {
                this.performTitanAttack(this.bossAttackPreview);
            });
        } else {
            this.bossAttackTimer = this.time.addEvent({
                delay: 2600,
                callback: () => this.performTitanAttack(),
                loop: true
            });
        }
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
        if (!this.boss?.active || this.bossDefeated) return;

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
    }

    defeatBoss() {
        if (this.bossDefeated) return;

        console.log('[VoidPeaksLevel] Cosmic Titan restored!');
        this.bossDefeated = true;
        this.bossFightActive = false;
        this.bossAttackTimer?.remove?.();
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
        super.shutdown();
        console.log('[VoidPeaksLevel] Shutting down');
    }
}

export default VoidPeaksLevel;

if (typeof window !== 'undefined') {
    window.VoidPeaksLevel = VoidPeaksLevel;
}
