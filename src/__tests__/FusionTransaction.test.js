const GameStateManager = require('../systems/GameState.js');
const { FusionAuthority } = require('../systems/FusionAuthority.js');

function adultCreature(id, name = id) {
    return {
        id,
        name,
        level: 5,
        experience: 400,
        stats: { happiness: 100, energy: 100, health: 100 },
        genes: { id: `genes_${id}`, rarity: 'common' },
        portraits: { schemaVersion: 1, activeStage: null, byStage: {} },
        lifecycle: {
            stage: 'adult',
            birthDate: Date.now() - 3 * 24 * 60 * 60 * 1000
        },
        bond: { level: 3, experience: 20 },
        powerHistory: [],
        generation: 1,
        parentIds: []
    };
}

function offspring(id, parentIds, name = 'Nova') {
    return {
        id,
        name,
        level: 1,
        experience: 0,
        stats: { happiness: 100, energy: 100, health: 100 },
        genes: { id: `genes_${id}`, rarity: 'rare', species: 'hybrid' },
        portraits: { schemaVersion: 1, activeStage: null, byStage: {} },
        lifecycle: {
            stage: 'baby',
            birthDate: Date.now()
        },
        generation: 2,
        parentIds,
        isOffspring: true
    };
}

describe('Fusion transaction persistence', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
        manager.set('breedingShrine.unlocked', true);
        manager.set('creature.level', 5);
        manager.set('creatures', [
            adultCreature('parent_alpha', 'Alpha'),
            adultCreature('parent_beta', 'Beta')
        ]);
        manager.set('activeCreatureIndex', 0);
    });

    afterEach(() => {
        manager.stopAutoSave();
    });

    test('commits one offspring atomically with lineage, cooldown, and history', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1
        );
        expect(started.success).toBe(true);

        const child = offspring(
            started.transaction.offspringIds[0],
            started.transaction.parentIds
        );
        const committed = manager.commitFusionTransaction(
            started.transaction.operationId,
            [child]
        );

        expect(committed.success).toBe(true);
        expect(manager.getCreatureCollection()).toHaveLength(3);
        expect(manager.getCreatureCollection().slice(0, 2)).toEqual([
            expect.objectContaining({
                id: 'parent_alpha',
                name: 'Alpha',
                genes: expect.objectContaining({ id: 'genes_parent_alpha' })
            }),
            expect.objectContaining({
                id: 'parent_beta',
                name: 'Beta',
                genes: expect.objectContaining({ id: 'genes_parent_beta' })
            })
        ]);
        expect(manager.getActiveCreature()).toEqual(expect.objectContaining({
            id: child.id,
            name: 'Nova',
            lineage: expect.objectContaining({
                origin: 'fusion',
                parentIds: ['parent_alpha', 'parent_beta'],
                fusionOperationId: started.transaction.operationId
            })
        }));
        expect(manager.get('breedingShrine.pendingFusion')).toBeNull();
        expect(manager.getBreedingShrineStatus().cooldownRemaining).toBeGreaterThan(0);
        expect(manager.get('breedingShrine.breedingHistory')).toEqual([
            expect.objectContaining({
                operationId: started.transaction.operationId,
                offspringIds: [child.id]
            })
        ]);
        expect(
            manager.get('world.sanctuaryDecorations.kinshipBeacon')
        ).toEqual(expect.objectContaining({
            unlocked: true,
            firstOperationId: started.transaction.operationId,
            lastOperationId: started.transaction.operationId,
            lineageCount: 1
        }));
        expect(manager.get('breedingShrine.discovery')).toEqual(
            expect.objectContaining({
                state: 'first_lineage',
                firstLineageOperationId: started.transaction.operationId
            })
        );
    });

    test('rejects a twin reservation unless both collection spaces exist', () => {
        manager.set('maxCreatures', 3);

        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            2
        );

        expect(started).toEqual(expect.objectContaining({
            success: false,
            reason: 'collection_capacity',
            required: 2,
            available: 1
        }));
        expect(manager.get('breedingShrine.pendingFusion')).toBeNull();
    });

    test('does not partially commit an incomplete twin result', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            2
        );
        const firstTwin = offspring(
            started.transaction.offspringIds[0],
            started.transaction.parentIds,
            'Sol'
        );

        const committed = manager.commitFusionTransaction(
            started.transaction.operationId,
            [firstTwin]
        );

        expect(committed).toEqual({
            success: false,
            reason: 'offspring_count_mismatch'
        });
        expect(manager.getCreatureCollection()).toHaveLength(2);
        expect(manager.get('breedingShrine.lastBreedingTime')).toBeNull();
    });

    test('rejects twin payloads that repeat one reserved creature identity', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            2
        );
        const firstId = started.transaction.offspringIds[0];
        const duplicateTwins = [
            offspring(firstId, started.transaction.parentIds, 'Sol'),
            offspring(firstId, started.transaction.parentIds, 'Luna')
        ];

        expect(manager.commitFusionTransaction(
            started.transaction.operationId,
            duplicateTwins
        )).toEqual({
            success: false,
            reason: 'offspring_identity_mismatch'
        });
        expect(manager.getCreatureCollection()).toHaveLength(2);
    });

    test('commits twins together with stable reciprocal sibling identities', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            2
        );
        const [firstId, secondId] = started.transaction.offspringIds;
        const twins = [
            {
                ...offspring(firstId, started.transaction.parentIds, 'Sol'),
                isTwin: true,
                twinIndex: 1,
                twinSiblingId: secondId,
                twinSiblingName: 'Luna'
            },
            {
                ...offspring(secondId, started.transaction.parentIds, 'Luna'),
                isTwin: true,
                twinIndex: 2,
                twinSiblingId: firstId,
                twinSiblingName: 'Sol'
            }
        ];

        expect(manager.commitFusionTransaction(
            started.transaction.operationId,
            twins
        ).success).toBe(true);
        expect(manager.getCreatureCollection().slice(-2)).toEqual([
            expect.objectContaining({
                id: firstId,
                twinSiblingId: secondId,
                twinSiblingName: 'Luna'
            }),
            expect.objectContaining({
                id: secondId,
                twinSiblingId: firstId,
                twinSiblingName: 'Sol'
            })
        ]);
    });

    test('emits normal collection integration events for every fused creature', () => {
        const collectionEvents = [];
        manager.on('creatureAddedToCollection', event => {
            collectionEvents.push(event);
        });
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            2
        );
        const twins = started.transaction.offspringIds.map((id, index) => (
            offspring(id, started.transaction.parentIds, `Twin ${index + 1}`)
        ));

        expect(manager.commitFusionTransaction(
            started.transaction.operationId,
            twins
        ).success).toBe(true);
        expect(collectionEvents).toEqual([
            expect.objectContaining({
                creature: expect.objectContaining({ id: twins[0].id }),
                index: 2,
                source: 'fusion',
                operationId: started.transaction.operationId
            }),
            expect.objectContaining({
                creature: expect.objectContaining({ id: twins[1].id }),
                index: 3,
                source: 'fusion',
                operationId: started.transaction.operationId
            })
        ]);
    });

    test('clears interrupted work without starting cooldown', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1
        );

        expect(manager.clearInterruptedFusion('test_interrupt')).toBe(true);
        expect(manager.get('breedingShrine.pendingFusion')).toBeNull();
        expect(manager.get('breedingShrine.lastBreedingTime')).toBeNull();
        expect(manager.getBreedingShrineStatus().canBreed).toBe(true);
        expect(started.transaction.operationId).toMatch(/^fusion_/);
    });

    test('preserves a server reservation as resumable pre-hatch work', () => {
        const authority = new FusionAuthority();
        const operationId = 'fusion_reserved_recovery_23';
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1,
            { operationId }
        );
        const request = authority.createRequest({
            transaction: started.transaction,
            parents: manager.getCreatureCollection().slice(0, 2),
            expectedSaveRevision: 7
        });
        manager.attachFusionAuthorityRequest(operationId, request);
        manager.attachFusionAuthorityReservation(operationId, {
            schemaVersion: 1,
            operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            serverResultSeed: 'fusion-server-v1:recovery',
            offspringIds: [started.transaction.candidateOffspringIds[0]],
            offspringCount: 1,
            reconciliationRequired: false
        });

        expect(manager.getPendingReservedFusion()).toEqual(
            expect.objectContaining({
                operationId,
                parentIds: ['parent_alpha', 'parent_beta'],
                authorityReservation: expect.objectContaining({
                    reservationMode: 'server_reserved'
                })
            })
        );

        const hatchData = {
            offspringData: {
                creatureId: started.transaction.candidateOffspringIds[0]
            }
        };
        manager.stageFusionResult(operationId, hatchData);
        expect(manager.getPendingReservedFusion()).toBeNull();
        expect(manager.getPendingFusionHatchData()).toEqual(
            expect.objectContaining({
                offspringData: expect.objectContaining({
                    creatureId: started.transaction.candidateOffspringIds[0]
                })
            })
        );
    });

    test('persists the exact staged hatch result for refresh recovery', () => {
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1
        );
        const hatchData = {
            offspringGenes: {
                id: 'genes_exact_result',
                rarity: 'epic',
                cosmicAffinity: { element: 'void' }
            },
            offspringData: {
                creatureId: started.transaction.offspringIds[0],
                generation: 2,
                rarity: 'epic',
                parentIds: started.transaction.parentIds
            },
            parent1: adultCreature('parent_alpha', 'Alpha'),
            parent2: adultCreature('parent_beta', 'Beta'),
            birthEvents: [{ id: 'belovedTrait', message: 'Exact event' }],
            fusionTransaction: started.transaction
        };

        expect(manager.stageFusionResult(
            started.transaction.operationId,
            hatchData
        ).success).toBe(true);
        expect(manager.stageFusionNames(
            started.transaction.operationId,
            ['Exact Nova']
        ).success).toBe(true);

        const restoredManager = new GameStateManager();
        expect(restoredManager.load()).toBe(true);
        expect(restoredManager.getPendingFusionHatchData()).toEqual(
            expect.objectContaining({
                offspringGenes: expect.objectContaining({
                    id: 'genes_exact_result',
                    rarity: 'epic'
                }),
                offspringData: expect.objectContaining({
                    creatureId: started.transaction.offspringIds[0]
                }),
                birthEvents: [
                    expect.objectContaining({ id: 'belovedTrait' })
                ],
                fusionTransaction: expect.objectContaining({
                    operationId: started.transaction.operationId,
                    status: 'staged',
                    proposedNames: ['Exact Nova']
                }),
                resumedFusion: true,
                previewOnly: false
            })
        );
        restoredManager.stopAutoSave();
    });

    test('uses server finalization for a server-reserved lineage', async () => {
        const originalAuthority = globalThis.FusionAuthority;
        const originalCloudSave = globalThis.CloudSave;
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1,
            { operationId: 'fusion_server_commit_23' }
        );
        const childId = started.transaction.offspringIds[0];
        const pending = {
            ...started.transaction,
            status: 'staged',
            authorityRequest: {
                operationId: started.transaction.operationId
            },
            authorityReservation: {
                reservationMode: 'server_reserved'
            },
            authorityExecution: {
                receipt: { resultFingerprint: 'fnv1a32-v1:12345678' }
            },
            result: {
                hatchData: {},
                authorityReceipt: {
                    authority: 'server_generated'
                }
            }
        };
        manager.set('breedingShrine.pendingFusion', pending);
        const serverChild = {
            ...offspring(childId, started.transaction.parentIds, 'Nova'),
            lineage: {
                fusionOperationId: started.transaction.operationId
            }
        };
        const finalizeReservedOperation = jest.fn(async (
            _request,
            _reservation,
            _receipt,
            names
        ) => {
            manager.set('creatures', [
                ...manager.getCreatureCollection(),
                { ...serverChild, name: names[0] }
            ]);
            manager.set('activeCreatureIndex', 2);
            manager.set('breedingShrine.pendingFusion', null);
            return {
                revision: 9,
                replay: false,
                receipt: { completedAt: 23000 }
            };
        });
        globalThis.FusionAuthority = { finalizeReservedOperation };
        globalThis.CloudSave = { enabled: true };

        const result = await manager.finalizeFusionTransaction(
            started.transaction.operationId,
            [{ ...serverChild, name: 'Nova' }]
        );

        expect(result).toEqual(expect.objectContaining({
            success: true,
            authority: 'server_finalized',
            revision: 9,
            offspring: [
                expect.objectContaining({ id: childId, name: 'Nova' })
            ]
        }));
        expect(finalizeReservedOperation).toHaveBeenCalledWith(
            pending.authorityRequest,
            pending.authorityReservation,
            pending.authorityExecution.receipt,
            ['Nova'],
            { cloudSave: globalThis.CloudSave }
        );

        globalThis.FusionAuthority = originalAuthority;
        globalThis.CloudSave = originalCloudSave;
    });

    test('persists an authority request and result receipt into completed history', () => {
        const authority = new FusionAuthority();
        const operationId = 'fusion_authority_operation_23';
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1,
            {
                operationId,
                resultSeed: authority.deriveResultSeed(operationId, [
                    'parent_alpha',
                    'parent_beta'
                ])
            }
        );
        const request = authority.createRequest({
            transaction: started.transaction,
            parents: manager.getCreatureCollection().slice(0, 2),
            expectedSaveRevision: 9
        });
        const attached = manager.attachFusionAuthorityRequest(operationId, request);
        const reservation = {
            schemaVersion: 1,
            operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: '0123456789abcdef0123456789abcdef',
            serverResultSeed: 'fusion-server-v1:server-seed',
            offspringIds: [
                started.transaction.candidateOffspringIds[0]
            ],
            offspringCount: 1,
            reconciliationRequired: false
        };
        const reserved = manager.attachFusionAuthorityReservation(
            operationId,
            reservation
        );
        const hatchData = {
            offspringData: {
                creatureId: started.transaction.offspringIds[0],
                rarity: 'rare'
            }
        };
        const receipt = authority.createLocalReceipt(
            request,
            hatchData,
            23000,
            reservation
        );

        expect(attached.success).toBe(true);
        expect(reserved.success).toBe(true);
        expect(manager.stageFusionResult(
            operationId,
            hatchData,
            receipt
        ).success).toBe(true);
        expect(manager.commitFusionTransaction(operationId, [
            offspring(
                started.transaction.offspringIds[0],
                started.transaction.parentIds
            )
        ]).success).toBe(true);
        expect(manager.get('breedingShrine.breedingHistory')).toEqual([
            expect.objectContaining({
                operationId,
                authority: 'server_reserved_local_result',
                requestFingerprint: request.requestFingerprint,
                resultFingerprint: receipt.resultFingerprint
            })
        ]);
    });

    test('stages a server-generated result only when every reserved identity matches', () => {
        const authority = new FusionAuthority();
        const operationId = 'fusion_server_execution_23';
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1,
            { operationId, resultSeed: 'fusion-seed-v1:server-test' }
        );
        const request = authority.createRequest({
            transaction: started.transaction,
            parents: manager.getCreatureCollection().slice(0, 2),
            expectedSaveRevision: 4
        });
        manager.attachFusionAuthorityRequest(operationId, request);
        const reservation = {
            schemaVersion: 1,
            operationId,
            reservationMode: 'server_reserved',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: 'fedcba9876543210fedcba9876543210',
            offspringIds: [
                started.transaction.candidateOffspringIds[0]
            ],
            offspringCount: 1
        };
        manager.attachFusionAuthorityReservation(operationId, reservation);
        const outcome = {
            schemaVersion: 1,
            operationId,
            executionVersion: 'fusion-outcome-v1',
            offspring: [{
                offspringGenes: { id: 'genes_server_child' },
                offspringData: {
                    creatureId: started.transaction.offspringIds[0],
                    rarity: 'epic'
                }
            }]
        };
        const receipt = {
            schemaVersion: 1,
            operationId,
            authority: 'server_generated',
            requestFingerprint: request.requestFingerprint,
            serverFingerprint: reservation.serverFingerprint,
            resultFingerprint: authority.fingerprint(outcome),
            receiptFingerprint: 'fnv1a32-v1:87654321'
        };
        const execution = {
            operationId,
            outcome,
            receipt,
            replay: false
        };

        const attached = manager.attachFusionAuthorityExecution(
            operationId,
            execution
        );
        expect(attached.success).toBe(true);
        expect(manager.stageFusionResult(
            operationId,
            { offspringData: outcome.offspring[0].offspringData },
            receipt
        ).success).toBe(true);
        expect(manager.get('breedingShrine.pendingFusion')).toEqual(
            expect.objectContaining({
                status: 'staged',
                authorityExecution: expect.objectContaining({
                    executionVersion: 'fusion-outcome-v1',
                    resultFingerprint: receipt.resultFingerprint
                }),
                result: expect.objectContaining({
                    authorityReceipt: receipt
                })
            })
        );

        const altered = {
            ...execution,
            outcome: {
                ...outcome,
                offspring: [{
                    ...outcome.offspring[0],
                    offspringData: {
                        creatureId: 'creature_substituted'
                    }
                }]
            }
        };
        expect(manager.attachFusionAuthorityExecution(
            operationId,
            altered
        )).toEqual({
            success: false,
            reason: 'invalid_authority_execution'
        });
    });

    test('queues an offline receipt and blocks another lineage until cloud verification', () => {
        const authority = new FusionAuthority();
        const operationId = 'fusion_offline_queue_23';
        const started = manager.beginFusionTransaction(
            ['parent_alpha', 'parent_beta'],
            1,
            {
                operationId,
                resultSeed: 'fusion-seed-v1:offline-23'
            }
        );
        const request = authority.createRequest({
            transaction: started.transaction,
            parents: manager.getCreatureCollection().slice(0, 2),
            expectedSaveRevision: 7
        });
        manager.attachFusionAuthorityRequest(operationId, request);
        const selected = authority.selectOffspringIdentity(request);
        const reservation = {
            schemaVersion: 1,
            operationId,
            reservationMode: 'local_offline',
            requestFingerprint: request.requestFingerprint,
            offspringIds: selected.offspringIds,
            offspringCount: selected.offspringCount,
            reconciliationRequired: true,
            reason: 'network_unavailable'
        };
        expect(manager.attachFusionAuthorityReservation(
            operationId,
            reservation
        ).success).toBe(true);
        const hatchData = {
            offspringData: {
                creatureId: selected.offspringIds[0],
                rarity: 'rare'
            }
        };
        const receipt = authority.createLocalReceipt(
            request,
            hatchData,
            23000,
            reservation
        );
        manager.stageFusionResult(operationId, hatchData, receipt);
        expect(manager.commitFusionTransaction(operationId, [
            offspring(
                selected.offspringIds[0],
                started.transaction.parentIds,
                'Nova'
            )
        ])).toEqual(expect.objectContaining({ success: true }));

        expect(manager.getPendingFusionReconciliations()).toEqual([
            expect.objectContaining({
                operationId,
                request: expect.objectContaining({
                    contractVersion: 2,
                    offspringCapacity: 1
                }),
                receipt: expect.objectContaining({
                    authority: 'local_fallback',
                    reconciliationRequired: true
                }),
                offspringIds: selected.offspringIds,
                names: ['Nova'],
                status: 'pending'
            })
        ]);
        expect(manager.getBreedingShrineStatus()).toEqual(
            expect.objectContaining({
                canBreed: false,
                reconciliationPending: 1
            })
        );
        expect(
            manager.get('breedingShrine.breedingHistory')[0]
        ).toEqual(expect.objectContaining({
            operationId,
            reconciliationRequired: true,
            reconciliationStatus: 'pending'
        }));
    });

    test('switching creatures preserves portable bond, powers, portraits, and lineage', () => {
        const parent = manager.getCreatureCollection()[0];
        manager.set('creature.id', parent.id);
        manager.set('creature.name', parent.name);
        manager.set('creature.bond', { level: 9, experience: 77 });
        manager.set('creature.powerHistory', [{ id: 'power_reveal_23' }]);
        manager.set('creature.portraits', {
            schemaVersion: 1,
            activeStage: 'adult',
            byStage: { adult: { imagePath: 'private/portrait.webp' } }
        });
        manager.set('creature.lineage', {
            schemaVersion: 1,
            creatureId: parent.id,
            origin: 'hatch'
        });
        manager.set('creature.identityArchive', {
            schemaVersion: 1,
            creatureId: parent.id,
            reviewedChapterIds: ['identity'],
            firstReviewedAt: '2026-07-31T00:23:00.000Z',
            completedAt: null,
            history: []
        });

        expect(manager.switchActiveCreature(1)).toBe(true);
        expect(manager.getCreatureCollection()[0]).toEqual(expect.objectContaining({
            bond: { level: 9, experience: 77 },
            powerHistory: [{ id: 'power_reveal_23' }],
            portraits: expect.objectContaining({ activeStage: 'adult' }),
            lineage: expect.objectContaining({ origin: 'hatch' }),
            identityArchive: expect.objectContaining({
                creatureId: parent.id,
                reviewedChapterIds: ['identity']
            })
        }));
    });

    test('switching creatures clears optional identity fields that are absent from the next record', () => {
        manager.set('creature.secretAbilities', ['void_step']);
        manager.set('creature.isShiny', true);
        manager.set('creature.isTwin', true);
        manager.set('creature.twinSiblingId', 'sibling_23');

        expect(manager.switchActiveCreature(1)).toBe(true);

        expect(manager.get('creature.secretAbilities')).toBeUndefined();
        expect(manager.get('creature.isShiny')).toBeUndefined();
        expect(manager.get('creature.isTwin')).toBeUndefined();
        expect(manager.get('creature.twinSiblingId')).toBeUndefined();
    });

    test('never writes an identity-mismatched active slot into a collection record', () => {
        manager.set('creature.id', 'external_stale_identity');
        manager.set('creature.name', 'Wrong Record');
        manager.set('creature.genes', { id: 'wrong_genes' });

        expect(manager.switchActiveCreature(1)).toBe(true);

        expect(manager.getCreatureCollection()[0]).toEqual(expect.objectContaining({
            id: 'parent_alpha',
            name: 'Alpha',
            genes: expect.objectContaining({ id: 'genes_parent_alpha' })
        }));
        expect(manager.get('creature.id')).toBe('parent_beta');
    });

    test('migration aligns a legacy active slot with its stable collection identity', () => {
        const save = {
            activeCreatureIndex: 1,
            creature: {
                name: 'Beta',
                genes: { id: 'genes_parent_beta' },
                identityArchive: {
                    creatureId: 'wrong_identity',
                    reviewedChapterIds: [
                        'identity',
                        'shared_journey'
                    ],
                    history: [{
                        operationId: 'Review Identity',
                        chapterId: 'identity',
                        dialogue: 'private imported text'
                    }]
                }
            },
            creatures: [
                adultCreature('parent_alpha', 'Alpha'),
                {
                    ...adultCreature('parent_beta', 'Beta'),
                    id: undefined
                }
            ]
        };

        manager.migrateCreaturePortability(save);

        expect(save.creatures[1].id).toBe('creature_genes_parent_beta');
        expect(save.creature.id).toBe(save.creatures[1].id);
        expect(save.creature.lineage).toEqual(expect.objectContaining({
            creatureId: save.creatures[1].id,
            origin: 'hatch'
        }));
        expect(save.creature.identityArchive).toEqual(
            expect.objectContaining({
                creatureId: save.creatures[1].id,
                reviewedChapterIds: ['identity'],
                history: [
                    expect.objectContaining({
                        operationId: 'review_identity',
                        chapterId: 'identity'
                    })
                ]
            })
        );
        expect(JSON.stringify(save.creature.identityArchive))
            .not.toContain('private imported text');
    });

    test('reconciles inactive healthy creatures to their age-derived stage', () => {
        const now = Date.parse('2026-07-30T12:00:00.000Z');
        const inactive = adultCreature('inactive_old', 'Old Signal');
        inactive.lifecycle = {
            stage: 'baby',
            birthDate: now - 3 * 24 * 60 * 60 * 1000,
            evolutionHistory: []
        };
        manager.set('creatures', [
            adultCreature('active_adult', 'Active'),
            inactive
        ]);
        manager.set('activeCreatureIndex', 0);

        const result = manager.reconcileCreatureCollectionLifecycles({ now });
        const reconciled = manager.getCreatureCollection()[1];

        expect(result).toEqual({
            changed: true,
            updatedIds: ['inactive_old']
        });
        expect(reconciled.lifecycle.stage).toBe('adult');
        expect(reconciled.lifecycle.evolutionHistory.map(entry => entry.stage))
            .toEqual(['juvenile', 'adult']);
        expect(manager.isFusionEligibleCreature(reconciled, now)).toBe(true);
    });

    test.each([
        ['low happiness', { stats: { happiness: 20 }, mood: { current: 'neutral' } }],
        ['sad mood', { stats: { happiness: 100 }, mood: { current: 'sad' } }],
        ['stuck lifecycle', {
            stats: { happiness: 100 },
            mood: { current: 'happy' },
            lifecycle: { isStuck: true }
        }]
    ])('does not mature an inactive creature blocked by %s', (_label, override) => {
        const now = Date.parse('2026-07-30T12:00:00.000Z');
        const blocked = adultCreature('blocked_old', 'Blocked');
        blocked.stats = override.stats || blocked.stats;
        blocked.mood = override.mood || { current: 'happy' };
        blocked.lifecycle = {
            stage: 'baby',
            birthDate: now - 10 * 24 * 60 * 60 * 1000,
            evolutionHistory: [],
            ...(override.lifecycle || {})
        };
        manager.set('creatures', [blocked]);
        manager.set('activeCreatureIndex', 0);

        expect(manager.reconcileCreatureCollectionLifecycles({ now })).toEqual({
            changed: false,
            updatedIds: []
        });
        expect(manager.getCreatureCollection()[0].lifecycle.stage).toBe('baby');
    });

    test('treats level five as unlocked even when a legacy save missed the unlock event', () => {
        manager.set('breedingShrine.unlocked', false);
        manager.set('creature.level', 5);

        expect(manager.getBreedingShrineStatus()).toEqual(expect.objectContaining({
            unlocked: true,
            canBreed: true
        }));
    });

    test('exposes one authoritative readiness record for Fusion UI and transactions', () => {
        const now = Date.parse('2026-07-30T12:00:00.000Z');
        const ready = adultCreature('ready_parent', 'Ready');
        const growing = adultCreature('growing_parent', 'Growing');
        growing.lifecycle = {
            stage: 'juvenile',
            birthDate: now - 24 * 60 * 60 * 1000
        };
        manager.set('creatures', [ready, growing]);

        const status = manager.getFusionReadinessStatus(now);

        expect(status).toEqual(expect.objectContaining({
            collectionCount: 2,
            eligibleCount: 1,
            ready: false
        }));
        expect(status.companions[1]).toEqual(expect.objectContaining({
            id: 'growing_parent',
            reason: 'maturing',
            remainingMs: 24 * 60 * 60 * 1000
        }));
        expect(manager.isFusionEligibleCreature(growing, now)).toBe(false);
    });
});
