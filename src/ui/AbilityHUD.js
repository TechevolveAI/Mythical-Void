/**
 * AbilityHUD - Displays ability slots on the sanctuary screen
 * Shows 3 ability slots with equipped abilities and cooldown indicators
 */

import { devLog } from '../utils/devLogger.js';

export default class AbilityHUD {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.slots = [];
        this.isVisible = true;

        // Layout config
        this.slotSize = 50;
        this.slotSpacing = 10;
        this.position = { x: 70, y: 0 }; // Will be set to bottom-left

        // State
        this.cooldowns = new Map(); // abilityId -> endTime
    }

    /**
     * Create the ability HUD
     */
    create() {
        const { width, height } = this.scene.scale;

        // Position at bottom-left, above mobile controls if present
        this.position.y = height - 120;

        // Create container (screen-space, doesn't scroll)
        this.container = this.scene.add.container(this.position.x, this.position.y);
        this.container.setScrollFactor(0);
        this.container.setDepth(900);

        // Create 3 ability slots
        for (let i = 0; i < 3; i++) {
            const slot = this.createSlot(i);
            this.slots.push(slot);
        }

        // Listen for ability equip/unequip events
        if (window.GameState) {
            window.GameState.on('abilityEquipped', this.onAbilityEquipped, this);
            window.GameState.on('abilitySlotUnlocked', this.onSlotUnlocked, this);
        }

        // Initial refresh
        this.refresh();

        devLog('[AbilityHUD] Created with 3 slots');
    }

    /**
     * Create a single ability slot
     * @param {number} index - Slot index (0, 1, 2)
     */
    createSlot(index) {
        const x = index * (this.slotSize + this.slotSpacing);
        const y = 0;

        const slot = {
            index,
            slotNumber: index + 1,
            background: null,
            icon: null,
            cooldownOverlay: null,
            cooldownText: null,
            lockIcon: null,
            hitArea: null,
            abilityId: null,
            isUnlocked: index === 0 // Slot 1 always unlocked
        };

        // Background
        slot.background = this.scene.add.graphics();
        this.drawSlotBackground(slot, false);
        slot.background.setPosition(x, y);
        this.container.add(slot.background);

        // Ability icon (empty by default)
        slot.icon = this.scene.add.text(x + this.slotSize / 2, y + this.slotSize / 2, '', {
            fontSize: '28px'
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(slot.icon);

        // Slot number indicator
        const slotNum = this.scene.add.text(x + 8, y + 5, `${index + 1}`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0);
        this.container.add(slotNum);
        slot.slotNumberText = slotNum;

        // Lock icon for locked slots
        slot.lockIcon = this.scene.add.text(x + this.slotSize / 2, y + this.slotSize / 2, '🔒', {
            fontSize: '24px'
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(slot.lockIcon);

        // Cooldown overlay
        slot.cooldownOverlay = this.scene.add.graphics();
        slot.cooldownOverlay.setPosition(x, y);
        slot.cooldownOverlay.setAlpha(0);
        this.container.add(slot.cooldownOverlay);

        // Cooldown text
        slot.cooldownText = this.scene.add.text(x + this.slotSize / 2, y + this.slotSize / 2, '', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(slot.cooldownText);

        // Hit area for interaction
        slot.hitArea = this.scene.add.zone(
            x + this.slotSize / 2,
            y + this.slotSize / 2,
            this.slotSize,
            this.slotSize
        ).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        this.container.add(slot.hitArea);

        // Interaction handlers
        slot.hitArea.on('pointerdown', () => this.onSlotClick(slot));
        slot.hitArea.on('pointerover', () => this.onSlotHover(slot, true));
        slot.hitArea.on('pointerout', () => this.onSlotHover(slot, false));

        return slot;
    }

    /**
     * Draw slot background
     * @param {Object} slot - Slot object
     * @param {boolean} hovered - Whether slot is hovered
     */
    drawSlotBackground(slot, hovered) {
        const g = slot.background;
        g.clear();

        const size = this.slotSize;
        const radius = 8;

        if (!slot.isUnlocked) {
            // Locked slot - darker, more opaque
            g.fillStyle(0x1A1A1A, 0.8);
            g.fillRoundedRect(0, 0, size, size, radius);
            g.lineStyle(2, 0x555555, 0.8);
            g.strokeRoundedRect(0, 0, size, size, radius);
        } else if (slot.abilityId) {
            // Equipped slot
            const borderColor = hovered ? 0xFFD700 : 0x7B68EE;
            g.fillStyle(0x2A1A4A, 0.9);
            g.fillRoundedRect(0, 0, size, size, radius);
            g.lineStyle(3, borderColor, 1);
            g.strokeRoundedRect(0, 0, size, size, radius);
        } else {
            // Empty unlocked slot
            const borderColor = hovered ? 0xFFD700 : 0x555555;
            g.fillStyle(0x1A1A3E, 0.7);
            g.fillRoundedRect(0, 0, size, size, radius);
            g.lineStyle(2, borderColor, 0.6);
            g.strokeRoundedRect(0, 0, size, size, radius);
        }
    }

    /**
     * Refresh all slots with current state
     */
    refresh() {
        const bondStatus = window.GameState?.getBondStatus?.() || {
            abilitySlots: { slot1: true, slot2: false, slot3: false },
            equippedAbilities: { slot1: null, slot2: null, slot3: null }
        };

        const abilities = window.GameState?.get('creature.secretAbilities') || [];

        this.slots.forEach((slot, index) => {
            const slotKey = `slot${index + 1}`;
            slot.isUnlocked = bondStatus.abilitySlots[slotKey] || index === 0;
            slot.abilityId = bondStatus.equippedAbilities[slotKey];

            // Update lock icon
            slot.lockIcon.setAlpha(slot.isUnlocked ? 0 : 1);

            // Update ability icon
            if (slot.isUnlocked && slot.abilityId) {
                const ability = abilities.find(a => a.id === slot.abilityId);
                if (ability) {
                    slot.icon.setText(ability.icon || '✨');
                    slot.icon.setAlpha(1);
                } else {
                    slot.icon.setAlpha(0);
                }
            } else {
                slot.icon.setAlpha(0);
            }

            // Redraw background
            this.drawSlotBackground(slot, false);
        });

        devLog('[AbilityHUD] Refreshed slots');
    }

    /**
     * Handle slot click
     * @param {Object} slot - Clicked slot
     */
    onSlotClick(slot) {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        if (!slot.isUnlocked) {
            // Show unlock requirement
            const requiredLevel = slot.slotNumber === 2 ? 5 : 10;
            this.showTooltip(slot, `🔒 Unlock at Bond Level ${requiredLevel}`);
            return;
        }

        if (slot.abilityId) {
            // Check cooldown
            const cooldownEnd = this.cooldowns.get(slot.abilityId);
            if (cooldownEnd && Date.now() < cooldownEnd) {
                const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
                this.showTooltip(slot, `⏳ ${remaining}s cooldown`);
                return;
            }

            // Activate ability
            this.activateAbility(slot.abilityId, slot.slotNumber);
        } else {
            // Open ability selection
            this.scene.events.emit('openAbilitySelection', slot.slotNumber);
        }
    }

    /**
     * Handle slot hover
     * @param {Object} slot - Hovered slot
     * @param {boolean} isHovering - Whether currently hovering
     */
    onSlotHover(slot, isHovering) {
        this.drawSlotBackground(slot, isHovering);

        if (isHovering) {
            this.scene.tweens.add({
                targets: slot.background,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Back.easeOut'
            });
        } else {
            this.scene.tweens.add({
                targets: slot.background,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        }
    }

    /**
     * Activate an ability
     * @param {string} abilityId - Ability to activate
     * @param {number} slotNumber - Slot number
     */
    activateAbility(abilityId, slotNumber) {
        devLog('[AbilityHUD] Activating ability:', abilityId);

        // Get ability info
        const abilities = window.GameState?.get('creature.secretAbilities') || [];
        const ability = abilities.find(a => a.id === abilityId);

        if (!ability) {
            console.warn('[AbilityHUD] Ability not found:', abilityId);
            return;
        }

        // Emit activation event
        this.scene.events.emit('abilityActivated', {
            abilityId,
            ability,
            slotNumber
        });

        // Apply ability effect based on type
        if (window.SecretAbilityManager?.activateAbility) {
            window.SecretAbilityManager.activateAbility(abilityId, this.scene);
        }

        // Start cooldown if ability has one
        if (ability.cooldown > 0) {
            this.startCooldown(abilityId, ability.cooldown, slotNumber);
        }

        // Visual feedback
        const slot = this.slots[slotNumber - 1];
        this.scene.tweens.add({
            targets: slot.icon,
            scale: { from: 1.5, to: 1 },
            duration: 300,
            ease: 'Back.easeOut'
        });

        if (window.AudioManager) {
            window.AudioManager.playLevelUp?.();
        }
    }

    /**
     * Start cooldown for an ability
     * @param {string} abilityId - Ability ID
     * @param {number} duration - Cooldown duration in ms
     * @param {number} slotNumber - Slot number
     */
    startCooldown(abilityId, duration, slotNumber) {
        const endTime = Date.now() + duration;
        this.cooldowns.set(abilityId, endTime);

        const slot = this.slots[slotNumber - 1];
        slot.cooldownOverlay.setAlpha(0.7);
        slot.cooldownText.setAlpha(1);

        // Update cooldown display
        const updateCooldown = () => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                slot.cooldownOverlay.setAlpha(0);
                slot.cooldownText.setAlpha(0);
                this.cooldowns.delete(abilityId);
                return;
            }

            // Draw cooldown pie
            slot.cooldownOverlay.clear();
            slot.cooldownOverlay.fillStyle(0x000000, 0.6);
            const progress = remaining / duration;
            slot.cooldownOverlay.slice(
                this.slotSize / 2,
                this.slotSize / 2,
                this.slotSize / 2 - 2,
                Phaser.Math.DegToRad(-90),
                Phaser.Math.DegToRad(-90 + 360 * progress),
                true
            );
            slot.cooldownOverlay.fillPath();

            // Update text
            const seconds = Math.ceil(remaining / 1000);
            slot.cooldownText.setText(`${seconds}s`);

            // Continue updating
            this.scene.time.delayedCall(100, updateCooldown);
        };

        updateCooldown();
    }

    /**
     * Show tooltip near slot
     * @param {Object} slot - Slot to show tooltip for
     * @param {string} text - Tooltip text
     */
    showTooltip(slot, text) {
        // Remove existing tooltip
        if (this.tooltip) {
            this.tooltip.destroy();
        }

        const x = this.position.x + slot.index * (this.slotSize + this.slotSpacing) + this.slotSize / 2;
        const y = this.position.y - 40;

        this.tooltip = this.scene.add.text(x, y, text, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            backgroundColor: 'rgba(26, 26, 62, 0.95)',
            padding: { x: 10, y: 6 },
            stroke: '#7B68EE',
            strokeThickness: 1
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        // Fade out
        this.scene.tweens.add({
            targets: this.tooltip,
            alpha: 0,
            y: y - 20,
            delay: 1500,
            duration: 300,
            onComplete: () => {
                this.tooltip?.destroy();
                this.tooltip = null;
            }
        });
    }

    /**
     * Handle ability equipped event
     * @param {Object} data - Event data
     */
    onAbilityEquipped(data) {
        this.refresh();
    }

    /**
     * Handle slot unlocked event
     * @param {Object} data - Event data
     */
    onSlotUnlocked(data) {
        this.refresh();

        // Celebration effect
        const slot = this.slots[data.slot - 1];
        if (slot) {
            this.scene.tweens.add({
                targets: slot.background,
                scaleX: { from: 1.3, to: 1 },
                scaleY: { from: 1.3, to: 1 },
                duration: 500,
                ease: 'Bounce.easeOut'
            });
        }
    }

    /**
     * Show/hide the HUD
     */
    setVisible(visible) {
        this.isVisible = visible;
        this.container?.setVisible(visible);
    }

    /**
     * Update (called from scene update)
     */
    update() {
        // Could be used for cooldown updates if needed
    }

    /**
     * Cleanup
     */
    destroy() {
        if (window.GameState) {
            window.GameState.off('abilityEquipped', this.onAbilityEquipped, this);
            window.GameState.off('abilitySlotUnlocked', this.onSlotUnlocked, this);
        }

        this.slots.forEach(slot => {
            slot.hitArea?.removeAllListeners();
        });

        this.tooltip?.destroy();
        this.container?.destroy();
        this.slots = [];

        devLog('[AbilityHUD] Destroyed');
    }
}
