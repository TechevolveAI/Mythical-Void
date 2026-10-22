const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');
const Scene = require('phaser/src/scene/Scene');
const SceneManager = require('phaser/src/scene/SceneManager');

function createLoader() {
    const source = fs.readFileSync(path.join(__dirname, '../utils/SceneLoader.js'), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export .*;$/gm, '');
    return new Function('devLog', 'devWarn', `${source}\nreturn new SceneLoaderClass();`)(jest.fn(), jest.fn());
}

function fixture() {
    const game = { events: new EventEmitter() };
    const manager = game.scene = new SceneManager(game);
    manager.isBooted = true;
    // Keep Phaser's real add, duplicate-key check and operation queue, without
    // installing renderer/input plugins or booting a Game.
    manager.createSceneFromInstance = jest.fn((key, scene) => {
        scene.sys.scenePlugin = { _target: null };
        scene.sys.destroy = jest.fn();
        return scene;
    });
    const SceneClass = class extends Scene {
        constructor() { super({ key: 'SyntheticRoute' }); }
    };
    const loader = createLoader();
    let resolve;
    const module = new Promise(done => { resolve = done; });
    loader.sceneImports.SyntheticRoute = jest.fn(() => module);
    return { game, manager, loader, SceneClass, ready: () => resolve({ default: SceneClass }) };
}

