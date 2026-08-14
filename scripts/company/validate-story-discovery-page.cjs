#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const failures = [];

const page = read('public/story/index.html');
const sitemap = read('public/sitemap.xml');
const storefront = read('src/site/storefront.js');
const discovery = read('public/discovery.js');
const consent = read('src/site/analytics-consent.js');
const netlify = read('netlify.toml');
const vercel = JSON.parse(read('vercel.json'));
const story = JSON.parse(read('src/config/project-beacon.json'));
const captures = JSON.parse(read('public/press/gameplay/manifest.json'));

function requireText(source, text, label) {
    if (!source.includes(text)) failures.push(`${label} is missing: ${text}`);
}

function count(source, text) {
    return source.split(text).length - 1;
}

requireText(page, '<title>Project Beacon Story | Mythical Void</title>', 'distinct page title');
requireText(page, '<meta name="robots" content="index, follow, max-image-preview:large">', 'search instruction');
requireText(page, '<link rel="canonical" href="https://mythicalvoid.com/story/">', 'canonical address');
requireText(page, '<h1>Earth sent you looking for hope.</h1>', 'visible story promise');
requireText(page, 'Captured from the real browser game', 'gameplay disclosure');
requireText(page, 'company-controlled test state', 'privacy-safe capture disclosure');
requireText(page, 'The fight is against the corruption.', 'guardian restoration truth');
requireText(page, 'decide what Project Beacon should become', 'unresolved player choice');
requireText(page, 'href="/play/"', 'Play link');
requireText(page, 'href="/creature-genetics/"', 'creature genetics link');
requireText(page, 'href="/press/gameplay/manifest.json"', 'capture record link');
requireText(sitemap, '<loc>https://mythicalvoid.com/story/</loc>', 'story sitemap entry');
requireText(storefront, 'href="/story/">The story', 'homepage story navigation');
requireText(discovery, "'/story': 'story'", 'static analytics page group');
requireText(consent, "['/story', 'story']", 'primary analytics page group');
requireText(netlify, 'from = "/story/"', 'Netlify story route');

if (/\bcompanions?\b/i.test(page)) failures.push('public story page must use creatures, not companions');
if (/\bkill(?:ed|ing)?\s+(?:the\s+)?guardian\b/i.test(page)) failures.push('story must not describe killing a guardian');
if (story.year !== 2026) failures.push('Project Beacon year must remain 2026');
if (story.ship?.name !== 'Wanderer-77') failures.push('ship must be Wanderer-77');
if ((story.shipSystems || []).length !== 5) failures.push('story page claim requires exactly five recoverable ship systems');

const realms = [
    ['Mythical Forest', 'realm-mythicalforest.png'],
    ['Crystal Caves', 'realm-crystalcaves.png'],
    ['Stellar Reef', 'realm-reef.png'],
    ['Void Peaks', 'realm-voidpeaks.png'],
    ['Aurora Depths', 'realm-auroradepths.png'],
    ['The Final Void', 'realm-finalvoid.png']
];

const captureByFilename = new Map((captures.captures || []).map(item => [item.filename, item]));
for (const [realm, filename] of realms) {
    requireText(page, `<strong>${realm}</strong>`, `${realm} story card`);
    requireText(page, `/press/gameplay/${filename}`, `${realm} gameplay image`);
    if (count(page, `/press/gameplay/${filename}`) !== 1) failures.push(`${realm} must use one clear gameplay image`);
    const capture = captureByFilename.get(filename);
    if (!capture || capture.classification !== 'authentic_running_build_screenshot') {
        failures.push(`${filename} must be an authentic running-build capture`);
    }
    if (!exists(`public/press/gameplay/${filename}`)) failures.push(`missing ${filename}`);
}

const structuredDataMatch = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!structuredDataMatch) failures.push('WebPage structured data is missing');
else {
    try {
        const structuredData = JSON.parse(structuredDataMatch[1]);
        if (structuredData['@type'] !== 'WebPage') failures.push('structured data type must be WebPage');
        if (structuredData.url !== 'https://mythicalvoid.com/story/') failures.push('structured data URL is incorrect');
    } catch (error) {
        failures.push(`structured data is invalid JSON: ${error.message}`);
    }
}

const vercelStoryRoute = (vercel.rewrites || []).find(rule => (
    rule.source === '/story/' && rule.destination === '/story/index.html'
));
const vercelFallbackIndex = (vercel.rewrites || []).findIndex(rule => rule.destination === '/index.html');
const vercelStoryIndex = (vercel.rewrites || []).indexOf(vercelStoryRoute);
if (!vercelStoryRoute || vercelStoryIndex < 0 || vercelStoryIndex > vercelFallbackIndex) {
    failures.push('Vercel story route must appear before the SPA fallback');
}

console.log(JSON.stringify({
    page: '/story/',
    valid: failures.length === 0,
    projectYear: story.year,
    ship: story.ship?.name,
    realmCount: realms.length,
    recoveredSystemCount: story.shipSystems?.length,
    authenticRealmCaptures: realms.filter(([, filename]) => (
        captureByFilename.get(filename)?.classification === 'authentic_running_build_screenshot'
    )).length,
    failures
}, null, 2));

if (failures.length) process.exitCode = 1;
