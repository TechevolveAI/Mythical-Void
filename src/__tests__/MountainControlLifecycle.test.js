const { fixture } = require('./support/mountainEncounterFixture.cjs');

function controlFixture() {
    const f = fixture(), { scene } = f;
    const drawing = () => {
        const value = f.object(0, 0);
        for (const method of ['lineStyle', 'fillStyle', 'strokeCircle', 'fillRect', 'fillTriangle', 'lineBetween', 'setText']) {
            value[method] = jest.fn(() => value);
        }
        return value;
    };
    Object.assign(scene, { titanAttackIndex: 0, titanAttackLocked: false, titanRecoveryUntil: 0,
        titanAttacksCompleted: 0, titanRecoveryDamage: 0, bossSubtitle: drawing(),
        cameras: { main: { width: 390, height: 844, panEffect: { reset: jest.fn() },
            centerOn: jest.fn(), stopFollow: jest.fn(), startFollow: jest.fn() } },
        levelWidth: 8000, isMobile: true, cameraLeadAmount: 120, cameraBaseOffsetY: 0,
        resetJoystick: jest.fn(), releaseAllPlatformerActionButtons: jest.fn(), clearVirtualJumpInput: jest.fn() });
    scene.add.graphics = drawing;
    scene.input.keyboard.resetKeys = jest.fn();
    for (const actor of [scene.boss, scene.player]) actor.getBounds = () => ({ left: actor.x - 20, right: actor.x + 20 });
    const execute = jest.spyOn(scene, 'executeTitanAttack').mockImplementation(() => {});
    return { ...f, execute };
}

