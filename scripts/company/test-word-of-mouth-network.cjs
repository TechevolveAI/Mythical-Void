#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-word-of-mouth-network.cjs');
const files = [
    'public/playable-now/index.html',
    'public/studio/index.html',
    'public/nasa-space-science/index.html',
    'public/educators/index.html',
    'public/discovery.js',
    'public/discovery.css',
    'public/updates/releases.json',
    'docs/company/growth/HATCH_CHALLENGE_LOOP.json',
    'docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json',
    'docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.md',
    'package.json'
];
let caseCount = 0;

function fixture(mutate) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-word-of-mouth-'));
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

function invalid(relative, mutate, expected) {
    caseCount += 1;
    const root = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, relative);
        fs.writeFileSync(target, mutate(fs.readFileSync(target, 'utf8')));
    });
    try {
        const result = execute(root);
        assert.strictEqual(result.status, 1);
        assert(result.stderr.includes(expected), `missing failure: ${expected}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

async function browserShareCase({ nativeShare }) {
    const html = '<!doctype html><body><section data-share-card data-share-url="https://mythicalvoid.com/studio/" data-share-title="The Mythical Void story" data-share-text="A father-and-son idea became a free browser creature adventure."><button data-share-game><span data-share-label>Share</span></button><button data-copy-game>Copy</button><p data-share-status></p></section></body>';
    const dom = new JSDOM(html, { url: 'https://mythicalvoid.com/studio/', runScripts: 'outside-only' });
    dom.window.localStorage.setItem('mythical-analytics-consent', 'denied');
    let shared = null;
    let copied = null;
    Object.defineProperty(dom.window.navigator, 'share', { value: nativeShare ? async data => { shared = data; } : undefined, configurable: true });
    Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async value => { copied = value; } }, configurable: true });
    dom.window.eval(fs.readFileSync(path.join(repositoryRoot, 'public/discovery.js'), 'utf8'));
    dom.window.document.querySelector(nativeShare ? '[data-share-game]' : '[data-copy-game]').click();
    await new Promise(resolve => setImmediate(resolve));
    return { shared, copied, status: dom.window.document.querySelector('[data-share-status]').textContent };
}

async function browserHatchChallengeCase({ nativeShare }) {
    const html = '<!doctype html><body><section data-hatch-challenge><button data-hatch-challenge-share><span data-hatch-challenge-label>Invite someone to hatch</span></button><button data-hatch-challenge-copy>Copy challenge link</button><p data-hatch-challenge-status></p></section></body>';
    const dom = new JSDOM(html, { url: 'https://mythicalvoid.com/playable-now/#hatch-challenge', runScripts: 'outside-only' });
    dom.window.localStorage.setItem('mythical-analytics-consent', 'denied');
    let shared = null;
    let copied = null;
    Object.defineProperty(dom.window.navigator, 'share', { value: nativeShare ? async data => { shared = data; } : undefined, configurable: true });
    Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async value => { copied = value; } }, configurable: true });
    dom.window.eval(fs.readFileSync(path.join(repositoryRoot, 'public/discovery.js'), 'utf8'));
    dom.window.document.querySelector(nativeShare ? '[data-hatch-challenge-share]' : '[data-hatch-challenge-copy]').click();
    await new Promise(resolve => setImmediate(resolve));
    return {
        shared,
        copied,
        label: dom.window.document.querySelector('[data-hatch-challenge-label]').textContent,
        status: dom.window.document.querySelector('[data-hatch-challenge-status]').textContent
    };
}

(async () => {
    caseCount += 1;
    const baselineRoot = fixture();
    try {
        const baseline = execute(baselineRoot);
        assert.strictEqual(baseline.status, 0, baseline.stderr);
        const output = JSON.parse(baseline.stdout);
        assert.strictEqual(output.sharePageCount, 4);
        assert.strictEqual(output.recipientCollection, false);
        assert.strictEqual(output.youtubeVisualGateOpen, false);
    } finally {
        fs.rmSync(baselineRoot, { recursive: true, force: true });
    }

    invalid('public/studio/index.html', source => source.replace('data-share-url="https://mythicalvoid.com/studio/"', 'data-share-url="https://mythicalvoid.com/?utm_source=social"'), 'clean page-specific URL is missing');
    invalid('public/discovery.js', source => source.split('shareCard.dataset.shareUrl').join("'https://example.com/'"), 'shareCard.dataset.shareUrl');
    invalid('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json', source => source.replace('"socialPublishingAuthorized": false', '"socialPublishingAuthorized": true'), 'socialPublishingAuthorized');
    invalid('public/updates/releases.json', source => source.replace('"id": "SIGNAL-017"', '"id": "SIGNAL-017-WITHDRAWN"'), 'Signal 017');
    invalid('public/updates/releases.json', source => source.replace('"id": "SIGNAL-023"', '"id": "SIGNAL-023-WITHDRAWN"'), 'Signal 023');
    invalid('docs/company/growth/HATCH_CHALLENGE_LOOP.json', source => source.replace('"multiplayerClaimed": false', '"multiplayerClaimed": true'), 'Hatch Challenge promise drifted');

    caseCount += 1;
    const native = await browserShareCase({ nativeShare: true });
    assert.strictEqual(JSON.stringify(native.shared), JSON.stringify({
        title: 'The Mythical Void story',
        text: 'A father-and-son idea became a free browser creature adventure.',
        url: 'https://mythicalvoid.com/studio/'
    }));
    assert.strictEqual(native.copied, null);
    assert.strictEqual(native.status, 'Thanks for passing the signal on.');

    caseCount += 1;
    const copied = await browserShareCase({ nativeShare: false });
    assert.strictEqual(copied.shared, null);
    assert.strictEqual(copied.copied, 'https://mythicalvoid.com/studio/');
    assert.strictEqual(copied.status, 'Clean link copied — no tracking code.');

    caseCount += 1;
    const hatchNative = await browserHatchChallengeCase({ nativeShare: true });
    assert.strictEqual(JSON.stringify(hatchNative.shared), JSON.stringify({
        title: 'The Mythical Void Hatch Challenge',
        text: 'Want to hatch the same mystery and compare what we get? Mythical Void is free in your browser—no download or account needed.',
        url: 'https://mythicalvoid.com/playable-now/#hatch-challenge'
    }));
    assert.strictEqual(hatchNative.copied, null);
    assert.strictEqual(hatchNative.status, 'Signal sent. Now see what hatches.');

    caseCount += 1;
    const hatchCopied = await browserHatchChallengeCase({ nativeShare: false });
    assert.strictEqual(hatchCopied.shared, null);
    assert.strictEqual(hatchCopied.copied, 'https://mythicalvoid.com/playable-now/#hatch-challenge');
    assert.strictEqual(hatchCopied.label, 'Copy challenge link');
    assert.strictEqual(hatchCopied.status, 'Challenge link copied — no tracking code.');

    assert.strictEqual(caseCount, 11);
    console.log('Word-of-mouth network evaluations passed (11 cases).');
})().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
