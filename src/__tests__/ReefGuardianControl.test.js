const { fixture } = require('./support/reefEncounterFixture.cjs');

function setup() {
    const f = fixture(), scene = f.scene;
    scene.children = { remove() {} };
    scene.textures = { exists: () => true };
    scene.add.image = (x, y) => scene.add.graphics().setPosition(x, y);
    scene.physics.add.sprite = (x, y) => f.actor(x, y);
    scene.physics.resume = () => f.world.resume();
    scene.cameras = { main: { width: 1280, startFollow: jest.fn(), setFollowOffset: jest.fn(), setZoom: jest.fn() } };
    scene.cameraLeadAmount = 0; scene.cameraBaseOffsetY = 0;
    scene.createBossHealthBar = jest.fn(); scene.scheduleGuardianTransition = jest.fn();
    scene.showPlatformerMobileControls = jest.fn();
    scene.bossVoidLunge = jest.fn(); scene.bossDimensionalTear = jest.fn(); scene.bossSummonMinions = jest.fn();
    const subtitle = () => {
        const text = scene.add.graphics(); text.text = '';
        text.setText = jest.fn(value => { text.text = value; return text; });
        text.setColor = jest.fn(() => text); return text;
    };
    scene.bossSubtitle = subtitle();
    return { ...f, subtitle, spawn() { scene.spawnNyxvoral(); f.process(); return f.colliders.at(-1); } };
}

