const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const StaticBody = require('phaser/src/physics/arcade/StaticBody');
const GameObject = require('phaser/src/gameobjects/GameObject');
const TweenManager = require('phaser/src/tweens/TweenManager');
const between = require('phaser/src/math/angle/Between');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');

// Native bodies, collider dispatch, tween/destruction and World stepping. Drawing,
// scene services and timer dispatch are fictional; no Game/browser/audio/backend.
function fixture(phase = 1, withCover = true) {
    const effects = { FXLibrary: { stardustBurst: jest.fn() },
        AudioManager: { playEnemyHit: jest.fn(), playAttack: jest.fn() } };
    const spread = jest.fn(() => 0);
    const names = ['bossCrystalBarrage', 'createCrystalPillar', 'damageCrystalPillar',
        'destroyCrystalPillar', 'getCrystalPillarWork', 'clearCrystalPillarWork'];
    const methods = Object.fromEntries(declaration.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('Phaser', 'window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
            { Math: { Angle: { Between: between }, FloatBetween: spread } }, effects, { log() {} }
        )
    ]));
    const scene = { ...methods, events: new EventEmitter(),
        sys: { scale: { width: 1000, height: 800 }, isActive: () => true, queueDepthSort() {} },
        bossPhase: phase, bossFightActive: true, bossDefeated: false, crystalPillars: [],
        textures: { exists: () => true }, takeDamage: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], shots = [], overlaps = [], configs = [], allTimers = [], activeTimers = new Set();
    const graphic = (width = 20, height = 30) => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width, height, displayWidth: width, displayHeight: height,
            originX: 0.5, originY: 0.5, displayOriginX: width / 2, displayOriginY: height / 2,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        object.setRotation = value => { object.rotation = value; return object; };
        object.setTint = value => { object.tintTopLeft = value; return object; };
        object.clearTint = () => { object.tintTopLeft = null; return object; };
        for (const name of ['fillStyle', 'fillTriangle', 'setDepth']) object[name] = () => object;
        objects.push(object); return object;
    };
    const addBody = object => { object.body = new Body(world, object); world.add(object.body); return object; };
    const actor = (x, y) => addBody(graphic().setPosition(x, y));
    scene.player = actor(100, 200); scene.boss = actor(500, 200);
    scene.physics = { add: { existing: addBody,
        staticSprite(x, y) {
            const object = graphic(50, 100).setPosition(x, y);
            object.body = new StaticBody(world, object); world.add(object.body); return object;
        },
        overlap(...args) { const collider = world.addOverlap(...args); overlaps.push(collider); return collider; } } };
    scene.add = { graphics() { const object = graphic(); shots.push(object); return object; } };
    scene.time = { delayedCall(delay, callback) {
        const timer = { delay, callback, remove: jest.fn(() => activeTimers.delete(timer)) };
        allTimers.push(timer); activeTimers.add(timer); return timer;
    } };
    const tweens = new TweenManager(scene); scene.tweens = tweens;
    const add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    const persistent = world.addOverlap(scene.player, [], () => {});
    const process = () => { world.colliders.update(); world.postUpdate(); };
    const run = timer => { activeTimers.delete(timer); timer.callback(); };
    const pillar = withCover ? scene.createCrystalPillar(300, 200, 0) : null;
    let launches;
    process();
    return { scene, world, pillar, effects, spread, actor, shots, overlaps, configs, allTimers, activeTimers, persistent, process, run,
        fire(index = 0) {
            if (!launches) { const first = allTimers.length; scene.bossCrystalBarrage(); launches = allTimers.slice(first); }
            run(launches[index]); process(); return shots[shots.length - 1];
        },
        travel(shot, delta = 1000 / 60) {
            for (let frame = 0; frame < 180 && shot.active; frame++) {
                world.update(frame * delta, delta); world.postUpdate();
            }
            process();
        },
        close() {
            scene.events.emit('shutdown'); tweens.destroy();
            objects.forEach(object => object.destroy()); process(); world.shutdown();
        } };
}

function onlyPersistent(f) {
    expect(f.world.colliders.getActive()).toEqual([f.persistent]);
}

