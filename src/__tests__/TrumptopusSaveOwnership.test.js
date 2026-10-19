const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const GameStateManager = require('../systems/GameState.js');

function load(file, names, dependencies = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../systems', file), 'utf8');
    const body = parse(source, { sourceType: 'module' }).program.body.map(node => {
        if (node.type === 'ImportDeclaration' || node.type === 'ExportDefaultDeclaration') return '';
        if (node.type === 'ExportNamedDeclaration') return node.declaration ? source.slice(node.declaration.start, node.declaration.end) : '';
        return source.slice(node.start, node.end);
    }).join('\n');
    return new Function('window', ...Object.keys(dependencies), `${body}\nreturn {${names.join(',')}};`)(
        {}, ...Object.values(dependencies));
}
const dependencies = {
    bossConfigs: require('../config/bosses.json'),
    ...load('GuardianOutcomes.js', ['getGuardianOutcomeSnapshot']),
    ...load('CurrentEcology.js', ['recordCurrentRegionRestoration']),
    ...load('RescuedResidents.js', ['recordRescuedResident']),
    ...load('ProjectBeaconStory.js', ['queueProjectBeaconDebrief'], { projectBeacon: require('../config/project-beacon.json') }),
    ...load('FinalVoidApproach.js', ['validApproachCheckpoint'])
};
const { beginTrumptopusRun: begin, checkpointTrumptopusRun: checkpoint,
    checkpointTrumptopusApproach: approach, recordTrumptopusVictory: win,
    getTrumptopusRun: run } = load('TrumptopusProgress.js', [
    'beginTrumptopusRun', 'checkpointTrumptopusRun', 'checkpointTrumptopusApproach',
    'recordTrumptopusVictory', 'getTrumptopusRun'
], dependencies);

// Actual current-client GameState and progress/reward leaf modules. Storage,
// identities and synchronous callbacks are fictional; no game/service runs.
function fixture(operation) {
    const state = new GameStateManager();
    state.set('creature.genes', { id: 'synthetic_finale_genes', rarity: 'rare', species: 'synthetic_crystal' });
    state.set('creature.dna', { id: 'synthetic_finale_dna', seed: 42 });
    state.set('creature.lifecycle.stage', 'adult'); state.set('creature.hatched', true);
    expect(state.save()).toBe(true);
    const sequence = operation === 'begin' ? 1 : begin(state, { withApproach: operation === 'approach' }).run.sequence;
    if (operation === 'victory') { checkpoint(state, sequence, 1); checkpoint(state, sequence, 2); }
    const invoke = () => {
        if (operation === 'begin') return begin(state);
        if (operation === 'phase') return checkpoint(state, sequence, 1, { elapsedMs: 1200 });
        if (operation === 'approach') return approach(state, sequence,
            { schemaVersion: 1, clearedGrips: 1, arrived: false }, { elapsedMs: 1200 });
        if (operation === 'victory') return win(state, { sequence, completionMs: 1200 });
        throw Error('UNSUPPORTED_SYNTHETIC_OPERATION');
    };
    return { state, sequence, invoke,
        raw: () => localStorage.getItem(state.saveKey),
        attempt() { try { return { result: invoke() }; } catch (error) { return { error }; } },
        close() { state.stopAutoSave(); } };
}

