import { buildCreaturePowerProfile } from './CreaturePowerProfile.js';

export const COMPANION_IDENTITY_ARCHIVE_SCHEMA_VERSION = 1;
export const PORTABLE_COMPANION_RECORD_SCHEMA_VERSION = 2;

export const COMPANION_IDENTITY_CHAPTERS = Object.freeze([
    Object.freeze({
        id: 'identity',
        order: 1,
        label: 'IDENTITY',
        title: 'WHO ARRIVED',
        summary: 'A stable identity that remains the same across scenes, devices, and future chapters.'
    }),
    Object.freeze({
        id: 'living_form',
        order: 2,
        label: 'LIVING FORM',
        title: 'HOW THE FEND SEES THEM',
        summary: 'Pixel form, living portrait provenance, and every recorded life stage belong to one companion.'
    }),
    Object.freeze({
        id: 'shared_journey',
        order: 3,
        label: 'JOURNEY',
        title: 'WHAT YOU HAVE SURVIVED TOGETHER',
        summary: 'Trust is recorded through care, expeditions, rescue, restraint, and witnessed power.'
    }),
    Object.freeze({
        id: 'inheritance',
        order: 4,
        label: 'INHERITANCE',
        title: 'WHAT CONTINUES',
        summary: 'Lineage, creature-tech adaptations, and protected discoveries can survive this save file.'
    })
]);

export const AUTHORED_COMPANION_STUDIES = Object.freeze({
    stellarWyrm: '/marketing/zephyr.webp',
    crystalDrake: '/marketing/pebble.webp',
    nebulaSprite: '/marketing/nova.webp',
    voidStalker: '/marketing/wisp.webp',
    cosmicGuardian: '/marketing/luna.webp',
    auroraPhoenix: '/marketing/bloom.webp',
    crystalElemental: '/marketing/pebble.webp'
});

const CHAPTER_BY_ID = new Map(
    COMPANION_IDENTITY_CHAPTERS.map(chapter => [chapter.id, chapter])
);
const ALLOWED_STAGES = new Set(['baby', 'juvenile', 'adult', 'elder']);
const MAX_HISTORY = 24;
const MAX_FIELD_MEMORIES = 12;

const FIELD_MEMORY_LABELS = Object.freeze({
    first_living_form: 'FIRST LIVING FORM',
    beacon_reflection: 'BEACON REFLECTION'
});

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function normalizeIdentifier(value, fallback = null, maxLength = 128) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
}

function normalizeKnownList(value, allowed, maxItems = allowed.length) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value.filter(item => allowed.includes(item))
    )).slice(0, maxItems);
}

function getCreatureId(gameState) {
    return normalizeIdentifier(
        getValue(gameState, 'creature.id', null)
            || getValue(gameState, 'creature.genes.id', null)
            || getValue(gameState, 'creature.dna.id', null),
        'active_companion'
    );
}

function getAffinity(gameState) {
    const affinity = getValue(
        gameState,
        'creature.genes.cosmicAffinity',
        null
    );
    return normalizeIdentifier(
        typeof affinity === 'string' ? affinity : affinity?.element,
        'star',
        32
    );
}

function normalizeArchiveHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(entry => {
        const chapterId = CHAPTER_BY_ID.has(entry?.chapterId)
            ? entry.chapterId
            : null;
        const operationId = normalizeIdentifier(entry?.operationId, null, 96);
        if (!chapterId || !operationId || seen.has(operationId)) {
            return null;
        }
        seen.add(operationId);
        return {
            operationId,
            type: 'chapter_reviewed',
            chapterId,
            creatureId: normalizeIdentifier(
                entry?.creatureId,
                'active_companion'
            ),
            occurredAt: normalizeTimestamp(entry?.occurredAt)
        };
    }).filter(Boolean).slice(-MAX_HISTORY);
}

export function createInitialCompanionIdentityArchiveState(
    creatureId = 'active_companion'
) {
    return {
        schemaVersion: COMPANION_IDENTITY_ARCHIVE_SCHEMA_VERSION,
        creatureId: normalizeIdentifier(creatureId, 'active_companion'),
        reviewedChapterIds: [],
        firstReviewedAt: null,
        completedAt: null,
        history: []
    };
}

