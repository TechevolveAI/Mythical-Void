const { fixture } = require("./support/mountainEncounterFixture.cjs");

describe('mountain snow grenade belongs to its original encounter', () => {
    test('normal flight keeps its arc, locked landing, one-point impact and 650ms burst', () => {
        const f = fixture();
        try {
            const target = { x: 5040, y: 386 }, snow = f.start(target), origin = { x: snow.x, y: snow.y };
            f.advance(1); f.advance(399);
            expect(snow.x).toBeGreaterThan(origin.x); expect(snow.x).toBeLessThan(5040);
            expect(snow.y).toBeLessThan(origin.y + (386 - origin.y) * 0.4);
            expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
            target.x = 5100;
            f.advance(600);
            const burst = f.scene.add.circle.mock.results[1].value;
            expect([burst.x, burst.y, burst.body.isCircle, burst.body.radius]).toEqual([5040, 386, true, 46]);
            expect(snow.active).toBe(false);
            f.contact(); expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            f.advance(649); expect(burst.active).toBe(true);
            f.advance(1); expect(burst.active).toBe(false);
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test.each(['boss', 'player', 'player-body', 'phase', 'plugin', 'encounter', 'completion', 'dead'])(
        'a retired %s cannot receive an old airborne explosion', change => {
            const f = fixture();
            try {
                const snow = f.start(); f.advance(1); f.advance(399);
                if (change === 'boss') f.scene.boss = f.actor(4900, 400);
                if (change === 'player') f.scene.player = f.actor();
                if (change === 'player-body') f.scene.player.body = f.actor().body;
                if (change === 'phase') f.scene.bossPhase = 3;
                if (change === 'plugin') f.scene.scene = {};
                if (change === 'encounter') f.scene.guardianEncounter = { active: true };
                if (change === 'completion') f.scene.levelCompletionActive = true;
                if (change === 'dead') f.scene.isPlayerDead = true;
                f.advance(600); f.contact();
                expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
                expect(snow.active).toBe(false);
                expect(f.scene.takeDamage).not.toHaveBeenCalled();
                f.onlyPersistent();
            } finally { f.close(); }
        }
    );

    test.each(['snow', 'boss', 'player', 'shutdown', 'clear-effects', 'init'])(
        '%s retirement stops a flying grenade before its timer reaches impact', reason => {
            const f = fixture();
            try {
                const snow = f.start(); f.advance(1); f.advance(399);
                const x = snow.x, y = snow.y;
                if (reason === 'snow') snow.destroy();
                if (reason === 'boss') f.scene.boss.destroy();
                if (reason === 'player') f.scene.player.destroy();
                if (reason === 'shutdown') f.scene.events.emit('shutdown');
                if (reason === 'clear-effects') f.scene.clearBossEncounterEffects();
                if (reason === 'init') f.scene.init({});
                f.advance(1000);
                expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
                expect(snow.active).toBe(false);
                expect([snow.x, snow.y]).toEqual([x, y]);
                f.onlyPersistent();
            } finally { f.close(); }
        }
    );

    test('checkpoint retry cannot resume the grenade paused behind the real death handler', () => {
        const f = fixture();
        try {
            const snow = f.start(); f.advance(1); f.advance(399);
            f.scene.onPlayerDeath();
            expect(f.clock.paused).toBe(true); expect(f.world.isPaused).toBe(true);
            expect(f.scene.showDeathScreen).toHaveBeenCalledTimes(1);
            f.scene.retryFromCheckpoint();
            expect(f.clock.paused).toBe(false); expect(f.world.isPaused).toBe(false);
            expect(f.scene.health).toBe(3); expect(f.scene.input.keyboard.enabled).toBe(true);
            f.advance(1000); f.contact();
            expect(snow.active).toBe(false);
            expect(f.scene.add.circle).toHaveBeenCalledTimes(1);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('a captured old timer cannot explode twice or remove a successor grenade', () => {
        const f = fixture();
        try {
            const oldSnow = f.start(), impact = f.timers[0].callback;
            f.advance(1000);
            f.scene.clearBossEncounterEffects(); f.process();
            const next = f.start();
            impact(); impact(); f.process();
            expect(f.scene.add.circle).toHaveBeenCalledTimes(3);
            expect(oldSnow.active).toBe(false); expect(next.active).toBe(true);
            expect(f.scene.bossEncounterEffects.has(next)).toBe(true);
            expect(f.colliders).toHaveLength(1);
            f.advance(1000); f.contact();
            expect(f.scene.add.circle).toHaveBeenCalledTimes(4);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
        } finally { f.close(); }
    });

    test('a burst from a replaced player cannot damage the new actor or retain its collider', () => {
        const f = fixture();
        try {
            f.start(); f.advance(1000);
            const oldPlayer = f.scene.player;
            f.scene.player = f.actor(); oldPlayer.setPosition(5040, 386); oldPlayer.body.updateFromGameObject();
            f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('destroying the burst retires its collider, fade and remaining lifetime immediately', () => {
        const f = fixture();
        try {
            f.start(); f.advance(1000);
            const burst = f.scene.add.circle.mock.results[1].value;
            burst.destroy(); f.onlyPersistent();
            f.advance(1000);
            expect(f.scene.bossEncounterEffects.size).toBe(0);
            expect(f.scene.bossEncounterTimers.size).toBe(0);
            expect(f.scene.mountainSnowGrenades.size).toBe(0);
            expect(f.tweens.getTweens()).toHaveLength(0);
        } finally { f.close(); }
    });

    test('retiring one flying grenade leaves another grenade and unrelated tweens alone', () => {
        const f = fixture();
        try {
            const unrelated = { value: 0 };
            f.tweens.add({ targets: unrelated, value: 1, duration: 5000 });
            const first = f.start(), second = f.start();
            first.destroy();
            expect(second.active).toBe(true);
            expect(f.scene.mountainSnowGrenades.size).toBe(1);
            f.advance(1000); f.contact();
            expect(f.scene.add.circle).toHaveBeenCalledTimes(3);
            expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(f.tweens.getTweensOf(unrelated)).toHaveLength(1);
        } finally { f.close(); }
    });

    test.each(['first-timer', 'impact-body', 'impact-overlap'])(
        '%s setup failure remains an error and leaves no owned hazard behind', failure => {
            const f = fixture();
            try {
                if (failure === 'first-timer') jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('synthetic_setup'); });
                if (failure === 'impact-body') jest.spyOn(f.scene.physics.add, 'existing').mockImplementationOnce(() => { throw Error('synthetic_setup'); });
                if (failure === 'impact-overlap') jest.spyOn(f.scene.physics.add, 'overlap').mockImplementationOnce(() => { throw Error('synthetic_setup'); });
                expect(() => { f.start(); f.advance(1000); }).toThrow('synthetic_setup');
                f.process(); f.onlyPersistent();
                expect(f.scene.bossEncounterEffects.size).toBe(0);
                expect(f.scene.bossEncounterTimers.size).toBe(0);
                expect(f.scene.mountainSnowGrenades.size).toBe(0);
                expect(f.scene.takeDamage).not.toHaveBeenCalled();
                expect(f.objects.filter(value => value.active)).toEqual([f.scene.boss, f.scene.player]);
            } finally { jest.restoreAllMocks(); f.close(); }
        }
    );
});
