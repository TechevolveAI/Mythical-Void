#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-channel-registry.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a008-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceFirst(changes) {
    return { ...source, channels: source.channels.map((item, index) => index === 0 ? { ...item, ...changes } : item) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 0);
    assert.strictEqual(baseline.output.valid, true);
    assert.strictEqual(baseline.output.externalPublishingAuthorized, false);

    const duplicate = execute('duplicate', { ...source, channels: source.channels.map((item, index) => index === 1 ? { ...item, id: source.channels[0].id } : item) });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(item => item.includes('Duplicate')));

    const invalidState = execute('invalid-state', replaceFirst({ state: 'live' }));
    assert.strictEqual(invalidState.status, 1);
    assert(invalidState.output.failures.some(item => item.includes('invalid state')));

    const prematurePublish = execute('premature-publish', replaceFirst({ state: 'publish_approved', publishingCredential: false, moderationReady: false }));
    assert.strictEqual(prematurePublish.status, 1);
    assert(prematurePublish.output.failures.some(item => item.includes('global publishing is off')));

    const earlyCredential = execute('early-credential', replaceFirst({ publishingCredential: true }));
    assert.strictEqual(earlyCredential.status, 0);
    assert(earlyCredential.output.warnings.some(item => item.includes('publishing credential before publish approval')));

    console.log('A-008 channel-registry evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
