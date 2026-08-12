#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const detectorPath = path.join(__dirname, 'detect-company-control-plane-changes.cjs');
const baselinePath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'control-plane-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a015-'));

function execute(name, current) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(current));
    const result = spawnSync(process.execPath, [detectorPath, '--baseline', baselinePath, '--current', target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const unchanged = execute('unchanged', baseline);
    assert.strictEqual(unchanged.status, 0);
    assert.strictEqual(unchanged.output.comparisonValid, true);
    assert.strictEqual(unchanged.output.changeCount, 0);
    assert.strictEqual(unchanged.output.alertRequired, false);

    const brokenControl = execute('broken-control', {
        ...baseline,
        capturedAt: '2026-08-11T12:00:00Z',
        controlStates: { ...baseline.controlStates, 'A-009': 'broken' }
    });
    assert.strictEqual(brokenControl.status, 2);
    assert.strictEqual(brokenControl.output.alertRequired, true);
    assert(brokenControl.output.changes.some(item => item.id === 'CHG-CONTROL-A-009' && item.severity === 'critical'));

    const publicRegression = execute('public-regression', {
        ...baseline,
        capturedAt: '2026-08-11T12:00:00Z',
        publicFootprint: { ...baseline.publicFootprint, findings: 12, major: 8 }
    });
    assert.strictEqual(publicRegression.status, 2);
    assert(publicRegression.output.changes.some(item => item.id === 'CHG-PUBLIC-MAJOR' && item.severity === 'high'));

    const unexpectedAuthorization = execute('unexpected-authorization', {
        ...baseline,
        capturedAt: '2026-08-11T12:00:00Z',
        externalActionAuthorized: true
    });
    assert.strictEqual(unexpectedAuthorization.status, 2);
    assert(unexpectedAuthorization.output.changes.some(item => item.id === 'CHG-AUTH' && item.severity === 'critical'));

    const riskClosed = execute('risk-closed', {
        ...baseline,
        capturedAt: '2026-08-11T12:00:00Z',
        riskStates: { ...baseline.riskStates, 'R-001': { severity: 'critical', status: 'mitigated' } }
    });
    assert.strictEqual(riskClosed.status, 0);
    assert.strictEqual(riskClosed.output.alertRequired, false);
    assert(riskClosed.output.changes.some(item => item.id === 'CHG-RISK-R-001-STATUS' && item.severity === 'informational'));

    console.log('A-015 control-plane change evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
