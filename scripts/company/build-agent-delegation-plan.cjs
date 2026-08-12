#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const queuePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'operations', 'objectives.json');
const rosterPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(repositoryRoot, 'docs', 'company', 'automation', 'agent-roster.json');
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function digest(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const queue = load(queuePath, 'Objective queue');
const roster = load(rosterPath, 'Agent roster');
const registry = load(
    path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json'),
    'Automation registry'
);

if (queue.externalActionsAuthorized !== false) failures.push('objective queue externalActionsAuthorized must be false');
if (roster.authority?.externalActionsAuthorized !== false) failures.push('agent roster externalActionsAuthorized must be false');
if (roster.authority?.agentMayDelegateExternalExecution !== false) failures.push('agentMayDelegateExternalExecution must be false');
if (roster.runtime?.schedulerConfigured !== false) failures.push('schedulerConfigured must remain false for A-024 plan-only mode');
if (roster.runtime?.separateExternalExecutorConfigured !== false) failures.push('separateExternalExecutorConfigured must remain false');

const agents = new Map();
for (const agent of roster.agents || []) {
    if (agents.has(agent.id)) failures.push(`duplicate agent ${agent.id}`);
    agents.set(agent.id, agent);
    for (const field of ['mayApproveOwnWork', 'mayExecuteExternalActions', 'restrictedDataAccessAuthorized', 'mayMoveMoney', 'mayCreateOrExpandCredentials']) {
        if (agent[field] !== false) failures.push(`${agent.id}.${field} must remain false`);
    }
}
if (!agents.has('AG-001')) failures.push('AG-001 Company Orchestrator is required');
if (!agents.has('AG-010')) failures.push('AG-010 Governance and Assurance is required');

const workflows = new Map((registry.workflows || []).map(workflow => [workflow.id, workflow]));
const primaryAssignments = new Map();
for (const agent of roster.agents || []) {
    for (const workflowId of agent.primaryWorkflowIds || []) {
        const assigned = primaryAssignments.get(workflowId) || [];
        assigned.push(agent.id);
        primaryAssignments.set(workflowId, assigned);
    }
}
for (const workflowId of workflows.keys()) {
    const assigned = primaryAssignments.get(workflowId) || [];
    if (assigned.length !== 1) failures.push(`${workflowId} must have exactly one primary agent; found ${assigned.length}`);
}
for (const workflowId of primaryAssignments.keys()) if (!workflows.has(workflowId)) failures.push(`roster assigns unknown workflow ${workflowId}`);

const actions = [];
for (const objective of queue.objectives || []) {
    for (const action of objective.actions || []) actions.push({ objective, action });
}
const readyInternal = actions.filter(({ action }) => action.mode === 'agent_internal' && action.status === 'ready');
const workOrders = [];
const blockedReadyActions = [];

for (const { objective, action } of readyInternal) {
    if (action.externalActionAllowed !== false) {
        failures.push(`${action.id} is ready internal work but externalActionAllowed is not false`);
        continue;
    }
    const explicitAutomationRefs = (action.referenceIds || []).filter(id => /^A-\d{3}$/.test(id));
    const unknownAutomationRefs = explicitAutomationRefs.filter(id => !workflows.has(id));
    if (unknownAutomationRefs.length) {
        failures.push(`${action.id} references unknown automation ${unknownAutomationRefs.join(', ')}`);
        continue;
    }
    if (explicitAutomationRefs.length === 0) {
        blockedReadyActions.push({
            objectiveId: objective.id,
            actionId: action.id,
            reason: 'missing_registered_workflow_reference',
            nextAction: 'AG-001 decomposes the action and registers a bounded workflow reference before delegation.'
        });
        continue;
    }
    const assignedAgentIds = [...new Set(explicitAutomationRefs.flatMap(id => primaryAssignments.get(id) || []))];
    if (assignedAgentIds.length !== 1) {
        blockedReadyActions.push({
            objectiveId: objective.id,
            actionId: action.id,
            reason: 'multiple_primary_agents_require_decomposition',
            candidateAgentIds: assignedAgentIds,
            nextAction: 'AG-001 decomposes this into narrower registered actions with one primary agent each.'
        });
        continue;
    }
    const primaryAgentId = assignedAgentIds[0];
    const evaluatorAgentId = primaryAgentId === 'AG-010' ? 'AG-001' : 'AG-010';
    const primaryAgent = agents.get(primaryAgentId);
    const evaluatorAgent = agents.get(evaluatorAgentId);
    if (!primaryAgent || !evaluatorAgent || primaryAgentId === evaluatorAgentId) {
        failures.push(`${action.id} cannot establish an independent primary/evaluator pair`);
        continue;
    }
    const workflowRecords = explicitAutomationRefs.map(id => workflows.get(id));
    if (workflowRecords.some(workflow => workflow.externalEffect !== false)) {
        blockedReadyActions.push({
            objectiveId: objective.id,
            actionId: action.id,
            reason: 'referenced_workflow_has_external_effect',
            workflowIds: explicitAutomationRefs,
            nextAction: 'Use the applicable human approval and external-action control; A-024 cannot delegate it.'
        });
        continue;
    }
    if (workflowRecords.some(workflow => !['A0', 'A1'].includes(workflow.autonomy))) {
        failures.push(`${action.id} references workflow above A1`);
        continue;
    }
    const maxAutonomy = workflowRecords.some(workflow => workflow.autonomy === 'A1') ? 'A1' : 'A0';
    const dataZones = [...new Set(workflowRecords.flatMap(workflow => workflow.dataZones || []))].sort();
    const manualInvocationAuthorized = Boolean(
        primaryAgent.deploymentState === 'internal_manual' &&
        primaryAgent.ownerConfirmationRecorded === true
    );
    const payload = {
        schemaVersion: 1,
        objectiveId: objective.id,
        actionId: action.id,
        primaryAgentId,
        evaluatorAgentId,
        workflowIds: explicitAutomationRefs,
        status: 'draft_gated_runtime',
        priority: action.priority,
        purpose: objective.outcome,
        action: action.action,
        maxAutonomy,
        dataZones,
        sourceReferenceIds: [...new Set([objective.id, action.id, ...(action.referenceIds || [])])],
        constraints: {
            externalActionAllowed: false,
            automatedDispatchAuthorized: false,
            manualInvocationAuthorized,
            mayExpandScope: false,
            mayChangePriority: false,
            mayChangeDataZones: false,
            mayCreateCredentials: false,
            mayApproveOwnWork: false,
            mayCloseWithoutEvidence: false,
            spendMinorUnits: 0
        },
        completionEvidenceContract: [
            'Link the exact artifact or result and its content digest',
            'Record source provenance, freshness, workflow version, and data zones used',
            'Attach deterministic and independent evaluator results',
            'List unresolved uncertainty, exceptions, and prohibited actions checked',
            'Update the objective action only after evidence review'
        ]
    };
    const contentDigestSha256 = digest(payload);
    workOrders.push({
        ...payload,
        workOrderId: `WO-${contentDigestSha256.slice(0, 16).toUpperCase()}`,
        contentDigestSha256
    });
}

const nonReadyInternalCount = actions.filter(({ action }) => action.mode === 'agent_internal' && action.status !== 'ready').length;
const prohibitedModeReadyCount = actions.filter(({ action }) => action.mode !== 'agent_internal' && action.status === 'ready').length;
const manualInvocationReadyCount = workOrders.filter(order => order.constraints.manualInvocationAuthorized).length;
const automatedDispatchAuthorized = false;
const delegationReady = Boolean(
    failures.length === 0 &&
    workOrders.length > 0 &&
    blockedReadyActions.length === 0 &&
    manualInvocationReadyCount === workOrders.length
);

console.log(JSON.stringify({
    workflow: 'A-024',
    mode: 'internal delegation plan only; no scheduling or execution',
    planValid: failures.length === 0,
    delegationReady,
    externalActionsAuthorized: false,
    automatedDispatchAuthorized,
    objectiveCount: (queue.objectives || []).length,
    actionCount: actions.length,
    readyInternalActionCount: readyInternal.length,
    nonReadyInternalActionCount: nonReadyInternalCount,
    prohibitedModeReadyCount,
    workOrderCount: workOrders.length,
    manualInvocationReadyCount,
    blockedReadyActionCount: blockedReadyActions.length,
    workOrders,
    blockedReadyActions,
    failures,
    nextAction: readyInternal.length === 0
        ? 'No internal action is explicitly ready. Do not infer readiness; resolve the registered human, access, professional-review, or dependency gates.'
        : 'Review blocked/delegated work orders; automated dispatch remains unauthorized until the protected operating cell is promoted.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!delegationReady || !automatedDispatchAuthorized) process.exitCode = 2;

