const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const GameObject = require('phaser/src/gameobjects/GameObject');
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
const source = read('scenes/levels/AuroraDepthsLevel.js');
const ast = parse(source, { sourceType: 'module' }).program.body;
const cls = ast.find(node => node.type === 'ClassDeclaration');
const constants = ast.filter(node => node.type === 'VariableDeclaration' &&
    ['PHOENIX_ATTACK_WINDOWS', 'PHOENIX_ATTACK_CUES', 'PHOENIX_ATTACK_WINDUP', 'PHOENIX_RECOVERY_WINDOW', 'PHOENIX_PHASE_RECOVERY']
        .includes(node.declarations[0]?.id?.name)).map(node => source.slice(node.start, node.end)).join('\n');
const names = ['init', 'executeBossAttack', 'dispatchBossAttack', 'showBossAttackInstruction',
    'beginPhoenixPhase', 'triggerPhase2', 'triggerPhase3', 'damageBoss', 'openPhoenixRecovery',
    'trackBossEffect', 'releaseBossEffect', 'scheduleBossTimer', 'trackBossTimer',
    'clearBossEncounterTimers', 'clearBossEncounterEffects', 'createPhoenixAttackTelegraph',
    'bossFlameDive', 'bossShadowFeathers', 'bossFireTrail', 'bossRebirthNova', 'bossShadowClones',
    'consumeCurrentCharge', 'shutdown'];
const methods = cls.body.body.filter(node => names.includes(node.key?.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
const timingPath = path.join(__dirname, '../../scenes/controllers/PhoenixCombatTime.js');
let PhoenixCombatTime;
if (fs.existsSync(timingPath)) {
    const timingSource = fs.readFileSync(timingPath, 'utf8');
    const timingClass = parse(timingSource, { sourceType: 'module' }).program.body
        .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
    PhoenixCombatTime = new Function(`return (${timingSource.slice(timingClass.start, timingClass.end)});`)();
}

// Installed physics, clocks, tweens and destruction. Drawing, feedback and
// persistence are inert boundaries; no Game, renderer, browser or audio opens.
function fixture() {
    const services = {};
    const Scene = new Function('PhoenixCombatTime', 'window', `${constants}
        class Parent { init() {} shutdown() {} }
        return class extends Parent { ${methods} };
    `)(PhoenixCombatTime, services);
    const scene = new Scene();
    Object.assign(scene, { events: new EventEmitter(), scene: {},
        sys: { scale: { width: 5200, height: 1200 }, isActive: () => true, queueDepthSort() {} },
        cameras: { main: { width: 390, height: 844 } }, levelHeight: 1200,
        clearLevelEntryKeyHandler: jest.fn() });
    scene.sys.events = scene.events;
    const systems = scene.sys, events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], timers = [];
    const object = (x = 0, y = 0) => {
        const value = new GameObject(scene, 'SyntheticAuroraObject');
        Object.assign(value, { x, y, width: 40, height: 60, displayWidth: 40, displayHeight: 60,
            originX: 0.5, originY: 0.5, displayOriginX: 20, displayOriginY: 30,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0 });
        value.setPosition = (px, py) => { value.x = px; value.y = py; return value; };
        value.setAlpha = alpha => { value.alpha = alpha; return value; };
        value.setScale = scale => { value.scaleX = value.scaleY = scale; return value; };
        value.setVelocity = (...args) => { value.body.setVelocity(...args); return value; };
        for (const name of ['clear', 'lineStyle', 'strokeCircle', 'lineBetween', 'fillStyle', 'fillCircle', 'fillTriangle',
            'fillRect', 'setDepth', 'setOrigin', 'setScrollFactor', 'setTint', 'clearTint', 'setColor']) {
            value[name] = jest.fn(() => value);
        }
        value.setText = text => { value.text = text; return value; };
        objects.push(value); return value;
    };
    const actor = (x, y) => {
        const value = object(x, y); value.body = new Body(world, value); world.add(value.body); return value;
    };
    const clock = scene.time = new Clock(scene), tweens = scene.tweens = new TweenManager(scene);
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (...args) => { const timer = delayedCall(...args); timers.push(timer); return timer; };
    scene.physics = { world, pause: () => world.pause(), resume: () => world.resume() };
    scene.add = { graphics: () => object(), text: () => object(), sprite: (x, y) => object(x, y) };
    scene.init({});
    Object.assign(scene, { boss: actor(500, 800), bossBody: actor(500, 835), player: actor(200, 800),
        bossFightActive: true, bossHealth: 100, bossMaxHealth: 100,
        guardianEncounter: { id: 'synthetic-phoenix', active: true }, bossSubtitle: object(),
        bossTargetScale: 1, updateBossHealthBar: jest.fn(), showFloatingText: jest.fn(),
        consumeCurrentCharge: jest.fn(() => 0), startBossHover: jest.fn(), onBossDefeated: jest.fn(),
        clearCurrentChargeAura: jest.fn(), clearQuietLightPickup: jest.fn(), refreshPersistedExpeditionRouteState: jest.fn(),
        showPlatformerMobileControls: jest.fn(), takeDamage: jest.fn(), handlePlayerDamage: jest.fn() });
    return { scene, clock, tweens, world, timers, objects, actor, services,
        capture: () => PhoenixCombatTime.capture(scene),
        advance(delta) {
            clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
            tweens.getDelta = () => delta; tweens.step(true);
            world.colliders.update(); world.postUpdate();
        },
        close() {
            scene.pauseMenuSession?.retire(); scene.phoenixRecoveryWindow?.retire();
            scene.sys = systems; scene.events = events;
            scene.events.emit('shutdown'); scene.clearBossEncounterTimers(); scene.clearBossEncounterEffects();
            tweens.destroy(); clock.destroy(); objects.forEach(value => value.destroy()); world.shutdown();
        } };
}
module.exports = { fixture };
