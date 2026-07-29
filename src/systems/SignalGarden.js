export const SIGNAL_GARDEN_STAGES = Object.freeze([
    'seed',
    'sprout',
    'bud',
    'bloom'
]);

const STAGE_MESSAGES = Object.freeze({
    sprout: 'A tiny light leans toward your companion.',
    bud: 'The sprout answers the signals you restored.',
    bloom: 'It blooms in colors neither world made alone.'
});

const DAILY_RETURN_MESSAGE = 'The signal bloom has enough light for today. Come back tomorrow.';
const MATURE_TENDING_MESSAGE = 'The bloom brightens when you arrive together.';

function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function getSignalGardenDayKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return getSignalGardenDayKey(Date.now());
    }

    return date.toISOString().slice(0, 10);
}

export function normalizeSignalGardenState(state = {}) {
    const parsedTendCount = Number(state?.tendCount);
    const tendCount = Number.isFinite(parsedTendCount)
        ? Math.max(0, Math.floor(parsedTendCount))
        : 0;
    const stage = SIGNAL_GARDEN_STAGES[Math.min(tendCount, 3)];

    return {
        stage,
        tendCount,
        lastTendedDay: typeof state?.lastTendedDay === 'string' ? state.lastTendedDay : null,
        lastTendedAt: normalizeTimestamp(state?.lastTendedAt),
        plantedAt: normalizeTimestamp(state?.plantedAt),
        bloomedAt: normalizeTimestamp(state?.bloomedAt)
    };
}

export function tendSignalGarden(currentState = {}, timestamp = Date.now()) {
    const state = normalizeSignalGardenState(currentState);
    const tendedAt = normalizeTimestamp(timestamp) ?? Date.now();
    const dayKey = getSignalGardenDayKey(tendedAt);

    if (state.lastTendedDay === dayKey) {
        return {
            success: false,
            state,
            stage: state.stage,
            message: DAILY_RETURN_MESSAGE,
            companionLine: DAILY_RETURN_MESSAGE,
            isNewStage: false
        };
    }

    const previousStage = state.stage;
    const tendCount = state.tendCount + 1;
    const stage = SIGNAL_GARDEN_STAGES[Math.min(tendCount, 3)];
    const nextState = {
        ...state,
        stage,
        tendCount,
        lastTendedDay: dayKey,
        lastTendedAt: tendedAt,
        plantedAt: state.plantedAt || tendedAt,
        bloomedAt: stage === 'bloom' ? (state.bloomedAt || tendedAt) : state.bloomedAt
    };
    const isNewStage = stage !== previousStage;
    const companionLine = isNewStage
        ? STAGE_MESSAGES[stage]
        : MATURE_TENDING_MESSAGE;

    return {
        success: true,
        state: nextState,
        stage,
        message: companionLine,
        companionLine,
        isNewStage
    };
}
