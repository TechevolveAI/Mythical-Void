import { buildCampaignLegacyCapsule } from './CampaignLegacy.js';

export const HOMECOMING_HANDOFF_SCHEMA_VERSION = 2;
export const HOMECOMING_HANDOFF_FORMAT =
    'mythical_void_homecoming_handoff';
export const HOMECOMING_HANDOFF_MAX_BYTES = 262144;

const REGION_IDS = Object.freeze([
    'mythical_forest',
    'crystal_caves',
    'stellar_reef',
    'void_peaks',
    'aurora_depths',
    'current_heart'
]);
const REMAIN_PHASE_IDS = Object.freeze([
    'hold_the_line',
    'community_recovery',
    'first_listening',
    'companion_boundaries',
    'earth_archive',
    'protected_return',
    'quiet_current',
    'commons_council'
]);
const SENSEI_MEMORY_IDS = Object.freeze([
    'begin_with_your_footing',
    'trust_begins_with_how_you_enter',
    'power_is_knowing_what_not_to_take'
]);
const CONSENT_TOPIC_IDS = Object.freeze([
    'route',
    'evidence',
    'power'
]);
const EARTH_MEMORY_IDS = Object.freeze([
    'dojo_dawn',
    'ocean_after_storm',
    'city_lights'
]);
const LIFECYCLE_STAGES = Object.freeze([
    'baby',
    'juvenile',
    'adult',
    'elder'
]);
const GUARDIAN_RESIDENT_IDS = Object.freeze([
    'elder_treant',
    'crystal_golem',
    'nyxvoral',
    'shadow_phoenix',
    'cosmic_titan',
    'void_empress'
]);
const RESCUED_RESIDENT_IDS = Object.freeze([
    'bloom',
    'pebble',
    'zephyr',
    'wisp',
    'luna',
    'nova'
]);
const PRIVACY_EXCLUDES = Object.freeze([
    'account_identity',
    'age',
    'location',
    'email',
    'voice',
    'arbitrary_text',
    'temporary_image_url',
    'remote_keeper_identity',
    'remote_companion_name',
    'remote_sibling_id'
]);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeIdentifier(value, fallback = null, maxLength = 96) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeName(value, fallback = 'Companion') {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .replace(/[\u0000-\u001F\u007F<>]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 24);
    return normalized || fallback;
}

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return /^\d{4}-\d{2}-\d{2}T/.test(normalized)
        ? normalized
        : null;
}

function normalizeOpaqueAssetRef(value, maxLength = 180) {
    if (typeof value !== 'string') return null;
    const normalized = value
        .trim()
        .replace(/[^a-zA-Z0-9/_:.-]+/g, '')
        .replace(/\.{2,}/g, '.')
        .replace(/^\/+/, '')
        .slice(0, maxLength);
    return normalized || null;
}

function normalizeEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

function normalizeKnownList(value, allowed, maxItems = allowed.length) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value.filter(item => allowed.includes(item))
    )).slice(0, maxItems);
}

function normalizeIdentifierList(value, maxItems, maxLength = 96) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map(item => normalizeIdentifier(item, null, maxLength))
            .filter(Boolean)
    )).slice(0, maxItems);
}

