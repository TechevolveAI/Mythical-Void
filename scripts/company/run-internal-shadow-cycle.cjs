#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'shadow-runtime.json');
const contractPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultContractPath;
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
    const input = typeof value === 'string' ? value : JSON.stringify(value);
    return crypto.createHash('sha256').update(input).digest('hex');
}

function listFiles(directory) {
    const found = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) found.push(...listFiles(absolute));
        else if (entry.isFile()) found.push(absolute);
    }
    return found;
}

function repositorySnapshot() {
    const roots = [path.join(repositoryRoot, 'docs', 'company'), path.join(repositoryRoot, 'scripts', 'company')];
    const snapshot = new Map();
    for (const root of roots) {
        for (const file of listFiles(root)) {
            const relative = path.relative(repositoryRoot, file);
            snapshot.set(relative, digest(fs.readFileSync(file)));
        }
    }
    return snapshot;
}

function compareSnapshots(before, after) {
    const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
    return paths.filter(file => before.get(file) !== after.get(file));
}

function trueAuthorityPaths(value, trail = []) {
    const found = [];
    if (!value || typeof value !== 'object') return found;
    if (Array.isArray(value)) {
        value.forEach((child, index) => found.push(...trueAuthorityPaths(child, [...trail, String(index)])));
        return found;
    }
    for (const [key, child] of Object.entries(value)) {
        const nextTrail = [...trail, key];
        if (child === true && /(external.*authori|authori.*external|deploymentAuthorized|publicationAuthorized|outreachAuthorized|collectionAuthorized|spendAuthorized|paidAcquisitionAuthorized|automatedDispatchAuthorized)/i.test(key)) {
            found.push(nextTrail.join('.'));
        }
        found.push(...trueAuthorityPaths(child, nextTrail));
    }
    return found;
}

const contract = load(contractPath, 'Shadow-runtime contract');
const registry = load(path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json'), 'Automation registry');
const roster = load(path.join(repositoryRoot, 'docs', 'company', 'automation', 'agent-roster.json'), 'Agent roster');
const workflows = new Map((registry.workflows || []).map(workflow => [workflow.id, workflow]));
const agents = new Map((roster.agents || []).map(agent => [agent.id, agent]));
const primaryAssignments = new Map();
for (const agent of roster.agents || []) {
    for (const workflowId of agent.primaryWorkflowIds || []) {
        const assignments = primaryAssignments.get(workflowId) || [];
        assignments.push(agent.id);
        primaryAssignments.set(workflowId, assignments);
    }
}

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'local_single_process_rehearsal') failures.push('status must remain local_single_process_rehearsal');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 30) failures.push('purpose is incomplete');

