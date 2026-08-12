export const CURRENT_ECOLOGY_SCHEMA_VERSION = 3;
export const CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION = 1;

export const CURRENT_NODE_STATES = Object.freeze({
    LIVING: 'living',
    FADING: 'fading',
    SEVERED: 'severed',
    RESTORED: 'restored'
});

export const CURRENT_REGION_ACTIONS = Object.freeze({
    OBSERVE: 'observe',
    PROTECT: 'protect',
    REDIRECT: 'redirect',
    SIPHON: 'siphon'
});

export const CURRENT_ARRIVAL_CLASSIFICATIONS = Object.freeze({
    QUIET: 'quiet',
    CARE_RESONANCE: 'care_resonance',
    EXTRACTION_TRACE: 'extraction_trace',
    MIXED_TRACE: 'mixed_trace'
});

const CURRENT_ACTION_DEFINITIONS = Object.freeze({
    observe: Object.freeze({
        vitalityDelta: 0,
        category: 'evidence',
        label: 'OBSERVE',
        effectLabel: 'NO VITALITY CHANGE',
        fieldSummary: 'Record the living rhythm without taking anything.',
        result: 'The scanner records a living rhythm without taking a sample.',
        companionLine: 'It knows we are listening.'
    }),
    protect: Object.freeze({
        vitalityDelta: 8,
        category: 'care',
        label: 'PROTECT',
        effectLabel: '+8 VITALITY',
        fieldSummary: 'Shield exposed threads from the Beacon field.',
        result: 'You shield the exposed Current threads from the Beacon field.',
        companionLine: 'That pressure was hurting it.'
    }),
    redirect: Object.freeze({
        vitalityDelta: 12,
        category: 'care',
        label: 'REDIRECT',
        effectLabel: '+12 VITALITY',
        fieldSummary: 'Return loose energy to the living network.',
        result: 'Your companion guides loose energy back toward the living network.',
        companionLine: 'Not ours. Back where it belongs.'
    }),
    siphon: Object.freeze({
        vitalityDelta: -14,
        category: 'extraction',
        label: 'SIPHON',
        effectLabel: '-14 VITALITY / +1 CHARGE',
        fieldSummary: 'Fill one Beacon charge by thinning this habitat.',
        result: 'The Beacon cell fills. Nearby life dims as the Current thins.',
        companionLine: 'Useful does not mean harmless.'
    })
});

export function getCurrentRegionActionPresentation(actionId) {
    const action = CURRENT_ACTION_DEFINITIONS[actionId];
    if (!action) return null;

    return {
        id: actionId,
        label: action.label,
        category: action.category,
        vitalityDelta: action.vitalityDelta,
        effectLabel: action.effectLabel,
        fieldSummary: action.fieldSummary,
        result: action.result,
        companionLine: action.companionLine
    };
}

export const CURRENT_REGION_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'mythical_forest',
        levelId: 'mythicalForest',
        runtimeLevelId: 'mythical_forest_1',
        label: 'Mythical Forest',
        initialVitality: 28,
        restoredVitality: 72
    }),
    Object.freeze({
        id: 'crystal_caves',
        levelId: 'crystalCaves',
        runtimeLevelId: 'crystal_caves_1',
        label: 'Crystal Caves',
        initialVitality: 20,
        restoredVitality: 74
    }),
    Object.freeze({
        id: 'stellar_reef',
        levelId: 'cosmicReef',
        runtimeLevelId: 'reef_1',
        label: 'Stellar Reef',
        initialVitality: 34,
        restoredVitality: 76
    }),
    Object.freeze({
        id: 'void_peaks',
        levelId: 'voidPeaks',
        runtimeLevelId: 'void_peaks_1',
        label: 'Void Peaks',
        initialVitality: 18,
        restoredVitality: 70
    }),
    Object.freeze({
        id: 'aurora_depths',
        levelId: 'auroraDepths',
        runtimeLevelId: 'aurora_depths_1',
        label: 'Aurora Depths',
        initialVitality: 30,
        restoredVitality: 80
    }),
    Object.freeze({
        id: 'current_heart',
        levelId: 'finalVoid',
        runtimeLevelId: 'final_void_1',
        label: 'Current Heart',
        initialVitality: 12,
        restoredVitality: 88
    })
]);

