#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { validateCommunityDiscovery, loadFromRoot } = require('./validate-community-discovery-activation.cjs');

const root = path.resolve(__dirname, '..', '..');
const base = loadFromRoot(root);
const clone = value => JSON.parse(JSON.stringify(value));

assert.deepStrictEqual(validateCommunityDiscovery(base), []);

const cases = [
    {
        name: 'rejects an invented player claim',
        mutate(plan) { plan.firstExperiment.observedAudience.meaning = '19,000 active players'; },
        expected: 'changing audience estimate needs its limits'
    },
    {
        name: 'rejects missing visible browser verification',
        mutate(plan) { plan.firstExperiment.latestReadOnlyVerification.rulesVisibleAndMatchedPreparedPlan = false; },
        expected: 'visible rule or duplicate check is incomplete'
    },
    {
        name: 'rejects hiding the blocked machine check',
        mutate(plan) { plan.firstExperiment.latestReadOnlyVerification.machineReadableRedditCheckHttpStatus = 200; },
        expected: 'blocked machine check is not recorded honestly'
    },
    {
        name: 'rejects a tracked game link',
        mutate(plan) { plan.firstExperiment.preparedPost.url = 'https://mythicalvoid.com/play/?from=reddit'; },
        expected: 'clean direct game URL'
    },
    {
        name: 'rejects a title that breaks community rules',
        mutate(plan) { plan.firstExperiment.preparedPost.title = 'Try my new game — Mythical Void'; },
        expected: 'title must start with the game name'
    },
    {
        name: 'rejects a generic marketing title',
        mutate(plan) { plan.firstExperiment.preparedPost.title = 'Mythical Void — hatch an alien creature and explore six strange worlds'; },
        expected: 'real personal beginning'
    },
    {
        name: 'rejects technical release-note language in the first post',
        mutate(plan) { plan.firstExperiment.preparedPost.firstComment += ' Built in Phaser with a three-pulse route.'; },
        expected: 'technical release-note language'
    },
    {
        name: 'rejects unexplained story language in the first post',
        mutate(plan) { plan.firstExperiment.preparedPost.firstComment += ' Your choices change Project Beacon.'; },
        expected: 'unexplained story language'
    },
    {
        name: 'rejects an overlong first comment',
        mutate(plan) { plan.firstExperiment.preparedPost.firstComment += ` ${'More detail '.repeat(60)}`; },
        expected: 'first comment is too long'
    },
    {
        name: 'rejects AI disclosure without evidence of care',
        mutate(plan) { plan.firstExperiment.preparedPost.firstComment = plan.firstExperiment.preparedPost.firstComment.replace('We tested and reworked it. ', ''); },
        expected: 'low-effort AI concern'
    },
    {
        name: 'rejects treating a divided discussion as a community rule',
        mutate(plan) { plan.firstExperiment.communityClimate.status = 'official_rule_banning_ai'; },
        expected: 'community climate is missing or overstated'
    },
    {
        name: 'rejects using the old AI discussion as a promotion opportunity',
        mutate(plan) { plan.firstExperiment.communityClimate.replyOrPromotionRecommended = true; },
        expected: 'promotional opportunity'
    },
    {
        name: 'rejects a duplicate post',
        mutate(plan) { plan.firstExperiment.duplicateCheck.existingResultObserved = true; },
        expected: 'duplicate search no longer supports a first post'
    },
    {
        name: 'rejects automated replies',
        mutate(plan) { plan.authority.automatedRepliesAuthorized = true; },
        expected: 'authority automatedRepliesAuthorized must remain false'
    },
    {
        name: 'rejects fake engagement',
        mutate(plan) { plan.authority.fakeEngagementAuthorized = true; },
        expected: 'authority fakeEngagementAuthorized must remain false'
    },
    {
        name: 'rejects an undisclosed automatic preview',
        mutate(plan) { plan.firstExperiment.preflight.automaticLinkPreviewClassification = 'official game screenshot'; },
        expected: 'labelled brand-card preview boundary is missing'
    },
    {
        name: 'rejects unavailable Reddit-specific attribution',
        mutate(plan) { plan.firstExperiment.measurement.record[2] = 'consented website visits that name Reddit as the referrer when available'; },
        expected: 'privacy-safe social-or-creator measurement boundary is missing'
    },
    {
        name: 'rejects premature publication authority',
        mutate(plan) { plan.founderDecision.postAuthorized = true; },
        expected: 'Kevin decision boundary is missing'
    },
    {
        name: 'rejects pretending a forum opportunity exists',
        mutate(plan) { plan.opportunityRadar.currentRun.matchingOpportunityObserved = true; },
        expected: 'invents a match or outside action'
    },
    {
        name: 'rejects automatic opportunity replies',
        mutate(plan) { plan.opportunityRadar.authority.automaticReplyAuthorized = true; },
        expected: 'opportunity authority automaticReplyAuthorized'
    },
    {
        name: 'rejects storing forum usernames',
        mutate(plan) { plan.opportunityRadar.report.storeUsernames = true; },
        expected: 'stores people or private content'
    },
    {
        name: 'rejects an unbounded opportunity feed',
        mutate(plan) { plan.opportunityRadar.matchRules.maximumOpportunitiesPerRun = 50; },
        expected: 'not small and fresh'
    },
    {
        name: 'rejects hijacking an old-game request',
        mutate(plan) { plan.opportunityRadar.matchRules.exclude = plan.opportunityRadar.matchRules.exclude.filter(item => !/identify a particular remembered game/i.test(item)); },
        expected: 'old-game identification requests are not excluded'
    },
    {
        name: 'requires a measurable fixed feedback route',
        mutatePlan() {},
        feedbackHtml: base.feedbackHtml.replace('A game website, forum, newsletter or creator', 'Another website'),
        expected: 'adult feedback cannot identify the community route'
    }
];

for (const testCase of cases) {
    const plan = clone(base.plan);
    if (testCase.mutate) testCase.mutate(plan);
    if (testCase.mutatePlan) testCase.mutatePlan(plan);
    const failures = validateCommunityDiscovery({
        ...base,
        plan,
        feedbackHtml: testCase.feedbackHtml || base.feedbackHtml
    });
    assert(
        failures.some(failure => failure.includes(testCase.expected)),
        `${testCase.name}: expected failure containing "${testCase.expected}", got ${JSON.stringify(failures)}`
    );
}

console.log(`Community discovery safeguards passed (${cases.length + 1} cases).`);
