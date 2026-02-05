/**
 * CombatJuice - Visual and haptic feedback system for exciting combat
 *
 * Provides reusable methods for:
 * - Screen shake on impacts
 * - Haptic feedback for mobile
 * - Hit flash effects
 * - Damage numbers
 * - Combo counter system
 * - Attack telegraphs
 * - Slow-motion effects
 * - Phase transition effects
 */

export default class CombatJuice {
    constructor(scene) {
        this.scene = scene;

        // Combo system state
        this.comboCount = 0;
        this.comboTimer = null;
        this.comboTimeout = 2000; // 2 seconds to maintain combo
        this.comboDisplay = null;
        this.comboMultiplierDisplay = null;

        // Slow-mo state
        this.isSlowMo = false;
        this.originalTimeScale = 1;

        // Screen shake state
        this.shakeIntensity = 0;
        this.shakeDuration = 0;

        // Hit stop state (brief pause on impact)
        this.hitStopActive = false;
    }

    /**
     * Screen shake effect - makes impacts feel powerful
     * @param {number} intensity - Shake strength (1-10 scale, default 3)
     * @param {number} duration - Duration in ms (default 150)
     */
    screenShake(intensity = 3, duration = 150) {
        if (!this.scene || !this.scene.cameras || !this.scene.cameras.main) return;

        const camera = this.scene.cameras.main;

        // Scale intensity (1-10 maps to 2-20 pixels)
        const pixels = Math.min(intensity * 2, 20);

        camera.shake(duration, pixels / 1000);

        // Also trigger haptic feedback on mobile
        this.hapticFeedback(intensity > 5 ? 'heavy' : 'medium');

        console.log(`[CombatJuice] Screen shake: intensity=${intensity}, duration=${duration}ms`);
    }

    /**
     * Directional screen shake - shakes in direction of impact
     * @param {number} dirX - X direction (-1 to 1)
     * @param {number} dirY - Y direction (-1 to 1)
     * @param {number} intensity - Shake strength
     */
    directionalShake(dirX, dirY, intensity = 4) {
        if (!this.scene || !this.scene.cameras || !this.scene.cameras.main) return;

        const camera = this.scene.cameras.main;
        const offset = intensity * 3;

        // Push camera in impact direction then spring back
        this.scene.tweens.add({
            targets: camera,
            scrollX: camera.scrollX + (dirX * offset),
            scrollY: camera.scrollY + (dirY * offset),
            duration: 50,
            yoyo: true,
            ease: 'Quad.easeOut'
        });

        this.hapticFeedback('medium');
    }

    /**
     * Haptic feedback for mobile devices
     * @param {string} pattern - 'light', 'medium', 'heavy', or 'success'
     */
    hapticFeedback(pattern = 'medium') {
        // Check if Vibration API is available
        if (!navigator.vibrate) return;

        // Define vibration patterns (in milliseconds)
        const patterns = {
            light: [10],
            medium: [25],
            heavy: [50],
            success: [30, 50, 30],
            combo: [15, 30, 15, 30, 15],
            critical: [100],
            death: [50, 100, 50, 100, 100]
        };

        const vibrationPattern = patterns[pattern] || patterns.medium;

        try {
            navigator.vibrate(vibrationPattern);
        } catch (e) {
            // Vibration not supported or blocked
        }
    }

    /**
     * Hit flash effect - briefly tints target white/red
     * @param {Phaser.GameObjects.Sprite} target - The sprite to flash
     * @param {number} color - Flash color (default white 0xFFFFFF)
     * @param {number} duration - Flash duration in ms
     */
    hitFlash(target, color = 0xFFFFFF, duration = 100) {
        if (!target || !this.scene) return;

        // Store original tint
        const originalTint = target.tintTopLeft || 0xFFFFFF;

        // Apply flash tint
        target.setTint(color);

        // Reset after duration
        this.scene.time.delayedCall(duration, () => {
            if (target && target.active) {
                target.clearTint();
            }
        });
    }

