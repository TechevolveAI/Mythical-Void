#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-recovery-objectives-and-key-continuity.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-recovery-objectives-and-key-continuity.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a052-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-052 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.recoveryObjectiveContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.recoveryObjectiveContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.match(baseline.output.sourceEvidenceDigestSha256, /^[a-f0-9]{64}$/);
    assert.match(baseline.output.sourceContractDigestSha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(baseline.output.generationCount, 3);
    assert.strictEqual(baseline.output.scenarioCount, 15);
    assert.strictEqual(baseline.output.passedScenarioCount, 15);
    assert.strictEqual(baseline.output.encryptedCapsuleCount, 2);
    assert.strictEqual(baseline.output.authenticatedDecryptCount, 3);
    assert.strictEqual(baseline.output.predecessorGenerationDecryptCount, 1);
    assert.strictEqual(baseline.output.selectedGeneration, 3);
    assert.strictEqual(baseline.output.measuredRecoveryPointLossSeconds, 120);
    assert(Number.isInteger(baseline.output.localRecoveryDurationMilliseconds));
    assert(baseline.output.localRecoveryDurationMilliseconds <= 3000);
    assert.strictEqual(baseline.output.localRecoveryWithinBound, true);
    assert.strictEqual(baseline.output.missingKeyRefusalCount, 1);
    assert.strictEqual(baseline.output.recoveryApprovalSuccessCount, 1);
    assert.strictEqual(baseline.output.approvalRefusalCount, 3);
    assert.strictEqual(baseline.output.authenticatedDecryptionRefusalCount, 2);
    assert.strictEqual(baseline.output.rpoRefusalCount, 1);
    assert.strictEqual(baseline.output.futurePointRefusalCount, 1);
    assert.strictEqual(baseline.output.failureDomainRefusalCount, 1);
    assert.strictEqual(baseline.output.globalDisableActivationBlockCount, 1);
    assert.strictEqual(baseline.output.recoveryApproverCount, 3);
    assert.strictEqual(baseline.output.validRecoveryApprovalCount, 2);
    assert.strictEqual(baseline.output.ephemeralKeyFileCreateCount, 3);
    assert.strictEqual(baseline.output.keyMaterialRetainedAfterRun, false);
    assert.strictEqual(baseline.output.temporaryArtifactFileCount, 48);
    assert.strictEqual(baseline.output.rawPayloadStoredCount, 0);
    assert.strictEqual(baseline.output.productionCredentialMaterialStoredCount, 0);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 21);
    assert.strictEqual(baseline.output.refusedScenarioCount, 21);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.deepStrictEqual(baseline.output.repositoryMutationPaths, []);
    assert.strictEqual(baseline.output.productionKeyManagementConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.recoveryObjectiveContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionRecoveryObjectivesReady, false);
    assert.strictEqual(baseline.output.productionKeyContinuityReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.productionKeyManagementAuthorized = true; }, 'productionKeyManagementAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.backupRestoreWorkflowId = 'A-050'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-path', value => { value.sourceEvidence.backupRestoreContractPath = 'wrong.json'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-exit', value => { value.sourceEvidence.backupRestoreExitCode = 0; }, 'sourceEvidence workflow or contract binding');
    invalid('source-raw', value => { value.sourceEvidence.rawEvidencePayloadPermitted = true; }, 'rawEvidencePayloadPermitted');
    invalid('algorithm', value => { value.recoveryPolicy.encryptionAlgorithm = 'aes-128-cbc'; }, 'algorithms');
    invalid('key-length', value => { value.recoveryPolicy.keyByteLength = 16; }, 'algorithms');
    invalid('generation-count', value => { value.recoveryPolicy.generationCount = 2; }, 'generations or keys');
    invalid('current-key', value => { value.recoveryPolicy.currentKeyVersion = 'KV-003'; }, 'generations or keys');
    invalid('times', value => { value.recoveryPolicy.fixedIncidentAt = '2026-08-11T12:11:00.000Z'; }, 'fixed times');
    invalid('domains', value => { value.recoveryPolicy.recoveryKeyFailureDomain = 'fd-backup'; }, 'failure domains');
    invalid('approval-threshold', value => { value.recoveryPolicy.requiredRecoveryApprovalCount = 1; }, 'approval threshold');
    invalid('authenticated-required', value => { value.recoveryPolicy.fullAuthenticatedDecryptionRequired = false; }, 'fullAuthenticatedDecryptionRequired');
    invalid('rpo-permitted', value => { value.recoveryPolicy.rpoViolationPermitted = true; }, 'rpoViolationPermitted');
    invalid('capsule-fields', value => { value.recoveryPolicy.capsuleFields.reverse(); }, 'field allowlists');
    invalid('envelope-fields', value => { value.recoveryPolicy.encryptedEnvelopeFields.reverse(); }, 'field allowlists');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 13; }, 'scenarioPlan counts');
    invalid('scenario-outcome', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'failed'; }, 'scenarioPlan scenario 1');
    invalid('expected-decrypt', value => { value.scenarioPlan.expectedAuthenticatedDecryptCount = 1; }, 'expectedAuthenticatedDecryptCount');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 20; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'KR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind or modes');
    invalid('separate-directories', value => { value.rehearsalStore.separateStorageAndKeyDirectoriesRequired = false; }, 'separateStorageAndKeyDirectoriesRequired');
    invalid('ephemeral-material', value => { value.rehearsalStore.ephemeralCryptographicMaterialRequired = false; }, 'ephemeralCryptographicMaterialRequired');
    invalid('provider', value => { value.productionRecoveryPolicy.providerSelected = true; }, 'providerSelected');
    invalid('primary-key-ref', value => { value.productionRecoveryPolicy.primaryKeyRef = 'kms://one'; }, 'primaryKeyRef');
    invalid('approver-identity', value => { value.productionRecoveryPolicy.recoveryApproverIdentitiesConfigured = true; }, 'recoveryApproverIdentitiesConfigured');
    invalid('rotation-policy', value => { value.productionRecoveryPolicy.keyRotationPolicyApproved = true; }, 'keyRotationPolicyApproved');
    invalid('rpo-approved', value => { value.productionRecoveryPolicy.recoveryPointObjectiveApproved = true; }, 'recoveryPointObjectiveApproved');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('production-objectives', value => { value.productionRecoveryObjectivesReady = true; }, 'productionRecoveryObjectivesReady');
    invalid('key-continuity', value => { value.productionKeyContinuityReady = true; }, 'productionKeyContinuityReady');
    invalid('eligible', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');
    invalid('external', value => { value.externalActionAuthorized = true; }, 'externalActionAuthorized');

    assert.strictEqual(caseCount, 36);
    console.log('A-052 recovery-objective/key-continuity evaluations passed (36 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
