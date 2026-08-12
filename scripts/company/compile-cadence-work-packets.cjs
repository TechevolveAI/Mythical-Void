#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaults = [
    'docs/company/automation/operating-cadence.json',
    'docs/company/automation/registry.json',
    'docs/company/automation/agent-roster.json',
    'docs/company/automation/evaluation-catalog.json'
].map(file => path.join(repositoryRoot, file));
const inputPaths = defaults.map((fallback, index) => process.argv[index + 2] ? path.resolve(process.argv[index + 2]) : fallback);
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
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    return crypto.createHash('sha256').update(body).digest('hex');
}

function falseAuthorityPaths(value, trail = []) {
    const invalid = [];
    if (!value || typeof value !== 'object') return invalid;
    for (const [key, child] of Object.entries(value)) {
        const next = [...trail, key];
        if (typeof child === 'boolean' && child !== false) invalid.push(next.join('.'));
        else if (child && typeof child === 'object') invalid.push(...falseAuthorityPaths(child, next));
    }
    return invalid;
}

const cadence = load(inputPaths[0], 'Operating cadence');
const registry = load(inputPaths[1], 'Automation registry');
const roster = load(inputPaths[2], 'Agent roster');
const catalog = load(inputPaths[3], 'Evaluation catalog');
const sourceDigests = {
    cadenceSha256: digest(cadence),
    registrySha256: digest(registry),
    rosterSha256: digest(roster),
    evaluationCatalogSha256: digest(catalog)
};

