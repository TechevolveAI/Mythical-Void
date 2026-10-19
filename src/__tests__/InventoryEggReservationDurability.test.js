const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const { compiledInventorySource } = require('./support/compiledInventorySource.cjs');

function inventoryFor(gameState) {
    const source = compiledInventorySource();
    const sceneWindow = { GameState: gameState };
    vm.runInNewContext(source, { module: sceneWindow, window: sceneWindow,
        Phaser: { Events: { EventEmitter } }, Date, console });
    const inventory = sceneWindow.exports;
    inventory.initialize();
    return { inventory, sceneWindow };
}

describe('durable inventory egg reservation with the real local save owner', () => {
    let state, inventory, sceneWindow, reserved, removed, quantityChanged;
    const primary = () => localStorage.getItem(state.saveKey);
    const bytes = () => ({ ...localStorage });
    const reserve = () => inventory.reserveEggForHatching(1, { x: 0, y: 240 });
    const reopen = () => {
        const next = new GameStateManager();
        expect(next.load()).toBe(true);
        return next;
    };
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(1700000000777);
        localStorage.clear();
        state = new GameStateManager();
        state.set('creature.genes', { id: 'fictional-existing-genes' });
        state.set('creature.hatched', true);
        state.set('creatures', [{ id: 'fictional-existing-creature',
            genes: { id: 'fictional-existing-genes' }, lifecycle: { stage: 'adult' } }]);
        state.set('inventory.items', [
            { id: 'fictional-food', type: 'food', name: 'Fictional food', quantity: 1, slot: 0 },
            { id: 'fictional-egg', type: 'egg', eggType: 'stellar', name: 'Fictional egg', quantity: 1, slot: 1 },
            { id: 'fictional-tool', type: 'utility', name: 'Fictional tool', quantity: 2, slot: 2 }
        ]);
        state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
        expect(state.save()).toBe(true);
        ({ inventory, sceneWindow } = inventoryFor(state));
        reserved = jest.fn(); removed = jest.fn(); quantityChanged = jest.fn();
        inventory.on('eggReservedForHatching', reserved);
        inventory.on('itemRemoved', removed);
        inventory.on('itemQuantityChanged', quantityChanged);
    });
    afterEach(() => {
        state.stopAutoSave();
        inventory.destroy();
        jest.restoreAllMocks();
        jest.useRealTimers();
        document.body.replaceChildren();
    });

    test('stores the decrement and existing v1 reservation before any success notification', () => {
        const before = state.createSaveSnapshot();
        const epoch = state.getSaveAdmission().epoch;
        const saved = jest.fn(() => {
            const durable = JSON.parse(primary());
            expect(durable.creature.hatchTransaction).toMatchObject({
                schemaVersion: 1, status: 'reserved', eggItemId: 'fictional-egg',
                eggType: 'stellar', inventorySlot: 1, spawnPosition: { x: 0, y: 240 }
            });
            expect(durable.inventory.items.map(item => item.id)).toEqual(['fictional-food', 'fictional-tool']);
        });
        state.on('saved', saved);
        removed.mockImplementation(saved);
        reserved.mockImplementation(saved);
        const result = reserve();
        expect(result.success).toBe(true);
        expect(saved).toHaveBeenCalledTimes(3);
        expect(removed).toHaveBeenCalledTimes(1);
        expect(reserved).toHaveBeenCalledTimes(1);
        expect(quantityChanged).not.toHaveBeenCalled();
        expect(state.getSaveAdmission().epoch).toBe(epoch);
        const loaded = reopen();
        expect(loaded.get('creature.hatchTransaction')).toEqual(result.transaction);
        expect(loaded.get('inventory.items').map(item => item.slot)).toEqual([0, 1]);
        expect(loaded.get('creatures')).toEqual(before.creatures);
        expect(loaded.get('creature.genes')).toEqual(before.creature.genes);
        expect(reserve()).toMatchObject({ success: false });
        expect(primary()).toBe(JSON.stringify(loaded.createSaveSnapshot()));
    });

    test.each(['QuotaExceededError', 'Error'])('%s before the primary write cannot consume an egg or report success', name => {
        const before = primary(), memory = JSON.stringify(state.get());
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey) { const error = Error('fictional write refusal'); error.name = name; throw error; }
            return write.call(this, key, value);
        });
        expect(reserve().success).toBe(false);
        expect(primary()).toBe(before);
        expect(JSON.stringify(state.get())).toBe(memory);
        expect(inventory.getAllItems()).toEqual(state.get('inventory.items'));
        expect(reserved).not.toHaveBeenCalled();
        expect(removed).not.toHaveBeenCalled();
        jest.restoreAllMocks();
        expect(reserve().success).toBe(true);
        expect(reopen().get('creature.hatchTransaction.eggItemId')).toBe('fictional-egg');
    });

    test.each(['memory', 'held', 'live-mutation', 'restarted-mutation', 'damaged-journal'])('refuses %s without changing inventory, identity or stored bytes', mode => {
        if (mode === 'memory') state.storageMode = 'memory';
        if (mode === 'held') state.holdSaveAdmission({ code: 'version_mismatch' }, 'fictional');
        if (mode.includes('mutation') || mode === 'damaged-journal') {
            state.beginCloudWrite('mutation', state.createSaveSnapshot(), () => true);
            if (mode === 'restarted-mutation') {
                state = new GameStateManager();
                ({ inventory, sceneWindow } = inventoryFor(state));
            }
            if (mode === 'damaged-journal') localStorage.setItem(state.saveBackupIndexKey, '{broken');
        }
        const before = bytes(), memory = JSON.stringify(state.get());
        expect(reserve().success).toBe(false);
        expect(bytes()).toEqual(before);
        expect(JSON.stringify(state.get())).toBe(memory);
        expect(reserved).not.toHaveBeenCalled();
        expect(removed).not.toHaveBeenCalled();
    });

    test('retained confirmed cloud history does not block a normal hatch', () => {
        const lease = state.beginCloudWrite('upload', state.createSaveSnapshot(), () => true);
        state.finishCloudWrite(lease);
        expect(state.getCloudRecoveryStatus().pending).toBe(false);
        expect(reserve().success).toBe(true);
        expect(reopen().get('inventory.items')).toHaveLength(2);
    });

    test('a queued boss reward can use the freed slot without cancelling the durable hatch', () => {
        state.set('inventory.pendingBossRewards', [{ id: 'fictional-reward', type: 'powerup', name: 'Fictional reward' }]);
        expect(state.save()).toBe(true);
        const result = reserve();
        expect(result.success).toBe(true);
        const loaded = reopen();
        expect(loaded.get('creature.hatchTransaction')).toEqual(result.transaction);
        expect(loaded.get('inventory.pendingBossRewards')).toEqual([]);
        expect(loaded.get('inventory.items').map(item => item.id)).toEqual([
            'fictional-food', 'fictional-tool', 'fictional-reward'
        ]);
    });

    test('reserving one egg from a legacy quantity preserves the other egg', () => {
        state.get('inventory.items')[1].quantity = 2;
        expect(state.save()).toBe(true);
        expect(reserve().success).toBe(true);
        expect(reopen().get('inventory.items.1.quantity')).toBe(1);
        expect(quantityChanged).toHaveBeenCalledTimes(1);
        expect(removed).not.toHaveBeenCalled();
    });

    test('a primary write that commits then throws is accepted only after exact read-back', () => {
        const write = Storage.prototype.setItem;
        const primaryWrites = [];
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            write.call(this, key, value);
            if (key === state.saveKey) { primaryWrites.push(value); throw Error('fictional lost acknowledgement'); }
        });
        expect(reserve().success).toBe(true);
        expect(primaryWrites).toHaveLength(1);
        expect(primary()).toBe(primaryWrites[0]);
        jest.restoreAllMocks();
        expect(reopen().get('creature.hatchTransaction.eggItemId')).toBe('fictional-egg');
    });

    test.each(['changed', 'unreadable'])('a %s primary result holds without rolling back or reporting success', outcome => {
        const write = Storage.prototype.setItem;
        const read = Storage.prototype.getItem;
        let attempted = false;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey) {
                attempted = true;
                return write.call(this, key, outcome === 'changed' ? '{fictional-unverifiable' : value);
            }
            return write.call(this, key, value);
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (attempted && outcome === 'unreadable' && key === state.saveKey) throw Error('fictional unreadable result');
            return read.call(this, key);
        });
        expect(reserve().success).toBe(false);
        expect(state.getSaveAdmission().status).toBe('held');
        expect(reserved).not.toHaveBeenCalled();
        jest.restoreAllMocks();
        expect(primary()).not.toBeNull();
        expect(state.get('creature.hatchTransaction')).toBeNull();
        expect(state.get('inventory.items')).toHaveLength(3);
    });

    test('a backup allocation refusal cannot publish the staged reservation', () => {
        const before = primary(), memory = JSON.stringify(state.get());
        jest.spyOn(state, 'createLocalSaveBackup').mockReturnValue(null);
        expect(reserve().success).toBe(false);
        expect(primary()).toBe(before);
        expect(JSON.stringify(state.get())).toBe(memory);
        expect(reserved).not.toHaveBeenCalled();
    });

    test.each([-1, 0.5, 7])('refuses invalid slot %s without changing either representation', slot => {
        const before = primary(), memory = JSON.stringify(state.get());
        expect(inventory.reserveEggForHatching(slot).success).toBe(false);
        expect(primary()).toBe(before);
        expect(JSON.stringify(state.get())).toBe(memory);
    });

    test('a stale displayed egg cannot reserve a different egg that now occupies its slot', () => {
        const items = JSON.parse(JSON.stringify(state.get('inventory.items')));
        items[1].id = 'fictional-other-egg';
        state.set('inventory.items', items);
        expect(state.save()).toBe(true);
        const before = primary();
        expect(reserve().success).toBe(false);
        expect(primary()).toBe(before);
        expect(state.get('creature.hatchTransaction')).toBeNull();
    });

    test('a real client cloud owner change in a save listener retains the reservation but cannot launch it', () => {
        let changeOwner;
        const cloud = new CloudSaveManager({ gameState: state, storage: localStorage, lockManager: null,
            client: { auth: { onAuthStateChange: callback => {
                changeOwner = () => callback('SIGNED_IN', { user: { id: 'fictional-second-owner' } });
                return { data: { subscription: { unsubscribe() {} } } };
            } } } });
        cloud.currentUser = { id: 'fictional-first-owner' };
        sceneWindow.CloudSave = cloud;
        const off = state.on('saved', changeOwner);
        try {
            expect(reserve().success).toBe(false);
            expect(reserved).not.toHaveBeenCalled();
            expect(reopen().get('creature.hatchTransaction.eggItemId')).toBe('fictional-egg');
        } finally { off(); cloud.destroy(); }
    });

    test('owner retirement during a queued reward notification also cancels transition without undoing the reservation', () => {
        state.set('inventory.pendingBossRewards', [{ id: 'fictional-reward', type: 'powerup', name: 'Fictional reward' }]);
        expect(state.save()).toBe(true);
        let current = true;
        sceneWindow.CloudSave = { captureCampaignGuard: () => () => current };
        inventory.once('bossRewardsClaimed', () => { current = false; });
        expect(reserve().success).toBe(false);
        expect(reopen().get('creature.hatchTransaction.eggItemId')).toBe('fictional-egg');
        expect(reopen().get('inventory.pendingBossRewards')).toEqual([]);
    });

    test.each(['new-game', 'new-progress', 'new-cloud-write'])('a %s during backup notification retires the reservation before its write', change => {
        let interveningRaw;
        const off = state.on('saveBackupCreated', () => {
            off();
            if (change === 'new-game') state.startFreshGame();
            if (change === 'new-progress') { state.set('player.cosmicCoins', 77); state.save(); }
            if (change === 'new-cloud-write') state.beginCloudWrite('mutation', state.createSaveSnapshot(), () => true);
            interveningRaw = primary();
        });
        expect(reserve().success).toBe(false);
        expect(primary()).toBe(interveningRaw);
        expect(state.get('creature.hatchTransaction')).toBeNull();
        expect(reserved).not.toHaveBeenCalled();
        expect(removed).not.toHaveBeenCalled();
    });

    test.each(['saved', 'itemRemoved'])('a New Game from %s retires success without restoring the previous egg over it', event => {
        const reset = () => state.startFreshGame();
        if (event === 'saved') {
            const off = state.on('saved', () => { off(); reset(); });
        } else inventory.once('itemRemoved', reset);
        expect(reserve().success).toBe(false);
        expect(state.get('creature.hatchTransaction')).toBeNull();
        expect(reopen().get('creature.hatchTransaction')).toBeNull();
        expect(reserved).not.toHaveBeenCalled();
    });

    test('an account/campaign change during an item callback cannot launch the old reservation', () => {
        let current = true;
        sceneWindow.CloudSave = { captureCampaignGuard: () => () => current };
        inventory.once('itemRemoved', () => { current = false; });
        expect(reserve().success).toBe(false);
        expect(reserved).not.toHaveBeenCalled();
        expect(reopen().get('creature.hatchTransaction.eggItemId')).toBe('fictional-egg');
        expect(reopen().get('inventory.items')).toHaveLength(2);
    });
});

