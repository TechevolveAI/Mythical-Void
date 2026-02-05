/**
 * VictoryScene - The grand finale of Mythical Void
 *
 * Triggered when player defeats the Void Empress and collects all ship parts.
 * Features:
 * - Ship assembly animation
 * - Dramatic launch sequence
 * - Credits roll with game stats
 * - Celebration effects and music
 * - Option to continue playing or start new game
 */

import { devLog } from '../utils/devLogger.js';

export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
        this.elements = [];
        this.phase = 'assembly'; // assembly, launch, flight, credits, complete
    }

    init(data) {
        this.victoryData = data || {};
        devLog('[VictoryScene] Init with data:', data);
    }

    create() {
        const { width, height } = this.scale;

        // Stop other scenes
        const scenesToStop = ['FinalVoidLevel', 'HubWorldScene', 'GameScene'];
        scenesToStop.forEach(sceneKey => {
            try {
                if (this.scene.isActive(sceneKey)) {
                    this.scene.stop(sceneKey);
                }
            } catch (e) { /* Scene might not exist */ }
        });
        this.scene.bringToTop();

        // Get game stats for credits
        this.loadGameStats();

        // Create background
        this.createBackground(width, height);

        // Start the victory sequence
        this.startVictorySequence(width, height);

        devLog('[VictoryScene] Created - Victory sequence starting');
    }

    /**
     * Load game statistics for the credits
     */
    loadGameStats() {
        const state = window.GameState;

        this.gameStats = {
            creatureName: state?.get('creature.name') || 'Unknown Hero',
            creatureTexture: state?.get('creature.textureName'),
            totalPlayTime: this.formatPlayTime(state?.get('stats.totalPlayTime') || 0),
            levelsCompleted: state?.get('stats.levelsCompleted') || 4,
            bossesDefeated: state?.get('stats.bossesDefeated') || 4,
            coinsCollected: state?.get('stats.coinsCollected') || 0,
            achievements: state?.get('achievements.unlocked')?.length || 0,
            creatureLevel: state?.get('creature.level') || 1,
            rarity: state?.get('creature.genes.rarity') || 'common'
        };

        devLog('[VictoryScene] Game stats loaded:', this.gameStats);
    }

    /**
     * Format play time from seconds to readable string
     */
    formatPlayTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Create space background with stars
     */
    createBackground(width, height) {
        // Deep space gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x000011, 0x000011, 0x0a0a2e, 0x0a0a2e, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Create dense starfield
        this.stars = [];
        for (let i = 0; i < 200; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 0.5 + Math.random() * 2;
            const alpha = 0.3 + Math.random() * 0.7;
            const color = Phaser.Display.Color.RandomRGB(200, 255).color;

            star.fillStyle(color, alpha);
            star.fillCircle(x, y, size);
            star.setDepth(1);
            star.baseX = x;
            star.baseY = y;
            this.stars.push(star);
            this.elements.push(star);

            // Twinkle
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.3 },
                duration: 1000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }

        // Distant nebula clouds
        this.createNebulaClouds(width, height);
    }

    /**
     * Create colorful nebula clouds in background
     */
    createNebulaClouds(width, height) {
        const nebulaColors = [0x4B0082, 0x9370DB, 0x1E90FF, 0x00CED1, 0xFF69B4];

        for (let i = 0; i < 5; i++) {
            const nebula = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 100 + Math.random() * 200;

            nebula.fillStyle(nebulaColors[i], 0.1);
            nebula.fillCircle(x, y, size);
            nebula.fillStyle(nebulaColors[(i + 1) % 5], 0.05);
            nebula.fillCircle(x + 20, y + 20, size * 0.8);
            nebula.setDepth(2);
            this.elements.push(nebula);
        }
    }

    /**
     * Start the victory sequence
     */
    startVictorySequence(width, height) {
        // Phase 1: Ship Assembly (0-5s)
        this.showAssemblyPhase(width, height);

        // Phase 2: Launch Sequence (5-10s)
        this.time.delayedCall(5000, () => {
            this.phase = 'launch';
            this.showLaunchPhase(width, height);
        });

        // Phase 3: Flight through space (10-18s)
        this.time.delayedCall(10000, () => {
            this.phase = 'flight';
            this.showFlightPhase(width, height);
        });

        // Phase 4: Credits (18-35s)
        this.time.delayedCall(18000, () => {
            this.phase = 'credits';
            this.showCreditsPhase(width, height);
        });

        // Phase 5: Complete (35s+)
        this.time.delayedCall(35000, () => {
            this.phase = 'complete';
            this.showCompletePhase(width, height);
        });
    }

    /**
     * Phase 1: Ship Assembly Animation
     */
    showAssemblyPhase(width, height) {
        // Title
        const title = this.add.text(width / 2, height * 0.1, 'SHIP ASSEMBLY COMPLETE', {
            fontSize: Math.min(28, width * 0.07) + 'px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setDepth(100);
        this.elements.push(title);

        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: 1000
        });

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.();
        }

        // Ship parts flying in from edges (matches SHIP_PART_DEFINITIONS)
        const partNames = [
            { name: 'Crystal Core', emoji: '🔮', color: 0x7B68EE },
            { name: 'Dimensional Drive', emoji: '⚙️', color: 0x1E90FF },
            { name: 'Forest Core', emoji: '🌳', color: 0x32CD32 },
            { name: 'Aurora Reactor', emoji: '✨', color: 0x00FFFF },
            { name: 'Command Module', emoji: '👑', color: 0xFFD700 }
        ];

        const centerX = width / 2;
        const centerY = height / 2;

        partNames.forEach((part, index) => {
            const angle = (index / partNames.length) * Math.PI * 2;
            const startX = centerX + Math.cos(angle) * (width / 2 + 100);
            const startY = centerY + Math.sin(angle) * (height / 2 + 100);

            // Part sprite
            const partGraphic = this.add.graphics();
            partGraphic.fillStyle(part.color, 1);
            partGraphic.fillCircle(0, 0, 30);
            partGraphic.lineStyle(3, 0xFFFFFF, 0.8);
            partGraphic.strokeCircle(0, 0, 30);
            partGraphic.setPosition(startX, startY);
            partGraphic.setDepth(50);
            this.elements.push(partGraphic);

            // Part label
            const label = this.add.text(startX, startY, part.emoji, {
                fontSize: '24px'
            }).setOrigin(0.5).setDepth(51);
            this.elements.push(label);

            // Animate part flying to center
            this.time.delayedCall(500 + index * 600, () => {
                this.tweens.add({
                    targets: [partGraphic, label],
                    x: centerX,
                    y: centerY,
                    duration: 1500,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        // Flash effect on arrival
                        this.createPartArrivalEffect(centerX, centerY, part.color);
                        partGraphic.destroy();
                        label.destroy();

                        if (window.AudioManager) {
                            window.AudioManager.playCoinCollect?.();
                        }
                    }
                });
            });
        });

        // Build assembled ship at center after all parts arrive
        this.time.delayedCall(4500, () => {
            this.createAssembledShip(centerX, centerY);
        });
    }

    /**
     * Create flash effect when part arrives
     */
    createPartArrivalEffect(x, y, color) {
        const flash = this.add.graphics();
        flash.fillStyle(color, 0.8);
        flash.fillCircle(x, y, 10);
        flash.setDepth(49);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 3,
            duration: 500,
            onComplete: () => flash.destroy()
        });
    }

    /**
     * Create the assembled ship sprite
     */
    createAssembledShip(x, y) {
        this.ship = this.add.graphics();
        this.ship.setPosition(x, y);
        this.ship.setDepth(60);
        this.ship.setScale(0);

        // Draw ship body (stylized rocket)
        // Main hull
        this.ship.fillStyle(0x4169E1, 1);
        this.ship.fillTriangle(0, -60, -25, 30, 25, 30); // Nose cone
        this.ship.fillRect(-25, 30, 50, 50); // Body

        // Wings
        this.ship.fillStyle(0x32CD32, 1);
        this.ship.fillTriangle(-25, 30, -50, 80, -25, 80); // Left wing
        this.ship.fillTriangle(25, 30, 50, 80, 25, 80); // Right wing

        // Window
        this.ship.fillStyle(0x00FFFF, 0.8);
        this.ship.fillCircle(0, 20, 12);

        // Engine glow
        this.ship.fillStyle(0xFFD700, 1);
        this.ship.fillRect(-15, 80, 30, 10);

        this.elements.push(this.ship);

        // Scale in with bounce
        this.tweens.add({
            targets: this.ship,
            scale: 1.2,
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: this.ship,
                    scale: 1,
                    duration: 200
                });
            }
        });

        // Add particle glow around ship
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst?.(this, x, y, {
                count: 30,
                color: [0xFFD700, 0x00FFFF, 0x32CD32],
                duration: 2000
            });
        }
    }

    /**
     * Phase 2: Launch Sequence
     */
    showLaunchPhase(width, height) {
        // Update title
        const launchTitle = this.add.text(width / 2, height * 0.1, 'INITIATING LAUNCH', {
            fontSize: Math.min(28, width * 0.07) + 'px',
            color: '#FF6B35',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setDepth(100);
        this.elements.push(launchTitle);

        this.tweens.add({
            targets: launchTitle,
            alpha: 1,
            duration: 500
        });

        // Countdown
        const countdown = this.add.text(width / 2, height * 0.85, '', {
            fontSize: '48px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#FF6B35',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100);
        this.elements.push(countdown);

        // Play countdown
        [3, 2, 1].forEach((num, i) => {
            this.time.delayedCall(i * 1000 + 500, () => {
                countdown.setText(num.toString());
                countdown.setScale(1.5);
                this.tweens.add({
                    targets: countdown,
                    scale: 1,
                    duration: 800
                });
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick?.();
                }
            });
        });

        // LAUNCH!
        this.time.delayedCall(4000, () => {
            countdown.setText('LAUNCH!');
            countdown.setColor('#FFD700');

            // Screen shake
            this.cameras.main.shake(500, 0.02);

            // Engine fire effect
            this.createEngineFlame();

            // Ship starts moving up
            if (this.ship) {
                this.tweens.add({
                    targets: this.ship,
                    y: -200,
                    duration: 2000,
                    ease: 'Cubic.easeIn'
                });
            }

            if (window.AudioManager) {
                window.AudioManager.playLevelUp?.();
            }
        });
    }

    /**
     * Create engine flame effect
     */
    createEngineFlame() {
        if (!this.ship) return;

        this.engineFlame = this.add.graphics();
        this.engineFlame.setPosition(this.ship.x, this.ship.y + 90);
        this.engineFlame.setDepth(55);
        this.elements.push(this.engineFlame);

        // Animate flame
        this.time.addEvent({
            delay: 50,
            repeat: 60,
            callback: () => {
                if (!this.engineFlame) return;

                this.engineFlame.clear();
                const flameHeight = 20 + Math.random() * 40;
                const flameWidth = 20 + Math.random() * 10;

                // Outer flame (orange)
                this.engineFlame.fillStyle(0xFF6B35, 0.8);
                this.engineFlame.fillTriangle(
                    -flameWidth, 0,
                    flameWidth, 0,
                    0, flameHeight
                );

                // Inner flame (yellow)
                this.engineFlame.fillStyle(0xFFD700, 0.9);
                this.engineFlame.fillTriangle(
                    -flameWidth * 0.5, 0,
                    flameWidth * 0.5, 0,
                    0, flameHeight * 0.7
                );

                // Follow ship
                if (this.ship) {
                    this.engineFlame.setPosition(this.ship.x, this.ship.y + 90);
                }
            }
        });
    }

    /**
     * Phase 3: Flight through space
     */
    showFlightPhase(width, height) {
        // Clear previous elements
        this.clearNonEssentialElements();

        // Create ship flying view
        this.ship = this.add.graphics();
        this.ship.setPosition(width / 2, height * 0.7);
        this.ship.setDepth(60);
        this.ship.setScale(0.8);

        // Redraw ship
        this.ship.fillStyle(0x4169E1, 1);
        this.ship.fillTriangle(0, -60, -25, 30, 25, 30);
        this.ship.fillRect(-25, 30, 50, 50);
        this.ship.fillStyle(0x32CD32, 1);
        this.ship.fillTriangle(-25, 30, -50, 80, -25, 80);
        this.ship.fillTriangle(25, 30, 50, 80, 25, 80);
        this.ship.fillStyle(0x00FFFF, 0.8);
        this.ship.fillCircle(0, 20, 12);
        this.ship.fillStyle(0xFFD700, 1);
        this.ship.fillRect(-15, 80, 30, 10);

        this.elements.push(this.ship);

        // Creature in ship window
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(width / 2, height * 0.7 + 15, this.gameStats.creatureTexture);
            creature.setScale(0.3);
            creature.setDepth(61);
            this.elements.push(creature);
        }

        // Flying text
        const flyingText = this.add.text(width / 2, height * 0.15, 'JOURNEY TO THE STARS', {
            fontSize: Math.min(24, width * 0.06) + 'px',
            color: '#E8D5FF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0).setDepth(100);
        this.elements.push(flyingText);

        this.tweens.add({
            targets: flyingText,
            alpha: 1,
            duration: 1000
        });

        // Animate stars flying past (parallax)
        this.stars.forEach(star => {
            if (star && star.baseY !== undefined) {
                this.tweens.add({
                    targets: star,
                    y: star.baseY + height,
                    duration: 3000 + Math.random() * 2000,
                    repeat: 2,
                    onRepeat: () => {
                        if (star) {
                            star.y = -50;
                        }
                    }
                });
            }
        });

        // Ship bobbing
        this.tweens.add({
            targets: this.ship,
            y: height * 0.7 - 10,
            x: width / 2 + 5,
            duration: 2000,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
        });

        // Engine trail
        this.createEngineTrail(width, height);
    }

    /**
     * Create engine trail particles
     */
    createEngineTrail(width, height) {
        this.time.addEvent({
            delay: 100,
            repeat: 70,
            callback: () => {
                if (!this.ship) return;

                const particle = this.add.graphics();
                particle.fillStyle(0xFFD700, 0.8);
                particle.fillCircle(0, 0, 5 + Math.random() * 5);
                particle.setPosition(
                    this.ship.x + (Math.random() - 0.5) * 20,
                    this.ship.y + 95
                );
                particle.setDepth(50);

                this.tweens.add({
                    targets: particle,
                    y: particle.y + 200,
                    alpha: 0,
                    scale: 0.1,
                    duration: 1000,
                    onComplete: () => particle.destroy()
                });
            }
        });
    }

    /**
     * Phase 4: Credits Roll - Professional game credits
     */
    showCreditsPhase(width, height) {
        // Fade everything to darker
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(90);
        this.elements.push(overlay);

        this.tweens.add({
            targets: overlay,
            alpha: 0.8,
            duration: 2000
        });

        // Credits container - scrolling from bottom
        const creditsY = height + 100;
        const credits = [];
        const lineHeight = 40;
        const sectionGap = 60;
        let currentY = creditsY;

        // ═══════════════════════════════════════════════════════════
        // MAIN TITLE - MYTHICAL VOID™
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '✦ MYTHICAL VOID™ ✦', {
            fontSize: '42px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#4B0082',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 1.5;

        credits.push(this.add.text(width / 2, currentY, 'Your creature. Your journey. Your choice.', {
            fontSize: '18px',
            color: '#CE93D8',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100));
        currentY += sectionGap;

        // ═══════════════════════════════════════════════════════════
        // YOUR HERO SECTION
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '— YOUR HERO —', {
            fontSize: '22px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight;

        credits.push(this.add.text(width / 2, currentY, this.gameStats.creatureName, {
            fontSize: '36px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight;

        credits.push(this.add.text(width / 2, currentY, `Level ${this.gameStats.creatureLevel} • ${this.gameStats.rarity.toUpperCase()} Rarity`, {
            fontSize: '16px',
            color: '#DA70D6'
        }).setOrigin(0.5).setDepth(100));
        currentY += sectionGap;

        // ═══════════════════════════════════════════════════════════
        // JOURNEY STATISTICS
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '— JOURNEY STATISTICS —', {
            fontSize: '22px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight;

        const stats = [
            ['Realms Conquered', `${this.gameStats.levelsCompleted}`],
            ['Guardians Defeated', `${this.gameStats.bossesDefeated}`],
            ['Cosmic Coins', `${this.gameStats.coinsCollected}`],
            ['Achievements', `${this.gameStats.achievements}`],
            ['Time in the Void', this.gameStats.totalPlayTime]
        ];

        stats.forEach(([label, value]) => {
            credits.push(this.add.text(width / 2 - 80, currentY, label, {
                fontSize: '16px',
                color: '#B8A9C9'
            }).setOrigin(1, 0.5).setDepth(100));
            credits.push(this.add.text(width / 2 + 80, currentY, value, {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0, 0.5).setDepth(100));
            currentY += lineHeight * 0.8;
        });
        currentY += sectionGap * 0.5;

        // ═══════════════════════════════════════════════════════════
        // DEVELOPMENT TEAM
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '— CREATED BY —', {
            fontSize: '22px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 1.2;

        // Kevin Murphy
        credits.push(this.add.text(width / 2, currentY, 'Kevin Murphy', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.7;

        credits.push(this.add.text(width / 2, currentY, 'Creator & Lead Developer', {
            fontSize: '14px',
            color: '#B8A9C9'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 1.2;

        // CAYDEN Murphy
        credits.push(this.add.text(width / 2, currentY, 'CAYDEN Murphy', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.7;

        credits.push(this.add.text(width / 2, currentY, 'Creative Director & Game Designer', {
            fontSize: '14px',
            color: '#B8A9C9'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.5;

        credits.push(this.add.text(width / 2, currentY, '(Age 8)', {
            fontSize: '12px',
            color: '#9370DB',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100));
        currentY += sectionGap;

        // ═══════════════════════════════════════════════════════════
        // SPECIAL THANKS
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '— SPECIAL THANKS —', {
            fontSize: '22px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight;

        const thanks = [
            'All our early players & testers',
            'The Phaser.js community',
            'NASA for space weather data',
            'You, for playing!'
        ];

        thanks.forEach(text => {
            credits.push(this.add.text(width / 2, currentY, text, {
                fontSize: '14px',
                color: '#B8A9C9'
            }).setOrigin(0.5).setDepth(100));
            currentY += lineHeight * 0.7;
        });
        currentY += sectionGap * 0.5;

        // ═══════════════════════════════════════════════════════════
        // TECHNOLOGY
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, '— POWERED BY —', {
            fontSize: '18px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.8;

        credits.push(this.add.text(width / 2, currentY, 'Phaser 3 • Vite • Claude AI', {
            fontSize: '14px',
            color: '#8B7FBB'
        }).setOrigin(0.5).setDepth(100));
        currentY += sectionGap;

        // ═══════════════════════════════════════════════════════════
        // FINAL MESSAGE
        // ═══════════════════════════════════════════════════════════
        credits.push(this.add.text(width / 2, currentY, `${this.gameStats.creatureName}'s story`, {
            fontSize: '20px',
            color: '#CE93D8',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.8;

        credits.push(this.add.text(width / 2, currentY, 'is just beginning...', {
            fontSize: '20px',
            color: '#CE93D8',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100));
        currentY += sectionGap;

        // Copyright
        credits.push(this.add.text(width / 2, currentY, `© ${new Date().getFullYear()} TechevolveAI`, {
            fontSize: '12px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.6;

        credits.push(this.add.text(width / 2, currentY, 'techevolveai.com', {
            fontSize: '11px',
            color: '#7B68EE'
        }).setOrigin(0.5).setDepth(100));
        currentY += lineHeight * 0.5;

        credits.push(this.add.text(width / 2, currentY, 'MYTHICAL VOID™ is a trademark of TechevolveAI', {
            fontSize: '10px',
            color: '#555555'
        }).setOrigin(0.5).setDepth(100));

        this.elements.push(...credits);

        // Scroll credits up
        const scrollDistance = currentY - height * 0.3;
        credits.forEach(credit => {
            this.tweens.add({
                targets: credit,
                y: credit.y - scrollDistance,
                duration: 18000,
                ease: 'Linear'
            });
        });
    }

    /**
     * Phase 5: Complete - Show continue button, then choice scene
     */
    showCompletePhase(width, height) {
        // Mark victory in GameState
        window.GameState?.set('game.victoryAchieved', true);
        window.GameState?.set('game.victoryDate', new Date().toISOString());
        window.GameState?.save();

        // Final message with creature
        const finalPanel = this.add.graphics();
        finalPanel.fillStyle(0x1A1A3E, 0.95);
        finalPanel.fillRoundedRect(width * 0.1, height * 0.25, width * 0.8, height * 0.5, 20);
        finalPanel.lineStyle(3, 0xFFD700, 1);
        finalPanel.strokeRoundedRect(width * 0.1, height * 0.25, width * 0.8, height * 0.5, 20);
        finalPanel.setDepth(200);
        this.elements.push(finalPanel);

        // Creature sprite
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(width / 2, height * 0.38, this.gameStats.creatureTexture);
            creature.setScale(0.7);
            creature.setDepth(201);
            this.elements.push(creature);

            // Breathing animation
            this.tweens.add({
                targets: creature,
                scaleY: 0.75,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Victory message
        const victoryMsg = this.add.text(width / 2, height * 0.52,
            `${this.gameStats.creatureName} saved the cosmos!`, {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(victoryMsg);

        const subMsg = this.add.text(width / 2, height * 0.57,
            'The ship is ready. What happens next?', {
            fontSize: '14px',
            color: '#CE93D8',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(subMsg);

        // Continue button - leads to choice scene
        const buttonY = height * 0.67;
        this.createButton(
            width / 2, buttonY,
            'Continue...', 0x7B68EE,
            () => this.showChoiceScene()
        );

        // Play celebration
        if (window.AudioManager) {
            window.AudioManager.playAchievement?.();
        }

        // Unlock achievement
        if (window.AchievementSystem) {
            window.AchievementSystem.unlock?.('VOID_CONQUEROR');
        }
    }

    /**
     * Show the big choice: Return to Earth or Stay in the Void
     */
    showChoiceScene() {
        const { width, height } = this.scale;

        // Clear previous elements
        this.elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.elements = [];

        // Create atmospheric background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0D0B1E, 0x0D0B1E, 0x2D1B4E, 0x2D1B4E, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Stars
        for (let i = 0; i < 100; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            star.fillStyle(0xFFFFFF, 0.3 + Math.random() * 0.7);
            star.fillCircle(x, y, 0.5 + Math.random() * 1.5);
            star.setDepth(1);
            this.elements.push(star);
        }

        // Title panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 0.9);
        panel.fillRoundedRect(width * 0.08, height * 0.1, width * 0.84, height * 0.8, 20);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(width * 0.08, height * 0.1, width * 0.84, height * 0.8, 20);
        panel.setDepth(100);
        this.elements.push(panel);

        // Title
        const title = this.add.text(width / 2, height * 0.18, 'THE SHIP IS READY', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // Creature in center
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(width / 2, height * 0.35, this.gameStats.creatureTexture);
            creature.setScale(0.6);
            creature.setDepth(101);
            this.elements.push(creature);

            this.tweens.add({
                targets: creature,
                y: height * 0.35 - 5,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Narrative text
        const narrative = this.add.text(width / 2, height * 0.48,
            `${this.gameStats.creatureName} looks at you with trusting eyes.\nYou've been through so much together.\n\nNow you must choose...`, {
            fontSize: '14px',
            color: '#E8D5FF',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(narrative);

        // Choice buttons
        const btnY = height * 0.65;
        const btnWidth = Math.min(150, width * 0.35);
        const btnGap = 20;

        // Return to Earth button
        this.createChoiceButton(
            width / 2 - btnWidth / 2 - btnGap, btnY,
            '🌍 Return to Earth', 0x1E90FF,
            () => this.showComingSoonTeaser('earth')
        );

        // Stay in the Void button
        this.createChoiceButton(
            width / 2 + btnWidth / 2 + btnGap, btnY,
            '✨ Stay in the Void', 0x9400D3,
            () => this.showComingSoonTeaser('void')
        );

        // Hint text
        const hint = this.add.text(width / 2, height * 0.82,
            'What will you choose?', {
            fontSize: '12px',
            color: '#8B7FBB',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(hint);

        // Pulse hint
        this.tweens.add({
            targets: hint,
            alpha: { from: 1, to: 0.5 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create a choice button (larger than regular buttons)
     */
    createChoiceButton(x, y, text, color, callback) {
        const { width } = this.scale;
        const btnWidth = Math.min(150, width * 0.35);
        const btnHeight = 60;

        const btn = this.add.graphics();
        btn.fillStyle(color, 1);
        btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        btn.lineStyle(3, 0xFFFFFF, 0.3);
        btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        btn.setDepth(102);
        this.elements.push(btn);

        const btnText = this.add.text(x, y + btnHeight / 2, text, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(103);
        this.elements.push(btnText);

        const zone = this.add.zone(x, y + btnHeight / 2, btnWidth, btnHeight)
            .setInteractive({ cursor: 'pointer' })
            .setDepth(104);

        zone.on('pointerover', () => {
            btn.clear();
            btn.fillStyle(Phaser.Display.Color.GetColor(
                Math.min(255, ((color >> 16) & 0xFF) + 40),
                Math.min(255, ((color >> 8) & 0xFF) + 40),
                Math.min(255, (color & 0xFF) + 40)
            ), 1);
            btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
            btn.lineStyle(3, 0xFFD700, 1);
            btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        });

        zone.on('pointerout', () => {
            btn.clear();
            btn.fillStyle(color, 1);
            btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
            btn.lineStyle(3, 0xFFFFFF, 0.3);
            btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        });

        zone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick?.();
            }
            callback();
        });

        this.elements.push(zone);
    }

    /**
     * Show the "Coming Soon" teaser for sequels
     */
    showComingSoonTeaser(choice) {
        const { width, height } = this.scale;

        // Clear previous elements
        this.elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.elements = [];

        // Beautiful gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0D0B1E, 0x0D0B1E, 0x1A0A2E, 0x2D1B4E, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Subtle stars
        for (let i = 0; i < 80; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * height;
            star.fillStyle(0xFFFFFF, 0.2 + Math.random() * 0.5);
            star.fillCircle(x, y, 0.5 + Math.random() * 1);
            star.setDepth(1);
            this.elements.push(star);
        }

        // Main panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(width * 0.05, height * 0.08, width * 0.9, height * 0.84, 20);
        panel.lineStyle(4, 0x7B68EE);
        panel.strokeRoundedRect(width * 0.05, height * 0.08, width * 0.9, height * 0.84, 20);
        panel.setDepth(100);
        this.elements.push(panel);

        // Title based on choice
        const choiceTitle = choice === 'earth'
            ? '🌍 Journey to Earth'
            : '✨ Life Among the Stars';

        const title = this.add.text(width / 2, height * 0.16, choiceTitle, {
            fontSize: '24px',
            color: choice === 'earth' ? '#1E90FF' : '#DA70D6',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // Coming Soon banner
        const banner = this.add.text(width / 2, height * 0.24, '🚀 COMING SOON 🚀', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(banner);

        // Pulsing animation
        this.tweens.add({
            targets: banner,
            scale: { from: 1, to: 1.05 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Creature
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(width / 2, height * 0.38, this.gameStats.creatureTexture);
            creature.setScale(0.5);
            creature.setDepth(101);
            this.elements.push(creature);

            this.tweens.add({
                targets: creature,
                y: height * 0.38 - 5,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Description text
        const description = choice === 'earth'
            ? `What awaits on Earth?\n\nWill ${this.gameStats.creatureName} be safe?\nOr will they want to study your friend...?`
            : `A new life in the Void awaits.\n\nBut Earth knows about this place now.\nThey will come looking for you...`;

        const descText = this.add.text(width / 2, height * 0.52, description, {
            fontSize: '14px',
            color: '#E8D5FF',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(descText);

        // Sequel teasers
        const sequelY = height * 0.65;

        const sequelTitle = this.add.text(width / 2, sequelY, 'Future Adventures:', {
            fontSize: '16px',
            color: '#9B7FEE',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(sequelTitle);

        // Two sequel options
        const sequels = [
            { name: 'MYTHICAL VOID: EARTH', desc: 'The Earth storyline', color: '#1E90FF' },
            { name: 'MYTHICAL VOID: EXPANDED', desc: 'The Void storyline', color: '#DA70D6' }
        ];

        sequels.forEach((sequel, i) => {
            const y = sequelY + 35 + i * 35;
            const text = this.add.text(width / 2, y, `• ${sequel.name}`, {
                fontSize: '14px',
                color: sequel.color,
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            this.elements.push(text);
        });

        // Thank you message
        const thankYou = this.add.text(width / 2, height * 0.78,
            'Thank you for playing MYTHICAL VOID™!\n\nPlease enjoy the original game while we\ngather feedback for these exciting sequels.', {
            fontSize: '12px',
            color: '#B8A9C9',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(thankYou);

        // Return to Hub button
        const btnY = height * 0.9;
        this.createButton(
            width / 2, btnY - 15,
            'Return to Hub', 0x4CAF50,
            () => this.returnToHub()
        );
    }

    /**
     * Return to hub world
     */
    returnToHub() {
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start('HubWorldScene');
        });
    }

    /**
     * Create a button
     */
    createButton(x, y, text, color, callback) {
        const { width } = this.scale;
        const btnWidth = Math.min(150, width * 0.35);
        const btnHeight = 50;

        const btn = this.add.graphics();
        btn.fillStyle(color, 1);
        btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
        btn.lineStyle(2, 0xFFFFFF, 0.5);
        btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
        btn.setDepth(202);
        this.elements.push(btn);

        const btnText = this.add.text(x, y + btnHeight / 2, text, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(203);
        this.elements.push(btnText);

        const zone = this.add.zone(x, y + btnHeight / 2, btnWidth, btnHeight)
            .setInteractive({ cursor: 'pointer' })
            .setDepth(204);

        zone.on('pointerover', () => {
            btn.clear();
            btn.fillStyle(Phaser.Display.Color.GetColor(
                Math.min(255, ((color >> 16) & 0xFF) + 30),
                Math.min(255, ((color >> 8) & 0xFF) + 30),
                Math.min(255, (color & 0xFF) + 30)
            ), 1);
            btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
            btn.lineStyle(2, 0xFFD700, 1);
            btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
        });

        zone.on('pointerout', () => {
            btn.clear();
            btn.fillStyle(color, 1);
            btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
            btn.lineStyle(2, 0xFFFFFF, 0.5);
            btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 12);
        });

        zone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick?.();
            }
            callback();
        });

        this.elements.push(zone);
    }

    /**
     * Continue playing (return to hub)
     */
    continueGame() {
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start('HubWorldScene');
        });
    }

    /**
     * Start New Game+ (keep some progress)
     */
    startNewGamePlus() {
        // Keep creature and some achievements, reset levels
        window.GameState?.set('game.newGamePlusCount',
            (window.GameState?.get('game.newGamePlusCount') || 0) + 1
        );

        // Reset level progression but keep creature
        window.GameState?.set('hubWorld.gates.crystal_caves.unlocked', true);
        window.GameState?.set('hubWorld.gates.reef.unlocked', false);
        window.GameState?.set('hubWorld.gates.mythical_forest.unlocked', false);
        window.GameState?.set('hubWorld.gates.aurora_depths.unlocked', false);
        window.GameState?.set('hubWorld.gates.final_void.unlocked', false);

        // Reset ship parts
        window.GameState?.set('hubWorld.shipParts.collected', []);

        window.GameState?.save();

        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.scene.start('HubWorldScene');
        });
    }

    /**
     * Clear non-essential elements for phase transitions
     */
    clearNonEssentialElements() {
        // Keep stars and background, clear everything else except ship
        this.elements = this.elements.filter(el => {
            if (el === this.ship || this.stars.includes(el)) {
                return true;
            }
            if (el && el.destroy) {
                el.destroy();
            }
            return false;
        });
    }

    /**
     * Cleanup on shutdown
     */
    shutdown() {
        devLog('[VictoryScene] Shutting down');

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear references
        this.elements = [];
        this.stars = [];
        this.ship = null;
        this.engineFlame = null;
    }
}

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.VictoryScene = VictoryScene;
}
