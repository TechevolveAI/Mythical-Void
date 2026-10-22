const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const clamp = require('phaser/src/math/Clamp');

const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
const source = read('scenes/levels/VoidPeaksLevel.js');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const base = read('scenes/PlatformerLevelScene.js');
const parent = parse(base, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const parentNames = ['onPlayerDeath', 'retryFromCheckpoint', 'pauseFailureRecoveryClock', 'resumeFailureRecoveryClock', 'clearDeathScreen',
    'scheduleGuardianTransition', 'cancelGuardianTransition', 'cancelGuardianTransitions'];
const parentMethods = parent.body.body.filter(node => parentNames.includes(node.key?.name))
    .map(node => base.slice(node.start, node.end)).join('\n');
const geometry = read('systems/MountainBossAscent.js').replace(/^export /gm, '');
const { MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME, mountainEmitter } = new Function(`${geometry};return {MOUNTAIN_ASCENT,MOUNTAIN_BOSS_NAME,mountainEmitter};`)();
const patterns = read('systems/MountainBossPatterns.js').replace(/^export /gm, '');
const { mountainAttackPlan, nextMountainAttack } = new Function(`${patterns};return {mountainAttackPlan,nextMountainAttack};`)();
const constantNames = ['COSMIC_TITAN_TEXTURE', 'TITAN_ARENA', 'TITAN_ATTACK_WINDOWS', 'TITAN_ATTACK_WINDUP', 'TITAN_RECOVERY_WINDOW', 'TITAN_PHASE_RECOVERY'];
const constants = parse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'VariableDeclaration' && constantNames.includes(node.declarations[0]?.id?.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
const names = ['init', 'startBossFight', 'stageTitanArenaEntry', 'spawnCosmicTitan',
    'createTitanEntrance', 'clearTitanEntrance', 'updateTitanEntrance',
    'fireMountainSnowGrenade', 'clearMountainSnowGrenades', 'trackBossEffect',
    'releaseBossEffect', 'scheduleBossTimer', 'scheduleTitanControlTimer', 'cancelTitanControlTimer', 'clearTitanControlTimers',
    'isTitanControlTimerPending',
    'clearBossEncounterTimers', 'clearBossEncounterEffects', 'onPlayerDeath',
    'fireMountainGroundWave', 'fireMountainLaser', 'fireMountainProjectile', 'clearMountainProjectiles',
    'executeTitanAttack', 'clearMountainAttackLaunches', 'captureMountainAttackContext',
    'beginTitanCombat', 'getTitanOpeningCameraCenterX', 'startTitanAttackLoop', 'performTitanAttack',
    'broadcastTitanWarning', 'createTitanAttackTelegraph', 'getMountainAttackEmitters', 'enterTitanPhase',
    'damageBoss', 'defeatBoss', 'startSavedPeakVictory', 'updateDeferredTitanCombat', 'startTitanWindup', 'clearTitanWindup'];
const methods = cls.body.body.filter(node => names.includes(node.key?.name)).map(node => source.slice(node.start, node.end)).join('\n');
const Scene = new Function('MOUNTAIN_ASCENT', 'MOUNTAIN_BOSS_NAME', 'mountainEmitter', 'mountainAttackPlan', 'nextMountainAttack', 'Phaser', 'finishPeaksCompletion', `
    ${constants}
    class Parent { init() {} ${parentMethods} }
    return class extends Parent { ${methods} };
`)(MOUNTAIN_ASCENT, MOUNTAIN_BOSS_NAME, mountainEmitter, mountainAttackPlan, nextMountainAttack, {
    Math: { Clamp: clamp }, Cameras: { Scene2D: { Effects: { Pan: require('phaser/src/cameras/2d/effects/Pan') } } }
}, scene => scene.commitPeakVictory());

// Installed physics, timers, tweens and destruction. Drawing/input/recovery UI
// are fictional boundaries; no renderer, game, browser, audio or save is opened.
function fixture() {
    const scene = new Scene();
    Object.assign(scene, { events: new EventEmitter(), scene: {},
        sys: { scale: { width: 8000, height: 1200 }, isActive: () => true, queueDepthSort() {} },
        bossFightActive: true, bossCombatReady: true, bossDefeated: false, bossPhase: 1,
        guardianEncounter: { active: true }, bossEncounterEffects: new Set(), bossEncounterTimers: new Set(),
        endInvincibility: jest.fn(), resetPlatformerRecoveryInput: jest.fn(), hidePlatformerMobileControls: jest.fn(),
        clearLevelEntryKeyHandler: jest.fn(),
        beginInvincibility: jest.fn(), showPlatformerMobileControls: jest.fn(), updateHealthDisplay: jest.fn(),
        updateEnergyDisplay: jest.fn(), showFloatingText: jest.fn(), checkpointPosition: { x: 5040, y: 386 },
        maxHealth: 3, maxCrystalEnergy: 100,
        showDeathScreen: jest.fn(), input: { keyboard: { enabled: true } }, takeDamage: jest.fn() });
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], timers = [], configs = [], colliders = [];
    const object = (x, y, radius = 10) => {
        const value = new GameObject(scene, 'SyntheticMountainObject');
        Object.assign(value, { x, y, width: radius * 2, height: radius * 2,
            displayWidth: radius * 2, displayHeight: radius * 2, originX: 0.5, originY: 0.5,
            displayOriginX: radius, displayOriginY: radius, scaleX: 1, scaleY: 1,
            alpha: 1, angle: 0, rotation: 0 });
        value.setPosition = (px, py) => { value.x = px; value.y = py; return value; };
        value.setAlpha = alpha => { value.alpha = alpha; return value; };
        value.setScale = scale => { value.scaleX = value.scaleY = scale; return value; };
        value.setVelocity = (...args) => { value.body.setVelocity(...args); return value; };
        for (const name of ['setStrokeStyle', 'setDepth']) value[name] = jest.fn(() => value);
        objects.push(value); return value;
    };
    const addBody = value => { value.body = new Body(world, value); world.add(value.body); return value; };
    const actor = (x = 5040, y = 386) => addBody(object(x, y));
    scene.boss = actor(4890, 400);
    Object.assign(scene.boss, { displayWidth: 170, displayHeight: 225, originX: 0.49, originY: 0.97 });
    scene.player = actor();
    scene.add = { circle: jest.fn((x, y, radius) => object(x, y, radius)) };
    scene.physics = { world, pause: () => world.pause(), resume: () => world.resume(), add: { existing: addBody,
        overlap(...args) { const collider = world.addOverlap(...args); colliders.push(collider); return collider; } } };
    // Combat components stop at the save boundary. The actual writer and
    // refusal/retry path execute separately in PeaksCompletionTransaction.
    scene.enterLevelCompletionState = () => { scene.levelCompletionActive = true; world.pause(); };
    scene.commitPeakVictory = jest.fn(() => scene.startSavedPeakVictory({ isCurrent: () => true }));
    const clock = scene.time = new Clock(scene);
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (...args) => { const timer = delayedCall(...args); timers.push(timer); return timer; };
    const tweens = scene.tweens = new TweenManager(scene);
    const add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    const persistent = world.addOverlap(scene.player, [], () => {});
    const process = () => { world.colliders.update(); world.postUpdate(); };
    process();
    return { scene, world, clock, tweens, objects, timers, configs, colliders, actor, object, process,
        start(target = { x: 5040, y: 386 }) { const value = scene.fireMountainSnowGrenade(target); process(); return value; },
        advance(delta) {
            clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
            tweens.getDelta = () => delta; tweens.step(true); process();
        },
        contact() { world.update(clock.now, 1000 / 60); process(); },
        onlyPersistent() {
            process();
            const active = world.colliders.getActive();
            expect(active).toHaveLength(1);
            expect(active[0]).toBe(persistent);
        },
        close() {
            scene.events.emit('shutdown'); scene.clearBossEncounterTimers(); scene.clearBossEncounterEffects();
            tweens.destroy(); clock.destroy(); objects.forEach(value => value.destroy()); process(); world.shutdown();
        } };
}

module.exports = { fixture };
