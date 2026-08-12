const {
    FusionAuthority,
    FUSION_AUTHORITY_SCHEMA_VERSION
} = require('../systems/FusionAuthority.js');

function createTransaction(overrides = {}) {
    return {
        schemaVersion: 2,
        operationId: 'fusion_operation_23',
        parentIds: ['creature_alpha', 'creature_beta'],
        candidateOffspringIds: ['creature_child'],
        offspringCapacity: 1,
        offspringIds: ['creature_child'],
        offspringCount: 1,
        createdAt: 23000,
        resultSeed: 'fusion-seed-v1:abc12345',
        status: 'pending',
        ...overrides
    };
}

function createParents() {
    return [
        {
            id: 'creature_alpha',
            name: 'Private Alpha Name',
            generation: 1,
            rarity: 'rare',
            lifecycle: { stage: 'adult' },
            genes: { species: 'wisp', traits: { glow: 0.7 } }
        },
        {
            id: 'creature_beta',
            name: 'Private Beta Name',
            generation: 2,
            rarity: 'epic',
            lifecycle: { stage: 'elder' },
            genes: { species: 'mossling', traits: { leaves: 3 } }
        }
    ];
}

describe('FusionAuthority', () => {
    let authority;

    beforeEach(() => {
        authority = new FusionAuthority();
    });

    test('creates a versioned anonymous same-owner request', () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const serialized = JSON.stringify(request);

        expect(request).toEqual(expect.objectContaining({
            schemaVersion: FUSION_AUTHORITY_SCHEMA_VERSION,
            contractVersion: 2,
            operationId: 'fusion_operation_23',
            parentIds: ['creature_alpha', 'creature_beta'],
            candidateOffspringIds: ['creature_child'],
            offspringCapacity: 1,
            expectedSaveRevision: 7,
            executionMode: 'local_fallback',
            requestFingerprint: expect.stringMatching(/^fnv1a32-v1:/),
            consent: {
                mode: 'same_save_owner',
                scope: 'local_sanctuary',
                keeperGrant: 'confirmed',
                parentGrants: [
                    {
                        creatureId: 'creature_alpha',
                        grant: 'lineage_synthesis',
                        decision: 'willing'
                    },
                    {
                        creatureId: 'creature_beta',
                        grant: 'lineage_synthesis',
                        decision: 'willing'
                    }
                ],
                sharedInvitationId: null
            }
        }));
        expect(authority.validateRequest(request)).toBe(true);
        expect(serialized).not.toContain('Private Alpha Name');
        expect(serialized).not.toContain('Private Beta Name');
        expect(serialized).not.toContain('user');
        expect(serialized).not.toContain('email');
    });

    test('produces the same request fingerprint for the same portable inputs', () => {
        const first = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 3
        });
        const second = authority.createRequest({
            transaction: createTransaction(),
            parents: [...createParents()].reverse(),
            expectedSaveRevision: 3
        });

        expect(second).toEqual(first);
    });

    test('distinguishes an idempotent replay from an operation mismatch', () => {
        const original = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents()
        });
        const identical = JSON.parse(JSON.stringify(original));
        const altered = authority.createRequest({
            transaction: createTransaction({
                candidateOffspringIds: [
                    'creature_different_child'
                ],
                offspringIds: ['creature_different_child']
            }),
            parents: createParents()
        });

        expect(authority.compareReplay(original, identical)).toEqual({
            replay: true,
            compatible: true,
            reason: 'idempotent_replay'
        });
        expect(authority.compareReplay(original, altered)).toEqual({
            replay: true,
            compatible: false,
            reason: 'operation_replay_mismatch'
        });
    });

    test('rejects tampered parent grants even when the payload is re-fingerprinted', () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents()
        });
        request.consent.parentGrants[0].creatureId = 'creature_intruder';
        const unsigned = { ...request };
        delete unsigned.requestFingerprint;
        request.requestFingerprint = authority.fingerprint(unsigned);

        expect(authority.validateRequest(request)).toBe(false);
    });

    test('creates and verifies a result-bound local receipt', () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents()
        });
        const result = {
            offspringData: {
                creatureId: 'creature_child',
                rarity: 'epic'
            }
        };
        const receipt = authority.createLocalReceipt(request, result, 24000);

        expect(authority.validateReceipt(request, result, receipt)).toBe(true);
        expect(authority.validateReceipt(request, {
            offspringData: {
                creatureId: 'creature_child',
                rarity: 'legendary'
            }
        }, receipt)).toBe(false);
    });

    test('reserves a cloud Fusion operation and records server proof separately', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const rpc = jest.fn(async () => ({
            data: {
                schemaVersion: 1,
                operationId: request.operationId,
                status: 'reserved',
                reservationMode: 'server_reserved',
                requestFingerprint: request.requestFingerprint,
                serverFingerprint: '0123456789abcdef0123456789abcdef',
                resultSeed: 'fusion-server-v1:server-seed',
                offspringIds: ['creature_child'],
                offspringCount: 1,
                expiresAt: '2026-07-30T23:30:00Z',
                replay: false
            },
            error: null
        }));
        const cloudSave = {
            isEnabled: jest.fn(() => true),
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            client: { rpc }
        };

        const reservation = await authority.reserveOperation(request, {
            cloudSave
        });
        const receipt = authority.createLocalReceipt(
            request,
            { offspringData: { creatureId: 'creature_child' } },
            24000,
            reservation
        );

        expect(rpc).toHaveBeenCalledWith('reserve_fusion_operation', {
            p_request: request
        });
        expect(reservation).toEqual(expect.objectContaining({
            reservationMode: 'server_reserved',
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            reconciliationRequired: false
        }));
        expect(receipt).toEqual(expect.objectContaining({
            authority: 'server_reserved_local_result',
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            reconciliationRequired: false
        }));
    });

    test('keeps offline play available while marking cloud reconciliation required', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const cloudSave = {
            isEnabled: jest.fn(() => true),
            ensureSession: jest.fn(async () => {
                throw new TypeError('Failed to fetch');
            }),
            client: { rpc: jest.fn() }
        };

        const reservation = await authority.reserveOperation(request, {
            cloudSave
        });

        expect(reservation).toEqual(expect.objectContaining({
            reservationMode: 'local_offline',
            reconciliationRequired: true,
            reason: 'network_unavailable'
        }));
    });

    test('blocks stale or unauthorized cloud reservations instead of falling back', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const conflict = {
            code: '40001',
            message: 'save_revision_conflict'
        };
        const cloudSave = {
            isEnabled: jest.fn(() => true),
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            client: {
                rpc: jest.fn(async () => ({
                    data: null,
                    error: conflict
                }))
            }
        };

        await expect(authority.reserveOperation(request, {
            cloudSave
        })).rejects.toEqual(expect.objectContaining({
            name: 'FusionAuthorityReservationError',
            code: '40001'
        }));
    });

    test('uses local-only reservations without contacting cloud services', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents()
        });
        const rpc = jest.fn();

        const reservation = await authority.reserveOperation(request, {
            cloudSave: {
                isEnabled: jest.fn(() => false),
                client: { rpc }
            }
        });

        expect(reservation).toEqual(expect.objectContaining({
            reservationMode: 'local_only',
            reconciliationRequired: false
        }));
        expect(rpc).not.toHaveBeenCalled();
    });

    test('selects one or two identities from capacity instead of accepting a requested count', async () => {
        const request = authority.createRequest({
            transaction: createTransaction({
                candidateOffspringIds: [
                    'creature_child_a',
                    'creature_child_b'
                ],
                offspringCapacity: 2,
                offspringIds: [
                    'creature_child_a',
                    'creature_child_b'
                ],
                offspringCount: 2
            }),
            parents: createParents()
        });
        const selected = authority.selectOffspringIdentity(request);
        const reservation = await authority.reserveOperation(request, {
            cloudSave: {
                isEnabled: jest.fn(() => false)
            }
        });

        expect(request).not.toHaveProperty('offspringCount');
        expect(request).not.toHaveProperty('offspringIds');
        expect(selected.offspringCount).toBeGreaterThanOrEqual(1);
        expect(selected.offspringCount).toBeLessThanOrEqual(2);
        expect(selected.offspringIds).toEqual(
            request.candidateOffspringIds.slice(
                0,
                selected.offspringCount
            )
        );
        expect(reservation).toEqual(expect.objectContaining(selected));
    });

    test('reconciles an offline receipt through reserve, execute, and atomic finalization', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const result = {
            offspringData: {
                creatureId: 'creature_child',
                rarity: 'rare'
            }
        };
        const localReservation = {
            reservationMode: 'local_offline',
            reconciliationRequired: true
        };
        const receipt = authority.createLocalReceipt(
            request,
            result,
            24000,
            localReservation
        );
        const serverReservation = {
            schemaVersion: 1,
            operationId: request.operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            offspringIds: ['creature_child'],
            offspringCount: 1
        };
        const execution = {
            operationId: request.operationId,
            outcome: { offspring: [] },
            receipt: { resultFingerprint: 'fnv1a32-v1:12345678' }
        };
        const finalization = { revision: 8 };
        authority.reserveOperation = jest.fn(
            async () => serverReservation
        );
        authority.executeReservedOperation = jest.fn(
            async () => execution
        );
        authority.finalizeReservedOperation = jest.fn(
            async () => finalization
        );
        const cloudSave = { isEnabled: jest.fn(() => true) };

        await expect(authority.reconcileOfflineReceipt({
            operationId: request.operationId,
            request,
            receipt,
            offspringIds: ['creature_child'],
            offspringCount: 1,
            names: ['Nova'],
            queuedAt: 24000
        }, { cloudSave })).resolves.toEqual({
            operationId: request.operationId,
            reservation: serverReservation,
            execution,
            finalization
        });
        expect(authority.finalizeReservedOperation).toHaveBeenCalledWith(
            request,
            serverReservation,
            execution.receipt,
            ['Nova'],
            { cloudSave }
        );
    });

    test('accepts a server-generated outcome bound to the reservation', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const reservation = {
            operationId: request.operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            offspringIds: ['creature_child'],
            offspringCount: 1
        };
        const outcome = {
            schemaVersion: 1,
            operationId: request.operationId,
            executionVersion: 'fusion-outcome-v1',
            offspring: [{
                offspringGenes: { id: 'genes_creature_child' },
                offspringData: { creatureId: 'creature_child' }
            }]
        };
        const receipt = {
            schemaVersion: 1,
            operationId: request.operationId,
            authority: 'server_generated',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: reservation.serverFingerprint,
            resultFingerprint: authority.fingerprint(outcome),
            receiptFingerprint: 'fnv1a32-v1:12345678'
        };
        const invoke = jest.fn(async () => ({
            data: {
                operationId: request.operationId,
                outcome,
                receipt,
                replay: false
            },
            error: null
        }));
        const cloudSave = {
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            client: { functions: { invoke } }
        };

        const execution = await authority.executeReservedOperation(
            request,
            reservation,
            { cloudSave }
        );

        expect(invoke).toHaveBeenCalledWith('execute-fusion', {
            body: { operationId: request.operationId }
        });
        expect(execution).toEqual({
            operationId: request.operationId,
            outcome,
            receipt,
            replay: false
        });
    });

    test('rejects a server outcome that substitutes an offspring identity', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const reservation = {
            operationId: request.operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            offspringIds: ['creature_child'],
            offspringCount: 1
        };
        const alteredOutcome = {
            schemaVersion: 1,
            operationId: request.operationId,
            offspring: [{
                offspringGenes: {},
                offspringData: { creatureId: 'creature_substituted' }
            }]
        };
        const cloudSave = {
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            client: {
                functions: {
                    invoke: jest.fn(async () => ({
                        data: {
                            operationId: request.operationId,
                            outcome: alteredOutcome,
                            receipt: {
                                schemaVersion: 1,
                                operationId: request.operationId,
                                authority: 'server_generated',
                                requestFingerprint: request.requestFingerprint,
                                serverFingerprint: reservation.serverFingerprint,
                                resultFingerprint: authority.fingerprint(
                                    alteredOutcome
                                )
                            }
                        },
                        error: null
                    }))
                }
            }
        };

        await expect(authority.executeReservedOperation(
            request,
            reservation,
            { cloudSave }
        )).rejects.toEqual(expect.objectContaining({
            name: 'FusionAuthorityExecutionError',
            message: 'fusion_server_execution_invalid'
        }));
    });

    test('does not invoke server execution for local and offline reservations', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents()
        });
        const invoke = jest.fn();

        await expect(authority.executeReservedOperation(request, {
            reservationMode: 'local_only'
        }, {
            cloudSave: { client: { functions: { invoke } } }
        })).resolves.toBeNull();
        await expect(authority.executeReservedOperation(request, {
            reservationMode: 'local_offline'
        }, {
            cloudSave: { client: { functions: { invoke } } }
        })).resolves.toBeNull();
        expect(invoke).not.toHaveBeenCalled();
    });

    test('finalizes a reserved server result using names only', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const reservation = {
            operationId: request.operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            offspringIds: ['creature_child'],
            offspringCount: 1
        };
        const executionReceipt = {
            operationId: request.operationId,
            resultFingerprint: 'fnv1a32-v1:12345678'
        };
        const child = {
            id: 'creature_child',
            name: 'Nova',
            lineage: {
                fusionOperationId: request.operationId
            }
        };
        const response = {
            schemaVersion: 1,
            operationId: request.operationId,
            status: 'committed',
            revision: 8,
            gameState: {
                creatures: [child],
                activeCreatureIndex: 0,
                creature: child,
                breedingShrine: {
                    pendingFusion: null,
                    completedOperationIds: [request.operationId],
                    breedingHistory: [{
                        operationId: request.operationId,
                        authority: 'server_generated'
                    }]
                }
            },
            offspringIds: ['creature_child'],
            receipt: {
                schemaVersion: 1,
                operationId: request.operationId,
                authority: 'server_finalized',
                requestFingerprint: request.requestFingerprint,
                serverFingerprint: reservation.serverFingerprint,
                resultFingerprint: executionReceipt.resultFingerprint,
                saveRevision: 8,
                receiptFingerprint:
                    'fusion-commit-v1:0123456789abcdef0123456789abcdef'
            },
            replay: false
        };
        const invoke = jest.fn(async () => ({
            data: response,
            error: null
        }));
        const cloudSave = {
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            performServerMutation: jest.fn(async callback => callback()),
            client: { functions: { invoke } }
        };

        const finalization = await authority.finalizeReservedOperation(
            request,
            reservation,
            executionReceipt,
            ['Nova'],
            { cloudSave }
        );

        expect(invoke).toHaveBeenCalledWith('finalize-fusion', {
            body: {
                operationId: request.operationId,
                names: ['Nova']
            }
        });
        expect(finalization).toEqual({
            ...response,
            names: ['Nova']
        });
    });

    test('rejects a finalization response that substitutes the named child', async () => {
        const request = authority.createRequest({
            transaction: createTransaction(),
            parents: createParents(),
            expectedSaveRevision: 7
        });
        const reservation = {
            operationId: request.operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            offspringIds: ['creature_child'],
            offspringCount: 1
        };
        const executionReceipt = {
            resultFingerprint: 'fnv1a32-v1:12345678'
        };
        const cloudSave = {
            ensureSession: jest.fn(async () => ({ id: 'private-player' })),
            performServerMutation: jest.fn(async callback => callback()),
            client: {
                functions: {
                    invoke: jest.fn(async () => ({
                        data: {
                            schemaVersion: 1,
                            operationId: request.operationId,
                            status: 'committed',
                            revision: 8,
                            gameState: {
                                creatures: [{
                                    id: 'creature_substituted',
                                    name: 'Nova'
                                }],
                                activeCreatureIndex: 0,
                                creature: {
                                    id: 'creature_substituted',
                                    name: 'Nova'
                                },
                                breedingShrine: {
                                    pendingFusion: null,
                                    completedOperationIds: [
                                        request.operationId
                                    ],
                                    breedingHistory: [{
                                        operationId: request.operationId,
                                        authority: 'server_generated'
                                    }]
                                }
                            },
                            offspringIds: ['creature_child'],
                            receipt: {
                                schemaVersion: 1,
                                operationId: request.operationId,
                                authority: 'server_finalized',
                                requestFingerprint:
                                    request.requestFingerprint,
                                serverFingerprint:
                                    reservation.serverFingerprint,
                                resultFingerprint:
                                    executionReceipt.resultFingerprint,
                                saveRevision: 8,
                                receiptFingerprint:
                                    'fusion-commit-v1:invalid'
                            }
                        },
                        error: null
                    }))
                }
            }
        };

        await expect(authority.finalizeReservedOperation(
            request,
            reservation,
            executionReceipt,
            ['Nova'],
            { cloudSave }
        )).rejects.toEqual(expect.objectContaining({
            name: 'FusionAuthorityFinalizationError',
            message: 'fusion_server_finalization_invalid'
        }));
    });

    test('replays deterministic random sequences and restores global functions', () => {
        const originalRandom = Math.random;
        const originalBetween = jest.fn(() => 99);
        const originalFloatBetween = jest.fn(() => 99.5);
        const phaser = {
            Math: {
                Between: originalBetween,
                FloatBetween: originalFloatBetween
            }
        };
        const captureSequence = () => {
            const restore = authority.enterDeterministicRandomScope(
                'fusion-seed-v1:23000000',
                phaser
            );
            try {
                return [
                    Math.random(),
                    Math.random(),
                    phaser.Math.Between(1, 10),
                    phaser.Math.FloatBetween(10, 20)
                ];
            } finally {
                restore();
            }
        };

        expect(captureSequence()).toEqual(captureSequence());
        expect(Math.random).toBe(originalRandom);
        expect(phaser.Math.Between).toBe(originalBetween);
        expect(phaser.Math.FloatBetween).toBe(originalFloatBetween);
    });
});
