import { getFendCultureSnapshot } from './FendCulture.js';
import { getFendResidentsSnapshot } from './FendResidents.js';
import { getProtectedReturnSnapshot } from './ProtectedReturnProtocol.js';

export const CURRENT_VEIL_SCHEMA_VERSION = 1;

export const CURRENT_VEIL_ANCHORS = Object.freeze([
    Object.freeze({
        id: 'root_echo',
        order: 1,
        label: 'ROOT ECHO',
        title: 'TRAILHEAD ROOT',
        summary:
            'Match the companion pulse to the oldest trail root so the route rhythm cannot be isolated.',
        stabilizedSummary:
            'The trail root now answers as part of the whole Fend.',
        color: 0xD94B4B,
        accent: 0xF4F4F4,
        positionOffset: Object.freeze({ x: 270, y: -190 })
    }),
    Object.freeze({
        id: 'well_echo',
        order: 2,
        label: 'WELL ECHO',
        title: 'RETURN WELL',
        summary:
            'Return the ship-timing echo through the well instead of allowing it to point back to one source.',
        stabilizedSummary:
            'The well carries the timing echo outward without revealing an origin.',
        color: 0x3FAE62,
        accent: 0x101616,
        positionOffset: Object.freeze({ x: 315, y: 40 })
    }),
    Object.freeze({
        id: 'relay_echo',
        order: 3,
        label: 'RELAY ECHO',
        title: 'THREE-VOICE RELAY',
        summary:
            'Blend the final route signature into the warning relay while preserving every settlement voice.',
        stabilizedSummary:
            'The relay carries a shared warning pattern, not a recoverable route.',
        color: 0xF4F4F4,
        accent: 0x3FAE62,
        positionOffset: Object.freeze({ x: 80, y: 180 })
    })
]);

const ANCHOR_BY_ID = new Map(
    CURRENT_VEIL_ANCHORS.map(anchor => [anchor.id, anchor])
);
const MAX_HISTORY = 12;

function normalizeIdentifier(value, fallback = null, maxLength = 120) {
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
    const seenOperations = new Set();
    return value.map(entry => {
        const operationId = normalizeIdentifier(entry?.operationId);
        const type = [
            'mission_started',
            'anchor_stabilized',
            'packet_verified'
        ].includes(entry?.type)
            ? entry.type
            : null;
        const anchorId = entry?.type === 'anchor_stabilized'
            && ANCHOR_BY_ID.has(entry?.anchorId)
            ? entry.anchorId
            : null;
        if (
            !operationId ||
            !type ||
            (type === 'anchor_stabilized' && !anchorId) ||
            seenOperations.has(operationId)
        ) {
            return null;
        }
        seenOperations.add(operationId);
        return {
            operationId,
            type,
            anchorId,
            companionId: normalizeIdentifier(entry?.companionId),
            occurredAt: normalizeTimestamp(entry?.occurredAt)
        };
    }).filter(Boolean).slice(-MAX_HISTORY);
}

export function createInitialCurrentVeilState() {
    return {
        schemaVersion: CURRENT_VEIL_SCHEMA_VERSION,
        status: 'not_started',
        stabilizedAnchorIds: [],
        maskStatus: 'inactive',
        transmissionStatus: 'not_sent',
        startedAt: null,
        completedAt: null,
        history: []
    };
}

