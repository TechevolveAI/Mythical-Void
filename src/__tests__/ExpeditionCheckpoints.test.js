/** @jest-environment node */
const { checkpointHelpers, checkpointFixture } = require('./support/expeditionCheckpointFixtures.cjs');
const { getExpeditionCheckpointDefinition, getExpeditionCheckpointResume } = checkpointHelpers;

const routes = [
    ['mythical_forest', 'MythicalForestLevel', 'mythicalForest', 'forest_anchor_'],
    ['crystal_caves', 'CrystalCavesLevel', 'crystalCaves', 'caves_anchor_'],
    ['stellar_reef', 'ReefLevel', 'cosmicReef', 'reef_waypoint_'],
    ['void_peaks', 'VoidPeaksLevel', 'voidPeaks', 'peaks_relay_'],
    ['aurora_depths', 'AuroraDepthsLevel', 'auroraDepths', 'aurora_prism_'],
    ['final_void', 'FinalVoidLevel', 'finalVoid', 'final_bond_']
];

function stateFor(checkpoint, completedPath = null) {
    return {
        get: key => key === 'story.projectBeacon.expeditionCheckpoint'
            ? checkpoint : key === completedPath,
        set: jest.fn(), save: jest.fn()
    };
}

describe('read-only expedition resume metadata', () => {
    test.each(routes)('%s retains every saved place ID and legacy sequential count', (gateId, sceneKey, levelStateId, prefix) => {
        const definition = getExpeditionCheckpointDefinition(gateId);
        expect(definition).toBe(getExpeditionCheckpointDefinition(sceneKey));
        expect(definition.levelStateId).toBe(levelStateId);
        expect(Object.isFrozen(definition.checkpoints)).toBe(true);
        for (let index = 0; index < 3; index += 1) {
            const checkpoint = checkpointFixture(gateId, index, { version: 1, routeSignalMask: undefined });
            const state = stateFor(checkpoint);
            expect(getExpeditionCheckpointResume(state, gateId)).toMatchObject({
                checkpointId: `${prefix}${index + 1}`, sceneKey, gateId,
                current: index + 1, total: 3
            });
            expect(state.set).not.toHaveBeenCalled();
            expect(state.save).not.toHaveBeenCalled();
        }
    });

    test.each(routes)('%s accepts non-sequential current saves and refuses completed routes', (gateId, sceneKey, levelStateId) => {
        const checkpoint = checkpointFixture(gateId, 2, { routeSignalMask: 4 });
        const before = JSON.stringify(checkpoint);
        expect(getExpeditionCheckpointResume(stateFor(checkpoint))).toMatchObject({
            gateId, sceneKey, current: 1, total: 3
        });
        expect(getExpeditionCheckpointResume(stateFor(checkpoint, `levels.${levelStateId}.completed`))).toBeNull();
        expect(JSON.stringify(checkpoint)).toBe(before);
    });

    test.each([
        null, {}, { sceneKey: 'UnknownScene' },
        { sceneKey: 'crystal_caves' }, { levelId: 'reef_1' },
        { version: 0 }, { version: 3 }, { version: '2' },
        { checkpointIndex: -1 }, { checkpointIndex: 3 }, { checkpointIndex: 1.5 },
        { checkpointId: 'caves_anchor_1' }, { routeSignalMask: 0 },
        { routeSignalMask: undefined }, { routeSignalMask: 1 }, { routeSignalMask: 8 },
        { routeSignalMask: '3' }, { version: 1, routeSignalMask: 1 },
        { x: undefined }, { x: null }, { x: '' }, { x: false },
        { x: -1 }, { x: NaN }, { x: Infinity }, { y: 'invalid' }
    ])('does not advertise or mutate unsupported checkpoint %j', overrides => {
        const checkpoint = overrides === null || Object.keys(overrides).length === 0
            ? overrides : checkpointFixture('crystal_caves', 1, overrides);
        const state = stateFor(checkpoint);
        const before = JSON.stringify(checkpoint);
        expect(getExpeditionCheckpointResume(state)).toBeNull();
        expect(JSON.stringify(checkpoint)).toBe(before);
        expect(state.set).not.toHaveBeenCalled();
        expect(state.save).not.toHaveBeenCalled();
    });

    test('retains numeric-string compatibility and ignores saved presentation aliases', () => {
        const checkpoint = checkpointFixture('crystal_caves', 1, {
            x: '500', y: '450', checkpointIndex: '1',
            gateId: 'stellar_reef', levelStateId: 'cosmicReef',
            levelStatePath: 'levels.cosmicReef', label: 'Wrong place'
        });
        expect(getExpeditionCheckpointResume(stateFor(checkpoint))).toMatchObject({
            gateId: 'crystal_caves', label: 'Living Chamber'
        });
        expect(getExpeditionCheckpointResume(stateFor(checkpoint), 'stellar_reef')).toBeNull();
    });
});
