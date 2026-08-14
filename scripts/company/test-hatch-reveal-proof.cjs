#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-hatch-reveal-proof.cjs');
const sourceReview = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/HATCH_REVEAL_PROOF_REVIEW.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-hatch-proof-'));

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
    if (run('valid', sourceReview).status !== 0) throw new Error('Valid hatch reveal review was rejected.');

    const falseApproval = { ...sourceReview, publicUseApproved: true };
    if (run('false-approval', falseApproval).status === 0) throw new Error('False public approval was accepted.');

    const missingIssue = structuredClone(sourceReview);
    missingIssue.qualityIssues = missingIssue.qualityIssues.filter(issue => issue.id !== 'HQ-003');
    if (run('missing-issue', missingIssue).status === 0) throw new Error('A missing visible quality issue was accepted.');

    const wrongHash = structuredClone(sourceManifest);
    wrongHash.captures.find(capture => capture.id === sourceReview.captureId).sha256 = '0'.repeat(64);
    if (run('wrong-hash', sourceReview, wrongHash).status === 0) throw new Error('A false capture fingerprint was accepted.');

    console.log('Hatch reveal proof tests passed: valid review plus 3 truth and release mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
