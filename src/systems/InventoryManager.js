/**
 * InventoryManager - Manages player inventory system
 * Handles item storage, usage, equipping, and organization
 */

class InventoryManager {
    constructor() {
        this.initialized = false;
        this.maxSlots = 30;
        this.inventory = [];
        this.events = new Phaser.Events.EventEmitter();
        this.lastUseResult = null;
        this.utilityLimits = {
            void_crystal: 3
        };

        // Ship part definitions - collected through gameplay
        // Canonical storage is hubWorld.shipParts.collected[] in GameState
        // 5 pre-final parts unlock Final Void. Command Module is awarded by the final boss.
        this.SHIP_PART_DEFINITIONS = {
            crystal_core: {
                id: 'crystal_core',
                icon: '🔮',
                label: 'Crystal Core',
                source: 'Crystal Caves',
                description: 'Channels cosmic energy',
                position: 'left'
            },
            dimensional_drive: {
                id: 'dimensional_drive',
                icon: '⚙️',
                label: 'Dimensional Drive',
                source: 'Stellar Reef',
                description: 'Powers interdimensional travel',
                position: 'bottom'
            },
            forest_core: {
                id: 'forest_core',
                icon: '🌳',
                label: 'Forest Core',
                source: 'Mythical Forest',
                description: 'Harnesses nature\'s ancient power',
                position: 'right'
            },
            aurora_reactor: {
                id: 'aurora_reactor',
                icon: '✨',
                label: 'Aurora Reactor',
                source: 'Aurora Depths',
                description: 'Generates aurora energy',
                position: 'top'
            },
            hull_plating: {
                id: 'hull_plating',
                icon: '🛡️',
                label: 'Hull Plating',
                source: 'Void Peaks',
                description: 'Protects the ship from void pressure',
                position: 'upper'
            },
            command_module: {
                id: 'command_module',
                icon: '👑',
                label: 'Command Module',
                source: 'The Final Void',
                description: 'Central control system for space travel',
                position: 'center'
            }
        };
    }

    /**
     * Initialize the inventory system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[InventoryManager] Already initialized');
            return;
        }

        // Load inventory from GameState if it exists
        if (window.GameState) {
            const savedInventory = window.GameState.get('inventory.items');
            if (savedInventory && Array.isArray(savedInventory)) {
                this.inventory = savedInventory;
            }
        }

        this.migrateLegacyMapItems();
        this.initialized = true;
        console.log('✅ InventoryManager initialized');
    }

    /**
     * Older shop builds stored route maps in finite inventory slots after
     * unlocking their gates. Move those records into permanent route ownership.
     */
    migrateLegacyMapItems() {
        if (!window.GameState?.addMapToCollection) {
            return false;
        }

        const legacyMaps = this.inventory.filter(
            item => item?.type === 'map' && item.gateId
        );
        if (legacyMaps.length === 0) {
            return false;
        }

        const migratedItems = new Set();
        legacyMaps.forEach(item => {
            const added = window.GameState.addMapToCollection(item.gateId);
            const mapsOwned = window.GameState.get('hubWorld.mapsOwned') || [];
            if (added || mapsOwned.includes(item.gateId)) {
                migratedItems.add(item);
            }
        });
        if (migratedItems.size === 0) {
            return false;
        }

        this.inventory = this.inventory
            .filter(item => !migratedItems.has(item))
            .map((item, slot) => ({ ...item, slot }));
        this.saveInventory();
        console.log(`[InventoryManager] Migrated ${migratedItems.size} route map(s) to permanent unlocks`);
        return true;
    }

    /**
     * Add item to inventory
     * @param {object} item - Item object to add
     * @returns {boolean} - Success status
     */
    addItem(item) {
        if (!item) {
            console.warn('[InventoryManager] Cannot add null item');
            return false;
        }

        // Check if item is stackable
        const stackableTypes = ['food', 'powerup', 'utility'];
        if (stackableTypes.includes(item.type)) {
            // Try to find existing stack
            const existingItem = this.inventory.find(i => i.id === item.id);
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
                console.log(`[InventoryManager] Stacked ${item.name} (x${existingItem.quantity})`);

                this.saveInventory();
                this.events.emit('itemAdded', { item: existingItem, stacked: true });
                return true;
            }
        }

