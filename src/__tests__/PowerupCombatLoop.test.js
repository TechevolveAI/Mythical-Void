const fs = require('fs');
const path = require('path');
const vm = require('vm');

class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        const listeners = this.listeners.get(event) || [];
        listeners.push(callback);
        this.listeners.set(event, listeners);
    }

    once(event, callback) {
        const onceCallback = (...args) => {
            this.off(event, onceCallback);
            callback(...args);
        };
        this.on(event, onceCallback);
    }

    off(event, callback) {
        this.listeners.set(
            event,
            (this.listeners.get(event) || []).filter(listener => listener !== callback)
        );
    }

    emit(event, payload) {
        (this.listeners.get(event) || []).forEach(listener => listener(payload));
    }

    removeAllListeners() {
        this.listeners.clear();
    }
}

function loadInventoryManager(initialItems = []) {
    const filePath = path.join(__dirname, '../systems/InventoryManager.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export default inventoryManager;',
            'module.exports = { InventoryManager, inventoryManager };'
        );
    const state = {
        inventory: {
            items: initialItems
        }
    };
    const gameState = {
        get: jest.fn(propertyPath => propertyPath
            .split('.')
            .reduce((value, key) => value?.[key], state)),
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        addMapToCollection: jest.fn(gateId => {
            state.hubWorld = state.hubWorld || {};
            const mapsOwned = state.hubWorld.mapsOwned || [];
            if (mapsOwned.includes(gateId)) {
                return false;
            }
            state.hubWorld.mapsOwned = [...mapsOwned, gateId];
            return true;
        }),
        save: jest.fn()
    };
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        Date,
        Phaser: {
            Events: { EventEmitter }
        },
        window: {
            GameState: gameState
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    const manager = new sandbox.module.exports.InventoryManager();
    manager.initialize();
    return { manager, gameState, state };
}

function loadPlatformerLevelScene(sceneWindow = {}) {
    const filePath = path.join(__dirname, '../scenes/PlatformerLevelScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace("import Phaser from 'phaser';", '')
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/ProjectBeaconStory\.js';/,
            'const queueProjectBeaconDebrief = () => {};\n' +
            'const unlockProjectBeaconMilestone = () => null;'
        )
        .replace(
            "import ExpeditionAstronaut from '../systems/ExpeditionAstronaut.js';",
            'const ExpeditionAstronaut = class {};'
        )
        .replace("import '../systems/ProjectBeaconFieldKit.js';", '')
        .replace(
            "import { getCampaignObjectiveLayout, getMobileControlLayout, getSafeAreaInsets } from '../systems/MobileControlLayout.js';",
            'const getCampaignObjectiveLayout = () => ({});\n' +
            'const getMobileControlLayout = () => ({});\n' +
            'const getSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });'
        )
        .replace(
            "import bossConfigs from '../config/bosses.json';",
            'const bossConfigs = {};'
        )
        .replace(
            "import { analyzeTraversalTopology } from '../systems/TraversalTopology.js';",
            'const analyzeTraversalTopology = () => null;'
        )
        .replace(
            "import KatanaArtifactModal, { prefetchKatanaArtifactArtwork } from '../ui/KatanaArtifactModal.js';",
            'const KatanaArtifactModal = class {};\n' +
            'const prefetchKatanaArtifactArtwork = () => {};'
        )
        .replace(
            "import { getCurrentRegionActionPresentation, recordCurrentRegionRestoration } from '../systems/CurrentEcology.js';",
            'const getCurrentRegionActionPresentation = () => null;\n' +
            'const recordCurrentRegionRestoration = () => ({ changed: false });'
        )
        .replace(
            "import { getCurrentAtmosphereProjection } from '../systems/CurrentAtmosphere.js';",
            'const getCurrentAtmosphereProjection = () => ({\n' +
            '  lifeFormCount: 0, moteCount: 0, scarCount: 0,\n' +
            '  motionDurationMs: 3000, driftRange: 12,\n' +
            '  companionLine: "",\n' +
            '  soundscape: { cueId: "current_life", intervalMs: 6000, volume: 0.1 }\n' +
            '});'
        )
        .replace(
            /import \{\s*CENTERING_STANCE_DURATION_MS,[\s\S]*?\} from '\.\.\/systems\/SenseiMemory\.js';/,
            'const CENTERING_STANCE_DURATION_MS = 1250;\n' +
            'const getSenseiMemorySnapshot = () => ({ lesson: { status: "locked" } });\n' +
            'const recordCenteringStancePractice = () => ({ changed: false });'
        )
        .replace(
            "import { companionMediaService } from '../systems/CompanionMediaService.js';",
            'const companionMediaService = window.CompanionMediaService || {};'
        )
        .replace(
            "import { getVillageGameplayEffects } from '../systems/VillageSettlement.js';",
            'const getVillageGameplayEffects = () => ({ maxEnergyBonus: 0, guardCharges: 0, victoryCoinBonus: 0 });'
        )
        .replace(
            'export default PlatformerLevelScene;',
            'module.exports = PlatformerLevelScene;'
        );

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
        Date,
        Math,
        Phaser: {
            Scene: PhaserScene
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('purchased expedition power-ups', () => {
    const powerShot = {
        id: 'power_shot',
        name: 'Power Shot',
        type: 'powerup',
        usableInLevel: true,
        effect: { nextRangedDamageMultiplier: 5 }
    };

    test('stacks repeated purchases and never consumes outside an expedition', () => {
        const { manager } = loadInventoryManager();

        expect(manager.addItem(powerShot)).toBe(true);
        expect(manager.addItem(powerShot)).toBe(true);
        expect(manager.getAllItems()).toHaveLength(1);
        expect(manager.getItem(0).quantity).toBe(2);

        expect(manager.useItem(0)).toBe(false);
        expect(manager.getItem(0).quantity).toBe(2);
    });

    test('accepts an existing stack even when all inventory slots are occupied', () => {
        const fullInventory = [
            { ...powerShot, quantity: 1, slot: 0 },
            ...Array.from({ length: 29 }, (_, index) => ({
                id: `egg_${index}`,
                name: `Egg ${index}`,
                type: 'egg',
                quantity: 1,
                slot: index + 1
            }))
        ];
        const { manager } = loadInventoryManager(fullInventory);

        expect(manager.hasSpace()).toBe(false);
        expect(manager.canAcceptItem(powerShot)).toBe(true);
        expect(manager.addItem(powerShot)).toBe(true);
        expect(manager.getAllItems()).toHaveLength(30);
        expect(manager.getItem(0).quantity).toBe(2);
    });

    test('consumes exactly one item only after the level accepts its effect', () => {
        const { manager } = loadInventoryManager([{ ...powerShot, quantity: 2, slot: 0 }]);
        const applyPowerup = jest.fn(() => ({
            success: true,
            message: 'Power Shot charged'
        }));

        expect(manager.useItem(0, { applyPowerup })).toBe(true);
        expect(applyPowerup).toHaveBeenCalledWith(powerShot.effect, expect.objectContaining({
            id: 'power_shot'
        }));
        expect(manager.getItem(0).quantity).toBe(1);

        expect(manager.useItem(0, {
            applyPowerup: () => ({ success: false, message: 'Already charged' })
        })).toBe(false);
        expect(manager.getItem(0).quantity).toBe(1);
    });

    test('applies every authored shop effect to live expedition state', () => {
        const economyManager = {
            setLevelCoinMultiplier: jest.fn()
        };
        const PlatformerLevelScene = loadPlatformerLevelScene({
            EconomyManager: economyManager
        });
        const scene = new PlatformerLevelScene();
        scene.maxCrystalEnergy = 5;
        scene.crystalEnergy = 2;
        scene.maxHealth = 4;
        scene.health = 1;
        scene.updateEnergyDisplay = jest.fn();
        scene.updateHealthDisplay = jest.fn();

        expect(scene.applyPowerupEffect({ crystalEnergy: 3 }).success).toBe(true);
        expect(scene.crystalEnergy).toBe(5);

        expect(scene.applyPowerupEffect({ nextRangedDamageMultiplier: 5 }).success).toBe(true);
        expect(scene.nextRangedDamageMultiplier).toBe(5);

        expect(scene.applyPowerupEffect({ shieldHits: 2 }).success).toBe(true);
        expect(scene.powerupShieldHits).toBe(2);

        expect(scene.applyPowerupEffect({ freeSpecialAttack: 1 }).success).toBe(true);
        expect(scene.freeSpecialAttackCharges).toBe(1);

        expect(scene.applyPowerupEffect({ fullHealth: true }).success).toBe(true);
        expect(scene.health).toBe(4);

        expect(scene.applyPowerupEffect({ coinMultiplier: 2 }).success).toBe(true);
        expect(scene.levelCoinMultiplier).toBe(2);
        expect(economyManager.setLevelCoinMultiplier).toHaveBeenCalledWith(2);
    });

    test('exposes activation from the expedition pause menu and keeps basic fire free', () => {
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const inventorySource = fs.readFileSync(
            path.join(__dirname, '../scenes/InventoryScene.js'),
            'utf8'
        );
        const rangedButtonBlock = platformerSource.slice(
            platformerSource.indexOf("id: 'ranged'"),
            platformerSource.indexOf("id: 'melee'")
        );

        expect(platformerSource).toContain('showPowerupMenu()');
        expect(platformerSource).toContain('applyPowerup: (effect, powerupItem)');
        expect(platformerSource).toContain('this.nextRangedDamageMultiplier = 1;');
        expect(platformerSource).toContain('this.freeSpecialAttackCharges -= 1;');
        expect(rangedButtonBlock).toContain('energyCost: 0');
        expect(inventorySource).toContain(
            'Use during an expedition from the pause menu.'
        );
    });

    test('migrates legacy route maps out of finite inventory slots', () => {
        const legacyMap = {
            id: 'map_stellar_reef',
            name: 'Stellar Reef Map',
            type: 'map',
            gateId: 'stellar_reef',
            slot: 0
        };
        const { manager, gameState, state } = loadInventoryManager([
            legacyMap,
            { ...powerShot, quantity: 1, slot: 1 }
        ]);

        expect(gameState.addMapToCollection).toHaveBeenCalledWith('stellar_reef');
        expect(state.hubWorld.mapsOwned).toEqual(['stellar_reef']);
        expect(manager.getAllItems()).toEqual([
            expect.objectContaining({
                id: 'power_shot',
                slot: 0
            })
        ]);
        expect(state.inventory.items).toEqual(manager.getAllItems());
    });
});

describe('Sanctuary Void Crystal keepsakes', () => {
    const voidCrystal = {
        id: 'void_crystal',
        name: 'Void Crystal',
        type: 'utility',
        quantity: 1,
        slot: 0
    };

    test('places a crystal persistently and consumes exactly one item', () => {
        const { manager, gameState, state } = loadInventoryManager([
            { ...voidCrystal, quantity: 2 }
        ]);
        const placementHandler = jest.fn();
        manager.on('utilityUsed', placementHandler);

        expect(manager.useItem(0)).toBe(true);
        expect(state.world.sanctuaryDecorations.voidCrystals).toBe(1);
        expect(manager.getItem(0).quantity).toBe(1);
        expect(gameState.save).toHaveBeenCalled();
        expect(placementHandler).toHaveBeenCalledWith(expect.objectContaining({
            count: 1,
            limit: 3,
            message: expect.stringContaining('(1/3)')
        }));
        expect(manager.getLastUseResult()).toEqual(expect.objectContaining({
            success: true,
            message: expect.stringContaining('Sanctuary')
        }));
    });

    test('does not consume a crystal after the three-piece corner is complete', () => {
        const { manager, state } = loadInventoryManager([voidCrystal]);
        state.world = {
            sanctuaryDecorations: {
                voidCrystals: 3
            }
        };

        expect(manager.useItem(0)).toBe(false);
        expect(manager.getItem(0)).toEqual(expect.objectContaining({
            id: 'void_crystal',
            quantity: 1
        }));
        expect(state.world.sanctuaryDecorations.voidCrystals).toBe(3);
        expect(manager.getLastUseResult()).toEqual({
            success: false,
            message: 'The Sanctuary crystal corner is complete.'
        });
    });

    test('counts placed and carried crystals before allowing another purchase', () => {
        const { manager, state } = loadInventoryManager([
            { ...voidCrystal, quantity: 2 }
        ]);
        state.world = {
            sanctuaryDecorations: {
                voidCrystals: 1
            }
        };

        expect(manager.getUtilityCapacity('void_crystal')).toEqual({
            placed: 1,
            carried: 2,
            total: 3,
            limit: 3,
            canAcquire: false
        });
    });

    test('keeps unsupported utility items instead of silently consuming them', () => {
        const souvenir = {
            id: 'future_keepsake',
            name: 'Future Keepsake',
            type: 'utility',
            quantity: 1,
            slot: 0
        };
        const { manager } = loadInventoryManager([souvenir]);

        expect(manager.useItem(0)).toBe(false);
        expect(manager.getItem(0)).toEqual(expect.objectContaining({
            id: 'future_keepsake'
        }));
    });

    test('wires saved decoration rendering, live refresh, and shop capacity UI', () => {
        const worldBuilderSource = fs.readFileSync(
            path.join(__dirname, '../systems/world/WorldBuilder.js'),
            'utf8'
        );
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const shopSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/ShopScene.js'),
            'utf8'
        );

        expect(worldBuilderSource).toContain(
            "window.GameState?.get?.('world.sanctuaryDecorations.voidCrystals')"
        );
        expect(worldBuilderSource).toContain('refreshSanctuaryKeepsakes(');
        expect(gameSceneSource).toContain(
            "window.InventoryManager.on('utilityUsed', placementHandler, this)"
        );
        expect(gameSceneSource).toContain(
            "window.InventoryManager?.off('utilityUsed', placementHandler, this)"
        );
        expect(shopSceneSource).toContain(
            "getUtilityCapacity?.('void_crystal')"
        );
        expect(shopSceneSource).toContain("label: capacity.placed >= capacity.limit ? 'FULL' : 'PACKED'");
        expect(shopSceneSource).toContain('this.previewVoidCrystalCapacity');
    });
});