export function normalizeCompanionIdentityArchiveState(
    state = {},
    creatureId = 'active_companion'
) {
    const history = normalizeArchiveHistory(state?.history);
    const reviewed = new Set(
        normalizeKnownList(
            state?.reviewedChapterIds,
            COMPANION_IDENTITY_CHAPTERS.map(chapter => chapter.id)
        )
    );
    history.forEach(entry => reviewed.add(entry.chapterId));
    const reviewedChapterIds = [];
    for (const chapter of COMPANION_IDENTITY_CHAPTERS) {
        if (!reviewed.has(chapter.id)) break;
        reviewedChapterIds.push(chapter.id);
    }
    const complete =
        reviewedChapterIds.length === COMPANION_IDENTITY_CHAPTERS.length;

    return {
        schemaVersion: COMPANION_IDENTITY_ARCHIVE_SCHEMA_VERSION,
        creatureId: normalizeIdentifier(creatureId, 'active_companion'),
        reviewedChapterIds,
        firstReviewedAt:
            normalizeTimestamp(state?.firstReviewedAt)
            || history[0]?.occurredAt
            || null,
        completedAt: complete
            ? (
                normalizeTimestamp(state?.completedAt)
                || history.find(
                    entry => entry.chapterId === 'inheritance'
                )?.occurredAt
                || null
            )
            : null,
        history
    };
}

function getPortraitRecord(gameState) {
    const portraits = getValue(gameState, 'creature.portraits', {});
    const lifecycleStage = getValue(
        gameState,
        'creature.lifecycle.stage',
        'baby'
    );
    const preferredStage = ALLOWED_STAGES.has(portraits?.activeStage)
        ? portraits.activeStage
        : ALLOWED_STAGES.has(lifecycleStage)
            ? lifecycleStage
            : 'baby';
    const byStage = portraits?.byStage && typeof portraits.byStage === 'object'
        ? portraits.byStage
        : {};
    const stages = Object.keys(byStage)
        .filter(stage => ALLOWED_STAGES.has(stage))
        .map(stage => {
            const record = byStage[stage];
            if (!record || record.status !== 'ready') return null;
            return {
                stage,
                identityKey: normalizeText(
                    record.identityKey,
                    null,
                    180
                ),
                style: normalizeIdentifier(record.style, 'cinematic', 32),
                provider: normalizeIdentifier(record.provider, 'unknown', 48),
                model: normalizeText(record.model, 'unknown', 80),
                promptVersion: normalizeIdentifier(
                    record.promptVersion,
                    'unknown',
                    48
                ),
                assetRef: record.storage === 'supabase-private'
                    ? normalizeText(record.assetRef, null, 64)
                    : null,
                storage: record.storage === 'supabase-private'
                    ? 'supabase-private'
                    : 'provider-temporary',
                generatedAt: Number.isFinite(Number(record.generatedAt))
                    ? Number(record.generatedAt)
                    : null
            };
        })
        .filter(Boolean)
        .sort((left, right) => (
            [...ALLOWED_STAGES].indexOf(left.stage)
            - [...ALLOWED_STAGES].indexOf(right.stage)
        ));
    const activeRecord = byStage[preferredStage];
    const assetRef = (
        activeRecord?.status === 'ready'
        && activeRecord?.storage === 'supabase-private'
        && typeof activeRecord.assetRef === 'string'
    )
        ? activeRecord.assetRef
        : null;
    const imageUrl = (
        activeRecord?.status === 'ready'
        && typeof activeRecord.imageUrl === 'string'
    )
        ? activeRecord.imageUrl
        : null;
    return {
        preferredStage,
        stages,
        imageUrl,
        assetRef,
        identityKey: normalizeText(activeRecord?.identityKey, null, 180),
        source: imageUrl ? 'living_portrait' : assetRef
            ? 'living_portrait_pending'
            : 'pixel_form',
        portable: {
            activeStage: preferredStage,
            stages
        }
    };
}

