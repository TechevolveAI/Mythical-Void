#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-engagement-lifecycle.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/engagement/lifecycle-programs.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a020-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.lifecycleValid, true);
    assert.strictEqual(baseline.output.programCount, 6);
    assert.strictEqual(baseline.output.executionReadyProgramCount, 0);
    assert.strictEqual(baseline.output.contactRecordCount, 0);
    assert.strictEqual(baseline.output.externalEngagementAuthorized, false);

    const globalAuthorization = execute('global-authorization', { ...source, externalEngagementAuthorized: true });
    assert.strictEqual(globalAuthorization.status, 1);
    assert(globalAuthorization.output.failures.some(failure => failure.includes('externalEngagementAuthorized')));

    const contactRecord = execute('contact-record', { ...source, contactRecords: [{ email: 'person@example.com' }] });
    assert.strictEqual(contactRecord.status, 1);
    assert(contactRecord.output.failures.some(failure => failure.includes('contactRecords')));
    assert(contactRecord.output.failures.some(failure => failure.includes('email address')));

    const minorContact = execute('minor-contact', {
        ...source,
        programs: source.programs.map((item, index) => index === 1 ? { ...item, allowsDirectMinorContact: true } : item)
    });
    assert.strictEqual(minorContact.status, 1);
    assert(minorContact.output.failures.some(failure => failure.includes('direct minor contact')));

    const autonomous = execute('autonomous', { ...source, autonomousRepliesPermitted: true });
    assert.strictEqual(autonomous.status, 1);
    assert(autonomous.output.failures.some(failure => failure.includes('autonomousRepliesPermitted')));

    const unknownReference = execute('unknown-reference', {
        ...source,
        programs: source.programs.map((item, index) => index === 3 ? { ...item, opportunityRefs: [...item.opportunityRefs, 'OP-999'] } : item)
    });
    assert.strictEqual(unknownReference.status, 1);
    assert(unknownReference.output.failures.some(failure => failure.includes('OP-999')));

    const prematureReady = execute('premature-ready', {
        ...source,
        programs: source.programs.map((item, index) => index === 4 ? { ...item, executionReady: true } : item)
    });
    assert.strictEqual(prematureReady.status, 1);
    assert(prematureReady.output.failures.some(failure => failure.includes('executionReady')));

    console.log('A-020 engagement lifecycle evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
