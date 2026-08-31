#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-founder-control-page.cjs');
const files = [
    'docs/company/FOUNDER_CONTROL_PAGE.md',
    'docs/company/NOW_NEXT_LATER.md',
    'docs/company/operations/founder-control-page.json',
    'docs/company/research/first-five-playtest.json',
    'docs/company/reviews/FIRST_CONTACT_VISUAL_REVIEW_2026-08-31.json',
    'docs/company/content/visual-screening-2026-08-27.json',
    'docs/company/search/search-visibility-audit-2026-08-27.json',
    'docs/company/growth/GITHUB_PLAYABLE_RELEASE.json',
    'docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.json',
    'docs/company/content/visual-launch-moments.json',
    'docs/company/automation/website-analytics-tag.json',
    'package.json'
];
let cases = 0;

function fixture(mutate) {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-founder-control-'));
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

function mutateControl(name, change, expected) {
    const targetRoot = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, 'docs/company/operations/founder-control-page.json');
        const control = JSON.parse(fs.readFileSync(target, 'utf8'));
        change(control);
        fs.writeFileSync(target, `${JSON.stringify(control, null, 2)}\n`);
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

const baseline = fixture();
try {
    const result = execute(baseline);
    assert.strictEqual(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.currentDecisionCount, 1);
    assert.strictEqual(output.creatureArtworkHumanApproved, false);
    assert.strictEqual(output.externalAuthorityGranted, false);
    cases += 1;
} finally {
    fs.rmSync(baseline, { recursive: true, force: true });
}

mutateControl('hide live repair', value => { value.live.websiteAndGame.technicalFirstContactRepairLive = false; }, 'live first-contact repair is hidden');
mutateControl('invent visual approval', value => { value.live.websiteAndGame.creatureArtworkHumanApproved = true; }, 'must not be treated as visual approval');
mutateControl('invent First Five sessions', value => { value.held.firstFive.sessionsCompleted = 5; }, 'founder First Five hold is invalid');
mutateControl('authorize invitations', value => { value.held.firstFive.invitationsMayBegin = true; }, 'founder First Five hold is invalid');
mutateControl('authorize screenshots', value => { value.held.gameplayPromotion.screenshotsMayPublish = true; }, 'screenshotsMayPublish');
mutateControl('invent search result', value => { value.known.officialResultsObservedInLatestPublicSearchSample = 1; }, 'search results are falsely claimed');
mutateControl('invent player meaning', value => { value.known.websiteVisitMayBeCalledPlayer = true; }, 'websiteVisitMayBeCalledPlayer');
mutateControl('trust unverified analytics', value => { value.live.websiteAnalytics.measurementTrustedForDecisions = true; }, 'founder analytics boundary');
mutateControl('authorize public post', value => { value.authority.publicPostAuthorized = true; }, 'publicPostAuthorized');
mutateControl('authorize spend', value => { value.authority.spendAuthorized = true; }, 'spendAuthorized');
mutateControl('add second current decision', value => { value.currentDecisions.push({ id: 'FD-002' }); }, 'exactly one current founder decision');

const wordingRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/FOUNDER_CONTROL_PAGE.md');
    fs.appendFileSync(target, '\nAI companions are ready.\n');
});
try {
    const result = execute(wordingRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('outdated companion wording'));
    cases += 1;
} finally {
    fs.rmSync(wordingRoot, { recursive: true, force: true });
}

const privacyRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/FOUNDER_CONTROL_PAGE.md');
    fs.appendFileSync(target, '\nThe game was made with his nine-year-old son.\n');
});
try {
    const result = execute(privacyRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes("child's exact age"));
    cases += 1;
} finally {
    fs.rmSync(privacyRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 14);
console.log('Founder control safeguards passed (14 cases).');
