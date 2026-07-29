/**
 * VictoryScene - The grand finale of Mythical Void
 *
 * Triggered when player defeats the Void Empress and collects all ship parts.
 * Features:
 * - Ship assembly animation
 * - Project Beacon restoration sequence
 * - A quiet reflection before the final decision
 * - Credits roll with game stats
 * - Two player-chosen campaign endings
 */

import { devLog } from '../utils/devLogger.js';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';

const PROJECT_BEACON_ENDINGS = Object.freeze({
    earth: {
        title: 'PROJECT BEACON: EARTHBOUND',
        shortTitle: 'Return to Earth',
        accent: 0x4FA8FF,
        accentText: '#7FC8FF',
        confirmation: [
            'Send this world\'s coordinates with Project Beacon.',
            'Begin the return journey with your companion beside you.'
        ],
        confirmLabel: 'SEND THE BEACON',
        pages: [
            {
                log: 'TRANSMISSION // SENT',
                title: 'A SIGNAL HOME',
                body: 'Wanderer-7 sends the evidence and coordinates to Earth. Your voice follows the data: this is a living world, not a resource field.',
                fieldNote: 'A report can be a warning. It can also be a promise.'
            },
            {
                log: 'DEPARTURE // TWO ABOARD',
                title: 'NOT A SPECIMEN',
                body: 'Your companion enters the rebuilt ship by choice, carrying a small light from the Sanctuary. The first alien life to trust a human is coming to meet humanity.',
                fieldNote: 'Trust begins with how you enter the room. We will enter together.'
            },
            {
                log: 'COURSE // EARTH',
                title: 'THE LONG WAY HOME',
                body: 'You set a course for Earth carrying a witness, not a prize. Whatever waits at home, neither of you will face it alone.',
                fieldNote: 'Sensei always said the return journey shows what the lesson changed.'
            }
        ]
    },
    void: {
        title: 'PROJECT BEACON: PROTECTED',
        shortTitle: 'Protect This World',
        accent: 0xB58AE8,
        accentText: '#D9B8FF',
        confirmation: [
            'Erase this world\'s coordinates from the uplink.',
            'Remain here while searching for a safer answer for Earth.'
        ],
        confirmLabel: 'SILENCE THE UPLINK',
        pages: [
            {
                log: 'UPLINK // SILENCED',
                title: 'THE COORDINATES GO DARK',
                body: 'You erase the route from Project Beacon. Earth receives no map to this world, and no company can arrive here claiming that discovery means ownership.',
                fieldNote: 'Some things are protected by refusing to name where they are.'
            },
            {
                log: 'SANCTUARY // ANSWERING',
                title: 'THE WORLD ANSWERS',
                body: 'Signals rise from the restored realms. Your companion stays at your side as the settlements welcome the first human they have chosen to trust.',
                fieldNote: 'I came here looking for life. Life found me first.'
            },
            {
                log: 'MISSION // REWRITTEN',
                title: 'A DIFFERENT BEACON',
                body: 'Wanderer-7 becomes a shelter and observatory. You stay to help this world heal while searching for a way to help Earth without turning another home into fuel.',
                fieldNote: 'Sensei called it discipline: power is knowing what not to take.'
            }
        ]
    }
});

