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
const readme = read('README.md');
const correctId = 'G-FTM4W73ECQ';
const incorrectId = 'G-FTM4W73EQC';
const eventNames = ['play_selected', 'share_completed', 'share_link_copied'];

const structuredData = [...index.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => {
        try {
            return JSON.parse(match[1]);
        } catch {
            failures.push('homepage contains invalid JSON-LD');
            return null;
        }
    })
    .filter(Boolean);
const structuredNodes = structuredData.flatMap(item => Array.isArray(item['@graph']) ? item['@graph'] : [item]);
const videoGame = structuredNodes.find(item => item['@type'] === 'VideoGame');
const website = structuredNodes.find(item => item['@type'] === 'WebSite');
const organization = structuredNodes.find(item => item['@type'] === 'Organization');

if (!videoGame) failures.push('homepage VideoGame identity is missing');
else {
    if (videoGame['@id'] !== 'https://mythicalvoid.com/#video-game') failures.push('homepage VideoGame identity is not canonical');
    if (videoGame.mainEntityOfPage?.['@id'] !== 'https://mythicalvoid.com/#website') failures.push('homepage VideoGame does not link to the canonical WebSite');
    if (videoGame.creator?.['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage VideoGame creator is missing');
    if (videoGame.publisher?.['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage VideoGame publisher is missing');
    if (videoGame.potentialAction?.['@type'] !== 'PlayAction') failures.push('homepage direct Play action is missing');
    if (videoGame.potentialAction?.target?.urlTemplate !== 'https://mythicalvoid.com/play/') failures.push('homepage Play action must use the clean direct game URL');
    const actionPlatforms = videoGame.potentialAction?.target?.actionPlatform || [];
    for (const platform of ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform']) {
        if (!actionPlatforms.includes(platform)) failures.push(`homepage Play action is missing ${platform}`);
    }
    if ('screenshot' in videoGame) failures.push('homepage VideoGame must not publish an unapproved gameplay screenshot');
}

if (!website) failures.push('homepage WebSite identity is missing');
else {
    if (website['@id'] !== 'https://mythicalvoid.com/#website') failures.push('homepage WebSite identity is not canonical');
    if (website.url !== 'https://mythicalvoid.com/') failures.push('homepage WebSite URL is not canonical');
    if (website.name !== 'Mythical Void') failures.push('homepage official site name must remain Mythical Void');
    if (website.publisher?.['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage WebSite publisher is missing');
}
if (!organization) failures.push('homepage Organization identity is missing');
else {
    if (organization['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage Organization identity is not canonical');
    if (organization.url !== 'https://mythicalvoid.com/studio/') failures.push('homepage Organization URL is not canonical');
    if (organization.logo?.url !== 'https://mythicalvoid.com/marketing/mythical-void-mark-512.png') failures.push('homepage Organization logo is missing');
}
if (!index.includes('<meta property="og:site_name" content="Mythical Void">')) failures.push('homepage social site name is missing');

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
if (!storefront.includes('does not send Google the full page you came from, a message recipient, contact detail, creature detail, game activity')) failures.push('privacy page does not explain what sharing measurement excludes');
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

for (const required of [
    '[Play Mythical Void](https://mythicalvoid.com/playable-now/)',
    '[Start the game](https://mythicalvoid.com/play/)',
    '[Family guide](https://mythicalvoid.com/parents/)',
    'No download, account, payment details, game adverts or public chat are needed.',
    'Generated universe artwork is never presented as gameplay.'
]) {
    if (!readme.includes(required)) failures.push(`public GitHub doorway is missing: ${required}`);
}
if (!readme.includes('father-and-son experiment') || !readme.includes('nine-year-old son')) failures.push('public GitHub doorway is missing the founding story');
if (!readme.includes('NASA does not make or endorse the game')) failures.push('public GitHub doorway is missing the NASA boundary');

const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/mythicalvoid\.com\/[^<]*<\/loc>/g)];
if (sitemapUrls.length !== 16) failures.push(`sitemap should contain 16 public routes, found ${sitemapUrls.length}`);

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
    sitemapUrlCount: sitemapUrls.length,
    officialSiteName: website?.name || null,
    directPlayAction: videoGame?.potentialAction?.target?.urlTemplate || null,
    githubDoorwayReady: true,
    gameplayScreenshotPublished: Boolean(videoGame && 'screenshot' in videoGame)
}, null, 2));
