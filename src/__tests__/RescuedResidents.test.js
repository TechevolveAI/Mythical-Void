const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRescuedResidents() {
    const filePath = path.join(__dirname, '../systems/RescuedResidents.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                RESCUED_RESIDENT_DEFINITIONS,
                normalizeRescuedResidentState,
                getRescuedResidentSnapshot,
                recordRescuedResident,
                getPendingRescuedResidentArrival,
                acknowledgeRescuedResidentArrival,
                interactWithRescuedResident,
                getRescuedResidentByLevel
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
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

function createGameState(rescuedResidents = {}, levels = {}) {
    const state = { world: { rescuedResidents }, levels };
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
        save: jest.fn()
    };
}

describe('RescuedResidents', () => {
    const residents = loadRescuedResidents();

    test('defines a distinct non-boss resident for every campaign level', () => {
        expect(residents.RESCUED_RESIDENT_DEFINITIONS).toHaveLength(6);
        expect(
            residents.RESCUED_RESIDENT_DEFINITIONS.map(entry => entry.levelId)
        ).toEqual([
            'mythicalForest',
            'crystalCaves',
            'cosmicReef',
            'voidPeaks',
            'auroraDepths',
            'finalVoid'
        ]);
        residents.RESCUED_RESIDENT_DEFINITIONS.forEach(entry => {
            expect(entry.artwork).toMatch(/\.webp$/);
            expect(entry.role).toBeTruthy();
            expect(entry.releaseLine).toBeTruthy();
            expect(entry.sanctuaryLine).toBeTruthy();
            expect(entry.supportLabel).toBeTruthy();
        });
    });

    test('records a rescue once and persists its release history', () => {
        const gameState = createGameState();
        const first = residents.recordRescuedResident(
            gameState,
            'mythicalForest',
            { rescuedAt: '2026-08-10T12:00:00.000Z' }
        );
        const replay = residents.recordRescuedResident(
            gameState,
            'mythicalForest'
        );

        expect(first.changed).toBe(true);
        expect(first.resident.name).toBe('Bloom');
        expect(replay.changed).toBe(false);
        expect(gameState.state.world.rescuedResidents.rescuedIds).toEqual([
            'bloom'
        ]);
        expect(gameState.state.world.rescuedResidents.rescueHistory).toHaveLength(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('aggregates resident support for later expeditions', () => {
        const gameState = createGameState();
        residents.recordRescuedResident(gameState, 'mythicalForest');
        residents.recordRescuedResident(gameState, 'crystalCaves');
        residents.recordRescuedResident(gameState, 'cosmicReef');
        residents.recordRescuedResident(gameState, 'voidPeaks');
        residents.recordRescuedResident(gameState, 'auroraDepths');

        expect(residents.getRescuedResidentSnapshot(gameState).support).toEqual({
            maxEnergyBonus: 1,
            maxHealthBonus: 0,
            guardCharges: 1,
            victoryCoinBonus: 3,
            speedMultiplier: 1.04,
            jumpMultiplier: 1.04
        });
    });

    test('persists one Sanctuary arrival acknowledgement for a genuine rescue', () => {
        const gameState = createGameState();
        residents.recordRescuedResident(
            gameState,
            'mythicalForest',
            { rescuedAt: '2026-08-10T12:00:00.000Z' }
        );

        expect(residents.getPendingRescuedResidentArrival(gameState)?.id)
            .toBe('bloom');
        const first = residents.acknowledgeRescuedResidentArrival(
            gameState,
            'bloom',
            { arrivedAt: '2026-08-10T12:05:00.000Z' }
        );
        const replay = residents.acknowledgeRescuedResidentArrival(
            gameState,
            'bloom'
        );

        expect(first.changed).toBe(true);
        expect(replay.changed).toBe(false);
        expect(residents.getPendingRescuedResidentArrival(gameState)).toBeNull();
        expect(gameState.state.world.rescuedResidents).toEqual(
            expect.objectContaining({
                schemaVersion: 3,
                sanctuaryArrivalSeenIds: ['bloom'],
                lastSanctuaryArrivalId: 'bloom',
                lastSanctuaryArrivalAt: '2026-08-10T12:05:00.000Z'
            })
        );
    });

    test('records repeat Sanctuary check-ins without changing rescue state', () => {
        const gameState = createGameState();
        residents.recordRescuedResident(gameState, 'finalVoid');
        const first = residents.interactWithRescuedResident(gameState, 'nova');
        const second = residents.interactWithRescuedResident(gameState, 'nova');

        expect(first.interactionCount).toBe(1);
        expect(second.interactionCount).toBe(2);
        expect(second.line).toContain('remain named');
        expect(second.snapshot.rescuedCount).toBe(1);
    });

    test('backfills residents for levels completed before the feature shipped', () => {
        const gameState = createGameState({}, {
            mythicalForest: { completed: true },
            crystalCaves: { completed: true }
        });
        const snapshot = residents.getRescuedResidentSnapshot(gameState);

        expect(snapshot.rescued.map(entry => entry.id)).toEqual([
            'bloom',
            'pebble'
        ]);
        expect(residents.getPendingRescuedResidentArrival(gameState)).toBeNull();
        const interaction = residents.interactWithRescuedResident(
            gameState,
            'bloom'
        );
        expect(interaction.interactionCount).toBe(1);
        expect(gameState.state.world.rescuedResidents.rescuedIds).toContain(
            'bloom'
        );
    });
});
