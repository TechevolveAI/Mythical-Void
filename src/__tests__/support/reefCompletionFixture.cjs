const { fixture, factsFor, installNativeRelease } = require('./levelCompletionFixture.cjs');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const TweenManager = require('phaser/src/tweens/TweenManager');

// Actual caller, transaction, managers, local writer, release and DOM. Native
// physics/clock/tweens execute; registration/storage/drawing/audio are synthetic.
function create(options = {}) {
    const { realm = 'reef', ...saveOptions } = options;
    if (!['reef', 'aurora'].includes(realm)) throw Error('UNKNOWN_COMPLETION_FIXTURE');
    const index = realm === 'aurora' ? 4 : 2;
    const f = fixture({ level: index, controlledTimers: true, ...saveOptions }); f.context.document = document;
    const wallTimers = new Map(); let serial = 0;
    Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
        addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
        setTimeout: callback => { wallTimers.set(++serial, callback); return serial; }, clearTimeout: id => wallTimers.delete(id) });
    f.selected.AudioManager.playLevelUp = jest.fn(() => f.effects.push({ kind: 'audio', name: 'playLevelUp' }));
    f.selected.FeedbackManager = { cameraFlash: jest.fn() };
    f.selected.FXLibrary = { stardustBurst: jest.fn() };
    const Scene = realm === 'aurora' ? f.api.NativeAurora : f.api.NativeReef;
    const scene = new Scene(factsFor(index), f.effects), release = installNativeRelease(f, scene);
    scene.sys.scale = { width: 390, height: 844 };
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    scene.physics = { world, pause: () => world.pause() };
    const object = () => {
        const value = release.object();
        Object.assign(value, { x: 0, y: 0, width: 20, height: 30, displayWidth: 20, displayHeight: 30,
            displayOriginX: 10, displayOriginY: 15, originX: 0.5, originY: 0.5,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        value.setAlpha = alpha => { value.alpha = alpha; return value; };
        return value;
    };
    const nativeActors = [];
    const actor = () => {
        const value = object(); value.body = new Body(world, value); world.add(value.body);
        nativeActors.push({ actor: value, body: value.body, destroy: value.body.destroy });
        value.setVelocity = (x, y) => { value.body.setVelocity(x, y); return value; }; return value;
    };
    scene.player = actor(); scene.boss = realm === 'aurora' ? actor() : object(); scene.bossBody = actor(); scene.bossBody.x = 500; scene.bossBody.y = 200;
    if (realm === 'aurora') {
        scene.boss.x = 4400; scene.boss.y = 550; scene.boss.setTint = jest.fn(() => scene.boss);
        scene.bossGlow = object(); scene.bossExposureText = release.object('exposure');
        scene.add.graphics = () => object();
    }
    scene.bossUI = object(); scene.bossRouteText = release.object('route');
    scene.endInvincibility = jest.fn(); scene.clearVirtualJumpInput = jest.fn(); scene.hidePlatformerMobileControls = jest.fn();
    const boss = scene.boss, bodyActor = scene.bossBody;
    const tweens = scene.tweens = new TweenManager(scene), configs = [], add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    const advance = delta => {
        f.advanceClock(delta); release.advance(delta); tweens.getDelta = () => delta; tweens.step(true);
        world.postUpdate();
    };
    const rewards = () => {
        if (scene.residentReleaseOpen) { scene.residentReleaseClose(); advance(100); }
        return scene.regionalVictoryPanel;
    };
    return { f, scene, release, world, tweens, configs, boss, bodyActor, actor, object, wallTimers, advance, rewards,
        close() {
            // Source assertions finish before teardown. Restore deliberately
            // corrupted native bindings only to let Phaser release its own bodies.
            for (const { actor, body, destroy } of nativeActors) if (actor.scene === scene && actor.active) {
                actor.body = body; body.world = world; body.gameObject = actor; body.destroy = destroy;
            }
            scene.events.emit('shutdown'); scene.cancelGuardianTransitions(); scene.regionalVictoryPanel?.destroy();
            tweens.destroy(); release.close(); world.postUpdate(); world.shutdown(); f.close();
        } };
}
module.exports = { create };
