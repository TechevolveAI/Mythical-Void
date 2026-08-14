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
const allowedKeys = new Set(['id', 'publishedOn', 'status', 'category', 'title', 'summary', 'details', 'image', 'imageAlt', 'imageClass', 'disclosure', 'destination', 'linkText', 'download']);

requireValue(data.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(data.page?.canonicalUrl === 'https://mythicalvoid.com/updates/', 'canonical URL must be the owned updates route');
for (const [field, expected] of Object.entries({ liveItemsOnly: true, commentsEnabled: false, contactCollectionEnabled: false, emailSignupEnabled: false, playerProfilesCreated: false, trackingParametersPermitted: false })) {
    requireValue(data.publicationBoundary?.[field] === expected, `publicationBoundary.${field} must be ${expected}`);
}
requireValue(Array.isArray(data.entries) && data.entries.length >= 2, 'Signal Log needs at least two real live entries at launch');

const ids = new Set();
for (const [index, entry] of (data.entries || []).entries()) {
    const label = entry?.id || `entries[${index}]`;
    for (const key of Object.keys(entry || {})) if (!allowedKeys.has(key)) failures.push(`${label} contains unsupported field ${key}`);
    requireValue(/^SIGNAL-\d{3}$/.test(entry?.id || ''), `${label} has an invalid ID`);
    requireValue(!ids.has(entry?.id), `${label} is duplicated`);
    ids.add(entry?.id);
    requireValue(entry?.status === 'live', `${label} is not live`);
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(entry?.publishedOn || ''), `${label} has an invalid publication date`);
    requireValue(!Number.isNaN(Date.parse(`${entry.publishedOn}T00:00:00Z`)), `${label} has an impossible publication date`);
    requireValue(Array.isArray(entry?.details) && entry.details.length === 3, `${label} must contain three checkable details`);
    requireValue(/^\/(?!\/)/.test(entry?.image || ''), `${label} image must be an owned path`);
    requireValue(fs.existsSync(path.join(root, 'public', entry.image.replace(/^\//, ''))), `${label} image does not exist`);
    requireValue(/^\/(?!\/)/.test(entry?.destination || ''), `${label} destination must be an owned path`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(entry?.destination || ''), `${label} contains a tracking parameter`);
    requireValue(!/\bcompanions?\b/i.test(JSON.stringify(entry)), `${label} uses retired companion wording`);
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(JSON.stringify(entry)), `${label} contains an unsupported uniqueness promise`);
    requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(JSON.stringify(entry)), `${label} contains an unverified audience metric`);
    if (entry?.imageClass === 'ai_generated_marketing_illustration') requireValue(/not gameplay/i.test(entry?.disclosure || ''), `${label} generated artwork lacks a not-gameplay disclosure`);
    if (entry?.imageClass === 'authentic_running_build_screenshot') requireValue(/real browser game/i.test(entry?.disclosure || ''), `${label} gameplay image lacks a real-game disclosure`);
    if ((entry?.imageClass || '').startsWith('branded_social_artwork_with_authentic_gameplay_frame')) requireValue(/branded sharing artwork/i.test(entry?.disclosure || '') && /not a raw screenshot/i.test(entry?.disclosure || '') && /no player information/i.test(entry?.disclosure || ''), `${label} branded sharing artwork lacks its layout, gameplay and privacy disclosure`);
    if (/nasa/i.test(entry?.imageClass || '')) requireValue(/NASA does not endorse Mythical Void/i.test(entry?.disclosure || ''), `${label} NASA artwork lacks its non-endorsement boundary`);
    if (entry?.imageClass === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame') requireValue(/founder-story sharing artwork/i.test(entry?.disclosure || '') && /not a raw screenshot/i.test(entry?.disclosure || '') && /not gameplay/i.test(entry?.disclosure || '') && /real gameplay/i.test(entry?.disclosure || '') && /no player information/i.test(entry?.disclosure || '') && /identifying detail of the child/i.test(entry?.disclosure || ''), `${label} founder-story artwork lacks its generated-art, gameplay, privacy or child-identity boundary`);
}

requireValue(page === buildSignalLog(data), 'Signal Log page is stale; rebuild it from releases.json');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), 'page must be indexable');
requireValue(page.includes('<script type="application/ld+json">'), 'page needs structured data');
requireValue(page.includes('No vague promises and no invented player numbers.'), 'page must state its evidence boundary plainly');
requireValue(!/\bcompanions?\b/i.test(page), 'public page uses retired companion wording');

for (const [file, expectedText, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/updates/</loc>', 'sitemap'],
    ['netlify.toml', 'from = "/updates/"', 'Netlify route'],
    ['vercel.json', '"source": "/updates/"', 'Vercel route'],
    ['src/site/storefront.js', 'href="/updates/">What\'s new', 'homepage link'],
    ['public/llms.txt', 'Updates: https://mythicalvoid.com/updates/', 'machine-readable discovery link']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(expectedText), `${label} is missing`);

let structured;
try {
    structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
} catch (error) {
    failures.push(`structured data is invalid: ${error.message}`);
}
requireValue(structured?.['@type'] === 'CollectionPage' && structured?.hasPart?.length === data.entries.length, 'structured data must describe every live entry');

console.log(JSON.stringify({
    route: '/updates/',
    valid: failures.length === 0,
    liveEntryCount: (data.entries || []).length,
    commentsEnabled: false,
    contactCollectionEnabled: false,
    trackingParametersPermitted: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
