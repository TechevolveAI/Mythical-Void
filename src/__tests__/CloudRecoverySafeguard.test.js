const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

function cloudFor(gameState) {
    localStorage.setItem('mythical_void_age_group', 'age_18_plus');
    localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
    let changeOwner;
    const client = {
        auth: {
            getSession: jest.fn(async () => ({ data: { session: { user: { id: 'fictional-owner' } } } })),
            signInAnonymously: jest.fn(),
            onAuthStateChange: jest.fn(callback => {
                changeOwner = user => callback('SIGNED_IN', { user });
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            })
        },
        from: jest.fn(),
        rpc: jest.fn(async () => ({ data: { revision: 1 }, error: null }))
    };
    const cloud = new CloudSaveManager({ client, gameState, storage: localStorage, lockManager: null });
    cloud.currentUser = { id: 'fictional-owner' };
    return { cloud, client, changeOwner };
}

describe('restart-safe cloud write safeguard with real save owners and fictional services', () => {
    let manager, cloud;
    const bytes = () => ({ ...localStorage });
    const active = () => localStorage.getItem(manager.saveKey);
    const copies = () => manager.getLocalSaveBackups().map(entry => JSON.parse(
        localStorage.getItem(`${manager.saveBackupKeyPrefix}${entry.id}`)
    ));
    const start = () => {
        const fixture = cloudFor(manager);
        cloud = fixture.cloud;
        return fixture;
    };
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(1700000000777);
        localStorage.clear();
        manager = new GameStateManager();
        manager.set('player.cosmicCoins', 0);
        expect(manager.save()).toBe(true);
    });
    afterEach(() => {
        cloud?.destroy();
        manager.stopAutoSave();
        jest.restoreAllMocks();
        jest.useRealTimers();
        document.body.replaceChildren();
    });

    test('dispatch observes a verified indexed reservation; current result commits before confirmation', async () => {
        start();
        const snapshot = manager.createSaveSnapshot();
        const result = { ...snapshot, player: { ...snapshot.player, cosmicCoins: 12 } };
        const callback = jest.fn(async () => {
            const { pending } = manager.inspectCloudRecovery();
            expect(pending).toHaveLength(1);
            expect(pending[0].reason).toBe('cloud_write_pending_mutation');
            expect(JSON.parse(pending[0].payload)).toEqual(snapshot);
            return { gameState: result, revision: 1 };
        });
        const finish = manager.finishCloudWrite.bind(manager);
        jest.spyOn(manager, 'finishCloudWrite').mockImplementation(lease => {
            expect(JSON.parse(active()).player.cosmicCoins).toBe(12);
            return finish(lease);
        });
        await cloud.performServerMutation(callback);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(cloud.getStatus()).toMatchObject({ status: 'synced', remoteWriteUncertain: false });
        expect(manager.inspectCloudRecovery().pending).toHaveLength(0);
        expect(copies().some(copy => copy.reason === 'cloud_write_confirmed')).toBe(true);
        const reopened = new GameStateManager();
        expect(reopened.load()).toBe(true);
        expect(reopened.get('player.cosmicCoins')).toBe(12);
    });

    test('delayed full-state result never replaces newer progress or its queue, including after reload', async () => {
        start();
        const old = manager.createSaveSnapshot();
        cloud.queueUpload(old);
        const reply = deferred();
        const operation = cloud.performServerMutation(() => reply.promise);
        await settle();
        jest.advanceTimersByTime(30000);
        manager.set('player.cosmicCoins', 77);
        expect(manager.save()).toBe(true);
        const newest = manager.createSaveSnapshot();
        cloud.queueUpload(newest);
        const newestRaw = active();
        reply.resolve({ gameState: old, revision: 2 });
        await expect(operation).rejects.toThrow('Newer local progress');
        expect(active()).toBe(newestRaw);
        expect(manager.get('player.cosmicCoins')).toBe(77);
        expect(cloud.pendingSave).toEqual(newest);
        expect(copies().some(copy => copy.reason === 'cloud_write_result' &&
            JSON.parse(copy.payload).player.cosmicCoins === 0)).toBe(true);
        expect(cloud.getStatus()).toMatchObject({ status: 'save_protected', remoteWriteUncertain: true,
            lastSyncedAt: null, lastSyncDirection: null });
        for (let i = 0; i < 3; i++) {
            const before = bytes();
            const next = new GameStateManager();
            expect(next.init()).toBe(false);
            expect(next.save()).toBe(false);
            expect(() => next.startFreshGame()).toThrow();
            expect(() => next.reset()).toThrow();
            for (const copy of next.getLocalSaveBackups()) expect(next.restoreLocalSaveBackup(copy.id)).toBe(false);
            expect(bytes()).toEqual(before);
        }
    });

    test('lost reply preserves latest queue and durable uncertainty; startup dispatches no auth, read or replay', async () => {
        const { client } = start();
        const old = manager.createSaveSnapshot();
        cloud.queueUpload(old);
        const reply = deferred();
        const callback = jest.fn(() => reply.promise);
        const operation = cloud.performServerMutation(callback);
        await settle();
        jest.advanceTimersByTime(30000);
        manager.set('player.cosmicCoins', 77);
        expect(manager.save()).toBe(true);
        const newest = manager.createSaveSnapshot();
        cloud.queueUpload(newest);
        reply.reject(new Error('fictional lost reply'));
        await expect(operation).rejects.toThrow('fictional lost reply');
        expect(cloud.pendingSave).toEqual(newest);
        const before = bytes();
        await cloud.synchronize(); await cloud.flush();
        await expect(cloud.performServerMutation(callback)).rejects.toThrow();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(client.rpc).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalled();
        const next = new GameStateManager();
        const restarted = cloudFor(next);
        expect(next.load()).toBe(false);
        await restarted.cloud.initialize();
        expect(restarted.cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, saveProtected: true });
        expect(restarted.client.auth.getSession).not.toHaveBeenCalled();
        expect(restarted.client.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(restarted.client.from).not.toHaveBeenCalled();
        expect(restarted.client.rpc).not.toHaveBeenCalled();
        expect(bytes()).toEqual(before);
        restarted.cloud.destroy();
    });

    test.each(['envelope', 'index', 'verification'])('reservation %s failure dispatches zero callbacks and retains active/original protected copies', async boundary => {
        const protectedSave = { ...manager.createSaveSnapshot(), version: '2.0.0' };
        const protectedCopy = manager.createLocalSaveBackup(protectedSave);
        const protectedKey = `${manager.saveBackupKeyPrefix}${protectedCopy.id}`;
        const protectedRaw = localStorage.getItem(protectedKey);
        const raw = active();
        start();
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (boundary === 'envelope' && String(value).includes('cloud_write_pending_mutation') && key !== manager.saveBackupIndexKey) throw Error('fictional quota');
            if (boundary === 'index' && key === manager.saveBackupIndexKey) throw Error('fictional index failure');
            if (boundary === 'verification' && key === manager.saveBackupIndexKey) return;
            return set.call(this, key, value);
        });
        const callback = jest.fn();
        await expect(cloud.performServerMutation(callback)).rejects.toThrow();
        expect(callback).not.toHaveBeenCalled();
        expect(active()).toBe(raw);
        expect(localStorage.getItem(protectedKey)).toBe(protectedRaw);
        if (boundary !== 'envelope') {
            const reopened = new GameStateManager();
            expect(reopened.load()).toBe(false);
            expect(reopened.getCloudRecoveryStatus()).toMatchObject({ pending: true, damaged: true });
        }
    });

    test('two protected originals prevent dispatch because returned-result capacity must be reserved too', async () => {
        for (let i = 0; i < 2; i++) manager.createLocalSaveBackup({ ...manager.createSaveSnapshot(), version: '2.0.0', savedAt: i });
        start();
        const before = bytes();
        const callback = jest.fn();
        await expect(cloud.performServerMutation(callback)).rejects.toThrow('Protected recovery copies');
        expect(callback).not.toHaveBeenCalled();
        expect(bytes()).toEqual(before);
    });

    test('one protected original plus unsaved progress and a returned state reports limited evidence, never complete retention', async () => {
        const protectedCopy = manager.createLocalSaveBackup({ ...manager.createSaveSnapshot(), version: '2.0.0' });
        const originalKey = `${manager.saveBackupKeyPrefix}${protectedCopy.id}`;
        const originalRaw = localStorage.getItem(originalKey);
        const raw = active();
        start();
        const reply = deferred();
        const remote = manager.createSaveSnapshot();
        remote.player.cosmicCoins = 12;
        const operation = cloud.performServerMutation(() => reply.promise);
        await settle();
        manager.set('player.cosmicCoins', 77); // Deliberately no save before the reply.
        reply.resolve({ gameState: remote, revision: 1 });
        await expect(operation).rejects.toThrow('Newer local progress');
        expect(active()).toBe(raw);
        expect(localStorage.getItem(originalKey)).toBe(originalRaw);
        expect(copies().some(copy => copy.reason === 'cloud_write_local' && JSON.parse(copy.payload).player.cosmicCoins === 77)).toBe(true);
        expect(copies().some(copy => copy.reason === 'cloud_write_result')).toBe(false);
        expect(manager.getCloudRecoveryStatus()).toMatchObject({ pending: true, evidenceLimited: true });
        expect(manager.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'cloud_recovery_evidence_limited' });
        expect(new GameStateManager().load()).toBe(false);
    });

    test('unsaved local and returned versions both fit and remain protected when three slots are available', async () => {
        start();
        const reply = deferred();
        const remote = manager.createSaveSnapshot();
        remote.player.cosmicCoins = 12;
        const operation = cloud.performServerMutation(() => reply.promise);
        await settle();
        manager.set('player.cosmicCoins', 77);
        reply.resolve({ gameState: remote, revision: 1 });
        await expect(operation).rejects.toThrow();
        expect(copies().filter(copy => copy.reason.startsWith('cloud_write_'))).toHaveLength(3);
        expect(copies().some(copy => copy.reason === 'cloud_write_local' && JSON.parse(copy.payload).player.cosmicCoins === 77)).toBe(true);
        expect(copies().some(copy => copy.reason === 'cloud_write_result' && JSON.parse(copy.payload).player.cosmicCoins === 12)).toBe(true);
        expect(manager.getCloudRecoveryStatus()).toMatchObject({ pending: true, evidenceLimited: false });
    });

    test('quota during constructor storage probing cannot hide a prior reservation on load', () => {
        manager.beginCloudWrite('mutation', manager.createSaveSnapshot());
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === '__storage_test__') throw new DOMException('fictional quota', 'QuotaExceededError');
            return set.call(this, key, value);
        });
        const next = new GameStateManager();
        expect(next.storageMode).toBe('memory');
        expect(next.init()).toBe(false);
        expect(next.getSaveAdmission().status).toBe('held');
    });

    test('an authoritative CAS rejection confirms no upload, unlike an uncertain transport error', async () => {
        const { client } = start();
        client.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'save_revision_conflict',
            details: JSON.stringify({ expectedRevision: 1, currentRevision: 2 }) } });
        await expect(cloud.upload(manager.createSaveSnapshot(), 1)).rejects.toMatchObject({ code: '40001' });
        expect(manager.getSaveAdmission().status).toBe('ready');
        expect(manager.inspectCloudRecovery().pending).toHaveLength(0);
        expect(new GameStateManager().load()).toBe(true);
        expect(cloud.getStatus().remoteWriteUncertain).toBe(false);
    });

    test.each([
        ['transport text', { code: 'FETCH_ERROR', message: 'fictional uncertain transport: save_revision_conflict' }],
        ['name only', { name: 'CloudSaveRevisionConflictError', message: 'fictional uncertain transport' }],
        ['code without details', { code: '40001', message: 'save_revision_conflict' }],
        ['unparseable details', { code: '40001', message: 'save_revision_conflict', details: '{' }],
        ['wrong request revision', { code: '40001', message: 'save_revision_conflict', details: '{"expectedRevision":9,"currentRevision":10}' }],
        ['wrong message', { code: '40001', message: 'fictional save_revision_conflict', details: '{"expectedRevision":0,"currentRevision":1}' }],
        ['invalid current revision', { code: '40001', message: 'save_revision_conflict', details: '{"expectedRevision":0,"currentRevision":-1}' }]
    ])('a returned %s is not authoritative non-commit evidence', async (_name, error) => {
        const { client } = start();
        client.rpc.mockResolvedValue({ data: null, error });
        const raw = active();
        await expect(cloud.upload(manager.createSaveSnapshot())).rejects.toEqual(error);
        expect(active()).toBe(raw);
        expect(manager.inspectCloudRecovery().pending.some(copy => copy.reason === 'cloud_write_pending_upload')).toBe(true);
        expect(cloud.getStatus().remoteWriteUncertain).toBe(true);
        expect(new GameStateManager().load()).toBe(false);
    });

    test('even a structurally matching thrown error is uncertain without a returned RPC rejection', async () => {
        const { client } = start();
        const error = { code: '40001', message: 'save_revision_conflict', details: '{"expectedRevision":0,"currentRevision":1}' };
        client.rpc.mockRejectedValue(error);
        await expect(cloud.upload(manager.createSaveSnapshot())).rejects.toEqual(error);
        expect(cloud.getStatus().remoteWriteUncertain).toBe(true);
        expect(new GameStateManager().load()).toBe(false);
    });

    test.each(['missing-index', 'corrupt-index', 'missing-envelope', 'corrupt-envelope', 'reason-mismatch'])('%s cannot hide an uncertain mutation or permit a new game', async fault => {
        start();
        const reply = deferred();
        const operation = cloud.performServerMutation(() => reply.promise);
        await settle();
        const copy = manager.inspectCloudRecovery().pending[0];
        const key = `${manager.saveBackupKeyPrefix}${copy.id}`;
        if (fault === 'missing-index') localStorage.removeItem(manager.saveBackupIndexKey);
        if (fault === 'corrupt-index') localStorage.setItem(manager.saveBackupIndexKey, '{');
        if (fault === 'missing-envelope') localStorage.removeItem(key);
        if (fault === 'corrupt-envelope') localStorage.setItem(key, '{');
        if (fault === 'reason-mismatch') localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), reason: 'cloud_write_confirmed' }));
        const before = bytes();
        const next = new GameStateManager();
        expect(next.load()).toBe(false);
        expect(next.save()).toBe(false);
        expect(() => next.startFreshGame()).toThrow();
        expect(next.getLocalSaveBackups()).toEqual([]);
        expect(bytes()).toEqual(before);
        reply.reject(new Error('fictional interrupted reply'));
        await expect(operation).rejects.toThrow();
        expect(active()).toBe(before[manager.saveKey]);
    });

    test.each(['envelope', 'index', 'active'])('failure at %s confirmation/commit boundary never clears protection', async fault => {
        start();
        const raw = active();
        const result = manager.createSaveSnapshot();
        result.player.cosmicCoins = 12;
        const callback = async () => {
            const set = Storage.prototype.setItem;
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                if (fault === 'active' && key === manager.saveKey) throw Error('fictional active failure');
                if (fault === 'envelope' && String(value).includes('cloud_write_confirmed') && key !== manager.saveBackupIndexKey) throw Error('fictional confirmation failure');
                if (fault === 'index' && key === manager.saveBackupIndexKey && String(value).includes('cloud_write_confirmed')) throw Error('fictional confirmation index failure');
                return set.call(this, key, value);
            });
            return { gameState: result, revision: 1 };
        };
        await expect(cloud.performServerMutation(callback)).rejects.toThrow();
        expect(cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null });
        expect(new GameStateManager().load()).toBe(false);
        if (fault === 'active') expect(active()).toBe(raw);
        else expect(JSON.parse(active()).player.cosmicCoins).toBe(12);
    });

    test.each(['owner', 'dispose', 'external-hold'])('%s fences a returned result and preserves the durable marker', async cause => {
        const { changeOwner } = start();
        const reply = deferred();
        const result = manager.createSaveSnapshot();
        result.player.cosmicCoins = 12;
        const operation = cloud.performServerMutation(() => reply.promise);
        await settle();
        const raw = active();
        if (cause === 'owner') changeOwner({ id: 'other-fictional-owner' });
        if (cause === 'dispose') cloud.destroy();
        if (cause === 'external-hold') manager.holdSaveAdmission(new Error('fictional hold'));
        reply.resolve({ gameState: result, revision: 1 });
        await expect(operation).rejects.toThrow();
        expect(active()).toBe(raw);
        expect(cloud.getStatus().remoteWriteUncertain).toBe(true);
        expect(new GameStateManager().load()).toBe(false);
    });

    test('two concurrent callbacks and a second save owner cannot dispatch through the same reservation', async () => {
        start();
        const reply = deferred();
        const first = cloud.performServerMutation(() => reply.promise);
        await settle();
        const secondCallback = jest.fn();
        await expect(cloud.performServerMutation(secondCallback)).rejects.toThrow('already in progress');
        const other = new GameStateManager();
        const otherCloud = cloudFor(other);
        await expect(otherCloud.cloud.performServerMutation(secondCallback)).rejects.toThrow();
        expect(secondCallback).not.toHaveBeenCalled();
        expect(() => manager.startFreshGame()).toThrow();
        expect(() => manager.reset()).toThrow();
        reply.resolve({ gameState: manager.createSaveSnapshot(), revision: 1 });
        await first;
        otherCloud.cloud.destroy();
    });

    test('ordinary upload also retains a restart hold when its reply is lost', async () => {
        const { client } = start();
        client.rpc.mockRejectedValue(new Error('fictional lost upload reply'));
        const raw = active();
        await expect(cloud.upload(manager.createSaveSnapshot())).rejects.toThrow('fictional lost upload reply');
        expect(client.rpc).toHaveBeenCalledTimes(1);
        expect(active()).toBe(raw);
        expect(new GameStateManager().load()).toBe(false);
        await cloud.synchronize(); await cloud.flush();
        expect(client.from).not.toHaveBeenCalled();
        expect(client.rpc).toHaveBeenCalledTimes(1);
    });

    test.each(['mutation', 'upload'])('a %s reply cannot acknowledge or replace bytes changed by another writer', async kind => {
        const { client } = start();
        const reply = deferred();
        if (kind === 'upload') client.rpc.mockReturnValue(reply.promise);
        const snapshot = manager.createSaveSnapshot();
        const operation = kind === 'upload' ? cloud.upload(snapshot)
            : cloud.performServerMutation(() => reply.promise);
        await settle();
        const other = JSON.parse(active());
        other.player.cosmicCoins = 77;
        const otherRaw = JSON.stringify(other);
        localStorage.setItem(manager.saveKey, otherRaw); // Emulates a legacy writer ignoring the marker.
        reply.resolve(kind === 'upload' ? { data: { revision: 1 }, error: null }
            : { gameState: snapshot, revision: 1 });
        await expect(operation).rejects.toThrow();
        expect(active()).toBe(otherRaw);
        expect(cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null });
        expect(new GameStateManager().load()).toBe(false);
    });

    test.each(['mutation', 'upload'])('reservation notifications cannot dispatch a stale %s snapshot', async kind => {
        const { client } = start();
        const off = manager.on('saveBackupCreated', copy => {
            if (copy.reason === `cloud_write_pending_${kind}`) manager.set('player.cosmicCoins', 77);
        });
        const callback = jest.fn();
        const snapshot = manager.createSaveSnapshot();
        const operation = kind === 'mutation' ? cloud.performServerMutation(callback) : cloud.upload(snapshot);
        await expect(operation).rejects.toThrow('before cloud dispatch');
        expect(callback).not.toHaveBeenCalled();
        expect(client.rpc).not.toHaveBeenCalled();
        expect(manager.get('player.cosmicCoins')).toBe(77);
        expect(manager.getSaveAdmission().status).toBe('held');
        off();
    });

    test('the held dialog cannot offer local replacement as proof of a cloud result or leak raw evidence', () => {
        manager.beginCloudWrite('mutation', manager.createSaveSnapshot());
        manager.protectCloudWrite(manager.cloudWriteLease);
        const mod = { exports: {} };
        const source = fs.readFileSync(path.join(__dirname, '../ui/SaveRecoveryGate.js'), 'utf8');
        vm.runInNewContext(source.replace('export default class', 'module.exports = class'), { module: mod, document, window, Date, Promise });
        const reload = jest.fn();
        const gate = new mod.exports(manager, { document, pause: jest.fn(), reload });
        expect(document.querySelector('[role="dialog"]').textContent).toContain('has not been confirmed');
        expect(document.querySelectorAll('button')).toHaveLength(1);
        expect(document.querySelector('select')).toBeNull();
        document.querySelector('button').click();
        expect(reload).not.toHaveBeenCalled();
        expect(manager.getSaveAdmission().status).toBe('held');
        expect(document.body.textContent).not.toContain('fictional-owner');
        expect(document.body.textContent).not.toContain('cosmicCoins');
        gate.destroy();
    });
});
