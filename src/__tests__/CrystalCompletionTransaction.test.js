const { fixture, factsFor, installNativeRelease, epoch } = require('./support/levelCompletionFixture.cjs');
const TweenManager = require('phaser/src/tweens/TweenManager');

describe('actual Crystal final-hit, timed story, verified save and delayed rewards', () => {
    let owned;
    beforeEach(() => { owned = []; document.body.innerHTML = ''; });
    afterEach(() => {
        for (const { f, scene, release } of owned) {
            scene.events.emit('shutdown'); scene.cancelGuardianTransitions(); scene.regionalVictoryPanel?.destroy();
            release.close(); f.close();
        }
        jest.restoreAllMocks(); document.body.innerHTML = '';
    });
    function create(options = {}) {
        const f = fixture({ level: 1, controlledTimers: true, ...options }); f.context.document = document;
        const wallTimers = new Map(); let wallId = 0;
        Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
            addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
            setTimeout: callback => { wallTimers.set(++wallId, callback); return wallId; }, clearTimeout: id => wallTimers.delete(id) });
        f.selected.AudioManager.playLevelUp = () => f.effects.push({ kind: 'audio', name: 'playLevelUp' });
        const scene = new f.api.NativeCrystal(factsFor(1), f.effects), release = installNativeRelease(f, scene);
        scene.physics.pause = () => { scene.physics.world.isPaused = true; };
        scene.player.setVelocity = jest.fn(() => scene.player);
        const boss = scene.boss = release.object(); boss.x = 5250; boss.y = 400; boss.alpha = boss.scaleX = boss.scaleY = 1;
        boss.body = { gameObject: boss, world: scene.physics.world, enable: true, destroy: jest.fn(), setAllowGravity: jest.fn() };
        for (const name of ['setVelocity', 'setTint', 'clearTint']) boss[name] = jest.fn(() => boss);
        for (const name of ['crystalCore', 'bossUI', 'bossOverlay', 'bossPulseText', 'bossCorruptionShell']) scene[name] = release.object(name);
        const advance = delta => { f.advanceClock(delta); release.advance(delta); };
        const value = { f, scene, release, boss, wallTimers, advance }; owned.push(value); return value;
    }
    const complete = value => { value.advance(2000); value.advance(3000); };
    const rewards = value => {
        value.advance(1500);
        if (value.scene.residentReleaseOpen) { value.scene.residentReleaseClose(); value.advance(100); }
        return value.scene.regionalVictoryPanel;
    };

    test('real final hit keeps a living Guardian, original clocks and one verified packet before actual rewards/Continue', () => {
        const value = create(), { f, scene, boss, advance } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.onBossDefeated()).toBe(true); expect(scene.physics.world.isPaused).toBe(true);
        expect(scene.completionGuardianAt).toBe(epoch); expect(boss.body.enable).toBe(false);
        expect(writer).not.toHaveBeenCalled(); expect(f.state.get('levels.crystalCaves.completed')).toBe(false);
        advance(2000); expect(scene.crystalVictory.phase).toBe('message'); expect(writer).not.toHaveBeenCalled();
        advance(2999); expect(writer).not.toHaveBeenCalled(); advance(1);
        expect(writer).toHaveBeenCalledTimes(1); expect(scene.completionSaveAttempt.phase).toBe('committed');
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(f.state.get('levels.crystalCaves.completed')).toBe(true);
        expect(f.state.get('hubWorld.shipParts.collected')).toContain('crystal_core'); expect(scene.levelCompletionResult.time).toBe(6000);
        expect(f.state.get('story.projectBeacon.fieldKit.katana.installedUpgrades')).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'crystal_edge', sourceLevelId: 'crystalCaves' })]));
        expect(scene.crystalVictory.phase).toBe('saved'); expect(scene.boss).toBe(boss); expect(boss.active).toBe(true);
        advance(1499); expect(scene.regionalVictoryPanel).toBeUndefined(); advance(1);
        expect(scene.residentReleaseOpen).toBe(true); scene.residentReleaseClose(); advance(100);
        expect(scene.regionalVictoryPanel.root.isConnected).toBe(true); expect(scene.crystalVictoryShown).toBe(true);
        scene.regionalVictoryPanel.button.click(); scene.regionalVictoryPanel?.button.click();
        expect(scene.transitions).toHaveLength(1); expect(scene.transitions[0].name).toBe('GameScene');
        expect(writer).toHaveBeenCalledTimes(1);
    });

    test('missing optional tweens cannot block completion, and Guardian and completion event times remain distinct', () => {
        const value = create(), { f, scene } = value; scene.tweens.add = () => { throw Error('SYNTHETIC_TWEEN_FAILURE'); };
        expect(scene.onBossDefeated()).toBe(true); complete(value); expect(rewards(value).root.isConnected).toBe(true);
        const eventTime = path => f.notifications.find(packet => packet.event === 'stateChanged' && packet.data.path === path).data.timestamp;
        expect(eventTime('combat.bossesDefeated')).toBe(epoch);
        expect(eventTime('story.projectBeacon.expeditionCheckpoint')).toBe(epoch + 5000);
    });

    test('refused completion write freezes rewards and retries the exact existing packet without recalculating its times', () => {
        const value = create(), { f, scene } = value; f.state.startAutoSave();
        const raw = f.storage.getItem(f.state.saveKey), set = f.storage.setItem; let refuse = true;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, data); };
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.onBossDefeated()).toBe(true); complete(value);
        expect(scene.completionSaveAttempt.phase).toBe('prepared'); expect(f.state.get('combat.bossesDefeated')).toBe(0);
        expect(scene.levelCompletionResult).toBeNull(); expect(scene.residentReleaseOpen).not.toBe(true);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); const packet = writer.mock.calls[0][0];
        f.advanceClock(61000); f.fireIntervals(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        refuse = false; document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(2); expect(writer.mock.calls[1][0]).toBe(packet);
        expect(scene.levelCompletionResult.time).toBe(6000); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(rewards(value).root.isConnected).toBe(true); expect(scene.onBossDefeated()).toBe(false);
    });

    test('normal autosave accounting and existing synthetic media before first capture do not strand the story', () => {
        const value = create(), { f, scene } = value;
        expect(scene.onBossDefeated()).toBe(true); value.advance(2000);
        f.state.set('story.companionMedia', { synthetic: true }); expect(f.state.save()).toBe(true);
        value.advance(3000); expect(scene.completionSaveAttempt.phase).toBe('committed');
        expect(f.state.get('story.companionMedia')).toEqual({ synthetic: true }); expect(rewards(value).root.isConnected).toBe(true);
    });

    test('a changed source during the initial freeze cannot become the later completion source', () => {
        const { f, scene } = create(), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.endInvincibility = () => { f.state.state.player.cosmicCoins += 7; };
        const raw = f.storage.getItem(f.state.saveKey);
        expect(scene.onBossDefeated()).toBe(false); expect(scene.crystalVictory.retired).toBe(true);
        expect(writer).not.toHaveBeenCalled(); expect(scene.guardianTransitionGuards.size).toBe(0);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
    });

    test('lost acknowledgement requires exact bytes and cannot count the Guardian twice', () => {
        const value = create(), { f, scene } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => {
            const returned = set(key, data);
            if (key === f.state.saveKey) { primary++; throw Error('SYNTHETIC_LOST_ACK'); }
            return returned;
        };
        expect(scene.onBossDefeated()).toBe(true); complete(value); expect(rewards(value).root.isConnected).toBe(true);
        expect(scene.showCompletionScreen()).toBe(true); expect(primary).toBe(1);
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['admission', 'shutdown', 'clock', 'world', 'player', 'boss', 'boss-body', 'boss-world', 'boss-object', 'boss-destroy', 'business', 'creature', 'lifetime', 'method'])(
        '%s replacement before completion receives no old save or rewards', kind => {
            const value = create(), { f, scene, boss } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
            expect(scene.onBossDefeated()).toBe(true); value.advance(2000);
            if (kind === 'admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-next-campaign' });
            if (kind === 'shutdown') scene.events.emit('shutdown');
            if (kind === 'clock') scene.time = {};
            if (kind === 'world') scene.physics.world = {};
            if (kind === 'player') scene.player = { ...scene.player };
            if (kind === 'boss') scene.boss = { ...boss };
            if (kind === 'boss-body') boss.body = { ...boss.body };
            if (kind === 'boss-world') boss.body.world = {};
            if (kind === 'boss-object') boss.body.gameObject = {};
            if (kind === 'boss-destroy') boss.destroy = jest.fn();
            if (kind === 'business') f.state.state.player.cosmicCoins += 7;
            if (kind === 'creature') f.state.state.creature.id = 'synthetic-other-creature';
            if (kind === 'lifetime') scene.completionSaveLifetime = {};
            if (kind === 'method') scene.onLevelComplete = jest.fn();
            const raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(f.state.state);
            value.advance(3000); expect(writer).not.toHaveBeenCalled(); expect(scene.levelCompletionResult).toBeNull();
            expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
            expect(scene.residentReleaseOpen).not.toBe(true);
        });

    test.each(['bossUI', 'bossOverlay', 'boss-body', 'admission'])(
        'delayed optional tween cannot mutate or destroy a replaced %s', kind => {
            const value = create(), { f, scene, boss } = value, tweens = [];
            scene.tweens.add = config => { const tween = { config, stop: jest.fn() }; tweens.push(tween); return tween; };
            expect(scene.onBossDefeated()).toBe(true);
            const ui = scene.bossUI, overlay = scene.bossOverlay;
            const old = { boss: { alpha: boss.alpha, scaleX: boss.scaleX }, ui: ui.alpha, overlay: overlay.alpha };
            if (kind === 'bossUI') scene.bossUI = value.release.object('replacement-ui');
            if (kind === 'bossOverlay') scene.bossOverlay = value.release.object('replacement-overlay');
            if (kind === 'boss-body') boss.body = { ...boss.body };
            if (kind === 'admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-during-fade' });
            for (const { config } of tweens) { config.targets.progress = 1; config.onUpdate?.(); config.onComplete?.(); }
            if (kind === 'bossUI') { expect(ui.alpha).toBe(old.ui); expect(ui.active).toBe(true); expect(scene.bossUI.active).toBe(true); }
            if (kind === 'bossOverlay') { expect(overlay.alpha).toBe(old.overlay); expect(overlay.active).toBe(true); expect(scene.bossOverlay.active).toBe(true); }
            if (kind === 'boss-body' || kind === 'admission') {
                expect(boss.alpha).toBe(old.boss.alpha); expect(boss.scaleX).toBe(old.boss.scaleX);
                expect(ui.active).toBe(true); expect(overlay.active).toBe(true);
            }
        });

    test('native TweenManager animates original borrowed UI but cannot write it after a slot replacement', () => {
        const { scene } = create(), manager = new TweenManager(scene);
        scene.tweens = manager; manager.getDelta = () => 100;
        const original = scene.bossUI; original.alpha = 1;
        try {
            expect(scene.onBossDefeated()).toBe(true);
            manager.step(true); manager.step(true);
            expect(original.alpha).toBeLessThan(1); expect(original.alpha).toBeGreaterThan(0);
            const captured = original.alpha;
            scene.bossUI = { alpha: 0.77, active: true };
            for (let i = 0; i < 12; i++) manager.step(true);
            expect(original.alpha).toBe(captured); expect(original.active).toBe(true); expect(scene.bossUI.alpha).toBe(0.77);
        } finally { manager.destroy(); }
    });

    test('original wall fallbacks advance a stalled scene clock once without duplicate grants', () => {
        const value = create(), { f, scene, wallTimers } = value, writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.onBossDefeated()).toBe(true);
        const fire = (key, elapsed) => {
            const record = scene.guardianTransitionGuards.get(key), callback = wallTimers.get(record.wallTimer);
            f.advanceClock(elapsed); callback(); callback();
        };
        fire('crystal-victory-message', 2600); fire('crystal-victory-completion', 3600);
        expect(writer).toHaveBeenCalledTimes(1); expect(scene.levelCompletionResult.time).toBe(7200);
        fire('crystal-victory-rewards', 2100);
        expect(scene.residentReleaseOpen).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
    });

    test('fallback still exists when the scene timer cannot be scheduled', () => {
        const value = create(), { f, scene, wallTimers } = value;
        scene.time.delayedCall = () => { throw Error('SYNTHETIC_CLOCK_FAILURE'); };
        expect(scene.onBossDefeated()).toBe(true);
        const tick = elapsed => { const first = [...wallTimers.entries()][0]; f.advanceClock(elapsed); first[1](); };
        tick(2600); expect(scene.crystalVictory.phase).toBe('message');
        // Optional resonance timers may still be pending. Drain each owned stage
        // once; no callback may recreate a completion calculation.
        for (let n = 0; n < 30 && scene.crystalVictory.phase !== 'saved'; n++) tick(100);
        expect(scene.completionSaveAttempt.phase).toBe('committed');
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });
});
