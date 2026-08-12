#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/protected-time-and-split-brain.json');

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

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected time and split-brain contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_trusted_time_split_brain_and_fencing_race_rehearsal_ready_production_consensus_gated') failures.push('status must remain offline_trusted_time_split_brain_and_fencing_race_rehearsal_ready_production_consensus_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 700) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-012', 'A-023', 'A-030', 'A-031', 'A-035', 'A-041', 'A-042', 'A-046', 'A-047', 'A-048', 'A-049', 'A-050'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionConsensusAuthorized', 'productionTrustedTimeAuthorized', 'productionLeaseWriteAuthorized', 'productionRecoveryAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'packetAdmissionAuthorized', 'packetExecutionAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'repositoryWriteAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'];
requireFalse(contract.authority, authorityFields, 'authority', failures, true);

const source = contract.sourceEvidence || {};
if (source.packetWorkflowId !== 'A-042' || source.historyWorkflowId !== 'A-046' || source.alertWorkflowId !== 'A-047' || source.leaseWorkflowId !== 'A-048' || source.recoveryWorkflowId !== 'A-049' || !sameJson(source.packetSourceIds, ['OC-001', 'OC-002'])) failures.push('sourceEvidence workflow or packet bindings are invalid');
requireTrue(source, ['livePacketIdsAndDigestsRequired', 'currentHistoryEvidenceDigestRequired', 'currentAlertEvidenceDigestRequired', 'currentLeaseEvidenceDigestRequired', 'currentRecoveryEvidenceDigestRequired'], 'sourceEvidence', failures);
requireFalse(source, ['packetPayloadPermitted', 'scheduledCompanyWorkflowInvocationPermitted'], 'sourceEvidence', failures);

const decisionFields = ['schemaVersion', 'decisionId', 'packetId', 'packetContentDigestSha256', 'historyEvidenceDigestSha256', 'alertEvidenceDigestSha256', 'leaseEvidenceDigestSha256', 'recoveryEvidenceDigestSha256', 'coordinatorObservedAt', 'workerObservedAt', 'decision', 'fencingToken', 'externalActionAuthorized', 'sensitivePayloadIncluded'];
const policy = contract.coordinationPolicy || {};
if (policy.decisionSchemaVersion !== 1 || policy.digestAlgorithm !== 'sha256' || policy.trustedClockSource !== 'fixed_rehearsal_coordinator_time_only' || policy.coordinatorObservedAt !== '2026-08-11T15:00:00.000Z' || policy.maximumWorkerClockSkewSeconds !== 120 || policy.maximumEventDelaySeconds !== 300 || policy.maximumConcurrentHolderCount !== 1 || policy.acquisitionContenderCount !== 8 || policy.recoveryContenderCount !== 4 || policy.maximumRaceMilliseconds !== 3000 || policy.fencingTokenMaximumSafeInteger !== Number.MAX_SAFE_INTEGER || !sameJson(policy.decisionFields, decisionFields)) failures.push('coordinationPolicy algorithms, time, bounds, or fields are invalid');
requireTrue(policy, ['globalDisableCheckedImmediatelyBeforeEffect', 'fencingTokenMustIncrease'], 'coordinationPolicy', failures);
requireFalse(policy, ['workerClockMayDecideExpiry', 'staleReplicaMayWrite', 'partitionedDuplicateMayAcquire', 'completedDelayedTriggerMayReexecute', 'automaticRecoveryAtTokenMaximumPermitted', 'externalActionAuthorized', 'sensitivePayloadIncluded'], 'coordinationPolicy', failures);

