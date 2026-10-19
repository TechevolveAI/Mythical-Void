const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');
const distance = require('phaser/src/math/distance/DistanceBetween');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');

// Real installed clock/tween/body/destruction primitives with fictional drawing
// and scene services. No game, browser, sound device or save backend is opened.
function fixture() {
    const effects = { FXLibrary: { stardustBurst: jest.fn() },
        FeedbackManager: { cameraShake: jest.fn() }, AudioManager: { playAttack: jest.fn() } };
    const phaser = { Math: { Between: jest.fn(() => 2), Distance: { Between: distance } },
        Utils: { Array: { Shuffle: jest.fn(array => array) } } };
    const names = ['triggerStalactiteFall', 'dropStalactite', 'onStalactiteImpact', 'clearCrystalStalactiteFalls',
        'clearCrystalBossPacing', 'clearCrystalBossCharge', 'clearCrystalBossSlam'];
    const methods = Object.fromEntries(declaration.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('window', 'console', 'Phaser', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
            effects, { log() {} }, phaser
        )
    ]));
    const scene = { ...methods, events: new EventEmitter(),
        sys: { scale: { width: 1000, height: 800 }, isActive: () => true, queueDepthSort() {} },
        bossFightActive: true, bossDefeated: false, bossPhaseTransitioning: false, bossPhase: 2,
        bossTelegraphs: new Set(), levelHeight: 800, stalactites: [],
        takeDamage: jest.fn(), resolveBossHit: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], configs = [], timers = [];
    const graphic = () => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width: 20, height: 30, displayWidth: 20, displayHeight: 30,
            originX: 0.5, originY: 0.5, displayOriginX: 10, displayOriginY: 15,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        for (const name of ['fillStyle', 'fillEllipse', 'setDepth']) object[name] = jest.fn(() => object);
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        objects.push(object); return object;
    };
    const actor = () => {
        const object = graphic().setPosition(100, 720);
        object.body = new Body(world, object); world.add(object.body); return object;
    };
    const stalactite = (x = 100) => {
        const value = { x, y: 100, active: true, falling: false, shadow: null,
            sprite: graphic().setPosition(x, 100) };
        scene.stalactites.push(value); return value;
    };
    scene.boss = actor(); scene.player = actor();
    scene.add = { graphics: jest.fn(graphic) };
    const clock = new Clock(scene); scene.time = clock;
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (...args) => { const value = delayedCall(...args); timers.push(value); return value; };
    const tweens = new TweenManager(scene); scene.tweens = tweens;
    const add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    const advance = delta => {
        clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
        tweens.getDelta = () => delta; tweens.step(true);
    };
    return { scene, effects, phaser, actor, stalactite, objects, configs, timers, tweens, advance,
        start() { const value = stalactite(); scene.dropStalactite(value); advance(1); return value; },
        beginFall() {
            const value = this.start();
            configs.find(config => config.repeat === 8).onComplete();
            return { value, impact: configs.find(config => config.y === 720).onComplete };
        },
        close() {
            scene.events.emit('shutdown'); tweens.destroy(); clock.destroy();
            objects.forEach(object => object.destroy()); world.postUpdate(); world.shutdown();
        } };
}

