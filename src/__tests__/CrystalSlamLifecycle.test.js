const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const GameObject = require('phaser/src/gameobjects/GameObject');
const TweenManager = require('phaser/src/tweens/TweenManager');
const Clock = require('phaser/src/time/Clock');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');

// Actual installed tween/body/destruction primitives with fictional scene/drawing
// services. No Game, Scene, browser, sound device or save backend is started.
function fixture(phase = 1) {
    const effects = { FeedbackManager: { cameraShake: jest.fn() }, AudioManager: { playAttack: jest.fn() } };
    const names = ['bossGroundSlam', 'clearCrystalBossSlam', 'clearCrystalBossPacing', 'clearCrystalBossCharge', 'clearCrystalStalactiteFalls'];
    const methods = Object.fromEntries(declaration.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(effects, { log() {} })
    ]));
    const scene = { ...methods, events: new EventEmitter(),
        sys: { scale: { width: 1000, height: 700 }, isActive: () => true, queueDepthSort() {} },
        bossPhase: phase, bossDefeated: false, bossPhaseTransitioning: false,
        isGrounded: true, bossTelegraphs: new Set(), crystalPillars: [],
        takeDamage: jest.fn(), triggerStalactiteFall: jest.fn(), damageCrystalPillar: jest.fn() };
    scene.sys.events = scene.events;
    const world = new World(scene, { gravity: { y: 0 }, debug: false });
    const graphics = [], actors = [], configs = [];
    const graphic = () => {
        const object = new GameObject(scene, 'SyntheticGraphics');
        Object.assign(object, { x: 0, y: 0, width: 20, height: 30, displayWidth: 20, displayHeight: 30,
            originX: 0.5, originY: 0.5, displayOriginX: 10, displayOriginY: 15,
            scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, visible: true });
        for (const name of ['fillStyle', 'fillRect', 'setDepth']) object[name] = jest.fn(() => object);
        object.setPosition = (x, y) => { Object.assign(object, { x, y }); return object; };
        return object;
    };
    const actor = () => {
        const object = graphic().setPosition(100, 300);
        object.body = new Body(world, object); world.add(object.body);
        actors.push(object); return object;
    };
    scene.boss = actor(); scene.player = actor();
    scene.add = { graphics: () => { const value = graphic(); graphics.push(value); return value; } };
    const tweens = new TweenManager(scene);
    const add = tweens.add.bind(tweens);
    tweens.add = config => { configs.push(config); return add(config); };
    scene.tweens = tweens;
    const step = delta => { tweens.getDelta = () => delta; tweens.step(true); };
    return { scene, world, tweens, effects, graphics, actors, configs, actor, step,
        start() { scene.bossGroundSlam(); step(1); },
        close() {
            scene.events.emit('shutdown'); tweens.destroy();
            graphics.forEach(object => object.destroy()); actors.forEach(object => object.destroy());
            world.postUpdate(); world.shutdown();
        } };
}

