#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const builderPath = path.join(__dirname, 'build-company-run-record.cjs');
const baseline = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'operations', 'control-plane-baseline.json'),
    'utf8'
));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a016-'));
const sourcePath = path.join(temporaryDirectory, 'a015.json');

const source = {
    workflow: 'A-015',
    mode: 'read-only snapshot comparison; no alert delivery',
    comparisonValid: true,
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: '2026-08-11T12:00:00.000Z',
    changeCount: 0,
    severityCounts: {},
    alertRequired: false,
    humanReviewRecommended: false,
    externalActionAuthorized: false,
    failures: [],
    changes: []
};
fs.writeFileSync(sourcePath, JSON.stringify(source));

function execute(args) {
    const result = spawnSync(process.execPath, [builderPath, ...args], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const dryRun = execute(['--input', sourcePath]);
    assert.strictEqual(dryRun.status, 0);
    assert.strictEqual(dryRun.output.recordValid, true);
    assert.strictEqual(dryRun.output.recordWritten, false);
    assert.strictEqual(dryRun.output.record.sensitivePayloadIncluded, false);
    assert.strictEqual(dryRun.output.record.externalActionAuthorized, false);

    const written = execute(['--input', sourcePath, '--output-dir', temporaryDirectory]);
    assert.strictEqual(written.status, 0);
    assert.strictEqual(written.output.recordWritten, true);
    assert(fs.existsSync(written.output.outputPath));
    const stored = JSON.parse(fs.readFileSync(written.output.outputPath, 'utf8'));
    assert.strictEqual(stored.recordId, written.output.record.recordId);
    assert.strictEqual(stored.sourceDigestSha256, written.output.record.sourceDigestSha256);

    const replay = execute(['--input', sourcePath, '--output-dir', temporaryDirectory]);
    assert.strictEqual(replay.status, 1);
    assert(replay.output.failures.some(failure => failure.includes('exclusive run-record creation failed')));

    const sensitivePath = path.join(temporaryDirectory, 'sensitive.json');
    fs.writeFileSync(sensitivePath, JSON.stringify({ ...source, rawMessage: 'synthetic but prohibited' }));
    const sensitive = execute(['--input', sensitivePath]);
    assert.strictEqual(sensitive.status, 1);
    assert(sensitive.output.failures.some(failure => failure.includes('rawMessage')));

    const broadTarget = execute(['--input', sourcePath, '--output-dir', path.parse(repositoryRoot).root]);
    assert.strictEqual(broadTarget.status, 1);
    assert(broadTarget.output.failures.some(failure => failure.includes('filesystem or repository root')));

    console.log('A-016 company run-record evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
