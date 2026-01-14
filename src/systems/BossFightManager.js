/**
 * BossFightManager - Centralized system for managing boss fight sequences
 *
 * Provides:
 * - Boss fight lifecycle management (intro, active, victory, defeat)
 * - Atmosphere transitions (darkness, camera effects)
 * - Boss UI (health bar, name, phase indicators)
 * - Attack telegraphing system
 * - Damage feedback effects (hit pause, screen flash)
 * - Player invincibility management
 * - Phase transition effects
 *
 * Usage:
 *   const bossFight = new BossFightManager(scene, bossConfig);
 *   bossFight.startFight();
 *   bossFight.damageBoss(1);
 *   bossFight.onBossDefeated(() => this.levelComplete());
 */

class BossFightManager {
    constructor(scene, config = {}) {
        this.scene = scene;

        // Boss configuration
        this.config = {
            name: config.name || 'BOSS',
            maxHealth: config.maxHealth || 8,
            phases: config.phases || [
                { threshold: 1.0, speed: 80, attackDelay: 2500, tint: null },
                { threshold: 0.5, speed: 120, attackDelay: 1800, tint: 0xFF6B6B }
            ],
            spawnPosition: config.spawnPosition || { x: 400, y: 300 },
            arenaCenter: config.arenaCenter || { x: 400, y: 300 },
            textureKey: config.textureKey || 'boss',
            attacks: config.attacks || [],
            rewards: config.rewards || { coins: 500, items: [] },
            introMessage: config.introMessage || '⚠ THE GUARDIAN AWAKENS ⚠',
            defeatMessage: config.defeatMessage || '💎 BOSS DEFEATED 💎',
            ...config
        };

        // State
        this.boss = null;
        this.health = this.config.maxHealth;
        this.maxHealth = this.config.maxHealth;
        this.currentPhase = 0;
        this.isActive = false;
        this.isAttacking = false;
        this.isInvincible = false;

        // UI Elements
        this.ui = {
            container: null,
            healthBar: null,
            healthBarBg: null,
            nameText: null,
            phaseIndicators: [],
            overlay: null
        };

        // Timers
        this.aiTimer = null;
        this.attackTimer = null;

        // Callbacks
        this.callbacks = {
            onBossDefeated: null,
            onPhaseChange: null,
            onBossDamaged: null,
            onPlayerDamaged: null
        };

        // Telegraph system
        this.telegraphs = [];

        console.log('[BossFightManager] Initialized for:', this.config.name);
    }

    /**
     * Start the boss fight sequence
     */
    startFight() {
        console.log('[BossFightManager] Starting boss fight:', this.config.name);

        // Pause gameplay briefly
        this.scene.physics.pause();

        // Phase 1: Warning flash
        this.scene.cameras.main.flash(500, 150, 0, 200);

        // Phase 2: Show intro message
        this.showIntroSequence(() => {
            // Phase 3: Atmosphere change
            this.createAtmosphere(() => {
                // Phase 4: Spawn boss
                this.spawnBoss();

                // Phase 5: Create UI
                this.createBossUI();

                // Phase 6: Start AI
                this.startBossAI();

                // Resume gameplay
                this.scene.physics.resume();
                this.isActive = true;
            });
        });

        // Play ominous sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    /**
     * Show the boss intro cinematic sequence
     */
    showIntroSequence(onComplete) {
        const { width, height } = this.scene.cameras.main;

        // Warning text with dramatic entrance
        const warningText = this.scene.add.text(width / 2, height / 2, this.config.introMessage, {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0).setScale(0.5);

        // Dramatic entrance animation
        this.scene.tweens.add({
            targets: warningText,
            alpha: 1,
            scale: 1.2,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Hold then fade
                this.scene.tweens.add({
                    targets: warningText,
                    alpha: 0,
                    scale: 1.5,
                    duration: 800,
                    delay: 1200,
                    ease: 'Power2',
                    onComplete: () => {
                        warningText.destroy();
                        if (onComplete) onComplete();
                    }
                });
            }
        });

        // Screen shake during intro
        this.scene.time.delayedCall(300, () => {
            this.scene.cameras.main.shake(800, 0.01);
        });
    }

    /**
     * Create atmospheric effects for boss fight
     */
    createAtmosphere(onComplete) {
        const { width, height } = this.scene.cameras.main;

        // Darkness overlay
        this.ui.overlay = this.scene.add.graphics();
        this.ui.overlay.fillStyle(0x1A0A2E, 0.5);
        this.ui.overlay.fillRect(0, 0, width, height);
        this.ui.overlay.setScrollFactor(0);
        this.ui.overlay.setDepth(100);
        this.ui.overlay.setAlpha(0);

        // Fade in darkness
        this.scene.tweens.add({
            targets: this.ui.overlay,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                // Camera zoom for intensity
                this.scene.cameras.main.zoomTo(1.1, 800);

                // Ground shake
                this.scene.cameras.main.shake(1200, 0.02);

                this.scene.time.delayedCall(1200, () => {
                    if (onComplete) onComplete();
                });
            }
        });
    }