if (cadence.status !== 'cadence_contract_ready_scheduler_gated') failures.push('cadence must remain in cadence_contract_ready_scheduler_gated state');
if (cadence.schedulerConfigured !== false || cadence.schedulerEnabled !== false) failures.push('cadence scheduler must remain unconfigured and disabled');
if (cadence.cadenceActivationReady !== false || cadence.runtimePromotionEligible !== false || cadence.externalActionAuthorized !== false) failures.push('cadence activation, promotion, and external authority must remain false');
for (const field of ['automatedDispatchAuthorized', 'externalActionAuthorized', 'repositoryWriteAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'spendAuthorized', 'conversationIsAuthorization']) {
    if (cadence.authority?.[field] !== false) failures.push(`cadence.authority.${field} must remain false`);
}
if (falseAuthorityPaths(roster.authority).length) failures.push(`roster authority contains true fields: ${falseAuthorityPaths(roster.authority).join(', ')}`);
if (roster.runtime?.schedulerConfigured !== false || roster.runtime?.separateExternalExecutorConfigured !== false) failures.push('roster scheduler and external executor must remain unconfigured');

const workflows = new Map((registry.workflows || []).map(workflow => [workflow.id, workflow]));
const evaluations = new Map((catalog.workflows || []).map(evaluation => [evaluation.workflowId, evaluation]));
const agents = new Map((roster.agents || []).map(agent => [agent.id, agent]));
const workflowAssignments = new Map();
for (const agent of roster.agents || []) {
    for (const workflowId of agent.primaryWorkflowIds || []) {
        const assigned = workflowAssignments.get(workflowId) || [];
        assigned.push(agent.id);
        workflowAssignments.set(workflowId, assigned);
    }
}

const expectedCalendarIds = ['OC-001', 'OC-002', 'OC-003', 'OC-004'];
const expectedTriggerIds = ['OT-001', 'OT-002', 'OT-003', 'OT-004'];
const calendar = cadence.calendarSchedules || [];
const triggers = cadence.eventTriggerPlans || [];
if (JSON.stringify(calendar.map(item => item.id)) !== JSON.stringify(expectedCalendarIds)) failures.push('calendar schedule IDs and order must remain OC-001 through OC-004');
if (JSON.stringify(triggers.map(item => item.id)) !== JSON.stringify(expectedTriggerIds)) failures.push('event trigger IDs and order must remain OT-001 through OT-004');

const packets = [];
let allCommandsAllowlisted = true;
let allImplementationsRegistered = true;
let allEvaluatorsBound = true;
let allResourceLimitsWithinCadenceEnvelope = true;

function compilePacket(source, sourceType) {
    const label = source?.id || `${sourceType}[unknown]`;
    const workflow = workflows.get(source?.workflowId);
    if (!workflow) {
        failures.push(`${label} references unknown workflow ${source?.workflowId}`);
        allImplementationsRegistered = false;
        return;
    }
    if (workflow.externalEffect !== false) failures.push(`${label} workflow externalEffect must remain false`);
    if (!['A0', 'A1'].includes(workflow.autonomy)) failures.push(`${label} workflow autonomy must be A0 or A1`);
    if (!Array.isArray(source.command) || source.command[0] !== workflow.implementation) {
        failures.push(`${label} command must start with the registered implementation`);
        allCommandsAllowlisted = false;
    }
    const implementationAbsolute = path.resolve(repositoryRoot, workflow.implementation || '');
    if (!implementationAbsolute.startsWith(path.join(repositoryRoot, 'scripts/company') + path.sep) || !fs.existsSync(implementationAbsolute)) {
        failures.push(`${label} registered implementation is missing or outside scripts/company`);
        allImplementationsRegistered = false;
    }

    const assigned = workflowAssignments.get(workflow.id) || [];
    if (assigned.length !== 1) failures.push(`${label} workflow must have exactly one primary agent; found ${assigned.length}`);
    const primaryAgentId = assigned.length === 1 ? assigned[0] : null;
    const evaluatorAgentId = primaryAgentId === 'AG-010' ? 'AG-001' : 'AG-010';
    if (!primaryAgentId || !agents.has(primaryAgentId) || !agents.has(evaluatorAgentId) || primaryAgentId === evaluatorAgentId) failures.push(`${label} lacks an independent registered primary/evaluator pair`);
    const primaryAgent = agents.get(primaryAgentId);
    if (primaryAgent) {
        for (const field of ['mayExecuteExternalActions', 'restrictedDataAccessAuthorized', 'mayMoveMoney', 'mayCreateOrExpandCredentials']) {
            if (primaryAgent[field] !== false) failures.push(`${label} primary agent ${primaryAgentId}.${field} must remain false`);
        }
    }

    const evaluation = evaluations.get(workflow.id);
    if (!evaluation) {
        failures.push(`${label} lacks an evaluation-catalog binding`);
        allEvaluatorsBound = false;
    } else {
        if (evaluation.implementationPath !== workflow.implementation) failures.push(`${label} evaluator implementation binding drifted`);
        if (evaluation.lastResult !== 'passed' || evaluation.separateEvaluatorScript !== true) failures.push(`${label} evaluator must have a current separate passing script`);
        for (const field of ['networkAccessPermitted', 'productionCredentialUsePermitted', 'externalMutationPermitted', 'promotionEligible', 'externalExecutionEligible']) {
            if (evaluation[field] !== false) failures.push(`${label} evaluation.${field} must remain false`);
        }
        const evaluatorAbsolute = path.resolve(repositoryRoot, evaluation.evaluatorPath || '');
        if (!evaluatorAbsolute.startsWith(path.join(repositoryRoot, 'scripts/company') + path.sep) || !fs.existsSync(evaluatorAbsolute)) {
            failures.push(`${label} evaluator script is missing or outside scripts/company`);
            allEvaluatorsBound = false;
        }
    }

    const isCalendar = sourceType === 'calendar_schedule';
    const expectedState = isCalendar ? 'planned_disabled' : 'planned_disabled_manual_review_required';
    if (source.state !== expectedState) failures.push(`${label} must remain ${expectedState}`);
    if (isCalendar && source.activationGateSatisfied !== false) failures.push(`${label} activationGateSatisfied must remain false`);
    if (!isCalendar && source.automaticInvocationPermitted !== false) failures.push(`${label} automaticInvocationPermitted must remain false`);

    const timeoutSeconds = source.timeoutSeconds;
    const retryCount = source.retryCount;
    const spendMinorUnits = source.spendMinorUnits;
    const declaredNetworkMode = source.networkMode;
    if (!['none', 'public_read_via_nested_A-001_only'].includes(declaredNetworkMode)) failures.push(`${label} has an unapproved declared network mode`);
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > cadence.resourceEnvelope?.maximumRunSeconds) {
        failures.push(`${label} timeout exceeds the cadence envelope`);
        allResourceLimitsWithinCadenceEnvelope = false;
    }
    if (retryCount !== 0 || spendMinorUnits !== 0) {
        failures.push(`${label} retries and spend must remain zero`);
        allResourceLimitsWithinCadenceEnvelope = false;
    }
    if (isCalendar && source.maximumRunsPerOccurrence !== 1) failures.push(`${label} maximumRunsPerOccurrence must remain 1`);
    for (const field of ['mayWrite', 'mayUseCredentials', 'mayCauseExternalAction']) if (source[field] !== false) failures.push(`${label}.${field} must remain false`);
    if (JSON.stringify(source.expectedExitCodes) !== JSON.stringify([0, 2])) failures.push(`${label} expectedExitCodes must remain [0,2]`);
    const inputBinding = isCalendar ? null : source.inputBinding;
    if (!isCalendar) {
        const protectedBinding = inputBinding?.kind === 'protected_prior_workflow_output';
        const noBinding = inputBinding?.kind === 'none';
        if (!protectedBinding && !noBinding) failures.push(`${label} has an unknown trigger input binding kind`);
        if (inputBinding?.bindingConfigured !== false) failures.push(`${label} trigger input binding must remain unconfigured`);
        if (protectedBinding) {
            if (inputBinding.sourceWorkflowId !== 'A-015' || inputBinding.sourceOutputDigestRequired !== true || inputBinding.protectedPayloadPathRequired !== true || !source.command.includes('{protected_trigger_payload_path}')) failures.push(`${label} protected trigger input binding is incomplete`);
        } else if (inputBinding?.sourceWorkflowId !== null || inputBinding?.sourceOutputDigestRequired !== false || inputBinding?.protectedPayloadPathRequired !== false || source.command.includes('{protected_trigger_payload_path}')) {
            failures.push(`${label} no-input trigger contains a protected payload binding`);
        }
    }

    const core = {
        schemaVersion: 1,
        sourceType,
        sourceId: source.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        primaryAgentId,
        evaluatorAgentId,
        implementationPath: workflow.implementation,
        evaluatorPath: evaluation?.evaluatorPath || null,
        command: source.command,
        status: isCalendar ? 'compiled_disabled' : 'compiled_disabled_manual_review_required',
        maxAutonomy: workflow.autonomy,
        dataZones: [...(workflow.dataZones || [])].sort(),
        declaredNetworkMode,
        expectedExitCodes: isCalendar ? source.expectedExitCodes : [0, 2],
        schedule: isCalendar ? source.recurrence : null,
        event: isCalendar ? null : source.event,
        inputBinding,
        constraints: {
            disabled: true,
            manualReviewRequired: !isCalendar,
            protectedTriggerInputBindingRequired: inputBinding?.kind === 'protected_prior_workflow_output',
            triggerInputBindingConfigured: inputBinding?.bindingConfigured === true,
            schedulerOrTriggerActivationAuthorized: false,
            protectedRuntimeRequired: true,
            protectedHistoryRequired: true,
            authenticatedAlertingRequired: true,
            independentEvaluationRequired: true,
            mayWrite: false,
            mayUseCredentials: false,
            mayCauseExternalAction: false,
            mayExpandScope: false,
            mayApproveOwnWork: false,
            timeoutSeconds,
            retryCount,
            maximumRunsPerOccurrence: 1,
            spendMinorUnits
        },
        idempotencyKeyTemplate: `${workflow.id}:v${workflow.version}:${source.id}:${sourceDigests.cadenceSha256}:{local_window}`,
        sourceDigests
    };
    const contentDigestSha256 = digest(core);
    packets.push({
        ...core,
        packetId: `CWP-${contentDigestSha256.slice(0, 16).toUpperCase()}`,
        contentDigestSha256
    });
}

