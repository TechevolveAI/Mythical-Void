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
