const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const moduleForGate = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ui/SaveRecoveryGate.js'), 'utf8')
    .replace('export default class', 'module.exports = class'), { module: moduleForGate, window, document, Date, Promise });
const SaveRecoveryGate = moduleForGate.exports;

describe('uncertain partial hatch is protected, not repaired or regenerated', () => {
    let state;
    const owners = [], clouds = [], gates = [];
    const fresh = () => { const owner = new GameStateManager(); owners.push(owner); return owner; };
    const backupPayloads = owner => owner.getLocalSaveBackups().map(entry => JSON.parse(
        localStorage.getItem(owner.saveBackupKeyPrefix + entry.id)).payload);
    const storageSnapshot = () => ({ ...localStorage });
    function uncertain(kind = 'missing') {
        const input = state.createSaveSnapshot();
        input.session.gameStarted = true;
        input.creature.hatched = kind === 'truthy-flag' ? 'interrupted' : true;
        input.creature.named = true; input.creature.name = 'Fictional Earlier Creature';
        input.creature.genes = kind === 'legacy-shadow' ? {} : kind === 'empty-id' ? { id: '' } : null;
        input.creature.genetics = kind === 'legacy-shadow' ? { id: 'fictional-surviving-legacy' } : null;
        input.creature.dna = { id: 'fictional-surviving-dna' };
        input.creatures = [{ id: 'fictional-roster', parentIds: ['fictional-ancestor'],
            genes: { id: 'fictional-roster-genes' }, lifecycle: { stage: 'adult' } }];
        input.creature.hatchTransaction = { schemaVersion: 1, status: 'reserved',
            eggItemId: 'fictional-reserved-egg', eggType: 'stellar', inventorySlot: 0,
            reservedAt: 1700000000000, spawnPosition: { x: 0, y: 20 } };
        return input;
    }
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear();
        state = fresh(); expect(state.save()).toBe(true); window.GameState = state;
    });
    afterEach(() => {
        for (const gate of gates.splice(0)) gate.destroy();
        for (const cloud of clouds.splice(0)) cloud.destroy();
        for (const owner of owners.splice(0)) owner.stopAutoSave();
        jest.restoreAllMocks(); document.body.replaceChildren(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave;
    });
    test.each(['missing', 'legacy-shadow', 'empty-id', 'truthy-flag'])(
        '%s retains the exact original before migration, retry and reconstructed writes', kind => {
            const input = uncertain(kind), raw = JSON.stringify(input);
            localStorage.setItem(state.saveKey, raw);
            const originalMemory = JSON.stringify(state.state), originalStorage = storageSnapshot();
            const gate = new SaveRecoveryGate(state, { pause: jest.fn(), reload: jest.fn() }); gates.push(gate);
            expect(state.load()).toBe(false);
            expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
            expect(JSON.stringify(state.state)).toBe(originalMemory);
            const retry = document.querySelector('.save-recovery-gate button');
            expect(retry.textContent).toBe('Try saved game again'); retry.click();
            expect(document.querySelector('.save-recovery-gate')).not.toBeNull();
            expect(gate.reload).not.toHaveBeenCalled();
            for (let i = 0; i < 3; i++) {
                expect(state.save()).toBe(false); expect(state.canPersistSave()).toBe(false);
                const reconstructed = fresh();
                expect(reconstructed.load()).toBe(false); expect(reconstructed.save()).toBe(false);
                const cloud = new CloudSaveManager({ client: null, gameState: reconstructed,
                    storage: localStorage, lockManager: null }); clouds.push(cloud);
                expect(cloud.isSaveAdmitted()).toBe(false);
                expect(storageSnapshot()).toEqual(originalStorage);
            }
            expect(JSON.parse(localStorage.getItem(state.saveKey))).toEqual(input);
        });
    test.each(['save', 'permission', 'cloud', 'autosave'])(
        'live uncertainty also stops %s with an otherwise supported durable save', operation => {
            state.state = uncertain('legacy-shadow');
            const beforeMemory = JSON.stringify(state.state), before = storageSnapshot();
            if (operation === 'save') expect(state.save()).toBe(false);
            if (operation === 'permission') expect(state.canPersistSave()).toBe(false);
            if (operation === 'autosave') expect(state.startAutoSave()).toBe(false);
            if (operation === 'cloud') {
                const cloud = new CloudSaveManager({ client: null, gameState: state, storage: localStorage,
                    lockManager: null }); clouds.push(cloud); window.CloudSave = cloud;
                expect(cloud.isSaveAdmitted()).toBe(false);
            }
            expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
            expect(storageSnapshot()).toEqual(before); expect(JSON.stringify(state.state)).toBe(beforeMemory);
        });
    test.each(['legacy', 'genes', 'truthy-id', 'unhatched'])(
        'supported %s input keeps the existing selection and normal persistence', kind => {
            const input = uncertain();
            if (kind === 'legacy') input.creature.genetics = { id: 'fictional-selected-legacy' };
            if (kind === 'genes') input.creature.genes = { id: 'fictional-selected-genes' };
            if (kind === 'truthy-id') input.creature.genes = { id: 77 };
            if (kind === 'unhatched') input.creature.hatched = false;
            localStorage.setItem(state.saveKey, JSON.stringify(input));
            expect(state.load()).toBe(true); expect(state.canPersistSave()).toBe(true); expect(state.save()).toBe(true);
            expect(state.get('creature.genes')).toEqual(input.creature.genes);
            expect(state.get('creature.genetics')).toEqual(input.creature.genetics);
        });
    test('uncertain originals are refused before migration, without mutating active state', () => {
        const input = uncertain('legacy-shadow'), original = JSON.stringify(input), before = storageSnapshot();
        const memory = JSON.stringify(state.state), migrate = jest.spyOn(state, 'migrateSaveData');
        expect(() => state.prepareSaveCandidate(input)).toThrow('could not be verified safely');
        expect(migrate).not.toHaveBeenCalled(); expect(JSON.stringify(input)).toBe(original);
        expect(storageSnapshot()).toEqual(before); expect(JSON.stringify(state.state)).toBe(memory);
        expect(state.getSaveAdmission().status).toBe('ready');
    });
    test('uncertainty introduced during preparation is refused before publication', () => {
        const before = storageSnapshot(), memory = JSON.stringify(state.state);
        jest.spyOn(state, 'migrateSaveData').mockReturnValue(uncertain());
        expect(state.load()).toBe(false);
        expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
        expect(storageSnapshot()).toEqual(before); expect(JSON.stringify(state.state)).toBe(memory);
    });
    test.each(['version_mismatch', 'save_would_lose_history'])(
        'the existing %s refusal still takes precedence over uncertainty', reason => {
            const input = uncertain();
            if (reason === 'version_mismatch') input.version = '2.0.0';
            else input.breedingShrine.sharedFusion.completedOperationIds = Array.from(
                { length: 26 }, (_, i) => `fusion_shared_fictional_${i}`);
            localStorage.setItem(state.saveKey, JSON.stringify(input));
            expect(state.load()).toBe(false); expect(state.getSaveAdmission().reason).toBe(reason);
        });
    test('backup classification is pure and preserves an uncertain original beyond ordinary rotation', () => {
        const raw = JSON.stringify(uncertain()), original = state.createLocalSaveBackup(raw);
        expect(state.getSaveAdmission().status).toBe('ready');
        expect(state.isProtectedSaveBackup(original)).toBe(true);
        expect(state.getSaveAdmission().status).toBe('ready');
        expect(state.createLocalSaveBackup(raw).id).toBe(original.id);
        for (let i = 1; i <= 8; i++) {
            jest.setSystemTime(1700000000777 + i * 1000);
            state.set('player.cosmicCoins', i); expect(state.save()).toBe(true);
        }
        expect(backupPayloads(state)).toContain(raw); expect(state.getLocalSaveBackups().length).toBeLessThanOrEqual(3);
        expect(state.restoreLocalSaveBackup(original.id)).toBe(false);
        expect(state.getSaveAdmission().status).toBe('ready');
    });
    test('explicit New Game keeps the original rather than repairing its identity', () => {
        const raw = JSON.stringify(uncertain('legacy-shadow')); localStorage.setItem(state.saveKey, raw);
        expect(state.load()).toBe(false); expect(state.startFreshGame()).toBe(true);
        for (let i = 1; i <= 8; i++) {
            jest.setSystemTime(1700000000777 + i * 1000);
            state.set('player.cosmicCoins', i); expect(state.save()).toBe(true);
        }
        expect(backupPayloads(state)).toContain(raw);
        const reconstructed = fresh(); expect(reconstructed.load()).toBe(true);
        expect(backupPayloads(reconstructed)).toContain(raw);
        expect(reconstructed.get('game.cloudSavePausedForNewGame')).toBe(true);
    });
    test.each(['full-ring', 'allocation-failure'])(
        '%s refuses replacement without deleting original data', kind => {
            if (kind === 'full-ring') for (let i = 0; i < 3; i++) {
                const input = uncertain(); input.savedAt = i; expect(state.createLocalSaveBackup(JSON.stringify(input))).not.toBeNull();
            }
            const raw = JSON.stringify(uncertain('legacy-shadow')); localStorage.setItem(state.saveKey, raw);
            expect(state.load()).toBe(false);
            const before = storageSnapshot(), memory = JSON.stringify(state.state), set = Storage.prototype.setItem;
            if (kind === 'allocation-failure') jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                if (key.startsWith(state.saveBackupKeyPrefix)) throw new DOMException('Fictional quota', 'QuotaExceededError');
                return set.call(this, key, value);
            });
            expect(() => state.startFreshGame()).toThrow();
            expect(storageSnapshot()).toEqual(before); expect(JSON.stringify(state.state)).toBe(memory);
            expect(state.getSaveAdmission().status).toBe('held');
        });
    test('incoming uncertainty is copied unchanged and held before adoption', () => {
        const input = uncertain('legacy-shadow'), before = localStorage.getItem(state.saveKey), memory = JSON.stringify(state.state);
        expect(state.applyExternalSave(input, { source: 'fictional_import' })).toBe(false);
        expect(localStorage.getItem(state.saveKey)).toBe(before); expect(JSON.stringify(state.state)).toBe(memory);
        expect(state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
        expect(backupPayloads(state)).toContain(JSON.stringify(input));
    });
});
