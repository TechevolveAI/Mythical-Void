#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-run-history.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-run-history-reconciliation.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a046-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-046 output was not JSON; stderr=${result.stderr}`); }
    return { status: result.status, output };
}
function invalid(name, mutate, expectedFailure) {
    caseCount += 1;
    const fixture = clone(source);
    mutate(fixture);
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`);
    const result = execute(['--input', target, '--validate-only']);
    assert.strictEqual(result.status, 1, `${name} should fail closed`);
    assert.strictEqual(result.output.historyContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.historyContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.historyChainValid, true);
    assert.strictEqual(baseline.output.reconciliationValid, true);
    assert.strictEqual(baseline.output.recordCount, 8);
    assert.strictEqual(baseline.output.storedRecordCount, 8);
    assert.strictEqual(baseline.output.readBackRecordCount, 8);
    assert.strictEqual(baseline.output.branchCount, 2);
    assert.strictEqual(baseline.output.tamperScenarioCount, 12);
    assert.strictEqual(baseline.output.detectedTamperCount, 12);
    assert.strictEqual(baseline.output.undetectedTamperCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.rawPayloadStoredCount, 0);
    assert.strictEqual(baseline.output.sensitiveMaterialStoredCount, 0);
    assert.strictEqual(baseline.output.productionHistoryStoreConfigured, false);
    assert.strictEqual(baseline.output.productionHistoryIdentityCount, 0);
    assert.strictEqual(baseline.output.retentionPolicyApproved, false);
    assert.strictEqual(baseline.output.backupAndRestoreReady, false);
    assert.strictEqual(baseline.output.authenticatedAlertRouteConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.productionHistoryReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.productionHistoryWriteAuthorized = true; }, 'productionHistoryWriteAuthorized');
    invalid('source-workflow', value => { value.sourceEvidence.packetWorkflowId = 'A-041'; }, 'sourceEvidence workflow bindings');
    invalid('raw-source', value => { value.sourceEvidence.rawSourceOutputPermittedInHistory = true; }, 'rawSourceOutputPermittedInHistory');
    invalid('record-count-policy', value => { value.recordPolicy.recordCount = 7; }, 'recordPolicy schema');
    invalid('record-fields', value => { value.recordPolicy.recordFields.reverse(); }, 'recordPolicy schema');
    invalid('payload-fields', value => { value.recordPolicy.payloadFieldsPermitted = true; }, 'payloadFieldsPermitted');
    invalid('record-authority', value => { value.recordPolicy.externalActionAuthorized = true; }, 'recordPolicy.externalActionAuthorized');
    invalid('event-count', value => { value.eventPlan.pop(); }, 'eventPlan must contain exactly 8');
    invalid('event-plan', value => { value.eventPlan[1].parentSequence = null; }, 'eventPlan sequence 2');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind or modes');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store-rehearsal', value => { value.rehearsalStore.productionStoreConfigured = true; }, 'productionStoreConfigured');
    invalid('previous-link', value => { value.reconciliationPolicy.previousDigestLinkRequired = false; }, 'previousDigestLinkRequired');
    invalid('unexpected-fields', value => { value.reconciliationPolicy.unexpectedFieldsPermitted = true; }, 'unexpectedFieldsPermitted');
    invalid('tamper-count', value => { value.tamperPlan.scenarioCount = 11; }, 'tamperPlan counts');
    invalid('tamper-reason', value => { value.tamperPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'HT-001 mutation or reason');
    invalid('store-selected', value => { value.productionHistoryPolicy.storeClassSelected = true; }, 'storeClassSelected');
    invalid('writer-identity', value => { value.productionHistoryPolicy.writerIdentityConfigured = true; }, 'writerIdentityConfigured');
    invalid('retention', value => { value.productionHistoryPolicy.retentionDays = 30; }, 'retentionDays');
    invalid('backup', value => { value.productionHistoryPolicy.backupConfigured = true; }, 'backupConfigured');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('top-count', value => { value.recordCount = 7; }, 'top-level history counts');
    invalid('production-ready', value => { value.productionHistoryReady = true; }, 'productionHistoryReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 25);
    console.log('A-046 protected run-history evaluations passed (25 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
