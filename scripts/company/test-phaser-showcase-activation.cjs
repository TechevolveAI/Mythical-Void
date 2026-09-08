#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { validatePhaserShowcase, loadFromRoot } = require('./validate-phaser-showcase-activation.cjs');

const base = loadFromRoot(path.resolve(__dirname, '..', '..'));
const clone = value => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(validatePhaserShowcase(base), []);

const cases = [
    ['missing WIP label', record => { record.preparedTopic.title = 'Mythical Void — a Phaser browser adventure'; }, 'prepared title changed'],
    ['tracked game link', record => { record.preparedTopic.directGameUrl += '?from=phaser'; }, 'clean direct game link'],
    ['invented audience result', record => { record.community.recentActivityMeaning = 'This will bring players.'; }, 'honest limit'],
    ['premature account', record => { record.authority.accountOpened = true; }, 'authority accountOpened'],
    ['premature terms', record => { record.preflight.platformTermsAcceptedByKevin = true; }, 'must remain false'],
    ['weak media attached', record => { record.preparedTopic.mediaAttached = true; }, 'visual media must stay out'],
    ['retired wording', record => { record.preparedTopic.body += ' Follow the signal with your companion.'; }, 'retired public wording'],
    ['missing human replies', record => { record.preflight.adultReplyOwner = null; }, 'named reply owner'],
    ['child contact enabled', record => { record.authority.childContactAuthorized = true; }, 'authority childContactAuthorized']
];

for (const [name, mutate, expected] of cases) {
    const record = clone(base.record);
    mutate(record);
    const failures = validatePhaserShowcase({ ...base, record });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

console.log(`Phaser Showcase safeguards passed (${cases.length + 1} cases).`);
