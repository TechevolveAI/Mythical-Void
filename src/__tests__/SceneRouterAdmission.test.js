const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');

const routerSource = fs.readFileSync(path.join(__dirname, '../scenes/controllers/GameSceneSceneRouter.js'), 'utf8');
function installedMethods(file, names) {
    const text = fs.readFileSync(require.resolve(file), 'utf8'), found = {};
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ObjectProperty' && names.includes(node.key?.name) && node.value.type === 'FunctionExpression') {
            found[node.key.name] = new Function(`return (${text.slice(node.value.start, node.value.end)});`)();
        }
        Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(walk) : walk(value));
    }
    walk(parse(text, { sourceType: 'script' }));
    names.forEach(name => { if (!found[name]) throw Error(`Missing installed method ${name}`); });
    return found;
}
const pluginMethods = installedMethods('phaser/src/scene/ScenePlugin.js', ['pause', 'resume', 'launch', 'start', 'bringToTop']);
const queueMethods = installedMethods('phaser/src/scene/SceneManager.js', ['queueOp', 'processQueue']);

// Installed Phaser queue/ScenePlugin methods with fictional scene activation and
// frame delivery. No Game/Scene, real audio, browser, assets or save owner opens.
function fixture(registered = true) {
    let resolveLoad;
    let owner = null, loading = false;
    const sceneWindow = {
        AudioManager: { playButtonClick: jest.fn() },
        UXEnhancements: {
            showLoading: jest.fn((message, token = null) => { owner = token; loading = true; }),
            hideLoading: jest.fn((token = null) => { if (token === null || token === owner) loading = false; })
        },
        SceneLoader: { loadScene: jest.fn(() => new Promise(resolve => { resolveLoad = resolve; })) }
    };
    const active = new Set(['GameScene']), paused = new Set(), operations = [];
    const manager = { ...queueMethods, _pending: [], _queue: [], _start: [],
        keys: registered ? { GameScene: {}, InventoryScene: {}, ShopScene: {} } : {},
        isActive: key => active.has(key) && !paused.has(key),
        isPaused: key => paused.has(key),
        pause(key) { paused.add(key); operations.push(['pause', key]); },
        resume(key) { paused.delete(key); operations.push(['resume', key]); },
        start(key, data) { active.add(key); operations.push(['start', key, data]); },
        stop(key) { active.delete(key); paused.delete(key); operations.push(['stop', key]); },
        bringToTop: jest.fn() };
    const plugin = { ...pluginMethods, key: 'GameScene', manager };
    const scene = { scene: plugin, events: new EventEmitter(),
        sys: { settings: { key: 'GameScene' } }, game: { scene: manager, events: new EventEmitter() } };
    const Router = new Function('window', `${routerSource.replace('export default class ', 'class ')}\nreturn GameSceneSceneRouter;`)(sceneWindow);
    const router = scene.sceneRouter = new Router(scene);
    return { sceneWindow, scene, manager, plugin, router, Router, active, paused, operations,
        isLoading: () => loading,
        finishLoading: value => resolveLoad(value),
        frame() { manager.processQueue(); scene.game.events.emit('poststep'); },
        close() { scene._isShuttingDown = true; scene.events.emit('shutdown'); scene.game.events.removeAllListeners(); } };
}

