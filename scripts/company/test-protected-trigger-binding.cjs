#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-trigger-binding.cjs');
const sourcePath = path.join(repositoryRoot, 'docs/company/automation/protected-trigger-binding.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a044-eval-'));
let caseCount = 0;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024
    });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-044 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.bindingContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.bindingContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.consumerCount, 2);
    assert.strictEqual(baseline.output.syntheticPayloadCount, 2);
    assert.strictEqual(baseline.output.rehearsalCount, 2);
    assert.strictEqual(baseline.output.passedRehearsalCount, 2);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.consumerCommandFallbackCount, 0);
    assert.strictEqual(baseline.output.protectedBindingConfigured, false);
    assert.strictEqual(baseline.output.replayStoreConfigured, false);
    assert.strictEqual(baseline.output.protectedHistoryConfigured, false);
    assert.strictEqual(baseline.output.productionPayloadAccepted, false);
    assert.strictEqual(baseline.output.activationGateCount, 14);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.runtimeBindingReady, false);
    assert.strictEqual(baseline.output.packetExecutionReady, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);

    invalid('authority', value => { value.authority.protectedInputBindingAuthorized = true; }, 'protectedInputBindingAuthorized');
    invalid('source-workflow', value => { value.bindingDesign.sourceWorkflowId = 'A-014'; }, 'binding source identity');
    invalid('source-version', value => { value.bindingDesign.sourceWorkflowVersion = 2; }, 'binding source identity');
    invalid('payload-kind', value => { value.bindingDesign.acceptedPayloadKind = 'unvalidated_output'; }, 'payload kind');
    invalid('digest-algorithm', value => { value.bindingDesign.sourceDigestAlgorithm = 'md5'; }, 'sourceDigestAlgorithm');
    invalid('digest-required', value => { value.bindingDesign.sourceDigestRequired = false; }, 'sourceDigestRequired');
    invalid('parent-packet', value => { value.bindingDesign.parentPacketIdRequired = false; }, 'parentPacketIdRequired');
    invalid('replay-required', value => { value.bindingDesign.replayProtectionRequired = false; }, 'replayProtectionRequired');
    invalid('binding-configured', value => { value.bindingDesign.bindingConfigured = true; }, 'bindingConfigured');
    invalid('replay-store', value => { value.bindingDesign.replayStoreConfigured = true; }, 'replayStoreConfigured');
    invalid('history-store', value => { value.bindingDesign.historyStoreConfigured = true; }, 'historyStoreConfigured');
    invalid('production-payload', value => { value.bindingDesign.productionPayloadAccepted = true; }, 'productionPayloadAccepted');
    invalid('fallback-behavior', value => { value.bindingDesign.missingBindingBehavior = 'invoke_default'; }, 'missingBindingBehavior');
    invalid('missing-consumer', value => { value.consumers.pop(); value.consumerCount = 1; }, 'consumer IDs');
    invalid('default-command', value => { value.consumers[0].commandTemplate = ['scripts/company/build-company-run-record.cjs']; }, 'commandTemplate');
    invalid('write-command', value => { value.consumers[0].commandTemplate.push('--output-dir', '/tmp/output'); }, 'commandTemplate');
    invalid('wrong-target', value => { value.consumers[1].targetWorkflowId = 'A-016'; }, 'trigger, target, or implementation');
    invalid('network', value => { value.rehearsalAssertions.networkAccessPermitted = true; }, 'networkAccessPermitted');
    invalid('fixture-workflow', value => { value.syntheticScenarios[0].payload.workflow = 'A-014'; }, 'valid non-authorizing A-015');
    invalid('prohibited-payload', value => { value.syntheticScenarios[0].payload.rawMessage = 'synthetic prohibited value'; }, 'prohibited payload field');
    invalid('change-count', value => { value.syntheticScenarios[0].payload.changeCount = 3; }, 'changeCount must match');
    invalid('proposal-severity', value => {
        value.syntheticScenarios[1].payload.changes[0].severity = 'medium';
        value.syntheticScenarios[1].payload.severityCounts = { medium: 1 };
        value.syntheticScenarios[1].payload.humanReviewRecommended = true;
    }, 'informational changes only');
    invalid('repository-mutation', value => { value.rehearsalAssertions.repositoryMutationPermitted = true; }, 'repositoryMutationPermitted');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');

    assert.strictEqual(caseCount, 25);
    console.log('A-044 protected trigger binding evaluations passed (25 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
