#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultQualificationPath = path.join(repositoryRoot, 'docs', 'company', 'commercial', 'qualification.json');
const qualificationPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultQualificationPath;
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
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}

const qualification = load(qualificationPath, 'Commercial qualification register');
const pipeline = load(path.join(repositoryRoot, 'docs/company/commercial/opportunities.json'), 'Commercial pipeline');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const handoffText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md'), 'utf8');

const opportunities = new Map((pipeline.opportunities || []).map(item => [item.id, item]));
const knownRefs = new Set([
    ...(registry.workflows || []).map(item => item.id),
    ...risks.map(item => item.id),
    ...[...decisionText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]),
    ...[...handoffText.matchAll(/## (GDH-\d{3})/g)].map(match => match[1])
]);
const dimensions = ['audienceFit', 'productFit', 'trustSafety', 'strategicLearning', 'reachQuality', 'economicPotential', 'controlRights', 'integrationEffort', 'operationalLoad', 'reversibility'];
const disqualifiers = ['DQ-001', 'DQ-002', 'DQ-003', 'DQ-004', 'DQ-005', 'DQ-006', 'DQ-007', 'DQ-008'];
const ratings = new Set(['positive', 'mixed', 'weak', 'unknown']);
const evidenceStates = new Set(['source_supported', 'internal_inference', 'missing']);
const disqualifierStates = new Set(['not_observed_in_public_research', 'requires_review', 'cleared_with_evidence', 'triggered']);
const recommendations = new Set(['technical_feasibility_first', 'sequence_after_packaging_baseline', 'defer_pending_product_privacy_and_safety_evidence', 'defer_high_integration_and_policy_dependency', 'decline', 'hold']);

if (qualification.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(qualification.asOf || '')) failures.push('asOf must be an ISO date');
if (qualification.status !== 'internal_assessment_ready_external_gated') failures.push('status must remain internal_assessment_ready_external_gated');
if (typeof qualification.purpose !== 'string' || qualification.purpose.length < 30) failures.push('purpose is incomplete');

for (const field of [
    'pipelineStageMutationAuthorized',
    'contactEnrichmentAuthorized',
    'recipientIdentificationAuthorized',
    'outreachDraftingAuthorized',
    'outreachSendingAuthorized',
    'accountCreationAuthorized',
    'termsAcceptanceAuthorized',
    'buildSharingAuthorized',
    'sdkIntegrationAuthorized',
    'pricingOrTermsAuthorized',
    'revenueForecastingAuthorized',
    'spendAuthorized',
    'contractingAuthorized',
    'externalActionAuthorized',
    'minorTargetingPermitted',
    'conversationIsAuthorization'
]) if (qualification.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

for (const field of ['numericCompositeScorePermitted', 'headlineReachCountsAsFit', 'publicSourceCountsAsCustomerEvidence', 'silenceCountsAsInterest']) if (qualification.model?.[field] !== false) failures.push(`model.${field} must be false`);
exactSet(qualification.model?.dimensions, dimensions, 'model.dimensions');
exactSet(qualification.model?.allowedRatings, [...ratings], 'model.allowedRatings');
exactSet(qualification.model?.allowedEvidenceStates, [...evidenceStates], 'model.allowedEvidenceStates');
if (!Array.isArray(qualification.model?.qualificationRequires) || qualification.model.qualificationRequires.length !== 10) failures.push('model.qualificationRequires must contain ten explicit gates');
if (!Array.isArray(qualification.model?.externalProgressionRequires) || qualification.model.externalProgressionRequires.length !== 7) failures.push('model.externalProgressionRequires must contain seven explicit gates');
if (typeof qualification.model?.internalRankMeaning !== 'string' || qualification.model.internalRankMeaning.length < 30) failures.push('model.internalRankMeaning is incomplete');
if (typeof qualification.portfolioRecommendation !== 'string' || qualification.portfolioRecommendation.length < 30) failures.push('portfolioRecommendation is incomplete');

const assessments = qualification.assessments || [];
if (!Array.isArray(qualification.assessments) || assessments.length !== opportunities.size) failures.push('assessments must cover every pipeline opportunity exactly once');
const assessmentRefs = new Set();
const ranks = new Set();
let requiresReviewCount = 0;
let triggeredDisqualifierCount = 0;
for (const [index, assessment] of assessments.entries()) {
    const label = assessment?.opportunityRef || `assessments[${index}]`;
    const opportunity = opportunities.get(assessment?.opportunityRef);
    if (!opportunity) failures.push(`${label} references unknown opportunity`);
    if (assessmentRefs.has(assessment?.opportunityRef)) failures.push(`duplicate assessment ${assessment.opportunityRef}`);
    assessmentRefs.add(assessment?.opportunityRef);
    if (opportunity && assessment.organization !== opportunity.organization) failures.push(`${label}.organization does not match A-007`);
    if (opportunity && assessment.sourceStage !== opportunity.stage) failures.push(`${label}.sourceStage does not match A-007`);
    if (assessment.sourceStage !== 'researched' || assessment.assessmentStatus !== 'researched_not_qualified') failures.push(`${label} must remain researched_not_qualified`);
    if (!recommendations.has(assessment.recommendation)) failures.push(`${label} has invalid recommendation`);
    if (!Number.isInteger(assessment.sequenceRank) || assessment.sequenceRank < 1 || assessment.sequenceRank > assessments.length) failures.push(`${label} has invalid sequenceRank`);
    if (ranks.has(assessment.sequenceRank)) failures.push(`duplicate sequenceRank ${assessment.sequenceRank}`);
    ranks.add(assessment.sequenceRank);
    for (const field of ['valueHypothesis', 'decisionServed', 'internalNextAction']) if (typeof assessment[field] !== 'string' || !assessment[field].trim()) failures.push(`${label} lacks ${field}`);

    exactSet(Object.keys(assessment.dimensions || {}), dimensions, `${label}.dimensions`);
    for (const dimension of dimensions) {
        const judgment = assessment.dimensions?.[dimension];
        if (!ratings.has(judgment?.rating)) failures.push(`${label}.${dimension} has invalid rating`);
        if (!evidenceStates.has(judgment?.evidenceState)) failures.push(`${label}.${dimension} has invalid evidenceState`);
        if (typeof judgment?.rationale !== 'string' || judgment.rationale.length < 20) failures.push(`${label}.${dimension} lacks substantive rationale`);
        if (judgment?.evidenceState === 'missing' && judgment?.rating !== 'unknown') failures.push(`${label}.${dimension} missing evidence must have unknown rating`);
    }

    if (!Array.isArray(assessment.disqualifierReview) || assessment.disqualifierReview.length !== 8) failures.push(`${label}.disqualifierReview must cover all eight disqualifiers`);
    const reviewed = new Set();
    for (const disqualifier of assessment.disqualifierReview || []) {
        if (!disqualifiers.includes(disqualifier?.id)) failures.push(`${label} has unknown disqualifier ${disqualifier?.id}`);
        if (reviewed.has(disqualifier?.id)) failures.push(`${label} duplicates disqualifier ${disqualifier.id}`);
        reviewed.add(disqualifier?.id);
        if (!disqualifierStates.has(disqualifier?.state)) failures.push(`${label}.${disqualifier?.id} has invalid state`);
        if (!Array.isArray(disqualifier?.clearanceEvidenceRefs)) failures.push(`${label}.${disqualifier?.id}.clearanceEvidenceRefs must be an array`);
        if (disqualifier?.state === 'cleared_with_evidence' && disqualifier.clearanceEvidenceRefs.length === 0) failures.push(`${label}.${disqualifier.id} is cleared without evidence`);
        if (disqualifier?.state !== 'cleared_with_evidence' && disqualifier.clearanceEvidenceRefs.length !== 0) failures.push(`${label}.${disqualifier.id} has clearance evidence before clearance`);
        if (disqualifier?.state === 'requires_review') requiresReviewCount += 1;
        if (disqualifier?.state === 'triggered') triggeredDisqualifierCount += 1;
    }
    const triggered = (assessment.disqualifierReview || []).some(item => item.state === 'triggered');
    if (triggered && !['decline', 'hold'].includes(assessment.recommendation)) failures.push(`${label} has a triggered disqualifier without decline/hold`);

    if (!Array.isArray(assessment.dependencyRefs) || assessment.dependencyRefs.length < 5) failures.push(`${label}.dependencyRefs are incomplete`);
    for (const ref of assessment.dependencyRefs || []) if (!knownRefs.has(ref)) failures.push(`${label} references unknown dependency ${ref}`);
    for (const [field, value] of Object.entries(assessment.financialAssumptions || {})) if (value !== null) failures.push(`${label}.financialAssumptions.${field} must remain null`);
    if (Object.keys(assessment.financialAssumptions || {}).length !== 5) failures.push(`${label}.financialAssumptions must contain five explicit unknowns`);
    if (assessment.contact !== null) failures.push(`${label}.contact must remain null`);
    if (assessment.outreachPackage !== null) failures.push(`${label}.outreachPackage must remain null`);
    if (assessment.stageChangeAuthorized !== false || assessment.externalActionAuthorized !== false) failures.push(`${label} stage/external authority must remain false`);
}
for (const opportunityId of opportunities.keys()) if (!assessmentRefs.has(opportunityId)) failures.push(`missing assessment ${opportunityId}`);
for (let rank = 1; rank <= assessments.length; rank += 1) if (!ranks.has(rank)) failures.push(`sequence ranks must be contiguous; missing ${rank}`);

const expectedSequence = ['OP-001', 'OP-004', 'OP-002', 'OP-003'];
const actualSequence = [...assessments].sort((a, b) => a.sequenceRank - b.sequenceRank).map(item => item.opportunityRef);
if (actualSequence.some((id, index) => id !== expectedSequence[index])) failures.push(`current evidence sequence must be ${expectedSequence.join(', ')}`);

const serialized = JSON.stringify(qualification);
if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized)) failures.push('qualification register appears to contain an email address');

