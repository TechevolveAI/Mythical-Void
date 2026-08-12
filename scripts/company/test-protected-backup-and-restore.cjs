#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-backup-and-restore.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-backup-and-restore.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a051-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-051 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.backupRestoreContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.backupRestoreContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.packetCount, 2);
    assert.strictEqual(baseline.output.evidenceRecordCount, 6);
    assert.strictEqual(baseline.output.scenarioCount, 10);
    assert.strictEqual(baseline.output.passedScenarioCount, 10);
    assert.strictEqual(baseline.output.backupWriteCount, 1);
    assert.strictEqual(baseline.output.exactRestoreCount, 1);
    assert.strictEqual(baseline.output.corruptionDetectionCount, 1);
    assert.strictEqual(baseline.output.truncationDetectionCount, 1);
    assert.strictEqual(baseline.output.deletionDetectionCount, 1);
    assert.strictEqual(baseline.output.reorderDetectionCount, 1);
    assert.strictEqual(baseline.output.staleGenerationRefusalCount, 1);
    assert.strictEqual(baseline.output.failureDomainRefusalCount, 1);
    assert.strictEqual(baseline.output.restoreContenderProcessCount, 4);
    assert.strictEqual(baseline.output.restoreWinnerCount, 1);
    assert.strictEqual(baseline.output.restoreLoserCount, 3);
    assert.strictEqual(baseline.output.globalDisableActivationBlockCount, 1);
    assert(Number.isInteger(baseline.output.localRestoreDurationMilliseconds));
    assert(baseline.output.localRestoreDurationMilliseconds <= 3000);
    assert.strictEqual(baseline.output.localRestoreWithinBound, true);
    assert.strictEqual(baseline.output.temporaryArtifactFileCount, 42);
    assert.strictEqual(baseline.output.rawPayloadStoredCount, 0);
    assert.strictEqual(baseline.output.credentialMaterialStoredCount, 0);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 17);
    assert.strictEqual(baseline.output.refusedScenarioCount, 17);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.productionDurabilityConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.encryptionKeyConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.backupRestoreContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionDurabilityReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.productionRestoreAuthorized = true; }, 'productionRestoreAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.consensusWorkflowId = 'A-049'; }, 'sourceEvidence workflow or packet bindings');
    invalid('packet-ids', value => { value.sourceEvidence.packetSourceIds.reverse(); }, 'sourceEvidence workflow or packet bindings');
    invalid('raw-source', value => { value.sourceEvidence.rawEvidencePayloadPermitted = true; }, 'rawEvidencePayloadPermitted');
    invalid('generation', value => { value.backupPolicy.currentGeneration = 1; }, 'backupPolicy algorithms');
    invalid('record-count', value => { value.backupPolicy.evidenceRecordCount = 5; }, 'backupPolicy algorithms');
    invalid('source-domain', value => { value.backupPolicy.sourceFailureDomain = 'same'; }, 'backupPolicy algorithms');
    invalid('target-domain', value => { value.backupPolicy.approvedRestoreFailureDomain = 'same'; }, 'backupPolicy algorithms');
    invalid('holder-count', value => { value.backupPolicy.maximumConcurrentRestoreHolderCount = 2; }, 'backupPolicy algorithms');
    invalid('contenders', value => { value.backupPolicy.restoreContenderCount = 3; }, 'backupPolicy algorithms');
    invalid('restore-time', value => { value.backupPolicy.maximumLocalRestoreMilliseconds = 5000; }, 'backupPolicy algorithms');
    invalid('manifest-fields', value => { value.backupPolicy.manifestFields.reverse(); }, 'backupPolicy algorithms');
    invalid('record-fields', value => { value.backupPolicy.recordFields.reverse(); }, 'backupPolicy algorithms');
    invalid('readback', value => { value.backupPolicy.fullReadBackRequired = false; }, 'fullReadBackRequired');
    invalid('stale-permitted', value => { value.backupPolicy.staleGenerationRestorePermitted = true; }, 'staleGenerationRestorePermitted');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 9; }, 'scenarioPlan counts');
    invalid('scenario', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'write_failed'; }, 'scenarioPlan scenario 1');
    invalid('winner-count', value => { value.scenarioPlan.expectedRestoreWinnerCount = 2; }, 'scenarioPlan counts');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 16; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'DR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind');
    invalid('separate-domains', value => { value.rehearsalStore.separateFailureDomainDirectoriesRequired = false; }, 'separateFailureDomainDirectoriesRequired');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store', value => { value.rehearsalStore.productionDurabilityConfigured = true; }, 'productionDurabilityConfigured');
    invalid('provider', value => { value.productionDurabilityPolicy.providerSelected = true; }, 'providerSelected');
    invalid('backup-ref', value => { value.productionDurabilityPolicy.backupStoreRef = 'backup://one'; }, 'backupStoreRef');
    invalid('region-ref', value => { value.productionDurabilityPolicy.recoveryRegionRef = 'region://one'; }, 'recoveryRegionRef');
    invalid('identity', value => { value.productionDurabilityPolicy.writerIdentityConfigured = true; }, 'writerIdentityConfigured');
    invalid('encryption', value => { value.productionDurabilityPolicy.encryptionKeyConfigured = true; }, 'encryptionKeyConfigured');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('production-ready', value => { value.productionDurabilityReady = true; }, 'productionDurabilityReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 34);
    console.log('A-051 protected backup/restore evaluations passed (34 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