export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
        this.elements = [];
        this.phase = 'assembly'; // assembly, beacon, reflection, credits, complete
    }

    init(data) {
        this.victoryData = data || {};
        this.endingPreview = ['choice', 'earth', 'void'].includes(data?.endingPreview)
            ? data.endingPreview
            : null;
        this.endingPreviewPage = Math.max(
            0,
            Math.min(2, Number.parseInt(data?.endingPreviewPage, 10) || 0)
        );
        this.endingPreviewView = ['confirm', 'newGamePlus'].includes(
            data?.endingPreviewView
        ) ? data.endingPreviewView : null;
        this.isPreview = data?.testMode === true || this.endingPreview !== null;
        devLog('[VictoryScene] Init with data:', data);
    }

    create() {
        const { width, height } = this.scale;

        // Stop other scenes
        const scenesToStop = [
            'HatchingScene',
            'PersonalityScene',
            'NamingScene',
            'SoulRevealScene',
            'FinalVoidLevel',
            'HubWorldScene',
            'GameScene'
        ];
        SceneTransitionHelper.stopActiveScenes(this, scenesToStop);
        SceneTransitionHelper.bringToTop(this);

        // Get game stats for credits
        this.loadGameStats();

        // Create background
        this.createBackground(width, height);

        if (this.endingPreview) {
            if (this.endingPreview === 'choice') {
                this.showChoiceScene({ allowExistingChoice: true });
            } else if (this.endingPreviewView === 'confirm') {
                this.showEndingConfirmation(this.endingPreview);
            } else if (this.endingPreviewView === 'newGamePlus') {
                this.showNewGamePlusConfirmation(this.endingPreview);
            } else {
                this.showEndingEpilogue(
                    this.endingPreview,
                    this.endingPreviewPage
                );
            }
            return;
        }

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
            totalPlayTime: this.formatPlayTime(state?.get('player.playTime') / 1000 || 0),
            levelsCompleted: state?.get('stats.levelsCompleted') || 0,
            bossesDefeated: state?.get('combat.bossesDefeated') || 0,
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
        this.createSkipControl(width);

        // Phase 2: Restore Project Beacon without transmitting (5-10s)
        this.time.delayedCall(5000, () => {
            this.phase = 'beacon';
            this.showBeaconPhase(width, height);
        });

        // Phase 3: Hold on the responsibility before the choice (10-18s)
        this.time.delayedCall(10000, () => {
            this.phase = 'reflection';
            this.showReflectionPhase(width, height);
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

    createSkipControl(width) {
        this.removeSkipControl();

        this.skipControl = this.add.text(width - 18, 18, 'SKIP >>', {
            fontSize: '13px',
            color: '#FFFFFF',
            backgroundColor: '#241B45',
            padding: { x: 12, y: 8 }
        })
            .setOrigin(1, 0)
            .setDepth(1000)
            .setInteractive({ cursor: 'pointer' });

        this.skipControl.on('pointerdown', () => this.skipVictorySequence());
    }

    removeSkipControl() {
        if (this.skipControl) {
            this.skipControl.destroy();
            this.skipControl = null;
        }
    }

    skipVictorySequence() {
        if (this.phase === 'complete') {
            return;
        }

        this.time.removeAllEvents();
        this.tweens.killAll();
        this.removeSkipControl();

        this.elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.elements = [];
        this.stars = [];
        this.ship = null;
        this.engineFlame = null;
        this.phase = 'complete';

        const { width, height } = this.scale;
        this.createBackground(width, height);
        this.showCompletePhase(width, height);
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
            { name: 'Hull Plating', emoji: '🛡️', color: 0xB0BEC5 },
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
     * Phase 2: The rebuilt ship restores Project Beacon but holds transmission.
     */
    showBeaconPhase(width, height) {
        this.clearNonEssentialElements();

        const title = this.add.text(width / 2, height * 0.1, 'PROJECT BEACON RESTORED', {
            fontSize: Math.min(28, width * 0.07) + 'px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0).setDepth(100);
        this.elements.push(title);

        const signalField = this.add.graphics();
        [72, 104, 138].forEach((radius, index) => {
            signalField.lineStyle(3 - index * 0.5, 0x8FE3CF, 0.5 - index * 0.1);
            signalField.strokeCircle(width / 2, height / 2, radius);
        });
        signalField.setDepth(45);
        this.elements.push(signalField);

        const status = this.add.text(
            width / 2,
            height * 0.84,
            'UPLINK READY  //  TRANSMISSION HELD',
            {
                fontSize: Math.min(18, width * 0.042) + 'px',
                color: '#F2C14E',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: width * 0.82 }
            }
        ).setOrigin(0.5).setDepth(100);
        this.elements.push(status);

        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: 500
        });
        this.tweens.add({
            targets: signalField,
            alpha: { from: 0.25, to: 0.8 },
            scale: { from: 0.9, to: 1.08 },
            duration: 1700,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });

        window.AudioManager?.playLevelUp?.();
    }

    /**
     * Phase 3: Present both responsibilities before the decision exists.
     */
    showReflectionPhase(width, height) {
        this.clearNonEssentialElements();

        const isCompact = width < 600;
        const shipY = height * (isCompact ? 0.55 : 0.57);
        this.ship?.setPosition(width / 2, shipY);
        this.ship?.setScale(isCompact ? 0.75 : 0.9);

        const title = this.add.text(width / 2, height * 0.11, 'NO SIGNAL HAS LEFT', {
            fontSize: Math.min(28, width * 0.07) + 'px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100);
        this.elements.push(title);

        const reflection = this.add.text(
            width / 2,
            height * 0.25,
            'Project Beacon can reach Earth.\nThe same signal could reveal this world.\nFor the first time, the directive waits for you.',
            {
                fontSize: Math.min(16, width * 0.038) + 'px',
                color: '#E8D5FF',
                align: 'center',
                lineSpacing: 7,
                wordWrap: { width: width * 0.82 }
            }
        ).setOrigin(0.5).setDepth(100);
        this.elements.push(reflection);

        const responsibilityLine = this.add.graphics();
        const nodeY = height * 0.82;
        const earthX = width * (isCompact ? 0.25 : 0.3);
        const voidX = width * (isCompact ? 0.75 : 0.7);
        responsibilityLine.lineStyle(2, 0x8B7FBB, 0.7);
        responsibilityLine.lineBetween(earthX, nodeY, voidX, nodeY);
        responsibilityLine.fillStyle(0x1E90FF, 1);
        responsibilityLine.fillCircle(earthX, nodeY, 8);
        responsibilityLine.fillStyle(0xDA70D6, 1);
        responsibilityLine.fillCircle(voidX, nodeY, 8);
        responsibilityLine.setDepth(70);
        this.elements.push(responsibilityLine);

        const earthLabel = this.add.text(earthX, nodeY + 24, 'EARTH', {
            fontSize: '12px',
            color: '#7FC8FF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100);
        const voidLabel = this.add.text(voidX, nodeY + 24, 'THIS WORLD', {
            fontSize: '12px',
            color: '#E6A5EC',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100);
        this.elements.push(earthLabel, voidLabel);

        const reflectionTargets = [this.ship].filter(Boolean);
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(
                width / 2,
                shipY + (isCompact ? 12 : 15),
                this.gameStats.creatureTexture
            );
            creature.setScale(isCompact ? 0.22 : 0.28);
            creature.setDepth(61);
            this.elements.push(creature);
            reflectionTargets.push(creature);
        }

        if (reflectionTargets.length > 0) {
            this.tweens.add({
                targets: reflectionTargets,
                y: '-=8',
                duration: 1800,
                yoyo: true,
                repeat: 3,
                ease: 'Sine.easeInOut'
            });
        }
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
            ['Realms Restored', `${this.gameStats.levelsCompleted}`],
            ['Guardians Restored', `${this.gameStats.bossesDefeated}`],
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
        this.removeSkipControl();

        if (!this.isPreview) {
            window.GameState?.set('game.victoryAchieved', true);
            window.GameState?.set('game.victoryDate', new Date().toISOString());
            this.recordCampaignRestoration();
        }

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
            'Together, you survived the Void.', {
            fontSize: Math.min(20, width * 0.045) + 'px',
            color: '#FFD700',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width * 0.7 }
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(victoryMsg);

        const subMsg = this.add.text(width / 2, height * 0.57,
            'The ship and uplink are ready. Nothing has been sent.', {
            fontSize: Math.min(14, width * 0.034) + 'px',
            color: '#CE93D8',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: width * 0.7 }
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(subMsg);

        const existingEnding = window.GameState?.get(
            'story.projectBeacon.endingChoice'
        );
        const hasEnding = ['earth', 'void'].includes(existingEnding);

        // The first visit presents the decision. Later visits replay the saved ending.
        const buttonY = height * 0.67;
        this.createButton(
            width / 2, buttonY,
            hasEnding ? 'Revisit your ending' : 'Face the choice',
            0x7B68EE,
            () => {
                if (hasEnding) {
                    this.showEndingEpilogue(existingEnding);
                    return;
                }
                this.showChoiceScene();
            }
        );

        // Play celebration
        if (window.AudioManager) {
            window.AudioManager.playAchievement?.();
        }

    }

    /**
     * Persist campaign restoration separately from the still-unmade ending.
     */
    recordCampaignRestoration() {
        if (this.isPreview) {
            return true;
        }

        const state = window.GameState;
        if (!state) {
            return false;
        }

        const restoredAt = state.get('story.projectBeacon.uplinkRestoredAt')
            || new Date().toISOString();
        state.set('story.projectBeacon.uplinkRestored', true);
        state.set('story.projectBeacon.uplinkRestoredAt', restoredAt);
        window.AchievementSystem?.recordEvent?.('campaign_completed', {
            restoredAt
        });
        state.save?.();
        return true;
    }

    /**
     * Show the Project Beacon choice without privileging either ending.
     */
    showChoiceScene({ allowExistingChoice = false } = {}) {
        const existingEnding = window.GameState?.get(
            'story.projectBeacon.endingChoice'
        );
        if (
            !allowExistingChoice
            && ['earth', 'void'].includes(existingEnding)
        ) {
            this.showEndingEpilogue(existingEnding);
            return;
        }

        const { width, height } = this.scale;
        const isCompact = width < 600;

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
        const title = this.add.text(width / 2, height * 0.17, 'THE BEACON IS YOURS', {
            fontSize: Math.min(28, width * 0.07) + 'px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // Creature in center
        if (this.gameStats.creatureTexture && this.textures.exists(this.gameStats.creatureTexture)) {
            const creature = this.add.sprite(width / 2, height * (isCompact ? 0.29 : 0.31), this.gameStats.creatureTexture);
            creature.setScale(isCompact ? 0.4 : 0.6);
            creature.setDepth(101);
            this.elements.push(creature);

            this.tweens.add({
                targets: creature,
                y: height * (isCompact ? 0.29 : 0.31) - 5,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Narrative text
        const narrative = this.add.text(width / 2, height * (isCompact ? 0.43 : 0.44),
            `Earth is waiting for Project Beacon.\nThis world trusts you with its location.\n${this.gameStats.creatureName} stays close. No signal leaves until you choose.`, {
            fontSize: Math.min(14, width * 0.035) + 'px',
            color: '#E8D5FF',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: width * 0.76 }
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(narrative);

        // Choice buttons
        const btnY = height * 0.62;
        const btnWidth = isCompact
            ? Math.min(320, width * 0.8)
            : Math.min(220, width * 0.38);
        const btnGap = 20;

        // Return to Earth button
        this.createChoiceButton(
            isCompact ? width / 2 : width / 2 - btnWidth / 2 - btnGap,
            isCompact ? height * 0.60 : btnY,
            'RETURN TO EARTH\nTransmit Project Beacon', 0x1E90FF,
            () => this.showEndingConfirmation('earth'),
            btnWidth
        );

        // Protect the creature world button
        this.createChoiceButton(
            isCompact ? width / 2 : width / 2 + btnWidth / 2 + btnGap,
            isCompact ? height * 0.73 : btnY,
            'PROTECT THIS WORLD\nSilence the uplink', 0x6750A4,
            () => this.showEndingConfirmation('void'),
            btnWidth
        );

        // Hint text
        const hint = this.add.text(width / 2, height * 0.86,
            'Choose what happens to the coordinates.', {
            fontSize: '12px',
            color: '#8B7FBB',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: width * 0.76 }
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
    createChoiceButton(x, y, text, color, callback, widthOverride = null) {
        const { width } = this.scale;
        const btnWidth = widthOverride || Math.min(150, width * 0.35);
        const btnHeight = 64;

        const btn = this.add.graphics();
        btn.fillStyle(color, 1);
        btn.fillRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        btn.lineStyle(3, 0xFFFFFF, 0.3);
        btn.strokeRoundedRect(x - btnWidth / 2, y, btnWidth, btnHeight, 15);
        btn.setDepth(102);
        this.elements.push(btn);

        const btnText = this.add.text(x, y + btnHeight / 2, text, {
            fontSize: Math.min(14, width * 0.035) + 'px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: btnWidth - 16 }
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

    showEndingConfirmation(choice) {
        const ending = PROJECT_BEACON_ENDINGS[choice];
        if (!ending) {
            return false;
        }

        const { width, height } = this.scale;
        const isCompact = width < 600;
        this.clearEndingView();
        this.createEndingBackground(width, height, ending.accent);

        const panel = this.add.graphics();
        panel.fillStyle(0x15122C, 0.97);
        panel.fillRoundedRect(width * 0.06, height * 0.06, width * 0.88, height * 0.88, 8);
        panel.lineStyle(3, ending.accent, 0.9);
        panel.strokeRoundedRect(width * 0.06, height * 0.06, width * 0.88, height * 0.88, 8);
        panel.setDepth(100);
        this.elements.push(panel);

        const eyebrow = this.add.text(width / 2, height * 0.13, 'FINAL DECISION', {
            fontSize: '12px',
            color: ending.accentText,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        const title = this.add.text(width / 2, height * 0.22, ending.shortTitle, {
            fontSize: isCompact ? '23px' : '30px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(101);

        const warning = this.add.text(
            width / 2,
            height * 0.33,
            'This becomes the ending of this campaign.',
            {
                fontSize: isCompact ? '14px' : '16px',
                color: '#F2C14E',
                align: 'center',
                wordWrap: { width: width * 0.76 }
            }
        ).setOrigin(0.5).setDepth(101);

        const consequences = this.add.text(
            width / 2,
            height * 0.48,
            ending.confirmation.map(line => `• ${line}`).join('\n\n'),
            {
                fontSize: isCompact ? '14px' : '16px',
                color: '#E8D5FF',
                align: 'left',
                lineSpacing: 4,
                wordWrap: { width: width * 0.7 }
            }
        ).setOrigin(0.5).setDepth(101);
        this.elements.push(eyebrow, title, warning, consequences);

        this.createChoiceButton(
            width / 2,
            height * 0.68,
            ending.confirmLabel,
            ending.accent,
            () => {
                if (this.recordEndingChoice(choice)) {
                    this.showEndingEpilogue(choice);
                }
            },
            Math.min(340, width * 0.72)
        );
        this.createButton(
            width / 2,
            height * 0.82,
            'GO BACK',
            0x4A4564,
            () => this.showChoiceScene({ allowExistingChoice: true })
        );
        return true;
    }

    /**
     * Deliver the selected ending as three paced field-log moments.
     */
    showEndingEpilogue(choice, pageIndex = 0) {
        const ending = PROJECT_BEACON_ENDINGS[choice];
        if (!ending) {
            return false;
        }

        const page = ending.pages[pageIndex];
        if (!page) {
            return false;
        }

        const { width, height } = this.scale;
        const isCompact = width < 600;
        const isLastPage = pageIndex === ending.pages.length - 1;
        this.clearEndingView();
        this.createEndingBackground(width, height, ending.accent);

        const panel = this.add.graphics();
        panel.fillStyle(0x111126, 0.96);
        panel.fillRoundedRect(width * 0.05, height * 0.045, width * 0.9, height * 0.91, 8);
        panel.lineStyle(3, ending.accent, 0.9);
        panel.strokeRoundedRect(width * 0.05, height * 0.045, width * 0.9, height * 0.91, 8);
        panel.setDepth(100);
        this.elements.push(panel);

        const route = this.add.text(width / 2, height * 0.095, ending.title, {
            fontSize: '12px',
            color: ending.accentText,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        const log = this.add.text(width / 2, height * 0.145, page.log, {
            fontSize: '11px',
            color: '#8E8AAE'
        }).setOrigin(0.5).setDepth(101);

        const title = this.add.text(width / 2, height * 0.205, page.title, {
            fontSize: isCompact ? '22px' : '30px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(route, log, title);

        this.createEndingTableau(
            choice,
            pageIndex,
            width / 2,
            height * (isCompact ? 0.34 : 0.35)
        );

        const body = this.add.text(
            width / 2,
            height * (isCompact ? 0.50 : 0.51),
            page.body,
            {
                fontSize: isCompact ? '14px' : '16px',
                color: '#E8E6F2',
                align: 'center',
                lineSpacing: 5,
                wordWrap: { width: width * 0.76 }
            }
        ).setOrigin(0.5).setDepth(101);

        const fieldNote = this.add.text(
            width / 2,
            height * (isCompact ? 0.66 : 0.67),
            `FIELD NOTE // ${page.fieldNote}`,
            {
                fontSize: isCompact ? '12px' : '14px',
                color: '#F2C14E',
                fontStyle: 'italic',
                align: 'center',
                lineSpacing: 4,
                wordWrap: { width: width * 0.74 }
            }
        ).setOrigin(0.5).setDepth(101);

        const progress = this.add.text(
            width / 2,
            height * 0.76,
            `${String(pageIndex + 1).padStart(2, '0')} / ${String(ending.pages.length).padStart(2, '0')}`,
            {
                fontSize: '11px',
                color: '#8E8AAE'
            }
        ).setOrigin(0.5).setDepth(101);
        this.elements.push(body, fieldNote, progress);

        if (isLastPage) {
            this.completeEndingEpilogue(choice);
            const buttonGap = Math.min(92, width * 0.24);
            this.createButton(
                width / 2 - buttonGap,
                height * 0.84,
                'SANCTUARY',
                0x3F8A67,
                () => this.returnToHub()
            );
            this.createButton(
                width / 2 + buttonGap,
                height * 0.84,
                'NEW GAME+',
                0x6F54A6,
                () => this.showNewGamePlusConfirmation(choice)
            );
        } else {
            this.createButton(
                width / 2,
                height * 0.84,
                'CONTINUE',
                ending.accent,
                () => this.showEndingEpilogue(choice, pageIndex + 1)
            );
        }

        window.AudioManager?.playAchievement?.();
        return true;
    }

    createEndingTableau(choice, pageIndex, centerX, centerY) {
        const ending = PROJECT_BEACON_ENDINGS[choice];
        const art = this.add.graphics();
        art.setPosition(centerX, centerY);
        art.setDepth(101);
        art.lineStyle(2, ending.accent, 0.9);

        if (choice === 'earth') {
            const earthX = pageIndex === 2 ? 68 : -62;
            const shipX = pageIndex === 2 ? -52 : 58;

            art.fillStyle(0x2357A6, 1);
            art.fillCircle(earthX, 0, 36);
            art.fillStyle(0x5DC58C, 0.9);
            art.fillCircle(earthX - 12, -8, 10);
            art.fillCircle(earthX + 10, 9, 8);
            art.lineStyle(2, 0x7FC8FF, 0.75);
            art.strokeCircle(earthX, 0, 43);

            art.fillStyle(0xD9E4F0, 1);
            art.fillTriangle(shipX, -16, shipX - 13, 15, shipX + 13, 15);
            art.fillStyle(0xF2C14E, 1);
            art.fillTriangle(shipX - 8, 15, shipX + 8, 15, shipX, 29);
            art.lineStyle(2, ending.accent, 0.8);
            art.lineBetween(earthX + (earthX < 0 ? 45 : -45), 0, shipX, 0);

            if (pageIndex === 0) {
                [50, 60, 70].forEach(radius => art.strokeCircle(earthX, 0, radius));
            } else if (pageIndex === 1) {
                art.fillStyle(0x8FE3CF, 1);
                art.fillCircle(shipX, 4, 6);
                art.strokeCircle(shipX, 4, 11);
            } else {
                art.lineStyle(2, 0xF2C14E, 0.65);
                art.lineBetween(shipX - 48, 0, shipX - 20, 0);
                art.lineBetween(shipX - 38, -10, shipX - 18, -5);
                art.lineBetween(shipX - 38, 10, shipX - 18, 5);
            }
        } else if (pageIndex === 0) {
            art.fillStyle(0x181735, 1);
            art.fillCircle(55, 0, 39);
            art.lineStyle(3, ending.accent, 1);
            art.strokeCircle(55, 0, 48);
            art.fillStyle(0x8FE3CF, 1);
            art.fillCircle(45, -8, 7);
            art.fillCircle(65, 8, 5);
            art.lineStyle(2, 0xEF767A, 0.8);
            art.lineBetween(-80, 0, -18, 0);
            art.lineBetween(-8, -10, 8, 10);
            art.lineBetween(-8, 10, 8, -10);
        } else if (pageIndex === 1) {
            const nodes = [
                [-70, 8], [-34, -28], [0, 0], [38, -22], [72, 10]
            ];
            art.lineStyle(2, ending.accent, 0.65);
            nodes.slice(0, -1).forEach((node, index) => {
                art.lineBetween(node[0], node[1], nodes[index + 1][0], nodes[index + 1][1]);
            });
            nodes.forEach(([x, y], index) => {
                art.fillStyle(index === 2 ? 0x8FE3CF : ending.accent, 1);
                art.fillCircle(x, y, index === 2 ? 9 : 6);
                art.strokeCircle(x, y, index === 2 ? 15 : 10);
            });
        } else {
            art.fillStyle(0xCDD6E0, 1);
            art.fillTriangle(0, -30, -24, 18, 24, 18);
            art.fillStyle(0xF2C14E, 1);
            art.fillCircle(0, -4, 7);
            art.lineStyle(3, 0x6DBA78, 0.9);
            art.lineBetween(-20, 18, -60, 34);
            art.lineBetween(20, 18, 60, 34);
            art.lineBetween(-8, 18, -25, 43);
            art.lineBetween(8, 18, 25, 43);
            art.fillStyle(0x8FE3CF, 1);
            art.fillCircle(-60, 34, 6);
            art.fillCircle(60, 34, 6);
        }

        art.setScale(0.92);
        this.tweens.add({
            targets: art,
            scale: 1,
            alpha: { from: 0.65, to: 1 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.elements.push(art);
    }

    showNewGamePlusConfirmation(choice) {
        const ending = PROJECT_BEACON_ENDINGS[choice];
        if (!ending) {
            return false;
        }

        const { width, height } = this.scale;
        const isCompact = width < 600;
        this.clearEndingView();
        this.createEndingBackground(width, height, ending.accent);

        const panel = this.add.graphics();
        panel.fillStyle(0x15122C, 0.97);
        panel.fillRoundedRect(width * 0.06, height * 0.09, width * 0.88, height * 0.82, 8);
        panel.lineStyle(3, 0x6F54A6, 0.95);
        panel.strokeRoundedRect(width * 0.06, height * 0.09, width * 0.88, height * 0.82, 8);
        panel.setDepth(100);

        const title = this.add.text(width / 2, height * 0.2, 'REPLAY PROJECT BEACON?', {
            fontSize: isCompact ? '22px' : '30px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(101);

        const body = this.add.text(
            width / 2,
            height * 0.43,
            `Your expeditions, ship parts, and ending will reset.\nPurchased route maps stay open.\n\n${this.gameStats.creatureName}, your bond, achievements, field kit, and katana upgrades will remain.`,
            {
                fontSize: isCompact ? '14px' : '16px',
                color: '#E8E6F2',
                align: 'center',
                lineSpacing: 6,
                wordWrap: { width: width * 0.74 }
            }
        ).setOrigin(0.5).setDepth(101);
        this.elements.push(panel, title, body);

        this.createChoiceButton(
            width / 2,
            height * 0.64,
            'START NEW GAME+',
            0x6F54A6,
            () => this.startNewGamePlus(),
            Math.min(320, width * 0.7)
        );
        this.createButton(
            width / 2,
            height * 0.79,
            'KEEP ENDING',
            0x4A4564,
            () => this.showEndingEpilogue(choice, ending.pages.length - 1)
        );
        return true;
    }

    clearEndingView() {
        this.tweens?.killAll?.();
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.elements = [];
        this.stars = [];
        this.ship = null;
    }

    createEndingBackground(width, height, accent) {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x080A14, 0x101326, 0x131126, 0x241936, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        for (let i = 0; i < 55; i++) {
            const star = this.add.graphics();
            star.fillStyle(i % 8 === 0 ? accent : 0xFFFFFF, 0.2 + Math.random() * 0.5);
            star.fillCircle(
                Math.random() * width,
                Math.random() * height,
                0.5 + Math.random()
            );
            star.setDepth(1);
            this.elements.push(star);
            this.stars.push(star);
        }
    }

    completeEndingEpilogue(choice) {
        if (this.isPreview) {
            return true;
        }

        const state = window.GameState;
        if (!state || state.get('story.projectBeacon.endingChoice') !== choice) {
            return false;
        }

        const completedAt = state.get(
            'story.projectBeacon.endingEpilogueCompletedAt'
        ) || new Date().toISOString();
        state.set('story.projectBeacon.endingEpilogueSeen', true);
        state.set(
            'story.projectBeacon.endingEpilogueCompletedAt',
            completedAt
        );
        state.save?.();
        return true;
    }

    /**
     * Persist the player's final campaign decision for future story branches.
     */
    recordEndingChoice(choice) {
        if (!['earth', 'void'].includes(choice)) {
            return false;
        }

        if (this.isPreview) {
            return true;
        }

        const state = window.GameState;
        if (!state) {
            return false;
        }

        const existingChoice = state.get('story.projectBeacon.endingChoice');
        if (['earth', 'void'].includes(existingChoice)) {
            return existingChoice === choice;
        }

        state.set('story.projectBeacon.endingChoice', choice);
        state.set('story.projectBeacon.endingChoiceDate', new Date().toISOString());
        state.set('story.projectBeacon.endingEpilogueSeen', false);
        state.set('story.projectBeacon.endingEpilogueCompletedAt', null);
        state.save?.();
        return true;
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
        const state = window.GameState;
        const mapsOwned = state?.get('hubWorld.mapsOwned') || [];
        const mapOwnedGateIds = new Set(
            Array.isArray(mapsOwned) ? mapsOwned : []
        );

        // Keep creature and some achievements, reset levels
        state?.set('game.newGamePlusCount',
            (state?.get('game.newGamePlusCount') || 0) + 1
        );

        // Reset campaign progression while honoring permanent route-map rewards.
        state?.set(
            'hubWorld.gates.crystal_caves.unlocked',
            mapOwnedGateIds.has('crystal_caves')
        );
        state?.set(
            'hubWorld.gates.stellar_reef.unlocked',
            mapOwnedGateIds.has('stellar_reef')
        );
        state?.set('hubWorld.gates.mythical_forest.unlocked', true);
        state?.set(
            'hubWorld.gates.void_peaks.unlocked',
            mapOwnedGateIds.has('void_peaks')
        );
        state?.set(
            'hubWorld.gates.aurora_depths.unlocked',
            mapOwnedGateIds.has('aurora_depths')
        );
        state?.set('hubWorld.gates.final_void.unlocked', false);

        state?.set('levels', {
            crystalCaves: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
            cosmicReef: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
            mythicalForest: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
            voidPeaks: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
            auroraDepths: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
            finalVoid: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null }
        });
        state?.set('stats.levelsCompleted', 0);
        state?.set('combat.bossesDefeated', 0);
        state?.set('hubWorld.shipParts.collected', []);
        state?.set('hubWorld.shipParts.finalBossUnlocked', false);
        state?.set('hubWorld.shipCompletionCutsceneShown', false);

        // Replay the campaign story while preserving the recovered field kit,
        // katana upgrades, creature bond, and achievements.
        const projectBeacon = state?.get('story.projectBeacon') || {};
        state?.set('story.projectBeacon', {
            ...projectBeacon,
            firstExpeditionPromptSeen: false,
            expeditionCheckpoint: null,
            pendingDebriefs: [],
            debriefsSeen: [],
            uplinkRestored: false,
            uplinkRestoredAt: null,
            endingChoice: null,
            endingChoiceDate: null,
            endingEpilogueSeen: false,
            endingEpilogueCompletedAt: null,
            lastRouteUnlocked: null
        });

        state?.save();

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
        this.removeSkipControl();
    }
}

// Expose globally for Phaser
if (typeof window !== 'undefined') {
    window.VictoryScene = VictoryScene;
}
