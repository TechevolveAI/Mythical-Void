#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const audit = JSON.parse(read('docs/company/search/search-visibility-audit-2026-08-27.json'));
const indexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27.json'));
const previousChangedPageIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27-05.json'));
const changedPageIndexNow = JSON.parse(read('docs/company/search/indexnow-submission-2026-08-27-06.json'));
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
requireValue(audit.state === 'crawl_submission_accepted_visibility_unverified', 'search visibility state is overstated');
requireValue(audit.sample?.queryCount === 4 && audit.sample?.queries?.length === 4, 'four-query sample boundary is missing');
requireValue(audit.sample?.queries?.every(item => item.mythicalResultObserved === false), 'sample result was changed without a new dated audit');
requireValue(/cannot prove global non-indexing/i.test(audit.sample?.limitations || ''), 'search sample limitation is missing');
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

requireValue(homepage.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), 'homepage index instruction is missing');
requireValue(homepage.includes('<link rel="canonical" href="https://mythicalvoid.com/">'), 'homepage canonical is missing');
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
    sampledQueries: 4,
    sampledMythicalResults: 0,
    technicalCrawlChecksPassing: Object.keys(audit.liveTechnicalChecks).length,
    liveOwnedSearchRoutes: opportunityMap.clusters.length,
    searchConsoleConnected: false,
    indexNowAccepted: true,
    latestChangedPagesNotified: changedPageIndexNow.urlCount,
    externalActionTaken: true
}, null, 2));