function canonicalize(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

function checksum(value) {
    const source = canonicalize(value);
    let hash = 0x811C9DC5;
    for (let index = 0; index < source.length; index++) {
        const code = source.charCodeAt(index);
        hash ^= code & 0xFF;
        hash = Math.imul(hash, 0x01000193) >>> 0;
        hash ^= code >>> 8;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a32-utf16:${hash.toString(16).padStart(8, '0')}`;
}

function normalizePortraitStages(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(record => {
        const stage = normalizeEnum(
            record?.stage,
            LIFECYCLE_STAGES,
            null
        );
        if (!stage || seen.has(stage)) return null;
        seen.add(stage);
        const storage = record?.storage === 'supabase-private'
            ? 'supabase-private'
            : 'provider-temporary';
        return {
            stage,
            identityKey: normalizeIdentifier(
                record?.identityKey,
                null,
                180
            ),
            style: normalizeIdentifier(
                record?.style,
                'cinematic',
                32
            ),
            provider: normalizeIdentifier(
                record?.provider,
                'unknown',
                48
            ),
            model: normalizeIdentifier(
                record?.model,
                'unknown',
                80
            ),
            promptVersion: normalizeIdentifier(
                record?.promptVersion,
                'unknown',
                48
            ),
            assetRef: storage === 'supabase-private'
                ? normalizeOpaqueAssetRef(record?.assetRef)
                : null,
            storage,
            generatedAt: Number.isFinite(Number(record?.generatedAt))
                ? clamp(Math.floor(Number(record.generatedAt)), 0, 9999999999999)
                : null
        };
    }).filter(Boolean).slice(0, LIFECYCLE_STAGES.length);
}

function getCapsuleCompanion(capsule) {
    return capsule?.companionIdentity?.creature || capsule?.companion || {};
}

function normalizeGuardianRoster(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    let activeAssigned = false;
    return value.map(guardian => {
        const id = normalizeEnum(
            guardian?.id,
            GUARDIAN_RESIDENT_IDS,
            null
        );
        if (!id || seen.has(id)) return null;
        seen.add(id);
        const abilityUnlocked = guardian?.abilityUnlocked === true;
        const activeTeam =
            guardian?.activeTeam === true &&
            abilityUnlocked &&
            !activeAssigned;
        if (activeTeam) activeAssigned = true;
        return {
            id,
            relationship: normalizeEnum(
                guardian?.relationship,
                [
                    'known',
                    'rescued',
                    'regional_ally',
                    'heart_linked'
                ],
                'regional_ally'
            ),
            interactions: clamp(
                Math.floor(Number(guardian?.interactions) || 0),
                0,
                999
            ),
            teamAbilityId: normalizeIdentifier(
                guardian?.teamAbility,
                'unknown',
                64
            ),
            teamAbilityName: normalizeIdentifier(
                guardian?.teamAbilityName,
                null,
                64
            ),
            abilityUnlocked,
            activeTeam
        };
    }).filter(Boolean).slice(0, GUARDIAN_RESIDENT_IDS.length);
}

function normalizeRegionalGuardianRoster(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(guardian => {
        const id = normalizeEnum(guardian?.id, GUARDIAN_RESIDENT_IDS, null);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        return {
            id,
            outcome: normalizeEnum(
                guardian?.outcome,
                ['restored', 'allied', 'defeated', 'withdrawn'],
                'restored'
            ),
            standing: normalizeEnum(
                guardian?.standing,
                ['regional_ally', 'regional_guardian'],
                id === 'elder_treant' ? 'regional_ally' : 'regional_guardian'
            ),
            sanctuaryPresence: guardian?.sanctuaryPresence === 'heart_projection'
                ? 'heart_projection'
                : 'none',
            regionRole: normalizeIdentifier(
                guardian?.regionRole,
                'regional_guardian',
                64
            )
        };
    }).filter(Boolean).slice(0, GUARDIAN_RESIDENT_IDS.length);
}

function normalizeRescuedResidentRoster(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(resident => {
        const id = normalizeEnum(resident?.id, RESCUED_RESIDENT_IDS, null);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        return {
            id,
            role: normalizeIdentifier(resident?.role, 'sanctuary_resident', 64),
            kind: normalizeIdentifier(resident?.kind, id, 48),
            residencyStatus: normalizeEnum(
                resident?.residencyStatus,
                ['resident', 'guest', 'away'],
                'resident'
            ),
            interactions: clamp(
                Math.floor(Number(resident?.interactions) || 0),
                0,
                999
            ),
            preferredBuildingId: normalizeIdentifier(
                resident?.preferredBuildingId,
                null,
                64
            ),
            supportLabel: normalizeIdentifier(
                resident?.supportLabel,
                null,
                120
            )
        };
    }).filter(Boolean).slice(0, RESCUED_RESIDENT_IDS.length);
}

function buildPayloadFromLegacyCapsule(capsule = {}) {
    const companion = getCapsuleCompanion(capsule);
    const identity = capsule?.companionIdentity || {};
    const lineage = companion?.lineage || {};
    const visualIdentity = identity?.visualIdentity || {};
    const powers = identity?.powers || {};
    const sharedHistory = identity?.sharedHistory || {};
    const current = capsule?.discoveries?.currentEcology || {};
    const equipment = capsule?.equipment || {};
    const remain = capsule?.campaign?.remainAndDefend || {};
    const sanctuaryCommunity = capsule?.campaign?.sanctuaryCommunity || {};
    const legacyGuardianRoster = normalizeGuardianRoster(
        capsule?.campaign?.guardianResidents?.restoredGuardians
    );
    const regionalGuardians = normalizeRegionalGuardianRoster(
        sanctuaryCommunity?.regionalGuardians
    );
    const effectiveRegionalGuardians = regionalGuardians.length > 0
        ? regionalGuardians
        : legacyGuardianRoster.map(guardian => ({
            id: guardian.id,
            outcome: 'restored',
            standing: guardian.id === 'elder_treant'
                ? 'regional_ally'
                : 'regional_guardian',
            sanctuaryPresence: guardian.relationship === 'heart_linked'
                ? 'heart_projection'
                : 'none',
            regionRole: 'regional_guardian'
        }));
    const handoff = capsule?.handoff || {};
    const shipArchive = handoff?.shipArchive || {};
    const protectedReturn =
        shipArchive?.protectedReturnProtocol || {};
    const currentVeil = shipArchive?.currentVeil || {};
    const sensei = handoff?.sensei || {};
    const consent = handoff?.companionConsent || {};
    const earthMemory = handoff?.companionEarthMemory || {};
    const capabilities = handoff?.shipCapabilities || {};
    const portraitStages = normalizePortraitStages(
        visualIdentity?.stages
    );

    return {
        schemaVersion: HOMECOMING_HANDOFF_SCHEMA_VERSION,
        sagaId: capsule?.sagaId === 'mythical_void_saga'
            ? 'mythical_void_saga'
            : 'mythical_void_saga',
        sourceLegacySchemaVersion: clamp(
            Math.floor(Number(capsule?.schemaVersion) || 1),
            1,
            999
        ),
        sourceChapter: normalizeEnum(
            capsule?.sourceChapter,
            ['crashfall', 'remain_and_defend'],
            'crashfall'
        ),
        nextChapter: normalizeEnum(
            capsule?.nextChapter,
            ['remain_and_defend', 'secret_homecoming'],
            'remain_and_defend'
        ),
        intent: normalizeEnum(
            capsule?.intent,
            [
                'remain_and_defend',
                'prepare_homecoming',
                'prepare_first_contact'
            ],
            null
        ),
        recordedAt: normalizeTimestamp(capsule?.recordedAt),
        companion: {
            id: normalizeIdentifier(companion?.id, 'companion'),
            name: normalizeName(companion?.name),
            species: normalizeIdentifier(
                companion?.species,
                'unknown_species',
                64
            ),
            rarity: normalizeIdentifier(
                companion?.rarity,
                'common',
                32
            ),
            affinity: normalizeIdentifier(
                companion?.affinity,
                'unknown',
                32
            ),
            lifecycleStage: normalizeEnum(
                companion?.lifecycleStage,
                LIFECYCLE_STAGES,
                'baby'
            ),
            lineage: {
                schemaVersion: 2,
                origin: normalizeEnum(
                    lineage?.origin,
                    ['hatch', 'fusion', 'shared_fusion'],
                    'hatch'
                ),
                generation: clamp(
                    Math.floor(Number(lineage?.generation) || 1),
                    1,
                    999
                ),
                parentIds: normalizeIdentifierList(
                    lineage?.parentIds,
                    2
                ),
                protectedParentCount: clamp(
                    Math.floor(
                        Number(lineage?.protectedParentCount) || 0
                    ),
                    0,
                    2
                ),
                hasLinkedSibling:
                    lineage?.hasLinkedSibling === true,
                fusionOperationId: normalizeIdentifier(
                    lineage?.fusionOperationId,
                    null,
                    96
                )
            }
        },
        visualIdentity: {
            activeStage: normalizeEnum(
                visualIdentity?.activeStage,
                LIFECYCLE_STAGES,
                'baby'
            ),
            stages: portraitStages
        },
        relationship: {
            bondLevel: clamp(
                Math.floor(
                    Number(
                        identity?.bond?.level
                            ?? capsule?.relationship?.bondLevel
                    ) || 1
                ),
                1,
                20
            ),
            totalInteractions: clamp(
                Math.floor(
                    Number(
                        identity?.bond?.totalInteractions
                            ?? capsule?.relationship?.totalInteractions
                    ) || 0
                ),
                0,
                99999
            ),
            expeditionsCompleted: clamp(
                Math.floor(
                    Number(
                        identity?.bond?.expeditionsCompleted
                            ?? capsule?.relationship
                                ?.levelsCompletedTogether
                    ) || 0
                ),
                0,
                999
            )
        },
        powers: {
            profileSchemaVersion: clamp(
                Math.floor(Number(powers?.profileSchemaVersion) || 1),
                1,
                99
            ),
            affinity: normalizeIdentifier(
                powers?.affinity || companion?.affinity,
                'unknown',
                32
            ),
            magnitudeClass: normalizeEnum(
                powers?.magnitudeClass,
                ['extreme'],
                'extreme'
            ),
            currentControl: clamp(
                Math.round(Number(powers?.currentControl) || 20),
                20,
                100
            ),
            relationshipState: normalizeEnum(
                powers?.relationshipState,
                ['wary', 'observing', 'trusting', 'synchronized'],
                'wary'
            ),
            universalSenseId: normalizeIdentifier(
                powers?.universalSenseId,
                null,
                96
            ),
            affinityPowerId: normalizeIdentifier(
                powers?.affinityPowerId,
                null,
                96
            ),
            protectiveResponseId: normalizeIdentifier(
                powers?.protectiveResponseId,
                null,
                96
            ),
            partnershipMoveId: normalizeIdentifier(
                powers?.partnershipMoveId,
                null,
                96
            ),
            partnershipMoveUnlocked:
                powers?.partnershipMoveUnlocked === true,
            highPowerRevealId: normalizeIdentifier(
                powers?.highPowerRevealId,
                null,
                96
            ),
            highPowerRevealUnlocked:
                powers?.highPowerRevealUnlocked === true
        },
        current: {
            awareness: normalizeEnum(
                current?.awareness,
                ['unmapped', 'listening', 'network_confirmed'],
                'unmapped'
            ),
            networkStatus: normalizeEnum(
                current?.networkStatus,
                ['strained', 'recovering', 'stabilizing', 'aligned'],
                'strained'
            ),
            networkVitality: clamp(
                Math.round(Number(current?.networkVitality) || 0),
                0,
                100
            ),
            careActions: clamp(
                Math.floor(Number(current?.careActions) || 0),
                0,
                999
            ),
            extractionActions: clamp(
                Math.floor(Number(current?.extractionActions) || 0),
                0,
                999
            ),
            restoredRegions: normalizeKnownList(
                current?.restoredRegions,
                REGION_IDS
            ),
            extractionTraceRegions: normalizeKnownList(
                current?.extractionTraceRegions,
                REGION_IDS
            )
        },
        equipment: {
            fieldKitRecovered:
                equipment?.fieldKitRecovered === true,
            katanaId: normalizeIdentifier(
                equipment?.katanaId,
                'earth_field_katana',
                64
            ),
            katanaUpgrades: normalizeIdentifierList(
                equipment?.katanaUpgrades,
                8,
                64
            ),
            recoveredShipSystems: normalizeIdentifierList(
                equipment?.recoveredShipSystems,
                16,
                64
            )
        },
        recovery: {
            status: normalizeEnum(
                remain?.status,
                ['locked', 'active', 'complete'],
                'locked'
            ),
            completedPhases: normalizeKnownList(
                remain?.completedPhases,
                REMAIN_PHASE_IDS
            ),
            priority: normalizeEnum(
                remain?.priority,
                [
                    'remain_and_defend',
                    'prepare_homecoming',
                    'prepare_first_contact'
                ],
                null
            ),
            completedAt: normalizeTimestamp(remain?.completedAt),
            transmissionStatus: 'not_sent'
        },
        allies: {
            rescuedResidents: normalizeRescuedResidentRoster(
                sanctuaryCommunity?.rescuedResidents
            ),
            regionalGuardians: effectiveRegionalGuardians,
            heartPresenceIds: normalizeKnownList(
                sanctuaryCommunity?.heartPresenceIds,
                GUARDIAN_RESIDENT_IDS,
                2
            ).filter(id => effectiveRegionalGuardians.some(guardian => (
                guardian.id === id &&
                guardian.sanctuaryPresence !== 'none'
            ))),
            // Deprecated alias retained for handoffs created before the
            // Sanctuary community model was introduced.
            restoredGuardians: legacyGuardianRoster.length > 0
                ? legacyGuardianRoster
                : effectiveRegionalGuardians.map(guardian => ({
                    id: guardian.id,
                    relationship: guardian.sanctuaryPresence !== 'none'
                        ? 'heart_linked'
                        : 'regional_ally',
                    interactions: 0,
                    teamAbilityId: 'unknown',
                    teamAbilityName: null,
                    abilityUnlocked: false,
                    activeTeam: false
                }))
        },
        ship: {
            stealthDescent: normalizeEnum(
                capabilities?.stealthDescent,
                ['damaged', 'repaired'],
                'damaged'
            ),
            secureReturnVector: normalizeEnum(
                capabilities?.secureReturnVector,
                ['unavailable', 'sealed'],
                'unavailable'
            ),
            manualLanding: normalizeEnum(
                capabilities?.manualLanding,
                ['unavailable', 'available'],
                'unavailable'
            ),
            blackBoxProof: normalizeEnum(
                capabilities?.blackBoxProof,
                ['missing', 'recovered'],
                'missing'
            ),
            passengerCapacity: clamp(
                Math.floor(Number(capabilities?.passengerCapacity) || 0),
                0,
                1
            ),
            creatureLifeSupport: normalizeEnum(
                capabilities?.creatureLifeSupport,
                ['not_assessed', 'prototype_required', 'ready'],
                'not_assessed'
            ),
            longRangeUplink: normalizeEnum(
                capabilities?.longRangeUplink,
                ['offline', 'held_exposure_risk'],
                'offline'
            ),
            archiveReviewComplete:
                shipArchive?.reviewComplete === true,
            protectedReturnComplete:
                protectedReturn?.complete === true,
            currentVeilComplete:
                currentVeil?.complete === true,
            transmissionStatus: 'not_sent'
        },
        sensei: {
            relationship:
                'pre_mission_friend_and_training_partner',
            memoriesRecalled: normalizeKnownList(
                sensei?.memoriesRecalled,
                SENSEI_MEMORY_IDS
            ),
            rememberedLessonStatus: normalizeEnum(
                sensei?.rememberedLesson?.status,
                ['locked', 'available', 'practiced'],
                'locked'
            ),
            encryptedChannelId:
                sensei?.encryptedContact?.channelId === 'DOJO-23-77'
                    ? 'DOJO-23-77'
                    : null,
            contactStatus: normalizeEnum(
                sensei?.encryptedContact?.status,
                ['route_recovered'],
                null
            ),
            contactAttempted:
                sensei?.encryptedContact?.contactAttempted === true,
            contactEstablished: false
        },
        companionBoundary: {
            companionId: normalizeIdentifier(
                consent?.companionId,
                normalizeIdentifier(companion?.id, 'companion')
            ),
            travelStatus: normalizeEnum(
                consent?.travelStatus,
                [
                    'not_yet_asked',
                    'decision_deferred',
                    'willing',
                    'declined'
                ],
                'not_yet_asked'
            ),
            disclosureStatus: normalizeEnum(
                consent?.disclosureStatus,
                [
                    'withheld',
                    'astronaut_survival_only',
                    'bounded_evidence_approved'
                ],
                'withheld'
            ),
            locationBoundary:
                consent?.locationBoundary === 'coordinates_withheld'
                    ? 'coordinates_withheld'
                    : 'not_discussed',
            informedRisks: consent?.informedRisks === true,
            willingPassenger:
                typeof consent?.willingPassenger === 'boolean'
                    ? consent.willingPassenger
                    : null,
            vetoRecognized: consent?.vetoRecognized !== false,
            powerBoundary:
                consent?.powerBoundary === 'emergency_life_first'
                    ? 'emergency_life_first'
                    : 'not_discussed',
            reviewedTopics: normalizeKnownList(
                consent?.reviewedTopics,
                CONSENT_TOPIC_IDS
            )
        },
        earthMemory: {
            companionId: normalizeIdentifier(
                earthMemory?.companionId,
                normalizeIdentifier(companion?.id, 'companion')
            ),
            status:
                earthMemory?.status === 'shared' &&
                EARTH_MEMORY_IDS.includes(earthMemory?.memoryId)
                    ? 'shared'
                    : 'not_shared',
            memoryId: earthMemory?.status === 'shared'
                ? normalizeEnum(
                    earthMemory?.memoryId,
                    EARTH_MEMORY_IDS,
                    null
                )
                : null,
            invitationStatus: 'not_offered',
            travelConsentRecorded: false,
            transmissionStatus: 'not_sent',
            sharedAt: normalizeTimestamp(earthMemory?.sharedAt)
        },
        fusionBoundary: {
            contractVersion: clamp(
                Math.floor(
                    Number(capsule?.fusionBoundary?.contractVersion) || 1
                ),
                1,
                99
            ),
            consentProtocol: 'explicit_local_sanctuary',
            sharedRequirement: 'protected_invitation',
            ownershipTransfer: false,
            completedLineages: clamp(
                Math.floor(
                    Number(
                        capsule?.fusionBoundary?.completedLineages
                    ) || 0
                ),
                0,
                50
            )
        },
        sharedHistory: {
            senseiMemoryIds: normalizeKnownList(
                sharedHistory?.senseiMemoryIds,
                SENSEI_MEMORY_IDS
            ),
            shipSectionIds: normalizeKnownList(
                sharedHistory?.shipSectionIds,
                ['systems', 'evidence', 'boundaries']
            ),
            firstListeningPriority: normalizeIdentifier(
                sharedHistory?.firstListeningPriority,
                null,
                48
            )
        },
        privacy: {
            playerAuthoredFields: ['companion.name'],
            excludes: [...PRIVACY_EXCLUDES],
            temporaryImageUrlsIncluded: false,
            remoteIdentityIncluded: false
        }
    };
}

function normalizePayload(payload = {}) {
    return buildPayloadFromLegacyCapsule({
        schemaVersion: payload?.sourceLegacySchemaVersion,
        sagaId: payload?.sagaId,
        sourceChapter: payload?.sourceChapter,
        nextChapter: payload?.nextChapter,
        intent: payload?.intent,
        recordedAt: payload?.recordedAt,
        companionIdentity: {
            creature: payload?.companion,
            visualIdentity: payload?.visualIdentity,
            bond: payload?.relationship,
            powers: payload?.powers,
            sharedHistory: payload?.sharedHistory
        },
        discoveries: {
            currentEcology: payload?.current
        },
        equipment: payload?.equipment,
        campaign: {
            remainAndDefend: payload?.recovery,
            sanctuaryCommunity: {
                rescuedResidents: payload?.allies?.rescuedResidents,
                regionalGuardians: payload?.allies?.regionalGuardians,
                heartPresenceIds: payload?.allies?.heartPresenceIds
            },
            guardianResidents: {
                restoredGuardians:
                    payload?.allies?.restoredGuardians?.map(
                        guardian => ({
                            id: guardian.id,
                            relationship: guardian.relationship,
                            interactions: guardian.interactions,
                            teamAbility: guardian.teamAbilityId,
                            teamAbilityName: guardian.teamAbilityName,
                            abilityUnlocked: guardian.abilityUnlocked,
                            activeTeam: guardian.activeTeam
                        })
                    ) || []
            }
        },
        handoff: {
            shipCapabilities: payload?.ship,
            shipArchive: {
                reviewComplete:
                    payload?.ship?.archiveReviewComplete,
                protectedReturnProtocol: {
                    complete:
                        payload?.ship?.protectedReturnComplete
                },
                currentVeil: {
                    complete: payload?.ship?.currentVeilComplete
                }
            },
            sensei: {
                memoriesRecalled:
                    payload?.sensei?.memoriesRecalled,
                rememberedLesson: {
                    status:
                        payload?.sensei
                            ?.rememberedLessonStatus
                },
                encryptedContact: {
                    channelId:
                        payload?.sensei?.encryptedChannelId,
                    status: payload?.sensei?.contactStatus,
                    contactAttempted:
                        payload?.sensei?.contactAttempted
                }
            },
            companionConsent: {
                ...payload?.companionBoundary,
                reviewedTopics:
                    payload?.companionBoundary?.reviewedTopics
            },
            companionEarthMemory: {
                ...payload?.earthMemory
            }
        },
        fusionBoundary: payload?.fusionBoundary
    });
}

export function getHomecomingReadiness(payload = {}) {
    const normalized = normalizePayload(payload);
    const requirements = [
        {
            id: 'companion_continuity',
            label: 'COMPANION CONTINUITY',
            complete:
                normalized.companion.id !== 'companion' &&
                normalized.companion.species !== 'unknown_species' &&
                normalized.powers.affinityPowerId !== null,
            readyDetail:
                `${normalized.companion.name}'s identity, lineage, bond, and powers are portable.`,
            pendingDetail:
                'Complete the companion identity record and witness their core power.'
        },
        {
            id: 'living_world_record',
            label: 'LIVING WORLD RECORD',
            complete:
                normalized.current.awareness === 'network_confirmed' &&
                normalized.current.restoredRegions.length ===
                    REGION_IDS.length,
            readyDetail:
                'All six living regions and their Current history are preserved.',
            pendingDetail:
                `Restore and record all six regions (${normalized.current.restoredRegions.length}/${REGION_IDS.length}).`
        },
        {
            id: 'earth_equipment',
            label: 'EARTH EQUIPMENT',
            complete:
                normalized.equipment.fieldKitRecovered &&
                normalized.equipment.katanaId ===
                    'earth_field_katana' &&
                normalized.equipment.recoveredShipSystems.length >= 5,
            readyDetail:
                'The Earth-forged katana and five recovered ship systems are recorded.',
            pendingDetail:
                `Recover the field kit and all ship systems (${normalized.equipment.recoveredShipSystems.length}/5).`
        },
        {
            id: 'remain_and_defend',
            label: 'REMAIN AND DEFEND',
            complete:
                normalized.recovery.status === 'complete' &&
                normalized.recovery.completedPhases.length ===
                    REMAIN_PHASE_IDS.length &&
                normalized.nextChapter === 'secret_homecoming',
            readyDetail:
                'The Fend recovery chapter is complete before any Earth return.',
            pendingDetail:
                `Complete the recovery chapter (${normalized.recovery.completedPhases.length}/${REMAIN_PHASE_IDS.length}).`
        },
        {
            id: 'protected_return',
            label: 'PROTECTED RETURN',
            complete:
                normalized.ship.archiveReviewComplete &&
                normalized.ship.protectedReturnComplete &&
                normalized.ship.currentVeilComplete &&
                normalized.ship.stealthDescent === 'repaired' &&
                normalized.ship.secureReturnVector === 'sealed' &&
                normalized.ship.manualLanding === 'available' &&
                normalized.ship.blackBoxProof === 'recovered' &&
                normalized.ship.longRangeUplink ===
                    'held_exposure_risk',
            readyDetail:
                'Survival proof can travel while the Fend route stays concealed.',
            pendingDetail:
                normalized.ship.stealthDescent !== 'repaired'
                    ? 'Repair concealed descent before a secret Earth landing can be safe.'
                    : 'Complete the ship archive, return safeguards, and Current Veil.'
        },
        {
            id: 'consent_and_contact',
            label: 'CONSENT & SENSEI SEED',
            complete:
                normalized.companionBoundary.locationBoundary ===
                    'coordinates_withheld' &&
                normalized.companionBoundary.informedRisks &&
                normalized.companionBoundary.vetoRecognized &&
                normalized.companionBoundary.powerBoundary ===
                    'emergency_life_first' &&
                normalized.sensei.memoriesRecalled.length ===
                    SENSEI_MEMORY_IDS.length &&
                normalized.sensei.encryptedChannelId ===
                    'DOJO-23-77' &&
                normalized.sensei.contactStatus ===
                    'route_recovered' &&
                !normalized.sensei.contactEstablished,
            readyDetail:
                'The companion keeps veto power and the unused Sensei route is recoverable.',
            pendingDetail:
                'Finish companion boundaries and recover all three Sensei memories.'
        }
    ].map(requirement => ({
        id: requirement.id,
        label: requirement.label,
        complete: requirement.complete,
        status: requirement.complete ? 'verified' : 'pending',
        detail: requirement.complete
            ? requirement.readyDetail
            : requirement.pendingDetail
    }));
    const completedCount = requirements.filter(
        requirement => requirement.complete
    ).length;

    return {
        status: completedCount === requirements.length
            ? 'ready'
            : completedCount > 0
                ? 'in_progress'
                : 'not_ready',
        readyForHomecoming:
            completedCount === requirements.length,
        completedCount,
        totalRequirements: requirements.length,
        requirements,
        nextRequirement: requirements.find(
            requirement => !requirement.complete
        ) || null
    };
}

