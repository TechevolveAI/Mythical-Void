/**
 * CreatureGatheringScene - Creature Resort/Gathering Place
 *
 * A cozy area where all collected creatures can relax together.
 * Unlocked via rocket repair completion.
 *
 * Features:
 * - Cosmic gradient background with stars
 * - Floating cushion platforms for creatures
 * - All collected creatures displayed with idle animations
 * - Random creature interactions (wave, nuzzle, play, sleep)
 * - Dream bubbles with emoji thoughts
 * - Click creatures to view details
 */

import Phaser from 'phaser';
import { devLog } from '../utils/devLogger.js';

export default class CreatureGatheringScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CreatureGatheringScene' });
        this.graphicsEngine = null;
        this.elements = [];
        this.creatureSprites = [];
        this.cushions = [];
        this.interactionTimer = null;
        this.dreamBubbleTimer = null;
    }

    create() {
        devLog('[CreatureGatheringScene] Creating Creature Resort');

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        const { width, height } = this.scale;
        this.isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Check unlock condition
        const rocketRepaired = window.GameState?.get('rocket.repaired') || false;
        if (!rocketRepaired) {
            this.showLockedMessage();
            return;
        }

        // Create scene elements
        this.createBackground();
        this.createHeader();
        this.createCushions();
        this.displayCreatures();
        this.setupInteractions();

        // Play gathering music
        if (window.AudioManager?.playAreaMusic) {
            window.AudioManager.playAreaMusic('gathering');
        }

        // Setup input
        this.input.keyboard?.on('keydown-ESC', () => this.goBack());

        devLog('[CreatureGatheringScene] Creature Resort created');
    }

    /**
     * Show locked message when rocket isn't repaired
     */
    showLockedMessage() {
        const { width, height } = this.scale;

        // Dark background
        const bg = this.add.graphics();
        bg.fillStyle(0x0D0D1A, 1);
        bg.fillRect(0, 0, width, height);
        this.elements.push(bg);

        // Lock icon
        const lockIcon = this.add.text(width / 2, height / 2 - 50, '🔒', {
            fontSize: '64px'
        }).setOrigin(0.5);
        this.elements.push(lockIcon);

        // Message
        const message = this.add.text(width / 2, height / 2 + 30, 'Creature Resort Locked', {
            fontSize: '24px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.elements.push(message);

        const hint = this.add.text(width / 2, height / 2 + 70, 'Repair the rocket to unlock!', {
            fontSize: '16px',
            color: '#AAAAAA'
        }).setOrigin(0.5);
        this.elements.push(hint);

        // Back button
        const backBtn = this.add.text(width / 2, height / 2 + 130, '← Back to Game', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#4A148C',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.goBack());
        backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
        backBtn.on('pointerout', () => backBtn.setColor('#FFFFFF'));
        this.elements.push(backBtn);

        // ESC to go back
        this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    }

    /**
     * Create cosmic background with stars
     */
    createBackground() {
        const { width, height } = this.scale;

        // Cosmic gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x1A0A2E, 0x1A0A2E, 0x2D1B4E, 0x2D1B4E, 1);
        bg.fillRect(0, 0, width, height);
        this.elements.push(bg);

        // Scattered stars (upper 60%)
        for (let i = 0; i < 60; i++) {
            const star = this.add.graphics();
            const x = Math.random() * width;
            const y = Math.random() * (height * 0.6);
            const size = 1 + Math.random() * 2;
            const alpha = 0.3 + Math.random() * 0.7;

            star.fillStyle(0xFFFFFF, alpha);
            star.fillCircle(x, y, size);
            this.elements.push(star);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: alpha * 0.3,
                duration: 800 + Math.random() * 1500,
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }

        // Ground platform area (lower part)
        const groundY = height * 0.7;
        const ground = this.add.graphics();
        ground.fillGradientStyle(0x3D2D5E, 0x3D2D5E, 0x4A3A6E, 0x4A3A6E, 0.9);
        ground.fillRect(0, groundY, width, height - groundY);

        // Ground top edge with glow
        ground.lineStyle(3, 0x7B68EE, 0.6);
        ground.lineBetween(0, groundY, width, groundY);
        this.elements.push(ground);

        // Subtle grass/crystal elements
        for (let i = 0; i < 10; i++) {
            const crystal = this.add.graphics();
            const x = 30 + Math.random() * (width - 60);
            const y = groundY + 5 + Math.random() * 10;

            crystal.fillStyle(0x9370DB, 0.5);
            crystal.fillTriangle(x, y, x - 3, y + 8, x + 3, y + 8);
            this.elements.push(crystal);
        }
    }

    /**
     * Create header with title and back button
     */
    createHeader() {
        const { width } = this.scale;
        const headerHeight = 60;

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A1A3E, 0.9);
        headerBg.fillRect(0, 0, width, headerHeight);
        headerBg.lineStyle(1, 0x7B68EE, 0.5);
        headerBg.lineBetween(0, headerHeight, width, headerHeight);
        headerBg.setDepth(100);
        this.elements.push(headerBg);

        // Back button
        const backBtn = this.add.text(20, headerHeight / 2, '← Back', {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFFFFF'
        }).setOrigin(0, 0.5).setDepth(101);
        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.goBack());
        backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
        backBtn.on('pointerout', () => backBtn.setColor('#FFFFFF'));
        this.elements.push(backBtn);

        // Title
        const title = this.add.text(width / 2, headerHeight / 2, '✨ Creature Resort ✨', {
            fontSize: this.isMobile ? '20px' : '24px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // Creature count
        const collection = window.GameState?.get('creatures') || [];
        const currentCreature = window.GameState?.get('creature.name') ? 1 : 0;
        const totalCount = collection.length + currentCreature;

        const countText = this.add.text(width - 20, headerHeight / 2, `${totalCount} Creatures`, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(1, 0.5).setDepth(101);
        this.elements.push(countText);
    }

    /**
     * Create floating cushion platforms
     */
    createCushions() {
        const { width, height } = this.scale;
        const groundY = height * 0.7;

        // Cushion positions (5 floating cushions)
        const cushionPositions = [
            { x: width * 0.15, y: groundY - 30 },
            { x: width * 0.35, y: groundY - 50 },
            { x: width * 0.50, y: groundY - 25 },
            { x: width * 0.65, y: groundY - 45 },
            { x: width * 0.85, y: groundY - 35 }
        ];

        const cushionColors = [0x6B4C9A, 0x8B5CF6, 0x7C3AED, 0x9B59B6, 0x5B21B6];

        cushionPositions.forEach((pos, i) => {
            const cushion = this.add.graphics();
            const color = cushionColors[i % cushionColors.length];

            // Cushion shadow
            cushion.fillStyle(0x000000, 0.3);
            cushion.fillEllipse(pos.x, pos.y + 15, 60, 12);

            // Cushion body
            cushion.fillStyle(color, 0.9);
            cushion.fillEllipse(pos.x, pos.y, 50, 20);

            // Cushion highlight
            cushion.fillStyle(0xFFFFFF, 0.2);
            cushion.fillEllipse(pos.x - 10, pos.y - 5, 20, 8);

            cushion.setDepth(5);
            this.elements.push(cushion);

            // Gentle floating animation
            this.tweens.add({
                targets: cushion,
                y: pos.y - 5,
                duration: 2000 + i * 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.cushions.push({ graphics: cushion, position: pos, occupied: false });
        });
    }

    /**
     * Display all collected creatures + current creature
     */
    displayCreatures() {
        const collection = window.GameState?.get('creatures') || [];
        const currentCreatureGenes = window.GameState?.get('creature.genes');
        const currentCreatureName = window.GameState?.get('creature.name');

        // Combine current creature with collection
        const allCreatures = [...collection];
        if (currentCreatureGenes && currentCreatureName) {
            allCreatures.unshift({
                name: currentCreatureName,
                genes: currentCreatureGenes,
                isCurrent: true
            });
        }

        if (allCreatures.length === 0) {
            this.showEmptyMessage();
            return;
        }

        // Place creatures on cushions (cycle if more creatures than cushions)
        allCreatures.forEach((creature, index) => {
            const cushionIndex = index % this.cushions.length;
            const cushion = this.cushions[cushionIndex];

            this.createCreatureOnCushion(creature, cushion.position, index);
        });
    }

    /**
     * Create a creature sprite on a cushion
     */
    createCreatureOnCushion(creatureData, position, index) {
        const { width, height } = this.scale;

        // Create creature sprite
        let sprite = null;
        if (creatureData.genes && this.graphicsEngine) {
            try {
                const { textureName } = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    creatureData.genes, 0, 'adult'
                );
                sprite = this.add.sprite(position.x, position.y - 25, textureName);
                sprite.setScale(0.5);
            } catch (e) {
                devLog('[CreatureGatheringScene] Failed to create creature sprite:', e);
            }
        }

        // Fallback placeholder
        if (!sprite) {
            sprite = this.add.text(position.x, position.y - 25, '🐾', {
                fontSize: '32px'
            }).setOrigin(0.5);
        }

        sprite.setDepth(10 + index);
        this.elements.push(sprite);

        // Current creature glow
        if (creatureData.isCurrent) {
            const glow = this.add.graphics();
            glow.fillStyle(0xFFD700, 0.3);
            glow.fillCircle(position.x, position.y - 25, 40);
            glow.setDepth(9);
            this.elements.push(glow);

            // Pulse glow
            this.tweens.add({
                targets: glow,
                alpha: { from: 0.3, to: 0.1 },
                duration: 1500,
                yoyo: true,
                repeat: -1
            });
        }

        // Idle bobbing animation
        this.tweens.add({
            targets: sprite,
            y: position.y - 30,
            duration: 1500 + index * 100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Name label below
        const rarity = creatureData.genes?.rarity || 'common';
        const rarityColor = this.getRarityColorHex(rarity);

        const nameLabel = this.add.text(position.x, position.y + 20, creatureData.name || 'Unknown', {
            fontSize: '11px',
            color: creatureData.isCurrent ? '#FFD700' : '#FFFFFF',
            fontStyle: creatureData.isCurrent ? 'bold' : 'normal',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(nameLabel);

        // Make clickable
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerdown', () => this.onCreatureClicked(creatureData));
        sprite.on('pointerover', () => {
            sprite.setScale(0.55);
            window.AudioManager?.playButtonClick?.();
        });
        sprite.on('pointerout', () => sprite.setScale(0.5));

        // Store for interactions
        this.creatureSprites.push({
            sprite,
            data: creatureData,
            position,
            nameLabel
        });
    }

    /**
     * Show message when no creatures collected
     */
    showEmptyMessage() {
        const { width, height } = this.scale;

        const message = this.add.text(width / 2, height / 2, 'No creatures yet!\nHatch your first egg to start your collection.', {
            fontSize: '18px',
            color: '#AAAAAA',
            align: 'center'
        }).setOrigin(0.5);
        this.elements.push(message);
    }

    /**
     * Setup random creature interactions
     */
    setupInteractions() {
        // Random interactions every 5 seconds
        this.interactionTimer = this.time.addEvent({
            delay: 5000,
            callback: () => this.triggerRandomInteraction(),
            loop: true
        });

        // Dream bubbles every 10 seconds
        this.dreamBubbleTimer = this.time.addEvent({
            delay: 10000,
            callback: () => this.showDreamBubble(),
            loop: true
        });
    }

    /**
     * Trigger random interaction between creatures
     */
    triggerRandomInteraction() {
        if (this.creatureSprites.length < 1) return;

        const creature = this.creatureSprites[Math.floor(Math.random() * this.creatureSprites.length)];
        const interactions = ['wave', 'nuzzle', 'play', 'sleep'];
        const interaction = interactions[Math.floor(Math.random() * interactions.length)];

        switch (interaction) {
            case 'wave':
                // Side-to-side wave
                this.tweens.add({
                    targets: creature.sprite,
                    angle: { from: -10, to: 10 },
                    duration: 200,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => creature.sprite.setAngle(0)
                });
                break;

            case 'nuzzle':
                // Gentle forward lean
                this.tweens.add({
                    targets: creature.sprite,
                    scaleX: { from: 0.5, to: 0.55 },
                    x: creature.position.x + 5,
                    duration: 300,
                    yoyo: true
                });
                break;

            case 'play':
                // Excited hop
                this.tweens.add({
                    targets: creature.sprite,
                    y: creature.position.y - 45,
                    duration: 200,
                    yoyo: true,
                    repeat: 2,
                    ease: 'Power2'
                });
                break;

            case 'sleep':
                // Show Zzz
                const zzz = this.add.text(creature.position.x + 20, creature.position.y - 50, 'Z', {
                    fontSize: '16px',
                    color: '#AAAAFF'
                }).setOrigin(0.5).setAlpha(0).setDepth(20);

                this.tweens.add({
                    targets: zzz,
                    y: creature.position.y - 70,
                    alpha: { from: 0, to: 1 },
                    duration: 800,
                    yoyo: true,
                    onComplete: () => zzz.destroy()
                });
                break;
        }
    }

    /**
     * Show dream bubble with emoji thought
     */
    showDreamBubble() {
        if (this.creatureSprites.length < 1) return;

        const creature = this.creatureSprites[Math.floor(Math.random() * this.creatureSprites.length)];
        const thoughts = ['💭', '💖', '⭐', '🌙', '✨', '🎵', '🍎', '🎮', '😴', '💤'];
        const thought = thoughts[Math.floor(Math.random() * thoughts.length)];

        // Thought bubble
        const bubble = this.add.graphics();
        bubble.fillStyle(0xFFFFFF, 0.9);
        bubble.fillCircle(creature.position.x + 30, creature.position.y - 60, 15);
        bubble.fillCircle(creature.position.x + 22, creature.position.y - 45, 6);
        bubble.fillCircle(creature.position.x + 18, creature.position.y - 35, 3);
        bubble.setDepth(19).setAlpha(0);
        this.elements.push(bubble);

        // Thought emoji
        const thoughtText = this.add.text(creature.position.x + 30, creature.position.y - 60, thought, {
            fontSize: '14px'
        }).setOrigin(0.5).setDepth(20).setAlpha(0);

        // Animate in and out
        this.tweens.add({
            targets: [bubble, thoughtText],
            alpha: 1,
            duration: 500,
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: [bubble, thoughtText],
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            bubble.destroy();
                            thoughtText.destroy();
                        }
                    });
                });
            }
        });
    }

    /**
     * Handle creature click
     */
    onCreatureClicked(creatureData) {
        devLog('[CreatureGatheringScene] Creature clicked:', creatureData.name);

        // Play sound
        window.AudioManager?.playButtonClick?.();

        // Show info popup
        this.showCreatureInfo(creatureData);
    }

    /**
     * Show creature info popup
     */
    showCreatureInfo(creatureData) {
        const { width, height } = this.scale;

        // Overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.closeInfoPopup());

        // Info panel
        const panelWidth = Math.min(300, width - 40);
        const panelHeight = 200;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(2, 0x7B68EE, 0.8);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Creature name
        const nameText = this.add.text(width / 2, panelY + 30, creatureData.name || 'Unknown', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Rarity
        const rarity = creatureData.genes?.rarity || 'common';
        const rarityText = this.add.text(width / 2, panelY + 55, rarity.toUpperCase(), {
            fontSize: '14px',
            color: this.getRarityColorHex(rarity)
        }).setOrigin(0.5).setDepth(202);

        // Species
        const species = creatureData.genes?.species || 'Unknown Species';
        const speciesText = this.add.text(width / 2, panelY + 80, species, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(202);

        // Personality
        const personality = creatureData.genes?.personality?.core || 'mysterious';
        const personalityText = this.add.text(width / 2, panelY + 105, `Personality: ${personality}`, {
            fontSize: '13px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(202);

        // Current indicator
        if (creatureData.isCurrent) {
            const currentBadge = this.add.text(width / 2, panelY + 130, '⭐ Active Companion ⭐', {
                fontSize: '12px',
                color: '#88FF88'
            }).setOrigin(0.5).setDepth(202);
            this.infoPopupElements = [overlay, panel, nameText, rarityText, speciesText, personalityText, currentBadge];
        } else {
            this.infoPopupElements = [overlay, panel, nameText, rarityText, speciesText, personalityText];
        }

        // Close button
        const closeBtn = this.add.text(width / 2, panelY + panelHeight - 30, 'Tap to close', {
            fontSize: '12px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(202);
        this.infoPopupElements.push(closeBtn);
    }

    /**
     * Close info popup
     */
    closeInfoPopup() {
        if (this.infoPopupElements) {
            this.infoPopupElements.forEach(el => el.destroy());
            this.infoPopupElements = null;
        }
    }

    /**
     * Get rarity color as hex string
     */
    getRarityColorHex(rarity) {
        const colors = {
            common: '#4CAF50',
            uncommon: '#03A9F4',
            rare: '#E91E63',
            epic: '#9C27B0',
            legendary: '#FFD700'
        };
        return colors[rarity] || colors.common;
    }

    /**
     * Go back to GameScene
     */
    goBack() {
        // Stop music
        if (window.AudioManager?.stopMusic) {
            window.AudioManager.stopMusic();
        }

        // Play sound
        window.AudioManager?.playButtonClick?.();

        this.scene.start('GameScene');
    }

    /**
     * Cleanup on shutdown
     */
    shutdown() {
        devLog('[CreatureGatheringScene] Shutting down');

        // Stop timers
        if (this.interactionTimer) {
            this.interactionTimer.destroy();
            this.interactionTimer = null;
        }
        if (this.dreamBubbleTimer) {
            this.dreamBubbleTimer.destroy();
            this.dreamBubbleTimer = null;
        }

        // Stop music
        if (window.AudioManager?.stopMusic) {
            window.AudioManager.stopMusic();
        }

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ESC');
        }

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear arrays
        this.elements = [];
        this.creatureSprites = [];
        this.cushions = [];
        this.infoPopupElements = null;
        this.graphicsEngine = null;

        devLog('[CreatureGatheringScene] Cleanup complete');
    }
}

// Export for use in game
if (typeof window !== 'undefined') {
    window.CreatureGatheringScene = CreatureGatheringScene;
}
