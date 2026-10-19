import { createLevelCompletionHandler } from './LevelCompletionTransaction.js';

export function createPeaksCompletionHandler(blueprint) {
    return createLevelCompletionHandler(blueprint, 'voidPeaks');
}
