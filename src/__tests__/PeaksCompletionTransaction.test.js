const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm'), { parse } = require('@babel/parser');
const { fixture, factsFor, clone, installNativeRelease } = require('./support/levelCompletionFixture.cjs');
const oldSource = readPinnedSource('ff7537d8:src/scenes/levels/VoidPeaksLevel.js');
const oldClass = parse(oldSource, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const oldDefeat = oldClass.body.body.find(node => node.key?.name === 'defeatBoss');
const pinnedDefeat = `({${oldSource.slice(oldDefeat.start, oldDefeat.end)}}).defeatBoss`;

describe('actual Peaks final-hit save, celebration and rewards handoff', () => {
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
        const f = fixture({ level: 3, controlledTimers: true, ...options }); f.context.document = document;
        const wallTimers = new Map(); let wallId = 0;
        Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
            addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
            setTimeout: callback => { wallTimers.set(++wallId, callback); return wallId; }, clearTimeout: id => wallTimers.delete(id) });
        f.selected.AudioManager.playLevelUp = () => f.effects.push({ kind: 'audio', name: 'playLevelUp' });
        const scene = new f.api.NativePeaks(factsFor(3), f.effects), release = installNativeRelease(f, scene);
        scene.physics.pause = () => { scene.physics.world.isPaused = true; };
        scene.player.setVelocity = jest.fn(() => scene.player);
        const boss = scene.boss = release.object(); boss.x = 4890; boss.y = 400;
        boss.body = { gameObject: boss, world: scene.physics.world, enable: true, destroy: jest.fn() };
        for (const name of ['setVelocity', 'setTint', 'clearTint']) boss[name] = jest.fn(() => boss);
        const terrain = scene.mountainBody = release.object(); terrain.setVisible = jest.fn(() => terrain); terrain.clearTint = jest.fn(() => terrain);
        for (const field of ['bossNameText', 'bossSubtitle', 'bossHealthBar', 'bossPressureText']) scene[field] = release.object(field);
        const value = { f, scene, release, boss, terrain, wallTimers }; owned.push(value); return value;
    }
    const openRewards = value => {
        value.release.advance(1800);
        if (value.scene.residentReleaseOpen) { value.scene.residentReleaseClose(); value.release.advance(100); }
        return value.scene.regionalVictoryPanel;
    };

    test('final hit verifies complete rewards before original 1800ms celebration and actual delayed summary', () => {
        const value = create(), { f, scene, release, boss } = value;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        f.state.on('saved', () => {
            expect(scene.guardianTransitionGuards.size).toBe(0); expect(boss.body.enable).toBe(true);
            expect(f.state.get('combat.bossesDefeated')).toBe(1);
        });
        expect(scene.defeatBoss()).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
        expect(f.state.get('levels.voidPeaks.completed')).toBe(true); expect(f.state.get('hubWorld.shipParts.collected')).toContain('hull_plating');
        expect(scene.levelCompletionActive).toBe(true); expect(scene.physics.world.isPaused).toBe(true);
        expect(scene.completionSaveAttempt.phase).toBe('committed'); expect(scene.peakVictoryShown).not.toBe(true);
        expect(boss.body.enable).toBe(false); expect(scene.guardianTransitionGuards.has('peaks-saved-victory')).toBe(true);
        release.advance(1799); expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull(); expect(scene.boss).toBe(boss);
        release.advance(1); expect(scene.boss).toBeNull(); expect(scene.residentReleaseOpen).toBe(true);
        scene.residentReleaseClose(); release.advance(100);
        expect(scene.regionalVictoryPanel.root.isConnected).toBe(true); expect(scene.peakVictoryShown).toBe(true);
        expect(scene.peakResultShown).toBe(true); expect(scene.completionSaveAttempt.phase).toBe('presented');
        const panel = scene.regionalVictoryPanel, button = panel.button; button.click(); button.click();
        expect(scene.transitions).toHaveLength(1); expect(scene.transitions[0].name).toBe('GameScene');
        expect(writer).toHaveBeenCalledTimes(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('a refused write freezes safely and retries the same packet before any cleared-pressure celebration', () => {
        const value = create(), { f, scene, boss } = value; f.state.startAutoSave();
        const root = f.state.state, raw = f.storage.getItem(f.state.saveKey), set = f.storage.setItem;
        let refuse = true;
        f.storage.setItem = (key, data) => { if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, data); };
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        expect(scene.defeatBoss()).toBe(false); expect(scene.completionSaveAttempt.phase).toBe('prepared');
        const packet = writer.mock.calls[0][0]; expect(scene.levelCompletionResult).toBeNull(); expect(scene._levelProgressionRecorded).not.toBe(true);
        expect(boss.body.enable).toBe(true); expect(boss.setTint).not.toHaveBeenCalled(); expect(scene.guardianTransitionGuards.size).toBe(0);
        expect(document.querySelector('[data-completion-save-recovery]')).not.toBeNull();
        f.advanceClock(61000); f.fireIntervals(); expect(f.state.state).toBe(root); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        refuse = false; document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(2); expect(writer.mock.calls[1][0]).toBe(packet);
        expect(scene.completionSaveAttempt.phase).toBe('committed'); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(scene.levelCompletionResult.time).toBe(1000); expect(scene.defeatBoss()).toBe(false);
        expect(openRewards(value).root.isConnected).toBe(true); expect(writer).toHaveBeenCalledTimes(2);
    });

    test('lost write acknowledgement accepts only exact stored bytes, with one grant', () => {
        const value = create(), { f, scene } = value, set = f.storage.setItem; let primary = 0;
        f.storage.setItem = (key, data) => { const result = set(key, data); if (key === f.state.saveKey) { primary++; throw Error('SYNTHETIC_LOST_ACK'); } return result; };
        expect(scene.defeatBoss()).toBe(true); expect(openRewards(value).root.isConnected).toBe(true);
        expect(scene.showBossVictory()).toBe(true); expect(primary).toBe(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test.each(['boss', 'boss-body', 'boss-world', 'boss-game-object', 'boss-destroy', 'body-destroy', 'hud', 'player', 'world', 'clock', 'service', 'memory-alias'])(
        '%s change in the backup observer cannot dispatch the primary save or a celebration', kind => {
            const { f, scene } = create(), raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(f.state.state);
            const set = f.storage.setItem; let primary = 0;
            f.storage.setItem = (key, data) => { if (key === f.state.saveKey) primary++; return set(key, data); };
            f.state.on('saveBackupCreated', () => {
                if (kind === 'boss') scene.boss = { ...scene.boss };
                if (kind === 'boss-body') scene.boss.body = { ...scene.boss.body };
                if (kind === 'boss-world') scene.boss.body.world = {};
                if (kind === 'boss-game-object') scene.boss.body.gameObject = {};
                if (kind === 'boss-destroy') scene.boss.destroy = jest.fn();
                if (kind === 'body-destroy') scene.boss.body.destroy = jest.fn();
                if (kind === 'hud') scene.bossNameText = {};
                if (kind === 'player') scene.player = { ...scene.player };
                if (kind === 'world') scene.physics.world = {};
                if (kind === 'clock') scene.time = {};
                if (kind === 'service') f.selected.InventoryManager = {};
                if (kind === 'memory-alias') f.state.state.stats = { ...f.state.state.stats };
            });
            expect(scene.defeatBoss()).toBe(false); expect(primary).toBe(0); expect(scene.levelCompletionResult).toBeNull();
            expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
            expect(scene.guardianTransitionGuards.size).toBe(0); expect(scene.showBossVictory()).toBe(false);
        });

    test.each(['freeze', 'backup', 'ordinary', 'saved'])('%s observer admitting another campaign receives no old completion work', point => {
        const { f, scene } = create(); let successor;
        const replace = () => {
            const next = f.state.createInitialState(); next.player.cosmicCoins = 77;
            expect(f.state.applyExternalSave(next, { source: 'synthetic-next-campaign' })).toBe(true);
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), memory: JSON.stringify(f.state.state) };
        };
        if (point === 'freeze') scene.endInvincibility = replace;
        else {
            const event = { backup: 'saveBackupCreated', ordinary: 'changed:levels.voidPeaks.completed', saved: 'saved' }[point];
            const off = f.state.on(event, () => { off(); replace(); });
        }
        expect(scene.defeatBoss()).toBe(false); expect(successor).toBeDefined();
        expect(f.state.state).toBe(successor.root); expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw);
        expect(JSON.stringify(f.state.state)).toBe(successor.memory); expect(scene.levelCompletionResult).toBeNull();
        expect(scene.guardianTransitionGuards.size).toBe(0); expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
    });

    test.each(['memory', 'physics', 'cloud', 'lifetime'])('%s replacement during freezing cannot become the original calculation source', kind => {
        const { f, scene } = create(), writer = jest.spyOn(f.state, 'commitHatchSaveDraft');
        scene.endInvincibility = () => {
            if (kind === 'memory') f.state.state.player.cosmicCoins += 7;
            if (kind === 'physics') scene.physics = { ...scene.physics };
            if (kind === 'cloud') f.selected.CloudSave = { campaignEpoch: 2, currentUser: { id: 'synthetic-other' } };
            if (kind === 'lifetime') scene.completionSaveLifetime = {};
        };
        const raw = f.storage.getItem(f.state.saveKey);
        expect(scene.defeatBoss()).toBe(false); expect(writer).not.toHaveBeenCalled(); expect(scene.completionSaveAttempt).toBeUndefined();
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(scene.levelCompletionResult).toBeNull();
    });

    test.each(['new-admission', 'shutdown', 'replacement-boss', 'replacement-terrain', 'replacement-clock'])(
        '%s during the saved celebration retires the old callback without touching replacement actors', kind => {
            const { f, scene, release, boss, terrain } = create();
            const bossDestroy = jest.spyOn(boss, 'destroy'), terrainVisible = terrain.setVisible;
            expect(scene.defeatBoss()).toBe(true);
            if (kind === 'new-admission') f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-during-withdrawal' });
            if (kind === 'shutdown') scene.events.emit('shutdown');
            if (kind === 'replacement-boss') scene.boss = { ...boss };
            if (kind === 'replacement-terrain') scene.mountainBody = {};
            if (kind === 'replacement-clock') scene.time = {};
            const raw = f.storage.getItem(f.state.saveKey); release.advance(1800);
            expect(bossDestroy).not.toHaveBeenCalled(); expect(terrainVisible).not.toHaveBeenCalled();
            expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        });

    test('delayed actual rescue summary retries mounting without another save and cleans up on admission change', () => {
        const value = create(), { f, scene, release } = value, show = f.api.ExpeditionDebriefPanel.prototype.show;
        jest.spyOn(f.api.ExpeditionDebriefPanel.prototype, 'show').mockImplementationOnce(() => { throw Error('SYNTHETIC_MOUNT_FAILURE'); })
            .mockImplementation(function (...args) { return show.apply(this, args); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft'); expect(scene.defeatBoss()).toBe(true);
        const raw = f.storage.getItem(f.state.saveKey); openRewards(value); expect(scene.residentReleaseOpen).toBe(true);
        scene.residentReleaseClose(); release.advance(100);
        const panel = scene.regionalVictoryPanel; expect(panel.root.isConnected).toBe(true);
        expect(writer).toHaveBeenCalledTimes(1); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-after-peaks-summary' });
        expect(panel.root).toBeNull(); expect(scene.completionSaveAttempt.phase).toBe('retired');
    });

    test.each(['body', 'scene', 'active', 'destroy-method'])('same-sprite %s replacement after verified saving is untouched before fixture cleanup', kind => {
        const { scene, release, boss, terrain } = create();
        const original = { body: boss.body, scene: boss.scene, active: boss.active, destroy: boss.destroy };
        const replacement = { ...boss.body, destroy: jest.fn() }, replacementDestroy = jest.fn();
        expect(scene.defeatBoss()).toBe(true);
        if (kind === 'body') boss.body = replacement;
        if (kind === 'scene') boss.scene = { sys: scene.sys };
        if (kind === 'active') boss.active = false;
        if (kind === 'destroy-method') boss.destroy = replacementDestroy;
        try {
            release.advance(1800);
            expect(replacement.destroy).not.toHaveBeenCalled(); expect(replacementDestroy).not.toHaveBeenCalled();
            expect(original.body.destroy).not.toHaveBeenCalled(); expect(scene.boss).toBe(boss);
            expect(terrain.setVisible).not.toHaveBeenCalled(); expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
            if (kind === 'body') expect(boss.body).toBe(replacement);
        } finally {
            // Restore only synthetic fixture slots AFTER the ownership assertions.
            Object.assign(boss, original);
        }
    });

    test('destruction observer admitting new progress cannot clear or present over a replacement actor', () => {
        const { f, scene, release, boss } = create(); let successor;
        expect(scene.defeatBoss()).toBe(true);
        const replacement = { destroy: jest.fn() };
        boss.once('destroy', () => {
            const next = f.state.createInitialState(); next.player.cosmicCoins = 77;
            expect(f.state.applyExternalSave(next, { source: 'synthetic-during-native-destroy' })).toBe(true);
            scene.boss = replacement;
            successor = { raw: f.storage.getItem(f.state.saveKey), memory: JSON.stringify(f.state.state) };
        });
        release.advance(1800); expect(successor).toBeDefined();
        expect(scene.boss).toBe(replacement); expect(replacement.destroy).not.toHaveBeenCalled();
        expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw); expect(JSON.stringify(f.state.state)).toBe(successor.memory);
        expect(document.querySelector('[data-testid="expedition-debrief"]')).toBeNull();
    });

    test('healthy owned upload waits before calculation and saving, then preserves final-hit timing', () => {
        let cloud;
        const value = create({ beforeServices: ({ selected, state }) => { cloud = { gameState: state, campaignEpoch: 1,
            currentUser: { id: 'synthetic-review' }, activeCloudWrite: null }; selected.CloudSave = cloud; } });
        const { f, scene } = value, lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true); cloud.activeCloudWrite = lease;
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft'); expect(scene.defeatBoss()).toBe(false);
        expect(scene.completionSaveAttempt.phase).toBe('waiting'); expect(writer).not.toHaveBeenCalled(); expect(scene.guardianTransitionGuards.size).toBe(0);
        f.advanceClock(61000); f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
        document.querySelector('[data-completion-save-recovery] button').click();
        expect(writer).toHaveBeenCalledTimes(1); expect(scene.levelCompletionResult.time).toBe(1000);
        expect(openRewards(value).root.isConnected).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('mandatory scheduling failure still offers the saved reward route; optional feedback never controls saving', () => {
        const { f, scene, release } = create();
        jest.spyOn(release.clock, 'delayedCall').mockImplementationOnce(() => { throw Error('SYNTHETIC_TIMER_FAILURE'); });
        const writer = jest.spyOn(f.state, 'commitHatchSaveDraft'); expect(scene.defeatBoss()).toBe(true);
        expect(scene.residentReleaseOpen).toBe(true); scene.residentReleaseClose(); release.advance(100);
        expect(scene.regionalVictoryPanel.root.isConnected).toBe(true); expect(writer).toHaveBeenCalledTimes(1);
    });

    test.each(['installed', 'fallbacks', 'replay', 'warm-shared', 'warm-separate', 'warm-mixed'])(
        '%s complete packet matches the pinned actual Peaks after-Guardian ordering', sample => {
        const mode = sample === 'fallbacks' ? 'fallbacks' : 'installed';
        const seed = ({ complete, selected }) => {
            if (sample === 'replay') { complete(factsFor(3, { rewardBonusCount: 0 })); selected.AchievementSystem.recordEvent('guardian_restored', {}); }
            if (sample.startsWith('warm-')) {
                const manager = selected.AchievementSystem; manager.recordEvent('guardian_restored', { bossId: 'synthetic-earlier' });
                if (sample !== 'warm-shared') for (const item of Object.values(manager.definitions)) {
                    item.progress = clone(item.progress);
                    if (sample === 'warm-separate') item.claimed = clone(item.claimed);
                }
            }
        };
        const old = fixture({ level: 3, mode, seed }), candidate = fixture({ level: 3, mode, seed });
        try {
            const input = factsFor(3, { rewardBonusCount: 0 }), plan = candidate.calculate({ ...input, guardianRestoredAfter: true });
            expect(plan.status).toBe('calculated');
            const scene = new old.api.Completion(input, old.effects);
            Object.assign(scene, { clearTitanEntrance() {}, clearTitanControlTimers() {}, clearTitanWindup() {},
                clearBossEncounterTimers() {}, clearBossEncounterEffects() {}, showFloatingText() {}, scheduleGuardianTransition() {},
                tweens: { add() {} }, boss: { body: { enable: true }, setVelocity() {}, setTint() {}, x: 4890, y: 400 } });
            vm.runInContext(pinnedDefeat, old.context).call(scene);
            expect(plan.result).toEqual(clone(scene.levelCompletionResult)); expect(plan.state).toEqual(old.snapshot());
            expect(plan.notifications).toEqual(old.notifications); expect(plan.effects).toEqual(old.effects);
            if (mode === 'installed') {
                const guardian = plan.notifications.findIndex(packet => packet.event === 'changed:combat.bossesDefeated');
                const bond = plan.notifications.findIndex(packet => packet.event === 'changed:creature.bond');
                expect(guardian).toBeGreaterThan(bond);
            }
            expect(candidate.calls).toEqual([]); expect(candidate.notifications).toEqual([]);
        } finally { old.close(); candidate.close(); }
    });
});