function createPackageFromPayload(payload, {
    exportedAt,
    migratedFrom = null
}) {
    const normalizedPayload = normalizePayload(payload);
    const normalizedExportedAt =
        normalizeTimestamp(exportedAt)
        || normalizedPayload.recordedAt
        || new Date().toISOString();
    const payloadChecksum = checksum(normalizedPayload);
    return {
        schemaVersion: HOMECOMING_HANDOFF_SCHEMA_VERSION,
        format: HOMECOMING_HANDOFF_FORMAT,
        sourceGame: 'mythical_void',
        targetChapter: 'secret_homecoming',
        exportedAt: normalizedExportedAt,
        transferId: `homecoming:${checksum({
            companionId: normalizedPayload.companion.id,
            exportedAt: normalizedExportedAt,
            payloadChecksum
        }).split(':')[1]}`,
        migratedFrom,
        payload: normalizedPayload,
        integrity: {
            algorithm: 'fnv1a32-utf16',
            checksum: payloadChecksum,
            scope: 'payload',
            authority: 'unsigned_local',
            purpose: 'accidental_corruption_detection'
        }
    };
}

export function createHomecomingHandoffPackageFromCapsule(
    capsule,
    { exportedAt = null, migratedFrom = null } = {}
) {
    return createPackageFromPayload(
        buildPayloadFromLegacyCapsule(capsule),
        {
            exportedAt:
                exportedAt || capsule?.recordedAt || null,
            migratedFrom
        }
    );
}

