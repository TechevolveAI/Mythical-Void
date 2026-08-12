#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-cadence-transitive-effects.cjs');
const source = {
    effectMap: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/cadence-transitive-effects.json'))),
    cadence: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json'))),
    registry: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/registry.json'))),
    roster: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/agent-roster.json'))),
    catalog: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/evaluation-catalog.json')))
};
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a043-'));

function execute(name, fixture = source) {
    const paths = ['effectMap', 'cadence', 'registry', 'roster', 'catalog'].map(key => {
        const file = path.join(temporaryDirectory, `${name}-${key}.json`);
        fs.writeFileSync(file, JSON.stringify(fixture[key]));
        return file;
    });
    const result = spawnSync(process.execPath, [validator, ...paths], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function mapChange(change) { return { ...source, effectMap: change(source.effectMap) }; }
function boundary(id, changes) { return source.effectMap.effectBoundaries.map(item => item.id === id ? { ...item, ...changes } : item); }

try {
    const baseline = execute('baseline');
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.effectMapValid, true);
    assert.strictEqual(baseline.output.effectBoundaryCount, 7);
    assert.strictEqual(baseline.output.packetSourceCount, 8);
    assert.strictEqual(baseline.output.coveredPacketCount, 8);
    assert.strictEqual(baseline.output.uncoveredPacketCount, 0);
    assert.strictEqual(baseline.output.publicNetworkPacketCount, 1);
    assert.deepStrictEqual(baseline.output.publicNetworkSourceIds, ['OC-003']);
    assert.strictEqual(baseline.output.protectedInputBindingPacketCount, 2);
    assert.strictEqual(baseline.output.configuredInputBindingPacketCount, 0);
    assert.strictEqual(baseline.output.unknownTransitiveEffectCount, 0);
    assert.strictEqual(baseline.output.packetExecutionReady, false);

    const authority = execute('authority', mapChange(m => ({ ...m, authority: { ...m.authority, packetExecutionAuthorized: true } })));
    assert.strictEqual(authority.status, 1); assert(authority.output.failures.some(x => x.includes('packetExecutionAuthorized')));

    const networkAuthority = execute('network-authority', mapChange(m => ({ ...m, authority: { ...m.authority, networkActivationAuthorized: true } })));
    assert.strictEqual(networkAuthority.status, 1); assert(networkAuthority.output.failures.some(x => x.includes('networkActivationAuthorized')));

    const missingBoundary = execute('missing-boundary', mapChange(m => ({ ...m, effectBoundaries: m.effectBoundaries.filter(item => item.id !== 'TEB-007') })));
    assert.strictEqual(missingBoundary.status, 1); assert(missingBoundary.output.failures.some(x => x.includes('effect boundary IDs') || x.includes('covered packet')));

    const duplicateSource = execute('duplicate-source', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-007', { sourceIds: ['OT-003'] }) })));
    assert.strictEqual(duplicateSource.status, 1); assert(duplicateSource.output.failures.some(x => x.includes('covered more than once') || x.includes('TEB-007')));

    const unknownSource = execute('unknown-source', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-007', { sourceIds: ['OT-999'] }) })));
    assert.strictEqual(unknownSource.status, 1); assert(unknownSource.output.failures.some(x => x.includes('missing packet') || x.includes('covered packet')));

    const root = execute('root', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-003', { rootWorkflowId: 'A-012' }) })));
    assert.strictEqual(root.status, 1); assert(root.output.failures.some(x => x.includes('TEB-003')));

    const command = execute('command', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-005', { commandTemplate: ['scripts/company/build-company-run-record.cjs'] }) })));
    assert.strictEqual(command.status, 1); assert(command.output.failures.some(x => x.includes('TEB-005')));

    const evidence = execute('evidence', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-001', { sourceEvidenceKind: 'unknown' }) })));
    assert.strictEqual(evidence.status, 1); assert(evidence.output.failures.some(x => x.includes('source evidence')));

    const nested = execute('nested', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-002', { nestedWorkflowMode: 'unknown' }) })));
    assert.strictEqual(nested.status, 1); assert(nested.output.failures.some(x => x.includes('nested workflow')));

    const publicMode = execute('public-mode', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-003', { networkMode: 'none' }) })));
    assert.strictEqual(publicMode.status, 1); assert(publicMode.output.failures.some(x => x.includes('network boundary')));

    const publicWorkflow = execute('public-workflow', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-003', { networkReadWorkflowIds: [] }) })));
    assert.strictEqual(publicWorkflow.status, 1); assert(publicWorkflow.output.failures.some(x => x.includes('network boundary')));

    const write = execute('write', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-005', { mayWrite: true }) })));
    assert.strictEqual(write.status, 1); assert(write.output.failures.some(x => x.includes('mayWrite')));

    const credential = execute('credential', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-006', { mayUseCredentials: true }) })));
    assert.strictEqual(credential.status, 1); assert(credential.output.failures.some(x => x.includes('mayUseCredentials')));

    const external = execute('external', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-007', { mayCauseExternalAction: true }) })));
    assert.strictEqual(external.status, 1); assert(external.output.failures.some(x => x.includes('mayCauseExternalAction')));

    const noBinding = execute('no-binding', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-005', { protectedInputBindingRequired: false }) })));
    assert.strictEqual(noBinding.status, 1); assert(noBinding.output.failures.some(x => x.includes('input/fallback')));

    const wrongInput = execute('wrong-input', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-006', { inputSourceWorkflowId: 'A-012' }) })));
    assert.strictEqual(wrongInput.status, 1); assert(wrongInput.output.failures.some(x => x.includes('input/fallback')));

    const bindingConfigured = execute('binding-configured', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-005', { inputBindingConfigured: true }) })));
    assert.strictEqual(bindingConfigured.status, 1); assert(bindingConfigured.output.failures.some(x => x.includes('input/fallback')));

    const fallback = execute('fallback', mapChange(m => ({ ...m, effectBoundaries: boundary('TEB-006', { fallbackInvocationIfBindingMissing: 'invoke_A-015' }) })));
    assert.strictEqual(fallback.status, 1); assert(fallback.output.failures.some(x => x.includes('input/fallback')));

    const topLevelOnly = execute('top-level-only', mapChange(m => ({ ...m, sourceAssurance: { ...m.sourceAssurance, topLevelRegistryEffectAloneIsSufficient: true } })));
    assert.strictEqual(topLevelOnly.status, 1); assert(topLevelOnly.output.failures.some(x => x.includes('topLevelRegistryEffectAloneIsSufficient')));

    const repeatRead = execute('repeat-read', mapChange(m => ({ ...m, sourceAssurance: { ...m.sourceAssurance, publicReadMayBeRepeatedByDownstreamTrigger: true } })));
    assert.strictEqual(repeatRead.status, 1); assert(repeatRead.output.failures.some(x => x.includes('publicReadMayBeRepeated')));

    const unknownAllowed = execute('unknown-allowed', mapChange(m => ({ ...m, sourceAssurance: { ...m.sourceAssurance, unknownTransitiveEffectsPermitted: true } })));
    assert.strictEqual(unknownAllowed.status, 1); assert(unknownAllowed.output.failures.some(x => x.includes('unknownTransitiveEffectsPermitted')));

    const gate = execute('gate', mapChange(m => ({ ...m, activationGates: m.activationGates.map(item => item.id === 'TE-G01' ? { ...item, satisfied: true } : item) })));
    assert.strictEqual(gate.status, 1); assert(gate.output.failures.some(x => x.includes('TE-G01')));

    const count = execute('count', mapChange(m => ({ ...m, publicNetworkPacketCount: 2 })));
    assert.strictEqual(count.status, 1); assert(count.output.failures.some(x => x.includes('publicNetworkPacketCount')));

    const tracing = execute('tracing', mapChange(m => ({ ...m, runtimeTracingReady: true })));
    assert.strictEqual(tracing.status, 1); assert(tracing.output.failures.some(x => x.includes('runtimeTracingReady')));

    const execution = execute('execution', mapChange(m => ({ ...m, packetExecutionReady: true })));
    assert.strictEqual(execution.status, 1); assert(execution.output.failures.some(x => x.includes('packetExecutionReady')));

    console.log('A-043 cadence transitive-effect evaluations passed (25 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
