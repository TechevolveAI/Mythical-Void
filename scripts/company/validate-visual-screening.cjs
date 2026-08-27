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
requireValue(screening.screeningId === 'VISUAL-SCREEN-2026-08-27-01', 'screening identity drifted');
requireValue(/^[0-9a-f]{40}$/.test(screening.source?.commit || ''), 'source commit is missing');
requireValue(screening.source?.route === '/play/', 'screening must come from the running game');
requireValue(screening.source?.profileId === 'MV-0813', 'source creature profile drifted');
requireValue(screening.source?.renderer === 'player_facing_phaser_creature_renderer', 'player renderer proof is missing');
requireValue(screening.source?.candidateDirectory?.startsWith('.visual-review/candidates/'), 'candidate directory must remain private');
requireValue(!screening.source?.candidateDirectory?.includes('public/'), 'candidate directory cannot be public');
requireValue(/^[0-9a-f]{64}$/.test(screening.source?.manifestSha256 || ''), 'candidate manifest fingerprint is missing');
requireValue(screening.source?.websiteAccessible === false, 'candidate run cannot be website-accessible');

const boundary = screening.boundary || {};
for (const [key, expected] of Object.entries({
    technicalCaptureChecksPassed: true,
    technicalChecksAreVisualApproval: false,
    automationMayRejectObviousFaults: true,
    automationMayApprove: false,
    kevinReviewRequested: false,
    adultFrameReviewCompleted: false,
    publicReplacementAuthorized: false,
    externalPublicationAuthorized: false,
    externalActionTaken: false
})) requireValue(boundary[key] === expected, `boundary.${key} must be ${expected}`);

requireValue(screening.decision === 'reject_all_before_kevin_review', 'screening must preserve the rejection decision');
requireValue(screening.approvedMomentCount === 0 && screening.requiredMomentCount === 4, 'visual gate must remain 0/4');
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

requireValue(screening.realmRecapture?.attempted === true && screening.realmRecapture?.completed === false, 'failed realm recapture evidence is missing');
requireValue(screening.realmRecapture?.reason === 'sustained_mobile_render_budget_failed', 'realm failure reason drifted');
requireValue(Number(screening.realmRecapture?.observed?.averageFps) < 20, 'recorded mobile frame-rate evidence is not the failing observation');
requireValue(Number(screening.realmRecapture?.observed?.p95FrameMs) > 50, 'recorded p95 frame-time evidence is not the failing observation');
requireValue(screening.nextGate?.recaptureAfterSourceChange === true, 'recapture must wait for a source change');
requireValue(screening.nextGate?.kevinReviewsOnlyAfterObviousFaultsPass === true, 'Kevin must not review obvious failures');

console.log(JSON.stringify({
    valid: failures.length === 0,
    decision: screening.decision,
    rejectedMoments: moments.filter(moment => moment.decision === 'rejected').length,
    approvedMoments: screening.approvedMomentCount,
    kevinReviewRequested: boundary.kevinReviewRequested,
    realmRecaptureCompleted: screening.realmRecapture?.completed === true,
    externalPublicationAuthorized: boundary.externalPublicationAuthorized,
    failures
}, null, 2));
if (failures.length) process.exit(1);
