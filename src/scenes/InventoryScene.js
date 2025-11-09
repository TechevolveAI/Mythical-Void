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

        // Sort and filter state
        this.currentSort = 'none'; // none, name, type, price
        this.currentFilter = 'all'; // all, food, accessories, consumables
        this.sortButtons = [];
        this.filterButtons = [];
    }

    create() {
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

                console.log('[InventoryScene] Creating action buttons (desktop only)...');
                this.createActionButtons();
                console.log('[InventoryScene] ✅ Action buttons created');
            } else {
                console.log('[InventoryScene] ⚠️ Skipping desktop-only UI (mobile mode)');
            }

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
            this.scene.stop();
            this.scene.resume('GameScene');
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
            slotSize: isMobile ? 70 : 70,
            slotMargin: isMobile ? 8 : 10,
            gridCols: isMobile ? 4 : 5,  // Mobile: 4 cols full width, Desktop: 5 cols with sidebar
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
        const title = this.add.text(width / 2, 30, 'INVENTORY', {
            fontSize: titleSize,
            fontFamily: 'Arial Black',
            color: '#00FFFF',
            stroke: '#4A0080',
            strokeThickness: this.dims.isMobile ? 4 : 6,
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);

        // Stats panel
        const stats = window.InventoryManager?.getStats();
        const statsText = `${stats?.totalItems || 0} / ${stats?.maxSlots || 30} Items`;

        this.statsText = this.add.text(width / 2, 65, statsText, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center'
        });
        this.statsText.setOrigin(0.5, 0.5);
    }

    /**
     * Create sort and filter controls
     */
    createSortFilterControls() {
        const { width, isMobile, margin } = this.dims;

        const startX = margin + 10;
        const y = 85;
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

        const startY = 110;

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

                // Item icon
                if (slot.itemIcon) {
                    slot.itemIcon.destroy();
                }

                slot.itemIcon = this.add.text(
                    slot.x + slot.size / 2,
                    slot.y + slot.size / 2 - 5,
                    item.icon || '?',
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
            if (this.equipButton) this.equipButton.visible = false;
            return;
        }

        // Update details - defensive checks for all properties
        this.detailName.setText(item.name);
        if (this.detailIcon) this.detailIcon.setText(item.icon);
        if (this.detailType) this.detailType.setText(`Type: ${item.type.toUpperCase()}`);
        if (this.detailDescription) this.detailDescription.setText(item.description || 'No description available');

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
        if (this.equipButton) {
            this.equipButton.visible = item.equippable === true;
        }
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

        // Check if item is expensive (>= 100 coins) and show confirmation
        const EXPENSIVE_THRESHOLD = 100;
        if (item.price && item.price >= EXPENSIVE_THRESHOLD) {
            this.showUseConfirmation(item);
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
        console.log('[InventoryScene] Closing inventory');

        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Stop this scene and resume GameScene
        this.scene.stop();
        this.scene.resume('GameScene');
    }

    /**
     * Cleanup
     */
    shutdown() {
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

        // Remove listeners from close button zone
        if (this.closeButtonZone && this.closeButtonZone.removeAllListeners) {
            this.closeButtonZone.removeAllListeners();
        }

        // Clear all timers
        if (this.time) {
            this.time.removeAllEvents();
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
