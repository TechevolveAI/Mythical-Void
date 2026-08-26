#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validatePokiReadiness } = require('./validate-poki-readiness.cjs');
const {
    normalizeVolatileManifestForCompression
} = require('./measure-poki-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));
const source = readJson('docs/company/growth/POKI_READINESS_ASSESSMENT.json');
const measurement = readJson('docs/company/growth/poki-candidate-measurement.json');
const visualPlan = readJson('docs/company/content/visual-launch-moments.json');
const copy = read('docs/company/growth/POKI_READINESS_ASSESSMENT.md');
const packageJson = readJson('package.json');
const handoff = read('docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md');
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function check(assessment = source, recorded = measurement, fresh = measurement, visuals = visualPlan) {
    return validatePokiReadiness(assessment, recorded, fresh, visuals, copy, packageJson, handoff);
}

function rejected(name, expected, change) {
    const assessment = clone(source);
    const recorded = clone(measurement);
    const fresh = clone(measurement);
    const visuals = clone(visualPlan);
    change(assessment, recorded, fresh, visuals);
    const failures = check(assessment, recorded, fresh, visuals);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(check(), []);
cases += 1;
{
    const manifest = {
        schemaVersion: 1,
        target: 'itch.io-html5',
        sourceCommit: 'a'.repeat(40),
        builtAt: '2026-08-26T21:00:00.000Z'
    };
    const laterManifest = {
        ...manifest,
        sourceCommit: 'b'.repeat(40),
        builtAt: '2026-08-26T22:00:00.000Z'
    };
    const normalized = normalizeVolatileManifestForCompression(
        'itch-package-manifest.json',
        Buffer.from(JSON.stringify(manifest))
    );
    const normalizedLater = normalizeVolatileManifestForCompression(
        'itch-package-manifest.json',
        Buffer.from(JSON.stringify(laterManifest))
    );
    assert.deepStrictEqual(normalized, normalizedLater);
    cases += 1;
}
{
    const recorded = clone(measurement);
    const fresh = clone(measurement);
    recorded.firstLoad.gzipEstimateBytes += 32;
    fresh.firstLoad.gzipEstimateBytes += 32;
    assert.deepStrictEqual(check(source, recorded, fresh), []);
    cases += 1;
}
rejected('stale measurement', 'measurement drifted', (_a, recorded) => { recorded.package.rawBytes += 1; });
rejected('premature request', 'pokiAccessRequestAuthorized', assessment => { assessment.authority.pokiAccessRequestAuthorized = true; });
rejected('hidden outside-service gap', 'outside-services', assessment => { assessment.readiness.find(item => item.id === 'outside-services').state = 'provisional_pass'; });
rejected('premature SDK', 'SDK marker appeared before approval', (_a, recorded, fresh) => { recorded.pokiSdkMarkers.PokiSDK = true; fresh.pokiSdkMarkers.PokiSDK = true; });
rejected('invented contact', 'invents an email or thumbnail', assessment => { assessment.accessRequestDraft.contactEmail = 'not-authorized@example.com'; });
rejected('invented submission', 'falsely recorded', assessment => { assessment.accessRequestDraft.submissionMade = true; });
rejected('fake tablet proof', 'tablet touch limitation', assessment => { assessment.measurement.browserReview.tablet.touchModeVerified = true; });
rejected('fake total pass', 'total-download', assessment => { assessment.readiness.find(item => item.id === 'total-download').state = 'provisional_pass'; });
rejected('fake visual approval', 'human visual gate', (_a, _r, _f, visuals) => { visuals.requiredMoments[0].currentState = 'approved'; });

assert.strictEqual(cases, 12);
console.log('Poki readiness safeguards passed (12 cases).');