describe('Reef Guardian controls retain their encounter and current timer slot', () => {
    test('an old contact cannot consume the successor contact window', () => {
        const f = setup();
        try {
            const old = f.spawn().collideCallback; f.spawn();
            f.scene.bossContactDamageArmed = true; f.scene.bossContactDamageConsumed = false;
            old();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.bossContactDamageArmed).toBe(true);
        } finally { f.close(); }
    });

    test('replacing the contact owner removes the old native collider', () => {
        const f = setup();
        try {
            const old = f.spawn(); f.spawn(); f.process();
            expect(old.active).toBe(false);
            expect(f.world.colliders.getActive()).toHaveLength(2);
        } finally { f.close(); }
    });

    test('a captured AI callback cannot command the restarted encounter', () => {
        const f = setup();
        try {
            f.scene.bossAttack = jest.fn(); f.scene.startBossAI();
            const callback = f.scene.bossAttackTimer.callback;
            f.scene.init(); f.scene.bossFightActive = true; f.scene.bossCombatReady = true; callback();
            expect(f.scene.bossAttack).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('an old unlock cannot release a newer attack after a phase transition', () => {
        const f = setup();
        try {
            f.scene.bossAttack('voidLunge'); const unlock = f.scene.bossAttackUnlockTimer.callback;
            f.scene.enterReefBossPhase(2); f.advance(950); f.scene.bossRecoveryUntil = 0;
            f.scene.bossAttack('summonMinions'); expect(f.scene.bossAttackLocked).toBe(true);
            unlock(); expect(f.scene.bossAttackLocked).toBe(true);
        } finally { f.close(); }
    });

    test('an old phase completion cannot release the next phase', () => {
        const f = setup();
        try {
            f.scene.enterReefBossPhase(2); const finish = f.scene.bossPhaseTransitionTimer.callback; finish();
            f.scene.enterReefBossPhase(3); finish();
            expect(f.scene.bossPhaseTransitionActive).toBe(true);
            expect(f.scene.bossAttackLocked).toBe(true);
        } finally { f.close(); }
    });

    test('old instruction expiry cannot overwrite the current instruction', () => {
        const f = setup();
        try {
            f.scene.showBossAttackInstruction('SYNTHETIC FIRST', 1000); const expire = f.scene.bossInstructionTimer.callback;
            f.scene.showBossAttackInstruction('SYNTHETIC CURRENT', 3500); expire();
            expect(f.scene.bossSubtitle.text).toBe('SYNTHETIC CURRENT');
        } finally { f.close(); }
    });

    test('old opening grace cannot trigger a new encounter after actual init', () => {
        const f = setup();
        try {
            f.scene.bossCombatReady = false; f.scene.beginReefGuardianCombat();
            const callback = f.scene.bossAttackPreviewTimer.callback; f.scene.bossAttack = jest.fn();
            f.scene.init(); f.scene.bossFightActive = true; f.scene.bossCombatReady = true; callback();
            expect(f.scene.bossAttack).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('normal native contact retains one damage request per armed window', () => {
        const f = setup();
        try {
            f.spawn(); f.scene.player.body.reset(f.scene.bossBody.x, f.scene.bossBody.y);
            f.scene.bossContactDamageArmed = true; f.scene.bossContactDamageConsumed = false;
            f.contact(); f.contact();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1); expect(f.scene.takeDamage).toHaveBeenCalledWith(1);
            expect(f.scene.bossContactDamageConsumed).toBe(true); expect(f.scene.bossContactDamageArmed).toBe(false);
        } finally { f.close(); }
    });

    test('normal attack unlock and phase timing remain unchanged', () => {
        const f = setup();
        try {
            f.scene.bossAttack('voidLunge'); expect(f.scene.bossAttackUnlockTimer.delay).toBe(2600);
            f.advance(2599); expect(f.scene.bossAttackLocked).toBe(true);
            f.advance(1); expect(f.scene.bossAttackLocked).toBe(false);
            f.scene.enterReefBossPhase(2); expect(f.scene.bossPhaseTransitionTimer.delay).toBe(950);
            f.advance(950); expect(f.scene.bossPhaseTransitionActive).toBe(false);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledWith(950);
        } finally { f.close(); }
    });

    test('normal AI cadence and phase cadence changes are retained', () => {
        const f = setup();
        try {
            f.scene.bossAttack = jest.fn(); f.scene.startBossAI(); expect(f.scene.bossAttackTimer.delay).toBe(2500);
            f.advance(2500); expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
            f.scene.enterReefBossPhase(2); expect(f.scene.bossAttackTimer.delay).toBe(2200);
            f.advance(950); f.scene.enterReefBossPhase(3); expect(f.scene.bossAttackTimer.delay).toBe(1850);
        } finally { f.close(); }
    });

    test('reinstalling contact on the same owner rejects the removed registration', () => {
        const f = setup();
        try {
            const old = f.spawn(), callback = old.collideCallback, control = f.scene.reefGuardianControl;
            control.installContact(() => f.scene.takeDamage(1));
            f.scene.bossContactDamageArmed = true; f.scene.bossContactDamageConsumed = false;
            callback();
            expect(f.scene.takeDamage).not.toHaveBeenCalled();
            expect(f.scene.bossContactDamageArmed).toBe(true);
            f.scene.player.body.reset(f.scene.bossBody.x, f.scene.bossBody.y); f.contact();
            expect(f.scene.takeDamage).toHaveBeenCalledTimes(1);
            expect(old.active).toBe(false);
        } finally { f.close(); }
    });

    test.each(['boss', 'bossBody', 'player'])('%s destruction retires contact, timers and listeners', field => {
        const f = setup();
        try {
            const contact = f.spawn(), control = f.scene.reefGuardianControl;
            f.scene.startBossAI(); f.scene.showBossAttackInstruction('SYNTHETIC CUE');
            const attack = f.scene.bossAttackTimer.callback;
            f.scene[field].destroy(); attack(); f.process();
            expect(control.retired).toBe(true); expect(control.timers.size).toBe(0);
            expect(contact.active).toBe(false); expect(f.scene.reefGuardianControl).toBeNull();
            expect(f.scene.bossAttackTimer).toBeNull(); expect(f.scene.bossInstructionTimer).toBeNull();
            expect(f.scene.events.listenerCount('shutdown')).toBe(0);
            control.actors().forEach(actor => expect(actor.listenerCount('destroy')).toBe(0));
        } finally { f.close(); }
    });

    test.each(['init', 'shutdown'])('actual %s retires the control before a later native clock tick', method => {
        const f = setup();
        try {
            const contact = f.spawn(), control = f.scene.reefGuardianControl;
            f.scene.startBossAI(); f.scene.enterReefBossPhase(2);
            const phase = f.scene.bossPhaseTransitionTimer.callback;
            f.scene[method](); phase(); f.advance(4000);
            expect(control.retired).toBe(true); expect(control.timers.size).toBe(0);
            expect(contact.active).toBe(false); expect(f.scene.openReefBossRecovery).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['boss', 'bossBody', 'player', 'guardianEncounter', 'scene'])(
        'replacement of %s cannot redirect old callbacks or clear successor timer aliases', field => {
            const f = setup();
            try {
                f.scene.scene = { key: 'synthetic-original' };
                f.scene.bossAttack = jest.fn(); f.scene.startBossAI();
                const old = f.scene.bossAttackTimer.callback, control = f.scene.reefGuardianControl;
                f.scene[field] = ['boss', 'bossBody', 'player'].includes(field)
                    ? f.actor() : { key: 'synthetic-replacement' };
                f.scene.startBossAI(); const successor = f.scene.bossAttackTimer;
                old();
                expect(f.scene.bossAttack).not.toHaveBeenCalled();
                expect(f.scene.bossAttackTimer).toBe(successor); expect(control.retired).toBe(true);
                f.advance(2500); expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        }
    );

    test('once-only phase completion keeps later phase and recovery state intact', () => {
        const f = setup();
        try {
            f.scene.enterReefBossPhase(2); const finish = f.scene.bossPhaseTransitionTimer.callback;
            finish(); finish(); f.advance(950);
            expect(f.scene.openReefBossRecovery).toHaveBeenCalledTimes(1);
            expect(f.scene.bossPhaseTransitionTimer).toBeNull();
            expect(f.scene.bossPhaseAdvanceLockedUntil).toBe(1200);
        } finally { f.close(); }
    });

    test.each([['voidLunge', 2600], ['dimensionalTear', 2200], ['summonMinions', 3400]])(
        '%s retains its %ims attack window and permits the next attack', (attack, duration) => {
            const f = setup();
            try {
                f.scene.bossAttack(attack); f.advance(duration - 1);
                expect(f.scene.bossAttackLocked).toBe(true);
                f.scene.bossAttack(attack);
                const handler = { voidLunge: 'bossVoidLunge', dimensionalTear: 'bossDimensionalTear',
                    summonMinions: 'bossSummonMinions' }[attack];
                expect(f.scene[handler]).toHaveBeenCalledTimes(1);
                f.advance(1); expect(f.scene.bossAttackLocked).toBe(false);
                expect(f.scene.bossAttackUnlockTimer).toBeNull();
                f.scene.bossAttack(attack); expect(f.scene[handler]).toHaveBeenCalledTimes(2);
            } finally { f.close(); }
        }
    );

    test('opening grace starts once at 3000ms and then installs the normal loop', () => {
        const f = setup();
        try {
            f.scene.bossCombatReady = false; f.scene.bossAttack = jest.fn();
            expect(f.scene.beginReefGuardianCombat()).toBe(true);
            expect(f.scene.beginReefGuardianCombat()).toBe(false);
            const start = f.scene.bossAttackPreviewTimer.callback;
            f.advance(2999); expect(f.scene.bossAttack).not.toHaveBeenCalled();
            f.advance(1); start();
            expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
            expect(f.scene.bossAttackPreviewTimer).toBeNull(); expect(f.scene.bossAttackTimer.delay).toBe(2500);
            f.advance(2500); expect(f.scene.bossAttack).toHaveBeenCalledTimes(2);
        } finally { f.close(); }
    });

    test('deterministic attack preview remains a single attack without an AI loop', () => {
        const f = setup();
        try {
            f.scene.bossCombatReady = false; f.scene.bossAttackPreview = 'dimensionalTear';
            f.scene.bossAttack = jest.fn(); f.scene.beginReefGuardianCombat(); f.advance(3000);
            expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
            expect(f.scene.bossAttack).toHaveBeenCalledWith('dimensionalTear');
            expect(f.scene.bossAttackTimer).toBeNull(); expect(f.scene.bossInstructionTimer).toBeNull();
        } finally { f.close(); }
    });

    test('an opening callback due in the same native clock frame as death waits for retry', () => {
        const f = setup();
        try {
            f.clock.delayedCall(3000, () => { f.scene.isPlayerDead = true; f.clock.paused = true; });
            f.scene.bossCombatReady = false; f.scene.bossAttack = jest.fn(); f.scene.beginReefGuardianCombat();
            f.advance(3000); expect(f.scene.bossAttack).not.toHaveBeenCalled();
            expect(f.scene.bossAttackPreviewTimer).not.toBeNull();
            f.advance(5000); expect(f.scene.bossAttack).not.toHaveBeenCalled();
            f.scene.isPlayerDead = false; f.clock.paused = false; f.advance(0);
            expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
            expect(f.scene.bossAttackTimer.delay).toBe(2500);
        } finally { f.close(); }
    });

    test('native clock pause preserves the cooldown and the AI skips dead-player ticks', () => {
        const f = setup();
        try {
            f.scene.bossAttack('voidLunge'); f.clock.paused = true; f.advance(5000);
            expect(f.scene.bossAttackLocked).toBe(true);
            f.clock.paused = false; f.advance(2600); expect(f.scene.bossAttackLocked).toBe(false);
            f.scene.bossAttack = jest.fn(); f.scene.startBossAI(); f.scene.isPlayerDead = true;
            f.advance(2500); expect(f.scene.bossAttack).not.toHaveBeenCalled();
            f.scene.isPlayerDead = false; f.advance(2500); expect(f.scene.bossAttack).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test.each(['isPlayerDead', 'disabledPlayer', 'disabledBoss', 'inactiveScene'])(
        '%s prevents contact from consuming the attack window', condition => {
            const f = setup();
            try {
                const contact = f.spawn();
                f.scene.bossContactDamageArmed = true; f.scene.bossContactDamageConsumed = false;
                if (condition === 'isPlayerDead') f.scene.isPlayerDead = true;
                if (condition === 'disabledPlayer') f.scene.player.body.enable = false;
                if (condition === 'disabledBoss') f.scene.bossBody.body.enable = false;
                if (condition === 'inactiveScene') f.scene.sys.isActive = () => false;
                contact.collideCallback(); expect(contact.processCallback()).toBe(false);
                expect(f.scene.takeDamage).not.toHaveBeenCalled(); expect(f.scene.bossContactDamageArmed).toBe(true);
            } finally { f.close(); }
        }
    );

    test('instruction expiry honours its original text object and minimum lifetime', () => {
        const f = setup();
        try {
            f.scene.showBossAttackInstruction('SYNTHETIC CUE', 300);
            expect(f.scene.bossInstructionTimer.delay).toBe(650);
            f.advance(649); expect(f.scene.bossSubtitle.text).toBe('SYNTHETIC CUE');
            f.advance(1); expect(f.scene.bossSubtitle.text).toBe('CURRENT LINK ACTIVE // KATANA STRIKES AMPLIFIED');
            f.scene.showBossAttackInstruction('SYNTHETIC OLD');
            const old = f.scene.bossSubtitle; f.scene.bossSubtitle = f.subtitle(); f.advance(2200);
            expect(old.text).toBe('SYNTHETIC OLD'); expect(f.scene.bossSubtitle.text).toBe('');
        } finally { f.close(); }
    });

    test('optional instruction failure does not prevent an attack or its unlock', () => {
        const f = setup();
        try {
            f.scene.bossSubtitle.setText.mockImplementation(() => { throw Error('SYNTHETIC_TEXT_FAILURE'); });
            expect(() => f.scene.bossAttack('voidLunge')).not.toThrow();
            expect(f.scene.bossVoidLunge).toHaveBeenCalledTimes(1);
            f.advance(2600); expect(f.scene.bossAttackLocked).toBe(false);
        } finally { f.close(); }
    });

    test.each(['timer', 'attack'])('required %s setup failure stays an error without leaving an attack lock', failure => {
        const f = setup();
        try {
            const fail = () => { throw Error('SYNTHETIC_REQUIRED_FAILURE'); };
            if (failure === 'timer') jest.spyOn(f.clock, 'delayedCall').mockImplementationOnce(fail);
            else f.scene.bossVoidLunge.mockImplementationOnce(fail);
            expect(() => f.scene.bossAttack('voidLunge')).toThrow('SYNTHETIC_REQUIRED_FAILURE');
            expect(f.scene.bossAttackLocked).toBe(false); expect(f.scene.bossContactDamageArmed).toBe(false);
            expect(f.scene.bossAttackUnlockTimer).toBeNull();
            f.advance(0); f.scene.bossAttack('voidLunge'); expect(f.scene.bossAttackLocked).toBe(true);
        } finally { f.close(); }
    });

    test('thirty retired controls release only their contact, timers, phase art and listeners', () => {
        const f = setup();
        try {
            const unrelated = f.scene.add.graphics();
            const tween = f.tweens.add({ targets: unrelated, alpha: 0.4, duration: 5000 });
            for (let index = 0; index < 30; index++) {
                f.scene.bossPhase = 1; f.scene.bossPhaseTransitionActive = false;
                const contact = f.spawn(), control = f.scene.reefGuardianControl;
                f.scene.startBossAI(); f.scene.enterReefBossPhase(2);
                f.scene.showBossAttackInstruction('SYNTHETIC CUE');
                const phaseArt = [...control.objects], phaseTweens = [...control.tweens];
                control.retire(); control.retire(); f.advance(0);
                expect(control.timers.size).toBe(0); expect(contact.active).toBe(false);
                expect(control.objects.size).toBe(0); expect(control.tweens.size).toBe(0);
                phaseArt.forEach(art => expect(art.active).toBe(false));
                phaseTweens.forEach(owned => expect(owned.isPlaying()).toBe(false));
                expect(f.scene.events.listenerCount('shutdown')).toBe(0);
                control.actors().forEach(actor => expect(actor.listenerCount('destroy')).toBe(0));
                expect(f.world.colliders.getActive()).toHaveLength(1);
            }
            expect(unrelated.active).toBe(true); expect(tween.isPlaying()).toBe(true);
        } finally { f.close(); }
    });
});
