const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRemainAndDefendCampaign() {
    const filePath = path.join(
        __dirname,
        '../systems/RemainAndDefendCampaign.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = GET_CURRENT;'
        )
        .replace(
            /import \{\n    formatFendCommunityObjective,\n    getFendCommunitySnapshot\n\} from '\.\/FendCommunity\.js';/,
            'const formatFendCommunityObjective = FORMAT_COMMUNITY;\n' +
            'const getFendCommunitySnapshot = GET_COMMUNITY;'
        )
        .replace(
            /import \{\n    formatFendResidentObjective,\n    getFendResidentsSnapshot\n\} from '\.\/FendResidents\.js';/,
            'const formatFendResidentObjective = FORMAT_RESIDENTS;\n' +
            'const getFendResidentsSnapshot = GET_RESIDENTS;'
        )
        .replace(
            /import \{\n    formatFendCultureObjective,\n    getFendCultureSnapshot\n\} from '\.\/FendCulture\.js';/,
            'const formatFendCultureObjective = FORMAT_CULTURE;\n' +
            'const getFendCultureSnapshot = GET_CULTURE;'
        )
        .replace(
            /import \{\n    formatCompanionConsentObjective,\n    getCompanionConsentSnapshot\n\} from '\.\/CompanionConsent\.js';/,
            'const formatCompanionConsentObjective = FORMAT_CONSENT;\n' +
            'const getCompanionConsentSnapshot = GET_CONSENT;'
        )
        .replace(
            /import \{\n    formatSenseiMemoryObjective,\n    getSenseiMemorySnapshot\n\} from '\.\/SenseiMemory\.js';/,
            'const formatSenseiMemoryObjective = FORMAT_SENSEI;\n' +
            'const getSenseiMemorySnapshot = GET_SENSEI;'
        )
        .replace(
            /import \{\n    formatShipEvidenceObjective,\n    getShipEvidenceSnapshot\n\} from '\.\/ShipEvidence\.js';/,
            'const formatShipEvidenceObjective = FORMAT_SHIP;\n' +
            'const getShipEvidenceSnapshot = GET_SHIP;'
        )
        .replace(
            /import \{\n    formatProtectedReturnObjective,\n    getProtectedReturnSnapshot\n\} from '\.\/ProtectedReturnProtocol\.js';/,
            'const formatProtectedReturnObjective = FORMAT_PROTOCOL;\n' +
            'const getProtectedReturnSnapshot = GET_PROTOCOL;'
        )
        .replace(
            /import \{\n    formatCurrentVeilObjective,\n    getCurrentVeilSnapshot\n\} from '\.\/CurrentVeilMission\.js';/,
            'const formatCurrentVeilObjective = FORMAT_VEIL;\n' +
            'const getCurrentVeilSnapshot = GET_VEIL;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                REMAIN_AND_DEFEND_SCHEMA_VERSION,
                REMAIN_AND_DEFEND_PHASES,
                normalizeRemainAndDefendState,
                getRemainAndDefendSnapshot,
                formatRemainAndDefendObjective,
                completeRemainAndDefendCampaign
            };
        `);
    const getFlag = (gameState, key) => (
        gameState.get(`test.${key}`) === true
    );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_CURRENT: gameState => ({
            summary: {
                restoredCount: Number(
                    gameState.get('test.restoredCount')
                ) || 0,
                totalRegions: 6
            }
        }),
        GET_COMMUNITY: gameState => ({
            complete: getFlag(gameState, 'community'),
            nextProject: { label: 'CURRENT WELL' }
        }),
        GET_RESIDENTS: gameState => ({
            complete: getFlag(gameState, 'residents'),
            activeResident: null,
            nextResident: null
        }),
        GET_CULTURE: gameState => ({
            complete: getFlag(gameState, 'culture')
        }),
        GET_CONSENT: gameState => ({
            complete: getFlag(gameState, 'consent')
        }),
        GET_SENSEI: gameState => ({
            complete: getFlag(gameState, 'sensei')
        }),
        GET_SHIP: gameState => ({
            complete: getFlag(gameState, 'ship')
        }),
        GET_PROTOCOL: gameState => ({
            complete: getFlag(gameState, 'protocol')
        }),
        GET_VEIL: gameState => ({
            complete: getFlag(gameState, 'veil')
        }),
        FORMAT_COMMUNITY: () => 'Build the next Commons project.',
        FORMAT_RESIDENTS: () => 'Answer the active resident request.',
        FORMAT_CULTURE: () => 'Hold the First Listening.',
        FORMAT_CONSENT: () => 'Review companion boundaries.',
        FORMAT_SENSEI: () => 'Recover the Sensei archive.',
        FORMAT_SHIP: () => 'Review the ship archive.',
        FORMAT_PROTOCOL: () => 'Seal the protected return.',
        FORMAT_VEIL: () => 'Complete Quiet Current.',
        Date,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math,
        Boolean
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    priority = 'remain_and_defend',
    uplinkRestored = true,
    restoredCount = 6,
    community = false,
    residents = false,
    culture = false,
    consent = false,
    sensei = false,
    ship = false,
    protocol = false,
    veil = false,
    remainAndDefend = {}
} = {}) {
    const state = {
        story: {
            projectBeacon: {
                uplinkRestored,
                finale: { priority },
                remainAndDefend
            }
        },
        test: {
            restoredCount,
            community,
            residents,
            culture,
            consent,
            sensei,
            ship,
            protocol,
            veil
        }
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

describe('RemainAndDefendCampaign', () => {
    const {
        REMAIN_AND_DEFEND_PHASES,
        normalizeRemainAndDefendState,
        getRemainAndDefendSnapshot,
        formatRemainAndDefendObjective,
        completeRemainAndDefendCampaign
    } = loadRemainAndDefendCampaign();

    test('keeps one stable, ordered eight-phase chapter contract', () => {
        expect(
            Array.from(REMAIN_AND_DEFEND_PHASES, phase => phase.id)
        ).toEqual([
            'hold_the_line',
            'community_recovery',
            'first_listening',
            'companion_boundaries',
            'earth_archive',
            'protected_return',
            'quiet_current',
            'commons_council'
        ]);
    });

    test('unlocks only after the held uplink and a recorded priority', () => {
        const noPriority = getRemainAndDefendSnapshot(
            createGameState({ priority: null })
        );
        const noUplink = getRemainAndDefendSnapshot(
            createGameState({ uplinkRestored: false })
        );
        const active = getRemainAndDefendSnapshot(createGameState());

        expect(noPriority.status).toBe('locked');
        expect(noUplink.status).toBe('locked');
        expect(active.status).toBe('active');
        expect(active.currentPhase.id).toBe('community_recovery');
    });

    test('uses authoritative subsystem evidence and never skips an earlier phase', () => {
        const snapshot = getRemainAndDefendSnapshot(createGameState({
            community: false,
            residents: false,
            culture: true,
            consent: true,
            sensei: true,
            ship: true,
            protocol: true,
            veil: true
        }));

        expect(snapshot.currentPhase.id).toBe('community_recovery');
        expect(snapshot.phases.find(
            phase => phase.id === 'first_listening'
        )).toEqual(expect.objectContaining({
            complete: true,
            status: 'locked'
        }));
        expect(formatRemainAndDefendObjective(snapshot)).toBe(
            'Build the next Commons project.'
        );
    });

    test('requires the council after all seven recovery phases', () => {
        const snapshot = getRemainAndDefendSnapshot(createGameState({
            community: true,
            residents: true,
            culture: true,
            consent: true,
            sensei: true,
            ship: true,
            protocol: true,
            veil: true
        }));

        expect(snapshot.status).toBe('council_ready');
        expect(snapshot.councilReady).toBe(true);
        expect(snapshot.complete).toBe(false);
        expect(snapshot.completedCount).toBe(7);
        expect(snapshot.currentPhase.id).toBe('commons_council');
    });

    test.each([
        'remain_and_defend',
        'prepare_homecoming',
        'prepare_first_contact'
    ])('completes from priority %s without sending a signal', priority => {
        const gameState = createGameState({
            priority,
            community: true,
            residents: true,
            culture: true,
            consent: true,
            sensei: true,
            ship: true,
            protocol: true,
            veil: true
        });
        const result = completeRemainAndDefendCampaign(gameState, {
            occurredAt: '2026-07-31T03:00:00.000Z'
        });

        expect(result.changed).toBe(true);
        expect(result.snapshot.complete).toBe(true);
        expect(result.state.priorityAtCompletion).toBe(priority);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'remainAndDefendChanged',
            expect.objectContaining({
                type: 'chapter_completed',
                priority
            })
        );

        const replay = completeRemainAndDefendCampaign(gameState);
        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('chapter_complete');
    });

    test('rejects premature completion and strips arbitrary save data', () => {
        const gameState = createGameState();
        expect(
            completeRemainAndDefendCampaign(gameState).reason
        ).toBe('prerequisites_missing');

        const normalized = normalizeRemainAndDefendState({
            status: 'complete',
            completedAt: '2026-07-31T03:00:00.000Z',
            playerNote: 'send my location',
            history: [{
                operationId: 'REMAIN COUNCIL',
                priority: 'prepare_homecoming',
                occurredAt: '2026-07-31T03:00:00.000Z',
                exactCoordinates: 'private'
            }]
        });
        const serialized = JSON.stringify(normalized);

        expect(normalized.completionOperationId).toBe('remain_council');
        expect(serialized).not.toContain('playerNote');
        expect(serialized).not.toContain('exactCoordinates');
        expect(serialized).not.toContain('send my location');
    });
});
