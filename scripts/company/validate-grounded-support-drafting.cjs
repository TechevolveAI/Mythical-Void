#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createGroundedSupportDraft } = require('./lib/grounded-support-draft.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/grounded-support-drafting.json');

function parseArguments(values) {
    if (values.length === 0) return { contractPath: defaultContractPath };
    if (values.length === 2 && values[0] === '--input') return { contractPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/validate-grounded-support-drafting.cjs [--input contract.json]');
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
function words(text) { return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []); }
function sentenceLengths(text) { return text.split(/[.!?]+|\n+/).map(item => words(item).length).filter(Boolean); }
function plainLanguagePass(text) {
    const lower = text.toLowerCase();
    const banned = ['control plane', 'nonce', 'payload', 'cryptographic', 'orchestration', 'deterministic', 'provenance', 'runtime', 'rpo', 'rto', 'kms', 'sdk', 'telemetry', 'act now', 'hurry', 'limited time', "don't miss out", 'your companion needs you', "don't let them down", 'keep your streak', 'little ones', 'kiddies', 'this is easy', 'even a child can', 'grown-ups know best', 'completely safe', '100% safe', 'guaranteed secure', 'fully autonomous', 'sentient', 'truly alive', 'free forever'];
    return !banned.some(term => lower.includes(term)) && sentenceLengths(text).every(count => count <= 30);
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Grounded support drafting contract');
const knowledgeBase = loadJson(path.join(repositoryRoot, 'docs/company/support/knowledge-base.json'), 'Support knowledge base');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_grounded_support_drafting_ready_human_review_required') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 500) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-012', 'D-014'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-001', 'R-004', 'R-009', 'R-011'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-004', 'A-020', 'A-055', 'A-056', 'A-057'], 'workflowRefs', failures);

