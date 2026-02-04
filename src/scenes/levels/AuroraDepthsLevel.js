import PlatformerLevelScene from '../PlatformerLevelScene.js';

/**
 * AuroraDepthsLevel - Aurora Depths platformer level
 *
 * Story: "Deep beneath the aurora, where light bends and reality shimmers,
 * the Shadow Phoenix guards the Aurora Reactor. This mystical being was
 * once a creature of pure light, now corrupted by the encroaching void.
 * Defeat it to claim the reactor and restore balance."
 *
 * Features:
 * - Aurora light effects and color-shifting atmosphere
 * - Floating crystal platforms
 * - Shadow Phoenix boss with fire/shadow attacks
 * - Aurora Reactor ship part reward
 */
class AuroraDepthsLevel extends PlatformerLevelScene {
    constructor() {
        super({
            key: 'AuroraDepthsLevel',
            levelId: 'aurora_depths_1',
            biomeId: 'aurora_depths',
            levelWidth: 5000,
            levelHeight: 800
        });

        // Physics tuned for aurora platforming
        this.playerSpeed = 200;
        this.jumpVelocity = -450;
        this.playerAcceleration = 0.20;
        this.playerDeceleration = 0.70;
        this.coyoteTime = 150;
        this.jumpBufferTime = 150;

        // Level-specific state
        this.starFragmentsCollected = 0;
        this.totalStarFragments = 5;
        this.bossDefeated = false;
        this.auroraReactorFound = false;
        this.bossFightActive = false;

        // Boss state
        this.boss = null;
        this.bossHealth = 0;
        this.bossMaxHealth = 12;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        // Aurora effects
        this.auroraLights = [];
        this.colorShiftTime = 0;
    }

    init(data) {
        super.init(data);

        this.testMode = data?.testMode || false;

        this.starFragmentsCollected = 0;
        this.bossDefeated = false;
        this.auroraReactorFound = false;
        this.bossFightActive = false;

        this.boss = null;
        this.bossHealth = 0;
        this.bossPhase = 1;
        this.bossAttackTimer = null;
        this.bossHealthBar = null;
        this.bossNameText = null;

        this.auroraLights = [];
        this.colorShiftTime = 0;

        console.log('[AuroraDepthsLevel] Level state reset');
    }

