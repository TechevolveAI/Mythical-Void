#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const correctionPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/search/TECHEVOLVEAI_MYTHICAL_VOID_CORRECTION_2026-08-14.json');
const readablePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/search/TECHEVOLVEAI_MYTHICAL_VOID_CORRECTION_2026-08-14.md');
const correction = JSON.parse(fs.readFileSync(correctionPath, 'utf8'));
const readable = fs.readFileSync(readablePath, 'utf8');
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(correction.schemaVersion === 1, 'Search referral correction schemaVersion must be 1.');
requireValue(correction.state === 'correction_ready_external_site_unchanged', 'Search referral correction must remain prepared with the external site unchanged.');
requireValue(correction.source?.page === 'https://www.techevolveai.com/' && correction.source?.searchQuery === '\"Mythical Void\" free browser game', 'Correction must retain the exact related source and sampled query.');
requireValue(correction.source?.currentLiveClaim === 'Every creature is unique.', 'Correction must retain the current unsupported live claim as evidence.');
requireValue(correction.source?.cachedSearchExcerptAlsoObserved?.length === 2 && correction.source?.cachedExcerptCaution?.includes('older crawl'), 'Correction must distinguish the possibly stale search excerpt from the current page.');
requireValue(correction.problems?.length === 4, 'Correction must retain all four accuracy problems.');
requireValue(correction.updateChecklist?.length === 6 && correction.successChecks?.length === 5, 'Correction must retain its update and success checks.');

const replacement = correction.approvedReplacement || {};
requireValue(/free browser adventure/i.test(replacement.eyebrow || ''), 'Replacement must immediately explain that this is a free browser adventure.');
requireValue(/genetically varied alien creature/i.test(replacement.description || ''), 'Replacement must use evidence-backed varied-creature wording.');
requireValue(/six living realms/i.test(replacement.description || ''), 'Replacement must use the current six-realm description.');
requireValue(/father-and-son experiment/i.test(replacement.description || ''), 'Replacement must retain the honest founder origin.');
requireValue(replacement.ctaUrl === 'https://mythicalvoid.com/', 'Replacement must link directly to the owned homepage.');

const publicReplacement = `${replacement.eyebrow}\n${replacement.heading}\n${replacement.description}\n${replacement.cta}\n${replacement.optionalTrustLine}\n${readable}`;
requireValue(!/\bcompanions?\b/i.test(publicReplacement), 'Replacement must use creature language.');
requireValue(!/\bevery creature is unique\b|\b1-of-1\b|\bcompletely unique\b/i.test(`${replacement.eyebrow}\n${replacement.description}\n${replacement.optionalTrustLine}`), 'Replacement must not repeat an absolute uniqueness promise.');
requireValue(/Nothing has been changed on TechEvolveAI/i.test(readable), 'Human-readable correction must clearly say the external site is unchanged.');

for (const field of ['externalSiteEditAuthorized', 'externalSitePublicationAuthorized', 'searchRecrawlAuthorized', 'rankingClaimAuthorized', 'paidSearchAuthorized', 'externalActionAuthorized']) {
    requireValue(correction.authority?.[field] === false, `${field} must remain false.`);
}

if (errors.length) {
    console.error(`Search referral correction validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Search referral correction valid: one evidence-backed replacement, 4 problems, 6 update checks, no external edit, publication, recrawl, ranking claim or spend authorized.');