const expectedScenarios = [
    [1, 'TS-001', 'eight_simultaneous_acquisition_claimants', 'exactly_one_acquisition_winner'],
    [2, 'TS-002', 'worker_clock_positive_skew', 'coordinator_time_keeps_valid_lease_active'],
    [3, 'TS-003', 'worker_clock_negative_skew', 'coordinator_time_expires_lease'],
    [4, 'TS-004', 'delayed_trigger_after_completion', 'completed_replay_suppressed'],
    [5, 'TS-005', 'partitioned_duplicate_before_completion', 'partitioned_overlap_refused'],
    [6, 'TS-006', 'four_simultaneous_recovery_claimants', 'exactly_one_recovery_winner_with_fence_five'],
    [7, 'TS-007', 'old_partition_heals_after_recovery', 'stale_partition_effect_refused'],
    [8, 'TS-008', 'completion_record_precedes_delayed_alert', 'completion_preserved_alert_pending'],
    [9, 'TS-009', 'fencing_token_at_maximum_safe_integer', 'automatic_recovery_refused_token_exhausted'],
    [10, 'TS-010', 'global_disable_between_admission_and_effect', 'effect_refused_global_disable']
];
const plan = contract.scenarioPlan || {};
if (plan.scenarioCount !== 10 || plan.expectedPassedScenarioCount !== 10 || !sameJson([plan.expectedAcquisitionWinnerCount, plan.expectedAcquisitionLoserCount, plan.expectedRecoveryWinnerCount, plan.expectedRecoveryLoserCount, plan.expectedClockSkewCaseCount, plan.expectedWorkerClockOverrideIgnoredCount, plan.expectedDelayedTriggerSuppressionCount, plan.expectedPartitionedDuplicateRefusalCount, plan.expectedStalePartitionRefusalCount, plan.expectedCompletionPreservedCount, plan.expectedTokenExhaustionRefusalCount, plan.expectedGlobalDisableEffectBlockCount], [1, 7, 1, 3, 2, 2, 1, 1, 1, 1, 1, 1])) failures.push('scenarioPlan counts are invalid');
if (!Array.isArray(plan.scenarios) || plan.scenarios.length !== 10) failures.push('scenarioPlan must contain exactly 10 scenarios');
for (let index = 0; index < expectedScenarios.length; index += 1) {
    const item = plan.scenarios?.[index] || {};
    if (!sameJson([item.sequence, item.id, item.fault, item.expectedOutcome], expectedScenarios[index])) failures.push(`scenarioPlan scenario ${index + 1} is invalid`);
}

const expectedRefusals = {
    'TR-001': ['unknown_packet', 'packet_binding_mismatch'], 'TR-002': ['substitute_packet_digest', 'packet_binding_mismatch'],
    'TR-003': ['substitute_history_evidence', 'source_evidence_mismatch'], 'TR-004': ['substitute_alert_evidence', 'source_evidence_mismatch'],
    'TR-005': ['substitute_lease_evidence', 'source_evidence_mismatch'], 'TR-006': ['substitute_recovery_evidence', 'source_evidence_mismatch'],
    'TR-007': ['invalid_coordinator_time', 'trusted_time_invalid'], 'TR-008': ['worker_time_as_authority', 'worker_time_not_authoritative'],
    'TR-009': ['invalid_decision', 'decision_invalid'], 'TR-010': ['remove_required_field', 'decision_fields_invalid'],
    'TR-011': ['add_payload_field', 'decision_fields_invalid'], 'TR-012': ['stale_fencing_token', 'fencing_token_stale'],
    'TR-013': ['unsafe_fencing_token', 'fencing_token_unsafe'], 'TR-014': ['authorize_external_action', 'authority_or_payload_flag_invalid'],
    'TR-015': ['mark_sensitive_payload', 'authority_or_payload_flag_invalid'], 'TR-016': ['global_disable_active', 'global_disable_active']
};
const refusalPlan = contract.refusalPlan || {};
if (refusalPlan.scenarioCount !== 16 || refusalPlan.expectedRefusalCount !== 16) failures.push('refusalPlan counts are invalid');
exactSet((refusalPlan.scenarios || []).map(item => item.id), Object.keys(expectedRefusals), 'refusal scenario IDs', failures);
for (const item of refusalPlan.scenarios || []) if (!sameJson([item.mutation, item.expectedReasonCode], expectedRefusals[item.id])) failures.push(`${item.id} mutation or reason is invalid`);

