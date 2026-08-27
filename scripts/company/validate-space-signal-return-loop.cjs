#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('public/space-signal/index.html');
const client = read('public/space-signal/space-signal.js');
const styles = read('public/space-signal/space-signal.css');
const core = read('netlify/lib/space-signal-core.cjs');
const nasaPage = read('public/nasa-space-science/index.html');
const storefront = read('src/site/storefront.js');
const sitemap = read('public/sitemap.xml');
const llms = read('public/llms.txt');
const netlify = read('netlify.toml');
const vercel = read('vercel.json');
const release = JSON.parse(read('docs/company/growth/SPACE_SIGNAL_RETURN_LOOP.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(page.includes("TODAY'S SPACE SIGNAL"), 'page does not lead with the repeatable return reason');
requireValue(page.includes('REAL NASA SOURCE'), 'real source label is missing');
requireValue(page.includes('MYTHICAL VOID IMAGINES'), 'fiction boundary label is missing');
requireValue(page.includes('NOT A NASA IMAGE'), 'procedural visual is not clearly labelled');
requireValue(page.includes('NASA does not make, approve or endorse Mythical Void'), 'NASA non-endorsement is missing');
requireValue(page.includes('No signup. No notification.'), 'return promise adds avoidable signup friction');
requireValue(page.includes('data-share-url="https://mythicalvoid.com/space-signal/"'), 'clean share URL is missing');
requireValue(page.includes('<script type="application/ld+json">'), 'learning resource structured data is missing');
requireValue(client.includes("fetch('/api/space-signal'"), 'client does not use the owned cached endpoint');
requireValue(!/localStorage|sessionStorage/.test(client), 'Space Signal should not store a visitor profile or return history');
requireValue(!/api\.nasa\.gov|apod\.nasa\.gov/.test(client), 'browser must not call NASA directly');
requireValue(styles.includes('@media (prefers-reduced-motion: reduce)'), 'procedural motion lacks a reduced-motion boundary');

requireValue(core.includes('nasaImageRepublished: false'), 'function does not declare the media boundary');
requireValue(!/data\?\.url|data\?\.hdurl|data\?\.explanation|data\?\.copyright/.test(core), 'function republishes an APOD media or rights field');
requireValue(core.includes("'Netlify-CDN-Cache-Control'"), 'NASA request is not protected by durable caching');
requireValue(core.includes("env.NASA_API_KEY || env.VITE_NASA_API_KEY || 'DEMO_KEY'"), 'server-side NASA key fallback is missing');

requireValue(nasaPage.includes('href="/space-signal/"'), 'NASA/STEM page does not open the daily signal');
requireValue(storefront.includes("href=\"/space-signal/\">Open today's Space Signal"), 'homepage does not expose the return loop');
requireValue(sitemap.includes('<loc>https://mythicalvoid.com/space-signal/</loc>') && sitemap.includes('<changefreq>daily</changefreq>'), 'sitemap does not describe the daily route');
requireValue(llms.includes('[Today\'s Space Signal](https://mythicalvoid.com/space-signal/)'), 'AI-readable guide omits the Space Signal');
requireValue(netlify.includes('from = "/space-signal/"') && netlify.includes('to = "/space-signal/index.html"'), 'Netlify route is missing');
requireValue(vercel.includes('"source": "/space-signal/"') && vercel.includes('"destination": "/space-signal/index.html"'), 'Vercel route is missing');

requireValue(release.status === 'live', 'release is not recorded as live');
requireValue(release.productionEvidence?.pageReturned === 200, 'public page verification is missing');
requireValue(release.productionEvidence?.desktopVisualReview === 'passed', 'production visual review is missing');
requireValue(release.source?.fieldsUsed?.join(',') === 'title,date', 'release uses more NASA fields than intended');
requireValue(release.source?.fieldsNotRepublished?.includes('copyright'), 'release omits the APOD rights boundary');
for (const [key, expected] of Object.entries({
    accountRequired: false,
    emailCollected: false,
    contactCollected: false,
    recipientCollected: false,
    playerProfileCreated: false,
    localStorageUsed: false,
    trackingParametersAdded: false,
    browserCallsNasaDirectly: false
})) requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
for (const [key, expected] of Object.entries({
    nasaEndorsementClaimed: false,
    nasaLogoUsed: false,
    dailyNasaImageRepublished: false,
    scienceAndFictionSeparated: true,
    fallbackAvailable: true
})) requireValue(release.governance?.[key] === expected, `governance.${key} must be ${expected}`);

console.log(JSON.stringify({
    route: '/space-signal/',
    valid: failures.length === 0,
    sourceFields: release.source?.fieldsUsed,
    dailyNasaImageRepublished: release.governance?.dailyNasaImageRepublished,
    browserCallsNasaDirectly: release.privacy?.browserCallsNasaDirectly,
    failures
}, null, 2));

if (failures.length) process.exit(1);
