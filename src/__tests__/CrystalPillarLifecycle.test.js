const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const StaticBody = require('phaser/src/physics/arcade/StaticBody');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');

// Native clocks, tweens, bodies and destruction with fictional scene/drawing
// services. No Game/Scene, browser, audio device or persistence owner is started.
function fixture() {
    const effects = { FXLibrary: { stardustBurst: jest.fn() },
        AudioManager: { playEnemyHit: jest.fn(), playAttack: jest.fn() } };
    const names = ['createCrystalPillar', 'damageCrystalPillar', 'destroyCrystalPillar',
        'getCrystalPillarWork', 'clearCrystalPillarWork', 'bossGroundSlam', 'clearCrystalBossSlam'];
    const methods = Object.fromEntries(declaration.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
            effects, { log() {} }
        )
    ]));
    const scene = { ...methods, events: new EventEmitter(),
        sys: { scale: { width: 1000, height: 800 }, isActive: () => true, queueDepthSort() {} },
        bossFightActive: true, bossDefeated: false, bossPhaseTransitioning: false, bossPhase: 1,
        crystalPillars: [], textures: { exists: () => true }, isGrounded: false,
        takeDamage: jest.fn(), clearCrystalBossCharge: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const objects = [], configs = [], timers = [];
    const graphic = () => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width: 50, height: 100, displayWidth: 50, displayHeight: 100,
            originX: 0.5, originY: 0.5, displayOriginX: 25, displayOriginY: 50,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        object.setTint = jest.fn(colour => { object.tintTopLeft = colour; return object; });
        object.clearTint = jest.fn(() => { object.tintTopLeft = null; return object; });
        for (const name of ['setDepth', 'fillStyle', 'fillRect']) object[name] = jest.fn(() => object);
        objects.push(object); return object;
    };
    const actor = () => {
        const object = graphic().setPosition(100, 300);
        object.body = new Body(world, object); world.add(object.body); return object;
    };
    scene.boss = actor(); scene.player = actor();
    const createSprite = jest.fn((x, y) => {
        const object = graphic().setPosition(x, y);
        object.body = new StaticBody(world, object); world.add(object.body); return object;
    });
    scene.physics = { add: { staticSprite: createSprite } };
    scene.add = { graphics: graphic };
    const clock = new Clock(scene); scene.time = clock;
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (...args) => { const value = delayedCall(...args); timers.push(value); return value; };
    const tweens = new TweenManager(scene); scene.tweens = tweens;
    const add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    const advance = delta => {
        clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
        tweens.getDelta = () => delta; tweens.step(true); world.postUpdate();
    };
    const pillars = [100, 400, 650].map((x, index) => scene.createCrystalPillar(x, 650, index));
    return { scene, effects, world, actor, pillars, configs, timers, createSprite, tweens, advance,
        breakPillar(index = 0) { scene.damageCrystalPillar(scene.crystalPillars[index]); scene.damageCrystalPillar(scene.crystalPillars[index]); },
        close() {
            scene.events.emit('shutdown'); tweens.destroy(); clock.destroy();
            objects.forEach(object => object.destroy()); world.postUpdate(); world.shutdown();
        } };
}

