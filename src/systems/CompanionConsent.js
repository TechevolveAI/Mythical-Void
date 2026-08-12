import { getFendCultureSnapshot } from './FendCulture.js';

export const COMPANION_CONSENT_SCHEMA_VERSION = 2;

export const COMPANION_BOUNDARY_TOPICS = Object.freeze([
    Object.freeze({
        id: 'route',
        label: 'THE ROUTE',
        shortLabel: 'COORDINATES',
        risk:
            'A live Earth transmission could be traced back through the Current to the Fend.',
        question:
            'What may Wanderer-77 reveal about the route?',
        boundary:
            'Keep this world off every map. A path home can remain a secret path.',
        outcome: 'coordinates_withheld'
    }),
    Object.freeze({
        id: 'evidence',
        label: 'THE EVIDENCE',
        shortLabel: 'DISCLOSURE',
        risk:
            'NASA will ask for black-box proof, samples, and an explanation of how the mission survived.',
        question:
            'What may the astronaut prove without offering another life as evidence?',
        boundary:
            'Tell them you survived. My life is not evidence you can hand over.',
        outcome: 'astronaut_survival_only'
    }),
    Object.freeze({
        id: 'power',
        label: 'THE POWER',
        shortLabel: 'RESTRAINT',
        risk:
            'On Earth, power at this scale could be detected across a city even when it saves lives.',
        question:
            'When should a hidden companion use their full power?',
        boundary:
            'I will stay hidden when I can. If hiding would cost a life, I choose the life.',
        outcome: 'emergency_life_first'
    })
]);

const TOPIC_BY_ID = new Map(
    COMPANION_BOUNDARY_TOPICS.map(topic => [topic.id, topic])
);
const CAMPAIGN_PRIORITIES = new Set([
    'remain_and_defend',
    'prepare_homecoming',
    'prepare_first_contact'
]);
const TRAVEL_STATUSES = new Set([
    'not_yet_asked',
    'decision_deferred',
    'willing',
    'declined'
]);
const DISCLOSURE_STATUSES = new Set([
    'withheld',
    'astronaut_survival_only',
    'bounded_evidence_approved'
]);
const LOCATION_BOUNDARIES = new Set([
    'not_discussed',
    'coordinates_withheld'
]);
const POWER_BOUNDARIES = new Set([
    'not_discussed',
    'emergency_life_first'
]);
const MAX_COMPANION_RECORDS = 24;
const MAX_HISTORY = 12;

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
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

