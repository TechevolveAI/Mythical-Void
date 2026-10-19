const { fixture } = require('./support/reefEncounterFixture.cjs');

describe('Reef rifts remain owned by the encounter that created them', () => {
    beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0.5));
    afterEach(() => jest.restoreAllMocks());

    test('an active native rift cannot damage the player after actual Guardian defeat', () => {
        const f = fixture();
        try {
            f.start(); f.advance(700); f.scene.defeatBoss(); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('an old warning cannot activate against a replacement Guardian', () => {
        const f = fixture();
        try {
            f.start(); f.scene.boss = f.actor(550, 200); f.advance(700); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('an externally removed tear cannot leave an invisible damaging zone', () => {
        const f = fixture();
        try {
            f.start(); f.graphics[0].destroy(); f.advance(700); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('actual Reef shutdown retires a pending warning before native scene teardown', () => {
        const f = fixture();
        try {
            f.start(); const activate = f.timers[0].callback;
            f.scene.shutdown(); activate(); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('actual Reef init retires the old attack before resetting boss flags', () => {
        const f = fixture();
        try {
            f.start(); const activate = f.timers[0].callback;
            f.scene.init(); f.scene.bossFightActive = true; f.scene.boss = f.actor(550, 200);
            activate(); f.contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('a captured warning cannot schedule its expansion and expiry twice', () => {
        const f = fixture();
        try {
            f.start(); const activate = f.timers[0].callback;
            activate(); activate();
            expect(f.timers.filter(timer => timer.delay === 950)).toHaveLength(1);
        } finally { f.close(); }
    });

    test('normal rift keeps its700ms warning,150-square hazard, one-point contact and950ms recovery', () => {
        const f = fixture();
        try {
            const zone = f.start();
            expect(zone.body.width).toBe(150); expect(zone.body.height).toBe(150);
            expect(zone.body.enable).toBe(false);
            f.advance(699); f.contact(); expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.advance(1); f.contact(); expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(zone.body.enable).toBe(true);
            f.advance(949); expect(zone.active).toBe(true);
            f.advance(1); expect(zone.active).toBe(false);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledWith(700);
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('normal repeated rifts release native overlaps rather than accumulating them', () => {
        const f = fixture();
        try {
            for (let count = 0; count < 30; count++) {
                f.start(); f.advance(700); f.advance(950); f.onlyPersistent();
                expect(f.world.staticBodies.size).toBe(0);
                expect(f.scene.reefBossTears.size).toBe(0);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                for (const actor of [f.scene.boss, f.scene.bossBody, f.scene.player]) {
                    expect(actor.listenerCount('destroy')).toBe(0);
                }
            }
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(30);
        } finally { f.close(); }
    });

    test.each(['boss-body', 'player', 'encounter', 'phase', 'dead', 'boss-disabled', 'player-disabled', 'inactive'])('%s change retires warning and active contact without a recovery reward', change => {
        for (const active of [false, true]) {
            const f = fixture();
            try {
                f.start(); if (active) f.advance(700);
                const callback = f.colliders[0].collideCallback;
                if (change === 'boss-body') f.scene.bossBody = f.actor(550, 200);
                if (change === 'player') f.scene.player = f.actor();
                if (change === 'encounter') f.scene.guardianEncounter = { id: 'synthetic-successor' };
                if (change === 'phase') f.scene.bossPhase = 2;
                if (change === 'dead') f.scene.isPlayerDead = true;
                if (change === 'boss-disabled') f.scene.bossBody.body.enable = false;
                if (change === 'player-disabled') f.scene.player.body.enable = false;
                if (change === 'inactive') f.scene.sys.isActive = () => false;
                callback(); f.advance(1650); f.contact();
                expect(f.scene.takeDamage).not.toHaveBeenCalled();
                expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
                f.onlyPersistent();
            } finally { f.close(); }
        }
    });

    test.each(['boss', 'bossBody', 'player'])('native %s destruction immediately retires the rift without recursive destruction', name => {
        const f = fixture();
        try {
            const zone = f.start(); const actor = f.scene[name]; const destroy = jest.spyOn(actor, 'destroy');
            actor.destroy();
            expect(destroy).toHaveBeenCalledTimes(1); expect(zone.active).toBe(false);
            f.onlyPersistent(); f.advance(1650);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('actual phase entry clears the previous rift before phase feedback', () => {
        const f = fixture();
        try {
            const zone = f.start(); f.advance(700);
            const callback = f.colliders[0].collideCallback;
            f.scene.enterReefBossPhase(2); callback();
            expect(zone.active).toBe(false); expect(f.scene.bossPhase).toBe(2);
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test.each(['tear', 'zone'])('external %s destruction retires only its own rift', name => {
        const f = fixture();
        try {
            const first = f.start(); const tear = f.graphics[0]; const oldContact = f.colliders[0].collideCallback;
            const warning = f.timers[0].callback; const second = f.start();
            const removed = name === 'tear' ? tear : first;
            const destroy = jest.spyOn(removed, 'destroy'); removed.destroy();
            expect(destroy).toHaveBeenCalledTimes(1);
            warning(); oldContact(); f.advance(700);
            expect(first.active).toBe(false); expect(second.body.enable).toBe(true);
            expect(f.scene.reefBossTears.size).toBe(1);
            f.contact(); expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            f.advance(950); f.onlyPersistent();
        } finally { f.close(); }
    });

    test('a captured expired contact cannot damage or open recovery again', () => {
        const f = fixture();
        try {
            f.start(); const activate = f.timers[0].callback, contact = f.colliders[0].collideCallback;
            f.advance(700); const expire = f.timers[1].callback; f.advance(950);
            activate(); expire(); expire(); contact();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('valid ongoing contacts retain the existing repeated damage-request rule', () => {
        const f = fixture();
        try {
            f.start(); f.advance(700); f.contact(); f.contact();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(2);
            expect(f.scene.takeDamage.mock.calls).toEqual([[1], [1]]);
        } finally { f.close(); }
    });

    test('normal random placement, drawing and expansion parameters remain unchanged', () => {
        const f = fixture();
        try {
            Math.random.mockReset().mockReturnValueOnce(0.2).mockReturnValueOnce(0.8);
            const zone = f.start();
            expect(Math.random).toHaveBeenCalledTimes(2);
            expect([zone.x, zone.y]).toEqual([170, 230]);
            const [tear, warning] = f.graphics;
            expect(tear.fillStyle).toHaveBeenCalledWith(0x9B30FF, 0.8);
            expect(tear.fillCircle).toHaveBeenCalledWith(170, 230, 10);
            expect(warning.strokeCircle).toHaveBeenCalledWith(0, 0, 75);
            expect(f.configs[0]).toMatchObject({ duration: 700, scale: 1.08, alpha: 0.35, ease: 'Sine.easeIn' });
            expect(f.configs[1]).toMatchObject({ targets: tear, duration: 700, alpha: 0.9 });
            f.advance(700);
            expect(f.configs[2]).toMatchObject({ targets: tear, duration: 950, scaleX: 15, scaleY: 15, alpha: 0 });
        } finally { f.close(); }
    });

    test('cleanup retirement during expiry cannot expose a different encounter', () => {
        const f = fixture();
        try {
            f.start(); f.advance(700);
            f.graphics[0].once('destroy', () => { f.scene.guardianEncounter = { id: 'synthetic-new-encounter' }; });
            f.advance(950);
            expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('rift retirement preserves an unrelated player tween and existing collider', () => {
        const f = fixture();
        try {
            const completed = jest.fn();
            f.tweens.add({ targets: f.scene.player, alpha: 0.4, duration: 4000, onComplete: completed });
            f.start(); f.advance(16); f.scene.clearReefBossTears(); f.advance(4000);
            expect(completed).toHaveBeenCalledTimes(1); f.onlyPersistent();
        } finally { f.close(); }
    });

    test.each(['graphics', 'warning', 'zone', 'body', 'overlap', 'warning-timer', 'expansion', 'expiry'])('partial %s failure retires owned work while preserving the required error', boundary => {
        const f = fixture();
        try {
            const error = Error('synthetic required rift setup failure');
            const fail = () => { throw error; };
            if (boundary === 'graphics') f.scene.add.graphics = fail;
            if (boundary === 'warning') f.scene.createReefBossTelegraph = fail;
            if (boundary === 'zone') f.scene.add.zone = fail;
            if (boundary === 'body') {
                const existing = f.scene.physics.add.existing;
                f.scene.physics.add.existing = (...args) => { existing(...args); throw error; };
            }
            if (boundary === 'overlap') f.scene.physics.add.overlap = fail;
            if (boundary === 'warning-timer') f.scene.time.delayedCall = fail;
            if (boundary === 'expansion' || boundary === 'expiry') {
                f.start();
                if (boundary === 'expansion') f.scene.tweens.add = fail;
                else f.scene.time.delayedCall = fail;
                expect(() => f.advance(700)).toThrow(error);
            } else expect(() => f.start()).toThrow(error);
            expect(f.scene.reefBossTears.size).toBe(0);
            expect(f.zones.every(zone => !zone.active)).toBe(true);
            expect(f.graphics.every(graphic => !graphic.active)).toBe(true);
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            f.onlyPersistent();
        } finally { f.close(); }
    });

    test('a required damage exception retires the hazard and remains an error', () => {
        const f = fixture();
        try {
            f.start(); f.advance(700); const contact = f.colliders[0].collideCallback;
            const error = Error('synthetic required damage failure'); f.scene.takeDamage.mockImplementationOnce(() => { throw error; });
            expect(() => contact()).toThrow(error);
            expect(() => contact()).not.toThrow();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1); f.onlyPersistent();
        } finally { f.close(); }
    });
});