const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['liveMessageUseAuthorized', 'knowledgeBaseApprovalAuthorized', 'replyApprovalAuthorized', 'replySendAuthorized', 'directMinorContactAuthorized', 'restrictedCaseDraftingAuthorized', 'marketingReuseAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const knowledgeBoundary = contract.knowledgeBoundary || {};
if (knowledgeBoundary.path !== 'docs/company/support/knowledge-base.json') failures.push('knowledgeBoundary.path is invalid');
if (knowledgeBoundary.requiredArticleCount !== 8) failures.push('knowledgeBoundary.requiredArticleCount must be 8');
requireTrue(knowledgeBoundary, ['liveDraftApprovalRequired', 'inventedSanitizedExamplesOnly', 'unknownAnswerMustRefuse', 'sourceReferenceRequired', 'humanReviewRequired'], 'knowledgeBoundary', failures);
if (knowledgeBase.schemaVersion !== 1) failures.push('knowledge base schemaVersion must be 1');
if (knowledgeBase.approvedForSupportDrafts !== false) failures.push('knowledge base must remain unapproved');
if (!Array.isArray(knowledgeBase.articles) || knowledgeBase.articles.length !== 8) failures.push('knowledge base must contain exactly 8 articles');

const expectedBindings = [
    ['KB-001', 'account_required', 'src/site/storefront.js'], ['KB-002', 'local_save', 'src/config/legal.json'], ['KB-003', 'price', 'src/site/storefront.js'],
    ['KB-004', 'browser_support', 'src/site/storefront.js'], ['KB-005', 'family_suitability', 'src/site/storefront.js'], ['KB-006', 'cloud_save', 'src/site/storefront.js'],
    ['KB-007', 'parent_contact', 'src/site/storefront.js'], ['KB-008', 'community_submission', 'src/site/storefront.js']
];
if (!Array.isArray(contract.answerBindings) || contract.answerBindings.length !== 8) failures.push('answerBindings must contain 8 entries');
for (let index = 0; index < expectedBindings.length; index += 1) {
    const item = contract.answerBindings?.[index] || {};
    if (!sameJson([item.articleId, item.intent, item.source], expectedBindings[index])) failures.push(`answer binding ${index + 1} is invalid`);
    const article = knowledgeBase.articles?.find(candidate => candidate.id === item.articleId);
    if (!article || article.intent !== item.intent || article.source !== item.source || typeof article.candidateReply !== 'string' || !plainLanguagePass(article.candidateReply)) failures.push(`answer article ${item.articleId} is missing, unbound, or not plain language`);
}

const rules = contract.operatingRules || {};
requireTrue(rules, ['triageMustRunFirst', 'answerMustMatchKnownIntent', 'answerMustNameSourceRecord', 'plainLanguageCheckRequired', 'humanReviewRequiredForEveryDraft', 'restrictedCasesMustRefuse', 'personalDetailsMustRefuse', 'possibleYoungPersonMustRefuse'], 'operatingRules', failures);
requireFalse(rules, ['rawMessageMayAppearInOutput', 'assistantMayInventAnswer', 'assistantMayApproveKnowledge', 'assistantMaySendReply', 'supportContactMayBeReusedForMarketing'], 'operatingRules', failures);

const caseResults = (contract.syntheticCases || []).map(item => {
    const result = createGroundedSupportDraft(item.input, knowledgeBase);
    const passed = result.accepted === item.expectedAccepted && result.reasonCode === item.expectedReasonCode && (result.articleId || null) === item.expectedArticleId && result.humanReviewRequired === true && result.replySendAuthorized === false && result.autonomousReplyPermitted === false && result.rawMessageRetained === false && result.externalActionAuthorized === false && !Object.hasOwn(result, 'message') && !Object.hasOwn(result, 'rawMessage') && !JSON.stringify(result).includes(item.input.message);
    return { id: item.id, accepted: result.accepted, reasonCode: result.reasonCode, articleId: result.articleId || null, draftCreated: result.draftCreated === true, humanReviewRequired: result.humanReviewRequired, replySendAuthorized: result.replySendAuthorized, rawMessageRetained: result.rawMessageRetained, externalActionAuthorized: result.externalActionAuthorized, passed };
});
if (!Array.isArray(contract.syntheticCases) || contract.syntheticCases.length !== 12) failures.push('syntheticCases must contain 12 cases');
const acceptedDraftCount = caseResults.filter(item => item.accepted).length;
const refusedDraftCount = caseResults.filter(item => !item.accepted).length;
const sourceBoundDraftCount = caseResults.filter(item => item.articleId).length;
const humanReviewRequiredCount = caseResults.filter(item => item.humanReviewRequired).length;
const rawMessageRetentionCount = caseResults.filter(item => item.rawMessageRetained).length;
const replySendCount = caseResults.filter(item => item.replySendAuthorized).length;
const externalActionCount = caseResults.filter(item => item.externalActionAuthorized).length;
const plainLanguagePassCount = (knowledgeBase.articles || []).filter(item => plainLanguagePass(item.candidateReply)).length;
const observed = { articleCount: knowledgeBase.articles?.length || 0, plainLanguagePassCount, syntheticCaseCount: caseResults.length, acceptedDraftCount, refusedDraftCount, sourceBoundDraftCount, humanReviewRequiredCount, rawMessageRetentionCount, replySendCount, externalActionCount };
for (const [field, expected] of Object.entries(contract.expectedResults || {})) if (observed[field] !== expected) failures.push(`expectedResults.${field} expected ${expected}, observed ${observed[field]}`);
if (caseResults.some(item => !item.passed)) failures.push('one or more synthetic drafting cases failed');

const productionFields = ['namedSupportOwnerAssigned', 'namedKnowledgeOwnerAssigned', 'namedSafeguardingPrimaryAssigned', 'namedSafeguardingBackupAssigned', 'namedPrivacyReviewerAssigned', 'namedAccessibilityReviewerAssigned', 'knowledgeBaseApproved', 'representativeComprehensionReviewCompleted', 'restrictedCaseRoutesTested', 'liveInboxConnected', 'replyApprovalRouteTested', 'killSwitchTested', 'liveMessageUseApproved', 'autonomousSendingEnabled'];
requireFalse(contract.productionReadiness, productionFields, 'productionReadiness', failures, true);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 14) failures.push('activationGates must contain 14 gates');
for (let index = 0; index < 14; index += 1) if (contract.activationGates?.[index]?.id !== `SD-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
requireTrue(contract, ['groundedDraftingReadyForReview', 'humanReviewRequired'], 'contract', failures);
requireFalse(contract, ['liveSupportDraftingReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 500) failures.push('nextDecision is incomplete');

const groundedDraftingContractValid = failures.length === 0;
const output = {
    workflow: 'A-057',
    mode: 'offline source-bound candidate reply rehearsal; no live message, approval, or send',
    groundedDraftingContractValid,
    draftingRehearsalPerformed: true,
    articleCount: observed.articleCount,
    plainLanguagePassCount,
    syntheticCaseCount: observed.syntheticCaseCount,
    acceptedDraftCount,
    refusedDraftCount,
    sourceBoundDraftCount,
    humanReviewRequiredCount,
    rawMessageRetentionCount,
    replySendCount,
    externalActionCount,
    knowledgeBaseApproved: false,
    groundedDraftingReadyForReview: groundedDraftingContractValid,
    liveSupportDraftingReady: false,
    liveInboxConnected: false,
    replySendAuthorized: false,
    directMinorContactAuthorized: false,
    externalActionAuthorized: false,
    activationGateCount: (contract.activationGates || []).length,
    satisfiedActivationGateCount: (contract.activationGates || []).filter(item => item.satisfied).length,
    caseResults,
    failures,
    nextDecision: contract.nextDecision
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