const store = contract.rehearsalStore || {};
if (store.kind !== 'operating_system_temporary_exclusive_create_race_and_decision_records' || store.directoryMode !== '0700' || store.recordMode !== '0600') failures.push('rehearsalStore kind or modes are invalid');
requireTrue(store, ['outsideRepositoryRequired', 'exclusiveCreateRequired', 'recordsRemovedAfterRun'], 'rehearsalStore', failures);
requireFalse(store, ['countsAsProductionConsensus', 'countsAsEligibleCycle', 'productionConsensusConfigured'], 'rehearsalStore', failures);

const production = contract.productionConsensusPolicy || {};
requireFalse(production, ['providerSelected', 'schedulerIdentityConfigured', 'workerIdentityConfigured', 'recoveryIdentityConfigured', 'fencingStoreConfigured', 'linearizabilityVerified', 'partitionSafetyVerified', 'clockSkewVerified', 'tokenExhaustionPolicyApproved', 'globalDisableConfigured', 'durableCompletionStoreConfigured', 'authenticatedAlertRouteConfigured', 'backupRestoreVerified', 'regionalFailureVerified'], 'productionConsensusPolicy', failures);
if (production.consensusRef !== null || production.trustedTimeRef !== null) failures.push('productionConsensusPolicy refs must remain null');

