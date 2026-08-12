/**
 * CampfireRestSystem - Handles campfire rest mechanics, stat recovery, and bonding
 * Features:
 * - 30-second rest cycle for full stat recovery
 * - Box breathing exercise overlay
 * - Creature meditation close-up with radiant effects
 * - Bonding rewards and time-slow tool
 */

class CampfireRestSystem {
    constructor() {
        this.initialized = false;
        this.isResting = false;
        this.restStartTime = 0;
        this.restDuration = 30000; // 30 seconds for full rest
        this.currentRestScene = null;

        // Breathing exercise config (kid-friendly timing)
        this.breathingConfig = {
            inhaleTime: 4000,    // 4 seconds inhale
            holdTime: 4000,      // 4 seconds hold
            exhaleTime: 4000,    // 4 seconds exhale
            pauseTime: 2000,     // 2 seconds pause
            cycleTime: 14000,    // Total cycle time
            totalCycles: 2       // 2 complete cycles in 30 seconds
        };

        // Rest bonuses earned during session
        this.sessionBonuses = {
            happiness: 0,
            energy: 0,
            health: 0,
            bondingPoints: 0
        };

        // Event listeners
        this.eventListeners = new Map();
    }

    /**
     * Initialize the system
     */
    init() {
        if (this.initialized) return;
        console.log('[CampfireRestSystem] Initializing...');
        this.initialized = true;
    }

    /**
     * Check if player can start resting
     */
    canStartRest(scene) {
        if (this.isResting) return false;
        if (!scene) return false;
        return true;
    }

    /**
     * Start the campfire rest session
     * @param {Phaser.Scene} scene - The game scene
     * @param {object} campfirePosition - {x, y} position of campfire
     * @param {object} creatureGenes - Creature genetics for rendering
     */
    startRest(scene, campfirePosition, creatureGenes) {
        if (!this.canStartRest(scene)) {
            console.log('[CampfireRestSystem] Cannot start rest - already resting or invalid scene');
            return false;
        }

        console.log('[CampfireRestSystem] Starting campfire rest session');
        this.isResting = true;
        this.restStartTime = Date.now();
        this.currentRestScene = scene;
        this.sessionBonuses = { happiness: 0, energy: 0, health: 0, bondingPoints: 0 };

        // Emit rest started event
        this.emit('restStarted', { campfirePosition });

        // Start meditation music
        if (window.AudioManager) {
            window.AudioManager.playMeditationMusic();
        }

        // Create the rest overlay UI
        this.createRestOverlay(scene, campfirePosition, creatureGenes);

        return true;
    }

    /**
     * Create the rest overlay with creature meditation view
     */
    createRestOverlay(scene, campfirePosition, creatureGenes) {
        const { width, height } = scene.scale;
        this.overlayElements = [];

        // Dark overlay background
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(4000);
        this.overlayElements.push(overlay);

        // Create cozy campfire scene background
        this.createCampfireBackground(scene, width, height);

        // Render creature close-up meditating
        this.createMeditatingCreature(scene, width, height, creatureGenes);

        // Campfire glow effect
        this.createCampfireGlow(scene, width, height);

        // Breathing exercise UI
        this.createBreathingUI(scene, width, height);

        // Progress bar for rest session
        this.createRestProgressBar(scene, width, height);

        // Skip/Cancel button
        this.createCancelButton(scene, width, height);

        // Start the breathing cycle
        this.startBreathingCycle(scene);

        // Start stat recovery timer
        this.startStatRecovery(scene);
    }

    /**
     * Create cozy campfire background
     */
    createCampfireBackground(scene, width, height) {
        // Starry night sky gradient
        const skyGradient = scene.add.graphics();
        skyGradient.setScrollFactor(0);
        skyGradient.setDepth(4001);

        // Dark blue to purple gradient
        for (let i = 0; i < 20; i++) {
            const y = (i / 20) * height;
            const ratio = i / 20;
            const r = Math.floor(10 + ratio * 20);
            const g = Math.floor(5 + ratio * 15);
            const b = Math.floor(30 + ratio * 40);
            const color = (r << 16) | (g << 8) | b;
            skyGradient.fillStyle(color, 0.3);
            skyGradient.fillRect(0, y, width, height / 20 + 1);
        }
        this.overlayElements.push(skyGradient);

        // Add twinkling stars
        for (let i = 0; i < 30; i++) {
            const star = scene.add.graphics();
            const x = Phaser.Math.Between(20, width - 20);
            const y = Phaser.Math.Between(20, height / 3);
            const size = Phaser.Math.FloatBetween(1, 2.5);
            star.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.4, 0.9));
            star.fillCircle(x, y, size);
            star.setScrollFactor(0);
            star.setDepth(4002);
            this.overlayElements.push(star);

