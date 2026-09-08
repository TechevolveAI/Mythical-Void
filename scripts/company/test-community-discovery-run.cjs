#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { loadFromRoot, validateCommunityRun } = require('./validate-community-discovery-run.cjs');
const { statusForRun } = require('./report-community-discovery-run.cjs');

const base = loadFromRoot(path.resolve(__dirname, '..', '..'));
const clone = value => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(validateCommunityRun(base), []);
assert.deepStrictEqual(statusForRun(base.run, new Date('2026-09-08T12:00:00Z')).observationsDue, []);

const invalidCases = [
    ['tracked link', run => { run.preparedPost.url += '?utm_source=reddit'; }, 'prepared post no longer matches'],
    ['invented post', run => { run.publication = { posted: true, postUrl: 'https://www.reddit.com/r/WebGames/comments/example/', publishedAt: '2026-09-08T12:00:00Z' }; }, 'action-time gate'],
    ['unpublished URL', run => { run.publication.postUrl = 'https://www.reddit.com/r/WebGames/comments/example/'; }, 'unpublished run'],
    ['early result', run => { run.observations.day2.platformViews = 10; }, 'before publication'],
    ['negative count', run => { run.observations.day7.publicCommentCount = -1; }, 'non-negative whole number'],
    ['retired wording', run => { run.preparedPost.firstComment += ' A companion follows the signal.'; }, 'prepared post no longer matches'],
    ['mismatched automatic preview', run => { run.preflight.automaticLinkPreviewMatchesExpected = false; }, 'cannot be recorded as mismatched'],
    ['invented Reddit attribution', run => { run.observations.day2.consentedRedditReferrals = null; }, 'must not claim Reddit-specific referral attribution'],
    ['missing truth rules', run => { run.truthRules = []; }, 'truth rule is missing']
];

for (const [name, mutate, expected] of invalidCases) {
    const run = clone(base.run);
    mutate(run);
    const failures = validateCommunityRun({ ...base, run });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

const published = clone(base.run);
published.state = 'seven_day_read_in_progress';
Object.assign(published.approval, {
    existingAdultAccountConfirmed: true,
    exactPostApprovedAtActionTime: true,
    exactPostApprovedAt: '2026-09-08T11:58:00.000Z',
    approvedBy: 'Kevin',
    replyCoverageConfirmed: true
});
Object.assign(published.preflight, {
    rulesRecheckedAt: '2026-09-08T11:45:00.000Z',
    duplicateRecheckedAt: '2026-09-08T11:46:00.000Z',
    duplicateObserved: false,
    liveGameCheckedAt: '2026-09-08T11:47:00.000Z',
    liveGameHttpStatus: 200,
    openingJourneyPassedAt: '2026-09-08T11:55:00.000Z',
    automaticLinkPreviewCheckedAt: '2026-09-08T11:48:00.000Z',
    automaticLinkPreviewHttpStatus: 200,
    automaticLinkPreviewMatchesExpected: true
});
published.publication = {
    posted: true,
    postUrl: 'https://www.reddit.com/r/WebGames/comments/example/mythical_void/',
    publishedAt: '2026-09-08T12:00:00.000Z'
};
published.observations.day2.dueAt = '2026-09-10T12:00:00.000Z';
published.observations.day7.dueAt = '2026-09-15T12:00:00.000Z';
published.nextRequiredAction = 'Kevin answers replies himself. At the two-day and seven-day dates, record public aggregate evidence only.';
assert.deepStrictEqual(validateCommunityRun({ ...base, run: published }), []);
const stalePreflight = clone(published);
stalePreflight.preflight.rulesRecheckedAt = '2026-09-08T08:00:00.000Z';
assert(validateCommunityRun({ ...base, run: stalePreflight }).some(failure => failure.includes('rules check must be fresh')));
const undatedApproval = clone(published);
undatedApproval.approval.exactPostApprovedAt = null;
assert(validateCommunityRun({ ...base, run: undatedApproval }).some(failure => failure.includes('action-time gate')));
assert.deepStrictEqual(statusForRun(published, new Date('2026-09-09T12:00:00Z')).observationsDue, []);
assert.deepStrictEqual(statusForRun(published, new Date('2026-09-10T12:00:00Z')).observationsDue, ['day2']);
published.observations.day2.checkedAt = '2026-09-10T12:05:00.000Z';
assert.deepStrictEqual(statusForRun(published, new Date('2026-09-15T12:00:00Z')).observationsDue, ['day7']);

console.log('Community discovery run safeguards passed (15 cases).');
