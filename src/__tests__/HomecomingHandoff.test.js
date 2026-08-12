const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REGION_IDS = [
    'mythical_forest',
    'crystal_caves',
    'stellar_reef',
    'void_peaks',
    'aurora_depths',
    'current_heart'
];
const REMAIN_PHASE_IDS = [
    'hold_the_line',
    'community_recovery',
    'first_listening',
    'companion_boundaries',
    'earth_archive',
    'protected_return',
    'quiet_current',
    'commons_council'
];
const SENSEI_MEMORY_IDS = [
    'begin_with_your_footing',
    'trust_begins_with_how_you_enter',
    'power_is_knowing_what_not_to_take'
];

function createCompleteLegacyCapsule() {
    return {
        schemaVersion: 14,
        sagaId: 'mythical_void_saga',
        sourceChapter: 'remain_and_defend',
        nextChapter: 'secret_homecoming',
        intent: 'prepare_homecoming',
        recordedAt: '2026-07-31T05:23:00.000Z',
        accountEmail: 'must-not-transfer@example.com',
        companion: {
            id: 'aster_23',
            name: 'Aster',
            species: 'nebula_soul',
            rarity: 'epic',
            affinity: 'star',
            lifecycleStage: 'adult'
        },
        companionIdentity: {
            schemaVersion: 2,
            creature: {
                id: 'aster_23',
                name: 'Aster',
                species: 'nebula_soul',
                rarity: 'epic',
                affinity: 'star',
                lifecycleStage: 'adult',
                remoteSiblingId: 'must-not-transfer',
                lineage: {
                    origin: 'shared_fusion',
                    generation: 2,
                    parentIds: ['local_parent_1'],
                    protectedParentCount: 1,
                    hasLinkedSibling: true,
                    fusionOperationId: 'shared_fusion_23'
                }
            },
            visualIdentity: {
                activeStage: 'adult',
                stages: [{
                    stage: 'adult',
                    identityKey: 'aster-adult-v2',
                    style: 'cinematic',
                    provider: 'openai',
                    model: 'gpt-image',
                    promptVersion: 'living-form-v2',
                    assetRef:
                        'portraits/aster_23/adult/portrait.webp',
                    imageUrl:
                        'https://temporary.example/secret-signed-url',
                    storage: 'supabase-private',
                    generatedAt: 1785475380000
                }]
            },
            bond: {
                level: 14,
                totalInteractions: 77,
                expeditionsCompleted: 6
            },
            powers: {
                profileSchemaVersion: 1,
                affinity: 'star',
                magnitudeClass: 'extreme',
                currentControl: 86,
                relationshipState: 'synchronized',
                universalSenseId: 'living_resonance',
                affinityPowerId: 'solar_shelter',
                protectiveResponseId: 'starward_intercession',
                partnershipMoveId: 'beacon_arc',
                partnershipMoveUnlocked: true,
                highPowerRevealId: 'daybreak_event',
                highPowerRevealUnlocked: true
            },
            sharedHistory: {
                senseiMemoryIds: [...SENSEI_MEMORY_IDS],
                shipSectionIds: [
                    'systems',
                    'evidence',
                    'boundaries'
                ],
                firstListeningPriority: 'restoration',
                remoteKeeperEmail: 'must-not-transfer@example.com'
            }
        },
        discoveries: {
            currentEcology: {
                awareness: 'network_confirmed',
                networkStatus: 'aligned',
                networkVitality: 91,
                careActions: 12,
                extractionActions: 1,
                restoredRegions: [...REGION_IDS],
                extractionTraceRegions: ['stellar_reef']
            }
        },
        equipment: {
            fieldKitRecovered: true,
            katanaId: 'earth_field_katana',
            katanaUpgrades: [
                'crystal_edge',
                'aurora_guard'
            ],
            recoveredShipSystems: [
                'forest_core',
                'crystal_core',
                'dimensional_drive',
                'hull_plating',
                'aurora_reactor'
            ]
        },
        campaign: {
            guardianResidents: {
                restoredGuardians: [
                    {
                        id: 'elder_treant',
                        relationship: 'known',
                        interactions: 3,
                        teamAbility: 'root_bridge',
                        teamAbilityName: 'Root Bridge',
                        abilityUnlocked: true,
                        activeTeam: true
                    },
                    {
                        id: 'crystal_golem',
                        relationship: 'rescued',
                        interactions: 0,
                        teamAbility: 'Resonance Shield'
                    }
                ]
            },
            remainAndDefend: {
                status: 'complete',
                completedPhases: [...REMAIN_PHASE_IDS],
                priority: 'prepare_homecoming',
                completedAt: '2026-07-31T05:00:00.000Z',
                transmissionStatus: 'not_sent'
            }
        },
        handoff: {
            shipCapabilities: {
                stealthDescent: 'repaired',
                secureReturnVector: 'sealed',
                manualLanding: 'available',
                blackBoxProof: 'recovered',
                passengerCapacity: 1,
                creatureLifeSupport: 'prototype_required',
                longRangeUplink: 'held_exposure_risk'
            },
            shipArchive: {
                reviewComplete: true,
                protectedReturnProtocol: { complete: true },
                currentVeil: { complete: true }
            },
            sensei: {
                memoriesRecalled: [...SENSEI_MEMORY_IDS],
                rememberedLesson: { status: 'practiced' },
                encryptedContact: {
                    channelId: 'DOJO-23-77',
                    status: 'route_recovered',
                    contactAttempted: false,
                    contactEstablished: false
                }
            },
            companionConsent: {
                companionId: 'aster_23',
                travelStatus: 'decision_deferred',
                disclosureStatus: 'astronaut_survival_only',
                locationBoundary: 'coordinates_withheld',
                informedRisks: true,
                willingPassenger: null,
                vetoRecognized: true,
                powerBoundary: 'emergency_life_first',
                reviewedTopics: ['route', 'evidence', 'power']
            },
            companionEarthMemory: {
                companionId: 'aster_23',
                status: 'shared',
                memoryId: 'ocean_after_storm',
                invitationStatus: 'not_offered',
                travelConsentRecorded: false,
                transmissionStatus: 'not_sent',
                sharedAt: '2026-08-02T15:23:00.000Z',
                arbitraryText: 'must-not-transfer'
            }
        },
        fusionBoundary: {
            contractVersion: 2,
            completedLineages: 1
        }
    };
}

