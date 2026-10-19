const GameStateManager = require('../systems/GameState.js');

// Actual save owners and jsdom Storage, fictional progress and callbacks only.
// No cloud client, provider, game, browser process or real player record.
function fixture(operation) {
    const state = new GameStateManager();
    expect(state.save()).toBe(true);
    state.set('player.cosmicCoins', 11);
    const incoming = state.createInitialState(); incoming.player.cosmicCoins = 42;
    const prepared = state.prepareSaveCandidate(incoming);
    let backup;
    if (operation === 'restore') backup = state.createLocalSaveBackup(prepared.serialized, 'synthetic_prior');
    if (operation === 'migration') {
        localStorage.setItem(state.saveKey, JSON.stringify({ version: '1.0.0', savedAt: 23,
            player: { cosmicCoins: 42 }, creature: { hatched: false } }));
    }
    const raw = () => localStorage.getItem(state.saveKey);
    const invoke = () => {
        if (operation === 'save') return state.save();
        if (operation === 'prepared') return state.commitPreparedSave(prepared, { source: 'synthetic_import' });
        if (operation === 'import') return state.applyExternalSave(prepared.serialized, { source: 'synthetic_import' });
        if (operation === 'restore') return state.restoreLocalSaveBackup(backup.id);
        if (operation === 'new-game') return state.startFreshGame();
        if (operation === 'migration') return state.load();
        throw Error('UNSUPPORTED_SYNTHETIC_OPERATION');
    };
    return { state, raw, prepared, invoke,
        attempt() { try { return { result: invoke() }; } catch (error) { return { result: false, error }; } },
        close() { state.stopAutoSave(); } };
}

describe('ordinary local writers retain ownership across backup notifications', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    for (const operation of ['save', 'prepared', 'import', 'restore', 'new-game', 'migration']) {
        test.each(['hold', 'epoch', 'new-game', 'saved-progress', 'unsaved-progress', 'raw-only', 'cloud-reservation'])(
            `${operation} cannot outlive %s in a backup callback`, change => {
                const f = fixture(operation), saved = jest.fn(), loaded = jest.fn(), reset = jest.fn();
                let expected;
                try {
                    const off = f.state.on('saveBackupCreated', () => {
                        off();
                        if (change === 'hold') f.state.holdSaveAdmission({ code: 'synthetic_review_hold' }, 'synthetic');
                        if (change === 'epoch') f.state.releaseSaveAdmission();
                        if (change === 'new-game') expect(f.state.startFreshGame()).toBe(true);
                        if (['saved-progress', 'unsaved-progress'].includes(change)) {
                            f.state.set('player.cosmicCoins', 77);
                            if (change === 'saved-progress') expect(f.state.save()).toBe(true);
                        }
                        if (change === 'raw-only') {
                            const next = f.state.createSaveSnapshot(); next.player.cosmicCoins = 77;
                            localStorage.setItem(f.state.saveKey, JSON.stringify(next));
                        }
                        if (change === 'cloud-reservation') {
                            f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
                        }
                        expected = { raw: f.raw(), state: JSON.stringify(f.state.state),
                            admission: f.state.getSaveAdmission(), lease: f.state.cloudWriteLease };
                        // Observe only the retired outer writer, not legitimate nested saves/reset.
                        f.state.on('saved', saved); f.state.on('loaded', loaded);
                        f.state.on('reset', reset);
                    });
                    const outcome = f.attempt();
                    expect(expected).toBeDefined();
                    expect(outcome.result).toBe(false);
                    expect(f.raw()).toBe(expected.raw);
                    expect(JSON.stringify(f.state.state)).toBe(expected.state);
                    if (change === 'raw-only') {
                        expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
                    } else expect(f.state.getSaveAdmission()).toEqual(expected.admission);
                    expect(f.state.cloudWriteLease).toBe(expected.lease);
                    expect(saved).not.toHaveBeenCalled(); expect(loaded).not.toHaveBeenCalled();
                    expect(reset).not.toHaveBeenCalled();
                    if (change === 'cloud-reservation') {
                        expect(f.state.inspectCloudRecovery().pending.map(entry => entry.id)).toEqual([expected.lease.id]);
                    }
                } finally { f.close(); }
            }
        );

        test(`${operation} keeps its ordinary successful result and payload`, () => {
            const f = fixture(operation);
            try {
                expect(f.invoke()).toBe(true);
                if (operation === 'new-game') {
                    expect(JSON.parse(f.raw()).game.cloudSavePausedForNewGame).toBe(true);
                    expect(JSON.parse(f.raw()).creature.hatched).toBe(false);
                } else expect(JSON.parse(f.raw()).player.cosmicCoins).toBe(operation === 'save' ? 11 : 42);
                const next = new GameStateManager();
                expect(next.load()).toBe(true);
                if (operation === 'new-game') expect(next.get('game.cloudSavePausedForNewGame')).toBe(true);
                else expect(next.get('player.cosmicCoins')).toBe(JSON.parse(f.raw()).player.cosmicCoins);
                next.stopAutoSave();
            } finally { f.close(); }
        });
    }

    test.each(['save', 'prepared'])('%s cannot acknowledge or install an old result after a primary-write callback changes campaign', operation => {
        const f = fixture(operation), saved = jest.fn(), set = Storage.prototype.setItem;
        let expected, intercepted = false;
        try {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey && !intercepted) {
                    intercepted = true; expect(f.state.startFreshGame()).toBe(true);
                    expected = { raw: f.raw(), state: JSON.stringify(f.state.state), admission: f.state.getSaveAdmission() };
                    f.state.on('saved', saved);
                }
                return result;
            });
            expect(f.attempt().result).toBe(false);
            expect(f.raw()).toBe(expected.raw); expect(JSON.stringify(f.state.state)).toBe(expected.state);
            expect(f.state.getSaveAdmission()).toEqual(expected.admission); expect(saved).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['save', 'prepared'])('%s preserves changed primary bytes after write-then-throw without rollback', operation => {
        const f = fixture(operation), set = Storage.prototype.setItem;
        let attempted;
        try {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey) { attempted = String(value); throw Error('SYNTHETIC_POST_WRITE_FAILURE'); }
                return result;
            });
            expect(f.attempt().result).toBe(false);
            expect(f.raw()).toBe(attempted);
            expect(f.state.getSaveAdmission().status).toBe('held');
        } finally { f.close(); }
    });
});

