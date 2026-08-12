#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-evaluation-catalog.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/evaluation-catalog.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a036-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replace(id, changes) {
    return { ...source, workflows: source.workflows.map(item => item.workflowId === id ? { ...item, ...changes } : item) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.evaluationCatalogValid, true);
    assert.strictEqual(baseline.output.coverageComplete, true);
    assert.strictEqual(baseline.output.registeredWorkflowCount, 58);
    assert.strictEqual(baseline.output.coveredWorkflowCount, 58);
    assert.strictEqual(baseline.output.missingEvaluatorCount, 0);
    assert.strictEqual(baseline.output.totalDocumentedCaseCount, 921);
    assert.strictEqual(baseline.output.networkEnabledEvaluatorCount, 0);
    assert.strictEqual(baseline.output.eligiblePromotionCycleCount, 0);
    assert.strictEqual(baseline.output.promotionEligibleWorkflowCount, 0);

    const authority = execute('authority', { ...source, authority: { ...source.authority, workflowPromotionAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(item => item.includes('workflowPromotionAuthorized')));

    const duplicate = execute('duplicate', { ...source, workflows: source.workflows.map(item => item.workflowId === 'A-036' ? { ...item, workflowId: 'A-035' } : item) });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(item => item.includes('duplicate evaluation')));

    const missing = execute('missing', { ...source, workflows: source.workflows.filter(item => item.workflowId !== 'A-036') });
    assert.strictEqual(missing.status, 1);
    assert(missing.output.failures.some(item => item.includes('missing evaluation for A-036')));

    const unknown = execute('unknown', { ...source, workflows: source.workflows.map(item => item.workflowId === 'A-036' ? { ...item, workflowId: 'A-999' } : item) });
    assert.strictEqual(unknown.status, 1);
    assert(unknown.output.failures.some(item => item.includes('not a registered workflow')));

    const version = execute('version', replace('A-035', { workflowVersion: 2 }));
    assert.strictEqual(version.status, 1);
    assert(version.output.failures.some(item => item.includes('workflowVersion')));

    const implementation = execute('implementation', replace('A-034', { implementationPath: 'scripts/company/other.cjs' }));
    assert.strictEqual(implementation.status, 1);
    assert(implementation.output.failures.some(item => item.includes('implementationPath')));

    const evaluator = execute('evaluator', replace('A-033', { evaluatorPath: 'scripts/company/test-missing.cjs' }));
    assert.strictEqual(evaluator.status, 1);
    assert(evaluator.output.failures.some(item => item.includes('missing or outside')));

    const outside = execute('outside', replace('A-032', { evaluatorPath: '../test-outside.cjs' }));
    assert.strictEqual(outside.status, 1);
    assert(outside.output.failures.some(item => item.includes('company test script')));

    const cases = execute('cases', replace('A-031', { documentedCaseCount: 0 }));
    assert.strictEqual(cases.status, 1);
    assert(cases.output.failures.some(item => item.includes('documentedCaseCount')));

    const result = execute('result', replace('A-030', { lastResult: 'failed' }));
    assert.strictEqual(result.status, 1);
    assert(result.output.failures.some(item => item.includes('current passed result')));

    const cycles = execute('cycles', replace('A-029', { eligibleCyclesCompleted: 1 }));
    assert.strictEqual(cycles.status, 1);
    assert(cycles.output.failures.some(item => item.includes('promotion-cycle evidence')));

    const promotion = execute('promotion', replace('A-028', { promotionEligible: true }));
    assert.strictEqual(promotion.status, 1);
    assert(promotion.output.failures.some(item => item.includes('promotionEligible')));

    console.log('A-036 evaluation-catalog evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
