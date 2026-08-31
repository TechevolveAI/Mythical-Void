import { getCompanionConsentSnapshot } from './CompanionConsent.js';
import { getFendCultureSnapshot } from './FendCulture.js';
import { getShipEvidenceSnapshot } from './ShipEvidence.js';

export const PROTECTED_RETURN_SCHEMA_VERSION = 1;

export const PROTECTED_RETURN_STEPS = Object.freeze([
    Object.freeze({
        id: 'survival_packet',
        order: 1,
        label: 'SURVIVAL PROOF',
        title: 'ISOLATE SURVIVAL PROOF',
        summary:
            'Copy crash and survival telemetry into a report packet that contains no destination record.',
        appliedSummary:
            'Black-box survival proof is isolated from every living-world finding.'
    }),
    Object.freeze({
        id: 'route_quarantine',
        order: 2,
        label: 'ROUTE FIREWALL',
        title: 'QUARANTINE THE RETURN VECTOR',
        summary:
            'Move the Fend route behind an offline navigation seal that the report packet cannot read.',
        appliedSummary:
            'The return vector remains usable inside Wanderer-77 and absent from the report.'
    }),
    Object.freeze({
        id: 'living_witness_seal',
        order: 3,
        label: 'LIVING WITNESS',
        title: 'SEAL LIVING-WORLD EVIDENCE',
        summary:
            'Apply the companion-reviewed boundary: survival may be proved, but no life is offered as evidence.',
        appliedSummary:
            'Companion identity, the Current, extreme power, and Fend locations are protected findings.'
    }),
    Object.freeze({
        id: 'uplink_hold',
        order: 4,
        label: 'UPLINK HOLD',
        title: 'HOLD THE TRANSMISSION KEY',
        summary:
            'Record the First Listening and remove automatic uplink authority from the prepared packet.',
        appliedSummary:
            'The packet is sealed and usable later, but no message has left the Fend.'
    })
]);

const STEP_BY_ID = new Map(
    PROTECTED_RETURN_STEPS.map(step => [step.id, step])
);
const MAX_HISTORY = PROTECTED_RETURN_STEPS.length;

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
        const stepId = STEP_BY_ID.has(entry?.stepId)
            ? entry.stepId
            : null;
        if (
            !operationId ||
            !stepId ||
            seenOperations.has(operationId)
        ) {
            return null;
        }
        seenOperations.add(operationId);
        return {
            operationId,
            type: 'return_safeguard_applied',
            stepId,
            companionId: normalizeIdentifier(entry?.companionId),
            occurredAt: normalizeTimestamp(entry?.occurredAt)
        };
    }).filter(Boolean).slice(-MAX_HISTORY);
}

export function createInitialProtectedReturnState() {
    return {
        schemaVersion: PROTECTED_RETURN_SCHEMA_VERSION,
        completedStepIds: [],
        packetStatus: 'not_prepared',
        transmissionStatus: 'not_sent',
        firstAppliedAt: null,
        completedAt: null,
        history: []
    };
}

export function normalizeProtectedReturnState(value = {}) {
    const history = normalizeHistory(value?.history);
    const completed = new Set(
        Array.isArray(value?.completedStepIds)
            ? value.completedStepIds.filter(id => STEP_BY_ID.has(id))
            : []
    );
    history.forEach(entry => completed.add(entry.stepId));
    const completedStepIds = [];
    for (const step of PROTECTED_RETURN_STEPS) {
        if (!completed.has(step.id)) break;
        completedStepIds.push(step.id);
    }
    const complete =
        completedStepIds.length === PROTECTED_RETURN_STEPS.length;

    return {
        schemaVersion: PROTECTED_RETURN_SCHEMA_VERSION,
        completedStepIds,
        packetStatus: complete
            ? 'sealed_ready_not_sent'
            : completedStepIds.length > 0
                ? 'safeguards_in_progress'
                : 'not_prepared',
        transmissionStatus: 'not_sent',
        firstAppliedAt:
            normalizeTimestamp(value?.firstAppliedAt)
            || history[0]?.occurredAt
            || null,
        completedAt: complete
            ? (
                normalizeTimestamp(value?.completedAt)
                || history.find(
                    entry => entry.stepId === 'uplink_hold'
                )?.occurredAt
                || null
            )
            : null,
        history
    };
}

function getStepRequirement(stepId, context) {
    if (stepId === 'survival_packet') {
        return context.ship.complete &&
            context.ship.capabilities.blackBoxProof === 'recovered'
            ? null
            : 'Complete the ship archive and recover black-box proof.';
    }
    if (stepId === 'route_quarantine') {
        return context.ship.capabilities.secureReturnVector === 'sealed'
            ? null
            : 'Restore and seal Wanderer-77\'s return vector.';
    }
    if (stepId === 'living_witness_seal') {
        return Boolean(
            context.consent.complete &&
            context.consent.record.locationBoundary ===
                'coordinates_withheld' &&
            context.consent.record.disclosureStatus ===
                'astronaut_survival_only'
        )
            ? null
            : 'Review route, evidence, and power boundaries with the active companion.';
    }
    if (stepId === 'uplink_hold') {
        return context.culture.complete
            ? null
            : 'Complete the First Listening before holding the Fend\'s shared warning channel.';
    }
    return 'Unknown safeguard.';
}

