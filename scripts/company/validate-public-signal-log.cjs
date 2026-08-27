#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildSignalLog, defaultDataPath, defaultOutputPath } = require('./build-public-signal-log.cjs');

const root = path.resolve(__dirname, '../..');
const dataPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDataPath;
const pagePath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutputPath;
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const page = fs.readFileSync(pagePath, 'utf8');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const allowedKeys = new Set(['id', 'publishedOn', 'status', 'category', 'title', 'summary', 'details', 'image', 'imageAlt', 'imageClass', 'visualKind', 'visualAlt', 'disclosure', 'destination', 'linkText', 'download']);
const liveEntries = (data.entries || []).filter(entry => entry.status === 'live');

requireValue(data.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(data.page?.canonicalUrl === 'https://mythicalvoid.com/updates/', 'canonical URL must be the owned updates route');
for (const [field, expected] of Object.entries({ liveItemsOnly: true, commentsEnabled: false, contactCollectionEnabled: false, emailSignupEnabled: false, playerProfilesCreated: false, trackingParametersPermitted: false })) {
    requireValue(data.publicationBoundary?.[field] === expected, `publicationBoundary.${field} must be ${expected}`);
}
requireValue(liveEntries.length >= 2, 'Signal Log needs at least two real live entries');

const ids = new Set();
for (const [index, entry] of (data.entries || []).entries()) {
    const label = entry?.id || `entries[${index}]`;
    for (const key of Object.keys(entry || {})) if (!allowedKeys.has(key)) failures.push(`${label} contains unsupported field ${key}`);
    requireValue(/^SIGNAL-\d{3}$/.test(entry?.id || ''), `${label} has an invalid ID`);
    requireValue(!ids.has(entry?.id), `${label} is duplicated`);
    ids.add(entry?.id);
    requireValue(entry?.status === 'live' || entry?.status === 'withdrawn', `${label} has an unsupported publication status`);
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(entry?.publishedOn || ''), `${label} has an invalid publication date`);
    requireValue(!Number.isNaN(Date.parse(`${entry.publishedOn}T00:00:00Z`)), `${label} has an impossible publication date`);
    requireValue(Array.isArray(entry?.details) && entry.details.length === 3, `${label} must contain three checkable details`);
    const hasImage = Boolean(entry?.image);
    const hasSpaceSignalVisual = entry?.visualKind === 'space_signal';
    requireValue(hasImage || hasSpaceSignalVisual, `${label} needs an approved image or supported code-native visual`);
    if (hasImage) {
        requireValue(/^\/(?!\/)/.test(entry.image), `${label} image must be an owned path`);
        requireValue(fs.existsSync(path.join(root, 'public', entry.image.replace(/^\//, ''))), `${label} image does not exist`);
    }
    if (hasSpaceSignalVisual) {
        requireValue(!entry.image && /not a NASA image/i.test(entry?.disclosure || '') && /not gameplay/i.test(entry?.disclosure || ''), `${label} Space Signal visual lacks its source and gameplay boundary`);
        requireValue(typeof entry?.visualAlt === 'string' && entry.visualAlt.length >= 20, `${label} Space Signal visual needs useful alternative text`);
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

requireValue(page === buildSignalLog(data), 'Signal Log page is stale; rebuild it from releases.json');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), 'page must be indexable');
requireValue(page.includes('<script type="application/ld+json">'), 'page needs structured data');
requireValue(page.includes('rel="alternate" type="application/rss+xml"'), 'page must advertise its RSS feed');
requireValue(page.includes('rel="alternate" type="application/feed+json"'), 'page must advertise its JSON feed');
requireValue(page.includes('href="/updates/feed.xml">Follow the Signal</a>'), 'page must give people a visible way to follow the Signal');
requireValue(page.includes('href="/updates/feed.json">JSON feed</a>'), 'page must explain the machine-readable feed');
requireValue(page.includes('No vague promises and no invented player numbers.'), 'page must state its evidence boundary plainly');
requireValue(!/\bcompanions?\b/i.test(page), 'public page uses retired companion wording');

for (const [file, expectedText, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/updates/</loc>', 'sitemap'],
    ['netlify.toml', 'from = "/updates/"', 'Netlify route'],
    ['vercel.json', '"source": "/updates/"', 'Vercel route'],
    ['src/site/storefront.js', 'href="/updates/">What\'s new', 'homepage link'],
    ['public/llms.txt', 'RSS updates feed: https://mythicalvoid.com/updates/feed.xml', 'machine-readable RSS discovery link'],
    ['public/llms.txt', 'JSON updates feed: https://mythicalvoid.com/updates/feed.json', 'machine-readable JSON discovery link']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(expectedText), `${label} is missing`);

let structured;
try {
    structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
} catch (error) {
    failures.push(`structured data is invalid: ${error.message}`);
}
requireValue(structured?.['@type'] === 'CollectionPage' && structured?.hasPart?.length === liveEntries.length, 'structured data must describe every live entry');

console.log(JSON.stringify({
    route: '/updates/',
    valid: failures.length === 0,
    liveEntryCount: liveEntries.length,
    commentsEnabled: false,
    contactCollectionEnabled: false,
    trackingParametersPermitted: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
