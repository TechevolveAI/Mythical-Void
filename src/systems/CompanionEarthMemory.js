import { getCompanionConsentSnapshot } from './CompanionConsent.js';
import { getRemainAndDefendSnapshot } from './RemainAndDefendCampaign.js';

export const COMPANION_EARTH_MEMORY_SCHEMA_VERSION = 1;

export const EARTH_MEMORY_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'dojo_dawn',
        order: 1,
        title: 'THE DOJO BEFORE DAWN',
        shortLabel: 'DOJO',
        signal: 'DISCIPLINE // FRIENDSHIP',
        invitation:
            'Show me an Earth memory that explains why you still believe people can choose restraint.',
        memory:
            'Before Project Beacon, you and Sensei opened the dojo while the street outside was still dark. No audience. No score. Just two friends practising how to hold power without needing to prove it.',
        response:
            'Then Earth taught you restraint before the Fend did. I want to understand the friend who kept that lesson alive.'
    }),
    Object.freeze({
        id: 'ocean_after_storm',
        order: 2,
        title: 'THE OCEAN AFTER A STORM',
        shortLabel: 'OCEAN',
        signal: 'BEAUTY // RECOVERY',
        invitation:
            'Show me an Earth memory that explains why a damaged world is still worth repairing.',
        memory:
            'After a night of violent weather, the coast was changed but alive. People cleared the paths together while seabirds returned to the tide. Earth looked fragile, powerful, and worth the work all at once.',
        response:
            'A world can be wounded without being finished. That is something our planets already share.'
    }),
    Object.freeze({
        id: 'city_lights',
        order: 3,
        title: 'THE CITY LIGHTS',
        shortLabel: 'CITY',
        signal: 'INVENTION // COST',
        invitation:
            'Show me an Earth memory that explains why humanity is more than the mission that sent you.',
        memory:
            'From orbit, a city became a web of light made by millions of ordinary lives. The same brilliance that built Project Beacon also built hospitals, music, homes, and ways for strangers to help one another.',
        response:
            'Then the people who sent you do not speak for every light. I want to know the Earth you are trying to protect.'
    })
]);

const MEMORY_BY_ID = new Map(
    EARTH_MEMORY_DEFINITIONS.map(memory => [memory.id, memory])
);
const MAX_COMPANION_RECORDS = 24;
const MAX_HISTORY = 12;

