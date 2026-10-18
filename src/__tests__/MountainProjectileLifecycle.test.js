const { fixture } = require('./support/mountainEncounterFixture.cjs');

function fire(f, kind) {
    const shot = kind === 'wave' ? f.scene.fireMountainGroundWave()
        : f.scene.fireMountainLaser('summit', { x: 5040, y: 386 });
    f.process(); return shot;
}

function touch(f, shot) {
    shot.setPosition(f.scene.player.x, f.scene.player.y);
    shot.body.updateFromGameObject();
    f.contact();
}

describe.each(['wave', 'laser'])('mountain %s retains its original encounter', kind => {
    test('normal radius, speed, damage request and expiry remain', () => {
        const f = fixture();
        try {
            const shot = fire(f, kind), lifetime = kind === 'wave' ? 1850 : 2400;
            expect(shot.body.isCircle).toBe(true);
            expect(shot.body.radius).toBe(kind === 'wave' ? 26 : 8);
            expect(Math.hypot(shot.body.velocity.x, shot.body.velocity.y)).toBeCloseTo(kind === 'wave' ? 180 : 255, 8);
            f.advance(lifetime - 1); expect(shot.active).toBe(true);
            f.advance(1); expect(shot.active).toBe(false); f.onlyPersistent();
        } finally { f.close(); }
    });

    test('a native overlap consumes one hit and captured callbacks cannot spend it again', () => {
        const f = fixture();
        try {
            const shot = fire(f, kind), hit = f.colliders[0].collideCallback;
            touch(f, shot); hit(); hit();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(shot.active).toBe(false); f.onlyPersistent();
        } finally { f.close(); }
    });

    test.each(['boss', 'player', 'player-body', 'phase', 'plugin', 'encounter', 'completion', 'dead'])(
        'contact after %s retirement cannot damage the current actor', change => {
            const f = fixture();
            try {
                const shot = fire(f, kind), player = f.scene.player;
                if (change === 'boss') f.scene.boss = f.actor(4900, 400);
                if (change === 'player') f.scene.player = f.actor();
                if (change === 'player-body') f.scene.player.body = f.actor().body;
                if (change === 'phase') f.scene.bossPhase = 3;
                if (change === 'plugin') f.scene.scene = {};
                if (change === 'encounter') f.scene.guardianEncounter = { active: true };
                if (change === 'completion') f.scene.levelCompletionActive = true;
                if (change === 'dead') f.scene.isPlayerDead = true;
                shot.setPosition(player.x, player.y); shot.body.updateFromGameObject();
                f.contact();
                expect(f.scene.takeDamage).not.toHaveBeenCalled();
                expect(shot.active).toBe(false); f.onlyPersistent();
            } finally { f.close(); }
        }
    );

    test.each(['shot', 'boss', 'player', 'shutdown', 'clear-effects', 'init', 'death-retry'])(
        '%s cleanup removes its collider and stops only its own animation', reason => {
            const f = fixture();
            try {
                const shot = fire(f, kind), unrelated = { value: 0 };
                f.tweens.add({ targets: unrelated, value: 1, duration: 5000 });
                f.advance(1); f.advance(100);
                const angle = shot.angle;
                if (reason === 'shot') shot.destroy();
                if (reason === 'boss') f.scene.boss.destroy();
                if (reason === 'player') f.scene.player.destroy();
                if (reason === 'shutdown') f.scene.events.emit('shutdown');
                if (reason === 'clear-effects') f.scene.clearBossEncounterEffects();
                if (reason === 'init') f.scene.init({});
                if (reason === 'death-retry') { f.scene.onPlayerDeath(); f.scene.retryFromCheckpoint(); }
                expect(shot.active).toBe(false); f.onlyPersistent();
                f.advance(100);
                expect(shot.angle).toBe(angle);
                expect(f.tweens.getTweensOf(unrelated)).toHaveLength(1);
                expect(f.scene.takeDamage).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test.each(['body', 'overlap', 'expiry'])(
        '%s setup failure is visible and cleans already-owned resources', step => {
            const f = fixture();
            try {
                const target = step === 'body' ? f.scene.physics.add : step === 'overlap' ? f.scene.physics.add : f.clock;
                const method = step === 'body' ? 'existing' : step === 'overlap' ? 'overlap' : 'delayedCall';
                jest.spyOn(target, method).mockImplementationOnce(() => { throw Error('synthetic_setup'); });
                expect(() => fire(f, kind)).toThrow('synthetic_setup');
                f.onlyPersistent();
                expect(f.scene.bossEncounterEffects.size).toBe(0);
                expect(f.scene.bossEncounterTimers.size).toBe(0);
                const active = f.objects.filter(value => value.active);
                expect(active).toHaveLength(2);
                expect(active[0]).toBe(f.scene.boss);
                expect(active[1]).toBe(f.scene.player);
            } finally { jest.restoreAllMocks(); f.close(); }
        }
    );
});

describe('queued mountain volleys retain their launch context', () => {
    test.each([
        ['gravityCrush', [0, 190, 380], [8, 8, 8]],
        ['starRain', [0], [26]],
        ['singularity', [0, 260, 1000], [8, 8, 26]]
    ])('%s keeps its existing launch plan', (attack, times, radii) => {
        const f = fixture();
        try {
            f.scene.executeTitanAttack(attack, { x: 5040, y: 386 });
            expect(f.scene.add.circle).not.toHaveBeenCalled();
            let elapsed = 0;
            times.forEach((at, index) => {
                const next = Math.max(1, at) - elapsed;
                if (next > 0) f.advance(next);
                elapsed += next;
                expect(f.scene.add.circle).toHaveBeenCalledTimes(index + 1);
            });
            expect(f.scene.add.circle.mock.calls.map(args => args[2])).toEqual(radii);
        } finally { f.close(); }
    });

    test.each(['boss', 'player', 'phase', 'plugin', 'completion', 'clear-effects', 'shutdown', 'death-retry'])(
        '%s retirement cannot launch the remainder of a volley', change => {
            const f = fixture();
            try {
                f.scene.executeTitanAttack('singularity', { x: 5040, y: 386 });
                f.advance(1);
                expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
                if (change === 'boss') f.scene.boss = f.actor(4900, 400);
                if (change === 'player') f.scene.player = f.actor();
                if (change === 'phase') f.scene.bossPhase = 3;
                if (change === 'plugin') f.scene.scene = {};
                if (change === 'completion') f.scene.levelCompletionActive = true;
                if (change === 'clear-effects') f.scene.clearBossEncounterEffects();
                if (change === 'shutdown') f.scene.events.emit('shutdown');
                if (change === 'death-retry') { f.scene.onPlayerDeath(); f.scene.retryFromCheckpoint(); }
                f.advance(1100);
                expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        }
    );

    test('a consumed or cleared launch cannot replay or erase a later volley', () => {
        const f = fixture();
        try {
            f.scene.executeTitanAttack('gravityCrush', { x: 5040, y: 386 });
            const callbacks = f.timers.map(timer => timer.callback);
            f.advance(1);
            callbacks[0]();
            expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
            f.scene.clearBossEncounterTimers(); f.scene.clearBossEncounterEffects();
            f.scene.executeTitanAttack('starRain', { x: 5040, y: 386 });
            callbacks.forEach(callback => callback());
            f.advance(1);
            expect(f.scene.add.circle.mock.calls.map(args => args[2])).toEqual([8, 26]);
        } finally { f.close(); }
    });
});
