#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const sourcePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/visual-screening-2026-08-27.json');
const screening = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(screening.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(
    /^VISUAL-SCREEN-\d{4}-\d{2}-\d{2}-\d{2}$/.test(screening.screeningId || ''),
    'screening identity is malformed'
);
requireValue(/^[0-9a-f]{40}$/.test(screening.source?.commit || ''), 'source commit is missing');
requireValue(screening.source?.route === '/play/', 'screening must come from the running game');
requireValue(screening.source?.profileId === 'MV-0813', 'source creature profile drifted');
requireValue(screening.source?.renderer === 'player_facing_phaser_creature_renderer', 'player renderer proof is missing');
requireValue(screening.source?.candidateDirectory?.startsWith('.visual-review/candidates/'), 'candidate directory must remain private');
requireValue(!screening.source?.candidateDirectory?.includes('public/'), 'candidate directory cannot be public');
requireValue(
    screening.source?.candidateDirectory ===
        `.visual-review/candidates/${screening.source?.candidateRunId}/`,
    'candidate run identity must match its private directory'
);
requireValue(/^[0-9a-f]{64}$/.test(screening.source?.manifestSha256 || ''), 'candidate manifest fingerprint is missing');
requireValue(screening.source?.websiteAccessible === false, 'candidate run cannot be website-accessible');

const boundary = screening.boundary || {};
for (const [key, expected] of Object.entries({
    technicalCaptureChecksPassed: true,
    technicalChecksAreVisualApproval: false,
    automationMayRejectObviousFaults: true,
    automationMayApprove: false,
    automatedEditorialFrameReviewCompleted: true,
    kevinReviewRequested: false,
    adultFrameReviewCompleted: false,
    publicReplacementAuthorized: false,
    externalPublicationAuthorized: false,
    externalActionTaken: false
})) requireValue(boundary[key] === expected, `boundary.${key} must be ${expected}`);

requireValue(screening.decision === 'reject_all_before_kevin_review', 'screening must preserve the rejection decision');
requireValue(screening.approvedMomentCount === 0 && screening.requiredMomentCount === 4, 'visual gate must remain 0/4');
requireValue(Number(screening.videoFrameReview?.phoneFramesChecked) > 0, 'phone frame review count is missing');
requireValue(Number(screening.videoFrameReview?.desktopFramesChecked) > 0, 'desktop frame review count is missing');
requireValue(
    screening.videoFrameReview?.totalFramesChecked ===
        screening.videoFrameReview?.phoneFramesChecked +
        screening.videoFrameReview?.desktopFramesChecked &&
    screening.videoFrameReview?.everyCapturedFrameScreened === true,
    'complete video frame screening is missing'
);
requireValue(screening.videoFrameReview?.adultApprovalClaimed === false, 'automated rejection cannot claim adult approval');
const moments = Array.isArray(screening.moments) ? screening.moments : [];
const requiredIds = ['VL-001', 'VL-002', 'VL-003', 'VL-004'];
requireValue(moments.length === 4 && new Set(moments.map(moment => moment.id)).size === 4, 'screening must contain four distinct moments');
for (const id of requiredIds) requireValue(moments.some(moment => moment.id === id), `${id} is missing`);
for (const moment of moments) {
    requireValue(moment.decision === 'rejected', `${moment.id} must remain rejected`);
    requireValue(Array.isArray(moment.filesChecked) && moment.filesChecked.length >= 2, `${moment.id} needs checked phone and desktop files`);
    requireValue(Array.isArray(moment.obviousFaults) && moment.obviousFaults.length >= 3, `${moment.id} needs specific visible faults`);
    requireValue(typeof moment.nextCaptureMustShow === 'string' && moment.nextCaptureMustShow.length >= 80, `${moment.id} needs a useful recapture direction`);
    requireValue(moment.filesChecked.every(file => !file.includes('/') && /\.(?:png|mp4)$/.test(file)), `${moment.id} files must remain inside the private run`);
}

requireValue(screening.captureOutcome?.technicalState === 'passed', 'technical capture outcome must preserve the passing result');
for (const viewport of ['phone', 'desktop']) {
    const capture = screening.captureOutcome?.[viewport];
    requireValue(Number(capture?.width) > 0 && Number(capture?.height) > 0, `${viewport} capture dimensions are missing`);
    requireValue(Number(capture?.frames) >= 72, `${viewport} capture does not preserve the passing frame count`);
    requireValue(Number(capture?.durationSeconds) >= 6, `${viewport} capture does not preserve the passing duration`);
}
requireValue(
    typeof screening.captureOutcome?.meaning === 'string' && screening.captureOutcome.meaning.length >= 80,
    'capture outcome needs a plain explanation of the remaining visual failure'
);
requireValue(screening.nextGate?.recaptureAfterSourceChange === true, 'recapture must wait for a source change');
requireValue(screening.nextGate?.kevinReviewsOnlyAfterObviousFaultsPass === true, 'Kevin must not review obvious failures');

console.log(JSON.stringify({
    valid: failures.length === 0,
    decision: screening.decision,
    rejectedMoments: moments.filter(moment => moment.decision === 'rejected').length,
    approvedMoments: screening.approvedMomentCount,
    kevinReviewRequested: boundary.kevinReviewRequested,
    technicalCaptureChecksPassed: boundary.technicalCaptureChecksPassed,
    externalPublicationAuthorized: boundary.externalPublicationAuthorized,
    failures
}, null, 2));
if (failures.length) process.exit(1);
