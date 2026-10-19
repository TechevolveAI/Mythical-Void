const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const gateSource = fs.readFileSync(path.join(__dirname, '../ui/SaveRecoveryGate.js'), 'utf8');
const gateModule = { exports: {} };
vm.runInNewContext(gateSource.replace('export default class', 'module.exports = class'), {
    module: gateModule, document, window, Date, Promise
});
const SaveRecoveryGate = gateModule.exports;
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const unsupported = (manager, kind) => {
    const data = manager.createInitialState();
    if (kind === 'future') data.version = '2.0.0';
    else if (kind === 'local-history') data.breedingShrine.completedOperationIds = Array.from(
        { length: 51 }, (_, i) => `fusion_synthetic_${i}`
    );
    else data.breedingShrine.sharedFusion.completedOperationIds = Array.from(
        { length: 26 }, (_, i) => `fusion_shared_synthetic_${i}`
    );
    return JSON.stringify(data);
};
const backupPayloads = manager => manager.getLocalSaveBackups().map(entry => JSON.parse(
    localStorage.getItem(`${manager.saveBackupKeyPrefix}${entry.id}`)
).payload);

function cloudFor(gameState, remote = null) {
    localStorage.setItem('mythical_void_age_group', 'age_18_plus');
    localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
    const query = {
        select() { return this; }, eq() { return this; },
        maybeSingle: jest.fn(async () => ({ data: remote, error: null }))
    };
    let changeOwner;
    const client = {
        auth: {
            getSession: jest.fn(async () => ({ data: { session: { user: { id: 'synthetic-owner' } } } })),
            signInAnonymously: jest.fn(),
            onAuthStateChange: jest.fn(callback => {
                changeOwner = callback;
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            })
        },
        from: jest.fn(() => query),
        rpc: jest.fn(async () => ({ data: { revision: 8 }, error: null }))
    };
    const cloud = new CloudSaveManager({ client, gameState, storage: localStorage, lockManager: null });
    return { cloud, client, query, changeOwner: user => changeOwner('SIGNED_IN', { user }) };
}

