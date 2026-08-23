import { getCurrentEcologySnapshot } from './CurrentEcology.js';
import { getFendCommunitySnapshot } from './FendCommunity.js';
import { getFendResidentsSnapshot } from './FendResidents.js';
import { getGuardianResidentsSnapshot } from './GuardianResidents.js';
import { getSanctuaryCommunitySnapshot } from './SanctuaryCommunity.js';
import { getFendCultureSnapshot } from './FendCulture.js';
import {
    createCompanionConsentState,
    getCompanionConsentSnapshot
} from './CompanionConsent.js';
import { getCompanionEarthMemorySnapshot } from './CompanionEarthMemory.js';
import { getSenseiMemorySnapshot } from './SenseiMemory.js';
import { getShipEvidenceSnapshot } from './ShipEvidence.js';
import { getProtectedReturnSnapshot } from './ProtectedReturnProtocol.js';
import { getCurrentVeilSnapshot } from './CurrentVeilMission.js';
import {
    REMAIN_AND_DEFEND_SCHEMA_VERSION,
    getRemainAndDefendSnapshot
} from './RemainAndDefendCampaign.js';
import { buildPortableCompanionRecord } from './CompanionIdentityArchive.js';

export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16;

export const MYTHICAL_VOID_SAGA = Object.freeze({
    id: 'mythical_void_saga',
    chronology: Object.freeze([
        'crashfall',
        'remain_and_defend',
        'secret_homecoming',
        'open_first_contact'
    ])
});

export const CAMPAIGN_INTENTS = Object.freeze([
    'remain_and_defend',
    'prepare_homecoming',
    'prepare_first_contact'
]);

export const FINALE_HANDOFF_SCHEMA_VERSION = 1;

const DEFAULT_SHARED_OUTCOME = Object.freeze({
    coordinatesProtected: true,
    uplinkMode: 'held',
    departureStatus: 'deferred',
    currentCommitment: 'remain_and_defend'
});

const DEFAULT_SENSEI_HANDOFF = Object.freeze({
    relationship: 'pre_mission_friend_and_training_partner',
    encryptedContact: Object.freeze({
        channelId: 'DOJO-23-77',
        status: 'route_recovered',
        contactAttempted: false,
        contactEstablished: false
    })
});

const DEFAULT_SHIP_CAPABILITIES = Object.freeze({
    stealthDescent: 'damaged',
    secureReturnVector: 'unavailable',
    manualLanding: 'unavailable',
    blackBoxProof: 'missing',
    passengerCapacity: 0,
    creatureLifeSupport: 'not_assessed',
    longRangeUplink: 'offline'
});

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function normalizeText(value, fallback, maxLength = 120) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeStringList(value, maxItems = 64, maxLength = 96) {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(new Set(
        value
            .filter(item => typeof item === 'string')
            .map(item => item.trim().slice(0, maxLength))
            .filter(Boolean)
    )).slice(0, maxItems);
}

function normalizeEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

function getInstalledUpgradeIds(gameState) {
    const installed = getValue(
        gameState,
        'story.projectBeacon.fieldKit.katana.installedUpgrades',
        []
    );

    if (!Array.isArray(installed)) {
        return [];
    }

    return normalizeStringList(
        installed.map(upgrade => (
            typeof upgrade === 'string' ? upgrade : upgrade?.id
        )),
        8,
        64
    );
}

function getPortraitReference(gameState) {
    const portraits = getValue(gameState, 'creature.portraits', {});
    const stage = normalizeText(
        portraits?.activeStage,
        normalizeText(getValue(gameState, 'creature.lifecycle.stage', 'baby'), 'baby', 16),
        16
    );
    const portrait = portraits?.byStage?.[stage];

    if (!portrait || typeof portrait !== 'object') {
        return null;
    }

    return {
        stage,
        identityKey: normalizeText(portrait.identityKey, null, 180),
        style: normalizeText(portrait.style, 'cinematic', 32),
        provider: normalizeText(portrait.provider, 'unknown', 48),
        model: normalizeText(portrait.model, 'unknown', 80),
        promptVersion: normalizeText(portrait.promptVersion, 'unknown', 48),
        storage: portrait.storage === 'supabase-private'
            ? 'supabase-private'
            : 'provider-temporary'
    };
}