calendar.forEach(item => compilePacket(item, 'calendar_schedule'));
triggers.forEach(item => compilePacket(item, 'event_trigger'));

const packetIds = new Set(packets.map(packet => packet.packetId));
const contentDigests = new Set(packets.map(packet => packet.contentDigestSha256));
if (packetIds.size !== packets.length) failures.push('compiled packet IDs must be unique');
if (contentDigests.size !== packets.length) failures.push('compiled packet content digests must be unique');
const allPacketsDisabled = packets.length === 8 && packets.every(packet => packet.constraints.disabled && packet.constraints.schedulerOrTriggerActivationAuthorized === false);
if (!allPacketsDisabled) failures.push('all eight packets must remain disabled and non-authorizing');
const allAuthorityFalse = cadence.externalActionAuthorized === false && cadence.schedulerEnabled === false && packets.every(packet =>
    packet.constraints.mayWrite === false &&
    packet.constraints.mayUseCredentials === false &&
    packet.constraints.mayCauseExternalAction === false &&
    packet.constraints.spendMinorUnits === 0
);
if (!allAuthorityFalse) failures.push('compiled packet authority must remain false');
const independentEvaluatorBindingCount = packets.filter(packet => packet.primaryAgentId && packet.evaluatorAgentId && packet.primaryAgentId !== packet.evaluatorAgentId && packet.evaluatorPath).length;
const packetSetValid = failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-042',
    mode: 'deterministic content-addressed compilation of disabled calendar and event-trigger work packets; no scheduling, triggering, dispatch, persistence, network activation, write, credential, spend, or external execution',
    packetSetValid,
    sourceDigests,
    calendarPacketCount: packets.filter(packet => packet.sourceType === 'calendar_schedule').length,
    eventTriggerPacketCount: packets.filter(packet => packet.sourceType === 'event_trigger').length,
    totalPacketCount: packets.length,
    uniquePacketIdCount: packetIds.size,
    uniqueContentDigestCount: contentDigests.size,
    primaryAgentCount: new Set(packets.map(packet => packet.primaryAgentId).filter(Boolean)).size,
    independentEvaluatorBindingCount,
    protectedInputBindingPacketCount: packets.filter(packet => packet.inputBinding?.kind === 'protected_prior_workflow_output').length,
    configuredInputBindingPacketCount: packets.filter(packet => packet.inputBinding?.bindingConfigured === true).length,
    allPacketsDisabled,
    allCommandsAllowlisted,
    allImplementationsRegistered,
    allEvaluatorsBound,
    allResourceLimitsWithinCadenceEnvelope,
    allAuthorityFalse,
    packetSetReadyForReview: packetSetValid,
    protectedDispatchReady: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    packets,
    failures,
    nextAction: 'Review these content-addressed packets with D-017 and OCI-001 through OCI-005. Do not dispatch them: first satisfy A-031 and A-041 identity, time, lease, history, alert, failure, kill, shadow-cycle, and promotion gates, then make a separate expiring activation decision.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