describe('lazy registration owns a single scene in the native Phaser manager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        expect(jest.getTimerCount()).toBe(0);
        jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
        delete window.UXEnhancements;
    });

    test('two concurrent entry requests register once and both receive success', async () => {
        const f = fixture();
        const first = f.loader.loadScene(f.game, 'SyntheticRoute');
        const second = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.manager.keys.SyntheticRoute).toBe(f.manager.scenes[0]);
        expect(f.loader.sceneImports.SyntheticRoute).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
    });

    test.each(['immediate', 'queued'])('unknown %s registration does not call a throwing getScene lookup', async phase => {
        const f = fixture();
        f.manager.isProcessing = phase === 'queued';
        const lookup = jest.spyOn(f.manager, 'getScene').mockImplementation(() => {
            throw new Error('SYNTHETIC_UNKNOWN_SCENE');
        });
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(pending).resolves.toBe(true);
        f.manager.isProcessing = false;
        expect(() => f.manager.processQueue()).not.toThrow();
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.manager.keys.SyntheticRoute).toBe(f.manager.scenes[0]);
        expect(lookup).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    test.each(['scene update', 'preboot'])('concurrent requests during %s cannot queue duplicate registrations', async phase => {
        const f = fixture();
        f.manager.isProcessing = phase === 'scene update';
        f.manager.isBooted = phase !== 'preboot';
        const first = f.loader.loadScene(f.game, 'SyntheticRoute');
        const second = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        f.manager.isProcessing = false;
        f.manager.isBooted = true;
        expect(() => f.manager.processQueue()).not.toThrow();
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.manager._pending).toHaveLength(0);
    });

    test('registration by another owner during download is reused, not duplicated', async () => {
        const f = fixture();
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        const registered = f.manager.add('SyntheticRoute', f.SceneClass, false);
        f.ready();
        await expect(pending).resolves.toBe(true);
        expect(f.manager.keys.SyntheticRoute).toBe(registered);
        expect(f.manager.scenes).toHaveLength(1);
        expect(console.error).not.toHaveBeenCalled();
    });

    test('replacing the manager during download cannot register into the successor', async () => {
        const f = fixture();
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        const successor = f.game.scene = new SceneManager(f.game);
        successor.isBooted = true;
        successor.createSceneFromInstance = jest.fn((key, scene) => scene);
        f.ready();
        await expect(pending).resolves.toBe(false);
        expect(f.manager.scenes).toHaveLength(0);
        expect(successor.scenes).toHaveLength(0);
    });

    test('distinct managers share only the module download, not registration', async () => {
        const f = fixture(), other = fixture();
        const first = f.loader.loadScene(f.game, 'SyntheticRoute');
        const second = f.loader.loadScene(other.game, 'SyntheticRoute');
        f.ready();
        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(f.manager.scenes).toHaveLength(1);
        expect(other.manager.scenes).toHaveLength(1);
        expect(f.manager.scenes[0]).not.toBe(other.manager.scenes[0]);
    });

    test('a later request before the next frame reuses the accepted registration', async () => {
        const f = fixture();
        f.manager.isProcessing = true;
        const first = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(first).resolves.toBe(true);
        await expect(f.loader.loadScene(f.game, 'SyntheticRoute')).resolves.toBe(true);
        expect(f.manager._pending).toHaveLength(1);
        f.manager.isProcessing = false;
        expect(() => f.manager.processQueue()).not.toThrow();
    });

    test('a removed queued scene can be registered again on deliberate re-entry', async () => {
        const f = fixture();
        f.manager.isProcessing = true;
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await pending;
        f.manager.isProcessing = false;
        f.manager.processQueue();
        const previous = f.manager.keys.SyntheticRoute;
        f.manager.remove('SyntheticRoute');
        expect(previous.sys.destroy).toHaveBeenCalledTimes(1);
        await expect(f.loader.loadScene(f.game, 'SyntheticRoute')).resolves.toBe(true);
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.manager.keys.SyntheticRoute).not.toBe(previous);
        expect(f.loader.sceneImports.SyntheticRoute).toHaveBeenCalledTimes(1);
    });

    test('an independently queued registration is reused after download', async () => {
        const f = fixture();
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.manager.isProcessing = true;
        f.manager.add('SyntheticRoute', f.SceneClass, false);
        f.ready();
        await expect(pending).resolves.toBe(true);
        expect(f.manager._pending).toHaveLength(1);
        f.manager.isProcessing = false;
        expect(() => f.manager.processQueue()).not.toThrow();
        expect(f.manager.scenes).toHaveLength(1);
    });

    test('a registration exception releases admission and permits a deliberate retry', async () => {
        const f = fixture();
        jest.spyOn(f.manager, 'add').mockImplementationOnce(() => { throw new Error('SYNTHETIC_REGISTRATION_FAILURE'); });
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(pending).resolves.toBe(false);
        await expect(f.loader.loadScene(f.game, 'SyntheticRoute')).resolves.toBe(true);
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.loader.sceneImports.SyntheticRoute).toHaveBeenCalledTimes(1);
    });

    test('loading feedback re-entry cannot create another registration owner', async () => {
        const f = fixture();
        let reentered;
        window.UXEnhancements = {
            showLoading: jest.fn(() => { reentered = f.loader.loadScene(f.game, 'SyntheticRoute'); }),
            hideLoading: jest.fn()
        };
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(pending).resolves.toBe(true);
        await expect(reentered).resolves.toBe(true);
        expect(window.UXEnhancements.showLoading).toHaveBeenCalledTimes(1);
        expect(window.UXEnhancements.hideLoading).toHaveBeenCalledTimes(1);
        expect(f.manager.scenes).toHaveLength(1);
    });

    test('a destroyed manager cannot register or leave an admitted request after download', async () => {
        const f = fixture();
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.manager.game = null;
        f.ready();
        await expect(pending).resolves.toBe(false);
        expect(f.manager.scenes).toHaveLength(0);
        expect(f.manager._pending).toHaveLength(0);
    });

    test('manager replacement during loading dismissal cannot report success', async () => {
        const f = fixture();
        const successor = new SceneManager(f.game);
        window.UXEnhancements = { hideLoading: () => { f.game.scene = successor; } };
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(pending).resolves.toBe(false);
        expect(successor.scenes).toHaveLength(0);
    });

    test('a stalled registration releases admission and a late import cannot overwrite its retry', async () => {
        const f = fixture();
        const first = f.loader.loadScene(f.game, 'SyntheticRoute');
        const second = f.loader.loadScene(f.game, 'SyntheticRoute');
        await jest.advanceTimersByTimeAsync(15001);
        await expect(Promise.all([first, second])).resolves.toEqual([false, false]);
        expect(f.manager.scenes).toHaveLength(0);
        expect(f.loader.registrationPromises.get(f.manager).size).toBe(0);
        f.loader.sceneImports.SyntheticRoute.mockResolvedValue({ default: f.SceneClass });
        await expect(f.loader.loadScene(f.game, 'SyntheticRoute')).resolves.toBe(true);
        const registered = f.manager.keys.SyntheticRoute;
        f.ready();
        await jest.advanceTimersByTimeAsync(0);
        expect(f.manager.keys.SyntheticRoute).toBe(registered);
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.loader.sceneImports.SyntheticRoute).toHaveBeenCalledTimes(2);
        expect(f.loader.registrationPromises.get(f.manager).size).toBe(0);
    });

    test.each(['showLoading', 'hideLoading'])('optional %s failure cannot poison later registrations', async method => {
        const f = fixture();
        window.UXEnhancements = { [method]: () => { throw new Error('SYNTHETIC_LOADING_FEEDBACK_FAILURE'); } };
        const pending = f.loader.loadScene(f.game, 'SyntheticRoute');
        f.ready();
        await expect(pending).resolves.toBe(true);
        await expect(f.loader.loadScene(f.game, 'SyntheticRoute')).resolves.toBe(true);
        expect(f.manager.scenes).toHaveLength(1);
        expect(f.loader.registrationPromises.get(f.manager).size).toBe(0);
    });
});
