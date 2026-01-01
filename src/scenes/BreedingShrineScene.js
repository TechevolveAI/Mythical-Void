/**
 * BreedingShrineScene - Cosmic breeding shrine for creature breeding
 * Allows players to breed their creature with NPC partners to create offspring
 *
 * Features:
 * - Breeding shrine visual with cosmic atmosphere
 * - Current creature display with genetics info
 * - Partner selection (NPC partners for MVP)
 * - Compatibility calculation and display
 * - Breeding cooldown management
 * - Offspring trait preview
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

class BreedingShrineScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BreedingShrineScene' });

        this.selectedPartner = null;
        this.partnerGenes = null;
        this.compatibility = null;
        this.breedingInProgress = false;

        // UI elements
        this.overlay = null;
        this.panel = null;
        this.titleText = null;
        this.creatureDisplay = null;
        this.partnerDisplay = null;
        this.compatibilityMeter = null;
        this.breedButton = null;
        this.closeButton = null;
        this.cooldownText = null;
        this.elements = [];
    }

    create() {
        console.log('[BreedingShrineScene] Creating breeding shrine...');

        const { width, height } = this.scale;

        // Stop other scenes to ensure clean display
        const scenesToStop = ['GameScene'];
        scenesToStop.forEach(sceneKey => {
            try {
                const scene = this.scene.get(sceneKey);
                if (scene && scene.scene.isActive()) {
                    this.scene.pause(sceneKey);
                }
            } catch (e) {
                // Scene might not exist
            }
        });

        // Create dark overlay background
        this.createOverlay(width, height);

        // Create main panel
        this.createMainPanel(width, height);

        // Create title
        this.createTitle(width);

        // Display current creature
        this.displayCurrentCreature(width, height);

        // Generate and display NPC partner
        this.generatePartner();
        this.displayPartner(width, height);

        // Display compatibility
        this.displayCompatibility(width, height);

        // Create breed button
        this.createBreedButton(width, height);

        // Create close button
        this.createCloseButton(width);

        // Create breeding history hint
        this.displayBreedingHistory(width, height);

        // Play ambient sound
        window.AudioManager?.playButtonClick?.();

        console.log('[BreedingShrineScene] Breeding shrine created');
    }

    createOverlay(width, height) {
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(0x050214, 0.9);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(100);

        // Add cosmic particles to overlay
        this.createCosmicParticles(width, height);

        this.elements.push(this.overlay);
    }

    createCosmicParticles(width, height) {
        // Create twinkling stars in the background
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 3);

            const star = this.add.graphics();
            star.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
            star.fillCircle(x, y, size);
            star.setDepth(101);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: { from: 0.3, to: 1 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.elements.push(star);
        }
    }

    createMainPanel(width, height) {
        const panelWidth = Math.min(380, width - 40);
        const panelHeight = Math.min(520, height - 80);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        this.panel = this.add.graphics();

        // Panel background with gradient effect
        this.panel.fillStyle(0x1A1A3E, 0.95);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

        // Cosmic border glow
        this.panel.lineStyle(3, 0x9370DB, 1);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

        // Inner glow
        this.panel.lineStyle(1, 0xFFD700, 0.3);
        this.panel.strokeRoundedRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 18);

        this.panel.setDepth(200);
        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };

        this.elements.push(this.panel);
    }

    createTitle(width) {
        this.titleText = this.add.text(width / 2, this.panelBounds.y + 30, '🧬 Breeding Shrine 🧬', {
            fontSize: '22px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(201);

        // Subtitle
        this.subtitleText = this.add.text(width / 2, this.panelBounds.y + 55, 'Combine cosmic genetics', {
            fontSize: '12px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(201);

        this.elements.push(this.titleText, this.subtitleText);
    }

    displayCurrentCreature(width, height) {
        const genes = getGameState().get('creature.genes');
        const name = getGameState().get('creature.name') || 'Your Creature';
        const level = getGameState().get('creature.level') || 1;

        const leftX = this.panelBounds.x + 80;
        const topY = this.panelBounds.y + 90;

        // Creature label
        const label = this.add.text(leftX, topY, 'Your Creature', {
            fontSize: '12px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(201);

        // Creature name
        const nameText = this.add.text(leftX, topY + 20, name, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        // Creature placeholder visual
        const visual = this.add.graphics();
        visual.fillStyle(this.getCreatureColor(genes), 0.8);
        visual.fillCircle(leftX, topY + 60, 25);
        visual.lineStyle(2, 0xFFD700, 0.8);
        visual.strokeCircle(leftX, topY + 60, 25);
        visual.setDepth(201);

        // Creature info
        const rarity = genes?.rarity || 'common';
        const affinity = genes?.cosmicAffinity?.element || 'unknown';

        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        const infoText = this.add.text(leftX, topY + 100, `Lv.${level} • ${rarity.toUpperCase()}`, {
            fontSize: '11px',
            color: rarityColors[rarity] || '#FFFFFF'
        }).setOrigin(0.5).setDepth(201);

        const affinityText = this.add.text(leftX, topY + 115, `${this.getAffinityEmoji(affinity)} ${affinity}`, {
            fontSize: '11px',
            color: '#CCCCCC'
        }).setOrigin(0.5).setDepth(201);

        this.elements.push(label, nameText, visual, infoText, affinityText);
    }

    generatePartner() {
        // Generate random NPC partner genes using BreedingEngine
        if (window.BreedingEngine) {
            this.partnerGenes = window.BreedingEngine.generateRandomGenes();
        } else {
            // Fallback if BreedingEngine not available
            this.partnerGenes = {
                bodyShape: ['normal', 'slender'],
                eyeColor: ['amber', 'blue'],
                pattern: ['solid', 'spotted'],
                horns: ['small', 'none'],
                tail: ['medium', 'long'],
                earShape: ['rounded', 'pointed'],
                maneLength: ['medium', 'short']
            };
        }

        // Calculate compatibility
        const currentGenes = getGameState().get('creature.genes');
        if (currentGenes && window.BreedingEngine) {
            const currentMendelian = currentGenes.mendelianGenes || window.BreedingEngine.generateInitialGenes();
            this.compatibility = window.BreedingEngine.getBreedingCompatibility(currentMendelian, this.partnerGenes);
        } else {
            this.compatibility = { percentage: Phaser.Math.Between(40, 90), score: 50, maxScore: 100 };
        }
    }

    displayPartner(width, height) {
        const rightX = this.panelBounds.x + this.panelBounds.width - 80;
        const topY = this.panelBounds.y + 90;

        // Partner label
        const label = this.add.text(rightX, topY, 'Wild Partner', {
            fontSize: '12px',
            color: '#FF88CC'
        }).setOrigin(0.5).setDepth(201);

        // Partner name
        const names = ['Starwhisper', 'Moonglide', 'Nebulite', 'Crystalwing', 'Voidwalker'];
        const partnerName = names[Phaser.Math.Between(0, names.length - 1)];

        const nameText = this.add.text(rightX, topY + 20, partnerName, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        // Partner placeholder visual
        const visual = this.add.graphics();
        visual.fillStyle(0xFF69B4, 0.8);
        visual.fillCircle(rightX, topY + 60, 25);
        visual.lineStyle(2, 0xFFD700, 0.8);
        visual.strokeCircle(rightX, topY + 60, 25);
        visual.setDepth(201);

        // Partner traits (from breeding genes)
        const traits = window.BreedingEngine?.getCreatureTraits(this.partnerGenes);
        const phenotype = traits?.phenotype || {};

        const traitText = this.add.text(rightX, topY + 100, `Body: ${phenotype.bodyShape || 'Unknown'}`, {
            fontSize: '11px',
            color: '#CCCCCC'
        }).setOrigin(0.5).setDepth(201);

        const patternText = this.add.text(rightX, topY + 115, `Pattern: ${phenotype.pattern || 'Unknown'}`, {
            fontSize: '11px',
            color: '#CCCCCC'
        }).setOrigin(0.5).setDepth(201);

        // Reroll partner button
        const rerollBtn = this.add.text(rightX, topY + 140, '🔄 New Partner', {
            fontSize: '11px',
            color: '#88CCFF',
            backgroundColor: '#1A1A3E',
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setDepth(201).setInteractive();

        rerollBtn.on('pointerdown', () => {
            this.generatePartner();
            this.refreshPartnerDisplay(width, height);
            window.AudioManager?.playButtonClick?.();
        });

        rerollBtn.on('pointerover', () => rerollBtn.setColor('#FFFFFF'));
        rerollBtn.on('pointerout', () => rerollBtn.setColor('#88CCFF'));

        this.elements.push(label, nameText, visual, traitText, patternText, rerollBtn);
    }

    refreshPartnerDisplay(width, height) {
        // Remove old partner elements and recreate
        // For simplicity, we'll just update the compatibility display
        this.updateCompatibilityDisplay();
    }

    displayCompatibility(width, height) {
        const centerX = width / 2;
        const topY = this.panelBounds.y + 250;

        // Compatibility label
        const label = this.add.text(centerX, topY, 'Genetic Compatibility', {
            fontSize: '12px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(201);

        // Compatibility percentage
        const percentage = this.compatibility?.percentage || 50;
        const color = percentage >= 70 ? '#00FF00' : percentage >= 40 ? '#FFFF00' : '#FF6666';

        this.compatibilityText = this.add.text(centerX, topY + 25, `${percentage}%`, {
            fontSize: '28px',
            color: color,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        // Compatibility bar
        const barWidth = 200;
        const barHeight = 10;
        const barX = centerX - barWidth / 2;
        const barY = topY + 55;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x333333, 1);
        barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);
        barBg.setDepth(201);

        const barFill = this.add.graphics();
        barFill.fillStyle(parseInt(color.replace('#', ''), 16), 0.9);
        barFill.fillRoundedRect(barX, barY, barWidth * (percentage / 100), barHeight, 5);
        barFill.setDepth(202);

        // Compatibility explanation
        const explanation = percentage >= 70
            ? 'Excellent match! High trait diversity.'
            : percentage >= 40
                ? 'Good compatibility. Offspring will inherit mixed traits.'
                : 'Low compatibility. Consider a different partner.';

        const explanationText = this.add.text(centerX, topY + 75, explanation, {
            fontSize: '10px',
            color: '#888888',
            align: 'center',
            wordWrap: { width: 250 }
        }).setOrigin(0.5).setDepth(201);

        this.elements.push(label, this.compatibilityText, barBg, barFill, explanationText);
    }

    updateCompatibilityDisplay() {
        if (this.compatibilityText) {
            const percentage = this.compatibility?.percentage || 50;
            const color = percentage >= 70 ? '#00FF00' : percentage >= 40 ? '#FFFF00' : '#FF6666';
            this.compatibilityText.setText(`${percentage}%`);
            this.compatibilityText.setColor(color);
        }
    }

    createBreedButton(width, height) {
        const centerX = width / 2;
        const buttonY = this.panelBounds.y + this.panelBounds.height - 100;

        // Check if breeding is available
        const status = getGameState().getBreedingShrineStatus?.() || { canBreed: true, cooldownRemaining: 0 };
        const canBreed = status.canBreed && status.cooldownRemaining <= 0;

        // Button background
        const btnWidth = 180;
        const btnHeight = 45;

        this.breedButtonBg = this.add.graphics();
        this.breedButtonBg.fillStyle(canBreed ? 0x4B0082 : 0x333333, 1);
        this.breedButtonBg.fillRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
        this.breedButtonBg.lineStyle(2, canBreed ? 0xFFD700 : 0x666666, 1);
        this.breedButtonBg.strokeRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
        this.breedButtonBg.setDepth(201);

        // Button text
        const buttonText = canBreed ? '✨ Begin Breeding ✨' : `⏳ ${this.formatCooldown(status.cooldownRemaining)}`;

        this.breedButton = this.add.text(centerX, buttonY + btnHeight / 2, buttonText, {
            fontSize: '16px',
            color: canBreed ? '#FFFFFF' : '#888888',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        if (canBreed) {
            // Make interactive
            const hitArea = new Phaser.Geom.Rectangle(
                centerX - btnWidth / 2,
                buttonY,
                btnWidth,
                btnHeight
            );

            this.breedButton.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

            this.breedButton.on('pointerdown', () => this.attemptBreeding());
            this.breedButton.on('pointerover', () => {
                this.breedButtonBg.clear();
                this.breedButtonBg.fillStyle(0x6B21A8, 1);
                this.breedButtonBg.fillRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
                this.breedButtonBg.lineStyle(2, 0xFFD700, 1);
                this.breedButtonBg.strokeRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
            });
            this.breedButton.on('pointerout', () => {
                this.breedButtonBg.clear();
                this.breedButtonBg.fillStyle(0x4B0082, 1);
                this.breedButtonBg.fillRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
                this.breedButtonBg.lineStyle(2, 0xFFD700, 1);
                this.breedButtonBg.strokeRoundedRect(centerX - btnWidth / 2, buttonY, btnWidth, btnHeight, 10);
            });
        }

        this.elements.push(this.breedButtonBg, this.breedButton);
    }

    attemptBreeding() {
        if (this.breedingInProgress) return;

        this.breedingInProgress = true;

        // Show loading state
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Breeding in progress...');
        }

        // Perform breeding after short delay for dramatic effect
        this.time.delayedCall(1500, () => {
            try {
                const result = getGameState().attemptBreeding?.(this.partnerGenes);

                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }

                if (result && result.offspringGenes) {
                    this.showBreedingSuccess(result);
                } else {
                    this.showBreedingError('Breeding failed. Try again later.');
                }
            } catch (error) {
                console.error('[BreedingShrineScene] Breeding error:', error);
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                this.showBreedingError('Breeding failed due to an error.');
            }

            this.breedingInProgress = false;
        });

        // Play mystical sound
        window.AudioManager?.playAchievement?.();

        // Trigger atmospheric effect
        if (window.FXLibrary) {
            const { width, height } = this.scale;
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 20,
                color: [0xFFD700, 0x9370DB, 0xFF69B4],
                duration: 2000
            });
        }
    }

    showBreedingSuccess(result) {
        const { width, height } = this.scale;

        // Clear current panel content
        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];

        // Keep overlay
        this.createOverlay(width, height);

        // Success panel
        const panelWidth = Math.min(320, width - 40);
        const panelHeight = 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFFD700, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setDepth(201);

        // Success title
        const title = this.add.text(width / 2, panelY + 30, '🎉 Breeding Successful! 🎉', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Offspring info
        const offspringData = result.offspringData || {};
        const traits = offspringData.traits || {};

        let y = panelY + 80;

        const subtitleText = this.add.text(width / 2, y, 'Offspring Traits:', {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(202);
        y += 30;

        // Display inherited traits
        Object.entries(traits).slice(0, 5).forEach(([traitKey, traitData]) => {
            const traitName = traitData.trait || traitKey;
            const variation = traitData.variation || 'Unknown';

            this.add.text(width / 2, y, `${traitName}: ${variation}`, {
                fontSize: '12px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(202);
            y += 25;
        });

        // XP reward message
        y += 10;
        this.add.text(width / 2, y, '+25 XP earned!', {
            fontSize: '14px',
            color: '#00FF00'
        }).setOrigin(0.5).setDepth(202);

        // Continue button
        const btnY = panelY + panelHeight - 50;
        const continueBtn = this.add.text(width / 2, btnY, 'Continue', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#4B0082',
            padding: { x: 30, y: 10 }
        }).setOrigin(0.5).setDepth(202).setInteractive();

        continueBtn.on('pointerdown', () => {
            this.closeScene();
        });

        continueBtn.on('pointerover', () => continueBtn.setStyle({ backgroundColor: '#6B21A8' }));
        continueBtn.on('pointerout', () => continueBtn.setStyle({ backgroundColor: '#4B0082' }));

        // Play celebration sound
        window.AudioManager?.playLevelUp?.();
    }

    showBreedingError(message) {
        const { width, height } = this.scale;

        const errorText = this.add.text(width / 2, height / 2 + 100, message, {
            fontSize: '14px',
            color: '#FF6666',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 10 }
        }).setOrigin(0.5).setDepth(300);

        // Auto-dismiss
        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });

        window.AudioManager?.playError?.();
    }

    createCloseButton(width) {
        const closeX = this.panelBounds.x + this.panelBounds.width - 25;
        const closeY = this.panelBounds.y + 20;

        this.closeButton = this.add.text(closeX, closeY, '✕', {
            fontSize: '24px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(202).setInteractive();

        this.closeButton.on('pointerdown', () => this.closeScene());
        this.closeButton.on('pointerover', () => this.closeButton.setColor('#FF6666'));
        this.closeButton.on('pointerout', () => this.closeButton.setColor('#FFFFFF'));

        this.elements.push(this.closeButton);
    }

    displayBreedingHistory(width, height) {
        const status = getGameState().getBreedingShrineStatus?.() || { breedingHistory: [] };
        const history = status.breedingHistory || [];

        const bottomY = this.panelBounds.y + this.panelBounds.height - 30;

        const historyText = this.add.text(width / 2, bottomY, `Total breedings: ${history.length}`, {
            fontSize: '10px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(201);

        this.elements.push(historyText);
    }

    closeScene() {
        // Resume game scene
        try {
            this.scene.resume('GameScene');
        } catch (e) {
            // Scene might not exist
        }

        this.scene.stop('BreedingShrineScene');
    }

    getCreatureColor(genes) {
        if (!genes) return 0x9370DB;

        const rarityColors = {
            common: 0x808080,
            uncommon: 0x00CC00,
            rare: 0x0088FF,
            epic: 0xAA00FF,
            legendary: 0xFFD700
        };

        return rarityColors[genes.rarity] || 0x9370DB;
    }

    getAffinityEmoji(affinity) {
        const emojis = {
            star: '⭐',
            moon: '🌙',
            nebula: '🌌',
            crystal: '💎',
            void: '🕳️'
        };
        return emojis[affinity] || '✨';
    }

    formatCooldown(ms) {
        if (!ms || ms <= 0) return 'Ready';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    shutdown() {
        console.log('[BreedingShrineScene] Shutting down...');

        // Clean up all elements
        this.elements.forEach(el => {
            try {
                el?.destroy?.();
            } catch (e) {
                // Element might already be destroyed
            }
        });
        this.elements = [];

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        console.log('[BreedingShrineScene] Cleanup complete');
    }
}

// Export for module systems
export default BreedingShrineScene;
