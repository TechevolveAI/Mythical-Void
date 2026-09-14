#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const optOutPath = path.join(repositoryRoot, 'public', 'analytics-opt-out', 'index.html');
const optOutHtml = fs.readFileSync(optOutPath, 'utf8');
const homepage = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
const discovery = fs.readFileSync(path.join(repositoryRoot, 'public', 'discovery.js'), 'utf8');
const smoke = fs.readFileSync(path.join(repositoryRoot, 'scripts', 'company', 'smoke-website-analytics-consent.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));

assert(optOutHtml.includes('noindex, nofollow'));
assert(optOutHtml.includes("localStorage.setItem('mythical-analytics-owner-excluded', 'true')"));
assert(optOutHtml.includes("localStorage.setItem('mythical-analytics-consent', 'denied')"));
assert(optOutHtml.includes("window['ga-disable-' + measurementId] = true"));
assert(optOutHtml.includes("Max-Age=0"));
assert(!optOutHtml.includes('googletagmanager.com'));
assert(!optOutHtml.includes('google-analytics.com'));

for (const source of [homepage, discovery]) {
    assert(source.includes("mythical-analytics-owner-excluded"));
    assert(source.includes("window['ga-disable-'"));
    assert(source.includes('if (!analyticsExcluded)'));
    assert(source.includes("if (analyticsExcluded) return 'denied'"));
}

const inlineScript = optOutHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(inlineScript, 'opt-out script is missing');
const values = new Map();
const cookieWrites = [];
const windowObject = {
    location: { hostname: 'www.mythicalvoid.com' },
    localStorage: { setItem: (key, value) => values.set(key, value) }
};
const documentObject = {
    get cookie() { return '_ga=GA1.1.123; _ga_TEST=GS1.1.456; unrelated=keep'; },
    set cookie(value) { cookieWrites.push(value); }
};
vm.runInNewContext(inlineScript, { window: windowObject, document: documentObject });

assert.strictEqual(values.get('mythical-analytics-owner-excluded'), 'true');
assert.strictEqual(values.get('mythical-analytics-consent'), 'denied');
assert.strictEqual(windowObject['ga-disable-G-FTM4W73ECQ'], true);
assert.strictEqual(cookieWrites.length, 4);
assert(cookieWrites.every(value => value.includes('Max-Age=0')));
assert(cookieWrites.some(value => value.includes('domain=.mythicalvoid.com')));
assert(cookieWrites.every(value => !value.startsWith('unrelated=')));
assert(smoke.includes("SMOKE_MODE === 'owner-opt-out'"));
assert(smoke.includes("gameRouteVisited: false"));
assert(smoke.includes('applyBrowserAudioPolicy'));
assert.strictEqual(packageJson.scripts['smoke:analytics-owner-opt-out'], 'ANALYTICS_SMOKE_MODE=owner-opt-out node scripts/company/smoke-website-analytics-consent.cjs');

console.log('Analytics owner opt-out checks passed (28 assertions).');
