const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFendResidents() {
    const filePath = path.join(__dirname, '../systems/FendResidents.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getFendCommunityEvidence, getFendCommunitySnapshot } from './FendCommunity.js';",
            [
                'const getFendCommunityEvidence = GET_FEND_COMMUNITY_EVIDENCE;',
                'const getFendCommunitySnapshot = GET_FEND_COMMUNITY_SNAPSHOT;'
            ].join('\n')
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                FEND_RESIDENTS_SCHEMA_VERSION,
                FEND_RESIDENT_DEFINITIONS,
                normalizeFendResidentState,
                getFendResidentEvidence,
                getFendResidentsSnapshot,
                formatFendResidentObjective,
                interactWithFendResident
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_FEND_COMMUNITY_EVIDENCE: gameState => gameState.evidence,
        GET_FEND_COMMUNITY_SNAPSHOT: gameState => ({
            stage: gameState.communityStage,
            complete: gameState.communityStage === 4
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
    communityStage = 1,
    evidence = {},
    residents = {}
} = {}) {
    const state = {
        world: {
            fendResidents: residents
        }
    };
    return {
        state,
        communityStage,
        evidence: {
            gardenTends: 1,
            restoredRegions: 1,
            careActions: 0,
            observedSignals: 0,
            highPowerRescues: 0,
            uplinkRestored: false,
            ...evidence
        },
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

describe('FendResidents', () => {
    const {
        FEND_RESIDENT_DEFINITIONS,
        normalizeFendResidentState,
        getFendResidentsSnapshot,
        formatFendResidentObjective,
        interactWithFendResident
    } = loadFendResidents();

    test('exposes residents only when their physical community project exists', () => {
        const snapshot = getFendResidentsSnapshot(createGameState({
            communityStage: 2
        }));

        expect(snapshot.availableResidents.map(resident => resident.id)).toEqual([
            'kiri',
            'mara'
        ]);
        expect(snapshot.residents[2].status).toBe('locked');
        expect(snapshot.nextResident.id).toBe('kiri');
    });

    test('normalizes unknown and future resident state into a bounded portable contract', () => {
        const state = normalizeFendResidentState({
            metResidentIds: ['unknown', 'mara', 'kiri', 'kiri'],
            activeRequestId: 'relay_three_signals',
            completedRequestIds: ['shelter_calibration', 'unknown'],
            history: Array.from({ length: 30 }, (_, index) => ({
                operationId: `resident:kiri:${index}`,
                type: 'request_accepted',
                residentId: 'kiri',
                requestId: 'shelter_calibration',
                occurredAt: '2026-07-30T10:00:00.000Z'
            }))
        }, 2);

        expect(state.metResidentIds).toEqual(['kiri', 'mara']);
        expect(state.activeRequestId).toBe(null);
        expect(state.completedRequestIds).toEqual(['shelter_calibration']);
        expect(state.history).toHaveLength(24);
        expect(state).not.toHaveProperty('playerName');
        expect(JSON.stringify(state)).not.toContain('dialogue');
    });

    test('accepts Kiri request and requires a new shared action after acceptance', () => {
        const gameState = createGameState({
            communityStage: 1,
            evidence: { gardenTends: 4 }
        });
        const accepted = interactWithFendResident(gameState, 'kiri', {
            occurredAt: '2026-07-30T10:00:00.000Z'
        });

        expect(accepted.reason).toBe('request_accepted');
        expect(accepted.snapshot.activeResident.id).toBe('kiri');
        expect(accepted.snapshot.activeResident.ready).toBe(false);
        expect(formatFendResidentObjective(accepted.snapshot)).toContain(
            'Tend the Signal Garden'
        );

        gameState.evidence.gardenTends = 5;
        const ready = getFendResidentsSnapshot(gameState);
        expect(ready.activeResident.ready).toBe(true);

        const completed = interactWithFendResident(gameState, 'kiri', {
            occurredAt: '2026-07-30T10:05:00.000Z'
        });
        expect(completed.reason).toBe('request_completed');
        expect(completed.snapshot.completedCount).toBe(1);
        expect(gameState.emit).toHaveBeenLastCalledWith(
            'fendResidentChanged',
            expect.objectContaining({
                type: 'request_completed',
                residentId: 'kiri'
            })
        );
    });

    test('does not allow a second resident request while shared work is active', () => {
        const gameState = createGameState({ communityStage: 2 });
        interactWithFendResident(gameState, 'kiri');
        const blocked = interactWithFendResident(gameState, 'mara');

        expect(blocked.reason).toBe('other_request_active');
        expect(blocked.activeResident.id).toBe('kiri');
        expect(gameState.state.world.fendResidents.activeRequestId).toBe(
            'shelter_calibration'
        );
    });

    test('uses previously observed Living Signals without forcing a redundant grind', () => {
        const gameState = createGameState({
            communityStage: 3,
            evidence: { observedSignals: 3 },
            residents: {
                metResidentIds: ['kiri', 'mara'],
                completedRequestIds: [
                    'shelter_calibration',
                    'well_return_flow'
                ]
            }
        });

        const accepted = interactWithFendResident(gameState, 'tovan');
        expect(accepted.snapshot.activeResident.ready).toBe(true);

        const completed = interactWithFendResident(gameState, 'tovan');
        expect(completed.reason).toBe('request_completed');
        expect(completed.snapshot.completedCount).toBe(3);
    });

    test('frames the final request as held coordinates, not companion ownership', () => {
        const ilyra = FEND_RESIDENT_DEFINITIONS[3];
        expect(ilyra.request.actionLine).toContain('citizen, not a sample');
        expect(ilyra.request.completionLine).toContain('delayed');
        expect(JSON.stringify(ilyra)).not.toMatch(/capture|passenger/i);
    });
});