export function normalizeCurrentVeilState(value = {}) {
    const history = normalizeHistory(value?.history);
    const stabilized = new Set(
        Array.isArray(value?.stabilizedAnchorIds)
            ? value.stabilizedAnchorIds.filter(id => ANCHOR_BY_ID.has(id))
            : []
    );
    history
        .filter(entry => entry.type === 'anchor_stabilized')
        .forEach(entry => stabilized.add(entry.anchorId));
    const stabilizedAnchorIds = CURRENT_VEIL_ANCHORS
        .map(anchor => anchor.id)
        .filter(id => stabilized.has(id));
    const started = [
        'active',
        'verification_ready',
        'complete'
    ].includes(value?.status)
        || history.some(entry => entry.type === 'mission_started')
        || stabilizedAnchorIds.length > 0;
    const verified = value?.status === 'complete'
        || history.some(entry => entry.type === 'packet_verified');
    const allAnchors =
        stabilizedAnchorIds.length === CURRENT_VEIL_ANCHORS.length;
    const status = verified && allAnchors
        ? 'complete'
        : allAnchors
            ? 'verification_ready'
            : started
                ? 'active'
                : 'not_started';

    return {
        schemaVersion: CURRENT_VEIL_SCHEMA_VERSION,
        status,
        stabilizedAnchorIds,
        maskStatus: status === 'complete'
            ? 'verified'
            : status === 'verification_ready'
                ? 'ready_for_verification'
                : status === 'active'
                    ? 'aligning'
                    : 'inactive',
        transmissionStatus: 'not_sent',
        startedAt:
            normalizeTimestamp(value?.startedAt)
            || history.find(
                entry => entry.type === 'mission_started'
            )?.occurredAt
            || null,
        completedAt: status === 'complete'
            ? (
                normalizeTimestamp(value?.completedAt)
                || history.find(
                    entry => entry.type === 'packet_verified'
                )?.occurredAt
                || null
            )
            : null,
        history
    };
}

