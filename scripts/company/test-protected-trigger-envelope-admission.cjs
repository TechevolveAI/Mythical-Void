#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'rehearse-protected-trigger-envelope-admission.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-trigger-envelope-admission.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a045-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function execute(args) {
    const result = spawnSync(process.execPath, [implementationPath, ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 3 * 1024 * 1024 });
    let output;
    try { output = JSON.parse(result.stdout); }
    catch { throw new Error(`A-045 output was not JSON; stderr=${result.stderr}`); }
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
    assert.strictEqual(result.output.admissionContractValid, false);
    assert.strictEqual(result.output.rehearsalPerformed, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `${name} did not report ${expectedFailure}`);
}

try {
    const baseline = execute([]);
    caseCount += 1;
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.admissionContractValid, true);
    assert.strictEqual(baseline.output.rehearsalPerformed, true);
    assert.strictEqual(baseline.output.rehearsalValid, true);
    assert.strictEqual(baseline.output.livePacketSetCurrent, true);
    assert.strictEqual(baseline.output.consumerCount, 2);
    assert.strictEqual(baseline.output.admissionAttemptCount, 14);
    assert.strictEqual(baseline.output.acceptedAdmissionCount, 2);
    assert.strictEqual(baseline.output.rejectedAdmissionCount, 12);
    assert.strictEqual(baseline.output.replayRejectionCount, 2);
    assert.strictEqual(baseline.output.syntheticSignatureVerifiedCount, 13);
    assert.strictEqual(baseline.output.ephemeralLedgerWriteCount, 2);
    assert.strictEqual(baseline.output.repositoryMutationCount, 0);
    assert.strictEqual(baseline.output.productionIssuerIdentityConfigured, false);
    assert.strictEqual(baseline.output.productionVerifierIdentityConfigured, false);
    assert.strictEqual(baseline.output.productionTrustStoreConfigured, false);
    assert.strictEqual(baseline.output.trustedTimeConfigured, false);
    assert.strictEqual(baseline.output.durableReplayStoreConfigured, false);
    assert.strictEqual(baseline.output.protectedHistoryConfigured, false);
    assert.strictEqual(baseline.output.productionPayloadAccepted, false);
    assert.strictEqual(baseline.output.activationGateCount, 16);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);
    assert.strictEqual(baseline.output.productionAdmissionReady, false);
    assert.strictEqual(baseline.output.consumerInvocationReady, false);
    assert.strictEqual(baseline.output.consumerInvocationCount, 0);
    assert.strictEqual(baseline.output.eligibleCycleCreditGranted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert(baseline.output.results.every(result => Object.keys(result).join(',') === 'scenarioId,expectedDisposition,actualDisposition,reasonCode,signatureVerified,ledgerWriteCreated'));

    invalid('authority', value => { value.authority.productionEnvelopeAdmissionAuthorized = true; }, 'productionEnvelopeAdmissionAuthorized');
    invalid('parent', value => { value.packetBinding.parentSourceId = 'OC-002'; }, 'parent identity');
    invalid('hard-coded', value => { value.packetBinding.staleHardCodedPacketIdsPermitted = true; }, 'staleHardCodedPacketIdsPermitted');
    invalid('missing-consumer', value => { value.packetBinding.consumers.pop(); value.consumerCount = 1; }, 'consumer IDs');
    invalid('consumer-target', value => { value.packetBinding.consumers[0].targetWorkflowId = 'A-017'; }, 'packet binding is invalid');
    invalid('signature-algorithm', value => { value.cryptographicPolicy.signatureAlgorithm = 'HMAC-SHA256'; }, 'signatureAlgorithm');
    invalid('signature-required', value => { value.cryptographicPolicy.signatureVerificationRequired = false; }, 'signatureVerificationRequired');
    invalid('issuer-configured', value => { value.cryptographicPolicy.productionIssuerIdentityConfigured = true; }, 'productionIssuerIdentityConfigured');
    invalid('trust-store', value => { value.cryptographicPolicy.productionTrustStoreConfigured = true; }, 'productionTrustStoreConfigured');
    invalid('unsigned', value => { value.cryptographicPolicy.unsignedEnvelopePermitted = true; }, 'unsignedEnvelopePermitted');
    invalid('signed-fields', value => { value.cryptographicPolicy.signedFields.reverse(); }, 'signedFields');
    invalid('clock', value => { value.timePolicy.rehearsalClock = '2026-08-11T10:07:00.000Z'; }, 'rehearsal clock or limits');
    invalid('maximum-age', value => { value.timePolicy.maximumAgeSeconds = 3600; }, 'rehearsal clock or limits');
    invalid('trusted-time', value => { value.timePolicy.trustedTimeConfigured = true; }, 'trustedTimeConfigured');
    invalid('production-age', value => { value.timePolicy.productionMaximumAgeApproved = true; }, 'productionMaximumAgeApproved');
    invalid('payload-source', value => { value.payloadPolicy.sourceWorkflowId = 'A-014'; }, 'payloadPolicy source');
    invalid('digest-required', value => { value.payloadPolicy.digestVerificationRequired = false; }, 'digestVerificationRequired');
    invalid('production-payload', value => { value.payloadPolicy.productionPayloadAccepted = true; }, 'productionPayloadAccepted');
    invalid('replay-fields', value => { value.replayPolicy.replayKeyFields.pop(); }, 'replayPolicy key fields');
    invalid('exclusive-create', value => { value.replayPolicy.exclusiveCreateRequired = false; }, 'exclusiveCreateRequired');
    invalid('ledger-kind', value => { value.replayPolicy.rehearsalLedgerKind = 'repository_json'; }, 'ledger kind');
    invalid('durable-replay', value => { value.replayPolicy.durableReplayStoreConfigured = true; }, 'durableReplayStoreConfigured');
    invalid('payload-log', value => { value.loggingPolicy.payloadContentPermitted = true; }, 'payloadContentPermitted');
    invalid('plan-count', value => { value.rehearsalPlan.admissionAttemptCount = 13; }, 'rehearsalPlan counts');
    invalid('attack-reason', value => { value.rehearsalPlan.attackScenarios[2].expectedReasonCode = 'accepted'; }, 'PEA-003 mutation or reason');
    invalid('premature-gate', value => { value.activationGates[0].satisfied = true; value.satisfiedActivationGateCount = 1; }, 'must remain unsatisfied');
    invalid('production-ready', value => { value.productionAdmissionReady = true; }, 'productionAdmissionReady');
    invalid('consumer-ready', value => { value.consumerInvocationReady = true; }, 'consumerInvocationReady');

    assert.strictEqual(caseCount, 29);
    console.log('A-045 protected trigger envelope-admission evaluations passed (29 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
