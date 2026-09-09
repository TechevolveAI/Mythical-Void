#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateGameJoltPage } = require('./validate-game-jolt-page-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const base = {
    candidate: JSON.parse(read('docs/company/growth/GAME_JOLT_PAGE_CANDIDATE_2026-09-09.json')),
    copy: read('docs/company/growth/GAME_JOLT_PAGE_CANDIDATE_2026-09-09.md'),
    visualRegister: JSON.parse(read('public/press/visual-publication-register.json')),
    packageJson: JSON.parse(read('package.json'))
};
const clone = value => JSON.parse(JSON.stringify(value));
const validate = (candidate, copy = base.copy) => validateGameJoltPage(candidate, copy, base.visualRegister, { root, packageJson: base.packageJson });

assert.deepStrictEqual(validate(base.candidate), []);

const cases = [
    ['invent an account', value => { value.authority.accountOpened = true; }, 'authority.accountOpened'],
    ['accept terms', value => { value.termsReview.termsAccepted = true; }, 'terms field termsAccepted'],
    ['pretend publication readiness', value => { value.releaseGate.readyForPublication = true; }, 'release gate readyForPublication'],
    ['claim an audience', value => { value.platform.playerCountClaimed = true; }, 'audience or player numbers'],
    ['invent a formal maturity rating', value => { value.listing.maturityRating = 'Everyone 7+'; }, 'formal maturity rating'],
    ['use retired creature wording', value => { value.listing.shortDescription += ' Meet your companion.'; }, 'retired companion wording'],
    ['use vague story wording', value => { value.listing.shortDescription += ' Follow the signal.'; }, 'vague signal wording'],
    ['promise unique creatures', value => { value.listing.features.push('Every creature is unique.'); }, 'unsupported creature claim'],
    ['attach gameplay screenshot', value => { value.mediaGate.gameplayScreenshotsAttached = 1; }, 'unapproved gameplay media'],
    ['pretend thumbnail approval', value => { value.mediaGate.requiredThumbnailApproved = true; }, 'approved catalogue media'],
    ['include optional API', value => { value.buildGate.gameJoltApiIncluded = true; }, 'build gate gameJoltApiIncluded'],
    ['invent current upload limits', value => { value.publicRequirementsObserved.currentPackageLimitsObserved = true; }, 'falsely confirmed'],
    ['mark signed-in review complete', value => { value.signedInReview.completed = true; }, 'signed-in form is falsely marked complete'],
    ['allow automated replies', value => { value.communityCare.automatedRepliesAllowed = true; }, 'community safety boundary'],
    ['allow private child conversation', value => { value.communityCare.privateConversationWithChildAllowed = true; }, 'community safety boundary'],
    ['add tracking', value => { value.listing.playUrl += '?utm_source=gamejolt'; }, 'clean owned links'],
    ['promise platform acceptance', value => { value.listing.claimBoundaries.platformAcceptancePromised = true; }, 'platformAcceptancePromised'],
    ['remove source', value => { value.sourceEvidence.pop(); }, 'official source evidence is incomplete']
];

for (const [name, mutate, expected] of cases) {
    const candidate = clone(base.candidate);
    mutate(candidate);
    const failures = validate(candidate);
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

console.log(`Game Jolt page safeguards passed (${cases.length + 1} cases).`);
