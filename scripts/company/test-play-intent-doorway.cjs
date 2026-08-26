#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-play-intent-doorway.cjs');
const files = [
    'public/playable-now/index.html',
    'public/discovery.js',
    'docs/company/growth/PLAY_INTENT_DOORWAY.json'
];
let cases = 0;

function makeFixture(mutate) {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-play-intent-'));
    for (const relative of files) {
        const destination = path.join(fixture, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(root, relative), destination);
    }
    if (mutate) mutate(fixture);
    return fixture;
}

function execute(fixture) {
    return spawnSync(process.execPath, [validator, '--root', fixture], { encoding: 'utf8', timeout: 30_000 });
}

function invalid(relative, replace, message) {
    cases += 1;
    const fixture = makeFixture(fixtureRoot => {
        const file = path.join(fixtureRoot, relative);
        fs.writeFileSync(file, replace(fs.readFileSync(file, 'utf8')));
    });
    try {
        const result = execute(fixture);
        assert.strictEqual(result.status, 1);
        assert(result.stderr.includes(message), `missing failure: ${message}`);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
}

cases += 1;
const baseline = makeFixture();
try {
    const result = execute(baseline);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(JSON.parse(result.stdout).valid, true);
} finally {
    fs.rmSync(baseline, { recursive: true, force: true });
}

invalid('public/playable-now/index.html', source => source.replace('data-intent-choice="story"', 'data-intent-choice="missing"'), 'page is missing story');
invalid('public/playable-now/index.html', source => source.replace('href="/play/" data-intent-play', 'href="/play/?source=story" data-intent-play'), 'tracking address');
invalid('public/discovery.js', source => source.replace("readChoice() !== 'granted'", 'false'), 'measurement is not stopped before consent');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"choiceStored": false', '"choiceStored": true'), 'choice collection boundary is invalid');

function interactiveResult(consent, choice) {
    const page = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
    const body = page.match(/<body[^>]*>([\s\S]*?)<script src="\/discovery\.js[^>]*><\/script>/)?.[1];
    const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
        url: 'https://mythicalvoid.com/playable-now/',
        runScripts: 'outside-only'
    });
    if (consent) dom.window.localStorage.setItem('mythical-analytics-consent', consent);
    const play = dom.window.document.querySelector('[data-intent-play]');
    play.addEventListener('click', event => event.preventDefault());
    dom.window.eval(fs.readFileSync(path.join(root, 'public/discovery.js'), 'utf8'));
    dom.window.document.querySelector(`[data-intent-choice="${choice}"]`).click();
    play.click();
    return {
        answerHidden: dom.window.document.querySelector('[data-intent-answer]').hidden,
        title: dom.window.document.querySelector('[data-intent-title]').textContent,
        cta: dom.window.document.querySelector('[data-intent-cta]').textContent,
        pressed: dom.window.document.querySelector(`[data-intent-choice="${choice}"]`).getAttribute('aria-pressed'),
        events: dom.window.dataLayer.map(entry => Array.from(entry)).filter(entry => entry[0] === 'event')
    };
}

cases += 1;
const story = interactiveResult('granted', 'story');
assert.strictEqual(story.answerHidden, false);
assert.match(story.title, /Project Beacon/);
assert.strictEqual(story.cta, 'Begin Project Beacon');
assert.strictEqual(story.pressed, 'true');
assert.strictEqual(story.events.length, 1);
assert.strictEqual(story.events[0][1], 'play_selected');
assert.strictEqual(story.events[0][2].source_area, 'intent_story');

cases += 1;
const denied = interactiveResult('denied', 'wonder');
assert.strictEqual(denied.answerHidden, false);
assert.strictEqual(denied.events.length, 0);

assert.strictEqual(cases, 7);
console.log('Play-intent doorway checks passed (7 scenarios).');

