#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const reviewPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/HATCH_REVEAL_PROOF_REVIEW.json');
const manifestPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'public/press/gameplay/manifest.json');
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

const capture = manifest.captures?.find(item => item.id === review.captureId);
const capturePath = path.resolve(root, review.capturePath || '');
const actualHash = fs.existsSync(capturePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(capturePath)).digest('hex')
    : null;
const issueIds = new Set((review.qualityIssues || []).map(issue => issue.id));

requireValue(review.schemaVersion === 1, 'Review schemaVersion must be 1.');
requireValue(review.reviewState === 'authentic_internal_proof_rejected_for_public_promotion', 'The current reveal must remain rejected for public promotion.');
requireValue(review.publicUseApproved === false, 'Public use must remain unapproved.');
requireValue(capture?.filename === 'creature-cosmic-egg-reveal.png', 'Review must reference the authentic reveal capture.');
requireValue(capture?.classification === 'authentic_running_build_screenshot', 'Reveal must remain classified as a running-build screenshot.');
requireValue(capture?.fixture === 'company_controlled_qa_state_no_personal_data', 'Reveal must retain its no-personal-data fixture.');
requireValue(capture?.width === 1440 && capture?.height === 810, 'Reveal must retain the reviewed 1440 by 810 frame.');
requireValue(capture?.sourceCommit === review.sourceCommit, 'Review and manifest source commits must match.');
requireValue(actualHash !== null && actualHash === capture?.sha256, 'Reveal file fingerprint must match the manifest.');
requireValue(['HQ-001', 'HQ-002', 'HQ-003', 'HQ-004'].every(id => issueIds.has(id)), 'All four observed quality issues must remain recorded.');
requireValue((review.gameDevelopmentHandoff?.acceptanceChecks || []).length === 5, 'Game Development handoff must retain five acceptance checks.');
requireValue(/do not place it in launch posts or press downloads/i.test(review.nextCompanyAction || ''), 'The company action must explicitly withhold the frame from launch and press use.');

const text = JSON.stringify(review);
requireValue(!/\bcompanions?\b/i.test(text), 'Review must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(text), 'Review must not promise absolute uniqueness.');

if (errors.length) {
    console.error(`Hatch reveal proof validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Hatch reveal proof valid: ${capture.id} is authentic, ${review.qualityIssues.length} quality issues recorded, public promotion refused.`);
