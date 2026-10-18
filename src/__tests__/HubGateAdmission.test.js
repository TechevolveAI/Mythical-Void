const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const GameObject = require('phaser/src/gameobjects/GameObject');

const hubSource = fs.readFileSync(path.join(__dirname, '../scenes/HubWorldScene.js'), 'utf8')
    .replace(/import[\s\S]*?;\s*/g, '').replace('export default class ', 'class ');
const controllerPath = path.join(__dirname, '../scenes/controllers/HubGateTransitionController.js');
const routeMap = [
    ['mythical_forest', 'MythicalForestLevel'], ['crystal_caves', 'CrystalCavesLevel'],
    ['stellar_reef', 'ReefLevel'], ['void_peaks', 'VoidPeaksLevel'],
    ['aurora_depths', 'AuroraDepthsLevel'], ['final_void', 'FinalVoidLevel']
];

// Actual Hub methods with an inert parent, native Clock/Tween/GameObject primitives
// and fictional route requests/services. No Phaser Game/Scene or browser opens.
function fixture() {
    let epoch = 1, admissionStatus = 'ready', loadingOwner = null, loading = false;
    const services = {
        GameState: { enterGate: jest.fn(() => ({ success: true })), get: jest.fn(() => 'baby'),
            getSaveAdmission: () => ({ epoch, status: admissionStatus }) },
        CompanionMediaService: { prepareCinematic: jest.fn() },
        AudioManager: { playPurchase: jest.fn() },
        UXEnhancements: {
            showLoading: jest.fn((text, owner = null) => { loadingOwner = owner; loading = true; }),
            hideLoading: jest.fn((owner = null) => { if (owner === null || owner === loadingOwner) loading = false; })
        },
        SceneLoader: { loadScene: jest.fn().mockResolvedValue(true) }
    };
    const Controller = fs.existsSync(controllerPath)
        ? new Function('window', `${fs.readFileSync(controllerPath, 'utf8').replace('export default class ', 'class ')}\nreturn HubGateTransitionController;`)(services)
        : undefined;
    const phaser = { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
        Math: { FloatBetween: (min, max) => (min + max) / 2, Between: (min, max) => Math.floor((min + max) / 2) },
        Utils: { Array: { GetRandom: values => values[0] } } };
    const Hub = new Function('Phaser', 'window', 'companionMediaService', 'HubGateTransitionController', `${hubSource}\nreturn HubWorldScene;`)(
        phaser, services, services.CompanionMediaService, Controller
    );
    const scene = new Hub();
    Object.assign(scene, { events: new EventEmitter(),
        sys: { scale: { width: 390, height: 844 }, queueDepthSort() {}, isActive: () => !scene._isShuttingDown },
        dims: { width: 390, height: 844, isMobile: true }, game: { scene: { keys: {} } },
        scene: { start: jest.fn() }, input: new EventEmitter(),
        cameras: { main: { zoom: 1, scrollX: 0, scrollY: 0,
            setZoom: jest.fn(function(zoom) { this.zoom = zoom; }), startFollow: jest.fn() } },
        getExpeditionResumeForGate: jest.fn(() => null), showLevelLoadError: jest.fn(),
        showUnlockConfirmation: jest.fn(), showComingSoonModal: jest.fn(), closeFirstExpeditionInvitation: jest.fn() });
    scene.sys.events = scene.events;
    const objects = [], tweenConfigs = [], timerCallbacks = [];
    scene.add = { graphics() {
        const object = new GameObject(scene, 'SyntheticGateGraphic');
        Object.assign(object, { x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1 });
        for (const method of ['setDepth', 'clear', 'fillStyle', 'fillCircle', 'lineStyle', 'strokeCircle']) object[method] = jest.fn(() => object);
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        objects.push(object); return object;
    } };
    const clock = new Clock(scene); scene.time = clock;
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (delay, callback) => { timerCallbacks.push({ delay, callback }); return delayedCall(delay, callback); };
    const tweens = new TweenManager(scene); scene.tweens = tweens;
    const addTween = tweens.add.bind(tweens);
    tweens.add = config => { tweenConfigs.push(config); return addTween(config); };
    scene.init();
    const gates = Object.fromEntries(routeMap.map(([id]) => [id,
        { id, x: 120, y: 300, config: { color: 0x66CCFF }, data: { name: `Synthetic ${id}`, biome: id } }
    ]));
    const advance = delta => {
        clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
        tweens.getDelta = () => delta; tweens.step(true);
    };
    return { scene, services, gates, objects, timerCallbacks, tweenConfigs, advance,
        isLoading: () => loading,
        changeEpoch: () => { epoch++; },
        holdAdmission: () => { admissionStatus = 'held'; },
        settle: () => jest.advanceTimersByTimeAsync(0),
        close() {
            scene.shutdown(); clock.destroy(); tweens.destroy();
            objects.forEach(object => object.destroy());
        } };
}