function loadHomecomingHandoff(
    legacyBuilder = () => createCompleteLegacyCapsule()
) {
    const filePath = path.join(
        __dirname,
        '../systems/HomecomingHandoff.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            "import { buildCampaignLegacyCapsule } from './CampaignLegacy.js';",
            'const buildCampaignLegacyCapsule = BUILD_LEGACY;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${source}
        module.exports = {
            HOMECOMING_HANDOFF_SCHEMA_VERSION,
            HOMECOMING_HANDOFF_FORMAT,
            HOMECOMING_HANDOFF_MAX_BYTES,
            createHomecomingHandoffPackage,
            createHomecomingHandoffPackageFromCapsule,
            validateHomecomingHandoffPackage,
            getHomecomingReadiness,
            getHomecomingHandoffSnapshot
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        BUILD_LEGACY: legacyBuilder,
        Date,
        JSON,
        Object,
        Array,
        Set,
        Number,
        String,
        Math,
        window: undefined
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Homecoming cross-title handoff', () => {
    const {
        HOMECOMING_HANDOFF_SCHEMA_VERSION,
        HOMECOMING_HANDOFF_FORMAT,
        HOMECOMING_HANDOFF_MAX_BYTES,
        createHomecomingHandoffPackageFromCapsule,
        validateHomecomingHandoffPackage,
        getHomecomingHandoffSnapshot
    } = loadHomecomingHandoff();

    test('builds a valid, ready package from a completed recovery record', () => {
        const handoff = createHomecomingHandoffPackageFromCapsule(
            createCompleteLegacyCapsule(),
            { exportedAt: '2026-07-31T05:30:00.000Z' }
        );
        const result = validateHomecomingHandoffPackage(handoff);

        expect(handoff).toEqual(expect.objectContaining({
            schemaVersion: HOMECOMING_HANDOFF_SCHEMA_VERSION,
            format: HOMECOMING_HANDOFF_FORMAT,
            sourceGame: 'mythical_void',
            targetChapter: 'secret_homecoming',
            exportedAt: '2026-07-31T05:30:00.000Z'
        }));
        expect(handoff.integrity).toEqual(expect.objectContaining({
            authority: 'unsigned_local',
            purpose: 'accidental_corruption_detection'
        }));
        expect(result.valid).toBe(true);
        expect(result.safeForLocalImport).toBe(true);
        expect(result.trustedForServerCommit).toBe(false);
        expect(result.readiness.readyForHomecoming).toBe(true);
        expect(result.readiness.completedCount).toBe(6);
        expect(result.package.payload.companion).toEqual(
            expect.objectContaining({
                id: 'aster_23',
                name: 'Aster',
                species: 'nebula_soul',
                lifecycleStage: 'adult'
            })
        );
        expect(
            result.package.payload.visualIdentity.stages[0].assetRef
        ).toBe('portraits/aster_23/adult/portrait.webp');
        expect(result.package.payload.earthMemory).toEqual({
            companionId: 'aster_23',
            status: 'shared',
            memoryId: 'ocean_after_storm',
            invitationStatus: 'not_offered',
            travelConsentRecorded: false,
            transmissionStatus: 'not_sent',
            sharedAt: '2026-08-02T15:23:00.000Z'
        });
        expect(result.package.payload.allies.restoredGuardians).toEqual([
            {
                id: 'elder_treant',
                relationship: 'known',
                interactions: 3,
                teamAbilityId: 'root_bridge',
                teamAbilityName: 'root_bridge',
                abilityUnlocked: true,
                activeTeam: true
            },
            {
                id: 'crystal_golem',
                relationship: 'rescued',
                interactions: 0,
                teamAbilityId: 'resonance_shield',
                teamAbilityName: null,
                abilityUnlocked: false,
                activeTeam: false
            }
        ]);
    });

    test('carries only one unlocked active guardian ally into Homecoming', () => {
        const capsule = createCompleteLegacyCapsule();
        capsule.campaign.guardianResidents.restoredGuardians[1] = {
            ...capsule.campaign.guardianResidents.restoredGuardians[1],
            abilityUnlocked: true,
            activeTeam: true
        };
        capsule.campaign.guardianResidents.restoredGuardians.push({
            ...capsule.campaign.guardianResidents.restoredGuardians[0]
        });

        const handoff = createHomecomingHandoffPackageFromCapsule(capsule);
        const guardians = handoff.payload.allies.restoredGuardians;

        expect(guardians.map(guardian => guardian.id)).toEqual([
            'elder_treant',
            'crystal_golem'
        ]);
        expect(guardians.filter(guardian => guardian.activeTeam)).toHaveLength(1);
        expect(guardians[0].activeTeam).toBe(true);
    });

    test('preserves bounded lineage while excluding remote identity and URLs', () => {
        const handoff = createHomecomingHandoffPackageFromCapsule(
            createCompleteLegacyCapsule()
        );
        const serialized = JSON.stringify(handoff);

        expect(handoff.payload.companion.lineage).toEqual(
            expect.objectContaining({
                origin: 'shared_fusion',
                generation: 2,
                parentIds: ['local_parent_1'],
                protectedParentCount: 1,
                hasLinkedSibling: true
            })
        );
        expect(serialized).not.toContain('temporary.example');
        expect(serialized).not.toContain('must-not-transfer');
        expect(serialized).not.toContain('remoteSiblingId');
        expect(serialized).not.toContain('remoteKeeperEmail');
        expect(serialized).not.toContain('must-not-transfer');
        expect(handoff.payload.privacy).toEqual(
            expect.objectContaining({
                temporaryImageUrlsIncluded: false,
                remoteIdentityIncluded: false
            })
        );
    });

    test('rejects a package changed after its checksum was created', () => {
        const handoff = createHomecomingHandoffPackageFromCapsule(
            createCompleteLegacyCapsule()
        );
        handoff.payload.companion.name = 'Changed';

        const result = validateHomecomingHandoffPackage(handoff);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('checksum_mismatch');
        expect(result.package).toBeNull();
    });

    test('rejects invalid, oversized, and chronology-breaking imports', () => {
        expect(
            validateHomecomingHandoffPackage('{not-json')
        ).toEqual(expect.objectContaining({
            valid: false,
            errors: ['invalid_json']
        }));
        expect(
            validateHomecomingHandoffPackage(
                'x'.repeat(HOMECOMING_HANDOFF_MAX_BYTES + 1)
            )
        ).toEqual(expect.objectContaining({
            valid: false,
            errors: ['package_too_large']
        }));

        const handoff = createHomecomingHandoffPackageFromCapsule(
            createCompleteLegacyCapsule()
        );
        handoff.payload.sensei.contactEstablished = true;
        handoff.integrity.checksum = handoff.integrity.checksum
            .replace(/[0-9a-f]$/, '0');
        const result = validateHomecomingHandoffPackage(handoff);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([
            'checksum_mismatch',
            'chronology_boundary_violated'
        ]));
    });

    test('wraps an older partial legacy capsule without losing its companion', () => {
        const legacy = {
            schemaVersion: 7,
            sagaId: 'mythical_void_saga',
            sourceChapter: 'crashfall',
            nextChapter: 'remain_and_defend',
            recordedAt: '2026-07-30T23:00:00.000Z',
            companion: {
                id: 'old_save_77',
                name: 'Mira',
                species: 'mist_soul',
                rarity: 'rare',
                affinity: 'mist',
                lifecycleStage: 'juvenile'
            }
        };

        const result = validateHomecomingHandoffPackage(legacy);

        expect(result.valid).toBe(true);
        expect(result.migrated).toBe(true);
        expect(result.warnings).toContain('legacy_capsule_wrapped');
        expect(result.readiness.readyForHomecoming).toBe(false);
        expect(result.package.migratedFrom).toBe(
            'campaign_legacy_v7'
        );
        expect(result.package.payload.companion).toEqual(
            expect.objectContaining({
                id: 'old_save_77',
                name: 'Mira',
                species: 'mist_soul'
            })
        );
    });

    test('reports the first real blocker through the ship-facing snapshot', () => {
        const capsule = createCompleteLegacyCapsule();
        capsule.handoff.shipCapabilities.stealthDescent = 'damaged';
        const { getHomecomingHandoffSnapshot: getSnapshot } =
            loadHomecomingHandoff(() => capsule);
        const state = {
            story: {
                projectBeacon: {
                    finale: { priority: 'prepare_homecoming' },
                    legacyCapsule: {
                        recordedAt: capsule.recordedAt
                    }
                }
            }
        };
        const gameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    state
                );
            }
        };

        const snapshot = getSnapshot(gameState);

        expect(snapshot.available).toBe(true);
        expect(snapshot.valid).toBe(true);
        expect(snapshot.readyForHomecoming).toBe(false);
        expect(snapshot.nextRequirement.id).toBe('protected_return');
        expect(
            snapshot.nextRequirement.detail
        ).toContain('Repair concealed descent');
        expect(snapshot.rows).toHaveLength(6);
    });
});
