#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultEvaluationPath = path.join(repositoryRoot, 'docs/company/automation/protected-runtime-provider-evaluation.json');
const evaluationPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultEvaluationPath;
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

const evaluation = load(evaluationPath, 'Provider evaluation');
const protectedRuntime = load(path.join(repositoryRoot, 'docs/company/automation/protected-runtime.json'), 'Protected-runtime contract');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const workflowIds = new Set((registry.workflows || []).map(workflow => workflow.id));
const riskIds = new Set(risks.map(risk => risk.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (evaluation.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluation.asOf || '')) failures.push('asOf must be an ISO date');
if (evaluation.status !== 'provider_shortlist_complete_selection_gated') failures.push('status must remain provider_shortlist_complete_selection_gated');
if (typeof evaluation.purpose !== 'string' || evaluation.purpose.length < 50) failures.push('purpose is incomplete');
if (evaluation.architectureClassRef !== 'PR-001') failures.push('architectureClassRef must remain PR-001');
if (!(protectedRuntime.architectureOptions || []).some(option => option.id === evaluation.architectureClassRef && option.recommended === true)) failures.push('architectureClassRef must identify the recommended A-031 class');

exactSet(evaluation.decisionRefs, ['D-014', 'D-017'], 'decisionRefs');
exactSet(evaluation.riskRefs, ['R-007', 'R-008', 'R-011', 'R-012', 'R-013'], 'riskRefs');
exactSet(evaluation.workflowRefs, ['A-011', 'A-016', 'A-023', 'A-030', 'A-031', 'A-035', 'A-036'], 'workflowRefs');
for (const id of evaluation.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of evaluation.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of evaluation.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);

for (const field of [
    'providerSelectionAuthorized', 'vendorAccountCreationAuthorized', 'termsAcceptanceAuthorized',
    'credentialCreationAuthorized', 'runtimeProvisioningAuthorized', 'schedulerActivationAuthorized',
    'persistentStoreCreationAuthorized', 'alertDeliveryAuthorized', 'externalActionAuthorized',
    'spendAuthorized', 'conversationIsAuthorization'
]) if (evaluation.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

for (const field of [
    'officialPrimaryDocumentationOnly', 'missingEvidenceRemainsUnverified',
    'pricingMustBeVerifiedForExactRegionAndUsage', 'termsPrivacySecurityAndDataRegionReviewRequired'
]) if (evaluation.sourcePolicy?.[field] !== true) failures.push(`sourcePolicy.${field} must be true`);
for (const field of ['marketingClaimsCountAsConfigurationEvidence', 'documentedCapabilityCountsAsConfiguredControl']) {
    if (evaluation.sourcePolicy?.[field] !== false) failures.push(`sourcePolicy.${field} must be false`);
}

const requirements = evaluation.platformCapabilityRequirements || [];
const expectedRequirementIds = Array.from({ length: 12 }, (_, index) => `PC-${String(index + 1).padStart(3, '0')}`);
exactSet(requirements.map(item => item.id), expectedRequirementIds, 'platform capability IDs');
for (const requirement of requirements) {
    if (typeof requirement.name !== 'string' || requirement.name.length < 8 || typeof requirement.requirement !== 'string' || requirement.requirement.length < 30) failures.push(`${requirement.id || 'unknown requirement'} is incomplete`);
}
const requirementIds = new Set(expectedRequirementIds);

const candidates = evaluation.candidates || [];
exactSet(candidates.map(candidate => candidate.id), ['PE-001', 'PE-002', 'PE-003'], 'candidate IDs');
const candidateIds = new Set(candidates.map(candidate => candidate.id));
const sources = evaluation.sources || [];
const sourceIds = new Set();
const permittedHosts = new Set(['cloud.google.com', 'docs.cloud.google.com', 'docs.aws.amazon.com', 'docs.github.com']);
for (const source of sources) {
    if (sourceIds.has(source.id)) failures.push(`duplicate source ${source.id}`);
    sourceIds.add(source.id);
    if (!candidateIds.has(source.providerId)) failures.push(`${source.id || 'source'} has unknown providerId`);
    let url;
    try { url = new URL(source.url); } catch { failures.push(`${source.id || 'source'} has invalid URL`); }
    if (url && (url.protocol !== 'https:' || !permittedHosts.has(url.hostname))) failures.push(`${source.id} must use permitted official documentation`);
    if (source.retrievedOn !== '2026-08-11') failures.push(`${source.id || 'source'} retrievedOn is stale or missing`);
    for (const id of source.supports || []) if (!requirementIds.has(id)) failures.push(`${source.id} supports unknown requirement ${id}`);
}
if (sources.length !== 14) failures.push('exactly fourteen official source records are required');

const fitClasses = new Set(['recommended_for_next_review_not_selected', 'credible_higher_complexity_alternative', 'bootstrap_only_not_independent_assurance']);
let documentedCapabilityMappingCount = 0;
for (const candidate of candidates) {
    if (typeof candidate.provider !== 'string' || candidate.provider.length < 3 || typeof candidate.runtimeStack !== 'string' || candidate.runtimeStack.length < 20) failures.push(`${candidate.id} identity is incomplete`);
    if (!fitClasses.has(candidate.fitClass)) failures.push(`${candidate.id} has invalid fitClass`);
    if (![1, 2, 3].includes(candidate.nextReviewRank)) failures.push(`${candidate.id} has invalid nextReviewRank`);
    const documented = candidate.documentedCapabilityIds || [];
    const unverified = candidate.unverifiedRequirementIds || [];
    if (new Set(documented).size !== documented.length || new Set(unverified).size !== unverified.length) failures.push(`${candidate.id} contains duplicate requirement mappings`);
    for (const id of [...documented, ...unverified]) if (!requirementIds.has(id)) failures.push(`${candidate.id} maps unknown requirement ${id}`);
    const overlap = documented.filter(id => unverified.includes(id));
    if (overlap.length) failures.push(`${candidate.id} marks requirements documented and unverified`);
    exactSet([...documented, ...unverified], expectedRequirementIds, `${candidate.id} requirement coverage`);
    documentedCapabilityMappingCount += documented.length;
    if (!Array.isArray(candidate.sourceRefs) || candidate.sourceRefs.length < 1) failures.push(`${candidate.id} needs sourceRefs`);
    for (const sourceRef of candidate.sourceRefs || []) {
        const source = sources.find(item => item.id === sourceRef);
        if (!source || source.providerId !== candidate.id) failures.push(`${candidate.id} has invalid sourceRef ${sourceRef}`);
    }
    for (const capabilityId of documented) {
        if (!sources.some(source => source.providerId === candidate.id && (source.supports || []).includes(capabilityId))) failures.push(`${candidate.id} lacks source support for ${capabilityId}`);
    }
    if (!Array.isArray(candidate.strengths) || candidate.strengths.length < 2 || !Array.isArray(candidate.knownConstraints) || candidate.knownConstraints.length < 2) failures.push(`${candidate.id} strengths and constraints are incomplete`);
    for (const field of ['accountObserved', 'pricingVerified', 'securityReviewCompleted', 'privacyReviewCompleted', 'termsReviewCompleted', 'dataRegionVerified', 'providerSelected', 'activationReady']) {
        if (candidate[field] !== false) failures.push(`${candidate.id}.${field} must remain false`);
    }
}
if (new Set(candidates.map(candidate => candidate.nextReviewRank)).size !== 3) failures.push('candidate ranks must be unique');
const recommended = candidates.filter(candidate => candidate.recommendedForNextReview === true);
if (recommended.length !== 1 || recommended[0]?.id !== 'PE-001') failures.push('PE-001 must be the single next-review recommendation');
if (evaluation.recommendedNextReviewCandidateId !== 'PE-001') failures.push('recommendedNextReviewCandidateId must remain PE-001');
if (evaluation.recommendationIsProviderSelection !== false || evaluation.selectedProviderId !== null) failures.push('review recommendation must not become provider selection');
if (evaluation.reviewPackageReady !== true) failures.push('reviewPackageReady must be true');
for (const field of ['deploymentReady', 'runtimePromotionEligible', 'externalActionAuthorized']) if (evaluation[field] !== false) failures.push(`${field} must remain false`);
if (typeof evaluation.nextDecision !== 'string' || evaluation.nextDecision.length < 50 || !evaluation.nextDecision.includes('does not authorize')) failures.push('nextDecision must state the non-authorizing boundary');

const unverifiedRequirementMappingCount = candidates.reduce((sum, candidate) => sum + (candidate.unverifiedRequirementIds || []).length, 0);
console.log(JSON.stringify({
    workflow: 'A-037',
    mode: 'official-documentation provider feasibility review; no provider selection or activation',
    providerEvaluationValid: failures.length === 0,
    reviewPackageReady: failures.length === 0 && evaluation.reviewPackageReady === true,
    architectureClassRef: evaluation.architectureClassRef,
    candidateCount: candidates.length,
    platformRequirementCount: requirements.length,
    officialSourceCount: sources.length,
    documentedCapabilityMappingCount,
    unverifiedRequirementMappingCount,
    recommendedReviewCandidateCount: recommended.length,
    selectedProviderCount: candidates.filter(candidate => candidate.providerSelected === true).length,
    accountEvidenceCount: candidates.filter(candidate => candidate.accountObserved === true).length,
    pricingVerifiedCount: candidates.filter(candidate => candidate.pricingVerified === true).length,
    securityReviewCompletedCount: candidates.filter(candidate => candidate.securityReviewCompleted === true).length,
    privacyReviewCompletedCount: candidates.filter(candidate => candidate.privacyReviewCompleted === true).length,
    activationReadyCount: candidates.filter(candidate => candidate.activationReady === true).length,
    recommendationIsProviderSelection: evaluation.recommendationIsProviderSelection,
    deploymentReady: evaluation.deploymentReady,
    runtimePromotionEligible: evaluation.runtimePromotionEligible,
    externalActionAuthorized: evaluation.externalActionAuthorized,
    failures,
    nextAction: evaluation.nextDecision
}, null, 2));

process.exit(failures.length ? 1 : 2);
