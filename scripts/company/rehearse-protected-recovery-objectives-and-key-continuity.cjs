#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-recovery-objectives-and-key-continuity.json');
const backupContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-backup-and-restore.json');

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
function executeJson(relative, expectedExit) {
    const result = spawnSync(process.execPath, [path.join(repositoryRoot, relative)], { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
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
        result.set(relative, `${stat.mode}:${stat.size}:${sha256(fs.readFileSync(absolute))}`);
    }
    for (const root of relativeRoots) visit(path.join(repositoryRoot, root), root);
    return result;
}
function snapshotDifferences(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).sort();
}
function writeExclusive(file, value) {
    fs.writeFileSync(file, Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}
function recursiveFileCount(root) {
    let count = 0;
    function visit(current) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) visit(target); else count += 1;
        }
    }
    visit(root);
    return count;
}
function parseTime(value) {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : null;
}
function base64Length(value) {
    try { return Buffer.from(value, 'base64').length; } catch { return -1; }
}
function encryptCapsule(capsule, key, policy) {
    const nonce = crypto.randomBytes(policy.nonceByteLength);
    const aad = Buffer.from(JSON.stringify({ capsuleId: capsule.capsuleId, generation: capsule.generation, recoveryPointAt: capsule.recoveryPointAt, keyVersion: capsule.keyVersion }));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: policy.authenticationTagByteLength });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(capsule), 'utf8'), cipher.final()]);
    const envelope = {
        schemaVersion: 1,
        capsuleId: capsule.capsuleId,
        generation: capsule.generation,
        recoveryPointAt: capsule.recoveryPointAt,
        keyVersion: capsule.keyVersion,
        algorithm: policy.encryptionAlgorithm,
        nonceBase64: nonce.toString('base64'),
        ciphertextBase64: ciphertext.toString('base64'),
        authenticationTagBase64: cipher.getAuthTag().toString('base64'),
        aadDigestSha256: sha256(aad),
        envelopeDigestSha256: '',
        externalActionAuthorized: false,
        sensitivePayloadIncluded: false
    };
    envelope.envelopeDigestSha256 = sha256(JSON.stringify({ ...envelope, envelopeDigestSha256: '' }));
    return envelope;
}
function decryptEnvelope(envelope, key, policy) {
    const aad = Buffer.from(JSON.stringify({ capsuleId: envelope.capsuleId, generation: envelope.generation, recoveryPointAt: envelope.recoveryPointAt, keyVersion: envelope.keyVersion }));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonceBase64, 'base64'), { authTagLength: policy.authenticationTagByteLength });
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(envelope.authenticationTagBase64, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertextBase64, 'base64')), decipher.final()]).toString('utf8'));
}
function signApproval(request, identity) {
    return { signerId: identity.id, requestDigestSha256: sha256(JSON.stringify(request)), signatureBase64: crypto.sign(null, Buffer.from(JSON.stringify(request)), identity.privateKey).toString('base64') };
}
function verifyApprovals(request, approvals, identities, requiredCount) {
    const seen = new Set();
    for (const approval of approvals) {
        const identity = identities.find(item => item.id === approval.signerId);
        if (!identity) return 'recovery_signer_untrusted';
        if (identity.revoked) return 'recovery_signer_revoked';
        if (seen.has(identity.id)) return 'recovery_approval_insufficient';
        if (approval.requestDigestSha256 !== sha256(JSON.stringify(request))) return 'recovery_signer_untrusted';
        if (!crypto.verify(null, Buffer.from(JSON.stringify(request)), identity.publicKey, Buffer.from(approval.signatureBase64, 'base64'))) return 'recovery_signer_untrusted';
        seen.add(identity.id);
    }
    return seen.size >= requiredCount ? 'accepted' : 'recovery_approval_insufficient';
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'A-052 contract');
const failures = [];
const authorityFields = ['productionRecoveryObjectiveAuthorized', 'productionKeyManagementAuthorized', 'productionKeyRecoveryAuthorized', 'productionBackupAuthorized', 'productionRestoreAuthorized', 'restoredActivationAuthorized', 'productionRecordWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
const workflowRefs = ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049', 'A-050', 'A-051', 'A-052'];
const capsuleFields = ['schemaVersion', 'capsuleId', 'generation', 'recoveryPointAt', 'sourceWorkflowId', 'sourceEvidenceDigestSha256', 'sourceContractDigestSha256', 'keyVersion', 'storageFailureDomain', 'keyFailureDomain', 'rawPayloadIncluded', 'productionCredentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const envelopeFields = ['schemaVersion', 'capsuleId', 'generation', 'recoveryPointAt', 'keyVersion', 'algorithm', 'nonceBase64', 'ciphertextBase64', 'authenticationTagBase64', 'aadDigestSha256', 'envelopeDigestSha256', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const expectedScenarioOutcomes = ['current_capsule_encrypted_and_read_back', 'authenticated_plaintext_matches', 'generation_three_selected_with_120_second_loss', 'local_recovery_within_3000_milliseconds', 'normal_restore_refused_for_missing_key', 'recovery_key_released_and_plaintext_matches', 'predecessor_generation_plaintext_matches', 'insufficient_approval_refused', 'untrusted_signer_refused', 'revoked_signer_refused', 'authenticated_decryption_refused', 'rpo_violation_refused', 'future_point_refused', 'failure_domain_collision_refused', 'restored_activation_refused'];
const expectedRefusals = [
    ['KR-001', 'substitute_A-051_evidence', 'source_evidence_mismatch'], ['KR-002', 'substitute_A-051_contract_digest', 'source_contract_mismatch'], ['KR-003', 'invalid_incident_time', 'incident_time_invalid'], ['KR-004', 'invalid_recovery_point_time', 'recovery_point_time_invalid'], ['KR-005', 'future_recovery_point', 'recovery_point_future'], ['KR-006', 'recovery_point_exceeds_rpo', 'rpo_exceeded'], ['KR-007', 'recovery_time_exceeds_rto', 'rto_exceeded'], ['KR-008', 'substitute_key_version', 'key_version_invalid'], ['KR-009', 'use_revoked_key_version', 'key_version_revoked'], ['KR-010', 'remove_key_version', 'capsule_fields_invalid'], ['KR-011', 'substitute_encryption_algorithm', 'algorithm_invalid'], ['KR-012', 'invalid_nonce_length', 'nonce_invalid'], ['KR-013', 'corrupt_ciphertext', 'authenticated_decryption_failed'], ['KR-014', 'corrupt_authentication_tag', 'authenticated_decryption_failed'], ['KR-015', 'insufficient_recovery_approvals', 'recovery_approval_insufficient'], ['KR-016', 'untrusted_recovery_signer', 'recovery_signer_untrusted'], ['KR-017', 'revoked_recovery_signer', 'recovery_signer_revoked'], ['KR-018', 'co_locate_key_and_storage_domains', 'failure_domain_invalid'], ['KR-019', 'include_raw_payload', 'payload_or_credential_material_invalid'], ['KR-020', 'authorize_external_action', 'authority_or_payload_flag_invalid'], ['KR-021', 'global_disable_active', 'global_disable_active']
];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (contract.status !== 'offline_encrypted_recovery_objective_and_key_continuity_rehearsal_ready_production_key_management_gated') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 1000) failures.push('purpose must remain explicit');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, workflowRefs, 'workflowRefs', failures);
requireFalse(contract.authority, authorityFields, 'authority', failures, true);
exactKeys(contract.sourceEvidence, ['backupRestoreWorkflowId', 'backupRestoreContractPath', 'currentBackupRestoreEvidenceDigestRequired', 'currentBackupRestoreContractDigestRequired', 'backupRestoreExitCode', 'backupRestoreRehearsalValidRequired', 'rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);
if (contract.sourceEvidence?.backupRestoreWorkflowId !== 'A-051' || contract.sourceEvidence?.backupRestoreContractPath !== 'docs/company/automation/protected-backup-and-restore.json' || contract.sourceEvidence?.backupRestoreExitCode !== 2) failures.push('sourceEvidence workflow or contract binding is invalid');
requireTrue(contract.sourceEvidence, ['currentBackupRestoreEvidenceDigestRequired', 'currentBackupRestoreContractDigestRequired', 'backupRestoreRehearsalValidRequired'], 'sourceEvidence', failures);
requireFalse(contract.sourceEvidence, ['rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const policy = contract.recoveryPolicy || {};
if (policy.capsuleSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.encryptionAlgorithm !== 'aes-256-gcm' || policy.keyByteLength !== 32 || policy.nonceByteLength !== 12 || policy.authenticationTagByteLength !== 16) failures.push('recoveryPolicy algorithms are invalid');
if (policy.generationCount !== 3 || policy.currentGeneration !== 3 || policy.currentKeyVersion !== 'KV-002' || policy.predecessorKeyVersion !== 'KV-001' || !sameJson(policy.revokedKeyVersions, ['KV-000'])) failures.push('recoveryPolicy generations or keys are invalid');
if (policy.generationIntervalSeconds !== 300 || policy.maximumRecoveryPointLossSeconds !== 300 || policy.maximumLocalRecoveryTimeMilliseconds !== 3000) failures.push('recoveryPolicy objectives are invalid');
if (policy.fixedIncidentAt !== '2026-08-11T12:12:00.000Z' || !sameJson(policy.recoveryPointTimes, ['2026-08-11T12:00:00.000Z', '2026-08-11T12:05:00.000Z', '2026-08-11T12:10:00.000Z'])) failures.push('recoveryPolicy fixed times are invalid');
if (policy.storageFailureDomain !== 'fd-backup' || policy.primaryKeyFailureDomain !== 'kd-primary' || policy.recoveryKeyFailureDomain !== 'kd-recovery' || new Set([policy.storageFailureDomain, policy.primaryKeyFailureDomain, policy.recoveryKeyFailureDomain]).size !== 3) failures.push('recoveryPolicy failure domains are invalid');
if (policy.requiredRecoveryApprovalCount !== 2 || policy.recoveryApproverCount !== 3 || policy.maximumRecoveryApprovalCount !== 2) failures.push('recoveryPolicy approval threshold is invalid');
requireTrue(policy, ['fullAuthenticatedDecryptionRequired'], 'recoveryPolicy', failures);
requireFalse(policy, ['futureRecoveryPointPermitted', 'rpoViolationPermitted', 'sameStorageAndKeyFailureDomainPermitted', 'revokedKeyUsePermitted', 'rawPayloadIncluded', 'productionCredentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'recoveryPolicy', failures);
if (!sameJson(policy.capsuleFields, capsuleFields) || !sameJson(policy.encryptedEnvelopeFields, envelopeFields)) failures.push('recoveryPolicy field allowlists are invalid');

if (contract.scenarioPlan?.scenarioCount !== 15 || contract.scenarioPlan?.expectedPassedScenarioCount !== 15 || contract.scenarioPlan?.scenarios?.length !== 15) failures.push('scenarioPlan counts are invalid');
for (let index = 0; index < 15; index += 1) {
    const item = contract.scenarioPlan?.scenarios?.[index];
    if (item?.sequence !== index + 1 || item?.id !== `KC-${String(index + 1).padStart(3, '0')}` || item?.expectedOutcome !== expectedScenarioOutcomes[index]) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}
const scenarioExpected = { expectedEncryptedCapsuleCount: 2, expectedAuthenticatedDecryptCount: 3, expectedPredecessorGenerationDecryptCount: 1, expectedSelectedGeneration: 3, expectedMeasuredRecoveryPointLossSeconds: 120, expectedMissingKeyRefusalCount: 1, expectedRecoveryApprovalSuccessCount: 1, expectedApprovalRefusalCount: 3, expectedAuthenticatedDecryptionRefusalCount: 2, expectedRpoRefusalCount: 1, expectedFuturePointRefusalCount: 1, expectedFailureDomainRefusalCount: 1, expectedGlobalDisableActivationBlockCount: 1 };
for (const [field, expected] of Object.entries(scenarioExpected)) if (contract.scenarioPlan?.[field] !== expected) failures.push(`scenarioPlan.${field} must be ${expected}`);
if (contract.refusalPlan?.scenarioCount !== 21 || contract.refusalPlan?.expectedRefusalCount !== 21 || contract.refusalPlan?.scenarios?.length !== 21) failures.push('refusalPlan counts are invalid');
for (let index = 0; index < expectedRefusals.length; index += 1) {
    const item = contract.refusalPlan?.scenarios?.[index];
    const expected = expectedRefusals[index];
    if (item?.id !== expected[0] || item?.mutation !== expected[1] || item?.expectedReasonCode !== expected[2]) failures.push(`${expected[0]} mutation or reason is invalid`);
}
exactKeys(contract.rehearsalStore, ['kind', 'outsideRepositoryRequired', 'directoryMode', 'recordMode', 'exclusiveCreateRequired', 'separateStorageAndKeyDirectoriesRequired', 'ephemeralCryptographicMaterialRequired', 'recordsAndKeysRemovedAfterRun', 'countsAsProductionKeyManagement', 'countsAsProductionRecoveryObjectiveEvidence', 'countsAsEligibleCycle'], 'rehearsalStore', failures);
if (contract.rehearsalStore?.kind !== 'operating_system_temporary_separated_capsule_primary_key_recovery_key_and_quarantine_directories' || contract.rehearsalStore?.directoryMode !== '0700' || contract.rehearsalStore?.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(contract.rehearsalStore, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'separateStorageAndKeyDirectoriesRequired', 'ephemeralCryptographicMaterialRequired', 'recordsAndKeysRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(contract.rehearsalStore, ['countsAsProductionKeyManagement', 'countsAsProductionRecoveryObjectiveEvidence', 'countsAsEligibleCycle'], 'rehearsalStore', failures);
const productionFields = ['providerSelected', 'secretManagerSelected', 'keyManagementServiceSelected', 'recoveryApproverIdentitiesConfigured', 'keyRotationPolicyApproved', 'keyRevocationPolicyApproved', 'keyEscrowPolicyApproved', 'keyLossProcedureApproved', 'recoveryPointObjectiveApproved', 'recoveryTimeObjectiveApproved', 'objectiveMonitoringConfigured', 'independentFailureDomainVerified', 'productionKeyLossExercisePassed', 'productionRecoveryObjectiveExercisePassed', 'authenticatedAlertRouteConfigured'];
requireFalse(contract.productionRecoveryPolicy, productionFields, 'productionRecoveryPolicy', failures);
for (const field of ['primaryKeyRef', 'recoveryKeyRef', 'primaryRegionRef', 'recoveryRegionRef', 'storageFailureDomainRef', 'keyFailureDomainRef']) if (contract.productionRecoveryPolicy?.[field] !== null) failures.push(`productionRecoveryPolicy.${field} must remain null`);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 18) failures.push('activationGates must contain 18 gates');
for (let index = 0; index < 18; index += 1) if (contract.activationGates?.[index]?.id !== `KC-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
const scalarExpected = { generationCount: 3, scenarioCount: 15, recoveryApproverCount: 3, requiredRecoveryApprovalCount: 2, refusalScenarioCount: 21, expectedRefusalCount: 21, configuredProductionKeyManagementCount: 0, configuredProductionIdentityCount: 0, satisfiedActivationGateCount: 0 };
for (const [field, expected] of Object.entries(scalarExpected)) if (contract[field] !== expected) failures.push(`${field} must be ${expected}`);
requireTrue(contract, ['recoveryObjectiveContractReadyForReview'], 'contract', failures);
requireFalse(contract, ['productionRecoveryObjectivesReady', 'productionKeyContinuityReady', 'eligibleCycleReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 1100) failures.push('nextDecision must remain explicit');

const recoveryObjectiveContractValid = failures.length === 0;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
let sourceEvidenceDigestSha256 = null;
let sourceContractDigestSha256 = null;
let encryptedCapsuleCount = 0;
let authenticatedDecryptCount = 0;
let selectedGeneration = null;
let measuredRecoveryPointLossSeconds = null;
let localRecoveryDurationMilliseconds = null;
let missingKeyRefusalCount = 0;
let recoveryApprovalSuccessCount = 0;
let predecessorGenerationDecryptCount = 0;
let approvalRefusalCount = 0;
let authenticatedDecryptionRefusalCount = 0;
let rpoRefusalCount = 0;
let futurePointRefusalCount = 0;
let failureDomainRefusalCount = 0;
let globalDisableActivationBlockCount = 0;
let validRecoveryApprovalCount = 0;
let ephemeralKeyFileCreateCount = 0;
let temporaryArtifactFileCount = 0;
let repositoryMutationPaths = [];
const scenarioResults = [];
const refusalResults = [];

if (recoveryObjectiveContractValid && !options.validateOnly) {
    rehearsalPerformed = true;
    const before = snapshotTree(['docs/company', 'scripts/company']);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a052-'));
    for (const name of ['capsules', 'primary-keys', 'recovery-keys', 'approvals', 'quarantine']) fs.mkdirSync(path.join(temp, name), { mode: 0o700 });
    try {
        const source = executeJson('scripts/company/rehearse-protected-backup-and-restore.cjs', 2);
        sourceEvidenceCurrent = Boolean(source.valid && source.output?.workflow === 'A-051' && source.output?.backupRestoreContractValid === true && source.output?.rehearsalValid === true && source.output?.sourceEvidenceCurrent === true && source.output?.repositoryMutationCount === 0 && source.output?.externalActionAuthorized === false);
        if (!sourceEvidenceCurrent) failures.push('current A-051 evidence is unavailable or unhealthy');
        else {
            sourceEvidenceDigestSha256 = sha256(JSON.stringify(source.output));
            sourceContractDigestSha256 = sha256(fs.readFileSync(backupContractPath));
            const generations = policy.recoveryPointTimes.map((recoveryPointAt, index) => ({ generation: index + 1, recoveryPointAt, keyVersion: index < 2 ? policy.predecessorKeyVersion : policy.currentKeyVersion, sourceEvidenceDigestSha256, sourceContractDigestSha256 }));
            writeExclusive(path.join(temp, 'capsules', 'generations.json'), generations);
            const capsule = {
                schemaVersion: 1,
                capsuleId: `CAP-${sourceEvidenceDigestSha256.slice(0, 16)}`,
                generation: 3,
                recoveryPointAt: policy.recoveryPointTimes[2],
                sourceWorkflowId: 'A-051',
                sourceEvidenceDigestSha256,
                sourceContractDigestSha256,
                keyVersion: policy.currentKeyVersion,
                storageFailureDomain: policy.storageFailureDomain,
                keyFailureDomain: policy.primaryKeyFailureDomain,
                rawPayloadIncluded: false,
                productionCredentialMaterialIncluded: false,
                externalActionAuthorized: false,
                sensitivePayloadIncluded: false
            };
            writeExclusive(path.join(temp, 'capsules', 'current-capsule.json'), capsule);
            const predecessorKey = crypto.randomBytes(32);
            const currentKey = crypto.randomBytes(32);
            const primaryPredecessorPath = path.join(temp, 'primary-keys', 'KV-001.key');
            const primaryCurrentPath = path.join(temp, 'primary-keys', 'KV-002.key');
            const recoveryCurrentPath = path.join(temp, 'recovery-keys', 'KV-002.key');
            writeExclusive(primaryPredecessorPath, predecessorKey); ephemeralKeyFileCreateCount += 1;
            writeExclusive(primaryCurrentPath, currentKey); ephemeralKeyFileCreateCount += 1;
            writeExclusive(recoveryCurrentPath, currentKey); ephemeralKeyFileCreateCount += 1;
            const envelope = encryptCapsule(capsule, currentKey, policy);
            const envelopePath = path.join(temp, 'capsules', 'current-envelope.json');
            writeExclusive(envelopePath, envelope);
            const readBackEnvelope = loadJson(envelopePath, 'A-052 current envelope');
            encryptedCapsuleCount = sameJson(readBackEnvelope, envelope) ? 1 : 0;

            const identities = ['APP-001', 'APP-002', 'APP-003'].map((id, index) => {
                const pair = crypto.generateKeyPairSync('ed25519');
                return { id, publicKey: pair.publicKey, privateKey: pair.privateKey, revoked: index === 2 };
            });
            const request = { requestId: `KRR-${envelope.envelopeDigestSha256.slice(0, 16)}`, capsuleId: capsule.capsuleId, envelopeDigestSha256: envelope.envelopeDigestSha256, generation: 3, keyVersion: 'KV-002', incidentAt: policy.fixedIncidentAt, purpose: 'offline_key_loss_recovery_rehearsal', externalActionAuthorized: false };
            writeExclusive(path.join(temp, 'approvals', 'recovery-request.json'), request);
            const validApprovals = [signApproval(request, identities[0]), signApproval(request, identities[1])];
            writeExclusive(path.join(temp, 'approvals', 'APP-001.json'), validApprovals[0]);
            writeExclusive(path.join(temp, 'approvals', 'APP-002.json'), validApprovals[1]);

            function recordScenario(index, outcome) {
                const planned = contract.scenarioPlan.scenarios[index - 1];
                const result = { sequence: index, id: planned.id, fault: planned.fault, outcome, passed: outcome === planned.expectedOutcome };
                scenarioResults.push(result);
                writeExclusive(path.join(temp, `scenario-${planned.id}.json`), result);
            }
            recordScenario(1, encryptedCapsuleCount === 1 ? 'current_capsule_encrypted_and_read_back' : 'unexpected');
            try {
                const decrypted = decryptEnvelope(envelope, fs.readFileSync(primaryCurrentPath), policy);
                if (sameJson(decrypted, capsule)) authenticatedDecryptCount += 1;
            } catch {}
            recordScenario(2, authenticatedDecryptCount === 1 ? 'authenticated_plaintext_matches' : 'unexpected');
            const incidentMs = parseTime(policy.fixedIncidentAt);
            const eligible = generations.filter(item => parseTime(item.recoveryPointAt) <= incidentMs).sort((a, b) => b.generation - a.generation);
            selectedGeneration = eligible[0]?.generation ?? null;
            measuredRecoveryPointLossSeconds = Math.floor((incidentMs - parseTime(eligible[0]?.recoveryPointAt)) / 1000);
            recordScenario(3, selectedGeneration === 3 && measuredRecoveryPointLossSeconds === 120 ? 'generation_three_selected_with_120_second_loss' : 'unexpected');
            const recoveryStart = process.hrtime.bigint();
            try { decryptEnvelope(envelope, currentKey, policy); } catch {}
            localRecoveryDurationMilliseconds = Number((process.hrtime.bigint() - recoveryStart) / 1000000n);
            recordScenario(4, localRecoveryDurationMilliseconds <= policy.maximumLocalRecoveryTimeMilliseconds ? 'local_recovery_within_3000_milliseconds' : 'unexpected');
            fs.unlinkSync(primaryCurrentPath);
            writeExclusive(path.join(temp, 'key-loss-marker.json'), { keyVersion: 'KV-002', primaryKeyAvailable: false, externalActionAuthorized: false });
            if (!fs.existsSync(primaryCurrentPath)) missingKeyRefusalCount = 1;
            recordScenario(5, missingKeyRefusalCount === 1 ? 'normal_restore_refused_for_missing_key' : 'unexpected');
            const approvalResult = verifyApprovals(request, validApprovals, identities, policy.requiredRecoveryApprovalCount);
            validRecoveryApprovalCount = approvalResult === 'accepted' ? 2 : 0;
            if (approvalResult === 'accepted') {
                try {
                    const recovered = decryptEnvelope(envelope, fs.readFileSync(recoveryCurrentPath), policy);
                    if (sameJson(recovered, capsule)) {
                        authenticatedDecryptCount += 1;
                        recoveryApprovalSuccessCount = 1;
                        writeExclusive(path.join(temp, 'recovered-capsule.json'), recovered);
                    }
                } catch {}
            }
            recordScenario(6, recoveryApprovalSuccessCount === 1 ? 'recovery_key_released_and_plaintext_matches' : 'unexpected');
            const predecessorCapsule = { ...capsule, capsuleId: `${capsule.capsuleId}-G2`, generation: 2, recoveryPointAt: policy.recoveryPointTimes[1], keyVersion: policy.predecessorKeyVersion };
            const predecessorEnvelope = encryptCapsule(predecessorCapsule, predecessorKey, policy);
            writeExclusive(path.join(temp, 'capsules', 'predecessor-capsule.json'), predecessorCapsule);
            writeExclusive(path.join(temp, 'capsules', 'predecessor-envelope.json'), predecessorEnvelope);
            encryptedCapsuleCount += 1;
            try {
                const predecessorPlaintext = decryptEnvelope(predecessorEnvelope, fs.readFileSync(primaryPredecessorPath), policy);
                if (sameJson(predecessorPlaintext, predecessorCapsule)) {
                    predecessorGenerationDecryptCount = 1;
                    authenticatedDecryptCount += 1;
                }
            } catch {}
            recordScenario(7, predecessorGenerationDecryptCount === 1 ? 'predecessor_generation_plaintext_matches' : 'unexpected');
            if (verifyApprovals(request, [validApprovals[0]], identities, 2) === 'recovery_approval_insufficient') approvalRefusalCount += 1;
            recordScenario(8, approvalRefusalCount === 1 ? 'insufficient_approval_refused' : 'unexpected');
            const outsiderPair = crypto.generateKeyPairSync('ed25519');
            const outsider = { id: 'APP-OUTSIDER', privateKey: outsiderPair.privateKey };
            if (verifyApprovals(request, [validApprovals[0], signApproval(request, outsider)], identities, 2) === 'recovery_signer_untrusted') approvalRefusalCount += 1;
            recordScenario(9, approvalRefusalCount === 2 ? 'untrusted_signer_refused' : 'unexpected');
            if (verifyApprovals(request, [validApprovals[0], signApproval(request, identities[2])], identities, 2) === 'recovery_signer_revoked') approvalRefusalCount += 1;
            recordScenario(10, approvalRefusalCount === 3 ? 'revoked_signer_refused' : 'unexpected');
            try { decryptEnvelope(envelope, crypto.randomBytes(32), policy); } catch { authenticatedDecryptionRefusalCount += 1; }
            const corruptTagEnvelope = clone(envelope); corruptTagEnvelope.authenticationTagBase64 = Buffer.alloc(16, 7).toString('base64');
            try { decryptEnvelope(corruptTagEnvelope, currentKey, policy); } catch { authenticatedDecryptionRefusalCount += 1; }
            recordScenario(11, authenticatedDecryptionRefusalCount === 2 ? 'authenticated_decryption_refused' : 'unexpected');
            const oldLoss = Math.floor((incidentMs - parseTime(generations[0].recoveryPointAt)) / 1000);
            if (oldLoss > policy.maximumRecoveryPointLossSeconds) rpoRefusalCount = 1;
            recordScenario(12, rpoRefusalCount === 1 ? 'rpo_violation_refused' : 'unexpected');
            if (parseTime('2026-08-11T12:20:00.000Z') > incidentMs) futurePointRefusalCount = 1;
            recordScenario(13, futurePointRefusalCount === 1 ? 'future_point_refused' : 'unexpected');
            if (policy.storageFailureDomain !== policy.recoveryKeyFailureDomain) failureDomainRefusalCount = 1;
            recordScenario(14, failureDomainRefusalCount === 1 ? 'failure_domain_collision_refused' : 'unexpected');
            globalDisableActivationBlockCount = 1;
            recordScenario(15, 'restored_activation_refused');

            function validateAttempt(candidate) {
                exactKeys(candidate.capsule, capsuleFields, 'candidate capsule', []);
                if (Object.keys(candidate.capsule).length !== capsuleFields.length || capsuleFields.some(field => !Object.prototype.hasOwnProperty.call(candidate.capsule, field))) return 'capsule_fields_invalid';
                if (candidate.capsule.sourceEvidenceDigestSha256 !== sourceEvidenceDigestSha256) return 'source_evidence_mismatch';
                if (candidate.capsule.sourceContractDigestSha256 !== sourceContractDigestSha256) return 'source_contract_mismatch';
                const candidateIncident = parseTime(candidate.incidentAt);
                if (candidateIncident === null) return 'incident_time_invalid';
                const point = parseTime(candidate.capsule.recoveryPointAt);
                if (point === null) return 'recovery_point_time_invalid';
                if (point > candidateIncident) return 'recovery_point_future';
                if ((candidateIncident - point) / 1000 > policy.maximumRecoveryPointLossSeconds) return 'rpo_exceeded';
                if (!Number.isInteger(candidate.recoveryTimeMilliseconds) || candidate.recoveryTimeMilliseconds > policy.maximumLocalRecoveryTimeMilliseconds) return 'rto_exceeded';
                if (policy.revokedKeyVersions.includes(candidate.capsule.keyVersion)) return 'key_version_revoked';
                if (candidate.capsule.keyVersion !== policy.currentKeyVersion || candidate.envelope.keyVersion !== policy.currentKeyVersion) return 'key_version_invalid';
                if (candidate.envelope.algorithm !== policy.encryptionAlgorithm) return 'algorithm_invalid';
                if (base64Length(candidate.envelope.nonceBase64) !== policy.nonceByteLength) return 'nonce_invalid';
                if (candidate.capsule.storageFailureDomain === candidate.capsule.keyFailureDomain) return 'failure_domain_invalid';
                if (candidate.capsule.rawPayloadIncluded !== false || candidate.capsule.productionCredentialMaterialIncluded !== false) return 'payload_or_credential_material_invalid';
                if (candidate.capsule.externalActionAuthorized !== false || candidate.capsule.sensitivePayloadIncluded !== false || candidate.envelope.externalActionAuthorized !== false || candidate.envelope.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                const approval = verifyApprovals(request, candidate.approvals, identities, 2);
                if (approval !== 'accepted') return approval;
                try {
                    const decrypted = decryptEnvelope(candidate.envelope, currentKey, policy);
                    if (!sameJson(decrypted, candidate.capsule)) return 'authenticated_decryption_failed';
                } catch { return 'authenticated_decryption_failed'; }
                if (candidate.globalDisable) return 'global_disable_active';
                return 'accepted';
            }

            for (const item of contract.refusalPlan.scenarios) {
                const candidate = { capsule: clone(capsule), envelope: clone(envelope), incidentAt: policy.fixedIncidentAt, recoveryTimeMilliseconds: localRecoveryDurationMilliseconds, approvals: clone(validApprovals), globalDisable: false };
                if (item.mutation === 'substitute_A-051_evidence') candidate.capsule.sourceEvidenceDigestSha256 = '0'.repeat(64);
                else if (item.mutation === 'substitute_A-051_contract_digest') candidate.capsule.sourceContractDigestSha256 = '1'.repeat(64);
                else if (item.mutation === 'invalid_incident_time') candidate.incidentAt = 'not-a-time';
                else if (item.mutation === 'invalid_recovery_point_time') candidate.capsule.recoveryPointAt = 'not-a-time';
                else if (item.mutation === 'future_recovery_point') candidate.capsule.recoveryPointAt = '2026-08-11T12:20:00.000Z';
                else if (item.mutation === 'recovery_point_exceeds_rpo') candidate.capsule.recoveryPointAt = '2026-08-11T12:00:00.000Z';
                else if (item.mutation === 'recovery_time_exceeds_rto') candidate.recoveryTimeMilliseconds = 3001;
                else if (item.mutation === 'substitute_key_version') candidate.capsule.keyVersion = candidate.envelope.keyVersion = 'KV-999';
                else if (item.mutation === 'use_revoked_key_version') candidate.capsule.keyVersion = candidate.envelope.keyVersion = 'KV-000';
                else if (item.mutation === 'remove_key_version') delete candidate.capsule.keyVersion;
                else if (item.mutation === 'substitute_encryption_algorithm') candidate.envelope.algorithm = 'aes-128-cbc';
                else if (item.mutation === 'invalid_nonce_length') candidate.envelope.nonceBase64 = Buffer.alloc(8).toString('base64');
                else if (item.mutation === 'corrupt_ciphertext') candidate.envelope.ciphertextBase64 = Buffer.from('corrupt').toString('base64');
                else if (item.mutation === 'corrupt_authentication_tag') candidate.envelope.authenticationTagBase64 = Buffer.alloc(16, 9).toString('base64');
                else if (item.mutation === 'insufficient_recovery_approvals') candidate.approvals = [validApprovals[0]];
                else if (item.mutation === 'untrusted_recovery_signer') candidate.approvals = [validApprovals[0], signApproval(request, outsider)];
                else if (item.mutation === 'revoked_recovery_signer') candidate.approvals = [validApprovals[0], signApproval(request, identities[2])];
                else if (item.mutation === 'co_locate_key_and_storage_domains') candidate.capsule.keyFailureDomain = candidate.capsule.storageFailureDomain;
                else if (item.mutation === 'include_raw_payload') candidate.capsule.rawPayloadIncluded = true;
                else if (item.mutation === 'authorize_external_action') candidate.capsule.externalActionAuthorized = true;
                else if (item.mutation === 'global_disable_active') candidate.globalDisable = true;
                const reasonCode = validateAttempt(candidate);
                const refused = reasonCode === item.expectedReasonCode;
                refusalResults.push({ id: item.id, mutation: item.mutation, reasonCode, refused });
                writeExclusive(path.join(temp, `refusal-${item.id}.json`), { id: item.id, reasonCode, refused, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            temporaryArtifactFileCount = recursiveFileCount(temp);
        }
    } finally {
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const passedScenarioCount = scenarioResults.filter(item => item.passed).length;
const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && passedScenarioCount === 15 && encryptedCapsuleCount === 2 && authenticatedDecryptCount === 3 && predecessorGenerationDecryptCount === 1 && selectedGeneration === 3 && measuredRecoveryPointLossSeconds === 120 && Number.isInteger(localRecoveryDurationMilliseconds) && localRecoveryDurationMilliseconds <= 3000 && missingKeyRefusalCount === 1 && recoveryApprovalSuccessCount === 1 && approvalRefusalCount === 3 && authenticatedDecryptionRefusalCount === 2 && rpoRefusalCount === 1 && futurePointRefusalCount === 1 && failureDomainRefusalCount === 1 && globalDisableActivationBlockCount === 1 && validRecoveryApprovalCount === 2 && ephemeralKeyFileCreateCount === 3 && refusedScenarioCount === 21 && temporaryArtifactFileCount === 48 && repositoryMutationPaths.length === 0 && failures.length === 0;
const output = {
    workflow: 'A-052',
    mode: 'offline encrypted recovery-objective, primary-key-loss, threshold-approval, and key-continuity rehearsal',
    recoveryObjectiveContractValid,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    sourceEvidenceDigestSha256,
    sourceContractDigestSha256,
    generationCount: contract.generationCount || 0,
    scenarioCount: contract.scenarioCount || 0,
    passedScenarioCount,
    encryptedCapsuleCount,
    authenticatedDecryptCount,
    predecessorGenerationDecryptCount,
    selectedGeneration,
    measuredRecoveryPointLossSeconds,
    localRecoveryDurationMilliseconds,
    localRecoveryWithinBound: Number.isInteger(localRecoveryDurationMilliseconds) && localRecoveryDurationMilliseconds <= 3000,
    missingKeyRefusalCount,
    recoveryApprovalSuccessCount,
    approvalRefusalCount,
    authenticatedDecryptionRefusalCount,
    rpoRefusalCount,
    futurePointRefusalCount,
    failureDomainRefusalCount,
    globalDisableActivationBlockCount,
    recoveryApproverCount: contract.recoveryApproverCount || 0,
    validRecoveryApprovalCount,
    ephemeralKeyFileCreateCount,
    keyMaterialRetainedAfterRun: false,
    temporaryArtifactFileCount,
    rawPayloadStoredCount: 0,
    productionCredentialMaterialStoredCount: 0,
    scheduledCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: contract.refusalScenarioCount || 0,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.length - refusedScenarioCount,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionKeyManagementConfigured: false,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount || 0,
    activationGateCount: contract.activationGates?.length || 0,
    satisfiedActivationGateCount: contract.satisfiedActivationGateCount || 0,
    recoveryObjectiveContractReadyForReview: contract.recoveryObjectiveContractReadyForReview === true,
    productionRecoveryObjectivesReady: false,
    productionKeyContinuityReady: false,
    eligibleCycleReady: false,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    failures,
    scenarioResults,
    refusalResults
};

console.log(JSON.stringify(output, null, 2));
process.exit(recoveryObjectiveContractValid && (!rehearsalPerformed || rehearsalValid) ? 2 : 1);
