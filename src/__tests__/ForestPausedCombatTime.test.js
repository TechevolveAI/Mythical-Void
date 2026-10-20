const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { fixture } = require('./support/forestCombatFixture.cjs');
const pauseSource = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
const pauseClass = parse(pauseSource, { sourceType: 'module' }).program.body
    .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
const PauseSession = new Function(`return (${pauseSource.slice(pauseClass.start, pauseClass.end)});`)();

function menu(f, duration) {
    f.scene.pauseMenuActive = true;
    const pause = PauseSession.open(f.scene);
    expect(pause).not.toBeNull();
    f.run(duration);
    f.scene.pauseMenuActive = false;
    expect(pause.release()).toBe(true);
}

describe('Forest authored combat uses active time through a real menu pause', () => {
    test.each([['root_slam', 900, 5], ['vine_whip', 900, 1], ['spore_cloud', 1000, 1], ['nature_fury', 1200, 3]])(
        '%s keeps its actual hazard lifetime and frozen visual state through a long menu', (attack, windup, count) => {
            const f = fixture();
            try {
                f.scene.executeBossAttack(attack);
                f.run(windup + 50);
                expect(f.scene.bossHazards.size).toBe(count);
                const hazards = [...f.scene.bossHazards];
                const visuals = hazards.map(({ graphic }) => [graphic.x, graphic.y, graphic.alpha]);
                const control = f.clock.addEvent({ delay: hazards[0].expiresAt - f.clock.now });
                const remaining = control.getRemaining();
                menu(f, 5000);
                expect(control.getRemaining()).toBe(remaining);
                f.scene.updateForestBossHazards();
                expect(f.scene.bossHazards.size).toBe(count);
                expect(hazards.map(({ graphic }) => [graphic.x, graphic.y, graphic.alpha])).toEqual(visuals);
                expect(hazards.every(hazard => hazard.graphic.active)).toBe(true);
                f.run(remaining - 1); f.scene.updateForestBossHazards();
                expect(f.scene.bossHazards.size).toBe(count);
                f.run(1); f.scene.updateForestBossHazards();
                expect(f.scene.bossHazards.size).toBe(0);
                expect(hazards.every(hazard => !hazard.graphic.active && hazard.lifetime.retired)).toBe(true);
            } finally { f.close(); }
        }
    );

    test('a menu cannot spend the 400ms between accepted boss hits', () => {
        const f = fixture();
        try {
            f.scene.boss.isRecovering = true;
            expect(f.scene.damageBoss(1)).toBe(true);
            f.run(100); menu(f, 5000);
            expect(f.scene.damageBoss(1)).toBe(false);
            expect(f.scene.bossHealth).toBe(16);
            f.run(299); expect(f.scene.damageBoss(1)).toBe(false);
            f.run(1); expect(f.scene.damageBoss(1)).toBe(true);
            expect(f.scene.bossHealth).toBe(14);
        } finally { f.close(); }
    });

    test('a spore cloud retains its one-second damage spacing through menus', () => {
        const f = fixture();
        try {
            f.scene.executeBossAttack('spore_cloud'); f.run(1000);
            f.scene.updateForestBossHazards();
            expect(f.scene.handlePlayerDamage).toHaveBeenCalledTimes(1);
            menu(f, 5000);
            f.scene.updateForestBossHazards();
            expect(f.scene.bossHazards.size).toBe(1);
            expect(f.scene.handlePlayerDamage).toHaveBeenCalledTimes(1);
            f.run(999); f.scene.updateForestBossHazards();
            expect(f.scene.handlePlayerDamage).toHaveBeenCalledTimes(1);
            f.run(1); f.scene.updateForestBossHazards();
            expect(f.scene.handlePlayerDamage).toHaveBeenCalledTimes(2);
        } finally { f.close(); }
    });

    test('direct damage cannot consume a boss opening behind a menu', () => {
        const f = fixture();
        try {
            f.scene.boss.isRecovering = true;
            f.scene.pauseMenuActive = true;
            PauseSession.open(f.scene);
            expect(f.scene.damageBoss(1)).toBe(false);
            expect(f.scene.bossHealth).toBe(18);
            expect(f.scene.forestRecoveryDamage).toBe(0);
        } finally { f.close(); }
    });

    test('control: ordinary boss-hit spacing still expires at exactly 400ms', () => {
        const f = fixture();
        try {
            f.scene.boss.isRecovering = true;
            expect(f.scene.damageBoss(1)).toBe(true);
            f.run(399); expect(f.scene.damageBoss(1)).toBe(false);
            f.run(1); expect(f.scene.damageBoss(1)).toBe(true);
            expect(f.scene.bossHealth).toBe(14);
        } finally { f.close(); }
    });

    test.each([0.5, 1, 2])('short and repeated menus preserve hit spacing at clock rate %s', rate => {
        const f = fixture();
        try {
            f.clock.timeScale = rate;
            f.scene.boss.isRecovering = true;
            expect(f.scene.damageBoss(1)).toBe(true);
            f.run(100 / rate);
            for (const duration of [200, 5000]) {
                const remaining = f.scene.forestBossHitCooldown.remaining();
                menu(f, duration);
                expect(f.scene.forestBossHitCooldown.remaining()).toBe(remaining);
                expect(f.scene.damageBoss(1)).toBe(false);
            }
            f.run(299 / rate); expect(f.scene.damageBoss(1)).toBe(false);
            f.run(1 / rate); expect(f.scene.damageBoss(1)).toBe(true);
        } finally { f.close(); }
    });

    test.each(['dead', 'player-inactive', 'boss-disabled', 'player-disabled', 'physics-paused',
        'clock-paused', 'systems-inactive', 'returning', 'completion'])(
        '%s cannot spend a boss opening or a hazard hit', state => {
            const f = fixture();
            try {
                f.scene.executeBossAttack('spore_cloud'); f.run(1000);
                f.scene.boss.isRecovering = true;
                if (state === 'dead') f.scene.isPlayerDead = true;
                if (state === 'player-inactive') f.scene.player.active = false;
                if (state === 'boss-disabled') f.scene.boss.body.enable = false;
                if (state === 'player-disabled') f.scene.player.body.enable = false;
                if (state === 'physics-paused') f.world.pause();
                if (state === 'clock-paused') f.clock.paused = true;
                if (state === 'systems-inactive') f.scene.sys.isActive = () => false;
                if (state === 'returning') f.scene._returningToHub = true;
                if (state === 'completion') f.scene.levelCompletionActive = true;
                expect(f.scene.damageBoss(1)).toBe(false);
                expect(f.scene.bossHealth).toBe(18);
                expect(f.scene.forestRecoveryDamage).toBe(0);
                f.scene.updateForestBossHazards();
                expect(f.scene.handlePlayerDamage).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test.each(['boss', 'boss-body', 'player', 'player-body', 'clock', 'world', 'systems', 'events', 'plugin', 'phase', 'tweens'])(
        'a replaced %s retires the old hazard without hitting the successor', binding => {
            const f = fixture();
            try {
                f.scene.executeBossAttack('spore_cloud'); f.run(1000);
                const hazard = [...f.scene.bossHazards][0];
                const remove = jest.spyOn(hazard.lifetime.timer, 'remove');
                const originalTweenKill = jest.spyOn(f.tweens, 'killTweensOf');
                if (binding === 'boss') f.scene.boss = f.actor(5800);
                if (binding === 'boss-body') f.scene.boss.body = f.actor(5800).body;
                if (binding === 'player') f.scene.player = f.actor();
                if (binding === 'player-body') f.scene.player.body = f.actor().body;
                if (binding === 'clock') f.scene.time = { now: f.clock.now, paused: false };
                if (binding === 'world') f.scene.physics.world = { isPaused: false };
                if (binding === 'systems') f.scene.sys = { ...f.scene.sys };
                if (binding === 'events') f.scene.events = new f.scene.events.constructor();
                if (binding === 'plugin') f.scene.scene = {};
                if (binding === 'phase') f.scene.bossPhase = 2;
                if (binding === 'tweens') f.scene.tweens = { killTweensOf: jest.fn() };
                expect(hazard.lifetime.remaining()).toBe(0);
                f.scene.updateForestBossHazards();
                expect(f.scene.handlePlayerDamage).not.toHaveBeenCalled();
                expect(f.scene.bossHazards.size).toBe(0);
                expect(hazard.graphic.active).toBe(false);
                expect(remove).toHaveBeenCalledTimes(1);
                expect(originalTweenKill).toHaveBeenCalledWith(hazard.graphic);
                if (binding === 'tweens') expect(f.scene.tweens.killTweensOf).not.toHaveBeenCalled();
            } finally { f.scene.time = f.clock; f.scene.tweens = f.tweens; f.close(); }
        }
    );

    test.each(['cleanup', 'shutdown', 'boss-destroy', 'player-destroy'])(
        '%s retires owned combat timers without cancelling an unrelated timer', boundary => {
            const f = fixture();
            try {
                f.scene.executeBossAttack('spore_cloud'); f.run(1000);
                f.scene.updateForestBossHazards();
                const hazard = [...f.scene.bossHazards][0];
                const lifetime = hazard.lifetime, hitCooldown = hazard.hitCooldown;
                f.scene.boss.isRecovering = true;
                f.scene.damageBoss(1);
                const bossCooldown = f.scene.forestBossHitCooldown;
                const unrelated = jest.fn(); f.clock.delayedCall(100, unrelated);
                if (boundary === 'cleanup') f.scene.clearForestBossPacing({ includePhase: true });
                if (boundary === 'shutdown') f.scene.events.emit('shutdown');
                if (boundary === 'boss-destroy') f.scene.boss.destroy();
                if (boundary === 'player-destroy') f.scene.player.destroy();
                for (const window of [lifetime, hitCooldown, bossCooldown]) {
                    expect(window.retired).toBe(true);
                    expect(window.timer).toBeNull();
                }
                f.run(100); expect(unrelated).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        }
    );

    test('required boss cooldown setup failure cannot consume health or a recovery hit', () => {
        const f = fixture();
        try {
            f.scene.boss.isRecovering = true;
            const listeners = f.scene.events.listenerCount('shutdown');
            const failure = new Error('SYNTHETIC_FOREST_COOLDOWN_FAILURE');
            jest.spyOn(f.clock, 'addEvent').mockImplementationOnce(() => { throw failure; });
            expect(() => f.scene.damageBoss(1)).toThrow(failure);
            expect(f.scene.bossHealth).toBe(18);
            expect(f.scene.forestRecoveryDamage).toBe(0);
            expect(f.scene.forestBossHits).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(listeners);
            expect(f.scene.damageBoss(1)).toBe(true);
        } finally { f.close(); }
    });

    test('required hazard-timer failure destroys its unregistered shape and leaves the original error visible', () => {
        const f = fixture();
        try {
            const shape = f.scene.add.graphics();
            const failure = new Error('SYNTHETIC_FOREST_HAZARD_FAILURE');
            const listeners = f.scene.events.listenerCount('shutdown');
            jest.spyOn(f.clock, 'addEvent').mockImplementationOnce(() => { throw failure; });
            expect(() => f.scene.addForestBossHazard(shape, () => ({}), 1000)).toThrow(failure);
            expect(shape.active).toBe(false);
            expect(f.scene.bossHazards.size).toBe(0);
            expect(f.scene.bossTelegraphs.size).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(listeners);
        } finally { f.close(); }
    });

    test('required hazard-hit timer failure cannot consume the hit or prevent retry', () => {
        const f = fixture();
        try {
            f.scene.executeBossAttack('spore_cloud'); f.run(1000);
            const hazard = [...f.scene.bossHazards][0];
            const listeners = f.scene.events.listenerCount('shutdown');
            const failure = new Error('SYNTHETIC_FOREST_HAZARD_HIT_FAILURE');
            jest.spyOn(f.clock, 'addEvent').mockImplementationOnce(() => { throw failure; });
            expect(() => f.scene.updateForestBossHazards()).toThrow(failure);
            expect(f.scene.handlePlayerDamage).not.toHaveBeenCalled();
            expect(hazard.hitCooldown).toBeNull();
            expect(hazard.nextHitAt).toBe(0);
            expect(f.scene.events.listenerCount('shutdown')).toBe(listeners);
            f.scene.updateForestBossHazards();
            expect(f.scene.handlePlayerDamage).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });
});
