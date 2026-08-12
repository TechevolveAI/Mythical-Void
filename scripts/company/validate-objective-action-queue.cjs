#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultQueuePath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'objectives.json');
const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultQueuePath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const queue = load(queuePath, 'Objective/action queue');
const risks = load(path.join(repositoryRoot, 'docs', 'company', 'operations', 'risks.json'), 'Risk register').risks || [];
const automation = load(path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json'), 'Automation registry').workflows || [];
const claims = load(path.join(repositoryRoot, 'docs', 'company', 'content', 'claims.json'), 'Claims registry').claims || [];
const proofs = load(path.join(repositoryRoot, 'docs', 'company', 'content', 'proof-library.json'), 'Proof registry').proofs || [];
const channels = load(path.join(repositoryRoot, 'docs', 'company', 'content', 'channels.json'), 'Channel registry').channels || [];
const experiments = load(path.join(repositoryRoot, 'docs', 'company', 'growth', 'experiment-portfolio.json'), 'Experiment portfolio').experiments || [];
const lifecyclePrograms = load(path.join(repositoryRoot, 'docs', 'company', 'engagement', 'lifecycle-programs.json'), 'Engagement lifecycle').programs || [];
const decisionText = fs.readFileSync(path.join(repositoryRoot, 'docs', 'company', 'registers', 'DECISIONS.md'), 'utf8');
const handoffText = fs.readFileSync(path.join(repositoryRoot, 'docs', 'company', 'handoffs', 'GAME_DEVELOPMENT_HANDOFFS.md'), 'utf8');

const knownRefs = new Set([
    ...risks.map(item => item.id),
    ...automation.map(item => item.id),
    ...claims.map(item => item.id),
    ...proofs.map(item => item.id),
    ...channels.map(item => item.id),
    ...experiments.map(item => item.id),
    ...lifecyclePrograms.map(item => item.id)
]);
for (const match of decisionText.matchAll(/\| (D-\d{3}) \|/g)) knownRefs.add(match[1]);
for (const match of handoffText.matchAll(/## (GDH-\d{3})/g)) knownRefs.add(match[1]);

if (queue.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (queue.status !== 'active_foundation') failures.push('status must be active_foundation');
if (queue.externalActionsAuthorized !== false) failures.push('externalActionsAuthorized must remain false');
if (!/^\d{4}-\d{2}-\d{2}$/.test(queue.planningDate || '')) failures.push('planningDate must be explicit');
if (!/^\d{4}-\d{2}-\d{2}$/.test(queue.horizonEnd || '')) failures.push('horizonEnd must be explicit');
if (!Array.isArray(queue.objectives) || queue.objectives.length === 0) failures.push('objectives must not be empty');

const objectiveIds = new Set();
const actionIds = new Set();
const actions = [];
for (const [objectiveIndex, objective] of (queue.objectives || []).entries()) {
    const objectiveLabel = objective?.id || `objectives[${objectiveIndex}]`;
    if (!/^O-\d{3}$/.test(objective?.id || '')) failures.push(`${objectiveLabel} has invalid ID`);
    if (objectiveIds.has(objective?.id)) failures.push(`duplicate objective ID ${objective.id}`);
    objectiveIds.add(objective?.id);
    if (!['P0', 'P1', 'P2'].includes(objective?.priority)) failures.push(`${objectiveLabel} has invalid priority`);
    for (const field of ['outcome', 'owner', 'measure', 'current', 'target', 'evidence']) {
        if (typeof objective?.[field] !== 'string' || !objective[field].trim()) failures.push(`${objectiveLabel} lacks ${field}`);
    }
    if (!Array.isArray(objective?.riskIds)) failures.push(`${objectiveLabel} riskIds must be an array`);
    for (const riskId of objective?.riskIds || []) {
        if (!knownRefs.has(riskId)) failures.push(`${objectiveLabel} references unknown risk ${riskId}`);
    }
    if (!Array.isArray(objective?.actions) || objective.actions.length === 0) failures.push(`${objectiveLabel} has no actions`);
    for (const [actionIndex, action] of (objective.actions || []).entries()) {
        const label = action?.id || `${objectiveLabel}.actions[${actionIndex}]`;
        if (!/^OA-\d{3}$/.test(action?.id || '')) failures.push(`${label} has invalid ID`);
        if (actionIds.has(action?.id)) failures.push(`duplicate action ID ${action.id}`);
        actionIds.add(action?.id);
        if (!['P0', 'P1', 'P2'].includes(action?.priority)) failures.push(`${label} has invalid priority`);
        if (!['agent_internal', 'kevin_decision', 'kevin_input', 'game_development_handoff', 'access_required', 'external_approval', 'professional_review'].includes(action?.mode)) failures.push(`${label} has invalid mode`);
        if (!['ready', 'gated', 'waiting', 'completed'].includes(action?.status)) failures.push(`${label} has invalid status`);
        if (typeof action?.action !== 'string' || !action.action.trim()) failures.push(`${label} lacks action`);
        if (typeof action?.owner !== 'string' || !action.owner.trim()) failures.push(`${label} lacks owner`);
        if (!Array.isArray(action?.referenceIds)) failures.push(`${label} referenceIds must be an array`);
        if (action?.externalActionAllowed !== false) failures.push(`${label} externalActionAllowed must be false`);
        if (action?.status === 'completed' && (typeof action.completionEvidence !== 'string' || !action.completionEvidence.trim())) failures.push(`${label} is completed without completionEvidence`);
        if (action?.status !== 'completed' && action?.completionEvidence !== null) failures.push(`${label} has completionEvidence before completion`);
        actions.push({ ...action, objectiveId: objective.id, objectiveOutcome: objective.outcome });
    }
}

for (const action of actions) knownRefs.add(action.id);
for (const action of actions) {
    for (const referenceId of action.referenceIds || []) {
        if (!knownRefs.has(referenceId)) failures.push(`${action.id} references unknown ID ${referenceId}`);
    }
}

const agentExecutableNow = actions.filter(action => action.mode === 'agent_internal' && action.status === 'ready');
const kevinQueue = actions.filter(action => ['kevin_decision', 'kevin_input'].includes(action.mode) && action.status !== 'completed');
const gameDevelopmentQueue = actions.filter(action => action.mode === 'game_development_handoff' && action.status !== 'completed');
const externallyGatedQueue = actions.filter(action => ['external_approval', 'access_required', 'professional_review'].includes(action.mode) && action.status !== 'completed');
const unownedP0 = actions.filter(action => action.priority === 'P0' && /unassigned|named /i.test(action.owner));
const completed = actions.filter(action => action.status === 'completed');

console.log(JSON.stringify({
    workflow: 'A-014',
    mode: 'internal objective and next-action control',
    queueValid: failures.length === 0,
    externalActionsAuthorized: false,
    planningDate: queue.planningDate,
    horizonEnd: queue.horizonEnd,
    objectiveCount: (queue.objectives || []).length,
    actionCount: actions.length,
    completedActionCount: completed.length,
    agentExecutableNow,
    kevinQueue,
    gameDevelopmentQueue,
    externallyGatedQueue,
    unownedP0,
    failures,
    nextBestAction: agentExecutableNow[0] || null
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (actions.some(action => action.status !== 'completed')) process.exitCode = 2;
