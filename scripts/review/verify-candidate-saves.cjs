#!/usr/bin/env node
// Synthetic local-save comparison only. No backend, browser or migration adapter.
// Run from a clean candidate: node scripts/review/verify-candidate-saves.cjs
// Historical sources and synthetic saves are checksum-pinned fixtures, not Git lookups.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('esbuild');
const { readPinnedSource } = require('../../src/__tests__/support/pinnedSourceFixture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '5adcb023ac80f97aa6a64143cec31519fa5e6b21';
const FIXTURES = '358e3f1e313e859b71198c5a817e7a4ae51cb874';
const FOLDER = 'src/__tests__/fixtures/save-compatibility';
const EPOCH = 1700000000777;
const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' }
});

function changedLeaves(before, after, location = '') {
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    if (before && after && typeof before === 'object' && typeof after === 'object' &&
        Array.isArray(before) === Array.isArray(after)) {
        const changes = Object.keys(before).flatMap(key => changedLeaves(before[key], after[key], `${location}/${key}`));
        if (Array.isArray(before) && before.length !== after.length) {
            changes.push({ path: `${location}/length`, before: before.length, after: after.length });
        }
        return changes;
    }
    return [{ path: location, before, after }];
}

// The established fixture pack's exact, documented derived-state migrations.
function expectedMigration({ path: location, before, after }) {
    if (location === '/version') return before === '1.0.0' && after === '1.1.0';
    if (location === '/story/projectBeacon/shipArchive/completedAt') return before === null && after === false;
    if (/^\/story\/projectBeacon\/companion(Consent|EarthMemory)\/activeCompanionId$/.test(location)) return before === null && after === 'your_creature';
    if (/^\/hubWorld\/gates\/(crystal_caves|stellar_reef)\/unlocked$/.test(location)) return before === false && after === true;
    if (location === '/story/projectBeacon/pendingDebriefs/length') return before === 0 && [1, 2].includes(after);
    const prefix = '/world/sanctuaryDecorations/kinshipBeacon/';
    const expected = {
        [`${prefix}unlocked`]: [false, true],
        [`${prefix}firstOperationId`]: [null, 'fusion_lab_completed'],
        [`${prefix}lastOperationId`]: [null, 'fusion_lab_completed'],
        [`${prefix}firstLitAt`]: [null, EPOCH - 2000],
        [`${prefix}lastLitAt`]: [null, EPOCH - 2000],
        [`${prefix}lineageCount`]: [0, 1],
        '/breedingShrine/discovery/state': ['dormant', 'first_lineage'],
        '/breedingShrine/discovery/firstLineageAt': [null, EPOCH - 2000],
        '/breedingShrine/discovery/firstLineageOperationId': [null, 'fusion_lab_completed']
    };
    return Object.hasOwn(expected, location) && expected[location][0] === before && expected[location][1] === after;
}