function getLineage(gameState, creatureId) {
    const lineage = getValue(gameState, 'creature.lineage', {});
    const parentIds = Array.isArray(lineage?.parentIds)
        ? lineage.parentIds
        : getValue(gameState, 'creature.parentIds', []);
    const normalizedParentIds = Array.from(new Set(
        (Array.isArray(parentIds) ? parentIds : [])
            .map(id => normalizeIdentifier(id))
            .filter(Boolean)
    )).slice(0, 2);
    const protectedParentCount = normalizedParentIds.filter(id => (
        id.startsWith('protected-parent-v1:')
    )).length;
    const origin = lineage?.origin === 'shared_fusion'
        ? 'shared_fusion'
        : lineage?.origin === 'fusion'
            ? 'fusion'
            : 'hatch';
    return {
        schemaVersion: 2,
        creatureId,
        origin,
        generation: Math.max(
            1,
            Math.min(
                999,
                Math.floor(
                    Number(
                        lineage?.generation
                            || getValue(gameState, 'creature.generation', 1)
                    ) || 1
                )
            )
        ),
        parentIds: normalizedParentIds.filter(id => (
            !id.startsWith('protected-parent-v1:')
        )),
        parentRecordCount: normalizedParentIds.length,
        protectedParentCount,
        hasLinkedSibling: Boolean(
            origin === 'shared_fusion' &&
            (
                lineage?.linkedSiblingId ||
                getValue(gameState, 'creature.linkedSiblingId', null)
            )
        ),
        fusionOperationId: normalizeIdentifier(
            lineage?.fusionOperationId,
            null,
            96
        ),
        createdAt: normalizeTimestamp(
            lineage?.createdAt
                || getValue(gameState, 'creature.hatchTime', null)
        )
    };
}

function getKatanaWitness(gameState, creatureId) {
    const katana = getValue(
        gameState,
        'story.projectBeacon.fieldKit.katana',
        {}
    );
    const upgrades = Array.isArray(katana?.installedUpgrades)
        ? katana.installedUpgrades
        : [];
    return {
        katanaId: normalizeIdentifier(
            katana?.id,
            'earth_field_katana',
            64
        ),
        configuration: normalizeIdentifier(
            katana?.configuration,
            'secured_in_case',
            48
        ),
        witnessedUpgradeIds: Array.from(new Set(
            upgrades.filter(upgrade => {
                const witnessId = normalizeIdentifier(
                    upgrade?.witnessCompanionId
                );
                return !witnessId || witnessId === creatureId;
            }).map(upgrade => normalizeIdentifier(
                typeof upgrade === 'string' ? upgrade : upgrade?.id
            )).filter(Boolean)
        )).slice(0, 8)
    };
}

function getSenseiWitnessedMemoryIds(gameState, creatureId) {
    const history = getValue(
        gameState,
        'story.projectBeacon.sensei.memoryLedger.history',
        []
    );
    if (!Array.isArray(history)) return [];
    return Array.from(new Set(
        history.filter(entry => (
            entry?.type === 'memory_recalled'
            && normalizeIdentifier(entry?.companionId) === creatureId
        )).map(entry => normalizeIdentifier(entry?.memoryId))
            .filter(Boolean)
    )).slice(0, 3);
}

function getShipWitnessedSections(gameState, creatureId) {
    const history = getValue(
        gameState,
        'story.projectBeacon.shipArchive.history',
        []
    );
    if (!Array.isArray(history)) return [];
    return Array.from(new Set(
        history.filter(entry => (
            entry?.type === 'section_reviewed'
            && normalizeIdentifier(entry?.companionId) === creatureId
        )).map(entry => (
            CHAPTER_BY_ID.has(entry?.sectionId)
                ? null
                : normalizeIdentifier(entry?.sectionId)
        )).filter(id => ['systems', 'evidence', 'boundaries'].includes(id))
    )).slice(0, 3);
}

function normalizePowerEvents(gameState) {
    const history = getValue(gameState, 'creature.powerHistory', []);
    if (!Array.isArray(history)) return [];
    return history.map(event => ({
        eventId: normalizeIdentifier(event?.eventId, 'unknown', 96),
        powerId: normalizeIdentifier(event?.powerId, 'unknown', 96),
        context: event?.context === 'earth' ? 'earth' : 'fend',
        magnitude: ['controlled', 'major', 'extreme'].includes(
            event?.magnitude
        ) ? event.magnitude : 'controlled',
        outcome: normalizeIdentifier(event?.outcome, 'completed', 48),
        occurredAt: normalizeTimestamp(event?.occurredAt)
    })).slice(-12);
}

