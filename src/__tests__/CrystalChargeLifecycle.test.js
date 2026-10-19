const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const Velocity = require('phaser/src/physics/arcade/components/Velocity');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const names = ['bossChargeAttack', 'clearCrystalBossCharge', 'clearCrystalBossSlam', 'clearCrystalBossPacing', 'clearCrystalStalactiteFalls', 'damageBoss'];
const methods = Object.fromEntries(declaration.body.body.filter(node => names.includes(node.key?.name)).map(node => [
    node.key.name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
        {}, { log() {} }
    )
]));

// Native body/velocity/destruction/clock primitives, with synthetic scene and
// drawing services. No Game/Scene, browser, WebGL, sound or save owner is started.
function fixture(phase = 2) {
    const scene = { ...methods, sys: { scale: { width: 1000, height: 700 }, isActive: () => true, queueDepthSort() {} },
        events: new EventEmitter(), bossPhase: phase, bossDefeated: false, bossPhaseTransitioning: false,
        bossHealth: 100, bossMaxHealth: 100, bossTelegraphs: new Set(),
        updateBossHealthBar: jest.fn(), showFloatingText: jest.fn(), requestCrystalBossPhase2: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const graphics = [], actors = [], tweens = [], activeTweens = new Set();
    const graphic = () => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width: 20, height: 30, displayWidth: 20, displayHeight: 30,
            originX: 0.5, originY: 0.5, displayOriginX: 10, displayOriginY: 15,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        for (const name of ['fillStyle', 'fillCircle', 'setDepth']) object[name] = () => object;
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        return object;
    };
    const actor = () => {
        const object = graphic();
        Object.assign(object, Velocity);
        object.body = new Body(world, object); world.add(object.body);
        object.setTint = jest.fn(value => { object.tint = value; return object; });
        object.clearTint = jest.fn(() => { object.tint = null; return object; });
        actors.push(object); return object;
    };
    scene.player = actor().setPosition(100, 200);
    scene.boss = actor().setPosition(500, 200);
    scene.add = { graphics: () => { const value = graphic(); graphics.push(value); return value; } };
    scene.tweens = { add: config => { tweens.push(config); activeTweens.add(config); return config; },
        killTweensOf: jest.fn(target => { for (const tween of activeTweens) if (tween.targets === target) activeTweens.delete(tween); }) };
    scene.onBossDefeated = jest.fn(() => {
        scene.bossDefeated = true;
        scene.clearCrystalBossPacing({ includePhase: true });
        scene.boss.body.enable = false;
        scene.boss.setTint(0x8FE3CF);
    });
    const clock = new Clock(scene); scene.time = clock;
    const advance = delta => { clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate(); };
    return { scene, world, clock, graphics, actors, actor, tweens, activeTweens, advance,
        close() {
            scene.events.emit('shutdown'); clock.destroy();
            graphics.forEach(object => object.destroy()); actors.forEach(object => object.destroy());
            world.postUpdate(); world.shutdown();
        } };
}

