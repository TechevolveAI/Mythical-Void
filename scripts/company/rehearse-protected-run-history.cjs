#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-run-history-reconciliation.json');

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
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

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

function executeJson(relative, expectedExit) {
    const result = spawnSync(process.execPath, [path.join(repositoryRoot, relative)], { cwd: repositoryRoot, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    let output = null;
    try { output = JSON.parse(result.stdout); } catch {}
    return { status: result.status, raw: result.stdout || '', output, valid: result.status === expectedExit && output };
}

function digestRecord(record) {
    const body = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordDigestSha256'));
    return sha256(JSON.stringify(body));
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected run-history reconciliation contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_tamper_evident_history_rehearsal_ready_production_store_gated') failures.push('status must remain offline_tamper_evident_history_rehearsal_ready_production_store_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 300) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-015', 'A-016', 'A-017', 'A-031', 'A-041', 'A-042', 'A-043', 'A-044', 'A-045', 'A-046'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionHistoryWriteAuthorized', 'productionHistoryReadAuthorized', 'productionRetentionAuthorized', 'productionIdentityCreationAuthorized', 'protectedInputBindingAuthorized', 'packetExecutionAuthorized', 'schedulerActivationAuthorized', 'networkActivationAuthorized', 'credentialUseAuthorized', 'alertDeliveryAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.packetWorkflowId !== 'A-042' || source.consumerRehearsalWorkflowId !== 'A-044' || source.admissionRehearsalWorkflowId !== 'A-045') failures.push('sourceEvidence workflow bindings are invalid');
requireTrue(source, ['livePacketDigestsRequired', 'currentConsumerEvidenceDigestRequired', 'currentAdmissionEvidenceDigestRequired', 'syntheticEvidenceOnly'], 'sourceEvidence', failures);
requireFalse(source, ['rawSourceOutputPermittedInHistory'], 'sourceEvidence', failures);

const recordFields = ['schemaVersion', 'sequence', 'recordId', 'recordedAt', 'eventType', 'rootRunId', 'parentRecordId', 'workflowId', 'workflowVersion', 'sourceId', 'packetId', 'packetContentDigestSha256', 'evidenceDigestSha256', 'outcome', 'externalActionAuthorized', 'sensitivePayloadIncluded', 'previousRecordDigestSha256', 'recordDigestSha256'];
const recordPolicy = contract.recordPolicy || {};
if (recordPolicy.recordSchemaVersion !== 1 || recordPolicy.chainDigestAlgorithm !== 'sha256' || recordPolicy.recordCount !== 8 || recordPolicy.branchCount !== 2 || !sameJson(recordPolicy.recordFields, recordFields)) failures.push('recordPolicy schema, counts, digest, or fields are invalid');
requireFalse(recordPolicy, ['payloadFieldsPermitted', 'signatureOrKeyMaterialPermitted', 'credentialOrSecretMaterialPermitted', 'personalOrCustomerDataPermitted', 'externalActionAuthorized', 'sensitivePayloadIncluded', 'recordOverwritePermitted', 'recordDeletionPermitted', 'sequenceGapPermitted', 'orphanRecordPermitted', 'duplicateRecordIdPermitted'], 'recordPolicy', failures);

const expectedEvents = [
    [1, 'source_collected', 'A-015', 'OC-003', null, 'collected'],
    [2, 'envelope_admitted', 'A-016', 'OT-002', 1, 'admitted'],
    [3, 'consumer_completed', 'A-016', 'OT-002', 2, 'completed'],
    [4, 'evaluation_completed', 'A-016', 'OT-002', 3, 'passed'],
    [5, 'envelope_admitted', 'A-017', 'OT-003', 1, 'admitted'],
    [6, 'consumer_completed', 'A-017', 'OT-003', 5, 'completed'],
    [7, 'evaluation_completed', 'A-017', 'OT-003', 6, 'passed'],
    [8, 'history_reconciled', 'A-046', null, 1, 'reconciled']
];
const eventPlan = contract.eventPlan || [];
if (eventPlan.length !== 8) failures.push('eventPlan must contain exactly 8 records');
for (let index = 0; index < expectedEvents.length; index += 1) {
    const event = eventPlan[index] || {};
    const actual = [event.sequence, event.eventType, event.workflowId, event.sourceId, event.parentSequence, event.outcome];
    if (!sameJson(actual, expectedEvents[index])) failures.push(`eventPlan sequence ${index + 1} is invalid`);
}

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_create_record_files' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionHistory', 'countsAsEligibleCycle', 'productionStoreConfigured'], 'rehearsalStore', failures);

