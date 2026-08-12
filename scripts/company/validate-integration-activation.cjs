#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPlanPath = path.join(repositoryRoot, 'docs/company/automation/integration-activation.json');
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

function visit(value, callback, pathParts = []) {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, callback, [...pathParts, String(index)]));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
        callback(key, child, [...pathParts, key]);
        visit(child, callback, [...pathParts, key]);
    }
}

const plan = load(planPath, 'Integration activation register');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const knownWorkflows = new Set((registry.workflows || []).map(workflow => workflow.id));
const expectedIntegrationIds = Array.from({ length: 18 }, (_, index) => `IC-${String(index + 1).padStart(3, '0')}`);
const validStages = new Set(['S0', 'S1', 'S2', 'S3', 'S4']);
const validStates = new Set([
    'active_anonymous_public_read',
    'existing_human_access_observed_no_agent_connector',
    'provider_unknown_no_request',
    'unknown_no_request',
    'canonical_accounts_unverified_no_request',
    'provider_and_ownership_unknown_no_request',
    'system_unselected_no_request',
    'architecture_selection_gated_no_request',
    'trust_boundary_unselected_no_request',
    'recipient_and_route_unconfirmed_no_request',
    'owner_and_source_unconfirmed_no_request',
    'provider_reports_unverified_no_request',
    'source_unknown_collection_not_authorized',
    'deferred_no_system_no_request',
    'deferred_no_executor_no_request',
    'deferred_no_sender_no_request',
    'prohibited_until_finance_and_approval_foundation'
]);

if (plan.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.asOf || '')) failures.push('asOf must be an ISO date');
if (plan.status !== 'inventory_complete_activation_gated') failures.push('status must remain inventory_complete_activation_gated');
if (typeof plan.purpose !== 'string' || plan.purpose.length < 50) failures.push('purpose is incomplete');

