const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const draftSource = read('src/dev/CompletionCoinDraft.js');
const calculate = new Function(`${draftSource.replace(/^export /gm, '')};return calculateCompletionCoinDraft;`)();
const sceneSource = read('src/scenes/PlatformerLevelScene.js');
const nodes = parse(sceneSource, { sourceType: 'module' }).program.body;
const cls = nodes.find(node => node.type === 'ClassDeclaration');
const complete = cls.body.body.find(node => node.key?.name === 'completeLevelProgression');
const coinBranch = complete.body.body.find(node => node.type === 'IfStatement' && sceneSource.slice(node.test.start, node.test.end) === 'configuredVictoryCoins > 0');
const applyLiveBranch = new Function('window', 'gameState', 'configuredVictoryCoins', 'achievementLevelId',
    `let coinsAwarded = 0; ${sceneSource.slice(coinBranch.start, coinBranch.end)};return coinsAwarded;`);
const configs = require('../config/bosses.json');
const constants = nodes.find(node => node.type === 'VariableDeclaration' && node.declarations[0]?.id?.name === 'BOSS_REWARD_KEY_BY_LEVEL');
const reward = nodes.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'calculateVictoryCoins');
const configuredAmount = new Function('bossConfigs', `${sceneSource.slice(constants.start, constants.end)}
    ${sceneSource.slice(reward.start, reward.end)};return calculateVictoryCoins;`)(configs);
const clone = value => JSON.parse(JSON.stringify(value));

function live(mode, initial) {
    const state = clone(initial), writes = [], events = [];
    const gameState = { get: key => key.split('.').reduce((value, part) => value?.[part], state),
        set: (key, value) => { writes.push({ path: key, value }); const parts = key.split('.');
            const last = parts.pop(), target = parts.reduce((object, part) => object[part] ||= {}, state); target[last] = value; } };
    const sceneWindow = { GameState: gameState, AudioManager: { playCoinCollect: jest.fn() } };
    const source = read('src/systems/EconomyManager.js').replace('export default economyManager;', 'module.exports = economyManager;');
    const context = { module: { exports: {} }, window: sceneWindow, console: { log() {}, warn() {}, error() {} },
        Phaser: { Events: { EventEmitter } } };
    vm.runInNewContext(source, context);
    const economy = context.module.exports;
    economy.initialized = mode === 'initialised'; economy.levelCoinMultiplier = 3;
    economy.events.on('coins:added', data => events.push({ name: 'coins:added', data: clone(data) }));
    if (mode !== 'unavailable') sceneWindow.EconomyManager = economy;
    return { state, writes, events, economy, sceneWindow, gameState };
}