for (const field of [
    'automatedDispatchAuthorized',
    'manualWorkExecutionAuthorized',
    'externalActionAuthorized',
    'repositoryWriteAuthorized',
    'credentialUseAuthorized',
    'restrictedDataAccessAuthorized',
    'spendAuthorized',
    'conversationIsAuthorization'
]) if (contract.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

if (contract.runtime?.singleProcessRehearsal !== true) failures.push('runtime.singleProcessRehearsal must be true');
for (const field of [
    'schedulerConfigured',
    'isolatedServiceIdentitiesConfigured',
    'protectedHistoryStoreConfigured',
    'authenticatedAlertRouteConfigured',
    'trustedApprovalVerifierConfigured',
    'killSwitchExercisePassed',
    'cycleRecordPersistenceEnabled'
]) if (contract.runtime?.[field] !== false) failures.push(`runtime.${field} must remain false in local rehearsal mode`);
if (!Array.isArray(contract.runtime?.connectedCredentialIds) || contract.runtime.connectedCredentialIds.length !== 0) failures.push('runtime.connectedCredentialIds must remain empty');
if (!Number.isInteger(contract.runtime?.commandTimeoutMs) || contract.runtime.commandTimeoutMs < 1000 || contract.runtime.commandTimeoutMs > 60000) failures.push('runtime.commandTimeoutMs must be between 1000 and 60000');
if (!Number.isInteger(contract.runtime?.maximumSteps) || contract.runtime.maximumSteps < 1 || contract.runtime.maximumSteps > 10) failures.push('runtime.maximumSteps must be between 1 and 10');

const orchestratorId = contract.roles?.orchestratorAgentId;
const assuranceId = contract.roles?.assuranceAgentId;
if (orchestratorId !== 'AG-001' || !agents.has(orchestratorId)) failures.push('roles.orchestratorAgentId must be registered AG-001');
if (assuranceId !== 'AG-010' || !agents.has(assuranceId)) failures.push('roles.assuranceAgentId must be registered AG-010');
if (orchestratorId === assuranceId) failures.push('orchestrator and assurance agents must differ');
if (contract.roles?.accountableHuman !== 'Kevin Murphy') failures.push('roles.accountableHuman must remain explicit');
if (contract.roles?.ownerConfirmationRecorded !== false) failures.push('roles.ownerConfirmationRecorded must remain false until Kevin confirms it');
if (contract.roles?.backupHuman !== null || contract.roles?.urgentExceptionRecipient !== null) failures.push('backupHuman and urgentExceptionRecipient must remain null until confirmed');

const steps = contract.steps || [];
if (!Array.isArray(contract.steps) || steps.length < 1 || steps.length > (contract.runtime?.maximumSteps || 0)) failures.push('steps must fit the configured non-zero maximum');
const stepIds = new Set();
const stepWorkflowIds = new Set();
for (const [index, step] of steps.entries()) {
    const label = step?.id || `steps[${index}]`;
    if (!/^SH-\d{3}$/.test(step?.id || '')) failures.push(`${label} has invalid ID`);
    if (stepIds.has(step?.id)) failures.push(`duplicate step ID ${step.id}`);
    stepIds.add(step?.id);
    if (stepWorkflowIds.has(step?.workflowId)) failures.push(`duplicate step workflow ${step.workflowId}`);
    stepWorkflowIds.add(step?.workflowId);
    const workflow = workflows.get(step?.workflowId);
    if (!workflow) {
        failures.push(`${label} references unknown workflow ${step?.workflowId}`);
        continue;
    }
    if (workflow.externalEffect !== false) failures.push(`${label} workflow must have externalEffect false`);
    if (!['A0', 'A1'].includes(workflow.autonomy)) failures.push(`${label} workflow must be A0 or A1`);
    if (workflow.implementation !== step.command) failures.push(`${label} command must exactly match the registered workflow implementation`);
    const absoluteCommand = path.resolve(repositoryRoot, step.command || '');
    const allowedRoot = path.join(repositoryRoot, 'scripts', 'company') + path.sep;
    if (!absoluteCommand.startsWith(allowedRoot) || !fs.existsSync(absoluteCommand)) failures.push(`${label} command must resolve to an existing company script`);
    const assignments = primaryAssignments.get(step.workflowId) || [];
    if (assignments.length !== 1 || assignments[0] !== step.primaryAgentId) failures.push(`${label} primary agent does not match the exact roster assignment`);
    const expectedEvaluatorId = step.primaryAgentId === assuranceId ? orchestratorId : assuranceId;
    if (step.evaluatorAgentId !== expectedEvaluatorId || step.evaluatorAgentId === step.primaryAgentId) failures.push(`${label} lacks the designed independent evaluator`);
    if (!agents.has(step.primaryAgentId) || !agents.has(step.evaluatorAgentId)) failures.push(`${label} references an unknown agent`);
    if (!Array.isArray(step.expectedExitCodes) || step.expectedExitCodes.length !== 2 || step.expectedExitCodes[0] !== 0 || step.expectedExitCodes[1] !== 2) failures.push(`${label}.expectedExitCodes must be [0, 2]`);
    if (step.output !== 'json') failures.push(`${label}.output must be json`);
    for (const field of ['mayWrite', 'mayUseCredentials', 'mayReadRestrictedData', 'mayCauseExternalAction']) if (step[field] !== false) failures.push(`${label}.${field} must be false`);
}

for (const [field, expected] of Object.entries({
    persistRecord: false,
    includeRawStepOutput: false,
    includeSensitivePayload: false,
    includeSecrets: false,
    retainCommandOutputDigest: true,
    retainCompactOutcome: true
})) if (contract.recordPolicy?.[field] !== expected) failures.push(`recordPolicy.${field} must be ${expected}`);

if (contract.promotionEvidence?.minimumEligibleShadowCycles !== 4) failures.push('promotionEvidence.minimumEligibleShadowCycles must be 4');
if (contract.promotionEvidence?.eligibleShadowCycleCount !== 0) failures.push('promotionEvidence.eligibleShadowCycleCount must remain 0 for local rehearsal');
for (const field of [
    'namedOwnerAndBackupReady',
    'identitySeparationProven',
    'protectedHistoryAndAlertingProven',
    'killSwitchAndRecoveryProven',
    'humanRoutingComparisonApproved',
    'promotionAuthorized'
]) if (contract.promotionEvidence?.[field] !== false) failures.push(`promotionEvidence.${field} must remain false`);

const contractValid = failures.length === 0;
const before = contractValid ? repositorySnapshot() : new Map();
const stepResults = [];

if (contractValid) {
    for (const step of steps) {
        const result = spawnSync(process.execPath, [path.resolve(repositoryRoot, step.command)], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            timeout: contract.runtime.commandTimeoutMs,
            maxBuffer: 5 * 1024 * 1024
        });
        const exitCode = typeof result.status === 'number' ? result.status : 1;
        let parsed = null;
        let parseError = null;
        try {
            parsed = JSON.parse(result.stdout || '');
        } catch (error) {
            parseError = error.message;
        }
        const authorityPaths = parsed ? trueAuthorityPaths(parsed) : [];
        const stepFailures = [];
        if (result.error) stepFailures.push(result.error.message);
        if (!step.expectedExitCodes.includes(exitCode)) stepFailures.push(`unexpected exit ${exitCode}`);
        if (!parsed) stepFailures.push(`invalid JSON output${parseError ? `: ${parseError}` : ''}`);
        if (parsed?.workflow !== step.workflowId) stepFailures.push(`reported workflow ${parsed?.workflow || 'missing'} does not match ${step.workflowId}`);
        if (authorityPaths.length) stepFailures.push(`true external authority fields: ${authorityPaths.join(', ')}`);
        stepResults.push({
            stepId: step.id,
            workflowId: step.workflowId,
            primaryAgentId: step.primaryAgentId,
            evaluatorAgentId: step.evaluatorAgentId,
            exitCode,
            state: stepFailures.length ? 'broken' : exitCode === 2 ? 'gated' : 'passed',
            outputDigestSha256: digest(result.stdout || ''),
            reportedWorkflow: parsed?.workflow || null,
            reportedFailureCount: Array.isArray(parsed?.failures) ? parsed.failures.length : null,
            stepFailureCount: stepFailures.length,
            stepFailures
        });
    }
}

