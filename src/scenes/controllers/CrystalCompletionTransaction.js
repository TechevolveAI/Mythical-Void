import { createLevelCompletionHandler } from './LevelCompletionTransaction.js';

export function createCrystalCompletionHandler(blueprint) {
    return createLevelCompletionHandler(blueprint, 'crystalCaves');
}
