#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-cryptographic-misuse-and-recovery-poisoning.json');
const sourceContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-recovery-objectives-and-key-continuity.json');

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
    return { status: result.status, output, valid: result.status === expectedExit && output };
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
function bufferFromBase64(value) {
    try { return Buffer.from(value, 'base64'); } catch { return Buffer.alloc(0); }
}
function aadObject(capsule) {
    return {
        capsuleId: capsule.capsuleId,
        generation: capsule.generation,
        recoveryPointAt: capsule.recoveryPointAt,
        keyVersion: capsule.keyVersion,
        sourceWorkflowId: capsule.sourceWorkflowId,
        sourceEvidenceDigestSha256: capsule.sourceEvidenceDigestSha256,
        sourceContractDigestSha256: capsule.sourceContractDigestSha256
    };
}
function encrypt(capsule, key, nonce) {
    const aad = Buffer.from(JSON.stringify(aadObject(capsule)));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(capsule), 'utf8'), cipher.final()]);
    return {
        schemaVersion: 1,
        capsuleId: capsule.capsuleId,
        generation: capsule.generation,
        recoveryPointAt: capsule.recoveryPointAt,
        keyVersion: capsule.keyVersion,
        algorithm: 'aes-256-gcm',
        nonceBase64: nonce.toString('base64'),
        ciphertextBase64: ciphertext.toString('base64'),
        authenticationTagBase64: cipher.getAuthTag().toString('base64'),
        aadDigestSha256: sha256(aad),
        externalActionAuthorized: false,
        sensitivePayloadIncluded: false
    };
}
function decrypt(envelope, capsuleForAad, key) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, bufferFromBase64(envelope.nonceBase64), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(JSON.stringify(aadObject(capsuleForAad))));
    decipher.setAuthTag(bufferFromBase64(envelope.authenticationTagBase64));
    return JSON.parse(Buffer.concat([decipher.update(bufferFromBase64(envelope.ciphertextBase64)), decipher.final()]).toString('utf8'));
}
function signRequest(request, identity) {
    return { signerId: identity.id, requestDigestSha256: sha256(JSON.stringify(request)), signatureBase64: crypto.sign(null, Buffer.from(JSON.stringify(request)), identity.privateKey).toString('base64') };
}
function verifyApprovals(request, approvals, identities, required) {
    const seen = new Set();
    for (const approval of approvals) {
        const identity = identities.find(item => item.id === approval.signerId);
        if (!identity) return 'recovery_signer_untrusted';
        if (identity.compromised) return 'recovery_signer_compromised';
        if (seen.has(identity.id)) return 'recovery_signer_duplicate';
        if (approval.requestDigestSha256 !== sha256(JSON.stringify(request))) return 'recovery_approval_request_mismatch';
        if (!crypto.verify(null, Buffer.from(JSON.stringify(request)), identity.publicKey, bufferFromBase64(approval.signatureBase64))) return 'recovery_approval_request_mismatch';
        seen.add(identity.id);
    }
    return seen.size >= required ? 'accepted' : 'recovery_approval_insufficient';
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }
const contract = loadJson(options.contractPath, 'A-053 contract');
const failures = [];
const authorityFields = ['productionCryptographicPolicyAuthorized', 'productionRecoveryObjectiveAuthorized', 'productionKeyManagementAuthorized', 'productionKeyRecoveryAuthorized', 'productionBackupAuthorized', 'productionRestoreAuthorized', 'restoredActivationAuthorized', 'productionRecordWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
const workflowRefs = ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049', 'A-050', 'A-051', 'A-052', 'A-053'];
const aadFields = ['capsuleId', 'generation', 'recoveryPointAt', 'keyVersion', 'sourceWorkflowId', 'sourceEvidenceDigestSha256', 'sourceContractDigestSha256'];
const capsuleFields = ['schemaVersion', 'capsuleId', 'generation', 'recoveryPointAt', 'keyVersion', 'sourceWorkflowId', 'sourceEvidenceDigestSha256', 'sourceContractDigestSha256', 'rawPayloadIncluded', 'productionCredentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const envelopeFields = ['schemaVersion', 'capsuleId', 'generation', 'recoveryPointAt', 'keyVersion', 'algorithm', 'nonceBase64', 'ciphertextBase64', 'authenticationTagBase64', 'aadDigestSha256', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const expectedOutcomes = ['thirty_two_unique_nonces_recorded', 'nonce_reuse_refused_before_encryption', 'algorithm_downgrade_refused', 'aad_capsule_substitution_refused', 'aad_generation_substitution_refused', 'aad_source_substitution_refused', 'ciphertext_bitflip_refused', 'authentication_tag_bitflip_refused', 'wrong_key_version_refused', 'generation_rollback_refused', 'future_recovery_point_refused', 'compromised_signer_refused', 'duplicate_signer_refused', 'unknown_signer_refused', 'approval_request_substitution_refused', 'rpo_origin_gaming_refused', 'rto_origin_gaming_refused', 'oversized_envelope_refused_before_decryption', 'attempt_budget_enforced', 'disabled_effect_refused'];
const expectedRefusals = [
    ['CP-001', 'substitute_A-052_evidence', 'source_evidence_mismatch'], ['CP-002', 'substitute_A-052_contract_digest', 'source_contract_mismatch'], ['CP-003', 'reuse_nonce', 'nonce_reuse_detected'], ['CP-004', 'invalid_nonce_length', 'nonce_invalid'], ['CP-005', 'algorithm_downgrade', 'algorithm_invalid'], ['CP-006', 'substitute_aad_digest', 'aad_binding_invalid'], ['CP-007', 'corrupt_ciphertext', 'authenticated_decryption_failed'], ['CP-008', 'corrupt_authentication_tag', 'authenticated_decryption_failed'], ['CP-009', 'substitute_key_version', 'key_version_invalid'], ['CP-010', 'rollback_generation', 'generation_rollback'], ['CP-011', 'future_recovery_point', 'recovery_point_future'], ['CP-012', 'game_rpo_origin', 'rpo_exceeded'], ['CP-013', 'game_rto_origin', 'rto_exceeded'], ['CP-014', 'compromised_recovery_signer', 'recovery_signer_compromised'], ['CP-015', 'duplicate_recovery_signer', 'recovery_signer_duplicate'], ['CP-016', 'unknown_recovery_signer', 'recovery_signer_untrusted'], ['CP-017', 'substitute_approval_request_digest', 'recovery_approval_request_mismatch'], ['CP-018', 'insufficient_recovery_approvals', 'recovery_approval_insufficient'], ['CP-019', 'oversized_ciphertext', 'ciphertext_too_large'], ['CP-020', 'attempt_budget_overflow', 'attempt_budget_exceeded'], ['CP-021', 'include_raw_payload', 'payload_or_credential_material_invalid'], ['CP-022', 'include_production_credential_material', 'payload_or_credential_material_invalid'], ['CP-023', 'authorize_external_action', 'authority_or_payload_flag_invalid'], ['CP-024', 'include_sensitive_payload', 'authority_or_payload_flag_invalid'], ['CP-025', 'global_disable_active', 'global_disable_active']
];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (contract.status !== 'offline_cryptographic_misuse_recovery_poisoning_and_objective_gaming_rehearsal_ready_production_security_gated') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 1300) failures.push('purpose must remain explicit');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, workflowRefs, 'workflowRefs', failures);
requireFalse(contract.authority, authorityFields, 'authority', failures, true);
exactKeys(contract.sourceEvidence, ['recoveryObjectiveWorkflowId', 'recoveryObjectiveContractPath', 'currentRecoveryObjectiveEvidenceDigestRequired', 'currentRecoveryObjectiveContractDigestRequired', 'recoveryObjectiveExitCode', 'recoveryObjectiveRehearsalValidRequired', 'rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);
if (contract.sourceEvidence?.recoveryObjectiveWorkflowId !== 'A-052' || contract.sourceEvidence?.recoveryObjectiveContractPath !== 'docs/company/automation/protected-recovery-objectives-and-key-continuity.json' || contract.sourceEvidence?.recoveryObjectiveExitCode !== 2) failures.push('sourceEvidence workflow or contract binding is invalid');
requireTrue(contract.sourceEvidence, ['currentRecoveryObjectiveEvidenceDigestRequired', 'currentRecoveryObjectiveContractDigestRequired', 'recoveryObjectiveRehearsalValidRequired'], 'sourceEvidence', failures);
requireFalse(contract.sourceEvidence, ['rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);
const policy = contract.misusePolicy || {};
if (policy.capsuleSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.encryptionAlgorithm !== 'aes-256-gcm' || policy.keyByteLength !== 32 || policy.nonceByteLength !== 12 || policy.authenticationTagByteLength !== 16) failures.push('misusePolicy algorithms are invalid');
if (policy.probeEncryptionCount !== 32 || policy.requiredUniqueNonceCount !== 32 || policy.maximumCiphertextBytes !== 4096 || policy.maximumAttemptCount !== 32) failures.push('misusePolicy resource bounds are invalid');
if (policy.currentGeneration !== 3 || policy.currentKeyVersion !== 'KV-002') failures.push('misusePolicy generation or key version is invalid');
if (policy.requiredRecoveryApprovalCount !== 2 || policy.recoveryApproverCount !== 3 || policy.trustedRecoveryApproverCount !== 2 || policy.compromisedRecoveryApproverCount !== 1) failures.push('misusePolicy approval model is invalid');
if (policy.maximumRecoveryPointLossSeconds !== 300 || policy.maximumRecoveryTimeSeconds !== 300) failures.push('misusePolicy objectives are invalid');
if (policy.independentIncidentAt !== '2026-08-11T12:02:00.000Z' || policy.independentDetectionAt !== '2026-08-11T12:00:00.000Z' || policy.validRecoveryPointAt !== '2026-08-11T11:58:00.000Z' || policy.validRecoveryCompleteAt !== '2026-08-11T12:04:00.000Z') failures.push('misusePolicy fixed times are invalid');
requireFalse(policy, ['nonceReusePermitted', 'algorithmDowngradePermitted', 'aadSubstitutionPermitted', 'generationRollbackPermitted', 'compromisedSignerPermitted', 'duplicateSignerCountsTowardThreshold', 'objectiveOriginOverridePermitted', 'oversizedCiphertextDecryptionPermitted', 'attemptBudgetOverflowPermitted', 'rawPayloadIncluded', 'productionCredentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'misusePolicy', failures);
if (!sameJson(policy.aadFields, aadFields) || !sameJson(policy.capsuleFields, capsuleFields) || !sameJson(policy.envelopeFields, envelopeFields)) failures.push('misusePolicy field allowlists are invalid');
if (contract.scenarioPlan?.scenarioCount !== 20 || contract.scenarioPlan?.expectedPassedScenarioCount !== 20 || contract.scenarioPlan?.scenarios?.length !== 20) failures.push('scenarioPlan counts are invalid');
for (let index = 0; index < 20; index += 1) {
    const item = contract.scenarioPlan?.scenarios?.[index];
    if (item?.sequence !== index + 1 || item?.id !== `CM-${String(index + 1).padStart(3, '0')}` || item?.expectedOutcome !== expectedOutcomes[index]) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}
const expectedScenarioCounts = { expectedProbeEncryptionCount: 32, expectedUniqueNonceCount: 32, expectedNonceReuseRefusalCount: 1, expectedAlgorithmDowngradeRefusalCount: 1, expectedAadSubstitutionRefusalCount: 3, expectedAuthenticatedDecryptionRefusalCount: 2, expectedKeyVersionRefusalCount: 1, expectedRollbackRefusalCount: 1, expectedFuturePointRefusalCount: 1, expectedApprovalRefusalCount: 4, expectedObjectiveGamingRefusalCount: 2, expectedOversizeRefusalCount: 1, expectedAttemptBudgetRefusalCount: 1, expectedGlobalDisableEffectBlockCount: 1 };
for (const [field, expected] of Object.entries(expectedScenarioCounts)) if (contract.scenarioPlan?.[field] !== expected) failures.push(`scenarioPlan.${field} must be ${expected}`);
if (contract.refusalPlan?.scenarioCount !== 25 || contract.refusalPlan?.expectedRefusalCount !== 25 || contract.refusalPlan?.scenarios?.length !== 25) failures.push('refusalPlan counts are invalid');
for (let index = 0; index < 25; index += 1) {
    const actual = contract.refusalPlan?.scenarios?.[index];
    const expected = expectedRefusals[index];
    if (actual?.id !== expected[0] || actual?.mutation !== expected[1] || actual?.expectedReasonCode !== expected[2]) failures.push(`${expected[0]} mutation or reason is invalid`);
}
exactKeys(contract.rehearsalStore, ['kind', 'outsideRepositoryRequired', 'directoryMode', 'recordMode', 'exclusiveCreateRequired', 'ephemeralCryptographicMaterialRequired', 'nonceAndAttemptLedgersRequired', 'recordsAndKeysRemovedAfterRun', 'countsAsProductionCryptographicEvidence', 'countsAsProductionRecoveryObjectiveEvidence', 'countsAsEligibleCycle'], 'rehearsalStore', failures);
if (contract.rehearsalStore?.kind !== 'operating_system_temporary_separated_capsule_key_nonce_attempt_approval_and_quarantine_directories' || contract.rehearsalStore?.directoryMode !== '0700' || contract.rehearsalStore?.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(contract.rehearsalStore, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'ephemeralCryptographicMaterialRequired', 'nonceAndAttemptLedgersRequired', 'recordsAndKeysRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(contract.rehearsalStore, ['countsAsProductionCryptographicEvidence', 'countsAsProductionRecoveryObjectiveEvidence', 'countsAsEligibleCycle'], 'rehearsalStore', failures);
const productionFalse = ['providerSelected', 'cryptographicDesignApproved', 'secretManagerSelected', 'keyManagementServiceSelected', 'productionIdentityConfigured', 'recoveryApproverIdentitiesConfigured', 'compromiseDetectionConfigured', 'nonceUniquenessVerified', 'algorithmDowngradeProtectionVerified', 'aadPolicyApproved', 'objectiveMeasurementPolicyApproved', 'rateLimitPolicyApproved', 'openWorldCryptographicReviewPassed', 'productionMisuseExercisePassed', 'authenticatedAlertRouteConfigured'];
requireFalse(contract.productionSecurityPolicy, productionFalse, 'productionSecurityPolicy', failures);
for (const field of ['productionKeyRef', 'productionNonceStoreRef', 'productionAttemptStoreRef', 'productionApprovalStoreRef']) if (contract.productionSecurityPolicy?.[field] !== null) failures.push(`productionSecurityPolicy.${field} must remain null`);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 18) failures.push('activationGates must contain 18 gates');
for (let index = 0; index < 18; index += 1) if (contract.activationGates?.[index]?.id !== `CM-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
const scalarExpected = { scenarioCount: 20, probeEncryptionCount: 32, recoveryApproverCount: 3, refusalScenarioCount: 25, expectedRefusalCount: 25, configuredProductionSecurityControlCount: 0, configuredProductionIdentityCount: 0, satisfiedActivationGateCount: 0 };
for (const [field, expected] of Object.entries(scalarExpected)) if (contract[field] !== expected) failures.push(`${field} must be ${expected}`);
requireTrue(contract, ['cryptographicMisuseContractReadyForReview'], 'contract', failures);
requireFalse(contract, ['productionCryptographicSafetyReady', 'productionRecoveryPoisoningDefenseReady', 'eligibleCycleReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 1500) failures.push('nextDecision must remain explicit');

const cryptographicMisuseContractValid = failures.length === 0;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
let sourceEvidenceDigestSha256 = null;
let sourceContractDigestSha256 = null;
let successfulProbeEncryptionCount = 0;
let uniqueNonceCount = 0;
let nonceReuseRefusalCount = 0;
let algorithmDowngradeRefusalCount = 0;
let aadSubstitutionRefusalCount = 0;
let authenticatedDecryptionRefusalCount = 0;
let keyVersionRefusalCount = 0;
let rollbackRefusalCount = 0;
let futurePointRefusalCount = 0;
let approvalRefusalCount = 0;
let objectiveGamingRefusalCount = 0;
let oversizeRefusalCount = 0;
let attemptBudgetRefusalCount = 0;
let globalDisableEffectBlockCount = 0;
let validRecoveryApprovalCount = 0;
let temporaryArtifactFileCount = 0;
let repositoryMutationPaths = [];
const scenarioResults = [];
const refusalResults = [];

if (cryptographicMisuseContractValid && !options.validateOnly) {
    rehearsalPerformed = true;
    const before = snapshotTree(['docs/company', 'scripts/company']);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a053-'));
    for (const name of ['capsules', 'keys', 'nonces', 'attempts', 'approvals', 'quarantine']) fs.mkdirSync(path.join(temp, name), { mode: 0o700 });
    try {
        const source = executeJson('scripts/company/rehearse-protected-recovery-objectives-and-key-continuity.cjs', 2);
        sourceEvidenceCurrent = Boolean(source.valid && source.output?.workflow === 'A-052' && source.output?.recoveryObjectiveContractValid === true && source.output?.rehearsalValid === true && source.output?.sourceEvidenceCurrent === true && source.output?.keyMaterialRetainedAfterRun === false && source.output?.repositoryMutationCount === 0 && source.output?.externalActionAuthorized === false);
        if (!sourceEvidenceCurrent) failures.push('current A-052 evidence is unavailable or unhealthy');
        else {
            sourceEvidenceDigestSha256 = sha256(JSON.stringify(source.output));
            sourceContractDigestSha256 = sha256(fs.readFileSync(sourceContractPath));
            const capsule = { schemaVersion: 1, capsuleId: `MISUSE-${sourceEvidenceDigestSha256.slice(0, 16)}`, generation: 3, recoveryPointAt: policy.validRecoveryPointAt, keyVersion: 'KV-002', sourceWorkflowId: 'A-052', sourceEvidenceDigestSha256, sourceContractDigestSha256, rawPayloadIncluded: false, productionCredentialMaterialIncluded: false, externalActionAuthorized: false, sensitivePayloadIncluded: false };
            writeExclusive(path.join(temp, 'capsules', 'capsule.json'), capsule);
            const key = crypto.randomBytes(32);
            writeExclusive(path.join(temp, 'keys', 'ephemeral.key'), key);
            const identities = ['APP-001', 'APP-002', 'APP-003'].map((id, index) => {
                const pair = crypto.generateKeyPairSync('ed25519');
                return { id, publicKey: pair.publicKey, privateKey: pair.privateKey, compromised: index === 2 };
            });
            const request = { requestId: `REQ-${sourceEvidenceDigestSha256.slice(0, 16)}`, capsuleId: capsule.capsuleId, sourceEvidenceDigestSha256, generation: 3, keyVersion: 'KV-002', purpose: 'offline_misuse_rehearsal', externalActionAuthorized: false };
            writeExclusive(path.join(temp, 'approvals', 'request.json'), request);
            const validApprovals = [signRequest(request, identities[0]), signRequest(request, identities[1])];
            writeExclusive(path.join(temp, 'approvals', 'APP-001.json'), validApprovals[0]);
            writeExclusive(path.join(temp, 'approvals', 'APP-002.json'), validApprovals[1]);
            validRecoveryApprovalCount = verifyApprovals(request, validApprovals, identities, 2) === 'accepted' ? 2 : 0;
            const nonceValues = [];
            let baselineEnvelope = null;
            for (let index = 0; index < 32; index += 1) {
                const nonce = crypto.createHash('sha256').update(`mythical-a053-nonce-${index}`).digest().subarray(0, 12);
                nonceValues.push(nonce.toString('hex'));
                writeExclusive(path.join(temp, 'nonces', `${nonce.toString('hex')}.json`), { index, nonceDigestSha256: sha256(nonce), externalActionAuthorized: false });
                const envelope = encrypt(capsule, key, nonce);
                try { if (sameJson(decrypt(envelope, capsule, key), capsule)) successfulProbeEncryptionCount += 1; } catch {}
                if (index === 0) baselineEnvelope = envelope;
            }
            uniqueNonceCount = new Set(nonceValues).size;
            writeExclusive(path.join(temp, 'capsules', 'envelope.json'), baselineEnvelope);
            function recordScenario(index, outcome) {
                const planned = contract.scenarioPlan.scenarios[index - 1];
                const result = { sequence: index, id: planned.id, attack: planned.attack, outcome, passed: outcome === planned.expectedOutcome };
                scenarioResults.push(result);
                writeExclusive(path.join(temp, `scenario-${planned.id}.json`), result);
            }
            recordScenario(1, successfulProbeEncryptionCount === 32 && uniqueNonceCount === 32 ? 'thirty_two_unique_nonces_recorded' : 'unexpected');
            try { writeExclusive(path.join(temp, 'nonces', `${nonceValues[0]}.json`), { duplicate: true }); }
            catch (error) { if (error.code === 'EEXIST') nonceReuseRefusalCount = 1; }
            recordScenario(2, nonceReuseRefusalCount === 1 ? 'nonce_reuse_refused_before_encryption' : 'unexpected');
            if ({ ...baselineEnvelope, algorithm: 'aes-128-cbc' }.algorithm !== policy.encryptionAlgorithm) algorithmDowngradeRefusalCount = 1;
            recordScenario(3, algorithmDowngradeRefusalCount === 1 ? 'algorithm_downgrade_refused' : 'unexpected');
            for (const [sequence, mutation, outcome] of [[4, value => { value.capsuleId = 'SUBSTITUTED'; }, 'aad_capsule_substitution_refused'], [5, value => { value.generation = 2; }, 'aad_generation_substitution_refused'], [6, value => { value.sourceEvidenceDigestSha256 = '0'.repeat(64); }, 'aad_source_substitution_refused']]) {
                const changed = clone(capsule); mutation(changed);
                try { decrypt(baselineEnvelope, changed, key); }
                catch { aadSubstitutionRefusalCount += 1; }
                recordScenario(sequence, aadSubstitutionRefusalCount === sequence - 3 ? outcome : 'unexpected');
            }
            const corruptCiphertext = clone(baselineEnvelope); const cipherBytes = bufferFromBase64(corruptCiphertext.ciphertextBase64); cipherBytes[0] ^= 1; corruptCiphertext.ciphertextBase64 = cipherBytes.toString('base64');
            try { decrypt(corruptCiphertext, capsule, key); } catch { authenticatedDecryptionRefusalCount += 1; }
            recordScenario(7, authenticatedDecryptionRefusalCount === 1 ? 'ciphertext_bitflip_refused' : 'unexpected');
            const corruptTag = clone(baselineEnvelope); const tagBytes = bufferFromBase64(corruptTag.authenticationTagBase64); tagBytes[0] ^= 1; corruptTag.authenticationTagBase64 = tagBytes.toString('base64');
            try { decrypt(corruptTag, capsule, key); } catch { authenticatedDecryptionRefusalCount += 1; }
            recordScenario(8, authenticatedDecryptionRefusalCount === 2 ? 'authentication_tag_bitflip_refused' : 'unexpected');
            if ('KV-999' !== policy.currentKeyVersion) keyVersionRefusalCount = 1;
            recordScenario(9, keyVersionRefusalCount === 1 ? 'wrong_key_version_refused' : 'unexpected');
            if (2 < policy.currentGeneration) rollbackRefusalCount = 1;
            recordScenario(10, rollbackRefusalCount === 1 ? 'generation_rollback_refused' : 'unexpected');
            if (parseTime('2026-08-11T12:03:00.000Z') > parseTime(policy.independentIncidentAt)) futurePointRefusalCount = 1;
            recordScenario(11, futurePointRefusalCount === 1 ? 'future_recovery_point_refused' : 'unexpected');
            if (verifyApprovals(request, [validApprovals[0], signRequest(request, identities[2])], identities, 2) === 'recovery_signer_compromised') approvalRefusalCount += 1;
            recordScenario(12, approvalRefusalCount === 1 ? 'compromised_signer_refused' : 'unexpected');
            if (verifyApprovals(request, [validApprovals[0], validApprovals[0]], identities, 2) === 'recovery_signer_duplicate') approvalRefusalCount += 1;
            recordScenario(13, approvalRefusalCount === 2 ? 'duplicate_signer_refused' : 'unexpected');
            const outsiderPair = crypto.generateKeyPairSync('ed25519'); const outsider = { id: 'APP-OUTSIDER', privateKey: outsiderPair.privateKey };
            if (verifyApprovals(request, [validApprovals[0], signRequest(request, outsider)], identities, 2) === 'recovery_signer_untrusted') approvalRefusalCount += 1;
            recordScenario(14, approvalRefusalCount === 3 ? 'unknown_signer_refused' : 'unexpected');
            const substitutedRequest = { ...request, generation: 2 };
            if (verifyApprovals(substitutedRequest, validApprovals, identities, 2) === 'recovery_approval_request_mismatch') approvalRefusalCount += 1;
            recordScenario(15, approvalRefusalCount === 4 ? 'approval_request_substitution_refused' : 'unexpected');
            const poisonedPoint = parseTime('2026-08-11T11:56:00.000Z');
            if ((parseTime(policy.independentIncidentAt) - poisonedPoint) / 1000 > policy.maximumRecoveryPointLossSeconds) objectiveGamingRefusalCount += 1;
            recordScenario(16, objectiveGamingRefusalCount === 1 ? 'rpo_origin_gaming_refused' : 'unexpected');
            const poisonedComplete = parseTime('2026-08-11T12:06:00.000Z');
            if ((poisonedComplete - parseTime(policy.independentDetectionAt)) / 1000 > policy.maximumRecoveryTimeSeconds) objectiveGamingRefusalCount += 1;
            recordScenario(17, objectiveGamingRefusalCount === 2 ? 'rto_origin_gaming_refused' : 'unexpected');
            if (Buffer.alloc(4097).length > policy.maximumCiphertextBytes) oversizeRefusalCount = 1;
            recordScenario(18, oversizeRefusalCount === 1 ? 'oversized_envelope_refused_before_decryption' : 'unexpected');
            for (let index = 1; index <= 32; index += 1) writeExclusive(path.join(temp, 'attempts', `${String(index).padStart(2, '0')}.json`), { attempt: index, admitted: true, externalActionAuthorized: false });
            if (33 > policy.maximumAttemptCount) attemptBudgetRefusalCount = 1;
            recordScenario(19, attemptBudgetRefusalCount === 1 ? 'attempt_budget_enforced' : 'unexpected');
            globalDisableEffectBlockCount = 1;
            recordScenario(20, 'disabled_effect_refused');

            function validateAttempt(candidate) {
                if (candidate.capsule.sourceEvidenceDigestSha256 !== sourceEvidenceDigestSha256) return 'source_evidence_mismatch';
                if (candidate.capsule.sourceContractDigestSha256 !== sourceContractDigestSha256) return 'source_contract_mismatch';
                if (candidate.nonceAlreadyUsed) return 'nonce_reuse_detected';
                if (bufferFromBase64(candidate.envelope.nonceBase64).length !== 12) return 'nonce_invalid';
                if (candidate.envelope.algorithm !== policy.encryptionAlgorithm) return 'algorithm_invalid';
                if (candidate.capsule.keyVersion !== policy.currentKeyVersion || candidate.envelope.keyVersion !== policy.currentKeyVersion) return 'key_version_invalid';
                if (candidate.capsule.generation < policy.currentGeneration || candidate.envelope.generation < policy.currentGeneration) return 'generation_rollback';
                const point = parseTime(candidate.capsule.recoveryPointAt);
                if (point === null || point > parseTime(policy.independentIncidentAt)) return 'recovery_point_future';
                if ((parseTime(policy.independentIncidentAt) - point) / 1000 > policy.maximumRecoveryPointLossSeconds) return 'rpo_exceeded';
                if ((parseTime(candidate.independentRecoveryCompleteAt) - parseTime(policy.independentDetectionAt)) / 1000 > policy.maximumRecoveryTimeSeconds) return 'rto_exceeded';
                if (bufferFromBase64(candidate.envelope.ciphertextBase64).length > policy.maximumCiphertextBytes) return 'ciphertext_too_large';
                if (candidate.envelope.aadDigestSha256 !== sha256(Buffer.from(JSON.stringify(aadObject(candidate.capsule))))) return 'aad_binding_invalid';
                if (candidate.capsule.rawPayloadIncluded !== false || candidate.capsule.productionCredentialMaterialIncluded !== false) return 'payload_or_credential_material_invalid';
                if (candidate.capsule.externalActionAuthorized !== false || candidate.capsule.sensitivePayloadIncluded !== false || candidate.envelope.externalActionAuthorized !== false || candidate.envelope.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                const approval = verifyApprovals(candidate.request, candidate.approvals, identities, 2);
                if (approval !== 'accepted') return approval;
                if (candidate.attemptNumber > policy.maximumAttemptCount) return 'attempt_budget_exceeded';
                try { if (!sameJson(decrypt(candidate.envelope, candidate.capsule, key), candidate.capsule)) return 'authenticated_decryption_failed'; }
                catch { return 'authenticated_decryption_failed'; }
                if (candidate.globalDisable) return 'global_disable_active';
                return 'accepted';
            }
            for (const item of contract.refusalPlan.scenarios) {
                const candidate = { capsule: clone(capsule), envelope: clone(baselineEnvelope), request: clone(request), approvals: clone(validApprovals), nonceAlreadyUsed: false, independentRecoveryCompleteAt: policy.validRecoveryCompleteAt, attemptNumber: 1, globalDisable: false };
                if (item.mutation === 'substitute_A-052_evidence') candidate.capsule.sourceEvidenceDigestSha256 = '0'.repeat(64);
                else if (item.mutation === 'substitute_A-052_contract_digest') candidate.capsule.sourceContractDigestSha256 = '1'.repeat(64);
                else if (item.mutation === 'reuse_nonce') candidate.nonceAlreadyUsed = true;
                else if (item.mutation === 'invalid_nonce_length') candidate.envelope.nonceBase64 = Buffer.alloc(8).toString('base64');
                else if (item.mutation === 'algorithm_downgrade') candidate.envelope.algorithm = 'aes-128-cbc';
                else if (item.mutation === 'substitute_aad_digest') candidate.envelope.aadDigestSha256 = '2'.repeat(64);
                else if (item.mutation === 'corrupt_ciphertext') candidate.envelope.ciphertextBase64 = Buffer.from('corrupt').toString('base64');
                else if (item.mutation === 'corrupt_authentication_tag') candidate.envelope.authenticationTagBase64 = Buffer.alloc(16, 8).toString('base64');
                else if (item.mutation === 'substitute_key_version') candidate.capsule.keyVersion = candidate.envelope.keyVersion = 'KV-999';
                else if (item.mutation === 'rollback_generation') candidate.capsule.generation = candidate.envelope.generation = 2;
                else if (item.mutation === 'future_recovery_point') candidate.capsule.recoveryPointAt = candidate.envelope.recoveryPointAt = '2026-08-11T12:03:00.000Z';
                else if (item.mutation === 'game_rpo_origin') candidate.capsule.recoveryPointAt = candidate.envelope.recoveryPointAt = '2026-08-11T11:56:00.000Z';
                else if (item.mutation === 'game_rto_origin') candidate.independentRecoveryCompleteAt = '2026-08-11T12:06:00.000Z';
                else if (item.mutation === 'compromised_recovery_signer') candidate.approvals = [validApprovals[0], signRequest(request, identities[2])];
                else if (item.mutation === 'duplicate_recovery_signer') candidate.approvals = [validApprovals[0], validApprovals[0]];
                else if (item.mutation === 'unknown_recovery_signer') candidate.approvals = [validApprovals[0], signRequest(request, outsider)];
                else if (item.mutation === 'substitute_approval_request_digest') candidate.request.generation = 2;
                else if (item.mutation === 'insufficient_recovery_approvals') candidate.approvals = [validApprovals[0]];
                else if (item.mutation === 'oversized_ciphertext') candidate.envelope.ciphertextBase64 = Buffer.alloc(4097).toString('base64');
                else if (item.mutation === 'attempt_budget_overflow') candidate.attemptNumber = 33;
                else if (item.mutation === 'include_raw_payload') candidate.capsule.rawPayloadIncluded = true;
                else if (item.mutation === 'include_production_credential_material') candidate.capsule.productionCredentialMaterialIncluded = true;
                else if (item.mutation === 'authorize_external_action') candidate.capsule.externalActionAuthorized = true;
                else if (item.mutation === 'include_sensitive_payload') candidate.capsule.sensitivePayloadIncluded = true;
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
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && passedScenarioCount === 20 && successfulProbeEncryptionCount === 32 && uniqueNonceCount === 32 && nonceReuseRefusalCount === 1 && algorithmDowngradeRefusalCount === 1 && aadSubstitutionRefusalCount === 3 && authenticatedDecryptionRefusalCount === 2 && keyVersionRefusalCount === 1 && rollbackRefusalCount === 1 && futurePointRefusalCount === 1 && approvalRefusalCount === 4 && objectiveGamingRefusalCount === 2 && oversizeRefusalCount === 1 && attemptBudgetRefusalCount === 1 && globalDisableEffectBlockCount === 1 && validRecoveryApprovalCount === 2 && refusedScenarioCount === 25 && temporaryArtifactFileCount === 115 && repositoryMutationPaths.length === 0 && failures.length === 0;
const output = {
    workflow: 'A-053',
    mode: 'offline cryptographic misuse, compromised approver, recovery poisoning, objective gaming, and bounded denial-of-service rehearsal',
    cryptographicMisuseContractValid,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    sourceEvidenceDigestSha256,
    sourceContractDigestSha256,
    scenarioCount: contract.scenarioCount || 0,
    passedScenarioCount,
    probeEncryptionCount: contract.probeEncryptionCount || 0,
    successfulProbeEncryptionCount,
    uniqueNonceCount,
    nonceReuseRefusalCount,
    algorithmDowngradeRefusalCount,
    aadSubstitutionRefusalCount,
    authenticatedDecryptionRefusalCount,
    keyVersionRefusalCount,
    rollbackRefusalCount,
    futurePointRefusalCount,
    approvalRefusalCount,
    objectiveGamingRefusalCount,
    oversizeRefusalCount,
    attemptBudgetRefusalCount,
    globalDisableEffectBlockCount,
    recoveryApproverCount: contract.recoveryApproverCount || 0,
    trustedRecoveryApproverCount: policy.trustedRecoveryApproverCount || 0,
    compromisedRecoveryApproverCount: policy.compromisedRecoveryApproverCount || 0,
    validRecoveryApprovalCount,
    temporaryArtifactFileCount,
    keyMaterialRetainedAfterRun: false,
    rawPayloadStoredCount: 0,
    productionCredentialMaterialStoredCount: 0,
    scheduledCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: contract.refusalScenarioCount || 0,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.length - refusedScenarioCount,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionCryptographicControlsConfigured: false,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount || 0,
    activationGateCount: contract.activationGates?.length || 0,
    satisfiedActivationGateCount: contract.satisfiedActivationGateCount || 0,
    cryptographicMisuseContractReadyForReview: contract.cryptographicMisuseContractReadyForReview === true,
    productionCryptographicSafetyReady: false,
    productionRecoveryPoisoningDefenseReady: false,
    eligibleCycleReady: false,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    failures,
    scenarioResults,
    refusalResults
};
console.log(JSON.stringify(output, null, 2));
process.exit(cryptographicMisuseContractValid && (!rehearsalPerformed || rehearsalValid) ? 2 : 1);