function getPowerHistory(gameState) {
    const history = getValue(gameState, 'creature.powerHistory', []);
    if (!Array.isArray(history)) {
        return [];
    }

    return history.slice(-40).map(event => ({
        eventId: normalizeText(event?.eventId, 'unknown', 96),
        powerId: normalizeText(event?.powerId, 'unknown', 96),
        affinity: normalizeText(event?.affinity, 'unknown', 32),
        context: event?.context === 'earth' ? 'earth' : 'fend',
        magnitude: ['controlled', 'major', 'extreme'].includes(event?.magnitude)
            ? event.magnitude
            : 'controlled',
        outcome: normalizeText(event?.outcome, 'completed', 48),
        occurredAt: normalizeText(event?.occurredAt, null, 40)
    }));
}

function getAgencyHistory(gameState) {
    const history = getValue(gameState, 'creature.agencyHistory', []);
    if (!Array.isArray(history)) {
        return [];
    }

    return history.slice(-24).map(decision => {
        const type = [
            'autonomous_rescue',
            'high_power_rescue'
        ].includes(decision?.type)
            ? decision.type
            : 'autonomous_action';
        return {
            decisionId: normalizeText(decision?.decisionId, 'unknown', 96),
            type,
            levelId: normalizeText(decision?.levelId, 'unknown', 64),
            trigger: normalizeText(decision?.trigger, 'unknown', 48),
            powerId: normalizeText(decision?.powerId, 'unknown', 96),
            affinity: normalizeText(decision?.affinity, 'unknown', 32),
            magnitude: ['controlled', 'major', 'extreme'].includes(
                decision?.magnitude
            ) ? decision.magnitude : 'major',
            outcome: normalizeText(decision?.outcome, 'completed', 48),
            occurredAt: normalizeText(decision?.occurredAt, null, 40),
            ...(type === 'high_power_rescue'
                ? {
                    witnessScope: 'five_living_systems',
                    earthVisibility: 'city_scale_detectable'
                }
                : {})
        };
    });
}

