#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPlanPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'launch-readiness.json');
const planPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPlanPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const plan = load(planPath, 'Launch readiness plan');
const workflows = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry').workflows || [];
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const proofs = load(path.join(repositoryRoot, 'docs/company/content/proof-library.json'), 'Proof library').proofs || [];
const channelsSource = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channel registry');
const experiments = load(path.join(repositoryRoot, 'docs/company/growth/experiment-portfolio.json'), 'Experiment portfolio').experiments || [];
const opportunities = load(path.join(repositoryRoot, 'docs/company/commercial/opportunities.json'), 'Commercial opportunities').opportunities || [];
const currentState = load(path.join(repositoryRoot, 'docs/company/operations/current-state.json'), 'Current state');
const eventContract = load(path.join(repositoryRoot, 'docs/company/measurement/event-contract.json'), 'Measurement contract');
const financialModel = load(path.join(repositoryRoot, 'docs/company/finance/financial-model.json'), 'Financial model');
const customerEvidence = load(path.join(repositoryRoot, 'docs/company/customer/evidence.json'), 'Customer evidence');
const releaseManifest = load(path.join(repositoryRoot, 'docs/company/operations/release-manifests/DISCOVERY_SAFETY_2026-08-11.json'), 'Release manifest');
const decisionsMarkdown = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');

