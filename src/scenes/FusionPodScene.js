/**
 * FusionPodScene - Cosmic fusion pod for creature fusion
 * Allows players to fuse TWO of their own creatures to create offspring
 *
 * Features:
 * - Two-creature selection from player's collection
 * - Adult-only fusion requirement
 * - Compatibility calculation and display
 * - Fusion cooldown management
 * - Offspring trait preview with parent inheritance display
 * - Generation tracking for lineage
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

class FusionPodScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FusionPodScene' });

        // Selected parents (from player's collection)
        this.parent1Index = null;
        this.parent1Data = null;
        this.parent2Index = null;
        this.parent2Data = null;

        this.compatibility = null;
        this.breedingInProgress = false;

        // UI elements
        this.overlay = null;
        this.panel = null;
        this.elements = [];
        this.selectionModal = null;
        this.selectionModalElements = [];
    }

    create() {
        console.log('[FusionPodScene] Creating fusion pod...');

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

        // Check breeding requirements
        const collection = getGameState().getCreatureCollection?.() || [];
        const adultCreatures = this.getAdultCreatures(collection);

        if (collection.length < 2) {
            this.showRequirementNotMet(width, height, 'need_creatures', collection.length);
            return;
        }

        if (adultCreatures.length < 2) {
            this.showRequirementNotMet(width, height, 'need_adults', adultCreatures.length);
            return;
        }

        // Create the breeding UI
        this.createOverlay(width, height);
        this.createMainPanel(width, height);
        this.createTitle(width);
        this.createParentSlots(width, height);
        this.createCompatibilityDisplay(width, height);
        this.createBreedButton(width, height);
        this.createCloseButton(width);

        // Play fusion pod ambient sound and start fusion music
        if (window.AudioManager) {
            window.AudioManager.playFusionAmbient?.();
            window.AudioManager.playAreaMusic?.('fusion');
        }

        // Hide loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        console.log('[FusionPodScene] Fusion pod created');
    }

    /**
     * Get adult creatures from collection
     */
    getAdultCreatures(collection) {
        return collection.filter(creature => {
            // Check lifecycle stage
            const lifecycle = creature.lifecycle || {};
            const stage = lifecycle.stage;

            // If stage is stored, check if adult or elder
            if (stage) {
                return stage === 'adult' || stage === 'elder';
            }

            // Calculate from birthDate if no stage stored
            const birthDate = lifecycle.birthDate || creature.hatchTime;
            if (birthDate) {
                const daysAlive = (Date.now() - birthDate) / (1000 * 60 * 60 * 24);
                return daysAlive >= 2; // Adult at day 2+
            }

            // Fallback: assume not adult if can't determine
            return false;
        });
    }

    /**
     * Check if a specific creature is adult
     */
    isCreatureAdult(creature) {
        if (!creature) return false;

        const lifecycle = creature.lifecycle || {};
        const stage = lifecycle.stage;

        if (stage) {
            return stage === 'adult' || stage === 'elder';
        }

        const birthDate = lifecycle.birthDate || creature.hatchTime;
        if (birthDate) {
            const daysAlive = (Date.now() - birthDate) / (1000 * 60 * 60 * 24);
            return daysAlive >= 2;
        }

        return false;
    }

    /**
     * Show requirement not met screen
     */
    showRequirementNotMet(width, height, reason, count) {
        // CRITICAL: Hide any loading overlay first
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        this.createOverlay(width, height);

        const panelWidth = Math.min(350, width - 40);
        const panelHeight = 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFF6666, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setDepth(200);

        let title, message, icon;

        if (reason === 'need_creatures') {
            icon = '🥚';
            title = 'More Creatures Needed';
            message = `You need at least 2 creatures to fuse.\n\nYou have: ${count}/2 creatures\n\nHatch another egg to unlock fusion!`;
        } else {
            icon = '⏳';
            title = 'Adults Required';
            message = `Both creatures must be adults to fuse.\n\nAdult creatures: ${count}/2\n\nCreatures become adults on Day 3.\nKeep caring for them!`;
        }

        this.add.text(width / 2, panelY + 40, `${icon} ${title}`, {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        this.add.text(width / 2, panelY + 130, message, {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(201);

        // Close button
        const closeBtn = this.add.text(width / 2, panelY + panelHeight - 40, 'Got it', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#4B0082',
            padding: { x: 30, y: 10 }
        }).setOrigin(0.5).setDepth(201).setInteractive();

        closeBtn.on('pointerdown', () => this.closeScene());
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#6B21A8' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#4B0082' }));
    }

    createOverlay(width, height) {
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(0x050214, 0.9);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(100);

        // Create twinkling stars
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 3);

            const star = this.add.graphics();
            star.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
            star.fillCircle(x, y, size);
            star.setDepth(101);

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

        this.elements.push(this.overlay);
    }

    createMainPanel(width, height) {
        const panelWidth = Math.min(400, width - 30);
        const panelHeight = Math.min(550, height - 60);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        this.panel = this.add.graphics();
        this.panel.fillStyle(0x1A1A3E, 0.95);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.lineStyle(3, 0x9370DB, 1);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.lineStyle(1, 0xFFD700, 0.3);
        this.panel.strokeRoundedRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 18);
        this.panel.setDepth(200);

        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
        this.elements.push(this.panel);
    }

    createTitle(width) {
        const titleText = this.add.text(width / 2, this.panelBounds.y + 30, '🧬 Fusion Pod 🧬', {
            fontSize: '22px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(201);

        const subtitleText = this.add.text(width / 2, this.panelBounds.y + 55, 'Select two adult creatures to fuse', {
            fontSize: '12px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(201);

        this.elements.push(titleText, subtitleText);
    }

    createParentSlots(width, height) {
        const slotWidth = 130;
        const slotHeight = 160;
        const gap = 30;
        const startY = this.panelBounds.y + 85;

        // Parent 1 slot (left)
        const slot1X = width / 2 - slotWidth - gap / 2;
        this.createParentSlot(slot1X, startY, slotWidth, slotHeight, 1);

        // Center "+" symbol
        const plusText = this.add.text(width / 2, startY + slotHeight / 2, '+', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(plusText);

        // Parent 2 slot (right)
        const slot2X = width / 2 + gap / 2;
        this.createParentSlot(slot2X, startY, slotWidth, slotHeight, 2);
    }

    createParentSlot(x, y, width, height, slotNum) {
        // Slot background
        const slot = this.add.graphics();
        slot.fillStyle(0x2A1A4E, 0.8);
        slot.fillRoundedRect(x, y, width, height, 12);
        slot.lineStyle(2, 0x6B4EAA, 1);
        slot.strokeRoundedRect(x, y, width, height, 12);
        slot.setDepth(201);

        // Label
        const label = this.add.text(x + width / 2, y + 15, `Parent ${slotNum}`, {
            fontSize: '12px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(202);

        // Selection indicator
        const parentData = slotNum === 1 ? this.parent1Data : this.parent2Data;

        let displayContent;
        if (parentData) {
            displayContent = this.createCreatureDisplay(x, y, width, height, parentData, slotNum);
        } else {
            // Empty slot - tap to select
            const placeholder = this.add.text(x + width / 2, y + height / 2, '👆\nTap to\nSelect', {
                fontSize: '14px',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5).setDepth(202);
            displayContent = [placeholder];
        }

        // Make slot interactive
        const hitZone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setDepth(203);

        hitZone.on('pointerdown', () => {
            this.openCreatureSelector(slotNum);
        });

        hitZone.on('pointerover', () => {
            slot.clear();
            slot.fillStyle(0x3A2A5E, 0.9);
            slot.fillRoundedRect(x, y, width, height, 12);
            slot.lineStyle(2, 0x9370DB, 1);
            slot.strokeRoundedRect(x, y, width, height, 12);
        });

        hitZone.on('pointerout', () => {
            slot.clear();
            slot.fillStyle(0x2A1A4E, 0.8);
            slot.fillRoundedRect(x, y, width, height, 12);
            slot.lineStyle(2, 0x6B4EAA, 1);
            slot.strokeRoundedRect(x, y, width, height, 12);
        });

        // Store references
        if (slotNum === 1) {
            this.slot1Elements = { slot, label, content: displayContent, hitZone };
        } else {
            this.slot2Elements = { slot, label, content: displayContent, hitZone };
        }

        this.elements.push(slot, label, hitZone, ...displayContent);
    }

    createCreatureDisplay(slotX, slotY, slotWidth, slotHeight, creature, slotNum) {
        const centerX = slotX + slotWidth / 2;
        const elements = [];

        // Creature visual (colored circle based on rarity)
        const visual = this.add.graphics();
        const color = this.getCreatureColor(creature.genes || creature.dna);
        visual.fillStyle(color, 0.9);
        visual.fillCircle(centerX, slotY + 55, 22);
        visual.lineStyle(2, 0xFFD700, 0.8);
        visual.strokeCircle(centerX, slotY + 55, 22);
        visual.setDepth(202);
        elements.push(visual);

        // Creature name
        const name = this.add.text(centerX, slotY + 90, creature.name || 'Unknown', {
            fontSize: '11px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);
        elements.push(name);

        // Rarity
        const rarity = creature.rarity || creature.genes?.rarity || 'common';
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };
        const rarityText = this.add.text(centerX, slotY + 105, rarity.toUpperCase(), {
            fontSize: '9px',
            color: rarityColors[rarity] || '#FFFFFF'
        }).setOrigin(0.5).setDepth(202);
        elements.push(rarityText);

        // Stage indicator
        const stage = this.getCreatureStage(creature);
        const stageEmoji = stage === 'elder' ? '👑' : '✨';
        const stageText = this.add.text(centerX, slotY + 120, `${stageEmoji} ${stage}`, {
            fontSize: '10px',
            color: '#88FF88'
        }).setOrigin(0.5).setDepth(202);
        elements.push(stageText);

        // Generation indicator
        const generation = creature.generation || 1;
        const genText = this.add.text(centerX, slotY + 135, `Gen ${generation}`, {
            fontSize: '9px',
            color: '#888888'
        }).setOrigin(0.5).setDepth(202);
        elements.push(genText);

        return elements;
    }

    getCreatureStage(creature) {
        const lifecycle = creature.lifecycle || {};
        if (lifecycle.stage) return lifecycle.stage;

        const birthDate = lifecycle.birthDate || creature.hatchTime;
        if (birthDate) {
            const daysAlive = (Date.now() - birthDate) / (1000 * 60 * 60 * 24);
            if (daysAlive >= 9) return 'elder';
            if (daysAlive >= 2) return 'adult';
            if (daysAlive >= 1) return 'juvenile';
            return 'baby';
        }
        return 'unknown';
    }

    openCreatureSelector(slotNum) {
        console.log(`[FusionPodScene] Opening creature selector for slot ${slotNum}`);

        const { width, height } = this.scale;
        const collection = getGameState().getCreatureCollection?.() || [];

        // Filter for adult creatures only
        const adultCreatures = collection.map((creature, index) => ({ ...creature, collectionIndex: index }))
            .filter(creature => this.isCreatureAdult(creature));

        // Create modal overlay
        const modalOverlay = this.add.graphics();
        modalOverlay.fillStyle(0x000000, 0.7);
        modalOverlay.fillRect(0, 0, width, height);
        modalOverlay.setDepth(300);
        modalOverlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Modal panel
        const modalWidth = Math.min(340, width - 40);
        const modalHeight = Math.min(400, height - 80);
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const modalPanel = this.add.graphics();
        modalPanel.fillStyle(0x1A1A3E, 0.98);
        modalPanel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        modalPanel.lineStyle(3, 0x9370DB, 1);
        modalPanel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        modalPanel.setDepth(301);

        // Modal title
        const modalTitle = this.add.text(width / 2, modalY + 25, `Select Parent ${slotNum}`, {
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(302);

        const modalSubtitle = this.add.text(width / 2, modalY + 48, 'Only adult creatures can fuse', {
            fontSize: '11px',
            color: '#888888'
        }).setOrigin(0.5).setDepth(302);

        this.selectionModalElements = [modalOverlay, modalPanel, modalTitle, modalSubtitle];

        // List creatures
        let rowY = modalY + 75;
        const rowHeight = 55;
        const maxVisible = Math.floor((modalHeight - 120) / rowHeight);

        adultCreatures.slice(0, maxVisible).forEach((creature, idx) => {
            // Check if already selected in other slot
            const otherSlotIndex = slotNum === 1 ? this.parent2Index : this.parent1Index;
            const isSelectedElsewhere = creature.collectionIndex === otherSlotIndex;

            const rowBg = this.add.graphics();
            rowBg.fillStyle(isSelectedElsewhere ? 0x333333 : 0x2A1A4E, 0.8);
            rowBg.fillRoundedRect(modalX + 15, rowY, modalWidth - 30, rowHeight - 5, 8);
            rowBg.setDepth(302);

            // Creature icon
            const iconColor = this.getCreatureColor(creature.genes || creature.dna);
            const icon = this.add.graphics();
            icon.fillStyle(iconColor, 0.9);
            icon.fillCircle(modalX + 40, rowY + 22, 15);
            icon.setDepth(303);

            // Creature info
            const name = this.add.text(modalX + 65, rowY + 8, creature.name || 'Unknown', {
                fontSize: '13px',
                color: isSelectedElsewhere ? '#666666' : '#FFFFFF',
                fontStyle: 'bold'
            }).setDepth(303);

            const rarity = creature.rarity || creature.genes?.rarity || 'common';
            const generation = creature.generation || 1;
            const info = this.add.text(modalX + 65, rowY + 26, `${rarity} • Gen ${generation}`, {
                fontSize: '10px',
                color: '#888888'
            }).setDepth(303);

            // Select button (if not selected elsewhere)
            if (!isSelectedElsewhere) {
                const selectBtn = this.add.text(modalX + modalWidth - 60, rowY + 18, 'SELECT', {
                    fontSize: '11px',
                    color: '#00FF00',
                    backgroundColor: '#1A3A1A',
                    padding: { x: 8, y: 4 }
                }).setOrigin(0.5).setDepth(303).setInteractive();

                selectBtn.on('pointerdown', () => {
                    this.selectCreatureForSlot(slotNum, creature.collectionIndex, creature);
                    // Note: closeSelectionModal is now called inside selectCreatureForSlot
                });

                selectBtn.on('pointerover', () => selectBtn.setStyle({ backgroundColor: '#2A5A2A' }));
                selectBtn.on('pointerout', () => selectBtn.setStyle({ backgroundColor: '#1A3A1A' }));

                this.selectionModalElements.push(selectBtn);
            } else {
                const usedLabel = this.add.text(modalX + modalWidth - 55, rowY + 18, 'In Use', {
                    fontSize: '10px',
                    color: '#666666'
                }).setOrigin(0.5).setDepth(303);
                this.selectionModalElements.push(usedLabel);
            }

            this.selectionModalElements.push(rowBg, icon, name, info);
            rowY += rowHeight;
        });

        // Close button
        const closeBtn = this.add.text(width / 2, modalY + modalHeight - 30, 'Cancel', {
            fontSize: '14px',
            color: '#AAAAAA',
            backgroundColor: '#333333',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(302).setInteractive();

        closeBtn.on('pointerdown', () => this.closeSelectionModal());
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#555555' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#333333' }));

        this.selectionModalElements.push(closeBtn);

        // Close on overlay click
        modalOverlay.on('pointerdown', () => this.closeSelectionModal());
    }

    closeSelectionModal() {
        this.selectionModalElements.forEach(el => el?.destroy?.());
        this.selectionModalElements = [];
    }

    selectCreatureForSlot(slotNum, collectionIndex, creature) {
        console.log(`[FusionPodScene] Selected creature ${creature.name} for slot ${slotNum}`);

        if (slotNum === 1) {
            this.parent1Index = collectionIndex;
            this.parent1Data = creature;
        } else {
            this.parent2Index = collectionIndex;
            this.parent2Data = creature;
        }

        // Close modal FIRST to avoid input conflicts during UI refresh
        this.closeSelectionModal();

        // Small delay to let Phaser process the modal cleanup before refreshing
        this.time.delayedCall(50, () => {
            // Refresh the UI
            this.refreshUI();

            // Calculate compatibility if both selected
            if (this.parent1Data && this.parent2Data) {
                this.calculateCompatibility();
            }

            // Play parent selection sound
            window.AudioManager?.playFusionSelect?.();
        });
    }

    refreshUI() {
        const { width, height } = this.scale;

        // Clear and recreate slots
        ['slot1Elements', 'slot2Elements'].forEach(key => {
            if (this[key]) {
                const { slot, label, content, hitZone } = this[key];
                slot?.destroy?.();
                label?.destroy?.();
                hitZone?.destroy?.();
                content?.forEach(el => el?.destroy?.());
            }
        });

        // Remove from elements array
        this.elements = this.elements.filter(el => {
            if (!el || !el.active) return false;
            return true;
        });

        // Recreate slots
        this.createParentSlots(width, height);

        // Update compatibility display
        this.updateCompatibilityDisplay();

        // Update breed button
        this.updateBreedButton();
    }

    calculateCompatibility() {
        if (!this.parent1Data || !this.parent2Data) {
            this.compatibility = null;
            return;
        }

        const genes1 = this.parent1Data.genes || this.parent1Data.dna;
        const genes2 = this.parent2Data.genes || this.parent2Data.dna;

        if (window.BreedingEngine && genes1?.mendelianGenes && genes2?.mendelianGenes) {
            this.compatibility = window.BreedingEngine.getBreedingCompatibility(
                genes1.mendelianGenes,
                genes2.mendelianGenes
            );
        } else {
            // Fallback compatibility calculation
            this.compatibility = {
                percentage: Phaser.Math.Between(50, 90),
                score: 70,
                maxScore: 100
            };
        }

        console.log('[FusionPodScene] Compatibility:', this.compatibility);

        // Play compatibility sound based on result
        const isGoodCompatibility = this.compatibility.percentage >= 70 || this.compatibility.score >= 70;
        window.AudioManager?.playFusionCompatibility?.(isGoodCompatibility);
    }

    createCompatibilityDisplay(width, height) {
        const centerX = width / 2;
        const topY = this.panelBounds.y + 265;

        // Compatibility label
        const label = this.add.text(centerX, topY, 'Genetic Compatibility', {
            fontSize: '12px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(201);

        // Placeholder when no selection
        this.compatibilityText = this.add.text(centerX, topY + 25, '--', {
            fontSize: '28px',
            color: '#666666',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        // Compatibility bar background
        const barWidth = 200;
        const barHeight = 10;
        const barX = centerX - barWidth / 2;
        const barY = topY + 55;

        this.compatBarBg = this.add.graphics();
        this.compatBarBg.fillStyle(0x333333, 1);
        this.compatBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);
        this.compatBarBg.setDepth(201);

        this.compatBarFill = this.add.graphics();
        this.compatBarFill.setDepth(202);

        // Explanation text
        this.explanationText = this.add.text(centerX, topY + 75, 'Select both parents to see compatibility', {
            fontSize: '10px',
            color: '#888888',
            align: 'center',
            wordWrap: { width: 250 }
        }).setOrigin(0.5).setDepth(201);

        // Offspring Predictions Section
        this.predictionsLabel = this.add.text(centerX, topY + 105, '✨ Offspring Predictions ✨', {
            fontSize: '11px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201).setAlpha(0);

        // Predictions container for dynamic content
        this.predictionsContainer = this.add.container(centerX, topY + 130).setDepth(201).setAlpha(0);

        this.elements.push(label, this.compatibilityText, this.compatBarBg, this.compatBarFill,
            this.explanationText, this.predictionsLabel, this.predictionsContainer);
    }

    /**
     * Calculate offspring predictions based on parent data
     */
    calculateOffspringPredictions() {
        if (!this.parent1Data || !this.parent2Data) return null;

        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const rarityColors = {
            common: '#888888',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        // Calculate expected rarity
        const p1RarityIdx = rarities.indexOf(this.parent1Data.rarity || 'common');
        const p2RarityIdx = rarities.indexOf(this.parent2Data.rarity || 'common');
        const avgRarityIdx = Math.floor((p1RarityIdx + p2RarityIdx) / 2);
        const baseRarity = rarities[avgRarityIdx];

        // Calculate upgrade chance based on compatibility
        const compatibility = this.compatibility?.percentage || 50;
        const upgradeChance = Math.min(20 + Math.floor(compatibility / 10), 40); // 20-40% based on compatibility

        // Get cosmic affinities
        const p1Affinity = this.parent1Data.genes?.cosmicAffinity?.element ||
                          this.parent1Data.cosmicAffinity || null;
        const p2Affinity = this.parent2Data.genes?.cosmicAffinity?.element ||
                          this.parent2Data.cosmicAffinity || null;

        // Determine potential affinities
        const affinityOptions = [];
        if (p1Affinity) affinityOptions.push(p1Affinity);
        if (p2Affinity && p2Affinity !== p1Affinity) affinityOptions.push(p2Affinity);
        if (affinityOptions.length === 0) affinityOptions.push('star');

        // Generation bonus
        const p1Gen = this.parent1Data.generation || 1;
        const p2Gen = this.parent2Data.generation || 1;
        const offspringGen = Math.max(p1Gen, p2Gen) + 1;
        const genBonus = Math.round(offspringGen * 5); // 5% per generation

        // Get body types from parents
        const p1BodyType = this.parent1Data.genes?.traits?.bodyShape?.type ||
                          this.parent1Data.dna?.traits?.bodyShape?.type || null;
        const p2BodyType = this.parent2Data.genes?.traits?.bodyShape?.type ||
                          this.parent2Data.dna?.traits?.bodyShape?.type || null;

        return {
            baseRarity,
            baseRarityColor: rarityColors[baseRarity],
            upgradeChance,
            potentialUpgradeRarity: avgRarityIdx < rarities.length - 1 ? rarities[avgRarityIdx + 1] : null,
            potentialUpgradeColor: avgRarityIdx < rarities.length - 1 ? rarityColors[rarities[avgRarityIdx + 1]] : null,
            affinityOptions,
            generation: offspringGen,
            genBonus,
            bodyTypes: [p1BodyType, p2BodyType].filter(Boolean),
            compatibility
        };
    }

    updateCompatibilityDisplay() {
        if (!this.compatibilityText) return;

        const { width } = this.scale;
        const centerX = width / 2;
        const barWidth = 200;
        const barX = centerX - barWidth / 2;
        const barY = this.panelBounds.y + 320;

        // Stop any running bonus tween before clearing predictions
        if (this.bonusLineTween) {
            this.bonusLineTween.stop();
            this.bonusLineTween = null;
        }

        // Clear previous predictions
        if (this.predictionsContainer) {
            this.predictionsContainer.removeAll(true);
        }

        if (this.compatibility && this.parent1Data && this.parent2Data) {
            const percentage = this.compatibility.percentage || 50;
            const color = percentage >= 70 ? '#00FF00' : percentage >= 40 ? '#FFFF00' : '#FF6666';

            this.compatibilityText.setText(`${percentage}%`);
            this.compatibilityText.setColor(color);

            // Update bar
            this.compatBarFill.clear();
            this.compatBarFill.fillStyle(parseInt(color.replace('#', ''), 16), 0.9);
            this.compatBarFill.fillRoundedRect(barX, barY, barWidth * (percentage / 100), 10, 5);

            // Update explanation
            const explanation = percentage >= 70
                ? 'Excellent match! High genetic diversity.'
                : percentage >= 40
                    ? 'Good compatibility. Mixed trait inheritance.'
                    : 'Low compatibility. Offspring may have limited traits.';
            this.explanationText?.setText(explanation);

            // Show predictions
            this.showOffspringPredictions();
        } else {
            this.compatibilityText.setText('--');
            this.compatibilityText.setColor('#666666');
            this.compatBarFill?.clear();
            this.explanationText?.setText('Select both parents to see compatibility');

            // Hide predictions
            this.predictionsLabel?.setAlpha(0);
            this.predictionsContainer?.setAlpha(0);
        }
    }

    /**
     * Display offspring predictions in the UI
     */
    showOffspringPredictions() {
        const predictions = this.calculateOffspringPredictions();
        if (!predictions || !this.predictionsContainer) return;

        // Show the section
        this.predictionsLabel?.setAlpha(1);
        this.predictionsContainer.setAlpha(1);

        let yOffset = 0;
        const lineHeight = 18;
        const { width } = this.scale;
        const contentWidth = Math.min(280, width - 60);

        // Affinity icons
        const affinityIcons = {
            star: '⭐',
            moon: '🌙',
            nebula: '🌌',
            crystal: '💎',
            void: '🕳️',
            aurora: '🌈'
        };

        // --- Rarity Prediction ---
        const rarityLine = this.add.text(0, yOffset,
            `🎲 Expected Rarity: `, {
                fontSize: '10px',
                color: '#AAAAAA'
            }).setOrigin(0.5, 0);
        this.predictionsContainer.add(rarityLine);

        const rarityValue = this.add.text(rarityLine.width / 2 + 5, yOffset,
            predictions.baseRarity.toUpperCase(), {
                fontSize: '10px',
                color: predictions.baseRarityColor,
                fontStyle: 'bold'
            }).setOrigin(0, 0);
        this.predictionsContainer.add(rarityValue);

        yOffset += lineHeight;

        // --- Upgrade Chance ---
        if (predictions.potentialUpgradeRarity) {
            const upgradeLine = this.add.text(0, yOffset,
                `📈 ${predictions.upgradeChance}% chance for ${predictions.potentialUpgradeRarity.toUpperCase()}!`, {
                    fontSize: '10px',
                    color: predictions.potentialUpgradeColor,
                    fontStyle: 'bold'
                }).setOrigin(0.5, 0);
            this.predictionsContainer.add(upgradeLine);
            yOffset += lineHeight;
        }

        // --- Generation & Bonus ---
        const genLine = this.add.text(0, yOffset,
            `👶 Generation ${predictions.generation} (+${predictions.genBonus}% Cosmic Power)`, {
                fontSize: '10px',
                color: '#88CCFF'
            }).setOrigin(0.5, 0);
        this.predictionsContainer.add(genLine);
        yOffset += lineHeight;

        // --- Cosmic Affinity Options ---
        if (predictions.affinityOptions.length > 0) {
            const affinityStr = predictions.affinityOptions
                .map(a => `${affinityIcons[a] || '✨'} ${a}`)
                .join(' or ');
            const affinityLine = this.add.text(0, yOffset,
                `🌟 Possible Affinity: ${affinityStr}`, {
                    fontSize: '10px',
                    color: '#E6E6FA'
                }).setOrigin(0.5, 0);
            this.predictionsContainer.add(affinityLine);
            yOffset += lineHeight;
        }

        // --- Body Type Heritage ---
        if (predictions.bodyTypes.length > 0) {
            const bodyStr = predictions.bodyTypes.length === 2
                ? `May inherit ${predictions.bodyTypes[0]} or ${predictions.bodyTypes[1]} form`
                : `Likely ${predictions.bodyTypes[0]} form`;
            const bodyLine = this.add.text(0, yOffset, `🧬 ${bodyStr}`, {
                fontSize: '10px',
                color: '#9370DB'
            }).setOrigin(0.5, 0);
            this.predictionsContainer.add(bodyLine);
            yOffset += lineHeight;
        }

        // --- Special Bonus for High Compatibility ---
        if (predictions.compatibility >= 80) {
            yOffset += 5;
            const bonusLine = this.add.text(0, yOffset,
                `💫 BONUS: High compatibility = stronger offspring!`, {
                    fontSize: '10px',
                    color: '#FFD700',
                    fontStyle: 'bold'
                }).setOrigin(0.5, 0);
            this.predictionsContainer.add(bonusLine);

            // Sparkle effect - track the tween for cleanup
            if (this.bonusLineTween) {
                this.bonusLineTween.stop();
            }
            this.bonusLineTween = this.tweens.add({
                targets: bonusLine,
                alpha: { from: 1, to: 0.6 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
    }

    createBreedButton(width, height) {
        const centerX = width / 2;
        const buttonY = this.panelBounds.y + this.panelBounds.height - 110;
        const btnWidth = 180;
        const btnHeight = 45;

        this.breedButtonBg = this.add.graphics();
        this.breedButtonBg.setDepth(201);

        this.breedButton = this.add.text(centerX, buttonY + btnHeight / 2, '🥚 Select Parents First', {
            fontSize: '14px',
            color: '#888888',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        this.breedButtonBounds = { x: centerX - btnWidth / 2, y: buttonY, width: btnWidth, height: btnHeight };

        this.updateBreedButton();

        this.elements.push(this.breedButtonBg, this.breedButton);
    }

    updateBreedButton() {
        if (!this.breedButton || !this.breedButtonBg) return;

        const { x, y, width: btnWidth, height: btnHeight } = this.breedButtonBounds;
        const canBreed = this.parent1Data && this.parent2Data;

        // Check cooldown
        const status = getGameState().getBreedingShrineStatus?.() || { canBreed: true, cooldownRemaining: 0 };
        const onCooldown = status.cooldownRemaining > 0;

        this.breedButtonBg.clear();

        if (canBreed && !onCooldown) {
            this.breedButtonBg.fillStyle(0x4B0082, 1);
            this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 10);
            this.breedButtonBg.lineStyle(2, 0xFFD700, 1);
            this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 10);

            this.breedButton.setText('🥚 Begin Fusion 🥚');
            this.breedButton.setColor('#FFFFFF');

            // Make interactive - CRITICAL: Rectangle must use LOCAL coordinates relative to text origin (0.5, 0.5)
            if (!this.breedButton.input) {
                this.breedButton.setInteractive(
                    new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight),
                    Phaser.Geom.Rectangle.Contains
                );

                this.breedButton.on('pointerdown', () => {
                    console.log('[FusionPodScene] Begin Fusion button clicked!');
                    this.attemptBreeding();
                });
                this.breedButton.on('pointerover', () => {
                    this.breedButtonBg.clear();
                    this.breedButtonBg.fillStyle(0x6B21A8, 1);
                    this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 10);
                    this.breedButtonBg.lineStyle(2, 0xFFD700, 1);
                    this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 10);
                });
                this.breedButton.on('pointerout', () => {
                    this.breedButtonBg.clear();
                    this.breedButtonBg.fillStyle(0x4B0082, 1);
                    this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 10);
                    this.breedButtonBg.lineStyle(2, 0xFFD700, 1);
                    this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 10);
                });
            }
        } else if (onCooldown) {
            this.breedButtonBg.fillStyle(0x333333, 1);
            this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 10);
            this.breedButtonBg.lineStyle(2, 0x666666, 1);
            this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 10);

            this.breedButton.setText(`⏳ ${this.formatCooldown(status.cooldownRemaining)}`);
            this.breedButton.setColor('#888888');
            this.breedButton.disableInteractive();
        } else {
            this.breedButtonBg.fillStyle(0x333333, 1);
            this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 10);
            this.breedButtonBg.lineStyle(2, 0x666666, 1);
            this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 10);

            this.breedButton.setText('🥚 Select Parents First');
            this.breedButton.setColor('#888888');
            this.breedButton.disableInteractive();
        }
    }

    attemptBreeding() {
        if (this.breedingInProgress || !this.parent1Data || !this.parent2Data) return;

        console.log('[FusionPodScene] Attempting fusion...');
        console.log('Parent 1:', this.parent1Data.name);
        console.log('Parent 2:', this.parent2Data.name);

        this.breedingInProgress = true;

        // Show loading
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Creating new life...');
        }

        // Play egg creation sound sequence
        window.AudioManager?.playFusionCreateEgg?.();

        // Particle effect
        const { width, height } = this.scale;
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 30,
                color: [0xFFD700, 0x9370DB, 0xFF69B4],
                duration: 2500
            });
        }

        // Perform breeding after dramatic delay
        this.time.delayedCall(2000, () => {
            try {
                // Get genes from both parents
                const parent1Genes = this.parent1Data.genes?.mendelianGenes ||
                    window.BreedingEngine?.generateInitialGenes();
                const parent2Genes = this.parent2Data.genes?.mendelianGenes ||
                    window.BreedingEngine?.generateInitialGenes();

                // Breed using BreedingEngine
                let offspringGenes;
                if (window.BreedingEngine) {
                    offspringGenes = window.BreedingEngine.breedCreatures(parent1Genes, parent2Genes);
                } else {
                    offspringGenes = parent1Genes; // Fallback
                }

                // BIRTH EVENTS: Roll for special events during breeding FIRST
                // (so we know if twins are coming before creating offspring)
                let birthResult = { events: [], effects: {}, hasRareEvent: false };
                if (window.BirthEventSystem) {
                    birthResult = window.BirthEventSystem.rollBirthEvents(
                        this.parent1Data,
                        this.parent2Data,
                        'common' // Initial rarity check - actual rarity determined per offspring
                    );
                }

                // Check for Twin Birth event
                const isTwinBirth = birthResult.events.some(e => e.id === 'twinBirth');

                if (isTwinBirth) {
                    console.log('[FusionPodScene] 👯 TWIN BIRTH! Creating two creatures...');

                    // Create TWO separate offspring with individual characteristics
                    const twin1Result = this.createOffspringData(offspringGenes);

                    // Generate different genes for twin 2 (another breeding roll)
                    const twin2MendelianGenes = window.BreedingEngine?.breedCreatures(
                        this.parent1Data.genes?.mendelianGenes || window.BreedingEngine?.generateInitialGenes(),
                        this.parent2Data.genes?.mendelianGenes || window.BreedingEngine?.generateInitialGenes()
                    ) || offspringGenes;
                    const twin2Result = this.createOffspringData(twin2MendelianGenes);

                    // Give twins unique identifiers and slight variations
                    twin1Result.offspringData.isTwin = true;
                    twin1Result.offspringData.twinIndex = 1;
                    twin1Result.offspringData.twinSibling = twin2Result.offspringGenes.id;

                    twin2Result.offspringData.isTwin = true;
                    twin2Result.offspringData.twinIndex = 2;
                    twin2Result.offspringData.twinSibling = twin1Result.offspringGenes.id;

                    // Apply birth events to both twins
                    if (birthResult.events.length > 0) {
                        console.log('[FusionPodScene] 🎉 Birth events for twins:', birthResult.events.map(e => e.name));
                        window.BirthEventSystem?.applyBirthEffects(twin1Result.offspringData, birthResult, this.parent1Data, this.parent2Data);
                        window.BirthEventSystem?.applyBirthEffects(twin2Result.offspringData, birthResult, this.parent1Data, this.parent2Data);
                    }

                    // Check secret abilities for each twin
                    [twin1Result, twin2Result].forEach((twinResult, idx) => {
                        const abilityCheckData = {
                            ...twinResult.offspringData,
                            genes: twinResult.offspringGenes,
                            cosmicAffinity: twinResult.offspringGenes.cosmicAffinity,
                            personality: twinResult.offspringGenes.personality?.core,
                            rarity: twinResult.offspringData.rarity
                        };
                        const unlockedAbilities = window.BirthEventSystem?.checkSecretAbilities(abilityCheckData) || [];
                        if (unlockedAbilities.length > 0) {
                            console.log(`[FusionPodScene] 🌟 Twin ${idx + 1} abilities:`, unlockedAbilities.map(a => a.name));
                            twinResult.offspringData.secretAbilities = unlockedAbilities;
                        }
                    });

                    if (window.UXEnhancements) {
                        window.UXEnhancements.hideLoading();
                    }

                    // Launch BreedingHatchScene with TWIN data
                    this.scene.start('BreedingHatchScene', {
                        isTwinBirth: true,
                        twin1: {
                            offspringGenes: twin1Result.offspringGenes,
                            offspringData: twin1Result.offspringData
                        },
                        twin2: {
                            offspringGenes: twin2Result.offspringGenes,
                            offspringData: twin2Result.offspringData
                        },
                        parent1: this.parent1Data,
                        parent2: this.parent2Data,
                        birthEvents: birthResult.events,
                        hasRareEvent: true // Twins are always a rare event
                    });

                } else {
                    // Standard single offspring
                    const result = this.createOffspringData(offspringGenes);

                    // Apply birth event effects to offspring
                    if (birthResult.events.length > 0) {
                        console.log('[FusionPodScene] 🎉 Birth events triggered:', birthResult.events.map(e => e.name));
                        window.BirthEventSystem?.applyBirthEffects(
                            result.offspringData,
                            birthResult,
                            this.parent1Data,
                            this.parent2Data
                        );
                    }

                    // Check for secret abilities based on creature data
                    const abilityCheckData = {
                        ...result.offspringData,
                        genes: result.offspringGenes,
                        cosmicAffinity: result.offspringGenes.cosmicAffinity,
                        personality: result.offspringGenes.personality?.core,
                        rarity: result.offspringData.rarity
                    };
                    const unlockedAbilities = window.BirthEventSystem?.checkSecretAbilities(abilityCheckData) || [];
                    if (unlockedAbilities.length > 0) {
                        console.log('[FusionPodScene] 🌟 Secret abilities unlocked:', unlockedAbilities.map(a => a.name));
                        result.offspringData.secretAbilities = unlockedAbilities;
                    }

                    if (window.UXEnhancements) {
                        window.UXEnhancements.hideLoading();
                    }

                    // Launch the spectacular BreedingHatchScene
                    this.scene.start('BreedingHatchScene', {
                        offspringGenes: result.offspringGenes,
                        offspringData: result.offspringData,
                        parent1: this.parent1Data,
                        parent2: this.parent2Data,
                        birthEvents: birthResult.events,
                        hasRareEvent: birthResult.hasRareEvent
                    });
                }

            } catch (error) {
                console.error('[FusionPodScene] Fusion error:', error);
                console.error('[FusionPodScene] Error stack:', error?.stack);
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                // Show more helpful error message
                const errorMsg = error?.message || 'Unknown error';
                this.showBreedingError(`Fusion failed: ${errorMsg.substring(0, 50)}`);
            }

            this.breedingInProgress = false;
        });
    }

    createOffspringData(mendelianGenes) {
        // Determine generation (max of parents + 1)
        const parent1Gen = this.parent1Data.generation || 1;
        const parent2Gen = this.parent2Data.generation || 1;
        const offspringGen = Math.max(parent1Gen, parent2Gen) + 1;

        // Determine rarity (chance for upgrade based on parents)
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const parent1RarityIdx = rarities.indexOf(this.parent1Data.rarity || 'common');
        const parent2RarityIdx = rarities.indexOf(this.parent2Data.rarity || 'common');
        const avgRarityIdx = Math.floor((parent1RarityIdx + parent2RarityIdx) / 2);

        // Offspring bonus: 20% chance for rarity upgrade
        let offspringRarityIdx = avgRarityIdx;
        if (Math.random() < 0.2 && avgRarityIdx < rarities.length - 1) {
            offspringRarityIdx = avgRarityIdx + 1;
        }
        const offspringRarity = rarities[offspringRarityIdx];

        // Determine which traits came from which parent
        const inheritedTraits = this.determineInheritedTraits(mendelianGenes);

        // Get phenotype and visual config from BreedingEngine
        let phenotype = null;
        let breedingVisualConfig = null;
        if (window.BreedingEngine) {
            phenotype = window.BreedingEngine.getPhenotype(mendelianGenes);
            breedingVisualConfig = window.BreedingEngine.getVisualConfigFromPhenotype(phenotype, {
                parent1: this.parent1Data.genes || this.parent1Data.dna,
                parent2: this.parent2Data.genes || this.parent2Data.dna
            });
        }

        // CRITICAL: Generate a full creature using CreatureGenetics to get proper traits
        // structure needed by GraphicsEngine (colorGenome, bodyShape, features)
        let baseGenes = null;
        if (window.CreatureGenetics) {
            // generateCreatureGenetics takes rarity string directly (not an object)
            baseGenes = window.CreatureGenetics.generateCreatureGenetics(offspringRarity);
        }

        // Create full creature genetics by merging base genetics with breeding traits
        const fullGenes = {
            // Use base genetics ID or create new one
            id: baseGenes?.id || `genes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            // Core species and visual data from CreatureGenetics
            species: baseGenes?.species || 'hybrid',
            rarity: offspringRarity,
            cosmicAffinity: baseGenes?.cosmicAffinity || this.blendCosmicAffinity(),
            personality: baseGenes?.personality || { core: 'curious' },
            metadata: baseGenes?.metadata || { generatedAt: Date.now() },
            // Traits - merge base genetics traits with breeding visuals
            traits: {
                // CRITICAL: Include colorGenome, bodyShape, features from base for GraphicsEngine
                colorGenome: baseGenes?.traits?.colorGenome || this.generateFallbackColorGenome(offspringRarity),
                bodyShape: baseGenes?.traits?.bodyShape || { type: 'balanced', intensity: 0.5 },
                features: baseGenes?.traits?.features || this.generateFallbackFeatures(),
                // Mendelian breeding traits
                ...(window.BreedingEngine?.getCreatureTraits(mendelianGenes) || {}),
                breedingVisuals: breedingVisualConfig
            },
            // Store Mendelian genes for breeding continuity
            mendelianGenes: mendelianGenes,
            phenotype: phenotype
        };

        return {
            offspringGenes: fullGenes,
            offspringData: {
                generation: offspringGen,
                rarity: offspringRarity,
                inheritedTraits: inheritedTraits,
                parentIds: [
                    this.parent1Data.id || 'parent1',
                    this.parent2Data.id || 'parent2'
                ],
                parentNames: [
                    this.parent1Data.name,
                    this.parent2Data.name
                ],
                offspringBonus: {
                    cosmicPower: 1.0 + (offspringGen * 0.05), // 5% bonus per generation
                    description: `Dual Descent (Gen ${offspringGen})`
                }
            }
        };
    }

    determineInheritedTraits(mendelianGenes) {
        // Simplified trait inheritance display
        const traits = {
            fromParent1: [],
            fromParent2: []
        };

        // Randomly assign visible traits to parents for display
        const traitNames = ['Body Shape', 'Eye Color', 'Pattern', 'Markings'];
        traitNames.forEach((trait, idx) => {
            if (idx % 2 === 0) {
                traits.fromParent1.push(trait);
            } else {
                traits.fromParent2.push(trait);
            }
        });

        return traits;
    }

    blendCosmicAffinity() {
        const affinities = ['star', 'moon', 'nebula', 'crystal', 'void'];
        const p1Affinity = this.parent1Data.cosmicAffinity ||
            this.parent1Data.genes?.cosmicAffinity?.element;
        const p2Affinity = this.parent2Data.cosmicAffinity ||
            this.parent2Data.genes?.cosmicAffinity?.element;

        // 50% chance each parent's affinity, or random if neither has one
        if (p1Affinity && p2Affinity) {
            return Math.random() < 0.5 ? p1Affinity : p2Affinity;
        }
        return p1Affinity || p2Affinity || affinities[Phaser.Math.Between(0, affinities.length - 1)];
    }

    /**
     * Generate fallback color genome when CreatureGenetics is unavailable
     * Blends colors from parents for visual inheritance
     */
    generateFallbackColorGenome(rarity) {
        // Get parent colors if available
        const p1Colors = this.parent1Data.genes?.traits?.colorGenome ||
            this.parent1Data.dna?.traits?.colorGenome;
        const p2Colors = this.parent2Data.genes?.traits?.colorGenome ||
            this.parent2Data.dna?.traits?.colorGenome;

        // Rarity-based fallback colors
        const rarityColors = {
            common: { primary: 0x4CAF50, secondary: 0x8BC34A, accent: 0xFFEB3B },
            uncommon: { primary: 0x2196F3, secondary: 0x03A9F4, accent: 0xE1F5FE },
            rare: { primary: 0x9C27B0, secondary: 0xBA68C8, accent: 0xF3E5F5 },
            epic: { primary: 0xFF5722, secondary: 0xFF9800, accent: 0xFFF3E0 },
            legendary: { primary: 0xFFD700, secondary: 0xFFC107, accent: 0xFFF8E1 }
        };

        const baseColors = rarityColors[rarity] || rarityColors.common;

        return {
            primary: {
                color: p1Colors?.primary?.color || baseColors.primary,
                saturation: 0.8,
                brightness: 0.7
            },
            secondary: {
                color: p2Colors?.secondary?.color || baseColors.secondary,
                saturation: 0.7,
                brightness: 0.8
            },
            accent: {
                color: baseColors.accent,
                saturation: 0.9,
                brightness: 0.9
            }
        };
    }

    /**
     * Generate fallback features when CreatureGenetics is unavailable
     */
    generateFallbackFeatures() {
        return {
            eyeType: {
                type: 'round',
                size: 1.0,
                shine: 0.8
            },
            wings: {
                type: 'feathered',
                size: 0.8
            },
            markings: [],
            wackyMutations: []
        };
    }

    showBreedingSuccess(result) {
        const { width, height } = this.scale;

        // Clear current elements
        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];

        // Recreate overlay
        this.createOverlay(width, height);

        // Success panel
        const panelWidth = Math.min(350, width - 40);
        const panelHeight = 450;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFFD700, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setDepth(201);

        // Title
        this.add.text(width / 2, panelY + 35, '🎉 New Life Created! 🎉', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Parent inheritance display
        let y = panelY + 80;

        const offspringData = result.offspringData || {};
        const inherited = offspringData.inheritedTraits || {};

        // From Parent 1
        this.add.text(width / 2, y, `From ${offspringData.parentNames?.[0] || 'Parent 1'}:`, {
            fontSize: '12px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        (inherited.fromParent1 || []).forEach(trait => {
            this.add.text(width / 2, y, `• ${trait}`, {
                fontSize: '11px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(202);
            y += 18;
        });

        y += 10;

        // From Parent 2
        this.add.text(width / 2, y, `From ${offspringData.parentNames?.[1] || 'Parent 2'}:`, {
            fontSize: '12px',
            color: '#FF88CC'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        (inherited.fromParent2 || []).forEach(trait => {
            this.add.text(width / 2, y, `• ${trait}`, {
                fontSize: '11px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(202);
            y += 18;
        });

        y += 15;

        // Offspring info
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        this.add.text(width / 2, y, `Rarity: ${(offspringData.rarity || 'common').toUpperCase()}`, {
            fontSize: '14px',
            color: rarityColors[offspringData.rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);
        y += 25;

        this.add.text(width / 2, y, `Generation ${offspringData.generation || 2}`, {
            fontSize: '12px',
            color: '#FFD700'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        // Offspring bonus
        const bonus = offspringData.offspringBonus;
        if (bonus) {
            this.add.text(width / 2, y, `✨ ${bonus.description}`, {
                fontSize: '11px',
                color: '#88FF88'
            }).setOrigin(0.5).setDepth(202);
            y += 18;

            const powerBonus = Math.round((bonus.cosmicPower - 1) * 100);
            if (powerBonus > 0) {
                this.add.text(width / 2, y, `+${powerBonus}% Cosmic Power`, {
                    fontSize: '10px',
                    color: '#AAFFAA'
                }).setOrigin(0.5).setDepth(202);
            }
        }

        // Store result for adding to collection
        this.offspringResult = result;

        // Buttons
        const btnY = panelY + panelHeight - 80;
        const collectionStatus = getGameState().getCollectionStatus?.() || { hasSpace: true };

        if (collectionStatus.hasSpace) {
            const addBtn = this.add.text(width / 2, btnY, '🐾 Add to Collection', {
                fontSize: '16px',
                color: '#FFFFFF',
                backgroundColor: '#00AA00',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(202).setInteractive();

            addBtn.on('pointerdown', () => {
                this.addOffspringToCollection(result);
            });

            addBtn.on('pointerover', () => addBtn.setStyle({ backgroundColor: '#00DD00' }));
            addBtn.on('pointerout', () => addBtn.setStyle({ backgroundColor: '#00AA00' }));

            // Skip button
            const skipBtn = this.add.text(width / 2, btnY + 45, 'Skip', {
                fontSize: '12px',
                color: '#888888'
            }).setOrigin(0.5).setDepth(202).setInteractive();

            skipBtn.on('pointerdown', () => this.closeScene());
        } else {
            this.add.text(width / 2, btnY, '⚠️ Collection full (8/8)', {
                fontSize: '14px',
                color: '#FF6666'
            }).setOrigin(0.5).setDepth(202);

            const continueBtn = this.add.text(width / 2, btnY + 35, 'Continue', {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: '#4B0082',
                padding: { x: 25, y: 8 }
            }).setOrigin(0.5).setDepth(202).setInteractive();

            continueBtn.on('pointerdown', () => this.closeScene());
        }

        // Play celebration
        window.AudioManager?.playLevelUp?.();
    }

    addOffspringToCollection(result) {
        const { width, height } = this.scale;

        const offspringGenes = result.offspringGenes || {};
        const offspringData = result.offspringData || {};

        // Generate name
        const namePrefixes = ['Star', 'Moon', 'Nova', 'Cosmic', 'Nebula', 'Crystal'];
        const nameSuffixes = ['ling', 'spark', 'wing', 'heart', 'soul', 'glow'];
        const prefix = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)];
        const suffix = nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];
        const offspringName = `${prefix}${suffix}`;

        // Create creature data
        const creatureData = {
            id: `creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: offspringName,
            genes: offspringGenes,
            dna: offspringGenes,
            personality: null,
            personalityState: null,
            stats: { happiness: 100, energy: 100, health: 100 },
            level: 1,
            experience: 0,
            textureName: null,
            hatchTime: Date.now(),
            lifecycle: {
                birthDate: Date.now(),
                stage: 'baby',
                lastStageChange: Date.now(),
                evolutionHistory: []
            },
            cosmicAffinity: offspringGenes.cosmicAffinity,
            rarity: offspringData.rarity || 'common',
            addedAt: Date.now(),
            isOffspring: true,
            generation: offspringData.generation || 2,
            parentIds: offspringData.parentIds || [],
            offspringBonus: offspringData.offspringBonus || null
        };

        // Add to collection
        const added = getGameState().addCreatureToCollection?.(creatureData);

        if (added) {
            const successMsg = this.add.text(width / 2, height / 2, `✅ ${offspringName} joined your collection!`, {
                fontSize: '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playPurchase?.();

            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                    count: 20,
                    color: [0x00FF00, 0xFFD700],
                    duration: 1500
                });
            }

            this.time.delayedCall(2500, () => {
                successMsg?.destroy?.();
                this.closeScene();
            });
        } else {
            const errorMsg = this.add.text(width / 2, height / 2, '❌ Failed to add to collection', {
                fontSize: '16px',
                color: '#FF6666'
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playError?.();

            this.time.delayedCall(2000, () => {
                errorMsg?.destroy?.();
                this.closeScene();
            });
        }
    }

    showBreedingError(message) {
        const { width, height } = this.scale;

        const errorText = this.add.text(width / 2, height / 2 + 100, message, {
            fontSize: '14px',
            color: '#FF6666',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 10 }
        }).setOrigin(0.5).setDepth(300);

        this.time.delayedCall(3000, () => errorText.destroy());
        window.AudioManager?.playError?.();
    }

    createCloseButton(width) {
        const closeX = this.panelBounds.x + this.panelBounds.width - 25;
        const closeY = this.panelBounds.y + 20;

        const closeButton = this.add.text(closeX, closeY, '✕', {
            fontSize: '24px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(202).setInteractive();

        closeButton.on('pointerdown', () => this.closeScene());
        closeButton.on('pointerover', () => closeButton.setColor('#FF6666'));
        closeButton.on('pointerout', () => closeButton.setColor('#FFFFFF'));

        this.elements.push(closeButton);
    }

    closeScene() {
        console.log('[FusionPodScene] Closing and returning to GameScene');

        // Stop this scene first
        this.scene.stop('FusionPodScene');

        // Start GameScene fresh (it was stopped, not paused)
        try {
            this.scene.start('GameScene');
        } catch (e) {
            console.error('[FusionPodScene] Failed to start GameScene:', e);
            // Fallback: try to resume if it was paused
            try {
                this.scene.resume('GameScene');
            } catch (e2) {
                console.error('[FusionPodScene] Also failed to resume:', e2);
            }
        }
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

    formatCooldown(ms) {
        if (!ms || ms <= 0) return 'Ready';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    shutdown() {
        console.log('[FusionPodScene] Shutting down...');

        // Stop fusion music
        window.AudioManager?.stopMusic?.();

        this.closeSelectionModal();

        this.elements.forEach(el => {
            try {
                el?.destroy?.();
            } catch (e) {
                // Element might already be destroyed
            }
        });
        this.elements = [];

        if (this.time) {
            this.time.removeAllEvents();
        }

        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear bonus tween reference
        if (this.bonusLineTween) {
            this.bonusLineTween.stop();
            this.bonusLineTween = null;
        }

        // Clear state
        this.parent1Index = null;
        this.parent1Data = null;
        this.parent2Index = null;
        this.parent2Data = null;
        this.compatibility = null;

        console.log('[FusionPodScene] Cleanup complete');
    }
}

// Export for module systems
export default FusionPodScene;
