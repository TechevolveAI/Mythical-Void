#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const reviewPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/PROJECT_BEACON_CHOICE_PROOF_REVIEW.json');
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
    ['GP-016', { filename: 'project-beacon-priority-choice.png', width: 1440, height: 810 }],
    ['GP-017', { filename: 'project-beacon-priority-choice-phone.png', width: 390, height: 844 }]
]);
const captures = (review.captureIds || []).map(id => manifest.captures?.find(capture => capture.id === id));

requireValue(review.schemaVersion === 1, 'Review schemaVersion must be 1.');
requireValue(review.reviewState === 'authentic_spoiler_safe_supporting_proof_ready_for_kevin_review', 'Choice proof must remain spoiler-safe and waiting for Kevin review.');
requireValue(review.publicUseApproved === false, 'Public use must remain unapproved.');
requireValue(review.captureIds?.length === 2 && captures.every(Boolean), 'Review must reference both choice captures.');
for (const capture of captures.filter(Boolean)) {
    const expectation = expected.get(capture.id);
    const file = path.join(root, 'public/press/gameplay', capture.filename);
    requireValue(capture.filename === expectation?.filename, `${capture.id} has the wrong filename.`);
    requireValue(capture.width === expectation?.width && capture.height === expectation?.height, `${capture.id} has the wrong reviewed dimensions.`);
    requireValue(capture.classification === 'authentic_running_build_screenshot', `${capture.id} must remain a running-build screenshot.`);
    requireValue(capture.fixture === 'company_controlled_qa_state_no_personal_data', `${capture.id} must retain its no-personal-data fixture.`);
    requireValue(capture.sourceCommit === review.sourceCommit, `${capture.id} and review source commits must match.`);
    requireValue(fs.existsSync(file) && digest(file) === capture.sha256, `${capture.id} fingerprint must match its file.`);
}
requireValue((review.qualityStrengths || []).length === 4, 'Choice review must retain four visible strengths.');
requireValue((review.qualityIssues || []).length === 2, 'Choice review must retain both visible limitations.');
requireValue((review.allowedClaims || []).length === 4, 'Choice review must retain exactly four narrow allowed claims.');
requireValue((review.claimsNotAllowed || []).length >= 5, 'Choice review must retain at least five explicit non-claims.');
requireValue((review.approvalChecklist || []).length === 5, 'Choice review must retain five approval checks.');
requireValue(/must not show confirmation screens, epilogue pages, consequences/i.test(review.spoilerBoundary || ''), 'Spoiler boundary must exclude confirmations, epilogues and consequences.');
requireValue(/nothing is published until Kevin approves/i.test(review.nextCompanyAction || ''), 'Kevin approval boundary must remain explicit.');

const text = JSON.stringify(review);
requireValue(!/\bcompanions?\b/i.test(text), 'Review must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(text), 'Review must not promise absolute uniqueness.');

if (errors.length) {
    console.error(`Project Beacon choice proof validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Project Beacon choice proof valid: ${captures.length} authentic responsive frames, spoiler-safe, waiting for Kevin review.`);
