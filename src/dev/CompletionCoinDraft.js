const completionLevels = new Set(['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths', 'finalVoid']);
const unqualified = reason => Object.freeze({ status: 'unqualified', reason });

// Calculation only. The eventual caller must prove the original source and
// services; this packet is neither a grant, a save receipt nor a retry owner.
export function calculateCompletionCoinDraft(snapshot, { levelId, amount, economyMode } = {}) {
    if (!completionLevels.has(levelId)) return unqualified('unknown_completion_level');
    if (!['unavailable', 'uninitialised', 'initialised'].includes(economyMode)) return unqualified('unknown_economy_mode');
    if (!Number.isFinite(amount)) return unqualified('nonfinite_reward');
    if (amount <= 0) return Object.freeze({ status: 'calculated', writes: Object.freeze([]), coinsAwarded: 0, event: null, economyReturn: undefined });
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return unqualified('missing_completion_snapshot');
    const readNumber = value => value == null || value === false || value === '' ? 0 : value;
    const balance = readNumber(snapshot?.player?.cosmicCoins), collected = readNumber(snapshot?.stats?.coinsCollected);
    if (typeof balance !== 'number' || !Number.isFinite(balance) || typeof collected !== 'number' || !Number.isFinite(collected)) {
        return unqualified('noncanonical_currency_fields');
    }
    const initialised = economyMode === 'initialised';
    // Existing boss sources never use the level-pickup multiplier. The live
    // service floors its addition; the existing fallback does not.
    const added = initialised ? Math.floor(amount) : amount;
    const nextBalance = balance + added, nextCollected = collected + added;
    if (!Number.isFinite(nextBalance) || !Number.isFinite(nextCollected)) return unqualified('nonfinite_result');
    const source = `boss_victory:${levelId}`;
    const event = initialised ? Object.freeze({ name: 'coins:added', data: Object.freeze({
        amount: added, source, oldBalance: balance, newBalance: nextBalance
    }) }) : null;
    return Object.freeze({ status: 'calculated', writes: Object.freeze([
        Object.freeze({ path: 'player.cosmicCoins', value: nextBalance }),
        Object.freeze({ path: 'stats.coinsCollected', value: nextCollected })
    ]), coinsAwarded: amount, economyReturn: initialised ? nextBalance : undefined, event });
}