const REGION_BY_ID = new Map(
    CURRENT_REGION_DEFINITIONS.map(region => [region.id, region])
);
const REGION_BY_LEVEL = new Map(
    CURRENT_REGION_DEFINITIONS.flatMap(region => [
        [region.levelId, region],
        [region.runtimeLevelId, region]
    ])
);
const KNOWN_SIGNAL_IDS = new Set([
    'echo_bloom',
    'memory_stone',
    'rootlight'
]);
const MAX_HISTORY = 48;
const PRE_RESTORATION_VITALITY_CAP = 69;
const FIRST_LATER_REALM_INDEX = 2;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const timestamp = value.trim().slice(0, 40);
    return timestamp || null;
}

function normalizeIdentifier(value, maxLength = 96) {
    if (typeof value !== 'string') return null;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : null;
}

function uniqueKnownIds(value, knownIds) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value.filter(id => typeof id === 'string' && knownIds.has(id))
    ));
}

function normalizeActionCounts(value = {}) {
    return Object.fromEntries(
        Object.keys(CURRENT_ACTION_DEFINITIONS).map(actionId => [
            actionId,
            clamp(Math.floor(Number(value?.[actionId]) || 0), 0, 999)
        ])
    );
}

export function getCurrentNodeState(vitality, guardianRestored = false) {
    if (guardianRestored || vitality >= 70) {
        return CURRENT_NODE_STATES.RESTORED;
    }
    if (vitality >= 50) {
        return CURRENT_NODE_STATES.LIVING;
    }
    if (vitality >= 21) {
        return CURRENT_NODE_STATES.FADING;
    }
    return CURRENT_NODE_STATES.SEVERED;
}

