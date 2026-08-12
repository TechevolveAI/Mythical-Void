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
if (!Array.isArray(portfolio.journeyStages) || portfolio.journeyStages.length !== allowedStages.size) failures.push('all seven journey stages are required');

const stageIds = new Set();
for (const stage of portfolio.journeyStages || []) {
    if (!allowedStages.has(stage.id)) failures.push(`unknown journey stage ${stage.id}`);
    if (stageIds.has(stage.id)) failures.push(`duplicate journey stage ${stage.id}`);
    stageIds.add(stage.id);
    for (const field of ['outcome']) if (typeof stage[field] !== 'string' || !stage[field].trim()) failures.push(`${stage.id} lacks ${field}`);
    if (!Array.isArray(stage.prohibitedShortcuts) || stage.prohibitedShortcuts.length === 0) failures.push(`${stage.id} lacks prohibited shortcuts`);
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
