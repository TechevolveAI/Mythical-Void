import { getFendCommunityEvidence, getFendCommunitySnapshot } from './FendCommunity.js';

export const FEND_RESIDENTS_SCHEMA_VERSION = 1;

export const FEND_RESIDENT_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'kiri',
        name: 'Kiri',
        role: 'Trailkeeper',
        projectId: 'trailhead_shelter',
        color: 0xD94B4B,
        accent: 0xF4F4F4,
        introduction:
            'The restored path carried us here. A shelter is only safe if the Current can still pass through it.',
        request: Object.freeze({
            id: 'shelter_calibration',
            title: 'Shelter Calibration',
            briefing:
                'Tune the shelter anchors while your companion checks the living roots beneath them.',
            objective: 'Tend the Memory Garden once after speaking with Kiri.',
            actionLine: 'Human instruments above. Creature senses below. Neither works alone.',
            completionLine:
                'The anchors are steady and the roots are still breathing. This can be a refuge.',
            evidence: Object.freeze({
                key: 'gardenTends',
                mode: 'delta',
                target: 1
            })
        })
    }),
    Object.freeze({
        id: 'mara',
        name: 'Mara',
        role: 'Current Listener',
        projectId: 'current_well',
        color: 0x3FAE62,
        accent: 0x8FE3CF,
        introduction:
            'A well should return what it cannot hold. Your machines call this energy. We call it movement.',
        request: Object.freeze({
            id: 'well_return_flow',
            title: 'Return Flow',
            briefing:
                'Choose one more act of care in the damaged network while your companion guides the released Current home.',
            objective: 'Complete one new care action in a Current restoration region.',
            actionLine: 'Repair the channel. Let your companion choose how the Current returns.',
            completionLine:
                'The flow came back quieter than it left. That is how we know it was returned, not taken.',
            evidence: Object.freeze({
                key: 'careActions',
                mode: 'delta',
                target: 1
            })
        })
    }),
    Object.freeze({
        id: 'tovan',
        name: 'Tovan',
        role: 'Wayfinder',
        projectId: 'wayfinder_relay',
        color: 0x101616,
        accent: 0xF2C14E,
        introduction:
            'Three clues, three warnings, one route. Your crash made noise. Listening is how we answer it.',
        request: Object.freeze({
            id: 'relay_three_signals',
            title: 'Three-Voice Relay',
            briefing:
                'Bring all three signs-of-life patterns to the relay so no settlement has to cross the Fend blind.',
            objective: 'Observe all three signs of life, then return to Tovan.',
            actionLine: 'Your field receiver aligns the pattern. Your companion translates the living response.',
            completionLine:
                'The relay carries warnings, not orders. Any settlement can answer, and any settlement can refuse.',
            evidence: Object.freeze({
                key: 'observedSignals',
                mode: 'total',
                target: 3
            })
        })
    }),
    Object.freeze({
        id: 'ilyra',
        name: 'Ilyra',
        role: 'Commons Keeper',
        projectId: 'living_commons',
        color: 0xF4F4F4,
        accent: 0x71E6B1,
        introduction:
            'A commons is not one voice made louder. It is a place where every voice can survive disagreement.',
        request: Object.freeze({
            id: 'commons_witness',
            title: 'Held Coordinates',
            briefing:
                'Confirm that Wanderer-77 still holds the Fend coordinates after the network witnessed your companion’s full power.',
            objective: 'Keep the uplink held and the Fend coordinates protected.',
            actionLine: 'The astronaut secures the channel. The companion stands as a citizen, not a sample.',
            completionLine:
                'Then Earth has not been rejected. Contact has been delayed until both worlds can meet without ownership.',
            evidence: Object.freeze({
                key: 'commonsReady',
                mode: 'boolean',
                target: true
            })
        })
    })
]);

const RESIDENT_BY_ID = new Map(
    FEND_RESIDENT_DEFINITIONS.map(resident => [resident.id, resident])
);
const REQUEST_BY_ID = new Map(
    FEND_RESIDENT_DEFINITIONS.map(resident => [resident.request.id, resident])
);
const MAX_HISTORY = 24;

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

function orderedKnownIds(value, definitions, idSelector) {
    const requested = new Set(Array.isArray(value) ? value : []);
    return definitions
        .map(idSelector)
        .filter(id => requested.has(id));
}

