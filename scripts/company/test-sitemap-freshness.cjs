#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    canonicalOrigin,
    dateInDublin,
    routeSources,
    validateSitemapFreshness
} = require('./validate-sitemap-freshness.cjs');

const root = path.resolve(__dirname, '..', '..');
const sitemap = fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dates = Object.fromEntries(Object.keys(routeSources).map(route => [route, '2026-01-01']));
const today = dateInDublin();
const tomorrowDate = new Date(`${today}T12:00:00.000Z`);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);
const valid = { sitemap, latestSourceDates: dates, today };
let cases = 0;

function rejected(name, expected, change) {
    const input = { ...valid, latestSourceDates: { ...valid.latestSourceDates } };
    change(input);
    const failures = validateSitemapFreshness(input);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(validateSitemapFreshness(valid), []);
cases += 1;
assert.strictEqual(dateInDublin(new Date('2026-09-08T23:30:00.000Z')), '2026-09-09');
cases += 1;
assert.strictEqual(packageJson.scripts['validate:sitemap-freshness'], 'node scripts/company/validate-sitemap-freshness.cjs');
cases += 1;
assert.strictEqual(packageJson.scripts['test:sitemap-freshness'], 'node scripts/company/test-sitemap-freshness.cjs');
cases += 1;
assert(packageJson.scripts.prebuild.includes('validate:sitemap-freshness') && packageJson.scripts.prebuild.includes('test:sitemap-freshness'));
cases += 1;
rejected('stale-page-date', 'older than its public source change', input => {
    input.latestSourceDates['/press/'] = '2026-09-10';
});
rejected('missing-date', 'is missing a lastmod date', input => {
    input.sitemap = input.sitemap.replace(/\s*<lastmod>2026-09-09<\/lastmod>/, '');
});
rejected('future-date', 'future lastmod date', input => {
    input.sitemap = input.sitemap.replace(
        /(<loc>https:\/\/mythicalvoid\.com\/<\/loc>\n\s*<lastmod>)\d{4}-\d{2}-\d{2}(<\/lastmod>)/,
        `$1${tomorrow}$2`
    );
});
rejected('unknown-route', 'has no declared public source mapping', input => {
    input.sitemap = input.sitemap.replace('</urlset>', `  <url>\n    <loc>${canonicalOrigin}/invented/</loc>\n    <lastmod>2026-09-09</lastmod>\n  </url>\n</urlset>`);
});
rejected('missing-source-date', 'has no source-change date', input => {
    input.latestSourceDates['/story/'] = '';
});

assert.strictEqual(cases, 10);
console.log('Sitemap freshness safeguards passed (10 cases).');
