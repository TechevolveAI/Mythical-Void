#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildSignalLog } = require('./build-public-signal-log.cjs');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-public-signal-log.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-signal-log-'));

function run(name, mutate = value => value, stale = false) {
    const data = structuredClone(source);
    mutate(data);
    const dataPath = path.join(temporary, `${name}.json`);
    const pagePath = path.join(temporary, `${name}.html`);
    fs.writeFileSync(dataPath, JSON.stringify(data));
    fs.writeFileSync(pagePath, stale ? '<!doctype html><title>stale</title>' : buildSignalLog(data));
    return spawnSync(process.execPath, [validator, dataPath, pagePath], { cwd: root, encoding: 'utf8' });
}

try {
    assert.strictEqual(run('valid').status, 0);
    assert.notStrictEqual(run('unpublished', data => { data.entries[0].status = 'draft'; }).status, 0);
    assert.notStrictEqual(run('tracked', data => { data.entries[0].destination += '?utm_source=test'; }).status, 0);
    assert.notStrictEqual(run('mislabelled-art', data => { data.entries[0].disclosure = 'A beautiful creature image.'; }).status, 0);
    assert.notStrictEqual(run('invented-metric', data => { data.entries[0].summary = 'Already enjoyed by 10,000 players.'; }).status, 0);
    assert.notStrictEqual(run('opened-comments', data => { data.publicationBoundary.commentsEnabled = true; }).status, 0);
    assert.notStrictEqual(run('unsupported-field', data => { data.entries[0].email = 'hello@example.com'; }).status, 0);
    assert.notStrictEqual(run('stale', value => value, true).status, 0);
    console.log('Public Signal Log safeguards passed (8 cases).');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
