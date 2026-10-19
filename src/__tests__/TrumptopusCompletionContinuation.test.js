const { fixture, GameStateManager, progress } = require('./support/trumptopusCompletionFixture.cjs');
describe('actual finale original-operation continuation', () => {
    let owned;
    beforeEach(() => { owned = []; jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { owned.forEach(f => f.close()); jest.restoreAllMocks(); jest.useRealTimers(); delete window.CloudSave; });
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    const unchanged = (f, saved) => {
        expect(f.state.state).toBe(saved.root); expect(localStorage.getItem(f.state.saveKey)).toBe(saved.raw);
        expect(JSON.stringify(f.state.state)).toBe(saved.bytes);
    };

    test('normal actual writer, fixed original run, result and Continue retain one victory', () => {
        const f = create(); const result = f.win();
        expect(result.persisted).toBe(true); expect(result.validity.isCurrent()).toBe(true);
        expect(Object.isFrozen(result.run)).toBe(true); expect(Object.isFrozen(result.run.receipt)).toBe(true);
        expect(Object.isFrozen(result.receipt)).toBe(true);
        const saved = f.snapshot(); f.win(); expect(f.controller.present()).toBe(true); expect(f.controller.present()).toBe(false);
        expect(f.controller.continue()).toBe(true); expect(f.controller.continue()).toBe(false);
        expect(f.createPanel).toHaveBeenCalledTimes(1); expect(f.scene.scene.start).toHaveBeenCalledTimes(1); unchanged(f, saved);
    });

    test('own begin and successive checkpoints follow only writer-issued admission transitions', () => {
        window.CloudSave = { campaignEpoch: 0, currentUser: { id: 'synthetic-cloud-owner' } };
        const f = create({ phase: 0, beforeConstruct: ({ state }) => state.on('saveAdmissionChanged', () => { window.CloudSave.campaignEpoch++; }) });
        const first = f.state.saveAdmission;
        expect(f.controller.saveProgress(1)).toBe(true); expect(f.state.saveAdmission).not.toBe(first);
        expect(f.controller.current()).toBe(true); expect(f.controller.saveProgress(2)).toBe(true);
        expect(f.win().persisted).toBe(true); expect(f.controller.current()).toBe(true);
        expect(f.controller.run.status).toBe('won'); expect(window.CloudSave.campaignEpoch).toBe(4);
    });

    test('original failing winning-notification expectation preserves the successor without a null presenter crash', () => {
        const f = create(); let successor;
        const off = f.state.on('trumptopusProgressChanged', () => { off(); expect(f.state.startFreshGame()).toBe(true); successor = f.snapshot(); });
        expect(f.win()).toBeNull(); expect(f.controller.present()).toBe(false); expect(f.controller.closed).toBe(true);
        expect(f.createPanel).not.toHaveBeenCalled(); unchanged(f, successor);
    });

    test('original failing equal-sequence cleanup expectation cannot grant to a replacement campaign', () => {
        const f = create(); let successor;
        f.scene.clearInput.mockImplementationOnce(() => { expect(f.state.startFreshGame()).toBe(true); f.startFight(); successor = f.snapshot(); });
        expect(f.win()).toBeNull(); unchanged(f, successor); expect(f.state.get('levels.finalVoid.completed')).toBe(false);
        expect(f.controller.present()).toBe(false);
    });

    test.each(['snapshot', 'admission', 'inventory-cache', 'present-input', 'present-freeze', 'present-route', 'panel', 'continue-route', 'continue-start'])(
        '%s retirement cannot publish, continue, or mutate the successor afterwards', kind => {
            let f, successor;
            const replace = () => { expect(f.state.startFreshGame()).toBe(true); successor = f.snapshot(); };
            const inventoryManager = {};
            if (kind === 'inventory-cache') Object.defineProperty(inventoryManager, 'inventory', { set: replace });
            f = create({ inventoryManager });
            if (kind === 'snapshot') f.encounter.snapshot.mockImplementationOnce(() => { replace(); return { phaseIndex: 2, completionReady: true }; });
            if (kind === 'admission') { const off = f.state.on('saveAdmissionChanged', () => { off(); replace(); }); }
            if (kind.startsWith('present-')) {
                expect(f.win()).not.toBeNull();
                if (kind === 'present-input') f.scene.clearInput.mockImplementationOnce(replace);
                if (kind === 'present-freeze') f.scene.enterLevelCompletionState.mockImplementationOnce(replace);
                if (kind === 'present-route') f.recovery.mockImplementationOnce(() => { replace(); return { status: 'repair' }; });
                expect(f.controller.present()).toBe(false);
            } else if (kind === 'panel') {
                f.win(); f.createPanel.mockImplementationOnce(() => { replace(); return f.panel; });
                expect(f.controller.present()).toBe(false); expect(f.panel.close).toHaveBeenCalledTimes(1);
            } else if (kind.startsWith('continue-')) {
                f.win(); f.controller.present();
                if (kind === 'continue-route') f.recovery.mockImplementationOnce(() => { replace(); return { status: 'repair' }; });
                else f.scene.scene.start.mockImplementationOnce(replace);
                expect(f.controller.continue()).toBe(false);
            } else expect(f.win()).toBeNull();
            expect(successor).toBeDefined(); const writes = jest.spyOn(f.state, 'commitPreparedSave');
            f.controller.onPageHide(); f.controller.dispose(); f.controller.observe(f.encounter); f.controller.continue();
            expect(writes).not.toHaveBeenCalled(); unchanged(f, successor);
        });

    test.each(['memory', 'denied-before-write'])('current-owner %s preserves the truthful in-session win and original reward policy', kind => {
        const f = create({ phase: 0, beforeConstruct: ({ state }) => { if (kind === 'memory') state.storageMode = 'memory'; } });
        const before = localStorage.getItem(f.state.saveKey);
        if (kind === 'denied-before-write') {
            const set = Storage.prototype.setItem;
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
                if (key === f.state.saveKey) throw new DOMException('Synthetic denial', 'SecurityError'); return set.call(this, key, value);
            });
        }
        expect(f.controller.saveProgress(1)).toBe(true); expect(f.controller.saveProgress(2)).toBe(true);
        const result = f.win(); expect(result.persisted).toBe(false); expect(f.controller.present()).toBe(true);
        expect(f.createPanel.mock.calls[0][0].persisted).toBe(false);
        expect(localStorage.getItem(f.state.saveKey)).toBe(before); expect(f.state.get('inventory.items').find(item => item.id === 'super_blast').quantity).toBe(1);
        expect(f.controller.continue()).toBe(true);
    });

    test('a begin-admission reset retires the constructor before films or results', () => {
        let successor;
        const f = create({ phase: 0, beforeConstruct: ({ state }) => {
            const off = state.on('saveAdmissionChanged', () => { off(); expect(state.startFreshGame()).toBe(true);
                successor = { root: state.state, raw: localStorage.getItem(state.saveKey), bytes: JSON.stringify(state.state) }; });
        } });
        expect(f.controller.closed).toBe(true); expect(f.films.prepare).not.toHaveBeenCalled();
        expect(f.controller.checkpoint()).toBeNull(); expect(f.controller.present()).toBe(false); unchanged(f, successor);
    });

    test('writer issues its exact original root/admission before notifying observers', () => {
        const f = create(), operation = f.state.createPreparedSaveOperation(() => true);
        const off = f.state.on('saveAdmissionChanged', () => {
            off(); const issued = operation.getTransition(); expect(issued.state).toBe(f.state.state); expect(issued.admission).toBe(f.state.saveAdmission);
            expect(operation.isCurrent()).toBe(true);
        });
        const result = progress.recordTrumptopusVictory(f.state, { sequence: 1, operation });
        expect(result.validity).toBe(operation); expect(result.persisted).toBe(true);
    });

    test.each([{}, Object.freeze({ isCurrent: () => true }), Promise.resolve(true)])('unsupported continuation is rejected before save dispatch', continuation => {
        const state = new GameStateManager(), root = state.state, raw = localStorage.getItem(state.saveKey);
        const backup = jest.spyOn(state, 'createLocalSaveBackup');
        expect(() => state.commitPreparedSave({}, { continuation })).toThrow('Unsupported prepared-save continuation');
        expect(backup).not.toHaveBeenCalled(); expect(state.state).toBe(root); expect(localStorage.getItem(state.saveKey)).toBe(raw); state.stopAutoSave();
    });

    test('async operation guards are unsupported and opaque operations cannot be replayed', () => {
        const f = create(); expect(() => f.state.createPreparedSaveOperation(async () => true)).toThrow('Unsupported save operation');
        const operation = f.state.createPreparedSaveOperation(() => true);
        const result = progress.recordTrumptopusVictory(f.state, { sequence: 1, operation });
        const saved = f.snapshot(); expect(result.validity.isCurrent()).toBe(true);
        const otherDraft = JSON.parse(JSON.stringify(f.state.state));
        expect(() => f.state.commitPreparedSave({ state: otherDraft }, { continuation: operation })).toThrow('no longer owns'); unchanged(f, saved);
    });

    test('a regular guard returning a rejected native promise is refused without dispatch', async () => {
        const f = create(), writer = jest.spyOn(f.state, 'commitPreparedSave');
        expect(() => f.state.createPreparedSaveOperation(() => Promise.reject(Error('Synthetic unsupported async result')))).toThrow('no longer owns');
        await Promise.resolve(); expect(writer).not.toHaveBeenCalled();
    });

    test('unchanged checkpoints do not invent an admission transition', () => {
        const f = create(), root = f.state.state, admission = f.state.saveAdmission;
        expect(f.controller.saveProgress(2)).toBe(false); expect(f.controller.current()).toBe(true);
        expect(f.state.state).toBe(root); expect(f.state.saveAdmission).toBe(admission);
    });

    test.each(['no-issued-transition', 'different-prepared-data'])('%s cannot falsely report a committed win', kind => {
        const f = create(), before = f.snapshot(), original = f.state.commitPreparedSave.bind(f.state);
        jest.spyOn(f.state, 'commitPreparedSave').mockImplementationOnce((prepared, options) => {
            if (kind === 'no-issued-transition') return true;
            prepared.state.player.cosmicCoins += 7; return original(prepared, options);
        });
        expect(f.win()).toBeNull(); expect(f.controller.closed).toBe(true); expect(f.createPanel).not.toHaveBeenCalled(); unchanged(f, before);
    });

    test('approach checkpoints retain the original fixed run and remain usable', () => {
        const f = create({ phase: 0, withApproach: true });
        expect(f.controller.saveApproach({ schemaVersion: 1, clearedGrips: 1, arrived: false })).toBe(true);
        expect(f.controller.run.approach.clearedGrips).toBe(1); expect(f.controller.current()).toBe(true);
        expect(f.controller.saveApproach({ schemaVersion: 1, clearedGrips: 2, arrived: true })).toBe(true);
        expect(f.controller.saveProgress(1)).toBe(true); expect(f.controller.current()).toBe(true);
    });

    test('a retired approach entry never calls a renderer or overwrites a successor completion', () => {
        const fs = require('node:fs'), path = require('node:path'), { parse } = require('@babel/parser');
        for (const name of ['TrumptopusApproachPreview', 'TrumptopusCampaignPreview']) {
            const source = fs.readFileSync(path.join(__dirname, '../dev', name + '.js'), 'utf8');
            const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.declaration?.type === 'ClassDeclaration').declaration;
            const method = cls.body.body.find(node => node.key?.name === 'createEncounter');
            const createEncounter = new Function('TrumptopusCompletion', `return ({${source.slice(method.start, method.end)}}).createEncounter;`)(function () { return { closed: true }; });
            const successor = {}, scene = { completion: successor, createFinaleFilms: () => ({}) };
            expect(createEncounter.call(scene, {})).toBeNull(); expect(scene.completion).toBe(successor);
        }
    });

    test('all actual finale create/update layers return before setup when entry is retired', () => {
        const fs = require('node:fs'), path = require('node:path'), { parse } = require('@babel/parser');
        const files = ['dev/TrumptopusPrototypeLevel.js', 'dev/TrumptopusFinalePreview.js', 'dev/TrumptopusArtFinalePreview.js',
            'dev/TrumptopusApproachPreview.js', 'dev/TrumptopusCampaignPreview.js', 'scenes/levels/TrumptopusLevel.js'];
        let methods = 0;
        for (const file of files) {
            const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
            const visit = node => {
                if (!node || typeof node !== 'object') return;
                if (node.type === 'ClassMethod' && ['create', 'update'].includes(node.key?.name)) {
                    const method = new Function(`return ({${source.slice(node.start, node.end)}}).${node.key.name};`)();
                    expect(method.call({ finaleEntryRetired: true }, 0, 16)).toBeUndefined(); methods++;
                }
                for (const child of Object.values(node)) if (child && typeof child === 'object') Array.isArray(child) ? child.forEach(visit) : visit(child);
            };
            visit(parse(source, { sourceType: 'module' }).program);
        }
        expect(methods).toBe(11);
    });
});
