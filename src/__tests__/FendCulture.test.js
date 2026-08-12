const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFendCulture() {
    const filePath = path.join(__dirname, '../systems/FendCulture.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getFendCommunitySnapshot } from './FendCommunity.js';",
            'const getFendCommunitySnapshot = GET_COMMUNITY_SNAPSHOT;'
        )
        .replace(
            "import { getFendResidentsSnapshot } from './FendResidents.js';",
            'const getFendResidentsSnapshot = GET_RESIDENTS_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                FEND_CULTURE_SCHEMA_VERSION,
                FEND_COMMONS_PRIORITIES,
                normalizeFendCultureState,
                getFendCultureSnapshot,
                formatFendCultureObjective,
                getFendCultureResidentResponse,
                recordFirstListeningDecision
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_COMMUNITY_SNAPSHOT: gameState => ({
            complete: gameState.communityComplete === true
        }),
        GET_RESIDENTS_SNAPSHOT: gameState => ({
            complete: gameState.residentsComplete === true
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
    communityComplete = true,
    residentsComplete = true,
    culture = {}
} = {}) {
    const state = {
        world: {
            fendCulture: culture
        }
    };
    return {
        state,
        communityComplete,
        residentsComplete,
        get(pathName) {
            return pathName.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
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

describe('FendCulture', () => {
    const {
        FEND_COMMONS_PRIORITIES,
        normalizeFendCultureState,
        getFendCultureSnapshot,
        formatFendCultureObjective,
        getFendCultureResidentResponse,
        recordFirstListeningDecision
    } = loadFendCulture();

    test('unlocks only after the physical Commons and all resident requests', () => {
        const locked = getFendCultureSnapshot(createGameState({
            residentsComplete: false
        }));
        const ready = getFendCultureSnapshot(createGameState());

        expect(locked.ready).toBe(false);
        expect(locked.state.firstListening.status).toBe('locked');
        expect(ready.ready).toBe(true);
        expect(ready.state.firstListening.status).toBe('ready');
        expect(formatFendCultureObjective(ready)).toContain('First Listening');
    });

    test('normalizes the save into bounded identifiers without dialogue', () => {
        const history = Array.from({ length: 12 }, (_, index) => ({
            operationId: `fend:first_listening:${index}`,
            selectedPriority: index % 2 ? 'warning' : 'refuge',
            occurredAt: '2026-07-30T18:23:00.000Z',
            playerSpeech: 'arbitrary text'
        }));
        const state = normalizeFendCultureState({
            firstListening: {
                selectedPriority: 'restoration',
                operationId: 'FEND FIRST LISTENING RESTORATION',
                heldAt: '2026-07-30T18:23:00.000Z'
            },
            history
        });

        expect(state.firstListening.selectedPriority).toBe('restoration');
        expect(state.firstListening.operationId).toBe(
            'fend_first_listening_restoration'
        );
        expect(state.history).toHaveLength(8);
        expect(JSON.stringify(state)).not.toContain('playerSpeech');
        expect(JSON.stringify(state)).not.toContain('arbitrary text');
    });

    test.each(FEND_COMMONS_PRIORITIES.map(priority => priority.id))(
        'records the %s priority as what begins first',
        priorityId => {
            const gameState = createGameState();
            const result = recordFirstListeningDecision(
                gameState,
                priorityId,
                { occurredAt: '2026-07-30T18:23:00.000Z' }
            );

            expect(result.changed).toBe(true);
            expect(result.priority.id).toBe(priorityId);
            expect(result.snapshot.complete).toBe(true);
            expect(gameState.save).toHaveBeenCalledTimes(1);
            expect(gameState.emit).toHaveBeenCalledWith(
                'fendCultureChanged',
                expect.objectContaining({
                    type: 'first_listening_completed',
                    selectedPriority: priorityId
                })
            );
        }
    );

    test('refuses unknown choices and preserves the first recorded decision', () => {
        const gameState = createGameState();
        expect(
            recordFirstListeningDecision(gameState, 'ownership').reason
        ).toBe('unknown_priority');

        recordFirstListeningDecision(gameState, 'refuge');
        const second = recordFirstListeningDecision(gameState, 'warning');
        expect(second.changed).toBe(false);
        expect(second.reason).toBe('already_complete');
        expect(second.priority.id).toBe('refuge');
    });

    test('keeps disagreement alive in post-listening resident responses', () => {
        const response = getFendCultureResidentResponse(
            'ilyra',
            'restoration'
        );
        expect(response).toContain('begins first');
        expect(response).toContain('refuge or warning');
    });
});
