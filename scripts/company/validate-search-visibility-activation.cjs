#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const audit = JSON.parse(read('docs/company/search/search-visibility-audit-2026-08-27.json'));
const followUp = JSON.parse(read('docs/company/search/search-visibility-follow-up-2026-09-08.json'));
const followUpReport = read('docs/company/search/SEARCH_VISIBILITY_FOLLOW_UP_2026-09-08.md');
const indexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27.json'));
const previousChangedPageIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27-05.json'));
const changedPageIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27-06.json'));
const previousOwnedChangeIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-09-08-hatch-news.json'));
const newestOwnedChangeIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-09-08-hatch-first-screen.json'));
const latestOwnedChangeIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-09-09-mobile-homepage.json'));
const handoff = read('docs/company/search/SEARCH_CONSOLE_ACTIVATION.md');
const report = read('docs/company/search/SEARCH_VISIBILITY_AUDIT_2026-08-27.md');
const opportunityMap = JSON.parse(read('docs/company/search/search-opportunities.json'));
const homepage = read('index.html');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');
const playable = read('public/playable-now/index.html');
const packageJson = JSON.parse(read('package.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(audit.id === 'SEARCH-VISIBILITY-2026-08-27', 'search visibility audit identity is missing');
requireValue(audit.state === 'owned_identity_live_public_github_live_first_follow_up_complete_search_console_absent', 'search visibility state is stale or overstated');
requireValue(audit.sample?.queryCount === 8 && audit.sample?.queries?.length === 8, 'eight-query sample boundary is missing');
requireValue(audit.sample?.queries?.every(item => item.mythicalResultObserved === false), 'sample result was changed without a new dated audit');
requireValue(/cannot prove global non-indexing/i.test(audit.sample?.limitations || ''), 'search sample limitation is missing');
requireValue(audit.sample?.officialSiteResultCountClaimed === false, 'directional search sample must not invent a result count');
requireValue(audit.sample?.unrelatedOrUnverifiedBrandProfileObserved === true, 'brand-confusion observation is missing');
requireValue(audit.latestPublicSample?.queryCount === 4 && audit.latestPublicSample?.queries?.length === 4, 'latest four-query sample boundary is missing');
requireValue(audit.latestPublicSample?.queries?.every(item => item.mythicalResultObserved === false), 'latest public sample result was changed without new evidence');
requireValue(audit.latestPublicSample?.officialSiteResultCountClaimed === false && /cannot prove global non-indexing/i.test(audit.latestPublicSample?.limitations || ''), 'latest public sample limitation is missing');
requireValue(audit.firstScheduledFollowUp?.record === 'docs/company/search/search-visibility-follow-up-2026-09-08.json', 'first scheduled follow-up link is missing');
requireValue(audit.firstScheduledFollowUp?.daysSinceBaseline >= 7 && audit.firstScheduledFollowUp?.queryCount === 4, 'first scheduled follow-up timing or size is invalid');
requireValue(audit.firstScheduledFollowUp?.officialResultObserved === false, 'first scheduled follow-up result changed without evidence');
requireValue(audit.firstScheduledFollowUp?.nextCheckNotBefore === '2026-09-15', 'second scheduled check is too early or missing');
requireValue(audit.firstScheduledFollowUp?.resultCountClaimed === false && audit.firstScheduledFollowUp?.rankingClaimed === false, 'first scheduled follow-up invents search performance');
requireValue(followUp.id === 'SEARCH-VISIBILITY-FOLLOW-UP-2026-09-08' && followUp.timing?.gateSatisfied === true && followUp.timing?.daysSinceBaseline === 8, 'dated follow-up identity or timing is invalid');
requireValue(followUp.queries?.length === 4 && followUp.queries.every(item => item.officialMythicalVoidResultObserved === false), 'dated follow-up query evidence is incomplete');
requireValue(followUp.comparison?.baselineOfficialResultObserved === false && followUp.comparison?.followUpOfficialResultObserved === false && /does not prove global non-indexing/i.test(followUp.comparison?.meaning || ''), 'dated follow-up comparison is overstated');
requireValue(followUp.resultCountClaimed === false && followUp.rankingClaimed === false && followUp.searchConsoleEvidenceUsed === false, 'dated follow-up claims unavailable evidence');
requireValue(followUp.nextScheduledCheck?.notBefore === '2026-09-15', 'dated follow-up schedules the second check too early');
for (const field of ['searchConsoleConnectionAuthorized', 'sitemapSubmissionAuthorized', 'urlInspectionRequestAuthorized', 'paidSearchAuthorized', 'linkOutreachAuthorized', 'externalPostingAuthorized', 'externalActionTaken']) {
    requireValue(followUp.authority?.[field] === false, `follow-up authority ${field} must remain false`);
}
requireValue(opportunityMap.status === 'owned_pages_live_submission_gated', 'search opportunity map has a stale state');
requireValue(opportunityMap.clusters?.length === 6 && opportunityMap.clusters.every(item => item.targetState === 'existing_live' && item.liveOwnedPage === true), 'search opportunity map does not reflect the six live owned routes');
requireValue(!/\bcompanion\b/i.test(JSON.stringify(opportunityMap)), 'retired companion wording remains in the search opportunity map');

for (const [field, value] of Object.entries(audit.liveTechnicalChecks || {})) {
    requireValue(value === true || value === 200, `technical check is not passing: ${field}`);
}
for (const field of ['searchConsoleConnected', 'sitemapSubmittedInSearchConsole', 'homepageInspectedInSearchConsole', 'playableNowInspectedInSearchConsole']) {
    requireValue(audit.verifiedEvidence?.[field] === false, `${field} must remain unverified until authenticated evidence exists`);
}
for (const field of ['indexedUrlCount', 'searchImpressions', 'searchClicks', 'rankingPosition']) {
    requireValue(audit.verifiedEvidence?.[field] === null, `${field} must remain null without Search Console evidence`);
}
for (const field of ['searchConsoleConnectionAuthorized', 'ownershipVerificationAuthorized', 'sitemapSubmissionAuthorized', 'urlInspectionRequestAuthorized', 'paidSearchAuthorized', 'linkOutreachAuthorized']) {
    requireValue(audit.authority?.[field] === false, `${field} must remain false`);
}
requireValue(audit.authority?.indexNowSubmissionAuthorized === true, 'IndexNow submission authority is missing');
requireValue(audit.authority?.indexNowSubmissionCompleted === true && audit.authority?.externalActionTaken === true, 'accepted IndexNow action is not recorded');
requireValue(audit.indexNow?.record === 'docs/company/search/indexnow-submission-2026-08-27.json', 'IndexNow evidence link is missing');
requireValue(audit.indexNow?.accepted === true && audit.indexNow?.httpStatus === 200 && audit.indexNow?.urlCount === 14, 'IndexNow acceptance evidence is incomplete');
requireValue(audit.indexNow?.indexingClaimed === false, 'IndexNow acceptance cannot be described as indexing');
requireValue(indexNow.id === 'INDEXNOW-2026-08-27-01' && indexNow.host === 'mythicalvoid.com', 'IndexNow evidence identity is invalid');
requireValue(indexNow.accepted === true && indexNow.httpStatus === 200 && indexNow.urlCount === 14, 'IndexNow evidence does not preserve the accepted response');
for (const field of ['personalDataSent', 'accountUsed', 'paidPromotionStarted']) requireValue(indexNow[field] === false, `IndexNow boundary ${field} must remain false`);
requireValue(/does not prove/i.test(indexNow.meaning || ''), 'IndexNow evidence overstates what acceptance proves');
requireValue(audit.indexNow?.previousMeaningfulChange?.record === 'docs/company/search/indexnow-submission-2026-08-27-05.json', 'previous changed-page notification evidence link is missing');
requireValue(audit.indexNow?.previousMeaningfulChange?.accepted === true && audit.indexNow?.previousMeaningfulChange?.urlCount === 1 && audit.indexNow?.previousMeaningfulChange?.unchangedUrlsResubmitted === false, 'previous changed-page notification audit is incomplete');
requireValue(previousChangedPageIndexNow.id === 'INDEXNOW-2026-08-27-05' && previousChangedPageIndexNow.accepted === true && previousChangedPageIndexNow.urlCount === 1, 'previous changed-page IndexNow evidence is invalid');
requireValue(audit.indexNow?.latestMeaningfulChange?.record === 'docs/company/search/indexnow-submission-2026-08-27-06.json', 'latest changed-page notification evidence link is missing');
requireValue(audit.indexNow?.latestMeaningfulChange?.accepted === true && audit.indexNow?.latestMeaningfulChange?.urlCount === 1 && audit.indexNow?.latestMeaningfulChange?.unchangedUrlsResubmitted === false, 'latest changed-page notification audit is incomplete');
requireValue(changedPageIndexNow.id === 'INDEXNOW-2026-08-27-06' && changedPageIndexNow.host === 'mythicalvoid.com', 'changed-page IndexNow evidence identity is invalid');
requireValue(changedPageIndexNow.accepted === true && changedPageIndexNow.httpStatus === 200 && changedPageIndexNow.urlCount === 1, 'changed-page IndexNow acceptance evidence is incomplete');
requireValue(JSON.stringify(changedPageIndexNow.urls) === JSON.stringify(['https://mythicalvoid.com/playable-now/']), 'changed-page IndexNow URL list drifted');
requireValue(changedPageIndexNow.unchangedSitemapUrlsResubmitted === false && /does not prove/i.test(changedPageIndexNow.meaning || ''), 'changed-page IndexNow boundary is missing');
for (const field of ['personalDataSent', 'accountUsed', 'paidPromotionStarted']) requireValue(changedPageIndexNow[field] === false, `changed-page IndexNow boundary ${field} must remain false`);
requireValue(audit.indexNow?.previousOwnedChangeNotice?.record === 'docs/company/search/indexnow-submission-2026-09-08-hatch-news.json', 'previous owned changed-page notification evidence link is missing');
requireValue(previousOwnedChangeIndexNow.id === 'INDEXNOW-2026-09-08-HATCH-NEWS' && previousOwnedChangeIndexNow.accepted === true && previousOwnedChangeIndexNow.urlCount === 3, 'previous owned changed-page IndexNow evidence is invalid');
requireValue(audit.indexNow?.newestOwnedChangeNotice?.record === 'docs/company/search/indexnow-submission-2026-09-08-hatch-first-screen.json', 'newest owned changed-page notification evidence link is missing');
requireValue(audit.indexNow?.newestOwnedChangeNotice?.accepted === true && audit.indexNow?.newestOwnedChangeNotice?.urlCount === 1 && audit.indexNow?.newestOwnedChangeNotice?.unchangedUrlsResubmitted === false, 'newest owned changed-page notification audit is incomplete');
requireValue(audit.indexNow?.newestOwnedChangeNotice?.indexingClaimed === false, 'newest owned changed-page notice must not claim indexing');
requireValue(newestOwnedChangeIndexNow.id === 'INDEXNOW-2026-09-08-HATCH-FIRST-SCREEN' && newestOwnedChangeIndexNow.host === 'mythicalvoid.com', 'newest owned changed-page IndexNow evidence identity is invalid');
requireValue(newestOwnedChangeIndexNow.accepted === true && newestOwnedChangeIndexNow.httpStatus === 200 && newestOwnedChangeIndexNow.urlCount === 1, 'newest owned changed-page IndexNow acceptance evidence is incomplete');
requireValue(newestOwnedChangeIndexNow.canonicalSitemapCount === 2, 'newest owned changed-page notice did not use both canonical sitemaps');
requireValue(JSON.stringify(newestOwnedChangeIndexNow.urls) === JSON.stringify([
    'https://mythicalvoid.com/hatch-challenge/'
]), 'newest owned changed-page IndexNow URL list drifted');
requireValue(newestOwnedChangeIndexNow.unchangedSitemapUrlsResubmitted === false && /does not prove/i.test(newestOwnedChangeIndexNow.meaning || ''), 'newest owned changed-page IndexNow boundary is missing');
for (const field of ['personalDataSent', 'accountUsed', 'paidPromotionStarted']) requireValue(newestOwnedChangeIndexNow[field] === false, `newest owned changed-page IndexNow boundary ${field} must remain false`);
requireValue(audit.indexNow?.latestOwnedChangeNotice?.record === 'docs/company/search/indexnow-submission-2026-09-09-mobile-homepage.json', 'latest owned changed-page notification evidence link is missing');
requireValue(audit.indexNow?.latestOwnedChangeNotice?.accepted === true && audit.indexNow?.latestOwnedChangeNotice?.urlCount === 1 && audit.indexNow?.latestOwnedChangeNotice?.unchangedUrlsResubmitted === false, 'latest owned changed-page notification audit is incomplete');
requireValue(audit.indexNow?.latestOwnedChangeNotice?.indexingClaimed === false, 'latest owned changed-page notice must not claim indexing');
requireValue(latestOwnedChangeIndexNow.id === 'INDEXNOW-2026-09-09-MOBILE-HOMEPAGE' && latestOwnedChangeIndexNow.host === 'mythicalvoid.com', 'latest owned changed-page IndexNow evidence identity is invalid');
requireValue(latestOwnedChangeIndexNow.submittedAt === null && latestOwnedChangeIndexNow.submittedOn === '2026-09-09' && latestOwnedChangeIndexNow.responseTimeRecorded === false, 'latest owned changed-page notice invents an exact response time');
requireValue(latestOwnedChangeIndexNow.accepted === true && latestOwnedChangeIndexNow.httpStatus === 200 && latestOwnedChangeIndexNow.urlCount === 1, 'latest owned changed-page IndexNow acceptance evidence is incomplete');
requireValue(latestOwnedChangeIndexNow.canonicalSitemapCount === 2, 'latest owned changed-page notice did not use both canonical sitemaps');
requireValue(JSON.stringify(latestOwnedChangeIndexNow.urls) === JSON.stringify([
    'https://mythicalvoid.com/'
]), 'latest owned changed-page IndexNow URL list drifted');
requireValue(latestOwnedChangeIndexNow.unchangedSitemapUrlsResubmitted === false && /does not prove/i.test(latestOwnedChangeIndexNow.meaning || ''), 'latest owned changed-page IndexNow boundary is missing');
for (const field of ['personalDataSent', 'accountUsed', 'paidPromotionStarted']) requireValue(latestOwnedChangeIndexNow[field] === false, `latest owned changed-page IndexNow boundary ${field} must remain false`);

requireValue(homepage.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), 'homepage index instruction is missing');
requireValue(homepage.includes('<link rel="canonical" href="https://mythicalvoid.com/">'), 'homepage canonical is missing');
for (const phrase of [
    'data-static-search-entry',
    'Hatch something strange. Restore six living realms.',
    'alien creature shaped by a genetics system',
    'decide what Project Beacon should tell Earth',
    'Free to play · No download · No account needed',
    'href="/play/"',
    'href="/playable-now/"',
    'href="/parents/"',
    'href="https://github.com/TechevolveAI/Mythical-Void" rel="me noopener noreferrer"',
    "document.documentElement.dataset.initialRoute = isGameRoute ? 'game' : 'site'",
    'html[data-initial-route="game"] .site-entry-fallback'
]) requireValue(homepage.includes(phrase), `plain homepage entry is missing: ${phrase}`);
requireValue(!/\bcompanions?\b|every creature is unique|no two creatures|infinite creatures|truly yours/i.test(homepage), 'homepage contains retired or unsupported creature wording');
for (const phrase of [
    '"@type": "WebSite"',
    '"@id": "https://mythicalvoid.com/#website"',
    '"name": "Mythical Void"',
    '"alternateName": "mythicalvoid.com"',
    '"@type": "Organization"',
    '"@id": "https://mythicalvoid.com/#studio"',
    '"sameAs": ["https://github.com/TechevolveAI/Mythical-Void"]',
    '"@id": "https://mythicalvoid.com/#video-game"',
    '"publisher": { "@id": "https://mythicalvoid.com/#studio" }'
]) requireValue(homepage.includes(phrase), `homepage identity markup is missing: ${phrase}`);
requireValue(audit.homepageIdentityMarkup?.productionState === 'live', 'homepage identity markup live state is stale');
requireValue(/^[0-9a-f]{40}$/.test(audit.homepageIdentityMarkup?.verifiedProductionCommit || ''), 'homepage identity production commit is missing');
requireValue(/^[0-9a-f]{24}$/.test(audit.homepageIdentityMarkup?.verifiedProductionDeployId || ''), 'homepage identity production deploy is missing');
requireValue(audit.homepageIdentityMarkup?.websiteNodePresent === true && audit.homepageIdentityMarkup?.studioNodePresent === true && audit.homepageIdentityMarkup?.gameLinkedToWebsiteAndStudio === true, 'homepage identity markup record is incomplete');
requireValue(audit.homepageIdentityMarkup?.indexingOrRankingClaimed === false, 'homepage identity markup must not claim indexing or ranking');
requireValue(audit.searchConsoleAccessCheck?.signedIn === true && audit.searchConsoleAccessCheck?.mythicalVoidPropertyAccessible === false && audit.searchConsoleAccessCheck?.finishVerificationListContainsMythicalVoid === false && audit.searchConsoleAccessCheck?.externalMutationPerformed === false, 'read-only Search Console absence check is incomplete');
requireValue(audit.publicGitHubDoorway?.repository === 'https://github.com/TechevolveAI/Mythical-Void' && audit.publicGitHubDoorway?.repositoryPublic === true, 'public GitHub doorway repository record is missing');
requireValue(audit.publicGitHubDoorway?.previousDescriptionPresent === false && audit.publicGitHubDoorway?.previousHomepagePresent === false, 'public GitHub doorway baseline is missing');
requireValue(audit.publicGitHubDoorway?.descriptionLive === 'Free browser adventure: hatch an alien creature, cross six living realms, and shape Project Beacon. No download or account.', 'public GitHub description evidence is missing');
requireValue(audit.publicGitHubDoorway?.homepageLive === 'https://mythicalvoid.com/playable-now/', 'public GitHub homepage evidence is missing');
const expectedGitHubTopics = ['browser-game', 'creature-game', 'indie-game', 'javascript', 'phaser', 'science-fiction', 'stem', 'early-access', 'family-friendly', 'free-game', 'generative-ai', 'html5-game', 'space-game', 'web-game'];
requireValue(JSON.stringify(audit.publicGitHubDoorway?.topicsLive) === JSON.stringify(expectedGitHubTopics), 'public GitHub topic evidence is missing');
requireValue(/^2026-09-08T\d{2}:\d{2}:\d{2}Z$/.test(audit.publicGitHubDoorway?.topicsCheckedAt || '') && audit.publicGitHubDoorway?.topicExpansionCompleted === true, 'public GitHub topic expansion evidence is missing');
requireValue(audit.publicGitHubDoorway?.topicExpansionMeaning === 'The public repository now uses more accurate discovery labels for the game. This does not prove impressions, visits, plays or ranking.', 'public GitHub topic meaning boundary is missing');
requireValue(audit.publicGitHubDoorway?.readmePlayLinkPrepared === true && audit.publicGitHubDoorway?.readmeFamilyAndPressLinksPrepared === true && audit.publicGitHubDoorway?.truthAndVisualBoundariesPrepared === true, 'public GitHub doorway preparation is incomplete');
requireValue(audit.publicGitHubDoorway?.metadataUpdatePendingReviewedMerge === false && audit.publicGitHubDoorway?.readmeUpdatePendingReviewedMerge === false && audit.publicGitHubDoorway?.readmeLive === true && audit.publicGitHubDoorway?.reciprocalOfficialWebsiteLinkPrepared === true && audit.publicGitHubDoorway?.indexingOrRankingClaimed === false, 'public GitHub doorway authority boundary is missing');
requireValue(playable.includes('<link rel="canonical" href="https://mythicalvoid.com/playable-now/">'), 'Playable Now canonical is missing');
requireValue(robots.includes('User-agent: *') && robots.includes('Allow: /'), 'robots crawl permission is missing');
requireValue(robots.includes('Sitemap: https://mythicalvoid.com/sitemap.xml'), 'robots sitemap line is missing');
for (const url of ['https://mythicalvoid.com/', 'https://mythicalvoid.com/playable-now/', 'https://mythicalvoid.com/creature-genetics/', 'https://mythicalvoid.com/story/', 'https://mythicalvoid.com/parents/']) {
    requireValue(sitemap.includes(`<loc>${url}</loc>`), `sitemap is missing ${url}`);
}

for (const phrase of ['**Cost:** free', 'does not require another Google Workspace subscription', 'Search Console is verified.', 'Do not paste passwords', 'Do not keep pressing Request indexing', 'does not authorize paid adverts']) {
    requireValue(handoff.includes(phrase), `Search Console handoff is missing: ${phrase}`);
}
for (const phrase of ['warning, not proof', 'There is no obvious public technical block', 'No ranking is claimed', 'official IndexNow endpoint', 'does not guarantee crawling']) {
    requireValue(report.includes(phrase), `plain-language audit is missing: ${phrase}`);
}
for (const phrase of ['not in this public sample yet', 'Public project', 'no earlier than 15 September 2026', 'no search result was called a player or a play']) {
    requireValue(followUpReport.includes(phrase), `plain-language follow-up is missing: ${phrase}`);
}
requireValue(packageJson.scripts?.['validate:search-visibility'] === 'node scripts/company/validate-search-visibility-activation.cjs', 'search visibility validator command is missing');
requireValue(packageJson.scripts?.['test:search-visibility'] === 'node scripts/company/test-search-visibility-activation.cjs', 'search visibility safeguard command is missing');

if (failures.length) {
    console.error('Search visibility activation is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    state: audit.state,
    sampledQueries: 16,
    sampledMythicalResults: 0,
    technicalCrawlChecksPassing: Object.keys(audit.liveTechnicalChecks).length,
    staticHomepageEntryPresent: true,
    homepageIdentityMarkupLive: true,
    publicGitHubMetadataLive: true,
    publicGitHubReadmePrepared: true,
    liveOwnedSearchRoutes: opportunityMap.clusters.length,
    searchConsoleConnected: false,
    indexNowAccepted: true,
    latestChangedPagesNotified: latestOwnedChangeIndexNow.urlCount,
    externalActionTaken: true
}, null, 2));