function normalizeFinaleHandoff(gameState) {
    const sensei = getValue(
        gameState,
        'story.projectBeacon.sensei',
        DEFAULT_SENSEI_HANDOFF
    );
    const shipCapabilities = getValue(
        gameState,
        'story.projectBeacon.shipCapabilities',
        DEFAULT_SHIP_CAPABILITIES
    );
    const companionConsent = getCompanionConsentSnapshot(gameState).record;
    const companionEarthMemory = getCompanionEarthMemorySnapshot(gameState);
    const senseiMemory = getSenseiMemorySnapshot(gameState);
    const shipEvidence = getShipEvidenceSnapshot(gameState);
    const protectedReturn = getProtectedReturnSnapshot(gameState);
    const currentVeil = getCurrentVeilSnapshot(gameState);

    return {
        schemaVersion: FINALE_HANDOFF_SCHEMA_VERSION,
        sharedOutcome: {
            coordinatesProtected: true,
            uplinkMode: 'held',
            departureStatus: 'deferred',
            currentCommitment: 'remain_and_defend'
        },
        sensei: {
            relationship: DEFAULT_SENSEI_HANDOFF.relationship,
            memoriesRecalled: normalizeStringList(
                senseiMemory.state.recalledMemoryIds,
                3,
                64
            ),
            rememberedLesson: {
                id: 'centering_stance',
                status: normalizeEnum(
                    senseiMemory.lesson.status,
                    ['locked', 'available', 'practiced'],
                    'locked'
                ),
                practiceCount: Math.max(
                    0,
                    Math.min(
                        999,
                        Number(senseiMemory.lesson.practiceCount) || 0
                    )
                ),
                firstPracticedAt: normalizeText(
                    senseiMemory.lesson.firstPracticedAt,
                    null,
                    40
                ),
                lastPracticedAt: normalizeText(
                    senseiMemory.lesson.lastPracticedAt,
                    null,
                    40
                )
            },
            encryptedContact: {
                channelId: DEFAULT_SENSEI_HANDOFF.encryptedContact.channelId,
                status: 'route_recovered',
                contactAttempted:
                    sensei?.encryptedContact?.contactAttempted === true,
                contactEstablished: false
            }
        },
        shipCapabilities: {
            stealthDescent: normalizeEnum(
                shipCapabilities?.stealthDescent,
                ['damaged', 'repaired'],
                DEFAULT_SHIP_CAPABILITIES.stealthDescent
            ),
            secureReturnVector: normalizeEnum(
                shipCapabilities?.secureReturnVector,
                ['unavailable', 'sealed'],
                DEFAULT_SHIP_CAPABILITIES.secureReturnVector
            ),
            manualLanding: normalizeEnum(
                shipCapabilities?.manualLanding,
                ['unavailable', 'available'],
                DEFAULT_SHIP_CAPABILITIES.manualLanding
            ),
            blackBoxProof: normalizeEnum(
                shipCapabilities?.blackBoxProof,
                ['missing', 'recovered'],
                DEFAULT_SHIP_CAPABILITIES.blackBoxProof
            ),
            passengerCapacity: Math.max(
                0,
                Math.min(1, Number(shipCapabilities?.passengerCapacity) || 0)
            ),
            creatureLifeSupport: normalizeEnum(
                shipCapabilities?.creatureLifeSupport,
                ['not_assessed', 'prototype_required', 'ready'],
                DEFAULT_SHIP_CAPABILITIES.creatureLifeSupport
            ),
            longRangeUplink: normalizeEnum(
                shipCapabilities?.longRangeUplink,
                ['offline', 'held_exposure_risk'],
                DEFAULT_SHIP_CAPABILITIES.longRangeUplink
            )
        },
        shipArchive: {
            reviewedSections: normalizeStringList(
                shipEvidence.state.reviewedSectionIds,
                3,
                32
            ),
            reviewComplete: shipEvidence.complete,
            transmissionStatus: 'not_sent',
            coordinatesProtected: true,
            travelStatus: normalizeEnum(
                shipEvidence.consent.record.travelStatus,
                [
                    'not_yet_asked',
                    'decision_deferred',
                    'willing',
                    'declined'
                ],
                'not_yet_asked'
            ),
            evidence: {
                blackBoxProof: shipEvidence.capabilities.blackBoxProof,
                currentAwareness: normalizeText(
                    shipEvidence.current.awareness,
                    'unmapped',
                    32
                ),
                restoredRegions: Math.max(
                    0,
                    Number(shipEvidence.current.restoredCount) || 0
                ),
                intelligentLifeBoundary: 'protected',
                highPowerEvents: getAgencyHistory(gameState).filter(
                    entry => entry.type === 'high_power_rescue'
                ).length
            },
            protectedReturnProtocol: {
                completedSteps: normalizeStringList(
                    protectedReturn.state.completedStepIds,
                    4,
                    32
                ),
                complete: protectedReturn.complete,
                packetStatus: normalizeEnum(
                    protectedReturn.packet.status,
                    [
                        'not_prepared',
                        'safeguards_in_progress',
                        'sealed_ready_not_sent'
                    ],
                    'not_prepared'
                ),
                transmissionStatus: 'not_sent',
                reportableEvidence: normalizeStringList(
                    protectedReturn.packet.reportableEvidence,
                    3,
                    32
                ),
                protectedFindings: normalizeStringList(
                    protectedReturn.packet.protectedFindings,
                    5,
                    32
                ),
                companionId: normalizeText(
                    protectedReturn.companionId,
                    'active_companion',
                    96
                )
            },
            currentVeil: {
                stabilizedAnchors: normalizeStringList(
                    currentVeil.state.stabilizedAnchorIds,
                    3,
                    32
                ),
                complete: currentVeil.complete,
                maskStatus: normalizeEnum(
                    currentVeil.state.maskStatus,
                    [
                        'inactive',
                        'aligning',
                        'ready_for_verification',
                        'verified'
                    ],
                    'inactive'
                ),
                survivalProofStatus: 'preserved',
                routeInferenceStatus: normalizeEnum(
                    currentVeil.packet.routeInferenceStatus,
                    [
                        'not_assessed',
                        'echo_detected',
                        'mask_ready',
                        'blocked'
                    ],
                    'not_assessed'
                ),
                transmissionStatus: 'not_sent',
                protectedFindings: normalizeStringList(
                    currentVeil.packet.protectedFindings,
                    4,
                    32
                ),
                companionId: normalizeText(
                    currentVeil.companionId,
                    'active_companion',
                    96
                )
            }
        },
        companionConsent: {
            companionId: normalizeText(
                companionConsent?.companionId,
                'active_companion',
                96
            ),
            travelStatus: normalizeEnum(
                companionConsent?.travelStatus,
                [
                    'not_yet_asked',
                    'decision_deferred',
                    'willing',
                    'declined'
                ],
                'not_yet_asked'
            ),
            disclosureStatus: normalizeEnum(
                companionConsent?.disclosureStatus,
                [
                    'withheld',
                    'astronaut_survival_only',
                    'bounded_evidence_approved'
                ],
                'withheld'
            ),
            locationBoundary: companionConsent?.locationBoundary ===
                'coordinates_withheld'
                ? 'coordinates_withheld'
                : 'not_discussed',
            informedRisks: companionConsent?.informedRisks === true,
            willingPassenger: typeof companionConsent?.willingPassenger === 'boolean'
                ? companionConsent.willingPassenger
                : null,
            vetoRecognized: companionConsent?.vetoRecognized !== false,
            powerBoundary: companionConsent?.powerBoundary ===
                'emergency_life_first'
                ? 'emergency_life_first'
                : 'not_discussed',
            reviewedTopics: normalizeStringList(
                companionConsent?.reviewedTopicIds,
                3,
                32
            )
        },
        companionEarthMemory: {
            companionId: normalizeText(
                companionEarthMemory.companionId,
                'active_companion',
                96
            ),
            status: companionEarthMemory.complete
                ? 'shared'
                : 'not_shared',
            memoryId: normalizeEnum(
                companionEarthMemory.selectedMemory?.id,
                [
                    'dojo_dawn',
                    'ocean_after_storm',
                    'city_lights'
                ],
                null
            ),
            invitationStatus: 'not_offered',
            travelConsentRecorded: false,
            transmissionStatus: 'not_sent',
            sharedAt: normalizeText(
                companionEarthMemory.record.sharedAt,
                null,
                40
            )
        }
    };
}

