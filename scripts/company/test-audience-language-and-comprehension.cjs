#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'validate-audience-language-and-comprehension.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/audience-language-and-comprehension.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a055-eval-'));
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
    assert.strictEqual(result.output.audienceLanguageContractValid, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `missing failure: ${expectedFailure}`);
}

try {
    caseCount += 1;
    const baseline = execute(source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.audienceLanguageContractValid, true);
    assert.strictEqual(baseline.output.sourceAuditPerformed, true);
    assert.strictEqual(baseline.output.sourceBindingCount, 7);
    assert.strictEqual(baseline.output.currentSourcePassCount, 7);
    assert.strictEqual(baseline.output.currentSourceFailureCount, 0);
    assert.strictEqual(baseline.output.audienceProfileCount, 5);
    assert.strictEqual(baseline.output.referenceExampleCount, 5);
    assert.strictEqual(baseline.output.referenceExamplePassCount, 5);
    assert.strictEqual(baseline.output.supportDirectAnswerPassCount, 3);
    assert.strictEqual(baseline.output.sensitiveExplanationPassCount, 3);
    assert.strictEqual(baseline.output.jargonHitCount, 0);
    assert.strictEqual(baseline.output.unexplainedAcronymCount, 0);
    assert.strictEqual(baseline.output.longSentenceCount, 0);
    assert.strictEqual(baseline.output.pressureLanguageCount, 0);
    assert.strictEqual(baseline.output.patronisingLanguageCount, 0);
    assert.strictEqual(baseline.output.blockedAbsoluteCount, 0);
    assert.strictEqual(baseline.output.adversarialScenarioCount, 12);
    assert.strictEqual(baseline.output.adversarialRefusalCount, 12);
    assert.strictEqual(baseline.output.currentSourceAuditReady, true);
    assert.strictEqual(baseline.output.readyForHumanReview, true);
    assert.strictEqual(baseline.output.humanReviewRequired, true);
    assert.strictEqual(baseline.output.automatedApprovalEnabled, false);
    assert.strictEqual(baseline.output.publicationReady, false);
    assert.strictEqual(baseline.output.publicationAuthorized, false);
    assert.strictEqual(baseline.output.supportSendAuthorized, false);
    assert.strictEqual(baseline.output.replyAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert.strictEqual(baseline.output.activationGateCount, 14);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);

    invalid(value => { value.authority.publicationAuthorized = true; }, 'publicationAuthorized');
    invalid(value => { value.decisionRefs.pop(); }, 'decisionRefs');
    invalid(value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid(value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid(value => { value.sourceBindings.pop(); }, 'sourceBindings must contain');
    invalid(value => { value.sourceBindings[0].selector = 'wrong'; }, 'sourceBindings source 1');
    invalid(value => { value.audienceProfiles.pop(); }, 'audienceProfiles must contain');
    invalid(value => { value.audienceProfiles[0].maximumWordsPerSentence = 40; }, 'audienceProfiles profile 1');
    invalid(value => { value.plainLanguagePolicy.plainMeaningBeforeTechnicalDetail = false; }, 'plainMeaningBeforeTechnicalDetail');
    invalid(value => { value.plainLanguagePolicy.readingScoreAloneMayApprove = true; }, 'readingScoreAloneMayApprove');
    invalid(value => { value.plainLanguagePolicy.jargonTerms.pop(); }, 'jargonTerms');
    invalid(value => { value.plainLanguagePolicy.pressurePatterns.pop(); }, 'pressurePatterns');
    invalid(value => { value.plainLanguagePolicy.patronisingPatterns.pop(); }, 'patronisingPatterns');
    invalid(value => { value.plainLanguagePolicy.blockedAbsolutePatterns.pop(); }, 'blockedAbsolutePatterns');
    invalid(value => { value.plainLanguagePolicy.sensitiveTopics.pop(); }, 'sensitiveTopics');
    invalid(value => { value.plainLanguagePolicy.supportAnswerStarters.pop(); }, 'supportAnswerStarters');
    invalid(value => { value.referenceExamples.pop(); }, 'referenceExamples must contain');
    invalid(value => { value.referenceExamples[0].audienceProfile = 'professional'; }, 'referenceExamples example 1');
    invalid(value => { value.adversarialPlan.scenarioCount = 11; }, 'adversarialPlan counts');
    invalid(value => { value.adversarialPlan.scenarios[0].expectedReasonCode = 'accepted'; }, 'AL-001 problem or reason');
    invalid(value => { value.auditExpectations.sourceCount = 6; }, 'auditExpectations.sourceCount');
    invalid(value => { value.productionReviewPolicy.namedLanguageOwnerAssigned = true; }, 'namedLanguageOwnerAssigned');
    invalid(value => { value.activationGates.pop(); }, 'activationGates must contain');
    invalid(value => { value.activationGates[0].satisfied = true; }, 'activation gate 1');
    invalid(value => { value.sourceCount = 6; }, 'sourceCount must be 7');
    invalid(value => { value.audienceLanguageContractReadyForReview = false; }, 'audienceLanguageContractReadyForReview');
    invalid(value => { value.publicationReady = true; }, 'publicationReady');
    invalid(value => { value.externalActionAuthorized = true; }, 'externalActionAuthorized');
    invalid(value => { value.nextDecision = 'Review later.'; }, 'nextDecision is incomplete');
    invalid(value => { value.status = 'active'; }, 'status is invalid');
    invalid(value => { value.asOf = 'today'; }, 'asOf must be an ISO date');
    invalid(value => { value.purpose = 'Plain language.'; }, 'purpose is incomplete');
    invalid(value => { value.authority.unexpectedAuthority = false; }, 'authority fields');
    invalid(value => { value.productionReviewPolicy.automatedApprovalEnabled = true; }, 'automatedApprovalEnabled');

    assert.strictEqual(caseCount, 35);
    console.log('A-055 audience language and comprehension evaluations passed (35 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
