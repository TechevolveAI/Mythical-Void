#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { validateSocialFirstWeek, loadFromRoot } = require('./validate-social-first-week-pack.cjs');

const base = loadFromRoot(path.resolve(__dirname, '..', '..'));
const clone = value => JSON.parse(JSON.stringify(value));
const crypto = require('crypto');
assert.deepStrictEqual(validateSocialFirstWeek(base), []);

const cases = [
    ['invent handle availability', record => { record.identity.handleAvailabilityConfirmed = true; }, 'account or handle ownership was invented'],
    ['pretend LinkedIn is publishing ready', record => { record.channelActions.find(item => item.platform === 'LinkedIn').publishingReady = true; }, 'publication readiness'],
    ['invent profile ownership', record => { record.actionTimeGate.profileOwnershipConfirmed = true; }, 'adult LinkedIn profile was invented'],
    ['invent complete preview approval', record => { record.actionTimeGate.completePreviewApproved = true; }, 'action-time approval or reply cover was invented'],
    ['weaken fresh approval window', record => { record.actionTimeGate.approvalWindowMinutes = 1440; }, 'fresh all-or-nothing publication gate'],
    ['alter exact LinkedIn post', record => { record.recommendedStart.exactPostBody += ' Great for everyone!'; }, 'drifted from its source pack'],
    ['alter exact LinkedIn post fingerprint', record => { record.recommendedStart.exactPostSha256 = '0'.repeat(64); }, 'fingerprint is invalid'],
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

for (const [name, mutate, expected] of [
    ['authorize source post', founding => { founding.firstPost.publishingAuthorized = true; }, 'source invents account, preview or publication authority'],
    ['alter source post fingerprint', founding => { founding.firstPost.sha256 = '0'.repeat(64); }, 'fingerprint is invalid'],
    ['use NASA-powered claim', founding => { founding.firstPost.copy = founding.firstPost.copy.replace('credited public NASA material', 'NASA-powered discovery'); }, 'drifted from its source pack'],
    ['leave live preview stale', founding => { founding.livePreviewCheck.checkedAt = '2026-08-27T07:47:12Z'; }, 'live preview check is stale'],
    ['detach preview from live release', founding => { founding.livePreviewCheck.sourceDeployId = 'old-deploy'; }, 'not tied to the published release'],
    ['record broken preview image', founding => { founding.livePreviewCheck.imageStatus = 404; }, 'preview image was not healthy'],
    ['lose generated-art disclosure', founding => { founding.livePreviewCheck.generatedArtworkDisclosureObserved = false; }, 'generated-art disclosure'],
    ['pretend LinkedIn rendered the card', founding => { founding.livePreviewCheck.linkedInCrawlerPreviewObserved = true; }, 'mistaken for a checked LinkedIn preview']
]) {
    const founding = clone(base.founding);
    mutate(founding);
    const failures = validateSocialFirstWeek({ ...base, founding });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

const synchronizedCopyCases = [
    ['replace founder voice with campaign language', copy => copy.replace(/^My son and I started Mythical Void at home/, 'Mythical Void is an innovative game'), 'direct founder voice'],
    ['remove the shared questions', copy => copy.replace('We kept asking each other strange questions.', 'We created a product concept.'), 'shared father-and-son imagination'],
    ['hide the human release decisions', copy => copy.replace('AI helped us build, but people made the story, safety and release decisions.', 'AI built the experience.'), 'human responsibility'],
    ['remove the artwork warning', copy => copy.replace('If LinkedIn shows the page picture, it is imagined artwork for the wider creature universe, not gameplay.', ''), 'automatic artwork preview'],
    ['remove the useful feedback invitation', copy => copy.replace('If you try the first minute, I would genuinely like to know what made sense and what did not.', 'Please like and share.'), 'founder feedback invitation'],
    ['add the child age', copy => `${copy}\n\nMy son is nine years old.`, 'unnecessary child detail']
];

for (const [name, mutate, expected] of synchronizedCopyCases) {
    const record = clone(base.record);
    const founding = clone(base.founding);
    const copy = mutate(record.recommendedStart.exactPostBody);
    const hash = crypto.createHash('sha256').update(copy).digest('hex');
    record.recommendedStart.exactPostBody = copy;
    record.recommendedStart.exactPostSha256 = hash;
    founding.firstPost.copy = copy;
    founding.firstPost.sha256 = hash;
    const failures = validateSocialFirstWeek({ ...base, record, founding });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

console.log(`Social first-week safeguards passed (${cases.length + 9 + synchronizedCopyCases.length} cases).`);