/**
 * Build the privacy-minimized narrative contract carried into later titles.
 * The bounded creature name is the only player-authored text. Player account,
 * age-band, location, voice, and arbitrary free text are excluded.
 */
export function buildCampaignLegacyCapsule(gameState, {
    intent = null,
    recordedAt = new Date().toISOString()
} = {}) {
    const genes = getValue(gameState, 'creature.genes', {});
    const affinity = genes?.cosmicAffinity;
    const bond = getValue(gameState, 'creature.bond', {});
    const fieldKit = getValue(gameState, 'story.projectBeacon.fieldKit', {});
    const currentEcology = getCurrentEcologySnapshot(gameState).summary;
    const fendCommunity = getFendCommunitySnapshot(gameState);
    const fendResidents = getFendResidentsSnapshot(gameState);
    const guardianResidents = getGuardianResidentsSnapshot(gameState);
    const sanctuaryCommunity = getSanctuaryCommunitySnapshot(gameState);
    const fendCulture = getFendCultureSnapshot(gameState);
    const remainAndDefend = getRemainAndDefendSnapshot(gameState);
    const agencyHistory = getAgencyHistory(gameState);
    const fusionHistory = getValue(
        gameState,
        'breedingShrine.breedingHistory',
        []
    );
    const fusionReconciliationQueue = getValue(
        gameState,
        'breedingShrine.reconciliationQueue',
        []
    );

    return {
        schemaVersion: CAMPAIGN_LEGACY_SCHEMA_VERSION,
        sagaId: MYTHICAL_VOID_SAGA.id,
        sourceChapter: remainAndDefend.complete
            ? 'remain_and_defend'
            : 'crashfall',
        nextChapter: remainAndDefend.complete
            ? 'secret_homecoming'
            : 'remain_and_defend',
        intent: CAMPAIGN_INTENTS.includes(intent) ? intent : null,
        recordedAt: normalizeText(recordedAt, new Date().toISOString(), 40),
        companion: {
            id: normalizeText(genes?.id, 'companion', 96),
            name: normalizeText(
                getValue(gameState, 'creature.name', 'Companion'),
                'Companion',
                32
            ),
            species: normalizeText(genes?.species, 'unknown', 64),
            rarity: normalizeText(genes?.rarity, 'common', 24),
            affinity: normalizeText(
                typeof affinity === 'string' ? affinity : affinity?.element,
                'unknown',
                32
            ),
            lifecycleStage: normalizeText(
                getValue(gameState, 'creature.lifecycle.stage', 'baby'),
                'baby',
                16
            ),
            traits: normalizeStringList(getValue(gameState, 'creature.traits', []), 24, 64),
            powerHistory: getPowerHistory(gameState),
            agencyHistory,
            portrait: getPortraitReference(gameState)
        },
        companionIdentity: buildPortableCompanionRecord(gameState),
        fusionBoundary: {
            contractVersion: 2,
            consentProtocol: 'explicit_local_sanctuary',
            sharedStatus: 'sealed',
            sharedRequirement: 'protected_invitation',
            completedLineages: Array.isArray(fusionHistory)
                ? Math.min(50, fusionHistory.length)
                : 0,
            serverVerifiedLineages: Array.isArray(fusionHistory)
                ? fusionHistory.filter(entry => (
                    [
                        'server_generated',
                        'server_finalized'
                    ].includes(entry?.authority)
                )).length
                : 0,
            pendingReconciliations:
                Array.isArray(fusionReconciliationQueue)
                    ? Math.min(1, fusionReconciliationQueue.length)
                    : 0
        },
        relationship: {
            bondLevel: Math.max(1, Number(bond?.level) || 1),
            bondExperience: Math.max(0, Number(bond?.experience) || 0),
            totalInteractions: Math.max(0, Number(bond?.totalInteractions) || 0),
            levelsCompletedTogether: Math.max(0, Number(bond?.levelsCompleted) || 0),
            autonomousRescues: Math.max(
                agencyHistory.filter(
                    decision => decision.type === 'autonomous_rescue'
                ).length,
                Number(bond?.autonomousRescues) || 0
            ),
            highPowerRescues: Math.max(
                agencyHistory.filter(
                    decision => decision.type === 'high_power_rescue'
                ).length,
                Number(bond?.highPowerRescues) || 0
            )
        },
        discoveries: {
            reviewedFieldReports: normalizeStringList(
                getValue(gameState, 'story.projectBeacon.debriefsSeen', [])
            ),
            observedLivingSignals: normalizeStringList(
                getValue(gameState, 'world.livingSignals.observedIds', [])
            ),
            currentEcology: {
                awareness: currentEcology.awareness,
                networkStatus: currentEcology.networkStatus,
                networkVitality: currentEcology.vitality,
                careActions: Math.max(0, Number(currentEcology.careActions) || 0),
                extractionActions: Math.max(
                    0,
                    Number(currentEcology.extractionActions) || 0
                ),
                arrivalConsequenceCount: Math.max(
                    0,
                    Number(currentEcology.arrivalConsequenceCount) || 0
                ),
                extractionTraceRegions: normalizeStringList(
                    currentEcology.extractionTraceRegionIds,
                    6,
                    48
                ),
                netArrivalVitalityDelta: Math.max(
                    -120,
                    Math.min(
                        72,
                        Number(currentEcology.netArrivalVitalityDelta) || 0
                    )
                ),
                restoredRegions: normalizeStringList(
                    currentEcology.restoredRegionIds,
                    8,
                    64
                )
            },
            visitedAreas: normalizeStringList(
                getValue(gameState, 'world.visitedAreas', []),
                128
            )
        },
        equipment: {
            fieldKitRecovered: fieldKit?.recovered === true,
            katanaId: normalizeText(fieldKit?.katana?.id, 'earth_field_katana', 64),
            katanaUpgrades: getInstalledUpgradeIds(gameState),
            recoveredShipSystems: normalizeStringList(
                getValue(gameState, 'hubWorld.shipParts.collected', []),
                16,
                64
            )
        },
        campaign: {
            uplinkRestored: getValue(
                gameState,
                'story.projectBeacon.uplinkRestored',
                false
            ) === true,
            levelsCompleted: Math.max(
                0,
                Number(getValue(gameState, 'stats.levelsCompleted', 0)) || 0
            ),
            signalGardenStage: normalizeText(
                getValue(gameState, 'world.signalGarden.stage', 'seed'),
                'seed',
                24
            ),
            fendCommunity: {
                stage: Math.max(0, Number(fendCommunity.stage) || 0),
                builtProjects: normalizeStringList(
                    fendCommunity.state.builtProjectIds,
                    4,
                    64
                ),
                contributionCount: Math.max(
                    0,
                    Number(fendCommunity.state.contributionHistory.length) || 0
                ),
                support: {
                    maxHealthBonus: Math.max(
                        0,
                        Number(fendCommunity.support.maxHealthBonus) || 0
                    ),
                    maxEnergyBonus: Math.max(
                        0,
                        Number(fendCommunity.support.maxEnergyBonus) || 0
                    ),
                    guardCharges: Math.max(
                        0,
                        Number(fendCommunity.support.guardCharges) || 0
                    ),
                    commonsNetwork:
                        fendCommunity.support.commonsNetwork === true
                }
            },
            fendResidents: {
                metResidents: normalizeStringList(
                    fendResidents.state.metResidentIds,
                    4,
                    32
                ),
                completedRequests: normalizeStringList(
                    fendResidents.state.completedRequestIds,
                    4,
                    64
                ),
                activeRequest: normalizeText(
                    fendResidents.state.activeRequestId,
                    null,
                    64
                )
            },
            guardianResidents: {
                // Deprecated compatibility alias. Guardians remain in their
                // regions; only an authored presence may answer the Heart.
                restoredGuardians: guardianResidents.regionalAllies.map(
                    resident => ({
                        id: normalizeText(resident.id, 'guardian', 48),
                        relationship: resident.sanctuaryPresence !== 'none'
                            ? 'heart_linked'
                            : 'regional_ally',
                        interactions: Math.max(
                            0,
                            Math.min(
                                999,
                                Number(resident.interactionCount) || 0
                            )
                        ),
                        teamAbility: normalizeText(
                            resident.teamAbility?.id || resident.futureAbility,
                            'unknown',
                            64
                        ),
                        teamAbilityName: normalizeText(
                            resident.teamAbility?.name,
                            resident.futureAbility,
                            64
                        ),
                        taskStatus: normalizeText(
                            resident.taskStatus,
                            'locked',
                            16
                        ),
                        abilityUnlocked:
                            resident.teamAbilityUnlocked === true,
                        activeTeam: resident.activeTeam === true
                    })
                )
            },
            sanctuaryCommunity: {
                schemaVersion: Math.max(
                    1,
                    Number(sanctuaryCommunity.schemaVersion) || 1
                ),
                rescuedResidents: sanctuaryCommunity.residents.map(resident => ({
                    id: normalizeText(resident.id, 'resident', 48),
                    role: normalizeText(resident.role, 'Sanctuary resident', 64),
                    kind: normalizeText(resident.kind, 'unknown', 48),
                    residencyStatus: normalizeEnum(
                        resident.residencyStatus,
                        ['resident', 'guest', 'away'],
                        'resident'
                    ),
                    interactions: Math.max(
                        0,
                        Math.min(999, Number(resident.interactionCount) || 0)
                    ),
                    preferredBuildingId: normalizeText(
                        resident.preferredBuildingId,
                        null,
                        64
                    ),
                    supportLabel: normalizeText(
                        resident.supportLabel,
                        null,
                        120
                    )
                })),
                regionalGuardians: sanctuaryCommunity.guardianAllies.map(
                    guardian => ({
                        id: normalizeText(guardian.guardianId, 'guardian', 48),
                        outcome: normalizeEnum(
                            guardian.outcome,
                            ['restored', 'allied', 'defeated', 'withdrawn'],
                            'restored'
                        ),
                        standing: normalizeText(
                            guardian.standing,
                            'regional_guardian',
                            48
                        ),
                        sanctuaryPresence: normalizeText(
                            guardian.sanctuaryPresence,
                            'none',
                            48
                        ),
                        regionRole: normalizeText(
                            guardian.regionRole,
                            'Regional guardian',
                            64
                        )
                    })
                ),
                heartPresenceIds: normalizeStringList(
                    sanctuaryCommunity.guardianPresences.map(
                        guardian => guardian.guardianId
                    ),
                    2,
                    48
                )
            },
            fendCulture: {
                firstListeningStatus:
                    fendCulture.state.firstListening.status,
                selectedPriority: normalizeText(
                    fendCulture.state.firstListening.selectedPriority,
                    null,
                    32
                ),
                heldAt: normalizeText(
                    fendCulture.state.firstListening.heldAt,
                    null,
                    40
                )
            },
            remainAndDefend: {
                schemaVersion: REMAIN_AND_DEFEND_SCHEMA_VERSION,
                status: remainAndDefend.status,
                completedPhases: normalizeStringList(
                    remainAndDefend.phases
                        .filter(phase => phase.status === 'complete')
                        .map(phase => phase.id),
                    8,
                    48
                ),
                priority: normalizeEnum(
                    remainAndDefend.priority,
                    CAMPAIGN_INTENTS,
                    null
                ),
                completedAt: normalizeText(
                    remainAndDefend.state.completedAt,
                    null,
                    40
                ),
                transmissionStatus: 'not_sent'
            }
        },
        handoff: normalizeFinaleHandoff(gameState)
    };
}

