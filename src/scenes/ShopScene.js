/**
 * ShopScene - Cosmic Shop with Pokemon-style UI
 * Features: Item catalog, purchase flow, currency display, shopkeeper NPC
 */

import Phaser from 'phaser';

export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });

        this.graphicsEngine = null;
        this.selectedCategory = 'eggs'; // eggs, food, utilities
        this.selectedItemIndex = 0;
        this.shopItems = null;
        this.categoryButtons = [];
        this.itemButtons = [];
        this.shopkeeper = null;
    }

    create() {
        console.log('[ShopScene] Initializing Cosmic Shop');

        // Initialize graphics engine for this scene
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        // Create shop UI
        this.createBackground();
        this.createShopkeeper();
        this.createCurrencyDisplay();
        this.createCategoryMenu();
        this.createItemCatalog();
        this.createPurchasePanel();
        this.createExitButton();

        // Initialize shop items
        this.initializeShopItems();

        // Display initial category
        this.displayCategory('eggs');

        // Play shop ambient sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Hide loading overlay once shop is ready
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }
    }

    /**
     * Create cosmic shop background
     */
    createBackground() {
        const width = 800;
        const height = 600;

        // Dark cosmic background
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x0A0520, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // Add star field
        for (let i = 0; i < 100; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(0.5, 2);
            const alpha = Phaser.Math.FloatBetween(0.3, 0.9);

            bgGraphics.fillStyle(0xFFFFFF, alpha);
            bgGraphics.fillCircle(x, y, size);
        }

        // Add twinkling effect
        this.tweens.add({
            targets: bgGraphics,
            alpha: { from: 0.7, to: 1.0 },
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        // Shop title
        const title = this.add.text(400, 30, 'COSMIC SHOP', {
            fontSize: '36px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#4A0080',
            strokeThickness: 6,
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);
        title.setDepth(10);

        // Subtitle
        const subtitle = this.add.text(400, 65, 'Mystical Wares from the Void', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#00FFFF',
            style: 'italic'
        });
        subtitle.setOrigin(0.5, 0.5);
        subtitle.setDepth(10);
    }

    /**
     * Create animated shopkeeper NPC sprite
     */
    createShopkeeper() {
        const shopkeeperX = 120;
        const shopkeeperY = 200;

        // Shopkeeper container panel
        const keeperPanel = this.add.graphics();
        keeperPanel.fillStyle(0x1A0A2E, 0.8);
        keeperPanel.fillRoundedRect(20, 100, 200, 200, 10);
        keeperPanel.lineStyle(3, 0x6B00B3);
        keeperPanel.strokeRoundedRect(20, 100, 200, 200, 10);

        // Generate all animation frames
        for (let frame = 0; frame < 4; frame++) {
            this.graphicsEngine.createVoidMerchant(frame);
        }

        // Create animated sprite
        this.shopkeeper = this.add.sprite(shopkeeperX, shopkeeperY, 'voidMerchant_0');
        this.shopkeeper.setDepth(20);

        // Create animation from generated frames
        if (!this.anims.exists('voidMerchantIdle')) {
            this.anims.create({
                key: 'voidMerchantIdle',
                frames: [
                    { key: 'voidMerchant_0' },
                    { key: 'voidMerchant_1' },
                    { key: 'voidMerchant_2' },
                    { key: 'voidMerchant_3' }
                ],
                frameRate: 4,
                repeat: -1
            });
        }

        // Play idle animation
        this.shopkeeper.play('voidMerchantIdle');

        // Shopkeeper label
        const keeperLabel = this.add.text(120, 270, 'Void Merchant', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#00FFFF',
            align: 'center'
        });
        keeperLabel.setOrigin(0.5, 0.5);
        keeperLabel.setDepth(20);
    }

    /**
     * Create currency display (top-right)
     */
    createCurrencyDisplay() {
        const x = 650;
        const y = 100;

        // Currency panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 0.9);
        panel.fillRoundedRect(x - 70, y - 30, 140, 60, 8);
        panel.lineStyle(2, 0xFFD700);
        panel.strokeRoundedRect(x - 70, y - 30, 140, 60, 8);

        // Coin icon (matches cosmic coin sprite)
        const coinIcon = this.add.graphics();
        coinIcon.fillStyle(0xFFD700, 1);
        coinIcon.fillCircle(x - 40, y, 12);
        coinIcon.fillStyle(0xFFA500, 1);
        coinIcon.fillCircle(x - 40, y, 8);
        coinIcon.fillStyle(0xFFFF00, 0.6);
        coinIcon.fillCircle(x - 43, y - 3, 4);

        // Currency text
        const currentCoins = window.GameState?.get('currency.cosmicCoins') || 0;
        this.currencyText = this.add.text(x + 10, y, `${currentCoins}`, {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.currencyText.setOrigin(0.5, 0.5);

        // Listen for currency changes
        if (window.GameState) {
            window.GameState.on('changed:currency.cosmicCoins', (newValue) => {
                this.updateCurrencyDisplay(newValue);
            });
        }
    }

    /**
     * Update currency display
     */
    updateCurrencyDisplay(amount) {
        if (this.currencyText) {
            this.currencyText.setText(`${amount}`);

            // Animate on change
            this.tweens.add({
                targets: this.currencyText,
                scale: { from: 1.2, to: 1.0 },
                duration: 300,
                ease: 'Back.easeOut'
            });
        }
    }

    /**
     * Create category menu (Pokemon-style tabs)
     */
    createCategoryMenu() {
        const categories = [
            { id: 'eggs', label: 'Eggs', icon: '🥚' },
            { id: 'food', label: 'Food', icon: '🍎' },
            { id: 'utilities', label: 'Items', icon: '🎒' }
        ];

        const startX = 250;
        const startY = 100;
        const buttonWidth = 150;
        const buttonHeight = 50;
        const spacing = 10;

        categories.forEach((category, index) => {
            const x = startX + (buttonWidth + spacing) * index;
            const y = startY;

            // Button background
            const button = this.add.graphics();
            button.fillStyle(0x2A0040, 0.9);
            button.fillRoundedRect(x, y, buttonWidth, buttonHeight, 8);
            button.lineStyle(2, 0x6B00B3);
            button.strokeRoundedRect(x, y, buttonWidth, buttonHeight, 8);

            // Icon
            const icon = this.add.text(x + 20, y + 25, category.icon, {
                fontSize: '24px'
            });
            icon.setOrigin(0.5, 0.5);

            // Label
            const label = this.add.text(x + 85, y + 25, category.label, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#FFFFFF'
            });
            label.setOrigin(0.5, 0.5);

            // Interactive zone
            const zone = this.add.zone(x, y, buttonWidth, buttonHeight).setOrigin(0, 0);
            zone.setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => {
                this.selectCategory(category.id);
            });

            zone.on('pointerover', () => {
                button.clear();
                button.fillStyle(0x4A0080, 0.9);
                button.fillRoundedRect(x, y, buttonWidth, buttonHeight, 8);
                button.lineStyle(3, 0x8B00D9);
                button.strokeRoundedRect(x, y, buttonWidth, buttonHeight, 8);
            });

            zone.on('pointerout', () => {
                if (this.selectedCategory !== category.id) {
                    button.clear();
                    button.fillStyle(0x2A0040, 0.9);
                    button.fillRoundedRect(x, y, buttonWidth, buttonHeight, 8);
                    button.lineStyle(2, 0x6B00B3);
                    button.strokeRoundedRect(x, y, buttonWidth, buttonHeight, 8);
                }
            });

            this.categoryButtons.push({
                id: category.id,
                button,
                zone,
                x,
                y,
                width: buttonWidth,
                height: buttonHeight
            });
        });
    }

    /**
     * Select category and update display
     */
    selectCategory(categoryId) {
        console.log(`[ShopScene] Category selected: ${categoryId}`);

        this.selectedCategory = categoryId;
        this.selectedItemIndex = 0;

        // Update category button visuals
        this.categoryButtons.forEach(cat => {
            cat.button.clear();

            if (cat.id === categoryId) {
                // Active state
                cat.button.fillStyle(0x6B00B3, 1);
                cat.button.fillRoundedRect(cat.x, cat.y, cat.width, cat.height, 8);
                cat.button.lineStyle(3, 0xFFD700);
                cat.button.strokeRoundedRect(cat.x, cat.y, cat.width, cat.height, 8);
            } else {
                // Inactive state
                cat.button.fillStyle(0x2A0040, 0.9);
                cat.button.fillRoundedRect(cat.x, cat.y, cat.width, cat.height, 8);
                cat.button.lineStyle(2, 0x6B00B3);
                cat.button.strokeRoundedRect(cat.x, cat.y, cat.width, cat.height, 8);
            }
        });

        // Display items for selected category
        this.displayCategory(categoryId);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Create item catalog display area
     */
    createItemCatalog() {
        const x = 250;
        const y = 170;
        const width = 530;
        const height = 350;

        // Catalog panel
        this.catalogPanel = this.add.graphics();
        this.catalogPanel.fillStyle(0x1A0A2E, 0.8);
        this.catalogPanel.fillRoundedRect(x, y, width, height, 10);
        this.catalogPanel.lineStyle(3, 0x4A0080);
        this.catalogPanel.strokeRoundedRect(x, y, width, height, 10);

        // Scrollable area marker
        this.catalogContainer = this.add.container(0, 0);
    }

    /**
     * Display items for selected category
     */
    displayCategory(categoryId) {
        // Clear existing items
        this.catalogContainer.removeAll(true);
        this.itemButtons = [];

        const items = this.shopItems[categoryId] || [];

        const startX = 270;
        const startY = 190;
        const itemHeight = 80;
        const itemWidth = 490;

        items.forEach((item, index) => {
            const y = startY + (itemHeight + 10) * index;

            // Item row background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(0x2A0040, 0.6);
            itemBg.fillRoundedRect(startX, y, itemWidth, itemHeight, 8);
            itemBg.lineStyle(2, 0x6B00B3);
            itemBg.strokeRoundedRect(startX, y, itemWidth, itemHeight, 8);

            // Item icon
            const icon = this.add.text(startX + 30, y + 40, item.icon, {
                fontSize: '36px'
            });
            icon.setOrigin(0.5, 0.5);

            // Item name
            const name = this.add.text(startX + 80, y + 20, item.name, {
                fontSize: '18px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF'
            });

            // Item description
            const desc = this.add.text(startX + 80, y + 45, item.description, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#AAAAAA'
            });

            // Price
            const priceText = this.add.text(startX + 380, y + 40, `${item.price}`, {
                fontSize: '20px',
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 2
            });
            priceText.setOrigin(0.5, 0.5);

            // Coin icon next to price
            const coinIcon = this.add.graphics();
            coinIcon.fillStyle(0xFFD700, 1);
            coinIcon.fillCircle(startX + 430, y + 40, 10);
            coinIcon.fillStyle(0xFFA500, 1);
            coinIcon.fillCircle(startX + 430, y + 40, 7);

            // Buy button
            const buyBtn = this.add.graphics();
            buyBtn.fillStyle(0x00AA00, 0.9);
            buyBtn.fillRoundedRect(startX + 400, y + 15, 70, 50, 8);
            buyBtn.lineStyle(2, 0x00FF00);
            buyBtn.strokeRoundedRect(startX + 400, y + 15, 70, 50, 8);

            const buyLabel = this.add.text(startX + 435, y + 40, 'BUY', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF'
            });
            buyLabel.setOrigin(0.5, 0.5);

            // Interactive zone
            const zone = this.add.zone(startX + 400, y + 15, 70, 50).setOrigin(0, 0);
            zone.setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => {
                this.showPurchaseConfirmation(item);
            });

            zone.on('pointerover', () => {
                buyBtn.clear();
                buyBtn.fillStyle(0x00DD00, 1);
                buyBtn.fillRoundedRect(startX + 400, y + 15, 70, 50, 8);
                buyBtn.lineStyle(3, 0x00FF00);
                buyBtn.strokeRoundedRect(startX + 400, y + 15, 70, 50, 8);

                // Show item tooltip
                this.showItemTooltip(item, startX, y);
            });

            zone.on('pointerout', () => {
                buyBtn.clear();
                buyBtn.fillStyle(0x00AA00, 0.9);
                buyBtn.fillRoundedRect(startX + 400, y + 15, 70, 50, 8);
                buyBtn.lineStyle(2, 0x00FF00);
                buyBtn.strokeRoundedRect(startX + 400, y + 15, 70, 50, 8);

                // Hide item tooltip
                this.hideItemTooltip();
            });

            this.catalogContainer.add([itemBg, icon, name, desc, priceText, coinIcon, buyBtn, buyLabel, zone]);

            this.itemButtons.push({
                item,
                button: buyBtn,
                zone
            });
        });
    }

    /**
     * Create purchase confirmation panel
     */
    createPurchasePanel() {
        // Will be shown/hidden as needed
        this.purchasePanel = this.add.container(0, 0);
        this.purchasePanel.setVisible(false);
        this.purchasePanel.setDepth(100);
    }

    /**
     * Show purchase confirmation dialog
     */
    showPurchaseConfirmation(item) {
        console.log(`[ShopScene] Showing confirmation for: ${item.name}`);

        // Create dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 800, 600);
        overlay.setDepth(200);

        // Create confirmation panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(200, 150, 400, 300, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(200, 150, 400, 300, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(400, 200, 'Confirm Purchase', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Item details
        const details = this.add.text(400, 260,
            `${item.name}\n\nPrice: ${item.price} Cosmic Coins`, {
            fontSize: '20px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Confirm button
        const confirmBtn = this.add.graphics();
        confirmBtn.fillStyle(0x00AA00, 1);
        confirmBtn.fillRoundedRect(230, 360, 140, 50, 10);
        confirmBtn.lineStyle(2, 0x00FF00);
        confirmBtn.strokeRoundedRect(230, 360, 140, 50, 10);
        confirmBtn.setDepth(202);

        const confirmLabel = this.add.text(300, 385, 'Confirm', {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const confirmZone = this.add.zone(230, 360, 140, 50).setOrigin(0, 0);
        confirmZone.setInteractive({ useHandCursor: true });
        confirmZone.setDepth(202);

        // Cancel button
        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0xAA0000, 1);
        cancelBtn.fillRoundedRect(430, 360, 140, 50, 10);
        cancelBtn.lineStyle(2, 0xFF0000);
        cancelBtn.strokeRoundedRect(430, 360, 140, 50, 10);
        cancelBtn.setDepth(202);

        const cancelLabel = this.add.text(500, 385, 'Cancel', {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const cancelZone = this.add.zone(430, 360, 140, 50).setOrigin(0, 0);
        cancelZone.setInteractive({ useHandCursor: true });
        cancelZone.setDepth(202);

        // Store references for cleanup
        const dialogElements = [overlay, panel, title, details, confirmBtn, confirmLabel, confirmZone, cancelBtn, cancelLabel, cancelZone];

        // Confirm handler
        confirmZone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            // Clean up dialog
            dialogElements.forEach(el => el.destroy());

            // Proceed with purchase
            this.purchaseItem(item);
        });

        // Confirm button hover
        confirmZone.on('pointerover', () => {
            confirmBtn.clear();
            confirmBtn.fillStyle(0x00DD00, 1);
            confirmBtn.fillRoundedRect(230, 360, 140, 50, 10);
            confirmBtn.lineStyle(3, 0x00FF00);
            confirmBtn.strokeRoundedRect(230, 360, 140, 50, 10);
        });

        confirmZone.on('pointerout', () => {
            confirmBtn.clear();
            confirmBtn.fillStyle(0x00AA00, 1);
            confirmBtn.fillRoundedRect(230, 360, 140, 50, 10);
            confirmBtn.lineStyle(2, 0x00FF00);
            confirmBtn.strokeRoundedRect(230, 360, 140, 50, 10);
        });

        // Cancel handler
        cancelZone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            // Clean up dialog
            dialogElements.forEach(el => el.destroy());
        });

        // Cancel button hover
        cancelZone.on('pointerover', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0xDD0000, 1);
            cancelBtn.fillRoundedRect(430, 360, 140, 50, 10);
            cancelBtn.lineStyle(3, 0xFF0000);
            cancelBtn.strokeRoundedRect(430, 360, 140, 50, 10);
        });

        cancelZone.on('pointerout', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0xAA0000, 1);
            cancelBtn.fillRoundedRect(430, 360, 140, 50, 10);
            cancelBtn.lineStyle(2, 0xFF0000);
            cancelBtn.strokeRoundedRect(430, 360, 140, 50, 10);
        });

        // ESC to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                dialogElements.forEach(el => el.destroy());
                this.input.keyboard.off('keydown', escHandler);
            }
        };
        this.input.keyboard.on('keydown', escHandler);
    }

    /**
     * Show detailed item tooltip on hover
     * @param {Object} item - Item data
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    showItemTooltip(item, x, y) {
        // Hide existing tooltip first
        this.hideItemTooltip();

        // Create tooltip background
        const tooltipWidth = 250;
        const tooltipHeight = 120;
        const tooltipX = x + 500; // Position to the right of the item
        const tooltipY = y;

        this.itemTooltip = this.add.graphics();
        this.itemTooltip.fillStyle(0x1A1A3E, 0.95);
        this.itemTooltip.fillRoundedRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 10);
        this.itemTooltip.lineStyle(2, 0xFFD700);
        this.itemTooltip.strokeRoundedRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 10);
        this.itemTooltip.setDepth(150);

        // Item details
        const detailsText = [
            `${item.icon} ${item.name}`,
            '',
            item.description,
            '',
            `Type: ${item.category}`,
            `Effect: ${item.effect || 'Cosmetic'}`,
            '',
            `Price: ${item.price} Cosmic Coins`
        ].join('\n');

        this.itemTooltipText = this.add.text(tooltipX + 15, tooltipY + 15, detailsText, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            wordWrap: { width: tooltipWidth - 30 }
        });
        this.itemTooltipText.setDepth(151);

        console.log(`[ShopScene] Showing tooltip for: ${item.name}`);
    }

    /**
     * Hide the item tooltip
     */
    hideItemTooltip() {
        if (this.itemTooltip) {
            this.itemTooltip.destroy();
            this.itemTooltip = null;
        }
        if (this.itemTooltipText) {
            this.itemTooltipText.destroy();
            this.itemTooltipText = null;
        }
    }

    /**
     * Purchase item with validation
     */
    purchaseItem(item) {
        console.log(`[ShopScene] Attempting to purchase: ${item.name} for ${item.price} coins`);

        const currentCoins = window.GameState?.get('currency.cosmicCoins') || 0;

        // Validate purchase
        if (currentCoins < item.price) {
            this.showMessage('Not enough cosmic coins!', 0xFF0000);

            if (window.AudioManager) {
                window.AudioManager.playCollectCoin(); // Use as error sound
            }
            return;
        }

        // Check inventory space
        if (window.InventoryManager && !window.InventoryManager.hasSpace()) {
            this.showMessage('Inventory is full!', 0xFF0000);

            if (window.AudioManager) {
                window.AudioManager.playCollectCoin(); // Use as error sound
            }
            return;
        }

        // Process purchase via EconomyManager
        if (window.EconomyManager) {
            const success = window.EconomyManager.purchase(item.name, item.price, 'shop_purchase');

            if (success) {
                // Add item to inventory
                if (window.InventoryManager) {
                    const itemAdded = window.InventoryManager.addItem(item);

                    if (itemAdded) {
                        console.log(`[ShopScene] Purchase successful: ${item.name}`);
                        this.showMessage(`Purchased ${item.name}!`, 0x00FF00);

                        if (window.AudioManager) {
                            window.AudioManager.playCollectCoin();
                        }
                    } else {
                        // Refund if item couldn't be added
                        window.EconomyManager.addCoins(item.price, 'shop_refund');
                        this.showMessage('Failed to add item to inventory!', 0xFF0000);
                    }
                } else {
                    console.warn('[ShopScene] InventoryManager not available');
                    this.showMessage('Inventory system unavailable!', 0xFF0000);

                    // Refund purchase
                    window.EconomyManager.addCoins(item.price, 'shop_refund');
                }
            } else {
                this.showMessage('Purchase failed!', 0xFF0000);
            }
        }
    }

    /**
     * Show temporary message
     */
    showMessage(message, color) {
        const msgText = this.add.text(400, 550, message, {
            fontSize: '20px',
            fontFamily: 'Arial Black',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        msgText.setOrigin(0.5, 0.5);
        msgText.setDepth(150);
        msgText.setAlpha(0);

        // Fade in
        this.tweens.add({
            targets: msgText,
            alpha: 1,
            duration: 200,
            onComplete: () => {
                // Hold
                this.time.delayedCall(1500, () => {
                    // Fade out
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
     * Create exit button
     */
    createExitButton() {
        const x = 700;
        const y = 540;
        const width = 80;
        const height = 40;

        // Button background
        const button = this.add.graphics();
        button.fillStyle(0xAA0000, 0.9);
        button.fillRoundedRect(x, y, width, height, 8);
        button.lineStyle(2, 0xFF0000);
        button.strokeRoundedRect(x, y, width, height, 8);

        // Label
        const label = this.add.text(x + 40, y + 20, 'EXIT', {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        label.setOrigin(0.5, 0.5);

        // Interactive zone
        const zone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => {
            this.exitShop();
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

        // ESC key to exit
        this.input.keyboard.on('keydown-ESC', () => {
            this.exitShop();
        });
    }

    /**
     * Exit shop and return to GameScene
     */
    exitShop() {
        console.log('[ShopScene] Exiting Cosmic Shop');

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Stop this scene and resume GameScene
        this.scene.stop();
        this.scene.resume('GameScene');
    }

    /**
     * Initialize shop item catalog
     */
    initializeShopItems() {
        this.shopItems = {
            eggs: [
                {
                    id: 'basic_egg',
                    name: 'Cosmic Egg',
                    description: 'A mysterious egg from the void',
                    icon: '🥚',
                    price: 100,
                    type: 'egg',
                    rarity: 'common'
                },
                {
                    id: 'rare_egg',
                    name: 'Stellar Egg',
                    description: 'Radiates powerful cosmic energy',
                    icon: '🌟',
                    price: 500,
                    type: 'egg',
                    rarity: 'rare'
                }
            ],
            food: [
                {
                    id: 'stardust_treat',
                    name: 'Stardust Treat',
                    description: 'Restores 20 happiness',
                    icon: '✨',
                    price: 20,
                    type: 'food',
                    effect: { happiness: 20 }
                },
                {
                    id: 'cosmic_berry',
                    name: 'Cosmic Berry',
                    description: 'Restores 30 hunger',
                    icon: '🫐',
                    price: 30,
                    type: 'food',
                    effect: { hunger: 30 }
                },
                {
                    id: 'nebula_nectar',
                    name: 'Nebula Nectar',
                    description: 'Restores 40 health',
                    icon: '🍯',
                    price: 50,
                    type: 'food',
                    effect: { health: 40 }
                }
            ],
            utilities: [
                {
                    id: 'void_crystal',
                    name: 'Void Crystal',
                    description: 'Used to enhance abilities',
                    icon: '💎',
                    price: 150,
                    type: 'utility'
                },
                {
                    id: 'star_map',
                    name: 'Star Map',
                    description: 'Reveals hidden locations',
                    icon: '🗺️',
                    price: 200,
                    type: 'utility'
                }
            ]
        };

        console.log('[ShopScene] Shop items initialized');
    }

    /**
     * Cleanup on shutdown
     */
    shutdown() {
        console.log('[ShopScene] Shutting down - cleaning up event listeners');

        // Remove global event listeners
        if (window.GameState) {
            window.GameState.off('changed:currency.cosmicCoins');
        }

        // Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-ESC');
        }

        // Remove listeners from interactive zones/buttons
        // Category buttons
        if (this.categoryButtons && Array.isArray(this.categoryButtons)) {
            this.categoryButtons.forEach(button => {
                if (button && button.zone && button.zone.removeAllListeners) {
                    button.zone.removeAllListeners();
                }
            });
        }

        // Item buttons
        if (this.itemButtons && Array.isArray(this.itemButtons)) {
            this.itemButtons.forEach(button => {
                if (button && button.zone && button.zone.removeAllListeners) {
                    button.zone.removeAllListeners();
                }
            });
        }

        // Close button zone
        if (this.closeButtonZone && this.closeButtonZone.removeAllListeners) {
            this.closeButtonZone.removeAllListeners();
        }

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Clear references
        this.graphicsEngine = null;
        this.shopItems = null;
        this.categoryButtons = [];
        this.itemButtons = [];
        this.catalogContainer = null;
        this.purchasePanel = null;
        this.closeButtonZone = null;

        console.log('[ShopScene] Cleanup complete');
    }
}

// Register scene globally
if (typeof window !== 'undefined') {
    window.ShopScene = ShopScene;
}
