#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pages = [
    {
        route: '/playable-now/',
        file: 'public/playable-now/index.html',
        required: ['LOOKING FOR A NEW GAME? PLAY FREE ONLINE', 'Hatch a strange alien creature. Save six living realms.', 'Mythical Void is a free online browser adventure', 'No payment details', 'NASA does not endorse Mythical Void.']
    },
    {
        route: '/hatch-challenge/',
        file: 'public/hatch-challenge/index.html',
        required: ['A MYSTERY FOR TWO', 'This is not multiplayer.', 'does not promise that every possible hatch is globally unique', 'never asks who you invited']
    },
    {
        route: '/creature-genetics/',
        file: 'public/creature-genetics/index.html',
        required: ['structured identity', 'without promising impossible global uniqueness', 'tiny isolated exports did not help a person understand the game']
    },
    {
        route: '/nasa-space-science/',
        file: 'public/nasa-space-science/index.html',
        required: ['NASA does not endorse Mythical Void', 'Observe', 'Infer', 'Check', 'https://apod.nasa.gov/apod/ap240720.html', '/resources/mythical-void-stem-creature-lab.pdf', 'Invent an organism from another dimension']
    },
    {
        route: '/space-discovery/',
        file: 'public/space-discovery/index.html',
        required: ["TODAY'S SPACE DISCOVERY", 'REAL NASA SOURCE', 'MYTHICAL VOID IMAGINES', 'NOT A NASA IMAGE', 'NASA does not make, approve or endorse Mythical Void']
    },
    {
        route: '/parents/',
        file: 'public/parents/index.html',
        required: ['No account', 'No download', 'Local first', 'family-friendly fantasy battles without gore']
    },
    {
        route: '/studio/',
        file: 'public/studio/index.html',
        required: ['nine-year-old son', 'father and son', 'people remain responsible', '/press/']
    }
];

const errors = [];
const titles = new Set();
const descriptions = new Set();

function contentFor(file) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
        errors.push(`${file}: file is missing`);
        return '';
    }
    return fs.readFileSync(absolute, 'utf8');
}

function matchOne(source, expression, label, file) {
    const match = source.match(expression);
    if (!match) errors.push(`${file}: missing ${label}`);
    return match?.[1] || '';
}

for (const page of pages) {
    const source = contentFor(page.file);
    if (!source) continue;

    const title = matchOne(source, /<title>([^<]+)<\/title>/, 'title', page.file);
    const description = matchOne(source, /<meta name="description" content="([^"]+)"/, 'description', page.file);
    const canonical = matchOne(source, /<link rel="canonical" href="([^"]+)"/, 'canonical URL', page.file);
    const headings = [...source.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/g)];

    if (titles.has(title)) errors.push(`${page.file}: title is not unique`);
    if (descriptions.has(description)) errors.push(`${page.file}: description is not unique`);
    titles.add(title);
    descriptions.add(description);

    if (canonical !== `https://mythicalvoid.com${page.route}`) {
        errors.push(`${page.file}: canonical URL does not match ${page.route}`);
    }
    if (headings.length !== 1) errors.push(`${page.file}: expected exactly one h1`);
    if (!source.includes('href="/play/"') && !source.includes('href="/play/#hatch-challenge"')) {
        errors.push(`${page.file}: no direct play link`);
    }
    if (!source.includes('href="/"')) errors.push(`${page.file}: no canonical home link`);
    if (!source.includes('src="/discovery.js')) errors.push(`${page.file}: consent-aware analytics helper missing`);
    if (!source.includes('rel="stylesheet" href="/discovery.css')) errors.push(`${page.file}: shared presentation missing`);
    if (/\bcompanions?\b/i.test(source)) errors.push(`${page.file}: uses the retired companion wording`);
    if (/no two creatures alike|every creature is unique|infinite unique creatures/i.test(source)) {
        errors.push(`${page.file}: contains an unsupported uniqueness promise`);
    }

    for (const phrase of page.required) {
        if (!source.includes(phrase)) errors.push(`${page.file}: missing required truth: ${phrase}`);
    }
}

const sitemap = contentFor('public/sitemap.xml');
for (const page of pages) {
    if (!sitemap.includes(`<loc>https://mythicalvoid.com${page.route}</loc>`)) {
        errors.push(`public/sitemap.xml: missing ${page.route}`);
    }
}

const release = JSON.parse(contentFor('docs/company/search/organic-discovery-release-2026-08-14.json') || '{}');
if (release.state !== 'approved_for_owned_website_release') {
    errors.push('organic discovery release: owned website publication is not approved');
}
if (release.authority?.searchEngineSubmissionAuthorized !== false) {
    errors.push('organic discovery release: search-engine submission must remain off');
}
if (release.authority?.paidSearchAuthorized !== false || release.authority?.linkOutreachAuthorized !== false) {
    errors.push('organic discovery release: paid search and link outreach must remain off');
}
for (const page of pages) {
    const releasePage = (release.pages || []).find(item => item.route === page.route);
    if (!releasePage) {
        errors.push(`organic discovery release: missing ${page.route}`);
        continue;
    }
    for (const proof of releasePage.proof || []) {
        if (/^https:\/\//.test(proof)) continue;
        if (/^public\/press\/gameplay(?:-video)?\//.test(proof)) {
            errors.push(`organic discovery release: ${page.route} still depends on withdrawn media ${proof}`);
        } else if (!fs.existsSync(path.join(root, proof))) {
            errors.push(`organic discovery release: ${page.route} proof is missing: ${proof}`);
        }
    }
}

const storefront = contentFor('src/site/storefront.js');
for (const page of pages) {
    if (!storefront.includes(`href="${page.route}"`)) {
        errors.push(`src/site/storefront.js: no internal link to ${page.route}`);
    }
}
if (storefront.includes('No two creatures alike.')) {
    errors.push('src/site/storefront.js: unsupported absolute uniqueness headline remains');
}

const analytics = contentFor('public/discovery.js');
for (const required of [
    "analytics_storage: 'denied'",
    "ad_storage: 'denied'",
    'send_page_view: false',
    'allow_ad_personalization_signals: false'
]) {
    if (!analytics.includes(required)) errors.push(`public/discovery.js: missing privacy boundary ${required}`);
}

if (errors.length) {
    console.error('Organic discovery pages are not ready:\n');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    pageCount: pages.length,
    routes: pages.map(page => page.route),
    uniqueTitles: titles.size,
    uniqueDescriptions: descriptions.size,
    blockedUniquenessPromises: 0,
    retiredCompanionWording: 0,
    analyticsDefault: 'denied'
}, null, 2));