export function recordCampaignLegacyCapsule(gameState, options = {}) {
    if (!gameState?.set) {
        return null;
    }

    const capsule = buildCampaignLegacyCapsule(gameState, options);
    gameState.set('story.projectBeacon.legacyCapsule', capsule);
    gameState.save?.();
    return capsule;
}

/**
 * Commit the finale as a preparation priority, never as an immediate departure.
 * This writes the portable handoff before one save so later titles can trust the
 * companion-consent and coordinate-protection invariants.
 */
export function recordCampaignPriority(gameState, priority, {
    recordedAt = new Date().toISOString()
} = {}) {
    if (!gameState?.set || !CAMPAIGN_INTENTS.includes(priority)) {
        return null;
    }

    const sharedOutcome = {
        ...DEFAULT_SHARED_OUTCOME,
        recordedAt
    };
    const existingSensei = getValue(
        gameState,
        'story.projectBeacon.sensei',
        {}
    );
    const memoryLedger = getSenseiMemorySnapshot(gameState).state;
    const sensei = {
        ...existingSensei,
        schemaVersion: 2,
        relationship: DEFAULT_SENSEI_HANDOFF.relationship,
        memories: [
            'begin_with_your_footing',
            'trust_begins_with_how_you_enter',
            'power_is_knowing_what_not_to_take'
        ],
        memoryLedger,
        encryptedContact: {
            ...DEFAULT_SENSEI_HANDOFF.encryptedContact,
            ...(existingSensei?.encryptedContact || {}),
            channelId: DEFAULT_SENSEI_HANDOFF.encryptedContact.channelId,
            status: 'route_recovered',
            contactAttempted: false,
            contactEstablished: false,
            recoveredAt: recordedAt
        }
    };
    const currentShipCapabilities = getValue(
        gameState,
        'story.projectBeacon.shipCapabilities',
        {}
    );
    const shipCapabilities = {
        schemaVersion: FINALE_HANDOFF_SCHEMA_VERSION,
        stealthDescent: normalizeEnum(
            currentShipCapabilities?.stealthDescent,
            ['damaged', 'repaired'],
            DEFAULT_SHIP_CAPABILITIES.stealthDescent
        ),
        secureReturnVector: normalizeEnum(
            currentShipCapabilities?.secureReturnVector,
            ['unavailable', 'sealed'],
            DEFAULT_SHIP_CAPABILITIES.secureReturnVector
        ),
        manualLanding: normalizeEnum(
            currentShipCapabilities?.manualLanding,
            ['unavailable', 'available'],
            DEFAULT_SHIP_CAPABILITIES.manualLanding
        ),
        blackBoxProof: normalizeEnum(
            currentShipCapabilities?.blackBoxProof,
            ['missing', 'recovered'],
            DEFAULT_SHIP_CAPABILITIES.blackBoxProof
        ),
        passengerCapacity: Math.max(
            0,
            Math.min(
                1,
                Number(currentShipCapabilities?.passengerCapacity) || 0
            )
        ),
        creatureLifeSupport: normalizeEnum(
            currentShipCapabilities?.creatureLifeSupport,
            ['not_assessed', 'prototype_required', 'ready'],
            DEFAULT_SHIP_CAPABILITIES.creatureLifeSupport
        ),
        longRangeUplink: normalizeEnum(
            currentShipCapabilities?.longRangeUplink,
            ['offline', 'held_exposure_risk'],
            DEFAULT_SHIP_CAPABILITIES.longRangeUplink
        )
    };
    const companionConsent = createCompanionConsentState(gameState, {
        recordedAt
    });
    const finale = {
        schemaVersion: FINALE_HANDOFF_SCHEMA_VERSION,
        sharedOutcome,
        priority,
        prioritySelectedAt: recordedAt,
        epilogueSeen: false,
        epilogueCompletedAt: null
    };

    gameState.set('story.projectBeacon.finale', finale);
    gameState.set('story.projectBeacon.sensei', sensei);
    gameState.set(
        'story.projectBeacon.shipCapabilities',
        shipCapabilities
    );
    gameState.set(
        'story.projectBeacon.companionConsent',
        companionConsent
    );

    const capsule = buildCampaignLegacyCapsule(gameState, {
        intent: priority,
        recordedAt
    });
    gameState.set('story.projectBeacon.legacyCapsule', capsule);
    gameState.save?.();
    return capsule;
}
