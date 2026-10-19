import { createLevelCompletionHandler } from './LevelCompletionTransaction.js';

export function createAuroraCompletionHandler(blueprint) {
    return createLevelCompletionHandler(blueprint, 'auroraDepths');
}