describe('mountain combat control timers retain their original encounter', () => {
    afterEach(() => jest.restoreAllMocks());

    test('control: ordinary warning launches once after700ms and opens the existing recovery window', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush');
            f.advance(699); expect(f.execute).not.toHaveBeenCalled();
            f.advance(1); expect(f.execute).toHaveBeenCalledTimes(1);
            f.advance(1799); expect(scene.titanAttacksCompleted).toBe(0);
            f.advance(1); expect(scene.titanAttacksCompleted).toBe(1);
            expect(scene.titanRecoveryUntil).toBe(f.clock.now + 1800);
        } finally { f.close(); }
    });

    test('a retained completed warning cannot launch twice or erase a newer warning', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); const old = scene.titanWarningTimer.callback;
            f.advance(700); f.execute.mockClear();
            scene.titanAttackLocked = false; scene.performTitanAttack('starRain'); const next = scene.titanWarningTimer;
            old(); expect(f.execute).not.toHaveBeenCalled(); expect(scene.titanWarningTimer).toBe(next);
        } finally { f.close(); }
    });

    test('native warning delivery cannot launch from a replacement boss', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); scene.boss = f.actor(4900, 400);
            f.advance(700); expect(f.execute).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a cancelled old-phase warning cannot replace the next phase attack', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); const old = scene.titanWarningTimer.callback;
            scene.enterTitanPhase(3); f.advance(1300);
            const next = scene.titanWarningTimer; expect(next).toBeTruthy(); f.execute.mockClear();
            old(); expect(f.execute).not.toHaveBeenCalled(); expect(scene.titanWarningTimer).toBe(next);
        } finally { f.close(); }
    });

    test('a retained old unlock cannot disarm or clear the current attack lock', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); const old = scene.titanAttackUnlockTimer.callback;
            scene.titanAttackLocked = false; scene.performTitanAttack('starRain'); const next = scene.titanAttackUnlockTimer;
            old(); expect(scene.titanAttackLocked).toBe(true); expect(scene.titanAttackUnlockTimer).toBe(next);
        } finally { f.close(); }
    });

    test('retired recovery cannot clear successor effects or award another attack opening', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); f.advance(700);
            const timer = [...scene.bossEncounterTimers][0], old = timer.callback;
            scene.clearBossEncounterTimers(); scene.guardianEncounter = { active: true };
            const effect = scene.trackBossEffect(f.object(0, 0)), count = scene.titanAttacksCompleted;
            old(); expect(effect.active).toBe(true); expect(scene.titanAttacksCompleted).toBe(count);
            expect(scene.titanRecoveryUntil).toBe(0);
        } finally { f.close(); }
    });

    test('a retained phase completion cannot unlock or clear a later phase', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.enterTitanPhase(3); const old = scene.titanPhaseRecoveryTimer.callback;
            scene.enterTitanPhase(4); const next = scene.titanPhaseRecoveryTimer;
            old(); expect(scene.titanPhaseRecoveryTimer).toBe(next); expect(scene.titanAttackLocked).toBe(true);
            expect(scene.titanAttackIndex).toBe(0);
        } finally { f.close(); }
    });

    test('a removed AI loop callback cannot spend a successor attack', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.startTitanAttackLoop(); const old = scene.bossAttackTimer.callback;
            scene.startTitanAttackLoop(); const next = scene.bossAttackTimer;
            old(); expect(scene.titanAttackIndex).toBe(0); expect(scene.titanAttackLocked).toBe(false);
            expect(scene.bossAttackTimer).toBe(next);
        } finally { f.close(); }
    });

    test('a retained opening callback cannot clear a replacement opening timer', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.bossCombatReady = false; expect(scene.beginTitanCombat()).toBe(true);
            const old = scene.bossAttackPreviewTimer.callback;
            scene.bossCombatReady = false; expect(scene.beginTitanCombat()).toBe(true);
            const next = scene.bossAttackPreviewTimer;
            old(); expect(scene.bossAttackPreviewTimer).toBe(next); expect(scene.titanAttackIndex).toBe(0);
        } finally { f.close(); }
    });

    test.each(['boss-body', 'player', 'player-body', 'plugin', 'encounter', 'phase', 'clock', 'world', 'tweens', 'events', 'completion', 'defeat', 'fight-ended'])(
        'native warning rejects %s retirement or replacement', reason => {
            const f = controlFixture(), { scene } = f;
            try {
                scene.performTitanAttack('gravityCrush');
                if (reason === 'boss-body') scene.boss.body = f.actor().body;
                if (reason === 'player') scene.player = f.actor();
                if (reason === 'player-body') scene.player.body = f.actor().body;
                if (reason === 'plugin') scene.scene = {};
                if (reason === 'encounter') scene.guardianEncounter = { active: true };
                if (reason === 'phase') scene.bossPhase = 3;
                if (reason === 'clock') scene.time = {};
                if (reason === 'world') scene.physics.world = {};
                if (reason === 'tweens') scene.tweens = {};
                if (reason === 'events') scene.events = new (require('eventemitter3'))();
                if (reason === 'completion') scene.levelCompletionActive = true;
                if (reason === 'defeat') scene.bossDefeated = true;
                if (reason === 'fight-ended') scene.bossFightActive = false;
                f.advance(700); expect(f.execute).not.toHaveBeenCalled();
            } finally { f.close(); }
        });

    test('native death pause and retry preserve the existing AI cadence without reviving a cancelled warning', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.startTitanAttackLoop(); scene.performTitanAttack('gravityCrush');
            f.advance(200); scene.onPlayerDeath(); f.advance(5000);
            expect(f.execute).not.toHaveBeenCalled(); expect(scene.titanWarningTimer).toBeNull();
            scene.retryFromCheckpoint(); f.advance(2399); expect(f.execute).not.toHaveBeenCalled();
            f.advance(1); expect(scene.titanAttackLocked).toBe(true);
            f.advance(700); expect(f.execute).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('the normal phase pause resumes once after checkpoint retry and the original loop survives the phase', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.startTitanAttackLoop(); const loop = scene.bossAttackTimer;
            scene.enterTitanPhase(3); f.advance(300); scene.onPlayerDeath(); f.advance(5000);
            expect(scene.titanPhaseRecoveryTimer).toBeTruthy(); expect(f.execute).not.toHaveBeenCalled();
            scene.retryFromCheckpoint(); f.advance(999); expect(scene.titanPhaseRecoveryTimer).toBeTruthy();
            f.advance(1); expect(scene.titanPhaseRecoveryTimer).toBeNull(); expect(scene.bossAttackTimer).toBe(loop);
            f.advance(700); expect(f.execute).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('warning cleanup reentry cannot launch the old attack or erase its replacement', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); const release = scene.releaseBossEffect.bind(scene);
            let next;
            jest.spyOn(scene, 'releaseBossEffect').mockImplementationOnce(effect => {
                release(effect); scene.titanAttackLocked = false; scene.performTitanAttack('starRain'); next = scene.titanWarningTimer;
            }).mockImplementation(release);
            f.advance(700); expect(f.execute).not.toHaveBeenCalled(); expect(scene.titanWarningTimer).toBe(next);
        } finally { f.close(); }
    });

    test('phase entry during attack execution cannot install the old attack recovery', () => {
        const f = controlFixture(), { scene } = f;
        try {
            f.execute.mockImplementationOnce(() => scene.enterTitanPhase(3));
            scene.performTitanAttack('gravityCrush'); f.advance(700);
            expect(scene.titanPhaseRecoveryTimer).toBeTruthy(); expect(scene.titanAttackRecoveryTimer).toBeFalsy();
            expect(scene.titanAttackLocked).toBe(true);
        } finally { f.close(); }
    });

    test('effect cleanup retirement cannot grant a stale recovery opening', () => {
        const f = controlFixture(), { scene } = f;
        try {
            scene.performTitanAttack('gravityCrush'); f.advance(700);
            const clear = scene.clearBossEncounterEffects.bind(scene);
            jest.spyOn(scene, 'clearBossEncounterEffects').mockImplementationOnce(() => {
                clear(); scene.guardianEncounter = { active: true };
            }).mockImplementation(clear);
            f.advance(1800); expect(scene.titanAttacksCompleted).toBe(0); expect(scene.titanRecoveryUntil).toBe(0);
        } finally { f.close(); }
    });

    test.each(['boss', 'player', 'shutdown', 'init'])('%s cleanup releases owned timers/listeners but not unrelated native work', reason => {
        const f = controlFixture(), { scene } = f;
        try {
            const work = { x: 0 }; f.tweens.add({ targets: work, x: 100, duration: 10000 });
            const unrelated = f.clock.delayedCall(10000, () => {});
            scene.startTitanAttackLoop(); scene.performTitanAttack('gravityCrush');
            const owners = scene.titanControlTimers;
            if (reason === 'boss') scene.boss.destroy();
            if (reason === 'player') scene.player.destroy();
            if (reason === 'shutdown') scene.events.emit('shutdown');
            if (reason === 'init') scene.init({});
            expect(owners.size).toBe(0); expect(unrelated.callback).toBeInstanceOf(Function);
            expect(f.tweens.getTweensOf(work)).toHaveLength(1);
            f.advance(700); expect(f.execute).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('required timer setup failure releases its native lifecycle listeners and remains an error', () => {
        const f = controlFixture(), { scene } = f;
        try {
            const before = [scene.boss.listenerCount('destroy'), scene.player.listenerCount('destroy'), scene.events.listenerCount('shutdown')];
            jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('fictional timer setup failure'); });
            expect(() => scene.scheduleTitanControlTimer('titanWarningTimer', 700, () => {})).toThrow('fictional timer setup failure');
            expect(scene.titanControlTimers.size).toBe(0);
            expect([scene.boss.listenerCount('destroy'), scene.player.listenerCount('destroy'), scene.events.listenerCount('shutdown')]).toEqual(before);
        } finally { f.close(); }
    });
});
