#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { validateSocialFirstWeek, loadFromRoot } = require('./validate-social-first-week-pack.cjs');

const base = loadFromRoot(path.resolve(__dirname, '..', '..'));
const clone = value => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(validateSocialFirstWeek(base), []);

const cases = [
    ['invent handle availability', record => { record.identity.handleAvailabilityConfirmed = true; }, 'account or handle ownership was invented'],
    ['require another Workspace subscription', record => { record.costAndAccountPosition.additionalGoogleWorkspaceSubscriptionRequired = true; }, 'another Google Workspace'],
    ['launch Instagram before visual approval', record => { record.channelActions.find(item => item.platform === 'Instagram').publishingReady = true; }, 'Instagram was made publication-ready'],
    ['launch TikTok before visual approval', record => { record.channelActions.find(item => item.platform === 'TikTok').publicationAuthorized = true; }, 'TikTok was made publication-ready'],
    ['launch Discord', record => { record.channelActions.find(item => item.platform === 'Discord').state = 'ready'; }, 'Discord must remain deferred'],
    ['change the first-week order', record => { record.firstWeek.find(item => item.contentId === 'PN-001').contentId = 'PN-004'; }, 'first-week content sequence drifted'],
    ['authorize a public step', record => { record.firstWeek[1].externalActionAuthorized = true; }, 'invents external authority'],
    ['authorize account creation', record => { record.authority.accountCreationAuthorized = true; }, 'authority accountCreationAuthorized'],
    ['authorize publishing', record => { record.authority.publishingAuthorized = true; }, 'authority publishingAuthorized'],
    ['authorize automated replies', record => { record.replyRules.automatedRepliesAuthorized = true; }, 'human 48-hour reply cover'],
    ['remove child boundary', record => { record.replyRules.privateConversationWithChildPermitted = true; }, 'child-safety reply boundary'],
    ['allow invented popularity', record => { record.contentRules = record.contentRules.filter(rule => !/Never invent/i.test(rule)); }, 'honest audience rule'],
    ['lose NASA boundary', record => { record.contentRules = record.contentRules.filter(rule => !/NASA does not endorse/i.test(rule)); }, 'NASA boundary'],
    ['use retired public wording', record => { record.channelActions.find(item => item.platform === 'Instagram').profile.bioDraft = 'Meet your AI companion.'; }, 'retired public wording']
];

for (const [name, mutate, expected] of cases) {
    const record = clone(base.record);
    mutate(record);
    const failures = validateSocialFirstWeek({ ...base, record });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

console.log(`Social first-week safeguards passed (${cases.length + 1} cases).`);

