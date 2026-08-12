#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const compiler = path.join(__dirname, 'compile-cadence-work-packets.cjs');
const source = {
    cadence: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json'))),
    registry: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/registry.json'))),
    roster: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/agent-roster.json'))),
    catalog: JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/evaluation-catalog.json')))
};
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a042-'));

function execute(name, fixture = source) {
    const paths = ['cadence', 'registry', 'roster', 'catalog'].map(key => {
        const file = path.join(temporaryDirectory, `${name}-${key}.json`);
        fs.writeFileSync(file, JSON.stringify(fixture[key]));
        return file;
    });
    const result = spawnSync(process.execPath, [compiler, ...paths], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function withCadence(change) { return { ...source, cadence: change(source.cadence) }; }
function schedule(id, changes) { return source.cadence.calendarSchedules.map(item => item.id === id ? { ...item, ...changes } : item); }
function workflow(id, changes) { return { ...source, registry: { ...source.registry, workflows: source.registry.workflows.map(item => item.id === id ? { ...item, ...changes } : item) } }; }
function evaluation(id, changes) { return { ...source, catalog: { ...source.catalog, workflows: source.catalog.workflows.map(item => item.workflowId === id ? { ...item, ...changes } : item) } }; }

try {
    const baseline = execute('baseline');
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.packetSetValid, true);
    assert.strictEqual(baseline.output.calendarPacketCount, 4);
    assert.strictEqual(baseline.output.eventTriggerPacketCount, 4);
    assert.strictEqual(baseline.output.totalPacketCount, 8);
    assert.strictEqual(baseline.output.uniquePacketIdCount, 8);
    assert.strictEqual(baseline.output.uniqueContentDigestCount, 8);
    assert.strictEqual(baseline.output.independentEvaluatorBindingCount, 8);
    assert.strictEqual(baseline.output.protectedInputBindingPacketCount, 2);
    assert.strictEqual(baseline.output.configuredInputBindingPacketCount, 0);
    assert.strictEqual(baseline.output.allPacketsDisabled, true);
    assert.strictEqual(baseline.output.packetSetReadyForReview, true);
    assert.strictEqual(baseline.output.protectedDispatchReady, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);

    const authority = execute('authority', withCadence(c => ({ ...c, authority: { ...c.authority, automatedDispatchAuthorized: true } })));
    assert.strictEqual(authority.status, 1); assert(authority.output.failures.some(x => x.includes('automatedDispatchAuthorized')));

    const scheduler = execute('scheduler', withCadence(c => ({ ...c, schedulerEnabled: true })));
    assert.strictEqual(scheduler.status, 1); assert(scheduler.output.failures.some(x => x.includes('scheduler')));

    const enabledSchedule = execute('enabled-schedule', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-001', { state: 'enabled' }) })));
    assert.strictEqual(enabledSchedule.status, 1); assert(enabledSchedule.output.failures.some(x => x.includes('OC-001')));

    const gate = execute('activation-gate', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-002', { activationGateSatisfied: true }) })));
    assert.strictEqual(gate.status, 1); assert(gate.output.failures.some(x => x.includes('activationGateSatisfied')));

    const trigger = execute('trigger', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-001' ? { ...item, automaticInvocationPermitted: true } : item) })));
    assert.strictEqual(trigger.status, 1); assert(trigger.output.failures.some(x => x.includes('automaticInvocationPermitted')));

    const triggerNetwork = execute('trigger-network', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-002' ? { ...item, networkMode: 'unrestricted' } : item) })));
    assert.strictEqual(triggerNetwork.status, 1); assert(triggerNetwork.output.failures.some(x => x.includes('network mode')));

    const triggerBinding = execute('trigger-binding', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-003' ? { ...item, inputBinding: { ...item.inputBinding, bindingConfigured: true } } : item) })));
    assert.strictEqual(triggerBinding.status, 1); assert(triggerBinding.output.failures.some(x => x.includes('input binding')));

    const unknownWorkflow = execute('unknown-workflow', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-002' ? { ...item, workflowId: 'A-999' } : item) })));
    assert.strictEqual(unknownWorkflow.status, 1); assert(unknownWorkflow.output.failures.some(x => x.includes('unknown workflow')));

    const implementation = execute('implementation', workflow('A-002', { implementation: 'scripts/company/other.cjs' }));
    assert.strictEqual(implementation.status, 1); assert(implementation.output.failures.some(x => x.includes('command') || x.includes('implementation')));

    const externalEffect = execute('external-effect', workflow('A-012', { externalEffect: true }));
    assert.strictEqual(externalEffect.status, 1); assert(externalEffect.output.failures.some(x => x.includes('externalEffect')));

    const autonomy = execute('autonomy', workflow('A-015', { autonomy: 'A2' }));
    assert.strictEqual(autonomy.status, 1); assert(autonomy.output.failures.some(x => x.includes('autonomy')));

    const duplicateAssignment = execute('duplicate-assignment', { ...source, roster: { ...source.roster, agents: source.roster.agents.map(agent => agent.id === 'AG-002' ? { ...agent, primaryWorkflowIds: [...agent.primaryWorkflowIds, 'A-012'] } : agent) } });
    assert.strictEqual(duplicateAssignment.status, 1); assert(duplicateAssignment.output.failures.some(x => x.includes('exactly one primary agent')));

    const missingAssignment = execute('missing-assignment', { ...source, roster: { ...source.roster, agents: source.roster.agents.map(agent => ({ ...agent, primaryWorkflowIds: agent.primaryWorkflowIds.filter(id => id !== 'A-016') })) } });
    assert.strictEqual(missingAssignment.status, 1); assert(missingAssignment.output.failures.some(x => x.includes('exactly one primary agent')));

    const agentAuthority = execute('agent-authority', { ...source, roster: { ...source.roster, agents: source.roster.agents.map(agent => agent.id === 'AG-001' ? { ...agent, mayExecuteExternalActions: true } : agent) } });
    assert.strictEqual(agentAuthority.status, 1); assert(agentAuthority.output.failures.some(x => x.includes('mayExecuteExternalActions')));

    const rosterAuthority = execute('roster-authority', { ...source, roster: { ...source.roster, authority: { ...source.roster.authority, externalActionsAuthorized: true } } });
    assert.strictEqual(rosterAuthority.status, 1); assert(rosterAuthority.output.failures.some(x => x.includes('roster authority')));

    const missingEvaluation = execute('missing-evaluation', { ...source, catalog: { ...source.catalog, workflows: source.catalog.workflows.filter(item => item.workflowId !== 'A-017') } });
    assert.strictEqual(missingEvaluation.status, 1); assert(missingEvaluation.output.failures.some(x => x.includes('evaluation-catalog')));

    const evaluationBinding = execute('evaluation-binding', evaluation('A-030', { implementationPath: 'scripts/company/other.cjs' }));
    assert.strictEqual(evaluationBinding.status, 1); assert(evaluationBinding.output.failures.some(x => x.includes('binding drifted')));

    const evaluationNetwork = execute('evaluation-network', evaluation('A-012', { networkAccessPermitted: true }));
    assert.strictEqual(evaluationNetwork.status, 1); assert(evaluationNetwork.output.failures.some(x => x.includes('networkAccessPermitted')));

    const evaluationPromotion = execute('evaluation-promotion', evaluation('A-015', { promotionEligible: true }));
    assert.strictEqual(evaluationPromotion.status, 1); assert(evaluationPromotion.output.failures.some(x => x.includes('promotionEligible')));

    const write = execute('write', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-001', { mayWrite: true }) })));
    assert.strictEqual(write.status, 1); assert(write.output.failures.some(x => x.includes('mayWrite')));

    const credential = execute('credential', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-002', { mayUseCredentials: true }) })));
    assert.strictEqual(credential.status, 1); assert(credential.output.failures.some(x => x.includes('mayUseCredentials')));

    const external = execute('external', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-003', { mayCauseExternalAction: true }) })));
    assert.strictEqual(external.status, 1); assert(external.output.failures.some(x => x.includes('mayCauseExternalAction')));

    const spend = execute('spend', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-004', { spendMinorUnits: 1 }) })));
    assert.strictEqual(spend.status, 1); assert(spend.output.failures.some(x => x.includes('retries and spend')));

    const timeout = execute('timeout', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-001', { timeoutSeconds: 121 }) })));
    assert.strictEqual(timeout.status, 1); assert(timeout.output.failures.some(x => x.includes('timeout')));

    const retry = execute('retry', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-002', { retryCount: 1 }) })));
    assert.strictEqual(retry.status, 1); assert(retry.output.failures.some(x => x.includes('retries and spend')));

    const network = execute('network', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-003', { networkMode: 'unrestricted' }) })));
    assert.strictEqual(network.status, 1); assert(network.output.failures.some(x => x.includes('network mode')));

    const exitCodes = execute('exit-codes', withCadence(c => ({ ...c, calendarSchedules: schedule('OC-004', { expectedExitCodes: [0] }) })));
    assert.strictEqual(exitCodes.status, 1); assert(exitCodes.output.failures.some(x => x.includes('expectedExitCodes')));

    const command = execute('command', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-004' ? { ...item, command: ['scripts/company/compile-weekly-review.cjs'] } : item) })));
    assert.strictEqual(command.status, 1); assert(command.output.failures.some(x => x.includes('command')));

    const duplicateId = execute('duplicate-id', withCadence(c => ({ ...c, eventTriggerPlans: c.eventTriggerPlans.map(item => item.id === 'OT-004' ? { ...item, id: 'OT-003' } : item) })));
    assert.strictEqual(duplicateId.status, 1); assert(duplicateId.output.failures.some(x => x.includes('IDs and order') || x.includes('unique')));

    console.log('A-042 cadence work-packet evaluations passed (29 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
