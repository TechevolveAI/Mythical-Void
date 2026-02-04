import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * FinalVoidLevel - The ultimate boss encounter
 *
 * Story: "At the edge of reality, where the void meets the cosmos,
 * the Void Empress waits. She is the final guardian, the keeper of
 * the Command Module - the last piece needed to complete your ship.
 * Defeat her, and the stars await. Fall, and be consumed by the void."
 *
 * Features:
 * - Epic 5-phase boss fight
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
        this.bossHealth = 0;
        this.bossMaxHealth = 20;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Void effects
        this.voidParticles = [];
        this.realityDistortion = 0;
    }

    init(data) {
        super.init(data);

        this.testMode = data?.testMode || false;

        this.bossDefeated = false;
        this.bossFightActive = false;

        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        this.voidParticles = [];
        this.realityDistortion = 0;

        console.log('[FinalVoidLevel] Level state reset');
    }

    create() {
        super.create();

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('level_entered', { levelId: 'finalVoid' });
        }

        this.levelStartTime = Date.now();

        if (this.testMode) {
            this.startTestMode();
        } else {
            this.showLevelEntry();
        }
    }

    startTestMode() {
        console.log('[FinalVoidLevel] TEST MODE - Spawning final boss');
        this.createVoidBackground();
        this.createBossArena();

        if (this.player) {
            this.player.setPosition(200, this.levelHeight - 200);
        }

        this.time.delayedCall(500, () => {
            this.startBossFight();
        });
    }

    showLevelEntry() {
        const { width, height } = this.cameras.main;

        this.physics.pause();

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.95);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        const panelWidth = 500;
        const panelHeight = 400;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0A0A1A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(4, 0x9400D3, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Ominous void glow
        const glowPanel = this.add.graphics();
        glowPanel.fillStyle(0x4B0082, 0.3);
        glowPanel.fillRoundedRect(panelX - 10, panelY - 10, panelWidth + 20, panelHeight + 20, 25);
        glowPanel.setScrollFactor(0);
        glowPanel.setDepth(3000);

        const title = this.add.text(width / 2, panelY + 50, 'THE FINAL VOID', {
            fontSize: '42px',
            color: '#9400D3',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

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

        this.add.text(width / 2, panelY + 100, '"The Empress awaits at reality\'s edge"', {
            fontSize: '16px',
            color: '#DA70D6',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const divider = this.add.graphics();
        divider.lineStyle(2, 0x9400D3, 0.5);
        divider.lineBetween(panelX + 50, panelY + 140, panelX + panelWidth - 50, panelY + 140);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        this.add.text(width / 2, panelY + 170, '⚠ FINAL BOSS ⚠', {
            fontSize: '18px',
            color: '#FF4500'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, panelY + 210, 'VOID EMPRESS', {
            fontSize: '28px',
            color: '#FF00FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, panelY + 250, '5 Phases • 20 Health • Ultimate Challenge', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, panelY + 290, 'Reward: Command Module + Space Travel', {
            fontSize: '16px',
            color: '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 60, '[ FACE YOUR DESTINY ]', {
            fontSize: '22px',
            color: '#9400D3',
            backgroundColor: '#1A0A2E',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        enterBtn.on('pointerover', () => enterBtn.setColor('#FF00FF'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#9400D3'));
        enterBtn.on('pointerdown', () => {
            this.tweens.add({
                targets: [overlay, panel, glowPanel, title, enterBtn],
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    overlay.destroy();
                    panel.destroy();
                    glowPanel.destroy();
                    this.physics.resume();
                    this.startLevel();
                }
            });
        });
    }

    startLevel() {
        console.log('[FinalVoidLevel] Starting final level');
        this.createVoidBackground();
        this.createBossArena();

        // Immediate boss fight - no exploration
        this.time.delayedCall(1000, () => {
            this.startBossFight();
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

        if (!this.platforms) {
            this.platforms = this.physics.add.staticGroup();
        }

        const platformZone = this.add.zone(this.levelWidth / 2, groundY + 50, this.levelWidth, 100);
        this.physics.add.existing(platformZone, true);
        this.platforms.add(platformZone);
    }

    startBossFight() {
        console.log('[FinalVoidLevel] Starting Void Empress boss fight!');
        this.bossFightActive = true;

        this.physics.pause();

        // Epic entrance
        this.cameras.main.flash(1000, 75, 0, 130);
        this.cameras.main.shake(2000, 0.02);

        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, '⚠ THE VOID EMPRESS DESCENDS ⚠', {
            fontSize: '36px',
            color: '#FF00FF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        this.tweens.add({
            targets: warningText,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 2000,
            onComplete: () => warningText.destroy()
        });

        this.time.delayedCall(2000, () => {
            this.spawnVoidEmpress();
            this.physics.resume();
        });
    }

    /**
     * Create Void Empress placeholder texture
     * PLACEHOLDER - Replace with custom artwork later
     */
    createVoidEmpressTexture() {
        const textureKey = 'voidEmpress';
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

        const textureKey = this.createVoidEmpressTexture();

        const { width } = this.cameras.main;
        const spawnX = this.testMode ? width / 2 + 150 : this.levelWidth / 2;
        const spawnY = this.levelHeight - 280;

        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.boss.body.setSize(100, 120);
        this.boss.body.setOffset(40, 30);
        this.boss.setScale(1.4);
        this.boss.body.setAllowGravity(false);

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
        this.boss.setScale(0.3);
        this.boss.y = this.levelHeight - 400;

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: 1.4,
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
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(400, screenWidth - 60);
        const barHeight = 32;
        const barX = (screenWidth - barWidth) / 2;
        const barY = 55;

        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        this.bossNameText = this.add.text(screenWidth / 2, barY - 32, '👑 VOID EMPRESS 👑', {
            fontSize: '26px',
            color: '#FF00FF',
            fontStyle: 'bold',
            stroke: '#1A0A2E',
            strokeThickness: 5
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        const subtitle = this.add.text(screenWidth / 2, barY - 8, 'Keeper of the Final Void', {
            fontSize: '12px',
            color: '#DA70D6'
        }).setOrigin(0.5);
        this.bossUI.add(subtitle);

        // Phase indicator
        this.phaseText = this.add.text(screenWidth / 2, barY + barHeight + 15, 'Phase 1/5', {
            fontSize: '14px',
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

        this.updateBossHealthBar(barX, barY, barWidth, barHeight);
    }

    updateBossHealthBar(barX, barY, barWidth, barHeight) {
        if (!this.bossHealthBar) return;

        barX = barX || (this.cameras.main.width - 400) / 2;
        barY = barY || 55;
        barWidth = barWidth || 400;
        barHeight = barHeight || 32;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;
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
        if (!this.boss || this.bossDefeated || !this.bossFightActive) return;

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

    executeBossAttack(attackType) {
        if (!this.boss || this.boss.isAttacking) return;

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
            if (this.boss) this.boss.isAttacking = false;
        });
    }

    bossVoidTendrils() {
        if (!this.boss) return;

        // Tendrils rise from ground
        for (let i = 0; i < 5; i++) {
            const x = 200 + i * 200 + (Math.random() - 0.5) * 100;

            // Telegraph
            const warning = this.add.graphics();
            warning.fillStyle(0x9400D3, 0.3);
            warning.fillRect(x - 20, this.levelHeight - 150, 40, 60);
            warning.setDepth(100);

            this.time.delayedCall(500, () => {
                warning.destroy();

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
                        if (this.player && Math.abs(this.player.x - x) < 30 && this.player.y > this.levelHeight - 200) {
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
        if (!this.boss) return;

        this.cameras.main.flash(200, 75, 0, 130);

        // Expanding dark ring
        const nova = this.add.graphics();
        nova.setPosition(this.boss.x, this.boss.y);
        nova.setDepth(850);

        let radius = 0;
        this.time.addEvent({
            delay: 20,
            repeat: 40,
            callback: () => {
                radius += 12;
                nova.clear();
                nova.lineStyle(15, 0x9400D3, 1 - radius / 500);
                nova.strokeCircle(0, 0, radius);
                nova.lineStyle(8, 0xFF00FF, 0.5 - radius / 600);
                nova.strokeCircle(0, 0, radius - 10);

                if (this.player) {
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
        if (!this.boss) return;

        const cloneCount = this.bossPhase >= 4 ? 3 : 2;

        for (let i = 0; i < cloneCount; i++) {
            const clone = this.add.sprite(this.boss.x + (i - 1) * 150, this.boss.y, 'voidEmpress');
            clone.setAlpha(0.4);
            clone.setTint(0x4B0082);
            clone.setScale(0.9);
            clone.setDepth(870);

            this.time.delayedCall(300 + i * 200, () => {
                if (this.player) {
                    this.tweens.add({
                        targets: clone,
                        x: this.player.x,
                        y: this.player.y,
                        duration: 500,
                        onComplete: () => {
                            if (this.player && Math.abs(this.player.x - clone.x) < 50) {
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
        if (!this.boss || !this.player) return;

        const { width, height } = this.cameras.main;

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
                const riftX = Math.random() * (this.levelWidth - 200) + 100;
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
                        // Pull effect
                        this.time.addEvent({
                            delay: 50,
                            repeat: 30,
                            callback: () => {
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
        if (!this.boss) return;

        const { width, height } = this.cameras.main;

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
                const x = Math.random() * this.levelWidth;

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
                        if (this.player && Math.abs(this.player.x - bolt.x) < 30) {
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
        if (!this.boss) return;

        const { width, height } = this.cameras.main;

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
            const safeZoneX = this.levelWidth / 2;

            // Damage everything outside safe zone
            this.time.addEvent({
                delay: 100,
                repeat: 20,
                callback: () => {
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
        if (this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(2);
    }

    handlePlayerDamage(damage) {
        if (this.isInvincible || this.isPlayerDead) return;

        this.health -= damage;
        this.isInvincible = true;

        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                if (this.player) this.player.setAlpha(1);
                this.isInvincible = false;
            }
        });

        if (this.hud) {
            this.hud.updateHealth(this.health, this.maxHealth);
        }

        if (this.health <= 0) {
            this.handlePlayerDeath();
        }

        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }
    }

    handlePlayerDeath() {
        this.isPlayerDead = true;
        console.log('[FinalVoidLevel] Player died!');
    }

    damageBoss(amount = 1) {
        if (!this.boss || this.bossDefeated) return;

        this.bossHealth -= amount;
        this.updateBossHealthBar();

        this.boss.setTint(0xFFFFFF);
        this.time.delayedCall(100, () => {
            if (this.boss) this.boss.clearTint();
        });

        // Phase transitions at 75%, 50%, 25%, 10%
        const healthPercent = this.bossHealth / this.bossMaxHealth;

        if (healthPercent <= 0.75 && this.bossPhase === 1) this.triggerPhase(2, 'EMPRESS AWAKENS!', 0x4B0082);
        else if (healthPercent <= 0.50 && this.bossPhase === 2) this.triggerPhase(3, 'VOID CHANNELING!', 0x9400D3);
        else if (healthPercent <= 0.25 && this.bossPhase === 3) this.triggerPhase(4, 'ULTIMATE POWER!', 0xFF00FF);
        else if (healthPercent <= 0.10 && this.bossPhase === 4) this.triggerPhase(5, 'FINAL DESPERATION!', 0xFFFFFF);

        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    triggerPhase(phase, message, tint) {
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

        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    onBossDefeated() {
        console.log('[FinalVoidLevel] VOID EMPRESS DEFEATED!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        if (this.bossAITimer) this.bossAITimer.remove();
        this.tweens.killTweensOf(this.boss);

        this.cameras.main.shake(1500, 0.05);
        this.cameras.main.flash(2000, 255, 255, 255);

        // Epic death sequence
        const deathDuration = 4000;

        // Screen goes white gradually
        const whiteout = this.add.graphics();
        whiteout.fillStyle(0xFFFFFF, 0);
        whiteout.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        whiteout.setScrollFactor(0);
        whiteout.setDepth(3000);

        this.tweens.add({
            targets: whiteout,
            alpha: 0.8,
            duration: deathDuration,
            onComplete: () => {
                this.tweens.add({
                    targets: whiteout,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => whiteout.destroy()
                });
            }
        });

        // Empress dissolves
        this.boss.setVelocity(0, 0);

        // Void particles explode outward
        for (let i = 0; i < 50; i++) {
            this.time.delayedCall(i * 50, () => {
                if (!this.boss) return;

                const particle = this.add.graphics();
                const color = [0x9400D3, 0xFF00FF, 0x4B0082, 0xFFFFFF][Math.floor(Math.random() * 4)];
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

        // Destroy orbs
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
            alpha: 0,
            scaleX: 0.1,
            scaleY: 2,
            y: this.boss.y - 200,
            duration: deathDuration,
            ease: 'Power4',
            onComplete: () => {
                this.boss.destroy();
                this.boss = null;

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
        const { width, height } = this.cameras.main;

        // Award final ship part
        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        if (!shipParts.includes('command_module')) {
            shipParts.push('command_module');
            window.GameState?.set('hubWorld.shipParts.collected', shipParts);
            window.GameState?.set('hubWorld.shipParts.finalBossUnlocked', true);
            console.log('[FinalVoidLevel] Ship part acquired: Command Module. Total parts:', shipParts.length);
        }

        // Check if all parts collected
        const allPartsCollected = shipParts.length >= 4;

        const victoryText = this.add.text(width / 2, height / 2 - 50, '👑 VOID EMPRESS DETHRONED 👑', {
            fontSize: '36px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: victoryText,
            alpha: 1,
            scaleX: { from: 0.3, to: 1 },
            scaleY: { from: 0.3, to: 1 },
            duration: 1000,
            ease: 'Back.easeOut'
        });

        const subtitleText = this.add.text(width / 2, height / 2 + 20, allPartsCollected ?
            '✨ ALL SHIP PARTS COLLECTED! ✨' :
            '🔧 Command Module Acquired! 🔧', {
            fontSize: '24px',
            color: allPartsCollected ? '#00FF00' : '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.tweens.add({
            targets: subtitleText,
            alpha: 1,
            delay: 1000,
            duration: 500
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('boss_defeated', { bossId: 'void_empress' });
            if (allPartsCollected) {
                window.AchievementSystem.recordEvent('game_complete', {});
            }
        }

        // Transition to victory scene or completion screen
        this.time.delayedCall(4000, () => {
            victoryText.destroy();
            subtitleText.destroy();

            if (allPartsCollected) {
                // Go to victory scene
                this.scene.start('VictoryScene');
            } else {
                this.showLevelComplete();
            }
        });
    }

    showLevelComplete() {
        const { width, height } = this.cameras.main;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2500);

        const panelWidth = 450;
        const panelHeight = 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x9400D3, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(2501);

        this.add.text(width / 2, panelY + 40, 'VOID EMPRESS DEFEATED!', {
            fontSize: '28px',
            color: '#FF00FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        this.add.text(width / 2, panelY + 100, '🔧 Command Module Acquired! 🔧', {
            fontSize: '20px',
            color: '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        this.add.text(width / 2, panelY + 150, `Ship Parts: ${shipParts.length}/4`, {
            fontSize: '18px',
            color: '#DA70D6'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        if (shipParts.length < 4) {
            this.add.text(width / 2, panelY + 190, 'Collect all parts to complete your ship!', {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);
        }

        const returnBtn = this.add.text(width / 2, panelY + panelHeight - 60, '[ RETURN TO HUB ]', {
            fontSize: '22px',
            color: '#9400D3',
            backgroundColor: '#2A1A4A',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ cursor: 'pointer' });

        returnBtn.on('pointerover', () => returnBtn.setColor('#FF00FF'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#9400D3'));
        returnBtn.on('pointerdown', () => {
            this.scene.start('HubWorldScene');
        });
    }

    shutdown() {
        console.log('[FinalVoidLevel] Shutting down');

        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }

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
        }

        if (this.empressOrbs) {
            this.empressOrbs.forEach(orb => orb.graphics.destroy());
            this.empressOrbs = [];
        }

        this.voidParticles.forEach(p => p.destroy());
        this.voidParticles = [];

        super.shutdown();
    }
}

export default FinalVoidLevel;

if (typeof window !== 'undefined') {
    window.FinalVoidLevel = FinalVoidLevel;
}
