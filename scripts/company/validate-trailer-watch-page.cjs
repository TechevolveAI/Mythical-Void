#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const failures = [];

const page = read('public/trailer/index.html');
const styles = read('public/discovery.css');
const sitemap = read('public/sitemap.xml');
const storefront = read('src/site/storefront.js');
const netlify = read('netlify.toml');
const vercel = JSON.parse(read('vercel.json'));
const release = JSON.parse(read('docs/company/content/channel-launch/TRAILER_PAGE_RELEASE.json'));
const trailerManifest = JSON.parse(read('public/press/trailer/manifest.json'));

function requireText(source, text, label) {
    if (!source.includes(text)) failures.push(`${label} is missing: ${text}`);
}

const requiredAssets = [
    'public/press/trailer/mythical-void-play-free-launch-trailer.mp4',
    'public/press/trailer/mythical-void-play-free-launch-trailer-poster.jpg',
    'public/press/trailer/mythical-void-play-free-launch-trailer.vtt'
];
requiredAssets.forEach(asset => { if (!exists(asset)) failures.push(`missing trailer asset ${asset}`); });

requireText(page, '<link rel="canonical" href="https://mythicalvoid.com/trailer/">', 'canonical address');
requireText(page, 'property="og:image" content="https://mythicalvoid.com/press/trailer/mythical-void-play-free-launch-trailer-poster.jpg"', 'social poster');
requireText(page, 'property="og:video" content="https://mythicalvoid.com/press/trailer/mythical-void-play-free-launch-trailer.mp4"', 'social video');
requireText(page, 'data-measure-trailer', 'privacy-gated trailer measurement marker');
requireText(page, 'href="/play/"', 'Play link');
requireText(page, 'No generated footage presented as gameplay', 'gameplay disclosure');
requireText(page, 'NASA does not endorse Mythical Void.', 'NASA boundary');
requireText(page, 'his nine-year-old son', 'father-and-son origin');
requireText(styles, '.trailer-stage video', 'trailer page styling');
requireText(storefront, 'href="/trailer/">Watch the official trailer', 'homepage trailer link');
requireText(netlify, 'from = "/trailer/"', 'Netlify trailer route');

const vercelTrailerRoute = (vercel.rewrites || []).find(rule => (
    rule.source === '/trailer/' && rule.destination === '/trailer/index.html'
));
const vercelFallbackIndex = (vercel.rewrites || []).findIndex(rule => rule.destination === '/index.html');
const vercelTrailerIndex = (vercel.rewrites || []).indexOf(vercelTrailerRoute);
if (!vercelTrailerRoute || vercelTrailerIndex < 0 || vercelTrailerIndex > vercelFallbackIndex) {
    failures.push('Vercel trailer route must appear before the SPA fallback');
}

if (/\bcompanions?\b/i.test(page)) failures.push('the public trailer page must use creatures, not companions');
if (trailerManifest.asset.durationSeconds !== 64) failures.push('trailer duration must remain 64 seconds');
if (trailerManifest.asset.width !== 1920 || trailerManifest.asset.height !== 1080) failures.push('trailer must remain 1920 by 1080');

const waiting = release.releaseState === 'waiting_for_kevin_trailer_review';
const published = release.releaseState === 'approved_and_published';
if (!waiting && !published) failures.push('releaseState must be waiting_for_kevin_trailer_review or approved_and_published');

if (waiting) {
    requireText(page, '<meta name="robots" content="noindex, follow, max-image-preview:large">', 'pre-approval search safety');
    if (release.productionPublished !== false) failures.push('productionPublished must remain false before approval');
    if (release.searchIndexingEnabled !== false) failures.push('searchIndexingEnabled must remain false before approval');
    if (release.sitemapEntryEnabled !== false) failures.push('sitemapEntryEnabled must remain false before approval');
    if (release.videoStructuredDataEnabled !== false) failures.push('videoStructuredDataEnabled must remain false before approval');
    if (release.publicUploadDate !== null) failures.push('publicUploadDate must remain null before actual publication');
    if (sitemap.includes('https://mythicalvoid.com/trailer/')) failures.push('trailer must not enter the sitemap before approval');
    if (page.includes('"@type": "VideoObject"')) failures.push('VideoObject must wait for a truthful public upload date');
}

if (published) {
    requireText(page, '<meta name="robots" content="index, follow, max-image-preview:large">', 'published search instruction');
    requireText(page, '"@type": "VideoObject"', 'published VideoObject data');
    requireText(sitemap, 'https://mythicalvoid.com/trailer/', 'published sitemap entry');
    if (release.productionPublished !== true || release.searchIndexingEnabled !== true
        || release.sitemapEntryEnabled !== true || release.videoStructuredDataEnabled !== true) {
        failures.push('all public release switches must be true after publication');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(release.publicUploadDate || '')) failures.push('published trailer needs its real ISO upload date');
    requireText(page, `"uploadDate": "${release.publicUploadDate}"`, 'published VideoObject upload date');
}

console.log(JSON.stringify({
    page: '/trailer/',
    releaseState: release.releaseState,
    dedicatedWatchPageReady: failures.length === 0,
    productionPublished: release.productionPublished,
    searchIndexingEnabled: release.searchIndexingEnabled,
    trailerDurationSeconds: trailerManifest.asset.durationSeconds,
    failures,
    nextDecision: waiting
        ? 'Kevin watches and approves the finished trailer, wording and poster before release.'
        : 'Use Search Console URL inspection after production publication.'
}, null, 2));

if (failures.length) process.exitCode = 1;
