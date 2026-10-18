import { addInventoryItem, canAcceptInventoryItem, addGuaranteedInventoryReward, addInventoryShipPart,
    captureInventoryRewardSource, captureFreshInventoryAbsence, copyInventoryRewardData as copy } from './InventoryRewardTargets.js';

const initialInventoryLoads = new WeakMap();
const loadedInventorySources = new WeakMap();

/**
 * InventoryManager - Manages player inventory system
 * Handles item storage, usage, equipping, and organization
 */

class InventoryManager {
    constructor() {
        this.initialized = false;
        this.maxSlots = 30;
        this.inventory = [];
        initialInventoryLoads.set(this, { phase: 'constructed', cache: this.inventory });
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

        const loadState = window.GameState, loadRoot = loadState?.state, loadEpoch = loadState?.getSaveAdmission?.().epoch;
        const constructed = initialInventoryLoads.get(this);
        const originalMethods = ['initialize', 'migrateLegacyMapItems', 'claimPendingBossRewards'];
        const methodsUnchanged = () => originalMethods.every(name => this[name] === InventoryManager.prototype[name]);
        const emptyLoad = constructed?.phase === 'constructed' && constructed.cache === this.inventory && methodsUnchanged()
            ? captureFreshInventoryAbsence(window.GameState, this.inventory) : null;
        initialInventoryLoads.delete(this);

        // Load inventory from GameState if it exists
        if (window.GameState) {
            const savedInventory = window.GameState.get('inventory.items');
            if (savedInventory && Array.isArray(savedInventory)) {
                this.inventory = savedInventory;
            }
        }

        this.migrateLegacyMapItems();
        this.initialized = true;
        this.claimPendingBossRewards();
        if (emptyLoad?.() && this.inventory === constructed.cache && methodsUnchanged()) {
            initialInventoryLoads.set(this, { phase: 'loaded-empty', cache: constructed.cache,
                isCurrent: () => this.inventory === constructed.cache && methodsUnchanged() && emptyLoad() });
        }
        if (loadRoot && window.GameState === loadState && loadState.state === loadRoot && loadState.getSaveAdmission?.().epoch === loadEpoch) {
            loadedInventorySources.set(this, { state: loadState, epoch: loadEpoch });
        }
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
        return addInventoryItem(this, item, {
            now: () => Date.now(), persist: () => this.saveInventory(), emit: (...args) => this.events.emit(...args),
            log: (...args) => console.log(...args), warn: (...args) => console.warn(...args)
        });
    }

    /**
     * Check whether an item can be added without mutating inventory.
     */
    canAcceptItem(item) {
        return canAcceptInventoryItem(this, item);
    }

    /**
     * Guardian rewards are never discarded because the normal inventory is
     * full. They enter a small save-backed inbox and move into inventory as
     * soon as a slot or matching stack is available.
     */
    addGuaranteedReward(item) {
        return addGuaranteedInventoryReward(item, {
            canAccept: value => this.canAcceptItem(value), addItem: value => this.addItem(value), hasState: () => Boolean(window.GameState),
            readPending: () => window.GameState.get('inventory.pendingBossRewards'),
            writePending: value => window.GameState.set('inventory.pendingBossRewards', value),
            persist: () => window.GameState.save?.(), emit: (...args) => this.events.emit(...args)
        });
    }

    // Read-only prerequisite. The caller must supply its original raw-observed
    // save owner for storage checks; the default proves only memory/cache source.
    captureRewardCalculationSource({ state = window.GameState, reader = null } = {}) {
        return captureInventoryRewardSource(this, state, InventoryManager.prototype,
            () => window.GameState === state && window.InventoryManager === this, reader,
            initialInventoryLoads.get(this)?.isCurrent);
    }

