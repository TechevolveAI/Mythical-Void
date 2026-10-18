const { fixture } = require('./support/levelCompletionFixture.cjs');

describe('bounded runtime-only interval autosave deferral', () => {
    let owned;
    beforeEach(() => { owned = []; });
    afterEach(() => owned.forEach(f => f.close()));
    const create = () => { const f = fixture({ controlledTimers: true }); owned.push(f); return f; };

    test('default interval and explicit saves are unchanged without a deferral', () => {
        const f = create(); f.state.startAutoSave(); f.advanceClock(1000); f.fireIntervals();
        expect(f.calls).toEqual([{ save: true }]); expect(f.state.get('player.playTime')).toBe(1000);
    });
    test('acquiring deferral changes no saved data, raw bytes, timer or admission', () => {
        const f = create(); f.state.startAutoSave();
        const root = f.state.state, data = JSON.stringify(root), raw = f.storage.getItem(f.state.saveKey), timer = f.state.autoSaveInterval, admission = f.state.saveAdmission;
        const owner = f.state.deferAutoSave(() => true);
        expect(Object.isFrozen(owner)).toBe(true); expect(owner.isCurrent()).toBe(true);
        f.advanceClock(61000); f.fireIntervals(); f.fireIntervals();
        expect(f.calls).toEqual([]); expect(f.state.state).toBe(root); expect(JSON.stringify(root)).toBe(data);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.state.autoSaveInterval).toBe(timer); expect(f.state.saveAdmission).toBe(admission);
        owner.release(); owner.release(); expect(owner.isCurrent()).toBe(false); f.fireIntervals();
        expect(f.calls).toEqual([{ save: true }]); expect(f.state.get('player.playTime')).toBe(61000);
    });
    test('explicit user saves are not suppressed or redirected by an interval deferral', () => {
        const f = create(), owner = f.state.deferAutoSave(() => true);
        expect(f.state.save()).toBe(true); expect(f.calls).toEqual([{ save: true }]); expect(owner.isCurrent()).toBe(true);
    });
    test('retiring the original owner resumes its existing interval automatically', () => {
        const f = create(); f.state.startAutoSave(); let live = true;
        const owner = f.state.deferAutoSave(() => live); f.fireIntervals(); expect(f.calls).toEqual([]);
        live = false; f.advanceClock(1000); f.fireIntervals(); expect(f.calls).toEqual([{ save: true }]); expect(owner.isCurrent()).toBe(false);
    });
    test('a second live owner is refused and release of a retired owner cannot clear its successor', () => {
        const f = create(); f.state.startAutoSave(); let live = true;
        const old = f.state.deferAutoSave(() => live);
        expect(() => f.state.deferAutoSave(() => true)).toThrow('AUTOSAVE_ALREADY_DEFERRED');
        live = false; const next = f.state.deferAutoSave(() => true); old.release();
        expect(next.isCurrent()).toBe(true); f.fireIntervals(); expect(f.calls).toEqual([]);
        next.release(); f.fireIntervals(); expect(f.calls).toEqual([{ save: true }]);
    });
    test('a throwing retired predicate does not stop ordinary autosave indefinitely', () => {
        const f = create(); f.state.startAutoSave(); let fail = false;
        const owner = f.state.deferAutoSave(() => { if (fail) throw Error('SYNTHETIC_RETIRED_OWNER'); return true; });
        fail = true; f.fireIntervals(); expect(f.calls).toEqual([{ save: true }]); expect(owner.isCurrent()).toBe(false);
    });
    test.each([null, false, {}, async function () {}, function* () {}, class Synthetic {}])('invalid owner %p has no storage, timer or admission effects', predicate => {
        const f = create(), raw = f.storage.getItem(f.state.saveKey), data = JSON.stringify(f.state.state), admission = f.state.saveAdmission;
        expect(() => f.state.deferAutoSave(predicate)).toThrow('AUTOSAVE_OWNER_UNAVAILABLE');
        expect(f.calls).toEqual([]); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(JSON.stringify(f.state.state)).toBe(data); expect(f.state.autoSaveInterval).toBeNull(); expect(f.state.saveAdmission).toBe(admission);
    });
    test.each(['false', 'throw', 'promise', 'thenable'])('%s result never becomes a live deferral', kind => {
        const f = create(), then = jest.fn();
        const predicate = () => {
            if (kind === 'throw') throw Error('SYNTHETIC_OWNER_FAILURE');
            if (kind === 'promise') return Promise.reject(Error('SYNTHETIC_REJECTED_OWNER'));
            if (kind === 'thenable') return Object.defineProperty({}, 'then', { get: then });
            return false;
        };
        expect(() => f.state.deferAutoSave(predicate)).toThrow(); expect(then).not.toHaveBeenCalled(); expect(f.calls).toEqual([]);
        const current = f.state.deferAutoSave(() => true); expect(current.isCurrent()).toBe(true); current.release();
    });
});
