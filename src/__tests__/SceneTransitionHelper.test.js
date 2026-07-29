const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadDefaultClass(filePath, fallbackName) {
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source.replace(/export default class (\w+)/, 'class $1');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console
    };

    const className = transformed.match(/class (\w+)/)?.[1] || fallbackName;
    const script = `${transformed}\nmodule.exports = ${className};`;
    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('SceneTransitionHelper', () => {
    let SceneTransitionHelper;

    beforeAll(() => {
        SceneTransitionHelper = loadDefaultClass(
            path.join(__dirname, '../utils/SceneTransitionHelper.js'),
            'SceneTransitionHelper'
        );
    });

    const createSceneManager = () => ({
        isActive: jest.fn(() => false),
        stop: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        bringToTop: jest.fn()
    });

    const createScene = (manager, sceneKey = 'InventoryScene') => ({
        scene: manager,
        sys: {
            settings: {
                key: sceneKey
            }
        }
    });

    test('stops only the active scenes in a scene list', () => {
        const manager = createSceneManager();
        manager.isActive.mockImplementation((sceneKey) => sceneKey === 'GameScene' || sceneKey === 'ShopScene');

        const scene = createScene(manager);
        const stoppedAny = SceneTransitionHelper.stopActiveScenes(scene, ['GameScene', 'ShopScene', 'HubWorldScene']);

        expect(stoppedAny).toBe(true);
        expect(manager.stop).toHaveBeenCalledTimes(2);
        expect(manager.stop).toHaveBeenNthCalledWith(1, 'GameScene');
        expect(manager.stop).toHaveBeenNthCalledWith(2, 'ShopScene');
    });

    test('can stop and resume the current or target scene safely', () => {
        const manager = createSceneManager();
        const scene = createScene(manager, 'FusionPodScene');

        expect(SceneTransitionHelper.stopScene(scene)).toBe(true);
        expect(manager.stop).toHaveBeenCalledWith();

        expect(SceneTransitionHelper.resumeScene(scene, 'GameScene')).toBe(true);
        expect(manager.resume).toHaveBeenCalledWith('GameScene');
    });

    test('brings either the provided scene or the current scene to the top', () => {
        const manager = createSceneManager();
        const scene = createScene(manager, 'SoulRevealScene');

        expect(SceneTransitionHelper.bringToTop(scene)).toBe(true);
        expect(manager.bringToTop).toHaveBeenCalledWith('SoulRevealScene');

        expect(SceneTransitionHelper.bringToTop(scene, 'GameScene')).toBe(true);
        expect(manager.bringToTop).toHaveBeenLastCalledWith('GameScene');
    });
});