describe('Crystal Guardian ground slam keeps its original encounter owner', () => {
    test.each([true, false])('native slam uses the shared health boundary while pause menu=%s', paused => {
        const f = fixture();
        const base = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
        const cls = parse(base, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
        const method = cls.body.body.find(node => node.key?.name === 'takeDamage');
        f.scene.takeDamage = new Function('window', 'console', `return ({${base.slice(method.start, method.end)}}).takeDamage;`)(
            f.effects, { log() {} }
        );
        f.effects.AudioManager.playError = jest.fn();
        Object.assign(f.scene, { health: 3, maxHealth: 3, guardRecoveryUntil: 0, damageTaken: 0,
            pauseMenuActive: paused, updateHealthDisplay: jest.fn(), beginInvincibility: jest.fn(),
            armCenteringStance: jest.fn(), onPlayerDeath: jest.fn() });
        f.scene.player.setTint = jest.fn(); f.scene.player.clearTint = jest.fn(); f.scene.player.setVelocity = jest.fn();
        const clock = f.scene.time = new Clock(f.scene);
        try {
            f.start();
            if (paused) f.world.pause();
            f.step(400);
            expect(f.scene.health).toBe(paused ? 3 : 2);
            expect(f.scene.damageTaken).toBe(paused ? 0 : 1);
            expect(f.scene.updateHealthDisplay).toHaveBeenCalledTimes(paused ? 0 : 1);
            expect(f.graphics).toHaveLength(1);
        } finally { clock.destroy(); f.close(); }
    });

    test('a defeated Guardian cannot finish an old slam and damage the player', () => {
        const f = fixture(2);
        try {
            f.start(); f.step(200);
            f.scene.bossDefeated = true;
            f.scene.clearCrystalBossPacing({ includePhase: true });
            f.step(400);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.triggerStalactiteFall).not.toHaveBeenCalled();
            expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
            expect(f.graphics).toHaveLength(0);
        } finally { f.close(); }
    });

    test('an old slam cannot attack from a replacement boss position', () => {
        const f = fixture(2);
        try {
            f.start(); f.step(200);
            const replacement = f.actor().setPosition(120, 600);
            f.scene.boss = replacement;
            f.step(400);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.triggerStalactiteFall).not.toHaveBeenCalled();
            expect(f.graphics).toHaveLength(0);
            expect(replacement.y).toBe(600);
        } finally { f.close(); }
    });

    test('a captured impact callback cannot deliver the same slam twice', () => {
        const f = fixture();
        try {
            f.start();
            const impact = f.configs[0].onYoyo;
            impact(); impact();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.graphics).toHaveLength(1);
            expect(f.effects.AudioManager.playAttack).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each([1, 2])('normal phase %s keeps the existing lift, shockwave and single damage', phase => {
        const f = fixture(phase);
        try {
            f.start(); f.step(399);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.step(1);
            expect(f.scene.boss.y).toBe(260);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(f.graphics).toHaveLength(1);
            expect(f.graphics[0].fillStyle).toHaveBeenCalledWith(0x7B68EE, 0.6);
            expect(f.graphics[0].fillRect).toHaveBeenCalledWith(-200, -10, 400, 20);
            expect(f.graphics[0].x).toBe(100);
            expect(f.graphics[0].y).toBe(310);
            expect(f.scene.triggerStalactiteFall).toHaveBeenCalledTimes(phase === 2 ? 1 : 0);
            f.step(400); f.step(100); f.step(1);
            expect(f.scene.boss.y).toBe(300);
            expect(f.graphics[0].active).toBe(false);
        } finally { f.close(); }
    });

    test.each(['boss-destroy', 'player-destroy', 'boss-disabled', 'player-disabled', 'player-replaced', 'inactive', 'phase', 'shutdown'])('%s retires the old impact and owned animation', cause => {
        const f = fixture(2);
        try {
            f.start(); f.step(200);
            const impact = f.configs[0].onYoyo;
            if (cause === 'boss-destroy') f.scene.boss.destroy();
            if (cause === 'player-destroy') f.scene.player.destroy();
            if (cause === 'boss-disabled') f.scene.boss.body.enable = false;
            if (cause === 'player-disabled') f.scene.player.body.enable = false;
            if (cause === 'player-replaced') f.scene.player = f.actor();
            if (cause === 'inactive') f.scene.sys.isActive = () => false;
            if (cause === 'phase') { f.scene.bossPhaseTransitioning = true; f.scene.clearCrystalBossPacing(); }
            if (cause === 'shutdown') f.scene.events.emit('shutdown');
            f.step(400); impact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.triggerStalactiteFall).not.toHaveBeenCalled();
            expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
            expect(f.graphics).toHaveLength(0);
            expect(f.scene.crystalBossSlam).toBeNull();
        } finally { f.close(); }
    });

    test.each([[249, true], [250, false], [-249, true], [-250, false]])('grounded player offset %s keeps the existing range boundary', (offset, hit) => {
        const f = fixture();
        try {
            f.scene.player.x = f.scene.boss.x + offset;
            f.start(); f.configs[0].onYoyo();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(hit ? 1 : 0);
            expect(f.effects.FeedbackManager.cameraShake).toHaveBeenCalledWith(f.scene, 300, 0.03);
        } finally { f.close(); }
    });

    test('an airborne player is not hit; live nearby pillars retain the existing boundary', () => {
        const f = fixture();
        try {
            f.scene.isGrounded = false;
            const near = { x: 249 }, edge = { x: 250 }, retired = { x: 100, isDestroyed: true };
            f.scene.crystalPillars = [near, edge, retired];
            f.start(); f.configs[0].onYoyo();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.damageCrystalPillar.mock.calls).toEqual([[near]]);
        } finally { f.close(); }
    });

    test('a newer slam is not cancelled or hit by captured callbacks from the old one', () => {
        const f = fixture();
        try {
            f.start(); f.step(200);
            const old = f.configs[0];
            f.start();
            const current = f.scene.crystalBossSlam;
            old.onYoyo(); old.onUpdate(); old.onComplete();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.crystalBossSlam).toBe(current);
            expect(f.scene.boss.y).toBe(300);
            f.step(400);
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['camera', 'damage', 'pillar'])('synchronous retirement during %s stops the remaining impact effects', boundary => {
        const f = fixture(2);
        try {
            const stop = () => { f.scene.bossDefeated = true; f.scene.clearCrystalBossPacing(); };
            if (boundary === 'camera') f.effects.FeedbackManager.cameraShake.mockImplementation(stop);
            if (boundary === 'damage') f.scene.takeDamage.mockImplementation(stop);
            if (boundary === 'pillar') {
                f.scene.crystalPillars = [{ x: 100 }, { x: 100 }];
                f.scene.damageCrystalPillar.mockImplementation(stop);
            }
            f.start(); f.configs[0].onYoyo();
            expect(f.effects.AudioManager.playAttack).not.toHaveBeenCalled();
            if (boundary !== 'pillar') {
                expect(f.scene.triggerStalactiteFall).not.toHaveBeenCalled();
                expect(f.scene.damageCrystalPillar).not.toHaveBeenCalled();
            } else expect(f.scene.damageCrystalPillar).toHaveBeenCalledTimes(1);
            expect(f.graphics.every(graphic => !graphic.active)).toBe(true);
        } finally { f.close(); }
    });

    test('retirement removes only owned tweens and settles only its last owned height', () => {
        const f = fixture();
        try {
            const control = f.tweens.add({ targets: f.scene.boss, alpha: 0.5, duration: 1000 });
            f.start(); f.step(200);
            expect(f.scene.boss.y).toBe(280);
            f.scene.clearCrystalBossSlam(); f.step(1);
            expect(f.scene.boss.y).toBe(300);
            expect(f.tweens.getTweensOf(f.scene.boss)).toEqual([control]);
            f.start(); f.step(100);
            f.scene.boss.y = 999;
            f.scene.clearCrystalBossSlam();
            expect(f.scene.boss.y).toBe(999);
        } finally { f.close(); }
    });

    test('externally destroying a wave retires its fade without cancelling the returning lift', () => {
        const f = fixture();
        try {
            f.start(); f.step(400);
            const wave = f.graphics[0];
            wave.destroy();
            f.step(1);
            expect(f.tweens.getTweensOf(wave)).toHaveLength(0);
            expect(f.scene.crystalBossSlam).not.toBeNull();
            f.step(399);
            expect(f.scene.boss.y).toBe(300);
            expect(f.scene.crystalBossSlam).toBeNull();
        } finally { f.close(); }
    });

    test.each(['lift', 'graphics', 'wave'])('%s setup failure retires created work and preserves the actual error', boundary => {
        const f = fixture();
        try {
            const problem = new Error('fictional slam setup failure');
            if (boundary === 'lift') {
                f.tweens.add = () => { throw problem; };
                expect(() => f.start()).toThrow(problem);
            } else {
                f.start();
                if (boundary === 'graphics') f.scene.add.graphics = () => { throw problem; };
                else f.tweens.add = () => { throw problem; };
                expect(() => f.configs[0].onYoyo()).toThrow(problem);
            }
            f.step(1);
            expect(f.graphics.every(graphic => !graphic.active)).toBe(true);
            expect(f.scene.crystalBossSlam).toBeNull();
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            expect(f.scene.boss.listenerCount('destroy')).toBe(0);
            expect(f.scene.player.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('repeated interrupted slams retain one owner and no completed wave callbacks', () => {
        const f = fixture();
        try {
            for (let i = 0; i < 100; i++) {
                f.start(); f.step(100);
                expect(f.tweens.tweens).toHaveLength(1);
                expect(f.scene.events.listenerCount('shutdown')).toBe(1);
                expect(f.scene.boss.listenerCount('destroy')).toBe(1);
                expect(f.scene.player.listenerCount('destroy')).toBe(1);
            }
            f.scene.clearCrystalBossSlam(); f.step(1);
            expect(f.tweens.tweens).toHaveLength(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test('retired wave completion cannot cancel another attack', () => {
        const f = fixture();
        try {
            f.start(); f.step(400);
            const release = f.configs[1].onComplete;
            f.start();
            const next = f.scene.crystalBossSlam;
            release(); release();
            expect(f.scene.crystalBossSlam).toBe(next);
            expect(f.scene.boss.y).toBe(300);
        } finally { f.close(); }
    });

    test('phase cleanup during a live wave destroys it once and retires its captured completion', () => {
        const f = fixture();
        try {
            f.start(); f.step(400);
            const wave = f.graphics[0], completion = f.configs[1].onComplete;
            const destroy = jest.spyOn(wave, 'destroy');
            f.scene.clearCrystalBossPacing({ includePhase: true });
            completion(); completion(); f.step(1);
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(f.tweens.getTweensOf(wave)).toHaveLength(0);
            expect(f.scene.crystalBossSlam).toBeNull();
        } finally { f.close(); }
    });

    test('native TweenManager pause does not deliver an impact while paused', () => {
        const f = fixture();
        try {
            f.start();
            f.tweens.getDelta = () => 400;
            f.tweens.paused = true;
            for (let i = 0; i < 10; i++) f.tweens.update();
            expect(f.scene.boss.y).toBe(300);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.tweens.paused = false; f.tweens.update();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });
});
