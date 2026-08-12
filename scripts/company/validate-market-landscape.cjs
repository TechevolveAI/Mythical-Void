#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultLandscapePath = path.join(repositoryRoot, 'docs', 'company', 'research', 'market-landscape-2026-08-11.json');
const landscapePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultLandscapePath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const landscape = load(landscapePath, 'Market landscape');
const experiments = load(path.join(repositoryRoot, 'docs/company/growth/experiment-portfolio.json'), 'Experiment portfolio').experiments || [];
const proofs = load(path.join(repositoryRoot, 'docs/company/content/proof-library.json'), 'Proof library').proofs || [];
const customerEvidence = load(path.join(repositoryRoot, 'docs/company/customer/evidence.json'), 'Customer evidence');
const decisionsMarkdown = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');

const experimentIds = new Set(experiments.map(item => item.id));
const proofIds = new Set(proofs.map(item => item.id));
const decisionIds = new Set([...decisionsMarkdown.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
const expectedCategoryIds = Array.from({ length: 5 }, (_, index) => `MC-${String(index + 1).padStart(3, '0')}`);
const expectedSourceIds = Array.from({ length: 10 }, (_, index) => `MS-${String(index + 1).padStart(3, '0')}`);
const expectedReferenceIds = Array.from({ length: 10 }, (_, index) => `MR-${String(index + 1).padStart(3, '0')}`);
const expectedHypothesisIds = Array.from({ length: 6 }, (_, index) => `MH-${String(index + 1).padStart(3, '0')}`);

if (landscape.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(landscape.asOf || '')) failures.push('asOf must be an ISO date');
if (landscape.status !== 'directional_research_not_market_validation') failures.push('status must remain directional research, not market validation');
if (typeof landscape.scope !== 'string' || !landscape.scope.trim()) failures.push('scope is required');

for (const field of [
    'externalResearchWritesAuthorized',
    'outreachAuthorized',
    'accountCreationAuthorized',
    'positioningChangeAuthorized',
    'publicComparisonAuthorized',
    'pricingDecisionAuthorized',
    'behavioralTargetingAuthorized',
    'minorTargetingPermitted'
]) {
    if (landscape.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);
}
for (const field of [
    'marketSizingPermitted',
    'marketShareOrRankClaimsPermitted',
    'competitorRevenueClaimsPermitted',
    'generatedPersonasCountAsCustomers',
    'publicProductClaimsCountAsDemandEvidence'
]) {
    if (landscape.evidencePolicy?.[field] !== false) failures.push(`evidencePolicy.${field} must remain false`);
}
for (const field of ['sourceFactsAndMythicalInferencesMustBeSeparated', 'firstPartySourcesPreferred', 'recheckOnMaterialProductOrPricingChange']) {
    if (landscape.evidencePolicy?.[field] !== true) failures.push(`evidencePolicy.${field} must remain true`);
}
if (!Number.isInteger(landscape.evidencePolicy?.maximumRoutineSourceAgeDays) || landscape.evidencePolicy.maximumRoutineSourceAgeDays > 90) failures.push('maximumRoutineSourceAgeDays must be an integer no greater than 90');

const categoryIds = new Set();
for (const [index, category] of (landscape.categories || []).entries()) {
    const label = category?.id || `categories[${index}]`;
    if (!/^MC-\d{3}$/.test(category?.id || '')) failures.push(`${label} has invalid ID`);
    if (categoryIds.has(category?.id)) failures.push(`duplicate category ${category.id}`);
    categoryIds.add(category?.id);
    for (const field of ['name', 'question']) if (typeof category?.[field] !== 'string' || !category[field].trim()) failures.push(`${label} lacks ${field}`);
}
if (!Array.isArray(landscape.categories) || landscape.categories.length !== 5) failures.push('exactly five category lanes are required');
for (const id of expectedCategoryIds) if (!categoryIds.has(id)) failures.push(`missing category ${id}`);

const asOfTime = Date.parse(`${landscape.asOf}T00:00:00Z`);
const maxAgeMs = (landscape.evidencePolicy?.maximumRoutineSourceAgeDays || 0) * 86400000;
const sourceIds = new Set();
for (const [index, source] of (landscape.sources || []).entries()) {
    const label = source?.id || `sources[${index}]`;
    if (!/^MS-\d{3}$/.test(source?.id || '')) failures.push(`${label} has invalid ID`);
    if (sourceIds.has(source?.id)) failures.push(`duplicate source ${source.id}`);
    sourceIds.add(source?.id);
    if (typeof source?.name !== 'string' || !source.name.trim()) failures.push(`${label} lacks name`);
    let url;
    try { url = new URL(source?.url); } catch { failures.push(`${label} has invalid URL`); }
    if (url && url.protocol !== 'https:') failures.push(`${label} URL must use HTTPS`);
    if (source?.firstParty !== true) failures.push(`${label} must be a first-party source in this baseline`);
    if (source?.access !== 'public') failures.push(`${label}.access must be public`);
    const observedTime = Date.parse(`${source?.observedAt}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source?.observedAt || '') || Number.isNaN(observedTime)) failures.push(`${label} has invalid observedAt`);
    else if (observedTime > asOfTime || asOfTime - observedTime > maxAgeMs) failures.push(`${label} is future-dated or stale for the declared snapshot`);
}
if (!Array.isArray(landscape.sources) || landscape.sources.length !== 10) failures.push('exactly ten first-party sources are required in the initial snapshot');
for (const id of expectedSourceIds) if (!sourceIds.has(id)) failures.push(`missing source ${id}`);

const referenceIds = new Set();
for (const [index, reference] of (landscape.references || []).entries()) {
    const label = reference?.id || `references[${index}]`;
    if (!/^MR-\d{3}$/.test(reference?.id || '')) failures.push(`${label} has invalid ID`);
    if (referenceIds.has(reference?.id)) failures.push(`duplicate reference ${reference.id}`);
    referenceIds.add(reference?.id);
    for (const field of ['name', 'referenceType', 'mythicalInference']) if (typeof reference?.[field] !== 'string' || !reference[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(reference.categoryIds) || reference.categoryIds.length === 0) failures.push(`${label} lacks categoryIds`);
    for (const id of reference.categoryIds || []) if (!categoryIds.has(id)) failures.push(`${label} references unknown category ${id}`);
    if (!Array.isArray(reference.sourceIds) || reference.sourceIds.length === 0) failures.push(`${label} lacks sourceIds`);
    for (const id of reference.sourceIds || []) if (!sourceIds.has(id)) failures.push(`${label} references unknown source ${id}`);
    if (!Array.isArray(reference.observedFacts) || reference.observedFacts.length === 0) failures.push(`${label} lacks observed facts`);
    if (!Array.isArray(reference.unknowns) || reference.unknowns.length < 3) failures.push(`${label} must record at least three unknowns`);
    for (const field of ['estimatedUsers', 'revenue', 'marketShare', 'competitiveRank']) if (reference[field] !== null) failures.push(`${label}.${field} must remain null without a verified permitted source and policy change`);
}
if (!Array.isArray(landscape.references) || landscape.references.length !== 10) failures.push('exactly ten reference products/signals are required in the initial snapshot');
for (const id of expectedReferenceIds) if (!referenceIds.has(id)) failures.push(`missing reference ${id}`);

const hypothesisIds = new Set();
const hypothesisResults = [];
for (const [index, hypothesis] of (landscape.hypotheses || []).entries()) {
    const label = hypothesis?.id || `hypotheses[${index}]`;
    if (!/^MH-\d{3}$/.test(hypothesis?.id || '')) failures.push(`${label} has invalid ID`);
    if (hypothesisIds.has(hypothesis?.id)) failures.push(`duplicate hypothesis ${hypothesis.id}`);
    hypothesisIds.add(hypothesis?.id);
    if (hypothesis.status !== 'unvalidated') failures.push(`${label}.status must remain unvalidated until accepted customer/experiment evidence is recorded`);
    for (const field of ['title', 'statement', 'falsifier', 'decisionUse']) if (typeof hypothesis?.[field] !== 'string' || !hypothesis[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(hypothesis.sourceReferenceIds) || hypothesis.sourceReferenceIds.length === 0) failures.push(`${label} lacks sourceReferenceIds`);
    for (const id of hypothesis.sourceReferenceIds || []) if (!referenceIds.has(id)) failures.push(`${label} references unknown market reference ${id}`);
    if (!Array.isArray(hypothesis.experimentRefs) || hypothesis.experimentRefs.length === 0) failures.push(`${label} lacks experimentRefs`);
    for (const id of hypothesis.experimentRefs || []) if (!experimentIds.has(id)) failures.push(`${label} references unknown experiment ${id}`);
    if (!Array.isArray(hypothesis.proofIds)) failures.push(`${label}.proofIds must be an array`);
    for (const id of hypothesis.proofIds || []) if (!proofIds.has(id)) failures.push(`${label} references unknown proof ${id}`);
    if (!Array.isArray(hypothesis.decisionRefs) || hypothesis.decisionRefs.length === 0) failures.push(`${label} lacks decisionRefs`);
    for (const id of hypothesis.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`${label} references unknown decision ${id}`);
    hypothesisResults.push({ id: hypothesis.id, status: hypothesis.status, validated: false });
}
if (!Array.isArray(landscape.hypotheses) || landscape.hypotheses.length !== 6) failures.push('exactly six initial market hypotheses are required');
for (const id of expectedHypothesisIds) if (!hypothesisIds.has(id)) failures.push(`missing hypothesis ${id}`);

const watchIds = new Set();
for (const [index, signal] of (landscape.watchSignals || []).entries()) {
    const label = signal?.id || `watchSignals[${index}]`;
    if (!/^MW-\d{3}$/.test(signal?.id || '')) failures.push(`${label} has invalid ID`);
    if (watchIds.has(signal?.id)) failures.push(`duplicate watch signal ${signal.id}`);
    watchIds.add(signal?.id);
    for (const field of ['signal', 'cadence', 'action']) if (typeof signal?.[field] !== 'string' || !signal[field].trim()) failures.push(`${label} lacks ${field}`);
}
if (!Array.isArray(landscape.watchSignals) || landscape.watchSignals.length !== 5) failures.push('exactly five initial watch signals are required');

const recommendation = landscape.currentRecommendation || {};
if (recommendation.status !== 'working_hypothesis_not_approved_strategy') failures.push('currentRecommendation.status must remain a working hypothesis');
if (typeof recommendation.position !== 'string' || !recommendation.position.trim()) failures.push('currentRecommendation.position is required');
if (!Array.isArray(recommendation.messageOrder) || recommendation.messageOrder.length < 5) failures.push('currentRecommendation.messageOrder is incomplete');
if (!Array.isArray(recommendation.prohibitedClaims) || !['first', 'only', 'market_leading', 'every_creature_is_unique', 'fully_autonomous', 'sentient'].every(term => recommendation.prohibitedClaims.includes(term))) failures.push('currentRecommendation.prohibitedClaims is incomplete');
if (!Array.isArray(recommendation.requiredNextEvidence) || !['accepted adult and guardian research', 'PF-003', 'PF-004', 'PF-005'].every(term => recommendation.requiredNextEvidence.includes(term))) failures.push('currentRecommendation.requiredNextEvidence is incomplete');
if (recommendation.externalActionAllowed !== false) failures.push('currentRecommendation.externalActionAllowed must remain false');

const acceptedCustomerEvidenceCount = (customerEvidence.records || []).length;
const validatedHypothesisCount = hypothesisResults.filter(item => item.validated).length;
console.log(JSON.stringify({
    workflow: 'A-028',
    mode: 'read-only market and category intelligence assurance',
    marketLandscapeValid: failures.length === 0,
    categoryCount: categoryIds.size,
    sourceCount: sourceIds.size,
    firstPartySourceCount: (landscape.sources || []).filter(source => source.firstParty === true).length,
    referenceCount: referenceIds.size,
    hypothesisCount: hypothesisResults.length,
    validatedHypothesisCount,
    acceptedCustomerEvidenceCount,
    watchSignalCount: watchIds.size,
    marketSizingPermitted: false,
    marketShareOrRankClaimsPermitted: false,
    generatedPersonasCountAsCustomers: false,
    positioningChangeAuthorized: false,
    publicComparisonAuthorized: false,
    outreachAuthorized: false,
    externalResearchWritesAuthorized: false,
    minorTargetingPermitted: false,
    hypothesisResults,
    failures,
    nextAction: 'Use accepted adult/guardian research and authentic gameplay proof to falsify or support the six hypotheses; do not treat this public-source sample as demand, rank, market size, or strategy approval.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (validatedHypothesisCount === 0 || acceptedCustomerEvidenceCount === 0) process.exitCode = 2;

