#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { classifyInboundContact } = require('./lib/inbound-contact-triage.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'validate-inbound-contact-triage.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/inbound-contact-triage.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a056-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(value) {
    const target = path.join(temporaryDirectory, `case-${caseCount}.json`);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    const result = spawnSync(process.execPath, [implementationPath, '--input', target], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024
    });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function invalid(mutate, expectedFailure) {
    caseCount += 1;
    const fixture = clone(source);
    mutate(fixture);
    const result = execute(fixture);
    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.output.inboundTriageContractValid, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `missing failure: ${expectedFailure}`);
}

try {
    caseCount += 1;
    const baseline = execute(source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.inboundTriageContractValid, true);
    assert.strictEqual(baseline.output.triageRehearsalPerformed, true);
    assert.strictEqual(baseline.output.syntheticCaseCount, 12);
    assert.strictEqual(baseline.output.passedSyntheticCaseCount, 12);
    assert.strictEqual(baseline.output.urgentCaseCount, 2);
    assert.strictEqual(baseline.output.restrictedCaseCount, 7);
    assert.strictEqual(baseline.output.personalDataDetectionCount, 1);
    assert.strictEqual(baseline.output.rawMessageRetentionCount, 0);
    assert.strictEqual(baseline.output.autonomousReplyCount, 0);
    assert.strictEqual(baseline.output.externalActionCount, 0);
    assert.strictEqual(baseline.output.categoryCount, 10);
    assert.strictEqual(baseline.output.humanReviewRequired, true);
    assert.strictEqual(baseline.output.inboundTriageReadyForReview, true);
    assert.strictEqual(baseline.output.liveInboxReady, false);
    assert.strictEqual(baseline.output.liveInboxConnected, false);
    assert.strictEqual(baseline.output.replySendAuthorized, false);
    assert.strictEqual(baseline.output.directMinorContactAuthorized, false);
    assert.strictEqual(baseline.output.marketingReuseAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert.strictEqual(baseline.output.activationGateCount, 14);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);

    for (const fixture of source.syntheticCases) {
        caseCount += 1;
        const result = classifyInboundContact({ message: fixture.message, senderRole: fixture.senderRole });
        assert.strictEqual(result.accepted, true);
        assert.strictEqual(result.category, fixture.expectedCategory);
        assert.strictEqual(result.route, fixture.expectedRoute);
        assert.strictEqual(result.priority, fixture.expectedPriority);
        assert.strictEqual(result.replyDraftPermitted, fixture.expectedReplyDraftPermitted);
        assert.strictEqual(result.personalDataDetected, fixture.expectedPersonalDataDetected);
        assert.strictEqual(result.humanReviewRequired, true);
        assert.strictEqual(result.rawMessageRetained, false);
        assert.strictEqual(result.autonomousReplyPermitted, false);
        assert.strictEqual(result.externalActionAuthorized, false);
        assert.strictEqual(Object.hasOwn(result, 'message'), false);
        assert.strictEqual(Object.hasOwn(result, 'rawMessage'), false);
        assert.strictEqual(JSON.stringify(result).includes(fixture.message), false);
    }

    invalid(value => { value.authority.replySendAuthorized = true; }, 'replySendAuthorized');
    invalid(value => { value.decisionRefs.pop(); }, 'decisionRefs');
    invalid(value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid(value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid(value => { value.status = 'active'; }, 'status is invalid');
    invalid(value => { value.purpose = 'Sort messages.'; }, 'purpose is incomplete');
    invalid(value => { value.inputBoundary.allowedSenderRoles.pop(); }, 'allowedSenderRoles');
    invalid(value => { value.inputBoundary.maximumMessageCharacters = 10000; }, 'maximumMessageCharacters');
    invalid(value => { value.inputBoundary.syntheticExamplesOnly = false; }, 'syntheticExamplesOnly');
    invalid(value => { value.inputBoundary.liveInboxConnected = true; }, 'liveInboxConnected');
    invalid(value => { value.operatingRules.safeSummaryMayCopyMessageText = true; }, 'safeSummaryMayCopyMessageText');
    invalid(value => { value.operatingRules.humanReviewRequiredForEveryAcceptedMessage = false; }, 'humanReviewRequiredForEveryAcceptedMessage');
    invalid(value => { value.categories.pop(); }, 'categories must contain');
    invalid(value => { value.categories[0].route = 'auto_reply'; }, 'category 1');
    invalid(value => { value.syntheticCases.pop(); }, 'syntheticCases must contain');
    invalid(value => { value.syntheticCases[0].expectedCategory = 'general'; }, 'expected 12 passing synthetic cases');
    invalid(value => { value.expectedResults.urgentCaseCount = 3; }, 'expectedResults.urgentCaseCount');
    invalid(value => { value.productionReadiness.namedSupportOwnerAssigned = true; }, 'namedSupportOwnerAssigned');
    invalid(value => { value.activationGates.pop(); }, 'activationGates must contain');
    invalid(value => { value.activationGates[0].satisfied = true; }, 'activation gate 1');
    invalid(value => { value.inboundTriageReadyForReview = false; }, 'inboundTriageReadyForReview');
    invalid(value => { value.liveInboxReady = true; }, 'liveInboxReady');
    invalid(value => { value.humanReviewRequired = false; }, 'humanReviewRequired');
    invalid(value => { value.externalActionAuthorized = true; }, 'externalActionAuthorized');
    invalid(value => { value.nextDecision = 'Connect the inbox.'; }, 'nextDecision is incomplete');

    assert.strictEqual(caseCount, 38);
    console.log('A-056 inbound contact triage evaluations passed (38 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
