#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-agent-roster.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/agent-roster.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a023-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceAgent(id, changes) {
    return source.agents.map(agent => agent.id === id ? { ...agent, ...changes(agent) } : agent);
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.rosterValid, true);
    assert.strictEqual(baseline.output.operatingModelReady, false);
    assert.strictEqual(baseline.output.agentCount, 11);
    assert.strictEqual(baseline.output.requiredFunctionCount, 13);
    assert.strictEqual(baseline.output.coveredFunctionCount, 13);
    assert.strictEqual(baseline.output.registeredWorkflowCount, 58);
    assert.strictEqual(baseline.output.assignedWorkflowCount, 58);
    assert.strictEqual(baseline.output.externalActionsAuthorized, false);

    const uncoveredFunction = execute('uncovered-function', {
        ...source,
        agents: replaceAgent('AG-002', agent => ({ functions: agent.functions.filter(name => name !== 'strategy_market_intelligence') }))
    });
    assert.strictEqual(uncoveredFunction.status, 1);
    assert(uncoveredFunction.output.failures.some(failure => failure.includes('no agent covers required function strategy_market_intelligence')));

    const unknownWorkflow = execute('unknown-workflow', {
        ...source,
        agents: replaceAgent('AG-001', agent => ({ primaryWorkflowIds: [...agent.primaryWorkflowIds, 'A-999'] }))
    });
    assert.strictEqual(unknownWorkflow.status, 1);
    assert(unknownWorkflow.output.failures.some(failure => failure.includes('unknown workflow A-999')));

    const duplicateAssignment = execute('duplicate-assignment', {
        ...source,
        agents: replaceAgent('AG-001', agent => ({ primaryWorkflowIds: [...agent.primaryWorkflowIds, 'A-001'] }))
    });
    assert.strictEqual(duplicateAssignment.status, 1);
    assert(duplicateAssignment.output.failures.some(failure => failure.includes('multiple primary agents')));

    const externalAuthority = execute('external-authority', {
        ...source,
        authority: { ...source.authority, externalActionsAuthorized: true }
    });
    assert.strictEqual(externalAuthority.status, 1);
    assert(externalAuthority.output.failures.some(failure => failure.includes('externalActionsAuthorized')));

    const selfApproval = execute('self-approval', {
        ...source,
        agents: replaceAgent('AG-003', () => ({ mayApproveOwnWork: true }))
    });
    assert.strictEqual(selfApproval.status, 1);
    assert(selfApproval.output.failures.some(failure => failure.includes('mayApproveOwnWork')));

    const moneyMovement = execute('money-movement', {
        ...source,
        agents: replaceAgent('AG-009', () => ({ mayMoveMoney: true }))
    });
    assert.strictEqual(moneyMovement.status, 1);
    assert(moneyMovement.output.failures.some(failure => failure.includes('mayMoveMoney')));

    const conflictedDuties = execute('conflicted-duties', {
        ...source,
        separationOfDuties: source.separationOfDuties.map((rule, index) => index === 0 ? { ...rule, evaluatorAgentId: rule.producerAgentId } : rule)
    });
    assert.strictEqual(conflictedDuties.status, 1);
    assert(conflictedDuties.output.failures.some(failure => failure.includes('producer and evaluator must differ')));

    const conversationApproval = execute('conversation-approval', {
        ...source,
        kevinInterface: { ...source.kevinInterface, conversationIsAuthorization: true }
    });
    assert.strictEqual(conversationApproval.status, 1);
    assert(conversationApproval.output.failures.some(failure => failure.includes('conversationIsAuthorization')));

    console.log('A-023 agent roster evaluations passed (9 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
