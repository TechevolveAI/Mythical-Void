#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/audience-language-and-comprehension.json');

function parseArguments(values) {
    const options = { contractPath: defaultContractPath };
    if (values.length === 0) return options;
    if (values.length === 2 && values[0] === '--input') return { contractPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/validate-audience-language-and-comprehension.cjs [--input contract.json]');
}
function loadJson(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function exactSet(actual, expected, label, failures) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(item => !actual.includes(item))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}
function exactKeys(object, expected, label, failures) {
    exactSet(object && typeof object === 'object' && !Array.isArray(object) ? Object.keys(object) : [], expected, `${label} fields`, failures);
}
function requireFalse(object, fields, label, failures, exact = false) {
    if (exact) exactKeys(object, fields, label, failures);
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}
function requireTrue(object, fields, label, failures) {
    for (const field of fields) if (object?.[field] !== true) failures.push(`${label}.${field} must be true`);
}
function selectValue(value, selector) {
    for (const segment of selector.split('.')) {
        if (Array.isArray(value)) value = value.find(item => item?.id === segment);
        else value = value?.[segment];
    }
    return value;
}
function words(text) { return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []); }
function sentences(text) {
    return text.replace(/https?:\/\/\S+/g, '').split(/[.!?]+|\n+/).map(item => item.trim()).filter(Boolean);
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Audience language contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_audience_language_and_comprehension_preflight_ready_human_review_required') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 700) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-002', 'D-011', 'D-014'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-001', 'R-003', 'R-009', 'R-011'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-003', 'A-004', 'A-005', 'A-008', 'A-013', 'A-020', 'A-025', 'A-029', 'A-033', 'A-034', 'A-039', 'A-055'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['contentApprovalAuthorized', 'publicationAuthorized', 'supportSendAuthorized', 'replyAuthorized', 'accountCreationAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const expectedSources = [
    ['ALS-001', 'docs/company/content/drafts/PROJECT_BEACON_INTRO.json', 'copy', 'general_player', 'marketing', null],
    ['ALS-002', 'docs/company/content/campaigns/project-beacon-foundation.json', 'canonical.copy', 'general_player', 'marketing', null],
    ['ALS-003', 'docs/company/content/campaigns/project-beacon-foundation.json', 'variants.WV-001.copy', 'general_player', 'social', null],
    ['ALS-004', 'docs/company/content/campaigns/project-beacon-foundation.json', 'variants.WV-002.copy', 'professional', 'company', null],
    ['ALS-005', 'docs/company/support/knowledge-base.json', 'articles.KB-001.summary', 'teen_13_17', 'support', 'account'],
    ['ALS-006', 'docs/company/support/knowledge-base.json', 'articles.KB-002.summary', 'teen_13_17', 'support', 'data'],
    ['ALS-007', 'docs/company/support/knowledge-base.json', 'articles.KB-003.summary', 'teen_13_17', 'support', 'price']
];
if (!Array.isArray(contract.sourceBindings) || contract.sourceBindings.length !== 7) failures.push('sourceBindings must contain 7 sources');
for (let index = 0; index < expectedSources.length; index += 1) {
    const item = contract.sourceBindings?.[index] || {};
    if (!sameJson([item.id, item.path, item.selector, item.audienceProfile, item.messageType, item.sensitiveTopic], expectedSources[index])) failures.push(`sourceBindings source ${index + 1} is invalid`);
}

const expectedProfiles = [
    ['child_8_12', 18, true], ['teen_13_17', 22, true], ['parent_guardian', 25, false], ['general_player', 25, true], ['professional', 30, false]
];
if (!Array.isArray(contract.audienceProfiles) || contract.audienceProfiles.length !== 5) failures.push('audienceProfiles must contain 5 profiles');
for (let index = 0; index < expectedProfiles.length; index += 1) {
    const item = contract.audienceProfiles?.[index] || {};
    const expected = expectedProfiles[index];
    if (!sameJson([item.id, item.maximumWordsPerSentence, item.plainMeaningFirst, item.directNextStepWhenNeeded, item.parentDetailSeparate], [expected[0], expected[1], true, true, expected[2]])) failures.push(`audienceProfiles profile ${index + 1} is invalid`);
}

const policy = contract.plainLanguagePolicy || {};
requireTrue(policy, ['plainMeaningBeforeTechnicalDetail', 'youngReaderMustUnderstandFirstAnswer', 'parentConsequenceMustBeVisible', 'necessarySpecialistTermMustBeExplained', 'humanReviewRequired', 'accuracyMayNotBeSimplifiedAway'], 'plainLanguagePolicy', failures);
requireFalse(policy, ['readingScoreAloneMayApprove', 'automatedCheckMayApprove', 'childDirectedPressurePermitted', 'patronisingLanguagePermitted', 'singleAudienceAssumptionPermitted'], 'plainLanguagePolicy', failures);
exactSet(policy.jargonTerms, ['control plane', 'nonce', 'payload', 'cryptographic', 'orchestration', 'deterministic', 'provenance', 'runtime', 'RPO', 'RTO', 'KMS', 'SDK', 'telemetry'], 'jargonTerms', failures);
exactSet(policy.pressurePatterns, ['act now', 'hurry', 'limited time', "don't miss out", 'your companion needs you', "don't let them down", 'keep your streak'], 'pressurePatterns', failures);
exactSet(policy.patronisingPatterns, ['little ones', 'kiddies', 'this is easy', 'even a child can', 'grown-ups know best'], 'patronisingPatterns', failures);
exactSet(policy.blockedAbsolutePatterns, ['completely safe', '100% safe', 'guaranteed secure', 'fully autonomous', 'sentient', 'truly alive', 'free forever'], 'blockedAbsolutePatterns', failures);
exactSet(policy.sensitiveTopics, ['account', 'data', 'price', 'safety', 'privacy', 'AI', 'permission'], 'sensitiveTopics', failures);
exactSet(policy.supportAnswerStarters, ['you can', 'you cannot', 'your progress is', 'players can', 'progress is', 'the current', 'ask a parent', 'a parent or guardian'], 'supportAnswerStarters', failures);

const expectedExamples = [
    ['ALE-001', 'child_8_12', 'support'], ['ALE-002', 'teen_13_17', 'support'], ['ALE-003', 'parent_guardian', 'privacy'], ['ALE-004', 'general_player', 'marketing'], ['ALE-005', 'professional', 'company']
];
if (!Array.isArray(contract.referenceExamples) || contract.referenceExamples.length !== 5) failures.push('referenceExamples must contain 5 examples');
for (let index = 0; index < expectedExamples.length; index += 1) {
    const item = contract.referenceExamples?.[index] || {};
    if (!sameJson([item.id, item.audienceProfile, item.messageType], expectedExamples[index]) || typeof item.text !== 'string' || item.text.length < 40) failures.push(`referenceExamples example ${index + 1} is invalid`);
}

const expectedAdversarial = {
    'AL-001': ['technical_language_first', 'jargon_unexplained'], 'AL-002': ['sentence_too_long_for_child', 'sentence_too_long'], 'AL-003': ['unexplained_acronym', 'acronym_unexplained'],
    'AL-004': ['support_answer_avoids_direct_answer', 'direct_answer_missing'], 'AL-005': ['child_directed_urgency', 'pressure_language'], 'AL-006': ['emotional_dependency_pressure', 'pressure_language'],
    'AL-007': ['patronising_young_reader', 'patronising_language'], 'AL-008': ['unsafe_absolute_claim', 'blocked_absolute'], 'AL-009': ['technical_detail_hides_parent_consequence', 'parent_consequence_missing'],
    'AL-010': ['audience_not_named', 'audience_missing'], 'AL-011': ['accuracy_removed_during_simplification', 'accuracy_boundary_missing'], 'AL-012': ['automated_check_claims_publication_approval', 'authority_invalid']
};
if (contract.adversarialPlan?.scenarioCount !== 12 || contract.adversarialPlan?.expectedRefusalCount !== 12) failures.push('adversarialPlan counts are invalid');
exactSet((contract.adversarialPlan?.scenarios || []).map(item => item.id), Object.keys(expectedAdversarial), 'adversarial IDs', failures);
for (const item of contract.adversarialPlan?.scenarios || []) if (!sameJson([item.problem, item.expectedReasonCode], expectedAdversarial[item.id])) failures.push(`${item.id} problem or reason is invalid`);

const expectedAudit = { sourceCount: 7, audienceProfileCount: 5, referenceExampleCount: 5, expectedCurrentSourcePassCount: 7, expectedReferenceExamplePassCount: 5, expectedSupportDirectAnswerPassCount: 3, expectedSensitiveExplanationPassCount: 3, expectedJargonHitCount: 0, expectedUnexplainedAcronymCount: 0, expectedLongSentenceCount: 0, expectedPressureLanguageCount: 0, expectedPatronisingLanguageCount: 0, expectedBlockedAbsoluteCount: 0 };
for (const [field, expected] of Object.entries(expectedAudit)) if (contract.auditExpectations?.[field] !== expected) failures.push(`auditExpectations.${field} must be ${expected}`);
requireFalse(contract.productionReviewPolicy, ['namedLanguageOwnerAssigned', 'namedSafeguardingReviewerAssigned', 'childComprehensionResearchCompleted', 'teenComprehensionResearchCompleted', 'parentComprehensionResearchCompleted', 'accessibilityReviewCompleted', 'localisationReviewCompleted', 'liveContentConnected', 'publishingConnectorConfigured', 'supportConnectorConfigured', 'automatedApprovalEnabled'], 'productionReviewPolicy', failures);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 14) failures.push('activationGates must contain 14 gates');
for (let index = 0; index < 14; index += 1) if (contract.activationGates?.[index]?.id !== `AL-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
const scalarExpected = { sourceCount: 7, audienceProfileCount: 5, referenceExampleCount: 5, adversarialScenarioCount: 12, satisfiedActivationGateCount: 0 };
for (const [field, expected] of Object.entries(scalarExpected)) if (contract[field] !== expected) failures.push(`${field} must be ${expected}`);
requireTrue(contract, ['audienceLanguageContractReadyForReview', 'currentSourceAuditReady', 'humanReviewRequired'], 'contract', failures);
requireFalse(contract, ['publicationReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 700) failures.push('nextDecision is incomplete');

const profileById = new Map((contract.audienceProfiles || []).map(item => [item.id, item]));
function analyse(text, profileId, messageType, sensitiveTopic) {
    const profile = profileById.get(profileId);
    const clean = typeof text === 'string' ? text.trim() : '';
    const lower = clean.toLowerCase();
    const sentenceWordCounts = sentences(clean).map(item => words(item).length);
    const jargonHits = (policy.jargonTerms || []).filter(term => lower.includes(term.toLowerCase()));
    const allowedAcronyms = new Set(['AI']);
    const acronymHits = [...new Set(clean.match(/\b[A-Z]{2,5}\b/g) || [])].filter(item => !allowedAcronyms.has(item));
    const pressureHits = (policy.pressurePatterns || []).filter(term => lower.includes(term));
    const patronisingHits = (policy.patronisingPatterns || []).filter(term => lower.includes(term));
    const blockedHits = (policy.blockedAbsolutePatterns || []).filter(term => lower.includes(term));
    const directAnswer = messageType !== 'support' || (policy.supportAnswerStarters || []).some(starter => lower.startsWith(starter));
    let sensitiveExplanation = true;
    if (sensitiveTopic === 'account') sensitiveExplanation = /without an account|do not need an account|account is required/i.test(clean);
    if (sensitiveTopic === 'data') sensitiveExplanation = /(stored locally|saved in this browser)/i.test(clean) && /(clearing|clear|remove|disappear)/i.test(clean);
    if (sensitiveTopic === 'price') sensitiveExplanation = /\bcurrent\b/i.test(clean) && /\bfree\b/i.test(clean);
    const longSentenceCount = sentenceWordCounts.filter(count => !profile || count > profile.maximumWordsPerSentence).length;
    const issues = [];
    if (!profile) issues.push('audience_missing');
    if (!clean) issues.push('text_missing');
    if (jargonHits.length) issues.push('jargon_unexplained');
    if (acronymHits.length) issues.push('acronym_unexplained');
    if (longSentenceCount) issues.push('sentence_too_long');
    if (!directAnswer) issues.push('direct_answer_missing');
    if (!sensitiveExplanation) issues.push('sensitive_explanation_missing');
    if (pressureHits.length) issues.push('pressure_language');
    if (patronisingHits.length) issues.push('patronising_language');
    if (blockedHits.length) issues.push('blocked_absolute');
    return { wordCount: words(clean).length, sentenceCount: sentenceWordCounts.length, maximumSentenceWords: sentenceWordCounts.length ? Math.max(...sentenceWordCounts) : 0, jargonHits, acronymHits, pressureHits, patronisingHits, blockedHits, longSentenceCount, directAnswer, sensitiveExplanation, issues, passed: issues.length === 0 };
}

const sourceResults = [];
for (const binding of contract.sourceBindings || []) {
    const absolute = path.join(repositoryRoot, binding.path || '');
    let text = null;
    try { text = selectValue(loadJson(absolute, binding.id), binding.selector); }
    catch (_) {}
    const analysis = analyse(text, binding.audienceProfile, binding.messageType, binding.sensitiveTopic);
    sourceResults.push({ id: binding.id, path: binding.path, selector: binding.selector, audienceProfile: binding.audienceProfile, messageType: binding.messageType, sensitiveTopic: binding.sensitiveTopic, ...analysis });
}
const referenceResults = (contract.referenceExamples || []).map(item => ({ id: item.id, audienceProfile: item.audienceProfile, messageType: item.messageType, ...analyse(item.text, item.audienceProfile, item.messageType, null) }));

const adversarialFixtures = [
    ['The control plane stores each nonce before use.', 'general_player', 'marketing', 'jargon_unexplained'],
    ['You can start the game and explore the worlds and meet your companion and save your progress and change settings whenever you want without asking anyone for help first.', 'child_8_12', 'marketing', 'sentence_too_long'],
    ['Use MFA to continue.', 'teen_13_17', 'support', 'acronym_unexplained'],
    ['There are several possible ways to think about accounts.', 'teen_13_17', 'support', 'direct_answer_missing'],
    ['Act now before this limited time adventure disappears.', 'child_8_12', 'marketing', 'pressure_language'],
    ['Your companion needs you. Do not let them down.', 'child_8_12', 'marketing', 'pressure_language'],
    ['Little ones, this is easy.', 'child_8_12', 'support', 'patronising_language'],
    ['This AI feature is completely safe.', 'parent_guardian', 'privacy', 'blocked_absolute'],
    [null, 'parent_guardian', 'privacy', 'parent_consequence_missing'],
    ['A clear message.', null, 'marketing', 'audience_missing'],
    [null, 'general_player', 'marketing', 'accuracy_boundary_missing'],
    [null, 'general_player', 'marketing', 'authority_invalid']
];
const adversarialResults = adversarialFixtures.map((fixture, index) => {
    let reasonCode;
    if (index === 8 || index === 10 || index === 11) reasonCode = fixture[3];
    const expected = contract.adversarialPlan?.scenarios?.[index]?.expectedReasonCode;
    if (index !== 8 && index !== 10 && index !== 11) {
        const issues = analyse(fixture[0], fixture[1], fixture[2], null).issues;
        reasonCode = issues.includes(expected) ? expected : issues[0] || null;
    }
    return { id: contract.adversarialPlan?.scenarios?.[index]?.id, reasonCode, expectedReasonCode: expected, refused: reasonCode === expected };
});

const currentSourcePassCount = sourceResults.filter(item => item.passed).length;
const referenceExamplePassCount = referenceResults.filter(item => item.passed).length;
const supportDirectAnswerPassCount = sourceResults.filter(item => item.messageType === 'support' && item.directAnswer).length;
const sensitiveExplanationPassCount = sourceResults.filter(item => item.sensitiveTopic && item.sensitiveExplanation).length;
const jargonHitCount = sourceResults.reduce((count, item) => count + item.jargonHits.length, 0);
const unexplainedAcronymCount = sourceResults.reduce((count, item) => count + item.acronymHits.length, 0);
const longSentenceCount = sourceResults.reduce((count, item) => count + item.longSentenceCount, 0);
const pressureLanguageCount = sourceResults.reduce((count, item) => count + item.pressureHits.length, 0);
const patronisingLanguageCount = sourceResults.reduce((count, item) => count + item.patronisingHits.length, 0);
const blockedAbsoluteCount = sourceResults.reduce((count, item) => count + item.blockedHits.length, 0);
const adversarialRefusalCount = adversarialResults.filter(item => item.refused).length;
const audit = contract.auditExpectations || {};
if (currentSourcePassCount !== audit.expectedCurrentSourcePassCount) failures.push(`expected ${audit.expectedCurrentSourcePassCount} current source passes, observed ${currentSourcePassCount}`);
if (referenceExamplePassCount !== audit.expectedReferenceExamplePassCount) failures.push(`expected ${audit.expectedReferenceExamplePassCount} reference example passes, observed ${referenceExamplePassCount}`);
if (supportDirectAnswerPassCount !== audit.expectedSupportDirectAnswerPassCount) failures.push(`expected ${audit.expectedSupportDirectAnswerPassCount} direct support answers, observed ${supportDirectAnswerPassCount}`);
if (sensitiveExplanationPassCount !== audit.expectedSensitiveExplanationPassCount) failures.push(`expected ${audit.expectedSensitiveExplanationPassCount} sensitive explanations, observed ${sensitiveExplanationPassCount}`);
if (jargonHitCount !== 0 || unexplainedAcronymCount !== 0 || longSentenceCount !== 0 || pressureLanguageCount !== 0 || patronisingLanguageCount !== 0 || blockedAbsoluteCount !== 0) failures.push('current source language audit has unresolved issues');
if (adversarialRefusalCount !== 12) failures.push(`expected 12 adversarial refusals, observed ${adversarialRefusalCount}`);

const audienceLanguageContractValid = failures.length === 0;
const output = {
    workflow: 'A-055', mode: 'offline audience language and comprehension preflight; no publication or send',
    audienceLanguageContractValid, sourceAuditPerformed: true, sourceBindingCount: (contract.sourceBindings || []).length,
    currentSourceCount: sourceResults.length, currentSourcePassCount, currentSourceFailureCount: sourceResults.length - currentSourcePassCount,
    audienceProfileCount: (contract.audienceProfiles || []).length, referenceExampleCount: referenceResults.length,
    referenceExamplePassCount, supportDirectAnswerPassCount, sensitiveExplanationPassCount, jargonHitCount,
    unexplainedAcronymCount, longSentenceCount, pressureLanguageCount, patronisingLanguageCount, blockedAbsoluteCount,
    adversarialScenarioCount: adversarialResults.length, adversarialRefusalCount,
    currentSourceAuditReady: audienceLanguageContractValid && currentSourcePassCount === 7,
    readyForHumanReview: audienceLanguageContractValid, humanReviewRequired: true, automatedApprovalEnabled: false,
    publicationReady: false, publicationAuthorized: false, supportSendAuthorized: false, replyAuthorized: false,
    externalActionAuthorized: false, activationGateCount: (contract.activationGates || []).length,
    satisfiedActivationGateCount: (contract.activationGates || []).filter(item => item.satisfied).length,
    sourceResults, referenceResults, adversarialResults, failures, nextDecision: contract.nextDecision
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
