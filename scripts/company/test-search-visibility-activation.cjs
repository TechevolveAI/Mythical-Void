#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-search-visibility-activation.cjs');
const files = [
    'docs/company/search/search-visibility-audit-2026-08-27.json',
    'docs/company/search/search-visibility-follow-up-2026-09-08.json',
    'docs/company/search/SEARCH_VISIBILITY_FOLLOW_UP_2026-09-08.md',
    'docs/company/search/indexnow-submission-2026-08-27.json',
    'docs/company/search/indexnow-submission-2026-08-27-05.json',
    'docs/company/search/indexnow-submission-2026-08-27-06.json',
    'docs/company/search/indexnow-submission-2026-09-08-hatch-news.json',
    'docs/company/search/indexnow-submission-2026-09-08-hatch-first-screen.json',
    'docs/company/search/indexnow-submission-2026-09-09-mobile-homepage.json',
    'docs/company/search/indexnow-submission-2026-09-09-play-welcome-news.json',
    'docs/company/search/indexnow-submission-2026-09-09-first-minute-news.json',
    'docs/company/search/indexnow-submission-2026-09-09-game-identity.json',
    'docs/company/search/indexnow-submission-2026-09-09-living-portrait-claims.json',
    'docs/company/search/SEARCH_VISIBILITY_AUDIT_2026-08-27.md',
    'docs/company/search/SEARCH_CONSOLE_ACTIVATION.md',
    'docs/company/search/search-opportunities.json',
    'index.html',
    'public/robots.txt',
    'public/sitemap.xml',
    'public/playable-now/index.html',
    'package.json'
];
let cases = 0;