export function getCurrentVeilSnapshot(gameState) {
    const state = normalizeCurrentVeilState(
        gameState?.get?.('world.currentVeilMission') || {}
    );
    const protocol = getProtectedReturnSnapshot(gameState);
    const culture = getFendCultureSnapshot(gameState);
    const residents = getFendResidentsSnapshot(gameState);
    const prerequisitesMet =
        protocol.complete &&
        culture.complete &&
        residents.complete;
    const anchors = CURRENT_VEIL_ANCHORS.map(anchor => {
        const stabilized = state.stabilizedAnchorIds.includes(anchor.id);
        return {
            ...anchor,
            stabilized,
            status: stabilized
                ? 'stabilized'
                : state.status === 'active'
                    ? 'ready'
                    : 'locked'
        };
    });
    const nextAnchor = anchors.find(anchor => !anchor.stabilized) || null;

    return {
        state,
        protocol,
        culture,
        residents,
        prerequisitesMet,
        available: prerequisitesMet && state.status === 'not_started',
        active: state.status === 'active',
        verificationReady: state.status === 'verification_ready',
        complete: state.status === 'complete',
        stabilizedCount: state.stabilizedAnchorIds.length,
        totalAnchors: CURRENT_VEIL_ANCHORS.length,
        anchors,
        nextAnchor,
        companionId: getActiveCompanionId(gameState),
        packet: {
            survivalProofStatus: 'preserved',
            routeInferenceStatus: state.status === 'complete'
                ? 'blocked'
                : state.status === 'verification_ready'
                    ? 'mask_ready'
                    : state.status === 'active'
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
}

export function formatCurrentVeilObjective(snapshot) {
    if (snapshot?.complete) {
        return 'Route inference blocked. Survival proof preserved. No transmission sent.';
    }
    if (snapshot?.verificationReady) {
        return 'Return to Wanderer-77 and verify the masked survival packet.';
    }
    if (snapshot?.active && snapshot.nextAnchor) {
        return `Stabilize ${snapshot.nextAnchor.title}: ${snapshot.stabilizedCount}/${snapshot.totalAnchors} anchors.`;
    }
    if (snapshot?.available) {
        return 'Speak with Ilyra at the Fend Commons about the Current echo.';
    }
    return 'Seal the Protected Return Protocol with the Fend.';
}

function createHistoryEntry(snapshot, type, {
    anchorId = null,
    occurredAt,
    operationId
}) {
    const defaultOperationId = anchorId
        ? `current_veil:${snapshot.companionId}:${anchorId}`
        : `current_veil:${snapshot.companionId}:${type}`;
    return {
        operationId: normalizeIdentifier(
            operationId || defaultOperationId
        ),
        type,
        anchorId,
        companionId: snapshot.companionId,
        occurredAt: normalizeTimestamp(occurredAt)
            || new Date().toISOString()
    };
}

function commitState(gameState, value, event, save) {
    const state = normalizeCurrentVeilState(value);
    gameState.set('world.currentVeilMission', state);
    if (save) gameState.save?.();
    gameState.emit?.('currentVeilChanged', event);
    return state;
}

export function startCurrentVeilMission(gameState, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getCurrentVeilSnapshot(gameState);
    if (!snapshot.prerequisitesMet) {
        return {
            changed: false,
            reason: 'prerequisites_missing',
            snapshot
        };
    }
    if (snapshot.state.status !== 'not_started') {
        return {
            changed: false,
            reason: 'already_started',
            snapshot
        };
    }
    const entry = createHistoryEntry(snapshot, 'mission_started', {
        occurredAt,
        operationId
    });
    if (!entry.operationId) {
        return {
            changed: false,
            reason: 'invalid_operation',
            snapshot
        };
    }
    const state = commitState(gameState, {
        ...snapshot.state,
        status: 'active',
        startedAt: entry.occurredAt,
        history: [...snapshot.state.history, entry]
    }, {
        type: 'mission_started',
        occurredAt: entry.occurredAt
    }, save);
    return {
        changed: true,
        reason: 'mission_started',
        state,
        snapshot: getCurrentVeilSnapshot(gameState)
    };
}

export function stabilizeCurrentVeilAnchor(gameState, anchorId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const anchor = ANCHOR_BY_ID.get(anchorId);
    const snapshot = getCurrentVeilSnapshot(gameState);
    if (!anchor) {
        return {
            changed: false,
            reason: 'unknown_anchor',
            snapshot
        };
    }
    if (!snapshot.active) {
        return {
            changed: false,
            reason: snapshot.complete
                ? 'mission_complete'
                : 'mission_not_active',
            anchor,
            snapshot
        };
    }
    if (snapshot.state.stabilizedAnchorIds.includes(anchor.id)) {
        return {
            changed: false,
            reason: 'anchor_stabilized',
            anchor,
            snapshot
        };
    }
    const entry = createHistoryEntry(snapshot, 'anchor_stabilized', {
        anchorId: anchor.id,
        occurredAt,
        operationId
    });
    if (
        !entry.operationId ||
        snapshot.state.history.some(
            item => item.operationId === entry.operationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            anchor,
            snapshot
        };
    }
    const state = commitState(gameState, {
        ...snapshot.state,
        stabilizedAnchorIds: [
            ...snapshot.state.stabilizedAnchorIds,
            anchor.id
        ],
        history: [...snapshot.state.history, entry]
    }, {
        type: 'anchor_stabilized',
        anchorId: anchor.id,
        occurredAt: entry.occurredAt
    }, save);
    return {
        changed: true,
        reason: state.status === 'verification_ready'
            ? 'verification_ready'
            : 'anchor_stabilized',
        anchor,
        state,
        snapshot: getCurrentVeilSnapshot(gameState)
    };
}

export function verifyCurrentVeilPacket(gameState, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getCurrentVeilSnapshot(gameState);
    if (snapshot.complete) {
        return {
            changed: false,
            reason: 'mission_complete',
            snapshot
        };
    }
    if (!snapshot.verificationReady || !snapshot.protocol.complete) {
        return {
            changed: false,
            reason: 'anchors_required',
            snapshot
        };
    }
    const entry = createHistoryEntry(snapshot, 'packet_verified', {
        occurredAt,
        operationId
    });
    if (
        !entry.operationId ||
        snapshot.state.history.some(
            item => item.operationId === entry.operationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            snapshot
        };
    }
    const state = commitState(gameState, {
        ...snapshot.state,
        status: 'complete',
        completedAt: entry.occurredAt,
        history: [...snapshot.state.history, entry]
    }, {
        type: 'packet_verified',
        transmissionStatus: 'not_sent',
        occurredAt: entry.occurredAt
    }, save);
    return {
        changed: true,
        reason: 'mission_complete',
        state,
        snapshot: getCurrentVeilSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.CurrentVeilMission = {
        CURRENT_VEIL_SCHEMA_VERSION,
        CURRENT_VEIL_ANCHORS,
        createInitialCurrentVeilState,
        normalizeCurrentVeilState,
        getCurrentVeilSnapshot,
        formatCurrentVeilObjective,
        startCurrentVeilMission,
        stabilizeCurrentVeilAnchor,
        verifyCurrentVeilPacket
    };
}
