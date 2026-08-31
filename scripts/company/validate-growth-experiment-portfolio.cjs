#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPortfolioPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'experiment-portfolio.json');
const portfolioPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPortfolioPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const portfolio = load(portfolioPath, 'Growth experiment portfolio');
const claims = load(path.join(repositoryRoot, 'docs/company/content/claims.json'), 'Claims').claims || [];
const proofs = load(path.join(repositoryRoot, 'docs/company/content/proof-library.json'), 'Proofs').proofs || [];
const channels = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channels').channels || [];
const automations = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automations').workflows || [];
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risks').risks || [];
const eventContract = load(path.join(repositoryRoot, 'docs/company/measurement/event-contract.json'), 'Event contract');
const searchAudit = load(path.join(repositoryRoot, 'docs/company/search/search-visibility-audit-2026-08-27.json'), 'Search visibility audit');
const liveAudit = load(path.join(repositoryRoot, 'docs/company/growth/LIVE_DISCOVERY_TO_PLAY_AUDIT_2026-08-27.json'), 'Live first-impression audit');
const customerEvidence = load(path.join(repositoryRoot, 'docs/company/customer/evidence.json'), 'Customer evidence');
const firstFive = load(path.join(repositoryRoot, 'docs/company/research/first-five-playtest.json'), 'First Five');
const visualMoments = load(path.join(repositoryRoot, 'docs/company/content/visual-launch-moments.json'), 'Visual launch moments');
const scoreboard = fs.readFileSync(path.join(repositoryRoot, 'docs/company/growth/WHAT_WE_KNOW_ABOUT_GROWTH_2026-08-27.md'), 'utf8');
const scoreboardPlain = scoreboard.replace(/[*_`]/g, '').replace(/\s+/g, ' ');
const decisions = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');

const maps = {
    claimIds: new Map(claims.map(item => [item.id, item])),
    proofIds: new Map(proofs.map(item => [item.id, item])),
    channelIds: new Map(channels.map(item => [item.id, item])),
    automationRefs: new Map(automations.map(item => [item.id, item])),
    riskRefs: new Map(risks.map(item => [item.id, item]))
};
const decisionIds = new Set([...decisions.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
const eventNames = new Set((eventContract.events || []).map(event => event.name));
const allowedStages = new Set(['discover', 'understand', 'start', 'activate', 'deepen', 'return', 'share_and_advocate']);
const allowedStatuses = new Set(['gated_external_step', 'ready_not_recruiting', 'designed_disabled', 'running', 'completed', 'stopped']);
const allowedDataModes = new Set(['public_read_only', 'M3_moderated_deidentified', 'M1_identifier_free_aggregate']);

if (portfolio.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (portfolio.status !== 'foundation_gated') failures.push('status must remain foundation_gated');
for (const [field, expected] of [
    ['externalExperimentActionsAuthorized', false],
    ['behavioralTargetingPermitted', false],
    ['minorProfilingPermitted', false],
    ['rawPersonalDataInSharedPortfolioPermitted', false]
]) {
    if (portfolio[field] !== expected) failures.push(`${field} must remain false`);
}
if (portfolio.portfolioPolicy?.cadence !== 'evidence_and_milestone_led') failures.push('portfolio cadence must remain evidence and milestone led');
if (/\bcompanions?\b/i.test(JSON.stringify(portfolio))) failures.push('retired companion wording remains in the growth experiment portfolio');
const snapshot = portfolio.evidenceSnapshot || {};
const requiredSnapshotRefs = [
    'docs/company/search/search-visibility-audit-2026-08-27.json',
    'docs/company/growth/LIVE_DISCOVERY_TO_PLAY_AUDIT_2026-08-27.json',
    'docs/company/research/first-five-playtest.json',
    'docs/company/customer/evidence.json',
    'docs/company/content/visual-launch-moments.json'
];
if (JSON.stringify(snapshot.sourceRefs) !== JSON.stringify(requiredSnapshotRefs)) failures.push('growth evidence snapshot source list is missing or drifted');
if (snapshot.syntheticProductionChecksAreCustomerEvidence !== false) failures.push('synthetic production checks must not be called customer evidence');
if (snapshot.customerEvidenceCount !== (customerEvidence.records || []).length) failures.push('growth evidence snapshot customer count is stale');
if (snapshot.firstFiveSessionsCompleted !== firstFive.currentOutcome?.sessionsCompleted) failures.push('growth evidence snapshot First Five count is stale');
if (snapshot.approvedGameplayMoments !== visualMoments.approvalRule?.approvedMomentCount || snapshot.requiredGameplayMoments !== visualMoments.approvalRule?.requiredApprovedMoments) failures.push('growth evidence snapshot visual gate is stale');
const sampledResultsObserved = (searchAudit.sample?.queries || []).filter(item => item.mythicalResultObserved).length;
if (snapshot.sampledSearchResultsObserved !== sampledResultsObserved) failures.push('growth evidence snapshot search sample is stale');
if (!Array.isArray(snapshot.unknownsThatRemainUnknown) || snapshot.unknownsThatRemainUnknown.length < 5) failures.push('growth evidence snapshot must preserve the main unknowns');
if (typeof snapshot.singleNextDecision !== 'string' || !snapshot.singleNextDecision.includes('public GitHub Play doorway') || !snapshot.singleNextDecision.includes('Search Console') || !snapshot.singleNextDecision.includes('four authentic gameplay moments')) failures.push('growth evidence snapshot next decision is incomplete');
if (!Array.isArray(portfolio.journeyStages) || portfolio.journeyStages.length !== allowedStages.size) failures.push('all seven journey stages are required');

const expectedEvidenceStates = {
    discover: 'owned_pages_live_search_visibility_unproven',
    understand: 'owned_copy_ready_no_customer_comprehension_evidence',
    start: 'synthetic_production_path_verified_to_hatching_start',
    activate: 'hatching_start_verified_hatch_and_bond_unproven',
    deepen: 'product_claims_exist_customer_value_unproven',
    return: 'return_path_exists_visual_quality_failed',
    share_and_advocate: 'owned_share_routes_live_usage_unproven'
};

const stageIds = new Set();
for (const stage of portfolio.journeyStages || []) {
    if (!allowedStages.has(stage.id)) failures.push(`unknown journey stage ${stage.id}`);
    if (stageIds.has(stage.id)) failures.push(`duplicate journey stage ${stage.id}`);
    stageIds.add(stage.id);
    for (const field of ['outcome']) if (typeof stage[field] !== 'string' || !stage[field].trim()) failures.push(`${stage.id} lacks ${field}`);
    if (stage.evidenceState !== expectedEvidenceStates[stage.id]) failures.push(`${stage.id} evidence state is missing or stale`);
    if (!Array.isArray(stage.currentEvidence) || stage.currentEvidence.length === 0) failures.push(`${stage.id} lacks current evidence`);
    if (typeof stage.notYetProven !== 'string' || !stage.notYetProven.trim()) failures.push(`${stage.id} lacks an explicit evidence boundary`);
    if (!Array.isArray(stage.prohibitedShortcuts) || stage.prohibitedShortcuts.length === 0) failures.push(`${stage.id} lacks prohibited shortcuts`);
}
if (liveAudit.scope?.freshFirstTimeGame?.completedThrough !== 'hatching_started' || liveAudit.scope?.freshFirstTimeGame?.phoneChecked !== true) failures.push('growth start evidence no longer matches the live audit');
if (liveAudit.visualGate?.approvedMoments !== 0 || liveAudit.visualGate?.requiredMoments !== 4 || liveAudit.visualGate?.gameplayLedDistributionReady !== false) failures.push('growth visual boundary no longer matches the live audit');
for (const phrase of ['a working test is not a player', 'The honest scoreboard', 'A real click or tap began hatching', 'no accepted customer evidence', 'failed the human-facing visual review', 'does not require another Google Workspace subscription', 'adult-only First Five test', 'do they reach a creature moment they understand and want to continue?']) {
    if (!scoreboardPlain.includes(phrase)) failures.push(`plain-language growth scoreboard is missing: ${phrase}`);
}

const ids = new Set();
const results = [];
for (const [index, experiment] of (portfolio.experiments || []).entries()) {
    const label = experiment?.id || `experiments[${index}]`;
    if (!/^E-\d{3}$/.test(experiment?.id || '')) failures.push(`${label} has invalid ID`);
    if (ids.has(experiment?.id)) failures.push(`duplicate experiment ID ${experiment.id}`);
    ids.add(experiment?.id);
    if (!allowedStatuses.has(experiment?.status)) failures.push(`${label} has invalid status`);
    if (!allowedDataModes.has(experiment?.dataMode)) failures.push(`${label} has invalid dataMode`);
    for (const field of ['title', 'decisionServed', 'hypothesis', 'audience', 'intervention', 'comparison', 'primaryMeasure', 'minimumUsefulEvidence', 'owner', 'internalPreparationState', 'resultStatus']) {
        if (typeof experiment?.[field] !== 'string' || !experiment[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    for (const field of ['executionReady', 'recruitmentAuthorized', 'participantDataCollectionAuthorized', 'externalActionAllowed', 'behavioralTargetingPermitted', 'minorDirectOutreachPermitted', 'decisionReady']) {
        if (typeof experiment?.[field] !== 'boolean') failures.push(`${label}.${field} must be boolean`);
    }
    if (experiment.externalActionAllowed !== false) failures.push(`${label} externalActionAllowed must remain false`);
    if (experiment.behavioralTargetingPermitted !== false) failures.push(`${label} behavioral targeting is prohibited`);
    if (experiment.minorDirectOutreachPermitted !== false) failures.push(`${label} minor direct outreach is prohibited`);
    if (experiment.status === 'running' && (!experiment.executionReady || !experiment.externalActionAllowed)) failures.push(`${label} cannot run without readiness and explicit external authorization`);
    if (!Array.isArray(experiment.journeyStageIds) || experiment.journeyStageIds.length === 0) failures.push(`${label} lacks journey stages`);
    for (const id of experiment.journeyStageIds || []) if (!stageIds.has(id)) failures.push(`${label} references unknown journey stage ${id}`);
    if (!Array.isArray(experiment.guardrails) || experiment.guardrails.length < 3) failures.push(`${label} needs at least three guardrails`);

    for (const [field, map] of Object.entries(maps)) {
        if (!Array.isArray(experiment[field])) failures.push(`${label}.${field} must be an array`);
        for (const id of experiment[field] || []) if (!map.has(id)) failures.push(`${label} references unknown ${field} ${id}`);
    }
    if (!Array.isArray(experiment.decisionRefs)) failures.push(`${label}.decisionRefs must be an array`);
    for (const id of experiment.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`${label} references unknown decision ${id}`);
    if (!Array.isArray(experiment.eventNames)) failures.push(`${label}.eventNames must be an array`);
    for (const name of experiment.eventNames || []) if (!eventNames.has(name)) failures.push(`${label} references unknown event ${name}`);

    const unusableClaims = (experiment.claimIds || [])
        .map(id => maps.claimIds.get(id))
        .filter(claim => claim && ['restricted_recheck', 'restricted', 'internal_only', 'blocked_absolute'].includes(claim.status));
    if (unusableClaims.length) failures.push(`${label} includes non-experiment-ready claims ${unusableClaims.map(item => item.id).join(', ')}`);
    const missingProofs = (experiment.proofIds || [])
        .map(id => maps.proofIds.get(id))
        .filter(proof => proof && proof.status !== 'approved')
        .map(proof => proof.id);
    const unresolvedDecisions = (experiment.decisionRefs || []).filter(id => decisions.includes(`| ${id} | 2026-08-11 | Proposed |`));
    const measurementBlocked = experiment.dataMode === 'M1_identifier_free_aggregate' && (
        eventContract.collectionEnabled !== true ||
        !Object.values(eventContract.approvalGates || {}).every(value => value === true)
    );
    if (experiment.dataMode === 'M1_identifier_free_aggregate' && experiment.participantDataCollectionAuthorized) failures.push(`${label} cannot authorize M1 collection while the contract is disabled`);
    if (experiment.dataMode === 'M3_moderated_deidentified' && experiment.recruitmentAuthorized) failures.push(`${label} cannot authorize recruitment from this portfolio`);
    const executionReady = experiment.executionReady === true &&
        experiment.externalActionAllowed === true &&
        unresolvedDecisions.length === 0 && missingProofs.length === 0 && !measurementBlocked;
    if (experiment.executionReady && !executionReady) failures.push(`${label} claims execution readiness while dependencies remain gated`);
    const decisionReady = experiment.decisionReady === true && experiment.resultStatus === 'completed';
    if (experiment.decisionReady && !decisionReady) failures.push(`${label} claims decision readiness without a completed result`);

    results.push({
        id: experiment.id,
        status: experiment.status,
        executionReady,
        decisionReady,
        unresolvedDecisions,
        missingProofs,
        measurementBlocked,
        blockers: [
            ...(unresolvedDecisions.length ? ['decision_approval'] : []),
            ...(missingProofs.length ? ['approved_gameplay_proof'] : []),
            ...(measurementBlocked ? ['measurement_contract_disabled'] : []),
            ...(!experiment.externalActionAllowed ? ['external_action_not_authorized'] : []),
            ...(!experiment.recruitmentAuthorized && experiment.dataMode.startsWith('M3') ? ['recruitment_not_authorized'] : [])
        ]
    });
}

if (!Array.isArray(portfolio.experiments) || portfolio.experiments.length !== 4) failures.push('the initial portfolio must contain E-001 through E-004');
for (const id of ['E-001', 'E-002', 'E-003', 'E-004']) if (!ids.has(id)) failures.push(`portfolio is missing ${id}`);

const executableExperiments = results.filter(result => result.executionReady);
const decisionReadyExperiments = results.filter(result => result.decisionReady);
console.log(JSON.stringify({
    workflow: 'A-019',
    mode: 'internal growth experiment portfolio assurance',
    portfolioValid: failures.length === 0,
    externalExperimentActionsAuthorized: false,
    behavioralTargetingPermitted: false,
    experimentCount: results.length,
    executableExperimentCount: executableExperiments.length,
    decisionReadyExperimentCount: decisionReadyExperiments.length,
    eventCollectionEnabled: eventContract.collectionEnabled === true,
    results,
    failures,
    nextAction: 'Resolve the named human, release, proof, research, privacy, and measurement gates; do not optimize attention or activate experiments from this portfolio.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (executableExperiments.length === 0 || decisionReadyExperiments.length === 0) process.exitCode = 2;
