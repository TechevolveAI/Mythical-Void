#!/usr/bin/env node

const assert = require('assert');
const { expectedContentType, inspectCorePages, inspectLivePresence, ownedLinks, parseArguments, visibleText } = require('./audit-live-site-health.cjs');

const repeat = (value, count) => Array.from({ length: count }, () => value).join('');
const clean = {
    homeHtml: `<script>window.MYTHICAL_GOOGLE_TAG_ID = 'G-FTM4W73ECQ'; gtag('consent','default',{analytics_storage:'denied'});</script>`,
    playHtml: `<title>Mythical Void | Free Creature Adventure Browser Game</title><script>var path='/play'; var isGameRoute = path === '/play'; if (isGameRoute) return; window.MYTHICAL_GOOGLE_TAG_ID='G-FTM4W73ECQ';</script>`,
    updatesHtml: '<a href="/updates/feed.xml">Follow the news</a>',
    rssBody: repeat('<item></item>', 17),
    jsonBody: JSON.stringify({ items: Array.from({ length: 17 }, (_, index) => ({ id: index })) })
};
let cases = 0;
cases += 1; assert.strictEqual(visibleText('<style>companion</style><script>signal</script><p>Creature</p>'), 'Creature');
cases += 1; assert.deepStrictEqual(ownedLinks('<a href="/play/?ref=test#start">Play</a><a href="https://example.com">Away</a>', 'https://mythicalvoid.com/'), ['https://mythicalvoid.com/play/']);
cases += 1; assert.strictEqual(expectedContentType('https://mythicalvoid.com/updates/feed.json'), 'application/feed+json');
cases += 1; assert.strictEqual(expectedContentType('https://mythicalvoid.com/api/live-presence'), 'application/json');
cases += 1; assert.deepStrictEqual(inspectCorePages(clean).errors, []);
cases += 1; assert.match(inspectCorePages({ ...clean, homeHtml: '<p>No analytics boundary</p>' }).errors.join('\n'), /consent-denied/);
cases += 1; assert.match(inspectCorePages({ ...clean, playHtml: '<title>Mythical Void | Free Creature Adventure Browser Game</title><script src="https://www.googletagmanager.com/gtag/js?id=G-FTM4W73ECQ"></script>' }).errors.join('\n'), /leaked into the game/);
cases += 1; assert.match(inspectCorePages({ ...clean, jsonBody: JSON.stringify({ items: Array.from({ length: 16 }, (_, index) => ({ id: index })) }) }).errors.join('\n'), /feed count mismatch/);
cases += 1; assert.strictEqual(parseArguments(['--output', 'reports/check.json']).outputPath.endsWith('reports/check.json'), true);
cases += 1; assert.deepStrictEqual(inspectLivePresence(JSON.stringify({ status: 'quiet', range: null, activeWindowSeconds: 90, approximate: true })).errors, []);
cases += 1; assert.match(inspectLivePresence(JSON.stringify({ status: 'two_to_three', range: '4–6', activeWindowSeconds: 90, approximate: true })).errors.join('\n'), /range does not match/);
cases += 1; assert.match(inspectLivePresence(JSON.stringify({ status: 'one', range: '1', activeWindowSeconds: 90, approximate: true, sessionId: 'should-not-be-public' })).errors.join('\n'), /personal field exposed/);
console.log(`${cases}/${cases} live-site health safeguard cases passed`);
