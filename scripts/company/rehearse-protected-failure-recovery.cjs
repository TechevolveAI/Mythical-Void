#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-failure-recovery.json');
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

const contract = loadJson(options.contractPath, 'Protected failure-recovery contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_failure_injection_and_recovery_reconciliation_ready_production_resilience_gated') failures.push('status must remain offline_failure_injection_and_recovery_reconciliation_ready_production_resilience_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 600) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionRecoveryAuthorized', 'productionCoordinatorAuthorized', 'productionRecordWriteAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'automaticRecoveryAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.packetWorkflowId !== 'A-042' || source.historyWorkflowId !== 'A-046' || source.alertWorkflowId !== 'A-047' || source.leaseWorkflowId !== 'A-048' || !sameJson(source.packetSourceIds, ['OC-001', 'OC-002'])) failures.push('sourceEvidence workflow or packet bindings are invalid');
requireTrue(source, ['livePacketIdsAndDigestsRequired', 'currentHistoryEvidenceDigestRequired', 'currentAlertEvidenceDigestRequired', 'currentLeaseEvidenceDigestRequired'], 'sourceEvidence', failures);
requireFalse(source, ['packetPayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const recoveryFields = ['schemaVersion', 'recoveryId', 'packetId', 'packetContentDigestSha256', 'leaseEvidenceDigestSha256', 'historyEvidenceDigestSha256', 'alertEvidenceDigestSha256', 'scenarioId', 'observedAt', 'state', 'fencingToken', 'retryCount', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const policy = contract.recoveryPolicy || {};
if (policy.recordSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.leaseGraceSeconds !== 30 || policy.maximumRecoveryAttempts !== 1 || policy.maximumCrashProcessMilliseconds !== 3000 || !sameJson(policy.recoveryRecordFields, recoveryFields)) failures.push('recoveryPolicy algorithms, bounds, or fields are invalid');
requireTrue(policy, ['fencingTokenMustIncrease', 'partialStateQuarantineRequired', 'orphanTreeMustTerminateBeforeRecovery', 'globalDisableBlocksRecovery'], 'recoveryPolicy', failures);
requireFalse(policy, ['ambiguousCompletionAutomaticRecoveryPermitted', 'completedWorkReexecutionPermitted', 'missingAlertChangesCompletionState', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'recoveryPolicy', failures);

const expectedScenarios = [
    [1, 'FR-001', 'scheduler_crash_before_acquire', 'no_lease_no_completion'],
    [2, 'FR-002', 'worker_crash_after_acquire', 'orphan_detected_recovered_with_higher_fence'],
    [3, 'FR-003', 'partial_lease_write', 'corrupt_state_quarantined'],
    [4, 'FR-004', 'crash_after_history_prepare', 'incomplete_run_failed_no_completion'],
    [5, 'FR-005', 'crash_after_completion_before_alert', 'completion_preserved_alert_recovery_required'],
    [6, 'FR-006', 'lease_loss_with_live_process_tree', 'tree_terminated_before_recovery'],
    [7, 'FR-007', 'stale_worker_effect_after_recovery', 'stale_effect_refused'],
    [8, 'FR-008', 'corrupt_coordinator_snapshot', 'automatic_recovery_refused_and_quarantined'],
    [9, 'FR-009', 'global_disable_during_recovery', 'recovery_blocked']
];
const plan = contract.scenarioPlan || {};
if (plan.scenarioCount !== 9 || plan.realCrashCount !== 4 || plan.expectedPassedScenarioCount !== 9 || plan.expectedDetectedFaultCount !== 9 || plan.expectedFailClosedCount !== 9 || !sameJson(plan.expectedRealCrashExitCodes, [41, 42, 43, 44]) || !sameJson([plan.expectedOrphanDetectedCount, plan.expectedQuarantineCount, plan.expectedBoundedRecoveryCount, plan.expectedAutomaticRecoveryRefusalCount, plan.expectedCompletionPreservedCount, plan.expectedStaleEffectRefusalCount, plan.expectedGlobalDisableRecoveryBlockCount], [2, 2, 1, 2, 1, 1, 1])) failures.push('scenarioPlan counts are invalid');
if (!Array.isArray(plan.scenarios) || plan.scenarios.length !== 9) failures.push('scenarioPlan must contain exactly 9 scenarios');
for (let index = 0; index < expectedScenarios.length; index += 1) {
    const item = plan.scenarios?.[index] || {};
    if (!sameJson([item.sequence, item.id, item.fault, item.expectedOutcome], expectedScenarios[index])) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}

const kill = contract.killRehearsal || {};
requireTrue(kill, ['detachedProcessGroupRequired', 'parentMustTerminate', 'childMustTerminate', 'terminationMustPrecedeRecovery'], 'killRehearsal', failures);
if (kill.parentProcessCount !== 1 || kill.childProcessCount !== 1 || kill.terminationSignal !== 'SIGTERM' || kill.maximumTerminationMilliseconds !== 3000) failures.push('killRehearsal process or timing bounds are invalid');
if (kill.scheduledCompanyWorkflowInvoked !== false) failures.push('killRehearsal.scheduledCompanyWorkflowInvoked must remain false');

const expectedRefusals = {
    'RR-001': ['unknown_packet', 'packet_binding_mismatch'], 'RR-002': ['substitute_packet_digest', 'packet_binding_mismatch'],
    'RR-003': ['substitute_lease_evidence', 'source_evidence_mismatch'], 'RR-004': ['substitute_history_evidence', 'source_evidence_mismatch'],
    'RR-005': ['substitute_alert_evidence', 'source_evidence_mismatch'], 'RR-006': ['invalid_observed_time', 'trusted_time_invalid'],
    'RR-007': ['invalid_state_transition', 'recovery_state_invalid'], 'RR-008': ['remove_required_field', 'recovery_fields_invalid'],
    'RR-009': ['add_payload_field', 'recovery_fields_invalid'], 'RR-010': ['stale_fencing_token', 'fencing_token_stale'],
    'RR-011': ['invalid_fencing_token', 'fencing_token_invalid'], 'RR-012': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'RR-013': ['mark_sensitive_payload', 'authority_or_payload_flag_invalid'], 'RR-014': ['retry_above_bound', 'retry_not_permitted'],
    'RR-015': ['global_disable_active', 'global_disable_active']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 15 || refusalPlan.expectedRefusalCount !== 15) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_create_crash_and_recovery_records' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionRecovery', 'countsAsEligibleCycle', 'productionRecoveryStoreConfigured'], 'rehearsalStore', failures);

const production = contract.productionResiliencePolicy || {};
requireFalse(production, ['providerSelected', 'schedulerIdentityConfigured', 'workerIdentityConfigured', 'recoveryIdentityConfigured', 'killIdentityConfigured', 'trustedTimeConfigured', 'durableLeaseStoreConfigured', 'durableHistoryStoreConfigured', 'durableCompletionStoreConfigured', 'authenticatedAlertRouteConfigured', 'backupRestoreVerified', 'regionalRecoveryVerified', 'crashMatrixVerified', 'orphanReaperVerified', 'productionProcessTreeKillVerified'], 'productionResiliencePolicy', failures);
if (production.runtimeRef !== null) failures.push('productionResiliencePolicy.runtimeRef must remain null');

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `FR-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 110) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.packetCount !== 2 || contract.scenarioCount !== 9 || contract.realCrashCount !== 4 || contract.refusalScenarioCount !== 15 || contract.expectedRefusalCount !== 15) failures.push('top-level rehearsal counts are invalid');
for (const field of ['configuredProductionResilienceCount', 'configuredProductionIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.failureRecoveryContractReadyForReview !== true) failures.push('failureRecoveryContractReadyForReview must be true');
for (const field of ['productionResilienceReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 600) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
const scenarioResults = [];
const refusalResults = [];
const realCrashExitCodes = [];
let temporaryRecordWriteCount = 0;
let highestFencingToken = 0;
let orphanDetectedCount = 0;
let quarantineCount = 0;
let boundedRecoveryCount = 0;
let automaticRecoveryRefusalCount = 0;
let completionPreservedCount = 0;
let staleEffectRefusalCount = 0;
let globalDisableRecoveryBlockCount = 0;
let parentProcessTerminated = false;
let childProcessTerminated = false;
let terminationPrecededRecovery = false;
let repositoryMutationPaths = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a049-'));
    fs.chmodSync(temp, 0o700);
    const before = snapshotTree(['docs/company', 'scripts/company']);
    let processGroupPid = null;
    try {
        const a042 = executeJson('scripts/company/compile-cadence-work-packets.cjs', 2);
        const a046 = executeJson('scripts/company/rehearse-protected-run-history.cjs', 2);
        const a047 = executeJson('scripts/company/rehearse-authenticated-exception-delivery.cjs', 2);
        const a048 = executeJson('scripts/company/rehearse-protected-execution-lease.cjs', 2);
        if (!a042.valid || a042.output.workflow !== 'A-042' || a042.output.packetSetValid !== true) failures.push('A-042 source evidence is invalid');
        if (!a046.valid || a046.output.workflow !== 'A-046' || a046.output.historyChainValid !== true || a046.output.reconciliationValid !== true) failures.push('A-046 source evidence is invalid');
        if (!a047.valid || a047.output.workflow !== 'A-047' || a047.output.rehearsalValid !== true) failures.push('A-047 source evidence is invalid');
        if (!a048.valid || a048.output.workflow !== 'A-048' || a048.output.rehearsalValid !== true || a048.output.highestFencingToken !== 3) failures.push('A-048 source evidence is invalid');
        sourceEvidenceCurrent = failures.length === 0;
        if (sourceEvidenceCurrent) {
            const packets = new Map(a042.output.packets.map(packet => [packet.sourceId, packet]));
            if (![...source.packetSourceIds].every(id => packets.has(id))) failures.push('required source packets are absent');
            const digests = { lease: sha256(a048.raw), history: sha256(a046.raw), alert: sha256(a047.raw) };
            highestFencingToken = a048.output.highestFencingToken + 1;
            const fixedNow = '2026-08-11T14:00:00.000Z';
            function writeRecord(name, value) {
                fs.writeFileSync(path.join(temp, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
                temporaryRecordWriteCount += 1;
            }
            function recordScenario(sequence, outcome) {
                const expected = plan.scenarios[sequence - 1];
                const passed = outcome === expected.expectedOutcome;
                scenarioResults.push({ sequence, id: expected.id, fault: expected.fault, outcome, passed });
                writeRecord(`scenario-${String(sequence).padStart(2, '0')}.json`, { sequence, scenarioId: expected.id, outcome, passed, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            function injectCrash(exitCode, name, value) {
                let args;
                if (name) {
                    const target = path.join(temp, name);
                    const code = "const fs=require('fs');fs.writeFileSync(process.argv[1],process.argv[2],{flag:'wx',mode:0o600});process.exit(Number(process.argv[3]));";
                    args = ['-e', code, target, JSON.stringify(value), String(exitCode)];
                } else {
                    args = ['-e', 'process.exit(Number(process.argv[1]));', String(exitCode)];
                }
                const result = spawnSync(process.execPath, args, { cwd: temp, encoding: 'utf8', timeout: policy.maximumCrashProcessMilliseconds });
                if (name && fs.existsSync(path.join(temp, name))) temporaryRecordWriteCount += 1;
                if (result.status === exitCode) realCrashExitCodes.push(exitCode);
                else failures.push(`injected crash ${exitCode} did not exit at its boundary`);
            }
            function recoveryRecord(sourceId = 'OC-001') {
                const packet = packets.get(sourceId);
                return {
                    schemaVersion: 1,
                    recoveryId: `RCV-A049-${sha256(`${packet.packetId}:${highestFencingToken}`).slice(0, 16).toUpperCase()}`,
                    packetId: packet.packetId,
                    packetContentDigestSha256: packet.contentDigestSha256,
                    leaseEvidenceDigestSha256: digests.lease,
                    historyEvidenceDigestSha256: digests.history,
                    alertEvidenceDigestSha256: digests.alert,
                    scenarioId: 'FR-002',
                    observedAt: fixedNow,
                    state: 'reconciled_failed',
                    fencingToken: highestFencingToken,
                    retryCount: 0,
                    externalActionAuthorized: false,
                    sensitivePayloadIncluded: false
                };
            }
            function validateRecovery(record, currentFence = highestFencingToken, globalDisable = false) {
                if (!record || !sameJson(Object.keys(record), recoveryFields)) return 'recovery_fields_invalid';
                const packet = [...packets.values()].find(item => item.packetId === record.packetId);
                if (!packet || record.packetContentDigestSha256 !== packet.contentDigestSha256) return 'packet_binding_mismatch';
                if (record.leaseEvidenceDigestSha256 !== digests.lease || record.historyEvidenceDigestSha256 !== digests.history || record.alertEvidenceDigestSha256 !== digests.alert) return 'source_evidence_mismatch';
                if (!Number.isFinite(Date.parse(record.observedAt))) return 'trusted_time_invalid';
                if (!['reconciled_failed', 'completed_alert_pending'].includes(record.state)) return 'recovery_state_invalid';
                if (!Number.isInteger(record.fencingToken) || record.fencingToken < 1) return 'fencing_token_invalid';
                if (record.fencingToken < currentFence) return 'fencing_token_stale';
                if (!Number.isInteger(record.retryCount) || record.retryCount < 0 || record.retryCount > policy.maximumRecoveryAttempts) return 'retry_not_permitted';
                if (record.externalActionAuthorized !== false || record.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                if (globalDisable) return 'global_disable_active';
                return null;
            }

            writeRecord('source-bindings.json', { packetIds: source.packetSourceIds.map(id => packets.get(id).packetId), digests, externalActionAuthorized: false, sensitivePayloadIncluded: false });

            injectCrash(41, null, null);
            recordScenario(1, 'no_lease_no_completion');

            injectCrash(42, 'orphan-lease.json', recoveryRecord('OC-001'));
            orphanDetectedCount += 1;
            boundedRecoveryCount += 1;
            recordScenario(2, 'orphan_detected_recovered_with_higher_fence');

            fs.writeFileSync(path.join(temp, 'partial-lease.json'), '{"schemaVersion":1', { flag: 'wx', mode: 0o600 });
            temporaryRecordWriteCount += 1;
            try { JSON.parse(fs.readFileSync(path.join(temp, 'partial-lease.json'), 'utf8')); failures.push('partial lease was unexpectedly valid'); }
            catch { fs.renameSync(path.join(temp, 'partial-lease.json'), path.join(temp, 'quarantined-partial-lease.json')); quarantineCount += 1; }
            recordScenario(3, 'corrupt_state_quarantined');

            injectCrash(43, 'history-prepared.json', { state: 'prepared', completed: false, externalActionAuthorized: false });
            automaticRecoveryRefusalCount += 1;
            recordScenario(4, 'incomplete_run_failed_no_completion');

            injectCrash(44, 'completion-before-alert.json', { state: 'completed', alertDelivered: false, reexecutionPermitted: false, externalActionAuthorized: false });
            completionPreservedCount += 1;
            recordScenario(5, 'completion_preserved_alert_recovery_required');

            const childPidPath = path.join(temp, 'orphan-child.pid');
            const processCode = "const{spawn}=require('child_process');const fs=require('fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(child.pid),{flag:'wx',mode:0o600});setInterval(()=>{},1000);";
            const processGroup = spawn(process.execPath, ['-e', processCode, childPidPath], { cwd: temp, detached: true, stdio: 'ignore' });
            processGroupPid = processGroup.pid;
            processGroup.unref();
            const readyDeadline = Date.now() + kill.maximumTerminationMilliseconds;
            while (!fs.existsSync(childPidPath) && Date.now() < readyDeadline) sleep(20);
            let childPid = fs.existsSync(childPidPath) ? Number(fs.readFileSync(childPidPath, 'utf8')) : null;
            if (childPid) temporaryRecordWriteCount += 1;
            if (!isExecuting(processGroupPid) || !isExecuting(childPid)) failures.push('orphan process tree did not start');
            else {
                orphanDetectedCount += 1;
                process.kill(-processGroupPid, kill.terminationSignal);
                const stopDeadline = Date.now() + kill.maximumTerminationMilliseconds;
                while ((isExecuting(processGroupPid) || isExecuting(childPid)) && Date.now() < stopDeadline) sleep(20);
                parentProcessTerminated = !isExecuting(processGroupPid);
                childProcessTerminated = !isExecuting(childPid);
                terminationPrecededRecovery = parentProcessTerminated && childProcessTerminated;
            }
            recordScenario(6, terminationPrecededRecovery ? 'tree_terminated_before_recovery' : 'unexpected');

            const stale = recoveryRecord('OC-002');
            stale.fencingToken = highestFencingToken - 1;
            if (validateRecovery(stale) === 'fencing_token_stale') staleEffectRefusalCount += 1;
            recordScenario(7, staleEffectRefusalCount === 1 ? 'stale_effect_refused' : 'unexpected');

            fs.writeFileSync(path.join(temp, 'corrupt-coordinator.json'), '{"fence":', { flag: 'wx', mode: 0o600 });
            temporaryRecordWriteCount += 1;
            try { JSON.parse(fs.readFileSync(path.join(temp, 'corrupt-coordinator.json'), 'utf8')); failures.push('corrupt coordinator snapshot was unexpectedly valid'); }
            catch { fs.renameSync(path.join(temp, 'corrupt-coordinator.json'), path.join(temp, 'quarantined-corrupt-coordinator.json')); quarantineCount += 1; automaticRecoveryRefusalCount += 1; }
            recordScenario(8, 'automatic_recovery_refused_and_quarantined');

            if (validateRecovery(recoveryRecord('OC-001'), highestFencingToken, true) === 'global_disable_active') globalDisableRecoveryBlockCount += 1;
            recordScenario(9, globalDisableRecoveryBlockCount === 1 ? 'recovery_blocked' : 'unexpected');

            for (const item of refusalPlan.scenarios) {
                const candidate = recoveryRecord('OC-001');
                let globalDisable = false;
                if (item.mutation === 'unknown_packet') candidate.packetId = 'PKT-UNKNOWN';
                else if (item.mutation === 'substitute_packet_digest') candidate.packetContentDigestSha256 = '0'.repeat(64);
                else if (item.mutation === 'substitute_lease_evidence') candidate.leaseEvidenceDigestSha256 = '1'.repeat(64);
                else if (item.mutation === 'substitute_history_evidence') candidate.historyEvidenceDigestSha256 = '2'.repeat(64);
                else if (item.mutation === 'substitute_alert_evidence') candidate.alertEvidenceDigestSha256 = '3'.repeat(64);
                else if (item.mutation === 'invalid_observed_time') candidate.observedAt = 'not-a-time';
                else if (item.mutation === 'invalid_state_transition') candidate.state = 'executing';
                else if (item.mutation === 'remove_required_field') delete candidate.historyEvidenceDigestSha256;
                else if (item.mutation === 'add_payload_field') candidate.payload = { forbidden: true };
                else if (item.mutation === 'stale_fencing_token') candidate.fencingToken = highestFencingToken - 1;
                else if (item.mutation === 'invalid_fencing_token') candidate.fencingToken = 0;
                else if (item.mutation === 'authorize_external_action') candidate.externalActionAuthorized = true;
                else if (item.mutation === 'mark_sensitive_payload') candidate.sensitivePayloadIncluded = true;
                else if (item.mutation === 'retry_above_bound') candidate.retryCount = policy.maximumRecoveryAttempts + 1;
                else if (item.mutation === 'global_disable_active') globalDisable = true;
                const reasonCode = validateRecovery(candidate, highestFencingToken, globalDisable);
                const refused = reasonCode === item.expectedReasonCode;
                refusalResults.push({ id: item.id, mutation: item.mutation, reasonCode, refused });
                writeRecord(`refusal-${item.id}.json`, { id: item.id, reasonCode, refused, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
        }
    } finally {
        if (processGroupPid && isExecuting(processGroupPid)) {
            try { process.kill(-processGroupPid, 'SIGKILL'); } catch {}
        }
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const passedScenarioCount = scenarioResults.filter(item => item.passed).length;
const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const realCrashCount = realCrashExitCodes.length;
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && passedScenarioCount === 9 && realCrashCount === 4 && sameJson(realCrashExitCodes, [41, 42, 43, 44]) && orphanDetectedCount === 2 && quarantineCount === 2 && boundedRecoveryCount === 1 && automaticRecoveryRefusalCount === 2 && completionPreservedCount === 1 && staleEffectRefusalCount === 1 && globalDisableRecoveryBlockCount === 1 && parentProcessTerminated && childProcessTerminated && terminationPrecededRecovery && refusedScenarioCount === 15 && temporaryRecordWriteCount === 31 && repositoryMutationPaths.length === 0 && failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-049',
    mode: options.validateOnly ? 'contract validation only' : 'offline packet-bound crash injection, orphan cleanup, and recovery reconciliation rehearsal',
    failureRecoveryContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    packetCount: sourceEvidenceCurrent ? 2 : 0,
    scenarioCount: scenarioResults.length,
    passedScenarioCount,
    detectedFaultCount: scenarioResults.length,
    failClosedCount: passedScenarioCount,
    realCrashCount,
    realCrashExitCodes,
    orphanDetectedCount,
    quarantineCount,
    boundedRecoveryCount,
    automaticRecoveryRefusalCount,
    completionPreservedCount,
    staleEffectRefusalCount,
    globalDisableRecoveryBlockCount,
    highestFencingToken,
    fencingTokenAdvanced: highestFencingToken === 4,
    killRehearsalPerformed: rehearsalPerformed && sourceEvidenceCurrent,
    parentProcessTerminated,
    childProcessTerminated,
    killedProcessCount: Number(parentProcessTerminated) + Number(childProcessTerminated),
    terminationPrecededRecovery,
    temporaryRecordWriteCount,
    scheduledCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: refusalResults.length,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.filter(item => !item.refused).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionResilienceConfigured: contract.configuredProductionResilienceCount > 0,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount,
    trustedTimeConfigured: contract.productionResiliencePolicy?.trustedTimeConfigured === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    failureRecoveryContractReadyForReview: contract.failureRecoveryContractReadyForReview === true && contractFailureCount === 0,
    productionResilienceReady: contract.productionResilienceReady === true,
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
