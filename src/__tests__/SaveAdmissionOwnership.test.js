const GameStateManager = require('../systems/GameState.js');

describe('pre-writer admission errors keep their original owner', () => {
    let state;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear();
        state = new GameStateManager(); expect(state.save()).toBe(true); window.GameState = state;
    });
    afterEach(() => {
        state.stopAutoSave(); jest.restoreAllMocks(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave;
    });
    const snapshot = manager => ({ raw: localStorage.getItem(manager.saveKey), memory: JSON.stringify(manager.state),
        storage: { ...localStorage }, admission: manager.getSaveAdmission(), mode: manager.storageMode,
        lease: manager.cloudWriteLease, global: window.GameState, cloud: window.CloudSave });
    function invalid(manager, kind = 'version_mismatch') {
        const value = manager.createSaveSnapshot();
        if (kind === 'version_mismatch') value.version = '2.0.0';
        else value.breedingShrine.sharedFusion.completedOperationIds = Array.from(
            { length: 26 }, (_, i) => `fusion_shared_fictional_${i}`);
        return value;
    }
    function invoke(operation, value) {
        if (operation === 'save') return state.save();
        if (operation === 'load') return state.load();
        if (operation === 'external') return state.validateExternalSaveAdmission(value, 'fictional');
        if (operation === 'permission') return state.canPersistSave();
        try { return state.commitPreparedSave({ state: value, serialized: JSON.stringify(value) }); }
        catch (error) { return false; }
    }
    for (const operation of ['save', 'load', 'external', 'permission', 'prepared']) {
        test.each(['version_mismatch', 'save_would_lose_history'])(
            `${operation} retains its current-owner %s hold`, reason => {
                const value = invalid(state, reason), raw = JSON.stringify(value);
                if (operation !== 'prepared') localStorage.setItem(state.saveKey, raw);
                const before = snapshot(state);
                expect(invoke(operation, value)).toBe(false);
                expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason });
                expect(localStorage.getItem(state.saveKey)).toBe(before.raw);
                expect(JSON.stringify(state.state)).toBe(before.memory);
                expect(invoke(operation, value)).toBe(false);
                expect(localStorage.getItem(state.saveKey)).toBe(before.raw);
            });
        test.each(['new-game', 'unsaved-memory', 'epoch', 'raw-only', 'global', 'cloud', 'lease'])(
            `${operation} stops after a hold callback adopts %s`, change => {
                const value = invalid(state), raw = JSON.stringify(value);
                if (operation !== 'prepared') localStorage.setItem(state.saveKey, raw);
                const errors = jest.fn(), warnings = jest.spyOn(state, 'showStorageWarning').mockImplementation(() => {});
                let successor;
                const off = state.on('saveAdmissionChanged', admission => {
                    if (admission.status !== 'held') return;
                    off();
                    if (change === 'new-game') expect(state.startFreshGame()).toBe(true);
                    if (change === 'unsaved-memory') state.set('player.cosmicCoins', 77);
                    if (change === 'epoch') state.releaseSaveAdmission();
                    if (change === 'raw-only') localStorage.setItem(state.saveKey, JSON.stringify(state.createInitialState()));
                    if (change === 'global') window.GameState = {};
                    if (change === 'cloud') window.CloudSave = {};
                    if (change === 'lease') state.cloudWriteLease = { isCurrentCampaign: () => true };
                    successor = snapshot(state);
                    state.on('loadError', errors); state.on('saveError', errors); state.on('versionMismatch', errors);
                });
                expect(invoke(operation, value)).toBe(false);
                expect(successor).toBeDefined(); expect(snapshot(state)).toEqual(successor);
                expect(errors).not.toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
            });
    }
    test.each(['storageWarning', 'loadError'])(
        'load stops its remaining effects after a %s callback starts New Game', event => {
            localStorage.setItem(state.saveKey, JSON.stringify(invalid(state)));
            let successor;
            const off = state.on(event, () => {
                off(); expect(state.startFreshGame()).toBe(true); successor = snapshot(state);
            });
            const version = jest.fn(); state.on('versionMismatch', version);
            expect(state.load()).toBe(false); expect(successor).toBeDefined();
            expect(snapshot(state)).toEqual(successor); expect(version).not.toHaveBeenCalled();
        });
    test('unsupported incoming evidence cannot re-hold New Game from a backup notification', () => {
        const value = invalid(state);
        let successor;
        const off = state.on('saveBackupCreated', () => {
            off(); expect(state.startFreshGame()).toBe(true); successor = snapshot(state);
        });
        expect(state.validateExternalSaveAdmission(value, 'fictional')).toBe(false);
        expect(successor).toBeDefined(); expect(snapshot(state)).toEqual(successor);
    });
    for (const operation of ['save', 'load', 'external', 'permission']) {
        test.each([
            ['before-hold', false], ['before-hold', true], ['after-hold', false], ['after-hold', true]
        ])(`${operation} brackets an observed %s read that retires then throws=%s`, (phase, throws) => {
            const value = invalid(state), raw = JSON.stringify(value); localStorage.setItem(state.saveKey, raw);
            const prepare = state.prepareSaveCandidate, get = Storage.prototype.getItem;
            let armed = false, intercepted = false, successor;
            const errors = jest.fn(), warnings = jest.spyOn(state, 'showStorageWarning').mockImplementation(() => {});
            jest.spyOn(state, 'prepareSaveCandidate').mockImplementation(function (...args) {
                try { return prepare.apply(this, args); }
                catch (error) { if (phase === 'before-hold') armed = true; throw error; }
            });
            state.on('saveAdmissionChanged', admission => {
                if (phase === 'after-hold' && admission.status === 'held') armed = true;
            });
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
                const result = get.call(this, key);
                if (key === state.saveKey && armed && !intercepted) {
                    intercepted = true; expect(state.startFreshGame()).toBe(true); successor = snapshot(state);
                    state.on('saveError', errors); state.on('loadError', errors); state.on('versionMismatch', errors);
                    if (throws) throw Error('Fictional read failed after retirement');
                }
                return result;
            });
            expect(invoke(operation, value)).toBe(false); expect(intercepted).toBe(true);
            expect(successor).toBeDefined(); expect(snapshot(state)).toEqual(successor);
            expect(successor.admission.status).toBe('ready');
            expect(errors).not.toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
        });
    }
    test('a same-memory raw-only replacement during error observation is protected, not adopted', () => {
        localStorage.setItem(state.saveKey, JSON.stringify(invalid(state)));
        const prepare = state.prepareSaveCandidate, get = Storage.prototype.getItem, memory = JSON.stringify(state.state);
        const replacement = JSON.stringify(state.createInitialState());
        let armed = false, intercepted = false;
        jest.spyOn(state, 'prepareSaveCandidate').mockImplementation(function (...args) {
            try { return prepare.apply(this, args); } catch (error) { armed = true; throw error; }
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            const result = get.call(this, key);
            if (key === state.saveKey && armed && !intercepted) {
                intercepted = true; localStorage.setItem(key, replacement);
            }
            return result;
        });
        expect(state.load()).toBe(false); expect(intercepted).toBe(true);
        expect(localStorage.getItem(state.saveKey)).toBe(replacement); expect(JSON.stringify(state.state)).toBe(memory);
        expect(state.getSaveAdmission().status).toBe('held');
    });
    test('an atomic migration primary refusal still reports its current-owner failure truthfully', () => {
        const raw = JSON.stringify({ version: '1.0.0', savedAt: 23, player: { cosmicCoins: 42 }, creature: { hatched: false } });
        localStorage.setItem(state.saveKey, raw);
        const memory = JSON.stringify(state.state), set = Storage.prototype.setItem;
        const warning = jest.spyOn(state, 'showStorageWarning').mockImplementation(() => {}), errors = jest.fn();
        state.on('loadError', errors);
        let refused = false;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey && !refused) { refused = true; throw Error('Fictional atomic primary refusal'); }
            return set.call(this, key, value);
        });
        expect(state.load()).toBe(false); expect(refused).toBe(true);
        expect(localStorage.getItem(state.saveKey)).toBe(raw); expect(JSON.stringify(state.state)).toBe(memory);
        expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
        expect(warning).toHaveBeenCalledWith(expect.stringMatching(/could not be confirmed/i));
        expect(errors).toHaveBeenCalledTimes(1); expect(errors.mock.calls[0][0].type).toBe('commit_failed');
    });
});
