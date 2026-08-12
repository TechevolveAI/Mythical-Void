const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadProtocol() {
    const filePath = path.join(
        __dirname,
        '../systems/ProtectedReturnProtocol.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCompanionConsentSnapshot } from './CompanionConsent.js';",
            'const getCompanionConsentSnapshot = GET_CONSENT;'
        )
        .replace(
            "import { getFendCultureSnapshot } from './FendCulture.js';",
            'const getFendCultureSnapshot = GET_CULTURE;'
        )
        .replace(
            "import { getShipEvidenceSnapshot } from './ShipEvidence.js';",
            'const getShipEvidenceSnapshot = GET_SHIP;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                PROTECTED_RETURN_SCHEMA_VERSION,
                PROTECTED_RETURN_STEPS,
                createInitialProtectedReturnState,
                normalizeProtectedReturnState,
                getProtectedReturnSnapshot,
                formatProtectedReturnObjective,
                applyProtectedReturnStep
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_SHIP: gameState => gameState.snapshots.ship,
        GET_CONSENT: gameState => gameState.snapshots.consent,
        GET_CULTURE: gameState => gameState.snapshots.culture,
        Date,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math
    };
    vm.runInNewContext(transformed, sandbox, {
        filename: filePath
    });
    return sandbox.module.exports;
}

function createGameState({
    archiveComplete = true,
    blackBoxProof = 'recovered',
    returnVector = 'sealed',
    consentComplete = true,
    cultureComplete = true,
    protocol = {}
} = {}) {
    const state = {
        creature: {
            name: 'Aster',
            genes: { id: 'companion_aster_23' }
        },
        story: {
            projectBeacon: {
                protectedReturnProtocol: protocol
            }
        }
    };
    return {
        state,
        snapshots: {
            ship: {
                complete: archiveComplete,
                capabilities: {
                    blackBoxProof,
                    secureReturnVector: returnVector
                }
            },
            consent: {
                complete: consentComplete,
                record: {
                    locationBoundary: consentComplete
                        ? 'coordinates_withheld'
                        : 'not_discussed',
                    disclosureStatus: consentComplete
                        ? 'astronaut_survival_only'
                        : 'withheld'
                }
            },
            culture: {
                complete: cultureComplete
            }
        },
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

describe('ProtectedReturnProtocol', () => {
    const {
        PROTECTED_RETURN_STEPS,
        normalizeProtectedReturnState,
        getProtectedReturnSnapshot,
        applyProtectedReturnStep
    } = loadProtocol();

    test('keeps imported completion contiguous and privacy-minimized', () => {
        const normalized = normalizeProtectedReturnState({
            completedStepIds: [
                'survival_packet',
                'living_witness_seal',
                'unknown'
            ],
            arbitraryNotes: 'do not carry this',
            history: [{
                operationId: 'Return Step 23',
                stepId: 'survival_packet',
                companionId: 'Aster Person',
                occurredAt: '2026-07-31T01:23:00.000Z',
                message: 'private text'
            }]
        });

        expect(normalized.completedStepIds).toEqual([
            'survival_packet'
        ]);
        expect(normalized.history).toEqual([{
            operationId: 'return_step_23',
            type: 'return_safeguard_applied',
            stepId: 'survival_packet',
            companionId: 'aster_person',
            occurredAt: '2026-07-31T01:23:00.000Z'
        }]);
        expect(JSON.stringify(normalized)).not.toContain('private text');
        expect(JSON.stringify(normalized)).not.toContain('arbitraryNotes');
    });

    test('derives each safeguard from authoritative played requirements', () => {
        expect(getProtectedReturnSnapshot(createGameState({
            archiveComplete: false
        })).available).toBe(false);
        expect(getProtectedReturnSnapshot(createGameState({
            blackBoxProof: 'missing'
        })).nextStep.requirement).toContain('black-box proof');

        const noConsent = createGameState({
            consentComplete: false,
            protocol: {
                completedStepIds: [
                    'survival_packet',
                    'route_quarantine'
                ]
            }
        });
        expect(
            getProtectedReturnSnapshot(noConsent).nextStep.requirement
        ).toContain('active companion');

        const noListening = createGameState({
            cultureComplete: false,
            protocol: {
                completedStepIds: [
                    'survival_packet',
                    'route_quarantine',
                    'living_witness_seal'
                ]
            }
        });
        expect(
            getProtectedReturnSnapshot(noListening).nextStep.requirement
        ).toContain('First Listening');
    });

    test('applies four ordered safeguards and never transmits', () => {
        const gameState = createGameState();
        for (const [index, step] of PROTECTED_RETURN_STEPS.entries()) {
            const result = applyProtectedReturnStep(
                gameState,
                step.id,
                {
                    occurredAt:
                        `2026-07-31T0${index + 1}:23:00.000Z`
                }
            );
            expect(result.changed).toBe(true);
        }

        const snapshot = getProtectedReturnSnapshot(gameState);
        expect(snapshot.complete).toBe(true);
        expect(snapshot.state.packetStatus).toBe(
            'sealed_ready_not_sent'
        );
        expect(snapshot.packet.transmissionStatus).toBe('not_sent');
        expect(snapshot.packet.reportableEvidence).toEqual([
            'astronaut_survival',
            'mission_crash',
            'black_box_telemetry'
        ]);
        expect(snapshot.packet.protectedFindings).toContain(
            'companion_identity'
        );
        expect(gameState.save).toHaveBeenCalledTimes(4);
        expect(gameState.emit).toHaveBeenLastCalledWith(
            'protectedReturnChanged',
            expect.objectContaining({
                stepId: 'uplink_hold',
                complete: true
            })
        );
    });

    test('rejects skipped and replayed operations', () => {
        const gameState = createGameState();
        expect(applyProtectedReturnStep(
            gameState,
            'route_quarantine'
        ).reason).toBe('prior_step_required');

        expect(applyProtectedReturnStep(
            gameState,
            'survival_packet'
        ).changed).toBe(true);
        expect(applyProtectedReturnStep(
            gameState,
            'survival_packet'
        ).reason).toBe('already_applied');
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });
});