describe('Sanctuary routing admits one owned opening through the Phaser queue frame', () => {
    beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => jest.restoreAllMocks());

    test('two resolved requests before the same native queue frame cannot open different menus', async () => {
        const f = fixture();
        try {
            await expect(f.router.pauseAndLaunchScene('ShopScene')).resolves.toBe(true);
            await expect(f.router.pauseAndLaunchScene('InventoryScene')).resolves.toBe(false);
            expect(f.manager._queue.map(item => [item.op, item.keyA])).toEqual([
                ['pause', 'GameScene'], ['start', 'ShopScene']
            ]);
            f.frame();
            expect(f.active.has('ShopScene')).toBe(true);
            expect(f.active.has('InventoryScene')).toBe(false);
            expect(f.router.activeTransition).toBeNull();
        } finally { f.close(); }
    });

    test.each(['sound', 'loading'])('reentrant %s feedback cannot queue a second destination', async boundary => {
        const f = fixture();
        try {
            let nested;
            const callback = () => { nested = f.router.pauseAndLaunchScene('InventoryScene'); };
            if (boundary === 'sound') f.sceneWindow.AudioManager.playButtonClick.mockImplementationOnce(callback);
            else f.sceneWindow.UXEnhancements.showLoading.mockImplementationOnce(callback);
            const opening = f.router.pauseAndLaunchScene('ShopScene', undefined, { sound: 'buttonClick', loadingMessage: 'Opening menu' });
            await expect(opening).resolves.toBe(true);
            await expect(nested).resolves.toBe(false);
            expect(f.manager._queue.filter(item => item.op === 'start').map(item => item.keyA)).toEqual(['ShopScene']);
        } finally { f.close(); }
    });

    test('an installed launch queue refusal does not leave the source paused', async () => {
        const f = fixture();
        try {
            const queue = f.manager.queueOp;
            f.manager.queueOp = function (...args) {
                if (args[0] === 'start') throw Error('fictional queue refusal before insertion');
                return queue.apply(this, args);
            };
            await expect(f.router.pauseAndLaunchScene('ShopScene')).resolves.toBe(false);
            f.frame();
            expect(f.paused.has('GameScene')).toBe(false);
            expect(f.active.has('ShopScene')).toBe(false);
        } finally { f.close(); }
    });

    test.each(['sound', 'loading'])('optional %s refusal does not abort a registered menu request', async boundary => {
        const f = fixture();
        try {
            const fail = () => { throw Error('fictional optional feedback refusal'); };
            if (boundary === 'sound') f.sceneWindow.AudioManager.playButtonClick.mockImplementationOnce(fail);
            else f.sceneWindow.UXEnhancements.showLoading.mockImplementationOnce(fail);
            await expect(f.router.pauseAndLaunchScene('ShopScene', undefined, { sound: 'buttonClick', loadingMessage: 'Opening menu' })).resolves.toBe(true);
            f.frame(); expect(f.active.has('ShopScene')).toBe(true);
        } finally { f.close(); }
    });

    test('normal native queue ordering and route data are retained', async () => {
        const f = fixture();
        try {
            const data = { tab: 'ship_parts' };
            await expect(f.router.pauseAndLaunchScene('InventoryScene', data, { bringToTop: true })).resolves.toBe(true);
            expect(f.manager._queue.map(item => [item.op, item.keyA])).toEqual([['pause', 'GameScene'], ['start', 'InventoryScene']]);
            expect(f.manager.bringToTop).toHaveBeenCalledWith('InventoryScene');
            f.frame();
            expect(f.operations).toEqual([['pause', 'GameScene'], ['start', 'InventoryScene', data]]);
        } finally { f.close(); }
    });

    test('a legitimate close and resume permits the next menu', async () => {
        const f = fixture();
        try {
            await f.router.pauseAndLaunchScene('ShopScene'); f.frame();
            f.manager.stop('ShopScene'); f.manager.resume('GameScene');
            await expect(f.router.pauseAndLaunchScene('InventoryScene')).resolves.toBe(true); f.frame();
            expect(f.active.has('InventoryScene')).toBe(true);
        } finally { f.close(); }
    });

    test('twenty normal open/close frames retain no routing lock or lifecycle listeners', async () => {
        const f = fixture();
        try {
            for (let index = 0; index < 20; index++) {
                const key = index % 2 ? 'ShopScene' : 'InventoryScene';
                await expect(f.router.pauseAndLaunchScene(key)).resolves.toBe(true); f.frame();
                expect(f.router.activeTransition).toBeNull();
                expect(f.router.pendingTransitions.size).toBe(0);
                expect(f.scene.game.events.listenerCount('poststep')).toBe(0);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                expect(f.scene.events.listenerCount('destroy')).toBe(0);
                f.manager.stop(key); f.manager.resume('GameScene');
            }
        } finally { f.close(); }
    });

    test('optional failed-load cleanup cannot reject the opening or retain its lock', async () => {
        const f = fixture(false);
        try {
            const first = f.router.pauseAndLaunchScene('ShopScene', undefined, { loadingMessage: 'Opening menu' });
            f.sceneWindow.UXEnhancements.hideLoading.mockImplementationOnce(() => { throw Error('fictional optional cleanup refusal'); });
            f.finishLoading(false);
            await expect(first).resolves.toBe(false);
            expect(f.router.pendingTransitions.size).toBe(0); expect(f.router.activeTransition).toBeNull();
            f.sceneWindow.SceneLoader.loadScene.mockResolvedValueOnce(true);
            await expect(f.router.pauseAndLaunchScene('ShopScene')).resolves.toBe(true); f.frame();
            expect(f.active.has('ShopScene')).toBe(true);
        } finally { f.close(); }
    });

    test('same-destination reentry coalesces before optional callbacks run', async () => {
        const f = fixture();
        try {
            let nested;
            f.sceneWindow.AudioManager.playButtonClick.mockImplementationOnce(() => { nested = f.router.pauseAndLaunchScene('ShopScene'); });
            const opening = f.router.pauseAndLaunchScene('ShopScene', undefined, { sound: 'buttonClick' });
            expect(nested).toBe(opening);
            await opening; expect(f.manager._queue.filter(item => item.op === 'start')).toHaveLength(1);
        } finally { f.close(); }
    });

    test('a synchronous load callback is also behind the opening reservation', async () => {
        const f = fixture(false);
        try {
            let nested;
            f.sceneWindow.SceneLoader.loadScene.mockImplementationOnce(() => {
                nested = f.router.pauseAndLaunchScene('InventoryScene');
                return Promise.resolve(true);
            });
            await expect(f.router.pauseAndLaunchScene('ShopScene')).resolves.toBe(true);
            await expect(nested).resolves.toBe(false);
            expect(f.sceneWindow.SceneLoader.loadScene).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'replaced', 'finale'])('%s during refused launch cannot resume another owner', async reason => {
        const f = fixture();
        try {
            const queue = f.manager.queueOp;
            f.manager.queueOp = function (...args) {
                if (args[0] === 'start') {
                    if (reason === 'shutdown') { f.scene._isShuttingDown = true; f.scene.events.emit('shutdown'); }
                    if (reason === 'replaced') f.scene.sceneRouter = new f.Router(f.scene);
                    if (reason === 'finale') f.scene._finaleTransitionPending = true;
                    throw Error('fictional retired queue refusal');
                }
                return queue.apply(this, args);
            };
            await expect(f.router.pauseAndLaunchScene('ShopScene')).resolves.toBe(false);
            expect(f.manager._queue.filter(item => item.op === 'resume')).toHaveLength(0);
        } finally { f.close(); }
    });

    test('a stale failed load cannot hide a successor loading owner', async () => {
        const f = fixture(false);
        try {
            const first = f.router.pauseAndLaunchScene('ShopScene', undefined, { loadingMessage: 'Opening shop' });
            f.scene.sceneRouter = new f.Router(f.scene);
            f.sceneWindow.UXEnhancements.showLoading('Opening a newer screen', {});
            f.finishLoading(false);
            await expect(first).resolves.toBe(false);
            expect(f.isLoading()).toBe(true);
        } finally { f.close(); }
    });

    test('frame and shutdown listeners retire only their own pending request', async () => {
        const f = fixture();
        try {
            await f.router.pauseAndLaunchScene('ShopScene');
            expect(f.scene.game.events.listenerCount('poststep')).toBe(1);
            const stale = f.scene.game.events.listeners('poststep')[0];
            f.scene.events.emit('shutdown');
            expect(f.scene.game.events.listenerCount('poststep')).toBe(0);
            const successor = f.scene.sceneRouter = new f.Router(f.scene);
            await successor.pauseAndLaunchScene('InventoryScene');
            const current = successor.activeTransition;
            stale(); expect(successor.activeTransition).toBe(current);
            f.frame(); expect(successor.activeTransition).toBeNull();
        } finally { f.close(); }
    });

    test('an optional topmost request failure does not undo an accepted overlay launch', async () => {
        const f = fixture();
        try {
            f.manager.bringToTop.mockImplementationOnce(() => { throw Error('fictional ordering feedback failure'); });
            await expect(f.router.pauseAndLaunchScene('ShopScene', undefined, { bringToTop: true })).resolves.toBe(true);
            f.frame(); expect(f.active.has('ShopScene')).toBe(true); expect(f.paused.has('GameScene')).toBe(true);
        } finally { f.close(); }
    });
});