    /**
     * Hit stop effect - brief pause on impact for emphasis
     * @param {number} duration - Pause duration in ms (default 50)
     */
    hitStop(duration = 50) {
        if (this.hitStopActive || !this.scene) return;

        this.hitStopActive = true;

        // Pause physics
        if (this.scene.physics && this.scene.physics.world) {
            this.scene.physics.world.pause();
        }

        // Resume after duration
        this.scene.time.delayedCall(duration, () => {
            if (this.scene && this.scene.physics && this.scene.physics.world) {
                this.scene.physics.world.resume();
            }
            this.hitStopActive = false;
        });
    }

    /**
     * Show floating damage number
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} damage - Damage amount
     * @param {boolean} isCritical - Whether it's a critical hit
     */
    showDamageNumber(x, y, damage, isCritical = false) {
        if (!this.scene) return;

        const fontSize = isCritical ? '32px' : '24px';
        const color = isCritical ? '#FF4444' : '#FFFFFF';
        const text = isCritical ? `💥${damage}!` : `${damage}`;

        const damageText = this.scene.add.text(x, y - 20, text, {
            fontSize: fontSize,
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(1000);

        // Animate: float up and fade out
        this.scene.tweens.add({
            targets: damageText,
            y: y - 80,
            alpha: 0,
            scale: isCritical ? 1.5 : 1.2,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => damageText.destroy()
        });

        // Add slight random horizontal drift
        this.scene.tweens.add({
            targets: damageText,
            x: x + Phaser.Math.Between(-30, 30),
            duration: 800,
            ease: 'Sine.easeOut'
        });
    }

    /**
     * Register a hit for the combo system
     * @param {number} damage - Damage dealt
     * @returns {object} - { combo: number, multiplier: number, bonus: number }
     */
    registerHit(damage) {
        this.comboCount++;

        // Reset combo timer
        if (this.comboTimer) {
            this.comboTimer.remove();
        }

        this.comboTimer = this.scene.time.delayedCall(this.comboTimeout, () => {
            this.resetCombo();
        });

        // Calculate multiplier (increases every 5 hits)
        const multiplier = 1 + Math.floor(this.comboCount / 5) * 0.25;
        const bonusDamage = Math.floor(damage * (multiplier - 1));

        // Update combo display
        this.updateComboDisplay();

        // Haptic feedback and sound for combos
        if (this.comboCount > 0 && this.comboCount % 5 === 0) {
            this.hapticFeedback('combo');
            this.screenShake(2, 100);
            // Play combo milestone sound
            if (window.AudioManager) {
                window.AudioManager.playComboMilestone();
            }
        } else {
            // Play regular combo hit sound
            if (window.AudioManager) {
                window.AudioManager.playComboHit();
            }
        }

        console.log(`[CombatJuice] Combo: ${this.comboCount}x, multiplier: ${multiplier}x`);

        return {
            combo: this.comboCount,
            multiplier: multiplier,
            bonus: bonusDamage
        };
    }

    /**
     * Update the combo counter display
     */
    updateComboDisplay() {
        if (!this.scene) return;

        const width = this.scene.cameras.main.width;

        // Create or update combo counter
        if (!this.comboDisplay) {
            this.comboDisplay = this.scene.add.text(width - 120, 80, '', {
                fontSize: '28px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setScrollFactor(0).setDepth(1000).setOrigin(0.5);

            this.comboMultiplierDisplay = this.scene.add.text(width - 120, 110, '', {
                fontSize: '18px',
                color: '#FF8C00',
                stroke: '#000000',
                strokeThickness: 3
            }).setScrollFactor(0).setDepth(1000).setOrigin(0.5);
        }

        // Update text
        this.comboDisplay.setText(`${this.comboCount} HIT${this.comboCount > 1 ? 'S' : ''}!`);

        const multiplier = 1 + Math.floor(this.comboCount / 5) * 0.25;
        if (multiplier > 1) {
            this.comboMultiplierDisplay.setText(`${multiplier.toFixed(2)}x DAMAGE`);
        } else {
            this.comboMultiplierDisplay.setText('');
        }

        // Pulse animation on update
        this.scene.tweens.add({
            targets: this.comboDisplay,
            scale: { from: 1.3, to: 1 },
            duration: 200,
            ease: 'Back.easeOut'
        });

        // Color changes based on combo level
        if (this.comboCount >= 20) {
            this.comboDisplay.setColor('#FF00FF'); // Purple for 20+
            this.comboMultiplierDisplay.setColor('#FF00FF');
        } else if (this.comboCount >= 10) {
            this.comboDisplay.setColor('#FF4444'); // Red for 10+
            this.comboMultiplierDisplay.setColor('#FF4444');
        } else if (this.comboCount >= 5) {
            this.comboDisplay.setColor('#FF8C00'); // Orange for 5+
            this.comboMultiplierDisplay.setColor('#FF8C00');
        } else {
            this.comboDisplay.setColor('#FFD700'); // Gold default
            this.comboMultiplierDisplay.setColor('#FF8C00');
        }
    }

    /**
     * Reset the combo counter
     */
    resetCombo() {
        if (this.comboCount > 5) {
            // Show combo end message
            this.showComboEnd(this.comboCount);
            // Play combo break sound
            if (window.AudioManager) {
                window.AudioManager.playComboBreak();
            }
        }

        this.comboCount = 0;

        // Fade out combo display
        if (this.comboDisplay) {
            this.scene.tweens.add({
                targets: [this.comboDisplay, this.comboMultiplierDisplay],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.comboDisplay) {
                        this.comboDisplay.setText('');
                        this.comboDisplay.setAlpha(1);
                    }
                    if (this.comboMultiplierDisplay) {
                        this.comboMultiplierDisplay.setText('');
                        this.comboMultiplierDisplay.setAlpha(1);
                    }
                }
            });
        }
    }

    /**
     * Show combo end message
     * @param {number} finalCombo - Final combo count
     */
    showComboEnd(finalCombo) {
        if (!this.scene) return;

        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        let message = '';
        let color = '#FFFFFF';

        if (finalCombo >= 20) {
            message = '🔥 INCREDIBLE! 🔥';
            color = '#FF00FF';
        } else if (finalCombo >= 15) {
            message = '⚡ AMAZING! ⚡';
            color = '#FF4444';
        } else if (finalCombo >= 10) {
            message = '✨ GREAT! ✨';
            color = '#FF8C00';
        } else {
            message = '👍 NICE!';
            color = '#FFD700';
        }

        const endText = this.scene.add.text(width / 2, height / 2 - 50, message, {
            fontSize: '36px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 5
        }).setScrollFactor(0).setOrigin(0.5).setDepth(1001).setAlpha(0);

        this.scene.tweens.add({
            targets: endText,
            alpha: 1,
            scale: { from: 0.5, to: 1.2 },
            duration: 300,
            yoyo: true,
            hold: 500,
            onComplete: () => endText.destroy()
        });
    }

    /**
     * Get current combo multiplier for damage calculations
     * @returns {number} - Current damage multiplier
     */
    getComboMultiplier() {
        return 1 + Math.floor(this.comboCount / 5) * 0.25;
    }

    /**
     * Attack telegraph - warning indicator before dangerous attacks
     * @param {Phaser.GameObjects.Sprite} attacker - The boss/enemy attacking
     * @param {string} attackType - Type of attack ('slam', 'charge', 'projectile', 'aoe')
     * @param {number} delay - Time before attack in ms (default 800)
     * @returns {Promise} - Resolves when telegraph is complete
     */
    attackTelegraph(attacker, attackType, delay = 800) {
        return new Promise((resolve) => {
            if (!this.scene || !attacker) {
                resolve();
                return;
            }

            // Play boss warning sound
            if (window.AudioManager) {
                window.AudioManager.playBossWarning();
            }

            // Warning flash on attacker
            const originalTint = attacker.tintTopLeft;

            // Create warning indicator
            const warningGraphics = this.scene.add.graphics();
            warningGraphics.setDepth(attacker.depth + 1);

            // Different visuals per attack type
            switch (attackType) {
                case 'slam':
                    // Ground pound - show impact zone
                    warningGraphics.fillStyle(0xFF0000, 0.3);
                    warningGraphics.fillCircle(attacker.x, attacker.y + 50, 100);
                    warningGraphics.lineStyle(3, 0xFF0000, 0.8);
                    warningGraphics.strokeCircle(attacker.x, attacker.y + 50, 100);
                    break;

                case 'charge':
                    // Charging attack - show direction arrow
                    const arrowX = attacker.flipX ? attacker.x - 150 : attacker.x + 150;
                    warningGraphics.fillStyle(0xFF4444, 0.5);
                    warningGraphics.fillTriangle(
                        attacker.x, attacker.y - 20,
                        attacker.x, attacker.y + 20,
                        arrowX, attacker.y
                    );
                    break;

                case 'projectile':
                    // Ranged attack - show aiming line
                    warningGraphics.lineStyle(4, 0xFF6600, 0.6);
                    const targetX = attacker.flipX ? attacker.x - 400 : attacker.x + 400;
                    warningGraphics.lineBetween(attacker.x, attacker.y, targetX, attacker.y);
                    break;

                case 'aoe':
                    // Area attack - show expanding danger zone
                    warningGraphics.fillStyle(0xFF0000, 0.2);
                    warningGraphics.fillCircle(attacker.x, attacker.y, 200);
                    warningGraphics.lineStyle(4, 0xFF0000, 0.8);
                    warningGraphics.strokeCircle(attacker.x, attacker.y, 200);
                    break;

                default:
                    warningGraphics.fillStyle(0xFF0000, 0.3);
                    warningGraphics.fillCircle(attacker.x, attacker.y, 80);
            }

            // Warning icon
            const warningIcon = this.scene.add.text(attacker.x, attacker.y - 80, '⚠️', {
                fontSize: '40px'
            }).setOrigin(0.5).setDepth(attacker.depth + 2);

            // Flash animation
            this.scene.tweens.add({
                targets: [warningGraphics, warningIcon],
                alpha: { from: 1, to: 0.3 },
                duration: 200,
                yoyo: true,
                repeat: Math.floor(delay / 400) - 1
            });

            // Attacker flashes red
            let flashCount = 0;
            const flashInterval = this.scene.time.addEvent({
                delay: 150,
                callback: () => {
                    if (attacker && attacker.active) {
                        attacker.setTint(flashCount % 2 === 0 ? 0xFF4444 : 0xFFFFFF);
                        flashCount++;
                    }
                },
                repeat: Math.floor(delay / 150)
            });

            // Cleanup after delay
            this.scene.time.delayedCall(delay, () => {
                warningGraphics.destroy();
                warningIcon.destroy();
                flashInterval.remove();
                if (attacker && attacker.active) {
                    attacker.clearTint();
                }
                resolve();
            });
        });
    }

    /**
     * Show glowing weak point on boss
     * @param {number} x - X position of weak point
     * @param {number} y - Y position of weak point
     * @param {number} radius - Size of weak point (default 30)
     * @returns {Phaser.GameObjects.Graphics} - The weak point graphic (destroy when done)
     */
    showWeakPoint(x, y, radius = 30) {
        if (!this.scene) return null;

        const weakPoint = this.scene.add.graphics();
        weakPoint.setDepth(999);

        // Golden glowing circle
        weakPoint.fillStyle(0xFFD700, 0.6);
        weakPoint.fillCircle(x, y, radius);
        weakPoint.lineStyle(3, 0xFFFFFF, 0.9);
        weakPoint.strokeCircle(x, y, radius);

        // Inner highlight
        weakPoint.fillStyle(0xFFFFFF, 0.4);
        weakPoint.fillCircle(x - radius * 0.2, y - radius * 0.2, radius * 0.3);

        // Pulsing animation
        this.scene.tweens.add({
            targets: weakPoint,
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            alpha: { from: 0.8, to: 0.4 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add "HIT ME!" text
        const hitText = this.scene.add.text(x, y - radius - 20, '⬇️ HIT!', {
            fontSize: '16px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(1000);

        // Bob animation for text
        this.scene.tweens.add({
            targets: hitText,
            y: y - radius - 30,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Store text reference for cleanup
        weakPoint.hitText = hitText;

        // Override destroy to also destroy text
        const originalDestroy = weakPoint.destroy.bind(weakPoint);
        weakPoint.destroy = () => {
            if (weakPoint.hitText) {
                weakPoint.hitText.destroy();
            }
            originalDestroy();
        };

        return weakPoint;
    }

    /**
     * Slow motion effect for dramatic moments
     * @param {number} scale - Time scale (0.1 = 10% speed, default 0.3)
     * @param {number} duration - How long to stay in slow-mo (ms)
     */
    slowMotion(scale = 0.3, duration = 1000) {
        if (!this.scene || this.isSlowMo) return;

        this.isSlowMo = true;
        this.originalTimeScale = this.scene.time.timeScale;

        // Slow down time
        this.scene.time.timeScale = scale;
        this.scene.physics.world.timeScale = 1 / scale;

        // Play slow-mo enter sound
        if (window.AudioManager) {
            window.AudioManager.playSlowmoEnter();
        }

        // Visual effect - slight zoom and color shift
        const camera = this.scene.cameras.main;

        this.scene.tweens.add({
            targets: camera,
            zoom: 1.05,
            duration: 200,
            ease: 'Quad.easeOut'
        });

        // Add subtle vignette effect
        const vignette = this.scene.add.graphics();
        const width = camera.width;
        const height = camera.height;

        vignette.fillStyle(0x000000, 0.3);
        vignette.fillRect(0, 0, width, height);
        vignette.setScrollFactor(0);
        vignette.setDepth(998);
        vignette.setAlpha(0);

        this.scene.tweens.add({
            targets: vignette,
            alpha: 0.4,
            duration: 200
        });

        // Resume normal speed after duration
        this.scene.time.delayedCall(duration * scale, () => {
            this.scene.time.timeScale = this.originalTimeScale;
            this.scene.physics.world.timeScale = 1;
            this.isSlowMo = false;

            // Play slow-mo exit sound
            if (window.AudioManager) {
                window.AudioManager.playSlowmoExit();
            }

            // Reset camera
            this.scene.tweens.add({
                targets: camera,
                zoom: 1,
                duration: 300,
                ease: 'Quad.easeOut'
            });

            // Fade out vignette
            this.scene.tweens.add({
                targets: vignette,
                alpha: 0,
                duration: 300,
                onComplete: () => vignette.destroy()
            });
        });

        console.log(`[CombatJuice] Slow motion: ${scale}x for ${duration}ms`);
    }

    /**
     * Boss phase transition effect
     * @param {Phaser.GameObjects.Sprite} boss - The boss sprite
     * @param {number} phase - New phase number
     * @param {string} phaseName - Name of the phase (e.g., "RAGE MODE")
     */
    phaseTransition(boss, phase, phaseName = '') {
        if (!this.scene || !boss) return;

        const camera = this.scene.cameras.main;
        const width = camera.width;
        const height = camera.height;

        // 1. Screen flash
        const flash = this.scene.add.graphics();
        flash.fillStyle(0xFFFFFF, 1);
        flash.fillRect(0, 0, width, height);
        flash.setScrollFactor(0);
        flash.setDepth(1000);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });

        // 2. Strong screen shake
        this.screenShake(8, 500);
        this.hapticFeedback('critical');

        // 3. Slow motion buildup
        this.slowMotion(0.2, 1500);

        // 4. Phase announcement
        const phaseText = this.scene.add.text(width / 2, height / 2, `PHASE ${phase}`, {
            fontSize: '64px',
            color: '#FF4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setScrollFactor(0).setOrigin(0.5).setDepth(1001).setAlpha(0).setScale(0.5);

        this.scene.tweens.add({
            targets: phaseText,
            alpha: 1,
            scale: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: phaseText,
                    alpha: 0,
                    y: height / 2 - 100,
                    delay: 1000,
                    duration: 500,
                    onComplete: () => phaseText.destroy()
                });
            }
        });

        // 5. Phase name subtitle
        if (phaseName) {
            const nameText = this.scene.add.text(width / 2, height / 2 + 50, phaseName, {
                fontSize: '32px',
                color: '#FFD700',
                fontStyle: 'italic',
                stroke: '#000000',
                strokeThickness: 4
            }).setScrollFactor(0).setOrigin(0.5).setDepth(1001).setAlpha(0);

            this.scene.tweens.add({
                targets: nameText,
                alpha: 1,
                delay: 200,
                duration: 300,
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: nameText,
                        alpha: 0,
                        delay: 1200,
                        duration: 500,
                        onComplete: () => nameText.destroy()
                    });
                }
            });
        }

        // 6. Boss transformation effect
        if (boss && boss.active) {
            // Color cycle through transformation
            const colors = [0xFFFFFF, 0xFF0000, 0xFF6600, 0xFFFF00, 0xFFFFFF];
            let colorIndex = 0;

            const transformFlash = this.scene.time.addEvent({
                delay: 100,
                callback: () => {
                    if (boss && boss.active) {
                        boss.setTint(colors[colorIndex % colors.length]);
                        colorIndex++;
                    }
                },
                repeat: 15
            });

            // Clear tint after transformation
            this.scene.time.delayedCall(1600, () => {
                if (boss && boss.active) {
                    boss.clearTint();
                }
            });

            // Scale up briefly
            this.scene.tweens.add({
                targets: boss,
                scaleX: boss.scaleX * 1.2,
                scaleY: boss.scaleY * 1.2,
                duration: 300,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
        }

        // 7. Particle burst (if FXLibrary available)
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, boss.x, boss.y, {
                count: 30,
                color: [0xFF4444, 0xFF6600, 0xFFD700],
                duration: 2000
            });
        }

        console.log(`[CombatJuice] Phase transition to phase ${phase}: ${phaseName}`);
    }

    /**
     * Victory celebration effect - slow-mo final hit
     * @param {Phaser.GameObjects.Sprite} enemy - The defeated enemy
     * @param {Phaser.GameObjects.Sprite} player - The player character
     */
    victoryFinisher(enemy, player) {
        if (!this.scene || !enemy) return;

        const camera = this.scene.cameras.main;
        const width = camera.width;
        const height = camera.height;

        // 1. Dramatic slow motion
        this.slowMotion(0.15, 2000);

        // 2. Camera zoom to action
        this.scene.tweens.add({
            targets: camera,
            zoom: 1.3,
            duration: 300,
            ease: 'Quad.easeOut'
        });

        // 3. Enemy defeat animation
        this.scene.tweens.add({
            targets: enemy,
            alpha: { from: 1, to: 0 },
            scaleX: enemy.scaleX * 1.5,
            scaleY: enemy.scaleY * 1.5,
            duration: 1500,
            ease: 'Quad.easeOut'
        });

        // 4. Victory text
        this.scene.time.delayedCall(500, () => {
            const victoryText = this.scene.add.text(width / 2, height / 2 - 80, '⭐ VICTORY! ⭐', {
                fontSize: '48px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 6
            }).setScrollFactor(0).setOrigin(0.5).setDepth(1002).setAlpha(0).setScale(0.5);

            this.scene.tweens.add({
                targets: victoryText,
                alpha: 1,
                scale: 1,
                duration: 500,
                ease: 'Back.easeOut'
            });
        });

        // 5. Coin fountain (delayed)
        this.scene.time.delayedCall(1000, () => {
            this.coinFountain(enemy.x, enemy.y, 20);
        });

        // 6. Particle explosion
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, enemy.x, enemy.y, {
                count: 50,
                color: [0xFFD700, 0xFFA500, 0xFFFFFF, 0xFF6600],
                duration: 3000
            });
        }

        // 7. Heavy haptic
        this.hapticFeedback('success');

        // 8. Strong screen shake
        this.scene.time.delayedCall(200, () => {
            this.screenShake(10, 300);
        });

        // 9. Victory fanfare sound
        if (window.AudioManager) {
            this.scene.time.delayedCall(800, () => {
                window.AudioManager.playVictoryFanfare();
            });
        }

        console.log('[CombatJuice] Victory finisher triggered!');
    }

    /**
     * Spawn a coin fountain effect
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} count - Number of coins
     */
    coinFountain(x, y, count = 10) {
        if (!this.scene) return;

        for (let i = 0; i < count; i++) {
            this.scene.time.delayedCall(i * 50, () => {
                const coin = this.scene.add.text(x, y, '🪙', {
                    fontSize: '24px'
                }).setOrigin(0.5).setDepth(999);

                // Random arc trajectory
                const angle = Phaser.Math.FloatBetween(-2.5, -0.5);
                const speed = Phaser.Math.FloatBetween(200, 400);
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                // Physics-like motion
                this.scene.tweens.add({
                    targets: coin,
                    x: x + vx * 0.8,
                    duration: 800,
                    ease: 'Sine.easeOut'
                });

                this.scene.tweens.add({
                    targets: coin,
                    y: y + vy * 0.4,
                    duration: 400,
                    ease: 'Quad.easeOut',
                    yoyo: true,
                    onComplete: () => {
                        // Fade out and destroy
                        this.scene.tweens.add({
                            targets: coin,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => coin.destroy()
                        });
                    }
                });

                // Spin
                this.scene.tweens.add({
                    targets: coin,
                    angle: Phaser.Math.Between(180, 540),
                    duration: 800
                });
            });
        }
    }

    /**
     * Enemy spawn warning effect
     * @param {number} x - Spawn X position
     * @param {number} y - Spawn Y position
     * @param {number} delay - Time before spawn (default 1000)
     * @returns {Promise} - Resolves when spawn completes
     */
    spawnWarning(x, y, delay = 1000) {
        return new Promise((resolve) => {
            if (!this.scene) {
                resolve();
                return;
            }

            // Warning circle
            const warning = this.scene.add.graphics();
            warning.lineStyle(4, 0xFF0000, 0.8);
            warning.strokeCircle(x, y, 40);
            warning.setDepth(100);

            // Pulsing animation
            this.scene.tweens.add({
                targets: warning,
                alpha: { from: 1, to: 0.3 },
                scaleX: { from: 1, to: 1.5 },
                scaleY: { from: 1, to: 1.5 },
                duration: delay / 3,
                repeat: 2,
                yoyo: true,
                onComplete: () => {
                    warning.destroy();

                    // Spawn flash
                    const flash = this.scene.add.graphics();
                    flash.fillStyle(0xFFFFFF, 0.8);
                    flash.fillCircle(x, y, 50);
                    flash.setDepth(101);

                    this.scene.tweens.add({
                        targets: flash,
                        alpha: 0,
                        scaleX: 2,
                        scaleY: 2,
                        duration: 200,
                        onComplete: () => {
                            flash.destroy();
                            resolve();
                        }
                    });
                }
            });
        });
    }

    /**
     * Cleanup all combat juice elements
     */
    cleanup() {
        if (this.comboTimer) {
            this.comboTimer.remove();
        }

        if (this.comboDisplay) {
            this.comboDisplay.destroy();
            this.comboDisplay = null;
        }

        if (this.comboMultiplierDisplay) {
            this.comboMultiplierDisplay.destroy();
            this.comboMultiplierDisplay = null;
        }

        this.comboCount = 0;
        this.isSlowMo = false;

        console.log('[CombatJuice] Cleanup complete');
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.CombatJuice = CombatJuice;
}
