const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCampaignLegacy() {
    const filePath = path.join(__dirname, '../systems/CampaignLegacy.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = GET_CURRENT_ECOLOGY_SNAPSHOT;'
        )
        .replace(
            "import { getFendCommunitySnapshot } from './FendCommunity.js';",
            'const getFendCommunitySnapshot = GET_FEND_COMMUNITY_SNAPSHOT;'
        )
        .replace(
            "import { getFendResidentsSnapshot } from './FendResidents.js';",
            'const getFendResidentsSnapshot = GET_FEND_RESIDENTS_SNAPSHOT;'
        )
        .replace(
            "import { getGuardianResidentsSnapshot } from './GuardianResidents.js';",
            'const getGuardianResidentsSnapshot = GET_GUARDIAN_RESIDENTS_SNAPSHOT;'
        )
        .replace(
            "import { getSanctuaryCommunitySnapshot } from './SanctuaryCommunity.js';",
            'const getSanctuaryCommunitySnapshot = GET_SANCTUARY_COMMUNITY_SNAPSHOT;'
        )
        .replace(
            "import { getFendCultureSnapshot } from './FendCulture.js';",
            'const getFendCultureSnapshot = GET_FEND_CULTURE_SNAPSHOT;'
        )
        .replace(
            "import {\n    createCompanionConsentState,\n    getCompanionConsentSnapshot\n} from './CompanionConsent.js';",
            'const createCompanionConsentState = CREATE_COMPANION_CONSENT_STATE;\n' +
            'const getCompanionConsentSnapshot = GET_COMPANION_CONSENT_SNAPSHOT;'
        )
        .replace(
            "import { getCompanionEarthMemorySnapshot } from './CompanionEarthMemory.js';",
            'const getCompanionEarthMemorySnapshot = GET_COMPANION_EARTH_MEMORY_SNAPSHOT;'
        )
        .replace(
            "import { getSenseiMemorySnapshot } from './SenseiMemory.js';",
            'const getSenseiMemorySnapshot = GET_SENSEI_MEMORY_SNAPSHOT;'
        )
        .replace(
            "import { getShipEvidenceSnapshot } from './ShipEvidence.js';",
            'const getShipEvidenceSnapshot = GET_SHIP_EVIDENCE_SNAPSHOT;'
        )
        .replace(
            "import { getProtectedReturnSnapshot } from './ProtectedReturnProtocol.js';",
            'const getProtectedReturnSnapshot = GET_PROTECTED_RETURN_SNAPSHOT;'
        )
        .replace(
            "import { getCurrentVeilSnapshot } from './CurrentVeilMission.js';",
            'const getCurrentVeilSnapshot = GET_CURRENT_VEIL_SNAPSHOT;'
        )
        .replace(
            "import {\n    REMAIN_AND_DEFEND_SCHEMA_VERSION,\n    getRemainAndDefendSnapshot\n} from './RemainAndDefendCampaign.js';",
            'const REMAIN_AND_DEFEND_SCHEMA_VERSION = 1;\n' +
            'const getRemainAndDefendSnapshot = GET_REMAIN_AND_DEFEND_SNAPSHOT;'
        )
        .replace(
            "import { buildPortableCompanionRecord } from './CompanionIdentityArchive.js';",
            'const buildPortableCompanionRecord = BUILD_PORTABLE_COMPANION_RECORD;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = {
            CAMPAIGN_LEGACY_SCHEMA_VERSION,
            FINALE_HANDOFF_SCHEMA_VERSION,
            MYTHICAL_VOID_SAGA,
            CAMPAIGN_INTENTS,
            buildCampaignLegacyCapsule,
            recordCampaignLegacyCapsule,
            recordCampaignPriority
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_CURRENT_ECOLOGY_SNAPSHOT: gameState => {
            const restoredRegionIds = gameState?.get?.(
                'world.currentEcology.restoredRegionIds'
            ) || [];
            return {
                summary: {
                    awareness: 'network_confirmed',
                    networkStatus: restoredRegionIds.length > 0
                        ? 'recovering'
                        : 'strained',
                    vitality: restoredRegionIds.length > 0 ? 38 : 24,
                    restoredRegionIds,
                    arrivalConsequenceCount: 1,
                    extractionTraceRegionIds: ['stellar_reef'],
                    netArrivalVitalityDelta: -3
                }
            };
        },
        GET_FEND_COMMUNITY_SNAPSHOT: gameState => {
            const community = gameState?.get?.('world.fendCommunity') || {};
            const builtProjectIds = community.builtProjectIds || [];
            return {
                stage: builtProjectIds.length,
                state: {
                    builtProjectIds,
                    contributionHistory: community.contributionHistory || []
                },
                support: {
                    maxHealthBonus: builtProjectIds.length >= 1 ? 1 : 0,
                    maxEnergyBonus: builtProjectIds.length >= 2 ? 1 : 0,
                    guardCharges: builtProjectIds.length >= 3 ? 1 : 0,
                    commonsNetwork: builtProjectIds.length >= 4
                }
            };
        },
        GET_FEND_RESIDENTS_SNAPSHOT: gameState => {
            const residents = gameState?.get?.('world.fendResidents') || {};
            return {
                state: {
                    metResidentIds: residents.metResidentIds || [],
                    completedRequestIds: residents.completedRequestIds || [],
                    activeRequestId: residents.activeRequestId || null
                }
            };
        },
        GET_GUARDIAN_RESIDENTS_SNAPSHOT: gameState => {
            const guardians = gameState?.get?.('world.guardianResidents') || {};
            const definitions = {
                elder_treant: ['Elder Treant', 'Root Bridge'],
                crystal_golem: ['Crystal Guardian', 'Resonance Shield'],
                nyxvoral: ["Nyx'voral", 'Current Passage'],
                shadow_phoenix: ['Aurora Phoenix', 'Aurora Lift'],
                cosmic_titan: ['Cosmic Titan', 'Titan Stance'],
                void_empress: ['Void Empress', 'Living Convergence']
            };
            const metIds = new Set(guardians.metIds || []);
            const regionalAllies = (guardians.rescuedIds || [])
                    .filter(id => definitions[id])
                    .map(id => ({
                        id,
                        name: definitions[id][0],
                        futureAbility: definitions[id][1],
                        met: metIds.has(id),
                        interactionCount: guardians.interactions?.[id] || 0,
                        sanctuaryPresence: id === 'elder_treant'
                            ? 'heart_projection'
                            : 'none'
                    }));
            return {
                rescuedResidents: regionalAllies.filter(
                    guardian => guardian.id === 'elder_treant'
                ),
                regionalAllies
            };
        },
        GET_SANCTUARY_COMMUNITY_SNAPSHOT: gameState => {
            const rescued = gameState?.get?.('world.rescuedResidents') || {};
            const guardianIds = gameState?.get?.(
                'world.guardianResidents.rescuedIds'
            ) || [];
            const residentDefinitions = {
                bloom: ['Root Forager', 'bloom', 'forager_hut'],
                pebble: ['Shard Finder', 'pebble', 'current_masonry'],
                zephyr: ['Current Courier', 'zephyr', 'sawmill'],
                wisp: ['Ridge Lookout', 'wisp', 'current_masonry'],
                luna: ['Aurora Surveyor', 'luna', 'workshop'],
                nova: ['Signal Archivist', 'nova', 'workshop']
            };
            const residents = (rescued.rescuedIds || [])
                .filter(id => residentDefinitions[id])
                .map(id => ({
                    id,
                    role: residentDefinitions[id][0],
                    kind: residentDefinitions[id][1],
                    residencyStatus: rescued.residency?.[id]?.status || 'resident',
                    interactionCount: rescued.interactions?.[id] || 0,
                    preferredBuildingId: residentDefinitions[id][2],
                    supportLabel: `${residentDefinitions[id][0]} support`
                }));
            const guardianAllies = guardianIds.map(guardianId => ({
                guardianId,
                outcome: 'restored',
                standing: guardianId === 'elder_treant'
                    ? 'regional_ally'
                    : 'regional_guardian',
                sanctuaryPresence: guardianId === 'elder_treant'
                    ? 'heart_projection'
                    : 'none',
                regionRole: 'Regional Guardian'
            }));
            return {
                schemaVersion: 1,
                residents,
                guardianAllies,
                guardianPresences: guardianAllies.filter(
                    guardian => guardian.sanctuaryPresence !== 'none'
                )
            };
        },
        GET_FEND_CULTURE_SNAPSHOT: gameState => {
            const culture = gameState?.get?.('world.fendCulture') || {};
            const firstListening = culture.firstListening || {};
            return {
                state: {
                    firstListening: {
                        status: firstListening.selectedPriority
                            ? 'complete'
                            : 'locked',
                        selectedPriority:
                            firstListening.selectedPriority || null,
                        heldAt: firstListening.heldAt || null
                    }
                }
            };
        },
        GET_COMPANION_CONSENT_SNAPSHOT: gameState => {
            const consent = gameState?.get?.(
                'story.projectBeacon.companionConsent'
            ) || {};
            const record = Array.isArray(consent.records)
                ? consent.records[0]
                : consent;
            return {
                record: {
                    companionId:
                        record.companionId || 'creature_nova_23',
                    travelStatus:
                        record.travelStatus || 'not_yet_asked',
                    disclosureStatus:
                        record.disclosureStatus || 'withheld',
                    locationBoundary:
                        record.locationBoundary || 'not_discussed',
                    informedRisks: record.informedRisks === true,
                    willingPassenger:
                        typeof record.willingPassenger === 'boolean'
                            ? record.willingPassenger
                            : null,
                    vetoRecognized: record.vetoRecognized !== false,
                    powerBoundary:
                        record.powerBoundary || 'not_discussed',
                    reviewedTopicIds:
                        record.reviewedTopicIds || []
                }
            };
        },
        GET_COMPANION_EARTH_MEMORY_SNAPSHOT: gameState => {
            const state = gameState?.get?.(
                'story.projectBeacon.companionEarthMemory'
            ) || {};
            const record = Array.isArray(state.records)
                ? state.records[0]
                : null;
            const memoryId = [
                'dojo_dawn',
                'ocean_after_storm',
                'city_lights'
            ].includes(record?.selectedMemoryId)
                ? record.selectedMemoryId
                : null;
            return {
                companionId: record?.companionId || 'creature_nova_23',
                complete: Boolean(memoryId),
                selectedMemory: memoryId ? { id: memoryId } : null,
                record: {
                    sharedAt: record?.sharedAt || null
                }
            };
        },
        CREATE_COMPANION_CONSENT_STATE: (_gameState, { recordedAt }) => ({
            schemaVersion: 2,
            activeCompanionId: 'creature_nova_23',
            records: [{
                companionId: 'creature_nova_23',
                travelStatus: 'not_yet_asked',
                disclosureStatus: 'withheld',
                locationBoundary: 'not_discussed',
                informedRisks: false,
                willingPassenger: null,
                vetoRecognized: true,
                powerBoundary: 'not_discussed',
                reviewedTopicIds: [],
                history: [],
                recordedAt,
                lastReviewedAt: null
            }]
        }),
        GET_SENSEI_MEMORY_SNAPSHOT: gameState => {
            const ledger = gameState?.get?.(
                'story.projectBeacon.sensei.memoryLedger'
            ) || {};
            const recalledMemoryIds = Array.isArray(
                ledger.recalledMemoryIds
            ) ? ledger.recalledMemoryIds : [];
            const practiceCount = Math.max(
                0,
                Number(ledger.lesson?.practiceCount) || 0
            );
            return {
                state: {
                    recalledMemoryIds,
                    lesson: {
                        id: 'centering_stance',
                        status: recalledMemoryIds.includes(
                            'begin_with_your_footing'
                        )
                            ? practiceCount > 0
                                ? 'practiced'
                                : 'available'
                            : 'locked',
                        practiceCount,
                        firstPracticedAt:
                            ledger.lesson?.firstPracticedAt || null,
                        lastPracticedAt:
                            ledger.lesson?.lastPracticedAt || null
                    },
                    history: ledger.history || []
                },
                lesson: {
                    id: 'centering_stance',
                    status: recalledMemoryIds.includes(
                        'begin_with_your_footing'
                    )
                        ? practiceCount > 0
                            ? 'practiced'
                            : 'available'
                        : 'locked',
                    practiceCount,
                    firstPracticedAt:
                        ledger.lesson?.firstPracticedAt || null,
                    lastPracticedAt:
                        ledger.lesson?.lastPracticedAt || null
                }
            };
        },
        GET_SHIP_EVIDENCE_SNAPSHOT: gameState => {
            const archive = gameState?.get?.(
                'story.projectBeacon.shipArchive'
            ) || {};
            const reviewedSectionIds = Array.isArray(
                archive.reviewedSectionIds
            ) ? archive.reviewedSectionIds : [];
            return {
                state: {
                    reviewedSectionIds,
                    completedAt: archive.completedAt || null
                },
                complete: reviewedSectionIds.length === 3,
                consent: {
                    record: (() => {
                        const consent = gameState?.get?.(
                            'story.projectBeacon.companionConsent'
                        ) || {};
                        const record = Array.isArray(consent.records)
                            ? consent.records[0] || {}
                            : consent;
                        return {
                            travelStatus:
                                record.travelStatus || 'not_yet_asked'
                        };
                    })()
                },
                capabilities: gameState?.get?.(
                    'story.projectBeacon.shipCapabilities'
                ) || {},
                current: {
                    awareness: 'network_confirmed',
                    restoredRegionIds: gameState?.get?.(
                        'world.currentEcology.restoredRegionIds'
                    ) || [],
                    restoredCount: (
                        gameState?.get?.(
                            'world.currentEcology.restoredRegionIds'
                        ) || []
                    ).length
                }
            };
        },
        GET_PROTECTED_RETURN_SNAPSHOT: gameState => {
            const protocol = gameState?.get?.(
                'story.projectBeacon.protectedReturnProtocol'
            ) || {};
            const completedStepIds = Array.isArray(
                protocol.completedStepIds
            ) ? protocol.completedStepIds : [];
            const complete = completedStepIds.length === 4;
            return {
                state: { completedStepIds },
                complete,
                companionId: gameState?.get?.('creature.genes.id')
                    || 'active_companion',
                packet: {
                    status: complete
                        ? 'sealed_ready_not_sent'
                        : completedStepIds.length > 0
                            ? 'safeguards_in_progress'
                            : 'not_prepared',
                    transmissionStatus: 'not_sent',
                    reportableEvidence: [
                        'astronaut_survival',
                        'mission_crash',
                        'black_box_telemetry'
                    ],
                    protectedFindings: [
                        'fend_coordinates',
                        'current_map',
                        'intelligent_life',
                        'companion_identity',
                        'extreme_power'
                    ]
                }
            };
        },
        GET_CURRENT_VEIL_SNAPSHOT: gameState => {
            const currentVeil = gameState?.get?.(
                'world.currentVeilMission'
            ) || {};
            const stabilizedAnchorIds = Array.isArray(
                currentVeil.stabilizedAnchorIds
            ) ? currentVeil.stabilizedAnchorIds : [];
            const complete =
                currentVeil.status === 'complete' &&
                stabilizedAnchorIds.length === 3;
            return {
                state: {
                    stabilizedAnchorIds,
                    maskStatus: complete
                        ? 'verified'
                        : stabilizedAnchorIds.length === 3
                            ? 'ready_for_verification'
                            : stabilizedAnchorIds.length > 0
                                ? 'aligning'
                                : 'inactive'
                },
                complete,
                companionId: gameState?.get?.('creature.genes.id')
                    || 'active_companion',
                packet: {
                    survivalProofStatus: 'preserved',
                    routeInferenceStatus: complete
                        ? 'blocked'
                        : stabilizedAnchorIds.length === 3
                            ? 'mask_ready'
                            : stabilizedAnchorIds.length > 0
                                ? 'echo_detected'
                                : 'not_assessed',
                    transmissionStatus: 'not_sent',
                    protectedFindings: [
                        'fend_coordinates',
                        'current_rhythm',
                        'settlement_routes',
                        'companion_identity'
                    ]
                }
            };
        },
        GET_REMAIN_AND_DEFEND_SNAPSHOT: gameState => {
            const remain = gameState?.get?.(
                'story.projectBeacon.remainAndDefend'
            ) || {};
            const complete = remain.status === 'complete';
            const priority = gameState?.get?.(
                'story.projectBeacon.finale.priority'
            ) || null;
            const completedPhaseIds = complete
                ? [
                    'hold_the_line',
                    'community_recovery',
                    'first_listening',
                    'companion_boundaries',
                    'earth_archive',
                    'protected_return',
                    'quiet_current',
                    'commons_council'
                ]
                : priority
                    ? ['hold_the_line']
                    : [];
            return {
                status: complete
                    ? 'complete'
                    : priority
                        ? 'active'
                        : 'locked',
                complete,
                priority,
                phases: completedPhaseIds.map(id => ({
                    id,
                    complete: true,
                    status: 'complete'
                })),
                state: {
                    completedAt: remain.completedAt || null
                }
            };
        },
        BUILD_PORTABLE_COMPANION_RECORD: gameState => ({
            schemaVersion: 1,
            recordId: 'companion_identity:creature_nova_23',
            creature: {
                id: 'creature_nova_23',
                name: gameState?.get?.('creature.name') || 'Nova'
            },
            visualIdentity: {
                activeStage: 'juvenile',
                stages: []
            },
            privacy: {
                playerAuthoredFields: ['creature.name'],
                excludes: ['temporary_image_url']
            }
        }),
        Date,
        Object,
        Array,
        Set,
        Number,
        String
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(overrides = {}) {
    const state = {
        creature: {
            name: 'Nova',
            traits: ['curious', 'gentle'],
            genes: {
                id: 'creature_nova_23',
                species: 'Nebula Soul',
                rarity: 'epic',
                cosmicAffinity: { element: 'star' }
            },
            lifecycle: { stage: 'juvenile' },
            bond: {
                level: 8,
                experience: 35,
                totalInteractions: 77,
                levelsCompleted: 4
            },
            powerHistory: [{
                eventId: 'forest_knot_response',
                powerId: 'radiant_pulse',
                affinity: 'star',
                context: 'fend',
                magnitude: 'major',
                outcome: 'living_path_opened',
                occurredAt: '2026-07-30T15:00:00.000Z'
            }],
            agencyHistory: [{
                decisionId: 'rescue:creature_nova_23:mythical_forest_1:lethal_fall',
                type: 'autonomous_rescue',
                levelId: 'mythical_forest_1',
                trigger: 'lethal_fall',
                powerId: 'solar_shelter',
                affinity: 'star',
                magnitude: 'major',
                outcome: 'expedition_loss_prevented',
                occurredAt: '2026-07-30T15:30:00.000Z'
            }, {
                decisionId: 'high_power:creature_nova_23:run_0:final_void_1:five_system_collapse',
                type: 'high_power_rescue',
                levelId: 'final_void_1',
                trigger: 'five_system_collapse',
                powerId: 'daybreak_event',
                affinity: 'star',
                magnitude: 'extreme',
                outcome: 'living_network_stabilized',
                witnessScope: 'five_living_systems',
                earthVisibility: 'city_scale_detectable',
                occurredAt: '2026-07-30T16:23:00.000Z'
            }],
            portraits: {
                activeStage: 'juvenile',
                byStage: {
                    juvenile: {
                        identityKey: 'nova-juvenile-v1',
                        style: 'cinematic',
                        provider: 'openai',
                        model: 'image-model',
                        promptVersion: 'portrait-v2',
                        storage: 'supabase-private'
                    }
                }
            }
        },
        story: {
            projectBeacon: {
                uplinkRestored: true,
                debriefsSeen: ['beacon_debrief_1', 'beacon_debrief_2'],
                fieldKit: {
                    recovered: true,
                    katana: {
                        id: 'earth_field_katana',
                        installedUpgrades: [
                            { id: 'crystal_edge' },
                            'aurora_guard'
                        ]
                    }
                }
            }
        },
        world: {
            livingSignals: {
                observedIds: ['echo_bloom', 'rootlight']
            },
            currentEcology: {
                restoredRegionIds: ['mythical_forest', 'crystal_caves']
            },
            fendCommunity: {
                builtProjectIds: [
                    'trailhead_shelter',
                    'current_well',
                    'wayfinder_relay'
                ],
                contributionHistory: [
                    { operationId: 'community:trailhead_shelter' },
                    { operationId: 'community:current_well' },
                    { operationId: 'community:wayfinder_relay' }
                ]
            },
            fendResidents: {
                metResidentIds: ['kiri', 'mara', 'tovan'],
                completedRequestIds: [
                    'shelter_calibration',
                    'well_return_flow'
                ],
                activeRequestId: 'relay_three_signals'
            },
            guardianResidents: {
                rescuedIds: ['elder_treant', 'crystal_golem'],
                metIds: ['elder_treant'],
                interactions: {
                    elder_treant: 3,
                    crystal_golem: 0
                }
            },
            rescuedResidents: {
                rescuedIds: ['bloom', 'pebble'],
                interactions: { bloom: 2, pebble: 0 },
                residency: {
                    bloom: { status: 'resident' },
                    pebble: { status: 'resident' }
                }
            },
            fendCulture: {
                firstListening: {
                    selectedPriority: 'restoration',
                    heldAt: '2026-07-30T18:23:00.000Z'
                }
            },
            visitedAreas: ['sanctuary:livingarea', 'realm:mythical_forest'],
            signalGarden: { stage: 'bloom' }
        },
        hubWorld: {
            shipParts: {
                collected: ['forest_core', 'crystal_core']
            }
        },
        stats: {
            levelsCompleted: 4
        },
        ...overrides
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath
                .split('.')
                .reduce((value, key) => value?.[key], state);
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn()
    };
}

describe('Campaign legacy capsule', () => {
    const {
        CAMPAIGN_LEGACY_SCHEMA_VERSION,
        MYTHICAL_VOID_SAGA,
        buildCampaignLegacyCapsule,
        recordCampaignLegacyCapsule,
        recordCampaignPriority
    } = loadCampaignLegacy();

    test('defines one chronological saga instead of divergent sequel timelines', () => {
        expect(Array.from(MYTHICAL_VOID_SAGA.chronology)).toEqual([
            'crashfall',
            'remain_and_defend',
            'secret_homecoming',
            'open_first_contact'
        ]);
    });

    test('captures the companion, bond, discoveries, and equipment for later titles', () => {
        const gameState = createGameState();
        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming',
            recordedAt: '2026-07-30T12:00:00.000Z'
        });

        expect(capsule).toEqual(expect.objectContaining({
            schemaVersion: CAMPAIGN_LEGACY_SCHEMA_VERSION,
            sourceChapter: 'crashfall',
            nextChapter: 'remain_and_defend',
            intent: 'prepare_homecoming',
            recordedAt: '2026-07-30T12:00:00.000Z'
        }));
        expect(capsule.companion).toEqual(expect.objectContaining({
            id: 'creature_nova_23',
            name: 'Nova',
            species: 'Nebula Soul',
            rarity: 'epic',
            affinity: 'star',
            lifecycleStage: 'juvenile'
        }));
        expect(capsule.companion.portrait).toEqual(expect.objectContaining({
            identityKey: 'nova-juvenile-v1',
            storage: 'supabase-private'
        }));
        expect(capsule.companionIdentity).toEqual(
            expect.objectContaining({
                schemaVersion: 1,
                recordId:
                    'companion_identity:creature_nova_23',
                privacy: expect.objectContaining({
                    playerAuthoredFields: ['creature.name'],
                    excludes: ['temporary_image_url']
                })
            })
        );
        expect(capsule.fusionBoundary).toEqual({
            contractVersion: 2,
            consentProtocol: 'explicit_local_sanctuary',
            sharedStatus: 'sealed',
            sharedRequirement: 'protected_invitation',
            completedLineages: 0,
            serverVerifiedLineages: 0,
            pendingReconciliations: 0
        });
        expect(Array.from(capsule.companion.powerHistory)).toEqual([
            expect.objectContaining({
                eventId: 'forest_knot_response',
                powerId: 'radiant_pulse',
                magnitude: 'major'
            })
        ]);
        expect(Array.from(capsule.companion.agencyHistory)).toEqual([
            expect.objectContaining({
                type: 'autonomous_rescue',
                levelId: 'mythical_forest_1',
                powerId: 'solar_shelter'
            }),
            expect.objectContaining({
                type: 'high_power_rescue',
                levelId: 'final_void_1',
                powerId: 'daybreak_event',
                magnitude: 'extreme',
                witnessScope: 'five_living_systems',
                earthVisibility: 'city_scale_detectable'
            })
        ]);
        expect(capsule.relationship).toEqual(expect.objectContaining({
            bondLevel: 8,
            totalInteractions: 77,
            levelsCompletedTogether: 4,
            autonomousRescues: 1,
            highPowerRescues: 1
        }));
        expect(Array.from(capsule.discoveries.reviewedFieldReports)).toEqual([
            'beacon_debrief_1',
            'beacon_debrief_2'
        ]);
        expect(Array.from(capsule.equipment.katanaUpgrades)).toEqual([
            'crystal_edge',
            'aurora_guard'
        ]);
        expect(capsule.campaign.fendCommunity).toEqual({
            stage: 3,
            builtProjects: [
                'trailhead_shelter',
                'current_well',
                'wayfinder_relay'
            ],
            contributionCount: 3,
            support: {
                maxHealthBonus: 1,
                maxEnergyBonus: 1,
                guardCharges: 1,
                commonsNetwork: false
            }
        });
        expect(capsule.campaign.fendResidents).toEqual({
            metResidents: ['kiri', 'mara', 'tovan'],
            completedRequests: [
                'shelter_calibration',
                'well_return_flow'
            ],
            activeRequest: 'relay_three_signals'
        });
        expect(capsule.campaign.guardianResidents).toEqual({
            restoredGuardians: [
                {
                    id: 'elder_treant',
                    relationship: 'heart_linked',
                    interactions: 3,
                    teamAbility: 'Root Bridge',
                    teamAbilityName: 'Root Bridge',
                    taskStatus: 'locked',
                    abilityUnlocked: false,
                    activeTeam: false
                },
                {
                    id: 'crystal_golem',
                    relationship: 'regional_ally',
                    interactions: 0,
                    teamAbility: 'Resonance Shield',
                    teamAbilityName: 'Resonance Shield',
                    taskStatus: 'locked',
                    abilityUnlocked: false,
                    activeTeam: false
                }
            ]
        });
        expect(capsule.campaign.sanctuaryCommunity).toEqual(
            expect.objectContaining({
                schemaVersion: 1,
                rescuedResidents: [
                    expect.objectContaining({
                        id: 'bloom',
                        role: 'Root Forager',
                        interactions: 2
                    }),
                    expect.objectContaining({
                        id: 'pebble',
                        role: 'Shard Finder',
                        interactions: 0
                    })
                ],
                regionalGuardians: [
                    expect.objectContaining({
                        id: 'elder_treant',
                        standing: 'regional_ally',
                        sanctuaryPresence: 'heart_projection'
                    }),
                    expect.objectContaining({
                        id: 'crystal_golem',
                        standing: 'regional_guardian',
                        sanctuaryPresence: 'none'
                    })
                ],
                heartPresenceIds: ['elder_treant']
            })
        );
        expect(capsule.campaign.fendCulture).toEqual({
            firstListeningStatus: 'complete',
            selectedPriority: 'restoration',
            heldAt: '2026-07-30T18:23:00.000Z'
        });
        expect(capsule.campaign.remainAndDefend).toEqual({
            schemaVersion: 1,
            status: 'locked',
            completedPhases: [],
            priority: null,
            completedAt: null,
            transmissionStatus: 'not_sent'
        });
        expect(capsule.discoveries.currentEcology).toEqual({
            awareness: 'network_confirmed',
            networkStatus: 'recovering',
            networkVitality: 38,
            careActions: 0,
            extractionActions: 0,
            arrivalConsequenceCount: 1,
            extractionTraceRegions: ['stellar_reef'],
            netArrivalVitalityDelta: -3,
            restoredRegions: ['mythical_forest', 'crystal_caves']
        });
        expect(capsule.handoff).toEqual(expect.objectContaining({
            sharedOutcome: expect.objectContaining({
                coordinatesProtected: true,
                uplinkMode: 'held',
                departureStatus: 'deferred',
                currentCommitment: 'remain_and_defend'
            }),
            sensei: expect.objectContaining({
                encryptedContact: expect.objectContaining({
                    channelId: 'DOJO-23-77',
                    contactEstablished: false
                })
            }),
            companionConsent: expect.objectContaining({
                travelStatus: 'not_yet_asked',
                disclosureStatus: 'withheld',
                willingPassenger: null,
                vetoRecognized: true
            })
        }));
    });

    test('advances the portable chronology after the Commons Council', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.finale = {
            priority: 'prepare_homecoming'
        };
        gameState.state.story.projectBeacon.remainAndDefend = {
            schemaVersion: 1,
            status: 'complete',
            completedAt: '2026-07-31T03:00:00.000Z'
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming',
            recordedAt: '2026-07-31T03:00:00.000Z'
        });

        expect(capsule.sourceChapter).toBe('remain_and_defend');
        expect(capsule.nextChapter).toBe('secret_homecoming');
        expect(capsule.campaign.remainAndDefend).toEqual({
            schemaVersion: 1,
            status: 'complete',
            completedPhases: [
                'hold_the_line',
                'community_recovery',
                'first_listening',
                'companion_boundaries',
                'earth_archive',
                'protected_return',
                'quiet_current',
                'commons_council'
            ],
            priority: 'prepare_homecoming',
            completedAt: '2026-07-31T03:00:00.000Z',
            transmissionStatus: 'not_sent'
        });
    });

    test('carries completed companion boundaries without assuming travel consent', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.companionConsent = {
            schemaVersion: 2,
            activeCompanionId: 'creature_nova_23',
            records: [{
                companionId: 'creature_nova_23',
                travelStatus: 'decision_deferred',
                disclosureStatus: 'astronaut_survival_only',
                locationBoundary: 'coordinates_withheld',
                informedRisks: true,
                willingPassenger: null,
                vetoRecognized: true,
                powerBoundary: 'emergency_life_first',
                reviewedTopicIds: ['route', 'evidence', 'power']
            }]
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming'
        });

        expect(capsule.handoff.companionConsent).toEqual({
            companionId: 'creature_nova_23',
            travelStatus: 'decision_deferred',
            disclosureStatus: 'astronaut_survival_only',
            locationBoundary: 'coordinates_withheld',
            informedRisks: true,
            willingPassenger: null,
            vetoRecognized: true,
            powerBoundary: 'emergency_life_first',
            reviewedTopics: ['route', 'evidence', 'power']
        });
    });

    test('carries one authored Earth memory without creating a travel invitation', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.companionEarthMemory = {
            schemaVersion: 1,
            activeCompanionId: 'creature_nova_23',
            records: [{
                companionId: 'creature_nova_23',
                status: 'shared',
                selectedMemoryId: 'dojo_dawn',
                sharedAt: '2026-08-02T15:23:00.000Z'
            }]
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming'
        });

        expect(capsule.handoff.companionEarthMemory).toEqual({
            companionId: 'creature_nova_23',
            status: 'shared',
            memoryId: 'dojo_dawn',
            invitationStatus: 'not_offered',
            travelConsentRecorded: false,
            transmissionStatus: 'not_sent',
            sharedAt: '2026-08-02T15:23:00.000Z'
        });
    });

    test('carries a sealed protected-return packet without coordinates or transmission', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.protectedReturnProtocol = {
            schemaVersion: 1,
            completedStepIds: [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal',
                'uplink_hold'
            ],
            packetStatus: 'sealed_ready_not_sent',
            transmissionStatus: 'not_sent'
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming'
        });

        expect(
            capsule.handoff.shipArchive.protectedReturnProtocol
        ).toEqual({
            completedSteps: [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal',
                'uplink_hold'
            ],
            complete: true,
            packetStatus: 'sealed_ready_not_sent',
            transmissionStatus: 'not_sent',
            reportableEvidence: [
                'astronaut_survival',
                'mission_crash',
                'black_box_telemetry'
            ],
            protectedFindings: [
                'fend_coordinates',
                'current_map',
                'intelligent_life',
                'companion_identity',
                'extreme_power'
            ],
            companionId: 'creature_nova_23'
        });
        expect(
            JSON.stringify(
                capsule.handoff.shipArchive.protectedReturnProtocol
            )
        ).not.toContain('latitude');
    });

    test('carries the Quiet Current result without authored coordinates or route data', () => {
        const gameState = createGameState();
        gameState.state.world.currentVeilMission = {
            schemaVersion: 1,
            status: 'complete',
            stabilizedAnchorIds: [
                'root_echo',
                'well_echo',
                'relay_echo'
            ],
            maskStatus: 'verified',
            transmissionStatus: 'not_sent'
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming'
        });

        expect(capsule.handoff.shipArchive.currentVeil).toEqual({
            stabilizedAnchors: [
                'root_echo',
                'well_echo',
                'relay_echo'
            ],
            complete: true,
            maskStatus: 'verified',
            survivalProofStatus: 'preserved',
            routeInferenceStatus: 'blocked',
            transmissionStatus: 'not_sent',
            protectedFindings: [
                'fend_coordinates',
                'current_rhythm',
                'settlement_routes',
                'companion_identity'
            ],
            companionId: 'creature_nova_23'
        });
        const serialized = JSON.stringify(
            capsule.handoff.shipArchive.currentVeil
        );
        expect(serialized).not.toMatch(
            /latitude|longitude|route_data|free_text/
        );
    });

    test('carries recalled Sensei history and practiced lesson into Homecoming', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.sensei = {
            relationship: 'pre_mission_friend_and_training_partner',
            memoryLedger: {
                recalledMemoryIds: [
                    'begin_with_your_footing',
                    'trust_begins_with_how_you_enter',
                    'power_is_knowing_what_not_to_take'
                ],
                lesson: {
                    id: 'centering_stance',
                    practiceCount: 2,
                    firstPracticedAt: '2026-07-30T20:23:00.000Z',
                    lastPracticedAt: '2026-07-30T21:23:00.000Z'
                },
                history: []
            }
        };

        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'prepare_homecoming'
        });

        expect(capsule.handoff.sensei).toEqual(expect.objectContaining({
            memoriesRecalled: [
                'begin_with_your_footing',
                'trust_begins_with_how_you_enter',
                'power_is_knowing_what_not_to_take'
            ],
            rememberedLesson: {
                id: 'centering_stance',
                status: 'practiced',
                practiceCount: 2,
                firstPracticedAt: '2026-07-30T20:23:00.000Z',
                lastPracticedAt: '2026-07-30T21:23:00.000Z'
            }
        }));
    });

    test('rejects unknown intentions and excludes player identity fields', () => {
        const gameState = createGameState({
            player: {
                name: 'Do not export',
                email: 'private@example.com'
            },
            story: {
                projectBeacon: {
                    sensei: {
                        relationship: 'injected relationship',
                        encryptedContact: {
                            channelId: 'injected channel',
                            contactEstablished: true
                        }
                    },
                    shipCapabilities: {
                        secureReturnVector: 'injected capability'
                    }
                }
            }
        });
        const capsule = buildCampaignLegacyCapsule(gameState, {
            intent: 'unknown_future'
        });

        expect(capsule.intent).toBeNull();
        expect(capsule.player).toBeUndefined();
        expect(JSON.stringify(capsule)).not.toContain('private@example.com');
        expect(JSON.stringify(capsule)).not.toContain('Do not export');
        expect(JSON.stringify(capsule)).not.toContain('injected');
        expect(capsule.handoff.sensei.encryptedContact.contactEstablished).toBe(
            false
        );
    });

    test('records the capsule in save state', () => {
        const gameState = createGameState();
        const capsule = recordCampaignLegacyCapsule(gameState, {
            intent: 'remain_and_defend'
        });

        expect(gameState.set).toHaveBeenCalledWith(
            'story.projectBeacon.legacyCapsule',
            capsule
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('records a priority without transmitting, departing, or assuming consent', () => {
        const gameState = createGameState();
        gameState.state.story.projectBeacon.sensei = {
            memoryLedger: {
                recalledMemoryIds: ['begin_with_your_footing'],
                lesson: {
                    id: 'centering_stance',
                    practiceCount: 1,
                    firstPracticedAt: '2026-07-30T17:23:00.000Z',
                    lastPracticedAt: '2026-07-30T17:23:00.000Z'
                },
                history: []
            }
        };
        const capsule = recordCampaignPriority(
            gameState,
            'prepare_homecoming',
            { recordedAt: '2026-07-30T18:23:00.000Z' }
        );

        expect(capsule.intent).toBe('prepare_homecoming');
        expect(gameState.get('story.projectBeacon.finale')).toEqual(
            expect.objectContaining({
                priority: 'prepare_homecoming',
                sharedOutcome: expect.objectContaining({
                    coordinatesProtected: true,
                    uplinkMode: 'held',
                    departureStatus: 'deferred',
                    currentCommitment: 'remain_and_defend'
                })
            })
        );
        expect(
            gameState.get(
                'story.projectBeacon.sensei.encryptedContact.contactEstablished'
            )
        ).toBe(false);
        expect(
            gameState.get('story.projectBeacon.sensei.memoryLedger')
        ).toEqual(expect.objectContaining({
            recalledMemoryIds: ['begin_with_your_footing'],
            lesson: expect.objectContaining({
                id: 'centering_stance',
                practiceCount: 1
            })
        }));
        expect(
            gameState.get('story.projectBeacon.companionConsent')
        ).toEqual(expect.objectContaining({
            schemaVersion: 2,
            activeCompanionId: 'creature_nova_23',
            records: [
                expect.objectContaining({
                    companionId: 'creature_nova_23',
                    travelStatus: 'not_yet_asked',
                    disclosureStatus: 'withheld',
                    willingPassenger: null,
                    vetoRecognized: true
                })
            ]
        }));
        expect(
            gameState.get('story.projectBeacon.shipCapabilities')
        ).toEqual({
            schemaVersion: 1,
            stealthDescent: 'damaged',
            secureReturnVector: 'unavailable',
            manualLanding: 'unavailable',
            blackBoxProof: 'missing',
            passengerCapacity: 0,
            creatureLifeSupport: 'not_assessed',
            longRangeUplink: 'offline'
        });
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });
});
