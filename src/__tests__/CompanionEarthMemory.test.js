const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCompanionEarthMemory() {
    const filePath = path.join(
        __dirname,
        '../systems/CompanionEarthMemory.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCompanionConsentSnapshot } from './CompanionConsent.js';",
            'const getCompanionConsentSnapshot = GET_CONSENT;'
        )
        .replace(
            "import { getRemainAndDefendSnapshot } from './RemainAndDefendCampaign.js';",
            'const getRemainAndDefendSnapshot = GET_RECOVERY;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                COMPANION_EARTH_MEMORY_SCHEMA_VERSION,
                EARTH_MEMORY_DEFINITIONS,
                normalizeCompanionEarthMemoryState,
                getCompanionEarthMemorySnapshot,
                formatCompanionEarthMemoryObjective,
                shareCompanionEarthMemory
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_CONSENT: gameState => ({
            complete: gameState.flags.consent === true
        }),
        GET_RECOVERY: gameState => ({
            complete: gameState.flags.recovery === true
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
    companionId = 'creature_nova_23',
    consent = true,
    recovery = true,
    earthMemory = {}
} = {}) {
    const state = {
        creature: {
            genes: { id: companionId },
            name: 'Nova'
        },
        story: {
            projectBeacon: {
                companionEarthMemory: earthMemory
            }
        }
    };
    return {
        state,
        flags: { consent, recovery },
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

describe('CompanionEarthMemory', () => {
    const {
        EARTH_MEMORY_DEFINITIONS,
        normalizeCompanionEarthMemoryState,
        getCompanionEarthMemorySnapshot,
        formatCompanionEarthMemoryObjective,
        shareCompanionEarthMemory
    } = loadCompanionEarthMemory();

    test('unlocks only after consent boundaries and Fend recovery complete', () => {
        expect(getCompanionEarthMemorySnapshot(createGameState({
            consent: false
        })).ready).toBe(false);
        expect(getCompanionEarthMemorySnapshot(createGameState({
            recovery: false
        })).ready).toBe(false);

        const ready = getCompanionEarthMemorySnapshot(createGameState());
        expect(ready.ready).toBe(true);
        expect(ready.companionInitiated).toBe(true);
        expect(ready.memories).toHaveLength(3);
        expect(formatCompanionEarthMemoryObjective(ready)).toContain(
            'Earth question'
        );
    });

    test('records one authored memory without invitation, consent, or transmission', () => {
        const gameState = createGameState();
        const result = shareCompanionEarthMemory(
            gameState,
            'ocean_after_storm',
            { occurredAt: '2026-08-02T12:23:00.000Z' }
        );

        expect(result.changed).toBe(true);
        expect(result.snapshot.complete).toBe(true);
        expect(result.record.selectedMemoryId).toBe('ocean_after_storm');
        expect(result.record.invitationStatus).toBe('not_offered');
        expect(result.record.travelConsentRecorded).toBe(false);
        expect(result.record.transmissionStatus).toBe('not_sent');
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'companionEarthMemoryChanged',
            expect.objectContaining({
                travelConsentRecorded: false,
                transmissionStatus: 'not_sent'
            })
        );
    });

    test('keeps the irreversible memory choice separate per companion', () => {
        const gameState = createGameState();
        shareCompanionEarthMemory(gameState, 'dojo_dawn');

        gameState.state.creature.genes.id = 'creature_luma_77';
        expect(getCompanionEarthMemorySnapshot(gameState).ready).toBe(true);
        shareCompanionEarthMemory(gameState, 'city_lights');

        const records = gameState.state.story.projectBeacon
            .companionEarthMemory.records;
        expect(records.map(record => record.selectedMemoryId).sort()).toEqual([
            'city_lights',
            'dojo_dawn'
        ]);
    });

    test('strips imported free text and contradictory travel claims', () => {
        const state = normalizeCompanionEarthMemoryState({
            records: [{
                companionId: 'creature_nova_23',
                selectedMemoryId: 'city_lights',
                invitationStatus: 'accepted',
                travelConsentRecorded: true,
                transmissionStatus: 'sent',
                arbitraryMemory: 'private free text must not survive'
            }]
        }, { activeCompanionId: 'creature_nova_23' });
        const record = state.records[0];

        expect(record.invitationStatus).toBe('not_offered');
        expect(record.travelConsentRecorded).toBe(false);
        expect(record.transmissionStatus).toBe('not_sent');
        expect(JSON.stringify(state)).not.toContain('arbitraryMemory');
        expect(JSON.stringify(state)).not.toContain('private free text');
    });

    test('rejects unknown and repeated choices without additional writes', () => {
        const gameState = createGameState();
        expect(
            shareCompanionEarthMemory(gameState, 'mars_colony').reason
        ).toBe('unknown_memory');
        expect(gameState.set).not.toHaveBeenCalled();

        shareCompanionEarthMemory(gameState, EARTH_MEMORY_DEFINITIONS[0].id);
        const repeated = shareCompanionEarthMemory(
            gameState,
            EARTH_MEMORY_DEFINITIONS[1].id
        );
        expect(repeated.changed).toBe(false);
        expect(repeated.reason).toBe('memory_already_shared');
        expect(gameState.set).toHaveBeenCalledTimes(1);
    });

    test('snapshot reads never mutate or save state', () => {
        const gameState = createGameState();
        getCompanionEarthMemorySnapshot(gameState);
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
        expect(gameState.emit).not.toHaveBeenCalled();
    });
});
