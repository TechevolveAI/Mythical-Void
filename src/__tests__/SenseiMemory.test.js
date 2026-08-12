const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSenseiMemory() {
    const filePath = path.join(__dirname, '../systems/SenseiMemory.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = GET_CURRENT_ECOLOGY_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                SENSEI_MEMORY_SCHEMA_VERSION,
                CENTERING_STANCE_DURATION_MS,
                SENSEI_MEMORY_DEFINITIONS,
                createInitialSenseiMemoryState,
                normalizeSenseiMemoryState,
                getSenseiMemorySnapshot,
                formatSenseiMemoryObjective,
                recordSenseiMemory,
                recordCenteringStancePractice
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_CURRENT_ECOLOGY_SNAPSHOT: gameState => ({
            summary: {
                careActions:
                    Number(gameState?.get?.('world.careActions')) || 0
            }
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
    fieldKitRecovered = true,
    missionLogSeen = true,
    levelsCompleted = 0,
    careActions = 0,
    agencyHistory = [],
    ledger = {}
} = {}) {
    const state = {
        creature: {
            genes: { id: 'creature_nova_23' },
            agencyHistory
        },
        story: {
            projectBeacon: {
                fieldKit: { recovered: fieldKitRecovered },
                missionLogSeen,
                sensei: { memoryLedger: ledger }
            }
        },
        stats: { levelsCompleted },
        world: { careActions }
    };
    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
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

describe('SenseiMemory', () => {
    const {
        CENTERING_STANCE_DURATION_MS,
        normalizeSenseiMemoryState,
        getSenseiMemorySnapshot,
        recordSenseiMemory,
        recordCenteringStancePractice
    } = loadSenseiMemory();

    test('unlocks the three memories from existing authored milestones', () => {
        const first = getSenseiMemorySnapshot(createGameState());
        expect(first.nextMemory.id).toBe('begin_with_your_footing');
        expect(first.totalMemories).toBe(3);

        const later = getSenseiMemorySnapshot(createGameState({
            levelsCompleted: 1,
            careActions: 1
        }));
        expect(
            later.memories.filter(memory => memory.unlocked)
        ).toHaveLength(3);
        expect(later.nextMemory.id).toBe('begin_with_your_footing');
    });

    test('requires the opening mission record before the first memory', () => {
        expect(getSenseiMemorySnapshot(createGameState({
            missionLogSeen: false
        })).ready).toBe(false);
        expect(getSenseiMemorySnapshot(createGameState({
            fieldKitRecovered: false
        })).ready).toBe(false);
    });

    test('enforces recall order even when later milestones are complete', () => {
        const gameState = createGameState({
            levelsCompleted: 1,
            careActions: 1
        });
        const skipped = recordSenseiMemory(
            gameState,
            'trust_begins_with_how_you_enter'
        );
        expect(skipped.changed).toBe(false);
        expect(skipped.reason).toBe('prior_memory_required');

        const first = recordSenseiMemory(
            gameState,
            'begin_with_your_footing'
        );
        expect(first.changed).toBe(true);
        expect(first.reason).toBe('lesson_unlocked');
        expect(first.snapshot.lesson.unlocked).toBe(true);
        expect(first.snapshot.nextMemory.id).toBe(
            'trust_begins_with_how_you_enter'
        );
    });

    test('repairs a non-contiguous imported recall list', () => {
        const state = normalizeSenseiMemoryState({
            recalledMemoryIds: [
                'begin_with_your_footing',
                'power_is_knowing_what_not_to_take'
            ],
            arbitraryNote: 'do not persist this'
        });
        expect(state.recalledMemoryIds).toEqual([
            'begin_with_your_footing'
        ]);
        expect(JSON.stringify(state)).not.toContain('arbitraryNote');
        expect(JSON.stringify(state)).not.toContain('do not persist this');
    });

    test('records Centering Stance practice idempotently with companion witness', () => {
        const gameState = createGameState();
        recordSenseiMemory(gameState, 'begin_with_your_footing');

        const practiced = recordCenteringStancePractice(gameState, {
            levelId: 'mythical_forest_1',
            operationId: 'stance:forest:attempt_23',
            occurredAt: '2026-07-30T23:23:00.000Z'
        });
        const replay = recordCenteringStancePractice(gameState, {
            levelId: 'mythical_forest_1',
            operationId: 'stance:forest:attempt_23'
        });

        expect(CENTERING_STANCE_DURATION_MS).toBe(1250);
        expect(practiced.changed).toBe(true);
        expect(practiced.snapshot.lesson.status).toBe('practiced');
        expect(practiced.snapshot.lesson.practiceCount).toBe(1);
        expect(practiced.state.history[1]).toEqual(
            expect.objectContaining({
                type: 'lesson_practiced',
                lessonId: 'centering_stance',
                levelId: 'mythical_forest_1',
                companionId: 'creature_nova_23'
            })
        );
        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('duplicate_operation');
    });

    test('does not allow stance practice before the memory is recalled', () => {
        const result = recordCenteringStancePractice(createGameState(), {
            levelId: 'mythical_forest_1'
        });
        expect(result.changed).toBe(false);
        expect(result.reason).toBe('lesson_locked');
    });
});
