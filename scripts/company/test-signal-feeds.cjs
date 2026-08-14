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
const cases = [
    ['stale RSS', value => value.replace('The Signal Log can now travel', 'Old title'), json],
    ['stale JSON', rss, value => value.replace('The Signal Log can now travel', 'Old title')],
    ['missing JSON item', rss, value => { const parsed = JSON.parse(value); parsed.items.pop(); return `${JSON.stringify(parsed, null, 2)}\n`; }]
];
let passed = 0;

function run(sourceValue, rssValue, jsonValue) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-signal-feed-'));
    const sourcePath = path.join(folder, 'releases.json');
    const rssPath = path.join(folder, 'feed.xml');
    const jsonPath = path.join(folder, 'feed.json');
    fs.writeFileSync(sourcePath, JSON.stringify(sourceValue, null, 2));
    fs.writeFileSync(rssPath, rssValue);
    fs.writeFileSync(jsonPath, jsonValue);
    return spawnSync(process.execPath, [validator, sourcePath, rssPath, jsonPath], { cwd: root, encoding: 'utf8' });
}

if (run(source, rss, json).status !== 0) throw new Error('valid feed release was rejected');
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

console.log(JSON.stringify({ valid: true, adversarialChecksPassed: passed }, null, 2));
