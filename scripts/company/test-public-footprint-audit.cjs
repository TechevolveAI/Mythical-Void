#!/usr/bin/env node

const assert = require('assert');
const { inspect } = require('./audit-public-footprint.cjs');

const homeCheck = { path: '/', kind: 'home', expectedContentType: 'text/html' };
const goodHome = {
    url: 'https://mythicalvoid.com/',
    status: 200,
    error: null,
    headers: {
        'content-type': 'text/html; charset=UTF-8',
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
    },
    body: '<link rel="canonical" href="https://mythicalvoid.com/"><meta property="og:image" content="https://mythicalvoid.com/card.png"><script type="application/ld+json">{}</script><meta name="robots" content="index, follow, max-image-preview:large">'
};

const baseline = inspect(homeCheck, goodHome);
assert.deepStrictEqual(baseline.findings, []);

const header = inspect(homeCheck, { ...goodHome, headers: { ...goodHome.headers, 'content-security-policy': undefined } });
assert(header.findings.some(item => item.code === 'security_header_missing' && item.severity === 'major'));

const status = inspect(homeCheck, { ...goodHome, status: 500 });
assert(status.findings.some(item => item.code === 'unexpected_status'));

const robots = inspect(
    { path: '/robots.txt', kind: 'robots', expectedContentType: 'text/plain' },
    { url: 'https://mythicalvoid.com/robots.txt', status: 200, error: null, headers: { 'content-type': 'text/html' }, body: '<!doctype html><html></html>' }
);
assert(robots.findings.some(item => item.code === 'robots_spa_fallback'));
assert(robots.findings.some(item => item.code === 'sitemap_declaration_missing'));

const sitemap = inspect(
    { path: '/sitemap.xml', kind: 'sitemap', expectedContentType: 'application/xml' },
    { url: 'https://mythicalvoid.com/sitemap.xml', status: 200, error: null, headers: { 'content-type': 'application/xml' }, body: '<xml></xml>' }
);
assert(sitemap.findings.some(item => item.code === 'sitemap_invalid'));

const llms = inspect(
    { path: '/llms.txt', kind: 'llms', expectedContentType: 'text/plain' },
    { url: 'https://mythicalvoid.com/llms.txt', status: 200, error: null, headers: { 'content-type': 'text/plain' }, body: 'Unknown project' }
);
assert(llms.findings.some(item => item.code === 'llms_identity_missing'));

console.log('A-001 public-footprint audit evaluations passed (6 cases).');
