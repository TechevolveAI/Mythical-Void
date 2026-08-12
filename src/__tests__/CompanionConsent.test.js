const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCompanionConsent() {
    const filePath = path.join(__dirname, '../systems/CompanionConsent.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getFendCultureSnapshot } from './FendCulture.js';",
            'const getFendCultureSnapshot = GET_FEND_CULTURE_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                COMPANION_CONSENT_SCHEMA_VERSION,
                COMPANION_BOUNDARY_TOPICS,
                normalizeCompanionConsentState,
                createCompanionConsentState,
                getCompanionConsentSnapshot,
                formatCompanionConsentObjective,
                recordCompanionBoundaryTopic
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_FEND_CULTURE_SNAPSHOT: gameState => ({
            complete: gameState.cultureComplete === true
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
    priority = 'prepare_homecoming',
    uplinkRestored = true,
    cultureComplete = true,
    consent = {}
} = {}) {
    const state = {
        creature: {
            genes: { id: companionId },
            name: 'Nova'
        },
        story: {
            projectBeacon: {
                uplinkRestored,
                finale: { priority },
                companionConsent: consent
            }
        }
    };
    return {
        state,
        cultureComplete,
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

describe('CompanionConsent', () => {
    const {
        COMPANION_BOUNDARY_TOPICS,
        normalizeCompanionConsentState,
        getCompanionConsentSnapshot,
        formatCompanionConsentObjective,
        recordCompanionBoundaryTopic
    } = loadCompanionConsent();

    test('unlocks only after the uplink, finale priority, and First Listening', () => {
        expect(getCompanionConsentSnapshot(createGameState({
            uplinkRestored: false
        })).ready).toBe(false);
        expect(getCompanionConsentSnapshot(createGameState({
            priority: null
        })).ready).toBe(false);
        expect(getCompanionConsentSnapshot(createGameState({
            cultureComplete: false
        })).ready).toBe(false);

        const ready = getCompanionConsentSnapshot(createGameState());
        expect(ready.ready).toBe(true);
        expect(formatCompanionConsentObjective(ready)).toContain('0/3');
    });

    test('migrates a legacy flat record into a bounded per-companion record', () => {
        const state = normalizeCompanionConsentState({
            schemaVersion: 1,
            travelStatus: 'not_yet_asked',
            disclosureStatus: 'withheld',
            vetoRecognized: true,
            recordedAt: '2026-07-30T18:23:00.000Z',
            arbitraryDialogue: 'do not store this'
        }, { activeCompanionId: 'creature_nova_23' });

        expect(state.schemaVersion).toBe(2);
        expect(state.records).toHaveLength(1);
        expect(state.records[0].companionId).toBe('creature_nova_23');
        expect(JSON.stringify(state)).not.toContain('arbitraryDialogue');
        expect(JSON.stringify(state)).not.toContain('do not store this');
    });

    test('repairs contradictory imported fields from reviewed boundaries', () => {
        const state = normalizeCompanionConsentState({
            records: [{
                companionId: 'creature_nova_23',
                travelStatus: 'not_yet_asked',
                disclosureStatus: 'withheld',
                locationBoundary: 'not_discussed',
                powerBoundary: 'not_discussed',
                reviewedTopicIds: ['route', 'evidence', 'power']
            }]
        }, { activeCompanionId: 'creature_nova_23' });
        const record = state.records[0];

        expect(record.travelStatus).toBe('decision_deferred');
        expect(record.disclosureStatus).toBe('astronaut_survival_only');
        expect(record.locationBoundary).toBe('coordinates_withheld');
        expect(record.powerBoundary).toBe('emergency_life_first');
        expect(record.informedRisks).toBe(true);
    });

    test('records all three boundaries while leaving travel undecided', () => {
        const gameState = createGameState();
        COMPANION_BOUNDARY_TOPICS.forEach(topic => {
            recordCompanionBoundaryTopic(gameState, topic.id, {
                occurredAt: '2026-07-30T19:23:00.000Z'
            });
        });
        const snapshot = getCompanionConsentSnapshot(gameState);

        expect(snapshot.complete).toBe(true);
        expect(snapshot.record.travelStatus).toBe('decision_deferred');
        expect(snapshot.record.willingPassenger).toBeNull();
        expect(snapshot.record.disclosureStatus).toBe(
            'astronaut_survival_only'
        );
        expect(snapshot.record.locationBoundary).toBe(
            'coordinates_withheld'
        );
        expect(snapshot.record.powerBoundary).toBe(
            'emergency_life_first'
        );
        expect(snapshot.record.informedRisks).toBe(true);
        expect(snapshot.record.vetoRecognized).toBe(true);
    });

    test('keeps consent records separate when the active companion changes', () => {
        const gameState = createGameState();
        recordCompanionBoundaryTopic(gameState, 'route');

        gameState.state.creature.genes.id = 'creature_luma_77';
        const secondCompanion = getCompanionConsentSnapshot(gameState);
        expect(secondCompanion.companionId).toBe('creature_luma_77');
        expect(secondCompanion.reviewedCount).toBe(0);
        expect(secondCompanion.state.records).toHaveLength(1);

        recordCompanionBoundaryTopic(gameState, 'evidence');
        const records = gameState.state.story.projectBeacon
            .companionConsent.records;
        expect(records.map(record => record.companionId).sort()).toEqual([
            'creature_luma_77',
            'creature_nova_23'
        ]);
    });

    test('rejects unknown and repeated topics without duplicating history', () => {
        const gameState = createGameState();
        expect(
            recordCompanionBoundaryTopic(gameState, 'cargo').reason
        ).toBe('unknown_topic');

        recordCompanionBoundaryTopic(gameState, 'power');
        const repeated = recordCompanionBoundaryTopic(
            gameState,
            'power'
        );
        expect(repeated.changed).toBe(false);
        expect(repeated.reason).toBe('already_reviewed');
        expect(
            gameState.state.story.projectBeacon.companionConsent
                .records[0].history
        ).toHaveLength(1);
    });

    test('rejects an operation ID replayed against another boundary', () => {
        const gameState = createGameState();
        recordCompanionBoundaryTopic(gameState, 'route', {
            operationId: 'review:creature_nova_23:23'
        });
        const replay = recordCompanionBoundaryTopic(
            gameState,
            'evidence',
            { operationId: 'review:creature_nova_23:23' }
        );

        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('duplicate_operation');
        expect(
            gameState.state.story.projectBeacon.companionConsent
                .records[0].reviewedTopicIds
        ).toEqual(['route']);
    });
});
