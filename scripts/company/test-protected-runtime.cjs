#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-protected-runtime.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-runtime.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a031-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.runtimeArchitectureValid, true);
    assert.strictEqual(baseline.output.architecturePackageReady, true);
    assert.strictEqual(baseline.output.architectureOptionCount, 3);
    assert.strictEqual(baseline.output.recommendedArchitectureOptionId, 'PR-001');
    assert.strictEqual(baseline.output.selectedArchitectureOptionId, null);
    assert.strictEqual(baseline.output.missingProviderComponentCount, 6);
    assert.strictEqual(baseline.output.requiredReadinessGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedReadinessGateCount, 0);
    assert.strictEqual(baseline.output.credentialReferenceCount, 0);
    assert.strictEqual(baseline.output.failureTestPassedCount, 0);
    assert.strictEqual(baseline.output.deploymentReady, false);
    assert.strictEqual(baseline.output.runtimePromotionEligible, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    const externalAuthority = execute('external-authority', { ...source, authority: { ...source.authority, externalActionAuthorized: true } });
    assert.strictEqual(externalAuthority.status, 1);
    assert(externalAuthority.output.failures.some(failure => failure.includes('externalActionAuthorized')));

    const credential = execute('credential', { ...source, secrets: { ...source.secrets, credentialRefs: ['SECRET-001'] } });
    assert.strictEqual(credential.status, 1);
    assert(credential.output.failures.some(failure => failure.includes('credential references')));

    const sharedIdentity = execute('shared-identity', { ...source, identity: { ...source.identity, sharedIdentityPermitted: true } });
    assert.strictEqual(sharedIdentity.status, 1);
    assert(sharedIdentity.output.failures.some(failure => failure.includes('sharedIdentityPermitted')));

    const networkEgress = execute('network-egress', { ...source, execution: { ...source.execution, defaultNetworkEgress: 'allow', networkAllowlist: ['*'] } });
    assert.strictEqual(networkEgress.status, 1);
    assert(networkEgress.output.failures.some(failure => failure.includes('network egress')));

    const writeMount = execute('write-mount', { ...source, execution: { ...source.execution, repositoryMount: 'read_write' } });
    assert.strictEqual(writeMount.status, 1);
    assert(writeMount.output.failures.some(failure => failure.includes('read-only')));

    const scheduler = execute('scheduler', { ...source, execution: { ...source.execution, schedulerEnabled: true } });
    assert.strictEqual(scheduler.status, 1);
    assert(scheduler.output.failures.some(failure => failure.includes('schedulerEnabled')));

    const spend = execute('spend', { ...source, resources: { ...source.resources, spendMinorUnitsPerRun: 1 } });
    assert.strictEqual(spend.status, 1);
    assert(spend.output.failures.some(failure => failure.includes('spendMinorUnitsPerRun')));

    const unknownWorkflow = execute('unknown-workflow', { ...source, workflowRefs: [...source.workflowRefs.slice(0, -1), 'A-999'] });
    assert.strictEqual(unknownWorkflow.status, 1);
    assert(unknownWorkflow.output.failures.some(failure => failure.includes('workflowRefs')));

    const missingOption = execute('missing-option', { ...source, architectureOptions: source.architectureOptions.slice(0, 2) });
    assert.strictEqual(missingOption.status, 1);
    assert(missingOption.output.failures.some(failure => failure.includes('three architecture options')));

    const multipleRecommended = execute('multiple-recommended', { ...source, architectureOptions: source.architectureOptions.map(option => ({ ...option, recommended: true })) });
    assert.strictEqual(multipleRecommended.status, 1);
    assert(multipleRecommended.output.failures.some(failure => failure.includes('single recommended')));

    const prematureSelection = execute('premature-selection', { ...source, selectedArchitectureOptionId: 'PR-001' });
    assert.strictEqual(prematureSelection.status, 1);
    assert(prematureSelection.output.failures.some(failure => failure.includes('selectedArchitectureOptionId')));

    const fakeGate = execute('fake-gate', { ...source, readinessGates: { ...source.readinessGates, cellDecisionRecorded: true } });
    assert.strictEqual(fakeGate.status, 1);
    assert(fakeGate.output.failures.some(failure => failure.includes('eighteen readiness gates')));

    console.log('A-031 protected-runtime evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

