/**
 * AbilitySelectionScene - Modal scene for selecting and equipping abilities
 * Shows all unlocked abilities and allows assigning them to slots
 */

import { devLog } from '../utils/devLogger.js';

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

export default class AbilitySelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AbilitySelectionScene' });
        this.selectedSlot = null;
        this.abilityCards = [];
        this.container = null;
    }

    init(data) {
        // Which slot to equip to (1, 2, or 3), or null for general view
        this.selectedSlot = data?.slot || null;
    }

    create() {
        const { width, height } = this.scale;

        // Semi-transparent background
        this.backdrop = this.add.graphics();
        this.backdrop.fillStyle(0x000000, 0.8);
        this.backdrop.fillRect(0, 0, width, height);
        this.backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Main panel
        const panelWidth = Math.min(600, width - 40);
        const panelHeight = Math.min(500, height - 80);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        this.panel = this.add.graphics();
        this.panel.fillStyle(0x1A1A3E, 1);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        this.panel.lineStyle(3, 0x7B68EE, 1);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);

        // Title
        const titleText = this.selectedSlot
            ? `Select Ability for Slot ${this.selectedSlot}`
            : 'Your Abilities';

        this.title = this.add.text(width / 2, panelY + 25, `✨ ${titleText}`, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // Close button
        this.closeBtn = this.add.text(panelX + panelWidth - 20, panelY + 15, '✕', {
            fontSize: '24px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.closeBtn.on('pointerdown', () => this.closeScene());
        this.closeBtn.on('pointerover', () => this.closeBtn.setColor('#FF6347'));
        this.closeBtn.on('pointerout', () => this.closeBtn.setColor('#FFFFFF'));

        // Get abilities
        const abilities = window.GameState?.get('creature.secretAbilities') || [];
        const equippedAbilities = window.GameState?.getEquippedAbilities?.() || {};

        // No abilities message
        if (abilities.length === 0) {
            this.add.text(width / 2, height / 2, '🔮 No abilities unlocked yet!\n\nAbilities are unlocked through:\n• Breeding special creatures\n• Achieving high bond levels\n• Cosmic events', {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAAAAA',
                align: 'center',
                lineSpacing: 8
            }).setOrigin(0.5);
        } else {
            // Create ability cards
            this.createAbilityList(abilities, equippedAbilities, panelX, panelY + 60, panelWidth, panelHeight - 80);
        }

        // Equipped slots display at bottom
        this.createEquippedDisplay(panelX, panelY + panelHeight - 70, panelWidth);

        // ESC to close
        this.input.keyboard.on('keydown-ESC', () => this.closeScene());

        devLog('[AbilitySelectionScene] Created');
    }

    /**
     * Create scrollable list of ability cards
     */
    createAbilityList(abilities, equippedAbilities, x, y, containerWidth, containerHeight) {
        const cardWidth = containerWidth - 40;
        const cardHeight = 80;
        const cardSpacing = 10;

        // Create scrollable container
        const contentHeight = abilities.length * (cardHeight + cardSpacing);
        const needsScroll = contentHeight > containerHeight - 20;

        let currentY = y + 10;

        abilities.forEach((ability, index) => {
            const card = this.createAbilityCard(
                ability,
                equippedAbilities,
                x + 20,
                currentY,
                cardWidth,
                cardHeight
            );
            this.abilityCards.push(card);
            currentY += cardHeight + cardSpacing;
        });

        // If needs scroll, add scroll hint
        if (needsScroll) {
            this.add.text(x + containerWidth / 2, y + containerHeight - 20, '↕ Scroll for more', {
                fontSize: '12px',
                color: '#888888'
            }).setOrigin(0.5);
        }
    }

    /**
     * Create a single ability card
     */
    createAbilityCard(ability, equippedAbilities, x, y, cardWidth, cardHeight) {
        const card = {
            ability,
            background: null,
            elements: []
        };

        // Check if this ability is equipped somewhere
        const equippedSlot = Object.entries(equippedAbilities).find(
            ([slot, id]) => id === ability.id
        )?.[0];
        const isEquipped = !!equippedSlot;

        // Card background
        card.background = this.add.graphics();
        const bgColor = isEquipped ? 0x3A2A5A : 0x2A1A4A;
        card.background.fillStyle(bgColor, 1);
        card.background.fillRoundedRect(x, y, cardWidth, cardHeight, 10);
        card.background.lineStyle(2, isEquipped ? 0x7B68EE : 0x444444, 1);
        card.background.strokeRoundedRect(x, y, cardWidth, cardHeight, 10);

        // Icon
        const icon = this.add.text(x + 25, y + cardHeight / 2, ability.icon || '✨', {
            fontSize: '32px'
        }).setOrigin(0.5);
        card.elements.push(icon);

        // Name and type
        const typeColors = {
            combat: '#FF6347',
            utility: '#90EE90',
            passive: '#87CEEB'
        };

        const name = this.add.text(x + 55, y + 12, ability.name, {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        card.elements.push(name);

        const type = this.add.text(x + 55 + name.width + 10, y + 16, `[${ability.type || 'passive'}]`, {
            fontSize: '12px',
            color: typeColors[ability.type] || '#888888'
        });
        card.elements.push(type);

        // Description
        const desc = this.add.text(x + 55, y + 35, ability.description || 'No description', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA',
            wordWrap: { width: cardWidth - 150 }
        });
        card.elements.push(desc);

        // Equipped indicator
        if (isEquipped) {
            const slotNum = equippedSlot.replace('slot', '');
            const equipped = this.add.text(x + cardWidth - 60, y + 10, `Slot ${slotNum}`, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#7B68EE',
                backgroundColor: 'rgba(123, 104, 238, 0.2)',
                padding: { x: 8, y: 4 }
            }).setOrigin(0.5, 0);
            card.elements.push(equipped);
        }

        // Action button
        const btnText = isEquipped ? 'Unequip' : (this.selectedSlot ? 'Equip' : 'View');
        const btnColor = isEquipped ? '#FF6347' : '#7B68EE';

        const btn = this.add.text(x + cardWidth - 60, y + cardHeight - 25, btnText, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: btnColor,
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => this.handleAbilityAction(ability, isEquipped, equippedSlot));
        btn.on('pointerover', () => btn.setScale(1.1));
        btn.on('pointerout', () => btn.setScale(1));
        card.elements.push(btn);

        // Make entire card clickable
        const hitArea = this.add.zone(x + cardWidth / 2, y + cardHeight / 2, cardWidth, cardHeight)
            .setInteractive({ useHandCursor: true });

        hitArea.on('pointerover', () => {
            card.background.clear();
            card.background.fillStyle(0x4A3A6A, 1);
            card.background.fillRoundedRect(x, y, cardWidth, cardHeight, 10);
            card.background.lineStyle(2, 0xFFD700, 1);
            card.background.strokeRoundedRect(x, y, cardWidth, cardHeight, 10);
        });

        hitArea.on('pointerout', () => {
            card.background.clear();
            card.background.fillStyle(bgColor, 1);
            card.background.fillRoundedRect(x, y, cardWidth, cardHeight, 10);
            card.background.lineStyle(2, isEquipped ? 0x7B68EE : 0x444444, 1);
            card.background.strokeRoundedRect(x, y, cardWidth, cardHeight, 10);
        });

        card.hitArea = hitArea;

        return card;
    }

    /**
     * Create equipped slots display
     */
    createEquippedDisplay(x, y, width) {
        const slotSize = 45;
        const slotSpacing = 15;
        const totalWidth = 3 * slotSize + 2 * slotSpacing;
        const startX = x + (width - totalWidth) / 2;

        // Label
        this.add.text(x + width / 2, y - 5, 'Equipped:', {
            fontSize: '14px',
            color: '#888888'
        }).setOrigin(0.5);

        const bondStatus = window.GameState?.getBondStatus?.() || {};
        const equippedAbilities = bondStatus.equippedAbilities || {};
        const abilitySlots = bondStatus.abilitySlots || { slot1: true, slot2: false, slot3: false };
        const abilities = window.GameState?.get('creature.secretAbilities') || [];

        for (let i = 0; i < 3; i++) {
            const slotX = startX + i * (slotSize + slotSpacing);
            const slotKey = `slot${i + 1}`;
            const isUnlocked = abilitySlots[slotKey];
            const abilityId = equippedAbilities[slotKey];
            const ability = abilityId ? abilities.find(a => a.id === abilityId) : null;

            // Slot background
            const slotBg = this.add.graphics();
            slotBg.fillStyle(isUnlocked ? 0x2A1A4A : 0x1A1A1A, 1);
            slotBg.fillRoundedRect(slotX, y + 10, slotSize, slotSize, 6);
            slotBg.lineStyle(2, isUnlocked ? 0x7B68EE : 0x444444, 1);
            slotBg.strokeRoundedRect(slotX, y + 10, slotSize, slotSize, 6);

            // Slot number
            this.add.text(slotX + 5, y + 13, `${i + 1}`, {
                fontSize: '10px',
                color: '#666666'
            });

            // Icon or lock
            if (!isUnlocked) {
                this.add.text(slotX + slotSize / 2, y + 10 + slotSize / 2, '🔒', {
                    fontSize: '20px'
                }).setOrigin(0.5);
            } else if (ability) {
                this.add.text(slotX + slotSize / 2, y + 10 + slotSize / 2, ability.icon || '✨', {
                    fontSize: '24px'
                }).setOrigin(0.5);
            } else {
                this.add.text(slotX + slotSize / 2, y + 10 + slotSize / 2, '+', {
                    fontSize: '24px',
                    color: '#555555'
                }).setOrigin(0.5);
            }
        }
    }

    /**
     * Handle ability button click
     */
    handleAbilityAction(ability, isEquipped, currentSlot) {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        if (isEquipped) {
            // Unequip
            const slotNum = parseInt(currentSlot.replace('slot', ''));
            window.GameState?.equipAbility(slotNum, null);
            this.scene.restart();
        } else if (this.selectedSlot) {
            // Equip to selected slot
            window.GameState?.equipAbility(this.selectedSlot, ability.id);

            if (window.AudioManager) {
                window.AudioManager.playLevelUp?.();
            }

            this.closeScene();
        } else {
            // No slot selected - show details or prompt to select slot
            this.showAbilityDetails(ability);
        }
    }

    /**
     * Show detailed ability info
     */
    showAbilityDetails(ability) {
        // Could show a detail modal, for now just show a hint
        const { width, height } = this.scale;

        const detailText = this.add.text(width / 2, height - 60,
            `${ability.icon} ${ability.name}: ${ability.description}`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: 'rgba(123, 104, 238, 0.9)',
            padding: { x: 15, y: 10 },
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: detailText,
            alpha: 0,
            y: height - 80,
            delay: 3000,
            duration: 500,
            onComplete: () => detailText.destroy()
        });
    }

    /**
     * Close the scene
     */
    closeScene() {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        // Clean up before stopping
        this.cleanup();
        this.scene.stop();
    }

    /**
     * Cleanup all UI elements
     */
    cleanup() {
        // Clean up ability card hit areas
        this.abilityCards.forEach(card => {
            card.hitArea?.removeAllListeners();
            card.hitArea?.destroy();
            card.background?.destroy();
            card.elements?.forEach(el => el?.destroy());
        });
        this.abilityCards = [];

        // Clean up main UI elements
        this.backdrop?.destroy();
        this.panel?.destroy();
        this.title?.destroy();
        this.closeBtn?.removeAllListeners();
        this.closeBtn?.destroy();

        devLog('[AbilitySelectionScene] Cleaned up UI elements');
    }

    shutdown() {
        this.input.keyboard?.off('keydown-ESC');
        this.cleanup();

        devLog('[AbilitySelectionScene] Shutdown');
    }
}

// Export for window
if (typeof window !== 'undefined') {
    window.AbilitySelectionScene = AbilitySelectionScene;
}
