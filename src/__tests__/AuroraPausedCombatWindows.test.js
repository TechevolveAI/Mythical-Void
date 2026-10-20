const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { fixture } = require('./support/auroraCombatFixture.cjs');
const source = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.map(node => node.declaration || node)
    .find(node => node.type === 'ClassDeclaration');
const PauseSession = new Function(`return (${source.slice(cls.start, cls.end)});`)();
function pause(f, duration) {
    const session = PauseSession.open(f.scene);
    expect(session).not.toBeNull();
    f.scene.pauseMenuActive = true; f.advance(duration);
    f.scene.pauseMenuActive = false; session.release();
}
function opening(f, attack = 'flame_dive', attackDuration = 1900) {
    f.scene.executeBossAttack(attack); f.advance(700); f.advance(attackDuration);
}

describe('Aurora authored combat uses active recovery time', () => {
    afterEach(() => jest.restoreAllMocks());

    test('control: the actual flame-dive recovery bonus lasts exactly650ms', () => {
        const f = fixture(), { scene } = f;
        try {
            opening(f); f.advance(649); scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
            f.advance(1); scene.damageBoss(1); expect(scene.bossHealth).toBe(97);
            expect(scene.boss.isAttacking).toBe(false);
        } finally { f.close(); }
    });

    test.each([200, 5000])('an actual attack opening retains its bonus through a %sms menu', duration => {
        const f = fixture(), { scene } = f;
        try {
            opening(f); f.advance(100); pause(f, duration); f.advance(549);
            scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
            f.advance(1); scene.damageBoss(1); expect(scene.bossHealth).toBe(97);
        } finally { f.close(); }
    });

    test.each([2, 3])('phase%s recovery retains the same bonus and unlocks once after a long menu', phase => {
        const f = fixture(), { scene } = f;
        try {
            scene[phase === 2 ? 'triggerPhase2' : 'triggerPhase3'](); f.advance(1300);
            f.advance(100); pause(f, 5000); f.advance(549);
            scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
            expect(scene.boss.isAttacking).toBe(true);
            f.advance(1); expect(scene.boss.isAttacking).toBe(false);
            expect(scene.startBossHover).toHaveBeenCalledTimes(1);
            scene.damageBoss(1); expect(scene.bossHealth).toBe(97);
        } finally { f.close(); }
    });

    test('a direct paused hit cannot spend a saved route charge or boss health', () => {
        const f = fixture(), { scene } = f;
        try {
            opening(f); scene.consumeCurrentCharge.mockReturnValue(2);
            PauseSession.open(scene); scene.pauseMenuActive = true;
            expect(scene.damageBoss(1)).toBe(false);
            expect(scene.bossHealth).toBe(100); expect(scene.consumeCurrentCharge).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each([['flame_dive', 1900], ['shadow_feathers', 1700], ['fire_trail', 2500],
        ['rebirth_nova', 1900], ['shadow_clones', 2200]])('%s retains its authored windup, active time and650ms recovery', (attack, duration) => {
        const f = fixture(), { scene } = f;
        try {
            const dispatch = jest.spyOn(scene, 'dispatchBossAttack');
            scene.executeBossAttack(attack); f.advance(699); expect(dispatch).not.toHaveBeenCalled();
            f.advance(1); expect(dispatch).toHaveBeenCalledTimes(1);
            f.advance(duration - 1); expect(scene.phoenixRecoveryWindow).toBeNull();
            f.advance(1); expect(scene.phoenixRecoveryWindow.remaining()).toBe(650);
            pause(f, 5000); f.advance(649);
            scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
            expect(scene.boss.isAttacking).toBe(true);
            f.advance(1); expect(scene.phoenixRecoveryWindow).toBeNull(); expect(scene.boss.isAttacking).toBe(false);
        } finally { f.close(); }
    });

    test('repeated menus preserve native remaining time and the existing non-default clock rate', () => {
        const f = fixture(), { scene } = f;
        try {
            opening(f); f.clock.timeScale = 0.5;
            f.advance(100); pause(f, 200); f.advance(100); pause(f, 5000);
            expect(scene.phoenixRecoveryWindow.remaining()).toBe(550);
            f.advance(1099); scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
            f.advance(1); scene.damageBoss(1); expect(scene.bossHealth).toBe(97);
            expect(f.clock.timeScale).toBe(0.5);
        } finally { f.close(); }
    });

    test('the real route-charge method remains unspent while paused and is consumed once on a valid hit', () => {
        const f = fixture(), { scene } = f;
        try {
            opening(f);
            scene.consumeCurrentCharge.mockImplementation(Object.getPrototypeOf(scene).consumeCurrentCharge.bind(scene));
            scene.currentChargeReady = true; scene.currentChargeDamage = 2;
            const session = PauseSession.open(scene); scene.pauseMenuActive = true;
            expect(scene.damageBoss(1)).toBe(false); expect(scene.currentChargeReady).toBe(true);
            expect(scene.refreshPersistedExpeditionRouteState).not.toHaveBeenCalled();
            scene.pauseMenuActive = false; session.release();
            expect(scene.damageBoss(1)).toBe(true); expect(scene.bossHealth).toBe(96);
            expect(scene.currentChargeReady).toBe(false);
            expect(scene.refreshPersistedExpeditionRouteState).toHaveBeenCalledTimes(1);
            scene.damageBoss(1); expect(scene.bossHealth).toBe(94);
            expect(scene.refreshPersistedExpeditionRouteState).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['death', 'disabled-body', 'inactive-scene', 'paused-clock', 'paused-world'])(
        '%s rejects direct damage without spending the route charge', condition => {
            const f = fixture(), { scene } = f;
            try {
                opening(f);
                if (condition === 'death') scene.isPlayerDead = true;
                if (condition === 'disabled-body') scene.player.body.enable = false;
                if (condition === 'inactive-scene') scene.sys.isActive = () => false;
                if (condition === 'paused-clock') f.clock.paused = true;
                if (condition === 'paused-world') f.world.pause();
                expect(scene.damageBoss(1)).toBe(false); expect(scene.bossHealth).toBe(100);
                expect(scene.consumeCurrentCharge).not.toHaveBeenCalled();
            } finally { f.close(); }
        });

    test.each([0, -1, NaN, Infinity])('invalid damage%s cannot increase health or consume a route charge', amount => {
        const f = fixture(), { scene } = f;
        try {
            expect(scene.damageBoss(amount)).toBe(false); expect(scene.bossHealth).toBe(100);
            expect(scene.consumeCurrentCharge).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['boss-body', 'target-body', 'player-body', 'clock', 'world', 'systems', 'events',
        'plugin', 'encounter', 'phase', 'attack', 'lifetime', 'completion'])(
        'a recovery cannot transfer to a replaced %s context', replacement => {
            const f = fixture(), { scene } = f;
            try {
                opening(f); const window = scene.phoenixRecoveryWindow;
                if (replacement === 'boss-body') scene.boss.body = f.actor(500, 800).body;
                if (replacement === 'target-body') scene.bossBody.body = f.actor(500, 835).body;
                if (replacement === 'player-body') scene.player.body = f.actor(200, 800).body;
                if (replacement === 'clock') scene.time = {};
                if (replacement === 'world') scene.physics.world = {};
                if (replacement === 'systems') scene.sys = {};
                if (replacement === 'events') scene.events = new (require('eventemitter3'))();
                if (replacement === 'plugin') scene.scene = {};
                if (replacement === 'encounter') scene.guardianEncounter = {};
                if (replacement === 'phase') scene.bossPhase = 2;
                if (replacement === 'attack') scene.phoenixAttackLifetime = {};
                if (replacement === 'lifetime') scene.phoenixCombatLifetime = {};
                if (replacement === 'completion') scene.levelCompletionActive = true;
                expect(window.remaining()).toBe(0);
            } finally { f.close(); }
        });

    test('a retained old unlock cannot clear the next attack or its native alias', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.executeBossAttack('flame_dive'); const unlock = scene.bossAttackUnlockTimer.callback;
            scene.boss.isAttacking = false; scene.executeBossAttack('shadow_feathers'); const timer = scene.bossAttackUnlockTimer;
            unlock(); expect(scene.bossAttackUnlockTimer).toBe(timer); expect(scene.boss.isAttacking).toBe(true);
        } finally { f.close(); }
    });

    test('a retained prior-phase completion cannot open recovery or release the next phase', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.triggerPhase2(); const old = scene.bossPhaseRecoveryTimer.callback;
            scene.triggerPhase3(); const timer = scene.bossPhaseRecoveryTimer;
            old(); expect(scene.bossPhaseRecoveryTimer).toBe(timer);
            expect(scene.phoenixRecoveryWindow).toBeNull(); expect(scene.boss.isAttacking).toBe(true);
            f.advance(1300); f.advance(650); expect(scene.boss.isAttacking).toBe(false);
        } finally { f.close(); }
    });

    test('a stale attack recovery cannot install a window after actual reinitialisation', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.executeBossAttack('flame_dive'); const resolution = f.timers.find(timer => timer.delay === 2600).callback;
            scene.init({}); resolution(); expect(scene.phoenixRecoveryWindow).toBeNull();
        } finally { f.close(); }
    });

    test.each(['boss', 'bossBody', 'player'])('native%s destruction retires only its owned window', actor => {
        const f = fixture(), { scene } = f;
        try {
            const unrelated = f.clock.delayedCall(10000, () => {});
            scene.openPhoenixRecovery(f.capture()); const window = scene.phoenixRecoveryWindow;
            scene[actor].destroy();
            expect(window.retired).toBe(true); expect(scene.phoenixRecoveryWindow).toBeNull();
            expect(unrelated.callback).toBeInstanceOf(Function);
        } finally { f.close(); }
    });

    test('a cancelled expiry cannot clear a successor window or leak lifecycle listeners', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.openPhoenixRecovery(f.capture()); const old = scene.phoenixRecoveryWindow.timer.callback;
            for (let i = 0; i < 30; i++) scene.openPhoenixRecovery(f.capture());
            const current = scene.phoenixRecoveryWindow; old();
            expect(scene.phoenixRecoveryWindow).toBe(current);
            expect(scene.events.listenerCount('shutdown')).toBe(1);
            for (const actor of [scene.boss, scene.bossBody, scene.player]) expect(actor.listenerCount('destroy')).toBe(1);
            current.retire(); expect(scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test('actual shutdown retires the timing source and current window', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.openPhoenixRecovery(f.capture()); const window = scene.phoenixRecoveryWindow, source = f.capture();
            scene.shutdown();
            expect(window.retired).toBe(true); expect(source.isCurrent()).toBe(false);
            expect(scene.phoenixRecoveryWindow).toBeNull();
        } finally { f.close(); }
    });

    test('optional recovery text failure cannot remove the actual earned opening', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.bossSubtitle.setText = () => { throw Error('fictional cue failure'); };
            expect(() => opening(f)).not.toThrow();
            scene.damageBoss(1); expect(scene.bossHealth).toBe(98);
        } finally { f.close(); }
    });

    test('required native window setup failure remains an error without a window or listener leak', () => {
        const f = fixture(), { scene } = f;
        try {
            jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('fictional timer failure'); });
            expect(() => scene.openPhoenixRecovery(f.capture())).toThrow('fictional timer failure');
            expect(scene.phoenixRecoveryWindow).toBeNull(); expect(scene.events.listenerCount('shutdown')).toBe(0);
            for (const actor of [scene.boss, scene.bossBody, scene.player]) expect(actor.listenerCount('destroy')).toBe(0);
        } finally { f.close(); }
    });

    test.each([700, 3250])('required attack timer%s setup failure cannot leave an invisible permanent attack lock', delay => {
        const f = fixture(), { scene } = f;
        try {
            const dispatch = jest.spyOn(scene, 'dispatchBossAttack');
            const delayedCall = f.clock.delayedCall.bind(f.clock);
            let failed = false;
            jest.spyOn(f.clock, 'delayedCall').mockImplementation((duration, ...args) => {
                if (duration === delay && !failed) { failed = true; throw Error('fictional attack timer failure'); }
                return delayedCall(duration, ...args);
            });
            expect(() => scene.executeBossAttack('flame_dive')).toThrow('fictional attack timer failure');
            expect(scene.boss.isAttacking).toBe(false); expect(scene.bossEncounterTimers.size).toBe(0);
            f.timers.find(timer => timer.delay === 700)?.callback();
            expect(dispatch).not.toHaveBeenCalled();
            scene.executeBossAttack('flame_dive'); expect(scene.boss.isAttacking).toBe(true);
        } finally { f.close(); }
    });

    test.each(['shake', 'text', 'graphics'])('optional phase%s failure cannot block native recovery', boundary => {
        const f = fixture(), { scene } = f;
        try {
            const fail = () => { throw Error('fictional phase feedback failure'); };
            if (boundary === 'shake') f.services.FeedbackManager = { cameraShake: fail };
            if (boundary === 'text') jest.spyOn(scene.add, 'text').mockImplementationOnce(fail);
            if (boundary === 'graphics') jest.spyOn(scene.add, 'graphics').mockImplementationOnce(fail);
            expect(() => scene.triggerPhase2()).not.toThrow();
            f.advance(1300); expect(scene.phoenixRecoveryWindow.remaining()).toBe(650);
            f.advance(650); expect(scene.boss.isAttacking).toBe(false);
            expect(scene.startBossHover).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('required phase timer setup failure stays an error without a permanent phase lock', () => {
        const f = fixture(), { scene } = f;
        try {
            jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('fictional phase timer failure'); });
            expect(() => scene.triggerPhase2()).toThrow('fictional phase timer failure');
            expect(scene.boss.isAttacking).toBe(false); expect(scene.bossPhaseRecoveryTimer).toBeNull();
        } finally { f.close(); }
    });

    test('required phase-unlock setup failure retains the opening and does not permanently lock the boss', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.triggerPhase2();
            const delayedCall = f.clock.delayedCall.bind(f.clock);
            let calls = 0;
            jest.spyOn(f.clock, 'delayedCall').mockImplementation((duration, ...args) => {
                if (duration === 650 && ++calls === 2) throw Error('fictional phase unlock failure');
                return delayedCall(duration, ...args);
            });
            expect(() => f.advance(1300)).toThrow('fictional phase unlock failure');
            expect(scene.boss.isAttacking).toBe(false); expect(scene.bossPhaseRecoveryTimer).toBeNull();
            expect(scene.phoenixRecoveryWindow.remaining()).toBe(650);
            f.advance(650); expect(scene.phoenixRecoveryWindow).toBeNull();
            scene.executeBossAttack('flame_dive'); expect(scene.boss.isAttacking).toBe(true);
        } finally { f.close(); }
    });

    test('the offline route-smoke body uses native actors without relaxing its3-then1 damage assertion', () => {
        const f = fixture(), { scene } = f;
        try {
            const smoke = fs.readFileSync(path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'), 'utf8');
            const ast = parse(smoke, { sourceType: 'module' }).program.body;
            const journey = ast.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'smokeAuroraRouteJourney');
            const statement = journey.body.body.find(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'directRestore');
            const template = statement.declarations[0].init.argument.arguments[1];
            expect(template.type).toBe('TemplateLiteral'); expect(template.expressions).toHaveLength(0);
            scene.add.zone = (x, y) => f.actor(x, y);
            scene.physics.add = { existing: jest.fn() };
            scene.consumeCurrentCharge.mockImplementation(Object.getPrototypeOf(scene).consumeCurrentCharge.bind(scene));
            scene.currentChargeReady = true; scene.currentChargeDamage = 2; scene.auroraRouteChoice = 'shadow_current';
            scene.currentChargeAura = { active: true }; scene.currentChargeAuraTween = {};
            scene.clearCurrentChargeAura.mockImplementation(() => {
                scene.currentChargeAura = null; scene.currentChargeAuraTween = null;
            });
            const state = { get: () => ({ routeState: { currentChargeReady: scene.currentChargeReady } }) };
            const result = new Function('window', `return ${template.quasis[0].value.cooked};`)({
                mythicalGame: { scene: { getScene: () => scene } }, GameState: state
            });
            expect(result.first).toEqual({ health: 9, charge: false, checkpointCharge: false });
            expect(result.secondHealth).toBe(8); expect(result.auraAfter || result.tweenAfter).toBe(false);
            expect(scene.boss.body.world).toBe(f.world); expect(scene.bossBody.body.world).toBe(f.world);
            // This exercises the smoke's actor/charge contract, not its browser or real save writer.
        } finally { f.close(); }
    });

    test('the existing100ms hit tint still clears when the same boss begins its next attack', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.damageBoss(1); scene.executeBossAttack('flame_dive');
            f.advance(100); expect(scene.boss.clearTint).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('an old hit tint cannot clear the new phase colour', () => {
        const f = fixture(), { scene } = f;
        try {
            scene.bossHealth = 61; scene.damageBoss(1); expect(scene.bossPhase).toBe(2);
            f.advance(100); expect(scene.boss.clearTint).not.toHaveBeenCalled();
        } finally { f.close(); }
    });
});
