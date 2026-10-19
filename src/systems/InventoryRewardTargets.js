import { copyDetachedJsonData as copyInventoryRewardData, freezeDetachedJsonData as freezeInventoryRewardData } from '../utils/DetachedJsonData.js';
export { copyInventoryRewardData, freezeInventoryRewardData };

const stackableTypes = ['food', 'powerup', 'utility'];

function inventoryStorage(state, stateRoot = state.state) {
    const root = Object.getOwnPropertyDescriptor(stateRoot, 'inventory');
    if (root && (!Object.hasOwn(root, 'value') || !root.enumerable || !root.value ||
        typeof root.value !== 'object' || Array.isArray(root.value))) throw Error('NONCANONICAL_INVENTORY_ROOT');
    const inventory = root?.value, item = inventory && Object.getOwnPropertyDescriptor(inventory, 'items');
    if (item && (!Object.hasOwn(item, 'value') || !item.enumerable || !Array.isArray(item.value))) throw Error('NONCANONICAL_INVENTORY_ITEMS');
    const data = { inventoryPresent: Boolean(root), itemsPresent: Boolean(item) };
    if (root) data.inventory = inventory;
    // Validate all own data, including an unknown field, without invoking getters.
    copyInventoryRewardData(data);
    return { root, item, inventory, data };
}

function sameDescriptor(a, b) {
    return !a ? !b : Boolean(b) && ['value', 'get', 'set', 'enumerable', 'writable', 'configurable'].every(key => a[key] === b[key]);
}

// Loaded absence provenance is not a write owner. Per-calculation readers still
// bind the exact lease; a temporary upload alone does not change loaded items.
// Preparing a future root does not admit it.
export function captureFreshInventoryAbsence(state, cache, root = state?.state) {
    try {
        const original = inventoryStorage(state, root), get = state.get;
        const admission = state.getSaveAdmission, epoch = admission.call(state).epoch, owner = state.saveAdmission;
        const selectedCloud = window.CloudSave, mode = state.storageMode;
        const cloudEpoch = selectedCloud?.campaignEpoch, cloudUser = selectedCloud?.currentUser?.id;
        if (original.item || !Array.isArray(cache) || cache.length || admission.call(state).status !== 'ready') return null;
        const bytes = JSON.stringify(original.data);
        return () => {
            try {
                const current = inventoryStorage(state);
                return window.GameState === state && state.state === root && state.get === get &&
                    state.getSaveAdmission === admission && state.saveAdmission === owner && admission.call(state).epoch === epoch &&
                    admission.call(state).status === 'ready' && state.storageMode === mode &&
                    window.CloudSave === selectedCloud && selectedCloud?.campaignEpoch === cloudEpoch && selectedCloud?.currentUser?.id === cloudUser &&
                    sameDescriptor(original.root, current.root) && sameDescriptor(original.item, current.item) &&
                    JSON.stringify(current.data) === bytes && cache.length === 0;
            } catch { return false; }
        };
    } catch { return null; }
}

export function canAcceptInventoryItem(target, item) {
    if (!item) return false;
    const joinsStack = stackableTypes.includes(item.type) && target.inventory.some(owned => owned.id === item.id);
    return joinsStack || target.inventory.length < target.maxSlots;
}

export function addInventoryItem(target, item, ports) {
    if (!item) { ports.warn('[InventoryManager] Cannot add null item'); return false; }
    if (stackableTypes.includes(item.type)) {
        const existing = target.inventory.find(owned => owned.id === item.id);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
            ports.log(`[InventoryManager] Stacked ${item.name} (x${existing.quantity})`);
            ports.persist();
            ports.emit('itemAdded', { item: existing, stacked: true });
            return true;
        }
    }
    if (target.inventory.length >= target.maxSlots) {
        ports.warn('[InventoryManager] Inventory is full'); ports.emit('inventoryFull'); return false;
    }
    const added = { ...item, quantity: item.quantity || 1, addedAt: ports.now(), slot: target.inventory.length };
    target.inventory.push(added);
    ports.log(`[InventoryManager] Added ${item.name} to inventory (slot ${added.slot})`);
    ports.persist(); ports.emit('itemAdded', { item: added, stacked: false });
    return true;
}

export function addGuaranteedInventoryReward(item, ports) {
    if (!item) return { accepted: false, queued: false, item: null };
    if (ports.canAccept(item) && ports.addItem(item)) return { accepted: true, queued: false, item };
    if (!ports.hasState()) return { accepted: false, queued: false, item };
    const saved = ports.readPending(), pending = Array.isArray(saved) ? saved : [];
    ports.writePending([...pending, { ...item, effect: { ...(item.effect || {}) }, quantity: 1 }]);
    ports.persist(); ports.emit('bossRewardQueued', { item });
    return { accepted: true, queued: true, item };
}

