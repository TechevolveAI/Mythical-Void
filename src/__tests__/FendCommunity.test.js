const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFendCommunity() {
    const filePath = path.join(__dirname, '../systems/FendCommunity.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = GET_CURRENT_ECOLOGY_SNAPSHOT;'
        )
        .replace(
            "import { normalizeSignalGardenState } from './SignalGarden.js';",
            'const normalizeSignalGardenState = NORMALIZE_SIGNAL_GARDEN_STATE;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \\(typeof window !== 'undefined'\\) \\{[\\s\\S]*$/, '')
        .concat(`
            module.exports = {
                FEND_COMMUNITY_SCHEMA_VERSION,
                FEND_COMMUNITY_PROJECTS,
                normalizeFendCommunityState,
                getFendCommunityEvidence,
                getFendCommunitySnapshot,
                formatFendCommunityObjective,
                advanceFendCommunityProject
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_CURRENT_ECOLOGY_SNAPSHOT: gameState => {
            const ecology = gameState.get('world.currentEcology') || {};
            return {
                summary: {
                    restoredCount: ecology.restoredCount || 0,
                    careActions: ecology.careActions || 0,
                    observedSignals: ecology.observedSignals || 0
                }
            };
        },
        NORMALIZE_SIGNAL_GARDEN_STATE: state => ({
            tendCount: Math.max(0, Number(state?.tendCount) || 0)
        }),
        Date,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    tendCount = 0,
    restoredCount = 0,
    careActions = 0,
    observedSignals = 0,
    highPowerRescues = 0,
    uplinkRestored = false,
    community = {}
} = {}) {
    const state = {
        world: {
            signalGarden: { tendCount },
            currentEcology: {
                restoredCount,
                careActions,
                observedSignals
            },
            fendCommunity: community
        },
        creature: {
            agencyHistory: Array.from(
                { length: highPowerRescues },
                (_, index) => ({
                    type: 'high_power_rescue',
                    decisionId: `rescue_${index}`
                })
            )
        },
        story: {
            projectBeacon: {
                uplinkRestored,
                highPowerReveals: []
            }
        }
    };

    return {
        state,
        get(pathName) {
            return pathName.split('.').reduce((value, key) => value?.[key], state);
        },
        set: jest.fn((pathName, value) => {
            const keys = pathName.split('.');
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

describe('Fend community recovery', () => {
    const {
        normalizeFendCommunityState,
        getFendCommunitySnapshot,
        formatFendCommunityObjective,
        advanceFendCommunityProject
    } = loadFendCommunity();

    test('requires an ordered chain of visible community projects', () => {
        const normalized = normalizeFendCommunityState({
            builtProjectIds: [
                'trailhead_shelter',
                'wayfinder_relay',
                'living_commons'
            ]
        });

        expect(Array.from(normalized.builtProjectIds)).toEqual([
            'trailhead_shelter'
        ]);
    });

    test('builds the shelter once when garden and restoration evidence exist', () => {
        const gameState = createGameState({
            tendCount: 1,
            restoredCount: 1
        });
        const result = advanceFendCommunityProject(gameState, {
            contributedAt: '2026-07-30T18:23:00.000Z'
        });

        expect(result.changed).toBe(true);
        expect(result.project.id).toBe('trailhead_shelter');
        expect(result.snapshot.stage).toBe(1);
        expect(result.snapshot.support.maxHealthBonus).toBe(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'fendCommunityChanged',
            expect.objectContaining({
                projectId: 'trailhead_shelter',
                stage: 1
            })
        );

        const repeated = advanceFendCommunityProject(gameState);
        expect(repeated.changed).toBe(false);
        expect(repeated.reason).toBe('requirements_missing');
    });

    test('unlocks expedition support in stages without a spendable currency', () => {
        const gameState = createGameState({
            tendCount: 3,
            restoredCount: 6,
            careActions: 2,
            observedSignals: 3,
            community: {
                builtProjectIds: [
                    'trailhead_shelter',
                    'current_well',
                    'wayfinder_relay'
                ]
            }
        });
        const snapshot = getFendCommunitySnapshot(gameState);

        expect(snapshot.stage).toBe(3);
        expect(snapshot.support).toEqual({
            maxHealthBonus: 1,
            maxEnergyBonus: 1,
            guardCharges: 1,
            commonsNetwork: false
        });
        expect(snapshot.nextProject.id).toBe('living_commons');
        expect(formatFendCommunityObjective(snapshot)).toContain(
            'creature rescue witnessed'
        );
    });

    test('establishes the commons only after full recovery, witnessed power, and held uplink', () => {
        const gameState = createGameState({
            tendCount: 3,
            restoredCount: 6,
            careActions: 3,
            observedSignals: 3,
            highPowerRescues: 1,
            uplinkRestored: true,
            community: {
                builtProjectIds: [
                    'trailhead_shelter',
                    'current_well',
                    'wayfinder_relay'
                ],
                contributionHistory: [
                    {
                        operationId: 'community:trailhead_shelter',
                        projectId: 'trailhead_shelter',
                        contributedAt: '2026-07-27T12:00:00.000Z'
                    },
                    {
                        operationId: 'community:current_well',
                        projectId: 'current_well',
                        contributedAt: '2026-07-28T12:00:00.000Z'
                    },
                    {
                        operationId: 'community:wayfinder_relay',
                        projectId: 'wayfinder_relay',
                        contributedAt: '2026-07-29T12:00:00.000Z'
                    }
                ]
            }
        });

        const before = getFendCommunitySnapshot(gameState);
        expect(before.nextProject.ready).toBe(true);

        const result = advanceFendCommunityProject(gameState, {
            contributedAt: '2026-07-30T23:00:00.000Z',
            operationId: 'community:living_commons'
        });

        expect(result.snapshot.complete).toBe(true);
        expect(result.snapshot.support.commonsNetwork).toBe(true);
        expect(result.snapshot.state.foundedAt).toBe(
            '2026-07-27T12:00:00.000Z'
        );
    });

    test('does not save when the next project requirements are missing', () => {
        const gameState = createGameState();
        const result = advanceFendCommunityProject(gameState);

        expect(result.changed).toBe(false);
        expect(result.reason).toBe('requirements_missing');
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
    });
});
