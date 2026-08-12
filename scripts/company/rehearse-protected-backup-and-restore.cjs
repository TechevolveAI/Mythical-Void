#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-backup-and-restore.json');

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
        if (stat.isFile()) result.set(relative, `file:${stat.mode & 0o777}:${stat.size}:${sha256(fs.readFileSync(absolute))}`);
    }
    for (const root of relativeRoots) visit(path.join(repositoryRoot, root), root);
    return result;
}
function snapshotDifferences(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).sort();
}
function recursiveFileCount(root) {
    let count = 0;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) count += recursiveFileCount(path.join(root, entry.name));
        else if (entry.isFile()) count += 1;
    }
    return count;
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected backup/restore contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_payload_free_backup_restore_and_disaster_recovery_rehearsal_ready_production_durability_gated') failures.push('status must remain offline_payload_free_backup_restore_and_disaster_recovery_rehearsal_ready_production_durability_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 750) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049', 'A-050', 'A-051'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionBackupAuthorized', 'productionRestoreAuthorized', 'productionDisasterRecoveryAuthorized', 'productionRecordWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.packetWorkflowId !== 'A-042' || source.historyWorkflowId !== 'A-046' || source.alertWorkflowId !== 'A-047' || source.leaseWorkflowId !== 'A-048' || source.recoveryWorkflowId !== 'A-049' || source.consensusWorkflowId !== 'A-050' || !sameJson(source.packetSourceIds, ['OC-001', 'OC-002'])) failures.push('sourceEvidence workflow or packet bindings are invalid');
requireTrue(source, ['livePacketIdsAndDigestsRequired', 'currentHistoryEvidenceDigestRequired', 'currentAlertEvidenceDigestRequired', 'currentLeaseEvidenceDigestRequired', 'currentRecoveryEvidenceDigestRequired', 'currentConsensusEvidenceDigestRequired'], 'sourceEvidence', failures);
requireFalse(source, ['rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const manifestFields = ['schemaVersion', 'backupId', 'generation', 'createdAt', 'sourceFailureDomain', 'targetFailureDomain', 'recordCount', 'records', 'manifestDigestSha256', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const recordFields = ['sequence', 'workflowId', 'evidenceDigestSha256', 'state', 'rawPayloadIncluded', 'credentialMaterialIncluded'];
const policy = contract.backupPolicy || {};
if (policy.manifestSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.currentGeneration !== 2 || policy.evidenceRecordCount !== 6 || policy.sourceFailureDomain !== 'fd-primary' || policy.approvedRestoreFailureDomain !== 'fd-standby' || policy.maximumConcurrentRestoreHolderCount !== 1 || policy.restoreContenderCount !== 4 || policy.maximumLocalRestoreMilliseconds !== 3000 || !sameJson(policy.manifestFields, manifestFields) || !sameJson(policy.recordFields, recordFields)) failures.push('backupPolicy algorithms, generation, domains, bounds, or fields are invalid');
requireTrue(policy, ['fullReadBackRequired', 'exactRecordOrderRequired'], 'backupPolicy', failures);
requireFalse(policy, ['staleGenerationRestorePermitted', 'crossDomainRestoreWithoutApprovalPermitted', 'rawPayloadIncluded', 'credentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'backupPolicy', failures);

const expectedScenarios = [
    [1, 'BR-001', 'write_payload_free_backup', 'backup_written_and_read_back'],
    [2, 'BR-002', 'restore_exact_manifest_to_standby', 'restore_digest_and_records_match'],
    [3, 'BR-003', 'corrupt_backup_digest', 'corruption_detected'],
    [4, 'BR-004', 'truncate_backup_file', 'truncation_detected'],
    [5, 'BR-005', 'delete_evidence_record', 'record_deletion_detected'],
    [6, 'BR-006', 'reorder_evidence_records', 'record_reorder_detected'],
    [7, 'BR-007', 'restore_stale_generation', 'stale_generation_refused'],
    [8, 'BR-008', 'restore_to_unapproved_failure_domain', 'failure_domain_refused'],
    [9, 'BR-009', 'four_simultaneous_restore_claimants', 'exactly_one_restore_winner'],
    [10, 'BR-010', 'global_disable_before_restored_activation', 'restored_activation_refused']
];
const plan = contract.scenarioPlan || {};
if (plan.scenarioCount !== 10 || plan.expectedPassedScenarioCount !== 10 || !sameJson([plan.expectedBackupWriteCount, plan.expectedExactRestoreCount, plan.expectedCorruptionDetectionCount, plan.expectedTruncationDetectionCount, plan.expectedDeletionDetectionCount, plan.expectedReorderDetectionCount, plan.expectedStaleGenerationRefusalCount, plan.expectedFailureDomainRefusalCount, plan.expectedRestoreWinnerCount, plan.expectedRestoreLoserCount, plan.expectedGlobalDisableActivationBlockCount], [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1])) failures.push('scenarioPlan counts are invalid');
if (!Array.isArray(plan.scenarios) || plan.scenarios.length !== 10) failures.push('scenarioPlan must contain exactly 10 scenarios');
for (let index = 0; index < expectedScenarios.length; index += 1) {
    const item = plan.scenarios?.[index] || {};
    if (!sameJson([item.sequence, item.id, item.fault, item.expectedOutcome], expectedScenarios[index])) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}

const expectedRefusals = {
    'DR-001': ['substitute_packet_evidence', 'source_evidence_mismatch'], 'DR-002': ['substitute_history_evidence', 'source_evidence_mismatch'],
    'DR-003': ['substitute_alert_evidence', 'source_evidence_mismatch'], 'DR-004': ['substitute_lease_evidence', 'source_evidence_mismatch'],
    'DR-005': ['substitute_recovery_evidence', 'source_evidence_mismatch'], 'DR-006': ['substitute_consensus_evidence', 'source_evidence_mismatch'],
    'DR-007': ['invalid_generation', 'generation_invalid'], 'DR-008': ['stale_generation', 'generation_stale'],
    'DR-009': ['invalid_created_time', 'created_time_invalid'], 'DR-010': ['unapproved_source_failure_domain', 'failure_domain_invalid'],
    'DR-011': ['unapproved_target_failure_domain', 'failure_domain_invalid'], 'DR-012': ['remove_required_field', 'manifest_fields_invalid'],
    'DR-013': ['add_payload_field', 'manifest_fields_invalid'], 'DR-014': ['include_raw_payload', 'payload_or_credential_material_invalid'],
    'DR-015': ['include_credential_material', 'payload_or_credential_material_invalid'], 'DR-016': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'DR-017': ['global_disable_active', 'global_disable_active']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 17 || refusalPlan.expectedRefusalCount !== 17) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_separated_primary_backup_restore_and_quarantine_directories' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'separateFailureDomainDirectoriesRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionBackup', 'countsAsEligibleCycle', 'productionDurabilityConfigured'], 'rehearsalStore', failures);

const production = contract.productionDurabilityPolicy || {};
requireFalse(production, ['providerSelected', 'writerIdentityConfigured', 'readerIdentityConfigured', 'restoreIdentityConfigured', 'encryptionKeyConfigured', 'retentionPolicyApproved', 'immutabilityVerified', 'independentFailureDomainVerified', 'restoreIntegrityVerified', 'recoveryPointObjectiveApproved', 'recoveryTimeObjectiveApproved', 'regionalFailoverVerified', 'productionRestoreExercisePassed', 'authenticatedAlertRouteConfigured'], 'productionDurabilityPolicy', failures);
for (const field of ['backupStoreRef', 'restoreStoreRef', 'sourceRegionRef', 'recoveryRegionRef']) if (production[field] !== null) failures.push(`productionDurabilityPolicy.${field} must remain null`);

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `BR-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 110) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.packetCount !== 2 || contract.evidenceRecordCount !== 6 || contract.scenarioCount !== 10 || contract.restoreContenderCount !== 4 || contract.refusalScenarioCount !== 17 || contract.expectedRefusalCount !== 17) failures.push('top-level rehearsal counts are invalid');
for (const field of ['configuredProductionDurabilityCount', 'configuredProductionIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.backupRestoreContractReadyForReview !== true) failures.push('backupRestoreContractReadyForReview must be true');
for (const field of ['productionDurabilityReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 850) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
const scenarioResults = [];
const refusalResults = [];
let backupWriteCount = 0;
let exactRestoreCount = 0;
let corruptionDetectionCount = 0;
let truncationDetectionCount = 0;
let deletionDetectionCount = 0;
let reorderDetectionCount = 0;
let staleGenerationRefusalCount = 0;
let failureDomainRefusalCount = 0;
let restoreContenderProcessCount = 0;
let restoreWinnerCount = 0;
let restoreLoserCount = 0;
let globalDisableActivationBlockCount = 0;
let localRestoreDurationMilliseconds = null;
let temporaryArtifactFileCount = 0;
let repositoryMutationPaths = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a051-'));
    fs.chmodSync(temp, 0o700);
    for (const name of ['primary', 'backup', 'restore', 'quarantine']) { fs.mkdirSync(path.join(temp, name), { mode: 0o700 }); }
    const before = snapshotTree(['docs/company', 'scripts/company']);
    try {
        const sources = [
            ['A-042', 'scripts/company/compile-cadence-work-packets.cjs', output => output.packetSetValid === true],
            ['A-046', 'scripts/company/rehearse-protected-run-history.cjs', output => output.historyChainValid === true && output.reconciliationValid === true],
            ['A-047', 'scripts/company/rehearse-authenticated-exception-delivery.cjs', output => output.rehearsalValid === true],
            ['A-048', 'scripts/company/rehearse-protected-execution-lease.cjs', output => output.rehearsalValid === true && output.highestFencingToken === 3],
            ['A-049', 'scripts/company/rehearse-protected-failure-recovery.cjs', output => output.rehearsalValid === true && output.highestFencingToken === 4],
            ['A-050', 'scripts/company/rehearse-protected-time-and-split-brain.cjs', output => output.rehearsalValid === true && output.highestFencingToken === 5]
        ].map(([id, script, check]) => {
            const result = executeJson(script, 2);
            if (!result.valid || result.output.workflow !== id || !check(result.output)) failures.push(`${id} source evidence is invalid`);
            return { id, ...result };
        });
        sourceEvidenceCurrent = failures.length === 0;
        if (sourceEvidenceCurrent) {
            const expectedDigests = Object.fromEntries(sources.map(item => [item.id, sha256(item.raw)]));
            const fixedCreatedAt = '2026-08-11T16:00:00.000Z';
            function writeJson(target, value) { fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 }); }
            function recordScenario(sequence, outcome) {
                const expected = plan.scenarios[sequence - 1];
                const passed = outcome === expected.expectedOutcome;
                scenarioResults.push({ sequence, id: expected.id, fault: expected.fault, outcome, passed });
                writeJson(path.join(temp, `scenario-${String(sequence).padStart(2, '0')}.json`), { sequence, scenarioId: expected.id, outcome, passed, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            function unsignedManifest(manifest) {
                const value = clone(manifest);
                delete value.manifestDigestSha256;
                return value;
            }
            function seal(manifest) {
                manifest.manifestDigestSha256 = sha256(JSON.stringify(unsignedManifest(manifest)));
                return manifest;
            }
            function buildManifest() {
                const records = sources.map((item, index) => ({ sequence: index + 1, workflowId: item.id, evidenceDigestSha256: expectedDigests[item.id], state: 'current', rawPayloadIncluded: false, credentialMaterialIncluded: false }));
                return seal({ schemaVersion: 1, backupId: `BKP-A051-${sha256(JSON.stringify(records)).slice(0, 16).toUpperCase()}`, generation: policy.currentGeneration, createdAt: fixedCreatedAt, sourceFailureDomain: policy.sourceFailureDomain, targetFailureDomain: policy.approvedRestoreFailureDomain, recordCount: records.length, records, manifestDigestSha256: '', externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            function validateManifest(manifest, globalDisable = false) {
                if (!manifest || !sameJson(Object.keys(manifest), manifestFields)) return 'manifest_fields_invalid';
                if (!Number.isInteger(manifest.generation) || manifest.generation < 1) return 'generation_invalid';
                if (manifest.generation < policy.currentGeneration) return 'generation_stale';
                if (!Number.isFinite(Date.parse(manifest.createdAt))) return 'created_time_invalid';
                if (manifest.sourceFailureDomain !== policy.sourceFailureDomain || manifest.targetFailureDomain !== policy.approvedRestoreFailureDomain) return 'failure_domain_invalid';
                if (!Array.isArray(manifest.records) || manifest.recordCount !== policy.evidenceRecordCount || manifest.records.length !== policy.evidenceRecordCount) return 'record_count_invalid';
                for (let index = 0; index < manifest.records.length; index += 1) {
                    const record = manifest.records[index];
                    if (!sameJson(Object.keys(record), recordFields)) return 'record_fields_invalid';
                    const expectedId = sources[index]?.id;
                    if (record.sequence !== index + 1 || record.workflowId !== expectedId) return 'record_order_invalid';
                    if (record.evidenceDigestSha256 !== expectedDigests[record.workflowId]) return 'source_evidence_mismatch';
                    if (record.state !== 'current') return 'record_state_invalid';
                    if (record.rawPayloadIncluded !== false || record.credentialMaterialIncluded !== false) return 'payload_or_credential_material_invalid';
                }
                if (manifest.externalActionAuthorized !== false || manifest.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                if (manifest.manifestDigestSha256 !== sha256(JSON.stringify(unsignedManifest(manifest)))) return 'manifest_digest_mismatch';
                if (globalDisable) return 'global_disable_active';
                return null;
            }
            function writeMutation(name, value) { writeJson(path.join(temp, 'quarantine', name), value); }
            function runRestoreRace(count) {
                const lock = path.join(temp, 'restore-race-lock.json');
                const prefix = path.join(temp, 'restore-race-result-');
                const startAt = Date.now() + 250;
                const coordinatorCode = "const{spawn}=require('child_process');const fs=require('fs');const[lock,prefix,countRaw,startRaw]=process.argv.slice(1);const count=Number(countRaw),start=Number(startRaw);const contender=\"const fs=require('fs');const b=new Int32Array(new SharedArrayBuffer(4));const[lock,result,startRaw,index]=process.argv.slice(1);const start=Number(startRaw);while(Date.now()<start)Atomics.wait(b,0,0,5);let outcome='lost';try{fs.writeFileSync(lock,JSON.stringify({winner:index}),{flag:'wx',mode:0o600});outcome='won'}catch(e){if(e.code!=='EEXIST')outcome='error'}fs.writeFileSync(result,JSON.stringify({index:Number(index),outcome}),{flag:'wx',mode:0o600});\";Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,['-e',contender,lock,prefix+i+'.json',String(start),String(i)],{stdio:'ignore'});c.on('exit',code=>code===0?resolve():reject(new Error('contender exit '+code)));c.on('error',reject)}))).then(()=>{const out=Array.from({length:count},(_,i)=>JSON.parse(fs.readFileSync(prefix+i+'.json','utf8')));process.stdout.write(JSON.stringify(out))}).catch(e=>{console.error(e.message);process.exit(1)});";
                const result = spawnSync(process.execPath, ['-e', coordinatorCode, lock, prefix, String(count), String(startAt)], { cwd: temp, encoding: 'utf8', timeout: policy.maximumLocalRestoreMilliseconds, maxBuffer: 1024 * 1024 });
                if (result.status !== 0) { failures.push(`restore race failed: ${result.stderr.trim()}`); return []; }
                try { return JSON.parse(result.stdout); } catch { failures.push('restore race output was invalid'); return []; }
            }

            writeJson(path.join(temp, 'source-bindings.json'), { packetSourceIds: source.packetSourceIds, expectedDigests, rawPayloadIncluded: false, credentialMaterialIncluded: false, externalActionAuthorized: false });
            const manifest = buildManifest();
            const primaryPath = path.join(temp, 'primary', 'manifest.json');
            const backupPath = path.join(temp, 'backup', 'manifest.json');
            writeJson(primaryPath, manifest);
            fs.copyFileSync(primaryPath, backupPath, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(backupPath, 0o600);
            const readBack = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            if (validateManifest(readBack) === null) backupWriteCount = 1;
            recordScenario(1, backupWriteCount === 1 ? 'backup_written_and_read_back' : 'unexpected');

            const restoreStartedAt = Date.now();
            const restorePath = path.join(temp, 'restore', 'manifest.json');
            fs.copyFileSync(backupPath, restorePath, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(restorePath, 0o600);
            const restored = JSON.parse(fs.readFileSync(restorePath, 'utf8'));
            localRestoreDurationMilliseconds = Date.now() - restoreStartedAt;
            if (validateManifest(restored) === null && restored.manifestDigestSha256 === manifest.manifestDigestSha256 && sameJson(restored.records, manifest.records)) exactRestoreCount = 1;
            recordScenario(2, exactRestoreCount === 1 ? 'restore_digest_and_records_match' : 'unexpected');

            const corrupt = clone(manifest); corrupt.manifestDigestSha256 = '0'.repeat(64); writeMutation('corrupt.json', corrupt);
            if (validateManifest(corrupt) === 'manifest_digest_mismatch') corruptionDetectionCount = 1;
            recordScenario(3, corruptionDetectionCount === 1 ? 'corruption_detected' : 'unexpected');

            fs.writeFileSync(path.join(temp, 'quarantine', 'truncated.json'), '{"schemaVersion":1', { flag: 'wx', mode: 0o600 });
            try { JSON.parse(fs.readFileSync(path.join(temp, 'quarantine', 'truncated.json'), 'utf8')); }
            catch { truncationDetectionCount = 1; }
            recordScenario(4, truncationDetectionCount === 1 ? 'truncation_detected' : 'unexpected');

            const deleted = clone(manifest); deleted.records.pop(); deleted.recordCount -= 1; seal(deleted); writeMutation('deleted.json', deleted);
            if (validateManifest(deleted) === 'record_count_invalid') deletionDetectionCount = 1;
            recordScenario(5, deletionDetectionCount === 1 ? 'record_deletion_detected' : 'unexpected');

            const reordered = clone(manifest); [reordered.records[0], reordered.records[1]] = [reordered.records[1], reordered.records[0]]; seal(reordered); writeMutation('reordered.json', reordered);
            if (validateManifest(reordered) === 'record_order_invalid') reorderDetectionCount = 1;
            recordScenario(6, reorderDetectionCount === 1 ? 'record_reorder_detected' : 'unexpected');

            const stale = clone(manifest); stale.generation = policy.currentGeneration - 1; seal(stale); writeMutation('stale.json', stale);
            if (validateManifest(stale) === 'generation_stale') staleGenerationRefusalCount = 1;
            recordScenario(7, staleGenerationRefusalCount === 1 ? 'stale_generation_refused' : 'unexpected');

            const wrongDomain = clone(manifest); wrongDomain.targetFailureDomain = 'fd-unapproved'; seal(wrongDomain); writeMutation('wrong-domain.json', wrongDomain);
            if (validateManifest(wrongDomain) === 'failure_domain_invalid') failureDomainRefusalCount = 1;
            recordScenario(8, failureDomainRefusalCount === 1 ? 'failure_domain_refused' : 'unexpected');

            const race = runRestoreRace(policy.restoreContenderCount);
            restoreContenderProcessCount = race.length;
            restoreWinnerCount = race.filter(item => item.outcome === 'won').length;
            restoreLoserCount = race.filter(item => item.outcome === 'lost').length;
            recordScenario(9, restoreWinnerCount === 1 && restoreLoserCount === 3 ? 'exactly_one_restore_winner' : 'unexpected');

            if (validateManifest(restored, true) === 'global_disable_active') globalDisableActivationBlockCount = 1;
            recordScenario(10, globalDisableActivationBlockCount === 1 ? 'restored_activation_refused' : 'unexpected');

            for (const item of refusalPlan.scenarios) {
                const candidate = clone(manifest);
                let globalDisable = false;
                const byId = id => candidate.records.find(record => record.workflowId === id);
                if (item.mutation === 'substitute_packet_evidence') byId('A-042').evidenceDigestSha256 = '0'.repeat(64);
                else if (item.mutation === 'substitute_history_evidence') byId('A-046').evidenceDigestSha256 = '1'.repeat(64);
                else if (item.mutation === 'substitute_alert_evidence') byId('A-047').evidenceDigestSha256 = '2'.repeat(64);
                else if (item.mutation === 'substitute_lease_evidence') byId('A-048').evidenceDigestSha256 = '3'.repeat(64);
                else if (item.mutation === 'substitute_recovery_evidence') byId('A-049').evidenceDigestSha256 = '4'.repeat(64);
                else if (item.mutation === 'substitute_consensus_evidence') byId('A-050').evidenceDigestSha256 = '5'.repeat(64);
                else if (item.mutation === 'invalid_generation') candidate.generation = 0;
                else if (item.mutation === 'stale_generation') candidate.generation = policy.currentGeneration - 1;
                else if (item.mutation === 'invalid_created_time') candidate.createdAt = 'not-a-time';
                else if (item.mutation === 'unapproved_source_failure_domain') candidate.sourceFailureDomain = 'fd-other';
                else if (item.mutation === 'unapproved_target_failure_domain') candidate.targetFailureDomain = 'fd-other';
                else if (item.mutation === 'remove_required_field') delete candidate.createdAt;
                else if (item.mutation === 'add_payload_field') candidate.payload = { forbidden: true };
                else if (item.mutation === 'include_raw_payload') candidate.records[0].rawPayloadIncluded = true;
                else if (item.mutation === 'include_credential_material') candidate.records[0].credentialMaterialIncluded = true;
                else if (item.mutation === 'authorize_external_action') candidate.externalActionAuthorized = true;
                else if (item.mutation === 'global_disable_active') globalDisable = true;
                const reasonCode = validateManifest(candidate, globalDisable);
                const refused = reasonCode === item.expectedReasonCode;
                refusalResults.push({ id: item.id, mutation: item.mutation, reasonCode, refused });
                writeJson(path.join(temp, `refusal-${item.id}.json`), { id: item.id, reasonCode, refused, externalActionAuthorized: false, sensitivePayloadIncluded: false });
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
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && passedScenarioCount === 10 && backupWriteCount === 1 && exactRestoreCount === 1 && corruptionDetectionCount === 1 && truncationDetectionCount === 1 && deletionDetectionCount === 1 && reorderDetectionCount === 1 && staleGenerationRefusalCount === 1 && failureDomainRefusalCount === 1 && restoreContenderProcessCount === 4 && restoreWinnerCount === 1 && restoreLoserCount === 3 && globalDisableActivationBlockCount === 1 && Number.isInteger(localRestoreDurationMilliseconds) && localRestoreDurationMilliseconds <= policy.maximumLocalRestoreMilliseconds && refusedScenarioCount === 17 && temporaryArtifactFileCount === 42 && repositoryMutationPaths.length === 0 && failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-051',
    mode: options.validateOnly ? 'contract validation only' : 'offline payload-free backup, isolated restore, corruption, failure-domain, and concurrent-restore rehearsal',
    backupRestoreContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    packetCount: sourceEvidenceCurrent ? 2 : 0,
    evidenceRecordCount: sourceEvidenceCurrent ? 6 : 0,
    scenarioCount: scenarioResults.length,
    passedScenarioCount,
    backupWriteCount,
    exactRestoreCount,
    corruptionDetectionCount,
    truncationDetectionCount,
    deletionDetectionCount,
    reorderDetectionCount,
    staleGenerationRefusalCount,
    failureDomainRefusalCount,
    restoreContenderProcessCount,
    restoreWinnerCount,
    restoreLoserCount,
    globalDisableActivationBlockCount,
    localRestoreDurationMilliseconds,
    localRestoreWithinBound: Number.isInteger(localRestoreDurationMilliseconds) && localRestoreDurationMilliseconds <= policy.maximumLocalRestoreMilliseconds,
    temporaryArtifactFileCount,
    rawPayloadStoredCount: 0,
    credentialMaterialStoredCount: 0,
    scheduledCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: refusalResults.length,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.filter(item => !item.refused).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionDurabilityConfigured: contract.configuredProductionDurabilityCount > 0,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount,
    encryptionKeyConfigured: contract.productionDurabilityPolicy?.encryptionKeyConfigured === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    backupRestoreContractReadyForReview: contract.backupRestoreContractReadyForReview === true && contractFailureCount === 0,
    productionDurabilityReady: contract.productionDurabilityReady === true,
    eligibleCycleReady: contract.eligibleCycleReady === true,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    failures,
    scenarioResults,
    refusalResults
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