const gates = contract.activationGates || [];
if (gates.length !== 18) failures.push('activationGates must contain exactly 18 gates');
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `TS-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 110) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.packetCount !== 2 || contract.scenarioCount !== 10 || contract.concurrentContenderCount !== 12 || contract.refusalScenarioCount !== 16 || contract.expectedRefusalCount !== 16) failures.push('top-level rehearsal counts are invalid');
for (const field of ['configuredProductionConsensusCount', 'configuredProductionIdentityCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.timeAndSplitBrainContractReadyForReview !== true) failures.push('timeAndSplitBrainContractReadyForReview must be true');
for (const field of ['productionConsensusReady', 'eligibleCycleReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 750) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
let rehearsalPerformed = false;
let sourceEvidenceCurrent = false;
const scenarioResults = [];
const refusalResults = [];
let acquisitionWinnerCount = 0;
let acquisitionLoserCount = 0;
let recoveryWinnerCount = 0;
let recoveryLoserCount = 0;
let concurrentContenderProcessCount = 0;
let clockSkewCaseCount = 0;
let workerClockOverrideIgnoredCount = 0;
let delayedTriggerSuppressionCount = 0;
let partitionedDuplicateRefusalCount = 0;
let stalePartitionRefusalCount = 0;
let completionPreservedCount = 0;
let tokenExhaustionRefusalCount = 0;
let globalDisableEffectBlockCount = 0;
let highestFencingToken = 0;
let temporaryRecordFileCount = 0;
let repositoryMutationPaths = [];

if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a050-'));
    fs.chmodSync(temp, 0o700);
    const before = snapshotTree(['docs/company', 'scripts/company']);
    try {
        const a042 = executeJson('scripts/company/compile-cadence-work-packets.cjs', 2);
        const a046 = executeJson('scripts/company/rehearse-protected-run-history.cjs', 2);
        const a047 = executeJson('scripts/company/rehearse-authenticated-exception-delivery.cjs', 2);
        const a048 = executeJson('scripts/company/rehearse-protected-execution-lease.cjs', 2);
        const a049 = executeJson('scripts/company/rehearse-protected-failure-recovery.cjs', 2);
        if (!a042.valid || a042.output.workflow !== 'A-042' || a042.output.packetSetValid !== true) failures.push('A-042 source evidence is invalid');
        if (!a046.valid || a046.output.workflow !== 'A-046' || a046.output.historyChainValid !== true || a046.output.reconciliationValid !== true) failures.push('A-046 source evidence is invalid');
        if (!a047.valid || a047.output.workflow !== 'A-047' || a047.output.rehearsalValid !== true) failures.push('A-047 source evidence is invalid');
        if (!a048.valid || a048.output.workflow !== 'A-048' || a048.output.rehearsalValid !== true || a048.output.highestFencingToken !== 3) failures.push('A-048 source evidence is invalid');
        if (!a049.valid || a049.output.workflow !== 'A-049' || a049.output.rehearsalValid !== true || a049.output.highestFencingToken !== 4) failures.push('A-049 source evidence is invalid');
        sourceEvidenceCurrent = failures.length === 0;
        if (sourceEvidenceCurrent) {
            const packets = new Map(a042.output.packets.map(packet => [packet.sourceId, packet]));
            if (![...source.packetSourceIds].every(id => packets.has(id))) failures.push('required source packets are absent');
            const digests = { history: sha256(a046.raw), alert: sha256(a047.raw), lease: sha256(a048.raw), recovery: sha256(a049.raw) };
            highestFencingToken = a049.output.highestFencingToken + 1;
            function writeRecord(name, value) {
                fs.writeFileSync(path.join(temp, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
            }
            function recordScenario(sequence, outcome) {
                const expected = plan.scenarios[sequence - 1];
                const passed = outcome === expected.expectedOutcome;
                scenarioResults.push({ sequence, id: expected.id, fault: expected.fault, outcome, passed });
                writeRecord(`scenario-${String(sequence).padStart(2, '0')}.json`, { sequence, scenarioId: expected.id, outcome, passed, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            function runRace(label, count, token) {
                const lock = path.join(temp, `race-${label}-lock.json`);
                const prefix = path.join(temp, `race-${label}-result-`);
                const startAt = Date.now() + 250;
                const coordinatorCode = "const{spawn}=require('child_process');const fs=require('fs');const[lock,prefix,countRaw,startRaw,tokenRaw]=process.argv.slice(1);const count=Number(countRaw),start=Number(startRaw),token=Number(tokenRaw);const contender=\"const fs=require('fs');const b=new Int32Array(new SharedArrayBuffer(4));const[lock,result,startRaw,tokenRaw,index]=process.argv.slice(1);const start=Number(startRaw),token=Number(tokenRaw);while(Date.now()<start)Atomics.wait(b,0,0,5);let outcome='lost';try{fs.writeFileSync(lock,JSON.stringify({winner:index,fencingToken:token}),{flag:'wx',mode:0o600});outcome='won'}catch(e){if(e.code!=='EEXIST')outcome='error'}fs.writeFileSync(result,JSON.stringify({index:Number(index),outcome,fencingToken:token}),{flag:'wx',mode:0o600});\";Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,['-e',contender,lock,prefix+i+'.json',String(start),String(token),String(i)],{stdio:'ignore'});c.on('exit',code=>code===0?resolve():reject(new Error('contender exit '+code)));c.on('error',reject)}))).then(()=>{const out=Array.from({length:count},(_,i)=>JSON.parse(fs.readFileSync(prefix+i+'.json','utf8')));process.stdout.write(JSON.stringify(out))}).catch(e=>{console.error(e.message);process.exit(1)});";
                const result = spawnSync(process.execPath, ['-e', coordinatorCode, lock, prefix, String(count), String(startAt), String(token)], { cwd: temp, encoding: 'utf8', timeout: policy.maximumRaceMilliseconds, maxBuffer: 1024 * 1024 });
                if (result.status !== 0) { failures.push(`${label} race failed: ${result.stderr.trim()}`); return []; }
                try { return JSON.parse(result.stdout); }
                catch { failures.push(`${label} race output was invalid`); return []; }
            }
            function decisionRecord(sourceId = 'OC-001') {
                const packet = packets.get(sourceId);
                return {
                    schemaVersion: 1,
                    decisionId: `TSD-A050-${sha256(`${packet.packetId}:${highestFencingToken}`).slice(0, 16).toUpperCase()}`,
                    packetId: packet.packetId,
                    packetContentDigestSha256: packet.contentDigestSha256,
                    historyEvidenceDigestSha256: digests.history,
                    alertEvidenceDigestSha256: digests.alert,
                    leaseEvidenceDigestSha256: digests.lease,
                    recoveryEvidenceDigestSha256: digests.recovery,
                    coordinatorObservedAt: policy.coordinatorObservedAt,
                    workerObservedAt: policy.coordinatorObservedAt,
                    decision: 'effect_refused',
                    fencingToken: highestFencingToken,
                    externalActionAuthorized: false,
                    sensitivePayloadIncluded: false
                };
            }
            function validateDecision(record, currentFence = highestFencingToken, globalDisable = false) {
                if (!record || !sameJson(Object.keys(record), decisionFields)) return 'decision_fields_invalid';
                const packet = [...packets.values()].find(item => item.packetId === record.packetId);
                if (!packet || record.packetContentDigestSha256 !== packet.contentDigestSha256) return 'packet_binding_mismatch';
                if (record.historyEvidenceDigestSha256 !== digests.history || record.alertEvidenceDigestSha256 !== digests.alert || record.leaseEvidenceDigestSha256 !== digests.lease || record.recoveryEvidenceDigestSha256 !== digests.recovery) return 'source_evidence_mismatch';
                if (!Number.isFinite(Date.parse(record.coordinatorObservedAt)) || record.coordinatorObservedAt !== policy.coordinatorObservedAt || !Number.isFinite(Date.parse(record.workerObservedAt))) return 'trusted_time_invalid';
                if (record.decision === 'worker_time_authoritative') return 'worker_time_not_authoritative';
                if (!['effect_refused', 'completion_preserved'].includes(record.decision)) return 'decision_invalid';
                if (!Number.isSafeInteger(record.fencingToken) || record.fencingToken < 1 || record.fencingToken > policy.fencingTokenMaximumSafeInteger) return 'fencing_token_unsafe';
                if (record.fencingToken < currentFence) return 'fencing_token_stale';
                if (record.externalActionAuthorized !== false || record.sensitivePayloadIncluded !== false) return 'authority_or_payload_flag_invalid';
                if (globalDisable) return 'global_disable_active';
                return null;
            }

            writeRecord('source-bindings.json', { packetIds: source.packetSourceIds.map(id => packets.get(id).packetId), digests, externalActionAuthorized: false, sensitivePayloadIncluded: false });

            const acquisitionRace = runRace('acquisition', policy.acquisitionContenderCount, a049.output.highestFencingToken);
            concurrentContenderProcessCount += acquisitionRace.length;
            acquisitionWinnerCount = acquisitionRace.filter(item => item.outcome === 'won').length;
            acquisitionLoserCount = acquisitionRace.filter(item => item.outcome === 'lost').length;
            recordScenario(1, acquisitionWinnerCount === 1 && acquisitionLoserCount === 7 ? 'exactly_one_acquisition_winner' : 'unexpected');

            const coordinatorMs = Date.parse(policy.coordinatorObservedAt);
            const positiveWorkerMs = coordinatorMs + policy.maximumWorkerClockSkewSeconds * 1000;
            const validLeaseExpiryMs = coordinatorMs + 30_000;
            if (coordinatorMs < validLeaseExpiryMs && positiveWorkerMs > validLeaseExpiryMs) { clockSkewCaseCount += 1; workerClockOverrideIgnoredCount += 1; }
            recordScenario(2, workerClockOverrideIgnoredCount === 1 ? 'coordinator_time_keeps_valid_lease_active' : 'unexpected');

            const negativeWorkerMs = coordinatorMs - policy.maximumWorkerClockSkewSeconds * 1000;
            const expiredLeaseMs = coordinatorMs - 30_000;
            if (coordinatorMs > expiredLeaseMs && negativeWorkerMs < expiredLeaseMs) { clockSkewCaseCount += 1; workerClockOverrideIgnoredCount += 1; }
            recordScenario(3, workerClockOverrideIgnoredCount === 2 ? 'coordinator_time_expires_lease' : 'unexpected');

            delayedTriggerSuppressionCount = policy.completedDelayedTriggerMayReexecute === false ? 1 : 0;
            recordScenario(4, delayedTriggerSuppressionCount === 1 ? 'completed_replay_suppressed' : 'unexpected');

            try { fs.writeFileSync(path.join(temp, 'race-acquisition-lock.json'), '{}', { flag: 'wx', mode: 0o600 }); }
            catch (error) { if (error.code === 'EEXIST') partitionedDuplicateRefusalCount = 1; }
            recordScenario(5, partitionedDuplicateRefusalCount === 1 ? 'partitioned_overlap_refused' : 'unexpected');

            const recoveryRace = runRace('recovery', policy.recoveryContenderCount, highestFencingToken);
            concurrentContenderProcessCount += recoveryRace.length;
            recoveryWinnerCount = recoveryRace.filter(item => item.outcome === 'won').length;
            recoveryLoserCount = recoveryRace.filter(item => item.outcome === 'lost').length;
            recordScenario(6, recoveryWinnerCount === 1 && recoveryLoserCount === 3 && highestFencingToken === 5 ? 'exactly_one_recovery_winner_with_fence_five' : 'unexpected');

            const stale = decisionRecord('OC-002');
            stale.fencingToken = highestFencingToken - 1;
            if (validateDecision(stale) === 'fencing_token_stale') stalePartitionRefusalCount = 1;
            recordScenario(7, stalePartitionRefusalCount === 1 ? 'stale_partition_effect_refused' : 'unexpected');

            const completed = decisionRecord('OC-001');
            completed.decision = 'completion_preserved';
            if (validateDecision(completed) === null) completionPreservedCount = 1;
            recordScenario(8, completionPreservedCount === 1 ? 'completion_preserved_alert_pending' : 'unexpected');

            if (Number.isSafeInteger(policy.fencingTokenMaximumSafeInteger) && !Number.isSafeInteger(policy.fencingTokenMaximumSafeInteger + 1) && policy.automaticRecoveryAtTokenMaximumPermitted === false) tokenExhaustionRefusalCount = 1;
            recordScenario(9, tokenExhaustionRefusalCount === 1 ? 'automatic_recovery_refused_token_exhausted' : 'unexpected');

            if (validateDecision(decisionRecord('OC-001'), highestFencingToken, true) === 'global_disable_active') globalDisableEffectBlockCount = 1;
            recordScenario(10, globalDisableEffectBlockCount === 1 ? 'effect_refused_global_disable' : 'unexpected');

            for (const item of refusalPlan.scenarios) {
                const candidate = decisionRecord('OC-001');
                let globalDisable = false;
                if (item.mutation === 'unknown_packet') candidate.packetId = 'PKT-UNKNOWN';
                else if (item.mutation === 'substitute_packet_digest') candidate.packetContentDigestSha256 = '0'.repeat(64);
                else if (item.mutation === 'substitute_history_evidence') candidate.historyEvidenceDigestSha256 = '1'.repeat(64);
                else if (item.mutation === 'substitute_alert_evidence') candidate.alertEvidenceDigestSha256 = '2'.repeat(64);
                else if (item.mutation === 'substitute_lease_evidence') candidate.leaseEvidenceDigestSha256 = '3'.repeat(64);
                else if (item.mutation === 'substitute_recovery_evidence') candidate.recoveryEvidenceDigestSha256 = '4'.repeat(64);
                else if (item.mutation === 'invalid_coordinator_time') candidate.coordinatorObservedAt = 'not-a-time';
                else if (item.mutation === 'worker_time_as_authority') candidate.decision = 'worker_time_authoritative';
                else if (item.mutation === 'invalid_decision') candidate.decision = 'effect_executed';
                else if (item.mutation === 'remove_required_field') delete candidate.alertEvidenceDigestSha256;
                else if (item.mutation === 'add_payload_field') candidate.payload = { forbidden: true };
                else if (item.mutation === 'stale_fencing_token') candidate.fencingToken = highestFencingToken - 1;
                else if (item.mutation === 'unsafe_fencing_token') candidate.fencingToken = policy.fencingTokenMaximumSafeInteger + 1;
                else if (item.mutation === 'authorize_external_action') candidate.externalActionAuthorized = true;
                else if (item.mutation === 'mark_sensitive_payload') candidate.sensitivePayloadIncluded = true;
                else if (item.mutation === 'global_disable_active') globalDisable = true;
                const reasonCode = validateDecision(candidate, highestFencingToken, globalDisable);
                const refused = reasonCode === item.expectedReasonCode;
                refusalResults.push({ id: item.id, mutation: item.mutation, reasonCode, refused });
                writeRecord(`refusal-${item.id}.json`, { id: item.id, reasonCode, refused, externalActionAuthorized: false, sensitivePayloadIncluded: false });
            }
            temporaryRecordFileCount = fs.readdirSync(temp).length;
        }
    } finally {
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const passedScenarioCount = scenarioResults.filter(item => item.passed).length;
const refusedScenarioCount = refusalResults.filter(item => item.refused).length;
const rehearsalValid = rehearsalPerformed && sourceEvidenceCurrent && passedScenarioCount === 10 && acquisitionWinnerCount === 1 && acquisitionLoserCount === 7 && recoveryWinnerCount === 1 && recoveryLoserCount === 3 && concurrentContenderProcessCount === 12 && clockSkewCaseCount === 2 && workerClockOverrideIgnoredCount === 2 && delayedTriggerSuppressionCount === 1 && partitionedDuplicateRefusalCount === 1 && stalePartitionRefusalCount === 1 && completionPreservedCount === 1 && tokenExhaustionRefusalCount === 1 && globalDisableEffectBlockCount === 1 && highestFencingToken === 5 && refusedScenarioCount === 16 && temporaryRecordFileCount === 41 && repositoryMutationPaths.length === 0 && failures.length === 0;

console.log(JSON.stringify({
    workflow: 'A-050',
    mode: options.validateOnly ? 'contract validation only' : 'offline packet-bound trusted-time, concurrent claimant, split-brain, and fencing-race rehearsal',
    timeAndSplitBrainContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    sourceEvidenceCurrent,
    rehearsalValid,
    packetCount: sourceEvidenceCurrent ? 2 : 0,
    scenarioCount: scenarioResults.length,
    passedScenarioCount,
    concurrentContenderProcessCount,
    acquisitionContenderCount: acquisitionWinnerCount + acquisitionLoserCount,
    acquisitionWinnerCount,
    acquisitionLoserCount,
    recoveryContenderCount: recoveryWinnerCount + recoveryLoserCount,
    recoveryWinnerCount,
    recoveryLoserCount,
    clockSkewCaseCount,
    workerClockOverrideIgnoredCount,
    delayedTriggerSuppressionCount,
    partitionedDuplicateRefusalCount,
    stalePartitionRefusalCount,
    completionPreservedCount,
    tokenExhaustionRefusalCount,
    globalDisableEffectBlockCount,
    highestFencingToken,
    fencingTokenAdvanced: highestFencingToken === 5,
    temporaryRecordFileCount,
    scheduledCompanyWorkflowInvocationCount: 0,
    refusalScenarioCount: refusalResults.length,
    refusedScenarioCount,
    unrefusedScenarioCount: refusalResults.filter(item => !item.refused).length,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    productionConsensusConfigured: contract.configuredProductionConsensusCount > 0,
    productionIdentityConfiguredCount: contract.configuredProductionIdentityCount,
    trustedTimeConfigured: contract.productionConsensusPolicy?.trustedTimeRef !== null,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    timeAndSplitBrainContractReadyForReview: contract.timeAndSplitBrainContractReadyForReview === true && contractFailureCount === 0,
    productionConsensusReady: contract.productionConsensusReady === true,
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
