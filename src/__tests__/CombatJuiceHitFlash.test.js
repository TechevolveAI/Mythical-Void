const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('eventemitter3');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Tint = require('phaser/src/gameobjects/components/Tint');
const Clock = require('phaser/src/time/Clock');
const { parse } = require('@babel/parser');
const { ForestCombatTime } = require('./support/forestCombatFixture.cjs');

const source = fs.readFileSync(path.join(__dirname, '../systems/CombatJuice.js'), 'utf8');
const CombatJuice = new Function('window', 'console',
    source.replace('export default class CombatJuice', 'class CombatJuice') + '\nreturn CombatJuice;')({}, { log() {} });
const corners = ['tintTopLeft', 'tintTopRight', 'tintBottomLeft', 'tintBottomRight'];
const colours = actor => corners.map(key => actor[key]);

// Installed tint, destruction and Clock primitives with fictional scene services.
// No game, renderer, browser, audio, saves or providers are started.
function fixture() {
    const events = new EventEmitter();
    const scene = { events, sys: { events, queueDepthSort() {} } };
    const clock = scene.time = new Clock(scene);
    const timers = [], actors = [];
    const delayedCall = clock.delayedCall.bind(clock);
    clock.delayedCall = (delay, callback) => {
        const timer = delayedCall(delay, callback);
        timers.push({ timer, callback });
        return timer;
    };
    const actor = () => {
        const value = new GameObject(scene, 'SyntheticTintActor');
        Object.defineProperties(value, Object.fromEntries(Object.entries(Tint).map(([key, descriptor]) =>
            [key, descriptor && typeof descriptor === 'object' && (descriptor.get || descriptor.set)
                ? { ...descriptor, configurable: true }
                : { value: descriptor, writable: true, configurable: true }])));
        actors.push(value);
        return value;
    };
    const juice = new CombatJuice(scene), target = actor();
    const advance = delta => {
        clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate();
    };
    return { scene, clock, events, timers, actors, actor, target, juice, advance,
        close() { scene.forestBossHitCooldown?.retire(); juice.cleanup(); actors.forEach(value => value.destroy()); clock.destroy(); } };
}

