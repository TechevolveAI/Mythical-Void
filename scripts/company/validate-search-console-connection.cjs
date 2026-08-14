#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const connectionPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'docs/company/search/SEARCH_CONSOLE_CONNECTION.json');
const connection = JSON.parse(fs.readFileSync(connectionPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(connection.schemaVersion === 1 && connection.id === 'SEARCH-CONSOLE-CONNECTION-2026-08-14', 'Search Console connection identity is invalid.');
requireValue(connection.cost === 'free_service' && /existing Google account/i.test(connection.accountDecision || ''), 'Existing-account and free-service decisions must remain explicit.');
requireValue(connection.property?.recommendedType === 'domain' && connection.property?.name === 'mythicalvoid.com' && connection.property?.verificationMethod === 'dns_txt', 'Approved Domain property configuration must remain intact.');
requireValue(connection.sitemap?.url === 'https://mythicalvoid.com/sitemap.xml' && connection.sitemap?.publicStatusObserved === 200 && connection.sitemap?.publicRouteCountObserved === 9, 'Live sitemap foundation must remain recorded accurately.');
requireValue(connection.privacy?.googleAccountAddressStored === false && connection.privacy?.dnsVerificationTokenStored === false && connection.privacy?.screenshotsWithPersonalAccountDetailsStored === false, 'No Google account detail, DNS token or personal screenshot may be stored.');
requireValue(connection.authority?.kevinManualVerificationRequired === true && connection.authority?.dnsChangeByStudioAuthorized === false && connection.authority?.searchConsoleMutationByStudioAuthorized === false, 'Search Console and DNS changes must remain Kevin-controlled.');
requireValue(connection.authority?.paidSearchAuthorized === false && connection.authority?.rankingClaimAuthorized === false, 'Paid search and ranking claims must remain unauthorized.');

const verified = connection.property?.googleSearchConsoleConnected === true;
if (verified) {
    requireValue(connection.property?.verifiedPropertyEvidenceAvailable === true && connection.property?.verifiedBy === 'Kevin Murphy' && /^\d{4}-\d{2}-\d{2}T/.test(connection.property?.verifiedAt || ''), 'Connected property must retain Kevin\'s dated verification evidence.');
} else {
    requireValue(connection.state === 'waiting_for_existing_google_account_domain_verification', 'Unconnected state must remain waiting for Domain verification.');
    requireValue(connection.property?.verifiedPropertyEvidenceAvailable === false && connection.property?.verifiedBy === null && connection.property?.verifiedAt === null, 'Unconnected property must not contain invented verification evidence.');
}

if (connection.sitemap?.submittedByStudio === true) {
    requireValue(verified, 'Sitemap submission cannot precede property verification.');
    requireValue(['Success', 'Has errors', 'Pending'].includes(connection.sitemap.searchConsoleStatus), 'Submitted sitemap must retain its exact Search Console status.');
    requireValue(/^\d{4}-\d{2}-\d{2}T/.test(connection.sitemap.submittedAt || ''), 'Submitted sitemap must retain its dated evidence.');
} else {
    requireValue(connection.sitemap?.submittedAt === null && connection.sitemap?.searchConsoleStatus === null && connection.sitemap?.lastReadAt === null && connection.sitemap?.discoveredUrls === null, 'Unsubmitted sitemap must not contain invented Search Console values.');
}

for (const field of ['indexCoverageKnown', 'rankingKnown', 'searchTrafficKnown', 'trustedForCompanyDecisions']) {
    requireValue(connection.reporting?.[field] === false, `${field} must remain false until separate report evidence is recorded.`);
}

if (errors.length) {
    console.error(`Search Console connection validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Search Console connection valid: Domain ${verified ? 'verified' : 'waiting'}, sitemap ${connection.sitemap.submittedByStudio ? connection.sitemap.searchConsoleStatus : 'not submitted'}, indexing and ranking claims still closed.`);
