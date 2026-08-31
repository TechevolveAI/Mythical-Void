const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BreedingEngine } = require('../systems/BreedingEngine.js');

class EventEmitter {
    constructor() {
        this.emit = jest.fn();
    }
    on() {}
    once() {}
    off() {}
    removeAllListeners() {}
}

function runSingleton(relativePath, exportName, sceneWindow) {
    const filePath = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8').replace(
        new RegExp(`export default ${exportName};`),
        `module.exports = ${exportName};`
    );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Events: { EventEmitter } }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadShopScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/ShopScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace("import Phaser from 'phaser';", '')
        .replace(
            "import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';",
            'const SceneTransitionHelper = SCENE_TRANSITION;'
        )
        .replace(
            "import VillageCommandPanel from '../ui/VillageCommandPanel.js';",
            'const VillageCommandPanel = VILLAGE_COMMAND_PANEL;'
        )
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/VillageSettlement\.js';/,
            'const { assignCreatureToVillageBuilding, getVillageSnapshot, initializeVillageSettlement, placeVillageBuilding, reconcileVillageSettlement } = VILLAGE_SETTLEMENT;'
        )
        .replace('export default class ShopScene', 'class ShopScene')
        .concat('\nmodule.exports = ShopScene;\n');
    class PhaserScene {
        constructor(config) {
            this.scene = { key: config?.key };
        }
    }
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        SCENE_TRANSITION: { stopScene: jest.fn(), resumeScene: jest.fn() },
        VILLAGE_COMMAND_PANEL: class {},
        VILLAGE_SETTLEMENT: {
            assignCreatureToVillageBuilding: jest.fn(),
            getVillageSnapshot: jest.fn(),
            initializeVillageSettlement: jest.fn(),
            placeVillageBuilding: jest.fn(),
            reconcileVillageSettlement: jest.fn()
        }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function stateHarness() {
    const state = {
        player: { cosmicCoins: 0, stardust: 0 },
        stats: { coinsCollected: 0 },
        inventory: { items: [] },
        creature: { hatchTransaction: null },
        world: { currentPosition: { x: 612, y: 344 } },
        hubWorld: { mapsOwned: [], gates: {} }
    };
    const get = propertyPath => propertyPath
        .split('.')
        .reduce((value, key) => value?.[key], state);
    const set = (propertyPath, value) => {
        const keys = propertyPath.split('.');
        const finalKey = keys.pop();
        const target = keys.reduce((current, key) => {
            current[key] = current[key] || {};
            return current[key];
        }, state);
        target[finalKey] = value;
    };
    return {
        state,
        GameState: {
            get: jest.fn(get),
            set: jest.fn(set),
            save: jest.fn(),
            addMapToCollection: jest.fn(() => true)
        }
    };
}

function hatchRecord(id, mendelianGenes) {
    return {
        id,
        name: id,
        generation: 1,
        rarity: 'rare',
        lifecycle: { stage: 'adult' },
        genes: {
            id: `genes_${id}`,
            species: 'nebulaSprite',
            rarity: 'rare',
            mendelianGenes,
            traits: {
                bodyShape: { type: 'balanced', intensity: 0.5 },
                colorGenome: { primary: 0x315d5c, secondary: 0x865d9d },
                features: {
                    eyes: { size: 'medium', color: 0x8a2be2, glow: 0.8 },
                    markings: { pattern: 'spots', intensity: 0.7 },
                    wackyMutations: []
                }
            }
        }
    };
}