export function createHomecomingHandoffPackage(gameState, {
    exportedAt = new Date().toISOString()
} = {}) {
    const storedRecordedAt = normalizeTimestamp(
        gameState?.get?.(
            'story.projectBeacon.legacyCapsule.recordedAt'
        )
    );
    const capsule = buildCampaignLegacyCapsule(gameState, {
        intent: gameState?.get?.(
            'story.projectBeacon.finale.priority'
        ),
        recordedAt: storedRecordedAt || exportedAt
    });
    return createHomecomingHandoffPackageFromCapsule(
        capsule,
        { exportedAt }
    );
}

export function validateHomecomingHandoffPackage(input) {
    let source = input;
    const errors = [];
    const warnings = [];
    let migrated = false;

    if (typeof input === 'string') {
        if (input.length > HOMECOMING_HANDOFF_MAX_BYTES) {
            return {
                valid: false,
                safeForLocalImport: false,
                trustedForServerCommit: false,
                migrated: false,
                errors: ['package_too_large'],
                warnings: [],
                package: null,
                readiness: null
            };
        }
        try {
            source = JSON.parse(input);
        } catch (error) {
            return {
                valid: false,
                safeForLocalImport: false,
                trustedForServerCommit: false,
                migrated: false,
                errors: ['invalid_json'],
                warnings: [],
                package: null,
                readiness: null
            };
        }
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        errors.push('invalid_package');
    }
    if (errors.length === 0) {
        try {
            if (
                JSON.stringify(source).length >
                HOMECOMING_HANDOFF_MAX_BYTES
            ) {
                errors.push('package_too_large');
            }
        } catch (error) {
            errors.push('invalid_package');
        }
    }

    if (
        errors.length === 0 &&
        source?.sagaId === 'mythical_void_saga' &&
        source?.format !== HOMECOMING_HANDOFF_FORMAT
    ) {
        source = createHomecomingHandoffPackageFromCapsule(
            source,
            {
                exportedAt: source.recordedAt,
                migratedFrom:
                    `campaign_legacy_v${Math.max(
                        1,
                        Number(source.schemaVersion) || 1
                    )}`
            }
        );
        migrated = true;
        warnings.push('legacy_capsule_wrapped');
    }

    if (errors.length === 0) {
        if (source?.format !== HOMECOMING_HANDOFF_FORMAT) {
            errors.push('unsupported_format');
        }
        if (
            Number(source?.schemaVersion) !==
            HOMECOMING_HANDOFF_SCHEMA_VERSION
        ) {
            errors.push('unsupported_schema_version');
        }
        if (source?.sourceGame !== 'mythical_void') {
            errors.push('unexpected_source_game');
        }
        if (source?.targetChapter !== 'secret_homecoming') {
            errors.push('unexpected_target_chapter');
        }
        if (!source?.payload || typeof source.payload !== 'object') {
            errors.push('payload_missing');
        }
        if (
            source?.payload?.sagaId !== 'mythical_void_saga'
        ) {
            errors.push('unexpected_saga');
        }
        if (
            source?.integrity?.algorithm !==
            'fnv1a32-utf16' ||
            source?.integrity?.scope !== 'payload' ||
            source?.integrity?.checksum !==
                checksum(source?.payload)
        ) {
            errors.push('checksum_mismatch');
        }
        if (
            !source?.payload?.companion?.id ||
            source.payload.companion.id === 'companion'
        ) {
            errors.push('companion_identity_missing');
        }
        if (
            source?.payload?.ship?.transmissionStatus !==
                'not_sent' ||
            source?.payload?.recovery?.transmissionStatus !==
                'not_sent' ||
            source?.payload?.sensei?.contactEstablished === true
        ) {
            errors.push('chronology_boundary_violated');
        }
    }

    if (errors.length > 0) {
        return {
            valid: false,
            safeForLocalImport: false,
            trustedForServerCommit: false,
            migrated,
            errors: Array.from(new Set(errors)),
            warnings,
            package: null,
            readiness: null
        };
    }

    const normalizedPackage = createPackageFromPayload(
        source.payload,
        {
            exportedAt: source.exportedAt,
            migratedFrom: source.migratedFrom || null
        }
    );
    const readiness = getHomecomingReadiness(
        normalizedPackage.payload
    );
    if (!readiness.readyForHomecoming) {
        warnings.push('homecoming_requirements_incomplete');
    }
    warnings.push('server_signature_required_for_cloud_commit');

    return {
        valid: true,
        safeForLocalImport: true,
        trustedForServerCommit: false,
        migrated,
        errors: [],
        warnings: Array.from(new Set(warnings)),
        package: normalizedPackage,
        readiness
    };
}

