export const SHIP_RECONSTRUCTION_SCHEMA_VERSION = 1;
export const SHIP_FIELD_SUPPORT_SCHEMA_VERSION = 1;

export const SHIP_RECONSTRUCTION_STEPS = Object.freeze([
    Object.freeze({
        id: 'living_power_lattice',
        order: 1,
        partId: 'forest_core',
        partName: 'Forest Core',
        label: 'LIVING POWER LATTICE',
        summary: 'Seat the Forest Core without severing its bond to the Current.',
        installedSummary:
            'Cabin power and one protected berth are restored. The berth can service your companion after each expedition; travel support is still only a prototype.',
        capabilities: Object.freeze({
            passengerCapacity: 1,
            creatureLifeSupport: 'prototype_required'
        })
    }),
    Object.freeze({
        id: 'propulsion_control',
        order: 2,
        partId: 'crystal_core',
        partName: 'Crystal Core Engine',
        label: 'PROPULSION CONTROL',
        summary: 'Calibrate the crystal engine for controlled atmospheric flight.',
        installedSummary:
            'Manual landing control and local route modelling are available. No launch has been authorized.',
        capabilities: Object.freeze({
            manualLanding: 'available'
        })
    }),
    Object.freeze({
        id: 'sealed_return_vector',
        order: 3,
        partId: 'dimensional_drive',
        partName: 'Dimensional Drive',
        label: 'SEALED RETURN VECTOR',
        summary: 'Bind a survivable route inside the drive without transmitting it.',
        installedSummary:
            'A return vector exists only inside Wanderer-77. Fend coordinates remain sealed.',
        capabilities: Object.freeze({
            secureReturnVector: 'sealed'
        })
    }),
    Object.freeze({
        id: 'resonance_hull',
        order: 4,
        partId: 'hull_plating',
        partName: 'Resonance Hull Plating',
        label: 'RESONANCE HULL',
        summary: 'Fit living-world plating around the ship signature.',
        installedSummary:
            'Concealed descent is repaired, and the hull can now read local Current stress without taking a sample. No departure is scheduled.',
        capabilities: Object.freeze({
            stealthDescent: 'repaired'
        })
    }),
    Object.freeze({
        id: 'uplink_hold',
        order: 5,
        partId: 'aurora_reactor',
        partName: 'Aurora Reactor',
        label: 'UPLINK HOLD',
        summary: 'Power the Project Beacon antenna while keeping its signal physically held.',
        installedSummary:
            'Long-range contact remains physically held. Reactor power now supports a local stellar forecast without sending Fend coordinates.',
        capabilities: Object.freeze({
            longRangeUplink: 'held_exposure_risk'
        })
    }),
    Object.freeze({
        id: 'black_box_recovery',
        order: 6,
        partId: 'command_module',
        partName: 'Command Module',
        label: 'BLACK-BOX RECOVERY',
        summary: 'Recover crash and survival proof from the final command module.',
        installedSummary:
            'Wanderer-77 can prove the astronaut survived and verify its local diagnostic model without identifying the living world.',
        capabilities: Object.freeze({
            blackBoxProof: 'recovered'
        })
    })
]);

const STEP_BY_ID = new Map(
    SHIP_RECONSTRUCTION_STEPS.map(step => [step.id, step])
);
const MAX_HISTORY = 18;
const MAX_SUPPORT_HISTORY = 12;
const BERTH_ENERGY_RECOVERY = 50;
const BERTH_HEALTH_RECOVERY = 30;

