const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const between = require('phaser/src/math/angle/Between');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(node => node.key?.name === 'bossCrystalBarrage');
const spread = jest.fn(() => 0);
const barrage = new Function('Phaser', 'window', 'console', `return ({${source.slice(node.start, node.end)}}).bossCrystalBarrage;`)(
    { Math: { Angle: { Between: between }, FloatBetween: spread } }, {}, { log() {} }
);

// Installed body/collider/destruction and clock primitives only. Drawing and scene
// services are synthetic; no Phaser Game/Scene, browser, sound or backend is run.
function fixture(phase = 1) {
    const scene = { sys: { scale: { width: 1000, height: 700 }, isActive: () => true, queueDepthSort() {} },
        events: new EventEmitter(), bossPhase: phase, takeDamage: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const graphics = [];
    const graphic = () => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width: 20, height: 30, displayWidth: 20, displayHeight: 30,
            originX: 0.5, originY: 0.5, displayOriginX: 10, displayOriginY: 15,
            scaleX: 1, scaleY: 1, rotation: 0, angle: 0, visible: true });
        for (const name of ['fillStyle', 'fillTriangle', 'setDepth']) object[name] = () => object;
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        object.setRotation = value => { object.rotation = value; return object; };
        graphics.push(object);
        return object;
    };
    const addBody = object => { object.body = new Body(world, object); world.add(object.body); return object; };
    scene.player = addBody(graphic().setPosition(100, 200));
    scene.boss = addBody(graphic().setPosition(500, 200));
    const overlaps = [];
    scene.physics = { add: { existing: addBody,
        overlap(...args) { const collider = world.addOverlap(...args); overlaps.push(collider); return collider; } } };
    scene.add = { graphics: graphic };
    const activeTimers = new Set(), allTimers = [];
    scene.time = { delayedCall: (delay, callback) => {
        const event = { delay, callback, remove: jest.fn(() => activeTimers.delete(event)) };
        activeTimers.add(event); allTimers.push(event); return event;
    } };
    const persistent = world.addOverlap(scene.player, [], () => {});
    const process = () => { world.colliders.update(); world.postUpdate(); };
    const run = event => { activeTimers.delete(event); event.callback(); };
    process();
    return { scene, world, graphics, overlaps, activeTimers, allTimers, persistent, process, run,
        start() { const first = allTimers.length; barrage.call(scene); return allTimers.slice(first); },
        spawn() { const start = graphics.length; const scheduled = this.start(); scheduled.forEach(run); process(); return graphics.slice(start); },
        close() { scene.events.emit('shutdown'); graphics.forEach(object => object.destroy()); process(); world.shutdown(); } };
}
function onlyPersistent(f) {
    const colliders = f.world.colliders.getActive();
    expect(colliders.length).toBe(1);
    expect(colliders[0] === f.persistent).toBe(true);
}