const qualifiedOpportunityCount = assessments.filter(item => item.assessmentStatus === 'qualified').length;
const contactRecordCount = assessments.filter(item => item.contact !== null).length;
const outreachPackageCount = assessments.filter(item => item.outreachPackage !== null).length;
const technicalFeasibilityPriorityCount = assessments.filter(item => item.recommendation === 'technical_feasibility_first').length;

console.log(JSON.stringify({
    workflow: 'A-032',
    mode: 'internal commercial qualification and deal-desk assurance; no outreach or terms',
    commercialQualificationValid: failures.length === 0,
    portfolioDecisionReady: failures.length === 0,
    opportunityCount: assessments.length,
    qualifiedOpportunityCount,
    technicalFeasibilityPriorityCount,
    internalSequence: actualSequence,
    reviewedDimensionCount: assessments.length * dimensions.length,
    disqualifierReviewCount: assessments.length * disqualifiers.length,
    unresolvedDisqualifierReviewCount: requiresReviewCount,
    triggeredDisqualifierCount,
    contactRecordCount,
    outreachPackageCount,
    financialAssumptionValueCount: assessments.reduce((count, item) => count + Object.values(item.financialAssumptions || {}).filter(value => value !== null).length, 0),
    pipelineStageMutationAuthorized: false,
    contactEnrichmentAuthorized: false,
    outreachDraftingAuthorized: false,
    outreachSendingAuthorized: false,
    accountCreationAuthorized: false,
    termsAcceptanceAuthorized: false,
    sdkIntegrationAuthorized: false,
    pricingOrTermsAuthorized: false,
    revenueForecastingAuthorized: false,
    spendAuthorized: false,
    contractingAuthorized: false,
    minorTargetingPermitted: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Game Development evaluates one portable portal-build spike using OP-001 as the baseline and OP-002 through OP-004 as requirement cases; no pipeline stage, account, contact, terms, SDK, upload, forecast, or external action is authorized.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;

