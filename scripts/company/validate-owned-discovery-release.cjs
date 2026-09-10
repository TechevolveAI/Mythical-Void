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
const playableNow = read('public/playable-now/index.html');
const press = read('public/press/index.html');
const discovery = read('public/discovery.js');
const storefront = read('src/site/storefront.js');
const consent = read('src/site/analytics-consent.js');
const indexNow = read('scripts/company/submit-indexnow.cjs');
const packageJson = JSON.parse(read('package.json'));
const sitemap = read('public/sitemap.xml');
const readme = read('README.md');
const normalizedReadme = readme.replace(/\s+/g, ' ');
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

function structuredNodesFrom(source, label) {
    return [...source.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        .flatMap(match => {
            try {
                const value = JSON.parse(match[1]);
                if (Array.isArray(value)) return value;
                if (Array.isArray(value?.['@graph'])) return value['@graph'];
                return [value];
            } catch {
                failures.push(`${label} contains invalid JSON-LD`);
                return [];
            }
        });
}

function nestedVideoGame(nodes) {
    for (const node of nodes) {
        if (node?.['@type'] === 'VideoGame') return node;
        if (node?.mainEntity?.['@type'] === 'VideoGame') return node.mainEntity;
    }
    return null;
}

const canonicalGameUrl = 'https://mythicalvoid.com/play/';
const playableVideoGame = nestedVideoGame(structuredNodesFrom(playableNow, 'Playable Now'));
const pressVideoGame = nestedVideoGame(structuredNodesFrom(press, 'press room'));

if (!videoGame) failures.push('homepage VideoGame identity is missing');
else {
    if (videoGame['@id'] !== 'https://mythicalvoid.com/#video-game') failures.push('homepage VideoGame identity is not canonical');
    if (videoGame.url !== canonicalGameUrl) failures.push('homepage VideoGame URL must be the clean Play address');
    if (videoGame.mainEntityOfPage?.['@id'] !== 'https://mythicalvoid.com/#website') failures.push('homepage VideoGame does not link to the canonical WebSite');
    if (videoGame.creator?.['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage VideoGame creator is missing');
    if (videoGame.publisher?.['@id'] !== 'https://mythicalvoid.com/#studio') failures.push('homepage VideoGame publisher is missing');
    if (videoGame.potentialAction?.['@type'] !== 'PlayAction') failures.push('homepage direct Play action is missing');
    if (videoGame.potentialAction?.target?.urlTemplate !== 'https://mythicalvoid.com/play/') failures.push('homepage Play action must use the clean direct game URL');
    if (videoGame.applicationCategory !== 'GameApplication') failures.push('homepage VideoGame must identify a game application');
    if (videoGame.applicationSubCategory !== 'Creature adventure game') failures.push('homepage VideoGame subcategory is missing');
    if (videoGame.gamePlatform !== 'Web browser' || videoGame.playMode !== 'SinglePlayer') failures.push('homepage VideoGame platform or play mode is inaccurate');
    if (videoGame.operatingSystem !== 'Any modern operating system with a supported web browser') failures.push('homepage VideoGame operating-system description is inaccurate');
    if (videoGame.softwareRequirements !== 'A modern JavaScript and WebGL-capable browser with an internet connection') failures.push('homepage VideoGame browser requirements are missing');
    if (videoGame.isAccessibleForFree !== true || videoGame.offers?.price !== 0 || videoGame.offers?.url !== canonicalGameUrl) failures.push('homepage VideoGame free Play offer is inaccurate');
    const actionPlatforms = videoGame.potentialAction?.target?.actionPlatform || [];
    for (const platform of ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform']) {
        if (!actionPlatforms.includes(platform)) failures.push(`homepage Play action is missing ${platform}`);
    }
    if ('screenshot' in videoGame) failures.push('homepage VideoGame must not publish an unapproved gameplay screenshot');
}

for (const [label, game] of [['Playable Now', playableVideoGame], ['press room', pressVideoGame]]) {
    if (!game) {
        failures.push(`${label} VideoGame identity is missing`);
        continue;
    }
    if (game['@id'] !== 'https://mythicalvoid.com/#video-game') failures.push(`${label} VideoGame identity is not canonical`);
    if (game.url !== canonicalGameUrl) failures.push(`${label} VideoGame URL must match the clean Play address`);
    if (game.applicationCategory !== 'GameApplication') failures.push(`${label} VideoGame must identify a game application`);
    if (game.applicationSubCategory !== 'Creature adventure game') failures.push(`${label} VideoGame subcategory is missing`);
    if (game.gamePlatform !== 'Web browser' || game.playMode !== 'SinglePlayer') failures.push(`${label} VideoGame platform or play mode is inaccurate`);
    if (game.operatingSystem !== 'Any modern operating system with a supported web browser') failures.push(`${label} VideoGame operating-system description is inaccurate`);
    if (game.softwareRequirements !== 'A modern JavaScript and WebGL-capable browser with an internet connection') failures.push(`${label} VideoGame browser requirements are missing`);
    if (game.isAccessibleForFree !== true) failures.push(`${label} VideoGame does not state that it is free`);
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
    if (JSON.stringify(organization.sameAs) !== JSON.stringify(['https://github.com/TechevolveAI/Mythical-Void'])) failures.push('homepage Organization official public project link is missing');
}
if (!index.includes('<meta property="og:site_name" content="Mythical Void">')) failures.push('homepage social site name is missing');
if (!index.includes('href="https://github.com/TechevolveAI/Mythical-Void" rel="me noopener noreferrer"')) failures.push('homepage visible official public project link is missing');
if (!storefront.includes('href="https://github.com/TechevolveAI/Mythical-Void" rel="me noopener noreferrer">Public project</a>')) failures.push('rendered storefront official public project link is missing');

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
if (!consent.includes('helps people reach Play')) failures.push('consent message does not describe the measurement');
if (!index.includes("if (isGameRoute) return")) failures.push('game-route stop is missing');

const keyMatch = indexNow.match(/const key = '([a-zA-Z0-9-]{8,128})'/);
if (!keyMatch) failures.push('IndexNow release key is invalid');
else {
    const keyFile = path.join(repositoryRoot, 'public', `${keyMatch[1]}.txt`);
    if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== keyMatch[1]) failures.push('IndexNow ownership file is missing or incorrect');
}
if (!indexNow.includes("const submit = process.argv.includes('--submit')")) failures.push('IndexNow external submission is not behind an explicit flag');
if (!indexNow.includes("mode: 'dry_run'")) failures.push('IndexNow dry run is missing');
if (!indexNow.includes("path.join(repositoryRoot, 'public', 'updates', 'sitemap.xml')")) failures.push('IndexNow does not include the canonical Latest News sitemap');
if (!indexNow.includes('A live IndexNow submission requires at least one explicitly changed --url.')) failures.push('IndexNow live submission does not require named changed pages');
if (packageJson.scripts?.['submit:indexnow'] !== 'node scripts/company/submit-indexnow.cjs') failures.push('package.json: IndexNow command is missing');

for (const required of [
    '[Play Mythical Void](https://mythicalvoid.com/play/)',
    '[See what you do in the game](https://mythicalvoid.com/playable-now/)',
    '[Latest game updates](https://mythicalvoid.com/updates/)',
    '[Family guide](https://mythicalvoid.com/parents/)',
    '[Player help](https://mythicalvoid.com/help/)',
    'No download, account, payment details, game adverts or public chat are needed.',
    'The six current realms are Mythical Forest, Crystal Caves, Stellar Reef, Void',
    'Recover the field kit and read the message.',
    'it does not promise that every creature is globally unique.',
    '[RSS feed](https://mythicalvoid.com/updates/feed.xml)',
    '[official press and creator room](https://mythicalvoid.com/press/)',
    'Generated universe artwork is never presented as gameplay.'
]) {
    if (!normalizedReadme.includes(required)) failures.push(`public GitHub doorway is missing: ${required}`);
}
if (!normalizedReadme.includes('father-and-son experiment') || !normalizedReadme.includes('Kevin and his son')) failures.push('public GitHub doorway is missing the founding story');
if (/\b(?:nine|9)[ -]year[ -]old\b/i.test(readme)) failures.push("public GitHub doorway publishes the founder's child's exact age");
if (!normalizedReadme.includes('NASA does not make or endorse the game')) failures.push('public GitHub doorway is missing the NASA boundary');
if (/World Size:\s*1600x1200|20 trees|30 rocks|40 interactive flowers|Canvas Size:\s*800x600/i.test(readme)) failures.push('public GitHub doorway still describes the obsolete prototype world');
if (/\bcompanions?\b|\bsignal\b/i.test(readme)) failures.push('public GitHub doorway uses retired player-facing wording');

const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/mythicalvoid\.com\/[^<]*<\/loc>/g)];
if (sitemapUrls.length !== 17) failures.push(`sitemap should contain 17 public routes, found ${sitemapUrls.length}`);
if (!sitemap.includes('<loc>https://mythicalvoid.com/play/</loc>')) failures.push('sitemap is missing the canonical direct Play route');

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