function getAgencyCounts(gameState) {
    const history = getValue(gameState, 'creature.agencyHistory', []);
    const entries = Array.isArray(history) ? history : [];
    return {
        autonomousRescues: entries.filter(
            entry => entry?.type === 'autonomous_rescue'
        ).length,
        highPowerRescues: entries.filter(
            entry => entry?.type === 'high_power_rescue'
        ).length
    };
}

function formatFieldMemoryLabel(momentId) {
    if (FIELD_MEMORY_LABELS[momentId]) {
        return FIELD_MEMORY_LABELS[momentId];
    }
    const guardianMoment = [
        ['guardian_rescue_', 'RESCUE'],
        ['guardian_trust_', 'TRUST'],
        ['guardian_debrief_', 'DEBRIEF']
    ].find(([prefix]) => momentId.startsWith(prefix));
    if (!guardianMoment) return null;
    const [prefix, eventLabel] = guardianMoment;
    const guardianLabel = momentId.slice(prefix.length)
        .replace(/_/g, ' ')
        .trim()
        .toUpperCase();
    return guardianLabel
        ? `${guardianLabel} ${eventLabel}`
        : null;
}

export function getCompanionFieldMemories(gameState, creatureId) {
    const stored = getValue(gameState, 'story.companionMedia', {});
    const appearances = stored?.appearances &&
        typeof stored.appearances === 'object'
        ? Object.values(stored.appearances)
        : [];
    const normalizedCreatureId = normalizeIdentifier(
        creatureId,
        getCreatureId(gameState)
    );
    const memories = appearances.map(appearance => {
        const momentId = normalizeIdentifier(
            appearance?.momentId,
            null,
            64
        );
        const identityKey = normalizeText(
            appearance?.identityKey,
            null,
            180
        );
        const label = momentId
            ? formatFieldMemoryLabel(momentId)
            : null;
        const belongsToCompanion = identityKey
            ?.split(':')
            .includes(normalizedCreatureId);
        if (!momentId || !identityKey || !label || !belongsToCompanion) {
            return null;
        }
        return {
            momentId,
            label,
            stage: ALLOWED_STAGES.has(appearance?.stage)
                ? appearance.stage
                : 'baby',
            renderMode: appearance?.renderMode === 'generated_video'
                ? 'generated_video'
                : 'motion_still',
            viewCount: Math.max(
                1,
                Math.min(999, Math.floor(Number(appearance?.viewCount) || 1))
            ),
            lastViewedAt: Number.isFinite(Number(appearance?.lastViewedAt))
                ? Number(appearance.lastViewedAt)
                : null
        };
    }).filter(Boolean).sort((left, right) => (
        (right.lastViewedAt || 0) - (left.lastViewedAt || 0)
    )).slice(0, MAX_FIELD_MEMORIES);

    return {
        count: memories.length,
        totalViews: memories.reduce(
            (total, memory) => total + memory.viewCount,
            0
        ),
        memories
    };
}

