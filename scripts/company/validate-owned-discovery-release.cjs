#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const repositoryRoot = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const failures = [];
const read = relative => fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');

const index = read('index.html');
const discovery = read('public/discovery.js');
const storefront = read('src/site/storefront.js');
const consent = read('src/site/analytics-consent.js');
const indexNow = read('scripts/company/submit-indexnow.cjs');
const packageJson = JSON.parse(read('package.json'));
const sitemap = read('public/sitemap.xml');
const correctId = 'G-FTM4W73ECQ';
const incorrectId = 'G-FTM4W73EQC';
const eventNames = ['play_selected', 'share_completed', 'share_link_copied'];

for (const [label, source] of [['index.html', index], ['public/discovery.js', discovery]]) {
    if (!source.includes(correctId)) failures.push(`${label}: user-supplied Google tag ID is missing`);
    if (source.includes(incorrectId)) failures.push(`${label}: swapped Google tag ID remains`);
    for (const eventName of eventNames) if (!source.includes(eventName)) failures.push(`${label}: ${eventName} is missing`);
    const consentGate = label === 'index.html'
        ? "this.getConsent() !== 'granted' || allowedEvents.indexOf(eventName) === -1"
        : "readChoice() !== 'granted' || allowedEvents.indexOf(eventName) === -1";
    if (!source.includes(consentGate)) failures.push(`${label}: events are not stopped before consent`);
    for (const property of ['source_page', 'source_area', 'transport_type']) {
        if (!source.includes(property)) failures.push(`${label}: safe event property ${property} is missing`);
    }
}

for (const forbidden of ['user_id:', 'email:', 'creature_id:', 'query_string:', 'raw_referrer:']) {
    if (index.includes(forbidden) || discovery.includes(forbidden)) failures.push(`analytics contains forbidden property ${forbidden}`);
}

for (const eventName of eventNames) {
    if (!storefront.includes(eventName) && eventName !== 'share_link_copied') failures.push(`storefront: ${eventName} is not connected`);
}
if (!storefront.includes('share_link_copied')) failures.push('storefront: copied links are not measured');
if (!storefront.includes('It is not used in the game')) failures.push('privacy page does not explain the game boundary');
if (!storefront.includes('does not receive a message recipient')) failures.push('privacy page does not explain what sharing measurement excludes');
if (!consent.includes('whether website buttons lead to play or sharing')) failures.push('consent message does not describe the measurement');
if (!index.includes("if (isGameRoute) return")) failures.push('game-route stop is missing');

const keyMatch = indexNow.match(/const key = '([a-zA-Z0-9-]{8,128})'/);
if (!keyMatch) failures.push('IndexNow release key is invalid');
else {
    const keyFile = path.join(repositoryRoot, 'public', `${keyMatch[1]}.txt`);
    if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== keyMatch[1]) failures.push('IndexNow ownership file is missing or incorrect');
}
if (!indexNow.includes("const submit = process.argv.includes('--submit')")) failures.push('IndexNow external submission is not behind an explicit flag');
if (!indexNow.includes("mode: 'dry_run'")) failures.push('IndexNow dry run is missing');
if (packageJson.scripts?.['submit:indexnow'] !== 'node scripts/company/submit-indexnow.cjs') failures.push('package.json: IndexNow command is missing');

const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/mythicalvoid\.com\/[^<]*<\/loc>/g)];
if (sitemapUrls.length !== 13) failures.push(`sitemap should contain 13 public routes, found ${sitemapUrls.length}`);

if (failures.length) {
    console.error('Owned discovery release is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    ready: true,
    correctGoogleTagId: true,
    consentRequired: true,
    gameMeasured: false,
    eventNames,
    eventPropertyNames: ['source_page', 'source_area', 'transport_type'],
    indexNowDryRunDefault: true,
    sitemapUrlCount: sitemapUrls.length
}, null, 2));
