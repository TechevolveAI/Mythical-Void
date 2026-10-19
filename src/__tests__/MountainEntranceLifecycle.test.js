const { entranceFixture } = require('./support/mountainEntranceFixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

describe('mountain entrance retains its original actors and presentation', () => {
    afterEach(() => jest.restoreAllMocks());

    test('the actual scene update services entrance before the combat handoff and lifecycle hooks retire it', () => {
        const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
        const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
        const body = name => {
            const node = cls.body.body.find(node => node.key?.name === name || node.kind === name);
            return source.slice(node.start, node.end);
        };
        const update = body('update'), service = update.indexOf('this.updateTitanEntrance(time, delta)');
        expect(service).toBeGreaterThan(update.indexOf('super.update(time, delta)'));
        expect(service).toBeLessThan(update.indexOf('this.updateDeferredTitanCombat()'));
        expect(service).toBeLessThan(update.indexOf('if (this.levelCompletionActive) return'));
        expect(body('constructor')).toContain('this.titanEntrance = null');
        for (const name of ['init', 'defeatBoss', 'shutdown']) expect(body(name)).toContain('this.clearTitanEntrance()');
    });

    test.each([true, false])('control: native pan, reveal and opening start the real attacks once, phone=%s', phone => {
        const f = entranceFixture({ phone }), { scene } = f;
        try {
            scene.startBossFight(); expect(f.world.isPaused).toBe(true);
            f.step(880); expect(scene.boss).toBeNull();
            f.step(20); expect(scene.boss?.active).toBe(true);
            f.step(920); expect(scene.boss.x).toBe(4890); expect(scene.boss.y).toBe(400);
            expect(scene.boss.originY).toBe(0.97);
            f.step(600); expect(scene.bossCombatReady).toBe(true); expect(f.begin).toHaveBeenCalledTimes(1);
            expect(f.world.isPaused).toBe(false); expect(scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
            expect(f.execute).not.toHaveBeenCalled();
            f.step(1900); expect(f.execute).toHaveBeenCalledTimes(1);
            expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a native old reveal cannot move or finalise a replacement boss', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(1000);
            const original = scene.boss;
            const replacement = scene.boss = f.actor(100, 200);
            f.step(900);
            expect(replacement.x).toBe(100); expect(replacement.y).toBe(200); expect(replacement.originY).toBe(0.5);
            expect(original.x).toBeLessThan(4890);
            expect(f.begin).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a native pending spawn cannot adopt a replacement player', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); scene.player = f.actor(50, 60); f.step(920);
            expect(scene.physics.add.sprite).not.toHaveBeenCalled();
            expect(scene.bossCombatReady).toBe(false);
        } finally { f.close(); }
    });

    test('a retained old pan callback cannot complete a later entrance', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(1420);
            const old = f.currentPan()._onUpdate; expect(old).toBeInstanceOf(Function);
            scene.guardianEncounter = { active: true }; scene.bossCombatReady = false;
            old(f.camera, 1);
            expect(f.begin).not.toHaveBeenCalled(); expect(scene.bossCombatReady).toBe(false);
        } finally { f.close(); }
    });

    test('a wall fallback during death cannot spawn or pan behind recovery, then retry resumes once', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(200); scene.onPlayerDeath();
            f.wallAdvance(5000);
            expect(scene.physics.add.sprite).not.toHaveBeenCalled(); expect(f.panStart).toHaveBeenCalledTimes(1);
            scene.retryFromCheckpoint(); f.step(2420);
            expect(scene.bossCombatReady).toBe(true); expect(f.begin).toHaveBeenCalledTimes(1);
            expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a paused reveal cannot enable combat before the actual emergence finishes', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(1000); scene.onPlayerDeath();
            f.wallAdvance(5000);
            scene.retryFromCheckpoint(); f.step(20);
            expect(scene.bossCombatReady).toBe(false); expect(f.begin).not.toHaveBeenCalled();
            f.step(2300); expect(scene.bossCombatReady).toBe(true); expect(f.begin).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['player-body', 'boss-body', 'plugin', 'encounter', 'phase', 'clock', 'world', 'tweens', 'events', 'camera', 'guards', 'completion', 'defeat', 'fight-ended'])(
        'native entrance rejects %s replacement or retirement before further motion', reason => {
            const f = entranceFixture(), { scene } = f;
            try {
                scene.startBossFight(); f.step(1000);
                const boss = scene.boss, x = boss.x;
                if (reason === 'player-body') scene.player.body = f.actor().body;
                if (reason === 'boss-body') boss.body = f.actor().body;
                if (reason === 'plugin') scene.scene = {};
                if (reason === 'encounter') scene.guardianEncounter = { active: true };
                if (reason === 'phase') scene.bossPhase = 3;
                if (reason === 'clock') scene.time = {};
                if (reason === 'world') scene.physics.world = {};
                if (reason === 'tweens') scene.tweens = {};
                if (reason === 'events') scene.events = new (require('eventemitter3'))();
                if (reason === 'camera') scene.cameras.main = {};
                if (reason === 'guards') scene.guardianTransitionGuards = new Map();
                if (reason === 'completion') scene.levelCompletionActive = true;
                if (reason === 'defeat') scene.bossDefeated = true;
                if (reason === 'fight-ended') scene.bossFightActive = false;
                f.step(1400); expect(boss.x).toBe(x); expect(f.begin).not.toHaveBeenCalled();
                expect(scene.titanEntrance).toBeNull();
            } finally { f.close(); }
        });

    test.each([500, 1200])('a retired native pan cannot write even on its first retained update, delta=%s', delta => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(1500);
            const pan = f.currentPan(), before = [f.camera.scrollX, f.camera.scrollY];
            scene.guardianEncounter = { active: true };
            expect(() => pan.update(0, delta)).not.toThrow();
            expect([f.camera.scrollX, f.camera.scrollY]).toEqual(before);
            expect(f.begin).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['player', 'boss', 'shutdown', 'init'])('%s cleanup retires entrance work, not an unrelated native tween or timer', reason => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.step(1000);
            const entrance = scene.titanEntrance, boss = scene.boss, x = boss.x;
            const separate = { x: 0 }, timer = f.clock.delayedCall(10000, () => {});
            f.tweens.add({ targets: separate, x: 100, duration: 10000 });
            if (reason === 'player') scene.player.destroy();
            if (reason === 'boss') boss.destroy();
            if (reason === 'shutdown') scene.events.emit('shutdown');
            if (reason === 'init') scene.init({});
            expect(entrance.retired).toBe(true); expect(entrance.transitions.size).toBe(0);
            expect(scene.titanEntrance).toBeNull(); expect(f.wallTimers.size).toBe(0);
            expect(f.tweens.getTweensOf(separate)).toHaveLength(1);
            expect(timer.callback).toBeInstanceOf(Function);
            f.step(1500); expect(boss.x).toBe(x); expect(f.begin).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a native wall fallback spawns once and cancelled scene-time delivery cannot repeat it', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.startBossFight(); f.wallAdvance(1500);
            expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
            f.step(2500); expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
            expect(f.begin).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a synchronous pan-start observer that retires the entrance cannot install later warning or spawn work', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            f.camera.once('camerapanstart', () => { scene.guardianEncounter = { active: true }; });
            scene.startBossFight(); f.step(3000);
            expect(scene.physics.add.sprite).not.toHaveBeenCalled(); expect(f.begin).not.toHaveBeenCalled();
            expect(f.wallTimers.size).toBe(0); expect(scene.titanEntrance).toBeNull();
        } finally { f.close(); }
    });

    test('optional intro and emergence feedback errors cannot strand the armed fight sequence', () => {
        const f = entranceFixture(), { scene } = f, original = window.FeedbackManager;
        window.FeedbackManager = { cameraFlash() { throw Error('fictional optional flash failure'); },
            cameraShake() { throw Error('fictional optional shake failure'); } };
        try {
            expect(() => { scene.startBossFight(); f.step(2420); }).not.toThrow();
            expect(scene.bossCombatReady).toBe(true); expect(f.begin).toHaveBeenCalledTimes(1);
        } finally { window.FeedbackManager = original; f.close(); }
    });

    test('required sprite setup failure stays visible while owned work is retired', () => {
        const f = entranceFixture(), { scene } = f;
        try {
            scene.physics.add.sprite.mockImplementationOnce(() => { throw Error('fictional required sprite failure'); });
            scene.startBossFight();
            expect(() => f.step(900)).toThrow('fictional required sprite failure');
            expect(scene.titanEntrance).toBeNull(); expect(f.wallTimers.size).toBe(0);
            expect(scene.bossCombatReady).toBe(false); expect(f.begin).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('normal reveal samples match the previous native900ms Cubic tween configuration', () => {
        const f = entranceFixture(), { scene } = f;
        let reference;
        const nativeAdd = f.tweens.add.bind(f.tweens);
        jest.spyOn(f.tweens, 'add').mockImplementation(config => {
            const result = nativeAdd(config);
            if (config.targets?.progress === 0 && config.duration === 900) {
                reference = Object.fromEntries(['x', 'y', 'scaleX', 'scaleY', 'angle'].map(key => [key, scene.boss[key]]));
                // Original b49e2f24 spawnCosmicTitan configuration, not a new art rule.
                nativeAdd({ targets: reference, x: 4890, y: 400 - 225 * (0.97 - 0.28),
                    scaleX: 225 / scene.boss.height, scaleY: 225 / scene.boss.height, angle: -7,
                    duration: 900, ease: 'Cubic.easeOut' });
            }
            return result;
        });
        try {
            scene.startBossFight(); f.step(900); expect(reference).toBeTruthy();
            for (let time = 0; time < 860; time += 20) {
                f.step(20);
                for (const key of Object.keys(reference)) expect(scene.boss[key]).toBeCloseTo(reference[key], 9);
            }
        } finally { f.close(); }
    });

    test('the joined real entrance and fight reaches all attacks, phase change and the existing victory request', () => {
        const f = entranceFixture(), { scene } = f;
        const phase = jest.spyOn(scene, 'enterTitanPhase');
        const until = condition => {
            for (let elapsed = 0; !condition() && elapsed < 20000; elapsed += 20) f.step(20);
            expect(condition()).toBe(true);
        };
        try {
            scene.startBossFight(); expect(scene.damageBoss(100)).toBe(false);
            until(() => scene.bossCombatReady);
            for (let opening = 0; opening < 6; opening++) {
                until(() => scene.titanRecoveryUntil > f.clock.now && !scene.titanPhaseRecoveryTimer && scene.titanRecoveryDamage === 0);
                expect(scene.damageBoss(100)).toBe(true); expect(scene.damageBoss(100)).toBe(false);
                expect(scene.bossHealth).toBe(24 - (opening + 1) * 4);
                if (opening < 5) {
                    const completed = scene.titanAttacksCompleted;
                    until(() => scene.titanAttacksCompleted > completed);
                }
            }
            expect(f.execute.mock.calls.map(args => args[0])).toEqual(expect.arrayContaining(['gravityCrush', 'starRain', 'voidPunch', 'singularity']));
            expect(phase).toHaveBeenCalledTimes(1); expect(scene.bossDefeated).toBe(true);
            expect(scene.commitPeakVictory).toHaveBeenCalledTimes(1);
            expect(scene.titanEntrance).toBeNull(); expect(scene.bossEncounterEffects.size).toBe(0);
            f.onlyPersistent();
        } finally { f.close(); }
    });
});