describe('protective hold notifications also retire their error handlers', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    function run(operation, kind, replace) {
        const f = fixture(operation), set = Storage.prototype.setItem;
        let intercepted = false, written, successor;
        try {
            const off = f.state.on('saveAdmissionChanged', admission => {
                if (!replace || admission.status !== 'held' || admission.source !== 'local_write') return;
                off(); expect(f.state.startFreshGame()).toBe(true);
                successor = { raw: f.raw(), state: JSON.stringify(f.state.state),
                    admission: f.state.getSaveAdmission(), mode: f.state.storageMode,
                    lease: f.state.cloudWriteLease, autoSave: f.state.autoSaveInterval };
            });
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey && !intercepted) {
                    intercepted = true; written = String(value);
                    const error = new Error('SYNTHETIC_UNVERIFIED_WRITE');
                    if (kind === 'quota') error.name = 'QuotaExceededError';
                    if (kind === 'commit') error.code = 'commit_failed';
                    throw error;
                }
                return result;
            });
            expect(f.attempt().result).toBe(false);
            if (replace) {
                expect(successor).toBeDefined(); expect(f.raw()).toBe(successor.raw);
                expect(JSON.stringify(f.state.state)).toBe(successor.state);
                expect(f.state.getSaveAdmission()).toEqual(successor.admission);
                expect(f.state.storageMode).toBe(successor.mode);
                expect(f.state.cloudWriteLease).toBe(successor.lease);
                expect(f.state.autoSaveInterval).toBe(successor.autoSave);
            } else {
                expect(f.raw()).toBe(written);
                expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
                expect(f.state.storageMode).toBe(operation === 'save' && kind === 'quota' ? 'memory' : 'localStorage');
            }
            off();
        } finally { f.close(); }
    }

    for (const operation of ['save', 'migration']) {
        test.each(['quota', 'commit', 'generic'])(
            `${operation} cannot poison New Game started by its own hold after %s`, kind => run(operation, kind, true)
        );
        test.each(['quota', 'commit', 'generic'])(
            `${operation} retains its current-owner hold and policy after %s`, kind => run(operation, kind, false)
        );
    }
});