const after = contractValid ? repositorySnapshot() : new Map();
const mutatedRepositoryPaths = contractValid ? compareSnapshots(before, after) : [];
if (mutatedRepositoryPaths.length) failures.push(`rehearsal mutated company repository paths: ${mutatedRepositoryPaths.join(', ')}`);
if (stepResults.some(result => result.state === 'broken')) failures.push('one or more rehearsal steps failed assurance');

const compactCycle = {
    schemaVersion: 1,
    contractDigestSha256: digest(contract),
    stepResults,
    workspaceMutationCount: mutatedRepositoryPaths.length,
    designedProducerEvaluatorSeparation: steps.every(step => step.primaryAgentId !== step.evaluatorAgentId),
    runtimeIdentitySeparationProven: false,
    singleProcessRehearsal: true,
    recordPersisted: false,
    eligiblePromotionCycle: false,
    externalActionAuthorized: false
};
const cycleDigestSha256 = digest(compactCycle);
const rehearsalCompleted = contractValid && failures.length === 0 && stepResults.length === steps.length;

console.log(JSON.stringify({
    workflow: 'A-030',
    mode: 'local single-process internal shadow rehearsal; no dispatch or writes',
    contractValid,
    rehearsalCompleted,
    cycleId: `SHADOW-${cycleDigestSha256.slice(0, 16).toUpperCase()}`,
    cycleDigestSha256,
    stepCount: steps.length,
    completedStepCount: stepResults.filter(result => result.state !== 'broken').length,
    passedStepCount: stepResults.filter(result => result.state === 'passed').length,
    gatedStepCount: stepResults.filter(result => result.state === 'gated').length,
    brokenStepCount: stepResults.filter(result => result.state === 'broken').length,
    workspaceMutationCount: mutatedRepositoryPaths.length,
    mutatedRepositoryPaths,
    designedProducerEvaluatorSeparation: compactCycle.designedProducerEvaluatorSeparation,
    runtimeIdentitySeparationProven: false,
    singleProcessRehearsal: true,
    eligiblePromotionCycle: false,
    eligibleShadowCycleCount: 0,
    minimumEligibleShadowCycles: 4,
    recordPersisted: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    stepResults,
    failures,
    nextAction: 'Kevin confirms the internal operating cell and named owner/backup; then establish isolated identities, protected history, authenticated alerts, bounded scheduling, kill-switch/recovery tests, and human routing comparison before any eligible shadow cycle.'
}, null, 2));

if (!contractValid || !rehearsalCompleted) process.exitCode = 1;
else process.exitCode = 2;