            // Twinkle animation
            scene.tweens.add({
                targets: star,
                alpha: { from: star.alpha, to: 0.2 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
        }

        // Ground/grass area
        const ground = scene.add.graphics();
        ground.fillStyle(0x1A2E1A, 0.9);
        ground.fillRect(0, height * 0.7, width, height * 0.3);
        ground.setScrollFactor(0);
        ground.setDepth(4003);
        this.overlayElements.push(ground);
    }

    /**
     * Create meditating creature close-up with radiant effects
     */
    createMeditatingCreature(scene, width, height, creatureGenes) {
        const creatureX = width / 2;
        const creatureY = height * 0.55;

        // Try to render creature using GraphicsEngine
        let creatureSprite = null;
        const storedTexture = window.GameState?.get('creature.textureName');

        if (storedTexture && scene.textures.exists(storedTexture)) {
            creatureSprite = scene.add.sprite(creatureX, creatureY, storedTexture);
            creatureSprite.setScale(2.5); // Close-up view
        } else if (creatureGenes && window.GraphicsEngine) {
            try {
                const tempEngine = new window.GraphicsEngine(scene);
                const result = tempEngine.createRandomizedSpaceMythicCreature(creatureGenes, 0);
                if (result.textureName && scene.textures.exists(result.textureName)) {
                    creatureSprite = scene.add.sprite(creatureX, creatureY, result.textureName);
                    creatureSprite.setScale(2.5);
                }
            } catch (err) {
                console.warn('[CampfireRestSystem] Could not render creature:', err);
            }
        }

        if (creatureSprite) {
            creatureSprite.setScrollFactor(0);
            creatureSprite.setDepth(4010);
            this.overlayElements.push(creatureSprite);
            this.creatureSprite = creatureSprite;

            // Gentle breathing animation
            scene.tweens.add({
                targets: creatureSprite,
                scaleX: { from: 2.5, to: 2.55 },
                scaleY: { from: 2.5, to: 2.45 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Create radiant sparkle aura around creature
            this.createRadiantAura(scene, creatureX, creatureY);
        } else {
            // Fallback: show placeholder
            const placeholder = scene.add.text(creatureX, creatureY, 'Your creature is resting...', {
                fontSize: '20px',
                color: '#FFFFFF',
                fontStyle: 'italic'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(4010);
            this.overlayElements.push(placeholder);
        }
    }

    /**
     * Create radiant sparkle aura around creature
     */
    createRadiantAura(scene, centerX, centerY) {
        // Soft outer glow
        const outerGlow = scene.add.graphics();
        outerGlow.fillStyle(0xFFD700, 0.1);
        outerGlow.fillCircle(centerX, centerY, 120);
        outerGlow.setScrollFactor(0);
        outerGlow.setDepth(4009);
        this.overlayElements.push(outerGlow);

        // Pulsing glow animation
        scene.tweens.add({
            targets: outerGlow,
            alpha: { from: 0.1, to: 0.25 },
            scaleX: { from: 1, to: 1.1 },
            scaleY: { from: 1, to: 1.1 },
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        // Floating sparkle particles
        for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2;
            const radius = 80 + Phaser.Math.Between(-20, 20);
            const sparkle = scene.add.graphics();
            const sparkleX = centerX + Math.cos(angle) * radius;
            const sparkleY = centerY + Math.sin(angle) * radius;

            // Draw small star shape
            sparkle.fillStyle(0xFFD700, 0.8);
            sparkle.fillCircle(sparkleX, sparkleY, 3);
            sparkle.setScrollFactor(0);
            sparkle.setDepth(4011);
            this.overlayElements.push(sparkle);

            // Floating animation
            scene.tweens.add({
                targets: sparkle,
                y: sparkle.y - 30,
                alpha: { from: 0.8, to: 0 },
                duration: 3000,
                delay: i * 200,
                repeat: -1,
                onRepeat: () => {
                    sparkle.y = sparkleY;
                    sparkle.alpha = 0.8;
                }
            });
        }

        // Energy wisps emanating from creature
        for (let i = 0; i < 8; i++) {
            const wisp = scene.add.graphics();
            wisp.setScrollFactor(0);
            wisp.setDepth(4012);
            this.overlayElements.push(wisp);

            const updateWisp = () => {
                wisp.clear();
                const angle = Math.random() * Math.PI * 2;
                const startRadius = 50;
                const endRadius = 150;

                // Draw a small curved line
                const color = Phaser.Math.Between(0, 1) > 0.5 ? 0xFFD700 : 0xFFFFFF;
                wisp.lineStyle(2, color, 0.5);
                wisp.beginPath();

                for (let j = 0; j <= 10; j++) {
                    const t = j / 10;
                    const r = startRadius + (endRadius - startRadius) * t;
                    const a = angle + t * 0.3;
                    const x = centerX + Math.cos(a) * r;
                    const y = centerY + Math.sin(a) * r;
                    if (j === 0) {
                        wisp.moveTo(x, y);
                    } else {
                        wisp.lineTo(x, y);
                    }
                }
                wisp.strokePath();
            };

            // Animate wisp
            scene.time.addEvent({
                delay: 500 + i * 300,
                callback: updateWisp,
                loop: true
            });
        }
    }

    /**
     * Create campfire glow effect at bottom center
     */
    createCampfireGlow(scene, width, height) {
        const fireX = width / 2;
        const fireY = height * 0.85;

        // Orange glow layers
        const glowLayers = [
            { radius: 80, color: 0xFF6600, alpha: 0.15 },
            { radius: 60, color: 0xFF8800, alpha: 0.2 },
            { radius: 40, color: 0xFFAA00, alpha: 0.25 },
            { radius: 25, color: 0xFFCC00, alpha: 0.3 }
        ];

        glowLayers.forEach(layer => {
            const glow = scene.add.graphics();
            glow.fillStyle(layer.color, layer.alpha);
            glow.fillCircle(fireX, fireY, layer.radius);
            glow.setScrollFactor(0);
            glow.setDepth(4004);
            this.overlayElements.push(glow);

            // Flicker animation
            scene.tweens.add({
                targets: glow,
                alpha: { from: layer.alpha, to: layer.alpha * 0.6 },
                scaleX: { from: 1, to: 1.1 },
                scaleY: { from: 1, to: 0.9 },
                duration: Phaser.Math.Between(200, 400),
                yoyo: true,
                repeat: -1
            });
        });

        // Fire particle emitter effect (simple version)
        for (let i = 0; i < 8; i++) {
            const particle = scene.add.graphics();
            const pX = fireX + Phaser.Math.Between(-20, 20);

            particle.fillStyle(Phaser.Math.Between(0, 1) > 0.5 ? 0xFF6600 : 0xFFAA00, 0.7);
            particle.fillCircle(pX, fireY, Phaser.Math.Between(3, 6));
            particle.setScrollFactor(0);
            particle.setDepth(4005);
            this.overlayElements.push(particle);

            // Rising and fading animation
            scene.tweens.add({
                targets: particle,
                y: fireY - 60,
                alpha: 0,
                duration: 1000,
                delay: i * 125,
                repeat: -1,
                onRepeat: () => {
                    particle.y = fireY;
                    particle.alpha = 0.7;
                    particle.x = fireX + Phaser.Math.Between(-20, 20);
                }
            });
        }
    }

    /**
     * Create breathing exercise UI
     */
    createBreathingUI(scene, width, height) {
        const breathX = width / 2;
        const breathY = height * 0.2;

        // Breathing instruction text
        this.breathingText = scene.add.text(breathX, breathY, 'Breathe In...', {
            fontSize: '28px',
            color: '#00FFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4020);
        this.overlayElements.push(this.breathingText);

        // Breathing circle indicator
        this.breathingCircle = scene.add.graphics();
        this.breathingCircle.setScrollFactor(0);
        this.breathingCircle.setDepth(4019);
        this.overlayElements.push(this.breathingCircle);
        this.breathingCircleY = breathY + 60;
        this.breathingCircleX = breathX;

        this.updateBreathingCircle(scene, 1); // Start at small size
    }

    /**
     * Update breathing circle size (0-1 range)
     */
    updateBreathingCircle(scene, size) {
        if (!this.breathingCircle) return;

        this.breathingCircle.clear();

        const minRadius = 20;
        const maxRadius = 60;
        const radius = minRadius + (maxRadius - minRadius) * size;

        // Outer ring
        this.breathingCircle.lineStyle(3, 0x00FFFF, 0.8);
        this.breathingCircle.strokeCircle(this.breathingCircleX, this.breathingCircleY, radius);

        // Inner glow
        this.breathingCircle.fillStyle(0x00FFFF, 0.2 * size);
        this.breathingCircle.fillCircle(this.breathingCircleX, this.breathingCircleY, radius * 0.8);
    }

    /**
     * Start breathing cycle animation
     */
    startBreathingCycle(scene) {
        const { inhaleTime, holdTime, exhaleTime, pauseTime } = this.breathingConfig;

        let cycleCount = 0;
        const totalCycles = this.breathingConfig.totalCycles;

        const runCycle = () => {
            if (!this.isResting || cycleCount >= totalCycles) return;

            // Phase 1: Inhale (expand circle)
            this.breathingText?.setText('Breathe In...');
            scene.tweens.add({
                targets: { size: 0 },
                size: 1,
                duration: inhaleTime,
                ease: 'Sine.easeInOut',
                onUpdate: (tween) => {
                    this.updateBreathingCircle(scene, tween.targets[0].size);
                },
                onComplete: () => {
                    if (!this.isResting) return;

                    // Phase 2: Hold
                    this.breathingText?.setText('Hold...');
                    scene.time.delayedCall(holdTime, () => {
                        if (!this.isResting) return;

                        // Phase 3: Exhale (shrink circle)
                        this.breathingText?.setText('Breathe Out...');
                        scene.tweens.add({
                            targets: { size: 1 },
                            size: 0.2,
                            duration: exhaleTime,
                            ease: 'Sine.easeInOut',
                            onUpdate: (tween) => {
                                this.updateBreathingCircle(scene, tween.targets[0].size);
                            },
                            onComplete: () => {
                                if (!this.isResting) return;

                                // Phase 4: Pause
                                this.breathingText?.setText('Rest...');
                                scene.time.delayedCall(pauseTime, () => {
                                    cycleCount++;
                                    if (this.isResting && cycleCount < totalCycles) {
                                        runCycle();
                                    } else if (this.isResting) {
                                        this.breathingText?.setText('Feel the calm...');
                                    }
                                });
                            }
                        });
                    });
                }
            });
        };

        runCycle();
    }

    /**
     * Create rest progress bar
     */
    createRestProgressBar(scene, width, height) {
        const barX = width / 2 - 100;
        const barY = height - 60;
        const barWidth = 200;
        const barHeight = 20;

        // Background
        const barBg = scene.add.graphics();
        barBg.fillStyle(0x333333, 0.8);
        barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 10);
        barBg.lineStyle(2, 0x666666);
        barBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 10);
        barBg.setScrollFactor(0);
        barBg.setDepth(4025);
        this.overlayElements.push(barBg);

        // Progress fill
        this.progressBar = scene.add.graphics();
        this.progressBar.setScrollFactor(0);
        this.progressBar.setDepth(4026);
        this.overlayElements.push(this.progressBar);
        this.progressBarConfig = { x: barX + 2, y: barY + 2, width: barWidth - 4, height: barHeight - 4 };

        // Label
        const label = scene.add.text(width / 2, barY - 15, 'Rest Progress', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4027);
        this.overlayElements.push(label);

        // Time remaining
        this.timeText = scene.add.text(width / 2, barY + barHeight + 10, '30s', {
            fontSize: '14px',
            color: '#FFD700'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4027);
        this.overlayElements.push(this.timeText);
    }

    /**
     * Update progress bar
     */
    updateProgressBar(progress) {
        if (!this.progressBar || !this.progressBarConfig) return;

        const { x, y, width, height } = this.progressBarConfig;
        const fillWidth = width * Math.min(1, progress);

        this.progressBar.clear();
        this.progressBar.fillStyle(0x00FFAA, 0.9);
        this.progressBar.fillRoundedRect(x, y, fillWidth, height, 8);

        // Update time text
        const remaining = Math.max(0, Math.ceil((this.restDuration - (Date.now() - this.restStartTime)) / 1000));
        if (this.timeText) {
            this.timeText.setText(`${remaining}s`);
        }
    }

    /**
     * Create cancel/skip button
     */
    createCancelButton(scene, width, height) {
        const btnX = width - 80;
        const btnY = 30;
        const btnWidth = 60;
        const btnHeight = 30;

        const btnBg = scene.add.graphics();
        btnBg.fillStyle(0x660000, 0.8);
        btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 5);
        btnBg.setScrollFactor(0);
        btnBg.setDepth(4030);
        this.overlayElements.push(btnBg);

        const btnText = scene.add.text(btnX + btnWidth / 2, btnY + btnHeight / 2, 'Skip', {
            fontSize: '14px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4031);
        this.overlayElements.push(btnText);

        const btnZone = scene.add.zone(btnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        btnZone.setInteractive({ useHandCursor: true });
        btnZone.setScrollFactor(0);
        btnZone.setDepth(4032);
        this.overlayElements.push(btnZone);

        btnZone.on('pointerdown', () => {
            this.endRest(scene, true); // true = skipped early
        });

        btnZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0xAA0000, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 5);
        });

        btnZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x660000, 0.8);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 5);
        });
    }

    /**
     * Start stat recovery timer
     */
    startStatRecovery(scene) {
        // Update every 500ms
        this.recoveryTimer = scene.time.addEvent({
            delay: 500,
            callback: () => this.updateRestProgress(scene),
            loop: true
        });
    }

    /**
     * Update rest progress and apply stat recovery
     */
    updateRestProgress(scene) {
        if (!this.isResting) return;

        const elapsed = Date.now() - this.restStartTime;
        const progress = Math.min(1, elapsed / this.restDuration);

        // Update progress bar
        this.updateProgressBar(progress);

        // Apply gradual stat recovery
        const recoveryPerTick = 100 / (this.restDuration / 500); // Full recovery over duration
        if (window.GameState) {
            const stats = window.GameState.get('creature.stats') || { happiness: 100, energy: 100, health: 100 };

            const newStats = {
                happiness: Math.min(100, (stats.happiness || 0) + recoveryPerTick * 0.5),
                energy: Math.min(100, (stats.energy || 0) + recoveryPerTick),
                health: Math.min(100, (stats.health || 0) + recoveryPerTick * 0.3)
            };

            window.GameState.set('creature.stats', newStats);

            this.sessionBonuses.happiness += recoveryPerTick * 0.5;
            this.sessionBonuses.energy += recoveryPerTick;
            this.sessionBonuses.health += recoveryPerTick * 0.3;
        }

        // Bonding points accumulate over time
        this.sessionBonuses.bondingPoints += 0.5;

        // Check if rest is complete
        if (progress >= 1) {
            this.endRest(scene, false);
        }
    }

    /**
     * End the rest session
     */
    endRest(scene, skipped = false) {
        if (!this.isResting) return;

        console.log('[CampfireRestSystem] Ending rest session', { skipped });
        this.isResting = false;

        // Stop recovery timer
        if (this.recoveryTimer) {
            this.recoveryTimer.remove();
            this.recoveryTimer = null;
        }

        // Calculate final bonuses
        const bonuses = {
            ...this.sessionBonuses,
            completed: !skipped
        };

        // Grant bonding reward if completed full session
        if (!skipped && bonuses.bondingPoints >= 25) {
            // Reward: Time-slow tool unlock progress
            const currentProgress = window.GameState?.get('bonding.timeSlowProgress') || 0;
            window.GameState?.set('bonding.timeSlowProgress', currentProgress + 1);

            // Check if tool is unlocked (requires 3 full rest sessions)
            if (currentProgress + 1 >= 3 && !window.GameState?.get('bonding.timeSlowUnlocked')) {
                window.GameState?.set('bonding.timeSlowUnlocked', true);
                bonuses.unlockedTimeSlow = true;
                console.log('[CampfireRestSystem] Time-slow tool unlocked!');
            }
        }

        if (!skipped) {
            window.GuardianResidents?.recordGuardianActivity?.(
                window.GameState,
                'campfireRests'
            );
        }

        // Show completion message
        this.showCompletionMessage(scene, bonuses, skipped);

        // Clean up overlay after delay
        scene.time.delayedCall(skipped ? 500 : 2500, () => {
            this.cleanupOverlay(scene);
        });

        // Emit rest ended event
        this.emit('restEnded', bonuses);

        // Stop meditation music
        if (window.AudioManager) {
            window.AudioManager.stopMeditationMusic();
        }

        // Play completion sound
        if (window.AudioManager) {
            if (skipped) {
                window.AudioManager.playButtonClick?.();
            } else {
                window.AudioManager.playAchievement?.();
            }
        }
    }

    /**
     * Show completion message
     */
    showCompletionMessage(scene, bonuses, skipped) {
        const { width, height } = scene.scale;

        // Fade out breathing UI
        if (this.breathingText) {
            scene.tweens.add({
                targets: this.breathingText,
                alpha: 0,
                duration: 300
            });
        }
        if (this.breathingCircle) {
            scene.tweens.add({
                targets: this.breathingCircle,
                alpha: 0,
                duration: 300
            });
        }

        const messageY = height * 0.2;

        if (skipped) {
            const skipText = scene.add.text(width / 2, messageY, 'Rest interrupted', {
                fontSize: '24px',
                color: '#FFAA00'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(4050);
            this.overlayElements.push(skipText);
        } else {
            // Completion celebration
            const completeText = scene.add.text(width / 2, messageY, 'Fully Rested!', {
                fontSize: '32px',
                color: '#00FF88',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(4050);
            this.overlayElements.push(completeText);

            // Bonus summary
            const bonusText = scene.add.text(width / 2, messageY + 50,
                `+${Math.round(bonuses.energy)} Energy  +${Math.round(bonuses.happiness)} Happiness  +${Math.round(bonuses.health)} Health`, {
                fontSize: '18px',
                color: '#FFD700'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(4050);
            this.overlayElements.push(bonusText);

            // Time-slow unlock notification
            if (bonuses.unlockedTimeSlow) {
                const unlockText = scene.add.text(width / 2, messageY + 90, 'Time-Slow ability unlocked!', {
                    fontSize: '20px',
                    color: '#FF00FF',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(4050);
                this.overlayElements.push(unlockText);

                // Sparkle effect
                if (window.FXLibrary) {
                    window.FXLibrary.stardustBurst?.(scene, width / 2, messageY + 90, {
                        count: 30,
                        color: [0xFF00FF, 0xFFD700, 0xFFFFFF],
                        duration: 2000
                    });
                }
            }

            // Particle celebration
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst?.(scene, width / 2, messageY, {
                    count: 20,
                    color: [0x00FF88, 0xFFD700],
                    duration: 1500
                });
            }
        }
    }

    /**
     * Clean up overlay elements
     */
    cleanupOverlay(scene) {
        console.log('[CampfireRestSystem] Cleaning up overlay');

        // Fade out all elements
        this.overlayElements.forEach(el => {
            if (el && el.destroy) {
                scene.tweens.add({
                    targets: el,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        if (el.removeAllListeners) el.removeAllListeners();
                        el.destroy();
                    }
                });
            }
        });

        this.overlayElements = [];
        this.breathingText = null;
        this.breathingCircle = null;
        this.progressBar = null;
        this.timeText = null;
        this.creatureSprite = null;
        this.currentRestScene = null;
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[CampfireRestSystem] Event listener error for ${event}:`, error);
                }
            });
        }
    }
}

// Create singleton and export
const campfireRestSystem = new CampfireRestSystem();

if (typeof window !== 'undefined') {
    window.CampfireRestSystem = campfireRestSystem;
}

export default campfireRestSystem;