describe('shared hit flashes preserve the current actor appearance', () => {
    test('ordinary white feedback retains its existing 100ms duration', () => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target); expect(f.timers[0].timer.delay).toBe(100);
            f.advance(99); expect(colours(f.target)).toEqual([0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF]);
            f.advance(1); expect(f.target.isTinted).toBe(false);
        } finally { f.close(); }
    });

    test.each([false, true])('restores all original corners including black, fill=%s', fill => {
        const f = fixture();
        try {
            f.target[fill ? 'setTintFill' : 'setTint'](0, 0x123456, 0x234567, 0x345678);
            f.juice.hitFlash(f.target, 0xFF0000, 150); f.advance(149);
            expect(colours(f.target)).toEqual([0xFF0000, 0xFF0000, 0xFF0000, 0xFF0000]);
            f.advance(1);
            expect(colours(f.target)).toEqual([0, 0x123456, 0x234567, 0x345678]);
            expect(f.target.tintFill).toBe(fill);
        } finally { f.close(); }
    });

    test('a second hit owns its whole duration and restores the first baseline', () => {
        const f = fixture();
        try {
            f.target.setTint(0x785634); f.juice.hitFlash(f.target, 0xFF0000, 100);
            f.advance(40); f.juice.hitFlash(f.target, 0xFFFFFF, 100);
            f.advance(60); expect(f.target.tintTopLeft).toBe(0xFFFFFF);
            f.advance(39); expect(f.target.tintTopLeft).toBe(0xFFFFFF);
            f.advance(1); expect(f.target.tintTopLeft).toBe(0x785634);
        } finally { f.close(); }
    });

    test('a captured old timer cannot end a replacement flash', () => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target, 0xFF0000); const old = f.timers[0].callback;
            f.juice.hitFlash(f.target, 0x123456); old();
            expect(f.target.tintTopLeft).toBe(0x123456);
            f.advance(100); expect(f.target.isTinted).toBe(false);
        } finally { f.close(); }
    });

    test.each(['restoration', 'corner', 'fill'])('does not erase a later %s appearance', change => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target);
            if (change === 'restoration') f.target.setTint(0x8FE3CF);
            if (change === 'corner') f.target.tintBottomRight = 0;
            if (change === 'fill') f.target.setTintFill(0xFFFFFF);
            const expected = { corners: colours(f.target), fill: f.target.tintFill };
            f.advance(100);
            expect({ corners: colours(f.target), fill: f.target.tintFill }).toEqual(expected);
        } finally { f.close(); }
    });

    test('the actual Forest finishing hit retains its restored Guardian colour', () => {
        const f = fixture();
        try {
            const forest = fs.readFileSync(path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'), 'utf8');
            const declaration = parse(forest, { sourceType: 'module' }).program.body
                .find(node => node.type === 'ClassDeclaration');
            Object.assign(f.scene, { boss: f.target, player: f.actor(), combatJuice: f.juice,
                bossHealth: 1, bossMaxHealth: 18, bossPhase: 2, bossFightActive: true,
                bossEntranceComplete: true, bossPhaseAttackCount: 1, forestBossNextHitAt: 0,
                forestBossHits: 0, forestRecoveryDamage: 0, updateBossHealthBar() {},
                showFloatingText() {}, clearForestBossPacing() {},
                enterLevelCompletionState() { this.levelCompletionActive = true; },
                showForestRestorationSequence: jest.fn(() => true) });
            f.target.isRecovering = true;
            f.scene.physics = { world: { isPaused: false } };
            f.scene.sys.isActive = () => true;
            f.target.body = { enable: true, world: f.scene.physics.world, setAllowGravity() {}, destroy() {} };
            f.scene.player.body = { enable: true, world: f.scene.physics.world, destroy() {} };
            f.target.setVelocity = () => f.target;
            for (const method of ['registerHit', 'screenShake', 'hitStop']) f.juice[method] = jest.fn();
            for (const name of ['damageBoss', 'onBossDefeated']) {
                const node = declaration.body.body.find(node => node.key.name === name);
                f.scene[name] = new Function('ForestCombatTime', 'window', 'console',
                    `return ({${forest.slice(node.start, node.end)}}).${name};`)(ForestCombatTime, {}, { log() {} });
            }
            expect(f.scene.damageBoss(3)).toBe(true);
            expect(f.scene.bossDefeated).toBe(true);
            expect(f.scene.showForestRestorationSequence).toHaveBeenCalledTimes(1);
            expect(f.target.tintTopLeft).toBe(0x8FE3CF);
            f.advance(100); expect(f.target.tintTopLeft).toBe(0x8FE3CF);
        } finally { f.close(); }
    });

    test('a hit after an external colour change captures that new baseline', () => {
        const f = fixture();
        try {
            f.target.setTint(0x123456); f.juice.hitFlash(f.target);
            f.target.setTint(0x8FE3CF); f.juice.hitFlash(f.target, 0xFF0000);
            f.advance(100); expect(f.target.tintTopLeft).toBe(0x8FE3CF);
        } finally { f.close(); }
    });

    test('separate actors retain independent flashes and colours', () => {
        const f = fixture();
        try {
            const other = f.actor(); other.setTint(0x234567);
            f.juice.hitFlash(f.target, 0xFF0000, 80); f.juice.hitFlash(other, 0x123456, 150);
            f.advance(80); expect(f.target.isTinted).toBe(false); expect(other.tintTopLeft).toBe(0x123456);
            f.advance(70); expect(other.tintTopLeft).toBe(0x234567);
        } finally { f.close(); }
    });

    test.each(['cleanup', 'shutdown'])('%s retires only its own pending feedback', boundary => {
        const f = fixture();
        try {
            const unrelated = jest.fn(); f.clock.delayedCall(100, unrelated);
            f.target.setTint(0x123456); f.juice.hitFlash(f.target, 0xFF0000);
            const old = f.timers.at(-1).callback;
            if (boundary === 'cleanup') f.juice.cleanup(); else f.events.emit('shutdown');
            expect(f.target.tintTopLeft).toBe(0x123456);
            expect(f.target.listenerCount('destroy')).toBe(0);
            f.target.setTint(0x8FE3CF); old(); f.advance(100);
            expect(f.target.tintTopLeft).toBe(0x8FE3CF); expect(unrelated).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('cleanup preserves an external restoration colour', () => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target); f.target.setTint(0x8FE3CF); f.juice.cleanup();
            expect(f.target.tintTopLeft).toBe(0x8FE3CF);
        } finally { f.close(); }
    });

    test('native destruction releases the timer closure and lifetime listeners', () => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target); const pending = f.timers[0]; f.target.destroy();
            expect(pending.timer.callback).toBeUndefined();
            expect(f.events.listenerCount('shutdown')).toBe(0);
            expect(() => pending.callback()).not.toThrow();
        } finally { f.close(); }
    });

    test('one hundred rapid hits retain only one dispatchable timer', () => {
        const f = fixture();
        try {
            f.target.setTint(0x123456);
            for (let n = 0; n < 100; n++) f.juice.hitFlash(f.target, 0xFF0000);
            expect(f.timers.filter(({ timer }) => !timer.hasDispatched && timer.callback)).toHaveLength(1);
            expect(f.target.listenerCount('destroy')).toBe(1);
            f.advance(100); expect(f.target.tintTopLeft).toBe(0x123456);
            expect(f.clock._active).toHaveLength(0);
            expect(f.target.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('timer setup failure does not leave the actor recoloured', () => {
        const f = fixture();
        try {
            f.target.setTint(0x123456);
            f.clock.delayedCall = () => { throw Error('SYNTHETIC_TIMER_FAILURE'); };
            expect(() => f.juice.hitFlash(f.target, 0xFF0000)).not.toThrow();
            expect(f.target.tintTopLeft).toBe(0x123456);
            expect(f.target.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test('a replaced manager scene cannot repaint the previous actor', () => {
        const f = fixture();
        try {
            f.juice.hitFlash(f.target, 0xFF0000); f.juice.scene = {};
            f.advance(100); expect(f.target.tintTopLeft).toBe(0xFF0000);
        } finally { f.close(); }
    });

    test.each(['destroyed', 'unsupported', 'missing-clock'])('ignores %s targets or owners without mutation', reason => {
        const f = fixture();
        try {
            const target = reason === 'unsupported' ? { active: true } : f.target;
            if (reason === 'destroyed') target.destroy();
            if (reason === 'missing-clock') f.scene.time = null;
            const before = colours(f.target);
            expect(() => f.juice.hitFlash(target)).not.toThrow();
            expect(colours(f.target)).toEqual(before); expect(f.timers).toHaveLength(0);
        } finally { f.close(); }
    });
});
