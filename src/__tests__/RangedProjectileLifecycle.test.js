const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(node => node.key?.name === 'performRangedAttack');
const fireShot = new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).performRangedAttack;`)(
    {}, { log() {} }
);

// Installed Arcade bodies/colliders and GameObject destruction. Drawing, scene
// services and clocks are fake; no Phaser Game/Scene, browser or audio is booted.
function fixture({ boss = true, enemies = true } = {}) {
    const scene = { sys: { scale: { width: 1000, height: 700 }, isActive: () => true, queueDepthSort() {} },
        events: new EventEmitter(), player: { x: 100, y: 200, facingRight: true },
        nextRangedDamageMultiplier: 1, lastCombatActionAt: 0,
        damageEnemy: jest.fn(), resolveBossHit: jest.fn(() => true),
        showFloatingText: jest.fn(), createProjectileImpact: jest.fn() };
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    scene.sys.events = scene.events;
    const graphics = [];
    function graphic(x = 0, y = 0) {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x, y, width: 20, height: 10, displayWidth: 20, displayHeight: 10,
            originX: 0.5, originY: 0.5, displayOriginX: 10, displayOriginY: 5,
            scaleX: 1, scaleY: 1, angle: 0, rotation: 0, visible: true });
        for (const name of ['fillStyle', 'fillTriangle', 'fillCircle']) object[name] = () => object;
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        object.setDepth = () => object;
        object.setRotation = value => { object.rotation = value; return object; };
        graphics.push(object);
        return object;
    }
    const addBody = object => { object.body = new Body(world, object); world.add(object.body); return object; };
    const enemy = addBody(graphic(700, 190)), guardian = addBody(graphic(900, 190));
    scene.enemies = enemies ? [enemy] : null;
    scene.getBossCombatTarget = () => boss ? guardian : null;
    const overlaps = [];
    scene.physics = { add: { existing: addBody,
        overlap(...args) { const collider = world.addOverlap(...args); overlaps.push(collider); return collider; } } };
    const activeTimers = new Set(), allTimers = [];
    const timer = config => {
        const event = { ...config, remove: jest.fn(() => activeTimers.delete(event)) };
        activeTimers.add(event); allTimers.push(event); return event;
    };
    scene.time = { now: 2000, addEvent: timer, delayedCall: (delay, callback) => timer({ delay, callback }) };
    const tweens = [];
    scene.tweens = { add: config => { tweens.push(config); return config; }, killTweensOf: jest.fn() };
    scene.add = { graphics: () => graphic() };
    const persistent = world.addOverlap([enemy], [], () => {});
    const process = () => { world.colliders.update(); world.postUpdate(); };
    process();
    const run = event => { if (event.repeat === undefined) activeTimers.delete(event); event.callback(); };
    return { scene, world, enemy, guardian, graphics, overlaps, activeTimers, allTimers, tweens, persistent, process, run,
        fire() { const count = graphics.length; fireShot.call(scene); process(); return graphics[count]; },
        close() { for (const object of graphics) object.destroy(); process(); world.shutdown(); } };
}

function expectOnlyPersistent(f) {
    expect(f.world.colliders.getActive().length).toBe(1);
    expect(f.world.colliders.getActive()[0] === f.persistent).toBe(true);
}

describe('ranged shots retire physics and visual work with their own lifetime', () => {
    test.each([[false, false], [true, false], [false, true], [true, true]])(
        '300 expired shots leave no per-shot colliders (boss=%s, enemies=%s)', (boss, enemies) => {
            const f = fixture({ boss, enemies });
            try {
                for (let index = 0; index < 300; index++) {
                    const projectile = f.fire();
                    const expiry = f.allTimers.at(-1);
                    f.run(expiry); f.process();
                    expect(projectile.active).toBe(false);
                    expect(f.activeTimers.size).toBe(0);
                    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                    expect(f.world.bodies.size).toBe(2);
                }
                expectOnlyPersistent(f);
            } finally { f.close(); }
        }
    );

    test.each(['enemy', 'boss'])('%s contact spends one shot once and cancels all its work', target => {
        const f = fixture();
        try {
            f.scene.nextRangedDamageMultiplier = 5;
            const projectile = f.fire(), original = [...f.overlaps];
            const callbacks = original.map(collider => collider.collideCallback);
            const callback = callbacks[target === 'enemy' ? 0 : 1];
            callback(projectile, target === 'enemy' ? f.enemy : f.guardian);
            f.process();
            expectOnlyPersistent(f);
            expect(f.activeTimers.size).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.scene.nextRangedDamageMultiplier).toBe(1);
            expect(f.scene.createProjectileImpact).toHaveBeenCalledWith(100, 190);
            for (const repeated of callbacks) repeated(projectile, f.enemy);
            expect(f.scene.damageEnemy.mock.calls.length + f.scene.resolveBossHit.mock.calls.length).toBe(1);
            expect(f.scene.createProjectileImpact).toHaveBeenCalledTimes(1);
            if (target === 'enemy') expect(f.scene.damageEnemy).toHaveBeenCalledWith(f.enemy, 5);
            else expect(f.scene.resolveBossHit).toHaveBeenCalledWith(5, { source: 'ranged' });
        } finally { f.close(); }
    });

    test.each(['destroy', 'shutdown'])('%s retires the trail, tween, deadline and native colliders', reason => {
        const f = fixture();
        try {
            const projectile = f.fire();
            const callbacks = f.overlaps.map(collider => collider.collideCallback);
            const trailEvent = f.allTimers[0]; f.run(trailEvent);
            const trail = f.graphics.at(-1), tween = f.tweens.at(-1);
            if (reason === 'destroy') projectile.destroy(); else f.scene.events.emit('shutdown');
            f.process();
            expect(projectile.active).toBe(false);
            expect(trail.active).toBe(false);
            expect(f.scene.tweens.killTweensOf).toHaveBeenCalledWith(trail);
            expect(f.activeTimers.size).toBe(0);
            expectOnlyPersistent(f);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            const created = f.graphics.length;
            for (const event of f.allTimers) event.callback();
            for (const callback of callbacks) callback(projectile, f.enemy);
            tween.onComplete();
            expect(f.graphics.length).toBe(created);
            expect(f.scene.damageEnemy).not.toHaveBeenCalled();
            expect(f.scene.resolveBossHit).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('retiring one shot leaves a newer shot and unrelated colliders usable', () => {
        const f = fixture();
        try {
            const first = f.fire(), second = f.fire();
            first.destroy(); f.process();
            expect(second.active).toBe(true);
            expect(f.world.colliders.getActive().length).toBe(3);
            expect(f.scene.events.listenerCount('shutdown')).toBe(1);
            expect(f.activeTimers.size).toBe(2);
            f.overlaps[2].collideCallback(second, f.enemy);
            f.process();
            expect(f.scene.damageEnemy).toHaveBeenCalledTimes(1);
            expectOnlyPersistent(f);
        } finally { f.close(); }
    });

    test.each([1000 / 60, 1000 / 30, 1000 / 15])('real Arcade overlap delivers damage and retires the shot (%d ms)', delta => {
        const f = fixture({ boss: false });
        try {
            f.enemy.setPosition(126, 190); f.enemy.body.reset(126, 190);
            const projectile = f.fire();
            for (let frame = 0; frame < 6 && projectile.active; frame++) {
                f.world.update(frame * delta, delta); f.world.postUpdate();
            }
            f.process();
            expect(f.scene.damageEnemy).toHaveBeenCalledWith(f.enemy, 1);
            expect(projectile.active).toBe(false);
            expectOnlyPersistent(f);
            expect(f.activeTimers.size).toBe(0);
        } finally { f.close(); }
    });

    test.each(['expiry', 'contact'])('installed Clock/TimerEvent cancellation retires both deadlines after %s', reason => {
        const f = fixture(), clock = new Clock(f.scene);
        f.scene.time = clock;
        try {
            const projectile = f.fire();
            clock.preUpdate();
            if (reason === 'contact') f.overlaps[0].collideCallback(projectile, f.enemy);
            else {
                clock.paused = true;
                clock.update(5000, 5000);
                expect(projectile.active).toBe(true);
                clock.paused = false;
            }
            clock.update(6500, 1500);
            clock.preUpdate();
            const created = f.graphics.length;
            // TimerEvent.remove(false) is drained on the following Clock tick;
            // a timer processed earlier in this same frame cannot be spliced out.
            for (const timer of clock._active) {
                expect(timer.hasDispatched).toBe(true);
                expect(timer.repeatCount).toBe(0);
            }
            clock.update(6517, 17);
            clock.preUpdate();
            f.process();
            expect(projectile.active).toBe(false);
            expectOnlyPersistent(f);
            expect(clock._active.length + clock._pendingInsertion.length + clock._pendingRemoval.length).toBe(0);
            expect(f.graphics.length).toBe(created);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { clock.destroy(); f.close(); }
    });

    test.each(['body', 'second-collider', 'deadline'])('partial %s startup failure retires owned resources and preserves the error', failure => {
        const f = fixture();
        try {
            const problem = Error('fictional projectile startup failure');
            if (failure === 'body') f.scene.physics.add.existing = () => { throw problem; };
            if (failure === 'second-collider') {
                const add = f.scene.physics.add.overlap; let calls = 0;
                f.scene.physics.add.overlap = (...args) => { if (++calls === 2) throw problem; return add(...args); };
            }
            if (failure === 'deadline') f.scene.time.delayedCall = () => { throw problem; };
            expect(() => f.fire()).toThrow(problem);
            f.process();
            expectOnlyPersistent(f);
            expect(f.activeTimers.size).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.graphics.at(-1).active).toBe(false);
        } finally { f.close(); }
    });

    test('a hit that synchronously retires its scene cannot create an impact in a closed view', () => {
        const f = fixture();
        try {
            const projectile = f.fire();
            f.scene.damageEnemy.mockImplementation(() => {
                f.scene.sys.isActive = () => false;
                f.scene.events.emit('shutdown');
            });
            f.overlaps[0].collideCallback(projectile, f.enemy);
            f.process();
            expect(f.scene.damageEnemy).toHaveBeenCalledTimes(1);
            expect(f.scene.createProjectileImpact).not.toHaveBeenCalled();
            expectOnlyPersistent(f);
        } finally { f.close(); }
    });
});
