#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'protected-trigger-binding.json');
const prohibitedPayloadKeys = new Set([
    'rawMessage', 'messageBody', 'email', 'phone', 'name', 'accountId',
    'userId', 'ipAddress', 'token', 'password', 'secret', 'transcript',
    'customerContent', 'supportContent', 'prompt', 'artifactContent'
]);

function parseArguments(values) {
    const options = { contractPath: defaultContractPath, validateOnly: false };
    for (let index = 0; index < values.length; index += 1) {
        const argument = values[index];
        if (argument === '--validate-only') options.validateOnly = true;
        else if (argument === '--input') {
            if (!values[index + 1]) throw new Error('--input requires a path');
            options.contractPath = path.resolve(values[index + 1]);
            index += 1;
        } else throw new Error(`Unknown argument ${argument}`);
    }
    return options;
}

function loadJson(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}

function exactSet(actual, expected, label, failures) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(item => !actual.includes(item))) {
        failures.push(`${label} must be exactly ${expected.join(', ')}`);
    }
}

function exactObjectKeys(object, expected, label, failures) {
    exactSet(object && typeof object === 'object' && !Array.isArray(object) ? Object.keys(object) : [], expected, `${label} fields`, failures);
}

function allFalse(object, fields, label, failures) {
    exactObjectKeys(object, fields, label, failures);
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}

function findProhibitedKey(value, trail = []) {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const found = findProhibitedKey(value[index], [...trail, String(index)]);
            if (found) return found;
        }
        return null;
    }
    for (const [key, child] of Object.entries(value)) {
        if (prohibitedPayloadKeys.has(key)) return [...trail, key].join('.');
        const found = findProhibitedKey(child, [...trail, key]);
        if (found) return found;
    }
    return null;
}

function canonicalSeverityCounts(changes) {
    const totals = {};
    for (const change of changes) totals[change.severity] = (totals[change.severity] || 0) + 1;
    return Object.fromEntries(['informational', 'medium', 'high', 'critical'].filter(severity => totals[severity]).map(severity => [severity, totals[severity]]));
}

function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function snapshotTree(relativeRoots) {
    const snapshot = new Map();
    function visit(absolute, relative) {
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) {
            snapshot.set(relative, `link:${fs.readlinkSync(absolute)}`);
            return;
        }
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(absolute).sort()) visit(path.join(absolute, entry), path.join(relative, entry));
            return;
        }
        if (stat.isFile()) {
            const digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
            snapshot.set(relative, `file:${stat.mode & 0o777}:${stat.size}:${digest}`);
        }
    }
    for (const relativeRoot of relativeRoots) visit(path.join(repositoryRoot, relativeRoot), relativeRoot);
    return snapshot;
}

function snapshotDifferences(before, after) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    return [...keys].filter(key => before.get(key) !== after.get(key)).sort();
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Protected trigger binding contract');
const cadence = loadJson(path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json'), 'Operating cadence');
const effectMap = loadJson(path.join(repositoryRoot, 'docs/company/automation/cadence-transitive-effects.json'), 'Cadence transitive effect map');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'offline_synthetic_binding_rehearsal_ready_live_binding_gated') failures.push('status must remain offline_synthetic_binding_rehearsal_ready_live_binding_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 180) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-014', 'D-017'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-011', 'R-013'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-015', 'A-016', 'A-017', 'A-041', 'A-042', 'A-043'], 'workflowRefs', failures);
const knownWorkflowIds = new Set((registry.workflows || []).map(item => item.id));
const knownRiskIds = new Set((risks.risks || []).map(item => item.id));
const knownDecisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!knownWorkflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!knownRiskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!knownDecisionIds.has(id)) failures.push(`unknown decision ${id}`);

allFalse(contract.authority, [
    'productionPayloadUseAuthorized', 'protectedInputBindingAuthorized', 'packetExecutionAuthorized',
    'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'networkActivationAuthorized',
    'historyPersistenceAuthorized', 'repositoryWriteAuthorized', 'credentialUseAuthorized',
    'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized',
    'conversationIsAuthorization'
], 'authority', failures);

