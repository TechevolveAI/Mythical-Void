#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-execution-lease.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-execution-lease.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a048-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-048 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.leaseContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.leaseContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.packetCount, 2);
    assert.strictEqual(baseline.output.operationCount, 11);
    assert.strictEqual(baseline.output.passedOperationCount, 11);
    assert.strictEqual(baseline.output.acquisitionCount, 3);
    assert.strictEqual(baseline.output.overlapBlockCount, 1);
    assert.strictEqual(baseline.output.renewalCount, 1);
    assert.strictEqual(baseline.output.releaseCount, 2);
    assert.strictEqual(baseline.output.replaySuppressionCount, 1);
    assert.strictEqual(baseline.output.expiredHolderRefusalCount, 1);
    assert.strictEqual(baseline.output.wrongHolderRefusalCount, 1);
    assert.strictEqual(baseline.output.staleFenceRefusalCount, 1);
    assert.strictEqual(baseline.output.recoveryCount, 1);
    assert.strictEqual(baseline.output.highestFencingToken, 3);
    assert.strictEqual(baseline.output.fencingTokensMonotonic, true);
    assert.strictEqual(baseline.output.temporaryRecordWriteCount, 15);
    assert.strictEqual(baseline.output.killRehearsalPerformed, true);
    assert.strictEqual(baseline.output.parentProcessTerminated, true);
    assert.strictEqual(baseline.output.childProcessTerminated, true);
    assert.strictEqual(baseline.output.killedProcessCount, 2);
    assert.strictEqual(baseline.output.globalDisableBlockedLeaseCount, 1);
    assert.strictEqual(baseline.output.underlyingCompanyWorkflowInvocationCount, 0);
    assert.strictEqual(baseline.output.refusalScenarioCount, 12);
    assert.strictEqual(baseline.output.refusedScenarioCount, 12);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.productionCoordinatorConfigured, false);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.trustedTimeConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.leaseContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionCoordinationReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.packetExecutionAuthorized = true; }, 'packetExecutionAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('source-workflow', value => { value.sourceEvidence.packetWorkflowId = 'A-041'; }, 'sourceEvidence workflow or packet bindings');
    invalid('packet-ids', value => { value.sourceEvidence.packetSourceIds.reverse(); }, 'sourceEvidence workflow or packet bindings');
    invalid('payload', value => { value.sourceEvidence.packetPayloadPermitted = true; }, 'packetPayloadPermitted');
    invalid('duration', value => { value.leasePolicy.leaseDurationSeconds = 60; }, 'leasePolicy algorithms');
    invalid('concurrency', value => { value.leasePolicy.maximumConcurrentHoldersPerPacket = 2; }, 'leasePolicy algorithms');
    invalid('fields', value => { value.leasePolicy.leaseFields.reverse(); }, 'leasePolicy algorithms');
    invalid('overlap', value => { value.leasePolicy.overlapPermitted = true; }, 'overlapPermitted');
    invalid('operation-count', value => { value.rehearsalPlan.operationCount = 10; }, 'rehearsalPlan counts');
    invalid('operation', value => { value.rehearsalPlan.operations[0].expectedOutcome = 'failed'; }, 'rehearsalPlan operation 1');
    invalid('detached', value => { value.killRehearsal.detachedProcessGroupRequired = false; }, 'detachedProcessGroupRequired');
    invalid('signal', value => { value.killRehearsal.terminationSignal = 'SIGKILL'; }, 'killRehearsal process or timing bounds');
    invalid('child-kill', value => { value.killRehearsal.childMustTerminate = false; }, 'childMustTerminate');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 11; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'LR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store', value => { value.rehearsalStore.productionCoordinatorConfigured = true; }, 'productionCoordinatorConfigured');
    invalid('provider', value => { value.productionCoordinatorPolicy.providerSelected = true; }, 'providerSelected');
    invalid('coordinator-ref', value => { value.productionCoordinatorPolicy.coordinatorRef = 'coordinator://one'; }, 'coordinatorRef');
    invalid('trusted-time', value => { value.productionCoordinatorPolicy.trustedTimeConfigured = true; }, 'trustedTimeConfigured');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('top-count', value => { value.operationCount = 10; }, 'top-level rehearsal counts');
    invalid('production-ready', value => { value.productionCoordinationReady = true; }, 'productionCoordinationReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 27);
    console.log('A-048 protected execution-lease evaluations passed (27 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