export function buildPortableCompanionRecord(gameState) {
    const creatureId = getCreatureId(gameState);
    const portrait = getPortraitRecord(gameState);
    const lineage = getLineage(gameState, creatureId);
    const bond = getValue(gameState, 'creature.bond', {});
    const powerProfile = buildCreaturePowerProfile(gameState);
    const powerEvents = normalizePowerEvents(gameState);
    const agency = getAgencyCounts(gameState);
    const katana = getKatanaWitness(gameState, creatureId);
    const senseiMemoryIds = getSenseiWitnessedMemoryIds(
        gameState,
        creatureId
    );
    const shipSectionIds = getShipWitnessedSections(
        gameState,
        creatureId
    );
    const kinshipBeacon = getValue(
        gameState,
        'world.sanctuaryDecorations.kinshipBeacon',
        {}
    );

    return {
        schemaVersion: PORTABLE_COMPANION_RECORD_SCHEMA_VERSION,
        recordId: `companion_identity:${creatureId}`,
        creature: {
            id: creatureId,
            name: normalizeText(
                getValue(gameState, 'creature.name', null),
                'Unnamed Companion',
                24
            ),
            species: normalizeIdentifier(
                getValue(gameState, 'creature.genes.species', null),
                'unknown_species',
                64
            ),
            rarity: normalizeIdentifier(
                getValue(gameState, 'creature.genes.rarity', null),
                'common',
                32
            ),
            affinity: getAffinity(gameState),
            lifecycleStage: ALLOWED_STAGES.has(
                getValue(gameState, 'creature.lifecycle.stage', 'baby')
            )
                ? getValue(gameState, 'creature.lifecycle.stage', 'baby')
                : 'baby',
            lineage
        },
        visualIdentity: portrait.portable,
        bond: {
            level: Math.max(1, Math.min(20, Number(bond?.level) || 1)),
            totalInteractions: Math.max(
                0,
                Math.min(99999, Number(bond?.totalInteractions) || 0)
            ),
            careActions: Math.max(
                0,
                Math.min(99999, Number(bond?.careActions) || 0)
            ),
            conversations: Math.max(
                0,
                Math.min(99999, Number(bond?.conversations) || 0)
            ),
            expeditionsCompleted: Math.max(
                0,
                Math.min(999, Number(bond?.levelsCompleted) || 0)
            )
        },
        powers: {
            profileSchemaVersion: powerProfile.schemaVersion,
            affinity: powerProfile.affinity,
            magnitudeClass: powerProfile.magnitudeClass,
            currentControl: powerProfile.currentControl,
            relationshipState: powerProfile.relationshipState,
            universalSenseId: powerProfile.universalSense.id,
            affinityPowerId: powerProfile.affinityPower.id,
            protectiveResponseId: powerProfile.protectiveResponse.id,
            partnershipMoveId: powerProfile.partnershipMove.id,
            partnershipMoveUnlocked:
                powerProfile.partnershipMove.unlocked === true,
            highPowerRevealId: powerProfile.highPowerReveal.id,
            highPowerRevealUnlocked:
                powerProfile.highPowerReveal.unlocked === true,
            events: powerEvents,
            agency
        },
        sharedHistory: {
            senseiMemoryIds,
            shipSectionIds,
            katana,
            kinship: {
                isSharedLineage:
                    lineage.origin === 'shared_fusion',
                linkedSiblingProtected:
                    lineage.hasLinkedSibling,
                sanctuarySharedLineageCount: Math.max(
                    0,
                    Math.min(
                        999,
                        Number(kinshipBeacon?.sharedLineageCount) || 0
                    )
                ),
                peerDisclosure: 'bounded_signal_only',
                ownershipTransfer: false
            },
            firstListeningPriority: normalizeIdentifier(
                getValue(
                    gameState,
                    'world.fendCulture.firstListening.selectedPriority',
                    null
                ),
                null,
                48
            )
        },
        privacy: {
            playerAuthoredFields: ['creature.name'],
            excludes: [
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
            ]
        }
    };
}

