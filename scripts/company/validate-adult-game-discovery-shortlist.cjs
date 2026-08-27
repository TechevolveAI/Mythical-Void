#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const plan = JSON.parse(read('docs/company/growth/ADULT_GAME_DISCOVERY_SHORTLIST_2026-08-27.json'));
const copy = read('docs/company/growth/ADULT_GAME_DISCOVERY_SHORTLIST_2026-08-27.md');
const visualPlan = JSON.parse(read('docs/company/content/visual-launch-moments.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(plan.id === 'ADULT-GAME-DISCOVERY-001', 'shortlist id is missing');
requireValue(plan.state === 'research_only_visual_and_authority_gated', 'shortlist overstates readiness');
requireValue(plan.externalActionAuthorized === false, 'shortlist must not authorize external action');
requireValue(plan.candidates?.length === 5, 'shortlist must contain five focused candidates');
requireValue(plan.candidates?.every(item => item.outreachApproved === false && item.coverageGuaranteed === false), 'candidate authority or coverage boundary is missing');
requireValue(plan.candidates?.[0]?.name === 'Alpha Beta Gamer', 'first candidate should remain the strongest verified fit');
requireValue(plan.candidates?.find(item => item.name === 'I Dream of Indie Games')?.verifiedSubmissionRoute === false, 'unverified submission route must not be invented');
requireValue(plan.respectfulExclusions?.find(item => item.name === 'Wholesome Games')?.state === 'do_not_pitch_current_project', 'Wholesome Games AI-art preference is not respected');
requireValue(plan.respectfulExclusions?.find(item => item.name === 'Wanderbots')?.state === 'do_not_contact', 'Wanderbots contact preference is not respected');
for (const field of ['bulkOutreachAuthorized', 'automatedFollowUpAuthorized', 'paidCoverageAuthorized', 'childInterviewAuthorized', 'weakOrImaginedArtMayBePresentedAsGameplay', 'personalContactScrapingAuthorized']) {
    requireValue(plan.boundaries?.[field] === false, `boundary ${field} must remain false`);
}
requireValue(visualPlan.approvalRule?.approvedMomentCount === 0 && visualPlan.approvalRule?.requiredApprovedMoments === 4, 'visual gate changed; reassess the shortlist deliberately');
for (const phrase of ['First group to consider', 'Respectful exclusions', 'do not pitch the current project', 'do not contact', 'The one-pitch rule', 'Kevin\'s real voice']) {
    requireValue(copy.includes(phrase), `plain-language shortlist is missing: ${phrase}`);
}
for (const item of [...plan.candidates, ...plan.respectfulExclusions]) requireValue(copy.includes(item.source), `source is missing from the shortlist: ${item.source}`);

if (failures.length) {
    console.error('Adult game-discovery shortlist is not safe or complete:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({ valid: true, candidates: plan.candidates.length, respectfulExclusions: plan.respectfulExclusions.length, visualGate: '0/4', outreachAuthorized: false }, null, 2));