const binding = contract.bindingDesign || {};
const requiredTrueBindingFields = [
    'protectedPathRequired', 'sourceDigestRequired', 'parentPacketIdRequired', 'sourceRunIdRequired',
    'consumerPacketIdRequired', 'targetWorkflowIdRequired', 'payloadSchemaValidationRequired',
    'freshnessValidationRequired', 'replayProtectionRequired'
];
if (binding.sourceWorkflowId !== 'A-015' || binding.sourceWorkflowVersion !== 1 || binding.acceptedPayloadKind !== 'validated_A-015_comparison') failures.push('binding source identity or payload kind is invalid');
if (binding.sourceDigestAlgorithm !== 'sha256') failures.push('sourceDigestAlgorithm must be sha256');
for (const field of requiredTrueBindingFields) if (binding[field] !== true) failures.push(`bindingDesign.${field} must be true`);
if (binding.maxAgeSeconds !== null) failures.push('maxAgeSeconds must remain null until trusted-time policy is approved');
for (const field of ['replayStoreConfigured', 'historyStoreConfigured', 'bindingConfigured', 'placeholderCountsAsConfigured', 'productionPayloadAccepted']) if (binding[field] !== false) failures.push(`bindingDesign.${field} must remain false`);
const behaviors = {
    missingBindingBehavior: 'reject_without_fallback',
    digestMismatchBehavior: 'reject_without_consumer_invocation',
    stalePayloadBehavior: 'reject_without_consumer_invocation',
    replayedPayloadBehavior: 'reject_without_consumer_invocation',
    targetMismatchBehavior: 'reject_without_consumer_invocation'
};
for (const [field, expected] of Object.entries(behaviors)) if (binding[field] !== expected) failures.push(`bindingDesign.${field} must be ${expected}`);
const pathProtection = binding.pathProtection || {};
for (const field of ['outsideRepositoryRequired', 'symlinkRejected', 'ownerCheckRequired', 'modeCheckRequired']) if (pathProtection[field] !== true) failures.push(`bindingDesign.pathProtection.${field} must be true`);
if (pathProtection.implementedInLiveBinding !== false) failures.push('bindingDesign.pathProtection.implementedInLiveBinding must remain false');

const expectedConsumers = {
    'PTC-001': {
        trigger: 'OT-002', workflow: 'A-016', implementation: 'scripts/company/build-company-run-record.cjs',
        command: ['scripts/company/build-company-run-record.cjs', '--input', '{protected_trigger_payload_path}'], exits: [0],
        assertions: { recordValid: true, recordWritten: false, writerMode: 'dry_run', sourceDigestMatchesPayload: true, externalActionAuthorized: false }
    },
    'PTC-002': {
        trigger: 'OT-003', workflow: 'A-017', implementation: 'scripts/company/propose-control-plane-baseline-update.cjs',
        command: ['scripts/company/propose-control-plane-baseline-update.cjs', '--input', '{protected_trigger_payload_path}'], exits: [2],
        assertions: { proposalValid: true, proposalRequired: true, proposalEligible: true, baselineWritten: false, candidateDigestMatchesSnapshot: true, externalActionAuthorized: false }
    }
};
const consumers = contract.consumers || [];
exactSet(consumers.map(item => item.id), Object.keys(expectedConsumers), 'consumer IDs', failures);
const cadenceTriggers = new Map((cadence.eventTriggerPlans || []).map(item => [item.id, item]));
const effectBoundaries = new Map((effectMap.effectBoundaries || []).flatMap(item => (item.sourceIds || []).map(sourceId => [sourceId, item])));
for (const consumer of consumers) {
    const expected = expectedConsumers[consumer.id];
    if (!expected) continue;
    if (consumer.sourceTriggerId !== expected.trigger || consumer.targetWorkflowId !== expected.workflow || consumer.implementationPath !== expected.implementation) failures.push(`${consumer.id} trigger, target, or implementation is invalid`);
    if (!sameJson(consumer.commandTemplate, expected.command)) failures.push(`${consumer.id} commandTemplate is invalid`);
    if (consumer.inputArgumentRequired !== true || consumer.defaultInvocationPermitted !== false || consumer.outputDirectoryArgumentPermitted !== false || consumer.networkMode !== 'none') failures.push(`${consumer.id} input, fallback, write, or network boundary is invalid`);
    if (!sameJson(consumer.expectedExitCodes, expected.exits) || !sameJson(consumer.expectedAssertions, expected.assertions)) failures.push(`${consumer.id} expected outcome is invalid`);
    if ((consumer.commandTemplate || []).includes('--output-dir')) failures.push(`${consumer.id} may not include --output-dir`);
    const liveTrigger = cadenceTriggers.get(expected.trigger);
    if (!liveTrigger || liveTrigger.workflowId !== expected.workflow || !sameJson(liveTrigger.command, expected.command)) failures.push(`${consumer.id} does not match the live A-041 trigger`);
    const liveBoundary = effectBoundaries.get(expected.trigger);
    if (!liveBoundary || liveBoundary.rootWorkflowId !== expected.workflow || !sameJson(liveBoundary.commandTemplate, expected.command) || liveBoundary.inputBindingConfigured !== false) failures.push(`${consumer.id} does not match the gated A-043 effect boundary`);
}

