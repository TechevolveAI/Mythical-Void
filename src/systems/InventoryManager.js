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

        this.initialized = true;
        console.log('✅ InventoryManager initialized');
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

        // Check if inventory is full
        if (this.inventory.length >= this.maxSlots) {
            console.warn('[InventoryManager] Inventory is full');
            this.events.emit('inventoryFull');
            return false;
        }

        // Check if item is stackable
        const stackableTypes = ['food', 'utility'];
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
    useItem(slot) {
        if (slot < 0 || slot >= this.inventory.length) {
            console.warn('[InventoryManager] Invalid slot index');
            return false;
        }

        const item = this.inventory[slot];
        if (!item) {
            console.warn('[InventoryManager] No item in slot');
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

        // Emit event for game-specific utility handling
        this.events.emit('utilityUsed', { item, slot });

        // Utility items are typically consumed after use
        this.removeItem(slot, 1);

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
        const typeOrder = { egg: 0, food: 1, utility: 2 };

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
                utilities: this.getItemsByType('utility').length
            }
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
