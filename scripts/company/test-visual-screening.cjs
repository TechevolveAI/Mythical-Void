#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-visual-screening.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/visual-screening-2026-08-27.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-visual-screening-'));

function run(name, mutate = () => {}) {
    const candidate = structuredClone(source);
    mutate(candidate);
    const file = path.join(temporary, `${name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(candidate, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, file], { cwd: root, encoding: 'utf8' });
}

try {
    assert.strictEqual(run('valid').status, 0);
    assert.notStrictEqual(run('fake-approval', value => { value.moments[0].decision = 'approved'; }).status, 0);
    assert.notStrictEqual(run('fake-count', value => { value.approvedMomentCount = 4; }).status, 0);
    assert.notStrictEqual(run('send-to-kevin', value => { value.boundary.kevinReviewRequested = true; }).status, 0);
    assert.notStrictEqual(run('public-directory', value => { value.source.candidateDirectory = 'public/review/'; }).status, 0);
    assert.notStrictEqual(run('mismatched-run-directory', value => { value.source.candidateRunId = 'different-run'; }).status, 0);
    assert.notStrictEqual(run('malformed-screening-id', value => { value.screeningId = 'latest'; }).status, 0);
    assert.notStrictEqual(run('external-publication', value => { value.boundary.externalPublicationAuthorized = true; }).status, 0);
    assert.notStrictEqual(run('skip-frame-review', value => { value.videoFrameReview.everyCapturedFrameScreened = false; }).status, 0);
    assert.notStrictEqual(run('hide-capture-failure', value => {
        value.captureFailure.capturedFrames = value.captureFailure.requiredMinimumFrames;
        value.captureFailure.capturedDurationSeconds = value.captureFailure.requiredMinimumDurationSeconds;
    }).status, 0);
    assert.notStrictEqual(run('remove-recapture-direction', value => { value.moments[2].nextCaptureMustShow = ''; }).status, 0);
    console.log('Visual screening safeguards passed (current record and 10 rejection cases).');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