const reconciliation = contract.reconciliationPolicy || {};
requireTrue(reconciliation, ['exactEventPlanRequired', 'continuousSequenceRequired', 'uniqueRecordIdsRequired', 'previousDigestLinkRequired', 'recordDigestRecomputationRequired', 'parentRecordResolutionRequired', 'rootRunConsistencyRequired', 'livePacketBindingRequired', 'evidenceDigestBindingRequired', 'authorityAndPayloadFlagsMustRemainFalse'], 'reconciliationPolicy', failures);
requireFalse(reconciliation, ['unexpectedFieldsPermitted', 'truncatedChainAccepted'], 'reconciliationPolicy', failures);

const expectedTamper = {
    'HT-001': ['modify_record_without_rehash', 'record_digest_mismatch'],
    'HT-002': ['delete_record', 'record_count_invalid'],
    'HT-003': ['reorder_records', 'sequence_order_invalid'],
    'HT-004': ['duplicate_record_id', 'duplicate_record_id'],
    'HT-005': ['break_previous_digest_link', 'previous_digest_mismatch'],
    'HT-006': ['orphan_parent', 'parent_record_missing'],
    'HT-007': ['substitute_packet_id', 'packet_binding_mismatch'],
    'HT-008': ['substitute_packet_digest', 'packet_binding_mismatch'],
    'HT-009': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'HT-010': ['mark_sensitive_payload_included', 'authority_or_payload_flag_invalid'],
    'HT-011': ['add_payload_field', 'record_fields_invalid'],
    'HT-012': ['substitute_evidence_digest', 'evidence_binding_mismatch']
};
const tamper = contract.tamperPlan || {};
if (tamper.scenarioCount !== 12 || tamper.expectedDetectedCount !== 12) failures.push('tamperPlan counts are invalid');
const tamperScenarios = tamper.scenarios || [];
exactSet(tamperScenarios.map(item => item.id), Object.keys(expectedTamper), 'tamper scenario IDs', failures);
for (const item of tamperScenarios) if (!sameJson([item.mutation, item.expectedReasonCode], expectedTamper[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const production = contract.productionHistoryPolicy || {};
requireFalse(production, ['storeClassSelected', 'writerIdentityConfigured', 'readerIdentityConfigured', 'appendOnlyEnforcementVerified', 'tamperEvidenceIndependentlyAnchored', 'deletionPolicyApproved', 'backupConfigured', 'restoreTestPassed', 'accessReviewCompleted', 'exportAndReconciliationTestPassed', 'alertRouteConfigured'], 'productionHistoryPolicy', failures);
if (production.retentionDays !== null) failures.push('productionHistoryPolicy.retentionDays must remain null');

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `HR-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 90) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.recordCount !== 8 || contract.branchCount !== 2 || contract.tamperScenarioCount !== 12 || contract.expectedTamperDetectionCount !== 12) failures.push('top-level history counts are invalid');
for (const field of ['configuredProductionHistoryStoreCount', 'configuredProductionHistoryIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.historyContractReadyForReview !== true) failures.push('historyContractReadyForReview must be true');
for (const field of ['productionHistoryReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 350) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
let records = [];
let storedRecordCount = 0;
let readBackRecordCount = 0;
let repositoryMutationPaths = [];
const tamperResults = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const a042 = executeJson('scripts/company/compile-cadence-work-packets.cjs', 2);
    const a044 = executeJson('scripts/company/rehearse-protected-trigger-binding.cjs', 2);
    const a045 = executeJson('scripts/company/rehearse-protected-trigger-envelope-admission.cjs', 2);
    if (!a042.valid || a042.output.workflow !== 'A-042' || a042.output.packetSetValid !== true) failures.push('A-042 source evidence is invalid');
    if (!a044.valid || a044.output.workflow !== 'A-044' || a044.output.rehearsalValid !== true) failures.push('A-044 source evidence is invalid');
    if (!a045.valid || a045.output.workflow !== 'A-045' || a045.output.rehearsalValid !== true) failures.push('A-045 source evidence is invalid');
    sourceEvidenceCurrent = failures.length === 0;

    if (sourceEvidenceCurrent) {
        const packets = new Map(a042.output.packets.map(packet => [packet.sourceId, packet]));
        const evidenceBySequence = new Map([
            [1, sha256(a042.raw)],
            [2, sha256(`${a045.raw}:PTC-001`)],
            [3, sha256(`${a044.raw}:PTC-001`)],
            [4, sha256(fs.readFileSync(path.join(repositoryRoot, 'scripts/company/test-company-run-record.cjs')))],
            [5, sha256(`${a045.raw}:PTC-002`)],
            [6, sha256(`${a044.raw}:PTC-002`)],
            [7, sha256(fs.readFileSync(path.join(repositoryRoot, 'scripts/company/test-baseline-update-proposal.cjs')))]
        ]);
        const rootRunId = `SYN-A046-${sha256(`${a042.raw}${a044.raw}${a045.raw}`).slice(0, 16).toUpperCase()}`;
        const recordsBySequence = new Map();
        for (const event of eventPlan) {
            const packet = event.sourceId ? packets.get(event.sourceId) : null;
            const evidenceDigest = event.sequence === 8
                ? sha256(records.map(record => record.recordDigestSha256).join(':'))
                : evidenceBySequence.get(event.sequence);
            const body = {
                schemaVersion: 1,
                sequence: event.sequence,
                recordId: `PHR-${String(event.sequence).padStart(4, '0')}-${sha256(`${event.eventType}:${event.workflowId}:${evidenceDigest}`).slice(0, 12).toUpperCase()}`,
                recordedAt: new Date(Date.parse('2026-08-11T10:20:00.000Z') + (event.sequence - 1) * 1000).toISOString(),
                eventType: event.eventType,
                rootRunId,
                parentRecordId: event.parentSequence === null ? null : recordsBySequence.get(event.parentSequence).recordId,
                workflowId: event.workflowId,
                workflowVersion: 1,
                sourceId: event.sourceId,
                packetId: packet?.packetId || null,
                packetContentDigestSha256: packet?.contentDigestSha256 || null,
                evidenceDigestSha256: evidenceDigest,
                outcome: event.outcome,
                externalActionAuthorized: false,
                sensitivePayloadIncluded: false,
                previousRecordDigestSha256: records.length ? records[records.length - 1].recordDigestSha256 : null
            };
            const record = { ...body, recordDigestSha256: digestRecord(body) };
            records.push(record);
            recordsBySequence.set(event.sequence, record);
        }

        function rehashChain(chain) {
            for (let index = 0; index < chain.length; index += 1) {
                chain[index].previousRecordDigestSha256 = index === 0 ? null : chain[index - 1].recordDigestSha256;
                chain[index].recordDigestSha256 = digestRecord(chain[index]);
            }
        }

        function reconcile(chain) {
            if (chain.length !== 8) return 'record_count_invalid';
            if (chain.some((record, index) => record.sequence !== index + 1)) return 'sequence_order_invalid';
            if (chain.some(record => !sameJson(Object.keys(record), recordFields))) return 'record_fields_invalid';
            if (new Set(chain.map(record => record.recordId)).size !== chain.length) return 'duplicate_record_id';
            for (const record of chain) if (record.recordDigestSha256 !== digestRecord(record)) return 'record_digest_mismatch';
            for (let index = 0; index < chain.length; index += 1) {
                const expectedPrevious = index === 0 ? null : chain[index - 1].recordDigestSha256;
                if (chain[index].previousRecordDigestSha256 !== expectedPrevious) return 'previous_digest_mismatch';
            }
            if (new Set(chain.map(record => record.rootRunId)).size !== 1) return 'root_run_mismatch';
            const byId = new Map(chain.map(record => [record.recordId, record]));
            for (let index = 0; index < chain.length; index += 1) {
                const record = chain[index];
                const event = eventPlan[index];
                if (record.eventType !== event.eventType || record.workflowId !== event.workflowId || record.sourceId !== event.sourceId || record.outcome !== event.outcome) return 'event_plan_mismatch';
                if (event.parentSequence === null) {
                    if (record.parentRecordId !== null) return 'parent_record_mismatch';
                } else {
                    if (!byId.has(record.parentRecordId)) return 'parent_record_missing';
                    if (record.parentRecordId !== chain[event.parentSequence - 1].recordId) return 'parent_record_mismatch';
                }
                const packet = event.sourceId ? packets.get(event.sourceId) : null;
                if (record.packetId !== (packet?.packetId || null) || record.packetContentDigestSha256 !== (packet?.contentDigestSha256 || null)) return 'packet_binding_mismatch';
                const expectedEvidence = event.sequence === 8 ? sha256(chain.slice(0, 7).map(item => item.recordDigestSha256).join(':')) : evidenceBySequence.get(event.sequence);
                if (record.evidenceDigestSha256 !== expectedEvidence) return 'evidence_binding_mismatch';
                if (record.externalActionAuthorized !== false || record.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
            }
            return null;
        }

        const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a046-'));
        fs.chmodSync(temporaryDirectory, 0o700);
        const before = snapshotTree(['docs/company', 'scripts/company']);
        try {
            for (const record of records) {
                const target = path.join(temporaryDirectory, `${String(record.sequence).padStart(4, '0')}-${record.recordId}.json`);
                fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
                storedRecordCount += 1;
            }
            const storedFiles = fs.readdirSync(temporaryDirectory).sort();
            const readBack = storedFiles.map(file => JSON.parse(fs.readFileSync(path.join(temporaryDirectory, file), 'utf8')));
            readBackRecordCount = readBack.length;
            const liveReason = reconcile(readBack);
            if (liveReason) failures.push(`live history reconciliation failed: ${liveReason}`);

            for (const scenario of tamperScenarios) {
                const chain = clone(records);
                if (scenario.id === 'HT-001') chain[2].outcome = 'failed';
                if (scenario.id === 'HT-002') chain.splice(3, 1);
                if (scenario.id === 'HT-003') [chain[1], chain[2]] = [chain[2], chain[1]];
                if (scenario.id === 'HT-004') { chain[1].recordId = chain[0].recordId; rehashChain(chain); }
                if (scenario.id === 'HT-005') { chain[2].previousRecordDigestSha256 = '0'.repeat(64); chain[2].recordDigestSha256 = digestRecord(chain[2]); }
                if (scenario.id === 'HT-006') { chain[2].parentRecordId = 'PHR-MISSING'; rehashChain(chain); }
                if (scenario.id === 'HT-007') { chain[1].packetId = 'CWP-0000000000000000'; rehashChain(chain); }
                if (scenario.id === 'HT-008') { chain[1].packetContentDigestSha256 = '0'.repeat(64); rehashChain(chain); }
                if (scenario.id === 'HT-009') { chain[1].externalActionAuthorized = true; rehashChain(chain); }
                if (scenario.id === 'HT-010') { chain[1].sensitivePayloadIncluded = true; rehashChain(chain); }
                if (scenario.id === 'HT-011') { chain[1].payload = 'prohibited synthetic content'; rehashChain(chain); }
                if (scenario.id === 'HT-012') { chain[1].evidenceDigestSha256 = '0'.repeat(64); rehashChain(chain); }
                const reasonCode = reconcile(chain);
                const detected = reasonCode === scenario.expectedReasonCode;
                tamperResults.push({ scenarioId: scenario.id, expectedReasonCode: scenario.expectedReasonCode, actualReasonCode: reasonCode, detected });
                if (!detected) failures.push(`${scenario.id} returned ${reasonCode || 'accepted'} instead of ${scenario.expectedReasonCode}`);
            }
        } finally {
            const after = snapshotTree(['docs/company', 'scripts/company']);
            repositoryMutationPaths = snapshotDifferences(before, after);
            if (repositoryMutationPaths.length) failures.push(`rehearsal changed repository paths: ${repositoryMutationPaths.join(', ')}`);
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        }
    }
}

const detectedTamperCount = tamperResults.filter(item => item.detected).length;
const historyChainValid = rehearsalPerformed && sourceEvidenceCurrent && records.length === 8 && storedRecordCount === 8 && readBackRecordCount === 8 && failures.length === 0;
const reconciliationValid = historyChainValid && detectedTamperCount === 12;

console.log(JSON.stringify({
    workflow: 'A-046',
    mode: options.validateOnly ? 'contract validation only' : 'offline payload-free protected run-history hash-chain and reconciliation rehearsal',
    historyContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    historyChainValid,
    reconciliationValid,
    recordCount: records.length,
    storedRecordCount,
    readBackRecordCount,
    branchCount: 2,
    tamperScenarioCount: tamperResults.length,
    detectedTamperCount,
    undetectedTamperCount: tamperResults.filter(item => !item.detected).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    rawPayloadStoredCount: 0,
    sensitiveMaterialStoredCount: 0,
    productionHistoryStoreConfigured: contract.productionHistoryPolicy?.storeClassSelected === true,
    productionHistoryIdentityCount: contract.configuredProductionHistoryIdentityCount,
    retentionPolicyApproved: contract.productionHistoryPolicy?.retentionDays !== null && contract.productionHistoryPolicy?.deletionPolicyApproved === true,
    backupAndRestoreReady: contract.productionHistoryPolicy?.backupConfigured === true && contract.productionHistoryPolicy?.restoreTestPassed === true,
    authenticatedAlertRouteConfigured: contract.productionHistoryPolicy?.alertRouteConfigured === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    historyContractReadyForReview: contract.historyContractReadyForReview === true && contractFailureCount === 0,
    productionHistoryReady: contract.productionHistoryReady === true,
    eligibleCycleReady: contract.eligibleCycleReady === true,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    failures,
    tamperResults
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
