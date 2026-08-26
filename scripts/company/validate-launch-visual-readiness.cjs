#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const requireApproved = args.includes('--require-approved');
const customPlan = args.find(arg => !arg.startsWith('--'));
const planPath = customPlan
    ? path.resolve(customPlan)
    : path.join(root, 'docs/company/content/visual-launch-moments.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const register = readVisualPublicationRegister();
const captureSource = fs.readFileSync(path.join(root, 'scripts/company/capture-authentic-gameplay-stills.cjs'), 'utf8');
const showcaseCaptureSource = fs.readFileSync(path.join(root, 'scripts/company/capture-real-creature-showcase.cjs'), 'utf8');
const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const requiredIds = ['creature-helps', 'choice-changes-world', 'strange-discovery', 'movement-with-life'];
const moments = Array.isArray(plan.requiredMoments) ? plan.requiredMoments : [];
const momentIds = moments.map(moment => moment.id);

requireValue(plan.schemaVersion === 1, 'visual-launch plan schema is invalid');
requireValue(plan.state === 'no_launch_grade_gameplay_media_approved', 'visual-launch plan must state the current unapproved position');
requireValue(moments.length === 4 && new Set(momentIds).size === 4, 'visual-launch plan must contain four distinct moments');
for (const id of requiredIds) requireValue(momentIds.includes(id), `required launch moment is missing: ${id}`);
for (const moment of moments) {
    requireValue(moment.publicQuestion?.length >= 15, `${moment.id} needs a plain public question`);
    requireValue(moment.shot?.length >= 35, `${moment.id} needs a deliberate shot description`);
    requireValue(moment.mustShow?.length >= 3, `${moment.id} needs at least three visible requirements`);
    requireValue(['blocked_by_current_game_visual', 'no_candidate_captured', 'candidate_under_human_review', 'approved'].includes(moment.currentState), `${moment.id} has an invalid state`);
    if (moment.evidence) requireValue(isWithdrawnPublicVisual(moment.evidence, register), `${moment.id} current evidence must remain withdrawn`);
    if (moment.currentState === 'approved') {
        requireValue(moment.humanReview?.decision === 'approved', `${moment.id} lacks an adult approval decision`);
        requireValue(moment.humanReview?.reviewedBy?.length >= 2, `${moment.id} lacks a named adult reviewer`);
        requireValue(moment.humanReview?.desktopPassed === true && moment.humanReview?.phonePassed === true, `${moment.id} lacks desktop and phone review`);
        requireValue(moment.candidatePath && !isWithdrawnPublicVisual(moment.candidatePath, register), `${moment.id} lacks a non-withdrawn approved candidate`);
        requireValue(moment.classification === 'authentic_running_build_gameplay', `${moment.id} is not classified as authentic running-build gameplay`);
        requireValue(register.publicApproved?.some(item => item.path === moment.candidatePath && item.review === 'approved'), `${moment.id} is absent from the exact public approval register`);
    }
}

const approved = moments.filter(moment => moment.currentState === 'approved').length;
requireValue(plan.approvalRule?.approvedMomentCount === approved, 'approved moment count drifted');
requireValue(plan.approvalRule?.requiredApprovedMoments === 4, 'all four launch moments must be required');
requireValue(plan.approvalRule?.adultReviewRequired === true, 'adult visual review must remain required');
requireValue(plan.approvalRule?.kevinApprovalRequiredBeforeExternalPublication === true, 'Kevin approval must remain required before external publication');
requireValue(plan.authority?.externalSocialPublicationAuthorized === false, 'visual plan must not authorize social posting');
requireValue(plan.authority?.creatorOutreachAuthorized === false, 'visual plan must not authorize creator outreach');
requireValue(plan.authority?.paidPromotionAuthorized === false, 'visual plan must not authorize paid promotion');
requireValue(plan.authority?.externalActionTaken === false, 'visual plan must not invent an external action');

requireValue(captureSource.includes("path.join(root, '.visual-review', 'candidates')"), 'capture output is not quarantined outside the website');
requireValue(captureSource.includes("isInside(path.join(root, 'public'), captureDir)"), 'capture tool does not refuse direct public output');
requireValue(captureSource.includes("approvalState: 'candidate_quarantine_human_review_required'"), 'candidate manifest does not require human review');
requireValue(captureSource.includes('ownedWebsiteProofUseAuthorized: false'), 'capture tool authorizes unreviewed owned-site publication');
requireValue(showcaseCaptureSource.includes("path.join(root, '.visual-review', 'candidates', 'creature-showcase')"), 'creature showcase capture is not quarantined outside the website');
requireValue(showcaseCaptureSource.includes("throw new Error('Creature showcase candidates cannot be captured inside public/.')"), 'creature showcase capture does not refuse direct public output');

for (const prefix of register.withdrawnPathFamilies) {
    const netlifyRule = `from = "${prefix}*"`;
    requireValue(netlify.includes(netlifyRule) && netlify.includes('to = "/press/"'), `Netlify does not block direct access to ${prefix}`);
    const vercelPrefix = `${prefix}:path*`;
    requireValue(vercel.redirects?.some(rule => rule.source === vercelPrefix && rule.destination === '/press/'), `Vercel does not block direct access to ${prefix}`);
}
for (const publicPath of register.withdrawnIndividualPaths) {
    requireValue(netlify.includes(`from = "${publicPath}"`), `Netlify does not block direct access to ${publicPath}`);
    requireValue(vercel.redirects?.some(rule => rule.source === publicPath && rule.destination === '/press/'), `Vercel does not block direct access to ${publicPath}`);
}

const ready = approved === plan.approvalRule?.requiredApprovedMoments && failures.length === 0;
requireValue(plan.approvalRule?.readyForPublicLaunch === ready, 'ready-for-launch state drifted from the actual approvals');
requireValue(plan.authority?.ownedWebsiteReplacementAuthorized === ready, 'owned-site replacement authority must match actual readiness');

console.log(JSON.stringify({
    valid: failures.length === 0,
    readyForPublicVisualLaunch: ready,
    approvedMoments: approved,
    requiredMoments: 4,
    candidatesCapturedToPrivateReview: true,
    withdrawnDirectUrlsBlocked: register.withdrawnPathFamilies.length + register.withdrawnIndividualPaths.length,
    failures
}, null, 2));

if (failures.length || (requireApproved && !ready)) process.exit(1);
