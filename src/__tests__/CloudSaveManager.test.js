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
        rpcs: [],
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
        rpc: jest.fn(async (name, args) => {
            calls.rpcs.push({ name, args });
            return {
                data: {
                    revision: options.uploadRevision ?? (Number(args.p_expected_revision) + 1),
                    updated_at: '2026-07-26T00:00:00Z'
                },
                error: options.uploadError ?? null
            };
        }),
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
        expect(calls.rpcs).toHaveLength(1);
        expect(calls.rpcs[0]).toEqual({
            name: 'save_game_state',
            args: expect.objectContaining({
                p_save_slot: 'primary',
                p_save_version: '1.1.0',
                p_expected_revision: 0,
                p_client_saved_at: new Date(1000).toISOString(),
                p_game_state: expect.objectContaining({
                    version: '1.1.0',
                    creature: { name: 'Nova' }
                })
            })
        });
        expect(calls.rpcs[0].args.p_game_state.session).toBeUndefined();
        expect(calls.rpcs[0].args.p_game_state.safety.guardian.pinHash).toBeNull();
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
        expect(calls.rpcs).toHaveLength(0);
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
        expect(calls.rpcs).toHaveLength(0);
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
        expect(calls.rpcs).toHaveLength(0);
        expect(manager.remoteRevision).toBe(7);
        expect(status.status).toBe('synced');
    });

    test('preserves local progress when another device wins the revision race', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const revisionConflict = {
            code: '40001',
            message: 'save_revision_conflict',
            details: JSON.stringify({
                expectedRevision: 4,
                currentRevision: 5
            })
        };
        const { client } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 4,
                game_state: { version: '1.1.0', savedAt: 5000 },
                client_saved_at: new Date(5000).toISOString()
            },
            uploadError: revisionConflict
        });
        const localSave = createGameState(6000).createSaveSnapshot();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(6000),
            storage,
            now: () => 7000
        });

        manager.queueUpload(localSave);

        await expect(manager.flush()).rejects.toBe(revisionConflict);
        expect(manager.pendingSave).toEqual(localSave);
        expect(manager.getStatus()).toEqual(expect.objectContaining({
            status: 'conflict',
            hasConflict: true,
            hasError: true,
            conflict: {
                expectedRevision: 4,
                currentRevision: 5,
                detectedAt: 7000
            }
        }));
    });

    test('a later sync restores the winning revision and clears the stale pending copy', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client, builder } = createClient();
        const gameState = createGameState(6000);
        const manager = new CloudSaveManager({ client, gameState, storage });
        manager.pendingSave = gameState.createSaveSnapshot();
        manager.status = 'conflict';
        manager.lastConflict = {
            expectedRevision: 4,
            currentRevision: 5,
            detectedAt: 7000
        };
        const remoteState = {
            version: '1.1.0',
            savedAt: 7000,
            creature: { name: 'Current Keeper' }
        };
        builder.maybeSingle.mockResolvedValue({
            data: {
                save_version: '1.1.0',
                revision: 5,
                game_state: remoteState,
                client_saved_at: new Date(7000).toISOString()
            },
            error: null
        });

        const status = await manager.synchronize();

        expect(gameState.applyExternalSave).toHaveBeenCalledWith(remoteState, {
            source: 'cloud',
            persist: true
        });
        expect(manager.pendingSave).toBeNull();
        expect(status).toEqual(expect.objectContaining({
            status: 'synced',
            hasConflict: false,
            lastSyncDirection: 'restored'
        }));
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

    test('adopts an authoritative server mutation and clears queued local state', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client } = createClient();
        const gameState = createGameState(3000);
        const manager = new CloudSaveManager({
            client,
            gameState,
            storage,
            now: () => 5000
        });
        manager.remoteRevision = 4;
        manager.pendingSave = { version: '1.1.0', savedAt: 4000 };
        const authoritativeState = {
            version: '1.1.0',
            savedAt: 5000,
            creatures: [{ id: 'server_child', name: 'Nova' }]
        };

        const result = await manager.performServerMutation(async () => ({
            revision: 5,
            gameState: authoritativeState
        }));

        expect(result.revision).toBe(5);
        expect(gameState.applyExternalSave).toHaveBeenCalledWith(
            authoritativeState,
            {
                source: 'cloud_server_mutation',
                persist: true
            }
        );
        expect(manager.pendingSave).toBeNull();
        expect(manager.remoteRevision).toBe(5);
        expect(manager.getStatus()).toEqual(expect.objectContaining({
            status: 'synced',
            lastSyncDirection: 'server_mutation'
        }));
    });

    test('retains queued local state when a server mutation fails', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(3000),
            storage,
            syncDelayMs: 60000
        });
        const queued = { version: '1.1.0', savedAt: 4000 };
        manager.pendingSave = queued;
        const failure = new Error('network unavailable');

        await expect(manager.performServerMutation(async () => {
            throw failure;
        })).rejects.toBe(failure);

        expect(manager.pendingSave).toBe(queued);
        expect(manager.syncTimer).toBeNull();
        expect(manager.getStatus()).toEqual(expect.objectContaining({
            status: 'error',
            hasError: true
        }));
    });

    test('never uploads an unresolved server Fusion snapshot through normal sync', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client, calls } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 7,
                game_state: {
                    version: '1.1.0',
                    savedAt: 3000,
                    breedingShrine: { completedOperationIds: [] }
                },
                client_saved_at: new Date(3000).toISOString()
            }
        });
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(9000),
            storage
        });
        const pendingFusionSave = {
            version: '1.1.0',
            savedAt: 9000,
            breedingShrine: {
                pendingFusion: {
                    operationId: 'fusion_pending_23',
                    authorityReservation: {
                        reservationMode: 'server_reserved'
                    }
                }
            }
        };

        manager.queueUpload(pendingFusionSave);
        const status = await manager.flush();

        expect(calls.rpcs).toHaveLength(0);
        expect(manager.pendingSave).toBe(pendingFusionSave);
        expect(status).toEqual(expect.objectContaining({
            status: 'pending_server_mutation',
            lastSyncDirection: 'deferred'
        }));
    });

    test('restores a committed remote lineage over an unresolved local snapshot', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const remoteState = {
            version: '1.1.0',
            savedAt: 5000,
            creatures: [{ id: 'server_child', name: 'Nova' }],
            breedingShrine: {
                completedOperationIds: ['fusion_pending_23'],
                pendingFusion: null
            }
        };
        const { client, calls } = createClient({
            remoteSave: {
                save_version: '1.1.0',
                revision: 8,
                game_state: remoteState,
                client_saved_at: new Date(5000).toISOString()
            }
        });
        const gameState = createGameState(9000);
        const manager = new CloudSaveManager({
            client,
            gameState,
            storage
        });
        const pendingFusionSave = {
            version: '1.1.0',
            savedAt: 9000,
            breedingShrine: {
                pendingFusion: {
                    operationId: 'fusion_pending_23',
                    authorityReservation: {
                        reservationMode: 'server_reserved'
                    }
                }
            }
        };
        manager.pendingSave = pendingFusionSave;

        await manager.synchronizeSnapshot(pendingFusionSave);

        expect(gameState.applyExternalSave).toHaveBeenCalledWith(remoteState, {
            source: 'cloud',
            persist: true
        });
        expect(calls.rpcs).toHaveLength(0);
        expect(manager.pendingSave).toBeNull();
        expect(manager.remoteRevision).toBe(8);
    });

    test('refuses an ordinary upload while an offline Fusion receipt is pending', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client, calls } = createClient();
        const manager = new CloudSaveManager({
            client,
            gameState: createGameState(),
            storage
        });
        const snapshot = {
            version: '1.1.0',
            savedAt: 9000,
            breedingShrine: {
                reconciliationQueue: [{
                    operationId: 'fusion_offline_23'
                }]
            }
        };

        await expect(manager.upload(snapshot, 7)).rejects.toThrow(
            'Fusion receipt must reconcile before cloud upload.'
        );
        expect(calls.rpcs).toHaveLength(0);
    });

    test('hands the oldest offline receipt to authority before normal synchronization', async () => {
        const originalAuthority = globalThis.FusionAuthority;
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const { client } = createClient();
        const record = {
            operationId: 'fusion_offline_23',
            request: {},
            receipt: {}
        };
        const gameState = createGameState();
        gameState.createSaveSnapshot.mockReturnValue({
            version: '1.1.0',
            savedAt: 9000,
            breedingShrine: {
                reconciliationQueue: [record]
            }
        });
        const reconcileOfflineReceipt = jest.fn(async () => ({
            operationId: record.operationId,
            finalization: { revision: 8 }
        }));
        globalThis.FusionAuthority = { reconcileOfflineReceipt };
        const manager = new CloudSaveManager({
            client,
            gameState,
            storage
        });
        manager.pendingSave = gameState.createSaveSnapshot();

        const result = await manager.reconcileFusionReceipts();

        expect(reconcileOfflineReceipt).toHaveBeenCalledWith(
            record,
            { cloudSave: manager }
        );
        expect(result).toEqual(expect.objectContaining({
            operationId: record.operationId
        }));
        expect(manager.pendingSave).toBeNull();
        expect(manager.getStatus()).toEqual(expect.objectContaining({
            status: 'synced',
            lastSyncDirection: 'fusion_reconciled'
        }));
        globalThis.FusionAuthority = originalAuthority;
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

    test('keeps durable portrait references but removes signed display URLs', () => {
        const manager = new CloudSaveManager({
            client: {},
            gameState: createGameState(),
            storage: createStorage()
        });
        const assetRef =
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
        const portrait = {
            schemaVersion: 2,
            identityKey: 'creature:baby:23',
            stage: 'baby',
            status: 'ready',
            storage: 'supabase-private',
            assetRef,
            imageUrl: 'https://private.example/signed',
            expiresAt: 23000
        };
        const local = {
            creature: {
                portraits: {
                    schemaVersion: 2,
                    activeStage: 'baby',
                    byStage: { baby: { ...portrait } }
                }
            },
            creatures: [{
                portraits: {
                    schemaVersion: 2,
                    activeStage: 'baby',
                    byStage: { baby: { ...portrait } }
                }
            }]
        };

        const cloud = manager.sanitizeForCloud(local);
        const serialized = JSON.stringify(cloud);

        expect(serialized).toContain(assetRef);
        expect(serialized).not.toContain('private.example');
        expect(
            cloud.creature.portraits.byStage.baby
        ).not.toHaveProperty('expiresAt');
        expect(local.creature.portraits.byStage.baby.imageUrl).toContain(
            'private.example'
        );
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
        const { client } = createClient({
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

        client.rpc.mockResolvedValue({
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
        expect(calls.rpcs).toHaveLength(0);
        jest.useRealTimers();
    });

    test('adopting a durable account replaces the cached anonymous identity and restores its remote save', async () => {
        const storage = createStorage();
        storage.setItem('mythical_void_cloud_save_enabled', 'true');
        const remoteSave = {
            revision: 4,
            game_state: { version: '1.1.0', savedAt: 5000, creature: { name: 'Remote' } },
            client_saved_at: '2026-08-31T12:00:00Z'
        };
        const { client, calls } = createClient({ remoteSave });
        const gameState = createGameState();
        const manager = new CloudSaveManager({ client, gameState, storage });
        manager.currentUser = { id: 'anonymous-user', is_anonymous: true };

        await manager.adoptAuthenticatedSession({
            id: 'durable-user', is_anonymous: false
        }, { preferRemote: true });

        expect(manager.currentUser.id).toBe('durable-user');
        expect(manager.remoteRevision).toBe(4);
        expect(gameState.applyExternalSave).toHaveBeenCalledWith(
            remoteSave.game_state,
            { source: 'cloud', persist: true }
        );
        expect(calls.rpcs).toHaveLength(0);
    });
});