function buildChapterRows(record, portrait, fieldMemories) {
    const { creature, bond, powers, sharedHistory } = record;
    const portraitCount = record.visualIdentity.stages.length;
    return {
        identity: [
            {
                label: 'COMPANION',
                value: creature.name,
                detail: `${creature.species.replace(/_/g, ' ')} // ${creature.rarity.toUpperCase()}`
            },
            {
                label: 'CURRENT SIGNATURE',
                value: creature.affinity.toUpperCase(),
                detail: `${creature.lifecycleStage.toUpperCase()} // GENERATION ${creature.lineage.generation}`
            },
            {
                label: 'PORTABLE ID',
                value: creature.id,
                detail: 'Stable across scenes, collection switching, and future import.'
            }
        ],
        living_form: [
            {
                label: 'BEST AVAILABLE VIEW',
                value: portrait.source.replace(/_/g, ' ').toUpperCase(),
                detail: portrait.source === 'living_portrait'
                    ? 'Private generated art is available on this device.'
                    : 'A species-matched study stands in while exact living art is unavailable.'
            },
            {
                label: 'RECORDED STAGES',
                value: `${portraitCount}/4`,
                detail: portraitCount > 0
                    ? record.visualIdentity.stages.map(
                        stage => stage.stage.toUpperCase()
                    ).join(' // ')
                    : 'Pixel identity remains canonical; generated art can be added later.'
            },
            {
                label: 'TRANSFER RULE',
                value: 'PROVENANCE ONLY',
                detail: 'Temporary image URLs never enter the portable companion record.'
            }
        ],
        shared_journey: [
            {
                label: 'TRUST',
                value: `BOND ${bond.level}/20`,
                detail: `${bond.totalInteractions} interactions // ${bond.careActions} care actions`
            },
            {
                label: 'FIELD HISTORY',
                value: `${bond.expeditionsCompleted} EXPEDITIONS`,
                detail: `${powers.agency.autonomousRescues} autonomous rescues // ${powers.agency.highPowerRescues} extreme rescues`
            },
            {
                label: 'POWER & CONTROL',
                value: `${powers.currentControl}% CONTROL`,
                detail: `${powers.affinity.toUpperCase()} // ${powers.relationshipState.toUpperCase()} // strength remains extreme`
            },
            {
                label: 'REMEMBERED TOGETHER',
                value: `${sharedHistory.senseiMemoryIds.length} DOJO MEMORIES`,
                detail: `${sharedHistory.shipSectionIds.length} ship archive reviews witnessed`
            },
            {
                label: 'FIELD MEMORIES',
                value: `${fieldMemories.count} VISUAL RECORDS`,
                detail: fieldMemories.count
                    ? fieldMemories.memories.slice(0, 4)
                        .map(memory => memory.label)
                        .join(' // ')
                    : 'Exact living-form moments will appear here as your shared journey grows.'
            }
        ],
        inheritance: [
            {
                label: 'ORIGIN',
                value: creature.lineage.origin
                    .replace(/_/g, ' ')
                    .toUpperCase(),
                detail: creature.lineage.origin === 'shared_fusion'
                    ? `Generation ${creature.lineage.generation} // one local parent record + ${creature.lineage.protectedParentCount} protected parent signal`
                    : creature.lineage.origin === 'fusion'
                    ? `Generation ${creature.lineage.generation} // ${creature.lineage.parentIds.length} parent records`
                    : 'First-generation Fend hatch record.'
            },
            ...(sharedHistory.kinship.isSharedLineage ? [{
                label: 'LINKED SIBLING',
                value: sharedHistory.kinship.linkedSiblingProtected
                    ? 'ANOTHER SANCTUARY'
                    : 'PROTECTED RECORD',
                detail: 'The sibling and keeper remain private. No name, account, location, ownership, or control crosses this link.'
            }] : []),
            {
                label: 'EARTH + FEND ARTIFACT',
                value: `${sharedHistory.katana.witnessedUpgradeIds.length} ADAPTATIONS`,
                detail: sharedHistory.katana.witnessedUpgradeIds.length
                    ? sharedHistory.katana.witnessedUpgradeIds
                        .map(id => id.replace(/_/g, ' ').toUpperCase())
                        .join(' // ')
                    : 'The Earth-forged katana has no witnessed creature-tech adaptation yet.'
            },
            {
                label: 'CULTURAL MEMORY',
                value: sharedHistory.firstListeningPriority
                    ? sharedHistory.firstListeningPriority
                        .replace(/_/g, ' ')
                        .toUpperCase()
                    : 'NOT YET RECORDED',
                detail: 'Community priorities remain authored IDs, never copied dialogue.'
            },
            {
                label: 'FUTURE HANDOFF',
                value: 'READY',
                detail: 'Identity, lineage, power, bond, and provenance use a versioned privacy-minimized contract.'
            }
        ]
    };
}

