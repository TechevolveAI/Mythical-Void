#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-first-five-playtest.cjs');
const files = [
    'docs/company/research/first-five-playtest.json',
    'docs/company/reviews/FIRST_CONTACT_VISUAL_REVIEW_2026-08-31.json',
    'docs/company/research/FIRST_FIVE_PLAYTEST.md',
    'docs/company/research/FIRST_FIVE_INVITATION_AND_SCORECARD_2026-08-31.md',
    'docs/company/research/ROUND_001_POSITIONING_AND_TRUST.md',
    'docs/company/research/round-001a-operations.json',
    'package.json'
];
let cases = 0;

function fixture(mutate) {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-first-five-'));
    for (const relative of files) {
        const target = path.join(targetRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, relative), target);
    }
    if (mutate) mutate(targetRoot);
    return targetRoot;
}

function execute(targetRoot) {
    return spawnSync(process.execPath, [validator, '--root', targetRoot], { encoding: 'utf8', timeout: 30_000 });
}

function invalidJson(name, change, expected) {
    const targetRoot = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, 'docs/company/research/first-five-playtest.json');
        const plan = JSON.parse(fs.readFileSync(target, 'utf8'));
        change(plan);
        fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
    });
    try {
        const result = execute(targetRoot);
        assert.strictEqual(result.status, 1, `${name} should fail`);
        assert(result.stderr.includes(expected), `${name} should report ${expected}`);
        cases += 1;
    } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
    }
}

const baselineRoot = fixture();
try {
    const result = execute(baselineRoot);
    assert.strictEqual(result.status, 0, result.stderr);
    cases += 1;
} finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
}

invalidJson('child audience', plan => { plan.audience.minorParticipationPermitted = true; }, 'minor participation');
invalidJson('invented product pass', plan => { plan.entryGates.gdh009Passed = true; }, 'must not be marked passed');
invalidJson('invented build', plan => { plan.entryGates.stableBuildRef = 'not-approved'; }, 'no approved stable build');
invalidJson('invented deploy', plan => { plan.entryGates.productionDeployId = 'not-approved'; }, 'no approved stable build');
invalidJson('invented human approval', plan => { plan.entryGates.adultHumanVisualReviewPassed = true; }, 'visual approval must remain false');
invalidJson('hidden live technical repair', plan => { plan.currentHold.candidateDeployed = false; }, 'must not be hidden');
invalidJson('invented promotion from deployment', plan => { plan.currentHold.promotionMayBegin = true; }, 'must not permit invitations or promotion');
invalidJson('premature Kevin approval', plan => { plan.entryGates.kevinApprovedPurposeAndInvitations = true; }, 'must remain false');
invalidJson('filled result', plan => { plan.sessionSlots[0].state = 'complete'; plan.sessionSlots[0].result = {}; }, 'must remain empty');
invalidJson('external authority', plan => { plan.authority.participantContactAuthorized = true; }, 'participantContactAuthorized');
invalidJson('weakened threshold', plan => { plan.releaseRule.creatureUnmistakableMinimum = 3; }, 'thresholds drifted');
invalidJson('contact data', plan => { plan.unapprovedContact = 'person@example.com'; }, 'contact data');

const wordingRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/research/ROUND_001_POSITIONING_AND_TRUST.md');
    fs.appendFileSync(target, '\nCompanion lead\n');
});
try {
    const result = execute(wordingRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('outdated companion-led'));
    cases += 1;
} finally {
    fs.rmSync(wordingRoot, { recursive: true, force: true });
}

const invitationRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/research/FIRST_FIVE_INVITATION_AND_SCORECARD_2026-08-31.md');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('Do not invite children.', 'Invite anyone.'));
});
try {
    const result = execute(invitationRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('Do not invite children'));
    cases += 1;
} finally {
    fs.rmSync(invitationRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 15);
console.log('First Five playtest safeguards passed (15 cases).');
