#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultRosterPath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'agent-roster.json');
const rosterPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultRosterPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const roster = load(rosterPath, 'Agent roster');
const registry = load(
    path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json'),
    'Automation registry'
);

const expectedFunctions = [
    'company_orchestration',
    'strategy_market_intelligence',
    'growth_gtm',
    'brand_content',
    'social_media',
    'sales_partnerships',
    'customer_intelligence',
    'customer_engagement_support',
    'search_findability',
    'operations_vendor',
    'finance_monetization',
    'governance_safety',
    'product_release_liaison'
];

if (roster.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (roster.status !== 'foundation_fail_closed') failures.push('status must remain foundation_fail_closed until the protected runtime and owners are verified');
if (!/^\d{4}-\d{2}-\d{2}$/.test(roster.asOf || '')) failures.push('asOf must be an ISO date');

const requiredFunctions = new Set(roster.requiredFunctions || []);
for (const name of expectedFunctions) if (!requiredFunctions.has(name)) failures.push(`requiredFunctions lacks ${name}`);
for (const name of requiredFunctions) if (!expectedFunctions.includes(name)) failures.push(`requiredFunctions contains unknown function ${name}`);

const authorityFields = [
    'externalActionsAuthorized',
    'agentSelfPromotionPermitted',
    'agentPermissionExpansionPermitted',
    'agentMayTreatConversationAsApproval',
    'agentMayCloseActionWithoutEvidence',
    'agentMayOverridePolicy',
    'agentMayDelegateExternalExecution'
];
for (const field of authorityFields) if (roster.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

const runtimeFields = [
    'schedulerConfigured',
    'protectedMemoryStoreConfigured',
    'authenticatedAlertRouteConfigured',
    'trustedApprovalVerifierConfigured',
    'separateExternalExecutorConfigured',
    'productionServiceIdentitiesConfigured',
    'runHistoryStoreConfigured'
];
for (const field of runtimeFields) if (roster.runtime?.[field] !== false) failures.push(`runtime.${field} must remain false until verified outside the repository`);
if (!Array.isArray(roster.runtime?.connectedCredentialIds) || roster.runtime.connectedCredentialIds.length !== 0) {
    failures.push('runtime.connectedCredentialIds must remain empty');
}

if (roster.kevinInterface?.manualExceptionDigestAvailable !== true) failures.push('kevinInterface.manualExceptionDigestAvailable must be true');
if (roster.kevinInterface?.automatedExceptionDeliveryEnabled !== false) failures.push('kevinInterface.automatedExceptionDeliveryEnabled must remain false');
if (roster.kevinInterface?.immediateAlertRoute !== null) failures.push('kevinInterface.immediateAlertRoute must remain null until authenticated');
if (roster.kevinInterface?.conversationIsAuthorization !== false) failures.push('kevinInterface.conversationIsAuthorization must remain false');
if (!Number.isInteger(roster.kevinInterface?.maximumRoutineDecisionRequestsPerDigest) || roster.kevinInterface.maximumRoutineDecisionRequestsPerDigest > 5) {
    failures.push('kevinInterface.maximumRoutineDecisionRequestsPerDigest must be an integer no greater than 5');
}
const decisionPacketFields = new Set(roster.kevinInterface?.requiredDecisionPacketFields || []);
for (const field of ['decision', 'recommendation', 'why_now', 'evidence', 'options_and_tradeoffs', 'risk_if_deferred', 'scope_and_cost', 'approval_expiry', 'rollback_or_reversal']) {
    if (!decisionPacketFields.has(field)) failures.push(`kevinInterface.requiredDecisionPacketFields lacks ${field}`);
}

const agents = roster.agents || [];
const agentIds = new Set();
const coveredFunctions = new Set();
const workflowAssignments = new Map();
const autonomyRank = { A0: 0, A1: 1, A2: 2, A3: 3, A4: 4 };

for (const [index, agent] of agents.entries()) {
    const label = agent?.id || `agents[${index}]`;
    if (!/^AG-\d{3}$/.test(agent?.id || '')) failures.push(`${label} has invalid ID`);
    if (agentIds.has(agent?.id)) failures.push(`duplicate agent ${agent.id}`);
    agentIds.add(agent?.id);
    for (const field of ['name', 'mission', 'accountableHuman']) {
        if (typeof agent?.[field] !== 'string' || !agent[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    if (!['design_only', 'internal_manual'].includes(agent.deploymentState)) failures.push(`${label}.deploymentState must remain design_only or internal_manual`);
    if (agent.ownerConfirmationRecorded !== false) failures.push(`${label}.ownerConfirmationRecorded must remain false until evidenced`);
    if (agent.backupHuman !== null) failures.push(`${label}.backupHuman must remain null until confirmed`);
    if (!(agent.maxAutonomy in autonomyRank) || autonomyRank[agent.maxAutonomy] > autonomyRank.A1) failures.push(`${label}.maxAutonomy cannot exceed A1 in the foundation`);
    if (!Array.isArray(agent.functions) || agent.functions.length === 0) failures.push(`${label}.functions must be non-empty`);
    for (const name of agent.functions || []) {
        coveredFunctions.add(name);
        if (!requiredFunctions.has(name)) failures.push(`${label} covers unknown function ${name}`);
    }
    if (!Array.isArray(agent.primaryWorkflowIds) || agent.primaryWorkflowIds.length === 0) failures.push(`${label}.primaryWorkflowIds must be non-empty`);
    for (const workflowId of agent.primaryWorkflowIds || []) {
        const existing = workflowAssignments.get(workflowId) || [];
        existing.push(agent.id);
        workflowAssignments.set(workflowId, existing);
    }
    if (!Array.isArray(agent.dataZones) || agent.dataZones.some(zone => !['Z0', 'Z1', 'Z2', 'Z3'].includes(zone))) failures.push(`${label}.dataZones is invalid`);
    for (const field of ['mayApproveOwnWork', 'mayExecuteExternalActions', 'restrictedDataAccessAuthorized', 'mayMoveMoney', 'mayCreateOrExpandCredentials']) {
        if (agent[field] !== false) failures.push(`${label}.${field} must remain false`);
    }
    if (typeof agent.mayDelegateInternalTasks !== 'boolean') failures.push(`${label}.mayDelegateInternalTasks must be boolean`);
    for (const field of ['allowedActions', 'prohibitedActions', 'escalations', 'successSignals']) {
        if (!Array.isArray(agent[field]) || agent[field].length < (field === 'prohibitedActions' ? 4 : 2)) failures.push(`${label}.${field} is incomplete`);
    }
}

for (const name of requiredFunctions) if (!coveredFunctions.has(name)) failures.push(`no agent covers required function ${name}`);

const registeredWorkflowIds = new Set((registry.workflows || []).map(item => item.id));
const unassignedWorkflowIds = [];
const duplicateWorkflowIds = [];
for (const id of registeredWorkflowIds) {
    const assigned = workflowAssignments.get(id) || [];
    if (assigned.length === 0) unassignedWorkflowIds.push(id);
    if (assigned.length > 1) duplicateWorkflowIds.push(id);
}
for (const id of workflowAssignments.keys()) if (!registeredWorkflowIds.has(id)) failures.push(`agent roster references unknown workflow ${id}`);
if (unassignedWorkflowIds.length) failures.push(`unassigned registered workflows: ${unassignedWorkflowIds.join(', ')}`);
if (duplicateWorkflowIds.length) failures.push(`workflows with multiple primary agents: ${duplicateWorkflowIds.join(', ')}`);

let separationOfDutiesValid = true;
for (const [index, rule] of (roster.separationOfDuties || []).entries()) {
    const label = rule?.domain || `separationOfDuties[${index}]`;
    if (!agentIds.has(rule?.producerAgentId)) {
        failures.push(`${label} has unknown producerAgentId`);
        separationOfDutiesValid = false;
    }
    if (!agentIds.has(rule?.evaluatorAgentId)) {
        failures.push(`${label} has unknown evaluatorAgentId`);
        separationOfDutiesValid = false;
    }
    if (rule?.producerAgentId === rule?.evaluatorAgentId) {
        failures.push(`${label} producer and evaluator must differ`);
        separationOfDutiesValid = false;
    }
    if (typeof rule?.humanApprover !== 'string' || !rule.humanApprover.trim()) {
        failures.push(`${label} lacks humanApprover`);
        separationOfDutiesValid = false;
    }
}
if (!Array.isArray(roster.separationOfDuties) || roster.separationOfDuties.length < 6) {
    failures.push('separationOfDuties must cover at least six consequential domains');
    separationOfDutiesValid = false;
}

const ownerConfirmedCount = agents.filter(agent => agent.ownerConfirmationRecorded).length;
const backupAssignedCount = agents.filter(agent => typeof agent.backupHuman === 'string' && agent.backupHuman.trim()).length;
const boundedRuntimeAgentCount = agents.filter(agent => agent.deploymentState === 'bounded_runtime').length;
const operatingModelReady = Boolean(
    failures.length === 0 &&
    roster.status === 'active' &&
    ownerConfirmedCount === agents.length &&
    backupAssignedCount === agents.length &&
    boundedRuntimeAgentCount > 0 &&
    runtimeFields.every(field => roster.runtime?.[field] === true) &&
    roster.kevinInterface?.automatedExceptionDeliveryEnabled === true &&
    roster.kevinInterface?.immediateAlertRoute
);

console.log(JSON.stringify({
    workflow: 'A-023',
    mode: 'internal autonomous-company roster and delegation assurance',
    rosterValid: failures.length === 0,
    operatingModelReady,
    agentCount: agents.length,
    internalManualAgentCount: agents.filter(agent => agent.deploymentState === 'internal_manual').length,
    designOnlyAgentCount: agents.filter(agent => agent.deploymentState === 'design_only').length,
    boundedRuntimeAgentCount,
    requiredFunctionCount: requiredFunctions.size,
    coveredFunctionCount: [...requiredFunctions].filter(name => coveredFunctions.has(name)).length,
    registeredWorkflowCount: registeredWorkflowIds.size,
    assignedWorkflowCount: [...registeredWorkflowIds].filter(id => (workflowAssignments.get(id) || []).length === 1).length,
    unassignedWorkflowCount: unassignedWorkflowIds.length,
    duplicateAssignmentCount: duplicateWorkflowIds.length,
    ownerConfirmedCount,
    backupAssignedCount,
    separationOfDutiesValid,
    schedulerConfigured: false,
    protectedMemoryStoreConfigured: false,
    authenticatedAlertRouteConfigured: false,
    trustedApprovalVerifierConfigured: false,
    productionServiceIdentitiesConfigured: false,
    externalActionsAuthorized: false,
    failures,
    nextAction: 'Confirm the first operating-cell owner and backup, then select protected run history, authenticated alert delivery, bounded scheduling, service identities, and kill-switch controls before any runtime promotion.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!operatingModelReady) process.exitCode = 2;

