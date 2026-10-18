const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const { FusionAuthority } = require('../systems/FusionAuthority.js');

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const adult = id => ({ id, name: id, level: 5, experience: 400,
    stats: { happiness: 100, energy: 100, health: 100 },
    genes: { id: `genes_${id}`, rarity: 'common' },
    lifecycle: { stage: 'adult', birthDate: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    bond: { level: 3, experience: 20 }, generation: 1, parentIds: [] });

// Actual client owners and validation; only transport, session and server data
// are fictional. No backend, browser, game, identity creation or audio is run.
async function fixture(count = 1) {
    const manager = new GameStateManager(), authority = new FusionAuthority();
    globalThis.FusionAuthority = authority;
    manager.set('breedingShrine.unlocked', true);
    manager.set('creature.level', 5);
    const parents = [adult('fictional_parent_alpha'), adult('fictional_parent_beta')];
    manager.set('creatures', parents);
    manager.set('activeCreatureIndex', 0);
    const begun = manager.beginFusionTransaction(parents.map(parent => parent.id), count);
    expect(begun.success).toBe(true);
    const transaction = begun.transaction;
    const request = authority.createRequest({ transaction, parents, expectedSaveRevision: 7 });
    expect(manager.attachFusionAuthorityRequest(transaction.operationId, request).success).toBe(true);
    const reservation = { schemaVersion: 1, operationId: transaction.operationId,
        reservationMode: 'server_reserved', requestFingerprint: request.requestFingerprint,
        serverFingerprint: '0123456789abcdef0123456789abcdef',
        offspringIds: transaction.candidateOffspringIds.slice(0, count), offspringCount: count };
    expect(manager.attachFusionAuthorityReservation(transaction.operationId, reservation).success).toBe(true);
    const executionReceipt = { schemaVersion: 1, operationId: transaction.operationId,
        authority: 'server_generated', requestFingerprint: request.requestFingerprint,
        serverFingerprint: reservation.serverFingerprint,
        resultFingerprint: authority.fingerprint(reservation.offspringIds),
        receiptFingerprint: 'fictional-execution-receipt' };
    const children = reservation.offspringIds.map((id, i) => ({
        id, name: `Fiction ${i + 1}`, level: 1, experience: 0,
        stats: { happiness: 100, energy: 100, health: 100 },
        genes: { id: `genes_${id}`, rarity: 'rare', species: 'hybrid' },
        lifecycle: { stage: 'baby', birthDate: Date.now() }, generation: 2,
        parentIds: parents.map(parent => parent.id), isOffspring: true,
        lineage: { origin: 'fusion', creatureId: id, fusionOperationId: transaction.operationId,
            parentIds: parents.map(parent => parent.id) }
    }));
    expect(manager.attachFusionAuthorityExecution(transaction.operationId, {
        operationId: transaction.operationId, receipt: executionReceipt,
        outcome: { operationId: transaction.operationId,
            offspring: children.map(child => ({ offspringData: { creatureId: child.id } })) }
    }).success).toBe(true);
    const remote = manager.createSaveSnapshot();
    remote.creatures = [...remote.creatures, ...children];
    remote.activeCreatureIndex = 2;
    remote.creature = children[0];
    remote.breedingShrine.pendingFusion = null;
    remote.breedingShrine.completedOperationIds = [transaction.operationId];
    remote.breedingShrine.breedingHistory = [{ operationId: transaction.operationId,
        authority: 'server_generated', offspringIds: reservation.offspringIds }];
    remote.breedingShrine.lastBreedingTime = Date.now();
    const response = { schemaVersion: 1, operationId: transaction.operationId, status: 'committed',
        revision: 8, gameState: remote, offspringIds: reservation.offspringIds,
        receipt: { schemaVersion: 1, operationId: transaction.operationId, authority: 'server_finalized',
            requestFingerprint: request.requestFingerprint, serverFingerprint: reservation.serverFingerprint,
            resultFingerprint: executionReceipt.resultFingerprint, saveRevision: 8, completedAt: Date.now(),
            receiptFingerprint: 'fusion-commit-v1:0123456789abcdef0123456789abcdef' }, replay: false };
    expect(authority.validateServerFinalization(request, reservation, executionReceipt,
        children.map(child => child.name), response)).toBe(true);
    localStorage.setItem('mythical_void_age_group', 'age_18_plus');
    localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
    let changeOwner;
    const query = { select() { return this; }, eq() { return this; },
        maybeSingle: jest.fn(async () => ({ data: { game_state: manager.createSaveSnapshot(), revision: 7 }, error: null })) };
    const client = {
        auth: {
            getSession: jest.fn(async () => ({ data: { session: { user: { id: 'fictional-owner' } } } })),
            signInAnonymously: jest.fn(),
            onAuthStateChange: callback => {
                changeOwner = user => callback('SIGNED_IN', { user });
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            }
        },
        from: jest.fn(() => query), rpc: jest.fn(),
        functions: { invoke: jest.fn(async () => ({ data: response, error: null })) }
    };
    const cloud = new CloudSaveManager({ client, gameState: manager, storage: localStorage, lockManager: null });
    cloud.currentUser = { id: 'fictional-owner' };
    globalThis.CloudSave = cloud;
    await cloud.initialize();
    const completed = jest.fn();
    manager.on('breedingCompleted', completed);
    return { manager, authority, transaction, children, client, cloud, response, completed, changeOwner,
        finish: () => manager.finalizeFusionTransaction(transaction.operationId, children) };
}

describe('authoritative current-client Fusion completion keeps the successful caller alive', () => {
    let previousAuthority, previousCloud;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear();
        previousAuthority = globalThis.FusionAuthority; previousCloud = globalThis.CloudSave;
    });
    afterEach(() => {
        globalThis.CloudSave?.destroy();
        globalThis.FusionAuthority = previousAuthority; globalThis.CloudSave = previousCloud;
        jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
    });

    test.each([1, 2])('a valid %s-child finalization reports success, completes lineage and survives reload', async count => {
        const f = await fixture(count);
        const guard = f.cloud.captureCampaignGuard();
        const result = await f.finish();
        expect(f.client.functions.invoke).toHaveBeenCalledTimes(1);
        expect(f.manager.get('breedingShrine.completedOperationIds')).toContain(f.transaction.operationId);
        expect(f.cloud.getStatus()).toMatchObject({ status: 'synced', remoteWriteUncertain: false });
        expect(result).not.toMatchObject({ cancelled: true, reason: 'campaign_changed' });
        expect(result).toMatchObject({ success: true, authority: 'server_finalized', revision: 8 });
        expect(guard()).toBe(true);
        expect(f.completed).toHaveBeenCalledTimes(1);
        expect(f.completed.mock.calls[0][0].offspring.map(child => child.id)).toEqual(f.children.map(child => child.id));
        expect(f.manager.get('world.sanctuaryDecorations.kinshipBeacon.lineageCount')).toBe(1);
        expect(f.manager.get('breedingShrine.pendingFusion')).toBeNull();
        expect(f.manager.getCreatureCollection().map(creature => creature.id)).toEqual([
            'fictional_parent_alpha', 'fictional_parent_beta', ...f.children.map(child => child.id)
        ]);
        const reopened = new GameStateManager();
        expect(reopened.load()).toBe(true);
        expect(reopened.get('breedingShrine.completedOperationIds')).toEqual([f.transaction.operationId]);
        expect(reopened.get('world.sanctuaryDecorations.kinshipBeacon.lineageCount')).toBe(1);
        expect(f.client.functions.invoke).toHaveBeenCalledTimes(1);
        expect(f.client.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(f.client.rpc).not.toHaveBeenCalled();
    });

    test.each(['owner', 'hold', 'dispose', 'newer-save'])('%s before the reply still retires completion and holds uncertainty', async cause => {
        const f = await fixture();
        const reply = deferred();
        f.client.functions.invoke.mockReturnValue(reply.promise);
        const operation = f.finish();
        await settle();
        expect(f.client.functions.invoke).toHaveBeenCalledTimes(1);
        if (cause === 'owner') f.changeOwner({ id: 'other-fictional-owner' });
        if (cause === 'hold') f.manager.holdSaveAdmission(new Error('fictional hold'));
        if (cause === 'dispose') f.cloud.destroy();
        if (cause === 'newer-save') {
            f.manager.set('player.cosmicCoins', 77);
            expect(f.manager.save()).toBe(true);
        }
        const raw = localStorage.getItem(f.manager.saveKey);
        reply.resolve({ data: f.response, error: null });
        expect(await operation).toMatchObject({ success: false, cancelled: true });
        expect(f.completed).not.toHaveBeenCalled();
        expect(localStorage.getItem(f.manager.saveKey)).toBe(raw);
        expect(f.manager.getCreatureCollection()).toHaveLength(2);
        expect(f.cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null });
        expect(new GameStateManager().load()).toBe(false);
    });

    test.each(['ordinary-import', 'forged-source-import', 'local-restore', 'new-game'])('%s after success still retires the original continuation', async cause => {
        const f = await fixture();
        const guard = f.cloud.captureCampaignGuard();
        expect((await f.finish()).success).toBe(true);
        expect(guard()).toBe(true);
        if (cause === 'new-game') f.manager.startFreshGame();
        else if (cause === 'local-restore') {
            const backup = f.manager.createLocalSaveBackup(f.manager.createSaveSnapshot(), 'fictional_manual_copy');
            expect(f.manager.restoreLocalSaveBackup(backup.id)).toBe(true);
        } else {
            expect(f.manager.applyExternalSave(f.manager.createSaveSnapshot(), {
                source: cause === 'forged-source-import' ? 'cloud_server_mutation' : 'fictional_import',
                cloudWriteLease: { id: 'fictional-forged-lease' }, preserveAdmissionEpoch: true
            })).toBe(true);
        }
        expect(guard()).toBe(false);
        expect(f.client.functions.invoke).toHaveBeenCalledTimes(1);
    });

    test('a copied lease and an import source string cannot enter the owned-commit path', async () => {
        const f = await fixture();
        const reply = deferred();
        f.client.functions.invoke.mockReturnValue(reply.promise);
        const operation = f.finish();
        await settle();
        const lease = f.manager.cloudWriteLease;
        const raw = localStorage.getItem(f.manager.saveKey);
        const prepared = f.manager.prepareSaveCandidate(f.response.gameState);
        expect(() => f.manager.commitPreparedSave(prepared, {
            source: 'cloud_server_mutation', cloudWriteLease: { ...lease }
        })).toThrow('no longer owns');
        expect(f.manager.applyExternalSave(f.response.gameState, {
            source: 'cloud_server_mutation', cloudWriteLease: lease
        })).toBe(false);
        expect(localStorage.getItem(f.manager.saveKey)).toBe(raw);
        reply.resolve({ data: f.response, error: null });
        expect((await operation).success).toBe(true);
    });

    test.each(['active', 'confirmation'])('%s write failure cannot report successful caller continuation', async boundary => {
        const f = await fixture();
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (boundary === 'active' && key === f.manager.saveKey && String(value).includes('"server_generated"')) {
                throw new Error('fictional active save failure');
            }
            if (boundary === 'confirmation' && key === f.manager.saveBackupIndexKey && String(value).includes('cloud_write_confirmed')) {
                throw new Error('fictional confirmation index failure');
            }
            return set.call(this, key, value);
        });
        expect(await f.finish()).toMatchObject({ success: false, cancelled: true });
        expect(f.completed).not.toHaveBeenCalled();
        expect(f.cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null });
        // Applying a result may already have succeeded. That does not confirm the journal.
        expect(f.manager.getCreatureCollection()).toHaveLength(boundary === 'confirmation' ? 3 : 2);
        expect(new GameStateManager().load()).toBe(false);
    });

    test.each(['save', 'raw-bytes', 'owner', 'hold'])('%s during loaded notification cannot receive a false success acknowledgement', async cause => {
        const f = await fixture();
        let raw = null;
        f.manager.on('externalLoaded', ({ source }) => {
            if (source !== 'cloud_server_mutation') return;
            if (cause === 'owner') f.changeOwner({ id: 'other-fictional-owner' });
            if (cause === 'hold') f.manager.holdSaveAdmission(new Error('fictional loaded hold'));
            if (cause === 'save') {
                f.manager.set('player.cosmicCoins', 77);
                expect(f.manager.save()).toBe(true);
            }
            if (cause === 'raw-bytes') {
                const changed = JSON.parse(localStorage.getItem(f.manager.saveKey));
                changed.player.cosmicCoins = 77;
                localStorage.setItem(f.manager.saveKey, JSON.stringify(changed));
            }
            raw = localStorage.getItem(f.manager.saveKey);
        });
        expect(await f.finish()).toMatchObject({ success: false, cancelled: true });
        expect(f.completed).not.toHaveBeenCalled();
        expect(localStorage.getItem(f.manager.saveKey)).toBe(raw);
        expect(f.cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null });
        expect(new GameStateManager().load()).toBe(false);
    });

    test('a genuine import between the successful callee and its caller still cancels that caller', async () => {
        const f = await fixture();
        const finalize = f.authority.finalizeReservedOperation.bind(f.authority);
        jest.spyOn(f.authority, 'finalizeReservedOperation').mockImplementation(async (...args) => {
            const result = await finalize(...args);
            const imported = f.manager.createSaveSnapshot();
            imported.player.cosmicCoins = 77;
            expect(f.manager.applyExternalSave(imported, { source: 'fictional_import' })).toBe(true);
            return result;
        });
        expect(await f.finish()).toMatchObject({ success: false, cancelled: true, reason: 'campaign_changed' });
        expect(f.completed).not.toHaveBeenCalled();
        expect(f.manager.get('player.cosmicCoins')).toBe(77);
        expect(f.cloud.getStatus().status).not.toBe('synced');
        expect(f.client.functions.invoke).toHaveBeenCalledTimes(1);
    });

    test('a read started before finalization cannot replace the newly committed children', async () => {
        const f = await fixture();
        const read = deferred();
        const old = f.manager.createSaveSnapshot();
        f.cloud.fetchRemoteSave = jest.fn(() => read.promise);
        const selection = f.cloud.synchronizeSnapshot(old);
        await settle();
        expect((await f.finish()).success).toBe(true);
        read.resolve({ game_state: old, revision: 7, client_saved_at: new Date(1700000000777).toISOString() });
        await selection;
        expect(f.manager.getCreatureCollection().map(creature => creature.id)).toContain(f.children[0].id);
        expect(f.manager.get('breedingShrine.pendingFusion')).toBeNull();
        expect(f.manager.get('world.sanctuaryDecorations.kinshipBeacon.lineageCount')).toBe(1);
        expect(f.cloud.remoteRevision).toBe(8);
        expect(f.client.rpc).not.toHaveBeenCalled();
    });

    test('the unchanged domain validator still rejects a substituted finalization identity before adoption', async () => {
        const f = await fixture();
        const reply = deferred();
        f.client.functions.invoke.mockReturnValue(reply.promise);
        const operation = f.finish();
        await settle();
        const raw = localStorage.getItem(f.manager.saveKey);
        reply.resolve({ data: { ...f.response, operationId: 'fusion_fictional_other_operation' }, error: null });
        expect(await operation).toMatchObject({ success: false, cancelled: true });
        expect(localStorage.getItem(f.manager.saveKey)).toBe(raw);
        expect(f.manager.getCreatureCollection()).toHaveLength(2);
        expect(f.completed).not.toHaveBeenCalled();
        expect(f.cloud.getStatus().remoteWriteUncertain).toBe(true);
    });

    test('another cloud manager cannot borrow an in-flight save owner for a different session', async () => {
        const f = await fixture();
        const reply = deferred();
        f.client.functions.invoke.mockReturnValue(reply.promise);
        const operation = f.finish();
        await settle();
        const otherClient = { ...f.client,
            auth: { getSession: jest.fn(), signInAnonymously: jest.fn() },
            from: jest.fn(() => { throw new Error('fictional foreign-owner read'); }), rpc: jest.fn() };
        const other = new CloudSaveManager({ client: otherClient, gameState: f.manager, storage: localStorage, lockManager: null });
        other.currentUser = { id: 'other-fictional-owner' };
        try {
            await other.initialize();
            expect(otherClient.from).not.toHaveBeenCalled();
            expect(otherClient.auth.getSession).not.toHaveBeenCalled();
            expect(otherClient.auth.signInAnonymously).not.toHaveBeenCalled();
            expect(otherClient.rpc).not.toHaveBeenCalled();
            expect(f.manager.getSaveAdmission().status).toBe('held');
        } finally {
            reply.resolve({ data: f.response, error: null });
            await operation;
            other.destroy();
        }
    });

    test.each(['save', 'owner', 'hold'])('%s during a non-deduplicated pre-restore backup cannot be overwritten', async cause => {
        const f = await fixture();
        let notified = 0, newestRaw = null;
        f.manager.on('saveBackupCreated', ({ reason }) => {
            if (reason !== 'before_cloud_server_mutation_restore') return;
            notified += 1;
            if (notified !== 1) return;
            if (cause === 'save') {
                f.manager.set('player.cosmicCoins', 77);
                expect(f.manager.save()).toBe(true);
            }
            if (cause === 'owner') f.changeOwner({ id: 'other-fictional-owner' });
            if (cause === 'hold') f.manager.holdSaveAdmission(new Error('fictional backup notification hold'));
            newestRaw = localStorage.getItem(f.manager.saveKey);
        });
        const operation = f.finish();
        // Actual ensureSession await yields before reservation; this unsaved state
        // differs from active bytes, so the safety copy cannot deduplicate to it.
        f.manager.set('player.cosmicCoins', 5);
        const result = await operation;
        expect(notified).toBe(1);
        expect(f.manager.get('player.cosmicCoins')).toBe(cause === 'save' ? 77 : 5);
        expect(localStorage.getItem(f.manager.saveKey)).toBe(newestRaw);
        expect(result).toMatchObject({ success: false, cancelled: true });
        expect(f.completed).not.toHaveBeenCalled();
        expect(f.cloud.getStatus()).toMatchObject({ remoteWriteUncertain: true, lastSyncedAt: null, lastSyncDirection: null });
        expect(new GameStateManager().load()).toBe(false);
    });
});
