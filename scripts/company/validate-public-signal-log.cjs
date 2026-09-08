#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildReleasePage,
    buildSignalLog,
    buildUpdatesSitemap,
    defaultDataPath,
    defaultMainSitemapPath,
    defaultOutputPath,
    latestPublishedDate,
    releaseUrl
} = require('./build-public-signal-log.cjs');

const root = path.resolve(__dirname, '../..');
const dataPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDataPath;
const pagePath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutputPath;
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const page = fs.readFileSync(pagePath, 'utf8');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const allowedKeys = new Set(['id', 'publishedOn', 'status', 'category', 'title', 'summary', 'details', 'image', 'imageAlt', 'imageClass', 'visualKind', 'visualAlt', 'disclosure', 'destination', 'linkText', 'download', 'releaseProof']);
const liveEntries = (data.entries || []).filter(entry => entry.status === 'live');

requireValue(data.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(data.page?.canonicalUrl === 'https://mythicalvoid.com/updates/', 'canonical URL must be the owned updates route');
for (const [field, expected] of Object.entries({ liveItemsOnly: true, commentsEnabled: false, contactCollectionEnabled: false, emailSignupEnabled: false, playerProfilesCreated: false, trackingParametersPermitted: false })) {
    requireValue(data.publicationBoundary?.[field] === expected, `publicationBoundary.${field} must be ${expected}`);
}
requireValue(liveEntries.length >= 2, 'Latest News needs at least two real live entries');

const ids = new Set();
for (const [index, entry] of (data.entries || []).entries()) {
    const label = entry?.id || `entries[${index}]`;
    for (const key of Object.keys(entry || {})) if (!allowedKeys.has(key)) failures.push(`${label} contains unsupported field ${key}`);
    requireValue(/^UPDATE-\d{3}$/.test(entry?.id || ''), `${label} has an invalid ID`);
    requireValue(!ids.has(entry?.id), `${label} is duplicated`);
    ids.add(entry?.id);
    requireValue(entry?.status === 'live' || entry?.status === 'withdrawn', `${label} has an unsupported publication status`);
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(entry?.publishedOn || ''), `${label} has an invalid publication date`);
    requireValue(!Number.isNaN(Date.parse(`${entry.publishedOn}T00:00:00Z`)), `${label} has an impossible publication date`);
    requireValue(Array.isArray(entry?.details) && entry.details.length === 3, `${label} must contain three checkable details`);
    const hasImage = Boolean(entry?.image);
    const hasSpaceSignalVisual = entry?.visualKind === 'space_discovery';
    const hasTextOnlyVisual = entry?.visualKind === 'text_only_release';
    requireValue(hasImage || hasSpaceSignalVisual || hasTextOnlyVisual, `${label} needs an approved image or supported code-native visual`);
    if (hasImage) {
        requireValue(/^\/(?!\/)/.test(entry.image), `${label} image must be an owned path`);
        requireValue(fs.existsSync(path.join(root, 'public', entry.image.replace(/^\//, ''))), `${label} image does not exist`);
    }
    if (hasSpaceSignalVisual) {
        requireValue(!entry.image && /not a NASA image/i.test(entry?.disclosure || '') && /not gameplay/i.test(entry?.disclosure || ''), `${label} Space Discovery visual lacks its source and gameplay boundary`);
        requireValue(typeof entry?.visualAlt === 'string' && entry.visualAlt.length >= 20, `${label} Space Discovery visual needs useful alternative text`);
    }
    if (hasTextOnlyVisual) {
        requireValue(!entry.image && /text-only release note/i.test(entry?.disclosure || '') && /no screenshot or generated image/i.test(entry?.disclosure || ''), `${label} text-only release lacks its media boundary`);
        requireValue(typeof entry?.visualAlt === 'string' && entry.visualAlt.length >= 20, `${label} text-only release needs useful alternative text`);
        requireValue(/^[0-9a-f]{40}$/.test(entry.releaseProof?.sourceCommit || ''), `${label} text-only release needs an exact source commit`);
        requireValue(/^[0-9a-f]{40}$/.test(entry.releaseProof?.productionMergeCommit || ''), `${label} text-only release needs an exact production merge commit`);
        requireValue(/^[0-9a-f]{24}$/.test(entry.releaseProof?.productionDeployId || ''), `${label} text-only release needs an exact production deploy ID`);
        requireValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.releaseProof?.productionPublishedAt || ''), `${label} text-only release needs a production publication time`);
        requireValue(entry.releaseProof?.checkedUrl === 'https://mythicalvoid.com/play/' && entry.releaseProof?.checkedHttpStatus === 200, `${label} text-only release needs the checked live game doorway`);
        requireValue(entry.releaseProof?.gameplayVisualApproved === false && entry.releaseProof?.mediaAttached === false, `${label} text-only release must not imply visual approval or attached media`);
        requireValue(/do not prove visual quality, play, enjoyment or growth/i.test(entry.releaseProof?.claimBoundary || ''), `${label} text-only proof needs its claim boundary`);
    }
    requireValue(/^\/(?!\/)/.test(entry?.destination || ''), `${label} destination must be an owned path`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(entry?.destination || ''), `${label} contains a tracking parameter`);
    requireValue(!/\bcompanions?\b/i.test(JSON.stringify(entry)), `${label} uses retired companion wording`);
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(JSON.stringify(entry)), `${label} contains an unsupported uniqueness promise`);
    requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(JSON.stringify(entry)), `${label} contains an unverified audience metric`);
    if (entry?.imageClass === 'ai_generated_marketing_illustration') requireValue(/not gameplay/i.test(entry?.disclosure || ''), `${label} generated artwork lacks a not-gameplay disclosure`);
    if (entry?.imageClass === 'authentic_running_build_screenshot') requireValue(/real browser game/i.test(entry?.disclosure || ''), `${label} gameplay image lacks a real-game disclosure`);
    if ((entry?.imageClass || '').startsWith('branded_social_artwork_with_authentic_gameplay_frame')) requireValue(/branded sharing artwork/i.test(entry?.disclosure || '') && /not a raw screenshot/i.test(entry?.disclosure || '') && /no player information/i.test(entry?.disclosure || ''), `${label} branded sharing artwork lacks its layout, gameplay and privacy disclosure`);
    if (entry?.imageClass === 'branded_social_video_poster_with_authentic_running_build_gameplay') requireValue(/branded social edit/i.test(entry?.disclosure || '') && /complete real gameplay frame/i.test(entry?.disclosure || '') && /not gameplay/i.test(entry?.disclosure || '') && /No player identity or private save/i.test(entry?.disclosure || ''), `${label} branded gameplay-video poster lacks its edit, gameplay and privacy disclosure`);
    if (/nasa/i.test(entry?.imageClass || '')) requireValue(/NASA does not endorse Mythical Void/i.test(entry?.disclosure || ''), `${label} NASA artwork lacks its non-endorsement boundary`);
    if (entry?.imageClass === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame') requireValue(/founder-story sharing artwork/i.test(entry?.disclosure || '') && /not a raw screenshot/i.test(entry?.disclosure || '') && /not gameplay/i.test(entry?.disclosure || '') && /real gameplay/i.test(entry?.disclosure || '') && /no player information/i.test(entry?.disclosure || '') && /identifying detail of the child/i.test(entry?.disclosure || ''), `${label} founder-story artwork lacks its generated-art, gameplay, privacy or child-identity boundary`);
}

requireValue(page === buildSignalLog(data), 'Latest News page is stale; rebuild it from releases.json');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), 'page must be indexable');
requireValue(page.includes('<script type="application/ld+json">'), 'page needs structured data');
requireValue(page.includes('rel="alternate" type="application/rss+xml"'), 'page must advertise its RSS feed');
requireValue(page.includes('rel="alternate" type="application/feed+json"'), 'page must advertise its JSON feed');
requireValue(page.includes('href="/updates/feed.xml">Follow the news</a>'), 'page must give people a visible way to follow the news');
requireValue(page.includes('href="/updates/feed.json">JSON feed</a>'), 'page must explain the machine-readable feed');
requireValue(page.includes('No vague promises and no invented player numbers.'), 'page must state its evidence boundary plainly');
requireValue(!/\bcompanions?\b/i.test(page), 'public page uses retired companion wording');

