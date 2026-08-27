#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-launch-visual-readiness.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/visual-launch-moments.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-launch-visuals-'));

function run(name, mutate = () => {}, flags = []) {
    const plan = structuredClone(source);
    mutate(plan);
    const planPath = path.join(temporary, `${name}.json`);
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, planPath, ...flags], { cwd: root, encoding: 'utf8' });
}

try {
    assert.strictEqual(run('valid-current-state').status, 0);
    assert.notStrictEqual(run('public-gate-stays-closed', () => {}, ['--require-approved']).status, 0);
    assert.notStrictEqual(run('missing-moment', plan => { plan.requiredMoments.pop(); }).status, 0);
    assert.notStrictEqual(run('fake-count', plan => { plan.approvalRule.approvedMomentCount = 4; }).status, 0);
    assert.notStrictEqual(run('fake-ready', plan => { plan.approvalRule.readyForPublicLaunch = true; }).status, 0);
    assert.notStrictEqual(run('social-authority', plan => { plan.authority.externalSocialPublicationAuthorized = true; }).status, 0);
    assert.notStrictEqual(run('outreach-authority', plan => { plan.authority.creatorOutreachAuthorized = true; }).status, 0);
    assert.notStrictEqual(run('candidate-moved-to-public', plan => {
        plan.requiredMoments[0].evidence = '/press/gameplay/new-candidate.png';
    }).status, 0);
    assert.notStrictEqual(run('candidate-path-traversal', plan => {
        plan.requiredMoments[0].evidence = '.visual-review/candidates/../public/new-candidate.png';
    }).status, 0);
    assert.notStrictEqual(run('rejected-candidate-moved-public', plan => {
        const movement = plan.requiredMoments.find(
            moment => moment.id === 'movement-with-life'
        );
        movement.evidence = '/press/gameplay/rejected-movement.mp4';
    }).status, 0);
    assert.notStrictEqual(run('rejected-candidate-loses-kevin-decision', plan => {
        plan.latestKevinReview.decision = 'pending';
    }).status, 0);
    assert.notStrictEqual(run('rejected-candidate-opens-publication', plan => {
        plan.latestKevinReview.publicationAuthorized = true;
    }).status, 0);
    assert.notStrictEqual(run('private-run-loses-movement-rejection', plan => {
        plan.latestPrivateCandidateRun.movementReview = 'pending';
    }).status, 0);
    assert.notStrictEqual(run('approval-without-review', plan => {
        const moment = plan.requiredMoments[0];
        moment.currentState = 'approved';
        moment.candidatePath = '/marketing/mythical-void-creature-universe-hero-v2.webp';
        plan.approvalRule.approvedMomentCount = 1;
    }).status, 0);
    assert.notStrictEqual(run('old-media-approved', plan => {
        const moment = plan.requiredMoments[0];
        moment.currentState = 'approved';
        moment.candidatePath = '/press/gameplay/realm-mythicalforest.png';
        moment.classification = 'authentic_running_build_gameplay';
        moment.humanReview = { decision: 'approved', reviewedBy: 'Adult reviewer', desktopPassed: true, phonePassed: true };
        plan.approvalRule.approvedMomentCount = 1;
    }).status, 0);
    console.log('Launch visual safeguards passed (current-state validation and 14 rejection cases).');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
