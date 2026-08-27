#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-search-visibility-activation.cjs');
const files = [
    'docs/company/search/search-visibility-audit-2026-08-27.json',
    'docs/company/search/indexnow-submission-2026-08-27.json',
    'docs/company/search/indexnow-submission-2026-08-27-03.json',
    'docs/company/search/indexnow-submission-2026-08-27-04.json',
    'docs/company/search/SEARCH_VISIBILITY_AUDIT_2026-08-27.md',
    'docs/company/search/SEARCH_CONSOLE_ACTIVATION.md',
    'docs/company/search/search-opportunities.json',
    'index.html',
    'public/robots.txt',
    'public/sitemap.xml',
    'public/playable-now/index.html',
    'package.json'
];
let cases = 0;

function fixture(mutate) {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-search-visibility-'));
    for (const relative of files) {
        const target = path.join(targetRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, relative), target);
    }
    if (mutate) mutate(targetRoot);
    return targetRoot;
}

function execute(targetRoot) {
    return spawnSync(process.execPath, [validator, '--root', targetRoot], { encoding: 'utf8', timeout: 30_000 });
}

function invalidAudit(name, change, expected) {
    const targetRoot = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, 'docs/company/search/search-visibility-audit-2026-08-27.json');
        const audit = JSON.parse(fs.readFileSync(target, 'utf8'));
        change(audit);
        fs.writeFileSync(target, `${JSON.stringify(audit, null, 2)}\n`);
    });
    try {
        const result = execute(targetRoot);
        assert.strictEqual(result.status, 1, `${name} should fail`);
        assert(result.stderr.includes(expected), `${name} should report ${expected}`);
        cases += 1;
    } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
    }
}

const baselineRoot = fixture();
try {
    const result = execute(baselineRoot);
    assert.strictEqual(result.status, 0, result.stderr);
    cases += 1;
} finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
}

invalidAudit('invented connection', audit => { audit.verifiedEvidence.searchConsoleConnected = true; }, 'searchConsoleConnected');
invalidAudit('invented ranking', audit => { audit.verifiedEvidence.rankingPosition = 1; }, 'rankingPosition');
invalidAudit('premature sitemap authority', audit => { audit.authority.sitemapSubmissionAuthorized = true; }, 'sitemapSubmissionAuthorized');
invalidAudit('paid search', audit => { audit.authority.paidSearchAuthorized = true; }, 'paidSearchAuthorized');
invalidAudit('fabricated result', audit => { audit.sample.queries[0].mythicalResultObserved = true; }, 'sample result');
invalidAudit('invented indexing', audit => { audit.indexNow.indexingClaimed = true; }, 'cannot be described as indexing');

const robotsRoot = fixture(fixtureRoot => {
    fs.writeFileSync(path.join(fixtureRoot, 'public/robots.txt'), 'User-agent: *\nDisallow: /\n');
});
try {
    const result = execute(robotsRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('robots crawl permission'));
    cases += 1;
} finally {
    fs.rmSync(robotsRoot, { recursive: true, force: true });
}

const sitemapRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'public/sitemap.xml');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('<loc>https://mythicalvoid.com/playable-now/</loc>', ''));
});
try {
    const result = execute(sitemapRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('sitemap is missing'));
    cases += 1;
} finally {
    fs.rmSync(sitemapRoot, { recursive: true, force: true });
}

const staleMapRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/search/search-opportunities.json');
    const map = JSON.parse(fs.readFileSync(target, 'utf8'));
    map.clusters[0].targetState = 'proposed_not_created';
    fs.writeFileSync(target, `${JSON.stringify(map, null, 2)}\n`);
});
try {
    const result = execute(staleMapRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('six live owned routes'));
    cases += 1;
} finally {
    fs.rmSync(staleMapRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 10);
console.log('Search visibility activation safeguards passed (10 cases).');
