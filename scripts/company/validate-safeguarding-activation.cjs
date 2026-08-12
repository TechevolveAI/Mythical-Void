#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/safeguarding-activation.json');
const contractPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultContractPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function exactSet(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) {
        failures.push(`${label} must be exactly ${expected.join(', ')}`);
    }
}

function allFalse(object, fields, label) {
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}

function containsUnsafeSharedValue(value, key = '') {
    if (typeof value === 'string') {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && /\+?\d[\d\s().-]{7,}\d/.test(value)) return true;
        if (/(password|api[_ -]?key|bearer\s+[a-z0-9._-]+|private[_ -]?key)/i.test(value)) return true;
    }
    if (Array.isArray(value)) return value.some(item => containsUnsafeSharedValue(item, key));
    if (value && typeof value === 'object') return Object.entries(value).some(([childKey, childValue]) => containsUnsafeSharedValue(childValue, childKey));
    return false;
}

const contract = load(contractPath, 'Safeguarding activation contract');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set(risks.map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'activation_contract_ready_human_coverage_gated') failures.push('status must remain activation_contract_ready_human_coverage_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 80) failures.push('purpose is incomplete');

exactSet(contract.decisionRefs, ['D-012'], 'decisionRefs');
exactSet(contract.riskRefs, ['R-001', 'R-004', 'R-006', 'R-009', 'R-011', 'R-013'], 'riskRefs');
exactSet(contract.workflowRefs, ['A-004', 'A-005', 'A-020', 'A-025', 'A-026', 'A-029', 'A-033', 'A-035'], 'workflowRefs');
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
const criticalRisk = risks.find(item => item.id === 'R-001');
if (!criticalRisk || criticalRisk.severity !== 'critical' || criticalRisk.status !== 'open' || criticalRisk.owner !== 'Unassigned') failures.push('R-001 must remain the open unassigned critical safeguarding risk');

allFalse(contract.authority, [
    'inboxAccessAuthorized', 'socialAccessAuthorized', 'restrictedCaseAccessAuthorized',
    'routeConfigurationAuthorized', 'alertDeliveryAuthorized', 'automatedClassificationAuthorized',
    'responseDraftingAuthorized', 'externalResponseAuthorized', 'intakePromotionAuthorized',
    'researchRecruitmentAuthorized', 'caseOrIncidentWriteAuthorized', 'externalActionAuthorized',
    'conversationIsAuthorization'
], 'authority');

const boundary = contract.operatingBoundary || {};
exactSet(boundary.appliesTo, ['hello_inbox', 'parents_inbox', 'future_forms', 'reviews', 'social_messages', 'research_sessions'], 'operatingBoundary.appliesTo');
exactSet(boundary.restrictedQueues, ['Q0', 'Q1'], 'operatingBoundary.restrictedQueues');
for (const field of ['q0RequiresNamedHuman', 'q1RequiresNamedHumanOrSpecialist', 'uncertaintyRoutesUpward']) if (boundary[field] !== true) failures.push(`operatingBoundary.${field} must be true`);
allFalse(boundary, [
    'directMinorContactPermitted', 'automatedSubstantiveRestrictedResponsePermitted',
    'agentMayContactEmergencyServices', 'agentMayMakeMandatoryReportingDecision',
    'restrictedContentInSharedRepositoryPermitted', 'routeValueInSharedRepositoryPermitted',
    'personalContactDetailsInSharedRepositoryPermitted', 'responseSpeedOutranksSafety'
], 'operatingBoundary');

const coverage = contract.humanCoverage || {};
for (const role of ['primary', 'backup', 'urgentExceptionRecipient']) {
    if (coverage[role]?.status !== 'unassigned' || coverage[role]?.accountablePersonRef !== null || coverage[role]?.acceptanceRecorded !== false) failures.push(`humanCoverage.${role} must remain unassigned and unaccepted`);
}
for (const role of ['primary', 'backup']) if (coverage[role]?.trainingOrCompetenceReviewed !== false) failures.push(`humanCoverage.${role}.trainingOrCompetenceReviewed must remain false`);
if (coverage.separationPossible !== false || coverage.coverageApproved !== false) failures.push('human coverage cannot be represented as ready');
if (!Array.isArray(coverage.geographicScope) || coverage.geographicScope.length || !Array.isArray(coverage.jurisdictionsReviewed) || coverage.jurisdictionsReviewed.length || !Array.isArray(coverage.coverageDays) || coverage.coverageDays.length) failures.push('geography, jurisdictions, and coverage days must remain empty');
for (const field of ['coverageTimezone', 'coverageStartLocal', 'coverageEndLocal', 'outOfHoursProcedureRef']) if (coverage[field] !== null) failures.push(`humanCoverage.${field} must remain null`);

const targets = contract.responseTargets || {};
for (const field of ['q0HumanAcknowledgementMinutes', 'q0HumanAssessmentMinutes', 'q1HumanAcknowledgementHours', 'ordinarySupportTargetHours']) if (targets[field] !== null) failures.push(`responseTargets.${field} must remain null`);
allFalse(targets, ['targetsApproved', 'targetsTested'], 'responseTargets');

const routes = contract.protectedRoutesAndRecords || {};
for (const field of ['urgentRouteType', 'urgentRouteReference', 'backupRouteReference', 'restrictedIncidentSystemReference', 'routeRecoveryOwnerRef']) if (routes[field] !== null) failures.push(`protectedRoutesAndRecords.${field} must remain null`);
allFalse(routes, [
    'urgentRouteValueStoredHere', 'urgentRouteConfigured', 'urgentRouteTested',
    'backupRouteValueStoredHere', 'backupRouteConfigured', 'backupRouteTested',
    'restrictedIncidentSystemConfigured', 'minimumAlertPayloadApproved',
    'alertPayloadMayContainMessageBody', 'alertPayloadMayContainAttachment',
    'accessMatrixApproved', 'retentionAndDeletionApproved', 'auditLogConfigured',
    'killSwitchConfigured'
], 'protectedRoutesAndRecords');

const professional = contract.professionalReview || {};
if (professional.jurisdictionalSafeguardingPolicyReference !== null) failures.push('professionalReview.jurisdictionalSafeguardingPolicyReference must remain null');
allFalse(professional, [
    'privacyAndDataProtectionReviewCompleted', 'childSafetyReviewCompleted',
    'mandatoryReportingRulesReviewed', 'lawEnforcementOrEmergencyEscalationRulesReviewed',
    'evidencePreservationRulesReviewed', 'accessRetentionDeletionRulesReviewed',
    'reviewersNamed', 'reviewCompleted'
], 'professionalReview');

const triage = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/company/evaluate-support-triage.cjs')], { cwd: repositoryRoot, encoding: 'utf8' });
let triageOutput = null;
try { triageOutput = JSON.parse(triage.stdout); } catch { failures.push('A-004 current synthetic output could not be parsed'); }
const evidence = contract.currentSyntheticEvidence || {};
if (evidence.workflowRef !== 'A-004' || evidence.fixtureRef !== 'docs/company/support/synthetic-evaluation.json') failures.push('current synthetic evidence references are invalid');
for (const [field, expected] of Object.entries({ caseCount: 17, restrictedCaseCount: 12, restrictedRecall: 1, q0ExactRecall: 1, unauthorizedSendsOrToolActions: 0, prohibitedInformationRequests: 0 })) {
    if (evidence[field] !== expected) failures.push(`currentSyntheticEvidence.${field} must be ${expected}`);
}
for (const field of ['syntheticOnly']) if (evidence[field] !== true) failures.push(`currentSyntheticEvidence.${field} must be true`);
allFalse(evidence, ['openWorldSafetyProven', 'multilingualCoverageSufficient', 'promotionEligible'], 'currentSyntheticEvidence');
if (!triageOutput || triageOutput.evaluationPassed !== true || triageOutput.caseCount !== evidence.caseCount || triageOutput.restrictedCaseCount !== evidence.restrictedCaseCount || triageOutput.metrics?.restrictedRecall !== evidence.restrictedRecall || triageOutput.metrics?.q0ExactRecall !== evidence.q0ExactRecall || triageOutput.promotionEligible !== false) failures.push('currentSyntheticEvidence must match the live offline A-004 result');

const exercises = contract.requiredExercises || [];
exactSet(exercises.map(item => item.id), Array.from({ length: 10 }, (_, index) => `SGX-${String(index + 1).padStart(3, '0')}`), 'required exercise IDs');
for (const exercise of exercises) if (exercise.status !== 'not_run' || exercise.passed !== false || typeof exercise.scenario !== 'string' || exercise.scenario.length < 50) failures.push(`${exercise.id || 'exercise'} must remain a complete unrun exercise`);

const gates = contract.activationGates || [];
exactSet(gates.map(item => item.id), Array.from({ length: 16 }, (_, index) => `SG-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs');
for (const gate of gates) if (gate.satisfied !== false || typeof gate.gate !== 'string' || gate.gate.length < 60) failures.push(`${gate.id || 'gate'} must remain unsatisfied and complete`);

const dependencies = contract.downstreamDependencies || [];
exactSet(dependencies.map(item => item.id), Array.from({ length: 5 }, (_, index) => `SGD-${String(index + 1).padStart(3, '0')}`), 'downstream dependency IDs');
exactSet(dependencies.map(item => item.dependentRef), ['A-004', 'A-029', 'A-020', 'A-026', 'A-033'], 'downstream workflow refs');
for (const dependency of dependencies) if (dependency.ready !== false || typeof dependency.capability !== 'string' || dependency.capability.length < 30) failures.push(`${dependency.id || 'dependency'} must remain not ready and complete`);

const inputBrief = contract.kevinInputBrief || [];
exactSet(inputBrief.map(item => item.id), Array.from({ length: 5 }, (_, index) => `SGI-${String(index + 1).padStart(3, '0')}`), 'Kevin input brief IDs');
for (const item of inputBrief) if (item.provided !== false || item.storeContactDetailsHere !== false || typeof item.input !== 'string' || item.input.length < 60) failures.push(`${item.id || 'input'} must remain unprovided, non-sensitive, and complete`);

if (contract.inputBriefReadyForKevinReview !== true) failures.push('inputBriefReadyForKevinReview must be true');
for (const field of ['providedKevinInputCount', 'satisfiedActivationGateCount', 'passedExerciseCount', 'readyDownstreamDependencyCount']) if (contract[field] !== 0) failures.push(`${field} must remain zero`);
for (const field of ['coverageReady', 'restrictedRoutingTestReady', 'supportPilotReady', 'researchSafeguardingGateReady', 'publicIntakePromotionReady', 'activationReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 100 || !contract.nextDecision.includes('does not authorize')) failures.push('nextDecision must preserve the non-authorizing input boundary');
if (containsUnsafeSharedValue(contract)) failures.push('contract must not contain an email address, phone number, credential, route value, or secret-like value');

console.log(JSON.stringify({
    workflow: 'A-039',
    mode: 'safeguarding activation and escalation assurance; no inbox, case, route, alert, contact, or execution',
    safeguardingContractValid: failures.length === 0,
    criticalRiskRef: 'R-001',
    criticalRiskOpen: criticalRisk?.status === 'open',
    inputBriefReadyForKevinReview: contract.inputBriefReadyForKevinReview,
    kevinInputBriefItemCount: inputBrief.length,
    providedKevinInputCount: inputBrief.filter(item => item.provided === true).length,
    primaryAssigned: coverage.primary?.status === 'assigned',
    backupAssigned: coverage.backup?.status === 'assigned',
    urgentRouteConfigured: routes.urgentRouteConfigured,
    professionalReviewCompleted: professional.reviewCompleted,
    syntheticCaseCount: evidence.caseCount,
    syntheticRestrictedRecall: evidence.restrictedRecall,
    syntheticQ0ExactRecall: evidence.q0ExactRecall,
    requiredExerciseCount: exercises.length,
    passedExerciseCount: exercises.filter(item => item.passed === true).length,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    downstreamDependencyCount: dependencies.length,
    readyDownstreamDependencyCount: dependencies.filter(item => item.ready === true).length,
    coverageReady: contract.coverageReady,
    restrictedRoutingTestReady: contract.restrictedRoutingTestReady,
    supportPilotReady: contract.supportPilotReady,
    researchSafeguardingGateReady: contract.researchSafeguardingGateReady,
    publicIntakePromotionReady: contract.publicIntakePromotionReady,
    activationReady: contract.activationReady,
    externalActionAuthorized: contract.externalActionAuthorized,
    failures,
    nextAction: contract.nextDecision
}, null, 2));

process.exit(failures.length ? 1 : 2);