function normalizeIdentifier(value, fallback = null, maxLength = 96) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
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
            const memoryId = MEMORY_BY_ID.has(entry?.memoryId)
                ? entry.memoryId
                : null;
            if (!operationId || !memoryId || seen.has(operationId)) {
                return null;
            }
            seen.add(operationId);
            return {
                operationId,
                type: 'earth_memory_shared',
                memoryId,
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

function createDefaultRecord(companionId) {
    return {
        companionId,
        status: 'not_shared',
        selectedMemoryId: null,
        invitationStatus: 'not_offered',
        travelConsentRecorded: false,
        transmissionStatus: 'not_sent',
        sharedAt: null,
        history: []
    };
}

function normalizeRecord(record = {}, companionId) {
    const history = normalizeHistory(record?.history);
    const selectedMemoryId = MEMORY_BY_ID.has(record?.selectedMemoryId)
        ? record.selectedMemoryId
        : history[history.length - 1]?.memoryId || null;
    return {
        companionId,
        status: selectedMemoryId ? 'shared' : 'not_shared',
        selectedMemoryId,
        invitationStatus: 'not_offered',
        travelConsentRecorded: false,
        transmissionStatus: 'not_sent',
        sharedAt: selectedMemoryId
            ? normalizeTimestamp(record?.sharedAt)
                || history[history.length - 1]?.occurredAt
                || null
            : null,
        history
    };
}

export function normalizeCompanionEarthMemoryState(state = {}, {
    activeCompanionId = 'active_companion'
} = {}) {
    const normalizedActiveId = normalizeIdentifier(
        activeCompanionId,
        'active_companion'
    );
    const recordsById = new Map();
    const sourceRecords = Array.isArray(state?.records)
        ? state.records
        : [];
    sourceRecords.forEach(record => {
        const companionId = normalizeIdentifier(record?.companionId);
        if (!companionId || recordsById.has(companionId)) return;
        recordsById.set(
            companionId,
            normalizeRecord(record, companionId)
        );
    });
    return {
        schemaVersion: COMPANION_EARTH_MEMORY_SCHEMA_VERSION,
        activeCompanionId: normalizedActiveId,
        records: Array.from(recordsById.values()).slice(
            -MAX_COMPANION_RECORDS
        )
    };
}

export function getCompanionEarthMemorySnapshot(gameState, {
    consentSnapshot = null,
    recoverySnapshot = null
} = {}) {
    const companionId = getActiveCompanionId(gameState);
    const state = normalizeCompanionEarthMemoryState(
        gameState?.get?.('story.projectBeacon.companionEarthMemory') || {},
        { activeCompanionId: companionId }
    );
    const record = state.records.find(
        entry => entry.companionId === companionId
    ) || createDefaultRecord(companionId);
    const consent = consentSnapshot || getCompanionConsentSnapshot(gameState);
    const recovery = recoverySnapshot || getRemainAndDefendSnapshot(gameState);
    const unlocked = consent.complete === true && recovery.complete === true;
    const complete = record.status === 'shared' &&
        MEMORY_BY_ID.has(record.selectedMemoryId);

    return {
        state,
        record,
        companionId,
        consent,
        recovery,
        unlocked,
        ready: unlocked && !complete,
        complete,
        memories: EARTH_MEMORY_DEFINITIONS,
        selectedMemory: complete
            ? MEMORY_BY_ID.get(record.selectedMemoryId)
            : null,
        companionInitiated: true,
        invitationStatus: 'not_offered',
        travelConsentRecorded: false,
        transmissionStatus: 'not_sent'
    };
}

export function formatCompanionEarthMemoryObjective(snapshot) {
    if (snapshot?.complete) {
        return 'Earth memory shared. No invitation or transmission was made.';
    }
    if (snapshot?.ready) {
        return 'Return to Wanderer-77. Your companion has an Earth question.';
    }
    return 'Complete the Fend recovery chapter before comparing your two worlds.';
}

export function shareCompanionEarthMemory(gameState, memoryId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const memory = MEMORY_BY_ID.get(memoryId);
    const snapshot = getCompanionEarthMemorySnapshot(gameState);
    if (!memory) {
        return {
            changed: false,
            reason: 'unknown_memory',
            snapshot
        };
    }
    if (!snapshot.unlocked) {
        return {
            changed: false,
            reason: 'requirements_missing',
            memory,
            snapshot
        };
    }
    if (snapshot.complete) {
        return {
            changed: false,
            reason: 'memory_already_shared',
            memory: snapshot.selectedMemory,
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `earth_memory:${snapshot.companionId}:${memory.id}`
    ) || `earth_memory:${snapshot.companionId}:${memory.id}`;
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const record = normalizeRecord({
        ...snapshot.record,
        selectedMemoryId: memory.id,
        sharedAt: timestamp,
        history: [
            ...snapshot.record.history,
            {
                operationId: normalizedOperationId,
                type: 'earth_memory_shared',
                memoryId: memory.id,
                occurredAt: timestamp
            }
        ]
    }, snapshot.companionId);
    const state = normalizeCompanionEarthMemoryState({
        ...snapshot.state,
        records: [
            ...snapshot.state.records.filter(
                entry => entry.companionId !== snapshot.companionId
            ),
            record
        ]
    }, { activeCompanionId: snapshot.companionId });

    gameState.set('story.projectBeacon.companionEarthMemory', state);
    if (save) gameState.save?.();
    gameState.emit?.('companionEarthMemoryChanged', {
        type: 'earth_memory_shared',
        companionId: snapshot.companionId,
        memoryId: memory.id,
        invitationStatus: 'not_offered',
        travelConsentRecorded: false,
        transmissionStatus: 'not_sent',
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: 'earth_memory_shared',
        memory,
        record,
        state,
        snapshot: getCompanionEarthMemorySnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.CompanionEarthMemory = {
        COMPANION_EARTH_MEMORY_SCHEMA_VERSION,
        EARTH_MEMORY_DEFINITIONS,
        normalizeCompanionEarthMemoryState,
        getCompanionEarthMemorySnapshot,
        formatCompanionEarthMemoryObjective,
        shareCompanionEarthMemory
    };
}
