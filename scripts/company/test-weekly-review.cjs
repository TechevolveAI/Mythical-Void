#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const compilerPath = path.join(__dirname, 'compile-weekly-review.cjs');
const state = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/current-state.json'), 'utf8'));
const queue = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/decision-queue.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a002-'));

function execute(name, stateValue, queueValue, invalidState = false) {
    const statePath = path.join(temporaryDirectory, `${name}-state.json`);
    const queuePath = path.join(temporaryDirectory, `${name}-queue.json`);
    fs.writeFileSync(statePath, invalidState ? '{' : JSON.stringify(stateValue));
    fs.writeFileSync(queuePath, JSON.stringify(queueValue));
    return spawnSync(process.execPath, [compilerPath, statePath, queuePath], { encoding: 'utf8' });
}

try {
    const baseline = execute('baseline', state, queue);
    assert.strictEqual(baseline.status, 0);
    assert(baseline.stdout.includes('# Mythical Weekly Company Review'));
    assert(baseline.stdout.includes('## Kevin decision queue'));
    assert(baseline.stdout.includes('A-035'));

    const blank = execute('blank', { ...state, executive: { ...state.executive, outcome: '' } }, queue);
    assert.strictEqual(blank.status, 1);
    assert(blank.stderr.includes('executive.outcome'));

    const noScorecard = execute('no-scorecard', { ...state, scorecard: [] }, queue);
    assert.strictEqual(noScorecard.status, 1);
    assert(noScorecard.stderr.includes('scorecard'));

    const sixPackets = execute('six-packets', state, { ...queue, packets: [...queue.packets, { ...queue.packets[0], id: 'KDP-999' }] });
    assert.strictEqual(sixPackets.status, 1);
    assert(sixPackets.stderr.includes('one to five'));

    const inactiveQueue = execute('inactive-queue', state, { ...queue, status: 'paused' });
    assert.strictEqual(inactiveQueue.status, 1);
    assert(inactiveQueue.stderr.includes('active schemaVersion 1'));

    const invalidJson = execute('invalid-json', state, queue, true);
    assert.strictEqual(invalidJson.status, 1);
    assert(invalidJson.stderr.includes('invalid JSON'));

    console.log('A-002 weekly-review evaluations passed (6 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