    // A new Sanctuary entry loads its admitted source. This is NEVER called by
    // a retained completion retry, and does not migrate, claim, emit or save.
    loadSourceForSceneEntry(state = window.GameState) {
        try {
            if (!state || window.GameState !== state || window.InventoryManager !== this || !this.initialized ||
                Object.getPrototypeOf(this) !== InventoryManager.prototype || state.getSaveAdmission().status !== 'ready') return false;
            copy(state.state); copy(this.inventory);
            if (this.captureRewardCalculationSource({ state }).status === 'captured') return true;
            const root = state.state, epoch = state.getSaveAdmission().epoch, reader = state.captureSaveAdmissionOwner();
            const previous = loadedInventorySources.get(this), receipt = initialInventoryLoads.get(this);
            const newSource = previous && (previous.state !== state || previous.epoch !== epoch);
            const names = ['initialize', 'migrateLegacyMapItems', 'claimPendingBossRewards', 'saveInventory',
                'captureRewardCalculationSource', 'loadSourceForSceneEntry'];
            const current = () => window.GameState === state && window.InventoryManager === this && state.state === root &&
                state.getSaveAdmission().epoch === epoch && state.getSaveAdmission().status === 'ready' && reader.isCurrent() &&
                names.every(name => this[name] === InventoryManager.prototype[name]);
            const items = state.get('inventory.items');
            let cache, absence;
            if (items !== undefined) {
                if (!Array.isArray(items) || !Object.isExtensible(items) || !Object.getOwnPropertyDescriptor(items, 'length').writable ||
                    (!newSource && JSON.stringify(copy(items)) !== JSON.stringify(copy(this.inventory)))) return false;
                cache = items;
            } else {
                if (!newSource && (!receipt || receipt.cache !== this.inventory || this.inventory.length !== 0)) return false;
                cache = newSource ? [] : this.inventory;
                absence = captureFreshInventoryAbsence(state, cache);
                if (!absence) return false;
            }
            const slot = Object.getOwnPropertyDescriptor(this, 'inventory');
            if (!slot?.writable || !Object.hasOwn(slot, 'value') || !current()) return false;
            this.inventory = cache;
            if (!current() || this.inventory !== cache) return false;
            if (absence) initialInventoryLoads.set(this, { phase: 'entry-empty', cache,
                isCurrent: () => this.inventory === cache && names.every(name => this[name] === InventoryManager.prototype[name]) && absence() });
            else initialInventoryLoads.delete(this);
            loadedInventorySources.set(this, { state, epoch });
            return this.captureRewardCalculationSource({ state }).status === 'captured';
        } catch { return false; }
    }

