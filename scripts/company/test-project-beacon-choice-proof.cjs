#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-project-beacon-choice-proof.cjs');
const sourceReview = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/PROJECT_BEACON_CHOICE_PROOF_REVIEW.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-choice-proof-'));

function run(name, review, manifest = sourceManifest) {
    const reviewPath = path.join(temp, `${name}-review.json`);
    const manifestPath = path.join(temp, `${name}-manifest.json`);
    fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, reviewPath, manifestPath], {
        cwd: root,
        encoding: 'utf8'
    });
}

try {
    if (run('valid', sourceReview).status !== 0) throw new Error('Valid choice review was rejected.');

    const falseApproval = { ...sourceReview, publicUseApproved: true };
    if (run('false-approval', falseApproval).status === 0) throw new Error('False public approval was accepted.');

    const spoilerLeak = { ...sourceReview, spoilerBoundary: 'Show the confirmation and epilogue.' };
    if (run('spoiler-leak', spoilerLeak).status === 0) throw new Error('A spoiler-leaking review was accepted.');

    const wrongHash = structuredClone(sourceManifest);
    wrongHash.captures.find(capture => capture.id === 'GP-016').sha256 = '0'.repeat(64);
    if (run('wrong-hash', sourceReview, wrongHash).status === 0) throw new Error('A false wide-frame fingerprint was accepted.');

    console.log('Project Beacon choice proof tests passed: valid review plus 3 spoiler and release mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