describe('lazy scene registration owns only its own optional loading presentation', () => {
    const loaderSource = fs.readFileSync(path.join(__dirname, '../utils/SceneLoader.js'), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export .*;$/gm, '');
    const createLoader = () => new Function('devLog', 'devWarn', 'requestIdleCallback', `${loaderSource}\nreturn new SceneLoaderClass();`)(
        jest.fn(), jest.fn(), callback => callback()
    );
    beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
    afterEach(() => { delete window.UXEnhancements; jest.restoreAllMocks(); });

    test.each(['showLoading', 'hideLoading'])('%s refusal cannot prevent code registration', async method => {
        const loader = createLoader(), Scene = class {};
        loader.preload = jest.fn().mockResolvedValue({ default: Scene });
        window.UXEnhancements = { showLoading: jest.fn(), hideLoading: jest.fn() };
        window.UXEnhancements[method].mockImplementation(() => { throw Error('fictional optional loader UI failure'); });
        const game = { scene: { keys: {}, add: jest.fn() } };
        await expect(loader.loadScene(game, 'ShopScene')).resolves.toBe(true);
        expect(game.scene.add).toHaveBeenCalledWith('ShopScene', Scene, false);
    });

    test.each(['success', 'failure'])('an older %s cannot dismiss another in-flight registration', async outcome => {
        const loader = createLoader(), waiting = {};
        loader.preload = jest.fn(name => new Promise((resolve, reject) => { waiting[name] = { resolve, reject }; }));
        let owner = null, visible = false;
        window.UXEnhancements = {
            showLoading(message, token = null) { owner = token; visible = true; },
            hideLoading(token = null) { if (token === null || token === owner) visible = false; }
        };
        const game = { scene: { keys: {}, add: jest.fn() } };
        const first = loader.loadScene(game, 'ShopScene'), second = loader.loadScene(game, 'InventoryScene');
        if (outcome === 'success') waiting.ShopScene.resolve({ default: class {} });
        else waiting.ShopScene.reject(Error('fictional offline first registration'));
        await expect(first).resolves.toBe(outcome === 'success');
        expect(visible).toBe(true);
        waiting.InventoryScene.resolve({ default: class {} });
        await expect(second).resolves.toBe(true); expect(visible).toBe(false);
    });
});
