/**
 * ShopScene - Cosmic Shop with Pokemon-style UI
 * Features: Item catalog, purchase flow, currency display, shopkeeper NPC
 */

import Phaser from 'phaser';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';
import VillageCommandPanel from '../ui/VillageCommandPanel.js';
import {
    assignCreatureToVillageBuilding,
    getVillageSnapshot,
    initializeVillageSettlement,
    placeVillageBuilding,
    reconcileVillageSettlement
} from '../systems/VillageSettlement.js';

export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });

        this.graphicsEngine = null;
        this.selectedCategory = 'eggs'; // eggs, food, powerups, utilities, base
        this.selectedItemIndex = 0;
        this.shopItems = null;
        this.categoryButtons = [];
        this.itemButtons = [];
        this.shopkeeper = null;
        this.gameStateUnsubscribers = [];
        this.cleanupCallbacks = [];
        this._isShuttingDown = false;
        this.previewOpenRoutes = new Set();
        this.previewVoidCrystalCapacity = false;
        this.villageCommandPanel = null;
    }

    init(data = {}) {
        this.previewOpenRoutes = new Set(
            Array.isArray(data.routeMapPreview) ? data.routeMapPreview : []
        );
        this.previewVoidCrystalCapacity = data.voidCrystalCapacityPreview === true;
        this.selectedCategory = data.initialCategory || 'eggs';
    }

    create() {
        console.log('[ShopScene] Initializing Cosmic Shop');

        this.resetLifecycleTracking();
        if (this.events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        }

        // Initialize graphics engine for this scene
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        // Calculate responsive dimensions
        this.calculateResponsiveDimensions();

        // Initialize scroll state
        this.scrollY = 0;
        this.maxScrollY = 0;
        this.isDragging = false;
        this.dragStartY = 0;
        this.dragStartScrollY = 0;
        this.dragDistance = 0;
        this.dragThreshold = 10; // Minimum pixels to differentiate tap from drag
        this.isPurchasing = false; // Track purchase state to prevent double-clicks

        // Create shop UI with responsive layout
        this.createBackground();
        this.createHeader(); // New: Combined header with title, coins, and close button
        if (this.dims.showShopkeeper) {
            this.createShopkeeper();
        }
        this.createCategoryMenu();
        this.createItemCatalog();
        this.createPurchasePanel();

        // Set up scroll handling
        this.setupScrolling();

        // Initialize shop items
        this.initializeShopItems();

        // Display initial category
        this.displayCategory(this.selectedCategory);

        // Play shop ambient sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Hide loading overlay once shop is ready
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }
    }

    resetLifecycleTracking() {
        this._isShuttingDown = false;
        this.gameStateUnsubscribers = [];
        this.cleanupCallbacks = [];
    }

    registerCleanupCallback(callback) {
        if (typeof callback === 'function') {
            this.cleanupCallbacks.push(callback);
        }
    }

    registerGameStateListener(event, handler) {
        if (!window.GameState || typeof window.GameState.on !== 'function') {
            return null;
        }
        const unsubscribe = window.GameState.on(event, handler);
        if (typeof unsubscribe === 'function') {
            this.gameStateUnsubscribers.push(unsubscribe);
        }
        return unsubscribe;
    }

    /**
     * Calculate responsive dimensions based on viewport size
     * Mobile-first approach with breakpoints
     */
    calculateResponsiveDimensions() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Determine device type
        const isMobile = width < 600;
        const isTablet = width >= 600 && width < 1000;
        const isDesktop = width >= 1000;

        this.dims = {
            width,
            height,
            isMobile,
            isTablet,
            isDesktop,

            // Safe margins
            margin: isMobile ? 10 : 20,
            padding: isMobile ? 8 : 15,

            // Header
            headerHeight: isMobile ? 92 : 80,

            // Shopkeeper (hide on mobile to save space)
            showShopkeeper: !isMobile,
            shopkeeperWidth: isMobile ? 0 : 200,

            // Category buttons
            categoryHeight: isMobile ? 45 : 50,
            categoryButtonWidth: isMobile ? (width - 30) / 3 : 150,

            // Item catalog
            catalogStartY: isMobile ? 157 : 150,
            itemHeight: isMobile ? 98 : 80,
            itemSpacing: isMobile ? 8 : 10,

            // Button sizes (44px minimum for touch targets)
            buttonMinSize: 44,
            closeButtonSize: isMobile ? 50 : 40,

            // Font sizes
            titleSize: isMobile ? '22px' : '36px',
            subtitleSize: isMobile ? '12px' : '16px',
            itemNameSize: isMobile ? '16px' : '18px',
            itemDescSize: isMobile ? '11px' : '12px',
            priceSize: isMobile ? '18px' : '20px',

            // Calculated areas
            contentWidth: isMobile ? width - 20 : width - 40,
            catalogX: isMobile ? 10 : (isDesktop ? 230 : 20),
            catalogWidth: isMobile ? width - 20 : (isDesktop ? width - 260 : width - 40)
        };

        console.log('[ShopScene] Responsive dims:', {
            viewport: `${width}x${height}`,
            device: isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop'),
            catalogArea: `${this.dims.catalogWidth}x${height - this.dims.catalogStartY - 20}`
        });
    }

    /**
     * Create cosmic shop background (responsive)
     */
    createBackground() {
        const { width, height } = this.dims;

        // Dark cosmic background
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x0A0520, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // Add star field (density based on screen size)
        const starCount = Math.min(200, Math.floor((width * height) / 3000));
        for (let i = 0; i < starCount; i++) {
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

        bgGraphics.setDepth(0);
    }

    /**
     * Create header with title, coins, and close button (responsive)
     */
    createHeader() {
        const { width, headerHeight, margin, titleSize, closeButtonSize, isMobile } = this.dims;

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A0A2E, 0.9);
        headerBg.fillRect(0, 0, width, headerHeight);
        headerBg.lineStyle(2, 0x6B00B3);
        headerBg.strokeRect(0, headerHeight - 2, width, 2);
        headerBg.setDepth(10);

        const titleX = isMobile ? margin : 60;
        const titleY = isMobile ? 20 : headerHeight / 2 - 5;
        const title = this.add.text(
            titleX,
            titleY,
            isMobile ? 'COSMIC BOUTIQUE' : 'COZY COSMIC BOUTIQUE',
            {
            fontSize: titleSize,
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#4A0080',
            strokeThickness: isMobile ? 4 : 6,
            align: 'center'
            }
        );
        title.setOrigin(0, 0.5);
        title.setDepth(11);

        const grownUpHelper = this.add.text(
            isMobile ? margin : width / 2,
            isMobile ? 45 : headerHeight - 18,
            'Need help? Ask a grown-up to browse cozy goodies with you.',
            {
                fontSize: this.dims.isMobile ? '10px' : '13px',
                color: '#E6E6FA',
                fontFamily: 'Arial, sans-serif',
                wordWrap: isMobile ? { width: width - closeButtonSize - margin * 3 } : undefined
            }
        ).setOrigin(isMobile ? 0 : 0.5, 0.5);
        grownUpHelper.setDepth(11);
        grownUpHelper.setAlpha(0.9);

        // Currency gets its own row on narrow screens.
        const coinX = isMobile
            ? margin + 10
            : width - (closeButtonSize + margin * 2 + 80);
        const coinY = isMobile ? headerHeight - 18 : headerHeight / 2;

        // Coin icon
        const coinIcon = this.add.graphics();
        coinIcon.fillStyle(0xFFD700, 1);
        coinIcon.fillCircle(coinX, coinY, 10);
        coinIcon.fillStyle(0xFFA500, 1);
        coinIcon.fillCircle(coinX, coinY, 7);
        coinIcon.fillStyle(0xFFFF00, 0.6);
        coinIcon.fillCircle(coinX - 2, coinY - 2, 3);
        coinIcon.setDepth(11);

        // Currency text
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
        this.currencyText = this.add.text(coinX + 20, coinY, `${currentCoins}`, {
            fontSize: this.dims.isMobile ? '20px' : '24px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.currencyText.setOrigin(0, 0.5);
        this.currencyText.setDepth(11);

        // Listen for currency changes
        if (window.GameState) {
            this.currencyChangeHandler = this.currencyChangeHandler || ((newValue) => {
                this.updateCurrencyDisplay(newValue);
            });
            this.registerGameStateListener('changed:player.cosmicCoins', this.currencyChangeHandler);
        }

        // Close button (X) - ALWAYS VISIBLE top-right
        const closeX = width - closeButtonSize - margin;
        const closeY = isMobile ? 6 : (headerHeight - closeButtonSize) / 2;

        const closeBtn = this.add.graphics();
        closeBtn.fillStyle(0xAA0000, 0.9);
        closeBtn.fillRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
        closeBtn.lineStyle(2, 0xFF0000);
        closeBtn.strokeRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
        closeBtn.setDepth(11);

        const closeLabel = this.add.text(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, 'X', {
            fontSize: this.dims.isMobile ? '28px' : '24px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        closeLabel.setOrigin(0.5, 0.5);
        closeLabel.setDepth(11);

        // Close button interactive zone (large touch target)
        const closeTouchSize = Math.max(closeButtonSize, 44); // Minimum 44px for touch
        const closeZone = this.add.zone(closeX, closeY, closeTouchSize, closeTouchSize).setOrigin(0, 0);
        closeZone.setInteractive({ useHandCursor: true });
        closeZone.setDepth(11);

        closeZone.on('pointerdown', () => {
            this.exitShop();
        });

        closeZone.on('pointerover', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0xDD0000, 1);
            closeBtn.fillRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
            closeBtn.lineStyle(3, 0xFF0000);
            closeBtn.strokeRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
        });

        closeZone.on('pointerout', () => {
            closeBtn.clear();
            closeBtn.fillStyle(0xAA0000, 0.9);
            closeBtn.fillRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
            closeBtn.lineStyle(2, 0xFF0000);
            closeBtn.strokeRoundedRect(closeX, closeY, closeButtonSize, closeButtonSize, 8);
        });

        // Store reference for cleanup
        this.closeButtonZone = closeZone;
    }

    /**
     * Create animated shopkeeper NPC sprite (desktop only)
     */
    createShopkeeper() {
        const { margin, headerHeight } = this.dims;
        const shopkeeperX = 120;
        const shopkeeperY = headerHeight + 100;

        // Shopkeeper container panel
        const keeperPanel = this.add.graphics();
        keeperPanel.fillStyle(0x1A0A2E, 0.8);
        keeperPanel.fillRoundedRect(margin, headerHeight + margin, 200, 200, 10);
        keeperPanel.lineStyle(3, 0x6B00B3);
        keeperPanel.strokeRoundedRect(margin, headerHeight + margin, 200, 200, 10);
        keeperPanel.setDepth(20);

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
        const keeperLabel = this.add.text(120, shopkeeperY + 70, 'Void Merchant', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#00FFFF',
            align: 'center'
        });
        keeperLabel.setOrigin(0.5, 0.5);
        keeperLabel.setDepth(20);
    }

    /**
     * Create mini void merchant for mobile header
     */
    createMobileMerchant() {
        const { headerHeight, margin } = this.dims;

        // Position in top-left corner
        const merchantX = margin + 25;
        const merchantY = headerHeight / 2;

        // Small circular background with glow
        const merchantBg = this.add.graphics();
        merchantBg.fillStyle(0x6B00B3, 0.3);
        merchantBg.fillCircle(merchantX, merchantY, 28);
        merchantBg.fillStyle(0x1A0A2E, 0.9);
        merchantBg.fillCircle(merchantX, merchantY, 22);
        merchantBg.lineStyle(2, 0x00FFFF);
        merchantBg.strokeCircle(merchantX, merchantY, 22);
        merchantBg.setDepth(11);

        // Generate merchant frame if not exists
        if (!this.textures.exists('voidMerchant_0')) {
            this.graphicsEngine.createVoidMerchant(0);
        }

        // Create small merchant sprite
        this.mobileMerchant = this.add.sprite(merchantX, merchantY, 'voidMerchant_0');
        this.mobileMerchant.setScale(0.35);
        this.mobileMerchant.setDepth(12);

        // Create animation if not exists
        if (!this.anims.exists('voidMerchantIdle')) {
            for (let frame = 0; frame < 4; frame++) {
                this.graphicsEngine.createVoidMerchant(frame);
            }
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
        this.mobileMerchant.play('voidMerchantIdle');

        // Subtle glow pulse effect
        this.tweens.add({
            targets: merchantBg,
            alpha: { from: 1, to: 0.7 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
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

    isRouteMapUnavailable(item) {
        if (item?.type !== 'map' || !item.gateId) {
            return false;
        }

        const mapsOwned = window.GameState?.get('hubWorld.mapsOwned') || [];
        return this.previewOpenRoutes.has(item.gateId) ||
            mapsOwned.includes(item.gateId);
    }

    getItemUnavailableState(item) {
        if (item?.type === 'village') {
            const unlocked = item.villageSnapshot?.unlock?.unlocked === true;
            return {
                unavailable: !unlocked,
                label: unlocked ? 'BUILD' : 'HATCH',
                message: item.villageSnapshot?.unlock?.reason ||
                    'Hatch a companion to wake the Base Builder.'
            };
        }

        if (this.isRouteMapUnavailable(item)) {
            return {
                unavailable: true,
                label: 'OWNED',
                message: 'That permanent route survey is already active.'
            };
        }

        if (item?.id === 'void_crystal') {
            if (this.previewVoidCrystalCapacity) {
                return {
                    unavailable: true,
                    label: 'FULL',
                    message: 'The Sanctuary crystal corner is complete.'
                };
            }

            const capacity = window.InventoryManager?.getUtilityCapacity?.('void_crystal');
            if (capacity && !capacity.canAcquire) {
                return {
                    unavailable: true,
                    label: capacity.placed >= capacity.limit ? 'FULL' : 'PACKED',
                    message: capacity.placed >= capacity.limit
                        ? 'The Sanctuary crystal corner is complete.'
                        : 'Place a carried crystal before buying another.'
                };
            }
        }

        return {
            unavailable: false,
            label: 'BUY',
            message: ''
        };
    }

    getVillageHeartItem() {
        const snapshot = initializeVillageSettlement(window.GameState);
        const resources = snapshot?.resources || { wood: 0, stone: 0, food: 0 };
        const unlocked = snapshot?.unlock?.unlocked === true;

        return {
            id: 'village_heart',
            name: 'Base Builder',
            description: unlocked
                ? `Build with field supplies: ${resources.wood} wood, ${resources.stone} stone, ${resources.food} food.`
                : 'Hatch a companion first. Their presence will bring the Base Builder online.',
            icon: '🏡',
            type: 'village',
            price: null,
            villageSnapshot: snapshot,
            usageHint: 'Shop > Build > Base Builder > Choose a structure > Construct'
        };
    }

    openVillageHeart() {
        const item = this.getVillageHeartItem();
        const availability = this.getItemUnavailableState(item);
        if (availability.unavailable) {
            this.showPurchaseError(availability.message);
            window.AudioManager?.playError?.();
            return false;
        }

        window.AudioManager?.playButtonClick?.();
        return this.openVillageBuilder();
    }

    openVillageBuilder() {
        if (!this.villageCommandPanel) {
            this.villageCommandPanel = new VillageCommandPanel(this);
        }

        return this.villageCommandPanel.show({
            getSnapshot: () => getVillageSnapshot(window.GameState),
            onPlace: request => {
                const result = placeVillageBuilding(window.GameState, request);
                if (result.changed) {
                    window.AudioManager?.playAchievement?.();
                    window.AchievementSystem?.recordEvent?.('story_interaction', {
                        event: 'village_construction_started',
                        buildingId: result.buildingId
                    });
                } else {
                    window.AudioManager?.playError?.();
                }
                return result;
            },
            onAssign: request => {
                const result = assignCreatureToVillageBuilding(window.GameState, request);
                if (result.changed) {
                    window.AudioManager?.playButtonClick?.();
                } else {
                    window.AudioManager?.playError?.();
                }
                return result;
            },
            onTick: () => reconcileVillageSettlement(window.GameState),
            onClose: () => {
                this.villageCommandPanel = null;
                if (!this._isShuttingDown) this.displayCategory('base');
            }
        });
    }

    /**
     * Create category menu (responsive tabs)
     */
    createCategoryMenu() {
        const categories = [
            { id: 'eggs', label: 'Eggs', icon: '🥚' },
            { id: 'food', label: 'Food', icon: '🍎' },
            { id: 'powerups', label: 'Power', icon: '⚡' },
            { id: 'utilities', label: 'Gear', icon: '🎒' },
            { id: 'base', label: 'Build', icon: '🏡' }
        ];

        const { width, headerHeight, catalogX, categoryHeight, categoryButtonWidth, margin, isMobile } = this.dims;
        const spacing = margin / 2;
        const startY = headerHeight + margin;

        // Calculate button positions (centered on mobile, left-aligned on desktop)
        const categoryCount = categories.length;
        const adjustedButtonWidth = isMobile
            ? (width - margin * 2 - spacing * (categoryCount - 1)) / categoryCount
            : categoryButtonWidth * 0.85;
        const totalWidth = (adjustedButtonWidth * categoryCount) + (spacing * (categoryCount - 1));
        const startX = isMobile ? (width - totalWidth) / 2 : catalogX;

        categories.forEach((category, index) => {
            const x = startX + (adjustedButtonWidth + spacing) * index;
            const y = startY;

            // Button background
            const button = this.add.graphics();
            button.fillStyle(0x2A0040, 0.9);
            button.fillRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
            button.lineStyle(2, 0x6B00B3);
            button.strokeRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
            button.setDepth(20);

            // Icon
            const icon = this.add.text(
                x + (isMobile ? adjustedButtonWidth / 4 : 20),
                y + categoryHeight / 2,
                category.icon,
                { fontSize: isMobile ? '18px' : '24px' }
            );
            icon.setOrigin(0.5, 0.5);
            icon.setDepth(21);

            // Label
            const label = this.add.text(
                x + (isMobile ? adjustedButtonWidth * 0.7 : adjustedButtonWidth / 2 + 15),
                y + categoryHeight / 2,
                category.label,
                {
                    fontSize: isMobile ? '12px' : '14px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF'
                }
            );
            label.setOrigin(0.5, 0.5);
            label.setDepth(21);

            // Interactive zone
            const zone = this.add.zone(x, y, adjustedButtonWidth, categoryHeight).setOrigin(0, 0);
            zone.setInteractive({ useHandCursor: true });
            zone.setDepth(21);

            zone.on('pointerdown', () => {
                this.selectCategory(category.id);
            });

            zone.on('pointerover', () => {
                button.clear();
                button.fillStyle(0x4A0080, 0.9);
                button.fillRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
                button.lineStyle(3, 0x8B00D9);
                button.strokeRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
            });

            zone.on('pointerout', () => {
                if (this.selectedCategory !== category.id) {
                    button.clear();
                    button.fillStyle(0x2A0040, 0.9);
                    button.fillRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
                    button.lineStyle(2, 0x6B00B3);
                    button.strokeRoundedRect(x, y, adjustedButtonWidth, categoryHeight, 8);
                }
            });

            this.categoryButtons.push({
                id: category.id,
                button,
                icon,
                label,
                zone,
                x,
                y,
                width: adjustedButtonWidth,
                height: categoryHeight
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
     * Create item catalog display area (responsive with scrolling)
     */
    createItemCatalog() {
        const { catalogX, catalogStartY, catalogWidth, height, margin } = this.dims;
        const catalogHeight = height - catalogStartY - margin;

        // Catalog panel background
        this.catalogPanel = this.add.graphics();
        this.catalogPanel.fillStyle(0x1A0A2E, 0.8);
        this.catalogPanel.fillRoundedRect(catalogX, catalogStartY, catalogWidth, catalogHeight, 10);
        this.catalogPanel.lineStyle(3, 0x4A0080);
        this.catalogPanel.strokeRoundedRect(catalogX, catalogStartY, catalogWidth, catalogHeight, 10);
        this.catalogPanel.setDepth(15);

        // Create scrollable container
        this.catalogContainer = this.add.container(0, 0);
        this.catalogContainer.setDepth(16);

        // Create mask for scrollable area (prevents items from showing outside bounds)
        const maskShape = this.make.graphics({});
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(catalogX, catalogStartY, catalogWidth, catalogHeight);
        const mask = maskShape.createGeometryMask();
        this.catalogContainer.setMask(mask);

        // Store catalog bounds for scroll calculations
        this.catalogBounds = {
            x: catalogX,
            y: catalogStartY,
            width: catalogWidth,
            height: catalogHeight
        };
    }

    /**
     * Display items for selected category (responsive with scrolling)
     */
    displayCategory(categoryId) {
        // Clear existing items
        this.catalogContainer.removeAll(true);
        this.itemButtons = [];

        // Reset scroll position
        this.scrollY = 0;

        const items = categoryId === 'base'
            ? [this.getVillageHeartItem()]
            : this.shopItems[categoryId] || [];
        const { catalogX, catalogStartY, catalogWidth, itemHeight, itemSpacing, padding } = this.dims;

        const startX = catalogX + padding;
        const startY = catalogStartY + padding;
        const itemWidth = catalogWidth - (padding * 2);

        // Calculate total content height and max scroll
        const totalHeight = items.length * (itemHeight + itemSpacing);
        this.maxScrollY = Math.max(0, totalHeight - this.catalogBounds.height + padding * 2);

        items.forEach((item, index) => {
            const y = startY + (itemHeight + itemSpacing) * index;
            const availability = this.getItemUnavailableState(item);
            const itemUnavailable = availability.unavailable;
            const isVillageAccess = item.type === 'village';

            // Item row background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(itemUnavailable ? 0x18382E : 0x2A0040, itemUnavailable ? 0.78 : 0.6);
            itemBg.fillRoundedRect(startX, y, itemWidth, itemHeight, 8);
            itemBg.lineStyle(2, itemUnavailable ? 0x5BBF9A : 0x6B00B3);
            itemBg.strokeRoundedRect(startX, y, itemWidth, itemHeight, 8);

            // Responsive layout calculations
            const iconSize = this.dims.isMobile ? '28px' : '36px';
            const iconX = startX + (this.dims.isMobile ? 24 : 30);
            const textX = startX + (this.dims.isMobile ? 55 : 80);
            const buyBtnWidth = this.dims.isMobile ? 64 : 70;
            const buyBtnX = startX + itemWidth - buyBtnWidth - 10;

            // Item icon
            const icon = this.add.text(iconX, y + itemHeight / 2, item.icon, {
                fontSize: iconSize
            });
            icon.setOrigin(0.5, 0.5);

            // Item name
            const name = this.add.text(textX, y + (this.dims.isMobile ? 14 : 20), item.name, {
                fontSize: this.dims.itemNameSize,
                fontFamily: 'Arial Black',
                color: '#FFFFFF'
            });

            const descMaxWidth = Math.max(100, buyBtnX - textX - 12);
            const desc = this.add.text(textX, y + (this.dims.isMobile ? 39 : 45), item.description, {
                fontSize: this.dims.itemDescSize,
                fontFamily: 'Arial',
                color: '#AAAAAA',
                wordWrap: { width: descMaxWidth }
            });

            // Price sits above the mobile action button and beside it on desktop.
            const priceX = buyBtnX + buyBtnWidth / 2;
            const priceY = y + (this.dims.isMobile ? 18 : itemHeight / 2);

            const priceText = this.add.text(
                priceX,
                priceY,
                itemUnavailable ? '' : (isVillageAccess ? 'SUPPLIES' : `${item.price}`),
                {
                fontSize: isVillageAccess
                    ? (this.dims.isMobile ? '10px' : '12px')
                    : itemUnavailable ? (this.dims.isMobile ? '13px' : '15px') : this.dims.priceSize,
                fontFamily: 'Arial Black',
                color: itemUnavailable ? '#8FE3CF' : isVillageAccess ? '#8FE3CF' : '#FFD700',
                stroke: '#000000',
                strokeThickness: 2
                }
            );
            priceText.setOrigin(0.5, 0.5);

            // Coin icon next to price
            const coinIconX = priceX + 25;
            const coinIcon = this.add.graphics();
            coinIcon.fillStyle(0xFFD700, 1);
            coinIcon.fillCircle(coinIconX, priceY, this.dims.isMobile ? 8 : 10);
            coinIcon.fillStyle(0xFFA500, 1);
            coinIcon.fillCircle(coinIconX, priceY, this.dims.isMobile ? 6 : 7);
            coinIcon.setVisible(!itemUnavailable && !isVillageAccess);

            // Buy button
            const buyBtnY = y + (this.dims.isMobile ? 43 : 15);
            const buyBtnHeight = this.dims.isMobile ? 44 : 50;

            const buyBtn = this.add.graphics();
            buyBtn.fillStyle(itemUnavailable ? 0x355B50 : 0x00AA00, 0.9);
            buyBtn.fillRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);
            buyBtn.lineStyle(2, itemUnavailable ? 0x77B8A4 : 0x00FF00);
            buyBtn.strokeRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);

            const buyLabel = this.add.text(buyBtnX + buyBtnWidth / 2, buyBtnY + buyBtnHeight / 2, availability.label, {
                fontSize: this.dims.isMobile ? '14px' : '16px',
                fontFamily: 'Arial Black',
                color: itemUnavailable ? '#B9D8CE' : '#FFFFFF'
            });
            buyLabel.setOrigin(0.5, 0.5);

            // Interactive zone (larger touch target)
            const zoneTouchSize = Math.max(buyBtnHeight, 44);
            const zone = this.add.zone(buyBtnX, buyBtnY, buyBtnWidth, zoneTouchSize).setOrigin(0, 0);
            if (!itemUnavailable) {
                zone.setInteractive({ useHandCursor: true });

                zone.on('pointerdown', () => {
                    if (isVillageAccess) {
                        this.openVillageHeart();
                        return;
                    }
                    this.showPurchaseConfirmation(item);
                });

                zone.on('pointerover', () => {
                    buyBtn.clear();
                    buyBtn.fillStyle(isVillageAccess ? 0x008F8A : 0x00DD00, 1);
                    buyBtn.fillRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);
                    buyBtn.lineStyle(3, isVillageAccess ? 0x8FE3CF : 0x00FF00);
                    buyBtn.strokeRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);

                    // Show item tooltip (only on desktop)
                    if (!this.dims.isMobile) {
                        this.showItemTooltip(item, startX, y);
                    }
                });

                zone.on('pointerout', () => {
                    buyBtn.clear();
                    buyBtn.fillStyle(isVillageAccess ? 0x006C6C : 0x00AA00, 0.9);
                    buyBtn.fillRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);
                    buyBtn.lineStyle(2, isVillageAccess ? 0x5BE3D7 : 0x00FF00);
                    buyBtn.strokeRoundedRect(buyBtnX, buyBtnY, buyBtnWidth, buyBtnHeight, 8);

                    // Hide item tooltip
                    this.hideItemTooltip();
                });
            }

            this.catalogContainer.add([itemBg, icon, name, desc, priceText, coinIcon, buyBtn, buyLabel, zone]);

            this.itemButtons.push({
                item,
                button: buyBtn,
                zone
            });
        });

        console.log(`[ShopScene] Displayed ${items.length} items, maxScroll: ${this.maxScrollY}`);
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
     * Show purchase confirmation dialog (responsive)
     */
    showPurchaseConfirmation(item) {
        console.log(`[ShopScene] Showing confirmation for: ${item.name}`);

        const { width, height, isMobile } = this.dims;

        // Create dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Modal dimensions (responsive)
        const modalWidth = isMobile ? width - 40 : 400;
        const modalHeight = isMobile ? 280 : 300;
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        // Create confirmation panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, modalY + 40, 'Confirm Purchase', {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Item details
        const details = this.add.text(width / 2, modalY + 110,
            `${item.name}\n\nPrice: ${item.price} Cosmic Coins`, {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Button dimensions
        const btnWidth = isMobile ? (modalWidth - 60) / 2 : 140;
        const btnHeight = isMobile ? 50 : 50;
        const btnY = modalY + modalHeight - btnHeight - 20;
        const btnSpacing = 20;

        // Confirm button
        const confirmBtnX = modalX + 20;
        const confirmBtn = this.add.graphics();
        confirmBtn.fillStyle(0x00AA00, 1);
        confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
        confirmBtn.lineStyle(2, 0x00FF00);
        confirmBtn.strokeRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
        confirmBtn.setDepth(202);

        const confirmLabel = this.add.text(confirmBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Confirm', {
            fontSize: isMobile ? '18px' : '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const confirmZone = this.add.zone(confirmBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        confirmZone.setInteractive({ useHandCursor: true });
        confirmZone.setDepth(202);

        // Cancel button
        const cancelBtnX = modalX + modalWidth - btnWidth - 20;
        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0xAA0000, 1);
        cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.lineStyle(2, 0xFF0000);
        cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.setDepth(202);

        const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Cancel', {
            fontSize: isMobile ? '18px' : '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const cancelZone = this.add.zone(cancelBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
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
            confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
            confirmBtn.lineStyle(3, 0x00FF00);
            confirmBtn.strokeRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
        });

        confirmZone.on('pointerout', () => {
            confirmBtn.clear();
            confirmBtn.fillStyle(0x00AA00, 1);
            confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
            confirmBtn.lineStyle(2, 0x00FF00);
            confirmBtn.strokeRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
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
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(3, 0xFF0000);
            cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        });

        cancelZone.on('pointerout', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0xAA0000, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(2, 0xFF0000);
            cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
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

        // Prevent double-purchases
        if (this.isPurchasing) {
            console.log('[ShopScene] Purchase already in progress');
            return;
        }

        const availability = this.getItemUnavailableState(item);
        if (availability.unavailable) {
            this.showPurchaseError(availability.message);
            window.AudioManager?.playError?.();
            return;
        }

        this.isPurchasing = true;

        // Show loading overlay
        this.showLoadingOverlay('Processing purchase...');

        // FIX: Read from correct state path (player.cosmicCoins not currency.cosmicCoins)
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;

        // Validate purchase
        if (currentCoins < item.price) {
            this.hideLoadingOverlay();
            this.showPurchaseError('Not enough cosmic coins!');
            this.isPurchasing = false;

            // Play insufficient funds sound
            if (window.AudioManager) {
                window.AudioManager.playShopInsufficient?.() || window.AudioManager.playError();
            }
            return;
        }

        // Check inventory space
        if (item.type !== 'map' && window.InventoryManager) {
            const canAcceptItem = window.InventoryManager.canAcceptItem
                ? window.InventoryManager.canAcceptItem(item)
                : window.InventoryManager.hasSpace?.();
            if (!canAcceptItem) {
                this.hideLoadingOverlay();
                this.showPurchaseError('Inventory is full!');
                this.isPurchasing = false;

                if (window.AudioManager) {
                    window.AudioManager.playError();
                }
                return;
            }
        }

        // Simulate async purchase (adds realistic feel)
        this.time.delayedCall(300, () => {
            const delayedAvailability = this.getItemUnavailableState(item);
            if (delayedAvailability.unavailable) {
                this.hideLoadingOverlay();
                this.showPurchaseError(delayedAvailability.message);
                this.isPurchasing = false;
                return;
            }
            if (item.type !== 'map' && window.InventoryManager) {
                const stillHasCapacity = window.InventoryManager.canAcceptItem
                    ? window.InventoryManager.canAcceptItem(item)
                    : window.InventoryManager.hasSpace?.();
                if (!stillHasCapacity) {
                    this.hideLoadingOverlay();
                    this.showPurchaseError('Inventory is full!');
                    this.isPurchasing = false;
                    return;
                }
            }

            // Process purchase via EconomyManager
            // CRITICAL FIX: EconomyManager.purchase() expects (price, itemName) - price first!
            if (window.EconomyManager) {
                const success = window.EconomyManager.purchase(item.price, item.name);

                if (success) {
                    const isRouteMap = item.type === 'map' && item.gateId;
                    const itemAdded = isRouteMap
                        ? window.GameState?.addMapToCollection?.(item.gateId) === true
                        : window.InventoryManager?.addItem?.(item) === true;

                    if (itemAdded) {
                        console.log(`[ShopScene] Purchase successful: ${item.name}`);

                        this.hideLoadingOverlay();
                        this.showPurchaseSuccess(item);

                        // Update coin display in header
                        this.updateCoinDisplay();
                        if (isRouteMap || item.id === 'void_crystal') {
                            this.displayCategory(this.selectedCategory);
                        }

                        if (window.AudioManager) {
                            window.AudioManager.playShopPurchase?.(item.price) || window.AudioManager.playPurchase();
                        }

                        this.isPurchasing = false;
                    } else {
                        // Refund if the permanent unlock or inventory write failed.
                        window.EconomyManager.addCoins(item.price, 'shop_refund');
                        this.hideLoadingOverlay();
                        this.showPurchaseError(
                            isRouteMap
                                ? 'Route map could not be recorded. Your coins were returned.'
                                : 'Failed to add item to inventory!'
                        );
                        this.isPurchasing = false;
                    }
                } else {
                    this.hideLoadingOverlay();
                    this.showPurchaseError('Purchase failed!');
                    this.isPurchasing = false;
                }
            } else {
                this.hideLoadingOverlay();
                this.showPurchaseError('Shop system unavailable!');
                this.isPurchasing = false;
            }
        });
    }

    /**
     * Show loading overlay during purchase processing
     */
    showLoadingOverlay(message = 'Loading...') {
        const { width, height } = this.dims;

        // Semi-transparent dark overlay
        this.loadingOverlay = this.add.graphics();
        this.loadingOverlay.fillStyle(0x000000, 0.8);
        this.loadingOverlay.fillRect(0, 0, width, height);
        this.loadingOverlay.setDepth(300);

        // Loading text
        this.loadingText = this.add.text(width / 2, height / 2, message, {
            fontSize: this.dims.isMobile ? '20px' : '24px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(301);

        // Pulsing animation
        this.tweens.add({
            targets: this.loadingText,
            alpha: { from: 1, to: 0.3 },
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        console.log('[ShopScene] Loading overlay shown');
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.destroy();
            this.loadingOverlay = null;
        }
        if (this.loadingText) {
            this.tweens.killTweensOf(this.loadingText);
            this.loadingText.destroy();
            this.loadingText = null;
        }
        console.log('[ShopScene] Loading overlay hidden');
    }

    /**
     * Show purchase success animation
     */
    showPurchaseSuccess(item) {
        const { width, height, isMobile } = this.dims;

        // Success message
        const destination = item.type === 'map'
            ? 'Permanent survey support active'
            : (item.usageHint || 'Added to Inventory');
        const successText = this.add.text(
            width / 2,
            height / 2 - 50,
            `Purchased ${item.name}\n${destination}`,
            {
            fontSize: isMobile ? '18px' : '23px',
            color: '#00FF00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5).setDepth(250).setAlpha(0);

        // Coin animation (fly from item to header)
        const coinIcon = this.add.text(width / 2, height / 2, item.icon, {
            fontSize: isMobile ? '48px' : '64px'
        }).setOrigin(0.5).setDepth(251).setScale(0);

        // Success sequence
        this.tweens.add({
            targets: successText,
            alpha: 1,
            y: height / 2 - 70,
            duration: 300,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: coinIcon,
            scale: 1.5,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Fly coin to inventory/top
                this.tweens.add({
                    targets: coinIcon,
                    x: width - 100,
                    y: 50,
                    scale: 0.5,
                    duration: 600,
                    ease: 'Power2',
                    onComplete: () => {
                        coinIcon.destroy();
                    }
                });
            }
        });

        // Particle burst using FXLibrary if available
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 20,
                color: [0x00FF00, 0xFFD700, 0xFFFFFF],
                duration: 1500
            });
        }

        // Fade out success text
        this.time.delayedCall(1500, () => {
            this.tweens.add({
                targets: successText,
                alpha: 0,
                y: height / 2 - 100,
                duration: 400,
                onComplete: () => {
                    successText.destroy();
                }
            });
        });
    }

    /**
     * Show purchase error animation
     */
    showPurchaseError(message) {
        const { width, height, isMobile } = this.dims;

        // Error message
        const errorText = this.add.text(width / 2, height / 2, `❌ ${message}`, {
            fontSize: isMobile ? '20px' : '24px',
            color: '#FF0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5).setDepth(250).setAlpha(0);

        // Shake animation
        const originalY = height / 2;
        this.tweens.add({
            targets: errorText,
            alpha: 1,
            duration: 200
        });

        this.tweens.add({
            targets: errorText,
            x: { from: width / 2 - 10, to: width / 2 + 10 },
            duration: 50,
            yoyo: true,
            repeat: 3
        });

        // Fade out
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: errorText,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    errorText.destroy();
                }
            });
        });
    }

    /**
     * Update coin display in header with animation
     */
    updateCoinDisplay() {
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;

        if (this.currencyText) {
            // Animate the coin count update
            const oldCount = parseInt(this.currencyText.text) || 0;

            this.tweens.add({
                targets: this.currencyText,
                scale: { from: 1.2, to: 1 },
                duration: 300,
                ease: 'Back.easeOut'
            });

            // Count up animation
            this.tweens.addCounter({
                from: oldCount,
                to: currentCoins,
                duration: 400,
                onUpdate: (tween) => {
                    const value = Math.floor(tween.getValue());
                    this.currencyText.setText(value.toString());
                }
            });
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
     * Set up scroll handling for item catalog
     * CRITICAL FIX: Implements tap vs drag detection to prevent blocking buy buttons
     */
    setupScrolling() {
        const { x, y, width, height } = this.catalogBounds;

        // Create invisible interactive zone for scrolling
        // DEPTH FIX: Set to 14 (below catalog at 16) to allow button clicks
        const scrollZone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        scrollZone.setInteractive();
        scrollZone.setDepth(14);

        // Store reference for cleanup
        this.scrollZone = scrollZone;

        // Touch/mouse drag scrolling with tap detection
        scrollZone.on('pointerdown', (pointer) => {
            this.dragStartY = pointer.y;
            this.dragStartScrollY = this.scrollY;
            this.dragDistance = 0;
            this.isDragging = false; // Don't set true yet - wait for movement
        });

        scrollZone.on('pointermove', (pointer) => {
            // Calculate drag distance
            const deltaY = Math.abs(this.dragStartY - pointer.y);
            this.dragDistance = deltaY;

            // Only start scrolling if movement exceeds threshold
            if (deltaY > this.dragThreshold) {
                this.isDragging = true;

                const scrollDelta = this.dragStartY - pointer.y;
                this.scrollY = Phaser.Math.Clamp(
                    this.dragStartScrollY + scrollDelta,
                    0,
                    this.maxScrollY
                );
                this.updateScroll();
            }
        });

        scrollZone.on('pointerup', (pointer) => {
            // If drag distance is below threshold, it's a tap - do nothing
            // This allows button zones to handle the click
            if (this.dragDistance < this.dragThreshold) {
                console.log('[ShopScene] Tap detected - allowing button interaction');
            }

            this.isDragging = false;
            this.dragDistance = 0;
        });

        scrollZone.on('pointerout', () => {
            this.isDragging = false;
            this.dragDistance = 0;
        });

        // Mouse wheel scrolling
        scrollZone.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this.scrollY = Phaser.Math.Clamp(
                this.scrollY + deltaY * 0.5,
                0,
                this.maxScrollY
            );
            this.updateScroll();
        });

        // ESC key to exit shop
        this.escapeKeyHandler = this.escapeKeyHandler || (() => {
            this.exitShop();
        });
        this.input.keyboard.on('keydown-ESC', this.escapeKeyHandler);
        this.registerCleanupCallback(() => {
            if (this.input?.keyboard && this.escapeKeyHandler) {
                this.input.keyboard.off('keydown-ESC', this.escapeKeyHandler);
            }
        });

        console.log('[ShopScene] Smart scroll handling set up (tap vs drag detection enabled)');
    }

    /**
     * Update scroll position of catalog container
     */
    updateScroll() {
        if (this.catalogContainer) {
            this.catalogContainer.y = -this.scrollY;
        }
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
        SceneTransitionHelper.stopScene(this);
        SceneTransitionHelper.resumeScene(this, 'GameScene');
    }

    /**
     * Initialize shop item catalog
     */
    initializeShopItems() {
        this.shopItems = {
            eggs: [
                {
                    id: 'cosmic_egg',
                    name: 'Cosmic Egg',
                    description: 'Hatch another companion and preserve both family records in your sanctuary.',
                    icon: '🥚',
                    price: 250,
                    type: 'egg',
                    eggType: 'cosmic',
                    usageHint: 'Inventory > select egg > Hatch',
                    rarityOdds: '50% Common, 25% Uncommon, 15% Rare, 8% Epic, 2% Legendary'
                },
                {
                    id: 'stellar_egg',
                    name: 'Stellar Egg',
                    description: 'Hatch another companion from an uncommon-or-higher stellar creature.',
                    icon: '🌟',
                    price: 1000,
                    type: 'egg',
                    eggType: 'stellar',
                    usageHint: 'Inventory > select egg > Hatch',
                    rarityOdds: '50% Uncommon, 30% Rare, 15% Epic, 5% Legendary'
                }
            ],
            food: [
                {
                    id: 'stardust_treat',
                    name: 'Stardust Treat',
                    description: 'Sparkly cookies that boost smiles (+20 happiness)',
                    icon: '✨',
                    price: 20,
                    type: 'food',
                    usageHint: 'Inventory > select item > Use',
                    effect: { happiness: 20 }
                },
                {
                    id: 'cosmic_berry',
                    name: 'Cosmic Berry',
                    description: 'Juicy berry snack (+30 hunger)',
                    icon: '🫐',
                    price: 30,
                    type: 'food',
                    usageHint: 'Inventory > select item > Use',
                    effect: { hunger: 30 }
                },
                {
                    id: 'nebula_nectar',
                    name: 'Nebula Nectar',
                    description: 'A soothing tea (+40 health)',
                    icon: '🍯',
                    price: 50,
                    type: 'food',
                    usageHint: 'Inventory > select item > Use',
                    effect: { health: 40 }
                }
            ],
            powerups: [
                {
                    id: 'energy_crystal',
                    name: 'Energy Crystal',
                    description: 'Restore 3 crystal energy during levels. Use for special attacks!',
                    icon: '⚡',
                    price: 50,
                    type: 'powerup',
                    effect: { crystalEnergy: 3 },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                },
                {
                    id: 'power_shot',
                    name: 'Power Shot',
                    description: 'Your next ranged attack does 5x damage - instant KO on most enemies!',
                    icon: '🎯',
                    price: 75,
                    type: 'powerup',
                    effect: { nextRangedDamageMultiplier: 5 },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                },
                {
                    id: 'crystal_shield',
                    name: 'Crystal Shield',
                    description: 'Block the next 2 hits you take. Great for boss fights!',
                    icon: '🛡️',
                    price: 100,
                    type: 'powerup',
                    effect: { shieldHits: 2 },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                },
                {
                    id: 'super_blast',
                    name: 'Super Blast',
                    description: 'FREE super special attack! Damages ALL enemies on screen!',
                    icon: '💥',
                    price: 150,
                    type: 'powerup',
                    effect: { freeSpecialAttack: 1 },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                },
                {
                    id: 'health_boost',
                    name: 'Health Boost',
                    description: 'Fully restore health during a level. Emergency rescue!',
                    icon: '❤️',
                    price: 80,
                    type: 'powerup',
                    effect: { fullHealth: true },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                },
                {
                    id: 'double_coins',
                    name: 'Coin Magnet',
                    description: 'Double all coins collected for the rest of this level!',
                    icon: '🧲',
                    price: 100,
                    type: 'powerup',
                    effect: { coinMultiplier: 2 },
                    usageHint: 'Expedition pause menu > Power-ups',
                    usableInLevel: true
                }
            ],
            utilities: [
                {
                    id: 'void_crystal',
                    name: 'Void Crystal',
                    description: 'Sparkly keepsake for decorating cozy corners',
                    icon: '💎',
                    price: 150,
                    type: 'utility',
                    usageHint: 'Inventory > Use to place in Sanctuary'
                },
                {
                    id: 'map_crystal_caves',
                    name: 'Crystal Caves Survey',
                    description: 'Permanent expedition support: +2 crystal energy in Crystal Caves',
                    icon: '🗺️',
                    price: 500,
                    type: 'map',
                    gateId: 'crystal_caves',
                    usageHint: 'Active automatically on every Crystal Caves expedition',
                    effect: '+2 max crystal energy in Crystal Caves'
                },
                {
                    id: 'map_stellar_reef',
                    name: 'Stellar Reef Survey',
                    description: 'Permanent expedition support: +1 max health in Stellar Reef',
                    icon: '🗺️',
                    price: 500,
                    type: 'map',
                    gateId: 'stellar_reef',
                    usageHint: 'Active automatically on every Stellar Reef expedition',
                    effect: '+1 max health in Stellar Reef'
                },
                {
                    id: 'map_void_peaks',
                    name: 'Void Peaks Survey',
                    description: 'Permanent expedition support: +1 guard charge in Void Peaks',
                    icon: '🗺️',
                    price: 750,
                    type: 'map',
                    gateId: 'void_peaks',
                    usageHint: 'Active automatically on every Void Peaks expedition',
                    effect: '+1 guard charge in Void Peaks'
                },
                {
                    id: 'map_aurora_depths',
                    name: 'Aurora Depths Survey',
                    description: 'Permanent expedition support: +1 health and +1 energy in Aurora Depths',
                    icon: '🗺️',
                    price: 1000,
                    type: 'map',
                    gateId: 'aurora_depths',
                    usageHint: 'Active automatically on every Aurora Depths expedition',
                    effect: '+1 max health and +1 max energy in Aurora Depths'
                }
            ]
        };

        console.log('[ShopScene] Shop items initialized');
    }

    /**
     * Cleanup on shutdown
     */
    shutdown() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;

        this.villageCommandPanel?.destroy?.();
        this.villageCommandPanel = null;

        console.log('[ShopScene] Shutting down - cleaning up event listeners');

        // Remove GameState listeners
        this.gameStateUnsubscribers.forEach((unsubscribe) => {
            try {
                unsubscribe?.();
            } catch (error) {
                console.warn('[ShopScene] Failed to unsubscribe GameState listener', error);
            }
        });
        this.gameStateUnsubscribers = [];

        // Run registered cleanup callbacks (keyboard, etc.)
        this.cleanupCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                console.warn('[ShopScene] Cleanup callback failed', error);
            }
        });
        this.cleanupCallbacks = [];

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

        // Scroll zone
        if (this.scrollZone && this.scrollZone.removeAllListeners) {
            this.scrollZone.removeAllListeners();
        }

        // Clean up any active overlays
        this.hideLoadingOverlay();

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Clear all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear references
        this.graphicsEngine = null;
        this.shopItems = null;
        this.categoryButtons = [];
        this.itemButtons = [];
        this.catalogContainer = null;
        this.purchasePanel = null;
        this.closeButtonZone = null;
        this.scrollZone = null;
        this.currencyText = null;
        this.loadingOverlay = null;
        this.loadingText = null;

        console.log('[ShopScene] Cleanup complete');
    }
}

// Register scene globally
if (typeof window !== 'undefined') {
    window.ShopScene = ShopScene;
}
