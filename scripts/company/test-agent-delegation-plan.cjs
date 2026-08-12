#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const plannerPath = path.join(__dirname, 'build-agent-delegation-plan.cjs');
const queue = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/objectives.json'), 'utf8'));
const roster = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/agent-roster.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a024-'));

function write(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    return target;
}

function execute(name, queueValue = queue, rosterValue = roster) {
    const result = spawnSync(process.execPath, [plannerPath, write(`${name}-queue`, queueValue), write(`${name}-roster`, rosterValue)], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function updateAction(source, id, changes) {
    return {
        ...source,
        objectives: source.objectives.map(objective => ({
            ...objective,
            actions: objective.actions.map(action => action.id === id ? { ...action, ...changes } : action)
        }))
    };
}

function updateAgent(source, id, changes) {
    return {
        ...source,
        agents: source.agents.map(agent => agent.id === id ? { ...agent, ...changes } : agent)
    };
}

try {
    const baseline = execute('baseline');
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.planValid, true);
    assert.strictEqual(baseline.output.readyInternalActionCount, 0);
    assert.strictEqual(baseline.output.workOrderCount, 0);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);

    const oneReady = execute('one-ready', updateAction(queue, 'OA-002', { status: 'ready' }));
    assert.strictEqual(oneReady.status, 2);
    assert.strictEqual(oneReady.output.planValid, true);
    assert.strictEqual(oneReady.output.workOrderCount, 1);
    assert.strictEqual(oneReady.output.workOrders[0].actionId, 'OA-002');
    assert.strictEqual(oneReady.output.workOrders[0].primaryAgentId, 'AG-007');
    assert.strictEqual(oneReady.output.workOrders[0].evaluatorAgentId, 'AG-010');
    assert.strictEqual(oneReady.output.workOrders[0].constraints.externalActionAllowed, false);
    assert.strictEqual(oneReady.output.workOrders[0].constraints.automatedDispatchAuthorized, false);
    assert.strictEqual(oneReady.output.workOrders[0].constraints.spendMinorUnits, 0);

    const externalAction = execute('external-action', updateAction(queue, 'OA-002', { status: 'ready', externalActionAllowed: true }));
    assert.strictEqual(externalAction.status, 1);
    assert(externalAction.output.failures.some(failure => failure.includes('externalActionAllowed')));

    const kevinDecision = execute('kevin-decision', updateAction(queue, 'OA-011', { status: 'ready' }));
    assert.strictEqual(kevinDecision.status, 2);
    assert.strictEqual(kevinDecision.output.prohibitedModeReadyCount, 1);
    assert.strictEqual(kevinDecision.output.workOrderCount, 0);

    const unknownWorkflow = execute('unknown-workflow', updateAction(queue, 'OA-002', { status: 'ready', referenceIds: ['A-999'] }));
    assert.strictEqual(unknownWorkflow.status, 1);
    assert(unknownWorkflow.output.failures.some(failure => failure.includes('unknown automation A-999')));

    const duplicatePrimary = execute('duplicate-primary', updateAction(queue, 'OA-002', { status: 'ready' }), updateAgent(roster, 'AG-001', {
        primaryWorkflowIds: [...roster.agents.find(agent => agent.id === 'AG-001').primaryWorkflowIds, 'A-001']
    }));
    assert.strictEqual(duplicatePrimary.status, 1);
    assert(duplicatePrimary.output.failures.some(failure => failure.includes('A-001 must have exactly one primary agent')));

    const externalAgent = execute('external-agent', queue, updateAgent(roster, 'AG-007', { mayExecuteExternalActions: true }));
    assert.strictEqual(externalAgent.status, 1);
    assert(externalAgent.output.failures.some(failure => failure.includes('mayExecuteExternalActions')));

    const multiAgent = execute('multi-agent', updateAction(queue, 'OA-002', { status: 'ready', referenceIds: ['A-001', 'A-022'] }));
    assert.strictEqual(multiAgent.status, 2);
    assert.strictEqual(multiAgent.output.workOrderCount, 0);
    assert.strictEqual(multiAgent.output.blockedReadyActionCount, 1);
    assert.strictEqual(multiAgent.output.blockedReadyActions[0].reason, 'multiple_primary_agents_require_decomposition');

    const completed = execute('completed');
    assert.strictEqual(completed.output.workOrders.some(order => order.actionId === 'OA-035'), false);

    console.log('A-024 agent delegation plan evaluations passed (9 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

