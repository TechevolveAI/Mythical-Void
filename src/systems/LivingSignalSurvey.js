export const LIVING_SIGNAL_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'echo_bloom',
        name: 'Echo Bloom',
        position: Object.freeze({ x: 500, y: 310 }),
        color: 0x8FE3CF,
        accent: 0xF2C14E,
        response: 'Its light settles into the rhythm of your companion\'s breathing.',
        companionLine: 'It is listening with us.',
        fieldNote: 'Scanner holstered. Some introductions should not begin with a sample bag.'
    }),
    Object.freeze({
        id: 'memory_stone',
        name: 'Memory Stone',
        position: Object.freeze({ x: 410, y: 530 }),
        color: 0xBFA6FF,
        accent: 0x66C7D4,
        response: 'A pulse returns the Wanderer-77 distress rhythm, softened into a greeting.',
        companionLine: 'You sounded lonely.',
        fieldNote: 'The planet heard the crash before I understood that it could listen.'
    }),
    Object.freeze({
        id: 'rootlight',
        name: 'Rootlight',
        position: Object.freeze({ x: 680, y: 590 }),
        color: 0x71E6B1,
        accent: 0xD8B65C,
        response: 'Light travels through the soil toward the distant World Gate.',
        companionLine: 'This way. We go together.',
        fieldNote: 'First rule of unfamiliar ground: notice who already knows where to step.'
    })
]);

const SIGNAL_IDS = new Set(LIVING_SIGNAL_DEFINITIONS.map(signal => signal.id));

function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function getLivingSignalDefinition(signalId) {
    return LIVING_SIGNAL_DEFINITIONS.find(signal => signal.id === signalId) || null;
}

export function normalizeLivingSignalState(state = {}) {
    const observedIds = Array.isArray(state?.observedIds)
        ? [...new Set(state.observedIds.filter(id => SIGNAL_IDS.has(id)))]
        : [];

    return {
        observedIds,
        lastObservedId: SIGNAL_IDS.has(state?.lastObservedId) ? state.lastObservedId : null,
        lastObservedAt: normalizeTimestamp(state?.lastObservedAt)
    };
}

export function observeLivingSignal(currentState = {}, signalId, timestamp = Date.now()) {
    const state = normalizeLivingSignalState(currentState);
    const signal = getLivingSignalDefinition(signalId);

    if (!signal || state.observedIds.includes(signalId)) {
        return {
            success: false,
            state,
            signal,
            progress: state.observedIds.length,
            total: LIVING_SIGNAL_DEFINITIONS.length,
            completed: state.observedIds.length === LIVING_SIGNAL_DEFINITIONS.length
        };
    }

    const observedAt = normalizeTimestamp(timestamp) ?? Date.now();
    const nextState = {
        observedIds: [...state.observedIds, signalId],
        lastObservedId: signalId,
        lastObservedAt: observedAt
    };

    return {
        success: true,
        state: nextState,
        signal,
        progress: nextState.observedIds.length,
        total: LIVING_SIGNAL_DEFINITIONS.length,
        completed: nextState.observedIds.length === LIVING_SIGNAL_DEFINITIONS.length
    };
}
