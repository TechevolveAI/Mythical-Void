#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-signal-feeds.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const rss = fs.readFileSync(path.join(root, 'public/updates/feed.xml'), 'utf8');
const json = fs.readFileSync(path.join(root, 'public/updates/feed.json'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/signal-log-syndication-release.json'), 'utf8'));
const liveEntryCount = source.entries.filter(entry => entry.status === 'live').length;
const productionRelease = structuredClone(release);
productionRelease.state = 'complete_owned_site_release_production_verified';
productionRelease.productionVerification = {
    commit: '0'.repeat(40),
    deployId: '0'.repeat(24),
    publishedAt: '2026-09-08T12:00:00.000Z',
    updatesPageHttpStatus: 200,
    playDoorwayHttpStatus: 200,
    latestEntryId: source.entries.find(entry => entry.status === 'live').id,
    latestEntryPresent: true,
    rssItemCount: liveEntryCount,
    jsonItemCount: liveEntryCount,
    productionPresentationReview: 'text_only_no_gameplay_media'
};
const cases = [
    ['stale RSS', value => value.replace('The Latest News can now travel', 'Old title'), json],
    ['stale JSON', rss, value => value.replace('The Latest News can now travel', 'Old title')],
    ['missing JSON item', rss, value => { const parsed = JSON.parse(value); parsed.items.pop(); return `${JSON.stringify(parsed, null, 2)}\n`; }]
];
let passed = 0;

function run(sourceValue, rssValue, jsonValue, releaseValue = release) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-signal-feed-'));
    const sourcePath = path.join(folder, 'releases.json');
    const rssPath = path.join(folder, 'feed.xml');
    const jsonPath = path.join(folder, 'feed.json');
    const releasePath = path.join(folder, 'release.json');
    fs.writeFileSync(sourcePath, JSON.stringify(sourceValue, null, 2));
    fs.writeFileSync(rssPath, rssValue);
    fs.writeFileSync(jsonPath, jsonValue);
    fs.writeFileSync(releasePath, JSON.stringify(releaseValue, null, 2));
    return spawnSync(process.execPath, [validator, sourcePath, rssPath, jsonPath, releasePath], { cwd: root, encoding: 'utf8' });
}

if (run(source, rss, json).status !== 0) throw new Error('valid prepared feed release was rejected');
passed += 1;
if (run(source, rss, json, productionRelease).status !== 0) throw new Error('valid production feed release was rejected');
passed += 1;
for (const [name, rssMutation, jsonMutation] of cases) {
    const changedRss = typeof rssMutation === 'function' ? rssMutation(rss) : rssMutation;
    const changedJson = typeof jsonMutation === 'function' ? jsonMutation(json) : jsonMutation;
    if (run(source, changedRss, changedJson).status === 0) throw new Error(`${name} was accepted`);
    passed += 1;
}
for (const [name, mutate] of [
    ['draft release', value => { value.entries[0].status = 'draft'; }],
    ['tracking link', value => { value.entries[0].destination = '/?utm_source=quiet-drift'; }],
    ['retired companion wording', value => { value.entries[0].summary += ' Companion.'; }],
    ['unsupported uniqueness', value => { value.entries[0].summary += ' Every creature is unique.'; }],
    ['invented metric', value => { value.entries[0].summary += ' 9000 players.'; }],
    ['opened email signup', value => { value.publicationBoundary.emailSignupEnabled = true; }],
    ['opened contact collection', value => { value.publicationBoundary.contactCollectionEnabled = true; }],
    ['tracking permitted', value => { value.publicationBoundary.trackingParametersPermitted = true; }],
    ['duplicate ID', value => { value.entries[1].id = value.entries[0].id; }]
]) {
    const changed = structuredClone(source);
    mutate(changed);
    if (run(changed, rss, json).status === 0) throw new Error(`${name} was accepted`);
    passed += 1;
}

for (const [name, mutate] of [
    ['malformed production commit', value => { value.productionVerification.commit = 'not-a-commit'; }],
    ['missing latest production entry', value => { value.productionVerification.latestEntryPresent = false; }],
    ['invented visual approval', value => { value.productionVerification.productionPresentationReview = 'passed'; }]
]) {
    const changed = structuredClone(productionRelease);
    mutate(changed);
    if (run(source, rss, json, changed).status === 0) throw new Error(`${name} was accepted`);
    passed += 1;
}

if (release.state === 'complete_owned_site_release_alias_verified_from_promoted_preview') {
    for (const [name, mutate] of [
        ['hidden promoted-preview context', value => { value.productionVerification.deployContextReportedByNetlify = 'production'; }],
        ['unproven merge tree match', value => { value.productionVerification.mergeTreeMatchesSourceTree = false; }],
        ['unproven live file match', value => { value.productionVerification.liveFilesMatchSourceSha256 = false; }]
    ]) {
        const changed = structuredClone(release);
        mutate(changed);
        if (run(source, rss, json, changed).status === 0) throw new Error(`${name} was accepted`);
        passed += 1;
    }
}

console.log(JSON.stringify({ valid: true, adversarialChecksPassed: passed }, null, 2));
