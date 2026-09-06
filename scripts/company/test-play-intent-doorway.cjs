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
    'public/discovery.css',
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
invalid('public/playable-now/index.html', source => source.replace('data-intent-share data-source-area', 'data-missing-share data-source-area'), 'intent-specific sharing controls are missing');
invalid('public/playable-now/index.html', source => source.replace('data-intent-mission-steps', 'data-missing-mission-steps'), 'starter mission bridge is missing');
invalid('public/playable-now/index.html', source => source.replace('class="play-intent-direct"', 'class="play-intent-delayed"'), 'first-screen direct Play choice is missing');
invalid('public/playable-now/index.html', source => source.replace('First-time players choose an age range, then begin.', 'Start instantly.'), 'honest first-screen direct Play choice is missing');
invalid('public/playable-now/index.html', source => source.replace('data-play-link data-source-area="hero"', 'data-play-link data-source-area="unknown"'), 'first-screen direct Play source is missing');
invalid('public/discovery.js', source => source.replace("readChoice() !== 'granted'", 'false'), 'measurement is not stopped before consent');
invalid('public/discovery.js', source => source.replace('/^#find-your-way\\/(wonder|create|challenge|story)$/', '/^#find-your-way\\/(.*)$/'), 'shared intent routes are not restricted');
invalid('public/discovery.js', source => source.replace('missionTitle:', 'missingMissionTitle:'), 'each reason to play needs one concrete starter mission');
invalid('public/discovery.css', source => source.replace('scroll-margin-top: 82px', 'scroll-margin-top: 0'), 'does not preserve the 82px site header');
invalid('public/discovery.css', source => source.replace('.play-intent-mission { padding-top: 1.25rem;', '.play-intent-mission { padding-top: 0;'), 'starter mission does not stack cleanly at phone width');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"choiceRememberedInBrowser": false', '"choiceRememberedInBrowser": true'), 'choice collection boundary is invalid');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"choiceSentToServer": false', '"choiceSentToServer": true'), 'choiceSentToServer must remain false');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"choiceRequiredBeforePlay": false', '"choiceRequiredBeforePlay": true'), 'visitors must be able to Play without completing the mood chooser');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"productionDeployId": "6a8fd3bd0ac52a00080eb726"', '"productionDeployId": "unverified"'), 'production verification is missing or drifted');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"savedPlayerDataInspected": false', '"savedPlayerDataInspected": true'), 'fresh-start audit savedPlayerDataInspected must remain false');
invalid('docs/company/growth/PLAY_INTENT_DOORWAY.json', source => source.replace('"phoneHatchActivationVerified": true', '"phoneHatchActivationVerified": false'), 'hatch-action proof phoneHatchActivationVerified is missing');

function interactiveResult(consent, choice, url = 'https://mythicalvoid.com/playable-now/', width = 1024, referrer = '') {
    const page = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
    const body = page.match(/<body[^>]*>([\s\S]*?)<script src="\/discovery\.js[^>]*><\/script>/)?.[1];
    const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
        url,
        ...(referrer ? { referrer } : {}),
        runScripts: 'outside-only'
    });
    if (consent) dom.window.localStorage.setItem('mythical-analytics-consent', consent);
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: width });
    dom.window.requestAnimationFrame = callback => callback();
    dom.window.scrollTo = () => {};
    const play = dom.window.document.querySelector('[data-intent-play]');
    play.addEventListener('click', event => event.preventDefault());
    dom.window.eval(fs.readFileSync(path.join(root, 'public/discovery.js'), 'utf8'));
    if (choice) {
        dom.window.document.querySelector(`[data-intent-choice="${choice}"]`).click();
        play.click();
    }
    const selected = dom.window.document.querySelector('[data-intent-choice][aria-pressed="true"]');
    return {
        answerHidden: dom.window.document.querySelector('[data-intent-answer]').hidden,
        title: dom.window.document.querySelector('[data-intent-title]').textContent,
        cta: dom.window.document.querySelector('[data-intent-cta]').textContent,
        missionTitle: dom.window.document.querySelector('[data-intent-mission-title]').textContent,
        missionSteps: Array.from(dom.window.document.querySelectorAll('[data-intent-mission-steps] li')).map(item => item.textContent),
        finish: dom.window.document.querySelector('[data-intent-finish]').textContent,
        answerAfterSelectedChoice: selected?.nextElementSibling?.matches('[data-intent-answer]') === true,
        selected: selected?.dataset.intentChoice || null,
        hash: dom.window.location.hash,
        events: dom.window.dataLayer.map(entry => Array.from(entry)).filter(entry => entry[0] === 'event')
    };
}

function directPlayResult(consent, referrer = '') {
    const page = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
    const body = page.match(/<body[^>]*>([\s\S]*?)<script src="\/discovery\.js[^>]*><\/script>/)?.[1];
    const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
        url: 'https://mythicalvoid.com/playable-now/',
        ...(referrer ? { referrer } : {}),
        runScripts: 'outside-only'
    });
    if (consent) dom.window.localStorage.setItem('mythical-analytics-consent', consent);
    const play = dom.window.document.querySelector('.play-intent-direct .button');
    play.addEventListener('click', event => event.preventDefault());
    dom.window.eval(fs.readFileSync(path.join(root, 'public/discovery.js'), 'utf8'));
    play.click();
    return dom.window.dataLayer.map(entry => Array.from(entry)).filter(entry => entry[0] === 'event');
}

