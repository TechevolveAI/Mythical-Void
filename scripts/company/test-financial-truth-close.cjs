#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(repositoryRoot, 'scripts/company/validate-financial-truth-close.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/financial-truth-close.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-financial-close-'));

function execute(name, value) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    const result = spawnSync(process.execPath, [validator, file], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.financialCloseContractValid, true);
    assert.strictEqual(baseline.output.restrictedSourceClassCount, 6);
    assert.strictEqual(baseline.output.baselineEvidenceClassCount, 12);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.requiredReviewedCloseCycleCount, 4);

    const authority = execute('authority', { ...source, authority: { ...source.authority, accountingAccessAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(item => item.includes('accountingAccessAuthorized')));

    const sharedActuals = execute('shared-actuals', { ...source, dataBoundary: { ...source.dataBoundary, restrictedActualValuesInSharedRepositoryPermitted: true } });
    assert.strictEqual(sharedActuals.status, 1);
    assert(sharedActuals.output.failures.some(item => item.includes('restrictedActualValues')));

    const missingAsZero = execute('missing-as-zero', { ...source, dataBoundary: { ...source.dataBoundary, missingEvidenceMeansZero: true } });
    assert.strictEqual(missingAsZero.status, 1);
    assert(missingAsZero.output.failures.some(item => item.includes('missingEvidenceMeansZero')));

    const role = execute('role', { ...source, humanRoles: { ...source.humanRoles, financeOwner: { status: 'assigned', personOrRoleRef: 'PERSON-001', acceptanceRecorded: true } } });
    assert.strictEqual(role.status, 1);
    assert(role.output.failures.some(item => item.includes('financeOwner')));

    const connectedSource = execute('connected-source', { ...source, restrictedSourceClasses: source.restrictedSourceClasses.map(item => item.id === 'FS-001' ? { ...item, connected: true } : item) });
    assert.strictEqual(connectedSource.status, 1);
    assert(connectedSource.output.failures.some(item => item.includes('FS-001.connected')));

    const reconciled = execute('reconciled', { ...source, baselineEvidenceClasses: source.baselineEvidenceClasses.map(item => item.id === 'FB-001' ? { ...item, status: 'verified', reconciled: true } : item) });
    assert.strictEqual(reconciled.status, 1);
    assert(reconciled.output.failures.some(item => item.includes('FB-001')));

    const value = execute('value', { ...source, baselineEvidenceClasses: source.baselineEvidenceClasses.map(item => item.id === 'FB-003' ? { ...item, valueStoredHere: true } : item) });
    assert.strictEqual(value.status, 1);
    assert(value.output.failures.some(item => item.includes('FB-003')));

    const calendar = execute('calendar', { ...source, closeCalendar: { ...source.closeCalendar, periodCadence: 'monthly' } });
    assert.strictEqual(calendar.status, 1);
    assert(calendar.output.failures.some(item => item.includes('periodCadence')));

    const threshold = execute('threshold', { ...source, reconciliationControls: { ...source.reconciliationControls, unreconciledDifferenceThresholdMinorUnits: 1 } });
    assert.strictEqual(threshold.status, 1);
    assert(threshold.output.failures.some(item => item.includes('unreconciledDifferenceThresholdMinorUnits')));

    const model = execute('model', { ...source, currentModelEvidence: { ...source.currentModelEvidence, financialBaselineComplete: true } });
    assert.strictEqual(model.status, 1);
    assert(model.output.failures.some(item => item.includes('financialBaselineComplete')));

    const exercise = execute('exercise', { ...source, requiredExercises: source.requiredExercises.map(item => item.id === 'FGX-001' ? { ...item, status: 'passed', passed: true } : item) });
    assert.strictEqual(exercise.status, 1);
    assert(exercise.output.failures.some(item => item.includes('FGX-001')));

    const gate = execute('gate', { ...source, activationGates: source.activationGates.map(item => item.id === 'FG-G01' ? { ...item, satisfied: true } : item) });
    assert.strictEqual(gate.status, 1);
    assert(gate.output.failures.some(item => item.includes('FG-G01')));

    const cycle = execute('cycle', { ...source, reviewedCloseCycles: [{ id: 'CLOSE-001' }] });
    assert.strictEqual(cycle.status, 1);
    assert(cycle.output.failures.some(item => item.includes('reviewedCloseCycles')));

    const input = execute('input', { ...source, kevinInputBrief: source.kevinInputBrief.map(item => item.id === 'FFI-001' ? { ...item, provided: true } : item) });
    assert.strictEqual(input.status, 1);
    assert(input.output.failures.some(item => item.includes('FFI-001')));

    const count = execute('count', { ...source, providedKevinInputCount: 1 });
    assert.strictEqual(count.status, 1);
    assert(count.output.failures.some(item => item.includes('providedKevinInputCount')));

    const baselineReady = execute('baseline-ready', { ...source, financialBaselineReady: true });
    assert.strictEqual(baselineReady.status, 1);
    assert(baselineReady.output.failures.some(item => item.includes('financialBaselineReady')));

    const runway = execute('runway', { ...source, runwayCalculationReady: true });
    assert.strictEqual(runway.status, 1);
    assert(runway.output.failures.some(item => item.includes('runwayCalculationReady')));

    const spend = execute('spend', { ...source, spendPolicyReady: true });
    assert.strictEqual(spend.status, 1);
    assert(spend.output.failures.some(item => item.includes('spendPolicyReady')));

    const external = execute('external', { ...source, externalActionAuthorized: true });
    assert.strictEqual(external.status, 1);
    assert(external.output.failures.some(item => item.includes('externalActionAuthorized')));

    const sensitive = execute('sensitive', { ...source, restrictedSourceClasses: source.restrictedSourceClasses.map(item => item.id === 'FS-001' ? { ...item, opaqueSourceRef: 'finance@example.com' } : item) });
    assert.strictEqual(sensitive.status, 1);
    assert(sensitive.output.failures.some(item => item.includes('must not contain')));

    console.log('A-040 financial truth close evaluations passed (21 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