const scenarios = contract.syntheticScenarios || [];
exactSet(scenarios.map(item => item.id), ['PTS-001', 'PTS-002'], 'synthetic scenario IDs', failures);
const expectedScenarioConsumers = { 'PTS-001': 'PTC-001', 'PTS-002': 'PTC-002' };
for (const scenario of scenarios) {
    if (scenario.consumerId !== expectedScenarioConsumers[scenario.id]) failures.push(`${scenario.id} consumer binding is invalid`);
    if (typeof scenario.description !== 'string' || scenario.description.length < 100) failures.push(`${scenario.id} description is incomplete`);
    const payload = scenario.payload || {};
    if (payload.workflow !== 'A-015' || payload.comparisonValid !== true || payload.externalActionAuthorized !== false) failures.push(`${scenario.id} must be a valid non-authorizing A-015 payload`);
    for (const field of ['baselineCapturedAt', 'currentCapturedAt']) if (typeof payload[field] !== 'string' || Number.isNaN(Date.parse(payload[field]))) failures.push(`${scenario.id}.${field} is invalid`);
    if (!Array.isArray(payload.changes) || payload.changeCount !== payload.changes?.length) failures.push(`${scenario.id} changeCount must match changes`);
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    if (changes.some(change => !['informational', 'medium', 'high', 'critical'].includes(change.severity))) failures.push(`${scenario.id} contains an unknown severity`);
    if (!sameJson(payload.severityCounts, canonicalSeverityCounts(changes))) failures.push(`${scenario.id} severityCounts must match changes in canonical order`);
    if (typeof payload.alertRequired !== 'boolean' || typeof payload.humanReviewRecommended !== 'boolean') failures.push(`${scenario.id} alert and review fields must be boolean`);
    const prohibited = findProhibitedKey(payload);
    if (prohibited) failures.push(`${scenario.id} contains prohibited payload field ${prohibited}`);
    if (scenario.id === 'PTS-001' && (!changes.some(change => change.severity === 'high') || !changes.some(change => change.severity === 'medium') || payload.alertRequired !== true || payload.humanReviewRecommended !== true)) failures.push('PTS-001 must exercise high and medium dry-run metadata');
    if (scenario.id === 'PTS-002') {
        if (!changes.length || changes.some(change => change.severity !== 'informational')) failures.push('PTS-002 must contain informational changes only');
        if (payload.alertRequired !== false || payload.humanReviewRecommended !== false) failures.push('PTS-002 must remain informational-only');
        if (payload.currentSnapshot?.schemaVersion !== 1 || payload.currentSnapshot?.externalActionAuthorized !== false) failures.push('PTS-002 must include a valid non-authorizing currentSnapshot');
    }
}

const rehearsalAssertions = contract.rehearsalAssertions || {};
const requiredTrueAssertions = ['syntheticPayloadOnly', 'temporaryDirectoryOutsideRepositoryRequired', 'exactInputArgumentRequired'];
const requiredFalseAssertions = ['productionPayloadsPermitted', 'outputDirectoryArgumentPermitted', 'defaultInvocationPermitted', 'repositoryMutationPermitted', 'networkAccessPermitted', 'credentialUsePermitted', 'historyPersistencePermitted', 'consumerCommandFallbackPermitted', 'eligibleCycleCreditPermitted', 'externalActionPermitted'];
exactObjectKeys(rehearsalAssertions, [...requiredTrueAssertions, ...requiredFalseAssertions], 'rehearsalAssertions', failures);
for (const field of requiredTrueAssertions) if (rehearsalAssertions[field] !== true) failures.push(`rehearsalAssertions.${field} must be true`);
for (const field of requiredFalseAssertions) if (rehearsalAssertions[field] !== false) failures.push(`rehearsalAssertions.${field} must remain false`);

