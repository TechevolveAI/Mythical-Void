#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-objective-action-queue.cjs');
const queuePath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'objectives.json');
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a014-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', queue);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.queueValid, true);
    assert.strictEqual(baseline.output.externalActionsAuthorized, false);
    assert.strictEqual(baseline.output.objectiveCount, 12);
    assert.strictEqual(baseline.output.actionCount, 73);
    assert.strictEqual(baseline.output.nextBestAction, null);
    assert.strictEqual(baseline.output.completedActionCount, 44);
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-026'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-028'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-030'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-033'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-036'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-042'));
    assert(baseline.output.kevinQueue.some(action => action.id === 'OA-011'));
    assert(baseline.output.gameDevelopmentQueue.some(action => action.id === 'OA-007'));
    assert(baseline.output.gameDevelopmentQueue.some(action => action.id === 'OA-043'));

    const external = execute('external', { ...queue, externalActionsAuthorized: true });
    assert.strictEqual(external.status, 1);
    assert(external.output.failures.some(failure => failure.includes('externalActionsAuthorized')));

    const duplicate = execute('duplicate', {
        ...queue,
        objectives: queue.objectives.map((objective, index) => index === 1
            ? { ...objective, actions: [{ ...objective.actions[0], id: 'OA-001' }, ...objective.actions.slice(1)] }
            : objective)
    });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(failure => failure.includes('duplicate action ID')));

    const unknownReference = execute('unknown-reference', {
        ...queue,
        objectives: queue.objectives.map((objective, index) => index === 0
            ? { ...objective, actions: objective.actions.map((action, actionIndex) => actionIndex === 0
                ? { ...action, referenceIds: [...action.referenceIds, 'D-999'] }
                : action) }
            : objective)
    });
    assert.strictEqual(unknownReference.status, 1);
    assert(unknownReference.output.failures.some(failure => failure.includes('D-999')));

    console.log('A-014 objective/action queue evaluations passed (4 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