describe('Hub gate entry keeps its own lifecycle across retries and returns', () => {
    beforeEach(() => {
        jest.useFakeTimers(); jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

    test.each(['media', 'effects'])('optional %s failure cannot prevent the independent entry fallback', async boundary => {
        const f = fixture();
        try {
            const problem = new Error('fictional optional gate startup failure');
            if (boundary === 'media') f.services.CompanionMediaService.prepareCinematic.mockImplementation(() => { throw problem; });
            else f.scene.playCinematicGateEntry = () => { throw problem; };
            expect(() => f.scene.enterGate(f.gates.mythical_forest)).not.toThrow();
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledWith('MythicalForestLevel');
            expect(f.services.SceneLoader.loadScene).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('an optional rejected media promise is handled without blocking entry', async () => {
        const f = fixture();
        try {
            f.services.CompanionMediaService.prepareCinematic.mockRejectedValue(Error('fictional optional media rejection'));
            f.scene.enterGate(f.gates.mythical_forest);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledWith('MythicalForestLevel');
            expect(console.warn).toHaveBeenCalledWith('[HubGate] Optional presentation unavailable');
        } finally { f.close(); }
    });

    test.each(['showLoading', 'hideLoading'])('optional %s failure cannot prevent a required scene request', async method => {
        const f = fixture();
        try {
            f.services.UXEnhancements[method].mockImplementation(() => { throw Error('fictional optional loading failure'); });
            f.scene.enterGate(f.gates.mythical_forest);
            f.advance(800);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledWith('MythicalForestLevel');
            expect(f.scene.showLevelLoadError).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a pending download from before shutdown cannot start a level after Hub init', async () => {
        const f = fixture();
        try {
            let oldResolve;
            f.services.SceneLoader.loadScene.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            f.scene.shutdown(); f.scene.init();
            f.scene.enterGate(f.gates.stellar_reef);
            oldResolve(true); await f.settle();
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(f.scene.isTransitioning).toBe(true);
            expect(f.scene.showLevelLoadError).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('an old failed download cannot clear a restarted Hub transition or its loading owner', async () => {
        const f = fixture();
        try {
            let oldReject;
            f.services.SceneLoader.loadScene.mockImplementationOnce(() => new Promise((resolve, reject) => { oldReject = reject; }));
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            f.scene.shutdown(); f.scene.init(); f.scene.enterGate(f.gates.stellar_reef);
            f.services.UXEnhancements.showLoading('A newer route', {});
            oldReject(Error('fictional retired download')); await f.settle();
            expect(f.scene.isTransitioning).toBe(true);
            expect(f.scene.gateTransitionStarted).toBe(false);
            expect(f.scene.showLevelLoadError).not.toHaveBeenCalled();
            expect(f.isLoading()).toBe(true);
        } finally { f.close(); }
    });

    test('an admission epoch change retires a pending entry without starting its old route', async () => {
        const f = fixture();
        try {
            let resolve;
            f.services.SceneLoader.loadScene.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            f.changeEpoch(); resolve(true); await f.settle();
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(f.scene.isTransitioning).toBe(false);
        } finally { f.close(); }
    });

    test.each(['state', 'plugin', 'held'])('%s ownership change rejects the pending scene request', async boundary => {
        const f = fixture();
        try {
            let resolve;
            f.services.SceneLoader.loadScene.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
            const plugin = f.scene.scene;
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            if (boundary === 'state') f.services.GameState = { ...f.services.GameState };
            if (boundary === 'plugin') f.scene.scene = { start: jest.fn() };
            if (boundary === 'held') f.holdAdmission();
            resolve(true); await f.settle();
            expect(plugin.start).not.toHaveBeenCalled();
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(f.scene.isTransitioning).toBe(false);
        } finally { f.close(); }
    });

    test('held admission rejects entry before gate bookkeeping or optional media', async () => {
        const f = fixture();
        try {
            f.holdAdmission();
            expect(f.scene.enterGate(f.gates.mythical_forest)).toBe(false);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.services.GameState.enterGate).not.toHaveBeenCalled();
            expect(f.services.CompanionMediaService.prepareCinematic).not.toHaveBeenCalled();
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(f.scene.isTransitioning).toBe(false);
        } finally { f.close(); }
    });

    test('a denied gate retains its unlock prompt without leaving an admitted transition', async () => {
        const f = fixture();
        try {
            f.services.GameState.enterGate.mockReturnValueOnce({ success: false });
            expect(f.scene.enterGate(f.gates.mythical_forest)).toBe(false);
            expect(f.scene.showUnlockConfirmation).toHaveBeenCalledWith(f.gates.mythical_forest);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.services.SceneLoader.loadScene).not.toHaveBeenCalled();
            expect(f.scene.isTransitioning).toBe(false);
        } finally { f.close(); }
    });

    test('reentrant gate bookkeeping cannot admit a second gate', () => {
        const f = fixture();
        try {
            f.services.GameState.enterGate.mockImplementationOnce(() => {
                f.scene.enterGate(f.gates.stellar_reef); return { success: true };
            });
            f.scene.enterGate(f.gates.mythical_forest);
            expect(f.services.GameState.enterGate).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a required bookkeeping exception is preserved without leaving a transition locked', async () => {
        const f = fixture();
        try {
            const error = Error('fictional required gate bookkeeping failure');
            f.services.GameState.enterGate.mockImplementationOnce(() => { throw error; });
            expect(() => f.scene.enterGate(f.gates.mythical_forest)).toThrow(error);
            expect(f.scene.isTransitioning).toBe(false);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.services.SceneLoader.loadScene).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(routeMap)('%s retains its existing scene mapping and single request', async (id, name) => {
        const f = fixture();
        try {
            f.scene.enterGate(f.gates[id]);
            expect(f.scene.beginGateSceneTransition(f.gates[id])).toBe(true);
            expect(f.scene.beginGateSceneTransition(f.gates[id])).toBe(false);
            await f.settle();
            expect(f.services.SceneLoader.loadScene).toHaveBeenCalledWith(f.scene.game, name);
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
            expect(f.scene.scene.start).toHaveBeenCalledWith(name);
            expect(f.services.GameState.enterGate).toHaveBeenCalledWith(id);
        } finally { f.close(); }
    });

    test.each(['keys', 'scenes'])('without a loader an already registered level in %s still opens', async index => {
        const f = fixture();
        try {
            delete f.services.SceneLoader;
            if (index === 'keys') f.scene.game.scene.keys.MythicalForestLevel = {};
            else f.scene.game.scene.scenes = [{ sys: { settings: { key: 'MythicalForestLevel' } } }];
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledWith('MythicalForestLevel');
        } finally { f.close(); }
    });

    test('without a loader an unregistered level is refused and can be retried after registration', async () => {
        const f = fixture();
        try {
            delete f.services.SceneLoader;
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            await f.settle();
            expect(f.scene.scene.start).not.toHaveBeenCalled();
            expect(f.scene.showLevelLoadError).toHaveBeenCalledTimes(1);
            expect(f.scene.isTransitioning).toBe(false);
            f.scene.game.scene.keys.MythicalForestLevel = {};
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest);
            await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each([['main', 'nebula'], ['synthetic_biome', 'synthetic_biome']])('%s retains its top-down route payload', async (id, biome) => {
        const f = fixture();
        try {
            const gate = { ...f.gates.mythical_forest, id, data: { biome } };
            f.scene.enterGate(gate); f.scene.beginGateSceneTransition(gate); await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledWith('GameScene', { biome });
            expect(f.services.SceneLoader.loadScene).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('failed loading clears the opaque wipe and allows a deliberate retry', async () => {
        const f = fixture();
        try {
            f.services.SceneLoader.loadScene.mockResolvedValueOnce(false);
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest); await f.settle();
            expect(f.scene.scene.start).not.toHaveBeenCalled(); expect(f.scene.isTransitioning).toBe(false);
            expect(f.scene.gateTransitionWipe).toBeNull(); expect(f.scene.showLevelLoadError).toHaveBeenCalledTimes(1);
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest); await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledWith('MythicalForestLevel');
        } finally { f.close(); }
    });

    test('a rejected required download restores the camera and permits a deliberate retry', async () => {
        const f = fixture();
        try {
            f.services.SceneLoader.loadScene.mockRejectedValueOnce(Error('fictional required download failure'));
            f.scene.enterGate(f.gates.mythical_forest); f.advance(16); f.advance(250);
            expect(f.scene.cameras.main.zoom).toBeGreaterThan(1);
            f.scene.beginGateSceneTransition(f.gates.mythical_forest); await f.settle();
            expect(f.scene.cameras.main.zoom).toBe(1);
            expect(f.scene.showLevelLoadError).toHaveBeenCalledTimes(1);
            expect(f.scene.isTransitioning).toBe(false);
            f.scene.enterGate(f.gates.mythical_forest); f.scene.beginGateSceneTransition(f.gates.mythical_forest); await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('normal native FX reaches one route before the wall-clock fallback', async () => {
        const f = fixture();
        try {
            f.scene.enterGate(f.gates.mythical_forest);
            for (let frame = 0; frame < 100; frame++) f.advance(16);
            await f.settle();
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a removed native wipe cannot throw or prevent independent entry', async () => {
        const f = fixture();
        try {
            f.scene.enterGate(f.gates.mythical_forest); f.advance(500);
            const wipe = f.scene.gateTransitionWipe;
            expect(wipe).toBeTruthy(); wipe.destroy();
            expect(() => f.advance(32)).not.toThrow();
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('direct Hub init retires the old native FX and restores its camera', async () => {
        const f = fixture();
        try {
            f.scene.enterGate(f.gates.mythical_forest); f.advance(16); f.advance(250);
            const old = f.scene.gateEntryController.current;
            expect(f.scene.cameras.main.zoom).toBeGreaterThan(1);
            f.scene.init();
            expect(f.scene.cameras.main.zoom).toBe(1);
            expect(old.retired).toBe(true); expect(old.tweens.size).toBe(0);
            for (let frame = 0; frame < 100; frame++) f.advance(16);
            expect(f.scene.cameras.main.zoom).toBe(1);
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('repeated synthetic returns release the owned FX, timers and loading before re-entry', async () => {
        const f = fixture();
        try {
            for (const [id, name] of routeMap) {
                f.scene.enterGate(f.gates[id]); f.advance(500);
                const attempt = f.scene.gateEntryController.current;
                f.scene.beginGateSceneTransition(f.gates[id]); await f.settle();
                expect(f.scene.scene.start).toHaveBeenLastCalledWith(name);
                f.scene.shutdown(); f.scene.init();
                expect(attempt.retired).toBe(true);
                expect(attempt.timers.size + attempt.tweens.size + attempt.objects.size).toBe(0);
                expect(f.isLoading()).toBe(false);
                expect(f.objects.every(object => !object.active)).toBe(true);
            }
            await jest.advanceTimersByTimeAsync(1800);
            expect(f.scene.scene.start).toHaveBeenCalledTimes(routeMap.length);
        } finally { f.close(); }
    });

    test('old scheduled FX cannot touch the camera or play entry sound after a new attempt', async () => {
        const f = fixture();
        try {
            f.scene.enterGate(f.gates.mythical_forest);
            const callbacks = f.timerCallbacks.map(item => item.callback);
            f.scene.shutdown(); f.scene.init(); f.scene.enterGate(f.gates.mythical_forest);
            const created = f.objects.length, sounds = f.services.AudioManager.playPurchase.mock.calls.length;
            callbacks.forEach(callback => callback()); await f.settle();
            expect(f.objects).toHaveLength(created);
            expect(f.services.AudioManager.playPurchase).toHaveBeenCalledTimes(sounds);
            expect(f.scene.gateTransitionStarted).toBe(false);
        } finally { f.close(); }
    });
});
