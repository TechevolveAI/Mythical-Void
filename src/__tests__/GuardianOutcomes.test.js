const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGuardianOutcomes() {
    const filePath = path.join(__dirname, '../systems/GuardianOutcomes.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`module.exports = {
            GUARDIAN_OUTCOME_DEFINITIONS,
            GUARDIAN_OUTCOME_TYPES,
            normalizeGuardianOutcomeState,
            getGuardianOutcomeSnapshot,
            recordGuardianOutcome
        };`);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Map,
        Set,
        Object,
        Array,
        String
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({ levels = {}, guardianResidents = {}, outcomes = {} } = {}) {
    const state = {
        levels,
        world: { guardianResidents, guardianOutcomes: outcomes }
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
                current[key] ||= {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('GuardianOutcomes', () => {
    const outcomes = loadGuardianOutcomes();

    test('defines six regional outcomes but only one Sanctuary presence', () => {
        expect(outcomes.GUARDIAN_OUTCOME_DEFINITIONS).toHaveLength(6);
        expect(outcomes.GUARDIAN_OUTCOME_DEFINITIONS.filter(
            entry => entry.sanctuaryPresence !== 'none'
        ).map(entry => entry.guardianId)).toEqual(['elder_treant']);
    });

    test('migrates completed levels into regional outcomes without importing bosses', () => {
        const gameState = createGameState({
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true }
            }
        });
        const snapshot = outcomes.getGuardianOutcomeSnapshot(gameState);

        expect(snapshot.resolved.map(entry => entry.guardianId)).toEqual([
            'elder_treant',
            'crystal_golem'
        ]);
        expect(snapshot.sanctuaryPresences.map(entry => entry.guardianId))
            .toEqual(['elder_treant']);
        expect(snapshot.resolved[1].standing).toBe('regional_guardian');
    });

    test('records outcomes idempotently and supports later defeated outcomes', () => {
        const gameState = createGameState();
        const first = outcomes.recordGuardianOutcome(
            gameState,
            'crystalCaves',
            { resolvedAt: '2026-08-23T09:23:00.000Z' }
        );
        const replay = outcomes.recordGuardianOutcome(
            gameState,
            'crystalCaves',
            { resolvedAt: '2026-08-23T09:24:00.000Z' }
        );
        const defeated = outcomes.recordGuardianOutcome(
            gameState,
            'crystalCaves',
            {
                outcome: 'defeated',
                standing: 'defeated',
                sanctuaryPresence: 'none',
                resolvedAt: '2026-08-23T09:25:00.000Z'
            }
        );

        expect(first.changed).toBe(true);
        expect(replay.changed).toBe(false);
        expect(defeated.changed).toBe(true);
        expect(defeated.record.outcome).toBe('defeated');
        expect(gameState.state.world.guardianOutcomes.history).toHaveLength(2);
    });
});
