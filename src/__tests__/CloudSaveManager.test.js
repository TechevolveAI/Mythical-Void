const CloudSaveManager = require('../systems/CloudSaveManager.js');

function createStorage() {
    const values = new Map();
    values.set('mythical_void_age_group', 'age_18_plus');
    return {
        getItem: jest.fn((key) => values.get(key) ?? null),
        setItem: jest.fn((key, value) => values.set(key, String(value))),
        removeItem: jest.fn((key) => values.delete(key))
    };
}

function createClient(options = {}) {
    const calls = {
        upserts: [],
        deletes: 0
    };

    const builder = {
        select: jest.fn(function select() {
            return this;
        }),
        eq: jest.fn(function eq() {
            return this;
        }),
        maybeSingle: jest.fn(async () => ({
            data: options.remoteSave ?? null,
            error: options.fetchError ?? null
        })),
        upsert: jest.fn(function upsert(payload) {
            calls.upserts.push(payload);
            return this;
        }),
        single: jest.fn(async () => ({
            data: { revision: options.uploadRevision ?? 1, updated_at: '2026-07-26T00:00:00Z' },
            error: options.uploadError ?? null
        })),
        delete: jest.fn(function deleteRow() {
            calls.deletes += 1;
            return this;
        })
    };

    const client = {
        auth: {
            getSession: jest.fn(async () => ({
                data: { session: options.existingSession ?? null },
                error: null
            })),
            signInAnonymously: jest.fn(async () => ({
                data: { user: { id: 'player-1' } },
                error: null
            })),
            signOut: jest.fn(async () => ({ error: null }))
        },
        functions: {
            invoke: jest.fn(async () => ({ data: { deleted: true }, error: null }))
        },
        from: jest.fn(() => builder)
    };

    return { client, builder, calls };
}

function createGameState(savedAt = 1000, persisted = true) {
    return {
        gameVersion: '1.1.0',
        on: jest.fn(() => jest.fn()),
        get: jest.fn(() => ({ version: '1.1.0', savedAt })),
        hasPersistedSave: jest.fn(() => persisted),
        createSaveSnapshot: jest.fn(() => ({
            version: '1.1.0',
            savedAt,
            creature: { name: 'Nova' },
            safety: {
                guardian: { pinHash: 'secret', lastVerified: 123 },
                auditLog: [{ event: 'pin-used' }]
            },
            memory: {
                deletionLog: [{ deletedAt: 123 }]
            },
            session: { currentScene: 'GameScene' }
        })),
        applyExternalSave: jest.fn(() => true)
    };
}

