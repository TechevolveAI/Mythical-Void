const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCurrentEcology() {
    const filePath = path.join(__dirname, '../systems/CurrentEcology.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${source}
        module.exports = {
            CURRENT_ECOLOGY_SCHEMA_VERSION,
            CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
            CURRENT_NODE_STATES,
            CURRENT_REGION_ACTIONS,
            CURRENT_ARRIVAL_CLASSIFICATIONS,
            CURRENT_REGION_DEFINITIONS,
            getCurrentRegionActionPresentation,
            createInitialCurrentEcologyState,
            normalizeCurrentEcologyState,
            getCurrentNodeState,
            getCurrentEcologySummary,
            getCurrentEcologySnapshot,
            getCurrentRegionSnapshot,
            getCurrentRegionProjection,
            getCurrentArrivalConsequencePresentation,
            applyCurrentArrivalConsequence,
            recordCurrentSignalObservation,
            recordCurrentRegionAction,
            recordCurrentRegionRestoration
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Object,
        Array,
        Set,
        Map,
        Number,
        String,
        Math
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(overrides = {}) {
    const state = {
        world: {
            currentEcology: {}
        },
        levels: {},
        ...overrides
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath
                .split('.')
                .reduce((value, key) => value?.[key], state);
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('Current ecology domain model', () => {
    const {
        CURRENT_ECOLOGY_SCHEMA_VERSION,
        CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
        CURRENT_NODE_STATES,
        CURRENT_REGION_ACTIONS,
        CURRENT_ARRIVAL_CLASSIFICATIONS,
        CURRENT_REGION_DEFINITIONS,
        getCurrentRegionActionPresentation,
        createInitialCurrentEcologyState,
        normalizeCurrentEcologyState,
        getCurrentNodeState,
        getCurrentEcologySummary,
        getCurrentEcologySnapshot,
        getCurrentRegionSnapshot,
        getCurrentRegionProjection,
        getCurrentArrivalConsequencePresentation,
        applyCurrentArrivalConsequence,
        recordCurrentSignalObservation,
        recordCurrentRegionAction,
        recordCurrentRegionRestoration
    } = loadCurrentEcology();

    const observeRegion = (gameState, levelId, operationId) =>
        recordCurrentRegionAction(
            gameState,
            levelId,
            CURRENT_REGION_ACTIONS.OBSERVE,
            { operationId }
        );

    test('defines a versioned portable state with every campaign region', () => {
        const state = createInitialCurrentEcologyState();

        expect(state.schemaVersion).toBe(CURRENT_ECOLOGY_SCHEMA_VERSION);
        expect(Object.keys(state.regions)).toHaveLength(6);
        expect(Object.keys(state.regions)).toEqual(
            CURRENT_REGION_DEFINITIONS.map(region => region.id)
        );
        expect(state.observedSignalIds).toEqual([]);
        expect(state.restoredRegionIds).toEqual([]);
        expect(state.arrivalConsequences).toEqual({});
        expect(state.history).toEqual([]);
    });

    test('separates learning about the Current from healing it', () => {
        const gameState = createGameState();

        recordCurrentSignalObservation(gameState, 'echo_bloom', {
            occurredAt: '2026-07-30T12:00:00.000Z'
        });
        recordCurrentSignalObservation(gameState, 'memory_stone', {
            occurredAt: '2026-07-30T12:01:00.000Z'
        });
        const result = recordCurrentSignalObservation(
            gameState,
            'rootlight',
            { occurredAt: '2026-07-30T12:02:00.000Z' }
        );

        expect(result.summary.awareness).toBe('network_confirmed');
        expect(result.summary.observedSignals).toBe(3);
        expect(result.summary.restoredCount).toBe(0);
        expect(result.summary.networkStatus).toBe('strained');
    });

    test('projects vitality into the four canonical Current states', () => {
        expect(getCurrentNodeState(10)).toBe(CURRENT_NODE_STATES.SEVERED);
        expect(getCurrentNodeState(28)).toBe(CURRENT_NODE_STATES.FADING);
        expect(getCurrentNodeState(60)).toBe(CURRENT_NODE_STATES.LIVING);
        expect(getCurrentNodeState(72, true)).toBe(CURRENT_NODE_STATES.RESTORED);

        expect(getCurrentRegionProjection({
            vitality: 60,
            guardianRestored: false
        })).toEqual(expect.objectContaining({
            nodeState: 'living',
            label: 'LIVING',
            lifeDensity: 0.68
        }));
    });

    test('resolves progression and runtime scene level identities', () => {
        const gameState = createGameState();
        [
            ['mythicalForest', 'mythical_forest_1', 'mythical_forest'],
            ['crystalCaves', 'crystal_caves_1', 'crystal_caves'],
            ['cosmicReef', 'reef_1', 'stellar_reef'],
            ['voidPeaks', 'void_peaks_1', 'void_peaks'],
            ['auroraDepths', 'aurora_depths_1', 'aurora_depths'],
            ['finalVoid', 'final_void_1', 'current_heart']
        ].forEach(([progressionId, runtimeId, regionId]) => {
            const progressionSnapshot = getCurrentRegionSnapshot(
                gameState,
                progressionId
            );
            const runtimeSnapshot = getCurrentRegionSnapshot(
                gameState,
                runtimeId
            );

            expect(runtimeSnapshot.definition.id).toBe(regionId);
            expect(runtimeSnapshot.region).toEqual(
                progressionSnapshot.region
            );
            expect(runtimeSnapshot.projection).toEqual(
                progressionSnapshot.projection
            );
        });
    });

    test('makes extraction immediately useful but visibly reversible', () => {
        const gameState = createGameState();
        observeRegion(gameState, 'mythicalForest', 'scan_before_siphon_23');
        const siphoned = recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.SIPHON,
            {
                operationId: 'test_siphon_23',
                occurredAt: '2026-07-30T12:10:00.000Z'
            }
        );
        const redirected = recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.REDIRECT,
            {
                operationId: 'test_redirect_23',
                occurredAt: '2026-07-30T12:11:00.000Z'
            }
        );

        expect(siphoned).toEqual(expect.objectContaining({
            beforeVitality: 28,
            afterVitality: 14
        }));
        expect(siphoned.projection.nodeState).toBe('severed');
        expect(redirected).toEqual(expect.objectContaining({
            beforeVitality: 14,
            afterVitality: 26
        }));
        expect(redirected.projection.nodeState).toBe('fading');
        expect(redirected.summary).toEqual(expect.objectContaining({
            extractionActions: 1,
            careActions: 1
        }));
    });

    test('carries earlier care and extraction into a later realm once', () => {
        const gameState = createGameState();
        observeRegion(gameState, 'mythicalForest', 'scan_forest_23');
        recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.SIPHON,
            { operationId: 'forest_sample_23' }
        );
        observeRegion(gameState, 'crystalCaves', 'scan_caves_77');
        recordCurrentRegionAction(
            gameState,
            'crystalCaves',
            CURRENT_REGION_ACTIONS.PROTECT,
            { operationId: 'caves_care_77' }
        );
        gameState.save.mockClear();

        const firstArrival = applyCurrentArrivalConsequence(
            gameState,
            'reef_1',
            { occurredAt: '2026-07-31T04:23:00.000Z' }
        );
        const retry = applyCurrentArrivalConsequence(
            gameState,
            'cosmicReef'
        );
        const snapshot = getCurrentRegionSnapshot(
            gameState,
            'stellar_reef'
        );

        expect(firstArrival).toEqual(expect.objectContaining({
            changed: true,
            beforeVitality: 34,
            afterVitality: 31
        }));
        expect(firstArrival.consequence).toEqual({
            schemaVersion:
                CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
            regionId: 'stellar_reef',
            sourceRegionIds: [
                'mythical_forest',
                'crystal_caves'
            ],
            extractionActions: 1,
            careActions: 1,
            vitalityDelta: -3,
            classification:
                CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE,
            operationId: 'arrival:stellar_reef',
            appliedAt: '2026-07-31T04:23:00.000Z'
        });
        expect(retry).toEqual(expect.objectContaining({
            changed: false,
            reason: 'already_applied'
        }));
        expect(snapshot.arrivalConsequence.presentation).toEqual(
            expect.objectContaining({
                label: 'MIXED CURRENT',
                amountLabel: '-3'
            })
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('lets prior care strengthen a later habitat without erasing history', () => {
        const gameState = createGameState();
        observeRegion(gameState, 'mythicalForest', 'scan_forest_care_23');
        recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.PROTECT,
            { operationId: 'forest_protect_23' }
        );
        observeRegion(gameState, 'crystalCaves', 'scan_caves_care_77');
        recordCurrentRegionAction(
            gameState,
            'crystalCaves',
            CURRENT_REGION_ACTIONS.REDIRECT,
            { operationId: 'caves_redirect_77' }
        );

        const arrival = applyCurrentArrivalConsequence(
            gameState,
            'stellar_reef'
        );

        expect(arrival).toEqual(expect.objectContaining({
            beforeVitality: 34,
            afterVitality: 38
        }));
        expect(arrival.presentation).toEqual(expect.objectContaining({
            label: 'CARE RESONANCE',
            amountLabel: '+4'
        }));
        expect(arrival.summary).toEqual(expect.objectContaining({
            arrivalConsequenceCount: 1,
            extractionTraceRegionIds: [],
            netArrivalVitalityDelta: 4
        }));
    });

    test('deduplicates retried region operations for future cloud authority', () => {
        const gameState = createGameState();
        observeRegion(gameState, 'crystalCaves', 'scan_before_shared_77');
        gameState.save.mockClear();
        const actionOptions = {
            operationId: 'shared_operation_77',
            occurredAt: '2026-07-30T12:20:00.000Z'
        };
        const first = recordCurrentRegionAction(
            gameState,
            'crystalCaves',
            CURRENT_REGION_ACTIONS.PROTECT,
            actionOptions
        );
        const retry = recordCurrentRegionAction(
            gameState,
            'crystalCaves',
            CURRENT_REGION_ACTIONS.PROTECT,
            actionOptions
        );

        expect(first.changed).toBe(true);
        expect(retry).toEqual(expect.objectContaining({
            changed: false,
            duplicate: true,
            reason: 'duplicate_operation'
        }));
        expect(retry.region.vitality).toBe(28);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('requires a non-invasive scan before care or extraction', () => {
        const gameState = createGameState();
        const blocked = recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.SIPHON,
            { operationId: 'unscanned_siphon_23' }
        );

        expect(blocked).toEqual(expect.objectContaining({
            changed: false,
            reason: 'observation_required',
            region: expect.objectContaining({ vitality: 28 })
        }));
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('publishes truthful player-facing effects for every field action', () => {
        expect(getCurrentRegionActionPresentation('observe')).toEqual(
            expect.objectContaining({
                effectLabel: 'NO VITALITY CHANGE',
                vitalityDelta: 0
            })
        );
        expect(getCurrentRegionActionPresentation('protect').effectLabel)
            .toBe('+8 VITALITY');
        expect(getCurrentRegionActionPresentation('redirect').effectLabel)
            .toBe('+12 VITALITY');
        expect(getCurrentRegionActionPresentation('siphon')).toEqual(
            expect.objectContaining({
                effectLabel: '-14 VITALITY / +1 CHARGE',
                vitalityDelta: -14
            })
        );
    });

    test('records non-invasive observation once and preserves it through restoration', () => {
        const gameState = createGameState();
        recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.OBSERVE,
            { operationId: 'observe_forest' }
        );
        const repeated = recordCurrentRegionAction(
            gameState,
            'mythicalForest',
            CURRENT_REGION_ACTIONS.OBSERVE,
            { operationId: 'observe_forest_again' }
        );
        recordCurrentRegionRestoration(gameState, 'mythicalForest');
        const snapshot = getCurrentRegionSnapshot(gameState, 'mythicalForest');

        expect(repeated.reason).toBe('already_observed');
        expect(snapshot.region).toEqual(expect.objectContaining({
            nodeState: 'restored',
            evidence: 'guardian_restored',
            actionCounts: expect.objectContaining({ observe: 1 })
        }));
        expect(snapshot.projection.label).toBe('RESTORED');
    });

    test('guardian restoration visibly improves one region and the network', () => {
        const gameState = createGameState();
        const result = recordCurrentRegionRestoration(
            gameState,
            'mythicalForest',
            { occurredAt: '2026-07-30T13:00:00.000Z' }
        );

        expect(result).toEqual(expect.objectContaining({
            changed: true,
            regionId: 'mythical_forest',
            regionLabel: 'Mythical Forest',
            beforeVitality: 28,
            afterVitality: 72
        }));
        expect(result.summary).toEqual(expect.objectContaining({
            networkStatus: 'recovering',
            restoredCount: 1,
            totalRegions: 6
        }));
        expect(gameState.emit).toHaveBeenCalledWith(
            'currentEcologyChanged',
            expect.objectContaining({
                type: 'region_restored',
                regionId: 'mythical_forest'
            })
        );
    });

    test('is idempotent so retries cannot duplicate network history', () => {
        const gameState = createGameState();
        const first = recordCurrentRegionRestoration(
            gameState,
            'crystalCaves'
        );
        const second = recordCurrentRegionRestoration(
            gameState,
            'crystalCaves'
        );

        expect(first.changed).toBe(true);
        expect(second.changed).toBe(false);
        expect(gameState.state.world.currentEcology.history).toHaveLength(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('migrates completed regions from older saves without inventing dates', () => {
        const gameState = createGameState({
            world: {},
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true }
            }
        });

        const snapshot = getCurrentEcologySnapshot(gameState);

        expect(snapshot.summary.restoredRegionIds).toEqual([
            'mythical_forest',
            'crystal_caves'
        ]);
        expect(snapshot.state.regions.mythical_forest).toEqual(
            expect.objectContaining({
                guardianRestored: true,
                restoredAt: null,
                evidence: 'legacy_completion'
            })
        );
    });

    test('normalizes malformed or foreign identifiers at the sync boundary', () => {
        const normalized = normalizeCurrentEcologyState({
            observedSignalIds: ['echo_bloom', 'foreign_signal'],
            restoredRegionIds: ['mythical_forest', 'foreign_region'],
            arrivalConsequences: {
                stellar_reef: {
                    sourceRegionIds: [
                        'mythical_forest',
                        'foreign_region'
                    ],
                    extractionActions: 1,
                    careActions: 2,
                    vitalityDelta: -999,
                    classification: 'remote_override',
                    operationId: 'arrival:stellar_reef',
                    appliedAt: '2026-07-31T04:23:00.000Z'
                },
                foreign_region: {
                    extractionActions: 999
                }
            },
            history: [
                {
                    id: 'signal:echo_bloom',
                    type: 'signal_observed',
                    subjectId: 'echo_bloom'
                },
                {
                    id: 'bad',
                    type: 'remote_command',
                    subjectId: 'foreign'
                }
            ]
        });
        const summary = getCurrentEcologySummary(normalized);

        expect(normalized.observedSignalIds).toEqual(['echo_bloom']);
        expect(normalized.restoredRegionIds).toEqual(['mythical_forest']);
        expect(normalized.history).toHaveLength(1);
        expect(normalized.arrivalConsequences).toEqual({
            stellar_reef: {
                schemaVersion:
                    CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
                regionId: 'stellar_reef',
                sourceRegionIds: ['mythical_forest'],
                extractionActions: 1,
                careActions: 2,
                vitalityDelta: -20,
                classification:
                    CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE,
                operationId: 'arrival:stellar_reef',
                appliedAt: '2026-07-31T04:23:00.000Z'
            }
        });
        expect(summary.restoredCount).toBe(1);
        expect(
            getCurrentArrivalConsequencePresentation(
                normalized.arrivalConsequences.stellar_reef
            ).fieldLine
        ).toContain('damage');
    });
});