describe('unused completion coin calculation preserves the existing branch', () => {
    const levels = ['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths', 'finalVoid'];
    for (const mode of ['unavailable', 'uninitialised', 'initialised']) {
        test.each(levels)('%s configured reward matches actual branch with economy ' + mode, levelId => {
            const original = { player: { cosmicCoins: 25 }, stats: { coinsCollected: 10 } };
            const f = live(mode, original), amount = configuredAmount(levelId, 2);
            const packet = calculate(original, { levelId, amount, economyMode: mode });
            expect(packet.status).toBe('calculated');
            const awarded = applyLiveBranch(f.sceneWindow, f.gameState, amount, levelId);
            expect(packet.coinsAwarded).toBe(awarded); expect(packet.writes).toEqual(f.writes);
            expect(packet.event ? [packet.event] : []).toEqual(f.events);
            expect(original).toEqual({ player: { cosmicCoins: 25 }, stats: { coinsCollected: 10 } });
            expect(f.economy.isLevelPickupSource(`boss_victory:${levelId}`)).toBe(false);
            expect(f.sceneWindow.AudioManager.playCoinCollect).toHaveBeenCalledTimes(mode === 'initialised' ? 1 : 0);
            expect(Object.isFrozen(packet)).toBe(true); expect(Object.isFrozen(packet.writes)).toBe(true);
        });
    }

    test.each(['unavailable', 'uninitialised', 'initialised'])('fractional addition preserves the actual %s return and fallback arithmetic', mode => {
        const original = { player: { cosmicCoins: 25 }, stats: { coinsCollected: 10 } }, f = live(mode, original);
        const packet = calculate(original, { levelId: 'voidPeaks', amount: 19.75, economyMode: mode });
        expect(packet.coinsAwarded).toBe(applyLiveBranch(f.sceneWindow, f.gameState, 19.75, 'voidPeaks'));
        expect(packet.writes).toEqual(f.writes); expect(packet.event ? [packet.event] : []).toEqual(f.events);
        expect(packet.economyReturn).toBe(mode === 'initialised' ? 44 : undefined);
    });

    test.each([0, -1])('a nonpositive configured reward %s keeps the original no-coin path', amount => {
        const packet = calculate(null, { levelId: 'voidPeaks', amount, economyMode: 'initialised' });
        expect(packet).toMatchObject({ status: 'calculated', writes: [], coinsAwarded: 0, event: null });
    });

    test('legitimate repeated level rewards are not deduplicated by an already-completed level', () => {
        const state = { player: { cosmicCoins: 25 }, stats: { coinsCollected: 10 }, levels: { voidPeaks: { completed: true } } };
        const f = live('initialised', state);
        for (let run = 0; run < 2; run++) {
            const packet = calculate(state, { levelId: 'voidPeaks', amount: 1500, economyMode: 'initialised' });
            for (const write of packet.writes) {
                const [object, key] = write.path.split('.'); state[object][key] = write.value;
            }
            applyLiveBranch(f.sceneWindow, f.gameState, 1500, 'voidPeaks');
        }
        expect(state.player.cosmicCoins).toBe(3025); expect(state.stats.coinsCollected).toBe(3010);
        expect(state).toEqual(f.state);
    });

    test.each([
        ['missing snapshot', null, {}, 'missing_completion_snapshot'],
        ['array snapshot', [], {}, 'missing_completion_snapshot'],
        ['string balance', { player: { cosmicCoins: '25' } }, {}, 'noncanonical_currency_fields'],
        ['object lifetime coins', { stats: { coinsCollected: {} } }, {}, 'noncanonical_currency_fields'],
        ['unknown level', {}, { levelId: 'synthetic_unknown' }, 'unknown_completion_level'],
        ['unknown service mode', {}, { economyMode: 'synthetic_unknown' }, 'unknown_economy_mode'],
        ['NaN reward', {}, { amount: NaN }, 'nonfinite_reward'],
        ['infinite reward', {}, { amount: Infinity }, 'nonfinite_reward'],
        ['overflow', { player: { cosmicCoins: Number.MAX_VALUE } }, { amount: Number.MAX_VALUE }, 'nonfinite_result']
    ])('%s is explicitly unqualified, never normalised or applied', (_label, state, overrides, reason) => {
        const before = clone(state);
        const packet = calculate(state, { levelId: 'voidPeaks', amount: 1500, economyMode: 'initialised', ...overrides });
        expect(packet).toEqual({ status: 'unqualified', reason }); expect(state).toEqual(before);
    });

    test('calculation has no live manager, save, emitter or audio capability', () => {
        const original = window.GameState, audio = window.AudioManager;
        const set = jest.fn(() => { throw Error('LIVE_MUTATION_FORBIDDEN'); });
        window.GameState = { get: set, set, save: set }; window.AudioManager = { playCoinCollect: set };
        try {
            const state = Object.freeze({ player: Object.freeze({ cosmicCoins: 0 }), stats: Object.freeze({ coinsCollected: 0 }) });
            expect(calculate(state, { levelId: 'voidPeaks', amount: 1500, economyMode: 'initialised' }).status).toBe('calculated');
            expect(set).not.toHaveBeenCalled();
        } finally { window.GameState = original; window.AudioManager = audio; }
    });
});
