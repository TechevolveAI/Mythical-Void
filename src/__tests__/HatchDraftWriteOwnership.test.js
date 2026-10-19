const GameStateManager = require('../systems/GameState.js');

function fixture() {
    const state = new GameStateManager();
    expect(state.save()).toBe(true);
    window.GameState = state;
    const staged = JSON.parse(JSON.stringify(state.state));
    staged.player.cosmicCoins = 42;
    let currentScene = true;
    const snapshot = () => ({ raw: localStorage.getItem(state.saveKey), memory: JSON.stringify(state.state),
        admission: state.getSaveAdmission(), mode: state.storageMode, lease: state.cloudWriteLease,
        journal: localStorage.getItem(state.saveBackupIndexKey) });
    return { state, staged, snapshot, retire: () => { currentScene = false; },
        commit: () => state.commitHatchSaveDraft(staged, {
            isCurrentCampaign: () => currentScene && window.GameState === state,
            isCurrentResult: (live, durable) => live.player.cosmicCoins === 42 && durable.player.cosmicCoins === 42
        }) };
}

describe('the shared hatch draft writer cannot protect or notify a successor as its old error', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); delete window.GameState; });

    function change(f, kind) {
        if (kind === 'new-game') expect(f.state.startFreshGame()).toBe(true);
        if (['saved-progress', 'unsaved-progress'].includes(kind)) {
            f.state.set('player.cosmicCoins', 77);
            if (kind === 'saved-progress') expect(f.state.save()).toBe(true);
        }
        if (kind === 'admission') f.state.holdSaveAdmission({ code: 'fictional_hold' }, 'fictional');
        if (kind === 'epoch') f.state.releaseSaveAdmission();
        if (kind === 'upload') f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
        if (kind === 'scene') f.retire();
        if (kind === 'global-manager') window.GameState = {};
        if (kind === 'raw-only') {
            const supported = f.state.createSaveSnapshot(); supported.player.cosmicCoins = 77;
            localStorage.setItem(f.state.saveKey, JSON.stringify(supported));
        }
    }

    for (const boundary of ['backup', 'primary', 'readback']) {
        test.each(['new-game', 'saved-progress', 'unsaved-progress', 'admission', 'epoch',
            'upload', 'scene', 'global-manager', 'raw-only'])(`${boundary} / %s retires the old writer without poisoning progress`, kind => {
            const f = fixture(), oldError = jest.fn(), saved = jest.fn();
            const set = Storage.prototype.setItem, get = Storage.prototype.getItem;
            let successor, intercepted = false, wrote = false;
            const retire = () => {
                if (intercepted) return;
                intercepted = true; change(f, kind); successor = f.snapshot();
                f.state.on('saveError', oldError); f.state.on('saved', saved);
            };
            if (boundary === 'backup') {
                const off = f.state.on('saveBackupCreated', () => { off(); retire(); });
            } else {
                jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                    const result = set.call(this, key, value);
                    if (key === f.state.saveKey) {
                        wrote = true;
                        if (boundary === 'primary') retire();
                    }
                    return result;
                });
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
                    if (boundary === 'readback' && wrote && key === f.state.saveKey) retire();
                    return get.call(this, key);
                });
            }
            try {
                expect(f.commit().success).toBe(false);
                expect(successor).toBeDefined();
                const after = f.snapshot();
                expect(oldError).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
                if (kind === 'raw-only') {
                    expect({ ...after, admission: successor.admission }).toEqual(successor);
                    expect(after.admission).toMatchObject({ status: 'held', reason: 'commit_failed' });
                    expect(f.state.save()).toBe(false); expect(localStorage.getItem(f.state.saveKey)).toBe(successor.raw);
                    expect(oldError).toHaveBeenCalledTimes(1); // The new refused save reports its own error.
                } else expect(after).toEqual(successor);
            } finally { f.state.stopAutoSave(); }
        });
    }

    test.each(['new-game', 'saved-progress', 'unsaved-progress', 'upload', 'scene', 'global-manager'])(
        'a protective hold callback / %s cannot receive a later stale saveError', kind => {
            const f = fixture(), set = Storage.prototype.setItem;
            const oldError = jest.fn(); let intercepted = false, successor;
            const off = f.state.on('saveAdmissionChanged', admission => {
                if (admission.status !== 'held') return;
                off();
                // The fixture's explicit recovery action is not an old-writer permission.
                if (kind !== 'new-game') f.state.releaseSaveAdmission();
                change(f, kind); successor = f.snapshot(); f.state.on('saveError', oldError);
            });
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey && !intercepted) {
                    intercepted = true;
                    const unverified = JSON.parse(value); unverified.player.cosmicCoins = 99;
                    set.call(this, key, JSON.stringify(unverified));
                    throw Error('FICTIONAL_UNVERIFIED_ACK');
                }
                return result;
            });
            try {
                expect(f.commit().success).toBe(false); expect(successor).toBeDefined();
                expect(f.snapshot()).toEqual(successor); expect(oldError).not.toHaveBeenCalled();
            } finally { off(); f.state.stopAutoSave(); }
        }
    );

    test.each(['new-game', 'saved-progress', 'unsaved-progress', 'scene', 'global-manager'])(
        'saveError / %s remains the last old-writer action', kind => {
            const f = fixture(), set = Storage.prototype.setItem; let successor;
            const off = f.state.on('saveError', () => { off(); change(f, kind); successor = f.snapshot(); });
            let refuse = true;
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                if (key === f.state.saveKey && refuse) { refuse = false; throw Error('FICTIONAL_REFUSAL'); }
                return set.call(this, key, value);
            });
            try {
                expect(f.commit().success).toBe(false); expect(successor).toBeDefined();
                expect(f.snapshot()).toEqual(successor);
            } finally { f.state.stopAutoSave(); }
        }
    );

    test('an exact independently verified write-then-throw retains the established positive-proof policy', () => {
        const f = fixture(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) throw Error('FICTIONAL_LOST_ACK');
            return result;
        });
        const result = f.commit();
        expect(result.success).toBe(true); expect(result.isCurrent()).toBe(true);
        expect(JSON.parse(localStorage.getItem(f.state.saveKey)).player.cosmicCoins).toBe(42);
        expect(f.state.getSaveAdmission().status).toBe('ready');
    });

    test('unreadable post-write bytes remain protected without rollback or success', () => {
        const f = fixture(), set = Storage.prototype.setItem, get = Storage.prototype.getItem;
        let wrote = false, attempted;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            const result = set.call(this, key, value);
            if (key === f.state.saveKey) { wrote = true; attempted = String(value); }
            return result;
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (wrote && key === f.state.saveKey) throw Error('FICTIONAL_READBACK_FAILURE');
            return get.call(this, key);
        });
        expect(f.commit().success).toBe(false);
        expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
        expect(get.call(localStorage, f.state.saveKey)).toBe(attempted);
        expect(f.state.get('player.cosmicCoins')).not.toBe(42);
    });

    test('a published result protects its unchanged reader from later raw-only divergence', () => {
        const f = fixture(), result = f.commit(); expect(result.success).toBe(true);
        const memory = JSON.stringify(f.state.state), changed = f.state.createSaveSnapshot();
        changed.player.cosmicCoins = 77; const raw = JSON.stringify(changed);
        localStorage.setItem(f.state.saveKey, raw);
        expect(result.isCurrent()).toBe(false);
        expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.state.save()).toBe(false);
        expect(localStorage.getItem(f.state.saveKey)).toBe(raw);
    });

    test('a published result does not hold later adopted progress', () => {
        const f = fixture(), result = f.commit(); expect(result.success).toBe(true);
        f.state.set('player.cosmicCoins', 77); expect(f.state.save()).toBe(true);
        const successor = f.snapshot(); expect(result.isCurrent()).toBe(false);
        expect(f.snapshot()).toEqual(successor); expect(f.state.getSaveAdmission().status).toBe('ready');
    });
});
