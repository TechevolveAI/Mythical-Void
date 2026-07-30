/**
 * InventoryScene - Player inventory UI
 * Grid-based inventory display with item usage and management
 */

import Phaser from 'phaser';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';

export default class InventoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InventoryScene' });

        this.graphicsEngine = null;
        this.selectedSlot = null;
        this.selectedDisplaySlot = null;
        this.inventorySlots = [];
        this.itemSprites = [];

        // Tab state: 'items', 'ship_parts', or 'collection'
        this.currentTab = 'items';
        this.tabButtons = [];
        this.collectionElements = []; // Track collection tab UI elements
        this.shipPartsElements = []; // Track ship parts tab UI elements

        // Sort and filter state
        this.currentSort = 'none'; // none, name, type, price
        this.currentFilter = 'all'; // all, food, accessories, consumables

        // Farewell animation state - prevents accidental closure during animation
        this.farewellInProgress = false;
        this.sortButtons = [];
        this.filterButtons = [];
        this._isShuttingDown = false;

        // Track setTimeout IDs for proper cleanup (prevents memory leaks)
        this.pendingTimeouts = [];
        this.kitPreview = null;
    }

    init(data = {}) {
        this.kitPreview = data.kitPreview || null;
    }

    create() {
        this._isShuttingDown = false;
        if (this.events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        }
        console.log('[InventoryScene] 🎒 Initializing Inventory UI');

        try {
            // Initialize graphics engine
            if (window.GraphicsEngine) {
                this.graphicsEngine = new window.GraphicsEngine(this);
                console.log('[InventoryScene] ✅ GraphicsEngine initialized');
            } else {
                console.error('[InventoryScene] ❌ GraphicsEngine not available');
            }

            // Calculate responsive dimensions (mobile-first approach)
            console.log('[InventoryScene] Calculating responsive dimensions...');
            this.calculateResponsiveDimensions();
            console.log('[InventoryScene] ✅ Dimensions calculated:', this.dims);

            // Create UI (responsive approach) with error handling for each step
            console.log('[InventoryScene] Creating background...');
            this.createBackground();
            console.log('[InventoryScene] ✅ Background created');

            console.log('[InventoryScene] Creating header...');
            this.createHeader();
            console.log('[InventoryScene] ✅ Header created');

            console.log('[InventoryScene] Creating tab buttons...');
            this.createTabButtons();
            console.log('[InventoryScene] ✅ Tab buttons created');

            console.log('[InventoryScene] Creating sort/filter controls...');
            this.createSortFilterControls();
            console.log('[InventoryScene] ✅ Sort/filter controls created');

            console.log('[InventoryScene] Creating inventory grid...');
            this.createInventoryGrid();
            console.log('[InventoryScene] ✅ Inventory grid created');

            // Only create desktop sidebar on larger screens
            if (!this.dims.isMobile) {
                console.log('[InventoryScene] Creating item details (desktop only)...');
                this.createItemDetails();
                console.log('[InventoryScene] ✅ Item details created');
            }

            // Create action buttons for ALL devices (mobile and desktop)
            console.log('[InventoryScene] Creating action buttons...');
            this.createActionButtons();
            console.log('[InventoryScene] ✅ Action buttons created');

            console.log('[InventoryScene] Creating exit button...');
            this.createExitButton();
            console.log('[InventoryScene] ✅ Exit button created');

            // Check if InventoryManager exists
            if (!window.InventoryManager) {
                console.error('[InventoryScene] ❌ CRITICAL: InventoryManager not found!');
                this.showErrorMessage('Inventory system not available');
                return;
            }

            // Load inventory items
            console.log('[InventoryScene] Refreshing inventory...');
            this.refreshInventory();
            console.log('[InventoryScene] ✅ Inventory refreshed');

            if (this.kitPreview) {
                this.switchTab('ship_parts');
            }

            // Listen for inventory changes
            console.log('[InventoryScene] Setting up event listeners...');
            window.InventoryManager.on('itemAdded', this.refreshInventory, this);
            window.InventoryManager.on('itemRemoved', this.refreshInventory, this);
            window.InventoryManager.on('itemQuantityChanged', this.refreshInventory, this);
            console.log('[InventoryScene] ✅ Event listeners registered');

            // Hide loading overlay once inventory is ready
            if (window.UXEnhancements) {
                window.UXEnhancements.hideLoading();
            }

            console.log('[InventoryScene] 🎉 Inventory UI fully initialized');
        } catch (error) {
            console.error('[InventoryScene] 💥 FATAL ERROR during initialization:', error);
            console.error('[InventoryScene] Error stack:', error.stack);
            this.showErrorMessage('Failed to load inventory: ' + error.message);

            // Try to create a minimal exit button so user can escape
            try {
                this.createMinimalExitButton();
            } catch (e) {
                console.error('[InventoryScene] Could not create exit button:', e);
            }
        }
    }

    /**
     * Show error message to user
     */
    showErrorMessage(message) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const errorText = this.add.text(width / 2, height / 2, `ERROR:\n${message}`, {
            fontSize: '20px',
            color: '#FF0000',
            backgroundColor: '#000000',
            padding: { x: 20, y: 20 },
            align: 'center'
        }).setOrigin(0.5).setDepth(1000);
    }

    /**
     * Create minimal exit button for error recovery
     */
    createMinimalExitButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const exitText = this.add.text(width / 2, height - 50, 'TAP TO EXIT', {
            fontSize: '24px',
            color: '#FFFFFF',
            backgroundColor: '#AA0000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(1001);

        exitText.setInteractive({ useHandCursor: true });
        exitText.on('pointerdown', () => {
            console.log('[InventoryScene] Emergency exit triggered');
            SceneTransitionHelper.stopScene(this);
            SceneTransitionHelper.resumeScene(this, 'GameScene');
        });
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
        const isCompactMobile = isMobile && height < 700;

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
            headerHeight: isMobile ? 60 : 80,

            // Grid (mobile gets full width, desktop leaves room for sidebar)
            slotSize: isMobile ? (isCompactMobile ? 44 : 56) : 70,
            slotMargin: isMobile ? (isCompactMobile ? 4 : 6) : 10,
            gridCols: 5,
            gridStartX: isMobile ? null : 80,  // null = centered on mobile

            // Sidebar (desktop only)
            sidebarX: 510,
            sidebarWidth: 270,

            // Fonts
            titleSize: isMobile ? '24px' : '32px',
            textSize: isMobile ? '14px' : '16px',
            smallTextSize: isMobile ? '12px' : '14px',

            // Buttons
            buttonHeight: isMobile ? 40 : 50,
            closeButtonSize: isMobile ? 40 : 40
        };

        console.log('[InventoryScene] Responsive dims:', {
            width, height, isMobile, isTablet, isDesktop
        });
    }

    /**
     * Create background
     */
    createBackground() {
        const { width, height } = this.dims;

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
        const { width, titleSize, textSize } = this.dims;

        // Title
        const title = this.add.text(width / 2, 24, 'INVENTORY', {
            fontSize: titleSize,
            fontFamily: 'Arial Black',
            color: '#00FFFF',
            stroke: '#4A0080',
            strokeThickness: this.dims.isMobile ? 4 : 6,
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);

        // Stats panel (will be updated based on active tab)
        const stats = window.InventoryManager?.getStats();
        const statsText = `${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`;

        this.statsText = this.add.text(width / 2, 50, statsText, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center'
        });
        this.statsText.setOrigin(0.5, 0.5);
    }

    /**
     * Create tab buttons for Items/Ship Parts/Collection
     */
    createTabButtons() {
        const { width, isMobile } = this.dims;

        const tabWidth = isMobile ? 85 : 105;
        const tabHeight = 36;
        const tabSpacing = 8;
        const totalWidth = tabWidth * 3 + tabSpacing * 2;
        const startX = (width - totalWidth) / 2;
        const y = 66;

        const tabs = [
            { key: 'items', label: '🎒 Items', icon: '🎒' },
            { key: 'ship_parts', label: '🥋 Kit', icon: '🥋' },
            { key: 'collection', label: '📖 Found', icon: '📖' }
        ];

        tabs.forEach((tab, index) => {
            const x = startX + index * (tabWidth + tabSpacing);
            const isActive = this.currentTab === tab.key;

            // Tab background
            const bg = this.add.graphics();
            this.drawTabButton(bg, x, y, tabWidth, tabHeight, isActive);

            // Tab label
            const label = this.add.text(x + tabWidth / 2, y + tabHeight / 2, tab.label, {
                fontSize: isMobile ? '14px' : '16px',
                fontFamily: 'Arial',
                color: isActive ? '#FFD700' : '#AAAAAA',
                fontStyle: isActive ? 'bold' : 'normal'
            }).setOrigin(0.5);

            // Interactive zone
            const zone = this.add.zone(x, y, tabWidth, tabHeight).setOrigin(0, 0);
            zone.setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => {
                this.switchTab(tab.key);
            });

            zone.on('pointerover', () => {
                if (this.currentTab !== tab.key) {
                    this.drawTabButton(bg, x, y, tabWidth, tabHeight, false, true);
                    label.setColor('#FFFFFF');
                }
            });

            zone.on('pointerout', () => {
                if (this.currentTab !== tab.key) {
                    this.drawTabButton(bg, x, y, tabWidth, tabHeight, false, false);
                    label.setColor('#AAAAAA');
                }
            });

            this.tabButtons.push({ key: tab.key, bg, label, zone, x, y, width: tabWidth, height: tabHeight });
        });
    }

    /**
     * Draw tab button graphics
     */
    drawTabButton(graphics, x, y, width, height, isActive, isHover = false) {
        graphics.clear();
        if (isActive) {
            graphics.fillStyle(0x4A0080, 1);
            graphics.lineStyle(2, 0xFFD700);
        } else if (isHover) {
            graphics.fillStyle(0x3A0060, 1);
            graphics.lineStyle(2, 0x8B00D9);
        } else {
            graphics.fillStyle(0x2A0040, 0.8);
            graphics.lineStyle(1, 0x6B00B3);
        }
        graphics.fillRoundedRect(x, y, width, height, 8);
        graphics.strokeRoundedRect(x, y, width, height, 8);
    }

    /**
     * Switch between tabs
     */
    switchTab(tabKey) {
        if (this.currentTab === tabKey) return;

        this.currentTab = tabKey;

        // Update tab button visuals
        this.tabButtons.forEach(tab => {
            const isActive = tab.key === tabKey;
            this.drawTabButton(tab.bg, tab.x, tab.y, tab.width, tab.height, isActive);
            tab.label.setColor(isActive ? '#FFD700' : '#AAAAAA');
            tab.label.setFontStyle(isActive ? 'bold' : 'normal');
        });

        // Hide/show appropriate content
        if (tabKey === 'items') {
            this.showItemsTab();
        } else if (tabKey === 'ship_parts') {
            this.showShipPartsTab();
        } else {
            this.showCollectionTab();
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Show items tab (inventory)
     */
    showItemsTab() {
        // Show inventory elements
        this.inventorySlots.forEach(slot => {
            if (slot.graphics) slot.graphics.setVisible(true);
            if (slot.zone) slot.zone.setActive(true).setVisible(true);
            if (slot.slotNum) slot.slotNum.setVisible(true);
            if (slot.itemIcon) slot.itemIcon.setVisible(true);
            if (slot.itemQuantity) slot.itemQuantity.setVisible(true);
        });

        // Show sort/filter controls
        this.sortButtons.forEach(btn => {
            btn.button?.setVisible(true);
            btn.text?.setVisible(true);
            btn.zone?.setActive(true);
        });
        this.filterButtons.forEach(btn => {
            btn.button?.setVisible(true);
            btn.text?.setVisible(true);
            btn.zone?.setActive(true);
        });

        // Hide other tab elements
        this.clearCollectionElements();
        this.clearShipPartsElements();
        this.selectionHintText?.setVisible(true);
        const selectedItem = this.selectedSlot === null
            ? null
            : window.InventoryManager?.getItem(this.selectedSlot);
        this.updateSelectedItemActions(selectedItem);

        // Update stats text
        const stats = window.InventoryManager?.getStats();
        if (this.statsText) {
            this.statsText.setText(`${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`);
        }
    }

    /**
     * Show collection tab
     */
    showCollectionTab() {
        // Hide inventory elements
        this.inventorySlots.forEach(slot => {
            if (slot.graphics) slot.graphics.setVisible(false);
            if (slot.zone) slot.zone.setActive(false).setVisible(false);
            if (slot.slotNum) slot.slotNum.setVisible(false);
            if (slot.itemIcon) slot.itemIcon.setVisible(false);
            if (slot.itemQuantity) slot.itemQuantity.setVisible(false);
        });

        // Hide sort/filter controls (not needed for collection)
        this.sortButtons.forEach(btn => {
            btn.button?.setVisible(false);
            btn.text?.setVisible(false);
            btn.zone?.setActive(false);
        });
        this.filterButtons.forEach(btn => {
            btn.button?.setVisible(false);
            btn.text?.setVisible(false);
            btn.zone?.setActive(false);
        });

        // Clear ship parts elements if any
        this.clearShipPartsElements();
        this.selectionHintText?.setVisible(false);
        this.setActionButtonVisible(this.useButton, false);
        this.setActionButtonVisible(this.equipButton, false);

        // Create collection display
        this.createCollectionDisplay();

        // Update stats text
        const collectionStats = window.CollectibleManager?.getCollectionStats();
        if (this.statsText) {
            this.statsText.setText(`${collectionStats?.uniqueTypes || 0} Discovered`);
        }
    }

    /**
     * Create collection display showing discovered items
     */
    createCollectionDisplay() {
        this.clearCollectionElements();

        const { width, height, isMobile, margin } = this.dims;
        const collectionStats = window.CollectibleManager?.getCollectionStats();
        const collectedItems = window.CollectibleManager?.collectedItems || {};
        const allTypes = window.CollectibleManager?.collectibleTypes;

        if (!allTypes) {
            const noDataText = this.add.text(width / 2, 200, 'Collection data not available', {
                fontSize: '16px',
                color: '#888888'
            }).setOrigin(0.5);
            this.collectionElements.push(noDataText);
            return;
        }

        // Create scrollable area
        const startY = 115;
        let currentY = startY;

        // Rarity colors for display
        const rarityColors = {
            common: { color: '#9E9E9E', name: 'Common' },
            uncommon: { color: '#4CAF50', name: 'Uncommon' },
            rare: { color: '#2196F3', name: 'Rare' },
            epic: { color: '#9C27B0', name: 'Epic' },
            legendary: { color: '#FFD700', name: 'Legendary' },
            biome: { color: '#9C27B0', name: 'Biome Special' },
            lore: { color: '#00BCD4', name: 'Lore Fragment' }
        };

        // Section: Collection Summary
        const summaryBg = this.add.graphics();
        summaryBg.fillStyle(0x1A0A2E, 0.8);
        summaryBg.fillRoundedRect(margin, currentY, width - margin * 2, 60, 10);
        summaryBg.lineStyle(2, 0x6B00B3);
        summaryBg.strokeRoundedRect(margin, currentY, width - margin * 2, 60, 10);
        this.collectionElements.push(summaryBg);

        const summaryTitle = this.add.text(width / 2, currentY + 15, 'Collection Summary', {
            fontSize: '16px',
            color: '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.collectionElements.push(summaryTitle);

        const totalText = `Total: ${collectionStats?.total || 0}  |  Unique: ${collectionStats?.uniqueTypes || 0}`;
        const summaryStats = this.add.text(width / 2, currentY + 40, totalText, {
            fontSize: '14px',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.collectionElements.push(summaryStats);

        currentY += 75;

        // Section: By Rarity
        const rarityTitle = this.add.text(margin + 10, currentY, 'By Rarity:', {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.collectionElements.push(rarityTitle);
        currentY += 25;

        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const rarityStartX = margin + 10;
        const raritySpacing = isMobile ? 60 : 80;

        rarityOrder.forEach((rarity, index) => {
            const count = collectionStats?.byRarity?.[rarity] || 0;
            const x = rarityStartX + index * raritySpacing;

            const rarityBadge = this.add.graphics();
            rarityBadge.fillStyle(parseInt(rarityColors[rarity].color.replace('#', '0x')), 0.3);
            rarityBadge.fillRoundedRect(x, currentY, 50, 35, 5);
            rarityBadge.lineStyle(2, parseInt(rarityColors[rarity].color.replace('#', '0x')));
            rarityBadge.strokeRoundedRect(x, currentY, 50, 35, 5);
            this.collectionElements.push(rarityBadge);

            const countText = this.add.text(x + 25, currentY + 10, count.toString(), {
                fontSize: '16px',
                color: rarityColors[rarity].color,
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.collectionElements.push(countText);

            const nameText = this.add.text(x + 25, currentY + 25, rarity.charAt(0).toUpperCase(), {
                fontSize: '10px',
                color: '#AAAAAA'
            }).setOrigin(0.5);
            this.collectionElements.push(nameText);
        });

        currentY += 55;

        // Section: Discovered Items List
        const discoveredTitle = this.add.text(margin + 10, currentY, 'Discovered Items:', {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.collectionElements.push(discoveredTitle);
        currentY += 25;

        // Get all collectible types and show which are discovered
        const allCollectibles = [
            ...(allTypes.common || []),
            ...(allTypes.uncommon || []),
            ...(allTypes.rare || []),
            ...(allTypes.secret || [])
        ];

        const itemsPerRow = isMobile ? 4 : 5;
        const itemSize = isMobile ? 55 : 60;
        const itemSpacing = 8;
        const gridWidth = itemsPerRow * (itemSize + itemSpacing) - itemSpacing;
        const gridStartX = (width - gridWidth) / 2;

        allCollectibles.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            const x = gridStartX + col * (itemSize + itemSpacing);
            const y = currentY + row * (itemSize + itemSpacing);

            const isDiscovered = collectedItems[item.id] > 0;
            const count = collectedItems[item.id] || 0;

            // Item slot background
            const slotBg = this.add.graphics();
            if (isDiscovered) {
                const rarityColor = parseInt((rarityColors[item.rarity]?.color || '#9E9E9E').replace('#', '0x'));
                slotBg.fillStyle(0x2A0040, 0.8);
                slotBg.lineStyle(2, rarityColor);
            } else {
                slotBg.fillStyle(0x1A0A2E, 0.5);
                slotBg.lineStyle(1, 0x333333);
            }
            slotBg.fillRoundedRect(x, y, itemSize, itemSize, 6);
            slotBg.strokeRoundedRect(x, y, itemSize, itemSize, 6);
            this.collectionElements.push(slotBg);

            // Item icon or question mark
            if (isDiscovered) {
                // Try to use programmatic sprite
                const textureName = window.CollectibleManager?.spriteTextureMap?.[item.id];
                if (textureName && this.textures.exists(textureName)) {
                    const sprite = this.add.image(x + itemSize / 2, y + itemSize / 2 - 5, textureName);
                    sprite.setScale(0.5);
                    this.collectionElements.push(sprite);
                } else {
                    // Fallback to emoji icon
                    const icon = this.add.text(x + itemSize / 2, y + itemSize / 2 - 5, item.icon || '?', {
                        fontSize: '24px'
                    }).setOrigin(0.5);
                    this.collectionElements.push(icon);
                }

                // Count badge
                if (count > 0) {
                    const countBadge = this.add.text(x + itemSize - 8, y + itemSize - 10, `x${count}`, {
                        fontSize: '10px',
                        color: '#FFFFFF',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 2
                    }).setOrigin(1, 1);
                    this.collectionElements.push(countBadge);
                }
            } else {
                // Undiscovered - show question mark
                const mystery = this.add.text(x + itemSize / 2, y + itemSize / 2, '?', {
                    fontSize: '28px',
                    color: '#333333',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
                this.collectionElements.push(mystery);
            }

            // Tooltip on hover (show item name)
            const hoverZone = this.add.zone(x, y, itemSize, itemSize).setOrigin(0, 0);
            hoverZone.setInteractive({ useHandCursor: isDiscovered });
            this.collectionElements.push(hoverZone);

            if (isDiscovered) {
                hoverZone.on('pointerover', () => {
                    this.showCollectionTooltip(item, x + itemSize / 2, y - 10);
                });
                hoverZone.on('pointerout', () => {
                    this.hideCollectionTooltip();
                });
            }
        });

        // Update current Y for any elements below
        const totalRows = Math.ceil(allCollectibles.length / itemsPerRow);
        currentY += totalRows * (itemSize + itemSpacing) + 20;

        // Section: Recent Discoveries
        if (collectionStats?.recentDiscoveries?.length > 0) {
            const recentTitle = this.add.text(margin + 10, currentY, 'Recent Discoveries:', {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold'
            });
            this.collectionElements.push(recentTitle);
            currentY += 25;

            const recentList = collectionStats.recentDiscoveries.slice(-5).reverse();
            recentList.forEach((discovery, index) => {
                const timestamp = new Date(discovery.timestamp).toLocaleDateString();
                const rewardStr = [];
                if (discovery.rewards?.coins) rewardStr.push(`+${discovery.rewards.coins} coins`);
                if (discovery.rewards?.xp) rewardStr.push(`+${discovery.rewards.xp} XP`);

                const recentText = this.add.text(margin + 20, currentY + index * 22,
                    `• ${discovery.name} (${timestamp}) ${rewardStr.join(' ')}`, {
                    fontSize: '12px',
                    color: '#CCCCCC'
                });
                this.collectionElements.push(recentText);
            });
        }
    }

    /**
     * Show tooltip for collection item
     */
    showCollectionTooltip(item, x, y) {
        this.hideCollectionTooltip();

        const rarityColors = {
            common: '#9E9E9E',
            uncommon: '#4CAF50',
            rare: '#2196F3',
            epic: '#9C27B0',
            legendary: '#FFD700'
        };

        const bg = this.add.graphics();
        bg.fillStyle(0x1A1A3E, 0.95);
        bg.fillRoundedRect(x - 80, y - 50, 160, 45, 8);
        bg.lineStyle(2, parseInt((rarityColors[item.rarity] || '#9E9E9E').replace('#', '0x')));
        bg.strokeRoundedRect(x - 80, y - 50, 160, 45, 8);
        bg.setDepth(500);

        const nameText = this.add.text(x, y - 38, item.name, {
            fontSize: '14px',
            color: rarityColors[item.rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(501);

        const rarityText = this.add.text(x, y - 20, item.rarity.toUpperCase(), {
            fontSize: '10px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(501);

        this.collectionTooltip = { bg, nameText, rarityText };
    }

    /**
     * Hide collection tooltip
     */
    hideCollectionTooltip() {
        if (this.collectionTooltip) {
            this.collectionTooltip.bg?.destroy();
            this.collectionTooltip.nameText?.destroy();
            this.collectionTooltip.rarityText?.destroy();
            this.collectionTooltip = null;
        }
    }

    /**
     * Clear collection tab elements
     */
    clearCollectionElements() {
        this.hideCollectionTooltip();
        this.collectionElements.forEach(el => {
            if (el && el.destroy) {
                if (el.removeAllListeners) el.removeAllListeners();
                el.destroy();
            }
        });
        this.collectionElements = [];
    }

    // ============ SHIP PARTS TAB ============

    /**
     * Show ship parts tab
     */
    showShipPartsTab() {
        // Hide inventory elements
        this.inventorySlots.forEach(slot => {
            if (slot.graphics) slot.graphics.setVisible(false);
            if (slot.zone) slot.zone.setActive(false).setVisible(false);
            if (slot.slotNum) slot.slotNum.setVisible(false);
            if (slot.itemIcon) slot.itemIcon.setVisible(false);
            if (slot.itemQuantity) slot.itemQuantity.setVisible(false);
        });

        // Hide sort/filter controls (not needed for ship parts)
        this.sortButtons.forEach(btn => {
            btn.button?.setVisible(false);
            btn.text?.setVisible(false);
            btn.zone?.setActive(false);
        });
        this.filterButtons.forEach(btn => {
            btn.button?.setVisible(false);
            btn.text?.setVisible(false);
            btn.zone?.setActive(false);
        });

        // Clear collection elements if any
        this.clearCollectionElements();
        this.selectionHintText?.setVisible(false);
        this.setActionButtonVisible(this.useButton, false);
        this.setActionButtonVisible(this.equipButton, false);

        // Create ship parts display
        this.createShipPartsDisplay();

        // Update stats text
        const { progress, fieldKit } = this.getKitPresentationData();
        if (this.statsText && progress) {
            this.statsText.setText(
                `${fieldKit.recovered ? 'Katana Equipped  //  ' : ''}` +
                `${progress.collected} / ${progress.total} Ship Parts`
            );
        }
    }

    /**
     * Create a unified Project Beacon field-kit and ship-recovery display.
     */
    createShipPartsDisplay() {
        this.clearShipPartsElements();

        const { width, height, isMobile, margin } = this.dims;
        const compact = height < 680;

        if (!window.InventoryManager) {
            const noDataText = this.add.text(width / 2, 200, 'Ship parts data not available', {
                fontSize: '16px',
                color: '#888888'
            }).setOrigin(0.5);
            this.shipPartsElements.push(noDataText);
            return;
        }

        const { shipParts, progress, fieldKit } = this.getKitPresentationData();
        const katana = fieldKit.katana || {};
        const installedUpgrades = Array.isArray(katana.installedUpgrades)
            ? katana.installedUpgrades
            : [];
        let currentY = 106;

        const kitHeight = fieldKit.recovered ? (compact ? 102 : 116) : 82;
        const kitBg = this.add.graphics();
        kitBg.fillStyle(fieldKit.recovered ? 0x102B31 : 0x16182B, 0.98);
        kitBg.fillRoundedRect(margin, currentY, width - margin * 2, kitHeight, 8);
        kitBg.lineStyle(2, fieldKit.recovered ? 0x6FE7DD : 0x565B72, 0.9);
        kitBg.strokeRoundedRect(margin, currentY, width - margin * 2, kitHeight, 8);
        this.shipPartsElements.push(kitBg);

        const kitTitle = this.add.text(
            margin + 18,
            currentY + 14,
            fieldKit.recovered
                ? 'FIELD KIT // KATANA EQUIPPED'
                : 'FIELD KIT // NOT RECOVERED',
            {
                fontSize: isMobile ? '13px' : '15px',
                fontFamily: 'Arial',
                color: fieldKit.recovered ? '#6FE7DD' : '#9197AA',
                fontStyle: 'bold'
            }
        );
        this.shipPartsElements.push(kitTitle);

        const katanaName = fieldKit.recovered
            ? (katana.name || 'Earth-forged Field Katana')
            : 'Return to the Wanderer-7 crash site';
        const kitName = this.add.text(margin + 18, currentY + 39, katanaName, {
            fontSize: isMobile ? '14px' : '17px',
            fontFamily: 'Arial',
            color: fieldKit.recovered ? '#F2C14E' : '#C2C6D1',
            fontStyle: 'bold'
        });
        this.shipPartsElements.push(kitName);

        const upgradeSlots = Math.max(0, Number(katana.upgradeSlots) || 2);
        const kitStatus = this.add.text(
            margin + 18,
            currentY + (compact ? 62 : 68),
            fieldKit.recovered
                ? `Use RED MELEE or X during expeditions  //  Creature-tech ${installedUpgrades.length}/${upgradeSlots}`
                : 'Recover the case beside your crashed ship in the Sanctuary.',
            {
                fontSize: isMobile ? '11px' : '13px',
                fontFamily: 'Arial',
                color: fieldKit.recovered ? '#DCE8ED' : '#9197AA',
                wordWrap: { width: width - margin * 2 - 36 }
            }
        );
        this.shipPartsElements.push(kitStatus);

        if (fieldKit.recovered && !compact) {
            const upgradeNames = installedUpgrades.length > 0
                ? installedUpgrades.map(upgrade => upgrade.name || upgrade.id).join('  +  ')
                : 'Upgrade interfaces dormant';
            const upgradeText = this.add.text(
                margin + 18,
                currentY + 92,
                upgradeNames,
                {
                    fontSize: isMobile ? '10px' : '11px',
                    fontFamily: 'Arial',
                    color: installedUpgrades.length > 0 ? '#B8F1E8' : '#768690'
                }
            );
            this.shipPartsElements.push(upgradeText);
        }

        currentY += kitHeight + 12;

        const shipHeader = this.add.text(
            margin,
            currentY,
            `SHIP RECOVERY // ${progress.collected} OF ${progress.total}`,
            {
                fontSize: isMobile ? '12px' : '14px',
                fontFamily: 'Arial',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        this.shipPartsElements.push(shipHeader);
        currentY += 24;

        const columns = isMobile ? 2 : 3;
        const gap = isMobile ? 8 : 12;
        const cellWidth = (
            width - margin * 2 - gap * (columns - 1)
        ) / columns;
        const cellHeight = compact ? 56 : 68;

        shipParts.forEach((part, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = margin + column * (cellWidth + gap);
            const y = currentY + row * (cellHeight + gap);
            this.createShipPartSlot(x, y, cellWidth, cellHeight, part);
        });

        const rows = Math.ceil(shipParts.length / columns);
        const instructionY = currentY + rows * (cellHeight + gap) + 4;
        const instructionText = this.add.text(
            width / 2,
            instructionY,
            progress.isComplete
                ? 'All systems recovered. The Wanderer-7 can launch.'
                : 'Guardian rescues recover the remaining ship systems.',
            {
                fontSize: isMobile ? '11px' : '13px',
                fontFamily: 'Arial',
                color: progress.isComplete ? '#F2C14E' : '#AAB6C4',
                align: 'center',
                wordWrap: { width: width - margin * 2 }
            }
        ).setOrigin(0.5, 0);
        this.shipPartsElements.push(instructionText);
    }

    getKitPresentationData() {
        const liveShipParts = window.InventoryManager?.getShipParts?.() || [];
        if (!this.kitPreview) {
            return {
                shipParts: liveShipParts,
                progress: window.InventoryManager?.getShipPartsProgress?.() || {
                    collected: 0,
                    total: liveShipParts.length,
                    percentage: 0,
                    isComplete: false
                },
                fieldKit: window.GameState?.get('story.projectBeacon.fieldKit') || {}
            };
        }

        const collectedIds = new Set(this.kitPreview.shipPartIds || []);
        const shipParts = liveShipParts.map(part => ({
            ...part,
            collected: collectedIds.has(part.id)
        }));
        const collected = shipParts.filter(part => part.collected).length;
        const total = shipParts.length;

        return {
            shipParts,
            progress: {
                collected,
                total,
                percentage: total > 0 ? Math.round((collected / total) * 100) : 0,
                isComplete: total > 0 && collected >= total
            },
            fieldKit: this.kitPreview.fieldKit || {}
        };
    }

    /**
     * Create one ship-system status cell.
     */
    createShipPartSlot(x, y, width, height, part) {
        const { isMobile } = this.dims;

        const slotBg = this.add.graphics();
        slotBg.fillStyle(part.collected ? 0x28283C : 0x151522, 0.96);
        slotBg.fillRoundedRect(x, y, width, height, 6);
        slotBg.lineStyle(2, part.collected ? 0xF2C14E : 0x45485B, 0.9);
        slotBg.strokeRoundedRect(x, y, width, height, 6);
        this.shipPartsElements.push(slotBg);

        const icon = this.add.text(x + 12, y + 11, part.icon, {
            fontSize: isMobile ? '18px' : '22px'
        });
        icon.setAlpha(part.collected ? 1 : 0.35);
        this.shipPartsElements.push(icon);

        const label = this.add.text(x + 40, y + 9, part.label, {
            fontSize: isMobile ? '10px' : '12px',
            fontFamily: 'Arial',
            color: part.collected ? '#FFFFFF' : '#777B8B',
            fontStyle: 'bold',
            wordWrap: { width: width - 48 }
        });
        this.shipPartsElements.push(label);

        const status = this.add.text(
            x + 40,
            y + height - 18,
            part.collected ? 'RECOVERED' : part.source,
            {
                fontSize: isMobile ? '9px' : '10px',
                fontFamily: 'Arial',
                color: part.collected ? '#8FE3CF' : '#676B7A',
                wordWrap: { width: width - 48 }
            }
        );
        this.shipPartsElements.push(status);
    }

    /**
     * Clear ship parts tab elements
     */
    clearShipPartsElements() {
        this.shipPartsElements.forEach(el => {
            if (el && el.destroy) {
                if (el.removeAllListeners) el.removeAllListeners();
                el.destroy();
            }
        });
        this.shipPartsElements = [];
    }

    /**
     * Create sort and filter controls
     */
    createSortFilterControls() {
        const { width, isMobile, margin } = this.dims;

        const startX = margin + 10;
        const y = 110;
        const buttonWidth = isMobile ? 50 : 60;
        const buttonHeight = isMobile ? 18 : 20;
        const spacing = isMobile ? 3 : 5;

        // Sort label
        const sortLabel = this.add.text(startX, y, 'Sort:', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#00FFFF'
        });

        // Sort buttons
        const sortOptions = [
            { key: 'none', label: 'None' },
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type' },
            { key: 'price', label: 'Price' }
        ];

        sortOptions.forEach((option, index) => {
            const btnX = startX + 40 + index * (buttonWidth + spacing);
            const btn = this.createSmallButton(btnX, y, buttonWidth, buttonHeight, option.label, () => {
                this.setSortOrder(option.key);
            });
            this.sortButtons.push({ key: option.key, ...btn });
        });

        // Filter label (responsive positioning)
        const filterX = isMobile ? startX : (startX + 300);
        const filterLabel = this.add.text(filterX, y + (isMobile ? 25 : 0), 'Filter:', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#00FFFF'
        });

        // Filter buttons (responsive labels for mobile)
        const filterOptions = [
            { key: 'all', label: isMobile ? 'All' : 'All' },
            { key: 'food', label: isMobile ? 'Food' : 'Food' },
            { key: 'accessories', label: isMobile ? 'Acc.' : 'Accessories' },
            { key: 'consumables', label: isMobile ? 'Cons.' : 'Consumables' }
        ];

        filterOptions.forEach((option, index) => {
            const btnX = filterX + 50 + index * (buttonWidth + spacing);
            const btn = this.createSmallButton(btnX, y + (isMobile ? 25 : 0), buttonWidth, buttonHeight, option.label, () => {
                this.setFilter(option.key);
            });
            this.filterButtons.push({ key: option.key, ...btn });
        });

        // Update button states to show current selection
        this.updateSortFilterButtonStates();
    }

    /**
     * Create small button helper for sort/filter controls
     */
    createSmallButton(x, y, width, height, label, callback) {
        const button = this.add.graphics();
        button.fillStyle(0x2A0040, 0.8);
        button.fillRoundedRect(x, y, width, height, 5);
        button.lineStyle(1, 0x6B00B3);
        button.strokeRoundedRect(x, y, width, height, 5);

        const text = this.add.text(x + width / 2, y + height / 2, label, {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        });
        text.setOrigin(0.5, 0.5);

        const zone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', callback);

        zone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0x4A0080, 1);
            button.fillRoundedRect(x, y, width, height, 5);
            button.lineStyle(2, 0x8B00D9);
            button.strokeRoundedRect(x, y, width, height, 5);
        });

        zone.on('pointerout', () => {
            button.clear();
            button.fillStyle(0x2A0040, 0.8);
            button.fillRoundedRect(x, y, width, height, 5);
            button.lineStyle(1, 0x6B00B3);
            button.strokeRoundedRect(x, y, width, height, 5);
        });

        return { button, text, zone, x, y, width, height };
    }

    /**
     * Set sort order
     */
    setSortOrder(sortKey) {
        this.currentSort = sortKey;
        this.updateSortFilterButtonStates();
        this.refreshInventory();

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Set filter
     */
    setFilter(filterKey) {
        this.currentFilter = filterKey;
        this.updateSortFilterButtonStates();
        this.refreshInventory();

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Update sort/filter button visual states
     */
    updateSortFilterButtonStates() {
        // Update sort buttons
        this.sortButtons.forEach(btn => {
            const isActive = btn.key === this.currentSort;
            btn.button.clear();
            if (isActive) {
                btn.button.fillStyle(0x6B00B3, 1);
                btn.button.fillRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.button.lineStyle(2, 0xFFD700);
                btn.button.strokeRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.text.setColor('#FFD700');
            } else {
                btn.button.fillStyle(0x2A0040, 0.8);
                btn.button.fillRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.button.lineStyle(1, 0x6B00B3);
                btn.button.strokeRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.text.setColor('#FFFFFF');
            }
        });

        // Update filter buttons
        this.filterButtons.forEach(btn => {
            const isActive = btn.key === this.currentFilter;
            btn.button.clear();
            if (isActive) {
                btn.button.fillStyle(0x6B00B3, 1);
                btn.button.fillRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.button.lineStyle(2, 0xFFD700);
                btn.button.strokeRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.text.setColor('#FFD700');
            } else {
                btn.button.fillStyle(0x2A0040, 0.8);
                btn.button.fillRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.button.lineStyle(1, 0x6B00B3);
                btn.button.strokeRoundedRect(btn.x, btn.y, btn.width, btn.height, 5);
                btn.text.setColor('#FFFFFF');
            }
        });
    }

    /**
     * Create inventory grid (5 columns x 6 rows = 30 slots)
     */
    createInventoryGrid() {
        const { width, slotSize, slotMargin, gridCols, margin, gridStartX, isMobile } = this.dims;

        const spacing = slotMargin;
        const cols = gridCols;
        const rows = isMobile ? 6 : 6;  // 6 rows = 24 slots (mobile) or 30 slots (desktop)

        // Calculate start position (centered on mobile, left-aligned on desktop)
        let startX;
        if (gridStartX === null || isMobile) {
            // Center the grid
            const gridWidth = cols * slotSize + (cols - 1) * spacing;
            startX = (width - gridWidth) / 2;
        } else {
            startX = gridStartX;
        }

        const startY = 136;

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
     * Create action buttons - mobile responsive positioning
     */
    createActionButtons() {
        const { width, height, isMobile, margin } = this.dims;

        // Responsive positioning - center buttons on mobile, side panel on desktop
        const buttonWidth = isMobile ? 100 : 120;
        const buttonHeight = isMobile ? 44 : 40;
        const spacing = isMobile ? 10 : 15;

        // Position at bottom center on mobile, or side panel on desktop
        const totalWidth = buttonWidth * 2 + spacing;
        const x = isMobile ? (width - totalWidth) / 2 : 510;
        const y = isMobile ? height - buttonHeight - margin - 60 : 520;

        // Use button
        this.useButton = this.createButton(x, y, buttonWidth, buttonHeight, 'USE', 0x00AA00, () => {
            this.useSelectedItem();
        });

        // Equip button (for equippable items)
        this.equipButton = this.createButton(x + buttonWidth + spacing, y, buttonWidth, buttonHeight, 'EQUIP', 0x0066AA, () => {
            this.equipSelectedItem();
        });
        this.setActionButtonVisible(this.useButton, false);
        this.setActionButtonVisible(this.equipButton, false);

        this.selectionHintText = this.add.text(
            width / 2,
            y - 24,
            'Select an item to see where it is used.',
            {
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'Arial',
                color: '#AAB6C4',
                align: 'center',
                wordWrap: { width: isMobile ? width - 36 : 430 }
            }
        ).setOrigin(0.5, 0.5).setDepth(101);
    }

    setActionButtonVisible(control, visible) {
        if (!control) {
            return;
        }

        control.visible = visible;
        control.button?.setVisible(visible);
        control.text?.setVisible(visible);
        control.zone?.setVisible(visible);
        control.zone?.setActive(visible);
    }

    /**
     * Create button helper - with proper depth for visibility
     */
    createButton(x, y, width, height, label, color, callback) {
        const button = this.add.graphics();
        button.fillStyle(color, 0.9);
        button.fillRoundedRect(x, y, width, height, 8);
        button.lineStyle(2, color + 0x003300);
        button.strokeRoundedRect(x, y, width, height, 8);
        button.setDepth(100); // Ensure visibility above grid items

        const text = this.add.text(x + width / 2, y + height / 2, label, {
            fontSize: this.dims.isMobile ? '14px' : '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        text.setOrigin(0.5, 0.5);
        text.setDepth(101);

        const zone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        zone.setDepth(102);
        zone.setInteractive({ useHandCursor: false }); // No cursor for mobile

        zone.on('pointerdown', () => {
            console.log('[InventoryScene] Button pressed:', label);
            callback();
        });

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
        const { width: screenWidth, height: screenHeight, margin, buttonHeight, closeButtonSize } = this.dims;

        const btnWidth = this.dims.isMobile ? 60 : 80;
        const btnHeight = buttonHeight;
        const x = screenWidth - btnWidth - margin;
        const y = screenHeight - btnHeight - margin;

        const button = this.add.graphics();
        button.fillStyle(0xAA0000, 0.9);
        button.fillRoundedRect(x, y, btnWidth, btnHeight, 8);
        button.lineStyle(2, 0xFF0000);
        button.strokeRoundedRect(x, y, btnWidth, btnHeight, 8);

        const label = this.add.text(x + btnWidth / 2, y + btnHeight / 2, 'EXIT', {
            fontSize: this.dims.isMobile ? '14px' : '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        label.setOrigin(0.5, 0.5);

        const zone = this.add.zone(x, y, btnWidth, btnHeight).setOrigin(0, 0);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => {
            this.exitInventory();
        });

        zone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0xDD0000, 1);
            button.fillRoundedRect(x, y, btnWidth, btnHeight, 8);
            button.lineStyle(3, 0xFF0000);
            button.strokeRoundedRect(x, y, btnWidth, btnHeight, 8);
        });

        zone.on('pointerout', () => {
            button.clear();
            button.fillStyle(0xAA0000, 0.9);
            button.fillRoundedRect(x, y, btnWidth, btnHeight, 8);
            button.lineStyle(2, 0xFF0000);
            button.strokeRoundedRect(x, y, btnWidth, btnHeight, 8);
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
        try {
            console.log('[InventoryScene] Refreshing inventory display');

            // Clear existing item sprites
            if (this.itemSprites && Array.isArray(this.itemSprites)) {
                this.itemSprites.forEach(sprite => {
                    if (sprite && sprite.destroy) {
                        sprite.destroy();
                    }
                });
                this.itemSprites = [];
            }
            this.selectedSlot = null;
            this.selectedDisplaySlot = null;
            this.updateSelectedItemActions(null);
            this.inventorySlots.forEach(slot => {
                slot.itemIcon = null;
                slot.itemQuantity = null;
                slot.inventoryIndex = null;
            });

            // Check if InventoryManager exists
            if (!window.InventoryManager) {
                console.error('[InventoryScene] InventoryManager not available in refreshInventory');
                return;
            }

            // Get all items from InventoryManager
            let items = window.InventoryManager.getAllItems() || [];
            console.log('[InventoryScene] Retrieved items:', items.length);

            // Apply filtering
            items = this.applyFilter(items);
            console.log('[InventoryScene] After filter:', items.length);

            // Apply sorting
            items = this.applySort(items);
            console.log('[InventoryScene] After sort:', items.length);

            // Update stats
            const stats = window.InventoryManager.getStats();
            if (this.statsText) {
                this.statsText.setText(`${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`);
            }

            // Check if inventory slots exist
            if (!this.inventorySlots || !Array.isArray(this.inventorySlots)) {
                console.error('[InventoryScene] Inventory slots not initialized');
                return;
            }

            // Display items in slots
            items.forEach((item, index) => {
                if (index >= this.inventorySlots.length) return;

                const slot = this.inventorySlots[index];
                if (!slot) {
                    console.warn('[InventoryScene] Slot not found at index:', index);
                    return;
                }
                slot.inventoryIndex = Number.isInteger(item.slot)
                    ? item.slot
                    : index;

                // Item icon
                if (slot.itemIcon) {
                    slot.itemIcon.destroy();
                }

                slot.itemIcon = this.add.text(
                    slot.x + slot.size / 2,
                    slot.y + slot.size / 2 - 5,
                    item.icon || '?',
                    { fontSize: `${Math.max(22, Math.min(32, slot.size * 0.48))}px` }
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

            console.log('[InventoryScene] ✅ Inventory refreshed successfully');
        } catch (error) {
            console.error('[InventoryScene] Error in refreshInventory:', error);
            console.error('[InventoryScene] Error stack:', error.stack);
        }
    }

    /**
     * Apply filter to items
     */
    applyFilter(items) {
        if (this.currentFilter === 'all') {
            return items;
        }

        return items.filter(item => {
            const itemType = (item.type || item.category || '').toLowerCase();

            switch (this.currentFilter) {
                case 'food':
                    return itemType === 'food' || itemType === 'consumable' || item.effect;
                case 'accessories':
                    return itemType === 'accessory' || itemType === 'accessories' || item.equippable;
                case 'consumables':
                    return itemType === 'consumable' || itemType === 'potion' || item.effect;
                default:
                    return true;
            }
        });
    }

    /**
     * Apply sort to items
     */
    applySort(items) {
        if (this.currentSort === 'none') {
            return items;
        }

        const sortedItems = [...items]; // Create copy to avoid mutating original

        switch (this.currentSort) {
            case 'name':
                sortedItems.sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                break;

            case 'type':
                sortedItems.sort((a, b) => {
                    const typeA = (a.type || a.category || '').toLowerCase();
                    const typeB = (b.type || b.category || '').toLowerCase();
                    return typeA.localeCompare(typeB);
                });
                break;

            case 'price':
                sortedItems.sort((a, b) => {
                    const priceA = a.price || 0;
                    const priceB = b.price || 0;
                    return priceB - priceA; // Descending order (highest price first)
                });
                break;

            default:
                break;
        }

        return sortedItems;
    }

    /**
     * Select inventory slot
     */
    selectSlot(displaySlotIndex) {
        console.log(`[InventoryScene] Selected display slot: ${displaySlotIndex}`);

        // Clear previous selection
        if (this.selectedDisplaySlot !== null) {
            const prevSlot = this.inventorySlots[this.selectedDisplaySlot];
            prevSlot.graphics.clear();
            prevSlot.graphics.fillStyle(0x2A0040, 0.6);
            prevSlot.graphics.fillRoundedRect(prevSlot.x, prevSlot.y, prevSlot.size, prevSlot.size, 8);
            prevSlot.graphics.lineStyle(2, 0x6B00B3);
            prevSlot.graphics.strokeRoundedRect(prevSlot.x, prevSlot.y, prevSlot.size, prevSlot.size, 8);
        }

        // Highlight selected slot
        const slot = this.inventorySlots[displaySlotIndex];
        const inventoryIndex = slot?.inventoryIndex;
        if (!Number.isInteger(inventoryIndex)) {
            this.selectedSlot = null;
            this.selectedDisplaySlot = null;
            this.updateSelectedItemActions(null);
            this.updateItemDetails(null);
            return;
        }

        this.selectedSlot = inventoryIndex;
        this.selectedDisplaySlot = displaySlotIndex;
        slot.graphics.clear();
        slot.graphics.fillStyle(0x6B00B3, 1);
        slot.graphics.fillRoundedRect(slot.x, slot.y, slot.size, slot.size, 8);
        slot.graphics.lineStyle(3, 0xFFD700);
        slot.graphics.strokeRoundedRect(slot.x, slot.y, slot.size, slot.size, 8);

        // Update item details
        const item = window.InventoryManager?.getItem(inventoryIndex);
        this.updateItemDetails(inventoryIndex);
        this.updateSelectedItemActions(item);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    updateSelectedItemActions(item) {
        const hasItem = Boolean(item);
        this.setActionButtonVisible(this.useButton, hasItem);
        this.setActionButtonVisible(this.equipButton, item?.equippable === true);

        if (this.selectionHintText) {
            this.selectionHintText.setText(
                hasItem
                    ? `${item.name} // ${item.usageHint || this.getDefaultUsageHint(item)}`
                    : 'Select an item to see where it is used.'
            );
            this.selectionHintText.setColor(hasItem ? '#8FE3CF' : '#AAB6C4');
        }
    }

    getDefaultUsageHint(item) {
        if (item?.type === 'powerup') {
            return 'Use from the expedition pause menu';
        }
        if (item?.type === 'egg') {
            return 'Use here to begin hatching';
        }
        return 'Use from this inventory';
    }

    clearItemSelection() {
        this.selectedSlot = null;
        this.selectedDisplaySlot = null;
        this.updateItemDetails(null);
        this.updateSelectedItemActions(null);
    }

    /**
     * Update item details panel
     */
    updateItemDetails(slotIndex) {
        // Mobile doesn't have detail panel - skip update
        if (this.dims.isMobile || !this.detailName) {
            return;
        }

        const item = window.InventoryManager?.getItem(slotIndex);

        if (!item) {
            // Empty slot - defensive checks for all properties
            this.detailName.setText('Empty Slot');
            if (this.detailIcon) this.detailIcon.setText('');
            if (this.detailType) this.detailType.setText('');
            if (this.detailDescription) this.detailDescription.setText('');
            if (this.detailEffects) this.detailEffects.setText('');
            if (this.detailQuantity) this.detailQuantity.setText('');
            this.updateSelectedItemActions(null);
            return;
        }

        // Update details - defensive checks for all properties
        this.detailName.setText(item.name);
        if (this.detailIcon) this.detailIcon.setText(item.icon);
        if (this.detailType) this.detailType.setText(`Type: ${item.type.toUpperCase()}`);
        if (this.detailDescription) {
            const usage = item.usageHint || this.getDefaultUsageHint(item);
            this.detailDescription.setText(
                `${item.description || 'No description available'}\n\nUSE // ${usage}`
            );
        }

        // Show effects if food
        if (item.effect && this.detailEffects) {
            const effects = [];
            if (item.effect.happiness) effects.push(`+${item.effect.happiness} Happiness`);
            if (item.effect.hunger) effects.push(`+${item.effect.hunger} Hunger`);
            if (item.effect.health) effects.push(`+${item.effect.health} Health`);
            this.detailEffects.setText('Effects:\n' + effects.join('\n'));
        } else if (this.detailEffects) {
            this.detailEffects.setText('');
        }

        // Show quantity
        if (this.detailQuantity) {
            if (item.quantity > 1) {
                this.detailQuantity.setText(`Quantity: ${item.quantity}`);
            } else {
                this.detailQuantity.setText('');
            }
        }

        // Show/hide equip button
        this.updateSelectedItemActions(item);
    }

    /**
     * Show confirmation dialog for using expensive items
     */
    showUseConfirmation(item) {
        console.log(`[InventoryScene] Showing use confirmation for: ${item.name}`);

        // Get responsive dimensions
        const { width, height, isMobile } = this.dims;

        // Create dark overlay (full screen)
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Create confirmation panel (responsive sizing and positioning)
        const panelWidth = isMobile ? width * 0.9 : 400;
        const panelHeight = isMobile ? 320 : 300;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, panelY + 50, 'Use Expensive Item?', {
            fontSize: isMobile ? '20px' : '26px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Item details
        const details = this.add.text(width / 2, panelY + 110,
            `${item.name}\n\nValue: ${item.price} Cosmic Coins\n\nThis item is valuable!\nAre you sure you want to use it?`, {
            fontSize: isMobile ? '14px' : '18px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(202);

        // Button dimensions
        const btnWidth = isMobile ? 100 : 140;
        const btnHeight = isMobile ? 40 : 50;
        const btnSpacing = isMobile ? 10 : 15;
        const btnY = panelY + panelHeight - btnHeight - 20;

        // Confirm button
        const confirmBtnX = width / 2 - btnWidth - btnSpacing / 2;
        const confirmBtn = this.add.graphics();
        confirmBtn.fillStyle(0x00AA00, 1);
        confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
        confirmBtn.lineStyle(2, 0x00FF00);
        confirmBtn.strokeRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 10);
        confirmBtn.setDepth(202);

        const confirmLabel = this.add.text(confirmBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Use It', {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const confirmZone = this.add.zone(confirmBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        confirmZone.setInteractive({ useHandCursor: true });
        confirmZone.setDepth(202);

        // Cancel button
        const cancelBtnX = width / 2 + btnSpacing / 2;
        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0xAA0000, 1);
        cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.lineStyle(2, 0xFF0000);
        cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.setDepth(202);

        const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Cancel', {
            fontSize: isMobile ? '16px' : '20px',
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

            // Proceed with using the item
            this.confirmUseItem();
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
     * Confirm and use item (called after confirmation)
     */
    confirmUseItem() {
        if (this.selectedSlot === null || !window.InventoryManager) {
            return;
        }

        const item = window.InventoryManager.getItem(this.selectedSlot);
        if (!item) return;

        console.log(`[InventoryScene] Using item (confirmed): ${item.name}`);

        const success = window.InventoryManager.useItem(this.selectedSlot);
        const useResult = window.InventoryManager.getLastUseResult?.();

        if (success) {
            this.showMessage(useResult?.message || `Used ${item.name}!`, 0x00FF00);

            if (window.AudioManager) {
                window.AudioManager.playCoinCollect();
            }

            // Refresh display
            this.time.delayedCall(500, () => {
                this.refreshInventory();
                this.clearItemSelection();
            });
        } else {
            this.showMessage(useResult?.message || 'Cannot use item!', 0xFF0000);
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

        // Check if item is an egg - show special egg confirmation
        if (item.type === 'egg') {
            this.showEggConfirmation(item);
            return;
        }

        if (item.type === 'powerup') {
            this.showMessage('Use during an expedition from the pause menu.', 0xFFB347);
            return;
        }

        // Check if item is expensive (>= 100 coins) and show confirmation
        const EXPENSIVE_THRESHOLD = 100;
        if (item.price && item.price >= EXPENSIVE_THRESHOLD) {
            this.showUseConfirmation(item);
            return;
        }

        console.log(`[InventoryScene] Using item: ${item.name}`);

        if (window.InventoryManager) {
            const success = window.InventoryManager.useItem(this.selectedSlot);
            const useResult = window.InventoryManager.getLastUseResult?.();

            if (success) {
                this.showMessage(useResult?.message || `Used ${item.name}!`, 0x00FF00);

                if (window.AudioManager) {
                    window.AudioManager.playCoinCollect();
                }

                // Refresh display
                this.time.delayedCall(500, () => {
                    this.refreshInventory();
                    this.clearItemSelection();
                });
            } else {
                this.showMessage(useResult?.message || 'Cannot use item!', 0xFF0000);
            }
        }
    }

    /**
     * Show egg hatching confirmation with rarity odds
     */
    showEggConfirmation(item) {
        console.log(`[InventoryScene] Showing egg confirmation for: ${item.name}`);

        const { width, height, isMobile } = this.dims;

        // Check collection capacity before allowing hatch
        const collectionStatus = window.GameState?.getCollectionStatus?.() || { hasSpace: true, count: 0, max: 8 };
        if (!collectionStatus.hasSpace) {
            this.showCollectionFullError(item, collectionStatus);
            return;
        }

        const creatureName = window.GameState?.get('creature.name') || 'your creature';
        const isStellar = item.eggType === 'stellar';

        // Create dark overlay - MOBILE FIX: Disable input on overlay so touches pass through to buttons
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);
        // Prevent overlay from intercepting touch events meant for buttons
        overlay.disableInteractive();

        // Create confirmation panel
        const panelWidth = isMobile ? width * 0.95 : 450;
        const panelHeight = isMobile ? 420 : 400;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        // Stellar egg gets golden border
        const borderColor = isStellar ? 0xFFD700 : 0x7B68EE;
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(4, borderColor);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title with egg icon
        const titleText = isStellar ? '🌟 Hatch Stellar Egg? 🌟' : '🥚 Hatch Cosmic Egg? 🥚';
        const title = this.add.text(width / 2, panelY + 40, titleText, {
            fontSize: isMobile ? '20px' : '24px',
            color: isStellar ? '#FFD700' : '#00FFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Warning message
        const warning = this.add.text(width / 2, panelY + 85, `⚠️ ${creatureName} will be gone forever!`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FF6B6B',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Rarity odds
        const oddsTitle = this.add.text(width / 2, panelY + 130, 'Rarity Chances:', {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const oddsText = item.rarityOdds || (isStellar
            ? '50% Uncommon, 30% Rare, 15% Epic, 5% Legendary'
            : '50% Common, 25% Uncommon, 15% Rare, 8% Epic, 2% Legendary');

        const odds = this.add.text(width / 2, panelY + 170, oddsText, {
            fontSize: isMobile ? '12px' : '14px',
            color: isStellar ? '#FFD700' : '#00CED1',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(202);

        // Info text
        const infoText = isStellar
            ? '✨ Premium egg - No common creatures!'
            : 'A new creature will take their place.';
        const info = this.add.text(width / 2, panelY + 220, infoText, {
            fontSize: isMobile ? '13px' : '15px',
            color: '#CCCCCC',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(202);

        // Final confirmation text
        const confirm = this.add.text(width / 2, panelY + 260, 'This cannot be undone.', {
            fontSize: isMobile ? '12px' : '14px',
            color: '#FF9999',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(202);

        // Buttons
        const btnWidth = isMobile ? 110 : 140;
        const btnHeight = isMobile ? 45 : 50;
        const btnSpacing = 15;
        const btnY = panelY + panelHeight - btnHeight - 25;

        // Hatch button (green)
        const hatchBtnX = width / 2 - btnWidth - btnSpacing / 2;
        const hatchBtn = this.add.graphics();
        hatchBtn.fillStyle(0x00AA00, 1);
        hatchBtn.fillRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
        hatchBtn.lineStyle(3, 0x00FF00);
        hatchBtn.strokeRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
        hatchBtn.setDepth(202);

        const hatchLabel = this.add.text(hatchBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Hatch It!', {
            fontSize: isMobile ? '16px' : '18px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // MOBILE FIX: Set zone depth higher than everything else and use proper touch handling
        const hatchZone = this.add.zone(hatchBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        hatchZone.setInteractive({ useHandCursor: true, draggable: false });
        hatchZone.setDepth(210); // Higher depth to ensure it receives touch events above overlay

        // Cancel button (red)
        const cancelBtnX = width / 2 + btnSpacing / 2;
        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0xAA0000, 1);
        cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.lineStyle(3, 0xFF0000);
        cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.setDepth(202);

        const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Keep Pet', {
            fontSize: isMobile ? '16px' : '18px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // MOBILE FIX: Set zone depth higher than everything else
        const cancelZone = this.add.zone(cancelBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        cancelZone.setInteractive({ useHandCursor: true, draggable: false });
        cancelZone.setDepth(210); // Higher depth to ensure it receives touch events above overlay

        // Store elements for cleanup
        const dialogElements = [overlay, panel, title, warning, oddsTitle, odds, info, confirm,
            hatchBtn, hatchLabel, hatchZone, cancelBtn, cancelLabel, cancelZone];

        // MOBILE FIX: Track if hatch action was triggered to prevent double-firing
        let hatchTriggered = false;

        // Hatch handler - using function to share between pointerdown and pointerup
        const handleHatch = () => {
            if (hatchTriggered) return; // Prevent double-trigger
            hatchTriggered = true;
            try {
                console.log('[InventoryScene] ========================================');
                console.log('[InventoryScene] Hatch It! button clicked');
                console.log('[InventoryScene] Egg type:', item.eggType);
                console.log('[InventoryScene] Selected slot:', this.selectedSlot);

                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                // Store egg type BEFORE cleaning up
                const eggTypeToHatch = item.eggType || 'cosmic';
                console.log('[InventoryScene] Stored egg type:', eggTypeToHatch);

                // Clean up dialog
                console.log('[InventoryScene] Cleaning up dialog elements...');
                dialogElements.forEach(el => {
                    if (el && el.destroy) el.destroy();
                });
                console.log('[InventoryScene] Dialog elements cleaned up');

                // Remove item from inventory
                if (window.InventoryManager) {
                    const removed = window.InventoryManager.removeItem(this.selectedSlot, 1);
                    console.log('[InventoryScene] Item removed from inventory:', removed);
                }

                // Show farewell animation then transition to hatching
                console.log('[InventoryScene] Calling showFarewellAnimation with eggType:', eggTypeToHatch);
                this.showFarewellAnimation(eggTypeToHatch);
                console.log('[InventoryScene] showFarewellAnimation called successfully');
            } catch (err) {
                console.error('[InventoryScene] ERROR in Hatch It! handler:', err);
                console.error('[InventoryScene] Error stack:', err.stack);

                // Emergency fallback - try to transition directly
                console.log('[InventoryScene] Attempting emergency fallback transition...');
                try {
                    window.GameState?.set('creature.hatched', false);
                    window.GameState?.set('creature.named', false);
                    window.GameState?.save();

                    if (this.game?.scene) {
                        this.game.scene.stop('GameScene');
                    }
                    this.scene.start('HatchingScene', {
                        isEggHatch: true,
                        eggType: item.eggType || 'cosmic',
                        spawnPosition: { x: 400, y: 300 }
                    });
                } catch (fallbackErr) {
                    console.error('[InventoryScene] Fallback also failed:', fallbackErr);
                }
            }
        };

        // Bind handleHatch to both pointerdown and pointerup for better mobile compatibility
        hatchZone.on('pointerdown', handleHatch);
        hatchZone.on('pointerup', handleHatch);

        // Hover effects for hatch button
        hatchZone.on('pointerover', () => {
            hatchBtn.clear();
            hatchBtn.fillStyle(0x00DD00, 1);
            hatchBtn.fillRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
            hatchBtn.lineStyle(4, 0x00FF00);
            hatchBtn.strokeRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
        });

        hatchZone.on('pointerout', () => {
            hatchBtn.clear();
            hatchBtn.fillStyle(0x00AA00, 1);
            hatchBtn.fillRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
            hatchBtn.lineStyle(3, 0x00FF00);
            hatchBtn.strokeRoundedRect(hatchBtnX, btnY, btnWidth, btnHeight, 10);
        });

        // MOBILE FIX: Track if cancel was triggered to prevent double-firing
        let cancelTriggered = false;

        // Cancel handler
        const handleCancel = () => {
            if (cancelTriggered) return;
            cancelTriggered = true;
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
            dialogElements.forEach(el => el.destroy());
        };

        // Bind handleCancel to both pointerdown and pointerup for better mobile compatibility
        cancelZone.on('pointerdown', handleCancel);
        cancelZone.on('pointerup', handleCancel);

        // Hover effects for cancel button
        cancelZone.on('pointerover', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0xDD0000, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(4, 0xFF0000);
            cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        });

        cancelZone.on('pointerout', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0xAA0000, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(3, 0xFF0000);
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
     * Show collection full error when trying to hatch with 8/8 creatures
     */
    showCollectionFullError(item, collectionStatus) {
        console.log('[InventoryScene] Collection full - cannot hatch egg');

        const { width, height, isMobile } = this.dims;

        // Create dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);
        overlay.disableInteractive();

        // Create error panel
        const panelWidth = isMobile ? width * 0.95 : 450;
        const panelHeight = isMobile ? 380 : 350;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(4, 0xFF6666);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, panelY + 40, '⚠️ Collection Full!', {
            fontSize: isMobile ? '22px' : '26px',
            color: '#FF6666',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Status message
        const statusText = this.add.text(width / 2, panelY + 90,
            `Your creature collection is full!\n${collectionStatus.count}/${collectionStatus.max} creatures`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Explanation
        const explanation = this.add.text(width / 2, panelY + 150,
            'To hatch a new creature, you need to\nrelease one of your current creatures first.', {
            fontSize: isMobile ? '12px' : '14px',
            color: '#AAAAAA',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Tip about where to release
        const tip = this.add.text(width / 2, panelY + 210,
            '💡 Go to Creature Profile and tap\n"Release Creature" to make room.', {
            fontSize: isMobile ? '12px' : '14px',
            color: '#88CCFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // OK button
        const btnWidth = 120;
        const btnHeight = 40;
        const btnX = width / 2 - btnWidth / 2;
        const btnY = panelY + panelHeight - 70;

        const okBtn = this.add.graphics();
        okBtn.fillStyle(0x4B0082, 1);
        okBtn.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        okBtn.lineStyle(3, 0x7B68EE);
        okBtn.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        okBtn.setDepth(202);

        const okLabel = this.add.text(width / 2, btnY + btnHeight / 2, 'OK', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203);

        const okZone = this.add.zone(btnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        okZone.setInteractive({ useHandCursor: true });
        okZone.setDepth(210);

        const dialogElements = [overlay, panel, title, statusText, explanation, tip, okBtn, okLabel, okZone];

        okZone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
            dialogElements.forEach(el => el.destroy());
        });

        okZone.on('pointerover', () => {
            okBtn.clear();
            okBtn.fillStyle(0x6B00B3, 1);
            okBtn.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
            okBtn.lineStyle(4, 0x9B68EE);
            okBtn.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        });

        okZone.on('pointerout', () => {
            okBtn.clear();
            okBtn.fillStyle(0x4B0082, 1);
            okBtn.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
            okBtn.lineStyle(3, 0x7B68EE);
            okBtn.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        });

        // ESC to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                dialogElements.forEach(el => el.destroy());
                this.input.keyboard.off('keydown', escHandler);
            }
        };
        this.input.keyboard.on('keydown', escHandler);

        // Play error sound
        if (window.AudioManager) {
            window.AudioManager.playError();
        }
    }

    /**
     * Show farewell animation for current creature before hatching new one
     */
    showFarewellAnimation(eggType) {
        console.log('[InventoryScene] ========================================');
        console.log('[InventoryScene] showFarewellAnimation() called');
        console.log('[InventoryScene] Egg type:', eggType);

        // Defensive check for dims
        if (!this.dims) {
            console.error('[InventoryScene] ERROR: this.dims is undefined!');
            this.dims = {
                width: this.cameras?.main?.width || 800,
                height: this.cameras?.main?.height || 600,
                isMobile: false
            };
        }

        const { width, height } = this.dims;
        console.log('[InventoryScene] Screen dimensions:', width, 'x', height);

        const creatureName = window.GameState?.get('creature.name') || 'Your creature';
        console.log('[InventoryScene] Creature name:', creatureName);

        // Prevent accidental closure during animation
        this.farewellInProgress = true;
        console.log('[InventoryScene] Set farewellInProgress = true');

        try {

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(300);

        // Get creature texture - use stored texture name or regenerate
        // Note: genetics stored in both creature.genes and creature.genetics paths
        const creatureGenes = window.GameState?.get('creature.genes') || window.GameState?.get('creature.genetics');
        const storedTextureName = window.GameState?.get('creature.textureName');
        let creatureSprite = null;

        console.log('[InventoryScene] Creature genes:', creatureGenes ? 'present' : 'null');
        console.log('[InventoryScene] Stored texture name:', storedTextureName);

        if (creatureGenes) {
            let textureName = storedTextureName;

            // If stored texture exists, use it
            if (textureName && this.textures.exists(textureName)) {
                console.log('[InventoryScene] Using stored texture:', textureName);
                creatureSprite = this.add.sprite(width / 2, height / 2 - 30, textureName);
            }
            // Otherwise, regenerate using GraphicsEngine
            else {
                console.log('[InventoryScene] Regenerating creature texture with GraphicsEngine');
                try {
                    // Create temporary GraphicsEngine for this scene
                    const GraphicsEngine = window.GraphicsEngine;
                    if (GraphicsEngine) {
                        const tempEngine = new GraphicsEngine(this);
                        const result = tempEngine.createRandomizedSpaceMythicCreature(creatureGenes, 0);
                        textureName = result.textureName;
                        console.log('[InventoryScene] Regenerated texture:', textureName);

                        if (textureName && this.textures.exists(textureName)) {
                            creatureSprite = this.add.sprite(width / 2, height / 2 - 30, textureName);
                        }
                    }
                } catch (err) {
                    console.error('[InventoryScene] Failed to regenerate creature:', err);
                }
            }

            if (creatureSprite) {
                creatureSprite.setScale(1.5);
                creatureSprite.setDepth(301);
                console.log('[InventoryScene] Creature sprite created successfully');
            } else {
                console.warn('[InventoryScene] Could not create creature sprite - showing farewell without visual');
            }
        }

        // Farewell text
        const farewellText = this.add.text(width / 2, height / 2 + 80, `Farewell, ${creatureName}...`, {
            fontSize: '28px',
            color: '#FFFFFF',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(301);
        farewellText.setAlpha(0);

        // Sparkle particles around creature
        const sparkles = [];
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const radius = 80;
            const sparkle = this.add.graphics();
            sparkle.fillStyle(0xFFFFFF, 0.8);
            sparkle.fillCircle(0, 0, 3);
            sparkle.setPosition(
                width / 2 + Math.cos(angle) * radius,
                height / 2 - 30 + Math.sin(angle) * radius
            );
            sparkle.setDepth(302);
            sparkle.setAlpha(0);
            sparkles.push(sparkle);
        }

        // Play melancholy sound
        if (window.AudioManager) {
            window.AudioManager.playPet(); // Soft, gentle sound
        }

        // Animation sequence
        // 1. Fade in text and sparkles
        this.tweens.add({
            targets: farewellText,
            alpha: 1,
            duration: 800,
            ease: 'Power2'
        });

        sparkles.forEach((sparkle, i) => {
            this.tweens.add({
                targets: sparkle,
                alpha: 1,
                delay: i * 50,
                duration: 300
            });
        });

        // 2. After 1.5s, fade out creature with sparkles floating up
        this.time.delayedCall(1500, () => {
            if (creatureSprite) {
                this.tweens.add({
                    targets: creatureSprite,
                    alpha: 0,
                    scale: 0.5,
                    y: creatureSprite.y - 50,
                    duration: 1000,
                    ease: 'Power2'
                });
            }

            sparkles.forEach((sparkle, i) => {
                this.tweens.add({
                    targets: sparkle,
                    y: sparkle.y - 150,
                    alpha: 0,
                    delay: i * 30,
                    duration: 800,
                    ease: 'Power2'
                });
            });

            this.tweens.add({
                targets: farewellText,
                alpha: 0,
                delay: 500,
                duration: 500
            });
        });

        // 3. After 3s total, transition to hatching scene
        this.time.delayedCall(3000, () => {
            try {
                // Store old creature position for new creature spawn
                const savedPos = window.GameState?.get('world.currentPosition');
                const oldPosition = {
                    x: savedPos?.x || 400,
                    y: savedPos?.y || 300
                };

                // Reset creature state COMPLETELY for new hatching
                window.GameState?.set('creature.hatched', false);
                window.GameState?.set('creature.named', false);
                window.GameState?.set('creature.genes', null);
                window.GameState?.set('creature.name', null);
                window.GameState?.set('creature.textureName', null);
                // Additional state that must be reset for clean hatching
                window.GameState?.set('creature.dna', null);
                window.GameState?.set('creature.personality', null);
                window.GameState?.set('creature.personalityState', null);
                window.GameState?.set('creature.stats', {
                    happiness: 100,
                    energy: 100,
                    health: 100
                });
                window.GameState?.set('creature.level', 1);
                window.GameState?.set('creature.experience', 0);
                // CRITICAL: Reset breeding/lineage fields to prevent old data persisting
                window.GameState?.set('creature.isOffspring', false);
                window.GameState?.set('creature.generation', null);
                window.GameState?.set('creature.parentIds', null);
                window.GameState?.set('creature.offspringBonus', null);
                window.GameState?.set('creature.hasAncientLineage', false);
                window.GameState?.set('creature.ancientProphecy', null);

                // Store spawn position for new creature
                window.GameState?.set('creature.spawnPosition', oldPosition);

                // Reset pity system for fresh start
                const freshPity = window.raritySystem?.initializePitySystem();
                if (freshPity) {
                    window.GameState?.set('pitySystem', freshPity);
                }

                // Save state before transition
                window.GameState?.save();

                // Prepare data for HatchingScene
                const hatchData = {
                    isEggHatch: true,
                    eggType: eggType,
                    spawnPosition: oldPosition
                };

                // Store references before stopping scenes
                const game = this.game;
                const sceneManager = game.scene;

                // Stop current scenes and transition to HatchingScene
                if (sceneManager.isActive('GameScene')) {
                    sceneManager.stop('GameScene');
                }
                sceneManager.stop('InventoryScene');

                // Use setTimeout to ensure scenes are fully stopped before starting new one
                // Track timeout ID for cleanup (prevents memory leaks)
                const timeoutId = setTimeout(() => {
                    sceneManager.start('HatchingScene', hatchData);
                }, 100);
                this.pendingTimeouts.push(timeoutId);

            } catch (err) {
                console.error('[InventoryScene] Error during scene transition:', err);
                console.error('[InventoryScene] Error stack:', err.stack);

                // Fallback: try direct scene start with proper cleanup
                try {
                    const sceneManager = this.game?.scene;
                    if (sceneManager) {
                        sceneManager.stop('GameScene');
                        sceneManager.stop('InventoryScene');

                        // Track timeout ID for cleanup (prevents memory leaks)
                        const fallbackTimeoutId = setTimeout(() => {
                            sceneManager.start('HatchingScene', {
                                isEggHatch: true,
                                eggType: eggType,
                                spawnPosition: { x: 400, y: 300 }
                            });
                        }, 100);
                        this.pendingTimeouts.push(fallbackTimeoutId);
                    }
                } catch (fallbackErr) {
                    console.error('[InventoryScene] Fallback transition also failed:', fallbackErr);
                }
            }
        });

        } catch (err) {
            console.error('[InventoryScene] Error in showFarewellAnimation:', err);

            // Emergency fallback - skip animation and go directly to HatchingScene
            try {
                // Complete state reset
                window.GameState?.set('creature.hatched', false);
                window.GameState?.set('creature.named', false);
                window.GameState?.set('creature.genes', null);
                window.GameState?.set('creature.name', null);
                window.GameState?.set('creature.textureName', null);
                window.GameState?.set('creature.dna', null);
                window.GameState?.set('creature.personality', null);
                window.GameState?.set('creature.personalityState', null);
                window.GameState?.set('creature.stats', {
                    happiness: 100,
                    energy: 100,
                    health: 100
                });
                window.GameState?.save();

                const sceneManager = this.game?.scene;
                if (sceneManager) {
                    sceneManager.stop('GameScene');
                    sceneManager.stop('InventoryScene');

                    // Track timeout ID for cleanup (prevents memory leaks)
                    const emergencyTimeoutId = setTimeout(() => {
                        sceneManager.start('HatchingScene', {
                            isEggHatch: true,
                            eggType: eggType || 'cosmic',
                            spawnPosition: { x: 400, y: 300 }
                        });
                    }, 100);
                    this.pendingTimeouts.push(emergencyTimeoutId);
                }
            } catch (fallbackErr) {
                console.error('[InventoryScene] Emergency fallback also failed:', fallbackErr);
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
                    window.AudioManager.playCoinCollect();
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
        const { width, height, isMobile } = this.dims;

        const msgText = this.add.text(width / 2, height - 50, message, {
            fontSize: isMobile ? '16px' : '18px',
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
        // Prevent closing during farewell animation
        if (this.farewellInProgress) {
            console.log('[InventoryScene] Cannot close - farewell animation in progress');
            return;
        }

        console.log('[InventoryScene] Closing inventory');

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Stop this scene and resume GameScene
        SceneTransitionHelper.stopScene(this);
        SceneTransitionHelper.resumeScene(this, 'GameScene');
    }

    /**
     * Cleanup
     */
    shutdown() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;
        console.log('[InventoryScene] Shutting down - cleaning up event listeners');

        // Remove global event listeners
        if (window.InventoryManager) {
            window.InventoryManager.off('itemAdded', this.refreshInventory, this);
            window.InventoryManager.off('itemRemoved', this.refreshInventory, this);
            window.InventoryManager.off('itemQuantityChanged', this.refreshInventory, this);
        }

        // Remove keyboard listeners
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-I');
            this.input.keyboard.off('keydown-ESC');
        }

        // Remove listeners from inventory slot zones
        if (this.inventorySlots && Array.isArray(this.inventorySlots)) {
            this.inventorySlots.forEach(slot => {
                if (slot && slot.zone && slot.zone.removeAllListeners) {
                    slot.zone.removeAllListeners();
                }
            });
        }

        // Remove listeners from tab buttons
        if (this.tabButtons && Array.isArray(this.tabButtons)) {
            this.tabButtons.forEach(btn => {
                if (btn && btn.zone && btn.zone.removeAllListeners) {
                    btn.zone.removeAllListeners();
                }
            });
        }

        // Remove listeners from sort/filter buttons
        if (this.sortButtons && Array.isArray(this.sortButtons)) {
            this.sortButtons.forEach(btn => {
                if (btn && btn.zone && btn.zone.removeAllListeners) {
                    btn.zone.removeAllListeners();
                }
            });
        }

        if (this.filterButtons && Array.isArray(this.filterButtons)) {
            this.filterButtons.forEach(btn => {
                if (btn && btn.zone && btn.zone.removeAllListeners) {
                    btn.zone.removeAllListeners();
                }
            });
        }

        // Clear collection elements
        this.clearCollectionElements();

        // Clear ship parts elements
        this.clearShipPartsElements();

        // Remove listeners from close button zone
        if (this.closeButtonZone && this.closeButtonZone.removeAllListeners) {
            this.closeButtonZone.removeAllListeners();
        }

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Clear pending setTimeout calls (prevents memory leaks from delayed transitions)
        if (this.pendingTimeouts && Array.isArray(this.pendingTimeouts)) {
            this.pendingTimeouts.forEach(timeoutId => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            });
            this.pendingTimeouts = [];
            console.log('[InventoryScene] Pending timeouts cleared');
        }

        // Clear references
        this.graphicsEngine = null;
        this.inventorySlots = [];
        this.itemSprites = [];
        this.selectedSlot = null;
        this.sortButtons = [];
        this.filterButtons = [];
        this.closeButtonZone = null;

        console.log('[InventoryScene] Cleanup complete');
    }
}

// Register scene globally
if (typeof window !== 'undefined') {
    window.InventoryScene = InventoryScene;
}
