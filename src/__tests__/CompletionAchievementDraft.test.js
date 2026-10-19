const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm');
const { fixture, progress, clone } = require('./support/achievementDraftFixture.cjs');
const { compiledModuleSource } = require('./support/compiledInventorySource.cjs');
const code = compiledModuleSource('dev/CompletionAchievementDraft.js');
const target = { module: { exports: {} }, window };
vm.runInNewContext(code, target);
const { captureCompletionAchievementSource: capture, calculateCompletionAchievementDraft: calculate } = target.module.exports;
const baseline = readPinnedSource('eb264911:src/systems/AchievementSystem.js');
const questCode = compiledModuleSource('systems/QuestManager.js');
const now = 1700000000777;
const levels = ['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths', 'finalVoid'];
const event = levelId => ({ levelId, noDamage: true, time: 1000, speedrunThreshold: 3000 });

describe('detached completion achievements preserve actual live event rules', () => {
    const owned = [];
    const create = options => { const f = fixture(options); owned.push(f); window.AchievementSystem = f.system; return f; };
    const observe = f => ({ memory: JSON.stringify(f.state.get()), progress: progress(f.system),
        pending: clone(f.system.pendingClaims), notifications: clone(f.system.notificationQueue),
        events: clone(f.events), raw: localStorage.getItem(f.state.saveKey), admission: f.state.getSaveAdmission() });
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(now); localStorage.clear();
        for (const key of ['GameState', 'AchievementSystem', 'QuestManager', 'CloudSave']) delete window[key];
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
    });
    afterEach(() => {
        owned.splice(0).forEach(f => f.close()); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'AchievementSystem', 'QuestManager', 'CloudSave']) delete window[key];
    });

    for (const level of levels) test.each([
        ['clean fast victory', event(level)],
        ['damaged slow victory', { levelId: level, noDamage: false, time: 4000, speedrunThreshold: 3000 }],
        ['zero time preserves achievement truthiness', { levelId: level, noDamage: true, time: 0, speedrunThreshold: 3000 }],
        ['no speed threshold', { levelId: level, noDamage: true, time: 1000, speedrunThreshold: 0 }]
    ])(level + ': %s matches the pinned dispatcher', (_label, data) => {
        const old = create({ source: baseline }); old.system.recordEvent('level_completed', data);
        const live = create(); live.system.recordEvent('level_completed', data);
        expect(clone(live.state.get())).toEqual(clone(old.state.get())); expect(progress(live.system)).toEqual(progress(old.system));
        expect(clone(live.events)).toEqual(clone(old.events)); expect(clone(live.system.pendingClaims)).toEqual(clone(old.system.pendingClaims));
        const f = create(), source = capture(f.system, f.state), before = observe(f);
        expect(source.status).toBe('captured');
        const result = calculate(source, f.state.get(), data, now);
        expect(result.status).toBe('calculated'); expect(result.state).toEqual(clone(old.state.get()));
        expect(result.achievements).toEqual(progress(old.system)); expect(result.pendingClaims).toEqual(clone(old.system.pendingClaims));
        expect(result.events).toEqual(clone(old.events)); expect(result.saveRequests).toBe(old.state.save.mock.calls.length);
        expect(observe(f)).toEqual(before); expect(f.state.save).not.toHaveBeenCalled(); expect(source.isCurrent()).toBe(true);
        expect(Object.isFrozen(result.state)).toBe(true); expect(Object.isFrozen(f.state.get())).toBe(false);
    });

    test('already unlocked/claimed tiers and legitimate later victories keep original rules', () => {
        const f = create(); f.system.recordEvent('level_completed', event('mythicalForest'));
        const unlocked = clone(f.system.pendingClaims), before = observe(f); f.events.length = 0;
        const source = capture(f.system, f.state), result = calculate(source, f.state.get(), event('mythicalForest'), now);
        expect(result.status).toBe('calculated'); expect(result.pendingClaims).toEqual(unlocked);
        expect(result.saveRequests).toBe(0); expect(result.events.filter(packet => packet.kind === 'achievement')).toEqual([]);
        expect(result.events.filter(packet => packet.kind === 'state').map(packet => packet.event)).toEqual([
            'stateChanged', 'changed:levels.mythicalForest.completed', 'stateChanged', 'changed:levels.mythicalForest.noDamageRun',
            'stateChanged', 'changed:levels.mythicalForest.speedrun'
        ]);
        expect(result.achievements).toEqual(before.progress); expect(f.events).toEqual([]);
    });

    test.each(['shared', 'detached', 'mixed'])('warm %s dictionaries preserve actual tier-growth oldValue and pending claims', relation => {
        const warm = f => {
            f.system.recordEvent('level_completed', { ...event('mythicalForest'), noDamage: false });
            if (relation !== 'shared') for (const definition of Object.values(f.system.definitions)) {
                definition.progress = clone(definition.progress);
                if (relation === 'detached') definition.claimed = clone(definition.claimed);
            }
            f.events.length = 0; f.state.save.mockClear();
        };
        const old = create({ source: baseline }); warm(old); old.system.recordEvent('level_completed', event('crystalCaves'));
        const f = create(); warm(f); const before = observe(f), source = capture(f.system, f.state);
        expect(source.status).toBe('captured'); const result = calculate(source, f.state.get(), event('crystalCaves'), now);
        expect(result.status).toBe('calculated'); expect(result.state).toEqual(clone(old.state.get()));
        expect(result.achievements).toEqual(progress(old.system)); expect(result.pendingClaims).toEqual(clone(old.system.pendingClaims));
        expect(result.events).toEqual(clone(old.events)); expect(observe(f)).toEqual(before); expect(source.isCurrent()).toBe(true);
    });

    test.each(['root', 'entry', 'progress', 'claimed'])('equal-byte canonical %s replacement retires original topology', key => {
        const f = create(); f.system.recordEvent('level_completed', event('mythicalForest'));
        const source = capture(f.system, f.state); expect(source.status).toBe('captured');
        if (key === 'root') f.state.state.achievements = clone(f.state.state.achievements);
        else if (key === 'entry') f.state.state.achievements.crystal_conqueror = clone(f.state.state.achievements.crystal_conqueror);
        else f.state.state.achievements.crystal_conqueror[key] = clone(f.state.state.achievements.crystal_conqueror[key]);
        const before = observe(f); expect(source.isCurrent()).toBe(false);
        expect(calculate(source, f.state.get(), event('crystalCaves'), now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('cross-entry aliases are explicitly unsupported, not reconstructed from equal data', () => {
        const f = create(); f.system.recordEvent('level_completed', event('mythicalForest'));
        f.system.definitions.crystal_conqueror.progress = f.system.definitions.reef_explorer?.progress || f.system.definitions.caring_owner.progress;
        expect(capture(f.system, f.state).status).toBe('unqualified');
    });

    test('persisted claimed rewards and their extra metadata are retained without claiming again', () => {
        const claimed = { BRONZE: { claimedAt: 77, rewards: { coins: 25, syntheticRetained: true } } };
        const seed = state => state.set('achievements', { caring_owner: {
            progress: { BRONZE: { unlocked: true, unlockedAt: 66, value: 1 } }, claimed
        } });
        const old = create({ source: baseline, seed }); old.system.recordEvent('level_completed', event('voidPeaks'));
        const f = create({ seed }), source = capture(f.system, f.state), claim = jest.spyOn(f.system, 'claimReward');
        const plan = calculate(source, f.state.get(), event('voidPeaks'), now);
        expect(plan.status).toBe('calculated'); expect(plan.state).toEqual(clone(old.state.get()));
        expect(plan.achievements.caring_owner.claimed).toEqual(claimed); expect(claim).not.toHaveBeenCalled();
    });

    test('captured time controls age thresholds, unlock dates and state-event dates without reading the live clock', () => {
        const seed = state => state.set('creature.lifecycle.birthDate', now - 30 * 86400000);
        const old = create({ source: baseline, seed }); old.system.recordEvent('level_completed', event('crystalCaves'));
        const f = create({ seed }), source = capture(f.system, f.state);
        jest.setSystemTime(now + 100 * 86400000);
        const clock = jest.spyOn(Date, 'now');
        const result = calculate(source, f.state.get(), event('crystalCaves'), now);
        expect(result.status).toBe('calculated'); expect(result.achievements).toEqual(progress(old.system));
        expect(result.events).toEqual(clone(old.events)); expect(clock).not.toHaveBeenCalled();
    });

    test('preparation cannot call live setters, saves, grants, random allocation, storage or notification sinks', () => {
        const f = create(), source = capture(f.system, f.state), before = observe(f);
        const spies = ['set', 'save', 'emit', 'holdSaveAdmission'].map(name => jest.spyOn(f.state, name)
            .mockImplementation(() => { throw Error('SYNTHETIC_LIVE_EFFECT_FORBIDDEN'); }));
        const write = jest.spyOn(Storage.prototype, 'setItem'), random = jest.spyOn(Math, 'random');
        window.EconomyManager = { addCoins: jest.fn() }; window.InventoryManager = { addItem: jest.fn() };
        try {
            const result = calculate(source, f.state.get(), event('voidPeaks'), now);
            expect(result.status).toBe('calculated'); expect(observe(f)).toEqual(before);
            spies.forEach(spy => expect(spy).not.toHaveBeenCalled()); expect(write).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
            expect(window.EconomyManager.addCoins).not.toHaveBeenCalled(); expect(window.InventoryManager.addItem).not.toHaveBeenCalled();
        } finally { delete window.EconomyManager; delete window.InventoryManager; }
    });

    test.each([
        ['selected service', () => { window.AchievementSystem = {}; }],
        ['selected state', () => { window.GameState = {}; }],
        ['equal admitted state', f => { f.state.state = clone(f.state.state); }],
        ['canonical achievement data', f => { f.state.state.achievements = { synthetic_unknown: {} }; }],
        ['progress cache', f => { f.system.definitions.caring_owner.progress = { BRONZE: { unlocked: true } }; }],
        ['pending claims', f => { f.system.pendingClaims.push({ id: 'synthetic-pending', tier: 'BRONZE' }); }],
        ['notification queue', f => { f.system.notificationQueue.push({ id: 'synthetic-notification' }); }],
        ['catalogue function', f => { f.system.definitions.caring_owner.getProgress = () => 77; }],
        ['catalogue reward', f => { f.system.definitions.caring_owner.tiers.BRONZE.rewards.coins = 777; }],
        ['emitter', f => { f.system.events = { emit() {} }; }],
        ['emit function', f => { f.system.events.emit = () => {}; }],
        ['calculation method', f => { f.system.prepareProgressEventDraft = () => {}; }],
        ['save admission', f => { f.state.holdSaveAdmission({ code: 'commit_failed' }, 'synthetic'); }]
    ])('a changed %s retires the original source without rebasing', (_label, change) => {
        const f = create(), source = capture(f.system, f.state); expect(source.status).toBe('captured');
        change(f); const before = observe(f);
        expect(source.isCurrent()).toBe(false); expect(calculate(source, f.state.get(), event('voidPeaks'), now).status).toBe('unqualified');
        expect(observe(f)).toEqual(before);
    });

    test('raw-observed owner sees another stored save without holding or replacing it', () => {
        const f = create(), reader = f.state.captureSaveAdmissionOwner({ raw: null }), source = capture(f.system, f.state, reader);
        expect(source.scope).toBe('provided-owner-and-loaded-achievements');
        localStorage.setItem(f.state.saveKey, '{synthetic-successor'); const before = observe(f);
        expect(calculate(source, f.state.get(), event('voidPeaks'), now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('replacing the original reader method is not fresh ownership', () => {
        const f = create(), reader = f.state.captureSaveAdmissionOwner(), source = capture(f.system, f.state, reader);
        reader.isCurrent = () => true;
        expect(source.isCurrent()).toBe(false);
    });

    test.each(['unknown-save-key', 'unloaded-service', 'unknown-cache', 'custom-function', 'custom-reward', 'null-cache', 'array-cache'])('%s remains untouched and explicitly unqualified', kind => {
        const f = create();
        if (kind === 'unknown-save-key') f.state.state.achievements = { synthetic_unknown: { retained: true } };
        if (kind === 'unloaded-service') f.system.initialized = false;
        if (kind === 'unknown-cache') f.system.loadedGameState = null;
        if (kind === 'null-cache') f.system.definitions.caring_owner.progress = null;
        if (kind === 'array-cache') f.system.definitions.caring_owner.claimed = [];
        const custom = jest.fn(() => { throw Error('UNTRUSTED_PROGRESS_FUNCTION'); });
        if (kind === 'custom-function') f.system.definitions.caring_owner.getProgress = custom;
        if (kind === 'custom-reward') f.system.definitions.caring_owner.tiers.BRONZE.rewards.coins++;
        const before = observe(f), load = jest.spyOn(f.system, 'loadProgress');
        expect(capture(f.system, f.state).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
        expect(custom).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
    });

    test.each([
        ['wrong level', { levelId: 'synthetic-unknown' }], ['missing no-damage flag', { noDamage: undefined }],
        ['nonfinite time', { time: Infinity }], ['negative threshold', { speedrunThreshold: -1 }]
    ])('%s event is not guessed or applied', (_label, changes) => {
        const f = create(), source = capture(f.system, f.state), before = observe(f);
        expect(calculate(source, f.state.get(), { ...event('voidPeaks'), ...changes }, now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test.each([null, [], undefined])('missing/non-object snapshot stays unqualified (%j)', snapshot => {
        const f = create(), source = capture(f.system, f.state), before = observe(f);
        expect(calculate(source, snapshot, event('voidPeaks'), now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('a caller cannot replace canonical achievements inside an otherwise valid staged snapshot', () => {
        const f = create(), source = capture(f.system, f.state), input = clone(f.state.get()); input.achievements = { synthetic_other: {} };
        expect(calculate(source, input, event('voidPeaks'), now)).toEqual({ status: 'unqualified', reason: 'achievement_input_changed' });
    });

    test.each([
        { caring_owner: { progress: [], claimed: {} } },
        { caring_owner: { progress: {}, claimed: {}, retained: 'synthetic-unknown' } },
        { caring_owner: { progress: null, claimed: {} } },
        []
    ])('unsupported valid achievement shapes are retained, not normalised (%j)', saved => {
        const f = create({ seed: state => state.set('achievements', clone(saved)) }), before = observe(f);
        expect(capture(f.system, f.state).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('extra valid story/creature/media fields survive, unsupported values are not silently stripped', () => {
        const f = create(), source = capture(f.system, f.state), input = clone(f.state.get());
        input.synthetic = { creatureId: 'synthetic-creature', parentIds: ['synthetic-parent'], still: '/synthetic/scene.png', falseValue: false, zero: 0 };
        const result = calculate(source, input, event('voidPeaks'), now);
        expect(result.status).toBe('calculated'); expect(result.state.synthetic).toEqual(input.synthetic);
        input.synthetic.unsupported = undefined;
        expect(calculate(source, input, event('voidPeaks'), now).status).toBe('unqualified'); expect(Object.hasOwn(input.synthetic, 'unsupported')).toBe(true);
    });

    test('an accessor in supplied completion facts is refused without invocation', () => {
        const f = create(), source = capture(f.system, f.state), data = event('voidPeaks'), get = jest.fn(() => 'voidPeaks');
        Object.defineProperty(data, 'levelId', { get, enumerable: true });
        expect(calculate(source, f.state.get(), data, now).status).toBe('unqualified'); expect(get).not.toHaveBeenCalled();
    });

    test('retirement during input copying cannot calculate into the successor', () => {
        const f = create(), source = capture(f.system, f.state), original = f.state.state;
        const input = new Proxy(original, { ownKeys(value) { f.state.state = clone(original); return Reflect.ownKeys(value); } });
        const before = JSON.stringify(original);
        expect(calculate(source, input, event('voidPeaks'), now).status).toBe('unqualified');
        expect(f.state.state).not.toBe(original); expect(JSON.stringify(f.state.state)).toBe(before);
        expect(f.events).toEqual([]); expect(f.state.save).not.toHaveBeenCalled();
    });

    test.each(['ordinary', 'refusal-then-retry', 'committed-then-thrown', 'raw-successor-before-commit', 'memory-successor-before-commit'])('prepared achievement and loaded Quest publication: %s', mode => {
        const f = create(); f.state.save.mockRestore();
        f.state.set('quests.active', [{ id: 'synthetic-existing-quest', objective: { type: 'care_action', action: 'feed', target: 3 }, progress: 1 }]);
        f.state.set('quests.completed', ['synthetic-previous-quest']);
        expect(f.state.save()).toBe(true);
        expect({ ready: f.state.canCommitHatchSave(), admission: f.state.getSaveAdmission() }).toMatchObject({ ready: true });
        const context = { module: { exports: {} }, window, console, Date };
        vm.runInNewContext(questCode, context); const quests = context.module.exports.default;
        expect(quests.loadQuestState()).toBe(true); quests.initialized = true; quests.setupEventListeners();
        const track = jest.spyOn(quests, 'trackProgress');
        const owner = f.state.state, raw = localStorage.getItem(f.state.saveKey), epoch = f.state.getSaveAdmission().epoch;
        const reader = f.state.captureSaveAdmissionOwner({ raw }), memoryOwner = f.state.captureSaveAdmissionOwner();
        const source = capture(f.system, f.state, reader);
        const publication = f.system.captureHatchProgressPublication(), questPublication = quests.captureNamingProgressPublication(f.state);
        const plan = calculate(source, f.state.get(), event('voidPeaks'), now);
        expect(plan.status).toBe('calculated'); const staged = clone(plan.state);
        publication.prepare(plan); questPublication.prepare(staged);
        const initialProgress = progress(f.system), initialQuest = quests.activeQuests;
        const current = () => window.GameState === f.state && window.AchievementSystem === f.system && window.QuestManager === quests &&
            f.state.getSaveAdmission().epoch === epoch && publication.isCurrent() && questPublication.isCurrent() &&
            // The writer owns old/new raw readback during the write. Its campaign
            // callback must retain original memory ownership across that change.
            (f.state.state === owner ? memoryOwner.isCurrent() : f.state.state === staged);
        const publish = jest.fn(() => { questPublication.publish(); publication.publish(); });
        let saved = 0;
        f.state.on('saved', () => {
            saved++;
            expect(f.state.state).toBe(staged); expect(quests.activeQuests).toBe(staged.quests.active);
            expect(quests.completedQuests).toBe(staged.quests.completed); expect(f.system.hasHatchProgressSource(f.state)).toBe(true);
        });
        f.events.length = 0;
        let refuse = mode === 'refusal-then-retry'; const write = Storage.prototype.setItem, primaryWrites = [];
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) {
                primaryWrites.push(value); if (refuse) throw Error('SYNTHETIC_PRIMARY_REFUSED');
                write.call(this, key, value); if (mode === 'committed-then-thrown') throw Error('SYNTHETIC_LOST_ACK');
                return;
            }
            return write.call(this, key, value);
        });
        const commit = () => !reader.isCurrent() ? { success: false, reason: 'source_retired' } : f.state.commitHatchSaveDraft(staged, { isCurrentCampaign: current,
            isCurrentResult: (live, durable, serialized) => live === staged &&
                JSON.stringify(f.state.createSaveSnapshot({ state: live })) === serialized && JSON.stringify(durable) === serialized,
            onPublished: publish, notifications: plan.events.filter(packet => packet.kind !== 'save-request'),
            onNotification: packet => {
                if (packet.kind === 'state') f.state.emit(packet.event, packet.data);
                else if (packet.kind === 'achievement') f.system.events.emit(packet.event, packet.data);
            }
        });
        if (mode.endsWith('before-commit')) {
            if (mode.startsWith('raw')) {
                const successor = JSON.parse(raw); successor.player.cosmicCoins = 77;
                localStorage.setItem(f.state.saveKey, JSON.stringify(successor)); primaryWrites.length = 0;
            } else f.state.state = clone(owner);
            const beforeRaw = localStorage.getItem(f.state.saveKey), beforeMemory = JSON.stringify(f.state.state);
            expect(commit()).toEqual({ success: false, reason: 'source_retired' }); expect(primaryWrites).toHaveLength(0);
            expect(localStorage.getItem(f.state.saveKey)).toBe(beforeRaw); expect(JSON.stringify(f.state.state)).toBe(beforeMemory);
            expect(publish).not.toHaveBeenCalled(); expect(saved).toBe(0); expect(progress(f.system)).toEqual(initialProgress);
            return;
        }
        if (refuse) {
            expect(commit().success).toBe(false); expect(localStorage.getItem(f.state.saveKey)).toBe(raw);
            expect(f.state.state).toBe(owner); expect(progress(f.system)).toEqual(initialProgress);
            expect(quests.activeQuests).toBe(initialQuest); expect(source.isCurrent()).toBe(true);
            expect(f.events.filter(packet => packet.kind === 'achievement')).toEqual([]); expect(publish).not.toHaveBeenCalled();
            refuse = false;
        }
        const result = commit();
        if (!result.success) throw Error(JSON.stringify({ result, admission: f.state.getSaveAdmission(), published: publish.mock.calls.length,
            writes: primaryWrites.length, isCurrent: current(), reader: reader.isCurrent(), achievement: publication.isCurrent(),
            quest: questPublication.isCurrent(), errors: f.events.filter(packet => packet.event === 'saveError').map(packet => packet.data.error?.message) }));
        expect({ result, admission: f.state.getSaveAdmission(), published: publish.mock.calls.length, writes: primaryWrites.length,
            isCurrent: current() }).toMatchObject({ result: { success: true } });
        expect(result.isCurrent()).toBe(true); expect(saved).toBe(1);
        expect(primaryWrites).toHaveLength(mode === 'refusal-then-retry' ? 2 : 1); expect(publish).toHaveBeenCalledTimes(1);
        expect(f.state.get('levels.voidPeaks.completed')).toBe(true); expect(JSON.parse(localStorage.getItem(f.state.saveKey)).levels.voidPeaks.completed).toBe(true);
        expect(quests.activeQuests).toEqual(initialQuest); expect(quests.activeQuests).not.toBe(initialQuest);
        expect(progress(f.system)).toEqual(plan.achievements); expect(f.system.pendingClaims).toEqual(plan.pendingClaims);
        expect(track).not.toHaveBeenCalled(); expect(quests.questProgress).toEqual({});
    });
});
