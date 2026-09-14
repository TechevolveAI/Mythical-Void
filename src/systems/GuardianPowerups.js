import bossConfigs from '../config/bosses.json';

export const GUARDIAN_POWER_LEVEL_ORDER = Object.freeze([
    Object.freeze({ levelId: 'mythicalForest', bossKey: 'elderTreant' }),
    Object.freeze({ levelId: 'crystalCaves', bossKey: 'crystalGolem' }),
    Object.freeze({ levelId: 'cosmicReef', bossKey: 'voidSerpent' }),
    Object.freeze({ levelId: 'voidPeaks', bossKey: 'cosmicTitan' }),
    Object.freeze({ levelId: 'auroraDepths', bossKey: 'shadowPhoenix' }),
    Object.freeze({ levelId: 'finalVoid', bossKey: 'voidEmpress' })
]);

function readState(gameState, path) {
    return gameState?.get?.(path);
}

function copyPowerup(powerup) {
    if (!powerup) return null;
    return {
        ...powerup,
        effect: { ...(powerup.effect || {}) }
    };
}

export function getGuardianPowerupDefinition(levelId) {
    const entry = GUARDIAN_POWER_LEVEL_ORDER.find(candidate => (
        candidate.levelId === levelId
    ));
    if (!entry) return null;

    const boss = bossConfigs[entry.bossKey];
    const powerup = boss?.rewards?.powerup;
    if (!powerup?.id || powerup.type !== 'powerup' || !powerup.usableInLevel) {
        return null;
    }

    return {
        levelId: entry.levelId,
        bossKey: entry.bossKey,
        guardianName: boss.name,
        powerup: copyPowerup(powerup)
    };
}

export function getGuardianPowerUnlockState(gameState) {
    const priorCompletedJourney = Math.max(
        0,
        Number(readState(gameState, 'game.newGamePlusCount')) || 0
    ) > 0;

    return GUARDIAN_POWER_LEVEL_ORDER.map(entry => {
        const definition = getGuardianPowerupDefinition(entry.levelId);
        const completedThisJourney = readState(
            gameState,
            `levels.${entry.levelId}.completed`
        ) === true;
        return {
            ...definition,
            completedThisJourney,
            priorCompletedJourney,
            unlocked: completedThisJourney || priorCompletedJourney
        };
    }).filter(entry => entry.powerup);
}

export function getGuardianPowerShopItems(gameState) {
    const unlocks = getGuardianPowerUnlockState(gameState);
    const discovered = unlocks
        .filter(entry => entry.unlocked)
        .map(entry => ({
            ...copyPowerup(entry.powerup),
            guardianLevelId: entry.levelId,
            guardianName: entry.guardianName,
            discoverySource: 'guardian',
            shopActionLabel: 'RESTOCK'
        }));
    const nextLocked = unlocks.find(entry => !entry.unlocked);

    if (nextLocked) {
        discovered.push({
            id: 'guardian_power_locked',
            name: 'Guardian Power',
            description: 'Restore the next Guardian to discover a new expedition power.',
            icon: '✦',
            price: null,
            type: 'guardian_power_locked',
            unavailable: true,
            shopActionLabel: 'RESTORE'
        });
    }

    return discovered;
}