const updatesDir = path.dirname(defaultOutputPath);
const updatesSitemapPath = path.join(updatesDir, 'sitemap.xml');
const updatesSitemap = fs.existsSync(updatesSitemapPath) ? fs.readFileSync(updatesSitemapPath, 'utf8') : '';
requireValue(updatesSitemap === buildUpdatesSitemap(data), 'Latest News sitemap is stale or missing');
const mainSitemap = fs.existsSync(defaultMainSitemapPath) ? fs.readFileSync(defaultMainSitemapPath, 'utf8') : '';
const updatesMainSitemapEntry = mainSitemap.match(/<url>\s*<loc>https:\/\/mythicalvoid\.com\/updates\/<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<changefreq>[^<]+<\/changefreq>\s*<priority>[^<]+<\/priority>\s*<\/url>/);
requireValue(Boolean(updatesMainSitemapEntry), 'main sitemap is missing its complete Latest News entry');
requireValue(updatesMainSitemapEntry?.[1] === latestPublishedDate(data), 'main sitemap Latest News date is stale');
for (const entry of liveEntries) {
    const entryPagePath = path.join(updatesDir, entry.id.toLowerCase(), 'index.html');
    const entryPage = fs.existsSync(entryPagePath) ? fs.readFileSync(entryPagePath, 'utf8') : '';
    requireValue(entryPage === buildReleasePage(data, entry), `${entry.id} permanent release page is stale or missing`);
    requireValue(entryPage.includes(`<link rel="canonical" href="${releaseUrl(entry)}">`), `${entry.id} permanent release page lost its canonical address`);
    requireValue(entryPage.includes('<meta property="og:type" content="article">'), `${entry.id} permanent release page lost its article preview`);
    requireValue(entryPage.includes('Brand art, not gameplay.'), `${entry.id} permanent release page lost its preview disclosure`);
    requireValue(entryPage.includes(`data-share-url="${releaseUrl(entry)}"`), `${entry.id} permanent release page lost its clean share address`);
    requireValue(/data-share-title="[^"]{20,}"/.test(entryPage) && /data-share-text="[^"]{60,}"/.test(entryPage), `${entry.id} permanent release page has weak share wording`);
    for (const control of ['data-share-card', 'data-share-game', 'data-copy-game', 'data-share-status']) {
        requireValue(entryPage.includes(control), `${entry.id} permanent release page lost ${control}`);
    }
    requireValue(entryPage.includes('never asks who receives it'), `${entry.id} permanent release page lost its sharing privacy promise`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(entryPage), `${entry.id} permanent release page contains tracking code`);
    requireValue(!/\bcompanions?\b/i.test(entryPage), `${entry.id} permanent release page uses retired companion wording`);
    requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(entryPage), `${entry.id} permanent release page contains an unverified audience metric`);
    let entryStructured;
    try {
        entryStructured = JSON.parse(entryPage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
    } catch (error) {
        failures.push(`${entry.id} permanent release page structured data is invalid: ${error.message}`);
    }
    requireValue(entryStructured?.['@type'] === 'Article' && entryStructured?.mainEntityOfPage === releaseUrl(entry), `${entry.id} permanent release page structured data is incomplete`);
}

