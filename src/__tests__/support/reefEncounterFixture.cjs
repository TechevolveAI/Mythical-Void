const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const StaticBody = require('phaser/src/physics/arcade/StaticBody');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const { parse } = require('@babel/parser');
const { compiledModuleSource } = require('./compiledInventorySource.cjs');
const victorySource = compiledModuleSource('scenes/controllers/ReefVictorySequence.js');
const baseSource = fs.readFileSync(path.join(__dirname, '../../scenes/PlatformerLevelScene.js'), 'utf8');
const baseClass = parse(baseSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const baseMethod = name => {
    const node = baseClass.body.body.find(node => node.key?.name === name);
    return new Function(`return ({${baseSource.slice(node.start, node.end)}}).${name};`)();
};

const source = fs.readFileSync(path.join(__dirname, '../../scenes/levels/ReefLevel.js'), 'utf8')
    .replace(/^import PlatformerLevelScene from .*;$/m, '')
    .replace(/^import ReefGuardianControl from .*;$/m, () =>
        fs.readFileSync(path.join(__dirname, '../../scenes/controllers/ReefGuardianControl.js'), 'utf8')
            .replace('export default class ', 'class '))
    .replace(/^import ReefVictorySequence from .*;$/m, '')
    .replace(/^import \{ createReefCompletionHandler \} from .*;$/m, '')
    .replace('export default ReefLevel;', '');

// Actual Reef methods with an inert base and installed physics, clock, tween and
// destruction primitives. Drawing/services are fictional; no Game/Scene/browser.
function fixture(services = {}) {
    class Base {
        constructor(config) { Object.assign(this, config); }
        init() { this.levelCompletionActive = false; }
        shutdown() {}
        enterLevelCompletionState() {}
    }
    for (const name of ['enterLevelCompletionState', 'scheduleGuardianTransition', 'cancelGuardianTransition', 'cancelGuardianTransitions']) Base.prototype[name] = baseMethod(name);
    if (!services.GameState) {
        const state = { state: { creature: { id: 'synthetic-reef-creature' } }, saveAdmission: { status: 'ready', epoch: 1 },
            saveKey: 'synthetic-reef-state', storageMode: 'synthetic', on: () => () => {} };
        state.getSaveAdmission = () => ({ ...state.saveAdmission });
        state.get = path => path.split('.').reduce((value, key) => value?.[key], state.state);
        state.getHatchActiveIdentity = () => 'synthetic-reef-identity';
        state.captureSaveAdmissionOwner = () => { const root = state.state, data = JSON.stringify(root); return { isCurrent: () => state.state === root && JSON.stringify(root) === data }; };
        services.GameState = state;
    }
    services.setTimeout ||= () => 0; services.clearTimeout ||= () => {};
    const Victory = new Function('window', 'module', victorySource + '\nreturn module.exports.default;')(services, { exports: {} });
    // Combat fixtures stop at an explicit completion port. Actual writer,
    // achievements and rewards run separately in ReefVictoryLifecycle.
    const completionBoundary = () => Object.assign(() => { throw Error('COMPLETION_BOUNDARY_NOT_EXERCISED'); },
        { present() { throw Error('COMPLETION_BOUNDARY_NOT_EXERCISED'); } });
    const Level = new Function('PlatformerLevelScene', 'window', 'console', 'ReefVictorySequence', 'createReefCompletionHandler', `${source}\nreturn ReefLevel;`)(
        Base, services, { log() {}, warn() {} }, Victory, completionBoundary);
    const scene = new Level();
    Object.assign(scene, { events: new EventEmitter(),
        sys: { scale: { width: 1000, height: 800 }, isActive: () => true, queueDepthSort() {} },
        takeDamage: jest.fn(), openReefBossRecovery: jest.fn(), showFloatingText: jest.fn(),
        showVictoryScreen: jest.fn() });
    scene.sys.events = scene.events;
    scene.sys.scene = scene; scene.sys.settings = { key: 'ReefLevel' };
    scene.sys.game = { scene: { getScene: key => key === 'ReefLevel' ? scene : null } };
    scene.scene = { key: 'ReefLevel' }; scene.input = { keyboard: {} }; scene.cameras = { main: { setZoom: jest.fn() } };
    scene.endInvincibility = jest.fn(); scene.clearVirtualJumpInput = jest.fn(); scene.hidePlatformerMobileControls = jest.fn();
    scene.guardianTransitionGuards = new Map();
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], graphics = [], zones = [], colliders = [], configs = [], timers = [];
    const object = (width = 20, height = 30) => {
        const value = new GameObject(scene, 'SyntheticReefObject');
        Object.assign(value, { x: 0, y: 0, width, height, displayWidth: width, displayHeight: height,
            originX: 0.5, originY: 0.5, displayOriginX: width / 2, displayOriginY: height / 2,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        value.setPosition = (x, y) => { Object.assign(value, { x, y }); return value; };
        value.setAlpha = alpha => { value.alpha = alpha; return value; };
        value.setScale = scale => { value.scaleX = value.scaleY = scale; return value; };
        for (const method of ['setDepth', 'fillStyle', 'fillCircle', 'lineStyle', 'strokeCircle', 'lineBetween']) {
            value[method] = jest.fn(() => value);
        }
        value.setVelocity = (...args) => { value.body.setVelocity(...args); return value; };
        objects.push(value); return value;
    };
    const addBody = (value, isStatic = false) => {
        value.body = isStatic ? new StaticBody(world, value) : new Body(world, value);
        world.add(value.body); return value;
    };
    const actor = (x = 200, y = 200) => addBody(object().setPosition(x, y));
    scene.add = {
        graphics() { const value = object(); graphics.push(value); return value; },
        zone(x, y, width, height) { const value = object(width, height).setPosition(x, y); zones.push(value); return value; }
    };
    scene.physics = { world, pause: () => world.pause(), add: { existing: addBody, overlap(...args) {
        const collider = world.addOverlap(...args); colliders.push(collider); return collider;
    } } };
    const clock = new Clock(scene); scene.time = clock;
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (delay, callback) => { const event = delayedCall(delay, callback); timers.push(event); return event; };
    const tweens = new TweenManager(scene); scene.tweens = tweens;
    const addTween = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return addTween(config); };
    scene.init();
    scene.player = actor(); scene.bossBody = actor(500, 200); scene.boss = object().setPosition(500, 200);
    scene.bossFightActive = true; scene.bossDefeated = false; scene.bossCombatReady = true;
    scene.guardianEncounter = { id: 'synthetic-reef' };
    const persistent = world.addOverlap(scene.player, [], () => {});
    const process = () => { world.colliders.update(); world.postUpdate(); };
    const advance = delta => {
        clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
        tweens.getDelta = () => delta; tweens.step(true); process();
    };
    process();
    return { scene, world, clock, tweens, objects, graphics, zones, colliders, configs, timers, actor, process, advance,
        start() { const count = zones.length; scene.bossDimensionalTear(); process(); return zones[count]; },
        contact() { world.update(clock.now, 1000 / 60); process(); },
        onlyPersistent() { process(); expect(world.colliders.getActive()).toEqual([persistent]); },
        close() {
            scene.events.emit('shutdown'); scene.cancelGuardianTransitions(); tweens.destroy(); clock.destroy();
            objects.forEach(value => value.destroy()); process(); world.shutdown();
        } };
}

module.exports = { fixture };
