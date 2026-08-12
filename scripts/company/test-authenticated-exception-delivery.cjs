#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-authenticated-exception-delivery.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/authenticated-exception-delivery.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a047-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-047 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.deliveryContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.deliveryContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.sourceEvidenceCurrent, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.eligibleChangeCount, 1);
    assert.strictEqual(baseline.output.alertCount, 2);
    assert.strictEqual(baseline.output.syntheticRouteCount, 2);
    assert.strictEqual(baseline.output.ephemeralIdentityCount, 3);
    assert.strictEqual(baseline.output.deliveryAttemptCount, 4);
    assert.strictEqual(baseline.output.successfulDeliveryCount, 2);
    assert.strictEqual(baseline.output.failedDeliveryCount, 2);
    assert.strictEqual(baseline.output.verifiedAcknowledgementCount, 2);
    assert.strictEqual(baseline.output.duplicateSuppressionCount, 1);
    assert.strictEqual(baseline.output.failoverCount, 1);
    assert.strictEqual(baseline.output.ledgerWriteCount, 6);
    assert.strictEqual(baseline.output.refusalScenarioCount, 16);
    assert.strictEqual(baseline.output.refusedScenarioCount, 16);
    assert.strictEqual(baseline.output.unrefusedScenarioCount, 0);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.rawPayloadDeliveredCount, 0);
    assert.strictEqual(baseline.output.contactDetailStoredCount, 0);
    assert.strictEqual(baseline.output.productionRouteConfiguredCount, 0);
    assert.strictEqual(baseline.output.productionIdentityConfiguredCount, 0);
    assert.strictEqual(baseline.output.recipientConfirmationRecorded, false);
    assert.strictEqual(baseline.output.durableDeliveryStoreConfigured, false);
    assert.strictEqual(baseline.output.authenticatedProductionRouteConfigured, false);
    assert.strictEqual(baseline.output.activationGateCount, 18);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.deliveryContractReadyForReview, true);
    assert.strictEqual(baseline.output.productionDeliveryReady, false);
    assert.strictEqual(baseline.output.eligibleCycleReady, false);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    invalid('authority', value => { value.authority.alertDeliveryAuthorized = true; }, 'alertDeliveryAuthorized');
    invalid('workflows', value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid('risks', value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid('integration', value => { value.integrationRef = 'IC-010'; }, 'integrationRef');
    invalid('source-workflow', value => { value.sourceEvidence.changeWorkflowId = 'A-012'; }, 'sourceEvidence workflow bindings');
    invalid('raw-source', value => { value.sourceEvidence.rawChangeOutputPermittedInAlert = true; }, 'rawChangeOutputPermittedInAlert');
    invalid('maximum-bytes', value => { value.alertPolicy.maximumAlertBytes = 8192; }, 'alertPolicy algorithms');
    invalid('signature-algorithm', value => { value.alertPolicy.signatureAlgorithm = 'rsa'; }, 'alertPolicy algorithms');
    invalid('alert-fields', value => { value.alertPolicy.alertFields.reverse(); }, 'alertPolicy algorithms');
    invalid('medium-alert', value => { value.alertPolicy.mediumOrInformationalAlertPermitted = true; }, 'mediumOrInformationalAlertPermitted');
    invalid('route-count', value => { value.syntheticRoutes.pop(); }, 'syntheticRoutes');
    invalid('production-route', value => { value.syntheticRoutes[0].productionRoute = true; }, 'synthetic route 1');
    invalid('route-attempts', value => { value.syntheticRoutes[0].maximumAttempts = 3; }, 'synthetic route 1');
    invalid('rehearsal-counts', value => { value.rehearsalPlan.deliveryAttemptCount = 5; }, 'rehearsalPlan counts');
    invalid('rehearsal-step', value => { value.rehearsalPlan.steps[0].expectedOutcome = 'failed'; }, 'rehearsalPlan step 1');
    invalid('refusal-count', value => { value.refusalPlan.scenarioCount = 15; }, 'refusalPlan counts');
    invalid('refusal-reason', value => { value.refusalPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'AR-001 mutation or reason');
    invalid('store-kind', value => { value.rehearsalStore.kind = 'repository_files'; }, 'rehearsalStore kind');
    invalid('exclusive-create', value => { value.rehearsalStore.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('production-store', value => { value.rehearsalStore.productionDeliveryStoreConfigured = true; }, 'productionDeliveryStoreConfigured');
    invalid('provider-selected', value => { value.productionDeliveryPolicy.providerSelected = true; }, 'providerSelected');
    invalid('route-ref', value => { value.productionDeliveryPolicy.primaryRouteRef = 'route://primary'; }, 'primaryRouteRef');
    invalid('sender-identity', value => { value.productionDeliveryPolicy.senderIdentityConfigured = true; }, 'senderIdentityConfigured');
    invalid('ack-window', value => { value.productionDeliveryPolicy.maximumAcknowledgementMinutes = 5; }, 'maximumAcknowledgementMinutes');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('top-count', value => { value.refusalScenarioCount = 15; }, 'top-level route or refusal counts');
    invalid('production-ready', value => { value.productionDeliveryReady = true; }, 'productionDeliveryReady');
    invalid('eligible-ready', value => { value.eligibleCycleReady = true; }, 'eligibleCycleReady');

    assert.strictEqual(caseCount, 29);
    console.log('A-047 authenticated exception-delivery evaluations passed (29 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