export function getProtectedReturnSnapshot(gameState) {
    const state = normalizeProtectedReturnState(
        gameState?.get?.(
            'story.projectBeacon.protectedReturnProtocol'
        ) || {}
    );
    const ship = getShipEvidenceSnapshot(gameState);
    const consent = getCompanionConsentSnapshot(gameState);
    const culture = getFendCultureSnapshot(gameState);
    const context = { ship, consent, culture };
    const available = ship.complete;
    const completedCount = state.completedStepIds.length;
    const complete = completedCount === PROTECTED_RETURN_STEPS.length;
    const nextDefinition = PROTECTED_RETURN_STEPS[completedCount] || null;
    const requirement = nextDefinition
        ? getStepRequirement(nextDefinition.id, context)
        : null;
    const steps = PROTECTED_RETURN_STEPS.map((step, index) => {
        const applied = state.completedStepIds.includes(step.id);
        const isNext = index === completedCount;
        const stepRequirement = applied
            ? null
            : getStepRequirement(step.id, context);
        return {
            ...step,
            applied,
            ready: available && isNext && !stepRequirement,
            status: applied
                ? 'applied'
                : available && isNext && !stepRequirement
                    ? 'ready'
                    : 'locked',
            requirement: stepRequirement
        };
    });

    return {
        state,
        available,
        ready: available && !complete && !requirement,
        complete,
        completedCount,
        totalSteps: PROTECTED_RETURN_STEPS.length,
        nextStep: nextDefinition
            ? steps.find(step => step.id === nextDefinition.id)
            : null,
        steps,
        packet: {
            status: state.packetStatus,
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
        },
        companionId: getActiveCompanionId(gameState),
        ship,
        consent,
        culture
    };
}

export function formatProtectedReturnObjective(snapshot) {
    if (snapshot?.complete) {
        return 'Protected return packet sealed. No transmission sent.';
    }
    if (snapshot?.ready && snapshot.nextStep) {
        return `Apply ${snapshot.nextStep.label}: ${snapshot.completedCount}/${snapshot.totalSteps} safeguards.`;
    }
    if (snapshot?.available && snapshot.nextStep?.requirement) {
        return snapshot.nextStep.requirement;
    }
    return 'Complete the Wanderer-77 ship archive.';
}

export function applyProtectedReturnStep(gameState, stepId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const step = STEP_BY_ID.get(stepId);
    const snapshot = getProtectedReturnSnapshot(gameState);
    if (!step) {
        return {
            changed: false,
            reason: 'unknown_step',
            snapshot
        };
    }
    if (!snapshot.available) {
        return {
            changed: false,
            reason: 'archive_required',
            step,
            snapshot
        };
    }
    if (snapshot.state.completedStepIds.includes(step.id)) {
        return {
            changed: false,
            reason: 'already_applied',
            step,
            snapshot
        };
    }
    if (snapshot.nextStep?.id !== step.id) {
        return {
            changed: false,
            reason: 'prior_step_required',
            step,
            snapshot
        };
    }
    if (!snapshot.ready) {
        return {
            changed: false,
            reason: 'requirements_missing',
            step,
            snapshot
        };
    }

    const companionId = snapshot.companionId;
    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `protected_return:${companionId}:${step.id}`
    );
    if (
        !normalizedOperationId ||
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            step,
            snapshot
        };
    }
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const nextState = normalizeProtectedReturnState({
        ...snapshot.state,
        completedStepIds: [
            ...snapshot.state.completedStepIds,
            step.id
        ],
        firstAppliedAt:
            snapshot.state.firstAppliedAt || timestamp,
        completedAt: step.id === 'uplink_hold'
            ? timestamp
            : null,
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'return_safeguard_applied',
                stepId: step.id,
                companionId,
                occurredAt: timestamp
            }
        ]
    });
    gameState.set(
        'story.projectBeacon.protectedReturnProtocol',
        nextState
    );
    if (save) gameState.save?.();
    gameState.emit?.('protectedReturnChanged', {
        type: 'return_safeguard_applied',
        stepId: step.id,
        complete:
            nextState.completedStepIds.length ===
                PROTECTED_RETURN_STEPS.length,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: step.id === 'uplink_hold'
            ? 'protocol_complete'
            : 'safeguard_applied',
        step,
        state: nextState,
        snapshot: getProtectedReturnSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.ProtectedReturnProtocol = {
        PROTECTED_RETURN_SCHEMA_VERSION,
        PROTECTED_RETURN_STEPS,
        createInitialProtectedReturnState,
        normalizeProtectedReturnState,
        getProtectedReturnSnapshot,
        formatProtectedReturnObjective,
        applyProtectedReturnStep
    };
}