describe('retired writer errors cannot poison a successor', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    const failure = kind => {
        const error = new Error('SYNTHETIC_RETIRED_WRITE_FAILURE');
        if (kind === 'quota') error.name = 'QuotaExceededError';
        if (kind === 'commit') error.code = 'commit_failed';
        if (typeof kind === 'number') error.code = kind;
        return error;
    };

    function check(operation, change, kind) {
        const f = fixture(operation), set = Storage.prototype.setItem;
        const saved = jest.fn(), loaded = jest.fn();
        let intercepted = false, expected;
        try {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey && !intercepted) {
                    intercepted = true;
                    if (change === 'new-game') expect(f.state.startFreshGame()).toBe(true);
                    if (change === 'saved-progress') {
                        f.state.set('player.cosmicCoins', 77); expect(f.state.save()).toBe(true);
                    }
                    if (change === 'cloud-reservation') {
                        f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
                    }
                    expected = { raw: f.raw(), state: JSON.stringify(f.state.state),
                        admission: f.state.getSaveAdmission(), mode: f.state.storageMode,
                        lease: f.state.cloudWriteLease };
                    f.state.on('saved', saved); f.state.on('loaded', loaded);
                    throw failure(kind);
                }
                return result;
            });
            expect(f.attempt().result).toBe(false);
            expect(expected).toBeDefined(); expect(f.raw()).toBe(expected.raw);
            expect(JSON.stringify(f.state.state)).toBe(expected.state);
            expect(f.state.getSaveAdmission()).toEqual(expected.admission);
            expect(f.state.storageMode).toBe(expected.mode);
            expect(f.state.cloudWriteLease).toBe(expected.lease);
            expect(saved).not.toHaveBeenCalled(); expect(loaded).not.toHaveBeenCalled();
            if (change === 'cloud-reservation') {
                expect(f.state.inspectCloudRecovery().pending.map(entry => entry.id)).toEqual([expected.lease.id]);
            }
        } finally { f.close(); }
    }

    for (const operation of ['save', 'migration']) {
        test.each(['quota', 'commit', 'generic'].flatMap(kind =>
            ['new-game', 'saved-progress', 'cloud-reservation'].map(change => [kind, change])))(
            `${operation} leaves its successor unchanged after %s and %s`, (kind, change) => check(operation, change, kind)
        );
        test.each([22, 1014])(`${operation} preserves a new game after legacy quota code %s`, code => {
            check(operation, 'new-game', code);
        });
    }

    test('migration write-then-throw never promises that the previous active save was retained', () => {
        const f = fixture('migration'), set = Storage.prototype.setItem, original = f.raw();
        const warning = jest.spyOn(f.state, 'showStorageWarning').mockImplementation(() => {});
        try {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const result = set.call(this, key, value);
                if (key === f.state.saveKey) throw Error('SYNTHETIC_POST_WRITE_FAILURE');
                return result;
            });
            expect(f.attempt().result).toBe(false);
            expect(f.raw()).not.toBe(original);
            expect(JSON.parse(f.raw()).version).toBe('1.1.0');
            expect(f.state.getSaveAdmission().status).toBe('held');
            const messages = warning.mock.calls.map(([message]) => message).join(' ');
            expect(messages).not.toMatch(/previous save was retained/i);
            expect(messages).toMatch(/could not be confirmed/i);
        } finally { f.close(); }
    });

    test('an unverified migration write cannot start default progress and autosave over the existing journey', () => {
        const f = fixture('migration'), set = Storage.prototype.setItem, original = f.raw();
        let rejected = false;
        try {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                if (key === f.state.saveKey && !rejected) { rejected = true; return; }
                return set.call(this, key, value);
            });
            expect(f.state.init()).toBe(false);
            expect(f.state.initialized).toBe(false);
            expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
            expect(f.state.autoSaveInterval).toBeNull();
            jest.advanceTimersByTime(90000);
            expect(f.raw()).toBe(original);
            expect(JSON.parse(f.raw()).player.cosmicCoins).toBe(42);
        } finally { f.close(); }
    });
});
