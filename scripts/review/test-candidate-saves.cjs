const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { changedLeaves, expectedMigration, inspectSave, compile } = require('./verify-candidate-saves.cjs');
const { readPinnedSource } = require('../../src/__tests__/support/pinnedSourceFixture.cjs');

test('comparison detects changes to IDs, relationships, progress and removed records', () => {
    const original = { creature: { id: 'synthetic-child', parentIds: ['synthetic-parent'], experience: 99 }, receipts: ['synthetic-operation'] };
    const altered = { creature: { id: 'replacement', parentIds: [], experience: 0 }, receipts: [] };
    const changes = changedLeaves(original, altered);
    for (const location of ['/creature/id', '/creature/parentIds/0', '/creature/parentIds/length',
        '/creature/experience', '/receipts/0', '/receipts/length']) {
        assert(changes.some(change => change.path === location), location);
    }
    assert(changes.every(change => !expectedMigration(change)));
    assert.deepEqual(changedLeaves(original, structuredClone(original)), []);
});

test('derived migration allowances stay narrow and never permit a general reset', () => {
    assert(expectedMigration({ path: '/version', before: '1.0.0', after: '1.1.0' }));
    assert(!expectedMigration({ path: '/version', before: '9.0.0', after: '1.1.0' }));
    assert(!expectedMigration({ path: '/levels/mythicalForest/completed', before: true, after: false }));
    assert(!expectedMigration({ path: '/creature/genes/id', before: 'original', after: 'replacement' }));
    assert(!expectedMigration({ path: '/breedingShrine/completedOperationIds/length', before: 26, after: 25 }));
});

for (const api of ['fetch', 'require', 'WebSocket', 'XMLHttpRequest', 'Audio', 'setTimeout', 'setInterval']) {
    test(`save VM refuses ${api} before any real service or timer can run`, () => {
        assert.throws(() => inspectSave({ code: `${api}('synthetic-only')` }, '{}'), new RegExp(`SAVE_REVIEW_DENIED:${api}`));
    });
}

test('committed candidate preserves the synthetic roster and reports the retained history limit honestly', async () => {
    const cwd = require('node:path').resolve(__dirname, '../..');
    const git = args => execFileSync('git', ['--no-optional-locks', ...args], { cwd, encoding: 'utf8', timeout: 15000 });
    const compiled = await compile(git(['rev-parse', 'HEAD']).trim());
    assert(compiled.sources['src/systems/GameState.js']);
    assert(compiled.sources['src/systems/ProtectedReturnProtocol.js']);
    assert.deepEqual(compiled.deferredRecoveryImports, ['@noble/hashes/sha256', 'node:buffer']);
    const fixture = id => readPinnedSource(`358e3f1e313e859b71198c5a817e7a4ae51cb874:src/__tests__/fixtures/save-compatibility/${id}.json`);
    const roster = inspectSave(compiled, fixture('progressed-roster'));
    assert.equal(roster.status, 'preserved');
    assert.deepEqual(roster.losses, []);
    assert.deepEqual(roster.roundTripChanges, []);
    const overLimit = inspectSave(compiled, fixture('shared-history-over-limit'));
    assert.equal(overLimit.status, 'HOLD');
    assert.equal(overLimit.error, 'save_would_lose_history');
    assert.equal(overLimit.runtimeAdmissionProtected, true);
    assert.equal(overLimit.protectedOriginalRetained, true);
    assert.equal(overLimit.preparationKeptBytes, true);
    assert.equal(overLimit.preparationKeptState, true);
    const future = inspectSave(compiled, fixture('future-major-version'));
    assert.equal(future.status, 'HOLD');
    assert.equal(future.error, 'version_mismatch');
    assert.equal(future.runtimeAdmissionProtected, true);
    assert.equal(future.protectedOriginalRetained, true);
});