function homepageResult(consent, referrer = '', grantAfterLoad = false) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const script = html.match(/<!-- Google tag:[\s\S]*?<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
    assert(script, 'homepage analytics script is missing');
    const dom = new JSDOM('<!doctype html><head></head><body></body>', {
        url: 'https://mythicalvoid.com/',
        ...(referrer ? { referrer } : {}),
        runScripts: 'outside-only'
    });
    if (consent) dom.window.localStorage.setItem('mythical-analytics-consent', consent);
    dom.window.eval(script);
    if (grantAfterLoad) dom.window.MythicalAnalytics.setConsent('granted');
    return dom.window.dataLayer.map(entry => Array.from(entry)).filter(entry => entry[0] === 'event');
}

cases += 1;
const story = interactiveResult('granted', 'story');
assert.strictEqual(story.answerHidden, false);
assert.match(story.title, /Project Beacon/);
assert.strictEqual(story.cta, 'Begin Project Beacon');
assert.match(story.missionTitle, /mission changes/i);
assert.strictEqual(story.missionSteps.length, 3);
assert.match(story.missionSteps[0], /first message/i);
assert.match(story.finish, /discovery and responsibility/i);
assert.strictEqual(story.selected, 'story');
assert.strictEqual(story.hash, '#find-your-way/story');
assert.strictEqual(story.events.length, 2);
assert.strictEqual(story.events[0][1], 'discovery_arrival');
assert.strictEqual(story.events[0][2].entry_source, 'direct_or_private');
assert.strictEqual(story.events[1][1], 'play_selected');
assert.strictEqual(story.events[1][2].source_area, 'intent_story');
assert.strictEqual(story.events[1][2].entry_source, 'direct_or_private');

cases += 1;
const denied = interactiveResult('denied', 'wonder');
assert.strictEqual(denied.answerHidden, false);
assert.strictEqual(denied.events.length, 0);

cases += 1;
const sharedCreation = interactiveResult('denied', null, 'https://mythicalvoid.com/playable-now/#find-your-way/create');
assert.strictEqual(sharedCreation.answerHidden, false);
assert.match(sharedCreation.title, /creature engine/);
assert.strictEqual(sharedCreation.selected, 'create');
assert.match(sharedCreation.missionTitle, /Hatch a creature/i);
assert.strictEqual(sharedCreation.missionSteps.length, 3);
assert.strictEqual(sharedCreation.hash, '#find-your-way/create');
assert.strictEqual(sharedCreation.events.length, 0);

cases += 1;
const phoneChallenge = interactiveResult('denied', 'challenge', 'https://mythicalvoid.com/playable-now/', 390);
assert.strictEqual(phoneChallenge.answerHidden, false);
assert.strictEqual(phoneChallenge.answerAfterSelectedChoice, true);
assert.match(phoneChallenge.missionTitle, /first guardian/i);
assert.strictEqual(phoneChallenge.missionSteps.length, 3);

cases += 1;
const directGranted = directPlayResult('granted');
assert.strictEqual(directGranted.length, 2);
assert.strictEqual(directGranted[0][1], 'discovery_arrival');
assert.strictEqual(directGranted[0][2].entry_source, 'direct_or_private');
assert.strictEqual(directGranted[1][1], 'play_selected');
assert.strictEqual(directGranted[1][2].source_area, 'hero');
assert.strictEqual(directGranted[1][2].entry_source, 'direct_or_private');

cases += 1;
const directDenied = directPlayResult('denied');
assert.strictEqual(directDenied.length, 0);

for (const [label, referrer, expected] of [
    ['search', 'https://www.google.com/search?q=free+creature+game', 'search'],
    ['game shelf', 'https://itch.io/games/html5', 'game_shelf'],
    ['social or creator', 'https://www.youtube.com/watch?v=example', 'social_or_creator'],
    ['owned site', 'https://mythicalvoid.com/creature-genetics/', 'owned_site']
]) {
    cases += 1;
    const events = directPlayResult('granted', referrer);
    assert.strictEqual(events.length, 2, `${label} should create arrival and Play events`);
    assert.strictEqual(events[0][2].entry_source, expected, `${label} arrival bucket drifted`);
    assert.strictEqual(events[1][2].entry_source, expected, `${label} Play bucket drifted`);
    assert(!JSON.stringify(events).includes(referrer), `${label} leaked the full referrer`);
}

cases += 1;
const savedHomepageConsent = homepageResult('granted', 'https://www.bing.com/search?q=new+browser+game');
assert.strictEqual(savedHomepageConsent.length, 1);
assert.strictEqual(savedHomepageConsent[0][1], 'discovery_arrival');
assert.strictEqual(savedHomepageConsent[0][2].entry_source, 'search');

cases += 1;
const deniedHomepageConsent = homepageResult('denied', 'https://poki.com/en/space');
assert.strictEqual(deniedHomepageConsent.length, 0);

cases += 1;
const newlyGrantedHomepageConsent = homepageResult(null, 'https://poki.com/en/space', true);
assert.strictEqual(newlyGrantedHomepageConsent.length, 1);
assert.strictEqual(newlyGrantedHomepageConsent[0][2].entry_source, 'game_shelf');

assert.strictEqual(cases, 32);
console.log('Play-intent doorway checks passed (32 scenarios).');
