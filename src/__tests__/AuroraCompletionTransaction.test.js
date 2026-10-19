const { create: createFixture } = require('./support/reefCompletionFixture.cjs');

describe('actual Aurora final hit, verified result, saved message and rewards', () => {
    let owned;
    beforeEach(() => { owned = []; document.body.innerHTML = ''; });
    afterEach(() => { owned.forEach(value => value.close()); jest.restoreAllMocks(); document.body.innerHTML = ''; });
    const create = options => { const value = createFixture({ realm: 'aurora', ...options }); owned.push(value); return value; };
    const timer = (scene, delay) => [...scene.guardianTransitionGuards.values()].find(value => value.sceneTimer?.delay === delay)?.sceneTimer?.callback;
    const finish = value => { value.advance(1800); value.advance(3000); return value.rewards(); };

    test('normal native withdrawal saves at 1800ms, then original 3000ms message reaches real rewards and Continue once', () => {
        const value = create(), { f, scene, boss, bodyActor, world, advance, rewards } = value;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.player.setVelocity(-200, 350); scene.virtualJoystickX = -1; scene.virtualJoystickY = 1;
        expect(scene.onBossDefeated()).toBe(true); expect(world.isPaused).toBe(true);
        expect(scene.player.body.velocity.x).toBe(0); expect(scene.player.body.velocity.y).toBe(0);
        expect(scene.virtualJoystickX).toBe(0); expect(scene.virtualJoystickY).toBe(0);
        expect(boss.body.enable).toBe(false); expect(bodyActor.body.enable).toBe(false);
        expect(writer).not.toHaveBeenCalled(); expect(scene.auroraReactorFound).toBe(false);
        advance(1); advance(899); expect(boss.y).toBeLessThan(550); expect(boss.alpha).toBeLessThan(1);
        advance(899); expect(writer).not.toHaveBeenCalled(); advance(1);
        expect(writer).toHaveBeenCalledTimes(1); expect(boss.active).toBe(false); expect(bodyActor.active).toBe(true);
        expect(scene.auroraVictory.phase).toBe('saved'); expect(scene.auroraReactorFound).toBe(true);
        expect(f.state.get('levels.auroraDepths.completed')).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(scene.levelCompletionResult.time).toBe(2800); expect(f.state.get('hubWorld.shipParts.collected')).toContain('aurora_reactor');
        expect(f.state.get('story.projectBeacon.fieldKit.katana.installedUpgrades')).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'aurora_guard' })]));
        advance(2999); expect(scene.residentReleaseOpen).not.toBe(true); advance(1);
        expect(bodyActor.active).toBe(false); expect(scene.boss).toBeNull(); expect(scene.bossBody).toBeNull();
        expect(rewards().root.isConnected).toBe(true); expect(scene.auroraVictoryShown).toBe(true);
        const panel = scene.regionalVictoryPanel; panel.button.click(); panel.button.click();
        expect(scene.transitions).toHaveLength(1); expect(scene.transitions[0].name).toBe('GameScene'); expect(writer).toHaveBeenCalledTimes(1);
    });

    test.each(['withdrawal-tween', 'message-text', 'message-tween', 'graphics'])('optional %s failure cannot own either progression handoff', kind => {
        const value = create(), { scene } = value, fail = () => { throw Error('SYNTHETIC_OPTIONAL_FAILURE'); };
        if (kind === 'withdrawal-tween') jest.spyOn(scene.tweens, 'add').mockImplementationOnce(fail);
        if (kind === 'message-tween') {
            const add = scene.tweens.add.bind(scene.tweens); scene.tweens.add = config => scene.auroraVictory?.phase === 'saved' ? fail() : add(config);
        }
        if (kind === 'message-text') {
            const text = scene.add.text; scene.add.text = (...args) => args[2] === 'AURORA PHOENIX RESTORED' ? fail() : text(...args);
        }
        if (kind === 'graphics') jest.spyOn(scene.add, 'graphics').mockImplementationOnce(fail);
        expect(scene.onBossDefeated()).toBe(true); expect(finish(value).root.isConnected).toBe(true);
    });

    test('coarse-frame save refusal retains its exact packet and disabled physics actor for Retry without premature message/rewards', () => {
        const value = create(), { f, scene, bodyActor, advance, rewards } = value; f.state.startAutoSave();
        const raw = f.storage.getItem(f.state.saveKey), set = f.storage.setItem; let refuse = true;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, data); };
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.onBossDefeated(); advance(1800);
        expect(scene.completionSaveAttempt.phase).toBe('prepared'); expect(scene.auroraReactorFound).toBe(false);
        expect(scene.auroraVictory.ownedText).toBeNull(); expect(bodyActor.active).toBe(true); expect(bodyActor.body.enable).toBe(false);
        expect(scene.residentReleaseOpen).not.toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(0);
        const packet = writer.mock.calls[0][0]; f.advanceClock(61000); f.fireIntervals(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        refuse = false; document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(2); expect(writer.mock.calls[1][0]).toBe(packet);
        expect(scene.auroraVictory.phase).toBe('saved'); expect(scene.levelCompletionResult.time).toBe(2800);
        advance(3000); expect(rewards().root.isConnected).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('lost acknowledgement requires exact stored bytes; repeated source timers cannot grant twice', () => {
        const value = create(), { f, scene, advance, rewards } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => { const result = set(key, data); if (key === f.state.saveKey) { primary++; throw Error('SYNTHETIC_LOST_ACK'); } return result; };
        scene.onBossDefeated(); const withdrawal = timer(scene, 1800); advance(1800); const message = timer(scene, 3000);
        withdrawal(); withdrawal(); advance(3000); message(); message();
        expect(rewards().root.isConnected).toBe(true); expect(primary).toBe(1); expect(scene.showBossVictory()).toBe(true);
        expect(scene.onBossDefeated()).toBe(false); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['admission', 'shutdown', 'clock', 'world', 'lifetime', 'player', 'artwork', 'art-body', 'art-world', 'art-object',
        'art-destroy', 'target', 'target-body', 'target-world', 'target-object', 'target-destroy', 'business', 'creature', 'cloud', 'method'])(
        '%s change before save cannot receive the old completion', kind => {
            const value = create(), { f, scene, boss, bodyActor, advance } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
            scene.onBossDefeated(); const callback = timer(scene, 1800);
            if (kind === 'admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-next-campaign' });
            if (kind === 'shutdown') scene.events.emit('shutdown');
            if (kind === 'clock') scene.time = {};
            if (kind === 'world') scene.physics.world = {};
            if (kind === 'lifetime') scene.completionSaveLifetime = {};
            if (kind === 'player') scene.player = value.actor();
            if (kind === 'artwork') scene.boss = value.actor();
            if (kind === 'art-body') boss.body = { ...boss.body };
            if (kind === 'art-world') boss.body.world = {};
            if (kind === 'art-object') boss.body.gameObject = {};
            if (kind === 'art-destroy') boss.body.destroy = jest.fn();
            if (kind === 'target') scene.bossBody = value.actor();
            if (kind === 'target-body') bodyActor.body = { ...bodyActor.body };
            if (kind === 'target-world') bodyActor.body.world = {};
            if (kind === 'target-object') bodyActor.body.gameObject = {};
            if (kind === 'target-destroy') bodyActor.body.destroy = jest.fn();
            if (kind === 'business') f.state.state.player.cosmicCoins += 7;
            if (kind === 'creature') f.state.state.creature.id = 'synthetic-other-creature';
            if (kind === 'cloud') f.selected.CloudSave = { campaignEpoch: 2, currentUser: { id: 'synthetic-other' } };
            if (kind === 'method') scene.showBossVictory = jest.fn();
            const raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(f.state.state), replacement = scene.bossBody;
            callback(); advance(2000);
            expect(writer).not.toHaveBeenCalled(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
            expect(scene.levelCompletionResult).toBeNull(); expect(scene.residentReleaseOpen).not.toBe(true);
            if (kind === 'target') expect(replacement.active).toBe(true);
        });

    test.each(['body', 'world', 'object'])('backup-observer %s substitution cannot reach the primary writer', kind => {
        const value = create(), { f, scene, bodyActor, advance } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey) primary++; return set(key, data); };
        f.state.on('saveBackupCreated', () => {
            if (kind === 'body') bodyActor.body = { ...bodyActor.body };
            if (kind === 'world') bodyActor.body.world = {};
            if (kind === 'object') bodyActor.body.gameObject = {};
        });
        const raw = f.storage.getItem(f.state.saveKey); scene.onBossDefeated(); advance(1800);
        expect(primary).toBe(0); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(scene.levelCompletionResult).toBeNull();
    });

    test('a Guardian notification admitting a successor cannot publish the rest of the old journey', () => {
        const value = create(), { f, scene, advance } = value; let successor;
        const off = f.state.on('changed:combat.bossesDefeated', () => {
            off(); f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-notification-successor' });
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), bytes: JSON.stringify(f.state.state) };
        });
        scene.onBossDefeated(); advance(1800); advance(3000);
        expect(successor).toBeDefined(); expect(f.state.state).toBe(successor.root); expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw);
        expect(JSON.stringify(f.state.state)).toBe(successor.bytes); expect(scene.residentReleaseOpen).not.toBe(true);
    });

    test('normal media/accounting before and after verification does not strand the saved message', () => {
        const value = create(), { f, scene, advance, rewards } = value;
        scene.onBossDefeated(); advance(900); f.state.set('story.companionMedia', { synthetic: 'before' }); expect(f.state.save()).toBe(true);
        advance(900); f.state.set('story.companionMedia', { synthetic: 'after' }); expect(f.state.save()).toBe(true);
        advance(3000); expect(rewards().root.isConnected).toBe(true); expect(f.state.get('story.companionMedia')).toEqual({ synthetic: 'after' });
    });

    test.each(['target', 'body', 'world', 'object'])('saved-stage %s replacement gets no old cleanup and offers presentation-only recovery', kind => {
        const value = create(), { f, scene, bodyActor, advance, rewards } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.onBossDefeated(); advance(1800);
        if (kind === 'target') scene.bossBody = value.actor();
        if (kind === 'body') bodyActor.body = { ...bodyActor.body };
        if (kind === 'world') bodyActor.body.world = {};
        if (kind === 'object') bodyActor.body.gameObject = {};
        const replacement = scene.bossBody; advance(3000);
        expect(replacement.active).toBe(true); expect(scene.residentReleaseOpen).not.toBe(true);
        expect(document.querySelector('[data-completion-save-recovery]')).not.toBeNull();
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(rewards().root.isConnected).toBe(true); expect(writer).toHaveBeenCalledTimes(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('saved-stage campaign replacement removes old text, timers and presentation without touching the successor', () => {
        const value = create(), { f, scene, advance } = value;
        scene.onBossDefeated(); advance(1800); const text = scene.auroraVictory.ownedText;
        f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-during-message' });
        const raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(f.state.state); advance(3000);
        expect(text.active).toBe(false); expect(scene.auroraVictory.retired).toBe(true); expect(scene.auroraVictory.timers.size).toBe(0);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
        expect(scene.residentReleaseOpen).not.toBe(true); expect(document.querySelector('[data-completion-save-recovery]')).toBeNull();
    });

    test('replacement Glow and HUD are not destroyed or repainted by the old borrowed effects', () => {
        const value = create(), { scene, advance } = value, glow = scene.bossGlow, ui = scene.bossUI;
        scene.onBossDefeated(); advance(1); advance(100); const alpha = ui.alpha;
        scene.bossGlow = value.object(); scene.bossUI = value.object(); const replacement = scene.bossGlow, hud = scene.bossUI;
        advance(1699); expect(glow.active).toBe(true); expect(replacement.active).toBe(true);
        expect(ui.alpha).toBe(alpha); expect(hud.alpha).toBe(1);
    });

    test('missing or faulty cosmetic artwork cannot discard the current earned result', () => {
        for (const mode of ['missing', 'listener-failure']) {
            const value = create(), { scene, boss } = value;
            scene.onBossDefeated();
            if (mode === 'missing') boss.destroy();
            else boss.once('destroy', () => { throw Error('SYNTHETIC_COSMETIC_FAILURE'); });
            expect(finish(value).root.isConnected).toBe(true);
        }
    });

    test('native destruction cannot clear a replacement target or automatically show the old reward panel', () => {
        const value = create(), { f, scene, bodyActor, advance } = value; let replacement;
        scene.onBossDefeated(); advance(1800);
        bodyActor.once('destroy', () => { replacement = scene.bossBody = value.actor(); });
        advance(3000); expect(replacement.active).toBe(true); expect(scene.bossBody).toBe(replacement);
        expect(f.state.get('levels.auroraDepths.completed')).toBe(true); expect(scene.residentReleaseOpen).not.toBe(true);
        expect(document.querySelector('[data-completion-save-recovery]')).not.toBeNull();
    });

    test('24 original warm-light effects are owned, animate through native tweens and retire with the message', () => {
        const value = create(), { scene, advance, tweens } = value, unrelated = value.object();
        const graphics = jest.spyOn(scene.add, 'graphics');
        const other = tweens.add({ targets: unrelated, alpha: 0.4, duration: 20000 });
        scene.onBossDefeated(); advance(0); for (let i = 0; i < 23; i++) advance(50);
        expect(graphics).toHaveBeenCalledTimes(24);
        const effects = [...scene.auroraVictory.ownedEffects]; expect(effects.length).toBeGreaterThan(0);
        const remaining = effects.find(effect => effect.active); const y = remaining.y; advance(50); expect(remaining.y).toBeLessThan(y);
        advance(600); advance(3000);
        expect(scene.auroraVictory.ownedEffects.size).toBe(0); expect(effects.every(effect => !effect.active)).toBe(true);
        expect(other.isPlaying()).toBe(true); expect(unrelated.active).toBe(true);
    });

    test('both phases have owned once-only wall fallbacks when the scene clock stalls', () => {
        const value = create(), { f, scene, wallTimers, rewards } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.onBossDefeated();
        const fire = (delay, elapsed) => {
            const record = [...scene.guardianTransitionGuards.values()].find(record => record.sceneTimer?.delay === delay);
            const callback = wallTimers.get(record.wallTimer); f.advanceClock(elapsed); callback(); callback();
        };
        fire(1800, 2400); expect(scene.levelCompletionResult.time).toBe(3400); fire(3000, 3600);
        expect(rewards().root.isConnected).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
    });

    test.each([1800, 3000])('failed %ims scene timer uses its wall fallback rather than an animation callback', delay => {
        const value = create(), { f, scene, wallTimers, rewards } = value, original = scene.time.delayedCall.bind(scene.time);
        let failed = false;
        scene.time.delayedCall = (ms, callback) => { if (ms === delay && !failed) { failed = true; throw Error('SYNTHETIC_TIMER_FAILURE'); } return original(ms, callback); };
        scene.onBossDefeated(); if (delay === 3000) value.advance(1800);
        const callback = [...wallTimers.values()][0]; f.advanceClock(delay + 600); callback();
        if (delay === 1800) value.advance(3000);
        expect(rewards().root.isConnected).toBe(true);
    });

    test('initial freeze cannot recapture a changed business source', () => {
        const { f, scene } = create(), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.endInvincibility.mockImplementation(() => { f.state.state.player.cosmicCoins += 7; });
        expect(scene.onBossDefeated()).toBe(false); expect(scene.auroraVictory.retired).toBe(true); expect(writer).not.toHaveBeenCalled();
    });
});
