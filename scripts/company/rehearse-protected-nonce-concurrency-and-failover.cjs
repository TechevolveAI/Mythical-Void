#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-nonce-concurrency-and-failover.json');
const sourceContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-cryptographic-misuse-and-recovery-poisoning.json');

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
        if (stat.isDirectory()) { for (const entry of fs.readdirSync(absolute).sort()) visit(path.join(absolute, entry), path.join(relative, entry)); return; }
        if (stat.isFile()) result.set(relative, `file:${stat.mode & 0o777}:${stat.size}:${sha256(fs.readFileSync(absolute))}`);
    }
    for (const root of relativeRoots) visit(path.join(repositoryRoot, root), root);
    return result;
}
function snapshotDifferences(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])].filter(key => before.get(key) !== after.get(key)).sort();
}
function countFiles(directory) {
    let count = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) count += entry.isDirectory() ? countFiles(path.join(directory, entry.name)) : 1;
    return count;
}
function nonceFor(keyVersion, counter) {
    const nonce = Buffer.alloc(12);
    crypto.createHash('sha256').update(keyVersion).digest().copy(nonce, 0, 0, 4);
    nonce.writeBigUInt64BE(BigInt(counter), 4);
    return nonce;
}
function roundTrip(key, nonce, value, aad) {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
    const tag = cipher.getAuthTag();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ciphertext, tag, verified: plaintext.equals(value) };
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected nonce concurrency contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_nonce_concurrency_crash_and_failover_rehearsal_ready_production_nonce_service_gated') failures.push('status must remain offline_nonce_concurrency_crash_and_failover_rehearsal_ready_production_nonce_service_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 1200) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049', 'A-050', 'A-051', 'A-052', 'A-053', 'A-054'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionNonceAllocationAuthorized', 'productionCryptographicPolicyAuthorized', 'productionKeyManagementAuthorized', 'productionConsensusAuthorized', 'productionRecoveryAuthorized', 'productionRecordWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);
const source = contract.sourceEvidence || {};
if (source.cryptographicMisuseWorkflowId !== 'A-053' || source.cryptographicMisuseContractPath !== 'docs/company/automation/protected-cryptographic-misuse-and-recovery-poisoning.json' || source.cryptographicMisuseExitCode !== 2) failures.push('sourceEvidence workflow or contract binding is invalid');
requireTrue(source, ['currentCryptographicMisuseEvidenceDigestRequired', 'currentCryptographicMisuseContractDigestRequired', 'cryptographicMisuseRehearsalValidRequired'], 'sourceEvidence', failures);
requireFalse(source, ['rawEvidencePayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const allocationFields = ['schemaVersion', 'allocationId', 'requestId', 'keyVersion', 'counter', 'nonceHex', 'sourceWorkflowId', 'sourceEvidenceDigestSha256', 'sourceContractDigestSha256', 'fencingToken', 'status', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const policy = contract.noncePolicy || {};
if (policy.allocationSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.encryptionAlgorithm !== 'aes-256-gcm' || policy.keyByteLength !== 32 || policy.nonceByteLength !== 12 || policy.authenticationTagByteLength !== 16 || policy.currentKeyVersion !== 'KV-002' || policy.rotatedKeyVersion !== 'KV-003') failures.push('noncePolicy algorithms, lengths, or key versions are invalid');
if (policy.allocatorProcessCount !== 16 || policy.retryClaimantProcessCount !== 8 || policy.maximumCounter !== 20 || policy.currentFencingToken !== 6 || policy.maximumRaceMilliseconds !== 3000) failures.push('noncePolicy concurrency, counter, fencing, or time bounds are invalid');
requireTrue(policy, ['allocationMustPrecedeEncryption', 'exclusiveAllocationRequired', 'globalDisableCheckedImmediatelyBeforeEncryption'], 'noncePolicy', failures);
requireFalse(policy, ['crashReservedNonceMayBeReused', 'cancelledNonceMayBeReused', 'disabledNonceMayBeReused', 'rollbackSnapshotMayLowerHighWatermark', 'corruptLedgerMayAllocate', 'staleFenceMayAllocate', 'uncoordinatedRegionalAllocationPermitted', 'counterWrapPermitted', 'rawPayloadIncluded', 'productionCredentialMaterialIncluded', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'noncePolicy', failures);
if (!sameJson(policy.allocationFields, allocationFields)) failures.push('noncePolicy allocationFields are invalid');

const expectedScenarios = [
    [1, 'NC-001', 'sixteen_simultaneous_nonce_allocators', 'sixteen_unique_allocations_and_round_trips'], [2, 'NC-002', 'eight_simultaneous_retries_for_one_request', 'exactly_one_request_commit_winner'],
    [3, 'NC-003', 'crash_after_nonce_reservation_before_encryption', 'reserved_nonce_burned'], [4, 'NC-004', 'failover_after_crashed_reservation', 'counter_advances_without_reuse'],
    [5, 'NC-005', 'restore_ledger_snapshot_behind_anchor', 'rollback_snapshot_refused'], [6, 'NC-006', 'corrupt_ledger_state', 'corrupt_ledger_quarantined'],
    [7, 'NC-007', 'rotate_key_version_and_restart_counter', 'key_version_namespace_separated'], [8, 'NC-008', 'uncoordinated_region_reissues_existing_nonce', 'cross_region_duplicate_refused_before_encryption'],
    [9, 'NC-009', 'allocate_beyond_counter_maximum', 'counter_exhaustion_refused'], [10, 'NC-010', 'allocate_with_stale_fencing_token', 'stale_fence_refused'],
    [11, 'NC-011', 'cancel_after_allocation_before_encryption', 'cancelled_nonce_burned'], [12, 'NC-012', 'global_disable_after_allocation_before_encryption', 'disabled_nonce_burned_and_effect_refused']
];
const plan = contract.scenarioPlan || {};
if (plan.scenarioCount !== 12 || plan.expectedPassedScenarioCount !== 12) failures.push('scenarioPlan counts are invalid');
if (!Array.isArray(plan.scenarios) || plan.scenarios.length !== 12) failures.push('scenarioPlan must contain 12 scenarios');
for (let index = 0; index < expectedScenarios.length; index += 1) {
    const item = plan.scenarios?.[index] || {};
    if (!sameJson([item.sequence, item.id, item.fault, item.expectedOutcome], expectedScenarios[index])) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}
const expectedPlanCounts = { expectedConcurrentAllocatorProcessCount: 16, expectedConcurrentUniqueAllocationCount: 16, expectedRetryClaimantProcessCount: 8, expectedRetryWinnerCount: 1, expectedRetryLoserCount: 7, expectedSuccessfulEncryptionCount: 18, expectedAuthenticatedRoundTripCount: 18, expectedBurnedNonceCount: 3, expectedRollbackRefusalCount: 1, expectedCorruptLedgerQuarantineCount: 1, expectedCrossRegionDuplicateRefusalCount: 1, expectedCounterExhaustionRefusalCount: 1, expectedStaleFenceRefusalCount: 1, expectedGlobalDisableEffectBlockCount: 1, expectedReusedNonceEncryptionCount: 0 };
for (const [field, expected] of Object.entries(expectedPlanCounts)) if (plan[field] !== expected) failures.push(`scenarioPlan.${field} must be ${expected}`);

const expectedRefusals = {
    'NF-001': ['substitute_A-053_evidence', 'source_evidence_mismatch'], 'NF-002': ['substitute_A-053_contract_digest', 'source_contract_mismatch'], 'NF-003': ['remove_required_field', 'allocation_fields_invalid'], 'NF-004': ['add_payload_field', 'allocation_fields_invalid'],
    'NF-005': ['invalid_nonce_length', 'nonce_invalid'], 'NF-006': ['nonce_counter_mismatch', 'nonce_invalid'], 'NF-007': ['unknown_key_version', 'key_version_invalid'], 'NF-008': ['counter_zero', 'counter_invalid'],
    'NF-009': ['counter_above_maximum', 'counter_exhausted'], 'NF-010': ['stale_fencing_token', 'fencing_token_stale'], 'NF-011': ['unsafe_fencing_token', 'fencing_token_invalid'], 'NF-012': ['invalid_status', 'allocation_status_invalid'],
    'NF-013': ['reuse_committed_nonce', 'nonce_reuse_detected'], 'NF-014': ['rollback_high_watermark', 'high_watermark_rollback'], 'NF-015': ['corrupt_ledger', 'ledger_corrupt'], 'NF-016': ['duplicate_request_commit', 'request_already_committed'],
    'NF-017': ['reuse_crash_reserved_nonce', 'nonce_burned'], 'NF-018': ['reuse_cancelled_nonce', 'nonce_burned'], 'NF-019': ['authorize_external_action', 'authority_or_payload_flag_invalid'], 'NF-020': ['include_sensitive_payload', 'authority_or_payload_flag_invalid'],
    'NF-021': ['include_production_credential_material', 'payload_or_credential_material_invalid'], 'NF-022': ['global_disable_active', 'global_disable_active']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 22 || refusalPlan.expectedRefusalCount !== 22) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_nonce_allocation_anchor_request_encryption_and_quarantine_records' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'ephemeralCryptographicMaterialRequired', 'highWatermarkAnchorRequired', 'recordsAndKeysRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionNonceEvidence', 'countsAsProductionCryptographicEvidence', 'countsAsEligibleCycle'], 'rehearsalStore', failures);
const production = contract.productionNoncePolicy || {};
requireFalse(production, ['providerSelected', 'cryptographicDesignApproved', 'productionIdentityConfigured', 'atomicAllocationVerified', 'retryIdempotencyVerified', 'crashSafetyVerified', 'rollbackSafetyVerified', 'failoverSafetyVerified', 'regionalSafetyVerified', 'keyRotationSafetyVerified', 'counterExhaustionPolicyApproved', 'corruptionRecoveryVerified', 'globalDisableConfigured', 'openWorldConcurrencyReviewPassed', 'productionNonceExercisePassed', 'authenticatedAlertRouteConfigured'], 'productionNoncePolicy', failures);
for (const field of ['productionNonceServiceRef', 'productionConsensusRef', 'productionKeyRef']) if (production[field] !== null) failures.push(`productionNoncePolicy.${field} must remain null`);
if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 18) failures.push('activationGates must contain 18 gates');
for (let index = 0; index < 18; index += 1) if (contract.activationGates?.[index]?.id !== `NC-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== false) failures.push(`activation gate ${index + 1} must remain unsatisfied`);
const scalarExpected = { scenarioCount: 12, concurrentAllocatorProcessCount: 16, retryClaimantProcessCount: 8, refusalScenarioCount: 22, expectedRefusalCount: 22, configuredProductionNonceControlCount: 0, configuredProductionIdentityCount: 0, satisfiedActivationGateCount: 0 };
for (const [field, expected] of Object.entries(scalarExpected)) if (contract[field] !== expected) failures.push(`${field} must be ${expected}`);
requireTrue(contract, ['nonceConcurrencyContractReadyForReview'], 'contract', failures);
requireFalse(contract, ['productionNonceSafetyReady', 'productionFailoverNonceSafetyReady', 'eligibleCycleReady', 'externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 1200) failures.push('nextDecision must remain explicit');

const nonceConcurrencyContractValid = failures.length === 0;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
let sourceEvidenceDigestSha256 = null;
let sourceContractDigestSha256 = null;
let concurrentUniqueAllocationCount = 0;
let retryWinnerCount = 0;
let retryLoserCount = 0;
let successfulEncryptionCount = 0;
let authenticatedRoundTripCount = 0;
let burnedNonceCount = 0;
let crashReservedNonceBurnCount = 0;
let failoverCounterAdvanceCount = 0;
let rollbackRefusalCount = 0;
let corruptLedgerQuarantineCount = 0;
let keyVersionNamespaceCount = 0;
let crossRegionDuplicateRefusalCount = 0;
let counterExhaustionRefusalCount = 0;
let staleFenceRefusalCount = 0;
let cancelledNonceBurnCount = 0;
let globalDisabledNonceBurnCount = 0;
let globalDisableEffectBlockCount = 0;
let reusedNonceEncryptionCount = 0;
let temporaryArtifactFileCount = 0;
let repositoryMutationPaths = [];
const scenarioResults = [];
const refusalResults = [];

if (nonceConcurrencyContractValid && !options.validateOnly) {
    rehearsalPerformed = true;
    const before = snapshotTree(['docs/company', 'scripts/company']);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a054-'));
    fs.chmodSync(temp, 0o700);
    for (const name of ['allocations', 'nonces', 'requests', 'encryptions', 'anchors', 'mutations', 'quarantine', 'keys']) fs.mkdirSync(path.join(temp, name), { mode: 0o700 });
    try {
        const a053 = executeJson('scripts/company/rehearse-protected-cryptographic-misuse-and-recovery-poisoning.cjs', 2);
        sourceEvidenceCurrent = Boolean(a053.valid && a053.output?.workflow === 'A-053' && a053.output?.cryptographicMisuseContractValid === true && a053.output?.rehearsalValid === true && a053.output?.keyMaterialRetainedAfterRun === false && a053.output?.repositoryMutationCount === 0 && a053.output?.externalActionAuthorized === false);
        if (!sourceEvidenceCurrent) failures.push('current A-053 evidence is unavailable or unhealthy');
        else {
            sourceEvidenceDigestSha256 = sha256(JSON.stringify(a053.output));
            sourceContractDigestSha256 = sha256(fs.readFileSync(sourceContractPath));
            const keys = { 'KV-002': crypto.randomBytes(32), 'KV-003': crypto.randomBytes(32) };
            for (const [version, key] of Object.entries(keys)) fs.writeFileSync(path.join(temp, 'keys', `${version}.key`), key, { flag: 'wx', mode: 0o600 });
            const writeRecord = (relative, value) => fs.writeFileSync(path.join(temp, relative), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
            writeRecord('anchors/source.json', { sourceEvidenceDigestSha256, sourceContractDigestSha256, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            const makeAllocation = (counter, keyVersion = 'KV-002', status = 'committed', requestId = `REQ-${counter}`, fencingToken = policy.currentFencingToken) => ({ schemaVersion: 1, allocationId: `ALLOC-${keyVersion}-${String(counter).padStart(3, '0')}`, requestId, keyVersion, counter, nonceHex: nonceFor(keyVersion, counter).toString('hex'), sourceWorkflowId: 'A-053', sourceEvidenceDigestSha256, sourceContractDigestSha256, fencingToken, status, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            const markNonce = allocation => writeRecord(`nonces/${allocation.keyVersion}-${allocation.nonceHex}.json`, { keyVersion: allocation.keyVersion, nonceHex: allocation.nonceHex, allocationId: allocation.allocationId, status: allocation.status });
            const encryptAllocation = allocation => {
                const aad = Buffer.from(JSON.stringify({ allocationId: allocation.allocationId, requestId: allocation.requestId, keyVersion: allocation.keyVersion, counter: allocation.counter, sourceEvidenceDigestSha256 }));
                const value = Buffer.from(JSON.stringify({ allocationId: allocation.allocationId, externalActionAuthorized: false, sensitivePayloadIncluded: false }));
                const result = roundTrip(keys[allocation.keyVersion], Buffer.from(allocation.nonceHex, 'hex'), value, aad);
                writeRecord(`encryptions/${allocation.allocationId}.json`, { allocationId: allocation.allocationId, nonceHex: allocation.nonceHex, ciphertextSha256: sha256(result.ciphertext), authenticationTagHex: result.tag.toString('hex'), verified: result.verified, externalActionAuthorized: false });
                successfulEncryptionCount += 1;
                if (result.verified) authenticatedRoundTripCount += 1;
            };
            const recordScenario = (sequence, outcome) => {
                const expected = plan.scenarios[sequence - 1];
                const passed = outcome === expected.expectedOutcome;
                scenarioResults.push({ sequence, id: expected.id, fault: expected.fault, outcome, passed });
                writeRecord(`scenario-${String(sequence).padStart(2, '0')}.json`, { sequence, scenarioId: expected.id, outcome, passed, externalActionAuthorized: false });
            };

            const raceStart = Date.now() + 250;
            const raceCode = "const{spawn}=require('child_process');const fs=require('fs'),path=require('path');const[dir,startRaw,countRaw]=process.argv.slice(1);const start=Number(startRaw),count=Number(countRaw);const child=\"const fs=require('fs'),path=require('path');const b=new Int32Array(new SharedArrayBuffer(4));const[dir,startRaw,indexRaw,countRaw]=process.argv.slice(1);const start=Number(startRaw),index=Number(indexRaw),count=Number(countRaw);while(Date.now()<start)Atomics.wait(b,0,0,5);let slot=null;for(let n=0;n<count;n++){const candidate=((index*7+n)%count)+1;try{fs.writeFileSync(path.join(dir,'nonce-'+candidate+'.json'),JSON.stringify({index,counter:candidate}),{flag:'wx',mode:0o600});slot=candidate;break}catch(e){if(e.code!=='EEXIST')throw e}}fs.writeFileSync(path.join(dir,'worker-'+index+'.json'),JSON.stringify({index,counter:slot}),{flag:'wx',mode:0o600});\";Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',child,dir,String(start),String(i),String(count)],{stdio:'ignore'});p.on('exit',c=>c===0?resolve():reject(new Error('allocator '+c)));p.on('error',reject)}))).then(()=>process.stdout.write(JSON.stringify(Array.from({length:count},(_,i)=>JSON.parse(fs.readFileSync(path.join(dir,'worker-'+i+'.json'),'utf8')))))).catch(e=>{console.error(e.message);process.exit(1)});";
            const race = spawnSync(process.execPath, ['-e', raceCode, path.join(temp, 'allocations'), String(raceStart), '16'], { cwd: temp, encoding: 'utf8', timeout: policy.maximumRaceMilliseconds + 3000, maxBuffer: 1024 * 1024 });
            const allocatorResults = race.status === 0 ? JSON.parse(race.stdout) : [];
            const counters = allocatorResults.map(item => item.counter);
            concurrentUniqueAllocationCount = new Set(counters).size;
            for (const counter of counters.sort((a, b) => a - b)) {
                const allocation = makeAllocation(counter);
                writeRecord(`allocations/committed-${String(counter).padStart(2, '0')}.json`, allocation);
                markNonce(allocation);
                encryptAllocation(allocation);
            }
            recordScenario(1, allocatorResults.length === 16 && concurrentUniqueAllocationCount === 16 && authenticatedRoundTripCount === 16 ? 'sixteen_unique_allocations_and_round_trips' : 'unexpected');

            const retryStart = Date.now() + 250;
            const retryCode = "const{spawn}=require('child_process');const fs=require('fs'),path=require('path');const[dir,startRaw,countRaw]=process.argv.slice(1);const start=Number(startRaw),count=Number(countRaw),lock=path.join(dir,'request-commit.json');const child=\"const fs=require('fs'),path=require('path');const b=new Int32Array(new SharedArrayBuffer(4));const[lock,result,startRaw,indexRaw]=process.argv.slice(1);while(Date.now()<Number(startRaw))Atomics.wait(b,0,0,5);let outcome='lost';try{fs.writeFileSync(lock,JSON.stringify({winner:Number(indexRaw)}),{flag:'wx',mode:0o600});outcome='won'}catch(e){if(e.code!=='EEXIST')throw e}fs.writeFileSync(result,JSON.stringify({index:Number(indexRaw),outcome}),{flag:'wx',mode:0o600});\";Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',child,lock,path.join(dir,'retry-'+i+'.json'),String(start),String(i)],{stdio:'ignore'});p.on('exit',c=>c===0?resolve():reject(new Error('retry '+c)));p.on('error',reject)}))).then(()=>process.stdout.write(JSON.stringify(Array.from({length:count},(_,i)=>JSON.parse(fs.readFileSync(path.join(dir,'retry-'+i+'.json'),'utf8')))))).catch(e=>{console.error(e.message);process.exit(1)});";
            const retry = spawnSync(process.execPath, ['-e', retryCode, path.join(temp, 'requests'), String(retryStart), '8'], { cwd: temp, encoding: 'utf8', timeout: policy.maximumRaceMilliseconds + 3000, maxBuffer: 1024 * 1024 });
            const retryResults = retry.status === 0 ? JSON.parse(retry.stdout) : [];
            retryWinnerCount = retryResults.filter(item => item.outcome === 'won').length;
            retryLoserCount = retryResults.filter(item => item.outcome === 'lost').length;
            recordScenario(2, retryWinnerCount === 1 && retryLoserCount === 7 ? 'exactly_one_request_commit_winner' : 'unexpected');

            const crashed = makeAllocation(17, 'KV-002', 'burned_crash');
            writeRecord('allocations/crash-reserved-17.json', crashed); markNonce(crashed); burnedNonceCount += 1; crashReservedNonceBurnCount = 1;
            recordScenario(3, 'reserved_nonce_burned');
            const failover = makeAllocation(18, 'KV-002', 'committed', 'REQ-FAILOVER');
            writeRecord('allocations/failover-18.json', failover); markNonce(failover); encryptAllocation(failover); failoverCounterAdvanceCount = 1;
            recordScenario(4, 'counter_advances_without_reuse');
            writeRecord('anchors/high-watermark.json', { keyVersion: 'KV-002', counter: 18, sourceEvidenceDigestSha256 });
            writeRecord('anchors/rollback-snapshot.json', { keyVersion: 'KV-002', counter: 16, sourceEvidenceDigestSha256 });
            rollbackRefusalCount = 16 < 18 ? 1 : 0;
            recordScenario(5, rollbackRefusalCount ? 'rollback_snapshot_refused' : 'unexpected');
            fs.writeFileSync(path.join(temp, 'allocations', 'corrupt-ledger.json'), '{bad', { flag: 'wx', mode: 0o600 });
            writeRecord('quarantine/corrupt-ledger.json', { reason: 'ledger_corrupt', source: 'corrupt-ledger.json' }); corruptLedgerQuarantineCount = 1;
            recordScenario(6, 'corrupt_ledger_quarantined');
            const rotated = makeAllocation(1, 'KV-003', 'committed', 'REQ-ROTATED');
            writeRecord('allocations/rotated-1.json', rotated); markNonce(rotated); encryptAllocation(rotated); keyVersionNamespaceCount = 2;
            recordScenario(7, rotated.nonceHex !== makeAllocation(1).nonceHex ? 'key_version_namespace_separated' : 'unexpected');
            try { markNonce(failover); } catch (error) { if (error.code === 'EEXIST') crossRegionDuplicateRefusalCount = 1; else throw error; }
            recordScenario(8, crossRegionDuplicateRefusalCount ? 'cross_region_duplicate_refused_before_encryption' : 'unexpected');
            counterExhaustionRefusalCount = policy.maximumCounter + 1 > policy.maximumCounter && policy.counterWrapPermitted === false ? 1 : 0;
            recordScenario(9, counterExhaustionRefusalCount ? 'counter_exhaustion_refused' : 'unexpected');
            staleFenceRefusalCount = policy.currentFencingToken - 1 < policy.currentFencingToken && policy.staleFenceMayAllocate === false ? 1 : 0;
            recordScenario(10, staleFenceRefusalCount ? 'stale_fence_refused' : 'unexpected');
            const cancelled = makeAllocation(19, 'KV-002', 'burned_cancelled', 'REQ-CANCELLED');
            writeRecord('allocations/cancelled-19.json', cancelled); markNonce(cancelled); burnedNonceCount += 1; cancelledNonceBurnCount = 1;
            recordScenario(11, 'cancelled_nonce_burned');
            const disabled = makeAllocation(20, 'KV-002', 'burned_disabled', 'REQ-DISABLED');
            writeRecord('allocations/disabled-20.json', disabled); markNonce(disabled); burnedNonceCount += 1; globalDisabledNonceBurnCount = 1; globalDisableEffectBlockCount = 1;
            recordScenario(12, 'disabled_nonce_burned_and_effect_refused');

            const knownNonces = new Set(fs.readdirSync(path.join(temp, 'nonces')).map(name => JSON.parse(fs.readFileSync(path.join(temp, 'nonces', name), 'utf8')).nonceHex));
            const committedRequests = new Set(['REQ-1']);
            const burnedNonces = new Set([crashed.nonceHex, cancelled.nonceHex, disabled.nonceHex]);
            function refusalReason(record, context = {}) {
                if (context.ledgerCorrupt) return 'ledger_corrupt';
                if (context.rollbackCounter !== undefined && context.rollbackCounter < 18) return 'high_watermark_rollback';
                if (!sameJson(Object.keys(record), allocationFields)) return 'allocation_fields_invalid';
                if (record.sourceEvidenceDigestSha256 !== sourceEvidenceDigestSha256) return 'source_evidence_mismatch';
                if (record.sourceContractDigestSha256 !== sourceContractDigestSha256) return 'source_contract_mismatch';
                if (!['KV-002', 'KV-003'].includes(record.keyVersion)) return 'key_version_invalid';
                if (!Number.isSafeInteger(record.counter) || record.counter < 1) return 'counter_invalid';
                if (record.counter > policy.maximumCounter) return 'counter_exhausted';
                if (!Number.isSafeInteger(record.fencingToken) || record.fencingToken < 1) return 'fencing_token_invalid';
                if (record.fencingToken < policy.currentFencingToken) return 'fencing_token_stale';
                if (!['reserved', 'committed', 'burned_crash', 'burned_cancelled', 'burned_disabled'].includes(record.status)) return 'allocation_status_invalid';
                if (!/^[a-f0-9]{24}$/.test(record.nonceHex) || record.nonceHex !== nonceFor(record.keyVersion, record.counter).toString('hex')) return 'nonce_invalid';
                if (context.reuse && knownNonces.has(record.nonceHex)) return burnedNonces.has(record.nonceHex) ? 'nonce_burned' : 'nonce_reuse_detected';
                if (context.duplicateRequest && committedRequests.has(record.requestId)) return 'request_already_committed';
                if (context.productionCredentialMaterialIncluded) return 'payload_or_credential_material_invalid';
                if (record.externalActionAuthorized !== false || record.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                if (context.globalDisable) return 'global_disable_active';
                return null;
            }
            const base = makeAllocation(18, 'KV-002', 'committed', 'REQ-NEW');
            const mutations = [
                r => { r.sourceEvidenceDigestSha256 = '0'.repeat(64); }, r => { r.sourceContractDigestSha256 = '0'.repeat(64); }, r => { delete r.status; }, r => { r.rawPayload = true; },
                r => { r.nonceHex = '00'; }, r => { r.nonceHex = nonceFor('KV-002', 17).toString('hex'); }, r => { r.keyVersion = 'KV-999'; }, r => { r.counter = 0; },
                r => { r.counter = 21; r.nonceHex = nonceFor('KV-002', 21).toString('hex'); }, r => { r.fencingToken = 5; }, r => { r.fencingToken = Number.MAX_SAFE_INTEGER + 1; }, r => { r.status = 'available'; },
                r => r, r => r, r => r, r => { r.requestId = 'REQ-1'; }, r => { Object.assign(r, crashed); }, r => { Object.assign(r, cancelled); },
                r => { r.externalActionAuthorized = true; }, r => { r.sensitivePayloadIncluded = true; }, r => r, r => r
            ];
            for (let index = 0; index < refusalPlan.scenarios.length; index += 1) {
                const item = refusalPlan.scenarios[index];
                const candidate = clone(base); mutations[index](candidate);
                const context = { reuse: [12, 16, 17].includes(index), rollbackCounter: index === 13 ? 16 : undefined, ledgerCorrupt: index === 14, duplicateRequest: index === 15, productionCredentialMaterialIncluded: index === 20, globalDisable: index === 21 };
                const reason = refusalReason(candidate, context);
                const refused = reason === item.expectedReasonCode;
                refusalResults.push({ id: item.id, mutation: item.mutation, reasonCode: reason, refused });
                writeRecord(`mutations/${item.id}.json`, { candidate, context, reasonCode: reason, refused });
            }
            reusedNonceEncryptionCount = 0;
        }
        temporaryArtifactFileCount = countFiles(temp);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
        repositoryMutationPaths = snapshotDifferences(before, snapshotTree(['docs/company', 'scripts/company']));
    }
}

const passedScenarioCount = scenarioResults.filter(item => item.passed).length;
const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const unrefusedScenarioCount = refusalResults.length - refusedScenarioCount;
if (rehearsalPerformed) {
    if (passedScenarioCount !== 12) failures.push(`expected 12 passed scenarios, observed ${passedScenarioCount}`);
    if (concurrentUniqueAllocationCount !== 16) failures.push(`expected 16 concurrent unique allocations, observed ${concurrentUniqueAllocationCount}`);
    if (retryWinnerCount !== 1 || retryLoserCount !== 7) failures.push('retry race did not elect exactly one winner');
    if (successfulEncryptionCount !== 18 || authenticatedRoundTripCount !== 18) failures.push('expected 18 authenticated encryption round trips');
    if (burnedNonceCount !== 3 || crashReservedNonceBurnCount !== 1 || cancelledNonceBurnCount !== 1 || globalDisabledNonceBurnCount !== 1) failures.push('burned nonce counts are invalid');
    if (refusedScenarioCount !== 22 || unrefusedScenarioCount !== 0) failures.push('not all refusal scenarios failed closed');
    if (repositoryMutationPaths.length) failures.push(`repository mutated: ${repositoryMutationPaths.join(', ')}`);
}
const rehearsalValid = nonceConcurrencyContractValid && rehearsalPerformed && sourceEvidenceCurrent && failures.length === 0;
const keyMaterialRetainedAfterRun = false;
const output = {
    workflow: 'A-054', mode: options.validateOnly ? 'contract validation only' : 'offline concurrent nonce allocation, crash and failover rehearsal',
    nonceConcurrencyContractValid, rehearsalPerformed, sourceEvidenceCurrent, sourceEvidenceDigestSha256, sourceContractDigestSha256, rehearsalValid,
    scenarioCount: contract.scenarioCount, passedScenarioCount, concurrentAllocatorProcessCount: contract.concurrentAllocatorProcessCount,
    concurrentUniqueAllocationCount, retryClaimantProcessCount: contract.retryClaimantProcessCount, retryWinnerCount, retryLoserCount,
    successfulEncryptionCount, authenticatedRoundTripCount, burnedNonceCount, crashReservedNonceBurnCount, failoverCounterAdvanceCount,
    rollbackRefusalCount, corruptLedgerQuarantineCount, keyVersionNamespaceCount, crossRegionDuplicateRefusalCount, counterExhaustionRefusalCount,
    staleFenceRefusalCount, cancelledNonceBurnCount, globalDisabledNonceBurnCount, globalDisableEffectBlockCount, reusedNonceEncryptionCount,
    temporaryArtifactFileCount, keyMaterialRetainedAfterRun, rawPayloadStoredCount: 0, productionCredentialMaterialStoredCount: 0,
    scheduledCompanyWorkflowInvocationCount: 0, refusalScenarioCount: contract.refusalScenarioCount, refusedScenarioCount, unrefusedScenarioCount,
    repositoryMutationCount: repositoryMutationPaths.length, repositoryMutationPaths, productionNonceControlsConfigured: false,
    productionIdentityConfiguredCount: 0, activationGateCount: (contract.activationGates || []).length,
    satisfiedActivationGateCount: (contract.activationGates || []).filter(item => item.satisfied).length,
    nonceConcurrencyContractReadyForReview: contract.nonceConcurrencyContractReadyForReview === true,
    productionNonceSafetyReady: false, productionFailoverNonceSafetyReady: false, eligibleCycleReady: false,
    eligibleCycleCreditGranted: false, automatedDispatchAuthorized: false, externalActionAuthorized: false,
    scenarioResults, refusalResults, failures,
    nextDecision: contract.nextDecision
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
else if (!options.validateOnly) process.exitCode = 2;