export function addInventoryShipPart(partId, ports) {
    if (!ports.hasState()) { ports.warn('[InventoryManager] GameState not available'); return false; }
    if (!ports.definitions()[partId]) { ports.warn(`[InventoryManager] Unknown ship part: ${partId}`); return false; }
    const collected = ports.readCollected() || [];
    if (collected.includes(partId)) { ports.log(`[InventoryManager] Ship part already collected: ${partId}`); return false; }
    collected.push(partId); ports.writeCollected(collected); ports.persist();
    const partInfo = ports.definitions()[partId];
    ports.log(`[InventoryManager] Collected ship part: ${partInfo.label}`);
    ports.emit('shipPartCollected', { partId, partInfo, totalCollected: collected.length, totalParts: Object.keys(ports.definitions()).length });
    ports.notify(); return true;
}

export function captureInventoryRewardSource(manager, state, prototype, isSelected, suppliedReader = null, freshLoad = null) {
    const refused = reason => Object.freeze({ status: 'unqualified', reason });
    try {
        if (!state?.captureSaveAdmissionOwner || !isSelected() || Object.getPrototypeOf(manager) !== prototype) return refused('inventory_source_unavailable');
        const storage = inventoryStorage(state), inventory = storage.inventory;
        const names = [...(!storage.item ? ['initialize', 'migrateLegacyMapItems', 'claimPendingBossRewards'] : []),
            'addItem', 'canAcceptItem', 'addGuaranteedReward', 'addShipPart', 'saveInventory', 'loadSourceForSceneEntry', 'captureRewardCalculationSource', 'captureCompletionCachePublication'];
        const methods = names.map(name => manager[name]);
        if (names.some((name, index) => typeof methods[index] !== 'function' || methods[index] !== prototype[name])) return refused('inventory_adapter_changed');
        const get = state.get, admission = state.getSaveAdmission, captureOwner = state.captureSaveAdmissionOwner;
        const reader = suppliedReader || state.captureSaveAdmissionOwner();
        const readerCurrent = reader?.isCurrent;
        const owns = () => typeof readerCurrent === 'function' && reader.isCurrent === readerCurrent && readerCurrent.call(reader);
        if (!owns() || state.getSaveAdmission().status !== 'ready') return refused('inventory_source_not_ready');
        const shipParts = state.get('hubWorld.shipParts'), items = manager.inventory;
        const definitions = manager.SHIP_PART_DEFINITIONS, events = manager.events, emit = events?.emit, initialized = manager.initialized;
        const slots = manager.maxSlots;
        const missing = !storage.item;
        if (!Array.isArray(items) || (missing ? initialized !== true || items.length !== 0 || typeof freshLoad !== 'function' || !freshLoad()
            : inventory.items !== items) || !shipParts || Array.isArray(shipParts) ||
            !Array.isArray(shipParts.collected) || !Number.isSafeInteger(slots) || slots < 0 || typeof initialized !== 'boolean' ||
            typeof emit !== 'function' || !definitions || Array.isArray(definitions) ||
            (inventory?.pendingBossRewards != null && !Array.isArray(inventory.pendingBossRewards))) return refused('inventory_cache_not_canonical');
        const read = () => ({ ...inventoryStorage(state).data, cache: manager.inventory, shipParts: state.get('hubWorld.shipParts'),
            definitions: manager.SHIP_PART_DEFINITIONS, maxSlots: manager.maxSlots });
        const data = copyInventoryRewardData(read()), bytes = JSON.stringify(data);
        const isCurrent = () => {
            try {
                if (!isSelected() || !owns() || state.get !== get || state.getSaveAdmission !== admission || state.captureSaveAdmissionOwner !== captureOwner ||
                    state.getSaveAdmission().status !== 'ready' || Object.getPrototypeOf(manager) !== prototype ||
                    names.some((name, index) => manager[name] !== methods[index] || prototype[name] !== methods[index]) ||
                    manager.inventory !== items || state.get('inventory') !== inventory ||
                    !sameDescriptor(storage.root, inventoryStorage(state).root) || !sameDescriptor(storage.item, inventoryStorage(state).item) ||
                    (missing ? !freshLoad() : inventory.items !== items) ||
                    state.get('hubWorld.shipParts') !== shipParts || manager.SHIP_PART_DEFINITIONS !== definitions ||
                    manager.events !== events || events.emit !== emit || manager.initialized !== initialized || manager.maxSlots !== slots) return false;
                return JSON.stringify(copyInventoryRewardData(read())) === bytes && owns() && isSelected();
            } catch { return false; }
        };
        if (!isCurrent()) return refused('inventory_source_changed');
        return Object.freeze({ status: 'captured', data: freezeInventoryRewardData(data), isCurrent,
            scope: `${suppliedReader ? 'provided' : 'memory'}-owner-and-${missing ? 'original-empty-cache' : 'canonical-cache'}` });
    } catch { return refused('inventory_source_unreadable'); }
}