describe('Crystal Caves barrage owns its colliders and delayed work', () => {
    test.each([1, 2])('300 expired phase %s shots leave no stale overlaps or listeners', phase => {
        const f = fixture(phase);
        try {
            const count = phase === 1 ? 3 : 5;
            for (let index = 0; index < 300 / count; index++) {
                const shots = f.spawn();
                expect(shots).toHaveLength(count);
                [...f.activeTimers].forEach(f.run);
                f.process();
                expect(shots.every(shot => !shot.active)).toBe(true);
            }
            onlyPersistent(f);
            expect(f.world.bodies.size).toBe(2);
            expect(f.activeTimers.size).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.scene.boss.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('a hit retires the shot before damage, so captured callbacks cannot hit twice', () => {
        const f = fixture();
        try {
            const [shot] = f.spawn();
            const callback = f.overlaps[0].collideCallback;
            callback(f.scene.player, shot);
            callback(f.scene.player, shot);
            f.process();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(shot.active).toBe(false);
            expect(f.world.colliders.getActive().length).toBe(3);
        } finally { f.close(); }
    });

    test.each(['boss', 'player'])('disabled %s cannot deliver delayed barrage damage', owner => {
        const f = fixture();
        try {
            const shots = f.spawn();
            f.scene[owner].body.enable = false;
            f.overlaps[0].collideCallback(f.scene.player, shots[0]);
            f.process();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(shots.every(shot => !shot.active)).toBe(true);
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['destroy', 'shutdown'])('%s retires active shots and all delayed callbacks', reason => {
        const f = fixture();
        try {
            const shots = f.spawn();
            const callbacks = f.overlaps.map(collider => collider.collideCallback);
            if (reason === 'destroy') f.scene.boss.destroy(); else f.scene.events.emit('shutdown');
            f.process();
            expect(shots.every(shot => !shot.active)).toBe(true);
            const created = f.graphics.length;
            f.allTimers.forEach(timer => timer.callback());
            callbacks.forEach(callback => callback(f.scene.player, shots[0]));
            expect(f.graphics.length).toBe(created);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('shutdown before the first crystal prevents every captured launch', () => {
        const f = fixture();
        try {
            const scheduled = f.start(), before = f.graphics.length;
            f.scene.events.emit('shutdown');
            scheduled.forEach(timer => timer.callback());
            expect(f.graphics).toHaveLength(before);
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['boss', 'player'])('old launches cannot attach to a replacement %s', owner => {
        const f = fixture();
        try {
            const scheduled = f.start(), original = f.scene.boss;
            if (owner === 'boss') f.scene.boss = f.scene.player;
            else f.scene.player = f.scene.boss;
            const before = f.graphics.length;
            scheduled.forEach(f.run);
            expect(f.graphics).toHaveLength(before);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(original.listenerCount('destroy')).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('external shot destruction is not recursive and leaves newer barrages alive', () => {
        const f = fixture();
        try {
            const first = f.spawn(), second = f.spawn();
            const destroy = jest.spyOn(first[0], 'destroy');
            first.forEach(shot => shot.destroy());
            f.process();
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(second.every(shot => shot.active)).toBe(true);
            expect(f.world.colliders.getActive().length).toBe(4);
            expect(f.scene.events.listenerCount('shutdown')).toBe(1);
            [...f.activeTimers].forEach(f.run); f.process();
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each([1000 / 60, 1000 / 30, 1000 / 15])('native Arcade contact spends a shot once (%d ms)', delta => {
        const f = fixture();
        try {
            const [shot, ...otherShots] = f.spawn();
            otherShots.forEach(object => object.destroy());
            f.scene.player.setPosition(470, 180);
            f.scene.player.body.reset(470, 180);
            for (let frame = 0; frame < 8 && shot.active; frame++) {
                f.world.update(frame * delta, delta); f.world.postUpdate();
            }
            f.process();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(shot.active).toBe(false);
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['launch', 'graphics', 'body', 'overlap', 'expiry'])('partial %s failure retires work without hiding the error', failure => {
        const f = fixture();
        try {
            const problem = new Error('synthetic crystal startup failure');
            if (failure === 'launch') {
                const delayed = f.scene.time.delayedCall; let calls = 0;
                f.scene.time.delayedCall = (...args) => {
                    if (++calls === 2) throw problem;
                    return delayed(...args);
                };
                expect(() => f.start()).toThrow(problem);
            } else {
                const scheduled = f.start();
                if (failure === 'graphics') f.scene.add.graphics = () => { throw problem; };
                if (failure === 'body') {
                    const add = f.scene.physics.add.existing;
                    f.scene.physics.add.existing = object => { add(object); throw problem; };
                }
                if (failure === 'overlap') f.scene.physics.add.overlap = () => { throw problem; };
                if (failure === 'expiry') f.scene.time.delayedCall = () => { throw problem; };
                expect(() => f.run(scheduled[0])).toThrow(problem);
            }
            f.process();
            expect(f.activeTimers.size).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.scene.boss.listenerCount('destroy')).toBe(0);
            expect(f.world.bodies.size).toBe(2);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('a hit that shuts the level down retires the rest of its barrage', () => {
        const f = fixture();
        try {
            const shots = f.spawn();
            f.scene.takeDamage.mockImplementation(() => f.scene.events.emit('shutdown'));
            f.overlaps[0].collideCallback(f.scene.player, shots[0]);
            f.process();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(shots.every(shot => !shot.active)).toBe(true);
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('live cadence, size, speed, spread and two-second expiry remain unchanged', () => {
        const f = fixture(2);
        try {
            const scheduled = f.start();
            expect(scheduled.map(timer => timer.delay)).toEqual([0, 200, 400, 600, 800]);
            scheduled.forEach(f.run);
            for (const shot of f.graphics.slice(2)) {
                expect(shot.body.allowGravity).toBe(false);
                expect(shot.body.width).toBe(20);
                expect(shot.body.height).toBe(30);
                expect(Math.hypot(shot.body.velocity.x, shot.body.velocity.y)).toBeCloseTo(300);
            }
            expect([...f.activeTimers].map(timer => timer.delay)).toEqual([2000, 2000, 2000, 2000, 2000]);
            expect(spread).toHaveBeenCalledWith(-0.3, 0.3);
        } finally { f.close(); }
    });

    test('installed Clock expiry releases the native colliders through pause and resume', () => {
        const f = fixture(), clock = new Clock(f.scene);
        f.scene.time = clock;
        try {
            barrage.call(f.scene);
            clock.preUpdate(); clock.update(500, 500); clock.preUpdate();
            expect(f.graphics.slice(2)).toHaveLength(3);
            clock.paused = true; clock.update(5000, 4500);
            expect(f.graphics.slice(2).every(shot => shot.active)).toBe(true);
            clock.paused = false; clock.update(7000, 2000); clock.preUpdate();
            clock.update(7017, 17); clock.preUpdate(); f.process();
            expect(f.graphics.slice(2).every(shot => !shot.active)).toBe(true);
            onlyPersistent(f);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { clock.destroy(); f.close(); }
    });
});
