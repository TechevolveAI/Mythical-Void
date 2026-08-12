#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-commercial-pipeline.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/commercial/opportunities.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a007-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceFirst(changes) {
    return { ...source, opportunities: source.opportunities.map((item, index) => index === 0 ? { ...item, ...changes } : item) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 0);
    assert.strictEqual(baseline.output.valid, true);
    assert.strictEqual(baseline.output.externalActionsAuthorized, false);

    const duplicate = execute('duplicate', { ...source, opportunities: source.opportunities.map((item, index) => index === 1 ? { ...item, id: source.opportunities[0].id } : item) });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(item => item.includes('Duplicate')));

    const insecureSource = execute('insecure-source', replaceFirst({ source: 'http://example.com' }));
    assert.strictEqual(insecureSource.status, 1);
    assert(insecureSource.output.failures.some(item => item.includes('HTTPS')));

    const advanced = execute('advanced', replaceFirst({ stage: 'contacted', outreachApproved: false, contactedAt: null }));
    assert.strictEqual(advanced.status, 1);
    assert(advanced.output.failures.some(item => item.includes('without outreach approval')));

    const contactWithoutApproval = execute('contact-without-approval', replaceFirst({ contactedAt: '2026-08-11T00:00:00Z', outreachApproved: false }));
    assert.strictEqual(contactWithoutApproval.status, 1);
    assert(contactWithoutApproval.output.failures.some(item => item.includes('contact activity')));

    console.log('A-007 commercial-pipeline evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
