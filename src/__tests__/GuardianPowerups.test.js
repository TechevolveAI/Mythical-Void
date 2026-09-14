const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGuardianPowerups() {
    const filePath = path.join(__dirname, '../systems/GuardianPowerups.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            "import bossConfigs from '../config/bosses.json';",
            'const bossConfigs = BOSS_CONFIGS;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                GUARDIAN_POWER_LEVEL_ORDER,
                getGuardianPowerupDefinition,
                getGuardianPowerUnlockState,
                getGuardianPowerShopItems
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        BOSS_CONFIGS: require('../config/bosses.json')
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function stateHarness(state = {}) {
    return {
        get: propertyPath => propertyPath
            .split('.')
            .reduce((value, key) => value?.[key], state)
    };
}

describe('Guardian power discovery and restocking', () => {
    const guardianPowerups = loadGuardianPowerups();

    test('shows no future power spoilers before the first Guardian is restored', () => {
        const items = guardianPowerups.getGuardianPowerShopItems(stateHarness({}));

        expect(items).toHaveLength(1);
        expect(items[0]).toEqual(expect.objectContaining({
            id: 'guardian_power_locked',
            name: 'Guardian Power',
            type: 'guardian_power_locked',
            unavailable: true
        }));
        expect(JSON.stringify(items)).not.toContain('Energy Crystal');
        expect(JSON.stringify(items)).not.toContain('Super Blast');
    });

    test('unlocks restocks in canonical campaign order from level completion', () => {
        const gameState = stateHarness({
            levels: {
                mythicalForest: { completed: true },
                crystalCaves: { completed: true }
            }
        });
        const items = guardianPowerups.getGuardianPowerShopItems(gameState);

        expect(items.map(item => item.id)).toEqual([
            'energy_crystal',
            'crystal_shield',
            'guardian_power_locked'
        ]);
        expect(items[0]).toEqual(expect.objectContaining({
            guardianLevelId: 'mythicalForest',
            guardianName: 'ELDER TREANT',
            shopActionLabel: 'RESTOCK'
        }));
        expect(items[1].effect).toEqual({ shieldHits: 2 });
    });

    test('keeps every discovered restock available in New Game+', () => {
        const items = guardianPowerups.getGuardianPowerShopItems(stateHarness({
            game: { newGamePlusCount: 1 },
            levels: {
                mythicalForest: { completed: false },
                crystalCaves: { completed: false }
            }
        }));

        expect(items.map(item => item.id)).toEqual([
            'energy_crystal',
            'crystal_shield',
            'double_coins',
            'power_shot',
            'health_boost',
            'super_blast'
        ]);
        expect(items.every(item => item.shopActionLabel === 'RESTOCK')).toBe(true);
    });

    test('returns defensive copies of configured power effects', () => {
        const first = guardianPowerups.getGuardianPowerupDefinition('mythicalForest');
        first.powerup.effect.crystalEnergy = 999;

        expect(
            guardianPowerups.getGuardianPowerupDefinition('mythicalForest')
                .powerup.effect.crystalEnergy
        ).toBe(3);
        expect(guardianPowerups.getGuardianPowerupDefinition('unknown')).toBeNull();
    });
});
