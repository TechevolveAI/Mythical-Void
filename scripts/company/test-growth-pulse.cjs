#!/usr/bin/env node

const assert = require('assert');
const { compileGrowthPulse, renderMarkdown } = require('./compile-growth-pulse.cjs');

function csv(rows) {
    return rows.join('\n');
}

const valid = csv([
    '# GA4 aggregate export',
    'Date,Page path and screen class,Event name,Event count',
    '20260820,/,page_view,80',
    '20260820,/,play_selected,12',
    '20260820,/,share_link_copied,2',
    '20260821,/playable-now/,page_view,20',
    '20260821,/playable-now/,play_selected,5',
    '20260821,/playable-now/,share_completed,1',
    '20260821,/,session_start,90'
]);
const pulse = compileGrowthPulse(valid);
assert.strictEqual(pulse.totals.pageViews, 100);
assert.strictEqual(pulse.totals.playSelections, 17);
assert.strictEqual(pulse.totals.shares, 3);
assert.strictEqual(pulse.totals.playRate, 17);
assert.strictEqual(pulse.ignoredRows, 1);
assert.strictEqual(pulse.pages[0].route, '/');
assert.strictEqual(pulse.visualGate.approved, 0);
assert.strictEqual(pulse.visualGate.required, 4);
assert.match(renderMarkdown(pulse), /events and attempts, not unique people/i);
assert.match(renderMarkdown(pulse), /producing meaningful Play intent/);

assert.throws(() => compileGrowthPulse(csv([
    'Date,Page path and screen class,Event name,Event count,User ID',
    '20260820,/,page_view,1,abc'
])), /fields this report does not need: user id/);

assert.throws(() => compileGrowthPulse(csv([
    'Date,Page path and screen class,Event name,Event count',
    '20260820,/?child=1,page_view,1'
])), /contains a query or fragment/);

assert.throws(() => compileGrowthPulse(csv([
    'Date,Page path and screen class,Event name,Event count',
    '20260801,/,page_view,1',
    '20260809,/,page_view,1'
])), /use one seven-day period/);

const lowReach = compileGrowthPulse(csv([
    'Date,Page path and screen class,Event name,Event count',
    '20260820,/,page_view,12',
    '20260820,/,play_selected,3'
]));
assert.match(lowReach.decision, /Reach is still too small/);

console.log('Growth pulse checks passed (4 scenarios).');
