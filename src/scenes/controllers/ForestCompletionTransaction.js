import { createLevelCompletionHandler } from './LevelCompletionTransaction.js';

export function createForestCompletionHandler(blueprint) {
    return createLevelCompletionHandler(blueprint, 'mythicalForest');
}