describe('complete collect, egg, hatch, and multigeneration Fusion loop', () => {
    test('spends collected currency on one real egg reservation and preserves inherited alleles', () => {
        const { state, GameState } = stateHarness();
        const sceneWindow = {
            GameState,
            AudioManager: {
                playCoinCollect: jest.fn(),
                playPurchase: jest.fn(),
                playShopPurchase: jest.fn(() => true),
                playError: jest.fn()
            }
        };
        const economy = runSingleton(
            'systems/EconomyManager.js',
            'economyManager',
            sceneWindow
        );
        sceneWindow.EconomyManager = economy;
        const inventory = runSingleton(
            'systems/InventoryManager.js',
            'inventoryManager',
            sceneWindow
        );
        sceneWindow.InventoryManager = inventory;
        economy.initialize();
        inventory.initialize();

        expect(economy.addCoins(275, 'collectible_forest_coin')).toBe(275);
        expect(state.stats.coinsCollected).toBe(275);

        const ShopScene = loadShopScene(sceneWindow);
        const shop = new ShopScene();
        shop.time = { delayedCall: jest.fn((_delay, callback) => callback()) };
        shop.showLoadingOverlay = jest.fn();
        shop.hideLoadingOverlay = jest.fn();
        shop.showPurchaseError = jest.fn();
        shop.showPurchaseSuccess = jest.fn();
        shop.updateCoinDisplay = jest.fn();
        shop.displayCategory = jest.fn();
        shop.selectedCategory = 'eggs';
        shop.initializeShopItems();
        const egg = shop.shopItems.eggs.find(item => item.id === 'cosmic_egg');

        shop.purchaseItem(egg);

        expect(state.player.cosmicCoins).toBe(25);
        expect(inventory.getAllItems()).toEqual([
            expect.objectContaining({ id: 'cosmic_egg', type: 'egg', quantity: 1 })
        ]);
        expect(shop.showPurchaseSuccess).toHaveBeenCalledWith(egg);

        const reservation = inventory.reserveEggForHatching(
            0,
            state.world.currentPosition
        );
        expect(reservation).toEqual(expect.objectContaining({
            success: true,
            transaction: expect.objectContaining({
                status: 'reserved',
                eggType: 'cosmic',
                eggItemId: 'cosmic_egg',
                spawnPosition: { x: 612, y: 344 }
            })
        }));
        expect(inventory.getAllItems()).toHaveLength(0);
        expect(state.creature.hatchTransaction).toEqual(reservation.transaction);

        const engine = new BreedingEngine();
        const hatchOneGenes = engine.resolveCreatureGenes({
            id: 'hatch_one',
            genes: {
                id: 'genes_hatch_one',
                traits: {
                    bodyShape: { type: 'slender' },
                    features: {
                        eyes: { color: 0x228b22 },
                        markings: { pattern: 'stripes' }
                    }
                }
            }
        });
        const hatchTwoGenes = engine.resolveCreatureGenes({
            id: 'hatch_two',
            genes: {
                id: 'genes_hatch_two',
                traits: {
                    bodyShape: { type: 'sturdy' },
                    features: {
                        eyes: { color: 0xff8c00 },
                        markings: { pattern: 'spots' }
                    }
                }
            }
        });
        const parent1 = hatchRecord('hatch_one', hatchOneGenes);
        const parent2 = hatchRecord('hatch_two', hatchTwoGenes);
        const generation2 = engine.breedCreaturesWithLineage(
            parent1,
            parent2
        );
        const child = hatchRecord('generation_two', generation2.genes);
        child.generation = 2;
        const generation3 = engine.breedCreaturesWithLineage(child, parent1);

        Object.keys(engine.traitDefinitions).forEach(traitKey => {
            expect(parent1.genes.mendelianGenes[traitKey]).toContain(
                generation2.inheritance[traitKey].parent1Allele
            );
            expect(parent2.genes.mendelianGenes[traitKey]).toContain(
                generation2.inheritance[traitKey].parent2Allele
            );
            expect(child.genes.mendelianGenes[traitKey]).toContain(
                generation3.inheritance[traitKey].parent1Allele
            );
            expect(parent1.genes.mendelianGenes[traitKey]).toContain(
                generation3.inheritance[traitKey].parent2Allele
            );
        });
    });

    test('never starts a free hatch or clears the active creature after reservation failure', () => {
        const inventorySource = fs.readFileSync(
            path.join(__dirname, '../scenes/InventoryScene.js'),
            'utf8'
        );
        expect(inventorySource).toContain('reserveEggForHatching?.(');
        expect(inventorySource).toContain("'The egg is still in your inventory. Please try again.'");
        expect(inventorySource).not.toContain("window.GameState?.set('creature.hatched', false)");
        expect(inventorySource).not.toContain("window.GameState?.set('creature.named', false)");
    });
});