describe('finale memory fallback must not reapply a retired save', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

    for (const operation of ['begin', 'phase', 'approach', 'victory']) {
        test.each(['new-game', 'saved-progress', 'unsaved-progress', 'admission', 'cloud-reservation'])(
            `${operation} preserves a successor created by %s during backup`, change => {
                const f = fixture(operation), progress = jest.fn();
                let successor;
                try {
                    const off = f.state.on('saveBackupCreated', () => {
                        off();
                        if (change === 'new-game') expect(f.state.startFreshGame()).toBe(true);
                        if (change === 'saved-progress' || change === 'unsaved-progress') {
                            f.state.set('player.cosmicCoins', 77);
                            if (change === 'saved-progress') expect(f.state.save()).toBe(true);
                        }
                        if (change === 'admission') f.state.releaseSaveAdmission();
                        if (change === 'cloud-reservation') f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true);
                        successor = { state: f.state.state, snapshot: JSON.stringify(f.state.createSaveSnapshot()),
                            raw: f.raw(), admission: f.state.saveAdmission, mode: f.state.storageMode,
                            lease: f.state.cloudWriteLease };
                        f.state.on('trumptopusProgressChanged', progress);
                    });
                    const outcome = f.attempt();
                    expect(successor).toBeDefined();
                    expect({ error: outcome.error?.code || null,
                        sameState: f.state.state === successor.state,
                        sameSnapshot: JSON.stringify(f.state.createSaveSnapshot()) === successor.snapshot,
                        sameRaw: f.raw() === successor.raw, sameAdmission: f.state.saveAdmission === successor.admission,
                        sameMode: f.state.storageMode === successor.mode, sameLease: f.state.cloudWriteLease === successor.lease,
                        notifications: progress.mock.calls.length }).toEqual({ error: 'save_context_changed',
                        sameState: true, sameSnapshot: true, sameRaw: true, sameAdmission: true,
                        sameMode: true, sameLease: true, notifications: 0 });
                    if (change === 'cloud-reservation') {
                        expect(f.state.inspectCloudRecovery().pending.map(entry => entry.id)).toEqual([successor.lease.id]);
                    }
                } finally { f.close(); }
            }
        );

        test(`${operation} retains its normal persisted result and source identity`, () => {
            const f = fixture(operation);
            try {
                const result = f.invoke();
                expect(operation === 'begin' || operation === 'victory' ? result.persisted : result).toBe(true);
                expect(f.state.get('creature.genes.id')).toBe('synthetic_finale_genes');
                expect(f.state.get('creature.dna.id')).toBe('synthetic_finale_dna');
                expect(run(f.state)?.status).toBe(operation === 'victory' ? 'won' : 'fighting');
                const next = new GameStateManager(); expect(next.load()).toBe(true);
                expect(run(next)).toEqual(run(f.state)); next.stopAutoSave();
            } finally { f.close(); }
        });
    }

    test('a retired winning draft cannot leak into the next ordinary save after New Game', () => {
        const f = fixture('victory');
        let fresh;
        try {
            const off = f.state.on('saveBackupCreated', () => {
                off(); expect(f.state.startFreshGame()).toBe(true); fresh = f.raw();
            });
            f.attempt(); expect(f.state.save()).toBe(true);
            const before = JSON.parse(fresh), after = JSON.parse(f.raw());
            // A normal save legitimately updates only these clock fields here.
            delete before.savedAt; delete after.savedAt;
            delete before.player.lastPlayed; delete after.player.lastPlayed;
            expect(after).toEqual(before);
            expect(f.state.get('levels.finalVoid.completed')).toBe(false);
            expect(run(f.state)).toBeNull();
            expect(f.state.get('hubWorld.shipParts.collected')).not.toContain('command_module');
        } finally { f.close(); }
    });

    test.each(['memory', 'denied-before-write'])(
        'current-owner %s storage keeps the existing truthful in-session win', kind => {
            const f = fixture('victory'), oldRaw = f.raw();
            try {
                if (kind === 'memory') f.state.storageMode = 'memory';
                else {
                    const set = Storage.prototype.setItem;
                    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
                        if (key === f.state.saveKey) throw new DOMException('Synthetic storage denial', 'SecurityError');
                        return set.call(this, key, value);
                    });
                }
                expect(f.invoke()).toMatchObject({ changed: true, persisted: false, receipt: { outcome: 'banished' } });
                expect(f.raw()).toBe(oldRaw); expect(run(f.state).status).toBe('won');
                expect(f.state.get('creature.dna.id')).toBe('synthetic_finale_dna');
                expect(f.state.get('inventory.items').find(item => item.id === 'super_blast').quantity).toBe(1);
                expect(win(f.state, { sequence: f.sequence }).changed).toBe(false);
            } finally { f.close(); }
        }
    );
});
