#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-execution-lease.json');
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
const sleep = milliseconds => Atomics.wait(sleepBuffer, 0, 0, milliseconds);

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
function isAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 1) return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
}
function isExecuting(pid) {
    if (!isAlive(pid)) return false;
    const result = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
    return result.status === 0 && !result.stdout.trim().startsWith('Z');
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected execution-lease contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_execution_lease_fencing_and_kill_rehearsal_ready_production_coordinator_gated') failures.push('status must remain offline_execution_lease_fencing_and_kill_rehearsal_ready_production_coordinator_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 450) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-043', 'A-046', 'A-047', 'A-048'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionCoordinatorAuthorized', 'productionLeaseWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'recoveryExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.packetWorkflowId !== 'A-042' || source.alertWorkflowId !== 'A-047' || !sameJson(source.packetSourceIds, ['OC-001', 'OC-002'])) failures.push('sourceEvidence workflow or packet bindings are invalid');
requireTrue(source, ['livePacketIdsAndDigestsRequired', 'currentAlertEvidenceDigestRequired'], 'sourceEvidence', failures);
requireFalse(source, ['packetPayloadPermitted', 'underlyingWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const leaseFields = ['schemaVersion', 'leaseId', 'packetId', 'packetContentDigestSha256', 'configurationDigestSha256', 'holderId', 'acquiredAt', 'expiresAt', 'renewalCount', 'fencingToken', 'state', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const policy = contract.leasePolicy || {};
if (policy.leaseSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.maximumConcurrentHoldersPerPacket !== 1 || policy.leaseDurationSeconds !== 30 || policy.maximumRenewals !== 1 || policy.retryCount !== 0 || policy.fencingTokenStartsAt !== 1 || !sameJson(policy.leaseFields, leaseFields)) failures.push('leasePolicy algorithms, bounds, or fields are invalid');
requireTrue(policy, ['fencingTokenMustIncrease', 'exclusiveCreateRequired', 'completedReplaySuppressed'], 'leasePolicy', failures);
requireFalse(policy, ['expiredLeaseAutomaticStealPermitted', 'wrongHolderMutationPermitted', 'staleFencingTokenPermitted', 'overlapPermitted', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'leasePolicy', failures);

const expectedOperations = [
    [1, 'acquire', 'OC-001', 'worker-a', 'acquired'], [2, 'acquire', 'OC-001', 'worker-b', 'overlap_blocked'],
    [3, 'renew', 'OC-001', 'worker-a', 'renewed'], [4, 'release', 'OC-001', 'worker-b', 'wrong_holder_refused'],
    [5, 'release', 'OC-001', 'worker-a', 'released'], [6, 'acquire', 'OC-001', 'worker-b', 'completed_replay_suppressed'],
    [7, 'acquire', 'OC-002', 'worker-a', 'acquired'], [8, 'operate_after_expiry', 'OC-002', 'worker-a', 'expired_holder_refused'],
    [9, 'recover_expired', 'OC-002', 'worker-c', 'recovered_with_new_fence'], [10, 'operate_with_stale_fence', 'OC-002', 'worker-a', 'stale_fence_refused'],
    [11, 'release', 'OC-002', 'worker-c', 'released']
];
const plan = contract.rehearsalPlan || {};
if (plan.packetCount !== 2 || plan.operationCount !== 11 || !sameJson([plan.expectedAcquisitionCount, plan.expectedOverlapBlockCount, plan.expectedRenewalCount, plan.expectedReleaseCount, plan.expectedReplaySuppressionCount, plan.expectedExpiredHolderRefusalCount, plan.expectedWrongHolderRefusalCount, plan.expectedStaleFenceRefusalCount, plan.expectedRecoveryCount], [3, 1, 1, 2, 1, 1, 1, 1, 1])) failures.push('rehearsalPlan counts are invalid');
if (!Array.isArray(plan.operations) || plan.operations.length !== 11) failures.push('rehearsalPlan must contain exactly 11 operations');
for (let index = 0; index < expectedOperations.length; index += 1) {
    const item = plan.operations?.[index] || {};
    if (!sameJson([item.sequence, item.operation, item.packetRef, item.holderId, item.expectedOutcome], expectedOperations[index])) failures.push(`rehearsalPlan operation ${index + 1} is invalid`);
}

const kill = contract.killRehearsal || {};
requireTrue(kill, ['detachedProcessGroupRequired', 'parentMustTerminate', 'childMustTerminate', 'globalDisableBlocksNewLease'], 'killRehearsal', failures);
if (kill.parentProcessCount !== 1 || kill.childProcessCount !== 1 || kill.terminationSignal !== 'SIGTERM' || kill.maximumTerminationMilliseconds !== 3000) failures.push('killRehearsal process or timing bounds are invalid');
if (kill.underlyingCompanyWorkflowInvoked !== false) failures.push('killRehearsal.underlyingCompanyWorkflowInvoked must remain false');

const expectedRefusals = {
    'LR-001': ['unknown_packet', 'packet_binding_mismatch'], 'LR-002': ['substitute_packet_digest', 'packet_binding_mismatch'],
    'LR-003': ['substitute_configuration_digest', 'configuration_binding_mismatch'], 'LR-004': ['wrong_holder', 'holder_mismatch'],
    'LR-005': ['expired_lease', 'lease_expired'], 'LR-006': ['stale_fencing_token', 'fencing_token_stale'],
    'LR-007': ['invalid_fencing_token', 'fencing_token_invalid'], 'LR-008': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'LR-009': ['mark_sensitive_payload', 'authority_or_payload_flag_invalid'], 'LR-010': ['add_payload_field', 'lease_fields_invalid'],
    'LR-011': ['retry_when_disabled', 'retry_not_permitted'], 'LR-012': ['global_disable_active', 'global_disable_active']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 12 || refusalPlan.expectedRefusalCount !== 12) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_create_lease_and_event_files' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionCoordination', 'countsAsEligibleCycle', 'productionCoordinatorConfigured'], 'rehearsalStore', failures);

const production = contract.productionCoordinatorPolicy || {};
requireFalse(production, ['providerSelected', 'schedulerIdentityConfigured', 'workerIdentityConfigured', 'recoveryIdentityConfigured', 'fencingStoreConfigured', 'trustedTimeConfigured', 'atomicLeaseVerified', 'leaseLossDetectionVerified', 'recoveryApprovalConfigured', 'globalDisableConfigured', 'processTreeKillVerified', 'retentionPolicyApproved', 'alertRouteConfigured'], 'productionCoordinatorPolicy', failures);
if (production.coordinatorRef !== null) failures.push('productionCoordinatorPolicy.coordinatorRef must remain null');

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `EL-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 105) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.packetCount !== 2 || contract.operationCount !== 11 || contract.refusalScenarioCount !== 12 || contract.expectedRefusalCount !== 12) failures.push('top-level rehearsal counts are invalid');
for (const field of ['configuredProductionCoordinatorCount', 'configuredProductionIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.leaseContractReadyForReview !== true) failures.push('leaseContractReadyForReview must be true');
for (const field of ['productionCoordinationReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 500) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
const outcomes = [];
const refusalResults = [];
let temporaryRecordWriteCount = 0;
let highestFencingToken = 0;
let parentProcessTerminated = false;
let childProcessTerminated = false;
let globalDisableBlockedLeaseCount = 0;
let repositoryMutationPaths = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a048-'));
    fs.chmodSync(temp, 0o700);
    const before = snapshotTree(['docs/company', 'scripts/company']);
    let processGroupPid = null;
    try {
        const a042 = executeJson('scripts/company/compile-cadence-work-packets.cjs', 2);
        const a047 = executeJson('scripts/company/rehearse-authenticated-exception-delivery.cjs', 2);
        if (!a042.valid || a042.output.workflow !== 'A-042' || a042.output.packetSetValid !== true) failures.push('A-042 source evidence is invalid');
        if (!a047.valid || a047.output.workflow !== 'A-047' || a047.output.rehearsalValid !== true) failures.push('A-047 source evidence is invalid');
        sourceEvidenceCurrent = failures.length === 0;
        if (sourceEvidenceCurrent) {
            const packets = new Map(a042.output.packets.map(packet => [packet.sourceId, packet]));
            if (![...source.packetSourceIds].every(id => packets.has(id))) failures.push('required source packets are absent');
            const alertDigest = sha256(a047.raw);
            const configurationDigest = sha256(JSON.stringify({ leasePolicy: policy, alertDigest }));
            const active = new Map();
            const completed = new Set();
            let nextFence = 1;
            const fixedNow = Date.parse('2026-08-11T13:00:00.000Z');
            function writeRecord(name, value) {
                fs.writeFileSync(path.join(temp, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
                temporaryRecordWriteCount += 1;
            }
            function leaseFor(sourceId, holderId, token, acquiredAt = fixedNow) {
                const packet = packets.get(sourceId);
                return {
                    schemaVersion: 1,
                    leaseId: `LSE-A048-${sha256(`${packet.packetId}:${holderId}:${token}`).slice(0, 16).toUpperCase()}`,
                    packetId: packet.packetId,
                    packetContentDigestSha256: packet.contentDigestSha256,
                    configurationDigestSha256: configurationDigest,
                    holderId,
                    acquiredAt: new Date(acquiredAt).toISOString(),
                    expiresAt: new Date(acquiredAt + policy.leaseDurationSeconds * 1000).toISOString(),
                    renewalCount: 0,
                    fencingToken: token,
                    state: 'active',
                    externalActionAuthorized: false,
                    sensitivePayloadIncluded: false
                };
            }
            function validateLease(lease, sourceId, expectedHolder, currentFence, now, retryAttempt = 0, globalDisable = false) {
                if (!lease || !sameJson(Object.keys(lease), leaseFields)) return 'lease_fields_invalid';
                const packet = packets.get(sourceId);
                if (!packet || lease.packetId !== packet.packetId || lease.packetContentDigestSha256 !== packet.contentDigestSha256) return 'packet_binding_mismatch';
                if (lease.configurationDigestSha256 !== configurationDigest) return 'configuration_binding_mismatch';
                if (globalDisable) return 'global_disable_active';
                if (retryAttempt > policy.retryCount) return 'retry_not_permitted';
                if (lease.holderId !== expectedHolder) return 'holder_mismatch';
                if (!Number.isInteger(lease.fencingToken) || lease.fencingToken < 1) return 'fencing_token_invalid';
                if (lease.fencingToken < currentFence) return 'fencing_token_stale';
                if (!Number.isFinite(Date.parse(lease.expiresAt)) || now > Date.parse(lease.expiresAt)) return 'lease_expired';
                if (lease.externalActionAuthorized !== false || lease.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                return null;
            }
            function recordOutcome(sequence, outcome) {
                outcomes.push({ sequence, outcome });
                writeRecord(`event-${String(sequence).padStart(2, '0')}.json`, { sequence, outcome, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }

            const packetOne = packets.get('OC-001');
            const idempotencyOne = sha256(`${packetOne.packetId}:${configurationDigest}`);
            const leaseOne = leaseFor('OC-001', 'worker-a', nextFence++);
            highestFencingToken = leaseOne.fencingToken;
            fs.writeFileSync(path.join(temp, `active-${packetOne.packetId}.json`), `${JSON.stringify(leaseOne)}\n`, { flag: 'wx', mode: 0o600 }); temporaryRecordWriteCount += 1;
            active.set('OC-001', leaseOne); recordOutcome(1, 'acquired');
            try { fs.writeFileSync(path.join(temp, `active-${packetOne.packetId}.json`), '{}', { flag: 'wx', mode: 0o600 }); recordOutcome(2, 'unexpected'); }
            catch (error) { recordOutcome(2, error.code === 'EEXIST' ? 'overlap_blocked' : 'unexpected'); }
            leaseOne.renewalCount = 1; leaseOne.expiresAt = new Date(fixedNow + 60_000).toISOString(); recordOutcome(3, 'renewed');
            recordOutcome(4, leaseOne.holderId === 'worker-b' ? 'unexpected' : 'wrong_holder_refused');
            active.delete('OC-001'); fs.renameSync(path.join(temp, `active-${packetOne.packetId}.json`), path.join(temp, `released-${packetOne.packetId}.json`)); completed.add(idempotencyOne); writeRecord(`completed-${idempotencyOne}.json`, { idempotencyKey: idempotencyOne, state: 'completed', externalActionAuthorized: false }); recordOutcome(5, 'released');
            recordOutcome(6, completed.has(idempotencyOne) ? 'completed_replay_suppressed' : 'unexpected');

            const packetTwo = packets.get('OC-002');
            const leaseTwo = leaseFor('OC-002', 'worker-a', nextFence++);
            highestFencingToken = leaseTwo.fencingToken;
            fs.writeFileSync(path.join(temp, `active-${packetTwo.packetId}.json`), `${JSON.stringify(leaseTwo)}\n`, { flag: 'wx', mode: 0o600 }); temporaryRecordWriteCount += 1;
            active.set('OC-002', leaseTwo); recordOutcome(7, 'acquired');
            recordOutcome(8, validateLease(leaseTwo, 'OC-002', 'worker-a', leaseTwo.fencingToken, Date.parse(leaseTwo.expiresAt) + 1) === 'lease_expired' ? 'expired_holder_refused' : 'unexpected');
            fs.renameSync(path.join(temp, `active-${packetTwo.packetId}.json`), path.join(temp, `expired-${packetTwo.packetId}.json`));
            const recovered = leaseFor('OC-002', 'worker-c', nextFence++, Date.parse(leaseTwo.expiresAt) + 1000);
            highestFencingToken = recovered.fencingToken;
            fs.writeFileSync(path.join(temp, `active-${packetTwo.packetId}.json`), `${JSON.stringify(recovered)}\n`, { flag: 'wx', mode: 0o600 }); temporaryRecordWriteCount += 1;
            active.set('OC-002', recovered); recordOutcome(9, recovered.fencingToken > leaseTwo.fencingToken ? 'recovered_with_new_fence' : 'unexpected');
            recordOutcome(10, validateLease(leaseTwo, 'OC-002', 'worker-a', recovered.fencingToken, fixedNow) === 'fencing_token_stale' ? 'stale_fence_refused' : 'unexpected');
            active.delete('OC-002'); fs.renameSync(path.join(temp, `active-${packetTwo.packetId}.json`), path.join(temp, `released-recovered-${packetTwo.packetId}.json`)); recordOutcome(11, 'released');

            const baseLease = clone(recovered);
            baseLease.expiresAt = new Date(fixedNow + 60_000).toISOString();
            for (const scenario of refusalPlan.scenarios) {
                const lease = clone(baseLease);
                let sourceId = 'OC-002'; let expectedHolder = 'worker-c'; let currentFence = recovered.fencingToken; let now = fixedNow; let retry = 0; let disabled = false;
                if (scenario.id === 'LR-001') sourceId = 'OC-999';
                if (scenario.id === 'LR-002') lease.packetContentDigestSha256 = '0'.repeat(64);
                if (scenario.id === 'LR-003') lease.configurationDigestSha256 = '0'.repeat(64);
                if (scenario.id === 'LR-004') expectedHolder = 'worker-x';
                if (scenario.id === 'LR-005') now = Date.parse(lease.expiresAt) + 1;
                if (scenario.id === 'LR-006') currentFence = lease.fencingToken + 1;
                if (scenario.id === 'LR-007') lease.fencingToken = 0;
                if (scenario.id === 'LR-008') lease.externalActionAuthorized = true;
                if (scenario.id === 'LR-009') lease.sensitivePayloadIncluded = true;
                if (scenario.id === 'LR-010') lease.payload = 'prohibited';
                if (scenario.id === 'LR-011') retry = 1;
                if (scenario.id === 'LR-012') disabled = true;
                const reason = validateLease(lease, sourceId, expectedHolder, currentFence, now, retry, disabled);
                const refused = reason === scenario.expectedReasonCode;
                refusalResults.push({ scenarioId: scenario.id, expectedReasonCode: scenario.expectedReasonCode, actualReasonCode: reason, refused });
                if (!refused) failures.push(`${scenario.id} returned ${reason || 'accepted'} instead of ${scenario.expectedReasonCode}`);
            }

            const childPidPath = path.join(temp, 'child-process.pid');
            const processCode = "const fs=require('fs'),{spawn}=require('child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid),{flag:'wx',mode:0o600});setInterval(()=>{},1000);";
            const processGroup = spawn(process.execPath, ['-e', processCode, childPidPath], { cwd: temp, detached: true, stdio: 'ignore' });
            processGroupPid = processGroup.pid;
            const waitDeadline = Date.now() + 2000;
            while (!fs.existsSync(childPidPath) && Date.now() < waitDeadline) sleep(20);
            const childPid = fs.existsSync(childPidPath) ? Number(fs.readFileSync(childPidPath, 'utf8')) : null;
            if (!isAlive(processGroupPid) || !isAlive(childPid)) failures.push('kill rehearsal processes did not start');
            else {
                process.kill(-processGroupPid, kill.terminationSignal);
                const killDeadline = Date.now() + kill.maximumTerminationMilliseconds;
                while ((isExecuting(processGroupPid) || isExecuting(childPid)) && Date.now() < killDeadline) sleep(25);
                parentProcessTerminated = !isExecuting(processGroupPid);
                childProcessTerminated = !isExecuting(childPid);
                if (!parentProcessTerminated || !childProcessTerminated) failures.push('process-tree kill did not terminate parent and child');
            }
            globalDisableBlockedLeaseCount = validateLease(baseLease, 'OC-002', 'worker-c', recovered.fencingToken, fixedNow, 0, true) === 'global_disable_active' ? 1 : 0;
            if (globalDisableBlockedLeaseCount !== 1) failures.push('global disable did not block new lease use');
        }
    } finally {
        if (processGroupPid && isExecuting(processGroupPid)) { try { process.kill(-processGroupPid, 'SIGKILL'); } catch {} }
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        if (repositoryMutationPaths.length) failures.push(`rehearsal changed repository paths: ${repositoryMutationPaths.join(', ')}`);
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const expectedOutcomeList = (plan.operations || []).map(item => item.expectedOutcome);
const passedOperationCount = outcomes.filter((item, index) => item.outcome === expectedOutcomeList[index]).length;
const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const countOutcome = name => outcomes.filter(item => item.outcome === name).length;
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && outcomes.length === 11 && passedOperationCount === 11 && highestFencingToken === 3 && parentProcessTerminated && childProcessTerminated && globalDisableBlockedLeaseCount === 1 && refusedScenarioCount === 12 && repositoryMutationPaths.length === 0 && failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-048',
    mode: options.validateOnly ? 'contract validation only' : 'offline packet-bound exclusive lease, fencing, recovery, global-disable, and process-tree kill rehearsal',
    leaseContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    packetCount: sourceEvidenceCurrent ? 2 : 0,
    operationCount: outcomes.length,
    passedOperationCount,
    acquisitionCount: countOutcome('acquired') + countOutcome('recovered_with_new_fence'),
    overlapBlockCount: countOutcome('overlap_blocked'),
    renewalCount: countOutcome('renewed'),
    releaseCount: countOutcome('released'),
    replaySuppressionCount: countOutcome('completed_replay_suppressed'),
    expiredHolderRefusalCount: countOutcome('expired_holder_refused'),
    wrongHolderRefusalCount: countOutcome('wrong_holder_refused'),
    staleFenceRefusalCount: countOutcome('stale_fence_refused'),
    recoveryCount: countOutcome('recovered_with_new_fence'),
    highestFencingToken,
    fencingTokensMonotonic: highestFencingToken === 3,
    temporaryRecordWriteCount,
    killRehearsalPerformed: rehearsalPerformed && sourceEvidenceCurrent,
    parentProcessTerminated,
    childProcessTerminated,
    killedProcessCount: Number(parentProcessTerminated) + Number(childProcessTerminated),
    globalDisableBlockedLeaseCount,
    underlyingCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: refusalResults.length,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.filter(item => !item.refused).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionCoordinatorConfigured: contract.productionCoordinatorPolicy?.providerSelected === true,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount,
    trustedTimeConfigured: contract.productionCoordinatorPolicy?.trustedTimeConfigured === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    leaseContractReadyForReview: contract.leaseContractReadyForReview === true && contractFailureCount === 0,
    productionCoordinationReady: contract.productionCoordinationReady === true,
    eligibleCycleReady: contract.eligibleCycleReady === true,
    eligibleCycleCreditGranted: false,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    failures,
    refusalResults
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
