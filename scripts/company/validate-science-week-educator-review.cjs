#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const reviewPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_2026.json');
const checklistPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_2026.md');
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const checklist = fs.readFileSync(checklistPath, 'utf8');
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(review.schemaVersion === 1, 'Educator review schemaVersion must be 1.');
requireValue(review.state === 'internal_review_packet_ready_no_review_completed', 'Educator review must remain an internal unused packet.');
requireValue(review.activityId === 'SCIENCE-WEEK-WATER-001', 'Educator review must remain tied to the Water activity.');
requireValue(review.allowedReviewerTypes?.length === 5 && review.allowedReviewerTypes.every(type => /^adult /i.test(type)), 'Only the five adult reviewer types may be used.');
requireValue(review.reviewRules?.length === 5, 'Review packet must retain its five review rules.');
requireValue(review.criteria?.length === 12 && review.criteria.every((item, index) => item.id === `EDU-${String(index + 1).padStart(2, '0')}`), 'Review packet must retain all twelve ordered criteria.');
requireValue(review.stopConditions?.length === 6, 'Review packet must retain all six stop conditions.');
requireValue(review.completionGate?.minimumIndependentAdultReviews === 2, 'At least two independent adult reviews must remain required.');
requireValue(review.completionGate?.requiredCoverage?.length === 2 && review.completionGate?.allCriteriaMinimumScore === 3, 'Education and science coverage plus a minimum score of three must remain required.');
requireValue(review.completionGate?.allStopConditionsResolved === true && review.completionGate?.kevinApprovalStillRequired === true, 'Stop-condition resolution and Kevin approval must remain required.');
requireValue(Array.isArray(review.reviewLog) && review.reviewLog.length === 0, 'No educator review may be claimed before one is recorded.');

for (const field of ['checklistBuilt', 'feedbackLogBuilt', 'reviewInvitationBuilt']) {
    requireValue(review.readiness?.[field] === true, `${field} must remain true.`);
}
for (const field of ['reviewerCandidatesChosen', 'reviewCompleted', 'changesResolved', 'kevinApproved', 'publicReleaseReady']) {
    requireValue(review.readiness?.[field] === false, `${field} must remain false.`);
}
requireValue(review.invitation?.state === 'one_adult_only_draft_ready_waiting_for_kevin', 'Review system must retain the one unused adult-only invitation.');
requireValue(fs.existsSync(path.resolve(root, review.invitation?.record || '')), 'Structured adult-only invitation must exist.');
requireValue(fs.existsSync(path.resolve(root, review.invitation?.humanReadableDraft || '')), 'Human-readable adult-only invitation must exist.');
for (const field of ['reviewInvitationSendingAuthorized', 'childTestingAuthorized', 'childDataCollectionAuthorized', 'reviewerContactDataCollectionAuthorized', 'publicationAuthorized', 'eventSubmissionAuthorized', 'partnershipClaimAuthorized', 'spendAuthorized', 'externalActionAuthorized']) {
    requireValue(review.authority?.[field] === false, `${field} must remain false.`);
}

const artifactPath = path.resolve(root, review.artifact?.file || '');
requireValue(review.artifact?.pages === 3 && fs.existsSync(artifactPath), 'Review packet must point to the existing three-page activity.');
if (fs.existsSync(artifactPath)) {
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
    requireValue(actualHash === review.artifact?.sha256, 'Review packet must point to the exact reviewed PDF.');
}

const requiredChecklistText = [
    'Do not involve children',
    'A positive review does not approve publication',
    'EDU-12',
    'Internal feedback log',
    'at least two independent adult reviews',
    'Kevin must still approve any release'
];
requireValue(requiredChecklistText.every(text => checklist.includes(text)), 'Human-readable checklist must retain the review, privacy and approval gates.');
requireValue(!/\bcompanions?\b/i.test(checklist), 'Educator review must use creature or organism language.');
requireValue(/Do not add names, emails, phone numbers, schools or organisation contact details/i.test(checklist), 'Feedback log must forbid personal contact details.');

if (errors.length) {
    console.error(`Science Week educator review validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Science Week educator review valid: 12 checks, 2 independent adult reviews required, no child testing, personal-data collection, sending or publication authorized.');