    /**
     * Spawn the boss entity
     * Override in subclass or provide spawn callback in config
     */
    spawnBoss() {
        if (this.config.createBoss) {
            this.boss = this.config.createBoss(this.scene, this.config.spawnPosition);
        } else {
            // Default boss creation
            this.boss = this.scene.physics.add.sprite(
                this.config.spawnPosition.x,
                this.config.spawnPosition.y,
                this.config.textureKey
            );
            this.boss.setCollideWorldBounds(true);
            this.boss.setBounce(0);
            this.boss.setDepth(880);
        }

        // Initialize boss state
        this.boss.isAttacking = false;
        this.boss.facingRight = false;

        // Dramatic spawn animation
        this.boss.setAlpha(0);
        this.boss.setScale(0.3);

        this.scene.tweens.add({
            targets: this.boss,
            alpha: 1,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 800,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Settle to normal size with bounce
                this.scene.tweens.add({
                    targets: this.boss,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Bounce.easeOut'
                });
            }
        });

        // Spawn particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, this.boss.x, this.boss.y + 50, {
                count: 40,
                color: [0x7B68EE, 0x9370DB, 0xE040FB],
                duration: 1500
            });
        }

        // Boss roar
        if (window.AudioManager) {
            window.AudioManager.playAttack();
        }

        return this.boss;
    }

    /**
     * Create boss UI elements (health bar, name, phase indicators)
     */
    createBossUI() {
        const { width } = this.scene.cameras.main;
        const barWidth = 300;
        const barHeight = 24;
        const barX = (width - barWidth) / 2;
        const barY = 80;

        // Container for all boss UI
        this.ui.container = this.scene.add.container(0, 0);
        this.ui.container.setScrollFactor(0);
        this.ui.container.setDepth(1500);
        this.ui.container.setAlpha(0);

        // Boss name with glow effect
        this.ui.nameText = this.scene.add.text(width / 2, barY - 28, this.config.name, {
            fontSize: '20px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.ui.container.add(this.ui.nameText);

        // Phase indicators (dots under name)
        const phaseCount = this.config.phases.length;
        for (let i = 0; i < phaseCount; i++) {
            const dot = this.scene.add.graphics();
            const dotX = width / 2 - ((phaseCount - 1) * 12) / 2 + i * 12;
            dot.fillStyle(i === 0 ? 0xFF4500 : 0x3D2B5D, 1);
            dot.fillCircle(dotX, barY - 8, 4);
            this.ui.phaseIndicators.push(dot);
            this.ui.container.add(dot);
        }

        // Health bar background with glow
        this.ui.healthBarBg = this.scene.add.graphics();
        this.ui.healthBarBg.fillStyle(0x000000, 0.6);
        this.ui.healthBarBg.fillRoundedRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 6);
        this.ui.healthBarBg.fillStyle(0x1A1025, 1);
        this.ui.healthBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);
        this.ui.healthBarBg.lineStyle(2, 0x7B68EE, 0.8);
        this.ui.healthBarBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 5);
        this.ui.container.add(this.ui.healthBarBg);

        // Health bar fill
        this.ui.healthBar = this.scene.add.graphics();
        this.ui.container.add(this.ui.healthBar);
        this.updateHealthBar();

        // Fade in UI
        this.scene.tweens.add({
            targets: this.ui.container,
            alpha: 1,
            duration: 500,
            delay: 300
        });
    }

    /**
     * Update health bar display
     */
    updateHealthBar() {
        if (!this.ui.healthBar) return;

        const { width } = this.scene.cameras.main;
        const barWidth = 300;
        const barHeight = 24;
        const barX = (width - barWidth) / 2;
        const barY = 80;

        const healthPercent = Math.max(0, this.health / this.maxHealth);
        const fillWidth = Math.max(0, (barWidth - 6) * healthPercent);

        this.ui.healthBar.clear();

        // Dynamic color based on health
        let fillColor;
        if (healthPercent > 0.6) {
            fillColor = 0x7B68EE; // Purple - healthy
        } else if (healthPercent > 0.3) {
            fillColor = 0xFFA500; // Orange - damaged
        } else {
            fillColor = 0xFF4500; // Red - critical
        }

        // Health fill with gradient effect (simulate with two layers)
        if (fillWidth > 0) {
            this.ui.healthBar.fillStyle(fillColor, 1);
            this.ui.healthBar.fillRoundedRect(barX + 3, barY + 3, fillWidth, barHeight - 6, 3);

            // Highlight on top
            this.ui.healthBar.fillStyle(0xFFFFFF, 0.2);
            this.ui.healthBar.fillRoundedRect(barX + 3, barY + 3, fillWidth, (barHeight - 6) / 2, 3);
        }
    }

    /**
     * Start boss AI behavior loop
     */
    startBossAI() {
        const currentPhaseConfig = this.config.phases[this.currentPhase];

        // AI update loop
        this.aiTimer = this.scene.time.addEvent({
            delay: 50,
            callback: () => this.updateBossAI(),
            loop: true
        });

        // Attack timer
        this.attackTimer = this.scene.time.addEvent({
            delay: currentPhaseConfig.attackDelay,
            callback: () => this.performAttack(),
            loop: true
        });
    }

    /**
     * Update boss AI - override or provide config.updateAI
     */
    updateBossAI() {
        if (!this.boss || !this.boss.active || !this.isActive) return;

        if (this.config.updateAI) {
            this.config.updateAI(this.boss, this.scene, this.currentPhase);
        }
    }

    /**
     * Perform an attack
     */
    performAttack() {
        if (!this.boss || !this.boss.active || this.isAttacking || !this.isActive) return;

        const attacks = this.config.attacks;
        if (!attacks || attacks.length === 0) return;

        // Filter attacks by phase
        const availableAttacks = attacks.filter(a =>
            !a.minPhase || this.currentPhase >= a.minPhase
        );

        if (availableAttacks.length === 0) return;

        // Random attack selection (weighted if weights provided)
        const attack = this.selectWeightedAttack(availableAttacks);

        this.isAttacking = true;
        this.boss.isAttacking = true;

        // Telegraph the attack
        if (attack.telegraph) {
            this.showAttackTelegraph(attack, () => {
                this.executeAttack(attack);
            });
        } else {
            this.executeAttack(attack);
        }
    }

    /**
     * Select attack using weighted random
     */
    selectWeightedAttack(attacks) {
        const totalWeight = attacks.reduce((sum, a) => sum + (a.weight || 1), 0);
        let random = Math.random() * totalWeight;

        for (const attack of attacks) {
            random -= (attack.weight || 1);
            if (random <= 0) return attack;
        }

        return attacks[0];
    }

    /**
     * Show attack telegraph (warning indicator)
     */
    showAttackTelegraph(attack, onComplete) {
        const telegraphDuration = attack.telegraphDuration || 500;

        if (attack.telegraph === 'ground') {
            // Ground warning zone
            this.showGroundTelegraph(attack, telegraphDuration, onComplete);
        } else if (attack.telegraph === 'line') {
            // Line/beam warning
            this.showLineTelegraph(attack, telegraphDuration, onComplete);
        } else if (attack.telegraph === 'flash') {
            // Boss flash warning
            this.showFlashTelegraph(attack, telegraphDuration, onComplete);
        } else {
            // Default: just execute
            this.scene.time.delayedCall(telegraphDuration, onComplete);
        }
    }

    /**
     * Show ground area telegraph
     */
    showGroundTelegraph(attack, duration, onComplete) {
        const zone = this.scene.add.graphics();
        const width = attack.areaWidth || 250;
        const height = attack.areaHeight || 30;

        zone.fillStyle(0xFF0000, 0.2);
        zone.fillRect(-width / 2, -height / 2, width, height);
        zone.lineStyle(2, 0xFF0000, 0.8);
        zone.strokeRect(-width / 2, -height / 2, width, height);

        zone.setPosition(this.boss.x, this.boss.y + 60);
        zone.setDepth(90);

        // Pulsing warning
        this.scene.tweens.add({
            targets: zone,
            alpha: { from: 0.3, to: 0.7 },
            duration: 150,
            yoyo: true,
            repeat: Math.floor(duration / 300),
            onComplete: () => {
                zone.destroy();
                if (onComplete) onComplete();
            }
        });

        this.telegraphs.push(zone);
    }

    /**
     * Show line telegraph
     */
    showLineTelegraph(attack, duration, onComplete) {
        const player = this.scene.player;
        if (!player) {
            if (onComplete) onComplete();
            return;
        }

        const line = this.scene.add.graphics();
        line.lineStyle(4, 0xFF0000, 0.5);
        line.lineBetween(this.boss.x, this.boss.y, player.x, player.y);
        line.setDepth(90);

        this.scene.tweens.add({
            targets: line,
            alpha: { from: 0.3, to: 0.8 },
            duration: 100,
            yoyo: true,
            repeat: Math.floor(duration / 200),
            onComplete: () => {
                line.destroy();
                if (onComplete) onComplete();
            }
        });

        this.telegraphs.push(line);
    }

    /**
     * Show flash telegraph on boss
     */
    showFlashTelegraph(attack, duration, onComplete) {
        const originalTint = this.boss.tintTopLeft;

        // Flash red
        this.boss.setTint(0xFF0000);

        this.scene.tweens.add({
            targets: this.boss,
            alpha: { from: 1, to: 0.5 },
            duration: 100,
            yoyo: true,
            repeat: Math.floor(duration / 200),
            onComplete: () => {
                this.boss.clearTint();
                const phase = this.config.phases[this.currentPhase];
                if (phase && phase.tint) {
                    this.boss.setTint(phase.tint);
                }
                if (onComplete) onComplete();
            }
        });
    }

    /**
     * Execute the attack
     */
    executeAttack(attack) {
        if (attack.execute) {
            attack.execute(this.boss, this.scene, this);
        }

        // Reset attack state after cooldown
        const cooldown = attack.cooldown || 1000;
        this.scene.time.delayedCall(cooldown, () => {
            this.isAttacking = false;
            if (this.boss) this.boss.isAttacking = false;
        });
    }

    /**
     * Damage the boss
     */
    damageBoss(amount, fromPlayer = true) {
        if (!this.boss || !this.boss.active || this.isInvincible) return false;

        this.health -= amount;
        this.updateHealthBar();

        // Hit feedback
        this.showDamageFeedback();

        // Damage callback
        if (this.callbacks.onBossDamaged) {
            this.callbacks.onBossDamaged(amount, this.health);
        }

        // Check phase transition
        this.checkPhaseTransition();

        // Check defeat
        if (this.health <= 0) {
            this.onBossDefeated();
            return true;
        }

        return false;
    }

    /**
     * Show damage feedback effects
     */
    showDamageFeedback() {
        // Hit pause (brief freeze frame)
        this.scene.time.timeScale = 0.1;
        this.scene.time.delayedCall(50, () => {
            this.scene.time.timeScale = 1;
        });

        // Flash white
        this.boss.setTint(0xFFFFFF);
        this.scene.time.delayedCall(80, () => {
            if (this.boss && this.boss.active) {
                const phase = this.config.phases[this.currentPhase];
                if (phase && phase.tint) {
                    this.boss.setTint(phase.tint);
                } else {
                    this.boss.clearTint();
                }
            }
        });

        // Screen shake
        this.scene.cameras.main.shake(100, 0.01);

        // Damage particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, this.boss.x, this.boss.y, {
                count: 12,
                color: [0xFFFFFF, 0x7B68EE, 0xE040FB],
                duration: 600
            });
        }

        // Damage sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        // Floating damage number
        this.showDamageNumber(this.boss.x, this.boss.y - 40);
    }

    /**
     * Show floating damage number
     */
    showDamageNumber(x, y) {
        const damageText = this.scene.add.text(x, y, '-1', {
            fontSize: '28px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: damageText,
            y: y - 60,
            alpha: 0,
            scale: 1.5,
            duration: 800,
            ease: 'Power2',
            onComplete: () => damageText.destroy()
        });
    }

    /**
     * Check if phase transition should occur
     */
    checkPhaseTransition() {
        const healthPercent = this.health / this.maxHealth;

        for (let i = this.config.phases.length - 1; i > this.currentPhase; i--) {
            const phase = this.config.phases[i];
            if (healthPercent <= phase.threshold) {
                this.transitionToPhase(i);
                break;
            }
        }
    }

    /**
     * Transition to a new phase
     */
    transitionToPhase(phaseIndex) {
        console.log('[BossFightManager] Phase transition:', this.currentPhase, '->', phaseIndex);

        const oldPhase = this.currentPhase;
        this.currentPhase = phaseIndex;
        const newPhase = this.config.phases[phaseIndex];

        // Brief invincibility during transition
        this.isInvincible = true;

        // Phase transition effects
        this.scene.cameras.main.shake(600, 0.025);
        this.scene.cameras.main.flash(300, 255, 100, 0);

        // Update boss tint
        if (newPhase.tint) {
            this.boss.setTint(newPhase.tint);
        }

        // Update phase indicators
        this.updatePhaseIndicators();

        // Phase announcement
        const { width, height } = this.scene.cameras.main;
        const phaseText = this.scene.add.text(width / 2, height / 2, newPhase.message || 'ENRAGED!', {
            fontSize: '32px',
            color: '#FF4500',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

        this.scene.tweens.add({
            targets: phaseText,
            alpha: 0,
            y: height / 2 - 60,
            scale: 1.5,
            duration: 1500,
            onComplete: () => {
                phaseText.destroy();
                this.isInvincible = false;
            }
        });

        // Update attack timer with new delay
        if (this.attackTimer) {
            this.attackTimer.remove();
        }
        this.attackTimer = this.scene.time.addEvent({
            delay: newPhase.attackDelay,
            callback: () => this.performAttack(),
            loop: true
        });

        // Phase callback
        if (this.callbacks.onPhaseChange) {
            this.callbacks.onPhaseChange(oldPhase, phaseIndex);
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    /**
     * Update phase indicator dots
     */
    updatePhaseIndicators() {
        this.ui.phaseIndicators.forEach((dot, i) => {
            dot.clear();
            const color = i <= this.currentPhase ? 0xFF4500 : 0x3D2B5D;
            const { width } = this.scene.cameras.main;
            const phaseCount = this.config.phases.length;
            const dotX = width / 2 - ((phaseCount - 1) * 12) / 2 + i * 12;
            dot.fillStyle(color, 1);
            dot.fillCircle(dotX, 72, 4);
        });
    }

    /**
     * Handle boss defeat
     */
    onBossDefeated() {
        console.log('[BossFightManager] Boss defeated!');
        this.isActive = false;

        // Stop AI
        if (this.aiTimer) {
            this.aiTimer.remove();
            this.aiTimer = null;
        }
        if (this.attackTimer) {
            this.attackTimer.remove();
            this.attackTimer = null;
        }

        // Clear telegraphs
        this.telegraphs.forEach(t => t?.destroy());
        this.telegraphs = [];

        // Boss defeat animation
        this.boss.setVelocity(0, 0);
        if (this.boss.body) {
            this.boss.body.setAllowGravity(false);
        }

        // Epic screen shake
        this.scene.cameras.main.shake(1500, 0.05);

        // Multiple explosion bursts
        for (let i = 0; i < 10; i++) {
            this.scene.time.delayedCall(i * 120, () => {
                if (window.FXLibrary && this.boss) {
                    const offsetX = Phaser.Math.Between(-50, 50);
                    const offsetY = Phaser.Math.Between(-60, 40);
                    window.FXLibrary.stardustBurst(this.scene, this.boss.x + offsetX, this.boss.y + offsetY, {
                        count: 20,
                        color: [0x7B68EE, 0xE040FB, 0x00FFFF, 0xFFD700, 0xFFFFFF],
                        duration: 1200
                    });
                }
            });
        }

        // Boss fade out
        this.scene.tweens.add({
            targets: this.boss,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            rotation: 0.5,
            duration: 1800,
            ease: 'Power2',
            onComplete: () => {
                if (this.boss) this.boss.destroy();
                this.boss = null;
            }
        });

        // Victory sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Hide boss UI
        if (this.ui.container) {
            this.scene.tweens.add({
                targets: this.ui.container,
                alpha: 0,
                duration: 500
            });
        }

        // Remove atmosphere
        if (this.ui.overlay) {
            this.scene.tweens.add({
                targets: this.ui.overlay,
                alpha: 0,
                duration: 1200
            });
        }

        // Reset camera
        this.scene.cameras.main.zoomTo(1.0, 1200);

        // Victory message after animations
        this.scene.time.delayedCall(2200, () => {
            this.showVictorySequence();
        });
    }

    /**
     * Show victory celebration
     */
    showVictorySequence() {
        const { width, height } = this.scene.cameras.main;

        // Victory text
        const victoryText = this.scene.add.text(width / 2, height / 2, this.config.defeatMessage, {
            fontSize: '36px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0).setScale(0.5);

        this.scene.tweens.add({
            targets: victoryText,
            alpha: 1,
            scale: 1.1,
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: victoryText,
                    alpha: 0,
                    scale: 1.3,
                    duration: 800,
                    delay: 2000,
                    onComplete: () => {
                        victoryText.destroy();

                        // Trigger callback
                        if (this.callbacks.onBossDefeated) {
                            this.callbacks.onBossDefeated(this.config.rewards);
                        }
                    }
                });
            }
        });

        // Celebration particles
        for (let i = 0; i < 8; i++) {
            this.scene.time.delayedCall(i * 200, () => {
                if (window.FXLibrary) {
                    const x = Phaser.Math.Between(100, width - 100);
                    const y = Phaser.Math.Between(height / 3, height * 2 / 3);
                    window.FXLibrary.stardustBurst(this.scene, x + this.scene.cameras.main.scrollX, y, {
                        count: 25,
                        color: [0xFFD700, 0x7B68EE, 0x00FFFF, 0xFFFFFF],
                        duration: 2000
                    });
                }
            });
        }
    }

    /**
     * Set callback for boss defeated event
     */
    onBossDefeatedCallback(callback) {
        this.callbacks.onBossDefeated = callback;
        return this;
    }

    /**
     * Set callback for phase change event
     */
    onPhaseChangeCallback(callback) {
        this.callbacks.onPhaseChange = callback;
        return this;
    }

    /**
     * Set callback for boss damaged event
     */
    onBossDamagedCallback(callback) {
        this.callbacks.onBossDamaged = callback;
        return this;
    }

    /**
     * Get current boss instance
     */
    getBoss() {
        return this.boss;
    }

    /**
     * Check if boss fight is active
     */
    isFightActive() {
        return this.isActive;
    }

    /**
     * Clean up all resources
     */
    destroy() {
        console.log('[BossFightManager] Destroying...');

        // Stop timers
        if (this.aiTimer) {
            this.aiTimer.remove();
            this.aiTimer = null;
        }
        if (this.attackTimer) {
            this.attackTimer.remove();
            this.attackTimer = null;
        }

        // Clear telegraphs
        this.telegraphs.forEach(t => t?.destroy());
        this.telegraphs = [];

        // Destroy boss
        if (this.boss) {
            this.boss.destroy();
            this.boss = null;
        }

        // Destroy UI
        if (this.ui.container) {
            this.ui.container.destroy();
        }
        if (this.ui.overlay) {
            this.ui.overlay.destroy();
        }

        // Clear UI references
        this.ui = {
            container: null,
            healthBar: null,
            healthBarBg: null,
            nameText: null,
            phaseIndicators: [],
            overlay: null
        };

        // Clear callbacks
        this.callbacks = {
            onBossDefeated: null,
            onPhaseChange: null,
            onBossDamaged: null,
            onPlayerDamaged: null
        };

        this.isActive = false;

        console.log('[BossFightManager] Destroyed');
    }
}

// Export globally
if (typeof window !== 'undefined') {
    window.BossFightManager = BossFightManager;
}

export default BossFightManager;