function getActiveCompanionId(gameState) {
    return normalizeIdentifier(
        gameState?.get?.('creature.genes.id')
            || gameState?.get?.('creature.id')
            || gameState?.get?.('creature.name'),
        'active_companion'
    );
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const operationId = normalizeIdentifier(entry?.operationId);
            const topicId = TOPIC_BY_ID.has(entry?.topicId)
                ? entry.topicId
                : null;
            if (!operationId || !topicId || seen.has(operationId)) return null;
            seen.add(operationId);
            return {
                operationId,
                type: 'boundary_reviewed',
                topicId,
                outcome: TOPIC_BY_ID.get(topicId).outcome,
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

function createDefaultRecord(companionId, recordedAt = null) {
    return {
        companionId,
        travelStatus: 'not_yet_asked',
        disclosureStatus: 'withheld',
        locationBoundary: 'not_discussed',
        informedRisks: false,
        willingPassenger: null,
        vetoRecognized: true,
        powerBoundary: 'not_discussed',
        reviewedTopicIds: [],
        history: [],
        recordedAt: normalizeTimestamp(recordedAt),
        lastReviewedAt: null
    };
}

function normalizeRecord(record = {}, companionId) {
    const reviewed = new Set(
        Array.isArray(record?.reviewedTopicIds)
            ? record.reviewedTopicIds.filter(id => TOPIC_BY_ID.has(id))
            : []
    );
    const history = normalizeHistory(record?.history);
    history.forEach(entry => reviewed.add(entry.topicId));
    const reviewedTopicIds = COMPANION_BOUNDARY_TOPICS
        .map(topic => topic.id)
        .filter(id => reviewed.has(id));
    const complete = reviewedTopicIds.length === COMPANION_BOUNDARY_TOPICS.length;
    const travelStatus = TRAVEL_STATUSES.has(record?.travelStatus)
        ? record.travelStatus
        : 'not_yet_asked';
    const disclosureStatus = DISCLOSURE_STATUSES.has(record?.disclosureStatus)
        ? record.disclosureStatus
        : 'withheld';

    return {
        companionId,
        travelStatus: complete && travelStatus === 'not_yet_asked'
            ? 'decision_deferred'
            : travelStatus,
        disclosureStatus:
            reviewed.has('evidence') && disclosureStatus === 'withheld'
                ? 'astronaut_survival_only'
                : disclosureStatus,
        locationBoundary: reviewed.has('route')
            ? 'coordinates_withheld'
            : LOCATION_BOUNDARIES.has(record?.locationBoundary)
                ? record.locationBoundary
                : 'not_discussed',
        informedRisks: complete || record?.informedRisks === true,
        willingPassenger: typeof record?.willingPassenger === 'boolean'
            ? record.willingPassenger
            : null,
        vetoRecognized: record?.vetoRecognized !== false,
        powerBoundary: reviewed.has('power')
            ? 'emergency_life_first'
            : POWER_BOUNDARIES.has(record?.powerBoundary)
                ? record.powerBoundary
                : 'not_discussed',
        reviewedTopicIds,
        history,
        recordedAt: normalizeTimestamp(record?.recordedAt),
        lastReviewedAt: normalizeTimestamp(record?.lastReviewedAt)
            || history[history.length - 1]?.occurredAt
            || null
    };
}

export function normalizeCompanionConsentState(state = {}, {
    activeCompanionId = 'active_companion'
} = {}) {
    const normalizedActiveId = normalizeIdentifier(
        activeCompanionId,
        'active_companion'
    );
    const sourceRecords = Array.isArray(state?.records)
        ? state.records
        : (
            state && typeof state === 'object' && (
                state.travelStatus ||
                state.disclosureStatus ||
                state.recordedAt
            )
                ? [{
                    ...state,
                    companionId: state.companionId || normalizedActiveId
                }]
                : []
        );
    const recordsById = new Map();
    sourceRecords.forEach(record => {
        const companionId = normalizeIdentifier(record?.companionId);
        if (!companionId || recordsById.has(companionId)) return;
        recordsById.set(
            companionId,
            normalizeRecord(record, companionId)
        );
    });

    return {
        schemaVersion: COMPANION_CONSENT_SCHEMA_VERSION,
        activeCompanionId: normalizedActiveId,
        records: Array.from(recordsById.values()).slice(
            -MAX_COMPANION_RECORDS
        )
    };
}

export function createCompanionConsentState(gameState, {
    recordedAt = null
} = {}) {
    const activeCompanionId = getActiveCompanionId(gameState);
    const state = normalizeCompanionConsentState(
        gameState?.get?.('story.projectBeacon.companionConsent') || {},
        { activeCompanionId }
    );
    if (state.records.some(record => record.companionId === activeCompanionId)) {
        return state;
    }
    return normalizeCompanionConsentState({
        ...state,
        records: [
            ...state.records,
            createDefaultRecord(activeCompanionId, recordedAt)
        ]
    }, { activeCompanionId });
}

export function getCompanionConsentSnapshot(gameState) {
    const activeCompanionId = getActiveCompanionId(gameState);
    const state = normalizeCompanionConsentState(
        gameState?.get?.('story.projectBeacon.companionConsent') || {},
        { activeCompanionId }
    );
    const record = state.records.find(
        entry => entry.companionId === activeCompanionId
    ) || createDefaultRecord(activeCompanionId);
    const priority = gameState?.get?.('story.projectBeacon.finale.priority');
    const culture = getFendCultureSnapshot(gameState);
    const unlocked =
        gameState?.get?.('story.projectBeacon.uplinkRestored') === true &&
        CAMPAIGN_PRIORITIES.has(priority) &&
        culture.complete;
    const complete =
        record.reviewedTopicIds.length === COMPANION_BOUNDARY_TOPICS.length;
    const topics = COMPANION_BOUNDARY_TOPICS.map(topic => ({
        ...topic,
        reviewed: record.reviewedTopicIds.includes(topic.id)
    }));

    return {
        state,
        record,
        companionId: activeCompanionId,
        priority,
        culture,
        unlocked,
        ready: unlocked && !complete,
        complete,
        reviewedCount: record.reviewedTopicIds.length,
        totalTopics: COMPANION_BOUNDARY_TOPICS.length,
        topics,
        nextTopic: topics.find(topic => !topic.reviewed) || null
    };
}

export function formatCompanionConsentObjective(snapshot) {
    if (snapshot?.complete) {
        return "Earth boundaries recorded. Travel remains your companion's future choice.";
    }
    if (snapshot?.ready) {
        return `Review Earth boundaries at Wanderer-77: ${snapshot.reviewedCount}/${snapshot.totalTopics}.`;
    }
    return 'Restore Project Beacon, establish the Commons, and record a campaign priority.';
}

export function recordCompanionBoundaryTopic(gameState, topicId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const topic = TOPIC_BY_ID.get(topicId);
    const snapshot = getCompanionConsentSnapshot(gameState);
    if (!topic) {
        return {
            changed: false,
            reason: 'unknown_topic',
            snapshot
        };
    }
    if (!snapshot.unlocked) {
        return {
            changed: false,
            reason: 'requirements_missing',
            snapshot
        };
    }
    if (snapshot.record.reviewedTopicIds.includes(topic.id)) {
        return {
            changed: false,
            reason: 'already_reviewed',
            topic,
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `consent:${snapshot.companionId}:${topic.id}`
    ) || `consent:${snapshot.companionId}:${topic.id}`;
    if (
        snapshot.record.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            topic,
            snapshot
        };
    }
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const reviewedTopicIds = COMPANION_BOUNDARY_TOPICS
        .map(entry => entry.id)
        .filter(id => (
            id === topic.id ||
            snapshot.record.reviewedTopicIds.includes(id)
        ));
    const complete =
        reviewedTopicIds.length === COMPANION_BOUNDARY_TOPICS.length;
    const record = normalizeRecord({
        ...snapshot.record,
        travelStatus: complete
            ? 'decision_deferred'
            : snapshot.record.travelStatus,
        disclosureStatus: topic.id === 'evidence'
            ? 'astronaut_survival_only'
            : snapshot.record.disclosureStatus,
        locationBoundary: topic.id === 'route'
            ? 'coordinates_withheld'
            : snapshot.record.locationBoundary,
        informedRisks: complete,
        willingPassenger: null,
        vetoRecognized: true,
        powerBoundary: topic.id === 'power'
            ? 'emergency_life_first'
            : snapshot.record.powerBoundary,
        reviewedTopicIds,
        history: [
            ...snapshot.record.history,
            {
                operationId: normalizedOperationId,
                type: 'boundary_reviewed',
                topicId: topic.id,
                outcome: topic.outcome,
                occurredAt: timestamp
            }
        ],
        recordedAt: complete
            ? snapshot.record.recordedAt || timestamp
            : snapshot.record.recordedAt,
        lastReviewedAt: timestamp
    }, snapshot.companionId);
    const state = normalizeCompanionConsentState({
        ...snapshot.state,
        records: [
            ...snapshot.state.records.filter(
                entry => entry.companionId !== snapshot.companionId
            ),
            record
        ]
    }, { activeCompanionId: snapshot.companionId });

    gameState.set('story.projectBeacon.companionConsent', state);
    if (save) gameState.save?.();
    gameState.emit?.('companionConsentChanged', {
        type: 'boundary_reviewed',
        companionId: snapshot.companionId,
        topicId: topic.id,
        complete,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: complete
            ? 'boundary_review_complete'
            : 'boundary_reviewed',
        topic,
        record,
        state,
        snapshot: getCompanionConsentSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.CompanionConsent = {
        COMPANION_CONSENT_SCHEMA_VERSION,
        COMPANION_BOUNDARY_TOPICS,
        normalizeCompanionConsentState,
        createCompanionConsentState,
        getCompanionConsentSnapshot,
        formatCompanionConsentObjective,
        recordCompanionBoundaryTopic
    };
}
