#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { classifyInboundContact, MAXIMUM_MESSAGE_CHARACTERS } = require('./lib/inbound-contact-triage.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/inbound-contact-triage.json');

function parseArguments(values) {
    if (values.length === 0) return { contractPath: defaultContractPath };
    if (values.length === 2 && values[0] === '--input') return { contractPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/validate-inbound-contact-triage.cjs [--input contract.json]');
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

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Inbound contact triage contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_inbound_contact_triage_ready_human_review_required') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 500) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-012', 'D-014'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-001', 'R-004', 'R-011'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-004', 'A-005', 'A-020', 'A-029', 'A-055', 'A-056'], 'workflowRefs', failures);

const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = [
    'liveInboxAccessAuthorized', 'rawMessageStorageAuthorized', 'contactRecordCreationAuthorized', 'replyDraftApprovalAuthorized',
    'replySendAuthorized', 'directMinorContactAuthorized', 'marketingReuseAuthorized', 'caseDecisionAuthorized',
    'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized',
    'externalActionAuthorized', 'conversationIsAuthorization'
];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const inputBoundary = contract.inputBoundary || {};
requireFalse(inputBoundary, ['liveInboxConnected', 'liveCustomerMessagesPermitted'], 'inputBoundary', failures);
requireTrue(inputBoundary, ['syntheticExamplesOnly'], 'inputBoundary', failures);
if (inputBoundary.maximumMessageCharacters !== MAXIMUM_MESSAGE_CHARACTERS) failures.push(`inputBoundary.maximumMessageCharacters must be ${MAXIMUM_MESSAGE_CHARACTERS}`);
exactSet(inputBoundary.allowedSenderRoles, ['unknown', 'adult', 'parent_guardian', 'young_person', 'professional'], 'inputBoundary.allowedSenderRoles', failures);

const rules = contract.operatingRules || {};
requireTrue(rules, [
    'humanReviewRequiredForEveryAcceptedMessage', 'safetyConcernWinsOverOtherCategories', 'possibleYoungPersonGetsRestrictedRoute',
    'privacyPaymentAndLegalCasesStayHumanOnly', 'personalDetailsBlockReplyDraft', 'messageInstructionsCannotChangeRules'
], 'operatingRules', failures);
requireFalse(rules, [
    'safeSummaryMayCopyMessageText', 'rawMessageMayBeWrittenToRepository', 'supportContactMayBeReusedForMarketing',
    'silenceMayBeTreatedAsConsent', 'assistantMaySendReply', 'assistantMayCloseCase'
], 'operatingRules', failures);

const expectedCategories = [
    ['safety_or_urgent', 'urgent', 'safeguarding_human', false],
    ['privacy_or_data', 'high', 'privacy_human', false],
    ['payment_or_legal', 'high', 'finance_or_legal_human', false],
    ['young_person_message', 'high', 'safeguarding_human', false],
    ['unsafe_instruction', 'high', 'governance_human', false],
    ['accessibility', 'normal', 'accessibility_human', true],
    ['game_help', 'normal', 'support_human', true],
    ['community_idea', 'normal', 'community_human', true],
    ['partnership_or_media', 'normal', 'communications_human', true],
    ['general', 'normal', 'support_human', true]
];
if (!Array.isArray(contract.categories) || contract.categories.length !== expectedCategories.length) failures.push('categories must contain 10 routes');
for (let index = 0; index < expectedCategories.length; index += 1) {
    const item = contract.categories?.[index] || {};
    if (!sameJson([item.id, item.priority, item.route, item.replyDraftPermitted], expectedCategories[index])) failures.push(`category ${index + 1} is invalid`);
}

