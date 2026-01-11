/**
 * EvolutionCelebration - Spectacular celebration sequences for creature evolution
 *
 * Creates magical, memorable moments when creatures evolve through lifecycle stages.
 * Features: screen flash, particle bursts, camera effects, triumphant music, and modal.
 */

import evolutionConfig from '../config/evolution.json';

class EvolutionCelebrationManager {
    constructor() {
        this.config = evolutionConfig;
        this.isPlaying = false;
        this.currentScene = null;
        this.celebrationElements = [];
    }

    /**
     * Play evolution celebration sequence
     * @param {Phaser.Scene} scene - Active Phaser scene
     * @param {string} fromStage - Stage evolving from
     * @param {string} toStage - Stage evolving to
     * @param {Object} creatureData - Creature genetics and visual data
     * @returns {Promise} Resolves when celebration completes
     */
    async playCelebration(scene, fromStage, toStage, creatureData) {
        if (this.isPlaying) {
            console.log('[EvolutionCelebration] Already playing, skipping');
            return;
        }

        this.isPlaying = true;
        this.currentScene = scene;
        this.celebrationElements = [];

        const celebrationKey = `${fromStage}_to_${toStage}`;
        const celebrationConfig = this.config.evolution.celebrations[celebrationKey];

        if (!celebrationConfig) {
            console.warn(`[EvolutionCelebration] No config for ${celebrationKey}`);
            this.isPlaying = false;
            return;
        }

        console.log(`[EvolutionCelebration] Starting ${celebrationConfig.name} celebration`);

        try {
            // Phase 1: Pre-evolution buildup
            await this.playPreEvolutionEffects(scene, celebrationConfig);

            // Phase 2: The evolution moment
            await this.playEvolutionBurst(scene, celebrationConfig, fromStage, toStage);

            // Phase 3: Play fanfare
            this.playEvolutionFanfare(fromStage, toStage);

            // Phase 4: Particle celebration
            await this.playParticleCelebration(scene, celebrationConfig);

            // Phase 5: Show evolution modal
            await this.showEvolutionModal(scene, celebrationConfig, fromStage, toStage, creatureData);

        } catch (error) {
            console.error('[EvolutionCelebration] Error during celebration:', error);
        } finally {
            this.cleanup();
            this.isPlaying = false;
        }
    }

    /**
     * Pre-evolution buildup effects
     */
    async playPreEvolutionEffects(scene, config) {
        const { width, height } = scene.scale;

        return new Promise((resolve) => {
            // Create shimmering glow around creature
            const glowGraphics = scene.add.graphics();
            glowGraphics.setScrollFactor(0);
            glowGraphics.setDepth(5000);
            this.celebrationElements.push(glowGraphics);

            // Pulsing glow effect
            let pulseCount = 0;
            const maxPulses = 3;
            const pulseInterval = 400;

            const doPulse = () => {
                glowGraphics.clear();

                const pulseProgress = (pulseCount % 2 === 0) ? 1 : 0.5;
                const glowColor = Phaser.Display.Color.HexStringToColor(config.effects.glowColor || '#FFD700');

                // Draw expanding glow ring
                glowGraphics.lineStyle(4 * pulseProgress, glowColor.color, 0.6 * pulseProgress);
                glowGraphics.strokeCircle(width / 2, height / 2, 80 + (pulseCount * 20));

                pulseCount++;

                if (pulseCount < maxPulses * 2) {
                    scene.time.delayedCall(pulseInterval, doPulse);
                } else {
                    resolve();
                }
            };

            // Play shimmer sound
            if (window.AudioManager?.playButtonClick) {
                window.AudioManager.playButtonClick();
            }

            doPulse();
        });
    }

