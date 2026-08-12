const fs = require('fs');
const path = require('path');
const vm = require('vm');
const projectBeacon = require('../config/project-beacon.json');

function loadShipEvidence() {
    const filePath = path.join(__dirname, '../systems/ShipEvidence.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import projectBeacon from '../config/project-beacon.json';",
            'const projectBeacon = PROJECT_BEACON;'
        )
        .replace(
            "import { getCompanionConsentSnapshot } from './CompanionConsent.js';",
            'const getCompanionConsentSnapshot = GET_CONSENT_SNAPSHOT;'
        )
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = GET_CURRENT_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                SHIP_ARCHIVE_SCHEMA_VERSION,
                SHIP_ARCHIVE_SECTIONS,
                createInitialShipArchiveState,
                normalizeShipArchiveState,
                getShipEvidenceSnapshot,
                formatShipEvidenceObjective,
                recordShipEvidenceSection
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        PROJECT_BEACON: projectBeacon,
        GET_CONSENT_SNAPSHOT: gameState => {
            const record = gameState?.get?.(
                'story.projectBeacon.consentRecord'
            ) || {};
            return {
                complete: record.complete === true,
                record: {
                    travelStatus:
                        record.travelStatus || 'not_yet_asked',
                    disclosureStatus:
                        record.disclosureStatus || 'withheld'
                }
            };
        },
        GET_CURRENT_SNAPSHOT: gameState => ({
            summary: {
                careActions:
                    Number(gameState?.get?.('world.careActions')) || 0,
                restoredCount:
                    Number(gameState?.get?.('world.restoredCount')) || 0,
                totalRegions: 6,
                observedSignals:
                    Number(gameState?.get?.('world.observedSignals')) || 0
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
    levelsCompleted = 1,
    collected = ['forest_core'],
    archive = {},
    passengerCapacity = 1
} = {}) {
    const state = {
        stats: { levelsCompleted },
        creature: {
            hatched: true,
            name: 'Nova',
            genes: { id: 'creature_nova_23' },
            agencyHistory: [{ type: 'high_power_rescue' }]
        },
        hubWorld: { shipParts: { collected } },
        world: {
            careActions: 4,
            restoredCount: 2,
            observedSignals: 3
        },
        story: {
            projectBeacon: {
                missionLogSeen,
                fieldKit: { recovered: fieldKitRecovered },
                shipArchive: archive,
                shipCapabilities: {
                    stealthDescent: 'repaired',
                    secureReturnVector: 'sealed',
                    manualLanding: 'available',
                    blackBoxProof: 'recovered',
                    passengerCapacity,
                    creatureLifeSupport: 'prototype_required',
                    longRangeUplink: 'held_exposure_risk'
                },
                sensei: {
                    encryptedContact: { contactAttempted: false }
                },
                consentRecord: {}
            }
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
        save: jest.fn()
    };
}

describe('ShipEvidence', () => {
    const {
        normalizeShipArchiveState,
        getShipEvidenceSnapshot,
        recordShipEvidenceSection
    } = loadShipEvidence();

    test('requires the opening record and a first expedition finding', () => {
        expect(getShipEvidenceSnapshot(createGameState({
            fieldKitRecovered: false
        })).available).toBe(false);
        expect(getShipEvidenceSnapshot(createGameState({
            missionLogSeen: false
        })).available).toBe(false);
        expect(getShipEvidenceSnapshot(createGameState({
            levelsCompleted: 0,
            collected: []
        })).available).toBe(false);
        expect(getShipEvidenceSnapshot(createGameState()).available).toBe(true);
    });

    test('enforces systems, evidence, then boundaries review order', () => {
        const gameState = createGameState();
        const skipped = recordShipEvidenceSection(gameState, 'evidence');
        expect(skipped.changed).toBe(false);
        expect(skipped.reason).toBe('prior_section_required');

        expect(recordShipEvidenceSection(
            gameState,
            'systems',
            { occurredAt: '2026-07-30T23:00:00.000Z' }
        ).changed).toBe(true);
        expect(recordShipEvidenceSection(
            gameState,
            'evidence',
            { occurredAt: '2026-07-30T23:10:00.000Z' }
        ).changed).toBe(true);
        const completed = recordShipEvidenceSection(
            gameState,
            'boundaries',
            { occurredAt: '2026-07-30T23:23:00.000Z' }
        );

        expect(completed.reason).toBe('archive_complete');
        expect(completed.snapshot.complete).toBe(true);
        expect(completed.snapshot.transmissionStatus).toBe('not_sent');
        expect(gameState.save).toHaveBeenCalledTimes(3);
    });

    test('repairs non-contiguous and unsafe imported archive data', () => {
        const state = normalizeShipArchiveState({
            reviewedSectionIds: ['systems', 'boundaries', 'unknown'],
            arbitraryNote: 'do not persist this',
            history: [{
                operationId: 'Review Systems 23',
                sectionId: 'systems',
                companionId: 'Nova Person',
                occurredAt: '2026-07-30T23:00:00.000Z',
                freeText: 'private player content'
            }, {
                operationId: 'Review Systems 23',
                sectionId: 'evidence'
            }, {
                operationId: 'unsafe',
                sectionId: 'unknown'
            }]
        });

        expect(state.reviewedSectionIds).toEqual(['systems']);
        expect(state.history).toHaveLength(1);
        expect(state.history[0]).toEqual({
            operationId: 'review_systems_23',
            type: 'section_reviewed',
            sectionId: 'systems',
            companionId: 'nova_person',
            occurredAt: '2026-07-30T23:00:00.000Z'
        });
        expect(JSON.stringify(state)).not.toContain('private player content');
        expect(JSON.stringify(state)).not.toContain('arbitraryNote');
    });

    test('separates capability, evidence, consent, and contact semantics', () => {
        const snapshot = getShipEvidenceSnapshot(createGameState({
            passengerCapacity: 1
        }));
        const passenger = snapshot.sections[0].rows.find(
            row => row.id === 'passenger'
        );
        const life = snapshot.sections[1].rows.find(
            row => row.id === 'life'
        );
        const travel = snapshot.sections[2].rows.find(
            row => row.id === 'travel'
        );
        const contact = snapshot.sections[2].rows.find(
            row => row.id === 'contact'
        );

        expect(passenger.detail).toContain('not an invitation or consent');
        expect(life.detail).toContain('never evidence the astronaut owns');
        expect(travel.status).toBe('NOT YET ASKED');
        expect(contact.status).toBe('NOT ATTEMPTED');
    });

    test('is idempotent when a reviewed section is replayed', () => {
        const gameState = createGameState();
        recordShipEvidenceSection(gameState, 'systems');
        const replay = recordShipEvidenceSection(gameState, 'systems');
        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('already_reviewed');
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });
});