    // Prepare ordinary mutable slots before the writer. This capability never
    // writes progress or grants rewards, and cannot publish before adoption.
    captureCompletionCachePublication(state = window.GameState) {
        const source = this.captureRewardCalculationSource({ state });
        if (source.status !== 'captured') throw Error('INVENTORY_PUBLICATION_UNAVAILABLE');
        const beforeRoot = state.state, beforeCache = this.inventory, beforeReceipt = initialInventoryLoads.get(this);
        const admission = state.saveAdmission, epoch = state.getSaveAdmission().epoch, prototype = Object.getPrototypeOf(this);
        const names = ['initialize', 'migrateLegacyMapItems', 'claimPendingBossRewards', 'addItem', 'canAcceptItem',
            'addGuaranteedReward', 'addShipPart', 'saveInventory', 'loadSourceForSceneEntry', 'captureRewardCalculationSource', 'captureCompletionCachePublication'];
        const methods = names.map(name => this[name]), apiNames = ['get', 'set', 'getSaveAdmission', 'captureSaveAdmissionOwner'];
        const api = apiNames.map(name => state[name]), definitions = this.SHIP_PART_DEFINITIONS, events = this.events, emit = events.emit;
        const initialised = this.initialized, maxSlots = this.maxSlots, configBytes = JSON.stringify(copy(definitions));
        const slot = Object.getOwnPropertyDescriptor(this, 'inventory'), beforeBytes = JSON.stringify(copy(beforeCache));
        if (!slot?.writable || !slot.enumerable || !slot.configurable || slot.value !== beforeCache) throw Error('INVENTORY_PUBLICATION_SLOT_UNAVAILABLE');
        let after, cursor = 0, assigning = false, phase = 'captured';
        const sameField = (owner, key, expected) => {
            const field = Object.getOwnPropertyDescriptor(owner, key);
            return !expected ? !field : Boolean(field) && ['value', 'get', 'set', 'enumerable', 'writable', 'configurable'].every(name => field[name] === expected[name]);
        };
        const mutable = (value, seen = new Set()) => {
            if (!value || typeof value !== 'object' || seen.has(value)) return true;
            if (!Object.isExtensible(value)) return false;
            seen.add(value);
            return Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key, field]) =>
                (Array.isArray(value) && key === 'length' ? field.writable : field.writable && field.configurable) &&
                mutable(field.value, seen));
        };
        const pinMutable = value => {
            const nodes = [], seen = new Set();
            const visit = node => {
                if (!node || typeof node !== 'object' || seen.has(node)) return;
                seen.add(node);
                nodes.push({ node, prototype: Object.getPrototypeOf(node), fields: Object.getOwnPropertyDescriptors(node), keys: Reflect.ownKeys(node) });
                Object.values(node).forEach(visit);
            };
            visit(value);
            return () => nodes.every(({ node, prototype: expectedPrototype, fields, keys }) => {
                const nextKeys = Reflect.ownKeys(node);
                return Object.isExtensible(node) && Object.getPrototypeOf(node) === expectedPrototype &&
                    nextKeys.length === keys.length && keys.every((key, index) => nextKeys[index] === key && sameField(node, key, fields[key]));
            });
        };
        const matchesCache = next => this.inventory === (next ? after.cache : beforeCache) &&
            JSON.stringify(copy(this.inventory)) === (next ? after.cacheBytes : beforeBytes);
        const stable = () => window.GameState === state && window.InventoryManager === this &&
            state.saveAdmission === admission && state.getSaveAdmission().epoch === epoch && state.getSaveAdmission().status === 'ready' &&
            Object.getPrototypeOf(this) === prototype && names.every((name, index) => this[name] === methods[index] && prototype[name] === methods[index]) &&
            apiNames.every((name, index) => state[name] === api[index]) && this.SHIP_PART_DEFINITIONS === definitions &&
            JSON.stringify(copy(definitions)) === configBytes && this.events === events && events.emit === emit &&
            this.initialized === initialised && this.maxSlots === maxSlots;
        const futureCurrent = () => !after || (Object.isExtensible(after.root) &&
            sameField(after.root, 'inventory', after.inventoryField) && sameField(after.root, 'hubWorld', after.hubField) &&
            sameField(after.root.hubWorld, 'shipParts', after.partsField) &&
            ['inventoryItems', 'inventoryPresence', 'inventoryMode'].every(key => sameField(after.projection, key, after.projectionFields[key])) &&
            after.fixedProjectionCurrent() && JSON.stringify(copy(after.cache)) === after.cacheBytes &&
            JSON.stringify(copy({ inventory: after.root.inventory ?? null, shipParts: after.root.hubWorld.shipParts })) === after.branchBytes &&
            (after.itemsPresent ? after.root.inventory.items === after.cache : !Object.hasOwn(after.root.inventory || {}, 'items')));
        const isCurrent = () => {
            try {
                const field = Object.getOwnPropertyDescriptor(this, 'inventory');
                if (!stable() || !futureCurrent() || !field?.writable || !field.enumerable || !field.configurable ||
                    !(matchesCache(cursor > 0) || (assigning && cursor === 0 && matchesCache(true))) ||
                    initialInventoryLoads.get(this) !== (cursor > 1 ? after.receipt : beforeReceipt)) return false;
                if (state.state === beforeRoot) return cursor === 0 && source.isCurrent();
                return Boolean(after) && state.state === after.root;
            } catch { return false; }
        };
        if (!isCurrent()) throw Error('INVENTORY_PUBLICATION_UNAVAILABLE');
        return { isCurrent, isPublished: () => phase === 'published' && isCurrent(),
            prepare: (staged, projection) => {
                if (phase !== 'captured' || !isCurrent() || !staged || staged === beforeRoot || Object.isFrozen(staged) || !projection) throw Error('INVENTORY_PUBLICATION_NOT_PREPARED');
                copy(staged); copy(projection);
                if (!Array.isArray(projection.inventoryItems) || !Object.isExtensible(projection.inventoryItems) || Object.isFrozen(projection.inventoryItems)) throw Error('INVENTORY_PUBLICATION_NOT_PREPARED');
                const rootPresent = Object.hasOwn(staged, 'inventory'), itemsPresent = Object.hasOwn(staged.inventory || {}, 'items');
                const cache = projection.inventoryItems;
                if (!Object.isExtensible(staged) || !mutable(cache) || (rootPresent && !mutable(staged.inventory)) ||
                    !mutable(staged.hubWorld.shipParts)) throw Error('INVENTORY_PUBLICATION_NOT_PREPARED');
                if (projection.inventoryPresence?.root !== rootPresent || projection.inventoryPresence?.items !== itemsPresent ||
                    projection.inventoryMode !== (itemsPresent ? 'canonical' : 'original-empty') ||
                    (itemsPresent ? staged.inventory.items !== cache : source.data.itemsPresent || cache.length !== 0)) throw Error('INVENTORY_PUBLICATION_NOT_PREPARED');
                const missingProof = itemsPresent ? null : captureFreshInventoryAbsence(state, cache, staged);
                if (!itemsPresent && !missingProof) throw Error('INVENTORY_PUBLICATION_NOT_PREPARED');
                after = { root: staged, cache, itemsPresent, cacheBytes: JSON.stringify(copy(cache)),
                    inventoryField: Object.getOwnPropertyDescriptor(staged, 'inventory'),
                    hubField: Object.getOwnPropertyDescriptor(staged, 'hubWorld'), partsField: Object.getOwnPropertyDescriptor(staged.hubWorld, 'shipParts'),
                    projection, projectionFields: Object.fromEntries(['inventoryItems', 'inventoryPresence', 'inventoryMode'].map(key =>
                        [key, Object.getOwnPropertyDescriptor(projection, key)])),
                    fixedProjectionCurrent: pinMutable({ inventory: staged.inventory ?? null, shipParts: staged.hubWorld.shipParts,
                        cache, presence: projection.inventoryPresence }),
                    branchBytes: JSON.stringify(copy({ inventory: staged.inventory ?? null, shipParts: staged.hubWorld.shipParts })) };
                after.receipt = itemsPresent ? undefined : { phase: 'published-empty', cache,
                    isCurrent: () => this.inventory === cache && stable() && missingProof() };
                if (!isCurrent()) throw Error('INVENTORY_PUBLICATION_RETIRED');
                phase = 'prepared';
            },
            publish: () => {
                if (phase !== 'prepared' || !isCurrent() || state.state !== after.root) throw Error('INVENTORY_PUBLICATION_RETIRED');
                phase = 'publishing'; assigning = true;
                try { this.inventory = after.cache; }
                finally { try { if (matchesCache(true)) cursor = 1; } finally { assigning = false; } }
                if (!isCurrent()) throw Error('INVENTORY_PUBLICATION_RETIRED');
                if (after.receipt) initialInventoryLoads.set(this, after.receipt);
                else initialInventoryLoads.delete(this);
                loadedInventorySources.set(this, { state, epoch });
                cursor = 2;
                if (!isCurrent()) throw Error('INVENTORY_PUBLICATION_RETIRED');
                phase = 'published';
            }
        };
    }

    claimPendingBossRewards() {
        if (!window.GameState || this.claimingBossRewards) return 0;

        const pendingPath = 'inventory.pendingBossRewards';
        const pending = window.GameState.get(pendingPath) || [];
        if (!Array.isArray(pending) || pending.length === 0) return 0;

        // Stage both sides before publishing: addItem saves immediately and
        // would leave a refresh window with the reward owned AND still queued.
        const items = this.inventory.map(item => ({ ...item }));
        const remaining = [];
        const additions = [];
        const stackableTypes = ['food', 'powerup', 'utility'];
        pending.forEach(item => {
            const existing = item && stackableTypes.includes(item.type)
                ? items.find(owned => owned.id === item.id) : null;
            if (existing) {
                existing.quantity = (existing.quantity || 1) + 1;
                additions.push({ item: existing, stacked: true });
            } else if (item && items.length < this.maxSlots) {
                const added = { ...item, quantity: item.quantity || 1, addedAt: Date.now(), slot: items.length };
                items.push(added);
                additions.push({ item: added, stacked: false });
            } else {
                remaining.push(item);
            }
        });

        if (additions.length === 0) return 0;
        this.claimingBossRewards = true;
        try {
            this.inventory = items;
            window.GameState.set('inventory', {
                ...window.GameState.get('inventory'),
                items, pendingBossRewards: remaining
            });
            window.GameState.save?.();
            // Listeners see the complete transfer, including when storage is
            // unavailable and the existing save boundary keeps it in-session.
            additions.forEach(addition => this.events.emit('itemAdded', addition));
            this.events.emit('bossRewardsClaimed', { count: additions.length });
            return additions.length;
        } finally {
            this.claimingBossRewards = false;
        }
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
            this.claimPendingBossRewards();
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
     * Reserve one owned egg for HatchingScene before leaving the inventory.
     * GameState stages both changes and verifies their durable bytes before
     * inventory callbacks or the scene transition can observe success.
     */
    reserveEggForHatching(slot, spawnPosition = null) {
        const item = this.getItem(slot);
        if (!item || item.type !== 'egg') {
            return { success: false, reason: 'egg_not_found' };
        }
        if (window.GameState?.get('creature.hatchTransaction')?.status === 'reserved') {
            return { success: false, reason: 'hatch_already_reserved' };
        }

        const state = window.GameState;
        const cloud = window.CloudSave;
        const campaignGuard = cloud?.captureCampaignGuard?.() || (() => true);
        const isCurrentCampaign = () => state === window.GameState &&
            cloud === window.CloudSave && campaignGuard();
        const result = state?.reserveInventoryEggForHatching?.(slot, spawnPosition, {
            expectedItem: item, isCurrentCampaign
        });
        if (!result?.success) return result || { success: false, reason: 'hatch_save_unavailable' };
        const isCurrent = () => isCurrentCampaign() && result.isCurrent();
        this.inventory = state.get('inventory.items');
        if ((item.quantity || 1) > 1) {
            this.events.emit('itemQuantityChanged', { item: this.inventory[slot], slot,
                newQuantity: this.inventory[slot].quantity });
        } else this.events.emit('itemRemoved', { item, slot });
        if (!isCurrent()) return { success: false, reason: 'hatch_context_changed' };
        const { transaction } = result;
        this.events.emit('eggReservedForHatching', { transaction });
        if (!isCurrent()) return { success: false, reason: 'hatch_context_changed' };
        this.claimPendingBossRewards();
        return isCurrent() ? { success: true, transaction } : { success: false, reason: 'hatch_context_changed' };
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
        initialInventoryLoads.delete(this);
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
        return addInventoryShipPart(partId, {
            hasState: () => Boolean(window.GameState), definitions: () => this.SHIP_PART_DEFINITIONS,
            readCollected: () => window.GameState.get('hubWorld.shipParts.collected'),
            writeCollected: value => window.GameState.set('hubWorld.shipParts.collected', value), persist: () => window.GameState.save(),
            emit: (...args) => this.events.emit(...args), notify: () => { if (window.AudioManager) window.AudioManager.playAchievement(); },
            log: (...args) => console.log(...args), warn: (...args) => console.warn(...args)
        });
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