export function getHomecomingHandoffSnapshot(gameState) {
    const handoffPackage = createHomecomingHandoffPackage(
        gameState
    );
    const validation = validateHomecomingHandoffPackage(
        handoffPackage
    );
    const readiness = validation.readiness ||
        getHomecomingReadiness(handoffPackage.payload);

    return {
        schemaVersion: HOMECOMING_HANDOFF_SCHEMA_VERSION,
        available:
            handoffPackage.payload.ship.archiveReviewComplete,
        valid: validation.valid,
        safeForLocalImport: validation.safeForLocalImport,
        trustedForServerCommit: false,
        package: validation.package,
        validation,
        ...readiness,
        rows: readiness.requirements.map(requirement => ({
            id: requirement.id,
            label: requirement.label,
            status: requirement.complete ? 'VERIFIED' : 'PENDING',
            tone: requirement.complete ? 'protected' : 'pending',
            detail: requirement.detail
        }))
    };
}

if (typeof window !== 'undefined') {
    window.HomecomingHandoff = {
        HOMECOMING_HANDOFF_SCHEMA_VERSION,
        HOMECOMING_HANDOFF_FORMAT,
        createHomecomingHandoffPackage,
        createHomecomingHandoffPackageFromCapsule,
        validateHomecomingHandoffPackage,
        getHomecomingReadiness,
        getHomecomingHandoffSnapshot
    };
}
