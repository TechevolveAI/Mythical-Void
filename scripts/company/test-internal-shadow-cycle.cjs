#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const runnerPath = path.join(__dirname, 'run-internal-shadow-cycle.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/shadow-runtime.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a030-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [runnerPath, target], { encoding: 'utf8', timeout: 120000, maxBuffer: 5 * 1024 * 1024 });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function updateStep(index, changes) {
    return { ...source, steps: source.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...changes } : step) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.contractValid, true);
    assert.strictEqual(baseline.output.rehearsalCompleted, true);
    assert.strictEqual(baseline.output.stepCount, 5);
    assert.strictEqual(baseline.output.completedStepCount, 5);
    assert.strictEqual(baseline.output.gatedStepCount, 5);
    assert.strictEqual(baseline.output.brokenStepCount, 0);
    assert.strictEqual(baseline.output.workspaceMutationCount, 0);
    assert.strictEqual(baseline.output.designedProducerEvaluatorSeparation, true);
    assert.strictEqual(baseline.output.runtimeIdentitySeparationProven, false);
    assert.strictEqual(baseline.output.eligiblePromotionCycle, false);
    assert.strictEqual(baseline.output.recordPersisted, false);
    assert.strictEqual(baseline.output.automatedDispatchAuthorized, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    const externalAuthority = execute('external-authority', { ...source, authority: { ...source.authority, externalActionAuthorized: true } });
    assert.strictEqual(externalAuthority.status, 1);
    assert(externalAuthority.output.failures.some(failure => failure.includes('externalActionAuthorized')));

    const dispatch = execute('dispatch', { ...source, authority: { ...source.authority, automatedDispatchAuthorized: true } });
    assert.strictEqual(dispatch.status, 1);
    assert(dispatch.output.failures.some(failure => failure.includes('automatedDispatchAuthorized')));

    const repositoryWrite = execute('repository-write', updateStep(0, { mayWrite: true }));
    assert.strictEqual(repositoryWrite.status, 1);
    assert(repositoryWrite.output.failures.some(failure => failure.includes('mayWrite')));

    const credential = execute('credential', { ...source, runtime: { ...source.runtime, connectedCredentialIds: ['CRED-001'] } });
    assert.strictEqual(credential.status, 1);
    assert(credential.output.failures.some(failure => failure.includes('connectedCredentialIds')));

    const scheduler = execute('scheduler', { ...source, runtime: { ...source.runtime, schedulerConfigured: true } });
    assert.strictEqual(scheduler.status, 1);
    assert(scheduler.output.failures.some(failure => failure.includes('schedulerConfigured')));

    const selfEvaluation = execute('self-evaluation', updateStep(0, { evaluatorAgentId: 'AG-001' }));
    assert.strictEqual(selfEvaluation.status, 1);
    assert(selfEvaluation.output.failures.some(failure => failure.includes('independent evaluator')));

    const unknownWorkflow = execute('unknown-workflow', updateStep(0, { workflowId: 'A-999' }));
    assert.strictEqual(unknownWorkflow.status, 1);
    assert(unknownWorkflow.output.failures.some(failure => failure.includes('unknown workflow')));

    const commandSubstitution = execute('command-substitution', updateStep(0, { command: 'scripts/company/validate-foundations.cjs' }));
    assert.strictEqual(commandSubstitution.status, 1);
    assert(commandSubstitution.output.failures.some(failure => failure.includes('exactly match')));

    const duplicateStep = execute('duplicate-step', { ...source, steps: [source.steps[0], { ...source.steps[0] }, ...source.steps.slice(2)] });
    assert.strictEqual(duplicateStep.status, 1);
    assert(duplicateStep.output.failures.some(failure => failure.includes('duplicate step')));

    const fakePromotion = execute('fake-promotion', { ...source, promotionEvidence: { ...source.promotionEvidence, promotionAuthorized: true, eligibleShadowCycleCount: 4 } });
    assert.strictEqual(fakePromotion.status, 1);
    assert(fakePromotion.output.failures.some(failure => failure.includes('eligibleShadowCycleCount')));
    assert(fakePromotion.output.failures.some(failure => failure.includes('promotionAuthorized')));

    console.log('A-030 internal shadow-cycle evaluations passed (11 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