describe('Crystal cover keeps one slot and one encounter-owned lifecycle', () => {
    test('regeneration replaces one slot without appending a second reference', () => {
        const f = fixture();
        try {
            f.breakPillar(); f.advance(1); f.advance(299); f.advance(29700);
            const replacement = f.scene.crystalPillars[0];
            expect(replacement).not.toBe(f.pillars[0]);
            expect(f.scene.crystalPillars).toHaveLength(3);
            expect(new Set(f.scene.crystalPillars).size).toBe(3);
            expect(f.world.staticBodies.size).toBe(3);
        } finally { f.close(); }
    });

    test('one real slam counts as one hit on a regenerated pillar', () => {
        const f = fixture();
        try {
            f.breakPillar(); f.advance(1); f.advance(299); f.advance(29700);
            const replacement = f.scene.crystalPillars[0];
            f.scene.bossGroundSlam(); f.advance(1);
            f.configs.find(config => config.onYoyo).onYoyo();
            expect(replacement.pillarHealth).toBe(1);
            expect(replacement.isDestroyed).toBe(false);
        } finally { f.close(); }
    });

    test('an old regeneration cannot overwrite the next boss encounter', () => {
        const f = fixture();
        try {
            f.breakPillar();
            f.scene.boss = f.actor();
            f.advance(30000);
            expect(f.createSprite).toHaveBeenCalledTimes(3);
            expect(f.scene.crystalPillars[0]).toBe(f.pillars[0]);
        } finally { f.close(); }
    });

    test('an earlier flash cannot clear a later hit flash before its full 100ms', () => {
        const f = fixture();
        try {
            const pillar = f.pillars[0];
            pillar.pillarHealth = 3;
            f.scene.damageCrystalPillar(pillar); f.advance(50);
            f.scene.damageCrystalPillar(pillar); f.advance(50);
            expect(pillar.tintTopLeft).toBe(0xFFFFFF);
            f.advance(50); expect(pillar.tintTopLeft).toBeNull();
        } finally { f.close(); }
    });

    test('a captured regeneration timer cannot create a second replacement', () => {
        const f = fixture();
        try {
            f.breakPillar();
            const callback = f.timers.find(timer => timer.delay === 30000).callback;
            f.advance(30000); callback();
            expect(f.createSprite).toHaveBeenCalledTimes(4);
            expect(f.scene.crystalPillars).toHaveLength(3);
        } finally { f.close(); }
    });

    test('initial cover retains three two-hit pillars with the existing static bodies', () => {
        const f = fixture();
        try {
            expect(f.scene.crystalPillars).toEqual(f.pillars);
            f.pillars.forEach((pillar, index) => {
                expect(pillar.pillarHealth).toBe(2); expect(pillar.isDestroyed).toBe(false);
                expect(pillar.pillarIndex).toBe(index); expect(pillar.y).toBe(650);
                expect(pillar.body).toBeInstanceOf(StaticBody);
                expect(pillar.body.width).toBe(30); expect(pillar.body.height).toBe(90);
                expect(pillar.body.offset.x).toBe(10); expect(pillar.body.offset.y).toBe(5);
                expect(pillar.setDepth).toHaveBeenCalledWith(50);
            });
        } finally { f.close(); }
    });

    test('normal damage, particles, fade and regeneration retain their existing parameters', () => {
        const f = fixture();
        try {
            const pillar = f.pillars[0];
            f.scene.damageCrystalPillar(pillar);
            expect(pillar.pillarHealth).toBe(1); expect(pillar.isDestroyed).toBe(false);
            f.advance(99); expect(pillar.tintTopLeft).toBe(0xFFFFFF);
            f.advance(1); expect(pillar.tintTopLeft).toBeNull();
            f.scene.damageCrystalPillar(pillar);
            expect(f.effects.FXLibrary.stardustBurst.mock.calls.map(call => call[3])).toEqual([
                { count: 8, color: [0x7B68EE, 0x4B0082], duration: 500 },
                { count: 8, color: [0x7B68EE, 0x4B0082], duration: 500 },
                { count: 20, color: [0x7B68EE, 0x4B0082, 0x00FFFF], duration: 1000 }
            ]);
            expect(f.effects.AudioManager.playEnemyHit).toHaveBeenCalledTimes(1);
            expect(f.configs[0]).toMatchObject({ alpha: 0, scaleX: 1.2, scaleY: 0.3, duration: 300 });
            // Native TweenData starts on its first positive step, then runs 300ms.
            f.advance(1); f.advance(299); expect(pillar.active).toBe(true);
            f.advance(1); expect(pillar.active).toBe(false);
            f.advance(29698); expect(f.createSprite).toHaveBeenCalledTimes(3);
            f.advance(1); expect(f.createSprite).toHaveBeenCalledTimes(4);
        } finally { f.close(); }
    });

    test.each(['shutdown', 'defeat', 'boss-destroy', 'boss-disabled', 'inactive',
        'arena-replaced', 'slot-replaced', 'external-pillar-destroy'])('%s retires pending cover work', reason => {
        const f = fixture();
        try {
            f.breakPillar();
            const old = f.pillars[0];
            const callbacks = f.timers.map(timer => timer.callback);
            const fade = f.configs[0].onComplete;
            if (reason === 'shutdown') f.scene.events.emit('shutdown');
            if (reason === 'defeat') { f.scene.bossDefeated = true; f.scene.bossFightActive = false; f.scene.clearCrystalPillarWork(); }
            if (reason === 'boss-destroy') f.scene.boss.destroy();
            if (reason === 'boss-disabled') f.scene.boss.body.enable = false;
            if (reason === 'inactive') f.scene.sys.isActive = () => false;
            if (reason === 'arena-replaced') f.scene.crystalPillars = [];
            if (reason === 'slot-replaced') f.scene.createCrystalPillar(100, 650, 0);
            if (reason === 'external-pillar-destroy') old.destroy();
            const count = f.createSprite.mock.calls.length;
            expect(() => { callbacks.forEach(callback => callback()); fade(); f.advance(30000); }).not.toThrow();
            expect(f.createSprite).toHaveBeenCalledTimes(count);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.tweens.getTweensOf(old)).toHaveLength(0);
        } finally { f.close(); }
    });

    test('phase changes do not restart the existing 30-second cover timer', () => {
        const f = fixture();
        try {
            f.breakPillar(); f.advance(10000);
            f.scene.bossPhase = 2; f.scene.bossPhaseTransitioning = true;
            f.advance(1650); f.scene.bossPhaseTransitioning = false;
            f.advance(18349); expect(f.createSprite).toHaveBeenCalledTimes(3);
            f.advance(1); expect(f.createSprite).toHaveBeenCalledTimes(4);
        } finally { f.close(); }
    });

    test('repeated regeneration keeps three unique cover references and native bodies', () => {
        const f = fixture();
        try {
            for (let cycle = 0; cycle < 10; cycle++) {
                f.breakPillar(cycle % 3); f.advance(1); f.advance(299); f.advance(29700);
                expect(f.scene.crystalPillars).toHaveLength(3);
                expect(new Set(f.scene.crystalPillars).size).toBe(3);
                expect(f.world.staticBodies.size).toBe(3);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            }
        } finally { f.close(); }
    });

    test.each(['particles', 'sound'])('synchronous defeat during %s stops further destruction effects', boundary => {
        const f = fixture();
        try {
            const stop = () => { f.scene.bossDefeated = true; f.scene.bossFightActive = false; f.scene.clearCrystalPillarWork(); };
            if (boundary === 'particles') f.effects.FXLibrary.stardustBurst.mockImplementation(stop);
            if (boundary === 'sound') f.effects.AudioManager.playEnemyHit.mockImplementation(stop);
            f.scene.destroyCrystalPillar(f.pillars[0]);
            expect(f.configs).toHaveLength(0);
            expect(f.timers.filter(timer => timer.delay === 30000)).toHaveLength(0);
            if (boundary === 'particles') expect(f.effects.AudioManager.playEnemyHit).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['fade', 'timer', 'regeneration'])('%s setup failure cleans owned work and preserves its error', boundary => {
        const f = fixture();
        try {
            const problem = new Error('fictional cover failure');
            if (boundary === 'fade') f.scene.tweens.add = () => { throw problem; };
            if (boundary === 'timer') {
                const delayedCall = f.scene.time.delayedCall;
                f.scene.time.delayedCall = (...args) => { if (args[0] === 30000) throw problem; return delayedCall(...args); };
            }
            if (boundary !== 'regeneration') expect(() => f.scene.destroyCrystalPillar(f.pillars[0])).toThrow(problem);
            else {
                f.scene.destroyCrystalPillar(f.pillars[0]);
                f.createSprite.mockImplementation(() => { throw problem; });
                expect(() => f.advance(30000)).toThrow(problem);
            }
            f.advance(1);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.tweens.getTweensOf(f.pillars[0])).toHaveLength(0);
        } finally { f.close(); }
    });
});