        // A full inventory can still accept an item that joins an existing
        // stack, so capacity is checked only after the stack path above.
        if (this.inventory.length >= this.maxSlots) {
            console.warn('[InventoryManager] Inventory is full');
            this.events.emit('inventoryFull');
            return false;
        }

        // Add as new item
        const newItem = {
            ...item,
            quantity: item.quantity || 1,
            addedAt: Date.now(),
            slot: this.inventory.length
        };

        this.inventory.push(newItem);
        console.log(`[InventoryManager] Added ${item.name} to inventory (slot ${newItem.slot})`);

        this.saveInventory();
        this.events.emit('itemAdded', { item: newItem, stacked: false });

        return true;
    }

    /**
     * Check whether an item can be added without mutating inventory.
     */
    canAcceptItem(item) {
        if (!item) {
            return false;
        }

        const stackableTypes = ['food', 'powerup', 'utility'];
        const joinsExistingStack = (
            stackableTypes.includes(item.type) &&
            this.inventory.some(existingItem => existingItem.id === item.id)
        );

        return joinsExistingStack || this.inventory.length < this.maxSlots;
    }

    /**
     * Remove item from inventory
     * @param {number} slot - Inventory slot index
     * @param {number} quantity - Number of items to remove (default: 1)
     * @returns {boolean} - Success status
     */
    removeItem(slot, quantity = 1) {
        if (slot < 0 || slot >= this.inventory.length) {
            console.warn('[InventoryManager] Invalid slot index');
            return false;
        }

        const item = this.inventory[slot];
        if (!item) {
            console.warn('[InventoryManager] No item in slot');
            return false;
        }

        const currentQuantity = item.quantity || 1;

        if (currentQuantity <= quantity) {
            // Remove entire item
            const removedItem = this.inventory.splice(slot, 1)[0];
            console.log(`[InventoryManager] Removed ${removedItem.name} from slot ${slot}`);

            // Reindex remaining items
            this.inventory.forEach((item, index) => {
                item.slot = index;
            });

            this.saveInventory();
            this.events.emit('itemRemoved', { item: removedItem, slot });
            return true;
        } else {
            // Decrease quantity
            item.quantity -= quantity;
            console.log(`[InventoryManager] Decreased ${item.name} quantity to ${item.quantity}`);

            this.saveInventory();
            this.events.emit('itemQuantityChanged', { item, slot, newQuantity: item.quantity });
            return true;
        }
    }

    /**
     * Use item from inventory
     * @param {number} slot - Inventory slot index
     * @returns {boolean} - Success status
     */
    useItem(slot, options = {}) {
        this.lastUseResult = null;

        if (slot < 0 || slot >= this.inventory.length) {
            console.warn('[InventoryManager] Invalid slot index');
            this.lastUseResult = {
                success: false,
                message: 'That inventory slot is no longer available.'
            };
            return false;
        }

        const item = this.inventory[slot];
        if (!item) {
            console.warn('[InventoryManager] No item in slot');
            this.lastUseResult = {
                success: false,
                message: 'That item is no longer available.'
            };
            return false;
        }

        console.log(`[InventoryManager] Using ${item.name}`);

        // Handle different item types
        switch (item.type) {
            case 'food':
                return this.useFoodItem(item, slot);

            case 'egg':
                return this.useEggItem(item, slot);

            case 'utility':
                return this.useUtilityItem(item, slot);

            case 'powerup':
                return this.usePowerupItem(item, slot, options);

            default:
                console.warn(`[InventoryManager] Unknown item type: ${item.type}`);
                return false;
        }
    }

    /**
     * Use food item to restore creature stats
     * @param {object} item - Food item
     * @param {number} slot - Inventory slot
     * @returns {boolean} - Success status
     */
    useFoodItem(item, slot) {
        if (!window.GameState) {
            console.warn('[InventoryManager] GameState not available');
            return false;
        }

        // Apply food effects to creature
        if (item.effect) {
            let effectApplied = false;

            if (item.effect.happiness !== undefined) {
                const currentHappiness = window.GameState.get('creature.stats.happiness') || 0;
                const newHappiness = Math.min(100, currentHappiness + item.effect.happiness);
                window.GameState.set('creature.stats.happiness', newHappiness);
                effectApplied = true;
            }

            if (item.effect.hunger !== undefined) {
                const currentHunger = window.GameState.get('creature.stats.hunger') || 0;
                const newHunger = Math.min(100, currentHunger + item.effect.hunger);
                window.GameState.set('creature.stats.hunger', newHunger);
                effectApplied = true;
            }

            if (item.effect.health !== undefined) {
                const currentHealth = window.GameState.get('creature.stats.health') || 100;
                const maxHealth = 100;
                const newHealth = Math.min(maxHealth, currentHealth + item.effect.health);
                window.GameState.set('creature.stats.health', newHealth);
                effectApplied = true;
            }

            if (effectApplied) {
                console.log(`[InventoryManager] Applied ${item.name} effects:`, item.effect);
                this.removeItem(slot, 1);
                this.events.emit('itemUsed', { item, slot, effect: item.effect });
                return true;
            }
        }

        console.warn('[InventoryManager] Food item has no effects');
        return false;
    }

    /**
     * Use egg item (opens hatching system)
     * @param {object} item - Egg item
     * @param {number} slot - Inventory slot
     * @returns {boolean} - Success status
     */
    useEggItem(item, slot) {
        console.log(`[InventoryManager] Opening egg: ${item.name}`);

        // Emit event for UI to handle (e.g., open hatching scene)
        this.events.emit('eggSelected', { item, slot });

        // Note: Egg is not removed until hatching is confirmed
        return true;
    }

    /**
     * Use utility item
     * @param {object} item - Utility item
     * @param {number} slot - Inventory slot
     * @returns {boolean} - Success status
     */
    useUtilityItem(item, slot) {
        console.log(`[InventoryManager] Using utility: ${item.name}`);

        if (item.id !== 'void_crystal') {
            const message = `${item.name} cannot be placed yet.`;
            console.warn(`[InventoryManager] Unsupported utility item: ${item.id}`);
            this.lastUseResult = { success: false, message };
            this.events.emit('utilityRejected', { item, slot, message });
            return false;
        }

        if (!window.GameState) {
            const message = 'The Sanctuary could not be reached. The item was not used.';
            this.lastUseResult = { success: false, message };
            this.events.emit('utilityRejected', { item, slot, message });
            return false;
        }

        const path = 'world.sanctuaryDecorations.voidCrystals';
        const limit = this.utilityLimits.void_crystal;
        const storedCount = Number(window.GameState.get(path));
        const currentCount = Number.isFinite(storedCount)
            ? Math.max(0, Math.min(limit, Math.floor(storedCount)))
            : 0;

        if (currentCount >= limit) {
            const message = 'The Sanctuary crystal corner is complete.';
            this.lastUseResult = { success: false, message };
            this.events.emit('utilityRejected', { item, slot, message });
            return false;
        }

        const nextCount = currentCount + 1;
        window.GameState.set(path, nextCount);

        if (!this.removeItem(slot, 1)) {
            window.GameState.set(path, currentCount);
            const message = 'The crystal could not be placed. The item was not used.';
            this.lastUseResult = { success: false, message };
            this.events.emit('utilityRejected', { item, slot, message });
            return false;
        }

        const message = `Void Crystal placed in the Sanctuary (${nextCount}/${limit}).`;
        this.lastUseResult = { success: true, message };
        this.events.emit('utilityUsed', {
            item,
            slot,
            count: nextCount,
            limit,
            message
        });
        return true;
    }

    getLastUseResult() {
        return this.lastUseResult ? { ...this.lastUseResult } : null;
    }

    getUtilityCapacity(itemId) {
        const limit = this.utilityLimits[itemId];
        if (!limit) {
            return null;
        }

        const placedPath = itemId === 'void_crystal'
            ? 'world.sanctuaryDecorations.voidCrystals'
            : null;
        const storedPlaced = placedPath ? Number(window.GameState?.get(placedPath)) : 0;
        const placed = Number.isFinite(storedPlaced)
            ? Math.max(0, Math.min(limit, Math.floor(storedPlaced)))
            : 0;
        const carried = this.inventory
            .filter(item => item?.id === itemId)
            .reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);

        return {
            placed,
            carried,
            total: placed + carried,
            limit,
            canAcquire: placed + carried < limit
        };
    }

    /**
     * Activate a combat power-up through the current level scene.
     * The inventory owns consumption; the scene owns live combat state.
     */
    usePowerupItem(item, slot, options = {}) {
        if (!item.usableInLevel || !item.effect) {
            console.warn(`[InventoryManager] ${item.name} is not a usable level power-up`);
            return false;
        }

        if (typeof options.applyPowerup !== 'function') {
            console.warn(`[InventoryManager] ${item.name} can only be used during an expedition`);
            this.events.emit('powerupUnavailable', { item, slot });
            return false;
        }

        const activation = options.applyPowerup(item.effect, item);
        const success = activation === true || activation?.success === true;
        if (!success) {
            this.events.emit('powerupRejected', {
                item,
                slot,
                message: activation?.message || 'Power-up could not be activated'
            });
            return false;
        }

        this.removeItem(slot, 1);
        this.events.emit('powerupUsed', {
            item,
            slot,
            effect: item.effect,
            message: activation?.message || `${item.name} activated`
        });
        return true;
    }

    /**
     * Equip attack item to creature
     * @param {number} slot - Inventory slot index
     * @returns {boolean} - Success status
     */
    equipAttack(slot) {
        if (slot < 0 || slot >= this.inventory.length) {
            console.warn('[InventoryManager] Invalid slot index');
            return false;
        }

        const item = this.inventory[slot];
        if (!item) {
            console.warn('[InventoryManager] No item in slot');
            return false;
        }

        // Check if item is equippable
        if (!item.equippable) {
            console.warn('[InventoryManager] Item is not equippable');
            return false;
        }

        // Get current equipped attack
        const currentAttack = window.GameState?.get('creature.equippedAttack');

        if (currentAttack && currentAttack.id === item.id) {
            console.warn('[InventoryManager] Item already equipped');
            return false;
        }

        // Equip the attack
        window.GameState?.set('creature.equippedAttack', {
            id: item.id,
            name: item.name,
            damage: item.damage || 0,
            attackType: item.attackType || 'normal',
            equippedAt: Date.now()
        });

        console.log(`[InventoryManager] Equipped ${item.name}`);
        this.events.emit('attackEquipped', { item, slot });

        return true;
    }

    /**
     * Unequip current attack
     * @returns {boolean} - Success status
     */
    unequipAttack() {
        const currentAttack = window.GameState?.get('creature.equippedAttack');

        if (!currentAttack) {
            console.warn('[InventoryManager] No attack equipped');
            return false;
        }

        window.GameState?.set('creature.equippedAttack', null);
        console.log('[InventoryManager] Unequipped attack');
        this.events.emit('attackUnequipped', { attack: currentAttack });

        return true;
    }

    /**
     * Get item at slot
     * @param {number} slot - Inventory slot index
     * @returns {object|null} - Item object or null
     */
    getItem(slot) {
        if (slot < 0 || slot >= this.inventory.length) {
            return null;
        }
        return this.inventory[slot];
    }

    /**
     * Get all items
     * @returns {array} - Array of items
     */
    getAllItems() {
        return [...this.inventory];
    }

    /**
     * Get items by type
     * @param {string} type - Item type (food, egg, utility, etc.)
     * @returns {array} - Filtered items
     */
    getItemsByType(type) {
        return this.inventory.filter(item => item.type === type);
    }

    /**
     * Check if inventory has space
     * @returns {boolean}
     */
    hasSpace() {
        return this.inventory.length < this.maxSlots;
    }

    /**
     * Get number of available slots
     * @returns {number}
     */
    getAvailableSlots() {
        return this.maxSlots - this.inventory.length;
    }

    /**
     * Sort inventory by type
     */
    sortByType() {
        const typeOrder = { egg: 0, food: 1, powerup: 2, utility: 3 };

        this.inventory.sort((a, b) => {
            const orderA = typeOrder[a.type] ?? 999;
            const orderB = typeOrder[b.type] ?? 999;
            return orderA - orderB;
        });

        // Reindex slots
        this.inventory.forEach((item, index) => {
            item.slot = index;
        });

        this.saveInventory();
        this.events.emit('inventorySorted', { sortType: 'type' });
        console.log('[InventoryManager] Sorted inventory by type');
    }

    /**
     * Sort inventory by name
     */
    sortByName() {
        this.inventory.sort((a, b) => a.name.localeCompare(b.name));

        // Reindex slots
        this.inventory.forEach((item, index) => {
            item.slot = index;
        });

        this.saveInventory();
        this.events.emit('inventorySorted', { sortType: 'name' });
        console.log('[InventoryManager] Sorted inventory by name');
    }

    /**
     * Clear entire inventory
     */
    clearInventory() {
        this.inventory = [];
        this.saveInventory();
        this.events.emit('inventoryCleared');
        console.log('[InventoryManager] Inventory cleared');
    }

    /**
     * Save inventory to GameState
     */
    saveInventory() {
        if (window.GameState) {
            window.GameState.set('inventory.items', this.inventory);
            window.GameState.save();
        }
    }

    /**
     * Get inventory statistics
     * @returns {object} - Inventory stats
     */
    getStats() {
        return {
            totalItems: this.inventory.length,
            availableSlots: this.getAvailableSlots(),
            maxSlots: this.maxSlots,
            itemsByType: {
                eggs: this.getItemsByType('egg').length,
                food: this.getItemsByType('food').length,
                powerups: this.getItemsByType('powerup').length,
                utilities: this.getItemsByType('utility').length
            }
        };
    }

    // ============ SHIP PARTS SYSTEM ============
    // Ship parts are stored in hubWorld.shipParts.collected (canonical source)
    // These methods provide a unified interface

    /**
     * Add a ship part to collection
     * @param {string} partId - Ship part ID (e.g., 'crystal_core')
     * @returns {boolean} - Success status
     */
    addShipPart(partId) {
        if (!window.GameState) {
            console.warn('[InventoryManager] GameState not available');
            return false;
        }

        // Validate part ID
        if (!this.SHIP_PART_DEFINITIONS[partId]) {
            console.warn(`[InventoryManager] Unknown ship part: ${partId}`);
            return false;
        }

        // Get current collected parts
        const collected = window.GameState.get('hubWorld.shipParts.collected') || [];

        // Check if already collected
        if (collected.includes(partId)) {
            console.log(`[InventoryManager] Ship part already collected: ${partId}`);
            return false;
        }

        // Add to collection
        collected.push(partId);
        window.GameState.set('hubWorld.shipParts.collected', collected);
        window.GameState.save();

        const partInfo = this.SHIP_PART_DEFINITIONS[partId];
        console.log(`[InventoryManager] Collected ship part: ${partInfo.label}`);

        // Emit event for UI celebrations
        this.events.emit('shipPartCollected', {
            partId,
            partInfo,
            totalCollected: collected.length,
            totalParts: Object.keys(this.SHIP_PART_DEFINITIONS).length
        });

        // Play celebration sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        return true;
    }

    /**
     * Get all ship parts with collection status
     * @returns {array} - Array of ship part objects with collected status
     */
    getShipParts() {
        const collected = window.GameState?.get('hubWorld.shipParts.collected') || [];

        return Object.values(this.SHIP_PART_DEFINITIONS).map(part => ({
            ...part,
            collected: collected.includes(part.id)
        }));
    }

    /**
     * Get only collected ship parts
     * @returns {array} - Array of collected ship part objects
     */
    getCollectedShipParts() {
        const collected = window.GameState?.get('hubWorld.shipParts.collected') || [];

        return collected.map(partId => this.SHIP_PART_DEFINITIONS[partId]).filter(Boolean);
    }

    /**
     * Check if a specific ship part is collected
     * @param {string} partId - Ship part ID
     * @returns {boolean}
     */
    hasShipPart(partId) {
        const collected = window.GameState?.get('hubWorld.shipParts.collected') || [];
        return collected.includes(partId);
    }

    /**
     * Get ship parts collection progress
     * @returns {object} - Progress info
     */
    getShipPartsProgress() {
        const collected = window.GameState?.get('hubWorld.shipParts.collected') || [];
        const total = Object.keys(this.SHIP_PART_DEFINITIONS).length;

        return {
            collected: collected.length,
            total,
            percentage: Math.round((collected.length / total) * 100),
            isComplete: collected.length >= total
        };
    }

    /**
     * Event listener helper
     */
    on(event, callback, context) {
        this.events.on(event, callback, context);
    }

    once(event, callback, context) {
        this.events.once(event, callback, context);
    }

    off(event, callback, context) {
        this.events.off(event, callback, context);
    }

    /**
     * Cleanup
     */
    destroy() {
        this.inventory = [];
        this.events.removeAllListeners();
        this.initialized = false;
        console.log('[InventoryManager] Destroyed');
    }
}

// Export as singleton
const inventoryManager = new InventoryManager();

if (typeof window !== 'undefined') {
    window.InventoryManager = inventoryManager;
}

export default inventoryManager;
