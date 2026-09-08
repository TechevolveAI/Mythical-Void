#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFromRoot, validateCommunityRun } = require('./validate-community-discovery-run.cjs');
const { statusForRun } = require('./report-community-discovery-run.cjs');
const {
    buildObservedRun,
    observationFailures,
    parseArguments,
    parseMetric
} = require('./record-community-discovery-observation.cjs');

const root = path.resolve(__dirname, '..', '..');
const { run, plan } = loadFromRoot(root);
const clone = value => JSON.parse(JSON.stringify(value));
const postUrl = 'https://www.reddit.com/r/WebGames/comments/abc123/mythical_void/';

function publishedRun() {
    const value = clone(run);
    value.state = 'seven_day_read_in_progress';
    Object.assign(value.approval, {
        existingAdultAccountConfirmed: true,
        exactPostApprovedAtActionTime: true,
        exactPostApprovedAt: '2026-09-08T11:55:00.000Z',
        approvedBy: 'Kevin',
        adultReplyOwner: 'Kevin',
        replyCoverageConfirmed: true
    });
    Object.assign(value.preflight, {
        rulesRecheckedAt: '2026-09-08T11:30:00.000Z',
        duplicateRecheckedAt: '2026-09-08T11:35:00.000Z',
        duplicateObserved: false,
        liveGameCheckedAt: '2026-09-08T12:00:10.000Z',
        liveGameHttpStatus: 200,
        openingJourneyPassedAt: '2026-09-08T12:00:00.000Z',
        automaticLinkPreviewCheckedAt: '2026-09-08T12:00:10.000Z',
        automaticLinkPreviewHttpStatus: 200,
        automaticLinkPreviewMatchesExpected: true
    });
    value.publication = { posted: true, postUrl, publishedAt: '2026-09-08T12:20:00.000Z' };
    value.observations.day2.dueAt = '2026-09-10T12:20:00.000Z';
    value.observations.day7.dueAt = '2026-09-15T12:20:00.000Z';
    value.nextRequiredAction = 'Kevin answers replies himself. At the two-day and seven-day dates, record only public totals and anonymous aggregate website evidence; do not cross-post during this read.';
    return value;
}

const day2Metrics = {
    platformViews: 0,
    publicCommentCount: 3,
    consentedSocialOrCreatorArrivals: null,
    anonymousAdultForumFeedbackCount: 0
};

let cases = 0;
assert.deepStrictEqual(validateCommunityRun({ run, plan }), []);
cases += 1;

const sourceRun = publishedRun();
assert.deepStrictEqual(validateCommunityRun({ run: sourceRun, plan }), []);
cases += 1;

let outcome = buildObservedRun({
    run: sourceRun,
    plan,
    period: 'day2',
    postUrl,
    observedAt: '2026-09-10T12:30:00Z',
    metrics: day2Metrics,
    now: new Date('2026-09-10T12:31:00Z')
});
assert.deepStrictEqual(outcome.failures, []);
assert.strictEqual(outcome.updatedRun.observations.day2.platformViews, 0);
assert.deepStrictEqual(outcome.updatedRun.observations.day2.unavailable, ['consentedSocialOrCreatorArrivals']);
assert.match(outcome.updatedRun.nextRequiredAction, /seven-day date/i);
assert.deepStrictEqual(validateCommunityRun({ run: outcome.updatedRun, plan }), []);
cases += 1;

const day2Run = outcome.updatedRun;
outcome = buildObservedRun({
    run: day2Run,
    plan,
    period: 'day7',
    postUrl,
    observedAt: '2026-09-15T12:20:00Z',
    metrics: {
        platformViews: 12,
        publicCommentCount: 3,
        consentedSocialOrCreatorArrivals: 0,
        anonymousAdultForumFeedbackCount: null
    },
    now: new Date('2026-09-15T12:21:00Z')
});
assert.deepStrictEqual(outcome.failures, []);
assert.strictEqual(outcome.updatedRun.state, 'seven_day_read_complete_waiting_for_kevin_next_route_decision');
assert.deepStrictEqual(outcome.updatedRun.observations.day7.unavailable, ['anonymousAdultForumFeedbackCount']);
assert.match(outcome.updatedRun.nextRequiredAction, /Kevin may then stop/i);
assert.deepStrictEqual(validateCommunityRun({ run: outcome.updatedRun, plan }), []);
assert.strictEqual(statusForRun(outcome.updatedRun, new Date('2026-09-15T12:21:00Z')).state, 'seven_day_read_complete');
assert.match(statusForRun(outcome.updatedRun, new Date('2026-09-15T12:21:00Z')).next, /Phaser Showcase/i);
cases += 1;

