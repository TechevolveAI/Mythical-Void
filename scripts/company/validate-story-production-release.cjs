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
const netlify = read('netlify.toml');
const vercel = JSON.parse(read('vercel.json'));
const story = JSON.parse(read('src/config/project-beacon.json'));
const captures = JSON.parse(read('public/press/gameplay/manifest.json'));

function requireText(source, text, label) {
    if (!source.includes(text)) failures.push(`${label} is missing: ${text}`);
}

for (const [text, label] of [
    ['<title>Project Beacon Story | Mythical Void</title>', 'distinct page title'],
    ['<link rel="canonical" href="https://mythicalvoid.com/story/">', 'canonical address'],
    ['<h1>Earth sent you looking for hope.</h1>', 'visible story promise'],
    ['Captured from the real browser game', 'gameplay disclosure'],
    ['company-controlled test state', 'privacy-safe capture disclosure'],
    ['The fight is against the corruption.', 'guardian restoration truth'],
    ['decide what Project Beacon should become', 'unresolved player choice'],
    ['href="/play/"', 'direct play link'],
    ['href="/press/gameplay/manifest.json"', 'capture record link']
]) requireText(page, text, label);

requireText(sitemap, '<loc>https://mythicalvoid.com/story/</loc>', 'story sitemap entry');
requireText(storefront, 'href="/story/">The story', 'homepage story navigation');
requireText(storefront, 'href="/story/">Follow the full Project Beacon story', 'homepage story call to action');
requireText(netlify, 'from = "/story/"', 'Netlify story route');

if (/href="\/trailer\/?"/i.test(page)) failures.push('unapproved trailer must not be linked from the story release');
if (/\bcompanions?\b/i.test(page)) failures.push('story page must use creature language');
if (/no two creatures alike|every creature is unique|1-of-1|completely unique/i.test(page)) failures.push('story page must not promise absolute uniqueness');
if (/\bkill(?:ed|ing)?\s+(?:the\s+)?guardian\b/i.test(page)) failures.push('story page must not describe killing a guardian');
if (story.year !== 2026 || story.ship?.name !== 'Wanderer-77' || (story.shipSystems || []).length !== 5) failures.push('Project Beacon source facts do not support the page');

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
    requireText(page, `<strong>${realm}</strong>`, `${realm} card`);
    requireText(page, `/press/gameplay/${filename}`, `${realm} screenshot`);
    if (!exists(`public/press/gameplay/${filename}`) || captureByFilename.get(filename)?.classification !== 'authentic_running_build_screenshot') failures.push(`${filename} must remain an authentic running-build capture`);
}

const structuredDataMatch = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
try {
    const data = JSON.parse(structuredDataMatch?.[1] || '');
    if (data['@type'] !== 'WebPage' || data.url !== 'https://mythicalvoid.com/story/') failures.push('structured data must describe the canonical story WebPage');
} catch (error) {
    failures.push('story structured data must be valid JSON');
}

const fallbackIndex = (vercel.rewrites || []).findIndex(rule => rule.destination === '/index.html');
const storyIndex = (vercel.rewrites || []).findIndex(rule => rule.source === '/story/' && rule.destination === '/story/index.html');
if (storyIndex < 0 || fallbackIndex < 0 || storyIndex > fallbackIndex) failures.push('Vercel story route must appear before the SPA fallback');

console.log(JSON.stringify({ page: '/story/', valid: failures.length === 0, realmCount: realms.length, trailerLinked: /href="\/trailer\/?"/i.test(page), failures }, null, 2));
if (failures.length) process.exitCode = 1;
