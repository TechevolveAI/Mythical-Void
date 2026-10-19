const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { fixture } = require('./support/reefEncounterFixture.cjs');
jest.mock('phaser/src/actions/', () => new Proxy({}, { get() { throw Error('GROUP_BULK_ACTION_FORBIDDEN'); } }));
jest.mock('phaser/src/gameobjects/sprite/Sprite', () => function ForbiddenSprite() { throw Error('GROUP_SPRITE_FACTORY_FORBIDDEN'); });
const Group = require('phaser/src/gameobjects/group/Group');

const baseSource = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const baseClass = parse(baseSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const methodNames = ['onPlayerDeath', 'pauseFailureRecoveryClock', 'resumeFailureRecoveryClock',
    'retryFromCheckpoint', 'disposeEnemyRuntime', 'defeatEnemy'];

// Real base death/retry/disposal/defeat methods, native Group and the existing
// native encounter fixture. UI, combat-cue drawing and services remain fictional.
function setup() {
    const f = fixture(), scene = f.scene;
    const services = { AchievementSystem: { recordEvent: jest.fn() } };
    const basePrototype = Object.getPrototypeOf(Object.getPrototypeOf(scene));
    for (const name of methodNames) {
        const node = baseClass.body.body.find(item => item.key?.name === name);
        basePrototype[name] = new Function('window', 'console', `return ({${baseSource.slice(node.start, node.end)}}).${name};`)(services, { log() {} });
    }
    scene.children = { remove: jest.fn() };
    scene.sys.updateList = { remove: jest.fn() };
    scene.enemies = new Group(scene);
    scene.physics.add.sprite = (x, y) => f.actor(x, y);
    scene.physics.pause = () => f.world.pause();
    scene.physics.resume = () => f.world.resume();
    scene.configureEnemyCombat = jest.fn((body, config) => {
        Object.assign(body, { combatRole: config.role, maxHealth: config.maxHealth, stompable: true });
        body.combatCue = scene.add.graphics(); return body;
    });
    for (const name of ['endInvincibility', 'beginInvincibility', 'resetPlatformerRecoveryInput',
        'hidePlatformerMobileControls', 'showPlatformerMobileControls', 'showDeathScreen',
        'clearDeathScreen', 'updateHealthDisplay', 'updateEnergyDisplay']) scene[name] = jest.fn();
    scene.input = { keyboard: { enabled: true } };
    Object.assign(scene, { checkpointPosition: { x: 200, y: 200 }, health: 1, maxHealth: 3,
        crystalEnergy: 0, maxCrystalEnergy: 5, isPlayerDead: false });
    const close = f.close;
    f.close = () => { close(); scene.enemies.destroy(); };
    return { ...f, services };
}

describe('Reef summons retire with their encounter and cannot revive through checkpoint retry', () => {
    beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0.5));
    afterEach(() => jest.restoreAllMocks());

    test('real death and checkpoint retry cannot resume an old pending summon wave', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(200);
            f.scene.onPlayerDeath(); expect(f.clock.paused).toBe(true);
            f.scene.retryFromCheckpoint(); expect(f.clock.paused).toBe(false);
            f.advance(1500);
            expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.bossMinions).toHaveLength(0);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('real death/retry retires an active rift rather than reviving its damage', () => {
        const f = setup();
        try {
            f.start(); f.advance(700); f.scene.onPlayerDeath(); f.scene.retryFromCheckpoint(); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('real death/retry retires an old lunge before it can rearm contact', () => {
        const f = setup();
        try {
            f.scene.bossVoidLunge(); const launch = f.configs.find(config => config.yoyo).onComplete;
            f.scene.onPlayerDeath(); f.scene.retryFromCheckpoint(); launch();
            expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.scene.reefBossLunge).toBeNull();
        } finally { f.close(); }
    });

    test('expired minions are removed from the boss list as well as the native Group', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(700); f.advance(2500); f.advance(2500);
            expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.bossMinions).toHaveLength(0);
        } finally { f.close(); }
    });

    test('removing a minion visual cannot leave an invisible enemy alive', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(700); const body = f.scene.bossMinions[0];
            body.graphics.destroy(); f.process();
            expect(body.active).toBe(false);
            expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.bossMinions).toHaveLength(0);
        } finally { f.close(); }
    });

    test('an old pending wave cannot spawn against a replacement Guardian', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.scene.boss = f.actor(600, 200); f.advance(1200);
            expect(f.scene.enemies.getChildren()).toHaveLength(0);
        } finally { f.close(); }
    });

    test('a captured launch cannot spawn the same minion twice', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); const launch = f.timers[0].callback; launch(); launch();
            expect(f.scene.enemies.getChildren()).toHaveLength(1);
        } finally { f.close(); }
    });

    test('a retired wave cannot expose the new encounter using its old recovery timer', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); const recover = f.timers.find(timer => timer.delay === 1900).callback;
            f.scene.guardianEncounter = { id: 'synthetic-new-encounter' }; recover();
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('normal cadence preserves three one-health stompable minions and the1900ms recovery request', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions();
            expect(f.timers.map(timer => timer.delay)).toEqual([700, 920, 1140, 1900]);
            f.advance(699); expect(f.scene.enemies.getChildren()).toHaveLength(0);
            f.advance(1); expect(f.scene.enemies.getChildren()).toHaveLength(1);
            f.advance(220); expect(f.scene.enemies.getChildren()).toHaveLength(2);
            f.advance(220); expect(f.scene.enemies.getChildren()).toHaveLength(3);
            expect(f.scene.bossMinions.every(body => body.health === 1 && body.body.width === 40 && body.body.height === 40)).toBe(true);
            expect(f.scene.configureEnemyCombat.mock.calls.map(call => call[1])).toEqual(Array(3).fill({ role: 'stompable', maxHealth: 1, cueOffsetY: -32 }));
            f.advance(760); expect(f.scene.openReefBossRecovery).toHaveBeenCalledWith(800);
        } finally { f.close(); }
    });

    test('existing base combat defeat retains one energy reward and the ordinary event', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(700); const body = f.scene.bossMinions[0];
            expect(f.scene.defeatEnemy(body)).toBe(true); expect(f.scene.defeatEnemy(body)).toBe(false);
            expect(f.scene.crystalEnergy).toBe(1);
            expect(f.services.AchievementSystem.recordEvent).toHaveBeenCalledTimes(1);
            expect(f.scene.enemies.getChildren()).toHaveLength(0);
        } finally { f.close(); }
    });

    test('phase entry preserves already summoned minions and their normal chase duration', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(700); const body = f.scene.bossMinions[0];
            f.scene.enterReefBossPhase(2);
            expect(body.active).toBe(true); f.advance(500); expect(body.active).toBe(true);
        } finally { f.close(); }
    });

    test.each(['boss', 'bossBody', 'player'])('native %s destruction retires pending and active wave work', name => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); const callbacks = f.timers.map(timer => timer.callback);
            f.advance(700); f.scene[name].destroy(); callbacks.forEach(callback => callback()); f.process();
            expect(f.scene.enemies.getChildren()).toHaveLength(0); expect(f.scene.bossMinions).toHaveLength(0);
            expect(f.scene.reefBossSummons.size).toBe(0); expect(f.scene.reefBossMinionWork.size).toBe(0);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['body-replaced', 'player-replaced', 'encounter', 'dead', 'completed', 'inactive', 'body-disabled'])('%s cannot continue a pending or active wave', change => {
        for (const active of [false, true]) {
            const f = setup();
            try {
                f.scene.bossSummonMinions(); if (active) f.advance(700);
                if (change === 'body-replaced') f.scene.bossBody = f.actor(900, 200);
                if (change === 'player-replaced') f.scene.player = f.actor(250, 200);
                if (change === 'encounter') f.scene.guardianEncounter = { id: 'synthetic-successor' };
                if (change === 'dead') f.scene.isPlayerDead = true;
                if (change === 'completed') f.scene.levelCompletionActive = true;
                if (change === 'inactive') f.scene.sys.isActive = () => false;
                if (change === 'body-disabled') f.scene.bossBody.body.enable = false;
                f.advance(2000);
                expect(f.scene.enemies.getChildren()).toHaveLength(0);
                expect(f.scene.bossMinions).toHaveLength(0);
                expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    });

    test.each(['init', 'shutdown', 'defeat'])('actual %s retires the wave before captured callbacks can act', hook => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); const callbacks = f.timers.map(timer => timer.callback); f.advance(700);
            if (hook === 'init') f.scene.init();
            if (hook === 'shutdown') f.scene.shutdown();
            if (hook === 'defeat') f.scene.defeatBoss();
            const current = f.scene.enemies.getChildren().length;
            callbacks.forEach(callback => callback()); f.process();
            expect(current).toBe(0); expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('legacy two-argument minion creation is still owned and retires on real death', () => {
        const f = setup();
        try {
            const body = f.scene.createVoidMinion(550, 300);
            expect(body.active).toBe(true); f.scene.onPlayerDeath(); f.scene.retryFromCheckpoint();
            expect(body.active).toBe(false); expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.reefBossMinionWork.size).toBe(0);
        } finally { f.close(); }
    });

    test('Reef death delegates existing pause/input/retry behaviour once', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.scene.onPlayerDeath(); f.scene.onPlayerDeath();
            expect(f.scene.endInvincibility).toHaveBeenCalledTimes(1);
            expect(f.scene.showDeathScreen).toHaveBeenCalledTimes(1);
            expect(f.scene.isPlayerDead).toBe(true); expect(f.world.isPaused).toBe(true);
            expect(f.scene.input.keyboard.enabled).toBe(false);
            f.scene.retryFromCheckpoint();
            expect(f.scene.isPlayerDead).toBe(false); expect(f.world.isPaused).toBe(false);
            expect(f.scene.input.keyboard.enabled).toBe(true); expect(f.scene.health).toBe(3);
            expect(f.scene.crystalEnergy).toBe(5);
            expect(f.scene.recoveryInputLockedUntil).toBe(f.clock.now + 550);
        } finally { f.close(); }
    });

    test('normal expiry does not grant combat energy or achievements and releases native references', () => {
        const f = setup();
        try {
            for (let wave = 0; wave < 30; wave++) {
                f.scene.bossSummonMinions();
                for (let frame = 0; frame < 400; frame++) f.advance(10);
                expect(f.scene.enemies.getChildren()).toHaveLength(0); expect(f.scene.bossMinions).toHaveLength(0);
                expect(f.scene.reefBossSummons.size).toBe(0); expect(f.scene.reefBossMinionWork.size).toBe(0);
                expect(f.world.bodies.size).toBe(2);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                for (const actor of [f.scene.boss, f.scene.bossBody, f.scene.player]) expect(actor.listenerCount('destroy')).toBe(0);
            }
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(30);
            expect(f.scene.crystalEnergy).toBe(0); expect(f.services.AchievementSystem.recordEvent).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('combat defeating every child early still retains the ordinary recovery deadline', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(1140);
            [...f.scene.enemies.getChildren()].forEach(body => f.scene.defeatEnemy(body));
            expect(f.scene.crystalEnergy).toBe(3); expect(f.scene.bossMinions).toHaveLength(0);
            expect(f.scene.reefBossSummons.size).toBe(1);
            f.advance(760); expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            expect(f.scene.reefBossSummons.size).toBe(0);
        } finally { f.close(); }
    });

    test('an old child callback cannot alter a newer minion or leave a second native destruction', () => {
        const f = setup();
        try {
            f.scene.bossSummonMinions(); f.advance(700);
            const body = f.scene.bossMinions[0], onDestroy = jest.fn(); body.on('destroy', onDestroy);
            const config = f.configs.find(item => item.targets === body);
            f.scene.defeatEnemy(body); f.advance(220); const current = [...f.scene.enemies.getChildren()];
            config.onUpdate(); config.onComplete(); config.onComplete();
            expect(onDestroy).toHaveBeenCalledTimes(1); expect(f.scene.enemies.getChildren()).toEqual(current);
            expect(f.scene.crystalEnergy).toBe(1);
        } finally { f.close(); }
    });

    test('retiring one wave preserves another wave and an unrelated patrol tween', () => {
        const f = setup();
        try {
            const patrol = f.actor(100, 200), completed = jest.fn(); f.scene.enemies.add(patrol);
            f.tweens.add({ targets: patrol, x: 150, duration: 1000, onComplete: completed });
            f.scene.bossSummonMinions(); const first = [...f.scene.reefBossSummons][0];
            f.scene.bossSummonMinions(); first.retire(); f.advance(1); f.advance(1140);
            expect(completed).toHaveBeenCalledTimes(1);
            expect(f.scene.bossMinions).toHaveLength(3); expect(f.scene.enemies.getChildren()).toHaveLength(4);
        } finally { f.close(); }
    });

    test('normal spawn draws, visual and chase values are retained', () => {
        const f = setup();
        try {
            Math.random.mockReset().mockReturnValueOnce(0.2).mockReturnValueOnce(0.8);
            f.scene.bossSummonMinions(); f.advance(700);
            const body = f.scene.bossMinions[0], graphic = body.graphics;
            expect(Math.random).toHaveBeenCalledTimes(2);
            expect([body.x, body.y]).toEqual([5640, 890]);
            expect(graphic.fillCircle.mock.calls).toEqual([[5640, 890, 20], [5640, 890, 12], [5640, 890, 5]]);
            expect(f.configs.find(config => config.targets === body)).toMatchObject({ x: 200, y: 200, duration: 2500, ease: 'Linear' });
            expect(f.configs[0]).toMatchObject({ duration: 700, scale: 1.08, alpha: 0.35 });
        } finally { f.close(); }
    });

    test.each(['telegraph', 'timer', 'child-art', 'body', 'combat-cue', 'chase', 'recovery'])('partial %s failure retires acquired wave resources and preserves the required error', boundary => {
        const f = setup();
        try {
            const error = Error('synthetic required summon setup failure'), fail = () => { throw error; };
            if (boundary === 'telegraph') f.scene.add.graphics = fail;
            if (boundary === 'timer') {
                const delayed = f.scene.time.delayedCall; let calls = 0;
                f.scene.time.delayedCall = (...args) => { if (++calls === 3) throw error; return delayed(...args); };
            }
            if (boundary === 'telegraph' || boundary === 'timer') expect(() => f.scene.bossSummonMinions()).toThrow(error);
            else {
                f.scene.bossSummonMinions();
                if (boundary === 'child-art') f.scene.add.graphics = fail;
                if (boundary === 'body') f.scene.physics.add.sprite = fail;
                if (boundary === 'combat-cue') {
                    const configure = f.scene.configureEnemyCombat.getMockImplementation();
                    f.scene.configureEnemyCombat.mockImplementation((...args) => { configure(...args); throw error; });
                }
                if (boundary === 'chase') f.scene.tweens.add = fail;
                if (boundary === 'recovery') f.scene.openReefBossRecovery.mockImplementation(fail);
                expect(() => f.advance(boundary === 'recovery' ? 1900 : 700)).toThrow(error);
            }
            f.process(); expect(f.scene.enemies.getChildren()).toHaveLength(0);
            expect(f.scene.bossMinions).toHaveLength(0); expect(f.scene.reefBossSummons.size).toBe(0);
            expect(f.scene.reefBossMinionWork?.size || 0).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });
});
