#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json');
const defaultEnvelopePath = path.join(
    repositoryRoot,
    'docs',
    'company',
    'automation',
    'approval-requests',
    'EXAMPLE_DRAFT.json'
);
const envelopePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultEnvelopePath;
const failures = [];
const gates = [];

function loadJson(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function fail(condition, message) {
    if (condition) failures.push(message);
}

const registry = loadJson(registryPath, 'Automation registry');
const envelope = loadJson(envelopePath, 'Approval envelope');
const workflow = (registry.workflows || []).find(item => item.id === envelope.workflowId);
const allowedStatuses = new Set(['draft', 'approved', 'revoked', 'executed']);
const allowedActions = new Set([
    'publish',
    'outreach',
    'production_change',
    'data_collection',
    'account_change',
    'customer_response',
    'spend',
    'contract',
    'other'
]);
const allowedEnvironments = new Set(['preview', 'production', 'external_service']);
const allowedZones = new Set(['Z0', 'Z1', 'Z2', 'Z3']);
const allowedKeys = new Set([
    'schemaVersion', 'id', 'status', 'workflowId', 'workflowVersion', 'actionClass',
    'requestedBy', 'approvedBy', 'approvedAt', 'approvalEvidenceRef', 'decisionRef',
    'issuedAt', 'validUntil', 'environment', 'targets', 'allowedOperations',
    'prohibitedOperations', 'maxActions', 'spend', 'dataZones', 'artifact',
    'idempotencyKey', 'dryRunEvidence', 'rollbackPlan', 'auditDestination'
]);

fail(envelope.schemaVersion !== 1, 'schemaVersion must be 1');
fail(!/^AP-\d{8}-\d{3,}$/.test(envelope.id || ''), 'id must match AP-YYYYMMDD-NNN');
fail(!allowedStatuses.has(envelope.status), 'status is invalid');
fail(!workflow, `workflow ${envelope.workflowId || '(missing)'} is not registered`);
fail(!Number.isInteger(envelope.workflowVersion) || envelope.workflowVersion < 1, 'workflowVersion is invalid');
fail(workflow && workflow.version !== envelope.workflowVersion, 'workflowVersion does not match the registry');
fail(!allowedActions.has(envelope.actionClass), 'actionClass is invalid');
fail(!hasText(envelope.requestedBy), 'requestedBy is required');
fail(!hasText(envelope.decisionRef), 'decisionRef is required');
fail(!validTimestamp(envelope.issuedAt), 'issuedAt must be an ISO timestamp');
fail(!validTimestamp(envelope.validUntil), 'validUntil must be an ISO timestamp');
fail(!allowedEnvironments.has(envelope.environment), 'environment is invalid');
fail(!Array.isArray(envelope.targets) || envelope.targets.length === 0 || envelope.targets.length > 20, 'targets must contain 1–20 exact destinations');
fail(!Array.isArray(envelope.allowedOperations) || envelope.allowedOperations.length === 0, 'allowedOperations must not be empty');
fail(!Array.isArray(envelope.prohibitedOperations) || envelope.prohibitedOperations.length === 0, 'prohibitedOperations must not be empty');
fail(!Number.isInteger(envelope.maxActions) || envelope.maxActions < 1 || envelope.maxActions > 100, 'maxActions must be 1–100');
fail(!envelope.spend || !/^[A-Z]{3}$/.test(envelope.spend.currency || ''), 'spend currency must be a three-letter ISO code');
fail(!Number.isInteger(envelope.spend?.maximumMinorUnits) || envelope.spend.maximumMinorUnits < 0, 'spend maximumMinorUnits must be a non-negative integer');
fail(!Array.isArray(envelope.dataZones) || !envelope.dataZones.every(zone => allowedZones.has(zone)), 'dataZones are invalid');
fail(!hasText(envelope.idempotencyKey) || envelope.idempotencyKey.length < 12, 'idempotencyKey must contain at least 12 characters');
fail(!hasText(envelope.dryRunEvidence), 'dryRunEvidence is required');
fail(!hasText(envelope.rollbackPlan), 'rollbackPlan is required');
fail(!hasText(envelope.auditDestination), 'auditDestination is required');

for (const key of Object.keys(envelope)) {
    if (!allowedKeys.has(key)) failures.push(`unsupported envelope field ${key}`);
}
for (const [index, target] of (envelope.targets || []).entries()) {
    for (const field of ['system', 'account', 'destination']) {
        if (!hasText(target?.[field])) failures.push(`targets[${index}].${field} is required`);
    }
    const targetKeys = Object.keys(target || {});
    if (targetKeys.some(key => !['system', 'account', 'destination'].includes(key))) {
        failures.push(`targets[${index}] contains an unsupported field`);
    }
}

if (validTimestamp(envelope.issuedAt) && validTimestamp(envelope.validUntil)) {
    const issuedAt = Date.parse(envelope.issuedAt);
    const validUntil = Date.parse(envelope.validUntil);
    fail(validUntil <= issuedAt, 'validUntil must be after issuedAt');
    fail(validUntil - issuedAt > 24 * 60 * 60 * 1000, 'approval window may not exceed 24 hours');
    if (envelope.status === 'approved') {
        fail(Date.now() < issuedAt, 'approved envelope is not active yet');
        fail(Date.now() >= validUntil, 'approved envelope has expired');
    }
}

if (envelope.status === 'approved') {
    fail(!hasText(envelope.approvedBy), 'approved envelope requires approvedBy');
    fail(!validTimestamp(envelope.approvedAt), 'approved envelope requires approvedAt');
    fail(!hasText(envelope.approvalEvidenceRef), 'approved envelope requires protected approvalEvidenceRef');
} else if (envelope.status === 'draft') {
    fail(envelope.approvedBy !== null, 'draft approvedBy must be null');
    fail(envelope.approvedAt !== null, 'draft approvedAt must be null');
    fail(envelope.approvalEvidenceRef !== null, 'draft approvalEvidenceRef must be null');
}

if (workflow) {
    const registeredZones = new Set(workflow.dataZones || []);
    fail(
        (envelope.dataZones || []).some(zone => !registeredZones.has(zone)),
        'envelope dataZones exceed the registered workflow data zones'
    );
}

let artifactDigestMatches = false;
if (!hasText(envelope.artifact?.path) || !/^[a-f0-9]{64}$/.test(envelope.artifact?.sha256 || '')) {
    failures.push('artifact path and lowercase SHA-256 are required');
} else {
    const artifactPath = path.resolve(repositoryRoot, envelope.artifact.path);
    const withinRepository = artifactPath === repositoryRoot || artifactPath.startsWith(`${repositoryRoot}${path.sep}`);
    if (!withinRepository) {
        failures.push('artifact path must remain inside the repository');
    } else if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
        failures.push(`artifact file is missing: ${envelope.artifact.path}`);
    } else {
        const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
        artifactDigestMatches = actualDigest === envelope.artifact.sha256;
        fail(!artifactDigestMatches, 'artifact SHA-256 does not match the reviewed artifact');
    }
}

