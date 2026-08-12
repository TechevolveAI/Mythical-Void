#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-failure-recovery.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-failure-recovery.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a049-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-049 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.failureRecoveryContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.failureRecoveryContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.packetCount, 2);
    assert.strictEqual(baseline.output.scenarioCount, 9);
    assert.strictEqual(baseline.output.passedScenarioCount, 9);
    assert.strictEqual(baseline.output.detectedFaultCount, 9);
    assert.strictEqual(baseline.output.failClosedCount, 9);
    assert.strictEqual(baseline.output.realCrashCount, 4);
    assert.deepStrictEqual(baseline.output.realCrashExitCodes, [41, 42, 43, 44]);
    assert.strictEqual(baseline.output.orphanDetectedCount, 2);
    assert.strictEqual(baseline.output.quarantineCount, 2);
    assert.strictEqual(baseline.output.boundedRecoveryCount, 1);
    assert.strictEqual(baseline.output.automaticRecoveryRefusalCount, 2);
    assert.strictEqual(baseline.output.completionPreservedCount, 1);
    assert.strictEqual(baseline.output.staleEffectRefusalCount, 1);
    assert.strictEqual(baseline.output.globalDisableRecoveryBlockCount, 1);
    assert.strictEqual(baseline.output.highestFencingToken, 4);
    assert.strictEqual(baseline.output.fencingTokenAdvanced, true);
    assert.strictEqual(baseline.output.killRehearsalPerformed, true);
    assert.strictEqual(baseline.output.parentProcessTerminated, true);
    assert.strictEqual(baseline.output.childProcessTerminated, true);
    assert.strictEqual(baseline.output.killedProcessCount, 2);
    assert.strictEqual(baseline.output.terminationPrecededRecovery, true);
    assert.strictEqual(baseline.output.temporaryRecordWriteCount, 31);
    assert.strictEqual(baseline.output.scheduledCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 15);
    assert.strictEqual(baseline.output.refusedScenarioCount, 15);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.productionResilienceConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.trustedTimeConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.failureRecoveryContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionResilienceReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.packetExecutionAuthorized = true; }, 'packetExecutionAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.leaseWorkflowId = 'A-047'; }, 'sourceEvidence workflow or packet bindings');
    invalid('packet-ids', value => { value.sourceEvidence.packetSourceIds.reverse(); }, 'sourceEvidence workflow or packet bindings');
    invalid('payload', value => { value.sourceEvidence.packetPayloadPermitted = true; }, 'packetPayloadPermitted');
    invalid('grace', value => { value.recoveryPolicy.leaseGraceSeconds = 60; }, 'recoveryPolicy algorithms');
    invalid('attempts', value => { value.recoveryPolicy.maximumRecoveryAttempts = 2; }, 'recoveryPolicy algorithms');
    invalid('fields', value => { value.recoveryPolicy.recoveryRecordFields.reverse(); }, 'recoveryPolicy algorithms');
    invalid('ambiguous', value => { value.recoveryPolicy.ambiguousCompletionAutomaticRecoveryPermitted = true; }, 'ambiguousCompletionAutomaticRecoveryPermitted');
    invalid('scenario-count', value => { value.scenarioPlan.scenarioCount = 8; }, 'scenarioPlan counts');
    invalid('scenario', value => { value.scenarioPlan.scenarios[0].expectedOutcome = 'recovered'; }, 'scenarioPlan scenario 1');
    invalid('exit-codes', value => { value.scenarioPlan.expectedRealCrashExitCodes.reverse(); }, 'scenarioPlan counts');
    invalid('detached', value => { value.killRehearsal.detachedProcessGroupRequired = false; }, 'detachedProcessGroupRequired');
    invalid('signal', value => { value.killRehearsal.terminationSignal = 'SIGKILL'; }, 'killRehearsal process or timing bounds');
    invalid('termination-order', value => { value.killRehearsal.terminationMustPrecedeRecovery = false; }, 'terminationMustPrecedeRecovery');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 14; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'RR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store', value => { value.rehearsalStore.productionRecoveryStoreConfigured = true; }, 'productionRecoveryStoreConfigured');
    invalid('provider', value => { value.productionResiliencePolicy.providerSelected = true; }, 'providerSelected');
    invalid('runtime-ref', value => { value.productionResiliencePolicy.runtimeRef = 'runtime://one'; }, 'runtimeRef');
    invalid('trusted-time', value => { value.productionResiliencePolicy.trustedTimeConfigured = true; }, 'trustedTimeConfigured');
    invalid('crash-matrix', value => { value.productionResiliencePolicy.crashMatrixVerified = true; }, 'crashMatrixVerified');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('top-scenario-count', value => { value.scenarioCount = 8; }, 'top-level rehearsal counts');
    invalid('top-real-crash-count', value => { value.realCrashCount = 3; }, 'top-level rehearsal counts');
    invalid('production-ready', value => { value.productionResilienceReady = true; }, 'productionResilienceReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 30);
    console.log('A-049 protected failure-recovery evaluations passed (30 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
