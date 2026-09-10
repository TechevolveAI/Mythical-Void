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
    'docs/company/operations/current-state.json',
    'docs/company/research/first-five-playtest.json',
    'docs/company/research/FIRST_FIVE_PLAYTEST.md',
    'docs/company/reviews/FIRST_CONTACT_VISUAL_REVIEW_2026-08-31.json',
    'docs/company/content/visual-screening-2026-08-27.json',
    'docs/company/search/search-visibility-audit-2026-08-27.json',
    'docs/company/growth/GITHUB_PLAYABLE_RELEASE.json',
    'docs/company/growth/WHAT_WE_KNOW_ABOUT_GROWTH_2026-08-27.md',
    'docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.json',
    'docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.json',
    'docs/company/growth/OWNED_CHANNEL_ATTENTION_2026-09-08.json',
    'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json',
    'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json',
    'docs/company/growth/ITCH_RELEASE_CANDIDATE.json',
    'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.json',
    'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.json',
    'docs/company/content/visual-launch-moments.json',
    'docs/company/automation/website-analytics-tag.json',
    'index.html',
    'src/site/storefront.js',
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
    assert.strictEqual(output.currentDecisionId, 'FD-002');
    assert.strictEqual(output.freshStatusCommand, 'npm run founder:status');
    assert.strictEqual(output.observedProductionDeployId, '6aa28a3fc73e5a0008dfa810');
    assert.strictEqual(output.heldDecisionCount, 1);
    assert.strictEqual(output.observedProductionSourceCommit, '13ad7ff85fd3e77277c378f3b0d2f033cfa761a5');
    assert.strictEqual(output.historicalFirstContactReleasePullRequest, 246);
    assert.strictEqual(output.communityPostMade, false);
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
mutateControl('hide fresh consent proof', value => { value.live.websiteAnalytics.freshConsentJourneyVerified = false; }, 'founder analytics boundary');
mutateControl('authorize public post', value => { value.authority.publicPostAuthorized = true; }, 'publicPostAuthorized');
mutateControl('authorize spend', value => { value.authority.spendAuthorized = true; }, 'spendAuthorized');
mutateControl('add second current decision', value => { value.currentDecisions.push({ id: 'FD-002' }); }, 'exactly one current founder decision');
mutateControl('pretend community post happened', value => { value.communityExperiment.postMade = true; }, 'founder community experiment state is invalid');
mutateControl('allow fake engagement', value => { value.communityExperiment.fakeEngagementAllowed = true; }, 'community experiment safety boundary is invalid');
mutateControl('invent IndieDB account', value => { value.preparedDiscoveryRoutes.indieDb.accountOpened = true; }, 'founder IndieDB accountOpened');
mutateControl('invent IndieDB publication', value => { value.preparedDiscoveryRoutes.indieDb.pagePublished = true; }, 'founder IndieDB pagePublished');
mutateControl('stale latest website release', value => { value.live.websiteAndGame.latestMaterialWebsiteRelease.deployId = 'stale'; }, 'founder latest material website release deployId is stale');
mutateControl('stale protected-main evidence cutoff', value => { value.live.websiteAndGame.protectedMainEvidenceCutoff.observedThroughPullRequest = 247; }, 'founder protected-main evidence cutoff observedThroughPullRequest is stale');
mutateControl('confuse test-only merge with player release', value => { value.live.websiteAndGame.protectedMainEvidenceCutoff.changesPlayerExperience = true; }, 'founder protected-main evidence cutoff changesPlayerExperience is stale');
mutateControl('send age to creature media provider', value => { value.live.websiteAndGame.latestMaterialWebsiteRelease.ageSentToCreatureMediaProvider = true; }, 'private creature-media boundary');
mutateControl('hide reciprocal project link', value => { value.live.websiteAndGame.latestMaterialWebsiteRelease.officialProjectReciprocalLinkLive = false; }, 'live reciprocal project link');
mutateControl('hide homepage invitation', value => { value.live.websiteAndGame.latestMaterialWebsiteRelease.homepageHatchInvitationLive = false; }, 'live Hatch Challenge invitations');
mutateControl('remove exact approval', value => { value.currentDecisions[0].exactApprovalMessage = 'approve'; }, 'exact short-lived community approval');
mutateControl('stale current health', value => { value.currentPublicDoorway.state = 'unknown'; }, 'current public doorway evidence is stale');
mutateControl('overclaim observed deployment', value => { value.currentPublicDoorway.observedProductionAtCheck.notClaimedAsPermanentCurrentIdentity = false; }, 'observed production identity is invalid or overclaimed');
mutateControl('overstate availability', value => { value.currentPublicDoorway.provesPlayers = true; }, 'availability is being overstated');
mutateControl('remove outage stop', value => { value.currentPublicDoorway.holdAllDiscoveryWhenUnhealthy = false; }, 'fresh founder status gate is missing');
mutateControl('invent editorial outreach', value => { value.preparedDiscoveryRoutes.editorial.messagesSent = 1; }, 'founder editorial route is inaccurate');
mutateControl('authorize invented activity', value => { value.authority.inventedActivityAuthorized = true; }, 'inventedActivityAuthorized');

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

const staleCommunityCopyRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/FOUNDER_CONTROL_PAGE.md');
    const page = fs.readFileSync(target, 'utf8').replace(
        'decide what your mission should tell Earth',
        'change Project Beacon'
    );
    fs.writeFileSync(target, page);
});
try {
    const result = execute(staleCommunityCopyRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('founder exact community post does not match'));
    assert(result.stderr.includes('unexplained Project Beacon wording'));
    cases += 1;
} finally {
    fs.rmSync(staleCommunityCopyRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 33);
console.log('Founder control safeguards passed (33 cases).');