describe('CloudSaveManager', () => {
    test('does not authenticate or upload before explicit opt-in', async () => {
        const storage = createStorage();
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        const status = await manager.initialize();

        expect(status.enabled).toBe(false);
        expect(status.status).toBe('disabled');
        expect(client.auth.getSession).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalled();
    });

    test('enabling cloud saves creates an anonymous session and uploads local state', async () => {
        const storage = createStorage();
        const { client, calls } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage,
            now: () => 2000
        });

        await manager.initialize();
        const status = await manager.enable({ consentConfirmed: true });

        expect(storage.setItem).toHaveBeenCalledWith(
            'mythical_void_cloud_save_enabled',
            'true'
        );
        expect(storage.setItem).toHaveBeenCalledWith(
            'mythical_void_cloud_save_consent',
            expect.stringContaining('"policyVersion":"2026-07-26"')
        );
        expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
        expect(calls.upserts).toHaveLength(1);
        expect(calls.upserts[0]).toEqual(expect.objectContaining({
            user_id: 'player-1',
            save_slot: 'primary',
            save_version: '1.1.0'
        }));
        expect(status.status).toBe('synced');
        expect(status.lastSyncDirection).toBe('uploaded');
    });

    test('refuses to enable cloud saving without explicit consent', async () => {
        const storage = createStorage();
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        await expect(manager.enable()).rejects.toThrow('explicit player consent');
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(client.auth.getSession).not.toHaveBeenCalled();
    });

    test('keeps under-13 profiles local-only even when a stale opt-in exists', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_age_group', 'age_under_13');
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        storage.setItem('mythical_void_cloud_save_consent', '{"confirmed":true}');
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        const status = await manager.initialize();

        expect(status).toEqual(expect.objectContaining({
            ageEligible: false,
            ageGroup: 'age_under_13',
            enabled: false,
            status: 'restricted'
        }));
        expect(storage.removeItem).toHaveBeenCalledWith('mythical_void_cloud_save_enabled');
        expect(storage.removeItem).toHaveBeenCalledWith('mythical_void_cloud_save_consent');
        expect(client.auth.getSession).not.toHaveBeenCalled();
        expect(client.from).not.toHaveBeenCalled();
    });

    test('keeps 13-to-15 profiles local-only without a guardian flow', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_age_group', 'age_13_15');
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        const status = await manager.initialize();

        expect(status).toEqual(expect.objectContaining({
            ageEligible: false,
            ageGroup: 'age_13_15',
            enabled: false,
            status: 'restricted'
        }));
        expect(client.auth.getSession).not.toHaveBeenCalled();
    });

    test.each(['age_16_17', 'age_18_plus'])(
        'allows optional cloud save for %s profiles',
        (ageGroup) => {
            expect(CloudSaveManager.isAgeGroupEligible(ageGroup)).toBe(true);
        }
    );

    test('rejects direct cloud enable calls when age confirmation is missing', async () => {
        const storage = createStorage();
        storage.removeItem('mythical_void_age_group');
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        await expect(manager.enable({ consentConfirmed: true }))
            .rejects.toThrow('confirmed 16+ profiles');
        expect(storage.setItem).not.toHaveBeenCalledWith(
            'mythical_void_cloud_save_enabled',
            'true'
        );
        expect(client.auth.getSession).not.toHaveBeenCalled();
    });

    test('restores a newer compatible cloud save instead of overwriting it', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const remoteState = {
            version: '1.1.0',
            savedAt: 5000,
            creature: { name: 'Comet' }
        };
        const { client, calls } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 4,
                game_state: remoteState,
                client_saved_at: new Date(5000).toISOString()
            }
        });
        const gameState = createGameState(1000);
        const manager = new CloudSaveManager({ client, gameState, storage });

        await manager.initialize();

        expect(gameState.applyExternalSave).toHaveBeenCalledWith(remoteState, {
            source: 'cloud',
            persist: true
        });
        expect(calls.upserts).toHaveLength(0);
        expect(manager.remoteRevision).toBe(4);
        expect(manager.getStatus().lastSyncDirection).toBe('restored');
    });

    test('restores remote progress when no durable local save exists', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const remoteState = {
            version: '1.1.0',
            savedAt: 5000,
            creature: { name: 'Recovered Comet' }
        };
        const { client, calls } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 8,
                game_state: remoteState,
                client_saved_at: new Date(5000).toISOString()
            }
        });
        const gameState = createGameState(9000, false);
        const manager = new CloudSaveManager({ client, gameState, storage });

        const status = await manager.initialize();

        expect(gameState.hasPersistedSave).toHaveBeenCalled();
        expect(gameState.applyExternalSave).toHaveBeenCalledWith(remoteState, {
            source: 'cloud',
            persist: true
        });
        expect(calls.upserts).toHaveLength(0);
        expect(status).toEqual(expect.objectContaining({
            status: 'synced',
            lastSyncDirection: 'restored'
        }));
    });

    test('rechecks remote freshness before a deferred upload', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const remoteState = {
            version: '1.1.0',
            savedAt: 5000,
            creature: { name: 'Comet' }
        };
        const { client, calls } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 7,
                game_state: remoteState,
                client_saved_at: new Date(5000).toISOString()
            }
        });
        const gameState = createGameState(1000);
        const manager = new CloudSaveManager({ client, gameState, storage });

        manager.queueUpload(gameState.createSaveSnapshot());
        const status = await manager.flush();

        expect(gameState.applyExternalSave).toHaveBeenCalledWith(remoteState, {
            source: 'cloud',
            persist: true
        });
        expect(calls.upserts).toHaveLength(0);
        expect(manager.remoteRevision).toBe(7);
        expect(status.status).toBe('synced');
    });

    test('serializes synchronization through an origin-wide exclusive lock', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const lockManager = {
            request: jest.fn(async (name, callback) => callback({
                name,
                mode: 'exclusive'
            }))
        };
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage,
            lockManager
        });

        const status = await manager.synchronize();

        expect(lockManager.request).toHaveBeenCalledTimes(1);
        expect(lockManager.request).toHaveBeenCalledWith(
            'mythical-void-cloud-save:primary',
            expect.any(Function)
        );
        expect(status.status).toBe('synced');
    });

    test('a failed upload never replaces a newer queued snapshot', () => {
        const manager = new CloudSaveManager({
            client: {},
            gameState: createGameState(),
            storage: createStorage()
        });
        const newerSave = { version: '1.1.0', savedAt: 3000 };

        manager.pendingSave = newerSave;
        manager.retainNewestPendingSave({
            version: '1.1.0',
            savedAt: 2000
        });

        expect(manager.pendingSave).toBe(newerSave);
    });

    test('removes local-only safety data from cloud payloads', () => {
        const manager = new CloudSaveManager({
            client: {},
            gameState: createGameState(),
            storage: createStorage()
        });
        const local = createGameState().createSaveSnapshot();

        const cloud = manager.sanitizeForCloud(local);

        expect(cloud.session).toBeUndefined();
        expect(cloud.safety.guardian.pinHash).toBeNull();
        expect(cloud.safety.guardian.lastVerified).toBeNull();
        expect(cloud.safety.auditLog).toEqual([]);
        expect(cloud.memory.deletionLog).toEqual([]);
        expect(local.safety.guardian.pinHash).toBe('secret');
    });

    test('deletes only the signed-in player cloud save', async () => {
        const storage = createStorage();
        const { client, builder, calls } = createClient({
            existingSession: { user: { id: 'player-1' } }
        });
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        await manager.deleteCloudSave();

        expect(calls.deletes).toBe(1);
        expect(builder.eq).toHaveBeenCalledWith('user_id', 'player-1');
        expect(builder.eq).toHaveBeenCalledWith('save_slot', 'primary');
    });

    test('deletes an anonymous cloud identity through the protected server function', async () => {
        const storage = createStorage();
        const { client, calls } = createClient({
            existingSession: {
                user: { id: 'anonymous-player', is_anonymous: true }
            }
        });
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        await manager.deleteCloudSave();

        expect(client.functions.invoke).toHaveBeenCalledWith('delete-cloud-identity');
        expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(calls.deletes).toBe(0);
        expect(manager.currentUser).toBeNull();
    });

    test('keeps local saving available when cloud upload fails and can retry', async () => {
        const storage = createStorage();
        const { client, builder } = createClient({
            uploadError: new Error('network unavailable')
        });
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });

        const failedStatus = await manager.enable({ consentConfirmed: true });

        expect(failedStatus.enabled).toBe(true);
        expect(failedStatus.status).toBe('error');
        expect(failedStatus.hasError).toBe(true);

        builder.single.mockResolvedValue({
            data: { revision: 1, updated_at: '2026-07-26T00:00:00Z' },
            error: null
        });

        const recoveredStatus = await manager.synchronize();

        expect(recoveredStatus.status).toBe('synced');
        expect(recoveredStatus.hasError).toBe(false);
    });

    test('turning cloud save off clears consent and cancels deferred uploads', async () => {
        jest.useFakeTimers();
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        storage.setItem('mythical_void_cloud_save_consent', '{"confirmed":true}');
        const { client, calls } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage,
            syncDelayMs: 10
        });

        manager.queueUpload(createGameState().createSaveSnapshot());
        manager.disable();
        jest.runAllTimers();

        expect(manager.getStatus()).toEqual(expect.objectContaining({
            enabled: false,
            status: 'disabled',
            hasError: false
        }));
        expect(storage.removeItem).toHaveBeenCalledWith('mythical_void_cloud_save_enabled');
        expect(storage.removeItem).toHaveBeenCalledWith('mythical_void_cloud_save_consent');
        expect(calls.upserts).toHaveLength(0);
        jest.useRealTimers();
    });
});
