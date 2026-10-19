const { fixture } = require('./support/reefEncounterFixture.cjs');

function start(f) {
    f.scene.bossVoidLunge();
    return f.configs.find(config => config.yoyo)?.onComplete;
}

describe('Reef lunge retains its original actors and attack stage', () => {
    test('old windup cannot launch a replacement Guardian body', () => {
        const f = fixture();
        try {
            const launch = start(f), count = f.configs.length;
            f.scene.bossBody = f.actor(900, 300); launch();
            expect(f.configs).toHaveLength(count);
            expect(f.scene.bossContactDamageArmed).toBe(false);
        } finally { f.close(); }
    });

    test('actual defeat prevents the old outbound callback creating a return tween', () => {
        const f = fixture();
        try {
            start(f)(); const returnHome = f.configs.at(-1).onComplete;
            f.scene.defeatBoss(); const count = f.configs.length;
            returnHome(); expect(f.configs).toHaveLength(count);
        } finally { f.close(); }
    });

    test('old windup cannot restart after actual init and a new encounter', () => {
        const f = fixture();
        try {
            const launch = start(f), count = f.configs.length;
            f.scene.init(); f.scene.boss = f.actor(800, 200); f.scene.bossBody = f.actor(800, 200);
            f.scene.bossFightActive = true; launch();
            expect(f.configs).toHaveLength(count);
            expect(f.scene.bossContactDamageArmed).toBe(false);
        } finally { f.close(); }
    });

    test('destroyed Guardian art cannot leave an invisible lunge', () => {
        const f = fixture();
        try {
            const launch = start(f), count = f.configs.length;
            f.scene.boss.destroy(); launch();
            expect(f.configs).toHaveLength(count);
            expect(f.scene.bossContactDamageArmed).toBe(false);
        } finally { f.close(); }
    });

    test('an old return cannot disarm a newer lunge or open its recovery window', () => {
        const f = fixture();
        try {
            start(f)(); f.configs.at(-1).onComplete(); const oldFinish = f.configs.at(-1).onComplete;
            f.scene.bossVoidLunge(); f.configs.findLast(config => config.yoyo).onComplete();
            expect(f.scene.bossContactDamageArmed).toBe(true);
            oldFinish();
            expect(f.scene.bossContactDamageArmed).toBe(true);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a captured windup cannot launch the same attack twice', () => {
        const f = fixture();
        try {
            const launch = start(f); launch(); const count = f.configs.length; launch();
            expect(f.configs).toHaveLength(count);
        } finally { f.close(); }
    });

    test('normal attack retains its telegraphed center, movement parameters and recovery', () => {
        const f = fixture();
        try {
            const launch = start(f), body = f.scene.bossBody;
            expect(f.configs[1]).toMatchObject({ targets: f.scene.reefBossLunge, windupAlpha: 0.5, duration: 650, yoyo: true });
            launch(); expect(f.scene.bossContactDamageArmed).toBe(true);
            expect(f.configs[2]).toMatchObject({ targets: body, x: 200, y: 200, duration: 360, ease: 'Power3' });
            f.configs[2].onComplete();
            expect(f.configs[3]).toMatchObject({ targets: body, x: 5700, y: 700, duration: 850, ease: 'Sine.easeInOut' });
            f.configs[3].onComplete();
            expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledWith(750);
        } finally { f.close(); }
    });

    test('installed TweenManager actually changes the original windup alpha', () => {
        const f = fixture();
        try {
            start(f); f.advance(1); f.advance(325);
            expect(f.scene.boss.alpha).toBeLessThan(1);
            expect(f.scene.boss.alpha).toBeGreaterThan(0.5);
        } finally { f.close(); }
    });

    test('native tween progression reaches the target and home without manually dispatching callbacks', () => {
        const f = fixture();
        try {
            start(f);
            let reachedTarget = false;
            for (let frame = 0; frame < 400 && !f.scene.openReefBossRecovery.mock.calls.length; frame++) {
                f.advance(10);
                if (f.scene.bossBody.x === 200 && f.scene.bossBody.y === 200) reachedTarget = true;
            }
            expect(reachedTarget).toBe(true);
            expect([f.scene.bossBody.x, f.scene.bossBody.y]).toEqual([5700, 700]);
            expect(f.scene.boss.alpha).toBe(1);
            expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            expect(f.scene.reefBossLunge).toBeNull();
        } finally { f.close(); }
    });

    test.each(['body', 'player', 'encounter', 'phase', 'dead', 'completion', 'inactive', 'body-disabled', 'player-disabled'])('%s change rejects all three old stage continuations', change => {
        for (const stage of [0, 1, 2]) {
            const f = fixture();
            try {
                const launch = start(f);
                if (stage >= 1) launch();
                if (stage === 2) f.configs.at(-1).onComplete();
                const callback = f.configs.at(-1).onComplete;
                if (change === 'body') f.scene.bossBody = f.actor(950, 250);
                if (change === 'player') f.scene.player = f.actor();
                if (change === 'encounter') f.scene.guardianEncounter = { id: 'synthetic-next-fight' };
                if (change === 'phase') f.scene.enterReefBossPhase(2);
                if (change === 'dead') f.scene.isPlayerDead = true;
                if (change === 'completion') f.scene.levelCompletionActive = true;
                if (change === 'inactive') f.scene.sys.isActive = () => false;
                if (change === 'body-disabled') f.scene.bossBody.body.enable = false;
                if (change === 'player-disabled') f.scene.player.body.enable = false;
                const count = f.configs.length; callback();
                expect(f.configs).toHaveLength(count);
                expect(f.scene.bossContactDamageArmed).toBe(false);
                expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
                expect(f.scene.reefBossLunge).toBeNull();
            } finally { f.close(); }
        }
    });

    test.each(['boss', 'bossBody', 'player'])('native %s destruction releases owned animation once', name => {
        const f = fixture();
        try {
            const launch = start(f), actor = f.scene[name], destroy = jest.spyOn(actor, 'destroy');
            actor.destroy(); launch(); f.advance(3000);
            expect(destroy).toHaveBeenCalledTimes(1);
            expect(f.scene.reefBossLunge).toBeNull();
            expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('actual shutdown prevents every captured stage callback after a restart', () => {
        const f = fixture();
        try {
            const launch = start(f); launch(); const returnHome = f.configs.at(-1).onComplete;
            returnHome(); const finish = f.configs.at(-1).onComplete;
            f.scene.shutdown(); f.scene.init();
            f.scene.boss = f.actor(800, 250); f.scene.bossBody = f.actor(800, 250); f.scene.bossFightActive = true;
            const count = f.configs.length; launch(); returnHome(); finish();
            expect(f.configs).toHaveLength(count); expect(f.scene.bossBody.x).toBe(800);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('retiring a native outbound tween cannot move the successor body', () => {
        const f = fixture();
        try {
            start(f)(); f.advance(1); f.advance(100);
            const successor = f.actor(900, 300); f.scene.bossBody = successor;
            f.advance(100); f.advance(3000);
            expect([successor.x, successor.y]).toEqual([900, 300]);
            expect(f.scene.reefBossLunge).toBeNull();
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('moving the player during windup does not retarget the telegraphed strike', () => {
        const f = fixture();
        try {
            const launch = start(f);
            f.scene.player.setPosition(800, 300); f.scene.player.body.reset(800, 300); launch();
            expect(f.configs.at(-1)).toMatchObject({ x: 200, y: 200 });
            expect(f.graphics[0].lineBetween).toHaveBeenCalledWith(0, 0, -300, 0);
        } finally { f.close(); }
    });

    test('an offset native body is aimed at its actual center rather than the sprite origin', () => {
        const f = fixture();
        try {
            f.scene.player.body.setOffset(11, 23); f.scene.player.body.updateFromGameObject();
            expect([f.scene.player.body.center.x, f.scene.player.body.center.y]).toEqual([211, 223]);
            start(f)();
            expect(f.configs.at(-1)).toMatchObject({ x: 211, y: 223 });
            expect(f.graphics[0].lineBetween).toHaveBeenCalledWith(0, 0, -289, 23);
        } finally { f.close(); }
    });

    test('old completions cannot repeat the return or recovery', () => {
        const f = fixture();
        try {
            start(f)(); const returnHome = f.configs.at(-1).onComplete;
            returnHome(); const count = f.configs.length; returnHome();
            expect(f.configs).toHaveLength(count);
            const finish = f.configs.at(-1).onComplete; finish(); finish();
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('cancelled windup restores only its own alpha and leaves an unrelated tween alive', () => {
        const f = fixture();
        try {
            const completed = jest.fn();
            f.tweens.add({ targets: f.scene.player, alpha: 0.4, duration: 4000, onComplete: completed });
            start(f); f.advance(1); f.advance(200);
            expect(f.scene.boss.alpha).toBeLessThan(1);
            f.scene.clearReefBossLunge(); expect(f.scene.boss.alpha).toBe(1);
            f.advance(4000); expect(completed).toHaveBeenCalledTimes(1); f.onlyPersistent();
        } finally { f.close(); }
    });

    test('cancelled windup does not overwrite an intervening hit-flash alpha', () => {
        const f = fixture();
        try {
            start(f); f.advance(1); f.advance(200); f.scene.boss.alpha = 0.24;
            f.scene.clearReefBossLunge(); expect(f.scene.boss.alpha).toBe(0.24);
        } finally { f.close(); }
    });

    test('defeat keeps its own fade instead of being repainted by the old windup', () => {
        const f = fixture();
        try {
            start(f); f.advance(1); f.advance(200); const alpha = f.scene.boss.alpha;
            f.scene.defeatBoss(); f.advance(1); f.advance(500);
            expect(f.scene.boss.alpha).toBeLessThan(alpha);
            expect(f.scene.reefBossLunge).toBeNull();
        } finally { f.close(); }
    });

    test('repeated native lunges leave no owned art or destruction listeners', () => {
        const f = fixture();
        try {
            for (let count = 0; count < 20; count++) {
                const previous = f.scene.openReefBossRecovery.mock.calls.length; start(f);
                for (let frame = 0; frame < 400 && f.scene.openReefBossRecovery.mock.calls.length === previous; frame++) f.advance(10);
                expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(previous + 1);
                expect(f.scene.reefBossLunge).toBeNull();
                expect(f.graphics.every(graphic => !graphic.active)).toBe(true);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                for (const actor of [f.scene.boss, f.scene.bossBody, f.scene.player]) expect(actor.listenerCount('destroy')).toBe(0);
            }
        } finally { f.close(); }
    });

    test.each(['graphics', 'telegraph-tween', 'windup', 'outbound', 'return'])('partial %s failure disarms the lunge without hiding the required error', boundary => {
        const f = fixture();
        try {
            const error = Error('synthetic required lunge setup failure'), fail = () => { throw error; };
            if (boundary === 'outbound' || boundary === 'return') {
                const launch = start(f); if (boundary === 'return') launch();
                const callback = boundary === 'outbound' ? launch : f.configs.at(-1).onComplete;
                f.scene.tweens.add = fail; expect(() => callback()).toThrow(error);
            } else {
                if (boundary === 'graphics') f.scene.add.graphics = fail;
                else {
                    const add = f.scene.tweens.add; let count = 0;
                    f.scene.tweens.add = config => {
                        if (++count === (boundary === 'windup' ? 2 : 1)) throw error;
                        return add(config);
                    };
                }
                expect(() => start(f)).toThrow(error);
            }
            expect(f.scene.reefBossLunge).toBeNull();
            expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.graphics.every(graphic => !graphic.active)).toBe(true);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });
});
