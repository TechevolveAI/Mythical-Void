const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCurrentVeilMission() {
    const filePath = path.join(
        __dirname,
        '../systems/CurrentVeilMission.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getFendCultureSnapshot } from './FendCulture.js';",
            'const getFendCultureSnapshot = GET_FEND_CULTURE_SNAPSHOT;'
        )
        .replace(
            "import { getFendResidentsSnapshot } from './FendResidents.js';",
            'const getFendResidentsSnapshot = GET_FEND_RESIDENTS_SNAPSHOT;'
        )
        .replace(
            "import { getProtectedReturnSnapshot } from './ProtectedReturnProtocol.js';",
            'const getProtectedReturnSnapshot = GET_PROTECTED_RETURN_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = {
            CURRENT_VEIL_ANCHORS,
            createInitialCurrentVeilState,
            normalizeCurrentVeilState,
            getCurrentVeilSnapshot,
            formatCurrentVeilObjective,
            startCurrentVeilMission,
            stabilizeCurrentVeilAnchor,
            verifyCurrentVeilPacket
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_FEND_CULTURE_SNAPSHOT: gameState => ({
            complete: gameState.get('test.cultureComplete') === true
        }),
        GET_FEND_RESIDENTS_SNAPSHOT: gameState => ({
            complete: gameState.get('test.residentsComplete') === true
        }),
        GET_PROTECTED_RETURN_SNAPSHOT: gameState => ({
            complete: gameState.get('test.protocolComplete') === true
        }),
        Date,
        Map,
        Set,
        Object,
        Array,
        Math,
        Number,
        String,
        Boolean
    };
    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    protocolComplete = true,
    cultureComplete = true,
    residentsComplete = true,
    mission = null
} = {}) {
    const state = {
        test: {
            protocolComplete,
            cultureComplete,
            residentsComplete
        },
        creature: {
            genes: { id: 'aster_23' }
        },
        world: {
            currentVeilMission: mission
        }
    };
    return {
        state,
        get(pathValue) {
            return pathValue.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        set(pathValue, value) {
            const keys = pathValue.split('.');
            const finalKey = keys.pop();
            const parent = keys.reduce((target, key) => {
                target[key] = target[key] || {};
                return target[key];
            }, state);
            parent[finalKey] = value;
        },
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('Current Veil consequence mission', () => {
    const mission = loadCurrentVeilMission();

    test('unlocks only after Fend trust and the protected return protocol', () => {
        expect(
            mission.getCurrentVeilSnapshot(
                createGameState({ protocolComplete: false })
            ).available
        ).toBe(false);
        expect(
            mission.getCurrentVeilSnapshot(
                createGameState({ cultureComplete: false })
            ).available
        ).toBe(false);
        expect(
            mission.getCurrentVeilSnapshot(
                createGameState({ residentsComplete: false })
            ).available
        ).toBe(false);
        expect(
            mission.getCurrentVeilSnapshot(createGameState()).available
        ).toBe(true);
    });

    test('stabilizes each bounded anchor in any order and requires ship verification', () => {
        const gameState = createGameState();
        const started = mission.startCurrentVeilMission(gameState, {
            occurredAt: '2026-07-31T01:23:00.000Z'
        });
        expect(started.changed).toBe(true);
        expect(started.snapshot.active).toBe(true);

        ['relay_echo', 'root_echo', 'well_echo'].forEach(
            (anchorId, index) => {
                const result = mission.stabilizeCurrentVeilAnchor(
                    gameState,
                    anchorId,
                    {
                        occurredAt:
                            `2026-07-31T01:${24 + index}:00.000Z`
                    }
                );
                expect(result.changed).toBe(true);
            }
        );

        const ready = mission.getCurrentVeilSnapshot(gameState);
        expect(ready.verificationReady).toBe(true);
        expect(ready.complete).toBe(false);
        expect(ready.packet).toEqual(expect.objectContaining({
            survivalProofStatus: 'preserved',
            routeInferenceStatus: 'mask_ready',
            transmissionStatus: 'not_sent'
        }));

        const verified = mission.verifyCurrentVeilPacket(gameState, {
            occurredAt: '2026-07-31T01:27:00.000Z'
        });
        expect(verified.changed).toBe(true);
        expect(verified.snapshot.complete).toBe(true);
        expect(verified.snapshot.packet).toEqual(expect.objectContaining({
            survivalProofStatus: 'preserved',
            routeInferenceStatus: 'blocked',
            transmissionStatus: 'not_sent'
        }));
    });

    test('rejects replayed anchors and never stores route coordinates or free text', () => {
        const gameState = createGameState();
        mission.startCurrentVeilMission(gameState);
        mission.stabilizeCurrentVeilAnchor(
            gameState,
            'root_echo'
        );
        const replay = mission.stabilizeCurrentVeilAnchor(
            gameState,
            'root_echo'
        );
        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('anchor_stabilized');

        const serialized = JSON.stringify(
            gameState.state.world.currentVeilMission
        );
        expect(serialized).not.toMatch(
            /latitude|longitude|coordinates|notes|message|report_text/
        );
        expect(serialized).toContain('"transmissionStatus":"not_sent"');
    });

    test('repairs malformed imports to a bounded, truthful state', () => {
        const state = mission.normalizeCurrentVeilState({
            status: 'complete',
            stabilizedAnchorIds: [
                'relay_echo',
                'unknown',
                'root_echo'
            ],
            transmissionStatus: 'sent',
            history: [{
                operationId: 'veil:root',
                type: 'anchor_stabilized',
                anchorId: 'root_echo',
                occurredAt: '2026-07-31T01:23:00.000Z'
            }]
        });
        expect(state.status).toBe('active');
        expect(state.stabilizedAnchorIds).toEqual([
            'root_echo',
            'relay_echo'
        ]);
        expect(state.transmissionStatus).toBe('not_sent');
        expect(state.completedAt).toBeNull();
    });
});