const gates = contract.activationGates || [];
if (gates.length !== 14) failures.push('activationGates must contain exactly 14 gates');
exactSet(gates.map(gate => gate.id), Array.from({ length: 14 }, (_, index) => `PT-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs', failures);
for (const gate of gates) {
    if (typeof gate.gate !== 'string' || gate.gate.length < 80) failures.push(`${gate.id} description is incomplete`);
    if (gate.satisfied !== false) failures.push(`${gate.id} must remain unsatisfied`);
}
if (contract.consumerCount !== 2 || contract.consumerCount !== consumers.length) failures.push('consumerCount must be 2 and match consumers');
if (contract.syntheticScenarioCount !== 2 || contract.syntheticScenarioCount !== scenarios.length) failures.push('syntheticScenarioCount must be 2 and match scenarios');
for (const field of ['configuredBindingCount', 'configuredReplayStoreCount', 'configuredHistoryStoreCount', 'satisfiedActivationGateCount']) if (contract[field] !== 0) failures.push(`${field} must remain 0`);
if (contract.bindingContractReadyForReview !== true) failures.push('bindingContractReadyForReview must be true');
for (const field of ['runtimeBindingReady', 'packetExecutionReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 220) failures.push('nextDecision is incomplete');

const contractFailureCount = failures.length;
const rehearsalResults = [];
let repositoryMutationPaths = [];
let rehearsalPerformed = false;
if (!options.validateOnly && contractFailureCount === 0) {
    rehearsalPerformed = true;
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a044-'));
    const before = snapshotTree(['docs/company', 'scripts/company']);
    try {
        for (const scenario of scenarios) {
            const consumer = consumers.find(item => item.id === scenario.consumerId);
            const payloadPath = path.join(temporaryDirectory, `${scenario.id}.json`);
            const payloadRaw = `${JSON.stringify(scenario.payload, null, 2)}\n`;
            fs.writeFileSync(payloadPath, payloadRaw, { flag: 'wx', mode: 0o600 });
            const result = spawnSync(process.execPath, [path.join(repositoryRoot, consumer.implementationPath), '--input', payloadPath], {
                cwd: repositoryRoot,
                encoding: 'utf8',
                timeout: 30_000,
                maxBuffer: 2 * 1024 * 1024
            });
            let output = null;
            try { output = JSON.parse(result.stdout); }
            catch { failures.push(`${scenario.id} consumer output could not be parsed`); }
            const expectedExit = consumer.expectedExitCodes.includes(result.status);
            if (!expectedExit) failures.push(`${scenario.id} returned unexpected exit ${result.status}`);
            let assertionsPassed = false;
            if (scenario.id === 'PTS-001' && output) {
                const sourceDigest = crypto.createHash('sha256').update(payloadRaw).digest('hex');
                assertionsPassed = output.workflow === 'A-016' && output.recordValid === true && output.recordWritten === false && output.outputPath === null && output.record?.writerMode === 'dry_run' && output.record?.sourceDigestSha256 === sourceDigest && output.externalActionAuthorized === false;
            }
            if (scenario.id === 'PTS-002' && output) {
                const candidateRaw = `${JSON.stringify(scenario.payload.currentSnapshot, null, 2)}\n`;
                const candidateDigest = crypto.createHash('sha256').update(candidateRaw).digest('hex');
                assertionsPassed = output.workflow === 'A-017' && output.proposalValid === true && output.proposalRequired === true && output.proposalEligible === true && output.baselineWritten === false && output.candidateDigestSha256 === candidateDigest && output.externalActionAuthorized === false;
            }
            if (!assertionsPassed) failures.push(`${scenario.id} consumer assertions failed`);
            rehearsalResults.push({
                scenarioId: scenario.id,
                consumerId: consumer.id,
                targetWorkflowId: consumer.targetWorkflowId,
                exitCode: result.status,
                expectedExitCode: expectedExit,
                assertionsPassed,
                recordOrBaselineWritten: output?.recordWritten === true || output?.baselineWritten === true,
                externalActionAuthorized: output?.externalActionAuthorized === true
            });
        }
    } finally {
        const after = snapshotTree(['docs/company', 'scripts/company']);
        repositoryMutationPaths = snapshotDifferences(before, after);
        if (repositoryMutationPaths.length) failures.push(`rehearsal changed repository paths: ${repositoryMutationPaths.join(', ')}`);
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

const passedRehearsalCount = rehearsalResults.filter(item => item.expectedExitCode && item.assertionsPassed && !item.recordOrBaselineWritten && !item.externalActionAuthorized).length;
const rehearsalValid = rehearsalPerformed && failures.length === 0 && passedRehearsalCount === 2 && repositoryMutationPaths.length === 0;
console.log(JSON.stringify({
    workflow: 'A-044',
    mode: options.validateOnly ? 'contract validation only' : 'offline synthetic protected-input branch rehearsal',
    bindingContractValid: contractFailureCount === 0,
    rehearsalPerformed,
    rehearsalValid,
    consumerCount: consumers.length,
    syntheticPayloadCount: scenarios.length,
    rehearsalCount: rehearsalResults.length,
    passedRehearsalCount,
    repositoryMutationCount: repositoryMutationPaths.length,
    repositoryMutationPaths,
    consumerCommandFallbackCount: 0,
    protectedBindingConfigured: binding.bindingConfigured === true,
    replayStoreConfigured: binding.replayStoreConfigured === true,
    protectedHistoryConfigured: binding.historyStoreConfigured === true,
    productionPayloadAccepted: binding.productionPayloadAccepted === true,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(gate => gate.satisfied === true).length,
    bindingContractReadyForReview: contract.bindingContractReadyForReview === true && contractFailureCount === 0,
    runtimeBindingReady: contract.runtimeBindingReady === true,
    packetExecutionReady: contract.packetExecutionReady === true,
    automatedDispatchAuthorized: contract.authority?.automatedDispatchAuthorized === true,
    externalActionAuthorized: contract.externalActionAuthorized === true || contract.authority?.externalActionAuthorized === true,
    eligibleCycleCreditGranted: false,
    failures,
    rehearsals: rehearsalResults
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