const secretLike = /(api[_-]?key|access[_-]?token|password|private[_-]?key)\s*[:=]/i;
fail(secretLike.test(JSON.stringify(envelope)), 'approval envelope appears to contain a secret-like field or value');

const workflowEligible = Boolean(
    workflow && workflow.status === 'active' && workflow.externalEffect === true
);
if (!workflowEligible) {
    gates.push('Referenced workflow is not registered as an active external-effect executor.');
}
if (envelope.status !== 'approved') gates.push(`Envelope status is ${envelope.status}, not approved.`);
gates.push('No protected identity-aware approval verifier is configured in this repository pilot.');
gates.push('Executor credential, live budget, revocation, policy, and kill-switch checks are not implemented by A-011.');

const trustedApprovalVerifierConfigured = false;
const externalActionAuthorized = Boolean(
    failures.length === 0 &&
    workflowEligible &&
    envelope.status === 'approved' &&
    artifactDigestMatches &&
    trustedApprovalVerifierConfigured
);

console.log(JSON.stringify({
    workflow: 'A-011',
    mode: 'repository scope-validation pilot',
    envelopeId: envelope.id || null,
    envelopeValid: failures.length === 0,
    artifactDigestMatches,
    workflowEligible,
    trustedApprovalVerifierConfigured,
    externalActionAuthorized,
    failures,
    authorizationGates: gates,
    result: externalActionAuthorized
        ? 'Eligible for a separately permissioned executor.'
        : 'No external action is authorized.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!externalActionAuthorized) process.exitCode = 2;
