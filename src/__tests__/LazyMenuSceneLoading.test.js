const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRouter(sceneWindow) {
    const filePath = path.join(
        __dirname,
        '../scenes/controllers/GameSceneSceneRouter.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export default class GameSceneSceneRouter',
            'class GameSceneSceneRouter'
        )
        .concat('\nmodule.exports = GameSceneSceneRouter;\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: sceneWindow,
        console,
        Promise,
        Map,
        Error
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('lazy menu scene loading', () => {
    test('waits for registration before pausing Sanctuary', async () => {
        let finishLoading;
        const loadScene = jest.fn(() => new Promise(resolve => {
            finishLoading = resolve;
        }));
        const sceneWindow = {
            SceneLoader: { loadScene },
            UXEnhancements: {
                showLoading: jest.fn(),
                hideLoading: jest.fn()
            }
        };
        const manager = {
            pause: jest.fn(),
            launch: jest.fn()
        };
        const game = { scene: { keys: {}, scenes: [] } };
        const Router = loadRouter(sceneWindow);
        const router = new Router({ scene: manager, game });

        const transition = router.pauseAndLaunchScene(
            'ShopScene',
            undefined,
            { loadingMessage: 'Opening Cosmic Shop...' }
        );

        expect(loadScene).toHaveBeenCalledWith(game, 'ShopScene');
        expect(manager.pause).not.toHaveBeenCalled();
        expect(manager.launch).not.toHaveBeenCalled();

        finishLoading(true);
        await transition;

        expect(manager.pause).toHaveBeenCalledTimes(1);
        expect(manager.launch).toHaveBeenCalledWith('ShopScene', undefined);
    });

    test('deduplicates repeated taps while a scene chunk loads', async () => {
        let finishLoading;
        const loadScene = jest.fn(() => new Promise(resolve => {
            finishLoading = resolve;
        }));
        const sceneWindow = {
            SceneLoader: { loadScene },
            UXEnhancements: {
                showLoading: jest.fn(),
                hideLoading: jest.fn()
            }
        };
        const manager = {
            pause: jest.fn(),
            launch: jest.fn()
        };
        const game = { scene: { keys: {}, scenes: [] } };
        const Router = loadRouter(sceneWindow);
        const router = new Router({ scene: manager, game });

        const first = router.pauseAndLaunchScene('InventoryScene');
        const second = router.pauseAndLaunchScene('InventoryScene');

        expect(second).toBe(first);
        expect(loadScene).toHaveBeenCalledTimes(1);

        finishLoading(true);
        await first;

        expect(manager.pause).toHaveBeenCalledTimes(1);
        expect(manager.launch).toHaveBeenCalledTimes(1);
    });

    test('keeps the active scene running when a menu cannot load', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const sceneWindow = {
            SceneLoader: { loadScene: jest.fn().mockResolvedValue(false) },
            UXEnhancements: {
                showLoading: jest.fn(),
                hideLoading: jest.fn()
            }
        };
        const manager = {
            pause: jest.fn(),
            launch: jest.fn()
        };
        const game = { scene: { keys: {}, scenes: [] } };
        const Router = loadRouter(sceneWindow);
        const router = new Router({ scene: manager, game });

        await expect(router.pauseAndLaunchScene('ShopScene')).resolves.toBe(false);

        expect(manager.pause).not.toHaveBeenCalled();
        expect(manager.launch).not.toHaveBeenCalled();
        expect(sceneWindow.UXEnhancements.hideLoading).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            '[SceneRouter] Failed to open ShopScene:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    test('production bootstrap does not eagerly import menu scenes', () => {
        const game = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const globalInit = fs.readFileSync(
            path.join(__dirname, '../global-init.js'),
            'utf8'
        );

        ['ShopScene', 'InventoryScene', 'CreatureProfileScene', 'AchievementMenuScene']
            .forEach(sceneKey => {
                expect(game).not.toContain(`import ${sceneKey} from`);
                expect(globalInit).not.toContain(`import './scenes/${sceneKey}.js'`);
            });
    });
});
