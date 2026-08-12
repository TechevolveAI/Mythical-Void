#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultDiligencePath = path.join(repositoryRoot, 'docs/company/automation/pe001-public-due-diligence.json');
const diligencePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDiligencePath;
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

const diligence = load(diligencePath, 'PE-001 due diligence');
const providerEvaluation = load(path.join(repositoryRoot, 'docs/company/automation/protected-runtime-provider-evaluation.json'), 'Provider evaluation');
const protectedRuntime = load(path.join(repositoryRoot, 'docs/company/automation/protected-runtime.json'), 'Protected runtime');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set(risks.map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (diligence.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(diligence.asOf || '')) failures.push('asOf must be an ISO date');
if (diligence.status !== 'public_due_diligence_complete_account_review_gated') failures.push('status must remain public_due_diligence_complete_account_review_gated');
if (typeof diligence.purpose !== 'string' || diligence.purpose.length < 50) failures.push('purpose is incomplete');
if (diligence.candidateId !== 'PE-001' || diligence.architectureClassRef !== 'PR-001') failures.push('candidate and architecture must remain PE-001 and PR-001');
const candidate = (providerEvaluation.candidates || []).find(item => item.id === 'PE-001');
if (!candidate || candidate.recommendedForNextReview !== true || candidate.providerSelected !== false) failures.push('PE-001 must remain the unselected A-037 next-review candidate');
if (!(protectedRuntime.architectureOptions || []).some(item => item.id === 'PR-001' && item.recommended === true)) failures.push('PR-001 must remain the recommended A-031 class');

exactSet(diligence.decisionRefs, ['D-014', 'D-017'], 'decisionRefs');
exactSet(diligence.riskRefs, ['R-007', 'R-008', 'R-011', 'R-012', 'R-013'], 'riskRefs');
exactSet(diligence.workflowRefs, ['A-011', 'A-016', 'A-023', 'A-030', 'A-031', 'A-035', 'A-036', 'A-037'], 'workflowRefs');
for (const id of diligence.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of diligence.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of diligence.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);

for (const field of [
    'providerSelectionAuthorized', 'accountReviewAuthorized', 'vendorAccountCreationAuthorized',
    'termsAcceptanceAuthorized', 'billingAttachmentAuthorized', 'credentialCreationAuthorized',
    'runtimeProvisioningAuthorized', 'schedulerActivationAuthorized', 'persistentStoreCreationAuthorized',
    'alertDeliveryAuthorized', 'externalActionAuthorized', 'spendAuthorized', 'conversationIsAuthorization'
]) if (diligence.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

for (const field of ['officialGoogleDocumentationOnly', 'accountEvidenceRequired', 'professionalPrivacySecurityFinanceReviewRequired']) if (diligence.sourcePolicy?.[field] !== true) failures.push(`sourcePolicy.${field} must be true`);
for (const field of ['publicCapabilityIsConfigurationEvidence', 'publicTermsAreAcceptedTerms', 'publishedPriceIsExactCompanyCost', 'absenceOfPublicBlockerIsApproval']) if (diligence.sourcePolicy?.[field] !== false) failures.push(`sourcePolicy.${field} must be false`);
if (diligence.sourcePolicy?.retrievedOn !== '2026-08-11') failures.push('sourcePolicy.retrievedOn must be current');

const requirementIds = (providerEvaluation.platformCapabilityRequirements || []).map(item => item.id);
exactSet(requirementIds, Array.from({ length: 12 }, (_, index) => `PC-${String(index + 1).padStart(3, '0')}`), 'provider requirement IDs');
const requirementSet = new Set(requirementIds);
const sources = diligence.sources || [];
if (sources.length !== 17) failures.push('exactly seventeen official source records are required');
const sourceIds = new Set();
for (const source of sources) {
    if (sourceIds.has(source.id)) failures.push(`duplicate source ${source.id}`);
    sourceIds.add(source.id);
    let url;
    try { url = new URL(source.url); } catch { failures.push(`${source.id || 'source'} has invalid URL`); }
    if (url && (url.protocol !== 'https:' || !['cloud.google.com', 'docs.cloud.google.com'].includes(url.hostname))) failures.push(`${source.id} must use official Google Cloud documentation`);
    for (const id of source.supports || []) if (!requirementSet.has(id)) failures.push(`${source.id} supports unknown requirement ${id}`);
}

const assessments = diligence.publicRequirementAssessments || [];
exactSet(assessments.map(item => item.requirementId), requirementIds, 'public requirement assessments');
const allowedStatuses = new Set(['documented_plausible', 'partial_public_evidence']);
for (const assessment of assessments) {
    if (!allowedStatuses.has(assessment.publicEvidenceStatus)) failures.push(`${assessment.requirementId} has invalid publicEvidenceStatus`);
    if (!Array.isArray(assessment.sourceRefs) || assessment.sourceRefs.length < 1) failures.push(`${assessment.requirementId} needs sourceRefs`);
    for (const sourceRef of assessment.sourceRefs || []) {
        const source = sources.find(item => item.id === sourceRef);
        if (!source || !(source.supports || []).includes(assessment.requirementId)) failures.push(`${assessment.requirementId} has unsupported sourceRef ${sourceRef}`);
    }
    if (typeof assessment.finding !== 'string' || assessment.finding.length < 50) failures.push(`${assessment.requirementId} finding is incomplete`);
    if (assessment.configurationVerified !== false || assessment.testEvidencePresent !== false) failures.push(`${assessment.requirementId} cannot claim configuration or test evidence`);
}
const documentedPlausibleRequirementCount = assessments.filter(item => item.publicEvidenceStatus === 'documented_plausible').length;
const partialPublicEvidenceRequirementCount = assessments.filter(item => item.publicEvidenceStatus === 'partial_public_evidence').length;

const region = diligence.regionalAndPrivacyReview || {};
if (region.irelandCloudRunRegionListed !== false || region.selectedRegion !== null) failures.push('no Irish region or selected region may be claimed');
const expectedRegions = ['europe-west1', 'europe-west4', 'europe-north1'];
exactSet((region.candidateEuropeanRegions || []).map(item => item.region), expectedRegions, 'candidate European regions');
if ((region.candidateEuropeanRegions || []).some(item => item.pricingTier !== 1)) failures.push('candidate European regions must remain Tier 1');
for (const field of ['jobAssociatedCustomerDataStoredInSelectedRegionDocumented', 'dpaDefinesGoogleAsProcessorWhenApplicable', 'processingOutsideSelectedRegionPossibleSubjectToTerms', 'subprocessorListReferencedByDpa']) if (region[field] !== true) failures.push(`regionalAndPrivacyReview.${field} must be true`);
for (const field of ['dpaAccepted', 'controllerRoleConfirmed', 'dataTransferAssessmentCompleted', 'privacyReviewCompleted', 'securityReviewCompleted']) if (region[field] !== false) failures.push(`regionalAndPrivacyReview.${field} must remain false`);

const cost = diligence.costReview || {};
if (cost.billingCurrency !== null || cost.exactAllInMonthlyCostMinorUnits !== null || cost.pricingVerifiedForSelectedRegion !== false || cost.companyCostClaimAvailable !== false) failures.push('company cost and currency must remain unknown');
for (const [field, expected] of Object.entries({ mythicalMaximumRunsPerDay: 4, mythicalMaximumRunSeconds: 120, assumedDaysForCeilingComparison: 30, mythicalCeilingMonthlyExecutions: 120, mythicalCeilingMaximumBilledMinutes: 240, officialComparatorExecutionsPerMonth: 730, officialComparatorMinutesPerExecution: 1, officialComparatorVcpu: 1, officialComparatorMemoryGiB: 0.5, officialComparatorEstimatedUsdWithFreeTier: 0, officialComparatorEstimatedUsdWithoutFreeTier: 0.45 })) if (cost[field] !== expected) failures.push(`costReview.${field} must be ${expected}`);
if (cost.officialComparatorRegion !== 'europe-west1' || cost.mythicalComputeExposureBelowOfficialComparator !== true || cost.otherServiceCostsIncludedInComparator !== false) failures.push('cost comparator boundary is invalid');
if (cost.spendCapFeatureStage !== 'preview' || cost.spendCapEligibleForCloudRunDocumented !== true) failures.push('spend-cap public evidence is invalid');
for (const field of ['spendCapInstantaneous', 'spendCapStopsInFlightCharges', 'spendCapStopsPersistentResourceCharges']) if (cost[field] !== false) failures.push(`costReview.${field} must remain false`);

const blueprint = diligence.disabledReferenceBlueprint || {};
if (blueprint.selected !== false || blueprint.configured !== false) failures.push('reference blueprint must remain unselected and unconfigured');
const components = blueprint.components || [];
exactSet(components.map(item => item.id), Array.from({ length: 12 }, (_, index) => `BP-${String(index + 1).padStart(3, '0')}`), 'blueprint component IDs');
for (const component of components) if (component.state !== 'planned_disabled' || typeof component.component !== 'string' || component.component.length < 20) failures.push(`${component.id || 'blueprint component'} must remain a complete disabled plan`);

const gates = diligence.accountAndHumanGates || [];
exactSet(gates.map(item => item.id), Array.from({ length: 14 }, (_, index) => `PE1-G${String(index + 1).padStart(2, '0')}`), 'account and human gate IDs');
for (const gate of gates) if (gate.satisfied !== false || typeof gate.gate !== 'string' || gate.gate.length < 30) failures.push(`${gate.id || 'gate'} must remain unsatisfied and complete`);

if (diligence.publicReviewOutcome !== 'conditional_pass_for_account_scoped_review_only' || diligence.publicBlockerCount !== 0) failures.push('public review outcome must remain a conditional next-review pass only');
if (diligence.documentedPlausibleRequirementCount !== documentedPlausibleRequirementCount || documentedPlausibleRequirementCount !== 7) failures.push('documented plausible requirement count must be 7');
if (diligence.partialPublicEvidenceRequirementCount !== partialPublicEvidenceRequirementCount || partialPublicEvidenceRequirementCount !== 5) failures.push('partial public evidence requirement count must be 5');
if (diligence.configurationVerifiedRequirementCount !== 0 || diligence.satisfiedAccountAndHumanGateCount !== 0) failures.push('configuration and human gate counts must remain zero');
for (const field of ['providerSelected', 'accountScopedReviewReady', 'deploymentReady', 'runtimePromotionEligible', 'externalActionAuthorized']) if (diligence[field] !== false) failures.push(`${field} must remain false`);
if (typeof diligence.nextDecision !== 'string' || diligence.nextDecision.length < 50 || !diligence.nextDecision.includes('does not authorize')) failures.push('nextDecision must preserve non-authority');

console.log(JSON.stringify({
    workflow: 'A-038',
    mode: 'official-public PE-001 due diligence; no account access, selection, provisioning, or spend',
    dueDiligenceValid: failures.length === 0,
    publicReviewOutcome: diligence.publicReviewOutcome,
    candidateId: diligence.candidateId,
    officialSourceCount: sources.length,
    platformRequirementCount: assessments.length,
    documentedPlausibleRequirementCount,
    partialPublicEvidenceRequirementCount,
    configurationVerifiedRequirementCount: assessments.filter(item => item.configurationVerified === true).length,
    publicBlockerCount: diligence.publicBlockerCount,
    irelandCloudRunRegionListed: region.irelandCloudRunRegionListed,
    candidateEuropeanRegionCount: (region.candidateEuropeanRegions || []).length,
    selectedRegionCount: region.selectedRegion === null ? 0 : 1,
    exactCompanyCostAvailable: cost.companyCostClaimAvailable,
    spendCapFeatureStage: cost.spendCapFeatureStage,
    disabledBlueprintComponentCount: components.length,
    satisfiedAccountAndHumanGateCount: gates.filter(item => item.satisfied === true).length,
    providerSelected: diligence.providerSelected,
    accountScopedReviewReady: diligence.accountScopedReviewReady,
    deploymentReady: diligence.deploymentReady,
    runtimePromotionEligible: diligence.runtimePromotionEligible,
    externalActionAuthorized: diligence.externalActionAuthorized,
    failures,
    nextAction: diligence.nextDecision
}, null, 2));

process.exit(failures.length ? 1 : 2);
