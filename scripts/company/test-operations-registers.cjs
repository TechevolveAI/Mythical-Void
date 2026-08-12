#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-operations-registers.cjs');
const vendors = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/vendors.json'), 'utf8'));
const risks = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a009-'));

function execute(name, vendorValue, riskValue) {
    const vendorPath = path.join(temporaryDirectory, `${name}-vendors.json`);
    const riskPath = path.join(temporaryDirectory, `${name}-risks.json`);
    fs.writeFileSync(vendorPath, JSON.stringify(vendorValue));
    fs.writeFileSync(riskPath, JSON.stringify(riskValue));
    const result = spawnSync(process.execPath, [validatorPath, vendorPath, riskPath], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', vendors, risks);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.registersValid, true);
    assert.strictEqual(baseline.output.operationalReadiness, false);

    const duplicate = execute('duplicate', { ...vendors, vendors: vendors.vendors.map((item, index) => index === 1 ? { ...item, id: vendors.vendors[0].id } : item) }, risks);
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(item => item.includes('Duplicate vendor')));

    const severity = execute('severity', vendors, { ...risks, risks: risks.risks.map((item, index) => index === 0 ? { ...item, severity: 'urgent' } : item) });
    assert.strictEqual(severity.status, 1);
    assert(severity.output.failures.some(item => item.includes('invalid severity')));

    const missingOwner = execute('missing-owner', { ...vendors, vendors: vendors.vendors.map((item, index) => index === 0 ? { ...item, owner: '' } : item) }, risks);
    assert.strictEqual(missingOwner.status, 1);
    assert(missingOwner.output.failures.some(item => item.includes('lacks owner')));

    const noControls = execute('no-controls', vendors, { ...risks, risks: risks.risks.map((item, index) => index === 0 ? { ...item, controls: [] } : item) });
    assert.strictEqual(noControls.status, 1);
    assert(noControls.output.failures.some(item => item.includes('lacks controls')));

    console.log('A-009 operations-register evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