function normalizeEvidence(value = {}) {
    return {
        gardenTends: Math.max(0, Number(value?.gardenTends) || 0),
        careActions: Math.max(0, Number(value?.careActions) || 0),
        observedSignals: Math.max(0, Number(value?.observedSignals) || 0),
        highPowerRescues: Math.max(0, Number(value?.highPowerRescues) || 0),
        uplinkRestored: value?.uplinkRestored === true,
        commonsReady: value?.commonsReady === true
    };
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const operationId = normalizeIdentifier(entry?.operationId);
            const residentId = RESIDENT_BY_ID.has(entry?.residentId)
                ? entry.residentId
                : null;
            const requestId = REQUEST_BY_ID.has(entry?.requestId)
                ? entry.requestId
                : null;
            const type = ['request_accepted', 'request_completed'].includes(entry?.type)
                ? entry.type
                : null;
            if (
                !operationId ||
                !residentId ||
                !requestId ||
                !type ||
                seen.has(operationId)
            ) {
                return null;
            }
            seen.add(operationId);
            return {
                operationId,
                type,
                residentId,
                requestId,
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

export function normalizeFendResidentState(state = {}, communityStage = 0) {
    const availableDefinitions = FEND_RESIDENT_DEFINITIONS.slice(
        0,
        Math.max(0, Math.min(
            FEND_RESIDENT_DEFINITIONS.length,
            Math.floor(Number(communityStage) || 0)
        ))
    );
    const availableResidentIds = new Set(
        availableDefinitions.map(resident => resident.id)
    );
    const availableRequestIds = new Set(
        availableDefinitions.map(resident => resident.request.id)
    );
    const metResidentIds = orderedKnownIds(
        state?.metResidentIds,
        availableDefinitions,
        resident => resident.id
    );
    const completedRequestIds = orderedKnownIds(
        state?.completedRequestIds,
        availableDefinitions,
        resident => resident.request.id
    );
    const completedSet = new Set(completedRequestIds);
    const activeRequestId =
        availableRequestIds.has(state?.activeRequestId) &&
        !completedSet.has(state.activeRequestId)
            ? state.activeRequestId
            : null;
    const activeResident = activeRequestId
        ? REQUEST_BY_ID.get(activeRequestId)
        : null;
    const history = normalizeHistory(state?.history)
        .filter(entry => (
            availableResidentIds.has(entry.residentId) &&
            availableRequestIds.has(entry.requestId)
        ));

    return {
        schemaVersion: FEND_RESIDENTS_SCHEMA_VERSION,
        metResidentIds,
        activeRequestId,
        activeRequestBaseline: activeRequestId
            ? normalizeEvidence(state?.activeRequestBaseline)
            : null,
        completedRequestIds,
        history,
        firstMetAt: normalizeTimestamp(state?.firstMetAt)
            || history[0]?.occurredAt
            || null,
        lastInteractionAt: normalizeTimestamp(state?.lastInteractionAt)
            || history[history.length - 1]?.occurredAt
            || null,
        activeResidentId: activeResident?.id || null
    };
}

export function getFendResidentEvidence(gameState) {
    const communityEvidence = getFendCommunityEvidence(gameState);
    return {
        ...communityEvidence,
        commonsReady:
            communityEvidence.highPowerRescues >= 1 &&
            communityEvidence.uplinkRestored === true
    };
}

function isRequestReady(request, evidence, baseline) {
    const requirement = request?.evidence;
    if (!requirement) return false;
    if (requirement.mode === 'boolean') {
        return evidence[requirement.key] === requirement.target;
    }
    if (requirement.mode === 'total') {
        return Number(evidence[requirement.key]) >= Number(requirement.target);
    }
    if (requirement.mode === 'delta') {
        return (
            Number(evidence[requirement.key]) -
            Number(baseline?.[requirement.key] || 0)
        ) >= Number(requirement.target);
    }
    return false;
}

function getResidentStatus(resident, state, evidence) {
    const completed = state.completedRequestIds.includes(resident.request.id);
    const active = state.activeRequestId === resident.request.id;
    return {
        met: state.metResidentIds.includes(resident.id),
        completed,
        active,
        ready: active && isRequestReady(
            resident.request,
            evidence,
            state.activeRequestBaseline
        ),
        status: completed
            ? 'completed'
            : active
                ? (
                    isRequestReady(
                        resident.request,
                        evidence,
                        state.activeRequestBaseline
                    )
                        ? 'ready'
                        : 'active'
                )
                : 'available'
    };
}

export function getFendResidentsSnapshot(gameState) {
    const community = getFendCommunitySnapshot(gameState);
    const state = normalizeFendResidentState(
        gameState?.get?.('world.fendResidents') || {},
        community.stage
    );
    const evidence = getFendResidentEvidence(gameState);
    const residents = FEND_RESIDENT_DEFINITIONS.map((resident, index) => ({
        ...resident,
        available: index < community.stage,
        ...(
            index < community.stage
                ? getResidentStatus(resident, state, evidence)
                : {
                    met: false,
                    completed: false,
                    active: false,
                    ready: false,
                    status: 'locked'
                }
        )
    }));
    const activeResident = residents.find(resident => resident.active) || null;
    const nextResident = activeResident || residents.find(
        resident => resident.available && !resident.completed
    ) || null;

    return {
        state,
        community,
        evidence,
        residents,
        availableResidents: residents.filter(resident => resident.available),
        activeResident,
        nextResident,
        metCount: state.metResidentIds.length,
        completedCount: state.completedRequestIds.length,
        totalResidents: FEND_RESIDENT_DEFINITIONS.length,
        complete:
            state.completedRequestIds.length === FEND_RESIDENT_DEFINITIONS.length
    };
}

export function formatFendResidentObjective(snapshot) {
    const resident = snapshot?.activeResident || snapshot?.nextResident;
    if (!resident) {
        return snapshot?.complete
            ? 'The Fend Commons remembers what you built together.'
            : 'Complete the next Fend community project.';
    }
    if (resident.completed) {
        return `${resident.name} // ${resident.request.title} complete.`;
    }
    if (!resident.active) {
        return `Speak with ${resident.name}, ${resident.role}.`;
    }
    if (resident.ready) {
        return `Return to ${resident.name} // ${resident.request.title} ready.`;
    }
    return resident.request.objective;
}

export function interactWithFendResident(gameState, residentId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set || !RESIDENT_BY_ID.has(residentId)) {
        return null;
    }

    const snapshot = getFendResidentsSnapshot(gameState);
    const resident = snapshot.residents.find(entry => entry.id === residentId);
    if (!resident?.available) {
        return {
            changed: false,
            reason: 'resident_locked',
            resident,
            snapshot
        };
    }
    if (
        snapshot.activeResident &&
        snapshot.activeResident.id !== resident.id
    ) {
        return {
            changed: false,
            reason: 'other_request_active',
            resident,
            activeResident: snapshot.activeResident,
            snapshot
        };
    }
    if (resident.completed) {
        return {
            changed: false,
            reason: 'request_completed',
            resident,
            snapshot
        };
    }

    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const phase = resident.active ? 'complete' : 'accept';
    const normalizedOperationId = normalizeIdentifier(
        operationId || `resident:${resident.id}:${phase}`
    );
    if (
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            resident,
            snapshot
        };
    }

    if (!resident.active) {
        const state = normalizeFendResidentState({
            ...snapshot.state,
            metResidentIds: [
                ...snapshot.state.metResidentIds,
                resident.id
            ],
            activeRequestId: resident.request.id,
            activeRequestBaseline: snapshot.evidence,
            history: [
                ...snapshot.state.history,
                {
                    operationId: normalizedOperationId,
                    type: 'request_accepted',
                    residentId: resident.id,
                    requestId: resident.request.id,
                    occurredAt: timestamp
                }
            ],
            firstMetAt: snapshot.state.firstMetAt || timestamp,
            lastInteractionAt: timestamp
        }, snapshot.community.stage);
        gameState.set('world.fendResidents', state);
        if (save) gameState.save?.();
        gameState.emit?.('fendResidentChanged', {
            type: 'request_accepted',
            residentId: resident.id,
            requestId: resident.request.id,
            occurredAt: timestamp
        });
        return {
            changed: true,
            reason: 'request_accepted',
            resident,
            state,
            snapshot: getFendResidentsSnapshot(gameState)
        };
    }

    if (!resident.ready) {
        return {
            changed: false,
            reason: 'request_in_progress',
            resident,
            snapshot
        };
    }

    const state = normalizeFendResidentState({
        ...snapshot.state,
        activeRequestId: null,
        activeRequestBaseline: null,
        completedRequestIds: [
            ...snapshot.state.completedRequestIds,
            resident.request.id
        ],
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'request_completed',
                residentId: resident.id,
                requestId: resident.request.id,
                occurredAt: timestamp
            }
        ],
        lastInteractionAt: timestamp
    }, snapshot.community.stage);
    gameState.set('world.fendResidents', state);
    if (save) gameState.save?.();
    gameState.emit?.('fendResidentChanged', {
        type: 'request_completed',
        residentId: resident.id,
        requestId: resident.request.id,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: 'request_completed',
        resident,
        state,
        snapshot: getFendResidentsSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.FendResidents = {
        FEND_RESIDENTS_SCHEMA_VERSION,
        FEND_RESIDENT_DEFINITIONS,
        normalizeFendResidentState,
        getFendResidentEvidence,
        getFendResidentsSnapshot,
        formatFendResidentObjective,
        interactWithFendResident
    };
}
