#!/usr/bin/env node

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'submit-indexnow.cjs');
let cases = 0;

function run(argumentsList) {
    return spawnSync(process.execPath, [script, ...argumentsList], { encoding: 'utf8', timeout: 30_000 });
}

function expectDryRun(argumentsList, expectedUrls) {
    const result = run(argumentsList);
    assert.strictEqual(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.mode, 'dry_run');
    assert.deepStrictEqual(output.urlList, expectedUrls);
    cases += 1;
}

function expectRejected(argumentsList, message) {
    const result = run(argumentsList);
    assert.notStrictEqual(result.status, 0);
    assert(`${result.stderr}${result.stdout}`.includes(message), `${argumentsList.join(' ')} should report ${message}`);
    cases += 1;
}

expectDryRun(
    ['--url', '/', '--url', '/playable-now/'],
    ['https://mythicalvoid.com/', 'https://mythicalvoid.com/playable-now/']
);
expectDryRun(
    ['--url', 'https://mythicalvoid.com/playable-now/', '--url', '/playable-now/'],
    ['https://mythicalvoid.com/playable-now/']
);
expectRejected(['--url', 'https://example.com/'], 'clean owned Mythical Void address');
expectRejected(['--url', '/playable-now/?campaign=one'], 'clean owned Mythical Void address');
expectRejected(['--url', '/not-a-canonical-page/'], 'not in the canonical sitemap');
expectRejected(['--other'], 'Usage:');

assert.strictEqual(cases, 6);
console.log('Changed-page IndexNow safeguards passed (6 cases).');
