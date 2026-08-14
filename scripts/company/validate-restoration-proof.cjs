#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const reviewPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/RESTORATION_PROOF_REVIEW.json');
const manifestPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'public/press/gameplay/manifest.json');
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const expected = new Map([
    ['GP-014', 'guardian-void-empress-corrupted.png'],
    ['GP-015', 'guardian-void-empress-restored.png']
]);
const captures = (review.captureIds || []).map(id => (
    manifest.captures?.find(capture => capture.id === id)
));
const issueIds = new Set((review.qualityIssues || []).map(issue => issue.id));

requireValue(review.schemaVersion === 1, 'Review schemaVersion must be 1.');
requireValue(review.reviewState === 'authentic_supporting_proof_not_approved_as_lead_world_change', 'Restoration pair must remain supporting proof, not lead proof.');
requireValue(review.publicUseApproved === false, 'Public use must remain unapproved.');
requireValue(review.captureIds?.length === 2 && captures.every(Boolean), 'Review must reference both restoration captures.');
for (const capture of captures.filter(Boolean)) {
    const expectedFilename = expected.get(capture.id);
    const file = path.join(root, 'public/press/gameplay', capture.filename);
    requireValue(capture.filename === expectedFilename, `${capture.id} has the wrong filename.`);
    requireValue(capture.classification === 'authentic_running_build_screenshot', `${capture.id} must remain a running-build screenshot.`);
    requireValue(capture.fixture === 'company_controlled_qa_state_no_personal_data', `${capture.id} must retain its no-personal-data fixture.`);
    requireValue(capture.width === 390 && capture.height === 844, `${capture.id} must retain the reviewed phone frame.`);
    requireValue(capture.sourceCommit === review.sourceCommit, `${capture.id} and review source commits must match.`);
    requireValue(fs.existsSync(file) && digest(file) === capture.sha256, `${capture.id} fingerprint must match its file.`);
}
requireValue(['RQ-001', 'RQ-002', 'RQ-003', 'RQ-004'].every(id => issueIds.has(id)), 'All four restoration quality issues must remain recorded.');
requireValue((review.allowedClaims || []).length === 3, 'Restoration review must retain exactly three narrow allowed claims.');
requireValue((review.claimsNotAllowed || []).length >= 5, 'Restoration review must retain at least five explicit non-claims.');
requireValue(/not a continuous player journey/i.test(review.captureBoundary || ''), 'The staged non-continuous capture boundary must remain explicit.');
requireValue(/do not use the pair as the lead proof/i.test(review.nextCompanyAction || ''), 'The company action must withhold the pair from lead promotion.');
requireValue((review.gameDevelopmentHandoff?.acceptanceChecks || []).length === 5, 'Game Development handoff must retain five acceptance checks.');

const text = JSON.stringify(review);
requireValue(!/\bcompanions?\b/i.test(text), 'Review must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(text), 'Review must not promise absolute uniqueness.');

if (errors.length) {
    console.error(`Restoration proof validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Restoration proof valid: ${captures.length} authentic phone frames, ${review.qualityIssues.length} quality issues, lead promotion refused.`);