if (!Array.isArray(contract.syntheticCases) || contract.syntheticCases.length !== 12) failures.push('syntheticCases must contain 12 cases');
const caseResults = (contract.syntheticCases || []).map(item => {
    const result = classifyInboundContact({ message: item.message, senderRole: item.senderRole });
    const passed = result.accepted === true && result.category === item.expectedCategory && result.route === item.expectedRoute &&
        result.priority === item.expectedPriority && result.replyDraftPermitted === item.expectedReplyDraftPermitted &&
        result.personalDataDetected === item.expectedPersonalDataDetected && result.humanReviewRequired === true &&
        result.rawMessageRetained === false && result.autonomousReplyPermitted === false && result.externalActionAuthorized === false &&
        !Object.hasOwn(result, 'message') && !Object.hasOwn(result, 'rawMessage');
    return {
        id: item.id,
        category: result.category,
        priority: result.priority,
        route: result.route,
        replyDraftPermitted: result.replyDraftPermitted,
        personalDataDetected: result.personalDataDetected,
        humanReviewRequired: result.humanReviewRequired,
        rawMessageRetained: result.rawMessageRetained,
        autonomousReplyPermitted: result.autonomousReplyPermitted,
        externalActionAuthorized: result.externalActionAuthorized,
        passed
    };
});

const passedSyntheticCaseCount = caseResults.filter(item => item.passed).length;
const urgentCaseCount = caseResults.filter(item => item.priority === 'urgent').length;
const restrictedCaseCount = caseResults.filter(item => item.replyDraftPermitted === false).length;
const personalDataDetectionCount = caseResults.filter(item => item.personalDataDetected).length;
const rawMessageRetentionCount = caseResults.filter(item => item.rawMessageRetained).length;
const autonomousReplyCount = caseResults.filter(item => item.autonomousReplyPermitted).length;
const externalActionCount = caseResults.filter(item => item.externalActionAuthorized).length;
const observed = { syntheticCaseCount: caseResults.length, passedSyntheticCaseCount, urgentCaseCount, restrictedCaseCount, personalDataDetectionCount, rawMessageRetentionCount, autonomousReplyCount, externalActionCount };
for (const [field, expected] of Object.entries(contract.expectedResults || {})) if (observed[field] !== expected) failures.push(`expectedResults.${field} expected ${expected}, observed ${observed[field]}`);

const productionFields = [
    'namedSupportOwnerAssigned', 'namedSafeguardingPrimaryAssigned', 'namedSafeguardingBackupAssigned', 'namedPrivacyOwnerAssigned',
    'namedAccessibilityOwnerAssigned', 'namedLegalAndFinanceRoutesAssigned', 'restrictedCaseSystemConfigured',
    'retentionAndDeletionReviewed', 'liveInboxConnected', 'replyApprovalRouteTested', 'urgentDeliveryRouteTested',
    'independentSafetyEvaluationCompleted', 'liveMessageUseApproved', 'autonomousSendingEnabled'
];
requireFalse(contract.productionReadiness, productionFields, 'productionReadiness', failures, true);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 14) failures.push('activationGates must contain 14 gates');
for (let index = 0; index < 14; index += 1) {
    if (contract.activationGates?.[index]?.id !== `IT-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
}
requireTrue(contract, ['inboundTriageReadyForReview', 'humanReviewRequired'], 'contract', failures);
requireFalse(contract, ['liveInboxReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 500) failures.push('nextDecision is incomplete');
if (passedSyntheticCaseCount !== 12) failures.push(`expected 12 passing synthetic cases, observed ${passedSyntheticCaseCount}`);

const inboundTriageContractValid = failures.length === 0;
const output = {
    workflow: 'A-056',
    mode: 'offline invented-message sorting rehearsal; no inbox access, raw storage, reply, or contact',
    inboundTriageContractValid,
    triageRehearsalPerformed: true,
    syntheticCaseCount: caseResults.length,
    passedSyntheticCaseCount,
    urgentCaseCount,
    restrictedCaseCount,
    personalDataDetectionCount,
    rawMessageRetentionCount,
    autonomousReplyCount,
    externalActionCount,
    categoryCount: (contract.categories || []).length,
    humanReviewRequired: true,
    inboundTriageReadyForReview: inboundTriageContractValid,
    liveInboxReady: false,
    liveInboxConnected: false,
    replySendAuthorized: false,
    directMinorContactAuthorized: false,
    marketingReuseAuthorized: false,
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