    /**
     * The main evolution burst moment
     */
    async playEvolutionBurst(scene, config, fromStage, toStage) {
        const { width, height } = scene.scale;
        const effects = config.effects;

        return new Promise((resolve) => {
            // Screen flash
            if (effects.screenFlash) {
                const flashColor = Phaser.Display.Color.HexStringToColor(effects.flashColor || '#FFFFFF');
                const flash = scene.add.graphics();
                flash.setScrollFactor(0);
                flash.setDepth(6000);
                flash.fillStyle(flashColor.color, 0.8);
                flash.fillRect(0, 0, width, height);
                this.celebrationElements.push(flash);

                scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: effects.flashDuration || 300,
                    ease: 'Power2',
                    onComplete: () => flash.destroy()
                });
            }

            // Camera shake
            if (effects.cameraShake) {
                scene.cameras.main.shake(
                    500,
                    effects.shakeIntensity || 0.005
                );
            }

            // Screen glow overlay
            if (effects.screenGlow) {
                const glowColor = Phaser.Display.Color.HexStringToColor(effects.glowColor || '#FFD700');
                const glow = scene.add.graphics();
                glow.setScrollFactor(0);
                glow.setDepth(4999);
                glow.fillStyle(glowColor.color, 0.3);
                glow.fillRect(0, 0, width, height);
                this.celebrationElements.push(glow);

                scene.tweens.add({
                    targets: glow,
                    alpha: 0,
                    duration: 2000,
                    ease: 'Power2'
                });
            }

            scene.time.delayedCall(effects.flashDuration || 300, resolve);
        });
    }

    /**
     * Play triumphant evolution fanfare
     */
    playEvolutionFanfare(fromStage, toStage) {
        if (!window.AudioManager) return;

        const transition = `${fromStage}_to_${toStage}`;

        switch (transition) {
            case 'baby_to_juvenile':
                window.AudioManager.playEvolutionSmall?.();
                break;
            case 'juvenile_to_adult':
                window.AudioManager.playEvolutionMajor?.();
                break;
            case 'adult_to_elder':
                window.AudioManager.playEvolutionElder?.();
                break;
            default:
                window.AudioManager.playLevelUp?.();
        }
    }

    /**
     * Particle burst celebration
     */
    async playParticleCelebration(scene, config) {
        const { width, height } = scene.scale;
        const effects = config.effects;

        if (!effects.particleBurst) return;

        return new Promise((resolve) => {
            const particleCount = effects.particleCount || 50;
            const colors = effects.particleColors || ['#FFD700', '#FFFFFF'];
            const centerX = width / 2;
            const centerY = height / 2;

            // Create multiple particle bursts
            for (let i = 0; i < particleCount; i++) {
                scene.time.delayedCall(i * 30, () => {
                    this.createParticle(scene, centerX, centerY, colors);
                });
            }

            // Also create firework-style bursts from corners
            this.createFireworkBurst(scene, width * 0.2, height * 0.3, colors);
            this.createFireworkBurst(scene, width * 0.8, height * 0.3, colors);
            this.createFireworkBurst(scene, width * 0.5, height * 0.2, colors);

            scene.time.delayedCall(2000, resolve);
        });
    }

    /**
     * Create a single animated particle
     */
    createParticle(scene, startX, startY, colors) {
        const colorHex = colors[Math.floor(Math.random() * colors.length)];
        const color = Phaser.Display.Color.HexStringToColor(colorHex);

        const particle = scene.add.graphics();
        particle.setScrollFactor(0);
        particle.setDepth(5500);

        const size = 4 + Math.random() * 6;
        const isCircle = Math.random() > 0.3;

        if (isCircle) {
            particle.fillStyle(color.color, 1);
            particle.fillCircle(0, 0, size);
        } else {
            // Star shape
            particle.fillStyle(color.color, 1);
            this.drawStar(particle, 0, 0, size, size * 0.5, 5);
        }

        particle.setPosition(startX, startY);
        this.celebrationElements.push(particle);

        // Random direction and speed
        const angle = Math.random() * Math.PI * 2;
        const speed = 200 + Math.random() * 300;
        const targetX = startX + Math.cos(angle) * speed;
        const targetY = startY + Math.sin(angle) * speed - 100; // Bias upward

        scene.tweens.add({
            targets: particle,
            x: targetX,
            y: targetY,
            alpha: 0,
            scale: { from: 1, to: 0.2 },
            rotation: Math.random() * Math.PI * 4,
            duration: 1500 + Math.random() * 1000,
            ease: 'Cubic.easeOut',
            onComplete: () => particle.destroy()
        });
    }

    /**
     * Create firework-style particle burst
     */
    createFireworkBurst(scene, x, y, colors) {
        const burstCount = 15;

        for (let i = 0; i < burstCount; i++) {
            scene.time.delayedCall(i * 50, () => {
                const colorHex = colors[Math.floor(Math.random() * colors.length)];
                const color = Phaser.Display.Color.HexStringToColor(colorHex);

                const particle = scene.add.graphics();
                particle.setScrollFactor(0);
                particle.setDepth(5500);

                const size = 3 + Math.random() * 4;
                particle.fillStyle(color.color, 1);
                particle.fillCircle(0, 0, size);
                particle.setPosition(x, y);
                this.celebrationElements.push(particle);

                const angle = (i / burstCount) * Math.PI * 2;
                const distance = 100 + Math.random() * 100;
                const targetX = x + Math.cos(angle) * distance;
                const targetY = y + Math.sin(angle) * distance;

                scene.tweens.add({
                    targets: particle,
                    x: targetX,
                    y: targetY,
                    alpha: 0,
                    scale: { from: 1, to: 0 },
                    duration: 800 + Math.random() * 400,
                    ease: 'Cubic.easeOut',
                    onComplete: () => particle.destroy()
                });
            });
        }
    }

    /**
     * Draw a star shape
     */
    drawStar(graphics, x, y, outerRadius, innerRadius, points) {
        const step = Math.PI / points;
        graphics.beginPath();

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = i * step - Math.PI / 2;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }

        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Show evolution modal with before/after comparison
     */
    async showEvolutionModal(scene, config, fromStage, toStage, creatureData) {
        const { width, height } = scene.scale;

        return new Promise((resolve) => {
            // Dark overlay
            const overlay = scene.add.graphics();
            overlay.setScrollFactor(0);
            overlay.setDepth(6000);
            overlay.fillStyle(0x000000, 0.7);
            overlay.fillRect(0, 0, width, height);
            overlay.setAlpha(0);
            this.celebrationElements.push(overlay);

            // Modal panel
            const panelWidth = Math.min(400, width - 40);
            const panelHeight = 320;
            const panelX = (width - panelWidth) / 2;
            const panelY = (height - panelHeight) / 2;

            const panel = scene.add.graphics();
            panel.setScrollFactor(0);
            panel.setDepth(6001);
            panel.setAlpha(0);
            this.celebrationElements.push(panel);

            // Panel background with gradient effect
            const glowColor = Phaser.Display.Color.HexStringToColor(config.effects.glowColor || '#FFD700');
            panel.fillStyle(0x1A1A3E, 0.95);
            panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
            panel.lineStyle(3, glowColor.color, 0.9);
            panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

            // Title with stage icon
            const fromConfig = this.config.stages[fromStage];
            const toConfig = this.config.stages[toStage];

            const title = scene.add.text(
                width / 2,
                panelY + 30,
                `${fromConfig.icon} → ${toConfig.icon}`,
                {
                    fontSize: '36px',
                    fontFamily: 'Arial, sans-serif'
                }
            );
            title.setOrigin(0.5);
            title.setScrollFactor(0);
            title.setDepth(6002);
            title.setAlpha(0);
            this.celebrationElements.push(title);

            // Celebration name
            const celebrationName = scene.add.text(
                width / 2,
                panelY + 75,
                config.name,
                {
                    fontSize: '24px',
                    fontFamily: 'Arial, sans-serif',
                    color: config.effects.glowColor || '#FFD700',
                    fontStyle: 'bold'
                }
            );
            celebrationName.setOrigin(0.5);
            celebrationName.setScrollFactor(0);
            celebrationName.setDepth(6002);
            celebrationName.setAlpha(0);
            this.celebrationElements.push(celebrationName);

            // Main message
            const message = scene.add.text(
                width / 2,
                panelY + 120,
                config.message,
                {
                    fontSize: '18px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#FFFFFF',
                    fontStyle: 'bold',
                    align: 'center',
                    wordWrap: { width: panelWidth - 40 }
                }
            );
            message.setOrigin(0.5);
            message.setScrollFactor(0);
            message.setDepth(6002);
            message.setAlpha(0);
            this.celebrationElements.push(message);

            // Sub message
            const subMessage = scene.add.text(
                width / 2,
                panelY + 160,
                config.subMessage,
                {
                    fontSize: '14px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#AAAAAA',
                    align: 'center',
                    wordWrap: { width: panelWidth - 40 }
                }
            );
            subMessage.setOrigin(0.5);
            subMessage.setScrollFactor(0);
            subMessage.setDepth(6002);
            subMessage.setAlpha(0);
            this.celebrationElements.push(subMessage);

            // Stage transition info
            const stageInfo = scene.add.text(
                width / 2,
                panelY + 210,
                `${fromConfig.displayName} → ${toConfig.displayName}`,
                {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#88CCFF'
                }
            );
            stageInfo.setOrigin(0.5);
            stageInfo.setScrollFactor(0);
            stageInfo.setDepth(6002);
            stageInfo.setAlpha(0);
            this.celebrationElements.push(stageInfo);

            // New abilities unlocked text (if adult)
            if (toStage === 'adult') {
                const abilitiesText = scene.add.text(
                    width / 2,
                    panelY + 240,
                    '✨ Full combat abilities unlocked!',
                    {
                        fontSize: '14px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#90EE90',
                        fontStyle: 'italic'
                    }
                );
                abilitiesText.setOrigin(0.5);
                abilitiesText.setScrollFactor(0);
                abilitiesText.setDepth(6002);
                abilitiesText.setAlpha(0);
                this.celebrationElements.push(abilitiesText);
            }

            // Continue button
            const buttonY = panelY + panelHeight - 50;
            const button = scene.add.graphics();
            button.setScrollFactor(0);
            button.setDepth(6002);
            button.fillStyle(glowColor.color, 0.8);
            button.fillRoundedRect(width / 2 - 60, buttonY - 15, 120, 35, 8);
            button.setAlpha(0);
            this.celebrationElements.push(button);

            const buttonText = scene.add.text(
                width / 2,
                buttonY,
                'Continue',
                {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#000000',
                    fontStyle: 'bold'
                }
            );
            buttonText.setOrigin(0.5);
            buttonText.setScrollFactor(0);
            buttonText.setDepth(6003);
            buttonText.setAlpha(0);
            this.celebrationElements.push(buttonText);

            // Button interaction zone
            const buttonZone = scene.add.zone(width / 2, buttonY, 120, 35);
            buttonZone.setScrollFactor(0);
            buttonZone.setDepth(6004);
            buttonZone.setInteractive({ useHandCursor: true });
            this.celebrationElements.push(buttonZone);

            buttonZone.on('pointerover', () => {
                button.clear();
                button.fillStyle(0xFFFFFF, 0.9);
                button.fillRoundedRect(width / 2 - 60, buttonY - 15, 120, 35, 8);
            });

            buttonZone.on('pointerout', () => {
                button.clear();
                button.fillStyle(glowColor.color, 0.8);
                button.fillRoundedRect(width / 2 - 60, buttonY - 15, 120, 35, 8);
            });

            buttonZone.on('pointerdown', () => {
                if (window.AudioManager?.playButtonClick) {
                    window.AudioManager.playButtonClick();
                }
                resolve();
            });

            // Animate modal in
            const allElements = [overlay, panel, title, celebrationName, message, subMessage, stageInfo, button, buttonText];

            scene.tweens.add({
                targets: allElements,
                alpha: 1,
                duration: 500,
                ease: 'Power2'
            });

            // Title bounce animation
            scene.tweens.add({
                targets: title,
                scale: { from: 0.5, to: 1 },
                duration: 600,
                ease: 'Back.easeOut',
                delay: 200
            });

            // Auto-close after duration if no interaction
            scene.time.delayedCall(config.duration + 5000, () => {
                if (this.isPlaying) {
                    resolve();
                }
            });
        });
    }

    /**
     * Cleanup all celebration elements
     */
    cleanup() {
        console.log('[EvolutionCelebration] Cleaning up');

        this.celebrationElements.forEach(element => {
            if (element && element.destroy) {
                try {
                    element.removeAllListeners?.();
                    element.destroy();
                } catch (e) {
                    // Already destroyed
                }
            }
        });

        this.celebrationElements = [];
        this.currentScene = null;
    }

    /**
     * Check if celebration is currently playing
     */
    isCelebrating() {
        return this.isPlaying;
    }

    /**
     * Force stop celebration (for scene transitions)
     */
    forceStop() {
        if (this.isPlaying) {
            console.log('[EvolutionCelebration] Force stopping');
            this.cleanup();
            this.isPlaying = false;
        }
    }
}

// Create singleton instance
const EvolutionCelebration = new EvolutionCelebrationManager();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.EvolutionCelebration = EvolutionCelebration;
}

// Export for module systems
export default EvolutionCelebration;
export { EvolutionCelebrationManager };
