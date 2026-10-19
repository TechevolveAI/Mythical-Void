const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const GameStateManager = require('../systems/GameState.js');
const Journal = require('../systems/CloudRecoveryJournal.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const legacy = require('./fixtures/legacy-backup-writer-506b9bb3.json');

describe('independent cloud recovery custody', () => {
    let state;
    const raw = () => localStorage.getItem(state.saveKey);
    const journal = () => state.getCloudRecoveryJournal();
    const journalBytes = () => Object.fromEntries(Object.entries(localStorage)
        .filter(([key]) => key.startsWith(journal().prefix)));
    const begin = () => state.beginCloudWrite('mutation', state.createSaveSnapshot(), () => true,
        { ownerId: 'fictional-owner', saveSlot: 'primary', operationId: 'fictional-fusion', expectedRevision: 7 });
    beforeEach(() => {
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager();
        expect(state.save()).toBe(true);
    });
    afterEach(() => { state.stopAutoSave(); jest.restoreAllMocks(); localStorage.clear(); });

    function runOldPruner() {
        expect(legacy.sourceSha256).toBe('499352af02cec214c97a2f4a07bd5ea4eab091b68d0d801f6952561982de686d');
        const writer = { saveKey: state.saveKey, saveBackupKeyPrefix: state.saveBackupKeyPrefix,
            saveBackupIndexKey: state.saveBackupIndexKey, emit() {} };
        for (const [name, method] of Object.entries(legacy.methods)) {
            writer[name] = vm.runInNewContext(`({${method}}).${name}`, { localStorage, Date, JSON,
                console, SAVE_BACKUP_LIMIT: 3 }).bind(writer);
        }
        for (let index = 0; index < 10; index++) {
            expect(writer.createLocalSaveBackup({ ...state.createSaveSnapshot(), savedAt: 100 + index },
                'before_local_save')).toBeTruthy();
        }
    }

    test('the digest uses the standard SHA-256 vector', () => {
        expect(Journal.hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
    test('local-only readers need no optional journal module, but unknown journal bytes still hold', () => {
        const source = fs.readFileSync(path.join(__dirname, '../systems/GameState.js'), 'utf8');
        const context = { module: { exports: {} }, localStorage, Date, Math, console, clearInterval() {} };
        vm.runInNewContext(source, context);
        const local = new context.module.exports(); context.window = { GameState: local };
        expect(local.save()).toBe(true);
        localStorage.setItem(`${local.saveKey}-cloud-journal-v1:orphan`, '{}');
        const before = { ...localStorage };
        expect(local.save()).toBe(false);
        expect({ ...localStorage }).toEqual(before);
    });
    test('the actual old pruner removes its legacy mirror but cannot retire the independent reservation', () => {
        const lease = begin(), bytes = journalBytes(), active = raw();
        runOldPruner();
        expect(localStorage.getItem(`${state.saveBackupKeyPrefix}${lease.id}`)).toBeNull();
        expect(journalBytes()).toEqual(bytes);
        const before = { ...localStorage }, next = new GameStateManager();
        expect(next.load()).toBe(false);
        expect(next.save()).toBe(false);
        expect(() => next.startFreshGame()).toThrow();
        expect(next.getCloudRecoveryStatus().pending).toBe(true);
        expect({ ...localStorage }).toEqual(before);
        expect(raw()).toBe(active);
    });
    test('request, unsaved progress and returned result survive old-writer pruning together', () => {
        const lease = begin(), active = raw();
        state.set('player.cosmicCoins', 77);
        const result = { ...state.createSaveSnapshot(), player: { ...state.get('player'), cosmicCoins: 12 } };
        state.protectCloudWrite(lease, result);
        const bytes = journalBytes();
        runOldPruner();
        expect(journalBytes()).toEqual(bytes);
        const inspected = journal().inspect();
        expect(JSON.parse(inspected.envelopes.request.payload).player.cosmicCoins).not.toBe(77);
        expect(JSON.parse(inspected.envelopes.local.payload).player.cosmicCoins).toBe(77);
        expect(JSON.parse(inspected.envelopes.result.payload).player.cosmicCoins).toBe(12);
        expect(new GameStateManager().load()).toBe(false);
        expect(raw()).toBe(active);
    });
    test.each(['payload', 'context', 'kind'])('coherent envelope %s edits cannot match the independent binding', field => {
        const lease = begin(), inspected = journal().inspect(), key = inspected.control.records.request.key;
        const { digest, ...body } = JSON.parse(localStorage.getItem(key));
        if (field === 'payload') body.payload = JSON.stringify({ ...JSON.parse(body.payload), savedAt: 77 });
        if (field === 'context') body.context.ownerDigest = Journal.hash('different-fictional-owner');
        if (field === 'kind') body.kind = 'result';
        localStorage.setItem(key, JSON.stringify(journal().seal(body)));
        const before = { ...localStorage };
        expect(new GameStateManager().load()).toBe(false);
        expect(() => state.finishCloudWrite(lease)).toThrow();
        expect({ ...localStorage }).toEqual(before);
    });
    test.each(['missing-control', 'corrupt-control', 'missing-request', 'orphan'])('%s holds without rewriting evidence', fault => {
        begin();
        if (fault === 'missing-control') localStorage.removeItem(journal().controlKey);
        if (fault === 'corrupt-control') localStorage.setItem(journal().controlKey, '{');
        if (fault === 'missing-request') localStorage.removeItem(journal().inspect().control.records.request.key);
        if (fault === 'orphan') localStorage.setItem(`${journal().prefix}unexpected`, '{}');
        const before = { ...localStorage }, next = new GameStateManager();
        expect(next.load()).toBe(false);
        expect(next.getCloudRecoveryStatus()).toMatchObject({ pending: true, damaged: true });
        expect({ ...localStorage }).toEqual(before);
    });
    test('confirmation cannot be borrowed by a restarted instance', () => {
        const lease = begin(), before = { ...localStorage }, next = new GameStateManager();
        expect(() => next.finishCloudWrite(lease)).toThrow();
        expect({ ...localStorage }).toEqual(before);
        expect(next.load()).toBe(false);
    });
    test('returned-evidence quota failure remains visible after restart', () => {
        const lease = begin(), set = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === `${journal().prefix}${lease.id}:result`) throw Error('Synthetic quota');
            return set.call(this, key, value);
        });
        state.protectCloudWrite(lease, state.createSaveSnapshot());
        expect(new GameStateManager().getCloudRecoveryStatus()).toMatchObject({ pending: true, evidenceLimited: true });
    });
    test.each(['request-refused', 'request-landed', 'control-refused', 'control-dropped'])(
        '%s never opens a write through a partial reservation', fault => {
            const set = Storage.prototype.setItem, active = raw();
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                const request = key.startsWith(journal().prefix) && key.endsWith(':request');
                if (fault === 'request-refused' && request) throw Error('Synthetic refusal');
                if (fault === 'request-landed' && request) { set.call(this, key, value); throw Error('Synthetic lost acknowledgement'); }
                if (fault === 'control-refused' && key === journal().controlKey) throw Error('Synthetic refusal');
                if (fault === 'control-dropped' && key === journal().controlKey) return;
                return set.call(this, key, value);
            });
            if (fault === 'request-landed') {
                const lease = begin();
                expect(journal().assertLease(lease).control.phase).toBe('pending');
            } else expect(begin).toThrow();
            expect(raw()).toBe(active);
            expect(new GameStateManager().load()).toBe(false);
        }
    );
    test('a verified cloud outcome binds the exact wire request and its acknowledged revision', () => {
        const snapshot = state.createSaveSnapshot(), wireRequest = { rpc: 'save_game_state',
            arguments: { p_save_slot: 'primary', p_expected_revision: 7, p_game_state: snapshot } };
        const lease = state.beginCloudWrite('upload', snapshot, () => true,
            { ownerId: 'fictional-owner', expectedRevision: 7, wireRequest });
        expect(JSON.parse(journal().inspect().envelopes.request.wireRequest)).toEqual(wireRequest);
        expect(() => journal().confirm(lease, raw())).toThrow();
        state.recordCloudWriteOutcome(lease, { outcome: 'accepted', revision: 8 });
        expect(state.finishCloudWrite(lease)).toBe(true);
        const inspected = journal().inspect();
        expect(JSON.parse(inspected.envelopes.outcome.payload)).toMatchObject({ outcome: 'accepted', revision: 8, expectedRevision: 7 });
        expect(inspected.control.confirmation.outcomeDigest).toBe(inspected.envelopes.outcome.digest);
    });
    test.each(['request', 'control'])(
        'failed %s allocation after confirmed retirement cannot manufacture another confirmed operation', boundary => {
            const first = begin(); state.finishCloudWrite(first);
            const original = journal().inspect().control, set = Storage.prototype.setItem;
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                if ((boundary === 'control' && key === journal().controlKey) ||
                    (boundary === 'request' && key.startsWith(journal().prefix) && key.endsWith(':request'))) throw Error('Synthetic quota');
                return set.call(this, key, value);
            });
            expect(begin).toThrow();
            const control = JSON.parse(localStorage.getItem(journal().controlKey));
            expect(control.id).toBe(original.id);
            expect(new GameStateManager().load()).toBe(false);
        }
    );
    test('normal confirmations remain usable and journal storage stays bounded', () => {
        for (let index = 0; index < 40; index++) {
            const lease = begin();
            expect(state.finishCloudWrite(lease)).toBe(true);
            expect(Object.keys(journalBytes()).length).toBeLessThanOrEqual(4);
            expect(new GameStateManager().load()).toBe(true);
        }
        const control = journal().inspect().control;
        expect(control.context).toMatchObject({ expectedRevision: 7, ownerDigest: Journal.hash('fictional-owner'),
            operationDigest: Journal.hash('fictional-fusion') });
        expect(JSON.stringify(control)).not.toContain('fictional-owner');
    });
    test('an old writer winning the existing server CAS rejects this upload without replacing local progress', async () => {
        let finish;
        const client = { rpc: jest.fn(() => new Promise(resolve => { finish = resolve; })) };
        const cloud = new CloudSaveManager({ client, gameState: state, storage: localStorage, lockManager: null });
        cloud.currentUser = { id: 'fictional-owner' };
        cloud.ensureSession = async () => {};
        try {
            const active = raw(), pending = cloud.upload(state.createSaveSnapshot(), 0);
            for (let index = 0; index < 12; index++) await Promise.resolve();
            // The unchanged save_game_state contract rejects expected revision 0
            // after another valid writer has advanced the server to revision 1.
            finish({ data: null, error: { code: '40001', message: 'save_revision_conflict',
                details: JSON.stringify({ expectedRevision: 0, currentRevision: 1 }) } });
            await expect(pending).rejects.toMatchObject({ code: '40001' });
            expect(raw()).toBe(active);
            expect(new GameStateManager().load()).toBe(true);
            const evidence = journal().inspect();
            expect(JSON.parse(evidence.envelopes.outcome.payload)).toMatchObject({ outcome: 'rejected', revision: 1 });
            expect(JSON.parse(evidence.envelopes.request.wireRequest).arguments.p_expected_revision).toBe(0);
        } finally { cloud.destroy(); }
    });
    test('a later old-writer server revision cannot settle this upload after its reply is lost', async () => {
        let serverRevision = 0;
        const client = { rpc: jest.fn(async () => {
            serverRevision = 1; // The request committed, but its reply is lost.
            throw Error('Synthetic lost response');
        }) };
        const cloud = new CloudSaveManager({ client, gameState: state, storage: localStorage, lockManager: null });
        cloud.currentUser = { id: 'fictional-owner' }; cloud.ensureSession = async () => {};
        try {
            const active = raw();
            await expect(cloud.upload(state.createSaveSnapshot(), 0)).rejects.toThrow('Synthetic lost response');
            serverRevision += 1; // A legacy writer subsequently commits its own revision.
            expect(serverRevision).toBe(2);
            const before = { ...localStorage }, next = new GameStateManager();
            expect(next.load()).toBe(false);
            expect(journal().inspect().control.phase).toBe('pending');
            expect(raw()).toBe(active);
            expect({ ...localStorage }).toEqual(before);
            expect(client.rpc).toHaveBeenCalledTimes(1);
        } finally { cloud.destroy(); }
    });
});
