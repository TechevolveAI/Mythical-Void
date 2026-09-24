const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
require('./sync-website-analytics-core.cjs');
const sources = [fs.readFileSync('index.html', 'utf8').match(/<!-- Google tag:[\s\S]*?<script>([\s\S]*?)<\/script>/)[1], fs.readFileSync('public/discovery.js', 'utf8')];
let checks = 0;
function fixture(code, { choice, owner, url = 'https://mythicalvoid.com/', referrer, blocked } = {}) {
    const dom = new JSDOM('<!doctype html><footer></footer>', { url, referrer: referrer || undefined, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
    const w = dom.window;
    if (choice) w.localStorage.setItem('mythical-analytics-consent', choice);
    if (owner) w.localStorage.setItem('mythical-analytics-owner-excluded', 'true');
    if (blocked) Object.defineProperty(w, 'localStorage', { get() { throw new Error('unavailable'); } });
    w.eval(code);
    return { w, api: w.MythicalAnalytics, scripts: () => w.document.querySelectorAll('script[src*="googletagmanager"]').length,
        events: () => (w.dataLayer || []).map(a => Array.from(a)).filter(a => a[0] === 'event') };
}
function check(fn) { fn(); checks++; }
for (const code of sources) {
    for (const choice of [undefined, 'denied', 'invalid']) check(() => {
        const f = fixture(code, { choice }); assert.equal(f.scripts(), 0); assert.equal(f.events().length, 0);
        assert.equal(f.api.track('play_selected'), false); f.w.close();
    });
    check(() => { const f = fixture(code, { choice: 'granted', owner: true }); f.api.setConsent('granted'); assert.equal(f.api.getConsent(), 'denied'); assert.equal(f.scripts(), 0); assert.equal(f.events().length, 0); f.w.close(); });
    for (const blocked of [false, true]) check(() => {
        const f = fixture(code, { blocked }); f.api.setConsent('granted'); f.api.setConsent('granted');
        assert.equal(f.scripts(), 1); assert.equal(f.events().filter(e => e[1] === 'page_view').length, 1);
        assert.equal(f.events().filter(e => e[1] === 'discovery_arrival').length, 1);
        f.w.document.cookie = '_ga=testing; path=/'; f.api.setConsent('denied');
        assert.equal(f.scripts(), 0); assert.equal(f.w['ga-disable-' + f.w.MYTHICAL_GOOGLE_TAG_ID], true);
        assert(!f.w.document.cookie.includes('_ga=')); assert.equal(f.api.track('play_selected'), false); f.w.close();
    });
    for (const [referrer, expected] of [['https://www.youtube.com/watch?v=canary123', 'youtube'], ['https://www.linkedin.com/posts/canary123','linkedin'], ['https://youtube.com.evil.test/canary123','other_site'], ['', 'direct_or_private']]) check(() => {
        const f = fixture(code, { choice:'granted', referrer, url:'https://mythicalvoid.com/?email=canary123#secret' });
        const data = JSON.stringify(f.w.dataLayer);
        assert(!data.includes('canary123')); assert(!data.includes('secret')); assert.equal(f.events()[0][2].entry_source, expected); f.w.close();
    });
    check(() => {
        const f = fixture(code, { choice:'granted', url:'https://mythicalvoid.com/?utm_source=youtube&utm_medium=organic_video&utm_campaign=through_the_void_launch&utm_content=trailer_description' });
        assert.equal(f.events()[0][2].entry_source, 'youtube');
        assert(JSON.stringify(f.w.dataLayer).includes('"campaign_name":"through_the_void_launch"')); f.w.close();
    });
    check(() => {
        const f = fixture(code, { choice:'granted', url:'https://mythicalvoid.com/user/canary123?utm_source=youtube&utm_medium=wrong&utm_campaign=canary123' });
        assert.equal(f.events()[0][2].source_page, '/other/'); assert.equal(f.events()[0][2].entry_source, 'direct_or_private');
        assert(!JSON.stringify(f.w.dataLayer).includes('canary123'));
        assert.equal(f.api.track('not_allowed', { email:'private' }), false);
        assert.equal(f.api.track('trailer_progress', { watch_bucket:'private' }), false); f.w.close();
    });
    check(() => {
        const f = fixture(code, { choice:'granted' });
        f.w.dispatchEvent(new f.w.StorageEvent('storage', { key:'mythical-analytics-owner-excluded', newValue:'true' }));
        assert.equal(f.api.getConsent(),'denied'); assert.equal(f.scripts(),0); f.w.close();
    });
}
// Unit-only route guards; never open or test the game.
for (const url of ['https://mythicalvoid.com/play/', 'https://mythicalvoid.com/game/', 'https://mythicalvoid.com/?testBoss=1']) check(() => {
    const f = fixture(sources[0], { choice:'granted', url }); assert.equal(f.api,undefined); assert.equal(f.scripts(),0); f.w.close();
});
console.log(`Website analytics runtime: ${checks} checks passed; no network requests made.`);
