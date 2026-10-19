const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const { fixture } = require('./support/mountainEncounterFixture.cjs');

const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const source = readPinnedSource('ba0d5544ab162dd19086aed40e5ad16b55d37762:src/scenes/levels/VoidPeaksLevel.js');
const tree = parse(source, { sourceType: 'module' }).program.body;
const cls = tree.find(node => node.type === 'ClassDeclaration');
const original = cls.body.body.find(node => node.key?.name === 'performTitanAttack');
const constants = tree.filter(node => node.type === 'VariableDeclaration' &&
    ['TITAN_ATTACK_WINDOWS', 'TITAN_ATTACK_WINDUP', 'TITAN_RECOVERY_WINDOW'].includes(node.declarations[0]?.id?.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
const previousAttack = new Function('Phaser', `${constants};return ({${source.slice(original.start, original.end)}}).performTitanAttack;`)(
    { Math: { Clamp: require('phaser/src/math/Clamp') } });

function windupFixture() {
    const f = fixture(), { scene } = f;
    Object.assign(scene, { titanAttackIndex: 0, titanAttackLocked: false,
        titanRecoveryUntil: 0, titanAttacksCompleted: 0,
        bossSubtitle: { setText: jest.fn() } });
    scene.add.graphics = () => {
        const g = f.object(0, 0);
        for (const name of ['lineStyle', 'strokeCircle']) g[name] = () => g;
        return g;
    };
    jest.spyOn(scene, 'broadcastTitanWarning').mockImplementation(() => {});
    return f;
}

describe('the mountain attack windup belongs to the encounter that started it', () => {
    afterEach(() => { jest.restoreAllMocks(); });

    test('ordinary windup retains its 42-unit step, five-degree lean and 700ms duration', () => {
        const f = windupFixture();
        try {
            const { scene } = f, x = scene.boss.x;
            scene.performTitanAttack('gravityCrush');
            f.advance(1); f.advance(350);
            expect(scene.boss.x).toBeGreaterThan(x); expect(scene.boss.x).toBeLessThan(x + 42);
            f.advance(350);
            expect(scene.boss.x).toBeCloseTo(x + 42, 8); expect(scene.boss.angle).toBe(5);
            expect(scene.broadcastTitanWarning).toHaveBeenCalledTimes(1);
            expect(scene.broadcastTitanWarning).toHaveBeenCalledWith('gravityCrush', { x: scene.player.x, y: scene.player.y });
            expect(scene.titanWindupMotion).toBeNull();
        } finally { f.close(); }
    });

    test.each([['right', false], ['left', false], ['right', true]])(
        'normal %s motion matches the pinned native tween with queued adjustment=%s', (direction, queuedAdjustment) => {
            function trace(previous) {
                const f = windupFixture();
                try {
                    f.scene.player.x = direction === 'left' ? 4800 : 5040;
                    f.scene.boss.angle = -3;
                    if (previous) previousAttack.call(f.scene, 'gravityCrush');
                    else f.scene.performTitanAttack('gravityCrush');
                    if (queuedAdjustment) f.scene.boss.x += 7;
                    const samples = [];
                    for (const delta of [1, 33, 67, 100, 150, 200, 150]) {
                        f.advance(delta); samples.push([f.scene.boss.x, f.scene.boss.angle]);
                    }
                    return samples;
                } finally { f.close(); }
            }
            const expected = trace(true), current = trace(false);
            current.forEach((sample, i) => sample.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 9)));
        });

    test('death and the actual checkpoint retry do not resume movement from the cancelled attack', () => {
        const f = windupFixture();
        try {
            const { scene } = f;
            scene.performTitanAttack('gravityCrush'); f.advance(1); f.advance(200);
            scene.onPlayerDeath(); const x = scene.boss.x;
            scene.retryFromCheckpoint(); f.advance(500);
            expect(scene.boss.x).toBe(x);
        } finally { f.close(); }
    });

    test('phase entry does not keep sliding on the old attack tween', () => {
        const f = windupFixture();
        try {
            const { scene } = f;
            scene.performTitanAttack('gravityCrush'); f.advance(1); f.advance(200);
            scene.enterTitanPhase(3); const x = scene.boss.x;
            f.advance(500);
            expect(scene.boss.x).toBe(x);
        } finally { f.close(); }
    });

    test.each(['boss-body', 'player', 'player-body', 'plugin', 'encounter', 'phase', 'completion', 'fight-ended', 'events'])(
        '%s replacement does not let the old tween move the current boss', change => {
            const f = windupFixture();
            try {
                const { scene } = f;
                scene.performTitanAttack('gravityCrush'); f.advance(1); f.advance(200);
                if (change === 'boss-body') scene.boss.body = f.actor().body;
                if (change === 'player') scene.player = f.actor();
                if (change === 'player-body') scene.player.body = f.actor().body;
                if (change === 'plugin') scene.scene = {};
                if (change === 'encounter') scene.guardianEncounter = { active: true };
                if (change === 'phase') scene.bossPhase = 3;
                if (change === 'completion') scene.levelCompletionActive = true;
                if (change === 'fight-ended') scene.bossFightActive = false;
                if (change === 'events') scene.events = new EventEmitter();
                const x = scene.boss.x, angle = scene.boss.angle;
                f.advance(500);
                expect(scene.boss.x).toBe(x); expect(scene.boss.angle).toBe(angle);
            } finally { f.close(); }
        });

    test.each(['boss', 'player', 'shutdown', 'init', 'clear'])(
        '%s cleanup retires only this motion and leaves unrelated native tweens running', reason => {
            const f = windupFixture();
            try {
                const { scene } = f;
                scene.performTitanAttack('gravityCrush'); f.advance(1); f.advance(200);
                const boss = scene.boss, x = boss.x, owner = scene.titanWindupMotion;
                const other = { progress: 0 }; f.tweens.add({ targets: other, progress: 1, duration: 5000 });
                if (reason === 'boss') scene.boss.destroy();
                if (reason === 'player') scene.player.destroy();
                if (reason === 'shutdown') scene.events.emit('shutdown');
                if (reason === 'init') scene.init({});
                if (reason === 'clear') scene.clearTitanWindup();
                f.advance(500);
                expect(boss.x).toBe(x); expect(owner.retired).toBe(true); expect(owner.tween).toBeNull();
                expect(scene.titanWindupMotion).toBeNull(); expect(f.tweens.getTweensOf(other)).toHaveLength(1);
            } finally { f.close(); }
        });

    test('captured stale tween callbacks cannot erase or move a later windup', () => {
        const f = windupFixture();
        try {
            const { scene } = f;
            scene.performTitanAttack('gravityCrush'); const oldCallbacks = f.configs[0];
            f.advance(1); f.advance(200); scene.clearTitanWindup();
            scene.titanAttackLocked = false; scene.performTitanAttack('gravityCrush');
            const next = scene.titanWindupMotion, x = scene.boss.x;
            oldCallbacks.onStart(); oldCallbacks.onUpdate(); oldCallbacks.onComplete();
            expect(scene.boss.x).toBe(x); expect(scene.titanWindupMotion).toBe(next); expect(next.retired).toBe(false);
            f.advance(1); f.advance(700); expect(scene.boss.x).toBeGreaterThan(x);
        } finally { f.close(); }
    });

    test('a required tween setup error cleans owned listeners and remains visible', () => {
        const f = windupFixture();
        try {
            const { scene } = f, before = [scene.boss.listenerCount('destroy'), scene.player.listenerCount('destroy'),
                scene.events.listenerCount('shutdown')];
            jest.spyOn(f.tweens, 'add').mockImplementationOnce(() => { throw Error('Fictional tween setup failure'); });
            expect(() => scene.performTitanAttack('gravityCrush')).toThrow('Fictional tween setup failure');
            expect(scene.titanWindupMotion).toBeNull();
            expect([scene.boss.listenerCount('destroy'), scene.player.listenerCount('destroy'),
                scene.events.listenerCount('shutdown')]).toEqual(before);
        } finally { f.close(); }
    });

    test.each(['dead', 'disabled-body', 'completed'])(
        '%s cannot spend the next normal attack or begin another windup', reason => {
            const f = windupFixture();
            try {
                const { scene } = f;
                if (reason === 'dead') scene.isPlayerDead = true;
                if (reason === 'disabled-body') scene.player.body.enable = false;
                if (reason === 'completed') scene.levelCompletionActive = true;
                scene.performTitanAttack();
                expect(scene.titanAttackIndex).toBe(0); expect(scene.titanAttackLocked).toBe(false);
                expect(scene.titanWindupMotion).toBeUndefined();
                expect(scene.broadcastTitanWarning).not.toHaveBeenCalled();
            } finally { f.close(); }
        });
});