describe('inventory confirmation observes the reservation result, not just a pending flag', () => {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/InventoryScene.js'), 'utf8');
    const ast = parse(source, { sourceType: 'module' });
    let handler;
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'VariableDeclarator' && node.id?.name === 'handleHatch') handler = node.init;
        Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(visit) : visit(value));
    };
    visit(ast.program);
    test('a refused save does not launch even if an older reservation flag is present', () => {
        const scene = { selectedSlot: 1, showMessage: jest.fn(), showSanctuaryHatchTransition: jest.fn() };
        const destroy = jest.fn();
        const sceneWindow = {
            GameState: { get: () => ({ status: 'reserved', eggType: 'stellar' }) },
            InventoryManager: { reserveEggForHatching: () => ({ success: false, reason: 'hatch_save_unavailable' }) }
        };
        const setup = vm.runInNewContext(`(function () {
            let hatchTriggered = false;
            const click = ${source.slice(handler.start, handler.end)};
            return { click, triggered: () => hatchTriggered };
        })`, { window: sceneWindow, item: { eggType: 'stellar' }, dialogElements: [{ destroy }], console });
        const control = setup.call(scene);
        control.click();
        expect(scene.showSanctuaryHatchTransition).not.toHaveBeenCalled();
        expect(destroy).not.toHaveBeenCalled();
        expect(scene.showMessage).toHaveBeenCalledWith(expect.stringContaining('Hatching is paused'), 0xFF6B6B);
        expect(control.triggered()).toBe(false);
    });
});