describe('runtime save admission and protected recovery', () => {
    let manager;
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(1700000000777);
        localStorage.clear();
        manager = new GameStateManager();
    });
    afterEach(() => {
        manager.stopAutoSave();
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.replaceChildren();
    });

    test.each(['future', 'history', 'local-history'])('%s holds before startup, all ordinary writers and reconstruction', kind => {
        const raw = unsupported(manager, kind);
        localStorage.setItem(manager.saveKey, raw);
        const originalState = JSON.stringify(manager.state);
        expect(manager.init()).toBe(false);
        expect(manager.initialized).toBe(false);
        expect(JSON.stringify(manager.state)).toBe(originalState);
        expect(manager.getSaveAdmission().status).toBe('held');
        for (let i = 0; i < 8; i++) {
            jest.advanceTimersByTime(30000);
            expect(manager.save()).toBe(false);
            expect(manager.startAutoSave()).toBe(false);
            expect(manager.createLocalSaveBackup('{}')).toBeNull();
            expect(manager.applyExternalSave(manager.createInitialState())).toBe(false);
            expect(() => manager.reset()).toThrow();
            expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        }
        const next = new GameStateManager();
        expect(next.load()).toBe(false);
        expect(next.save()).toBe(false);
        expect(localStorage.getItem(next.saveKey)).toBe(raw);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('an already captured autosave callback cannot overwrite a newly held save', () => {
        const timer = jest.spyOn(global, 'setInterval');
        manager.startAutoSave();
        const callback = timer.mock.calls[0][0];
        const raw = unsupported(manager, 'future');
        localStorage.setItem(manager.saveKey, raw);
        for (let i = 0; i < 8; i++) {
            jest.advanceTimersByTime(30000);
            callback();
        }
        expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        expect(manager.getLocalSaveBackups()).toHaveLength(0);
    });

    test('the existing fifty-operation local Fusion boundary remains supported without trimming', () => {
        const source = JSON.parse(unsupported(manager, 'local-history'));
        source.breedingShrine.completedOperationIds.pop();
        localStorage.setItem(manager.saveKey, JSON.stringify(source));
        expect(manager.load()).toBe(true);
        expect(manager.save()).toBe(true);
        expect(JSON.parse(localStorage.getItem(manager.saveKey)).breedingShrine.completedOperationIds)
            .toEqual(source.breedingShrine.completedOperationIds);
        expect(manager.getSaveAdmission().status).toBe('ready');
    });

    test.each([
        ['future', true], ['history', true], ['local-history', true],
        ['future', false], ['history', false], ['local-history', false]
    ])('direct %s prepared writes are held before memory or storage replacement (persist=%s)', (kind, persist) => {
        manager.save();
        const raw = localStorage.getItem(manager.saveKey);
        const state = JSON.stringify(manager.state);
        const candidate = JSON.parse(unsupported(manager, kind));
        const prepared = { state: candidate, snapshot: candidate, serialized: JSON.stringify(candidate) };
        expect(() => manager.commitPreparedSave(prepared, { source: 'synthetic_completion', persist })).toThrow();
        expect(JSON.stringify(manager.state)).toBe(state);
        expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        expect(manager.getSaveAdmission().status).toBe('held');
    });

    test.each(['future', 'history', 'local-history'])('%s original remains pinned beyond the ring after deliberate New Game', kind => {
        const raw = unsupported(manager, kind);
        localStorage.setItem(manager.saveKey, raw);
        manager.load();
        expect(manager.startFreshGame()).toBe(true);
        expect(manager.get('game.cloudSavePausedForNewGame')).toBe(true);
        for (let i = 0; i < 8; i++) {
            jest.advanceTimersByTime(30000);
            manager.set('player.cosmicCoins', i);
            expect(manager.save()).toBe(true);
        }
        const next = new GameStateManager();
        expect(next.load()).toBe(true);
        expect(backupPayloads(next)).toContain(raw);
        expect(next.getLocalSaveBackups().length).toBeLessThanOrEqual(3);
    });

    test('backup allocation failure leaves every previous recovery byte intact', () => {
        for (let i = 0; i < 3; i++) manager.createLocalSaveBackup(JSON.stringify({ version: '1.1.0', savedAt: i }));
        const before = { ...localStorage };
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key.startsWith(manager.saveBackupKeyPrefix) && key !== manager.saveBackupIndexKey) throw Error('synthetic storage full');
            return set.call(this, key, value);
        });
        expect(manager.createLocalSaveBackup('{"version":"1.1.0","savedAt":9}')).toBeNull();
        expect({ ...localStorage }).toEqual(before);
    });

    test('all protected slots fail closed rather than evicting evidence for New Game', () => {
        for (let i = 0; i < 3; i++) {
            const raw = JSON.parse(unsupported(manager, 'future'));
            raw.savedAt = i;
            manager.createLocalSaveBackup(JSON.stringify(raw));
        }
        const raw = unsupported(manager, 'history');
        localStorage.setItem(manager.saveKey, raw);
        manager.load();
        const before = { ...localStorage };
        expect(() => manager.startFreshGame()).toThrow();
        expect({ ...localStorage }).toEqual(before);
        expect(manager.getSaveAdmission().status).toBe('held');
    });

    test('explicit compatible backup restore retains the unsupported active bytes', () => {
        const backup = manager.createLocalSaveBackup(JSON.stringify(manager.createInitialState()));
        const raw = unsupported(manager, 'future');
        localStorage.setItem(manager.saveKey, raw);
        manager.load();
        expect(manager.restoreLocalSaveBackup(backup.id)).toBe(true);
        expect(manager.getSaveAdmission().status).toBe('ready');
        expect(backupPayloads(manager)).toContain(raw);
    });

    test.each(['future', 'history', 'local-history'])('%s held locally dispatches no cloud auth, read, upload or mutation', async kind => {
        localStorage.setItem(manager.saveKey, unsupported(manager, kind));
        const { cloud, client } = cloudFor(manager);
        await cloud.initialize();
        cloud.queueUpload(manager.createInitialState());
        await cloud.flush();
        await cloud.upload(manager.createInitialState());
        const mutate = jest.fn();
        await expect(cloud.performServerMutation(mutate)).rejects.toThrow();
        expect(client.auth.getSession).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalled();
        expect(client.rpc).not.toHaveBeenCalled();
        expect(mutate).not.toHaveBeenCalled();
        expect(cloud.getStatus().status).toBe('save_protected');
        cloud.destroy();
    });

    test.each(['future', 'history', 'local-history'])('older remote %s is held before newer local progress can overwrite it', async kind => {
        manager.save();
        const local = localStorage.getItem(manager.saveKey);
        const raw = unsupported(manager, kind);
        const remote = { game_state: JSON.parse(raw), revision: 7, client_saved_at: new Date(1).toISOString() };
        const { cloud, client } = cloudFor(manager, remote);
        await cloud.initialize();
        expect(client.rpc).not.toHaveBeenCalled();
        expect(localStorage.getItem(manager.saveKey)).toBe(local);
        expect(manager.getSaveAdmission()).toEqual(expect.objectContaining({ status: 'held', source: 'cloud' }));
        expect(backupPayloads(manager)).toContain(raw);
        expect(cloud.getStatus().lastSyncDirection).toBeNull();
        cloud.destroy();
    });

    test('delayed auth is fenced before anonymous authentication or upload', async () => {
        const { cloud, client } = cloudFor(manager);
        const auth = deferred();
        client.auth.getSession.mockReturnValue(auth.promise);
        const operation = cloud.initialize();
        await Promise.resolve(); await Promise.resolve();
        manager.holdSaveAdmission(new Error('synthetic hold'));
        auth.resolve({ data: { session: null } });
        await operation;
        expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(client.rpc).not.toHaveBeenCalled();
        expect(cloud.getStatus().status).toBe('save_protected');
        cloud.destroy();
    });

    test('an ordinary save during authentication retires the obsolete upload before dispatch', async () => {
        manager.save();
        const { cloud, client } = cloudFor(manager);
        const auth = deferred();
        client.auth.getSession.mockReturnValue(auth.promise);
        const operation = cloud.upload(manager.createSaveSnapshot());
        manager.set('player.cosmicCoins', 77);
        manager.save();
        auth.resolve({ data: { session: { user: { id: 'synthetic-owner' } } } });
        await operation;
        expect(client.rpc).not.toHaveBeenCalled();
        expect(cloud.getStatus().status).not.toBe('synced');
        expect(manager.get('player.cosmicCoins')).toBe(77);
        cloud.destroy();
    });

    test.each(['hold-recovery', 'owner', 'dispose'])('delayed read is fenced by %s without apply or dispatch', async reason => {
        manager.save();
        const { cloud, client, query, changeOwner } = cloudFor(manager);
        const read = deferred();
        query.maybeSingle.mockReturnValue(read.promise);
        cloud.currentUser = { id: 'synthetic-owner' };
        const operation = cloud.synchronize();
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(query.maybeSingle).toHaveBeenCalled();
        const apply = jest.spyOn(manager, 'applyExternalSave');
        if (reason === 'hold-recovery') {
            manager.holdSaveAdmission(new Error('synthetic hold'));
            manager.load(); // Validated recovery invalidates the old generation even after release.
        } else if (reason === 'owner') changeOwner({ id: 'other-synthetic-owner' });
        else cloud.destroy();
        read.resolve({ data: { game_state: manager.createInitialState(), revision: 7 }, error: null });
        await operation;
        expect(apply).not.toHaveBeenCalled();
        expect(client.rpc).not.toHaveBeenCalled();
        expect(cloud.getStatus().status).not.toBe('synced');
        cloud.destroy();
    });

    test('already dispatched RPC is uncertain, not acknowledged as a recovered game', async () => {
        const { cloud, client } = cloudFor(manager);
        const rpc = deferred();
        client.rpc.mockReturnValue(rpc.promise);
        const operation = cloud.upload(manager.createSaveSnapshot());
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(client.rpc).toHaveBeenCalledTimes(1);
        manager.holdSaveAdmission(new Error('synthetic hold'));
        expect(() => manager.startFreshGame()).toThrow();
        const raw = localStorage.getItem(manager.saveKey);
        rpc.resolve({ data: { revision: 8 }, error: null });
        await operation;
        expect(cloud.getStatus()).toEqual(expect.objectContaining({
            remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null
        }));
        expect(cloud.getStatus().status).not.toBe('synced');
        expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        expect(client.rpc).toHaveBeenCalledTimes(1);
        cloud.destroy();
    });

    test('delayed server mutation cannot apply after a hold and compatible recovery', async () => {
        manager.save();
        const { cloud } = cloudFor(manager);
        const result = deferred();
        const apply = jest.spyOn(manager, 'applyCloudWriteResult');
        const operation = cloud.performServerMutation(() => result.promise);
        for (let i = 0; i < 8; i++) await Promise.resolve();
        manager.holdSaveAdmission(new Error('synthetic hold'));
        expect(manager.load()).toBe(false); // A local reload cannot confirm the dispatched outcome.
        result.resolve({ gameState: manager.createInitialState(), revision: 8 });
        await expect(operation).rejects.toThrow();
        expect(apply).not.toHaveBeenCalled();
        expect(cloud.getStatus().remoteWriteUncertain).toBe(true);
        expect(cloud.pendingSave).toBeNull();
        cloud.destroy();
    });

    test('a newer ordinary save cannot be reported synced by an older RPC reply', async () => {
        manager.save();
        const { cloud, client } = cloudFor(manager);
        const rpc = deferred();
        client.rpc.mockReturnValue(rpc.promise);
        const operation = cloud.upload(manager.createSaveSnapshot());
        for (let i = 0; i < 8; i++) await Promise.resolve();
        manager.set('player.cosmicCoins', 77);
        manager.save();
        rpc.resolve({ data: { revision: 8 }, error: null });
        await operation;
        expect(cloud.getStatus()).toEqual(expect.objectContaining({
            status: 'pending', lastSyncedAt: null, lastSyncDirection: null
        }));
        expect(cloud.remoteRevision).toBe(8);
        expect(manager.get('player.cosmicCoins')).toBe(77);
        cloud.destroy();
    });

    test('a newer save during a read is not replaced or called synced by that older selection', async () => {
        manager.save();
        const { cloud, client, query } = cloudFor(manager);
        cloud.currentUser = { id: 'synthetic-owner' };
        const read = deferred();
        query.maybeSingle.mockReturnValue(read.promise);
        const operation = cloud.synchronize();
        for (let i = 0; i < 8; i++) await Promise.resolve();
        manager.set('player.cosmicCoins', 77);
        manager.save();
        read.resolve({ data: null, error: null });
        await operation;
        expect(client.rpc).not.toHaveBeenCalled();
        expect(cloud.getStatus().status).toBe('pending');
        expect(cloud.getStatus().lastSyncedAt).toBeNull();
        cloud.destroy();
    });

    test('transport uncertainty cannot be cleared by an ordinary sync or compensating upload', async () => {
        manager.save();
        const { cloud, client, query } = cloudFor(manager);
        client.rpc.mockRejectedValueOnce(new Error('synthetic lost reply'));
        await expect(cloud.upload(manager.createSaveSnapshot())).rejects.toThrow('synthetic lost reply');
        await cloud.upload(manager.createSaveSnapshot());
        expect(client.rpc).toHaveBeenCalledTimes(1);
        query.maybeSingle.mockResolvedValue({ data: {
            game_state: manager.createSaveSnapshot(), revision: 8,
            client_saved_at: new Date(manager.get('savedAt')).toISOString()
        }, error: null });
        await cloud.synchronize();
        expect(query.maybeSingle).not.toHaveBeenCalled();
        expect(client.rpc).toHaveBeenCalledTimes(1);
        expect(cloud.getStatus().remoteWriteUncertain).toBe(true);
        expect(new GameStateManager().load()).toBe(false);
        cloud.destroy();
    });

    test('naming reset uses backed-up New Game and cannot bypass an unsupported save', () => {
        const file = fs.readFileSync(path.join(__dirname, '../scenes/NamingScene.js'), 'utf8');
        const mod = { exports: {} }, reload = jest.fn();
        vm.runInNewContext(file.replace(/^import .*;$/gm, '')
            .replace(/import\.meta\.env/g, '({ DEV: false })')
            .replace('export default NamingScene;', 'module.exports = NamingScene;'), {
            module: mod, Phaser: { Scene: class {} },
            window: { GameState: manager, location: { reload } }
        });
        const scene = new mod.exports();
        const raw = unsupported(manager, 'future');
        localStorage.setItem(manager.saveKey, raw);
        expect(scene.resetGameData()).toBe(false);
        expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        expect(reload).not.toHaveBeenCalled();
        manager.startFreshGame();
        expect(scene.resetGameData()).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(backupPayloads(manager)).toContain(raw);
    });

    test('recovery gate keeps the block when confirmation cannot make a safe copy', () => {
        const reload = jest.fn();
        const gate = new SaveRecoveryGate(manager, { document, pause: jest.fn(), reload });
        localStorage.setItem(manager.saveKey, unsupported(manager, 'future'));
        manager.load();
        jest.spyOn(manager, 'createLocalSaveBackup').mockReturnValue(null);
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Start a new game...').click();
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Confirm replacement').click();
        expect(document.querySelector('[role="status"]').textContent).toContain('could not be confirmed safely');
        expect(manager.getSaveAdmission().status).toBe('held');
        expect(reload).not.toHaveBeenCalled();
        gate.destroy();
    });

    test('the actual local gate does not promise unchanged bytes after an unverifiable primary write', () => {
        expect(manager.save()).toBe(true);
        const before = localStorage.getItem(manager.saveKey);
        const staged = JSON.parse(JSON.stringify(manager.state));
        staged.player.cosmicCoins = 77;
        const gate = new SaveRecoveryGate(manager, { document, pause: jest.fn(), reload: jest.fn() });
        const write = Storage.prototype.setItem, read = Storage.prototype.getItem;
        let written = false;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            write.call(this, key, value);
            if (key === manager.saveKey) written = true;
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (written && key === manager.saveKey) throw Error('fictional unreadable acknowledgement');
            return read.call(this, key);
        });
        try {
            expect(manager.commitHatchSaveDraft(staged).success).toBe(false);
            jest.restoreAllMocks();
            expect(localStorage.getItem(manager.saveKey)).not.toBe(before);
            expect(JSON.parse(localStorage.getItem(manager.saveKey)).player.cosmicCoins).toBe(77);
            expect(manager.getSaveAdmission().status).toBe('held');
            expect(document.querySelector('[role="dialog"]').textContent)
                .not.toMatch(/original save has not been replaced|nothing was replaced/i);
            expect(document.querySelector('[role="dialog"]').textContent).toContain('could not be verified');
        } finally { jest.restoreAllMocks(); gate.destroy(); }
    });

    test.each(['retry', 'restore', 'replacement'])('%s failure copy does not infer non-commit from a false result or exception', action => {
        expect(manager.save()).toBe(true);
        expect(manager.createLocalSaveBackup(manager.createSaveSnapshot(), 'before_local_save')).not.toBeNull();
        manager.holdSaveAdmission({ code: 'commit_failed' }, 'local_write');
        const gate = new SaveRecoveryGate(manager, { document, pause: jest.fn(), reload: jest.fn() });
        const altered = manager.createSaveSnapshot(); altered.player.cosmicCoins = 77;
        const writeThenFail = () => {
            localStorage.setItem(manager.saveKey, JSON.stringify(altered));
            if (action === 'replacement') throw Error('fictional unconfirmed replacement');
            return false;
        };
        const click = label => [...document.querySelectorAll('button')].find(button => button.textContent === label).click();
        try {
            if (action === 'retry') {
                jest.spyOn(manager, 'load').mockImplementation(writeThenFail);
                click('Try saved game again');
            } else {
                jest.spyOn(manager, action === 'restore' ? 'restoreLocalSaveBackup' : 'startFreshGame').mockImplementation(writeThenFail);
                click(action === 'restore' ? 'Restore selected copy...' : 'Start a new game...');
                click('Confirm replacement');
            }
            expect(JSON.parse(localStorage.getItem(manager.saveKey)).player.cosmicCoins).toBe(77);
            expect(document.querySelector('[role="status"]').textContent).not.toMatch(/nothing was replaced/i);
            expect(manager.getSaveAdmission().status).toBe('held');
        } finally { gate.destroy(); }
    });

    test('recovery gate blocks play, traps focus and requires explicit replacement confirmation', async () => {
        const pause = jest.fn(), reload = jest.fn();
        const gate = new SaveRecoveryGate(manager, { document, pause, reload });
        const raw = unsupported(manager, 'future');
        localStorage.setItem(manager.saveKey, raw);
        manager.init();
        let ready = false;
        const wait = gate.waitUntilReady().then(() => { ready = true; });
        await Promise.resolve();
        expect(ready).toBe(false);
        expect(pause).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        const buttons = [...document.querySelectorAll('button')];
        const last = buttons[buttons.length - 1];
        last.focus();
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(buttons[0]);
        last.click();
        expect(localStorage.getItem(manager.saveKey)).toBe(raw);
        expect(document.activeElement.textContent).toBe('Keep my saved game');
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Confirm replacement').click();
        await wait;
        expect(ready).toBe(true);
        expect(backupPayloads(manager)).toContain(raw);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        gate.destroy();
    });
});