describe('Crystal stalactites retain the encounter that launched them', () => {
    test('queued launches stop at defeat and cannot create warnings afterwards', () => {
        const f = fixture();
        try {
            f.stalactite(); f.stalactite(200); f.scene.triggerStalactiteFall();
            const callbacks = f.timers.map(timer => timer.callback);
            f.scene.bossDefeated = true; f.scene.bossFightActive = false;
            f.scene.clearCrystalBossPacing({ includePhase: true });
            f.advance(500); callbacks.forEach(callback => callback());
            expect(f.scene.add.graphics).not.toHaveBeenCalled();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.stalactites.every(value => !value.falling && value.sprite.active)).toBe(true);
        } finally { f.close(); }
    });

    test('a captured impact cannot damage replacement actors', () => {
        const f = fixture();
        try {
            const { impact } = f.beginFall();
            f.scene.boss = f.actor(); f.scene.player = f.actor();
            impact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.resolveBossHit).not.toHaveBeenCalled();
            expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('the same captured impact resolves at most once', () => {
        const f = fixture();
        try {
            const { impact, value } = f.beginFall();
            impact(); impact(); f.scene.onStalactiteImpact(value);
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.scene.resolveBossHit).toHaveBeenCalledTimes(1);
            expect(f.effects.FXLibrary.stardustBurst).toHaveBeenCalledTimes(1);
            expect(f.effects.AudioManager.playAttack).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'phase', 'defeat', 'boss-destroy', 'player-destroy',
        'boss-disabled', 'player-disabled', 'inactive', 'missing-player', 'arena-replaced',
        'sprite-destroy', 'shadow-destroy'])('%s retires warnings and falling callbacks', reason => {
        const f = fixture();
        try {
            const { value, impact } = f.beginFall();
            const callbacks = f.configs.map(config => config.onComplete).filter(Boolean);
            if (reason === 'shutdown') f.scene.events.emit('shutdown');
            if (reason === 'phase') { f.scene.bossPhaseTransitioning = true; f.scene.clearCrystalBossPacing(); }
            if (reason === 'defeat') { f.scene.bossDefeated = true; f.scene.clearCrystalBossPacing({ includePhase: true }); }
            if (reason === 'boss-destroy') f.scene.boss.destroy();
            if (reason === 'player-destroy') f.scene.player.destroy();
            if (reason === 'boss-disabled') f.scene.boss.body.enable = false;
            if (reason === 'player-disabled') f.scene.player.body.enable = false;
            if (reason === 'inactive') f.scene.sys.isActive = () => false;
            if (reason === 'missing-player') f.scene.player = null;
            if (reason === 'arena-replaced') f.scene.stalactites = [];
            if (reason === 'sprite-destroy') value.sprite.destroy();
            if (reason === 'shadow-destroy') value.shadow.destroy();
            expect(() => { impact(); callbacks.forEach(callback => callback()); f.advance(1); }).not.toThrow();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.resolveBossHit).not.toHaveBeenCalled();
            expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
            expect(f.tweens.getTweensOf(value.sprite)).toHaveLength(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(value.falling).toBe(false);
        } finally { f.close(); }
    });

    test('normal scheduling keeps the count draw, shuffle and 200ms spacing', () => {
        const f = fixture();
        try {
            for (let index = 0; index < 4; index++) f.stalactite(100 + index * 100);
            f.phaser.Math.Between.mockReturnValue(3);
            f.scene.triggerStalactiteFall();
            expect(f.phaser.Math.Between).toHaveBeenCalledWith(2, 3);
            expect(f.phaser.Math.Between).toHaveBeenCalledTimes(1);
            expect(f.phaser.Utils.Array.Shuffle).toHaveBeenCalledTimes(1);
            expect(f.timers.map(timer => timer.delay)).toEqual([0, 200, 400]);
            f.advance(1); expect(f.scene.add.graphics).toHaveBeenCalledTimes(1);
            f.advance(199); expect(f.scene.add.graphics).toHaveBeenCalledTimes(2);
            f.advance(200); expect(f.scene.add.graphics).toHaveBeenCalledTimes(3);
        } finally { f.close(); }
    });

    test('pending crystals are reserved once, including a captured launch callback', () => {
        const f = fixture();
        try {
            f.stalactite(); f.stalactite(200);
            f.scene.triggerStalactiteFall();
            f.scene.triggerStalactiteFall();
            expect(f.timers).toHaveLength(2);
            const launch = f.timers[0].callback;
            f.advance(1);
            launch();
            expect(f.scene.add.graphics).toHaveBeenCalledTimes(1);
            expect(f.scene.crystalStalactiteFalls.size).toBe(2);
        } finally { f.close(); }
    });

    test('an old scheduled fall cannot adopt actors replaced before its warning starts', () => {
        const f = fixture();
        try {
            const value = f.stalactite();
            f.scene.dropStalactite(value, 200);
            f.scene.boss = f.actor(); f.scene.player = f.actor();
            f.advance(200);
            expect(f.scene.add.graphics).not.toHaveBeenCalled();
            expect(value.falling).toBe(false);
            expect(f.scene.crystalStalactiteFalls.size).toBe(0);
        } finally { f.close(); }
    });

    test('normal fall retains warning, shake, gravity animation and damage values', () => {
        const f = fixture();
        try {
            const value = f.start();
            const shadow = value.shadow;
            expect(shadow.fillStyle).toHaveBeenCalledWith(0xFF0000, 0.3);
            expect(shadow.fillEllipse).toHaveBeenCalledWith(100, 740, 50, 15);
            const pulse = f.configs[0], shake = f.configs[1];
            expect(pulse).toMatchObject({ duration: 300, yoyo: true, repeat: 1 });
            expect(shake).toMatchObject({ duration: 50, yoyo: true, repeat: 8, x: { from: 97, to: 103 } });
            for (let index = 0; index < 18; index++) f.advance(50);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.configs[2]).toMatchObject({ y: 720, duration: 400, ease: 'Quad.easeIn' });
            f.advance(400);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(f.scene.resolveBossHit).toHaveBeenCalledWith(1, { source: 'stalactite' });
            expect(f.effects.FeedbackManager.cameraShake).toHaveBeenCalledWith(f.scene, 200, 0.01);
            expect(f.effects.FXLibrary.stardustBurst).toHaveBeenCalledWith(f.scene, 100, 720,
                { count: 15, color: [0x2D1B4E, 0x7B68EE], duration: 800 });
            expect(value.active).toBe(false);
            expect(value.sprite.active).toBe(false);
            expect(shadow.active).toBe(false);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test.each([[39, 59, 1, 1], [40, 60, 0, 0], [-39, -59, 1, 1], [-40, -60, 0, 0]])(
        'impact distances %s/%s retain the strict player/boss radii', (playerOffset, bossOffset, playerHits, bossHits) => {
            const f = fixture();
            try {
                const { impact } = f.beginFall();
                f.scene.player.x = 100 + playerOffset; f.scene.boss.x = 100 + bossOffset;
                impact();
                expect(f.scene.takeDamage).toHaveBeenCalledTimes(playerHits);
                expect(f.scene.resolveBossHit).toHaveBeenCalledTimes(bossHits);
            } finally { f.close(); }
        });

    test.each(['particles', 'camera', 'sound', 'damage'])('retirement during %s stops later effects', boundary => {
        const f = fixture();
        try {
            const { impact } = f.beginFall();
            const stop = () => { f.scene.bossDefeated = true; f.scene.clearCrystalBossPacing(); };
            if (boundary === 'particles') f.effects.FXLibrary.stardustBurst.mockImplementation(stop);
            if (boundary === 'camera') f.effects.FeedbackManager.cameraShake.mockImplementation(stop);
            if (boundary === 'sound') f.effects.AudioManager.playAttack.mockImplementation(stop);
            if (boundary === 'damage') f.scene.takeDamage.mockImplementation(stop);
            impact();
            expect(f.scene.resolveBossHit).not.toHaveBeenCalled();
            if (boundary !== 'damage') expect(f.scene.takeDamage).not.toHaveBeenCalled();
            if (boundary === 'particles' || boundary === 'camera') expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('retirement stops only owned work and makes a surviving ceiling crystal available again', () => {
        const f = fixture();
        try {
            const value = f.start();
            const control = f.tweens.add({ targets: value.sprite, alpha: 0.5, duration: 5000 });
            const oldShake = f.configs.find(config => config.repeat === 8);
            f.advance(25); f.scene.clearCrystalBossPacing(); f.advance(1);
            expect(value.sprite.x).toBe(100); expect(value.sprite.y).toBe(100);
            expect(value.active).toBe(true); expect(value.falling).toBe(false);
            expect(f.tweens.getTweensOf(value.sprite)).toEqual([control]);
            f.scene.dropStalactite(value); f.advance(1);
            const currentShadow = value.shadow;
            oldShake.onComplete();
            expect(value.shadow).toBe(currentShadow); expect(currentShadow.active).toBe(true);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['queue', 'warning', 'shake', 'fall', 'impact'])('%s failure cleans owned work and preserves the error', boundary => {
        const f = fixture();
        try {
            const problem = new Error('fictional stalactite failure');
            const value = f.stalactite();
            if (boundary === 'queue') {
                f.scene.time.delayedCall = () => { throw problem; };
                expect(() => f.scene.dropStalactite(value)).toThrow(problem);
                expect(value.falling).toBe(false);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                return;
            }
            if (boundary === 'warning') f.scene.add.graphics.mockImplementation(() => { throw problem; });
            if (boundary === 'shake') {
                const add = f.scene.tweens.add;
                f.scene.tweens.add = config => { if (config.repeat === 8) throw problem; return add(config); };
            }
            f.scene.dropStalactite(value);
            if (boundary === 'warning' || boundary === 'shake') expect(() => f.advance(1)).toThrow(problem);
            else {
                f.advance(1);
                const shake = f.configs.find(config => config.repeat === 8);
                if (boundary === 'fall') {
                    f.scene.tweens.add = () => { throw problem; };
                    expect(() => shake.onComplete()).toThrow(problem);
                } else {
                    shake.onComplete();
                    f.effects.FXLibrary.stardustBurst.mockImplementation(() => { throw problem; });
                    expect(() => f.configs.find(config => config.y === 720).onComplete()).toThrow(problem);
                }
            }
            f.advance(1);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.resolveBossHit).not.toHaveBeenCalled();
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.tweens.getTweensOf(value.sprite)).toHaveLength(0);
        } finally { f.close(); }
    });
});
