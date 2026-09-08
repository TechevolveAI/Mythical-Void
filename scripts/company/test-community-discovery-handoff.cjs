#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFromRoot, validateCommunityRun } = require('./validate-community-discovery-run.cjs');
const { preparedPostSha256 } = require('./preflight-community-discovery.cjs');
const { buildPublishedRun, publicationFailures, validPostUrl } = require('./record-community-discovery-publication.cjs');

const root = path.resolve(__dirname, '..', '..');
const { run, plan } = loadFromRoot(root);
const clone = value => JSON.parse(JSON.stringify(value));
const now = new Date('2026-09-08T12:30:00.000Z');
const postUrl = 'https://www.reddit.com/r/WebGames/comments/abc123/mythical_void/';
const publishedAt = '2026-09-08T12:20:00.000Z';
const postHash = preparedPostSha256(run.preparedPost);
const receipt = {
    receiptVersion: 1,
    workflow: run.id,
    checkedAt: '2026-09-08T12:00:00.000Z',
    community: run.community,
    preparedPost: run.preparedPost,
    actionEvidence: {
        schemaVersion: 1,
        preparedPostSha256: postHash,
        existingAdultAccountConfirmed: true,
        exactPostApprovedAt: '2026-09-08T11:55:00.000Z',
        approvedBy: 'Kevin',
        adultReplyOwner: 'Kevin',
        replyCoverageConfirmed: true,
        rules: {
            checkedAt: '2026-09-08T11:30:00.000Z',
            sourceUrl: 'https://www.reddit.com/r/WebGames/about/rules',
            allPreparedRulesStillPresent: true
        },
        duplicate: {
            checkedAt: '2026-09-08T11:35:00.000Z',
            sourceUrl: 'https://www.reddit.com/r/WebGames/search/?q=%22Mythical%20Void%22&restrict_sr=1&sort=new',
            mythicalVoidPostObserved: false
        }
    },
    publicProbes: {
        checkedAt: '2026-09-08T12:00:10.000Z',
        liveGameStatus: 200,
        liveGameOk: true,
        previewMetadataOk: true,
        previewImageStatus: 200,
        previewImageOk: true
    },
    openingJourney: { passed: true },
    publicChecksPassed: true,
    openingJourneyPassed: true,
    expectedPostHash: postHash,
    actionReady: true,
    postingPerformed: false,
    failures: [],
    missingHumanActions: []
};

let cases = 0;
let outcome = buildPublishedRun({ run, plan, receipt, postUrl, publishedAt, now });
cases += 1;
assert.deepStrictEqual(outcome.failures, []);
assert.strictEqual(outcome.updatedRun.publication.posted, true);
assert.strictEqual(outcome.updatedRun.observations.day2.dueAt, '2026-09-10T12:20:00.000Z');
assert.strictEqual(outcome.updatedRun.observations.day7.dueAt, '2026-09-15T12:20:00.000Z');
assert.strictEqual(outcome.updatedRun.observations.day2.platformViews, null);
assert.deepStrictEqual(validateCommunityRun({ run: outcome.updatedRun, plan }), []);

for (const [name, mutate, expected] of [
    ['already posted', ({ localRun }) => { localRun.publication.posted = true; }, 'already recorded'],
    ['wrong host', value => { value.postUrl = 'https://example.com/r/WebGames/comments/abc123/'; }, 'clean public'],
    ['tracked URL', value => { value.postUrl += '?utm_source=test'; }, 'clean public'],
    ['bad time', value => { value.publishedAt = 'not-a-date'; }, 'valid ISO'],
    ['future time', value => { value.publishedAt = '2026-09-08T12:31:00Z'; }, 'future'],
    ['before preflight', value => { value.publishedAt = '2026-09-08T11:59:59Z'; }, 'after the action-time'],
    ['stale receipt', value => { value.publishedAt = '2026-09-08T12:30:01Z'; value.now = new Date('2026-09-08T12:31:00Z'); }, 'too old'],
    ['not ready', ({ localReceipt }) => { localReceipt.actionReady = false; }, 'did not pass'],
    ['claimed automation posted', ({ localReceipt }) => { localReceipt.postingPerformed = true; }, 'did not pass'],
    ['wrong hash', ({ localReceipt }) => { localReceipt.expectedPostHash = '0'.repeat(64); }, 'exact prepared post'],
    ['changed copy', ({ localReceipt }) => { localReceipt.preparedPost.title += ' changed'; }, 'exact prepared post'],
    ['human hash missing', ({ localReceipt }) => { localReceipt.actionEvidence.preparedPostSha256 = '0'.repeat(64); }, 'human approval'],
    ['unexpected account data', ({ localReceipt }) => { localReceipt.actionEvidence.accountName = 'not allowed'; }, 'shape is invalid'],
    ['account missing', ({ localReceipt }) => { localReceipt.actionEvidence.existingAdultAccountConfirmed = false; }, 'adult account'],
    ['reply cover missing', ({ localReceipt }) => { localReceipt.actionEvidence.replyCoverageConfirmed = false; }, 'reply cover'],
    ['stale rules', ({ localReceipt }) => { localReceipt.actionEvidence.rules.checkedAt = '2026-09-08T09:59:59Z'; }, 'rules check'],
    ['duplicate found', ({ localReceipt }) => { localReceipt.actionEvidence.duplicate.mythicalVoidPostObserved = true; }, 'duplicate check'],
    ['game failed', ({ localReceipt }) => { localReceipt.publicChecksPassed = false; }, 'live game'],
    ['opening failed', ({ localReceipt }) => { localReceipt.openingJourney.passed = false; }, 'opening journey']
]) {
    const input = {
        localRun: clone(run),
        localReceipt: clone(receipt),
        postUrl,
        publishedAt,
        now
    };
    mutate(input);
    const failures = publicationFailures({
        run: input.localRun,
        receipt: input.localReceipt,
        postUrl: input.postUrl,
        publishedAt: input.publishedAt,
        now: input.now
    });
    cases += 1;
    assert(failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(failures)}`);
}

cases += 1;
assert.strictEqual(validPostUrl(postUrl), true);
assert.strictEqual(validPostUrl('http://www.reddit.com/r/WebGames/comments/abc123/x/'), false);
assert.strictEqual(validPostUrl('https://www.reddit.com/r/Other/comments/abc123/x/'), false);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const recorderSource = fs.readFileSync(path.join(root, 'scripts/company/record-community-discovery-publication.cjs'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'docs/company/growth/COMMUNITY_PUBLICATION_HANDOFF.md'), 'utf8');
cases += 1;
assert.strictEqual(packageJson.scripts['community:record-post'], 'node scripts/company/record-community-discovery-publication.cjs');
assert.strictEqual(packageJson.scripts['test:community-handoff'], 'node scripts/company/test-community-discovery-handoff.cjs');
assert(packageJson.scripts.build.includes('npm run test:community-handoff'));
assert(!recorderSource.includes('fetch('));
assert(recorderSource.includes('externalActionPerformedByThisCommand: false'));
assert(guide.includes('never creates or publishes one'));
assert(guide.includes('either total may honestly be zero'));

assert.strictEqual(cases, 22);
console.log('Community publication handoff safeguards passed (22 cases).');