async function compile(commit) {
    const sources = {};
    const deferredRecoveryImports = new Set();
    const result = await build({
        stdin: { contents: `import GameStateManager from './src/systems/GameState.js';
            import * as FusionConsent from './src/systems/FusionConsent.js';
            import * as SharedFusionInvitation from './src/systems/SharedFusionInvitationService.js';
            import * as ProtectedReturnProtocol from './src/systems/ProtectedReturnProtocol.js';
            import * as CurrentVeilMission from './src/systems/CurrentVeilMission.js';
            export { GameStateManager, FusionConsent, SharedFusionInvitation, ProtectedReturnProtocol, CurrentVeilMission };`,
            sourcefile: 'synthetic-save-entry.js' },
        platform: 'node', format: 'cjs', bundle: true, write: false, logLevel: 'silent',
        plugins: [{ name: 'committed-source-only', setup(api) {
            api.onResolve({ filter: /.*/ }, args => {
                // Compile the optional recovery leaf without executing either
                // dependency. The save VM still denies every require call.
                if (args.importer === 'src/systems/CloudRecoveryJournal.js' && args.kind === 'require-call' &&
                    ['@noble/hashes/sha256', 'node:buffer'].includes(args.path)) {
                    deferredRecoveryImports.add(args.path);
                    return { path: args.path, external: true };
                }
                if (!args.path.startsWith('.')) throw new Error('SAVE_REVIEW_EXTERNAL_IMPORT_DENIED');
                const file = path.posix.normalize(path.posix.join(path.posix.dirname(args.importer || 'entry.js'), args.path));
                if (!/^src\/(systems|config)\//.test(file) || !/\.(js|json)$/.test(file)) throw new Error('SAVE_REVIEW_IMPORT_DENIED');
                return { path: file, namespace: 'committed-source' };
            });
            api.onLoad({ filter: /.*/, namespace: 'committed-source' }, args => {
                const contents = commit === BASELINE
                    ? readPinnedSource(`${BASELINE}:${args.path}`)
                    : git(['show', `${commit}:${args.path}`]);
                sources[args.path] = sha(contents);
                return { contents, loader: args.path.endsWith('.json') ? 'json' : 'js' };
            });
        } }]
    });
    return { code: result.outputFiles[0].text, sources, deferredRecoveryImports: [...deferredRecoveryImports].sort() };
}

function inspectSave(compiled, raw) {
    const storage = new Map();
    const attempts = [];
    const denied = api => () => { attempts.push(api); throw new Error(`SAVE_REVIEW_DENIED:${api}`); };
    const context = vm.createContext({
        module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
        fetch: denied('fetch'), require: denied('require'), WebSocket: denied('WebSocket'),
        XMLHttpRequest: denied('XMLHttpRequest'), Audio: denied('Audio'),
        setTimeout: denied('setTimeout'), setInterval: denied('setInterval'),
        clearTimeout() {}, clearInterval() {},
        localStorage: {
            get length() { return storage.size; }, key: n => [...storage.keys()][n] ?? null,
            getItem: key => storage.get(String(key)) ?? null,
            setItem: (key, value) => storage.set(String(key), String(value)),
            removeItem: key => storage.delete(String(key)), clear: () => storage.clear()
        }
    });
    vm.runInContext(`Date.now = () => ${EPOCH}; Math.random = () => 0.25;`, context, { timeout: 1000 });
    vm.runInContext(compiled.code, context, { timeout: 5000 });
    context.raw = raw;
    vm.runInContext(`
        const { GameStateManager, FusionConsent, SharedFusionInvitation, ProtectedReturnProtocol, CurrentVeilMission } = module.exports;
        Object.assign(globalThis, { FusionConsent, SharedFusionInvitation });
        globalThis.window = { ProtectedReturnProtocol, CurrentVeilMission };
        const first = new GameStateManager();
        localStorage.setItem(first.saveKey, raw);
        const originalState = JSON.stringify(first.state);
        let prepared = null, error = null;
        try { prepared = first.prepareSaveCandidate(raw); }
        catch (e) { error = e.code || e.message; }
        result = { prepared: prepared?.snapshot || null, error,
            preparationKeptBytes: localStorage.getItem(first.saveKey) === raw,
            preparationKeptState: JSON.stringify(first.state) === originalState };
    `, context, { timeout: 5000 });
    const result = JSON.parse(JSON.stringify(context.result));
    assert(result.preparationKeptBytes && result.preparationKeptState, 'Preparation mutated the original save');
    const losses = result.prepared ? changedLeaves(JSON.parse(raw), result.prepared).filter(change => !expectedMigration(change)) : [];
    result.status = result.error || losses.length ? 'HOLD' : 'preserved';
    result.losses = losses;
    if (result.status === 'preserved') {
        vm.runInContext(`
            if (!first.load()) throw Error('FIRST_LOAD_FAILED');
            const loaded = first.createSaveSnapshot();
            if (!first.save()) throw Error('SAVE_FAILED');
            const second = new GameStateManager();
            if (!second.load()) throw Error('SECOND_LOAD_FAILED');
            result.loaded = loaded;
            result.reloaded = second.createSaveSnapshot();
            result.recoveryCopyRetained = [...Array(localStorage.length)].map((_, i) => localStorage.key(i))
                .filter(key => key.startsWith(first.saveBackupKeyPrefix))
                .some(key => JSON.parse(localStorage.getItem(key)).payload === raw);
            result.originalChanged = raw !== prepared.serialized;
            first.stopAutoSave(); second.stopAutoSave();
        `, context, { timeout: 5000 });
        const replay = JSON.parse(JSON.stringify(context.result));
        result.roundTripChanges = changedLeaves(replay.loaded, replay.reloaded).filter(change => !(
            ['/savedAt', '/player/lastPlayed'].includes(change.path) && change.after === EPOCH
        ));
        assert.deepEqual(result.roundTripChanges, [], 'Save/load changed established progress');
        assert(!replay.originalChanged || replay.recoveryCopyRetained, 'Original migration bytes were not retained');
        result.recoveryCopyRetained = replay.recoveryCopyRetained;
    } else if (vm.runInContext('typeof first.getSaveAdmission === "function"', context)) {
        vm.runInContext(`
            if (first.load()) throw Error('HELD_SAVE_WAS_ADMITTED');
            for (let index = 0; index < 8; index++) {
                Date.now = () => ${EPOCH} + index * 30000;
                if (first.save()) throw Error('HELD_SAVE_WAS_WRITTEN');
                first.startAutoSave();
                if (localStorage.getItem(first.saveKey) !== raw) throw Error('HELD_BYTES_CHANGED');
            }
            const reopened = new GameStateManager();
            if (reopened.load() || reopened.save()) throw Error('REOPENED_HOLD_WAS_ADMITTED');
            if (localStorage.getItem(first.saveKey) !== raw) throw Error('REOPENED_BYTES_CHANGED');
            result.runtimeAdmissionProtected = true;
            if (!first.startFreshGame()) throw Error('EXPLICIT_NEW_GAME_FAILED');
            for (let index = 0; index < 8; index++) {
                Date.now = () => ${EPOCH} + (index + 8) * 30000;
                first.set('player.cosmicCoins', index);
                if (!first.save()) throw Error('NEW_GAME_SAVE_FAILED');
            }
            const recovered = new GameStateManager();
            if (!recovered.load()) throw Error('NEW_GAME_RELOAD_FAILED');
            result.protectedOriginalRetained = recovered.getLocalSaveBackups().some(entry =>
                JSON.parse(localStorage.getItem(recovered.saveBackupKeyPrefix + entry.id)).payload === raw);
            if (!result.protectedOriginalRetained) throw Error('UNSUPPORTED_RECOVERY_ROTATED_AWAY');
        `, context, { timeout: 5000 });
        Object.assign(result, JSON.parse(JSON.stringify(context.result)));
    }
    assert.deepEqual(attempts, [], 'Save code attempted a forbidden service or timer');
    result.preparedSha256 = result.prepared ? sha(JSON.stringify(result.prepared)) : null;
    delete result.prepared;
    return result;
}

async function run() {
    if (process.argv.length !== 2) throw new Error('This read-only check takes no arguments');
    assert.equal(git(['status', '--porcelain']).trim(), '', 'Commit the candidate before exact-source save verification');
    const commit = git(['rev-parse', 'HEAD']).trim();
    const manifestBytes = readPinnedSource(`${FIXTURES}:${FOLDER}/manifest.json`);
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.syntheticOnly, true);
    assert.equal(manifest.fixtures.length, 19);
    assert.equal(manifest.fixedTime, EPOCH);
    const baseline = await compile(BASELINE);
    const candidate = await compile(commit);
    const cases = manifest.fixtures.map(fixture => {
        const raw = readPinnedSource(`${FIXTURES}:${FOLDER}/${fixture.id}.json`);
        assert.equal(sha(raw), fixture.sha256, `${fixture.id}: fixture hash mismatch`);
        const before = inspectSave(baseline, raw), after = inspectSave(candidate, raw);
        return { id: fixture.id, fixtureSha256: fixture.sha256, baseline: before, candidate: after,
            matchesBaseline: JSON.stringify(before) === JSON.stringify(after) };
    });
    const output = mkdtempSync(path.join(os.tmpdir(), 'mythical-candidate-saves-'));
    const report = { sourceCommit: commit, baselineCommit: BASELINE, fixtureCommit: FIXTURES,
        fixtureManifestSha256: sha(manifestBytes), cases,
        noNewCompatibilityRegressions: cases.every(item => item.baseline.status === 'preserved'
            ? item.matchesBaseline
            : item.candidate.status === 'HOLD' && item.candidate.runtimeAdmissionProtected === true && item.candidate.protectedOriginalRetained === true),
        everyFixturePreserved: cases.every(item => item.candidate.status === 'preserved'),
        sources: { baseline: baseline.sources, candidate: candidate.sources },
        limits: ['Synthetic local Storage only; no browser eviction, cloud service or migration qualification.',
            'HOLD means preparation would reject or alter existing data. The probe does not adopt it.',
            'Held candidates now exercise actual local refusal, repeated saves, reconstruction, and explicit backed-up New Game.',
            'Cloud races are covered by separate fake-client tests, not this synchronous VM.'],
        browserOpened: false, runtimeBackendChanged: false, realPlayerRecordsUsed: false };
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, sourceCommit: commit,
        noNewCompatibilityRegressions: report.noNewCompatibilityRegressions,
        preserved: cases.filter(item => item.candidate.status === 'preserved').map(item => item.id),
        holds: cases.filter(item => item.candidate.status === 'HOLD').map(item => ({ id: item.id,
            error: item.candidate.error, changedPaths: item.candidate.losses.map(change => change.path) })) }, null, 2));
    if (!report.noNewCompatibilityRegressions) process.exitCode = 1;
}

module.exports = { changedLeaves, expectedMigration, inspectSave, compile, run };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
