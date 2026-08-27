#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-owned-discovery-release.cjs');
const files = [
    'index.html',
    'public/discovery.js',
    'public/sitemap.xml',
    'public/2d33a591a69d023517107abcaf6b7d52.txt',
    'src/site/storefront.js',
    'src/site/analytics-consent.js',
    'scripts/company/submit-indexnow.cjs',
    'package.json'
];
let cases = 0;

function makeFixture(mutate) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-owned-discovery-'));
    for (const relative of files) {
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repositoryRoot, relative), target);
    }
    if (mutate) mutate(root);
    return root;
}

function execute(root) {
    return spawnSync(process.execPath, [validator, '--root', root], { encoding: 'utf8', timeout: 30_000 });
}

function invalid(relative, replace, expected) {
    cases += 1;
    const root = makeFixture(fixtureRoot => {
        const target = path.join(fixtureRoot, relative);
        const source = fs.readFileSync(target, 'utf8');
        fs.writeFileSync(target, replace(source));
    });
    try {
        const result = execute(root);
        assert.strictEqual(result.status, 1);
        assert(result.stderr.includes(expected), `missing failure: ${expected}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

cases += 1;
const baselineRoot = makeFixture();
try {
    const baseline = execute(baselineRoot);
    assert.strictEqual(baseline.status, 0, baseline.stderr);
    const output = JSON.parse(baseline.stdout);
    assert.strictEqual(output.ready, true);
    assert.strictEqual(output.gameMeasured, false);
    assert.deepStrictEqual(output.eventNames, ['play_selected', 'share_completed', 'share_link_copied']);
    assert.strictEqual(output.sitemapUrlCount, 15);
    assert.strictEqual(output.officialSiteName, 'Mythical Void');
    assert.strictEqual(output.directPlayAction, 'https://mythicalvoid.com/play/');
    assert.strictEqual(output.gameplayScreenshotPublished, false);
} finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
}

invalid('index.html', source => source.replace('G-FTM4W73ECQ', 'G-FTM4W73EQC'), 'swapped Google tag ID remains');
invalid('public/discovery.js', source => source.replace("readChoice() !== 'granted'", 'false'), 'events are not stopped before consent');
invalid('index.html', source => source.replace("if (isGameRoute) return", '// removed'), 'game-route stop is missing');
invalid('src/site/storefront.js', source => source.replace('does not send Google the full page you came from, a message recipient, contact detail, creature detail, game activity', 'sends Google sharing details'), 'sharing measurement excludes');
invalid('scripts/company/submit-indexnow.cjs', source => source.replace("const submit = process.argv.includes('--submit')", 'const submit = true'), 'not behind an explicit flag');
invalid('public/2d33a591a69d023517107abcaf6b7d52.txt', () => 'wrong-key\n', 'ownership file is missing or incorrect');
invalid('index.html', source => source.replace('"@type": "WebSite"', '"@type": "Thing"'), 'homepage WebSite identity is missing');
invalid('index.html', source => source.replace('"name": "Mythical Void",\n      "alternateName"', '"name": "Mythical Void Portal",\n      "alternateName"'), 'official site name must remain Mythical Void');
invalid('index.html', source => source.replace('"urlTemplate": "https://mythicalvoid.com/play/"', '"urlTemplate": "https://mythicalvoid.com/play/?campaign=search"'), 'clean direct game URL');
invalid('index.html', source => source.replace('"offers": {', '"screenshot": "https://mythicalvoid.com/unapproved-gameplay.png",\n      "offers": {'), 'must not publish an unapproved gameplay screenshot');

function measurementFixture(consentChoice) {
    const dom = new JSDOM('<!doctype html><a href="/play/" id="play"><span id="play-label">Play</span></a>', {
        url: 'https://mythicalvoid.com/playable-now/',
        runScripts: 'outside-only'
    });
    if (consentChoice) dom.window.localStorage.setItem('mythical-analytics-consent', consentChoice);
    dom.window.document.querySelector('#play').addEventListener('click', event => event.preventDefault());
    dom.window.eval(fs.readFileSync(path.join(repositoryRoot, 'public/discovery.js'), 'utf8'));
    dom.window.document.querySelector('#play-label').click();
    return dom.window.dataLayer.map(entry => Array.from(entry));
}

cases += 1;
assert.strictEqual(measurementFixture('denied').some(entry => entry[0] === 'event'), false, 'denied consent must send no event');
cases += 1;
const grantedEvents = measurementFixture('granted').filter(entry => entry[0] === 'event');
assert.deepStrictEqual(JSON.parse(JSON.stringify(grantedEvents.map(entry => entry[1]))), ['discovery_arrival', 'play_selected']);
const playSelected = grantedEvents.find(entry => entry[1] === 'play_selected');
assert.deepStrictEqual(JSON.parse(JSON.stringify(playSelected[2])), {
    source_page: '/playable-now/',
    source_area: 'content',
    entry_source: 'direct_or_private',
    transport_type: 'beacon'
});

assert.strictEqual(cases, 13);
console.log('Owned discovery release evaluations passed (13 cases).');
