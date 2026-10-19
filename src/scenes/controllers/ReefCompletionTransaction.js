import { createLevelCompletionHandler } from './LevelCompletionTransaction.js';

export function createReefCompletionHandler(blueprint) {
    return createLevelCompletionHandler(blueprint, 'cosmicReef');
}
