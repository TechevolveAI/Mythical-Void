/**
 * VoidMiniGameScene - Anti-gravity coin collection mini-game
 *
 * Player enters the void portal and bounces around in zero-gravity
 * collecting coins for 60 seconds. Score is added to player's coins.
 *
 * Features:
 * - Anti-gravity physics with bouncing off walls
 * - Coin spawning and collection
 * - 60-second timer
 * - Cosmic void visual effects
 * - Score multipliers for combo collection
 */

import Phaser from 'phaser';

class VoidMiniGameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VoidMiniGameScene' });

        // Game state
        this.timeRemaining = 60;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = null;
        this.coins = [];
        this.player = null;
        this.playerVelocity = { x: 0, y: 0 };
        this.isGameActive = false;

        // Ad overlay state
        this.adTimeRemaining = 60;
        this.adOverlayElements = [];
        this.adTimer = null;

        // Visual elements
        this.background = null;
        this.timerText = null;
        this.scoreText = null;
        this.comboText = null;
        this.particles = [];
        this.voidEffects = [];
    }

    init(data) {
        // Get creature texture from GameScene
        this.creatureTexture = data?.creatureTexture || null;
        this.returnPosition = data?.returnPosition || { x: 400, y: 300 };

        // Reset game state
        this.timeRemaining = 60;
        this.score = 0;
        this.combo = 0;
        this.coins = [];
        this.isGameActive = false;

        // Reset ad state
        this.adTimeRemaining = 60;
        this.adOverlayElements = [];
    }

    create() {
        const { width, height } = this.scale;

        console.log('[VoidMiniGameScene] Creating void mini-game scene...');

        // Hide loading screen from GameScene transition
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        // Ensure camera is visible (fade in from black)
        this.cameras.main.fadeIn(500, 0, 0, 0);

        // Stop other scenes (GameScene already stopped by scene.start)
        try {
            this.scene.stop('GameScene');
        } catch (e) {
            // Scene might already be stopped - that's fine
        }
        this.scene.bringToTop();

        // Create void background
        this.createVoidBackground(width, height);

        // Create boundary walls (invisible physics bodies)
        this.createBoundaries(width, height);

        // Create player (the creature)
        this.createPlayer(width, height);

        // Create initial coins
        this.spawnInitialCoins(width, height);

        // Create UI
        this.createUI(width, height);

        // Create particle effects
        this.createVoidParticles(width, height);

        // Start game IMMEDIATELY - gameplay runs in background
        this.startGame();

        // Show ad overlay ON TOP (semi-transparent so player can see gameplay)
        // When ad completes, it just closes - game is already running
        this.showAdOverlay(() => {
            // Ad complete - award bonus for watching
            this.awardAdCompletionBonus();
        });

        // Add resize handler
        this.scale.on('resize', this.handleResize, this);

        console.log('[VoidMiniGameScene] Created void mini-game');
    }

    createVoidBackground(width, height) {
        // Deep space black background
        this.background = this.add.graphics();
        this.background.fillStyle(0x050510, 1);
        this.background.fillRect(0, 0, width, height);

        // Add swirling void effects
        const voidCenter = { x: width / 2, y: height / 2 };

        // Outer glow rings
        for (let i = 5; i >= 1; i--) {
            const ring = this.add.graphics();
            const radius = 100 + (i * 60);
            ring.lineStyle(3, 0x1A0033, 0.2 - (i * 0.03));
            ring.strokeCircle(voidCenter.x, voidCenter.y, radius);
            this.voidEffects.push(ring);

            // Animate the rings
            this.tweens.add({
                targets: ring,
                scaleX: { from: 1, to: 1.1 },
                scaleY: { from: 1, to: 1.1 },
                alpha: { from: 0.2 - (i * 0.03), to: 0.05 },
                duration: 3000 + (i * 500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Add distant stars
        for (let i = 0; i < 100; i++) {
            const star = this.add.graphics();
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(0.5, 2);
            const brightness = Phaser.Math.FloatBetween(0.3, 0.8);

            star.fillStyle(0xFFFFFF, brightness);
            star.fillCircle(x, y, size);
            this.voidEffects.push(star);

            // Twinkle effect
            this.tweens.add({
                targets: star,
                alpha: { from: brightness, to: brightness * 0.3 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 2000)
            });
        }

        // Nebula-like color patches
        const nebulaColors = [0x6600FF, 0xFF00FF, 0x00FFFF, 0xFF6600];
        for (let i = 0; i < 6; i++) {
            const nebula = this.add.graphics();
            const x = Phaser.Math.Between(100, width - 100);
            const y = Phaser.Math.Between(100, height - 100);
            const color = Phaser.Math.RND.pick(nebulaColors);

            nebula.fillStyle(color, 0.05);
            nebula.fillCircle(x, y, Phaser.Math.Between(80, 150));
            nebula.setBlendMode(Phaser.BlendModes.ADD);
            this.voidEffects.push(nebula);
        }
    }

    createBoundaries(width, height) {
        // Create invisible boundary walls for bouncing
        const wallThickness = 20;

        // Top wall
        this.topWall = this.add.rectangle(width / 2, -wallThickness / 2, width, wallThickness, 0x000000, 0);
        this.physics.add.existing(this.topWall, true);

        // Bottom wall
        this.bottomWall = this.add.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, 0x000000, 0);
        this.physics.add.existing(this.bottomWall, true);

        // Left wall
        this.leftWall = this.add.rectangle(-wallThickness / 2, height / 2, wallThickness, height, 0x000000, 0);
        this.physics.add.existing(this.leftWall, true);

        // Right wall
        this.rightWall = this.add.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, 0x000000, 0);
        this.physics.add.existing(this.rightWall, true);

        // Create boundary group
        this.boundaries = this.physics.add.staticGroup();
        this.boundaries.add(this.topWall);
        this.boundaries.add(this.bottomWall);
        this.boundaries.add(this.leftWall);
        this.boundaries.add(this.rightWall);
    }

    createPlayer(width, height) {
        // Create player sprite (creature or fallback circle)
        const startX = width / 2;
        const startY = height / 2;

        if (this.creatureTexture && this.textures.exists(this.creatureTexture)) {
            this.player = this.physics.add.sprite(startX, startY, this.creatureTexture);
            this.player.setScale(0.8);
        } else {
            // Fallback: create a glowing orb
            const graphics = this.add.graphics();
            graphics.fillStyle(0x00FFFF, 1);
            graphics.fillCircle(30, 30, 25);
            graphics.fillStyle(0xFFFFFF, 0.7);
            graphics.fillCircle(30, 30, 15);
            graphics.generateTexture('voidPlayer', 60, 60);
            graphics.destroy();

            this.player = this.physics.add.sprite(startX, startY, 'voidPlayer');
        }

        // Configure physics
        this.player.setBounce(1, 1);
        this.player.setCollideWorldBounds(false);
        this.player.setDrag(0); // No air resistance in void
        this.player.body.setMaxVelocity(400, 400);

        // Add glow effect around player
        this.playerGlow = this.add.graphics();
        this.playerGlow.fillStyle(0x00FFFF, 0.3);
        this.playerGlow.fillCircle(0, 0, 45);
        this.playerGlow.setBlendMode(Phaser.BlendModes.ADD);

        // Set initial random velocity
        this.player.setVelocity(
            Phaser.Math.Between(-200, 200),
            Phaser.Math.Between(-200, 200)
        );

        // Collide with boundaries
        this.physics.add.collider(this.player, this.boundaries, this.onWallBounce, null, this);

        // Add trail effect
        this.playerTrail = [];
    }

    spawnInitialCoins(width, height) {
        // Spawn 10 coins initially
        for (let i = 0; i < 10; i++) {
            this.spawnCoin(width, height);
        }
    }

    spawnCoin(width, height, specificPos = null) {
        const padding = 50;
        let x, y;

        if (specificPos) {
            x = specificPos.x;
            y = specificPos.y;
        } else {
            x = Phaser.Math.Between(padding, width - padding);
            y = Phaser.Math.Between(padding, height - padding);
        }

        // Create coin graphics
        const coinSize = 24;
        const coin = this.add.container(x, y);

        // Coin glow
        const glow = this.add.graphics();
        glow.fillStyle(0xFFD700, 0.3);
        glow.fillCircle(0, 0, coinSize + 5);
        coin.add(glow);

        // Coin body
        const body = this.add.graphics();
        body.fillStyle(0xFFD700, 1);
        body.fillCircle(0, 0, coinSize / 2);
        body.fillStyle(0xFFFFAA, 0.6);
        body.fillCircle(-2, -2, coinSize / 4);
        coin.add(body);

        // Add physics
        this.physics.add.existing(coin);
        coin.body.setCircle(coinSize / 2);
        coin.body.setOffset(-coinSize / 2, -coinSize / 2);
        coin.body.setImmovable(true);

        // Add floating animation
        this.tweens.add({
            targets: coin,
            y: y - 5,
            duration: 1000 + Phaser.Math.Between(-200, 200),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add sparkle animation to glow
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.3, to: 0.6 },
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // Store coin value (base = 1, but combos increase it)
        coin.value = 1;

        this.coins.push(coin);

        // Add collision with player
        this.physics.add.overlap(this.player, coin, () => this.collectCoin(coin), null, this);
    }

    collectCoin(coin) {
        if (!this.isGameActive || !coin.active) return;

        coin.active = false;

        // Calculate score with combo
        this.combo++;
        const comboMultiplier = Math.min(1 + (this.combo * 0.1), 3); // Max 3x multiplier
        const coinValue = Math.round(coin.value * comboMultiplier);
        this.score += coinValue;

        // Show floating score
        this.showFloatingScore(coin.x, coin.y, coinValue, this.combo);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playCoinCollect();
        }

        // Update UI
        this.updateScoreUI();

        // Reset combo timer
        if (this.comboTimer) {
            this.comboTimer.remove();
        }
        this.comboTimer = this.time.delayedCall(1500, () => {
            this.combo = 0;
            this.updateComboUI();
        });

        this.updateComboUI();

        // Coin collection effect
        this.tweens.add({
            targets: coin,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                // Remove from array
                const index = this.coins.indexOf(coin);
                if (index > -1) {
                    this.coins.splice(index, 1);
                }
                coin.destroy();

                // Spawn a new coin
                if (this.isGameActive) {
                    this.time.delayedCall(500, () => {
                        this.spawnCoin(this.scale.width, this.scale.height);
                    });
                }
            }
        });

        // Particle burst
        this.createCoinBurst(coin.x, coin.y);
    }

    createCoinBurst(x, y) {
        const particles = [];
        for (let i = 0; i < 8; i++) {
            const particle = this.add.graphics();
            particle.fillStyle(0xFFD700, 1);
            particle.fillCircle(0, 0, 3);
            particle.x = x;
            particle.y = y;
            particles.push(particle);

            const angle = (i / 8) * Math.PI * 2;
            const distance = 40;

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                duration: 400,
                ease: 'Quad.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    showFloatingScore(x, y, value, combo) {
        let text = `+${value}`;
        let color = '#FFD700';
        let fontSize = '20px';

        if (combo >= 5) {
            text = `+${value} 🔥x${combo}`;
            color = '#FF4444';
            fontSize = '26px';
        } else if (combo >= 3) {
            text = `+${value} x${combo}`;
            color = '#FFAA00';
            fontSize = '24px';
        } else if (combo >= 2) {
            text = `+${value} x${combo}`;
            fontSize = '22px';
        }

        const floatingText = this.add.text(x, y, text, {
            fontSize: fontSize,
            fontFamily: 'Arial, sans-serif',
            color: color,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: floatingText,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => floatingText.destroy()
        });
    }

    createUI(width, height) {
        const padding = 20;

        // Timer display (top center)
        this.timerBg = this.add.graphics();
        this.timerBg.fillStyle(0x000000, 0.7);
        this.timerBg.fillRoundedRect(width / 2 - 60, padding, 120, 50, 10);
        this.timerBg.setScrollFactor(0);

        this.timerText = this.add.text(width / 2, padding + 25, '60', {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        // Score display (top right)
        this.scoreBg = this.add.graphics();
        this.scoreBg.fillStyle(0x000000, 0.7);
        this.scoreBg.fillRoundedRect(width - 150 - padding, padding, 150, 50, 10);
        this.scoreBg.setScrollFactor(0);

        this.coinIcon = this.add.text(width - 135, padding + 25, '🪙', {
            fontSize: '24px'
        }).setOrigin(0.5).setScrollFactor(0);

        this.scoreText = this.add.text(width - 70, padding + 25, '0', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        // Combo display (top left)
        this.comboBg = this.add.graphics();
        this.comboBg.fillStyle(0x000000, 0.7);
        this.comboBg.fillRoundedRect(padding, padding, 120, 50, 10);
        this.comboBg.setScrollFactor(0);
        this.comboBg.setAlpha(0);

        this.comboText = this.add.text(padding + 60, padding + 25, 'x1', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FF6600',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.comboText.setAlpha(0);

        // Instructions (bottom center)
        this.instructions = this.add.text(width / 2, height - 30, 'Bounce around and collect coins!', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5).setScrollFactor(0);
    }

    updateScoreUI() {
        this.scoreText.setText(this.score.toString());

        // Pop animation on score change
        this.tweens.add({
            targets: this.scoreText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 100,
            yoyo: true
        });
    }

    updateComboUI() {
        if (this.combo >= 2) {
            this.comboBg.setAlpha(1);
            this.comboText.setAlpha(1);
            this.comboText.setText(`x${this.combo}`);

            // Color based on combo level
            if (this.combo >= 5) {
                this.comboText.setColor('#FF4444');
            } else if (this.combo >= 3) {
                this.comboText.setColor('#FFAA00');
            } else {
                this.comboText.setColor('#FF6600');
            }

            // Pulse animation
            this.tweens.add({
                targets: this.comboText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
        } else {
            this.comboBg.setAlpha(0);
            this.comboText.setAlpha(0);
        }
    }

    createVoidParticles(width, height) {
        // Create floating void particles
        for (let i = 0; i < 20; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.Between(2, 6);
            const color = Phaser.Math.RND.pick([0x6600FF, 0xFF00FF, 0x00FFFF]);

            particle.fillStyle(color, 0.5);
            particle.fillCircle(0, 0, size);

            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            particle.x = x;
            particle.y = y;
            particle.setBlendMode(Phaser.BlendModes.ADD);

            this.particles.push(particle);

            // Drift animation
            this.tweens.add({
                targets: particle,
                x: x + Phaser.Math.Between(-100, 100),
                y: y + Phaser.Math.Between(-100, 100),
                alpha: { from: 0.5, to: 0.1 },
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    showAdOverlay(callback) {
        const { width, height } = this.scale;

        console.log('[VoidMiniGameScene] Showing ad overlay (gameplay continues underneath)...');

        // Semi-transparent overlay - reduced opacity so gameplay visible underneath
        // NO setInteractive on overlay - allow click-through to gameplay
        const adOverlay = this.add.graphics();
        adOverlay.fillStyle(0x000000, 0.5);  // Reduced from 0.85 to 0.5 for visibility
        adOverlay.fillRect(0, 0, width, height);
        adOverlay.setDepth(1000);
        this.adOverlayElements.push(adOverlay);

        // Ad panel background
        const panelWidth = Math.min(400, width - 40);
        const panelHeight = 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const adPanel = this.add.graphics();
        adPanel.fillStyle(0x1A1A3E, 1);
        adPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        adPanel.lineStyle(3, 0xFFD700, 1);
        adPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        adPanel.setDepth(1001);
        this.adOverlayElements.push(adPanel);

        // Ad label at top
        const adLabel = this.add.text(width / 2, panelY + 25, '📢 ADVERTISEMENT', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1002);
        this.adOverlayElements.push(adLabel);

        // Main ad text
        const adText = this.add.text(width / 2, panelY + panelHeight / 2 - 20,
            'Advertisement for Sale.\n\nContact Tech Evolve AI\nat Gmail.com\nfor more info.', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5).setDepth(1002);
        this.adOverlayElements.push(adText);

        // Timer display at bottom of panel
        const timerY = panelY + panelHeight - 45;
        this.adTimerText = this.add.text(width / 2, timerY, `Continue in ${this.adTimeRemaining}s`, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(1002);
        this.adOverlayElements.push(this.adTimerText);

        // Progress bar background
        const barWidth = panelWidth - 40;
        const barHeight = 8;
        const barX = panelX + 20;
        const barY = timerY + 20;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x333333, 1);
        barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
        barBg.setDepth(1002);
        this.adOverlayElements.push(barBg);

        // Progress bar fill
        this.adProgressBar = this.add.graphics();
        this.adProgressBar.setDepth(1003);
        this.adOverlayElements.push(this.adProgressBar);

        // Store bar dimensions for updates
        this.adBarInfo = { x: barX, y: barY, width: barWidth, height: barHeight };

        // Initial progress bar update
        this.updateAdProgressBar();

        // Dev-only skip button
        if (import.meta.env.DEV) {
            const skipBtnY = panelY - 40;
            const skipBtn = this.add.graphics();
            skipBtn.fillStyle(0xFF4444, 1);
            skipBtn.fillRoundedRect(width / 2 - 60, skipBtnY, 120, 30, 5);
            skipBtn.setDepth(1002);
            this.adOverlayElements.push(skipBtn);

            const skipText = this.add.text(width / 2, skipBtnY + 15, '⏭ Skip (DEV)', {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(1003);
            this.adOverlayElements.push(skipText);

            const skipZone = this.add.zone(width / 2, skipBtnY + 15, 120, 30)
                .setInteractive()
                .setDepth(1004);
            this.adOverlayElements.push(skipZone);

            skipZone.on('pointerover', () => {
                skipBtn.clear();
                skipBtn.fillStyle(0xFF6666, 1);
                skipBtn.fillRoundedRect(width / 2 - 60, skipBtnY, 120, 30, 5);
            });
            skipZone.on('pointerout', () => {
                skipBtn.clear();
                skipBtn.fillStyle(0xFF4444, 1);
                skipBtn.fillRoundedRect(width / 2 - 60, skipBtnY, 120, 30, 5);
            });
            skipZone.on('pointerdown', () => {
                console.log('[VoidMiniGameScene] Ad skipped (DEV mode)');
                this.closeAdOverlay();
                callback();
            });
        }

        // Start the 60-second countdown
        this.adTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.adTimeRemaining--;
                this.adTimerText.setText(`Continue in ${this.adTimeRemaining}s`);
                this.updateAdProgressBar();

                if (this.adTimeRemaining <= 10) {
                    this.adTimerText.setColor('#FFD700');
                }

                if (this.adTimeRemaining <= 0) {
                    console.log('[VoidMiniGameScene] Ad complete, proceeding to game');
                    this.closeAdOverlay();
                    callback();
                }
            },
            loop: true
        });
    }

    updateAdProgressBar() {
        if (!this.adProgressBar || !this.adBarInfo) return;

        const progress = 1 - (this.adTimeRemaining / 60);
        const fillWidth = this.adBarInfo.width * progress;

        this.adProgressBar.clear();
        this.adProgressBar.fillStyle(0x00FF00, 1);
        this.adProgressBar.fillRoundedRect(
            this.adBarInfo.x,
            this.adBarInfo.y,
            fillWidth,
            this.adBarInfo.height,
            4
        );
    }

    closeAdOverlay() {
        // Stop the ad timer
        if (this.adTimer) {
            this.adTimer.remove();
            this.adTimer = null;
        }

        // Fade out and destroy all ad elements
        this.tweens.add({
            targets: this.adOverlayElements,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.adOverlayElements.forEach(el => {
                    if (el && el.destroy) {
                        el.destroy();
                    }
                });
                this.adOverlayElements = [];
            }
        });
    }

    awardAdCompletionBonus() {
        // Award bonus coins for watching the full ad
        const bonusCoins = 10;
        this.score += bonusCoins;
        this.scoreText?.setText(this.score.toString());

        // Show floating bonus text
        const { width, height } = this.scale;
        const bonusText = this.add.text(width / 2, height / 2 - 50, `+${bonusCoins} Ad Bonus!`, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#00FF00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: bonusText,
            y: bonusText.y - 80,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            onComplete: () => bonusText.destroy()
        });

        // Play reward sound
        if (window.AudioManager) {
            window.AudioManager.playCoinCollect?.();
        }

        console.log('[VoidMiniGameScene] Ad completion bonus awarded:', bonusCoins);
    }

    showCountdown(callback) {
        const { width, height } = this.scale;

        const countdownNumbers = ['3', '2', '1', 'GO!'];
        let index = 0;

        const showNext = () => {
            if (index >= countdownNumbers.length) {
                callback();
                return;
            }

            const text = this.add.text(width / 2, height / 2, countdownNumbers[index], {
                fontSize: '80px',
                fontFamily: 'Arial, sans-serif',
                color: index === 3 ? '#00FF00' : '#FFFFFF',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 6
            }).setOrigin(0.5);

            this.tweens.add({
                targets: text,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 800,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    text.destroy();
                    index++;
                    showNext();
                }
            });

            // Play sound
            if (window.AudioManager) {
                if (index === 3) {
                    window.AudioManager.playLevelUp();
                } else {
                    window.AudioManager.playButtonClick();
                }
            }
        };

        showNext();
    }

    startGame() {
        this.isGameActive = true;

        // Start timer
        this.gameTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // Give initial push
        this.player.setVelocity(
            Phaser.Math.Between(-250, 250),
            Phaser.Math.Between(-250, 250)
        );

        // Hide instructions after 3 seconds
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: this.instructions,
                alpha: 0,
                duration: 500
            });
        });

        console.log('[VoidMiniGameScene] Game started!');
    }

    updateTimer() {
        this.timeRemaining--;
        this.timerText.setText(this.timeRemaining.toString());

        // Warning colors
        if (this.timeRemaining <= 10) {
            this.timerText.setColor('#FF4444');

            // Pulse effect
            this.tweens.add({
                targets: this.timerText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 200,
                yoyo: true
            });

            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
        } else if (this.timeRemaining <= 30) {
            this.timerText.setColor('#FFAA00');
        }

        if (this.timeRemaining <= 0) {
            this.endGame();
        }
    }

    endGame() {
        this.isGameActive = false;

        // Stop timer
        if (this.gameTimer) {
            this.gameTimer.remove();
        }

        // Stop player
        this.player.setVelocity(0, 0);

        // Show results
        this.showResults();

        console.log('[VoidMiniGameScene] Game ended! Score:', this.score);
    }

    showResults() {
        const { width, height } = this.scale;

        // Darken background
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setAlpha(0);

        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 500
        });

        // Results panel
        const panelWidth = 300;
        const panelHeight = 250;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x6600FF, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setAlpha(0);

        this.tweens.add({
            targets: panel,
            alpha: 1,
            duration: 500,
            delay: 300
        });

        // Title
        const title = this.add.text(width / 2, panelY + 40, '🌌 VOID COMPLETE!', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Score
        const scoreLabel = this.add.text(width / 2, panelY + 100, 'Coins Collected:', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5).setAlpha(0);

        const finalScore = this.add.text(width / 2, panelY + 140, `🪙 ${this.score}`, {
            fontSize: '36px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Continue button
        const buttonY = panelY + panelHeight - 45;
        const button = this.add.graphics();
        button.fillStyle(0x6600FF, 1);
        button.fillRoundedRect(width / 2 - 80, buttonY - 20, 160, 40, 8);
        button.setAlpha(0);

        const buttonText = this.add.text(width / 2, buttonY, 'Return to Sanctuary', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // Make button interactive
        const buttonZone = this.add.zone(width / 2, buttonY, 160, 40).setInteractive();
        buttonZone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0x8844FF, 1);
            button.fillRoundedRect(width / 2 - 80, buttonY - 20, 160, 40, 8);
        });
        buttonZone.on('pointerout', () => {
            button.clear();
            button.fillStyle(0x6600FF, 1);
            button.fillRoundedRect(width / 2 - 80, buttonY - 20, 160, 40, 8);
        });
        buttonZone.on('pointerdown', () => {
            this.returnToSanctuary();
        });

        // Animate elements in
        this.tweens.add({
            targets: [title, scoreLabel, finalScore, button, buttonText],
            alpha: 1,
            duration: 500,
            delay: 500
        });

        // Play completion sound
        if (window.AudioManager) {
            this.time.delayedCall(300, () => {
                window.AudioManager.playAchievement();
            });
        }

        // Add coins to player's economy
        if (window.EconomyManager && this.score > 0) {
            window.EconomyManager.addCoins(this.score, 'void_minigame');
        }
    }

    returnToSanctuary() {
        // Play transition sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Fade out and return
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', {
                returnFromVoid: true,
                voidScore: this.score,
                returnPosition: this.returnPosition
            });
        });
    }

    onWallBounce() {
        // Visual effect on wall bounce
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Flash effect
        const flash = this.add.graphics();
        flash.fillStyle(0x00FFFF, 0.3);
        flash.fillCircle(this.player.x, this.player.y, 30);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 200,
            onComplete: () => flash.destroy()
        });
    }

    update(time, delta) {
        if (!this.isGameActive) return;

        // Update player glow position
        if (this.playerGlow && this.player) {
            this.playerGlow.x = this.player.x;
            this.playerGlow.y = this.player.y;
        }

        // Add slight gravity toward center (void pull effect)
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        const dx = centerX - this.player.x;
        const dy = centerY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 50) {
            // Very slight pull toward center
            const pullStrength = 5;
            this.player.body.velocity.x += (dx / distance) * pullStrength * (delta / 1000);
            this.player.body.velocity.y += (dy / distance) * pullStrength * (delta / 1000);
        }

        // Create trail effect
        if (time % 100 < 20) {
            const trail = this.add.graphics();
            trail.fillStyle(0x00FFFF, 0.3);
            trail.fillCircle(this.player.x, this.player.y, 8);
            trail.setBlendMode(Phaser.BlendModes.ADD);

            this.tweens.add({
                targets: trail,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 500,
                onComplete: () => trail.destroy()
            });
        }

        // Ensure player stays in bounds (manual wrap-around as backup)
        if (this.player.x < 0) this.player.x = width;
        if (this.player.x > width) this.player.x = 0;
        if (this.player.y < 0) this.player.y = height;
        if (this.player.y > height) this.player.y = 0;
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        // Update background
        if (this.background) {
            this.background.clear();
            this.background.fillStyle(0x050510, 1);
            this.background.fillRect(0, 0, width, height);
        }

        // Update boundary positions
        if (this.topWall) {
            this.topWall.x = width / 2;
            this.topWall.width = width;
        }
        if (this.bottomWall) {
            this.bottomWall.x = width / 2;
            this.bottomWall.y = height + 10;
            this.bottomWall.width = width;
        }
        if (this.leftWall) {
            this.leftWall.y = height / 2;
            this.leftWall.height = height;
        }
        if (this.rightWall) {
            this.rightWall.x = width + 10;
            this.rightWall.y = height / 2;
            this.rightWall.height = height;
        }

        // Update UI positions
        if (this.timerText) {
            this.timerText.x = width / 2;
        }
        if (this.scoreText) {
            this.scoreText.x = width - 70;
        }
        if (this.instructions) {
            this.instructions.x = width / 2;
            this.instructions.y = height - 30;
        }
    }

    shutdown() {
        console.log('[VoidMiniGameScene] Shutting down - cleaning up resources');

        // Remove resize listener
        this.scale.off('resize', this.handleResize, this);

        // Clear timers
        if (this.gameTimer) {
            this.gameTimer.remove();
        }
        if (this.comboTimer) {
            this.comboTimer.remove();
        }
        if (this.adTimer) {
            this.adTimer.remove();
        }
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Clean up ad overlay elements
        this.adOverlayElements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.adOverlayElements = [];

        // Kill all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear arrays
        this.coins = [];
        this.particles = [];
        this.voidEffects = [];

        // Null references
        this.player = null;
        this.playerGlow = null;
        this.background = null;
        this.timerText = null;
        this.scoreText = null;
        this.comboText = null;
        this.adTimerText = null;
        this.adProgressBar = null;
        this.adBarInfo = null;

        console.log('[VoidMiniGameScene] Cleanup complete');
    }
}

// Register scene globally
window.VoidMiniGameScene = VoidMiniGameScene;

export default VoidMiniGameScene;
