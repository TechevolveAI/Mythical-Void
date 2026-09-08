#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'docs/company/growth/OWNED_CHANNEL_ATTENTION_2026-09-08.json');
const validator = path.join(__dirname, 'validate-owned-channel-attention.cjs');
const base = JSON.parse(fs.readFileSync(source, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function execute(value) {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-owned-attention-'));
    const target = path.join(fixtureRoot, 'docs/company/growth/OWNED_CHANNEL_ATTENTION_2026-09-08.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    const result = spawnSync(process.execPath, [validator, '--root', fixtureRoot], { encoding: 'utf8', timeout: 30_000 });
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    return result;
}

const baseline = execute(base);
assert.strictEqual(baseline.status, 0, baseline.stderr);
assert.strictEqual(JSON.parse(baseline.stdout).clonesUsedAsAudienceEvidence, false);
cases += 1;

const invalid = [
    ['invented views', value => { value.observations.repositoryViews.count = 2000; }, 'view evidence has drifted'],
    ['clones called audience', value => { value.observations.repositoryClones.useForAudienceDecisions = true; }, 'excluded from audience decisions'],
    ['lost automation ambiguity', value => { value.observations.repositoryClones.reason = 'Every clone is a new fan.'; }, 'clone ambiguity'],
    ['invented referrer', value => { value.observations.popularReferrers.push({ referrer: 'reddit.com', count: 10, uniques: 10 }); }, 'popular referrer evidence'],
    ['polish loop reopened', value => { value.interpretation.decision = 'Spend another month polishing GitHub.'; }, 'owned-channel decision'],
    ['external post invented', value => { value.authority.externalPostMade = true; }, 'externalPostMade'],
    ['paid promotion invented', value => { value.authority.paidPromotionStarted = true; }, 'paidPromotionStarted']
];

for (const [name, mutate, expected] of invalid) {
    const value = clone(base);
    mutate(value);
    const result = execute(value);
    assert.strictEqual(result.status, 1, `${name} should fail`);
    assert(result.stderr.includes(expected), `${name} should report ${expected}`);
    cases += 1;
}

assert.strictEqual(cases, 8);
console.log(`Owned-channel attention safeguards passed (${cases} cases).`);