describe('Crystal Guardian charge and restoration callbacks retain their encounter owner', () => {
    test('a destroyed native boss body cannot be touched by the old stop timer', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack();
            f.scene.boss.destroy();
            expect(() => f.advance(600)).not.toThrow();
            expect(f.graphics.length).toBe(0);
        } finally { f.close(); }
    });

    test('old charge timers cannot stop or recolour a replacement boss', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack(); f.advance(100);
            const previous = f.scene.boss;
            const replacement = f.actor(); replacement.setVelocityX(777);
            f.scene.boss = replacement;
            f.advance(500);
            expect(replacement.body.velocity.x).toBe(777);
            expect(previous.body.velocity.x).toBe(0);
            expect(replacement.setTint).not.toHaveBeenCalled();
            expect(replacement.clearTint).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('an older charge cannot end the next charge on the same body', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack(); f.advance(100);
            const oldStop = f.clock._active.find(timer => timer.delay === 600).callback;
            f.scene.bossChargeAttack();
            oldStop();
            expect(f.scene.boss.body.velocity.x).toBe(-400);
            f.advance(500);
            expect(f.scene.boss.body.velocity.x).toBe(-400);
            f.advance(100);
            expect(f.scene.boss.body.velocity.x).toBe(0);
        } finally { f.close(); }
    });

    test('stopped charge callbacks cannot add images or end a newer hit flash', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack();
            const trail = f.clock._pendingInsertion.find(timer => timer.delay === 50).callback;
            const stop = f.clock._pendingInsertion.find(timer => timer.delay === 600).callback;
            f.advance(600);
            const count = f.graphics.length;
            f.scene.damageBoss(1);
            trail(); stop();
            expect(f.graphics.length).toBe(count);
            expect(f.scene.boss.tint).toBe(0xFFFFFF);
        } finally { f.close(); }
    });

    test('a final-hit flash cannot repaint the freed Guardian red', () => {
        const f = fixture();
        try {
            f.scene.bossHealth = 1;
            f.scene.damageBoss(1);
            expect(f.scene.boss.tint).toBe(0x8FE3CF);
            f.advance(100);
            expect(f.scene.boss.tint).toBe(0x8FE3CF);
        } finally { f.close(); }
    });

    test('an old flash cannot end a newer hit flash early', () => {
        const f = fixture();
        try {
            f.scene.damageBoss(1); f.advance(50);
            f.scene.damageBoss(1); f.advance(50);
            expect(f.scene.boss.tint).toBe(0xFFFFFF);
            f.advance(50);
            expect(f.scene.boss.tint).toBe(0xFF6B6B);
        } finally { f.close(); }
    });

    test('a live hit flash keeps its full duration across the normal charge stop', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack(); f.advance(550);
            f.scene.damageBoss(1); f.advance(50);
            expect(f.scene.boss.body.velocity.x).toBe(0);
            expect(f.scene.boss.tint).toBe(0xFFFFFF);
            f.advance(50);
            expect(f.scene.boss.tint).toBe(0xFF6B6B);
        } finally { f.close(); }
    });

    test('a retired hit flash cannot recolour another boss', () => {
        const f = fixture();
        try {
            f.scene.damageBoss(1);
            const replacement = f.actor(); f.scene.boss = replacement;
            f.advance(100);
            expect(replacement.setTint).not.toHaveBeenCalled();
            expect(replacement.clearTint).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('one hundred hit flashes retain only the latest timer', () => {
        const f = fixture();
        try {
            f.scene.bossHealth = 10000; f.scene.bossMaxHealth = 10000;
            for (let index = 0; index < 100; index++) {
                f.scene.damageBoss(1); f.advance(1);
                expect(f.clock._active.length).toBe(1);
            }
            f.advance(100); f.advance(1);
            expect(f.clock._active.length).toBe(0);
            expect(f.scene.boss.tint).toBe(0xFF6B6B);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'phase', 'defeat'])('%s retires dash work and live after-images', reason => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack(); f.advance(100);
            const callbacks = f.clock._active.map(timer => timer.callback);
            const completions = f.tweens.map(tween => tween.onComplete);
            if (reason === 'shutdown') f.scene.events.emit('shutdown');
            else if (reason === 'defeat') f.scene.onBossDefeated();
            else f.scene.clearCrystalBossPacing({ includePhase: true });
            const count = f.graphics.length;
            callbacks.forEach(callback => callback()); completions.forEach(callback => callback());
            expect(f.graphics.length).toBe(count);
            expect(f.graphics.every(image => !image.active)).toBe(true);
            expect(f.activeTweens.size).toBe(0);
            expect(f.scene.crystalBossCharge).toBeNull();
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test.each([1, 2])('normal phase %s dash keeps its speed, trail cadence, stop time and tint', phase => {
        const f = fixture(phase);
        try {
            f.scene.bossChargeAttack();
            expect(f.scene.boss.body.velocity.x).toBe(-400);
            const event = f.clock._pendingInsertion.find(timer => timer.delay === 50);
            expect(event.repeatCount).toBe(8);
            for (let tick = 0; tick < 12; tick++) f.advance(50);
            expect(f.scene.boss.body.velocity.x).toBe(0);
            expect(f.graphics.length).toBe(9);
            expect(f.scene.boss.tint).toBe(phase === 2 ? 0xFF6B6B : null);
            f.tweens.forEach(tween => {
                expect(tween.duration).toBe(300);
                expect(tween.alpha).toBe(0);
                expect(tween.scaleX).toBe(0.5);
                tween.onComplete();
            });
            expect(f.graphics.every(image => !image.active)).toBe(true);
            expect(f.scene.crystalBossCharge).toBeNull();
        } finally { f.close(); }
    });

    test('native clock pause cannot use up a charge while the level is paused', () => {
        const f = fixture();
        try {
            f.scene.bossChargeAttack(); f.clock.paused = true; f.advance(3000);
            expect(f.scene.boss.body.velocity.x).toBe(-400);
            expect(f.graphics.length).toBe(0);
            f.clock.paused = false; f.advance(599);
            expect(f.scene.boss.body.velocity.x).toBe(-400);
            f.advance(1); expect(f.scene.boss.body.velocity.x).toBe(0);
        } finally { f.close(); }
    });

    test('repeated charges retain one trail, stop deadline and image set', () => {
        const f = fixture();
        try {
            for (let index = 0; index < 100; index++) {
                f.scene.bossChargeAttack(); f.advance(50);
                expect(f.clock._active.length).toBe(2);
                expect(f.activeTweens.size).toBe(1);
                expect(f.scene.events.listenerCount('shutdown')).toBe(1);
                expect(f.scene.boss.listenerCount('destroy')).toBe(1);
            }
            f.scene.clearCrystalBossPacing(); f.advance(1);
            expect(f.clock._active.length).toBe(0);
            expect(f.activeTweens.size).toBe(0);
        } finally { f.close(); }
    });

    test.each(['velocity', 'trail-timer', 'stop-timer', 'graphics', 'tween'])('%s setup failure retires the charge and preserves the error', failure => {
        const f = fixture();
        try {
            const problem = new Error('synthetic charge setup failure');
            if (failure === 'velocity') jest.spyOn(f.scene.boss, 'setVelocityX').mockImplementationOnce(() => { throw problem; });
            if (failure === 'trail-timer') jest.spyOn(f.clock, 'addEvent').mockImplementationOnce(() => { throw problem; });
            if (failure === 'stop-timer') jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw problem; });
            if (['velocity', 'trail-timer', 'stop-timer'].includes(failure)) {
                expect(() => f.scene.bossChargeAttack()).toThrow(problem);
            } else {
                f.scene.bossChargeAttack();
                if (failure === 'graphics') f.scene.add.graphics = () => { throw problem; };
                else f.scene.tweens.add = () => { throw problem; };
                expect(() => f.advance(50)).toThrow(problem);
            }
            f.advance(1);
            expect(f.scene.crystalBossCharge).toBeNull();
            expect(f.clock._active.length).toBe(0);
            expect(f.graphics.every(image => !image.active)).toBe(true);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); jest.restoreAllMocks(); }
    });

    test('native TweenManager removes retired after-images without retaining old targets', () => {
        const f = fixture(), manager = new TweenManager(f.scene);
        f.scene.tweens = manager;
        manager.getDelta = () => 50;
        try {
            const control = { alpha: 1 };
            manager.add({ targets: control, alpha: 0.2, duration: 1000 });
            f.scene.bossChargeAttack(); f.advance(100); manager.step(true);
            expect(manager.tweens.length).toBeGreaterThan(1);
            f.scene.clearCrystalBossPacing({ includePhase: true });
            manager.step(true);
            expect(manager.tweens.length).toBe(1);
            expect(manager.getTweensOf(control).length).toBe(1);
            expect(f.graphics.every(image => !image.active)).toBe(true);
        } finally { f.close(); manager.destroy(); }
    });
});
