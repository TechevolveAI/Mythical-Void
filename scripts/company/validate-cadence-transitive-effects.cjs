#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaults = [
    'docs/company/automation/cadence-transitive-effects.json',
    'docs/company/automation/operating-cadence.json',
    'docs/company/automation/registry.json',
    'docs/company/automation/agent-roster.json',
    'docs/company/automation/evaluation-catalog.json'
].map(file => path.join(repositoryRoot, file));
const inputPaths = defaults.map((fallback, index) => process.argv[index + 2] ? path.resolve(process.argv[index + 2]) : fallback);
const failures = [];

function load(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}
function exactSet(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(item => !actual.includes(item))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}
function allFalse(object, fields, label) {
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}
function readScript(relative) {
    try { return fs.readFileSync(path.join(repositoryRoot, relative), 'utf8'); }
    catch (error) { failures.push(`${relative} could not be inspected: ${error.message}`); return ''; }
}

const effectMap = load(inputPaths[0], 'Cadence transitive effect map');
const cadence = load(inputPaths[1], 'Operating cadence');
const registry = load(inputPaths[2], 'Automation registry');
const roster = load(inputPaths[3], 'Agent roster');
const catalog = load(inputPaths[4], 'Evaluation catalog');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || []).map(item => item.id));
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (effectMap.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(effectMap.asOf || '')) failures.push('asOf must be an ISO date');
if (effectMap.status !== 'transitive_effect_map_ready_execution_gated') failures.push('status must remain transitive_effect_map_ready_execution_gated');
if (typeof effectMap.purpose !== 'string' || effectMap.purpose.length < 120) failures.push('purpose is incomplete');
exactSet(effectMap.decisionRefs, ['D-014', 'D-017'], 'decisionRefs');
exactSet(effectMap.riskRefs, ['R-011', 'R-013'], 'riskRefs');
exactSet(effectMap.workflowRefs, ['A-001', 'A-002', 'A-012', 'A-014', 'A-015', 'A-016', 'A-017', 'A-023', 'A-024', 'A-025', 'A-029', 'A-030', 'A-041', 'A-042'], 'workflowRefs');
for (const id of effectMap.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of effectMap.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of effectMap.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
allFalse(effectMap.authority, ['packetExecutionAuthorized', 'schedulerActivationAuthorized', 'triggerActivationAuthorized', 'protectedInputBindingAuthorized', 'networkActivationAuthorized', 'historyPersistenceAuthorized', 'repositoryWriteAuthorized', 'credentialUseAuthorized', 'automatedDispatchAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'], 'authority');

const compiler = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/company/compile-cadence-work-packets.cjs'), ...inputPaths.slice(1)], { cwd: repositoryRoot, encoding: 'utf8', timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
let packetSet = null;
try { packetSet = JSON.parse(compiler.stdout); } catch { failures.push('A-042 packet output could not be parsed'); }
if (!packetSet || compiler.status !== 2 || packetSet.packetSetValid !== true) failures.push('A-042 packet set must remain valid and gated');
const packetsBySource = new Map((packetSet?.packets || []).map(packet => [packet.sourceId, packet]));

const expected = {
    'TEB-001': { sources: ['OC-001'], root: 'A-012', command: ['scripts/company/run-company-control-plane.cjs'], evidence: 'control_plane_default_without_online_flag', nested: 'registered_nonrecursive_control_list', network: 'none', reads: [], binding: false, input: null, fallback: 'none' },
    'TEB-002': { sources: ['OC-002', 'OT-001'], root: 'A-012', command: ['scripts/company/run-company-control-plane.cjs', '--verify'], evidence: 'control_plane_verify_without_online_flag', nested: 'registered_controls_plus_offline_evaluators', network: 'none', reads: [], binding: false, input: null, fallback: 'none' },
    'TEB-003': { sources: ['OC-003'], root: 'A-015', command: ['scripts/company/detect-company-control-plane-changes.cjs'], evidence: 'change_detector_invokes_control_plane_online', nested: 'A-015_to_A-012_online_to_A-001_public_read', network: 'public_read_via_nested_A-001_only', reads: ['A-001'], binding: false, input: null, fallback: 'none' },
    'TEB-004': { sources: ['OC-004'], root: 'A-002', command: ['scripts/company/compile-weekly-review.cjs'], evidence: 'weekly_review_reads_structured_files_only', nested: 'none', network: 'none', reads: [], binding: false, input: null, fallback: 'none' },
    'TEB-005': { sources: ['OT-002'], root: 'A-016', command: ['scripts/company/build-company-run-record.cjs', '--input', '{protected_trigger_payload_path}'], evidence: 'run_record_uses_protected_A-015_input_without_output_dir', nested: 'none_when_input_bound', network: 'none', reads: [], binding: true, input: 'A-015', fallback: 'prohibited_by_disabled_packet' },
    'TEB-006': { sources: ['OT-003'], root: 'A-017', command: ['scripts/company/propose-control-plane-baseline-update.cjs', '--input', '{protected_trigger_payload_path}'], evidence: 'baseline_proposal_uses_protected_A-015_input', nested: 'none_when_input_bound', network: 'none', reads: [], binding: true, input: 'A-015', fallback: 'prohibited_by_disabled_packet' },
    'TEB-007': { sources: ['OT-004'], root: 'A-030', command: ['scripts/company/run-internal-shadow-cycle.cjs'], evidence: 'shadow_runtime_exact_no_write_step_allowlist', nested: 'A-014_A-023_A-024_A-025_A-029_only', network: 'none', reads: [], binding: false, input: null, fallback: 'none' }
};
const boundaries = effectMap.effectBoundaries || [];
exactSet(boundaries.map(item => item.id), Object.keys(expected), 'effect boundary IDs');
const seenSources = new Set();
for (const boundary of boundaries) {
    const wanted = expected[boundary.id];
    if (!wanted) continue;
    if (JSON.stringify(boundary.sourceIds) !== JSON.stringify(wanted.sources) || boundary.rootWorkflowId !== wanted.root || JSON.stringify(boundary.commandTemplate) !== JSON.stringify(wanted.command)) failures.push(`${boundary.id} source, root workflow, or command template is invalid`);
    if (boundary.sourceEvidenceKind !== wanted.evidence || boundary.nestedWorkflowMode !== wanted.nested) failures.push(`${boundary.id} source evidence or nested workflow mode is invalid`);
    if (boundary.networkMode !== wanted.network || JSON.stringify(boundary.networkReadWorkflowIds) !== JSON.stringify(wanted.reads)) failures.push(`${boundary.id} network boundary is invalid`);
    if (boundary.protectedInputBindingRequired !== wanted.binding || boundary.inputSourceWorkflowId !== wanted.input || boundary.inputDigestRequired !== wanted.binding || boundary.inputBindingConfigured !== false || boundary.fallbackInvocationIfBindingMissing !== wanted.fallback) failures.push(`${boundary.id} protected input/fallback boundary is invalid`);
    allFalse(boundary, ['mayWrite', 'mayUseCredentials', 'mayCauseExternalAction'], boundary.id);
    for (const sourceId of boundary.sourceIds || []) {
        if (seenSources.has(sourceId)) failures.push(`packet source ${sourceId} is covered more than once`);
        seenSources.add(sourceId);
        const packet = packetsBySource.get(sourceId);
        if (!packet) { failures.push(`${boundary.id} references missing packet ${sourceId}`); continue; }
        if (packet.workflowId !== boundary.rootWorkflowId || JSON.stringify(packet.command) !== JSON.stringify(boundary.commandTemplate)) failures.push(`${boundary.id} does not match live packet ${sourceId}`);
        if (packet.declaredNetworkMode !== boundary.networkMode) failures.push(`${boundary.id} network mode does not match live packet ${sourceId}`);
        const packetBinding = packet.inputBinding?.kind === 'protected_prior_workflow_output';
        if (packetBinding !== boundary.protectedInputBindingRequired || packet.inputBinding?.bindingConfigured === true) failures.push(`${boundary.id} input binding does not match live packet ${sourceId}`);
    }
}
exactSet([...seenSources], ['OC-001', 'OC-002', 'OC-003', 'OC-004', 'OT-001', 'OT-002', 'OT-003', 'OT-004'], 'covered packet sources');

const runnerBody = readScript('scripts/company/run-company-control-plane.cjs');
if (!runnerBody.includes("process.argv.includes('--online')") || !runnerBody.includes("id: 'A-001'") || !runnerBody.includes('if (includeOnline)')) failures.push('A-012 online A-001 boundary source evidence drifted');
const detectorBody = readScript('scripts/company/detect-company-control-plane-changes.cjs');
if (!detectorBody.includes("[runnerPath, '--online']")) failures.push('A-015 public-read nested invocation source evidence drifted');
const recordBody = readScript('scripts/company/build-company-run-record.cjs');
if (!recordBody.includes("['--input', '--output-dir']") || !recordBody.includes('if (options.inputPath)') || !recordBody.includes('[detectorPath]')) failures.push('A-016 protected-input/fallback source evidence drifted');
const proposalBody = readScript('scripts/company/propose-control-plane-baseline-update.cjs');
if (!proposalBody.includes("values[0] === '--input'") || !proposalBody.includes('if (options.inputPath)') || !proposalBody.includes('[detectorPath]')) failures.push('A-017 protected-input/fallback source evidence drifted');
const weeklyBody = readScript('scripts/company/compile-weekly-review.cjs');
if (weeklyBody.includes("require('child_process')") || weeklyBody.includes('spawnSync(')) failures.push('A-002 unexpectedly gained a child-process path');
const shadow = load(path.join(repositoryRoot, 'docs/company/automation/shadow-runtime.json'), 'Shadow runtime');
if (JSON.stringify((shadow.steps || []).map(step => step.workflowId)) !== JSON.stringify(['A-014', 'A-023', 'A-024', 'A-025', 'A-029'])) failures.push('A-030 shadow-runtime nested step allowlist drifted');
for (const step of shadow.steps || []) allFalse(step, ['mayWrite', 'mayUseCredentials', 'mayReadRestrictedData', 'mayCauseExternalAction'], `shadow ${step.id}`);

const assurance = effectMap.sourceAssurance || {};
for (const field of ['packetCompilerCompared', 'liveSourcePatternsCompared', 'shadowRuntimeStepsCompared']) if (assurance[field] !== true) failures.push(`sourceAssurance.${field} must be true`);
for (const field of ['unknownTransitiveEffectsPermitted', 'topLevelRegistryEffectAloneIsSufficient', 'protectedInputPlaceholderCountsAsConfigured', 'publicReadMayBeRepeatedByDownstreamTrigger']) if (assurance[field] !== false) failures.push(`sourceAssurance.${field} must remain false`);
const gates = effectMap.activationGates || [];
exactSet(gates.map(item => item.id), Array.from({ length: 12 }, (_, index) => `TE-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs');
for (const gate of gates) if (gate.satisfied !== false || typeof gate.gate !== 'string' || gate.gate.length < 75) failures.push(`${gate.id || 'gate'} must remain unsatisfied and complete`);

for (const [field, wanted] of Object.entries({ effectBoundaryCount: 7, coveredPacketCount: 8, publicNetworkPacketCount: 1, protectedInputBindingPacketCount: 2, configuredInputBindingPacketCount: 0, unknownTransitiveEffectCount: 0, satisfiedActivationGateCount: 0 })) if (effectMap[field] !== wanted) failures.push(`${field} must be ${wanted}`);
if (effectMap.effectMapReadyForReview !== true) failures.push('effectMapReadyForReview must be true');
for (const field of ['runtimeTracingReady', 'packetExecutionReady', 'externalActionAuthorized']) if (effectMap[field] !== false) failures.push(`${field} must remain false`);
if (typeof effectMap.nextDecision !== 'string' || effectMap.nextDecision.length < 160 || !effectMap.nextDecision.includes('Do not activate')) failures.push('nextDecision must preserve the non-activation boundary');

const packetSourceCount = packetSet?.packets?.length || 0;
const publicNetworkPackets = (packetSet?.packets || []).filter(packet => packet.declaredNetworkMode !== 'none');
const protectedPackets = (packetSet?.packets || []).filter(packet => packet.inputBinding?.kind === 'protected_prior_workflow_output');
const effectMapValid = failures.length === 0;
console.log(JSON.stringify({
    workflow: 'A-043',
    mode: 'static transitive cadence effect and protected-input assurance; no packet execution, tracing, network activation, binding, persistence, dispatch, spend, or external action',
    effectMapValid,
    effectMapReadyForReview: effectMap.effectMapReadyForReview,
    effectBoundaryCount: boundaries.length,
    packetSourceCount,
    coveredPacketCount: seenSources.size,
    uncoveredPacketCount: [...packetsBySource.keys()].filter(id => !seenSources.has(id)).length,
    duplicatePacketCoverageCount: Math.max(0, [...boundaries].flatMap(item => item.sourceIds || []).length - seenSources.size),
    publicNetworkPacketCount: publicNetworkPackets.length,
    publicNetworkSourceIds: publicNetworkPackets.map(packet => packet.sourceId),
    protectedInputBindingPacketCount: protectedPackets.length,
    configuredInputBindingPacketCount: protectedPackets.filter(packet => packet.inputBinding?.bindingConfigured).length,
    unknownTransitiveEffectCount: failures.filter(item => /unknown|uncovered|missing packet/i.test(item)).length,
    liveSourceEvidenceCurrent: effectMapValid,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    runtimeTracingReady: false,
    packetExecutionReady: false,
    automatedDispatchAuthorized: false,
    externalActionAuthorized: false,
    failures,
    nextAction: effectMap.nextDecision
}, null, 2));

process.exitCode = failures.length ? 1 : 2;