for (const field of [
    'accessRequestDeliveryAuthorized', 'accountCreationAuthorized', 'identityInvitationAuthorized',
    'credentialCreationAuthorized', 'credentialConnectionAuthorized', 'permissionGrantAuthorized',
    'scopeExpansionAuthorized', 'connectorActivationAuthorized', 'schedulerActivationAuthorized',
    'externalReadAuthorizedByThisRegister', 'externalWriteAuthorized', 'spendAuthorized',
    'conversationIsAuthorization', 'decisionResponseAuthorizesAccess'
]) if (plan.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

const expectedTrueRules = [
    'providerNativeInvitationRequired', 'dedicatedWorkloadIdentityPreferred', 'readBeforeWriteRequired',
    'ownerBackupAndRecoveryRequired', 'scopeExpiryAndRevocationRequired',
    'writeRequiresSeparateArtifactBoundApproval'
];
const expectedFalseRules = [
    'secretValuesPermittedInRepository', 'secretValuesPermittedInChat',
    'personalCredentialReusePermitted', 'observedHumanAccessCountsAsConnector',
    'successfulReadCountsAsWriteAuthorization'
];
for (const field of expectedTrueRules) if (plan.rules?.[field] !== true) failures.push(`rules.${field} must be true`);
for (const field of expectedFalseRules) if (plan.rules?.[field] !== false) failures.push(`rules.${field} must be false`);

const forbiddenSecretKeys = new Set(['password', 'passwd', 'token', 'secret', 'apikey', 'api_key', 'privatekey', 'private_key', 'recoverycode', 'recovery_code']);
const secretValuePattern = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
visit(plan, (key, value, keyPath) => {
    if (forbiddenSecretKeys.has(key.toLowerCase())) failures.push(`secret-like field ${keyPath.join('.')} is prohibited`);
    if (typeof value === 'string' && secretValuePattern.test(value)) failures.push(`secret-like value at ${keyPath.join('.')} is prohibited`);
});

const integrations = plan.integrations || [];
if (!Array.isArray(plan.integrations) || integrations.length !== 18) failures.push('integrations must contain exactly eighteen classes');
const seen = new Set();
let credentialReferenceCount = 0;
for (const [index, integration] of integrations.entries()) {
    const label = integration?.id || `integrations[${index}]`;
    if (!/^IC-\d{3}$/.test(integration?.id || '')) failures.push(`${label} has invalid ID`);
    if (seen.has(integration?.id)) failures.push(`duplicate integration ${integration.id}`);
    seen.add(integration?.id);
    if (!expectedIntegrationIds.includes(integration?.id)) failures.push(`${label} is outside the controlled inventory`);
    for (const field of ['system', 'domain', 'minimumRole', 'accountableOwner', 'nextGate']) {
        if (typeof integration?.[field] !== 'string' || !integration[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    if (!validStages.has(integration?.stage)) failures.push(`${label} has invalid stage`);
    if (!['P0', 'P1', 'P2'].includes(integration?.priority)) failures.push(`${label} has invalid priority`);
    if (!validStates.has(integration?.currentState)) failures.push(`${label} has invalid currentState`);
    if (!Array.isArray(integration?.workflowRefs) || integration.workflowRefs.length === 0) failures.push(`${label} lacks workflowRefs`);
    for (const workflowRef of integration.workflowRefs || []) if (!knownWorkflows.has(workflowRef)) failures.push(`${label} references unknown workflow ${workflowRef}`);
    if (!Array.isArray(integration?.dataZones) || integration.dataZones.length === 0 || integration.dataZones.some(zone => !['Z0', 'Z1', 'Z2', 'Z3'].includes(zone))) failures.push(`${label} has invalid dataZones`);
    if (/\b(?:admin|administrator|owner|full|write|all[_ -]?access)\b/i.test(integration?.minimumRole || '')) failures.push(`${label} requests a broad minimumRole`);
    for (const field of ['ownerConfirmed', 'externalWriteCapable', 'spendCapable', 'observedHumanAccess', 'connectorConfigured', 'requestPrepared', 'approvalRecorded', 'activationReady', 'personalDataPossible', 'childDataPossible']) {
        if (typeof integration?.[field] !== 'boolean') failures.push(`${label}.${field} must be boolean`);
    }
    if (!Array.isArray(integration?.credentialRefs)) failures.push(`${label}.credentialRefs must be an array`);
    credentialReferenceCount += (integration.credentialRefs || []).length;
    if ((integration.credentialRefs || []).length !== 0) failures.push(`${label} must not contain a credential reference before activation review`);
    if (integration.connectorConfigured !== false || integration.requestPrepared !== false || integration.approvalRecorded !== false || integration.activationReady !== false) failures.push(`${label} prematurely advances request, approval, connector, or activation state`);
    if (integration.ownerConfirmed !== false || integration.backupOwner !== null) failures.push(`${label} must not imply confirmed owner/backup evidence`);
    if (!Array.isArray(integration?.prohibitedScopes) || integration.prohibitedScopes.length < 3) failures.push(`${label}.prohibitedScopes is incomplete`);
    if (integration.personalDataPossible && !integration.dataZones.some(zone => ['Z2', 'Z3'].includes(zone))) failures.push(`${label} personal-data possibility lacks Z2/Z3 classification`);
    if (integration.childDataPossible) {
        if (!integration.dataZones.includes('Z2')) failures.push(`${label} child-data possibility lacks Z2 classification`);
        if (!/safeguard/i.test(integration.nextGate)) failures.push(`${label} child-data path lacks safeguarding gate`);
        if (!integration.prohibitedScopes.some(scope => ['direct_minor_contact', 'unrestricted_content_access', 'form_submission_content', 'comment_or_message_read'].includes(scope))) failures.push(`${label} child-data path lacks a restricted-content or contact prohibition`);
    }
    if (integration.currentState === 'active_anonymous_public_read' && (integration.id !== 'IC-001' || integration.minimumRole !== 'public_anonymous_read' || integration.externalWriteCapable !== false)) failures.push('only IC-001 may be active anonymous public read');
    if (integration.observedHumanAccess && !['IC-002', 'IC-003'].includes(integration.id)) failures.push(`${label} has unsupported observed human access`);
}
for (const id of expectedIntegrationIds) if (!seen.has(id)) failures.push(`missing integration ${id}`);
const observedIds = integrations.filter(item => item.observedHumanAccess).map(item => item.id).sort();
if (JSON.stringify(observedIds) !== JSON.stringify(['IC-002', 'IC-003'])) failures.push('observed human access must remain limited to IC-002 and IC-003');

const sequence = plan.sequence || [];
if (!Array.isArray(plan.sequence) || sequence.length !== 5) failures.push('sequence must contain five stages');
const sequencedIds = [];
for (const [index, stage] of sequence.entries()) {
    if (stage?.id !== `S${index}`) failures.push(`sequence[${index}] has invalid stage order`);
    if (stage?.activationAuthorized !== false) failures.push(`${stage?.id || index}.activationAuthorized must remain false`);
    if (!Array.isArray(stage?.integrationIds) || stage.integrationIds.length === 0) failures.push(`${stage?.id || index} lacks integrationIds`);
    for (const id of stage.integrationIds || []) {
        sequencedIds.push(id);
        if (integrations.find(item => item.id === id)?.stage !== stage.id) failures.push(`${id} is sequenced under the wrong stage`);
    }
}
if (sequencedIds.length !== 18 || new Set(sequencedIds).size !== 18 || !expectedIntegrationIds.every(id => sequencedIds.includes(id))) failures.push('sequence must cover every integration exactly once');

const brief = plan.firstKevinAccessBrief || {};
if (brief.status !== 'ready_for_input_delivery_disabled') failures.push('firstKevinAccessBrief status is invalid');
if (!Array.isArray(brief.items) || brief.items.length !== 5) failures.push('firstKevinAccessBrief must contain exactly five bounded inputs');
const expectedBriefIds = ['KAI-001', 'KAI-002', 'KAI-003', 'KAI-004', 'KAI-005'];
for (const [index, item] of (brief.items || []).entries()) {
    if (item?.id !== expectedBriefIds[index]) failures.push(`firstKevinAccessBrief.items[${index}] has invalid ID/order`);
    if (!/^D-\d{3}$/.test(item?.decisionRef || '')) failures.push(`${item?.id || index} lacks decisionRef`);
    if (!Array.isArray(item?.integrationIds) || item.integrationIds.length === 0 || item.integrationIds.some(id => !seen.has(id))) failures.push(`${item?.id || index} has invalid integrationIds`);
    if (typeof item?.inputNeeded !== 'string' || item.inputNeeded.length < 30) failures.push(`${item?.id || index} lacks bounded inputNeeded`);
}
for (const field of ['credentialValuesRequested', 'providerInvitationsRequested', 'deliveryConfigured', 'deliveryAuthorized', 'responseAuthorizesAccess']) if (brief[field] !== false) failures.push(`firstKevinAccessBrief.${field} must remain false`);
if (brief.readyForKevinReview !== true) failures.push('firstKevinAccessBrief.readyForKevinReview must be true');
if (plan.inventoryComplete !== true || plan.newActivationReady !== false || plan.externalActionAuthorized !== false) failures.push('top-level readiness or authority state is invalid');

const connectorConfiguredCount = integrations.filter(item => item.connectorConfigured).length;
const activationReadyCount = integrations.filter(item => item.activationReady).length;
console.log(JSON.stringify({
    workflow: 'A-035',
    mode: 'least-privilege integration inventory and access-brief assurance; no request or connection action',
    integrationPlanValid: failures.length === 0,
    inventoryComplete: failures.length === 0 && plan.inventoryComplete === true,
    integrationCount: integrations.length,
    stageCount: sequence.length,
    anonymousPublicReadCount: integrations.filter(item => item.currentState === 'active_anonymous_public_read').length,
    observedHumanAccessContextCount: integrations.filter(item => item.observedHumanAccess).length,
    connectorConfiguredCount,
    credentialReferenceCount,
    requestPreparedCount: integrations.filter(item => item.requestPrepared).length,
    activationReadyCount,
    writeCapableIntegrationCount: integrations.filter(item => item.externalWriteCapable).length,
    spendCapableIntegrationCount: integrations.filter(item => item.spendCapable).length,
    personalDataPossibleCount: integrations.filter(item => item.personalDataPossible).length,
    childDataPossibleCount: integrations.filter(item => item.childDataPossible).length,
    firstAccessBriefItemCount: (brief.items || []).length,
    firstAccessBriefReadyForKevinReview: brief.readyForKevinReview === true,
    accessRequestDeliveryAuthorized: false,
    connectorActivationAuthorized: false,
    externalWriteAuthorized: false,
    spendAuthorized: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Kevin can answer KAI-001 through KAI-005 without sharing credentials. Record those inputs in their existing decisions, then evaluate one read-only integration at a time; no response authorizes an invitation, connector, write, or spend.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
