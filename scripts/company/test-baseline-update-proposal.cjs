#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const proposalPath = path.join(__dirname, 'propose-control-plane-baseline-update.cjs');
const baseline = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'operations', 'control-plane-baseline.json'),
    'utf8'
));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a017-'));

function source(overrides = {}) {
    return {
        workflow: 'A-015',
        comparisonValid: true,
        baselineCapturedAt: baseline.capturedAt,
        currentCapturedAt: '2026-08-11T12:00:00.000Z',
        changeCount: 0,
        severityCounts: {},
        alertRequired: false,
        humanReviewRecommended: false,
        externalActionAuthorized: false,
        failures: [],
        changes: [],
        currentSnapshot: { ...baseline, capturedAt: '2026-08-11T12:00:00.000Z' },
        ...overrides
    };
}

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [proposalPath, '--input', target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const unchanged = execute('unchanged', source());
    assert.strictEqual(unchanged.status, 0);
    assert.strictEqual(unchanged.output.proposalRequired, false);
    assert.strictEqual(unchanged.output.baselineWritten, false);

    const improvementChange = {
        id: 'CHG-RISK-R-001-STATUS',
        severity: 'informational',
        category: 'risk',
        message: 'Risk status changed.',
        before: 'open',
        after: 'mitigated'
    };
    const improvement = execute('improvement', source({
        changeCount: 1,
        severityCounts: { informational: 1 },
        changes: [improvementChange],
        currentSnapshot: {
            ...baseline,
            capturedAt: '2026-08-11T12:00:00.000Z',
            riskStates: { ...baseline.riskStates, 'R-001': { severity: 'critical', status: 'mitigated' } }
        }
    }));
    assert.strictEqual(improvement.status, 2);
    assert.strictEqual(improvement.output.proposalEligible, true);
    assert.strictEqual(improvement.output.baselineUpdateAuthorized, false);
    assert(improvement.output.candidateSnapshot);

    const regressionChange = {
        id: 'CHG-PUBLIC-MAJOR',
        severity: 'high',
        category: 'public_footprint',
        message: 'Major findings increased.',
        before: 7,
        after: 8
    };
    const regression = execute('regression', source({
        changeCount: 1,
        severityCounts: { high: 1 },
        alertRequired: true,
        humanReviewRecommended: true,
        changes: [regressionChange]
    }));
    assert.strictEqual(regression.status, 2);
    assert.strictEqual(regression.output.proposalEligible, false);
    assert.strictEqual(regression.output.candidateSnapshot, null);
    assert.strictEqual(regression.output.unsafeChangeCount, 1);

    const mediumChange = {
        id: 'CHG-CONTROL-A-003',
        severity: 'medium',
        category: 'control',
        message: 'Control became gated.',
        before: 'passed',
        after: 'gated'
    };
    const review = execute('review', source({
        changeCount: 1,
        severityCounts: { medium: 1 },
        humanReviewRecommended: true,
        changes: [mediumChange]
    }));
    assert.strictEqual(review.status, 2);
    assert.strictEqual(review.output.proposalEligible, false);
    assert.strictEqual(review.output.reviewChangeCount, 1);

    const authorization = execute('authorization', source({
        changeCount: 1,
        severityCounts: { critical: 1 },
        alertRequired: true,
        humanReviewRecommended: true,
        changes: [{
            id: 'CHG-AUTH',
            severity: 'critical',
            category: 'authorization',
            message: 'External action became authorized.',
            before: false,
            after: true
        }],
        currentSnapshot: { ...baseline, capturedAt: '2026-08-11T12:00:00.000Z', externalActionAuthorized: true }
    }));
    assert.strictEqual(authorization.status, 1);
    assert.strictEqual(authorization.output.proposalEligible, false);
    assert(authorization.output.failures.some(failure => failure.includes('externalActionAuthorized=true')));

    console.log('A-017 baseline-update proposal evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
