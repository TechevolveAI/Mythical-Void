#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-nonce-concurrency-and-failover.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-nonce-concurrency-and-failover.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a054-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-054 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.nonceConcurrencyContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.nonceConcurrencyContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.match(baseline.output.sourceEvidenceDigestSha256, /^[a-f0-9]{64}$/);
    assert.match(baseline.output.sourceContractDigestSha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(baseline.output.scenarioCount, 12);
    assert.strictEqual(baseline.output.passedScenarioCount, 12);
    assert.strictEqual(baseline.output.concurrentAllocatorProcessCount, 16);
    assert.strictEqual(baseline.output.concurrentUniqueAllocationCount, 16);
    assert.strictEqual(baseline.output.retryClaimantProcessCount, 8);
    assert.strictEqual(baseline.output.retryWinnerCount, 1);
    assert.strictEqual(baseline.output.retryLoserCount, 7);
    assert.strictEqual(baseline.output.successfulEncryptionCount, 18);
    assert.strictEqual(baseline.output.authenticatedRoundTripCount, 18);
    assert.strictEqual(baseline.output.burnedNonceCount, 3);
    assert.strictEqual(baseline.output.crashReservedNonceBurnCount, 1);
    assert.strictEqual(baseline.output.failoverCounterAdvanceCount, 1);
    assert.strictEqual(baseline.output.rollbackRefusalCount, 1);
    assert.strictEqual(baseline.output.corruptLedgerQuarantineCount, 1);
    assert.strictEqual(baseline.output.keyVersionNamespaceCount, 2);
    assert.strictEqual(baseline.output.crossRegionDuplicateRefusalCount, 1);
    assert.strictEqual(baseline.output.counterExhaustionRefusalCount, 1);
    assert.strictEqual(baseline.output.staleFenceRefusalCount, 1);
    assert.strictEqual(baseline.output.cancelledNonceBurnCount, 1);
    assert.strictEqual(baseline.output.globalDisabledNonceBurnCount, 1);
    assert.strictEqual(baseline.output.globalDisableEffectBlockCount, 1);
    assert.strictEqual(baseline.output.reusedNonceEncryptionCount, 0);
    assert(baseline.output.temporaryArtifactFileCount >= 100);
    assert.strictEqual(baseline.output.keyMaterialRetainedAfterRun, false);
    assert.strictEqual(baseline.output.rawPayloadStoredCount, 0);
    assert.strictEqual(baseline.output.productionCredentialMaterialStoredCount, 0);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 22);
    assert.strictEqual(baseline.output.refusedScenarioCount, 22);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.deepStrictEqual(baseline.output.repositoryMutationPaths, []);
    assert.strictEqual(baseline.output.productionNonceControlsConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.nonceConcurrencyContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionNonceSafetyReady, false);
    assert.strictEqual(baseline.output.productionFailoverNonceSafetyReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.productionNonceAllocationAuthorized = true; }, 'productionNonceAllocationAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.cryptographicMisuseWorkflowId = 'A-052'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-path', value => { value.sourceEvidence.cryptographicMisuseContractPath = 'wrong.json'; }, 'sourceEvidence workflow or contract binding');
    invalid('source-exit', value => { value.sourceEvidence.cryptographicMisuseExitCode = 0; }, 'sourceEvidence workflow or contract binding');
    invalid('source-raw', value => { value.sourceEvidence.rawEvidencePayloadPermitted = true; }, 'rawEvidencePayloadPermitted');
    invalid('allocator-count', value => { value.noncePolicy.allocatorProcessCount = 15; }, 'concurrency, counter, fencing, or time bounds');
    invalid('retry-count', value => { value.noncePolicy.retryClaimantProcessCount = 7; }, 'concurrency, counter, fencing, or time bounds');
    invalid('counter-max', value => { value.noncePolicy.maximumCounter = 21; }, 'concurrency, counter, fencing, or time bounds');
    invalid('fence', value => { value.noncePolicy.currentFencingToken = 5; }, 'concurrency, counter, fencing, or time bounds');
    invalid('race-time', value => { value.noncePolicy.maximumRaceMilliseconds = 4000; }, 'concurrency, counter, fencing, or time bounds');
    invalid('algorithm', value => { value.noncePolicy.encryptionAlgorithm = 'aes-128-cbc'; }, 'algorithms, lengths, or key versions');
    invalid('key-length', value => { value.noncePolicy.keyByteLength = 16; }, 'algorithms, lengths, or key versions');
    invalid('current-key', value => { value.noncePolicy.currentKeyVersion = 'KV-001'; }, 'algorithms, lengths, or key versions');
    invalid('rotated-key', value => { value.noncePolicy.rotatedKeyVersion = 'KV-004'; }, 'algorithms, lengths, or key versions');
    invalid('allocation-order', value => { value.noncePolicy.allocationMustPrecedeEncryption = false; }, 'allocationMustPrecedeEncryption');
    invalid('crash-reuse', value => { value.noncePolicy.crashReservedNonceMayBeReused = true; }, 'crashReservedNonceMayBeReused');
    invalid('rollback', value => { value.noncePolicy.rollbackSnapshotMayLowerHighWatermark = true; }, 'rollbackSnapshotMayLowerHighWatermark');
    invalid('corrupt-allocate', value => { value.noncePolicy.corruptLedgerMayAllocate = true; }, 'corruptLedgerMayAllocate');
    invalid('stale-fence', value => { value.noncePolicy.staleFenceMayAllocate = true; }, 'staleFenceMayAllocate');
    invalid('regional', value => { value.noncePolicy.uncoordinatedRegionalAllocationPermitted = true; }, 'uncoordinatedRegionalAllocationPermitted');
    invalid('counter-wrap', value => { value.noncePolicy.counterWrapPermitted = true; }, 'counterWrapPermitted');
    invalid('disable-check', value => { value.noncePolicy.globalDisableCheckedImmediatelyBeforeEncryption = false; }, 'globalDisableCheckedImmediatelyBeforeEncryption');
    invalid('allocation-fields', value => { value.noncePolicy.allocationFields.reverse(); }, 'allocationFields');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 11; }, 'scenarioPlan counts');
    invalid('scenario-outcome', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'failed'; }, 'scenarioPlan scenario 1');
    invalid('expected-encryptions', value => { value.scenarioPlan.expectedSuccessfulEncryptionCount = 17; }, 'expectedSuccessfulEncryptionCount');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 21; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'NF-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind or modes');
    invalid('anchor', value => { value.rehearsalStore.highWatermarkAnchorRequired = false; }, 'highWatermarkAnchorRequired');
    invalid('provider', value => { value.productionNoncePolicy.providerSelected = true; }, 'providerSelected');
    invalid('nonce-ref', value => { value.productionNoncePolicy.productionNonceServiceRef = 'nonce://one'; }, 'productionNonceServiceRef');
    invalid('atomic', value => { value.productionNoncePolicy.atomicAllocationVerified = true; }, 'atomicAllocationVerified');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('contract-ready', value => { value.nonceConcurrencyContractReadyForReview = false; }, 'nonceConcurrencyContractReadyForReview');
    invalid('production-nonce-ready', value => { value.productionNonceSafetyReady = true; }, 'productionNonceSafetyReady');
    invalid('production-failover-ready', value => { value.productionFailoverNonceSafetyReady = true; }, 'productionFailoverNonceSafetyReady');
    invalid('eligible', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 40);
    console.log('A-054 nonce concurrency/failover evaluations passed (40 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