function createRegionState(definition, source = {}) {
    const restored = source?.guardianRestored === true;
    const fallbackVitality = restored
        ? definition.restoredVitality
        : definition.initialVitality;
    const sourceVitality = Number(source?.vitality);
    const vitality = clamp(
        Math.round(Number.isFinite(sourceVitality) ? sourceVitality : fallbackVitality),
        restored ? definition.restoredVitality : 0,
        100
    );

    const nodeState = getCurrentNodeState(vitality, restored);
    return {
        nodeState,
        status: nodeState,
        vitality,
        guardianRestored: restored,
        restoredAt: restored ? normalizeTimestamp(source?.restoredAt) : null,
        evidence: restored
            ? normalizeIdentifier(source?.evidence, 48) || 'guardian_restored'
            : normalizeIdentifier(source?.evidence, 48),
        actionCounts: normalizeActionCounts(source?.actionCounts),
        lastAction: CURRENT_ACTION_DEFINITIONS[source?.lastAction]
            ? source.lastAction
            : null,
        lastActionAt: normalizeTimestamp(source?.lastActionAt)
    };
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const id = normalizeIdentifier(entry?.id);
            const type = [
                'signal_observed',
                'region_interaction',
                'region_restored',
                'arrival_consequence'
            ].includes(entry?.type)
                ? entry.type
                : null;
            if (!id || !type || seen.has(id)) return null;
            seen.add(id);
            return {
                id,
                type,
                subjectId: normalizeIdentifier(entry?.subjectId),
                actionId: CURRENT_ACTION_DEFINITIONS[entry?.actionId]
                    ? entry.actionId
                    : null,
                vitalityBefore: Number.isFinite(Number(entry?.vitalityBefore))
                    ? clamp(Math.round(Number(entry.vitalityBefore)), 0, 100)
                    : null,
                vitalityAfter: Number.isFinite(Number(entry?.vitalityAfter))
                    ? clamp(Math.round(Number(entry.vitalityAfter)), 0, 100)
                    : null,
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

function getArrivalClassification(extractionActions, careActions) {
    if (extractionActions > 0 && careActions > 0) {
        return CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE;
    }
    if (extractionActions > 0) {
        return CURRENT_ARRIVAL_CLASSIFICATIONS.EXTRACTION_TRACE;
    }
    if (careActions > 0) {
        return CURRENT_ARRIVAL_CLASSIFICATIONS.CARE_RESONANCE;
    }
    return CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET;
}

function getUpstreamDefinitions(regionId) {
    const index = CURRENT_REGION_DEFINITIONS.findIndex(
        definition => definition.id === regionId
    );
    if (index < FIRST_LATER_REALM_INDEX) return [];
    return CURRENT_REGION_DEFINITIONS.slice(0, index);
}

function normalizeArrivalConsequences(value = {}) {
    if (!value || typeof value !== 'object') return {};
    const consequences = {};

    CURRENT_REGION_DEFINITIONS
        .slice(FIRST_LATER_REALM_INDEX)
        .forEach(definition => {
            const source = value[definition.id];
            if (!source || typeof source !== 'object') return;
            const upstreamIds = new Set(
                getUpstreamDefinitions(definition.id).map(
                    region => region.id
                )
            );
            const extractionActions = clamp(
                Math.floor(Number(source.extractionActions) || 0),
                0,
                999
            );
            const careActions = clamp(
                Math.floor(Number(source.careActions) || 0),
                0,
                999
            );

            consequences[definition.id] = {
                schemaVersion:
                    CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
                regionId: definition.id,
                sourceRegionIds: uniqueKnownIds(
                    source.sourceRegionIds,
                    upstreamIds
                ),
                extractionActions,
                careActions,
                vitalityDelta: clamp(
                    Math.round(Number(source.vitalityDelta) || 0),
                    -20,
                    12
                ),
                classification: getArrivalClassification(
                    extractionActions,
                    careActions
                ),
                operationId:
                    normalizeIdentifier(source.operationId) ||
                    `arrival:${definition.id}`,
                appliedAt: normalizeTimestamp(source.appliedAt)
            };
        });

    return consequences;
}

export function getCurrentArrivalConsequencePresentation(
    consequence = null
) {
    if (!consequence || typeof consequence !== 'object') return null;
    const delta = clamp(
        Math.round(Number(consequence.vitalityDelta) || 0),
        -20,
        12
    );
    const amount = delta > 0 ? `+${delta}` : `${delta}`;
    const presentation = {
        [CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET]: {
            label: 'QUIET ARRIVAL',
            primaryColor: 0xD8DEE9,
            fieldLine:
                'No earlier intervention has changed this habitat.'
        },
        [CURRENT_ARRIVAL_CLASSIFICATIONS.CARE_RESONANCE]: {
            label: 'CARE RESONANCE',
            primaryColor: 0x71E6B1,
            fieldLine:
                'Earlier protection is already reinforcing this habitat.'
        },
        [CURRENT_ARRIVAL_CLASSIFICATIONS.EXTRACTION_TRACE]: {
            label: 'EXTRACTION TRACE',
            primaryColor: 0xD94B4B,
            fieldLine:
                'Earlier siphoning reached this habitat. The useful charge left a living cost.'
        },
        [CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE]: {
            label: 'MIXED CURRENT',
            primaryColor: 0xF2C14E,
            fieldLine:
                'The Current carries both earlier damage and the repair that followed.'
        }
    }[consequence.classification] || {
        label: 'UPSTREAM ECHO',
        primaryColor: 0xD8DEE9,
        fieldLine: 'The Current carries an earlier field record.'
    };

    return {
        ...presentation,
        vitalityDelta: delta,
        amountLabel: amount,
        statusLine: `${presentation.label}  //  ${amount} ARRIVAL VITALITY`
    };
}

export function createInitialCurrentEcologyState() {
    return {
        schemaVersion: CURRENT_ECOLOGY_SCHEMA_VERSION,
        observedSignalIds: [],
        restoredRegionIds: [],
        arrivalConsequences: {},
        regions: Object.fromEntries(
            CURRENT_REGION_DEFINITIONS.map(definition => [
                definition.id,
                createRegionState(definition)
            ])
        ),
        history: []
    };
}

export function normalizeCurrentEcologyState(state = {}, {
    completedLevelIds = []
} = {}) {
    const completedLevels = new Set(
        Array.isArray(completedLevelIds) ? completedLevelIds : []
    );
    const restoredFromState = uniqueKnownIds(
        state?.restoredRegionIds,
        new Set(CURRENT_REGION_DEFINITIONS.map(region => region.id))
    );
    const restoredRegionIds = new Set(restoredFromState);
    const regions = {};

    CURRENT_REGION_DEFINITIONS.forEach(definition => {
        const source = state?.regions?.[definition.id] || {};
        const migratedRestoration = completedLevels.has(definition.levelId);
        const guardianRestored = source.guardianRestored === true
            || restoredRegionIds.has(definition.id)
            || migratedRestoration;
        if (guardianRestored) {
            restoredRegionIds.add(definition.id);
        }
        regions[definition.id] = createRegionState(definition, {
            ...source,
            guardianRestored,
            evidence: source.evidence || (
                migratedRestoration ? 'legacy_completion' : null
            )
        });
    });

    return {
        schemaVersion: CURRENT_ECOLOGY_SCHEMA_VERSION,
        observedSignalIds: uniqueKnownIds(
            state?.observedSignalIds,
            KNOWN_SIGNAL_IDS
        ),
        restoredRegionIds: CURRENT_REGION_DEFINITIONS
            .map(region => region.id)
            .filter(regionId => restoredRegionIds.has(regionId)),
        arrivalConsequences: normalizeArrivalConsequences(
            state?.arrivalConsequences
        ),
        regions,
        history: normalizeHistory(state?.history)
    };
}

export function getCurrentEcologySummary(state = {}) {
    const normalized = normalizeCurrentEcologyState(state);
    const restoredCount = normalized.restoredRegionIds.length;
    const totalRegions = CURRENT_REGION_DEFINITIONS.length;
    const observedSignals = normalized.observedSignalIds.length;
    const vitality = Math.round(
        CURRENT_REGION_DEFINITIONS.reduce(
            (total, definition) => (
                total + normalized.regions[definition.id].vitality
            ),
            0
        ) / totalRegions
    );
    const awareness = observedSignals >= KNOWN_SIGNAL_IDS.size
        ? 'network_confirmed'
        : observedSignals > 0
            ? 'listening'
            : 'unmapped';
    const networkStatus = restoredCount === totalRegions
        ? 'aligned'
        : restoredCount >= totalRegions - 1
            ? 'stabilizing'
            : restoredCount > 0
                ? 'recovering'
                : 'strained';
    const actionTotals = CURRENT_REGION_DEFINITIONS.reduce(
        (totals, definition) => {
            const counts = normalized.regions[definition.id].actionCounts;
            totals.observe += counts.observe;
            totals.protect += counts.protect;
            totals.redirect += counts.redirect;
            totals.siphon += counts.siphon;
            return totals;
        },
        { observe: 0, protect: 0, redirect: 0, siphon: 0 }
    );
    const arrivalConsequences = Object.values(
        normalized.arrivalConsequences
    );

    return {
        schemaVersion: CURRENT_ECOLOGY_SCHEMA_VERSION,
        awareness,
        awarenessLabel: {
            unmapped: 'UNMAPPED',
            listening: 'LISTENING',
            network_confirmed: 'NETWORK CONFIRMED'
        }[awareness],
        networkStatus,
        networkStatusLabel: networkStatus.toUpperCase(),
        vitality,
        observedSignals,
        totalSignals: KNOWN_SIGNAL_IDS.size,
        restoredCount,
        totalRegions,
        restoredRegionIds: [...normalized.restoredRegionIds],
        actionTotals,
        extractionActions: actionTotals.siphon,
        careActions: actionTotals.protect + actionTotals.redirect,
        arrivalConsequenceCount: arrivalConsequences.length,
        extractionTraceRegionIds: arrivalConsequences
            .filter(consequence => consequence.extractionActions > 0)
            .map(consequence => consequence.regionId),
        netArrivalVitalityDelta: arrivalConsequences.reduce(
            (total, consequence) => (
                total + consequence.vitalityDelta
            ),
            0
        )
    };
}

function getCompletedLevelIds(gameState) {
    return CURRENT_REGION_DEFINITIONS
        .filter(definition => (
            gameState?.get?.(`levels.${definition.levelId}.completed`) === true
        ))
        .map(definition => definition.levelId);
}

export function getCurrentEcologySnapshot(gameState) {
    const state = normalizeCurrentEcologyState(
        gameState?.get?.('world.currentEcology') || {},
        { completedLevelIds: getCompletedLevelIds(gameState) }
    );
    return {
        state,
        summary: getCurrentEcologySummary(state)
    };
}

function appendHistory(state, entry) {
    const history = state.history.filter(item => item.id !== entry.id);
    return [...history, entry].slice(-MAX_HISTORY);
}

export function getCurrentRegionProjection(region = {}) {
    const vitality = clamp(Math.round(Number(region?.vitality) || 0), 0, 100);
    const nodeState = getCurrentNodeState(vitality, region?.guardianRestored === true);
    const presentation = {
        severed: {
            label: 'SEVERED',
            primaryColor: 0xD94B4B,
            secondaryColor: 0x111111,
            accentColor: 0xF4F4F4,
            glowAlpha: 0.12,
            lifeDensity: 0.1,
            pulseRate: 1900,
            fieldLine: 'No return pulse. The local network has been cut.'
        },
        fading: {
            label: 'FADING',
            primaryColor: 0xD8B65C,
            secondaryColor: 0x562F36,
            accentColor: 0xF4F4F4,
            glowAlpha: 0.2,
            lifeDensity: 0.35,
            pulseRate: 1500,
            fieldLine: 'A weak pulse remains, but energy is leaving this habitat.'
        },
        living: {
            label: 'LIVING',
            primaryColor: 0x71E6B1,
            secondaryColor: 0x163B2E,
            accentColor: 0xF4F4F4,
            glowAlpha: 0.28,
            lifeDensity: 0.68,
            pulseRate: 1100,
            fieldLine: 'The local network is carrying life again.'
        },
        restored: {
            label: 'RESTORED',
            primaryColor: 0x8FE3CF,
            secondaryColor: 0x2A174A,
            accentColor: 0xF2C14E,
            glowAlpha: 0.4,
            lifeDensity: 1,
            pulseRate: 800,
            fieldLine: 'Guardian and habitat are aligned with the Current.'
        }
    }[nodeState];

    return {
        nodeState,
        vitality,
        ...presentation
    };
}

export function getCurrentRegionSnapshot(gameState, levelId) {
    const definition = REGION_BY_LEVEL.get(levelId) || REGION_BY_ID.get(levelId);
    if (!definition) return null;

    const { state } = getCurrentEcologySnapshot(gameState);
    return {
        definition,
        region: state.regions[definition.id],
        projection: getCurrentRegionProjection(state.regions[definition.id]),
        arrivalConsequence: state.arrivalConsequences[definition.id]
            ? {
                ...state.arrivalConsequences[definition.id],
                presentation:
                    getCurrentArrivalConsequencePresentation(
                        state.arrivalConsequences[definition.id]
                    )
            }
            : null
    };
}

export function applyCurrentArrivalConsequence(gameState, levelId, {
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    const definition = REGION_BY_LEVEL.get(levelId) || REGION_BY_ID.get(levelId);
    if (!gameState?.get || !gameState?.set || !definition) {
        return null;
    }

    const upstreamDefinitions = getUpstreamDefinitions(definition.id);
    if (upstreamDefinitions.length === 0) {
        return {
            changed: false,
            reason: 'not_later_realm',
            regionId: definition.id
        };
    }

    const { state } = getCurrentEcologySnapshot(gameState);
    const existing = state.arrivalConsequences[definition.id];
    if (existing) {
        return {
            changed: false,
            reason: 'already_applied',
            consequence: existing,
            presentation:
                getCurrentArrivalConsequencePresentation(existing),
            state,
            summary: getCurrentEcologySummary(state)
        };
    }

    const before = state.regions[definition.id];
    if (before.guardianRestored) {
        return {
            changed: false,
            reason: 'guardian_restored',
            regionId: definition.id,
            region: before,
            state,
            summary: getCurrentEcologySummary(state)
        };
    }

    const totals = upstreamDefinitions.reduce(
        (result, upstream) => {
            const counts = state.regions[upstream.id].actionCounts;
            result.extractionActions += counts.siphon;
            result.careActions += counts.protect + counts.redirect;
            return result;
        },
        { extractionActions: 0, careActions: 0 }
    );
    const vitalityDelta = clamp(
        Math.min(totals.careActions * 2, 12) -
            Math.min(totals.extractionActions * 5, 20),
        -20,
        12
    );
    const vitalityAfter = clamp(
        before.vitality + vitalityDelta,
        0,
        PRE_RESTORATION_VITALITY_CAP
    );
    const consequence = {
        schemaVersion: CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
        regionId: definition.id,
        sourceRegionIds: upstreamDefinitions.map(region => region.id),
        extractionActions: totals.extractionActions,
        careActions: totals.careActions,
        vitalityDelta,
        classification: getArrivalClassification(
            totals.extractionActions,
            totals.careActions
        ),
        operationId: `arrival:${definition.id}`,
        appliedAt: normalizeTimestamp(occurredAt)
    };
    const region = createRegionState(definition, {
        ...before,
        vitality: vitalityAfter
    });

    state.regions[definition.id] = region;
    state.arrivalConsequences[definition.id] = consequence;
    state.history = appendHistory(state, {
        id: consequence.operationId,
        type: 'arrival_consequence',
        subjectId: definition.id,
        vitalityBefore: before.vitality,
        vitalityAfter,
        occurredAt: consequence.appliedAt
    });
    gameState.set('world.currentEcology', state);
    if (save) gameState.save?.();
    gameState.emit?.('currentEcologyChanged', {
        type: 'arrival_consequence',
        regionId: definition.id,
        classification: consequence.classification,
        vitalityDelta
    });

    return {
        changed: true,
        regionId: definition.id,
        regionLabel: definition.label,
        beforeVitality: before.vitality,
        afterVitality: vitalityAfter,
        consequence,
        presentation:
            getCurrentArrivalConsequencePresentation(consequence),
        region,
        state,
        summary: getCurrentEcologySummary(state)
    };
}

export function recordCurrentRegionAction(gameState, levelId, actionId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    const definition = REGION_BY_LEVEL.get(levelId) || REGION_BY_ID.get(levelId);
    const action = CURRENT_ACTION_DEFINITIONS[actionId];
    if (!gameState?.get || !gameState?.set || !definition || !action) {
        return null;
    }

    const { state } = getCurrentEcologySnapshot(gameState);
    const before = state.regions[definition.id];
    const normalizedOperationId = normalizeIdentifier(operationId, 96);
    const normalizedOccurredAt = normalizeTimestamp(occurredAt);
    const historyId = normalizedOperationId
        ? `action:${normalizedOperationId}`
        : `action:${definition.id}:${actionId}:${normalizeIdentifier(normalizedOccurredAt, 48) || Date.now()}`;
    const duplicate = state.history.some(entry => entry.id === historyId);

    if (duplicate) {
        return {
            changed: false,
            duplicate: true,
            reason: 'duplicate_operation',
            action,
            regionId: definition.id,
            region: before,
            projection: getCurrentRegionProjection(before),
            state,
            summary: getCurrentEcologySummary(state)
        };
    }
    if (before.guardianRestored) {
        return {
            changed: false,
            duplicate: false,
            reason: 'guardian_restored',
            action,
            regionId: definition.id,
            region: before,
            projection: getCurrentRegionProjection(before),
            state,
            summary: getCurrentEcologySummary(state)
        };
    }
    if (
        actionId !== CURRENT_REGION_ACTIONS.OBSERVE &&
        before.actionCounts.observe === 0
    ) {
        return {
            changed: false,
            duplicate: false,
            reason: 'observation_required',
            action,
            regionId: definition.id,
            region: before,
            projection: getCurrentRegionProjection(before),
            state,
            summary: getCurrentEcologySummary(state)
        };
    }
    if (actionId === CURRENT_REGION_ACTIONS.OBSERVE && before.actionCounts.observe > 0) {
        return {
            changed: false,
            duplicate: false,
            reason: 'already_observed',
            action,
            regionId: definition.id,
            region: before,
            projection: getCurrentRegionProjection(before),
            state,
            summary: getCurrentEcologySummary(state)
        };
    }

    const vitalityAfter = clamp(
        before.vitality + action.vitalityDelta,
        0,
        PRE_RESTORATION_VITALITY_CAP
    );
    const region = createRegionState(definition, {
        ...before,
        vitality: vitalityAfter,
        actionCounts: {
            ...before.actionCounts,
            [actionId]: before.actionCounts[actionId] + 1
        },
        lastAction: actionId,
        lastActionAt: normalizedOccurredAt,
        evidence: action.category === 'evidence'
            ? 'non_invasive_observation'
            : before.evidence
    });
    state.regions[definition.id] = region;
    state.history = appendHistory(state, {
        id: historyId,
        type: 'region_interaction',
        subjectId: definition.id,
        actionId,
        vitalityBefore: before.vitality,
        vitalityAfter,
        occurredAt: normalizedOccurredAt
    });
    gameState.set('world.currentEcology', state);
    if (save) gameState.save?.();
    gameState.emit?.('currentEcologyChanged', {
        type: 'region_interaction',
        regionId: definition.id,
        actionId,
        vitalityBefore: before.vitality,
        vitalityAfter
    });

    return {
        changed: true,
        duplicate: false,
        action,
        regionId: definition.id,
        regionLabel: definition.label,
        beforeVitality: before.vitality,
        afterVitality: vitalityAfter,
        beforeProjection: getCurrentRegionProjection(before),
        projection: getCurrentRegionProjection(region),
        region,
        state,
        summary: getCurrentEcologySummary(state)
    };
}

export function recordCurrentSignalObservation(gameState, signalId, {
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set || !KNOWN_SIGNAL_IDS.has(signalId)) {
        return null;
    }

    const { state } = getCurrentEcologySnapshot(gameState);
    const changed = !state.observedSignalIds.includes(signalId);
    if (changed) {
        state.observedSignalIds.push(signalId);
        state.history = appendHistory(state, {
            id: `signal:${signalId}`,
            type: 'signal_observed',
            subjectId: signalId,
            occurredAt: normalizeTimestamp(occurredAt)
        });
        gameState.set('world.currentEcology', state);
        if (save) gameState.save?.();
        gameState.emit?.('currentEcologyChanged', {
            type: 'signal_observed',
            signalId
        });
    }

    return {
        changed,
        state,
        summary: getCurrentEcologySummary(state)
    };
}

export function recordCurrentRegionRestoration(gameState, levelId, {
    occurredAt = new Date().toISOString(),
    save = true
} = {}) {
    const definition = REGION_BY_LEVEL.get(levelId);
    if (!gameState?.get || !gameState?.set || !definition) {
        return null;
    }

    const { state } = getCurrentEcologySnapshot(gameState);
    const before = state.regions[definition.id];
    const changed = before.guardianRestored !== true;
    if (changed) {
        state.regions[definition.id] = createRegionState(definition, {
            ...before,
            guardianRestored: true,
            vitality: definition.restoredVitality,
            restoredAt: occurredAt,
            evidence: 'guardian_restored'
        });
        if (!state.restoredRegionIds.includes(definition.id)) {
            state.restoredRegionIds.push(definition.id);
        }
        state.history = appendHistory(state, {
            id: `restoration:${definition.id}`,
            type: 'region_restored',
            subjectId: definition.id,
            occurredAt: normalizeTimestamp(occurredAt)
        });
        gameState.set('world.currentEcology', state);
        if (save) gameState.save?.();
        gameState.emit?.('currentEcologyChanged', {
            type: 'region_restored',
            regionId: definition.id
        });
    }

    const region = state.regions[definition.id];
    return {
        changed,
        regionId: definition.id,
        regionLabel: definition.label,
        beforeVitality: before.vitality,
        afterVitality: region.vitality,
        beforeProjection: getCurrentRegionProjection(before),
        projection: getCurrentRegionProjection(region),
        region,
        state,
        summary: getCurrentEcologySummary(state)
    };
}

export function getCurrentRegionDefinition(regionId) {
    return REGION_BY_ID.get(regionId) || null;
}

if (typeof window !== 'undefined') {
    window.CurrentEcology = {
        CURRENT_ECOLOGY_SCHEMA_VERSION,
        CURRENT_ARRIVAL_CONSEQUENCE_SCHEMA_VERSION,
        CURRENT_NODE_STATES,
        CURRENT_REGION_ACTIONS,
        CURRENT_ARRIVAL_CLASSIFICATIONS,
        getCurrentRegionActionPresentation,
        getCurrentNodeState,
        getCurrentEcologySnapshot,
        getCurrentRegionSnapshot,
        getCurrentRegionProjection,
        getCurrentArrivalConsequencePresentation,
        applyCurrentArrivalConsequence,
        recordCurrentRegionAction,
        recordCurrentRegionRestoration
    };
}
