#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-integration-activation.cjs');
const sourcePath = path.join(repositoryRoot, 'docs/company/automation/integration-activation.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a035-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceIntegration(id, changes) {
    return { ...source, integrations: source.integrations.map(item => item.id === id ? { ...item, ...changes } : item) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.integrationPlanValid, true);
    assert.strictEqual(baseline.output.inventoryComplete, true);
    assert.strictEqual(baseline.output.integrationCount, 18);
    assert.strictEqual(baseline.output.stageCount, 5);
    assert.strictEqual(baseline.output.anonymousPublicReadCount, 1);
    assert.strictEqual(baseline.output.observedHumanAccessContextCount, 2);
    assert.strictEqual(baseline.output.connectorConfiguredCount, 0);
    assert.strictEqual(baseline.output.credentialReferenceCount, 0);
    assert.strictEqual(baseline.output.activationReadyCount, 0);
    assert.strictEqual(baseline.output.firstAccessBriefItemCount, 5);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    const authority = execute('authority', { ...source, authority: { ...source.authority, credentialConnectionAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(failure => failure.includes('credentialConnectionAuthorized')));

    const secretField = execute('secret-field', { ...source, token: 'not-a-real-token' });
    assert.strictEqual(secretField.status, 1);
    assert(secretField.output.failures.some(failure => failure.includes('secret-like field')));

    const credentialRef = execute('credential-ref', replaceIntegration('IC-009', { credentialRefs: ['vault://runtime/key'] }));
    assert.strictEqual(credentialRef.status, 1);
    assert(credentialRef.output.failures.some(failure => failure.includes('credential reference')));

    const connector = execute('connector', replaceIntegration('IC-005', { connectorConfigured: true }));
    assert.strictEqual(connector.status, 1);
    assert(connector.output.failures.some(failure => failure.includes('prematurely advances')));

    const activation = execute('activation', replaceIntegration('IC-016', { activationReady: true }));
    assert.strictEqual(activation.status, 1);
    assert(activation.output.failures.some(failure => failure.includes('prematurely advances')));

    const broadRole = execute('broad-role', replaceIntegration('IC-006', { minimumRole: 'full administrator access' }));
    assert.strictEqual(broadRole.status, 1);
    assert(broadRole.output.failures.some(failure => failure.includes('broad minimumRole')));

    const unknownWorkflow = execute('unknown-workflow', replaceIntegration('IC-014', { workflowRefs: ['A-999'] }));
    assert.strictEqual(unknownWorkflow.status, 1);
    assert(unknownWorkflow.output.failures.some(failure => failure.includes('unknown workflow')));

    const badZone = execute('bad-zone', replaceIntegration('IC-012', { dataZones: ['Z1'] }));
    assert.strictEqual(badZone.status, 1);
    assert(badZone.output.failures.some(failure => failure.includes('personal-data possibility')));

    const noSafeguarding = execute('no-safeguarding', replaceIntegration('IC-007', { nextGate: 'Connect after the provider is known.' }));
    assert.strictEqual(noSafeguarding.status, 1);
    assert(noSafeguarding.output.failures.some(failure => failure.includes('safeguarding gate')));

    const duplicate = execute('duplicate', { ...source, integrations: source.integrations.map(item => item.id === 'IC-018' ? { ...item, id: 'IC-017' } : item) });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(failure => failure.includes('duplicate integration')));

    const sequence = execute('sequence', { ...source, sequence: source.sequence.map(stage => stage.id === 'S4' ? { ...stage, integrationIds: ['IC-016', 'IC-017'] } : stage) });
    assert.strictEqual(sequence.status, 1);
    assert(sequence.output.failures.some(failure => failure.includes('exactly once')));

    const responseAuthority = execute('response-authority', { ...source, firstKevinAccessBrief: { ...source.firstKevinAccessBrief, responseAuthorizesAccess: true } });
    assert.strictEqual(responseAuthority.status, 1);
    assert(responseAuthority.output.failures.some(failure => failure.includes('responseAuthorizesAccess')));

    console.log('A-035 integration-activation evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