const INITIAL_CAPABILITIES = Object.freeze({
    schemaVersion: 1,
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

function clampStat(value, fallback = 100) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
}

function getActiveCompanionId(gameState) {
    return normalizeIdentifier(
        getValue(gameState, 'creature.genes.id', null)
            || getValue(gameState, 'creature.id', null)
            || getValue(gameState, 'creature.name', null),
        'active_companion'
    );
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(entry => {
        const stepId = STEP_BY_ID.has(entry?.stepId)
            ? entry.stepId
            : null;
        const operationId = normalizeIdentifier(entry?.operationId);
        if (!stepId || !operationId || seen.has(operationId)) {
            return null;
        }
        seen.add(operationId);
        return {
            operationId,
            type: 'ship_system_installed',
            stepId,
            partId: STEP_BY_ID.get(stepId).partId,
            occurredAt: normalizeTimestamp(entry?.occurredAt)
        };
    }).filter(Boolean).slice(-MAX_HISTORY);
}

export function createInitialShipReconstructionState() {
    return {
        schemaVersion: SHIP_RECONSTRUCTION_SCHEMA_VERSION,
        completedStepIds: [],
        firstInstalledAt: null,
        completedAt: null,
        history: []
    };
}

export function createInitialShipFieldSupportState() {
    return {
        schemaVersion: SHIP_FIELD_SUPPORT_SCHEMA_VERSION,
        lastServicedLevel: 0,
        serviceCount: 0,
        lastServicedAt: null,
        history: []
    };
}

export function normalizeShipFieldSupportState(state = {}) {
    const seen = new Set();
    const history = (
        Array.isArray(state?.history) ? state.history : []
    ).map(entry => {
        const operationId = normalizeIdentifier(entry?.operationId);
        const companionId = normalizeIdentifier(entry?.companionId);
        const rawLevelMilestone = Math.floor(
            Number(entry?.levelMilestone) || 0
        );
        if (
            !operationId ||
            !companionId ||
            seen.has(operationId) ||
            rawLevelMilestone < 1
        ) {
            return null;
        }
        const levelMilestone = Math.min(999, rawLevelMilestone);
        seen.add(operationId);
        return {
            operationId,
            type: 'powered_berth_service',
            companionId,
            levelMilestone,
            energyRestored: Math.max(
                0,
                Math.min(
                    BERTH_ENERGY_RECOVERY,
                    Number(entry?.energyRestored) || 0
                )
            ),
            healthRestored: Math.max(
                0,
                Math.min(
                    BERTH_HEALTH_RECOVERY,
                    Number(entry?.healthRestored) || 0
                )
            ),
            occurredAt: normalizeTimestamp(entry?.occurredAt)
        };
    }).filter(Boolean).slice(-MAX_SUPPORT_HISTORY);
    const highestHistoryMilestone = history.reduce(
        (highest, entry) => Math.max(
            highest,
            entry.levelMilestone
        ),
        0
    );
    const lastServicedLevel = Math.max(
        highestHistoryMilestone,
        Math.max(
            0,
            Math.min(
                999,
                Math.floor(Number(state?.lastServicedLevel) || 0)
            )
        )
    );

    return {
        schemaVersion: SHIP_FIELD_SUPPORT_SCHEMA_VERSION,
        lastServicedLevel,
        serviceCount: Math.max(
            history.length,
            Math.max(
                0,
                Math.min(
                    999,
                    Math.floor(Number(state?.serviceCount) || 0)
                )
            )
        ),
        lastServicedAt:
            normalizeTimestamp(state?.lastServicedAt)
            || history[history.length - 1]?.occurredAt
            || null,
        history
    };
}

export function getShipFieldSupportSnapshot(
    gameState,
    reconstructionState = null
) {
    const reconstruction = normalizeShipReconstructionState(
        reconstructionState || getValue(
            gameState,
            'story.projectBeacon.shipReconstruction',
            {}
        )
    );
    const state = normalizeShipFieldSupportState(
        getValue(
            gameState,
            'story.projectBeacon.shipFieldSupport',
            {}
        )
    );
    const poweredBerth = reconstruction.completedStepIds.includes(
        'living_power_lattice'
    );
    const completedLevels = Math.max(
        0,
        Math.min(
            999,
            Math.floor(
                Number(getValue(gameState, 'stats.levelsCompleted', 0)) || 0
            )
        )
    );
    const health = clampStat(
        getValue(gameState, 'creature.stats.health', 100)
    );
    const energy = clampStat(
        getValue(gameState, 'creature.stats.energy', 100)
    );
    const serviceUnused =
        completedLevels > state.lastServicedLevel;
    const recoveryNeeded = health < 100 || energy < 100;

    return {
        state,
        poweredBerth,
        available: poweredBerth && completedLevels > 0,
        ready:
            poweredBerth &&
            serviceUnused &&
            recoveryNeeded,
        serviceUnused,
        recoveryNeeded,
        completedLevels,
        health,
        energy,
        energyRecovery: BERTH_ENERGY_RECOVERY,
        healthRecovery: BERTH_HEALTH_RECOVERY,
        status: !poweredBerth
            ? 'OFFLINE'
            : !serviceUnused
                ? 'SERVICED'
                : recoveryNeeded
                    ? 'READY'
                    : 'STANDBY',
        nextServiceAfterLevel:
            Math.max(completedLevels, state.lastServicedLevel) + 1
    };
}

export function normalizeShipReconstructionState(state = {}) {
    const history = normalizeHistory(state?.history);
    const completed = new Set(
        Array.isArray(state?.completedStepIds)
            ? state.completedStepIds.filter(id => STEP_BY_ID.has(id))
            : []
    );
    history.forEach(entry => completed.add(entry.stepId));
    const completedStepIds = [];
    for (const step of SHIP_RECONSTRUCTION_STEPS) {
        if (!completed.has(step.id)) break;
        completedStepIds.push(step.id);
    }
    const complete =
        completedStepIds.length === SHIP_RECONSTRUCTION_STEPS.length;

    return {
        schemaVersion: SHIP_RECONSTRUCTION_SCHEMA_VERSION,
        completedStepIds,
        firstInstalledAt:
            normalizeTimestamp(state?.firstInstalledAt)
            || history[0]?.occurredAt
            || null,
        completedAt: complete
            ? (
                normalizeTimestamp(state?.completedAt)
                || history.find(
                    entry => entry.stepId === 'black_box_recovery'
                )?.occurredAt
                || null
            )
            : null,
        history
    };
}

export function getCapabilitiesForReconstruction(state = {}) {
    const normalized = normalizeShipReconstructionState(state);
    return normalized.completedStepIds.reduce(
        (capabilities, stepId) => ({
            ...capabilities,
            ...STEP_BY_ID.get(stepId).capabilities
        }),
        { ...INITIAL_CAPABILITIES }
    );
}

export function getShipReconstructionSnapshot(gameState) {
    const state = normalizeShipReconstructionState(
        getValue(
            gameState,
            'story.projectBeacon.shipReconstruction',
            {}
        )
    );
    const collected = new Set(
        Array.isArray(
            getValue(gameState, 'hubWorld.shipParts.collected', [])
        )
            ? getValue(gameState, 'hubWorld.shipParts.collected', [])
            : []
    );
    const fieldKitRecovered = getValue(
        gameState,
        'story.projectBeacon.fieldKit.recovered',
        false
    ) === true;
    const steps = SHIP_RECONSTRUCTION_STEPS.map((step, index) => {
        const installed = state.completedStepIds.includes(step.id);
        const recovered = collected.has(step.partId);
        const priorComplete = index === 0 ||
            state.completedStepIds.includes(
                SHIP_RECONSTRUCTION_STEPS[index - 1].id
            );
        const ready = !installed && recovered && priorComplete;
        let status = 'NOT RECOVERED';
        let tone = 'pending';
        let detail = `Recover ${step.partName} through its guardian expedition.`;
        if (installed) {
            status = 'INSTALLED';
            tone = 'protected';
            detail = step.installedSummary;
        } else if (ready) {
            status = 'READY';
            tone = 'ready';
            detail = step.summary;
        } else if (recovered) {
            status = 'QUEUED';
            detail = 'Install the prior Wanderer-77 system first.';
        }
        return {
            ...step,
            installed,
            recovered,
            ready,
            status,
            tone,
            detail
        };
    });
    const nextStep = steps.find(step => !step.installed) || null;
    const readyStep = steps.find(step => step.ready) || null;
    const available = fieldKitRecovered && collected.size > 0;
    const complete =
        state.completedStepIds.length === SHIP_RECONSTRUCTION_STEPS.length;
    const finalVoidReady = steps
        .slice(0, SHIP_RECONSTRUCTION_STEPS.length - 1)
        .every(step => step.installed);
    const fieldSupport = getShipFieldSupportSnapshot(
        gameState,
        state
    );

    return {
        state,
        available,
        ready: available && Boolean(readyStep),
        complete,
        finalVoidReady,
        completedCount: state.completedStepIds.length,
        totalSteps: SHIP_RECONSTRUCTION_STEPS.length,
        nextStep,
        readyStep,
        steps,
        rows: steps.map(step => ({
            id: step.id,
            label: `${step.order}. ${step.label}`,
            status: step.status,
            tone: step.tone,
            detail: step.detail
        })),
        capabilities: getCapabilitiesForReconstruction(state),
        fieldSupport,
        transmissionStatus: 'not_sent',
        departureStatus: 'deferred',
        travelStatus: 'undecided'
    };
}

export function serviceCompanionAtPoweredBerth(gameState, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const reconstruction = getShipReconstructionSnapshot(gameState);
    const support = reconstruction.fieldSupport;
    if (!support.poweredBerth) {
        return {
            changed: false,
            reason: 'powered_berth_required',
            snapshot: reconstruction
        };
    }
    if (!support.serviceUnused) {
        return {
            changed: false,
            reason: 'expedition_service_used',
            snapshot: reconstruction
        };
    }
    if (!support.recoveryNeeded) {
        return {
            changed: false,
            reason: 'companion_stable',
            snapshot: reconstruction
        };
    }

    const companionId = getActiveCompanionId(gameState);
    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `ship_berth:${companionId}:level_${support.completedLevels}`
    ) || `ship_berth:${companionId}:level_${support.completedLevels}`;
    if (
        support.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            snapshot: reconstruction
        };
    }

    const nextEnergy = Math.min(
        100,
        support.energy + BERTH_ENERGY_RECOVERY
    );
    const nextHealth = Math.min(
        100,
        support.health + BERTH_HEALTH_RECOVERY
    );
    const energyRestored = nextEnergy - support.energy;
    const healthRestored = nextHealth - support.health;
    const nextSupportState = normalizeShipFieldSupportState({
        ...support.state,
        lastServicedLevel: support.completedLevels,
        serviceCount: support.state.serviceCount + 1,
        lastServicedAt: occurredAt,
        history: [
            ...support.state.history,
            {
                operationId: normalizedOperationId,
                type: 'powered_berth_service',
                companionId,
                levelMilestone: support.completedLevels,
                energyRestored,
                healthRestored,
                occurredAt
            }
        ]
    });

    gameState.set('creature.stats.energy', nextEnergy);
    gameState.set('creature.stats.health', nextHealth);
    gameState.set(
        'story.projectBeacon.shipFieldSupport',
        nextSupportState
    );
    if (save) gameState.save?.();

    return {
        changed: true,
        reason: 'companion_serviced',
        energyRestored,
        healthRestored,
        snapshot: getShipReconstructionSnapshot(gameState)
    };
}

