#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createGroundedSupportDraft } = require('./lib/grounded-support-draft.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'validate-grounded-support-drafting.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/grounded-support-drafting.json'), 'utf8'));
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/support/knowledge-base.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a057-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(value) {
    const target = path.join(temporaryDirectory, `case-${caseCount}.json`);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    const result = spawnSync(process.execPath, [implementationPath, '--input', target], { cwd: repositoryRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function invalid(mutate, expectedFailure) {
    caseCount += 1;
    const fixture = clone(source);
    mutate(fixture);
    const result = execute(fixture);
    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.output.groundedDraftingContractValid, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `missing failure: ${expectedFailure}`);
}

try {
    caseCount += 1;
    const baseline = execute(source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.groundedDraftingContractValid, true);
    assert.strictEqual(baseline.output.draftingRehearsalPerformed, true);
    assert.strictEqual(baseline.output.articleCount, 8);
    assert.strictEqual(baseline.output.plainLanguagePassCount, 8);
    assert.strictEqual(baseline.output.syntheticCaseCount, 12);
    assert.strictEqual(baseline.output.acceptedDraftCount, 6);
    assert.strictEqual(baseline.output.refusedDraftCount, 6);
    assert.strictEqual(baseline.output.sourceBoundDraftCount, 6);
    assert.strictEqual(baseline.output.humanReviewRequiredCount, 12);
    assert.strictEqual(baseline.output.rawMessageRetentionCount, 0);
    assert.strictEqual(baseline.output.replySendCount, 0);
    assert.strictEqual(baseline.output.externalActionCount, 0);
    assert.strictEqual(baseline.output.knowledgeBaseApproved, false);
    assert.strictEqual(baseline.output.groundedDraftingReadyForReview, true);
    assert.strictEqual(baseline.output.liveSupportDraftingReady, false);
    assert.strictEqual(baseline.output.liveInboxConnected, false);
    assert.strictEqual(baseline.output.replySendAuthorized, false);
    assert.strictEqual(baseline.output.directMinorContactAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert.strictEqual(baseline.output.activationGateCount, 14);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);

    for (const fixture of source.syntheticCases) {
        caseCount += 1;
        const result = createGroundedSupportDraft(fixture.input, knowledgeBase);
        assert.strictEqual(result.accepted, fixture.expectedAccepted);
        assert.strictEqual(result.reasonCode, fixture.expectedReasonCode);
        assert.strictEqual(result.articleId || null, fixture.expectedArticleId);
        assert.strictEqual(result.humanReviewRequired, true);
        assert.strictEqual(result.replySendAuthorized, false);
        assert.strictEqual(result.autonomousReplyPermitted, false);
        assert.strictEqual(result.rawMessageRetained, false);
        assert.strictEqual(result.externalActionAuthorized, false);
        assert.strictEqual(Object.hasOwn(result, 'message'), false);
        assert.strictEqual(Object.hasOwn(result, 'rawMessage'), false);
        assert.strictEqual(JSON.stringify(result).includes(fixture.input.message), false);
    }

    invalid(value => { value.authority.replySendAuthorized = true; }, 'replySendAuthorized');
    invalid(value => { value.decisionRefs.pop(); }, 'decisionRefs');
    invalid(value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid(value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid(value => { value.status = 'active'; }, 'status is invalid');
    invalid(value => { value.purpose = 'Draft replies.'; }, 'purpose is incomplete');
    invalid(value => { value.knowledgeBoundary.requiredArticleCount = 7; }, 'requiredArticleCount');
    invalid(value => { value.knowledgeBoundary.unknownAnswerMustRefuse = false; }, 'unknownAnswerMustRefuse');
    invalid(value => { value.answerBindings.pop(); }, 'answerBindings must contain');
    invalid(value => { value.answerBindings[0].source = 'unknown'; }, 'answer binding 1');
    invalid(value => { value.operatingRules.assistantMayInventAnswer = true; }, 'assistantMayInventAnswer');
    invalid(value => { value.operatingRules.plainLanguageCheckRequired = false; }, 'plainLanguageCheckRequired');
    invalid(value => { value.syntheticCases.pop(); }, 'syntheticCases');
    invalid(value => { value.syntheticCases[0].expectedArticleId = 'KB-002'; }, 'one or more synthetic drafting cases failed');
    invalid(value => { value.expectedResults.acceptedDraftCount = 5; }, 'expectedResults.acceptedDraftCount');
    invalid(value => { value.productionReadiness.knowledgeBaseApproved = true; }, 'knowledgeBaseApproved');
    invalid(value => { value.activationGates.pop(); }, 'activationGates');
    invalid(value => { value.activationGates[0].satisfied = true; }, 'activation gate 1');
    invalid(value => { value.groundedDraftingReadyForReview = false; }, 'groundedDraftingReadyForReview');
    invalid(value => { value.liveSupportDraftingReady = true; }, 'liveSupportDraftingReady');
    invalid(value => { value.humanReviewRequired = false; }, 'humanReviewRequired');
    invalid(value => { value.externalActionAuthorized = true; }, 'externalActionAuthorized');
    invalid(value => { value.nextDecision = 'Connect it.'; }, 'nextDecision is incomplete');
    invalid(value => { value.knowledgeBoundary.path = 'inbox.json'; }, 'knowledgeBoundary.path');
    invalid(value => { value.knowledgeBoundary.liveDraftApprovalRequired = false; }, 'liveDraftApprovalRequired');

    assert.strictEqual(caseCount, 38);
    console.log('A-057 grounded support drafting evaluations passed (38 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
