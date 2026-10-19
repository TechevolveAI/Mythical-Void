const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm');
const GameStateManager = require('../systems/GameState.js');
const { compiledModuleSource } = require('./support/compiledInventorySource.cjs');
const currentCode = compiledModuleSource('systems/ThoughtBubbleSystem.js');
const previousCode = readPinnedSource('dbb01847:src/systems/ThoughtBubbleSystem.js')
    .replace('export default thoughtBubbleSystem;', '');
const planModule = { exports: {} };
vm.runInNewContext(compiledModuleSource('dev/CompletionThoughtDraft.js'), { module: planModule });
const calculate = planModule.exports.calculateCompletionThoughtDraft;
const now = 1700000000777, clone = value => JSON.parse(JSON.stringify(value));
function load(state, { code = currentCode, sceneWindow = { GameState: state }, initialise = true } = {}) {
    const logs = [], sandbox = { module: { exports: {} }, window: sceneWindow, Date,
        console: { log: (...args) => logs.push(clone(args)), warn() {}, error() {} } };
    vm.runInNewContext(code, sandbox); const manager = sceneWindow.ThoughtBubbleSystem;
    if (initialise) manager.initialize();
    return { manager, sceneWindow, logs };
}

describe('actual ThoughtBubble live rules, not the historical copied test model', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
    const run = (code, saved, operations) => {
        const root = saved === undefined ? {} : { thoughtContext: clone(saved) }, trace = [];
        const state = { state: root, saveAdmission: { status: 'ready', epoch: 1 },
            get: key => { trace.push({ kind: 'get', key }); return root[key]; },
            set: (key, value) => { root[key] = value; trace.push({ kind: 'set', key, value: clone(value) }); } };
        const f = load(state, { code });
        for (const [method, value] of operations) f.manager[method](value);
        return { context: clone(f.manager.context), saved: clone(root), aliases: root.thoughtContext === f.manager.context, trace, logs: f.logs };
    };
    test.each([
        ['new context', undefined, [['recordSuccess', 'mythical_forest_1']]],
        ['partial stored context', { recentFailures: 5, retained: { synthetic: false } }, [['setBiome', 'forest'], ['recordSuccess', 'mythical_forest_1']]],
        ['three failures then success', undefined, [['recordFailure', 'void_peaks_1'], ['recordFailure', 'void_peaks_1'], ['recordFailure', 'void_peaks_1'], ['recordSuccess', 'void_peaks_1']]],
        ['different failed level', undefined, [['recordFailure', 'mythical_forest_1'], ['recordFailure', 'void_peaks_1'], ['recordSuccess', 'void_peaks_1']]],
        ['saved alias and biome', { recentFailures: 4 }, [['saveContext'], ['setBiome', 'reef'], ['recordSuccess', 'cosmic_reef_1']]],
        ['repeat success', { recentFailures: 7 }, [['recordSuccess', 'final_void_1'], ['recordSuccess', 'final_void_1']]],
        ['same-source reload', { recentFailures: 3, totalAttempts: 8 }, [['setBiome', 'forest'], ['loadContextFromGameState'], ['recordSuccess', 'mythical_forest_1']]],
        ['legacy string counter live behaviour', { recentFailures: '5' }, [['recordSuccess', 'mythical_forest_1']]]
    ])('%s preserves original data, alias, read/write and log ordering', (_label, saved, operations) => {
        expect(run(currentCode, saved, operations)).toEqual(run(previousCode, saved, operations));
    });
});

