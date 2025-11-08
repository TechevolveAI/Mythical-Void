/**
 * InventoryScene - Player inventory UI
 * Grid-based inventory display with item usage and management
 */

import Phaser from 'phaser';

export default class InventoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InventoryScene' });

        this.graphicsEngine = null;
        this.selectedSlot = null;
        this.inventorySlots = [];
        this.itemSprites = [];
    }

    create() {
        console.log('[InventoryScene] Initializing Inventory UI');

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        // Create UI
        this.createBackground();
        this.createHeader();
        this.createInventoryGrid();
        this.createItemDetails();
        this.createActionButtons();
        this.createExitButton();

        // Load inventory items
        this.refreshInventory();

        // Listen for inventory changes
        if (window.InventoryManager) {
            window.InventoryManager.on('itemAdded', this.refreshInventory, this);
            window.InventoryManager.on('itemRemoved', this.refreshInventory, this);
            window.InventoryManager.on('itemQuantityChanged', this.refreshInventory, this);
        }
    }

    /**
     * Create background
     */
    createBackground() {
        const width = 800;
        const height = 600;

        // Dark cosmic background
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x0A0520, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // Add star field
        for (let i = 0; i < 80; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(0.5, 2);
            const alpha = Phaser.Math.FloatBetween(0.3, 0.9);

            bgGraphics.fillStyle(0xFFFFFF, alpha);
            bgGraphics.fillCircle(x, y, size);
        }
    }

    /**
     * Create header with title and stats
     */
    createHeader() {
        // Title
        const title = this.add.text(400, 30, 'INVENTORY', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#00FFFF',
            stroke: '#4A0080',
            strokeThickness: 6,
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);

        // Stats panel
        const stats = window.InventoryManager?.getStats();
        const statsText = `${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`;

        this.statsText = this.add.text(400, 65, statsText, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center'
        });
        this.statsText.setOrigin(0.5, 0.5);
    }

    /**
     * Create inventory grid (5 columns x 6 rows = 30 slots)
     */
    createInventoryGrid() {
        const startX = 80;
        const startY = 110;
        const slotSize = 70;
        const spacing = 10;
        const cols = 5;
        const rows = 6;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (slotSize + spacing);
                const y = startY + row * (slotSize + spacing);
                const slotIndex = row * cols + col;

                // Slot background
                const slot = this.add.graphics();
                slot.fillStyle(0x2A0040, 0.6);
                slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                slot.lineStyle(2, 0x6B00B3);
                slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);

                // Slot number (small, bottom-right corner)
                const slotNum = this.add.text(x + slotSize - 5, y + slotSize - 5, slotIndex.toString(), {
                    fontSize: '10px',
                    fontFamily: 'Arial',
                    color: '#666666'
                });
                slotNum.setOrigin(1, 1);

                // Interactive zone
                const zone = this.add.zone(x, y, slotSize, slotSize).setOrigin(0, 0);
                zone.setInteractive({ useHandCursor: true });

                zone.on('pointerdown', () => {
                    this.selectSlot(slotIndex);
                });

                zone.on('pointerover', () => {
                    slot.clear();
                    slot.fillStyle(0x4A0080, 0.8);
                    slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                    slot.lineStyle(3, 0x8B00D9);
                    slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
                });

                zone.on('pointerout', () => {
                    if (this.selectedSlot !== slotIndex) {
                        slot.clear();
                        slot.fillStyle(0x2A0040, 0.6);
                        slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                        slot.lineStyle(2, 0x6B00B3);
                        slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
                    }
                });

                this.inventorySlots.push({
                    index: slotIndex,
                    x,
                    y,
                    size: slotSize,
                    graphics: slot,
                    zone,
                    slotNum,
                    itemIcon: null,
                    itemQuantity: null
                });
            }
        }
    }

    /**
     * Create item details panel (right side)
     */
    createItemDetails() {
        const x = 510;
        const y = 110;
        const width = 270;
        const height = 400;

        // Details panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 0.8);
        panel.fillRoundedRect(x, y, width, height, 10);
        panel.lineStyle(3, 0x6B00B3);
        panel.strokeRoundedRect(x, y, width, height, 10);

        // Item name
        this.detailName = this.add.text(x + 135, y + 30, 'Select an item', {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: width - 40 }
        });
        this.detailName.setOrigin(0.5, 0);

        // Item icon (large)
        this.detailIcon = this.add.text(x + 135, y + 90, '', {
            fontSize: '48px',
            align: 'center'
        });
        this.detailIcon.setOrigin(0.5, 0.5);

        // Item type
        this.detailType = this.add.text(x + 135, y + 130, '', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#00FFFF',
            align: 'center'
        });
        this.detailType.setOrigin(0.5, 0);

        // Item description
        this.detailDescription = this.add.text(x + 20, y + 170, '', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#CCCCCC',
            align: 'left',
            wordWrap: { width: width - 40 }
        });

        // Item effects (if food)
        this.detailEffects = this.add.text(x + 20, y + 240, '', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#FFD700',
            align: 'left',
            wordWrap: { width: width - 40 }
        });

        // Item quantity
        this.detailQuantity = this.add.text(x + 135, y + 310, '', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center'
        });
        this.detailQuantity.setOrigin(0.5, 0);
    }

    /**
     * Create action buttons
     */
    createActionButtons() {
        const x = 510;
        const y = 520;
        const buttonWidth = 120;
        const buttonHeight = 40;
        const spacing = 15;

        // Use button
        this.createButton(x, y, buttonWidth, buttonHeight, 'USE', 0x00AA00, () => {
            this.useSelectedItem();
        });

        // Equip button (for equippable items)
        this.equipButton = this.createButton(x + buttonWidth + spacing, y, buttonWidth, buttonHeight, 'EQUIP', 0x0066AA, () => {
            this.equipSelectedItem();
        });
        this.equipButton.visible = false;
    }

    /**
     * Create button helper
     */
    createButton(x, y, width, height, label, color, callback) {
        const button = this.add.graphics();
        button.fillStyle(color, 0.9);
        button.fillRoundedRect(x, y, width, height, 8);
        button.lineStyle(2, color + 0x003300);
        button.strokeRoundedRect(x, y, width, height, 8);

        const text = this.add.text(x + width / 2, y + height / 2, label, {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        text.setOrigin(0.5, 0.5);

        const zone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', callback);

        zone.on('pointerover', () => {
            button.clear();
            button.fillStyle(color + 0x002200, 1);
            button.fillRoundedRect(x, y, width, height, 8);
            button.lineStyle(3, color + 0x005500);
            button.strokeRoundedRect(x, y, width, height, 8);
        });

        zone.on('pointerout', () => {
            button.clear();
            button.fillStyle(color, 0.9);
            button.fillRoundedRect(x, y, width, height, 8);
            button.lineStyle(2, color + 0x003300);
            button.strokeRoundedRect(x, y, width, height, 8);
        });

        return { button, text, zone, visible: true };
    }

    /**
     * Create exit button
     */
    createExitButton() {
        const x = 700;
        const y = 540;
        const width = 80;
        const height = 40;

        const button = this.add.graphics();
        button.fillStyle(0xAA0000, 0.9);
        button.fillRoundedRect(x, y, width, height, 8);
        button.lineStyle(2, 0xFF0000);
        button.strokeRoundedRect(x, y, width, height, 8);

        const label = this.add.text(x + 40, y + 20, 'EXIT', {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        label.setOrigin(0.5, 0.5);

        const zone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => {
            this.exitInventory();
        });

        zone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0xDD0000, 1);
            button.fillRoundedRect(x, y, width, height, 8);
            button.lineStyle(3, 0xFF0000);
            button.strokeRoundedRect(x, y, width, height, 8);
        });

        zone.on('pointerout', () => {
            button.clear();
            button.fillStyle(0xAA0000, 0.9);
            button.fillRoundedRect(x, y, width, height, 8);
            button.lineStyle(2, 0xFF0000);
            button.strokeRoundedRect(x, y, width, height, 8);
        });

        // I key to open/close inventory
        this.input.keyboard.on('keydown-I', () => {
            this.exitInventory();
        });

        // ESC key to exit
        this.input.keyboard.on('keydown-ESC', () => {
            this.exitInventory();
        });
    }

    /**
     * Refresh inventory display
     */
    refreshInventory() {
        console.log('[InventoryScene] Refreshing inventory display');

        // Clear existing item sprites
        this.itemSprites.forEach(sprite => sprite.destroy());
        this.itemSprites = [];

        // Get all items from InventoryManager
        const items = window.InventoryManager?.getAllItems() || [];

        // Update stats
        const stats = window.InventoryManager?.getStats();
        if (this.statsText) {
            this.statsText.setText(`${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`);
        }

        // Display items in slots
        items.forEach((item, index) => {
            if (index >= this.inventorySlots.length) return;

            const slot = this.inventorySlots[index];

            // Item icon
            if (slot.itemIcon) {
                slot.itemIcon.destroy();
            }

            slot.itemIcon = this.add.text(
                slot.x + slot.size / 2,
                slot.y + slot.size / 2 - 5,
                item.icon,
                { fontSize: '32px' }
            );
            slot.itemIcon.setOrigin(0.5, 0.5);
            this.itemSprites.push(slot.itemIcon);

            // Item quantity (if > 1)
            if (item.quantity > 1) {
                if (slot.itemQuantity) {
                    slot.itemQuantity.destroy();
                }

                slot.itemQuantity = this.add.text(
                    slot.x + slot.size - 8,
                    slot.y + slot.size - 20,
                    `x${item.quantity}`,
                    {
                        fontSize: '12px',
                        fontFamily: 'Arial Black',
                        color: '#FFFFFF',
                        stroke: '#000000',
                        strokeThickness: 3
                    }
                );
                slot.itemQuantity.setOrigin(1, 1);
                this.itemSprites.push(slot.itemQuantity);
            } else if (slot.itemQuantity) {
                slot.itemQuantity.destroy();
                slot.itemQuantity = null;
            }
        });
    }

    /**
     * Select inventory slot
     */
    selectSlot(slotIndex) {
        console.log(`[InventoryScene] Selected slot: ${slotIndex}`);

        // Clear previous selection
        if (this.selectedSlot !== null) {
            const prevSlot = this.inventorySlots[this.selectedSlot];
            prevSlot.graphics.clear();
            prevSlot.graphics.fillStyle(0x2A0040, 0.6);
            prevSlot.graphics.fillRoundedRect(prevSlot.x, prevSlot.y, prevSlot.size, prevSlot.size, 8);
            prevSlot.graphics.lineStyle(2, 0x6B00B3);
            prevSlot.graphics.strokeRoundedRect(prevSlot.x, prevSlot.y, prevSlot.size, prevSlot.size, 8);
        }

        // Highlight selected slot
        this.selectedSlot = slotIndex;
        const slot = this.inventorySlots[slotIndex];
        slot.graphics.clear();
        slot.graphics.fillStyle(0x6B00B3, 1);
        slot.graphics.fillRoundedRect(slot.x, slot.y, slot.size, slot.size, 8);
        slot.graphics.lineStyle(3, 0xFFD700);
        slot.graphics.strokeRoundedRect(slot.x, slot.y, slot.size, slot.size, 8);

        // Update item details
        this.updateItemDetails(slotIndex);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Update item details panel
     */
    updateItemDetails(slotIndex) {
        const item = window.InventoryManager?.getItem(slotIndex);

        if (!item) {
            // Empty slot
            this.detailName.setText('Empty Slot');
            this.detailIcon.setText('');
            this.detailType.setText('');
            this.detailDescription.setText('');
            this.detailEffects.setText('');
            this.detailQuantity.setText('');
            if (this.equipButton) this.equipButton.visible = false;
            return;
        }

        // Update details
        this.detailName.setText(item.name);
        this.detailIcon.setText(item.icon);
        this.detailType.setText(`Type: ${item.type.toUpperCase()}`);
        this.detailDescription.setText(item.description || 'No description available');

        // Show effects if food
        if (item.effect) {
            const effects = [];
            if (item.effect.happiness) effects.push(`+${item.effect.happiness} Happiness`);
            if (item.effect.hunger) effects.push(`+${item.effect.hunger} Hunger`);
            if (item.effect.health) effects.push(`+${item.effect.health} Health`);
            this.detailEffects.setText('Effects:\n' + effects.join('\n'));
        } else {
            this.detailEffects.setText('');
        }

        // Show quantity
        if (item.quantity > 1) {
            this.detailQuantity.setText(`Quantity: ${item.quantity}`);
        } else {
            this.detailQuantity.setText('');
        }

        // Show/hide equip button
        if (this.equipButton) {
            this.equipButton.visible = item.equippable === true;
        }
    }

    /**
     * Use selected item
     */
    useSelectedItem() {
        if (this.selectedSlot === null) {
            console.warn('[InventoryScene] No item selected');
            return;
        }

        const item = window.InventoryManager?.getItem(this.selectedSlot);
        if (!item) {
            console.warn('[InventoryScene] No item in selected slot');
            return;
        }

        console.log(`[InventoryScene] Using item: ${item.name}`);

        if (window.InventoryManager) {
            const success = window.InventoryManager.useItem(this.selectedSlot);

            if (success) {
                this.showMessage(`Used ${item.name}!`, 0x00FF00);

                if (window.AudioManager) {
                    window.AudioManager.playCollectCoin();
                }

                // Refresh display
                this.time.delayedCall(500, () => {
                    this.refreshInventory();
                    this.selectedSlot = null;
                    this.updateItemDetails(null);
                });
            } else {
                this.showMessage('Cannot use item!', 0xFF0000);
            }
        }
    }

    /**
     * Equip selected item
     */
    equipSelectedItem() {
        if (this.selectedSlot === null) return;

        const item = window.InventoryManager?.getItem(this.selectedSlot);
        if (!item || !item.equippable) return;

        console.log(`[InventoryScene] Equipping: ${item.name}`);

        if (window.InventoryManager) {
            const success = window.InventoryManager.equipAttack(this.selectedSlot);

            if (success) {
                this.showMessage(`Equipped ${item.name}!`, 0x00FF00);

                if (window.AudioManager) {
                    window.AudioManager.playCollectCoin();
                }
            } else {
                this.showMessage('Cannot equip item!', 0xFF0000);
            }
        }
    }

    /**
     * Show temporary message
     */
    showMessage(message, color) {
        const msgText = this.add.text(400, 550, message, {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        msgText.setOrigin(0.5, 0.5);
        msgText.setDepth(150);
        msgText.setAlpha(0);

        this.tweens.add({
            targets: msgText,
            alpha: 1,
            duration: 200,
            onComplete: () => {
                this.time.delayedCall(1500, () => {
                    this.tweens.add({
                        targets: msgText,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            msgText.destroy();
                        }
                    });
                });
            }
        });
    }

    /**
     * Exit inventory and return to GameScene
     */
    exitInventory() {
        console.log('[InventoryScene] Closing inventory');

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        this.scene.start('GameScene');
    }

    /**
     * Cleanup
     */
    shutdown() {
        console.log('[InventoryScene] Shutting down');

        // Remove event listeners
        if (window.InventoryManager) {
            window.InventoryManager.off('itemAdded', this.refreshInventory, this);
            window.InventoryManager.off('itemRemoved', this.refreshInventory, this);
            window.InventoryManager.off('itemQuantityChanged', this.refreshInventory, this);
        }

        // Clear references
        this.graphicsEngine = null;
        this.inventorySlots = [];
        this.itemSprites = [];
        this.selectedSlot = null;
    }
}

// Register scene globally
if (typeof window !== 'undefined') {
    window.InventoryScene = InventoryScene;
}
