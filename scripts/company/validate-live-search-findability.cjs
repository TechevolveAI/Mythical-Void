#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const evidencePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/search/LIVE_SEARCH_FINDABILITY_EVIDENCE_2026-08-14.json');
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(evidence.schemaVersion === 1, 'Live search evidence schemaVersion must be 1.');
requireValue(evidence.state === 'crawl_foundation_live_related_result_observed_owned_discovery_not_observed', 'Live search evidence must retain the crawlable site, visible related result and missing owned result.');
requireValue(/^2026-08-14T/.test(evidence.checkedAt || ''), 'Live search evidence must retain its dated check.');

const crawl = evidence.ownedCrawlFoundation || {};
requireValue(crawl.homepageStatus === 200, 'Homepage must retain its observed 200 status.');
requireValue(crawl.robotsAllowsPublicCrawling === true && crawl.robotsDeclaresSitemap === true, 'Robots evidence must retain public crawling and sitemap declaration.');
requireValue(crawl.sitemapStatus === 200 && crawl.sitemapRouteCount === 9, 'Live sitemap evidence must retain nine reachable routes.');
requireValue(crawl.sitemapRoutes?.length === crawl.sitemapRouteCount, 'Live sitemap route count must match the recorded routes.');
requireValue(crawl.sitemapRoutes?.includes('/nasa-space-science/') && crawl.sitemapRoutes?.includes('/parents/'), 'The live sitemap must retain its STEM and parent routes.');
requireValue(crawl.sitemapRoutes?.includes('/story/'), 'The released story route must remain present in the live sitemap snapshot.');

const sample = evidence.publicSearchSample || {};
requireValue(sample.queryCount === 4 && sample.queries?.length === 4, 'Public search sample must retain all four queries.');
requireValue(sample.ownedResultObserved === false && sample.siteRestrictedResultObserved === false, 'Public search results must not be invented.');
requireValue(/small, dated search sample/i.test(sample.limitations || ''), 'Search-sample limitation must remain explicit.');
requireValue(/not an authenticated Google Search Console/i.test(sample.sampleSource || ''), 'Public search evidence must remain separate from Search Console evidence.');

const followUp = evidence.followUpSearchSample || {};
requireValue(followUp.query === '"Mythical Void" free browser game', 'Follow-up sample must retain the exact focused query.');
requireValue(followUp.ownedResultObserved === false && followUp.relatedResultObserved === true, 'Follow-up sample must retain the missing owned result and observed related result.');
requireValue(followUp.relatedResultHost === 'www.techevolveai.com' && followUp.currentRelatedPageClaim === 'Every creature is unique.', 'Follow-up sample must retain the related host and unsupported current claim.');
requireValue(followUp.cachedExcerptMayBeStale === true && /one dated public query/i.test(followUp.limitations || ''), 'Follow-up sample must retain its cache and sampling limitations.');
requireValue(fs.existsSync(path.resolve(root, followUp.correctionRef || '')), 'Prepared related-site correction must exist.');

const webmaster = evidence.webmasterEvidence || {};
for (const field of ['googleSearchConsoleConnected', 'verifiedPropertyEvidenceAvailable', 'sitemapSubmittedByStudio', 'indexCoverageKnown', 'rankingKnown', 'searchTrafficKnown']) {
    requireValue(webmaster[field] === false, `${field} must remain false without authenticated evidence.`);
}
for (const field of ['searchConsoleAccessAuthorized', 'searchEngineSubmissionAuthorized', 'paidSearchAuthorized', 'linkOutreachAuthorized', 'rankingClaimAuthorized']) {
    requireValue(evidence.authority?.[field] === false, `${field} must remain unauthorized.`);
}
requireValue(/does not require creating a new Mythical Void email address/i.test(evidence.nextKevinAction || ''), 'Search Console handoff must respect the existing-email decision.');
requireValue(/Do not claim indexing, rankings or search traffic/i.test(evidence.nextStudioAction || ''), 'The studio truth boundary must remain explicit.');

if (errors.length) {
    console.error(`Live search findability validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Live search evidence valid: homepage and ${crawl.sitemapRouteCount}-route sitemap reachable, no owned result observed, one related result needs a prepared truth correction, Search Console still unverified.`);
