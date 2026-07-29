const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadShopScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/ShopScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace("import Phaser from 'phaser';", '')
        .replace(
            "import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';",
            'const SceneTransitionHelper = {};'
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
        Phaser: {
            Scene: PhaserScene
        }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createScene({
    mapsOwned = [],
    gateUnlocked = false,
    mapWriteSucceeds = true,
    inventoryHasSpace = true
} = {}) {
    const state = {
        player: { cosmicCoins: 1000 },
        hubWorld: {
            mapsOwned,
            gates: {
                stellar_reef: { unlocked: gateUnlocked }
            }
        }
    };
    const get = jest.fn(propertyPath => propertyPath
        .split('.')
        .reduce((value, key) => value?.[key], state));
    const sceneWindow = {
        GameState: {
            get,
            addMapToCollection: jest.fn(() => mapWriteSucceeds)
        },
        EconomyManager: {
            purchase: jest.fn(() => true),
            addCoins: jest.fn()
        },
        InventoryManager: {
            hasSpace: jest.fn(() => inventoryHasSpace),
            addItem: jest.fn(() => true)
        },
        AudioManager: {
            playError: jest.fn(),
            playShopPurchase: jest.fn(() => true)
        }
    };
    const ShopScene = loadShopScene(sceneWindow);
    const scene = new ShopScene();
    scene.selectedCategory = 'utilities';
    scene.time = {
        delayedCall: jest.fn((delay, callback) => callback())
    };
    scene.showLoadingOverlay = jest.fn();
    scene.hideLoadingOverlay = jest.fn();
    scene.showPurchaseError = jest.fn();
    scene.showPurchaseSuccess = jest.fn();
    scene.updateCoinDisplay = jest.fn();
    scene.displayCategory = jest.fn();
    scene.isPurchasing = false;

    return { scene, sceneWindow };
}

describe('shop permanent route-map purchases', () => {
    const routeMap = {
        id: 'map_stellar_reef',
        name: 'Stellar Reef Map',
        price: 400,
        type: 'map',
        gateId: 'stellar_reef'
    };

    test('does not charge for a route that is already open', () => {
        const { scene, sceneWindow } = createScene({ gateUnlocked: true });

        scene.purchaseItem(routeMap);

        expect(sceneWindow.EconomyManager.purchase).not.toHaveBeenCalled();
        expect(scene.showPurchaseError).toHaveBeenCalledWith(
            'That route is already open.'
        );
        expect(scene.isPurchasing).toBe(false);
    });

    test('supports a non-saving open-route preview for visual QA', () => {
        const { scene } = createScene();

        scene.init({ routeMapPreview: ['stellar_reef'] });

        expect(scene.isRouteMapUnavailable(routeMap)).toBe(true);
    });

    test('reserves separate mobile space for header, catalog text, price, and action', () => {
        const { scene } = createScene();
        scene.cameras = {
            main: {
                width: 390,
                height: 844
            }
        };

        scene.calculateResponsiveDimensions();

        expect(scene.dims).toEqual(expect.objectContaining({
            isMobile: true,
            headerHeight: 92,
            catalogStartY: 157,
            itemHeight: 98,
            closeButtonSize: 50
        }));
        expect(scene.dims.catalogStartY).toBeGreaterThan(
            scene.dims.headerHeight + scene.dims.categoryHeight
        );
    });

    test('records a map directly as permanent progression without using inventory', () => {
        const { scene, sceneWindow } = createScene({
            inventoryHasSpace: false
        });

        scene.purchaseItem(routeMap);

        expect(sceneWindow.EconomyManager.purchase).toHaveBeenCalledWith(
            400,
            'Stellar Reef Map'
        );
        expect(sceneWindow.GameState.addMapToCollection).toHaveBeenCalledWith(
            'stellar_reef'
        );
        expect(sceneWindow.InventoryManager.hasSpace).not.toHaveBeenCalled();
        expect(sceneWindow.InventoryManager.addItem).not.toHaveBeenCalled();
        expect(scene.showPurchaseSuccess).toHaveBeenCalledWith(routeMap);
        expect(scene.displayCategory).toHaveBeenCalledWith('utilities');
        expect(scene.isPurchasing).toBe(false);
    });

    test('refunds coins when permanent progression cannot be recorded', () => {
        const { scene, sceneWindow } = createScene({
            mapWriteSucceeds: false
        });

        scene.purchaseItem(routeMap);

        expect(sceneWindow.EconomyManager.addCoins).toHaveBeenCalledWith(
            400,
            'shop_refund'
        );
        expect(scene.showPurchaseError).toHaveBeenCalledWith(
            'Route map could not be recorded. Your coins were returned.'
        );
        expect(scene.showPurchaseSuccess).not.toHaveBeenCalled();
        expect(scene.isPurchasing).toBe(false);
    });
});