export function formatShipReconstructionObjective(snapshot) {
    if (snapshot?.complete) {
        return 'Wanderer-77 reconstruction complete. No launch, signal, or travel decision has been made.';
    }
    if (snapshot?.readyStep) {
        return `Install ${snapshot.readyStep.partName}: ${snapshot.completedCount}/${snapshot.totalSteps} systems calibrated.`;
    }
    if (snapshot?.available) {
        return `Recover ${snapshot.nextStep?.partName || 'the next ship system'} through its guardian expedition.`;
    }
    return 'Recover the field kit and the first Wanderer-77 system.';
}

export function installShipReconstructionStep(gameState, stepId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const step = STEP_BY_ID.get(stepId);
    const snapshot = getShipReconstructionSnapshot(gameState);
    if (!step) {
        return {
            changed: false,
            reason: 'unknown_step',
            snapshot
        };
    }
    if (snapshot.state.completedStepIds.includes(stepId)) {
        return {
            changed: false,
            reason: 'already_installed',
            step,
            snapshot
        };
    }
    if (snapshot.readyStep?.id !== stepId) {
        return {
            changed: false,
            reason: snapshot.nextStep?.id === stepId
                ? 'ship_part_required'
                : 'prior_step_required',
            step,
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(
        operationId || `ship_reconstruction:${step.id}`
    ) || `ship_reconstruction:${step.id}`;
    if (
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

    const nextState = normalizeShipReconstructionState({
        ...snapshot.state,
        completedStepIds: [
            ...snapshot.state.completedStepIds,
            step.id
        ],
        firstInstalledAt:
            snapshot.state.firstInstalledAt || occurredAt,
        completedAt: step.id === 'black_box_recovery'
            ? occurredAt
            : null,
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'ship_system_installed',
                stepId: step.id,
                partId: step.partId,
                occurredAt
            }
        ]
    });
    gameState.set(
        'story.projectBeacon.shipReconstruction',
        nextState
    );
    gameState.set(
        'story.projectBeacon.shipCapabilities',
        getCapabilitiesForReconstruction(nextState)
    );
    if (save) gameState.save?.();

    return {
        changed: true,
        reason: step.id === 'black_box_recovery'
            ? 'reconstruction_complete'
            : 'system_installed',
        step,
        snapshot: getShipReconstructionSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.ShipReconstruction = {
        SHIP_RECONSTRUCTION_SCHEMA_VERSION,
        SHIP_FIELD_SUPPORT_SCHEMA_VERSION,
        SHIP_RECONSTRUCTION_STEPS,
        createInitialShipReconstructionState,
        createInitialShipFieldSupportState,
        normalizeShipReconstructionState,
        normalizeShipFieldSupportState,
        getCapabilitiesForReconstruction,
        getShipFieldSupportSnapshot,
        getShipReconstructionSnapshot,
        formatShipReconstructionObjective,
        installShipReconstructionStep,
        serviceCompanionAtPoweredBerth
    };
}
