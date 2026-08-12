#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-cryptographic-misuse-and-recovery-poisoning.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-cryptographic-misuse-and-recovery-poisoning.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a053-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-053 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.cryptographicMisuseContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.cryptographicMisuseContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.match(baseline.output.sourceEvidenceDigestSha256, /^[a-f0-9]{64}$/);
    assert.match(baseline.output.sourceContractDigestSha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(baseline.output.scenarioCount, 20);
    assert.strictEqual(baseline.output.passedScenarioCount, 20);
    assert.strictEqual(baseline.output.probeEncryptionCount, 32);
    assert.strictEqual(baseline.output.successfulProbeEncryptionCount, 32);
    assert.strictEqual(baseline.output.uniqueNonceCount, 32);
    assert.strictEqual(baseline.output.nonceReuseRefusalCount, 1);
    assert.strictEqual(baseline.output.algorithmDowngradeRefusalCount, 1);
    assert.strictEqual(baseline.output.aadSubstitutionRefusalCount, 3);
    assert.strictEqual(baseline.output.authenticatedDecryptionRefusalCount, 2);
    assert.strictEqual(baseline.output.keyVersionRefusalCount, 1);
    assert.strictEqual(baseline.output.rollbackRefusalCount, 1);
    assert.strictEqual(baseline.output.futurePointRefusalCount, 1);
    assert.strictEqual(baseline.output.approvalRefusalCount, 4);
    assert.strictEqual(baseline.output.objectiveGamingRefusalCount, 2);
    assert.strictEqual(baseline.output.oversizeRefusalCount, 1);
    assert.strictEqual(baseline.output.attemptBudgetRefusalCount, 1);
    assert.strictEqual(baseline.output.globalDisableEffectBlockCount, 1);
    assert.strictEqual(baseline.output.recoveryApproverCount, 3);
    assert.strictEqual(baseline.output.trustedRecoveryApproverCount, 2);
    assert.strictEqual(baseline.output.compromisedRecoveryApproverCount, 1);
    assert.strictEqual(baseline.output.validRecoveryApprovalCount, 2);
    assert.strictEqual(baseline.output.temporaryArtifactFileCount, 115);
    assert.strictEqual(baseline.output.keyMaterialRetainedAfterRun, false);
    assert.strictEqual(baseline.output.rawPayloadStoredCount, 0);
    assert.strictEqual(baseline.output.productionCredentialMaterialStoredCount, 0);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 25);
    assert.strictEqual(baseline.output.refusedScenarioCount, 25);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.deepStrictEqual(baseline.output.repositoryMutationPaths, []);
    assert.strictEqual(baseline.output.productionCryptographicControlsConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.cryptographicMisuseContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionCryptographicSafetyReady, false);
    assert.strictEqual(baseline.output.productionRecoveryPoisoningDefenseReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.productionCryptographicPolicyAuthorized = true; }, 'productionCryptographicPolicyAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.recoveryObjectiveWorkflowId = 'A-051'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-path', value => { value.sourceEvidence.recoveryObjectiveContractPath = 'wrong.json'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-exit', value => { value.sourceEvidence.recoveryObjectiveExitCode = 0; }, 'sourceEvidence workflow or contract binding');
    invalid('source-raw', value => { value.sourceEvidence.rawEvidencePayloadPermitted = true; }, 'rawEvidencePayloadPermitted');
    invalid('algorithm', value => { value.misusePolicy.encryptionAlgorithm = 'aes-128-cbc'; }, 'algorithms');
    invalid('key-length', value => { value.misusePolicy.keyByteLength = 16; }, 'algorithms');
    invalid('probe-count', value => { value.misusePolicy.probeEncryptionCount = 31; }, 'resource bounds');
    invalid('nonce-count', value => { value.misusePolicy.requiredUniqueNonceCount = 31; }, 'resource bounds');
    invalid('cipher-limit', value => { value.misusePolicy.maximumCiphertextBytes = 8192; }, 'resource bounds');
    invalid('attempt-limit', value => { value.misusePolicy.maximumAttemptCount = 64; }, 'resource bounds');
    invalid('generation', value => { value.misusePolicy.currentGeneration = 2; }, 'generation or key version');
    invalid('key-version', value => { value.misusePolicy.currentKeyVersion = 'KV-003'; }, 'generation or key version');
    invalid('approval-count', value => { value.misusePolicy.requiredRecoveryApprovalCount = 1; }, 'approval model');
    invalid('compromised-count', value => { value.misusePolicy.compromisedRecoveryApproverCount = 0; }, 'approval model');
    invalid('objective', value => { value.misusePolicy.maximumRecoveryPointLossSeconds = 600; }, 'objectives');
    invalid('fixed-time', value => { value.misusePolicy.independentIncidentAt = '2026-08-11T12:03:00.000Z'; }, 'fixed times');
    invalid('nonce-reuse', value => { value.misusePolicy.nonceReusePermitted = true; }, 'nonceReusePermitted');
    invalid('downgrade', value => { value.misusePolicy.algorithmDowngradePermitted = true; }, 'algorithmDowngradePermitted');
    invalid('aad-substitute', value => { value.misusePolicy.aadSubstitutionPermitted = true; }, 'aadSubstitutionPermitted');
    invalid('compromised-signer', value => { value.misusePolicy.compromisedSignerPermitted = true; }, 'compromisedSignerPermitted');
    invalid('objective-override', value => { value.misusePolicy.objectiveOriginOverridePermitted = true; }, 'objectiveOriginOverridePermitted');
    invalid('aad-fields', value => { value.misusePolicy.aadFields.reverse(); }, 'field allowlists');
    invalid('capsule-fields', value => { value.misusePolicy.capsuleFields.reverse(); }, 'field allowlists');
    invalid('envelope-fields', value => { value.misusePolicy.envelopeFields.reverse(); }, 'field allowlists');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 19; }, 'scenarioPlan counts');
    invalid('scenario-outcome', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'failed'; }, 'scenarioPlan scenario 1');
    invalid('expected-count', value => { value.scenarioPlan.expectedUniqueNonceCount = 31; }, 'expectedUniqueNonceCount');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 24; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'CP-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind or modes');
    invalid('ledgers', value => { value.rehearsalStore.nonceAndAttemptLedgersRequired = false; }, 'nonceAndAttemptLedgersRequired');
    invalid('provider', value => { value.productionSecurityPolicy.providerSelected = true; }, 'providerSelected');
    invalid('key-ref', value => { value.productionSecurityPolicy.productionKeyRef = 'kms://one'; }, 'productionKeyRef');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('production-crypto-ready', value => { value.productionCryptographicSafetyReady = true; }, 'productionCryptographicSafetyReady');
    invalid('production-poisoning-ready', value => { value.productionRecoveryPoisoningDefenseReady = true; }, 'productionRecoveryPoisoningDefenseReady');

    assert.strictEqual(caseCount, 39);
    console.log('A-053 cryptographic-misuse/recovery-poisoning evaluations passed (39 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