for (const [name, mutate, expected] of [
    ['unpublished run', input => { input.localRun = clone(run); }, 'not been recorded as published'],
    ['wrong period', input => { input.period = 'day3'; }, 'period must be day2 or day7'],
    ['wrong post', input => { input.postUrl = 'https://www.reddit.com/r/WebGames/comments/other/post/'; }, 'exact public post URL'],
    ['early day two', input => { input.observedAt = '2026-09-10T12:19:59Z'; }, 'before it is due'],
    ['future observation', input => { input.observedAt = '2026-09-10T12:32:00Z'; }, 'future'],
    ['already recorded', input => { input.localRun.observations.day2.checkedAt = '2026-09-10T12:20:00Z'; }, 'already been recorded'],
    ['missing metric', input => { delete input.metrics.publicCommentCount; }, 'every aggregate metric'],
    ['negative metric', input => { input.metrics.platformViews = -1; }, 'non-negative whole number'],
    ['day seven before day two', input => { input.period = 'day7'; input.observedAt = '2026-09-15T12:20:00Z'; input.now = new Date('2026-09-15T12:21:00Z'); }, 'two-day observation']
]) {
    const input = {
        localRun: publishedRun(),
        period: 'day2',
        postUrl,
        observedAt: '2026-09-10T12:30:00Z',
        metrics: clone(day2Metrics),
        now: new Date('2026-09-10T12:31:00Z')
    };
    mutate(input);
    const failures = observationFailures({
        run: input.localRun,
        period: input.period,
        postUrl: input.postUrl,
        observedAt: input.observedAt,
        metrics: input.metrics,
        now: input.now
    });
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
    cases += 1;
}

assert.strictEqual(parseMetric('0', '--platform-views'), 0);
assert.strictEqual(parseMetric('unavailable', '--platform-views'), null);
assert.throws(() => parseMetric('-1', '--platform-views'), /non-negative whole number/);
assert.throws(() => parseMetric('1.5', '--platform-views'), /non-negative whole number/);
cases += 4;

const parsed = parseArguments([
    '--confirm-observed', '--period', 'day2', '--post-url', postUrl,
    '--observed-at', '2026-09-10T12:30:00Z', '--platform-views', '0',
    '--public-comments', '3', '--social-or-creator-arrivals', 'unavailable',
    '--adult-forum-feedback', '0'
]);
assert.deepStrictEqual(parsed.metrics, day2Metrics);
assert.throws(() => parseArguments(['--account-name', 'private']), /unexpected option/);
assert.throws(() => parseArguments(['--confirm-observed', '--period', 'day2']), /needs the exact recorded public post URL/);
assert.throws(() => parseArguments([
    '--confirm-observed', '--period', 'day2', '--period', 'day7', '--post-url', postUrl,
    '--observed-at', '2026-09-10T12:30:00Z', '--platform-views', '0',
    '--public-comments', '0', '--social-or-creator-arrivals', '0', '--adult-forum-feedback', '0'
]), /duplicate option/);
cases += 4;

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const recorderSource = fs.readFileSync(path.join(root, 'scripts/company/record-community-discovery-observation.cjs'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'docs/company/growth/COMMUNITY_OBSERVATION_HANDOFF.md'), 'utf8');
assert.strictEqual(packageJson.scripts['community:record-observation'], 'node scripts/company/record-community-discovery-observation.cjs');
assert.strictEqual(packageJson.scripts['test:community-observation'], 'node scripts/company/test-community-discovery-observation.cjs');
assert(packageJson.scripts.build.includes('npm run test:community-observation'));
assert(!recorderSource.includes('fetch('));
assert(recorderSource.includes('externalActionPerformedByThisCommand: false'));
assert(guide.includes('Use `unavailable`'));
assert(/Zero is valid only when the source\s+actually shows zero\./.test(guide));
cases += 1;

assert.strictEqual(cases, 22);
console.log(`Community observation safeguards passed (${cases} cases).`);