function fixture(mutate) {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-search-visibility-'));
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

function invalidAudit(name, change, expected) {
    const targetRoot = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, 'docs/company/search/search-visibility-audit-2026-08-27.json');
        const audit = JSON.parse(fs.readFileSync(target, 'utf8'));
        change(audit);
        fs.writeFileSync(target, `${JSON.stringify(audit, null, 2)}\n`);
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

invalidAudit('invented connection', audit => { audit.verifiedEvidence.searchConsoleConnected = true; }, 'searchConsoleConnected');
invalidAudit('invented ranking', audit => { audit.verifiedEvidence.rankingPosition = 1; }, 'rankingPosition');
invalidAudit('premature sitemap authority', audit => { audit.authority.sitemapSubmissionAuthorized = true; }, 'sitemapSubmissionAuthorized');
invalidAudit('paid search', audit => { audit.authority.paidSearchAuthorized = true; }, 'paidSearchAuthorized');
invalidAudit('fabricated result', audit => { audit.sample.queries[0].mythicalResultObserved = true; }, 'sample result');
invalidAudit('fabricated latest result', audit => { audit.latestPublicSample.queries[0].mythicalResultObserved = true; }, 'latest public sample result');
invalidAudit('fabricated scheduled follow-up result', audit => { audit.firstScheduledFollowUp.officialResultObserved = true; }, 'first scheduled follow-up result');
invalidAudit('invented indexing', audit => { audit.indexNow.indexingClaimed = true; }, 'cannot be described as indexing');
invalidAudit('invented newest-notice indexing', audit => { audit.indexNow.newestOwnedChangeNotice.indexingClaimed = true; }, 'must not claim indexing');
invalidAudit('inflated newest-notice count', audit => { audit.indexNow.newestOwnedChangeNotice.urlCount = 99; }, 'newest owned changed-page notification audit is incomplete');
invalidAudit('invented latest-notice indexing', audit => { audit.indexNow.latestOwnedChangeNotice.indexingClaimed = true; }, 'latest owned changed-page notice must not claim indexing');
invalidAudit('inflated latest-notice count', audit => { audit.indexNow.latestOwnedChangeNotice.urlCount = 99; }, 'latest owned changed-page notification audit is incomplete');
invalidAudit('invented current-notice indexing', audit => { audit.indexNow.currentOwnedChangeNotice.indexingClaimed = true; }, 'current owned changed-page notice must not claim indexing');
invalidAudit('inflated current-notice count', audit => { audit.indexNow.currentOwnedChangeNotice.urlCount = 99; }, 'current owned changed-page notification audit is incomplete');
invalidAudit('invented first-minute-notice indexing', audit => { audit.indexNow.firstMinuteOwnedChangeNotice.indexingClaimed = true; }, 'first-minute owned changed-page notice must not claim indexing');
invalidAudit('inflated first-minute-notice count', audit => { audit.indexNow.firstMinuteOwnedChangeNotice.urlCount = 99; }, 'first-minute owned changed-page notification audit is incomplete');
invalidAudit('invented canonical-game-notice indexing', audit => { audit.indexNow.latestCanonicalGameIdentityNotice.indexingClaimed = true; }, 'canonical game identity notice must not claim indexing');
invalidAudit('inflated canonical-game-notice count', audit => { audit.indexNow.latestCanonicalGameIdentityNotice.urlCount = 99; }, 'canonical game identity notification audit is incomplete');
invalidAudit('invented Living Portrait notice indexing', audit => { audit.indexNow.latestCreatureMediaClaimNotice.indexingClaimed = true; }, 'Living Portrait changed-page notice must not claim indexing');
invalidAudit('inflated Living Portrait notice count', audit => { audit.indexNow.latestCreatureMediaClaimNotice.urlCount = 99; }, 'Living Portrait changed-page notification audit is incomplete');
invalidAudit('invented result count', audit => { audit.sample.officialSiteResultCountClaimed = true; }, 'must not invent a result count');
invalidAudit('stale identity state', audit => { audit.homepageIdentityMarkup.productionState = 'prepared_not_deployed'; }, 'live state is stale');
invalidAudit('invented Search Console property', audit => { audit.searchConsoleAccessCheck.mythicalVoidPropertyAccessible = true; }, 'Search Console absence check');
invalidAudit('stale GitHub metadata record', audit => { audit.publicGitHubDoorway.metadataUpdatePendingReviewedMerge = true; }, 'authority boundary');
invalidAudit('missing current GitHub discovery topic', audit => { audit.publicGitHubDoorway.topicsLive = audit.publicGitHubDoorway.topicsLive.filter(topic => topic !== 'html5-game'); }, 'topic evidence');
invalidAudit('invented GitHub discovery result', audit => { audit.publicGitHubDoorway.topicExpansionMeaning = 'The new topics have increased plays and ranking.'; }, 'topic meaning boundary');
invalidAudit('stale GitHub description', audit => { audit.publicGitHubDoorway.descriptionLive = 'Free browser adventure: hatch an alien creature, cross six living realms, and shape Project Beacon. No download or account.'; }, 'public GitHub description evidence');
invalidAudit('missing GitHub description check', audit => { audit.publicGitHubDoorway.descriptionCheckedAt = null; }, 'plain-language evidence');
invalidAudit('mutable GitHub identity check', audit => { audit.publicGitHubDoorway.liveCheckReadOnly = false; }, 'live identity check');

const fabricatedFollowUpRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/search/search-visibility-follow-up-2026-09-08.json');
    const record = JSON.parse(fs.readFileSync(target, 'utf8'));
    record.queries[0].officialMythicalVoidResultObserved = true;
    fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`);
});
try {
    const result = execute(fabricatedFollowUpRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('dated follow-up query evidence'));
    cases += 1;
} finally {
    fs.rmSync(fabricatedFollowUpRoot, { recursive: true, force: true });
}

const robotsRoot = fixture(fixtureRoot => {
    fs.writeFileSync(path.join(fixtureRoot, 'public/robots.txt'), 'User-agent: *\nDisallow: /\n');
});
try {
    const result = execute(robotsRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('robots crawl permission'));
    cases += 1;
} finally {
    fs.rmSync(robotsRoot, { recursive: true, force: true });
}

const sitemapRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'public/sitemap.xml');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('<loc>https://mythicalvoid.com/playable-now/</loc>', ''));
});
try {
    const result = execute(sitemapRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('sitemap is missing'));
    cases += 1;
} finally {
    fs.rmSync(sitemapRoot, { recursive: true, force: true });
}

const staleMapRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/search/search-opportunities.json');
    const map = JSON.parse(fs.readFileSync(target, 'utf8'));
    map.clusters[0].targetState = 'proposed_not_created';
    fs.writeFileSync(target, `${JSON.stringify(map, null, 2)}\n`);
});
try {
    const result = execute(staleMapRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('six live owned routes'));
    cases += 1;
} finally {
    fs.rmSync(staleMapRoot, { recursive: true, force: true });
}

const missingStaticEntryRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'index.html');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('data-static-search-entry', 'data-missing-search-entry'));
});
try {
    const result = execute(missingStaticEntryRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('plain homepage entry'));
    cases += 1;
} finally {
    fs.rmSync(missingStaticEntryRoot, { recursive: true, force: true });
}

const missingReciprocalLinkRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'index.html');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('rel="me noopener noreferrer"', 'rel="noopener noreferrer"'));
});
try {
    const result = execute(missingReciprocalLinkRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('plain homepage entry'));
    cases += 1;
} finally {
    fs.rmSync(missingReciprocalLinkRoot, { recursive: true, force: true });
}

const hiddenGameRouteRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'index.html');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('html[data-initial-route="game"] .site-entry-fallback', 'html[data-wrong-route="game"] .site-entry-fallback'));
});
try {
    const result = execute(hiddenGameRouteRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('plain homepage entry'));
    cases += 1;
} finally {
    fs.rmSync(hiddenGameRouteRoot, { recursive: true, force: true });
}

const companionRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'index.html');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('alien creature shaped by a genetics system', 'alien companion shaped by a genetics system'));
});
try {
    const result = execute(companionRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('retired or unsupported creature wording'));
    cases += 1;
} finally {
    fs.rmSync(companionRoot, { recursive: true, force: true });
}

const projectNameRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'index.html');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replaceAll('decide what your mission should tell Earth', 'decide what Project Beacon should tell Earth'));
});
try {
    const result = execute(projectNameRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('plain homepage entry'));
    cases += 1;
} finally {
    fs.rmSync(projectNameRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 39);
console.log('Search visibility activation safeguards passed (39 cases).');