describe('Crystal Caves visible cover actually intercepts the Guardian barrage', () => {
    test.each([1000 / 60, 1000 / 30, 1000 / 15])('native contact blocks a shot behind live cover (%d ms)', delta => {
        const f = fixture();
        try {
            const shot = f.fire(); f.travel(shot, delta);
            expect(shot.active).toBe(false);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.pillar.pillarHealth).toBe(1);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('two hits break cover; the next shot can reach the player through the opening', () => {
        const f = fixture();
        try {
            f.travel(f.fire(0)); expect(f.pillar.pillarHealth).toBe(1);
            f.travel(f.fire(1)); expect(f.pillar.isDestroyed).toBe(true);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.travel(f.fire(2));
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(f.pillar.pillarHealth).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('cover wins when one physics step overlaps both the pillar and player', () => {
        const f = fixture();
        try {
            const shot = f.fire();
            shot.body.reset(300, 180); shot.body.setVelocity(0, 0);
            f.scene.player.body.reset(300, 180);
            f.world.update(0, 1000 / 60); f.process();
            expect(shot.active).toBe(false);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.pillar.pillarHealth).toBe(1);
        } finally { f.close(); }
    });

    test('a regenerated slot protects against a shot already launched before the rebuild', () => {
        const f = fixture();
        try {
            f.travel(f.fire(0)); f.travel(f.fire(1));
            expect(f.pillar.isDestroyed).toBe(true);
            const shot = f.fire(2);
            f.configs[0].onComplete(); f.process();
            f.run(f.allTimers.find(timer => timer.delay === 30000));
            const replacement = f.scene.crystalPillars[0];
            expect(replacement).not.toBe(f.pillar);
            f.travel(shot);
            expect(replacement.pillarHealth).toBe(1);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.crystalPillars).toHaveLength(1);
        } finally { f.close(); }
    });

    test('without cover the existing native player hit and one-point damage remain', () => {
        const f = fixture(1, false);
        try {
            const shot = f.fire(); f.travel(shot);
            expect(shot.active).toBe(false);
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('standing in front of cover is not protected from an earlier player contact', () => {
        const f = fixture();
        try {
            f.scene.player.body.reset(400, 200);
            f.travel(f.fire());
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.pillar.pillarHealth).toBe(2);
        } finally { f.close(); }
    });

    test('native contact also protects when the Guardian fires from the left', () => {
        const f = fixture();
        try {
            f.scene.boss.body.reset(100, 200); f.scene.player.body.reset(500, 200);
            f.travel(f.fire());
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.pillar.pillarHealth).toBe(1);
        } finally { f.close(); }
    });

    test('a shot travelling above the pillar is not globally shielded by cover', () => {
        const f = fixture();
        try {
            f.scene.player.body.reset(100, -100);
            f.travel(f.fire());
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.pillar.pillarHealth).toBe(2);
        } finally { f.close(); }
    });

    test.each(['destroyed', 'disabled', 'inactive', 'removed-slot'])('%s cover cannot consume a shot', state => {
        const f = fixture();
        try {
            const shot = f.fire();
            if (state === 'destroyed') f.pillar.isDestroyed = true;
            if (state === 'disabled') f.pillar.body.enable = false;
            if (state === 'inactive') f.pillar.active = false;
            if (state === 'removed-slot') f.scene.crystalPillars[0] = null;
            f.travel(shot);
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.pillar.pillarHealth).toBe(2);
        } finally { f.close(); }
    });

    test('captured cover/player callbacks spend one projectile and one cover hit only', () => {
        const f = fixture();
        try {
            const shot = f.fire();
            const cover = f.overlaps.find(collider => collider.object1 === shot && Array.isArray(collider.object2));
            const player = f.overlaps.find(collider => collider.object1 === f.scene.player);
            const hitCover = cover.collideCallback, hitPlayer = player.collideCallback;
            hitCover(shot, f.pillar); hitCover(shot, f.pillar); hitPlayer(f.scene.player, shot);
            f.process();
            expect(f.pillar.pillarHealth).toBe(1);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['cover', 'player'])('shutdown during projectile destruction prevents a retired %s hit', target => {
        const f = fixture();
        try {
            const shot = f.fire();
            const collider = f.overlaps.find(value => target === 'cover' ? value.object1 === shot : value.object1 === f.scene.player);
            shot.once('destroy', () => f.scene.events.emit('shutdown'));
            if (target === 'cover') collider.collideCallback(shot, f.pillar);
            else collider.collideCallback(f.scene.player, shot);
            f.process();
            expect(f.pillar.pillarHealth).toBe(2);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'boss-replaced', 'player-replaced', 'arena-replaced', 'defeat'])('%s retires both overlap paths without cover damage', reason => {
        const f = fixture();
        try {
            const shot = f.fire();
            const cover = f.overlaps.find(collider => collider.object1 === shot && Array.isArray(collider.object2));
            const hit = cover.collideCallback;
            if (reason === 'shutdown') f.scene.events.emit('shutdown');
            if (reason === 'boss-replaced') f.scene.boss = f.actor(500, 200);
            if (reason === 'player-replaced') f.scene.player = f.actor(100, 200);
            if (reason === 'arena-replaced') f.scene.crystalPillars = [];
            if (reason === 'defeat') f.scene.bossDefeated = true;
            hit(shot, f.pillar); f.process();
            expect(f.pillar.pillarHealth).toBe(2);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.activeTimers.size).toBe(0);
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test.each(['cover-overlap', 'player-overlap', 'expiry', 'cover-hit'])('%s failure retires the two collider paths and preserves its error', boundary => {
        const f = fixture();
        try {
            const problem = new Error('fictional cover failure');
            if (boundary === 'cover-overlap' || boundary === 'player-overlap') {
                const overlap = f.scene.physics.add.overlap;
                f.scene.physics.add.overlap = (...args) => {
                    if ((boundary === 'player-overlap' && args[0] === f.scene.player) ||
                        (boundary === 'cover-overlap' && Array.isArray(args[1]))) throw problem;
                    return overlap(...args);
                };
                expect(() => f.fire()).toThrow(problem);
            } else if (boundary === 'expiry') {
                const delayed = f.scene.time.delayedCall;
                f.scene.time.delayedCall = (...args) => { if (args[0] === 2000) throw problem; return delayed(...args); };
                expect(() => f.fire()).toThrow(problem);
            } else {
                const shot = f.fire();
                f.scene.damageCrystalPillar = () => { throw problem; };
                const callback = f.overlaps.find(collider => collider.object1 === shot).collideCallback;
                expect(() => callback(shot, f.pillar)).toThrow(problem);
            }
            f.process();
            expect(f.activeTimers.size).toBe(0);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('destroying a live shot removes both its overlaps without retiring another barrage', () => {
        const f = fixture();
        try {
            const first = f.fire();
            f.scene.bossCrystalBarrage();
            const secondLaunch = [...f.activeTimers].filter(timer => timer.delay === 0)[0];
            f.run(secondLaunch); f.process();
            const second = f.shots[1];
            first.destroy(); f.process();
            expect(second.active).toBe(true);
            expect(f.world.colliders.getActive()).toHaveLength(3);
            f.scene.events.emit('shutdown'); f.process(); onlyPersistent(f);
        } finally { f.close(); }
    });

    test('ordinary expiry removes both native overlaps without damaging cover', () => {
        const f = fixture();
        try {
            const shot = f.fire();
            f.run(f.allTimers.find(timer => timer.delay === 2000)); f.process();
            expect(shot.active).toBe(false);
            expect(f.pillar.pillarHealth).toBe(2);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            onlyPersistent(f);
        } finally { f.close(); }
    });

    test('twenty expired covered barrages retain no owned colliders, bodies or listeners', () => {
        const f = fixture();
        try {
            for (let burst = 0; burst < 20; burst++) {
                const first = f.allTimers.length;
                f.scene.bossCrystalBarrage();
                f.allTimers.slice(first).forEach(f.run); f.process();
                [...f.activeTimers].filter(timer => timer.delay === 2000).forEach(f.run); f.process();
                onlyPersistent(f);
                expect(f.world.bodies.size).toBe(2);
                expect(f.world.staticBodies.size).toBe(1);
                expect(f.activeTimers.size).toBe(0);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            }
        } finally { f.close(); }
    });
});
