#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-science-week-educator-review.cjs');
const sourceReview = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_2026.json'), 'utf8'));
const sourceChecklist = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_2026.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-science-week-review-'));

function run(name, review = sourceReview, checklist = sourceChecklist) {
    const reviewFile = path.join(temp, `${name}-review.json`);
    const checklistFile = path.join(temp, `${name}-checklist.md`);
    fs.writeFileSync(reviewFile, `${JSON.stringify(review, null, 2)}\n`);
    fs.writeFileSync(checklistFile, checklist);
    return spawnSync(process.execPath, [validator, reviewFile, checklistFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid educator review packet was rejected.');

    const childTest = structuredClone(sourceReview);
    childTest.authority.childTestingAuthorized = true;
    if (run('child-test', childTest).status === 0) throw new Error('Child testing was accepted.');

    const contactCollection = structuredClone(sourceReview);
    contactCollection.authority.reviewerContactDataCollectionAuthorized = true;
    if (run('contact-collection', contactCollection).status === 0) throw new Error('Reviewer contact-data collection was accepted.');

    const earlyRelease = structuredClone(sourceReview);
    earlyRelease.readiness.publicReleaseReady = true;
    if (run('early-release', earlyRelease).status === 0) throw new Error('An unreviewed public release was accepted.');

    const oneReviewer = structuredClone(sourceReview);
    oneReviewer.completionGate.minimumIndependentAdultReviews = 1;
    if (run('one-reviewer', oneReviewer).status === 0) throw new Error('A one-reviewer release gate was accepted.');

    const inventedReview = structuredClone(sourceReview);
    inventedReview.reviewLog.push({ reviewerCode: 'R01', outcome: 'ready' });
    if (run('invented-review', inventedReview).status === 0) throw new Error('An invented completed review was accepted.');

    console.log('Science Week educator review tests passed: valid packet plus 5 child-safety, privacy, release and evidence mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
