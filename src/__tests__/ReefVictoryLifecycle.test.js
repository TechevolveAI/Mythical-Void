const { create: createFixture } = require('./support/reefCompletionFixture.cjs');
const { fixture: combatFixture } = require('./support/reefEncounterFixture.cjs');

describe('Reef actual final-hit withdrawal, verified save and reward handoff', () => {
    let owned;
    beforeEach(() => { owned = []; document.body.innerHTML = ''; });
    afterEach(() => { owned.forEach(value => value.close()); jest.restoreAllMocks(); document.body.innerHTML = ''; });
    const create = options => { const value = createFixture(options); owned.push(value); return value; };
    const timer = (scene, delay) => [...scene.guardianTransitionGuards.values()].find(value => value.sceneTimer?.delay === delay)?.sceneTimer?.callback;

    test('actual final hit freezes native motion, keeps original withdrawal timing and saves before physical retirement/rewards', () => {
        const value = create(), { f, scene, boss, bodyActor, world, advance, rewards } = value;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.virtualJoystickX = -1; scene.virtualJoystickY = 1; scene.jumpBufferPressed = true; scene.jumpBufferFramesRemaining = 5;
        scene.player.setVelocity(-200, 350);
        expect(scene.defeatBoss()).toBe(true); expect(world.isPaused).toBe(true); expect(scene.levelCompletionActive).toBe(true);
        expect(scene.player.body.velocity.x).toBe(0); expect(scene.player.body.velocity.y).toBe(0);
        expect(scene.virtualJoystickX).toBe(0); expect(scene.virtualJoystickY).toBe(0);
        expect(scene.jumpBufferPressed).toBe(false); expect(scene.jumpBufferFramesRemaining).toBe(0);
        expect(scene.clearVirtualJumpInput).toHaveBeenCalledTimes(1); expect(scene.hidePlatformerMobileControls).toHaveBeenCalledTimes(1);
        expect(bodyActor.body.enable).toBe(false); expect(writer).not.toHaveBeenCalled();
        advance(1); advance(1099); expect(boss.alpha).toBeLessThan(1); expect(boss.scaleX).toBeLessThan(1);
        advance(1099); expect(boss.active).toBe(true); expect(bodyActor.active).toBe(true);
        advance(1); expect(boss.active).toBe(false); expect(bodyActor.active).toBe(true); expect(writer).not.toHaveBeenCalled();
        f.state.on('saved', () => { expect(bodyActor.active).toBe(true); expect(f.state.get('levels.cosmicReef.completed')).toBe(true); });
        advance(399); expect(writer).not.toHaveBeenCalled(); advance(1);
        expect(writer).toHaveBeenCalledTimes(1); expect(bodyActor.active).toBe(false);
        expect(scene.boss).toBeNull(); expect(scene.bossBody).toBeNull(); expect(scene.reefVictory.retired).toBe(true);
        expect(scene.levelCompletionResult.time).toBe(3600); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(f.state.get('hubWorld.shipParts.collected')).toContain('dimensional_drive');
        expect(rewards().root.isConnected).toBe(true); expect(scene.reefVictoryShown).toBe(true);
        const panel = scene.regionalVictoryPanel; panel.button.click(); panel.button.click();
        expect(scene.transitions).toHaveLength(1); expect(scene.transitions[0].name).toBe('GameScene'); expect(writer).toHaveBeenCalledTimes(1);
    });

    test('refused write keeps the original disabled physics actor and exact packet for Retry, with no premature reward', () => {
        const value = create(), { f, scene, bodyActor, advance, rewards } = value; f.state.startAutoSave();
        const raw = f.storage.getItem(f.state.saveKey), set = f.storage.setItem; let refuse = true;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, data); };
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.defeatBoss()).toBe(true); advance(2600);
        expect(scene.completionSaveAttempt.phase).toBe('prepared'); expect(bodyActor.active).toBe(true); expect(bodyActor.body.enable).toBe(false);
        expect(scene.levelCompletionResult).toBeNull(); expect(f.state.get('combat.bossesDefeated')).toBe(0);
        expect(scene.residentReleaseOpen).not.toBe(true); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        const packet = writer.mock.calls[0][0]; f.advanceClock(61000); f.fireIntervals(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        refuse = false; document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(2); expect(writer.mock.calls[1][0]).toBe(packet); expect(scene.levelCompletionResult.time).toBe(3600);
        expect(rewards().root.isConnected).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('lost acknowledgement accepts only exact saved bytes and repeated finish/reward callbacks cannot regrant', () => {
        const value = create(), { f, scene, advance, rewards } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => { const result = set(key, data); if (key === f.state.saveKey) { primary++; throw Error('SYNTHETIC_LOST_ACK'); } return result; };
        expect(scene.defeatBoss()).toBe(true); const finish = timer(scene, 2600), fade = timer(scene, 2200), victory = scene.reefVictory;
        advance(2600); finish(); finish(); fade(); expect(rewards().root.isConnected).toBe(true);
        expect(scene.showVictoryScreen()).toBe(true); expect(scene.defeatBoss()).toBe(false); expect(primary).toBe(1);
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(victory.timers.size).toBe(0); expect(victory.tweens.size).toBe(0);
        expect(scene.player.listenerCount('destroy')).toBe(0);
    });

    test('five original resonance bursts remain; celebration sound waits for a verified reward presentation', () => {
        const value = create(), { f, scene, advance, rewards } = value;
        scene.defeatBoss(); advance(0); for (let i = 0; i < 4; i++) advance(300);
        expect(f.selected.FXLibrary.stardustBurst).toHaveBeenCalledTimes(5); expect(f.selected.AudioManager.playLevelUp).not.toHaveBeenCalled();
        advance(1400); rewards(); expect(f.selected.AudioManager.playLevelUp).toHaveBeenCalledTimes(1);
    });

    test.each(['text', 'fade', 'flash', 'burst', 'burst-timer'])('optional %s failure cannot strand the independent saved handoff', kind => {
        const value = create(), { f, scene, advance, rewards } = value, fail = () => { throw Error('SYNTHETIC_OPTIONAL_FAILURE'); };
        if (kind === 'text') scene.showFloatingText = fail;
        if (kind === 'fade') jest.spyOn(scene.tweens, 'add').mockImplementationOnce(fail);
        if (kind === 'flash') f.selected.FeedbackManager.cameraFlash.mockImplementation(fail);
        if (kind === 'burst') f.selected.FXLibrary.stardustBurst.mockImplementation(fail);
        if (kind === 'burst-timer') {
            const delayed = scene.time.delayedCall.bind(scene.time); let count = 0;
            scene.time.delayedCall = (...args) => ++count === 3 ? fail() : delayed(...args);
        }
        expect(() => scene.defeatBoss()).not.toThrow(); advance(2600);
        expect(f.state.get('levels.cosmicReef.completed')).toBe(true); expect(rewards().root.isConnected).toBe(true);
    });

    test('a rejected optional sound request is caught after the saved result, without audible playback', async () => {
        const value = create(), { f, scene, advance, rewards } = value;
        f.selected.AudioManager.playLevelUp.mockRejectedValue(Error('SYNTHETIC_AUDIO_FAILURE'));
        scene.defeatBoss(); advance(2600); expect(rewards().root.isConnected).toBe(true);
        await Promise.resolve(); await Promise.resolve(); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['admission', 'held', 'state', 'cloud', 'shutdown', 'player-destroy', 'inactive', 'returning',
        'plugin', 'encounter', 'player', 'artwork', 'physics-actor', 'physics-body', 'body-world', 'body-object', 'body-destroy',
        'clock', 'world', 'lifetime', 'business', 'creature'])(
        '%s replacement cannot receive or trigger an old completion', kind => {
            const value = create(), { f, scene, advance, bodyActor } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
            expect(scene.defeatBoss()).toBe(true); const finish = timer(scene, 2600), fade = timer(scene, 2200);
            if (kind === 'admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-next-campaign' });
            if (kind === 'held') f.state.holdSaveAdmission({ code: 'synthetic-hold' }, 'synthetic');
            if (kind === 'state') f.selected.GameState = {};
            if (kind === 'cloud') f.selected.CloudSave = { campaignEpoch: 2, currentUser: { id: 'synthetic-other' } };
            if (kind === 'shutdown') scene.events.emit('shutdown');
            if (kind === 'player-destroy') scene.player.destroy();
            if (kind === 'inactive') scene.active = false;
            if (kind === 'returning') scene._returningToHub = true;
            if (kind === 'plugin') scene.scene = {};
            if (kind === 'encounter') scene.guardianEncounter = { id: 'synthetic-other' };
            if (kind === 'player') scene.player = value.actor();
            if (kind === 'artwork') scene.boss = value.object();
            if (kind === 'physics-actor') scene.bossBody = value.actor();
            if (kind === 'physics-body') bodyActor.body = { ...bodyActor.body };
            if (kind === 'body-world') bodyActor.body.world = {};
            if (kind === 'body-object') bodyActor.body.gameObject = {};
            if (kind === 'body-destroy') bodyActor.body.destroy = jest.fn();
            if (kind === 'clock') scene.time = {};
            if (kind === 'world') scene.physics.world = {};
            if (kind === 'lifetime') scene.completionSaveLifetime = {};
            if (kind === 'business') f.state.state.player.cosmicCoins += 7;
            if (kind === 'creature') f.state.state.creature.id = 'synthetic-other';
            const raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(f.state.state), replacement = scene.bossBody;
            fade(); finish(); advance(3000);
            expect(writer).not.toHaveBeenCalled(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
            expect(scene.levelCompletionResult).toBeNull(); expect(scene.residentReleaseOpen).not.toBe(true);
            if (kind === 'physics-actor') expect(replacement.active).toBe(true);
        });

    test.each(['body', 'world', 'object'])('a %s substitution in the backup observer cannot reach the primary writer', kind => {
        const value = create(), { f, scene, bodyActor, advance } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey) primary++; return set(key, data); };
        const raw = f.storage.getItem(f.state.saveKey);
        f.state.on('saveBackupCreated', () => {
            if (kind === 'body') bodyActor.body = { ...bodyActor.body };
            if (kind === 'world') bodyActor.body.world = {};
            if (kind === 'object') bodyActor.body.gameObject = {};
        });
        scene.defeatBoss(); advance(2600);
        expect(primary).toBe(0); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(scene.levelCompletionResult).toBeNull();
    });

    test('a campaign changed by a real Guardian notification cannot receive the rest of the old result/presentation', () => {
        const value = create(), { f, scene, advance } = value; let successor;
        const off = f.state.on('changed:combat.bossesDefeated', () => {
            off(); const next = f.state.createInitialState(); next.player.cosmicCoins = 77;
            f.state.applyExternalSave(next, { source: 'synthetic-notification-successor' });
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), bytes: JSON.stringify(f.state.state) };
        });
        scene.defeatBoss(); advance(2600); expect(successor).toBeDefined();
        expect(f.state.state).toBe(successor.root); expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw);
        expect(JSON.stringify(f.state.state)).toBe(successor.bytes); expect(scene.residentReleaseOpen).not.toBe(true);
    });

    test('normal accounting/media before first calculation retains their original current state', () => {
        const value = create(), { f, scene, advance, rewards } = value;
        scene.defeatBoss(); advance(1000); f.state.set('story.companionMedia', { synthetic: true }); expect(f.state.save()).toBe(true);
        advance(1600); expect(f.state.get('story.companionMedia')).toEqual({ synthetic: true }); expect(rewards().root.isConnected).toBe(true);
    });

    test('the initial freeze cannot recapture a changed business source', () => {
        const { f, scene } = create(), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.endInvincibility.mockImplementation(() => { f.state.state.player.cosmicCoins += 7; });
        expect(scene.defeatBoss()).toBe(false); expect(scene.reefVictory.retired).toBe(true);
        expect(writer).not.toHaveBeenCalled(); expect(scene.guardianTransitionGuards.size).toBe(0);
    });

    test('missing cosmetic artwork still saves the current victory through the retained original physics actor', () => {
        const value = create(), { f, scene, boss, advance, rewards } = value;
        scene.defeatBoss(); boss.destroy(); advance(2600);
        expect(f.state.get('levels.cosmicReef.completed')).toBe(true); expect(rewards().root.isConnected).toBe(true);
    });

    test('a failed artwork destruction listener cannot abort the saved reward handoff', () => {
        const value = create(), { f, scene, boss, advance, rewards } = value;
        boss.once('destroy', () => { throw Error('SYNTHETIC_COSMETIC_LISTENER_FAILURE'); });
        scene.defeatBoss(); expect(() => advance(2600)).not.toThrow();
        expect(f.state.get('levels.cosmicReef.completed')).toBe(true); expect(rewards().root.isConnected).toBe(true);
    });

    test('artwork destruction re-entering an encounter cannot clear or destroy its replacement physical actor', () => {
        const value = create(), { f, scene, boss, bodyActor, advance } = value; let replacement;
        boss.once('destroy', () => {
            scene.boss = value.object(); replacement = scene.bossBody = value.actor();
            scene.guardianEncounter = { id: 'synthetic-successor-encounter' };
        });
        scene.defeatBoss(); advance(2200); advance(400);
        expect(replacement.active).toBe(true); expect(bodyActor.active).toBe(true); expect(scene.bossBody).toBe(replacement);
        expect(f.state.get('levels.cosmicReef.completed')).toBe(false); expect(scene.residentReleaseOpen).not.toBe(true);
    });

    test('verified physical destruction cannot clear a replacement alias or automatically show the old panel', () => {
        const value = create(), { f, scene, bodyActor, advance } = value; let replacement;
        bodyActor.once('destroy', () => { replacement = scene.bossBody = value.actor(); });
        scene.defeatBoss(); advance(2600);
        expect(f.state.get('levels.cosmicReef.completed')).toBe(true); expect(replacement.active).toBe(true);
        expect(scene.bossBody).toBe(replacement); expect(scene.residentReleaseOpen).not.toBe(true);
        expect(document.querySelector('[data-completion-save-recovery]')).not.toBeNull();
    });

    test('native UI proxy stops before writing a replaced HUD, while an unrelated tween keeps playing', () => {
        const value = create(), { scene, advance, tweens } = value, ui = scene.bossUI, unrelated = value.object();
        const other = tweens.add({ targets: unrelated, alpha: 0.4, duration: 5000 });
        scene.defeatBoss(); advance(1); advance(100); const alpha = ui.alpha;
        scene.bossUI = value.object(); const replacement = scene.bossUI;
        advance(500); expect(ui.alpha).toBe(alpha); expect(replacement.alpha).toBe(1); expect(other.isPlaying()).toBe(true);
    });

    test('a stalled scene clock has an owned once-only wall fallback', () => {
        const value = create(), { f, scene, wallTimers, rewards } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.defeatBoss(); const record = [...scene.guardianTransitionGuards.values()].find(record => record.sceneTimer?.delay === 2600);
        const callback = wallTimers.get(record.wallTimer); f.advanceClock(3200); callback(); callback();
        expect(writer).toHaveBeenCalledTimes(1); expect(scene.levelCompletionResult.time).toBe(4200); expect(rewards().root.isConnected).toBe(true);
    });

    test('failed mandatory scene-timer setup falls back instead of becoming a dead end', () => {
        const value = create(), { f, scene, wallTimers, rewards } = value;
        jest.spyOn(scene.time, 'delayedCall').mockImplementationOnce(() => { throw Error('SYNTHETIC_TIMER_FAILURE'); });
        expect(scene.defeatBoss()).toBe(true);
        const callback = [...wallTimers.values()][0]; f.advanceClock(3200); callback();
        expect(f.state.get('levels.cosmicReef.completed')).toBe(true); expect(rewards().root.isConnected).toBe(true);
    });

    test('required writer failure is recoverable and never silently regrants', () => {
        const value = create(), { f, scene, advance } = value;
        jest.spyOn(f.state, 'commitHatchSaveDraft').mockImplementation(() => { throw Error('SYNTHETIC_REQUIRED_FAILURE'); });
        expect(() => scene.defeatBoss()).not.toThrow(); advance(2600);
        expect(scene.levelCompletionResult).toBeNull(); expect(f.state.get('levels.cosmicReef.completed')).toBe(false);
        expect(scene.residentReleaseOpen).not.toBe(true);
    });

    test('thirty retired story owners release only their own work and preserve an unrelated native tween', () => {
        const value = create(), { f, scene, tweens, advance } = value, unrelated = value.object();
        const other = tweens.add({ targets: unrelated, alpha: 0.4, duration: 5000 }), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        for (let i = 0; i < 30; i++) {
            scene.bossDefeated = false; scene.bossFightActive = true; scene.levelCompletionActive = false;
            scene.completionSaveLifetime = {}; scene.boss = value.object(); scene.bossBody = value.actor();
            scene.guardianEncounter = { id: 'nyxvoral', active: true, startedAt: i };
            expect(scene.defeatBoss()).toBe(true); const finish = timer(scene, 2600), victory = scene.reefVictory;
            victory.retire(); finish(); advance(1);
            expect(victory.timers.size).toBe(0); expect(victory.tweens.size).toBe(0); expect(scene.player.listenerCount('destroy')).toBe(0);
        }
        expect(writer).not.toHaveBeenCalled(); expect(other.isPlaying()).toBe(true); expect(unrelated.active).toBe(true);
    });

    test.each(['init', 'shutdown'])('actual Reef %s retires the pre-writer story owner in the separate combat fixture', boundary => {
        const f = combatFixture();
        try {
            expect(f.scene.defeatBoss()).toBe(true); const victory = f.scene.reefVictory;
            f.scene[boundary](); f.advance(3000);
            expect(victory.retired).toBe(true); expect(victory.timers.size).toBe(0); expect(victory.tweens.size).toBe(0);
            expect(f.scene.showVictoryScreen).not.toHaveBeenCalled();
        } finally { f.close(); }
    });
});