    create() {
        super.create();

        if (window.AchievementSystem?.recordEvent) {
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
        console.log('[AuroraDepthsLevel] TEST MODE - Spawning boss immediately');
        this.createAuroraBackground();
        this.createTestArenaPlatform();

        if (this.player) {
            this.player.setPosition(200, this.levelHeight - 200);
        }

        this.time.delayedCall(500, () => {
            this.spawnShadowPhoenix();
        });
    }

    createTestArenaPlatform() {
        const groundY = this.levelHeight - 100;

        const ground = this.add.graphics();
        ground.fillStyle(0x1A3A4A, 1);
        ground.fillRect(0, groundY, this.levelWidth, 100);

        // Aurora crystal texture
        ground.fillStyle(0x00E676, 0.3);
        for (let x = 0; x < this.levelWidth; x += 30) {
            const crystalHeight = 10 + Math.random() * 15;
            ground.fillTriangle(x, groundY, x + 15, groundY - crystalHeight, x + 30, groundY);
        }

        if (!this.platforms) {
            this.platforms = this.physics.add.staticGroup();
        }

        const platformZone = this.add.zone(this.levelWidth / 2, groundY + 50, this.levelWidth, 100);
        this.physics.add.existing(platformZone, true);
        this.platforms.add(platformZone);
    }

    showLevelEntry() {
        const { width, height } = this.cameras.main;

        this.physics.pause();

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        const panelWidth = 450;
        const panelHeight = 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0A1A2A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x00E676, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        const title = this.add.text(width / 2, panelY + 50, 'AURORA DEPTHS', {
            fontSize: '36px',
            color: '#00E676',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, panelY + 90, '"Where light bends and shadows dance"', {
            fontSize: '16px',
            color: '#7FFFD4',
            fontStyle: 'italic'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const divider = this.add.graphics();
        divider.lineStyle(2, 0x00E676, 0.5);
        divider.lineBetween(panelX + 40, panelY + 120, panelX + panelWidth - 40, panelY + 120);
        divider.setScrollFactor(0);
        divider.setDepth(3002);

        this.add.text(width / 2, panelY + 145, 'OBJECTIVE', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        this.add.text(width / 2, panelY + 175, 'Claim the Aurora Reactor', {
            fontSize: '20px',
            color: '#7FFFD4',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const secondaryY = panelY + 220;
        this.add.text(panelX + 60, secondaryY, '[ ] Collect Star Fragments (0/5)', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        this.add.text(panelX + 60, secondaryY + 30, '[ ] Defeat the Shadow Phoenix', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setScrollFactor(0).setDepth(3002);

        const enterBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ DESCEND INTO THE AURORA ]', {
            fontSize: '20px',
            color: '#00E676',
            backgroundColor: '#0A1A2A',
            padding: { x: 25, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002).setInteractive({ cursor: 'pointer' });

        enterBtn.on('pointerover', () => enterBtn.setColor('#7FFFD4'));
        enterBtn.on('pointerout', () => enterBtn.setColor('#00E676'));
        enterBtn.on('pointerdown', () => {
            this.tweens.add({
                targets: [overlay, panel, title, enterBtn],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    panel.destroy();
                    this.physics.resume();
                    this.startLevel();
                }
            });
        });
    }

    startLevel() {
        console.log('[AuroraDepthsLevel] Starting level');
        this.createAuroraBackground();
        this.createLevelContent();
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

    createLevelContent() {
        this.createBossArena();
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

        const triggerZone = this.add.zone(arenaX + arenaWidth / 2, groundY - 50, 100, 100);
        this.physics.add.existing(triggerZone, true);

        if (this.player) {
            this.physics.add.overlap(this.player, triggerZone, () => {
                if (!this.bossFightActive && !this.bossDefeated) {
                    triggerZone.destroy();
                    this.startBossFight();
                }
            });
        }
    }

    startBossFight() {
        console.log('[AuroraDepthsLevel] Starting Shadow Phoenix boss fight!');
        this.bossFightActive = true;

        this.physics.pause();
        this.cameras.main.flash(500, 0, 230, 118);

        const { width, height } = this.cameras.main;
        const warningText = this.add.text(width / 2, height / 2, '⚠ FROM ASHES, IT RISES ⚠', {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.cameras.main.shake(1500, 0.015);

        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        this.tweens.add({
            targets: warningText,
            alpha: 0,
            duration: 1500,
            onComplete: () => warningText.destroy()
        });

        this.time.delayedCall(1500, () => {
            this.spawnShadowPhoenix();
            this.physics.resume();
        });
    }

    /**
     * Create Shadow Phoenix placeholder texture
     * PLACEHOLDER - Replace with custom artwork later
     */
    createShadowPhoenixTexture() {
        const textureKey = 'shadowPhoenix';
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

        const textureKey = this.createShadowPhoenixTexture();

        const { width, height } = this.cameras.main;
        const spawnX = this.testMode ? width / 2 + 200 : 4400;
        const spawnY = this.levelHeight - 250;

        this.boss = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.boss.setCollideWorldBounds(true);
        this.boss.setBounce(0);
        this.boss.setDepth(880);
        this.boss.body.setSize(90, 80);
        this.boss.body.setOffset(30, 35);
        this.boss.setScale(1.3);
        this.boss.body.setAllowGravity(false); // Phoenix floats

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
        this.boss.setScale(0.5);

        this.tweens.add({
            targets: this.boss,
            alpha: 1,
            scale: 1.3,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.startBossAI();
                this.cameras.main.shake(300, 0.01);

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
        const screenWidth = this.cameras.main.width;
        const barWidth = Math.min(350, screenWidth - 60);
        const barHeight = 28;
        const barX = (screenWidth - barWidth) / 2;
        const barY = 55;

        this.bossUI = this.add.container(0, 0);
        this.bossUI.setScrollFactor(0);
        this.bossUI.setDepth(1500);

        this.bossNameText = this.add.text(screenWidth / 2, barY - 28, '🔥 SHADOW PHOENIX 🔥', {
            fontSize: '22px',
            color: '#FF6B4A',
            fontStyle: 'bold',
            stroke: '#2D1B4E',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.bossUI.add(this.bossNameText);

        const subtitle = this.add.text(screenWidth / 2, barY - 8, 'Guardian of the Aurora Reactor', {
            fontSize: '11px',
            color: '#7FFFD4'
        }).setOrigin(0.5);
        this.bossUI.add(subtitle);

        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x1A1A3E, 0.9);
        bgBar.fillRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        bgBar.lineStyle(2, 0xFF4500, 1);
        bgBar.strokeRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
        this.bossUI.add(bgBar);

        this.bossHealthBar = this.add.graphics();
        this.bossUI.add(this.bossHealthBar);

        this.updateBossHealthBar(barX, barY, barWidth, barHeight);
    }

    updateBossHealthBar(barX, barY, barWidth, barHeight) {
        if (!this.bossHealthBar) return;

        barX = barX || (this.cameras.main.width - 350) / 2;
        barY = barY || 55;
        barWidth = barWidth || 350;
        barHeight = barHeight || 28;

        this.bossHealthBar.clear();

        const healthPercent = this.bossHealth / this.bossMaxHealth;
        const currentWidth = barWidth * healthPercent;

        const r = Math.floor(255 * (1 - healthPercent * 0.5));
        const g = Math.floor(100 * healthPercent);
        const b = 0;
        const healthColor = Phaser.Display.Color.GetColor(r, g, b);

        this.bossHealthBar.fillStyle(healthColor, 1);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight, 6);

        this.bossHealthBar.fillStyle(0xFFFFFF, 0.2);
        this.bossHealthBar.fillRoundedRect(barX, barY, currentWidth, barHeight / 2, { tl: 6, tr: 6, bl: 0, br: 0 });
    }

    startBossAI() {
        console.log('[AuroraDepthsLevel] Starting Shadow Phoenix AI');

        this.bossAITimer = this.time.addEvent({
            delay: 2200,
            callback: () => this.bossAITick(),
            loop: true
        });

        // Phoenix hovers up and down
        this.tweens.add({
            targets: this.boss,
            y: this.boss.y - 30,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
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
        if (!this.boss || this.boss.isAttacking) return;

        this.boss.isAttacking = true;

        switch (attackType) {
            case 'flame_dive':
                this.bossFlameDive();
                break;
            case 'shadow_feathers':
                this.bossShadowFeathers();
                break;
            case 'fire_trail':
                this.bossFireTrail();
                break;
            case 'rebirth_nova':
                this.bossRebirthNova();
                break;
            case 'shadow_clones':
                this.bossShadowClones();
                break;
        }

        this.time.delayedCall(1500, () => {
            if (this.boss) {
                this.boss.isAttacking = false;
            }
        });
    }

    bossFlameDive() {
        if (!this.boss || !this.player) return;

        const targetX = this.player.x;
        const targetY = this.player.y;

        // Telegraph
        const telegraph = this.add.graphics();
        telegraph.lineStyle(3, 0xFF4500, 0.5);
        telegraph.lineBetween(this.boss.x, this.boss.y, targetX, targetY);
        telegraph.setDepth(100);

        this.time.delayedCall(500, () => {
            telegraph.destroy();

            const startX = this.boss.x;
            const startY = this.boss.y;

            this.tweens.add({
                targets: this.boss,
                x: targetX,
                y: targetY,
                duration: 300,
                onComplete: () => {
                    // Damage check
                    if (this.player && Math.abs(this.player.x - this.boss.x) < 50 && Math.abs(this.player.y - this.boss.y) < 50) {
                        this.handlePlayerDamage(1);
                    }

                    // Return to hover position
                    this.tweens.add({
                        targets: this.boss,
                        y: this.levelHeight - 250,
                        duration: 500
                    });
                }
            });
        });
    }

    bossShadowFeathers() {
        if (!this.boss || !this.player) return;

        const count = this.bossPhase >= 2 ? 7 : 5;
        const angleSpread = Math.PI * 0.6;
        const baseAngle = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);

        for (let i = 0; i < count; i++) {
            const angle = baseAngle - angleSpread / 2 + (angleSpread / (count - 1)) * i;

            const feather = this.add.graphics();
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
                    if (this.player && Math.abs(this.player.x - feather.x) < 20 && Math.abs(this.player.y - feather.y) < 20) {
                        this.handlePlayerDamage(1);
                        feather.destroy();
                    }
                },
                onComplete: () => feather.destroy()
            });
        }
    }

    bossFireTrail() {
        if (!this.boss) return;

        const direction = this.boss.facingRight ? 1 : -1;

        for (let i = 0; i < 5; i++) {
            this.time.delayedCall(i * 150, () => {
                const flame = this.add.graphics();
                flame.fillStyle(0xFF4500, 0.8);
                flame.fillCircle(0, 0, 25);
                flame.fillStyle(0xFFD700, 0.5);
                flame.fillCircle(0, 0, 15);
                flame.setPosition(this.boss.x + direction * i * 60, this.levelHeight - 130);
                flame.setDepth(100);

                // Damage zone
                this.time.addEvent({
                    delay: 100,
                    repeat: 10,
                    callback: () => {
                        if (this.player && Math.abs(this.player.x - flame.x) < 30 && this.player.y > this.levelHeight - 180) {
                            this.handlePlayerDamage(1);
                        }
                    }
                });

                this.tweens.add({
                    targets: flame,
                    alpha: 0,
                    scale: 0.5,
                    duration: 1500,
                    onComplete: () => flame.destroy()
                });
            });
        }
    }

    bossRebirthNova() {
        if (!this.boss) return;

        this.cameras.main.flash(500, 255, 69, 0);

        const { width, height } = this.cameras.main;
        const warning = this.add.text(width / 2, height / 3, '🔥 REBIRTH NOVA! 🔥', {
            fontSize: '28px',
            color: '#FF4500',
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

        // Expanding fire ring
        const ring = this.add.graphics();
        ring.setPosition(this.boss.x, this.boss.y);
        ring.setDepth(850);

        let radius = 0;
        this.time.addEvent({
            delay: 30,
            repeat: 30,
            callback: () => {
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
            onComplete: () => ring.destroy()
        });
    }

    bossShadowClones() {
        if (!this.boss) return;

        // Create 2 shadow clones
        for (let i = 0; i < 2; i++) {
            const clone = this.add.sprite(this.boss.x + (i === 0 ? -100 : 100), this.boss.y, 'shadowPhoenix');
            clone.setAlpha(0.5);
            clone.setTint(0x4B0082);
            clone.setScale(0.8);
            clone.setDepth(870);

            // Clones dive at player
            this.time.delayedCall(500 + i * 300, () => {
                if (this.player) {
                    this.tweens.add({
                        targets: clone,
                        x: this.player.x,
                        y: this.player.y,
                        duration: 400,
                        onComplete: () => {
                            if (this.player && Math.abs(this.player.x - clone.x) < 40 && Math.abs(this.player.y - clone.y) < 40) {
                                this.handlePlayerDamage(1);
                            }
                            clone.destroy();
                        }
                    });
                }
            });
        }
    }

    handleBossCollision(player, boss) {
        if (this.isInvincible || this.isPlayerDead) return;
        this.handlePlayerDamage(1);
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
        console.log('[AuroraDepthsLevel] Player died!');
    }

    damageBoss(amount = 1) {
        if (!this.boss || this.bossDefeated) return;

        this.bossHealth -= amount;
        this.updateBossHealthBar();

        this.boss.setTint(0xFF0000);
        this.time.delayedCall(100, () => {
            if (this.boss) this.boss.clearTint();
        });

        // Phase transitions
        if (this.bossHealth <= this.bossMaxHealth * 0.6 && this.bossPhase === 1) {
            this.triggerPhase2();
        } else if (this.bossHealth <= this.bossMaxHealth * 0.3 && this.bossPhase === 2) {
            this.triggerPhase3();
        }

        if (this.bossHealth <= 0) {
            this.onBossDefeated();
        }

        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }
    }

    triggerPhase2() {
        this.bossPhase = 2;
        this.cameras.main.shake(500, 0.02);
        this.boss.setTint(0x4169E1);

        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, '🔥 PHOENIX IGNITES! 🔥', {
            fontSize: '28px',
            color: '#4169E1',
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

        if (this.bossAITimer) {
            this.bossAITimer.delay = 1800;
        }
    }

    triggerPhase3() {
        this.bossPhase = 3;
        this.cameras.main.shake(500, 0.03);
        this.boss.setTint(0x00BFFF);

        const { width, height } = this.cameras.main;
        const phaseText = this.add.text(width / 2, height / 2, '⚡ COSMIC FURY! ⚡', {
            fontSize: '28px',
            color: '#00BFFF',
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

        if (this.bossAITimer) {
            this.bossAITimer.delay = 1400;
        }
    }

    onBossDefeated() {
        console.log('[AuroraDepthsLevel] Shadow Phoenix defeated!');
        this.bossDefeated = true;
        this.bossFightActive = false;

        if (this.bossAITimer) {
            this.bossAITimer.remove();
        }

        this.boss.setVelocity(0, 0);
        this.tweens.killTweensOf(this.boss);

        this.cameras.main.shake(800, 0.03);

        // Dramatic death - phoenix dissolves into flames
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 50, () => {
                const flame = this.add.graphics();
                flame.fillStyle(Math.random() > 0.5 ? 0xFF4500 : 0xFFD700, 1);
                flame.fillCircle(0, 0, 10 + Math.random() * 15);
                flame.setPosition(
                    this.boss.x + (Math.random() - 0.5) * 100,
                    this.boss.y + (Math.random() - 0.5) * 80
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
            alpha: 0,
            scale: 0.3,
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

        if (this.bossUI) {
            this.tweens.add({
                targets: this.bossUI,
                alpha: 0,
                duration: 500
            });
        }
    }

    showBossVictory() {
        const { width, height } = this.cameras.main;

        // Award ship part
        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        if (!shipParts.includes('aurora_reactor')) {
            shipParts.push('aurora_reactor');
            window.GameState?.set('hubWorld.shipParts.collected', shipParts);
            console.log('[AuroraDepthsLevel] Ship part acquired: Aurora Reactor. Total parts:', shipParts.length);
        }

        const victoryText = this.add.text(width / 2, height / 2, '🔥 SHADOW PHOENIX EXTINGUISHED 🔥', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
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
                this.showLevelComplete();
            }
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        if (window.AchievementSystem?.recordEvent) {
            window.AchievementSystem.recordEvent('boss_defeated', { bossId: 'shadow_phoenix' });
        }
    }

    showLevelComplete() {
        const { width, height } = this.cameras.main;

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2500);

        const panelWidth = 400;
        const panelHeight = 300;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x0A1A2A, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x00E676, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(2501);

        this.add.text(width / 2, panelY + 40, 'LEVEL COMPLETE!', {
            fontSize: '28px',
            color: '#00E676',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        this.add.text(width / 2, panelY + 90, '🔧 Aurora Reactor Acquired! 🔧', {
            fontSize: '18px',
            color: '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const shipParts = window.GameState?.get('hubWorld.shipParts.collected') || [];
        this.add.text(width / 2, panelY + 130, `Ship Parts: ${shipParts.length}/4`, {
            fontSize: '16px',
            color: '#7FFFD4'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

        const returnBtn = this.add.text(width / 2, panelY + panelHeight - 50, '[ RETURN TO HUB ]', {
            fontSize: '20px',
            color: '#00E676',
            backgroundColor: '#1A3A4A',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ cursor: 'pointer' });

        returnBtn.on('pointerover', () => returnBtn.setColor('#7FFFD4'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#00E676'));
        returnBtn.on('pointerdown', () => {
            this.scene.start('HubWorldScene');
        });
    }

    shutdown() {
        console.log('[AuroraDepthsLevel] Shutting down');

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

        this.auroraLights.forEach(aurora => aurora.graphics.destroy());
        this.auroraLights = [];

        super.shutdown();
    }
}

export default AuroraDepthsLevel;

if (typeof window !== 'undefined') {
    window.AuroraDepthsLevel = AuroraDepthsLevel;
}