const maps = {
    workflowRefs: new Map(workflows.map(item => [item.id, item])),
    riskRefs: new Map(risks.map(item => [item.id, item])),
    proofIds: new Map(proofs.map(item => [item.id, item])),
    channelIds: new Map((channelsSource.channels || []).map(item => [item.id, item])),
    experimentRefs: new Map(experiments.map(item => [item.id, item])),
    opportunityRefs: new Map(opportunities.map(item => [item.id, item])),
    handoffRefs: new Map((currentState.handoffs || []).map(item => [item.id, item]))
};
const decisionIds = new Set([...decisionsMarkdown.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
const proposedDecisionIds = new Set([...decisionsMarkdown.matchAll(/\| (D-\d{3}) \| [^|]+ \| Proposed \|/g)].map(match => match[1]));
const expectedTrackIds = Array.from({ length: 8 }, (_, index) => `LT-${String(index + 1).padStart(3, '0')}`);
const expectedStageIds = Array.from({ length: 7 }, (_, index) => `LS-${String(index + 1).padStart(3, '0')}`);
const allowedTrackStatuses = new Set(['blocked', 'partially_ready', 'ready']);
const allowedStageStates = new Set(['active_constrained', 'gated', 'deferred', 'ready_for_scoped_approval']);

if (plan.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.asOf || '')) failures.push('asOf must be an ISO date');
if (plan.status !== 'foundation_gated') failures.push('status must remain foundation_gated');
if (plan.currentStageId !== 'LS-001') failures.push('currentStageId must remain LS-001 until a reviewed plan update records completed evidence');

const authorityFields = [
    'launchAuthorized',
    'deploymentAuthorized',
    'publicationAuthorized',
    'outreachAuthorized',
    'researchRecruitmentAuthorized',
    'dataCollectionAuthorized',
    'searchSubmissionAuthorized',
    'portalSubmissionAuthorized',
    'paidAcquisitionAuthorized',
    'monetizationExecutionAuthorized',
    'behavioralTargetingOfMinorsPermitted',
    'agentMayTreatConversationAsAuthorization'
];
for (const field of authorityFields) if (plan.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);
for (const [field, expected] of [
    ['minorDirectOutreachPermitted', false],
    ['simulatedAudienceEvidencePermitted', false],
    ['vanityMetricsMayAuthorizeScale', false],
    ['laterStageMayBypassEarlierRequiredStage', false]
]) {
    if (plan.principles?.[field] !== expected) failures.push(`principles.${field} must remain false`);
}
if (plan.principles?.primaryOutcome !== 'meaningful_play_trust_and_durable_learning') failures.push('primaryOutcome must remain meaningful play, trust, and durable learning');

function validateReferences(item, label) {
    for (const [field, map] of Object.entries(maps)) {
        if (!Array.isArray(item?.[field])) failures.push(`${label}.${field} must be an array`);
        for (const id of item?.[field] || []) if (!map.has(id)) failures.push(`${label} references unknown ${field} ${id}`);
    }
    if (!Array.isArray(item?.decisionRefs)) failures.push(`${label}.decisionRefs must be an array`);
    for (const id of item?.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`${label} references unknown decision ${id}`);
}

const trackIds = new Set();
const trackResults = [];
for (const [index, track] of (plan.tracks || []).entries()) {
    const label = track?.id || `tracks[${index}]`;
    if (!/^LT-\d{3}$/.test(track?.id || '')) failures.push(`${label} has invalid ID`);
    if (trackIds.has(track?.id)) failures.push(`duplicate track ${track.id}`);
    trackIds.add(track?.id);
    if (!allowedTrackStatuses.has(track?.status)) failures.push(`${label} has invalid status`);
    if (typeof track?.ready !== 'boolean') failures.push(`${label}.ready must be boolean`);
    for (const field of ['name', 'owner', 'exitEvidence']) if (typeof track?.[field] !== 'string' || !track[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(track?.blockers)) failures.push(`${label}.blockers must be an array`);
    validateReferences(track, label);

    const unresolvedDecisions = (track.decisionRefs || []).filter(id => proposedDecisionIds.has(id));
    const missingProofs = (track.proofIds || []).filter(id => maps.proofIds.get(id)?.status !== 'approved');
    const unreadyChannels = (track.channelIds || []).filter(id => {
        const channel = maps.channelIds.get(id);
        return channel && (channel.owner === 'Unassigned' || channel.measurementReady !== true || channel.moderationReady !== true);
    });
    const unreadyExperiments = (track.experimentRefs || []).filter(id => maps.experimentRefs.get(id)?.executionReady !== true);
    const unowned = /unassigned/i.test(track.owner || '');
    const declaredBlockers = track.blockers || [];
    const sourceBlockers = [
        ...unresolvedDecisions.map(id => `decision:${id}`),
        ...missingProofs.map(id => `proof:${id}`),
        ...unreadyChannels.map(id => `channel:${id}`),
        ...unreadyExperiments.map(id => `experiment:${id}`),
        ...(unowned ? ['owner:unassigned'] : [])
    ];
    const derivedReady = declaredBlockers.length === 0 && sourceBlockers.length === 0;
    if (track.ready && !derivedReady) failures.push(`${label} claims readiness while dependencies remain gated`);
    if (track.status === 'ready' && !track.ready) failures.push(`${label} status ready requires ready true`);
    trackResults.push({ id: track.id, ready: track.ready === true && derivedReady, blockers: [...declaredBlockers, ...sourceBlockers] });
}
if (!Array.isArray(plan.tracks) || plan.tracks.length !== 8) failures.push('exactly eight readiness tracks are required');
for (const id of expectedTrackIds) if (!trackIds.has(id)) failures.push(`missing readiness track ${id}`);

const trackResultMap = new Map(trackResults.map(item => [item.id, item]));
const stageIds = new Set();
const stageResults = [];
for (const [index, stage] of (plan.stages || []).entries()) {
    const label = stage?.id || `stages[${index}]`;
    if (!/^LS-\d{3}$/.test(stage?.id || '')) failures.push(`${label} has invalid ID`);
    if (stageIds.has(stage?.id)) failures.push(`duplicate stage ${stage.id}`);
    stageIds.add(stage?.id);
    if (stage.order !== index + 1) failures.push(`${label}.order must equal its one-based sequence position`);
    if (!allowedStageStates.has(stage.state)) failures.push(`${label} has invalid state`);
    for (const field of ['ready', 'authorized']) if (typeof stage?.[field] !== 'boolean') failures.push(`${label}.${field} must be boolean`);
    if (stage.authorized !== false) failures.push(`${label}.authorized must remain false`);
    for (const field of ['name', 'successEvidence']) if (typeof stage?.[field] !== 'string' || !stage[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(stage?.requiredTrackIds)) failures.push(`${label}.requiredTrackIds must be an array`);
    for (const id of stage.requiredTrackIds || []) if (!trackIds.has(id)) failures.push(`${label} references unknown required track ${id}`);
    if (!Array.isArray(stage?.requiredPriorStageIds)) failures.push(`${label}.requiredPriorStageIds must be an array`);
    for (const id of stage.requiredPriorStageIds || []) {
        const priorIndex = expectedStageIds.indexOf(id);
        if (priorIndex < 0) failures.push(`${label} references unknown prior stage ${id}`);
        else if (priorIndex >= index) failures.push(`${label} cannot depend on non-prior stage ${id}`);
    }
    if (!Array.isArray(stage?.blockers) || stage.blockers.length === 0) failures.push(`${label} must state its current boundary or blockers`);
    validateReferences(stage, label);

    const unresolvedDecisions = (stage.decisionRefs || []).filter(id => proposedDecisionIds.has(id));
    const missingProofs = (stage.proofIds || []).filter(id => maps.proofIds.get(id)?.status !== 'approved');
    const requiredTracksReady = (stage.requiredTrackIds || []).every(id => trackResultMap.get(id)?.ready === true);
    const requiredPriorStagesReady = (stage.requiredPriorStageIds || []).every(id => stageResults.find(result => result.id === id)?.ready === true);
    const derivedReady = stage.id === 'LS-001'
        ? true
        : requiredTracksReady && requiredPriorStagesReady && unresolvedDecisions.length === 0 && missingProofs.length === 0;
    if (stage.ready && !derivedReady) failures.push(`${label} claims readiness while required tracks, prior stages, decisions, or proof remain gated`);
    if (stage.id === 'LS-001' && stage.ready !== true) failures.push('LS-001 must represent the active constrained current state');
    if (stage.id !== 'LS-001' && stage.state === 'active_constrained') failures.push(`${label} cannot be active while LS-001 is current`);
    stageResults.push({
        id: stage.id,
        name: stage.name,
        ready: stage.ready === true && derivedReady,
        authorized: false,
        unresolvedDecisions,
        missingProofs,
        unreadyTrackIds: (stage.requiredTrackIds || []).filter(id => trackResultMap.get(id)?.ready !== true),
        blockers: stage.blockers || []
    });
}
if (!Array.isArray(plan.stages) || plan.stages.length !== 7) failures.push('exactly seven ordered launch stages are required');
for (const id of expectedStageIds) if (!stageIds.has(id)) failures.push(`missing launch stage ${id}`);

if (channelsSource.externalPublishingAuthorized !== false) failures.push('channel registry must keep external publishing unauthorized');
if (eventContract.collectionEnabled !== false) failures.push('measurement collection must remain disabled in the foundation');
if (financialModel.externalSpendAuthorized !== false) failures.push('financial model must keep external spend unauthorized');
if (releaseManifest.deploymentAuthorized !== false) failures.push('RM-001 deployment must remain unauthorized');
if ((customerEvidence.records || []).length !== 0) failures.push('customer evidence changed; review and update A-026 rather than silently treating it as launch-ready');

const advancedStageReadyCount = stageResults.filter(result => result.id !== 'LS-001' && result.ready).length;
const broadLaunchReady = stageResults.find(result => result.id === 'LS-006')?.ready === true;
const paidLaunchReady = stageResults.find(result => result.id === 'LS-007')?.ready === true;

console.log(JSON.stringify({
    workflow: 'A-026',
    mode: 'internal staged go-to-market and launch readiness assurance',
    launchPlanValid: failures.length === 0,
    currentStageId: plan.currentStageId,
    currentStageReady: stageResults.find(result => result.id === plan.currentStageId)?.ready === true,
    trackCount: trackResults.length,
    readyTrackCount: trackResults.filter(result => result.ready).length,
    stageCount: stageResults.length,
    advancedStageReadyCount,
    broadLaunchReady,
    paidLaunchReady,
    launchAuthorized: false,
    deploymentAuthorized: false,
    publicationAuthorized: false,
    outreachAuthorized: false,
    dataCollectionAuthorized: false,
    paidAcquisitionAuthorized: false,
    monetizationExecutionAuthorized: false,
    behavioralTargetingOfMinorsPermitted: false,
    acceptedCustomerEvidenceCount: (customerEvidence.records || []).length,
    gameplayProofApprovedCount: proofs.filter(proof => ['PF-003', 'PF-004', 'PF-005'].includes(proof.id) && proof.status === 'approved').length,
    measurementCollectionEnabled: eventContract.collectionEnabled === true,
    financialBaselineComplete: financialModel.financialBaselineComplete === true,
    releaseReady: releaseManifest.releaseReady === true,
    trackResults,
    stageResults,
    failures,
    nextAction: 'Resolve KDP-001 safeguarding ownership first, then prepare adult research, authentic gameplay proof, and the separately reviewed discovery release; no outward launch action is authorized.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (advancedStageReadyCount === 0 || !broadLaunchReady || !paidLaunchReady) process.exitCode = 2;

