#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-content-package.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/content/drafts/PROJECT_BEACON_INTRO.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a003-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 0);
    assert.strictEqual(baseline.output.validDraft, true);
    assert.strictEqual(baseline.output.authorizedForPublication, false);

    const absolute = execute('absolute', { ...source, copy: `${source.copy}\nEvery creature is unique.` });
    assert.strictEqual(absolute.status, 1);
    assert(absolute.output.failures.some(item => item.includes('uniqueness')));

    const internalClaim = execute('internal-claim', { ...source, claimsUsed: [...source.claimsUsed, 'CL-010'] });
    assert.strictEqual(internalClaim.status, 1);
    assert(internalClaim.output.failures.some(item => item.includes('CL-010')));

    const unknownClaim = execute('unknown-claim', { ...source, claimsUsed: ['CL-999'] });
    assert.strictEqual(unknownClaim.status, 1);
    assert(unknownClaim.output.failures.some(item => item.includes('Unknown claim')));

    const visualWithoutProof = execute('visual-without-proof', { ...source, contentType: 'video' });
    assert.strictEqual(visualWithoutProof.status, 1);
    assert(visualWithoutProof.output.failures.some(item => item.includes('Non-text content')));

    const missingCopy = execute('missing-copy', { ...source, copy: '' });
    assert.strictEqual(missingCopy.status, 1);
    assert(missingCopy.output.failures.some(item => item.includes('copy is required')));

    const unknownProof = execute('unknown-proof', { ...source, proofsUsed: ['PF-999'] });
    assert.strictEqual(unknownProof.status, 1);
    assert(unknownProof.output.failures.some(item => item.includes('Unknown proof')));

    console.log('A-003 content-package evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
