#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-time-and-split-brain.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-time-and-split-brain.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a050-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-050 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.timeAndSplitBrainContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.timeAndSplitBrainContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.packetCount, 2);
    assert.strictEqual(baseline.output.scenarioCount, 10);
    assert.strictEqual(baseline.output.passedScenarioCount, 10);
    assert.strictEqual(baseline.output.concurrentContenderProcessCount, 12);
    assert.strictEqual(baseline.output.acquisitionContenderCount, 8);
    assert.strictEqual(baseline.output.acquisitionWinnerCount, 1);
    assert.strictEqual(baseline.output.acquisitionLoserCount, 7);
    assert.strictEqual(baseline.output.recoveryContenderCount, 4);
    assert.strictEqual(baseline.output.recoveryWinnerCount, 1);
    assert.strictEqual(baseline.output.recoveryLoserCount, 3);
    assert.strictEqual(baseline.output.clockSkewCaseCount, 2);
    assert.strictEqual(baseline.output.workerClockOverrideIgnoredCount, 2);
    assert.strictEqual(baseline.output.delayedTriggerSuppressionCount, 1);
    assert.strictEqual(baseline.output.partitionedDuplicateRefusalCount, 1);
    assert.strictEqual(baseline.output.stalePartitionRefusalCount, 1);
    assert.strictEqual(baseline.output.completionPreservedCount, 1);
    assert.strictEqual(baseline.output.tokenExhaustionRefusalCount, 1);
    assert.strictEqual(baseline.output.globalDisableEffectBlockCount, 1);
    assert.strictEqual(baseline.output.highestFencingToken, 5);
    assert.strictEqual(baseline.output.fencingTokenAdvanced, true);
    assert.strictEqual(baseline.output.temporaryRecordFileCount, 41);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 16);
    assert.strictEqual(baseline.output.refusedScenarioCount, 16);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.productionConsensusConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.trustedTimeConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.timeAndSplitBrainContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionConsensusReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.packetExecutionAuthorized = true; }, 'packetExecutionAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.recoveryWorkflowId = 'A-048'; }, 'sourceEvidence workflow or packet bindings');
    invalid('packet-ids', value => { value.sourceEvidence.packetSourceIds.reverse(); }, 'sourceEvidence workflow or packet bindings');
    invalid('payload', value => { value.sourceEvidence.packetPayloadPermitted = true; }, 'packetPayloadPermitted');
    invalid('clock-source', value => { value.coordinationPolicy.trustedClockSource = 'worker_time'; }, 'coordinationPolicy algorithms');
    invalid('coordinator-time', value => { value.coordinationPolicy.coordinatorObservedAt = '2026-08-11T16:00:00.000Z'; }, 'coordinationPolicy algorithms');
    invalid('skew', value => { value.coordinationPolicy.maximumWorkerClockSkewSeconds = 60; }, 'coordinationPolicy algorithms');
    invalid('acquisition-contenders', value => { value.coordinationPolicy.acquisitionContenderCount = 7; }, 'coordinationPolicy algorithms');
    invalid('recovery-contenders', value => { value.coordinationPolicy.recoveryContenderCount = 3; }, 'coordinationPolicy algorithms');
    invalid('race-time', value => { value.coordinationPolicy.maximumRaceMilliseconds = 5000; }, 'coordinationPolicy algorithms');
    invalid('safe-integer', value => { value.coordinationPolicy.fencingTokenMaximumSafeInteger = 100; }, 'coordinationPolicy algorithms');
    invalid('worker-clock', value => { value.coordinationPolicy.workerClockMayDecideExpiry = true; }, 'workerClockMayDecideExpiry');
    invalid('partition-duplicate', value => { value.coordinationPolicy.partitionedDuplicateMayAcquire = true; }, 'partitionedDuplicateMayAcquire');
    invalid('fields', value => { value.coordinationPolicy.decisionFields.reverse(); }, 'coordinationPolicy algorithms');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 9; }, 'scenarioPlan counts');
    invalid('scenario', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'multiple_winners'; }, 'scenarioPlan scenario 1');
    invalid('winner-count', value => { value.scenarioPlan.expectedAcquisitionWinnerCount = 2; }, 'scenarioPlan counts');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 15; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'TR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store', value => { value.rehearsalStore.productionConsensusConfigured = true; }, 'productionConsensusConfigured');
    invalid('provider', value => { value.productionConsensusPolicy.providerSelected = true; }, 'providerSelected');
    invalid('consensus-ref', value => { value.productionConsensusPolicy.consensusRef = 'consensus://one'; }, 'refs must remain null');
    invalid('time-ref', value => { value.productionConsensusPolicy.trustedTimeRef = 'time://one'; }, 'refs must remain null');
    invalid('linearizability', value => { value.productionConsensusPolicy.linearizabilityVerified = true; }, 'linearizabilityVerified');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('top-contender-count', value => { value.concurrentContenderCount = 11; }, 'top-level rehearsal counts');
    invalid('production-ready', value => { value.productionConsensusReady = true; }, 'productionConsensusReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 32);
    console.log('A-050 protected time/split-brain evaluations passed (32 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
