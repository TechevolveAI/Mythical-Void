const { fixture } = require('./support/reefEncounterFixture.cjs');

// Actual Reef methods with installed Tween/Clock/actor destruction. Feedback
// services and the parent death method are fictional; no audio or game opens.
function setup() {
    const services = { AudioManager: { playEnemyHit: jest.fn(), playLevelUp: jest.fn() } };
    const f = fixture(services), scene = f.scene;
    scene.bossHealth = scene.bossMaxHealth = 100;
    scene.updateBossHealthBar = jest.fn();
    scene.cameras = { main: { width: 1280, setZoom: jest.fn() } };
    const parent = Object.getPrototypeOf(Object.getPrototypeOf(scene));
    parent.onPlayerDeath = jest.fn(function() { this.isPlayerDead = true; });
    return { ...f, services, parent, flash: () => f.tweens.getTweens().at(-1) };
}

describe('Reef hit feedback owns one flash without controlling damage', () => {
    test('one hundred rapid hits retain one flash rather than one tween per hit', () => {
        const f = setup();
        try {
            f.scene.bossHealth = 1000;
            for (let hit = 0; hit < 100; hit++) f.scene.damageBoss(1);
            f.advance(1);
            expect(f.tweens.getTweens()).toHaveLength(1);
            expect(f.scene.bossHealth).toBe(900);
            expect(f.services.AudioManager.playEnemyHit).toHaveBeenCalledTimes(100);
        } finally { f.close(); }
    });

    test('a second hit during a flash eventually restores the original opacity', () => {
        const f = setup();
        try {
            f.scene.damageBoss(1); f.advance(1); f.advance(40);
            expect(f.scene.boss.alpha).toBeLessThan(1);
            f.scene.damageBoss(1); f.advance(1);
            for (let step = 0; step < 16; step++) f.advance(40);
            expect(f.scene.boss.alpha).toBe(1);
        } finally { f.close(); }
    });

    test('the finishing hit leaves only the victory fade writing opacity', () => {
        const f = setup();
        try {
            f.scene.bossHealth = 1; f.scene.damageBoss(1); f.advance(1);
            expect(f.scene.bossDefeated).toBe(true);
            expect(f.tweens.getTweens()).toHaveLength(1);
            let previous = f.scene.boss.alpha;
            for (let step = 0; step < 20; step++) {
                f.advance(40); expect(f.scene.boss.alpha).toBeLessThanOrEqual(previous);
                previous = f.scene.boss.alpha;
            }
        } finally { f.close(); }
    });

    test.each(['init', 'phase', 'death'])('%s stops the owned flash without resuming it later', boundary => {
        const f = setup();
        try {
            f.scene.damageBoss(1); const flash = f.flash(); f.advance(1); f.advance(40);
            if (boundary === 'phase') f.scene.enterReefBossPhase(2);
            else if (boundary === 'death') f.scene.onPlayerDeath();
            else f.scene.init();
            expect(flash.isPlaying()).toBe(false);
            if (boundary === 'death') expect(f.parent.onPlayerDeath).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('ending a lunge during a live flash does not leave the windup opacity behind', () => {
        const f = setup();
        try {
            f.scene.bossVoidLunge(); f.advance(1); f.advance(200);
            f.scene.damageBoss(1); f.advance(1); f.advance(40);
            f.scene.clearReefBossLunge();
            for (let step = 0; step < 16; step++) f.advance(40);
            expect(f.scene.boss.alpha).toBe(1);
        } finally { f.close(); }
    });

    test.each(['health-bar', 'floating-text'])('optional %s failure cannot interrupt a finishing blow', boundary => {
        const f = setup();
        try {
            const fail = () => { throw Error('SYNTHETIC_FEEDBACK_FAILURE'); };
            if (boundary === 'health-bar') f.scene.updateBossHealthBar.mockImplementation(fail);
            else f.scene.showFloatingText.mockImplementation(fail);
            f.scene.bossHealth = 1;
            expect(() => f.scene.damageBoss(1)).not.toThrow();
            expect(f.scene.bossHealth).toBe(0); expect(f.scene.bossDefeated).toBe(true);
            f.advance(2600); expect(f.scene.showVictoryScreen).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a normal hit retains damage, feedback copy and the 80ms four-pulse flash', () => {
        const f = setup();
        try {
            expect(f.scene.damageBoss(2)).toBe(true); expect(f.scene.bossHealth).toBe(98);
            expect(f.scene.showFloatingText).toHaveBeenCalledWith('ROUTE FRACTURE -2', 500, 115, '#F0B6FF');
            expect(f.configs.at(-1)).toMatchObject({ alpha: 0.3, duration: 80, yoyo: true, repeat: 3 });
            f.advance(1); f.advance(80); expect(f.scene.boss.alpha).toBeCloseTo(0.3);
            for (let step = 0; step < 7; step++) f.advance(80);
            expect(f.scene.boss.alpha).toBe(1); expect(f.scene.bossFightActive).toBe(true);
            expect(f.services.AudioManager.playEnemyHit).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('the existing exposed-current bonus remains one extra damage', () => {
        const f = setup();
        try {
            f.scene.getReefGuardianControl().holdWindow('recovery', 1000);
            expect(f.scene.damageBoss(2)).toBe(true); expect(f.scene.bossHealth).toBe(97);
            expect(f.scene.showFloatingText).toHaveBeenCalledWith('EXPOSED CURRENT -3', 500, 115, '#F0B6FF');
        } finally { f.close(); }
    });

    test('inactive and already-defeated encounters retain their no-damage guard', () => {
        const f = setup();
        try {
            f.scene.bossFightActive = false; expect(f.scene.damageBoss(2)).toBe(false);
            f.scene.bossFightActive = true; f.scene.bossDefeated = true;
            expect(f.scene.damageBoss(2)).toBe(false); expect(f.scene.bossHealth).toBe(100);
            expect(f.services.AudioManager.playEnemyHit).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('captured old flash callbacks cannot clear or repaint the latest flash', () => {
        const f = setup();
        try {
            f.scene.damageBoss(1); const old = f.configs.at(-1);
            f.advance(1); f.advance(40); f.scene.damageBoss(1);
            const current = f.scene.reefGuardianControl.hitFlash, alpha = f.scene.boss.alpha;
            old.onUpdate(); old.onComplete();
            expect(f.scene.reefGuardianControl.hitFlash).toBe(current);
            expect(f.scene.boss.alpha).toBe(alpha);
            f.advance(1); f.advance(80); expect(f.scene.boss.alpha).toBeCloseTo(0.3);
        } finally { f.close(); }
    });

    test('native windup and flash compose without either brightening the other', () => {
        const f = setup();
        try {
            f.scene.bossVoidLunge(); f.scene.damageBoss(1); f.advance(1);
            const lunge = f.scene.reefBossLunge, control = f.scene.reefGuardianControl;
            for (let frame = 0; frame < 12; frame++) {
                f.advance(40);
                const expected = control.hitFlash ? Math.min(lunge.windupAlpha, control.hitFlash.alpha) : lunge.windupAlpha;
                expect(f.scene.boss.alpha).toBeCloseTo(expected);
                expect(f.scene.boss.alpha).toBeLessThanOrEqual(lunge.windupAlpha);
            }
            f.scene.clearReefBossLunge();
            for (let frame = 0; frame < 5; frame++) f.advance(40);
            expect(f.scene.boss.alpha).toBe(1);
        } finally { f.close(); }
    });

    test('starting a windup during a flash preserves its resting opacity', () => {
        const f = setup();
        try {
            f.scene.damageBoss(1); f.advance(1); f.advance(40);
            f.scene.bossVoidLunge();
            expect(f.scene.reefBossLunge.alpha).toBe(1);
            f.advance(1); f.advance(120); f.scene.clearReefBossLunge();
            for (let frame = 0; frame < 14; frame++) f.advance(40);
            expect(f.scene.boss.alpha).toBe(1);
        } finally { f.close(); }
    });

    test.each(['boss', 'bossBody', 'player', 'guardianEncounter'])(
        'a replaced %s retires the flash and original lifetime listeners', field => {
            const f = setup();
            try {
                f.scene.damageBoss(1); const control = f.scene.reefGuardianControl, flash = f.flash();
                f.advance(1); f.advance(40);
                f.scene[field] = field === 'guardianEncounter' ? { id: 'synthetic-replacement' } : f.actor();
                const replacement = f.scene[field]; f.advance(40);
                expect(control.retired).toBe(true); expect(flash.isPlaying()).toBe(false);
                expect(control.hitFlash).toBeNull(); expect(f.scene[field]).toBe(replacement);
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                control.actors().forEach(actor => expect(actor.listenerCount('destroy')).toBe(0));
            } finally { f.close(); }
        }
    );

    test.each(['boss', 'player'])('native %s destruction releases the flash', field => {
        const f = setup();
        try {
            f.scene.damageBoss(1); const control = f.scene.reefGuardianControl, flash = f.flash();
            f.advance(1); f.advance(40); f.scene[field].destroy();
            expect(control.retired).toBe(true); expect(flash.isPlaying()).toBe(false);
            expect(control.hitFlash).toBeNull();
        } finally { f.close(); }
    });

    test('unrelated opacity is not overwritten by flash cleanup', () => {
        const f = setup();
        try {
            f.scene.damageBoss(1); f.advance(1); f.advance(40);
            f.scene.boss.alpha = 0.24; f.scene.reefGuardianControl.clearHitFlash();
            expect(f.scene.boss.alpha).toBe(0.24);
            f.scene.damageBoss(1); f.advance(1); f.advance(80);
            expect(f.scene.boss.alpha).toBeLessThanOrEqual(0.24);
            for (let frame = 0; frame < 7; frame++) f.advance(80);
            expect(f.scene.boss.alpha).toBe(0.24);
        } finally { f.close(); }
    });

    test('flash retirement preserves an unrelated player tween', () => {
        const f = setup();
        try {
            const complete = jest.fn();
            f.tweens.add({ targets: f.scene.player, alpha: 0.4, duration: 1000, onComplete: complete });
            f.scene.damageBoss(1); f.advance(1); f.scene.reefGuardianControl.clearHitFlash(); f.advance(1000);
            expect(complete).toHaveBeenCalledTimes(1); expect(f.scene.player.alpha).toBeCloseTo(0.4);
        } finally { f.close(); }
    });

    test.each(['audio', 'tween'])('optional %s setup failure cannot prevent defeat', boundary => {
        const f = setup();
        try {
            const fail = () => { throw Error('SYNTHETIC_FEEDBACK_FAILURE'); };
            if (boundary === 'audio') f.services.AudioManager.playEnemyHit.mockImplementation(fail);
            else jest.spyOn(f.tweens, 'add').mockImplementationOnce(fail);
            f.scene.bossHealth = 1;
            expect(() => f.scene.damageBoss(1)).not.toThrow(); expect(f.scene.bossDefeated).toBe(true);
            f.advance(2600); expect(f.scene.showVictoryScreen).toHaveBeenCalledTimes(1);
        } finally { f.close(); jest.restoreAllMocks(); }
    });

    test('optional rejected sound promise is contained', async () => {
        const f = setup();
        try {
            f.services.AudioManager.playEnemyHit.mockRejectedValue(Error('SYNTHETIC_SOUND_FAILURE'));
            f.scene.bossHealth = 1; expect(f.scene.damageBoss(1)).toBe(true);
            await Promise.resolve(); await Promise.resolve(); f.advance(2600);
            expect(f.scene.showVictoryScreen).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('feedback reentry cannot finish a successor or report that it accepted the old hit', () => {
        const f = setup();
        try {
            f.scene.bossHealth = 1;
            f.scene.updateBossHealthBar.mockImplementation(() => {
                f.scene.boss = f.scene.add.graphics(); f.scene.bossBody = f.actor();
                f.scene.bossHealth = 50; f.scene.guardianEncounter = { id: 'synthetic-next' };
            });
            expect(f.scene.damageBoss(1)).toBe(false); expect(f.scene.bossHealth).toBe(50);
            expect(f.scene.bossDefeated).toBe(false);
            expect(f.scene.showFloatingText).not.toHaveBeenCalled();
            expect(f.services.AudioManager.playEnemyHit).not.toHaveBeenCalled();
            expect(f.scene.showVictoryScreen).not.toHaveBeenCalled();
            expect(f.scene.reefGuardianControl).toBeNull();
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        } finally { f.close(); }
    });

    test('required defeat errors remain errors rather than successful feedback', () => {
        const f = setup();
        try {
            f.scene.bossHealth = 1;
            f.scene.defeatBoss = jest.fn(() => { throw Error('SYNTHETIC_REQUIRED_FAILURE'); });
            expect(() => f.scene.damageBoss(1)).toThrow('SYNTHETIC_REQUIRED_FAILURE');
            expect(f.scene.defeatBoss).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });
});
