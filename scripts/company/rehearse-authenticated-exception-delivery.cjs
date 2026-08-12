#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/authenticated-exception-delivery.json');

function parseArguments(values) {
    const options = { contractPath: defaultContractPath, validateOnly: false };
    for (let index = 0; index < values.length; index += 1) {
        if (values[index] === '--validate-only') options.validateOnly = true;
        else if (values[index] === '--input') {
            if (!values[index + 1]) throw new Error('--input requires a path');
            options.contractPath = path.resolve(values[index + 1]);
            index += 1;
        } else throw new Error(`Unknown argument ${values[index]}`);
    }
    return options;
}

function loadJson(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function canonical(value) { return JSON.stringify(value); }
function sign(value, privateKey) { return crypto.sign(null, Buffer.from(canonical(value)), privateKey).toString('base64'); }
function verify(value, signature, publicKey) {
    try { return crypto.verify(null, Buffer.from(canonical(value)), publicKey, Buffer.from(signature, 'base64')); }
    catch { return false; }
}
function exactSet(actual, expected, label, failures) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(item => !actual.includes(item))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}
function exactKeys(object, expected, label, failures) {
    exactSet(object && typeof object === 'object' && !Array.isArray(object) ? Object.keys(object) : [], expected, `${label} fields`, failures);
}
function requireFalse(object, fields, label, failures, exact = false) {
    if (exact) exactKeys(object, fields, label, failures);
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}
function requireTrue(object, fields, label, failures) {
    for (const field of fields) if (object?.[field] !== true) failures.push(`${label}.${field} must be true`);
}
function executeJson(relative, args, expectedExit) {
    const result = spawnSync(process.execPath, [path.join(repositoryRoot, relative), ...args], { cwd: repositoryRoot, encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
    let output = null;
    try { output = JSON.parse(result.stdout); } catch {}
    return { status: result.status, raw: result.stdout || '', output, valid: result.status === expectedExit && output };
}
function snapshotTree(relativeRoots) {
    const result = new Map();
    function visit(absolute, relative) {
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) return result.set(relative, `link:${fs.readlinkSync(absolute)}`);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(absolute).sort()) visit(path.join(absolute, entry), path.join(relative, entry));
            return;
        }
        if (stat.isFile()) result.set(relative, `file:${stat.mode & 0o777}:${stat.size}:${sha256(fs.readFileSync(absolute))}`);
    }
    for (const root of relativeRoots) visit(path.join(repositoryRoot, root), root);
    return result;
}
function snapshotDifferences(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).sort();
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Authenticated exception-delivery contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const integrations = loadJson(path.join(repositoryRoot, 'docs/company/automation/integration-activation.json'), 'Integration register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_authenticated_exception_delivery_rehearsal_ready_production_routes_gated') failures.push('status must remain offline_authenticated_exception_delivery_rehearsal_ready_production_routes_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 400) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-012', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-015', 'A-016', 'A-023', 'A-025', 'A-031', 'A-035', 'A-041', 'A-046', 'A-047'], 'workflowRefs', failures);
if (contract.integrationRef !== 'IC-011') failures.push('integrationRef must be IC-011');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const integrationIds = new Set((integrations.integrations || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
if (!integrationIds.has(contract.integrationRef)) failures.push(`unknown integration ${contract.integrationRef}`);

const authorityFields = ['productionSenderIdentityAuthorized', 'productionRecipientIdentityAuthorized', 'productionRouteConfigurationAuthorized', 'alertDeliveryAuthorized', 'acknowledgementCaptureAuthorized', 'contactDetailStorageAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'schedulerActivationAuthorized', 'commandExecutionAuthorized', 'approvalCaptureAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.changeWorkflowId !== 'A-015' || source.historyWorkflowId !== 'A-046') failures.push('sourceEvidence workflow bindings are invalid');
requireTrue(source, ['offlineCurrentSnapshotRequired', 'highOrCriticalChangeRequired', 'sourceOutputDigestRequired', 'historyEvidenceDigestRequired', 'syntheticIdentityAndRouteEvidenceOnly'], 'sourceEvidence', failures);
requireFalse(source, ['rawChangeOutputPermittedInAlert', 'rawHistoryOutputPermittedInAlert'], 'sourceEvidence', failures);

const alertFields = ['schemaVersion', 'alertId', 'correlationId', 'createdAt', 'notBefore', 'expiresAt', 'severity', 'category', 'sourceWorkflowId', 'sourceRunDigestSha256', 'historyWorkflowId', 'historyEvidenceDigestSha256', 'changeIds', 'changeCount', 'routeId', 'recipientRoleRef', 'attemptNumber', 'idempotencyKey', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const acknowledgementFields = ['schemaVersion', 'acknowledgementId', 'alertId', 'routeId', 'recipientRoleRef', 'acknowledgedAt', 'disposition', 'alertDigestSha256', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const policy = contract.alertPolicy || {};
if (policy.alertSchemaVersion !== 1 || policy.signatureAlgorithm !== 'Ed25519' || policy.digestAlgorithm !== 'sha256' || policy.maximumAlertBytes !== 4096 || policy.validitySeconds !== 300 || policy.maximumPrimaryAttempts !== 2 || policy.maximumBackupAttempts !== 1 || !sameJson(policy.eligibleSeverities, ['critical', 'high']) || !sameJson(policy.alertFields, alertFields) || !sameJson(policy.acknowledgementFields, acknowledgementFields)) failures.push('alertPolicy algorithms, bounds, fields, or severities are invalid');
requireFalse(policy, ['rawChangeDetailsPermitted', 'rawHistoryDetailsPermitted', 'contactDetailsPermitted', 'customerOrPersonalDataPermitted', 'commandOrApprovalCapturePermitted', 'externalActionAuthorized', 'sensitivePayloadIncluded', 'unchangedStatusAlertPermitted', 'mediumOrInformationalAlertPermitted', 'duplicateDeliveryPermitted', 'unboundedRetryPermitted'], 'alertPolicy', failures);

const expectedRoutes = [
    ['SYN-PRIMARY', 'synthetic_primary_urgent_recipient', 1, 2, false],
    ['SYN-BACKUP', 'synthetic_backup_urgent_recipient', 2, 1, false]
];
if (!Array.isArray(contract.syntheticRoutes) || contract.syntheticRoutes.length !== 2) failures.push('syntheticRoutes must contain exactly 2 routes');
for (let index = 0; index < expectedRoutes.length; index += 1) {
    const route = contract.syntheticRoutes?.[index] || {};
    if (!sameJson([route.routeId, route.recipientRoleRef, route.priority, route.maximumAttempts, route.productionRoute], expectedRoutes[index])) failures.push(`synthetic route ${index + 1} is invalid`);
}

const expectedSteps = [
    [1, 'ALERT-PRIMARY', 'SYN-PRIMARY', 1, 'delivered', 'delivered'],
    [2, 'ALERT-PRIMARY', 'SYN-PRIMARY', 1, 'delivered', 'duplicate_suppressed'],
    [3, 'ALERT-FAILOVER', 'SYN-PRIMARY', 1, 'unavailable', 'delivery_failed'],
    [4, 'ALERT-FAILOVER', 'SYN-PRIMARY', 2, 'unavailable', 'delivery_failed'],
    [5, 'ALERT-FAILOVER', 'SYN-BACKUP', 1, 'delivered', 'delivered']
];
const rehearsalPlan = contract.rehearsalPlan || {};
if (!sameJson([rehearsalPlan.alertCount, rehearsalPlan.deliveryAttemptCount, rehearsalPlan.successfulDeliveryCount, rehearsalPlan.failedDeliveryCount, rehearsalPlan.verifiedAcknowledgementCount, rehearsalPlan.duplicateSuppressionCount, rehearsalPlan.failoverCount], [2, 4, 2, 2, 2, 1, 1])) failures.push('rehearsalPlan counts are invalid');
if (!Array.isArray(rehearsalPlan.steps) || rehearsalPlan.steps.length !== 5) failures.push('rehearsalPlan must contain exactly 5 steps');
for (let index = 0; index < expectedSteps.length; index += 1) {
    const step = rehearsalPlan.steps?.[index] || {};
    if (!sameJson([step.sequence, step.alertRef, step.routeId, step.attemptNumber, step.transportOutcome, step.expectedOutcome], expectedSteps[index])) failures.push(`rehearsalPlan step ${index + 1} is invalid`);
}

const expectedRefusals = {
    'AR-001': ['invalid_alert_signature', 'alert_signature_invalid'],
    'AR-002': ['substitute_source_digest', 'source_binding_mismatch'],
    'AR-003': ['substitute_history_digest', 'history_binding_mismatch'],
    'AR-004': ['expire_alert', 'alert_expired'],
    'AR-005': ['future_not_before', 'alert_not_yet_valid'],
    'AR-006': ['downgrade_to_medium', 'severity_ineligible'],
    'AR-007': ['add_payload_field', 'alert_fields_invalid'],
    'AR-008': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'AR-009': ['mark_sensitive_payload', 'authority_or_payload_flag_invalid'],
    'AR-010': ['wrong_recipient', 'recipient_binding_mismatch'],
    'AR-011': ['revoked_route', 'route_revoked'],
    'AR-012': ['primary_retry_exceeded', 'retry_limit_exceeded'],
    'AR-013': ['oversized_alert', 'alert_size_exceeded'],
    'AR-014': ['forged_acknowledgement', 'acknowledgement_signature_invalid'],
    'AR-015': ['acknowledgement_wrong_alert', 'acknowledgement_binding_mismatch'],
    'AR-016': ['acknowledgement_add_payload_field', 'acknowledgement_fields_invalid']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 16 || refusalPlan.expectedRefusalCount !== 16) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_create_delivery_ledger' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionDelivery', 'countsAsEligibleCycle', 'productionDeliveryStoreConfigured'], 'rehearsalStore', failures);

const production = contract.productionDeliveryPolicy || {};
requireFalse(production, ['providerSelected', 'senderIdentityConfigured', 'primaryRecipientIdentityConfigured', 'backupRecipientIdentityConfigured', 'recipientConfirmationRecorded', 'deliveryReceiptStoreConfigured', 'acknowledgementStoreConfigured', 'deduplicationStoreConfigured', 'routeAuthenticationVerified', 'routeRevocationTestPassed', 'quietHoursPolicyApproved', 'deliveryFailureEscalationApproved'], 'productionDeliveryPolicy', failures);
for (const field of ['primaryRouteRef', 'backupRouteRef', 'maximumAcknowledgementMinutes', 'deduplicationTtlMinutes']) if (production[field] !== null) failures.push(`productionDeliveryPolicy.${field} must remain null`);

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `AD-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 100) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.syntheticRouteCount !== 2 || contract.refusalScenarioCount !== 16 || contract.expectedRefusalCount !== 16) failures.push('top-level route or refusal counts are invalid');
for (const field of ['configuredProductionRouteCount', 'configuredProductionIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.deliveryContractReadyForReview !== true) failures.push('deliveryContractReadyForReview must be true');
for (const field of ['productionDeliveryReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 450) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
let eligibleChangeCount = 0;
let alertCount = 0;
let deliveryAttemptCount = 0;
let successfulDeliveryCount = 0;
let failedDeliveryCount = 0;
let verifiedAcknowledgementCount = 0;
let duplicateSuppressionCount = 0;
let failoverCount = 0;
let ledgerWriteCount = 0;
let repositoryMutationPaths = [];
const refusalResults = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a047-'));
    fs.chmodSync(temp, 0o700);
    const before = snapshotTree(['docs/company', 'scripts/company']);
    try {
        const baseline = loadJson(path.join(repositoryRoot, 'docs/company/operations/control-plane-baseline.json'), 'Control-plane baseline');
        const current = clone(baseline);
        current.capturedAt = '2026-08-11T11:59:00.000Z';
        current.controlStates['A-046'] = 'gated';
        current.riskStates['R-012'] = { severity: 'high', status: 'open' };
        current.riskStates['R-013'] = { severity: 'medium', status: 'open' };
        const currentPath = path.join(temp, 'offline-current-snapshot.json');
        fs.writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        const a015 = executeJson('scripts/company/detect-company-control-plane-changes.cjs', ['--current', currentPath], 2);
        const a046 = executeJson('scripts/company/rehearse-protected-run-history.cjs', [], 2);
        if (!a015.valid || a015.output.workflow !== 'A-015' || a015.output.comparisonValid !== true || a015.output.alertRequired !== true) failures.push('A-015 source evidence is invalid');
        if (!a046.valid || a046.output.workflow !== 'A-046' || a046.output.reconciliationValid !== true) failures.push('A-046 source evidence is invalid');
        sourceEvidenceCurrent = failures.length === 0;

        if (sourceEvidenceCurrent) {
            const eligibleChanges = a015.output.changes.filter(item => ['high', 'critical'].includes(item.severity));
            eligibleChangeCount = eligibleChanges.length;
            if (eligibleChangeCount !== 1 || eligibleChanges[0].id !== 'CHG-RISK-R-012-NEW') failures.push('eligible high/critical source change set is invalid');
            const sourceDigest = sha256(a015.raw);
            const historyDigest = sha256(a046.raw);
            const sender = crypto.generateKeyPairSync('ed25519');
            const primaryRecipient = crypto.generateKeyPairSync('ed25519');
            const backupRecipient = crypto.generateKeyPairSync('ed25519');
            const routes = new Map(contract.syntheticRoutes.map(route => [route.routeId, route]));
            const recipientKeys = new Map([['SYN-PRIMARY', primaryRecipient], ['SYN-BACKUP', backupRecipient]]);
            const evaluationTime = Date.parse('2026-08-11T12:01:00.000Z');

            function buildAlert(logicalRef, routeId, attemptNumber) {
                const route = routes.get(routeId);
                const correlationId = `COR-A047-${sha256(`${logicalRef}:${sourceDigest}:${historyDigest}`).slice(0, 16).toUpperCase()}`;
                const alertId = `ALT-A047-${sha256(`${logicalRef}:${correlationId}`).slice(0, 16).toUpperCase()}`;
                const body = {
                    schemaVersion: 1,
                    alertId,
                    correlationId,
                    createdAt: '2026-08-11T12:00:00.000Z',
                    notBefore: '2026-08-11T12:00:00.000Z',
                    expiresAt: '2026-08-11T12:05:00.000Z',
                    severity: 'high',
                    category: 'risk',
                    sourceWorkflowId: 'A-015',
                    sourceRunDigestSha256: sourceDigest,
                    historyWorkflowId: 'A-046',
                    historyEvidenceDigestSha256: historyDigest,
                    changeIds: eligibleChanges.map(item => item.id),
                    changeCount: eligibleChanges.length,
                    routeId,
                    recipientRoleRef: route.recipientRoleRef,
                    attemptNumber,
                    idempotencyKey: sha256(`${alertId}:${routeId}:${attemptNumber}`),
                    externalActionAuthorized: false,
                    sensitivePayloadIncluded: false
                };
                return { alert: body, signature: sign(body, sender.privateKey) };
            }
            function alertAdmission(envelope, revokedRoutes = new Set()) {
                const alert = envelope.alert;
                if (!alert || !sameJson(Object.keys(alert), alertFields)) return 'alert_fields_invalid';
                if (Buffer.byteLength(canonical(alert)) > policy.maximumAlertBytes) return 'alert_size_exceeded';
                if (!verify(alert, envelope.signature, sender.publicKey)) return 'alert_signature_invalid';
                if (alert.sourceWorkflowId !== 'A-015' || alert.sourceRunDigestSha256 !== sourceDigest) return 'source_binding_mismatch';
                if (alert.historyWorkflowId !== 'A-046' || alert.historyEvidenceDigestSha256 !== historyDigest) return 'history_binding_mismatch';
                if (evaluationTime > Date.parse(alert.expiresAt)) return 'alert_expired';
                if (evaluationTime < Date.parse(alert.notBefore)) return 'alert_not_yet_valid';
                if (!policy.eligibleSeverities.includes(alert.severity)) return 'severity_ineligible';
                if (alert.externalActionAuthorized !== false || alert.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                const route = routes.get(alert.routeId);
                if (!route || alert.recipientRoleRef !== route.recipientRoleRef) return 'recipient_binding_mismatch';
                if (revokedRoutes.has(alert.routeId)) return 'route_revoked';
                if (!Number.isInteger(alert.attemptNumber) || alert.attemptNumber < 1 || alert.attemptNumber > route.maximumAttempts) return 'retry_limit_exceeded';
                if (!sameJson(alert.changeIds, eligibleChanges.map(item => item.id)) || alert.changeCount !== eligibleChanges.length) return 'source_binding_mismatch';
                return null;
            }
            function makeAcknowledgement(envelope, routeId) {
                const route = routes.get(routeId);
                const body = {
                    schemaVersion: 1,
                    acknowledgementId: `ACK-A047-${sha256(`${envelope.alert.alertId}:${routeId}`).slice(0, 16).toUpperCase()}`,
                    alertId: envelope.alert.alertId,
                    routeId,
                    recipientRoleRef: route.recipientRoleRef,
                    acknowledgedAt: '2026-08-11T12:02:00.000Z',
                    disposition: 'received_for_human_review',
                    alertDigestSha256: sha256(canonical(envelope.alert)),
                    externalActionAuthorized: false,
                    sensitivePayloadIncluded: false
                };
                return { acknowledgement: body, signature: sign(body, recipientKeys.get(routeId).privateKey) };
            }
            function acknowledgementAdmission(envelope, acknowledgementEnvelope) {
                const ack = acknowledgementEnvelope.acknowledgement;
                if (!ack || !sameJson(Object.keys(ack), acknowledgementFields)) return 'acknowledgement_fields_invalid';
                const keys = recipientKeys.get(ack.routeId);
                if (!keys || !verify(ack, acknowledgementEnvelope.signature, keys.publicKey)) return 'acknowledgement_signature_invalid';
                const alert = envelope.alert;
                const route = routes.get(alert.routeId);
                if (ack.alertId !== alert.alertId || ack.routeId !== alert.routeId || ack.recipientRoleRef !== route.recipientRoleRef || ack.alertDigestSha256 !== sha256(canonical(alert))) return 'acknowledgement_binding_mismatch';
                if (ack.externalActionAuthorized !== false || ack.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                return null;
            }
            function writeLedger(name, value) {
                fs.writeFileSync(path.join(temp, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
                ledgerWriteCount += 1;
            }

            const logicalAlerts = {
                'ALERT-PRIMARY': buildAlert('ALERT-PRIMARY', 'SYN-PRIMARY', 1),
                'ALERT-FAILOVER': buildAlert('ALERT-FAILOVER', 'SYN-PRIMARY', 1)
            };
            alertCount = 2;
            for (const step of rehearsalPlan.steps) {
                let envelope = logicalAlerts[step.alertRef];
                if (step.alertRef === 'ALERT-FAILOVER') envelope = buildAlert(step.alertRef, step.routeId, step.attemptNumber);
                const admissionReason = alertAdmission(envelope);
                if (admissionReason) { failures.push(`rehearsal step ${step.sequence} admission failed: ${admissionReason}`); continue; }
                const marker = `delivery-${envelope.alert.idempotencyKey}.json`;
                let outcome;
                try {
                    writeLedger(marker, { alertId: envelope.alert.alertId, routeId: step.routeId, attemptNumber: step.attemptNumber, transportOutcome: step.transportOutcome, externalActionAuthorized: false, sensitivePayloadIncluded: false });
                    deliveryAttemptCount += 1;
                    if (step.transportOutcome === 'delivered') { outcome = 'delivered'; successfulDeliveryCount += 1; }
                    else { outcome = 'delivery_failed'; failedDeliveryCount += 1; }
                } catch (error) {
                    if (error.code === 'EEXIST') { outcome = 'duplicate_suppressed'; duplicateSuppressionCount += 1; }
                    else throw error;
                }
                if (outcome !== step.expectedOutcome) failures.push(`rehearsal step ${step.sequence} returned ${outcome} instead of ${step.expectedOutcome}`);
                if (outcome === 'delivered') {
                    const acknowledgement = makeAcknowledgement(envelope, step.routeId);
                    const ackReason = acknowledgementAdmission(envelope, acknowledgement);
                    if (ackReason) failures.push(`rehearsal acknowledgement failed: ${ackReason}`);
                    else {
                        writeLedger(`ack-${acknowledgement.acknowledgement.acknowledgementId}.json`, acknowledgement.acknowledgement);
                        verifiedAcknowledgementCount += 1;
                    }
                    if (step.routeId === 'SYN-BACKUP') failoverCount += 1;
                }
            }

            const baseEnvelope = logicalAlerts['ALERT-PRIMARY'];
            const baseAck = makeAcknowledgement(baseEnvelope, 'SYN-PRIMARY');
            for (const scenario of refusalPlan.scenarios) {
                let envelope = clone(baseEnvelope);
                let acknowledgement = clone(baseAck);
                let reason;
                const resignAlert = () => { envelope.signature = sign(envelope.alert, sender.privateKey); };
                const resignAck = () => { acknowledgement.signature = sign(acknowledgement.acknowledgement, primaryRecipient.privateKey); };
                if (scenario.id === 'AR-001') envelope.signature = Buffer.from('invalid').toString('base64');
                if (scenario.id === 'AR-002') { envelope.alert.sourceRunDigestSha256 = '0'.repeat(64); resignAlert(); }
                if (scenario.id === 'AR-003') { envelope.alert.historyEvidenceDigestSha256 = '0'.repeat(64); resignAlert(); }
                if (scenario.id === 'AR-004') { envelope.alert.expiresAt = '2026-08-11T12:00:30.000Z'; resignAlert(); }
                if (scenario.id === 'AR-005') { envelope.alert.notBefore = '2026-08-11T12:02:00.000Z'; resignAlert(); }
                if (scenario.id === 'AR-006') { envelope.alert.severity = 'medium'; resignAlert(); }
                if (scenario.id === 'AR-007') { envelope.alert.payload = 'prohibited'; resignAlert(); }
                if (scenario.id === 'AR-008') { envelope.alert.externalActionAuthorized = true; resignAlert(); }
                if (scenario.id === 'AR-009') { envelope.alert.sensitivePayloadIncluded = true; resignAlert(); }
                if (scenario.id === 'AR-010') { envelope.alert.recipientRoleRef = 'wrong_recipient'; resignAlert(); }
                if (scenario.id === 'AR-012') { envelope.alert.attemptNumber = 3; resignAlert(); }
                if (scenario.id === 'AR-013') { envelope.alert.changeIds = Array.from({ length: 300 }, (_, index) => `CHG-${String(index).padStart(4, '0')}-${'X'.repeat(20)}`); envelope.alert.changeCount = 300; resignAlert(); }
                if (scenario.id === 'AR-014') acknowledgement.signature = sign(acknowledgement.acknowledgement, sender.privateKey);
                if (scenario.id === 'AR-015') { acknowledgement.acknowledgement.alertId = 'ALT-WRONG'; resignAck(); }
                if (scenario.id === 'AR-016') { acknowledgement.acknowledgement.payload = 'prohibited'; resignAck(); }
                if (['AR-014', 'AR-015', 'AR-016'].includes(scenario.id)) reason = acknowledgementAdmission(envelope, acknowledgement);
                else reason = alertAdmission(envelope, scenario.id === 'AR-011' ? new Set(['SYN-PRIMARY']) : new Set());
                const refused = reason === scenario.expectedReasonCode;
                refusalResults.push({ scenarioId: scenario.id, expectedReasonCode: scenario.expectedReasonCode, actualReasonCode: reason, refused });
                if (!refused) failures.push(`${scenario.id} returned ${reason || 'accepted'} instead of ${scenario.expectedReasonCode}`);
            }
        }
    } finally {
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        if (repositoryMutationPaths.length) failures.push(`rehearsal changed repository paths: ${repositoryMutationPaths.join(', ')}`);
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && eligibleChangeCount === 1 && alertCount === 2 && deliveryAttemptCount === 4 && successfulDeliveryCount === 2 && failedDeliveryCount === 2 && verifiedAcknowledgementCount === 2 && duplicateSuppressionCount === 1 && failoverCount === 1 && refusedScenarioCount === 16 && repositoryMutationPaths.length === 0 && failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-047',
    mode: options.validateOnly ? 'contract validation only' : 'offline metadata-only authenticated exception-delivery and failure rehearsal',
    deliveryContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    eligibleChangeCount,
    alertCount,
    syntheticRouteCount: contract.syntheticRoutes?.length || 0,
    ephemeralIdentityCount: rehearsalPerformed && sourceEvidenceCurrent ? 3 : 0,
    deliveryAttemptCount,
    successfulDeliveryCount,
    failedDeliveryCount,
    verifiedAcknowledgementCount,
    duplicateSuppressionCount,
    failoverCount,
    ledgerWriteCount,
    refusalScenarioCount: refusalResults.length,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.filter(item => !item.refused).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    rawPayloadDeliveredCount: 0,
    contactDetailStoredCount: 0,
    productionRouteConfiguredCount: contract.configuredProductionRouteCount,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount,
    recipientConfirmationRecorded: contract.productionDeliveryPolicy?.recipientConfirmationRecorded === true,
    durableDeliveryStoreConfigured: contract.productionDeliveryPolicy?.deliveryReceiptStoreConfigured === true,
    authenticatedProductionRouteConfigured: contract.productionDeliveryPolicy?.routeAuthenticationVerified === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    deliveryContractReadyForReview: contract.deliveryContractReadyForReview === true && contractFailureCount === 0,
    productionDeliveryReady: contract.productionDeliveryReady === true,
    eligibleCycleReady: contract.eligibleCycleReady === true,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    failures,
    refusalResults
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
