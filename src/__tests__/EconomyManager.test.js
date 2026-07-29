const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEconomyManager(sceneWindow) {
    const filePath = path.join(__dirname, '../systems/EconomyManager.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export default economyManager;/, 'module.exports = economyManager;');

    class EventEmitter {
        constructor() {
            this.emit = jest.fn();
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: {
            Events: { EventEmitter }
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('EconomyManager coin accounting', () => {
    let state;
    let sceneWindow;
    let economyManager;

    beforeEach(() => {
        state = {
            player: {
                cosmicCoins: 25,
                stardust: 0
            },
            stats: {
                coinsCollected: 10
            }
        };
        const get = jest.fn((propertyPath) => {
            return propertyPath.split('.').reduce((value, key) => value?.[key], state);
        });
        const set = jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        });

        sceneWindow = {
            GameState: { get, set },
            AudioManager: {
                playCoinCollect: jest.fn()
            }
        };
        economyManager = loadEconomyManager(sceneWindow);
        economyManager.initialize();
    });

    test('adds spendable coins and lifetime earned coins together', () => {
        const newBalance = economyManager.addCoins(100, 'boss_victory:auroraDepths');

        expect(newBalance).toBe(125);
        expect(state.player.cosmicCoins).toBe(125);
        expect(state.stats.coinsCollected).toBe(110);
        expect(economyManager.events.emit).toHaveBeenCalledWith('coins:added', {
            amount: 100,
            source: 'boss_victory:auroraDepths',
            oldBalance: 25,
            newBalance: 125
        });
    });

    test('keeps debug grants out of journey statistics', () => {
        economyManager.addCoins(500, 'debug:grant');

        expect(state.player.cosmicCoins).toBe(525);
        expect(state.stats.coinsCollected).toBe(10);
    });

    test('doubles level pickups without inflating guardian rewards', () => {
        economyManager.setLevelCoinMultiplier(2);

        expect(economyManager.addCoins(10, 'forest_platform_coin')).toBe(45);
        expect(economyManager.events.emit).toHaveBeenCalledWith('coins:added', {
            amount: 20,
            baseAmount: 10,
            multiplier: 2,
            source: 'forest_platform_coin',
            oldBalance: 25,
            newBalance: 45
        });

        expect(economyManager.addCoins(100, 'boss_victory:mythicalForest')).toBe(145);
        expect(state.stats.coinsCollected).toBe(130);
    });
});
