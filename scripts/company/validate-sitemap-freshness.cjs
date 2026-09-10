#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const canonicalOrigin = 'https://mythicalvoid.com';
const routeSources = {
    '/': ['index.html'],
    '/play/': ['index.html', 'scripts/build-direct-play-entry.cjs'],
    '/privacy/': ['src/site/storefront.js', 'src/config/legal.json'],
    '/press/': ['public/press/index.html'],
    '/playable-now/': ['public/playable-now/index.html'],
    '/hatch-challenge/': ['public/hatch-challenge/index.html'],
    '/creature-genetics/': ['public/creature-genetics/index.html'],
    '/creature-field-guide/': ['public/creature-field-guide/index.html'],
    '/nasa-space-science/': ['public/nasa-space-science/index.html'],
    '/space-discovery/': ['public/space-discovery/index.html'],
    '/parents/': ['public/parents/index.html'],
    '/help/': ['public/help/index.html'],
    '/educators/': ['public/educators/index.html'],
    '/studio/': ['public/studio/index.html'],
    '/story/': ['public/story/index.html'],
    '/updates/': ['public/updates/index.html', 'public/updates/releases.json'],
    '/terms/': ['src/site/storefront.js', 'src/config/legal.json']
};

function parseSitemapDates(sitemap) {
    const entries = new Map();
    for (const block of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
        const location = block[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
        const lastModified = block[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
        if (location) entries.set(location, lastModified || null);
    }
    return entries;
}

function validateSitemapFreshness({ sitemap, latestSourceDates, today }) {
    const failures = [];
    const entries = parseSitemapDates(sitemap);

    for (const route of Object.keys(routeSources)) {
        const url = `${canonicalOrigin}${route}`;
        const sitemapDate = entries.get(url);
        const sourceDate = latestSourceDates[route];
        if (!sitemapDate) failures.push(`${url} is missing a lastmod date`);
        if (!sourceDate) failures.push(`${route} has no source-change date`);
        if (sitemapDate && sourceDate && sitemapDate < sourceDate) {
            failures.push(`${url} says ${sitemapDate}, older than its public source change on ${sourceDate}`);
        }
        if (sitemapDate && sitemapDate > today) failures.push(`${url} has a future lastmod date ${sitemapDate}`);
    }

    const expectedUrls = new Set(Object.keys(routeSources).map(route => `${canonicalOrigin}${route}`));
    for (const url of entries.keys()) {
        if (!expectedUrls.has(url)) failures.push(`${url} has no declared public source mapping`);
    }
    if (entries.size !== expectedUrls.size) {
        failures.push(`expected ${expectedUrls.size} canonical sitemap entries, found ${entries.size}`);
    }

    return failures;
}

function latestGitDate(sourcePaths) {
    try {
        return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...sourcePaths], {
            cwd: repositoryRoot,
            encoding: 'utf8'
        }).trim();
    } catch {
        return '';
    }
}

function dateInDublin(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Dublin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
}

function run() {
    const sitemap = fs.readFileSync(path.join(repositoryRoot, 'public/sitemap.xml'), 'utf8');
    const latestSourceDates = Object.fromEntries(
        Object.entries(routeSources).map(([route, sources]) => [route, latestGitDate(sources)])
    );
    const today = dateInDublin();
    const failures = validateSitemapFreshness({ sitemap, latestSourceDates, today });

    console.log(JSON.stringify({
        valid: failures.length === 0,
        canonicalRouteCount: Object.keys(routeSources).length,
        checkedAgainstCommittedPublicSources: true,
        latestSourceDates,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { canonicalOrigin, dateInDublin, parseSitemapDates, routeSources, validateSitemapFreshness };