for (const [file, expectedText, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/updates/</loc>', 'sitemap'],
    ['netlify.toml', 'from = "/updates/"', 'Netlify route'],
    ['vercel.json', '"source": "/updates/"', 'Vercel route'],
    ['src/site/storefront.js', 'href="/updates/">What\'s new', 'homepage link'],
    ['public/llms.txt', 'RSS updates feed: https://mythicalvoid.com/updates/feed.xml', 'machine-readable RSS discovery link'],
    ['public/llms.txt', 'JSON updates feed: https://mythicalvoid.com/updates/feed.json', 'machine-readable JSON discovery link'],
    ['public/llms.txt', '[Latest News sitemap](https://mythicalvoid.com/updates/sitemap.xml)', 'Latest News sitemap discovery link'],
    ['public/robots.txt', 'Sitemap: https://mythicalvoid.com/updates/sitemap.xml', 'robots Latest News sitemap declaration']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(expectedText), `${label} is missing`);

let structured;
try {
    structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
} catch (error) {
    failures.push(`structured data is invalid: ${error.message}`);
}
requireValue(structured?.['@type'] === 'CollectionPage' && structured?.hasPart?.length === liveEntries.length, 'structured data must describe every live entry');
requireValue(structured?.hasPart?.every((entry, index) => entry.url === releaseUrl(liveEntries[index])), 'structured data must link every live entry to its permanent page');

console.log(JSON.stringify({
    route: '/updates/',
    valid: failures.length === 0,
    liveEntryCount: liveEntries.length,
    permanentReleasePageCount: liveEntries.length,
    commentsEnabled: false,
    contactCollectionEnabled: false,
    trackingParametersPermitted: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
