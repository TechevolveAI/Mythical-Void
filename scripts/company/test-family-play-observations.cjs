#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateRegister } = require('./family-play-observation-lib.cjs');

const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/customer/family-play-observations.json'), 'utf8'));
const recorder = path.join(__dirname, 'record-family-play-observation.cjs');
const baseArgs = [
    '--context', 'parent_observed_family_play',
    '--journey', 'hatch',
    '--build-ref', 'live-2026-08-14',
    '--worked', 'The creature reveal held attention.',
    '--confusing', 'The next action was not obvious after the reveal.',
    '--next-check', 'Test a clearer continue prompt after hatching.',
    '--themes', 'creature,controls',
    '--confirmed-by', 'Kevin Murphy'
];

function run(extra = [], replacements = {}) {
    const args = [...baseArgs];
    for (const [flag, value] of Object.entries(replacements)) {
        const index = args.indexOf(flag);
        args[index + 1] = value;
    }
    return spawnSync(process.execPath, [recorder, ...args, ...extra], { cwd: root, encoding: 'utf8' });
}

const dryRun = run();
assert.strictEqual(dryRun.status, 0);
assert.strictEqual(JSON.parse(dryRun.stdout).mode, 'dry_run');
assert.strictEqual(JSON.parse(dryRun.stdout).registerChanged, false);

for (const [label, replacements] of [
    ['email', { '--worked': 'Send details to player@example.com.' }],
    ['exact age', { '--worked': 'The player is 9 years old and enjoyed it.' }],
    ['school', { '--confusing': 'Their school was mentioned during play.' }],
    ['direct quote', { '--worked': 'The child said it was amazing.' }],
    ['wrong confirmer', { '--confirmed-by': 'Automation' }]
]) {
    const result = run([], replacements);
    assert.notStrictEqual(result.status, 0, `${label} should be rejected`);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-family-play-'));
try {
    const withObservation = JSON.parse(JSON.stringify(source));
    withObservation.state = 'internal_observations_recorded';
    withObservation.observations.push({
        id: 'PO-001',
        recordedAt: '2026-08-14T12:00:00.000Z',
        observedOn: '2026-08-14',
        context: 'adult_self_play',
        journey: 'start',
        buildRef: 'live-2026-08-14',
        worked: 'The play button was easy to find.',
        confusing: 'The first objective took time to notice.',
        nextCheck: 'Test stronger first-objective contrast.',
        themes: ['controls', 'accessibility'],
        recordedBy: 'Kevin Murphy',
        containsPersonalData: false,
        containsDirectQuote: false,
        customerEvidence: false,
        publicationAuthorized: false
    });
    assert.deepStrictEqual(validateRegister(withObservation), []);
    const unsafe = JSON.parse(JSON.stringify(withObservation));
    unsafe.observations[0].worked = 'The child said it was easy.';
    assert(validateRegister(unsafe).some(failure => failure.includes('direct quote')));
    const publicIntake = JSON.parse(JSON.stringify(source));
    publicIntake.authority.publicIntakeAuthorized = true;
    assert(validateRegister(publicIntake).some(failure => failure.includes('publicIntakeAuthorized')));
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('Family play observation safeguards passed (9 cases).');
