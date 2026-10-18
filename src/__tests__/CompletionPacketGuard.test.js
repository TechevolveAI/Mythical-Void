const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const { fixture, factsFor, clone } = require('./support/levelCompletionFixture.cjs');
const vm = require('node:vm');

const { parse } = require('@babel/parser');

describe('whole completion packet and writer-owned accounting barrier', () => {
    let owned;
    beforeEach(() => { owned = []; });
    afterEach(() => owned.forEach(f => f.close()));
    function setup() {
        const f = fixture(); owned.push(f);
        const original = f.state.state, admission = f.state.saveAdmission;
        const raw = f.storage.getItem(f.state.saveKey), memory = JSON.stringify(original);
        const draft = f.api.prepareCompletionPublicationDraft(f.calculate(factsFor(0)), {
            inventory: f.selected.InventoryManager, achievements: f.selected.AchievementSystem });
        const capture = () => f.api.captureCompletionPacketGuard(draft, {
            inventory: f.selected.InventoryManager, achievements: f.selected.AchievementSystem });
        const guard = capture();
        const core = () => f.context.window.GameState === f.state && f.state.saveAdmission === admission &&
            (f.state.state === original || f.state.state === draft.state);
        const commit = (options = {}) => f.state.commitHatchSaveDraft(draft.state, {
            draftGuard: guard, isCurrentCampaign: core, onPublished() {},
            isCurrentResult: (live, stored, bytes) => live === draft.state &&
                JSON.stringify(f.state.createSaveSnapshot({ state: live })) === bytes && JSON.stringify(stored) === bytes,
            ...options });
        let primary = 0, backups = 0;
        const set = f.storage.setItem;
        f.storage.setItem = (key, value) => { if (key === f.state.saveKey) primary++; else backups++; return set(key, value); };
        return { f, draft, guard, capture, commit, original, admission, raw, memory,
            get primary() { return primary; }, get backups() { return backups; } };
    }

    test('seals the actual advancing writer once per invocation, with read-only result checks', () => {
        const s = setup(); const seal = jest.fn(record => s.guard.sealAccounting(record));
        const guard = Object.freeze({ root: s.draft.state, isCurrent: s.guard.isCurrent, sealAccounting: seal });
        s.f.advanceClock(250);
        const result = s.commit({ draftGuard: guard });
        expect(result.success).toBe(true); expect(s.primary).toBe(1); expect(seal).toHaveBeenCalledTimes(1);
        const record = seal.mock.calls[0][0];
        expect(Object.isFrozen(record)).toBe(true); expect(Object.isFrozen(record.before)).toBe(true); expect(Object.isFrozen(record.after)).toBe(true);
        expect(record.after.playTime - record.before.playTime).toBe(250);
        expect(record.after.lastPlayed).toBe(record.after.sessionStart); expect(record.after.savedAt).toBe(record.after.sessionStart);
        const bytes = JSON.stringify(s.draft), raw = s.f.storage.getItem(s.f.state.saveKey);
        s.f.advanceClock(1500);
        for (let index = 0; index < 3; index++) expect(result.isCurrent()).toBe(true);
        expect(seal).toHaveBeenCalledTimes(1); expect(JSON.stringify(s.draft)).toBe(bytes); expect(s.f.storage.getItem(s.f.state.saveKey)).toBe(raw);
        expect(s.f.state.state).toBe(s.draft.state); expect(s.f.calls).toEqual([]);
    });

    const changes = [
        ['state-root', d => { d.state = clone(d.state); }],
        ['coins', d => { d.state.player.cosmicCoins++; }],
        ['completed', d => { d.state.levels.mythicalForest.completed = false; }],
        ['creature-id', d => { d.state.creature.id = 'synthetic-replaced'; }],
        ['creature-bond', d => { d.state.creature.bond = clone(d.state.creature.bond); }],
        ['lineage', d => { d.state.creatures[0].parentIds.reverse(); }],
        ['media-reference', d => { d.state.creatures[0].media.assetRef = '/synthetic/unowned.png'; }],
        ['ecology', d => { d.state.world.currentEcology.regions.mythical_forest.vitality++; }],
        ['debrief', d => { d.state.story.projectBeacon.pendingDebriefs = []; }],
        ['thought-cache', d => { d.projections.thoughtContext = clone(d.projections.thoughtContext); }],
        ['quest-cache', d => { d.projections.quests = clone(d.projections.quests); }],
        ['achievement-cache', d => { d.projections.achievements = clone(d.projections.achievements); }],
        ['result', d => { d.result.coinsAwarded++; }],
        ['result-frozen', d => { Object.freeze(d.result); }],
        ['effect', d => { d.effects[0].name = 'unownedEffect'; }],
        ['timeline', d => { d.timeline.reverse(); }],
        ['timeline-alias', d => { d.timeline.find(entry => entry.type === 'notification').packet = clone(d.notifications[0]); }],
        ['notification', d => { d.notifications[0].data.timestamp++; }],
        ['notification-frozen', d => { Object.freeze(d.notifications[0]); }],
        ['extra-field', d => { d.state.extra = false; }],
        ['descriptor', d => { Object.defineProperty(d.result, 'coinsAwarded', { writable: false }); }],
        ['prototype', d => { Object.setPrototypeOf(d.state.stats, null); }],
        ['root-sealed', d => { Object.seal(d); }],
        ['play-time', d => { d.state.player.playTime++; }],
        ['last-played', d => { d.state.player.lastPlayed++; }],
        ['session-start', d => { d.state.session.sessionStart++; }],
        ['saved-at', d => { d.state.savedAt++; }]
    ];
    for (const point of ['before-writer', 'backup']) test.each(changes)('%s change at ' + point + ' never dispatches a primary write', (_name, mutate) => {
        const s = setup(); s.f.advanceClock(100);
        if (point === 'before-writer') mutate(s.draft);
        else s.f.state.on('saveBackupCreated', () => mutate(s.draft));
        expect(s.commit().success).toBe(false); expect(s.primary).toBe(0);
        expect(s.f.state.state).toBe(s.original); expect(JSON.stringify(s.original)).toBe(s.memory);
        expect(s.f.storage.getItem(s.f.state.saveKey)).toBe(s.raw);
        expect(s.f.state.saveAdmission).toBe(s.admission);
        expect(s.f.persistenceEvents.filter(value => value.event === 'saved')).toEqual([]);
        expect(s.guard.isCurrent()).toBe(false);
    });

    test('the old writer fails to seal its normal elapsed accounting and cannot pass the new guard', () => {
        const s = setup(), source = readPinnedSource('26e58823:src/systems/GameState.js');
        const cls = parse(source, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
        const method = cls.body.body.find(node => node.key?.name === 'commitHatchSaveDraft');
        const old = vm.runInContext(`({${source.slice(method.start, method.end)}}).commitHatchSaveDraft`, s.f.context);
        s.f.advanceClock(100);
        const result = old.call(s.f.state, s.draft.state, { draftGuard: s.guard, isCurrentCampaign: () => true,
            onPublished() {}, isCurrentResult: () => s.guard.isCurrent() });
        expect(result.success).toBe(false); expect(s.primary).toBe(1); expect(s.guard.isCurrent()).toBe(false);
        expect(s.f.state.state).toBe(s.draft.state); expect(s.f.state.getSaveAdmission().status).toBe('held');
    });

    test.each(['healthy', 'definite-refusal', 'committed-then-thrown'])('option-absent %s writer retains the exact old order, save and events', kind => {
        const source = readPinnedSource('26e58823:src/systems/GameState.js');
        const cls = parse(source, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
        const method = cls.body.body.find(node => node.key?.name === 'commitHatchSaveDraft');
        const run = historical => {
            const s = setup(), trace = [], set = s.f.storage.setItem;
            for (const name of ['canCommitHatchSave', 'assertSaveAdmission', 'assertCloudRecoveryClear', 'createSaveSnapshot',
                'captureLocalSaveWrite', 'validateSaveDataStructure', 'prepareSaveCandidate', 'createLocalSaveBackup']) {
                const actual = s.f.state[name];
                s.f.state[name] = function (...args) { trace.push(name); return actual.apply(this, args); };
            }
            s.f.storage.setItem = (key, value) => {
                trace.push(key === s.f.state.saveKey ? 'primary' : 'recovery-copy');
                if (key === s.f.state.saveKey && kind === 'definite-refusal') throw Error('SYNTHETIC_REFUSAL');
                const result = set(key, value);
                if (key === s.f.state.saveKey && kind === 'committed-then-thrown') throw Error('SYNTHETIC_LOST_ACK');
                return result;
            };
            s.f.advanceClock(333);
            const writer = historical ? vm.runInContext(`({${source.slice(method.start, method.end)}}).commitHatchSaveDraft`, s.f.context) : s.f.state.commitHatchSaveDraft;
            const result = writer.call(s.f.state, s.draft.state);
            const stillCurrent = result.success ? result.isCurrent() : null;
            return { trace, raw: s.f.storage.getItem(s.f.state.saveKey), memory: JSON.stringify(s.f.state.state),
                notifications: s.f.notifications.map(packet => packet.event === 'saveError' ? { event: 'saveError' } : packet),
                persistence: s.f.persistenceEvents, success: result.success, reason: result.reason, stillCurrent };
        };
        expect(run(false)).toEqual(run(true));
    });

    test('two definite refusals retain one business packet across elapsed-time retries', () => {
        const s = setup(), set = s.f.storage.setItem;
        let refusals = 2, primary = 0;
        s.f.storage.setItem = (key, value) => {
            if (key === s.f.state.saveKey) { primary++; if (refusals-- > 0) throw Error('SYNTHETIC_REFUSAL'); }
            return set(key, value);
        };
        const player = s.draft.state.player, session = s.draft.state.session, root = s.draft.state;
        const result = s.draft.result, events = s.draft.notifications, cache = s.draft.projections.achievements;
        for (const step of [100, 200]) {
            s.f.advanceClock(step); expect(s.commit().success).toBe(false); expect(s.guard.isCurrent()).toBe(true);
            expect(s.f.state.state).toBe(s.original); expect(s.f.storage.getItem(s.f.state.saveKey)).toBe(s.raw);
            expect(s.f.state.saveAdmission).toBe(s.admission);
        }
        s.f.advanceClock(300); expect(s.commit().success).toBe(true); expect(primary).toBe(3);
        expect(root.player.playTime).toBe(600); expect(s.draft.state).toBe(root); expect(root.player).toBe(player); expect(root.session).toBe(session);
        expect(s.draft.result).toBe(result); expect(s.draft.notifications).toBe(events); expect(s.draft.projections.achievements).toBe(cache);
        expect(root.player.cosmicCoins).toBe(800); expect(s.f.persistenceEvents.filter(value => value.event === 'saved')).toHaveLength(1);
    });

    test('committed-then-thrown storage remains one verified primary write', () => {
        const s = setup(), set = s.f.storage.setItem;
        s.f.storage.setItem = (key, value) => { const output = set(key, value); if (key === s.f.state.saveKey) throw Error('SYNTHETIC_LOST_ACK'); return output; };
        s.f.advanceClock(77); const result = s.commit();
        expect(result.success).toBe(true); expect(s.primary).toBe(1); expect(result.isCurrent()).toBe(true); expect(s.guard.isCurrent()).toBe(true);
    });

    const changedProgress = new Set(['coins', 'completed', 'creature-id', 'lineage', 'media-reference', 'ecology', 'debrief',
        'extra-field', 'play-time', 'last-played', 'session-start', 'saved-at']);
    test.each(changes.filter(([key]) => key !== 'state-root'))('post-adoption %s retirement protects only its unchanged reader, never a progress successor', (name, mutate) => {
        const s = setup(); s.f.advanceClock(100);
        let retiredMemory, committedMemory;
        s.f.state.on('syntheticFirst', () => {
            committedMemory = JSON.stringify(s.draft.state); mutate(s.draft); retiredMemory = JSON.stringify(s.draft.state);
        });
        const delivered = [];
        expect(s.commit({ notifications: [{ event: 'syntheticFirst' }, { event: 'syntheticLater' }],
            onNotification: packet => { delivered.push(packet.event); s.f.state.emit(packet.event); } }).success).toBe(false);
        expect(delivered).toEqual(['syntheticFirst']); expect(s.primary).toBe(1);
        expect(s.f.state.state).toBe(s.guard.root); expect(retiredMemory !== committedMemory).toBe(changedProgress.has(name));
        // The existing reader cannot hold changed progress as though it still
        // owned the old bytes. The packet still retires and must never replay.
        expect(s.f.state.getSaveAdmission().status).toBe(changedProgress.has(name) ? 'ready' : 'held');
        expect(JSON.parse(s.f.storage.getItem(s.f.state.saveKey)).levels.mythicalForest.completed).toBe(true);
        expect(s.commit().success).toBe(false); expect(s.primary).toBe(1); expect(JSON.stringify(s.draft.state)).toBe(retiredMemory);
    });

    test.each(['business', 'accounting', 'source', 'successor'])('%s change at the seal is rejected before backup/primary dispatch', kind => {
        const s = setup(); let successor;
        const guard = Object.freeze({ root: s.draft.state, isCurrent: s.guard.isCurrent, sealAccounting(record) {
            if (kind === 'business') s.draft.result.coinsAwarded++;
            if (kind === 'accounting') s.draft.state.player.playTime++;
            if (kind === 'source') s.f.selected.GameState = {};
            if (kind === 'successor') {
                expect(s.f.state.applyExternalSave(s.f.state.createInitialState(), { source: 'synthetic-seal-successor' })).toBe(true);
                successor = { root: s.f.state.state, raw: s.f.storage.getItem(s.f.state.saveKey), admission: s.f.state.saveAdmission };
            }
            s.guard.sealAccounting(record);
        } });
        s.f.advanceClock(100); expect(s.commit({ draftGuard: guard }).success).toBe(false);
        if (kind === 'successor') {
            // The admitted successor itself saves once; the old writer does not.
            expect(s.primary).toBe(1);
            expect(successor).toBeDefined(); expect(s.f.state.state).toBe(successor.root);
            expect(s.f.storage.getItem(s.f.state.saveKey)).toBe(successor.raw); expect(s.f.state.saveAdmission).toBe(successor.admission);
        } else {
            expect(s.primary).toBe(0);
            expect(s.backups).toBe(0); expect(s.f.state.state).toBe(s.original);
            expect(s.f.storage.getItem(s.f.state.saveKey)).toBe(s.raw); expect(s.f.state.saveAdmission).toBe(s.admission);
        }
    });

    const badMethods = [['null', null], ['object', {}], ['async', async function () {}], ['generator', function* () {}],
        ['async-generator', async function* () {}], ['class', class Synthetic {}]];
    for (const key of ['isCurrent', 'sealAccounting']) test.each(badMethods)(key + ' %s shape is rejected before admission/storage access', (_kind, method) => {
        const s = setup(), guard = Object.freeze({ root: s.draft.state, isCurrent() { return true; }, sealAccounting() {}, [key]: method });
        const admission = jest.spyOn(s.f.state, 'canCommitHatchSave'), get = jest.spyOn(s.f.storage, 'getItem');
        expect(s.commit({ draftGuard: guard }).success).toBe(false);
        expect(admission).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(s.primary).toBe(0); expect(s.backups).toBe(0);
    });

    test.each(['null', 'mutable', 'wrong-root', 'extra-key', 'getter'])('%s capability is rejected before effects', kind => {
        const s = setup(); let guard = { root: s.draft.state, isCurrent() { return true; }, sealAccounting() {} }, accessed = 0;
        if (kind === 'null') guard = null;
        if (kind === 'wrong-root') guard.root = clone(s.draft.state);
        if (kind === 'extra-key') guard.extra = false;
        if (kind === 'getter') Object.defineProperty(guard, 'isCurrent', { get() { accessed++; return () => true; } });
        if (guard && kind !== 'mutable') Object.freeze(guard);
        const admission = jest.spyOn(s.f.state, 'canCommitHatchSave'), get = jest.spyOn(s.f.storage, 'getItem');
        expect(s.commit({ draftGuard: guard }).success).toBe(false); expect(accessed).toBe(0);
        expect(admission).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(s.primary).toBe(0); expect(s.backups).toBe(0);
    });

    for (const key of ['isCurrent', 'sealAccounting']) test.each(['throw', 'value', 'promise', 'thenable'])(key + ' %s is not awaited or accepted as work', kind => {
        const s = setup(), then = jest.fn();
        const wrong = () => {
            if (kind === 'throw') throw Error('SYNTHETIC_GUARD_FAILURE');
            if (kind === 'value') return key === 'isCurrent' ? undefined : true;
            if (kind === 'promise') return Promise.reject(Error('SYNTHETIC_REJECTED_WORK'));
            return Object.defineProperty({}, 'then', { get: then });
        };
        const guard = Object.freeze({ root: s.draft.state, isCurrent: s.guard.isCurrent, sealAccounting: s.guard.sealAccounting, [key]: wrong });
        expect(s.commit({ draftGuard: guard }).success).toBe(false); expect(then).not.toHaveBeenCalled();
        expect(s.primary).toBe(0); expect(s.backups).toBe(0); expect(s.f.state.state).toBe(s.original);
    });

    test.each(['validity', 'seal'])('same-capability reentry from %s is refused before nested effects', point => {
        const s = setup(); let nested, entered = false;
        const guard = Object.freeze({ root: s.draft.state,
            isCurrent() {
                if (point === 'validity' && !entered) { entered = true; nested = s.commit({ draftGuard: guard }); }
                return s.guard.isCurrent();
            },
            sealAccounting(record) {
                if (point === 'seal' && !entered) { entered = true; nested = s.commit({ draftGuard: guard }); }
                s.guard.sealAccounting(record);
            } });
        s.f.advanceClock(77); expect(s.commit({ draftGuard: guard }).success).toBe(true);
        expect(nested).toEqual({ success: false, reason: 'hatch_save_unavailable' }); expect(s.primary).toBe(1);
    });

    test.each(['old-version', 'missing-last-played', 'sealed-achievement-cache', 'frozen-thought-cache', 'frozen-quests'])('%s is unsupported, never repaired into the packet', kind => {
        const s = setup();
        if (kind === 'old-version') s.draft.state.version = 'synthetic-old';
        if (kind === 'missing-last-played') delete s.draft.state.player.lastPlayed;
        if (kind === 'sealed-achievement-cache') Object.seal(s.draft.projections.achievements);
        if (kind === 'frozen-thought-cache') Object.freeze(s.draft.projections.thoughtContext);
        if (kind === 'frozen-quests') Object.freeze(s.draft.projections.quests);
        if (kind === 'old-version') {
            const guard = s.capture(); expect(s.commit({ draftGuard: guard }).success).toBe(false); expect(s.draft.state.version).toBe('synthetic-old');
        } else expect(s.capture).toThrow();
        expect(s.primary).toBe(0); expect(s.f.state.state).toBe(s.original);
    });
});
