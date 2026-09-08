#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    buildReleasePage,
    buildSignalLog,
    buildUpdatesSitemap,
    latestPublishedDate,
    releasePath,
    releaseUrl,
    syncMainUpdatesLastmod
} = require('./build-public-signal-log.cjs');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-public-signal-log.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-signal-log-'));

function run(name, mutate = value => value, stale = false) {
    const data = structuredClone(source);
    mutate(data);
    const dataPath = path.join(temporary, `${name}.json`);
    const pagePath = path.join(temporary, `${name}.html`);
    fs.writeFileSync(dataPath, JSON.stringify(data));
    fs.writeFileSync(pagePath, stale ? '<!doctype html><title>stale</title>' : buildSignalLog(data));
    return spawnSync(process.execPath, [validator, dataPath, pagePath], { cwd: root, encoding: 'utf8' });
}

try {
    const liveEntries = source.entries.filter(entry => entry.status === 'live');
    const permanentUrls = liveEntries.map(releaseUrl);
    const sitemap = buildUpdatesSitemap(source);
    const oldMainSitemap = `<url>\n<loc>https://mythicalvoid.com/updates/</loc>\n<lastmod>2026-08-26</lastmod>\n</url>`;
    const currentMainSitemap = syncMainUpdatesLastmod(oldMainSitemap, latestPublishedDate(source));
    assert(currentMainSitemap.includes(`<lastmod>${latestPublishedDate(source)}</lastmod>`));
    assert(!currentMainSitemap.includes('<lastmod>2026-08-26</lastmod>'));
    assert.throws(() => syncMainUpdatesLastmod('<urlset></urlset>', latestPublishedDate(source)), /missing the Latest News entry/);
    assert.strictEqual(new Set(permanentUrls).size, liveEntries.length);
    assert.strictEqual((sitemap.match(/<url>/g) || []).length, liveEntries.length);
    for (const entry of liveEntries) {
        const page = buildReleasePage(source, entry);
        assert.strictEqual(releasePath(entry), `/updates/${entry.id.toLowerCase()}/`);
        assert(page.includes(`<link rel="canonical" href="${releaseUrl(entry)}">`));
        assert(page.includes(`"mainEntityOfPage": "${releaseUrl(entry)}"`));
        assert(page.includes('Brand art, not gameplay.'));
        assert(page.includes(`data-share-url="${releaseUrl(entry)}"`));
        assert(page.includes('data-share-game'));
        assert(page.includes('data-copy-game'));
        assert(page.includes('data-copy-label="Copy update link"'));
        assert(page.includes('data-share-success="Thanks for sharing this update."'));
        assert(!/[?&](?:utm_|fbclid|gclid)/i.test(page));
        assert(!/\bcompanions?\b/i.test(page));
    }
    assert.strictEqual(run('valid').status, 0);
    assert.notStrictEqual(run('unpublished', data => { data.entries[0].status = 'draft'; }).status, 0);
    assert.notStrictEqual(run('tracked', data => { data.entries[0].destination += '?utm_source=test'; }).status, 0);
    assert.notStrictEqual(run('mislabelled-art', data => { data.entries[0].disclosure = 'A beautiful creature image.'; }).status, 0);
    assert.notStrictEqual(run('mislabelled-generated-art', data => { data.entries.find(entry => entry.imageClass === 'ai_generated_marketing_illustration').disclosure = 'A beautiful creature image.'; }).status, 0);
    assert.notStrictEqual(run('invented-metric', data => { data.entries[0].summary = 'Already enjoyed by 10,000 players.'; }).status, 0);
    assert.notStrictEqual(run('opened-comments', data => { data.publicationBoundary.commentsEnabled = true; }).status, 0);
    assert.notStrictEqual(run('unsupported-field', data => { data.entries[0].email = 'hello@example.com'; }).status, 0);
    assert.notStrictEqual(run('missing-release-proof', data => { delete data.entries.find(entry => entry.visualKind === 'text_only_release').releaseProof; }).status, 0);
    assert.notStrictEqual(run('invented-visual-approval', data => { data.entries.find(entry => entry.visualKind === 'text_only_release').releaseProof.gameplayVisualApproved = true; }).status, 0);
    assert.notStrictEqual(run('stale', value => value, true).status, 0);
    console.log(`Public Latest News safeguards passed (11 failure cases and ${liveEntries.length} permanent release pages).`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
