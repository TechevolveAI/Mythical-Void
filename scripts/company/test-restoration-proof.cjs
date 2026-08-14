#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-restoration-proof.cjs');
const sourceReview = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/RESTORATION_PROOF_REVIEW.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-restoration-proof-'));

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
    if (run('valid', sourceReview).status !== 0) throw new Error('Valid restoration review was rejected.');

    const falseApproval = { ...sourceReview, publicUseApproved: true };
    if (run('false-approval', falseApproval).status === 0) throw new Error('False public approval was accepted.');

    const missingBoundary = { ...sourceReview, captureBoundary: 'Authentic screenshots.' };
    if (run('missing-boundary', missingBoundary).status === 0) throw new Error('A hidden staging boundary was accepted.');

    const wrongHash = structuredClone(sourceManifest);
    wrongHash.captures.find(capture => capture.id === 'GP-015').sha256 = '0'.repeat(64);
    if (run('wrong-hash', sourceReview, wrongHash).status === 0) throw new Error('A false restored-frame fingerprint was accepted.');

    console.log('Restoration proof tests passed: valid review plus 3 truth and release mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
