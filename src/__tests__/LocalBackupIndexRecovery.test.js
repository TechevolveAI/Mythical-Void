const GameStateManager = require('../systems/GameState.js');

describe('interrupted local backup rotation', () => {
    let state;
    const bytes = () => ({ ...localStorage });
    const active = () => localStorage.getItem(state.saveKey);
    const key = id => `${state.saveBackupKeyPrefix}${id}`;
    const index = entries => localStorage.setItem(state.saveBackupIndexKey, JSON.stringify(entries));
    const copy = () => state.createLocalSaveBackup(active(), 'before_local_save');

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(1700000000777);
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager();
        state.set('player.cosmicCoins', 42);
        expect(state.save()).toBe(true);
    });
    afterEach(() => { state.stopAutoSave(); jest.restoreAllMocks(); jest.useRealTimers(); });

    test.each(['missing-index', 'extra-copy', 'missing-copy', 'replaced-copy'])(
        '%s keeps the valid active game and reads surviving local copies without changing bytes', fault => {
            const first = copy(), second = copy();
            if (fault === 'missing-index') localStorage.removeItem(state.saveBackupIndexKey);
            if (fault === 'extra-copy') index([first]);
            if (fault === 'missing-copy') localStorage.removeItem(key(first.id));
            if (fault === 'replaced-copy') { index([first]); localStorage.removeItem(key(first.id)); }
            const before = bytes();
            const inspected = state.inspectCloudRecovery();
            expect(inspected.pending).toEqual([]);
            expect(inspected.entries.map(entry => entry.id)).toContain(second.id);
            expect(bytes()).toEqual(before);
            const next = new GameStateManager();
            expect(next.load()).toBe(true);
            expect(next.get('player.cosmicCoins')).toBe(42);
            expect(next.getCloudRecoveryStatus().pending).toBe(false);
            next.stopAutoSave();
        }
    );

    test('a failed old-copy prune does not block naming or the next local save', () => {
        const copies = [copy(), copy(), copy()];
        const remove = Storage.prototype.removeItem;
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (name) {
            if (name === key(copies[0].id)) throw Error('Synthetic interrupted prune');
            return remove.call(this, name);
        });
        expect(copy()).not.toBeNull();
        expect(state.inspectCloudRecovery().entries).toHaveLength(4);
        state.set('player.cosmicCoins', 43);
        expect(state.save()).toBe(true);
        expect(JSON.parse(active()).player.cosmicCoins).toBe(43);
    });

    test.each(['envelope', 'index'])('a silently dropped %s write cannot acknowledge a backup', boundary => {
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
            if (boundary === 'index' ? name === state.saveBackupIndexKey : name.startsWith(state.saveBackupKeyPrefix)) return;
            return set.call(this, name, value);
        });
        const original = active();
        expect(copy()).toBeNull();
        expect(active()).toBe(original);
    });

    test.each(['envelope', 'index'])('a landed %s write with a lost acknowledgement keeps its verified bytes', boundary => {
        const set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
            set.call(this, name, value);
            if (boundary === 'index' ? name === state.saveBackupIndexKey : name.startsWith(state.saveBackupKeyPrefix) && name !== state.saveBackupIndexKey) {
                throw Error('Synthetic lost acknowledgement');
            }
        });
        const saved = copy();
        expect(saved).not.toBeNull();
        expect(state.inspectCloudRecovery().entries.map(entry => entry.id)).toContain(saved.id);
        expect(localStorage.getItem(key(saved.id))).not.toBeNull();
    });

    test('an index refusal retains the orphaned local copy for read-only reconciliation after restart', () => {
        const set = Storage.prototype.setItem;
        const refusal = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
            if (name === state.saveBackupIndexKey) throw Error('Synthetic index refusal');
            return set.call(this, name, value);
        });
        expect(copy()).toBeNull();
        refusal.mockRestore();
        const before = bytes();
        expect(state.inspectCloudRecovery().entries).toHaveLength(1);
        expect(bytes()).toEqual(before);
    });

    test.each(['cloud-marker', 'journal', 'unknown-reason', 'metadata-conflict', 'invalid-envelope', 'invalid-active', 'unknown-key', 'corrupt-index'])(
        '%s cannot be reclassified as an interrupted local rotation', fault => {
            const first = copy(), second = copy();
            index([first]);
            const envelope = JSON.parse(localStorage.getItem(key(second.id)));
            if (fault === 'cloud-marker') envelope.reason = 'cloud_write_pending_mutation';
            if (fault === 'unknown-reason') envelope.reason = 'unknown_copy';
            if (fault === 'invalid-envelope') envelope.schemaVersion = 2;
            localStorage.setItem(key(second.id), JSON.stringify(envelope));
            if (fault === 'journal') localStorage.setItem(`${state.saveKey}-cloud-journal-v1:orphan`, '{}');
            if (fault === 'metadata-conflict') index([{ ...first, createdAt: first.createdAt + 1 }]);
            if (fault === 'invalid-active') localStorage.setItem(state.saveKey, '{');
            if (fault === 'unknown-key') localStorage.setItem(`${state.saveBackupKeyPrefix}unknown`, '{}');
            if (fault === 'corrupt-index') localStorage.setItem(state.saveBackupIndexKey, '{');
            const before = bytes(), next = new GameStateManager();
            expect(next.load()).toBe(false);
            expect(next.getCloudRecoveryStatus().pending).toBe(true);
            expect(bytes()).toEqual(before);
            next.stopAutoSave();
        }
    );
});
