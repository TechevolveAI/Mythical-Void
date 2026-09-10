#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { deriveFounderStatus } = require('./founder-live-status.cjs');

const root = path.resolve(__dirname, '..', '..');
const control = JSON.parse(fs.readFileSync(
    path.join(root, 'docs/company/operations/founder-control-page.json'),
    'utf8'
));

const healthy = {
    checkedAt: '2026-09-10T09:05:55.149Z',
    status: 'pass',
    playRouteReachable: true,
    sitemapUrls: 17,
    uniqueOwnedLinksChecked: 56,
    rssItems: 24,
    jsonItems: 24,
    analyticsDefaultDenied: true,
    gameRouteLoadsWebsiteTag: false,
    livePresenceEndpointHealthy: true,
    errors: []
};

const ready = deriveFounderStatus(control, healthy);
assert.strictEqual(ready.publicDoorwayHealthy, true);
assert.strictEqual(ready.discoveryMayProceedToHumanApproval, true);
assert.strictEqual(ready.publicActionAuthorized, false);
assert.strictEqual(ready.currentDecisionId, 'FD-002');
assert.match(ready.nextAction, /r\/WebGames/);
assert.strictEqual(ready.truthBoundary.inventedActivityAllowed, false);

for (const [name, mutation] of [
    ['unreachable game', status => { status.playRouteReachable = false; status.status = 'fail'; status.errors = ['play unavailable']; }],
    ['analytics permission missing', status => { status.analyticsDefaultDenied = false; status.status = 'fail'; status.errors = ['consent boundary']; }],
    ['website tag leaked into game', status => { status.gameRouteLoadsWebsiteTag = true; status.status = 'fail'; status.errors = ['tag leak']; }],
    ['activity endpoint unhealthy', status => { status.livePresenceEndpointHealthy = false; status.status = 'fail'; status.errors = ['presence']; }],
    ['news feeds disagree', status => { status.jsonItems = 23; status.status = 'fail'; status.errors = ['feeds']; }]
]) {
    const input = JSON.parse(JSON.stringify(healthy));
    mutation(input);
    const held = deriveFounderStatus(control, input);
    assert.strictEqual(held.publicDoorwayHealthy, false, name);
    assert.strictEqual(held.discoveryMayProceedToHumanApproval, false, name);
    assert.strictEqual(held.publicActionAuthorized, false, name);
    assert.strictEqual(held.currentDecisionId, null, name);
    assert.match(held.nextAction, /Restore the public website/, name);
}

console.log('Founder live-status safeguards passed (6 cases).');