describe('unused Thought completion plan and original-source publication', () => {
    let states;
    beforeEach(() => {
        states = []; jest.useFakeTimers(); jest.setSystemTime(now); localStorage.clear();
        for (const key of ['CloudSave', 'GameState', 'ThoughtBubbleSystem']) delete window[key];
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
    });
    afterEach(() => {
        states.forEach(state => state.stopAutoSave()); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['CloudSave', 'GameState', 'ThoughtBubbleSystem']) delete window[key];
    });
    function fixture(saved, initialise = true) {
        const state = new GameStateManager(); states.push(state); window.GameState = state;
        if (saved !== undefined) state.set('thoughtContext', clone(saved));
        expect(state.save()).toBe(true);
        jest.spyOn(state, 'set');
        return { state, ...load(state, { sceneWindow: window, initialise }) };
    }
    const observe = f => ({ root: f.state.state, memory: JSON.stringify(f.state.get()), context: f.manager.context,
        data: clone(f.manager.context), raw: localStorage.getItem(f.state.saveKey), admission: f.state.getSaveAdmission() });

    test.each(['absent', 'separate-merge', 'saved-alias', 'known-failures', 'known-biome', 'alias-biome'])('%s plan matches actual class transition and ordered state notifications', mode => {
        const saved = mode === 'absent' ? undefined : { recentFailures: 5, totalAttempts: 7, retained: { synthetic: [false, 0] } };
        const f = fixture(saved);
        if (mode === 'saved-alias' || mode === 'alias-biome') f.manager.saveContext();
        if (mode === 'known-failures') { f.manager.recordFailure('void_peaks_1'); f.manager.recordFailure('void_peaks_1'); }
        if (mode === 'known-biome' || mode === 'alias-biome') f.manager.setBiome('void_peaks');
        const source = f.manager.captureCompletionContextSource(), before = observe(f), events = [];
        const packet = calculate(source, 'void_peaks_1', now);
        expect(source.status).toBe('captured'); expect(packet.status).toBe('calculated'); expect(observe(f)).toEqual(before);
        expect(Object.isFrozen(packet.context)).toBe(true); expect(Object.isFrozen(f.manager.context)).toBe(false);
        const emit = f.state.emit.bind(f.state);
        f.state.emit = (event, data) => { if (event === 'stateChanged' || event === 'changed:thoughtContext') events.push(clone({ kind: 'state', event, data })); return emit(event, data); };
        f.manager.recordSuccess('void_peaks_1');
        expect(packet.context).toEqual(f.manager.context); expect(packet.notifications).toEqual(events);
        expect(f.manager.context).toBe(f.state.get('thoughtContext')); expect(source.isCurrent()).toBe(false);
        expect(f.manager.captureCompletionContextSource().status).toBe('captured');
    });

    test('calculation performs no live mutation, storage write, notification, clock read or repeated decay', () => {
        const f = fixture({ recentFailures: 5 }), source = f.manager.captureCompletionContextSource(), before = observe(f);
        const effects = ['set', 'save', 'emit', 'holdSaveAdmission'].map(name => jest.spyOn(f.state, name).mockImplementation(() => { throw Error('THOUGHT_LIVE_EFFECT_FORBIDDEN'); }));
        const write = jest.spyOn(Storage.prototype, 'setItem'), clock = jest.spyOn(Date, 'now');
        const first = calculate(source, 'void_peaks_1', now), second = calculate(source, 'void_peaks_1', now);
        expect(first.status).toBe('calculated'); expect(first).toEqual(second); expect(first.context.recentFailures).toBe(3);
        expect(observe(f)).toEqual(before); effects.forEach(effect => expect(effect).not.toHaveBeenCalled());
        expect(write).not.toHaveBeenCalled(); expect(clock).not.toHaveBeenCalled();
    });

    test.each([
        ['context replaced', f => { f.manager.context = clone(f.manager.context); }],
        ['unexpected cache edit', f => { f.manager.context.recentFailures++; }],
        ['canonical replaced', f => { f.state.state.thoughtContext = clone(f.state.get('thoughtContext')); }],
        ['canonical edited', f => { f.state.get('thoughtContext').retained.synthetic = true; }],
        ['admitted root replaced', f => { f.state.state = clone(f.state.state); }],
        ['manager replaced', () => { window.ThoughtBubbleSystem = {}; }],
        ['state replaced', () => { window.GameState = {}; }],
        ['method replaced', f => { f.manager.recordSuccess = () => {}; }],
        ['state getter replaced', f => { f.state.get = key => f.state.state[key]; }],
        ['owner capture replaced', f => { f.state.captureSaveAdmissionOwner = () => ({ isCurrent: () => true }); }],
        ['destroyed service', f => { f.manager.isInitialized = false; }],
        ['held admission', f => { f.state.holdSaveAdmission({ code: 'commit_failed' }, 'synthetic'); }]
    ])('%s retires the old calculation, never rebases it', (_label, change) => {
        const f = fixture({ recentFailures: 5, retained: { synthetic: false } }), source = f.manager.captureCompletionContextSource();
        change(f); const before = observe(f);
        expect(source.isCurrent()).toBe(false); expect(calculate(source, 'void_peaks_1', now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('original raw-observed reader protects another stored save without holding or resetting it', () => {
        const f = fixture(), reader = f.state.captureSaveAdmissionOwner({ raw: localStorage.getItem(f.state.saveKey) });
        const source = f.manager.captureCompletionContextSource({ reader });
        expect(source.scope).toBe('provided-owner-and-loaded-thought-context');
        localStorage.setItem(f.state.saveKey, '{synthetic-successor'); const before = observe(f);
        expect(calculate(source, 'void_peaks_1', now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test('replacing the supplied reader method cannot claim new ownership', () => {
        const f = fixture(), reader = f.state.captureSaveAdmissionOwner(), source = f.manager.captureCompletionContextSource({ reader });
        reader.isCurrent = () => true; expect(source.isCurrent()).toBe(false);
    });

    test('a loaded source is not invented by setting the initialised flag', () => {
        const f = fixture(undefined, false); f.manager.isInitialized = true;
        expect(f.manager.captureCompletionContextSource().status).toBe('unqualified');
    });

    test('a newly admitted source requires the real loader, preserving its existing merge rather than clearing context', () => {
        const f = fixture({ recentFailures: 5, retained: { synthetic: false } }), source = f.manager.captureCompletionContextSource();
        const incoming = f.state.createInitialState(); incoming.thoughtContext = { recentFailures: 2, totalAttempts: 4, syntheticNew: true };
        expect(f.state.applyExternalSave(incoming, { source: 'synthetic', persist: true })).toBe(true);
        const before = observe(f); expect(source.isCurrent()).toBe(false); expect(f.manager.captureCompletionContextSource().status).toBe('unqualified');
        expect(observe(f)).toEqual(before); f.manager.initialize();
        expect(f.manager.context).toMatchObject({ recentFailures: 2, totalAttempts: 4, retained: { synthetic: false }, syntheticNew: true });
        expect(f.manager.context).not.toBe(f.state.get('thoughtContext')); expect(f.manager.captureCompletionContextSource().status).toBe('captured');
    });

    test('publication refuses frozen caches and cannot run before verified adoption', () => {
        const f = fixture({ recentFailures: 5 }), source = f.manager.captureCompletionContextSource(), plan = calculate(source, 'void_peaks_1', now);
        const publication = f.manager.captureCompletionContextPublication(), before = observe(f), staged = clone(f.state.state);
        staged.thoughtContext = plan.context;
        expect(() => publication.prepare(staged, plan.context)).toThrow('THOUGHT_PUBLICATION_NOT_PREPARED');
        staged.thoughtContext = clone(plan.context); publication.prepare(staged, plan.context);
        expect(() => publication.publish()).toThrow('THOUGHT_PUBLICATION_RETIRED'); expect(observe(f)).toEqual(before);
        expect(source.isCurrent()).toBe(true);
    });

    test.each(['string-counter', 'null-counter', 'array-context'])('%s remains intact but unqualified', kind => {
        const f = fixture(kind === 'array-context' ? [] : { recentFailures: kind === 'string-counter' ? '5' : null });
        const before = observe(f), source = f.manager.captureCompletionContextSource();
        expect(calculate(source, 'void_peaks_1', now).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test.each([['', now], [undefined, now], ['void_peaks_1', NaN], ['void_peaks_1', -1]])('invalid completion facts stay unqualified (%s, %s)', (levelId, time) => {
        const f = fixture(), source = f.manager.captureCompletionContextSource(), before = observe(f);
        expect(calculate(source, levelId, time).status).toBe('unqualified'); expect(observe(f)).toEqual(before);
    });

    test.each(['ordinary', 'refusal-then-retry', 'committed-then-thrown', 'raw-successor-before-commit', 'memory-successor-before-commit', 'service-replaced-during-publication'])('actual local writer and prepared Thought cache: %s', mode => {
        const f = fixture({ recentFailures: 5, retained: { synthetic: false } });
        let armed = false; const successor = { context: { syntheticUntouched: true } };
        if (mode === 'service-replaced-during-publication') {
            f.manager = new Proxy(f.manager, { set(target, key, value) {
                Reflect.set(target, key, value); if (armed && key === 'context') window.ThoughtBubbleSystem = successor; return true;
            } });
            window.ThoughtBubbleSystem = f.manager; f.manager.initialize();
        }
        const owner = f.state.state, epoch = f.state.getSaveAdmission().epoch, raw = localStorage.getItem(f.state.saveKey);
        const reader = f.state.captureSaveAdmissionOwner({ raw }), memoryOwner = f.state.captureSaveAdmissionOwner();
        const source = f.manager.captureCompletionContextSource({ reader }), publication = f.manager.captureCompletionContextPublication();
        const plan = calculate(source, 'void_peaks_1', now); expect(plan.status).toBe('calculated');
        const staged = clone(owner); staged.thoughtContext = clone(plan.context); publication.prepare(staged, plan.context);
        const current = () => window.GameState === f.state && window.ThoughtBubbleSystem === f.manager &&
            f.state.getSaveAdmission().epoch === epoch && publication.isCurrent() &&
            (f.state.state === owner ? memoryOwner.isCurrent() : f.state.state === staged);
        const publish = jest.fn(() => { armed = true; publication.publish(); });
        let saved = 0;
        f.state.on('saved', () => { saved++; expect(f.manager.context).toBe(staged.thoughtContext); expect(publication.isPublished()).toBe(true); });
        let refuse = mode === 'refusal-then-retry'; const write = Storage.prototype.setItem, writes = [];
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === f.state.saveKey) {
                writes.push(value); if (refuse) throw Error('SYNTHETIC_PRIMARY_REFUSED');
                write.call(this, key, value); if (mode === 'committed-then-thrown') throw Error('SYNTHETIC_LOST_ACK');
                return;
            }
            return write.call(this, key, value);
        });
        const commit = () => !reader.isCurrent() ? { success: false, reason: 'source_retired' } : f.state.commitHatchSaveDraft(staged, {
            isCurrentCampaign: current, isCurrentResult: (live, durable, serialized) => live === staged &&
                JSON.stringify(f.state.createSaveSnapshot({ state: live })) === serialized && JSON.stringify(durable) === serialized,
            onPublished: publish, notifications: plan.notifications,
            onNotification: packet => { f.state.emit(packet.event, packet.data); }
        });
        if (mode.endsWith('before-commit')) {
            if (mode.startsWith('raw')) { const next = JSON.parse(raw); next.player.cosmicCoins = 77; localStorage.setItem(f.state.saveKey, JSON.stringify(next)); writes.length = 0; }
            else f.state.state = clone(owner);
            const before = observe(f); expect(commit()).toEqual({ success: false, reason: 'source_retired' });
            expect(observe(f)).toEqual(before); expect(writes).toHaveLength(0); expect(publish).not.toHaveBeenCalled(); return;
        }
        if (refuse) {
            expect(commit().success).toBe(false); expect(f.state.state).toBe(owner); expect(localStorage.getItem(f.state.saveKey)).toBe(raw);
            expect(f.manager.context.recentFailures).toBe(5); expect(source.isCurrent()).toBe(true); expect(publish).not.toHaveBeenCalled(); refuse = false;
        }
        const result = commit();
        if (mode === 'service-replaced-during-publication') {
            expect(result).toEqual({ success: false, reason: 'hatch_context_changed' }); expect(saved).toBe(0);
            expect(window.ThoughtBubbleSystem).toBe(successor); expect(successor.context).toEqual({ syntheticUntouched: true });
            expect(JSON.parse(localStorage.getItem(f.state.saveKey)).thoughtContext.recentFailures).toBe(3);
            expect(commit()).toEqual({ success: false, reason: 'source_retired' }); expect(writes).toHaveLength(1);
            return;
        }
        if (!result.success) throw Error(JSON.stringify({ result, admission: f.state.getSaveAdmission(), current: current(), published: publish.mock.calls.length }));
        expect(result.isCurrent()).toBe(true); expect(saved).toBe(1); expect(publish).toHaveBeenCalledTimes(1);
        expect(f.manager.context).toBe(f.state.get('thoughtContext')); expect(f.manager.context.recentFailures).toBe(3);
        expect(JSON.parse(localStorage.getItem(f.state.saveKey)).thoughtContext).toEqual(plan.context);
        expect(f.manager.captureCompletionContextSource().status).toBe('captured'); expect(writes).toHaveLength(mode === 'refusal-then-retry' ? 2 : 1);
        owner.thoughtContext.recentFailures = 99;
        expect(publication.isPublished()).toBe(true); expect(result.isCurrent()).toBe(true);
        expect(f.manager.context.recentFailures).toBe(3);
    });
});
