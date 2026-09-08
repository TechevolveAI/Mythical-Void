#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFromRoot } = require('./validate-community-discovery-run.cjs');
const {
    DUPLICATE_URL,
    EXPECTED_PREVIEW,
    RULES_URL,
    evaluatePreflight,
    parseArguments,
    parseMeta,
    preparedPostSha256,
    unexpectedEvidenceFields
} = require('./preflight-community-discovery.cjs');

const root = path.resolve(__dirname, '..', '..');
const { run, plan } = loadFromRoot(root);
const now = new Date('2026-09-08T12:00:00.000Z');
const goodProbes = {
    liveGameOk: true,
    previewMetadataOk: true,
    previewImageOk: true
};
const goodEvidence = {
    schemaVersion: 1,
    preparedPostSha256: preparedPostSha256(run.preparedPost),
    existingAdultAccountConfirmed: true,
    exactPostApprovedAt: '2026-09-08T11:45:00.000Z',
    approvedBy: 'Kevin',
    adultReplyOwner: 'Kevin',
    replyCoverageConfirmed: true,
    rules: {
        checkedAt: '2026-09-08T11:30:00.000Z',
        sourceUrl: RULES_URL,
        allPreparedRulesStillPresent: true
    },
    duplicate: {
        checkedAt: '2026-09-08T11:35:00.000Z',
        sourceUrl: DUPLICATE_URL,
        mythicalVoidPostObserved: false
    }
};
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function evaluate(actionEvidence = goodEvidence, probes = goodProbes, openingJourneyPassed = true, at = now) {
    cases += 1;
    return evaluatePreflight({ run, plan, actionEvidence, probes, openingJourneyPassed, now: at });
}

let result = evaluate();
assert.strictEqual(result.actionReady, true);
assert.strictEqual(result.postingPerformed, false);
assert.deepStrictEqual(result.failures, []);

result = evaluate(null);
assert.strictEqual(result.actionReady, false);
assert.strictEqual(result.failures.length, 0);
assert(result.missingHumanActions.length >= 5);

for (const [name, mutate, expected] of [
    ['wrong hash', value => { value.preparedPostSha256 = '0'.repeat(64); }, 'exact prepared post'],
    ['stale approval', value => { value.exactPostApprovedAt = '2026-09-08T11:29:59.000Z'; }, 'approval is stale'],
    ['future approval', value => { value.exactPostApprovedAt = '2026-09-08T12:00:01.000Z'; }, 'approval is in the future'],
    ['wrong approver', value => { value.approvedBy = 'Automation'; }, null],
    ['no reply cover', value => { value.replyCoverageConfirmed = false; }, null],
    ['stale rules', value => { value.rules.checkedAt = '2026-09-08T09:59:59.000Z'; }, 'rules check is stale'],
    ['rules changed', value => { value.rules.allPreparedRulesStillPresent = false; }, 'rules were not confirmed'],
    ['duplicate found', value => { value.duplicate.mythicalVoidPostObserved = true; }, 'clear first post'],
    ['wrong duplicate source', value => { value.duplicate.sourceUrl = 'https://example.com'; }, 'wrong source']
]) {
    const evidence = clone(goodEvidence);
    mutate(evidence);
    result = evaluate(evidence);
    assert.strictEqual(result.actionReady, false, name);
    if (expected) assert(result.failures.some(failure => failure.includes(expected)), `${name}: ${JSON.stringify(result)}`);
    else assert(result.missingHumanActions.length > 0, name);
}

result = evaluate(goodEvidence, { ...goodProbes, liveGameOk: false });
assert(result.failures.includes('the live game doorway failed'));
result = evaluate(goodEvidence, { ...goodProbes, previewMetadataOk: false });
assert(result.failures.includes('the automatic preview metadata failed'));
result = evaluate(goodEvidence, { ...goodProbes, previewImageOk: false });
assert(result.failures.includes('the automatic preview image failed'));
result = evaluate(goodEvidence, goodProbes, false);
assert(result.failures.includes('fresh opening journey did not pass'));

const evidenceWithSecret = clone(goodEvidence);
evidenceWithSecret.password = 'must-never-be-here';
result = evaluate(evidenceWithSecret);
assert(result.failures.some(failure => failure.includes('unexpected fields: password')));

cases += 1;
assert.deepStrictEqual(unexpectedEvidenceFields({ ...goodEvidence, rules: { ...goodEvidence.rules, accountName: 'not-allowed' } }), ['rules.accountName']);

cases += 1;
assert.strictEqual(
    parseMeta(`<meta property="og:image" content="${EXPECTED_PREVIEW}">`, 'property', 'og:image'),
    EXPECTED_PREVIEW
);
cases += 1;
assert.strictEqual(preparedPostSha256(run.preparedPost).length, 64);

cases += 1;
assert(/<script\s+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/.test('<script type="module" crossorigin src="/assets/index-C4arEpae.js"></script>'));

const template = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/COMMUNITY_ACTION_TIME_PREFLIGHT_TEMPLATE.json'), 'utf8'));
cases += 1;
assert.deepStrictEqual(unexpectedEvidenceFields(template), []);
assert.strictEqual(template.existingAdultAccountConfirmed, false);
assert.strictEqual(template.exactPostApprovedAt, null);
assert.strictEqual(template.rules.allPreparedRulesStillPresent, false);
assert.strictEqual(template.duplicate.mythicalVoidPostObserved, null);

const guide = fs.readFileSync(path.join(root, 'docs/company/growth/COMMUNITY_ACTION_TIME_PREFLIGHT.md'), 'utf8');
cases += 1;
assert(guide.includes('does not post'));
assert(guide.includes('Do not add an account'));
assert(guide.includes('30 minutes'));
assert(guide.includes('two hours'));

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
cases += 1;
assert.strictEqual(packageJson.scripts['community:preflight'], 'node scripts/company/preflight-community-discovery.cjs');
assert.strictEqual(packageJson.scripts['test:community-preflight'], 'node scripts/company/test-community-discovery-preflight.cjs');
assert(packageJson.scripts.build.includes('npm run test:community-preflight'));

cases += 1;
assert.throws(() => parseArguments(['--write-receipt', path.join(root, 'receipt.json')]), /only available with --action-time/);
assert.throws(() => parseArguments(['--action-time', '/private/tmp/action.json', '--write-receipt', path.join(root, 'receipt.json')]), /outside the repository/);
assert.strictEqual(parseArguments(['--action-time', '/private/tmp/action.json', '--write-receipt', '/private/tmp/receipt.json', '--at', '2026-09-08T12:00:00Z']).receiptPath, '/private/tmp/receipt.json');

assert.strictEqual(cases, 24);
console.log('Community action-time preflight safeguards passed (24 cases).');
