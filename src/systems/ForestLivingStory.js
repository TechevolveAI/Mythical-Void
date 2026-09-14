export const FOREST_LIVING_STORY_STATE_PATH =
    'story.projectBeacon.forestLivingStory';

export const FOREST_HELP_MOMENTS = Object.freeze([
    Object.freeze({
        id: 'tangled_roots',
        checkpointId: 'forest_anchor_1',
        label: 'TANGLED ROOTS',
        objective: 'Help the trapped roots breathe',
        creatureLine: 'It is still alive.',
        astronautLine: 'My scanner missed it. You did not.'
    }),
    Object.freeze({
        id: 'dark_hollow',
        checkpointId: 'forest_anchor_2',
        label: 'DARK HOLLOW',
        objective: 'Bring light back to the hollow',
        creatureLine: 'The light is underneath us.',
        astronautLine: 'Then show me where to look.'
    }),
    Object.freeze({
        id: 'hidden_lives',
        checkpointId: 'forest_anchor_3',
        label: 'HIDDEN LIVES',
        objective: 'Free the creatures hiding here',
        creatureLine: 'They are hiding. The Guardian is afraid.',
        astronautLine: 'Then we free it. We do not fight the forest.'
    })
]);

const FOREST_HELP_MOMENT_IDS = new Set(
    FOREST_HELP_MOMENTS.map(moment => moment.id)
);

export function getForestHelpMoment(index) {
    const normalizedIndex = Math.max(
        0,
        Math.min(
            FOREST_HELP_MOMENTS.length - 1,
            Number.isInteger(index) ? index : 0
        )
    );
    return FOREST_HELP_MOMENTS[normalizedIndex];
}

export function getForestLivingStoryState(gameState) {
    const raw = gameState?.get?.(FOREST_LIVING_STORY_STATE_PATH) || {};
    const recoveredMomentIds = Array.isArray(raw.recoveredMomentIds)
        ? raw.recoveredMomentIds.filter(id => FOREST_HELP_MOMENT_IDS.has(id))
        : [];

    return {
        version: 1,
        recoveredMomentIds: [...new Set(recoveredMomentIds)],
        forestRestored: raw.forestRestored === true
    };
}

export function recordForestHelpMoment(gameState, momentId, { save = true } = {}) {
    if (!gameState?.set || !FOREST_HELP_MOMENT_IDS.has(momentId)) {
        return { changed: false, state: getForestLivingStoryState(gameState) };
    }

    const current = getForestLivingStoryState(gameState);
    if (current.recoveredMomentIds.includes(momentId)) {
        return { changed: false, state: current };
    }

    const next = {
        ...current,
        recoveredMomentIds: [...current.recoveredMomentIds, momentId]
    };
    gameState.set(FOREST_LIVING_STORY_STATE_PATH, next);
    if (save) gameState.save?.();
    return { changed: true, state: next };
}

export function recordForestRestored(gameState, { save = true } = {}) {
    if (!gameState?.set) {
        return { changed: false, state: getForestLivingStoryState(gameState) };
    }

    const current = getForestLivingStoryState(gameState);
    if (current.forestRestored) {
        return { changed: false, state: current };
    }

    const next = { ...current, forestRestored: true };
    gameState.set(FOREST_LIVING_STORY_STATE_PATH, next);
    if (save) gameState.save?.();
    return { changed: true, state: next };
}
