#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'protected-runtime.json');
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

function exactSet(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}

const contract = load(contractPath, 'Protected-runtime contract');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const roster = load(path.join(repositoryRoot, 'docs/company/automation/agent-roster.json'), 'Agent roster');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');

const workflows = new Map((registry.workflows || []).map(workflow => [workflow.id, workflow]));
const agents = new Map((roster.agents || []).map(agent => [agent.id, agent]));
const riskIds = new Set(risks.map(risk => risk.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'architecture_package_ready_selection_gated') failures.push('status must remain architecture_package_ready_selection_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 30) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs');
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs');
exactSet(contract.workflowRefs, ['A-014', 'A-023', 'A-024', 'A-025', 'A-029', 'A-030'], 'workflowRefs');
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.workflowRefs || []) {
    const workflow = workflows.get(id);
    if (!workflow) failures.push(`unknown workflow ${id}`);
    else if (workflow.externalEffect !== false || !['A0', 'A1'].includes(workflow.autonomy)) failures.push(`${id} is outside the internal A0/A1 no-external-effect boundary`);
}

for (const field of [
    'architectureSelectionAuthorized',
    'vendorAccountCreationAuthorized',
    'credentialCreationAuthorized',
    'runtimeProvisioningAuthorized',
    'schedulerActivationAuthorized',
    'persistentWriteAuthorized',
    'alertDeliveryAuthorized',
    'automatedDispatchAuthorized',
    'externalActionAuthorized',
    'spendAuthorized',
    'conversationIsAuthorization'
]) if (contract.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

exactSet(contract.scope?.cellAgentIds, ['AG-001', 'AG-010'], 'scope.cellAgentIds');
for (const id of contract.scope?.cellAgentIds || []) if (!agents.has(id)) failures.push(`unknown cell agent ${id}`);
if (contract.scope?.maximumAutonomy !== 'A1') failures.push('scope.maximumAutonomy must be A1');
exactSet(contract.scope?.permittedDataZones, ['Z0', 'Z1'], 'scope.permittedDataZones');
for (const field of ['restrictedDataPermitted', 'externalExecutorPermitted', 'productMutationPermitted', 'companyRepositoryMutationPermitted']) if (contract.scope?.[field] !== false) failures.push(`scope.${field} must be false`);

if (contract.people?.accountableOwner !== 'Unassigned' || contract.people?.securityReviewer !== 'Unassigned' || contract.people?.privacyReviewer !== 'Unassigned') failures.push('people must remain unassigned until confirmed');
if (contract.people?.backupOwner !== null || contract.people?.urgentExceptionRecipient !== null) failures.push('backupOwner and urgentExceptionRecipient must remain null');
if (contract.people?.ownerConfirmationRecorded !== false) failures.push('people.ownerConfirmationRecorded must remain false');

for (const field of ['provider', 'orchestratorServiceIdentity', 'assuranceServiceIdentity', 'schedulerServiceIdentity']) if (contract.identity?.[field] !== null) failures.push(`identity.${field} must remain null before selection`);
for (const field of ['identitySeparationRequired', 'workloadIdentityRequired']) if (contract.identity?.[field] !== true) failures.push(`identity.${field} must be true`);
for (const field of ['sharedIdentityPermitted', 'humanPersonalCredentialPermitted', 'longLivedStaticKeyPermitted', 'leastPrivilegeReviewCompleted', 'revocationTestPassed']) if (contract.identity?.[field] !== false) failures.push(`identity.${field} must be false`);

if (contract.execution?.provider !== null || contract.execution?.accountOrProjectRef !== null) failures.push('execution provider/account must remain null');
if (contract.execution?.entryWorkflowId !== 'A-030') failures.push('execution.entryWorkflowId must be A-030');
exactSet(contract.execution?.allowedNestedWorkflowIds, ['A-014', 'A-023', 'A-024', 'A-025', 'A-029'], 'execution.allowedNestedWorkflowIds');
if (contract.execution?.schedulerEnabled !== false) failures.push('execution.schedulerEnabled must remain false');
if (contract.execution?.defaultNetworkEgress !== 'deny' || !Array.isArray(contract.execution?.networkAllowlist) || contract.execution.networkAllowlist.length !== 0) failures.push('execution network egress must remain deny with an empty allowlist');
if (contract.execution?.repositoryMount !== 'read_only' || contract.execution?.ephemeralWorkspaceRequired !== true) failures.push('execution must use read-only source and ephemeral workspace');
for (const [field, expected] of Object.entries({ maximumConcurrentRuns: 1, maximumRunsPerDay: 4, maximumRunSeconds: 120, maximumOutputBytes: 5242880, retryCount: 0 })) if (contract.execution?.[field] !== expected) failures.push(`execution.${field} must be ${expected}`);
for (const field of ['failClosedOnTimeout', 'failClosedOnUnknownCommand']) if (contract.execution?.[field] !== true) failures.push(`execution.${field} must be true`);

for (const section of ['history', 'alerts', 'approvalVerification', 'secrets']) {
    if (contract[section]?.provider !== null) failures.push(`${section}.provider must remain null before selection`);
}
if (contract.history?.accountOrProjectRef !== null || contract.history?.retentionDays !== null) failures.push('history account and retention must remain null');
for (const field of ['appendOnlyOrTamperEvidentRequired', 'encryptionAtRestRequired', 'encryptionInTransitRequired', 'writerReaderSeparationRequired']) if (contract.history?.[field] !== true) failures.push(`history.${field} must be true`);
for (const field of ['rawStepOutputPermitted', 'sensitivePayloadPermitted', 'deletionRuleApproved', 'backupTestPassed', 'restoreTestPassed', 'accessReviewPassed']) if (contract.history?.[field] !== false) failures.push(`history.${field} must be false`);

if (contract.alerts?.authenticatedRouteRef !== null || contract.alerts?.recipientConfirmed !== false) failures.push('alerts route/recipient must remain unconfigured');
if (contract.alerts?.highAndCriticalOnly !== true || contract.alerts?.sensitivePayloadPermitted !== false) failures.push('alerts must remain high/critical-only and payload-minimized');
for (const field of ['deliveryTestPassed', 'deliveryFailureEscalationTestPassed', 'deduplicationTestPassed']) if (contract.alerts?.[field] !== false) failures.push(`alerts.${field} must be false`);

if (contract.approvalVerification?.storeRef !== null || contract.approvalVerification?.trustedVerifierConfigured !== false) failures.push('approval verifier must remain unconfigured');
for (const field of ['conversationAccepted', 'editableRepositoryRecordAccepted']) if (contract.approvalVerification?.[field] !== false) failures.push(`approvalVerification.${field} must be false`);
for (const field of ['digestBindingRequired', 'identityExpiryRevocationReplayChecksRequired']) if (contract.approvalVerification?.[field] !== true) failures.push(`approvalVerification.${field} must be true`);

if (contract.secrets?.storeRef !== null || !Array.isArray(contract.secrets?.credentialRefs) || contract.secrets.credentialRefs.length !== 0) failures.push('secret store and credential references must remain empty');
for (const field of ['secretValuesInRepositoryPermitted', 'secretValuesInLogsPermitted', 'rotationAndRevocationTestPassed']) if (contract.secrets?.[field] !== false) failures.push(`secrets.${field} must be false`);

for (const field of ['spendMinorUnitsPerRun', 'spendMinorUnitsPerDay']) if (contract.resources?.[field] !== 0) failures.push(`resources.${field} must remain zero`);
if (contract.resources?.verifiedPricingEvidenceRef !== null || contract.resources?.usageMeteringConfigured !== false || contract.resources?.hardStopTestPassed !== false) failures.push('resource pricing, metering, and hard-stop evidence must remain unset/unpassed');

if (contract.killSwitch?.globalDisableDefault !== true) failures.push('killSwitch.globalDisableDefault must be true');
if (contract.killSwitch?.activationMechanismRef !== null || !Array.isArray(contract.killSwitch?.authorizedOperators) || contract.killSwitch.authorizedOperators.length !== 0) failures.push('kill-switch mechanism/operators must remain unconfigured');
for (const field of ['stopsNewRuns', 'terminatesActiveRun', 'revokesRuntimeIdentity', 'preservesMinimumAuditEvidence']) if (contract.killSwitch?.[field] !== true) failures.push(`killSwitch.${field} must be true`);
if (contract.killSwitch?.exercisePassed !== false) failures.push('killSwitch.exercisePassed must remain false');

const failureTestValues = Object.values(contract.failureTests || {});
if (failureTestValues.length !== 12 || failureTestValues.some(value => value !== false)) failures.push('all twelve failure tests must remain false before infrastructure evaluation');

const options = contract.architectureOptions || [];
if (!Array.isArray(contract.architectureOptions) || options.length !== 3) failures.push('exactly three architecture options are required');
const optionIds = new Set();
for (const option of options) {
    if (!/^PR-00[1-3]$/.test(option?.id || '')) failures.push(`invalid architecture option ${option?.id}`);
    if (optionIds.has(option?.id)) failures.push(`duplicate architecture option ${option.id}`);
    optionIds.add(option?.id);
    for (const field of ['name', 'description']) if (typeof option?.[field] !== 'string' || !option[field].trim()) failures.push(`${option?.id}.${field} is required`);
    for (const field of ['advantages', 'tradeoffs']) if (!Array.isArray(option?.[field]) || option[field].length < 2) failures.push(`${option?.id}.${field} needs at least two entries`);
    if (typeof option?.recommended !== 'boolean') failures.push(`${option?.id}.recommended must be boolean`);
}
if (options.filter(option => option.recommended).length !== 1 || options.find(option => option.recommended)?.id !== 'PR-001') failures.push('PR-001 must be the single recommended architecture class');
if (contract.selectedArchitectureOptionId !== null) failures.push('selectedArchitectureOptionId must remain null until D-017 is recorded');

const readinessValues = Object.values(contract.readinessGates || {});
if (readinessValues.length !== 18 || readinessValues.some(value => value !== false)) failures.push('all eighteen readiness gates must remain false before selection and evidence');
if (contract.architecturePackageReady !== true) failures.push('architecturePackageReady must be true');
if (contract.deploymentReady !== false || contract.runtimePromotionEligible !== false) failures.push('deploymentReady and runtimePromotionEligible must remain false');

const missingComponentCount = [contract.identity?.provider, contract.execution?.provider, contract.history?.provider, contract.alerts?.provider, contract.approvalVerification?.provider, contract.secrets?.provider].filter(value => value === null).length;

console.log(JSON.stringify({
    workflow: 'A-031',
    mode: 'protected internal runtime architecture assurance; no selection or provisioning',
    runtimeArchitectureValid: failures.length === 0,
    architecturePackageReady: contract.architecturePackageReady === true,
    architectureOptionCount: options.length,
    recommendedArchitectureOptionId: options.find(option => option.recommended)?.id || null,
    selectedArchitectureOptionId: contract.selectedArchitectureOptionId,
    missingProviderComponentCount: missingComponentCount,
    requiredReadinessGateCount: readinessValues.length,
    satisfiedReadinessGateCount: readinessValues.filter(Boolean).length,
    identitySeparationConfigured: false,
    protectedHistoryConfigured: false,
    authenticatedAlertingConfigured: false,
    schedulerEnabled: false,
    credentialReferenceCount: (contract.secrets?.credentialRefs || []).length,
    failureTestPassedCount: failureTestValues.filter(Boolean).length,
    killSwitchExercisePassed: false,
    spendMinorUnitsPerRun: 0,
    deploymentReady: false,
    runtimePromotionEligible: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Kevin records D-017: confirm or defer AG-001/AG-010, name the owner/backup/urgent recipient, and choose PR-001, PR-002, or PR-003. This does not authorize provider selection, account creation, credentials, provisioning, scheduling, or spend.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;

