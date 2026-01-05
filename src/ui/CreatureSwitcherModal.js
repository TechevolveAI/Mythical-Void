/**
 * CreatureSwitcherModal - Reusable modal for switching between creatures
 * Used in GameScene and HubWorldScene
 */

import { devLog } from '../utils/devLogger.js';

export default class CreatureSwitcherModal {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.isVisible = false;
        this.onSwitch = null;
        this.escHandler = null;
    }

    /**
     * Show the creature collection modal
     * @param {Function} onSwitchCallback - Called with new creature index when switched
     */
    show(onSwitchCallback = null) {
        if (this.isVisible) return;
        this.onSwitch = onSwitchCallback;

        const { width, height } = this.scene.scale;
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        const creatures = window.GameState?.getCreatureCollection() || [];
        const activeIndex = window.GameState?.get('activeCreatureIndex') || 0;

        if (creatures.length === 0) {
            this.showEmptyMessage();
            return;
        }

        this.isVisible = true;

        // Create overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(5000);
        overlay.setScrollFactor(0);
        this.elements.push(overlay);

        // Panel dimensions
        const panelWidth = isMobile ? width - 40 : 480;
        const panelHeight = Math.min(height - 120, creatures.length * 75 + 130);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        // Panel background
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x9370DB);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(5001);
        panel.setScrollFactor(0);
        this.elements.push(panel);

        // Title
        const title = this.scene.add.text(width / 2, panelY + 35, 'Switch Creature', {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5002).setScrollFactor(0);
        this.elements.push(title);

        // Creature count
        const countText = this.scene.add.text(width / 2, panelY + 62, `${creatures.length}/8 Creatures`, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(5002).setScrollFactor(0);
        this.elements.push(countText);

        // Creature list
        creatures.forEach((creature, index) => {
            this.createCreatureRow(creature, index, activeIndex, panelX, panelY, panelWidth);
        });

        // Close button
        const closeBtn = this.scene.add.text(width / 2, panelY + panelHeight - 35, 'CLOSE', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#555555',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setDepth(5002).setScrollFactor(0);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.hide());
        closeBtn.on('pointerover', () => closeBtn.setBackgroundColor('#777777'));
        closeBtn.on('pointerout', () => closeBtn.setBackgroundColor('#555555'));
        this.elements.push(closeBtn);

        // ESC to close
        this.escHandler = (event) => {
            if (event.key === 'Escape') this.hide();
        };
        this.scene.input.keyboard?.on('keydown', this.escHandler);

        // Click outside to close
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', (pointer) => {
            if (pointer.x < panelX || pointer.x > panelX + panelWidth ||
                pointer.y < panelY || pointer.y > panelY + panelHeight) {
                this.hide();
            }
        });

        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }

        devLog('[CreatureSwitcherModal] Shown with', creatures.length, 'creatures');
    }

    createCreatureRow(creature, index, activeIndex, panelX, panelY, panelWidth) {
        const itemY = panelY + 90 + index * 65;
        const isActive = index === activeIndex;

        // Item background
        const itemBg = this.scene.add.graphics();
        itemBg.fillStyle(isActive ? 0x4A0080 : 0x2A0040, 0.85);
        itemBg.fillRoundedRect(panelX + 15, itemY, panelWidth - 30, 55, 10);
        if (isActive) {
            itemBg.lineStyle(2, 0xFFD700);
            itemBg.strokeRoundedRect(panelX + 15, itemY, panelWidth - 30, 55, 10);
        }
        itemBg.setDepth(5002).setScrollFactor(0);
        this.elements.push(itemBg);

        // Creature emoji/indicator based on rarity
        const rarityColors = {
            legendary: '#FFD700',
            epic: '#9B59B6',
            rare: '#3498DB',
            uncommon: '#27AE60',
            common: '#95A5A6'
        };
        const rarityColor = rarityColors[creature.rarity] || rarityColors.common;

        const indicator = this.scene.add.text(panelX + 35, itemY + 27, '🌟', {
            fontSize: '20px'
        }).setOrigin(0.5).setDepth(5003).setScrollFactor(0);
        this.elements.push(indicator);

        // Creature name
        const displayName = isActive ? `${creature.name} (Active)` : creature.name;
        const nameText = this.scene.add.text(panelX + 60, itemY + 14, displayName, {
            fontSize: '16px',
            color: isActive ? '#FFD700' : '#FFFFFF',
            fontStyle: 'bold'
        }).setDepth(5003).setScrollFactor(0);
        this.elements.push(nameText);

        // Creature info
        const rarityDisplay = (creature.rarity || 'common').charAt(0).toUpperCase() +
            (creature.rarity || 'common').slice(1);
        const infoText = this.scene.add.text(panelX + 60, itemY + 35,
            `Lv.${creature.level || 1} • ${rarityDisplay}`, {
                fontSize: '13px',
                color: rarityColor
            }).setDepth(5003).setScrollFactor(0);
        this.elements.push(infoText);

        // Select button (only for non-active creatures)
        if (!isActive) {
            const selectBtn = this.scene.add.text(panelX + panelWidth - 75, itemY + 27, 'SELECT', {
                fontSize: '13px',
                color: '#FFFFFF',
                backgroundColor: '#27AE60',
                padding: { x: 12, y: 6 }
            }).setOrigin(0.5).setDepth(5003).setScrollFactor(0);
            selectBtn.setInteractive({ useHandCursor: true });

            selectBtn.on('pointerdown', () => {
                window.GameState?.switchActiveCreature(index);
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick?.();
                }
                this.hide();
                if (this.onSwitch) {
                    this.onSwitch(index);
                }
            });
            selectBtn.on('pointerover', () => selectBtn.setBackgroundColor('#2ECC71'));
            selectBtn.on('pointerout', () => selectBtn.setBackgroundColor('#27AE60'));

            this.elements.push(selectBtn);
        }
    }

    showEmptyMessage() {
        const { width, height } = this.scene.scale;

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(5000).setScrollFactor(0);

        const msg = this.scene.add.text(width / 2, height / 2, 'No creatures in collection yet!\n\nHatch an egg to get started.', {
            fontSize: '18px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(5001).setScrollFactor(0);

        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => {
            overlay.destroy();
            msg.destroy();
        });

        this.scene.time.delayedCall(3000, () => {
            if (overlay.scene) overlay.destroy();
            if (msg.scene) msg.destroy();
        });
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;

        // Remove ESC handler
        if (this.escHandler) {
            this.scene.input.keyboard?.off('keydown', this.escHandler);
            this.escHandler = null;
        }

        // Destroy all elements
        this.elements.forEach(el => {
            if (el) {
                el.removeAllListeners?.();
                el.destroy?.();
            }
        });
        this.elements = [];

        devLog('[CreatureSwitcherModal] Hidden');
    }

    cleanup() {
        this.hide();
        this.onSwitch = null;
    }
}
