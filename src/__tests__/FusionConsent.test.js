const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFusionConsent() {
    const filePath = path.join(
        __dirname,
        '../systems/FusionConsent.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                FUSION_CONSENT_SCHEMA_VERSION,
                SHARED_FUSION_BOUNDARY,
                createInitialFusionConsentState,
                normalizeFusionConsentReceipt,
                normalizeFusionConsentState,
                getFusionCompanionReadiness,
                getFusionConsentReadiness,
                createLocalFusionConsentReceipt,
                validateFusionConsentReceipt,
                recordLocalFusionConsent
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Set,
        Object,
        Array,
        Number,
        String,
        Math,
        JSON
    };
    vm.runInNewContext(transformed, sandbox, {
        filename: filePath
    });
    return sandbox.module.exports;
}

const {
    FUSION_CONSENT_SCHEMA_VERSION,
    SHARED_FUSION_BOUNDARY,
    createInitialFusionConsentState,
    normalizeFusionConsentReceipt,
    normalizeFusionConsentState,
    getFusionCompanionReadiness,
    getFusionConsentReadiness,
    createLocalFusionConsentReceipt,
    validateFusionConsentReceipt,
    recordLocalFusionConsent
} = loadFusionConsent();

function parents() {
    return [
        {
            id: 'creature_alpha',
            name: 'Alpha',
            lifecycle: { stage: 'adult' },
            stats: { happiness: 77 },
            mood: { current: 'happy' }
        },
        {
            id: 'creature_beta',
            name: 'Beta',
            lifecycle: { stage: 'elder' },
            stats: { happiness: 90 },
            mood: { current: 'steady' }
        }
    ];
}

function gameState(initial = createInitialFusionConsentState()) {
    let state = initial;
    return {
        get: jest.fn(() => state),
        set: jest.fn((_path, value) => {
            state = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('FusionConsent', () => {
    test('records two willing companions and one local keeper grant', () => {
        const receipt = createLocalFusionConsentReceipt({
            operationId: 'fusion_consent_23',
            parents: parents(),
            recordedAt: '2026-07-31T00:23:00.000Z'
        });

        expect(receipt).toEqual({
            schemaVersion: FUSION_CONSENT_SCHEMA_VERSION,
            operationId: 'fusion_consent_23',
            mode: 'same_save_owner',
            scope: 'local_sanctuary',
            parentIds: ['creature_alpha', 'creature_beta'],
            keeperGrant: 'confirmed',
            companionGrants: [
                {
                    creatureId: 'creature_alpha',
                    grant: 'lineage_synthesis',
                    decision: 'willing'
                },
                {
                    creatureId: 'creature_beta',
                    grant: 'lineage_synthesis',
                    decision: 'willing'
                }
            ],
            sharedInvitationId: null,
            recordedAt: '2026-07-31T00:23:00.000Z'
        });
        expect(validateFusionConsentReceipt(
            receipt,
            'fusion_consent_23',
            ['creature_alpha', 'creature_beta']
        )).toBe(true);
    });

    test('does not treat selection as consent when wellbeing or departure blocks a companion', () => {
        const unhappy = parents();
        unhappy[0].stats.happiness = 20;
        const departed = parents();
        departed[1].lifecycle.hasDeparted = true;

        expect(getFusionConsentReadiness(unhappy)).toEqual(
            expect.objectContaining({ ready: false })
        );
        expect(getFusionConsentReadiness(departed)).toEqual(
            expect.objectContaining({ ready: false })
        );
        expect(createLocalFusionConsentReceipt({
            operationId: 'fusion_blocked_23',
            parents: unhappy
        })).toBeNull();
    });

    test('uses the same single-companion boundary for Shared Fusion selection', () => {
        const ready = parents()[0];
        const stuck = {
            ...ready,
            lifecycle: {
                ...ready.lifecycle,
                isStuck: true
            }
        };

        expect(getFusionCompanionReadiness(ready)).toEqual(
            expect.objectContaining({
                creatureId: 'creature_alpha',
                willing: true
            })
        );
        expect(getFusionCompanionReadiness(stuck)).toEqual(
            expect.objectContaining({
                creatureId: 'creature_alpha',
                willing: false
            })
        );
    });

    test('recognizes adults from legacy birth records without a lifecycle stage', () => {
        const now = Date.parse('2026-07-31T12:00:00.000Z');
        const legacyParents = parents().map((parent, index) => ({
            ...parent,
            lifecycle: {
                birthDate: now - ((index + 3) * 24 * 60 * 60 * 1000)
            }
        }));

        expect(getFusionConsentReadiness(legacyParents, now)).toEqual(
            expect.objectContaining({
                ready: true,
                parents: [
                    expect.objectContaining({
                        creatureId: 'creature_alpha',
                        willing: true
                    }),
                    expect.objectContaining({
                        creatureId: 'creature_beta',
                        willing: true
                    })
                ]
            })
        );
    });

    test('rejects cross-owner and arbitrary imported consent fields', () => {
        const local = createLocalFusionConsentReceipt({
            operationId: 'fusion_local_23',
            parents: parents()
        });
        expect(normalizeFusionConsentReceipt({
            ...local,
            mode: 'cross_owner',
            sharedInvitationId: 'unverified_invitation',
            playerMessage: 'private text'
        })).toBeNull();

        const normalized = normalizeFusionConsentState({
            records: [
                {
                    ...local,
                    playerName: 'Not portable',
                    message: 'Not portable'
                },
                {
                    ...local,
                    operationId: 'fusion_local_23'
                }
            ],
            publicProfile: { handle: 'not_portable' }
        });
        expect(normalized.records).toEqual([local]);
        expect(JSON.stringify(normalized)).not.toContain('Not portable');
        expect(JSON.stringify(normalized)).not.toContain('not_portable');
    });

    test('records one idempotent bounded operation in GameState', () => {
        const state = gameState();
        const first = recordLocalFusionConsent(state, {
            operationId: 'fusion_record_23',
            parents: parents(),
            recordedAt: '2026-07-31T00:23:00.000Z'
        });
        const replay = recordLocalFusionConsent(state, {
            operationId: 'fusion_record_23',
            parents: parents(),
            recordedAt: '2026-07-31T01:23:00.000Z'
        });

        expect(replay).toEqual(first);
        expect(state.set).toHaveBeenCalledTimes(1);
        expect(state.save).toHaveBeenCalledTimes(1);
        expect(state.emit).toHaveBeenCalledWith(
            'fusionConsentRecorded',
            expect.objectContaining({
                operationId: 'fusion_record_23',
                mode: 'same_save_owner'
            })
        );
    });

    test('keeps shared Fusion sealed behind all five future grants', () => {
        expect(SHARED_FUSION_BOUNDARY).toEqual(
            expect.objectContaining({
                status: 'sealed',
                reason: 'protected_invitation_required',
                requires: [
                    'keeper_a_grant',
                    'keeper_b_grant',
                    'companion_a_grant',
                    'companion_b_grant',
                    'server_invitation'
                ]
            })
        );
        expect(SHARED_FUSION_BOUNDARY.excludes).toContain(
            'public_matchmaking'
        );
    });
});
