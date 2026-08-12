#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-trigger-envelope-admission.json');

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

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
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

function snapshotTree(relativeRoots) {
    const snapshot = new Map();
    function visit(absolute, relative) {
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) return snapshot.set(relative, `link:${fs.readlinkSync(absolute)}`);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(absolute).sort()) visit(path.join(absolute, entry), path.join(relative, entry));
            return;
        }
        if (stat.isFile()) snapshot.set(relative, `file:${stat.mode & 0o777}:${stat.size}:${sha256(fs.readFileSync(absolute))}`);
    }
    for (const root of relativeRoots) visit(path.join(repositoryRoot, root), root);
    return snapshot;
}

function compareSnapshots(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).sort();
}

function selectedObject(value, fields) {
    return Object.fromEntries(fields.map(field => [field, value[field]]));
}

function canonicalReplayKey(envelope) {
    return sha256(JSON.stringify(selectedObject(envelope, ['sourceRunId', 'consumerPacketId', 'payloadDigestSha256'])));
}

function canonicalEnvelopeId(envelope, signedFields) {
    const fields = signedFields.filter(field => field !== 'envelopeId');
    return `PTE-${sha256(JSON.stringify(selectedObject(envelope, fields))).slice(0, 20).toUpperCase()}`;
}

function signEnvelope(envelope, signedFields, privateKey) {
    return crypto.sign(null, Buffer.from(JSON.stringify(selectedObject(envelope, signedFields))), privateKey).toString('base64');
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected trigger envelope admission contract');
const bindingContract = loadJson(path.join(repositoryRoot, 'docs/company/automation/protected-trigger-binding.json'), 'A-044 binding contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_cryptographic_admission_rehearsal_ready_live_trust_gated') failures.push('status must remain offline_cryptographic_admission_rehearsal_ready_live_trust_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 260) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-015', 'A-016', 'A-017', 'A-031', 'A-041', 'A-042', 'A-043', 'A-044', 'A-045'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = [
    'productionEnvelopeAdmissionAuthorized', 'productionPayloadUseAuthorized', 'productionIdentityCreationAuthorized',
    'trustStoreConfigurationAuthorized', 'protectedInputBindingAuthorized', 'packetExecutionAuthorized',
    'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'networkActivationAuthorized',
    'historyPersistenceAuthorized', 'repositoryWriteAuthorized', 'credentialUseAuthorized',
    'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'
];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const packetBinding = contract.packetBinding || {};
if (packetBinding.parentSourceId !== 'OC-003' || packetBinding.parentWorkflowId !== 'A-015') failures.push('packetBinding parent identity is invalid');
requireTrue(packetBinding, ['parentPacketIdDerivedFromLiveA042', 'parentPacketContentDigestRequired', 'consumerPacketIdDerivedFromLiveA042', 'consumerPacketContentDigestRequired'], 'packetBinding', failures);
if (packetBinding.staleHardCodedPacketIdsPermitted !== false) failures.push('packetBinding.staleHardCodedPacketIdsPermitted must remain false');
const expectedConsumers = {
    'PTC-001': { sourceTriggerId: 'OT-002', targetWorkflowId: 'A-016', targetWorkflowVersion: 1, syntheticPayloadScenarioId: 'PTS-001' },
    'PTC-002': { sourceTriggerId: 'OT-003', targetWorkflowId: 'A-017', targetWorkflowVersion: 1, syntheticPayloadScenarioId: 'PTS-002' }
};
const consumers = packetBinding.consumers || [];
exactSet(consumers.map(item => item.consumerId), Object.keys(expectedConsumers), 'consumer IDs', failures);
for (const consumer of consumers) {
    const expected = expectedConsumers[consumer.consumerId];
    if (!expected || !Object.entries(expected).every(([field, value]) => consumer[field] === value)) failures.push(`${consumer.consumerId} packet binding is invalid`);
    if (!(bindingContract.syntheticScenarios || []).some(item => item.id === consumer.syntheticPayloadScenarioId && item.consumerId === consumer.consumerId)) failures.push(`${consumer.consumerId} does not match A-044 synthetic evidence`);
}

const signedFields = ['schemaVersion', 'envelopeId', 'issuedAt', 'expiresAt', 'issuerIdentityRef', 'sourceWorkflowId', 'sourceWorkflowVersion', 'sourceRunId', 'parentPacketId', 'parentPacketContentDigestSha256', 'consumerPacketId', 'consumerPacketContentDigestSha256', 'targetWorkflowId', 'targetWorkflowVersion', 'payloadDigestSha256', 'payloadSizeBytes', 'payloadContractVersion', 'replayKeySha256'];
const cryptographic = contract.cryptographicPolicy || {};
if (cryptographic.signatureAlgorithm !== 'Ed25519') failures.push('cryptographicPolicy.signatureAlgorithm must be Ed25519');
requireTrue(cryptographic, ['signatureVerificationRequired', 'ephemeralSyntheticKeypairGeneratedPerRehearsal'], 'cryptographicPolicy', failures);
requireFalse(cryptographic, ['rehearsalKeyIsProductionCredential', 'productionIssuerIdentityConfigured', 'productionVerifierIdentityConfigured', 'productionTrustStoreConfigured', 'keyRotationConfigured', 'keyRevocationConfigured', 'unknownKeyPermitted', 'unsignedEnvelopePermitted'], 'cryptographicPolicy', failures);
if (!sameJson(cryptographic.signedFields, signedFields)) failures.push('cryptographicPolicy.signedFields is invalid or reordered');

const time = contract.timePolicy || {};
if (time.rehearsalClock !== '2026-08-11T10:06:00.000Z' || time.maximumAgeSeconds !== 300 || time.maximumClockSkewSeconds !== 60 || time.envelopeLifetimeSeconds !== 300) failures.push('timePolicy rehearsal clock or limits are invalid');
requireFalse(time, ['trustedTimeConfigured', 'productionMaximumAgeApproved', 'expiredEnvelopePermitted', 'futureEnvelopeBeyondSkewPermitted'], 'timePolicy', failures);

const payloadPolicy = contract.payloadPolicy || {};
if (payloadPolicy.sourceWorkflowId !== 'A-015' || payloadPolicy.sourceWorkflowVersion !== 1 || payloadPolicy.payloadContractVersion !== 1 || payloadPolicy.digestAlgorithm !== 'sha256') failures.push('payloadPolicy source, version, or digest is invalid');
requireTrue(payloadPolicy, ['digestVerificationRequired', 'byteLengthVerificationRequired', 'schemaValidationRequired', 'syntheticPayloadsOnlyInRehearsal'], 'payloadPolicy', failures);
requireFalse(payloadPolicy, ['productionPayloadAccepted', 'payloadContentPermittedInAdmissionLog'], 'payloadPolicy', failures);

const replay = contract.replayPolicy || {};
if (!sameJson(replay.replayKeyFields, ['sourceRunId', 'consumerPacketId', 'payloadDigestSha256']) || replay.replayKeyAlgorithm !== 'sha256') failures.push('replayPolicy key fields or algorithm are invalid');
if (replay.rehearsalLedgerKind !== 'operating_system_temporary_exclusive_create_files' || replay.duplicateEnvelopeBehavior !== 'reject_before_consumer_invocation') failures.push('replayPolicy ledger kind or duplicate behavior is invalid');
requireTrue(replay, ['exclusiveCreateRequired', 'rehearsalLedgerOutsideRepositoryRequired', 'rehearsalLedgerEntriesRemovedAfterRun'], 'replayPolicy', failures);
requireFalse(replay, ['rehearsalLedgerCountsAsProtectedHistory', 'durableReplayStoreConfigured', 'atomicProductionReplayProtectionVerified'], 'replayPolicy', failures);

const logging = contract.loggingPolicy || {};
if (!sameJson(logging.allowedResultFields, ['scenarioId', 'expectedDisposition', 'actualDisposition', 'reasonCode', 'signatureVerified', 'ledgerWriteCreated'])) failures.push('loggingPolicy.allowedResultFields is invalid');
requireFalse(logging, ['payloadContentPermitted', 'signatureValuePermitted', 'publicKeyValuePermitted', 'sourceRunIdPermitted', 'payloadPathPermitted', 'repositoryMutationPermitted'], 'loggingPolicy', failures);

const plan = contract.rehearsalPlan || {};
if (plan.validScenarioCount !== 2 || plan.attackScenarioCount !== 12 || plan.admissionAttemptCount !== 14 || plan.expectedAcceptedCount !== 2 || plan.expectedRejectedCount !== 12 || plan.expectedReplayRejectionCount !== 2 || plan.expectedEphemeralLedgerWriteCount !== 2) failures.push('rehearsalPlan counts are invalid');
requireFalse(plan, ['consumerInvocationPermitted', 'eligibleCycleCreditPermitted'], 'rehearsalPlan', failures);
const expectedAttacks = {
    'PEA-001': ['repeat_PTC-001_envelope', 'replay_detected'],
    'PEA-002': ['repeat_PTC-002_envelope', 'replay_detected'],
    'PEA-003': ['invalid_signature', 'signature_invalid'],
    'PEA-004': ['payload_digest_mismatch', 'payload_digest_mismatch'],
    'PEA-005': ['payload_size_mismatch', 'payload_size_mismatch'],
    'PEA-006': ['expired_envelope', 'envelope_expired'],
    'PEA-007': ['issued_beyond_clock_skew', 'issued_in_future'],
    'PEA-008': ['source_workflow_mismatch', 'source_workflow_mismatch'],
    'PEA-009': ['parent_packet_mismatch', 'parent_packet_mismatch'],
    'PEA-010': ['consumer_packet_mismatch', 'consumer_packet_mismatch'],
    'PEA-011': ['target_workflow_mismatch', 'target_workflow_mismatch'],
    'PEA-012': ['replay_key_mismatch', 'replay_key_mismatch']
};
const attacks = plan.attackScenarios || [];
exactSet(attacks.map(item => item.id), Object.keys(expectedAttacks), 'attack scenario IDs', failures);
for (const attack of attacks) if (!sameJson([attack.mutation, attack.expectedReasonCode], expectedAttacks[attack.id])) failures.push(`${attack.id} mutation or reason is invalid`);

const gates = contract.activationGates || [];
if (gates.length !== 16) failures.push('activationGates must contain exactly 16 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 16 }, (_, index) => `EA-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 90) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.consumerCount !== 2 || contract.admissionAttemptCount !== 14 || contract.expectedAcceptedCount !== 2 || contract.expectedRejectedCount !== 12) failures.push('top-level rehearsal counts are invalid');
for (const field of ['configuredProductionIdentityCount', 'configuredTrustStoreCount', 'configuredDurableReplayStoreCount', 'configuredProtectedHistoryCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.admissionContractReadyForReview !== true) failures.push('admissionContractReadyForReview must be true');
for (const field of ['productionAdmissionReady', 'consumerInvocationReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 300) failures.push('nextDecision is incomplete');

const compiler = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/company/compile-cadence-work-packets.cjs')], { cwd: repositoryRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 5 * 1024 * 1024 });
let packetSet = null;
try { packetSet = JSON.parse(compiler.stdout); } catch { failures.push('A-042 packet set could not be parsed'); }
if (!packetSet || compiler.status !== 2 || packetSet.packetSetValid !== true) failures.push('A-042 packet set must remain valid and gated');
const packetsBySource = new Map((packetSet?.packets || []).map(packet => [packet.sourceId, packet]));
const parentPacket = packetsBySource.get('OC-003');
if (!parentPacket || parentPacket.workflowId !== 'A-015') failures.push('live OC-003 parent packet is missing or invalid');
for (const consumer of consumers) {
    const packet = packetsBySource.get(consumer.sourceTriggerId);
    if (!packet || packet.workflowId !== consumer.targetWorkflowId || packet.inputBinding?.sourceWorkflowId !== 'A-015' || packet.inputBinding?.bindingConfigured !== false) failures.push(`${consumer.consumerId} live consumer packet is missing or invalid`);
}

const contractFailureCount = failures.length;
const results = [];
let repositoryMutationPaths = [];
let rehearsalPerformed = false;
if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a045-'));
    const ledgerDirectory = path.join(temporaryDirectory, 'replay');
    fs.mkdirSync(ledgerDirectory, { mode: 0o700 });
    const before = snapshotTree(['docs/company', 'scripts/company']);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const now = new Date(time.rehearsalClock);

    function makeEnvelope(consumer, payloadRaw, sourceRunId, overrides = {}) {
        const consumerPacket = packetsBySource.get(consumer.sourceTriggerId);
        const base = {
            schemaVersion: 1,
            issuedAt: '2026-08-11T10:05:00.000Z',
            expiresAt: '2026-08-11T10:10:00.000Z',
            issuerIdentityRef: 'synthetic_ephemeral_A-045',
            sourceWorkflowId: 'A-015',
            sourceWorkflowVersion: 1,
            sourceRunId,
            parentPacketId: parentPacket.packetId,
            parentPacketContentDigestSha256: parentPacket.contentDigestSha256,
            consumerPacketId: consumerPacket.packetId,
            consumerPacketContentDigestSha256: consumerPacket.contentDigestSha256,
            targetWorkflowId: consumer.targetWorkflowId,
            targetWorkflowVersion: consumer.targetWorkflowVersion,
            payloadDigestSha256: sha256(payloadRaw),
            payloadSizeBytes: Buffer.byteLength(payloadRaw),
            payloadContractVersion: 1,
            ...overrides
        };
        base.replayKeySha256 = overrides.replayKeySha256 || canonicalReplayKey(base);
        base.envelopeId = canonicalEnvelopeId(base, signedFields);
        const envelope = selectedObject(base, signedFields);
        envelope.signatureBase64 = signEnvelope(envelope, signedFields, privateKey);
        return envelope;
    }

    function admit(scenarioId, expectedDisposition, envelope, payloadRaw, consumer) {
        let actualDisposition = 'rejected';
        let reasonCode = null;
        let signatureVerified = false;
        let ledgerWriteCreated = false;
        const allowedEnvelopeFields = [...signedFields, 'signatureBase64'];
        if (!sameJson(Object.keys(envelope), allowedEnvelopeFields)) reasonCode = 'envelope_fields_invalid';
        if (!reasonCode) {
            try { signatureVerified = crypto.verify(null, Buffer.from(JSON.stringify(selectedObject(envelope, signedFields))), publicKey, Buffer.from(envelope.signatureBase64, 'base64')); }
            catch { signatureVerified = false; }
            if (!signatureVerified) reasonCode = 'signature_invalid';
        }
        if (!reasonCode && envelope.envelopeId !== canonicalEnvelopeId(envelope, signedFields)) reasonCode = 'envelope_id_mismatch';
        if (!reasonCode && (envelope.sourceWorkflowId !== 'A-015' || envelope.sourceWorkflowVersion !== 1)) reasonCode = 'source_workflow_mismatch';
        if (!reasonCode && (envelope.parentPacketId !== parentPacket.packetId || envelope.parentPacketContentDigestSha256 !== parentPacket.contentDigestSha256)) reasonCode = 'parent_packet_mismatch';
        const consumerPacket = packetsBySource.get(consumer.sourceTriggerId);
        if (!reasonCode && (envelope.consumerPacketId !== consumerPacket.packetId || envelope.consumerPacketContentDigestSha256 !== consumerPacket.contentDigestSha256)) reasonCode = 'consumer_packet_mismatch';
        if (!reasonCode && (envelope.targetWorkflowId !== consumer.targetWorkflowId || envelope.targetWorkflowVersion !== consumer.targetWorkflowVersion)) reasonCode = 'target_workflow_mismatch';
        if (!reasonCode && envelope.payloadDigestSha256 !== sha256(payloadRaw)) reasonCode = 'payload_digest_mismatch';
        if (!reasonCode && envelope.payloadSizeBytes !== Buffer.byteLength(payloadRaw)) reasonCode = 'payload_size_mismatch';
        const issuedAt = new Date(envelope.issuedAt);
        const expiresAt = new Date(envelope.expiresAt);
        if (!reasonCode && (Number.isNaN(issuedAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= issuedAt || (expiresAt - issuedAt) / 1000 > time.envelopeLifetimeSeconds)) reasonCode = 'time_window_invalid';
        if (!reasonCode && issuedAt.getTime() > now.getTime() + time.maximumClockSkewSeconds * 1000) reasonCode = 'issued_in_future';
        if (!reasonCode && expiresAt.getTime() <= now.getTime()) reasonCode = 'envelope_expired';
        if (!reasonCode && (now.getTime() - issuedAt.getTime()) / 1000 > time.maximumAgeSeconds) reasonCode = 'envelope_stale';
        if (!reasonCode && envelope.replayKeySha256 !== canonicalReplayKey(envelope)) reasonCode = 'replay_key_mismatch';
        if (!reasonCode) {
            const ledgerPath = path.join(ledgerDirectory, `${envelope.replayKeySha256}.json`);
            try {
                fs.writeFileSync(ledgerPath, `${JSON.stringify({ admitted: true })}\n`, { flag: 'wx', mode: 0o600 });
                ledgerWriteCreated = true;
                actualDisposition = 'accepted';
                reasonCode = 'synthetic_admission_accepted';
            } catch (error) {
                reasonCode = error.code === 'EEXIST' ? 'replay_detected' : 'ledger_write_failed';
            }
        }
        const result = { scenarioId, expectedDisposition, actualDisposition, reasonCode, signatureVerified, ledgerWriteCreated };
        results.push(result);
        return result;
    }

    try {
        const prepared = new Map();
        for (const consumer of consumers) {
            const scenario = bindingContract.syntheticScenarios.find(item => item.id === consumer.syntheticPayloadScenarioId);
            const payloadRaw = `${JSON.stringify(scenario.payload, null, 2)}\n`;
            const envelope = makeEnvelope(consumer, payloadRaw, `SYN-A015-${consumer.consumerId}-VALID`);
            prepared.set(consumer.consumerId, { consumer, payloadRaw, envelope });
        }
        const first = prepared.get('PTC-001');
        admit('PEV-001', 'accepted', first.envelope, first.payloadRaw, first.consumer);
        admit('PEA-001', 'rejected', first.envelope, first.payloadRaw, first.consumer);
        const second = prepared.get('PTC-002');
        admit('PEV-002', 'accepted', second.envelope, second.payloadRaw, second.consumer);
        admit('PEA-002', 'rejected', second.envelope, second.payloadRaw, second.consumer);

        const baseConsumer = first.consumer;
        const payloadRaw = first.payloadRaw;
        for (const attack of attacks.filter(item => !['PEA-001', 'PEA-002'].includes(item.id))) {
            const runId = `SYN-A015-${attack.id}`;
            let overrides = {};
            if (attack.id === 'PEA-004') overrides.payloadDigestSha256 = '0'.repeat(64);
            if (attack.id === 'PEA-005') overrides.payloadSizeBytes = Buffer.byteLength(payloadRaw) + 1;
            if (attack.id === 'PEA-006') overrides = { issuedAt: '2026-08-11T09:55:00.000Z', expiresAt: '2026-08-11T10:00:00.000Z' };
            if (attack.id === 'PEA-007') overrides = { issuedAt: '2026-08-11T10:08:00.000Z', expiresAt: '2026-08-11T10:13:00.000Z' };
            if (attack.id === 'PEA-008') overrides.sourceWorkflowId = 'A-014';
            if (attack.id === 'PEA-009') overrides.parentPacketId = 'CWP-0000000000000000';
            if (attack.id === 'PEA-010') {
                const otherPacket = packetsBySource.get('OT-003');
                overrides.consumerPacketId = otherPacket.packetId;
                overrides.consumerPacketContentDigestSha256 = otherPacket.contentDigestSha256;
            }
            if (attack.id === 'PEA-011') overrides.targetWorkflowId = 'A-017';
            if (attack.id === 'PEA-012') overrides.replayKeySha256 = '0'.repeat(64);
            const envelope = makeEnvelope(baseConsumer, payloadRaw, runId, overrides);
            if (attack.id === 'PEA-003') envelope.signatureBase64 = `${envelope.signatureBase64.slice(0, -4)}AAAA`;
            const result = admit(attack.id, 'rejected', envelope, payloadRaw, baseConsumer);
            if (result.reasonCode !== attack.expectedReasonCode) failures.push(`${attack.id} returned ${result.reasonCode} instead of ${attack.expectedReasonCode}`);
        }
    } finally {
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = compareSnapshots(before, after);
        if (repositoryMutationPaths.length) failures.push(`rehearsal changed repository paths: ${repositoryMutationPaths.join(', ')}`);
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

for (const result of results) if (result.expectedDisposition !== result.actualDisposition) failures.push(`${result.scenarioId} disposition mismatch`);
const acceptedCount = results.filter(item => item.actualDisposition === 'accepted').length;
const rejectedCount = results.filter(item => item.actualDisposition === 'rejected').length;
const replayRejectionCount = results.filter(item => item.reasonCode === 'replay_detected').length;
const ephemeralLedgerWriteCount = results.filter(item => item.ledgerWriteCreated).length;
if (rehearsalPerformed && (results.length !== 14 || acceptedCount !== 2 || rejectedCount !== 12 || replayRejectionCount !== 2 || ephemeralLedgerWriteCount !== 2)) failures.push('rehearsal aggregate outcomes are invalid');
const rehearsalValid = rehearsalPerformed && failures.length === 0 && repositoryMutationPaths.length === 0;

console.log(JSON.stringify({
    workflow: 'A-045',
    mode: options.validateOnly ? 'contract validation only' : 'offline synthetic Ed25519 envelope admission and ephemeral exclusive-create replay rehearsal',
    admissionContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    rehearsalValid,
    livePacketSetCurrent: packetSet?.packetSetValid === true,
    consumerCount: consumers.length,
    admissionAttemptCount: results.length,
    acceptedAdmissionCount: acceptedCount,
    rejectedAdmissionCount: rejectedCount,
    replayRejectionCount,
    syntheticSignatureVerifiedCount: results.filter(item => item.signatureVerified).length,
    ephemeralLedgerWriteCount,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionIssuerIdentityConfigured: cryptographic.productionIssuerIdentityConfigured === true,
    productionVerifierIdentityConfigured: cryptographic.productionVerifierIdentityConfigured === true,
    productionTrustStoreConfigured: cryptographic.productionTrustStoreConfigured === true,
    trustedTimeConfigured: time.trustedTimeConfigured === true,
    durableReplayStoreConfigured: replay.durableReplayStoreConfigured === true,
    protectedHistoryConfigured: contract.configuredProtectedHistoryCount > 0,
    productionPayloadAccepted: payloadPolicy.productionPayloadAccepted === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    admissionContractReadyForReview: contract.admissionContractReadyForReview === true && contractFailureCount === 0,
    productionAdmissionReady: contract.productionAdmissionReady === true,
    consumerInvocationReady: contract.consumerInvocationReady === true,
    consumerInvocationCount: 0,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    failures,
    results
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