export function getCompanionIdentityArchiveSnapshot(gameState) {
    const creatureId = getCreatureId(gameState);
    const state = normalizeCompanionIdentityArchiveState(
        getValue(gameState, 'creature.identityArchive', {}),
        creatureId
    );
    const available = getValue(
        gameState,
        'creature.hatched',
        false
    ) === true;
    const portableRecord = buildPortableCompanionRecord(gameState);
    const portrait = getPortraitRecord(gameState);
    const fieldMemories = getCompanionFieldMemories(gameState, creatureId);
    const rows = buildChapterRows(portableRecord, portrait, fieldMemories);
    const chapters = COMPANION_IDENTITY_CHAPTERS.map(chapter => ({
        ...chapter,
        reviewed: state.reviewedChapterIds.includes(chapter.id),
        rows: rows[chapter.id]
    }));
    const complete =
        state.reviewedChapterIds.length === COMPANION_IDENTITY_CHAPTERS.length;

    return {
        available,
        ready: available && !complete,
        complete,
        state,
        portableRecord,
        fieldMemories,
        displayPortrait: {
            imageUrl: portrait.imageUrl,
            assetRef: portrait.assetRef,
            identityKey: portrait.identityKey,
            stage: portrait.preferredStage,
            source: portrait.source,
            alt: portrait.source.startsWith('living_portrait')
                ? `Living portrait of ${portableRecord.creature.name}`
                : `Authored field study representing ${portableRecord.creature.name}`
        },
        chapters,
        reviewedCount: state.reviewedChapterIds.length,
        totalChapters: COMPANION_IDENTITY_CHAPTERS.length,
        nextChapter: chapters.find(chapter => !chapter.reviewed) || null
    };
}

function persistArchiveForActiveCreature(gameState, archiveState, creatureId) {
    gameState.set('creature.identityArchive', archiveState);
    const collection = getValue(gameState, 'creatures', []);
    if (!Array.isArray(collection)) return;
    const index = collection.findIndex(creature => (
        normalizeIdentifier(
            creature?.id || creature?.genes?.id
        ) === creatureId
    ));
    if (index < 0) return;
    const nextCollection = [...collection];
    nextCollection[index] = {
        ...nextCollection[index],
        identityArchive: archiveState
    };
    gameState.set('creatures', nextCollection);
}

export function recordCompanionIdentityChapter(
    gameState,
    chapterId,
    {
        occurredAt = new Date().toISOString(),
        operationId = null,
        save = true
    } = {}
) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getCompanionIdentityArchiveSnapshot(gameState);
    const chapter = CHAPTER_BY_ID.get(chapterId);
    if (!chapter) {
        return {
            changed: false,
            reason: 'unknown_chapter',
            snapshot
        };
    }
    if (!snapshot.available) {
        return {
            changed: false,
            reason: 'companion_not_available',
            chapter,
            snapshot
        };
    }
    if (snapshot.state.reviewedChapterIds.includes(chapterId)) {
        return {
            changed: false,
            reason: 'already_reviewed',
            chapter,
            snapshot
        };
    }
    if (snapshot.nextChapter?.id !== chapterId) {
        return {
            changed: false,
            reason: 'prior_chapter_required',
            chapter,
            snapshot
        };
    }

    const creatureId = snapshot.portableRecord.creature.id;
    const normalizedOperationId = normalizeIdentifier(
        operationId || `identity_archive:${creatureId}:${chapterId}`,
        `identity_archive:${creatureId}:${chapterId}`,
        96
    );
    const nextState = normalizeCompanionIdentityArchiveState({
        ...snapshot.state,
        reviewedChapterIds: [
            ...snapshot.state.reviewedChapterIds,
            chapterId
        ],
        firstReviewedAt:
            snapshot.state.firstReviewedAt || occurredAt,
        completedAt: chapterId === 'inheritance'
            ? occurredAt
            : null,
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'chapter_reviewed',
                chapterId,
                creatureId,
                occurredAt
            }
        ]
    }, creatureId);
    persistArchiveForActiveCreature(gameState, nextState, creatureId);
    if (save) gameState.save?.();
    gameState.emit?.('companionIdentityArchiveChanged', {
        chapterId,
        creatureId,
        complete: chapterId === 'inheritance'
    });

    return {
        changed: true,
        reason: chapterId === 'inheritance'
            ? 'archive_complete'
            : 'chapter_reviewed',
        chapter,
        snapshot: getCompanionIdentityArchiveSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.CompanionIdentityArchive = {
        COMPANION_IDENTITY_ARCHIVE_SCHEMA_VERSION,
        PORTABLE_COMPANION_RECORD_SCHEMA_VERSION,
        COMPANION_IDENTITY_CHAPTERS,
        AUTHORED_COMPANION_STUDIES,
        createInitialCompanionIdentityArchiveState,
        normalizeCompanionIdentityArchiveState,
        buildPortableCompanionRecord,
        getCompanionFieldMemories,
        getCompanionIdentityArchiveSnapshot,
        recordCompanionIdentityChapter
    };
}
