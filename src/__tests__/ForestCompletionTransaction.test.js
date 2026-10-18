const { fixture, factsFor, installNativeRelease } = require('./support/levelCompletionFixture.cjs');

describe('actual Forest completion caller and recovery through the actual local writer', () => {
    let owned;
    beforeEach(() => { owned = []; document.body.innerHTML = ''; });
    afterEach(() => {
        for (const { f, scene, release } of owned) {
            scene.events.emit('shutdown'); scene.regionalVictoryPanel?.destroy(); release?.close(); f.close();
        }
        jest.restoreAllMocks(); document.body.innerHTML = '';
    });
    function create(options = {}) {
        const f = fixture({ controlledTimers: true, ...options });
        f.context.document = document;
        Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
            addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) });
        f.selected.AudioManager.playLevelUp = () => f.effects.push({ kind: 'audio', name: 'playLevelUp' });
        const scene = new f.api.NativeForest(factsFor(0), f.effects);
        const release = options.nativeRelease ? installNativeRelease(f, scene) : null;
        owned.push({ f, scene, release });
        return { f, scene, release };
    }

    test('first Forest victory publishes all rewards once before showing the actual DOM summary', () => {
        const { f, scene } = create();
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        const show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementation(function (...args) {
            expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels.mythicalForest.completed).toBe(true);
            expect(f.state.get('combat.bossesDefeated')).toBe(1);
            expect(f.persistenceEvents.filter(value => value.event === 'saved')).toHaveLength(1);
            expect(f.selected.AchievementSystem.hasHatchProgressSource(f.state)).toBe(true);
            return show.apply(this, args);
        });
        expect(scene.showBossVictory()).toBe(true);
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(f.state.get('levels.mythicalForest.completed')).toBe(true);
        expect(scene.forestCompletionAttempt.phase).toBe('presented'); expect(scene.forestVictoryShown).toBe(true);
        expect(scene._levelProgressionRecorded).toBe(true); expect(document.querySelector('[data-testid="expedition-debrief"]')).not.toBeNull();
        expect(f.selected.AchievementSystem.pendingClaims.some(value => value.id === 'boss_slayer')).toBe(true);
        expect(f.selected.AchievementSystem.hasHatchProgressSource(f.state)).toBe(true);
        expect(f.persistenceEvents.filter(value => value.event === 'saved')).toHaveLength(1);
        expect(f.calls).toEqual([]); expect(writer).toHaveBeenCalledTimes(1);
        expect(scene.showBossVictory()).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('an unchanged refused save retains the exact packet, skips interval autosave and retries through its real button', () => {
        const { f, scene } = create(); f.state.startAutoSave();
        const original = f.state.state, raw = f.storage.getItem(f.state.saveKey), set = f.storage.setItem;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft'); let refuse = true;
        f.storage.setItem = (key, value) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, value); };
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('prepared');
        expect(scene.forestVictoryShown).toBe(false); expect(scene._levelProgressionRecorded).toBe(false); expect(scene.levelCompletionResult).toBeNull();
        expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
        expect(document.querySelector('[data-completion-save-recovery="save"]')).not.toBeNull();
        const staged = writer.mock.calls[0][0];
        f.advanceClock(61000); f.fireIntervals(); f.fireIntervals();
        expect(f.calls).toEqual([]); expect(f.state.state).toBe(original); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        refuse = false;
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(scene.forestCompletionAttempt.phase).toBe('presented'); expect(writer).toHaveBeenCalledTimes(2);
        expect(writer.mock.calls[1][0]).toBe(staged); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(f.state.get('player.playTime')).toBe(61000);
        expect(document.querySelector('[data-completion-save-recovery]')).toBeNull();
        expect(document.querySelector('[data-testid="expedition-debrief"]')).not.toBeNull();
        f.advanceClock(1000); f.fireIntervals(); expect(f.calls).toEqual([{ save: true }]);
        expect(scene.showBossVictory()).toBe(true); expect(writer).toHaveBeenCalledTimes(2); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('a committed write with a lost acknowledgement still opens rewards without another grant', () => {
        const { f, scene } = create(), set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, value) => { const result = set(key, value); if (key === f.state.saveKey) { primary++; throw Error('SYNTHETIC_LOST_ACK'); } return result; };
        expect(scene.showBossVictory()).toBe(true); expect(primary).toBe(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(scene.showBossVictory()).toBe(true); expect(primary).toBe(1);
    });

    test('a failed real DOM summary retries presentation only, with autosave deferred until it opens', () => {
        const { f, scene } = create(); f.state.startAutoSave();
        const show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementationOnce(() => { throw Error('SYNTHETIC_PRESENTATION_FAILURE'); })
            .mockImplementation(function (...args) { return show.apply(this, args); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('committed');
        const raw = f.storage.getItem(f.state.saveKey);
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(scene.forestVictoryShown).toBe(true);
        expect(document.querySelector('[data-completion-save-recovery="presentation"]')).not.toBeNull();
        f.advanceClock(61000); f.fireIntervals(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.calls).toEqual([]);
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(1); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(document.querySelector('[data-testid="expedition-debrief"]')).not.toBeNull(); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(scene.forestCompletionAttempt.phase).toBe('presented');
    });

    test('partial release graphics are retired before retrying the presentation, never the reward transaction', () => {
        const { f, scene } = create(); let fail = true, retired = 0;
        scene.showRescuedResidentReleaseMoment = () => {
            if (!fail) return false;
            fail = false; scene.residentReleaseOpen = true;
            scene.residentReleasePresentation = { retire: () => { retired++; scene.residentReleaseOpen = false; scene.residentReleasePresentation = null; } };
            scene.forestCompletionAttempt.ownRelease(scene.residentReleasePresentation);
            throw Error('SYNTHETIC_RELEASE_GRAPHICS');
        };
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(retired).toBe(1); expect(scene.residentReleaseOpen).toBe(false);
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(scene.forestCompletionAttempt.phase).toBe('presented'); expect(writer).toHaveBeenCalledTimes(1);
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['player', 'body', 'input', 'camera', 'encounter', 'scene-registration', 'memory-alias', 'service', 'domain-method', 'reward-config'])(
        '%s replacement in the backup observer prevents primary dispatch and never rebases', kind => {
            const { f, scene } = create(), before = JSON.stringify(f.state.state), root = f.state.state, raw = f.storage.getItem(f.state.saveKey);
            const set = f.storage.setItem; let primary = 0;
            f.storage.setItem = (key, value) => { if (key === f.state.saveKey) primary++; return set(key, value); };
            f.state.on('saveBackupCreated', () => {
                if (kind === 'player') scene.player = { ...scene.player };
                if (kind === 'body') scene.player.body = { ...scene.player.body };
                if (kind === 'input') scene.input = { ...scene.input };
                if (kind === 'camera') scene.cameras.main = { ...scene.cameras.main };
                if (kind === 'encounter') scene.guardianEncounter = { ...scene.guardianEncounter };
                if (kind === 'scene-registration') scene.sys.game.scene = { getScene: () => scene };
                if (kind === 'memory-alias') f.state.state.stats = { ...f.state.state.stats };
                if (kind === 'service') f.selected.InventoryManager = {};
                if (kind === 'domain-method') f.selected.GuardianOutcomes = { ...f.selected.GuardianOutcomes, recordGuardianOutcome() {} };
                if (kind === 'reward-config') f.api.bossConfigs.elderTreant.rewards.baseCoins++;
            });
            expect(scene.showBossVictory()).toBe(false); expect(primary).toBe(0); expect(f.state.state).toBe(root);
            expect(JSON.stringify(f.state.state)).toBe(before); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
            expect(scene.forestVictoryShown).toBe(false); expect(scene.levelCompletionResult).toBeNull();
            expect(scene.forestCompletionAttempt.phase).toBe('protected');
            expect(scene.showBossVictory()).toBe(false); expect(primary).toBe(0);
        });

    test.each(['backup', 'ordinary', 'saved'])('%s observer admitting a new campaign receives no later old work or reward screen', point => {
        const { f, scene } = create(); let successor;
        const event = { backup: 'saveBackupCreated', ordinary: 'changed:combat.bossesDefeated', saved: 'saved' }[point];
        const off = f.state.on(event, () => {
            off(); const incoming = f.state.createInitialState(); incoming.player.cosmicCoins = 77;
            expect(f.state.applyExternalSave(incoming, { source: 'synthetic-new-campaign' })).toBe(true);
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), memory: JSON.stringify(f.state.state), admission: f.state.saveAdmission };
        });
        expect(scene.showBossVictory()).toBe(false); expect(successor).toBeDefined();
        expect(f.state.state).toBe(successor.root); expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw);
        expect(JSON.stringify(f.state.state)).toBe(successor.memory); expect(f.state.saveAdmission).toBe(successor.admission);
        expect(scene.levelCompletionResult).toBeNull(); expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
        expect(document.querySelector('[data-completion-save-recovery]')).toBeNull(); expect(scene.showBossVictory()).toBe(false);
    });

    test('shutdown releases only the owned autosave pause and stale retry buttons do nothing', () => {
        const { f, scene } = create(); f.state.startAutoSave(); const set = f.storage.setItem; let refuse = true;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        f.storage.setItem = (key, value) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, value); };
        expect(scene.showBossVictory()).toBe(false); const button = document.querySelector('[data-completion-save-recovery] button');
        scene.events.emit('shutdown'); expect(scene.forestCompletionAttempt.phase).toBe('retired');
        expect(document.querySelector('[data-completion-save-recovery]')).toBeNull(); refuse = false;
        f.advanceClock(1000); f.fireIntervals(); expect(f.calls).toEqual([{ save: true }]);
        button.click(); expect(writer).toHaveBeenCalledTimes(1); expect(f.state.get('levels.mythicalForest.completed')).toBe(false);
    });

    test('actual summary Continue remains usable after later ordinary autosave and only routes once', () => {
        const { f, scene } = create(); f.state.startAutoSave();
        expect(scene.showBossVictory()).toBe(true); f.advanceClock(31000); f.fireIntervals();
        const button = document.querySelector('[data-testid="expedition-debrief-continue"]'); button.click(); button.click();
        expect(scene.transitions).toHaveLength(1); expect(scene.transitions[0].name).toBe('GameScene');
        expect(scene.transitions[0].data.shipReconstructionHandoff).toBe(true);
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
    });

    test.each(['missing', 'malformed', 'future-version'])('%s original saved data is protected, not overwritten by completion', kind => {
        const { f, scene } = create(), root = f.state.state;
        if (kind === 'missing') f.storage.removeItem(f.state.saveKey);
        if (kind === 'malformed') f.storage.setItem(f.state.saveKey, '{synthetic-unreadable');
        if (kind === 'future-version') {
            const stored = JSON.parse(f.storage.getItem(f.state.saveKey)); stored.version = '999.0.0'; f.storage.setItem(f.state.saveKey, JSON.stringify(stored));
        }
        const raw = f.storage.getItem(f.state.saveKey), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(writer).not.toHaveBeenCalled();
        expect(f.state.state).toBe(root); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.state.get('levels.mythicalForest.completed')).toBe(false); expect(scene.levelCompletionResult).toBeNull();
    });

    test('absent optional services use the original local fallbacks without inventing a Guardian count', () => {
        const { f, scene } = create({ mode: 'fallbacks' });
        expect(scene.showBossVictory()).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(0);
        expect(f.state.get('levels.mythicalForest.completed')).toBe(true); expect(f.state.get('inventory.pendingBossRewards')).toHaveLength(1);
    });
    test('a legitimate replay awards one battle and bond increment without another campaign count', () => {
        const { f, scene } = create({ seed: ({ complete, selected }) => {
            complete(factsFor(0)); selected.AchievementSystem.recordEvent('guardian_restored', {});
        } });
        const beforeCount = f.state.get('stats.levelsCompleted'), beforeBond = f.state.get('creature.bond.experience');
        expect(scene.showBossVictory()).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(2);
        expect(f.state.get('stats.levelsCompleted')).toBe(beforeCount); expect(f.state.get('creature.bond.experience')).toBe(beforeBond + 10);
        expect(scene.levelCompletionResult.firstCompletion).toBe(false);
    });

    test('a replacement presentation is never destroyed or covered by the old attempt', () => {
        const { f, scene } = create(), show = f.api.ExpeditionDebriefPanel.prototype.show;
        const replacement = { destroy: jest.fn() };
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementation(function (...args) {
            const result = show.apply(this, args); scene.regionalVictoryPanel = replacement; return result;
        });
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('retired');
        expect(replacement.destroy).not.toHaveBeenCalled(); expect(scene.regionalVictoryPanel).toBe(replacement);
        expect(document.querySelector('[data-completion-save-recovery]')).toBeNull();
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('a new admitted campaign after presentation removes only the old owned panel', () => {
        const { f, scene } = create(); expect(scene.showBossVictory()).toBe(true);
        const panel = scene.regionalVictoryPanel;
        const incoming = f.state.createInitialState(); incoming.player.cosmicCoins = 77;
        expect(f.state.applyExternalSave(incoming, { source: 'synthetic-after-presentation' })).toBe(true);
        expect(panel.root).toBeNull(); expect(scene.forestCompletionAttempt.phase).toBe('retired');
        expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
        expect(f.state.get('player.cosmicCoins')).toBe(77); expect(scene.showBossVictory()).toBe(false);
    });

    test.each(['owned', 'unowned', 'wrong-payload', 'mutation'])('%s later lease preserves the exact read-only presentation policy', kind => {
        let cloud;
        const { f, scene } = create({ beforeServices: ({ selected, state }) => {
            cloud = { gameState: state, campaignEpoch: 1, currentUser: { id: 'synthetic-review-user' }, activeCloudWrite: null };
            selected.CloudSave = cloud;
        } });
        const show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementationOnce(() => { throw Error('SYNTHETIC_PRESENTATION_FAILURE'); })
            .mockImplementation(function (...args) { return show.apply(this, args); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('committed');
        const payload = f.state.createSaveSnapshot();
        if (kind === 'wrong-payload') payload.player.cosmicCoins = 77;
        const lease = f.state.beginCloudWrite(kind === 'mutation' ? 'mutation' : 'upload', payload,
            () => f.selected.CloudSave === cloud && cloud.campaignEpoch === 1);
        if (kind !== 'unowned') cloud.activeCloudWrite = lease;
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(1); expect(f.state.cloudWriteLease).toBe(lease);
        expect(Boolean(document.querySelector('[data-testid="expedition-debrief"]'))).toBe(kind === 'owned');
        expect(scene.forestCompletionAttempt.phase).toBe(kind === 'owned' ? 'presented' : 'committed');
        expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels.mythicalForest.completed).toBe(true);
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('an interrupted cache publication protects its durable data and never retries a grant', () => {
        const { f, scene } = create(); let armed = false;
        const manager = f.selected.AchievementSystem, id = Object.keys(manager.definitions)[0], actual = manager.definitions[id];
        manager.definitions[id] = new Proxy(actual, { set(target, key, value) {
            Reflect.set(target, key, value);
            if (armed && key === 'progress') throw Error('SYNTHETIC_CACHE_PUBLICATION');
            return true;
        } });
        const off = f.state.on('saveBackupCreated', () => { off(); armed = true; });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(writer).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels.mythicalForest.completed).toBe(true);
        expect(f.state.getSaveAdmission().status).toBe('held'); expect(scene.levelCompletionResult).toBeNull();
        expect(scene.showBossVictory()).toBe(false); expect(writer).toHaveBeenCalledTimes(1);
    });

    test('presentation retry can follow an ordinary saved media reference without recapturing a write source', () => {
        const { f, scene } = create(), show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementationOnce(() => { throw Error('SYNTHETIC_PRESENTATION_FAILURE'); })
            .mockImplementation(function (...args) { return show.apply(this, args); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('committed');
        f.state.set('creature.syntheticMediaReference', { assetRef: '/synthetic/ready.png' }); expect(f.state.save()).toBe(true);
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(scene.forestCompletionAttempt.phase).toBe('presented'); expect(writer).toHaveBeenCalledTimes(1);
        expect(f.state.get('creature.syntheticMediaReference.assetRef')).toBe('/synthetic/ready.png');
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('an already-owned upload finishes before the first packet is calculated, without bypassing its lease', () => {
        let cloud;
        const { f, scene } = create({ beforeServices: ({ selected, state }) => {
            cloud = { gameState: state, campaignEpoch: 1, currentUser: { id: 'synthetic-review-user' }, activeCloudWrite: null };
            selected.CloudSave = cloud;
        } });
        f.state.startAutoSave();
        const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true); cloud.activeCloudWrite = lease;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        const raw = f.storage.getItem(f.state.saveKey), root = f.state.state;
        expect(scene.showBossVictory()).toBe(false); expect(scene.forestCompletionAttempt.phase).toBe('waiting');
        expect(writer).not.toHaveBeenCalled(); expect(f.state.state).toBe(root);
        expect(document.querySelector('[data-completion-save-recovery] h1').textContent).toBe('Finishing your save');
        f.advanceClock(61000); f.fireIntervals();
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).not.toHaveBeenCalled(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(1); expect(scene.forestCompletionAttempt.phase).toBe('presented');
        expect(f.state.get('combat.bossesDefeated')).toBe(1); expect(f.state.get('player.playTime')).toBe(61000);
        expect(scene.levelCompletionResult.time).toBe(1000);
    });

    test('actual delayed release-close registers its rewards panel for retirement on new admission', () => {
        const { f, scene, release } = create({ nativeRelease: true });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(true); expect(scene.residentReleaseOpen).toBe(true);
        expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
        scene.residentReleaseClose(); release.advance(100);
        const panel = scene.regionalVictoryPanel; expect(panel.root.isConnected).toBe(true);
        const incoming = f.state.createInitialState(); incoming.player.cosmicCoins = 77;
        expect(f.state.applyExternalSave(incoming, { source: 'synthetic-after-delayed-summary' })).toBe(true);
        expect(scene.forestCompletionAttempt.phase).toBe('retired'); expect(panel.root).toBeNull();
        expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
        expect(f.state.get('player.cosmicCoins')).toBe(77); expect(writer).toHaveBeenCalledTimes(1);
    });

    test('actual delayed release retries a failed mount without another write or reward grant', () => {
        const { f, scene, release } = create({ nativeRelease: true }), show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementationOnce(() => { throw Error('SYNTHETIC_DEFERRED_MOUNT'); })
            .mockImplementation(function (...args) { return show.apply(this, args); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.showBossVictory()).toBe(true); const raw = f.storage.getItem(f.state.saveKey);
        scene.residentReleaseClose(); release.advance(100);
        expect(scene.residentReleaseOpen).toBe(true); expect(scene.regionalVictoryPanel).toBeNull();
        scene.residentReleaseClose(); release.advance(100);
        expect(scene.regionalVictoryPanel.root.isConnected).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['replacement-release', 'replacement-continuation', 'new-admission', 'shutdown'])(
        '%s cannot use the captured old deferred summary', kind => {
            const { f, scene, release } = create({ nativeRelease: true });
            expect(scene.showBossVictory()).toBe(true);
            const continuation = scene.pendingResidentReleaseContinuation, owner = scene.residentReleasePresentation;
            scene.residentReleaseClose();
            const replacement = () => false;
            if (kind === 'replacement-release') scene.residentReleasePresentation = { closed: false, retire: jest.fn() };
            if (kind === 'replacement-continuation') scene.pendingResidentReleaseContinuation = replacement;
            if (kind === 'new-admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-before-summary' });
            if (kind === 'shutdown') scene.events.emit('shutdown');
            const raw = f.storage.getItem(f.state.saveKey);
            expect(continuation()).toBe(false); release.advance(100);
            expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
            expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
            if (kind === 'replacement-continuation') expect(scene.pendingResidentReleaseContinuation).toBe(replacement);
            owner.retire();
        });

    test.each(['changed-root', 'changed-raw', 'replacement-lease', 'held-upload', 'unowned-upload', 'mutation'])(
        '%s cannot turn a waiting upload into a freshly authorised completion', kind => {
            let cloud;
            const { f, scene } = create({ beforeServices: ({ selected, state }) => {
                cloud = { gameState: state, campaignEpoch: 1, currentUser: { id: 'synthetic-review-user' }, activeCloudWrite: null };
                selected.CloudSave = cloud;
            } });
            const lease = f.state.beginCloudWrite(kind === 'mutation' ? 'mutation' : 'upload', f.state.createSaveSnapshot(), () => true);
            if (kind !== 'unowned-upload') cloud.activeCloudWrite = lease;
            const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
            expect(scene.showBossVictory()).toBe(false); expect(writer).not.toHaveBeenCalled();
            if (['unowned-upload', 'mutation'].includes(kind)) {
                expect(scene.forestCompletionAttempt.phase).toBe('protected'); return;
            }
            f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
            if (kind === 'changed-root') f.state.state = { ...f.state.state };
            if (kind === 'changed-raw') f.storage.setItem(f.state.saveKey, `${f.storage.getItem(f.state.saveKey)} `);
            if (kind === 'replacement-lease') cloud.activeCloudWrite = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
            if (kind === 'held-upload') f.state.holdSaveAdmission({ code: 'save_unreadable' }, 'synthetic');
            const before = f.storage.getItem(f.state.saveKey);
            document.querySelector('[data-completion-save-recovery] button')?.click();
            expect(writer).not.toHaveBeenCalled(); expect(f.storage.getItem(f.state.saveKey)).toBe(before);
            expect(f.state.get('combat.bossesDefeated')).toBe(0); expect(scene.levelCompletionResult).toBeNull();
            expect(scene.showBossVictory()).toBe(false); expect(writer).not.toHaveBeenCalled();
        });
});
