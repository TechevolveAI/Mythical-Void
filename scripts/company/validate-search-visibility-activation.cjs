#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const audit = JSON.parse(read('docs/company/search/search-visibility-audit-2026-08-27.json'));
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
requireValue(audit.state === 'crawl_ready_visibility_unverified', 'search visibility state is overstated');
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
for (const field of ['searchConsoleConnectionAuthorized', 'ownershipVerificationAuthorized', 'sitemapSubmissionAuthorized', 'urlInspectionRequestAuthorized', 'paidSearchAuthorized', 'linkOutreachAuthorized', 'externalActionTaken']) {
    requireValue(audit.authority?.[field] === false, `${field} must remain false`);
}

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
for (const phrase of ['warning, not proof', 'There is no obvious public technical block', 'No ranking is claimed']) {
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
    externalActionTaken: false
}, null, 2));
