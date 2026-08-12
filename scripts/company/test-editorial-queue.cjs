#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-editorial-queue.cjs');
const queuePath = path.join(repositoryRoot, 'docs', 'company', 'content', 'editorial-queue.json');
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a013-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', queue);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.queueValid, true);
    assert.strictEqual(baseline.output.publicationReadyCount, 0);
    assert.strictEqual(baseline.output.externalPublishingAuthorized, false);
    assert.deepStrictEqual(baseline.output.requiredMissingProofs, ['PF-003', 'PF-004', 'PF-005']);
    assert(baseline.output.results.some(item => item.id === 'CQ-006' && item.draftReady));

    const absoluteClaim = execute('absolute-claim', {
        ...queue,
        items: queue.items.map(item => item.id === 'CQ-006'
            ? { ...item, claimIds: [...item.claimIds, 'CL-012'] }
            : item)
    });
    assert.strictEqual(absoluteClaim.status, 1);
    assert(absoluteClaim.output.failures.some(failure => failure.includes('CL-012')));

    const noProof = execute('no-proof', {
        ...queue,
        items: queue.items.map(item => item.id === 'CQ-001'
            ? { ...item, proofIds: [] }
            : item)
    });
    assert.strictEqual(noProof.status, 1);
    assert(noProof.output.failures.some(failure => failure.includes('no proof requirement')));

    const publicationFlag = execute('publication-flag', {
        ...queue,
        externalPublishingAuthorized: true
    });
    assert.strictEqual(publicationFlag.status, 1);
    assert(publicationFlag.output.failures.some(failure => failure.includes('externalPublishingAuthorized')));

    console.log('A-013 editorial-queue evaluations passed (4 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
