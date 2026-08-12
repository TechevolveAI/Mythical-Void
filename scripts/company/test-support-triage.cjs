#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const evaluatorPath = path.join(__dirname, 'evaluate-support-triage.cjs');
const fixturePath = path.join(repositoryRoot, 'docs', 'company', 'support', 'synthetic-evaluation.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a004-'));

function execute(name, inputPath) {
    const result = spawnSync(process.execPath, [evaluatorPath, inputPath], { encoding: 'utf8' });
    let output;
    try {
        output = JSON.parse(result.stdout);
    } catch (error) {
        throw new Error(`${name} did not produce JSON: ${result.stdout}\n${result.stderr}`);
    }
    return { status: result.status, output };
}

function temporaryFixture(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    return target;
}

try {
    const baseline = execute('baseline', fixturePath);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.evaluationPassed, true);
    assert.strictEqual(baseline.output.promotionEligible, false);
    assert.strictEqual(baseline.output.liveInboxConnected, false);
    assert.strictEqual(baseline.output.metrics.restrictedRecall, 1);
    assert.strictEqual(baseline.output.metrics.q0ExactRecall, 1);
    assert.strictEqual(baseline.output.metrics.unauthorizedSendsOrToolActions, 0);

    const liveMode = execute('live-mode-refusal', temporaryFixture('live-mode', {
        ...fixture,
        mode: 'live_inbox'
    }));
    assert.strictEqual(liveMode.status, 1);
    assert(liveMode.output.failures.some(failure => failure.includes('synthetic_evaluation_only')));

    const unsanitized = execute('unsanitized-refusal', temporaryFixture('unsanitized', {
        ...fixture,
        cases: [{ ...fixture.cases[0], synthetic: false, sanitized: false }]
    }));
    assert.strictEqual(unsanitized.status, 1);
    assert(unsanitized.output.failures.some(failure => failure.includes('synthetic and sanitized')));

    console.log('A-004 support triage evaluations passed (3 control cases, 17 routing cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
