#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-adult-research-operations.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/research/round-001a-operations.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a029-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.researchOperationsPlanValid, true);
    assert.strictEqual(baseline.output.internalPackageReady, true);
    assert.strictEqual(baseline.output.targetSessionCount, 10);
    assert.strictEqual(baseline.output.guardianSessionCount, 6);
    assert.strictEqual(baseline.output.adjacentAdultSessionCount, 4);
    assert.deepStrictEqual(baseline.output.messageAssignment, { 'M-A': 4, 'M-B': 3, 'M-C': 3 });
    assert.strictEqual(baseline.output.satisfiedEntryGateCount, 0);
    assert.strictEqual(baseline.output.recruitmentReady, false);
    assert.strictEqual(baseline.output.contactRecordCount, 0);

    const recruitment = execute('recruitment', { ...source, authority: { ...source.authority, recruitmentAuthorized: true } });
    assert.strictEqual(recruitment.status, 1);
    assert(recruitment.output.failures.some(failure => failure.includes('recruitmentAuthorized')));

    const minorContact = execute('minor-contact', { ...source, authority: { ...source.authority, directMinorContactPermitted: true } });
    assert.strictEqual(minorContact.status, 1);
    assert(minorContact.output.failures.some(failure => failure.includes('directMinorContactPermitted')));

    const recording = execute('recording', { ...source, authority: { ...source.authority, sessionRecordingAuthorized: true } });
    assert.strictEqual(recording.status, 1);
    assert(recording.output.failures.some(failure => failure.includes('sessionRecordingAuthorized')));

    const compensation = execute('compensation', {
        ...source,
        compensation: { ...source.compensation, currency: 'EUR', amountPerCompletedSession: 25, maximumTotal: 250 }
    });
    assert.strictEqual(compensation.status, 1);
    assert(compensation.output.failures.some(failure => failure.includes('compensation.currency')));

    const contactLeak = execute('contact-leak', { ...source, contactRecords: [{ email: 'participant@example.test' }] });
    assert.strictEqual(contactLeak.status, 1);
    assert(contactLeak.output.failures.some(failure => failure.includes('contactRecords')));

    const wrongSample = execute('wrong-sample', {
        ...source,
        sessionSlots: source.sessionSlots.map((slot, index) => index === 0 ? { ...slot, audienceRole: 'adjacent_adult_player' } : slot)
    });
    assert.strictEqual(wrongSample.status, 1);
    assert(wrongSample.output.failures.some(failure => failure.includes('six guardians')));

    const imbalancedMessages = execute('imbalanced-messages', {
        ...source,
        sessionSlots: source.sessionSlots.map((slot, index) => index === 1 ? { ...slot, messageCardId: 'M-A' } : slot)
    });
    assert.strictEqual(imbalancedMessages.status, 1);
    assert(imbalancedMessages.output.failures.some(failure => failure.includes('4/3/3')));

    const prematureReady = execute('premature-ready', { ...source, recruitmentReady: true });
    assert.strictEqual(prematureReady.status, 1);
    assert(prematureReady.output.failures.some(failure => failure.includes('recruitmentReady')));

    const missingStop = execute('missing-stop', { ...source, stopRules: source.stopRules.slice(0, 7) });
    assert.strictEqual(missingStop.status, 1);
    assert(missingStop.output.failures.some(failure => failure.includes('eight stop rules')));

    const unknownExperiment = execute('unknown-experiment', { ...source, experimentRefs: [...source.experimentRefs, 'E-999'] });
    assert.strictEqual(unknownExperiment.status, 1);
    assert(unknownExperiment.output.failures.some(failure => failure.includes('E-999')));

    console.log('A-029 adult-research operations evaluations passed (11 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

