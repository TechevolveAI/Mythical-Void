#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scriptPath = path.join(__dirname, 'synthesize-customer-evidence.cjs');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a005-'));

function baseRecord(id, overrides = {}) {
    return {
        id,
        status: 'accepted',
        observedDate: '2026-08-10',
        acceptedDate: '2026-08-11',
        sourceType: 'adult_interview',
        audienceRole: 'player',
        recruitmentContext: 'Approved directional research round',
        protocolRef: 'ROUND-TEST / consent record stored in restricted research system',
        productVersion: 'test-build-a',
        journey: 'hatch',
        observation: 'Participant understood that the creature changes in response to play.',
        interpretation: 'The companion-growth proposition was understood in this session.',
        alternativeExplanations: ['The facilitator may have primed the concept earlier.'],
        confidence: 'medium',
        themes: ['companion'],
        evidenceOwner: 'Test evidence reviewer',
        nextDecision: 'Assess whether the proposition is understood across sources.',
        retentionDeleteDate: '2026-09-30',
        rawDataRef: 'Restricted test reference; no raw data retained in repository',
        containsPersonalData: false,
        humanReviewed: true,
        synthetic: false,
        ...overrides
    };
}

function runCase(name, records) {
    const fixturePath = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(fixturePath, JSON.stringify({
        schemaVersion: 1,
        purpose: 'Temporary A-005 evaluation fixture',
        registerContainsPersonalData: false,
        externalSharingAuthorized: false,
        minimumDistinctEvidenceForTheme: 3,
        records
    }));
    const result = spawnSync(process.execPath, [scriptPath, fixturePath], { encoding: 'utf8' });
    let output;
    try {
        output = JSON.parse(result.stdout);
    } catch (error) {
        throw new Error(`${name} did not produce JSON: ${result.stdout}\n${result.stderr}`);
    }
    return { status: result.status, output };
}

try {
    const empty = runCase('empty', []);
    assert.strictEqual(empty.status, 2);
    assert.strictEqual(empty.output.registerValid, true);
    assert.strictEqual(empty.output.decisionReadiness, false);
    assert.strictEqual(empty.output.themeCount, 0);

    const leakedEmail = runCase('leaked-email', [baseRecord('CE-001', {
        observation: 'Participant can be contacted at player@example.com.'
    })]);
    assert.strictEqual(leakedEmail.status, 1);
    assert(leakedEmail.output.failures.some(failure => failure.includes('email-like')));

    const synthetic = runCase('synthetic', [baseRecord('CE-001', { synthetic: true })]);
    assert.strictEqual(synthetic.status, 1);
    assert(synthetic.output.failures.some(failure => failure.includes('synthetic')));

    const unreviewed = runCase('unreviewed', [baseRecord('CE-001', { humanReviewed: false })]);
    assert.strictEqual(unreviewed.status, 1);
    assert(unreviewed.output.failures.some(failure => failure.includes('humanReviewed')));

    const credible = runCase('credible', [
        baseRecord('CE-001'),
        baseRecord('CE-002', {
            sourceType: 'moderated_playtest',
            observation: 'Participant anticipated that later choices would affect the companion bond.',
            interpretation: 'The bond system created forward curiosity in this observed session.',
            confidence: 'high'
        }),
        baseRecord('CE-003', {
            sourceType: 'parent_guardian_interview',
            audienceRole: 'parent_guardian',
            observation: 'Participant described companion continuity as the clearest reason to return.',
            interpretation: 'Companion continuity may support the return proposition for this audience.',
            journey: 'return',
            confidence: 'high'
        })
    ]);
    assert.strictEqual(credible.status, 0);
    assert.strictEqual(credible.output.registerValid, true);
    assert.strictEqual(credible.output.decisionReadiness, true);
    assert.strictEqual(credible.output.credibleThemeCount, 1);
    assert.deepStrictEqual(credible.output.themes[0].sourceTypes, [
        'adult_interview',
        'moderated_playtest',
        'parent_guardian_interview'
    ]);
    assert.match(credible.output.themes[0].boundary, /no population prevalence inference/i);

    console.log('A-005 customer evidence synthesis evaluations passed (5 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
