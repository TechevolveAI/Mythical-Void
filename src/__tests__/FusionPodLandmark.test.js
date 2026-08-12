const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFusionPodLandmark() {
    const filePath = path.join(
        __dirname,
        '../systems/FusionPodLandmark.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                FUSION_POD_LANDMARK_SCHEMA_VERSION,
                getFusionPodLandmarkSnapshot,
                formatFusionPodLandmarkObjective
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Object,
        Array,
        Math,
        Number,
        String,
        Boolean
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function companion(id, stage = 'baby') {
    return {
        id,
        lifecycle: { stage }
    };
}

function createGameState({
    creatures = [],
    level = 1,
    discovered = creatures.length >= 2,
    status = {},
    capacity = 8
} = {}) {
    const state = {
        creatures,
        creature: { level },
        breedingShrine: {
            discovery: {
                state: discovered ? 'two_signals' : 'dormant'
            }
        },
        maxCreatures: capacity
    };
    return {
        get(pathValue) {
            return pathValue.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        getCreatureCollection: () => creatures,
        getCreatureFusionReadiness: creature => ({
            eligible: ['adult', 'elder'].includes(creature.lifecycle.stage)
        }),
        getBreedingShrineStatus: () => ({
            unlocked: level >= 5,
            currentLevel: level,
            levelRequirement: 5,
            cooldownRemaining: 0,
            reconciliationPending: 0,
            sharedFusionPending: null,
            ...status
        }),
        getCollectionStatus: () => ({
            count: creatures.length,
            max: capacity
        })
    };
}

describe('Fusion Pod Sanctuary landmark', () => {
    const {
        getFusionPodLandmarkSnapshot,
        formatFusionPodLandmarkObjective
    } = loadFusionPodLandmark();

    test('explains the dormant and field-calibration discovery stages', () => {
        const dormant = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [companion('alpha')],
                level: 2,
                discovered: false
            })
        );
        expect(dormant).toEqual(expect.objectContaining({
            state: 'dormant',
            statusLabel: 'TWO LIVING SIGNALS REQUIRED',
            canOpen: false
        }));
        expect(formatFusionPodLandmarkObjective(dormant)).toContain(
            'Rescue a second companion'
        );

        const calibrating = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [
                    companion('alpha'),
                    companion('beta')
                ],
                level: 3
            })
        );
        expect(calibrating).toEqual(expect.objectContaining({
            state: 'calibrating',
            statusLabel: 'FIELD CALIBRATION 3/5',
            canOpen: false
        }));
        expect(formatFusionPodLandmarkObjective(calibrating)).toContain(
            'field level 5'
        );
    });

    test('distinguishes maturing, local-ready, and protected shared-ready signals', () => {
        const maturing = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [
                    companion('alpha', 'adult'),
                    companion('beta', 'baby')
                ],
                level: 5
            })
        );
        expect(maturing).toEqual(expect.objectContaining({
            state: 'maturing',
            statusLabel: 'ADULT SIGNALS 1/2',
            canOpen: true
        }));

        const ready = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [
                    companion('alpha', 'adult'),
                    companion('beta', 'elder')
                ],
                level: 5
            })
        );
        expect(ready).toEqual(expect.objectContaining({
            state: 'ready',
            tone: 'ready',
            statusLabel: 'TWO ADULT SIGNALS READY'
        }));

        const sharedReady = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [companion('alpha', 'adult')],
                level: 5
            }),
            { sharedAvailable: true }
        );
        expect(sharedReady).toEqual(expect.objectContaining({
            state: 'shared_ready',
            statusLabel: 'PROTECTED LINK READY'
        }));
    });

    test.each([
        [
            { reconciliationPending: 1 },
            'verification_required',
            'VERIFY PRIOR LINEAGE'
        ],
        [
            { sharedFusionPending: { operationId: 'shared_23' } },
            'shared_link_active',
            'PROTECTED SHARED LINK ACTIVE'
        ],
        [
            { cooldownRemaining: 3660000 },
            'recharging',
            'RECHARGING 1H 1M'
        ]
    ])(
        'prioritizes protected transaction state %s',
        (status, state, statusLabel) => {
            const snapshot = getFusionPodLandmarkSnapshot(
                createGameState({
                    creatures: [
                        companion('alpha', 'adult'),
                        companion('beta', 'adult')
                    ],
                    level: 5,
                    status
                })
            );
            expect(snapshot).toEqual(expect.objectContaining({
                state,
                statusLabel
            }));
        }
    );

    test('reports full capacity before advertising a ready lineage', () => {
        const snapshot = getFusionPodLandmarkSnapshot(
            createGameState({
                creatures: [
                    companion('alpha', 'adult'),
                    companion('beta', 'adult')
                ],
                level: 5,
                capacity: 2
            })
        );
        expect(snapshot).toEqual(expect.objectContaining({
            state: 'capacity_full',
            statusLabel: 'SANCTUARY CAPACITY FULL'
        }));
        expect(formatFusionPodLandmarkObjective(snapshot)).toContain(
            'Make Sanctuary capacity'
        );
    });
});
