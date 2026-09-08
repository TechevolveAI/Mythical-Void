#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { validateSocialIdentity, loadFromRoot } = require('./validate-social-identity-reservation.cjs');
const base = loadFromRoot(path.resolve(__dirname, '..', '..'));
const clone = value => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(validateSocialIdentity(base), []);

const cases = [
    ['fake availability', record => { record.canonicalIdentity.availabilityConfirmed = true; }, 'availability must not be claimed'],
    ['claim unrelated YouTube account', record => { record.publicAudit.exactNameFindings.find(item => item.platform === 'YouTube').ours = true; }, 'YouTube exact-name collision'],
    ['claim an official account', record => { record.publicAudit.officialAccountsConfirmed = 1; }, 'official social account was claimed'],
    ['authorize account creation', record => { record.authority.accountCreationAuthorized = true; }, 'authority accountCreationAuthorized'],
    ['authorize terms', record => { record.authority.platformTermsAcceptanceAuthorized = true; }, 'authority platformTermsAcceptanceAuthorized'],
    ['authorize automated replies', record => { record.authority.automatedRepliesAuthorized = true; }, 'authority automatedRepliesAuthorized'],
    ['authorize child contact', record => { record.authority.childContactAuthorized = true; }, 'authority childContactAuthorized'],
    ['lose generated-art boundary', record => { record.publicationRules = record.publicationRules.filter(rule => !/presented as gameplay/i.test(rule)); }, 'generated-art boundary'],
    ['allow invented popularity', record => { record.publicationRules = record.publicationRules.filter(rule => !/Never invent/i.test(rule)); }, 'honest audience rule'],
    ['launch Discord early', record => { record.openingOrder.find(item => item.route === 'Discord').state = 'ready'; }, 'Discord must remain deferred']
];

for (const [name, mutate, expected] of cases) {
    const record = clone(base.record);
    mutate(record);
    const failures = validateSocialIdentity({ ...base, record });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}
console.log(`Social identity safeguards passed (${cases.length + 1} cases).`);
