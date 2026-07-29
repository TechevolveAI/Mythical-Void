import PlatformerLevelScene from '../PlatformerLevelScene.js';

const VOID_EMPRESS_TEXTURE = 'voidEmpress';
const VOID_EMPRESS_ASSET = '/game/guardians/void-empress.webp';
const VOID_EMPRESS_DISPLAY_SIZE = 260;

const FINAL_SHIP_PART_IDS = Object.freeze([
    'crystal_core',
    'dimensional_drive',
    'forest_core',
    'hull_plating',
    'aurora_reactor',
    'command_module'
]);

/**
 * FinalVoidLevel - The ultimate boss encounter
 *
 * Story: At reality's edge, five restored systems answer the companion
 * together. Their shared signal reveals both a route to Earth and the danger
 * of exposing this world before the Void Empress severs the line.
 *
 * Features:
 * - Three bond-signal anchors and safe checkpoints
 * - Epic 5-phase boss fight with late-phase companion support
 * - Void atmosphere with reality-warping effects
 * - Most challenging encounter in the game
 * - Command Module ship part reward
 * - Unlocks space travel upon victory
 */
class FinalVoidLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'FinalVoidLevel',
            levelId: 'final_void_1',
            biomeId: 'final_void',
            levelWidth: 3000,
            levelHeight: 800
        });

        // Physics for void platforming
        this.playerSpeed = 200;
        this.jumpVelocity = -450;
        this.playerAcceleration = 0.20;
        this.playerDeceleration = 0.70;

        // Level state
        this.bossDefeated = false;
        this.bossFightActive = false;

        // Boss state - 5 phases, 20 HP
        this.boss = null;
        this.bossBody = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 20;
        this.bossPhase = 1;
        this.bossAITimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossSubtitle = null;
        this.bossBarConfig = null;
        this.bossIndicator = null;
        this.bossTargetScale = 1;

        // Void effects
        this.voidParticles = [];
        this.realityDistortion = 0;
        this.bondAnchors = [];
        this.bondAnchorsActivated = 0;
        this.finalSignalReady = false;
        this.levelStarted = false;
        this.bossGateHintUntil = 0;
        this.empressGate = null;
        this.voidFractures = [];
        this.objectiveDisplay = null;
        this.levelEntryDismissing = false;
        this.levelEntryKeyHandler = null;
    }

    init(data) {
        super.init(data);

        const previewParams = new URLSearchParams(window.location.search);
        const isLocalPreview = ['localhost', '127.0.0.1'].includes(
            window.location.hostname
        );
        this.resultPreview = Boolean(
            data?.resultPreview ||
            (
                isLocalPreview &&
                previewParams.get('testGuardianResult') === 'finalVoid'
            )
        );
        this.testMode = data?.testMode || this.resultPreview;

        this.bossDefeated = false;
        this.bossFightActive = false;

        this.boss = null;
        this.bossBody = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAITimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;
        this.bossSubtitle = null;
        this.bossBarConfig = null;
        this.bossIndicator = null;
        this.bossTargetScale = 1;

        this.voidParticles = [];
        this.realityDistortion = 0;
        this.bondAnchors = [];
        this.bondAnchorsActivated = 0;
        this.finalSignalReady = false;
        this.levelStarted = false;
        this.bossGateHintUntil = 0;
        this.empressGate = null;
        this.voidFractures = [];
        this.objectiveDisplay = null;
        this.levelEntryDismissing = false;
        this.clearLevelEntryKeyHandler();

        console.log('[FinalVoidLevel] Level state reset');
    }

    preload() {
        this.load.image(VOID_EMPRESS_TEXTURE, VOID_EMPRESS_ASSET);
    }

    create() {
        super.create();

        if (
            !this.entryPreview &&
            !this.resultPreview &&
            window.AchievementSystem?.recordEvent
        ) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'finalVoid' });
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
        console.log('[FinalVoidLevel] TEST MODE - Spawning final boss');
        this.levelStarted = true;
        this.createVoidBackground();
        this.bondAnchorsActivated = 3;
        this.finalSignalReady = true;

        if (this.player) {
            this.player.setPosition(
                Math.max(80, this.getTestBossSpawnX() - 420),
                this.levelHeight - 200
            );
        }

        this.time.delayedCall(500, () => this.startBossFight());

        if (this.resultPreview) {
            this.time.delayedCall(2100, () => {
                if (this.boss && !this.bossDefeated) {
                    this.onBossDefeated();
                }
            });
        }
    }

    getTestBossSpawnX() {
        const width = this.cameras.main.width;
        return width <= 480 ? width - 110 : width / 2 + 180;
    }

    showLevelEntry() {
        this.levelEntryDismissing = false;
        const layout = this.getLevelModalLayout({ maxWidth: 500, maxHeight: 400 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, contentLeft, y, font, buttonPadding
        } = layout;
        const resume = this.getExpeditionResumePresentation();

        this.physics.pause();

        // Track ALL elements for proper cleanup
        const entryElements = [];

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);
        entryElements.push(overlay);

        const panel = this.add.graphics();
        panel.fillStyle(0x0A0A1A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(4, 0x9400D3, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);
        entryElements.push(panel);

        // Ominous void glow
        const glowPanel = this.add.graphics();
        glowPanel.fillStyle(0x4B0082, 0.3);
        glowPanel.fillRoundedRect(panelX - 10, panelY - 10, panelWidth + 20, panelHeight + 20, 25);
        glowPanel.setScrollFactor(0);
        glowPanel.setDepth(3000);
        entryElements.push(glowPanel);

        const title = this.add.text(width / 2, y(50), 'THE FINAL VOID', {
            fontSize: font(42, 30),
            color: '#9400D3',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(title);

        // Pulsing title effect
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitle = this.add.text(width / 2, y(94), '"Every world you helped is answering"', {
            fontSize: font(16, 14),
            color: '#DA70D6',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(subtitle);

        const mission = this.add.text(
            width / 2,
            y(135),
            resume
                ? `PROJECT BEACON // RESUME ${resume.current}/${resume.total}`
                : 'PROJECT BEACON // FINAL EXPEDITION',
            {
            fontSize: font(13, 11),
            color: '#9E8BAB',
            align: 'center',
            wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(mission);

        const objective = this.add.text(width / 2, y(178), 'Carry the shared signal to the Command Module', {
            fontSize: font(20, 17),
            color: '#F2C94C',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        entryElements.push(objective);

        const checklist = this.add.text(contentLeft, y(225), `${
            resume
                ? `[ BEACON ] ${resume.label} link restored`
                : '[ ] Reconnect the five living systems'
        }\n[ ] Reach reality's edge together\n[ ] Recover the final Command Module`, {
            fontSize: font(16, 14),
            color: '#CCCCCC',
            lineSpacing: 8,
            wordWrap: { width: contentWidth }
        }).setScrollFactor(0).setDepth(3002);
        entryElements.push(checklist);

        const enterBtn = this.add.text(
            width / 2,
            y(350),
            resume ? '[ RESUME EXPEDITION ]' : '[ ENTER THE FINAL VOID ]',
            {
            fontSize: font(22, 17),
            color: '#9400D3',
            backgroundColor: '#1A0A2E',
            padding: buttonPadding
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });
        entryElements.push(enterBtn);

        enterBtn.on('pointerover', () => enterBtn.setColor('#FF00FF'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#9400D3'));

        // Dismiss function - used by button and tap anywhere
        const dismissEntry = () => {
            if (this.levelEntryDismissing) return;

            this.levelEntryDismissing = true;
            enterBtn.disableInteractive();
            overlay.disableInteractive();
            this.clearLevelEntryKeyHandler();
            this.tweens.add({
                targets: entryElements,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    entryElements.forEach(el => {
                        if (el && el.destroy) el.destroy();
                    });
                    this.physics.resume();
                    this.showPlatformerMobileControls();
                    this.startLevel();
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

    startLevel() {
        console.log('[FinalVoidLevel] Starting final level');
        this.levelStarted = true;
        this.createVoidBackground();
        this.createLevelSpecificContentOnce();
        this.showObjectiveToast();
    }

    createPlatforms() {
        this.platforms = this.physics.add.staticGroup();

        const groundY = this.levelHeight - 50;
        this.createPlatform(0, groundY, this.levelWidth, 80, 'solid');

        const ledges = [
            [240, groundY - 160, 300],
            [680, groundY - 285, 260],
            [1080, groundY - 190, 300],
            [1510, groundY - 340, 270],
            [1940, groundY - 220, 300],
            [2370, groundY - 320, 260]
        ];
        ledges.forEach(([x, y, width]) => {
            this.createPlatform(x, y, width, 28, 'one-way');
        });

        console.log(`[FinalVoidLevel] Created ${this.platforms.getLength()} platforms`);
    }

    createLevelContent() {
        this.createVoidFractures();
        this.createBondAnchors();
        this.createBossArena();
        this.createEmpressGate();
    }

    createHUD() {
        super.createHUD();

        const { width, height } = this.cameras.main;
        const isShortLandscape = width > height && height < 620;
        this.isCompactObjectiveHUD = this.isMobile || width <= 480 || height < 620;
        this.objectiveDisplay = this.add.text(
            width - (this.isCompactObjectiveHUD ? 12 : 20),
            this.isCompactObjectiveHUD ? (isShortLandscape ? 82 : 212) : height - 30,
            this.getFinalObjectiveText(),
            {
                fontSize: this.isCompactObjectiveHUD ? '11px' : '15px',
                color: '#E6C8F5',
                backgroundColor: 'rgba(10, 4, 20, 0.84)',
                padding: { x: 8, y: 5 },
                align: 'right'
            }
        ).setOrigin(1, this.isCompactObjectiveHUD ? 0 : 1)
            .setScrollFactor(0)
            .setDepth(1000)
            .setVisible(false);
    }

    getFinalObjectiveText() {
        const signalState = this.finalSignalReady ? 'CONNECTED' : 'GATHERING';
        if (this.isCompactObjectiveHUD) {
            return `BOND SIGNALS: ${this.bondAnchorsActivated}/3\nNETWORK: ${signalState}\nCOMMAND: LOCKED`;
        }
        return `BOND SIGNALS: ${this.bondAnchorsActivated}/3  |  NETWORK: ${signalState}\nCOMMAND MODULE: LOCKED`;
    }

    showObjectiveToast() {
        const { width, height } = this.cameras.main;
        const isMobileLayout = this.isMobile || width <= 480 || height < 620;
        const toast = this.add.text(
            width / 2,
            isMobileLayout ? 165 : 90,
            'Follow the shared signal to reality\'s edge',
            {
                fontSize: isMobileLayout ? '16px' : '18px',
                color: '#F2C94C',
                backgroundColor: 'rgba(10, 4, 20, 0.84)',
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

    createVoidFractures() {
        const fractures = [
            { x: 930, width: 180 },
            { x: 1780, width: 190 }
        ];

        fractures.forEach(({ x, width }) => {
            const y = this.levelHeight - 88;
            const zone = this.add.zone(x + width / 2, y, width, 76);
            this.physics.add.existing(zone, true);

            const visual = this.add.graphics();
            visual.fillStyle(0x170522, 0.9);
            visual.fillRoundedRect(x, y - 28, width, 56, 10);
            visual.lineStyle(3, 0xC35CFF, 0.75);
            visual.lineBetween(x + 10, y - 8, x + width * 0.35, y + 12);
            visual.lineBetween(x + width * 0.35, y + 12, x + width * 0.65, y - 14);
            visual.lineBetween(x + width * 0.65, y - 14, x + width - 10, y + 8);
            visual.setDepth(115);

            this.tweens.add({
                targets: visual,
                alpha: { from: 0.5, to: 1 },
                duration: 850,
                yoyo: true,
                repeat: -1
            });

            this.physics.add.overlap(this.player, zone, () => {
                if (!this.isInvincible && !this.bossDefeated) {
                    this.takeDamage(1);
                }
            });
            this.voidFractures.push({ zone, visual });
        });
    }

    createBondAnchors() {
        const anchors = [
            { id: 'final_bond_1', x: 600, y: 600, label: 'LIVING SYSTEMS' },
            { id: 'final_bond_2', x: 1420, y: 470, label: 'RETURN ROUTE' },
            { id: 'final_bond_3', x: 2200, y: 560, label: 'TRUST SIGNAL' }
        ];

        anchors.forEach((anchor, index) => {
            const visual = this.add.graphics();
            visual.setDepth(180);
            this.drawBondAnchor(visual, anchor.x, anchor.y, false);

            const label = this.add.text(anchor.x, anchor.y - 98, anchor.label, {
                fontSize: '11px',
                color: '#8F789D',
                fontStyle: 'bold',
                stroke: '#09020E',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(181);

            const zone = this.add.zone(
                anchor.x,
                this.levelHeight / 2,
                120,
                this.levelHeight
            );
            this.physics.add.existing(zone, true);

            const bondAnchor = {
                ...anchor,
                index,
                visual,
                label,
                zone,
                activated: false
            };
            this.physics.add.overlap(this.player, zone, () => {
                this.activateBondAnchor(bondAnchor);
            });
            this.bondAnchors.push(bondAnchor);
        });
    }

    drawBondAnchor(graphics, x, y, activated) {
        graphics.clear();
        const color = activated ? 0xF2C94C : 0x4F315E;

        graphics.fillStyle(color, activated ? 0.2 : 0.1);
        graphics.fillCircle(x, y - 42, 48);
        graphics.lineStyle(4, color, activated ? 1 : 0.65);
        graphics.strokeCircle(x, y - 46, 28);
        graphics.lineBetween(x, y - 18, x, y + 42);
        graphics.lineBetween(x, y + 42, x - 18, y + 54);
        graphics.lineBetween(x, y + 42, x + 18, y + 54);
        graphics.fillStyle(activated ? 0xA9F3E4 : color, 0.95);
        graphics.fillCircle(x, y - 46, 9);

        if (activated) {
            graphics.lineStyle(2, 0xA9F3E4, 0.7);
            graphics.strokeCircle(x, y - 46, 40);
            graphics.lineBetween(x, y - 46, x + 115, y - 115);
        }
    }

    activateBondAnchor(anchor) {
        if (!anchor || anchor.activated) return;

        anchor.activated = true;
        anchor.zone?.destroy?.();
        anchor.zone = null;
        this.bondAnchorsActivated++;
        this.drawBondAnchor(anchor.visual, anchor.x, anchor.y, true);
        anchor.label.setColor('#F2C94C');
        this.setCheckpoint(anchor.x, this.levelHeight - 130, {
            persist: true,
            checkpointId: anchor.id,
            checkpointIndex: anchor.index
        });

        this.showFloatingText(
            `BOND SIGNAL ${this.bondAnchorsActivated}/3`,
            anchor.x,
            anchor.y - 125,
            '#F2C94C'
        );

        const storyLines = [
            'Five living systems answer your companion together.',
            'Project Beacon finds a route to Earth - and an open door back here.',
            'Your companion stands beside you. No command was needed.'
        ];
        this.time.delayedCall(650, () => {
            this.showFloatingText(
                storyLines[anchor.index],
                anchor.x,
                anchor.y - 165,
                anchor.index === 2 ? '#A9F3E4' : '#E6D6F0'
            );
        });

        if (this.bondAnchorsActivated === 3) {
            this.finalSignalReady = true;
            window.AchievementSystem?.recordEvent?.('story_interaction', {
                event: 'final_bond_network_connected'
            });
        }

        window.AudioManager?.playAchievement?.();
    }

    restoreExpeditionRouteState(resume) {
        return this.restoreExpeditionRouteSignals(resume, {
            signals: this.bondAnchors,
            countProperty: 'bondAnchorsActivated',
            readyProperty: 'finalSignalReady',
            labelColor: '#F2C94C',
            drawSignal: anchor => this.drawBondAnchor(
                anchor.visual,
                anchor.x,
                anchor.y,
                true
            ),
            onRestored: () => {
                this.objectiveDisplay?.setText?.(this.getFinalObjectiveText());
            }
        });
    }

    createVoidBackground() {
        const { width, height } = this.cameras.main;

        const bg = this.add.graphics();
        bg.setScrollFactor(0);
        bg.setDepth(-100);

        // Deep void gradient - almost black with hints of purple
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(5 + ratio * 15);
            const g = Math.floor(0 + ratio * 5);
            const b = Math.floor(15 + ratio * 30);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            bg.fillRect(0, y, width, 1);
        }

        // Void particles
        this.createVoidParticles();

        // Reality distortion effect
        this.time.addEvent({
            delay: 100,
            callback: () => this.updateRealityDistortion(),
            loop: true
        });
    }

    createVoidParticles() {
        const { width, height } = this.cameras.main;

        for (let i = 0; i < 40; i++) {
            const particle = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;

            const colors = [0x4B0082, 0x8B008B, 0x9400D3, 0xFF00FF];
            const color = colors[Math.floor(Math.random() * colors.length)];

            particle.fillStyle(color, 0.5);
            particle.fillCircle(0, 0, 2 + Math.random() * 4);
            particle.setPosition(x, y);
            particle.setDepth(-50);
            particle.setScrollFactor(0.3);

            // Drift animation
            this.tweens.add({
                targets: particle,
                x: x + (Math.random() - 0.5) * 200,
                y: y + (Math.random() - 0.5) * 200,
                alpha: { from: 0.5, to: 0.1 },
                duration: 5000 + Math.random() * 3000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.voidParticles.push(particle);
        }
    }

    updateRealityDistortion() {
        this.realityDistortion += 0.05;

        // Subtle camera distortion during boss fight
        if (this.bossFightActive && this.bossPhase >= 3) {
            const shakeAmount = 0.001 * (this.bossPhase - 2);
            this.cameras.main.x = Math.sin(this.realityDistortion) * 2;
            this.cameras.main.y = Math.cos(this.realityDistortion * 1.3) * 2;
        }
    }

    createBossArena() {
        const groundY = this.levelHeight - 100;

        const ground = this.add.graphics();
        ground.fillStyle(0x0A0A1A, 1);
        ground.fillRect(0, groundY, this.levelWidth, 100);

        // Void cracks in the floor
        ground.lineStyle(2, 0x9400D3, 0.5);
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * this.levelWidth;
            ground.lineBetween(x, groundY, x + (Math.random() - 0.5) * 50, groundY + 30);
        }

        // Glowing void runes
        ground.fillStyle(0x4B0082, 0.3);
        for (let i = 0; i < 10; i++) {
            const runeX = 200 + i * 250;
            ground.fillCircle(runeX, groundY - 5, 20);
        }

        ground.setDepth(90);
        this.bossArenaVisual = ground;
    }

    createEmpressGate() {
        const gateX = this.levelWidth - 500;
        const gateY = this.levelHeight - 230;
        const visual = this.add.graphics();
        visual.fillStyle(0x13061D, 0.92);
        visual.fillRoundedRect(gateX - 34, gateY - 150, 68, 300, 18);
        visual.lineStyle(5, 0x9400D3, 0.95);
        visual.strokeRoundedRect(gateX - 34, gateY - 150, 68, 300, 18);
        visual.lineStyle(2, 0xA9F3E4, 0.65);
        visual.lineBetween(gateX, gateY - 120, gateX, gateY + 120);
        visual.setDepth(890);

        const label = this.add.text(gateX, gateY - 180, 'EMPRESS SEAL', {
            fontSize: '13px',
            color: '#DA70D6',
            fontStyle: 'bold',
            stroke: '#09020E',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(891);

        const zone = this.add.zone(gateX, this.levelHeight / 2, 130, this.levelHeight);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => {
            if (this.bossFightActive || this.bossDefeated) return;

            if (!this.finalSignalReady) {
                if (this.time.now >= this.bossGateHintUntil) {
                    this.bossGateHintUntil = this.time.now + 1800;
                    this.showFloatingText(
                        `BOND SIGNALS REQUIRED: ${this.bondAnchorsActivated}/3`,
                        gateX - 90,
                        gateY - 205,
                        '#DA70D6'
                    );
                }
                return;
            }

            zone.destroy();
            visual.destroy();
            label.destroy();
            this.empressGate = null;
            this.startBossFight();
        });

        this.empressGate = { visual, label, zone };
    }

    update(time, delta) {
        if (this.bossBody?.active && this.boss?.active) {
            this.bossBody.setPosition(this.boss.x, this.boss.y + 60);
        }

        super.update(time, delta);
        if (this.levelCompletionActive) return;

        if (this.objectiveDisplay?.active) {
            this.objectiveDisplay.setText(this.getFinalObjectiveText());
            this.objectiveDisplay.setVisible(
                this.levelStarted &&
                !(this.isCompactObjectiveHUD && this.bossFightActive)
            );
        }

        this.updateBossIndicator();

        if (!this.bossFightActive && this.cameras?.main) {
            this.cameras.main.x = 0;
            this.cameras.main.y = 0;
        }
    }

    startBossFight() {
        if (this.bossFightActive || this.bossDefeated) return;

        console.log('[FinalVoidLevel] Starting Void Empress boss fight!');
        this.bossFightActive = true;

        this.physics.pause();

        this.cameras.main.flash(220, 75, 0, 130);
        this.cameras.main.shake(650, 0.012);

        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, 'THE VOID EMPRESS CUTS THE BEACON LINE', {
            fontSize: width <= 480 ? '24px' : '34px',
            color: '#FF00FF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: width - 48 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        this.tweens.add({
            targets: warningText,
            alpha: 0,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 1200,
            onComplete: () => warningText.destroy()
        });

        this.time.delayedCall(1200, () => {
            if (!this.bossFightActive || this.bossDefeated) return;
            this.spawnVoidEmpress();
            this.physics.resume();
        });
    }

    /**
     * Keep a procedural fallback so a failed asset request cannot block combat.
     */
    ensureVoidEmpressTexture() {
        const textureKey = VOID_EMPRESS_TEXTURE;
        if (this.textures.exists(textureKey)) return textureKey;

        const graphics = this.make.graphics({ add: false });
        const size = 180;
        const centerX = size / 2;
        const centerY = size / 2;

        // Outer void aura
        graphics.fillStyle(0x4B0082, 0.3);
        graphics.fillCircle(centerX, centerY, size / 2);

        // Inner dark aura
        graphics.fillStyle(0x1A0A2E, 0.4);
        graphics.fillCircle(centerX, centerY + 10, size / 2 - 15);

        // Flowing robes/body (elegant void entity)
        graphics.fillStyle(0x2A1A4A, 1);

        // Main body/dress shape
        graphics.beginPath();
        graphics.moveTo(centerX, centerY - 50); // Top of head
        graphics.lineTo(centerX - 15, centerY - 30); // Left shoulder
        graphics.lineTo(centerX - 40, centerY + 10); // Left arm
        graphics.lineTo(centerX - 50, centerY + 60); // Left dress
        graphics.lineTo(centerX, centerY + 80); // Bottom center
        graphics.lineTo(centerX + 50, centerY + 60); // Right dress
        graphics.lineTo(centerX + 40, centerY + 10); // Right arm
        graphics.lineTo(centerX + 15, centerY - 30); // Right shoulder
        graphics.closePath();
        graphics.fillPath();

        // Flowing dress details
        graphics.fillStyle(0x3A2A5A, 0.8);
        graphics.beginPath();
        graphics.moveTo(centerX - 30, centerY + 30);
        graphics.lineTo(centerX - 45, centerY + 70);
        graphics.lineTo(centerX - 20, centerY + 50);
        graphics.closePath();
        graphics.fillPath();

        graphics.beginPath();
        graphics.moveTo(centerX + 30, centerY + 30);
        graphics.lineTo(centerX + 45, centerY + 70);
        graphics.lineTo(centerX + 20, centerY + 50);
        graphics.closePath();
        graphics.fillPath();

        // Face area (pale/ethereal)
        graphics.fillStyle(0xE8D0FF, 1);
        graphics.fillEllipse(centerX, centerY - 35, 25, 30);

        // Eyes (glowing magenta)
        graphics.fillStyle(0xFF00FF, 1);
        graphics.fillEllipse(centerX - 8, centerY - 38, 5, 7);
        graphics.fillEllipse(centerX + 8, centerY - 38, 5, 7);

        // Eye glow
        graphics.fillStyle(0xFFFFFF, 0.8);
        graphics.fillCircle(centerX - 8, centerY - 40, 2);
        graphics.fillCircle(centerX + 8, centerY - 40, 2);

        // Crown (void energy)
        graphics.fillStyle(0x9400D3, 1);
        graphics.fillTriangle(centerX - 20, centerY - 55, centerX - 25, centerY - 75, centerX - 15, centerY - 58);
        graphics.fillTriangle(centerX - 5, centerY - 58, centerX - 8, centerY - 85, centerX, centerY - 60);
        graphics.fillTriangle(centerX + 5, centerY - 58, centerX + 8, centerY - 85, centerX, centerY - 60);
        graphics.fillTriangle(centerX + 20, centerY - 55, centerX + 25, centerY - 75, centerX + 15, centerY - 58);

        // Crown jewel
        graphics.fillStyle(0xFF00FF, 1);
        graphics.fillCircle(centerX, centerY - 65, 6);
        graphics.fillStyle(0xFFFFFF, 0.7);
        graphics.fillCircle(centerX - 2, centerY - 67, 2);

        // Floating void orbs around her
        graphics.fillStyle(0x8B008B, 0.7);
        graphics.fillCircle(centerX - 55, centerY - 20, 10);
        graphics.fillCircle(centerX + 55, centerY - 20, 10);
        graphics.fillCircle(centerX - 45, centerY + 40, 8);
        graphics.fillCircle(centerX + 45, centerY + 40, 8);

        // Orb cores
        graphics.fillStyle(0xFF00FF, 0.9);
        graphics.fillCircle(centerX - 55, centerY - 20, 4);
        graphics.fillCircle(centerX + 55, centerY - 20, 4);

        // Hand energy (reaching out)
        graphics.fillStyle(0x9400D3, 0.8);
        graphics.fillCircle(centerX - 40, centerY + 10, 8);
        graphics.fillCircle(centerX + 40, centerY + 10, 8);

        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();

        return textureKey;
    }

    spawnVoidEmpress() {
        console.log('[FinalVoidLevel] Spawning Void Empress!');

        const textureKey = this.ensureVoidEmpressTexture();

        const spawnX = this.testMode
            ? this.getTestBossSpawnX()
            : this.levelWidth - 250;
        const spawnY = this.levelHeight - 280;

        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.bossTargetScale = VOID_EMPRESS_DISPLAY_SIZE /
            Math.max(1, this.boss.height);
        this.boss.body.setSize(this.boss.width * 0.5, this.boss.height * 0.62);
        this.boss.body.setOffset(this.boss.width * 0.25, this.boss.height * 0.14);
        this.boss.setScale(this.bossTargetScale);
        this.boss.body.setAllowGravity(false);

        // Keep combat targeting independent of transparent artwork bounds and flips.
        this.bossBody = this.add.zone(spawnX, spawnY + 60, 170, 380);
        this.physics.add.existing(this.bossBody);
        this.bossBody.body.setAllowGravity(false);
        this.bossBody.body.setImmovable(true);

        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.boss.isAttacking = false;

        if (this.platforms) {
            this.physics.add.collider(this.boss, this.platforms);
        }

        if (this.player) {
            this.physics.add.overlap(this.player, this.boss, this.handleBossCollision, null, this);
        }

        this.createBossHealthBar();

        // Grand entrance
        this.boss.setAlpha(0);
        this.boss.setScale(this.bossTargetScale * 0.25);
        this.boss.y = this.levelHeight - 400;

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: this.bossTargetScale,
            y: spawnY,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.startBossAI();
                this.cameras.main.shake(500, 0.015);

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

        // Floating orbs around empress
        this.empressOrbs = [];
        for (let i = 0; i < 4; i++) {
            const orb = this.add.graphics();
            orb.fillStyle(0x9400D3, 0.7);
            orb.fillCircle(0, 0, 12);
            orb.fillStyle(0xFF00FF, 0.5);
            orb.fillCircle(0, 0, 6);
            orb.setDepth(this.boss.depth + 1);
            this.empressOrbs.push({ graphics: orb, angle: (i / 4) * Math.PI * 2 });
        }

        const updateEffects = () => {
            if (!this.boss || !glow.active) return;

            glow.clear();
            glow.setPosition(this.boss.x, this.boss.y);

            // Void aura
            const auraIntensity = 0.15 + Math.sin(this.time.now * 0.003) * 0.05;
            glow.fillStyle(0x9400D3, auraIntensity);
            glow.fillCircle(0, 0, 120 + this.bossPhase * 10);

            // Inner glow changes with phase
            const phaseColors = [0x4B0082, 0x8B008B, 0x9400D3, 0xFF00FF, 0xFFFFFF];
            glow.fillStyle(phaseColors[this.bossPhase - 1], 0.1);
            glow.fillCircle(0, 10, 80);

            // Update floating orbs
            this.empressOrbs.forEach((orbData, i) => {
                orbData.angle += 0.02;
                const radius = 80 + this.bossPhase * 5;
                orbData.graphics.setPosition(
                    this.boss.x + Math.cos(orbData.angle) * radius,
                    this.boss.y + Math.sin(orbData.angle) * radius * 0.5
                );
            });
        };

        this.time.addEvent({
            delay: 30,
            callback: updateEffects,
            loop: true
        });

        this.bossGlow = glow;
    }

    createBossHealthBar() {
        const { width: screenWidth, height: screenHeight } = this.cameras.main;
        const compact =
            this.isMobile || screenWidth <= 480 || screenHeight < 620;
        const barWidth = Math.min(420, screenWidth - (compact ? 32 : 60));
        const barHeight = compact ? 18 : 26;
        const barX = (screenWidth - barWidth) / 2;
        // Leave both player-status rows unobstructed on portrait screens.
        const barY = compact ? 118 : 60;
        this.bossBarConfig = { barX, barY, barWidth, barHeight };

        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        this.bossNameText = this.add.text(screenWidth / 2, barY - (compact ? 31 : 34), 'VOID EMPRESS', {
            fontSize: compact ? '18px' : '25px',
            color: '#FF00FF',
            fontStyle: 'bold',
            stroke: '#1A0A2E',
            strokeThickness: 5
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        this.bossSubtitle = this.add.text(screenWidth / 2, barY - (compact ? 10 : 9), 'THE BEACON BREAKER', {
            fontSize: compact ? '10px' : '12px',
            color: '#DA70D6'
        }).setOrigin(0.5);
        this.bossUI.add(this.bossSubtitle);

        // Phase indicator
        this.phaseText = this.add.text(screenWidth / 2, barY + barHeight + (compact ? 11 : 14), 'Phase 1/5', {
            fontSize: compact ? '11px' : '14px',
            color: '#9400D3'
        }).setOrigin(0.5);
        this.bossUI.add(this.phaseText);

        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x1A0A2E, 0.95);
        bgBar.fillRoundedRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10, 10);
        bgBar.lineStyle(3, 0x9400D3, 1);
        bgBar.strokeRoundedRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10, 10);
        this.bossUI.add(bgBar);

        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        this.updateBossHealthBar();

        this.bossIndicator = this.add.text(screenWidth - 14, compact ? 158 : 112, '', {
            fontSize: compact ? '12px' : '14px',
            color: '#FF7CFF',
            backgroundColor: 'rgba(10, 4, 20, 0.78)',
            padding: { x: 7, y: 4 }
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(1499).setVisible(false);
    }

    updateBossHealthBar() {
        if (!this.bossHealthBar || !this.bossBarConfig) return;
        const { barX, barY, barWidth, barHeight } = this.bossBarConfig;

        this.bossHealthBar.clear();

        const healthPercent = Phaser.Math.Clamp(this.bossHealth / this.bossMaxHealth, 0, 1);
        const currentWidth = barWidth * healthPercent;

        // Color changes with health/phase
        let healthColor;
        if (healthPercent > 0.75) healthColor = 0x9400D3;
        else if (healthPercent > 0.5) healthColor = 0x8B008B;
        else if (healthPercent > 0.25) healthColor = 0xFF00FF;
        else healthColor = 0xFF4500;

        this.bossHealthBar.fillStyle(healthColor, 1);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight, 8);

        // Shimmer effect
        this.bossHealthBar.fillStyle(0xFFFFFF, 0.15);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight / 2, { tl: 8, tr: 8, bl: 0, br: 0 });

        // Update phase text
        if (this.phaseText) {
            this.phaseText.setText(`Phase ${this.bossPhase}/5`);
        }
    }

    updateBossIndicator() {
        if (!this.bossIndicator?.active || !this.boss?.active || !this.bossFightActive) {
            this.bossIndicator?.setVisible(false);
            return;
        }

        const view = this.cameras.main.worldView;
        const offscreenRight = this.boss.x > view.right - 40;
        const offscreenLeft = this.boss.x < view.left + 40;

        if (offscreenRight || offscreenLeft) {
            this.bossIndicator
                .setText(`${offscreenRight ? '>' : '<'} EMPRESS`)
                .setVisible(true)
                .setX(offscreenRight ? this.cameras.main.width - 14 : 14)
                .setOrigin(offscreenRight ? 1 : 0, 0);
        } else {
            this.bossIndicator.setVisible(false);
        }
    }

    startBossAI() {
        console.log('[FinalVoidLevel] Starting Void Empress AI');

        this.bossAITimer = this.time.addEvent({
            delay: 2500,
            callback: () => this.bossAITick(),
            loop: true
        });

        // Empress floats ominously
        this.tweens.add({
            targets: this.boss,
            y: this.boss.y - 20,
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    bossAITick() {
        if (!this.isBossCombatActive()) return;

        if (this.player && this.boss) {
            this.boss.facingRight = this.player.x > this.boss.x;
            this.boss.setFlipX(this.boss.facingRight);
        }

        // Attacks unlock with phases
        const attacks = ['void_tendrils', 'dark_nova'];
        if (this.bossPhase >= 2) attacks.push('shadow_clones');
        if (this.bossPhase >= 3) attacks.push('dimension_rift');
        if (this.bossPhase >= 4) attacks.push('void_storm');
        if (this.bossPhase >= 5) attacks.push('oblivion');

        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        this.executeBossAttack(attack);
    }

    isBossCombatActive() {
        return Boolean(
            this.bossFightActive &&
            !this.bossDefeated &&
            this.boss?.active
        );
    }

    getBossArenaBounds() {
        if (this.testMode) {
            return {
                left: 20,
                right: Math.max(300, this.cameras.main.width - 20),
                center: this.cameras.main.width / 2
            };
        }

        return {
            left: this.levelWidth - 620,
            right: this.levelWidth - 40,
            center: this.levelWidth - 330
        };
    }

    executeBossAttack(attackType) {
        if (!this.isBossCombatActive() || this.boss.isAttacking) return;

        this.boss.isAttacking = true;

        switch (attackType) {
            case 'void_tendrils':
                this.bossVoidTendrils();
                break;
            case 'dark_nova':
                this.bossDarkNova();
                break;
            case 'shadow_clones':
                this.bossShadowClones();
                break;
            case 'dimension_rift':
                this.bossDimensionRift();
                break;
            case 'void_storm':
                this.bossVoidStorm();
                break;
            case 'oblivion':
                this.bossOblivion();
                break;
        }

        const cooldown = Math.max(1000, 2000 - this.bossPhase * 150);
        this.time.delayedCall(cooldown, () => {
            if (this.isBossCombatActive()) this.boss.isAttacking = false;
        });
    }

    bossVoidTendrils() {
        if (!this.isBossCombatActive()) return;
        const { left, right } = this.getBossArenaBounds();

        // Tendrils rise from ground
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Clamp(
                left + ((i + 0.5) / 5) * (right - left) + (Math.random() - 0.5) * 45,
                left,
                right
            );

            // Telegraph
            const warning = this.add.graphics();
            warning.fillStyle(0x9400D3, 0.3);
            warning.fillRect(x - 20, this.levelHeight - 150, 40, 60);
            warning.setDepth(100);

            this.time.delayedCall(500, () => {
                warning.destroy();
                if (!this.isBossCombatActive()) return;

                const tendril = this.add.graphics();
                tendril.fillStyle(0x4B0082, 1);
                tendril.fillRect(-15, 0, 30, 100);
                tendril.fillStyle(0x9400D3, 0.8);
                tendril.fillRect(-10, 0, 20, 100);
                tendril.setPosition(x, this.levelHeight - 100);
                tendril.setDepth(850);

                // Animate rising
                tendril.y = this.levelHeight;
                this.tweens.add({
                    targets: tendril,
                    y: this.levelHeight - 150,
                    duration: 200,
                    onComplete: () => {
                        // Damage check
                        if (this.isBossCombatActive() && this.player &&
                            Math.abs(this.player.x - x) < 30 &&
                            this.player.y > this.levelHeight - 200) {
                            this.handlePlayerDamage(1);
                        }

                        // Retract
                        this.time.delayedCall(500, () => {
                            this.tweens.add({
                                targets: tendril,
                                y: this.levelHeight,
                                duration: 300,
                                onComplete: () => tendril.destroy()
                            });
                        });
                    }
                });
            });
        }
    }

    bossDarkNova() {
        if (!this.isBossCombatActive()) return;

        this.cameras.main.flash(200, 75, 0, 130);

        // Expanding dark ring
        const nova = this.add.graphics();
        nova.setPosition(this.boss.x, this.boss.y);
        nova.setDepth(850);

        let radius = 0;
        const novaEvent = this.time.addEvent({
            delay: 20,
            repeat: 40,
            callback: () => {
                if (!this.isBossCombatActive()) {
                    novaEvent.remove();
                    nova.destroy();
                    return;
                }

                radius += 12;
                nova.clear();
                nova.lineStyle(15, 0x9400D3, 1 - radius / 500);
                nova.strokeCircle(0, 0, radius);
                nova.lineStyle(8, 0xFF00FF, 0.5 - radius / 600);
                nova.strokeCircle(0, 0, radius - 10);

                if (this.player && this.isBossCombatActive()) {
                    const dist = Math.sqrt(Math.pow(this.player.x - this.boss.x, 2) + Math.pow(this.player.y - this.boss.y, 2));
                    if (Math.abs(dist - radius) < 25) {
                        this.handlePlayerDamage(2);
                    }
                }
            },
            onComplete: () => nova.destroy()
        });
    }

    bossShadowClones() {
        if (!this.isBossCombatActive()) return;

        const cloneCount = this.bossPhase >= 4 ? 3 : 2;

        for (let i = 0; i < cloneCount; i++) {
            const clone = this.add.sprite(this.boss.x + (i - 1) * 150, this.boss.y, 'voidEmpress');
            clone.setAlpha(0.4);
            clone.setTint(0x4B0082);
            clone.setScale(this.bossTargetScale * 0.7);
            clone.setDepth(870);

            this.time.delayedCall(300 + i * 200, () => {
                if (!this.isBossCombatActive()) {
                    clone.destroy();
                    return;
                }

                if (this.player) {
                    this.tweens.add({
                        targets: clone,
                        x: this.player.x,
                        y: this.player.y,
                        duration: 500,
                        onComplete: () => {
                            if (this.isBossCombatActive() && this.player &&
                                Math.abs(this.player.x - clone.x) < 50) {
                                this.handlePlayerDamage(1);
                            }

                            // Clone explodes
                            const explosion = this.add.graphics();
                            explosion.fillStyle(0x9400D3, 0.5);
                            explosion.fillCircle(0, 0, 40);
                            explosion.setPosition(clone.x, clone.y);

                            this.tweens.add({
                                targets: explosion,
                                alpha: 0,
                                scale: 2,
                                duration: 300,
                                onComplete: () => explosion.destroy()
                            });

                            clone.destroy();
                        }
                    });
                }
            });
        }
    }

    bossDimensionRift() {
        if (!this.isBossCombatActive() || !this.player) return;

        const { width, height } = this.cameras.main;
        const { left, right } = this.getBossArenaBounds();

        // Warning
        const warning = this.add.text(width / 2, height / 3, '⚠ DIMENSION RIFT ⚠', {
            fontSize: '24px',
            color: '#FF00FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: warning,
            alpha: 0,
            duration: 1000,
            onComplete: () => warning.destroy()
        });

        // Create rifts at random positions
        for (let i = 0; i < 4; i++) {
            this.time.delayedCall(i * 400, () => {
                if (!this.isBossCombatActive()) return;

                const riftX = Phaser.Math.Between(Math.ceil(left), Math.floor(right));
                const riftY = this.levelHeight - 200;

                const rift = this.add.graphics();
                rift.fillStyle(0x000000, 0.8);
                rift.fillEllipse(0, 0, 80, 40);
                rift.lineStyle(3, 0xFF00FF, 1);
                rift.strokeEllipse(0, 0, 80, 40);
                rift.setPosition(riftX, riftY);
                rift.setDepth(100);
                rift.setScale(0);

                this.tweens.add({
                    targets: rift,
                    scale: 1,
                    duration: 300,
                    onComplete: () => {
                        if (!this.isBossCombatActive()) {
                            rift.destroy();
                            return;
                        }

                        // Pull effect
                        const pullEvent = this.time.addEvent({
                            delay: 50,
                            repeat: 30,
                            callback: () => {
                                if (!this.isBossCombatActive()) {
                                    pullEvent.remove();
                                    rift.destroy();
                                    return;
                                }

                                if (this.player) {
                                    const dist = Math.sqrt(Math.pow(this.player.x - riftX, 2) + Math.pow(this.player.y - riftY, 2));
                                    if (dist < 150) {
                                        // Pull player toward rift
                                        const pullStrength = 3;
                                        const angle = Math.atan2(riftY - this.player.y, riftX - this.player.x);
                                        this.player.x += Math.cos(angle) * pullStrength;
                                        this.player.y += Math.sin(angle) * pullStrength;

                                        if (dist < 40) {
                                            this.handlePlayerDamage(2);
                                        }
                                    }
                                }
                            }
                        });

                        this.time.delayedCall(1500, () => {
                            pullEvent.remove();
                            if (!rift.active) return;
                            this.tweens.add({
                                targets: rift,
                                scale: 0,
                                duration: 300,
                                onComplete: () => rift.destroy()
                            });
                        });
                    }
                });
            });
        }
    }

    bossVoidStorm() {
        if (!this.isBossCombatActive()) return;

        const { width, height } = this.cameras.main;
        const { left, right } = this.getBossArenaBounds();

        const warning = this.add.text(width / 2, height / 3, '⚡ VOID STORM! ⚡', {
            fontSize: '28px',
            color: '#9400D3',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: warning,
            alpha: 0,
            duration: 1500,
            onComplete: () => warning.destroy()
        });

        // Rain of void energy
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 100, () => {
                if (!this.isBossCombatActive()) return;
                const x = Phaser.Math.Between(Math.ceil(left), Math.floor(right));

                const bolt = this.add.graphics();
                bolt.fillStyle(0x9400D3, 1);
                bolt.fillTriangle(-8, 0, 8, 0, 0, 30);
                bolt.setPosition(x, -30);
                bolt.setDepth(850);

                this.tweens.add({
                    targets: bolt,
                    y: this.levelHeight - 100,
                    x: x + (Math.random() - 0.5) * 100,
                    duration: 800,
                    onComplete: () => {
                        if (this.isBossCombatActive() && this.player &&
                            Math.abs(this.player.x - bolt.x) < 30) {
                            this.handlePlayerDamage(1);
                        }

                        // Impact effect
                        const impact = this.add.graphics();
                        impact.fillStyle(0xFF00FF, 0.5);
                        impact.fillCircle(0, 0, 30);
                        impact.setPosition(bolt.x, bolt.y);

                        this.tweens.add({
                            targets: impact,
                            alpha: 0,
                            scale: 1.5,
                            duration: 300,
                            onComplete: () => impact.destroy()
                        });

                        bolt.destroy();
                    }
                });
            });
        }
    }

    bossOblivion() {
        if (!this.isBossCombatActive()) return;

        const { width, height } = this.cameras.main;
        const { center: safeZoneX } = this.getBossArenaBounds();

        // Ultimate attack - screen-wide danger
        this.cameras.main.flash(500, 255, 0, 255);

        const warning = this.add.text(width / 2, height / 2, '💀 OBLIVION 💀', {
            fontSize: '48px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#FF00FF',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: warning,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 2000,
            onComplete: () => warning.destroy()
        });

        // Only safe zone is near the center
        this.time.delayedCall(1000, () => {
            if (!this.isBossCombatActive()) return;

            // Damage everything outside safe zone
            const oblivionEvent = this.time.addEvent({
                delay: 100,
                repeat: 20,
                callback: () => {
                    if (!this.isBossCombatActive()) {
                        oblivionEvent.remove();
                        return;
                    }

                    if (this.player && Math.abs(this.player.x - safeZoneX) > 150) {
                        this.handlePlayerDamage(1);
                    }

                    // Visual effect
                    const voidWave = this.add.graphics();
                    voidWave.fillStyle(0x4B0082, 0.3);
                    voidWave.fillRect(0, 0, this.levelWidth, this.levelHeight);
                    voidWave.setScrollFactor(0);
                    voidWave.setDepth(100);

                    // Safe zone indicator
                    voidWave.fillStyle(0x00FF00, 0.1);
                    voidWave.fillRect(safeZoneX - 150, 0, 300, this.levelHeight);

                    this.tweens.add({
                        targets: voidWave,
                        alpha: 0,
                        duration: 100,
                        onComplete: () => voidWave.destroy()
                    });
                }
            });
        });
    }

    handleBossCollision(player, boss) {
        if (!this.isBossCombatActive() || this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(2);
    }

    handlePlayerDamage(damage) {
        this.takeDamage(damage);
    }

    damageBoss(amount = 1) {
        if (!this.isBossCombatActive()) return;

        this.bossHealth = Math.max(0, this.bossHealth - amount);
        this.updateBossHealthBar();

        this.boss.setTint(0xFFFFFF);
        this.time.delayedCall(100, () => {
            if (this.boss) this.boss.clearTint();
        });

        // Phase transitions at 75%, 50%, 25%, 10%
        const healthPercent = this.bossHealth / this.bossMaxHealth;

        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        } else if (healthPercent <= 0.10 && this.bossPhase === 4) {
            this.triggerPhase(5, 'YOUR COMPANION HOLDS THE LINE', 0xFFFFFF);
        } else if (healthPercent <= 0.25 && this.bossPhase === 3) {
            this.triggerPhase(4, 'THE LIVING NETWORK ANSWERS', 0xFF00FF);
        } else if (healthPercent <= 0.50 && this.bossPhase === 2) {
            this.triggerPhase(3, 'THE EMPRESS FRACTURES REALITY', 0x9400D3);
        } else if (healthPercent <= 0.75 && this.bossPhase === 1) {
            this.triggerPhase(2, 'THE BEACON LINE FLICKERS', 0x4B0082);
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    triggerPhase(phase, message, tint) {
        if (!this.isBossCombatActive()) return;

        this.bossPhase = phase;
        this.cameras.main.shake(800, 0.03);
        this.cameras.main.flash(500, (tint >> 16) & 0xFF, (tint >> 8) & 0xFF, tint & 0xFF);

        if (this.boss) this.boss.setTint(tint);

        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, `⚡ ${message} ⚡`, {
            fontSize: '32px',
            color: '#' + tint.toString(16).padStart(6, '0'),
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 80,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 2000,
            onComplete: () => phaseText.destroy()
        });

        // Speed up attacks
        if (this.bossAITimer) {
            this.bossAITimer.delay = Math.max(1000, 2500 - phase * 300);
        }

        if (phase === 4 || phase === 5) {
            this.grantBondRecovery(phase);
        }

        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    grantBondRecovery(phase) {
        const previousHealth = this.health;
        const previousEnergy = this.crystalEnergy;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.crystalEnergy = Math.min(this.maxCrystalEnergy, this.crystalEnergy + 1);
        this.updateHealthDisplay();
        this.updateEnergyDisplay();

        if (this.health === previousHealth && this.crystalEnergy === previousEnergy) return;

        const recoveryText = phase === 4
            ? 'THE NETWORK ANSWERS: +1 HEART / +1 ENERGY'
            : 'YOUR COMPANION HOLDS THE LINE: +1 HEART / +1 ENERGY';
        this.showFloatingText(
            recoveryText,
            this.player?.x || this.getBossArenaBounds().center,
            (this.player?.y || this.levelHeight - 180) - 80,
            phase === 4 ? '#A9F3E4' : '#F2C94C'
        );
        window.AudioManager?.playAchievement?.();
    }

    onBossDefeated() {
        if (this.bossDefeated || !this.boss) return;

        console.log('[FinalVoidLevel] Void Empress restored.');
        this.bossDefeated = true;
        this.bossFightActive = false;

        if (this.bossAITimer) {
            this.bossAITimer.remove();
            this.bossAITimer = null;
        }
        if (this.boss.body) {
            this.boss.body.enable = false;
        }
        if (this.bossBody?.body) {
            this.bossBody.body.enable = false;
        }
        this.boss.isAttacking = false;
        this.bossBody?.setVelocity?.(0, 0);
        this.tweens.killTweensOf(this.boss);
        this.cameras.main.x = 0;
        this.cameras.main.y = 0;

        this.cameras.main.shake(1500, 0.05);
        this.cameras.main.flash(2000, 255, 255, 255);

        // The corruption breaks apart while the Empress regains her own light.
        const restorationDuration = 4000;

        // A pale restoration wave replaces the void storm.
        const whiteout = this.add.graphics();
        whiteout.fillStyle(0xD8FFF5, 0);
        whiteout.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        whiteout.setScrollFactor(0);
        whiteout.setDepth(3000);

        this.tweens.add({
            targets: whiteout,
            alpha: 0.8,
            duration: restorationDuration,
            onComplete: () => {
                this.tweens.add({
                    targets: whiteout,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => whiteout.destroy()
                });
            }
        });

        // The Empress steadies before withdrawing from the battlefield.
        this.boss.setVelocity(0, 0);
        this.boss.setTint?.(0x8FE3CF);

        // Released void fragments brighten as they leave her.
        for (let i = 0; i < 50; i++) {
            this.time.delayedCall(i * 50, () => {
                if (!this.boss) return;

                const particle = this.add.graphics();
                const color = [0x8FE3CF, 0xF2C94C, 0xBFA6FF, 0xFFFFFF][Math.floor(Math.random() * 4)];
                particle.fillStyle(color, 1);
                particle.fillCircle(0, 0, 5 + Math.random() * 10);
                particle.setPosition(this.boss.x + (Math.random() - 0.5) * 100, this.boss.y + (Math.random() - 0.5) * 100);
                particle.setDepth(900);

                const angle = Math.random() * Math.PI * 2;
                const speed = 200 + Math.random() * 300;

                this.tweens.add({
                    targets: particle,
                    x: particle.x + Math.cos(angle) * speed,
                    y: particle.y + Math.sin(angle) * speed,
                    alpha: 0,
                    scale: 0.3,
                    duration: 2000,
                    onComplete: () => particle.destroy()
                });
            });
        }

        // The hostile orbit fades with the corruption.
        if (this.empressOrbs) {
            this.empressOrbs.forEach(orb => {
                this.tweens.add({
                    targets: orb.graphics,
                    alpha: 0,
                    scale: 3,
                    duration: 1000,
                    onComplete: () => orb.graphics.destroy()
                });
            });
        }

        this.tweens.add({
            targets: this.boss,
            alpha: 0.12,
            scaleX: 0.92,
            scaleY: 0.92,
            y: this.boss.y - 90,
            duration: restorationDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.boss.destroy();
                this.boss = null;
                this.bossBody?.destroy?.();
                this.bossBody = null;

                if (this.bossGlow) this.bossGlow.destroy();

                this.showBossVictory();
            }
        });

        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 1000
            });
        }
    }

    showBossVictory() {
        const layout = this.getLevelModalLayout({ maxWidth: 520, maxHeight: 260 });
        const { width, contentWidth, y, font } = layout;

        if (this.resultPreview) {
            this.levelCompletionResult = { coinsAwarded: 900 };
        } else {
            this.completeLevelProgression({
                achievementLevelId: 'finalVoid',
                shipPartId: 'command_module',
                speedrunThreshold: 360000
            });
        }

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];

        const allPartsCollected = FINAL_SHIP_PART_IDS.every(partId => shipParts.includes(partId));

        const victoryText = this.add.text(width / 2, y(80), 'VOID EMPRESS RESTORED', {
            fontSize: font(36, 27),
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.3, to: 1 },
            scaleY: { from: 0.3, to: 1 },
            duration: 1000,
            ease: 'Back.easeOut'
        });

        const subtitleText = this.add.text(width / 2, y(145), allPartsCollected ?
            'BEACON LINE RESTORED - SHIP COMPLETE' :
            'BEACON LINE RESTORED - COMMAND MODULE ACQUIRED', {
            fontSize: font(24, 19),
            color: allPartsCollected ? '#00FF00' : '#FFD700',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: subtitleText,
            alpha: 1,
            delay: 1000,
            duration: 500
        });

        const rewardText = this.add.text(
            width / 2,
            y(205),
            `Guardian Reward: ${this.levelCompletionResult?.coinsAwarded || 0} Cosmic Coins`,
            {
                fontSize: font(20, 16),
                color: '#FFD700',
                align: 'center',
                wordWrap: { width: contentWidth }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: rewardText,
            alpha: 1,
            delay: 1300,
            duration: 500
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        if (!this.resultPreview && window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('guardian_restored', { bossId: 'void_empress' });
            if (allPartsCollected) {
                window.AchievementSystem.recordEvent('game_complete', {});
            }
        }

        // Transition to victory scene or completion screen
        this.time.delayedCall(4000, () => {
            victoryText.destroy();
            subtitleText.destroy();
            rewardText.destroy();

            if (allPartsCollected && !this.resultPreview) {
                // Go to victory scene
                this.scene.start('VictoryScene');
            } else {
                this.showLevelComplete();
            }
        });
    }

    showLevelComplete() {
        this.bindLevelCompletionReturn();

        const layout = this.getLevelModalLayout({ maxWidth: 450, maxHeight: 350 });
        const {
            width, height, panelWidth, panelHeight, panelX, panelY,
            contentWidth, y, font, buttonPadding
        } = layout;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2500);

        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x9400D3, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(2501);

        this.add.text(width / 2, y(40), 'VOID EMPRESS RESTORED', {
            fontSize: font(28, 23),
            color: '#FF00FF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        this.add.text(width / 2, y(100), '🔧 Command Module Acquired! 🔧', {
            fontSize: font(20, 16),
            color: '#FFD700',
            align: 'center',
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const collectedFinalParts = FINAL_SHIP_PART_IDS.filter(partId => shipParts.includes(partId)).length;
        const finalTotal = FINAL_SHIP_PART_IDS.length;
        this.add.text(width / 2, y(150), `Ship Parts: ${collectedFinalParts}/${finalTotal}`, {
            fontSize: font(18, 15),
            color: '#DA70D6'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const completionMessage = [
            `Guardian Reward: ${this.levelCompletionResult?.coinsAwarded || 0} Cosmic Coins`,
            collectedFinalParts < finalTotal ? 'Collect all parts to complete your ship!' : null
        ].filter(Boolean).join('\n');
        this.add.text(width / 2, y(205), completionMessage, {
            fontSize: font(14, 13),
            color: '#FFD700',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: contentWidth }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const returnBtn = this.add.text(width / 2, y(290), '[ RETURN TO HUB ]', {
            fontSize: font(22, 17),
            color: '#9400D3',
            backgroundColor: '#2A1A4A',
            padding: buttonPadding
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ cursor: 'pointer' });

        returnBtn.on('pointerover', () => returnBtn.setColor('#FF00FF'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#9400D3'));
        returnBtn.on('pointerdown', () => {
            this.returnToHub();
        });
    }

    shutdown() {
        console.log('[FinalVoidLevel] Shutting down');
        this.clearLevelEntryKeyHandler();
        this.bossFightActive = false;
        this.cameras.main.x = 0;
        this.cameras.main.y = 0;

        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }
        this.bossBody?.destroy?.();
        this.bossBody = null;

        if (this.bossUI) {
            this.bossUI.destroy();
            this.bossUI = null;
        }

        if (this.bossGlow) {
            this.bossGlow.destroy();
            this.bossGlow = null;
        }

        if (this.bossAITimer) {
            this.bossAITimer.remove();
            this.bossAITimer = null;
        }

        if (this.empressOrbs) {
            this.empressOrbs.forEach(orb => orb.graphics.destroy());
            this.empressOrbs = [];
        }

        this.voidParticles.forEach(p => p.destroy());
        this.voidParticles = [];

        this.bondAnchors.forEach(anchor => {
            anchor.zone?.destroy?.();
            anchor.visual?.destroy?.();
            anchor.label?.destroy?.();
        });
        this.bondAnchors = [];

        this.voidFractures.forEach(fracture => {
            fracture.zone?.destroy?.();
            fracture.visual?.destroy?.();
        });
        this.voidFractures = [];

        if (this.empressGate) {
            this.empressGate.zone?.destroy?.();
            this.empressGate.visual?.destroy?.();
            this.empressGate.label?.destroy?.();
            this.empressGate = null;
        }

        this.bossArenaVisual?.destroy?.();
        this.bossArenaVisual = null;
        this.bossIndicator?.destroy?.();
        this.bossIndicator = null;
        this.objectiveDisplay?.destroy?.();
        this.objectiveDisplay = null;
        this.bossBarConfig = null;
        this.bossSubtitle = null;

        super.shutdown();
    }
}

export default FinalVoidLevel;

if (typeof window !== 'undefined') {
    window.FinalVoidLevel = FinalVoidLevel;
}
