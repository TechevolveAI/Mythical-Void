import { getFendCommunitySnapshot } from './FendCommunity.js';
import { getFendResidentsSnapshot } from './FendResidents.js';

export const FEND_CULTURE_SCHEMA_VERSION = 1;

export const FEND_COMMONS_PRIORITIES = Object.freeze([
    Object.freeze({
        id: 'refuge',
        residentId: 'kiri',
        label: 'OPEN MORE REFUGE',
        shortLabel: 'REFUGE FIRST',
        caseLine:
            'Kiri asks the Commons to make room for life displaced by the damaged Current.',
        decisionLine:
            'First, we open shelter. No frightened life should have to earn a safe night.',
        companionLine:
            'Your companion marks safe paths that instruments cannot see.'
    }),
    Object.freeze({
        id: 'restoration',
        residentId: 'mara',
        label: 'RETURN THE FLOW',
        shortLabel: 'RESTORATION FIRST',
        caseLine:
            'Mara asks the Commons to restore damaged habitats before another region falls silent.',
        decisionLine:
            'First, we return the flow. Repair begins where the living network is weakest.',
        companionLine:
            'Your companion listens for the quietest part of the Current.'
    }),
    Object.freeze({
        id: 'warning',
        residentId: 'tovan',
        label: 'EXTEND THE WARNING',
        shortLabel: 'WARNING FIRST',
        caseLine:
            'Tovan asks the Commons to carry warnings farther before the next fracture reaches a settlement.',
        decisionLine:
            'First, we extend the warning. Every settlement deserves time to choose its own response.',
        companionLine:
            'Your companion gives the relay a living voice that cannot be mistaken for an order.'
    })
]);

const PRIORITY_BY_ID = new Map(
    FEND_COMMONS_PRIORITIES.map(priority => [priority.id, priority])
);
const RESIDENT_RESPONSE = Object.freeze({
    kiri: Object.freeze({
        refuge:
            'The first shelter path is marked. The restoration crews and relay scouts still leave with us.',
        restoration:
            'Restore the ground first. I will keep the temporary shelters open while the work moves outward.',
        warning:
            'A warning buys time to find shelter. I will map refuge along every new relay path.'
    }),
    mara: Object.freeze({
        refuge:
            'Refuge comes first. I will tune each shelter so the Current can pass through without being trapped.',
        restoration:
            'The weakest channel has answered. We begin there, and we do not call the other needs lesser.',
        warning:
            'The relay will listen before it speaks. I will carry the damaged-water patterns into its warning.'
    }),
    tovan: Object.freeze({
        refuge:
            'The route now points toward refuge first. The warning network will guide displaced life there.',
        restoration:
            'The first route follows the damaged Current. No crew crosses blind, and no region is written off.',
        warning:
            'The warning belongs to every settlement. They may answer, refuse, or ask us to listen again.'
    }),
    ilyra: Object.freeze({
        refuge:
            'The Commons chose what begins first, not what matters alone. Refuge opens with every voice recorded.',
        restoration:
            'The Commons chose what begins first, not what matters alone. Restoration starts without silencing refuge or warning.',
        warning:
            'The Commons chose what begins first, not what matters alone. The warning carries consent, never command.'
    })
});

const MAX_HISTORY = 8;

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
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

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const operationId = normalizeIdentifier(entry?.operationId);
            const selectedPriority = PRIORITY_BY_ID.has(entry?.selectedPriority)
                ? entry.selectedPriority
                : null;
            if (!operationId || !selectedPriority || seen.has(operationId)) {
                return null;
            }
            seen.add(operationId);
            return {
                operationId,
                type: 'first_listening_completed',
                selectedPriority,
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

export function normalizeFendCultureState(state = {}) {
    const selectedPriority = PRIORITY_BY_ID.has(
        state?.firstListening?.selectedPriority
    )
        ? state.firstListening.selectedPriority
        : null;
    const operationId = selectedPriority
        ? normalizeIdentifier(state?.firstListening?.operationId)
        : null;
    const history = normalizeHistory(state?.history);

    return {
        schemaVersion: FEND_CULTURE_SCHEMA_VERSION,
        firstListening: {
            status: selectedPriority ? 'complete' : 'locked',
            heldAt: selectedPriority
                ? normalizeTimestamp(state?.firstListening?.heldAt)
                    || history[history.length - 1]?.occurredAt
                    || null
                : null,
            operationId,
            selectedPriority
        },
        history
    };
}

export function getFendCultureSnapshot(gameState) {
    const state = normalizeFendCultureState(
        gameState?.get?.('world.fendCulture') || {}
    );
    const community = getFendCommunitySnapshot(gameState);
    const residents = getFendResidentsSnapshot(gameState);
    const unlocked = community.complete && residents.complete;
    const complete = state.firstListening.status === 'complete';
    const selectedPriority = complete
        ? PRIORITY_BY_ID.get(state.firstListening.selectedPriority)
        : null;

    return {
        state: {
            ...state,
            firstListening: {
                ...state.firstListening,
                status: complete ? 'complete' : unlocked ? 'ready' : 'locked'
            }
        },
        unlocked,
        ready: unlocked && !complete,
        complete,
        selectedPriority,
        priorities: FEND_COMMONS_PRIORITIES,
        community,
        residents
    };
}

export function formatFendCultureObjective(snapshot) {
    if (snapshot?.complete && snapshot.selectedPriority) {
        return `The First Listening chose ${snapshot.selectedPriority.shortLabel}. The other work remains.`;
    }
    if (snapshot?.ready) {
        return 'The First Listening is ready at the Living Commons.';
    }
    return 'Complete the Living Commons and answer every resident request.';
}

export function getFendCultureResidentResponse(residentId, priorityId) {
    return RESIDENT_RESPONSE[residentId]?.[priorityId] || null;
}

export function recordFirstListeningDecision(gameState, priorityId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;

    const snapshot = getFendCultureSnapshot(gameState);
    const priority = PRIORITY_BY_ID.get(priorityId);
    if (!priority) {
        return {
            changed: false,
            reason: 'unknown_priority',
            snapshot
        };
    }
    if (snapshot.complete) {
        return {
            changed: false,
            reason: 'already_complete',
            priority: snapshot.selectedPriority,
            snapshot
        };
    }
    if (!snapshot.ready) {
        return {
            changed: false,
            reason: 'requirements_missing',
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(
        operationId || `fend:first_listening:${priority.id}`
    );
    if (
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            snapshot
        };
    }

    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const state = normalizeFendCultureState({
        firstListening: {
            status: 'complete',
            heldAt: timestamp,
            operationId: normalizedOperationId,
            selectedPriority: priority.id
        },
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'first_listening_completed',
                selectedPriority: priority.id,
                occurredAt: timestamp
            }
        ]
    });

    gameState.set('world.fendCulture', state);
    if (save) gameState.save?.();
    gameState.emit?.('fendCultureChanged', {
        type: 'first_listening_completed',
        selectedPriority: priority.id,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: 'first_listening_completed',
        priority,
        state,
        snapshot: getFendCultureSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.FendCulture = {
        FEND_CULTURE_SCHEMA_VERSION,
        FEND_COMMONS_PRIORITIES,
        normalizeFendCultureState,
        getFendCultureSnapshot,
        formatFendCultureObjective,
        getFendCultureResidentResponse,
        recordFirstListeningDecision
    };
}
